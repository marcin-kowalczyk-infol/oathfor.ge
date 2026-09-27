<?php

declare(strict_types=1);

namespace App\Tests\Integration;

use App\Identity\{AppleLoginFailure, IssuedAppSession};
use App\Tests\Fixtures\{AppleLoginFixture, AppleTokenFixture, LockWait};
use Doctrine\DBAL\Connection;
use PHPUnit\Framework\Attributes\DataProvider;
use Symfony\Component\HttpClient\Response\MockResponse;
use Symfony\Component\Process\Process;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;

final class AppleLoginTest extends KernelTestCase
{
    private Connection $connection;
    private AppleLoginFixture $fixture;

    protected function setUp(): void
    {
        self::bootKernel();
        $connection = self::getContainer()->get(Connection::class);
        self::assertInstanceOf(Connection::class, $connection);
        $this->connection = $connection;
        self::assertSame('oathforge_test', $connection->fetchOne('SELECT current_database()'));
        $connection->executeStatement('TRUNCATE app_session, provider_identity, account, login_challenge CASCADE');
        $this->fixture = new AppleLoginFixture($connection);
        $this->fixture->seedChallenge();
    }

    protected function tearDown(): void
    {
        $this->fixture->cleanup();
        parent::tearDown();
    }

    public function testSignedNativeAndProviderExchangeCommitsOneLogin(): void
    {
        $result = $this->login();
        self::assertInstanceOf(IssuedAppSession::class, $result);
        self::assertSame('pending', $result->account->onboardingStatus);
        self::assertSame($this->fixture->clock->now(), $this->connection->fetchOne('SELECT consumed_at FROM login_challenge'));
        self::assertSame(1, $this->connection->fetchOne('SELECT COUNT(*) FROM app_session'));
        self::assertSame(1, $this->fixture->httpClient->getRequestsCount());
    }

    public function testReplayDeniesWithoutCallingProviderAndDifferentChallengeReusesAccount(): void
    {
        $first = $this->login();
        self::assertInstanceOf(IssuedAppSession::class, $first);
        self::assertSame(AppleLoginFailure::ChallengeUnavailable, $this->login());
        self::assertSame(1, $this->fixture->httpClient->getRequestsCount());
        $id = str_repeat('B', 43);
        $this->fixture->seedChallenge($id);
        $second = $this->login($id);
        self::assertInstanceOf(IssuedAppSession::class, $second);
        self::assertSame($first->account->id, $second->account->id);
        self::assertSame(2, $this->connection->fetchOne('SELECT COUNT(*) FROM app_session'));
    }

    public function testInvalidNativeAndUnknownOrExpiredChallengeNeverReachProvider(): void
    {
        self::assertSame(AppleLoginFailure::InvalidCredential, $this->fixture->service->login(AppleTokenFixture::NONCE, $this->fixture->tokenFixture->token(['nonce' => str_repeat('B', 43)]), 'DUMMY-code'));
        self::assertSame(AppleLoginFailure::ChallengeUnavailable, $this->login(str_repeat('B', 43)));
        $this->connection->executeStatement('UPDATE login_challenge SET expires_at = ?', [$this->fixture->clock->now()]);
        self::assertSame(AppleLoginFailure::ChallengeUnavailable, $this->login());
        self::assertSame(0, $this->fixture->httpClient->getRequestsCount());
        self::assertSame(0, $this->connection->fetchOne('SELECT COUNT(*) FROM app_session'));
    }

    public function testDatabaseFailureRollsBackConsumedChallengeAndEveryLocalWrite(): void
    {
        $this->connection->executeStatement('ALTER TABLE app_session ADD CONSTRAINT dummy_write_failure CHECK (false) NOT VALID');
        try {
            self::assertSame(AppleLoginFailure::Unavailable, $this->login());
            self::assertFalse($this->connection->isTransactionActive());
            self::assertNull($this->connection->fetchOne('SELECT consumed_at FROM login_challenge'));
            foreach (['account', 'provider_identity', 'app_session'] as $table) {
                self::assertSame(0, $this->connection->fetchOne('SELECT COUNT(*) FROM '.$table));
            }
            self::assertSame(1, $this->fixture->httpClient->getRequestsCount());
        } finally {
            $this->connection->executeStatement('ALTER TABLE app_session DROP CONSTRAINT dummy_write_failure');
        }
    }

    public function testChallengeConsumedWhileProviderRespondsReturnsSafeConflict(): void
    {
        $this->fixture->cleanup();
        $this->fixture = new AppleLoginFixture($this->connection, response: function (): MockResponse {
            $this->connection->executeStatement('UPDATE login_challenge SET consumed_at = ?', [$this->fixture->clock->now()]);
            return $this->providerResponse();
        });
        self::assertSame(AppleLoginFailure::ChallengeUnavailable, $this->login());
        self::assertSame(0, $this->connection->fetchOne('SELECT COUNT(*) FROM account'));
    }

    public function testMissingEncryptionConfigRollsBackAfterSuccessfulProviderExchange(): void
    {
        unlink($this->fixture->keyringPath);
        self::assertSame(AppleLoginFailure::Unavailable, $this->login());
        self::assertNull($this->connection->fetchOne('SELECT consumed_at FROM login_challenge'));
        self::assertSame(0, $this->connection->fetchOne('SELECT COUNT(*) FROM account'));
        self::assertSame(1, $this->fixture->httpClient->getRequestsCount());
    }

    /** @return iterable<string, array{int, string, AppleLoginFailure}> */
    public static function rejectedProviderResponses(): iterable
    {
        yield 'invalid one-use code' => [400, '{"error":"invalid_grant"}', AppleLoginFailure::InvalidCredential];
        yield 'provider outage' => [503, '{"error":"DUMMY-private-detail"}', AppleLoginFailure::Unavailable];
        yield 'malformed success' => [200, '{', AppleLoginFailure::Unavailable];
        yield 'missing refresh token' => [200, '{"id_token":"DUMMY-token"}', AppleLoginFailure::Unavailable];
    }

    #[DataProvider('rejectedProviderResponses')]
    public function testProviderFailureHasNoLocalWritesOrConsumption(int $status, string $body, AppleLoginFailure $failure): void
    {
        $this->fixture->cleanup();
        $this->fixture = new AppleLoginFixture($this->connection, response: fn () => new MockResponse($body, ['http_code' => $status]));
        self::assertSame($failure, $this->login());
        self::assertSame(1, $this->fixture->httpClient->getRequestsCount());
        self::assertNull($this->connection->fetchOne('SELECT consumed_at FROM login_challenge'));
        self::assertSame(0, $this->connection->fetchOne('SELECT COUNT(*) FROM account'));
    }

    public function testServerDigestMutationAfterVerificationCannotConsumeChallenge(): void
    {
        $this->fixture->cleanup();
        $this->fixture = new AppleLoginFixture($this->connection, response: function (): MockResponse {
            $this->connection->executeStatement('UPDATE login_challenge SET nonce_digest = ?', [hash('sha256', 'DUMMY-other')]);
            return $this->providerResponse();
        });
        self::assertSame(AppleLoginFailure::InvalidCredential, $this->login());
        self::assertNull($this->connection->fetchOne('SELECT consumed_at FROM login_challenge'));
        self::assertSame(0, $this->connection->fetchOne('SELECT COUNT(*) FROM account'));
    }

    public function testDeletingAccountCannotRegainAccessAndConsumptionRollsBack(): void
    {
        self::assertInstanceOf(IssuedAppSession::class, $this->login());
        $this->connection->executeStatement("UPDATE account SET status = 'deleting'");
        $id = str_repeat('B', 43);
        $this->fixture->seedChallenge($id);
        self::assertSame(AppleLoginFailure::InvalidCredential, $this->login($id));
        self::assertNull($this->connection->fetchOne('SELECT consumed_at FROM login_challenge WHERE id = ?', [$id]));
        self::assertSame(1, $this->connection->fetchOne('SELECT COUNT(*) FROM app_session'));
    }

    public function testConcurrentSameChallengeCreatesAtMostOneSession(): void
    {
        $this->connection->beginTransaction();
        $this->connection->fetchOne('SELECT id FROM login_challenge WHERE id = ? FOR UPDATE', [AppleTokenFixture::NONCE]);
        $worker = $this->worker(AppleTokenFixture::NONCE);
        try {
            $this->assertWaitingOnLock($worker);
            self::assertInstanceOf(IssuedAppSession::class, $this->login());
            $this->connection->commit();
            self::assertSame(['failure' => 'ChallengeUnavailable'], $this->workerResult($worker));
            self::assertSame(1, $this->connection->fetchOne('SELECT COUNT(*) FROM app_session'));
            self::assertSame(1, $this->connection->fetchOne('SELECT COUNT(*) FROM account'));
        } finally {
            $worker->stop();
            if ($this->connection->isTransactionActive()) { $this->connection->rollBack(); }
        }
    }

    public function testVerifiedExchangeExpiryDuringAccountWaitRollsBackChallengeAndCredentials(): void
    {
        $first = $this->login();
        self::assertInstanceOf(IssuedAppSession::class, $first);
        $id = str_repeat('B', 43);
        $this->fixture->seedChallenge($id);
        $envelope = $this->connection->fetchOne('SELECT refresh_envelope FROM provider_identity');
        $clockPath = tempnam(sys_get_temp_dir(), 'oathforge-DUMMY-login-clock-');
        self::assertIsString($clockPath);
        file_put_contents($clockPath, (string) $this->fixture->clock->now());
        $this->connection->beginTransaction();
        $this->connection->fetchOne('SELECT id FROM account WHERE id = ? FOR UPDATE', [$first->account->id]);
        $worker = $this->worker($id, $clockPath);
        try {
            $this->assertWaitingOnLock($worker);
            file_put_contents($clockPath, (string) ($this->fixture->clock->now() + 300));
            $this->connection->commit();
            self::assertSame(['failure' => 'ChallengeUnavailable'], $this->workerResult($worker));
            self::assertNull($this->connection->fetchOne('SELECT consumed_at FROM login_challenge WHERE id = ?', [$id]));
            self::assertSame($envelope, $this->connection->fetchOne('SELECT refresh_envelope FROM provider_identity'));
            self::assertSame(1, $this->connection->fetchOne('SELECT COUNT(*) FROM app_session'));
        } finally {
            $worker->stop();
            if ($this->connection->isTransactionActive()) { $this->connection->rollBack(); }
            unlink($clockPath);
        }
    }

    private function worker(string $id, ?string $clockPath = null): Process
    {
        $arguments = [PHP_BINARY, 'tests/Fixtures/apple_login_worker.php', $id];
        if (null !== $clockPath) { $arguments[] = $clockPath; }
        $worker = new Process($arguments, dirname(__DIR__, 2));
        $worker->setTimeout(LockWait::WORKER_TIMEOUT);
        $worker->start();
        return $worker;
    }

    private function assertWaitingOnLock(Process $worker): void
    {
        LockWait::assertWorkerWaiting($this->connection, $worker, 'Exchange worker');
    }

    /** @return array<string, mixed> */
    private function workerResult(Process $worker): array
    {
        $worker->wait();
        self::assertSame(0, $worker->getExitCode(), $worker->getErrorOutput());
        self::assertSame('', $worker->getErrorOutput());
        return json_decode(explode("\n", $worker->getOutput(), 2)[1], true, flags: JSON_THROW_ON_ERROR);
    }

    private function providerResponse(): MockResponse
    {
        return new MockResponse(json_encode(['id_token' => $this->fixture->tokenFixture->token(), 'refresh_token' => 'DUMMY-refresh'], JSON_THROW_ON_ERROR));
    }

    private function login(string $id = AppleTokenFixture::NONCE): IssuedAppSession|AppleLoginFailure
    {
        return $this->fixture->service->login($id, $this->fixture->tokenFixture->token(), 'DUMMY-code');
    }
}
