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
        $this->expectFailure('23514', fn () => $this->character(self::ACCOUNT, 1, null, 'Mira', 'feminine', 'medium'));
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
        // Proof submissions reference player characters, so that later table is removed first and restored last.
        $this->migration('Version20261001100000', '--down');
        $this->migration('Version20260927100000', '--down');
        $this->migration('Version20260926120000', '--down');
        $this->migration('Version20260926110000', '--down');
        $this->migration('Version20260926100000', '--down');
        try {
            self::assertFalse($this->connection->fetchOne("SELECT to_regclass('player_character') IS NOT NULL"));
            self::assertSame(0, $this->connection->fetchOne("SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'account' AND column_name = 'active_character_id'"));
        } finally { foreach (['Version20260926100000', 'Version20260926110000', 'Version20260926120000', 'Version20260927100000', 'Version20261001100000'] as $version) { $this->migration($version, '--up'); } }
        self::assertSame(1, $this->connection->fetchOne("SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'player_character' AND column_name = 'paused'"));
        self::assertSame(1, $this->connection->fetchOne("SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'player_character' AND column_name = 'build'"));
        self::assertSame(0, $this->connection->fetchOne("SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'account' AND column_name = 'gameplay_paused'"));
        self::assertTrue($this->connection->fetchOne("SELECT to_regclass('player_character') IS NOT NULL"));
        self::assertSame(1, $this->connection->fetchOne("SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'account' AND column_name = 'active_character_id'"));
    }
    public function testOathOwnershipMigrationEmptiesLocalOathDataAndBindsCharacters(): void
    {
        $a = $this->character(self::ACCOUNT, 1);
        $b = $this->character(self::ACCOUNT, 2);
        $this->migration('Version20260926110000', '--down');
        $restored = false;
        try {
            $preview = $this->connection->fetchOne("INSERT INTO oath_preview (account_id, snapshot, created_at) VALUES (?, '{}', 1800000000) RETURNING id", [self::ACCOUNT]);
            $oath = $this->connection->fetchOne("INSERT INTO oath (account_id, preview_id, snapshot, state, activation_at, deadline, receipt_cutoff, created_at, activated_at) VALUES (?, ?, '{}', 'active', 1800000000, 1800007200, 1800008100, 1800000000, 1800000000) RETURNING id", [self::ACCOUNT, $preview]);
            $this->connection->executeStatement('UPDATE oath_preview SET oath_id = ? WHERE id = ?', [$oath, $preview]);
            $this->connection->executeStatement('INSERT INTO oath_acceptance_request (account_id, request_id, preview_id, oath_id) VALUES (?, ?, ?, ?)', [self::ACCOUNT, $preview, $preview, $oath]);
            $this->migration('Version20260926110000', '--up');
            $restored = true;
        } finally { if (!$restored) { $this->migration('Version20260926110000', '--up'); } }
        foreach (['oath_acceptance_request', 'oath', 'oath_preview'] as $table) { self::assertSame(0, $this->connection->fetchOne('SELECT COUNT(*) FROM '.$table)); }
        self::assertSame(['character_id'], $this->connection->fetchFirstColumn("SELECT column_name FROM information_schema.columns WHERE table_name = 'oath' AND column_name = 'character_id' AND is_nullable = 'NO'"));
        self::assertSame(['oath_character', 'oath_preview_character', 'oath_preview_character_binding', 'oath_preview_owner_character'], $this->connection->fetchFirstColumn("SELECT conname FROM pg_constraint WHERE conname IN ('oath_character', 'oath_preview_character', 'oath_preview_character_binding', 'oath_preview_owner_character') ORDER BY conname"));
        self::assertSame(['CREATE INDEX oath_history_order ON public.oath USING btree (character_id, terminal_at DESC, id DESC)', 'CREATE INDEX oath_today_order ON public.oath USING btree (character_id, deadline, id)'], $this->connection->fetchFirstColumn("SELECT indexdef FROM pg_indexes WHERE indexname IN ('oath_today_order', 'oath_history_order') ORDER BY indexname"));
        $preview = $this->connection->fetchOne("INSERT INTO oath_preview (account_id, character_id, snapshot, created_at) VALUES (?, ?, '{}', 1800000000) RETURNING id", [self::ACCOUNT, $a]);
        $insert = "INSERT INTO oath (account_id, character_id, preview_id, snapshot, state, activation_at, deadline, receipt_cutoff, created_at, activated_at) VALUES (?, ?, ?, '{}', 'active', 1800000000, 1800007200, 1800008100, 1800000000, 1800000000)";
        $this->expectFailure('23503', fn () => $this->connection->executeStatement($insert, [self::ACCOUNT, $b, $preview]));
        $foreign = $this->character(self::OTHER, 1);
        $this->expectFailure('23503', fn () => $this->connection->executeStatement("INSERT INTO oath_preview (account_id, character_id, snapshot, created_at) VALUES (?, ?, '{}', 1800000000)", [self::ACCOUNT, $foreign]));
        $this->connection->executeStatement($insert, [self::ACCOUNT, $a, $preview]);
        $this->connection->executeStatement('DELETE FROM player_character WHERE id = ?', [$b]);
        self::assertSame(1, $this->connection->fetchOne('SELECT COUNT(*) FROM oath'));
    }
    public function testPauseMigrationMovesFlagToCharacter(): void
    {
        $paused = $this->character(self::ACCOUNT, 1);
        $this->character(self::OTHER, 1);
        $this->connection->executeStatement('UPDATE player_character SET paused = TRUE WHERE id = ?', [$paused]);
        $this->migration('Version20260926120000', '--down');
        try {
            self::assertSame([[self::ACCOUNT, true], [self::OTHER, false]], array_map(fn (array $row): array => [$row['id'], $row['gameplay_paused']], $this->connection->fetchAllAssociative('SELECT id, gameplay_paused FROM account ORDER BY id')));
            self::assertSame(0, $this->connection->fetchOne("SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'player_character' AND column_name = 'paused'"));
        } finally { $this->migration('Version20260926120000', '--up'); }
        self::assertSame([[self::ACCOUNT, true], [self::OTHER, false]], array_map(fn (array $row): array => [$row['account_id'], $row['paused']], $this->connection->fetchAllAssociative('SELECT account_id, paused FROM player_character ORDER BY account_id')));
        self::assertSame(0, $this->connection->fetchOne("SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'account' AND column_name = 'gameplay_paused'"));
    }
    private function character(string $account, int $slot, ?string $request = null, string $name = 'Mira', string $form = 'feminine', ?string $build = 'thin'): string
    {
        $values = ['account_id' => $account, 'slot' => $slot, 'creation_request_id' => $request ?? sprintf('00000000-0000-4000-a000-%012d', $slot + 10 * (int) (self::OTHER === $account)), 'name' => $name, 'preset_id' => 'starter_01', 'form' => $form, 'created_at' => 1800000000];
        if (null !== $build) { $values['build'] = $build; }
        return (string) $this->connection->fetchOne('INSERT INTO player_character ('.implode(', ', array_keys($values)).') VALUES ('.implode(', ', array_fill(0, count($values), '?')).') RETURNING id', array_values($values));
    }
    public function testBuildMigrationMakesExistingCharactersThinAndConstrainsBuild(): void
    {
        $this->migration('Version20260927100000', '--down');
        $restored = false;
        try {
            self::assertSame(0, $this->connection->fetchOne("SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'player_character' AND column_name = 'build'"));
            $this->character(self::ACCOUNT, 1, null, 'Mira', 'feminine', null);
            $this->character(self::OTHER, 1, null, 'Nora', 'neutral', null);
            $this->migration('Version20260927100000', '--up');
            $restored = true;
        } finally { if (!$restored) { $this->migration('Version20260927100000', '--up'); } }
        self::assertSame([[self::ACCOUNT, 'thin'], [self::OTHER, 'thin']], array_map(fn (array $row): array => [$row['account_id'], $row['build']], $this->connection->fetchAllAssociative('SELECT account_id, build FROM player_character ORDER BY account_id')));
        self::assertSame(['is_nullable' => 'NO', 'column_default' => null, 'data_type' => 'character varying', 'character_maximum_length' => 16], $this->connection->fetchAssociative("SELECT is_nullable, column_default, data_type, character_maximum_length FROM information_schema.columns WHERE table_name = 'player_character' AND column_name = 'build'"));
        $this->expectFailure('23502', fn () => $this->character(self::ACCOUNT, 2, null, 'Mira', 'feminine', null));
        foreach (['medium', 'Thin', ''] as $build) { $this->expectFailure('23514', fn () => $this->character(self::ACCOUNT, 2, null, 'Mira', 'feminine', $build)); }
        $this->character(self::ACCOUNT, 2, null, 'Mira', 'feminine', 'heavy');
        self::assertSame(['heavy', 'thin'], $this->connection->fetchFirstColumn('SELECT build FROM player_character WHERE account_id = ? ORDER BY build', [self::ACCOUNT]));
    }
    private function expectFailure(string $sqlState, \Closure $operation): void
    {
        $this->connection->beginTransaction();
        try { $operation(); self::fail('Expected SQLSTATE '.$sqlState); }
        catch (DriverException $error) { self::assertSame($sqlState, $error->getSQLState()); }
        finally { $this->connection->rollBack(); }
    }
    private function migration(string $version, string $direction): void
    {
        $process = new Process([PHP_BINARY, 'bin/console', 'doctrine:migrations:execute', 'DoctrineMigrations\\'.$version, $direction, '--env=test', '--no-interaction'], dirname(__DIR__, 2));
        $process->setTimeout(30);
        $process->run();
        self::assertSame(0, $process->getExitCode(), $process->getOutput().$process->getErrorOutput());
    }
}
