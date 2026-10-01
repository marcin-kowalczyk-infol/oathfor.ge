<?php

declare(strict_types=1);
namespace App\Proof;

use App\Identity\{AccountUser, AppSessionRepository, Clock};
use App\Oath\{OathFailure, OathReconciler, OathRepresentation};
use Doctrine\DBAL\{Connection, ParameterType};

/**
 * Records the first proof of an active Oath (MVP-07, ADR 0008).
 * Decoding and staging happen before any lock. Receipt R is sampled only after the account, session and Oath locks.
 */
final class SubmissionService
{
    public function __construct(private Connection $connection, private AppSessionRepository $sessions, private Clock $clock, private OathReconciler $reconciler, private ProofImageNormalizer $normalizer, private ProofStorage $storage) {}
    public function submit(#[\SensitiveParameter] string $bearer, string $oathId, SubmissionInput $input): SubmissionResult|OathFailure
    {
        $key = null;
        $promoted = false;
        $result = new OathFailure('temporarily_unavailable', 503);
        try {
            $account = $this->sessions->findActive($bearer);
            if (null === $account) { return $result = new OathFailure('unauthenticated', 401); }
            // A malformed ID can never name an Oath, so nothing is decoded or stored for it.
            if (1 !== preg_match('/\A[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\z/', $oathId)) { return $result = new OathFailure('not_found', 404); }
            try { $image = $this->normalizer->normalize($input->image); }
            catch (ProofImageFailure $failure) { return $result = new OathFailure($failure->failureCode, 422, 'image'); }
            // Retry identity compares the received bytes, not the GD output (ADR 0008).
            $sha256 = hash('sha256', $input->image);
            $key = $this->storage->stage($image->bytes);
            return $result = $this->connection->transactional(function () use ($account, $bearer, $oathId, $input, $sha256, $key, &$promoted): SubmissionResult|OathFailure {
                $received = $this->receive($account, $bearer, $oathId, $input, $sha256, $key);
                // Promotion is the last step before commit, so a finalized row never points at a staged object the purge could remove.
                // If the commit fails after it, the finally block below removes the unreferenced object.
                if ($received instanceof SubmissionResult) { $this->storage->promote($key); $promoted = true; }
                return $received;
            });
        } catch (\Doctrine\DBAL\Exception|\RuntimeException) {
            return $result = new OathFailure('temporarily_unavailable', 503);
        } finally {
            if (null !== $key && !$result instanceof SubmissionResult) { $this->discard($key, $promoted); }
        }
    }
    /**
     * Removes the object of a submission that did not finalize. A promoted object is deleted only when no committed row
     * references it, because a commit can succeed even though the client saw an error. If that check fails, the object stays.
     */
    private function discard(string $key, bool $promoted): void
    {
        try {
            if (!$promoted) { $this->storage->deleteStaged($key); return; }
            if (false === $this->connection->fetchOne('SELECT 1 FROM proof_submission WHERE storage_key = ?', [$key])) { $this->storage->delete($key); }
        } catch (\Doctrine\DBAL\Exception|\RuntimeException) {
            // The response stays the same 503. A staged copy is left to the staging purge.
        }
    }
    /** Runs inside the transaction. A refusal is returned, not thrown, so the reconciliation still commits. */
    private function receive(AccountUser $account, #[\SensitiveParameter] string $bearer, string $oathId, SubmissionInput $input, string $sha256, string $key): SubmissionResult|OathFailure
    {
        $row = $this->connection->fetchAssociative('SELECT status, active_character_id FROM account WHERE id = ? FOR UPDATE', [$account->id]);
        $session = $this->connection->fetchAssociative('SELECT expires_at, revoked_at FROM app_session WHERE token_digest = ? AND account_id = ? FOR UPDATE', [hash('sha256', $bearer), $account->id]);
        $locked = $this->reconciler->lockOwned($account->id);
        $now = $this->clock->now();
        if (false === $row || 'active' !== $row['status'] || false === $session || null !== $session['revoked_at'] || $now >= $session['expires_at']) { return new OathFailure('unauthenticated', 401); }
        if (null === $row['active_character_id']) { return new OathFailure('character_required', 409); }
        $this->reconciler->reconcileLocked($locked, $now);
        // Re-read after reconciliation, because the locked rows are stale. Another account or character sees not_found.
        $oath = $this->connection->fetchAssociative('SELECT * FROM oath WHERE account_id = ? AND character_id = ? AND id = ?', [$account->id, $row['active_character_id'], $oathId]);
        if (false === $oath) { return new OathFailure('not_found', 404); }
        // Checked before the state, whether the cutoff transition ran just now or in an earlier reconcile run.
        if ($now > $oath['receipt_cutoff'] && false === $this->connection->fetchOne('SELECT 1 FROM proof_submission WHERE oath_id = ?', [$oathId])) { return new OathFailure('receipt_cutoff_passed', 409); }
        // Corrections arrive in a later slice, so a received proof closes this endpoint for the Oath.
        if ('proof_pending' === $oath['state']) { return new OathFailure('proof_already_submitted', 409); }
        if ('active' !== $oath['state']) { return new OathFailure('oath_not_active', 409, state: $oath['state']); }
        $this->connection->insert('proof_submission', ['account_id' => $account->id, 'character_id' => $oath['character_id'], 'oath_id' => $oathId, 'submission_id' => $input->submissionId, 'revision' => 1, 'mode' => $input->mode, 'declaration_confirmed' => true, 'content_sha256' => $sha256, 'storage_key' => $key, 'received_at' => $now, 'assessment_status' => 'queued', 'created_at' => $now], ['declaration_confirmed' => ParameterType::BOOLEAN]);
        $this->connection->executeStatement("UPDATE oath SET state = 'proof_pending' WHERE id = ?", [$oathId]);
        $updated = $this->connection->fetchAssociative('SELECT * FROM oath WHERE id = ?', [$oathId]);
        if (false === $updated) { throw new \LogicException('Locked Oath missing.'); }
        $receivedAt = gmdate('Y-m-d\TH:i:s\Z', $now);
        return new SubmissionResult(['proof' => ['submissionId' => $input->submissionId, 'mode' => $input->mode, 'receivedAt' => $receivedAt, 'revision' => 1, 'assessment' => 'queued'], 'oath' => OathRepresentation::fromRow($updated), 'serverTime' => $receivedAt]);
    }
}
