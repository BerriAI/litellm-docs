---
slug: auto-router-prompt-caching-benchmark
title: "75% Cost Savings Without Sacrificing Prompt Caching"
date: 2026-07-31T10:00:00
authors:
  - tin
image: ./hero.png
description: "The most common objection to auto-routing is that switching models throws away your prompt cache. We measured it across five datasets, including real gateway traffic with the provider's own cache accounting, and the answer is no."
keywords: [prompt caching, auto router, llm cost savings, model routing, cache warming, anthropic prompt cache, litellm auto routing, prefix cache]
tags: [routing, complexity-router, caching, cost, benchmarks, engineering]
hide_table_of_contents: false
---

![Auto-Router x Prompt Caching: measured across five datasets](./hero.png)

**Yes, you can use prompt caching with Auto-Routing.** The two compound rather than cancel out. We measured it across five datasets, two of which report what the provider's cache actually did.

{/* truncate */}

:::info[🚀 Help shape the Auto-Router]

Get early access, work directly with the LiteLLM team, and influence the roadmap with your production traffic.

<a className="button button--primary button--lg" style={{background: '#2e8555', borderColor: '#2e8555', color: '#fff'}} href="https://calendar.app.google/i2e7qVEJphHi5S8UA">Apply to Become a Design Partner</a>

<br /><br />

Already testing it? Share your results in [discussion #32172](https://github.com/BerriAI/litellm/discussions/32172).

:::

## The results

- **Auto-routing does not break prompt caching.** The two compound on every dataset we measured
- **37% to 69% cheaper** than caching alone on a single model
- **The real failure mode is the opposite one.** Running a router with caching switched off is about **4x more expensive** than caching one fixed model
- **Sessions return to a tier in a median of 10 seconds**, far inside any cache lifetime, so a switch is not an eviction

| Evaluation | Sample | Router + caching, vs caching alone |
| --- | --- | --- |
| Simulation, general chat ([WildChat-1M](https://huggingface.co/datasets/allenai/WildChat-1M)) | 30,769 multi-turn conversations | **68.7% cheaper** |
| Simulation, developer chat ([DevGPT](https://github.com/NAIST-SE/DevGPT)) | 1,011 conversations | **46% cheaper** |
| Real agent traces, provider cache accounting | 95 sessions, 8,174 API calls | **37.4% cheaper** |
| [TwinRouterBench](https://github.com/CommonstackAI/TwinRouterBench) static track | 81 multi-step instances | **44 to 50% cheaper** |

## How it was measured

- **Router arm:** one model group, four tiers. SIMPLE to `claude-haiku-4-5`, MEDIUM to `claude-sonnet-5`, COMPLEX and REASONING to `claude-opus-5`
- **Baseline arm:** every request to one frontier model with prompt caching on, the strongest realistic baseline rather than a cold-priced strawman
- **Cache behaviour:** read from `usage.cache_read_input_tokens` and `cache_creation_input_tokens` on the gateway spend logs and agent traces; modelled on the other three legs
- **Turn classification:** one window function partitioned by session and model, labelling each turn as staying on a model, first visiting a tier, or returning to one already used

## Why switching costs less than it looks

Measured over 4,684 tier returns on live gateway traffic:

| Measurement | Value |
| --- | --- |
| Median time since that tier was last used | **10 seconds** |
| 75th percentile | 21 seconds |
| Returns where the 5m cache had already expired | **3%** |
| Returns where the 1h cache had already expired | **1%** |

- The router moves between tiers in **seconds**, not minutes
- The cache on the tier you left is still there when the session comes back
- Claude Code writes to the **1 hour** cache, where **99.3%** of returns are already warm before anything else is done

## What that means for cache warming

A background refresher that replays a session's prefix sounds like the fix, if switching really did strand the cache. Narrowing from every cache miss to what a refresher could actually prevent:

| Stage | Share | Of what |
| --- | --- | --- |
| Missed on a return to a tier already used | 18.4% | of return turns |
| That tier had gone idle past the TTL | 27.1% | of those misses |
| It came back soon enough to bridge | 36.8% | of those expired |
| **Preventable by a refresher** | **4.0%** | **of all cache misses** |

- **Most return misses happen while the cache is still alive.** The request did not match the cached prefix, so no refresher helps
- On one router that was **51 calls rewriting ~160,000 token prefixes**, against **7** a refresher could have rescued
- Roughly **10x the warming opportunity**, and a prompt stability problem instead
- Expired returns split at two scales: **1 to 3 hours** (bridgeable) and **11 to 28 hours** (not)

## Where warming's sign flips

- One avoided cache write is worth about **19 replays** at the 1h TTL, **11.5** at 5m
- Replays fire on every idle session; you only win on the ones that return in reach
- The refresh interval must match the TTL in use. One tuned for a 5m cache fires ~13x more often than a 1h cache needs, which alone turns a positive result negative

| Traffic | Typical prefix | Effect |
| --- | --- | --- |
| General chat | ~1,700 tokens | **-0.10%** |
| Agent traces, multi-hour gaps | large | **-0.63%** |
| Our gateway, agentic | ~190,000 tokens | **positive**, one rescue worth ~$1.82 against a ~$0.06 replay |

Warming is worth roughly plus or minus two percent: a narrow optimization for long sessions with large stable prefixes, not the thing standing between a deployment and its savings.

## See it on your own traffic

The Auto-Router Benchmarks tab now reports prompt cache behaviour per router, from the provider's own usage payload:

- **Hit rate**, split by whether the turn stayed on a model, first visited a tier, or returned to one
- **Expired-miss share**, narrowing return misses to those whose tier went idle past the TTL
- **Savable by warming**, the share of all misses a refresher could prevent
- **Warming cost and net estimate**, in dollars
- **Coverage**, so a low hit rate caused by response logging being off does not read as a cold cache

```
GET /auto_router/benchmarks?start_date=2026-07-01&end_date=2026-07-31
```

## Try it

:::info

Point a client at an auto-router with prompt caching on, then check the Auto-Router Benchmarks tab against your own traffic. Share numbers or questions on [discussion #32172](https://github.com/BerriAI/litellm/discussions/32172). To work on this with us directly, [apply to be a design partner](https://calendar.app.google/i2e7qVEJphHi5S8UA).

:::

```yaml title="config.yaml"
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

Every response carries `x-litellm-model-name` and `x-litellm-response-cost`, and the provider's cache token counts land in the spend logs. Full reference on the [Auto Routing docs page](/docs/proxy/auto_routing).
