<?php

declare(strict_types=1);

namespace App\Tests\Integration;

use App\Tests\Fixtures\LockWait;
use Doctrine\DBAL\Connection;
use PHPUnit\Framework\AssertionFailedError;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\Process\Process;

/** Contract of the helper that every worker-based race test relies on. */
final class LockWaitTest extends KernelTestCase
{
    private const KEY = 740211;

    private Connection $connection;
    /** @var list<Process> */
    private array $workers = [];

    protected function setUp(): void
    {
        self::bootKernel();
        $connection = self::getContainer()->get(Connection::class);
        self::assertInstanceOf(Connection::class, $connection);
        $this->connection = $connection;
        self::assertSame('oathforge_test', $connection->fetchOne('SELECT current_database()'));
        // Race tests poll while their own transaction holds the contested lock.
        $connection->beginTransaction();
        $connection->fetchOne('SELECT pg_advisory_xact_lock(?)', [self::KEY]);
    }

    protected function tearDown(): void
    {
        foreach ($this->workers as $worker) {
            $worker->stop();
        }
        if ($this->connection->isTransactionActive()) {
            $this->connection->rollBack();
        }
        parent::tearDown();
    }

    public function testDetectsWorkerThatStartsWaitingAfterTheFirstObservation(): void
    {
        $worker = $this->worker('0', '0.5', 'lock');
        LockWait::assertWorkerWaiting($this->connection, $worker, 'Lock worker');
        $this->connection->commit();
        $worker->wait();
        self::assertSame(0, $worker->getExitCode(), $worker->getErrorOutput());
        self::assertSame('locked', explode("\n", $worker->getOutput())[1]);
    }

    public function testDetectsWorkerWhoseBackendStartsAfterAnotherWorkerWasObserved(): void
    {
        $first = $this->worker('0', '0', 'lock');
        LockWait::assertWorkerWaiting($this->connection, $first, 'First lock worker');
        // This backend connects only after the first observation inside the transaction.
        $second = $this->worker('0', '0', 'lock');
        LockWait::assertWorkerWaiting($this->connection, $second, 'Second lock worker');
        $this->connection->commit();
        foreach ([$first, $second] as $worker) {
            $worker->wait();
            self::assertSame(0, $worker->getExitCode(), $worker->getErrorOutput());
            self::assertSame('locked', explode("\n", $worker->getOutput())[1]);
        }
    }

    public function testToleratesSlowWorkerBootBeforeTheBackendIsKnown(): void
    {
        $worker = $this->worker('6', '0', 'lock');
        LockWait::assertWorkerWaiting($this->connection, $worker, 'Lock worker');
        $this->connection->commit();
        $worker->wait();
        self::assertSame(0, $worker->getExitCode(), $worker->getErrorOutput());
    }

    public function testFailsWhenWorkerExitsWithoutWaiting(): void
    {
        $worker = $this->worker('0', '0', 'exit');
        try {
            LockWait::assertWorkerWaiting($this->connection, $worker, 'Lock worker');
        } catch (AssertionFailedError $failure) {
            self::assertStringContainsString('Lock worker did not wait on a PostgreSQL lock', $failure->getMessage());
            self::assertFalse($worker->isRunning());
            return;
        }
        self::fail('A worker that never waited was reported as contending.');
    }

    private function worker(string $bootDelay, string $lockDelay, string $mode): Process
    {
        $worker = new Process([PHP_BINARY, 'tests/Fixtures/lock_wait_worker.php', $bootDelay, $lockDelay, $mode, (string) self::KEY], dirname(__DIR__, 2));
        $worker->setTimeout(LockWait::WORKER_TIMEOUT);
        $worker->start();
        $this->workers[] = $worker;
        return $worker;
    }
}
