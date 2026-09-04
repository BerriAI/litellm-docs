"""
Shared model-id matching for the docs tooling.

docs-models.json at the repo root is the source of truth for the model ids
that examples use:

  "current":  role -> the id examples should use today
  "retired":  id (or id with a trailing *) -> role it belongs to

Both scripts/bump-docs-models.py (rewrites retired ids) and
scripts/check-docs.py (the retired-model rule) match ids with the rules in
this module, so a rewrite and a lint finding always agree.

Matching rule. An id matches only at token boundaries. Id characters are
[A-Za-z0-9._:@-]. A key must be preceded by the start of the text or by a
character outside [A-Za-z0-9:@-], so `.` and `/` are boundaries
(`us.anthropic.claude-sonnet-4-5-20250929-v1:0` and `azure/gpt-4o` match)
while `-` and `:` are not (`gpt-4-fallback` and `ft:gpt-3.5-turbo` do not).
After the key the next character must be outside [A-Za-z0-9@-]; `.` and `:`
end a match only when not followed by a digit, so `gpt-5` does not match
inside `gpt-5.6-luna` and `claude-v2` does not match inside `claude-v2:1`,
but `gemini-2.5-flash` matches inside `gemini-2.5-flash:generateContent`.
A trailing `*` on a key swallows the rest of the token under the same rules.
Longer keys win, so `gpt-4o-mini` is matched before `gpt-4o`.

Run `python3 scripts/bump-docs-models.py --self-test` to check these rules.
"""

import json
import os
import re

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS_MODELS_PATH = os.path.join(REPO_ROOT, "docs-models.json")

_BEFORE = r"(?<![A-Za-z0-9:@-])"
_TAIL = r"(?:[A-Za-z0-9@-]|[.:](?=[0-9]))*"
_AFTER = r"(?![A-Za-z0-9@-]|[.:][0-9])"


class ModelMap:
    def __init__(self, data):
        self.current = dict(data["current"])
        self.retired = dict(data["retired"])
        for key, role in self.retired.items():
            if role not in self.current:
                raise ValueError(f"docs-models.json: retired id {key!r} maps to unknown role {role!r}")
        # Longest key first so gpt-4o-mini-2024-07-18 beats gpt-4o-mini beats gpt-4o.
        ordered = sorted(self.retired, key=lambda k: (-len(k.rstrip("*")), k))
        alternation = "|".join(self._key_pattern(k) for k in ordered)
        self._regex = re.compile(_BEFORE + "(?:" + alternation + ")" + _AFTER)
        self._by_key = {k.rstrip("*"): k for k in self.retired}

    @staticmethod
    def _key_pattern(key):
        if key.endswith("*"):
            return re.escape(key[:-1]) + _TAIL
        return re.escape(key)

    def finditer(self, text):
        """Yield (start, end, matched_text, key, replacement) for each retired id in text."""
        for m in self._regex.finditer(text):
            matched = m.group(0)
            key = self._key_for(matched)
            yield m.start(), m.end(), matched, key, self.current[self.retired[key]]

    def _key_for(self, matched):
        if matched in self._by_key:
            return self._by_key[matched]
        best = None
        for bare, key in self._by_key.items():
            if key.endswith("*") and matched.startswith(bare):
                if best is None or len(bare) > len(best[0]):
                    best = (bare, key)
        if best is None:  # pragma: no cover - the regex only matches listed keys
            raise KeyError(matched)
        return best[1]

    def replace(self, text):
        """Return (new_text, replacement_count)."""
        out = []
        last = 0
        n = 0
        for start, end, _, _, replacement in self.finditer(text):
            out.append(text[last:start])
            out.append(replacement)
            last = end
            n += 1
        out.append(text[last:])
        return "".join(out), n

    def replacement_for(self, key):
        return self.current[self.retired[key]]


def load(path=DOCS_MODELS_PATH):
    with open(path, encoding="utf-8") as f:
        return ModelMap(json.load(f))


def self_test():
    """Unit-style assertions for the matching rule. Raises AssertionError on failure."""
    mm = ModelMap({
        "current": {"small": "gpt-5.6-luna", "large": "gpt-5.6-terra", "anthropic": "claude-sonnet-5", "flash": "gemini-3.8-flash"},
        "retired": {
            "gpt-4o": "large", "gpt-4o-mini": "small", "gpt-4o-mini-2024-07-18": "small",
            "gpt-4": "large", "gpt-4.1": "large", "gpt-5": "large", "gpt-5.5": "large", "gpt-3.5-turbo": "small",
            "claude-sonnet-4-5*": "anthropic", "claude-v2": "anthropic", "claude-v2:1": "anthropic",
            "claude-3-5-sonnet-20241022": "anthropic", "gemini-2.5-flash": "flash",
        },
    })
    cases = [
        # plain ids and provider prefixes
        ('model="gpt-4o"', 'model="gpt-5.6-terra"'),
        ("azure/gpt-4o", "azure/gpt-5.6-terra"),
        ("openai/gpt-4o-mini", "openai/gpt-5.6-luna"),
        ("gpt-4o-mini-2024-07-18", "gpt-5.6-luna"),
        ("gpt-4o-mini, gpt-4o", "gpt-5.6-luna, gpt-5.6-terra"),
        # dots and slashes are boundaries
        ("us.anthropic.claude-sonnet-4-5-20250929-v1:0", "us.anthropic.claude-sonnet-5"),
        ("bedrock/anthropic.claude-sonnet-4-5-20250929-v1:0", "bedrock/anthropic.claude-sonnet-5"),
        ("vertex_ai/claude-sonnet-4-5@20250929", "vertex_ai/claude-sonnet-5"),
        ("claude-sonnet-4-5@20250929:rawPredict", "claude-sonnet-5:rawPredict"),
        ("models/gemini-2.5-flash:generateContent", "models/gemini-3.8-flash:generateContent"),
        ("The model gpt-4o.", "The model gpt-5.6-terra."),
        ("gpt-4o: value", "gpt-5.6-terra: value"),
        # dashes and colons before or after are not boundaries
        ("gpt-4-fallback", "gpt-4-fallback"),
        ("my-gpt-4o", "my-gpt-4o"),
        ("gpt-4o-batch", "gpt-4o-batch"),
        ("ft:gpt-3.5-turbo:my-org:id", "ft:gpt-3.5-turbo:my-org:id"),
        ("x-litellm-key-remaining-requests-gpt-4o", "x-litellm-key-remaining-requests-gpt-4o"),
        # a version dot or colon after the key is not a boundary
        ("gpt-5.6-luna", "gpt-5.6-luna"),
        ("gpt-5.6-terra", "gpt-5.6-terra"),
        ("gpt-4.1", "gpt-5.6-terra"),
        ("gpt-4.5-preview", "gpt-4.5-preview"),
        ("openai.gpt-5.5", "openai.gpt-5.6-terra"),
        ("gpt-5.5-mantle", "gpt-5.5-mantle"),
        ("anthropic.claude-v2:1", "anthropic.claude-sonnet-5"),
        ("anthropic.claude-v2", "anthropic.claude-sonnet-5"),
        ("claude-sonnet-4-5.", "claude-sonnet-5."),
        ("claude-sonnet-4.5", "claude-sonnet-4.5"),
        # exact keys do not extend into aliases; wildcard keys swallow the token
        ("claude-3-5-sonnet-20241022-v2:0", "claude-3-5-sonnet-20241022-v2:0"),
        ("claude-sonnet-4-5-with-vector-store", "claude-sonnet-5"),
        ("gpt-4o_prod", "gpt-5.6-terra_prod"),
    ]
    for text, expected in cases:
        got, _ = mm.replace(text)
        assert got == expected, f"{text!r}: expected {expected!r}, got {got!r}"
    found = [(m[2], m[4]) for m in mm.finditer("gpt-4o and gpt-4o-mini and gpt-4-fallback")]
    assert found == [("gpt-4o", "gpt-5.6-terra"), ("gpt-4o-mini", "gpt-5.6-luna")], found
    # the real data file loads, every role resolves, and no current id is itself retired
    real = load()
    for cur in real.current.values():
        assert real.replace(cur)[0] == cur, f"current id {cur} is matched as retired"
        assert real.replace("azure/" + cur + " x")[0] == "azure/" + cur + " x", cur
    for key in real.retired:
        bare = key.rstrip("*")
        new, n = real.replace(bare)
        assert n == 1 and new == real.replacement_for(key), (key, new, n)
    return len(cases) + 2 * len(real.current) + len(real.retired)
