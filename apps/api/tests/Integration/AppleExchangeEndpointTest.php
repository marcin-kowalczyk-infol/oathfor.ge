<?php

declare(strict_types=1);

namespace App\Tests\Integration;

use App\Identity\Clock;
use App\Identity\AppleLoginService;
use App\Tests\Fixtures\AppleLoginFixture;
use App\Tests\Fixtures\AppleTokenFixture;
use App\Tests\Fixtures\FixedClock;
use Doctrine\DBAL\Connection;
use PHPUnit\Framework\Attributes\DataProvider;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\Process\Process;

final class AppleExchangeEndpointTest extends WebTestCase
{
    private Connection $connection;
    private FixedClock $clock;
    private KernelBrowser $client;

    protected function setUp(): void
    {
        $this->client = self::createClient();
        $this->client->disableReboot();
        $connection = self::getContainer()->get(Connection::class);
        self::assertInstanceOf(Connection::class, $connection);
        $this->connection = $connection;
        self::assertSame('oathforge_test', $connection->fetchOne('SELECT current_database()'));
        $connection->executeStatement('TRUNCATE login_challenge, auth_rate_bucket, app_session, provider_identity, account CASCADE');
        $this->clock = new FixedClock();
        self::getContainer()->set(Clock::class, $this->clock);
    }

    /** @return iterable<string, array{string, int, string, string, string}> */
    public static function invalidRequests(): iterable
    {
        $valid = ['challengeId' => str_repeat('a', 43), 'identityToken' => 'synthetic-token', 'authorizationCode' => 'synthetic-code'];
        foreach (['empty' => '', 'malformed' => '{', 'list' => '[]', 'null' => 'null', 'missing' => '{}'] as $name => $body) {
            yield $name => [$body, 400, 'invalid_request', 'application/json', ''];
        }
        foreach (['challengeId' => ['', 'short', str_repeat('a', 44), str_repeat('a', 42).'!', null, 123], 'identityToken' => ['', " \n", str_repeat('x', 12289), null, []], 'authorizationCode' => ['', "\t", str_repeat('x', 2049), null, 5]] as $field => $values) {
            foreach ($values as $index => $value) {
                yield $field.'-'.$index => [json_encode(array_replace($valid, [$field => $value]), JSON_THROW_ON_ERROR), 400, 'invalid_request', 'application/json', ''];
            }
        }
        yield 'extra account' => [json_encode($valid + ['accountId' => 'client-choice'], JSON_THROW_ON_ERROR), 400, 'invalid_request', 'application/json', ''];
        yield 'query credentials' => [json_encode($valid, JSON_THROW_ON_ERROR), 400, 'invalid_request', 'application/json', '?identityToken=forbidden'];
        yield 'media' => [json_encode($valid, JSON_THROW_ON_ERROR), 415, 'unsupported_media_type', 'text/plain', ''];
        yield 'too large before JSON' => [str_repeat('x', 16385), 413, 'request_too_large', 'text/plain', ''];
    }

    #[DataProvider('invalidRequests')]
    public function testRejectsInvalidInputBeforeCredentialsAreUsed(string $body, int $status, string $code, string $type, string $query): void
    {
        $this->request($body, $type, $query);
        $this->assertError($status, $code);
        self::assertSame(0, $this->connection->fetchOne('SELECT COUNT(*) FROM account'));
        self::assertSame(0, $this->connection->fetchOne('SELECT COUNT(*) FROM app_session'));
        self::assertSame(1, $this->connection->fetchOne("SELECT attempts FROM auth_rate_bucket WHERE route = 'apple_exchange' AND bucket = 'global'"));
    }

    public function testAllAttemptsCountWithoutConsumingChallengeRouteQuota(): void
    {
        for ($i = 0; $i < 10; ++$i) {
            $this->request('[]');
            $this->assertError(400, 'invalid_request');
        }
        $this->request('[]');
        $this->assertError(429, 'rate_limited');
        self::assertResponseHeaderSame('Retry-After', '60');
        $this->client->request('POST', '/api/auth/apple/challenges', server: ['CONTENT_TYPE' => 'application/json', 'REMOTE_ADDR' => '192.0.2.1'], content: '{}');
        self::assertResponseStatusCodeSame(201);
        self::assertSame(1, $this->connection->fetchOne("SELECT attempts FROM auth_rate_bucket WHERE route = 'apple_challenge' AND bucket = 'global'"));
        $this->clock->time += 60;
        $this->request('[]');
        $this->assertError(400, 'invalid_request');
    }

    public function testGlobalQuotaSpansDirectPeerAddressesAndResetsAtMinuteBoundary(): void
    {
        $minute = intdiv($this->clock->time, 60);
        $this->connection->insert('auth_rate_bucket', ['route' => 'apple_exchange', 'bucket' => 'global', 'minute' => $minute, 'attempts' => 999]);
        $this->request('[]', ip: '192.0.2.2');
        $this->assertError(400, 'invalid_request');
        $this->request('[]', ip: '192.0.2.3');
        $this->assertError(429, 'rate_limited');
        $this->clock->time += 59;
        $this->request('[]', ip: '192.0.2.4');
        $this->assertError(429, 'rate_limited');
        self::assertResponseHeaderSame('Retry-After', '1');
        ++$this->clock->time;
        $this->request('[]');
        $this->assertError(400, 'invalid_request');
    }

    public function testExactFieldBoundsReachChallengeValidation(): void
    {
        $this->request(json_encode(['challengeId' => str_repeat('a', 43), 'identityToken' => str_repeat('x', 12288), 'authorizationCode' => str_repeat('x', 2048)], JSON_THROW_ON_ERROR));
        $this->assertError(409, 'challenge_unavailable');
    }

    public function testMissingProviderConfigurationFailsClosedWithLiveChallenge(): void
    {
        $id = str_repeat('a', 43);
        $this->connection->insert('login_challenge', ['id' => $id, 'nonce_digest' => hash('sha256', str_repeat('b', 43)), 'created_at' => $this->clock->time, 'expires_at' => $this->clock->time + 300]);
        $this->request(json_encode(['challengeId' => $id, 'identityToken' => 'synthetic-token', 'authorizationCode' => 'synthetic-code'], JSON_THROW_ON_ERROR));
        $this->assertError(503, 'temporarily_unavailable');
        self::assertNull($this->connection->fetchOne('SELECT consumed_at FROM login_challenge'));
        self::assertSame(0, $this->connection->fetchOne('SELECT COUNT(*) FROM app_session'));
    }

    public function testSignedExchangeReturnsExactSessionAndReplayCannotIssueAgain(): void
    {
        $fixture = new AppleLoginFixture($this->connection, $this->clock);
        try {
            $fixture->seedChallenge();
            self::getContainer()->set(AppleLoginService::class, $fixture->service);
            $body = json_encode(['challengeId' => AppleTokenFixture::NONCE, 'identityToken' => $fixture->tokenFixture->token(), 'authorizationCode' => 'DUMMY-code'], JSON_THROW_ON_ERROR);
            $this->request($body);
            self::assertSame(200, $this->client->getResponse()->getStatusCode());
            self::assertResponseHeaderSame('Cache-Control', 'no-store, private');
            $response = json_decode((string) $this->client->getResponse()->getContent(), true, flags: JSON_THROW_ON_ERROR);
            self::assertSame(['account', 'session'], array_keys($response));
            self::assertSame(['id', 'onboardingStatus'], array_keys($response['account']));
            self::assertSame(['token', 'expiresAt'], array_keys($response['session']));
            self::assertSame(['id' => $this->connection->fetchOne('SELECT id FROM account'), 'onboardingStatus' => 'pending'], $response['account']);
            self::assertMatchesRegularExpression('/^[A-Za-z0-9_-]{43}$/D', $response['session']['token']);
            self::assertSame(gmdate('Y-m-d\TH:i:s\Z', $this->clock->time + 2592000), $response['session']['expiresAt']);
            self::assertSame(hash('sha256', $response['session']['token']), $this->connection->fetchOne('SELECT token_digest FROM app_session'));
            $this->request($body);
            $this->assertError(409, 'challenge_unavailable');
            self::assertSame(1, $this->connection->fetchOne('SELECT COUNT(*) FROM app_session'));
        } finally {
            $fixture->cleanup();
        }
    }

    public function testSignedWrongNonceReturnsOnlyInvalidCredential(): void
    {
        $fixture = new AppleLoginFixture($this->connection, $this->clock);
        try {
            $fixture->seedChallenge();
            self::getContainer()->set(AppleLoginService::class, $fixture->service);
            $this->request(json_encode(['challengeId' => AppleTokenFixture::NONCE, 'identityToken' => $fixture->tokenFixture->token(['nonce' => str_repeat('b', 43)]), 'authorizationCode' => 'DUMMY-code'], JSON_THROW_ON_ERROR));
            $this->assertError(401, 'invalid_credential');
            self::assertSame(0, $this->connection->fetchOne('SELECT COUNT(*) FROM app_session'));
            self::assertNull($this->connection->fetchOne('SELECT consumed_at FROM login_challenge'));
        } finally {
            $fixture->cleanup();
        }
    }

    public function testDatabaseOutageIsSafeAndHealthStillBoots(): void
    {
        foreach (['/api/auth/apple/exchange', '/api/health'] as $path) {
            $process = new Process([PHP_BINARY, 'tests/Fixtures/apple_exchange_http_worker.php', $path], dirname(__DIR__, 2), ['DATABASE_URL' => 'postgresql://DUMMY:DUMMY-never-log-this@127.0.0.1:1/unavailable?serverVersion=17']);
            $process->setTimeout(10);
            $process->run();
            self::assertSame(0, $process->getExitCode(), $process->getErrorOutput());
            $response = json_decode($process->getOutput(), true, flags: JSON_THROW_ON_ERROR);
            if ('/api/health' === $path) {
                self::assertSame(200, $response[0]);
                self::assertSame('{"status":"ok"}', $response[2]);
            } else {
                self::assertSame([503, 'no-store, private', '{"error":{"code":"temporarily_unavailable"}}'], $response);
            }
            self::assertSame('', $process->getErrorOutput());
        }
    }

    private function request(string $body, string $type = 'application/json', string $query = '', string $ip = '192.0.2.1'): void
    {
        $this->client->request('POST', '/api/auth/apple/exchange'.$query, server: ['CONTENT_TYPE' => $type, 'REMOTE_ADDR' => $ip, 'HTTP_X_FORWARDED_FOR' => '198.51.100.'.random_int(1, 250)], content: $body);
    }

    private function assertError(int $status, string $code): void
    {
        self::assertSame($status, $this->client->getResponse()->getStatusCode());
        self::assertSame(['error' => ['code' => $code]], json_decode((string) $this->client->getResponse()->getContent(), true, flags: JSON_THROW_ON_ERROR));
        self::assertResponseHeaderSame('Cache-Control', 'no-store, private');
    }
}
