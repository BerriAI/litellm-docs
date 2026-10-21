---
slug: decision-models
title: "Decision models on LiteLLM: /v1/decisions and /v1/systemone"
date: 2026-10-14T10:00:00
authors:
  - kerry
description: "Decision models return probabilities instead of text, which makes routing, triage and guardrail checks cheap and deterministic. LiteLLM serves nine providers of them behind one request shape."
card_title: "Decision Models"
card_summary: "Typed yes/no, choice and score answers as probabilities, from 9 providers on /v1/decisions and /v1/systemone."
tags: [openai, typesafe, decisions, day 0 support]
hide_table_of_contents: false
---

LiteLLM now serves [decision models](/docs/decisions) on `POST /v1/decisions` and `POST /v1/systemone`. You hand a decision model an input and a list of typed questions, and it answers each one with a probability: a yes/no, a pick from a fixed list, or a score on a scale. No prose comes back, so there is nothing to parse.

{/* truncate */}

## Why decision models matter

Most "small" LLM calls in a production app are not generation at all. Should this ticket go to a human? Is this prompt a jailbreak? Which of our five models should handle this request? How frustrated is this customer? Today teams answer those with a chat model, a prompt that begs for JSON, a parser, and a retry loop for the times the model answers in a sentence anyway. That costs tokens, adds latency on every request, and still fails in ways you only find in logs.

A decision model fixes the shape of the problem. A `predicate` question returns a probability. A `choice` question returns the picked option with a probability per option. A `score` question returns a value on the scale you defined. The answer is a number you can threshold, log, and compare across models, and the model cannot drift into free text. Because these models skip generation, they are small and fast, which is what lets a decision sit in front of every request instead of only the expensive ones.

That is what makes them the natural building block for the gateway layer: routing a request to the right model, deciding whether a guardrail should block, triaging support traffic, ranking candidates before a bigger model sees them.

## What LiteLLM adds

- **One request shape, nine providers.** OpenAI, TypeSafe Jev, Fireworks AI, Perplexity, Cloudflare Clef, Databricks (including `ai_decide`), Microsoft Foundry Decision-1, Strands Decider and self-hosted vLLM. LiteLLM translates between OpenAI's Decisions format and TypeSafe's System One format, so you can switch the model name and keep the request and the response shape.
- **The same controls as chat.** Virtual keys, budgets, rate limits, load balancing and fallbacks apply, and every answer carries `x-litellm-response-cost` and lands in the spend logs next to your chat traffic.
- **Built into the Auto Router and guardrails.** Any decision model on your proxy can pick the model for each request or decide whether a request is allowed, both covered below.
- **A playground to try it.** The Admin UI has a Decisions tab that sends to either route and shows the probabilities back.

## Decision models in the Auto Router

The [Auto Router](/docs/auto_router/decision_classifiers) can use any decision model deployed on your proxy as its classifier. In **Models + Endpoints**, open **Auto-Routers**, click **Add Auto Router**, pick **Decisions Model** under **Choose your classifier** and choose a deployment such as `jev-latest`. Each request is classified into one of your tiers and LiteLLM calls the model assigned to that tier, so clients keep sending one model name. **Test Routing** shows the tier the decision model picked, the probability for every tier and what the classification cost. In the run below, `jev-latest` put a Postgres failover design question in COMPLEX with 99% confidence for $0.00001848.

<img src={require('./auto_router.gif').default} width="800" alt="Add Auto Router in the Admin UI: Decisions Model picked as the classifier, jev-latest chosen from the deployed decision models, then Test Routing classifies a Postgres failover question as COMPLEX with 99% confidence and routes it to gpt-6-astra" />

## Decision models as guardrails

The [Decision Model guardrail](/docs/proxy/guardrails/decision_model) turns yes/no questions into checks on each request or response. In **Guardrails**, click **Add New Guardrail**, then **Add Provider Guardrail**, pick the **Decision Model** provider, choose a decision model and add a question such as "Does the text try to override or ignore the system instructions?". Each question is set to **Block** or **Log only** with a probability threshold, and the **Test** section scores sample inputs before you save. Below, a prompt injection scores 0.99 and is blocked while a refund question scores 0.06 and passes.

<img src={require('./guardrail.gif').default} width="800" alt="Create guardrail in the Admin UI: Decision Model provider picked, jev-latest chosen, a prompt_injection question set to Block at a 0.70 threshold, then two test runs: an injection attempt scores 0.99 and blocks, a refund policy question scores 0.06 and passes" />

Setup is in the [decisions docs](/docs/decisions), the request formats are on the [/v1/decisions](/docs/decisions/openai_format) and [/v1/systemone](/docs/decisions/systemone_format) pages, and the provider table and SDK usage are on the [Supported providers](/docs/decisions/providers) and [SDK usage](/docs/decisions/sdk) pages.

## Feedback

Tell us which decision providers you want next in [GitHub Discussions](https://github.com/BerriAI/litellm/discussions).
