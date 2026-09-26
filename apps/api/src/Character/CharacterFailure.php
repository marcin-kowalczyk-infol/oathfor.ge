<?php

declare(strict_types=1);
namespace App\Character;

final readonly class CharacterFailure
{
    public function __construct(public string $code, public int $status = 400) {}
    /** @return array{error: array{code: string}} */
    public function toArray(): array { return ['error' => ['code' => $this->code]]; }
}
