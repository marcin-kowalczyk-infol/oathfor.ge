#!/usr/bin/env python3
"""Advisory PL/EN copy pre-review with TypeSafe Jev; Python 3.11+, stdlib only.

Local decision: owner request, 2026-09-29. Processor approval: ADR 0007.
API: https://docs.typesafe.ai/api.md. Tone rules condense the persona section of
docs/art/companion.md ("Persona and authority"). The provider receives only the
copy keys and texts plus the static questions below. The result is advisory.
"""
from __future__ import annotations

import argparse
from dataclasses import dataclass, field
import json
import os
from pathlib import Path
import re
import ssl
import subprocess
import sys
import time
from typing import Callable, Iterable
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
LOCALE_PATHS = {
    "pl": "apps/mobile/src/localization/locales/pl/messages.json",
    "en": "apps/mobile/src/localization/locales/en/messages.json",
}
ENV_FILE = ROOT / "apps/api/.env"
API_URL = "https://api.typesafe.ai/v1/systemone"
DEFAULT_MODEL = "jev-1.13.0"
# Full-catalog run on 2026-09-29: at 0.7 only one intentional PL/EN difference was flagged out of 511 pairs.
DEFAULT_THRESHOLD = 0.7
BATCH_SIZE = 10
TIMEOUT_SECONDS = 30
RETRY_STATUSES = {429, 529}
PLURAL_SUFFIXES = ("_zero", "_one", "_two", "_few", "_many", "_other")
EM_DASH = chr(0x2014)
PLACEHOLDER = re.compile(r"\{\{\s*([^},\s]+)[^}]*\}\}")
ADVISORY = (
    "ADVISORY: automated pre-review by TypeSafe Jev. It narrows manual review. "
    "It does not approve copy. Unflagged lines can still be wrong."
)

LABEL_NOTE = (
    "Short UI labels, single words, status names and button captions "
    "(for example 'Aktywna' or 'Active') are normal and acceptable. "
    "Text in double braces such as {{count}} is a placeholder filled by the app."
)
# Condensed from docs/art/companion.md, "Persona and authority".
# Worded as a list of violations. A live test on 2026-09-29 showed that a "must be calm and warm"
# wording made Jev flag neutral lines, such as reporting awarded XP, as tone problems.
TONE_RULES = (
    "A violation is copy that shames, insults or threatens the player, creates emotional "
    "dependency, claims memories, pressures the player to exercise (especially while ill), "
    "treats a missing start record as proof the player did not train, or promises a reward, "
    "outcome, deadline extension or verdict that has not happened yet. Reporting a result or "
    "XP that was already awarded, neutral status labels, plain instructions and brief "
    "encouragement are not violations."
)

Client = Callable[[str, dict, dict], dict]


class ProviderError(Exception):
    """Provider call failed: HTTP error, timeout or malformed response."""


class RefError(Exception):
    """The git ref cannot be resolved."""


@dataclass
class Item:
    key: str
    en_key: str
    pl: str
    en: str
    checks: dict[str, float] = field(default_factory=dict)


# ---------- locale data ----------

def flatten(data: dict, prefix: str = "") -> dict[str, str]:
    flat: dict[str, str] = {}
    for key, value in data.items():
        path = f"{prefix}{key}"
        if isinstance(value, dict):
            flat.update(flatten(value, f"{path}."))
        else:
            flat[path] = value if isinstance(value, str) else json.dumps(value)
    return flat


def split_plural(key: str) -> tuple[str, str] | None:
    for suffix in PLURAL_SUFFIXES:
        if key.endswith(suffix):
            return key[: -len(suffix)], suffix
    return None


def pair_keys(pl: dict[str, str], en: dict[str, str]) -> tuple[list[tuple[str, str]], list[str]]:
    """Pair PL keys with EN keys. PL plural forms map to EN `_one` or `_other`."""
    pairs: list[tuple[str, str]] = []
    used_en: set[str] = set()
    unpaired: list[str] = []
    for pl_key in sorted(pl):
        en_key = pl_key if pl_key in en else None
        plural = split_plural(pl_key)
        if en_key is None and plural:
            base, suffix = plural
            candidate = f"{base}_one" if suffix == "_one" else f"{base}_other"
            if candidate in en:
                en_key = candidate
        if en_key is None:
            unpaired.append(f"pl:{pl_key}")
            continue
        pairs.append((pl_key, en_key))
        used_en.add(en_key)
    unpaired.extend(f"en:{key}" for key in sorted(en) if key not in used_en)
    return pairs, unpaired


def git_ref_loader(ref: str) -> Callable[[str], dict | None]:
    check = subprocess.run(
        ["git", "-C", str(ROOT), "rev-parse", "--verify", "--quiet", f"{ref}^{{commit}}"],
        text=True, capture_output=True, check=False,
    )
    if check.returncode != 0:
        raise RefError(f"unknown git ref: {ref}")

    def load(path: str) -> dict | None:
        shown = subprocess.run(
            ["git", "-C", str(ROOT), "show", f"{ref}:{path}"],
            text=True, capture_output=True, check=False,
        )
        if shown.returncode != 0:
            return None
        return json.loads(shown.stdout)

    return load


def select(
    pl: dict[str, str], en: dict[str, str],
    ref_pl: dict[str, str] | None, ref_en: dict[str, str] | None,
    prefix: str = "", review_all: bool = False,
) -> tuple[list[Item], list[str]]:
    """Return items to review and unpaired keys in scope."""
    base_pl = ref_pl or {}
    base_en = ref_en or {}
    pairs, unpaired = pair_keys(pl, en)
    items = [
        Item(pl_key, en_key, pl[pl_key], en[en_key])
        for pl_key, en_key in pairs
        if pl_key.startswith(prefix) and (
            review_all or base_pl.get(pl_key) != pl[pl_key] or base_en.get(en_key) != en[en_key]
        )
    ]
    scoped: list[str] = []
    for entry in unpaired:
        locale, key = entry.split(":", 1)
        current, base = (pl, base_pl) if locale == "pl" else (en, base_en)
        if key.startswith(prefix) and (review_all or base.get(key) != current[key]):
            scoped.append(entry)
    return items, scoped


# ---------- deterministic checks ----------

def placeholders(text: str) -> set[str]:
    return set(PLACEHOLDER.findall(text))


def deterministic_checks(pl_text: str, en_text: str) -> dict[str, float]:
    checks: dict[str, float] = {}
    if placeholders(pl_text) != placeholders(en_text):
        checks["placeholders"] = 1.0
    if EM_DASH in pl_text or EM_DASH in en_text:
        checks["em_dash"] = 1.0
    if ";" in pl_text or ";" in en_text:
        checks["semicolon"] = 1.0
    return checks


# ---------- Jev questions ----------

JEV_CHECKS = ("meaning_mismatch", "pl_unnatural", "en_unnatural", "tone")


def build_questions(count: int) -> dict[str, dict]:
    questions: dict[str, dict] = {}
    for i in range(count):
        pl, en = f"`items[{i}].pl`", f"`items[{i}].en`"
        questions[f"i{i}_meaning_mismatch"] = {
            "type": "noul",
            "instructions": (
                f"{pl} is Polish game UI copy and {en} is its English counterpart. "
                "Do they convey a different meaning, outcome or next step for the player? "
                "Grammatical differences required by each language are not a mismatch. "
                f"{LABEL_NOTE}"
            ),
            "criteria": {
                "true": "The two texts tell the player different things.",
                "false": "Both texts tell the player the same thing.",
            },
        }
        questions[f"i{i}_pl_unnatural"] = {
            "type": "noul",
            "instructions": (
                f"Is the Polish game UI text {pl} ungrammatical, a literal calque from "
                f"English or awkward for a native Polish speaker? Read `items[{i}].note` first "
                f"when it is present. {LABEL_NOTE}"
            ),
            "criteria": {
                "true": "A native Polish speaker would find it wrong or clumsy.",
                "false": "It reads as natural Polish UI copy.",
            },
        }
        questions[f"i{i}_en_unnatural"] = {
            "type": "noul",
            "instructions": (
                f"Is the English game UI text {en} ungrammatical, a literal calque from "
                f"Polish or awkward for a native English speaker? {LABEL_NOTE}"
            ),
            "criteria": {
                "true": "A native English speaker would find it wrong or clumsy.",
                "false": "It reads as natural English UI copy.",
            },
        }
        questions[f"i{i}_tone"] = {
            "type": "noul",
            "instructions": (
                f"Does the game copy in {pl} or {en} contain a tone violation? {TONE_RULES}"
            ),
            "criteria": {
                "true": "The copy breaks at least one tone rule.",
                "false": "The copy follows the tone rules.",
            },
        }
    return questions


def batches(items: list[Item], size: int = BATCH_SIZE) -> Iterable[list[Item]]:
    for start in range(0, len(items), size):
        yield items[start:start + size]


@dataclass
class Review:
    items: list[Item]
    model: str
    input_tokens: int = 0
    output_tokens: int = 0

    @property
    def flagged(self) -> list[Item]:
        return [item for item in self.items if item.checks]


# The 2026-09-29 full-catalog run flagged Polish `_other` plurals such as "{{count}} próby".
# In Polish CLDR rules `other` covers fractions, so "1,5 próby" is correct.
PL_OTHER_NOTE = ("This is the Polish plural form for fractional counts, such as 1,5. "
                 "A genitive singular noun after {{count}} is correct here.")


def state_item(item: Item) -> dict:
    data = {"key": item.key, "pl": item.pl, "en": item.en}
    if item.key.endswith("_other") and "{{count" in item.pl:
        data["note"] = PL_OTHER_NOTE
    return data


def review(items: list[Item], client: Client, model: str, threshold: float) -> Review:
    """Run deterministic checks and Jev questions. Raises ProviderError."""
    result = Review(items=items, model=model)
    for item in items:
        item.checks = deterministic_checks(item.pl, item.en)
    first = True
    for chunk in batches(items):
        state = {"items": [state_item(i) for i in chunk]}
        response = client(model, state, build_questions(len(chunk)))
        answers = response.get("answers") if isinstance(response, dict) else None
        if not isinstance(answers, dict):
            raise ProviderError("response has no answers map")
        if first:
            result.model = str(response.get("model") or model)
            first = False
        usage = response.get("usage") or {}
        result.input_tokens += int(usage.get("input_tokens") or 0)
        result.output_tokens += int(usage.get("output_tokens") or 0)
        for index, item in enumerate(chunk):
            for check in JEV_CHECKS:
                answer = answers.get(f"i{index}_{check}")
                try:
                    probability = float(answer["noul"])
                except (TypeError, KeyError, ValueError):
                    raise ProviderError(f"missing answer i{index}_{check}") from None
                if probability >= threshold:
                    item.checks[check] = probability
    return result


# ---------- provider client ----------

def ssl_context() -> ssl.SSLContext:
    context = ssl.create_default_context()
    try:
        import certifi  # type: ignore[import-not-found]
        context.load_verify_locations(cafile=certifi.where())
    except ImportError:
        pass
    if Path("/etc/ssl/cert.pem").exists():
        context.load_verify_locations(cafile="/etc/ssl/cert.pem")
    return context


def http_client(api_key: str, sleep: Callable[[float], None] = time.sleep) -> Client:
    context = ssl_context()

    def redact(text: str) -> str:
        return text.replace(api_key, "[redacted]") if api_key else text

    def call(model: str, state: dict, questions: dict) -> dict:
        body = json.dumps({"model": model, "state": state, "questions": questions}).encode()
        for attempt in (1, 2):
            request = urllib.request.Request(API_URL, data=body, method="POST", headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            })
            try:
                with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS, context=context) as response:
                    return json.loads(response.read().decode("utf-8"))
            except urllib.error.HTTPError as error:
                if error.code in RETRY_STATUSES and attempt == 1:
                    sleep(2.0)
                    continue
                detail = ""
                try:
                    detail = error.read().decode("utf-8", "replace")[:200]
                except Exception:
                    pass
                raise ProviderError(redact(f"HTTP {error.code} {error.reason} {detail}".strip())) from None
            except (urllib.error.URLError, TimeoutError, ssl.SSLError, OSError) as error:
                raise ProviderError(redact(f"network error: {error}")) from None
            except (json.JSONDecodeError, UnicodeDecodeError):
                raise ProviderError("response is not valid JSON") from None
        raise ProviderError("provider still busy after one retry")

    return call


def load_api_key(environ: dict[str, str] | None = None, env_file: Path = ENV_FILE) -> str | None:
    environ = os.environ if environ is None else environ
    value = (environ.get("TYPESAFE_API_KEY") or "").strip()
    if value:
        return value
    if env_file.is_file():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            if line.startswith("TYPESAFE_API_KEY="):
                value = line.partition("=")[2].strip().strip("'\"").strip()
                return value or None
    return None


# ---------- output ----------

def render_text(result: Review, unpaired: list[str], threshold: float) -> str:
    lines = [ADVISORY, ""]
    flagged = sorted(result.flagged, key=lambda item: item.key)
    if flagged:
        names = [
            item.key if item.en_key == item.key else f"{item.key} (en: {item.en_key})"
            for item in flagged
        ]
        width = max(len(name) for name in names)
        for name, item in zip(names, flagged):
            checks = ", ".join(f"{check} {prob:.2f}" for check, prob in item.checks.items())
            lines.append(f"{name.ljust(width)}  {checks}")
            lines.append(f"    PL: {item.pl}")
            lines.append(f"    EN: {item.en}")
    else:
        lines.append(f"No keys flagged at threshold {threshold:.2f}.")
    if unpaired:
        lines.append("")
        lines.append("Unpaired: " + ", ".join(unpaired))
    lines.append("")
    lines.append(
        f"Reviewed {len(result.items)}, flagged {len(flagged)}, unpaired {len(unpaired)}. "
        f"Model {result.model}, threshold {threshold:.2f}, "
        f"tokens in {result.input_tokens} out {result.output_tokens}."
    )
    return "\n".join(lines)


def render_json(result: Review, unpaired: list[str], threshold: float) -> str:
    return json.dumps({
        "advisory": ADVISORY,
        "model": result.model,
        "threshold": threshold,
        "reviewed": len(result.items),
        "flagged": [
            {"key": i.key, "en_key": i.en_key, "checks": i.checks, "pl": i.pl, "en": i.en}
            for i in sorted(result.flagged, key=lambda item: item.key)
        ],
        "unpaired": unpaired,
        "usage": {"input_tokens": result.input_tokens, "output_tokens": result.output_tokens},
    }, ensure_ascii=False, indent=2)


def emit_problem(message: str, as_json: bool, key: str = "error") -> None:
    if as_json:
        print(json.dumps({"advisory": ADVISORY, key: message}, ensure_ascii=False))
    else:
        print(f"review_copy: {message}")


# ---------- entrypoint ----------

def parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Advisory PL/EN copy review with TypeSafe Jev.")
    parser.add_argument("--ref", default="HEAD", help="git ref for change detection (default HEAD)")
    parser.add_argument("--all", action="store_true", help="review every key")
    parser.add_argument("--prefix", default="", help="only keys starting with this prefix")
    parser.add_argument("--strict", action="store_true", help="exit 1 when flagged, 2 on skip or error")
    parser.add_argument("--threshold", type=float, default=DEFAULT_THRESHOLD)
    parser.add_argument("--json", action="store_true", help="machine-readable output")
    return parser.parse_args(argv)


def run(
    argv: list[str] | None = None,
    client_factory: Callable[[str], Client] = http_client,
    ref_loader_factory: Callable[[str], Callable[[str], dict | None]] = git_ref_loader,
    environ: dict[str, str] | None = None,
    env_file: Path = ENV_FILE,
    root: Path = ROOT,
) -> int:
    args = parse_args(argv)
    failure = 2 if args.strict else 0
    api_key = load_api_key(environ, env_file)
    if not api_key:
        emit_problem("skipped, TYPESAFE_API_KEY is not set.", args.json, "skipped")
        return failure
    model = ((os.environ if environ is None else environ).get("JEV_MODEL") or DEFAULT_MODEL).strip()

    current = {
        locale: flatten(json.loads((root / path).read_text(encoding="utf-8")))
        for locale, path in LOCALE_PATHS.items()
    }
    base: dict[str, dict[str, str] | None] = {"pl": None, "en": None}
    if not args.all:
        try:
            load = ref_loader_factory(args.ref)
        except RefError as error:
            emit_problem(str(error), args.json)
            return failure
        for locale, path in LOCALE_PATHS.items():
            data = load(path)
            base[locale] = flatten(data) if data is not None else None

    items, unpaired = select(
        current["pl"], current["en"], base["pl"], base["en"], args.prefix, args.all,
    )
    if not items:
        result = Review(items=[], model=model)
    else:
        try:
            result = review(items, client_factory(api_key), model, args.threshold)
        except ProviderError as error:
            emit_problem(f"provider error, {error}", args.json)
            return failure

    renderer = render_json if args.json else render_text
    print(renderer(result, unpaired, args.threshold))
    return 1 if args.strict and result.flagged else 0


if __name__ == "__main__":
    sys.exit(run())
