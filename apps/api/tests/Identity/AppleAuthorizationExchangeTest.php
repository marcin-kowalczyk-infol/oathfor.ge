<?php

declare(strict_types=1);

namespace App\Tests\Identity;

use App\Identity\AppleAuthorization;
use App\Identity\AppleAuthorizationExchange;
use App\Identity\AppleClientSecretSigner;
use App\Identity\AppleClientSecret;
use App\Identity\IdentityVerificationFailure;
use App\Identity\AppleIdentityVerifier;
use App\Identity\AppleSigningKeySource;
use App\Identity\VerifiedAppleIdentity;
use App\Tests\Fixtures\AppleTokenFixture;
use App\Tests\Fixtures\FixedClock;
use Firebase\JWT\Key;
use Firebase\JWT\JWT;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class AppleAuthorizationExchangeTest extends TestCase
{
    private static AppleTokenFixture $identity;
    private string $keyPath;
    private FixedClock $clock;
    private AppleClientSecretSigner $signer;
    private AppleIdentityVerifier $verifier;
    private Key $clientPublicKey;

    public static function setUpBeforeClass(): void
    {
        self::$identity = new AppleTokenFixture();
    }

    protected function setUp(): void
    {
        $this->clock = new FixedClock();
        // DUMMY EC signing material; generated only in a private disposable test file.
        $private = openssl_pkey_new(['private_key_type' => OPENSSL_KEYTYPE_EC, 'curve_name' => 'prime256v1']);
        self::assertInstanceOf(\OpenSSLAsymmetricKey::class, $private);
        self::assertTrue(openssl_pkey_export($private, $pem));
        $details = openssl_pkey_get_details($private);
        self::assertIsArray($details);
        $this->clientPublicKey = new Key($details['key'], 'ES256');
        $path = tempnam(sys_get_temp_dir(), 'oathforge-DUMMY-apple-key-');
        self::assertIsString($path);
        $this->keyPath = $path;
        chmod($path, 0600);
        file_put_contents($path, $pem);
        $this->signer = new AppleClientSecretSigner($this->clock, AppleTokenFixture::AUDIENCE, 'TESTTEAM01', 'TESTKEY001', $path);
        $keys = new class(self::$identity->key) implements AppleSigningKeySource {
            public function __construct(private Key $key) {}
            public function find(string $kid): Key { return $this->key; }
        };
        $this->verifier = new AppleIdentityVerifier($keys, $this->clock, AppleTokenFixture::AUDIENCE);
    }

    protected function tearDown(): void
    {
        if (is_file($this->keyPath)) { unlink($this->keyPath); }
    }

    public function testMatchingSignedProviderIdentityReturnsRefreshCredential(): void
    {
        $client = new MockHttpClient(new MockResponse(json_encode(['id_token' => self::$identity->token(), 'refresh_token' => 'DUMMY-refresh'], JSON_THROW_ON_ERROR)));
        $exchange = new AppleAuthorizationExchange($this->signer, $this->verifier, $client);
        $native = $this->verifier->verify(self::$identity->token(), hash('sha256', AppleTokenFixture::NONCE));
        self::assertInstanceOf(VerifiedAppleIdentity::class, $native);
        $result = $exchange->exchange('DUMMY-native-code', $native, hash('sha256', AppleTokenFixture::NONCE));
        self::assertInstanceOf(AppleAuthorization::class, $result);
        self::assertSame($native->issuer, $result->identity->issuer);
        self::assertSame($native->subject, $result->identity->subject);
        self::assertSame('DUMMY-refresh', $result->refreshToken);
        self::assertSame(1, $client->getRequestsCount());
    }

    public function testBackendSignsExactClientSecretAndPostsOnlyNativeFieldsToFixedUrl(): void
    {
        $client = new MockHttpClient(function (string $method, string $url, array $options): MockResponse {
            self::assertSame('POST', $method);
            self::assertSame('https://appleid.apple.com/auth/token', $url);
            self::assertSame(2.0, $options['timeout']);
            self::assertSame(5.0, $options['max_duration']);
            self::assertSame(0, $options['max_redirects']);
            self::assertTrue($options['verify_peer']);
            self::assertTrue($options['verify_host']);
            self::assertFalse($options['buffer']);
            parse_str($options['body'], $form);
            self::assertSame(['client_id', 'client_secret', 'code', 'grant_type'], array_keys($form));
            self::assertSame(AppleTokenFixture::AUDIENCE, $form['client_id']);
            self::assertSame('DUMMY-native-code', $form['code']);
            self::assertSame('authorization_code', $form['grant_type']);
            self::assertIsString($form['client_secret']);
            $oldTime = JWT::$timestamp;
            try {
                JWT::$timestamp = $this->clock->time;
                $header = new \stdClass();
                $claims = JWT::decode($form['client_secret'], $this->clientPublicKey, $header);
                self::assertInstanceOf(\stdClass::class, $header);
                self::assertSame('ES256', $header->alg);
                self::assertSame('TESTKEY001', $header->kid);
                self::assertSame(['iss' => 'TESTTEAM01', 'sub' => AppleTokenFixture::AUDIENCE, 'aud' => 'https://appleid.apple.com', 'iat' => $this->clock->time, 'exp' => $this->clock->time + 300], (array) $claims);
            } finally {
                JWT::$timestamp = $oldTime;
            }
            return $this->successResponse();
        });
        self::assertInstanceOf(AppleAuthorization::class, $this->exchange($client));
    }

    /** @return iterable<string, array{int, string, IdentityVerificationFailure}> */
    public static function providerFailures(): iterable
    {
        yield 'invalid grant' => [400, '{"error":"invalid_grant"}', IdentityVerificationFailure::InvalidCredential];
        yield 'invalid client' => [400, '{"error":"invalid_client"}', IdentityVerificationFailure::Unavailable];
        yield 'unknown error' => [400, '{"error":"DUMMY-provider-diagnostic"}', IdentityVerificationFailure::Unavailable];
        yield 'rate limit dominates' => [429, '{"error":"invalid_grant"}', IdentityVerificationFailure::Unavailable];
        yield 'provider failure dominates' => [503, '{"error":"invalid_grant"}', IdentityVerificationFailure::Unavailable];
        yield 'redirect' => [302, '{}', IdentityVerificationFailure::Unavailable];
        yield 'malformed success' => [200, '{', IdentityVerificationFailure::Unavailable];
        yield 'wrong success shape' => [200, '[]', IdentityVerificationFailure::Unavailable];
        yield 'empty success' => [200, '{}', IdentityVerificationFailure::Unavailable];
    }

    #[DataProvider('providerFailures')]
    public function testProviderErrorsStaySafeAndNeverRetry(int $status, string $body, IdentityVerificationFailure $expected): void
    {
        $client = new MockHttpClient(new MockResponse($body, ['http_code' => $status]));
        self::assertSame($expected, $this->exchange($client));
        self::assertSame(1, $client->getRequestsCount());
    }

    public function testReturnedIdentityMustMatchNativeSubjectAndNonce(): void
    {
        foreach ([['sub' => 'different-subject'], ['nonce' => str_repeat('b', 43)], ['iss' => 'https://attacker.invalid'], ['aud' => 'another.app'], ['exp' => 1800000000]] as $changes) {
            $client = new MockHttpClient($this->successResponse(['id_token' => self::$identity->token($changes)]));
            self::assertSame(IdentityVerificationFailure::InvalidCredential, $this->exchange($client));
        }
        $token = self::$identity->token();
        $parts = explode('.', $token);
        $parts[2] = ('A' === $parts[2][0] ? 'B' : 'A').substr($parts[2], 1);
        self::assertSame(IdentityVerificationFailure::InvalidCredential, $this->exchange(new MockHttpClient($this->successResponse(['id_token' => implode('.', $parts)]))));
    }

    public function testMissingOrInvalidRefreshCredentialsAreUnavailable(): void
    {
        foreach (['', ' ', null, []] as $refresh) {
            self::assertSame(IdentityVerificationFailure::Unavailable, $this->exchange(new MockHttpClient($this->successResponse(['refresh_token' => $refresh]))));
        }
        $client = new MockHttpClient(new MockResponse(json_encode(['id_token' => self::$identity->token()], JSON_THROW_ON_ERROR)));
        self::assertSame(IdentityVerificationFailure::Unavailable, $this->exchange($client));
    }

    public function testNetworkTimeoutAndResponseBoundsAreUnavailableWithoutRetry(): void
    {
        $responses = [
            new MockResponse((function (): \Generator { yield ''; })()),
            new MockResponse('', ['error' => 'DUMMY-transport-error']),
            new MockResponse(str_repeat('x', 65537)),
        ];
        foreach ($responses as $response) {
            $client = new MockHttpClient($response);
            self::assertSame(IdentityVerificationFailure::Unavailable, $this->exchange($client));
            self::assertSame(1, $client->getRequestsCount());
        }
        $body = json_encode(['id_token' => self::$identity->token(), 'refresh_token' => 'DUMMY-refresh'], JSON_THROW_ON_ERROR);
        self::assertInstanceOf(AppleAuthorization::class, $this->exchange(new MockHttpClient(new MockResponse(str_pad($body, 65536, ' ')))));
    }

    public function testInvalidCodeIsRejectedBeforeProviderRequest(): void
    {
        foreach (['', ' ', str_repeat('x', 2049)] as $code) {
            $client = new MockHttpClient($this->successResponse());
            self::assertSame(IdentityVerificationFailure::InvalidCredential, $this->exchange($client, $code));
            self::assertSame(0, $client->getRequestsCount());
        }
    }

    public function testMissingOrDummySigningConfigurationFailsClosedBeforeHttp(): void
    {
        foreach ([['', 'TESTTEAM01', 'TESTKEY001', $this->keyPath], [AppleTokenFixture::AUDIENCE, 'DUMMY-team', 'TESTKEY001', $this->keyPath], [AppleTokenFixture::AUDIENCE, 'TESTTEAM01', '', $this->keyPath], [AppleTokenFixture::AUDIENCE, 'TESTTEAM01', 'TESTKEY001', '']] as [$clientId, $teamId, $keyId, $path]) {
            $this->signer = new AppleClientSecretSigner($this->clock, $clientId, $teamId, $keyId, $path);
            $client = new MockHttpClient($this->successResponse());
            self::assertSame(IdentityVerificationFailure::Unavailable, $this->exchange($client));
            self::assertSame(0, $client->getRequestsCount());
        }
    }

    public function testMalformedOrPublicSigningKeyIsUnavailable(): void
    {
        openssl_pkey_export(self::$identity->privateKey, $rsaPem);
        foreach (['public', 'malformed', 'rsa'] as $case) {
            chmod($this->keyPath, 'public' === $case ? 0644 : 0600);
            if ('malformed' === $case) { file_put_contents($this->keyPath, 'DUMMY-malformed-private-key'); }
            if ('rsa' === $case) { file_put_contents($this->keyPath, $rsaPem); }
            self::assertSame(IdentityVerificationFailure::Unavailable, $this->signer->sign(), $case);
        }
    }

    public function testVerificationKeyOutageAfterExchangeIsUnavailable(): void
    {
        $keys = new class implements AppleSigningKeySource {
            public function find(string $kid): IdentityVerificationFailure { return IdentityVerificationFailure::Unavailable; }
        };
        $this->verifier = new AppleIdentityVerifier($keys, $this->clock, AppleTokenFixture::AUDIENCE);
        $client = new MockHttpClient($this->successResponse());
        self::assertSame(IdentityVerificationFailure::Unavailable, $this->exchange($client));
        self::assertSame(1, $client->getRequestsCount());
    }

    public function testSigningKeySizeCurveAndLocalPathBounds(): void
    {
        $pem = file_get_contents($this->keyPath);
        self::assertIsString($pem);
        file_put_contents($this->keyPath, str_pad($pem, 16384, ' '));
        self::assertInstanceOf(AppleClientSecret::class, $this->signer->sign());
        file_put_contents($this->keyPath, str_pad($pem, 16385, ' '));
        self::assertSame(IdentityVerificationFailure::Unavailable, $this->signer->sign());
        $wrongCurve = openssl_pkey_new(['private_key_type' => OPENSSL_KEYTYPE_EC, 'curve_name' => 'secp384r1']);
        self::assertInstanceOf(\OpenSSLAsymmetricKey::class, $wrongCurve);
        self::assertTrue(openssl_pkey_export($wrongCurve, $wrongPem));
        file_put_contents($this->keyPath, $wrongPem);
        self::assertSame(IdentityVerificationFailure::Unavailable, $this->signer->sign());
        foreach (['/DUMMY/missing.p8', 'https://DUMMY.invalid/key', "/DUMMY/invalid\0key", sys_get_temp_dir()] as $path) {
            $signer = new AppleClientSecretSigner($this->clock, AppleTokenFixture::AUDIENCE, 'TESTTEAM01', 'TESTKEY001', $path);
            self::assertSame(IdentityVerificationFailure::Unavailable, $signer->sign());
        }
    }

    /** @param array<string, mixed> $changes */
    private function successResponse(array $changes = []): MockResponse
    {
        return new MockResponse(json_encode(array_replace(['id_token' => self::$identity->token(), 'refresh_token' => 'DUMMY-refresh', 'access_token' => 'DUMMY-discard-access'], $changes), JSON_THROW_ON_ERROR));
    }

    private function exchange(MockHttpClient $client, string $code = 'DUMMY-native-code'): AppleAuthorization|IdentityVerificationFailure
    {
        $native = new VerifiedAppleIdentity('https://appleid.apple.com', 'DUMMY-subject');
        return (new AppleAuthorizationExchange($this->signer, $this->verifier, $client))->exchange($code, $native, hash('sha256', AppleTokenFixture::NONCE));
    }

}
