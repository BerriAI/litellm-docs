When making public-facing docs, PR descriptions, comments, issues, commit messages, etc., always follow these guidelines to sound less AI-y:

- prefer not to use emojis
- don't use "—". Instead, reach for ";", ".", etc.
- don't use the pattern "It's not X, it's Y", "You're not X, you're Y", etc.
- don't use bulleted or numbered lists unless it would be nonsensical not to. Instead, prefer prose
- be information dense, concise, and clear

## Release notes: breaking changes

Every breaking change in a release note must be surfaced in a dedicated red `:::danger Breaking Changes` admonition placed immediately after the "Deploy this version" block and before "Key Highlights"; do not leave it as a regular Key Highlights bullet. A breaking change is anything that alters existing default behavior, removes or renames a field, tightens who may do something, or otherwise requires action to preserve prior behavior; opt-in additions and pure bug fixes are not breaking. Lead each entry with a bolded one-sentence summary of what changed, then state the upgrade impact and link the PR. Group multiple breaking changes in the same release inside one admonition. Use the following shape:

```md
</Tabs>

:::danger Breaking Changes

**One-sentence summary of the change.** What breaks for someone upgrading and how to restore the prior behavior if applicable. See [PR #12345](https://github.com/BerriAI/litellm/pull/12345).

:::

## Key Highlights
```
## Release notes: GitHub release and ghcr image links

Every new stable release note must link the GitHub releases page, https://github.com/BerriAI/litellm/releases, and the specific release entry at `https://github.com/BerriAI/litellm/releases/tag/vX.Y.Z`. Fetch that release entry before writing the note: its "Verify Docker Image Signature" block names the exact ghcr image for the version (for example `ghcr.io/berriai/litellm:v1.101.0`), so take the image reference from there rather than guessing the tag format. The note must then link that version's ghcr image, pointing at the package page `https://github.com/BerriAI/litellm/pkgs/container/litellm` with the image reference as the link text. Put these links in the "Deploy this version" section, directly after the `</Tabs>` closer and before any breaking changes admonition, in this shape:

```md
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:vX.Y.Z`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/vX.Y.Z) and the full [releases page](https://github.com/BerriAI/litellm/releases).
```

## Release notes: runnable docker command

The Docker tab under "Deploy this version" must be a command that actually boots the proxy. `STORE_MODEL_IN_DB=True` alone does nothing without a database, so always pair it with `LITELLM_MASTER_KEY` and `DATABASE_URL`:

```bash
docker run \
-e LITELLM_MASTER_KEY=sk-<paste-a-long-random-key> \
-e DATABASE_URL=postgresql://<user>:<password>@<host>:5432/<dbname> \
-e STORE_MODEL_IN_DB=True \
-p 4000:4000 \
docker.litellm.ai/berriai/litellm:X.Y.Z
```

## Release notes: titles, descriptions and the changelog summary

Every release note is also a search result and a changelog entry, so each new note needs three things beyond its body. The `title` frontmatter names the product, the version and the change, in the form `LiteLLM vX.Y.Z <verb> <the 2 or 3 most important named changes>`, such as `LiteLLM v1.104.0 adds Claude Opus 5.5, GPT-6 and master key enforcement`. Use a plain verb (adds, fixes, updates, removes, supports), exact model, provider and feature names, at most about 75 characters, and no colon or em dash. A backport shipped on several release lines lists every version, as in `LiteLLM v1.104.1, v1.103.4 and v1.102.3 update pgbouncer to 1.26.0`.

The `description` frontmatter is the snippet under that title in search and answer engines. Without it Docusaurus uses the first heading, "Deploy this version". Write 110 to 155 characters in one or two sentences that say what changed with concrete names, start with a verb or the main subject rather than the version number, "This release" or "LiteLLM", and leave out how the release is published (images, PyPI, tags).

Add an entry at the top of `release_notes/summaries.json`, which feeds the changelog at `/release_notes` and its RSS feed, and remove the oldest entry so the file keeps the latest 20. An entry is `{"folders": [...], "title": ..., "points": [...]}`: same-day backports share one entry with all their folders, `title` matches the frontmatter title, and `points` holds 2 to 4 sentences (2 or 3 for a patch). Each point is one sentence of at most 25 words that says what changed and what it means for someone upgrading, with model names, endpoints, settings and numbers in backticks where they are code. Never write a bare label such as "New models on day one". When the release has a breaking change, one point states it and the setting that restores the old behavior. Use only facts from the note.

Write titles, descriptions and points in ASD-STE100 Simplified Technical English: active voice, simple present, no "-ing" verb forms except in technical names such as streaming, and no should, would, may or might. Check them with `python3 ~/.claude/skills/simplified-technical-english/scripts/ste_check.py --mode descriptive <file>` when that skill is installed, and fix every error it reports.
