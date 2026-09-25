<?php

declare(strict_types=1);

namespace App\Oath;

final readonly class TimeFailure
{
    /** @param list<string> $validOffsets */
    public function __construct(public string $code, public array $validOffsets = []) {}
}
