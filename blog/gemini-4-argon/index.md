---
slug: gemini-4-argon
title: "Gemini 4 Argon API Pricing and Day 0 Support on LiteLLM"
date: 2026-10-13T10:00:00
authors:
  - misbah
  - mateo
  - kerry
description: "Gemini 4 Argon costs $2.00 per 1M input tokens and $10.00 per 1M output tokens until Nov 30. LiteLLM supports it on day 0 on AI Studio and Google Cloud."
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
- **1M-token context window** for input and output together, with up to 65,536 output tokens for each request
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
  ghcr.io/berriai/litellm:v1.105.0 \
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
  ghcr.io/berriai/litellm:v1.105.0 \
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

## FAQ

### How much does Gemini 4 Argon cost?

Until November 30, 2026, it costs $2.00 per 1M input tokens and $10.00 per 1M output tokens. On December 1, the prices change to $4.00 and $20.00. Cache reads cost $0.10 per 1M tokens until then.

### What is the context window of Gemini 4 Argon?

1,048,576 tokens for input and output together. One request returns up to 65,536 output tokens by default.

### How do I call Gemini 4 Argon with an OpenAI-compatible API?

Add `gemini/gemini-4-argon` to your LiteLLM config. Then send a standard `/chat/completions` request to the proxy with `"model": "gemini-4-argon"`.

## Feedback

Questions and feedback go in [GitHub discussion #46238](https://github.com/BerriAI/litellm/discussions/46238).

## References

- LiteLLM pricing for `gemini/gemini-4-argon`: [PR #46227](https://github.com/BerriAI/litellm/pull/46227)
- Google: [Gemini 4 Argon announcement](https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-gemini-4-argon/), [model page](https://ai.google.dev/gemini-api/docs/models/gemini-4-argon) and [pricing](https://ai.google.dev/gemini-api/docs/pricing)
