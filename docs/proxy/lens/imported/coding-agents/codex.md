---
title: "Codex"
description: "Send personal Codex sessions to LiteLLM Lens with the LiteLLM Lens plugin for Codex."
slug: "/proxy/lens/coding-agents/codex"
sidebar_label: "Codex"
custom_edit_url: "https://github.com/BerriAI/litellm-lens-example/edit/main/codex/README.md"
mdx:
  format: md
---

<!-- Generated from BerriAI/litellm-lens-example/codex/README.md at d68cea11157f037e43eac02aae76fb70c984b123. Edit the source README. -->

# Codex

Send your personal Codex sessions to [LiteLLM Lens](/docs/proxy/lens) with the [LiteLLM Lens plugin for Codex](https://github.com/BerriAI/litellm-lens-plugins/tree/main/codex). The plugin serves Codex desktop and CLI and sends each chat to Lens as one trace. Your model login and model endpoint stay unchanged.

## Prerequisites

You need a Codex version with plugin support on macOS or Linux, Python 3.11 or later, and a running [Lens installation](/docs/proxy/lens/deployment). Setup takes an address and a key. With standalone Lens, use your Lens address and a dedicated Lens tracing key; open **Home** in Lens, choose **Standalone Lens**, and create one. When your Codex model calls already go through a LiteLLM gateway connected to Lens, use the gateway address and the LiteLLM key Codex already uses. Ask your administrator for a tracing key if you cannot create one. <!-- keep-python-version: Codex plugin prerequisite -->

## Setup

Install the plugin on the computer where Codex runs:

```bash
codex plugin marketplace add BerriAI/litellm-lens-plugins
codex plugin add litellm-lens@berriai-lens
```

Start a new Codex chat and send:

```text
Use lens-setup to connect my Codex chats to LiteLLM Lens.
```

On macOS, Codex opens a private Terminal setup window. On Linux, Codex prints a `bash .../scripts/run.sh setup` command; run it in your own terminal. Enter your address, enter the key at the hidden prompt, and use `codex` as the agent name. Do not paste the key into a Codex prompt. Confirm recording, then start another new chat so its hooks load. The [Lens coding agent setup guide](/docs/proxy/lens/coding-agents#codex) covers both paths and what the plugin records.

## Verify the trace

Run one task from your project:

```bash
codex exec "Reply with exactly: Lens Codex telemetry check."
```

Open **Traces** in standalone Lens or **Lens > Traces** in LiteLLM and filter by **codex**. The chat is one trace, updated after each completed or interrupted turn.

## Troubleshooting

If the chat is missing, ask Codex `Use lens-setup to show recording status.` and check the address and the key: a gateway address takes a LiteLLM key, and a Lens address takes a Lens tracing key. Only activity after setup is recorded, and a chat that was open during setup needs a new chat before its hooks load. See the [plugin's coverage and privacy details](https://github.com/BerriAI/litellm-lens-plugins/tree/main/codex#what-youll-see) for what it records and its limits.
