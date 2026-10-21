---
title: "/v1/decisions and /v1/systemone"
sidebar_label: "Overview"
---

# /v1/decisions and /v1/systemone

Decision models answer typed questions about an input and return probabilities instead of text: a yes/no probability, a pick from a fixed list, a score on a scale, or on TypeSafe Jev 1.14 a box around something in an image. LiteLLM serves them on two routes that share one provider list, so any decision model in your `model_list` works on either route

| Route | Alias | Request format | Use it when |
|-------|-------|----------------|-------------|
| [`POST /v1/decisions`](./openai_format.md) | `/decisions` | OpenAI Decisions: `input` plus a list of `predicate`, `choice`, `score` and `box` questions | You write against OpenAI's format |
| [`POST /v1/systemone`](./systemone_format.md) | `/systemone` | [System One](https://docs.typesafe.ai/api): `state` plus a map of `noul`, `choice`, `score` and `box` questions | You already have TypeSafe Jev request bodies |

The [Python SDK](./sdk.md) calls the same models without the proxy, [TypeSafe images and box questions](./typesafe_images.md) covers TypeSafe's opt-in headers, [the Admin UI](./admin_ui.md) adds decision models and tests them in a playground, and [the benchmark](./benchmark.md) compares decision models on agent traces

Extraction models such as Cloudflare Clairic, which fill in typed fields like dates, numbers and lists instead of answering questions, are served on [/v1/extraction](../extraction.md).

## Use decision models with the LiteLLM proxy {#proxy-setup}

1. Add decision models to `config.yaml`

```yaml showLineNumbers keep-model-ids
model_list:
  - model_name: luna
    litellm_params:
      model: openai/gpt-6-luna
      api_key: os.environ/OPENAI_API_KEY
  - model_name: jev
    litellm_params:
      model: typesafe/jev-latest
      api_key: os.environ/TYPESAFE_API_KEY
```

2. Start the proxy

```bash showLineNumbers
litellm --config config.yaml

# RUNNING on http://0.0.0.0:4000
```

## Availability and supported features

Decision routes are available in LiteLLM `v1.104.2` and later, except the `v1.105.0` dev builds, `v1.105.0-rc.1` and `v1.105.0-rc.2`. Some providers and features need a newer release, listed below. A dev build or release candidate can still miss a provider or feature that its release has, such as vLLM, Microsoft Foundry and OpenRouter spend from `usage.cost` in `v1.105.0-rc.3` and the `v1.106.0` dev builds

| Provider or feature | Release |
|---------------------|---------|
| vLLM, Microsoft Foundry, OpenRouter spend from `usage.cost` | `v1.104.3` |
| Databricks serving endpoints, image input on Cloudflare Clef, TypeSafe images and box questions | `v1.106.0` |
| Databricks `ai_decide`, Fireworks AI, Laya and Bespoke Nimble, including the Add Model form | `v1.107.0-rc.1` |

| Feature | Supported | Notes |
|---------|-----------|-------|
| Cost tracking | Yes | Returned in the `x-litellm-response-cost` header and written to spend logs. Self-hosted vLLM models have no price, so vLLM calls return no cost header. Databricks OpenJev and `ai_decide` have a zero price in the cost map, so their calls record $0 even though Databricks still bills your workspace for them |
| Logging | Yes | Works across all integrations |
| Virtual keys, budgets, rate limits | Yes | Normal proxy key auth |
| Load balancing, fallbacks | Yes | Goes through the router like `/chat/completions` |
| Image input | OpenAI, Cloudflare Clef and TypeSafe | TypeSafe needs the `TypeSafe-Danger-Zone-Images: true` header. Other providers return a 400, or drop the images under `drop_params` |
| Streaming | No | |

## Limits

OpenAI requires `instructions` on every question and at least 2 choices or score levels. When a System One question without `instructions` goes to an OpenAI model, LiteLLM fills in a generic one such as "Which choice best fits the input?", and a noul question's `criteria` are folded into the instructions OpenAI sees. A choice with one label or a score with one level has no OpenAI equivalent, so LiteLLM rejects it with a 400 before OpenAI is called

A choice question cannot have both a boolean value and a string with the same text, such as `true` and `"true"`, because System One providers key choices by their text. LiteLLM rejects that request with a 400

vLLM takes at most 64 questions per request, 26 options per `choice` and 10 levels per `score`, as listed in the Limits section of its [Structured Decisions](https://github.com/vllm-project/vllm/blob/v0.32.0/docs/serving/online_serving/structured_decisions.md#limits) docs

## Use a decision model as a guardrail

The [Decision Model guardrail](../proxy/guardrails/decision_model.md) asks any [supported decision model](./providers.md) yes/no questions you write about each request or response, and blocks or logs the call when a probability reaches its threshold

## Decision routes vs pass-through routes

The [TypeSafe pass-through](../pass_through/typesafe.md) at `/typesafe/v1/systemone` forwards raw requests to TypeSafe only and reads the key from the proxy environment. The [OpenRouter pass-through](../providers/openrouter.md#through-the-openrouter-pass-through) at `/openrouter/alpha/decisions` forwards raw requests to OpenRouter only. `/v1/decisions` and `/v1/systemone` use the models in your `model_list`, so you can switch providers, load balance and set per-deployment keys without changing the request body
