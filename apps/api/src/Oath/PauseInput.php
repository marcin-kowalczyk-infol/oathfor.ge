<?php

declare(strict_types=1);
namespace App\Oath;

final readonly class PauseInput
{
    private function __construct(public string $characterId, public bool $paused, public ?string $revision) {}
    /** @param array<string, mixed> $input */
    public static function parse(array $input): self|OathFailure
    {
        if (!is_bool($input['paused'] ?? null)) { return new OathFailure('invalid_request'); }
        $keys = array_keys($input); sort($keys);
        if ($keys !== ($input['paused'] ? ['characterId', 'paused', 'revision'] : ['characterId', 'paused'])) { return new OathFailure('invalid_request'); }
        if (!is_string($input['characterId']) || 1 !== preg_match('/\A[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\z/', $input['characterId'])) { return new OathFailure('invalid_request'); }
        if ($input['paused'] && (!is_string($input['revision']) || 1 !== preg_match('/\A[0-9a-f]{64}\z/', $input['revision']))) { return new OathFailure('invalid_request'); }
        return new self($input['characterId'], $input['paused'], $input['revision'] ?? null);
    }
}
