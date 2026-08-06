---
slug: auto-router-classifier-benchmark
title: "Which LLM should classify your prompts? A 13-way bake-off"
date: 2026-08-06T10:00:00
authors:
  - tin
description: "We benchmarked 12 LLMs plus a zero-cost heuristic as the complexity classifier behind the Auto Router; same prompt, same dataset, same harness. The winner, the surprises, and the config to use it."
image: ./hero.png
keywords: [llm classifier benchmark, complexity classifier, auto router, prompt classification, model routing, tier classification, litellm auto routing, small llm benchmark]
tags: [routing, complexity-router, benchmarks, engineering]
hide_table_of_contents: false
---

![Which LLM should classify your prompts?](./hero.png)

The Auto Router's value rides on one hop: a small classifier reads the prompt and decides which tier of model should answer it. Send hard questions to cheap models and quality suffers; send easy ones to frontier models and the savings you routed for evaporate. So which model should sit in that hop? We ran a bake-off: 12 LLMs plus the built-in zero-cost heuristic, one identical prompt, one dataset, one harness. The only variable across rows is the classifier model.

{/* truncate */}

:::info[🚀 Help shape the Auto-Router]

Get early access, work directly with the LiteLLM team, and influence the roadmap with your production traffic.

<a className="button button--primary button--lg" style={{background: '#2e8555', borderColor: '#2e8555', color: '#fff'}} href="https://calendar.app.google/i2e7qVEJphHi5S8UA">Apply to Become a Design Partner</a>

<br /><br />

Already testing it? Share your results in [discussion #32172](https://github.com/BerriAI/litellm/discussions/32172).

:::

The short version: **`gemini-3.5-flash-lite` is our pick**. It posts the top accuracy (65%), the tightest tail latency in the hosted field (p95 of 0.67s), and costs about $0.09 per 1,000 classifications. If you are optimizing for price, `gpt-4o-mini` sits one point behind at half the cost. The most useful finding is broader than the winner though: the entire hosted top group lands within 4 points of each other, so classifier choice comes down to latency and price; accuracy will not separate them.

## The results

Every classifier saw exactly the same 100 prompts, stratified 25 per tier across `simple` / `medium` / `complex` / `reasoning`. Latency is the median per classification; cost is per 1,000 classifications.

| Classifier | Accuracy | Latency | Cost per 1k |
| --- | --- | --- | --- |
| **gemini-3.5-flash-lite** | **65%** | 0.50s | $0.09 |
| gpt-4o-mini | 64% | 0.59s | $0.04 |
| claude-haiku-4-5 | 63% | 0.78s | $0.34 |
| deepseek-v3.2 (dedicated GPU) | 63% | 0.16s | $0.16 |
| grok-4.1-fast | 61% | 0.41s | $0.06 |
| gpt-5.4-nano | 55% | 0.71s | $0.09 |
| gemma-3-4b (dedicated GPU) | 51% | 0.22s | $0.06 |
| ministral-3b | 49% | 0.33s | n/a |
| llama-3.1-8b (dedicated GPU) | 48% | 0.16s | $0.03 |
| **heuristic (no LLM)** | **45%** | ~0ms | free |
| qwen3-4b (dedicated GPU) | 44% | 0.64s | $0.06 |

We also ran several of the open models on local CPU. Accuracy tracked the GPU runs within a few points, and the latency numbers are not comparable to hosted endpoints, so those rows are omitted. We also tracked macro-F1, how often each model landed within one tier of the truth, the split between under-routing (quality risk) and over-routing (wasted spend), and p95 latency; the sections below quote those where they change the story.

## How it was measured

Every model got the same tier-definition prompt with `temperature=0` and `max_tokens=8`, except models that must be allowed to think. There was no per-model prompt tuning; this measures the model, and only the model.

Labels are not LLM-judged, and that matters. A common trap in classifier evals is generating "ground truth" with a big LLM and then scoring small LLMs against it, at which point you are measuring agreement with a judge rather than correctness. Every item in our 400-item set instead gets its tier from an intrinsic property of its source:

| Tier | Sources |
| --- | --- |
| simple | TriviaQA single-fact, llm-query-complexity-benchmark LOW, RouterArena *easy*, hand-authored chit-chat / format / extract |
| medium | llm-query-complexity-benchmark MEDIUM, RouterArena *medium*, GSM8K, hand-authored explain / small-code / write |
| complex | llm-query-complexity-benchmark HIGH (MMLU-Pro, PubMedQA), RouterArena *hard*, hand-authored system design and open-ended synthesis |
| reasoning | MATH-500 level 5, AIME 2025, BIG-Bench-Hard, hand-authored proofs and puzzles |

The dedicated-GPU rows ran on on-demand H100/H200 deployments and were measured warm; first call on a cold deployment costs 20 to 24 seconds. Dedicated-GPU latency (your hardware, no queueing) and shared-endpoint latency are different products, so compare within a deployment type rather than across.

## The ceiling is 65%, and the top four are a tie

gemini-3.5-flash-lite, gpt-4o-mini, claude-haiku-4-5 and grok-4.1-fast are statistically indistinguishable at this sample size (roughly ±5pp). Inside that group, pick on latency and price. claude-haiku-4-5 costs 7.7x gpt-4o-mini for one point of accuracy that is inside the noise; a classifier hop is exactly the workload where the premium model buys you nothing.

## Every model fails on the same boundary: medium

| Classifier | simple | medium | complex | reasoning |
| --- | --- | --- | --- | --- |
| gemini-3.5-flash-lite | 0.84 | 0.40 | 0.48 | 0.88 |
| gpt-4o-mini | 0.80 | 0.24 | 0.52 | 1.00 |
| claude-haiku-4-5 | 0.88 | 0.36 | 0.40 | 0.88 |
| grok-4.1-fast | 0.76 | 0.24 | 0.56 | 0.88 |

Recall on `medium` sits between 0.20 and 0.40 across the entire field, while `simple` and `reasoning` run 0.76 to 1.00. Medium prompts leak in both directions: they look short and ordinary, which pulls them down to `simple`, and any arithmetic pulls them up a rung toward `reasoning`. For routing this is encouraging rather than damning. The difficulty lives in the 4-way framing; if what your router actually needs is a cheap-vs-expensive split, that binary question is far easier than these numbers suggest.

## Do not use a reasoning model as a classifier

gpt-5.4-nano is the newest model in the table and the worst hosted one. Its own reasoning tokens push median latency to 0.7s and it still scores 10 points below gpt-4o-mini. qwen3-4b tells the same story: when it cannot be forced to skip thinking it burns roughly 295 output tokens per classification, and it said "reasoning" twice in 100 items. For a one-word classification task, thinking tokens are pure overhead.

## The free heuristic is a real floor

The Auto Router's default heuristic classifier scores 45% at zero cost and zero latency. Every hosted model beats it, but by 16 to 20 points rather than 40. That gap is what the classifier hop buys, and it is worth stating plainly. It also suggests a hybrid worth measuring: heuristic first, LLM only when the heuristic's margin is thin.

## On dedicated GPUs, open models win on latency while giving up accuracy

llama-3.1-8b on a single H100 is the fastest classifier in the table (p50 0.164s, p95 0.213s, $0.031/1k) at 48% accuracy. deepseek-v3.2 on 8xH200 is the only open model that matches the hosted top group (63%, p50 0.162s), but at 3.7x gpt-4o-mini's per-call price before counting the idle cost of the reservation. The 4B-class models land at or below the free heuristic with this prompt; their failure mode is format compliance rather than tier judgement, so few-shot examples or constrained decoding could close some of that gap.

## Caveats, stated plainly

n=100 (25 per tier) means roughly ±5pp on accuracy, so single-point differences are noise and we treated them that way. Latency was measured warm at moderate concurrency; tail latencies on shared endpoints vary with time of day. And this benchmark scores tier prediction against human-defined complexity labels; the economically purer question, "would the cheap model have answered this correctly?", is a different framing we are measuring next.

## What's next

Four follow-ups are queued. Binary and 3-tier collapses of the same predictions, since a cheap-vs-expensive router changes the accuracy story completely. Few-shot and constrained-decoding variants for the small open models, to separate format failure from judgement failure. A head-to-head against an embedding + logistic-regression classifier on the same items, which at about $0.02 per million classifications and sub-10ms is the real competitor for this hop. And outcome-based ground truth in the RouterBench style, where the label is "did the cheap model answer correctly", making results directly comparable to RouteLLM.

## Try it

:::info

Try it yourself with the configuration below, and post any feedback, questions, or numbers from your own traffic on [discussion #32172](https://github.com/BerriAI/litellm/discussions/32172). If you want to work on this with us directly, [apply to be a design partner](https://calendar.app.google/i2e7qVEJphHi5S8UA).

:::

The Auto Router ships with the heuristic classifier by default (local scoring, sub-millisecond, no API call). To put the winner in the hop instead, add it to your `model_list` and point `classifier_llm_config` at it. If the classification call fails, times out, or returns something unparseable, the router falls back to the heuristic automatically, so the LLM classifier never adds an availability risk.

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
  - model_name: gemini-3.5-flash-lite      # the classifier: 65% tier accuracy, p95 0.67s, ~$0.09/1k
    litellm_params:
      model: gemini/gemini-3.5-flash-lite
      api_key: os.environ/GEMINI_API_KEY

  - model_name: smart-router
    litellm_params:
      model: auto_router/complexity_router
      complexity_router_config:
        tiers:
          SIMPLE:    claude-haiku-4-5
          MEDIUM:    claude-sonnet-5
          COMPLEX:   claude-opus-5
          REASONING: claude-opus-5
        classifier_type: llm
        classifier_llm_config:
          model: gemini-3.5-flash-lite     # a model_name from model_list above
          timeout_ms: 3000                 # on timeout, falls back to the heuristic
      complexity_router_default_model: claude-sonnet-5
```

Point a client at `smart-router` and every response carries `x-litellm-model-name` and `x-litellm-response-cost`. Full reference, including the classifier and tier-boundary knobs, on the [Auto Routing docs page](/docs/proxy/auto_routing).
