<?php

declare(strict_types=1);
namespace App\Tests\Integration;

use App\Identity\Clock;
use App\Tests\Fixtures\{CharacterFixture, FixedClock, LockWait};
use Doctrine\DBAL\Connection;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\Process\Process;

/** Two identical proof requests that meet at the account lock (MVP-07-T04). */
final class ProofSubmissionRaceTest extends WebTestCase
{
    private const ACCOUNT = '00000000-0000-4000-8000-000000000001';
    private const TOKEN = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    private const SUBMISSION = '00000000-0000-4000-a000-000000000001';
    /** 2027-01-15T16:00:00Z, two hours before the Oath deadline. */
    private const START = 1800028800;
    private Connection $connection;
    private KernelBrowser $client;
    private string $directory;
    /** @var list<string> */
    private array $files = [];

    protected function setUp(): void
    {
        $this->directory = sys_get_temp_dir().'/oathforge-proof-race-'.bin2hex(random_bytes(8));
        $this->client = self::createClient();
        $this->client->disableReboot();
        $connection = self::getContainer()->get(Connection::class);
        self::assertInstanceOf(Connection::class, $connection);
        $this->connection = $connection;
        self::assertSame('oathforge_test', $this->connection->fetchOne('SELECT current_database()'));
        $this->connection->executeStatement('TRUNCATE account CASCADE');
        self::getContainer()->set(Clock::class, new FixedClock(self::START));
        $this->connection->insert('account', ['id' => self::ACCOUNT, 'created_at' => self::START, 'onboarding_status' => 'complete']);
        $this->connection->insert('app_session', ['token_digest' => hash('sha256', self::TOKEN), 'account_id' => self::ACCOUNT, 'issued_at' => self::START, 'expires_at' => self::START + 2592000]);
        CharacterFixture::activate($this->connection, self::ACCOUNT);
    }

    protected function tearDown(): void
    {
        foreach (['staged', 'objects'] as $state) {
            foreach ($this->stored($state) as $name) { unlink($this->directory.'/'.$state.'/'.$name); }
            if (is_dir($this->directory.'/'.$state)) { rmdir($this->directory.'/'.$state); }
        }
        if (is_dir($this->directory)) { rmdir($this->directory); }
        foreach ($this->files as $file) { if (is_file($file)) { unlink($file); } }
        parent::tearDown();
    }

    public function testConcurrentIdenticalRequestsMakeOneReceiptAndOneObject(): void
    {
        $oath = $this->createOath();
        $image = $this->file($this->makeJpeg());
        $this->connection->beginTransaction();
        $this->connection->fetchOne('SELECT id FROM account FOR UPDATE');
        $first = $this->worker($oath, $image);
        $second = $this->worker($oath, $image);
        try {
            LockWait::assertWorkerWaiting($this->connection, $first, 'First proof worker');
            LockWait::assertWorkerWaiting($this->connection, $second, 'Second proof worker');
            $this->connection->commit();
            $results = [$this->workerResult($first), $this->workerResult($second)];
        } finally {
            $first->stop(); $second->stop();
            if ($this->connection->isTransactionActive()) { $this->connection->rollBack(); }
        }

        // The second request waits on the account lock, then finds the committed row and replays it instead of hitting the unique constraint.
        usort($results, static fn (array $a, array $b): int => $b['created'] <=> $a['created']);
        self::assertSame([true, false], array_column($results, 'created'), json_encode($results, JSON_THROW_ON_ERROR));
        self::assertSame($results[0]['body']['proof'], $results[1]['body']['proof']);
        self::assertSame(gmdate('Y-m-d\TH:i:s\Z', self::START), $results[0]['body']['proof']['receivedAt']);
        $rows = $this->connection->fetchAllAssociative('SELECT storage_key FROM proof_submission');
        self::assertCount(1, $rows);
        self::assertSame([$rows[0]['storage_key']], $this->stored('objects'));
        self::assertSame([], $this->stored('staged'));
    }

    private function worker(string $oath, string $image): Process
    {
        $data = ['time' => self::START, 'token' => self::TOKEN, 'oath' => $oath, 'directory' => $this->directory, 'image' => $image, 'fields' => ['submissionId' => self::SUBMISSION, 'mode' => 'photo', 'declaration' => 'true']];
        $path = $this->file(json_encode($data, JSON_THROW_ON_ERROR));
        $worker = new Process([PHP_BINARY, 'tests/Fixtures/proof_submit_worker.php', $path], dirname(__DIR__, 2));
        $worker->setTimeout(LockWait::WORKER_TIMEOUT);
        $worker->start();
        return $worker;
    }

    /** @return array<string, mixed> */
    private function workerResult(Process $worker): array
    {
        $worker->wait();
        self::assertSame(0, $worker->getExitCode(), $worker->getErrorOutput());
        self::assertSame('', $worker->getErrorOutput());
        $result = json_decode(explode("\n", $worker->getOutput(), 2)[1], true, flags: JSON_THROW_ON_ERROR);
        self::assertIsArray($result);
        self::assertArrayHasKey('created', $result, $worker->getOutput());
        return $result;
    }

    private function file(string $contents): string
    {
        $path = tempnam(sys_get_temp_dir(), 'oathforge-DUMMY-proof-race-');
        self::assertIsString($path);
        chmod($path, 0600);
        file_put_contents($path, $contents);
        $this->files[] = $path;
        return $path;
    }

    private function createOath(): string
    {
        $this->json('/api/oath-previews', ['activity' => 'running', 'activation' => ['mode' => 'now'], 'deadline' => ['local' => gmdate('Y-m-d\TH:i:s', self::START + 7200), 'timezone' => 'UTC']]);
        $preview = $this->body()['preview']['id'];
        $this->json('/api/oaths', ['previewId' => $preview, 'requestId' => $preview, 'accepted' => true]);
        self::assertSame(201, $this->client->getResponse()->getStatusCode());
        return $this->body()['oath']['id'];
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
    private function json(string $path, array $input): void
    {
        $this->client->request('POST', $path, server: ['HTTP_AUTHORIZATION' => 'Bearer '.self::TOKEN, 'CONTENT_TYPE' => 'application/json'], content: json_encode($input, JSON_THROW_ON_ERROR));
    }

    /** @return array<string, mixed> */
    private function body(): array { return json_decode((string) $this->client->getResponse()->getContent(), true, flags: JSON_THROW_ON_ERROR); }
}
