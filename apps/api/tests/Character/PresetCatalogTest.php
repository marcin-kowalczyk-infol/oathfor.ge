<?php

declare(strict_types=1);
namespace App\Tests\Character;

use App\Character\PresetCatalog;
use PHPUnit\Framework\TestCase;

final class PresetCatalogTest extends TestCase
{
    public function testCatalogListsDummyPresetsInOrder(): void
    {
        $catalog = new PresetCatalog();
        self::assertSame(['dummy_braid', 'dummy_cropped', 'dummy_curly', 'dummy_tied'], $catalog->ids());
        self::assertTrue($catalog->contains('dummy_tied'));
        self::assertFalse($catalog->contains('dummy_unknown'));
        $json = json_decode((string) file_get_contents(dirname(__DIR__, 2).'/resources/character/presets_v1.json'), true, flags: JSON_THROW_ON_ERROR);
        self::assertSame('presets_v1', $json['version']);
        foreach ($json['presets'] as $preset) { self::assertTrue($preset['dummy']); }
    }
}
