<?php

declare(strict_types=1);

namespace App\Identity;

interface ProviderMaintenanceClient
{
    public function refresh(#[\SensitiveParameter] string $refreshToken, VerifiedAppleIdentity $storedIdentity): ProviderRefreshResult|ProviderMaintenanceFailure;
    public function revoke(#[\SensitiveParameter] string $refreshToken): bool;
}
