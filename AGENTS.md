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