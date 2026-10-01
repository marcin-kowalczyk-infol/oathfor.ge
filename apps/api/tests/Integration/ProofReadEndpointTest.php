<?php

declare(strict_types=1);
namespace App\Tests\Integration;

use App\Identity\Clock;
use App\Tests\Fixtures\{CharacterFixture, FixedClock};
use Doctrine\DBAL\Connection;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\HttpFoundation\File\UploadedFile;

/** Owner-only proof metadata in Oath reads and the private proof image (MVP-07-T06). */
final class ProofReadEndpointTest extends WebTestCase
{
    private const ACCOUNT = '00000000-0000-4000-8000-000000000001';
    private const OTHER_ACCOUNT = '00000000-0000-4000-8000-000000000002';
    private const TOKEN = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    private const SUBMISSION = '00000000-0000-4000-a000-000000000001';
    private const SECOND_SUBMISSION = '00000000-0000-4000-a000-000000000002';
    /** 2027-01-15T16:00:00Z, two hours before the Oath deadline D. */
    private const START = 1800028800;
    private const D = self::START + 7200;
    private Connection $connection;
    private KernelBrowser $client;
    private FixedClock $clock;
    private string $directory;
    private string $upload;
    /** @var array{?string, ?string} */
    private array $previousDirectory;

    protected function setUp(): void
    {
        // The real wiring reads PROOF_STORAGE_DIR when the storage service is first built, so each test gets its own directory.
        $this->directory = sys_get_temp_dir().'/oathforge-proof-read-'.bin2hex(random_bytes(8));
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
        if (is_file($this->upload)) { unlink($this->upload); }
        [$env, $server] = $this->previousDirectory;
        if (null === $env) { unset($_ENV['PROOF_STORAGE_DIR']); } else { $_ENV['PROOF_STORAGE_DIR'] = $env; }
        if (null === $server) { unset($_SERVER['PROOF_STORAGE_DIR']); } else { $_SERVER['PROOF_STORAGE_DIR'] = $server; }
        parent::tearDown();
    }

    public function testOwnerDetailShowsTheOriginalReceiptAndAnOathWithoutProofHasNone(): void
    {
        [$proven, $preview] = $this->createOath();
        [$plain] = $this->createOath();
        $this->clock->time = self::START + 60;
        $this->submit($proven, self::SUBMISSION);
        self::assertSame(201, $this->client->getResponse()->getStatusCode());
        $receipt = ['submissionId' => self::SUBMISSION, 'mode' => 'photo', 'receivedAt' => gmdate('Y-m-d\TH:i:s\Z', self::START + 60), 'revision' => 1, 'assessment' => 'queued'];
        self::assertSame($receipt, $this->body()['proof']);
        self::assertSame($receipt, $this->body()['oath']['proof']);
        $this->clock->time = self::START + 600;

        $this->get('/api/oaths/'.$proven);

        self::assertSame(200, $this->client->getResponse()->getStatusCode());
        self::assertSame('proof_pending', $this->body()['oath']['state']);
        self::assertSame($receipt, $this->body()['oath']['proof']);
        $this->get('/api/oaths/'.$plain);
        self::assertSame(200, $this->client->getResponse()->getStatusCode());
        self::assertArrayHasKey('proof', $this->body()['oath']);
        self::assertNull($this->body()['oath']['proof']);
        // An acceptance replay answers with the current Oath, so it carries the proof too.
        $this->json('POST', '/api/oaths', ['previewId' => $preview, 'requestId' => $preview, 'accepted' => true]);
        self::assertSame(200, $this->client->getResponse()->getStatusCode());
        self::assertSame($receipt, $this->body()['oath']['proof']);
    }

    public function testListsCarryTheProofOfEachItem(): void
    {
        [$proven] = $this->createOath();
        [$plain] = $this->createOath();
        $this->submit($proven, self::SUBMISSION);
        $receipt = $this->body()['proof'];

        $this->get('/api/oaths?view=today');

        $this->assertProofs([$proven => $receipt, $plain => null]);
        $this->connection->executeStatement("UPDATE oath SET state = 'withdrawn', terminal_at = ?, reason = 'character_paused' WHERE id IN (?, ?)", [$this->clock->time, $proven, $plain]);
        $this->get('/api/oaths?view=history');
        $this->assertProofs([$proven => $receipt, $plain => null]);
    }

    public function testReadsShowTheLatestRevision(): void
    {
        [$oath] = $this->createOath();
        [$plain] = $this->createOath();
        $this->submit($oath, self::SUBMISSION);
        // Corrections arrive in a later slice, so revision 2 is seeded directly with valid values.
        $this->connection->insert('proof_submission', ['account_id' => self::ACCOUNT, 'character_id' => $this->connection->fetchOne('SELECT character_id FROM oath WHERE id = ?', [$oath]), 'oath_id' => $oath, 'submission_id' => self::SECOND_SUBMISSION, 'revision' => 2, 'mode' => 'activity_record', 'declaration_confirmed' => 'true', 'content_sha256' => str_repeat('a', 64), 'storage_key' => str_repeat('b', 32), 'received_at' => self::START + 120, 'assessment_status' => 'queued', 'created_at' => self::START + 120]);
        $latest = ['submissionId' => self::SECOND_SUBMISSION, 'mode' => 'activity_record', 'receivedAt' => gmdate('Y-m-d\TH:i:s\Z', self::START + 120), 'revision' => 2, 'assessment' => 'queued'];

        $this->get('/api/oaths/'.$oath);

        self::assertSame(200, $this->client->getResponse()->getStatusCode());
        self::assertSame($latest, $this->body()['oath']['proof']);
        $this->get('/api/oaths?view=today');
        $this->assertProofs([$oath => $latest, $plain => null]);
        $this->connection->executeStatement("UPDATE oath SET state = 'withdrawn', terminal_at = ?, reason = 'character_paused' WHERE id IN (?, ?)", [$this->clock->time, $oath, $plain]);
        $this->get('/api/oaths?view=history');
        $this->assertProofs([$oath => $latest, $plain => null]);
    }

    public function testOwnerFetchesTheNormalizedImageWithoutCaching(): void
    {
        [$oath] = $this->createOath();
        $this->submit($oath, self::SUBMISSION);
        $objects = glob($this->directory.'/objects/*') ?: [];
        self::assertCount(1, $objects);

        $this->get('/api/oaths/'.$oath.'/proofs/'.self::SUBMISSION.'/image');

        $response = $this->client->getResponse();
        self::assertSame(200, $response->getStatusCode());
        self::assertSame(file_get_contents($objects[0]), $response->getContent());
        self::assertResponseHeaderSame('Content-Type', 'image/jpeg');
        self::assertResponseHeaderSame('Cache-Control', 'no-store, private');
        self::assertResponseHeaderSame('X-Content-Type-Options', 'nosniff');
    }

    public function testEveryoneElseGetsTheSameNotFound(): void
    {
        [$first] = $this->createOath();
        [$second] = $this->createOath();
        $this->submit($first, self::SUBMISSION);
        $this->submit($second, self::SECOND_SUBMISSION);
        $image = static fn (string $oath, string $submission): string => '/api/oaths/'.$oath.'/proofs/'.$submission.'/image';

        foreach ([
            'unknown submission' => $image($first, '00000000-0000-4000-a000-000000000009'),
            'submission of a different Oath' => $image($first, self::SECOND_SUBMISSION),
            'unknown Oath' => $image('00000000-0000-4000-8000-000000000009', self::SUBMISSION),
            'malformed Oath' => $image('malformed', self::SUBMISSION),
            'malformed submission' => $image($first, strtoupper(self::SUBMISSION)),
        ] as $name => $path) {
            $this->get($path);
            $this->assertError(404, ['code' => 'not_found'], $name);
        }
        CharacterFixture::activate($this->connection, self::ACCOUNT, 2);
        $this->get($image($first, self::SUBMISSION));
        $this->assertError(404, ['code' => 'not_found'], 'another character of the same account');
        $this->connection->insert('account', ['id' => self::OTHER_ACCOUNT, 'created_at' => $this->clock->time, 'onboarding_status' => 'complete']);
        CharacterFixture::activate($this->connection, self::OTHER_ACCOUNT);
        $this->connection->executeStatement('UPDATE app_session SET account_id = ?', [self::OTHER_ACCOUNT]);
        $this->get($image($first, self::SUBMISSION));
        $this->assertError(404, ['code' => 'not_found'], 'another account');
    }

    public function testImageNeedsASessionACharacterAndAPlainRequest(): void
    {
        [$oath] = $this->createOath();
        $this->submit($oath, self::SUBMISSION);
        $path = '/api/oaths/'.$oath.'/proofs/'.self::SUBMISSION.'/image';

        $this->get($path.'?size=small');
        $this->assertError(400, ['code' => 'invalid_request']);
        $this->connection->executeStatement('UPDATE account SET active_character_id = NULL');
        $this->get($path);
        $this->assertError(409, ['code' => 'character_required']);
        $this->get($path, ['HTTP_AUTHORIZATION' => '']);
        $this->assertError(401, ['code' => 'unauthenticated']);
        $this->connection->executeStatement('UPDATE app_session SET revoked_at = ?', [$this->clock->time]);
        $this->get($path);
        $this->assertError(401, ['code' => 'unauthenticated']);
    }

    public function testUnreadableStoredImageIsARetryableFailure(): void
    {
        [$oath] = $this->createOath();
        $this->submit($oath, self::SUBMISSION);
        foreach (glob($this->directory.'/objects/*') ?: [] as $object) { unlink($object); }

        $this->get('/api/oaths/'.$oath.'/proofs/'.self::SUBMISSION.'/image');

        $this->assertError(503, ['code' => 'temporarily_unavailable']);
    }

    /** @param array<string, string> $error */
    private function assertError(int $status, array $error, string $case = ''): void
    {
        self::assertSame($status, $this->client->getResponse()->getStatusCode(), $case);
        self::assertSame(['error' => $error], $this->body(), $case);
        self::assertResponseHeaderSame('Cache-Control', 'no-store, private');
    }

    /** Items keep the view order, so each ID is paired with its proof before comparing.
     * @param array<string, mixed> $expected
     */
    private function assertProofs(array $expected): void
    {
        self::assertSame(200, $this->client->getResponse()->getStatusCode());
        $proofs = [];
        foreach ($this->body()['items'] as $item) {
            self::assertArrayHasKey('proof', $item);
            $proofs[$item['id']] = $item['proof'];
        }
        ksort($proofs);
        ksort($expected);
        self::assertSame($expected, $proofs);
    }

    /** @return array{string, string} The Oath ID and its preview ID. */
    private function createOath(): array
    {
        $this->json('POST', '/api/oath-previews', ['activity' => 'running', 'activation' => ['mode' => 'now'], 'deadline' => ['local' => gmdate('Y-m-d\TH:i:s', self::D), 'timezone' => 'UTC']]);
        $preview = $this->body()['preview']['id'];
        $this->json('POST', '/api/oaths', ['previewId' => $preview, 'requestId' => $preview, 'accepted' => true]);
        self::assertSame(201, $this->client->getResponse()->getStatusCode());
        return [$this->body()['oath']['id'], $preview];
    }

    private function submit(string $oath, string $submission): void
    {
        file_put_contents($this->upload, $this->makeJpeg());
        $image = new UploadedFile($this->upload, 'proof.jpg', 'image/jpeg', null, true);
        $this->client->request('POST', '/api/oaths/'.$oath.'/proofs', ['submissionId' => $submission, 'mode' => 'photo', 'declaration' => 'true'], ['image' => $image], ['HTTP_AUTHORIZATION' => 'Bearer '.self::TOKEN, 'CONTENT_TYPE' => 'multipart/form-data']);
        self::assertSame(201, $this->client->getResponse()->getStatusCode());
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

    /** @param array<string, string> $server */
    private function get(string $path, array $server = []): void
    {
        $this->client->request('GET', $path, server: $server + ['HTTP_AUTHORIZATION' => 'Bearer '.self::TOKEN]);
    }

    /** @param array<string, mixed> $input */
    private function json(string $method, string $path, array $input): void
    {
        $this->client->request($method, $path, server: ['HTTP_AUTHORIZATION' => 'Bearer '.self::TOKEN, 'CONTENT_TYPE' => 'application/json'], content: json_encode($input, JSON_THROW_ON_ERROR));
    }

    /** @return array<string, mixed> */
    private function body(): array { return json_decode((string) $this->client->getResponse()->getContent(), true, flags: JSON_THROW_ON_ERROR); }
}
