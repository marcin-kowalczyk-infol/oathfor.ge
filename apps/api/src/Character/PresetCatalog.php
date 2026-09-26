<?php

declare(strict_types=1);
namespace App\Character;

final class PresetCatalog
{
    public const ID_PATTERN = '/\A[a-z0-9_]{1,64}\z/';
    /** @var list<string>|null */
    private ?array $ids = null;
    /** @return list<string> */
    public function ids(): array
    {
        if (null !== $this->ids) { return $this->ids; }
        $json = file_get_contents(__DIR__.'/../../resources/character/presets_v1.json');
        if (false === $json) { throw new \LogicException('Preset catalog unavailable.'); }
        $catalog = json_decode($json, true, flags: JSON_THROW_ON_ERROR);
        $ids = [];
        foreach (is_array($catalog) && is_array($catalog['presets'] ?? null) ? $catalog['presets'] : [] as $preset) {
            $id = is_array($preset) ? ($preset['id'] ?? null) : null;
            if (!is_string($id) || 1 !== preg_match(self::ID_PATTERN, $id) || in_array($id, $ids, true)) { throw new \LogicException('Preset catalog invalid.'); }
            $ids[] = $id;
        }
        if ([] === $ids) { throw new \LogicException('Preset catalog invalid.'); }
        return $this->ids = $ids;
    }
    public function contains(string $id): bool { return in_array($id, $this->ids(), true); }
}
