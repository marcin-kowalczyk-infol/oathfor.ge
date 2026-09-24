<?php

declare(strict_types=1);

namespace App\Identity;

interface RandomSource
{
    /** @param positive-int $length */
    public function bytes(int $length): string;
}
