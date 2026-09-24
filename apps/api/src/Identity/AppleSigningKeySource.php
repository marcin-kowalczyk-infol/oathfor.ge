<?php

declare(strict_types=1);

namespace App\Identity;

use Firebase\JWT\Key;

interface AppleSigningKeySource
{
    public function find(string $kid): Key|IdentityVerificationFailure;
}
