#!/usr/bin/env python3
"""
Structural checks for LiteLLM docs.

Every check here is deterministic and fails the build:

  fence-unclosed      a ``` fence that is never closed (the rest of the page renders as code)
  fence-info          unexpected text on the ``` line (code written there is silently dropped)
  yaml-invalid        a ```yaml block that PyYAML cannot parse
  json-invalid        a ```json block that is not valid JSON or JSON Lines (comments, `...`, and object fragments are tolerated)
  python-invalid      a ```python block that does not compile with ast.parse
  bash-comment        a comment after, or on a line between, backslash line continuations in a shell block
  link-missing        a relative or /docs/ link whose target page does not exist
  anchor-missing      a link to a page whose heading anchor does not exist
  image-missing       a require(), ![]() or src= image path that does not exist
  github-alert        a GitHub-style "> [!NOTE]" alert, which Docusaurus renders as a plain quote
  multiple-h1         more than one H1 in a page
  model-literal       a fenced block hardcodes a model id from docs-models.json instead of its {{role}} placeholder
  python-literal      a Python version is written out (python3.12, python:3.12-slim, python=3.12, Python 3.12+) instead of {{python_version}} or {{python_min_version}}
  model-role-unknown  a {{placeholder}} that looks like a docs-models.json role but is not one, which the build would print literally

Usage:
  python3 scripts/check-docs.py [paths...]      defaults to docs/

Add `nolint` to a fence's info string (```yaml nolint) to skip parsing a
block that is intentionally a fragment.

Model ids in examples are `{{role}}` placeholders filled from docs-models.json
at build time (src/remark/docs-models.js). This script applies the same
substitution before parsing a block, and the model-literal rule fails a block
that writes the current id itself, because that block would not follow the
next bump. Add `keep-model-ids` to the fence line when the exact id is the
point of the block (a price map key, a cache key, a printed log).

The Python version examples use ({{python_version}}, the interpreter in the
official Docker image) and the lowest version LiteLLM supports
({{python_min_version}}, the pyproject floor) come from the same file, and the
python-literal rule fails a fence or prose line that spells a version out.
Add `keep-python-version` to the fence line, or a `{/* keep-python-version */}`
comment on the prose line, when one specific version is the point (a bug in
one interpreter, a third-party requirement, a historical commit message).
A placeholder that looks like a role but is not one (a typo, or a role removed
from docs-models.json) fails model-role-unknown, since the build would print it
as written.

Requires PyYAML (pip install pyyaml).
"""

import ast
import json
import os
import re
import sys
import textwrap

try:
    import yaml
except ImportError:  # pragma: no cover
    print("PyYAML is required: pip install pyyaml", file=sys.stderr)
    sys.exit(2)

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS_ROOT = os.path.join(REPO_ROOT, "docs")
STATIC_ROOT = os.path.join(REPO_ROOT, "static")

FENCE_RE = re.compile(r"^(\s*)(`{3,}|~{3,})\s*([^\s`{]*)\s*(.*)$")
FRONTMATTER_DELIM = "---"
HEADING_RE = re.compile(r"^(#{1,6})\s+(.*?)\s*#*\s*$")
CUSTOM_ID_RE = re.compile(r"\s*\{#([^}]+)\}\s*$")
HTML_ID_RE = re.compile(r"""(?:\sid|\sname)=["']([^"']+)["']""")
INLINE_CODE_RE = re.compile(r"`[^`\n]*`")
MD_LINK_RE = re.compile(r"(?<!!)\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+\"[^\"]*\")?\s*\)")
HREF_RE = re.compile(r"""href=["']([^"']+)["']""")
MD_IMAGE_RE = re.compile(r"!\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+\"[^\"]*\")?\s*\)")
REQUIRE_RE = re.compile(r"""require\(\s*["']([^"']+)["']\s*\)""")
SRC_RE = re.compile(r"""\bsrc=["']([^"'{]+)["']""")
USE_BASE_URL_RE = re.compile(r"""useBaseUrl\(\s*["']([^"']+)["']\s*\)""")
GITHUB_ALERT_RE = re.compile(r"^\s*>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]", re.I)
BASH_CONTINUATION_COMMENT_RE = re.compile(r"\\\s+#")
REDIRECT_FROM_RE = re.compile(r"""from:\s*["']([^"']+)["']""")
SIDEBAR_SLUG_RE = re.compile(r"""slug:\s*["']([^"']+)["']""")

YAML_LANGS = {"yaml", "yml"}
JSON_LANGS = {"json"}
PYTHON_LANGS = {"python", "py"}
SHELL_LANGS = {"bash", "shell", "sh", "zsh", "curl"}
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


class Page:
    """A parsed markdown file: fences split out, prose lines kept with line numbers."""

    def __init__(self, path):
        self.path = path
        with open(path, encoding="utf-8") as f:
            self.lines = f.read().split("\n")
        self.frontmatter = {}
        self.blocks = []  # (lang, meta, start_line, [lines])
        self.prose = []  # (line_no, text) outside fences and frontmatter
        self.unclosed_fence_line = None
        self._parse()

    def _parse(self):
        lines = self.lines
        i = 0
        # Frontmatter
        if lines and lines[0].strip() == FRONTMATTER_DELIM:
            j = 1
            while j < len(lines) and lines[j].strip() != FRONTMATTER_DELIM:
                m = re.match(r"^([A-Za-z_][\w-]*):\s*(.*)$", lines[j])
                if m:
                    self.frontmatter[m.group(1)] = m.group(2).strip().strip("\"'")
                j += 1
            i = j + 1
        in_fence = None  # (char, length, lang, meta, start_line, buf)
        while i < len(lines):
            line = lines[i]
            if in_fence is None:
                m = FENCE_RE.match(line)
                if m:
                    marker = m.group(2)
                    in_fence = (marker[0], len(marker), m.group(3).lower(), m.group(4), i + 1, [])
                else:
                    self.prose.append((i + 1, line))
            else:
                char, length, lang, meta, start, buf = in_fence
                stripped = line.strip()
                if stripped and set(stripped) == {char} and len(stripped) >= length:
                    self.blocks.append((lang, meta, start, buf))
                    in_fence = None
                else:
                    buf.append(line)
            i += 1
        if in_fence is not None:
            self.unclosed_fence_line = in_fence[4]
            self.blocks.append((in_fence[2], in_fence[3], in_fence[4], in_fence[5]))

    def headings(self):
        out = []
        for _, text in self.prose:
            # headings inside blockquotes still get anchors
            m = HEADING_RE.match(re.sub(r"^\s*(>\s*)+", "", text))
            if m:
                out.append(m.group(2))
        return out

    def anchor_ids(self):
        """All anchors a link could target: heading slugs (github-slugger style,
        with duplicate suffixes), explicit {#id}, and HTML id= attributes."""
        ids = set()
        seen = {}
        for text in self.headings():
            m = CUSTOM_ID_RE.search(text)
            if m:
                ids.add(m.group(1))
                text = CUSTOM_ID_RE.sub("", text)
            base = slugify(text)
            n = seen.get(base, 0)
            seen[base] = n + 1
            ids.add(base if n == 0 else f"{base}-{n}")
        for _, text in self.prose:
            for m in HTML_ID_RE.finditer(text):
                ids.add(m.group(1))
        return ids


def slugify(text):
    """Approximation of github-slugger: lowercase, strip markdown/inline code
    markers and punctuation, spaces to hyphens."""
    text = re.sub(r"<[^>]+>", "", text)  # inline JSX/HTML
    text = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", text)  # links
    text = text.replace("`", "").replace("*", "").replace("_", "_")
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text, flags=re.UNICODE)
    text = re.sub(r"\s", "-", text)
    return text


def loose(anchor):
    return re.sub(r"[^a-z0-9]", "", anchor.lower())


class Site:
    """Route and file maps so absolute /docs/ links can be resolved."""

    def __init__(self):
        self.route_to_file = {}
        self.extra_routes = set()
        for path in collect_files(DOCS_ROOT):
            rel = os.path.relpath(path, DOCS_ROOT)
            base, _ = os.path.splitext(rel)
            page = Page(path)
            parts = base.split(os.sep)
            if "id" in page.frontmatter:
                parts[-1] = page.frontmatter["id"]
            # index.md, README.md and folder/folder.md all become the folder route
            if parts[-1] in ("index", "readme") or (len(parts) > 1 and parts[-1] == parts[-2]):
                parts = parts[:-1]
            route = "/docs/" + "/".join(parts) if parts else "/docs"
            self.route_to_file[route.rstrip("/")] = path
            slug = page.frontmatter.get("slug")
            if slug:
                if slug.startswith("/"):
                    slug_route = "/docs" + slug
                else:
                    slug_route = "/docs/" + "/".join(parts[:-1] + [slug]) if len(parts) > 1 else "/docs/" + slug
                self.route_to_file[slug_route.rstrip("/")] = path
        config = os.path.join(REPO_ROOT, "docusaurus.config.js")
        if os.path.exists(config):
            with open(config, encoding="utf-8") as f:
                for m in REDIRECT_FROM_RE.finditer(f.read()):
                    self.extra_routes.add(m.group(1).rstrip("/"))
        sidebars = os.path.join(REPO_ROOT, "sidebars.js")
        if os.path.exists(sidebars):
            with open(sidebars, encoding="utf-8") as f:
                for m in SIDEBAR_SLUG_RE.finditer(f.read()):
                    slug = m.group(1)
                    self.extra_routes.add(("/docs" + slug if slug.startswith("/") else "/docs/" + slug).rstrip("/"))

    def resolve_route(self, route):
        route = route.rstrip("/") or "/docs"
        if route in self.route_to_file:
            return self.route_to_file[route], True
        if route in self.extra_routes:
            return None, True
        return None, False


def resolve_relative(from_path, target):
    base_dir = os.path.dirname(from_path)
    candidate = os.path.normpath(os.path.join(base_dir, target))
    folder = os.path.basename(candidate)
    for cand in (
        candidate,
        candidate + ".md",
        candidate + ".mdx",
        os.path.join(candidate, "index.md"),
        os.path.join(candidate, "index.mdx"),
        os.path.join(candidate, folder + ".md"),
        os.path.join(candidate, folder + ".mdx"),
    ):
        if os.path.isfile(cand):
            return cand
    return None


def resolve_absolute_markdown(target):
    """Docusaurus resolves /path/to/file.md against the site dir and the docs dir."""
    for root in (REPO_ROOT, DOCS_ROOT):
        cand = os.path.normpath(os.path.join(root, target.lstrip("/")))
        if os.path.isfile(cand):
            return cand
    return None


def route_for_relative(from_path, target):
    """The /docs route a relative, extensionless link lands on when it is not a file."""
    rel_dir = os.path.relpath(os.path.dirname(from_path), DOCS_ROOT)
    joined = os.path.normpath(os.path.join(rel_dir, target))
    if joined.startswith(".."):
        return None
    return ("/docs/" + joined.replace(os.sep, "/")).rstrip("/") if joined != "." else "/docs"


def resolve_asset(from_path, target):
    if target.startswith("@site/"):
        candidate = os.path.join(REPO_ROOT, target[len("@site/"):])
    elif target.startswith("/"):
        candidate = os.path.join(STATIC_ROOT, target.lstrip("/"))
    else:
        candidate = os.path.normpath(os.path.join(os.path.dirname(from_path), target))
    return os.path.isfile(candidate)


def is_external(target):
    return target.startswith(("http://", "https://", "mailto:", "tel:", "data:", "{", "$", "javascript:"))


def strip_inline_code(text):
    return INLINE_CODE_RE.sub("", text)


def check_page(page, site, page_cache):
    errors = []
    rel = os.path.relpath(page.path, REPO_ROOT)

    def err(rule, line_no, message):
        errors.append((rule, rel, line_no, message))

    if page.unclosed_fence_line:
        err("fence-unclosed", page.unclosed_fence_line, "code fence is never closed")

    for line_no, raw in enumerate(page.lines, 1):
        for name in unknown_model_roles(raw):
            err("model-role-unknown", line_no, f"unknown model placeholder `{{{{{name}}}}}`; docs-models.json defines {', '.join(sorted(ROLE_TO_ID))}")

    for lang, meta, start, buf in page.blocks:
        unknown_meta = [t for t in split_meta(meta) if not is_known_meta(t)]
        if unknown_meta:
            err("fence-info", start, f"unexpected text on the fence line: {' '.join(unknown_meta)!r} (code on the ``` line is dropped)")
        meta_tokens = meta.split()
        if "nolint" in meta_tokens:
            continue
        if "keep-model-ids" not in meta_tokens:
            seen_ids = set()
            for offset, l in enumerate(buf):
                for m in MODEL_LITERAL_RE.finditer(l):
                    if m.group(0) in seen_ids:
                        continue
                    seen_ids.add(m.group(0))
                    err("model-literal", start + offset + 1, f"hardcoded model id `{m.group(0)}`; write `{{{{{MODEL_ROLES[m.group(0)]}}}}}` so docs-models.json controls it, or add keep-model-ids if the exact id is the point")
        if "keep-python-version" not in meta_tokens:
            for offset, l in enumerate(buf):
                m = PYTHON_LITERAL_RE.search(l)
                if m:
                    err("python-literal", start + offset + 1, python_literal_message(m.group(0)))
        content = textwrap.dedent(substitute_models("\n".join(buf)))
        if lang in YAML_LANGS:
            try:
                list(yaml.safe_load_all(content))
            except yaml.YAMLError as e:
                mark = getattr(e, "problem_mark", None)
                line_no = start + mark.line + 1 if mark is not None else start
                err("yaml-invalid", line_no, f"YAML does not parse: {summarize_yaml_error(e)}")
        elif lang in JSON_LANGS:
            if not valid_json(content):
                err("json-invalid", start, "JSON does not parse (comments, `...`, and object fragments are tolerated; trailing commas, unquoted placeholders, and non-JSON text are not)")
        elif lang in PYTHON_LANGS:
            if any(l.lstrip().startswith(">>>") for l in buf):
                continue
            try:
                ast.parse(content)
            except SyntaxError as e:
                err("python-invalid", start + (e.lineno or 1), f"Python does not compile: {e.msg}")
        elif lang in SHELL_LANGS:
            previous_continues = False
            for offset, l in enumerate(buf):
                if BASH_CONTINUATION_COMMENT_RE.search(l):
                    err("bash-comment", start + offset + 1, "comment after line-continuation backslash breaks the command")
                elif previous_continues and l.lstrip().startswith("#"):
                    err("bash-comment", start + offset + 1, "comment line inside a backslash-continued command breaks it; move it above the command")
                if l.strip():
                    previous_continues = l.rstrip().endswith("\\")

    h1_lines = [ln for ln, text in page.prose if re.match(r"^#\s+\S", text)]
    if len(h1_lines) > 1:
        err("multiple-h1", h1_lines[1], f"page has {len(h1_lines)} H1 headings (first at line {h1_lines[0]})")

    own_anchors = None
    for line_no, raw in page.prose:
        if GITHUB_ALERT_RE.match(raw):
            err("github-alert", line_no, "GitHub-style alert does not render in Docusaurus; use :::note / :::warning")
        if "keep-python-version" not in raw:
            m = PYTHON_LITERAL_RE.search(raw)
            if m:
                err("python-literal", line_no, python_literal_message(m.group(0)))
        text = strip_inline_code(raw)
        targets = [m.group(1) for m in MD_LINK_RE.finditer(text)] + [m.group(1) for m in HREF_RE.finditer(text)]
        for target in targets:
            if is_external(target):
                continue
            path_part, _, anchor = target.partition("#")
            target_file = None
            if path_part == "":
                target_file = page.path
            elif path_part.startswith("/") and path_part.lower().endswith(MD_EXTS):
                target_file = resolve_absolute_markdown(path_part)
                if target_file is None:
                    err("link-missing", line_no, f"{path_part} does not resolve to a file")
                    continue
            elif path_part.startswith("/docs"):
                target_file, ok = site.resolve_route(path_part)
                if not ok:
                    err("link-missing", line_no, f"no page for route {path_part}")
                    continue
            elif path_part.startswith("/"):
                continue  # non-docs routes (release notes, static pages) are out of scope
            else:
                target_file = resolve_relative(page.path, path_part)
                if target_file is None:
                    route = route_for_relative(page.path, path_part)
                    _, ok = site.resolve_route(route) if route else (None, False)
                    if not ok:
                        err("link-missing", line_no, f"{path_part} does not resolve to a file or route")
                    continue
            if anchor and target_file:
                if target_file == page.path:
                    if own_anchors is None:
                        own_anchors = page.anchor_ids()
                    anchors = own_anchors
                else:
                    if target_file not in page_cache:
                        page_cache[target_file] = Page(target_file)
                    anchors = page_cache[target_file].anchor_ids()
                if anchor not in anchors and loose(anchor) not in {loose(a) for a in anchors}:
                    err("anchor-missing", line_no, f"#{anchor} not found in {os.path.relpath(target_file, REPO_ROOT)}")

        assets = (
            [m.group(1) for m in MD_IMAGE_RE.finditer(text)]
            + [m.group(1) for m in REQUIRE_RE.finditer(raw)]
            + [m.group(1) for m in SRC_RE.finditer(raw)]
            + [m.group(1) for m in USE_BASE_URL_RE.finditer(raw)]
        )
        for target in assets:
            if is_external(target) or target.startswith("//"):
                continue
            if not resolve_asset(page.path, target):
                err("image-missing", line_no, f"{target} does not exist")

    return errors


KNOWN_META_RE = re.compile(r"^(showLineNumbers|nolint|keep-model-ids|keep-python-version|live|noInline|title=\S+|mode=\S+|\{[\d,\s-]+\})$")


def load_roles():
    """{role: value} from docs-models.json, the file src/remark/docs-models.js reads."""
    with open(os.path.join(REPO_ROOT, "docs-models.json"), encoding="utf-8") as f:
        return json.load(f)


ROLE_TO_ID = load_roles()
PYTHON_ROLES = {"python_version", "python_min_version"}
# {model id: role}. The Python roles hold bare version numbers, which get their own rule below.
MODEL_ROLES = {model_id: role for role, model_id in ROLE_TO_ID.items() if role not in PYTHON_ROLES}
MODEL_TOKEN_RE = re.compile(r"\{\{\s*([A-Za-z0-9_]+)\s*\}\}")
# A hardcoded id counts only as a whole token: `.` and `/` before it are boundaries
# (azure/gpt-5.6-luna, us.anthropic.claude-sonnet-5) but `-` and `:` are not, so an
# alias such as bedrock-claude-sonnet-5 or a header name is left alone.
MODEL_LITERAL_RE = re.compile(
    r"(?<![A-Za-z0-9:@-])(?:" + "|".join(re.escape(i) for i in sorted(MODEL_ROLES, key=len, reverse=True)) + r")(?![A-Za-z0-9@-]|[.:][0-9])"
) if MODEL_ROLES else re.compile(r"(?!x)x")
# python3.12, python-3.12, python:3.12-slim, python=3.12 (conda), python@3.12 (homebrew) and Python 3.12+;
# `python3 -m venv` and wheel tags such as cp312 are not versions.
PYTHON_LITERAL_RE = re.compile(r"(?<![A-Za-z0-9.])[Pp]ython[-:=@_ ]?3\.\d{1,2}(?![0-9])")


def python_literal_message(literal):
    return (
        f"hardcoded Python version `{literal}`; write `{{{{python_version}}}}` (the version examples use) or "
        f"`{{{{python_min_version}}}}` (the lowest version LiteLLM supports) so docs-models.json controls it, "
        "or add keep-python-version if this exact version is the point"
    )


def substitute_models(text):
    """Fill {{role}} placeholders the way the site build does; other {{tokens}} are left alone."""
    return MODEL_TOKEN_RE.sub(lambda m: ROLE_TO_ID.get(m.group(1), m.group(0)), text)


ROLE_PREFIXES = frozenset(role.split("_", 1)[0] for role in ROLE_TO_ID)


def unknown_model_roles(text):
    return [
        m.group(1)
        for m in MODEL_TOKEN_RE.finditer(text)
        if m.group(1) not in ROLE_TO_ID and m.group(1).split("_", 1)[0] in ROLE_PREFIXES
    ]


def split_meta(meta):
    """Tokens on the fence info line, keeping title="a b.py" as one token."""
    meta = re.sub(r'title="[^"]*"', "title=X", meta)
    meta = re.sub(r"title='[^']*'", "title=X", meta)
    return meta.split()


def is_known_meta(token):
    return bool(KNOWN_META_RE.match(token))


def normalize_json(content):
    """Remove // and # comments outside string literals, and turn a bare `...`
    placeholder into a valid value so truncated response examples still parse."""
    out = []
    stack = []
    in_string = False
    escaped = False
    i = 0
    n = len(content)
    while i < n:
        ch = content[i]
        if in_string:
            out.append(ch)
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == '"':
                in_string = False
            i += 1
            continue
        if ch == '"':
            in_string = True
            out.append(ch)
            i += 1
        elif ch == "#" or content.startswith("//", i):
            while i < n and content[i] != "\n":
                i += 1
        elif content.startswith("...", i):
            prev = "".join(out).rstrip()
            in_value_position = prev.endswith(":") or (stack and stack[-1] == "[")
            out.append("null" if in_value_position else '"...": null')
            i += 3
            # `...` at the top of an object or array, followed by more members
            # on the next line, needs the comma the author left out.
            rest = content[i:].lstrip()
            if rest and rest[0] not in ",]}":
                out.append(",")
        else:
            if ch in "[{":
                stack.append(ch)
            elif ch in "]}" and stack:
                stack.pop()
            out.append(ch)
            i += 1
    return "".join(out)


def valid_json(content):
    content = normalize_json(content)
    try:
        json.loads(content)
        return True
    except ValueError:
        pass
    # A fragment of a larger object: `"key": {...}, "other": [...]` without the
    # enclosing braces. Common when a page shows one field of a response.
    stripped = content.strip().rstrip(",")
    if stripped.startswith('"'):
        try:
            json.loads("{" + stripped + "}")
            return True
        except ValueError:
            pass
    lines = [l for l in content.split("\n") if l.strip()]
    if not lines:
        return True
    try:
        for l in lines:
            json.loads(l)
        return True
    except ValueError:
        return False


def summarize_yaml_error(e):
    mark = getattr(e, "problem_mark", None)
    problem = getattr(e, "problem", None) or str(e).split("\n")[0]
    if mark is not None:
        return f"{problem} (block line {mark.line + 1})"
    return problem


def main(argv):
    roots = [a for a in argv if not a.startswith("--")] or ["docs"]
    files = []
    for root in roots:
        files.extend(collect_files(os.path.join(REPO_ROOT, root) if not os.path.isabs(root) else root))
    site = Site()
    page_cache = {}
    all_errors = []
    for path in files:
        page = page_cache.get(path) or Page(path)
        page_cache[path] = page
        all_errors.extend(check_page(page, site, page_cache))

    by_rule = {}
    for rule, rel, line_no, message in all_errors:
        by_rule.setdefault(rule, []).append((rel, line_no, message))
    for rule in sorted(by_rule):
        items = by_rule[rule]
        print(f"\n{rule} ({len(items)}):")
        for rel, line_no, message in sorted(items):
            print(f"  {rel}:{line_no}  {message}")
    print(f"\nChecked {len(files)} markdown files in: {', '.join(roots)}")
    if all_errors:
        print(f"{len(all_errors)} error(s) across {len(by_rule)} rule(s). See scripts/check-docs.py for what each rule means.")
        return 1
    print("No structural problems found.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
