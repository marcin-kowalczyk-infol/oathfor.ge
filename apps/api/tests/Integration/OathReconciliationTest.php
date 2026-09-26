<?php

declare(strict_types=1);
namespace App\Tests\Integration;

use App\Identity\Clock;
use App\Tests\Fixtures\{CharacterFixture, FixedClock, LockWait};
use Doctrine\DBAL\Connection;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

final class OathReconciliationTest extends WebTestCase
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
    public function testScheduledActivationUsesExactCommittedBoundary(): void
    {
        $oath = $this->createOath();
        $this->clock->time += 3600;
        $this->request('GET', '/api/oaths/'.$oath['id']);
        self::assertSame('active', $this->body()['oath']['state']);
        self::assertSame(gmdate('Y-m-d\TH:i:s\Z', $this->clock->time), $this->body()['oath']['activatedAt']);
    }
    public function testBeforeActivationAndInclusiveReceiptCutoffThenFixedReviewClocks(): void
    {
        $oath = $this->createOath(); $base = $this->clock->time;
        $this->clock->time = $base + 3599;
        $this->request('GET', '/api/oaths/'.$oath['id']);
        self::assertSame('scheduled', $this->body()['oath']['state']);
        self::assertNull($this->body()['oath']['review']);
        $this->clock->time = $base + 8100;
        $this->request('GET', '/api/oaths/'.$oath['id']);
        self::assertSame('active', $this->body()['oath']['state']);
        self::assertNull($this->body()['oath']['review']);
        $this->clock->time++;
        $this->request('GET', '/api/oaths/'.$oath['id']);
        $reviewed = $this->body()['oath'];
        self::assertSame('review_pending', $reviewed['state']);
        self::assertSame('service_availability_unknown', $reviewed['reason']);
        self::assertSame(['enteredAt' => gmdate('Y-m-d\TH:i:s\Z', $base + 8101), 'closesAt' => gmdate('Y-m-d\TH:i:s\Z', $base + 8101 + 259200)], $reviewed['review']);
        self::assertSame($oath['snapshot'], $reviewed['snapshot']);
        $this->clock->time += 259201;
        $this->request('GET', '/api/oaths/'.$oath['id']);
        self::assertSame($reviewed, $this->body()['oath']);
        self::assertNull($reviewed['terminalAt']);
    }
    public function testDowntimeReplayAndListApplyBothTransitionsOnce(): void
    {
        $oath = $this->createOath(); $base = $this->clock->time;
        $preview = $this->connection->fetchOne('SELECT preview_id FROM oath');
        $this->clock->time += 20000;
        $this->request('POST', '/api/oaths', ['previewId' => $preview, 'requestId' => self::ACCOUNT, 'accepted' => true]);
        self::assertSame(200, $this->client->getResponse()->getStatusCode());
        $result = $this->body()['oath'];
        self::assertSame('review_pending', $result['state']);
        self::assertSame(gmdate('Y-m-d\TH:i:s\Z', $base + 3600), $result['activatedAt']);
        self::assertSame($this->clock->time, $this->connection->fetchOne('SELECT activation_reconciled_at FROM oath'));
        self::assertSame($oath['snapshot'], $result['snapshot']);
        $this->clock->time += 50;
        $this->request('GET', '/api/oaths');
        self::assertSame([$result], $this->body()['items']);
        self::assertSame($base + 20000, $this->connection->fetchOne('SELECT activation_reconciled_at FROM oath'));
    }
    public function testListingReconcilesAndExistingProofReviewOrTerminalStatesStayUntouched(): void
    {
        $ids = [];
        foreach (['proof_pending', 'needs_more_evidence', 'review_pending', 'fulfilled', 'missed', 'unresolved', 'withdrawn'] as $state) {
            $id = $this->createOath()['id']; $ids[] = $id;
            $this->connection->executeStatement('UPDATE oath SET state = ?, terminal_at = ? WHERE id = ?', [$state, in_array($state, ['fulfilled', 'missed', 'unresolved', 'withdrawn'], true) ? $this->clock->time : null, $id]);
        }
        $untouched = $this->connection->fetchAllAssociative("SELECT * FROM oath ORDER BY id");
        $new = $this->createOath()['id'];
        $this->clock->time += 10000;
        $this->request('GET', '/api/oaths');
        self::assertSame('review_pending', $this->connection->fetchOne('SELECT state FROM oath WHERE id = ?', [$new]));
        self::assertSame($untouched, $this->connection->fetchAllAssociative('SELECT * FROM oath WHERE id <> ? ORDER BY id', [$new]));
        self::assertCount(4, $this->body()['items']);
    }
    public function testCommandBoundsRowsEvenForOneAccountAndExcludesInactiveAccounts(): void
    {
        $this->createOath(); $this->createOath(); $this->createOath();
        $other = '00000000-0000-4000-8000-000000000002';
        $this->connection->insert('account', ['id' => $other, 'created_at' => $this->clock->time, 'onboarding_status' => 'complete']);
        CharacterFixture::activate($this->connection, $other);
        $this->connection->executeStatement('UPDATE app_session SET account_id = ?', [$other]);
        $inactive = $this->createOath()['id'];
        $this->connection->executeStatement("UPDATE account SET status = 'deleting' WHERE id = ?", [$other]);
        $this->clock->time += 10000;
        $tester = new \Symfony\Component\Console\Tester\CommandTester(new \App\Command\ReconcileOathsCommand(new \App\Oath\OathReconciler($this->connection, $this->clock)));
        self::assertSame(0, $tester->execute(['--limit' => '2']));
        self::assertSame("OATHS_SELECTED 2 ACTIVATED 2 REVIEW 2\n", $tester->getDisplay());
        self::assertSame(2, $this->connection->fetchOne("SELECT COUNT(*) FROM oath WHERE state = 'review_pending'"));
        self::assertSame(0, $tester->execute(['--limit' => '2']));
        self::assertSame("OATHS_SELECTED 1 ACTIVATED 1 REVIEW 1\n", $tester->getDisplay());
        self::assertSame(0, $tester->execute(['--limit' => '2']));
        self::assertSame("OATHS_SELECTED 0 ACTIVATED 0 REVIEW 0\n", $tester->getDisplay());
        self::assertSame('scheduled', $this->connection->fetchOne('SELECT state FROM oath WHERE id = ?', [$inactive]));
        foreach (['0', '1001', '01', '-1', 'x'] as $limit) { self::assertSame(2, $tester->execute(['--limit' => $limit])); self::assertSame("INVALID_LIMIT\n", $tester->getDisplay()); }
    }
    /** @return iterable<string, array{string}> */
    public static function protectedOperations(): iterable { foreach (['detail', 'list', 'acceptance'] as $mode) { yield $mode => [$mode]; } }
    #[\PHPUnit\Framework\Attributes\DataProvider('protectedOperations')]
    public function testExpiryDuringOathLockWaitDoesNotReconcileOrBindRetry(string $mode): void
    {
        $oath = $this->createOath();
        $preview = $this->connection->fetchOne('SELECT preview_id FROM oath');
        $this->clock->time += 10000;
        $before = $this->connection->fetchAssociative('SELECT * FROM oath');
        $this->connection->beginTransaction();
        $this->connection->fetchOne('SELECT id FROM oath FOR UPDATE');
        $data = ['time' => $this->clock->time, 'token' => self::TOKEN, 'mode' => $mode, 'id' => $oath['id'], 'input' => ['previewId' => $preview, 'requestId' => self::ACCOUNT, 'accepted' => true]];
        [$worker, $path] = $this->worker('acceptance' === $mode ? 'oath_acceptance_worker.php' : 'oath_read_worker.php', $data);
        try {
            $this->assertWaiting($worker);
            $data['time'] += 2592000;
            file_put_contents($path, json_encode($data, JSON_THROW_ON_ERROR));
            $this->connection->commit();
            self::assertSame(['error' => ['code' => 'unauthenticated']], $this->workerResult($worker));
            self::assertSame($before, $this->connection->fetchAssociative('SELECT * FROM oath'));
            self::assertSame(1, $this->connection->fetchOne('SELECT COUNT(*) FROM oath_acceptance_request'));
        } finally {
            $worker->stop();
            if ($this->connection->isTransactionActive()) { $this->connection->rollBack(); }
            unlink($path);
        }
    }
    public function testConcurrentCatchUpTransitionsOnlyOnceWithFreshTimeAfterOathLock(): void
    {
        $oath = $this->createOath(); $base = $this->clock->time;
        $this->clock->time += 10000;
        $this->connection->beginTransaction(); $this->connection->fetchOne('SELECT id FROM oath FOR UPDATE');
        [$first, $firstPath] = $this->worker('oath_reconciliation_worker.php', ['time' => $this->clock->time]);
        [$second, $secondPath] = $this->worker('oath_reconciliation_worker.php', ['time' => $this->clock->time]);
        try {
            $this->assertWaiting($first); $this->assertWaiting($second);
            file_put_contents($firstPath, json_encode(['time' => $this->clock->time + 30], JSON_THROW_ON_ERROR));
            file_put_contents($secondPath, json_encode(['time' => $this->clock->time + 30], JSON_THROW_ON_ERROR));
            $this->connection->commit();
            $one = $this->workerResult($first); $two = $this->workerResult($second);
            self::assertSame(1, $one['activated'] + $two['activated']);
            self::assertSame(1, $one['review'] + $two['review']);
            $row = $this->connection->fetchAssociative('SELECT * FROM oath');
            self::assertIsArray($row);
            self::assertSame($base + 3600, $row['activated_at']);
            self::assertSame($this->clock->time + 30, $row['activation_reconciled_at']);
            self::assertSame($this->clock->time + 30, $row['review_entered_at']);
            self::assertSame($oath['snapshot'], json_decode($row['snapshot'], true, flags: JSON_THROW_ON_ERROR));
        } finally {
            $first->stop(); $second->stop();
            if ($this->connection->isTransactionActive()) { $this->connection->rollBack(); }
            unlink($firstPath); unlink($secondPath);
        }
    }
    public function testCatchUpFailureRollsBackBothTransitions(): void
    {
        $this->createOath(); $this->clock->time += 10000;
        $before = $this->connection->fetchAssociative('SELECT * FROM oath');
        $this->connection->executeStatement("ALTER TABLE oath ADD CONSTRAINT dummy_review_failure CHECK (state <> 'review_pending') NOT VALID");
        try {
            $this->request('GET', '/api/oaths');
            self::assertSame(503, $this->client->getResponse()->getStatusCode());
            self::assertSame(['error' => ['code' => 'temporarily_unavailable']], $this->body());
            self::assertSame($before, $this->connection->fetchAssociative('SELECT * FROM oath'));
        } finally { $this->connection->executeStatement('ALTER TABLE oath DROP CONSTRAINT dummy_review_failure'); }
    }
    /** @param array<string, mixed> $data
     * @return array{\Symfony\Component\Process\Process, string}
     */
    private function worker(string $fixture, array $data): array
    {
        $path = tempnam(sys_get_temp_dir(), 'oathforge-DUMMY-reconcile-'); self::assertIsString($path); chmod($path, 0600);
        file_put_contents($path, json_encode($data, JSON_THROW_ON_ERROR));
        $worker = new \Symfony\Component\Process\Process([PHP_BINARY, 'tests/Fixtures/'.$fixture, $path], dirname(__DIR__, 2));
        $worker->setTimeout(LockWait::WORKER_TIMEOUT); $worker->start(); return [$worker, $path];
    }
    private function assertWaiting(\Symfony\Component\Process\Process $worker): void
    {
        LockWait::assertWorkerWaiting($this->connection, $worker, 'Reconciliation worker');
    }
    /** @return array<string, mixed> */
    private function workerResult(\Symfony\Component\Process\Process $worker): array
    {
        $worker->wait(); self::assertSame(0, $worker->getExitCode(), $worker->getErrorOutput()); self::assertSame('', $worker->getErrorOutput());
        return json_decode(explode("\n", $worker->getOutput(), 2)[1], true, flags: JSON_THROW_ON_ERROR);
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
