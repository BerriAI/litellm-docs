---
slug: auto-router-heuristic-tuning
title: "AutoRouter: Tune Heuristics for Your Traffic"
date: 2026-09-08T10:00:00
authors:
  - tin
description: "Tune AutoRouter heuristics for specific workloads, measure cost per correct task, track classifier overhead, and configure tiers from models you already serve."
keywords: [auto router, heuristic routing, dimension weights, model routing, llm benchmark, litellm]
tags: [routing, complexity-router, benchmarks, engineering, product]
hide_table_of_contents: false
---

# AutoRouter: Tune Heuristics for Your Traffic

Heuristic v1 scores seven prompt signals, including reasoning language, code, technical terms, and prompt length. You can tune those signals for the traffic your router serves.

We tested that idea on a balanced 240-prompt mix:

| Configuration | Accuracy | Cost / 1K prompts | Estimated cost / 1K correct tasks |
| --- | ---: | ---: | ---: |
| Default Heuristic v1 | 90.8% | $2.90 | **$3.19** |
| Workload-tuned Heuristic v1 | **95.2%** | **$3.85** | **$4.04** |
| All Opus | 94.9% | $9.53 | $10.04 |

We calculate cost per 1,000 correct tasks as `cost per 1,000 prompts / accuracy`.

- The tuned configuration raised accuracy by **4.4 percentage points** over the default.
- That gain cost **26.6% more per correct task** than the default.
- The tuned configuration matched all-Opus accuracy at **59.7% lower cost per correct task**.
- A separate held-out search kept accuracy at **91.3%** while cutting cost per correct task by **12%**.

A useful profile depends on your traffic. Code-heavy workloads and support questions reward different routing choices.

{/* truncate */}

## Tune the signals your workload uses

You can tune:

- `reasoningMarkers`, `multiStepPatterns`, and `questionComplexity` for reasoning-heavy prompts.
- `codePresence` and `technicalTerms` for code and domain-specific traffic.
- `tokenCount` and `simpleIndicators` for prompt length and low-complexity cues.
- A custom dimension for workload-specific vocabulary or structure.

For a useful comparison:

- Start with a held-out sample from your traffic.
- Keep the model ladder and test set fixed.
- Change one signal family at a time and inspect which prompts move tiers.
- Compare accuracy, cost per completed task, latency, and tier distribution.

The [shadow evaluation workflow](/docs/auto_router/evaluate) tests a candidate on sampled production traffic without changing the response your user receives.

## See classifier overhead per 1,000 turns

An LLM classifier adds one model call before the routed request. You can now track that overhead:

- AutoRouter records the charge as `classifier_cost`.
- The `x-litellm-classifier-cost` header covers Chat Completions, Responses, and Messages APIs.
- Our 5,600-call classifier-context benchmark topped out at **$0.61 per 1,000 requests**.
- The Auto-Router Usage tab shows classifier cost next to routed spend, estimated savings, sessions, and turns.

## Start from current models

The family presets now use current reasoning models:

- Anthropic Family sends reasoning traffic to **Claude Fable 5.1 at high effort**.
- OpenAI Family sends reasoning traffic to **GPT-6 Astra at xhigh effort**.
- Presets match the provider model behind each deployment, so deployment names do not need to match the catalog.
- **Configure automatically** checks the models your proxy serves, fills all four tiers, and opens the configuration for review.

## More controls for agent traffic

Recent AutoRouter changes also cover long-running agent sessions:

- **A `NON_REASONING` tier below Simple** handles tool-result relays, acknowledgements, and reformatting work.
- **Output limits from the selected tier** replace a caller's cap with the chosen model's output ceiling. An explicit per-tier cap still wins.
- **Classifier timeout protection** opens a circuit breaker after a timeout and uses the configured fallback during the cooldown.
- **Cross-provider tool history** lets the Messages API replay `tool_use` history when a session moves between OpenAI and Anthropic tiers.

Start with a preset or automatic configuration, test it on your traffic, and tune from measured misses. Share benchmark results in [GitHub discussion #32168](https://github.com/BerriAI/litellm/discussions/32168).
