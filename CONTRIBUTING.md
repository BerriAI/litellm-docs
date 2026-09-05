# Contributing to LiteLLM Docs

Thanks for contributing to the LiteLLM documentation! This guide will help you run the docs site locally, make changes, and verify them before opening a PR.

## 1. Clone the docs repo

```bash
git clone https://github.com/BerriAI/litellm-docs.git
cd litellm-docs
```

## 2. Install dependencies

```bash
npm install
```

## 3. Start the docs site locally

```bash
npm start
```

Open http://localhost:3000.

The site uses Docusaurus 3, so most docs and blog changes reload automatically while the dev server is running.

## 4. Make your changes

Most documentation pages live in `docs/`.

Blog posts live in `blog/`.

Custom standalone pages live in `src/pages/`.

If you add, remove, or move docs pages, check whether `sidebars.js` needs to be updated.

To mark a page or section as Enterprise-gated, put `<EnterpriseFeature />` on its own line with a blank line before and after it, instead of writing the admonition by hand. It is registered globally in `src/theme/MDXComponents.js`, so no import is needed. Pass `feature="SSO"` to name the feature in the first sentence, use `<EnterpriseFeature free />` for features that ship in `litellm[proxy]` without a license, and put a one-line note between `<EnterpriseFeature>` and `</EnterpriseFeature>` when the page needs an extra sentence, such as a user limit. The component lives in `src/components/EnterpriseFeature/`.

## 5. Verify your changes

Before opening a PR, run:

```bash
npm run build
```

This catches broken links, invalid MDX, and other Docusaurus build issues.

Also run the writing style check, which CI enforces on every PR:

```bash
npm run lint:writing
```

It covers `docs/`, `blog/`, and `release_notes/`. It fails on em dashes used as prose punctuation (see CLAUDE.md) and, with `--warnings`, lists inflated wording such as "utilize", "leverage", or "seamless".

Also run the structural check, which CI enforces on every PR:

```bash
pip install pyyaml   # once
npm run lint:docs
```

It parses every fenced `yaml`, `json`, and `python` block in `docs/`, and fails on blocks that do not parse, unclosed fences, code written on the ``` line, comments after a `\` line continuation in shell blocks, relative links and heading anchors that do not resolve, missing images, GitHub-style `> [!NOTE]` alerts, and pages with more than one H1. The rule names in its output are explained at the top of `scripts/check-docs.py`. Comments, `...` placeholders, and object fragments (a `"key": value` list without the enclosing braces) inside JSON blocks are tolerated. If a block is deliberately a fragment that cannot be made valid, add `nolint` to the fence line (```yaml nolint); use that sparingly.

The same check also keeps example model ids current. `docs-models.json` at the repo root maps a role (`openai_small`, `openai_large`, `anthropic`, `anthropic_large`, `gemini_pro`, `gemini_flash`) to the id examples should use today, and that is the whole file: there is no list of old ids, because git remembers what the file said before. To move the docs to a new model, change the id in `docs-models.json` and run `python3 scripts/bump-docs-models.py docs` (also `npm run bump:models`); it compares the file with the last commit and rewrites every old id to the new one inside code blocks and inline backticks, leaving tables, headings and prose alone. Pass `--from OLD --to NEW` to rewrite an id that is not in the file. `npm run lint:docs` fails with `retired-model` when a code block still uses an id the file held in an earlier commit. When the exact old id is the point of a block, such as model-specific behavior, a price map key, a regex or wildcard example, or a cache key, add `keep-model-ids` to the fence line (```yaml keep-model-ids) and both tools skip it. Prose has no fence line, so a sentence or list that must keep an old id in backticks (a supported-model list, a note about one model) carries an MDX comment instead: `{/* keep-model-ids */}` at the end of a line, or `{/* keep-model-ids:start */}` and `{/* keep-model-ids:end */}` on their own lines around a list. The bump script skips those lines; the linter only checks fences.

## 6. Submit a PR

Create a branch:

```bash
git checkout -b docs/your-change-name
```

Commit your changes:

```bash
git add .
git commit -m "docs: update contributing guide"
```

Push your branch and open a PR against `BerriAI/litellm-docs`.
