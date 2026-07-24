---
slug: july-townhall-updates
title: "July Townhall Updates: 38 Security Fixes, 317 Bug Fixes, and Autorouter V2"
date: 2026-07-24T12:00:00
authors:
  - krrish
  - ishaan-alt
description: "A recap of the July LiteLLM town hall: 38 security fixes, 317 bug fixes, 140 feature commits, new Rust gateway benchmarks, and the launch of Autorouter V2."
tags: [townhall, security, reliability, product]
hide_table_of_contents: false
---

Thank you to everyone who joined our July town hall. We used it to share this month's security and stability work and our latest product updates: **38 security fixes**, **317 bug fixes**, and **140 feature commits**, headlined by new Rust benchmarks and the launch of Autorouter V2.

{/* truncate */}

## Security

**38 security fixes shipped this month**, including two critical vulnerabilities closed for good. Here is where they landed:

| Category | Fixes | Share |
|---|---|---|
| Secret / credential exposure prevention | 12 | 32% |
| Access-control / privilege-escalation | 11 | 29% |
| Guardrail-bypass | 6 | 16% |
| SSRF / secret exfiltration | 5 | 13% |
| CVE / dependency / supply-chain | 4 | 11% |

We backport security fixes across the last four major and the last four minor release lines, so staying current is the whole defense. Upgrade to stay covered.

### How we review every PR

Every pull request runs a security pass before it can merge, and every release runs a full scan before it ships.

- **Veria scan.** A required check on every PR, built on Veria AI, zizmor, and semgrep. False positives get flagged, never blocking.
- **Dependency scan.** osv-scanner gates every lockfile change and runs nightly, so a known-CVE dependency can't ship.
- **Image scan.** Grype checks the runtime image for OS and library CVEs and fails the build on fixable High/Critical findings.

### We pay for security reports

The bug bounty is live.

- **Scope:** the LiteLLM gateway and SDK.
- **Submit** through a private vulnerability report on GitHub.
- **Triaged** by maintainers and the Veria Labs security team.
- [github.com/BerriAI/litellm/security](https://github.com/BerriAI/litellm/security)

### What's next for security

We're expanding the bug bounty program, hardening the recurring code patterns we keep finding through the stability sprint, and hiring to match. This is a structural investment, not a one-month sprint.

## Stability

We've grown fast, and want to prioritize staying on top of bugs so they don't accumulate. In July we shipped **317 bug fixes**.

| Area | Fixes |
|---|---|
| UI + Auth / SSO | 76 |
| MCP Gateway | 50 |
| Providers & Model Transforms | 48 |
| Cost, Budgets & Observability | 44 |
| Proxy Core & Resilience | 43 |
| Streaming / Realtime APIs | 36 |
| Other / SDK | 20 |

### The target: 95% E2E coverage by end of month

We're treating end-to-end testing as a first-class citizen. Every new customer journey now ships with its own E2E test, tracked live on the dashboard. The goal is to cover roughly 97 more customer journeys this month, taking us from 309 to 406 of 427 identified journeys, about 95% coverage.

### What kinds of fixes shipped

The headline categories were billing, identity, and MCP.

- **Billing accuracy.** We closed the gaps where spend used to slip through. Cached and tiered usage on Anthropic and Bedrock is priced correctly now, budgets reset on the right schedule, and partial spend gets captured when a stream drops mid-request.
- **Identity and access.** Caller identity now resolves once into a single record, so team IDs and spend attribution stay correct, and auth no longer fails open on DB errors.
- **MCP reliability.** Tools list and call consistently across every auth method now, with per-user credentials and proper OAuth token refresh.
- **Resource leaks.** Guardrails no longer re-initialize on every request, which kills the runner leaks, latency spikes, and OOMs they used to cause.
- **Resilience.** Streaming requests recover cost on interruption, the proxy self-heals on dropped DB connections, and OTEL metrics no longer overload Splunk.

### Watch our progress live

Progress is tracked in public on [GitHub issue #30484](https://github.com/BerriAI/litellm/issues/30484), with the bar set at zero reported regressions by the August 29 release.

- **June.** 13 bugs triaged and the stability sprint opens. Root-cause analysis begins.
- **July.** MCP improvements complete, with 80+ fixes shipped, and E2E coverage climbing toward the 95% target.
- **August.** Fireworks, Cloudflare, and Baseten providers join the E2E suite. Load-testing gates get added to stable releases, with progress reported alongside the August 29 release.

## Product

Alongside the security and stability work, we shipped **140 feature commits in July.**

- **Rust:** pyo3 0.29, Python 3.14 support, a Mistral OCR bridge, and /v1/messages on Azure.
- **Tokens and budgets:** Headroom cuts 60-95% of tokens; budget fallbacks reroute at the cap.
- **New models:** Claude Sonnet 5 on Day 0, Gemini 3.5 Flash, and Muse Spark 1.1.

### Performance

We've been testing LiteLLM, benchmarked with [AIGatewayBench](https://github.com/BerriAI/ai-gateway-bench). This is gateway overhead against a local deterministic mock, n=5000 per endpoint on one host.

| Metric | LiteLLM Rust | Bifrost | Portkey | LiteLLM Python v1 |
|---|---|---|---|---|
| Gateway overhead (p99 added latency) | 0.7 ms | 4.5 ms | 2.3 ms | 257.7 ms |
| Peak memory footprint | 21.8 MB | 199.1 MB | 90.4 MB | 329.5 MB |
| Estimated cost per 1M requests | $0.000175 | $0.001008 | $0.001042 | $0.015354 |

_*Overhead is gateway p99 minus direct-to-mock p99 on the same endpoint. Cost is a footprint estimate from measured CPU and peak RSS at 4 vCPU / 16 GB, and excludes token cost._

Beta v0 is live now for testing. It supports /v1/messages for Azure and all /ocr providers today: [docs.litellm.ai/docs/proxy/rust_gateway](https://docs.litellm.ai/docs/proxy/rust_gateway). Next up is /v1/messages for Bedrock Invoke, with support for all known Bedrock auth methods: STS, keys, and IAM.

This is a gradual rollout, one route at a time, each proven in production before the next begins. Same config, same database, same API. There's nothing for you to change.

## Announcing Autorouter V2

Autorouter V2 routes each request to the right model by how hard it is. Four complexity tiers, classified by default with rule-based scoring that needs no training data, no API calls, and under 1 ms of latency.

- **Simple.** "Hello", "What is Python?", "Thanks."
- **Medium.** "Explain how REST APIs work", "Debug this error."
- **Complex.** "Design a microservices architecture", "Implement a rate limiter."
- **Reasoning.** "Think step by step...", "Analyze the pros and cons..."

That default is a heuristic scorer weighing seven signals: token count, code presence, reasoning markers, technical terms, simple indicators, multi-step patterns, and question complexity. The combined score sets the tier (Simple < 0.15, Medium 0.15-0.35, Complex 0.35-0.60, Reasoning > 0.60 or 2+ reasoning markers). V2 adds four ways to make that routing smarter:

1. **An LLM classifier.** Swap the heuristic for a model call (say anthropic/claude-haiku-4-5, with a configurable timeout) to pick the tier. If the classifier errors, times out, or returns something unparseable, it falls back to the heuristic scorer automatically.
2. **Routing that learns.** An adaptive bandit mode watches how each conversation actually goes: does the user have to rephrase or correct the model, does it get stuck repeating itself or run out of tool calls, does the user seem satisfied. That live feedback shifts future routing toward the models that are actually working. Quality-vs-cost weighting (we recommend 30/70), the eligible model pool, and a tier-distance penalty are all configurable.
3. **Tier escalation.** A configured keyword bumps a request one tier higher when it appears in the user's message. Matching is case-sensitive, so a phrase like LITELLM ESCALATE only fires on the exact, shouted form.
4. **Semantic keyword matching.** Keyword overrides already route requests containing specific terms straight to a tier (for example, "invoice, refund, billing" goes to Medium). Semantic matching extends this with an embedding model and a minimum similarity score, trading a little latency for matches that don't need an exact keyword hit.

We shipped Autorouter V2 to get your feedback on it. Try it today:

- **Local CLI**, without upgrading your LiteLLM instance: [docs.litellm.ai/docs/learn/autorouter_cli](https://docs.litellm.ai/docs/learn/autorouter_cli)
- **On Proxy:** [docs.litellm.ai/docs/proxy/auto_routing](https://docs.litellm.ai/docs/proxy/auto_routing)
- **Tell us what breaks:** [GitHub Discussion #32168](https://github.com/BerriAI/litellm/discussions/32168), or #litellm-autorouter on Discord.

## What's next

Thanks again for all the questions and feedback. We'll keep sharing concrete progress as this work ships, especially as we get closer to the August 29 release.

## We're hiring

LiteLLM is the open-source gateway thousands of teams use to run every model behind one API, from startups to the Fortune 500. We move fast: 140 features and 300+ fixes shipped this month alone.

We're hiring a Security Engineer for the core gateway. Small team, huge surface area, real ownership from day one. Want in, or know someone great? Reach us at recruiting@berri.ai.

Thank you for using LiteLLM. **Krrish & Ishaan**

**Questions?** [github.com/BerriAI/litellm](https://github.com/BerriAI/litellm)
