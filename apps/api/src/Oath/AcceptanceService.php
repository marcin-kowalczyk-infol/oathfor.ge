<?php

declare(strict_types=1);
namespace App\Oath;

use App\Identity\{AppSessionRepository, Clock};
use Doctrine\DBAL\Connection;

final class AcceptanceService
{
    public function __construct(private Connection $connection, private AppSessionRepository $sessions, private Clock $clock) {}
    public function accept(#[\SensitiveParameter] string $bearer, AcceptanceInput $input): AcceptanceResult|OathFailure
    {
        try {
            $account = $this->sessions->findActive($bearer);
            if (null === $account) { return new OathFailure('unauthenticated', 401); }
            return $this->connection->transactional(function () use ($account, $bearer, $input): AcceptanceResult|OathFailure {
                $row = $this->connection->fetchAssociative('SELECT status, onboarding_status, gameplay_paused FROM account WHERE id = ? FOR UPDATE', [$account->id]);
                $session = $this->connection->fetchAssociative('SELECT expires_at, revoked_at FROM app_session WHERE token_digest = ? AND account_id = ? FOR UPDATE', [hash('sha256', $bearer), $account->id]);
                $now = $this->clock->now();
                if (false === $row || 'active' !== $row['status'] || false === $session || null !== $session['revoked_at'] || $now >= $session['expires_at']) { return new OathFailure('unauthenticated', 401); }
                $request = $this->connection->fetchAssociative('SELECT preview_id, oath_id FROM oath_acceptance_request WHERE account_id = ? AND request_id = ?', [$account->id, $input->requestId]);
                if (false !== $request) {
                    if ($request['preview_id'] !== $input->previewId) { return new OathFailure('idempotency_conflict', 409); }
                    return $this->result($account->id, $request['oath_id'], $now, false);
                }
                $preview = $this->connection->fetchAssociative('SELECT snapshot, oath_id FROM oath_preview WHERE account_id = ? AND id = ?', [$account->id, $input->previewId]);
                if (false === $preview) { return new OathFailure('not_found', 404); }
                if (null !== $preview['oath_id']) {
                    $this->bind($account->id, $input, $preview['oath_id']);
                    return $this->result($account->id, $preview['oath_id'], $now, false);
                }
                if ('complete' !== $row['onboarding_status']) { return new OathFailure('onboarding_incomplete', 409); }
                if ($row['gameplay_paused']) { return new OathFailure('account_paused', 409); }
                $snapshot = json_decode($preview['snapshot'], true, flags: JSON_THROW_ON_ERROR);
                if (RuleCatalog::TEMPLATE_VERSION !== $snapshot['templateVersion'] || RuleCatalog::POLICY_VERSION !== $snapshot['policyVersion']) { return new OathFailure('preview_superseded', 409); }
                $scheduled = 'scheduled' === $snapshot['activation']['mode'];
                $activation = $scheduled ? (new \DateTimeImmutable($snapshot['activation']['time']['utc']))->getTimestamp() : $now;
                $deadline = (new \DateTimeImmutable($snapshot['deadline']['utc']))->getTimestamp();
                if ($scheduled && $activation <= $now) { return new OathFailure('activation_elapsed', 409); }
                if ($deadline <= $activation) { return new OathFailure('deadline_not_after_activation', 409); }
                if (!$scheduled) {
                    $local = (new \DateTimeImmutable('@'.$now))->setTimezone(new \DateTimeZone($snapshot['deadline']['timezone']));
                    $snapshot['activation']['time'] = ['local' => $local->format('Y-m-d\TH:i:s'), 'timezone' => $snapshot['deadline']['timezone'], 'offset' => $local->format('P'), 'explicitOffset' => false, 'utc' => gmdate('Y-m-d\TH:i:s\Z', $now)];
                }
                $id = $this->connection->fetchOne('INSERT INTO oath (account_id, preview_id, snapshot, state, activation_at, deadline, receipt_cutoff, created_at, activated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id', [$account->id, $input->previewId, $scheduled ? $preview['snapshot'] : json_encode($snapshot, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE), $scheduled ? 'scheduled' : 'active', $activation, $deadline, (new \DateTimeImmutable($snapshot['deadline']['receiptCutoff']))->getTimestamp(), $now, $scheduled ? null : $now]);
                $this->bind($account->id, $input, $id);
                $this->connection->executeStatement('UPDATE oath_preview SET oath_id = ? WHERE account_id = ? AND id = ?', [$id, $account->id, $input->previewId]);
                return $this->result($account->id, $id, $now, true);
            });
        } catch (\Doctrine\DBAL\Exception) { return new OathFailure('temporarily_unavailable', 503); }
    }
    private function bind(string $accountId, AcceptanceInput $input, string $oathId): void
    {
        $this->connection->insert('oath_acceptance_request', ['account_id' => $accountId, 'request_id' => $input->requestId, 'preview_id' => $input->previewId, 'oath_id' => $oathId]);
    }
    private function result(string $accountId, string $id, int $now, bool $created): AcceptanceResult
    {
        $row = $this->connection->fetchAssociative('SELECT * FROM oath WHERE account_id = ? AND id = ?', [$accountId, $id]);
        if (false === $row) { throw new \LogicException('Persisted commitment missing.'); }
        return new AcceptanceResult(['oath' => OathRepresentation::fromRow($row), 'serverTime' => gmdate('Y-m-d\TH:i:s\Z', $now)], $created);
    }
}
