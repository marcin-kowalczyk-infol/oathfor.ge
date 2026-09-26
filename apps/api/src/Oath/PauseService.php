<?php

declare(strict_types=1);
namespace App\Oath;

use App\Identity\{AppSessionRepository, Clock};
use Doctrine\DBAL\Connection;

final class PauseService
{
    public function __construct(private Connection $connection, private AppSessionRepository $sessions, private Clock $clock, private OathReconciler $reconciler) {}
    /** @return array<string, mixed>|OathFailure */
    public function access(#[\SensitiveParameter] string $bearer, ?PauseInput $input = null): array|OathFailure
    {
        try {
            $account = $this->sessions->findActive($bearer);
            if (null === $account) { return new OathFailure('unauthenticated', 401); }
            return $this->connection->transactional(function () use ($account, $bearer, $input): array|OathFailure {
                $row = $this->connection->fetchAssociative('SELECT status, gameplay_paused, active_character_id FROM account WHERE id = ? FOR UPDATE', [$account->id]);
                $session = $this->connection->fetchAssociative('SELECT expires_at, revoked_at FROM app_session WHERE token_digest = ? AND account_id = ? FOR UPDATE', [hash('sha256', $bearer), $account->id]);
                $locked = $this->reconciler->lockOwned($account->id);
                $now = $this->clock->now();
                if (false === $row || 'active' !== $row['status'] || false === $session || null !== $session['revoked_at'] || $now >= $session['expires_at']) { return new OathFailure('unauthenticated', 401); }
                $character = $row['active_character_id'];
                if (null === $character) { return new OathFailure('character_required', 409); }
                $this->reconciler->reconcileLocked($locked, $now);
                $paused = $row['gameplay_paused'];
                $summary = $this->summary($account->id, $character, $paused, $now);
                if (null === $input) { return $summary; }
                if ($input->paused && !$paused) {
                    if (!hash_equals($summary['revision'], (string) $input->revision)) { return new OathFailure('pause_preview_changed', 409); }
                    $this->connection->executeStatement("UPDATE oath SET state = 'withdrawn', terminal_at = ?, reason = 'account_paused' WHERE account_id = ? AND character_id = ? AND state IN ('scheduled', 'active')", [$now, $account->id, $character]);
                }
                if ($paused !== $input->paused) {
                    $this->connection->executeStatement('UPDATE account SET gameplay_paused = ? WHERE id = ?', [$input->paused, $account->id], [\Doctrine\DBAL\ParameterType::BOOLEAN, \Doctrine\DBAL\ParameterType::STRING]);
                }
                return $this->summary($account->id, $character, $input->paused, $now);
            });
        } catch (\Doctrine\DBAL\Exception) { return new OathFailure('temporarily_unavailable', 503); }
    }
    /** Re-read after reconciliation or withdrawal, because pre-transition locked rows are stale. Only the active character's commitments are affected.
     * @return array{paused: bool, revision: string, withdraw: list<string>, preserve: list<string>, serverTime: string, characterId: string}
     */
    private function summary(string $accountId, string $characterId, bool $paused, int $now): array
    {
        $rows = $this->connection->fetchAllAssociative("SELECT id, state FROM oath WHERE account_id = ? AND character_id = ? AND state IN ('scheduled', 'active', 'proof_pending', 'needs_more_evidence', 'review_pending') ORDER BY id", [$accountId, $characterId]);
        $withdraw = []; $preserve = [];
        foreach ($rows as $row) {
            if (in_array($row['state'], ['scheduled', 'active'], true)) { $withdraw[] = $row['id']; }
            else { $preserve[] = $row['id']; }
        }
        return ['paused' => $paused, 'revision' => hash('sha256', json_encode([$characterId, $paused, $rows], JSON_THROW_ON_ERROR)), 'withdraw' => $withdraw, 'preserve' => $preserve, 'serverTime' => gmdate('Y-m-d\TH:i:s\Z', $now), 'characterId' => $characterId];
    }
}
