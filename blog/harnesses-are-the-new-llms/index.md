---
slug: harnesses-are-the-new-llms
title: "Harnesses Are the New LLMs"
date: 2026-06-10T09:00:00
authors:
  - krrish
description: "The same deployment pattern that emerged with LLMs — routing, fallbacks, observability, central billing — is now emerging with harnesses. Here's why the AI Gateway layer is moving up the stack."
tags: [harnesses, ai-gateway, agents, thesis, infrastructure]
hide_table_of_contents: true
---

*Last Updated: June 2026*

Three years ago, every team picked one LLM. Then they picked two. Then they hit the same wall: how do you route between them, fall back when one is down, track spend across both, and audit who called what? That wall is what an AI Gateway solves.

The same wall is forming one layer up. Teams started with one harness — Claude Code, Codex, or Cursor. They're already running two. By next quarter they'll run three. The deployment pattern that emerged for LLMs is repeating, exactly, for harnesses.

{/* truncate */}

## The pattern from LLMs

The LLM pattern took about 18 months to play out, and every team went through the same four stages:

1. **Single provider.** Pick OpenAI. Ship the feature. Done.
2. **Second provider.** Anthropic releases Claude. Eval shows it wins on a critical task. Now you're maintaining two SDKs, two key sets, two billing dashboards, two retry policies.
3. **Routing pressure.** One provider has an outage. The other is rate-limiting. Cost spikes on one model. You need to route traffic dynamically — by latency, by error rate, by budget.
4. **Gateway.** Central place to manage keys, route requests, fall back on failure, track spend per team, audit every call. The AI Gateway becomes the seam between application code and provider APIs.

The endpoint of this pattern wasn't optional. Every Enterprise AI Gateway deployment we've seen converged on it because the alternative — N integrations, N retry policies, N audit logs — does not scale across teams.

## Why harnesses follow the same path

A harness is the loop around a model: tool-calling, context management, file edits, agent state. Claude Code, Codex, Aider, Cursor, OpenCode, Pi AI — different harnesses, different strengths, different prompt formats, different tool semantics.

Right now, most teams are at stage 1 with harnesses. One team standardized on Claude Code. Another team picked Codex. A platform team is evaluating Aider for batch refactors.

Stage 2 is already here. Vendors are releasing harnesses faster than teams can pick winners. The same eval pressure that drove LLM-shopping — "this one is 12% better on our task" — applies one layer up. You don't pick *the* harness any more than you picked *the* LLM.

Stage 3 follows mechanically:

- A harness vendor has an outage. Your batch agent stops.
- One harness costs 3x more per task than another on the same model. Budget owners want routing.
- Different harnesses win on different task types. Refactors → harness A. Test writing → harness B.
- Security teams want one audit log across every harness invocation, not N.

Stage 4 is the AI Gateway, but for harnesses.

## The harness stack maps onto the model stack

The model stack settled into three layers. Each layer is now reappearing one level up, for harnesses:

| Layer | Models | Harnesses |
|---|---|---|
| Unified API | **LiteLLM** — one API across 100+ models | **Lite-Harness SDK** — one API across Claude Code, Codex, Pi AI |
| Deployment platform (OSS) | **SageMaker**, **Vertex** — deploy OSS models | **AWS AgentCore**, **Google Agent Platform** — deploy OSS harnesses (OpenCode, Hermes) |
| Cloud inference (managed) | **Bedrock**, **Azure OpenAI** — managed model APIs | **Claude Managed Agents** — managed harness API |
| High-performance server | **vLLM**, **TGI** — high-throughput inference | *Open slot* — high-throughput harness server |

Two cells fill themselves in. One is still open: a high-performance server for harnesses — batching agent runs, sharing context across runs, packing tool calls. The model layer needed vLLM to make OSS models economical at scale. Harnesses will need the same thing once batch agents move to production.

## What an AI Gateway for harnesses looks like

The gateway responsibilities map almost one-to-one from LLMs to harnesses:

| LLM gateway | Harness gateway |
|---|---|
| Route by model name | Route by harness + model |
| Fall back to backup provider | Fall back to backup harness |
| Per-team budgets, per-key spend | Per-team agent budgets, per-key task spend |
| Audit log of every LLM call | Audit log of every agent run |
| Standardized request/response shape | Standardized agent invocation shape |
| Provider-side key management | Harness-side key management |

The shape of the seam is the same. What changes is *what* flows through it: instead of a single completion call, an agent run with tool invocations, file edits, and streamed messages.

LiteLLM's AI Gateway already sits at the LLM seam for thousands of deployments. The harness layer is the natural extension — same gateway, one layer up.

## The unified harness API

Last week we shipped [Lite-Harness SDK](https://docs.litellm.ai/blog/lite-harness-sdk) — a unified TypeScript and Python API across Claude Code, Codex, and Pi AI. Swap harnesses by changing a string, same way you swap models in LiteLLM today.

```python
from lite_harness import query, AgentOptions

prompt = "Fix the failing test"

# Claude Code harness
async for message in query(
    prompt=prompt,
    options=AgentOptions(harness="claude-code", model="claude-opus-4-8"),
):
    print(message)

# Codex harness — same prompt, same code shape
async for message in query(
    prompt=prompt,
    options=AgentOptions(harness="codex", model="gpt-5.5"),
):
    print(message)
```

Point it at the LiteLLM AI Gateway with two environment variables and every underlying model call routes through the gateway — keys, budgets, fallbacks, audit log:

```bash
export LITELLM_API_BASE=https://litellm.your-company.com/v1
export LITELLM_API_KEY=sk-litellm-...
```

This is the same deployment shape teams already run for LLMs. Application code targets a uniform interface. The gateway handles the messy parts — keys, routing, spend tracking, fallback policy — without leaking into every call site.

## What changes at scale

Three things change when harnesses become the unit of routing instead of models:

**Failure modes get bigger.** An LLM failure costs one request. A harness failure costs an entire agent run — minutes of tool calls, partial file edits, half-finished state. Fallback policy has to account for resumable runs and idempotent tool use, not just retries.

**Spend tracking gets coarser and finer at the same time.** Coarser because a single agent run can burn 50+ model calls. Finer because teams want to attribute spend per task, per agent, per harness — not per token. The gateway needs to roll up correctly at every layer.

**Audit gets more interesting.** "Who called GPT-5?" is a one-line answer. "Which agent edited this file, using which harness, running which tools, on whose budget?" is a join across harness, model, tool calls, and identity. The gateway is the only place that sees all of it.

These are the kinds of failure modes a production-grade AI Gateway is designed for before they appear. The work LiteLLM has done at the LLM layer — circuit breakers, fallback policies, per-key budgets, central audit — is exactly the work the harness layer needs next.

## Key Takeaways

- The LLM deployment pattern — multi-provider, gateway-fronted — is repeating at the harness layer
- Every layer of the model stack has a harness equivalent: unified API, OSS deployment platform, managed cloud, high-perf server
- Lite-Harness SDK fills the unified-API slot; AWS AgentCore and Claude Managed Agents fill the deployment/managed slots; the high-perf harness server slot is still open
- An AI Gateway for harnesses solves the same problems: routing, fallback, spend, audit — one layer up
- Harness-level failures are bigger than model-level failures, which makes resilient gateway behavior more important, not less

---

### Frequently Asked Questions

### Isn't this just an SDK abstraction? Why does the gateway matter?

The SDK gives you uniform invocation. The gateway gives you uniform *operation* — keys, budgets, fallbacks, audit, rate limiting, observability. At one harness those are nice-to-haves. At three, they're how you keep production reliable.

### Won't harnesses converge on one winner?

LLMs haven't, after four years. Harnesses won't either. Each one wins on a different task profile — refactors vs. test writing vs. batch agents vs. interactive editing. Multi-harness is the steady state, not a transition phase.

### How is harness routing different from model routing?

Model routing picks an endpoint. Harness routing picks a *loop* — what tools the agent has, how context is managed, how tool calls are structured. Routing decisions can compose: "use harness A with model X for refactors, harness B with model Y for tests."

### Is this available in LiteLLM OSS?

Yes. [Lite-Harness SDK](https://github.com/LiteLLM-Labs/lite-harness) is MIT-licensed. LiteLLM AI Gateway is Apache 2.0. [LiteLLM Enterprise](https://litellm.ai/enterprise) adds SSO/SCIM, air-gapped deployment, 24/7 SLA support, and advanced guardrails on top.

---

## Conclusion

The seam moves up the stack. The job stays the same: route reliably, fall back gracefully, track spend, audit every call. A production-grade AI Gateway is the layer where all of that lives — first for LLMs, now for harnesses.

The right failure mode looks the same in both layers: one component degrades, the gateway routes around it, the audit log records what happened, and the team keeps shipping. This is how AI Gateway infrastructure should behave under pressure.

For teams with strict uptime and compliance requirements, [LiteLLM Enterprise](https://litellm.ai/enterprise) provides the additional controls needed for regulated production environments.

## Recommended Reading

- [Lite-Harness SDK — Unified API for Claude Code, Codex, and Pi AI](https://docs.litellm.ai/blog/lite-harness-sdk)
- [LiteLLM AI Gateway — full feature overview](https://docs.litellm.ai/docs/simple_proxy)
- [Load balancing and routing across 100+ LLM providers](https://docs.litellm.ai/docs/routing)
