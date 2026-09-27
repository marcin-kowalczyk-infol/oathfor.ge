<?php

declare(strict_types=1);

use App\Kernel;
use Doctrine\DBAL\Connection;
use Symfony\Component\Dotenv\Dotenv;
use Psr\Container\ContainerInterface;

// Arguments: seconds before the backend PID line, seconds before the lock request, lock|exit, advisory key.
[, $bootDelay, $lockDelay, $mode, $key] = $_SERVER['argv'];
usleep((int) ((float) $bootDelay * 1000000));
require dirname(__DIR__, 2).'/vendor/autoload.php';
(new Dotenv())->bootEnv(dirname(__DIR__, 2).'/.env');
$kernel = new Kernel('test', false);
$kernel->boot();
$container = $kernel->getContainer()->get('test.service_container');
assert($container instanceof ContainerInterface);
$connection = $container->get(Connection::class);
assert($connection instanceof Connection);
echo $connection->fetchOne('SELECT pg_backend_pid()')."\n";
flush();
usleep((int) ((float) $lockDelay * 1000000));
if ('lock' === $mode) {
    $connection->transactional(fn () => $connection->fetchOne('SELECT pg_advisory_xact_lock(?)', [(int) $key]));
    echo "locked\n";
}
