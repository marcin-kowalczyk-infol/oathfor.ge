<?php

declare(strict_types=1);

namespace App\Tests\Integration;

use App\Identity\{AppSessionRepository, IdentityMaintenance, IssuedAppSession, ProviderMaintenanceClient, ProviderMaintenanceFailure, ProviderRefreshResult, ProviderTokenCipher, ProviderTokenKeyring, SecureRandomSource, VerifiedAppleIdentity};
use App\Tests\Fixtures\{AppleLoginFixture, AppleTokenFixture, FixedClock, MaintenanceProviderFake};
use App\Identity\AccountDeletionGate;
use App\Command\MaintainIdentitiesCommand;
use Symfony\Component\Console\Tester\CommandTester;
use Symfony\Component\Process\Process;
use Doctrine\DBAL\Connection;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;

final class IdentityMaintenanceTest extends KernelTestCase
{
    private Connection $connection;
    private AppleLoginFixture $fixture;
    private FixedClock $clock;
    private IssuedAppSession $session;
    protected function setUp(): void
    {
        self::bootKernel();
        $connection = self::getContainer()->get(Connection::class);
        self::assertInstanceOf(Connection::class, $connection);
        $this->connection = $connection;
        self::assertSame('oathforge_test', $connection->fetchOne('SELECT current_database()'));
        $connection->executeStatement('TRUNCATE app_session, provider_identity, account, login_challenge CASCADE');
        $this->clock = new FixedClock();
        $this->fixture = new AppleLoginFixture($connection, $this->clock);
        $this->fixture->seedChallenge();
        $session = $this->fixture->service->login(AppleTokenFixture::NONCE, $this->fixture->tokenFixture->token(), 'DUMMY-code');
        self::assertInstanceOf(IssuedAppSession::class, $session);
        $this->session = $session;
    }
    protected function tearDown(): void { $this->fixture->cleanup(); parent::tearDown(); }

    public function testDueInvalidGrantDeniesExistingSessionWithoutRenewal(): void
    {
        $this->connection->executeStatement('UPDATE provider_identity SET validation_due_at = ?', [$this->clock->time]);
        $provider = new class implements ProviderMaintenanceClient {
            public function refresh(string $refreshToken, VerifiedAppleIdentity $storedIdentity): ProviderMaintenanceFailure { return ProviderMaintenanceFailure::InvalidGrant; }
            public function revoke(string $refreshToken): bool { return false; }
        };
        self::assertSame(1, $this->maintenance($provider)->run());
        self::assertNull((new AppSessionRepository($this->connection, $this->clock))->findActive($this->session->token));
        self::assertSame($this->session->expiresAt, $this->connection->fetchOne('SELECT expires_at FROM app_session'));
    }

    public function testLoginSchedulesDailyValidationAndResetsGenerationAndClaim(): void
    {
        self::assertSame($this->clock->time + 86400, $this->connection->fetchOne('SELECT validation_due_at FROM provider_identity'));
        self::assertSame(1, $this->connection->fetchOne('SELECT credential_generation FROM provider_identity'));
        $this->connection->executeStatement('UPDATE provider_identity SET maintenance_claim = gen_random_uuid()');
        $this->clock->time += 10;
        $this->loginAgain();
        self::assertSame(2, $this->connection->fetchOne('SELECT credential_generation FROM provider_identity'));
        self::assertNull($this->connection->fetchOne('SELECT maintenance_claim FROM provider_identity'));
        self::assertSame($this->clock->time + 86400, $this->connection->fetchOne('SELECT validation_due_at FROM provider_identity'));
    }

    public function testDeletionPersistsImmutableRequestAndRetriesThenConfirmsRevocation(): void
    {
        $requestTime = $this->clock->time;
        $gate = new AccountDeletionGate($this->connection, $this->clock);
        $this->connection->transactional(fn () => $gate->beginDeletion($this->session->account->id));
        self::assertSame($requestTime, $this->connection->fetchOne('SELECT deletion_requested_at FROM account'));
        self::assertSame('pending', $this->connection->fetchOne('SELECT revocation_status FROM provider_identity'));
        $provider = new MaintenanceProviderFake();
        self::assertSame(1, $this->maintenance($provider)->run());
        self::assertSame(1, $provider->revokeCalls);
        self::assertSame($requestTime + 900, $this->connection->fetchOne('SELECT revocation_due_at FROM provider_identity'));
        ++$this->clock->time;
        $this->connection->transactional(fn () => $gate->beginDeletion($this->session->account->id));
        self::assertSame($requestTime, $this->connection->fetchOne('SELECT deletion_requested_at FROM account'));
        self::assertSame(0, $this->maintenance($provider)->run());
        $this->clock->time = $requestTime + 900;
        $provider->revokeResult = true;
        self::assertSame(1, $this->maintenance($provider)->run());
        self::assertSame('confirmed', $this->connection->fetchOne('SELECT revocation_status FROM provider_identity'));
        self::assertNull($this->connection->fetchOne('SELECT refresh_envelope FROM provider_identity'));
        self::assertSame(0, $this->maintenance($provider)->run());
    }

    public function testSevenDayDeadlinePurgesBeforeNetworkEvenWhenProviderUnavailable(): void
    {
        $this->connection->transactional(fn () => (new AccountDeletionGate($this->connection, $this->clock))->beginDeletion($this->session->account->id));
        $this->clock->time += 604800;
        $provider = new MaintenanceProviderFake();
        self::assertSame(1, $this->maintenance($provider)->run());
        self::assertSame(0, $provider->revokeCalls);
        self::assertNull($this->connection->fetchOne('SELECT refresh_envelope FROM provider_identity'));
        self::assertSame('unresolved', $this->connection->fetchOne('SELECT revocation_status FROM provider_identity'));
        self::assertNull($this->connection->fetchOne('SELECT maintenance_claim FROM provider_identity'));
    }

    public function testDailyReservationPreventsDuplicatesAndOutageNeverRenewsExpiry(): void
    {
        $this->clock->time += 86400;
        $provider = new MaintenanceProviderFake();
        $provider->refreshResult = ProviderMaintenanceFailure::Unavailable;
        $provider->onRefresh = function () use ($provider): void {
            self::assertFalse($this->connection->isTransactionActive());
            self::assertSame($this->clock->time + 86400, $this->connection->fetchOne('SELECT validation_due_at FROM provider_identity'));
            self::assertSame(0, $this->maintenance($provider)->run());
        };
        self::assertSame(1, $this->maintenance($provider)->run());
        self::assertSame(1, $provider->refreshCalls);
        self::assertSame($this->session->expiresAt, $this->connection->fetchOne('SELECT expires_at FROM app_session'));
        self::assertNotNull((new AppSessionRepository($this->connection, $this->clock))->findActive($this->session->token));
        self::assertNull($this->connection->fetchOne('SELECT maintenance_claim FROM provider_identity'));
        self::assertSame('unavailable', $this->connection->fetchOne('SELECT maintenance_outcome FROM provider_identity'));
    }

    public function testRefreshRotationIncrementsGenerationButOmissionRetainsEnvelope(): void
    {
        $this->clock->time += 86400;
        $old = $this->connection->fetchOne('SELECT refresh_envelope FROM provider_identity');
        $provider = new MaintenanceProviderFake();
        self::assertSame(1, $this->maintenance($provider)->run());
        self::assertSame($old, $this->connection->fetchOne('SELECT refresh_envelope FROM provider_identity'));
        self::assertSame(1, $this->connection->fetchOne('SELECT credential_generation FROM provider_identity'));
        $this->clock->time += 86400;
        $provider->refreshResult = new ProviderRefreshResult('DUMMY-rotated');
        self::assertSame(1, $this->maintenance($provider)->run());
        self::assertNotSame($old, $this->connection->fetchOne('SELECT refresh_envelope FROM provider_identity'));
        self::assertSame(2, $this->connection->fetchOne('SELECT credential_generation FROM provider_identity'));
        self::assertSame($this->session->expiresAt, $this->connection->fetchOne('SELECT expires_at FROM app_session'));
    }

    public function testStaleInvalidGrantCannotRevokeNewLoginSessions(): void
    {
        $this->clock->time += 86400;
        $provider = new MaintenanceProviderFake();
        $provider->refreshResult = ProviderMaintenanceFailure::InvalidGrant;
        $provider->onRefresh = fn () => $this->loginAgain();
        self::assertSame(1, $this->maintenance($provider)->run());
        self::assertSame(2, $this->connection->fetchOne('SELECT COUNT(*) FROM app_session WHERE revoked_at IS NULL'));
        self::assertSame(2, $this->connection->fetchOne('SELECT credential_generation FROM provider_identity'));
        self::assertNull($this->connection->fetchOne('SELECT maintenance_outcome FROM provider_identity'));
    }

    public function testDeletionDuringRefreshInvalidatesClaimAndCannotApplyRotatedToken(): void
    {
        $this->clock->time += 86400;
        $old = $this->connection->fetchOne('SELECT refresh_envelope FROM provider_identity');
        $provider = new MaintenanceProviderFake();
        $provider->refreshResult = new ProviderRefreshResult('DUMMY-stale-rotation');
        $provider->onRefresh = function (): void {
            $this->connection->transactional(fn () => (new AccountDeletionGate($this->connection, $this->clock))->beginDeletion($this->session->account->id));
        };
        self::assertSame(1, $this->maintenance($provider)->run());
        self::assertSame($old, $this->connection->fetchOne('SELECT refresh_envelope FROM provider_identity'));
        self::assertSame('pending', $this->connection->fetchOne('SELECT revocation_status FROM provider_identity'));
        self::assertSame(0, $this->connection->fetchOne('SELECT COUNT(*) FROM app_session WHERE revoked_at IS NULL'));
    }

    public function testLateRevokeResponseCrossingDeadlineCannotRetainCredential(): void
    {
        $this->connection->transactional(fn () => (new AccountDeletionGate($this->connection, $this->clock))->beginDeletion($this->session->account->id));
        $this->clock->time += 604799;
        $provider = new MaintenanceProviderFake();
        $provider->revokeResult = true;
        $provider->onRevoke = function (): void { ++$this->clock->time; };
        self::assertSame(1, $this->maintenance($provider)->run());
        self::assertSame(1, $provider->revokeCalls);
        self::assertNull($this->connection->fetchOne('SELECT refresh_envelope FROM provider_identity'));
        self::assertSame('unresolved', $this->connection->fetchOne('SELECT revocation_status FROM provider_identity'));
    }

    public function testCliProcessesBoundedBatchAndRejectsInvalidLimit(): void
    {
        $this->clock->time += 86400;
        $provider = new MaintenanceProviderFake();
        $command = new CommandTester(new MaintainIdentitiesCommand($this->maintenance($provider)));
        self::assertSame(0, $command->execute(['--limit' => '1']));
        self::assertSame("MAINTENANCE_PROCESSED 1\n", $command->getDisplay());
        self::assertSame(1, $provider->refreshCalls);
        self::assertSame(2, $command->execute(['--limit' => '1001']));
        self::assertSame(2, $command->execute(['--limit' => '1.5']));
        self::assertSame(1, $provider->refreshCalls);
    }

    public function testTwoConnectionsCompetingForSameDueIdentityMakeOneProviderCall(): void
    {
        $this->clock->time += 86400;
        $this->connection->beginTransaction();
        $this->connection->fetchOne('SELECT id FROM account WHERE id = ? FOR UPDATE', [$this->session->account->id]);
        $workers = [];
        try {
            for ($i = 0; $i < 2; ++$i) {
                $worker = new Process([PHP_BINARY, 'tests/Fixtures/identity_maintenance_worker.php', $this->fixture->keyringPath, (string) $this->clock->time], dirname(__DIR__, 2));
                $worker->setTimeout(15);
                $worker->start();
                $workers[] = $worker;
                $deadline = microtime(true) + 5;
                do {
                    $pid = (int) $worker->getOutput();
                    $this->connection->executeQuery('SELECT pg_stat_clear_snapshot()');
                    if ($pid > 0 && 'Lock' === $this->connection->fetchOne('SELECT wait_event_type FROM pg_stat_activity WHERE pid = ?', [$pid])) { break; }
                    usleep(10000);
                } while ($worker->isRunning() && microtime(true) < $deadline);
                self::assertSame('Lock', $this->connection->fetchOne('SELECT wait_event_type FROM pg_stat_activity WHERE pid = ?', [$pid]), $worker->getErrorOutput().$worker->getOutput());
            }
            $this->connection->commit();
            $processed = $calls = 0;
            foreach ($workers as $worker) {
                $worker->wait();
                self::assertSame(0, $worker->getExitCode(), $worker->getErrorOutput());
                self::assertSame('', $worker->getErrorOutput());
                $result = json_decode(explode("\n", $worker->getOutput(), 2)[1], true, flags: JSON_THROW_ON_ERROR);
                $processed += $result['processed'];
                $calls += $result['refreshCalls'];
            }
            self::assertSame(1, $processed);
            self::assertSame(1, $calls);
            self::assertSame($this->clock->time + 86400, $this->connection->fetchOne('SELECT validation_due_at FROM provider_identity'));
        } finally {
            foreach ($workers as $worker) { $worker->stop(); }
            if ($this->connection->isTransactionActive()) { $this->connection->rollBack(); }
        }
    }

    public function testMissingKeyDoesNotCallProviderAndExpiredSessionsDoNotScheduleRefresh(): void
    {
        $this->clock->time += 86400;
        unlink($this->fixture->keyringPath);
        $provider = new MaintenanceProviderFake();
        self::assertSame(1, $this->maintenance($provider)->run());
        self::assertSame(0, $provider->refreshCalls);
        self::assertSame('unavailable', $this->connection->fetchOne('SELECT maintenance_outcome FROM provider_identity'));
        self::assertNotNull((new AppSessionRepository($this->connection, $this->clock))->findActive($this->session->token));
        $this->clock->time = $this->session->expiresAt;
        self::assertSame(0, $this->maintenance($provider)->run());
        self::assertSame(0, $provider->refreshCalls);
    }

    private function loginAgain(): void
    {
        $id = rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
        $this->fixture->seedChallenge($id);
        self::assertInstanceOf(IssuedAppSession::class, $this->fixture->service->login($id, $this->fixture->tokenFixture->token(now: $this->clock->time), 'DUMMY-again'));
    }

    private function maintenance(ProviderMaintenanceClient $provider): IdentityMaintenance
    {
        return new IdentityMaintenance($this->connection, $this->clock, new ProviderTokenCipher(new ProviderTokenKeyring($this->fixture->keyringPath, 'v1'), new SecureRandomSource()), $provider);
    }
}
