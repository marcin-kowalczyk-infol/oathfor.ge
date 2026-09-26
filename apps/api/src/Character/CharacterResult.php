<?php

declare(strict_types=1);
namespace App\Character;

final readonly class CharacterResult
{
    /** @param array<string, mixed> $body */
    public function __construct(public array $body, public bool $created) {}
}
