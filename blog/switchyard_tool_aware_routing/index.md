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

LiteLLM now ships NVIDIA NeMo Switchyard's stage router as an auto-router strategy. Switchyard follows your agent's tool trajectory (what it ran, what broke, what it keeps retrying) and steers the session to the model the work needs. It works across Chat Completions, Anthropic Messages and Responses, so Claude Code, Codex and SDK agents get it without client changes.

A coding agent spends most of a task exploring: reading files, making small edits, running commands that pass. A few stretches are hard: a test suite that keeps failing, a build that breaks, an edit that will not apply. Routing each request on its own prompt misses that shape. Switchyard routes the session.

{/* truncate */}

## Steer the session by its tool trajectory

The prompt rarely tells you how hard the next turn is. The trajectory does. A turn that follows a clean test run and a turn that follows the third failed attempt at the same fix can carry the same user message, but they need very different models.

Switchyard scores every turn against the session's recent tool history. It weighs how severe each failure was, from a non-zero exit to a critical error. It notices when the agent repeats the same broken step, when context gets compacted and when tests pass again. Exploration stays on your efficient model. When the trajectory turns hard, the session escalates to your capable model.

<RoutingFlow />

**Every pick is explainable from the session's own trajectory.** When the signals do not give a confident answer, Switchyard can hand the turn to a judge, either an LLM judge or a decision model such as TypeSafe Jev. The judge only runs for the turns that need it.

## Configure once, serve every agent API

The Add Auto Router form opens on a single question: which routing strategy do you want? Switchyard sits next to Heuristics, LLM and Decisions Model. Pick it, choose your models and save.

<ConfigureRouter />

**One router serves Claude Code, Codex and OpenAI SDK agents without client changes.** If you manage LiteLLM in config, the same router is a few lines of YAML.

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

Point Claude Code at the proxy and use the router name as the model.

```bash
ANTHROPIC_BASE_URL=http://localhost:4000 ANTHROPIC_AUTH_TOKEN=$LITELLM_API_KEY ANTHROPIC_MODEL=switchyard-route claude
```

## Trajectory-aware routing: the session is the unit

Hard problems do not end in one turn. After a failure, an agent usually needs a few turns to read the error, change the code and run the tests again. A router that only looks at the latest request would flip back to the efficient model the moment one command succeeds, right in the middle of the fix.

Switchyard keeps state for the whole session. Failure signals persist across a rolling window of recent tool results, so a hard failure keeps counting while the agent recovers. An escalation holds the session on the capable model for the turns that follow. Once tests pass and the work turns routine, the session steps back down. You can tune the window, the confidence threshold and even teach Switchyard your own tools as observe, mutate, plan or new.

<SessionTimeline />

**Session routing you can trust in production.** LiteLLM scopes session state to the API key that owns the session, so one caller can never steer another caller's routing. Every decision lands in your spend logs with the model it chose and the evidence behind it, so you can trace cost and quality across a whole session from the same place you track spend.

<div className="cost-launch-note">
<p><strong>Available now</strong></p>
<p>Switchyard is available as an auto-router strategy in LiteLLM. See the <a href="/docs/proxy/auto_routing">auto routing docs</a> to get started. We are building more with the Switchyard team, so tell us what your agents need next.</p>
</div>
