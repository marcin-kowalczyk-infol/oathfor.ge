<?php

declare(strict_types=1);

namespace App\Tests\Integration;

use App\Identity\Clock;
use App\Tests\Fixtures\FixedClock;
use Doctrine\DBAL\Connection;
use PHPUnit\Framework\Attributes\DataProvider;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\Process\Process;

final class OnboardingProfileEndpointTest extends WebTestCase
{
    private Connection $connection;
    private KernelBrowser $client;
    private FixedClock $clock;
    private const ACCOUNT = '00000000-0000-4000-8000-000000000001';
    private const TOKEN = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    private const DEFAULT_PROFILE = ['locale' => null, 'timezone' => null, 'intention' => null, 'companionIntroduced' => false, 'notificationPreference' => null];

    protected function setUp(): void
    {
        $this->client = self::createClient();
        $this->client->disableReboot();
        $connection = self::getContainer()->get(Connection::class);
        self::assertInstanceOf(Connection::class, $connection);
        $this->connection = $connection;
        self::assertSame('oathforge_test', $connection->fetchOne('SELECT current_database()'));
        $connection->executeStatement('TRUNCATE account, provider_identity, app_session CASCADE');
        $this->clock = new FixedClock();
        self::getContainer()->set(Clock::class, $this->clock);
        $connection->insert('account', ['id' => self::ACCOUNT, 'created_at' => $this->clock->time]);
        $connection->insert('app_session', ['token_digest' => hash('sha256', self::TOKEN), 'account_id' => self::ACCOUNT, 'issued_at' => $this->clock->time, 'expires_at' => $this->clock->time + 2592000]);
    }

    public function testDefaultAndPartialProfileResponsesHaveExactShape(): void
    {
        $this->request('GET', '/api/profile');
        $this->assertProfile(self::DEFAULT_PROFILE, 'pending');
        $this->request('PATCH', '/api/profile', '{"locale":"pl","timezone":"Europe/Warsaw"}');
        $this->assertProfile(array_replace(self::DEFAULT_PROFILE, ['locale' => 'pl', 'timezone' => 'Europe/Warsaw']), 'pending');
        $this->request('GET', '/api/profile');
        $this->assertProfile(array_replace(self::DEFAULT_PROFILE, ['locale' => 'pl', 'timezone' => 'Europe/Warsaw']), 'pending');
    }

    /** @return iterable<string, array{string, string, int, string}> */
    public static function invalidBodies(): iterable
    {
        foreach (['', '{', '[]', 'null', '{}', '{"profile":{}}', '{"accountId":"other"}', '{"osPermission":"granted"}', '{"companionIntroduced":false}', '{"locale":null}', '{"locale":42}', '{"timezone":[]}', '{"intention":true}', '{"notificationPreference":false}', '{"companionIntroduced":"true"}'] as $index => $body) {
            yield 'invalid-'.$index => [$body, 'application/json', 400, 'invalid_request'];
        }
        foreach (['locale' => ['de', 'PL'], 'timezone' => ['Factory', 'US/Eastern', '+02:00', 'CET', 'Europe/Łódź', str_repeat('a', 129)], 'intention' => ['weight_loss'], 'notificationPreference' => ['denied']] as $field => $values) {
            foreach ($values as $index => $value) {
                $code = match ($field) { 'locale' => 'invalid_locale', 'timezone' => 'invalid_timezone', 'intention' => 'invalid_intention', default => 'invalid_notification_preference' };
                yield $field.'-'.$index => [json_encode([$field => $value], JSON_THROW_ON_ERROR), 'application/json', 400, $code];
            }
        }
        yield 'media' => ['{"locale":"pl"}', 'text/plain', 415, 'unsupported_media_type'];
        yield 'over bound precedes parsing' => [str_repeat('x', 16385), 'text/plain', 413, 'request_too_large'];
    }

    #[DataProvider('invalidBodies')]
    public function testInvalidPatchHasSafeErrorAndNoPartialWrite(string $body, string $type, int $status, string $code): void
    {
        $this->request('PATCH', '/api/profile', $body, $type);
        $this->assertError($status, $code);
        $this->request('GET', '/api/profile');
        $this->assertProfile(self::DEFAULT_PROFILE, 'pending');
    }

    public function testMixedInvalidValuesCannotSaveValidCompanionAcknowledgment(): void
    {
        $this->request('PATCH', '/api/profile', '{"companionIntroduced":true,"locale":"de"}');
        $this->assertError(400, 'invalid_locale');
        $this->request('GET', '/api/profile');
        $this->assertProfile(self::DEFAULT_PROFILE, 'pending');
    }

    public function testCompletionRequiresEmptyObjectAndAllChoicesThenReturnsMonotonicStatus(): void
    {
        foreach (['', '[]', '{"osPermission":"denied"}'] as $body) {
            $this->request('POST', '/api/onboarding/complete', $body);
            $this->assertError(400, 'invalid_request');
        }
        $this->request('POST', '/api/onboarding/complete', '{}', 'text/plain');
        $this->assertError(415, 'unsupported_media_type');
        $this->request('POST', '/api/onboarding/complete', str_repeat('x', 16385));
        $this->assertError(413, 'request_too_large');
        $this->request('POST', '/api/onboarding/complete', '{}');
        $this->assertError(409, 'onboarding_incomplete');
        $profile = ['locale' => 'en', 'timezone' => 'UTC', 'intention' => 'regular_activity', 'companionIntroduced' => true, 'notificationPreference' => 'enabled'];
        $before = $this->connection->fetchAssociative('SELECT * FROM app_session');
        $this->request('PATCH', '/api/profile', json_encode($profile, JSON_THROW_ON_ERROR));
        $this->assertProfile($profile, 'pending');
        for ($attempt = 0; $attempt < 2; ++$attempt) {
            $this->request('POST', '/api/onboarding/complete', '{}');
            $this->assertProfile($profile, 'complete');
        }
        $this->request('GET', '/api/me');
        self::assertSame(['account' => ['id' => self::ACCOUNT, 'onboardingStatus' => 'complete']], $this->body());
        $this->request('PATCH', '/api/profile', '{"notificationPreference":"disabled"}');
        $this->assertProfile(array_replace($profile, ['notificationPreference' => 'disabled']), 'complete');
        self::assertSame($before, $this->connection->fetchAssociative('SELECT * FROM app_session'));
    }

    public function testQueriesAndBodyTargetsAreRejected(): void
    {
        foreach ([['GET', '/api/profile', ''], ['PATCH', '/api/profile', '{"locale":"pl"}'], ['POST', '/api/onboarding/complete', '{}']] as [$method, $path, $body]) {
            $this->request($method, $path.'?accountId=other', $body);
            $this->assertError(400, 'invalid_request');
        }
        $this->request('GET', '/api/profile', '{"accountId":"other"}');
        $this->assertError(400, 'invalid_request');
    }

    public function testMissingMalformedExpiredAndInactiveAuthenticationIsDenied(): void
    {
        foreach ([null, 'Bearer short'] as $header) {
            foreach ([['GET', '/api/profile', ''], ['PATCH', '/api/profile', '{"locale":"pl"}'], ['POST', '/api/onboarding/complete', '{}']] as [$method, $path, $body]) {
                $this->client->request($method, $path, server: null === $header ? [] : ['HTTP_AUTHORIZATION' => $header], content: $body);
                $this->assertError(401, 'unauthenticated');
            }
        }
        $this->clock->time += 2592000;
        $this->request('GET', '/api/profile');
        $this->assertError(401, 'unauthenticated');
        $this->clock->time -= 2592000;
        $this->connection->executeStatement("UPDATE account SET status = 'deleting'");
        $this->request('PATCH', '/api/profile', '{"locale":"pl"}');
        $this->assertError(401, 'unauthenticated');
    }

    public function testDatabaseOutagesReturnSafeNoStoreErrors(): void
    {
        foreach ([['GET', '/api/profile'], ['PATCH', '/api/profile'], ['POST', '/api/onboarding/complete']] as [$method, $path]) {
            $process = new Process([PHP_BINARY, 'tests/Fixtures/profile_http_worker.php', $method, $path], dirname(__DIR__, 2), ['DATABASE_URL' => 'postgresql://DUMMY:DUMMY-never-log-this@127.0.0.1:1/unavailable?serverVersion=17']);
            $process->setTimeout(10);
            $process->run();
            self::assertSame(0, $process->getExitCode(), $process->getErrorOutput());
            self::assertSame([503, 'no-store, private', '{"error":{"code":"temporarily_unavailable"}}'], json_decode($process->getOutput(), true, flags: JSON_THROW_ON_ERROR));
            self::assertSame('', $process->getErrorOutput());
        }
    }

    private function request(string $method, string $path, string $body = '', string $type = 'application/json'): void
    {
        $this->client->request($method, $path, server: ['HTTP_AUTHORIZATION' => 'Bearer '.self::TOKEN, 'CONTENT_TYPE' => $type], content: $body);
    }

    /** @param array<string, mixed> $profile */
    private function assertProfile(array $profile, string $status): void
    {
        self::assertSame(200, $this->client->getResponse()->getStatusCode());
        self::assertSame(['profile' => $profile, 'onboardingStatus' => $status], $this->body());
        self::assertResponseHeaderSame('Cache-Control', 'no-store, private');
    }

    private function assertError(int $status, string $code): void
    {
        self::assertSame($status, $this->client->getResponse()->getStatusCode());
        self::assertSame(['error' => ['code' => $code]], $this->body());
        self::assertResponseHeaderSame('Cache-Control', 'no-store, private');
    }

    /** @return array<string, mixed> */
    private function body(): array { return json_decode((string) $this->client->getResponse()->getContent(), true, flags: JSON_THROW_ON_ERROR); }
}
