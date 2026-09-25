<?php

declare(strict_types=1);
namespace App\Oath;

final readonly class OathFailure
{
    /** @param list<string> $validOffsets */
    public function __construct(public string $code, public int $status = 400, public ?string $field = null, public array $validOffsets = []) {}
    /** @return array<string, mixed> */
    public function toArray(): array
    {
        $error = ['code' => $this->code];
        if (null !== $this->field) { $error['field'] = $this->field; }
        if ([] !== $this->validOffsets) { $error['validOffsets'] = $this->validOffsets; }
        return ['error' => $error];
    }
}
