<?php

declare(strict_types=1);

use App\Identity\AuthenticationRateLimiter;
use App\Identity\LoginChallengeRepository;
use App\Kernel;
use App\Tests\Fixtures\FixedClock;
use Doctrine\DBAL\Connection;
use Symfony\Component\Dotenv\Dotenv;
use Symfony\Component\HttpFoundation\Request;
use Psr\Container\ContainerInterface;

require dirname(__DIR__, 2).'/vendor/autoload.php';
(new Dotenv())->bootEnv(dirname(__DIR__, 2).'/.env');
$kernel = new Kernel('test', false);
$kernel->boot();
$container = $kernel->getContainer()->get('test.service_container');
assert($container instanceof ContainerInterface);
$argv = $_SERVER['argv'];
if ('outage' === $argv[1]) {
    $response = $kernel->handle(Request::create('/api/auth/apple/challenges', 'POST', server: ['CONTENT_TYPE' => 'application/json', 'REMOTE_ADDR' => '192.0.2.1'], content: '{}'));
    echo json_encode([$response->getStatusCode(), $response->headers->get('Cache-Control'), $response->getContent()], JSON_THROW_ON_ERROR);
    exit;
}
$connection = $container->get(Connection::class);
assert($connection instanceof Connection);
echo $connection->fetchOne('SELECT pg_backend_pid()')."\n";
flush();
if ('consume' === $argv[1]) {
    $repository = $container->get(LoginChallengeRepository::class);
    assert($repository instanceof LoginChallengeRepository);
    echo $connection->transactional(fn () => $repository->consume($argv[2], $argv[3]))->name;
} else {
    $limiter = new AuthenticationRateLimiter($connection, new FixedClock((int) $argv[3]));
    echo $limiter->attempt('apple_challenge', $argv[2]);
}
