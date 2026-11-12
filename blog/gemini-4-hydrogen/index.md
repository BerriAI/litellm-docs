---
slug: gemini-4-hydrogen
title: "Gemini 4 Hydrogen API Pricing and Day 0 Support on LiteLLM"
date: 2026-11-12T10:00:00
authors:
  - misbah
  - mateo
  - kerry
description: "Gemini 4 Hydrogen costs $1.50 per 1M input tokens and $7.50 per 1M output tokens, flat across its 1M context window. LiteLLM supports it on day 0 on AI Studio and Google Cloud."
card_title: "Gemini 4 Hydrogen"
card_summary: "Google's fast agentic model, ahead of Argon on the AA Intelligence Index at $1.50 / $7.50 per 1M tokens."
image: ./hero.png
tags: [gemini, gemini 4, gemini-4-hydrogen, pricing, day 0 support]
hide_table_of_contents: false
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import GeminiHydrogenHero from './Hero';

export const Hero = GeminiHydrogenHero;

LiteLLM now supports [Gemini 4 Hydrogen](https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-gemini-4-hydrogen/) on Day 0. Google built Hydrogen as the fast, everyday model for coding and agentic workflows, and it scores 51 on the Artificial Analysis Intelligence Index against Gemini 4 Argon's 50. Use it on Google AI Studio and Gemini Enterprise Agent Platform (formerly Vertex AI) through the LiteLLM AI Gateway, with spend, rate limits and logs in one place.

{/* truncate */}

## Gemini 4 Hydrogen pricing

Prices per 1M tokens, the same across the full 1M-token context window:

- **Input:** $1.50 / MTok
- **Output:** $7.50 / MTok. Thinking tokens bill as output.
- **Cache read:** $0.075 / MTok. Hydrogen supports implicit caching only.
- **Batch and Flex:** $0.75 input and $3.75 output
- **Priority:** $2.70 input and $13.50 output

Gemini 4 Argon and Gemini 4 Carbon cost $2.00 / $10.00 until November 30 and $4.00 / $20.00 from December 1, so Hydrogen is the lowest-priced Gemini 4 model. On Gemini Enterprise Agent Platform, regional endpoints cost 10% more than `global`.

Details on pricing: https://models.litellm.ai/models/gemini-4-hydrogen

## Use Gemini 4 Hydrogen with LiteLLM

No upgrade needed: open **Price Data** under **Models + Endpoints** in the UI and click **Reload Price Data** (or `POST /reload/model_cost_map`), on `v1.76.0` and above.

<Tabs>
<TabItem value="ai-studio" label="Google AI Studio">

**1. Setup config.yaml**

```yaml
model_list:
  - model_name: gemini-4-hydrogen
    litellm_params:
      model: gemini/gemini-4-hydrogen
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
  - model_name: gemini-4-hydrogen
    litellm_params:
      model: vertex_ai/gemini-4-hydrogen
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
  "model": "gemini-4-hydrogen",
  "messages": [
    {
      "role": "user",
      "content": "what llm are you"
    }
  ],
  "reasoning_effort": "medium"
}'
```

LiteLLM sends `reasoning_effort` to Hydrogen as its `thinking_level`.

## FAQ

### How much does Gemini 4 Hydrogen cost?

$1.50 per 1M input tokens and $7.50 per 1M output tokens, with no surcharge for long prompts. Batch and Flex halve both prices.

### Is Gemini 4 Hydrogen cheaper than Gemini 4 Argon?

Yes. Hydrogen costs $1.50 / $7.50 per 1M tokens. Argon and Carbon cost $2.00 / $10.00 until November 30 and $4.00 / $20.00 from December 1.

### Is Gemini 4 Hydrogen free on Google AI Studio?

Yes. Google AI Studio lists a free tier for Hydrogen on the Standard tab. Google Search grounding is paid tier only.

### What is the context window of Gemini 4 Hydrogen?

1,048,576 tokens for input, thinking and output together. Google returns up to 65,536 output tokens per synchronous request, and LiteLLM [continues past that cap](../gemini-4-argon/index.md#long-outputs) the same way it does for Argon.

### Which thinking levels does Gemini 4 Hydrogen support?

`low`, `medium`, `high` and `xhigh`, with `high` as the default. Set `low`, `medium` or `high` with `reasoning_effort`. Support for `xhigh` through `reasoning_effort` is tracked in [PR #47086](https://github.com/BerriAI/litellm/pull/47086).

### How do I switch from Gemini 3.8 Flash to Gemini 4 Hydrogen?

Change `gemini/gemini-3.8-flash` to `gemini/gemini-4-hydrogen` in your config. Google says Hydrogen finishes tasks 2.5x faster than 3.8 Flash.

### Does Gemini 4 Hydrogen support context caching?

Implicit caching only, from 4,096 prompt tokens. Explicit caching is not supported.

### Is Google Search grounding free on Gemini 4 Hydrogen?

The first 5,000 queries a month are free, shared with Gemini 3 and newer models, then $14 per 1,000 queries. Grounding with Google Maps has the same allowance and price.

### How do I call Gemini 4 Hydrogen with an OpenAI-compatible API?

Add `gemini/gemini-4-hydrogen` to your LiteLLM config. Then send a standard `/chat/completions` request to the proxy with `"model": "gemini-4-hydrogen"`.

## Feedback

Questions and feedback go in [GitHub discussion #51436](https://github.com/BerriAI/litellm/discussions/51436).

## References

- LiteLLM model page for Gemini 4 Hydrogen, with prices on every provider: [models.litellm.ai/models/gemini-4-hydrogen](https://models.litellm.ai/models/gemini-4-hydrogen)
- LiteLLM pricing for `gemini/gemini-4-hydrogen`: [PR #51423](https://github.com/BerriAI/litellm/pull/51423)
- LiteLLM pricing for `vertex_ai/gemini-4-hydrogen`: [PR #51432](https://github.com/BerriAI/litellm/pull/51432)
- Google: [Gemini 4 Hydrogen announcement](https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-gemini-4-hydrogen/), [model page](https://aistudio.google.com/docs/models/gemini-4-hydrogen), [what's new](https://aistudio.google.com/docs/whats-new-gemini-4-hydrogen) and [pricing](https://aistudio.google.com/docs/pricing)
