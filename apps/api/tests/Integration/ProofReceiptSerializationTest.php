<?php

declare(strict_types=1);
namespace App\Tests\Integration;

use App\Identity\Clock;
use App\Oath\{PauseInput, PauseService};
use App\Proof\{SubmissionInput, SubmissionResult, SubmissionService};
use App\Tests\Fixtures\{CharacterFixture, FixedClock, LockWait};
use Doctrine\DBAL\Connection;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\Process\Process;

/**
 * Receipt, pause and cutoff reconciliation meet at the account lock, so the first committer wins (MVP-07-T05).
 * Each case holds the account lock in this process while a worker waits on it.
 */
final class ProofReceiptSerializationTest extends WebTestCase
{
    private const ACCOUNT = '00000000-0000-4000-8000-000000000001';
    private const TOKEN = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    private const SUBMISSION = '00000000-0000-4000-a000-000000000001';
    /** 2027-01-15T16:00:00Z, two hours before the Oath deadline 18:00Z, so S is 18:15Z. */
    private const START = 1800028800;
    private Connection $connection;
    private KernelBrowser $client;
    private FixedClock $clock;
    private string $character;
    private string $directory;
    /** @var array{?string, ?string} */
    private array $previousDirectory;
    /** @var list<string> */
    private array $files = [];

    protected function setUp(): void
    {
        // In-process receipts use the real storage wiring, which reads PROOF_STORAGE_DIR when first built. Workers get the same directory.
        $this->directory = sys_get_temp_dir().'/oathforge-proof-serial-'.bin2hex(random_bytes(8));
        $this->previousDirectory = [$_ENV['PROOF_STORAGE_DIR'] ?? null, $_SERVER['PROOF_STORAGE_DIR'] ?? null];
        $_ENV['PROOF_STORAGE_DIR'] = $_SERVER['PROOF_STORAGE_DIR'] = $this->directory;
        $this->client = self::createClient();
        $this->client->disableReboot();
        $connection = self::getContainer()->get(Connection::class);
        self::assertInstanceOf(Connection::class, $connection);
        $this->connection = $connection;
        self::assertSame('oathforge_test', $this->connection->fetchOne('SELECT current_database()'));
        $this->connection->executeStatement('TRUNCATE account CASCADE');
        $this->clock = new FixedClock(self::START);
        self::getContainer()->set(Clock::class, $this->clock);
        $this->connection->insert('account', ['id' => self::ACCOUNT, 'created_at' => self::START, 'onboarding_status' => 'complete']);
        $this->connection->insert('app_session', ['token_digest' => hash('sha256', self::TOKEN), 'account_id' => self::ACCOUNT, 'issued_at' => self::START, 'expires_at' => self::START + 2592000]);
        $this->character = CharacterFixture::activate($this->connection, self::ACCOUNT);
    }

    protected function tearDown(): void
    {
        if ($this->connection->isTransactionActive()) { $this->connection->rollBack(); }
        foreach (['staged', 'objects'] as $state) {
            foreach ($this->stored($state) as $name) { unlink($this->directory.'/'.$state.'/'.$name); }
            if (is_dir($this->directory.'/'.$state)) { rmdir($this->directory.'/'.$state); }
        }
        if (is_dir($this->directory)) { rmdir($this->directory); }
        foreach ($this->files as $file) { if (is_file($file)) { unlink($file); } }
        [$env, $server] = $this->previousDirectory;
        if (null === $env) { unset($_ENV['PROOF_STORAGE_DIR']); } else { $_ENV['PROOF_STORAGE_DIR'] = $env; }
        if (null === $server) { unset($_SERVER['PROOF_STORAGE_DIR']); } else { $_SERVER['PROOF_STORAGE_DIR'] = $server; }
        parent::tearDown();
    }

    /** T02-05: bytes staged at 18:14Z, the clock reaches 18:16Z while the receipt waits, so R is 18:16Z and late. */
    public function testClockPassingCutoffWhileWaitingForLocksMakesReceiptLate(): void
    {
        $oath = $this->createOath();
        $cutoff = $this->cutoff($oath);
        $this->connection->beginTransaction();
        $this->connection->fetchOne('SELECT id FROM account FOR UPDATE');
        [$worker, $path] = $this->receiptWorker($oath, $cutoff - 60);
        try {
            LockWait::assertWorkerWaiting($this->connection, $worker, 'Proof worker');
            // Staging ran before the lock, at the earlier clock time.
            $staged = $this->stored('staged');
            self::assertCount(1, $staged);
            clearstatcache();
            self::assertSame($cutoff - 60, filemtime($this->directory.'/staged/'.$staged[0]));
            $this->setTime($path, $cutoff + 60);
            $this->connection->commit();
            self::assertSame(['error' => ['code' => 'receipt_cutoff_passed']], $this->workerResult($worker));
        } finally { $worker->stop(); }
        $this->assertNothingKept();
        self::assertSame('review_pending', $this->connection->fetchOne('SELECT state FROM oath'));
    }

    /** T05-04 first order: a receipt committed before pause keeps the Oath pending, and pause preserves it. */
    public function testReceiptHoldingLocksMakesPauseWaitAndPreserveProof(): void
    {
        $oath = $this->createOath();
        $this->json('GET', '/api/oath-pause');
        $stale = $this->body();
        self::assertSame([$oath], $stale['withdraw']);
        $this->connection->beginTransaction();
        $receipt = $this->submitInProcess($oath);
        self::assertTrue($receipt->created);
        [$preview, $previewPath] = $this->worker('oath_pause_worker.php', ['time' => self::START, 'token' => self::TOKEN]);
        [$confirm, $confirmPath] = $this->worker('oath_pause_worker.php', ['time' => self::START, 'token' => self::TOKEN, 'input' => ['characterId' => $this->character, 'paused' => true, 'revision' => $stale['revision']]]);
        try {
            LockWait::assertWorkerWaiting($this->connection, $preview, 'Pause preview worker');
            LockWait::assertWorkerWaiting($this->connection, $confirm, 'Pause worker');
            $this->connection->commit();
            $summary = $this->workerResult($preview);
            // The pause the player confirmed was for an active Oath, so it must be reviewed again instead of withdrawing.
            self::assertSame(['error' => ['code' => 'pause_preview_changed']], $this->workerResult($confirm));
        } finally { $preview->stop(); $confirm->stop(); }
        self::assertFalse($summary['paused']);
        self::assertSame([], $summary['withdraw']);
        self::assertSame([$oath], $summary['preserve']);
        self::assertSame('proof_pending', $this->connection->fetchOne('SELECT state FROM oath'));
        // Confirming the renewed preview pauses without touching the pending proof.
        $this->json('POST', '/api/oath-pause', ['characterId' => $this->character, 'paused' => true, 'revision' => $summary['revision']]);
        self::assertSame(200, $this->client->getResponse()->getStatusCode());
        self::assertTrue($this->body()['paused']);
        self::assertSame([], $this->body()['withdraw']);
        self::assertSame([$oath], $this->body()['preserve']);
        self::assertSame('proof_pending', $this->connection->fetchOne('SELECT state FROM oath'));
        $rows = $this->connection->fetchAllAssociative('SELECT storage_key FROM proof_submission');
        self::assertCount(1, $rows);
        self::assertSame([$rows[0]['storage_key']], $this->stored('objects'));
        self::assertSame([], $this->stored('staged'));
    }

    /** T05-04 second order: pause committed before an unfinished upload withdraws the Oath, and the upload cannot resurrect it. */
    public function testPauseHoldingLocksRefusesWaitingReceipt(): void
    {
        $oath = $this->createOath();
        $this->json('GET', '/api/oath-pause');
        $revision = $this->body()['revision'];
        $this->connection->beginTransaction();
        $this->connection->fetchOne('SELECT id FROM account FOR UPDATE');
        // R stays at or before S, so the refusal comes from the state, not from the cutoff.
        [$worker] = $this->receiptWorker($oath, self::START);
        try {
            LockWait::assertWorkerWaiting($this->connection, $worker, 'Proof worker');
            self::assertCount(1, $this->stored('staged'));
            $pause = self::getContainer()->get(PauseService::class);
            self::assertInstanceOf(PauseService::class, $pause);
            $input = PauseInput::parse(['characterId' => $this->character, 'paused' => true, 'revision' => $revision]);
            self::assertInstanceOf(PauseInput::class, $input);
            $paused = $pause->access(self::TOKEN, $input);
            self::assertIsArray($paused);
            self::assertTrue($paused['paused']);
            $this->connection->commit();
            self::assertSame(['error' => ['code' => 'oath_not_active', 'state' => 'withdrawn']], $this->workerResult($worker));
        } finally { $worker->stop(); }
        $this->assertNothingKept();
        $row = $this->connection->fetchAssociative('SELECT state, reason FROM oath');
        self::assertSame(['state' => 'withdrawn', 'reason' => 'character_paused'], $row);
    }

    /** A cutoff run at now > S that selected the Oath before a timely receipt committed rechecks it under the lock. */
    public function testReconcileCommandAfterCutoffKeepsCommittedTimelyReceipt(): void
    {
        $oath = $this->createOath();
        $cutoff = $this->cutoff($oath);
        $this->clock->time = $cutoff - 60;
        $this->connection->beginTransaction();
        $receipt = $this->submitInProcess($oath);
        self::assertTrue($receipt->created);
        [$worker] = $this->worker('oath_reconcile_command_worker.php', ['time' => $cutoff + 60]);
        try {
            LockWait::assertWorkerWaiting($this->connection, $worker, 'Reconcile command worker');
            $this->connection->commit();
            // Selected 1 proves the command saw the Oath as active before the receipt committed.
            self::assertSame(['exitCode' => 0, 'output' => 'OATHS_SELECTED 1 ACTIVATED 0 REVIEW 0'], $this->workerResult($worker));
        } finally { $worker->stop(); }
        $row = $this->connection->fetchAssociative('SELECT state, reason, review_entered_at FROM oath');
        self::assertSame(['state' => 'proof_pending', 'reason' => null, 'review_entered_at' => null], $row);
        self::assertSame($cutoff - 60, $this->connection->fetchOne('SELECT received_at FROM proof_submission'));
    }

    private function submitInProcess(string $oath): SubmissionResult
    {
        $upload = $this->file($this->makeJpeg());
        $input = SubmissionInput::parse(['submissionId' => self::SUBMISSION, 'mode' => 'photo', 'declaration' => 'true'], new UploadedFile($upload, 'proof.jpg', 'image/jpeg', null, true));
        self::assertInstanceOf(SubmissionInput::class, $input);
        $service = self::getContainer()->get(SubmissionService::class);
        self::assertInstanceOf(SubmissionService::class, $service);
        $result = $service->submit(self::TOKEN, $oath, $input);
        self::assertInstanceOf(SubmissionResult::class, $result);
        return $result;
    }

    /** @return array{Process, string} */
    private function receiptWorker(string $oath, int $time): array
    {
        return $this->worker('proof_submit_worker.php', ['time' => $time, 'token' => self::TOKEN, 'oath' => $oath, 'directory' => $this->directory, 'image' => $this->file($this->makeJpeg()), 'fields' => ['submissionId' => self::SUBMISSION, 'mode' => 'photo', 'declaration' => 'true']]);
    }

    /**
     * @param array<string, mixed> $data
     * @return array{Process, string}
     */
    private function worker(string $fixture, array $data): array
    {
        $path = $this->file(json_encode($data, JSON_THROW_ON_ERROR));
        $worker = new Process([PHP_BINARY, 'tests/Fixtures/'.$fixture, $path], dirname(__DIR__, 2));
        $worker->setTimeout(LockWait::WORKER_TIMEOUT);
        $worker->start();
        return [$worker, $path];
    }

    private function setTime(string $path, int $time): void
    {
        $data = json_decode((string) file_get_contents($path), true, flags: JSON_THROW_ON_ERROR);
        self::assertIsArray($data);
        $data['time'] = $time;
        file_put_contents($path, json_encode($data, JSON_THROW_ON_ERROR));
    }

    /** @return array<string, mixed> */
    private function workerResult(Process $worker): array
    {
        $worker->wait();
        self::assertSame(0, $worker->getExitCode(), $worker->getErrorOutput());
        self::assertSame('', $worker->getErrorOutput());
        $result = json_decode(explode("\n", $worker->getOutput(), 2)[1], true, flags: JSON_THROW_ON_ERROR);
        self::assertIsArray($result);
        return $result;
    }

    private function assertNothingKept(): void
    {
        self::assertSame(0, (int) $this->connection->fetchOne('SELECT COUNT(*) FROM proof_submission'));
        self::assertSame([], $this->stored('staged'));
        self::assertSame([], $this->stored('objects'));
    }

    private function file(string $contents): string
    {
        $path = tempnam(sys_get_temp_dir(), 'oathforge-DUMMY-proof-serial-');
        self::assertIsString($path);
        chmod($path, 0600);
        file_put_contents($path, $contents);
        $this->files[] = $path;
        return $path;
    }

    private function createOath(): string
    {
        $this->json('POST', '/api/oath-previews', ['activity' => 'running', 'activation' => ['mode' => 'now'], 'deadline' => ['local' => gmdate('Y-m-d\TH:i:s', self::START + 7200), 'timezone' => 'UTC']]);
        $preview = $this->body()['preview']['id'];
        $this->json('POST', '/api/oaths', ['previewId' => $preview, 'requestId' => $preview, 'accepted' => true]);
        self::assertSame(201, $this->client->getResponse()->getStatusCode());
        return $this->body()['oath']['id'];
    }

    private function cutoff(string $oath): int
    {
        $cutoff = $this->connection->fetchOne('SELECT receipt_cutoff FROM oath WHERE id = ?', [$oath]);
        self::assertIsInt($cutoff);
        // 18:15Z, so cutoff - 60 is 18:14Z and cutoff + 60 is 18:16Z.
        self::assertSame(self::START + 8100, $cutoff);
        return $cutoff;
    }

    /** @return list<string> */
    private function stored(string $state): array
    {
        $names = array_map('basename', glob($this->directory.'/'.$state.'/*') ?: []);
        sort($names);
        return $names;
    }

    private function makeJpeg(): string
    {
        $image = imagecreatetruecolor(64, 64);
        imagefilledrectangle($image, 0, 0, 32, 32, 0x8A4B2C);
        $stream = fopen('php://memory', 'w+b');
        self::assertNotFalse($stream);
        imagejpeg($image, $stream, 85);
        rewind($stream);
        return (string) stream_get_contents($stream);
    }

    /** @param array<string, mixed> $input */
    private function json(string $method, string $path, array $input = []): void
    {
        $this->client->request($method, $path, server: ['HTTP_AUTHORIZATION' => 'Bearer '.self::TOKEN, 'CONTENT_TYPE' => 'application/json'], content: [] === $input ? null : json_encode($input, JSON_THROW_ON_ERROR));
    }

    /** @return array<string, mixed> */
    private function body(): array { return json_decode((string) $this->client->getResponse()->getContent(), true, flags: JSON_THROW_ON_ERROR); }
}
