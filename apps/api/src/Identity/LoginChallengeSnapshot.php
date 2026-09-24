<?php

declare(strict_types=1);

namespace App\Identity;

/** Trusted immutable storage data; never populated from client claims. */
final readonly class LoginChallengeSnapshot
{
    public function __construct(public string $id, public string $nonceDigest, public int $expiresAt) {}
}
