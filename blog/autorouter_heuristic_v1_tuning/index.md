---
slug: auto-router-heuristic-v1-tuning-and-setup
title: "AutoRouter: Tune Heuristic v1 to 95.2% Accuracy, Then Configure It in One Click"
date: 2026-09-08T10:00:00
authors:
  - tin
description: "A tuned Heuristic v1 profile improved accuracy from 90.8% to 95.2% on a 240-prompt mix. Track classifier cost, use current presets, and configure tiers from models you already serve."
keywords: [auto router, heuristic routing, dimension weights, model routing, llm benchmark, litellm]
tags: [routing, complexity-router, benchmarks, engineering, product]
hide_table_of_contents: false
---

# AutoRouter: Tune Heuristic v1 to 95.2% Accuracy, Then Configure It in One Click

AutoRouter's Heuristic v1 classifier now lets you tune the signals it uses for your traffic. On a balanced mix of 240 prompts, a profile built for multiple-choice questions and hard math raised accuracy from 90.8% to 95.2%. Cost rose from $2.90 to $3.85 per 1,000 prompts.

The tuned router also scored 0.3 percentage points above the all-Opus reference. After normalizing cost by correct responses, it cost 59.7% less per correct task than all Opus.

| Configuration | Best change in category | Accuracy | Cost / 1K prompts | Estimated cost / 1K correct tasks |
| --- | --- | ---: | ---: | ---: |
| Default Heuristic v1 | Shipped defaults | 90.8% | $2.90 | **$3.19** |
| Keywords only | Remove `how many`, `how much`, `what is`, and `what's` from simple keywords | 91.2% | $2.96 | $3.25 |
| Weights only | Raise `codePresence` from 0.30 to 0.45; lower `technicalTerms` from 0.25 to 0.10 | 91.7% | $5.86 | $6.39 |
| Tier boundaries only | Lower the first two boundaries from 0.15 / 0.35 to 0.05 / 0.12 | 92.5% | $5.87 | $6.35 |
| **Custom dimensions plus keyword fix** | Add multiple-choice and hard-math signals | **95.2%** | **$3.85** | **$4.04** |
| All Opus | Send every prompt to Opus | 94.9% | $9.53 | $10.04 |

We estimate cost per 1,000 correct tasks as `cost per 1,000 prompts / accuracy`. This treats each correct benchmark response as one completed task. Replace the estimate with measured cost per solve if the benchmark records task completion separately.

The strongest profile added information that the seven stock signals did not capture. Weight and boundary changes improved accuracy, with routing cost about doubling in each case. The custom dimensions produced the largest accuracy gain. Against the default, they added 4.4 percentage points of accuracy and raised estimated cost per correct task by 26.6%.

{/* truncate */}

## The winning Heuristic v1 profile

Heuristic v1 combines seven prompt signals: `tokenCount`, `codePresence`, `reasoningMarkers`, `technicalTerms`, `simpleIndicators`, `multiStepPatterns`, and `questionComplexity`. You can change each weight, edit the tier boundaries, change the keyword lists, or add a signal for your domain.

The best profile made three changes:

| Change | Configuration | Signal added or corrected |
| --- | --- | --- |
| Multiple-choice dimension | Weight 0.20; match explicit multiple-choice language or consecutive lettered options | Detect questions whose format carries useful routing information |
| Hard-math dimension | Weight 0.40; `match_count` over terms such as `prove`, `polynomial`, `matrix`, `modulo`, and `remainder` | Separate hard symbolic work from routine arithmetic |
| Simple-keyword fix | Remove `how many`, `how much`, `what is`, and `what's` | Stop short wording from pulling hard questions toward Simple |

We also tested dimension-only profiles. The reasoning-heavy arm raised `reasoningMarkers` from 0.25 to 0.40 and lowered `technicalTerms` from 0.25 to 0.10. The code-heavy arm raised `codePresence` from 0.30 to 0.45 and made the same technical-weight reduction. A length-heavy arm raised `tokenCount` from 0.10 to 0.35, then reduced the code and technical weights.

The code-heavy profile produced the best weights-only result at 91.7% accuracy, up 0.9 percentage points, while cost rose from $2.90 to $5.86 per 1,000 prompts.

The threshold-only arm reached 92.5% at $5.87 per 1,000 prompts. It improved accuracy by sending more requests to stronger tiers. The custom profile used prompt structure and domain vocabulary to choose those tiers with less over-routing.

## A held-out search found a lower-cost profile too

We sampled 120 combinations of the seven weights and the Simple-to-Medium and Medium-to-Complex boundaries. The search fit candidates on half of the prompts and reported the result on the other half.

The best same-accuracy candidate held accuracy at 91.3% on the held-out split and cut cost by 12%. Equal accuracy means cost per correct task also fell 12%.

The benchmark artifact reports prompt count, accuracy, and cost. The model versions, prompt composition, scoring rubric, and trial count still need to accompany the final result so readers can judge how far it applies to their traffic.

## Match each tuning profile to its traffic

| Traffic | Weight to test | Evaluation | Primary metric |
| --- | --- | --- | --- |
| Coding agents | `codePresence` | Terminal-Bench 2.0 or SWE-bench Verified | Cost per solved task |
| Technical support | `technicalTerms` plus a custom domain dimension | Held-out support questions and a production shadow eval | Correct answers and under-routing rate |
| Math and analysis | `reasoningMarkers` | GPQA or MATH subset | Cost per correct answer |
| General chat | `simpleIndicators` and `tokenCount` | Sampled chat traffic | Judge win rate and expensive-tier share |

Keep the model ladder, task order, and trial count fixed across arms. Compare solve rate, cost per solve, latency, cache-read rate, and tier distribution. The [shadow evaluation workflow](/docs/auto_router/evaluate) can test a candidate on sampled production traffic without changing the response your user receives.

Heuristic v2 remains an option for teams that want a pretrained local scorer. On a 21-task Terminal-Bench 2.0 subset, it solved 14 tasks against 11 for Heuristic v1 and cut cost per solved task from $1.28 to $0.70. You can find the full setup and caveats in the [Heuristic v2 benchmark](/blog/heuristic-v2).

## See LLM classifier cost per 1,000 turns

An LLM classifier adds a model call before the routed request. AutoRouter now records that charge on each routing decision as `classifier_cost` and returns it in the `x-litellm-classifier-cost` header across Chat Completions, Responses, and Messages APIs.

Teams can sum that field and report classifier overhead per 1,000 routed turns. In our 5,600-call classifier-context benchmark, the classifier cost topped out at **$0.61 per 1,000 requests**. The exact number depends on the classifier model, prompt, and amount of conversation history it reads.

The Auto-Router Usage tab also shows sessions, turns, routed spend, estimated savings, and prompt-cache behavior. That puts the routing charge next to the savings it helped produce.

## Family presets now use current reasoning models

The bundled family presets provide a maintained starting point for teams that want one provider across all four tiers. We updated the top rung in both presets:

| Preset | Simple | Medium | Complex | Reasoning |
| --- | --- | --- | --- | --- |
| Anthropic Family | Claude Haiku 4.5 | Claude Sonnet 5 | Claude Opus 5 | **Claude Fable 5.1, high effort** |
| OpenAI Family | GPT-5.6 Luna | GPT-5.6 Terra | GPT-5.6 Sol | **GPT-6 Astra, xhigh effort** |

We update the runtime preset catalog and the copyable [recommended configurations](/docs/auto_router/recommended_configurations) together. Presets also match the underlying provider model behind each deployment, so your deployment names do not need to match the names in the catalog.

## Configure all four tiers from the models you can access

You can skip the template choice and click **Configure automatically**. The dashboard checks the models your proxy already serves, selects a model for each complexity tier, and fills the form.

The detailed tier view opens after configuration so you can review or change every choice before saving. The router does not assume that a preset's models exist in your environment.

## More routing controls for agent workloads

Several recent changes handle the less visible parts of long-running agent sessions:

- **A `NON_REASONING` tier below Simple.** Route tool-result relays, acknowledgements, and reformatting work to a cheaper model. Existing four-tier routers keep their current behavior until an admin enables it.
- **Output limits from the selected tier.** `max_tokens_from_tier_model` replaces the caller's cap with the chosen model's output ceiling after routing. An explicit per-tier cap still wins.
- **Classifier timeout protection.** Set a total LLM-classifier timeout and open a circuit breaker after a timeout. Requests use the configured fallback during the cooldown instead of waiting on the classifier for each turn.
- **Cross-provider tool history.** The Messages API can replay `tool_use` history when a session moves between OpenAI and Anthropic tiers.

These controls sit beside context-window and image routing, mid-task stall escalation, per-hop compression, and tier failover. The [Auto Router feature history](/docs/auto_router/feature_history) tracks releases and pull requests across the project.

## Test the router you plan to ship

Start with a maintained preset or automatic configuration. Run Test Routing on prompts from your workload. Tune weights only when the routing decisions show a repeatable miss, then compare the candidate against the default on held-out tasks.

Publish the weight vector with the result. A useful routing claim names the models, tasks, trial count, quality metric, cost, latency, and tier distribution. That makes the result reproducible and shows whether a higher-cost route bought a better answer.

Share configurations and benchmark results in [GitHub discussion #32168](https://github.com/BerriAI/litellm/discussions/32168).
