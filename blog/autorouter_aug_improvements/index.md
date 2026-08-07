---
slug: auto-router-warm-prompt-cache
title: "Your prompt cache no longer goes cold every other turn"
date: 2026-08-06T12:00:00
authors:
  - tin
description: "Auto-router sessions now pin to a single deployment instead of a model group, so the provider's prompt cache stays warm for the whole conversation. Plus three smaller fixes to the cost dashboard and 1-click presets."
image: ./hero.png
keywords: [auto router, llm routing, prompt caching, session affinity, cost dashboard, litellm, model routing, cost optimization]
tags: [routing, complexity-router, ui, engineering]
hide_table_of_contents: false
---

![LiteLLM Autorouter V2: your prompt cache stays warm](./hero.png)

Prompt caching and auto-routing were quietly fighting each other. As of today they compound.

{/* truncate */}

:::info[🚀 Help shape the Auto-Router]

Get early access, work directly with the LiteLLM team, and influence the roadmap with your production traffic.

<a className="button button--primary button--lg" style={{background: '#2e8555', borderColor: '#2e8555', color: '#fff'}} href="https://calendar.app.google/i2e7qVEJphHi5S8UA">Apply to Become a Design Partner</a>

<br /><br />

Already testing it? Share your results in [discussion #32172](https://github.com/BerriAI/litellm/discussions/32172).

:::

## Sessions now stick to one deployment

- Session affinity used to pin a conversation to a **model group**
- If that group runs across several deployments, which is what most production setups look like, the conversation still bounced between them
- Every bounce lands on a deployment that has never seen the conversation, so the provider cache is cold and you pay full price to re-read the same context
- On a fanned group that happened roughly every other turn

Sessions now pin to the exact deployment that served the first turn, and the pin lasts for the session's TTL. The conversation stays where its cache lives.

**Why you care:** on long conversations, most of what you send is context you already sent. Keeping the cache warm is the difference between paying for that context once and paying for it over and over.

One related fix in the same change: session pins are now scoped per API key. Two different keys that happened to pick the same session id used to share a single pin.

## Also shipped today

- **Today's savings show up today.** Spend is bucketed by UTC day, but the dashboard asked for a range ending on your local today. West of UTC, everything after 5pm PT landed in tomorrow's bucket, so the dashboard read $0 all evening, every evening. The cost optimization dashboard now includes the current UTC day
- **The expired-miss stat answers a real question.** It now measures expired misses as a share of all measured turns instead of only return visits, which is the number you need to decide whether background cache warming is worth paying for. Tab names got shorter too: "Overall" and "Auto-Router"
- **1-click presets work with wildcard models.** If your models are configured as wildcards (`anthropic/*`, `openai/*`), the family templates showed up greyed out claiming your models were missing. They were not missing; the template check and the tier dropdown were reading two different lists

## Try it

:::info

Questions, or numbers from your own traffic? Post them on [discussion #32172](https://github.com/BerriAI/litellm/discussions/32172). To work on this with us directly, [apply to be a design partner](https://calendar.app.google/i2e7qVEJphHi5S8UA).

:::

Full setup on the [Auto Routing docs page](/docs/proxy/auto_routing), and savings land on the cost optimization dashboard in your LiteLLM UI.
