---
slug: auto-router-cost-quality-benchmark
title: "Benchmarking Auto Router: 40-75% cheaper at 87-97% of frontier quality"
date: 2026-07-27T10:00:00
authors:
  - tin
description: "Two independent evaluations of a four-tier Auto Router config against an all-frontier baseline: 8,619 graded prompts, 14,000 simulated real conversations, and what the cost and quality numbers actually depend on."
keywords: [llm router benchmark, auto router, complexity router, llm cost savings, model routing, claude cost optimization, routerarena, litellm auto routing, cheaper llm inference]
tags: [routing, complexity-router, cost, benchmarks, engineering]
hide_table_of_contents: false
---

Auto routing promises a smaller bill without a worse answer. We measured both halves against a baseline that sends every request to `claude-opus-5`: 8,619 graded prompts, about $111 of real API spend, and cost simulations over 14,000 real conversations.

{/* truncate */}

## The results

- **40.4% cheaper at 97.1% of frontier quality**, on 220 prompts from six public benchmarks replayed through a live proxy
- **74.5% cheaper at 87.3% of frontier quality**, on RouterArena's full 8,399-query set
- **Around 65% cheaper** on simulated real chat and developer traffic, where most requests are short

| Evaluation | Sample | Quality retained vs Opus-5 | Cost savings vs Opus-5 | Routing mix (haiku/sonnet/opus) |
| --- | --- | --- | --- | --- |
| Live proxy, six public benchmarks | 220 prompts | **97.1%** (Auto Router 91.8% pass, Opus-5 94.5%) | **40.4%** (Auto Router $10.47 / 1k, Opus-5 $17.57) | 27% / 70% / 3% |
| [RouterArena](https://github.com/RouteWorks/RouterArena) full set, paired | 8,399 prompts | **87.3%** (Auto Router 68.6% accuracy, Opus-5 78.5%) | **74.5%** (Auto Router $2.15 / 1k, Opus-5 $8.45) | 79% / 17% / 4% |
| Simulation, general consumer chat ([WildChat-1M](https://huggingface.co/datasets/allenai/WildChat-1M)) | 12,000 conversations | not measured | **64.9%** | 76% / 14% / 10% |
| Simulation, developer chat ([DevGPT](https://github.com/NAIST-SE/DevGPT)) | 2,056 conversations | not measured | **65.4%** | 48% / 27% / 25% |
| Simulation, code-in-prompt heavy ([WildChat](https://huggingface.co/datasets/allenai/WildChat-1M) code-filtered) | 993 conversations | not measured | **20.0%** | 13% / 34% / 53% |

How each leg ran:

- **Live proxy:** 440 real requests to `POST /v1/chat/completions`, per-request cost read from the `x-litellm-response-cost` header and the routed model from `x-litellm-model-name`
- **Grading:** five of the six datasets score against their own answer keys or test suites; only [SWE-bench Lite](https://www.swebench.com/) needs a judge, so every SWE-bench answer was judged twice, by `claude-opus-5` and by `gemini-3.6-flash`, to rule out self-preference. The stricter judge leaves retention at 96.6%
- **RouterArena:** the full 8,400-query set, paired against an all-Opus arm on the same queries and scored by RouterArena's own evaluator
- **Simulations:** cost-only replays over real conversations, classifying the first user turn and pinning that model for the rest of the conversation the way `session_affinity` does. Neither corpus has an answer key, so quality is not measured there

The two graded legs disagree because the heuristic classifier keys off length, code presence, and reasoning markers. RouterArena's short academic questions score SIMPLE, so 79% of them go to Haiku; the benchmark set with HumanEval, MBPP, and SWE-bench in it reads as code, so 70% goes to Sonnet 5. More Haiku means more savings and more missed answers, and which number resembles your bill depends on your traffic.

## How it was measured

- **Router arm:** one model group, four tiers. SIMPLE to `claude-haiku-4-5`, MEDIUM to `claude-sonnet-5`, COMPLEX and REASONING both to `claude-opus-5`, since Opus 5 already thinks by default. Heuristic classifier, no keyword rules, no adaptive sampling
- **Baseline arm:** the same prompts sent straight to `claude-opus-5`, which is what most teams do today when they point a workload at one frontier model
- **Quality retained:** `pass(router) / pass(baseline)`, with identical prompts and grader on both arms, so grader quirks largely cancel
- **Cost savings:** `1 - cost(router) / cost(baseline)`, from measured token usage on every request rather than estimates

## Where the savings come from, and what they cost

| Dataset | Auto Router pass | Opus-5 pass | Auto Router $/1k | Opus-5 $/1k | Savings |
| --- | --- | --- | --- | --- | --- |
| [GSM8K](https://huggingface.co/datasets/openai/gsm8k) | 98% (39/40) | 98% (39/40) | 1.08 | 5.68 | 81% |
| [HumanEval](https://huggingface.co/datasets/openai/openai_humaneval) | 100% (40/40) | 98% (39/40) | 2.85 | 8.16 | 65% |
| [MMLU-Pro](https://huggingface.co/datasets/TIGER-Lab/MMLU-Pro) | 85% (34/40) | 88% (35/40) | 4.21 | 11.70 | 64% |
| [MATH-500](https://huggingface.co/datasets/HuggingFaceH4/MATH-500) | 90% (36/40) | 98% (39/40) | 5.70 | 13.16 | 57% |
| [MBPP](https://huggingface.co/datasets/google-research-datasets/mbpp) | 95% (38/40) | 98% (39/40) | 2.20 | 5.01 | 56% |
| [SWE-bench Lite](https://huggingface.co/datasets/princeton-nlp/SWE-bench_Lite) | 75% (15/20) | 85% (17/20) | 83.08 | 105.83 | 21% |
| **Blended** | **91.8%** | **94.5%** | **10.47** | **17.57** | **40%** |

The split runs opposite to intuition:

- **Short, cheap traffic saves the most at no quality cost.** GSM8K is identical at a fifth of the price, and HumanEval came out one prompt ahead of the frontier baseline
- **Repo-level work saves the least.** Those prompts are long enough to dominate absolute spend, and the classifier correctly declines to send them to Haiku
- **Quality is given up in two places.** MATH-500, where Haiku took 19 of the 40 prompts and the arm finished three behind, and SWE-bench Lite

If nearly every request carries a large repo context, there is no cheap tier to route it to, and the lever to reach for is [prompt caching or compression](/blog/save-claude-code-costs-with-litellm) rather than model selection.

## The classifier is the dial

Four classifiers on the same three-model pool, scored offline against a fully graded 809-query grid, alongside a trained router and a cheapest-correct oracle:

| Policy | Accuracy | Cost/1k | haiku/sonnet/opus |
| --- | --- | --- | --- |
| All-Haiku (floor) | 68.5% | $1.13 | 100/0/0 |
| LiteLLM heuristic (keyword) | 69.9% | $2.04 | 80/16/3 |
| RouteLLM BERT at matched budget | 71.2% | $2.46 | 80/16/3 |
| LiteLLM LLM classifier (Haiku) | 74.9% | $5.44 | 36/35/28 |
| RouteLLM BERT at matched budget | 74.8% | $4.69 | 36/35/28 |
| All-Sonnet-5 | 75.3% | $4.81 | 0/100/0 |
| LiteLLM semantic (MiniLM tier exemplars) | 76.3% | $6.20 | 19/27/54 |
| All-Opus-5 | 80.6% | $8.38 | 0/0/100 |
| Oracle (cheapest correct model) | 85.7% | $2.25 | n/a |

- **A trained router buys 1.3 points.** RouteLLM's BERT classifier beats the free keyword heuristic by that much at a matched budget, a small return for a model artifact you have to host and retrain
- **An LLM classifier ties it.** `classifier_type: llm` with Haiku matches the trained router at a matched budget, so the cheapest path to a better router is a small model reading the prompt
- **Classification is the bottleneck, not the pool.** The oracle beats all-Opus at roughly a quarter of its cost, so the headroom is in picking better, not in adding models
- **The heuristic is unstable under paraphrase.** It picks the same model for only 50.7% of reworded queries, though 85% of the flips are upward, so the failure mode is paying too much rather than answering badly

## Try it

:::info

If this is interesting, [apply to be a design partner](https://cms49ctwm00026rv771kh8igo.zapier.app/application). Try it yourself with the configuration below, and post any feedback, questions, or numbers from your own traffic on [discussion #32172](https://github.com/BerriAI/litellm/discussions/32172).

:::

```yaml title="config.yaml"
model_list:
  - model_name: claude-haiku-4-5           # $1 / $5 per 1M tokens
    litellm_params:
      model: anthropic/claude-haiku-4-5
      api_key: os.environ/ANTHROPIC_API_KEY
  - model_name: claude-sonnet-5            # $3 / $15
    litellm_params:
      model: anthropic/claude-sonnet-5
      api_key: os.environ/ANTHROPIC_API_KEY
  - model_name: claude-opus-5              # $5 / $25
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
        classifier_type: heuristic         # local scoring, sub-millisecond, no API call
      complexity_router_default_model: claude-sonnet-5
```

Point a client at `smart-router` and every response carries `x-litellm-model-name` and `x-litellm-response-cost`, which is all the instrumentation this study needed. Full reference, including the classifier and tier-boundary knobs, on the [Auto Routing docs page](/docs/proxy/auto_routing).
