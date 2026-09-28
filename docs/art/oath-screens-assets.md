# Oath screens assets

Local selection, 2026-09-28 (MVP-21-T02). These are exports for the [Oath screens](../product/oath-screens.md): the rule card icons, the sealing stamp and sparks and the countdown hourglass. Owner visual acceptance is pending. This is development art for review, not final production art. Two rule icons are DUMMY placeholders, marked in the table.

## Provenance

The generated masters were made on 2026-09-28 with the built-in `image_gen` tool from the prompts in ignored `graphics/mvp-20/requests/chatgpt-prompts-2026-09-28-feedback.md`. Model version and seed were not exposed. Each master in `graphics/mvp-21/incoming/` has a `.prompt.txt` with the exact prompt, references and date. `graphics/mvp-20/incoming/feedback-review-2026-09-28.md` lists the candidates, the owner-authorized stabilization and known limits.

- `oath-rule-icons-v01` is a direct generation. Its references are the tracked `activity-objects-v01.png` and `oath-state-seals-v01.png`.
- `talk-icons-v01` is the MVP-20 talk icon sheet in ignored `graphics/mvp-20/incoming/`. Two of its cells stand in for the missing reward and consequence icons.
- `oath-seal-sparks-v01` is a direct generation on opaque black.
- `oath-seal-stamp-v04` is a deterministic Pillow composition authorized by the owner. It was built from the generated `oath-seal-stamp-v02` (an edit of v01) by ignored `graphics/mvp-21/tools/stabilize-feedback.py`. The parchment is one frame reused pixel for pixel. The stamp, wax and finished seal are cut layers from the same sheet.
- `countdown-hourglass-v05` is a scripted animation authorized by the owner. Ignored `graphics/mvp-21/tools/animate-hourglass-stream.py` painted a moving sand stream on the first cell of `countdown-hourglass-v04`, which the stabilization script built from the generated `countdown-hourglass-v02` (an edit of v01).
- `graphics/mvp-21/incoming/stabilization-checks.json` and `hourglass-v05-checks.json` record that all RGBA pixels outside the animated regions are identical in every frame.

Terms source checked 2026-09-26 for the same tool: [OpenAI Europe Terms of Use](https://openai.com/policies/eu-terms-of-use/), updated 2026-01-16. Output rights are assigned between the parties subject to law, and uniqueness is not promised. The account-specific contract was not inspected. No exclusivity is claimed. Remote backup of masters remains pending under the [pipeline](pipeline.md) exception.

## Derived exports

Ignored `graphics/mvp-21/export-oath-screens-v01.py` writes every file in `apps/mobile/assets/oaths/` from the masters, deterministically with Pillow 12.2.0 and numpy 2.4.4. It records sizes, cells, source boxes, scales, anchors and checksums in `graphics/mvp-21/exports-v01.json`. Two runs gave identical checksums. It never modifies a master.

Alpha below 8 is cleared and the generator's 250 to 254 alpha ceiling is lifted to 255, as in the MVP-20 exports. Fully transparent pixels carry black colour.

- **Rule icons.** The 1774 × 887 masters do not divide evenly, so each icon is cut by its measured alpha bounds. Each is scaled to 148 px on its longer side and centred in a 160 × 160 cell. Every icon keeps at least 6 px of empty margin, so no neighbour bleeds in. The sheet is 5 × 2 in the order of the index column below. The app reads a cell by its index, row-major.
- **Seal stamp.** Every 444 px master cell is scaled whole to 360 px. No frame is trimmed, so the scroll stays still. Frames 7 and 8 are identical in the master (the sealed scroll at rest).
- **Seal sparks.** Alpha is the brightest channel and the colour is un-premultiplied, as for `panel-rune-alpha-v01` in the [Forge scene assets](forge-scene-assets.md). The sheet is drawn with a normal blend, because a screen blend inside a panel drew a dark square on iOS in MVP-20. Cells were cut at the dark gaps near the nominal grid lines. The golden ring was fitted in each frame and moved to the cell centre, so the burst does not jump. One scale serves all frames (0.79464), slightly under the master cell scale so the widest burst fits with a 2 px margin.
- **Hourglass.** Every 444 px master cell is scaled whole to 160 px. `hourglass-still-v01.png` is frame 1 alone, for the list chip and Reduce Motion.

| Export | Master | Size / mode | Use | Cells | SHA-256 |
| --- | --- | --- | --- | --- | --- |
| `rule-icons-v01.png` | `oath-rule-icons-v01`, cells 1 to 8 | 800 × 320 RGBA | Rule cards and the full-rules scroll, indexes 0 to 7 | 5 × 2 of 160 × 160, icon fitted to 148 px | `49afa4c9be146bc93613e82e27d39daf3c6e4cdc317559e4f187daafd295796b` |
| `rule-icons-v01.png`, index 8 | `talk-icons-v01`, cell 8 | Same sheet | **DUMMY** reward icon, the empty laurel medallion | 160 × 160 | Same sheet |
| `rule-icons-v01.png`, index 9 | `talk-icons-v01`, cell 3 | Same sheet | **DUMMY** consequence icon, the ember brazier | 160 × 160 | Same sheet |
| `seal-stamp-v01.png` | `oath-seal-stamp-v04` | 1440 × 720 RGBA | Sealing, the stamp presses the wax and lifts | 4 × 2 of 360 × 360, anchor 0.5, 0.5 | `bb353c5b86e2052c21aa734cd31aaf6276dd7cb00f294944d9c018f677924ac1` |
| `seal-sparks-v01.png` | `oath-seal-sparks-v01` | 1440 × 720 RGBA | Spark burst over the seal, normal blend | 4 × 2 of 360 × 360, ring centre at anchor 0.5, 0.5 | `54b67ff3c028fac2aa788f580454c0f7a16f8a340aeab40cff6ac2637b35b708` |
| `hourglass-v01.png` | `countdown-hourglass-v05` | 640 × 320 RGBA | Countdown on the confirmation card, sand stream loop | 4 × 2 of 160 × 160, anchor 0.5, 0.5 | `bde0d3e6d0514cab1380725ab2f95e91f29144200c38d16ecaba03cc1d07ec83` |
| `hourglass-still-v01.png` | `countdown-hourglass-v05`, frame 1 | 160 × 160 RGBA | Countdown chip in the list, Reduce Motion | Single frame | `3b7ccdd42aa11796fe7ff4c9e7d52e4d55d31898641c927098c1d36631349b65` |

Rule icon indexes:

| Index | Id | Subject | Source |
| --- | --- | --- | --- |
| 0 | `start` | Sunrise over the forge | `oath-rule-icons-v01`, cell 1 |
| 1 | `deadline` | Hourglass | cell 2 |
| 2 | `cutoff` | Candle burnt low | cell 3 |
| 3 | `proof` | Framed runner | cell 4 |
| 4 | `review` | Scales | cell 5 |
| 5 | `fixed` | Anvil with a padlock | cell 6 |
| 6 | `pause` | Door with the moon | cell 7 |
| 7 | `fullRules` | Scroll with a wax seal | cell 8 |
| 8 | `reward` | **DUMMY** laurel medallion | `talk-icons-v01`, cell 8 |
| 9 | `consequence` | **DUMMY** ember brazier | `talk-icons-v01`, cell 3 |

Master SHA-256: `oath-rule-icons-v01.png` `a58dfedba7ddbab7b31428b4534db74408d33c3a354d8871edd141ed2a92c529`, `talk-icons-v01.png` `0a6ff9a726f5d3c01bbf170c9a57608ec9e3defa9844feae2337a465b9a49f83`, `oath-seal-stamp-v04.png` `48b3c62a5ef50dc8887c9258073fa2f6c4345cbd9e749aaaf5d80bbf6c46fd07`, `oath-seal-sparks-v01.png` `2510e4bce034c38b4cbed1a5262f9bfdef746098839642a67076c142cb0e2894`, `countdown-hourglass-v05.png` `d32ff9bdf464aea48fff43978199fbf459796d2535bbe8cd7ca8293f41eb9056`.

## Checks

- Stamp and hourglass frames are pixel identical outside the animated region of the master, mapped to the export with a 3 px resampling margin.
- Each sparks frame composited over `#2b1d13` is never darker in luminance, and no pixel is darker in all three channels. A single channel can drop by up to 24 levels under saturated orange sparks, as with the accepted panel rune. That is a hue shift toward the spark colour, not a dark square.
- Composites were inspected only as still images: a contact sheet over `#2b1d13` with the rule icons at 40 px and 120 px.

## Open review points

- The sunrise icon may be too detailed at 40 pt. The native check in MVP-21-T13 decides whether it needs a simpler version.
- Reward and consequence need new icons in the rule icon style. The request is ignored `graphics/mvp-21/requests/oath-icons-reward-consequence.prompt.txt`. Until then the cards use the two DUMMY icons above.
- The runner in the proof frame and the padlock on the anvil are small at 40 px. They read as a picture frame and an anvil, which may be enough with the card title.
- The brightest sparks frame reaches within 2 px of its cell. The sheet must be drawn at its full cell size, not clipped by a smaller container.
- The stamp, the sparks in motion and the hourglass loop were not checked on device.
