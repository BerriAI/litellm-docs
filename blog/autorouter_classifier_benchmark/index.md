---
slug: auto-router-classifier-benchmark
title: "Pick the Right LLM Classifier to Achieve Same performance at 1/8th price"
date: 2026-08-06T10:00:00
authors:
  - tin
description: "We benchmarked 12 LLMs plus a zero-cost heuristic as the complexity classifier behind the Auto Router; same prompt, same dataset, same harness. The winner, the surprises, and the config to use it."
image: ./hero.png
keywords: [llm classifier benchmark, complexity classifier, auto router, prompt classification, model routing, tier classification, litellm auto routing, small llm benchmark]
tags: [routing, complexity-router, benchmarks, engineering]
hide_table_of_contents: false
---

![LiteLLM Autorouter V2: which LLM should classify your prompts?](./hero.png)

**Our pick for the Auto Router's classifier is `gpt-4o-mini`: second-best accuracy at half the leader's price.** We tested 13 classifiers on the same 100 prompts to find it.

{/* truncate */}

:::info[🚀 Help shape the Auto-Router]

Get early access, work directly with the LiteLLM team, and influence the roadmap with your production traffic.

<a className="button button--primary button--lg" style={{background: '#2e8555', borderColor: '#2e8555', color: '#fff'}} href="https://calendar.app.google/i2e7qVEJphHi5S8UA">Apply to Become a Design Partner</a>

<br /><br />

Already testing it? Share your results in [discussion #32172](https://github.com/BerriAI/litellm/discussions/32172).

:::

## Key findings

- **We identified four top performers:** `gemini-3.5-flash-lite` (65%), `gpt-4o-mini` (64%), `claude-haiku-4-5` (63%) and `grok-4.1-fast` (61%). All four score between 61% and 65%, close enough that the gaps are noise at this sample size, so pick on latency and price; accuracy will not separate them
- **Do not use a model built for reasoning as a classifier.** Anything that thinks before it answers (o3, `gpt-5.4-nano`) spends latency and tokens for zero accuracy gain. Classification is a one-word answer, so thinking is pure overhead
- **Open-source models are faster, and less accurate.** `llama-3.1-8b` on your own GPU is the fastest classifier we tested, at 0.16s, but only gets 48%. `deepseek-v3.2` is the one that keeps up with the hosted models, and it costs more to run
- **The free heuristic is a real floor at 45%.** It scores locally, with no API call and nothing added to your latency. Our pick gets 64% against its 45%, and that gap is the whole value of paying for a classifier hop

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

We also ran the open-source models on a laptop CPU. They scored about the same, but the timings mean nothing next to a hosted API, so those rows are left out.

## How it was measured

- **Every model got the same prompt**, `temperature=0`, `max_tokens=8`. We tuned nothing per model, so the only thing being measured is the model
- **We ran the open-source models on rented H100s and H200s**, and we threw away the first call because a cold GPU takes 20 seconds to answer
- **Deterministic labels.** No LLM wrote the answer key. It is tempting to have a big model label the prompts, but then you are just testing whether small models agree with a big one. Instead each prompt keeps the difficulty its source already gave it:

| Tier | Sources |
| --- | --- |
| simple | TriviaQA single-fact, llm-query-complexity-benchmark LOW, RouterArena *easy*, hand-authored chit-chat / format / extract |
| medium | llm-query-complexity-benchmark MEDIUM, RouterArena *medium*, GSM8K, hand-authored explain / small-code / write |
| complex | llm-query-complexity-benchmark HIGH (MMLU-Pro, PubMedQA), RouterArena *hard*, hand-authored system design and open-ended synthesis |
| reasoning | MATH-500 level 5, AIME 2025, BIG-Bench-Hard, hand-authored proofs and puzzles |

## How to get past 65% accuracy

We tested every lightweight model on the market and they top out around the same mark. To go further:

- **Write the prompt around your own traffic.** The classifier prompt and the tier names are both replaceable. "Customer support reply" and "SQL generation" are much easier to spot than "medium"
- **Round up when torn.** Guessing a tier too high wastes a little money; guessing too low gives your user a worse answer. Break ties upward
- **Let the router learn from outcomes**, which is what [adaptive routing](/docs/adaptive_router) does

[Adaptive routing](/docs/adaptive_router) keeps a running score of how well each model does on each kind of request, learned from your traffic, and picks accordingly. The classifier still sets a floor so a hard prompt never lands on a cheap model. The difference is what gets graded: a classifier is graded on matching a human label, adaptive routing is graded on whether the answer was any good.

## What's next

- **Auto Router evaluation on your live traffic.** Everything above is scored on public benchmarks; the next step is replaying your own production prompts through the router, so the accuracy and savings numbers are measured on the traffic you actually serve rather than ours
- **Adaptive routing trained on your live traffic.** The classifier picks a tier; adaptive routing then learns which model inside that tier earns its price on your requests, scoring real outcomes instead of following a fixed tier-to-model mapping

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
  - model_name: gpt-4o-mini                # the classifier: 64% tier accuracy, ~$0.04/1k
    litellm_params:
      model: openai/gpt-4o-mini
      api_key: os.environ/OPENAI_API_KEY

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
          model: gpt-4o-mini               # a model_name from model_list above
          timeout_ms: 3000                 # on timeout, falls back to the heuristic
      complexity_router_default_model: claude-sonnet-5
```

Point a client at `smart-router` and every response carries `x-litellm-model-name` and `x-litellm-response-cost`. Full reference, including the classifier and tier-boundary knobs, on the [Auto Routing docs page](/docs/proxy/auto_routing).
