---
slug: auto-router-per-hop-compression
title: "AutoRouter Per-Hop Compression: Cut Classification Costs 32%"
date: 2026-09-05T21:00:00
authors:
  - moe
image: ./compression-config.png
description: "AutoRouter can now apply different compression to the routing classifier and the model call. The classifier only needs enough context to route correctly, not to generate an answer. In internal testing, aggressive classifier compression reduced costs 32% while maintaining routing accuracy."
keywords: [auto router, compression, cost savings, routing classifier, prompt compression, llm gateway, litellm]
tags: [routing, cost, compression, engineering]
hide_table_of_contents: false
---

![Routing vs Model Compression: compress the routing decision independently](./compression-config.png)

**The AutoRouter classifier can now be compressed more aggressively than your model calls. In internal testing, this reduced classification costs by 32% with no loss in routing accuracy.**

{/* truncate */}

:::info[🚀 Help shape the Auto-Router]

Get early access, work directly with the LiteLLM team, and influence the roadmap with your production traffic.

<a className="button button--primary button--lg" style={{background: '#2e8555', borderColor: '#2e8555', color: '#fff'}} href="https://calendar.app.google/i2e7qVEJphHi5S8UA">Apply to Become a Design Partner</a>

<br /><br />

Already testing it? Share your results in [discussion #32168](https://github.com/BerriAI/litellm/discussions/32168).

:::

## The problem

Every request through an AutoRouter pays for two LLM calls. The first one, the complexity classifier, decides where the request should go: SIMPLE task to a cheap model, MEDIUM to something in the middle, COMPLEX or REASONING to a frontier model. The second call is the actual model that answers the request.

Until now, both calls shared the same compression setting. That's wasteful. The classifier only needs enough context to answer one question: what tier can handle this. It doesn't need the full conversation history or the detailed background the model call needs.

## The solution

Two new fields decouple classifier compression from model-call compression:

- `auto_router_routing_compression`: the guardrail to compress the classifier's prompt
- `auto_router_model_compression`: the guardrail to compress the model's prompt

Set the routing compression to be aggressive while the model call compression stays moderate. The same guardrail on both hops runs compression once, never twice. Either field can be `none` to skip compression for that hop.

## How it works

When you send a request through an AutoRouter with separate compression settings:

1. The proxy applies the routing-hop compression to a copy of your messages
2. The classifier sees the compressed version and makes a routing decision
3. Your original messages get the model-hop compression applied
4. The routed model receives its own compressed copy
5. In the logs and API response, you see which compression guardrail ran for each hop

If both hops use the same guardrail, the proxy compresses once and reuses the result. If a compression guardrail is unreachable and set to `fail_closed`, the request fails safely.

## Setting it up

```yaml title="config.yaml"
model_list:
  - model_name: gpt-4o-mini
    litellm_params: {model: openai/gpt-4o-mini, api_key: os.environ/OPENAI_API_KEY}
  - model_name: gpt-4o
    litellm_params: {model: openai/gpt-4o, api_key: os.environ/OPENAI_API_KEY}
  - model_name: gpt-4-turbo
    litellm_params: {model: openai/gpt-4-turbo, api_key: os.environ/OPENAI_API_KEY}

  - model_name: smart-router
    litellm_params:
      model: auto_router/complexity_router
      complexity_router_config:
        tiers:
          SIMPLE: gpt-4o-mini
          MEDIUM: gpt-4o
          COMPLEX: gpt-4-turbo
        
        # Aggressive compression for the classifier
        auto_router_routing_compression: headroom-aggressive
        # Moderate compression for the model call
        auto_router_model_compression: headroom-moderate

guardrails:
  - guardrail_name: headroom-aggressive
    litellm_params:
      guardrail: headroom
      mode: pre_call
      api_base: https://api.berri.ai/headroom
      model: o1
      tokens_to_retain: 200

  - guardrail_name: headroom-moderate
    litellm_params:
      guardrail: headroom
      mode: pre_call
      api_base: https://api.berri.ai/headroom
      model: gpt-4o-mini
      tokens_to_retain: 1000
```

In the Admin UI, open an AutoRouter's Detailed Configuration, then Advanced: Compression. Pick your routing guardrail, choose "Use a different compression" for the model call, and select its guardrail separately.

:::info[Try it on your traffic]

Point a shadow-eval job at your busiest team, compare your current config against one with split compression, and tell us what you see in [discussion #32168](https://github.com/BerriAI/litellm/discussions/32168), or

<a className="button button--primary button--lg" style={{background: '#2e8555', borderColor: '#2e8555', color: '#fff'}} href="https://calendar.app.google/i2e7qVEJphHi5S8UA">Apply to Become a Design Partner</a>

:::
