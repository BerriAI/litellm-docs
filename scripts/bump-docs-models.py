#!/usr/bin/env python3
"""
Rewrite model ids in the docs after docs-models.json changes.

docs-models.json (repo root) maps a role to the id examples use today. Change
an id there and run this script: it compares the file with the last commit
(or --base REV) and rewrites every old id to the new one inside fenced code
blocks and inline backtick spans under the given paths. Pass --from OLD
--to NEW (repeatable, in pairs) to rewrite ids that are not in the file.

Skips fences marked `nolint` or `keep-model-ids`, markdown table rows (lines
starting with `|`), headings, and frontmatter. Prose outside backticks is
never touched. Prints a per-file replacement count. Running it twice changes
nothing the second time.

Inline spans in prose have no fence line to mark, so a prose line that must
keep an old id (a supported-model list, a note about one model) carries an
MDX comment: `{/* keep-model-ids */}` at the end of the line skips that line,
and `{/* keep-model-ids:start */}` ... `{/* keep-model-ids:end */}` on their
own lines skip the prose between them. Fences inside such a region still need
their own `keep-model-ids` token; the linter only looks at fence lines.

Usage:
  python3 scripts/bump-docs-models.py [paths...]              rewrite what changed since HEAD
  python3 scripts/bump-docs-models.py --base REV [paths...]   compare with another commit
  python3 scripts/bump-docs-models.py --from gpt-4o --to gpt-5.6-terra [paths...]
  python3 scripts/bump-docs-models.py --self-test             check the matching rule

The matching rule is documented in scripts/docs_models.py and shared with
the retired-model rule in scripts/check-docs.py.
"""

import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import docs_models  # noqa: E402

FENCE_RE = re.compile(r"^(\s*)(`{3,}|~{3,})\s*([^\s`{]*)\s*(.*)$")
INLINE_CODE_RE = re.compile(r"`[^`\n]*`")
SKIP_META = {"nolint", "keep-model-ids"}
PROSE_SKIP_RE = re.compile(r"\{/\*\s*keep-model-ids\s*\*/\}")
PROSE_START_RE = re.compile(r"\{/\*\s*keep-model-ids:start\s*\*/\}")
PROSE_END_RE = re.compile(r"\{/\*\s*keep-model-ids:end\s*\*/\}")
MD_EXTS = (".md", ".mdx")


def collect_files(target):
    if os.path.isfile(target):
        return [target] if target.endswith(MD_EXTS) else []
    out = []
    for root, dirs, files in os.walk(target):
        dirs[:] = [d for d in dirs if d != "node_modules" and not d.startswith(".")]
        for name in sorted(files):
            if name.endswith(MD_EXTS):
                out.append(os.path.join(root, name))
    return out


def rewrite_lines(lines, model_map):
    """Return (new_lines, replacement_count) for one file's lines."""
    out = []
    count = 0
    i = 0
    if lines and lines[0].strip() == "---":
        j = 1
        while j < len(lines) and lines[j].strip() != "---":
            j += 1
        out.extend(lines[: j + 1])
        i = j + 1
    fence = None  # (char, length, skip)
    in_keep_region = False
    while i < len(lines):
        line = lines[i]
        i += 1
        if fence is None:
            m = FENCE_RE.match(line)
            if m:
                marker = m.group(2)
                skip = bool(SKIP_META & set(m.group(4).split()))
                fence = (marker[0], len(marker), skip)
                out.append(line)
                continue
            if PROSE_START_RE.search(line):
                in_keep_region = True
            elif PROSE_END_RE.search(line):
                in_keep_region = False
            stripped = line.lstrip()
            if stripped.startswith(("|", "#")) or in_keep_region or PROSE_SKIP_RE.search(line):
                out.append(line)
                continue

            def sub(span):
                new, n = model_map.replace(span.group(0))
                nonlocal count
                count += n
                return new

            out.append(INLINE_CODE_RE.sub(sub, line))
        else:
            char, length, skip = fence
            stripped = line.strip()
            if stripped and set(stripped) == {char} and len(stripped) >= length:
                fence = None
                out.append(line)
            elif skip:
                out.append(line)
            else:
                new, n = model_map.replace(line)
                count += n
                out.append(new)
    return out, count


def bump_file(path, model_map):
    with open(path, encoding="utf-8") as f:
        text = f.read()
    lines = text.split("\n")
    new_lines, count = rewrite_lines(lines, model_map)
    if count:
        with open(path, "w", encoding="utf-8") as f:
            f.write("\n".join(new_lines))
    return count


SELF_TEST_INPUT = """---
title: gpt-4o page
---
# Heading about gpt-4o

Use `gpt-4o` or `gpt-4o-mini`; prose gpt-4o outside backticks stays.

| model | note |
| `gpt-4o` | table row |

- `gpt-4o` is the point {/* keep-model-ids */}

{/* keep-model-ids:start */}
- `gpt-4o`
- `gpt-4o-mini`
{/* keep-model-ids:end */}
- `gpt-4o` after the region

```yaml
model: gpt-4o
```

```yaml keep-model-ids
model: gpt-4o
```

```python title="a.py" nolint
model = "gpt-4o"
```
"""

SELF_TEST_EXPECTED = SELF_TEST_INPUT.replace(
    "Use `gpt-4o` or `gpt-4o-mini`; prose gpt-4o", "Use `gpt-5.6-terra` or `gpt-5.6-luna`; prose gpt-4o"
).replace("- `gpt-4o` after the region", "- `gpt-5.6-terra` after the region").replace(
    "```yaml\nmodel: gpt-4o", "```yaml\nmodel: gpt-5.6-terra"
)


def self_test():
    n = docs_models.self_test()
    model_map = docs_models.ModelMap({"gpt-4o": "gpt-5.6-terra", "gpt-4o-mini": "gpt-5.6-luna"})
    got, count = rewrite_lines(SELF_TEST_INPUT.split("\n"), model_map)
    got = "\n".join(got)
    assert got == SELF_TEST_EXPECTED, "rewrite_lines fixture mismatch:\n" + got
    assert count == 4, count
    again, count2 = rewrite_lines(got.split("\n"), model_map)
    assert count2 == 0 and "\n".join(again) == got
    return n + 4


def parse_args(argv):
    base = "HEAD"
    pairs = []
    roots = []
    pending_from = None
    it = iter(argv)
    for a in it:
        if a == "--base":
            base = next(it, None) or sys.exit("--base needs a revision")
        elif a == "--from":
            pending_from = next(it, None) or sys.exit("--from needs a model id")
        elif a == "--to":
            new = next(it, None) or sys.exit("--to needs a model id")
            if pending_from is None:
                sys.exit("--to must follow --from")
            pairs.append((pending_from, new))
            pending_from = None
        elif a.startswith("--"):
            sys.exit(f"unknown option {a}")
        else:
            roots.append(a)
    if pending_from is not None:
        sys.exit("--from needs a matching --to")
    return base, pairs, roots or ["docs"]


def main(argv):
    if "--self-test" in argv:
        n = self_test()
        print(f"docs-models matcher and rewriter: {n} assertions passed")
        return 0
    base, pairs, roots = parse_args(argv)
    mapping = dict(pairs)
    if not pairs:
        before = docs_models.current_at(base)
        if before is None:
            sys.exit(f"cannot read {docs_models.DOCS_MODELS_FILE} at {base}; pass --from/--to pairs instead")
        mapping = docs_models.diff_mapping(before, docs_models.load_current())
        if not mapping:
            print(f"{docs_models.DOCS_MODELS_FILE} is unchanged since {base}; nothing to rewrite")
            return 0
    for old, new in mapping.items():
        print(f"{old} -> {new}")
    model_map = docs_models.ModelMap(mapping)
    files = []
    for root in roots:
        files.extend(collect_files(root if os.path.isabs(root) else os.path.join(docs_models.REPO_ROOT, root)))
    total = 0
    changed = 0
    for path in files:
        n = bump_file(path, model_map)
        if n:
            print(f"{os.path.relpath(path, docs_models.REPO_ROOT)}: {n}")
            total += n
            changed += 1
    print(f"\n{total} replacement(s) in {changed} of {len(files)} files")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
