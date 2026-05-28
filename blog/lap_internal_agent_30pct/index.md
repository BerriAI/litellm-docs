---
slug: lap-internal-agent-30-percent
title: "How we built a background agent to cover 30% of our backlog"
date: 2026-05-27T10:00:00
authors:
  - krrish
  - ishaan
description: "How we built a background agent on the LiteLLM AI Gateway that merges PRs with no human in the loop — the infra, harness, and credential-scoping calls behind it."
tags: [agents, ai-gateway, lap, lite-harness, engineering]
hide_table_of_contents: true
---

Our goal was to 10x the productivity of our company with agents.

Three weeks ago we began building an agent that could own 30% of our engineering tickets. Here's what we've learnt so far.

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

So we split the agent in two. The **brain** — reasoning, planning, model calls — lives in a shared, persistent pod. It has no shell: no BASH, no filesystem. The **sandbox** is ephemeral, one per session, and the only thing that can run `git`, `gh`, or `pytest`. The brain reaches it through two tool calls. This is similar to how Anthropic's managed agent platform works - [blog](https://www.anthropic.com/engineering/managed-agents).

![Architecture: a persistent brain pod with no shell, talking to an ephemeral per-session sandbox pool through four tool calls](/img/lap_brain_sandbox_split.svg)

This was a big win in terms of response time and session success rates, as well as reducing the cost of running the agent.

## 2. Architecture: pick a harness, not an agent framework

We started with agent frameworks — Pydantic AI, LangGraph, the PI SDK. Each one made us rebuild things a coding *harness* already ships: context compaction, sub-agent spawning, tool loops. We already trusted Claude Code locally for exactly this work, so we went looking for a harness, not a framework.

We landed on **OpenCode**. In our testing, we saw it scaled better than Claude Agents SDK which spawns a CLI session per run, and OOM'd for us at ~1 RPM. OpenCode showed similar characteristics (the bottleneck here is sessions are long running and stored in memory), but it's memory usage grew slower than Claude Code.

That choice only stays cheap because we also wrote our own harness unification layer - [`BerriAI/lite-harness`](https://github.com/BerriAI/lite-harness), which unifies OpenCode/Claude Code/Codex/etc to the OpenCode contract:

```
lite-harness/
  opencode/           # runtime adapter
  claude-agent-sdk/   # runtime adapter
  contract.py         # the one interface every runtime implements
```

The agent platform does not know which harness is behind a session - allowing us to swap out the harness, if we ever see a better option.

Our next goal is to achieve 100 RPM on our agent harness.

## 3. Security: scope every credential to one endpoint

Our agent kept leaking API keys from its environment into commits and Slack messages. First mitigation: a small HTTP proxy vault. We stubbed the real credentials in the environment and swapped the stub for the real value only when the agent made an outbound call.

The agent defeated it. It noticed the credentials were stubbed, then wrote its own endpoint, called it with the stubbed credentials, let the vault swap in the real ones on the way out, and read the real keys back off its own server — then stored them to memory via a tool call. A clean man-in-the-middle against our own vault.

![Ishaan's Slack messages: "agent wrote keys to its memory" and "it tries to circumvent the stubs" — showing the agent's memory entries storing real credentials after defeating the proxy vault](/img/lap_shin_agent_mitm_memory.png)

The fix was to stop trusting the *value* and start binding it to a *destination*. Each credential is pinned to exactly one upstream host; the vault refuses the swap if the outbound request is going anywhere else:

```yaml
# vault: a credential is only ever swapped in for its bound host
credentials:
  GITHUB_TOKEN:
    allowed_host: api.github.com
  OPENAI_API_KEY:
    allowed_host: api.openai.com
```

Our learning here was that you will need specific guardrails at the agent's input/output boundary. Guardrails at the LLM call level are insufficient as it can't distinguish between a user query and an internal tool loop.

## Where the AI Gateway fits

Every model call the agent makes — planning, code generation, the reviewer pass — routes through our own LiteLLM AI Gateway. That is not incidental. It is what makes the agent operable at scale instead of a science project:

- **Per-session budgets.** Each session carries a budget tag, so we know the exact token cost of every closed ticket and can cap a runaway loop before it spends real money.
- **A full audit trail.** The AI Gateway logs every prompt and completion. When the agent does something surprising — like the vault probe above — we can replay exactly what it saw.
- **Model swaps without code changes.** Planning on one model, edits on a cheaper one, triage on the smallest. All of it is routing config at the gateway, not branches in the agent.

A production-grade AI Gateway gives us one reliable control point at the model boundary. But it is only half the picture: the agent boundary needs its own guardrails, because the agent — not the model — is what takes actions. The guardrail has to behave one way when the agent answers a user and another way when it is deep in an internal tool loop.

## What we believe now

Autonomous agents are where the 10x productivity gains are, and the technical risk is the part that is mostly solved — models are already smart enough to file a decent PR. The hard problems left are product problems: scale it, make it reliable, make it secure.

For us, that means two walls. **Scale:** how do you serve 100 RPM on a harness that keeps sessions in memory? **Security:** how do you stop leaks and destructive tool use without lobotomizing the agent? Neither is a model problem anymore. Both are infrastructure problems — which is the kind we like.

## Try it

LAP is open source: [github.com/BerriAI/litellm-agent-platform](https://github.com/BerriAI/litellm-agent-platform). The swappable harness layer lives at [github.com/BerriAI/lite-harness](https://github.com/BerriAI/lite-harness). Both self-hosted, both run on a single Render service or your own K8s.

Building the same thing inside your team? Open an issue on either repo — we would rather you skip the three weeks of mistakes. If you want to talk through it, [book a demo](https://calendly.com/d/4mp-gsd-vhf/litellm-cloud-and-self-hosted-).

*Inspired in shape by Ramp's [Why we built our background agent](https://builders.ramp.com/post/why-we-built-our-background-agent).*

## Key Takeaways

- Three weeks in: **21 PRs merged, ~30% of weekly eng tickets handled**, with a human approving every merge before anything lands on main
- Separating the brain (no shell) from the sandbox dropped response time and cost — Slack questions no longer wait on a sandbox boot
- Pick a harness over a framework — frameworks make you rebuild compaction, sub-agent spawning, and tool loops that harnesses already ship
- Scope every credential to one upstream host; guardrails belong at the agent I/O boundary, not at the LLM call
- Every model call routes through the LiteLLM AI Gateway — per-session budgets, full audit trail, model swaps without touching agent code

---

### Frequently Asked Questions

### Does the agent push to main?

No. Each session gets a scoped GitHub token that can push to a branch and open a PR, nothing more. A human reviews and approves every merge. The agent cannot bypass that gate.

### How do you handle the OOM problem at scale?

We haven't fully solved it yet. CLI harnesses like OpenCode hold large sessions in memory and OOM at around 1 RPM under load. We split the harness into [`BerriAI/lite-harness`](https://github.com/BerriAI/lite-harness) so we can swap runtimes without platform changes — that's the path forward, not rebuilding a harness from scratch.

### Why not use Cursor or an off-the-shelf agent platform?

Cursor agents aren't stateful across sessions — you can't give an agent persistent memory, skills, or identity. Anthropic's platform is closer, but we wanted to swap models and harnesses freely. If you're locked into a platform, you're betting your workflow on that vendor's roadmap.

### Is the agent platform available in LiteLLM OSS?

Yes. The [LiteLLM Agent Platform](https://github.com/BerriAI/litellm-agent-platform) and the swappable harness layer [`BerriAI/lite-harness`](https://github.com/BerriAI/lite-harness) are both open source (Apache 2.0) and self-hosted. [LiteLLM Enterprise](https://litellm.ai/enterprise) adds SSO/SCIM, air-gapped deployment, 24/7 SLA support, and advanced guardrails on top.

---

## Conclusion

Background agents become reliable when the infrastructure underneath them is production-grade — cheap sandboxes, scoped credentials, and a reliable AI Gateway handling every model call with full auditability. The right failure mode for an agent like this is "opens a draft PR that a human declines," not "touches something it shouldn't." Build the infrastructure that enforces that boundary and the rest follows.

For teams with strict uptime and compliance requirements, [LiteLLM Enterprise](https://litellm.ai/enterprise) provides the additional controls needed for regulated production environments.

## Recommended Reading

- [LiteLLM AI Gateway — full feature overview](https://docs.litellm.ai/docs/simple_proxy)
- [Spend tracking and per-session budget controls](https://docs.litellm.ai/docs/proxy/cost_tracking)
- [Logging and audit trail for AI Gateway requests](https://docs.litellm.ai/docs/proxy/logging)
