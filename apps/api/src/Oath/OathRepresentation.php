<?php

declare(strict_types=1);
namespace App\Oath;

use Doctrine\DBAL\{ArrayParameterType, Connection};

final class OathRepresentation
{
    /** One query loads the latest proof of every row, so a list page costs no query per Oath.
     * The proof holds receipt metadata only, never a storage key or an image URL.
     * @param list<array<string, mixed>> $rows
     * @return list<array<string, mixed>>
     */
    public static function fromRows(Connection $connection, array $rows): array
    {
        $proofs = [];
        if ([] !== $rows) {
            $latest = $connection->fetchAllAssociative('SELECT DISTINCT ON (oath_id) oath_id, submission_id, mode, revision, received_at, assessment_status FROM proof_submission WHERE oath_id IN (?) ORDER BY oath_id, revision DESC', [array_column($rows, 'id')], [ArrayParameterType::STRING]);
            foreach ($latest as $proof) { $proofs[$proof['oath_id']] = self::proof($proof); }
        }
        return array_map(static fn (array $row): array => self::fromRow($row, $proofs[$row['id']] ?? null), $rows);
    }
    /** @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    public static function fromOne(Connection $connection, array $row): array { return self::fromRows($connection, [$row])[0]; }
    /** The receipt shape shared by Oath reads and the submission response.
     * @param array<string, mixed> $proof a proof_submission row
     * @return array{submissionId: string, mode: string, receivedAt: string, revision: int, assessment: string}
     */
    public static function proof(array $proof): array
    {
        return ['submissionId' => (string) $proof['submission_id'], 'mode' => (string) $proof['mode'], 'receivedAt' => gmdate('Y-m-d\TH:i:s\Z', (int) $proof['received_at']), 'revision' => (int) $proof['revision'], 'assessment' => (string) $proof['assessment_status']];
    }
    /** @param array<string, mixed> $row
     * @param array<string, mixed>|null $proof
     * @return array<string, mixed>
     */
    private static function fromRow(array $row, ?array $proof): array
    {
        return ['id' => $row['id'], 'characterId' => $row['character_id'], 'state' => $row['state'], 'snapshot' => json_decode($row['snapshot'], true, flags: JSON_THROW_ON_ERROR), 'createdAt' => self::time($row['created_at']), 'activatedAt' => self::time($row['activated_at']), 'terminalAt' => self::time($row['terminal_at']), 'reason' => $row['reason'], 'review' => null === $row['review_entered_at'] ? null : ['enteredAt' => self::time($row['review_entered_at']), 'closesAt' => self::time($row['review_closes_at'])], 'proof' => $proof];
    }
    private static function time(?int $timestamp): ?string { return null === $timestamp ? null : gmdate('Y-m-d\TH:i:s\Z', $timestamp); }
}
