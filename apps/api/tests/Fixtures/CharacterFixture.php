<?php

declare(strict_types=1);
namespace App\Tests\Fixtures;

use Doctrine\DBAL\Connection;

/** Seeds a DUMMY player character for Oath tests and makes it the account's active character. */
final class CharacterFixture
{
    public static function activate(Connection $connection, string $accountId, int $slot = 1): string
    {
        $id = $connection->fetchOne('INSERT INTO player_character (account_id, slot, creation_request_id, name, preset_id, form, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id', [$accountId, $slot, sprintf('00000000-0000-4000-b000-%012d', $slot), 'Mira', 'dummy_braid', 'feminine', 1800000000]);
        if (!is_string($id)) { throw new \LogicException('Character fixture missing.'); }
        $connection->executeStatement('UPDATE account SET active_character_id = ? WHERE id = ?', [$id, $accountId]);
        return $id;
    }
}
