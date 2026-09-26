<?php

declare(strict_types=1);
namespace App\Tests\Integration;

use App\Identity\Clock;
use App\Tests\Fixtures\{CharacterFixture, FixedClock};
use Doctrine\DBAL\Connection;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

final class OathReadEndpointTest extends WebTestCase
{
    private Connection $connection;
    private KernelBrowser $client;
    private FixedClock $clock;
    private const ACCOUNT = '00000000-0000-4000-8000-000000000001';
    private const TOKEN = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    protected function setUp(): void
    {
        $this->client = self::createClient();
        $this->client->disableReboot();
        $connection = self::getContainer()->get(Connection::class);
        self::assertInstanceOf(Connection::class, $connection);
        $this->connection = $connection;
        self::assertSame('oathforge_test', $this->connection->fetchOne('SELECT current_database()'));
        $this->connection->executeStatement('TRUNCATE account CASCADE');
        $this->clock = new FixedClock();
        self::getContainer()->set(Clock::class, $this->clock);
        $this->connection->insert('account', ['id' => self::ACCOUNT, 'created_at' => $this->clock->time, 'onboarding_status' => 'complete']);
        $this->connection->insert('app_session', ['token_digest' => hash('sha256', self::TOKEN), 'account_id' => self::ACCOUNT, 'issued_at' => $this->clock->time, 'expires_at' => $this->clock->time + 2592000]);
        CharacterFixture::activate($this->connection, self::ACCOUNT);
    }
    public function testOwnerCanReadExactPersistedCommitment(): void
    {
        $oath = $this->createOath();
        $this->request('GET', '/api/oaths/'.$oath['id']);
        self::assertSame(200, $this->client->getResponse()->getStatusCode());
        self::assertSame($oath, $this->body()['oath']);
        self::assertSame(gmdate('Y-m-d\TH:i:s\Z', $this->clock->time), $this->body()['serverTime']);
    }
    public function testTodayPaginatesStableDeadlineAndIdOrdering(): void
    {
        $ids = [$this->createOath()['id'], $this->createOath()['id'], $this->createOath()['id']];
        sort($ids);
        $this->request('GET', '/api/oaths?limit=2');
        self::assertSame(200, $this->client->getResponse()->getStatusCode());
        self::assertSame(array_slice($ids, 0, 2), array_column($this->body()['items'], 'id'));
        self::assertFalse($this->body()['paused']);
        $cursor = $this->body()['nextCursor'];
        self::assertIsString($cursor);
        $this->request('GET', '/api/oaths?limit=2&cursor='.$cursor);
        self::assertSame([$ids[2]], array_column($this->body()['items'], 'id'));
        self::assertNull($this->body()['nextCursor']);
    }
    public function testFutureAndOverdueItemsRemainTodayWhileTerminalHistorySortsDescending(): void
    {
        $first = $this->createOath()['id']; $second = $this->createOath()['id']; $third = $this->createOath()['id'];
        $this->connection->executeStatement("UPDATE oath SET state = 'scheduled' WHERE id = ?", [$third]);
        $this->connection->executeStatement('UPDATE oath SET deadline = ? WHERE id = ?', [$this->clock->time - 9000, $first]);
        $this->request('GET', '/api/oaths');
        self::assertSame($first, $this->body()['items'][0]['id']);
        self::assertCount(3, $this->body()['items']);
        $this->connection->executeStatement("UPDATE oath SET state = 'withdrawn', terminal_at = ?, reason = 'character_paused' WHERE id IN (?, ?)", [$this->clock->time, $first, $second]);
        $ids = [$first, $second]; rsort($ids);
        $this->request('GET', '/api/oaths?view=history&limit=1');
        self::assertSame([$ids[0]], array_column($this->body()['items'], 'id'));
        $cursor = $this->body()['nextCursor'];
        $this->request('GET', '/api/oaths?view=history&limit=1&cursor='.$cursor);
        self::assertSame([$ids[1]], array_column($this->body()['items'], 'id'));
        self::assertNull($this->body()['nextCursor']);
        $this->request('GET', '/api/oaths');
        self::assertSame([$third], array_column($this->body()['items'], 'id'));
    }
    public function testTotalCountsWholeViewIndependentOfLimitAndCursor(): void
    {
        $ids = []; for ($i = 0; $i < 5; ++$i) { $ids[] = $this->createOath()['id']; }
        $this->connection->executeStatement("UPDATE oath SET state = 'withdrawn', terminal_at = ?, reason = 'character_paused' WHERE id IN (?, ?)", [$this->clock->time, $ids[0], $ids[1]]);
        $this->request('GET', '/api/oaths?view=today&limit=1');
        self::assertSame(3, $this->body()['total']);
        self::assertCount(1, $this->body()['items']);
        $cursor = $this->body()['nextCursor'];
        self::assertIsString($cursor);
        $this->request('GET', '/api/oaths?view=today&limit=1&cursor='.$cursor);
        self::assertSame(3, $this->body()['total']);
        self::assertCount(1, $this->body()['items']);
        $this->request('GET', '/api/oaths?view=history');
        self::assertSame(2, $this->body()['total']);
        self::assertCount(2, $this->body()['items']);
    }
    public function testTotalIgnoresOtherCharacterOfSameAccount(): void
    {
        $active = $this->connection->fetchOne('SELECT active_character_id FROM account WHERE id = ?', [self::ACCOUNT]);
        $ids = [$this->createOath()['id'], $this->createOath()['id']];
        $this->connection->executeStatement("UPDATE oath SET state = 'withdrawn', terminal_at = ?, reason = 'character_paused' WHERE id = ?", [$this->clock->time, $ids[0]]);
        $other = CharacterFixture::activate($this->connection, self::ACCOUNT, 2);
        $foreign = $this->createOath()['id']; for ($i = 0; $i < 3; ++$i) { $this->createOath(); }
        $this->connection->executeStatement("UPDATE oath SET state = 'withdrawn', terminal_at = ?, reason = 'character_paused' WHERE id = ?", [$this->clock->time, $foreign]);
        $this->request('GET', '/api/oaths');
        self::assertSame([3, $other], [$this->body()['total'], $this->body()['characterId']]);
        $this->connection->executeStatement('UPDATE account SET active_character_id = ? WHERE id = ?', [$active, self::ACCOUNT]);
        $this->request('GET', '/api/oaths');
        self::assertSame([1, [$ids[1]]], [$this->body()['total'], array_column($this->body()['items'], 'id')]);
        $this->request('GET', '/api/oaths?view=history');
        self::assertSame([1, [$ids[0]]], [$this->body()['total'], array_column($this->body()['items'], 'id')]);
    }
    public function testTotalCountsReconciledStateAndIsZeroWithoutOaths(): void
    {
        foreach (['today', 'history'] as $view) { $this->request('GET', '/api/oaths?view='.$view); self::assertSame([0, []], [$this->body()['total'], $this->body()['items']]); }
        $oath = $this->createOath()['id']; $terminal = $this->createOath()['id'];
        $this->connection->executeStatement("UPDATE oath SET state = 'withdrawn', terminal_at = ?, reason = 'character_paused' WHERE id = ?", [$this->clock->time, $terminal]);
        $this->clock->time += 10000;
        $this->request('GET', '/api/oaths?limit=1');
        self::assertSame('review_pending', $this->connection->fetchOne('SELECT state FROM oath WHERE id = ?', [$oath]));
        self::assertSame([1, [$oath], ['review_pending']], [$this->body()['total'], array_column($this->body()['items'], 'id'), array_column($this->body()['items'], 'state')]);
        self::assertNull($this->body()['nextCursor']);
        $this->request('GET', '/api/oaths?view=history');
        self::assertSame([1, [$terminal]], [$this->body()['total'], array_column($this->body()['items'], 'id')]);
    }
    public function testPausedIncompleteOwnerKeepsExactSnapshotButOtherAccountCannotReadOrListIt(): void
    {
        $oath = $this->createOath();
        $this->connection->executeStatement("UPDATE account SET onboarding_status = 'pending'");
        $this->connection->executeStatement('UPDATE player_character SET paused = TRUE');
        $this->connection->insert('account_profile', ['account_id' => self::ACCOUNT, 'locale' => 'pl', 'timezone' => 'Europe/Warsaw']);
        $this->request('GET', '/api/oaths/'.$oath['id']);
        self::assertSame($oath, $this->body()['oath']);
        $this->request('GET', '/api/oaths');
        self::assertTrue($this->body()['paused']);
        self::assertSame([$oath], $this->body()['items']);
        $other = '00000000-0000-4000-8000-000000000002';
        $this->connection->insert('account', ['id' => $other, 'created_at' => $this->clock->time]);
        CharacterFixture::activate($this->connection, $other);
        $this->connection->executeStatement('UPDATE app_session SET account_id = ?', [$other]);
        foreach ([$oath['id'], self::ACCOUNT, 'malformed'] as $id) { $this->request('GET', '/api/oaths/'.$id); $this->assertError(404, 'not_found'); }
        $this->request('GET', '/api/oaths');
        self::assertSame([], $this->body()['items']);
        self::assertNull($this->body()['nextCursor']);
    }
    public function testCursorsRejectForeignOwnerWrongViewMalformedAndChangedAnchor(): void
    {
        $first = $this->createOath()['id']; $this->createOath();
        $character = $this->connection->fetchOne('SELECT active_character_id FROM account WHERE id = ?', [self::ACCOUNT]);
        self::assertIsString($character);
        $this->request('GET', '/api/oaths?limit=1');
        $cursor = $this->body()['nextCursor'];
        foreach (['view=history&cursor='.$cursor, 'cursor=garbage', 'cursor='.$cursor.'=', 'cursor='.\App\Oath\OathCursor::encode('00000000-0000-4000-8000-000000000002', $character, 'today', $this->clock->time + 7200, $first), 'cursor='.\App\Oath\OathCursor::encode(self::ACCOUNT, $character, 'today', $this->clock->time, $first)] as $query) {
            $this->request('GET', '/api/oaths?'.$query); $this->assertError(400, 'invalid_request');
        }
        $this->connection->executeStatement("UPDATE oath SET terminal_at = ?, state = 'withdrawn'", [$this->clock->time]);
        $this->request('GET', '/api/oaths?cursor='.$cursor); $this->assertError(400, 'invalid_request');
    }
    /** @return iterable<string, array{string}> */
    public static function invalidQueries(): iterable
    {
        foreach (['view=all', 'view=', 'limit=0', 'limit=101', 'limit=-1', 'limit=01', 'limit=1.5', 'limit=1e1', 'limit=+1', 'limit=9999999999999999999999', 'limit[]=1', 'limit=1&limit=2', 'view=today&%76iew=history', 'cursor=a&cursor=b', 'unknown=1', 'accountId=other', 'cursor=', 'cursor[]=x', 'view', 'limit=1;view=history'] as $query) { yield $query => [$query]; }
    }
    #[\PHPUnit\Framework\Attributes\DataProvider('invalidQueries')]
    public function testInvalidQueriesAreRejected(string $query): void { $this->request('GET', '/api/oaths?'.$query); $this->assertError(400, 'invalid_request'); }
    public function testReadBodiesQueriesAndUnauthenticatedAccessAreDenied(): void
    {
        $oath = $this->createOath();
        foreach (['/api/oaths', '/api/oaths/'.$oath['id']] as $path) {
            $this->request('GET', $path, []); $this->assertError(400, 'invalid_request');
            $this->client->request('GET', $path); $this->assertError(401, 'unauthenticated');
        }
        $this->request('GET', '/api/oaths/'.$oath['id'].'?view=today'); $this->assertError(400, 'invalid_request');
        $this->clock->time += 2592000;
        $this->request('GET', '/api/oaths'); $this->assertError(401, 'unauthenticated');
        $this->request('GET', '/api/oaths/'.$oath['id']); $this->assertError(401, 'unauthenticated');
    }
    public function testOutageReturnsSafeNoStoreErrors(): void
    {
        foreach (['/api/oaths', '/api/oaths/'.self::ACCOUNT] as $path) {
            $process = new \Symfony\Component\Process\Process([PHP_BINARY, 'tests/Fixtures/profile_http_worker.php', 'GET', $path], dirname(__DIR__, 2), ['DATABASE_URL' => 'postgresql://DUMMY:DUMMY-never-log-this@127.0.0.1:1/unavailable?serverVersion=17']);
            $process->setTimeout(10); $process->run();
            self::assertSame(0, $process->getExitCode(), $process->getErrorOutput());
            self::assertSame([503, 'no-store, private', '{"error":{"code":"temporarily_unavailable"}}'], json_decode($process->getOutput(), true, flags: JSON_THROW_ON_ERROR));
            self::assertSame('', $process->getErrorOutput());
        }
    }
    public function testStorageRejectsTerminalStateWithoutTerminalTime(): void
    {
        $this->createOath();
        $this->connection->beginTransaction();
        try {
            $this->expectException(\Doctrine\DBAL\Exception\DriverException::class);
            $this->connection->executeStatement("UPDATE oath SET state = 'withdrawn'");
        } finally { $this->connection->rollBack(); }
    }
    /** @return iterable<string, array{string, string}> */
    public static function lockedReads(): iterable
    {
        foreach (['detail', 'list'] as $mode) { foreach (['account_expiry', 'session_expiry', 'deletion'] as $change) { yield $mode.' '.$change => [$mode, $change]; } }
    }
    #[\PHPUnit\Framework\Attributes\DataProvider('lockedReads')]
    public function testReadsRecheckAuthorizationAfterLocks(string $mode, string $change): void
    {
        $oath = $this->createOath();
        $this->connection->beginTransaction();
        $this->connection->fetchOne('session_expiry' === $change ? 'SELECT token_digest FROM app_session FOR UPDATE' : 'SELECT id FROM account FOR UPDATE');
        $path = tempnam(sys_get_temp_dir(), 'oathforge-DUMMY-read-'); self::assertIsString($path); chmod($path, 0600);
        $data = ['time' => $this->clock->time, 'token' => self::TOKEN, 'mode' => $mode, 'id' => $oath['id']];
        file_put_contents($path, json_encode($data, JSON_THROW_ON_ERROR));
        $worker = new \Symfony\Component\Process\Process([PHP_BINARY, 'tests/Fixtures/oath_read_worker.php', $path], dirname(__DIR__, 2));
        $worker->setTimeout(12); $worker->start();
        try {
            $limit = microtime(true) + 5; $waiting = false;
            do {
                $pid = (int) $worker->getOutput();
                $this->connection->executeQuery('SELECT pg_stat_clear_snapshot()');
                if ($pid > 0 && 'Lock' === $this->connection->fetchOne('SELECT wait_event_type FROM pg_stat_activity WHERE pid = ?', [$pid])) { $waiting = true; break; }
                usleep(10000);
            } while ($worker->isRunning() && microtime(true) < $limit);
            self::assertTrue($waiting, 'Read worker did not reach lock: '.$worker->getErrorOutput());
            if ('deletion' === $change) { $this->connection->executeStatement("UPDATE account SET status = 'deleting'"); }
            else { $data['time'] += 2592000; file_put_contents($path, json_encode($data, JSON_THROW_ON_ERROR)); }
            $this->connection->commit(); $worker->wait();
            self::assertSame(0, $worker->getExitCode(), $worker->getErrorOutput());
            self::assertSame('', $worker->getErrorOutput());
            self::assertSame(['error' => ['code' => 'unauthenticated']], json_decode(explode("\n", $worker->getOutput(), 2)[1], true, flags: JSON_THROW_ON_ERROR));
        } finally {
            $worker->stop();
            if ($this->connection->isTransactionActive()) { $this->connection->rollBack(); }
            unlink($path);
        }
    }
    private function assertError(int $status, string $code): void
    {
        self::assertSame($status, $this->client->getResponse()->getStatusCode());
        self::assertSame(['error' => ['code' => $code]], $this->body());
        self::assertResponseHeaderSame('Cache-Control', 'no-store, private');
    }
    /** @return array<string, mixed> */
    private function createOath(): array
    {
        $this->request('POST', '/api/oath-previews', $this->input());
        $preview = $this->body()['preview']['id'];
        $this->request('POST', '/api/oaths', ['previewId' => $preview, 'requestId' => $preview, 'accepted' => true]);
        return $this->body()['oath'];
    }
    /** @return array<string, mixed> */
    private function input(): array { return ['activity' => 'running', 'activation' => ['mode' => 'now'], 'deadline' => ['local' => gmdate('Y-m-d\TH:i:s', $this->clock->time + 7200), 'timezone' => 'UTC']]; }
    /** @param array<string, mixed>|null $input */
    private function request(string $method, string $path, ?array $input = null): void { $this->client->request($method, $path, server: ['HTTP_AUTHORIZATION' => 'Bearer '.self::TOKEN, 'CONTENT_TYPE' => 'application/json'], content: null === $input ? '' : json_encode($input, JSON_THROW_ON_ERROR)); }
    /** @return array<string, mixed> */
    private function body(): array { return json_decode((string) $this->client->getResponse()->getContent(), true, flags: JSON_THROW_ON_ERROR); }
}
