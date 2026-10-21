"""Regression tests for the version-note rule in check-docs.py."""
import importlib.util
from pathlib import Path
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
        ):
            with self.subTest(line=line):
                errors = self.version_notes(f"# Page\n\n{line}\n")
                self.assertEqual([e[2] for e in errors], [3])
                self.assertIn(f'<SinceVersion v="{version}" />', errors[0][3])

    def test_badges_pass(self):
        self.assertEqual(self.version_notes('# Page\n\n<SinceVersion v="1.85.0" />\n'), [])
        self.assertEqual(self.version_notes('| Versions | <SinceVersion v="1.63.8" /> |\n'), [])
        self.assertEqual(self.version_notes("# Page\n\n<SinceVersion v={'1.85.0'} />\n"), [])

    def test_badge_without_a_version_is_rejected(self):
        errors = self.version_notes("# Page\n\n<SinceVersion />\n")
        self.assertEqual(len(errors), 1)
        self.assertIn("without a `v` prop", errors[0][3])

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
        ):
            with self.subTest(line=line):
                self.assertEqual(self.version_notes(f"# Page\n\n{line}\n"), [])

    def test_removal_notes_are_not_rejected_as_availability(self):
        for line in (
            "No longer supported since v1.110.0.",
            "Not available in v1.110.0 and later.",
            "Works only up to v1.110.0.",
            "Deprecated since v1.110.0.",
        ):
            with self.subTest(line=line):
                self.assertEqual(self.version_notes(f"# Page\n\n{line}\n"), [])

    def test_code_blocks_are_not_checked(self):
        self.assertEqual(self.version_notes("```bash\n# requires v1.85.0\npip install litellm\n```\n"), [])


if __name__ == "__main__":
    unittest.main()
