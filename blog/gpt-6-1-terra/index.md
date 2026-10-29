---
slug: gpt-6-1-terra
title: "GPT-6.1 Terra API Pricing and Day 0 Support on LiteLLM"
date: 2026-10-26T12:00:00
authors:
  - misbah
  - mateo
  - kerry
description: "GPT-6.1 Terra costs $1 per 1M input tokens and $5 per 1M output tokens, half the price of GPT-6.1 Sol. LiteLLM supports it on day 0."
card_title: "GPT-6.1 Terra"
card_summary: "Half the price of GPT-6.1 Sol at $1 / $5 per 1M tokens, 50.3% on Terminal-Bench 4.0, 1.05M context."
image: ./hero.png
tags: [openai, gpt-6.1, gpt-6.1-terra, pricing, day 0 support]
hide_table_of_contents: false
---

import Head from '@docusaurus/Head';
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import GptTerraHero from './Hero';

<Head>
  <meta property="og:video" content="https://docs.litellm.ai/img/blog/gpt-6-1-terra/hero.mp4" />
  <meta property="og:video:secure_url" content="https://docs.litellm.ai/img/blog/gpt-6-1-terra/hero.mp4" />
  <meta property="og:video:type" content="video/mp4" />
  <meta property="og:video:width" content="1280" />
  <meta property="og:video:height" content="720" />
</Head>

export const Hero = GptTerraHero;

LiteLLM now supports [GPT-6.1 Terra](https://openai.com/index/introducing-gpt-6-1-terra/) on Day 0. Use it through the LiteLLM AI Gateway with the same config as every other OpenAI model. Spend, rate limits and logs are in one place.

{/* truncate */}

## GPT-6.1 Terra pricing

- **Input:** $1.00 / MTok, or $2.00 / MTok above 272K input tokens
- **Output:** $5.00 / MTok, or $7.50 / MTok above 272K input tokens
- **Cache read:** $0.05 / MTok, or $0.10 / MTok above 272K input tokens
- **Batch and Flex:** 50% off. Fast mode costs 2x.

Per OpenAI, these prices are 50% lower than the prices of GPT-5.6 Terra and GPT-6.1 Sol.

| Model | Input / MTok | Output / MTok |
|---|---|---|
| **GPT-6.1 Terra** | **$1.00** | **$5.00** |
| GPT-6.1 Sol | $2.00 | $10.00 |
| GPT-5.6 Terra | $2.00 | $12.00 |

Prices on every provider: https://models.litellm.ai/models

## What's new in GPT-6.1 Terra

- **50.3% on Terminal-Bench 4.0** at max effort, more than double GPT-5.6 Terra's 21.5%, per OpenAI
- **Fewer factual errors:** on OpenAI's error-inducing prompts at low effort, the error rate fell from 53.6% to 16.7%
- **Reasoning effort from `none` to `max`**, with `medium` as the default
- **1.05M-token context window** (922K input) and up to 128K output tokens

## Use GPT-6.1 Terra with LiteLLM

No upgrade needed: open **Price Data** under **Models + Endpoints** in the UI and click **Reload Price Data** (or `POST /reload/model_cost_map`), on `v1.76.0` and above.

<Tabs>
<TabItem value="proxy" label="LiteLLM Proxy">

**1. Setup config.yaml**

```yaml
model_list:
  - model_name: gpt-6.1-terra
    litellm_params:
      model: openai/gpt-6.1-terra
      api_key: os.environ/OPENAI_API_KEY
```

**2. Start the proxy**

```bash
docker run -d \
  -p 4000:4000 \
  -e OPENAI_API_KEY=$OPENAI_API_KEY \
  -v $(pwd)/config.yaml:/app/config.yaml \
  ghcr.io/berriai/litellm:v1.106.2 \
  --config /app/config.yaml
```

**3. Test it**

```bash
curl -X POST "http://0.0.0.0:4000/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_KEY" \
  -d '{
    "model": "gpt-6.1-terra",
    "messages": [
      {"role": "user", "content": "Read this invoice and list the line items."}
    ],
    "reasoning_effort": "low"
  }'
```

</TabItem>
<TabItem value="sdk" label="LiteLLM Python SDK">

```python
from litellm import completion

response = completion(
    model="openai/gpt-6.1-terra",
    messages=[
        {"role": "user", "content": "Read this invoice and list the line items."}
    ],
    reasoning_effort="low",
)

print(response.choices[0].message.content)
```

</TabItem>
</Tabs>

OpenAI serves tool calling for this model through the Responses API. When reasoning is on, LiteLLM sends a `/chat/completions` request with tools to `/v1/responses` for you.

## FAQ

### How much does GPT-6.1 Terra cost?

$1.00 per 1M input tokens and $5.00 per 1M output tokens. Cache reads cost $0.05 per 1M tokens. Above 272K input tokens, the prices are $2.00, $7.50 and $0.10.

### What is the context window of GPT-6.1 Terra?

1,050,000 tokens, with up to 922,000 input tokens and 128,000 output tokens.

### How do I call GPT-6.1 Terra with an OpenAI-compatible API?

Add `openai/gpt-6.1-terra` to your LiteLLM config. Then send a standard `/chat/completions` request to the proxy with `"model": "gpt-6.1-terra"`.

## Feedback

Questions and feedback go in [GitHub discussion #48443](https://github.com/BerriAI/litellm/discussions/48443).

## References

- LiteLLM pricing for `gpt-6.1-terra`: [PR #48429](https://github.com/BerriAI/litellm/pull/48429)
