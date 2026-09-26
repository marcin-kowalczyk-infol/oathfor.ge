<?php

declare(strict_types=1);

use App\Character\{CharacterFailure, CharacterInput, CharacterService, PresetCatalog};
use App\Identity\{AppSessionRepository, Clock};
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
$data = json_decode((string) file_get_contents($path), true, flags: JSON_THROW_ON_ERROR);
$clock = new class($path) implements Clock {
    public function __construct(private string $path) {}
    public function now(): int { return json_decode((string) file_get_contents($this->path), true, flags: JSON_THROW_ON_ERROR)['time']; }
};
$service = new CharacterService($connection, new AppSessionRepository($connection, $clock), $clock, new PresetCatalog());
$input = CharacterInput::parse($data['input']);
assert($input instanceof CharacterInput);
echo $connection->fetchOne('SELECT pg_backend_pid()')."\n";
flush();
$result = $service->create($data['token'], $input);
echo json_encode($result instanceof CharacterFailure ? $result->toArray() : ['created' => $result->created, 'body' => $result->body], JSON_THROW_ON_ERROR);
