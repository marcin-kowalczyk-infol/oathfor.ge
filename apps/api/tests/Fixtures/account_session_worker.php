<?php

declare(strict_types=1);

use App\Identity\AccountDeletionGate;
use App\Identity\AccountSessionIssuer;
use App\Identity\AppleAuthorization;
use App\Identity\ChallengeConsumption;
use App\Identity\LoginChallengeRepository;
use App\Identity\ProviderTokenCipher;
use App\Identity\ProviderTokenKeyring;
use App\Identity\SecureRandomSource;
use App\Identity\SessionIssuanceException;
use App\Identity\Clock;
use App\Identity\VerifiedAppleIdentity;
use App\Kernel;
use App\Tests\Fixtures\FixedClock;
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
$clock = str_starts_with($arguments[3], 'file:') ? new class(substr($arguments[3], 5)) implements Clock {
    public function __construct(private string $path) {}
    public function now(): int { return (int) file_get_contents($this->path); }
} : new FixedClock((int) $arguments[3]);
$random = new SecureRandomSource();
$cipher = new ProviderTokenCipher(new ProviderTokenKeyring($arguments[2], 'v1'), $random);
$issuer = new AccountSessionIssuer($connection, $clock, $random, $cipher);
echo $connection->fetchOne('SELECT pg_backend_pid()')."\n";
flush();
try {
    $result = $connection->transactional(function () use ($arguments, $issuer, $connection, $clock): array {
        if ('delete' === $arguments[1]) {
            return ['deletionGate' => (new AccountDeletionGate($connection, $clock))->beginDeletion($arguments[4])];
        }
        if (isset($arguments[6])) {
            $consumed = (new LoginChallengeRepository($connection, $clock))->consume($arguments[6], 'DUMMY-nonce');
            if (ChallengeConsumption::Consumed !== $consumed) {
                return ['failure' => 'ChallengeUnavailable'];
            }
        }
        $session = $issuer->issue(new AppleAuthorization(new VerifiedAppleIdentity('https://appleid.apple.com', $arguments[4]), 'DUMMY-refresh-token'), (int) $arguments[5]);
        return ['accountId' => $session->account->id, 'expiresAt' => $session->expiresAt];
    });
    echo json_encode($result, JSON_THROW_ON_ERROR);
} catch (SessionIssuanceException $failure) {
    echo json_encode(['failure' => $failure->reason->name], JSON_THROW_ON_ERROR);
} catch (\Doctrine\DBAL\Exception) {
    echo '{"failure":"database_failure"}';
}
