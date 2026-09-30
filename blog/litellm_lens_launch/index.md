---
slug: litellm-lens-launch
title: "Launching LiteLLM Lens"
date: 2026-09-30T09:00:00
authors:
  - ishaan
description: "Your agent swarms already run every model and tool call through LiteLLM. Lens turns that traffic into a trace per run, with real cost on every step, and feeds it back so the next run fails less."
keywords: [litellm lens, agent tracing, agent observability, llm tracing, opentelemetry agents, langgraph tracing, deep agents tracing, ai gateway, agent swarm debugging, llm cost per agent]
image: /img/blog/litellm_lens_launch/lens_hero.gif
tags: [lens, agent-tracing, observability, opentelemetry, ai-gateway, agents]
hide_table_of_contents: true
---

import Head from '@docusaurus/Head';
import { LensHero } from './LensHero';

<Head>
  <meta property="og:image" content="https://docs.litellm.ai/img/blog/litellm_lens_launch/lens_hero.gif" />
  <meta property="og:image:type" content="image/gif" />
  <meta property="og:image:width" content="800" />
  <meta property="og:image:height" content="420" />
  <meta property="og:video" content="https://docs.litellm.ai/img/blog/litellm_lens_launch/lens_hero.mp4" />
  <meta property="og:video:type" content="video/mp4" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:image" content="https://docs.litellm.ai/img/blog/litellm_lens_launch/lens_hero.gif" />
</Head>

<LensHero />

*Last Updated: September 2026*

Agents stopped being one model call a long time ago. A single request to a Deep Agents or LangGraph app fans out into dozens of subagents, each of them calling models and tools, retrying, and handing work back. When one of those runs goes wrong or costs `$4` instead of `$0.40`, you are left reading raw logs from five services to work out which step did it.

Every one of those calls already goes through LiteLLM. The gateway is the one place that sees the whole swarm: every model call, every key and team, every token and every dollar. Today we are launching **LiteLLM Lens**, which turns that traffic into something you can read and act on. Each agent run becomes one trace, with LiteLLM's real cost attached to every step, and the insight from those traces flows back into the gateway so the next run does better.

{/* truncate */}

## What you get

Point your agent's OpenTelemetry exporter at LiteLLM with three environment variables and run it the way you already do. There is no SDK to add and no code to change. A new **Agent Traces** tab on the Logs page lists every run with its input, how many agents and steps it took, its duration, and whether anything failed. A timeline across the top shows your runs over time; drag across it to zoom into a spike.

Open a run and you see the whole swarm as one tree: every agent, every LLM call and every tool call, nested the way they actually ran, with timing on each step. Framework plumbing is hidden by default so the tree reads like your code, not like LangGraph's internals. When a swarm spawns the same subagent a hundred times, those calls fold into one row you can page through, so a 3,000 step run stays readable.

Failed runs open straight on the step that broke, with its error. Every LLM step links to the exact LiteLLM request behind it, so you can tell in one click whether the model, the tool, or the gateway itself (a rate limit, a guardrail, a budget) was the problem. And because LiteLLM already priced that request, the cost you see on each step is the cost you are actually billed.

When you want help, **Copy for agent** gives Claude Code or Codex a single command that pulls the run as Markdown, so your coding agent can debug the trace with you.

## Setup

The proxy admin turns tracing on once:

```yaml
general_settings:
  tracing:
    store: clickhouse
```

and sets `CLICKHOUSE_URL` for the writer and `CLICKHOUSE_READER_URL` for a read-only user. Each developer then sets three variables in their agent's environment:

```shell
export OTEL_EXPORTER_OTLP_ENDPOINT=https://your-litellm-proxy
export OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer $LITELLM_API_KEY"
export OTEL_SERVICE_NAME=my-agent
```

Install the OpenInference instrumentor for your framework and start the app through `opentelemetry-instrument`. LangGraph and Deep Agents, LangChain, the OpenAI Agents SDK, CrewAI, Pydantic AI and LlamaIndex all work, as does anything that emits the standard `gen_ai.*` OpenTelemetry attributes. The first run shows up in the Agent Traces tab within a few seconds. If tracing is not set up yet, the tab shows this guide in place of an empty table, with a prompt you can paste into Claude Code or Codex to wire it up for you.

## Why the gateway

Observability tools that sit beside your agent only see what the agent chooses to report. The gateway sits in the path of every call. It already knows which key and team made each request, which deployment served it, whether it hit the cache, how long the first token took, and exactly what it cost. Lens joins the agent's own OpenTelemetry spans to those gateway records, so the trace carries facts the agent never knew about itself.

That position is also what makes improvement possible. A trace that lives in a separate dashboard can tell you what went wrong; a trace that lives in the gateway can change what happens next. The same system that recorded the failing tool call is the one routing the next request, enforcing the next budget and running the next eval.

## The loop

This is the part we are most excited about. Lens is the first step of a loop: agent traffic flows through LiteLLM, every run lands as a trace, and what we learn from those traces flows back into the gateway. Over the coming releases that means routing that learns which model handles which step of your agent best, prompts and tools that can be compared run against run, and evals built from your real production traces rather than from a fixture you wrote once. Each run through the gateway makes the next one a little better, and you never have to leave LiteLLM to close that loop.

## Access and privacy

Traces follow the same access rules as the rest of LiteLLM. A team member only sees their own team's runs, and admins see everything. Traces are stored in your own ClickHouse, next to your spend logs, so they never leave your infrastructure.

## Try it

Agent Traces ships in the Logs page of the LiteLLM UI. Turn on tracing, point one agent at your proxy, and open your first run. We would love to hear what you find, and what you want the loop to do next.
