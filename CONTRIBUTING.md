# Contributing to LiteLLM Docs

Thanks for contributing to the LiteLLM documentation! This guide will help you run the docs site locally, make changes, and verify them before opening a PR.

## 1. Clone the docs repo

```bash
git clone https://github.com/BerriAI/litellm-docs.git
cd litellm-docs
```

## 2. Install dependencies

The site needs Node 22.18 or newer; `.nvmrc` pins the version CI uses.

```bash
nvm use
npm install
```

## 3. Start the docs site locally

```bash
npm start
```

Open http://localhost:3000.

The site uses Docusaurus 3 with the v4 future flags turned on, so most docs and blog changes reload automatically while the dev server is running.

## 4. Make your changes

Most documentation pages live in `docs/`.

Blog posts live in `blog/`.

Custom standalone pages live in `src/pages/`.

If you add, remove, or move docs pages, check whether `sidebars.ts` needs to be updated.

To mark a page or section as Enterprise-gated, put `<EnterpriseFeature />` on its own line with a blank line before and after it, instead of writing the admonition by hand. It is registered globally in `src/theme/MDXComponents.tsx`, so no import is needed. Pass `feature="SSO"` to name the feature in the first sentence, use `<EnterpriseFeature free />` for features that ship in `litellm[proxy]` without a license, and put a one-line note between `<EnterpriseFeature>` and `</EnterpriseFeature>` when the page needs an extra sentence, such as a user limit. The component lives in `src/components/EnterpriseFeature/`.

Pages are compiled as MDX 3 without the MDX 1 compatibility layer, so write admonition titles as `:::note[Title]`, explicit heading ids as `## Heading {/* #my-id */}`, and comments as `{/* comment */}`; HTML comments and `{#my-id}` fail the build. Use `:::warning` rather than the deprecated `:::caution`. JSX attributes use React names, such as `frameBorder` and `allowFullScreen` on an iframe. Link to other pages by file (`./other-page.md`) or by absolute path (`/docs/proxy/logging`); a bare relative URL such as `./other-page` resolves differently on the server and in the browser on index pages and sends readers to a 404.

### Code in `src/`

Everything under `src/`, `plugins/`, and `scripts/`, plus the Docusaurus config and sidebars, is TypeScript. Each component gets its own `PascalCase` folder under `src/components/` with an `index.tsx` and, when it has styles, a `styles.module.css` next to it. Components are function declarations that return `ReactNode`, and props get a `Props` type; swizzled theme components in `src/theme/` take their props from the matching `@theme/*` type. Rely on the automatic JSX runtime and import hooks and types by name instead of `import React`. Anything rendered during the build must produce the same output in the browser, so avoid inline `<style>` text, and pass an explicit locale and time zone when formatting numbers or dates. Scripts in `scripts/` run with Node's built-in type stripping (`node scripts/check-writing-style.ts`), so they may only use syntax that erases to JavaScript.

## 5. Verify your changes

Before opening a PR, run:

```bash
npm run typecheck
npm run format:check
npm run build
```

`typecheck` runs `tsc` in strict mode, `format:check` runs Prettier on the TypeScript and CSS sources (`npm run format` fixes them), and `build` catches broken links, invalid MDX, and other Docusaurus build issues. CI runs all three and also fails when the build prints any warning.

Also run the writing style check, which CI enforces on every PR:

```bash
npm run lint:writing
```

It covers `docs/`, `blog/`, and `release_notes/`. It fails on em dashes used as prose punctuation (see AGENTS.md) and, with `--warnings`, lists inflated wording such as "utilize", "leverage", or "seamless".

Also run the structural check, which CI enforces on every PR:

```bash
pip install pyyaml   # once
npm run lint:docs
```

It parses every fenced `yaml`, `json`, and `python` block in `docs/`, and fails on blocks that do not parse, unclosed fences, code written on the ``` line, comments after a `\` line continuation in shell blocks, relative links and heading anchors that do not resolve, missing images, GitHub-style `> [!NOTE]` alerts, and pages with more than one H1. The rule names in its output are explained at the top of `scripts/check-docs.py`. Comments, `...` placeholders, and object fragments (a `"key": value` list without the enclosing braces) inside JSON blocks are tolerated. If a block is deliberately a fragment that cannot be made valid, add `nolint` to the fence line (```yaml nolint); use that sparingly.

Model ids in examples are placeholders. `docs-models.json` at the repo root maps a role (`openai_small`, `openai_large`, `anthropic`, `anthropic_large`, `gemini_pro`, `gemini_flash`) to the id examples use today, and pages write `{{openai_small}}` (or `azure/{{openai_large}}`, `bedrock/us.anthropic.{{anthropic}}`) inside code blocks and inline code; `src/remark/docs-models.ts` fills in the real id when the site builds, including for the copy-as-markdown button. Moving the docs to a new model is one edit to `docs-models.json` with no page changes. `npm run lint:docs` applies the same substitution before it parses a block and fails with `model-literal` when a code block hardcodes one of those ids instead of using its placeholder. When the exact id is the point of a block, such as a price map key, a cache key, or a printed log, add `keep-model-ids` to the fence line (```yaml keep-model-ids). Ids that are facts about a provider rather than an example default, such as a supported-model table, stay literal. Other `{{name}}` tokens in pages are prompt-template placeholders and pass through untouched. A placeholder that starts like a role but is not one (`{{openai_smal}}`, or `{{gemini_flash}}` once that role is removed from the file) fails with `model-role-unknown`, since the build would print it as written.

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
