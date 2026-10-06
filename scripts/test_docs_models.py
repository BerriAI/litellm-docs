"""Regression tests for model-default linting; no model API calls required."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("check_docs", ROOT / "scripts/check-docs.py")
checks = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checks)


class ModelDefaultsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.site = checks.Site()

    def errors(self, text):
        with tempfile.TemporaryDirectory(dir=ROOT) as directory:
            path = Path(directory) / "example.md"
            path.write_text(text)
            return checks.check_page(checks.Page(str(path)), self.site, {})

    def test_old_chatgpt_examples_are_rejected(self):
        for model in ("gpt-5.4", "gpt-5.4-pro", "gpt-5.3-codex",
                      "gpt-5.3-codex-spark", "gpt-5.3-instant", "gpt-5.3-chat-latest"):
            with self.subTest(model=model):
                errors = self.errors(f'```python\nmodel = "chatgpt/{model}"\n```\n')
                self.assertEqual([e[0] for e in errors], ["model-literal"])
                self.assertIn(f"chatgpt/{model}", errors[0][3])

    def test_unknown_chatgpt_literal_is_rejected_without_history(self):
        errors = self.errors('```yaml\nmodel: chatgpt/future-model\n```\n')
        self.assertEqual([e[0] for e in errors], ["model-literal"])

    def test_token_file_paths_are_not_models(self):
        for path in ("/tokens/chatgpt/auth.json", "$HOME/.config/litellm/chatgpt/auth.json"):
            with self.subTest(path=path):
                self.assertEqual(self.errors(f'```bash\ncp {path} /destination/auth.json\n```\n'), [])

    def test_historical_default_is_rejected(self):
        self.assertNotIn("gpt-5.4-mini", checks.ROLE_TO_ID.values())
        errors = self.errors('```json\n{"model": "openai/gpt-5.4-mini"}\n```\n')
        self.assertEqual([e[0] for e in errors], ["model-literal"])
        self.assertIn("{{openai_small}}", errors[0][3])

    def test_current_default_is_rejected(self):
        model = checks.ROLE_TO_ID["openai_small"]
        self.assertEqual(self.errors(f'```toml\nmodel = "{model}"\n```\n')[0][0], "model-literal")

    def test_placeholders_and_prompt_templates_pass(self):
        self.assertEqual(self.errors('```python\nmodel = "chatgpt/{{chatgpt}}"\nprompt = "{{user_input}}"\n```\n'), [])
        self.assertEqual(self.errors('```yaml\nmodel: chatgpt/{{chatgpt_small}}\n```\n'), [])

    def test_unknown_chatgpt_role_is_rejected(self):
        self.assertEqual(self.errors('```yaml\nmodel: chatgpt/{{chatgpt_smal}}\n```\n')[0][0], "model-role-unknown")

    def test_explicit_pins_and_nolint_remain_supported(self):
        for meta in ("keep-model-ids", "nolint"):
            with self.subTest(meta=meta):
                self.assertEqual(self.errors(f'```yaml {meta}\nmodel: chatgpt/gpt-5.4\n```\n'), [])

    def test_alias_and_snapshot_boundaries_remain_supported(self):
        for model in ("my-gpt-5.4-mini", "gpt-5.4-mini-custom", "gpt-5.4-mini-2026-01-01"):
            with self.subTest(model=model):
                self.assertEqual(self.errors(f'```yaml\nmodel: {model}\n```\n'), [])

    def test_provider_facts_outside_fences_stay_literal(self):
        self.assertEqual(self.errors('| Model |\n| --- |\n| `gpt-5.4-mini` |\n'), [])

    def test_substitution_uses_defaults_not_history(self):
        self.assertEqual(checks.substitute_models("chatgpt/{{chatgpt}}"), "chatgpt/" + checks.ROLE_TO_ID["chatgpt"])
        self.assertEqual(checks.substitute_models("gpt-5.4-mini {{user_input}}"), "gpt-5.4-mini {{user_input}}")

    def test_bump_requires_recording_new_default(self):
        bumped = dict(checks.ROLE_TO_ID, openai_small="future-default")
        real_open = open

        def read_bumped(path, *args, **kwargs):
            if Path(path) == ROOT / "docs-models.json":
                import io
                return io.StringIO(json.dumps(bumped))
            return real_open(path, *args, **kwargs)

        with patch("builtins.open", side_effect=read_bumped):
            with self.assertRaisesRegex(ValueError, "Record future-default"):
                spec.loader.exec_module(importlib.util.module_from_spec(spec))


if __name__ == "__main__":
    unittest.main()
