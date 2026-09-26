<?php

declare(strict_types=1);
namespace App\Character;

final readonly class CharacterInput
{
    public const FORMS = ['masculine', 'feminine', 'neutral'];
    private function __construct(public string $requestId, public string $name, public string $presetId, public string $form) {}
    /** @param array<string, mixed> $input Decoded JSON object. Catalog membership is checked later by the service. */
    public static function parse(array $input): self|CharacterFailure
    {
        $keys = array_keys($input);
        sort($keys);
        if (['form', 'name', 'presetId', 'requestId'] !== $keys) { return new CharacterFailure('invalid_request'); }
        ['requestId' => $requestId, 'name' => $name, 'presetId' => $presetId, 'form' => $form] = $input;
        if (!is_string($requestId) || 1 !== preg_match('/\A[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\z/', $requestId)) { return new CharacterFailure('invalid_request'); }
        if (!is_string($name) || !is_string($presetId) || 1 !== preg_match(PresetCatalog::ID_PATTERN, $presetId) || !in_array($form, self::FORMS, true)) { return new CharacterFailure('invalid_request'); }
        $normalized = CharacterName::normalize($name);
        return null === $normalized ? new CharacterFailure('invalid_character_name') : new self($requestId, $normalized, $presetId, $form);
    }
}
