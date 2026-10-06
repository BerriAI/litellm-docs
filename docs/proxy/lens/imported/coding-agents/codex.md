---
title: "Codex"
description: "Connect personal Codex sessions to LiteLLM Lens using the maintained setup guides."
slug: "/proxy/lens/coding-agents/codex"
sidebar_label: "Codex"
custom_edit_url: "https://github.com/BerriAI/litellm-lens-example/edit/main/codex/README.md"
mdx:
  format: md
---

<!-- Generated from BerriAI/litellm-lens-example/codex/README.md at a6cce7983ec78ef9183627a0b05e0e3ce548b98a. Edit the source README. -->

# Codex

Send your personal Codex sessions to [LiteLLM Lens](/docs/proxy/lens). This folder links to the maintained integration instructions.

## Prerequisites

You need Codex, a LiteLLM gateway with [tracing enabled](/docs/proxy/lens/deployment#configure-an-existing-proxy), and a LiteLLM key.

## Setup

Follow the [Lens coding agent setup guide](/docs/proxy/lens/coding-agents) for gateway-specific instructions. See the [LiteLLM Lens Codex integration](https://github.com/BerriAI/litellm-lens-codex-integration) for the integration’s configuration and supported telemetry.

## Verify the trace

Complete a new session turn, then open **Lens > Traces** on your gateway. Find the session using the agent name configured by the integration and inspect its recorded activity.

## Troubleshooting

If the session is missing, check the setup guide’s recording and export instructions, the gateway URL, and the key. Check the maintained integration documentation for supported activity and platform requirements.
