<?php

declare(strict_types=1);
namespace App\Tests\Integration;

use App\Identity\Clock;
use App\Tests\Fixtures\FixedClock;
use Doctrine\DBAL\Connection;
use PHPUnit\Framework\Attributes\DataProvider;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\Process\Process;

final class CharacterEndpointTest extends WebTestCase
{
    private Connection $connection;
    private KernelBrowser $client;
    private FixedClock $clock;
    private const ACCOUNT = '00000000-0000-4000-8000-000000000001';
    private const OTHER = '00000000-0000-4000-8000-000000000009';
    private const TOKEN = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    private const PRESETS = ['dummy_braid', 'dummy_cropped', 'dummy_curly', 'dummy_tied'];
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
    }
    public function testListingWithoutCharactersReturnsEmptyEnvelopeWithCatalog(): void
    {
        $this->request('GET', '/api/characters');
        self::assertSame(200, $this->client->getResponse()->getStatusCode());
        self::assertResponseHeaderSame('Cache-Control', 'no-store, private');
        self::assertSame(['characters' => [], 'activeCharacterId' => null, 'limit' => 3, 'presets' => self::PRESETS, 'serverTime' => gmdate('Y-m-d\TH:i:s\Z', $this->clock->time)], $this->body());
    }
    public function testCreatingFirstCharacterActivatesIt(): void
    {
        $this->create(self::rid(1), '  Mira  ');
        self::assertSame(201, $this->client->getResponse()->getStatusCode());
        self::assertResponseHeaderSame('Cache-Control', 'no-store, private');
        $body = $this->body();
        $id = $body['character']['id'];
        self::assertMatchesRegularExpression('/\A[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\z/', $id);
        $character = ['id' => $id, 'name' => 'Mira', 'presetId' => 'dummy_braid', 'form' => 'feminine', 'createdAt' => gmdate('Y-m-d\TH:i:s\Z', $this->clock->time)];
        self::assertSame(['character' => $character, 'activeCharacterId' => $id, 'serverTime' => gmdate('Y-m-d\TH:i:s\Z', $this->clock->time)], $body);
        self::assertSame([['slot' => 1, 'creation_request_id' => self::rid(1), 'name' => 'Mira', 'created_at' => $this->clock->time]], $this->connection->fetchAllAssociative('SELECT slot, creation_request_id, name, created_at FROM player_character'));
        self::assertSame($id, $this->connection->fetchOne('SELECT active_character_id FROM account WHERE id = ?', [self::ACCOUNT]));
        $this->clock->time += 60;
        $this->request('GET', '/api/characters');
        self::assertSame(['characters' => [$character], 'activeCharacterId' => $id, 'limit' => 3, 'presets' => self::PRESETS, 'serverTime' => gmdate('Y-m-d\TH:i:s\Z', $this->clock->time)], $this->body());
    }
    public function testIdenticalReplayReturnsOriginalCharacterAndCurrentActiveWithoutChange(): void
    {
        $this->create(self::rid(1), "Zo\u{00E9}", 'dummy_curly', 'neutral');
        $first = $this->body()['character'];
        $created = $this->clock->time;
        foreach (["Zo\u{00E9}", " Zoe\u{0301}\u{00A0}"] as $name) {
            $this->clock->time += 10;
            $this->create(self::rid(1), $name, 'dummy_curly', 'neutral');
            self::assertSame(200, $this->client->getResponse()->getStatusCode());
            self::assertSame(['character' => $first, 'activeCharacterId' => $first['id'], 'serverTime' => gmdate('Y-m-d\TH:i:s\Z', $this->clock->time)], $this->body());
        }
        self::assertSame(gmdate('Y-m-d\TH:i:s\Z', $created), $first['createdAt']);
        $this->create(self::rid(2), 'Nora');
        $second = $this->body()['character']['id'];
        $this->create(self::rid(1), "Zo\u{00E9}", 'dummy_curly', 'neutral');
        self::assertSame(200, $this->client->getResponse()->getStatusCode());
        self::assertSame($first, $this->body()['character']);
        self::assertSame($second, $this->body()['activeCharacterId']);
        self::assertSame($second, $this->connection->fetchOne('SELECT active_character_id FROM account'));
        self::assertSame(2, $this->connection->fetchOne('SELECT COUNT(*) FROM player_character'));
    }
    public function testChangedPayloadUnderSameRequestConflictsWithoutChange(): void
    {
        $this->create(self::rid(1));
        $id = $this->body()['character']['id'];
        foreach ([['Nora', 'dummy_braid', 'feminine'], ['Mira', 'dummy_tied', 'feminine'], ['Mira', 'dummy_braid', 'neutral'], ['Mira', 'dummy_unknown', 'feminine']] as [$name, $preset, $form]) {
            $this->create(self::rid(1), $name, $preset, $form);
            $this->assertError(409, 'idempotency_conflict');
        }
        self::assertSame([['id' => $id, 'name' => 'Mira', 'preset_id' => 'dummy_braid', 'form' => 'feminine']], $this->connection->fetchAllAssociative('SELECT id, name, preset_id, form FROM player_character'));
        self::assertSame($id, $this->connection->fetchOne('SELECT active_character_id FROM account'));
    }
    public function testReplaySkipsCatalogAndOnboardingChecks(): void
    {
        $this->create(self::rid(1));
        $id = $this->body()['character']['id'];
        $this->connection->executeStatement("UPDATE player_character SET preset_id = 'retired_preset'");
        $this->connection->executeStatement("UPDATE account SET onboarding_status = 'pending'");
        $this->create(self::rid(1), 'Mira', 'retired_preset');
        self::assertSame(200, $this->client->getResponse()->getStatusCode());
        self::assertSame(['id' => $id, 'presetId' => 'retired_preset'], array_intersect_key($this->body()['character'], ['id' => 1, 'presetId' => 1]));
        $this->request('GET', '/api/characters');
        self::assertSame('retired_preset', $this->body()['characters'][0]['presetId']);
        self::assertSame(self::PRESETS, $this->body()['presets']);
    }
    public function testLimitRejectsFourthCreationButReplaysThird(): void
    {
        $ids = [];
        foreach ([1, 2, 3] as $n) {
            $this->create(self::rid($n), 'Mira', self::PRESETS[$n]);
            self::assertSame(201, $this->client->getResponse()->getStatusCode());
            $ids[] = $this->body()['character']['id'];
        }
        self::assertSame([[1, $ids[0]], [2, $ids[1]], [3, $ids[2]]], array_map(fn (array $row): array => [$row['slot'], $row['id']], $this->connection->fetchAllAssociative('SELECT slot, id FROM player_character ORDER BY slot')));
        $this->create(self::rid(4));
        $this->assertError(409, 'character_limit_reached');
        self::assertSame(3, $this->connection->fetchOne('SELECT COUNT(*) FROM player_character'));
        self::assertSame($ids[2], $this->connection->fetchOne('SELECT active_character_id FROM account'));
        $this->create(self::rid(3), 'Mira', self::PRESETS[3]);
        self::assertSame(200, $this->client->getResponse()->getStatusCode());
        self::assertSame($ids[2], $this->body()['character']['id']);
        $this->request('GET', '/api/characters');
        self::assertSame($ids, array_column($this->body()['characters'], 'id'));
    }
    public function testNewCreationChecksPresetThenOnboarding(): void
    {
        $this->connection->executeStatement("UPDATE account SET onboarding_status = 'pending'");
        $this->create(self::rid(1), 'Mira', 'dummy_unknown');
        $this->assertError(400, 'invalid_preset');
        $this->create(self::rid(1));
        $this->assertError(409, 'onboarding_incomplete');
        self::assertSame(0, $this->connection->fetchOne('SELECT COUNT(*) FROM player_character'));
        self::assertNull($this->connection->fetchOne('SELECT active_character_id FROM account'));
    }
    /** @return iterable<string, array{string, int, string}> */
    public static function invalidBodies(): iterable
    {
        $base = ['requestId' => self::rid(1), 'name' => 'Mira', 'presetId' => 'dummy_braid', 'form' => 'feminine'];
        foreach (['A', 'Anna  Maria', 'Anna-', '-Anna', 'R2D2', str_repeat('a', 21), "Mira\u{1F600}", 'Anna--Maria', '', '   '] as $i => $name) {
            yield 'name-'.$i => [json_encode(array_replace($base, ['name' => $name]), JSON_THROW_ON_ERROR), 400, 'invalid_character_name'];
        }
        yield 'unknown-preset' => [json_encode(array_replace($base, ['presetId' => 'dummy_unknown']), JSON_THROW_ON_ERROR), 400, 'invalid_preset'];
        $changes = [['form' => 'other'], ['form' => null], ['form' => 'Feminine'], ['name' => 42], ['name' => ['Mira']], ['presetId' => 5], ['presetId' => ''], ['presetId' => 'Dummy-Braid'], ['presetId' => str_repeat('a', 65)], ['requestId' => strtoupper(self::rid(1))], ['requestId' => 'not-a-uuid'], ['requestId' => null], ['accountId' => self::ACCOUNT], ['slot' => 1]];
        foreach ($changes as $i => $change) { yield 'shape-'.$i => [json_encode(array_replace($base, $change), JSON_THROW_ON_ERROR), 400, 'invalid_request']; }
        foreach (['requestId', 'name', 'presetId', 'form'] as $field) {
            $missing = $base; unset($missing[$field]);
            yield 'missing-'.$field => [json_encode($missing, JSON_THROW_ON_ERROR), 400, 'invalid_request'];
        }
        foreach (['', '{', '[]', 'null', '{}', '"Mira"', json_encode(['character' => $base], JSON_THROW_ON_ERROR)] as $i => $body) { yield 'body-'.$i => [$body, 400, 'invalid_request']; }
    }
    #[DataProvider('invalidBodies')]
    public function testInvalidCreationInputIsRejectedWithoutWrite(string $body, int $status, string $code): void
    {
        $this->client->request('POST', '/api/characters', server: ['HTTP_AUTHORIZATION' => 'Bearer '.self::TOKEN, 'CONTENT_TYPE' => 'application/json'], content: $body);
        $this->assertError($status, $code);
        self::assertSame(0, $this->connection->fetchOne('SELECT COUNT(*) FROM player_character'));
        self::assertNull($this->connection->fetchOne('SELECT active_character_id FROM account'));
    }
    public function testTransportLimitsAndStrictGet(): void
    {
        $valid = json_encode(['requestId' => self::rid(1), 'name' => 'Mira', 'presetId' => 'dummy_braid', 'form' => 'feminine'], JSON_THROW_ON_ERROR);
        foreach ([['text/plain', $valid, 415, 'unsupported_media_type'], ['application/json', str_repeat(' ', 16385), 413, 'request_too_large']] as [$type, $body, $status, $code]) {
            $this->client->request('POST', '/api/characters', server: ['HTTP_AUTHORIZATION' => 'Bearer '.self::TOKEN, 'CONTENT_TYPE' => $type], content: $body);
            $this->assertError($status, $code);
        }
        $this->client->request('POST', '/api/characters?fake=1', server: ['HTTP_AUTHORIZATION' => 'Bearer '.self::TOKEN, 'CONTENT_TYPE' => 'application/json'], content: $valid);
        $this->assertError(400, 'invalid_request');
        $this->request('GET', '/api/characters?limit=5'); $this->assertError(400, 'invalid_request');
        $this->client->request('GET', '/api/characters', server: ['HTTP_AUTHORIZATION' => 'Bearer '.self::TOKEN], content: '{}');
        $this->assertError(400, 'invalid_request');
        self::assertSame(0, $this->connection->fetchOne('SELECT COUNT(*) FROM player_character'));
    }
    public function testInvalidSessionsAreUnauthenticatedWithoutWrite(): void
    {
        $valid = json_encode(['requestId' => self::rid(1), 'name' => 'Mira', 'presetId' => 'dummy_braid', 'form' => 'feminine'], JSON_THROW_ON_ERROR);
        $cases = [
            'missing' => [[], null],
            'malformed' => [['HTTP_AUTHORIZATION' => 'Bearer short'], null],
            'unknown' => [['HTTP_AUTHORIZATION' => 'Bearer '.str_repeat('B', 43)], null],
            'expired' => [null, fn () => $this->clock->time += 2592000],
            'revoked' => [null, fn () => $this->connection->executeStatement('UPDATE app_session SET revoked_at = ?', [$this->clock->time])],
            'deleting' => [null, fn () => $this->connection->executeStatement("UPDATE account SET status = 'deleting'")],
        ];
        foreach ($cases as [$server, $change]) {
            $time = $this->clock->time;
            if (null !== $change) { $change(); }
            foreach (['GET' => '', 'POST' => $valid] as $method => $body) {
                $this->client->request($method, '/api/characters', server: ($server ?? ['HTTP_AUTHORIZATION' => 'Bearer '.self::TOKEN]) + ['CONTENT_TYPE' => 'application/json'], content: $body);
                $this->assertError(401, 'unauthenticated');
            }
            $this->clock->time = $time;
            $this->connection->executeStatement("UPDATE account SET status = 'active'");
            $this->connection->executeStatement('UPDATE app_session SET revoked_at = NULL');
        }
        self::assertSame(0, $this->connection->fetchOne('SELECT COUNT(*) FROM player_character'));
    }
    public function testDatabaseFailureRollsBackCreationAndAllowsSameRetry(): void
    {
        $this->connection->executeStatement('ALTER TABLE account ADD CONSTRAINT dummy_active_failure CHECK (active_character_id IS NULL) NOT VALID');
        try {
            $this->create(self::rid(1));
            $this->assertError(503, 'temporarily_unavailable');
            self::assertSame(0, $this->connection->fetchOne('SELECT COUNT(*) FROM player_character'));
            self::assertNull($this->connection->fetchOne('SELECT active_character_id FROM account'));
        } finally { $this->connection->executeStatement('ALTER TABLE account DROP CONSTRAINT dummy_active_failure'); }
        $this->create(self::rid(1));
        self::assertSame(201, $this->client->getResponse()->getStatusCode());
    }
    /** The 503 comes from the firewall session check, which reads the database before the controller runs. */
    public function testOutageReturnsSafeNoStoreErrors(): void
    {
        foreach (['GET', 'POST'] as $method) {
            $process = new Process([PHP_BINARY, 'tests/Fixtures/profile_http_worker.php', $method, '/api/characters'], dirname(__DIR__, 2), ['DATABASE_URL' => 'postgresql://DUMMY:DUMMY-never-log-this@127.0.0.1:1/unavailable?serverVersion=17']);
            $process->setTimeout(10); $process->run();
            self::assertSame(0, $process->getExitCode(), $process->getErrorOutput());
            self::assertSame([503, 'no-store, private', '{"error":{"code":"temporarily_unavailable"}}'], json_decode($process->getOutput(), true, flags: JSON_THROW_ON_ERROR));
            self::assertSame('', $process->getErrorOutput());
        }
    }
    public function testAccountDeletionCascadesToCharacters(): void
    {
        $this->create(self::rid(1));
        $this->create(self::rid(2), 'Nora');
        self::assertNotNull($this->connection->fetchOne('SELECT active_character_id FROM account'));
        $this->connection->executeStatement('DELETE FROM app_session WHERE account_id = ?', [self::ACCOUNT]);
        $this->connection->executeStatement('DELETE FROM account WHERE id = ?', [self::ACCOUNT]);
        self::assertSame(0, $this->connection->fetchOne('SELECT COUNT(*) FROM player_character'));
    }
    public function testCharactersAreAccountScopedAndCreationWritesNothingElse(): void
    {
        $this->connection->insert('account', ['id' => self::OTHER, 'created_at' => $this->clock->time, 'onboarding_status' => 'complete']);
        $this->connection->insert('player_character', ['account_id' => self::OTHER, 'slot' => 1, 'creation_request_id' => self::rid(1), 'name' => 'Obca', 'preset_id' => 'dummy_tied', 'form' => 'feminine', 'created_at' => $this->clock->time]);
        $this->connection->insert('account_profile', ['account_id' => self::ACCOUNT, 'locale' => 'pl', 'timezone' => 'Europe/Warsaw']);
        $this->request('POST', '/api/oath-previews', json_encode(['activity' => 'running', 'activation' => ['mode' => 'now'], 'deadline' => ['local' => gmdate('Y-m-d\TH:i:s', $this->clock->time + 7200), 'timezone' => 'UTC']], JSON_THROW_ON_ERROR));
        $preview = $this->body()['preview']['id'];
        $this->request('POST', '/api/oaths', json_encode(['previewId' => $preview, 'requestId' => self::rid(7), 'accepted' => true], JSON_THROW_ON_ERROR));
        self::assertSame(201, $this->client->getResponse()->getStatusCode());
        $before = $this->snapshot();
        $this->request('GET', '/api/characters');
        self::assertSame([], $this->body()['characters']);
        $this->create(self::rid(1));
        self::assertSame(201, $this->client->getResponse()->getStatusCode());
        $id = $this->body()['character']['id'];
        $this->request('GET', '/api/characters');
        self::assertSame([$id], array_column($this->body()['characters'], 'id'));
        self::assertSame($before, $this->snapshot());
        self::assertSame(2, $this->connection->fetchOne('SELECT COUNT(*) FROM player_character'));
        self::assertNull($this->connection->fetchOne('SELECT active_character_id FROM account WHERE id = ?', [self::OTHER]));
    }
    public function testConcurrentCreationsForLastSlotAllowExactlyOne(): void
    {
        $this->create(self::rid(1));
        $this->create(self::rid(2), 'Nora');
        $this->connection->beginTransaction();
        $this->connection->fetchOne('SELECT id FROM account WHERE id = ? FOR UPDATE', [self::ACCOUNT]);
        [$first, $firstPath] = $this->worker(self::rid(3), 'Wanda');
        [$second, $secondPath] = $this->worker(self::rid(4), 'Zofia');
        try {
            $this->assertWaiting($first);
            $this->assertWaiting($second);
            $this->connection->commit();
            $results = [$this->workerResult($first), $this->workerResult($second)];
            $created = array_values(array_filter($results, fn (array $result): bool => true === ($result['created'] ?? null)));
            $rejected = array_values(array_filter($results, fn (array $result): bool => ['error' => ['code' => 'character_limit_reached']] === $result));
            self::assertCount(1, $created);
            self::assertCount(1, $rejected);
            self::assertSame([1, 2, 3], array_map('intval', $this->connection->fetchFirstColumn('SELECT slot FROM player_character ORDER BY slot')));
            $winner = true === ($results[0]['created'] ?? null) ? $results[0] : $results[1];
            self::assertSame($winner['body']['character']['id'], $this->connection->fetchOne('SELECT active_character_id FROM account'));
        } finally {
            $first->stop(); $second->stop();
            if ($this->connection->isTransactionActive()) { $this->connection->rollBack(); }
            unlink($firstPath); unlink($secondPath);
        }
    }
    public function testConcurrentIdenticalRetriesCreateOneCharacter(): void
    {
        $this->connection->beginTransaction();
        $this->connection->fetchOne('SELECT id FROM account WHERE id = ? FOR UPDATE', [self::ACCOUNT]);
        [$first, $firstPath] = $this->worker(self::rid(1), 'Mira');
        [$second, $secondPath] = $this->worker(self::rid(1), 'Mira');
        try {
            $this->assertWaiting($first);
            $this->assertWaiting($second);
            $this->connection->commit();
            $one = $this->workerResult($first);
            $two = $this->workerResult($second);
            self::assertEqualsCanonicalizing([true, false], [$one['created'], $two['created']]);
            self::assertSame($one['body']['character'], $two['body']['character']);
            self::assertSame(1, $this->connection->fetchOne('SELECT COUNT(*) FROM player_character'));
            self::assertSame($one['body']['character']['id'], $this->connection->fetchOne('SELECT active_character_id FROM account'));
        } finally {
            $first->stop(); $second->stop();
            if ($this->connection->isTransactionActive()) { $this->connection->rollBack(); }
            unlink($firstPath); unlink($secondPath);
        }
    }
    /** @return iterable<string, array{string}> */
    public static function lockChanges(): iterable
    {
        foreach (['session_expiry', 'revocation', 'deletion', 'onboarding'] as $change) { yield $change => [$change]; }
    }
    #[DataProvider('lockChanges')]
    public function testCreationRechecksAfterAccountLock(string $change): void
    {
        $this->connection->beginTransaction();
        $this->connection->fetchOne('SELECT id FROM account WHERE id = ? FOR UPDATE', [self::ACCOUNT]);
        [$worker, $path, $data] = $this->worker(self::rid(1), 'Mira');
        try {
            $this->assertWaiting($worker);
            $code = 'unauthenticated';
            if ('session_expiry' === $change) { $data['time'] += 2592000; }
            elseif ('revocation' === $change) { $this->connection->executeStatement('UPDATE app_session SET revoked_at = ?', [$data['time']]); }
            elseif ('deletion' === $change) { $this->connection->executeStatement("UPDATE account SET status = 'deleting'"); }
            else { $this->connection->executeStatement("UPDATE account SET onboarding_status = 'pending'"); $code = 'onboarding_incomplete'; }
            file_put_contents($path, json_encode($data, JSON_THROW_ON_ERROR));
            $this->connection->commit();
            self::assertSame(['error' => ['code' => $code]], $this->workerResult($worker));
            self::assertSame(0, $this->connection->fetchOne('SELECT COUNT(*) FROM player_character'));
        } finally {
            $worker->stop();
            if ($this->connection->isTransactionActive()) { $this->connection->rollBack(); }
            unlink($path);
        }
    }
    /** @return array<string, mixed> */
    private function snapshot(): array
    {
        $tables = [];
        foreach (['oath_preview', 'oath', 'oath_acceptance_request', 'account_profile', 'app_session'] as $table) { $tables[$table] = $this->connection->fetchAllAssociative('SELECT row_to_json(t)::text AS row FROM '.$table.' t ORDER BY 1'); }
        $tables['account'] = $this->connection->fetchAllAssociative("SELECT (to_jsonb(a) - 'active_character_id')::text AS row FROM account a ORDER BY 1");
        return $tables;
    }
    /** @return array{Process, string, array<string, mixed>} */
    private function worker(string $requestId, string $name): array
    {
        $path = tempnam(sys_get_temp_dir(), 'oathforge-DUMMY-character-');
        self::assertIsString($path);
        chmod($path, 0600);
        $data = ['time' => $this->clock->time, 'token' => self::TOKEN, 'input' => ['requestId' => $requestId, 'name' => $name, 'presetId' => 'dummy_braid', 'form' => 'feminine']];
        file_put_contents($path, json_encode($data, JSON_THROW_ON_ERROR));
        $worker = new Process([PHP_BINARY, 'tests/Fixtures/character_creation_worker.php', $path], dirname(__DIR__, 2));
        $worker->setTimeout(12); $worker->start();
        return [$worker, $path, $data];
    }
    private function assertWaiting(Process $worker): void
    {
        $limit = microtime(true) + 5;
        do {
            $pid = (int) $worker->getOutput();
            $this->connection->executeQuery('SELECT pg_stat_clear_snapshot()');
            if ($pid > 0 && 'Lock' === $this->connection->fetchOne('SELECT wait_event_type FROM pg_stat_activity WHERE pid = ?', [$pid])) { self::assertTrue($worker->isRunning()); return; }
            usleep(10000);
        } while ($worker->isRunning() && microtime(true) < $limit);
        self::fail('Character worker did not reach lock: '.$worker->getErrorOutput());
    }
    /** @return array<string, mixed> */
    private function workerResult(Process $worker): array
    {
        $worker->wait();
        self::assertSame(0, $worker->getExitCode(), $worker->getErrorOutput());
        self::assertSame('', $worker->getErrorOutput());
        return json_decode(explode("\n", $worker->getOutput(), 2)[1], true, flags: JSON_THROW_ON_ERROR);
    }
    private static function rid(int $n): string { return sprintf('00000000-0000-4000-a000-%012d', $n); }
    private function create(string $requestId, string $name = 'Mira', string $presetId = 'dummy_braid', string $form = 'feminine'): void
    {
        $this->request('POST', '/api/characters', json_encode(['requestId' => $requestId, 'name' => $name, 'presetId' => $presetId, 'form' => $form], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE));
    }
    private function request(string $method, string $path, string $body = ''): void { $this->client->request($method, $path, server: ['HTTP_AUTHORIZATION' => 'Bearer '.self::TOKEN, 'CONTENT_TYPE' => 'application/json'], content: $body); }
    private function assertError(int $status, string $code): void
    {
        self::assertSame($status, $this->client->getResponse()->getStatusCode(), (string) $this->client->getResponse()->getContent());
        self::assertSame(['error' => ['code' => $code]], $this->body());
        self::assertResponseHeaderSame('Cache-Control', 'no-store, private');
    }
    /** @return array<string, mixed> */
    private function body(): array { return json_decode((string) $this->client->getResponse()->getContent(), true, flags: JSON_THROW_ON_ERROR); }
}
