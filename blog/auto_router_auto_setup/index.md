---
slug: auto-router-auto-setup
title: "One-click setup for Auto Router"
date: 2026-09-03T10:00:00
authors:
  - moe
description: "Auto Setup checks which models you can use and creates an editable Auto Router configuration based on setups that have worked well for us."
keywords: [auto router, auto setup, complexity router, heuristic v2, model routing, litellm]
tags: [routing, complexity-router, product]
hide_table_of_contents: false
---

Setting up an Auto Router takes a few decisions: which model should handle simple requests, which one should handle reasoning, and what belongs between them. Most users want a good starting point before they spend time tuning those choices.

Auto Setup gives you that starting point. Enter a router name, click **Configure automatically**, review the result, and save it.

Users have seen 42% lower model spend from the generated setup before making any manual changes. Your savings will depend on your models and traffic, but Auto Setup gives you a useful baseline from the first request.

{/* truncate */}

:::info Availability

Auto Setup is introduced in [LiteLLM PR #39693](https://github.com/BerriAI/litellm/pull/39693). It changes setup in the Dashboard. Requests continue to use the existing Auto Router runtime.

:::

## One click, using your models

Open **Add Model → Auto Router** in the LiteLLM Dashboard. The new **Configure automatically** button checks the chat models available to you and builds the four Auto Router tiers.

LiteLLM first looks for a complete match with one of the configurations we use internally and have seen work well. It prefers the templates in this order:

1. 1M Context
2. Anthropic
3. OpenAI
4. Gemini
5. Lite

LiteLLM only chooses a template when you have access to every model it requires. The setup uses your own model-group names, so the generated router points at deployments you can call.

If none of the templates fit, LiteLLM still creates a starting configuration from your available chat models. It orders model groups using their configured or published input and output token prices, then spreads them across the SIMPLE, MEDIUM, COMPLEX, and REASONING tiers. With four or more available model groups, each tier gets a different group. Smaller inventories reuse models where needed.

## Review it before saving

Auto Setup fills the same form you can configure by hand. You can open the detailed configuration, change any model, and edit routing settings before you create the router.

The saved result is a normal `heuristic_v2` Auto Router:

```yaml
model: auto_router/complexity_router
complexity_router_config:
  classifier_type: heuristic_v2
  tiers:
    SIMPLE: [your-simple-model-group]
    MEDIUM: [your-medium-model-group]
    COMPLEX: [your-complex-model-group]
    REASONING: [your-reasoning-model-group]
```

At runtime, [Heuristic v2](/blog/heuristic-v2) classifies each request and sends it to the matching tier. Auto Setup affects the initial configuration only. It does not add another model call or change the runtime router.

## Start now, tune from your traffic

The first version solves the setup problem with a small, predictable rule: reuse a configuration we trust when your model inventory supports it, then fall back to a price-ordered ladder when it does not. Users have seen 42% savings without changing the generated configuration. You can see every choice Auto Setup made and tune it after the fact.

Open **Add Model → Auto Router**, click **Configure automatically**, and inspect the four tiers. You can get started right away and tune the setup later from your own traffic, spend, and quality data.

Full reference: [Auto Routing](https://docs.litellm.ai/docs/proxy/auto_routing).
