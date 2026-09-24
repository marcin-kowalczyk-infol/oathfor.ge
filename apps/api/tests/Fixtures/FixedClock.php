<?php

declare(strict_types=1);

namespace App\Tests\Fixtures;

use App\Identity\Clock;

final class FixedClock implements Clock
{
    public function __construct(public int $time = 1800000000)
    {
    }

    public function now(): int
    {
        return $this->time;
    }
}
