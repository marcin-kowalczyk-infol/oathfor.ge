<?php

declare(strict_types=1);

namespace App\Proof;

/** A refused proof image. `failureCode` is the stable API reason code. */
final class ProofImageFailure extends \RuntimeException
{
    private function __construct(public readonly string $failureCode)
    {
        parent::__construct($failureCode);
    }

    public static function unsupportedType(): self
    {
        return new self('unsupported_type');
    }

    public static function tooLarge(): self
    {
        return new self('too_large');
    }

    public static function tooManyPixels(): self
    {
        return new self('too_many_pixels');
    }

    public static function unreadableImage(): self
    {
        return new self('unreadable_image');
    }
}
