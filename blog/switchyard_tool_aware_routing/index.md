---
slug: switchyard-tool-aware-routing
title: "Tool-Aware Model Routing for Coding Agents with NVIDIA NeMo Switchyard"
date: 2026-11-06T09:00:00
authors: [joshua]
description: "LiteLLM now routes each agent turn by its tool execution history, sending routine turns to an efficient model and escalating failed tool calls to a capable one."
tags: [engineering, routing]
hide_table_of_contents: true
---

import { RoutingFlow, SetupToRequest, SessionTimeline } from './diagrams';

**Route each agent turn by its tool execution history.**

A coding agent sends dozens of model calls to finish one task. Most of them are routine: read a file, make a small edit, list a directory. A few are hard: a test suite fails, a build breaks, an edit keeps missing its target. When every turn goes to a frontier model, you pay frontier prices for the routine work too.

LiteLLM now ships NVIDIA NeMo Switchyard's stage router as an auto-router strategy. Switchyard reads the tool calls, tool results and errors in the session and sends each turn to the model it needs. It works on Chat Completions, Anthropic Messages and Responses, so Claude Code, Codex and SDK agents all use it without code changes.

{/* truncate */}

## Route on tool execution, not just the prompt

The last user message rarely tells you how hard the next turn is. The tool history does. A turn that follows a passing test run is different from one that follows three failed tests, even when the user prompt is the same.

Switchyard classifies each turn from that history. It looks at which tools ran, what they returned and which failure signals appeared, such as failing tests, out of memory errors or an edit that keeps failing to apply. Routine turns stay on your efficient model. Failed tool calls escalate to your capable model.

<RoutingFlow />

**Every pick is explainable from the session's own tool history.** When the history does not give a confident answer, Switchyard can ask a judge. You can use an LLM judge or a decision model such as TypeSafe Jev, and the judge only runs for the turns that need it.

## Configure once, serve every agent API

The Add Auto Router form now opens on a single question: which routing strategy do you want? Heuristics remains the default, and Switchyard sits next to it with LLM and Jev. Choose Switchyard, pick a capable model, an efficient model and an optional judge, and save.

<SetupToRequest />

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

## Session-aware, observable and secure by default

A failure rarely ends in one turn. Agents usually need a few more turns to fix what broke. Switchyard holds the session on the capable model while it recovers, then returns to the efficient model once the work is routine again.

<SessionTimeline />

**Routing you can trust in production.** LiteLLM scopes session state to the API key that owns the session, so one caller can never steer another caller's routing. Every decision lands in your spend logs with the model it chose and the evidence behind it, so you can audit cost and quality per session from the same place you track spend.

<div className="cost-launch-note">
<p><strong>Available now</strong></p>
<p>Switchyard is available as an auto-router strategy in LiteLLM. See the <a href="/docs/proxy/auto_routing">auto routing docs</a> to get started. We are building more with the Switchyard team, so tell us what your agents need next.</p>
</div>
