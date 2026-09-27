# Main-menu assets

Local selection for MVP-18-T05, 2026-09-26. Artwork for the [main menu](../product/main-menu.md#artwork). All entries are provisional development art for owner review. None is final production art.

## New export

| ID | App path | Dimensions / alpha | Bytes | SHA-256 |
| --- | --- | --- | --- | --- |
| `settings-tools-v01` | `apps/mobile/assets/menu/settings-tools-v01.jpg` | 480 × 600 RGB JPEG, opaque | 69603 | `802017ec9fb3932f0edf28c6f3e5e96c00fca8be5ebca133aa0488c9b59cff55` |

Status: provisional. It is a crop of project-generated art, not a DUMMY placeholder and not a new generation.

Source: master `graphics/mvp-05/stations/station-hearth-bg-v02.png` (1024 × 1536, SHA-256 `de2e40292a9ce8c84fad8df5c33bb6422f66007de63780e81b63f68df7979ec0`). It is the master of the tracked `station-hearth-v01.jpg` in the [places manifest](forge-places-assets.md). That manifest holds its generation record, prompt file and terms note. They apply unchanged here.

Derivation: box (664, 340, 1024, 790) of the master, 360 × 450 pixels, resized with Lanczos to 480 × 600 (1.33×), JPEG quality 86, progressive. No retouching, grading or baked gradient. Pillow 12.2.0. The ignored script `graphics/mvp-18/export-settings-tools-v01.py` reproduces the file byte for byte and refuses to run if the master checksum changes. Local metadata: `graphics/mvp-18/settings-tools-v01.provenance.json`. Tile preview: `graphics/mvp-18/settings-tools-v01.tile-preview.png`.

Trace of the mockup image: `tools.jpg` in the accepted menu mockup is a 324 × 500 crop at (700, 300, 1024, 800) of the tracked `station-hearth-v01.jpg`, saved without scaling. A session transcript records the command. Pixel comparison gives correlation 0.990 against that crop. This export frames the same wall of tongs, anvil and tool barrel from the lossless master, with a wider margin and the darker stump below.

Usage: Settings half tile, about 166 × 176 pt, radius 20, cover fit, centre anchor. The lower 35 percent has mean luminance 31 of 255. The label still needs the runtime dark gradient shown in the mockup. At 3× the tile needs 498 × 528 pixels, so the source is shown at about 1.4 master pixels per device pixel. The hearth fire stays outside the crop, so the tile does not repeat the Forge tile.

## Existing exports reused

These need no new file. Runtime code crops them.

| Use | Export | Bytes | SHA-256 | Manifest |
| --- | --- | --- | --- | --- |
| Menu background and Forge tile | `apps/mobile/assets/forge/room-prototype-v03.png`, 887 × 1774 RGB | 2872061 | `a8994b16f6968caf15727f49f3ca5f6b62fe420f548fece17df5199dfd555ce3` | [Stations prototype](forge-stations-prototype.md#immersive-room-v03--2026-09-25) |
| Tutorial tile | `apps/mobile/assets/companion/zharomir-wanderer-v01.png`, 1024 × 1536 RGB | 1807840 | `f3a23268a4ecdc8f2d3a750c212c7811dd5dbdfdff5f6ce8d9e9c4619f712e36` | [Companion assets](companion-assets.md#selected-five-level-exports) |

The card figure uses the active character's preset figure, in the selected build, see the [player preset manifest](player-preset-assets.md).

## Open items

- Native inspection of the tile on iPhone SE 3 and iPhone 18 Pro, in Polish and English, at the largest text size.
- Owner review of the crop. Final Settings art follows the final room art.
- Remote backup of masters remains pending under the [pipeline](pipeline.md) exception.
