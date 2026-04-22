---
slug: akto-partnership
title: "LiteLLM × Akto: Model-Based Detection Alongside Built-in Guardrails"
date: 2026-04-21T10:00:00
authors:
  - krrish
  - ishaan-alt
description: "Chain Akto's model-based detection with LiteLLM's built-in guardrails — catch PII, prompt injection, and policy violations that pattern-based checks miss."
tags: [partnership, security, guardrails, akto]
hide_table_of_contents: false
---

![LiteLLM x Akto Partnership](/img/litellm_akto_announcement.png)

[Akto](https://akto.io) now runs natively inside the LiteLLM proxy as a chained guardrail.

{/* truncate */}

LiteLLM already ships with built-in guardrails for fast, deterministic checks (regex-based PII, secret scanning, banned-word lists). Akto adds a second layer on top — **model-based detection** for the cases deterministic rules can't cover: prompt injection, semantic PII leaks, and custom policy violations that require an LLM to classify intent.

You run them together. LiteLLM's guardrails handle the cheap, fast checks; Akto handles the scenarios that need a model in the loop.

![Guardrail Chaining: Client → LiteLLM Proxy → LLMs / MCPs / Agents, with LiteLLM Guardrails chaining to Akto](/img/litellm_guardrail_chaining.png)

Akto runs in **sync mode** (block on violation before the LLM is called) or **async mode** (log and alert without adding latency). Configure it as a callback on your existing proxy — no app-level changes.

**Get started:** [Akto guardrail setup guide](../../docs/proxy/guardrails/akto)

**Read the full announcement** on [Akto's blog →](https://www.akto.io/blog/akto-partners-litellm-ai-gateway-security-agents)
