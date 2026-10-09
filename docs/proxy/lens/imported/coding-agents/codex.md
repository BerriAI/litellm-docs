---
title: "Codex"
description: "Connect personal Codex sessions to LiteLLM Lens using the maintained setup guides."
slug: "/proxy/lens/coding-agents/codex"
sidebar_label: "Codex"
custom_edit_url: "https://github.com/BerriAI/litellm-lens-example/edit/main/codex/README.md"
mdx:
  format: md
---

<!-- Generated from BerriAI/litellm-lens-example/codex/README.md at a2294277609202247b71c08d7b491f5212809988. Edit the source README. -->

# Codex

For optional help from your coding agent, use [Set it up for me](https://github.com/BerriAI/lens/blob/main/docs/setup-with-agent.md#connect-an-agent-to-lens-already-running). It preserves your model connection and verifies a real trace after setup

Send your personal Codex sessions to [LiteLLM Lens](/docs/proxy/lens). This folder links to the maintained integration instructions.

## Prerequisites

You need Codex, a running [Lens installation](https://github.com/BerriAI/lens/blob/main/deploy/lens/README.md), and a dedicated Lens tracing key. Lens can run with ClickHouse alone; keep your coding agent's existing model login and provider

## Setup

Follow the [Lens coding agent setup guide](/docs/proxy/lens/coding-agents) for the tracing endpoint and key instructions. See the [LiteLLM Lens Codex integration](https://github.com/BerriAI/litellm-lens-codex-integration) for the integration’s configuration and supported telemetry.

## Verify the trace

Complete a new session turn, then open **Lens > Traces** in your standalone or embedded Lens UI. Find the session using the agent name configured by the integration and inspect its recorded activity.

## Troubleshooting

If the session is missing, check the setup guide’s recording and export instructions, the Lens ingestion URL, and the key. Check the maintained integration documentation for supported activity and platform requirements.
