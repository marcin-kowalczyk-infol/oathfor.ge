# Żaromir — concept reference manifest

Status: initial T02 concept references selected for continued production after agent visual review, 2026-09-24. The owner accepted the starting brief and permits refinement during artwork creation; the owner subsequently chose “Zachowaj ten styl” after viewing these images on 2026-09-24. This accepts the visual direction for subsequent unlocks, not unseen exports. No app exports, native acceptance or animation rigs exist yet.

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

## Remaining handoff

T03: deliberate five-level asset selection, distinct small unlocks, PL/EN names and next-unlock mapping, separate production exports with inspected alpha/crop/anchor and checksums. T04: actual UI system. Later mobile slices: static bundle mapping, loading/failure behavior, product localization and native iOS readability/accessibility. Do not use these mixed-view sheets directly as app character assets.
