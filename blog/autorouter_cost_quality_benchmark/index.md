---
slug: auto-router-cost-quality-benchmark
title: "Benchmarking Auto Router: 40-75% cheaper at 87-97% of frontier quality"
date: 2026-07-27T10:00:00
authors:
  - tin
description: "Two independent evaluations of a three-tier Auto Router config against an all-frontier baseline: 8,619 graded prompts, 14,000 simulated real conversations, and what the cost and quality numbers actually depend on."
keywords: [llm router benchmark, auto router, complexity router, llm cost savings, model routing, claude cost optimization, routerarena, litellm auto routing, cheaper llm inference]
tags: [routing, complexity-router, cost, benchmarks, engineering]
hide_table_of_contents: false
---

Auto routing is the cheapest cost lever on an AI gateway to turn on and the hardest one to trust. Sending every request to a frontier model has a known bill and known quality; sending some of them to a smaller model has an obvious bill and an unknown quality cost. So we measured it, twice, on a three-tier Claude configuration against a baseline of routing everything to `claude-opus-5`.

Across 8,619 graded prompts and about $111 of real API spend, Auto Router cut cost by **40.4%** on one evaluation and **74.5%** on the other, while retaining **97.1%** and **87.3%** of the baseline's answer quality. On simulations over 14,000 real conversations, savings land at roughly **65%**. The spread between those numbers is the interesting part, and it is almost entirely explained by how much of the traffic is genuinely simple.

{/* truncate */}

## The results

| Evaluation | Prompts | Quality retained | Cost savings | Router routing mix (haiku/sonnet/opus) |
| --- | --- | --- | --- | --- |
| Live proxy, six public benchmarks | 220 | **97.1%** (91.8% vs 94.5% pass) | **40.4%** ($10.47 vs $17.57 per 1k) | 27% / 70% / 3% |
| RouterArena full set, paired | 8,399 | **87.3%** (68.6% vs 78.5% accuracy) | **74.5%** ($2.15 vs $8.45 per 1k) | 79% / 17% / 4% |
| Real-traffic simulation, WildChat + DevGPT | 14,056 conversations | not measured | **~65%** | 48-76% simple |

The first leg ran through a live LiteLLM proxy on `localhost:4000`, 440 real requests to `POST /v1/chat/completions`, with per-request cost read from the `x-litellm-response-cost` header and the routed model read from `x-litellm-model-name`. Five of the six datasets are graded objectively against their own answer keys or test suites; only [SWE-bench Lite](https://www.swebench.com/) needs a judge, and every SWE-bench answer was judged twice, once by `claude-opus-5` and once by `gemini-3.6-flash`, to rule out self-preference. The second judge is stricter in absolute terms and leaves the retention ratio effectively unchanged at 96.6%.

The second leg ran the full 8,400-query set from [RouterArena](https://github.com/RouteWorks/RouterArena), the public router benchmark, paired against an all-Opus arm on the same queries with RouterArena's own automated evaluator.

The two legs disagree on both axes, and they disagree for one reason. The heuristic classifier keys mostly off length, code presence, and reasoning markers, so RouterArena's short academic questions score SIMPLE and 79% of them go to Haiku; the benchmark set with HumanEval, MBPP, and SWE-bench in it reads as code, so 70% goes to Sonnet 5. More Haiku means more savings and more missed answers. Both numbers are real, and which one resembles your bill depends entirely on your traffic.

## How it was measured

One model group over a three-model Claude pool (`claude-haiku-4-5`, `claude-sonnet-5`, `claude-opus-5`), classified by the heuristic scorer. No keyword rules, no LLM classifier, no adaptive sampling, and REASONING pinned to the same model as COMPLEX because Opus 5 already thinks by default. The full config is at the bottom of this post. The baseline arm sends the identical prompts to `claude-opus-5` directly, which is what most teams do today when they point a workload at one frontier model. Both arms use the same prompts, the same request format, and the same grader, so grader quirks affect both sides and largely cancel in the ratio.

Quality retained is the ratio of the two pass rates, `pass(router) / pass(baseline)`. Cost savings is `1 - cost(router) / cost(baseline)`, computed from actual measured token usage on every request rather than from estimates.

## Where the savings come from, and what they cost

Per-dataset, from the live-proxy leg:

| Dataset | Auto Router pass | Opus-5 pass | Auto Router $/1k | Opus-5 $/1k | Savings |
| --- | --- | --- | --- | --- | --- |
| GSM8K | 98% (39/40) | 98% (39/40) | 1.08 | 5.68 | 81% |
| HumanEval | 100% (40/40) | 98% (39/40) | 2.85 | 8.16 | 65% |
| MMLU-Pro | 85% (34/40) | 88% (35/40) | 4.21 | 11.70 | 64% |
| MATH-500 | 90% (36/40) | 98% (39/40) | 5.70 | 13.16 | 57% |
| MBPP | 95% (38/40) | 98% (39/40) | 2.20 | 5.01 | 56% |
| SWE-bench Lite | 75% (15/20) | 85% (17/20) | 83.08 | 105.83 | 21% |
| **Blended** | **91.8%** | **94.5%** | **10.47** | **17.57** | **40%** |

The split runs opposite to intuition. Short, cheap traffic saves the most at no measurable quality cost: grade-school math is identical at a fifth of the price, and HumanEval came out one prompt ahead of the frontier baseline. Repo-level work saves the least, because those prompts are long enough to dominate absolute spend and the classifier correctly declines to send them to Haiku. The two places quality is actually given up are MATH-500, where Haiku took 19 of the 40 prompts and the arm finished three behind the baseline, and SWE-bench Lite.

That also sets the ceiling on what routing can do for a coding-agent workload. If nearly every request carries a large repo context, there is no cheap tier to route it to, and the lever to reach for is [prompt caching or compression](/blog/save-claude-code-costs-with-litellm) rather than model selection.

## The classifier is the dial

Cost and quality trade against each other through one component, so we put four classifiers on the same three-model pool and scored them offline against a fully graded 809-query grid, alongside a trained router and a cheapest-correct oracle:

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

Three things fall out of that table. A trained BERT router beats the free keyword heuristic by only 1.3 points at a matched budget, which is a small return for a model artifact you have to host and retrain. Setting `classifier_type: llm` with a Haiku classifier ties the trained router at a matched budget, so the cheapest path to a better router is a small model reading the prompt rather than a bespoke trained one. And the oracle beats all-Opus at roughly a quarter of its cost, so the model pool is not the bottleneck; classification is, and there is a lot of headroom left in it.

The weak spot in today's heuristic is stability. On RouterArena's robustness metric it picks the same model for only 50.7% of paraphrased queries, though 85% of the flips are upward, so the failure mode is paying too much rather than answering badly. Embedding-based classification largely fixes this, and it is the next thing we want to measure.

## What to expect on production traffic

Benchmark prompts are deliberately difficulty-dense, so the third leg simulated the same router over real conversations, classifying the first user turn and pinning that model for the whole conversation the way `session_affinity` does:

| Traffic | Sample | Tier split (simple/medium/complex) | Savings vs all-Opus-5 |
| --- | --- | --- | --- |
| General consumer chat | WildChat-1M, 12,000 conversations | 76 / 14 / 10 | **64.9%** |
| Developer chat | DevGPT, 2,056 conversations | 48 / 27 / 25 | **65.4%** |
| Code-in-prompt heavy | WildChat code-filtered, 993 conversations | 13 / 34 / 53 | 20.0% |

Two very different populations both land near 65%, because in both cases roughly half to three quarters of requests are short enough that a frontier model is wasted on them. The honest range is 20% at the most code-saturated end to 75% at the shortest-query end, centered around 65% for ordinary chat and developer traffic.

## Keeping the numbers honest

The 220-prompt leg is small enough that differences under about five points are sampling noise, and it ran one sample per prompt with no tool use, no system prompts, and no prompt caching. Quality was measured only on ground-truth-checkable benchmark traffic, which is the defensible floor rather than the expected case; on production-shaped traffic where most requests are genuinely easy, retention should be higher, but nothing here measures that directly because WildChat and DevGPT have no answer key. The real-traffic legs estimate tokens as characters divided by four and do not model prompt caching, and the benchmark legs price Sonnet 5 at list ($3/$15) rather than the introductory rate, which moves savings by one to two points.

Savings are always measured against routing everything to `claude-opus-5`, so they describe what routing recovers from an all-frontier workload rather than what it does against a pool you have already tuned by hand.

One upstream finding is worth passing on to anyone else benchmarking on RouterArena. Its Anthropic handler read `response.content[0]` only, so a model that returns a thinking block first, which Opus 5 does by default, was graded on a stringified `ThinkingBlock` and scored near zero. Our fork joins the text blocks instead, and any existing Claude entry on the public leaderboard is likely depressed by this until the same fix lands upstream.

## Try it

If this is interesting, [apply to be a design partner](https://cms49ctwm00026rv771kh8igo.zapier.app/application). Try it yourself with the configuration below, and post any feedback, questions, or numbers from your own traffic on [discussion #32172](https://github.com/BerriAI/litellm/discussions/32172).

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
