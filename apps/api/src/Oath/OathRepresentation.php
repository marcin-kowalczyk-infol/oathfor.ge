<?php

declare(strict_types=1);
namespace App\Oath;

final class OathRepresentation
{
    /** @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    public static function fromRow(array $row): array
    {
        return ['id' => $row['id'], 'characterId' => $row['character_id'], 'state' => $row['state'], 'snapshot' => json_decode($row['snapshot'], true, flags: JSON_THROW_ON_ERROR), 'createdAt' => self::time($row['created_at']), 'activatedAt' => self::time($row['activated_at']), 'terminalAt' => self::time($row['terminal_at']), 'reason' => $row['reason'], 'review' => null === $row['review_entered_at'] ? null : ['enteredAt' => self::time($row['review_entered_at']), 'closesAt' => self::time($row['review_closes_at'])]];
    }
    private static function time(?int $timestamp): ?string { return null === $timestamp ? null : gmdate('Y-m-d\TH:i:s\Z', $timestamp); }
}
