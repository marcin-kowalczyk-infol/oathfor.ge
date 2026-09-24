<?php

declare(strict_types=1);

namespace App\Identity;

final readonly class VerifiedAppleIdentity
{
    public function __construct(public string $issuer, public string $subject)
    {
    }
}
