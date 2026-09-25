<?php

declare(strict_types=1);
namespace App\Tests\Integration;

use App\Identity\Clock;
use App\Tests\Fixtures\FixedClock;
use Doctrine\DBAL\Connection;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

final class OathPreviewEndpointTest extends WebTestCase
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
    }
    public function testCompletedAccountCanCreateAnImmutablePreview(): void
    {
        $this->request('POST', '/api/oath-previews', $this->input());
        self::assertResponseStatusCodeSame(201);
        $body = $this->body();
        self::assertSame('running', $body['preview']['snapshot']['activity']);
        self::assertSame(['mode' => 'now', 'time' => null], $body['preview']['snapshot']['activation']);
        $this->request('GET', '/api/oath-previews/'.$body['preview']['id']);
        self::assertResponseIsSuccessful();
        self::assertSame($body['preview'], $this->body()['preview']);
        self::assertNull($this->body()['oathId']);
    }
    public function testScheduledActivitiesAndSnapshotSurviveProfileChangesAndPause(): void
    {
        foreach (['strength_training', 'mobility'] as $activity) {
            $input = $this->input();
            $input['activity'] = $activity;
            $input['activation'] = ['mode' => 'scheduled', 'time' => ['local' => gmdate('Y-m-d\TH:i:s', $this->clock->time + 3600), 'timezone' => 'UTC']];
            $this->request('POST', '/api/oath-previews', $input);
            self::assertSame(201, $this->client->getResponse()->getStatusCode());
            $preview = $this->body()['preview'];
            self::assertSame($activity, $preview['snapshot']['activity']);
            self::assertArrayNotHasKey('receiptCutoff', $preview['snapshot']['activation']['time']);
            self::assertSame(gmdate('Y-m-d\TH:i:s\Z', $this->clock->time + 8100), $preview['snapshot']['deadline']['receiptCutoff']);
        }
        $stored = $this->connection->fetchOne('SELECT snapshot FROM oath_preview WHERE id = ?', [$preview['id']]);
        $this->connection->executeStatement("UPDATE account SET gameplay_paused = TRUE, onboarding_status = 'pending'");
        $this->connection->insert('account_profile', ['account_id' => self::ACCOUNT, 'locale' => 'pl', 'timezone' => 'Europe/Warsaw']);
        $this->request('GET', '/api/oath-previews/'.$preview['id']);
        self::assertSame($preview, $this->body()['preview']);
        self::assertSame($stored, $this->connection->fetchOne('SELECT snapshot FROM oath_preview WHERE id = ?', [$preview['id']]));
    }

    /** @return iterable<string, array{string, int, string, ?string}> */
    public static function invalidInputs(): iterable
    {
        foreach (['null', '[]', '{}', '{', '{"activity":42,"activation":{"mode":"now"},"deadline":{}}', '{"activity":"running","activation":[],"deadline":{}}'] as $i => $body) { yield 'shape'.$i => [$body, 400, 'invalid_request', null]; }
        $base = ['activity' => 'running', 'activation' => ['mode' => 'now'], 'deadline' => ['local' => '2099-01-01T10:00:00', 'timezone' => 'UTC']];
        foreach (['accountId', 'state', 'rewards'] as $field) { yield $field => [json_encode($base + [$field => 'fake'], JSON_THROW_ON_ERROR), 400, 'invalid_request', null]; }
        yield 'activity' => [json_encode(array_replace($base, ['activity' => 'walking']), JSON_THROW_ON_ERROR), 400, 'invalid_activity', null];
        foreach ([['local' => '2026-02-30T10:00:00', 'timezone' => 'UTC'], ['local' => '2026-03-29T02:30:00', 'timezone' => 'Europe/Warsaw'], ['local' => '2026-10-25T02:30:00', 'timezone' => 'Europe/Warsaw']] as $i => $time) {
            yield 'date'.$i => [json_encode(array_replace($base, ['deadline' => $time]), JSON_THROW_ON_ERROR), 400, ['invalid_local_time', 'nonexistent_local_time', 'ambiguous_local_time'][$i], 'deadline'];
        }
        foreach ([['mode' => 'now', 'time' => null], ['mode' => 'scheduled'], ['mode' => false], ['mode' => 'scheduled', 'time' => []]] as $i => $activation) { yield 'activation'.$i => [json_encode(array_replace($base, ['activation' => $activation]), JSON_THROW_ON_ERROR), 400, 'invalid_request', null]; }
    }
    #[\PHPUnit\Framework\Attributes\DataProvider('invalidInputs')]
    public function testInvalidInputCannotWrite(string $body, int $status, string $code, ?string $field): void
    {
        $this->client->request('POST', '/api/oath-previews', server: ['HTTP_AUTHORIZATION' => 'Bearer '.self::TOKEN, 'CONTENT_TYPE' => 'application/json'], content: $body);
        $this->assertError($status, $code);
        if (null !== $field) { self::assertSame($field, $this->body()['error']['field']); }
        if ('ambiguous_local_time' === $code) { self::assertSame(['+02:00', '+01:00'], $this->body()['error']['validOffsets']); }
        self::assertSame(0, $this->connection->fetchOne('SELECT COUNT(*) FROM oath_preview'));
    }
    public function testTransportBoundsAndQueries(): void
    {
        foreach ([['text/plain', '{}', 415, 'unsupported_media_type'], ['text/plain', str_repeat('x', 16385), 413, 'request_too_large']] as [$type, $body, $status, $code]) {
            $this->client->request('POST', '/api/oath-previews', server: ['HTTP_AUTHORIZATION' => 'Bearer '.self::TOKEN, 'CONTENT_TYPE' => $type], content: $body);
            $this->assertError($status, $code);
        }
        $this->request('POST', '/api/oath-previews?accountId=other', $this->input());
        $this->assertError(400, 'invalid_request');
        $this->request('GET', '/api/oath-previews/not-an-id', ['fake' => true]);
        $this->assertError(400, 'invalid_request');
    }
    public function testExactTimingBoundaries(): void
    {
        $input = $this->input();
        $input['deadline']['local'] = gmdate('Y-m-d\TH:i:s', $this->clock->time);
        $this->request('POST', '/api/oath-previews', $input);
        $this->assertError(409, 'deadline_not_after_activation');
        $input = $this->input();
        $input['activation'] = ['mode' => 'scheduled', 'time' => ['local' => gmdate('Y-m-d\TH:i:s', $this->clock->time), 'timezone' => 'UTC']];
        $this->request('POST', '/api/oath-previews', $input);
        $this->assertError(409, 'activation_elapsed');
        $input['activation']['time'] = $input['deadline'];
        $this->request('POST', '/api/oath-previews', $input);
        $this->assertError(409, 'deadline_not_after_activation');
        self::assertSame(0, $this->connection->fetchOne('SELECT COUNT(*) FROM oath_preview'));
    }
    public function testIncompletePausedExpiredMissingAndInactiveAccountsCannotCreate(): void
    {
        $this->connection->executeStatement("UPDATE account SET onboarding_status = 'pending'");
        $this->request('POST', '/api/oath-previews', $this->input());
        $this->assertError(409, 'onboarding_incomplete');
        $this->connection->executeStatement("UPDATE account SET onboarding_status = 'complete', gameplay_paused = TRUE");
        $this->request('POST', '/api/oath-previews', $this->input());
        $this->assertError(409, 'account_paused');
        foreach ([null, 'Bearer short'] as $header) {
            $this->client->request('POST', '/api/oath-previews', server: ['CONTENT_TYPE' => 'application/json'] + (null === $header ? [] : ['HTTP_AUTHORIZATION' => $header]), content: json_encode($this->input(), JSON_THROW_ON_ERROR));
            $this->assertError(401, 'unauthenticated');
        }
        $this->clock->time += 2592000;
        $this->request('POST', '/api/oath-previews', $this->input());
        $this->assertError(401, 'unauthenticated');
        $this->clock->time -= 2592000;
        $this->connection->executeStatement("UPDATE account SET status = 'deleting'");
        $this->request('POST', '/api/oath-previews', $this->input());
        $this->assertError(401, 'unauthenticated');
        self::assertSame(0, $this->connection->fetchOne('SELECT COUNT(*) FROM oath_preview'));
    }
    public function testReadsAreOwnerOnlyAndRequireActiveSession(): void
    {
        $this->request('POST', '/api/oath-previews', $this->input());
        $id = $this->body()['preview']['id'];
        $other = '00000000-0000-4000-8000-000000000002';
        $this->connection->insert('account', ['id' => $other, 'created_at' => $this->clock->time]);
        $this->connection->executeStatement('UPDATE oath_preview SET account_id = ?', [$other]);
        foreach ([$id, self::ACCOUNT, 'malformed'] as $target) {
            $this->request('GET', '/api/oath-previews/'.$target);
            $this->assertError(404, 'not_found');
        }
        $this->clock->time += 2592000;
        $this->request('GET', '/api/oath-previews/'.$id);
        $this->assertError(401, 'unauthenticated');
    }
    public function testDatabaseWriteFailureRollsBackPreview(): void
    {
        $this->connection->executeStatement('ALTER TABLE oath_preview ADD CONSTRAINT dummy_preview_failure CHECK (created_at < 0) NOT VALID');
        try {
            $this->request('POST', '/api/oath-previews', $this->input());
            $this->assertError(503, 'temporarily_unavailable');
            self::assertSame(0, $this->connection->fetchOne('SELECT COUNT(*) FROM oath_preview'));
        } finally { $this->connection->executeStatement('ALTER TABLE oath_preview DROP CONSTRAINT dummy_preview_failure'); }
    }
    public function testDatabaseOutageReturnsSafeReadError(): void
    {
        $process = new \Symfony\Component\Process\Process([PHP_BINARY, 'tests/Fixtures/profile_http_worker.php', 'GET', '/api/oath-previews/'.self::ACCOUNT], dirname(__DIR__, 2), ['DATABASE_URL' => 'postgresql://DUMMY:DUMMY-never-log-this@127.0.0.1:1/unavailable?serverVersion=17']);
        $process->setTimeout(10);
        $process->run();
        self::assertSame(0, $process->getExitCode(), $process->getErrorOutput());
        self::assertSame([503, 'no-store, private', '{"error":{"code":"temporarily_unavailable"}}'], json_decode($process->getOutput(), true, flags: JSON_THROW_ON_ERROR));
        self::assertSame('', $process->getErrorOutput());
    }
    /** @return iterable<string, array{string}> */
    public static function lockChanges(): iterable
    {
        foreach (['account_expiry', 'session_expiry', 'read_expiry', 'revocation', 'deletion', 'pause', 'activation_elapsed', 'deadline_elapsed'] as $change) { yield $change => [$change]; }
    }
    #[\PHPUnit\Framework\Attributes\DataProvider('lockChanges')]
    public function testLockedWaitUsesFreshAuthorizationAndTime(string $change): void
    {
        $input = ['time' => $this->clock->time, 'token' => self::TOKEN, 'preview' => $this->input()];
        if ('activation_elapsed' === $change) { $input['preview']['activation'] = ['mode' => 'scheduled', 'time' => ['local' => gmdate('Y-m-d\TH:i:s', $this->clock->time + 3600), 'timezone' => 'UTC']]; }
        if ('read_expiry' === $change) {
            $this->request('POST', '/api/oath-previews', $this->input());
            $input['id'] = $this->body()['preview']['id'];
        }
        $this->connection->beginTransaction();
        $this->connection->fetchOne('session_expiry' === $change ? 'SELECT token_digest FROM app_session FOR UPDATE' : 'SELECT id FROM account FOR UPDATE');
        $path = tempnam(sys_get_temp_dir(), 'oathforge-DUMMY-preview-');
        self::assertIsString($path);
        chmod($path, 0600);
        file_put_contents($path, json_encode($input, JSON_THROW_ON_ERROR));
        $worker = new \Symfony\Component\Process\Process([PHP_BINARY, 'tests/Fixtures/oath_preview_worker.php', $path], dirname(__DIR__, 2));
        $worker->setTimeout(12);
        $worker->start();
        try {
            $limit = microtime(true) + 5;
            $waiting = false;
            do {
                $pid = (int) $worker->getOutput();
                $this->connection->executeQuery('SELECT pg_stat_clear_snapshot()');
                if ($pid > 0 && 'Lock' === $this->connection->fetchOne('SELECT wait_event_type FROM pg_stat_activity WHERE pid = ?', [$pid])) { $waiting = true; break; }
                usleep(10000);
            } while ($worker->isRunning() && microtime(true) < $limit);
            self::assertTrue($waiting, 'Preview worker did not reach lock: '.$worker->getErrorOutput());
            $code = 'unauthenticated';
            if (str_contains($change, 'expiry')) { $input['time'] += 2592000; }
            elseif ('revocation' === $change) { $this->connection->executeStatement('UPDATE app_session SET revoked_at = ?', [$input['time']]); }
            elseif ('deletion' === $change) { $this->connection->executeStatement("UPDATE account SET status = 'deleting'"); }
            elseif ('pause' === $change) { $this->connection->executeStatement('UPDATE account SET gameplay_paused = TRUE'); $code = 'account_paused'; }
            elseif ('activation_elapsed' === $change) { $input['time'] += 3600; $code = 'activation_elapsed'; }
            else { $input['time'] += 7200; $code = 'deadline_not_after_activation'; }
            file_put_contents($path, json_encode($input, JSON_THROW_ON_ERROR));
            $this->connection->commit();
            $worker->wait();
            self::assertSame(0, $worker->getExitCode(), $worker->getErrorOutput());
            self::assertSame('', $worker->getErrorOutput());
            self::assertSame(['error' => ['code' => $code]], json_decode(explode("\n", $worker->getOutput(), 2)[1], true, flags: JSON_THROW_ON_ERROR));
            self::assertSame('read_expiry' === $change ? 1 : 0, $this->connection->fetchOne('SELECT COUNT(*) FROM oath_preview'));
        } finally {
            $worker->stop();
            if ($this->connection->isTransactionActive()) { $this->connection->rollBack(); }
            unlink($path);
        }
    }
    private function assertError(int $status, string $code): void
    {
        self::assertSame($status, $this->client->getResponse()->getStatusCode());
        self::assertSame($code, $this->body()['error']['code']);
        self::assertResponseHeaderSame('Cache-Control', 'no-store, private');
    }
    /** @return array<string, mixed> */
    private function input(): array { return ['activity' => 'running', 'activation' => ['mode' => 'now'], 'deadline' => ['local' => gmdate('Y-m-d\TH:i:s', $this->clock->time + 7200), 'timezone' => 'UTC']]; }
    /** @param array<string, mixed>|null $input */
    private function request(string $method, string $path, ?array $input = null): void { $this->client->request($method, $path, server: ['HTTP_AUTHORIZATION' => 'Bearer '.self::TOKEN, 'CONTENT_TYPE' => 'application/json'], content: null === $input ? '' : json_encode($input, JSON_THROW_ON_ERROR)); }
    /** @return array<string, mixed> */
    private function body(): array { return json_decode((string) $this->client->getResponse()->getContent(), true, flags: JSON_THROW_ON_ERROR); }
}
