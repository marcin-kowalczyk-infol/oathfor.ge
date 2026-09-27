<?php

declare(strict_types=1);
namespace App\Tests\Character;

use App\Character\PresetCatalog;
use PHPUnit\Framework\TestCase;

final class PresetCatalogTest extends TestCase
{
    private const STARTERS = ['starter_01', 'starter_02', 'starter_03', 'starter_04', 'starter_05', 'starter_06'];
    public function testCatalogListsOwnerStartersInOrder(): void
    {
        $catalog = new PresetCatalog();
        self::assertSame(self::STARTERS, $catalog->ids());
        self::assertTrue($catalog->contains('starter_06'));
        self::assertFalse($catalog->contains('starter_07'));
        self::assertFalse($catalog->contains('dummy_braid'));
    }
    public function testCatalogFileIsVersionTwoWithoutDummyEntries(): void
    {
        $directory = dirname(__DIR__, 2).'/resources/character';
        self::assertFileDoesNotExist($directory.'/presets_v1.json');
        $json = json_decode((string) file_get_contents($directory.'/presets_v2.json'), true, flags: JSON_THROW_ON_ERROR);
        self::assertSame('presets_v2', $json['version']);
        self::assertSame(array_map(fn (string $id): array => ['id' => $id], self::STARTERS), $json['presets']);
    }
}
