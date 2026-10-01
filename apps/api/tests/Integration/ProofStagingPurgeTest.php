<?php

declare(strict_types=1);
namespace App\Tests\Integration;

use App\Command\PurgeProofStagingCommand;
use App\Identity\Clock;
use App\Proof\{FilesystemProofStorage, ProofStorage};
use App\Tests\Fixtures\{CharacterFixture, FixedClock};
use Doctrine\DBAL\Connection;
use Symfony\Bundle\FrameworkBundle\Console\Application;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\Console\Tester\CommandTester;
use Symfony\Component\HttpFoundation\File\UploadedFile;

/** Unfinalized staging data is purged 24 hours after staging, finalized objects never (MVP-07-T07). */
final class ProofStagingPurgeTest extends WebTestCase
{
    private const ACCOUNT = '00000000-0000-4000-8000-000000000001';
    private const TOKEN = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    /** 2027-01-15T16:00:00Z. */
    private const T = 1800028800;
    private const DAY = 86400;
    private Connection $connection;
    private KernelBrowser $client;
    private FixedClock $clock;
    private FilesystemProofStorage $storage;
    private string $directory;
    /** @var array{?string, ?string} */
    private array $previousDirectory;

    protected function setUp(): void
    {
        // The real wiring reads PROOF_STORAGE_DIR when the storage service is first built, so each test gets its own directory.
        $this->directory = sys_get_temp_dir().'/oathforge-proof-purge-'.bin2hex(random_bytes(8));
        $this->previousDirectory = [$_ENV['PROOF_STORAGE_DIR'] ?? null, $_SERVER['PROOF_STORAGE_DIR'] ?? null];
        $_ENV['PROOF_STORAGE_DIR'] = $_SERVER['PROOF_STORAGE_DIR'] = $this->directory;
        $this->client = self::createClient();
        $this->client->disableReboot();
        $connection = self::getContainer()->get(Connection::class);
        self::assertInstanceOf(Connection::class, $connection);
        $this->connection = $connection;
        self::assertSame('oathforge_test', $this->connection->fetchOne('SELECT current_database()'));
        $this->connection->executeStatement('TRUNCATE account CASCADE');
        $this->clock = new FixedClock(self::T);
        self::getContainer()->set(Clock::class, $this->clock);
        $this->storage = new FilesystemProofStorage($this->directory, $this->clock);
    }

    protected function tearDown(): void
    {
        $this->remove($this->directory);
        [$env, $server] = $this->previousDirectory;
        if (null === $env) { unset($_ENV['PROOF_STORAGE_DIR']); } else { $_ENV['PROOF_STORAGE_DIR'] = $env; }
        if (null === $server) { unset($_SERVER['PROOF_STORAGE_DIR']); } else { $_SERVER['PROOF_STORAGE_DIR'] = $server; }
        parent::tearDown();
    }

    public function testStagedObjectStaysAtExactlyTwentyFourHoursAndGoesOneSecondLater(): void
    {
        $key = $this->storage->stage('DUMMY staged bytes');
        $this->clock->time = self::T + self::DAY;

        $tester = $this->purge();

        self::assertSame(0, $tester->getStatusCode());
        self::assertSame("STAGED_SELECTED 0 DELETED 0 REFERENCED 0 FAILED 0 TEMPORARY_REMOVED 0 TEMPORARY_FAILED 0\n", $tester->getDisplay());
        self::assertFileExists($this->directory.'/staged/'.$key);
        $this->clock->time = self::T + self::DAY + 1;
        $tester = $this->purge();
        self::assertSame(0, $tester->getStatusCode());
        self::assertFileDoesNotExist($this->directory.'/staged/'.$key);
        self::assertSame("STAGED_SELECTED 1 DELETED 1 REFERENCED 0 FAILED 0 TEMPORARY_REMOVED 0 TEMPORARY_FAILED 0\n", $tester->getDisplay());
    }

    public function testPromotedObjectReferencedByARowIsNeverTouched(): void
    {
        $key = $this->submitProof();
        self::assertFileExists($this->directory.'/objects/'.$key);

        foreach ([self::T + self::DAY + 1, self::T + 400 * self::DAY] as $time) {
            $this->clock->time = $time;
            $tester = $this->purge();
            self::assertSame(0, $tester->getStatusCode());
            self::assertSame("STAGED_SELECTED 0 DELETED 0 REFERENCED 0 FAILED 0 TEMPORARY_REMOVED 0 TEMPORARY_FAILED 0\n", $tester->getDisplay());
        }
        self::assertFileExists($this->directory.'/objects/'.$key);
    }

    public function testStagedObjectReferencedByARowIsNeverDeletedAndFailsTheRun(): void
    {
        $promoted = $this->submitProof();
        // A finalized row always points at a promoted object. This anomaly is seeded to prove the reference check.
        $key = $this->storage->stage('DUMMY referenced staged bytes');
        $this->connection->executeStatement('UPDATE proof_submission SET storage_key = ? WHERE storage_key = ?', [$key, $promoted]);
        $this->clock->time = self::T + self::DAY + 1;

        $tester = $this->purge();

        // The broken invariant needs an operator, so a scheduler must see a failed run.
        self::assertSame(1, $tester->getStatusCode());
        self::assertFileExists($this->directory.'/staged/'.$key);
        self::assertSame("STAGED_SELECTED 1 DELETED 0 REFERENCED 1 FAILED 0 TEMPORARY_REMOVED 0 TEMPORARY_FAILED 0\nREFERENCED_KEY {$key}\n", $tester->getDisplay());
    }

    public function testLimitBoundsTheSelectionAndInvalidLimitsDeleteNothing(): void
    {
        $keys = [$this->storage->stage('DUMMY a'), $this->storage->stage('DUMMY b'), $this->storage->stage('DUMMY c')];
        $this->clock->time = self::T + self::DAY + 1;
        foreach (['0', '1001', 'abc', '01'] as $invalid) {
            $tester = $this->purge($invalid);
            self::assertSame(2, $tester->getStatusCode(), $invalid);
            self::assertSame("INVALID_LIMIT\n", $tester->getDisplay(), $invalid);
        }
        self::assertCount(3, $this->storage->listStagedBefore(self::T + 1));

        $tester = $this->purge('2');

        self::assertSame(0, $tester->getStatusCode());
        self::assertSame("STAGED_SELECTED 2 DELETED 2 REFERENCED 0 FAILED 0 TEMPORARY_REMOVED 0 TEMPORARY_FAILED 0\n", $tester->getDisplay());
        $remaining = $this->storage->listStagedBefore(self::T + 1);
        self::assertCount(1, $remaining);
        self::assertContains($remaining[0], $keys);
    }

    public function testDeleteFailureIsReportedWithCountsAndKeysOnlyAndTheRestStillGoes(): void
    {
        $key = $this->storage->stage('DUMMY-purge-marker-ok');
        // Runs as root in the container, so permissions cannot block unlink. A directory under a key name can never be unlinked.
        // Its key sorts first, so the later key proves the purge continues after a failure.
        $blocked = str_repeat('0', 32);
        mkdir($this->directory.'/staged/'.$blocked);
        file_put_contents($this->directory.'/staged/'.$blocked.'/inner', 'DUMMY-purge-marker-blocked');
        touch($this->directory.'/staged/'.$blocked, self::T);
        $this->clock->time = self::T + self::DAY + 1;

        $tester = $this->purge();

        self::assertSame(1, $tester->getStatusCode());
        self::assertSame("STAGED_SELECTED 2 DELETED 1 REFERENCED 0 FAILED 1 TEMPORARY_REMOVED 0 TEMPORARY_FAILED 0\nFAILED_KEY {$blocked}\n", $tester->getDisplay());
        self::assertStringNotContainsString('DUMMY-purge-marker', $tester->getDisplay());
        self::assertFileDoesNotExist($this->directory.'/staged/'.$key);
        self::assertDirectoryExists($this->directory.'/staged/'.$blocked);
    }

    public function testStaleTemporaryWriteFilesFollowTheSameBoundaryAndLimit(): void
    {
        // An interrupted stage() leaves a .tmp- file that never becomes a key, so no row can reference it.
        $staged = $this->directory.'/staged';
        mkdir($staged, 0700, true);
        foreach (['.tmp-a', '.tmp-b'] as $name) { file_put_contents($staged.'/'.$name, 'DUMMY-purge-marker-partial'); touch($staged.'/'.$name, self::T); }
        $this->clock->time = self::T + self::DAY;

        $tester = $this->purge();

        self::assertSame("STAGED_SELECTED 0 DELETED 0 REFERENCED 0 FAILED 0 TEMPORARY_REMOVED 0 TEMPORARY_FAILED 0\n", $tester->getDisplay());
        self::assertFileExists($staged.'/.tmp-a');
        $this->clock->time = self::T + self::DAY + 1;
        $tester = $this->purge('1');
        self::assertSame(0, $tester->getStatusCode());
        self::assertSame("STAGED_SELECTED 0 DELETED 0 REFERENCED 0 FAILED 0 TEMPORARY_REMOVED 1 TEMPORARY_FAILED 0\n", $tester->getDisplay());
        self::assertFileDoesNotExist($staged.'/.tmp-a');
        self::assertFileExists($staged.'/.tmp-b');
        // A directory can never be unlinked, which stands in for a temporary file that cannot be removed.
        mkdir($staged.'/.tmp-blocked');
        touch($staged.'/.tmp-blocked', self::T);
        $tester = $this->purge();
        self::assertSame(1, $tester->getStatusCode());
        self::assertSame("STAGED_SELECTED 0 DELETED 0 REFERENCED 0 FAILED 0 TEMPORARY_REMOVED 1 TEMPORARY_FAILED 1\n", $tester->getDisplay());
        self::assertFileDoesNotExist($staged.'/.tmp-b');
    }

    public function testTemporaryPassFailureKeepsTheStagedSummaryAndFailsTheRun(): void
    {
        $key = $this->storage->stage('DUMMY-purge-marker-ok');
        $blocked = str_repeat('0', 32);
        mkdir($this->directory.'/staged/'.$blocked);
        touch($this->directory.'/staged/'.$blocked, self::T);
        $this->clock->time = self::T + self::DAY + 1;
        // Real staged deletion, only the temporary pass fails, after the staged keys were processed.
        $storage = new class($this->storage) implements ProofStorage {
            public function __construct(private ProofStorage $inner) {}
            public function stage(string $bytes): string { return $this->inner->stage($bytes); }
            public function promote(string $key): void { $this->inner->promote($key); }
            public function read(string $key): string { return $this->inner->read($key); }
            public function delete(string $key): void { $this->inner->delete($key); }
            public function deleteStaged(string $key): void { $this->inner->deleteStaged($key); }
            public function listStagedBefore(int $instant): array { return $this->inner->listStagedBefore($instant); }
            public function purgeTemporaryBefore(int $instant, int $limit): array { throw new \RuntimeException('Proof storage unavailable'); }
        };
        $tester = new CommandTester(new PurgeProofStagingCommand($storage, $this->connection, $this->clock));

        $tester->execute([]);

        self::assertSame(1, $tester->getStatusCode());
        self::assertSame("STAGED_SELECTED 2 DELETED 1 REFERENCED 0 FAILED 1 TEMPORARY_REMOVED 0 TEMPORARY_FAILED 0\nFAILED_KEY {$blocked}\nSTAGING_PURGE_UNAVAILABLE\n", $tester->getDisplay());
        self::assertFileDoesNotExist($this->directory.'/staged/'.$key);
    }

    public function testDatabaseFailureKeepsTheKeyAndReportsTheSummary(): void
    {
        $key = $this->storage->stage('DUMMY-purge-marker-ok');
        $this->clock->time = self::T + self::DAY + 1;
        // Hiding the table inside a rolled back transaction makes the reference check fail for real.
        $this->connection->beginTransaction();
        try {
            $this->connection->executeStatement('ALTER TABLE proof_submission RENAME TO proof_submission_hidden');
            $tester = $this->purge();
        } finally {
            $this->connection->rollBack();
        }

        self::assertSame(1, $tester->getStatusCode());
        self::assertSame("STAGED_SELECTED 1 DELETED 0 REFERENCED 0 FAILED 0 TEMPORARY_REMOVED 0 TEMPORARY_FAILED 0\nSTAGING_PURGE_UNAVAILABLE\n", $tester->getDisplay());
        self::assertFileExists($this->directory.'/staged/'.$key);
    }

    private function purge(string $limit = '100'): CommandTester
    {
        $kernel = self::$kernel;
        self::assertNotNull($kernel);
        $tester = new CommandTester((new Application($kernel))->find('app:proof:purge-staging'));
        $tester->execute(['--limit' => $limit]);
        return $tester;
    }

    /** Submits a real proof through the endpoint, so staging, promotion and the row happen as in production. */
    private function submitProof(): string
    {
        $this->connection->insert('account', ['id' => self::ACCOUNT, 'created_at' => self::T, 'onboarding_status' => 'complete']);
        $this->connection->insert('app_session', ['token_digest' => hash('sha256', self::TOKEN), 'account_id' => self::ACCOUNT, 'issued_at' => self::T, 'expires_at' => self::T + 2592000]);
        CharacterFixture::activate($this->connection, self::ACCOUNT);
        $this->json('/api/oath-previews', ['activity' => 'running', 'activation' => ['mode' => 'now'], 'deadline' => ['local' => gmdate('Y-m-d\\TH:i:s', self::T + 7200), 'timezone' => 'UTC']]);
        $preview = $this->body()['preview']['id'];
        $this->json('/api/oaths', ['previewId' => $preview, 'requestId' => $preview, 'accepted' => true]);
        self::assertSame(201, $this->client->getResponse()->getStatusCode());
        $upload = tempnam(sys_get_temp_dir(), 'oathforge-DUMMY-proof-');
        self::assertIsString($upload);
        $image = imagecreatetruecolor(64, 64);
        $stream = fopen('php://memory', 'w+b');
        self::assertNotFalse($stream);
        imagejpeg($image, $stream, 85);
        rewind($stream);
        file_put_contents($upload, (string) stream_get_contents($stream));
        $this->client->request('POST', '/api/oaths/'.$this->body()['oath']['id'].'/proofs', ['submissionId' => '00000000-0000-4000-a000-000000000001', 'mode' => 'photo', 'declaration' => 'true'], ['image' => new UploadedFile($upload, 'proof.jpg', 'image/jpeg', null, true)], ['HTTP_AUTHORIZATION' => 'Bearer '.self::TOKEN, 'CONTENT_TYPE' => 'multipart/form-data']);
        if (is_file($upload)) { unlink($upload); }
        self::assertSame(201, $this->client->getResponse()->getStatusCode());
        $key = $this->connection->fetchOne('SELECT storage_key FROM proof_submission');
        self::assertIsString($key);
        return $key;
    }

    /** @param array<string, mixed> $input */
    private function json(string $path, array $input): void
    {
        $this->client->request('POST', $path, server: ['HTTP_AUTHORIZATION' => 'Bearer '.self::TOKEN, 'CONTENT_TYPE' => 'application/json'], content: json_encode($input, JSON_THROW_ON_ERROR));
    }

    /** @return array<string, mixed> */
    private function body(): array { return json_decode((string) $this->client->getResponse()->getContent(), true, flags: JSON_THROW_ON_ERROR); }

    private function remove(string $path): void
    {
        if (is_dir($path) && !is_link($path)) {
            foreach (array_diff(scandir($path) ?: [], ['.', '..']) as $name) { $this->remove($path.'/'.$name); }
            rmdir($path);
        } elseif (file_exists($path)) {
            unlink($path);
        }
    }
}
