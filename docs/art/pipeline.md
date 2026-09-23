# Artwork pipeline

Status: proposed production workflow. Original AI-generated artwork and continuity are owner requirements; Leonardo is a candidate, Scenario a later option. No subscription, license or pricing claims are made.

## Files and continuity

1. Define canonical references in the [Art Bible](art-bible.md).
2. Generate concepts, select an identity and preserve references across progression.
3. Test new poses/states against that identity before batch production.
4. Clean up edges, transparency and layers; inspect at actual mobile display size.
5. Export selected assets to a deliberate tracked app location when implementation exists.

These are **local production practices**, not a claim that a generator guarantees consistency.

Keep masters, reference sheets and experimental outputs in `graphics/` (ignored). Preserve prompt, model/version, seed when available, reference IDs, generation date, edits and usage provenance alongside the local master. Add a small tracked manifest under `docs/art/` when assets are selected. **Source: owner request and [ADR 0001](../decisions/0001-project-foundation.md).**

Ignoring artwork excludes it from clones and Git backups. Choose a separate backup location before relying on these masters. Git ignore also does not revoke access for agents or hide already tracked files. **Basis: [Git ignore](https://git-scm.com/docs/gitignore); backup choice is local.**

## Implementation readiness

Record asset ID/version, dimensions, transparency, crop/anchor, target use, source checksum and provenance reference for selected exports. A generated bitmap is not automatically an animation rig. Prototype Rive or another animation approach before choosing final formats. **Local acceptance rules.**

Verify the selected tool's current usage terms before production; log the reviewed source/date. “Generated with AI” alone does not establish exclusivity. Keep practical provenance separate from any unverified ownership claim.
