<?php

declare(strict_types=1);

namespace App\Identity;

final class ProviderTokenCipher
{
    public function __construct(private ProviderTokenKeyring $keyring, private RandomSource $random)
    {
    }

    public function encrypt(#[\SensitiveParameter] string $token, string $identityId): EncryptedProviderToken|ProviderTokenFailure
    {
        if ('' === trim($token) || !$this->validIdentity($identityId)) {
            return ProviderTokenFailure::Invalid;
        }
        $keyId = $this->keyring->currentKeyId();
        $key = $this->keyring->get($keyId);
        if ($key instanceof ProviderTokenFailure) {
            return $key;
        }
        try {
            $nonce = $this->random->bytes(SODIUM_CRYPTO_AEAD_XCHACHA20POLY1305_IETF_NPUBBYTES);
            $ciphertext = sodium_crypto_aead_xchacha20poly1305_ietf_encrypt($token, $this->associatedData(1, $keyId, $identityId), $nonce, $key);
            return new EncryptedProviderToken(1, $keyId, sodium_bin2base64($nonce, SODIUM_BASE64_VARIANT_URLSAFE_NO_PADDING), sodium_bin2base64($ciphertext, SODIUM_BASE64_VARIANT_URLSAFE_NO_PADDING));
        } catch (\SodiumException | \Random\RandomException) {
            return ProviderTokenFailure::Unavailable;
        }
    }

    public function decrypt(EncryptedProviderToken $envelope, string $identityId): string|ProviderTokenFailure
    {
        if (1 !== $envelope->version || !ProviderTokenKeyring::validKeyId($envelope->keyId) || !$this->validIdentity($identityId)) {
            return ProviderTokenFailure::Invalid;
        }
        $key = $this->keyring->get($envelope->keyId);
        if ($key instanceof ProviderTokenFailure) {
            return $key;
        }
        try {
            $nonce = sodium_base642bin($envelope->nonce, SODIUM_BASE64_VARIANT_URLSAFE_NO_PADDING);
            $ciphertext = sodium_base642bin($envelope->ciphertext, SODIUM_BASE64_VARIANT_URLSAFE_NO_PADDING);
            $token = sodium_crypto_aead_xchacha20poly1305_ietf_decrypt($ciphertext, $this->associatedData($envelope->version, $envelope->keyId, $identityId), $nonce, $key);
            return false === $token ? ProviderTokenFailure::Invalid : $token;
        } catch (\SodiumException) {
            return ProviderTokenFailure::Invalid;
        }
    }

    private function validIdentity(string $identityId): bool
    {
        return 1 === preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/D', $identityId);
    }

    private function associatedData(int $version, string $keyId, string $identityId): string
    {
        return json_encode([$version, $keyId, $identityId], JSON_THROW_ON_ERROR);
    }
}
