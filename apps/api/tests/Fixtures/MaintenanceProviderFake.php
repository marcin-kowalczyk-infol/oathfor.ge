<?php

declare(strict_types=1);

namespace App\Tests\Fixtures;

use App\Identity\{ProviderMaintenanceClient, ProviderMaintenanceFailure, ProviderRefreshResult, VerifiedAppleIdentity};

final class MaintenanceProviderFake implements ProviderMaintenanceClient
{
    public int $refreshCalls = 0;
    public int $revokeCalls = 0;
    public ?\Closure $onRefresh = null;
    public ?\Closure $onRevoke = null;
    public ProviderRefreshResult|ProviderMaintenanceFailure $refreshResult;
    public bool $revokeResult = false;
    public function __construct() { $this->refreshResult = new ProviderRefreshResult(null); }
    public function refresh(string $refreshToken, VerifiedAppleIdentity $storedIdentity): ProviderRefreshResult|ProviderMaintenanceFailure
    {
        ++$this->refreshCalls;
        if (null !== $this->onRefresh) { ($this->onRefresh)(); }
        return $this->refreshResult;
    }
    public function revoke(string $refreshToken): bool
    {
        ++$this->revokeCalls;
        if (null !== $this->onRevoke) { ($this->onRevoke)(); }
        return $this->revokeResult;
    }
}
