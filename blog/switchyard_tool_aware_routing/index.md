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

LiteLLM now ships NVIDIA NeMo Switchyard's stage router as an auto-router strategy. It changes what a router looks at. Instead of judging each request by its prompt, Switchyard reads your agent's tool trajectory, meaning the commands it ran, the ones that failed and the steps it keeps retrying. It uses that history to steer the whole session to the right model.

Think about how a coding agent actually spends a task. Most turns are routine. It reads a file, makes a small edit, runs a command that passes. Then it hits something hard, like a test suite that keeps failing or an edit that will not apply, and it needs a stronger model for a few turns. Switchyard gives you exactly that, on Chat Completions, Anthropic Messages and Responses, so Claude Code, Codex and SDK agents get it without changing a line of client code.

{/* truncate */}

## Steer the session by its tool trajectory

The prompt is a poor guide to how hard the next turn will be. "Continue" can follow a clean test run, or it can follow the third failed attempt at the same fix. Same words, very different amount of work.

The tool trajectory tells you which one you are in. So Switchyard scores every turn against the session's recent tool results. It weighs how bad each failure was, from a command that exited non-zero up to a crash. It notices when the agent repeats the same broken step, when the context gets compacted and when the tests start passing again.

While the agent is exploring cleanly, the session stays on your efficient model. When the trajectory turns hard, Switchyard escalates the session to your capable model. You pay for the expensive model only during the stretches that need it.

<RoutingFlow />

**You can explain every pick from the session's own history.** Some turns are genuinely unclear. For those, Switchyard can ask a judge, either an LLM judge or a decision model such as TypeSafe Jev. The judge only runs on the turns that need it, so it adds no cost to the rest.

## Configure once, serve every agent API

Setting it up takes a minute. Open the Add Auto Router form, pick Switchyard as your routing strategy, choose your two models and save.

<ConfigureRouter />

**One router name works for Claude Code, Codex and OpenAI SDK agents.** If you manage LiteLLM in config, the same router is a few lines of YAML.

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

Then point Claude Code at the proxy and use the router name as the model.

```bash
ANTHROPIC_BASE_URL=http://localhost:4000 ANTHROPIC_AUTH_TOKEN=$LITELLM_API_KEY ANTHROPIC_MODEL=switchyard-route claude
```

## Trajectory-aware routing treats the session as the unit

This is the part that makes Switchyard different from a per-request router.

Fixing a hard problem takes several turns. After a failure, the agent reads the error, changes the code and runs the tests again. A router that only looks at the latest request sees one successful command and drops back to the cheap model halfway through the fix.

Switchyard remembers the session instead. Recent failures stay in a rolling window, so a hard failure keeps counting while the agent works through it. After an escalation, Switchyard holds the session on the capable model for the next turns. Once the tests pass and the work is routine again, the session steps back down to the efficient model.

<SessionTimeline />

You can tune how this behaves. Set the size of the window, set the confidence threshold, or teach Switchyard about your own tools by tagging them as observe, mutate, plan or new.

**Session routing you can trust in production.** LiteLLM keeps each session's state separate per API key, so one caller can never change another caller's routing. Every decision is written to your spend logs with the model it chose and the reason it chose it. You can trace cost and quality across a whole session from the same place you already track spend.

<div className="cost-launch-note">
<p><strong>Available now</strong></p>
<p>Switchyard is available as an auto-router strategy in LiteLLM. See the <a href="/docs/proxy/auto_routing">auto routing docs</a> to get started. We are building more with the Switchyard team, so tell us what your agents need next.</p>
</div>
