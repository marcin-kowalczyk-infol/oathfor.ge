<?php

declare(strict_types=1);

use App\Command\ReconcileOathsCommand;
use App\Identity\Clock;
use App\Kernel;
use App\Oath\OathReconciler;
use Doctrine\DBAL\Connection;
use Psr\Container\ContainerInterface;
use Symfony\Component\Console\Input\ArrayInput;
use Symfony\Component\Console\Output\BufferedOutput;
use Symfony\Component\Dotenv\Dotenv;

// Runs the real reconcile command with a file clock, so a test can move time while the command waits on a lock.
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
$output = new BufferedOutput();
$code = (new ReconcileOathsCommand(new OathReconciler($connection, $clock)))->run(new ArrayInput(['--limit' => '100']), $output);
echo json_encode(['exitCode' => $code, 'output' => trim($output->fetch())], JSON_THROW_ON_ERROR);
