# Artwork pipeline

Status: proposed production workflow. Original AI-generated artwork and continuity are owner requirements. Codex is the accepted generation route (owner decision, 2026-10-02, see below). Leonardo and Scenario stay later options. No subscription, license or pricing claims are made.

## Files and continuity

1. Define canonical references in the [Art Bible](art-bible.md).
2. Generate concepts, select an identity and preserve references across progression.
3. Test new poses/states against that identity before batch production.
4. Clean up edges, transparency and layers; inspect at actual mobile display size.
5. Export selected assets to a deliberate tracked app location when implementation exists.

These are **local production practices**, not a claim that a generator guarantees consistency.

Keep masters, reference sheets and experimental outputs in `graphics/` (ignored). Preserve prompt, model/version, seed when available, reference IDs, generation date, edits and usage provenance alongside the local master. Add a small tracked manifest under `docs/art/` when assets are selected. **Source: owner request and [ADR 0001](../decisions/0001-project-foundation.md).**

Ignoring artwork excludes it from clones and Git backups. A separate backup remains the target. **Accepted temporary exception: owner instruction, 2026-09-24.** Keep masters in the repository-local ignored `graphics/` directory for now; the owner will provide S3 access later. This permits current artwork work without an external backup destination. S3 upload/restore verification remains pending; no remote backup is claimed. Git ignore also does not revoke access for agents or hide already tracked files. **Basis: [Git ignore](https://git-scm.com/docs/gitignore); backup choice is local.**

## Generating with Codex

**Accepted route: owner decision, 2026-10-02.** Agents create, change or improve artwork through the Codex CLI. Codex generates with its built-in image tool and composes or corrects with local Python scripts. Agents never ask the owner to generate art by hand.

Rules:

1. **One fresh session per request.** Run `codex exec` from the repository root. Do not resume an old art session. A resumed long session cost about 2.1M tokens per call (measured 2026-10-01), a fresh one about 66k. Batch related assets into one brief.
2. **The brief is a file.** A fresh session knows nothing, so it reads only the brief. Write it as `graphics/<epic-or-topic>/codex-brief-<topic>.md` with the template below.
3. **Continuity first.** The brief names the documents to read and the canonical reference images by path, and the same images are attached with `-i`. It states plainly that faces, proportions, costumes and materials of existing characters must not change.
4. **Both styles.** When the app uses the current and the cinematic style, the brief asks for both and lists the references of each.
5. **Exact output.** Folder under `graphics/`, file names, size, cells and grid, transparency, anchors and a preview on the app background. Codex writes a short report beside the files: prompt, tool, date, references, bounding boxes, alpha check.
6. **Sandbox.** Run with `-s workspace-write`. Never add `--dangerously-bypass-approvals-and-sandbox` without the owner's consent. Run it in the background and give it time, since generation takes minutes.
7. **Review before use.** The agent inspects the result at target size on the app background. A defect gets a measured rejection and a correction brief in a new session. Selected files are copied to the app assets with a manifest row (size, cells, SHA-256) in the relevant `docs/art/*-assets.md`, and the art registry gets its keys for both styles. The owner's visual acceptance stays pending until given.

Command:

```bash
codex exec -s workspace-write "Wykonaj brief: graphics/<topic>/codex-brief-<topic>.md. Przeczytaj go w całości i wskazane pliki przed generowaniem. Na końcu krótki raport: pliki, wymiary, problemy." -i <reference-1.png> -i <reference-2.png> -o <scratchpad>/codex-<topic>.md
```

Brief template:

```markdown
# Brief: <asset> (<epic>), <styles>

Repository: <absolute path>. Work only inside `graphics/<topic>/`. Do not edit app code, docs or other graphics folders. Do not commit.

## Read first
- docs/art/art-bible.md, docs/art/companion.md (Żaromir), docs/art/cinematic-assets.md, the relevant asset manifest, the product spec section that needs the asset.

## References (attached and on disk), keep exactly this look
- Current style: <paths>. Cinematic style: <paths>.
- Do not change faces, proportions, costumes or materials of existing characters.

## What to make
- Purpose, display size in pt, background colour, shapes that must differ, colours to avoid.
- Sheet: cells, cell size, total size, RGBA, margins, anchors.

## Output
- graphics/<topic>/incoming/<name>-v01.png and <name>-cinematic-v01.png
- <name>-v01.md report: prompt, tool, date, references, per-cell bounding boxes, alpha check.
- Preview on the app background at 4x.

If something cannot meet these rules, say what and why in the report instead of guessing.
```

The first brief made this way is `graphics/mvp-22/codex-brief-step-badges.md` (step badges, MVP-22).

## Implementation readiness

Record asset ID/version, dimensions, transparency, crop/anchor, target use, source checksum and provenance reference for selected exports. A generated bitmap is not automatically an animation rig. Prototype Rive or another animation approach before choosing final formats. **Local acceptance rules.**

Verify the selected tool's current usage terms before production; log the reviewed source/date. “Generated with AI” alone does not establish exclusivity. Keep practical provenance separate from any unverified ownership claim.
