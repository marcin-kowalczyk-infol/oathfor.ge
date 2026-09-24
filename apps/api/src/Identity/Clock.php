<?php

declare(strict_types=1);

namespace App\Identity;

interface Clock
{
    public function now(): int;
}
