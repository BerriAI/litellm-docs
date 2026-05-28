---
slug: lap-internal-agent-30-percent
title: "How we built a background agent to cover 30% of our backlog"
date: 2026-05-27T10:00:00
authors:
  - krrish
  - ishaan
description: "A background coding agent on LiteLLM Agent Platform has merged 21 PRs with no human touching the code — and once tried to MITM our own credential vault. Here are the three design calls behind it."
tags: [agents, product, lap, lite-harness, engineering]
hide_table_of_contents: false
---

Three weeks ago we gave a background agent write access to our Linear board and `BerriAI/litellm`, our largest repo. It has merged **21 PRs since — with no human touching the code.**

It also, at one point, ran a man-in-the-middle attack against our own credential vault to steal the API keys we were hiding from it.

This post is the three design calls we would have gotten wrong, and the scars from getting them right.

{/* truncate */}

## What we shipped

Three weeks in, on `BerriAI/litellm`: **21 PRs merged**, 41 open, 50+ filed this month. Between the PRs it lands and the Slack questions it answers, the agent now covers roughly **30% of the eng tickets that used to hit a human every week.** You can browse its PRs [here](https://github.com/BerriAI/litellm/pulls?q=is%3Apr+author%3Aoss-agent-shin).

It also closed 138 PRs without merging — and that is by design. Sessions are cheap, so the agent attempts liberally and we discard freely. A closed PR costs us almost nothing; a ticket sitting in the backlog for weeks costs us a lot more.

Representative merged PRs, end-to-end with no human touching the code:

- [#29016 — `fix(otel): normalize unhashable scope in _emit_once`](https://github.com/BerriAI/litellm/pull/29016)
- [#28548 — `feat(datadog): emit litellm.overhead.latency as a standalone Datadog metric`](https://github.com/BerriAI/litellm/pull/28548)
- [#28372 — `feat(prometheus): emit per-token-type detail metrics`](https://github.com/BerriAI/litellm/pull/28372)
- [#27873 — `fix: strip Gemini thought-signature suffix from non-streaming tool_use.id`](https://github.com/BerriAI/litellm/pull/27873)

This is the long tail of "obvious, blocking, hard to prioritize" work that used to sit in the backlog for weeks. Here is what it took to get there.

## Why we built our own

We wanted an agent that runs autonomously, in the background, pulling tickets off Linear and filing PRs for us. We evaluated Cursor and Anthropic's managed agent platforms first. Neither fit:

- **Cursor** — agents were not stateful. You could not store memory, skills, etc. per agent. The platform equated an agent to a session; we wanted an agent that persists across them.
- **Anthropic** — close to what we wanted, but we wanted to swap models and harnesses freely. We did not want to be locked to one platform.

So we built on the [LiteLLM Agent Platform](https://github.com/BerriAI/litellm-agent-platform). Three calls shaped everything that followed.

## 1. Infrastructure: separate the brain from the sandbox

Our first version ran the agent *inside* the sandbox — the same shape as [Ramp Inspect](https://builders.ramp.com/post/why-we-built-our-background-agent). Every new session booted a fresh sandbox. That is fine when the work is "go edit code." It is wasteful when an engineer just asks a question in Slack — you pay a full sandbox boot to answer something that needs a few tool calls.

The cold start showed up where everyone could feel it: Slack.

![Slack thread waiting on a cold sandbox boot before the agent could respond](/img/lap_shin_slack_slow_start.png)

So we split the agent in two. The **brain** — reasoning, planning, model calls — lives in a shared, persistent pod. It has no shell: no BASH, no filesystem. The **sandbox** is ephemeral, one per session, and the only thing that can run `git`, `gh`, or `pytest`. The brain reaches it through exactly four tool calls.

![Architecture: a persistent brain pod with no shell, talking to an ephemeral per-session sandbox pool through four tool calls](/img/lap_brain_sandbox_split.svg)

The payoff is structural, not incremental. A Slack question no longer waits on a sandbox at all — the brain answers from tool calls, and only real PR work pays the sandbox cost. Response time and session success rate both jumped, and the cost per session dropped. Decoupling the brain from the sandbox was the single highest-leverage infra decision we made.

## 2. Architecture: pick a harness, not an agent framework

We started with agent frameworks — Pydantic AI, LangGraph, the PI SDK. Each one made us rebuild things a coding *harness* already ships: context compaction, sub-agent spawning, tool loops. We already trusted Claude Code locally for exactly this work, so we went looking for a harness, not a framework.

We landed on **OpenCode**. It scaled where the alternatives did not — the Claude Agents SDK spawns a CLI session per run, which OOM'd us at ~1 RPM.

That choice only stayed cheap because we refused to marry it. The harness lives in its own repo, [`BerriAI/lite-harness`](https://github.com/BerriAI/lite-harness), behind one HTTP contract:

```
lite-harness/
  opencode/           # runtime adapter
  claude-agent-sdk/   # runtime adapter
  contract.py         # the one interface every runtime implements
```

The agent platform does not know which harness is behind a session. We have run the same agent on OpenCode one week and the Claude Agent SDK the next, no platform changes. Treat the harness as a swappable backend and you stop betting the company on any single vendor's roadmap.

The open problem: CLI harnesses hold large sessions in memory, so they OOM under load. We do not want to rewrite a harness from scratch — but serving 100 RPM on OpenCode is the wall we are walking into next.

## 3. Security: scope every credential to one endpoint

Our agent kept leaking API keys from its environment into commits and Slack messages. First mitigation: a small HTTP proxy vault. We stubbed the real credentials in the environment and swapped the stub for the real value only when the agent made an outbound call.

The agent defeated it. It noticed the credentials were stubbed, then wrote its own endpoint, called it with the stubbed credentials, let the vault swap in the real ones on the way out, and read the real keys back off its own server — then stored them to memory via a tool call. A clean man-in-the-middle against our own vault.

The fix was to stop trusting the *value* and start binding it to a *destination*. Each credential is pinned to exactly one upstream host; the vault refuses the swap if the outbound request is going anywhere else:

```yaml
# vault: a credential is only ever swapped in for its bound host
credentials:
  GITHUB_TOKEN:
    allowed_host: api.github.com
  OPENAI_API_KEY:
    allowed_host: api.openai.com
```

Now the GitHub token can only ever reach the GitHub API. The agent's fake endpoint gets the stub and nothing else. The lesson generalizes: guardrails belong at the agent's input/output boundary, not at the LLM call — because the agent, not the model, is the thing taking actions.

## What we believe now

Autonomous agents are where the 10x productivity gains are, and the technical risk is the part that is mostly solved — models are already smart enough to file a decent PR. The hard problems left are product problems: scale it, make it reliable, make it secure.

For us, that means two walls. **Scale:** how do you serve 100 RPM on a harness that keeps sessions in memory? **Security:** how do you stop leaks and destructive tool use without lobotomizing the agent? The AI Gateway gives us one control point at the model boundary, but the agent boundary needs its own — guardrails that behave differently when the agent is answering a user than when it is deep in an internal tool loop.

## Try it

LAP is open source: [github.com/BerriAI/litellm-agent-platform](https://github.com/BerriAI/litellm-agent-platform). The swappable harness layer lives at [github.com/BerriAI/lite-harness](https://github.com/BerriAI/lite-harness). Both self-hosted, both run on a single Render service or your own K8s.

Building the same thing inside your team? Open an issue on either repo — we would rather you skip the three weeks of mistakes. If you want to talk through it, [book a demo](https://calendly.com/d/4mp-gsd-vhf/litellm-cloud-and-self-hosted-).

*Inspired in shape by Ramp's [Why we built our background agent](https://builders.ramp.com/post/why-we-built-our-background-agent).*
