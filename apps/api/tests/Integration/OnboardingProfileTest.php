<?php

declare(strict_types=1);

namespace App\Tests\Integration;

use App\Identity\{AppSessionRepository, ProfileFailure, ProfileService};
use App\Tests\Fixtures\{AppleLoginFixture, AppleTokenFixture};
use App\Tests\Fixtures\FixedClock;
use Doctrine\DBAL\Connection;
use PHPUnit\Framework\Attributes\DataProvider;
use Symfony\Component\Process\Process;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;

final class OnboardingProfileTest extends KernelTestCase
{
    private Connection $connection;
    private FixedClock $clock;
    private ProfileService $service;
    private string $token;
    private string $accountId;
    protected function setUp(): void
    {
        self::bootKernel();
        $connection = self::getContainer()->get(Connection::class);
        self::assertInstanceOf(Connection::class, $connection);
        self::assertSame('oathforge_test', $connection->fetchOne('SELECT current_database()'));
        $this->connection = $connection;
        $connection->executeStatement('TRUNCATE account, provider_identity, app_session, login_challenge CASCADE');
        $this->clock = new FixedClock();
        $this->service = $this->serviceFor($connection);
        $this->accountId = $connection->fetchOne('INSERT INTO account (created_at) VALUES (?) RETURNING id', [$this->clock->time]);
        $this->token = rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
        $connection->insert('app_session', ['token_digest' => hash('sha256', $this->token), 'account_id' => $this->accountId, 'issued_at' => $this->clock->time, 'expires_at' => $this->clock->time + 2592000]);
    }

    public function testPartialSaveSurvivesNewConnectionAndPreservesDefaults(): void
    {
        $this->service->patch($this->token, ['timezone' => 'Europe/Warsaw']);
        $other = \Doctrine\DBAL\DriverManager::getConnection($this->connection->getParams());
        try {
            $result = $this->serviceFor($other)->read($this->token);
            self::assertIsArray($result);
            self::assertSame(['profile' => ['locale' => null, 'timezone' => 'Europe/Warsaw', 'intention' => null, 'companionIntroduced' => false, 'notificationPreference' => null], 'onboardingStatus' => 'pending'], $result);
        } finally { $other->close(); }
    }

    public function testCompletionRequiresEveryChoiceAndIsMonotonicWithoutRenewal(): void
    {
        $fields = ['locale' => 'pl', 'timezone' => 'UTC', 'intention' => 'regular_activity', 'companionIntroduced' => true, 'notificationPreference' => 'enabled'];
        foreach ($fields as $field => $value) {
            self::assertSame(ProfileFailure::Incomplete, $this->service->complete($this->token));
            $this->service->patch($this->token, [$field => $value]);
        }
        $complete = $this->service->complete($this->token);
        self::assertIsArray($complete);
        self::assertSame('complete', $complete['onboardingStatus']);
        self::assertSame($complete, $this->service->complete($this->token));
        self::assertSame('active', $this->connection->fetchOne('SELECT status FROM account'));
        self::assertSame($this->clock->time + 2592000, $this->connection->fetchOne('SELECT expires_at FROM app_session'));
        self::assertSame('complete', (new AppSessionRepository($this->connection, $this->clock))->findActive($this->token)?->onboardingStatus);
        $changed = $this->service->patch($this->token, ['locale' => 'en', 'timezone' => 'Europe/Warsaw', 'notificationPreference' => 'disabled']);
        self::assertIsArray($changed);
        self::assertSame('complete', $changed['onboardingStatus']);
        self::assertTrue($changed['profile']['companionIntroduced']);
        $this->connection->executeStatement("INSERT INTO provider_identity (account_id, issuer, subject) VALUES (?, 'https://appleid.apple.com', 'DUMMY-subject')", [$this->accountId]);
        $fixture = new AppleLoginFixture($this->connection, $this->clock);
        try {
            $fixture->seedChallenge();
            $login = $fixture->service->login(AppleTokenFixture::NONCE, $fixture->tokenFixture->token(), 'DUMMY-code');
            self::assertInstanceOf(\App\Identity\IssuedAppSession::class, $login);
            self::assertSame('complete', $login->account->onboardingStatus);
        } finally { $fixture->cleanup(); }
    }

    public function testExactExpiryAndInactiveAccountsCannotReadOrMutate(): void
    {
        $this->clock->time += 2592000;
        self::assertSame(ProfileFailure::Unauthenticated, $this->service->read($this->token));
        self::assertSame(ProfileFailure::Unauthenticated, $this->service->patch($this->token, ['locale' => 'pl']));
        self::assertSame(ProfileFailure::Unauthenticated, $this->service->complete($this->token));
        $this->clock->time -= 2592000;
        $this->connection->executeStatement("UPDATE account SET status = 'deleting'");
        self::assertSame(ProfileFailure::Unauthenticated, $this->service->read($this->token));
        self::assertSame(ProfileFailure::Unauthenticated, $this->service->patch($this->token, ['locale' => 'pl']));
        self::assertSame(ProfileFailure::Unauthenticated, $this->service->complete($this->token));
        self::assertSame(0, $this->connection->fetchOne('SELECT COUNT(*) FROM account_profile'));
    }

    public function testDatabaseWriteFailureRollsBackEveryNamedField(): void
    {
        $this->service->patch($this->token, ['locale' => 'pl']);
        $this->connection->executeStatement("ALTER TABLE account_profile ADD CONSTRAINT dummy_profile_failure CHECK (timezone <> 'Europe/Warsaw') NOT VALID");
        try {
            self::assertSame(ProfileFailure::Unavailable, $this->service->patch($this->token, ['locale' => 'en', 'timezone' => 'Europe/Warsaw']));
            $result = $this->service->read($this->token);
            self::assertIsArray($result);
            self::assertSame('pl', $result['profile']['locale']);
            self::assertNull($result['profile']['timezone']);
        } finally { $this->connection->executeStatement('ALTER TABLE account_profile DROP CONSTRAINT dummy_profile_failure'); }
    }

    public function testStoredUnsupportedTimezoneCannotComplete(): void
    {
        $this->service->patch($this->token, $this->completeFields());
        $this->connection->executeStatement("UPDATE account_profile SET timezone = 'DUMMY/Invalid'");
        self::assertSame(ProfileFailure::Incomplete, $this->service->complete($this->token));
        self::assertSame('pending', $this->connection->fetchOne('SELECT onboarding_status FROM account'));
    }

    /** @return iterable<string, array{string}> */
    public static function deniedAfterWait(): iterable
    {
        foreach (['expiry', 'revocation', 'deletion', 'session_wait_expiry'] as $change) { yield $change => [$change]; }
    }

    #[DataProvider('deniedAfterWait')]
    public function testAccountAndSessionWaitRecheckAuthorizationBeforeWriting(string $change): void
    {
        $this->service->patch($this->token, $this->completeFields());
        $this->connection->beginTransaction();
        $this->connection->fetchOne($change === 'session_wait_expiry' ? 'SELECT token_digest FROM app_session FOR UPDATE' : 'SELECT id FROM account FOR UPDATE');
        [$worker, $path, $input] = $this->worker(in_array($change, ['revocation', 'deletion'], true) ? 'complete' : 'patch', ['timezone' => 'Europe/Warsaw']);
        try {
            $this->assertWaiting($worker);
            if (str_contains($change, 'expiry')) {
                $input['time'] += 2592000;
                file_put_contents($path, json_encode($input, JSON_THROW_ON_ERROR));
            } elseif ($change === 'revocation') {
                $this->connection->executeStatement('UPDATE app_session SET revoked_at = ?', [$this->clock->time]);
            } else {
                $this->connection->executeStatement("UPDATE account SET status = 'deleting'");
            }
            $this->connection->commit();
            self::assertSame(['failure' => 'Unauthenticated'], $this->workerResult($worker));
            self::assertSame('UTC', $this->connection->fetchOne('SELECT timezone FROM account_profile'));
            self::assertSame('pending', $this->connection->fetchOne('SELECT onboarding_status FROM account'));
        } finally {
            $worker->stop();
            if ($this->connection->isTransactionActive()) { $this->connection->rollBack(); }
            unlink($path);
        }
    }

    public function testConcurrentDisjointChangesMerge(): void
    {
        $this->connection->beginTransaction();
        $this->connection->fetchOne('SELECT id FROM account FOR UPDATE');
        [$worker, $path] = $this->worker('patch', ['timezone' => 'Europe/Warsaw']);
        try {
            $this->assertWaiting($worker);
            $this->service->patch($this->token, ['locale' => 'pl']);
            $this->connection->commit();
            $result = $this->workerResult($worker);
            self::assertSame('pl', $result['profile']['locale']);
            self::assertSame('Europe/Warsaw', $result['profile']['timezone']);
        } finally {
            $worker->stop();
            if ($this->connection->isTransactionActive()) { $this->connection->rollBack(); }
            unlink($path);
        }
    }

    public function testCompletionAndConcurrentProfileChangeRemainComplete(): void
    {
        $this->service->patch($this->token, $this->completeFields());
        $this->connection->beginTransaction();
        $this->connection->fetchOne('SELECT id FROM account FOR UPDATE');
        [$worker, $path] = $this->worker('patch', ['notificationPreference' => 'disabled']);
        try {
            $this->assertWaiting($worker);
            $this->service->complete($this->token);
            $this->connection->commit();
            $result = $this->workerResult($worker);
            self::assertSame('complete', $result['onboardingStatus']);
            self::assertSame('disabled', $result['profile']['notificationPreference']);
        } finally {
            $worker->stop();
            if ($this->connection->isTransactionActive()) { $this->connection->rollBack(); }
            unlink($path);
        }
    }

    /** @return array<string, mixed> */
    private function completeFields(): array { return ['locale' => 'pl', 'timezone' => 'UTC', 'intention' => 'regular_activity', 'companionIntroduced' => true, 'notificationPreference' => 'enabled']; }

    /**
     * @param array<string, mixed> $changes
     * @return array{Process, string, array<string, mixed>}
     */
    private function worker(string $mode, array $changes): array
    {
        $path = tempnam(sys_get_temp_dir(), 'oathforge-DUMMY-profile-');
        self::assertIsString($path);
        chmod($path, 0600);
        $input = ['time' => $this->clock->time, 'mode' => $mode, 'token' => $this->token, 'changes' => $changes];
        file_put_contents($path, json_encode($input, JSON_THROW_ON_ERROR));
        $worker = new Process([PHP_BINARY, 'tests/Fixtures/onboarding_profile_worker.php', $path], dirname(__DIR__, 2));
        $worker->setTimeout(12);
        $worker->start();
        return [$worker, $path, $input];
    }

    private function assertWaiting(Process $worker): void
    {
        $deadline = microtime(true) + 5;
        do {
            $pid = (int) $worker->getOutput();
            $this->connection->executeQuery('SELECT pg_stat_clear_snapshot()');
            if ($pid > 0 && 'Lock' === $this->connection->fetchOne('SELECT wait_event_type FROM pg_stat_activity WHERE pid = ?', [$pid])) { self::assertTrue($worker->isRunning()); return; }
            usleep(10000);
        } while ($worker->isRunning() && microtime(true) < $deadline);
        self::fail('Profile worker did not reach the expected lock.');
    }

    /** @return array<string, mixed> */
    private function workerResult(Process $worker): array
    {
        $worker->wait();
        self::assertSame(0, $worker->getExitCode(), $worker->getErrorOutput());
        self::assertSame('', $worker->getErrorOutput());
        return json_decode(explode("\n", $worker->getOutput(), 2)[1], true, flags: JSON_THROW_ON_ERROR);
    }

    private function serviceFor(Connection $connection): ProfileService { return new ProfileService($connection, new AppSessionRepository($connection, $this->clock), $this->clock); }
}
