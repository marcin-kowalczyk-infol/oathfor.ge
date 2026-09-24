<?php

declare(strict_types=1);

namespace App\Identity;

use Doctrine\DBAL\Connection;

final class AuthenticationRateLimiter
{
    public function __construct(private Connection $connection, private Clock $clock)
    {
    }

    /** Count every attempt, including rejected requests. Returns retry delay or zero. */
    public function attempt(string $route, string $ip): int
    {
        $now = $this->clock->now();
        $minute = intdiv($now, 60);
        return $this->connection->transactional(function () use ($route, $ip, $now, $minute): int {
            // Always lock in global-then-IP order. Commit counts even when saturated.
            $global = $this->increment($route, 'global', $minute);
            $local = $this->increment($route, hash('sha256', $ip), $minute);
            return $global > 1000 || $local > 10 ? 60 - $now % 60 : 0;
        });
    }

    private function increment(string $route, string $bucket, int $minute): int
    {
        return (int) $this->connection->fetchOne(
            'INSERT INTO auth_rate_bucket (route, bucket, minute, attempts) VALUES (?, ?, ?, 1) ON CONFLICT (route, bucket, minute) DO UPDATE SET attempts = auth_rate_bucket.attempts + 1 RETURNING attempts',
            [$route, $bucket, $minute],
        );
    }
}
