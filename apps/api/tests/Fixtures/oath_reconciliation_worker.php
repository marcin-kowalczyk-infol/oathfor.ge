<?php

declare(strict_types=1);

use App\Identity\Clock;
use App\Oath\OathReconciler;
use App\Kernel;
use Doctrine\DBAL\Connection;
use Psr\Container\ContainerInterface;
use Symfony\Component\Dotenv\Dotenv;

require dirname(__DIR__, 2).'/vendor/autoload.php';
(new Dotenv())->bootEnv(dirname(__DIR__, 2).'/.env');
$kernel = new Kernel('test', false); $kernel->boot();
$container = $kernel->getContainer()->get('test.service_container');
assert($container instanceof ContainerInterface);
$connection = $container->get(Connection::class); assert($connection instanceof Connection);
$path = $_SERVER['argv'][1];
$clock = new class($path) implements Clock {
    public function __construct(private string $path) {}
    public function now(): int { return json_decode((string) file_get_contents($this->path), true, flags: JSON_THROW_ON_ERROR)['time']; }
};
echo $connection->fetchOne('SELECT pg_backend_pid()')."\n"; flush();
echo json_encode((new OathReconciler($connection, $clock))->run(100), JSON_THROW_ON_ERROR);
