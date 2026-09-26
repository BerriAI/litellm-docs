---
slug: liteagents-sdk
title: "Introducing liteagents"
date: 2026-09-25T10:00:00-07:00
authors: [moe]
description: "Switch agent harnesses without rewriting your agent. Keep your tools and model configuration, use native harness controls, and add Temporal when you need durable runs."
tags: [agents, sdk]
hide_table_of_contents: true
image: ./hero.png
---

![Introducing liteagents: switch agent harnesses without rewriting your agent. A code example changes the harness from Deep Agents to Claude Agent SDK while keeping the model and tools.](./hero.png)

You've built an agent with your own tools, prompts, and model configuration. Now you want to try a different harness on the same task.

**liteagents lets you switch agent harnesses without rewriting your application.** Choose Deep Agents, Pydantic AI, Claude Agent SDK, Codex, or OpenCode through one Python SDK. Keep your tools, MCP connections, model configuration, and client code.

LiteLLM gives you a common interface to models. liteagents brings that approach to agent harnesses, with native controls and optional durability through Temporal.

{/* truncate */}

## Change one field to try another harness

An agent harness runs the loop around a model: supplying context, calling tools, and deciding when to continue. Different harnesses approach that work differently. You should be able to compare them on your own tasks without rebuilding the surrounding application.

In liteagents, the harness is a field in your profile:

```python
profile = ProfileOptions(
    harness="deepagents",  # Try "claude-sdk", "codex", or "pydantic-ai".
    model="litellm_proxy/my-model",
    model_kwargs=gateway_settings,
    tools=["lookup_order"],
)

options = LiteAgentOptions(profile=profile, tools=[lookup_order])
async with LiteAgentClient(options=options) as agent:
    async for message in agent.query("Check the status of order A123."):
        print(message)
```

This excerpt uses your existing `lookup_order` tool and gateway alias. `gateway_settings` holds the gateway's `api_base` and `api_key`. Once you've installed the harness you want to try, change `harness` and run the same application.

Install only the harness integrations you plan to use. Extras such as `[deepagents]` supply that adapter's dependencies and reuse compatible packages in your Python environment. `[all]` is a convenience for trying every integration; OpenCode also needs its executable. Changing the profile selects which harness runs.

liteagents adapts your tools, MCP configuration, and events to each harness. LiteLLM handles model translation internally, so switching harnesses keeps the same model connection. You can use a provider directly or connect through a LiteLLM gateway. Profiles also load from JSON or YAML.

## Keep the harness's native controls

Each harness still runs its own agent loop. Through `harness_options`, you can use supported native settings such as Deep Agents middleware and backends or Pydantic AI tool timeouts.

Shared configuration makes switching straightforward; native options let you tune the harness you've chosen. Those options remain specific to that harness, and your model must support the settings you request. Switching selects a harness for new runs; it doesn't migrate an ongoing native session.

## Add Temporal when you need durable runs

A simple agent runs locally without Temporal or PostgreSQL. When a job needs to survive a worker restart or keep running after the client disconnects, add Temporal to the profile and run a worker. Your application keeps the same client API.

Durable runs recover recorded operations and checkpoints after worker failure. You can start locally with SQLite, then use self-hosted Temporal or Temporal Cloud. Tools that perform external actions still need idempotency if an interrupted action may be retried.

## Try it on your agent

The SDK is available as a preview. Follow the [getting-started guide](https://github.com/BerriAI/liteagents/blob/main/docs/getting-started.md), or install the package from the [latest preview release](https://github.com/BerriAI/liteagents/releases/tag/v0.3.0a1).

Start with the [harness-switching cookbook](https://github.com/BerriAI/liteagents/blob/main/cookbook/recipes/10_harness_switch.py). It runs the same model, Python tool, MCP tool, and follow-up across all six harness selectors. Add `--temporal` to try the same task with durability. The [cookbook collection](https://github.com/BerriAI/liteagents/blob/main/cookbook/recipes/README.md) also covers streaming, approvals, subagents, and worker recovery.

Try your workflow on another harness and [tell us how it goes](https://github.com/BerriAI/liteagents/issues).
