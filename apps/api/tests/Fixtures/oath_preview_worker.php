<?php

declare(strict_types=1);

use App\Identity\{AppSessionRepository, Clock};
use App\Oath\{DeadlineResolver, OathFailure, PreviewInput, PreviewService, RuleCatalog};
use App\Kernel;
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
$path = $_SERVER['argv'][1];
$input = json_decode((string) file_get_contents($path), true, flags: JSON_THROW_ON_ERROR);
$clock = new class($path) implements Clock {
    public function __construct(private string $path) {}
    public function now(): int { return json_decode((string) file_get_contents($this->path), true, flags: JSON_THROW_ON_ERROR)['time']; }
};
$catalog = $container->get(RuleCatalog::class);
assert($catalog instanceof RuleCatalog);
$service = new PreviewService($connection, new AppSessionRepository($connection, $clock), $clock, $catalog);
$preview = PreviewInput::parse(get_object_vars(json_decode(json_encode($input['preview'], JSON_THROW_ON_ERROR), flags: JSON_THROW_ON_ERROR)), new DeadlineResolver());
assert($preview instanceof PreviewInput);
echo $connection->fetchOne('SELECT pg_backend_pid()')."\n";
flush();
$result = isset($input['id']) ? $service->read($input['token'], $input['id']) : $service->create($input['token'], $preview);
echo json_encode($result instanceof OathFailure ? $result->toArray() : $result, JSON_THROW_ON_ERROR);
