<?php

declare(strict_types=1);

namespace App\Tests\Fixtures;

use App\Identity\{AccountSessionIssuer, AppleAuthorizationExchange, AppleClientSecretSigner, AppleIdentityVerifier, AppleLoginService, AppleSigningKeySource, Clock, LoginChallengeRepository, ProviderTokenCipher, ProviderTokenKeyring, SecureRandomSource};
use Doctrine\DBAL\Connection;
use Firebase\JWT\Key;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

/** Synthetic signing/encryption credentials only, never provider traffic. */
final class AppleLoginFixture
{
    public AppleLoginService $service;
    public Clock $clock;
    public AppleTokenFixture $tokenFixture;
    public MockHttpClient $httpClient;
    public string $signingPath;
    public string $keyringPath;

    public function __construct(private Connection $connection, ?Clock $clock = null, ?callable $response = null)
    {
        $this->clock = $clock ?? new FixedClock();
        $this->tokenFixture = new AppleTokenFixture();
        $private = openssl_pkey_new(['private_key_type' => OPENSSL_KEYTYPE_EC, 'curve_name' => 'prime256v1']);
        assert($private instanceof \OpenSSLAsymmetricKey);
        openssl_pkey_export($private, $pem);
        $this->signingPath = $this->privateFile($pem);
        $this->keyringPath = $this->privateFile(json_encode(['keys' => ['v1' => base64_encode(random_bytes(32))]], JSON_THROW_ON_ERROR));
        $keys = new class($this->tokenFixture->key) implements AppleSigningKeySource {
            public function __construct(private Key $key) {}
            public function find(string $kid): Key { return $this->key; }
        };
        $verifier = new AppleIdentityVerifier($keys, $this->clock, AppleTokenFixture::AUDIENCE);
        $this->httpClient = new MockHttpClient($response ?? fn () => new MockResponse(json_encode(['id_token' => $this->tokenFixture->token(now: $this->clock->now()), 'refresh_token' => 'DUMMY-refresh'], JSON_THROW_ON_ERROR)));
        $signer = new AppleClientSecretSigner($this->clock, AppleTokenFixture::AUDIENCE, 'TESTTEAM01', 'TESTKEY001', $this->signingPath);
        $random = new SecureRandomSource();
        $cipher = new ProviderTokenCipher(new ProviderTokenKeyring($this->keyringPath, 'v1'), $random);
        $this->service = new AppleLoginService($connection, new LoginChallengeRepository($connection, $this->clock), $verifier, new AppleAuthorizationExchange($signer, $verifier, $this->httpClient), new AccountSessionIssuer($connection, $this->clock, $random, $cipher));
    }

    public function seedChallenge(string $id = AppleTokenFixture::NONCE): void
    {
        (new LoginChallengeRepository($this->connection, $this->clock))->insert($id, hash('sha256', AppleTokenFixture::NONCE), $this->clock->now());
    }

    public function cleanup(): void
    {
        foreach ([$this->signingPath, $this->keyringPath] as $path) { if (is_file($path)) { unlink($path); } }
    }

    private function privateFile(string $content): string
    {
        $path = tempnam(sys_get_temp_dir(), 'oathforge-DUMMY-login-');
        assert(is_string($path));
        chmod($path, 0600);
        file_put_contents($path, $content);
        return $path;
    }
}
