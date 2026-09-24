<?php

declare(strict_types=1);

namespace App\Identity;

use Firebase\JWT\JWT;

final class AppleClientSecretSigner
{
    public function __construct(private Clock $clock, private string $clientId, private string $teamId, private string $keyId, private string $privateKeyPath)
    {
    }

    /** @phpstan-impure */
    public function sign(): AppleClientSecret|IdentityVerificationFailure
    {
        if (!$this->configured($this->clientId, 255) || !$this->configured($this->teamId, 128) || !$this->configured($this->keyId, 128)
            || !str_starts_with($this->privateKeyPath, '/') || str_contains($this->privateKeyPath, "\0") || !is_file($this->privateKeyPath)) {
            return IdentityVerificationFailure::Unavailable;
        }
        $file = @fopen($this->privateKeyPath, 'rb');
        if (false === $file) {
            return IdentityVerificationFailure::Unavailable;
        }
        try {
            $stat = @fstat($file);
            if (false === $stat || ($stat['mode'] & 0170000) !== 0100000 || !in_array($stat['mode'] & 0777, [0400, 0600], true)) {
                return IdentityVerificationFailure::Unavailable;
            }
            $pem = @stream_get_contents($file, 16385);
        } finally {
            fclose($file);
        }
        if (false === $pem || strlen($pem) > 16384) {
            return IdentityVerificationFailure::Unavailable;
        }
        $private = @openssl_pkey_get_private($pem);
        $details = false === $private ? false : openssl_pkey_get_details($private);
        if (false === $details || $details['type'] !== OPENSSL_KEYTYPE_EC || ($details['ec']['curve_name'] ?? null) !== 'prime256v1') {
            return IdentityVerificationFailure::Unavailable;
        }
        try {
            $now = $this->clock->now();
            $token = JWT::encode(['iss' => $this->teamId, 'sub' => $this->clientId, 'aud' => 'https://appleid.apple.com', 'iat' => $now, 'exp' => $now + 300], $private, 'ES256', $this->keyId);
            return new AppleClientSecret($this->clientId, $token);
        } catch (\DomainException | \InvalidArgumentException) {
            return IdentityVerificationFailure::Unavailable;
        }
    }

    private function configured(string $value, int $maxLength): bool
    {
        return '' !== trim($value) && trim($value) === $value && strlen($value) <= $maxLength
            && !str_contains(strtoupper($value), 'DUMMY') && !str_contains($value, '*');
    }
}
