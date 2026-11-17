---
slug: gemini-4-argon
title: "Gemini 4 Argon API Pricing and Day 0 Support on LiteLLM"
date: 2026-10-13T10:00:00
authors:
  - misbah
  - mateo
  - kerry
description: "Gemini 4 Argon costs $2.00 per 1M input tokens and $10.00 per 1M output tokens until Nov 30. LiteLLM supports it on day 0 on AI Studio and Google Cloud."
card_title: "Gemini 4 Argon"
card_summary: "Google's new flagship: 77.9% on DeepSWE v1.1, 1M context, thinking levels, $2 / $10 per 1M tokens until Nov 30."
image: ./hero.png
tags: [gemini, gemini 4, gemini-4-argon, pricing, day 0 support]
hide_table_of_contents: false
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import GeminiArgonHero from './Hero';

export const Hero = GeminiArgonHero;

LiteLLM now supports [Gemini 4 Argon](https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-gemini-4-argon/) on Day 0. Use it on Google AI Studio and Gemini Enterprise Agent Platform (formerly Vertex AI) through the LiteLLM AI Gateway. Spend, rate limits and logs are in one place.

{/* truncate */}

## Gemini 4 Argon pricing

Launch prices on Google AI Studio, per 1M tokens, until November 30, 2026:

- **Input:** $2.00 / MTok
- **Output:** $10.00 / MTok. Thinking tokens bill as output.
- **Cache read:** $0.10 / MTok. Argon supports implicit caching only.
- **Batch and Flex:** 50% off input and output

On December 1, 2026, these prices double to $4.00 input, $20.00 output and $0.20 cache read.

Prices on every provider: https://models.litellm.ai/models

## What's new in Gemini 4 Argon

- **77.9% on DeepSWE v1.1**, per Google
- **1M-token context window** for input and output together. Google caps each request at 32,768 output tokens (65,536 when streaming), and LiteLLM continues past that cap for you
- **Thinking levels low, medium and high.** Argon does not support `thinking_budget`.

## Use Gemini 4 Argon with LiteLLM

No upgrade needed: open **Price Data** under **Models + Endpoints** in the UI and click **Reload Price Data** (or `POST /reload/model_cost_map`), on `v1.76.0` and above.

<Tabs>
<TabItem value="ai-studio" label="Google AI Studio">

**1. Setup config.yaml**

```yaml
model_list:
  - model_name: gemini-4-argon
    litellm_params:
      model: gemini/gemini-4-argon
      api_key: os.environ/GEMINI_API_KEY
```

**2. Start the proxy**

```bash
docker run -d \
  -p 4000:4000 \
  -e GEMINI_API_KEY=$GEMINI_API_KEY \
  -v $(pwd)/config.yaml:/app/config.yaml \
  ghcr.io/berriai/litellm:v1.107.0-dev.3 \
  --config /app/config.yaml
```

</TabItem>
<TabItem value="gemini-enterprise" label="Gemini Enterprise Agent Platform">

**1. Setup config.yaml**

```yaml
model_list:
  - model_name: gemini-4-argon
    litellm_params:
      model: vertex_ai/gemini-4-argon
      vertex_project: os.environ/VERTEX_PROJECT
      vertex_location: global
```

**2. Start the proxy**

```bash
docker run -d \
  -p 4000:4000 \
  -e VERTEX_PROJECT=$VERTEX_PROJECT \
  -e GOOGLE_APPLICATION_CREDENTIALS=/app/credentials.json \
  -v $(pwd)/config.yaml:/app/config.yaml \
  -v $(pwd)/credentials.json:/app/credentials.json \
  ghcr.io/berriai/litellm:v1.107.0-dev.3 \
  --config /app/config.yaml
```

</TabItem>
</Tabs>

**3. Test it!**

```bash
curl --location 'http://0.0.0.0:4000/chat/completions' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer $LITELLM_KEY' \
--data '{
  "model": "gemini-4-argon",
  "messages": [
    {
      "role": "user",
      "content": "what llm are you"
    }
  ],
  "reasoning_effort": "high"
}'
```

LiteLLM sends `reasoning_effort` to Argon as its `thinking_level`.

## Long outputs

From `v1.107.0-dev.3`, set `max_tokens` above Google's per-request cap and LiteLLM keeps going. When Google ends a request with a `continuationToken`, LiteLLM sends the request again with that token until the answer finishes or `max_tokens` is spent. This works for unary and streaming calls on `/chat/completions`, `/v1/messages` and `/v1/responses`, on Google AI Studio and Gemini Enterprise Agent Platform. A request with `n` above 1 is sent once, and so is a request whose `max_tokens` is not an integer, or one with no `max_tokens` while `LITELLM_GEMINI_DEFAULT_MAX_OUTPUT_TOKENS` is unset.

- **Requests with no `max_tokens`:** from `v1.108.0`, set the env var `LITELLM_GEMINI_DEFAULT_MAX_OUTPUT_TOKENS` to an integer, and a Gemini chat completion, text completion or Responses API request that sends no output limit gets that budget, through the proxy or the Python SDK. `/v1/messages` requires `max_tokens`, so the env var never applies there. LiteLLM caps the budget at the model's `max_output_tokens` in the cost map, or at a deployment's own `model_info.max_output_tokens` when that is lower, since Gemini Enterprise Agent Platform answers 400 above a model's range. It gives no default to a model missing from the cost map or listed there as anything besides a chat model, such as an image model, to a chat model whose cost map entry leaves text out of `supported_output_modalities`, such as a Lyria music model, to a request whose `modalities` asks for anything besides text, to a request whose `extra_body` field holds a snake_case `generation_config`, to a request that resumes with a `continuation_token`, to Google's native `/v1beta/models/{model}:generateContent` route on a `gemini/` or `vertex_ai/` model or to Gemini Enterprise Agent Platform batch jobs. Any output limit the request already carries wins, such as its own `max_tokens`, `max_completion_tokens` or `max_output_tokens`, or a deployment's `litellm_params.max_tokens`. Zero, a negative number or a value that is not an integer counts as unset. On a model that returns no `continuationToken`, the budget is a plain output limit.
- **Choosing the budget:** it also caps answers that fit in one request, so a value below the model's own per-request limit (32,768 on Gemini 4 Argon, or 65,536 when streaming) cuts them off sooner. Thinking tokens count against it too, so on a thinking model a low value can leave little or no room for the answer. It bounds output tokens, not cost, since each request to Google sends the prompt and the answer so far again and bills them as prompt tokens. A client that never set `max_tokens` now waits for the whole answer. With a large value, a non-streamed request can run past the client's own timeout (600 seconds in the OpenAI SDK), and the SDK then retries while LiteLLM keeps running and billing the request it gave up on, so stream long answers or give the client the room the **Timeouts** bullet describes.
- **Usage** is summed across the requests, so cost and spend match Google's bill. The first request's prompt count is kept as `usage.prompt_tokens_details.initial_prompt_tokens` on an answer that took more than one request.
- **A cut-off answer** on `/chat/completions` ends with `finish_reason: "length"` and returns `provider_specific_fields.continuation_token`. Send the request again with that `"continuation_token"` and a higher `max_tokens` to continue it, since Google counts `max_tokens` across the whole answer.
- **A dropped stream** ends with the error. LiteLLM does not yet pick it back up from Google's mid-stream resume tokens.
- **Timeouts:** each request to Google runs under the deployment's `timeout`, 600 seconds when unset. A non-streamed request at the 32,768 cap takes about 10 minutes, so set `timeout: 1200` on deployments that serve long answers and give your client room for the whole answer.

## FAQ

### How much does Gemini 4 Argon cost?

Until November 30, 2026, it costs $2.00 per 1M input tokens and $10.00 per 1M output tokens. On December 1, the prices change to $4.00 and $20.00. Cache reads cost $0.10 per 1M tokens until then.

### What is the context window of Gemini 4 Argon?

1,048,576 tokens for input and output together. Google returns up to 32,768 output tokens per request (65,536 when streaming), and from `v1.107.0-dev.3` LiteLLM continues across requests until `max_tokens` is spent.

### How do I call Gemini 4 Argon with an OpenAI-compatible API?

Add `gemini/gemini-4-argon` to your LiteLLM config. Then send a standard `/chat/completions` request to the proxy with `"model": "gemini-4-argon"`.

## Feedback

Questions and feedback go in [GitHub discussion #46238](https://github.com/BerriAI/litellm/discussions/46238).

## References

- LiteLLM pricing for `gemini/gemini-4-argon`: [PR #46227](https://github.com/BerriAI/litellm/pull/46227)
- LiteLLM long outputs for Gemini 4: [PR #46240](https://github.com/BerriAI/litellm/pull/46240)
- LiteLLM default output budget for Gemini: [PR #47542](https://github.com/BerriAI/litellm/pull/47542)
- Google: [Gemini 4 Argon announcement](https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-gemini-4-argon/), [model page](https://ai.google.dev/gemini-api/docs/models/gemini-4-argon) and [pricing](https://ai.google.dev/gemini-api/docs/pricing)
