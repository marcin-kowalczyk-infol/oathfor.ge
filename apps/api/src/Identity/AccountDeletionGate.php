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
        $account = $this->connection->fetchAssociative('SELECT id, deletion_requested_at FROM account WHERE id = ? FOR UPDATE', [$accountId]);
        if (false === $account) {
            return false;
        }
        if (null === $account['deletion_requested_at']) {
            $now = $this->clock->now();
            $this->connection->executeStatement('UPDATE account SET deletion_requested_at = ? WHERE id = ?', [$now, $accountId]);
            $this->connection->fetchFirstColumn('SELECT id FROM provider_identity WHERE account_id = ? ORDER BY id FOR UPDATE', [$accountId]);
            $this->connection->executeStatement("UPDATE provider_identity SET revocation_status = 'pending', revocation_due_at = ?, validation_due_at = NULL, maintenance_claim = NULL WHERE account_id = ? AND refresh_envelope IS NOT NULL", [$now, $accountId]);
        }
        $this->connection->executeStatement("UPDATE account SET status = 'deleting' WHERE id = ? AND status = 'active'", [$accountId]);
        $this->connection->executeStatement('UPDATE app_session SET revoked_at = COALESCE(revoked_at, ?) WHERE account_id = ?', [$this->clock->now(), $accountId]);
        return true;
    }
}
