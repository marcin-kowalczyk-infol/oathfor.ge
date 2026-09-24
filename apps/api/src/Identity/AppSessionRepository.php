<?php

declare(strict_types=1);

namespace App\Identity;

use Doctrine\DBAL\Connection;

final class AppSessionRepository
{
    public function __construct(private Connection $connection, private Clock $clock)
    {
    }

    public static function isValidToken(string $token): bool
    {
        return 1 === preg_match('/^[A-Za-z0-9_-]{43}$/D', $token);
    }

    public function findActive(#[\SensitiveParameter] string $token): ?AccountUser
    {
        if (!self::isValidToken($token)) {
            return null;
        }
        $row = $this->connection->fetchAssociative('SELECT a.id, a.onboarding_status, a.status, s.expires_at, s.revoked_at FROM app_session s JOIN account a ON a.id = s.account_id WHERE s.token_digest = ?', [hash('sha256', $token)]);
        if (false === $row || null !== $row['revoked_at'] || $row['status'] !== 'active' || $this->clock->now() >= (int) $row['expires_at']) {
            return null;
        }
        return new AccountUser($row['id'], $row['onboarding_status']);
    }

    public function revoke(#[\SensitiveParameter] string $token): void
    {
        $this->connection->executeStatement('UPDATE app_session SET revoked_at = COALESCE(revoked_at, ?) WHERE token_digest = ?', [$this->clock->now(), hash('sha256', $token)]);
    }
}
