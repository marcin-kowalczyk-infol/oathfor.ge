<?php

declare(strict_types=1);
namespace App\Proof;

use App\Identity\AppSessionRepository;
use App\Oath\OathFailure;
use Doctrine\DBAL\Connection;

/**
 * Returns the normalized proof image to its owner (MVP-07-T06, ADR 0008).
 * The bytes never depend on Oath state, so this read neither reconciles nor locks. One statement checks the account,
 * the active character and the proof together, and the file is read after it, outside any transaction.
 */
final class ProofReadService
{
    private const string UUID = '/\A[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\z/';

    public function __construct(private Connection $connection, private AppSessionRepository $sessions, private ProofStorage $storage) {}
    public function image(#[\SensitiveParameter] string $bearer, string $oathId, string $submissionId): string|OathFailure
    {
        try {
            $account = $this->sessions->findActive($bearer);
            if (null === $account) { return new OathFailure('unauthenticated', 401); }
            // Another account, another character, an unknown ID and a malformed ID all answer the same not_found.
            $row = $this->connection->fetchAssociative("SELECT a.active_character_id, p.storage_key FROM account a LEFT JOIN (proof_submission p JOIN oath o ON o.account_id = p.account_id AND o.id = p.oath_id) ON p.account_id = a.id AND o.character_id = a.active_character_id AND p.oath_id = ? AND p.submission_id = ? WHERE a.id = ? AND a.status = 'active'", [1 === preg_match(self::UUID, $oathId) ? $oathId : null, 1 === preg_match(self::UUID, $submissionId) ? $submissionId : null, $account->id]);
            if (false === $row) { return new OathFailure('unauthenticated', 401); }
            if (null === $row['active_character_id']) { return new OathFailure('character_required', 409); }
            if (null === $row['storage_key']) { return new OathFailure('not_found', 404); }
            return $this->storage->read($row['storage_key']);
        } catch (\Doctrine\DBAL\Exception|\RuntimeException) { return new OathFailure('temporarily_unavailable', 503); }
    }
}
