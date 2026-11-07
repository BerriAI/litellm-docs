---
slug: switchyard-tool-aware-routing
title: "Tool-Aware Model Routing for Coding Agents with NVIDIA NeMo Switchyard"
date: 2026-11-06T09:00:00
authors: [joshua]
description: "LiteLLM now steers each coding agent session by its tool execution history, keeping routine work on an efficient model and escalating to a capable model when the trajectory turns hard."
tags: [engineering, routing]
hide_table_of_contents: true
---

import { RoutingFlow, ConfigureRouter, SessionTimeline } from './diagrams';

LiteLLM now ships NVIDIA NeMo Switchyard's stage router as an auto-router strategy. Switchyard routes on the agent's tool trajectory rather than the prompt: the tools it invoked, how they failed and whether it is converging or retrying the same step. Each turn is steered to the model the session needs at that point in the task.

Coding agents have an uneven cost profile. Most of a task is exploration and incremental edits that an efficient model handles well. The expensive stretches are concentrated around failures, where the agent has to diagnose an error, revise its approach and verify the fix. Switchyard aligns model spend with that profile across Chat Completions, Anthropic Messages and Responses, so Claude Code, Codex and SDK-based agents adopt it without client changes.

{/* truncate */}

## Steer the session by its tool trajectory

Prompt-based routing breaks down for agents because the user message carries little signal about difficulty. A follow-up such as "continue" looks the same after a passing test run and after the third failed attempt at a fix. The difference lives in the tool results.

Switchyard classifies each turn from the session's recent tool history. Failures are weighted by severity, from a non-zero exit through to a critical error. Repeated identical failures and context compaction force an escalation. A passing test run after a failure is recognized as recovery. The resulting score maps the turn to the efficient or the capable model.

<RoutingFlow />

**Every routing decision is traceable to the trajectory that produced it.** When the tool signals are inconclusive, Switchyard can defer to a judge, either an LLM judge or a decision model such as TypeSafe Jev. The judge is invoked only for those turns, so confident decisions add no latency or cost.

## Configure once, serve every agent API

Switchyard is a first-class strategy in the Add Auto Router form, alongside Heuristics, LLM and Decisions Model. A router needs a capable model, an efficient model and, optionally, a judge.

<ConfigureRouter />

**A single router name serves Claude Code, Codex and OpenAI SDK agents.** Request translation across the three APIs happens in the proxy, so the routing behavior is identical regardless of which client is calling. The equivalent config is a few lines of YAML.

```yaml
model_list:
  - model_name: claude-haiku
    litellm_params: {model: anthropic/claude-haiku-5-5, api_key: os.environ/ANTHROPIC_API_KEY}
  - model_name: claude-opus
    litellm_params: {model: anthropic/claude-opus-5-5, api_key: os.environ/ANTHROPIC_API_KEY}
  - model_name: switchyard-route
    litellm_params:
      model: auto_router/switchyard
      switchyard_router_config:
        models: {capable: claude-opus, efficient: claude-haiku}
```

Claude Code connects by pointing at the proxy and using the router name as its model.

```bash
ANTHROPIC_BASE_URL=http://localhost:4000 ANTHROPIC_AUTH_TOKEN=$LITELLM_API_KEY ANTHROPIC_MODEL=switchyard-route claude
```

## Trajectory-aware routing treats the session as the unit

Per-request routing has a structural blind spot with agents. Resolving a failure spans several turns: reading the error, revising the code, rerunning the tests. A per-request router evaluates each of those turns in isolation, and the first clean intermediate result is enough to drop the session back to the efficient model mid-fix.

Switchyard maintains state for the session. Failure signals are evaluated over a rolling window of recent tool results, so a hard failure continues to count while the agent works through it. An escalation places a hold on the capable model for the turns that follow. When the trajectory stabilizes and the work returns to routine, the session steps back down.

<SessionTimeline />

The window size and confidence threshold are configurable. Custom tool vocabularies extend the built-in classification, so internal or MCP tools can be declared as observe, mutate, plan or new and contribute to the same signals.

**Session state is isolated and every decision is auditable.** LiteLLM scopes session state to the API key that owns it, so one caller cannot influence another's routing. Each decision is recorded in spend logs with the selected model and the evidence behind it, which lets you analyze cost and quality per session alongside the rest of your spend data.

<div className="cost-launch-note">
<p><strong>Available now</strong></p>
<p>Switchyard is available as an auto-router strategy in LiteLLM. See the <a href="/docs/proxy/auto_routing">auto routing docs</a> to get started. We are building more with the Switchyard team, so tell us what your agents need next.</p>
</div>
