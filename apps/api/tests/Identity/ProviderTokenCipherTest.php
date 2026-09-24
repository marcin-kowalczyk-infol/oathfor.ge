<?php

declare(strict_types=1);

namespace App\Tests\Identity;

use App\Identity\EncryptedProviderToken;
use App\Identity\ProviderTokenCipher;
use App\Identity\ProviderTokenKeyring;
use App\Identity\ProviderTokenFailure;
use App\Identity\RandomSource;
use App\Identity\SecureRandomSource;
use PHPUnit\Framework\TestCase;

final class ProviderTokenCipherTest extends TestCase
{
    private const IDENTITY = 'b5d9e21f-9932-4f5c-8497-bc7f5ec6cf1c';
    private const TOKEN = 'DUMMY-synthetic-refresh-token';
    private string $path;
    private ProviderTokenCipher $cipher;
    /** @var array<string, string> */
    private array $keys;

    protected function setUp(): void
    {
        $path = tempnam(sys_get_temp_dir(), 'oathforge-DUMMY-keyring-');
        self::assertIsString($path);
        $this->path = $path;
        chmod($path, 0600);
        $this->keys = ['v1' => base64_encode(random_bytes(32)), 'v2' => base64_encode(random_bytes(32))];
        $this->keys['alias-v1'] = $this->keys['v1'];
        $this->writeKeys();
        $this->cipher = new ProviderTokenCipher(new ProviderTokenKeyring($path, 'v1'), new SecureRandomSource());
    }

    protected function tearDown(): void
    {
        if (is_file($this->path)) { unlink($this->path); }
    }

    public function testSyntheticRefreshTokenRoundTripsBoundToIdentity(): void
    {
        $envelope = $this->cipher->encrypt(self::TOKEN, self::IDENTITY);
        self::assertInstanceOf(EncryptedProviderToken::class, $envelope);
        self::assertSame(self::TOKEN, $this->cipher->decrypt($envelope, self::IDENTITY));
        self::assertStringNotContainsString(self::TOKEN, json_encode($envelope, JSON_THROW_ON_ERROR));
        self::assertSame(1, $envelope->version);
        self::assertSame('v1', $envelope->keyId);
        self::assertSame(24, strlen(sodium_base642bin($envelope->nonce, SODIUM_BASE64_VARIANT_URLSAFE_NO_PADDING)));
        $second = $this->cipher->encrypt(self::TOKEN, self::IDENTITY);
        self::assertInstanceOf(EncryptedProviderToken::class, $second);
        self::assertNotSame($envelope->nonce, $second->nonce);
        self::assertNotSame($envelope->ciphertext, $second->ciphertext);
    }

    public function testTamperingEveryEnvelopeFieldOrIdentityFailsWithoutPlaintext(): void
    {
        $envelope = $this->cipher->encrypt(self::TOKEN, self::IDENTITY);
        self::assertInstanceOf(EncryptedProviderToken::class, $envelope);
        $ciphertext = ('A' === $envelope->ciphertext[0] ? 'B' : 'A').substr($envelope->ciphertext, 1);
        $nonce = ('A' === $envelope->nonce[0] ? 'B' : 'A').substr($envelope->nonce, 1);
        foreach ([
            new EncryptedProviderToken(2, $envelope->keyId, $envelope->nonce, $envelope->ciphertext),
            new EncryptedProviderToken(1, 'alias-v1', $envelope->nonce, $envelope->ciphertext),
            new EncryptedProviderToken(1, 'v2', $envelope->nonce, $envelope->ciphertext),
            new EncryptedProviderToken(1, $envelope->keyId, $nonce, $envelope->ciphertext),
            new EncryptedProviderToken(1, $envelope->keyId, $envelope->nonce, $ciphertext),
            new EncryptedProviderToken(1, $envelope->keyId, 'invalid', $envelope->ciphertext),
            new EncryptedProviderToken(1, $envelope->keyId, $envelope->nonce, '?'),
        ] as $tampered) {
            self::assertSame(ProviderTokenFailure::Invalid, $this->cipher->decrypt($tampered, self::IDENTITY));
        }
        self::assertSame(ProviderTokenFailure::Invalid, $this->cipher->decrypt($envelope, 'd651189f-050c-487a-b7ae-e38dd6519ce7'));
    }

    public function testRotationReadsOldVersionWritesCurrentAndFailsAfterRemoval(): void
    {
        $old = $this->cipher->encrypt(self::TOKEN, self::IDENTITY);
        self::assertInstanceOf(EncryptedProviderToken::class, $old);
        $rotated = new ProviderTokenCipher(new ProviderTokenKeyring($this->path, 'v2'), new SecureRandomSource());
        self::assertSame(self::TOKEN, $rotated->decrypt($old, self::IDENTITY));
        $current = $rotated->encrypt(self::TOKEN, self::IDENTITY);
        self::assertInstanceOf(EncryptedProviderToken::class, $current);
        self::assertSame('v2', $current->keyId);
        unset($this->keys['v1']);
        $this->writeKeys();
        self::assertSame(ProviderTokenFailure::Unavailable, $rotated->decrypt($old, self::IDENTITY));
        self::assertSame(self::TOKEN, $rotated->decrypt($current, self::IDENTITY));
    }

    public function testMissingCurrentKeyAlsoPreventsReadingOldCredentials(): void
    {
        $envelope = $this->cipher->encrypt(self::TOKEN, self::IDENTITY);
        self::assertInstanceOf(EncryptedProviderToken::class, $envelope);
        foreach (['', 'missing'] as $currentId) {
            $cipher = new ProviderTokenCipher(new ProviderTokenKeyring($this->path, $currentId), new SecureRandomSource());
            self::assertSame(ProviderTokenFailure::Unavailable, $cipher->decrypt($envelope, self::IDENTITY));
            self::assertSame(ProviderTokenFailure::Unavailable, $cipher->encrypt(self::TOKEN, self::IDENTITY));
        }
    }

    public function testMissingMalformedOrPublicKeyringFailsClosedLazily(): void
    {
        foreach (['', '/DUMMY/nonexistent/keyring.json', 'https://DUMMY.invalid/keys', "/DUMMY/invalid\0path", sys_get_temp_dir()] as $path) {
            $cipher = new ProviderTokenCipher(new ProviderTokenKeyring($path, 'v1'), new SecureRandomSource());
            self::assertSame(ProviderTokenFailure::Unavailable, $cipher->encrypt(self::TOKEN, self::IDENTITY));
        }
        foreach (['{', 'null', '{"keys":[]}', '{"keys":{"v1":"DUMMY-invalid-key"}}', json_encode(['keys' => ['v1' => base64_encode(random_bytes(31))]], JSON_THROW_ON_ERROR)] as $invalid) {
            file_put_contents($this->path, $invalid);
            self::assertSame(ProviderTokenFailure::Unavailable, $this->cipher->encrypt(self::TOKEN, self::IDENTITY));
        }
        $this->writeKeys();
        chmod($this->path, 0644);
        self::assertSame(ProviderTokenFailure::Unavailable, $this->cipher->encrypt(self::TOKEN, self::IDENTITY));
        chmod($this->path, 0400);
        self::assertInstanceOf(EncryptedProviderToken::class, $this->cipher->encrypt(self::TOKEN, self::IDENTITY));
    }

    public function testInvalidInputAndRandomSourceFailureReturnSafeResults(): void
    {
        self::assertSame(ProviderTokenFailure::Invalid, $this->cipher->encrypt('', self::IDENTITY));
        self::assertSame(ProviderTokenFailure::Invalid, $this->cipher->encrypt(self::TOKEN, 'not-a-uuid'));
        $random = new class implements RandomSource {
            public function bytes(int $length): string { throw new \Random\RandomException('DUMMY-must-not-escape'); }
        };
        $cipher = new ProviderTokenCipher(new ProviderTokenKeyring($this->path, 'v1'), $random);
        self::assertSame(ProviderTokenFailure::Unavailable, $cipher->encrypt(self::TOKEN, self::IDENTITY));
    }

    public function testKeyringBoundsAndUnusedKeyVersionsFailClosed(): void
    {
        $json = json_encode(['keys' => $this->keys], JSON_THROW_ON_ERROR);
        file_put_contents($this->path, str_pad($json, 16384, ' '));
        self::assertInstanceOf(EncryptedProviderToken::class, $this->cipher->encrypt(self::TOKEN, self::IDENTITY));
        file_put_contents($this->path, str_pad($json, 16385, ' '));
        self::assertSame(ProviderTokenFailure::Unavailable, $this->cipher->encrypt(self::TOKEN, self::IDENTITY));
        $this->keys['unused'] = 'DUMMY-malformed';
        $this->writeKeys();
        self::assertSame(ProviderTokenFailure::Unavailable, $this->cipher->encrypt(self::TOKEN, self::IDENTITY));
        $key = $this->keys['v1'];
        $this->keys = [];
        for ($version = 1; $version <= 32; ++$version) {
            $this->keys['v'.$version] = $key;
        }
        $this->writeKeys();
        self::assertInstanceOf(EncryptedProviderToken::class, $this->cipher->encrypt(self::TOKEN, self::IDENTITY));
        $this->keys['v33'] = $key;
        $this->writeKeys();
        self::assertSame(ProviderTokenFailure::Unavailable, $this->cipher->encrypt(self::TOKEN, self::IDENTITY));
    }

    private function writeKeys(): void
    {
        file_put_contents($this->path, json_encode(['keys' => $this->keys], JSON_THROW_ON_ERROR));
    }

}
