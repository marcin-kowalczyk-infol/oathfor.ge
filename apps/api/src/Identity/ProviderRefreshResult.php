<?php

declare(strict_types=1);

namespace App\Identity;

final readonly class ProviderRefreshResult
{
    public function __construct(#[\SensitiveParameter] public ?string $refreshToken)
    {
    }
}
