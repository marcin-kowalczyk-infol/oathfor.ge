<?php

declare(strict_types=1);

namespace App\Identity;

final class ProviderTokenKeyring
{
    public function __construct(private string $path, private string $currentKeyId)
    {
    }

    public function currentKeyId(): string
    {
        return $this->currentKeyId;
    }

    public function get(string $keyId): string|ProviderTokenFailure
    {
        // Only local private files; configuration is read lazily and never logged.
        if (!str_starts_with($this->path, '/') || str_contains($this->path, "\0") || !is_file($this->path) || !self::validKeyId($this->currentKeyId)) {
            return ProviderTokenFailure::Unavailable;
        }
        $file = @fopen($this->path, 'rb');
        if (false === $file) {
            return ProviderTokenFailure::Unavailable;
        }
        try {
            $stat = @fstat($file);
            if (false === $stat || ($stat['mode'] & 0170000) !== 0100000 || !in_array($stat['mode'] & 0777, [0400, 0600], true)) {
                return ProviderTokenFailure::Unavailable;
            }
            $raw = @stream_get_contents($file, 16385);
        } finally {
            fclose($file);
        }
        if (false === $raw || strlen($raw) > 16384) {
            return ProviderTokenFailure::Unavailable;
        }
        try {
            $decoded = json_decode($raw, false, 8, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            return ProviderTokenFailure::Unavailable;
        }
        if (!$decoded instanceof \stdClass || array_keys(get_object_vars($decoded)) !== ['keys'] || !($decoded->keys ?? null) instanceof \stdClass) {
            return ProviderTokenFailure::Unavailable;
        }
        $encodedKeys = get_object_vars($decoded->keys);
        if (count($encodedKeys) < 1 || count($encodedKeys) > 32 || !array_key_exists($this->currentKeyId, $encodedKeys)) {
            return ProviderTokenFailure::Unavailable;
        }
        $keys = [];
        foreach ($encodedKeys as $id => $encoded) {
            if (!self::validKeyId((string) $id) || !is_string($encoded)) {
                return ProviderTokenFailure::Unavailable;
            }
            $key = base64_decode($encoded, true);
            if (false === $key || strlen($key) !== SODIUM_CRYPTO_AEAD_XCHACHA20POLY1305_IETF_KEYBYTES || base64_encode($key) !== $encoded) {
                return ProviderTokenFailure::Unavailable;
            }
            $keys[$id] = $key;
        }
        return $keys[$keyId] ?? ProviderTokenFailure::Unavailable;
    }

    public static function validKeyId(string $id): bool
    {
        return 1 === preg_match('/^[A-Za-z0-9._-]{1,64}$/D', $id);
    }
}
