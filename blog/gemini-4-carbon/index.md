---
slug: gemini-4-carbon
title: "Gemini 4 Carbon API Pricing and Day 0 Support on LiteLLM"
date: 2026-11-10T10:00:00
authors:
  - misbah
  - mateo
  - kerry
description: "Gemini 4 Carbon costs $2.00 per 1M input tokens and $10.00 per 1M output tokens until Nov 30, the same as Gemini 4 Argon. LiteLLM supports it on day 0 on AI Studio and Google Cloud."
card_title: "Gemini 4 Carbon"
card_summary: "Google's strongest reasoning model, at Argon's $2 / $10 per 1M tokens until Nov 30. 1M context, thinking levels."
image: ./hero.png
tags: [gemini, gemini 4, gemini-4-carbon, pricing, day 0 support]
hide_table_of_contents: false
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import GeminiCarbonHero from './Hero';

export const Hero = GeminiCarbonHero;

LiteLLM now supports [Gemini 4 Carbon](https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-gemini-4-carbon/) on Day 0. Use it on Google AI Studio and Gemini Enterprise Agent Platform (formerly Vertex AI) through the LiteLLM AI Gateway, with spend, rate limits and logs in one place.

{/* truncate */}

## Gemini 4 Carbon pricing

Launch prices per 1M tokens, until November 30, 2026:

- **Input:** $2.00 / MTok
- **Output:** $10.00 / MTok. Thinking tokens bill as output.
- **Cache read:** $0.10 / MTok. Carbon supports implicit caching only.
- **Batch and Flex:** $1.00 input and $5.00 output
- **Priority:** $3.60 input and $18.00 output

On December 1, 2026, these prices double to $4.00 input, $20.00 output and $0.20 cache read. On Gemini Enterprise Agent Platform, regional endpoints cost 10% more than `global`.

Prices on every provider: https://models.litellm.ai/models/gemini-4-carbon

## Use Gemini 4 Carbon with LiteLLM

No upgrade needed: open **Price Data** under **Models + Endpoints** in the UI and click **Reload Price Data** (or `POST /reload/model_cost_map`), on `v1.76.0` and above.

<Tabs>
<TabItem value="ai-studio" label="Google AI Studio">

**1. Setup config.yaml**

```yaml
model_list:
  - model_name: gemini-4-carbon
    litellm_params:
      model: gemini/gemini-4-carbon
      api_key: os.environ/GEMINI_API_KEY
```

**2. Start the proxy**

```bash
docker run -d \
  -p 4000:4000 \
  -e GEMINI_API_KEY=$GEMINI_API_KEY \
  -v $(pwd)/config.yaml:/app/config.yaml \
  ghcr.io/berriai/litellm:v1.106.2 \
  --config /app/config.yaml
```

</TabItem>
<TabItem value="gemini-enterprise" label="Gemini Enterprise Agent Platform">

**1. Setup config.yaml**

```yaml
model_list:
  - model_name: gemini-4-carbon
    litellm_params:
      model: vertex_ai/gemini-4-carbon
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
  ghcr.io/berriai/litellm:v1.106.2 \
  --config /app/config.yaml
```

</TabItem>
</Tabs>

**3. Test it!**

```bash
curl --location 'http://0.0.0.0:4000/chat/completions' \
--header 'Content-Type: application/json' \
--header "Authorization: Bearer $LITELLM_KEY" \
--data '{
  "model": "gemini-4-carbon",
  "messages": [
    {
      "role": "user",
      "content": "what llm are you"
    }
  ],
  "reasoning_effort": "low"
}'
```

LiteLLM sends `reasoning_effort` to Carbon as its `thinking_level`.

## FAQ

### How much does Gemini 4 Carbon cost?

Until November 30, 2026, it costs $2.00 per 1M input tokens and $10.00 per 1M output tokens, the same as Gemini 4 Argon. On December 1, the prices change to $4.00 and $20.00.

### Is Gemini 4 Carbon priced the same as Gemini 4 Argon?

Yes. Both cost $2.00 / $10.00 per 1M tokens until November 30 and $4.00 / $20.00 from December 1.

### What is the context window of Gemini 4 Carbon?

1,048,576 tokens for input, thinking and output together. Google returns up to 65,536 output tokens per synchronous request, and LiteLLM [continues past that cap](../gemini-4-argon/index.md#long-outputs) the same way it does for Argon.

### Which thinking levels does Gemini 4 Carbon support?

`low`, `medium` and `high`, with `medium` as the default. Set it with `reasoning_effort`.

### Does Gemini 4 Carbon support context caching?

Implicit caching only, from 4,096 prompt tokens. Explicit caching is not supported.

### Is Google Search grounding free on Gemini 4 Carbon?

The first 5,000 queries a month are free, shared with Gemini 3 and newer models, then $14 per 1,000 queries. LiteLLM tracks the shared allowance as of [PR #50951](https://github.com/BerriAI/litellm/pull/50951).

### How do I call Gemini 4 Carbon with an OpenAI-compatible API?

Add `gemini/gemini-4-carbon` to your LiteLLM config. Then send a standard `/chat/completions` request to the proxy with `"model": "gemini-4-carbon"`.

## Feedback

Questions and feedback go in [GitHub discussion #50970](https://github.com/BerriAI/litellm/discussions/50970).

## References

- LiteLLM model page for Gemini 4 Carbon, with prices on every provider: [models.litellm.ai/models/gemini-4-carbon](https://models.litellm.ai/models/gemini-4-carbon)
- LiteLLM pricing for `gemini/gemini-4-carbon`: [PR #50931](https://github.com/BerriAI/litellm/pull/50931)
- LiteLLM pricing for `vertex_ai/gemini-4-carbon`: [PR #50942](https://github.com/BerriAI/litellm/pull/50942)
- Google: [Gemini 4 Carbon announcement](https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-gemini-4-carbon/), [model page](https://aistudio.google.com/docs/models/gemini-4-carbon), [what's new](https://aistudio.google.com/docs/whats-new-gemini-4-carbon) and [pricing](https://aistudio.google.com/docs/pricing)
