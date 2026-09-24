<?php

declare(strict_types=1);

namespace App\Identity;

final readonly class AppleClientSecret
{
    public function __construct(public string $clientId, #[\SensitiveParameter] public string $token)
    {
    }
}
