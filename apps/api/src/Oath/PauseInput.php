<?php

declare(strict_types=1);
namespace App\Oath;

final readonly class PauseInput
{
    private function __construct(public bool $paused, public ?string $revision) {}
    /** @param array<string, mixed> $input */
    public static function parse(array $input): self|OathFailure
    {
        if (!is_bool($input['paused'] ?? null) || array_diff(array_keys($input), $input['paused'] ? ['paused', 'revision'] : ['paused']) !== []) { return new OathFailure('invalid_request'); }
        if ($input['paused'] && (!is_string($input['revision'] ?? null) || 1 !== preg_match('/\A[0-9a-f]{64}\z/', $input['revision']))) { return new OathFailure('invalid_request'); }
        return new self($input['paused'], $input['revision'] ?? null);
    }
}
