<?php

declare(strict_types=1);

namespace App\Proof;

/** Re-encoded JPEG bytes without metadata, with the decoded pixel size. */
final readonly class NormalizedProofImage
{
    public function __construct(public string $bytes, public int $width, public int $height)
    {
    }
}
