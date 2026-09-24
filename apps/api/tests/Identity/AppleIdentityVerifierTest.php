<?php

declare(strict_types=1);

namespace App\Tests\Identity;

use App\Identity\AppleIdentityVerifier;
use App\Identity\AppleSigningKeySource;
use App\Identity\IdentityVerificationFailure;
use App\Identity\VerifiedAppleIdentity;
use App\Tests\Fixtures\AppleTokenFixture;
use App\Tests\Fixtures\FixedClock;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class AppleIdentityVerifierTest extends TestCase
{
    private static AppleTokenFixture $fixture;
    private AppleIdentityVerifier $verifier;
    private FixedClock $clock;

    public static function setUpBeforeClass(): void
    {
        self::$fixture = new AppleTokenFixture();
    }

    protected function setUp(): void
    {
        $this->clock = new FixedClock();
        $this->verifier = new AppleIdentityVerifier($this->keys(), $this->clock, AppleTokenFixture::AUDIENCE);
    }

    public function testValidSyntheticSignatureReturnsVerifiedIdentityWithoutProfileData(): void
    {
        $result = $this->verify(self::$fixture->token());
        self::assertInstanceOf(VerifiedAppleIdentity::class, $result);
        self::assertSame('https://appleid.apple.com', $result->issuer);
        self::assertSame('DUMMY-subject', $result->subject);
    }

    /** @return iterable<string, array{array<string, mixed>}> */
    public static function invalidClaims(): iterable
    {
        yield 'issuer' => [['iss' => 'https://attacker.invalid']];
        yield 'audience' => [['aud' => 'another.app']];
        yield 'array audience' => [['aud' => [AppleTokenFixture::AUDIENCE]]];
        yield 'blank subject' => [['sub' => '  ']];
        yield 'array subject' => [['sub' => ['id']]];
        yield 'oversized subject' => [['sub' => str_repeat('a', 256)]];
        yield 'nonce mismatch' => [['nonce' => str_repeat('b', 43)]];
        yield 'array nonce' => [['nonce' => [AppleTokenFixture::NONCE]]];
        yield 'invalid nonce format' => [['nonce' => str_repeat('=', 43)]];
        yield 'iat string' => [['iat' => '1800000000']];
        yield 'iat float' => [['iat' => 1799999999.5]];
        yield 'iat negative' => [['iat' => -1]];
        yield 'iat future despite nbf' => [['iat' => 1800000001, 'nbf' => 1799999990]];
        yield 'exp string' => [['exp' => '1800000300']];
        yield 'exp float' => [['exp' => 1800000300.5]];
        yield 'expired' => [['exp' => 1800000000]];
        yield 'future nbf' => [['nbf' => 1800000001]];
        yield 'negative nbf' => [['nbf' => -1]];
        yield 'string nbf' => [['nbf' => '1800000000']];
        yield 'null nbf' => [['nbf' => null]];
    }

    /** @param array<string, mixed> $changes */
    #[DataProvider('invalidClaims')]
    public function testRejectsInvalidSignedClaims(array $changes): void
    {
        self::assertSame(IdentityVerificationFailure::InvalidCredential, $this->verify(self::$fixture->token($changes)));
    }

    public function testMissingRequiredClaimsAndEmailOnlyIdentityAreRejected(): void
    {
        foreach (['iss', 'aud', 'sub', 'nonce', 'iat', 'exp'] as $claim) {
            $claims = self::$fixture->claims();
            unset($claims[$claim]);
            $claims['email'] = 'DUMMY@example.invalid';
            self::assertSame(IdentityVerificationFailure::InvalidCredential, $this->verify(JWT::encode($claims, self::$fixture->privateKey, 'RS256', self::$fixture->kid)), $claim);
        }
    }

    public function testExpiryHasNoLeewayAndLibraryClockStateIsRestored(): void
    {
        $oldTime = JWT::$timestamp;
        $oldLeeway = JWT::$leeway;
        try {
            JWT::$timestamp = 42;
            JWT::$leeway = 999;
            $token = self::$fixture->token();
            $this->clock->time += 299;
            self::assertInstanceOf(VerifiedAppleIdentity::class, $this->verify($token));
            ++$this->clock->time;
            self::assertSame(IdentityVerificationFailure::InvalidCredential, $this->verify($token));
            self::assertSame(42, JWT::$timestamp);
            self::assertSame(999, JWT::$leeway);
        } finally {
            JWT::$timestamp = $oldTime;
            JWT::$leeway = $oldLeeway;
        }
    }

    public function testSignatureAndMalformedOrUntrustedHeadersAreRejected(): void
    {
        $token = self::$fixture->token();
        $parts = explode('.', $token);
        $parts[2] = ('A' === $parts[2][0] ? 'B' : 'A').substr($parts[2], 1);
        self::assertSame(IdentityVerificationFailure::InvalidCredential, $this->verify(implode('.', $parts)));
        foreach (['', 'bad', 'e30.e30.e30', 'a.b.c.d', str_repeat('x', 12289)] as $malformed) {
            self::assertSame(IdentityVerificationFailure::InvalidCredential, $this->verify($malformed));
        }
        foreach ([['alg' => 'HS256'], ['alg' => 'none'], ['kid' => ''], ['kid' => ['x']], ['kid' => str_repeat('a', 129)], ['crit' => ['unknown']], ['crit' => []]] as $header) {
            $parts = explode('.', $token);
            $parts[0] = JWT::urlsafeB64Encode(json_encode(array_replace(['alg' => 'RS256', 'kid' => self::$fixture->kid], $header), JSON_THROW_ON_ERROR));
            self::assertSame(IdentityVerificationFailure::InvalidCredential, $this->verify(implode('.', $parts)));
        }
        $critical = JWT::encode(self::$fixture->claims(), self::$fixture->privateKey, 'RS256', self::$fixture->kid, ['crit' => ['unknown'], 'unknown' => 'value']);
        self::assertSame(IdentityVerificationFailure::InvalidCredential, $this->verify($critical));
    }

    public function testTokenUrlsDoNotChangeKeySourceAndMissingConfigurationFailsClosed(): void
    {
        $token = JWT::encode(self::$fixture->claims(), self::$fixture->privateKey, 'RS256', self::$fixture->kid, ['jku' => 'https://attacker.invalid', 'x5u' => 'https://attacker.invalid']);
        self::assertInstanceOf(VerifiedAppleIdentity::class, $this->verify($token));
        foreach (['', '   ', 'DUMMY-client', 'org.DUMMY.app'] as $audience) {
            $verifier = new AppleIdentityVerifier($this->keys(), $this->clock, $audience);
            self::assertSame(IdentityVerificationFailure::Unavailable, $verifier->verify($token, hash('sha256', AppleTokenFixture::NONCE)));
        }
        $unavailable = new class implements AppleSigningKeySource {
            public function find(string $kid): IdentityVerificationFailure { return IdentityVerificationFailure::Unavailable; }
        };
        $verifier = new AppleIdentityVerifier($unavailable, $this->clock, AppleTokenFixture::AUDIENCE);
        self::assertSame(IdentityVerificationFailure::Unavailable, $verifier->verify($token, hash('sha256', AppleTokenFixture::NONCE)));
    }

    private function verify(string $token): VerifiedAppleIdentity|IdentityVerificationFailure
    {
        return $this->verifier->verify($token, hash('sha256', AppleTokenFixture::NONCE));
    }

    private function keys(): AppleSigningKeySource
    {
        return new class(self::$fixture->key) implements AppleSigningKeySource {
            public function __construct(private Key $key) {}
            public function find(string $kid): Key { return $this->key; }
        };
    }
}
