<?php

declare(strict_types=1);
namespace App\Oath;

use App\Identity\{AppSessionRepository, Clock};
use Doctrine\DBAL\Connection;

final class OathReadService
{
    public function __construct(private Connection $connection, private AppSessionRepository $sessions, private Clock $clock, private OathReconciler $reconciler) {}
    /** @return array<string, mixed>|OathFailure */
    public function detail(#[\SensitiveParameter] string $bearer, string $id): array|OathFailure
    {
        return $this->access($bearer, function (string $accountId, string $characterId, int $now) use ($id): array|OathFailure {
            if (1 !== preg_match('/\A[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\z/', $id)) { return new OathFailure('not_found', 404); }
            $row = $this->connection->fetchAssociative('SELECT * FROM oath WHERE account_id = ? AND character_id = ? AND id = ?', [$accountId, $characterId, $id]);
            if (false === $row) { return new OathFailure('not_found', 404); }
            return ['oath' => OathRepresentation::fromRow($row), 'serverTime' => gmdate('Y-m-d\TH:i:s\Z', $now)];
        });
    }
    /** @return array<string, mixed>|OathFailure */
    public function listing(#[\SensitiveParameter] string $bearer, OathListInput $input): array|OathFailure
    {
        return $this->access($bearer, function (string $accountId, string $characterId, int $now, bool $paused) use ($input): array|OathFailure {
            $today = 'today' === $input->view;
            $column = $today ? 'deadline' : 'terminal_at';
            $predicate = $today ? "state IN ('scheduled', 'active', 'proof_pending', 'needs_more_evidence', 'review_pending')" : "state IN ('fulfilled', 'missed', 'unresolved', 'withdrawn')";
            $parameters = [$accountId, $characterId];
            $after = '';
            if (null !== $input->cursor) {
                $cursor = OathCursor::decode($input->cursor, $accountId, $characterId, $input->view);
                if ($cursor instanceof OathFailure) { return $cursor; }
                $anchor = $this->connection->fetchOne('SELECT '.$column.' FROM oath WHERE account_id = ? AND character_id = ? AND id = ? AND '.$predicate, [$accountId, $characterId, $cursor['id']]);
                if ($anchor !== $cursor['key']) { return new OathFailure('invalid_request'); }
                $after = ' AND ('.$column.', id) '.($today ? '>' : '<').' (?, ?::uuid)';
                $parameters[] = $cursor['key']; $parameters[] = $cursor['id'];
            }
            $order = $today ? ' ASC' : ' DESC';
            $rows = $this->connection->fetchAllAssociative('SELECT * FROM oath WHERE account_id = ? AND character_id = ? AND '.$predicate.$after.' ORDER BY '.$column.$order.', id'.$order.' LIMIT '.($input->limit + 1), $parameters);
            $more = count($rows) > $input->limit;
            if ($more) { array_pop($rows); }
            $last = [] === $rows ? null : $rows[array_key_last($rows)];
            return ['items' => array_map(OathRepresentation::fromRow(...), $rows), 'nextCursor' => $more && null !== $last ? OathCursor::encode($accountId, $characterId, $input->view, $last[$column], $last['id']) : null, 'serverTime' => gmdate('Y-m-d\TH:i:s\Z', $now), 'paused' => $paused, 'characterId' => $characterId];
        });
    }
    /** Reads are scoped to the active character. Without one the answer is character_required, before any reconciliation.
     * @param callable(string, string, int, bool): (array<string, mixed>|OathFailure) $read
     * @return array<string, mixed>|OathFailure
     */
    private function access(#[\SensitiveParameter] string $bearer, callable $read): array|OathFailure
    {
        try {
            $account = $this->sessions->findActive($bearer);
            if (null === $account) { return new OathFailure('unauthenticated', 401); }
            return $this->connection->transactional(function () use ($account, $bearer, $read): array|OathFailure {
                $row = $this->connection->fetchAssociative('SELECT status, active_character_id FROM account WHERE id = ? FOR UPDATE', [$account->id]);
                $session = $this->connection->fetchAssociative('SELECT expires_at, revoked_at FROM app_session WHERE token_digest = ? AND account_id = ? FOR UPDATE', [hash('sha256', $bearer), $account->id]);
                $locked = $this->reconciler->lockOwned($account->id);
                $now = $this->clock->now();
                if (false === $row || 'active' !== $row['status'] || false === $session || null !== $session['revoked_at'] || $now >= $session['expires_at']) { return new OathFailure('unauthenticated', 401); }
                if (null === $row['active_character_id']) { return new OathFailure('character_required', 409); }
                $this->reconciler->reconcileLocked($locked, $now);
                $paused = (bool) $this->connection->fetchOne('SELECT paused FROM player_character WHERE account_id = ? AND id = ?', [$account->id, $row['active_character_id']]);
                return $read($account->id, $row['active_character_id'], $now, $paused);
            });
        } catch (\Doctrine\DBAL\Exception) { return new OathFailure('temporarily_unavailable', 503); }
    }
}
