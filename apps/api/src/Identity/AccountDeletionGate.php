<?php

declare(strict_types=1);

namespace App\Identity;

use Doctrine\DBAL\Connection;

final class AccountDeletionGate
{
    public function __construct(private Connection $connection, private Clock $clock)
    {
    }

    /** Internal access-denial gate only; this does not complete account deletion. */
    public function beginDeletion(string $accountId): bool
    {
        if (!$this->connection->isTransactionActive()) {
            throw new \LogicException('Account deletion gate requires a caller-owned transaction.');
        }
        $account = $this->connection->fetchOne('SELECT id FROM account WHERE id = ? FOR UPDATE', [$accountId]);
        if (false === $account) {
            return false;
        }
        $this->connection->executeStatement("UPDATE account SET status = 'deleting' WHERE id = ? AND status = 'active'", [$accountId]);
        $this->connection->executeStatement('UPDATE app_session SET revoked_at = COALESCE(revoked_at, ?) WHERE account_id = ?', [$this->clock->now(), $accountId]);
        return true;
    }
}
