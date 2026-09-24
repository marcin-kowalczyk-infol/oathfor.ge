<?php

declare(strict_types=1);

namespace App\Tests\Integration;

use App\Identity\AccountSessionIssuer;
use App\Identity\AccountDeletionGate;
use App\Identity\AppSessionRepository;
use App\Identity\EncryptedProviderToken;
use App\Identity\LoginChallengeRepository;
use App\Identity\ChallengeConsumption;
use App\Identity\SessionIssuanceException;
use App\Identity\SessionIssuanceFailure;
use PHPUnit\Framework\Attributes\DataProvider;
use App\Identity\AppleAuthorization;
use App\Identity\ProviderTokenCipher;
use App\Identity\ProviderTokenKeyring;
use App\Identity\SecureRandomSource;
use App\Identity\VerifiedAppleIdentity;
use App\Tests\Fixtures\FixedClock;
use Doctrine\DBAL\Connection;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\Process\Process;

final class AccountSessionTest extends KernelTestCase
{
    private Connection $connection;
    private FixedClock $clock;
    private ProviderTokenCipher $cipher;
    private AccountSessionIssuer $issuer;
    private string $keyPath;

    protected function setUp(): void
    {
        self::bootKernel();
        $connection = self::getContainer()->get(Connection::class);
        self::assertInstanceOf(Connection::class, $connection);
        $this->connection = $connection;
        self::assertSame('oathforge_test', $connection->fetchOne('SELECT current_database()'));
        $connection->executeStatement('TRUNCATE app_session, provider_identity, account, login_challenge CASCADE');
        $path = tempnam(sys_get_temp_dir(), 'oathforge-DUMMY-session-key-');
        self::assertIsString($path);
        $this->keyPath = $path;
        file_put_contents($path, json_encode(['keys' => ['v1' => base64_encode(random_bytes(32))]], JSON_THROW_ON_ERROR));
        chmod($path, 0600);
        $this->clock = new FixedClock();
        $random = new SecureRandomSource();
        $this->cipher = new ProviderTokenCipher(new ProviderTokenKeyring($path, 'v1'), $random);
        $this->issuer = new AccountSessionIssuer($connection, $this->clock, $random, $this->cipher);
    }

    protected function tearDown(): void
    {
        if ($this->connection->isTransactionActive()) { $this->connection->rollBack(); }
        if (is_file($this->keyPath)) { unlink($this->keyPath); }
        parent::tearDown();
    }

    public function testReturningIdentityReusesAccountAndPreservesOnboarding(): void
    {
        $first = $this->connection->transactional(fn () => $this->issuer->issue($this->authorization(), $this->clock->time + 300));
        $this->connection->executeStatement("UPDATE account SET onboarding_status = 'complete' WHERE id = ?", [$first->account->id]);
        $second = $this->connection->transactional(fn () => $this->issuer->issue($this->authorization(), $this->clock->time + 300));
        self::assertSame($first->account->id, $second->account->id);
        self::assertSame('complete', $second->account->onboardingStatus);
        self::assertSame(1, $this->connection->fetchOne('SELECT COUNT(*) FROM account'));
        self::assertSame(1, $this->connection->fetchOne('SELECT COUNT(*) FROM provider_identity'));
        self::assertSame(2, $this->connection->fetchOne('SELECT COUNT(*) FROM app_session'));
    }

    public function testOnlyDigestsAndBoundCiphertextPersistAndAccessNeverExtendsExpiry(): void
    {
        $session = $this->connection->transactional(fn () => $this->issuer->issue($this->authorization(), $this->clock->time + 300));
        self::assertSame('pending', $session->account->onboardingStatus);
        self::assertMatchesRegularExpression('/^[A-Za-z0-9_-]{43}$/D', $session->token);
        self::assertSame(32, strlen((string) base64_decode(strtr($session->token, '-_', '+/'), true)));
        self::assertSame($this->clock->time + 2592000, $session->expiresAt);
        $row = $this->connection->fetchAssociative('SELECT * FROM app_session');
        self::assertIsArray($row);
        self::assertSame(hash('sha256', $session->token), $row['token_digest']);
        self::assertSame($this->clock->time, $row['issued_at']);
        self::assertSame($session->expiresAt, $row['expires_at']);
        self::assertNotContains($session->token, $row);
        $identity = $this->connection->fetchAssociative('SELECT id, refresh_envelope FROM provider_identity');
        self::assertIsArray($identity);
        self::assertStringNotContainsString('DUMMY-refresh-token', $identity['refresh_envelope']);
        $data = json_decode($identity['refresh_envelope'], true, flags: JSON_THROW_ON_ERROR);
        $envelope = new EncryptedProviderToken($data['version'], $data['keyId'], $data['nonce'], $data['ciphertext']);
        self::assertSame('DUMMY-refresh-token', $this->cipher->decrypt($envelope, $identity['id']));
        $repository = new AppSessionRepository($this->connection, $this->clock);
        $this->clock->time += 1000;
        self::assertSame($session->account->id, $repository->findActive($session->token)?->id);
        self::assertSame($session->expiresAt, $this->connection->fetchOne('SELECT expires_at FROM app_session'));
        $this->clock->time = $session->expiresAt;
        self::assertNull($repository->findActive($session->token));
    }

    public function testRevocationChangesOnlyPresentedSessionAndIsIdempotent(): void
    {
        $first = $this->connection->transactional(fn () => $this->issuer->issue($this->authorization(), $this->clock->time + 300));
        $second = $this->connection->transactional(fn () => $this->issuer->issue($this->authorization(), $this->clock->time + 300));
        $repository = new AppSessionRepository($this->connection, $this->clock);
        $repository->revoke($first->token);
        self::assertSame($this->clock->time, $this->connection->fetchOne('SELECT revoked_at FROM app_session WHERE token_digest = ?', [hash('sha256', $first->token)]));
        self::assertNull($repository->findActive($first->token));
        self::assertSame($second->account->id, $repository->findActive($second->token)?->id);
        ++$this->clock->time;
        $repository->revoke($first->token);
        self::assertSame($this->clock->time - 1, $this->connection->fetchOne('SELECT revoked_at FROM app_session WHERE token_digest = ?', [hash('sha256', $first->token)]));
    }

    /** @return iterable<string, array{string}> */
    public static function deniedAccountStatuses(): iterable
    {
        yield 'deleting' => ['deleting'];
        yield 'deleted' => ['deleted'];
    }

    #[DataProvider('deniedAccountStatuses')]
    public function testInactiveAccountCannotIssueSession(string $status): void
    {
        $session = $this->connection->transactional(fn () => $this->issuer->issue($this->authorization(), $this->clock->time + 300));
        $this->connection->executeStatement('UPDATE account SET status = ? WHERE id = ?', [$status, $session->account->id]);
        try {
            $this->connection->transactional(fn () => $this->issuer->issue($this->authorization(), $this->clock->time + 300));
            self::fail('Inactive account must not get a new session.');
        } catch (SessionIssuanceException $failure) {
            self::assertSame(SessionIssuanceFailure::InvalidCredential, $failure->reason);
        }
        self::assertSame(1, $this->connection->fetchOne('SELECT COUNT(*) FROM app_session'));
    }

    public function testExactChallengeExpiryRejectsAndRollsBackAllWrites(): void
    {
        try {
            $this->connection->transactional(fn () => $this->issuer->issue($this->authorization(), $this->clock->time));
            self::fail('Expired challenge must not issue a session.');
        } catch (SessionIssuanceException $failure) {
            self::assertSame(SessionIssuanceFailure::ChallengeUnavailable, $failure->reason);
        }
        self::assertSame(0, $this->connection->fetchOne('SELECT COUNT(*) FROM account'));
        self::assertSame(0, $this->connection->fetchOne('SELECT COUNT(*) FROM app_session'));
    }

    public function testCallerRollbackRestoresChallengeAndRemovesAllLocalLoginWrites(): void
    {
        $repository = new LoginChallengeRepository($this->connection, $this->clock);
        $repository->insert('DUMMY-challenge', hash('sha256', 'DUMMY-nonce'), $this->clock->time);
        try {
            $this->connection->transactional(function () use ($repository): void {
                self::assertSame(ChallengeConsumption::Consumed, $repository->consume('DUMMY-challenge', 'DUMMY-nonce'));
                $this->issuer->issue($this->authorization(), $this->clock->time + 300);
                throw new \RuntimeException('DUMMY-injected-write-failure');
            });
        } catch (\RuntimeException $failure) {
            self::assertSame('DUMMY-injected-write-failure', $failure->getMessage());
        }
        self::assertNull($this->connection->fetchOne("SELECT consumed_at FROM login_challenge WHERE id = 'DUMMY-challenge'"));
        foreach (['account', 'provider_identity', 'app_session'] as $table) {
            self::assertSame(0, $this->connection->fetchOne('SELECT COUNT(*) FROM '.$table));
        }
        $this->expectException(\LogicException::class);
        $this->issuer->issue($this->authorization(), $this->clock->time + 300);
    }

    public function testInternalDeletionGateDeniesAllSessionsWithoutClaimingPurge(): void
    {
        $session = $this->connection->transactional(fn () => $this->issuer->issue($this->authorization(), $this->clock->time + 300));
        $gate = new AccountDeletionGate($this->connection, $this->clock);
        self::assertTrue($this->connection->transactional(fn () => $gate->beginDeletion($session->account->id)));
        self::assertSame('deleting', $this->connection->fetchOne('SELECT status FROM account WHERE id = ?', [$session->account->id]));
        self::assertSame($this->clock->time, $this->connection->fetchOne('SELECT revoked_at FROM app_session'));
        self::assertNull((new AppSessionRepository($this->connection, $this->clock))->findActive($session->token));
        self::assertSame(1, $this->connection->fetchOne('SELECT COUNT(*) FROM provider_identity'));
        $this->expectException(\LogicException::class);
        $gate->beginDeletion($session->account->id);
    }

    public function testConcurrentFirstLoginsReuseOneAccountWithoutOrphanCandidates(): void
    {
        $this->connection->beginTransaction();
        $first = $this->issuer->issue($this->authorization(), $this->clock->time + 300);
        $worker = $this->worker('issue', 'DUMMY-subject', $this->clock->time + 300);
        try {
            $this->assertWaitingOnLock($worker);
            $this->connection->commit();
            $result = $this->workerResult($worker);
            self::assertSame($first->account->id, $result['accountId']);
            self::assertSame(1, $this->connection->fetchOne('SELECT COUNT(*) FROM account'));
            self::assertSame(1, $this->connection->fetchOne('SELECT COUNT(*) FROM provider_identity'));
            self::assertSame(2, $this->connection->fetchOne('SELECT COUNT(*) FROM app_session'));
        } finally {
            $worker->stop();
        }
    }

    public function testChallengeExpiryDuringAccountLockWaitRollsBackConsumption(): void
    {
        $session = $this->connection->transactional(fn () => $this->issuer->issue($this->authorization(), $this->clock->time + 300));
        $envelope = $this->connection->fetchOne('SELECT refresh_envelope FROM provider_identity');
        $expiry = $this->clock->time + 300;
        $clockPath = tempnam(sys_get_temp_dir(), 'oathforge-DUMMY-clock-');
        self::assertIsString($clockPath);
        file_put_contents($clockPath, (string) $this->clock->time);
        $challenge = new LoginChallengeRepository($this->connection, $this->clock);
        $challenge->insert('DUMMY-expiring', hash('sha256', 'DUMMY-nonce'), $this->clock->time);
        $this->connection->executeStatement("UPDATE login_challenge SET expires_at = ? WHERE id = 'DUMMY-expiring'", [$expiry]);
        $this->connection->beginTransaction();
        $this->connection->fetchOne('SELECT id FROM account WHERE id = ? FOR UPDATE', [$session->account->id]);
        $worker = $this->worker('issue', 'DUMMY-subject', $expiry, 'DUMMY-expiring', $clockPath);
        try {
            $this->assertWaitingOnLock($worker);
            file_put_contents($clockPath, (string) $expiry);
            $this->connection->commit();
            self::assertSame(['failure' => 'ChallengeUnavailable'], $this->workerResult($worker));
            self::assertNull($this->connection->fetchOne("SELECT consumed_at FROM login_challenge WHERE id = 'DUMMY-expiring'"));
            self::assertSame($envelope, $this->connection->fetchOne('SELECT refresh_envelope FROM provider_identity'));
            self::assertSame(1, $this->connection->fetchOne('SELECT COUNT(*) FROM app_session'));
        } finally {
            $worker->stop();
            unlink($clockPath);
        }
    }

    public function testDeletionWinningLockPreventsSessionAndRestoresChallenge(): void
    {
        $session = $this->connection->transactional(fn () => $this->issuer->issue($this->authorization(), $this->clock->time + 300));
        (new LoginChallengeRepository($this->connection, $this->clock))->insert('DUMMY-deleting', hash('sha256', 'DUMMY-nonce'), $this->clock->time);
        $this->connection->beginTransaction();
        (new AccountDeletionGate($this->connection, $this->clock))->beginDeletion($session->account->id);
        $worker = $this->worker('issue', 'DUMMY-subject', $this->clock->time + 300, 'DUMMY-deleting');
        try {
            $this->assertWaitingOnLock($worker);
            $this->connection->commit();
            self::assertSame(['failure' => 'InvalidCredential'], $this->workerResult($worker));
            self::assertNull($this->connection->fetchOne("SELECT consumed_at FROM login_challenge WHERE id = 'DUMMY-deleting'"));
            self::assertSame(1, $this->connection->fetchOne('SELECT COUNT(*) FROM app_session'));
            self::assertNull((new AppSessionRepository($this->connection, $this->clock))->findActive($session->token));
        } finally {
            $worker->stop();
        }
    }

    public function testIssuanceWinningLockStillLosesAccessWhenDeletionCommits(): void
    {
        $first = $this->connection->transactional(fn () => $this->issuer->issue($this->authorization(), $this->clock->time + 300));
        $this->connection->beginTransaction();
        $new = $this->issuer->issue($this->authorization(), $this->clock->time + 300);
        $worker = $this->worker('delete', $first->account->id);
        try {
            $this->assertWaitingOnLock($worker);
            $this->connection->commit();
            self::assertSame(['deletionGate' => true], $this->workerResult($worker));
            self::assertSame('deleting', $this->connection->fetchOne('SELECT status FROM account'));
            self::assertSame(0, $this->connection->fetchOne('SELECT COUNT(*) FROM app_session WHERE revoked_at IS NULL'));
            $repository = new AppSessionRepository($this->connection, $this->clock);
            self::assertNull($repository->findActive($first->token));
            self::assertNull($repository->findActive($new->token));
        } finally {
            $worker->stop();
        }
    }

    private function worker(string $mode, string $subjectOrAccount, ?int $expiry = null, ?string $challenge = null, ?string $clockPath = null): Process
    {
        $arguments = [PHP_BINARY, 'tests/Fixtures/account_session_worker.php', $mode, $this->keyPath, null !== $clockPath ? 'file:'.$clockPath : (string) $this->clock->time, $subjectOrAccount, (string) ($expiry ?? $this->clock->time + 300)];
        if (null !== $challenge) { $arguments[] = $challenge; }
        $worker = new Process($arguments, dirname(__DIR__, 2));
        $worker->setTimeout(12);
        $worker->start();
        return $worker;
    }

    private function assertWaitingOnLock(Process $worker): void
    {
        $deadline = microtime(true) + 5;
        do {
            $pid = (int) $worker->getOutput();
            if ($pid > 0 && 'Lock' === $this->connection->fetchOne('SELECT wait_event_type FROM pg_stat_activity WHERE pid = ?', [$pid])) {
                self::assertTrue($worker->isRunning());
                return;
            }
            usleep(10000);
        } while ($worker->isRunning() && microtime(true) < $deadline);
        self::fail('Worker did not contend on account/identity lock: '.$worker->getErrorOutput());
    }

    /** @return array<string, mixed> */
    private function workerResult(Process $worker): array
    {
        $worker->wait();
        self::assertSame(0, $worker->getExitCode(), $worker->getErrorOutput());
        self::assertSame('', $worker->getErrorOutput());
        return json_decode(explode("\n", $worker->getOutput(), 2)[1], true, flags: JSON_THROW_ON_ERROR);
    }

    private function authorization(): AppleAuthorization
    {
        return new AppleAuthorization(new VerifiedAppleIdentity('https://appleid.apple.com', 'DUMMY-subject'), 'DUMMY-refresh-token');
    }
}
