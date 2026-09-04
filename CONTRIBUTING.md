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
