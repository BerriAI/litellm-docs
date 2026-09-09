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

Heuristic v1 scores seven prompt signals, including reasoning language, code, technical terms, and prompt length. You can tune those dimensions for the traffic your router serves.

On a balanced 240-prompt mix, a workload-tuned configuration raised accuracy from 90.8% to 95.2%. It also scored above the all-Opus reference at less than half the cost.

| Configuration | Accuracy | Cost / 1K prompts | Estimated cost / 1K correct tasks |
| --- | ---: | ---: | ---: |
| Default Heuristic v1 | 90.8% | $2.90 | **$3.19** |
| Workload-tuned Heuristic v1 | **95.2%** | **$3.85** | **$4.04** |
| All Opus | 94.9% | $9.53 | $10.04 |

We estimate cost per 1,000 correct tasks as `cost per 1,000 prompts / accuracy`. The tuned configuration improved accuracy by 4.4 percentage points and raised cost per correct task by 26.6% against the default. Against all Opus, it delivered similar accuracy at 59.7% lower cost per correct task.

A separate held-out search found another useful tradeoff: 91.3% accuracy with 12% lower cost than the comparison profile. Equal accuracy means cost per correct task also fell 12%.

These results show why teams should tune against their own workload. A profile that helps code traffic may waste spend on support questions. Keep the model ladder and test set fixed, then compare accuracy, cost per completed task, latency, and tier distribution.

{/* truncate */}

## Tune the signals your workload uses

Heuristic v1 exposes `reasoningMarkers`, `codePresence`, `technicalTerms`, `tokenCount`, `simpleIndicators`, `multiStepPatterns`, and `questionComplexity`. You can also add a custom dimension for vocabulary or structure that the built-in scorer does not know.

Start with a held-out sample from your traffic. Change one family of signals at a time, inspect which prompts move tiers, and keep a change when it improves the metric you care about. For agent benchmarks, cost per solved task gives a better comparison than cost per request.

The [shadow evaluation workflow](/docs/auto_router/evaluate) can test a candidate on sampled production traffic without changing the response your user receives.

## See classifier overhead per 1,000 turns

An LLM classifier adds a model call before the routed request. AutoRouter records that charge as `classifier_cost` and returns it in the `x-litellm-classifier-cost` header across Chat Completions, Responses, and Messages APIs.

Teams can sum that field and report classifier overhead per 1,000 routed turns. In our 5,600-call classifier-context benchmark, the classifier cost topped out at **$0.61 per 1,000 requests**. The Auto-Router Usage tab puts that charge next to routed spend, estimated savings, sessions, and turns.

## Start from current models

The family presets now use current reasoning models:

- Anthropic Family sends reasoning traffic to **Claude Fable 5.1 at high effort**.
- OpenAI Family sends reasoning traffic to **GPT-6 Astra at xhigh effort**.

Presets match the underlying provider model behind each deployment, so your deployment names do not need to match the catalog.

You can also click **Configure automatically**. The dashboard checks the models your proxy serves, fills all four tiers, and opens the detailed configuration for review before you save.

## More controls for agent traffic

Recent AutoRouter changes also cover the less visible parts of long-running agent sessions:

- **A `NON_REASONING` tier below Simple** handles tool-result relays, acknowledgements, and reformatting work.
- **Output limits from the selected tier** replace a caller's cap with the chosen model's output ceiling. An explicit per-tier cap still wins.
- **Classifier timeout protection** opens a circuit breaker after a timeout and uses the configured fallback during the cooldown.
- **Cross-provider tool history** lets the Messages API replay `tool_use` history when a session moves between OpenAI and Anthropic tiers.

Start with a preset or automatic configuration, test it on your traffic, and tune from measured misses. Share benchmark results in [GitHub discussion #32168](https://github.com/BerriAI/litellm/discussions/32168).
