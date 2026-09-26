<?php

declare(strict_types=1);
namespace App\Tests\Integration;

use Doctrine\DBAL\Connection;
use Doctrine\DBAL\Exception\DriverException;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\Process\Process;

final class CharacterMigrationTest extends KernelTestCase
{
    private const ACCOUNT = '00000000-0000-4000-8000-000000000001';
    private const OTHER = '00000000-0000-4000-8000-000000000002';
    private Connection $connection;
    protected function setUp(): void
    {
        self::bootKernel();
        $connection = self::getContainer()->get(Connection::class);
        self::assertInstanceOf(Connection::class, $connection);
        $this->connection = $connection;
        self::assertSame('oathforge_test', $connection->fetchOne('SELECT current_database()'));
        $connection->executeStatement('TRUNCATE account CASCADE');
        foreach ([self::ACCOUNT, self::OTHER] as $id) { $connection->insert('account', ['id' => $id, 'created_at' => 1800000000]); }
    }
    protected function tearDown(): void
    {
        $this->connection->executeStatement('TRUNCATE account CASCADE');
        parent::tearDown();
    }
    public function testStorageKeepsLimitShapeAndOwnActiveCharacter(): void
    {
        $foreign = $this->character(self::OTHER, 1);
        $this->expectFailure('23503', fn () => $this->connection->executeStatement('UPDATE account SET active_character_id = ? WHERE id = ?', [$foreign, self::ACCOUNT]));
        $this->expectFailure('23505', fn () => $this->character(self::OTHER, 1));
        $this->expectFailure('23505', fn () => $this->character(self::OTHER, 2, '00000000-0000-4000-a000-000000000011'));
        $this->expectFailure('23514', fn () => $this->character(self::ACCOUNT, 4));
        $this->expectFailure('23514', fn () => $this->character(self::ACCOUNT, 1, null, 'A'));
        $this->expectFailure('23514', fn () => $this->character(self::ACCOUNT, 1, null, 'Mira', 'other'));
        $own = $this->character(self::ACCOUNT, 1);
        $this->connection->executeStatement('UPDATE account SET active_character_id = ? WHERE id = ?', [$own, self::ACCOUNT]);
        $this->connection->executeStatement('UPDATE account SET active_character_id = ? WHERE id = ?', [$foreign, self::OTHER]);
        $this->connection->executeStatement('DELETE FROM account WHERE id = ?', [self::OTHER]);
        self::assertSame([$own], $this->connection->fetchFirstColumn('SELECT id FROM player_character'));
        $this->connection->executeStatement('TRUNCATE account CASCADE');
        self::assertSame(0, $this->connection->fetchOne('SELECT COUNT(*) FROM player_character'));
    }
    public function testMigrationIsReversible(): void
    {
        $this->connection->executeStatement('TRUNCATE account CASCADE');
        $this->migration('--down');
        try {
            self::assertFalse($this->connection->fetchOne("SELECT to_regclass('player_character') IS NOT NULL"));
            self::assertSame(0, $this->connection->fetchOne("SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'account' AND column_name = 'active_character_id'"));
        } finally { $this->migration('--up'); }
        self::assertTrue($this->connection->fetchOne("SELECT to_regclass('player_character') IS NOT NULL"));
        self::assertSame(1, $this->connection->fetchOne("SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'account' AND column_name = 'active_character_id'"));
    }
    private function character(string $account, int $slot, ?string $request = null, string $name = 'Mira', string $form = 'feminine'): string
    {
        return (string) $this->connection->fetchOne('INSERT INTO player_character (account_id, slot, creation_request_id, name, preset_id, form, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id', [$account, $slot, $request ?? sprintf('00000000-0000-4000-a000-%012d', $slot + 10 * (int) (self::OTHER === $account)), $name, 'dummy_braid', $form, 1800000000]);
    }
    private function expectFailure(string $sqlState, \Closure $operation): void
    {
        $this->connection->beginTransaction();
        try { $operation(); self::fail('Expected SQLSTATE '.$sqlState); }
        catch (DriverException $error) { self::assertSame($sqlState, $error->getSQLState()); }
        finally { $this->connection->rollBack(); }
    }
    private function migration(string $direction): void
    {
        $process = new Process([PHP_BINARY, 'bin/console', 'doctrine:migrations:execute', 'DoctrineMigrations\\Version20260926100000', $direction, '--env=test', '--no-interaction'], dirname(__DIR__, 2));
        $process->setTimeout(30);
        $process->run();
        self::assertSame(0, $process->getExitCode(), $process->getOutput().$process->getErrorOutput());
    }
}
