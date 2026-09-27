<?php

declare(strict_types=1);

namespace App\Tests\Integration;

use App\Identity\ChallengeConsumption;
use App\Identity\Clock;
use App\Identity\LoginChallengeRepository;
use App\Identity\LoginChallengeService;
use App\Identity\SecureRandomSource;
use App\Identity\RandomSource;
use App\Identity\ChallengeUnavailable;
use App\Tests\Fixtures\FixedClock;
use App\Tests\Fixtures\LockWait;
use Doctrine\DBAL\Connection;
use PHPUnit\Framework\Attributes\DataProvider;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\Process\Process;

final class LoginChallengeTest extends WebTestCase
{
    private Connection $connection;
    private FixedClock $clock;
    private LoginChallengeRepository $repository;
    private LoginChallengeService $service;
    private KernelBrowser $client;

    protected function setUp(): void
    {
        $this->client = self::createClient();
        $this->client->disableReboot();
        $connection = self::getContainer()->get(Connection::class);
        self::assertInstanceOf(Connection::class, $connection);
        $this->connection = $connection;
        self::assertSame('oathforge_test', $connection->fetchOne('SELECT current_database()'));
        $connection->executeStatement('TRUNCATE login_challenge, auth_rate_bucket');
        $this->clock = new FixedClock();
        self::getContainer()->set(Clock::class, $this->clock);
        $this->repository = new LoginChallengeRepository($connection, $this->clock);
        $this->service = new LoginChallengeService($this->repository, $this->clock, new SecureRandomSource());
    }

    protected function tearDown(): void
    {
        if ($this->connection->isTransactionActive()) {
            $this->connection->rollBack();
        }
        parent::tearDown();
    }

    public function testIssuesIndependentRandomChallengesAndStoresOnlyNonceDigest(): void
    {
        $first = $this->request();
        self::assertResponseStatusCodeSame(201);
        self::assertResponseHeaderSame('cache-control', 'no-store, private');
        self::assertSame(['challengeId', 'nonce', 'state', 'expiresAt'], array_keys($first));
        $second = $this->request();
        $values = [];
        foreach ([$first, $second] as $body) {
            foreach (['challengeId', 'nonce', 'state'] as $field) {
                self::assertIsString($body[$field]);
                self::assertMatchesRegularExpression('/^[A-Za-z0-9_-]{43}$/D', $body[$field]);
                self::assertSame(32, strlen((string) base64_decode(strtr($body[$field], '-_', '+/'), true)));
                $values[] = $body[$field];
            }
            self::assertSame(gmdate('Y-m-d\TH:i:s\Z', $this->clock->time + 300), $body['expiresAt']);
            $row = $this->connection->fetchAssociative('SELECT * FROM login_challenge WHERE id = ?', [$body['challengeId']]);
            self::assertIsArray($row);
            self::assertSame(hash('sha256', $body['nonce']), $row['nonce_digest']);
            self::assertSame($this->clock->time, $row['created_at']);
            self::assertSame($this->clock->time + 300, $row['expires_at']);
            self::assertNull($row['consumed_at']);
            self::assertNotContains($body['nonce'], $row);
            self::assertNotContains($body['state'], $row);
        }
        self::assertCount(6, array_unique($values));
    }

    public function testConsumptionRejectsReplayAndWrongNonceAndRequiresCallerTransaction(): void
    {
        $challenge = $this->service->issue();
        $this->connection->beginTransaction();
        self::assertSame(ChallengeConsumption::InvalidNonce, $this->repository->consume($challenge['challengeId'], 'wrong'));
        self::assertSame(ChallengeConsumption::Unavailable, $this->repository->consume('unknown', $challenge['nonce']));
        self::assertSame(ChallengeConsumption::Consumed, $this->repository->consume($challenge['challengeId'], $challenge['nonce']));
        self::assertTrue($this->connection->isTransactionActive());
        self::assertSame(ChallengeConsumption::Unavailable, $this->repository->consume($challenge['challengeId'], $challenge['nonce']));
        $this->connection->commit();
        $this->expectException(\LogicException::class);
        $this->repository->consume($challenge['challengeId'], $challenge['nonce']);
    }

    public function testRollbackRestoresAvailabilityAndExactExpiryRejects(): void
    {
        $challenge = $this->service->issue();
        $this->clock->time += 299;
        $this->connection->beginTransaction();
        self::assertSame(ChallengeConsumption::Consumed, $this->repository->consume($challenge['challengeId'], $challenge['nonce']));
        $this->connection->rollBack();
        self::assertSame(ChallengeConsumption::Consumed, $this->connection->transactional(fn () => $this->repository->consume($challenge['challengeId'], $challenge['nonce'])));
        $expiring = $this->service->issue();
        $this->clock->time += 300;
        self::assertSame(ChallengeConsumption::Unavailable, $this->connection->transactional(fn () => $this->repository->consume($expiring['challengeId'], $expiring['nonce'])));

    }

    public function testConsumptionAfterExpiryIsUnavailable(): void
    {
        $challenge = $this->service->issue();
        $this->clock->time += 301;
        self::assertSame(ChallengeConsumption::Unavailable, $this->connection->transactional(fn () => $this->repository->consume($challenge['challengeId'], $challenge['nonce'])));
    }

    /** @return iterable<string, array{string, string, int, string}> */
    public static function invalidRequests(): iterable
    {
        yield 'media type' => ['{}', 'text/plain', 415, 'unsupported_media_type'];
        yield 'empty' => ['', 'application/json', 400, 'invalid_request'];
        yield 'malformed' => ['{', 'application/json', 400, 'invalid_request'];
        yield 'array' => ['[]', 'application/json', 400, 'invalid_request'];
        yield 'scalar' => ['null', 'application/json', 400, 'invalid_request'];
        yield 'unknown field' => ['{"nonce":"client-selected"}', 'application/json', 400, 'invalid_request'];
        yield 'oversized' => [str_repeat('x', 16385), 'application/json', 413, 'request_too_large'];
    }

    #[DataProvider('invalidRequests')]
    public function testMalformedRequestsHaveSafeErrors(string $body, string $type, int $status, string $code): void
    {
        self::assertSame(['error' => ['code' => $code]], $this->request($body, $type));
        self::assertResponseStatusCodeSame($status);
        self::assertResponseHeaderSame('cache-control', 'no-store, private');
        self::assertSame(0, $this->connection->fetchOne('SELECT COUNT(*) FROM login_challenge'));
    }

    public function testInvalidAttemptsCountAndForwardedAddressCannotBypassIpLimit(): void
    {
        for ($attempt = 0; $attempt < 10; ++$attempt) {
            $this->request('[]');
            self::assertResponseStatusCodeSame(400);
        }
        self::assertSame(['error' => ['code' => 'rate_limited']], $this->request());
        self::assertResponseStatusCodeSame(429);
        self::assertResponseHeaderSame('retry-after', '60');
        $this->clock->time += 60;
        $this->request();
        self::assertResponseStatusCodeSame(201);
        self::assertFalse($this->connection->fetchOne("SELECT bucket FROM auth_rate_bucket WHERE bucket = '192.0.2.1'"));
    }

    public function testGlobalLimitCountsRequestsAcrossIpsAndMinuteBoundaryResets(): void
    {
        $minute = intdiv($this->clock->time, 60);
        $this->connection->insert('auth_rate_bucket', ['route' => 'apple_challenge', 'bucket' => 'global', 'minute' => $minute, 'attempts' => 999]);
        $this->request(ip: '192.0.2.2');
        self::assertResponseStatusCodeSame(201);
        $this->request(ip: '192.0.2.3');
        self::assertResponseStatusCodeSame(429);
        $this->clock->time += 59;
        $this->request(ip: '192.0.2.4');
        self::assertResponseStatusCodeSame(429);
        self::assertResponseHeaderSame('retry-after', '1');
        ++$this->clock->time;
        $this->request();
        self::assertResponseStatusCodeSame(201);
    }

    public function testCleanupIsBoundedAndPreservesRetentionBoundaries(): void
    {
        $now = $this->clock->time;
        $this->connection->executeStatement("INSERT INTO login_challenge SELECT 'old-' || n, repeat('a', 64), ?, ?, NULL FROM generate_series(1, 1001) n", [$now - 90000, $now - 86401]);
        $this->connection->insert('login_challenge', ['id' => 'retained', 'nonce_digest' => str_repeat('b', 64), 'created_at' => $now - 90000, 'expires_at' => $now - 86400]);
        $this->connection->executeStatement("INSERT INTO auth_rate_bucket SELECT 'old', n::text, ?, 1 FROM generate_series(1, 1001) n", [intdiv($now, 60) - 61]);
        $this->connection->insert('auth_rate_bucket', ['route' => 'old', 'bucket' => 'retained', 'minute' => intdiv($now, 60) - 60, 'attempts' => 1]);
        $this->request();
        self::assertResponseStatusCodeSame(201);
        self::assertSame(1, $this->connection->fetchOne("SELECT COUNT(*) FROM login_challenge WHERE id LIKE 'old-%'"));
        self::assertSame(2, $this->connection->fetchOne("SELECT COUNT(*) FROM auth_rate_bucket WHERE route = 'old'"));
        self::assertSame('retained', $this->connection->fetchOne("SELECT id FROM login_challenge WHERE id = 'retained'"));
    }

    public function testCollisionRetriesWithoutOverwritingAndExhaustionIsSafe(): void
    {
        $existing = $this->service->issue();
        $idBytes = base64_decode(strtr($existing['challengeId'], '-_', '+/'), true);
        self::assertIsString($idBytes);
        $random = new class($idBytes) implements RandomSource {
            public int $calls = 0;
            public function __construct(private string $id) {}
            public function bytes(int $length): string
            {
                return 0 === $this->calls++ % 3 ? $this->id : str_repeat('x', $length);
            }
        };
        $service = new LoginChallengeService($this->repository, $this->clock, $random);
        try {
            $service->issue();
            self::fail('Three collisions must fail closed.');
        } catch (ChallengeUnavailable) {
            self::assertSame(9, $random->calls);
        }
        self::assertSame(1, $this->connection->fetchOne('SELECT COUNT(*) FROM login_challenge'));
        self::assertSame(hash('sha256', $existing['nonce']), $this->connection->fetchOne('SELECT nonce_digest FROM login_challenge WHERE id = ?', [$existing['challengeId']]));
        $retryRandom = new class($idBytes) implements RandomSource {
            private int $calls = 0;
            public function __construct(private string $id) {}
            public function bytes(int $length): string
            {
                return 0 === $this->calls++ ? $this->id : random_bytes($length);
            }
        };
        $retried = (new LoginChallengeService($this->repository, $this->clock, $retryRandom))->issue();
        self::assertNotSame($existing['challengeId'], $retried['challengeId']);
        self::assertSame(2, $this->connection->fetchOne('SELECT COUNT(*) FROM login_challenge'));
        self::getContainer()->set(RandomSource::class, $random);
        self::assertSame(['error' => ['code' => 'temporarily_unavailable']], $this->request());
        self::assertResponseStatusCodeSame(503);
    }

    public function testTwoConnectionsCannotConsumeTheSameChallenge(): void
    {
        // The worker uses real server time, so this fixture must also be live then.
        $this->clock->time = time();
        $challenge = $this->service->issue();
        $this->connection->beginTransaction();
        self::assertSame(ChallengeConsumption::Consumed, $this->repository->consume($challenge['challengeId'], $challenge['nonce']));
        $process = $this->worker(['consume', $challenge['challengeId'], $challenge['nonce']]);
        try {
            $this->assertWaitingOnLock($process);
            $this->connection->commit();
            $process->wait();
            self::assertSame(0, $process->getExitCode(), $process->getErrorOutput());
            self::assertSame('Unavailable', explode("\n", $process->getOutput())[1]);
        } finally {
            $process->stop();
        }
    }

    public function testExpiryIsRecheckedAfterWaitingForAnotherTransaction(): void
    {
        $this->clock->time = time();
        $challenge = $this->service->issue();
        $this->connection->beginTransaction();
        $this->connection->fetchOne('SELECT id FROM login_challenge WHERE id = ? FOR UPDATE', [$challenge['challengeId']]);
        $process = $this->worker(['consume', $challenge['challengeId'], $challenge['nonce']]);
        try {
            $this->assertWaitingOnLock($process);
            // Expire only after the worker waits, so a slow worker boot cannot expire it earlier.
            $expiry = time() + 1;
            $this->connection->executeStatement('UPDATE login_challenge SET expires_at = ? WHERE id = ?', [$expiry, $challenge['challengeId']]);
            while (time() < $expiry) {
                usleep(10000);
            }
            $this->connection->commit();
            $process->wait();
            self::assertSame(0, $process->getExitCode(), $process->getErrorOutput());
            self::assertSame('Unavailable', explode("\n", $process->getOutput())[1]);
            self::assertNull($this->connection->fetchOne('SELECT consumed_at FROM login_challenge WHERE id = ?', [$challenge['challengeId']]));
        } finally {
            $process->stop();
        }
    }

    /** @return iterable<string, array{bool}> */
    public static function rateRaces(): iterable
    {
        yield 'global' => [true];
        yield 'per IP' => [false];
    }

    #[DataProvider('rateRaces')]
    public function testConcurrentRateLimitAllowsOnlyTheLastAvailableSlot(bool $global): void
    {
        $minute = intdiv($this->clock->time, 60);
        $this->connection->insert('auth_rate_bucket', ['route' => 'apple_challenge', 'bucket' => 'global', 'minute' => $minute, 'attempts' => $global ? 999 : 9]);
        $this->connection->insert('auth_rate_bucket', ['route' => 'apple_challenge', 'bucket' => hash('sha256', '192.0.2.1'), 'minute' => $minute, 'attempts' => 9]);
        $this->connection->beginTransaction();
        $this->connection->fetchOne("SELECT attempts FROM auth_rate_bucket WHERE bucket = 'global' AND minute = ? FOR UPDATE", [$minute]);
        $first = $this->worker(['limit', '192.0.2.1', (string) $this->clock->time]);
        $second = $this->worker(['limit', $global ? '192.0.2.2' : '192.0.2.1', (string) $this->clock->time]);
        try {
            $this->assertWaitingOnLock($first);
            $this->assertWaitingOnLock($second);
            $this->connection->commit();
            $first->wait();
            $second->wait();
            self::assertSame(0, $first->getExitCode(), $first->getErrorOutput());
            self::assertSame(0, $second->getExitCode(), $second->getErrorOutput());
            $results = [(int) explode("\n", $first->getOutput())[1], (int) explode("\n", $second->getOutput())[1]];
            sort($results);
            self::assertSame(0, $results[0]);
            self::assertGreaterThan(0, $results[1]);
            self::assertSame($global ? 1001 : 11, $this->connection->fetchOne("SELECT attempts FROM auth_rate_bucket WHERE bucket = 'global' AND minute = ?", [$minute]));
        } finally {
            $first->stop();
            $second->stop();
        }
    }

    public function testDatabaseOutageReturnsOnlySafeRecoverableResponse(): void
    {
        $process = new Process([PHP_BINARY, 'tests/Fixtures/challenge_worker.php', 'outage'], dirname(__DIR__, 2), ['DATABASE_URL' => 'postgresql://DUMMY:DUMMY-never-log-this@127.0.0.1:1/unavailable?serverVersion=17']);
        $process->setTimeout(10);
        $process->run();
        self::assertSame(0, $process->getExitCode(), $process->getErrorOutput());
        self::assertSame([503, 'no-store, private', '{"error":{"code":"temporarily_unavailable"}}'], json_decode($process->getOutput(), true, flags: JSON_THROW_ON_ERROR));
        self::assertSame('', $process->getErrorOutput());
    }

    /** @param list<string> $arguments */
    private function worker(array $arguments): Process
    {
        $process = new Process([PHP_BINARY, 'tests/Fixtures/challenge_worker.php', ...$arguments], dirname(__DIR__, 2));
        $process->setTimeout(LockWait::WORKER_TIMEOUT);
        $process->start();
        return $process;
    }

    private function assertWaitingOnLock(Process $process): void
    {
        LockWait::assertWorkerWaiting($this->connection, $process, 'Challenge worker');
    }

    /** @return array<string, mixed> */
    private function request(string $body = '{}', string $type = 'application/json', string $ip = '192.0.2.1'): array
    {
        $this->client->request('POST', '/api/auth/apple/challenges', server: ['CONTENT_TYPE' => $type, 'REMOTE_ADDR' => $ip, 'HTTP_X_FORWARDED_FOR' => '198.51.100.'.random_int(1, 250)], content: $body);
        return json_decode((string) $this->client->getResponse()->getContent(), true, flags: JSON_THROW_ON_ERROR);
    }
}
