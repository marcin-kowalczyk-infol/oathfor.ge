<?php

declare(strict_types=1);

namespace App\Tests\Fixtures;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;

/** DUMMY synthetic keys generated in memory; never Apple credentials. */
final class AppleTokenFixture
{
    public const AUDIENCE = 'test.oathforge.synthetic';
    public const NONCE = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    public readonly \OpenSSLAsymmetricKey $privateKey;
    public readonly Key $key;
    /** @var array{kid: string, kty: string, use: string, alg: string, n: string, e: string} */
    public readonly array $jwk;

    public function __construct(public readonly string $kid = 'DUMMY-key', int $bits = 2048)
    {
        $private = openssl_pkey_new(['private_key_bits' => $bits, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
        if (false === $private) {
            throw new \RuntimeException('Synthetic key generation failed.');
        }
        $this->privateKey = $private;
        $details = openssl_pkey_get_details($private);
        if (false === $details) {
            throw new \RuntimeException('Synthetic key details failed.');
        }
        $this->key = new Key($details['key'], 'RS256');
        $this->jwk = ['kid' => $kid, 'kty' => 'RSA', 'use' => 'sig', 'alg' => 'RS256', 'n' => JWT::urlsafeB64Encode($details['rsa']['n']), 'e' => JWT::urlsafeB64Encode($details['rsa']['e'])];
    }

    /** @param array<string, mixed> $changes */
    public function token(array $changes = [], int $now = 1800000000): string
    {
        return JWT::encode(array_replace($this->claims($now), $changes), $this->privateKey, 'RS256', $this->kid);
    }

    /** @return array<string, mixed> */
    public function claims(int $now = 1800000000): array
    {
        return ['iss' => 'https://appleid.apple.com', 'aud' => self::AUDIENCE, 'sub' => 'DUMMY-subject', 'nonce' => self::NONCE, 'iat' => $now, 'exp' => $now + 300];
    }
}
