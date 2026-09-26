<?php

declare(strict_types=1);

namespace App\Tests\Fixtures;

use Doctrine\DBAL\Connection;
use PHPUnit\Framework\Assert;
use Symfony\Component\Process\Process;

/**
 * Synchronizes race tests with a worker process that must block on a PostgreSQL lock.
 *
 * The worker prints its backend PID on the first output line after connecting. Booting PHP and the
 * Symfony kernel took 4 to 6 s on a CPU-starved Docker host, so the boot budget is separate from the
 * lock budget. Lock state comes from pg_locks, which is read live. pg_stat_activity keeps the backend
 * list of its first read in a transaction and hides workers that connect later.
 */
final class LockWait
{
    /** Process timeout for lock workers. It exceeds both budgets plus the work after the lock. */
    public const WORKER_TIMEOUT = 60;
    private const BACKEND_SECONDS = 30;
    private const LOCK_SECONDS = 10;

    public static function assertWorkerWaiting(Connection $connection, Process $worker, string $name): void
    {
        $pid = self::backendPid($worker, $name);
        $deadline = microtime(true) + self::LOCK_SECONDS;
        do {
            if (0 < (int) $connection->fetchOne('SELECT count(*) FROM pg_locks WHERE pid = ? AND NOT granted', [$pid])) {
                Assert::assertTrue($worker->isRunning(), $name.' exited while waiting on a PostgreSQL lock.');
                return;
            }
            usleep(10000);
        } while ($worker->isRunning() && microtime(true) < $deadline);
        Assert::fail(sprintf('%s did not wait on a PostgreSQL lock within %d s: %s', $name, self::LOCK_SECONDS, self::output($worker)));
    }

    private static function backendPid(Process $worker, string $name): int
    {
        $deadline = microtime(true) + self::BACKEND_SECONDS;
        while (true) {
            // Check the state first so a finished worker's output is read completely.
            $running = $worker->isRunning();
            $output = $worker->getOutput();
            if (str_contains($output, "\n")) {
                $pid = (int) strstr($output, "\n", true);
                Assert::assertGreaterThan(0, $pid, $name.' printed no PostgreSQL backend PID: '.self::output($worker));
                return $pid;
            }
            if (!$running || microtime(true) >= $deadline) {
                Assert::fail(sprintf('%s did not report its PostgreSQL backend within %d s: %s', $name, self::BACKEND_SECONDS, self::output($worker)));
            }
            usleep(10000);
        }
    }

    private static function output(Process $worker): string
    {
        return 'stdout '.json_encode($worker->getOutput()).' stderr '.json_encode($worker->getErrorOutput());
    }
}
