<?php

declare(strict_types=1);

namespace App\Tests\Integration;

use App\Identity\{IdentityMaintenance, ProviderTokenCipher, ProviderTokenKeyring, SecureRandomSource};
use App\Tests\Fixtures\{FixedClock, MaintenanceProviderFake};
use Doctrine\DBAL\Connection;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\Process\Process;

final class MaintenanceMigrationTest extends KernelTestCase
{
    public function testUpgradeUsesLatestSessionAndNeverGrantsOldDeletionFreshRetention(): void
    {
        self::bootKernel();
        $connection = self::getContainer()->get(Connection::class);
        self::assertInstanceOf(Connection::class, $connection);
        self::assertSame('oathforge_test', $connection->fetchOne('SELECT current_database()'));
        $connection->executeStatement('TRUNCATE app_session, provider_identity, account, login_challenge CASCADE');
        $this->migration('--down');
        $restored = false;
        try {
            $now = 1800000000;
            $active = $connection->fetchOne('INSERT INTO account (created_at) VALUES (?) RETURNING id', [$now - 1000000]);
            $deleted = $connection->fetchOne("INSERT INTO account (created_at, status) VALUES (?, 'deleted') RETURNING id", [$now - 1000000]);
            foreach ([$active, $deleted] as $account) {
                $connection->executeStatement("INSERT INTO provider_identity (account_id, issuer, subject, refresh_envelope) VALUES (?, 'https://appleid.apple.com', ?, '{}')", [$account, $account]);
            }
            $connection->executeStatement('INSERT INTO app_session (token_digest, account_id, issued_at, expires_at) VALUES (?, ?, ?, ?)', [hash('sha256', 'DUMMY-migration-token'), $active, $now - 100, $now - 100 + 2592000]);
            $this->migration('--up');
            $restored = true;
            self::assertSame($now - 100 + 86400, $connection->fetchOne('SELECT validation_due_at FROM provider_identity WHERE account_id = ?', [$active]));
            self::assertSame($now - 1000000, $connection->fetchOne('SELECT deletion_requested_at FROM account WHERE id = ?', [$deleted]));
            self::assertSame('legacy_deletion_unknown', $connection->fetchOne('SELECT maintenance_outcome FROM provider_identity WHERE account_id = ?', [$deleted]));
            $provider = new MaintenanceProviderFake();
            $maintenance = new IdentityMaintenance($connection, new FixedClock($now), new ProviderTokenCipher(new ProviderTokenKeyring('', ''), new SecureRandomSource()), $provider);
            self::assertSame(1, $maintenance->run());
            self::assertSame(0, $provider->revokeCalls);
            self::assertNull($connection->fetchOne('SELECT refresh_envelope FROM provider_identity WHERE account_id = ?', [$deleted]));
            self::assertSame('unresolved', $connection->fetchOne('SELECT revocation_status FROM provider_identity WHERE account_id = ?', [$deleted]));
        } finally {
            if (!$restored) { $this->migration('--up'); }
            $connection->executeStatement('TRUNCATE app_session, provider_identity, account, login_challenge CASCADE');
            self::ensureKernelShutdown();
        }
    }

    private function migration(string $direction): void
    {
        $process = new Process([PHP_BINARY, 'bin/console', 'doctrine:migrations:execute', 'DoctrineMigrations\\Version20260924220000', $direction, '--env=test', '--no-interaction'], dirname(__DIR__, 2));
        $process->setTimeout(30);
        $process->run();
        self::assertSame(0, $process->getExitCode(), $process->getOutput().$process->getErrorOutput());
    }
}
