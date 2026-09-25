# Forge stations — movement prototype

Status: owner authorized a simulator prototype on 2026-09-25. This is a separate development-only scene, not an accepted replacement for Oath navigation or a production animation rig. It explores rune selection → companion movement → station response. It creates no commitment, XP or unlock.

## Selected provisional exports

Original artwork generated with built-in `image_gen` on 2026-09-25. Exact model and seed were not exposed. Masters, exact prompts and provenance remain in ignored `graphics/mvp-05/stations/`; selected unchanged exports live in `apps/mobile/assets/forge/` and are referenced only by the demo scene. Production `index.ts` is unchanged.

| ID | Dimensions / alpha | Usage | SHA-256 |
| --- | --- | --- | --- |
| `room-prototype-v01` | 1254×1254 RGB, opaque | Square room backdrop; no cropping; center anchor | `1fac3ddb89c654fc02ff5b3fbcc633c7adbac0b1f30cf25b2a22096e9cbc9590` |
| `zharomir-walk-prototype-v01` | 1254×1254 RGBA, alpha0–255 | Four equal627×627 cells, row-major; clip in runtime, never mirror | `397a800d9458acbc07a26f0cd529b6e0353d548fd69dd9fa283ddb8e62466ebe` |

The walking sheet uses `zharomir-wanderer-v01` as its identity reference. It retains the adult carved-wood head, beard, charcoal cloak, linen and right-hand lantern. Each cell is a separate generated pose; proportions, alignment and cloth vary slightly. Front three-quarter walking frames are provisional for every travel direction; dedicated turns, rear views, idle and work cycles remain necessary for convincing final animation.

The room uses an original prompt, no third-party image inputs. Its hearth, seal wall and chronicle are decorative navigation destinations. Seal motifs and book marks are invented scenery, not gameplay state or readable rule content. Approximate image anchors: hearth(0.50,0.30), seals(0.15,0.36), chronicle(0.86,0.39). Walkable floor remains central. Backdrop is one opaque layer; character, light and interaction layers are separate in code. True foreground occlusion layers are not yet exported.

Terms checked before generation: [OpenAI Europe Terms of Use](https://openai.com/policies/eu-terms-of-use/), updated2026-01-16, reviewed2026-09-25. They assign output rights between the parties subject to applicable law and note that output may not be unique. The account contract was not inspected; this is provenance, not an exclusivity guarantee. Local master backup remains under the owner's temporary local-only exception in the [art pipeline](pipeline.md).

## Acceptance still needed

Independent art review found no blocking identity/composition issue for this labelled prototype. Runtime frame translation compensates measured cell-center and foot-baseline drift; native inspection on iPhoneSE3/iOS27.0 verified room framing, movement to the chronicle, retargeting to seals and the static reduced-motion equivalent at a100×100 cell display size. Final movement quality remains for owner review. Review the running movement, scale and station response in the simulator. Evaluate whether spatial navigation is understandable before adding full directional animation or replacing the functional Oath screens. Production artwork needs aligned cycles, directional poses, foreground masks and edge/size review. No external subscription or credentials are required for this prototype.

Exact generation prompts: `graphics/mvp-05/stations/room-v01.prompt.txt` and `graphics/mvp-05/stations/walk-v01.prompt.txt`; machine-readable metadata: `graphics/mvp-05/stations/provenance.json`. These are local ignored masters, intentionally not runtime dependencies.

## Immersive room v03 — 2026-09-25

Owner requested a full-screen room, subtle object highlights, contextual speech bubbles and a door exit. Selected `room-prototype-v03.png` is an887×1774 opaque RGB portrait,2872061 bytes, SHA-256 `a8994b16f6968caf15727f49f3ca5f6b62fe420f548fece17df5199dfd555ce3`. Built-in `image_gen` adapted v01 into v02, then recomposed it into this taller image after native iPhone18Pro inspection showed excessive side cropping. Exact model/seed were not exposed. It preserves stone, carved timber, amber fire and moonlight, adding an open wooden door. It introduces no new character art or external reference. The unmodified v03 export is intentionally stored in `apps/mobile/assets/forge/`; v02 remains only an ignored intermediate and v01 remains historical.

Runtime uses one centered cover transform for the backdrop, companion and object highlights; touch areas are kept inside the viewport. Observed image anchors: hearth(0.515,0.45), seals(0.22,0.52), chronicle(0.82,0.51), door(0.17,0.37). Cover framing crops peripheral architecture according to the viewport. The walking sheet remains provisional v01. The room remains a flat backdrop with runtime glow, not separately animated fire or foreground occlusion.

Local master and exact prompt: `graphics/mvp-05/stations/room-prototype-v03.png`, `room-v03.prompt.txt`; metadata: `provenance-v03.json` in that directory. Intermediate v02 prompt/metadata remain beside it. Same generation-day terms/provenance limitations apply as above. Native checks and final owner acceptance are recorded separately; this is a demo export, not final production art approval.

Companion speech uses a runtime face crop of the existing canonical `zharomir-wanderer-v01` export. No new portrait or generated identity is introduced. The visible portrait and bilingual speaker name identify Żaromir in both the first-visit guide and destination bubbles; the walking sheet remains a separate provisional asset.

## Diffuse illumination follow-up, 2026-09-26

The object and door lights now use the feathered alpha sprite in the [journey manifest](forge-journey-assets.md). Solid oval glows and floor pools were removed. Pulse timing, first-visit guidance, contact feedback and stationary hit areas are preserved. The room still is also selected for functional screens under the current owner direction.
