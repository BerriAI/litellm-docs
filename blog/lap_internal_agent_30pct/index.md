---
slug: lap-internal-agent-30-percent
title: "How a background agent on LAP is closing 30% of our engineering tickets"
date: 2026-05-27T10:00:00
authors:
  - ishaan
description: "We turned LiteLLM Agent Platform inward and pointed it at our own backlog. Today a background agent on LAP is shipping ~30% of merged engineering work — bug fixes, metric additions, lint cleanups, doc patches."
tags: [agents, product, lap, lite-harness, engineering]
hide_table_of_contents: false
---

A few months ago we shipped [LiteLLM Agent Platform (LAP)](https://github.com/BerriAI/litellm-agent-platform) — a self-hosted control plane for running coding agents in real sandboxes. We built it for our enterprise customers. The first team it ended up changing was our own.

Today a single background agent running on LAP is closing **~30%** of our merged engineering work on `BerriAI/litellm`.

{/* truncate */}

The setup is heavily inspired by Ramp's ["Why we built our background agent"](https://builders.ramp.com/post/why-we-built-our-background-agent) — same thesis (one autonomous loop, picks tickets, sends PRs), built on our own infra.

## What it actually does

The agent watches our Linear queue. When a ticket lands that matches a "small, well-scoped" profile — a failing test, a missing Prometheus label, a stack-trace from prod — it picks it up, branches off `main`, writes the fix in its sandbox, runs the tests, and opens a PR against `BerriAI/litellm`. A human reviews and merges.

A few recent examples — all picked up, fixed, and PR'd by the agent without a human touching the code:

- [#29016 — `fix(otel): normalize unhashable scope in _emit_once`](https://github.com/BerriAI/litellm/pull/29016) (LIT-3299)
- [#29015 — `fix(proxy): populate Exception.args so str(ProxyException) returns message`](https://github.com/BerriAI/litellm/pull/29015) (LIT-3094)
- [#28743 — `fix(mcp): handle OAuth IdP error responses in /callback`](https://github.com/BerriAI/litellm/pull/28743) (LIT-2750)
- [#28548 — `feat(datadog): emit litellm.overhead.latency as a standalone Datadog metric`](https://github.com/BerriAI/litellm/pull/28548)
- [#28372 — `feat(prometheus): emit per-token-type detail metrics`](https://github.com/BerriAI/litellm/pull/28372) (LIT-3220)
- [#27873 — `fix: strip Gemini thought-signature suffix from non-streaming tool_use.id`](https://github.com/BerriAI/litellm/pull/27873)

These are not toy diffs. They're the long tail of "obvious, blocking, hard to prioritize" work that used to sit in our backlog for weeks.

## What it looks like in the UI

{/* TODO: replace with real screenshot — open https://litellm-agent-platform.onrender.com/sessions/<a recent agent session> and capture the chat + Inspect tab side-by-side */}

![Background agent session in LAP](/img/lap_agent_session_placeholder.png)

Every run is a LAP session: a sandboxed pod, scoped credentials (GitHub, Linear, the LiteLLM gateway), and a live transcript you can audit. The "Inspect" tab streams the raw opencode event bus — every tool call, every reasoning step, every model token — so when something goes sideways we can see exactly where the loop went off.

## Swappable harness layer via `lite-harness`

The interesting bit, infrastructurally, is that LAP doesn't bake in the agent loop. It calls out to a harness service over HTTP. The harness is a separate, self-contained image at [`BerriAI/lite-harness`](https://github.com/BerriAI/lite-harness) — one folder per supported runtime (`opencode`, `claude-agent-sdk`, …), one contract, one shared UI.

That separation is what made this experiment cheap. We can:

- Swap which harness a given agent uses without touching LAP code
- Run a private opencode build against a different gateway model with a single env var change
- Stand up a public lite-harness UI for the agent's own sessions (a chat window onto the same pod LAP talks to), with a Bearer-token gate, on its own Render service

Internally, the same agent has run on opencode and on the claude-agent-sdk harness across different weeks. The PR throughput barely budged — which is the point. The loop is the product, not the model wrapper.

## Why this works at all

Three things had to be true for "30% of merged work" to be real and not a vanity stat:

1. **Cheap sandboxes.** LAP gives the agent an E2B sandbox per session — its own filesystem, git, `gh` CLI, the LiteLLM gateway. No shared state, no cross-session contamination.
2. **A boring, high-volume queue.** Most of LiteLLM's tickets are "this metric is missing a label" / "this exception's `str()` returns nothing" / "this provider rejects this header." The agent excels there. Anything that needs cross-file design we still write by hand.
3. **Trust gates.** Every PR goes through human review. The agent doesn't merge. It can branch, push, and open a PR with screenshots — and that's where its authority ends.

We're not claiming the agent replaces engineers. We're claiming that a well-instrumented background loop, sitting on top of our own gateway and our own sandboxes, can clear the boring 30% of the backlog so engineers can spend their hours on the other 70%.

## Want the same setup?

LAP is open source: [github.com/BerriAI/litellm-agent-platform](https://github.com/BerriAI/litellm-agent-platform). The harness layer it depends on lives at [github.com/BerriAI/lite-harness](https://github.com/BerriAI/lite-harness). Both are self-hosted, both run on a single Render service or your own K8s cluster.

If you want help wiring it into your own backlog, open an issue on either repo or [book a demo](https://calendly.com/d/4mp-gsd-vhf/litellm-cloud-and-self-hosted-).
