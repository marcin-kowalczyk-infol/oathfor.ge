<?php

declare(strict_types=1);

namespace App\Identity;

final readonly class EncryptedProviderToken implements \JsonSerializable
{
    public function __construct(public int $version, public string $keyId, public string $nonce, public string $ciphertext)
    {
    }

    /** @return array{version: int, keyId: string, nonce: string, ciphertext: string} */
    public function jsonSerialize(): array
    {
        return ['version' => $this->version, 'keyId' => $this->keyId, 'nonce' => $this->nonce, 'ciphertext' => $this->ciphertext];
    }
}
