---
slug: auto-router-auto-setup
title: "One-click setup for Auto Router"
date: 2026-09-03T10:00:00
authors:
  - moe
description: "Auto Setup checks which models you can use and assigns all four Auto Router tiers for you."
keywords: [auto router, auto setup, complexity router, heuristic v2, model routing, litellm]
tags: [routing, complexity-router, product]
hide_table_of_contents: false
---

LiteLLM already includes one-click Anthropic and OpenAI presets for Auto Router. Those presets save you from writing the configuration, but you still need to choose a model family and make sure your proxy serves every model in that preset.

Enter a router name and click **Configure automatically**. LiteLLM checks the models your proxy already serves, chooses the best configuration it can build, and fills the form for you. Review the four tiers and save.

![Configure automatically fills the four Auto Router tiers from the models available to your proxy](/img/blog/auto-router-auto-setup.png)

Users have seen 42% lower model spend from the generated setup before making any manual changes. Your savings will depend on your models and traffic, but Auto Setup gives you a useful baseline from the first request.

{/* truncate */}

:::info Availability

Auto Setup is introduced in [LiteLLM PR #39693](https://github.com/BerriAI/litellm/pull/39693). It changes setup in the Dashboard. Requests continue to use the existing Auto Router runtime.

:::

## How this differs from the existing presets

The existing **Template** dropdown asks you to choose Anthropic, OpenAI, or Custom. A family preset works when your proxy serves every model it requires.

**Configure automatically** makes that choice for you. It checks your available chat model groups across providers and:

- builds each tier from current low, medium, and flagship model families
- mixes model families when that produces the best match for the models you have
- falls back to the models used in LiteLLM's existing presets

The existing presets remain available when you want direct control. Auto Setup uses their tier assignments as a shared catalog, so a complete family preset does not override a better match from another preset.

## One click, using your models

Open **Add Model → Auto Router** in the LiteLLM Dashboard. The new **Configure automatically** button checks the chat models available to you and builds the four Auto Router tiers.

LiteLLM starts with current model ladders from OpenAI, Anthropic, Google, DeepSeek, and xAI. For providers with a model family, that means the efficient model for **Simple**, the balanced model for **Medium**, and the flagship for **Complex**. **Reasoning** reuses the flagship. When your proxy reports the model group's supported reasoning efforts, Auto Setup selects the strongest value from that list; otherwise, it leaves the setting at the provider default. If one provider does not cover every tier, Auto Setup can mix families; if no preferred model is available for one tier, it reuses the closest tier match.

For example, if your proxy serves the current OpenAI ladder, Auto Setup selects GPT-5.6 Luna, GPT-5.6 Terra, and GPT-6 Astra, then uses GPT-6 Astra again for the final tier. If that model group advertises `max`, Auto Setup applies it. It only selects models and reasoning efforts your proxy reports as available.

The setup uses your own model-group names, so the generated router points at deployments you can call.

If none of your models appear in the curated catalog, LiteLLM hides **Configure automatically**. You can still choose a family preset or configure the tiers yourself. Even with hundreds of models, Auto Setup selects one model group per tier.

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
    REASONING: [your-complex-model-group]
```

At runtime, [Heuristic v2](/blog/heuristic-v2) classifies each request and sends it to the matching tier. Auto Setup affects the initial configuration only. It does not add another model call or change the runtime router.

## Start now, tune from your traffic

The first version solves the setup problem with a small rule: fill each tier from the curated models you have and stay out of the way when none match. Users have seen 42% savings without changing the generated configuration. You can see every choice Auto Setup made and tune it after the fact.

Open **Add Model → Auto Router**, click **Configure automatically**, and inspect the four tiers. You can get started right away and tune the setup later from your own traffic, spend, and quality data.

Full reference: [Auto Routing](https://docs.litellm.ai/docs/proxy/auto_routing).
