When making public-facing docs, PR descriptions, comments, issues, commit messages, etc., always follow these guidelines to sound less AI-y:

- prefer not to use emojis
- don't use "—". Instead, reach for ";", ".", etc.
- don't use the pattern "It's not X, it's Y", "You're not X, you're Y", etc.
- don't use bulleted or numbered lists unless it would be nonsensical not to. Instead, prefer prose
- be information dense, concise, and clear

## Release notes: breaking changes

Every breaking change in a release note must be surfaced in a dedicated red `:::danger[Breaking Changes]` admonition placed immediately after the "Deploy this version" block and before "Key Highlights"; do not leave it as a regular Key Highlights bullet. A breaking change is anything that alters existing default behavior, removes or renames a field, tightens who may do something, or otherwise requires action to preserve prior behavior; opt-in additions and pure bug fixes are not breaking. Lead each entry with a bolded one-sentence summary of what changed, then state the upgrade impact and link the PR. Group multiple breaking changes in the same release inside one admonition. Use the following shape:

```md
</Tabs>

:::danger[Breaking Changes]

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

## Code and MDX conventions

Follow the MDX syntax rules in section 4 and the "Code in `src/`" section of CONTRIBUTING.md, and run `npm run typecheck`, `npm run format:check`, and `npm run build` before opening a PR.
