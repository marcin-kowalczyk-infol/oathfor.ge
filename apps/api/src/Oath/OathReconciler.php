<?php

declare(strict_types=1);
namespace App\Oath;

use App\Identity\Clock;
use Doctrine\DBAL\Connection;

final class OathReconciler
{
    public function __construct(private Connection $connection, private Clock $clock) {}

    /** Caller already holds account then session locks; recheck authorization/time after this potentially blocking call.
     * @return list<array<string, mixed>>
     */
    public function lockOwned(string $accountId): array
    {
        return $this->connection->fetchAllAssociative('SELECT * FROM oath WHERE account_id = ? ORDER BY id FOR UPDATE', [$accountId]);
    }
    /** Caller owns account and all supplied Oath locks, and has rechecked authorization at $now.
     * @param list<array<string, mixed>> $rows
     * @return array{activated: int, review: int}
     */
    public function reconcileLocked(array $rows, int $now): array
    {
        $counts = ['activated' => 0, 'review' => 0];
        foreach ($rows as $row) {
            if ('scheduled' === $row['state'] && $now >= $row['activation_at']) {
                $this->connection->executeStatement("UPDATE oath SET state = 'active', activated_at = activation_at, activation_reconciled_at = ? WHERE id = ?", [$now, $row['id']]);
                $row['state'] = 'active'; ++$counts['activated'];
            }
            if ('active' === $row['state'] && $now > $row['receipt_cutoff']) {
                $this->connection->executeStatement("UPDATE oath SET state = 'review_pending', reason = 'service_availability_unknown', review_entered_at = ?, review_closes_at = ? WHERE id = ?", [$now, $now + 259200, $row['id']]);
                ++$counts['review'];
            }
        }
        return $counts;
    }
    /** @return array{selected: int, activated: int, review: int} */
    public function run(int $limit): array
    {
        if ($limit < 1 || $limit > 1000) { throw new \InvalidArgumentException('Invalid reconciliation limit.'); }
        $now = $this->clock->now();
        $candidates = $this->connection->fetchAllAssociative("SELECT o.id, o.account_id FROM oath o JOIN account a ON a.id = o.account_id WHERE a.status = 'active' AND ((o.state = 'scheduled' AND o.activation_at <= ?) OR (o.state = 'active' AND o.receipt_cutoff < ?)) ORDER BY o.activation_at, o.id LIMIT ".$limit, [$now, $now]);
        $counts = ['selected' => count($candidates), 'activated' => 0, 'review' => 0];
        foreach ($candidates as $candidate) {
            $changed = $this->connection->transactional(function () use ($candidate): array {
                $status = $this->connection->fetchOne('SELECT status FROM account WHERE id = ? FOR UPDATE', [$candidate['account_id']]);
                if ('active' !== $status) { return ['activated' => 0, 'review' => 0]; }
                $rows = $this->connection->fetchAllAssociative('SELECT * FROM oath WHERE account_id = ? AND id = ? ORDER BY id FOR UPDATE', [$candidate['account_id'], $candidate['id']]);
                return $this->reconcileLocked($rows, $this->clock->now());
            });
            $counts['activated'] += $changed['activated']; $counts['review'] += $changed['review'];
        }
        return $counts;
    }
}
