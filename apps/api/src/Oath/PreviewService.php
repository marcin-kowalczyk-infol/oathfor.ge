<?php

declare(strict_types=1);
namespace App\Oath;

use App\Identity\{AppSessionRepository, Clock};
use Doctrine\DBAL\Connection;

final class PreviewService
{
    public function __construct(private Connection $connection, private AppSessionRepository $sessions, private Clock $clock, private RuleCatalog $catalog) {}
    /** @return array<string, mixed>|OathFailure */
    public function create(#[\SensitiveParameter] string $bearer, PreviewInput $input): array|OathFailure { return $this->access($bearer, $input, null); }
    /** @return array<string, mixed>|OathFailure */
    public function read(#[\SensitiveParameter] string $bearer, string $id): array|OathFailure { return $this->access($bearer, null, $id); }
    /** @return array<string, mixed>|OathFailure */
    private function access(#[\SensitiveParameter] string $bearer, ?PreviewInput $input, ?string $id): array|OathFailure
    {
        try {
            $account = $this->sessions->findActive($bearer);
            if (null === $account) { return new OathFailure('unauthenticated', 401); }
            return $this->connection->transactional(function () use ($account, $bearer, $input, $id): array|OathFailure {
                $row = $this->connection->fetchAssociative('SELECT status, onboarding_status, active_character_id FROM account WHERE id = ? FOR UPDATE', [$account->id]);
                $session = $this->connection->fetchAssociative('SELECT expires_at, revoked_at FROM app_session WHERE token_digest = ? AND account_id = ? FOR UPDATE', [hash('sha256', $bearer), $account->id]);
                $now = $this->clock->now();
                if (false === $row || 'active' !== $row['status'] || false === $session || null !== $session['revoked_at'] || $now >= $session['expires_at']) { return new OathFailure('unauthenticated', 401); }
                if (null === $input) {
                    if (null === $id || 1 !== preg_match('/\A[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\z/', $id)) { return new OathFailure('not_found', 404); }
                    $preview = $this->connection->fetchAssociative('SELECT snapshot, character_id, oath_id FROM oath_preview WHERE id = ? AND account_id = ?', [$id, $account->id]);
                    if (false === $preview) { return new OathFailure('not_found', 404); }
                    return ['preview' => ['id' => $id, 'snapshot' => json_decode($preview['snapshot'], true, flags: JSON_THROW_ON_ERROR)], 'characterId' => $preview['character_id'], 'oathId' => $preview['oath_id']];
                }
                if ('complete' !== $row['onboarding_status']) { return new OathFailure('onboarding_incomplete', 409); }
                if (null === $row['active_character_id']) { return new OathFailure('character_required', 409); }
                // A separate statement after the account lock sees pause changes committed while this request waited.
                if ($this->connection->fetchOne('SELECT paused FROM player_character WHERE account_id = ? AND id = ?', [$account->id, $row['active_character_id']])) { return new OathFailure('character_paused', 409); }
                if (null !== $failure = $input->timingFailure($now)) { return $failure; }
                $activation = $input->activation?->toArray();
                if (null !== $activation) { unset($activation['receiptCutoff']); }
                $snapshot = $this->catalog->snapshot($input->activity, ['mode' => null === $activation ? 'now' : 'scheduled', 'time' => $activation], $input->deadline->toArray());
                $id = $this->connection->fetchOne('INSERT INTO oath_preview (account_id, character_id, snapshot, created_at) VALUES (?, ?, ?, ?) RETURNING id', [$account->id, $row['active_character_id'], json_encode($snapshot, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE), $now]);
                return ['preview' => ['id' => $id, 'snapshot' => $snapshot], 'characterId' => $row['active_character_id'], 'serverTime' => gmdate('Y-m-d\TH:i:s\Z', $now)];
            });
        } catch (\Doctrine\DBAL\Exception) { return new OathFailure('temporarily_unavailable', 503); }
    }
}
