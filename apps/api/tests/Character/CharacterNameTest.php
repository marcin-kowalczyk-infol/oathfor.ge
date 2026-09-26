<?php

declare(strict_types=1);
namespace App\Tests\Character;

use App\Character\CharacterName;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class CharacterNameTest extends TestCase
{
    /** @return iterable<string, array{string, string}> */
    public static function validNames(): iterable
    {
        yield 'plain' => ['Mira', 'Mira'];
        yield 'polish letter' => ['Żaneta', 'Żaneta'];
        yield 'hyphen' => ['Anne-Marie', 'Anne-Marie'];
        yield 'ascii apostrophe' => ["O'Brien", "O'Brien"];
        yield 'typographic apostrophe' => ['O’Brien', 'O’Brien'];
        yield 'space' => ['Jan Kowalski', 'Jan Kowalski'];
        yield 'outer spaces' => ['  Mira  ', 'Mira'];
        yield 'outer unicode whitespace' => ["\u{00A0}\u{3000}Mira\t\u{2029}", 'Mira'];
        yield 'next line control' => ["\u{0085}Mira", 'Mira'];
        yield 'nfd to nfc' => ["Zoe\u{0301}", "Zo\u{00E9}"];
        yield 'two letters' => ['Al', 'Al'];
        yield 'twenty letters' => [str_repeat('a', 20), str_repeat('a', 20)];
        yield 'mark after separator letter' => ["Ana-E\u{0301}va", "Ana-\u{00C9}va"];
    }

    #[DataProvider('validNames')]
    public function testValidNamesAreTrimmedAndNormalized(string $input, string $expected): void
    {
        self::assertSame($expected, CharacterName::normalize($input));
    }

    /** @return iterable<string, array{string}> */
    public static function invalidNames(): iterable
    {
        yield 'single letter' => ['A'];
        yield 'double space' => ['Anna  Maria'];
        yield 'trailing hyphen' => ['Anna-'];
        yield 'leading hyphen' => ['-Anna'];
        yield 'digits' => ['R2D2'];
        yield 'twenty one letters' => [str_repeat('a', 21)];
        yield 'emoji' => ["Mira\u{1F600}"];
        yield 'double hyphen' => ['Anna--Maria'];
        yield 'empty' => [''];
        yield 'only spaces' => ['   '];
        yield 'mixed separators' => ["Anna -Maria"];
        yield 'inner tab' => ["Anna\tMaria"];
        yield 'leading mark' => ["\u{0301}Anna"];
        yield 'other apostrophe' => ['O`Brien'];
        yield 'dot' => ['J. Doe'];
        yield 'byte order mark' => ["\u{FEFF}Mira"];
    }

    #[DataProvider('invalidNames')]
    public function testInvalidNamesAreRejected(string $input): void
    {
        self::assertNull(CharacterName::normalize($input));
    }
}
