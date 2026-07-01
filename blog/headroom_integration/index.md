---
slug: headroom-integration
title: "LiteLLM × Headroom: Use 60-95% fewer tokens with Claude Code"
date: 2026-06-30T10:00:00
authors:
  - krrish
  - ishaan-alt
description: "Cut input tokens on Claude Code and other LLM traffic by attaching Headroom as a pre_call guardrail on LiteLLM."
tags: [partnership, guardrails, context, headroom, claude-code]
hide_table_of_contents: false
---

[Headroom](https://headroom.ai) now runs as a native guardrail on the LiteLLM proxy, compressing tool outputs, RAG payloads, database results, and file reads before they reach the model.

{/* truncate */}

Long-context agents burn most of their input budget on repeated tool output, retrieved chunks, and stale scratch state. Headroom intelligently rewrites that content so the model sees the same information at a fraction of the tokens.

If the model needs the full context, LiteLLM will also pass a 'retrieve_headroom' tool to the model, to retrieve the full context from Headroom. 

## How is it deployed? 

Headroom runs as a sidecar to LiteLLM. Client traffic still hits the LiteLLM gateway; LiteLLM invokes Headroom during the `pre_call` step, swaps in the compressed messages, and forwards the payload upstream. Clients and the LLM provider never talk to Headroom directly.

The benefit of this is two-fold
- **Convenience:** Users get 1 api base regardless of if they use prompt compression or not.
- **Reliability:** If Headroom goes down, your LLM calls are unaffected. 

![Client to LiteLLM to LLM, with Headroom attached to LiteLLM as a sidecar](/img/headroom_architecture.png)

Compression works on both `/v1/chat/completions` and `/v1/messages` (Anthropic format), which makes the Claude Code rollout a one-liner for the admin: attach `headroom-compression` to a virtual key, hand it to the developer, and every request they make through `ANTHROPIC_BASE_URL` gets compressed automatically. No client-side change, no code diff.

Turn it on per key, per request, or globally via `default_on: true`. Confirm it ran by checking the `x-litellm-applied-guardrails` response header or the Guardrails panel in the Logs UI.

**Get started:** [Headroom guardrail setup guide](../../docs/proxy/headroom) (requires LiteLLM v1.92.x or later; for testing ahead of the stable cut, grab the [v1.92.0-dev.1](https://github.com/BerriAI/litellm/releases/tag/v1.92.0-dev.1) dev release)

**Discussion:** [GitHub discussion #31816](https://github.com/BerriAI/litellm/discussions/31816)
