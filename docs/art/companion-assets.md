# Żaromir — asset manifest

Status: initial T02 concept references selected for continued production after agent visual review, 2026-09-24. The owner accepted the starting brief and permits refinement during artwork creation; the owner subsequently chose “Zachowaj ten styl” after viewing these images on 2026-09-24. This accepts the visual direction for subsequent unlocks, not unseen exports. T03 now supplies five selected static app exports below; native acceptance and animation rigs remain absent.

## References and provenance

Masters and prompts remain under ignored `graphics/mvp-03/`; these paths are provenance, never runtime dependencies. Owner-authorized storage is local-only for now, with S3 backup deferred under the [pipeline](pipeline.md). No remote backup or restore has been verified.

| Reference ID | Local master | Dimensions / alpha | SHA-256 |
| --- | --- | --- | --- |
| `zharomir-reference-v01` | `graphics/mvp-03/zharomir-reference-v01.png` | 1536 × 1024; opaque RGB | `9e300cfda9bcb5fcbc148492ac4412e730647806669c110f0f612e6eb993c5c7` |
| `zharomir-four-stages-v01` | `graphics/mvp-03/zharomir-four-stages-v01.png` | 1536 × 1024; opaque RGB | 3789e86885f7e37def5182166cc64419d81047672b7991470acd355a49c7353a |

Both were generated on 2026-09-24 using built-in OpenAI `image_gen`. Exact model/version and seed were not exposed and are not inferred. Reference v01 used only the original brief; the four-stage sheet used reference v01 as its image input. Images were copied unchanged from generator output. Exact prompts, original output locations and input-reference IDs are in local `reference-v01.prompt.txt`, `four-stages-v01.prompt.txt` and `provenance.json`.

Terms reviewed before generation, 2026-09-24: [Europe Terms of Use](https://openai.com/policies/eu-terms-of-use/) (updated 2026-01-16), [Services Agreement](https://openai.com/policies/services-agreement/) (effective 2026-01-01), and [Service Terms](https://openai.com/policies/service-terms/). The general terms assign output as between the parties subject to applicable law, require appropriate input rights and output review, and allow non-unique outputs. The account contract was not inspected; this record does not establish exclusivity, statutory copyright protection or a rights-clearance guarantee. No external franchise imagery or third-party character reference was supplied. Local review notes are in `terms-review.md`.

## Selected visual constants

The same adult carved-wood head, broad brow, amber eyes, squared beard, human proportions and single left-cheek ember seam recur in both views and all four concepts. The right hand carries the lantern on the viewer's left. Never mirror these images. Maintain the restrained expression rather than making progression more threatening.

**Local visual refinement under the owner's iteration permission, 2026-09-24:** retain a relaxed right arm and lantern hanging near the knee, rather than the original hip-height/squat-lantern proposal. Retain the cloak's longer rear panel. These are explicit refinements, not claims that the first generation satisfied every prompt detail. Preserve this carry and silhouette across future exports.

Materials: matte dark wood, worn charcoal cloth, linen tunic, iron fittings and restrained amber light; later stages add bronze trim and fittings. Camera: nearly frontal three-quarter full figure, unchanged viewpoint across stages, with no lens/perspective distortion as a progression effect. Lighting: cool upper-left key/rim and contained amber lantern/cheek glow. Do not brighten the whole body or obscure the silhouette with mist.

The four concepts explore equipment/material richness only: plain traveler; bronze-edged cloak; reinforced fittings/lantern; layered mantle. They are continuity concepts, **not levels 1–4 or a new progression economy**. T03 must separately select five-level content under the [accepted thresholds](../product/first-loop.md#initial-levels-and-unlock-ownership).

## Size and composition inspection

Actual inspection: source images plus a local Safari fixture `graphics/mvp-03/size-review.html`, 2026-09-24. This is desktop CSS rendering, not iOS acceptance.

- Full figure: reference background rendered at 384 × 256 CSS px in a 160 × 256 clipped frame aligned to its left edge; the figure is about 240 px tall. Full boots and lantern remain visible. The silhouette and lantern carry identity; fine trim is not a dependable small-screen unlock signal.
- Portrait: 96 × 96 frame; reference rendered at 215.04 × 143.36, offset −126/−3 CSS px. An initial tighter crop clipped the beard; this wider crop was inspected and retained. Brow, eyes, cheek seam and beard are recognizable.
- Four-stage sheet: 460.8 × 307.2 CSS px, about 245 px figure height. Head/proportion continuity remains apparent; bronze edging is a subtle difference while later fittings and layered mantle visibly change the clothing. T03 needs more distinct small unlocks than tiny ornament alone.
- Surrounding surfaces inspected: page `#141719`, dark card `#242a2d`, light card `#ede7db`. These are concrete review surfaces, not an accepted UI token system. Opaque image rectangles remain visible; they cannot be described as transparent cutouts. Future alpha exports require separate edge inspection.
- Sample PL/EN deadline text sits below each art frame with its own layout space; no art overlaps rule text. These static examples do not establish functional-screen, enlarged-text or VoiceOver acceptance.

## Selected five-level exports

**Local content selection, 2026-09-24:** five cumulative opaque illustrations selected after source inspection, independent art review and desktop size review. Owner retained the visual style; these names and equipment choices are the production handoff within that direction, not a change to progression rules. Existing DUMMY IDs are replaced only as content references. Thresholds and grants stay server-owned under `levels_v1`.

| Level / total XP | Replaced DUMMY | Selected ID / export | Polish / English name | Next preview |
| --- | --- | --- | --- | --- |
| 1 / 0 | `companion_base` | [`zharomir-wanderer-v01`](../../apps/mobile/assets/companion/zharomir-wanderer-v01.png) | Wędrowiec / Wanderer | `zharomir-ember-sash-v01` |
| 2 / 100 | `ember_mark` | [`zharomir-ember-sash-v01`](../../apps/mobile/assets/companion/zharomir-ember-sash-v01.png) | Wstęga Żaru / Ember Sash | `zharomir-guardian-token-v01` |
| 3 / 250 | `guardian_token` | [`zharomir-guardian-token-v01`](../../apps/mobile/assets/companion/zharomir-guardian-token-v01.png) | Znak Strażnika / Guardian’s Token | `zharomir-oath-fittings-v01` |
| 4 / 450 | `oath_binding` | [`zharomir-oath-fittings-v01`](../../apps/mobile/assets/companion/zharomir-oath-fittings-v01.png) | Okucia Przysięgi / Oath Fittings | `zharomir-spark-mantle-v01` |
| 5 / 700 | `spark_mantle` | [`zharomir-spark-mantle-v01`](../../apps/mobile/assets/companion/zharomir-spark-mantle-v01.png) | Płaszcz Iskry / Spark Mantle | None — initial track complete |

Each preview uses the next row's same export/name, labelled locked until the backend grants it; preview metadata grants nothing. Level 5 uses **„Początkowa ścieżka ukończona” / “Initial track complete”**, with no next image or level 6 promise. XP may continue accumulating. Names describe cumulative appearances: sash at level 2, sash/token at 3, sash/token/forearm fittings at 4, those categories plus the larger mantle at 5. These invented content names imply no historical traditional objects.

### Export metadata

All five: PNG, **1024 × 1536**, RGB, **alpha=false**, full-canvas crop, centered anchor `(0.5, 0.5)`, aspect ratio 2:3. Use `contain` in a separate art panel, target **180 × 270** layout units (about 240 units of character height), with labels/rules outside the art. Do not mirror, overlay text, crop the lantern/boots or treat the dark backdrop as transparent. Use a full panel for next-unlock inspection; tiny body thumbnails cannot show all equipment details.

These are intentionally opaque panels after an attempted alpha export produced a duplicate waist and blur; that rejected candidate remains local and is not bundled. Alpha-edge cleanup is inapplicable to these selected RGB files. If a future screen needs a cutout, create a separately reviewed alpha export rather than silently treating these files as one. Their silhouette/background boundaries were inspected on dark and light surrounding cards; no blur seam or clipped extremity remained in the selected set.

| Selected ID | Source master under `graphics/mvp-03/levels/` | Source and export SHA-256 | Bytes |
| --- | --- | --- | --- |
| `zharomir-wanderer-v01` | `level-01-v02.png` | `f3a23268a4ecdc8f2d3a750c212c7811dd5dbdfdff5f6ce8d9e9c4619f712e36` | 1807840 |
| `zharomir-ember-sash-v01` | `level-02-v01.png` | `70e73f611d11e3c7ffedd45ead452c2f1b0854c7f6243933fa0687bce92fe251` | 1868539 |
| `zharomir-guardian-token-v01` | `level-03-v01.png` | `d73995cf5fbbdab0540858b8568b5e3dfa9c02f3c8e96613b75eba33337fae9e` | 1886105 |
| `zharomir-oath-fittings-v01` | `level-04-v01.png` | `62786e6985e66f2f9ccc4c215eb9eb68b760d6830349dbc18d8664346fbe3e1f` | 1921834 |
| `zharomir-spark-mantle-v01` | `level-05-v01.png` | `fd9ae9a17a2c9520ea62a3dfcc33e8391874c49242579d4940d62b5ee1ab2ad1` | 1963866 |

Each export is an unchanged copy of its named master. Provenance: `graphics/mvp-03/provenance.json`, entries keyed by selected ID, plus `levels/selected-metadata.json`. Base uses `level-01-v02.prompt.txt` and canonical reference v01. Levels 2–5 each use `level-0N-v01.prompt.txt` and that same corrected base image as input, avoiding serial identity drift. Tool/date/unknown model/seed and reviewed terms are as recorded above. Combined PNG size is 9,448,184 bytes; bundle/loading performance has not yet been checked.

### Selection review and limitations

Independent art review found no blocking anatomy, identity, framing or cumulative-equipment issues. Source images and a local Safari fixture `graphics/mvp-03/levels/size-review.html` were inspected on 2026-09-24 at 180 × 270 CSS px on `#242a2d` and `#ede7db` surrounding cards. The first sash visibly distinguishes levels 1/2; token and bronze forearm rims distinguish 3/4 more subtly; the layered mantle gives level 5 a larger silhouette change. Labels remain necessary. This is desktop visual evidence, not React Native loading, device performance, VoiceOver or native localization acceptance.

Minor accepted production variation: the token's engraved diamond and position, sash drape and cuff surface pattern vary between panels. The earned token **category** remains visible, but these are not an exact canonical emblem for close-up reuse. Standardize a separate emblem if that later becomes a product requirement. Core head/seam/carry identity remains consistent.

## Remaining handoff

The reviewed [T04 UI handoff](ui-system.md) defines separate opaque art panels and PL/EN layout studies. Later mobile slices must bundle static sources from the tracked export paths, use product locale catalogs, render server-supplied current/next state and cap completion, handle load failure visibly, and verify iOS layout/accessibility. Do not load ignored masters or mixed-view reference sheets at runtime. S3 access/upload/restore remain deferred by the owner.
