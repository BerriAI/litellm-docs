---
slug: auto-router-cost-quality-benchmark
title: "Cut 75% Claude Code cost with near frontier model quality"
date: 2026-07-27T10:00:00
authors:
  - tin
description: "Two independent evaluations of a four-tier Auto Router config against an all-frontier baseline: 8,619 graded prompts, 14,000 simulated real conversations, and what the cost and quality numbers actually depend on."
image: ./hero.png
keywords: [llm router benchmark, auto router, complexity router, llm cost savings, model routing, claude cost optimization, routerarena, litellm auto routing, cheaper llm inference]
tags: [routing, complexity-router, cost, benchmarks, engineering]
hide_table_of_contents: false
---

![Introducing LiteLLM Autorouter: 75% cost savings with near frontier model quality](./hero.png)

Auto routing promises a smaller bill without a worse answer. We measured both halves against a baseline that sends every request to `claude-opus-5`: 8,619 graded prompts and cost simulations over 14,000 real conversations.

{/* truncate */}

:::info[🚀 Help shape the Auto-Router]

Get early access, work directly with the LiteLLM team, and influence the roadmap with your production traffic.

<a className="button button--primary button--lg" style={{background: '#2e8555', borderColor: '#2e8555', color: '#fff'}} href="https://calendar.app.google/i2e7qVEJphHi5S8UA">Apply to Become a Design Partner</a>

<br /><br />

Already testing it? Share your results in [discussion #32172](https://github.com/BerriAI/litellm/discussions/32172).

:::

## The results

- **40.4% cheaper at 97.1% of frontier quality**, on 220 prompts from six public benchmarks replayed through a live proxy
- **74.5% cheaper at 87.3% of frontier quality**, on RouterArena's full 8,399-query set
- **Around 65% cheaper** on simulated real chat and developer traffic, where most requests are short
- **46% cheaper than a cached frontier baseline** on multi-turn developer conversations, with prompt caching switched on for both arms

| Evaluation | Sample | Quality retained vs Opus-5 | Cost savings vs Opus-5 | Routing mix (haiku/sonnet/opus) |
| --- | --- | --- | --- | --- |
| Live proxy, six public benchmarks | 220 prompts | **97.1%** (Auto Router 91.8% pass, Opus-5 94.5%) | **40.4%** (Auto Router $10.47 / 1k, Opus-5 $17.57) | 27% / 70% / 3% |
| [RouterArena](https://github.com/RouteWorks/RouterArena) full set, paired | 8,399 prompts | **87.3%** (Auto Router 68.6% accuracy, Opus-5 78.5%) | **74.5%** (Auto Router $2.15 / 1k, Opus-5 $8.45) | 79% / 17% / 4% |
| Simulation, general consumer chat ([WildChat-1M](https://huggingface.co/datasets/allenai/WildChat-1M)) | 12,000 conversations | not measured | **64.9%** | 76% / 14% / 10% |
| Simulation, developer chat ([DevGPT](https://github.com/NAIST-SE/DevGPT)) | 2,056 conversations | not measured | **65.4%** | 48% / 27% / 25% |
| Simulation, code-in-prompt heavy ([WildChat](https://huggingface.co/datasets/allenai/WildChat-1M) code-filtered) | 993 conversations | not measured | **20.0%** | 13% / 34% / 53% |

## How it was measured

- **Router arm:** one model group, four tiers. SIMPLE to `claude-haiku-4-5`, MEDIUM to `claude-sonnet-5`, COMPLEX and REASONING both to `claude-opus-5`, since Opus 5 already thinks by default. Heuristic classifier, no keyword rules, no adaptive sampling
- **Baseline arm:** the same prompts sent straight to `claude-opus-5`, which is what most teams do today when they point a workload at one frontier model
- **Cost savings:** what the router spent against what the baseline spent. On the live proxy, LiteLLM reports the cost of every request back in a response header; on the other legs we price the tokens each request actually used
- **Quality retained:** the router's pass rate against the baseline's, evaluating identical prompts with the same grader on both arms

What counts as a pass:

| Dataset | How a pass is decided |
| --- | --- |
| [HumanEval](https://huggingface.co/datasets/openai/openai_humaneval), [MBPP](https://huggingface.co/datasets/google-research-datasets/mbpp) | the datasets' own unit tests run in a subprocess; pass only if every official assert passes |
| [GSM8K](https://huggingface.co/datasets/openai/gsm8k), [MATH-500](https://huggingface.co/datasets/HuggingFaceH4/MATH-500), [MMLU-Pro](https://huggingface.co/datasets/TIGER-Lab/MMLU-Pro) | answer-key match: the extracted final number, LaTeX normalisation with a SymPy equivalence fallback, and the final answer letter |
| [SWE-bench Lite](https://huggingface.co/datasets/princeton-nlp/SWE-bench_Lite) | LLM as judge, comparing the named files, functions, and diff sketch against the patch upstream actually merged |
| [RouterArena](https://github.com/RouteWorks/RouterArena) | RouterArena's own evaluator; about 74% of queries are multiple choice matched on a `\boxed{X}` letter, the rest use per-dataset scorers |

:::note

SWE-bench Lite is the only slice scored by LLM as judge; everything else is checked against the dataset's own answer key or test suite. Every SWE-bench answer was judged twice, by `claude-opus-5` and by `gemini-3.6-flash`, and retention holds at 96.6% under the stricter judge.

:::

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

## Auto-routing and prompt caching

A question we keep hearing: do I have to choose between auto-routing and prompt caching?

No, and on multi-turn traffic you want both. Every benchmark above prices requests from cold, which is the wrong baseline for anyone running long conversations, so we simulated 1,011 multi-turn DevGPT conversations; 11,808 turns, every conversation at least three turns deep, against a baseline that sends each turn to `claude-opus-5` with prompt caching already switched on.

| Configuration | $/1k turns | vs cached Opus-5 |
| --- | --- | --- |
| `claude-opus-5`, prompt caching on | 12.85 | baseline |
| Auto Router, prompt caching off | 12.03 | 6% cheaper |
| Auto Router, prompt caching on | **6.96** | **46% cheaper** |

The ordering matters more than any single number here. Routing with the cache switched off is close to a wash against cached Opus-5 and loses outright on 31% of conversations, because every turn resends the whole accumulated transcript at full input price and cost climbs with the square of conversation depth. Switch caching back on, hold the routing decisions identical, and the same sessions land 46% under the cached baseline while beating it on 80% of individual conversations. Toggling only the cache moves the bill by 42%, so on multi-turn traffic caching is the larger lever and routing compounds it rather than competing with it.

Session affinity is what lets the two stack. A conversation pins to the model its first turn selected and the prefix stays warm on that model for the rest of the session, while the router keeps scoring each new turn and can move a session up a tier as the work gets harder, never back down; de-escalating repays its cold prefix too slowly to be worth taking. Moving up does start cold on the new model, and 72% of these conversations escalate at least once, so that write is the cost an escalation has to clear before it is worth making.

Two caveats on the 46%. This baseline already has caching switched on, so the number is not comparable with the roughly 65% figures above, which price both arms from cold. And it covers multi-turn conversations only; the deepest 1% of sessions carry enough spend to pull the all-conversation figure down to 28%, since a long session tends to reach the top tier anyway and pays a cold prefix when it gets there.

## What's next

- **Keeping a session's caches alive.** A background refresher replays a session's stored prefix against the tiers that session has already used, so an idle gap longer than the provider cache TTL no longer costs the session its cache, and coming back to a tier it has visited is a read rather than a fresh write. The first move to a new tier still starts cold; that write is the cost the escalation decision weighs
- **Routing decisions you can inspect.** Surfacing why a request landed on the tier it did, not just which model served it. That same signal feeds back into the classifier, so it improves against real traffic rather than benchmarks

## Try it

:::info

Try it yourself with the configuration below, and post any feedback, questions, or numbers from your own traffic on [discussion #32172](https://github.com/BerriAI/litellm/discussions/32172). If you want to work on this with us directly, [apply to be a design partner](https://calendar.app.google/i2e7qVEJphHi5S8UA).

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
