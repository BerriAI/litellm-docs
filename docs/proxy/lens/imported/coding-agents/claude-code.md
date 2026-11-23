---
title: "Claude Code"
description: "Send personal Claude Code sessions to LiteLLM Lens with the LiteLLM Lens plugin for Claude Code."
slug: "/proxy/lens/coding-agents/claude-code"
sidebar_label: "Claude Code"
custom_edit_url: "https://github.com/BerriAI/litellm-lens-example/edit/main/claude-code/README.md"
mdx:
  format: md
---

<!-- Generated from BerriAI/litellm-lens-example/claude-code/README.md at d68cea11157f037e43eac02aae76fb70c984b123. Edit the source README. -->

# Claude Code

Send your personal Claude Code sessions to [LiteLLM Lens](/docs/proxy/lens) with the [LiteLLM Lens plugin for Claude Code](https://github.com/BerriAI/litellm-lens-plugins/tree/main/claude-code). The plugin reads the transcript Claude Code already writes and sends each session to Lens as one trace. Your model login and model endpoint stay unchanged.

## Prerequisites

You need Claude Code on macOS or Linux, Python 3.10 or later on the `PATH`, and a running [Lens installation](/docs/proxy/lens/deployment). The plugin takes an address and a key. When your Claude Code model calls already go through a LiteLLM gateway connected to Lens, use the gateway address and the LiteLLM key Claude Code already uses. With standalone Lens, use your Lens address and a dedicated Lens tracing key; open **Home** in Lens, choose **Standalone Lens**, and create one. Ask your administrator for a tracing key if you cannot create one. <!-- keep-python-version: Claude Code plugin prerequisite -->

## Setup

Install the plugin with your address and the environment variable that holds your key. This example uses standalone Lens:

```bash
export LITELLM_TRACING_KEY="<paste your Lens tracing key>"

claude plugin marketplace add BerriAI/litellm-lens-plugins
claude plugin install litellm-lens@berriai-lens \
  --config lens_url="http://localhost:4318" --config lens_key="$LITELLM_TRACING_KEY"
```

Through a gateway, pass `$ANTHROPIC_BASE_URL` and `$ANTHROPIC_AUTH_TOKEN` in place of the Lens address and tracing key. Claude Code keeps the key in its secure storage. Restart any Claude Code sessions you had open so they load the plugin. The [Lens coding agent setup guide](/docs/proxy/lens/coding-agents#claude-code) covers both paths, what the plugin sends, and the telemetry fallback for machines where the plugin cannot run.

## Verify the trace

Run one task:

```bash
claude -p "Reply with exactly: Lens plugin check."
```

Open **Traces** in standalone Lens or **Lens > Traces** in LiteLLM and filter by **claude-code**. The session is one trace with its prompt, reply, tool calls and model calls.

## Troubleshooting

If the session is missing, check that `python3` is on the `PATH` and read `last_error.txt` in `~/.claude/plugins/data/litellm-lens-berriai-lens`. A `401` or `403` there means the key does not match the address: a gateway address takes a LiteLLM key, and a Lens address takes a Lens tracing key. The plugin sends nothing while `CLAUDE_CODE_ENABLE_TELEMETRY` and `CLAUDE_CODE_ENHANCED_TELEMETRY_BETA` are both set, so remove those two settings to record with the plugin. Installing again does not change a saved address or key; run `claude plugin uninstall litellm-lens@berriai-lens` first to change them.
