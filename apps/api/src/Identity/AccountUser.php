<?php

declare(strict_types=1);

namespace App\Identity;

use Symfony\Component\Security\Core\User\UserInterface;

final class AccountUser implements UserInterface
{
    /** @param non-empty-string $id */
    public function __construct(public readonly string $id, public readonly string $onboardingStatus)
    {
    }

    /** @return non-empty-string */
    public function getUserIdentifier(): string { return $this->id; }
    /** @return list<string> */
    public function getRoles(): array { return ['ROLE_USER']; }
    public function eraseCredentials(): void {}
    /** @return array{id: string, onboardingStatus: string} */
    public function toArray(): array { return ['id' => $this->id, 'onboardingStatus' => $this->onboardingStatus]; }
}
