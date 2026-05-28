---
slug: lap-internal-agent-30-percent
title: "How we built a background agent to cover 30% of our backlog"
date: 2026-05-27T10:00:00
authors:
  - ishaan
description: "A background coding agent on LiteLLM Agent Platform has shipped 21 merged PRs and triages our Slack — but only because we didn't give it BASH, made it report blockers, and built on a harness instead of an agent framework."
tags: [agents, product, lap, lite-harness, engineering]
hide_table_of_contents: false
---

This post covers our early learnings across infrastructure, architecture, and security challenges as we build our own background agent to cover 30% of our engineering backlog. You can see its PRs [here](https://github.com/BerriAI/litellm/pulls?q=is%3Apr+author%3Aoss-agent-shin).

{/* truncate */}

To deliver this, we decided to build an agent which could run autonomously, in the background, taking tickets from our Linear board and filing PRs for us. We evaluated Cursor and Anthropic's managed agent platforms, but neither felt like a good fit for our needs.

- Cursor - their agents were not stateful - i.e. you could not store memory, skills, etc. per agent. Their platform equated an agent to a session, which is not what we wanted.

- Anthropic - this was close to what we wanted, but we wanted the flexibility to swap models and harnesses easily. We didn't want to be locked into their platform.

## What we shipped

Three weeks in, on `BerriAI/litellm`: **21 PRs merged**, 41 open, 50+ filed per month, plus the Slack triage volume the agent absorbs that we'd otherwise answer by hand. Together that's ~30% of our weekly ticket throughput.

It also closed 138 PRs without merging — and that's by design. Sessions are cheap, so the agent attempts liberally and we discard freely. A closed PR costs us almost nothing; a ticket sitting in the backlog for weeks costs us a lot more.

Representative merged PRs, end-to-end with no human touching the code:

- [#29016 — `fix(otel): normalize unhashable scope in _emit_once`](https://github.com/BerriAI/litellm/pull/29016)
- [#28548 — `feat(datadog): emit litellm.overhead.latency as a standalone Datadog metric`](https://github.com/BerriAI/litellm/pull/28548)
- [#28372 — `feat(prometheus): emit per-token-type detail metrics`](https://github.com/BerriAI/litellm/pull/28372)
- [#27873 — `fix: strip Gemini thought-signature suffix from non-streaming tool_use.id`](https://github.com/BerriAI/litellm/pull/27873)

This is the long tail of "obvious, blocking, hard to prioritize" work that used to sit in the backlog for weeks. Here's what it took to get there.

## 1. Infrastructure: separate the agent from the sandbox

We initially tried to run the agent in the sandbox. This is similar to [Ramp Inspect's](https://builders.ramp.com/post/why-we-built-our-background-agent) approach, but this meant that each new session spawned a sandbox, which was slow and expensive. If an internal user is asking a technical question, there is no need to spawn a sandbox for this - just a few tool calls would suffice.


This is when we decided to decouple the agent from the sandbox. This was a big win in terms of improving our response time and session success rates, as well as reducing the cost of running the agent.

If you're curious to learn more, we recommend reading Anthropic's blog post on [this](https://www.anthropic.com/engineering/managed-agents).


## 2. Architecture: pick a harness, not an agent framework

We initially experimented with Pydantic AI, Langgraph, and PI SDK. But they required us to rebuild a lot of components that harnesses already have (like compaction, sub-agent spawning, etc). Our goal was to build an agent which could file PR's and answer technical questions for us, and we knew Claude Code was good for this - we used it locally, so it felt natural to look for that (or something similar) for handling PR's for us. 

We eventually ended up with Opencode, because we saw it scaled better than the other options (Claude Agents SDK spawns a CLI session for each run, which led to OOM's at ~ 1 RPM). 

That decision made the harness layer cheap to swap. We split it into its own repo, [`BerriAI/lite-harness`](https://github.com/BerriAI/lite-harness): one folder per supported runtime (`opencode`, `claude-agent-sdk`, …), one HTTP contract, one shared UI. The agent platform doesn't know which harness is behind a session. Internally we've run the same agent on opencode and on claude-agent-sdk across different weeks.


Our current challenge here is around scaling the harness. CLI Harnesses store large sessions in-memory leading to OOM's. We'd like to avoid rebuilding the harness (Opencode/claude code/codex seem quite focused on that), but we want something that can run autonomously, reliably and allow all members of our team to use it.



## 3. Security: agents leak credentials easily

A problem we faced was our agent including the API keys from the environment in commit or slack messages. We initially mitigated this with a simple HTTP Proxy Vault. We stubbed the credentials in the environment, and swapped them if the agent used the stubbed credentials in the headers. 

However, the agent noticed it was given stubbed credentials, and ran a MITM attack to get the real credentials. It wrote a fake endpoint, ran the request to call it with stubbed credentials, the vault swapped out the stubbed credentials with the real credentials, and the agent got the real credentials, which it subsequently stored to its memory via a tool call. 

The fix was straightforward - we simply mapped the credentials to an endpoint. This way your github token could only be used to call the github API, and not any other API.

We're still in the early stages of this, but securing the agent runtime is a big challenge. The checks are a mix of architectural decisions, cpu-level guardrails and model level guardrails. Our goal is to secure the agent input/output, which means the guardrail needs to run at the agent level, not at the LLM level.


## Learnings 

We believe autonomous agents are where the 10x productivity gains are. The technical risk is limited - models seem like they are smart enough to file a decent PR. The challenges are now around the product - how do you scale this, make it reliable and make it secure.

The biggest challenges are around scaling the harness (how do you serve 100 RPM with OpenCode?) and securing the agent (prevent leaks, destructive tool usage, etc). 

The AI Gateway as an access point, felt critical, but there are controls we need at the Agent level as well (e.g. running guardrails when the agent is responding to a user query vs. when it's running an internal tool loop).

## Try it

LAP is open source: [github.com/BerriAI/litellm-agent-platform](https://github.com/BerriAI/litellm-agent-platform). The swappable harness layer it depends on lives at [github.com/BerriAI/lite-harness](https://github.com/BerriAI/lite-harness). Both self-hosted, both run on a single Render service or your own K8s.

If you're trying to build the same thing inside your team and want to skip the three weeks of mistakes — open an issue on either repo, or [book a demo](https://calendly.com/d/4mp-gsd-vhf/litellm-cloud-and-self-hosted-).

*Inspired in shape by Ramp's [Why we built our background agent](https://builders.ramp.com/post/why-we-built-our-background-agent).*
