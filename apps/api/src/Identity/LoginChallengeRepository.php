<?php

declare(strict_types=1);

namespace App\Identity;

use Doctrine\DBAL\Connection;

final class LoginChallengeRepository
{
    public function __construct(private Connection $connection, private Clock $clock)
    {
    }

    public function insert(string $id, string $nonceDigest, int $now): bool
    {
        return 1 === $this->connection->executeStatement(
            'INSERT INTO login_challenge (id, nonce_digest, created_at, expires_at) VALUES (?, ?, ?, ?) ON CONFLICT (id) DO NOTHING',
            [$id, $nonceDigest, $now, $now + 300],
        );
    }

    public function cleanup(int $now): void
    {
        $this->connection->executeStatement(
            'DELETE FROM login_challenge WHERE id IN (SELECT id FROM login_challenge WHERE expires_at < ? ORDER BY expires_at LIMIT 1000 FOR UPDATE SKIP LOCKED)',
            [$now - 86400],
        );
        $this->connection->executeStatement(
            'DELETE FROM auth_rate_bucket WHERE (route, bucket, minute) IN (SELECT route, bucket, minute FROM auth_rate_bucket WHERE minute < ? ORDER BY minute LIMIT 1000 FOR UPDATE SKIP LOCKED)',
            [intdiv($now, 60) - 60],
        );
    }

    public function consume(string $id, string $signedNonce): ChallengeConsumption
    {
        if (!$this->connection->isTransactionActive()) {
            throw new \LogicException('Challenge consumption requires a caller-owned transaction.');
        }
        $row = $this->connection->fetchAssociative('SELECT nonce_digest, expires_at, consumed_at FROM login_challenge WHERE id = ? FOR UPDATE', [$id]);
        $now = $this->clock->now();
        if (false === $row || null !== $row['consumed_at'] || $now >= (int) $row['expires_at']) {
            return ChallengeConsumption::Unavailable;
        }
        if (!hash_equals($row['nonce_digest'], hash('sha256', $signedNonce))) {
            return ChallengeConsumption::InvalidNonce;
        }
        $this->connection->executeStatement('UPDATE login_challenge SET consumed_at = ? WHERE id = ?', [$now, $id]);

        return ChallengeConsumption::Consumed;
    }
}
