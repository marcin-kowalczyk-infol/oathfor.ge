<?php

declare(strict_types=1);

namespace App\Identity;

final class SecureRandomSource implements RandomSource
{
    /** @param positive-int $length */
    public function bytes(int $length): string
    {
        return random_bytes($length);
    }
}
