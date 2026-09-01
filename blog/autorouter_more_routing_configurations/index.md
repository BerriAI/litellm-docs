---
slug: auto-router-more-routing-configurations
title: "Auto-Router: Route on Context Size and Modality"
date: 2026-09-01T10:00:00
authors:
  - tin
image: ./hero.png
description: "The Auto-Router now supports more routing configurations: context-window escalation moves oversized prompts to the cheapest tier that fits them before dispatch, modality routing sends image requests to tiers that can see, classification can run on user turns only, and shadow evaluations can compare several router configs on a team's live traffic."
keywords: [auto router, complexity router, context window routing, modality routing, capability routing, model routing, shadow evaluation, litellm auto routing, llm gateway]
tags: [routing, complexity-router, engineering]
hide_table_of_contents: false
---

![Auto-Router: one router, more routing signals; complexity, context size, and modality](./hero.png)

The Auto-Router picks a model by asking how hard the request is. This release adds the questions that come right after: does the request fit the model we picked, and can that model even see it?

{/* truncate */}

:::info[🚀 Help shape the Auto-Router]

Get early access, work directly with the LiteLLM team, and influence the roadmap with your production traffic.

<a className="button button--primary button--lg" style={{background: '#2e8555', borderColor: '#2e8555', color: '#fff'}} href="https://calendar.app.google/i2e7qVEJphHi5S8UA">Apply to Become a Design Partner</a>

<br /><br />

Already testing it? Share your results in [discussion #32168](https://github.com/BerriAI/litellm/discussions/32168).

:::

Complexity tiers don't predict routability. A trivially simple question asked 300k tokens into a coding session still can't go to a small model, and a "what's in this screenshot?" request can't go to a text-only model no matter how easy the question is. The router now checks for both before dispatch, and shadow evaluations let you prove any of these configurations on a team's live traffic before rolling it out.

## One router, more routing signals

| Routing signal | What it does | Config key | Default |
| --- | --- | --- | --- |
| **Complexity** | Classifies the request and picks a tier | `tiers` | core behavior |
| **Context size** | Escalates prompts that provably don't fit the decided tier | `enable_context_window_escalation` | **on** |
| **Modality** | Routes image-bearing requests to vision-capable tiers | `modality_routing` | off, opt-in |
| **Turn type** | Classifies new user asks only, skipping continuation turns | `classification_mode: user_turn` | `every_request` |

Every gate reports what it did. Escalated decisions carry `context_escalated` or `modality_escalation` plus the tier the classifier originally picked, so nothing the router does is invisible.

## Context-window based routing

The market-standard answer to "the prompt didn't fit" is reactive: send the request, catch the context-length 400, retry on a bigger model. You pay for the failed call and the latency, on every turn of a long session. When we surveyed how routing products handle this, reactive fallback was the norm; we didn't find one that filters candidates by token count before dispatch.

The Auto-Router now does it pre-dispatch:

- **Estimates the full prompt footprint before sending**, including system prompts and tool definitions; for coding agents like Claude Code those carry most of the payload
- **Escalates to the cheapest tier that provably fits.** A fitting model group in the decided tier wins first, so you never pay for more model than the prompt requires
- **Unknown context windows are left alone.** The gate acts only when it can prove a mismatch
- **Escalated decisions are never session-pinned.** When the session shrinks back down, routing comes back down with it
- **On by default**, with a safety buffer (`context_window_escalation_buffer: 0.95`) so prompts near the limit escalate instead of gambling

## Modality-based routing

If your cheap tier is text-only and a request carries an image, the old outcome was a provider-side error after the request had already left the gateway. With `modality_routing: true`:

- **Images are detected anywhere in the request**: OpenAI `image_url` and `input_image` parts, Anthropic `image` blocks, and images nested inside tool results, the shape real agent screenshots arrive in
- **The router walks up to the nearest vision-capable tier** from the one the classifier decided
- **No tier can see? A clear 400 from the gateway**, instead of a confusing provider error
- **Conservative by design.** Only models explicitly marked as lacking vision are excluded; unknown models stay eligible
- **Opt-in**, off by default

## Classify when it matters

Agentic sessions fire many requests per conversation, and most of them (tool results, follow-ups, retries) aren't new questions. With `classification_mode: user_turn`, the classifier runs only when the newest message is an actual new user ask, and the standing decision carries the continuation turns. Fewer classifier calls, less routing overhead, and steadier model selection mid-task.

## Shadow-evaluate it on a team, before anyone notices

[Shadow evaluations](/blog/auto-router-shadow-evaluations) test the Auto-Router against your live traffic without changing a single user-facing response. Here's what you can do with them now:

- **Target a `key`, a `team`, or a `user`.** JWT-authenticated traffic has no virtual key to point at; team and user targeting makes it evaluable for the first time
- **Compare several router configs in one job**, against the same sampled traffic
- **Trust the comparison: sampling is paired.** Every config sees the identical request, so quality and cost differences come from the config, never traffic luck

That closes the loop on everything above: draft a config with the new gates on, shadow it against your current router on a real team's traffic, read the paired comparison, promote the winner.

## Turning it on

```yaml
model_list:
  - model_name: gpt-4o-mini
    litellm_params: {model: openai/gpt-4o-mini, api_key: os.environ/OPENAI_API_KEY}
  - model_name: gpt-4o
    litellm_params: {model: openai/gpt-4o, api_key: os.environ/OPENAI_API_KEY}
  - model_name: claude-sonnet-5
    litellm_params: {model: anthropic/claude-sonnet-5, api_key: os.environ/ANTHROPIC_API_KEY}
  - model_name: gpt-5.5
    litellm_params: {model: openai/gpt-5.5, api_key: os.environ/OPENAI_API_KEY}

  - model_name: smart-router
    litellm_params:
      model: auto_router/complexity_router
      complexity_router_config:
        tiers:
          SIMPLE:    gpt-4o-mini
          MEDIUM:    gpt-4o
          COMPLEX:   claude-sonnet-5
          REASONING: gpt-5.5

        # on by default: escalate prompts that provably don't fit
        enable_context_window_escalation: true
        context_window_escalation_buffer: 0.95

        # opt-in: route image requests to vision-capable tiers
        modality_routing: true

        # classify new user asks, carry the decision through continuation turns
        classification_mode: user_turn
      complexity_router_default_model: gpt-4o
```

Context-window escalation is already on; long sessions just stop failing. Modality routing is one line. Both show up in the routing decision, so you can watch exactly when and why each gate fired.

:::info[Try it on your traffic]

Point a shadow-eval job at your busiest team, compare your current config against one with the new gates on, and tell us what you see in [discussion #32168](https://github.com/BerriAI/litellm/discussions/32168), or

<a className="button button--primary button--lg" style={{background: '#2e8555', borderColor: '#2e8555', color: '#fff'}} href="https://calendar.app.google/i2e7qVEJphHi5S8UA">Apply to Become a Design Partner</a>

:::
