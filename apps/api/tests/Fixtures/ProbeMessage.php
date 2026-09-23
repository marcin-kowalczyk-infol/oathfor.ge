<?php

declare(strict_types=1);

namespace App\Tests\Fixtures;

final readonly class ProbeMessage
{
    public function __construct(public string $id, public bool $fail = false)
    {
    }
}
