---
title: Auto Router [Add-on]
sidebar_label: Overview
keywords: [autorouter, auto router]
description: Choose a model for each request using prompt complexity or your own rules. Start in Python or set up Auto Router in the LiteLLM gateway.
---

import NavigationCards from '@site/src/components/NavigationCards';
import AutoRouterDiagram from '@site/src/components/AutoRouterDiagram';

Auto Router chooses which model handles each request to your LiteLLM gateway. Your application calls one model name; the router selects from the models you configure based on the prompt or your routing rules. For example, you can send simple questions to a cheaper model and harder tasks to a stronger one.

Building routing into a Python application or agent? Use the [Autorouter SDK](/docs/autorouter_sdk).

<AutoRouterDiagram />

You choose the models for each tier. For each request, the router picks a tier and a model from it.

## Set up in the dashboard

You need a LiteLLM gateway with models already configured and permission to add models. If you do not have a gateway yet, start with the [gateway quickstart](/docs/proxy/quick_start).

1. Open **Models + Endpoints**, then the **Auto Router** tab, and add a router.
2. Give it a name, such as `smart-router`. Click **Configure automatically** to fill the tiers from your deployed models, then review the selections.
3. Use **Test Routing** with a prompt from your application. Check which tier and model it selects. This tests the routing decision without calling the selected model; an LLM classifier can still incur a charge.
4. Click **Add Auto Router** to save it. In your application's requests to the gateway, use `smart-router` as the `model`.

The selected model generates the answer. Try a few of your application's tasks and compare the answers and cost with your current model before switching traffic.

For YAML, the API, or CLI setup, see [Admin Setup](/docs/auto_router/setup). To use the router from Claude Code or Codex, follow [User Setup](/docs/auto_router/user_setup).

To change how the router chooses models, see [Customize your classifier](/docs/auto_router/optimize_classifier). You can also [connect a decision model](/docs/auto_router/decision_classifiers), including Jev, Nimble, Laya, or Databricks `ai_decide`.

## Results

| Result | Measured on | Read more |
| --- | --- | --- |
| JEV: 5.43x as fast as Haiku by median classification latency and 96.12% lower registry-priced classifier cost | 80 authored synthetic cases, three paired repeats, 95.00% vs 73.75% match with authored expected tiers under one fixed rubric | [JEV comparison](/blog/jev-auto-router-benchmark) |
| Claude Opus-5 solve rate at 27% lower cost | 21-task subset of Terminal-Bench 2.0, 16/21 solved by both | [Terminal-Bench](/blog/auto-router-terminal-bench-benchmark) |
| Heuristic v2: 27% more tasks solved at 45% lower cost per task than v1 | Same 21-task subset, no LLM classifier call | [Heuristic v2](/blog/heuristic-v2) |
| 74.5% cheaper at 87.3% of frontier quality | RouterArena, 8,399 graded queries | [Cost and quality](/blog/auto-router-cost-quality-benchmark) |
| 51.1% saved, $12,249 over four months | 272,876 production requests, 450+ users | [Production case study](/blog/auto-router-production-savings) |
| 37% to 69% cheaper than caching alone | Five datasets including live gateway traffic | [Prompt caching](/blog/auto-router-prompt-caching-benchmark) |
| Matched or beat the current model on 88.1% of responses | Shadow evaluation on live traffic, 143 judged turns | [Shadow evaluations](/blog/auto-router-shadow-evaluations) |

## Configure and evaluate

<NavigationCards
columns={3}
items={[
  {
    title: "Admin Setup",
    description: "Create an Auto Router with dashboard presets, an agent skill, config.yaml, or the CLI.",
    to: "/docs/auto_router/setup",
  },
  {
    title: "User Setup",
    description: "Connect Claude Code or Codex with lite configure and see live session savings in Claude Code.",
    to: "/docs/auto_router/user_setup",
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
    description: "Configure prompt caching and compare costs when requests switch models.",
    to: "/docs/auto_router/prompt_caching",
  },
  {
    title: "Evaluate on Your Traffic",
    description: "Shadow evaluations before you switch, savings accounting after.",
    to: "/docs/auto_router/evaluate",
  },
  {
    title: "OTEL Telemetry",
    description: "Trace the selected configuration, routing reason, classifier failures, and retries in Lens or an OTLP backend.",
    to: "/docs/auto_router/telemetry",
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

- [Harness-Aware Routing](/blog/auto-router-harness-aware-classification): Claude Code and Codex context handling, encrypted delegated tasks, and classifier logs
- [Mid-Task Stall Escalation](/blog/auto-router-stall-escalation): bumps a request one tier when it's stuck in a retry loop
- [Auto Router v2](/blog/autorouter-v2): one router for complexity, semantic, and adaptive routing
- [1-click presets and Test Routing](/blog/auto-router-setup-and-testing)
- [Savings tab and per-request classifier cost](/blog/auto-router-spend-visibility)
- [Classifier context and usage benchmarks](/blog/auto-router-context-and-benchmarks)
- [Shadow evaluations](/blog/auto-router-shadow-evaluations)
- [Context-size and modality routing](/blog/auto-router-more-routing-configurations)
