<?php

declare(strict_types=1);

namespace App\Identity;

final readonly class AppleAuthorization
{
    public function __construct(public VerifiedAppleIdentity $identity, #[\SensitiveParameter] public string $refreshToken)
    {
    }
}
