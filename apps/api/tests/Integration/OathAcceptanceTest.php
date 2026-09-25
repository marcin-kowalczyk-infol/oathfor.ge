<?php

declare(strict_types=1);
namespace App\Tests\Integration;

use App\Identity\Clock;
use App\Tests\Fixtures\FixedClock;
use Doctrine\DBAL\Connection;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

final class OathAcceptanceTest extends WebTestCase
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
    public function testAcceptingNowCreatesOneActiveCommitment(): void
    {
        $this->request('POST', '/api/oath-previews', $this->input());
        $preview = $this->body()['preview'];
        $this->request('POST', '/api/oaths', ['previewId' => $preview['id'], 'requestId' => self::ACCOUNT, 'accepted' => true]);
        self::assertSame(201, $this->client->getResponse()->getStatusCode());
        $oath = $this->body()['oath'];
        self::assertSame('active', $oath['state']);
        self::assertSame($preview['snapshot']['deadline'], $oath['snapshot']['deadline']);
        self::assertSame(gmdate('Y-m-d\TH:i:s\Z', $this->clock->time), $oath['activatedAt']);
        self::assertSame(1, $this->connection->fetchOne('SELECT COUNT(*) FROM oath'));
        $this->request('GET', '/api/oath-previews/'.$preview['id']);
        self::assertSame($oath['id'], $this->body()['oathId']);
    }
    public function testScheduledSnapshotIsCopiedExactly(): void
    {
        $input = $this->input();
        $input['activation'] = ['mode' => 'scheduled', 'time' => ['local' => gmdate('Y-m-d\TH:i:s', $this->clock->time + 3600), 'timezone' => 'UTC']];
        $this->request('POST', '/api/oath-previews', $input);
        $preview = $this->body()['preview'];
        $this->accept($preview['id']);
        self::assertSame(201, $this->client->getResponse()->getStatusCode());
        self::assertSame('scheduled', $this->body()['oath']['state']);
        self::assertNull($this->body()['oath']['activatedAt']);
        self::assertSame($preview['snapshot'], $this->body()['oath']['snapshot']);
        self::assertSame($this->connection->fetchOne('SELECT snapshot FROM oath_preview'), $this->connection->fetchOne('SELECT snapshot FROM oath'));
    }
    public function testNowUsesLockedAcceptanceTimeAndDeadlineZoneWithoutMutatingPreview(): void
    {
        $input = $this->input();
        $input['deadline'] = ['local' => '2099-01-01T20:00:00', 'timezone' => 'Europe/Warsaw'];
        $this->request('POST', '/api/oath-previews', $input);
        $preview = $this->body()['preview'];
        $this->clock->time += 30;
        $this->accept($preview['id']);
        $expected = (new \DateTimeImmutable('@'.$this->clock->time))->setTimezone(new \DateTimeZone('Europe/Warsaw'));
        self::assertSame(['local' => $expected->format('Y-m-d\TH:i:s'), 'timezone' => 'Europe/Warsaw', 'offset' => $expected->format('P'), 'explicitOffset' => false, 'utc' => gmdate('Y-m-d\TH:i:s\Z', $this->clock->time)], $this->body()['oath']['snapshot']['activation']['time']);
        self::assertSame($preview['snapshot'], json_decode($this->connection->fetchOne('SELECT snapshot FROM oath_preview'), true, flags: JSON_THROW_ON_ERROR));
    }
    public function testResponseLossReplayAndNewIdentityReturnSameCurrentCommitmentAfterPauseAndPolicyChange(): void
    {
        $id = $this->preview();
        $this->accept($id);
        $oath = $this->body()['oath'];
        $this->clock->time += 10000;
        $this->connection->executeStatement("UPDATE account SET gameplay_paused = TRUE, onboarding_status = 'pending'");
        $this->connection->executeStatement("UPDATE oath SET state = 'withdrawn', terminal_at = ?, reason = 'account_paused'", [$this->clock->time]);
        $snapshot = json_decode($this->connection->fetchOne('SELECT snapshot FROM oath_preview'), true, flags: JSON_THROW_ON_ERROR);
        $snapshot['policyVersion'] = 'DUMMY-replaced';
        $this->connection->executeStatement('UPDATE oath_preview SET snapshot = ?', [json_encode($snapshot, JSON_THROW_ON_ERROR)]);
        foreach ([self::ACCOUNT, '00000000-0000-4000-8000-000000000002'] as $request) {
            $this->accept($id, $request);
            self::assertSame(200, $this->client->getResponse()->getStatusCode());
            self::assertSame($oath['id'], $this->body()['oath']['id']);
            self::assertSame($oath['snapshot'], $this->body()['oath']['snapshot']);
            self::assertSame('withdrawn', $this->body()['oath']['state']);
        }
        self::assertSame(1, $this->connection->fetchOne('SELECT COUNT(*) FROM oath'));
        self::assertSame(2, $this->connection->fetchOne('SELECT COUNT(*) FROM oath_acceptance_request'));
        $this->clock->time += 2592000;
        $this->accept($id);
        $this->assertError(401, 'unauthenticated');
    }
    public function testChangedPreviewUnderRequestConflictsAndForeignPreviewIsNotFound(): void
    {
        $first = $this->preview();
        $second = $this->preview();
        $this->accept($first);
        $this->accept($second);
        $this->assertError(409, 'idempotency_conflict');
        $other = '00000000-0000-4000-8000-000000000002';
        $this->connection->insert('account', ['id' => $other, 'created_at' => $this->clock->time]);
        $this->connection->executeStatement('UPDATE oath_preview SET account_id = ? WHERE id = ?', [$other, $second]);
        foreach ([$second, self::ACCOUNT] as $id) {
            $this->accept($id, $other);
            $this->assertError(404, 'not_found');
        }
        self::assertSame(1, $this->connection->fetchOne('SELECT COUNT(*) FROM oath'));
        self::assertSame(1, $this->connection->fetchOne('SELECT COUNT(*) FROM oath_acceptance_request'));
    }
    public function testNewAcceptanceRequiresCompleteUnpausedCurrentPolicyAndValidTiming(): void
    {
        $id = $this->preview();
        $this->connection->executeStatement("UPDATE account SET onboarding_status = 'pending'");
        $this->accept($id); $this->assertError(409, 'onboarding_incomplete');
        $this->connection->executeStatement("UPDATE account SET onboarding_status = 'complete', gameplay_paused = TRUE");
        $this->accept($id); $this->assertError(409, 'account_paused');
        $this->connection->executeStatement('UPDATE account SET gameplay_paused = FALSE');
        $snapshot = json_decode($this->connection->fetchOne('SELECT snapshot FROM oath_preview'), true, flags: JSON_THROW_ON_ERROR);
        foreach (['templateVersion', 'policyVersion'] as $field) {
            $changed = array_replace($snapshot, [$field => 'DUMMY-replaced']);
            $this->connection->executeStatement('UPDATE oath_preview SET snapshot = ?', [json_encode($changed, JSON_THROW_ON_ERROR)]);
            $this->accept($id); $this->assertError(409, 'preview_superseded');
        }
        $this->connection->executeStatement('UPDATE oath_preview SET snapshot = ?', [json_encode($snapshot, JSON_THROW_ON_ERROR)]);
        $this->clock->time += 7200;
        $this->accept($id); $this->assertError(409, 'deadline_not_after_activation');
        self::assertSame(0, $this->connection->fetchOne('SELECT COUNT(*) FROM oath'));
        self::assertSame(0, $this->connection->fetchOne('SELECT COUNT(*) FROM oath_acceptance_request'));
    }
    public function testMappingFailureRollsBackOathAndAllowsSameRetryIdentity(): void
    {
        $id = $this->preview();
        $this->connection->executeStatement('ALTER TABLE oath_acceptance_request ADD CONSTRAINT dummy_mapping_failure CHECK (FALSE) NOT VALID');
        try {
            $this->accept($id); $this->assertError(503, 'temporarily_unavailable');
            self::assertSame(0, $this->connection->fetchOne('SELECT COUNT(*) FROM oath'));
            self::assertSame(0, $this->connection->fetchOne('SELECT COUNT(*) FROM oath_acceptance_request'));
            self::assertNull($this->connection->fetchOne('SELECT oath_id FROM oath_preview'));
        } finally { $this->connection->executeStatement('ALTER TABLE oath_acceptance_request DROP CONSTRAINT dummy_mapping_failure'); }
        $this->accept($id);
        self::assertSame(201, $this->client->getResponse()->getStatusCode());
    }
    public function testStrictAcceptanceInputAndTransport(): void
    {
        $base = ['previewId' => $this->preview(), 'requestId' => self::ACCOUNT, 'accepted' => true];
        foreach ([[], ['accepted' => false], ['accepted' => 'true'], ['requestId' => 'A0000000-0000-4000-8000-000000000001'], ['previewId' => 5], ['accountId' => self::ACCOUNT], ['snapshot' => []]] as $i => $change) {
            $this->request('POST', '/api/oaths', 0 === $i ? [] : array_replace($base, $change));
            $this->assertError(400, 'invalid_request');
        }
        $this->request('POST', '/api/oaths?fake=1', $base); $this->assertError(400, 'invalid_request');
        foreach ([['text/plain', '{}', 415, 'unsupported_media_type'], ['text/plain', str_repeat('x', 16385), 413, 'request_too_large'], ['application/json', '[', 400, 'invalid_request']] as [$type, $body, $status, $code]) {
            $this->client->request('POST', '/api/oaths', server: ['HTTP_AUTHORIZATION' => 'Bearer '.self::TOKEN, 'CONTENT_TYPE' => $type], content: $body);
            $this->assertError($status, $code);
        }
        self::assertSame(0, $this->connection->fetchOne('SELECT COUNT(*) FROM oath'));
    }
    /** @return iterable<string, array{string}> */
    public static function lockChanges(): iterable
    {
        foreach (['account_expiry', 'session_expiry', 'revocation', 'deletion', 'pause', 'activation_elapsed', 'deadline_elapsed', 'now_time'] as $change) { yield $change => [$change]; }
    }
    #[\PHPUnit\Framework\Attributes\DataProvider('lockChanges')]
    public function testAcceptanceRechecksAfterAccountAndSessionLocks(string $change): void
    {
        $previewInput = $this->input();
        if ('activation_elapsed' === $change) { $previewInput['activation'] = ['mode' => 'scheduled', 'time' => ['local' => gmdate('Y-m-d\TH:i:s', $this->clock->time + 3600), 'timezone' => 'UTC']]; }
        $this->request('POST', '/api/oath-previews', $previewInput);
        $id = $this->body()['preview']['id'];
        $this->connection->beginTransaction();
        $this->connection->fetchOne('session_expiry' === $change ? 'SELECT token_digest FROM app_session FOR UPDATE' : 'SELECT id FROM account FOR UPDATE');
        [$worker, $path, $data] = $this->worker($id, self::ACCOUNT);
        try {
            $this->assertWaiting($worker);
            $code = 'unauthenticated';
            if (str_contains($change, 'expiry')) { $data['time'] += 2592000; }
            elseif ('revocation' === $change) { $this->connection->executeStatement('UPDATE app_session SET revoked_at = ?', [$data['time']]); }
            elseif ('deletion' === $change) { $this->connection->executeStatement("UPDATE account SET status = 'deleting'"); }
            elseif ('pause' === $change) { $this->connection->executeStatement('UPDATE account SET gameplay_paused = TRUE'); $code = 'account_paused'; }
            elseif ('activation_elapsed' === $change) { $data['time'] += 3600; $code = 'activation_elapsed'; }
            elseif ('now_time' === $change) { $data['time'] += 30; }
            else { $data['time'] += 7200; $code = 'deadline_not_after_activation'; }
            file_put_contents($path, json_encode($data, JSON_THROW_ON_ERROR));
            $this->connection->commit();
            $result = $this->workerResult($worker);
            if ('now_time' === $change) {
                self::assertTrue($result['created']);
                self::assertSame(gmdate('Y-m-d\TH:i:s\Z', $data['time']), $result['body']['oath']['activatedAt']);
            } else {
                self::assertSame(['error' => ['code' => $code]], $result);
                self::assertSame(0, $this->connection->fetchOne('SELECT COUNT(*) FROM oath'));
                self::assertSame(0, $this->connection->fetchOne('SELECT COUNT(*) FROM oath_acceptance_request'));
            }
        } finally {
            $worker->stop();
            if ($this->connection->isTransactionActive()) { $this->connection->rollBack(); }
            unlink($path);
        }
    }
    public function testConcurrentConfirmationsCreateOneOathAndBindBothIdentities(): void
    {
        $id = $this->preview();
        $this->connection->beginTransaction();
        $this->connection->fetchOne('SELECT id FROM account FOR UPDATE');
        [$first, $firstPath] = $this->worker($id, self::ACCOUNT);
        [$second, $secondPath] = $this->worker($id, '00000000-0000-4000-8000-000000000002');
        try {
            $this->assertWaiting($first);
            $this->assertWaiting($second);
            $this->connection->commit();
            $one = $this->workerResult($first);
            $two = $this->workerResult($second);
            self::assertNotSame($one['created'], $two['created']);
            self::assertSame($one['body']['oath'], $two['body']['oath']);
            self::assertSame(1, $this->connection->fetchOne('SELECT COUNT(*) FROM oath'));
            self::assertSame(2, $this->connection->fetchOne('SELECT COUNT(*) FROM oath_acceptance_request'));
        } finally {
            $first->stop(); $second->stop();
            if ($this->connection->isTransactionActive()) { $this->connection->rollBack(); }
            unlink($firstPath); unlink($secondPath);
        }
    }
    /** @return array{\Symfony\Component\Process\Process, string, array<string, mixed>} */
    private function worker(string $previewId, string $requestId): array
    {
        $path = tempnam(sys_get_temp_dir(), 'oathforge-DUMMY-acceptance-');
        self::assertIsString($path);
        chmod($path, 0600);
        $data = ['time' => $this->clock->time, 'token' => self::TOKEN, 'input' => ['previewId' => $previewId, 'requestId' => $requestId, 'accepted' => true]];
        file_put_contents($path, json_encode($data, JSON_THROW_ON_ERROR));
        $worker = new \Symfony\Component\Process\Process([PHP_BINARY, 'tests/Fixtures/oath_acceptance_worker.php', $path], dirname(__DIR__, 2));
        $worker->setTimeout(12); $worker->start();
        return [$worker, $path, $data];
    }
    private function assertWaiting(\Symfony\Component\Process\Process $worker): void
    {
        $limit = microtime(true) + 5;
        do {
            $pid = (int) $worker->getOutput();
            $this->connection->executeQuery('SELECT pg_stat_clear_snapshot()');
            if ($pid > 0 && 'Lock' === $this->connection->fetchOne('SELECT wait_event_type FROM pg_stat_activity WHERE pid = ?', [$pid])) { self::assertTrue($worker->isRunning()); return; }
            usleep(10000);
        } while ($worker->isRunning() && microtime(true) < $limit);
        self::fail('Acceptance worker did not reach lock: '.$worker->getErrorOutput());
    }
    /** @return array<string, mixed> */
    private function workerResult(\Symfony\Component\Process\Process $worker): array
    {
        $worker->wait();
        self::assertSame(0, $worker->getExitCode(), $worker->getErrorOutput());
        self::assertSame('', $worker->getErrorOutput());
        return json_decode(explode("\n", $worker->getOutput(), 2)[1], true, flags: JSON_THROW_ON_ERROR);
    }
    private function preview(): string { $this->request('POST', '/api/oath-previews', $this->input()); return $this->body()['preview']['id']; }
    private function accept(string $previewId, string $requestId = self::ACCOUNT): void { $this->request('POST', '/api/oaths', ['previewId' => $previewId, 'requestId' => $requestId, 'accepted' => true]); }
    private function assertError(int $status, string $code): void
    {
        self::assertSame($status, $this->client->getResponse()->getStatusCode());
        self::assertSame(['error' => ['code' => $code]], $this->body());
        self::assertResponseHeaderSame('Cache-Control', 'no-store, private');
    }
    /** @return array<string, mixed> */
    private function input(): array { return ['activity' => 'running', 'activation' => ['mode' => 'now'], 'deadline' => ['local' => gmdate('Y-m-d\TH:i:s', $this->clock->time + 7200), 'timezone' => 'UTC']]; }
    /** @param array<string, mixed>|null $input */
    private function request(string $method, string $path, ?array $input = null): void { $this->client->request($method, $path, server: ['HTTP_AUTHORIZATION' => 'Bearer '.self::TOKEN, 'CONTENT_TYPE' => 'application/json'], content: null === $input ? '' : json_encode($input, JSON_THROW_ON_ERROR)); }
    /** @return array<string, mixed> */
    private function body(): array { return json_decode((string) $this->client->getResponse()->getContent(), true, flags: JSON_THROW_ON_ERROR); }
}
