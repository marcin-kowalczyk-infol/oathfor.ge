<?php

declare(strict_types=1);

namespace App\Tests\Identity;

use App\Identity\AppleJwksFetcher;
use App\Identity\AppleJwksParser;
use App\Identity\CachedAppleSigningKeys;
use App\Identity\IdentityVerificationFailure;
use App\Tests\Fixtures\AppleTokenFixture;
use App\Tests\Fixtures\FixedClock;
use Firebase\JWT\Key;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class CachedAppleSigningKeysTest extends TestCase
{
    private static AppleTokenFixture $first;
    private static AppleTokenFixture $rotated;
    private string $directory;
    private FixedClock $clock;

    public static function setUpBeforeClass(): void
    {
        self::$first = new AppleTokenFixture('DUMMY-first');
        self::$rotated = new AppleTokenFixture('DUMMY-rotated');
    }

    protected function setUp(): void
    {
        $this->directory = sys_get_temp_dir().'/oathforge-jwks-'.bin2hex(random_bytes(8));
        $this->clock = new FixedClock();
    }

    protected function tearDown(): void
    {
        foreach (glob($this->directory.'/*') ?: [] as $path) {
            is_dir($path) ? rmdir($path) : unlink($path);
        }
        if (is_dir($this->directory)) { rmdir($this->directory); }
    }

    public function testFreshSnapshotIsSharedAndExpiresAtExactlySixHours(): void
    {
        $client = new MockHttpClient([$this->snapshot(self::$first), new MockResponse('', ['http_code' => 503])]);
        self::assertInstanceOf(Key::class, $this->source($client)->find(self::$first->kid));
        $this->clock->time += 21599;
        $restarted = $this->source($client);
        self::assertInstanceOf(Key::class, $restarted->find(self::$first->kid));
        self::assertSame(1, $client->getRequestsCount());
        ++$this->clock->time;
        self::assertSame(IdentityVerificationFailure::Unavailable, $this->source($client)->find(self::$first->kid));
        self::assertSame(2, $client->getRequestsCount());
    }

    public function testUnknownKeyRefreshAndSuccessfulCooldownAreBounded(): void
    {
        $client = new MockHttpClient([$this->snapshot(self::$first), $this->snapshot(self::$rotated)]);
        $source = $this->source($client);
        self::assertInstanceOf(Key::class, $source->find(self::$first->kid));
        self::assertSame(IdentityVerificationFailure::InvalidCredential, $source->find(self::$rotated->kid));
        $this->clock->time += 59;
        self::assertSame(IdentityVerificationFailure::InvalidCredential, $this->source($client)->find('unknown'));
        self::assertSame(1, $client->getRequestsCount());
        ++$this->clock->time;
        self::assertInstanceOf(Key::class, $source->find(self::$rotated->kid));
        self::assertSame(IdentityVerificationFailure::InvalidCredential, $source->find('still-unknown'));
        self::assertSame(2, $client->getRequestsCount());
    }

    public function testFailedRefreshKeepsKnownKeyAndUnknownIsUnavailableUntilRecovery(): void
    {
        $client = new MockHttpClient([$this->snapshot(self::$first), new MockResponse('', ['http_code' => 503]), $this->snapshot(self::$first)]);
        $source = $this->source($client);
        self::assertInstanceOf(Key::class, $source->find(self::$first->kid));
        $this->clock->time += 60;
        self::assertSame(IdentityVerificationFailure::Unavailable, $source->find('unknown'));
        self::assertInstanceOf(Key::class, $this->source($client)->find(self::$first->kid));
        self::assertSame(IdentityVerificationFailure::Unavailable, $this->source($client)->find('unknown'));
        self::assertSame(2, $client->getRequestsCount());
        $this->clock->time += 60;
        self::assertSame(IdentityVerificationFailure::InvalidCredential, $source->find('unknown'));
        self::assertSame(3, $client->getRequestsCount());
    }

    public function testAnInProgressFetchPreventsAnotherNetworkCall(): void
    {
        mkdir($this->directory, 0700);
        $lock = fopen($this->directory.'/refresh.lock', 'c+b');
        self::assertIsResource($lock);
        self::assertTrue(flock($lock, LOCK_EX | LOCK_NB));
        $client = new MockHttpClient($this->snapshot(self::$first));
        try {
            self::assertSame(IdentityVerificationFailure::Unavailable, $this->source($client)->find(self::$first->kid));
            self::assertSame(0, $client->getRequestsCount());
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }

    public function testFilesystemFailureIsUnavailableWithoutFetching(): void
    {
        mkdir($this->directory, 0700);
        file_put_contents($this->directory.'/snapshot.json', '{corrupt');
        $client = new MockHttpClient($this->snapshot(self::$first));
        self::assertSame(IdentityVerificationFailure::Unavailable, $this->source($client)->find(self::$first->kid));
        self::assertSame(0, $client->getRequestsCount());
        unlink($this->directory.'/snapshot.json');
        mkdir($this->directory.'/refresh.lock');
        self::assertSame(IdentityVerificationFailure::Unavailable, $this->source($client)->find(self::$first->kid));
        self::assertSame(0, $client->getRequestsCount());
    }

    public function testMalformedRefreshDoesNotReplaceTheLastValidSnapshot(): void
    {
        $client = new MockHttpClient([$this->snapshot(self::$first), new MockResponse('{"keys":[]}')]);
        $source = $this->source($client);
        self::assertInstanceOf(Key::class, $source->find(self::$first->kid));
        $this->clock->time += 60;
        self::assertSame(IdentityVerificationFailure::Unavailable, $source->find('unknown'));
        self::assertInstanceOf(Key::class, $source->find(self::$first->kid));
        self::assertSame(2, $client->getRequestsCount());
    }

    public function testEmptyCacheOutageCooldownAndRecoveryAreShared(): void
    {
        $client = new MockHttpClient([new MockResponse('', ['http_code' => 503]), $this->snapshot(self::$first)]);
        self::assertSame(IdentityVerificationFailure::Unavailable, $this->source($client)->find(self::$first->kid));
        $this->clock->time += 59;
        $restarted = $this->source($client);
        self::assertSame(IdentityVerificationFailure::Unavailable, $restarted->find(self::$first->kid));
        self::assertSame(1, $client->getRequestsCount());
        ++$this->clock->time;
        self::assertInstanceOf(Key::class, $this->source($client)->find(self::$first->kid));
        self::assertSame(2, $client->getRequestsCount());
    }

    public function testSnapshotWriteFailureDoesNotReturnVerificationKey(): void
    {
        $client = new MockHttpClient(function (): MockResponse {
            // Simulate a filesystem fault after the attempt was persisted, during fetch.
            unlink($this->directory.'/snapshot.json');
            mkdir($this->directory.'/snapshot.json');
            return $this->snapshot(self::$first);
        });
        self::assertSame(IdentityVerificationFailure::Unavailable, $this->source($client)->find(self::$first->kid));
        self::assertSame(1, $client->getRequestsCount());
    }

    private function snapshot(AppleTokenFixture $fixture): MockResponse
    {
        return new MockResponse(json_encode(['keys' => [$fixture->jwk]], JSON_THROW_ON_ERROR));
    }

    private function source(MockHttpClient $client): CachedAppleSigningKeys
    {
        return new CachedAppleSigningKeys(new AppleJwksFetcher($client), new AppleJwksParser(), $this->clock, $this->directory);
    }
}
