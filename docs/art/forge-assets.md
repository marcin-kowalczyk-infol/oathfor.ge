# Forge hub — MVP-05-T12

Status: original concept selected for implementation by the agent on 2026-09-25; **owner accepted the stone/amber art direction; final interaction acceptance pending**. Local design choices under the [visual task](../product/oath-visual-polish.md) and [art direction](art-bible.md).

## Composition and interaction brief

A compact freestanding stone hearth, dark iron bands, timber and amber coals form the central silhouette. The carved geometric ornament is original fantasy design, not a claim of historical reconstruction. Orbit informed breathing room, central composition and connected controls; its commercial screenshots are references, never app assets. Existing opaque Żaromir Wanderer panel was inspected; it is not extracted into a new transparent pose or painted into the hearth.

Today displays the illustration at 242 logical units with a restrained orbit line. Up to three stationary, labelled Oath seals connect underneath in server order. Each opens its authoritative detail. All rows remain in the complete ordered list, including overdue review. At font scale above 1.3 or viewport below 350 logical units, the list provides the equivalent actions and information. No interaction grants XP or changes progression.

The current layered composition has an opaque background/hearth still, a separate code-rendered light overlay, connecting lines and accessible controls. Light fades slowly only while foregrounded and Reduce Motion is off; it stays static otherwise. This is a small decorative effect, **not a finished character or furnace animation rig**. Separate painted foreground/coals/embers are deferred until a concrete motion need is approved; no extraction quality is claimed.

For any future layered export: keep the complete hearth silhouette centered, pivot at bottom center (0.5, 0.93), furnace light anchor approximately (0.5, 0.65), keep ornaments stable and reserve the outer margins for connections. Export foreground/anvil and ember layers with actual alpha, inspect against the charcoal canvas, and retain this still as the reduced-motion equivalent. Never embed rule text or status into bitmap layers.

## Selected export

| Field | Value |
| --- | --- |
| Asset ID | `forge-hearth-v01` |
| App path | `apps/mobile/assets/forge/hearth-v01.png` |
| Master | ignored `graphics/mvp-05/forge/hearth-concept-v01.png` |
| Dimensions / alpha | 1254 × 1254 PNG; opaque RGB |
| Crop / rendering | Entire square, contain; decorative, no accessible image label |
| SHA-256 | `805e41d57600d02946336385453a050c63c6e72a85b1753529c0c9b186159fcf` |
| Provenance | Built-in `imagegen`, 2026-09-25; model version and seed not exposed. No external image uploaded in generation call. Prompt retained beside local master. |

Tool terms source checked 2026-09-25: [OpenAI Europe Terms of Use](https://openai.com/policies/terms-of-use/), updated 2026-01-16, Content section. Output rights are subject to applicable law and output need not be unique; no exclusivity claim is made. The source review is provenance, not a separate legal opinion.

The ignored master currently has only the temporary local storage arrangement accepted in the [pipeline](pipeline.md). No S3 backup or restore verification is claimed.


## Interaction refinement

Owner feedback on2026-09-25 retained this original asset and requested game-like interaction. The hearth is now a labelled creation target, and round metal seals have native press springs and depth. Four code-rendered ember particles drift upward with the light; hit targets do not drift. Motion stops outside the foreground and when Reduce Motion is enabled. Labels remain outside the illustration and large system text retains the list/action equivalent. Acceptance uses a separate one-shot decorative stamp after server confirmation, with no XP implication. No new raster master or animation rig was generated.
