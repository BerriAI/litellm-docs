"""Regression tests for the version-note rule in check-docs.py."""
import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("check_docs", ROOT / "scripts/check-docs.py")
checks = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checks)


class VersionNoteTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.site = checks.Site()

    def version_notes(self, text):
        with tempfile.TemporaryDirectory(dir=ROOT) as directory:
            path = Path(directory) / "example.md"
            path.write_text(text)
            errors = checks.check_page(checks.Page(str(path)), self.site, {})
        return [e for e in errors if e[0] == "version-note"]

    def test_hand_written_notes_are_rejected_with_the_badge_to_write(self):
        for line, version in (
            ("This requires LiteLLM v1.85.0", "1.85.0"),
            ("This feature is available in v1.74.3-stable and above.", "1.74.3-stable"),
            ("| Supported LiteLLM Versions | 1.63.8+ |", "1.63.8"),
            ("Available from v1.108.0.", "1.108.0"),
            ("- `encrypted_content_affinity`: routing for encrypted items (**requires LiteLLM >= 1.82.3**)", "1.82.3"),
            ("| http2 | boolean | Uses HTTP/2. Available from v1.103.0. [Further docs](./server_tuning) |", "1.103.0"),
            ("| LIMIT_MB | Available from v1.108.0. Maximum size in MB of a request body. |", "1.108.0"),
            ("Checks: `prompt_caching`, `encrypted_content_affinity` (requires LiteLLM >= 1.82.3), `session_affinity`", "1.82.3"),
            ("From v1.81.0 the request is set as attributes on the parent span. Available from v1.108.0.", "1.108.0"),
            ("Available on `v1.92.x` and later.", "1.92.0"),
            ("Requires v1.82+", "1.82.0"),
            ("`cost_per_second` needs v1.105.0 or later. On earlier versions, use `input_cost_per_second`", "1.105.0"),
            ("Ships in `v1.106.0`. It landed on `main` after `v1.106.0-dev.3`.", "1.106.0"),
            ("Agent mode requires LiteLLM v1.97.0+, which translates the request shapes.", "1.97.0"),
            ("The mapping is available from v1.107.0 (first in `v1.107.0-rc.1`).", "1.107.0"),
            ("LiteLLM v1.85.0 or later is required.", "1.85.0"),
            ("LiteLLM v1.97.0+ strips a trailing `-fast` suffix from the model name.", "1.97.0"),
            ("The LiteLLM proxy v1.90.0 and later serves the route", "1.90.0"),
            ("| Gemini | v1.85.0+ |", "1.85.0"),
            ("Upgrade to v1.90.0 or later.", "1.90.0"),
            ("Bump to v1.90.0.", "1.90.0"),
            ("You need v1.90.0: earlier releases drop the header.", "1.90.0"),
            ("- A running [LiteLLM proxy](../proxy/docker_quick_start.md), **v1.81.14 or later**, with PostgreSQL", "1.81.14"),
            ("| Agent mode not working | Upgrade to LiteLLM v1.97.0+ and confirm the model supports custom API keys |", "1.97.0"),
            ("Agent mode is not working. Upgrade to LiteLLM v1.97.0+ to fix it.", "1.97.0"),
            ("| Supported from LiteLLM Version | `v1.51.4` |", "1.51.4"),
            ("| Agent mode not working | Requires v1.97.0 |", "1.97.0"),
        ):
            with self.subTest(line=line):
                errors = self.version_notes(f"# Page\n\n{line}\n")
                self.assertEqual([e[2] for e in errors], [3])
                self.assertIn(f'<SinceVersion v="{version}" />', errors[0][3])

    def test_badges_pass(self):
        self.assertEqual(self.version_notes('# Page\n\n<SinceVersion v="1.85.0" />\n'), [])
        self.assertEqual(self.version_notes('| Versions | <SinceVersion v="1.63.8" /> |\n'), [])
        self.assertEqual(self.version_notes("# Page\n\n<SinceVersion v={'1.85.0'} />\n"), [])

    def test_badge_without_a_release_version_is_rejected(self):
        for badge in ("<SinceVersion />", '<SinceVersion v="X.Y.Z" />', '<SinceVersion v="latest" />'):
            with self.subTest(badge=badge):
                errors = self.version_notes(f"# Page\n\n{badge}\n")
                self.assertEqual(len(errors), 1)
                self.assertIn("without a release version", errors[0][3])

    def test_a_badge_named_in_inline_code_is_not_a_badge(self):
        self.assertEqual(self.version_notes("# Page\n\nWrite `<SinceVersion />` with a version.\n"), [])

    def test_pages_rendered_as_plain_markdown_are_skipped(self):
        page = "---\ntitle: Page\nmdx:\n  format: md\n---\n\nThis requires LiteLLM v1.85.0\n"
        self.assertEqual(self.version_notes(page), [])
        self.assertEqual(len(self.version_notes(page.replace("format: md", "format: mdx"))), 1)

    def test_a_hand_written_note_beside_a_badge_is_still_rejected(self):
        errors = self.version_notes('| <SinceVersion v="1.63.8" /> | Gemini support requires 1.79.3+ |\n')
        self.assertEqual(len(errors), 1)
        self.assertIn('<SinceVersion v="1.79.3" />', errors[0][3])

    def test_lines_that_are_not_availability_notes_pass(self):
        for line in (
            "From v1.81.0 the request is set as attributes on the parent span.",
            "Available in v1.81.0 for every route that streams.",
            "Supported on Claude Code 2.1.0 and later.",
            ":::info[Versioning changed with the 1.84.0 release]",
            "{/* keep-version-note */} This requires LiteLLM v1.85.0",
            "Requires version 12.3.1 or later.",
            "Uses HTTP/2. Available in v1.103.0 for every provider. [Further docs](./server_tuning)",
            "Since v1.80.0, the proxy retries a 429 once.",
            "# Migration Guide - LiteLLM v1.0.0+",
            "Install the OpenAI SDK 1.30.0 or later.",
            "![Requires v1.85.0](./img/flow.png)",
            "Rows it wrote are found under the hashed key, the same way rows written since v1.99.0 are.",
        ):
            with self.subTest(line=line):
                self.assertEqual(self.version_notes(f"# Page\n\n{line}\n"), [])

    def test_removal_notes_are_not_rejected_as_availability(self):
        for line in (
            "No longer supported since v1.110.0.",
            "Not available in v1.110.0 and later.",
            "Works only up to v1.110.0.",
            "Deprecated since v1.110.0.",
            "Broken since v1.86.0.",
            "Streaming regressed in v1.86.0 and later.",
            "Fails on LiteLLM v1.86.0 and later.",
        ):
            with self.subTest(line=line):
                self.assertEqual(self.version_notes(f"# Page\n\n{line}\n"), [])

    def test_code_blocks_are_not_checked(self):
        self.assertEqual(self.version_notes("```bash\n# requires v1.85.0\npip install litellm\n```\n"), [])


class NewConfigRowTests(unittest.TestCase):
    BASE = "| Name | Type | Description |\n|---|---|---|\n| `store_model_in_db` | boolean | Stores models. |\n"

    def version_missing(self, head):
        with tempfile.TemporaryDirectory() as directory:
            settings = Path(directory) / checks.CONFIG_SETTINGS_PATH
            settings.parent.mkdir(parents=True)
            settings.write_text(self.BASE)
            git = ("git", "-C", directory, "-c", "user.name=t", "-c", "user.email=t@example.com")
            subprocess.run((*git, "init", "-q"), check=True)
            subprocess.run((*git, "add", "."), check=True)
            subprocess.run((*git, "commit", "-qm", "base"), check=True)
            settings.write_text(head)
            return checks.version_missing_errors("HEAD", repo_root=directory)

    def test_a_new_setting_without_a_badge_is_rejected(self):
        errors = self.version_missing(self.BASE + "| `request_body_limit_mb` | integer | Caps a request body. |\n")
        self.assertEqual([(e[0], e[2]) for e in errors], [("version-missing", 4)])
        self.assertIn("request_body_limit_mb", errors[0][3])

    def test_a_new_setting_with_a_badge_passes(self):
        row = '| `request_body_limit_mb` | integer | <SinceVersion v="1.108.0" /> Caps a request body. |\n'
        self.assertEqual(self.version_missing(self.BASE + row), [])

    def test_a_new_setting_with_the_suggested_placeholder_is_rejected(self):
        errors = self.version_missing(self.BASE + '| `request_body_limit_mb` | integer | <SinceVersion v="X.Y.Z" /> Caps. |\n')
        self.assertEqual([(e[0], e[2]) for e in errors], [("version-missing", 4)])
        self.assertIn('<SinceVersion v="X.Y.Z" />', errors[0][3])

    def test_an_unreadable_base_fails_instead_of_passing(self):
        with tempfile.TemporaryDirectory() as directory:
            settings = Path(directory) / checks.CONFIG_SETTINGS_PATH
            settings.parent.mkdir(parents=True)
            settings.write_text(self.BASE)
            subprocess.run(("git", "-C", directory, "init", "-q"), check=True)
            errors = checks.version_missing_errors("no-such-ref", repo_root=directory)
        self.assertEqual([e[0] for e in errors], ["version-missing"])

    def test_editing_an_existing_setting_needs_no_badge(self):
        self.assertEqual(self.version_missing(self.BASE.replace("Stores models.", "Stores models in the DB.")), [])


if __name__ == "__main__":
    unittest.main()
