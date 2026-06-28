---
slug: june-townhall-updates
title: "June Townhall Updates: 94 Bug Fixes, OCR + Realtime are in Rust, and a Zero-Regression Commitment"
date: 2026-06-26T12:00:00
authors:
  - krrish
  - ishaan-alt
description: "A recap of the June LiteLLM town hall covering security hardening, our zero-regression commitment, 78 feature commits, and the gradual migration of the gateway to Rust."
tags: [townhall, security, reliability, product]
hide_table_of_contents: false
---

import Image from '@theme/IdealImage';

<Image
  img={require('../../img/june_townhall_updates_banner.png')}
  style={{width: '100%', height: 'auto', display: 'block', borderRadius: '12px'}}
/>

Thank you to everyone who joined our June town hall.

Three numbers capture the month: **24 security fixes**, **94 bug fixes**, and **78 feature commits**. The sections below break each one down, alongside our public commitment to zero reported regressions and the gradual migration of the LiteLLM gateway to Rust.

{/* truncate */}

## Security updates

### Last 4 weeks: by the numbers

| Metric | Count |
|---|---|
| Vulnerabilities patched | **24** |

### Bug bounty — now live

We pay for security reports.

- **Scope** — the LiteLLM gateway and SDK.
- **Submit** via [private vulnerability report on GitHub](https://github.com/BerriAI/litellm/security).
- **Triaged** by maintainers and the Veria Labs security team.

### Automated review on every PR

Every PR gets a security pass. Look for the **Veria scan** — it's a required check on every PR, built on Veria AI + zizmor + semgrep. False positives are flagged, never blocking.

### What's next for security

- Invest more in the bug bounty program.
- Improve code patterns during the stability sprint.

## Stability updates

### The commitment: zero reported regressions by August 29th

The goal:

- Close 20 reported bugs in core functionality.
- Fix root causes in 3 high-impact components.
- Ship a public progress report alongside the August 29 release.

### 94 bug fixes done

Fixes shipped across five areas:

- Proxy core & resilience — 22 fixes
- UI + Auth / SSO — 22 fixes
- Cost, Budgets & Observability — 21 fixes
- MCP Gateway — 15 fixes
- Streaming / Realtime APIs — 14 fixes

**What kinds of fixes shipped:**

- **Billing accuracy.** Closed the gaps where spend slipped through — virtual-key limits are now enforced, and cached and tiered usage on Anthropic and Bedrock is priced correctly.
- **Identity & access.** Caller identity now resolves once into a single record, so team IDs and spend attribution stay correct and auth no longer fails open on DB errors.
- **MCP reliability.** Tools now list and call consistently across every auth method, with per-user credentials and proper OAuth token refresh.
- **Resource leaks.** Guardrails no longer re-initialize on every request, eliminating the runner leaks, latency spikes, and OOMs they caused.
- **Resilience.** Streaming requests recover cost on interruption, the proxy self-heals on dropped DB connections, and OTEL metrics no longer overload Splunk.

**Root causes, not just symptoms:**

- **MCP authentication** — 5 separate code paths, one per auth method, caused inconsistent tool listing and calling. Fix: a single unified code path resolves credentials across all auth methods.
- **AI gateway auth** — 5+ DB lookups per request to resolve key/user/team identity. Fix: caller identity resolves once into a single record — lookups cut roughly in half.
- **UI forms** — saving a form could overwrite unrelated fields. Fix: frontend and backend types are 100% in sync from a shared source, so only edited fields change on save.

### Public timeline

Bug triage is open and active on [GitHub issue #30484](https://github.com/BerriAI/litellm/issues/30484).

- **NOW** — 20 bugs open in core. Triage active.
- **JULY** — MCP auth unified to a single code path. AI gateway identity lookups cut in half.
- **AUGUST** — UI form types synced end-to-end. No more silent field overwrites on save.
- **AUG 29** — Public progress report ships with the release. Zero-regression target date.

## Product updates

### 78 feature commits in June

**Rust**

- Rust workspace · Mistral OCR bridge
- OpenAI Realtime translation layer

**Sandbox API**

- E2B + OpenSandbox
- Unified code execution API

**New models/providers**

- TinyFish · Fal.ai · Fireworks AI
- Cloudflare Workers AI · MAI-Image-2.5

### Performance: moving LiteLLM to Rust

We're migrating the LiteLLM gateway to Rust, and the early numbers make the case:

| Metric | Rust gateway | LiteLLM (Python) | Improvement |
|---|---|---|---|
| Per-request overhead | 0.05ms | 7.5ms | ~150x lower |
| Throughput under load | 6,782 req/s | 453 req/s | 15x |
| Peak memory under load | 32MB | 359MB | 11x lighter |

*Per-request overhead measured at 10 concurrent clients vs. a local mock upstream; throughput and memory under sustained load at 50 concurrent clients. Reproducible harness checked in.*

**How the migration works:** a staged rollout, moving piece by piece from a pure Python SDK + FastAPI proxy, to Python driving Rust transforms via PyO3, to a FastAPI shell with pure Rust on the hot path, to an all-Rust async server (axum).

**A gradual rollout** — one route at a time, proven in production before the next begins. Same config, database, and API: nothing for you to change.

- **Aug 15** — OCR routes: Mistral first, then all OCR.
- **Sep 1** — `/messages`, then `/chat/completions`.
- **Sep 15** — The router: load balancing, fallbacks, retries, cooldowns.
- **Dec 1** — The full server: FastAPI thin shell, then pure Rust (axum).

### Announcing our version policy

Going forward, we'll maintain only the four most recent stable minor releases. This takes effect **next Monday, June 29th**. Our focus is ensuring stability on the most up-to-date product offerings — bookmark our [Release Notes](https://docs.litellm.ai/release_notes) to stay current.

## What's next

Thank you again for all the questions and feedback. We'll keep sharing concrete progress updates as these efforts ship — especially as we approach the August 29 zero-regression milestone.

## Hiring

We are actively hiring across several roles — apply [here](https://jobs.ashbyhq.com/litellm) if you're interested!

Thank you for using LiteLLM - Krrish & Ishaan
