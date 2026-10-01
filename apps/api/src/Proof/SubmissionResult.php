<?php

declare(strict_types=1);
namespace App\Proof;

/** A finalized proof receipt. $created is false for an identical retry that returns the original receipt. */
final readonly class SubmissionResult
{
    /** @param array<string, mixed> $body */
    public function __construct(public array $body, public bool $created) {}
}
