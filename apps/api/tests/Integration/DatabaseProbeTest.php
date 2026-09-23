<?php

declare(strict_types=1);

namespace App\Tests\Integration;

use Doctrine\DBAL\Connection;
use Symfony\Bundle\FrameworkBundle\Console\Application;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\Console\Tester\CommandTester;
use Symfony\Component\Process\Process;

final class DatabaseProbeTest extends KernelTestCase
{
    public function testProbeRollsBackItsSyntheticTable(): void
    {
        $kernel = self::bootKernel();
        $connection = self::getContainer()->get(Connection::class);
        self::assertInstanceOf(Connection::class, $connection);
        self::assertSame('oathforge_test', $connection->fetchOne('SELECT current_database()'));

        $command = new CommandTester((new Application($kernel))->find('app:check-database'));
        self::assertSame(0, $command->execute([]));
        self::assertSame("DATABASE_OK\n", $command->getDisplay());
        self::assertFalse($connection->isTransactionActive());
        self::assertNull($connection->fetchOne("SELECT to_regclass('pg_temp.oathforge_probe')"));
    }
    public function testUnavailableDatabaseReportsOnlySafeReason(): void
    {
        $process = new Process(
            [PHP_BINARY, 'bin/console', 'app:check-database', '--env=test', '--no-debug'],
            dirname(__DIR__, 2),
            ['DATABASE_URL' => 'postgresql://probe:DUMMY-never-log-this@127.0.0.1:1/unavailable?serverVersion=17'],
        );
        $process->setTimeout(10);
        $process->run();

        self::assertSame(1, $process->getExitCode());
        self::assertSame("DATABASE_UNAVAILABLE\n", $process->getOutput());
        self::assertSame('', $process->getErrorOutput());
    }
}
