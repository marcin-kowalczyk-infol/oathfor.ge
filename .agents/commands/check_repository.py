#!/usr/bin/env python3
"""Offline checks for the documentation/agent foundation; Python 3.11+.

Local contract: docs/decisions/0001-project-foundation.md.
Native formats: docs/references.md. No packages or model calls required.
"""
from __future__ import annotations

import os
from pathlib import Path
import re
import subprocess
import sys
import tomllib
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[2]
EXPECTED_LINKS = {
    "CLAUDE.md": "AGENTS.md",
    ".claude/skills": "../.agents/skills",
    ".claude/agents": "../.agents/subagents",
    ".codex/agents": "../.agents/adapters/codex/agents",
}
# Local owner decision, 2026-09-23: backlog is not distributed in Git.
OPTIONAL_LOCAL_DOCUMENTS = {ROOT / "docs/delivery/mvp-backlog.md"}
ERRORS: list[str] = []


def fail(message: str) -> None:
    ERRORS.append(message)


def git(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", "-C", str(ROOT), *args],
        text=True, capture_output=True, check=False,
    )


def frontmatter(path: Path) -> dict[str, str]:
    """Validate our deliberately small portable name/description YAML subset."""
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---\n") or "\n---\n" not in text[4:]:
        fail(f"{path.relative_to(ROOT)}: missing frontmatter")
        return {}
    header, body = text[4:].split("\n---\n", 1)
    values: dict[str, str] = {}
    for line in header.splitlines():
        if not line.strip():
            continue
        key, separator, value = line.partition(":")
        if not separator or key not in {"name", "description"} or key in values:
            fail(f"{path.relative_to(ROOT)}: unsupported/duplicate frontmatter field")
            continue
        value = value.strip()
        if not value or ": " in value or value.startswith(("[", "{", "!", "&", "*")):
            fail(f"{path.relative_to(ROOT)}: expected simple scalar for {key}")
        values[key] = value
    name = values.get("name", "")
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", name) or len(name) > 64:
        fail(f"{path.relative_to(ROOT)}: invalid name")
    if not values.get("description") or not body.strip():
        fail(f"{path.relative_to(ROOT)}: missing description or body")
    return values


def main() -> int:
    listing = git("ls-files", "--cached", "--others", "--exclude-standard", "-z")
    if listing.returncode:
        print("FAIL: run this checker inside its Git repository.", file=sys.stderr)
        return 1
    paths = sorted({ROOT / p for p in listing.stdout.split("\0") if p})

    for relative, target in EXPECTED_LINKS.items():
        path = ROOT / relative
        if not path.is_symlink() or os.readlink(path) != target or not path.exists():
            fail(f"{relative}: expected working symlink to {target}")
    for path in paths:
        if path.is_symlink() and (
            not path.exists() or not path.resolve().is_relative_to(ROOT)
        ):
            fail(f"{path.relative_to(ROOT)}: broken or out-of-repository symlink")

    required = [
        "README.md", "AGENTS.md", ".gitignore", "docs/README.md",
        ".agents/README.md", "apps/mobile", "apps/api", "business-plans",
    ]
    for relative in required:
        if not (ROOT / relative).exists():
            fail(f"{relative}: missing required entry")
    if (ROOT / "AGENTS.md").exists():
        if len((ROOT / "AGENTS.md").read_text().splitlines()) > 200:
            fail("AGENTS.md: keep the shared entrypoint under 200 lines")

    markdown = [p for p in paths if p.suffix == ".md" and p.is_file()]
    for path in markdown:
        # Ignore fenced code; check file destinations, not heading anchors.
        text = re.sub(r"```.*?```", "", path.read_text(), flags=re.S)
        for target in re.findall(r"!?(?:\[[^\]\n]*\])\(([^\n)]+)\)", text):
            target = target.strip().strip("<>")
            parsed = urlsplit(target)
            if parsed.scheme or not parsed.path:
                continue
            dest = (path.parent / unquote(parsed.path)).resolve()
            if not dest.is_relative_to(ROOT) or (
                not dest.exists() and dest not in OPTIONAL_LOCAL_DOCUMENTS
            ):
                fail(f"{path.relative_to(ROOT)}: missing/nonportable link {target}")

    roles = sorted((ROOT / ".agents/subagents").glob("*.md"))
    adapters = ROOT / ".agents/adapters/codex/agents"
    skills = sorted((ROOT / ".agents/skills").glob("*/SKILL.md"))
    if not roles or not skills:
        fail("Expected specialized roles and shared skills")
    names: set[str] = set()
    for role in roles:
        meta = frontmatter(role)
        name = meta.get("name", "")
        if name != role.stem or name in names:
            fail(f"{role.relative_to(ROOT)}: duplicate/mismatched role name")
        names.add(name)
        adapter = adapters / f"{role.stem}.toml"
        if not adapter.is_file():
            fail(f"{role.stem}: missing Codex adapter")
            continue
        try:
            config = tomllib.loads(adapter.read_text())
        except tomllib.TOMLDecodeError as exc:
            fail(f"{adapter.relative_to(ROOT)}: {exc}")
            continue
        if set(config) != {"name", "description", "developer_instructions"}:
            fail(f"{adapter.relative_to(ROOT)}: unexpected native configuration")
        if any(config.get(k) != meta.get(k) for k in ("name", "description")):
            fail(f"{adapter.relative_to(ROOT)}: metadata differs from shared role")
        pointer = f".agents/subagents/{role.stem}.md"
        if pointer not in config.get("developer_instructions", ""):
            fail(f"{adapter.relative_to(ROOT)}: missing canonical role pointer")
    if {p.stem for p in adapters.glob("*.toml")} != {p.stem for p in roles}:
        fail("Codex adapter and shared role inventories differ")

    skill_names: set[str] = set()
    for skill in skills:
        meta = frontmatter(skill)
        name = meta.get("name", "")
        if name != skill.parent.name or name in skill_names:
            fail(f"{skill.relative_to(ROOT)}: duplicate/mismatched skill name")
        skill_names.add(name)

    if git("check-ignore", "--no-index", "-q", "graphics/__ignore_probe__.png").returncode:
        fail("graphics/: artwork must be ignored")
    tracked_art = git("ls-files", "--", "graphics").stdout.strip()
    if tracked_art:
        fail("graphics/: tracked artwork exists despite ignore policy")
    if (ROOT / "docs/business-plans").exists():
        fail("Business plans belong outside docs/")

    if ERRORS:
        for message in ERRORS:
            print(f"FAIL: {message}", file=sys.stderr)
        return 1
    print(
        f"OK: {len(markdown)} Markdown files, {len(skills)} skills, "
        f"{len(roles)} role/adapters, {len(EXPECTED_LINKS)} symlinks; "
        "local links and graphics exclusion valid."
    )
    print("Scope: offline structure checks; no live host discovery or app tests.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
