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
  link-missing        a relative, /docs/ or pathname:// link whose target does not exist
  anchor-missing      a link to a page whose heading anchor does not exist
  image-missing       a require(), ![]() or src= image path that does not exist
  github-alert        a GitHub-style "> [!NOTE]" alert, which Docusaurus renders as a plain quote
  multiple-h1         more than one H1 in a page
  model-literal       a fenced block hardcodes a current/historical default or a chatgpt/ model instead of its {{role}} placeholder
  python-literal      a Python version is written out (python3.12, python:3.12-slim, python=3.12, Python 3.12+) instead of {{python_version}} or {{python_min_version}}
  model-role-unknown  a {{placeholder}} that looks like a docs-models.json role but is not one, which the build would print literally
  version-note        a hand-written "available in v1.85.0" note instead of the <SinceVersion /> badge
  version-missing     with --base, a docs page or docs/proxy/config_settings.md row added since that ref without the badge
  card-missing        a blog post tagged `day 0 support` without card_title or card_summary frontmatter (the Admin UI Home cards read them from the RSS feed)
  card-too-long       card_title over 40 characters or card_summary over 120, which the Home card cannot show in full

Usage:
  python3 scripts/check-docs.py [paths...]      defaults to docs/
  python3 scripts/check-docs.py blog --only=card-missing,card-too-long   run only the named rules

Add `nolint` to a fence's info string (```yaml nolint) to skip parsing a
block that is intentionally a fragment.

Model ids in examples are `{{role}}` placeholders filled from docs-models.json
at build time (src/remark/docs-models.js). This script applies the same
substitution before parsing a block, and the model-literal rule fails a block
that writes a current or recorded historical id itself, because that block
would not follow the next bump. Any literal chatgpt/ model is also caught, in prose as well as code,
even if it has never been a default. Retain earlier defaults in
docs-models-history.json when updating docs-models.json.
Add `keep-model-ids` to the fence line, or a `{/* keep-model-ids */}` comment on
the prose line, when the exact id is the point (a price map key, a cache key,
a printed log).

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

Feature availability is stated with the <SinceVersion /> badge
(src/components/SinceVersion), so a reader can tell at a glance whether a
feature exists in the version they run. The version-note rule fails a prose
sentence that ends in a hand-written availability note ("Requires LiteLLM
v1.76.1+", "This feature is available in v1.74.3-stable and above", a table
cell holding "1.63.8+") and points at the badge. The version has to end its
sentence, table cell, or parenthesis, so a sentence that happens to mention a
release ("From v1.81.0 the request is set as attributes on the parent span") is
left alone, and so is a removal or regression note ("No longer supported since
v1.110.0", "Broken since v1.86.0"). A negation word counts only inside the
version's own sentence and table cell, so "not working" in the cell before
"Upgrade to LiteLLM v1.97.0+" does not hide that note. "LiteLLM v1.97.0+ strips ..." fires
wherever the sentence goes, since LiteLLM's name with a "+" or "and later" is a
note on its own, and so is "LiteLLM >= v1.85.0" or "(v1.100 and later)" after a
lowercase word. Another project's version is usually left alone too, since the words
leading into it are not availability words, "Kubernetes v1.29.0 or later is required"
names its subject, and a bare "1.29.0+" cell counts only in a row or column that
names LiteLLM. A line like "requires the SDK 1.1.0" does fire. Add `{/* keep-version-note */}` to the line there, and wherever
the release itself is the subject, as on the release-cycle page. Pages with
`format: md` frontmatter render neither the badge nor the marker, so the rule
skips them.

With `--base=<git ref>`, the version-missing rule also fails a page added under
docs/ since that ref, and a row added to docs/proxy/config_settings.md, when it
carries no badge with a release version, so a new feature or setting says which
release it arrived in. A row counts as added when the diff adds it and removes
no row of the same name, so an edited or moved row needs no badge. A page that
documents no single feature (a tutorial, an overview) and a row that renames a
documented setting take `{/* keep-version-note */}` instead. CI passes the pull
request's base.

Requires PyYAML (pip install pyyaml).
"""

import ast
import difflib
import itertools
import json
import os
import re
import subprocess
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


DAY_ZERO_TAG = "day 0 support"
CARD_FIELD_MAX = {"card_title": 40, "card_summary": 120}


def check_launch_card(page, err):
    tags = page.frontmatter.get("tags", "")
    if DAY_ZERO_TAG not in tags.lower():
        return
    for field, limit in CARD_FIELD_MAX.items():
        value = page.frontmatter.get(field, "").strip()
        if not value:
            err("card-missing", 1, f"`{DAY_ZERO_TAG}` post has no `{field}`; the Admin UI Home card needs it")
        elif len(value) > limit:
            err("card-too-long", 1, f"`{field}` is {len(value)} characters, max {limit}")


def check_page(page, site, page_cache):
    errors = []
    rel = os.path.relpath(page.path, REPO_ROOT)

    def err(rule, line_no, message):
        errors.append((rule, rel, line_no, message))

    if page.unclosed_fence_line:
        err("fence-unclosed", page.unclosed_fence_line, "code fence is never closed")

    check_launch_card(page, err)

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
                    err("model-literal", start + offset + 1, model_literal_message(m.group(0)))
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
    plain_markdown = renders_as_plain_markdown(page)
    for line_no, raw in page.prose:
        if GITHUB_ALERT_RE.match(raw):
            err("github-alert", line_no, "GitHub-style alert does not render in Docusaurus; use :::note / :::warning")
        if "keep-python-version" not in raw:
            m = PYTHON_LITERAL_RE.search(raw)
            if m:
                err("python-literal", line_no, python_literal_message(m.group(0)))
        if "keep-model-ids" not in raw:
            for m in CHATGPT_LITERAL_RE.finditer(raw):
                err("model-literal", line_no, model_literal_message(m.group(0)))
        for match in SINCE_VERSION_TAG_RE.finditer(strip_inline_code(raw)):
            if not SINCE_VERSION_PROP_RE.search(match.group(1)):
                err("version-note", line_no, "<SinceVersion> without a release version in its `v` prop shows no real version; write `<SinceVersion v=\"X.Y.Z\" />` with X.Y.Z set to the first release that carries the feature")
        if "keep-version-note" not in raw and not plain_markdown:
            header = SINCE_VERSION_TAG_RE.sub(" ", table_header(page.lines, line_no))
            literal = version_note_literal(SINCE_VERSION_TAG_RE.sub(" ", raw), header)
            if literal:
                err("version-note", line_no, version_note_message(literal))
        text = strip_inline_code(raw)
        targets = [m.group(1) for m in MD_LINK_RE.finditer(text)] + [m.group(1) for m in HREF_RE.finditer(text)]
        for target in targets:
            if is_external(target):
                continue
            if target.startswith("pathname://"):
                if not os.path.isfile(os.path.join(STATIC_ROOT, target[len("pathname://"):].lstrip("/"))):
                    err("link-missing", line_no, f"{target} is not a file under static/")
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
CHATGPT_ROLES = {"chatgpt", "chatgpt_small"}
BARE_ID_ROLES = tuple(role for role in ROLE_TO_ID if role not in PYTHON_ROLES and role not in CHATGPT_ROLES)
# {model id: role}. The Python roles hold bare version numbers, which get their own rule below. The ChatGPT
# roles reuse OpenAI API ids (gpt-6.1-sol is both), so only their chatgpt/ form is matched, by its own pattern.
MODEL_ROLES = {ROLE_TO_ID[role]: role for role in BARE_ID_ROLES}
with open(os.path.join(REPO_ROOT, "docs-models-history.json"), encoding="utf-8") as f:
    MODEL_HISTORY = json.load(f)
for role, model_ids in MODEL_HISTORY.items():
    if role not in BARE_ID_ROLES:
        sys.exit(f"Invalid model history role: {role}")
    for model_id in model_ids:
        MODEL_ROLES.setdefault(model_id, role)
for role in BARE_ID_ROLES:
    if ROLE_TO_ID[role] not in MODEL_HISTORY.get(role, []):
        sys.exit(f"Record {ROLE_TO_ID[role]} under {role} in docs-models-history.json; retain older entries")
MODEL_TOKEN_RE = re.compile(r"\{\{\s*([A-Za-z0-9_]+)\s*\}\}")
# A hardcoded id counts only as a whole token: `.` and `/` before it are boundaries
# (azure/gpt-5.6-luna, us.anthropic.claude-sonnet-5) but `-` and `:` are not, so an
# alias such as bedrock-claude-sonnet-5 or a header name is left alone.
LITERAL_START = r"(?<![A-Za-z0-9:@-])"
LITERAL_END = r"(?![A-Za-z0-9@-]|[.:][0-9])"
CHATGPT_LITERAL = r"(?<!/)(?:(?:litellm_proxy|litellm|openai)/)?chatgpt/(?![A-Za-z0-9._-]*\.(?:json|py)\b)[A-Za-z0-9][A-Za-z0-9._-]*(?!/)"
CHATGPT_LITERAL_RE = re.compile(LITERAL_START + CHATGPT_LITERAL + LITERAL_END)
MODEL_LITERAL_RE = re.compile(
    LITERAL_START + "(?:" + CHATGPT_LITERAL + "|" + "|".join(re.escape(i) for i in sorted(MODEL_ROLES, key=len, reverse=True)) + ")" + LITERAL_END
) if MODEL_ROLES else re.compile(r"(?!x)x")
# python3.12, python-3.12, python:3.12-slim, python=3.12 (conda), python@3.12 (homebrew) and Python 3.12+;
# `python3 -m venv` and wheel tags such as cp312 are not versions.
PYTHON_LITERAL_RE = re.compile(r"(?<![A-Za-z0-9.])[Pp]ython[-:=@_ ]?3\.\d{1,2}(?![0-9])")


def model_literal_message(model_id):
    example = "chatgpt/{{chatgpt}} or chatgpt/{{chatgpt_small}}" if "chatgpt/" in model_id else "{{" + MODEL_ROLES[model_id] + "}}"
    return (
        f"hardcoded model id `{model_id}`; use a shared default such as `{example}` so docs-models.json controls it, "
        "or add keep-model-ids if the exact id is the point"
    )


def python_literal_message(literal):
    return (
        f"hardcoded Python version `{literal}`; write `{{{{python_version}}}}` (the version examples use) or "
        f"`{{{{python_min_version}}}}` (the lowest version LiteLLM supports) so docs-models.json controls it, "
        "or add keep-python-version if this exact version is the point"
    )


VERSION_TOKEN_RE = re.compile(
    r"(?<![\w.])(?:v?[12]\.\d{1,3}\.(?:\d{1,2}|x)(?:[.-](?:stable|nightly|dev|rc)\.?\d*)?|v[12]\.\d{1,3}(?!\w|\.\w))"
)
VERSION_NOTE_STRIP_RE = re.compile(r"!\[[^\]]*\]|\]\([^)\s]*\)|<br\s*/?>|[`*_]|>(?!=)")
VERSION_NOTE_CLAUSE_END_RE = re.compile(r"[.;:!?](?=\s|$)|[|()]|,\s*which\b")
VERSION_NOTE_TAIL_RE = re.compile(
    r"^(?:[\s+.,;:!?)\]]|\b(?:or|and|later|higher|newer|above|greater|only|onwards?|up|is|are|required|needed|releases?|versions?|builds?)\b)*$",
    re.I,
)
VERSION_NOTE_TAIL_LEAD_RE = re.compile(r"\b(?:required|needed)\b", re.I)
VERSION_NOTE_COPULA_RE = re.compile(r"\b(?:is|are)\b", re.I)
VERSION_NOTE_QUALIFIER = r"\s*(?:\+|(?:or|and)\s+(?:later|higher|newer|above|up)\b)"
VERSION_NOTE_QUALIFIER_RE = re.compile(rf"^{VERSION_NOTE_QUALIFIER}", re.I)
VERSION_NOTE_FLOOR_RE = re.compile(r">=\s*$")
VERSION_NOTE_PAREN_OPEN_RE = re.compile(r"\(\s*$")
VERSION_NOTE_PAREN_CLOSE_RE = re.compile(rf"^{VERSION_NOTE_QUALIFIER}\s*\)", re.I)
LITELLM_RELEASE_RE = re.compile(r"^v?1\.\d{2,3}(?!\d)")
LITELLM_NAME_WORDS = ("litellm", "gateway", "proxy", "sdk")
VERSION_NOTE_WORD_RE = re.compile(r"[A-Za-z]+")
VERSION_NOTE_LEAD_WORDS = frozenset(
    "available added introduced requires require required supported supports support "
    "since starting works work live valid new version versions need needs ships shipped bump upgrade landed "
    "released use run runs running".split()
)
VERSION_NOTE_FILLER_WORDS = VERSION_NOTE_LEAD_WORDS | frozenset(
    "a and as at be feature for from gateway in integration is it note of on only "
    "litellm proxy python sdk server that the this to with".split()
)
VERSION_NOTE_NEGATION_WORDS = frozenset(
    "before broke broken changed deprecated dropped failed failing fails longer never no not prior regressed "
    "removed until up".split()
)
VERSION_NOTE_LOOKBACK = 5
SINCE_VERSION_TAG_RE = re.compile(r"<SinceVersion\b([^>]*)>")
RELEASE_VERSION = r"v?\d+\.\d+\.\d+[\w.-]*"
SINCE_VERSION_PROP_RE = re.compile(
    rf"\bv\s*=\s*(?:[\"']{RELEASE_VERSION}[\"']|\{{\s*[\"'`]{RELEASE_VERSION}[\"'`]\s*\}})"
)
VERSION_NOTE_SENTENCE_END_RE = re.compile(r"[.;!?](?=\s)")


def version_note_literal(raw, header=""):
    text = VERSION_NOTE_STRIP_RE.sub(" ", raw)
    column_names = VERSION_NOTE_STRIP_RE.sub(" ", header).split("|")
    return next(
        (m.group(0) for m in VERSION_TOKEN_RE.finditer(text) if is_version_note(text, m, column_names)), None
    )


def is_version_note(text, match, column_names=()):
    after = text[match.end():]
    before = text[: match.start()]
    sentence = before[max((m.end() for m in VERSION_NOTE_SENTENCE_END_RE.finditer(before)), default=0):]
    words = VERSION_NOTE_WORD_RE.findall(sentence)
    lead_in = [word.lower() for word in words]
    cell_start = len(lead_in) - len(VERSION_NOTE_WORD_RE.findall(sentence[sentence.rfind("|") + 1 :]))
    cell_words = lead_in[cell_start:]
    negated = not VERSION_NOTE_NEGATION_WORDS.isdisjoint(lead_in[max(cell_start, len(lead_in) - VERSION_NOTE_LOOKBACK):])
    litellm_release = LITELLM_RELEASE_RE.match(match.group(0))
    loose_shape = litellm_release and (VERSION_NOTE_QUALIFIER_RE.match(after) or VERSION_NOTE_FLOOR_RE.search(before))
    if loose_shape and names_litellm(lead_in):
        return not negated
    if litellm_release and VERSION_NOTE_PAREN_OPEN_RE.search(before) and VERSION_NOTE_PAREN_CLOSE_RE.match(after):
        return not negated and (not words or not words[-1][0].isupper() or names_litellm(lead_in[-1:]))
    clause_tail = VERSION_NOTE_CLAUSE_END_RE.split(after, maxsplit=1)[0]
    if not VERSION_NOTE_TAIL_RE.match(clause_tail):
        return False
    if VERSION_NOTE_TAIL_LEAD_RE.search(clause_tail):
        return not negated and all(word in VERSION_NOTE_FILLER_WORDS for word in cell_words[-1:])
    if VERSION_NOTE_COPULA_RE.search(clause_tail):
        return False
    column = column_names[before.count("|")] if before.count("|") < len(column_names) else ""
    row_names_litellm = "litellm" in lead_in or "litellm" in column.lower()
    if loose_shape and all(word in VERSION_NOTE_FILLER_WORDS for word in cell_words) and (cell_words or row_names_litellm):
        return not negated
    for distance, word in enumerate(reversed(lead_in[-VERSION_NOTE_LOOKBACK:]), start=1):
        lead_at = len(lead_in) - distance
        if word in VERSION_NOTE_NEGATION_WORDS and lead_at >= cell_start:
            return False
        if word in VERSION_NOTE_LEAD_WORDS:
            return VERSION_NOTE_NEGATION_WORDS.isdisjoint(lead_in[max(cell_start, lead_at - 2):lead_at])
        if word not in VERSION_NOTE_FILLER_WORDS:
            return False
    return False


def table_header(lines, line_no):
    above = list(itertools.takewhile(lambda line: line.lstrip().startswith("|"), reversed(lines[: line_no - 1])))
    separator = next((i for i, line in enumerate(above) if TABLE_SEPARATOR_RE.match(line)), len(above))
    return above[separator + 1] if separator + 1 < len(above) else ""


def names_litellm(lead_in):
    name = list(itertools.dropwhile(lambda word: word != "litellm", lead_in[-len(LITELLM_NAME_WORDS):]))
    return bool(name) and all(word in LITELLM_NAME_WORDS for word in name)


def renders_as_plain_markdown(page):
    if not page.lines or page.lines[0].strip() != FRONTMATTER_DELIM:
        return False
    end = next((i for i, line in enumerate(page.lines[1:], 1) if line.strip() == FRONTMATTER_DELIM), 0)
    return any(PLAIN_MARKDOWN_FORMAT_RE.match(line) for line in page.lines[1:end])


CONFIG_SETTINGS_PATH = "docs/proxy/config_settings.md"
CONFIG_ROW_RE = re.compile(r"^\|\s*`?([A-Za-z_][\w.-]*)`?\s*\|")
TABLE_SEPARATOR_RE = re.compile(r"^\s*\|?\s*:?-{3,}")
PLAIN_MARKDOWN_FORMAT_RE = re.compile(r"^\s+format:\s*[\"']?md[\"']?\s*$")
H1_RE = re.compile(r"^#\s+\S")


def new_config_rows_without_badge(base_text, head_text):
    base_lines = base_text.split("\n")
    head_lines = head_text.split("\n")
    changes = difflib.SequenceMatcher(None, base_lines, head_lines, autojunk=False).get_opcodes()
    removed = [line for tag, i1, i2, _, _ in changes if tag in ("replace", "delete") for line in base_lines[i1:i2]]
    removed_keys = {m.group(1) for m in map(CONFIG_ROW_RE.match, removed) if m}
    added = [j for tag, _, _, j1, j2 in changes if tag in ("replace", "insert") for j in range(j1, j2)]
    rows = [(j, CONFIG_ROW_RE.match(head_lines[j])) for j in added]
    return [
        (j + 1, m.group(1))
        for j, m in rows
        if m
        and m.group(1) not in removed_keys
        and not starts_table(head_lines, j)
        and not has_release_badge(head_lines[j])
        and "keep-version-note" not in head_lines[j]
    ]


def starts_table(lines, index):
    return index + 1 < len(lines) and bool(TABLE_SEPARATOR_RE.match(lines[index + 1]))


def has_release_badge(line):
    return any(SINCE_VERSION_PROP_RE.search(m.group(1)) for m in SINCE_VERSION_TAG_RE.finditer(line))


def version_missing_errors(base_ref, repo_root=REPO_ROOT):
    resolved = subprocess.run(
        ["git", "rev-parse", "--verify", "--quiet", f"{base_ref}^{{commit}}"], cwd=repo_root, capture_output=True
    )
    if resolved.returncode != 0:
        return [("version-missing", "docs", 0, f"cannot read `{base_ref}`; fetch it before running with --base")]
    return new_config_row_errors(base_ref, repo_root) + new_page_errors(base_ref, repo_root)


def new_config_row_errors(base_ref, repo_root):
    shown = subprocess.run(
        ["git", "show", f"{base_ref}:{CONFIG_SETTINGS_PATH}"], cwd=repo_root, capture_output=True, text=True
    )
    head_path = os.path.join(repo_root, CONFIG_SETTINGS_PATH)
    if not os.path.exists(head_path):
        return []
    if shown.returncode != 0:
        return [("version-missing", CONFIG_SETTINGS_PATH, 0, f"cannot read it at `{base_ref}`: {shown.stderr.strip()}")]
    with open(head_path, encoding="utf-8") as f:
        head_text = f.read()
    return [
        (
            "version-missing",
            CONFIG_SETTINGS_PATH,
            line_no,
            f"new setting `{key}` has no <SinceVersion /> badge; add `<SinceVersion v=\"X.Y.Z\" />` with X.Y.Z set to "
            "the first release whose code carries it (the next release only while that code is unreleased), or add "
            "{/* keep-version-note */} when the row renames or moves a setting that is already documented",
        )
        for line_no, key in new_config_rows_without_badge(shown.stdout, head_text)
    ]


def new_page_errors(base_ref, repo_root):
    added = subprocess.run(
        ["git", "diff", "--name-only", "--diff-filter=A", "--find-renames", base_ref, "--", "docs"],
        cwd=repo_root, capture_output=True, text=True,
    )
    if added.returncode != 0:
        return [("version-missing", "docs", 0, f"cannot list the pages added since `{base_ref}`: {added.stderr.strip()}")]
    untracked = subprocess.run(
        ["git", "ls-files", "--others", "--exclude-standard", "--", "docs"], cwd=repo_root, capture_output=True, text=True
    )
    paths = sorted(set(added.stdout.splitlines()) | set(untracked.stdout.splitlines()))
    pages = [(path, Page(os.path.join(repo_root, path))) for path in paths if is_new_page_candidate(path)]
    return [
        (
            "version-missing",
            path,
            next((line_no for line_no, text in page.prose if H1_RE.match(text)), 1),
            "new page has no <SinceVersion /> badge; add `<SinceVersion v=\"X.Y.Z\" />` under its title with X.Y.Z set "
            "to the first release that carries the feature (the next release while its code is unreleased), or add "
            "{/* keep-version-note */} when the page documents no single feature, like a tutorial or an overview",
        )
        for path, page in pages
        if not renders_as_plain_markdown(page) and not states_availability(page)
    ]


def is_new_page_candidate(path):
    return path.endswith((".md", ".mdx")) and not os.path.basename(path).startswith("_")


def states_availability(page):
    return any(has_release_badge(text) or "keep-version-note" in text for _, text in page.prose)


def badge_version(literal):
    version = re.sub(r"\.x$", ".0", literal.lstrip("vV"))
    return version if version.count(".") >= 2 else f"{version}.0"


def version_note_message(literal):
    return (
        f"hand-written version note `{literal}`; write `<SinceVersion v=\"{badge_version(literal)}\" />` so every "
        "page states availability the same way, or add {/* keep-version-note */} when the version is not "
        "LiteLLM's own or the release itself is the subject of the sentence"
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
    base_ref = next((a[len("--base="):] for a in argv if a.startswith("--base=")), None)
    only = {rule for a in argv if a.startswith("--only=") for rule in a[len("--only="):].split(",") if rule}
    files = []
    for root in roots:
        files.extend(collect_files(os.path.join(REPO_ROOT, root) if not os.path.isabs(root) else root))
    site = Site()
    page_cache = {}
    all_errors = []
    for path in files:
        page = page_cache.get(path) or Page(path)
        page_cache[path] = page
        all_errors.extend(e for e in check_page(page, site, page_cache) if not only or e[0] in only)
    if base_ref:
        all_errors.extend(e for e in version_missing_errors(base_ref) if not only or e[0] in only)

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
