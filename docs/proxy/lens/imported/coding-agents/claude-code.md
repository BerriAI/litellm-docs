---
title: "Claude Code"
description: "Connect personal Claude Code sessions to LiteLLM Lens using the maintained setup guides."
slug: "/proxy/lens/coding-agents/claude-code"
sidebar_label: "Claude Code"
custom_edit_url: "https://github.com/BerriAI/litellm-lens-example/edit/main/claude-code/README.md"
mdx:
  format: md
---

<!-- Generated from BerriAI/litellm-lens-example/claude-code/README.md at 79e58f44692b09a68b569ff104b36d0b00712272. Edit the source README. -->

# Claude Code

Send your personal Claude Code sessions to [LiteLLM Lens](/docs/proxy/lens). This folder links to the maintained integration instructions.

## Prerequisites

You need Claude Code, [Lens installed alongside LiteLLM](/docs/proxy/lens/deployment#configure-an-existing-proxy), and a dedicated Lens tracing key. Open **Lens > Traces > Set up tracing**, copy the full **Traces endpoint** under **Connection details**, and click **Generate tracing key**. Ask your administrator for these if you cannot create a tracing key.

## Setup

Follow the [Lens coding agent setup guide](/docs/proxy/lens/coding-agents) for gateway-specific instructions. See the [Claude Code monitoring guide](https://code.claude.com/docs/en/monitoring-usage) for the integration’s configuration and supported telemetry.

## Verify the trace

Complete a new session turn, then open **Lens > Traces** on your gateway. Find the session using the agent name configured by the integration and inspect its recorded activity.

## Troubleshooting

If the session is missing, check the setup guide’s recording and export instructions, the gateway URL, and the key. Check the maintained integration documentation for supported activity and platform requirements.
