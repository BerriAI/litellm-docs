---
slug: auto-router-warm-prompt-cache
title: "AutoRouter: 32% Cheaper Multi-Turn Conversations"
date: 2026-08-06T12:00:00
authors:
  - tin
description: "Auto-router sessions now pin to a single deployment instead of a model group, so the provider's prompt cache stays warm for the whole conversation. Measured at 32% cheaper over 8-turn conversations. Plus the cost dashboard showing today's savings, an expired-miss stat that answers whether cache warming pays for itself, and 1-click presets that work with wildcard models."
image: ./hero.png
keywords: [auto router, llm routing, prompt caching, session affinity, cost dashboard, litellm, model routing, cost optimization]
tags: [routing, complexity-router, ui, engineering]
hide_table_of_contents: false
---

![LiteLLM Autorouter V2: session affinity now saves 32%](./hero.png)

Prompt caching and auto-routing were quietly fighting each other. Pinning a session to one deployment made our 8-turn benchmark 32% cheaper.

{/* truncate */}

:::info[🚀 Help shape the Auto-Router]

Get early access, work directly with the LiteLLM team, and influence the roadmap with your production traffic.

<a className="button button--primary button--lg" style={{background: '#2e8555', borderColor: '#2e8555', color: '#fff'}} href="https://calendar.app.google/i2e7qVEJphHi5S8UA">Apply to Become a Design Partner</a>

<br /><br />

Already testing it? Share your results in [discussion #32172](https://github.com/BerriAI/litellm/discussions/32172).

:::

## Sessions now stick to one deployment, not just one model

Session affinity used to pin a conversation to a model group. Most production groups run across several deployments, so the conversation still bounced between them, and each bounce landed on a deployment that had never seen it. The provider cache was cold and you paid full price to re-read context you had already sent, roughly every other turn.

- Sessions now pin to the exact deployment that served the first turn, and the pin lasts for the session's TTL
- Session pins are scoped per API key, so two keys that pick the same session id no longer share one pin

We measured it on 8-turn conversations against Claude Sonnet 4.5, through a model group fanned across two deployments, with a 5,300-token context that every turn re-sends. Same conversations, same content, same turn order in both arms; the only variable is which deployment served each turn.

| | Cost per conversation | Cache writes | Cache reads |
| --- | --- | --- | --- |
| Group affinity | $0.068 | 46,549 | 133,905 |
| Deployment affinity | $0.046 | 23,459 | 156,995 |

That is 32% cheaper, and it held between 31.9% and 32.7% on every conversation we ran. The token counts show the mechanism: bouncing between deployments doubled the tokens written to cache, because the second deployment had to write a prefix the first one already held.

Two things decide what this is worth to you. Deployments need separate caches for the fix to do anything, so two deployments pointed at the same provider account save nothing. And the savings grow with conversation length, since the re-sent context is what gets cached; single-turn traffic is unchanged.

## Today's savings now show up today

Spend is bucketed by UTC day, but the dashboard asked for a range ending on your local today. West of UTC, everything sent after 5pm PT landed in tomorrow's bucket and simply did not appear.

- The cost optimization dashboard now includes the current UTC day
- Your evening traffic shows up while you are still working, instead of reading $0 until the next morning

## The expired-miss stat now answers a real question

Expired misses are the turns where a session came back to a tier after that tier's cache had already expired. The percentage was divided only by return visits, which made the number look far worse than reality.

- It is now a share of all measured turns
- That is the number you need to decide whether background cache warming is worth paying for
- Tab names got shorter too: "Overall" and "Auto-Router"

## 1-click presets work with wildcard models

If your models are configured as wildcards (`anthropic/*`, `openai/*`, `bedrock/*`), the Anthropic and OpenAI templates showed up greyed out, claiming your models were missing.

- The models were not missing; the template check and the tier dropdown below it were reading two different lists
- Templates now expand wildcards the same way the dropdown does, so setup is one click

## Try it

:::info

Questions, or numbers from your own traffic? Post them on [discussion #32172](https://github.com/BerriAI/litellm/discussions/32172). To work on this with us directly, [apply to be a design partner](https://calendar.app.google/i2e7qVEJphHi5S8UA).

:::

Full setup on the [Auto Routing docs page](/docs/proxy/auto_routing), and savings land on the cost optimization dashboard in your LiteLLM UI.
