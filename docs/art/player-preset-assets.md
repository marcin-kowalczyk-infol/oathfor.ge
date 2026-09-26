# Player preset assets

Status: DUMMY placeholders for MVP-17, 2026-09-26. Never shipped as final. The owner supplies 6 to 8 real presets, each as a full figure and a portrait, per the [player character specification](../product/player-character.md#artwork). Until then these four crops let the character flow run end to end.

## Source

All eight files are crops of the ignored exploration lineup `graphics/mvp-05/player/player-starters-lineup-v01.png` (1536 × 1024 RGBA). Its prompt file records ChatGPT image generation on 2026-09-26, model version and seed not exposed, and marks the lineup as exploration only. The owner approved these four figures as DUMMY presets on 2026-09-26. No new image was generated.

Crop method, Pillow 12.2.0:

1. Keep only the connected alpha region of each figure, which drops stray specks.
2. Snap alpha of 250 and above to 255. The source figures sit at alpha 251 to 253.
3. Figure: a 400 × 984 box centered on the figure column, source rows 16 to 1000, so all four share one baseline and scale.
4. Portrait: a 205 px square with the eye midpoint at 50% width and 43% height, resized to 256 × 256 with Lanczos. This keeps the face centered in a circular mask at 48 to 72 points.

The lineup's soft halo has near-black color. It blends into the charcoal app background and must not be shown on a light surface.

## Exports

| Preset ID | App path | Source box (x0, y0, x1, y1) | Dimensions | SHA-256 |
| --- | --- | --- | --- | --- |
| `dummy_braid` figure | `apps/mobile/assets/player/dummy-braid-figure-v01.png` | 8, 16, 408, 1000 | 400 × 984 | `a41eb8c128a1add3ca76a5b88149632c1fadd845165e15b5350d2941bac9cdfd` |
| `dummy_braid` portrait | `apps/mobile/assets/player/dummy-braid-portrait-v01.png` | 136, 37, 341, 242 | 256 × 256 | `94265145f1092299079bae10eb7f8417fd7843b8fed96698c015d62fd79dfcb8` |
| `dummy_cropped` figure | `apps/mobile/assets/player/dummy-cropped-figure-v01.png` | 389, 16, 789, 1000 | 400 × 984 | `74fd0c4dfbeed65a929e2d117793caf4a16cbcb2c0a781a167ae17e4aabd767f` |
| `dummy_cropped` portrait | `apps/mobile/assets/player/dummy-cropped-portrait-v01.png` | 508, 1, 713, 206 | 256 × 256 | `3f54687363c94e7586f662dcfe988877809b75b3cb291184ea4403f47f2b9801` |
| `dummy_curly` figure | `apps/mobile/assets/player/dummy-curly-figure-v01.png` | 762, 16, 1162, 1000 | 400 × 984 | `163749824d5f07c8bfeeb0eee6edd4616db575aed476372a08adedc60b8b88bc` |
| `dummy_curly` portrait | `apps/mobile/assets/player/dummy-curly-portrait-v01.png` | 864, 49, 1069, 254 | 256 × 256 | `ec31e86ab58bf76627378d46163e39d55fba1511ff4abb2f588a6ef9ac605a21` |
| `dummy_tied` figure | `apps/mobile/assets/player/dummy-tied-figure-v01.png` | 1128, 16, 1528, 1000 | 400 × 984 | `9c9d359f58b946b89c9de54b40b0fe9a02f06aa83f22c46749c659bcecc2faf7` |
| `dummy_tied` portrait | `apps/mobile/assets/player/dummy-tied-portrait-v01.png` | 1228, 11, 1433, 216 | 256 × 256 | `31f7d643b4589735f48c1f0495d56a7f5f59e80cd08eb9d54a06fc63c8432699` |

All files are PNG with straight alpha on a transparent background. Figures weigh about 0.6 MB each and portraits under 0.1 MB. `apps/mobile/src/characters/presetArt.ts` maps preset IDs to these files. A preset ID the app cannot draw returns no art, and screens then show a neutral placeholder.

## Replacement

1. Add the owner's presets to `apps/api/resources/character/presets_v1.json` with new stable IDs and remove the DUMMY entries.
2. Export figure and portrait files next to these, add them to `presetArt.ts` and to this manifest with checksums and provenance.
3. Delete the DUMMY files and entries. Existing local test characters with DUMMY IDs then show the placeholder, which is acceptable because no production data exists.
