<?php

declare(strict_types=1);
namespace App\Oath;

final readonly class AcceptanceResult
{
    /** @param array<string, mixed> $body */
    public function __construct(public array $body, public bool $created) {}
}
