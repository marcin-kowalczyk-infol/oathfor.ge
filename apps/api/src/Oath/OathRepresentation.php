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
        return ['id' => $row['id'], 'state' => $row['state'], 'snapshot' => json_decode($row['snapshot'], true, flags: JSON_THROW_ON_ERROR), 'createdAt' => self::time($row['created_at']), 'activatedAt' => self::time($row['activated_at']), 'terminalAt' => self::time($row['terminal_at']), 'reason' => $row['reason']];
    }
    private static function time(?int $timestamp): ?string { return null === $timestamp ? null : gmdate('Y-m-d\TH:i:s\Z', $timestamp); }
}
