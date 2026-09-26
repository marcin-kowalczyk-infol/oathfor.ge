<?php

declare(strict_types=1);
namespace App\Tests\Integration;

use App\Identity\Clock;
use App\Oath\OathCursor;
use App\Tests\Fixtures\{CharacterFixture, FixedClock};
use Doctrine\DBAL\Connection;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

final class CharacterOathOwnershipTest extends WebTestCase
{
    private Connection $connection;
    private KernelBrowser $client;
    private FixedClock $clock;
    private const ACCOUNT = '00000000-0000-4000-8000-000000000001';
    private const TOKEN = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    protected function setUp(): void
    {
        $this->client = self::createClient();
        $this->client->disableReboot();
        $connection = self::getContainer()->get(Connection::class);
        self::assertInstanceOf(Connection::class, $connection);
        $this->connection = $connection;
        self::assertSame('oathforge_test', $this->connection->fetchOne('SELECT current_database()'));
        $this->connection->executeStatement('TRUNCATE account CASCADE');
        $this->clock = new FixedClock();
        self::getContainer()->set(Clock::class, $this->clock);
        $this->connection->insert('account', ['id' => self::ACCOUNT, 'created_at' => $this->clock->time, 'onboarding_status' => 'complete']);
        $this->connection->insert('app_session', ['token_digest' => hash('sha256', self::TOKEN), 'account_id' => self::ACCOUNT, 'issued_at' => $this->clock->time, 'expires_at' => $this->clock->time + 2592000]);
    }
    public function testOathEndpointsRequireActiveCharacter(): void
    {
        $this->request('POST', '/api/oath-previews', $this->previewInput()); $this->assertError(409, 'character_required');
        $this->request('GET', '/api/oaths'); $this->assertError(409, 'character_required');
        $this->request('GET', '/api/oaths?view=history'); $this->assertError(409, 'character_required');
        $this->request('GET', '/api/oaths/00000000-0000-4000-a000-000000000001'); $this->assertError(409, 'character_required');
        $this->request('GET', '/api/oath-pause'); $this->assertError(409, 'character_required');
        $this->request('POST', '/api/oath-pause', ['characterId' => '00000000-0000-4000-a000-000000000001', 'paused' => false]); $this->assertError(409, 'character_required');
        $this->connection->executeStatement("UPDATE account SET onboarding_status = 'pending'");
        $this->request('POST', '/api/oath-previews', $this->previewInput()); $this->assertError(409, 'onboarding_incomplete');
        self::assertSame(0, $this->connection->fetchOne('SELECT COUNT(*) FROM oath_preview'));
        self::assertSame(0, $this->connection->fetchOne('SELECT COUNT(*) FROM player_character'));
    }
    public function testPreviewAndOathCarryTheActiveCharacter(): void
    {
        $a = CharacterFixture::activate($this->connection, self::ACCOUNT);
        $this->request('POST', '/api/oath-previews', $this->previewInput());
        self::assertSame(201, $this->client->getResponse()->getStatusCode());
        $body = $this->body();
        self::assertSame(['preview', 'characterId', 'serverTime'], array_keys($body));
        self::assertSame($a, $body['characterId']);
        self::assertSame($a, $this->connection->fetchOne('SELECT character_id FROM oath_preview WHERE id = ?', [$body['preview']['id']]));
        $this->request('GET', '/api/oath-previews/'.$body['preview']['id']);
        self::assertSame(['preview' => $body['preview'], 'characterId' => $a, 'oathId' => null], $this->body());
        $this->accept($body['preview']['id']);
        self::assertSame(201, $this->client->getResponse()->getStatusCode());
        self::assertSame($a, $this->body()['oath']['characterId']);
        self::assertSame($a, $this->connection->fetchOne('SELECT character_id FROM oath'));
    }
    public function testAcceptanceAfterSwitchBelongsToPreviewCharacter(): void
    {
        $a = CharacterFixture::activate($this->connection, self::ACCOUNT);
        $preview = $this->preview();
        $b = CharacterFixture::activate($this->connection, self::ACCOUNT, 2);
        $this->request('GET', '/api/oath-previews/'.$preview);
        self::assertSame(200, $this->client->getResponse()->getStatusCode());
        self::assertSame($a, $this->body()['characterId']);
        self::assertNull($this->body()['oathId']);
        $this->accept($preview);
        self::assertSame(201, $this->client->getResponse()->getStatusCode());
        $oath = $this->body()['oath'];
        self::assertSame($a, $oath['characterId']);
        $this->request('GET', '/api/oaths');
        self::assertSame(['items' => [], 'nextCursor' => null, 'serverTime' => gmdate('Y-m-d\TH:i:s\Z', $this->clock->time), 'paused' => false, 'characterId' => $b], $this->body());
        $this->request('GET', '/api/oaths/'.$oath['id']); $this->assertError(404, 'not_found');
        $this->accept($preview);
        self::assertSame(200, $this->client->getResponse()->getStatusCode());
        self::assertSame($oath['id'], $this->body()['oath']['id']);
        $this->switchTo($a);
        $this->request('GET', '/api/oaths');
        self::assertSame([$oath['id']], array_column($this->body()['items'], 'id'));
        self::assertSame($a, $this->body()['characterId']);
        $this->request('GET', '/api/oaths/'.$oath['id']);
        self::assertSame($oath, $this->body()['oath']);
        $this->connection->executeStatement('UPDATE account SET active_character_id = NULL');
        $this->request('GET', '/api/oath-previews/'.$preview);
        self::assertSame(['characterId' => $a, 'oathId' => $oath['id']], array_intersect_key($this->body(), ['characterId' => 1, 'oathId' => 1]));
    }
    public function testAcceptanceWithoutActiveCharacterUsesPreviewCharacter(): void
    {
        $a = CharacterFixture::activate($this->connection, self::ACCOUNT);
        $preview = $this->preview();
        $this->connection->executeStatement('UPDATE account SET active_character_id = NULL');
        $this->accept($preview);
        self::assertSame(201, $this->client->getResponse()->getStatusCode());
        self::assertSame($a, $this->body()['oath']['characterId']);
        self::assertSame($a, $this->connection->fetchOne('SELECT character_id FROM oath'));
        self::assertNull($this->connection->fetchOne('SELECT active_character_id FROM account'));
    }
    public function testListsDetailAndCursorsAreIsolatedPerCharacter(): void
    {
        $a = CharacterFixture::activate($this->connection, self::ACCOUNT);
        $aOaths = [$this->oath(), $this->oath()];
        $b = CharacterFixture::activate($this->connection, self::ACCOUNT, 2);
        $bOaths = [$this->oath(), $this->oath()];
        sort($aOaths); sort($bOaths);
        $this->connection->executeStatement("UPDATE oath SET state = 'withdrawn', terminal_at = ?, reason = 'character_paused' WHERE id IN (?, ?)", [$this->clock->time, $aOaths[1], $bOaths[1]]);
        $this->request('GET', '/api/oaths?limit=1');
        self::assertSame([$bOaths[0]], array_column($this->body()['items'], 'id'));
        self::assertNull($this->body()['nextCursor']);
        $this->request('GET', '/api/oaths?view=history');
        self::assertSame([$bOaths[1]], array_column($this->body()['items'], 'id'));
        foreach ($aOaths as $id) { $this->request('GET', '/api/oaths/'.$id); $this->assertError(404, 'not_found'); }
        $this->request('GET', '/api/oath-pause');
        self::assertSame(['paused' => false, 'withdraw' => [$bOaths[0]], 'preserve' => [], 'characterId' => $b], array_intersect_key($this->body(), ['paused' => 1, 'withdraw' => 1, 'preserve' => 1, 'characterId' => 1]));
        $this->switchTo($a);
        $this->request('GET', '/api/oaths');
        self::assertSame([$aOaths[0]], array_column($this->body()['items'], 'id'));
        $this->request('GET', '/api/oaths?view=history');
        self::assertSame([$aOaths[1]], array_column($this->body()['items'], 'id'));
        $this->request('GET', '/api/oath-pause');
        self::assertSame([$aOaths[0]], $this->body()['withdraw']);
        self::assertSame($a, $this->body()['characterId']);
        $third = $this->oath();
        $this->request('GET', '/api/oaths?limit=1');
        $cursor = $this->body()['nextCursor'];
        self::assertIsString($cursor);
        $this->request('GET', '/api/oaths?limit=1&cursor='.$cursor);
        self::assertSame(200, $this->client->getResponse()->getStatusCode());
        $this->switchTo($b);
        $this->request('GET', '/api/oaths?limit=1&cursor='.$cursor); $this->assertError(400, 'invalid_request');
        $anchor = min($aOaths[0], $third) === $aOaths[0] ? $aOaths[0] : $third;
        $forged = OathCursor::encode(self::ACCOUNT, $b, 'today', $this->clock->time + 7200, $anchor);
        $this->request('GET', '/api/oaths?limit=1&cursor='.$forged); $this->assertError(400, 'invalid_request');
    }
    public function testPauseWithdrawsOnlyActiveCharacterOaths(): void
    {
        CharacterFixture::activate($this->connection, self::ACCOUNT);
        $aOath = $this->oath();
        $b = CharacterFixture::activate($this->connection, self::ACCOUNT, 2);
        $bOath = $this->oath();
        $this->request('GET', '/api/oath-pause');
        $revision = $this->body()['revision'];
        $this->request('POST', '/api/oath-pause', ['characterId' => $b, 'paused' => true, 'revision' => $revision]);
        self::assertSame(200, $this->client->getResponse()->getStatusCode());
        self::assertSame($b, $this->body()['characterId']);
        self::assertSame(['withdrawn', 'character_paused'], array_values((array) $this->connection->fetchAssociative('SELECT state, reason FROM oath WHERE id = ?', [$bOath])));
        self::assertSame('active', $this->connection->fetchOne('SELECT state FROM oath WHERE id = ?', [$aOath]));
        self::assertSame([false, true], array_map('boolval', $this->connection->fetchFirstColumn('SELECT paused FROM player_character ORDER BY slot')));
    }
    public function testRevisionBindsCharacter(): void
    {
        CharacterFixture::activate($this->connection, self::ACCOUNT);
        $this->request('GET', '/api/oath-pause');
        $first = $this->body()['revision'];
        $second = CharacterFixture::activate($this->connection, self::ACCOUNT, 2);
        $this->request('GET', '/api/oath-pause');
        self::assertNotSame($first, $this->body()['revision']);
        $this->request('POST', '/api/oath-pause', ['characterId' => $second, 'paused' => true, 'revision' => $first]); $this->assertError(409, 'pause_preview_changed');
    }
    private function switchTo(string $id): void
    {
        $this->request('PUT', '/api/characters/active', ['characterId' => $id]);
        self::assertSame(200, $this->client->getResponse()->getStatusCode());
    }
    private function oath(): string
    {
        $this->accept($this->preview());
        self::assertSame(201, $this->client->getResponse()->getStatusCode());
        return $this->body()['oath']['id'];
    }
    private function preview(): string
    {
        $this->request('POST', '/api/oath-previews', $this->previewInput());
        self::assertSame(201, $this->client->getResponse()->getStatusCode(), (string) $this->client->getResponse()->getContent());
        return $this->body()['preview']['id'];
    }
    private function accept(string $previewId): void { $this->request('POST', '/api/oaths', ['previewId' => $previewId, 'requestId' => $previewId, 'accepted' => true]); }
    /** @return array<string, mixed> */
    private function previewInput(): array { return ['activity' => 'running', 'activation' => ['mode' => 'now'], 'deadline' => ['local' => gmdate('Y-m-d\TH:i:s', $this->clock->time + 7200), 'timezone' => 'UTC']]; }
    /** @param array<string, mixed>|null $input */
    private function request(string $method, string $path, ?array $input = null): void { $this->client->request($method, $path, server: ['HTTP_AUTHORIZATION' => 'Bearer '.self::TOKEN, 'CONTENT_TYPE' => 'application/json'], content: null === $input ? '' : json_encode($input, JSON_THROW_ON_ERROR)); }
    private function assertError(int $status, string $code): void
    {
        self::assertSame($status, $this->client->getResponse()->getStatusCode(), (string) $this->client->getResponse()->getContent());
        self::assertSame(['error' => ['code' => $code]], $this->body());
        self::assertResponseHeaderSame('Cache-Control', 'no-store, private');
    }
    /** @return array<string, mixed> */
    private function body(): array { return json_decode((string) $this->client->getResponse()->getContent(), true, flags: JSON_THROW_ON_ERROR); }
}
