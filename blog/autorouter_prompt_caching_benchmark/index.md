---
slug: auto-router-prompt-caching-benchmark
title: "Does auto-routing break prompt caching? We measured it"
date: 2026-07-31T10:00:00
authors:
  - tin
description: "The most common objection to auto-routing is that switching models throws away your prompt cache. We measured it across five datasets, including real gateway traffic with the provider's own cache accounting, and the answer is no."
keywords: [prompt caching, auto router, llm cost savings, model routing, cache warming, anthropic prompt cache, litellm auto routing, prefix cache]
tags: [routing, complexity-router, caching, cost, benchmarks, engineering]
hide_table_of_contents: false
---

The most common objection we hear about auto-routing is that it throws away your prompt cache. Provider caches are per-model, so if the router moves a session from Haiku to Sonnet, the reasoning goes, the new model starts cold and you pay a full prefix write. We measured it across five datasets, including real gateway traffic where the provider reports what its cache actually did.

{/* truncate */}

## The results

Auto-routing and prompt caching compound. Every dataset we measured puts the two together ahead of either alone.

| Evaluation | Sample | Router + caching, vs caching alone on one model |
| --- | --- | --- |
| Simulation, general chat ([WildChat-1M](https://huggingface.co/datasets/allenai/WildChat-1M)) | 30,769 multi-turn conversations | **68.7% cheaper** |
| Simulation, developer chat ([DevGPT](https://github.com/NAIST-SE/DevGPT)) | 1,011 conversations | **46% cheaper** |
| Real agent traces, provider cache accounting | 95 sessions, 8,174 API calls | **37.4% cheaper** |
| [TwinRouterBench](https://github.com/CommonstackAI/TwinRouterBench) static track | 81 multi-step instances | **44 to 50% cheaper** |

The sharpest number is the one that goes the other way. On DevGPT, running the router with caching switched **off** is roughly four times more expensive than simply caching a single fixed model, because every turn resends the whole accumulated transcript at full input price and cost grows with the square of conversation depth. The failure mode people worry about is real; it just belongs to running a router without caching, not to running both.

## Why switching costs less than it looks

The intuition assumes a tier switch strands the cache. What the data shows is that sessions come back before anything expires.

We pulled every tier return from our own gateway's spend logs, where the auto-router was live and the provider reported its own cache token counts:

| | |
| --- | --- |
| Tier returns observed | 4,684 |
| Median time since that tier was last used | **10 seconds** |
| Returns where the 5m cache had already expired | 3% |
| Returns where the 1h cache had already expired | 1% |

The router moves between tiers in seconds, well inside any cache lifetime. A switch is not a cache eviction; the cache on the tier you left is still sitting there when you come back to it.

This is also why the TTL you choose matters more than the routing policy. Claude Code writes to the one hour cache, and at that lifetime **99.3% of tier returns are already warm** before anything else is done.

## What that means for cache warming

A background refresher that replays a session's prefix to keep caches alive is the obvious remedy if you believe switching strands the cache. We built the measurement before building the feature, and the opportunity turns out to be small.

Start from every cache miss and narrow to what a refresher could actually prevent:

| Stage | Share |
| --- | --- |
| Misses on a return to a tier the session had used | 18.4% of return turns |
| ... of those, the tier had gone idle past the TTL | 27.1% |
| ... of those, it came back soon enough to bridge | 36.8% |
| **Preventable by a refresher** | **4.0% of all cache misses** |

Each narrowing removes misses warming provably cannot fix. The largest drop is the first: most return misses happen while the cache is **still alive**, so the request simply did not match the cached prefix. On one router those were 51 calls that rewrote roughly 160,000 token prefixes each, against 7 that a refresher could have rescued. That is a prompt stability problem, and it is about ten times larger than the warming opportunity sitting next to it.

The second drop is timing. Expired returns cluster at two scales: a group between one and three hours, which a single refresh can bridge, and a group between eleven and twenty-eight hours, which no affordable refresher reaches.

## The economics, and where the sign flips

Warming is a bet placed on every idle session, settled only by the ones that return. With Anthropic's rates, one avoided cache write is worth about 19 replays at the one hour TTL and 11.5 at five minutes, so bridging a short gap is cheap; funding the sessions that never come back is what costs.

Measured across our datasets, the sign depends on how large the cached prefix is:

| Traffic | Typical prefix | Warming's effect |
| --- | --- | --- |
| General chat | ~1,700 tokens | **-0.10%**, each rescue worth fractions of a cent |
| Donated agent traces, multi-hour gaps | large | **-0.63%**, gaps too long to bridge |
| Our gateway, agentic traffic | ~190,000 tokens | **positive**, one rescue worth about $1.82 against a $0.06 replay |

So warming is worth roughly plus or minus two percent, and which side depends on whether a single rescued write outweighs the replays spent finding it. It is a narrow optimization for long sessions with large, stable prefixes, not the thing standing between a deployment and its savings.

One configuration detail carries more weight than the feature itself: the refresh interval has to match the TTL actually in use. A refresher tuned for a five minute cache fires roughly thirteen times more often than a one hour cache needs, and that alone turns a positive result negative.

## See it on your own traffic

The Auto-Router Benchmarks tab now reports prompt cache behavior per router, computed from the provider's own usage payload rather than inferred.

Hit rate is split by what the router did on each turn, because that is where the routing specific cost lives. Turns that stay on one model reuse their prefix, a first visit to a tier is cold by design, and a return to a tier the session already used is the only place an avoidable cold write shows up. Alongside those sit the share of misses a refresher could prevent, what it would cost to run, and a coverage figure so a low hit rate caused by response logging being switched off does not read as a cold cache.

```
GET /auto_router/benchmarks?start_date=2026-07-01&end_date=2026-07-31
```

## Caveats

Cache behavior is measured directly on the gateway spend logs and the agent traces, where the provider reports read and write token counts; it is modeled on the WildChat, DevGPT and TwinRouterBench legs. The positive warming result rests on seven rescued writes in a single router, so one unusual session moves it, and the cost side is modeled rather than measured because warming is not yet running. All of the arithmetic uses Anthropic's cache rates; OpenAI's automatic caching carries no write premium and would change the constants throughout.

## Try it

:::info

Point a client at an auto-router with prompt caching enabled and check the Auto-Router Benchmarks tab against your own traffic. Share numbers or questions on [discussion #32172](https://github.com/BerriAI/litellm/discussions/32172)

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

Every response carries `x-litellm-model-name` and `x-litellm-response-cost`, and the provider's cache token counts land in the spend logs, which is all the instrumentation these numbers needed. Full reference on the [Auto Routing docs page](/docs/proxy/auto_routing).
