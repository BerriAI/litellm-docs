---
title: Claude Code Compatibility
sidebar_label: Claude Code Compatibility
---

import ClaudeCodeCompatibilityTable from '@site/src/components/ClaudeCodeCompatibilityTable';

# Claude Code × LiteLLM compatibility matrix

This table is regenerated daily by an automated populator that runs the
[Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) against
the latest stable LiteLLM proxy across each supported provider, with
Haiku 4.5, Sonnet 4.6, and Opus 4.7 in parallel. A cell goes green only
if all three model tiers pass.

<ClaudeCodeCompatibilityTable />

## Legend

| Glyph | Meaning |
| --- | --- |
| ✅ | All three model tiers pass for this `(feature, provider)` cell. |
| ❌ | At least one model tier failed. Hover for the upstream error. |
| — | No test ran for this combination. |
| n/a | Not applicable (e.g. provider doesn't expose this feature). Hover for the reason. |

## Source

The matrix JSON lives at
[`src/data/compatibility-matrix.json`](https://github.com/BerriAI/litellm-docs/blob/main/src/data/compatibility-matrix.json).
The populator is in
[`tests/claude_code/cron_vm/`](https://github.com/BerriAI/litellm/tree/main/tests/claude_code/cron_vm)
on the main repo.
