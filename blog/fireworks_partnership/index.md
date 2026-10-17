---
slug: fireworks-partnership
title: "LiteLLM × Fireworks AI: 73% of Agent Turns for 14 Cents"
date: 2026-09-21T10:00:00
authors:
  - moe
description: "In a SWE-bench Verified run, DeepSeek V4 Flash on Fireworks handled 277 of 382 agent turns for $0.14 total, while the run matched fixed Opus-5 quality at 46% lower cost."
keywords: [fireworks ai, open models, agent cost, llm routing, swe-bench, deepseek, auto router, litellm]
tags: [partnership, routing, cost, benchmarks, fireworks]
hide_table_of_contents: false
---

Most of what a coding agent does is not hard. It reads files, greps, and runs tests. Only a fraction of its turns are the actual edits, and that is where the reasoning lives.

We measured what happens when the easy majority runs on an open model served by Fireworks AI.

{/* truncate */}

## The result

We ran mini-SWE-agent over 12 SWE-bench Verified tasks twice, once on fixed `anthropic/claude-opus-5` and once through a router that picks a model per agent phase, then scored both with the official SWE-bench harness. Exploration went to `fireworks_ai/deepseek-v4-flash`, verification to Haiku, and implementation to Opus.

Fixed Opus resolved 9 of the 12 tasks, so the head-to-head below is restricted to those 9 for a fair comparison. Across them, quality was identical and cost was not.

| | Fixed Opus | Phase router |
|---|---|---|
| Tasks resolved | 9 / 9 | 9 / 9 |
| Total LLM cost | $2.82 | $1.51 |
| Cost per solved task | $0.31 | $0.17 |

The interesting number is where the turns went. This second table covers all 382 turns of the full 12-task run, so its costs do not sum to the 9-task router total above:

| Model | Turns | Share | Cost |
|---|---|---|---|
| `fireworks_ai/deepseek-v4-flash` (explore) | 277 | 73% | $0.14 |
| `claude-haiku-4-5` (verify) | 38 | 10% | $0.34 |
| `claude-sonnet-5` (opening) | 12 | 3% | $0.08 |
| `claude-opus-5` (implement) | 55 | 14% | $2.56 |

The opening turns of a session, before any tool call has established a phase, go to the default model, Sonnet, which is the 12 turns on that row.

Seventy-three percent of every turn the agent took cost fourteen cents in total. Exploration is close to free once it runs on a model priced for it, and Fireworks is where that model lives.

## The config

```yaml title="config.yaml"
- model_name: subtask-type-router
  litellm_params:
    model: auto_router/complexity_router
    complexity_router_default_model: anthropic/claude-sonnet-5
    complexity_router_config:
      classifier_type: custom
      classifier_plugin: subtask_type_classifier.subtask_type_classifier
      classifier_fallback: default_model
      deployment_affinity: true
      tiers:
        SIMPLE:                          # explore
          - fireworks_ai/deepseek-v4-flash
        MEDIUM:                          # verify
          - anthropic/claude-haiku-4-5
        COMPLEX:                         # implement
          - model_name: anthropic/claude-opus-5
            litellm_params:
              reasoning_effort: high
```

The router reads the agent's tool-call history, classifies each call as explore, implement, or verify, and only switches phase once a new one has held for two consecutive calls. There is no classifier LLM in the path, so the routing decision costs nothing and lands in well under a millisecond.

## Why Fireworks for the cheap tier

A phase router only pays off if the cheap tier is genuinely cheap and genuinely fast. Agent loops are latency-sensitive in a way single-shot prompts are not, because a session spends hundreds of turns there.

LiteLLM supports every model Fireworks serves, so the tier can be tuned to the workload without leaving the provider. Version 1.90.0 alone added 24 of them, including DeepSeek V4 Pro, GLM, Kimi K2.6 and K2.7, MiniMax M3, Qwen3.7 Plus, and both GPT-OSS sizes. Fireworks routes and account-hosted deployments resolve through the same model names, and prompt caching stays warm across turns because LiteLLM sends the Fireworks session affinity header from a caller-supplied session id rather than a per-request trace id.

## What this is and is not

This is an experiment. Twelve tasks is a small sample, mini-SWE-agent is a simpler loop than most production agents, and the phase taxonomy is a first cut that will need work on agents whose tool vocabularies look different. We are running it against more traffic before drawing firmer conclusions.

What we are confident about is the shape of the finding. The bulk of agent work does not need a frontier model, and the cost of getting that wrong compounds over every turn of every session.

Read the full methodology in [Subtask-Specific Routing](/blog/subtask-type-routing), or set up Fireworks models on your gateway with the [Fireworks AI provider docs](/docs/providers/fireworks_ai).
