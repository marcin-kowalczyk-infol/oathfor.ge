<?php

declare(strict_types=1);

namespace App\Tests\Integration;

use App\Identity\Clock;
use App\Tests\Fixtures\FixedClock;
use Doctrine\DBAL\Connection;
use PHPUnit\Framework\Attributes\DataProvider;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\BrowserKit\Cookie;
use Symfony\Component\Process\Process;

final class SessionEndpointTest extends WebTestCase
{
    private Connection $connection;
    private FixedClock $clock;
    private KernelBrowser $client;
    private const ACCOUNT = '00000000-0000-4000-8000-000000000001';

    protected function setUp(): void
    {
        $this->client = self::createClient();
        $this->client->disableReboot();
        $connection = self::getContainer()->get(Connection::class);
        self::assertInstanceOf(Connection::class, $connection);
        $this->connection = $connection;
        self::assertSame('oathforge_test', $connection->fetchOne('SELECT current_database()'));
        $connection->executeStatement('TRUNCATE app_session, provider_identity, account');
        $this->clock = new FixedClock();
        self::getContainer()->set(Clock::class, $this->clock);
        $connection->insert('account', ['id' => self::ACCOUNT, 'created_at' => $this->clock->time]);
    }

    /** @return iterable<string, array{?string}> */
    public static function invalidHeaders(): iterable
    {
        yield 'missing' => [null];
        yield 'wrong scheme' => ['Basic '.str_repeat('a', 43)];
        yield 'short' => ['Bearer short'];
        yield 'padded' => ['Bearer '.str_repeat('a', 43).'='];
        yield 'multiple' => ['Bearer '.str_repeat('a', 43).', Bearer '.str_repeat('b', 43)];
        yield 'extra whitespace' => ['Bearer  '.str_repeat('a', 43)];
    }

    #[DataProvider('invalidHeaders')]
    public function testMissingAndMalformedBearerHaveSameSafeDenial(?string $header): void
    {
        foreach ([['GET', '/api/me'], ['DELETE', '/api/auth/session']] as [$method, $path]) {
            $this->client->request($method, $path, server: null === $header ? [] : ['HTTP_AUTHORIZATION' => $header]);
            $this->assertError(401, 'unauthenticated');
        }
    }

    public function testLiveSessionReturnsExactAccountWithoutRenewingExpiry(): void
    {
        $token = $this->session();
        $this->connection->executeStatement("UPDATE account SET onboarding_status = 'complete'");
        $before = $this->connection->fetchAssociative('SELECT * FROM app_session');
        $this->request('GET', '/api/me', $token);
        self::assertResponseIsSuccessful();
        self::assertSame(['account' => ['id' => self::ACCOUNT, 'onboardingStatus' => 'complete']], $this->body());
        self::assertResponseHeaderSame('Cache-Control', 'no-store, private');
        self::assertSame($before, $this->connection->fetchAssociative('SELECT * FROM app_session'));
    }

    public function testUnknownExpiredRevokedAndInactiveAccountsHaveSameDenial(): void
    {
        $this->request('GET', '/api/me', str_repeat('z', 43));
        $this->assertError(401, 'unauthenticated');
        $token = $this->session();
        $this->clock->time += 2592000;
        $this->request('GET', '/api/me', $token);
        $this->assertError(401, 'unauthenticated');
        $this->clock->time -= 2592000;
        $this->connection->executeStatement('UPDATE app_session SET revoked_at = ?', [$this->clock->time]);
        $this->request('GET', '/api/me', $token);
        $this->assertError(401, 'unauthenticated');
        $this->connection->executeStatement('UPDATE app_session SET revoked_at = NULL');
        foreach (['deleting', 'deleted'] as $status) {
            $this->connection->executeStatement('UPDATE account SET status = ?', [$status]);
            $this->request('GET', '/api/me', $token);
            $this->assertError(401, 'unauthenticated');
        }
    }

    public function testQueryAndCookieCannotAuthenticateOrRevoke(): void
    {
        $token = $this->session();
        $this->client->getCookieJar()->set(new Cookie('access_token', $token));
        foreach ([['GET', '/api/me'], ['DELETE', '/api/auth/session']] as [$method, $path]) {
            $this->client->request($method, $path.'?access_token='.$token);
            $this->assertError(401, 'unauthenticated');
        }
        self::assertNull($this->connection->fetchOne('SELECT revoked_at FROM app_session'));
    }

    public function testLogoutRevokesOnlyPresentedSessionAndIsIdempotent(): void
    {
        $token = $this->session();
        $other = $this->session('b');
        foreach ([$token, $token, str_repeat('z', 43)] as $presented) {
            $this->request('DELETE', '/api/auth/session', $presented);
            self::assertResponseStatusCodeSame(204);
            self::assertSame('', $this->client->getResponse()->getContent());
            self::assertResponseHeaderSame('Cache-Control', 'no-store, private');
        }
        $this->request('GET', '/api/me', $token);
        $this->assertError(401, 'unauthenticated');
        $this->request('GET', '/api/me', $other);
        self::assertResponseIsSuccessful();
        $this->clock->time += 2592000;
        $this->request('DELETE', '/api/auth/session', $other);
        self::assertResponseStatusCodeSame(204);
    }

    public function testOutagesAreSafeAndHealthDoesNotRequireDatabase(): void
    {
        foreach ([['GET', '/api/me', 503, '{"error":{"code":"temporarily_unavailable"}}'], ['DELETE', '/api/auth/session', 503, '{"error":{"code":"temporarily_unavailable"}}'], ['GET', '/api/health', 200, '{"status":"ok"}']] as [$method, $path, $status, $body]) {
            $process = new Process([PHP_BINARY, 'tests/Fixtures/session_http_worker.php', $method, $path], dirname(__DIR__, 2), ['DATABASE_URL' => 'postgresql://DUMMY:DUMMY-never-log-this@127.0.0.1:1/unavailable?serverVersion=17']);
            $process->setTimeout(10);
            $process->run();
            self::assertSame(0, $process->getExitCode(), $process->getErrorOutput());
            $response = json_decode($process->getOutput(), true, flags: JSON_THROW_ON_ERROR);
            self::assertSame($status, $response[0]);
            self::assertSame($body, $response[2]);
            if (503 === $status) {
                self::assertSame('no-store, private', $response[1]);
            }
            self::assertSame('', $process->getErrorOutput());
        }
    }

    private function session(string $character = 'a'): string
    {
        $token = str_repeat($character, 43);
        $this->connection->insert('app_session', ['token_digest' => hash('sha256', $token), 'account_id' => self::ACCOUNT, 'issued_at' => $this->clock->time, 'expires_at' => $this->clock->time + 2592000]);
        return $token;
    }

    private function request(string $method, string $path, string $token): void
    {
        $this->client->request($method, $path, server: ['HTTP_AUTHORIZATION' => 'Bearer '.$token]);
    }

    private function assertError(int $status, string $code): void
    {
        self::assertResponseStatusCodeSame($status);
        self::assertSame(['error' => ['code' => $code]], $this->body());
        self::assertResponseHeaderSame('Cache-Control', 'no-store, private');
    }

    /** @return array<string, mixed> */
    private function body(): array
    {
        return json_decode((string) $this->client->getResponse()->getContent(), true, flags: JSON_THROW_ON_ERROR);
    }
}
