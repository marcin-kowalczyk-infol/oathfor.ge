<?php

declare(strict_types=1);
namespace App\Tests\Integration;

use App\Identity\Clock;
use App\Tests\Fixtures\{CharacterFixture, FixedClock};
use Doctrine\DBAL\Connection;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\HttpFoundation\File\UploadedFile;

final class ProofSubmissionEndpointTest extends WebTestCase
{
    private const ACCOUNT = '00000000-0000-4000-8000-000000000001';
    private const TOKEN = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    private const SUBMISSION = '00000000-0000-4000-a000-000000000001';
    /** 2027-01-15T16:00:00Z, two hours before the Oath deadline D. */
    private const START = 1800028800;
    private const D = self::START + 7200;
    private Connection $connection;
    private KernelBrowser $client;
    private FixedClock $clock;
    private string $directory;
    private string $upload;
    private string $jpeg;
    /** @var array{?string, ?string} */
    private array $previousDirectory;

    protected function setUp(): void
    {
        // The real wiring reads PROOF_STORAGE_DIR when the storage service is first built, so each test gets its own directory.
        $this->directory = sys_get_temp_dir().'/oathforge-proof-endpoint-'.bin2hex(random_bytes(8));
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
        $this->connection->insert('account', ['id' => self::ACCOUNT, 'created_at' => $this->clock->time, 'onboarding_status' => 'complete']);
        $this->connection->insert('app_session', ['token_digest' => hash('sha256', self::TOKEN), 'account_id' => self::ACCOUNT, 'issued_at' => $this->clock->time, 'expires_at' => $this->clock->time + 2592000]);
        CharacterFixture::activate($this->connection, self::ACCOUNT);
        $this->jpeg = $this->makeJpeg();
        $upload = tempnam(sys_get_temp_dir(), 'oathforge-DUMMY-proof-');
        self::assertIsString($upload);
        $this->upload = $upload;
    }

    protected function tearDown(): void
    {
        foreach (['staged', 'objects'] as $state) {
            $path = $this->directory.'/'.$state;
            foreach (is_dir($path) ? array_diff(scandir($path) ?: [], ['.', '..']) : [] as $name) { unlink($path.'/'.$name); }
            if (is_dir($path)) { rmdir($path); }
        }
        if (is_dir($this->directory)) { rmdir($this->directory); }
        if (is_file($this->directory)) { unlink($this->directory); }
        if (is_file($this->upload)) { unlink($this->upload); }
        [$env, $server] = $this->previousDirectory;
        if (null === $env) { unset($_ENV['PROOF_STORAGE_DIR']); } else { $_ENV['PROOF_STORAGE_DIR'] = $env; }
        if (null === $server) { unset($_SERVER['PROOF_STORAGE_DIR']); } else { $_SERVER['PROOF_STORAGE_DIR'] = $server; }
        parent::tearDown();
    }

    /** @return iterable<string, array{int}> */
    public static function timelyReceipts(): iterable
    {
        yield 'one second before S' => [-1];
        yield 'exactly at S' => [0];
    }

    #[\PHPUnit\Framework\Attributes\DataProvider('timelyReceipts')]
    public function testTimelyPhotoReceiptMovesOathToProofPending(int $offsetFromCutoff): void
    {
        $oath = $this->createOath();
        $cutoff = $this->cutoff($oath);
        self::assertSame(self::D + 900, $cutoff);
        $this->clock->time = $cutoff + $offsetFromCutoff;

        $this->submit($oath);

        self::assertSame(201, $this->client->getResponse()->getStatusCode());
        self::assertResponseHeaderSame('Cache-Control', 'no-store, private');
        $received = gmdate('Y-m-d\TH:i:s\Z', $this->clock->time);
        $body = $this->body();
        self::assertSame(['submissionId' => self::SUBMISSION, 'mode' => 'photo', 'receivedAt' => $received, 'revision' => 1, 'assessment' => 'queued'], $body['proof']);
        self::assertSame('proof_pending', $body['oath']['state']);
        self::assertSame($oath, $body['oath']['id']);
        self::assertSame($received, $body['serverTime']);
        $row = $this->connection->fetchAssociative('SELECT * FROM proof_submission');
        self::assertIsArray($row);
        self::assertSame([self::ACCOUNT, $oath, self::SUBMISSION, 1, 'photo', true, hash('sha256', $this->jpeg), $this->clock->time, 'queued'], [$row['account_id'], $row['oath_id'], $row['submission_id'], $row['revision'], $row['mode'], $row['declaration_confirmed'], $row['content_sha256'], $row['received_at'], $row['assessment_status']]);
        self::assertSame($this->connection->fetchOne('SELECT character_id FROM oath WHERE id = ?', [$oath]), $row['character_id']);
        self::assertSame('proof_pending', $this->connection->fetchOne('SELECT state FROM oath WHERE id = ?', [$oath]));
        self::assertSame([], $this->stored('staged'));
        self::assertSame([$row['storage_key']], $this->stored('objects'));
    }

    public function testReceiptAfterCutoffIsRefusedAfterLockedReconciliation(): void
    {
        $oath = $this->createOath();
        $this->clock->time = $this->cutoff($oath) + 1;

        $this->submit($oath);

        $this->assertError(409, ['code' => 'receipt_cutoff_passed']);
        self::assertSame(['review_pending', 'service_availability_unknown'], array_values((array) $this->connection->fetchAssociative('SELECT state, reason FROM oath WHERE id = ?', [$oath])));
        $this->assertNothingKept();
        // The Oath now enters the request already reconciled to review, which still answers with the cutoff and not with its state.
        $this->submit($oath);
        $this->assertError(409, ['code' => 'receipt_cutoff_passed']);
        $this->assertNothingKept();
    }

    /** @return iterable<string, array{?string}> */
    public static function unconfirmedDeclarations(): iterable
    {
        foreach (['missing' => null, 'false' => 'false', 'empty' => '', 'one' => '1', 'uppercase' => 'TRUE', 'padded' => ' true'] as $name => $value) { yield $name => [$value]; }
    }

    #[\PHPUnit\Framework\Attributes\DataProvider('unconfirmedDeclarations')]
    public function testDeclarationMustBeConfirmed(?string $declaration): void
    {
        $oath = $this->createOath();

        $this->submit($oath, ['declaration' => $declaration]);

        $this->assertError(422, ['code' => 'declaration_required', 'field' => 'declaration']);
        self::assertSame('active', $this->connection->fetchOne('SELECT state FROM oath WHERE id = ?', [$oath]));
        $this->assertNothingKept();
    }

    /** @return iterable<string, array{array<string, ?string>, ?string, int, array<string, string>}> */
    public static function invalidFields(): iterable
    {
        $field = static fn (string $code, string $name): array => ['code' => $code, 'field' => $name];
        yield 'missing submission' => [['submissionId' => null], 'jpeg', \UPLOAD_ERR_OK, $field('invalid_submission_id', 'submissionId')];
        yield 'uppercase submission' => [['submissionId' => strtoupper(self::SUBMISSION)], 'jpeg', \UPLOAD_ERR_OK, $field('invalid_submission_id', 'submissionId')];
        yield 'missing mode' => [['mode' => null], 'jpeg', \UPLOAD_ERR_OK, $field('invalid_mode', 'mode')];
        yield 'unknown mode' => [['mode' => 'video'], 'jpeg', \UPLOAD_ERR_OK, $field('invalid_mode', 'mode')];
        yield 'missing image' => [[], null, \UPLOAD_ERR_OK, $field('image_required', 'image')];
        yield 'no file uploaded' => [[], 'jpeg', \UPLOAD_ERR_NO_FILE, $field('image_required', 'image')];
        yield 'over the PHP upload limit' => [[], 'jpeg', \UPLOAD_ERR_INI_SIZE, $field('too_large', 'image')];
        yield 'png' => [[], 'png', \UPLOAD_ERR_OK, $field('unsupported_type', 'image')];
        yield 'over 10 MiB' => [[], 'huge', \UPLOAD_ERR_OK, $field('too_large', 'image')];
        yield 'long edge over 2880' => [[], 'wide', \UPLOAD_ERR_OK, $field('too_many_pixels', 'image')];
        yield 'truncated jpeg' => [[], 'truncated', \UPLOAD_ERR_OK, $field('unreadable_image', 'image')];
    }

    /**
     * @param array<string, ?string> $fields
     * @param array<string, string> $error
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('invalidFields')]
    public function testInvalidFieldsAreRefusedBeforeAnythingIsKept(array $fields, ?string $kind, int $uploadError, array $error): void
    {
        $oath = $this->createOath();
        $image = null;
        if (null !== $kind) {
            file_put_contents($this->upload, match ($kind) {
                'jpeg' => $this->jpeg,
                'png' => $this->png(),
                'huge' => $this->jpeg.str_repeat("\0", \App\Proof\ProofImageNormalizer::MAX_BYTES + 1 - strlen($this->jpeg)),
                'wide' => $this->makeJpeg(2881, 1),
                'truncated' => substr($this->jpeg, 0, intdiv(strlen($this->jpeg), 2)),
                default => throw new \LogicException('Unknown image kind.'),
            });
            $image = new UploadedFile($this->upload, 'proof.jpg', 'image/jpeg', $uploadError, true);
        }

        $this->submit($oath, $fields, $image, withImage: null !== $kind);

        $this->assertError(422, $error);
        self::assertSame('active', $this->connection->fetchOne('SELECT state FROM oath WHERE id = ?', [$oath]));
        $this->assertNothingKept();
    }

    public function testOnlyActiveOathsAcceptAFirstProof(): void
    {
        $scheduled = $this->createOath();
        $withdrawn = $this->createOath();
        $this->clock->time = self::D;
        // Activation stays after R, so the locked reconciliation cannot activate it.
        $this->connection->executeStatement("UPDATE oath SET state = 'scheduled', activation_at = ?, activated_at = NULL WHERE id = ?", [self::D + 60, $scheduled]);
        $this->connection->executeStatement("UPDATE oath SET state = 'withdrawn', terminal_at = ?, reason = 'character_paused' WHERE id = ?", [self::D - 60, $withdrawn]);

        $this->submit($scheduled);
        $this->assertError(409, ['code' => 'oath_not_active', 'state' => 'scheduled']);
        $this->submit($withdrawn);
        $this->assertError(409, ['code' => 'oath_not_active', 'state' => 'withdrawn']);
        $this->assertNothingKept();
        self::assertSame(['scheduled', 'withdrawn'], [$this->connection->fetchOne('SELECT state FROM oath WHERE id = ?', [$scheduled]), $this->connection->fetchOne('SELECT state FROM oath WHERE id = ?', [$withdrawn])]);
    }

    public function testSecondSubmissionForPendingProofIsRefused(): void
    {
        $oath = $this->createOath();
        $this->clock->time = self::D;
        $this->submit($oath, ['mode' => 'activity_record']);
        self::assertSame(201, $this->client->getResponse()->getStatusCode());
        self::assertSame('activity_record', $this->body()['proof']['mode']);
        $first = $this->connection->fetchAssociative('SELECT * FROM proof_submission');
        self::assertIsArray($first);
        $this->clock->time = $this->cutoff($oath) + 60;

        $this->submit($oath, ['submissionId' => '00000000-0000-4000-a000-000000000002']);

        $this->assertError(409, ['code' => 'proof_already_submitted']);
        self::assertSame([$first], $this->connection->fetchAllAssociative('SELECT * FROM proof_submission'));
        self::assertSame('proof_pending', $this->connection->fetchOne('SELECT state FROM oath WHERE id = ?', [$oath]));
        self::assertSame([], $this->stored('staged'));
        self::assertSame([$first['storage_key']], $this->stored('objects'));
    }

    public function testOnlyTheOwningAccountAndActiveCharacterCanSubmit(): void
    {
        $own = $this->createOath();
        CharacterFixture::activate($this->connection, self::ACCOUNT, 2);
        $this->clock->time = self::D;

        $this->submit($own);
        $this->assertError(404, ['code' => 'not_found']);

        $other = '00000000-0000-4000-8000-000000000002';
        $this->connection->insert('account', ['id' => $other, 'created_at' => $this->clock->time, 'onboarding_status' => 'complete']);
        CharacterFixture::activate($this->connection, $other);
        $this->connection->executeStatement('UPDATE app_session SET account_id = ?', [$other]);
        foreach ([$own, self::ACCOUNT, 'malformed'] as $id) {
            $this->submit($id);
            $this->assertError(404, ['code' => 'not_found']);
        }
        self::assertSame('active', $this->connection->fetchOne('SELECT state FROM oath WHERE id = ?', [$own]));
        $this->assertNothingKept();
    }

    public function testMissingOrRevokedSessionIsUnauthenticated(): void
    {
        $oath = $this->createOath();
        $this->clock->time = self::D;

        $this->submit($oath, server: ['HTTP_AUTHORIZATION' => '']);
        $this->assertError(401, ['code' => 'unauthenticated']);
        $this->connection->executeStatement('UPDATE app_session SET revoked_at = ?', [$this->clock->time]);
        $this->submit($oath);
        $this->assertError(401, ['code' => 'unauthenticated']);
        self::assertSame('active', $this->connection->fetchOne('SELECT state FROM oath WHERE id = ?', [$oath]));
        $this->assertNothingKept();
    }

    public function testUnavailableStorageIsASafeRetryableFailure(): void
    {
        $oath = $this->createOath();
        $this->clock->time = self::D;
        // A regular file where the storage directory should be makes every write fail.
        touch($this->directory);

        $this->submit($oath);

        $this->assertError(503, ['code' => 'temporarily_unavailable']);
        self::assertSame('active', $this->connection->fetchOne('SELECT state FROM oath WHERE id = ?', [$oath]));
        self::assertSame(0, (int) $this->connection->fetchOne('SELECT COUNT(*) FROM proof_submission'));
    }

    public function testRequestShapeIsCheckedBeforeFields(): void
    {
        $oath = $this->createOath();
        $this->clock->time = self::D;
        $path = '/api/oaths/'.$oath.'/proofs';
        $auth = ['HTTP_AUTHORIZATION' => 'Bearer '.self::TOKEN];

        $this->client->request('POST', $path, server: $auth + ['CONTENT_TYPE' => 'application/json'], content: '{}');
        $this->assertError(415, ['code' => 'unsupported_media_type']);
        // PHP drops every field of a body above post_max_size, so the declared length is the only signal left.
        $this->client->request('POST', $path, server: $auth + ['CONTENT_TYPE' => 'multipart/form-data; boundary=x', 'CONTENT_LENGTH' => (string) (ini_parse_quantity((string) ini_get('post_max_size')) + 1)]);
        $this->assertError(413, ['code' => 'request_too_large']);
        $this->submit($oath, ['accountId' => self::ACCOUNT]);
        $this->assertError(400, ['code' => 'invalid_request']);
        $this->client->request('POST', $path.'?mode=photo', ['submissionId' => self::SUBMISSION, 'mode' => 'photo', 'declaration' => 'true'], server: $auth + ['CONTENT_TYPE' => 'multipart/form-data']);
        $this->assertError(400, ['code' => 'invalid_request']);
        file_put_contents($this->upload, $this->jpeg);
        $this->client->request('POST', $path, ['submissionId' => self::SUBMISSION, 'mode' => 'photo', 'declaration' => 'true'], ['image' => [new UploadedFile($this->upload, 'a.jpg', 'image/jpeg', null, true)]], $auth + ['CONTENT_TYPE' => 'multipart/form-data']);
        $this->assertError(400, ['code' => 'invalid_request']);
        $this->client->request('POST', $path, ['submissionId' => self::SUBMISSION, 'mode' => 'photo', 'declaration' => 'true'], ['image' => new UploadedFile($this->upload, 'a.jpg', 'image/jpeg', null, true), 'extra' => new UploadedFile($this->upload, 'b.jpg', 'image/jpeg', null, true)], $auth + ['CONTENT_TYPE' => 'multipart/form-data']);
        $this->assertError(400, ['code' => 'invalid_request']);
        $this->submit($oath, ['mode' => null], server: ['CONTENT_TYPE' => 'multipart/form-data'], fieldArrays: ['mode' => ['photo']]);
        $this->assertError(400, ['code' => 'invalid_request']);
        $this->assertNothingKept();
    }

    public function testFailedCommitAfterPromotionLeavesNoProofObject(): void
    {
        $oath = $this->createOath();
        $this->clock->time = self::D;
        // A deferred constraint trigger fails at COMMIT, after the object has already been promoted.
        $this->connection->executeStatement("CREATE OR REPLACE FUNCTION test_fail_proof_commit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic commit failure'; END $$");
        $this->connection->executeStatement('DROP TRIGGER IF EXISTS test_fail_proof_commit ON proof_submission');
        $this->connection->executeStatement('CREATE CONSTRAINT TRIGGER test_fail_proof_commit AFTER INSERT ON proof_submission DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION test_fail_proof_commit()');
        try {
            $this->submit($oath);
        } finally {
            $this->connection->executeStatement('DROP TRIGGER IF EXISTS test_fail_proof_commit ON proof_submission');
            $this->connection->executeStatement('DROP FUNCTION IF EXISTS test_fail_proof_commit()');
        }

        $this->assertError(503, ['code' => 'temporarily_unavailable']);
        self::assertSame('active', $this->connection->fetchOne('SELECT state FROM oath WHERE id = ?', [$oath]));
        $this->assertNothingKept();
    }

    public function testPartialUploadIsARetryableFailure(): void
    {
        $oath = $this->createOath();
        file_put_contents($this->upload, $this->jpeg);

        $this->submit($oath, image: new UploadedFile($this->upload, 'proof.jpg', 'image/jpeg', \UPLOAD_ERR_PARTIAL, true));

        $this->assertError(503, ['code' => 'temporarily_unavailable']);
        $this->assertNothingKept();
    }

    public function testLogsHoldNoProofBytesStorageKeyOrDeclaration(): void
    {
        $oath = $this->createOath();
        $logger = self::getContainer()->get(\App\Tests\Fixtures\RecordingLogger::class);
        self::assertInstanceOf(\App\Tests\Fixtures\RecordingLogger::class, $logger);
        $logger->records = [];
        $this->clock->time = self::D;

        $this->submit($oath);
        $this->clock->time = $this->cutoff($oath) + 1;
        $this->submit($oath, ['submissionId' => '00000000-0000-4000-a000-000000000002']);
        $this->submit($oath, ['declaration' => 'false']);

        $key = $this->connection->fetchOne('SELECT storage_key FROM proof_submission');
        self::assertIsString($key);
        self::assertNotSame([], $logger->records);
        $logged = serialize($logger->records);
        foreach ([$key, $this->jpeg, substr($this->jpeg, 0, 32), base64_encode($this->jpeg), hash('sha256', $this->jpeg), $this->directory] as $secret) {
            self::assertStringNotContainsString($secret, $logged);
        }
        $copy = json_decode((string) $this->connection->fetchOne('SELECT snapshot FROM oath WHERE id = ?', [$oath]), true, flags: JSON_THROW_ON_ERROR)['copy'];
        foreach (['pl', 'en'] as $language) { self::assertStringNotContainsString($copy[$language]['declaration'], $logged); }
    }

    public function testStorageEnforcesOneRevisionPerOathAndKnownValues(): void
    {
        $oath = $this->createOath();
        $this->clock->time = self::D;
        $this->submit($oath);
        $row = $this->connection->fetchAssociative('SELECT * FROM proof_submission');
        self::assertIsArray($row);
        unset($row['id']);
        $variants = [
            '23505' => [['submission_id' => '00000000-0000-4000-a000-000000000002', 'storage_key' => str_repeat('b', 32)], ['revision' => 2, 'storage_key' => str_repeat('c', 32)]],
            '23514' => [['revision' => 0], ['mode' => 'video'], ['declaration_confirmed' => false], ['assessment_status' => 'passed'], ['storage_key' => '../escape']],
        ];
        foreach ($variants as $state => $changes) {
            foreach ($changes as $change) {
                $this->connection->beginTransaction();
                try {
                    $this->connection->insert('proof_submission', $change + $row, ['declaration_confirmed' => \Doctrine\DBAL\ParameterType::BOOLEAN]);
                    self::fail('Constraint did not reject '.json_encode($change));
                } catch (\Doctrine\DBAL\Exception\DriverException $exception) {
                    self::assertSame((string) $state, $exception->getSQLState());
                } finally { $this->connection->rollBack(); }
            }
        }
    }

    /** @param array<string, string> $error */
    private function assertError(int $status, array $error): void
    {
        self::assertSame($status, $this->client->getResponse()->getStatusCode());
        self::assertSame(['error' => $error], $this->body());
        self::assertResponseHeaderSame('Cache-Control', 'no-store, private');
    }

    private function assertNothingKept(): void
    {
        self::assertSame(0, (int) $this->connection->fetchOne('SELECT COUNT(*) FROM proof_submission'));
        self::assertSame([], $this->stored('staged'));
        self::assertSame([], $this->stored('objects'));
    }

    private function createOath(): string
    {
        $this->json('POST', '/api/oath-previews', ['activity' => 'running', 'activation' => ['mode' => 'now'], 'deadline' => ['local' => gmdate('Y-m-d\TH:i:s', self::D), 'timezone' => 'UTC']]);
        $preview = $this->body()['preview']['id'];
        $this->json('POST', '/api/oaths', ['previewId' => $preview, 'requestId' => $preview, 'accepted' => true]);
        self::assertSame(201, $this->client->getResponse()->getStatusCode());
        return $this->body()['oath']['id'];
    }

    private function cutoff(string $oath): int
    {
        $cutoff = $this->connection->fetchOne('SELECT receipt_cutoff FROM oath WHERE id = ?', [$oath]);
        self::assertIsInt($cutoff);
        return $cutoff;
    }

    /**
     * @param array<string, ?string> $fields A null value leaves that field out.
     * @param array<string, mixed> $server
     * @param array<string, list<string>> $fieldArrays Fields sent as arrays instead of strings.
     */
    private function submit(string $oath, array $fields = [], ?UploadedFile $image = null, array $server = [], bool $withImage = true, array $fieldArrays = []): void
    {
        $fields = $fieldArrays + array_filter($fields + ['submissionId' => self::SUBMISSION, 'mode' => 'photo', 'declaration' => 'true'], static fn (?string $value): bool => null !== $value);
        if ($withImage && null === $image) {
            file_put_contents($this->upload, $this->jpeg);
            $image = new UploadedFile($this->upload, 'proof.jpg', 'image/jpeg', null, true);
        }
        $this->client->request('POST', '/api/oaths/'.$oath.'/proofs', $fields, null === $image ? [] : ['image' => $image], $server + ['HTTP_AUTHORIZATION' => 'Bearer '.self::TOKEN, 'CONTENT_TYPE' => 'multipart/form-data']);
    }

    /** @return list<string> */
    private function stored(string $state): array
    {
        $names = array_map('basename', glob($this->directory.'/'.$state.'/*') ?: []);
        sort($names);
        return $names;
    }

    private function png(): string
    {
        $stream = fopen('php://memory', 'w+b');
        self::assertNotFalse($stream);
        imagepng(imagecreatetruecolor(8, 8), $stream);
        rewind($stream);
        return (string) stream_get_contents($stream);
    }

    /**
     * @param positive-int $width
     * @param positive-int $height
     */
    private function makeJpeg(int $width = 64, int $height = 64): string
    {
        $image = imagecreatetruecolor($width, $height);
        imagefilledrectangle($image, 0, 0, intdiv($width, 2), intdiv($height, 2), 0x8A4B2C);
        $stream = fopen('php://memory', 'w+b');
        self::assertNotFalse($stream);
        imagejpeg($image, $stream, 85);
        rewind($stream);
        return (string) stream_get_contents($stream);
    }

    /** @param array<string, mixed> $input */
    private function json(string $method, string $path, array $input): void
    {
        $this->client->request($method, $path, server: ['HTTP_AUTHORIZATION' => 'Bearer '.self::TOKEN, 'CONTENT_TYPE' => 'application/json'], content: json_encode($input, JSON_THROW_ON_ERROR));
    }

    /** @return array<string, mixed> */
    private function body(): array { return json_decode((string) $this->client->getResponse()->getContent(), true, flags: JSON_THROW_ON_ERROR); }
}
