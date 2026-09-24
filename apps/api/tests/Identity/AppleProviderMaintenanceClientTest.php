<?php

declare(strict_types=1);

namespace App\Tests\Identity;

use App\Identity\{AppleClientSecretSigner, AppleIdentityVerifier, AppleProviderMaintenanceClient, AppleSigningKeySource, IdentityVerificationFailure, ProviderMaintenanceFailure, ProviderRefreshResult, VerifiedAppleIdentity};
use App\Tests\Fixtures\{AppleTokenFixture, FixedClock};
use Firebase\JWT\{JWT, Key};
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpClient\Exception\TransportException;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class AppleProviderMaintenanceClientTest extends TestCase
{
    private static AppleTokenFixture $tokens;
    private string $keyPath;
    private FixedClock $clock;
    private AppleClientSecretSigner $signer;
    private AppleIdentityVerifier $verifier;
    private Key $clientPublicKey;

    public static function setUpBeforeClass(): void
    {
        self::$tokens = new AppleTokenFixture();
    }

    protected function setUp(): void
    {
        $this->clock = new FixedClock();
        $key = openssl_pkey_new(['private_key_type' => OPENSSL_KEYTYPE_EC, 'curve_name' => 'prime256v1']);
        self::assertInstanceOf(\OpenSSLAsymmetricKey::class, $key);
        self::assertTrue(openssl_pkey_export($key, $pem));
        $details = openssl_pkey_get_details($key);
        self::assertIsArray($details);
        $this->clientPublicKey = new Key($details['key'], 'ES256');
        $path = tempnam(sys_get_temp_dir(), 'oathforge-DUMMY-maintenance-');
        self::assertIsString($path);
        $this->keyPath = $path;
        chmod($path, 0600);
        file_put_contents($path, $pem);
        $this->signer = new AppleClientSecretSigner($this->clock, AppleTokenFixture::AUDIENCE, 'TESTTEAM01', 'TESTKEY001', $path);
        $keys = new class(self::$tokens->key) implements AppleSigningKeySource {
            public function __construct(private Key $key) {}
            public function find(string $kid): Key { return $this->key; }
        };
        $this->verifier = new AppleIdentityVerifier($keys, $this->clock, AppleTokenFixture::AUDIENCE);
    }

    protected function tearDown(): void
    {
        if (is_file($this->keyPath)) { unlink($this->keyPath); }
    }

    public function testSignedRefreshWithoutNonceCanRetainOrRotateCredential(): void
    {
        foreach ([[], ['refresh_token' => 'DUMMY-rotated']] as $fields) {
            $http = new MockHttpClient(new MockResponse(json_encode(['id_token' => $this->refreshToken()] + $fields, JSON_THROW_ON_ERROR)));
            $result = $this->client($http)->refresh('DUMMY-stored-refresh', $this->identity());
            self::assertInstanceOf(ProviderRefreshResult::class, $result);
            self::assertSame($fields['refresh_token'] ?? null, $result->refreshToken);
            self::assertSame(1, $http->getRequestsCount());
        }
        // Refresh never relaxes the login boundary's required signed nonce.
        self::assertSame(IdentityVerificationFailure::InvalidCredential, $this->verifier->verify($this->refreshToken(), hash('sha256', AppleTokenFixture::NONCE)));
    }

    public function testRefreshAndRevokeUseOnlyFixedUrlsAndBackendCredentials(): void
    {
        foreach ([false, true] as $revoke) {
            $http = new MockHttpClient(function (string $method, string $url, array $options) use ($revoke): MockResponse {
                self::assertSame('POST', $method);
                self::assertSame('https://appleid.apple.com/auth/'.($revoke ? 'revoke' : 'token'), $url);
                self::assertSame(2.0, $options['timeout']);
                self::assertSame(5.0, $options['max_duration']);
                self::assertSame(0, $options['max_redirects']);
                self::assertTrue($options['verify_peer']);
                self::assertTrue($options['verify_host']);
                self::assertFalse($options['buffer']);
                parse_str($options['body'], $form);
                self::assertSame($revoke ? ['client_id', 'client_secret', 'token', 'token_type_hint'] : ['client_id', 'client_secret', 'refresh_token', 'grant_type'], array_keys($form));
                self::assertSame('DUMMY-stored-refresh', $form[$revoke ? 'token' : 'refresh_token']);
                self::assertSame('refresh_token', $form[$revoke ? 'token_type_hint' : 'grant_type']);
                self::assertSame(AppleTokenFixture::AUDIENCE, $form['client_id']);
                self::assertIsString($form['client_secret']);
                $oldTime = JWT::$timestamp;
                try {
                    JWT::$timestamp = $this->clock->time;
                    $claims = JWT::decode($form['client_secret'], $this->clientPublicKey);
                    self::assertSame(['iss' => 'TESTTEAM01', 'sub' => AppleTokenFixture::AUDIENCE, 'aud' => 'https://appleid.apple.com', 'iat' => $this->clock->time, 'exp' => $this->clock->time + 300], (array) $claims);
                } finally {
                    JWT::$timestamp = $oldTime;
                }
                return new MockResponse($revoke ? '' : json_encode(['id_token' => $this->refreshToken()], JSON_THROW_ON_ERROR));
            });
            $client = $this->client($http);
            if ($revoke) { self::assertTrue($client->revoke('DUMMY-stored-refresh')); }
            else { self::assertInstanceOf(ProviderRefreshResult::class, $client->refresh('DUMMY-stored-refresh', $this->identity())); }
            self::assertSame(1, $http->getRequestsCount());
        }
    }

    /** @return iterable<string, array{int, string, ProviderMaintenanceFailure}> */
    public static function failures(): iterable
    {
        yield 'explicit invalid grant' => [400, '{"error":"invalid_grant"}', ProviderMaintenanceFailure::InvalidGrant];
        yield 'invalid client' => [400, '{"error":"invalid_client"}', ProviderMaintenanceFailure::Unavailable];
        yield 'rate limit' => [429, '{"error":"invalid_grant"}', ProviderMaintenanceFailure::Unavailable];
        yield 'outage' => [503, '{"error":"invalid_grant"}', ProviderMaintenanceFailure::Unavailable];
        yield 'redirect' => [302, '{}', ProviderMaintenanceFailure::Unavailable];
        yield 'malformed' => [200, '{', ProviderMaintenanceFailure::Unavailable];
        yield 'array' => [200, '[]', ProviderMaintenanceFailure::Unavailable];
        yield 'missing identity' => [200, '{}', ProviderMaintenanceFailure::Unavailable];
        yield 'success with error' => [200, '{"error":"invalid_grant"}', ProviderMaintenanceFailure::Unavailable];
    }

    #[DataProvider('failures')]
    public function testOnlyExplicitInvalidGrantCanInvalidateSessions(int $status, string $body, ProviderMaintenanceFailure $expected): void
    {
        $http = new MockHttpClient(new MockResponse($body, ['http_code' => $status]));
        self::assertSame($expected, $this->client($http)->refresh('DUMMY-stored-refresh', $this->identity()));
        self::assertSame(1, $http->getRequestsCount());
    }

    public function testInvalidRefreshClaimsAndMalformedRotationAreUnavailable(): void
    {
        foreach ([['sub' => 'other'], ['iss' => 'https://attacker.invalid'], ['aud' => 'other'], ['aud' => [AppleTokenFixture::AUDIENCE]], ['iat' => '1800000000'], ['exp' => 1800000000], ['nbf' => 1800000001]] as $changes) {
            $http = new MockHttpClient(new MockResponse(json_encode(['id_token' => $this->refreshToken($changes)], JSON_THROW_ON_ERROR)));
            self::assertSame(ProviderMaintenanceFailure::Unavailable, $this->client($http)->refresh('DUMMY-stored-refresh', $this->identity()));
            self::assertSame(1, $http->getRequestsCount());
        }
        foreach (['', ' ', null, 123, []] as $replacement) {
            $http = new MockHttpClient(new MockResponse(json_encode(['id_token' => $this->refreshToken(), 'refresh_token' => $replacement], JSON_THROW_ON_ERROR)));
            self::assertSame(ProviderMaintenanceFailure::Unavailable, $this->client($http)->refresh('DUMMY-stored-refresh', $this->identity()));
        }
        $parts = explode('.', $this->refreshToken());
        $parts[2] = ('A' === $parts[2][0] ? 'B' : 'A').substr($parts[2], 1);
        $http = new MockHttpClient(new MockResponse(json_encode(['id_token' => implode('.', $parts)], JSON_THROW_ON_ERROR)));
        self::assertSame(ProviderMaintenanceFailure::Unavailable, $this->client($http)->refresh('DUMMY-stored-refresh', $this->identity()));
    }

    public function testNetworkAndBodyFailuresNeverRetryOrExposeDiagnostics(): void
    {
        foreach ([new MockResponse(str_repeat('x', 65537)), new MockResponse((static function (): \Generator { yield ''; })()), new MockResponse((static function (): \Generator { yield new TransportException('DUMMY-private-diagnostic'); })())] as $response) {
            $http = new MockHttpClient($response);
            self::assertSame(ProviderMaintenanceFailure::Unavailable, $this->client($http)->refresh('DUMMY-stored-refresh', $this->identity()));
            self::assertSame(1, $http->getRequestsCount());
        }
    }

    public function testRevokeRequires200AndSuccessfulBoundedTransport(): void
    {
        foreach ([200, 400, 401, 429, 503, 302] as $status) {
            $http = new MockHttpClient(new MockResponse('', ['http_code' => $status]));
            self::assertSame(200 === $status, $this->client($http)->revoke('DUMMY-stored-refresh'));
            self::assertSame(1, $http->getRequestsCount());
        }
        foreach ([new MockResponse(str_repeat('x', 65537)), new MockResponse((static function (): \Generator { yield new TransportException('DUMMY-private-diagnostic'); })())] as $response) {
            $http = new MockHttpClient($response);
            self::assertFalse($this->client($http)->revoke('DUMMY-stored-refresh'));
            self::assertSame(1, $http->getRequestsCount());
        }
    }

    public function testMissingConfigurationAndBlankTokenNeverCallProvider(): void
    {
        $http = new MockHttpClient();
        self::assertSame(ProviderMaintenanceFailure::Unavailable, $this->client($http)->refresh(' ', $this->identity()));
        self::assertFalse($this->client($http)->revoke(''));
        unlink($this->keyPath);
        self::assertSame(ProviderMaintenanceFailure::Unavailable, $this->client($http)->refresh('DUMMY-token', $this->identity()));
        self::assertFalse($this->client($http)->revoke('DUMMY-token'));
        self::assertSame(0, $http->getRequestsCount());
    }

    /** @param array<string, mixed> $changes */
    private function refreshToken(array $changes = []): string
    {
        $claims = array_replace(self::$tokens->claims(), $changes);
        unset($claims['nonce']);
        return JWT::encode($claims, self::$tokens->privateKey, 'RS256', self::$tokens->kid);
    }

    private function identity(): VerifiedAppleIdentity { return new VerifiedAppleIdentity('https://appleid.apple.com', 'DUMMY-subject'); }
    private function client(MockHttpClient $http): AppleProviderMaintenanceClient { return new AppleProviderMaintenanceClient($this->signer, $this->verifier, $http); }
}
