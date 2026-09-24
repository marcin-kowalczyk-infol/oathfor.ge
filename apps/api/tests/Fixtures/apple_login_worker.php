<?php

declare(strict_types=1);

use App\Identity\{AppleLoginFailure, Clock};
use App\Kernel;
use App\Tests\Fixtures\{AppleLoginFixture, FixedClock};
use Doctrine\DBAL\Connection;
use Psr\Container\ContainerInterface;
use Symfony\Component\Dotenv\Dotenv;

require dirname(__DIR__, 2).'/vendor/autoload.php';
(new Dotenv())->bootEnv(dirname(__DIR__, 2).'/.env');
$kernel = new Kernel('test', false);
$kernel->boot();
$container = $kernel->getContainer()->get('test.service_container');
assert($container instanceof ContainerInterface);
$connection = $container->get(Connection::class);
assert($connection instanceof Connection);
$arguments = $_SERVER['argv'];
$clock = isset($arguments[2]) ? new class($arguments[2]) implements Clock {
    public function __construct(private string $path) {}
    public function now(): int { return (int) file_get_contents($this->path); }
} : new FixedClock();
$fixture = new AppleLoginFixture($connection, $clock);
try {
    echo $connection->fetchOne('SELECT pg_backend_pid()')."\n";
    flush();
    $result = $fixture->service->login($arguments[1], $fixture->tokenFixture->token(now: $clock->now()), 'DUMMY-worker-code');
    echo json_encode($result instanceof AppleLoginFailure ? ['failure' => $result->name] : ['accountId' => $result->account->id], JSON_THROW_ON_ERROR);
} finally {
    $fixture->cleanup();
}
