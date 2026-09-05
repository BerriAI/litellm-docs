"""
Shared model-id matching for the docs tooling.

docs-models.json at the repo root maps a role (openai_small, openai_large,
anthropic, anthropic_large, gemini_pro, gemini_flash) to the model id that
examples use today. There is no list of old ids: when a role changes, the
previous id is whatever the file said before, which git remembers.

  scripts/bump-docs-models.py  rewrites the ids that changed since the last
                               commit (or explicit --from/--to pairs)
  scripts/check-docs.py        the retired-model rule flags any id the file
                               held in an earlier commit but no longer does

Both use ModelMap, so a rewrite and a lint finding always agree.

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
import subprocess

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS_MODELS_FILE = "docs-models.json"
DOCS_MODELS_PATH = os.path.join(REPO_ROOT, DOCS_MODELS_FILE)

_BEFORE = r"(?<![A-Za-z0-9:@-])"
_TAIL = r"(?:[A-Za-z0-9@-]|[.:](?=[0-9]))*"
_AFTER = r"(?![A-Za-z0-9@-]|[.:][0-9])"


class ModelMap:
    """Rewrites old ids to new ones. `mapping` is {old id or old id with a trailing *: new id}."""

    def __init__(self, mapping):
        self.mapping = dict(mapping)
        # Longest key first so gpt-4o-mini-2024-07-18 beats gpt-4o-mini beats gpt-4o.
        ordered = sorted(self.mapping, key=lambda k: (-len(k.rstrip("*")), k))
        alternation = "|".join(self._key_pattern(k) for k in ordered) or r"(?!x)x"
        self._regex = re.compile(_BEFORE + "(?:" + alternation + ")" + _AFTER)
        self._by_key = {k.rstrip("*"): k for k in self.mapping}

    def __bool__(self):
        return bool(self.mapping)

    @staticmethod
    def _key_pattern(key):
        if key.endswith("*"):
            return re.escape(key[:-1]) + _TAIL
        return re.escape(key)

    def finditer(self, text):
        """Yield (start, end, matched_text, key, replacement) for each old id in text."""
        for m in self._regex.finditer(text):
            matched = m.group(0)
            key = self._key_for(matched)
            yield m.start(), m.end(), matched, key, self.mapping[key]

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


def _roles(data):
    # Accept the current flat shape and the earlier {"current": {...}} shape found in history.
    if isinstance(data, dict) and isinstance(data.get("current"), dict):
        data = data["current"]
    if not isinstance(data, dict) or not all(isinstance(v, str) for v in data.values()):
        raise ValueError(f"{DOCS_MODELS_FILE}: expected an object of role -> model id")
    return dict(data)


def load_current(path=DOCS_MODELS_PATH):
    with open(path, encoding="utf-8") as f:
        return _roles(json.load(f))


def _git(*args):
    try:
        return subprocess.run(
            ["git", *args], cwd=REPO_ROOT, capture_output=True, text=True, check=True
        ).stdout
    except (OSError, subprocess.CalledProcessError):
        return None


def current_at(rev="HEAD"):
    """Roles as committed at `rev`, or None if git or the file is unavailable there."""
    out = _git("show", f"{rev}:{DOCS_MODELS_FILE}")
    if out is None:
        return None
    try:
        return _roles(json.loads(out))
    except ValueError:
        return None


def diff_mapping(before, after):
    """{old id: new id} for every role whose id changed between two role maps."""
    return {
        before[role]: after[role]
        for role in after
        if role in before and before[role] != after[role]
    }


def history_mapping(current=None):
    """{old id: current id} for every id docs-models.json held in an earlier commit.

    Empty when git history is unavailable (no git, a shallow clone without the
    file's history) so the retired-model rule then checks nothing.
    """
    current = current if current is not None else load_current()
    log = _git("log", "--format=%H", "--", DOCS_MODELS_FILE)
    if not log:
        return {}
    mapping = {}
    current_ids = set(current.values())
    for sha in log.split():
        roles = current_at(sha)
        if not roles:
            continue
        for role, old in roles.items():
            if role in current and old not in current_ids and old not in mapping:
                mapping[old] = current[role]
    return mapping


def self_test():
    """Unit-style assertions for the matching rule. Raises AssertionError on failure."""
    mm = ModelMap({
        "gpt-4o": "gpt-5.6-terra", "gpt-4o-mini": "gpt-5.6-luna", "gpt-4o-mini-2024-07-18": "gpt-5.6-luna",
        "gpt-4": "gpt-5.6-terra", "gpt-4.1": "gpt-5.6-terra", "gpt-5": "gpt-5.6-terra", "gpt-5.5": "gpt-5.6-terra",
        "gpt-3.5-turbo": "gpt-5.6-luna",
        "claude-sonnet-4-5*": "claude-sonnet-5", "claude-v2": "claude-sonnet-5", "claude-v2:1": "claude-sonnet-5",
        "claude-3-5-sonnet-20241022": "claude-sonnet-5", "gemini-2.5-flash": "gemini-3.8-flash",
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
    # an empty map matches nothing
    empty = ModelMap({})
    assert not empty and empty.replace("gpt-4o")[0] == "gpt-4o"
    # diffing two versions of the file yields old -> new per role
    before = {"openai_small": "gpt-4o-mini", "openai_large": "gpt-4o", "anthropic": "claude-sonnet-5"}
    after = {"openai_small": "gpt-5.6-luna", "openai_large": "gpt-4o", "anthropic": "claude-sonnet-5"}
    assert diff_mapping(before, after) == {"gpt-4o-mini": "gpt-5.6-luna"}
    assert _roles({"current": before}) == before
    # the real file loads and none of its ids is rewritten by its own history
    real = load_current()
    assert real, "docs-models.json has no roles"
    hist = ModelMap(history_mapping(real))
    for cur in real.values():
        assert hist.replace(cur)[0] == cur, f"current id {cur} is matched as retired"
    return len(cases) + 4 + len(real)
