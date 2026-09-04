---
slug: auto-router-auto-setup
title: "One-click setup for Auto Router"
date: 2026-09-03T10:00:00
authors:
  - moe
description: "Auto Setup checks which models you can use, chooses the model family, and assigns all four Auto Router tiers for you."
keywords: [auto router, auto setup, complexity router, heuristic v2, model routing, litellm]
tags: [routing, complexity-router, product]
hide_table_of_contents: false
---

LiteLLM already includes one-click Anthropic and OpenAI presets for Auto Router. Those presets save you from writing the configuration, but you still need to choose a model family and make sure your proxy serves every model in that preset.

Enter a router name and click **Configure automatically**. LiteLLM checks the models your proxy already serves, chooses the best configuration it can build, and fills the form for you. Review the four tiers and save.

Users have seen 42% lower model spend from the generated setup before making any manual changes. Your savings will depend on your models and traffic, but Auto Setup gives you a useful baseline from the first request.

{/* truncate */}

:::info Availability

Auto Setup is introduced in [LiteLLM PR #39693](https://github.com/BerriAI/litellm/pull/39693). It changes setup in the Dashboard. Requests continue to use the existing Auto Router runtime.

:::

## How this differs from the existing presets

The existing **Template** dropdown asks you to choose Anthropic, OpenAI, or Custom. A family preset works when your proxy serves every model it requires.

**Configure automatically** makes that choice for you. It checks your available chat model groups across providers and:

- applies the first complete preset your proxy can support
- builds a four-tier configuration from the preferred models you do have when no complete preset fits
- uses price-based ranking only when your proxy has none of those preferred models

The existing presets remain available when you want direct control. Auto Setup uses them as trusted starting points, then handles partial and mixed-family model inventories that a single preset cannot cover.

## One click, using your models

Open **Add Model → Auto Router** in the LiteLLM Dashboard. The new **Configure automatically** button checks the chat models available to you and builds the four Auto Router tiers.

LiteLLM first looks for a complete match with one of the configurations we use internally and have seen work well. It prefers the templates in this order:

1. 1M Context
2. Anthropic
3. OpenAI
4. Gemini
5. Lite

LiteLLM only chooses a template when you have access to every model it requires. The setup uses your own model-group names, so the generated router points at deployments you can call.

If none of the complete templates fit, LiteLLM checks the preferred models configured for each tier across those templates. It uses the preferred models you have and fills any gap with the closest matched tier. This covers users who have a useful mix of models without every model required by one family template.

The last fallback runs only when you have none of the preferred models. LiteLLM orders your available chat model groups using their configured or published input and output token prices, then selects one group for each tier. Even with hundreds of models, the generated router still has four tier assignments rather than splitting the whole inventory across the tiers.

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

The first version solves the setup problem with a small, predictable rule: reuse a complete configuration we trust, then use the preferred tier models you have, and keep price ranking as the last fallback. Users have seen 42% savings without changing the generated configuration. You can see every choice Auto Setup made and tune it after the fact.

Open **Add Model → Auto Router**, click **Configure automatically**, and inspect the four tiers. You can get started right away and tune the setup later from your own traffic, spend, and quality data.

Full reference: [Auto Routing](https://docs.litellm.ai/docs/proxy/auto_routing).
