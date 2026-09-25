<?php

declare(strict_types=1);
namespace App\Tests\Integration;

use App\Identity\Clock;
use App\Tests\Fixtures\FixedClock;
use Doctrine\DBAL\Connection;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

final class PauseEndpointTest extends WebTestCase
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
    public function testConfirmedPauseWithdrawsCurrentCommitments(): void
    {
        $oath = $this->createOath();
        $this->request('GET', '/api/oath-pause');
        self::assertSame(200, $this->client->getResponse()->getStatusCode());
        $preview = $this->body();
        self::assertSame([$oath['id']], $preview['withdraw']);
        $this->request('POST', '/api/oath-pause', ['paused' => true, 'revision' => $preview['revision']]);
        self::assertSame(200, $this->client->getResponse()->getStatusCode());
        self::assertTrue($this->body()['paused']);
        self::assertSame([], $this->body()['withdraw']);
        $this->request('GET', '/api/oaths/'.$oath['id']);
        self::assertSame('withdrawn', $this->body()['oath']['state']);
        self::assertSame('account_paused', $this->body()['oath']['reason']);
    }
    public function testExactCutoffWithdrawsButElapsedCutoffIsPreservedAfterReconciliation(): void
    {
        $oath = $this->createOath(); $base = $this->clock->time;
        $this->clock->time = $base + 8100;
        $this->request('GET', '/api/oath-pause');
        self::assertSame([$oath['id']], $this->body()['withdraw']);
        $revision = $this->body()['revision'];
        $this->clock->time++;
        $this->request('POST', '/api/oath-pause', ['paused' => true, 'revision' => $revision]);
        $this->assertError(409, 'pause_preview_changed');
        self::assertFalse($this->connection->fetchOne('SELECT gameplay_paused FROM account'));
        $this->request('GET', '/api/oath-pause');
        self::assertSame([], $this->body()['withdraw']);
        self::assertSame([$oath['id']], $this->body()['preserve']);
        $revision = $this->body()['revision'];
        $before = $this->connection->fetchAssociative('SELECT * FROM oath');
        $this->request('POST', '/api/oath-pause', ['paused' => true, 'revision' => $revision]);
        self::assertTrue($this->body()['paused']);
        self::assertSame($before, $this->connection->fetchAssociative('SELECT * FROM oath'));
    }
    public function testAtCutoffPauseAndResumeNeverRestoreCommitment(): void
    {
        $oath = $this->createOath(); $this->clock->time += 8100;
        $this->request('GET', '/api/oath-pause'); $revision = $this->body()['revision'];
        $this->request('POST', '/api/oath-pause', ['paused' => true, 'revision' => $revision]);
        $withdrawn = $this->connection->fetchAssociative('SELECT * FROM oath');
        self::assertIsArray($withdrawn);
        self::assertSame('withdrawn', $withdrawn['state']);
        self::assertSame($this->clock->time, $withdrawn['terminal_at']);
        $this->clock->time += 30;
        $this->request('POST', '/api/oath-pause', ['paused' => true, 'revision' => $revision]);
        self::assertTrue($this->body()['paused']);
        for ($attempt = 0; $attempt < 2; $attempt++) {
            $this->request('POST', '/api/oath-pause', ['paused' => false]);
            self::assertFalse($this->body()['paused']);
            self::assertSame([], $this->body()['withdraw']);
        }
        self::assertSame($withdrawn, $this->connection->fetchAssociative('SELECT * FROM oath'));
        self::assertSame($oath['snapshot'], json_decode($withdrawn['snapshot'], true, flags: JSON_THROW_ON_ERROR));
    }
    public function testChangedAffectedSetRequiresNewRevisionAndBlocksCreationWhilePaused(): void
    {
        $this->createOath();
        $this->request('GET', '/api/oath-pause'); $revision = $this->body()['revision'];
        $this->createOath();
        $this->request('POST', '/api/oath-pause', ['paused' => true, 'revision' => $revision]);
        $this->assertError(409, 'pause_preview_changed');
        self::assertSame(2, $this->connection->fetchOne("SELECT COUNT(*) FROM oath WHERE state = 'scheduled'"));
        self::assertFalse($this->connection->fetchOne('SELECT gameplay_paused FROM account'));
        $this->request('GET', '/api/oath-pause');
        self::assertCount(2, $this->body()['withdraw']); $revision = $this->body()['revision'];
        $this->request('POST', '/api/oath-pause', ['paused' => true, 'revision' => $revision]);
        $this->request('POST', '/api/oath-previews', $this->input()); $this->assertError(409, 'account_paused');
    }
    public function testPreservedAndTerminalFixturesRemainUnchangedAndForeignOwnerCannotUseRevision(): void
    {
        $preserve = [];
        foreach (['proof_pending', 'needs_more_evidence', 'review_pending', 'fulfilled', 'missed', 'unresolved', 'withdrawn'] as $state) {
            $id = $this->createOath()['id'];
            $terminal = in_array($state, ['fulfilled', 'missed', 'unresolved', 'withdrawn'], true);
            if (!$terminal) { $preserve[] = $id; }
            $this->connection->executeStatement('UPDATE oath SET state = ?, terminal_at = ? WHERE id = ?', [$state, $terminal ? $this->clock->time : null, $id]);
        }
        sort($preserve);
        $before = $this->connection->fetchAllAssociative('SELECT * FROM oath ORDER BY id');
        $this->request('GET', '/api/oath-pause');
        self::assertSame($preserve, $this->body()['preserve']); self::assertSame([], $this->body()['withdraw']);
        $revision = $this->body()['revision'];
        $this->request('POST', '/api/oath-pause', ['paused' => true, 'revision' => $revision]);
        self::assertSame($before, $this->connection->fetchAllAssociative('SELECT * FROM oath ORDER BY id'));
        $other = '00000000-0000-4000-8000-000000000002';
        $this->connection->insert('account', ['id' => $other, 'created_at' => $this->clock->time]);
        $this->connection->executeStatement('UPDATE app_session SET account_id = ?', [$other]);
        $this->request('GET', '/api/oath-pause');
        self::assertSame([], $this->body()['preserve']); self::assertSame([], $this->body()['withdraw']);
        $this->request('POST', '/api/oath-pause', ['paused' => true, 'revision' => $revision]); $this->assertError(409, 'pause_preview_changed');
        self::assertFalse($this->connection->fetchOne('SELECT gameplay_paused FROM account WHERE id = ?', [$other]));
    }
    public function testStrictPayloadTransportAndAuthentication(): void
    {
        foreach ([[], ['paused' => 'true'], ['paused' => true], ['paused' => true, 'revision' => 'fake'], ['paused' => false, 'revision' => str_repeat('a', 64)], ['paused' => false, 'accountId' => self::ACCOUNT]] as $input) {
            $this->request('POST', '/api/oath-pause', $input); $this->assertError(400, 'invalid_request');
        }
        $this->request('GET', '/api/oath-pause?fake=1'); $this->assertError(400, 'invalid_request');
        $this->request('GET', '/api/oath-pause', []); $this->assertError(400, 'invalid_request');
        foreach ([['text/plain', '{}', 415, 'unsupported_media_type'], ['application/json', str_repeat('x', 16385), 413, 'request_too_large']] as [$type, $body, $status, $code]) {
            $this->client->request('POST', '/api/oath-pause', server: ['HTTP_AUTHORIZATION' => 'Bearer '.self::TOKEN, 'CONTENT_TYPE' => $type], content: $body); $this->assertError($status, $code);
        }
        $this->client->request('GET', '/api/oath-pause'); $this->assertError(401, 'unauthenticated');
        $this->clock->time += 2592000;
        $this->request('POST', '/api/oath-pause', ['paused' => false]); $this->assertError(401, 'unauthenticated');
    }
    public function testFailedPauseRollsBackWithdrawalAndAccountFlag(): void
    {
        $this->createOath();
        $this->request('GET', '/api/oath-pause'); $revision = $this->body()['revision'];
        $this->connection->executeStatement('ALTER TABLE account ADD CONSTRAINT dummy_pause_failure CHECK (gameplay_paused = FALSE) NOT VALID');
        try {
            $this->request('POST', '/api/oath-pause', ['paused' => true, 'revision' => $revision]); $this->assertError(503, 'temporarily_unavailable');
            self::assertFalse($this->connection->fetchOne('SELECT gameplay_paused FROM account'));
            self::assertSame('scheduled', $this->connection->fetchOne('SELECT state FROM oath'));
            self::assertNull($this->connection->fetchOne('SELECT terminal_at FROM oath'));
        } finally { $this->connection->executeStatement('ALTER TABLE account DROP CONSTRAINT dummy_pause_failure'); }
    }
    /** @return iterable<string, array{string}> */
    public static function lockKinds(): iterable { foreach (['account', 'session', 'oath'] as $kind) { yield $kind => [$kind]; } }
    #[\PHPUnit\Framework\Attributes\DataProvider('lockKinds')]
    public function testPauseRechecksExpiryAfterEveryBlockingLock(string $kind): void
    {
        $this->createOath();
        $this->request('GET', '/api/oath-pause'); $revision = $this->body()['revision'];
        $before = $this->connection->fetchAssociative('SELECT * FROM oath');
        $this->connection->beginTransaction();
        $this->connection->fetchOne(match ($kind) { 'account' => 'SELECT id FROM account FOR UPDATE', 'session' => 'SELECT token_digest FROM app_session FOR UPDATE', default => 'SELECT id FROM oath FOR UPDATE' });
        $data = ['time' => $this->clock->time, 'token' => self::TOKEN, 'input' => ['paused' => true, 'revision' => $revision]];
        [$worker, $path] = $this->worker('oath_pause_worker.php', $data);
        try {
            $this->assertWaiting($worker);
            $data['time'] += 2592000; file_put_contents($path, json_encode($data, JSON_THROW_ON_ERROR));
            $this->connection->commit();
            self::assertSame(['error' => ['code' => 'unauthenticated']], $this->workerResult($worker));
            self::assertSame($before, $this->connection->fetchAssociative('SELECT * FROM oath'));
            self::assertFalse($this->connection->fetchOne('SELECT gameplay_paused FROM account'));
        } finally {
            $worker->stop(); if ($this->connection->isTransactionActive()) { $this->connection->rollBack(); } unlink($path);
        }
    }
    public function testAcceptanceCommittedBeforeWaitingPauseInvalidatesRevision(): void
    {
        $this->createOath();
        $this->request('POST', '/api/oath-previews', $this->input()); $preview = $this->body()['preview']['id'];
        $this->request('GET', '/api/oath-pause'); $revision = $this->body()['revision'];
        $this->connection->beginTransaction(); $this->connection->fetchOne('SELECT id FROM account FOR UPDATE');
        [$worker, $path] = $this->worker('oath_pause_worker.php', ['time' => $this->clock->time, 'token' => self::TOKEN, 'input' => ['paused' => true, 'revision' => $revision]]);
        try {
            $this->assertWaiting($worker);
            $input = \App\Oath\AcceptanceInput::parse(['previewId' => $preview, 'requestId' => $preview, 'accepted' => true]); self::assertInstanceOf(\App\Oath\AcceptanceInput::class, $input);
            $service = self::getContainer()->get(\App\Oath\AcceptanceService::class); self::assertInstanceOf(\App\Oath\AcceptanceService::class, $service);
            self::assertInstanceOf(\App\Oath\AcceptanceResult::class, $service->accept(self::TOKEN, $input));
            $this->connection->commit();
            self::assertSame(['error' => ['code' => 'pause_preview_changed']], $this->workerResult($worker));
            self::assertSame(2, $this->connection->fetchOne("SELECT COUNT(*) FROM oath WHERE state = 'scheduled'"));
            self::assertFalse($this->connection->fetchOne('SELECT gameplay_paused FROM account'));
        } finally {
            $worker->stop(); if ($this->connection->isTransactionActive()) { $this->connection->rollBack(); } unlink($path);
        }
    }
    public function testPauseCommittedBeforeWaitingAcceptancePreventsCreation(): void
    {
        $this->createOath();
        $this->request('POST', '/api/oath-previews', $this->input()); $preview = $this->body()['preview']['id'];
        $this->request('GET', '/api/oath-pause'); $revision = $this->body()['revision'];
        $this->connection->beginTransaction(); $this->connection->fetchOne('SELECT id FROM account FOR UPDATE');
        [$worker, $path] = $this->worker('oath_acceptance_worker.php', ['time' => $this->clock->time, 'token' => self::TOKEN, 'input' => ['previewId' => $preview, 'requestId' => $preview, 'accepted' => true]]);
        try {
            $this->assertWaiting($worker);
            $input = \App\Oath\PauseInput::parse(['paused' => true, 'revision' => $revision]); self::assertInstanceOf(\App\Oath\PauseInput::class, $input);
            $service = self::getContainer()->get(\App\Oath\PauseService::class); self::assertInstanceOf(\App\Oath\PauseService::class, $service);
            self::assertIsArray($service->access(self::TOKEN, $input));
            $this->connection->commit();
            self::assertSame(['error' => ['code' => 'account_paused']], $this->workerResult($worker));
            self::assertSame(1, $this->connection->fetchOne('SELECT COUNT(*) FROM oath'));
            self::assertSame('withdrawn', $this->connection->fetchOne('SELECT state FROM oath'));
            self::assertSame(1, $this->connection->fetchOne('SELECT COUNT(*) FROM oath_acceptance_request'));
        } finally {
            $worker->stop(); if ($this->connection->isTransactionActive()) { $this->connection->rollBack(); } unlink($path);
        }
    }
    /** @param array<string, mixed> $data
     * @return array{\Symfony\Component\Process\Process, string}
     */
    private function worker(string $fixture, array $data): array
    {
        $path = tempnam(sys_get_temp_dir(), 'oathforge-DUMMY-reconcile-'); self::assertIsString($path); chmod($path, 0600);
        file_put_contents($path, json_encode($data, JSON_THROW_ON_ERROR));
        $worker = new \Symfony\Component\Process\Process([PHP_BINARY, 'tests/Fixtures/'.$fixture, $path], dirname(__DIR__, 2));
        $worker->setTimeout(12); $worker->start(); return [$worker, $path];
    }
    private function assertWaiting(\Symfony\Component\Process\Process $worker): void
    {
        $limit = microtime(true) + 5;
        do {
            $pid = (int) $worker->getOutput(); $this->connection->executeQuery('SELECT pg_stat_clear_snapshot()');
            if ($pid > 0 && 'Lock' === $this->connection->fetchOne('SELECT wait_event_type FROM pg_stat_activity WHERE pid = ?', [$pid])) { self::assertTrue($worker->isRunning()); return; }
            usleep(10000);
        } while ($worker->isRunning() && microtime(true) < $limit);
        self::fail('Reconciliation worker did not reach lock: '.$worker->getErrorOutput());
    }
    /** @return array<string, mixed> */
    private function workerResult(\Symfony\Component\Process\Process $worker): array
    {
        $worker->wait(); self::assertSame(0, $worker->getExitCode(), $worker->getErrorOutput()); self::assertSame('', $worker->getErrorOutput());
        return json_decode(explode("\n", $worker->getOutput(), 2)[1], true, flags: JSON_THROW_ON_ERROR);
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
    private function input(): array { return ['activity' => 'running', 'activation' => ['mode' => 'scheduled', 'time' => ['local' => gmdate('Y-m-d\TH:i:s', $this->clock->time + 3600), 'timezone' => 'UTC']], 'deadline' => ['local' => gmdate('Y-m-d\TH:i:s', $this->clock->time + 7200), 'timezone' => 'UTC']]; }
    /** @param array<string, mixed>|null $input */
    private function request(string $method, string $path, ?array $input = null): void { $this->client->request($method, $path, server: ['HTTP_AUTHORIZATION' => 'Bearer '.self::TOKEN, 'CONTENT_TYPE' => 'application/json'], content: null === $input ? '' : json_encode($input, JSON_THROW_ON_ERROR)); }
    /** @return array<string, mixed> */
    private function body(): array { return json_decode((string) $this->client->getResponse()->getContent(), true, flags: JSON_THROW_ON_ERROR); }
}
