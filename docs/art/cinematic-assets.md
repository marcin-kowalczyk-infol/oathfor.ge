# Cinematic art style

Status: demo-only second art style, 2026-09-29. Every export below is a candidate. Owner acceptance is pending for each file. Production has no way to show this style.

**Owner decisions, 2026-09-29:** the cinematic direction is C4 (`forge-cinematic-v04`) with the new Żaromir. A demo-only Settings row switches between the current and the cinematic style. The target is all 101 raster files (99 since two unused sheets were removed on 2026-09-30). A file without a cinematic version shows its current v01 file. The room floor gets a less polished revision from the separate art session. C4 was wired first without cuts. Since 2026-09-30 the revised floor (`room-cinematic-v02`) and cuts from it replace it.

## Runtime registry

Every image `require` of the app sits in `apps/mobile/src/art/`. `current.ts` lists the v01 set. `cinematic.ts` lists only the cinematic files. `registry.ts` merges them, so a missing cinematic file falls back to its current one. A test fails if any other source file requires an image.

The merge follows local rules:

- The room is one unit: its image, its measured flames and its cut layers (seals front, door leaf, seal drums, book page). A room without its own cuts draws none. The v03 cuts are never drawn over another room.
- Żaromir's sprite sheets are one unit, since they share one cell layout. Sprite metadata (columns, rows, cell aspect, anchor, blend) belongs to each style's sheet.
- Companion pictures carry their own frames for the bubble avatar, the Tutorial tile and the 180 × 270 panel. A fallback picture keeps its v01 frames.

The style reaches the app like the network adapter: `demo/runtime.ts` supplies `artStyle`, `AuthScreen` reads it once and provides the art to every screen, and `HomeRoutes` passes the choice to Settings. Without the adapter the app draws the current style and Settings has no row. `ArtProvider` imports `cinematic.ts`, so a production export bundles the cinematic files too (about 33 MB, measured 2026-09-30). **Owner decision, 2026-09-30:** this stays while the app is demo-only. The owner chooses one style before a production release. **Owner decision, 2026-09-30:** the demo starts in the cinematic style, so onboarding shows it too. See the [demo README](../../apps/mobile/demo/README.md#art-style).

Constraints for new cinematic files, so they drop into the registry without code changes:

- Character sheets keep the current cell layout: 288 × 320 cells, soles at 312, walks and idle 4 × 2, place poses, talk and turn 2 × 2. `HeroSprite` plays fixed frame lists, see [Forge motion assets](forge-motion-assets.md).
- The rule icon sheet keeps its cell order (`apps/mobile/src/oaths/oathArt.ts`).
- A cinematic room keeps the 887 × 1774 composition. Walk paths, hotspots, glows and the seals depth line are shared room geometry. Only cut boxes and flame positions belong to each room.

## Exports

Export scripts in ignored `graphics/cinematic-restyle-2026-09-29/` (Python 3, Pillow 12.2.0, NumPy 2.4.4). `export-cinematic-v01.py` exports the companion figures: alpha 250 to 254 becomes 255, so the body is fully opaque. The candidates had a maximum alpha of 254, so the whole figure was 1 to 2 percent see-through. Edge alpha 1 to 249 is unchanged. `cut-room-cinematic-v02.py` copies the room byte for byte and cuts its layers.

| App path | Dimensions / alpha | Bytes | SHA-256 | Source | Source SHA-256 |
| --- | --- | --- | --- | --- | --- |
| `apps/mobile/assets/companion/zharomir-wanderer-cinematic-v01.png` | 1024 × 1536 RGBA, 586013 opaque pixels | 1981154 | `9751e255e53e2469537e3414d9f6a2d30a1947fef1f3f980567aed023ad0c374` | `graphics/cinematic-restyle-2026-09-29/companion/zharomir-wanderer-cinematic-v01.png` | `0e789b6dfb02d4df03f5657c864410ba80742979995836d8800c83ef7e77d6b1` |
| `apps/mobile/assets/companion/zharomir-ember-sash-cinematic-v01.png` | 1024 × 1536 RGBA, 591341 opaque pixels | 1957310 | `b8f2f2118df008baac12644e96f36fe4e314ec10e87502186157201cd4003811` | `graphics/cinematic-restyle-2026-09-29/companion/zharomir-ember-sash-cinematic-v01.png` | `6b47b8445ce2fa25480a903ed3b8498210bb221a4d649bda2ba9d75a77fa235b` |
| `apps/mobile/assets/companion/zharomir-guardian-token-cinematic-v01.png` | 1024 × 1536 RGBA, 593091 opaque pixels | 2016490 | `f0d7777157c6831f807a4bc0268a3f9c7b3ed27f43787a04bad32217e09bbe82` | `graphics/cinematic-restyle-2026-09-29/companion/zharomir-guardian-token-cinematic-v01.png` | `4506c062e724dfd422f4b0e3425ca72e871ba86f43af3678fadfc02ca27a5d94` |
| `apps/mobile/assets/companion/zharomir-oath-fittings-cinematic-v01.png` | 1024 × 1536 RGBA, 591017 opaque pixels | 2011916 | `7d129d7ad5e153e6828e15859015cf682d3279c465e6e5b44f408d029bff5102` | `graphics/cinematic-restyle-2026-09-29/companion/zharomir-oath-fittings-cinematic-v01.png` | `ccc9c766d2a28bd5eacc6491a6dab7ada21e102f5c6050fd2d8da185b3bf9d4a` |
| `apps/mobile/assets/companion/zharomir-spark-mantle-cinematic-v01.png` | 1024 × 1536 RGBA, 582388 opaque pixels | 2056133 | `17d6401f90768ef228f153a8b636ac2ad3cfe8f4900699342801c684ea27b21f` | `graphics/cinematic-restyle-2026-09-29/companion/zharomir-spark-mantle-cinematic-v01.png` | `ba99a73f218208e359f3adc53a7cd999c22b075e4ebcf6874e87da3e7218a924` |
| `apps/mobile/assets/forge/room-cinematic-v02.png` | 887 × 1774 RGB, opaque | 1907308 | `28bcf20bb7923b90f5765569dd481a22ad05bc53934405487c6478b488d0f640` | `graphics/cinematic-restyle-2026-09-29/incoming/forge/room-cinematic-v02.png` | same |
| `apps/mobile/assets/forge/motion/room-seals-front-cinematic-v01.png` | 252 × 106 RGBA | 58816 | `0d88455391cc40a38441535f2e03850b9c1e529f5305f0c802ca570c8008dae4` | cut from `room-cinematic-v02` | |
| `apps/mobile/assets/forge/scene/room-door-leaf-cinematic-v01.png` | 93 × 393 RGBA | 52860 | `f3260a85bfa22f0d82d7951a0d0f06e235b308c0600cc692a311d526ba2e4d68` | cut from `room-cinematic-v02` | |
| `apps/mobile/assets/forge/scene/room-seal-star-cinematic-v02.png` | 84 × 84 RGBA | 16414 | `4e68659ee60b5a9baa300f79c1b91a45b898d2f8601a5457f53b1ce9603ee55b` | cut from `room-cinematic-v02` | |
| `apps/mobile/assets/forge/scene/room-seal-tree-cinematic-v02.png` | 80 × 79 RGBA | 14997 | `9184aefc79569252b85e79d179490da7162323f55daa529c4a24fb069fa257e4` | cut from `room-cinematic-v02` | |
| `apps/mobile/assets/forge/scene/room-seal-wolf-cinematic-v02.png` | 76 × 76 RGBA | 13392 | `12c1c15f78edf4a244efa0b89963e9ee925c416d86cbd8020078097e94d97e8b` | cut from `room-cinematic-v02` | |

| `apps/mobile/assets/forge/motion/zharomir-act-chronicle-cinematic-v02.png` | 576 × 640 RGBA | 186822 | `c8e63456e5b21c587aa9c2e9b81b7df5f8ab1478ba8939a452aa3d39510b3254` | `incoming/revision-03/forge/motion/zharomir-act-chronicle-cinematic-v02.png` | same |
| `apps/mobile/assets/forge/motion/zharomir-act-door-cinematic-v02.png` | 576 × 640 RGBA | 214627 | `24c99a68d83de2b91273e3da1654fae23fc9118809f033738535fdac1a32e3d5` | `incoming/revision-03/forge/motion/zharomir-act-door-cinematic-v02.png` | same |
| `apps/mobile/assets/forge/motion/zharomir-act-hearth-cinematic-v02.png` | 576 × 640 RGBA | 238569 | `0b2486c6408a0440dd49778691ea27b7922822bf4d687389816fb9ee3517df4a` | `incoming/revision-03/forge/motion/zharomir-act-hearth-cinematic-v02.png` | same |
| `apps/mobile/assets/forge/motion/zharomir-act-seals-cinematic-v02.png` | 576 × 640 RGBA | 190720 | `9b694c7daf10c23e3926f553f5c332eede9a49eef3ee87bfdb9348f7ddfc0c49` | `incoming/revision-03/forge/motion/zharomir-act-seals-cinematic-v02.png` | same |
| `apps/mobile/assets/forge/motion/zharomir-idle-cinematic-v02.png` | 1152 × 640 RGBA | 503061 | `60922f71ec9a7ba63d017321d464d803779a2fa4f340ccc35aaf9833fab86cff` | `incoming/revision-03/forge/motion/zharomir-idle-cinematic-v02.png` | same |
| `apps/mobile/assets/forge/motion/zharomir-talk-cinematic-v02.png` | 576 × 640 RGBA | 246428 | `543fd3b1e5156195cfbbb60bcaea83c8822a7732676c7f183419ce696c7af9f2` | `incoming/revision-03/forge/motion/zharomir-talk-cinematic-v02.png` | same |
| `apps/mobile/assets/forge/motion/zharomir-turn-cinematic-v02.png` | 576 × 640 RGBA | 313842 | `02acdb739eead58e8493047af1c223ec68973a4a597bdc225f11be850ad0089d` | `incoming/revision-03/forge/motion/zharomir-turn-cinematic-v02.png` | same |
| `apps/mobile/assets/forge/motion/zharomir-walk-back-cinematic-v02.png` | 1152 × 640 RGBA | 310910 | `c37220e4c47c5bf5652dca0158361a16597a7c345e5bd2b1ae903b4f13b8f581` | `incoming/revision-03/forge/motion/zharomir-walk-back-cinematic-v02.png` | same |
| `apps/mobile/assets/forge/motion/zharomir-walk-back-left-cinematic-v02.png` | 1152 × 640 RGBA | 287521 | `5d5df4fbbfbe24206769c9973e42cd4021cd45767da96fa289782f024773a40c` | `incoming/revision-03/forge/motion/zharomir-walk-back-left-cinematic-v02.png` | same |
| `apps/mobile/assets/forge/motion/zharomir-walk-back-right-cinematic-v02.png` | 1152 × 640 RGBA | 289589 | `bdc1f931caf943b072e6fe30dfbf3137448477b6ac428761dbdac88a9c7b91b9` | `incoming/revision-03/forge/motion/zharomir-walk-back-right-cinematic-v02.png` | same |
| `apps/mobile/assets/forge/motion/zharomir-walk-front-cinematic-v02.png` | 1152 × 640 RGBA | 321612 | `2fc613e1c08fe4cf8f572670a0a18439a8afde60b1cf58e013bf702734545ddd` | `incoming/revision-03/forge/motion/zharomir-walk-front-cinematic-v02.png` | same |
| `apps/mobile/assets/forge/motion/zharomir-walk-front-left-cinematic-v02.png` | 1152 × 640 RGBA | 365151 | `8082fce301213fa799ee44329d4313ef5690384f8905e525cb56072cfc602632` | `incoming/revision-03/forge/motion/zharomir-walk-front-left-cinematic-v02.png` | same |
| `apps/mobile/assets/forge/motion/zharomir-walk-front-right-cinematic-v02.png` | 1152 × 640 RGBA | 337082 | `efea8381f33fc8e1ad7ed93199afdbb2c31b3f661c39a0eb1ca9b6f2d0f05755` | `incoming/revision-03/forge/motion/zharomir-walk-front-right-cinematic-v02.png` | same |
| `apps/mobile/assets/forge/motion/zharomir-walk-left-cinematic-v02.png` | 1152 × 640 RGBA | 260710 | `6b249baac2853ec5e0c1d7b1302b3611dd23f0483e7f474cf2484f32021f1d5f` | `incoming/revision-03/forge/motion/zharomir-walk-left-cinematic-v02.png` | same |
| `apps/mobile/assets/forge/motion/zharomir-walk-right-cinematic-v02.png` | 1152 × 640 RGBA | 244518 | `5a584e93b17b32b567ab33e3f58f4a8586c3afcfe2adbe7ef6b4509d7d7719db` | `incoming/revision-03/forge/motion/zharomir-walk-right-cinematic-v02.png` | same |
| `apps/mobile/assets/forge/scene/zharomir-bust-cinematic-v01.png` | 399 × 384 RGBA | 196159 | `8e14d7b1ef1e288a8d3fe012a2b2a649af1ae5e3db3cb8cef306e3cdc889290b` | reframed from `incoming/revision-03/forge/scene/zharomir-bust-cinematic-v01.png` |  |
| `apps/mobile/assets/forge/scene/fx-book-page-turn-cinematic-v03.png` | 1248 × 454 RGBA | 337697 | `eb1ac073934da5525a35bc11ec9b1fee079646cef262345d0f8f7acc6b2aac4e` | `incoming/revision-03/forge/scene/fx-book-page-turn-cinematic-v03.png` | same |

Provenance: built-in `image_gen`, 2026-09-29 (companion) and 2026-09-30 (room v02, revision 03). Revision 03 sheets are assembled from one generated silhouette with Python (`incoming/revision-03/build-characters.py`, `build-book.py`), so all 15 Żaromir sheets share one figure. Model and seed were not exposed. Prompts sit beside each source as `.prompt.txt`. Review notes: `graphics/cinematic-restyle-2026-09-29/review.md`, `technical-review.json` and `app-fit-2026-09-29.md`. The unselected `zharomir-wanderer-cutout-attempt-v02.png` is not exported. The v01 files stay unchanged.

### Remaining batch, 2026-09-30

Source: `graphics/cinematic-restyle-2026-09-29/incoming/remaining-v01/`, built with built-in `image_gen` and the Python exporters in that folder (report in its `README.md`, checksums in its `manifest.json`). Files are copied byte for byte into `apps/mobile/assets/` under the same relative path. The Settings tile is cut from the cinematic hearth close-up with the v01 box by `crop-settings-tools-cinematic-v01.py`.

| Path under `apps/mobile/assets/` | Dimensions / mode | Bytes | SHA-256 |
| --- | --- | --- | --- |
| `forge/activity-objects-cinematic-v01.png` | 2172 × 724 RGBA | 1574992 | `48e70dd68aceae5f6ee3421a911df42e291a3940aeaa3481fef5274ee0568a64` |
| `forge/ember-haze-cinematic-v01.png` | 1254 × 1254 RGBA | 427154 | `edef3d71a8a451479c6d9f36445d75757bb8508552447e79767aaf27b2f08e89` |
| `forge/oath-state-seals-cinematic-v01.png` | 576 × 576 RGBA | 511614 | `089e18479e8c69867a6c093f75267d51dfc5f26bd9d02ac5a259d77c49c1de87` |
| `forge/scene/panel-fill-cinematic-v01.png` | 1020 × 332 RGB | 299398 | `f317a91271053a0222d09675eb92fe5392725dff3b15698d619ac0ac42a366ae` |
| `forge/scene/panel-plate-cinematic-v01.png` | 612 × 128 RGBA | 163943 | `b7998e50d581a9b30bfd6925e3394ef2462a813e9523cfa625a1716f1c6554cd` |
| `forge/scene/panel-rune-alpha-cinematic-v01.png` | 384 × 192 RGBA | 29778 | `017e07ea1085e0951241202ca3ccf92d99cc655077a24fd4cd9d15f62574fe76` |
| `forge/scene/talk-chronicle-cinematic-v01.png` | 120 × 120 RGBA | 23043 | `23e61e7c4aad036e8f9a865b2bf9fc1cc1263f9f0ad50a2b59ef876fa8106e46` |
| `forge/scene/talk-seal-cinematic-v01.png` | 120 × 120 RGBA | 24404 | `4e3ee82775289044933b46da5b352d44353acc828115effd6825af370d726cb9` |
| `forge/station-chronicle-cinematic-v01.jpg` | 1024 × 1536 RGB | 313167 | `50497b553a461264f6dc6dd38efd36dcc927ef09a03c4808e48e6357b40461f8` |
| `forge/station-hearth-cinematic-v01.jpg` | 1024 × 1536 RGB | 331334 | `8d521fc4373cec07993dec4cd5860c7def63b2a9d1fcf3b372695bc2effb7d6b` |
| `forge/station-seals-cinematic-v01.jpg` | 1024 × 1536 RGB | 386529 | `cdb5a44145763dea01be9fd21452797e0265cd272a6c2f94cc1cdc144186248e` |
| `oaths/hourglass-cinematic-v01.png` | 640 × 320 RGBA | 74703 | `0718796a57c708d85dcd30127463b914316633ba349f9cf27f2e945d2f7acc32` |
| `oaths/hourglass-still-cinematic-v01.png` | 160 × 160 RGBA | 31782 | `32c96be1c1de3f8d69eee0969ba822efd5c253820cd83e7f5e7ab2f27348355c` |
| `oaths/rule-icons-cinematic-v01.png` | 800 × 320 RGBA | 409691 | `be8c29fcd97013713e525140227636c0ed7c6218d7ca4eeaf616915944d861e0` |
| `oaths/seal-sparks-cinematic-v01.png` | 1440 × 720 RGBA | 822379 | `3c849d1fdc6715abdaf3c3c9b91f22951b82e9ecb0d2806078f8fc031dd77cf2` |
| `oaths/seal-stamp-cinematic-v01.png` | 1440 × 720 RGBA | 404122 | `15917d76da9ccae674ebc5e05cdd2bb5a3e72e6ee0ffc1d04566430764256a1d` |
| `player/motion/player-02-thin-act-chronicle-cinematic-v01.png` | 576 × 640 RGBA | 169322 | `2a77502220bf296ace8e90c37c373daad0a6e9fad855cfe9418bc95966ce7618` |
| `player/motion/player-02-thin-act-door-cinematic-v01.png` | 576 × 640 RGBA | 207830 | `7f50d77fe4b03c3c76737873f9fe0bd42d7f3633486fef08d729ba267282583f` |
| `player/motion/player-02-thin-act-hearth-cinematic-v01.png` | 576 × 640 RGBA | 229118 | `f47843c1dca888656a01a702918da1d423926a8b25a870248bb14569fd2aebfe` |
| `player/motion/player-02-thin-act-seals-cinematic-v01.png` | 576 × 640 RGBA | 178577 | `83ed78481639d03f9d88d9c640d98a62eb7b8d3245ce2e0cc9fcbe6a3b77e286` |
| `player/motion/player-02-thin-idle-cinematic-v01.png` | 1152 × 640 RGBA | 303215 | `a62ed51f5fadb0dd43743b377e99d964e98c10ba97729e4daf84c429a95e2488` |
| `player/motion/player-02-thin-walk-back-cinematic-v01.png` | 1152 × 640 RGBA | 234716 | `6c406816494586ab82a4bd59b47618f0fb99f20bf0df1c748388eb738c0a6699` |
| `player/motion/player-02-thin-walk-back-left-cinematic-v01.png` | 1152 × 640 RGBA | 268857 | `a7bf94ed6a06f11f373441f7b44fa00fab3330a9d364cc109ad8700c3e11aa43` |
| `player/motion/player-02-thin-walk-back-right-cinematic-v01.png` | 1152 × 640 RGBA | 255212 | `b756bcb457a9cb7cec529c15b48fa004f53388ad574444cff059965044e9b9c1` |
| `player/motion/player-02-thin-walk-front-cinematic-v01.png` | 1152 × 640 RGBA | 233935 | `97c50e9d6bae2972cb066944b1d27291756cf95ea98438af90d36f90b41ba5e9` |
| `player/motion/player-02-thin-walk-front-left-cinematic-v01.png` | 1152 × 640 RGBA | 254081 | `293386e3cd41eddff24f90e39acc416a6d79f3a511c9e876e03fa1e2e9781575` |
| `player/motion/player-02-thin-walk-front-right-cinematic-v01.png` | 1152 × 640 RGBA | 250460 | `89641393ac7c643fd0dbf6f5058d8359f6a150b41fa21b9ad584b109f0466938` |
| `player/motion/player-02-thin-walk-left-cinematic-v01.png` | 1152 × 640 RGBA | 269291 | `0097a85caabf580ecd6019cfa633b1f40493bb410fd91a1cdf1c12f6e0f70595` |
| `player/motion/player-02-thin-walk-right-cinematic-v01.png` | 1152 × 640 RGBA | 297183 | `5bf482ba025ec684fa4eb21f5d90cc0a20fae959823afc6de04eee2745006cba` |
| `player/starter-01-heavy-figure-cinematic-v01.png` | 440 × 984 RGBA | 615379 | `5873365441cf4dd8f42b2b180dc4e99efc6f3a6326a9f9d2f5a6b4678bde9d17` |
| `player/starter-01-heavy-portrait-cinematic-v01.png` | 256 × 256 RGBA | 85428 | `bd64403aa1ebfe6b51017cc32ab93e4fb5fde2e13ec5d2bb92a1d1989beca016` |
| `player/starter-01-thin-figure-cinematic-v01.png` | 440 × 984 RGBA | 442873 | `ff2d98a27d24b6c57af1da161db70ce8e205043937a98ae5806654f48e4c686f` |
| `player/starter-01-thin-portrait-cinematic-v01.png` | 256 × 256 RGBA | 78519 | `18fafe00526baa0f2195368eacca1ad0d1c4d58d5ae16ceddc648ef343d4383b` |
| `player/starter-02-heavy-figure-cinematic-v01.png` | 440 × 984 RGBA | 562708 | `db6c433b052188b798e57f1b9325d18e8229b065ecb938a0802ed64a6da42882` |
| `player/starter-02-heavy-portrait-cinematic-v01.png` | 256 × 256 RGBA | 71486 | `2e1d0588e2557f9b98edb763f7d6589e8becee82ced130ecc72cd1b7bfa21825` |
| `player/starter-02-thin-figure-cinematic-v01.png` | 440 × 984 RGBA | 392771 | `bc9460cfd86d1e0f100c6773c76e7457619e8341d894bb64d788f58248fe35d1` |
| `player/starter-02-thin-portrait-cinematic-v01.png` | 256 × 256 RGBA | 68664 | `b5a3834f7c0aa72e7d78b45e8b73fda252c7bb3a6ef3269d702ed313802f103e` |
| `player/starter-03-heavy-figure-cinematic-v01.png` | 440 × 984 RGBA | 655035 | `e10c6ad038f8e6c5943c582fdcb758fbf02b9cdc87ea98dda5c559ed531e2908` |
| `player/starter-03-heavy-portrait-cinematic-v01.png` | 256 × 256 RGBA | 84914 | `ed1c98d6e5e67235e614e644d11e79e633d7dff115923ce302bf831e28d43c3b` |
| `player/starter-03-thin-figure-cinematic-v01.png` | 440 × 984 RGBA | 453808 | `896cb52356a397ddcce5096d2cc083a3b9d714b3441cf9f7c574211dee5f7087` |
| `player/starter-03-thin-portrait-cinematic-v01.png` | 256 × 256 RGBA | 80521 | `7456703529aee996fd0c5dba9fd7b121010ee7a47fa0077c3c2ee8899f327641` |
| `player/starter-04-heavy-figure-cinematic-v01.png` | 440 × 984 RGBA | 563259 | `6ac36af134af904c14094225b0aa07f9e990cd10a0c5f7782e537f50333a0a77` |
| `player/starter-04-heavy-portrait-cinematic-v01.png` | 256 × 256 RGBA | 83905 | `6d2bb02abb33484c012bd72f7d6f62823dd4391072561f53887201e009437594` |
| `player/starter-04-thin-figure-cinematic-v01.png` | 440 × 984 RGBA | 412345 | `d26a77ff5b16e63c2c5881adfd2e41b8d9b5e62aa14dc7195012a81634f67e2b` |
| `player/starter-04-thin-portrait-cinematic-v01.png` | 256 × 256 RGBA | 83247 | `1f69dce1f9b07f66059699db6469fde96749016f7e50363596b617d9fe86abda` |
| `player/starter-05-heavy-figure-cinematic-v01.png` | 440 × 984 RGBA | 539599 | `6ed49c690c39b4741f90966c9b03dbfe8a531319df0584e95fa827ef76e03e7a` |
| `player/starter-05-heavy-portrait-cinematic-v01.png` | 256 × 256 RGBA | 77517 | `50a6756d6d3a0573a9d1cc3a7a60ea8deab2fc5e00705f3508c901e06f29c6fe` |
| `player/starter-05-thin-figure-cinematic-v01.png` | 440 × 984 RGBA | 376341 | `d317e4e47945499ee32a90a299f9178cd3aaa50df449250cf86815ac7fd4855b` |
| `player/starter-05-thin-portrait-cinematic-v01.png` | 256 × 256 RGBA | 69161 | `fe8869631daf3f834284890b96d93f3c075d6aac37d3874582b49f7bdd0f1ae2` |
| `player/starter-06-heavy-figure-cinematic-v01.png` | 440 × 984 RGBA | 586811 | `16269f363d6caff59bcabe95ba3900ba1f40121c011fd01b637e58ccf798925b` |
| `player/starter-06-heavy-portrait-cinematic-v01.png` | 256 × 256 RGBA | 82550 | `85775c859bfd315bab42f411a0ff1ef4cba9c8b717362a279ca93d5b6cb873b2` |
| `player/starter-06-thin-figure-cinematic-v01.png` | 440 × 984 RGBA | 452563 | `9f0759019ef6d8a4649e7c5766d67e5d3525ef13c1c96663809396f3b3c5b2e0` |
| `player/starter-06-thin-portrait-cinematic-v01.png` | 256 × 256 RGBA | 78841 | `c46a6fb746f7c053b46d28d3f13defac63c6276ff85230ff25a5884cc4c0e650` |
| `menu/settings-tools-cinematic-v01.jpg` | 480 × 600 RGB | 56026 | `a70a89016ea01ce26e606dd4ca1260bccf9886485e02890132165b9cf03ada01` |

The first dialogue frame corner and edge tiles were rejected: opaque over all 80 px, the bronze line at 72 px instead of 44 to 49 px and no inner shadow, so the line ran into the panel text and the corners did not meet the edges on device. Their replacement (`incoming/panel-frame-v02/`) keeps the v01 row profile: empty rows 0 to 10, oak band 12 to 43, bronze line 44 to 49, dark gap 50 to 51, inner shadow 52 to 74, and joins without a seam. Its shadow falls off linearly, a little stronger than v01.

| Path under `apps/mobile/assets/` | Dimensions / mode | Bytes | SHA-256 |
| --- | --- | --- | --- |
| `forge/scene/panel-corner-cinematic-v02.png` | 96 × 96 RGBA | 13177 | `b276c86e7da60ab3c33fba20ae577881dc36e71eb7d6a9a6058c37d09717601f` |
| `forge/scene/panel-edge-h-cinematic-v02.png` | 142 × 80 RGBA | 5768 | `62291d9c7076e8229a1bee09754d380b6c945c27f9dca38f9486d015dc856b80` |
| `forge/scene/panel-edge-v-cinematic-v02.png` | 80 × 127 RGBA | 10011 | `7fe4ea3096ba8f4b1bd0725d75c15af5d789167fdfe2e0b3b948a093fad25138` |

The art session kept ten light sheets as they are (`optional-fx-review.md`). **Owner decision, 2026-09-30:** the seal ring (`fx-seal-glow-v01`) and the chronicle page (`fx-chronicle-page-v01` with its cinematic export, SHA-256 `6e0746297b0cffe1051119120568cf5c5fdd7049fba79aa39e624b989f4a35e5`) are removed from the app. Nothing drew them since commit 28ef796. The cinematic page master stays in `incoming/remaining-v01/`.

The cinematic hearth close-up centres its fire bed at x 0.526 with an opening of 0.22 of the width, so the looping flame uses its own anchor (`ArtSet.stationFire`: x 0.526, y 0.345, width 0.16) instead of the v01 values (0.5, 0.345, 0.24).

## Framing

The cinematic companion canvas keeps 1024 × 1536 but is transparent, and the figure is larger in it. Measured with alpha above 64: the v01 figure spans x 190 to 801 and y 47 to 1417 (1370 pixels), the cinematic wanderer x 186 to 851 and y 22 to 1497 (1476 pixels). Spark Mantle is shorter, 1445 pixels, so it sits about 2 percent smaller in the same frame.

| Frame | Current | Cinematic | Rule |
| --- | --- | --- | --- |
| Bubble avatar, 44 pt | 180.224 × 270.336 at −73.92, −3.52, backdrop `#44372c` | 138.63 × 207.95 at −55.98, 1.35, backdrop `#222222` | The head is about 1.3 times larger, so the source window grows from 250 to 325 pixels, centred on the head |
| Tutorial tile | 140 × 210, top −6, inset 18 | 129.6 × 194.4, top −2.4, left 20.1, right 26.3 | Same figure height and head line, same figure centre |
| Panel, 180 × 270 | 180 × 270 at 0, 0 | 166.96 × 250.44 at 2.6, 4.67 | Same figure height, head line and centre |

The v01 avatar showed the picture's own #222 backdrop around the head. The transparent picture gets the same colour behind it. The Tutorial tile already uses #222.

## Room

`room-cinematic-v02` is C4 with a less polished floor from the art session (2026-09-30). A phase correlation of edge maps in 96 pixel tiles places all 149 textured tiles within 1 pixel of C4. C4 itself matches `room-prototype-v03` in size and composition: a 50/50 blend shows no double outlines. The walk layout, hotspots, glows and light effects are shared.

The v03 cuts do not fit this room. Measured with `measure-overlays.py`, they sit within 1 pixel of C4 but differ in material (luminance difference 17 to 19 against 1 to 7 on v03), and their masks miss the larger C4 drums and the other door arch. `cut-room-cinematic-v02.py` therefore cuts every layer from v02 itself, with shapes measured on a 4x coordinate grid and feathered by about 1 pixel:

| Cut | Box on v02 (x, y, w, h) | Shape |
| --- | --- | --- |
| Star drum | 69, 877, 84, 84 | Face disk, centre 111.2, 919.2, radius 39.2 (face ellipse 39.2 × 41.8, barrel side 6 px in the seals front) |
| Tree drum | 157, 874, 80, 79 | Face disk, centre 197.2, 913.5, radius 37.2 (face ellipse 37.2 × 41.0, barrel side 7 px and top knob in the seals front) |
| Wolf drum | 239, 870, 76, 76 | Face disk, centre 277.0, 908.0, radius 35.0 (face ellipse 35.0 × 40.0, barrel side 7.5 px and top knob in the seals front) |
| Seals front | 63, 858, 252, 106 | Union of the three drums |
| Door leaf | 33, 477, 93, 393 | Polygon with the rounded upper left, hinge at x 35.5, the stone block at the lower left excluded |

The drums turn around their face centres. Native check on iPhone 18 Pro (2026-09-30): the first turning layers held the barrel side and the knob, so a dark crescent and the knob circled each face. The turning layers (v02) now hold only a disk of the smaller face radius. The barrel side, the knob and the thin rim beyond the disk stay painted in the room. **Owner decision, 2026-09-30:** the face disk drums are accepted. The book page sheet is built on the room's own book pixels and placed per room (`RoomArt.bookPageTurn` holds its anchor and width).

Painted flames were measured with `measure-candles.py`. C4's chandelier holds wax candles, so its seven flames start 9 to 21 pixels higher than on v03. v02 keeps every flame of C4 within 1 pixel. The cinematic room lists its own flame positions. The other 13 flames match v03 within 3 pixels and keep the v03 values.

## Missing cinematic files

The app holds 99 raster files since two unused sheets were removed on 2026-09-30. 85 of them have a wired cinematic version. Of the other 14:

- 5 are not drawn by the app: `room-prototype-v01`, `hearth-v01`, `zharomir-walk-prototype-v01`, `panel-rune-v01`, `room-book-v01`.
- 9 light sheets are kept as they are by the art session's review: hearth loop and burst, door mist, candle, wisp, the three seal motifs and book signs.

`graphics/cinematic-restyle-2026-09-29/inventory.json` holds the per-file state. Its `owner_acceptance` fields belong to the owner.

## Open items

- Owner acceptance of all exports, the framing and the cut shapes.
- Continuity: the token motif of level 4 follows the old faceted diamond while levels 3 and 5 use an inset diamond (`review.md`).
- The new figures are illustrations, not animation-ready cutouts.
- Remote backup of masters remains pending under the [pipeline](pipeline.md) exception.
