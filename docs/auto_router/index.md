---
title: Auto Router
sidebar_label: Overview
description: Route every request to the cheapest model that can answer it well. Benchmarks, setup, recommended configurations, prompt caching, and how to evaluate the router on your own traffic.
---

import NavigationCards from '@site/src/components/NavigationCards';
import AutoRouterDiagram from '@site/src/components/AutoRouterDiagram';

:::info[🚀 Help shape the Auto-Router]

Get early access, work directly with the LiteLLM team, and influence the roadmap with your production traffic.

<a className="button button--primary button--lg" style={{background: '#2e8555', borderColor: '#2e8555', color: '#fff'}} href="https://calendar.app.google/i2e7qVEJphHi5S8UA">Apply to Become a Design Partner</a>

<br /><br />

Already testing it? Share your results in [discussion #32168](https://github.com/BerriAI/litellm/discussions/32168).

:::

<AutoRouterDiagram />

- **One-click setup.** Configure automatically checks the models your proxy already serves and fills all four tiers for you; no template to pick.
- **One model name in your clients.** The gateway classifies each request and picks the model.
- **Any model, any provider, per tier.** A single model, a random pool, or a Thompson-sampled pool.
- **Three classifiers.** Sub-millisecond heuristic scorer, a small LLM, or keyword rules.
- **Savings reported per request.** Against an all-frontier baseline, in the logs and in Cost Optimization.
- **Agent-safe.** Prompt caching, context-window escalation, modality routing, mid-task stall escalation, and optional session pinning.

## Results

| Result | Measured on | Read more |
| --- | --- | --- |
| Claude Opus-5 solve rate at 27% lower cost | 21-task subset of Terminal-Bench 2.0, 16/21 solved by both | [Terminal-Bench](/blog/auto-router-terminal-bench-benchmark) |
| Heuristic v2: 27% more tasks solved at 45% lower cost per task than v1 | Same 21-task subset, no LLM classifier call | [Heuristic v2](/blog/heuristic-v2) |
| 74.5% cheaper at 87.3% of frontier quality | RouterArena, 8,399 graded queries | [Cost and quality](/blog/auto-router-cost-quality-benchmark) |
| 51.1% saved, $12,249 over four months | 272,876 production requests, 450+ users | [Production case study](/blog/auto-router-production-savings) |
| 37% to 69% cheaper than caching alone | Five datasets including live gateway traffic | [Prompt caching](/blog/auto-router-prompt-caching-benchmark) |
| Matched or beat the current model on 88.1% of responses | Shadow evaluation on live traffic, 143 judged turns | [Shadow evaluations](/blog/auto-router-shadow-evaluations) |

## Quick start

- **Dashboard:** Models + Endpoints, Add Model, Auto Router tab, pick a template, Test Routing, save.
- **Agent:** tell it `run curl -fsSL https://docs.litellm.ai/skills/auto-router and follow the instructions`.
- **config.yaml:** one router entry whose tiers name other models in the same file.

```yaml title="config.yaml" keep-model-ids
model_list:
  - model_name: claude-haiku-4-5
    litellm_params:
      model: anthropic/claude-haiku-4-5
      api_key: os.environ/ANTHROPIC_API_KEY
  - model_name: claude-sonnet-5
    litellm_params:
      model: anthropic/claude-sonnet-5
      api_key: os.environ/ANTHROPIC_API_KEY
  - model_name: claude-opus-5
    litellm_params:
      model: anthropic/claude-opus-5
      api_key: os.environ/ANTHROPIC_API_KEY

  - model_name: smart-router
    litellm_params:
      model: auto_router/complexity_router
      complexity_router_config:
        tiers:
          SIMPLE:    claude-haiku-4-5
          MEDIUM:    claude-sonnet-5
          COMPLEX:   claude-opus-5
          REASONING: claude-opus-5
        classifier_type: heuristic
      complexity_router_default_model: claude-sonnet-5
```

```shell
curl -X POST http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -d '{"model": "smart-router", "messages": [{"role": "user", "content": "What is 2+2?"}]}'
```

## Explore

<NavigationCards
columns={3}
items={[
  {
    title: "Setup",
    description: "Dashboard presets, agent skill, config.yaml, the local CLI, and Claude Code.",
    to: "/docs/auto_router/setup",
  },
  {
    title: "Recommended Configurations",
    description: "1M Context, Anthropic, OpenAI, Gemini, and Lite ladders as config.yaml, plus the benchmark and production configs.",
    to: "/docs/auto_router/recommended_configurations",
  },
  {
    title: "Public Benchmarks",
    description: "Terminal-Bench 2.0, Heuristic v2, RouterArena, classifier context, a production case study, and Fusion.",
    to: "/docs/auto_router/benchmarks",
  },
  {
    title: "Prompt Caching",
    description: "Switching models keeps the cache warm. Measured on five datasets.",
    to: "/docs/auto_router/prompt_caching",
  },
  {
    title: "Evaluate on Your Traffic",
    description: "Shadow evaluations before you switch, savings accounting after.",
    to: "/docs/auto_router/evaluate",
  },
  {
    title: "Feature History",
    description: "Which Auto Router features shipped in which release, with links to the stable GitHub releases.",
    to: "/docs/auto_router/feature_history",
  },
  {
    title: "Configuration Reference",
    description: "Every complexity_router_config key, with defaults.",
    to: "/docs/proxy/auto_routing",
  },
]}
/>

## Release posts

- [Mid-Task Stall Escalation](/blog/auto-router-stall-escalation): bumps a request one tier when it's stuck in a retry loop
- [Auto Router v2](/blog/autorouter-v2): one router for complexity, semantic, and adaptive routing
- [1-click presets and Test Routing](/blog/auto-router-setup-and-testing)
- [Savings tab and per-request classifier cost](/blog/auto-router-spend-visibility)
- [Classifier context and usage benchmarks](/blog/auto-router-context-and-benchmarks)
- [Shadow evaluations](/blog/auto-router-shadow-evaluations)
- [Context-size and modality routing](/blog/auto-router-more-routing-configurations)
