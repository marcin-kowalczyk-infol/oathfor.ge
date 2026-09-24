<?php

declare(strict_types=1);

use App\Identity\{IdentityMaintenance, ProviderTokenCipher, ProviderTokenKeyring, SecureRandomSource};
use App\Kernel;
use App\Tests\Fixtures\{FixedClock, MaintenanceProviderFake};
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
$provider = new MaintenanceProviderFake();
$service = new IdentityMaintenance($connection, new FixedClock((int) $arguments[2]), new ProviderTokenCipher(new ProviderTokenKeyring($arguments[1], 'v1'), new SecureRandomSource()), $provider);
echo $connection->fetchOne('SELECT pg_backend_pid()')."\n";
flush();
try {
    $processed = $service->run();
    echo json_encode(['processed' => $processed, 'refreshCalls' => $provider->refreshCalls], JSON_THROW_ON_ERROR);
} catch (\Doctrine\DBAL\Exception) {
    echo '{"failure":"unavailable"}';
}
