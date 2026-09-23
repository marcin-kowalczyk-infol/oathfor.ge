<?php

declare(strict_types=1);

namespace App\Tests\Integration;

use App\Tests\Fixtures\ProbeMessage;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\Messenger\MessageBusInterface;
use Symfony\Component\Messenger\Exception\TransportException;
use Symfony\Component\Process\Process;

final class RedisDeliveryTest extends KernelTestCase
{
    private string $id;
    private string $receipt;
    /** @var array<string, string> */
    private array $workerEnv;
    /** @var array<string, mixed> */
    private array $previousEnv;
    /** @var array<string, mixed> */
    private array $previousServer;
    private \Redis $redis;

    protected function setUp(): void
    {
        $this->id = bin2hex(random_bytes(12));
        $this->receipt = dirname(__DIR__, 2).'/var/probe-'.$this->id;
        $this->workerEnv = [
            'APP_ENV' => 'test',
            'MESSENGER_TRANSPORT_DSN' => 'redis://redis:6379/probe-'.$this->id,
            'MESSENGER_FAILURE_DSN' => 'redis://redis:6379/failed-'.$this->id,
            'MESSENGER_CONSUMER_NAME' => 'worker-'.$this->id,
        ];
        $this->previousEnv = $_ENV;
        $this->previousServer = $_SERVER;
        foreach ($this->workerEnv as $key => $value) {
            $_ENV[$key] = $_SERVER[$key] = $value;
        }
        $this->redis = new \Redis();
        $this->redis->connect('redis', 6379, 2);
        self::bootKernel();
    }

    protected function tearDown(): void
    {
        parent::tearDown();
        $_ENV = $this->previousEnv;
        $_SERVER = $this->previousServer;
        $this->redis->del('probe-'.$this->id, 'probe-'.$this->id.'__queue', 'failed-'.$this->id, 'failed-'.$this->id.'__queue');
        $this->redis->close();
        foreach (['.done', '.attempts'] as $suffix) {
            if (is_file($this->receipt.$suffix)) {
                unlink($this->receipt.$suffix);
            }
        }
    }

    public function testDispatchWaitsForARealWorker(): void
    {
        $bus = self::getContainer()->get(MessageBusInterface::class);
        self::assertInstanceOf(MessageBusInterface::class, $bus);
        $bus->dispatch(new ProbeMessage($this->id));
        self::assertFileDoesNotExist($this->receipt.'.done');

        $worker = new Process(
            [PHP_BINARY, 'bin/console', 'messenger:consume', 'async', '--env=test', '--limit=1', '--time-limit=5'],
            dirname(__DIR__, 2),
            $this->workerEnv,
        );
        $worker->setTimeout(10);
        $worker->mustRun();
        self::assertFileExists($this->receipt.'.done');
        self::assertSame('handled', file_get_contents($this->receipt.'.done'));
    }
    public function testFailedHandlerRetriesOnceThenMovesToFailedStream(): void
    {
        $bus = self::getContainer()->get(MessageBusInterface::class);
        self::assertInstanceOf(MessageBusInterface::class, $bus);
        $bus->dispatch(new ProbeMessage($this->id, fail: true));

        $worker = new Process(
            [PHP_BINARY, 'bin/console', 'messenger:consume', 'async', '--env=test', '--limit=2', '--time-limit=5', '--sleep=10000'],
            dirname(__DIR__, 2),
            $this->workerEnv,
        );
        $worker->setTimeout(10);
        $worker->mustRun();

        self::assertFileDoesNotExist($this->receipt.'.done');
        self::assertSame("attempt\nattempt\n", file_get_contents($this->receipt.'.attempts'));
        self::assertSame(1, $this->redis->xLen('failed-'.$this->id));
    }
    public function testUnavailableTransportNeverReportsDelivery(): void
    {
        self::ensureKernelShutdown();
        $_ENV['MESSENGER_TRANSPORT_DSN'] = $_SERVER['MESSENGER_TRANSPORT_DSN'] = 'redis://127.0.0.1:1/unavailable';
        self::bootKernel();
        $bus = self::getContainer()->get(MessageBusInterface::class);
        self::assertInstanceOf(MessageBusInterface::class, $bus);

        try {
            $bus->dispatch(new ProbeMessage($this->id));
            self::fail('An unavailable transport must not report successful dispatch.');
        } catch (TransportException | \RedisException) {
            self::assertFileDoesNotExist($this->receipt.'.done');
        }
    }
}
