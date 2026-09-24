<?php

declare(strict_types=1);

namespace App\Identity;

final class LoginChallengeService
{
    public function __construct(private LoginChallengeRepository $repository, private Clock $clock, private RandomSource $random)
    {
    }

    /** @return array{challengeId: string, nonce: string, state: string, expiresAt: string} */
    public function issue(): array
    {
        $now = $this->clock->now();
        $this->repository->cleanup($now);
        for ($attempt = 0; $attempt < 3; ++$attempt) {
            $id = $this->value();
            $nonce = $this->value();
            $state = $this->value();
            if ($this->repository->insert($id, hash('sha256', $nonce), $now)) {
                return ['challengeId' => $id, 'nonce' => $nonce, 'state' => $state, 'expiresAt' => gmdate('Y-m-d\TH:i:s\Z', $now + 300)];
            }
        }
        throw new ChallengeUnavailable('Challenge issuance unavailable.');
    }

    private function value(): string
    {
        return rtrim(strtr(base64_encode($this->random->bytes(32)), '+/', '-_'), '=');
    }
}
