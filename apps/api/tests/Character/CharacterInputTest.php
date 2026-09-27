<?php

declare(strict_types=1);
namespace App\Tests\Character;

use App\Character\{CharacterFailure, CharacterInput};
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class CharacterInputTest extends TestCase
{
    private const BASE = ['requestId' => '00000000-0000-4000-a000-000000000001', 'name' => ' Mira ', 'presetId' => 'starter_01', 'build' => 'thin', 'form' => 'feminine'];
    public function testBuildsAreFixed(): void
    {
        self::assertSame(['thin', 'heavy'], CharacterInput::BUILDS);
    }
    public function testValidInputKeepsBuild(): void
    {
        foreach (CharacterInput::BUILDS as $build) {
            $input = CharacterInput::parse(array_replace(self::BASE, ['build' => $build]));
            self::assertInstanceOf(CharacterInput::class, $input);
            self::assertSame([self::BASE['requestId'], 'Mira', 'starter_01', $build, 'feminine'], [$input->requestId, $input->name, $input->presetId, $input->build, $input->form]);
        }
    }
    /** @return iterable<string, array{array<string, mixed>}> */
    public static function invalidBuilds(): iterable
    {
        $missing = self::BASE; unset($missing['build']);
        yield 'missing' => [$missing];
        yield 'extra' => [self::BASE + ['builds' => 'thin']];
        foreach (['medium', 'Thin', 'HEAVY', ' thin', '', null, 1, true, ['thin']] as $i => $value) { yield 'value-'.$i => [array_replace(self::BASE, ['build' => $value])]; }
    }
    /** @param array<string, mixed> $body */
    #[DataProvider('invalidBuilds')]
    public function testMissingExtraOrUnknownBuildIsInvalidRequest(array $body): void
    {
        self::assertEquals(new CharacterFailure('invalid_request'), CharacterInput::parse($body));
    }
    public function testInvalidBuildIsRejectedBeforeNameRule(): void
    {
        self::assertEquals(new CharacterFailure('invalid_request'), CharacterInput::parse(array_replace(self::BASE, ['build' => 'medium', 'name' => 'A'])));
        self::assertEquals(new CharacterFailure('invalid_character_name'), CharacterInput::parse(array_replace(self::BASE, ['name' => 'A'])));
    }
}
