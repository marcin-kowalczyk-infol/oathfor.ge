# Player preset assets

Status: selected by the agent on 2026-09-27 from the owner-requested generation. Owner visual acceptance is pending. These six starters replace the four DUMMY presets of 2026-09-26. Each starter has a thin and a heavy build, per the [player character specification](../product/player-character.md#artwork).

## Source

The masters are the ignored files `graphics/mvp-17/incoming/starter-NN-{thin,heavy}-{figure,portrait}-v01.png`, NN 01 to 06. The request is `graphics/mvp-18/requests/chatgpt-prompts-2026-09-27.md`, section 1. Each master has an adjacent `.prompt.txt` with the exact prompt, references and date. `graphics/mvp-17/incoming/generation-2026-09-27.json` records dimensions, source checksums and alpha. Generation used the ChatGPT built-in image tool on 2026-09-27. Model version and seed were not exposed. Characters 07 and 08 were not generated, the request accepts six.

## Export method

Script `graphics/mvp-17/export-starters-v01.py`, Pillow, records in `graphics/mvp-17/exports-v01.json`.

1. Figure: the alpha box above 127 is scaled so every figure has the same height, hair top at y 24 and soles at y 968 of a 440 × 984 canvas, centered on the box. Thin and heavy builds of one person therefore share scale and sole line, and switching the build does not jump.
2. Portrait: Apple Vision face landmarks give the pupil midpoint and face height (`graphics/mvp-17/detect-eyes.swift`, results in `eyes-2026-09-27.txt`). The square crop makes the face 41 percent of the side with the eyes at 50 percent width and 44 percent height, as the DUMMY portraits did, then Lanczos to 256 × 256. Crops that extend past the master are padded with transparency. That area falls outside the circular mask.
3. Alpha of 250 and above snaps to 255, because the figure interiors sit at 254. The masters have clean edges without a dark halo.

Figures weigh 0.4 to 0.7 MB and portraits about 0.1 MB. All files are PNG with straight alpha. `apps/mobile/src/characters/presetArt.ts` maps a preset ID and build to these files. A preset or build the app cannot draw returns no art, and screens then show a neutral placeholder.

## Exports

The source box is the master alpha box for figures and the crop box for portraits, in master pixels (x0, y0, x1, y1).

| Preset and file | App path | Source box | Dimensions | SHA-256 |
| --- | --- | --- | --- | --- |
| `starter_01` thin figure | `apps/mobile/assets/player/starter-01-thin-figure-v01.png` | 322, 51, 729, 1475 | 440 × 984 | `683e63f946882fe8e1e3a971986d996d2ef9f963c8b6a81f59b2926cafdce0af` |
| `starter_01` thin portrait | `apps/mobile/assets/player/starter-01-thin-portrait-v01.png` | 126, -111, 1293, 1056 | 256 × 256 | `33e49b432832c58cd17ef585f8267476ae7e777bef689f3f7ffdaf7a46d40b7c` |
| `starter_01` heavy figure | `apps/mobile/assets/player/starter-01-heavy-figure-v01.png` | 249, 53, 803, 1489 | 440 × 984 | `62f2c0aa5fb382add6c141486d65310fdf1908b0677f6df03a49a107bf76d68d` |
| `starter_01` heavy portrait | `apps/mobile/assets/player/starter-01-heavy-portrait-v01.png` | 173, -88, 1240, 979 | 256 × 256 | `8ccd07748e4f92a3fd452ff5f095906bf3df192039c3f5355dcf059b350e1641` |
| `starter_02` thin figure | `apps/mobile/assets/player/starter-02-thin-figure-v01.png` | 325, 49, 723, 1447 | 440 × 984 | `20ac2f77823030b0c635ec77e05a39e7d7b45c16b9543a65528b0071586eab5b` |
| `starter_02` thin portrait | `apps/mobile/assets/player/starter-02-thin-portrait-v01.png` | 84, -84, 1256, 1087 | 256 × 256 | `8f5bc101fe8bcc1a0ca0006482894278cad9c35e376553d5a8b0fb05702a39b1` |
| `starter_02` heavy figure | `apps/mobile/assets/player/starter-02-heavy-figure-v01.png` | 242, 49, 829, 1474 | 440 × 984 | `3fd8e06449340490a4563fff9129b56ce196e48679d71be25fb8bcb4dc5ca0c1` |
| `starter_02` heavy portrait | `apps/mobile/assets/player/starter-02-heavy-portrait-v01.png` | 94, -70, 1271, 1106 | 256 × 256 | `9b2641e6a759c890ad7e8a0130f9ac3b9ebeea37b2872d39a2bcff34f9b03614` |
| `starter_03` thin figure | `apps/mobile/assets/player/starter-03-thin-figure-v01.png` | 320, 51, 729, 1446 | 440 × 984 | `9640880ed0bf22a569a8b94e32b924ee01b90051f02c0eb907f79143f576217a` |
| `starter_03` thin portrait | `apps/mobile/assets/player/starter-03-thin-portrait-v01.png` | 131, -95, 1274, 1048 | 256 × 256 | `7aeecd5dfccbbcd37f0f69d5226a18242bb4ad8e39005d7052b04b2585e15a65` |
| `starter_03` heavy figure | `apps/mobile/assets/player/starter-03-heavy-figure-v01.png` | 221, 57, 820, 1475 | 440 × 984 | `8d5edea50153bb2512e0ab4646ccee6c28d7a2f768544b19ed1382bd64fb7a4a` |
| `starter_03` heavy portrait | `apps/mobile/assets/player/starter-03-heavy-portrait-v01.png` | 67, -101, 1294, 1126 | 256 × 256 | `f254708880e073b7ad974cdf28c52942abc93a1b84ba05374060921dc6b31cbe` |
| `starter_04` thin figure | `apps/mobile/assets/player/starter-04-thin-figure-v01.png` | 328, 50, 733, 1478 | 440 × 984 | `de0380533908589f2a469ef1096424030bd2787b7b1a800dbdc6f810f4c4708c` |
| `starter_04` thin portrait | `apps/mobile/assets/player/starter-04-thin-portrait-v01.png` | 135, -83, 1289, 1070 | 256 × 256 | `d3346c88891dffdaf1a3b0c0c3a011687c6413bb56b68f37922f2835b9757f58` |
| `starter_04` heavy figure | `apps/mobile/assets/player/starter-04-heavy-figure-v01.png` | 233, 53, 819, 1486 | 440 × 984 | `99a138c57fdd66d4a91ea66be6fc9dc0f99ac7be6c23deaab1573aa900f2312b` |
| `starter_04` heavy portrait | `apps/mobile/assets/player/starter-04-heavy-portrait-v01.png` | 131, -105, 1313, 1077 | 256 × 256 | `e32c36b7cbdb0726379ef8797542b5fc4ec40f55f16aa141b65d29f87d093f8c` |
| `starter_05` thin figure | `apps/mobile/assets/player/starter-05-thin-figure-v01.png` | 341, 43, 732, 1477 | 440 × 984 | `9ac58234c49a4c1263bd778f601a0ed56711034b9ee5328007e790c53546d0dd` |
| `starter_05` thin portrait | `apps/mobile/assets/player/starter-05-thin-portrait-v01.png` | 121, -75, 1253, 1057 | 256 × 256 | `8a0c3f613fd9790c981cea41beda3a2e047b3603a25c0d474561d66260a6de10` |
| `starter_05` heavy figure | `apps/mobile/assets/player/starter-05-heavy-figure-v01.png` | 247, 42, 821, 1489 | 440 × 984 | `8d8cf267843912af03128402aea04ae1ab6e24222f4d86774cd723e9a372eb42` |
| `starter_05` heavy portrait | `apps/mobile/assets/player/starter-05-heavy-portrait-v01.png` | 68, -72, 1274, 1135 | 256 × 256 | `363fd09ac3e0353c461c4c752bf8cb02907ecee3858badb3cc228cf3cfeeb350` |
| `starter_06` thin figure | `apps/mobile/assets/player/starter-06-thin-figure-v01.png` | 299, 46, 720, 1446 | 440 × 984 | `a02c0d95936516de33924b3abbf7c33e0c499d9b54e5ea4857be8af51a2b7064` |
| `starter_06` thin portrait | `apps/mobile/assets/player/starter-06-thin-portrait-v01.png` | 81, -101, 1258, 1075 | 256 × 256 | `89e52fe93098c98c5de9150ba62c9894d78b9ae99529349fe42e9a84f2f91127` |
| `starter_06` heavy figure | `apps/mobile/assets/player/starter-06-heavy-figure-v01.png` | 215, 45, 830, 1460 | 440 × 984 | `cc9d9d9583bd471ec8244a03b9b1ea52fe46e1fed33fa544051cf44309e34234` |
| `starter_06` heavy portrait | `apps/mobile/assets/player/starter-06-heavy-portrait-v01.png` | 130, -85, 1283, 1068 | 256 × 256 | `451d4ca954c7ba5aa70544f8b2f40664b43b581752857c0a1a81ddedcc174631` |

## Known deviations

- Several requested rag-wrapped feet became bast shoes, and starter 06 has dark brown rather than black hair. Both are acceptable for stage 1.
- Starter 03 resembles starter 01 in complexion and face. Owner review may replace it.
- The DUMMY files and IDs are removed. Local test characters with DUMMY IDs show the placeholder, which is acceptable because no production data exists.
