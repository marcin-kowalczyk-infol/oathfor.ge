<?php

declare(strict_types=1);
namespace App\Character;

final readonly class SwitchInput
{
    private function __construct(public string $characterId) {}
    /** @param array<string, mixed> $input Decoded JSON object. */
    public static function parse(array $input): self|CharacterFailure
    {
        $id = $input['characterId'] ?? null;
        if (['characterId'] !== array_keys($input) || !is_string($id) || 1 !== preg_match('/\A[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\z/', $id)) { return new CharacterFailure('invalid_request'); }
        return new self($id);
    }
}
