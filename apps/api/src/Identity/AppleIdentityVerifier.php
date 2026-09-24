<?php

declare(strict_types=1);

namespace App\Identity;

use Firebase\JWT\JWT;

final class AppleIdentityVerifier
{
    public function __construct(private AppleSigningKeySource $keys, private Clock $clock, private string $clientId)
    {
    }

    public function verify(#[\SensitiveParameter] string $token, string $expectedNonceDigest): VerifiedAppleIdentity|IdentityVerificationFailure
    {
        $claims = $this->verifiedClaims($token);
        if ($claims instanceof IdentityVerificationFailure) {
            return $claims;
        }
        if (!is_string($claims->nonce ?? null) || 1 !== preg_match('/^[A-Za-z0-9_-]{43}$/D', $claims->nonce)
            || !hash_equals($expectedNonceDigest, hash('sha256', $claims->nonce))) {
            return IdentityVerificationFailure::InvalidCredential;
        }
        return new VerifiedAppleIdentity($claims->iss, $claims->sub);
    }

    /** Refresh verifies the stored identity; it is not a login/challenge credential. */
    public function verifyRefresh(#[\SensitiveParameter] string $token, VerifiedAppleIdentity $storedIdentity): VerifiedAppleIdentity|IdentityVerificationFailure
    {
        $claims = $this->verifiedClaims($token);
        if ($claims instanceof IdentityVerificationFailure) {
            return $claims;
        }
        if ($claims->iss !== $storedIdentity->issuer || $claims->sub !== $storedIdentity->subject) {
            return IdentityVerificationFailure::InvalidCredential;
        }
        return new VerifiedAppleIdentity($claims->iss, $claims->sub);
    }

    private function verifiedClaims(#[\SensitiveParameter] string $token): \stdClass|IdentityVerificationFailure
    {
        if ('' === trim($this->clientId) || str_contains(strtoupper($this->clientId), 'DUMMY') || str_contains($this->clientId, '*')) {
            return IdentityVerificationFailure::Unavailable;
        }
        if (strlen($token) > 12288 || 1 !== preg_match('/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/D', $token)) {
            return IdentityVerificationFailure::InvalidCredential;
        }
        try {
            $header = json_decode(JWT::urlsafeB64Decode(explode('.', $token)[0]), false, 8, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            return IdentityVerificationFailure::InvalidCredential;
        }
        if (!$header instanceof \stdClass || ($header->alg ?? null) !== 'RS256'
            || !is_string($header->kid ?? null) || '' === trim($header->kid) || strlen($header->kid) > 128
            || property_exists($header, 'crit')) {
            return IdentityVerificationFailure::InvalidCredential;
        }
        $key = $this->keys->find($header->kid);
        if ($key instanceof IdentityVerificationFailure) {
            return $key;
        }
        $previousTime = JWT::$timestamp;
        $previousLeeway = JWT::$leeway;
        try {
            $now = $this->clock->now();
            JWT::$timestamp = $now;
            JWT::$leeway = 0;
            $claims = JWT::decode($token, $key);
            if (($claims->iss ?? null) !== 'https://appleid.apple.com' || ($claims->aud ?? null) !== $this->clientId
                || !is_string($claims->sub ?? null) || '' === trim($claims->sub) || strlen($claims->sub) > 255
                || !is_int($claims->iat ?? null) || !is_int($claims->exp ?? null)
                || $claims->iat < 0 || $claims->iat > $now || $now >= $claims->exp || $claims->iat >= $claims->exp
                || (property_exists($claims, 'nbf') && (!is_int($claims->nbf) || $claims->nbf < 0 || $claims->nbf > $now))) {
                return IdentityVerificationFailure::InvalidCredential;
            }
            return $claims;
        } catch (\UnexpectedValueException | \InvalidArgumentException | \DomainException) {
            return IdentityVerificationFailure::InvalidCredential;
        } finally {
            JWT::$timestamp = $previousTime;
            JWT::$leeway = $previousLeeway;
        }
    }
}
