<?php

declare(strict_types=1);
namespace App\Proof;

final readonly class SubmissionResult
{
    /** @param array<string, mixed> $body */
    public function __construct(public array $body) {}
}
