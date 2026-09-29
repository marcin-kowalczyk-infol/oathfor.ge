#!/usr/bin/env python3
"""Offline tests for review_copy.py. No network calls.

Run: python3 -m unittest discover -s .agents/commands -p 'test_review_copy.py'
"""
from __future__ import annotations

import contextlib
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock
import urllib.error

sys.path.insert(0, str(Path(__file__).resolve().parent))
import review_copy as rc  # noqa: E402


PL = {
    "forge": {"title": "Kuźnia", "hint": "Masz {{count}} przysiąg"},
    "countdown": {"days_one": "{{count}} dzień", "days_few": "{{count}} dni",
                  "days_many": "{{count}} dni", "days_other": "{{count}} dnia"},
    "onlyPl": "Tylko po polsku",
}
EN = {
    "forge": {"title": "Forge", "hint": "You have {{count}} oaths"},
    "countdown": {"days_one": "{{count}} day", "days_other": "{{count}} days"},
    "onlyEn": "English only",
}


def answers_for(chunk_size: int, value: float = 0.1, overrides: dict | None = None) -> dict:
    answers = {
        f"i{i}_{check}": {"type": "noul", "noul": value}
        for i in range(chunk_size) for check in rc.JEV_CHECKS
    }
    for qid, prob in (overrides or {}).items():
        answers[qid] = {"type": "noul", "noul": prob}
    return {"model": "jev-1.13.0", "answers": answers,
            "usage": {"input_tokens": 100, "output_tokens": 5}}


class FakeClient:
    def __init__(self, overrides: dict | None = None, error: Exception | None = None):
        self.calls: list[tuple[str, dict, dict]] = []
        self.overrides = overrides or {}
        self.error = error

    def __call__(self, model: str, state: dict, questions: dict) -> dict:
        self.calls.append((model, state, questions))
        if self.error:
            raise self.error
        return answers_for(len(state["items"]), overrides=self.overrides)


class FlattenAndPairing(unittest.TestCase):
    def test_flatten_nested_to_dotted_keys(self):
        flat = rc.flatten(PL)
        self.assertEqual(flat["forge.title"], "Kuźnia")
        self.assertEqual(flat["countdown.days_few"], "{{count}} dni")
        self.assertNotIn("forge", flat)

    def test_plural_forms_pair_with_en_one_or_other(self):
        pairs, _ = rc.pair_keys(rc.flatten(PL), rc.flatten(EN))
        mapping = dict(pairs)
        self.assertEqual(mapping["countdown.days_one"], "countdown.days_one")
        self.assertEqual(mapping["countdown.days_few"], "countdown.days_other")
        self.assertEqual(mapping["countdown.days_many"], "countdown.days_other")
        self.assertEqual(mapping["countdown.days_other"], "countdown.days_other")
        self.assertEqual(mapping["forge.title"], "forge.title")

    def test_single_locale_keys_are_unpaired(self):
        _, unpaired = rc.pair_keys(rc.flatten(PL), rc.flatten(EN))
        self.assertEqual(unpaired, ["pl:onlyPl", "en:onlyEn"])


class ChangeDetection(unittest.TestCase):
    def setUp(self):
        self.pl, self.en = rc.flatten(PL), rc.flatten(EN)

    def test_unchanged_keys_are_skipped_and_changes_on_either_side_count(self):
        ref_pl, ref_en = dict(self.pl), dict(self.en)
        ref_pl["forge.title"] = "Stara kuźnia"
        ref_en["countdown.days_other"] = "{{count}} old days"
        del ref_pl["onlyPl"]
        items, unpaired = rc.select(self.pl, self.en, ref_pl, ref_en)
        keys = sorted(item.key for item in items)
        self.assertEqual(keys, ["countdown.days_few", "countdown.days_many",
                                "countdown.days_other", "forge.title"])
        self.assertEqual(unpaired, ["pl:onlyPl"])

    def test_new_keys_count_as_changed(self):
        ref_pl = {k: v for k, v in self.pl.items() if k != "forge.hint"}
        ref_en = {k: v for k, v in self.en.items() if k != "forge.hint"}
        items, _ = rc.select(self.pl, self.en, ref_pl, ref_en)
        self.assertEqual([item.key for item in items], ["forge.hint"])

    def test_missing_file_at_ref_marks_everything_new(self):
        items, unpaired = rc.select(self.pl, self.en, None, None)
        self.assertEqual(len(items), 6)
        self.assertEqual(len(unpaired), 2)

    def test_prefix_and_all(self):
        items, unpaired = rc.select(self.pl, self.en, self.pl, self.en, prefix="forge.", review_all=True)
        self.assertEqual(sorted(item.key for item in items), ["forge.hint", "forge.title"])
        self.assertEqual(unpaired, [])

    def test_run_uses_injected_ref_loader(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for locale, data in (("pl", PL), ("en", EN)):
                path = root / rc.LOCALE_PATHS[locale]
                path.parent.mkdir(parents=True)
                path.write_text(json.dumps(data), encoding="utf-8")
            ref_pl = json.loads(json.dumps(PL))
            ref_pl["forge"]["title"] = "Stara"
            loaded = {rc.LOCALE_PATHS["pl"]: ref_pl, rc.LOCALE_PATHS["en"]: EN}
            seen_refs: list[str] = []

            def factory(ref):
                seen_refs.append(ref)
                return loaded.get

            client = FakeClient()
            out = io.StringIO()
            with contextlib.redirect_stdout(out):
                code = rc.run(["--ref", "main", "--json"], client_factory=lambda key: client,
                              ref_loader_factory=factory, environ={"TYPESAFE_API_KEY": "k"},
                              env_file=root / "none", root=root)
        self.assertEqual(code, 0)
        self.assertEqual(seen_refs, ["main"])
        self.assertEqual([i["key"] for i in client.calls[0][1]["items"]], ["forge.title"])
        self.assertEqual(json.loads(out.getvalue())["reviewed"], 1)

    def test_bad_ref_reports_and_exits(self):
        def factory(ref):
            raise rc.RefError(f"unknown git ref: {ref}")

        for strict, expected in ((False, 0), (True, 2)):
            out = io.StringIO()
            args = ["--ref", "nope"] + (["--strict"] if strict else [])
            with contextlib.redirect_stdout(out):
                code = rc.run(args, client_factory=lambda key: FakeClient(), ref_loader_factory=factory,
                              environ={"TYPESAFE_API_KEY": "k"}, env_file=Path("/nonexistent"))
            self.assertEqual(code, expected)
            self.assertIn("unknown git ref: nope", out.getvalue())


class DeterministicChecks(unittest.TestCase):
    def test_placeholder_sets_must_match(self):
        self.assertEqual(rc.deterministic_checks("Masz {{count}}", "You have {{count}}"), {})
        self.assertEqual(rc.deterministic_checks("Masz {{count, number}}", "You have {{count}}"), {})
        self.assertIn("placeholders", rc.deterministic_checks("Masz {{count}}", "You have {{total}}"))
        self.assertIn("placeholders", rc.deterministic_checks("Masz", "You have {{count}}"))

    def test_em_dash_and_semicolon_in_either_text(self):
        self.assertIn("em_dash", rc.deterministic_checks(f"Idź {rc.EM_DASH} teraz", "Go now"))
        self.assertIn("semicolon", rc.deterministic_checks("Idź", "Go; now"))
        self.assertEqual(rc.deterministic_checks("Idź - teraz", "Go, now"), {})


class Batching(unittest.TestCase):
    def test_batches_of_ten_with_indexed_questions(self):
        items = [rc.Item(f"k{i}", f"k{i}", "pl", "en") for i in range(23)]
        client = FakeClient()
        result = rc.review(items, client, "jev-1.13.0", 0.6)
        self.assertEqual([len(c[1]["items"]) for c in client.calls], [10, 10, 3])
        state, questions = client.calls[2][1], client.calls[2][2]
        self.assertEqual(set(state), {"items"})
        self.assertEqual(set(state["items"][0]), {"key", "pl", "en"})
        self.assertEqual(len(questions), 3 * 4)
        self.assertIn("`items[2].pl`", questions["i2_pl_unnatural"]["instructions"])
        self.assertIn("`items[2].en`", questions["i2_meaning_mismatch"]["instructions"])
        self.assertTrue(all(q["type"] == "noul" for q in questions.values()))
        self.assertIn("Aktywna", questions["i0_pl_unnatural"]["instructions"])
        self.assertEqual(result.input_tokens, 300)
        self.assertEqual(result.output_tokens, 15)


class ThresholdRouting(unittest.TestCase):
    def test_only_answers_at_or_above_threshold_flag(self):
        items = [rc.Item("a", "a", "pl", "en"), rc.Item("b", "b", "pl", "en"),
                 rc.Item("c", "c", "Idź; teraz", "Go now")]
        client = FakeClient(overrides={"i0_tone": 0.6, "i1_pl_unnatural": 0.59})
        result = rc.review(items, client, "jev-1.13.0", 0.6)
        self.assertEqual(items[0].checks, {"tone": 0.6})
        self.assertEqual(items[1].checks, {})
        self.assertEqual(items[2].checks, {"semicolon": 1.0})
        self.assertEqual([i.key for i in result.flagged], ["a", "c"])

    def test_strict_exits_one_when_flagged(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for locale, data in (("pl", {"a": "Jeden"}), ("en", {"a": "One"})):
                path = root / rc.LOCALE_PATHS[locale]
                path.parent.mkdir(parents=True)
                path.write_text(json.dumps(data), encoding="utf-8")
            for overrides, expected in (({"i0_tone": 0.9}, 1), ({}, 0)):
                out = io.StringIO()
                with contextlib.redirect_stdout(out):
                    code = rc.run(["--all", "--strict"], client_factory=lambda key: FakeClient(overrides),
                                  environ={"TYPESAFE_API_KEY": "k"}, env_file=root / "none", root=root)
                self.assertEqual(code, expected)
                self.assertTrue(out.getvalue().startswith("ADVISORY"))


class ProviderErrors(unittest.TestCase):
    def _run(self, client, strict):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for locale, data in (("pl", {"a": "Jeden"}), ("en", {"a": "One"})):
                path = root / rc.LOCALE_PATHS[locale]
                path.parent.mkdir(parents=True)
                path.write_text(json.dumps(data), encoding="utf-8")
            out = io.StringIO()
            with contextlib.redirect_stdout(out):
                code = rc.run(["--all"] + (["--strict"] if strict else []),
                              client_factory=lambda key: client,
                              environ={"TYPESAFE_API_KEY": "k"}, env_file=root / "none", root=root)
        return code, out.getvalue()

    def test_provider_error_reports_and_exits_zero_or_two(self):
        client = FakeClient(error=rc.ProviderError("HTTP 529 Overloaded"))
        self.assertEqual(self._run(client, False), (0, "review_copy: provider error, HTTP 529 Overloaded\n"))
        self.assertEqual(self._run(client, True)[0], 2)

    def test_missing_answer_is_a_provider_error(self):
        def client(model, state, questions):
            return {"model": "jev-1.13.0", "answers": {}}

        code, out = self._run(client, True)
        self.assertEqual(code, 2)
        self.assertIn("missing answer i0_meaning_mismatch", out)

    def test_http_client_retries_once_then_raises_without_key(self):
        secret = "sk-test-secret"
        calls = []

        def fake_urlopen(request, timeout, context):
            calls.append(request)
            raise urllib.error.HTTPError(rc.API_URL, 529, "Overloaded", {}, io.BytesIO(secret.encode()))

        sleeps = []
        with mock.patch.object(rc.urllib.request, "urlopen", fake_urlopen):
            client = rc.http_client(secret, sleep=sleeps.append)
            with self.assertRaises(rc.ProviderError) as caught:
                client("jev-1.13.0", {"items": []}, {})
        self.assertEqual(len(calls), 2)
        self.assertEqual(sleeps, [2.0])
        self.assertIn("HTTP 529", str(caught.exception))
        self.assertNotIn(secret, str(caught.exception))

    def test_http_client_maps_network_and_json_failures(self):
        def timeout(request, timeout, context):
            raise TimeoutError("timed out")

        class BadBody:
            def __enter__(self):
                return self

            def __exit__(self, *exc):
                return False

            def read(self):
                return b"<html>"

        for opener, text in ((timeout, "network error"), (lambda *a, **k: BadBody(), "not valid JSON")):
            with mock.patch.object(rc.urllib.request, "urlopen", opener):
                with self.assertRaises(rc.ProviderError) as caught:
                    rc.http_client("test-key-123", sleep=lambda s: None)("m", {}, {})
            self.assertIn(text, str(caught.exception))


class KeyLoading(unittest.TestCase):
    def test_env_then_dotenv_with_quotes(self):
        with tempfile.TemporaryDirectory() as tmp:
            env_file = Path(tmp) / ".env"
            env_file.write_text('OTHER=1\nTYPESAFE_API_KEY="from-file"\n', encoding="utf-8")
            self.assertEqual(rc.load_api_key({"TYPESAFE_API_KEY": "from-env"}, env_file), "from-env")
            self.assertEqual(rc.load_api_key({}, env_file), "from-file")
            env_file.write_text("TYPESAFE_API_KEY=\n", encoding="utf-8")
            self.assertIsNone(rc.load_api_key({}, env_file))

    def test_no_key_prints_skip_and_never_calls_provider(self):
        def factory(key):
            raise AssertionError("client must not be built without a key")

        for strict, expected in ((False, 0), (True, 2)):
            out = io.StringIO()
            with contextlib.redirect_stdout(out):
                code = rc.run(["--strict"] if strict else [], client_factory=factory,
                              environ={}, env_file=Path("/nonexistent"))
            self.assertEqual(code, expected)
            self.assertEqual(out.getvalue().count("\n"), 1)
            self.assertIn("skipped", out.getvalue())


if __name__ == "__main__":
    unittest.main()
