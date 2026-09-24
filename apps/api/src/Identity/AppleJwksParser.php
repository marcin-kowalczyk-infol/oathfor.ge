<?php

declare(strict_types=1);

namespace App\Identity;

use Firebase\JWT\JWK;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;

final class AppleJwksParser
{
    /** @param array<string, mixed> $snapshot
     *  @return array<string, Key>
     */
    public function parse(array $snapshot): array
    {
        if (!isset($snapshot['keys']) || !is_array($snapshot['keys']) || !array_is_list($snapshot['keys']) || count($snapshot['keys']) < 1 || count($snapshot['keys']) > 10) {
            throw new AppleKeysUnavailable();
        }
        $keys = [];
        foreach ($snapshot['keys'] as $jwk) {
            if (!is_array($jwk) || !is_string($jwk['kid'] ?? null) || '' === trim($jwk['kid']) || strlen($jwk['kid']) > 128
                || isset($keys[$jwk['kid']]) || ($jwk['kty'] ?? null) !== 'RSA' || ($jwk['use'] ?? null) !== 'sig' || ($jwk['alg'] ?? null) !== 'RS256'
                || !is_string($jwk['n'] ?? null) || !is_string($jwk['e'] ?? null)
                || 1 !== preg_match('/^[A-Za-z0-9_-]+$/D', $jwk['n']) || 1 !== preg_match('/^[A-Za-z0-9_-]+$/D', $jwk['e'])
                || isset($jwk['d'])) {
                throw new AppleKeysUnavailable();
            }
            $modulus = base64_decode(strtr($jwk['n'], '-_', '+/'), true);
            $exponent = base64_decode(strtr($jwk['e'], '-_', '+/'), true);
            if (false === $modulus || false === $exponent || '' === $modulus || '' === $exponent
                || JWT::urlsafeB64Encode($modulus) !== $jwk['n'] || JWT::urlsafeB64Encode($exponent) !== $jwk['e']) {
                throw new AppleKeysUnavailable();
            }
            $exponent = ltrim($exponent, "\0");
            $modulus = ltrim($modulus, "\0");
            if ('' === $modulus || '' === $exponent || 0 === (ord($modulus[-1]) & 1) || 0 === (ord($exponent[-1]) & 1)
                || (1 === strlen($exponent) && ord($exponent) < 3)
                || strlen($exponent) > strlen($modulus)
                || (strlen($exponent) === strlen($modulus) && strcmp($exponent, $modulus) >= 0)) {
                throw new AppleKeysUnavailable();
            }
            try {
                $key = JWK::parseKey($jwk);
                if (null === $key) {
                    throw new AppleKeysUnavailable();
                }
                $material = $key->getKeyMaterial();
                $public = $material instanceof \OpenSSLAsymmetricKey ? $material : @openssl_pkey_get_public($material);
                $details = false === $public ? false : openssl_pkey_get_details($public);
                if (false === $details || $details['type'] !== OPENSSL_KEYTYPE_RSA || $details['bits'] < 2048) {
                    throw new AppleKeysUnavailable();
                }
                $keys[$jwk['kid']] = $key;
            } catch (\UnexpectedValueException | \InvalidArgumentException | \DomainException) {
                throw new AppleKeysUnavailable();
            }
        }
        return $keys;
    }
}
