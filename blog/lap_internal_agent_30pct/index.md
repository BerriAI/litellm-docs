---
slug: lap-internal-agent-30-percent
title: "Three calls we'd have gotten wrong building our background agent"
date: 2026-05-27T10:00:00
authors:
  - ishaan
description: "A background coding agent on LiteLLM Agent Platform has shipped 21 merged PRs and triages our Slack — but only because we didn't give it BASH, made it report blockers, and built on a harness instead of an agent framework."
tags: [agents, product, lap, lite-harness, engineering]
hide_table_of_contents: false
---

Coding agents are converging on the wrong shape.

Most of what's being built today is a copilot — a model with autocomplete reach, sitting next to your cursor. That's fine for typing assistance. It's not where the leverage is. The leverage is in a process that owns part of your backlog and ships PRs while you do other work.

We've spent the last three weeks pointing [LiteLLM Agent Platform (LAP)](https://github.com/BerriAI/litellm-agent-platform) at our own queue. Today a single background agent has 21 merged PRs on `BerriAI/litellm`, ~50 PRs filed per month, owns the Slack `#help-litellm` triage, and posts blocker comments on Linear before a human triages them.

Three calls made that work. We'd have gotten all three wrong if we'd done the obvious thing.

{/* truncate */}

## 1. The brain doesn't get BASH

The first instinct, when you're building a coding agent, is to give it a shell. Spin up one sandbox per session, drop the agent process inside, let it run `bash` and `git` and `pytest` natively. That's how most demos look.

We shipped it that way first. It nearly killed the project.

The Slack rollout exposed the failure mode. Someone in `#help-litellm` would ask a small question — "how does SCIM map our SSO groups to Teams?" — and the bot would acknowledge, then sit silent for two full minutes before the answer started streaming. Every new question paid the full cold-start cost: provision a new sandbox, install dependencies, boot the agent, load context.

![Shin's two-minute cold start in Slack](/img/lap_shin_slack_slow_start.png)

The architecture was wrong. Bundling the brain (the model loop, the context, the planning) with the sandbox (the filesystem, the shell, the executables) meant every session paid the worst-case startup of both. And worse, scaling the brain meant scaling the sandbox alongside it — every session held an idle VM whether or not the agent needed one in the next minute.

So we split them. Anthropic's [Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) frames the LLM as an "augmented brain" with retrieval, tools, and memory bolted onto it. We took that one step further and made the augmentation **physically** separate: the brain runs in a persistent harness pod shared across many sessions; the sandbox is a per-session E2B pod accessed only through tool calls.

![Brain in the harness, sandbox per session, four tools between them](/img/lap_brain_sandbox_split.svg)

The brain's tool surface is exactly four things: `sandbox_provision`, `sandbox_execute`, `sandbox_read_file`, `sandbox_write_file`. **No BASH on the harness.** Not because we don't trust the model — because the harness is shared. One stray `rm -rf` and we'd corrupt the host running ten other sessions.

Two things happened after the split:

- **Cold start dropped from 2 minutes to under 2 seconds.** The brain is already warm; the sandbox lazy-spins on the first `sandbox_execute`. Slack questions feel synchronous.
- **The brain got braver.** When the worst case is "the sandbox dies and gets reprovisioned," the model tries more aggressive fixes — running tests, force-pushing, rewriting whole files — that you'd never approve if the worst case were "the harness dies and takes nine other sessions with it."

This is the change that took a demo into something we'd let answer customer questions.

## 2. Make the agent report when it's stuck

Default agent loops fail silently. The model decides it can't make progress, emits one more vague paragraph, and the trace ends with a half-done diff nobody can use.

We shipped without a self-report path for the first week. The PR queue filled with garbage — PRs that almost passed tests, PRs that fixed the wrong file, PRs whose Linear ticket was ambiguous and the agent guessed. 138 of the agent's PRs have been closed without merging. That number was the symptom.

So we gave the agent a `report_issue` tool. When the brain hits something it can't resolve from sandbox state alone — a credential it can't find, a fixture that doesn't exist, an ambiguous acceptance criterion — it stops the loop and posts a comment back on the originating Linear ticket explaining what it tried and what it'd need to continue.

The week we shipped it, the agent's PR-filing rate went *down* and its Linear-comment rate went *up*. That is the right shape. A loop that knows it's stuck is more valuable than one that pretends it isn't. Engineers triage the comment, supply the missing context (a doc link, a credential binding, a clarified spec), and the agent re-picks the ticket cleanly on the next pass.

It also keeps the merge bar high. The 21 PRs that landed are ones the agent could actually defend; the rest became tickets it flagged for humans, not noise reviewers had to filter.

## 3. A harness, not an agent framework

The third call was the one we re-litigated the most.

Agent frameworks — LangGraph, OpenAI's Agents SDK, the Python and TS wrappers — give you a function: `runAgent({ task, tools, model })`. You `await` it. It returns. That is the abstraction.

That abstraction is wrong for production. Real agent runs:

- Stream tokens to a UI for minutes, sometimes hours
- Survive deploys (the loop has to outlive a `kubectl rollout`)
- Get inspected mid-flight (humans need to see what the brain is doing *right now*)
- Get cancelled, paused, and resumed
- Persist their event bus so a reconnecting client gets the full transcript

None of that fits a function call. All of it fits an HTTP server.

So we picked a **harness** — a long-running process ([opencode](https://opencode.ai/) under the hood) that exposes the agent loop as REST endpoints: `POST /session`, `POST /session/:id/message`, `GET /event` (SSE), `POST /session/:id/abort`. LAP is a thin client. The agent loop is a server.

That decision made the harness layer cheap to swap. We split it into its own repo, [`BerriAI/lite-harness`](https://github.com/BerriAI/lite-harness): one folder per supported runtime (`opencode`, `claude-agent-sdk`, …), one HTTP contract, one shared UI. LAP doesn't know which harness is behind a session. Internally we've run the same agent on opencode and on claude-agent-sdk across different weeks. Throughput barely budged — which is the point. The loop is the product, not the framework wrapping it.

## What it's actually shipping

Three weeks in, on `BerriAI/litellm`: 21 PRs merged, 41 open, 138 closed without merging, 50+ filed per month. Plus the Slack triage volume the agent absorbs that we'd otherwise be answering by hand.

Representative merged PRs, end-to-end with no human touching the code:

- [#29016 — `fix(otel): normalize unhashable scope in _emit_once`](https://github.com/BerriAI/litellm/pull/29016)
- [#28548 — `feat(datadog): emit litellm.overhead.latency as a standalone Datadog metric`](https://github.com/BerriAI/litellm/pull/28548)
- [#28372 — `feat(prometheus): emit per-token-type detail metrics`](https://github.com/BerriAI/litellm/pull/28372)
- [#27873 — `fix: strip Gemini thought-signature suffix from non-streaming tool_use.id`](https://github.com/BerriAI/litellm/pull/27873)

The long tail of "obvious, blocking, hard to prioritize" work that used to sit in the backlog for weeks.

## Try it

LAP is open source: [github.com/BerriAI/litellm-agent-platform](https://github.com/BerriAI/litellm-agent-platform). The swappable harness layer it depends on lives at [github.com/BerriAI/lite-harness](https://github.com/BerriAI/lite-harness). Both self-hosted, both run on a single Render service or your own K8s.

If you're trying to build the same thing inside your team and want to skip the three weeks of mistakes — open an issue on either repo, or [book a demo](https://calendly.com/d/4mp-gsd-vhf/litellm-cloud-and-self-hosted-).

*Inspired in shape by Ramp's [Why we built our background agent](https://builders.ramp.com/post/why-we-built-our-background-agent).*
