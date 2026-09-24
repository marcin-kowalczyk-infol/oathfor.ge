<?php

declare(strict_types=1);

namespace App\Tests\Identity;

use App\Identity\AppleJwksParser;
use App\Identity\AppleKeysUnavailable;
use App\Tests\Fixtures\AppleTokenFixture;
use PHPUnit\Framework\TestCase;

final class AppleJwksParserTest extends TestCase
{
    public function testRejectsUnusableOrUntrustedKeySets(): void
    {
        $fixture = new AppleTokenFixture();
        $parser = new AppleJwksParser();
        $invalid = [
            'missing keys' => [], 'empty keys' => ['keys' => []],
            'duplicate kid' => ['keys' => [$fixture->jwk, $fixture->jwk]],
            'weak RSA' => ['keys' => [(new AppleTokenFixture('DUMMY-weak', 1024))->jwk]],
        ];
        foreach (['kid' => '', 'kty' => 'EC', 'use' => 'enc', 'alg' => 'HS256', 'n' => '?', 'e' => 'AA'] as $field => $value) {
            $invalid['bad '.$field] = ['keys' => [array_replace($fixture->jwk, [$field => $value])]];
        }
        $ten = [];
        for ($index = 0; $index < 10; ++$index) {
            $ten[] = array_replace($fixture->jwk, ['kid' => 'DUMMY-'.$index]);
        }
        self::assertCount(10, $parser->parse(['keys' => $ten]));
        $invalid['eleven keys'] = ['keys' => [...$ten, array_replace($fixture->jwk, ['kid' => 'DUMMY-eleven'])]];
        foreach ($invalid as $name => $snapshot) {
            try {
                $parser->parse($snapshot);
                self::fail('Accepted '.$name);
            } catch (AppleKeysUnavailable) {
                self::addToAssertionCount(1);
            }
        }
    }
}
