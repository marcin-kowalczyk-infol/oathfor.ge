<?php

declare(strict_types=1);
namespace App\Oath;

final readonly class AcceptanceInput
{
    private function __construct(public string $previewId, public string $requestId) {}
    /** @param array<string, mixed> $input */
    public static function parse(array $input): self|OathFailure
    {
        if (array_diff(array_keys($input), ['previewId', 'requestId', 'accepted']) !== [] || true !== ($input['accepted'] ?? null)) { return new OathFailure('invalid_request'); }
        foreach (['previewId', 'requestId'] as $field) {
            if (!is_string($input[$field] ?? null) || 1 !== preg_match('/\A[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\z/', $input[$field])) { return new OathFailure('invalid_request'); }
        }
        return new self($input['previewId'], $input['requestId']);
    }
}
