<?php

declare(strict_types=1);

namespace App\Identity;

final readonly class IssuedAppSession
{
    public function __construct(public AccountUser $account, #[\SensitiveParameter] public string $token, public int $expiresAt)
    {
    }

    /** @return array{account: array{id: string, onboardingStatus: string}, session: array{token: string, expiresAt: string}} */
    public function toResponse(): array
    {
        return ['account' => $this->account->toArray(), 'session' => ['token' => $this->token, 'expiresAt' => gmdate('Y-m-d\TH:i:s\Z', $this->expiresAt)]];
    }
}
