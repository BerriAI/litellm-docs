---
slug: gpt-6-2-astra-sol
title: "GPT-6.2 Astra and GPT-6.2 Sol API Pricing and Day 0 Support on LiteLLM"
date: 2026-11-17T10:00:00
authors:
  - misbah
  - mateo
  - kerry
description: "GPT-6.2 Astra costs $8 per 1M input tokens and $40 per 1M output tokens, 20% below GPT-6 Astra. GPT-6.2 Sol stays at $2 / $10. LiteLLM supports both on day 0."
card_title: "GPT-6.2 Astra and Sol"
card_summary: "Astra drops to $8 / $40 per 1M tokens and Sol stays at $2 / $10, with a 1.05M context window on both."
image: ./hero.png
tags: [openai, gpt-6.2, gpt-6.2-astra, gpt-6.2-sol, pricing, day 0 support]
hide_table_of_contents: false
---

import Head from '@docusaurus/Head';
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import GptAstraSolHero from './Hero';

<Head>
  <meta property="og:video" content="https://docs.litellm.ai/img/blog/gpt-6-2-astra-sol/hero.mp4" />
  <meta property="og:video:secure_url" content="https://docs.litellm.ai/img/blog/gpt-6-2-astra-sol/hero.mp4" />
  <meta property="og:video:type" content="video/mp4" />
  <meta property="og:video:width" content="1280" />
  <meta property="og:video:height" content="720" />
</Head>

export const Hero = GptAstraSolHero;

LiteLLM now supports [GPT-6.2 Astra and GPT-6.2 Sol](https://openai.com/index/introducing-gpt-6-2-astra-sol/) on Day 0. OpenAI cut Astra's price by 20% and reports it scores 5.2 points above GPT-6 Astra on Agents' Last Exam. Sol keeps its price and comes within 0.5 points of Astra on FrontierCode 2.0. Use both through the LiteLLM AI Gateway with the same config as every other OpenAI model, with spend, rate limits and logs in one place.

{/* truncate */}

## GPT-6.2 Astra and GPT-6.2 Sol pricing

Prices per 1M tokens for GPT-6.2 Astra:

- **Input:** $8.00 / MTok, or $16.00 / MTok above 272K input tokens
- **Output:** $40.00 / MTok, or $60.00 / MTok above 272K input tokens
- **Cache read:** $0.40 / MTok, or $0.80 / MTok above 272K input tokens
- **Cache write:** $10.00 / MTok for 30 minutes and $20.00 / MTok for 12 hours

Prices per 1M tokens for GPT-6.2 Sol:

- **Input:** $2.00 / MTok, or $4.00 / MTok above 272K input tokens
- **Output:** $10.00 / MTok, or $15.00 / MTok above 272K input tokens
- **Cache read:** $0.10 / MTok, or $0.20 / MTok above 272K input tokens
- **Cache write:** $2.50 / MTok for 30 minutes and $5.00 / MTok for 12 hours

On both models, Batch is 50% off and Fast mode costs 2x. GPT-6.2 Astra input and output are 20% cheaper than GPT-6 Astra and cached input is 60% cheaper. Sol has the same price as GPT-6.1 Sol.

Details on pricing: https://models.litellm.ai/models/gpt-6.2-astra and https://models.litellm.ai/models/gpt-6.2-sol

## Use GPT-6.2 Astra and GPT-6.2 Sol with LiteLLM

No upgrade needed: open **Price Data** under **Models + Endpoints** in the UI and click **Reload Price Data** (or `POST /reload/model_cost_map`), on `v1.76.0` and above.

<Tabs>
<TabItem value="proxy" label="LiteLLM Proxy">

**1. Setup config.yaml**

```yaml
model_list:
  - model_name: gpt-6.2-astra
    litellm_params:
      model: openai/gpt-6.2-astra
      api_key: os.environ/OPENAI_API_KEY
  - model_name: gpt-6.2-sol
    litellm_params:
      model: openai/gpt-6.2-sol
      api_key: os.environ/OPENAI_API_KEY
```

**2. Start the proxy**

```bash
docker run -d \
  -p 4000:4000 \
  -e OPENAI_API_KEY=$OPENAI_API_KEY \
  -v $(pwd)/config.yaml:/app/config.yaml \
  ghcr.io/berriai/litellm:v1.109.1 \
  --config /app/config.yaml
```

**3. Test it**

```bash
curl -X POST "http://0.0.0.0:4000/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_KEY" \
  -d '{
    "model": "gpt-6.2-astra",
    "messages": [
      {"role": "user", "content": "Plan the migration of this service to a new database."}
    ],
    "reasoning_effort": "medium"
  }'
```

</TabItem>
<TabItem value="sdk" label="LiteLLM Python SDK">

```python
from litellm import completion

response = completion(
    model="openai/gpt-6.2-sol",
    messages=[
        {"role": "user", "content": "Plan the migration of this service to a new database."}
    ],
    reasoning_effort="medium",
)

print(response.choices[0].message.content)
```

</TabItem>
</Tabs>

OpenAI serves tool calling for these models through the Responses API. LiteLLM sends a `/chat/completions` request with tools to `/v1/responses` for you.

## FAQ

### How much does GPT-6.2 Astra cost?

$8.00 per 1M input tokens and $40.00 per 1M output tokens. Cache reads cost $0.40 per 1M tokens. Above 272K input tokens, the prices are $16.00, $60.00 and $0.80.

### How much does GPT-6.2 Sol cost?

$2.00 per 1M input tokens and $10.00 per 1M output tokens, the same as GPT-6.1 Sol. Cache reads cost $0.10 per 1M tokens.

### Is GPT-6.2 Astra cheaper than GPT-6 Astra?

Yes. GPT-6 Astra costs $10 / $50 per 1M tokens and GPT-6.2 Astra costs $8 / $40. Cached input drops by 60%.

### Should I use GPT-6.2 Astra or GPT-6.2 Sol?

OpenAI reports Sol comes within 0.5 points of Astra on FrontierCode 2.0 at about a fifth of the cost. Astra leads on long agent tasks, with a 5.2 point gain over GPT-6 Astra on Agents' Last Exam. Put both in your config and route by task.

### What is the context window of GPT-6.2 Astra and GPT-6.2 Sol?

1,050,000 tokens on both, with up to 922,000 input tokens and 128,000 output tokens.

### Which reasoning effort values do the GPT-6.2 models accept?

OpenAI rejects `none` and `minimal` on GPT-6.2 Astra and GPT-6.2 Sol and suggests starting at `medium`. `temperature`, `top_p` and `logprobs` are also not supported.

### How do I call GPT-6.2 Astra with an OpenAI-compatible API?

Add `openai/gpt-6.2-astra` to your LiteLLM config. Then send a standard `/chat/completions` request to the proxy with `"model": "gpt-6.2-astra"`.

## Feedback

Questions and feedback go in [GitHub discussion #52347](https://github.com/BerriAI/litellm/discussions/52347).

## References

- LiteLLM pricing for `openai/gpt-6.2-astra` and `openai/gpt-6.2-sol`: [PR #52316](https://github.com/BerriAI/litellm/pull/52316)
- LiteLLM pricing for `azure/gpt-6.2-astra` and `azure/gpt-6.2-sol`: [PR #52293](https://github.com/BerriAI/litellm/pull/52293)
- OpenAI: [GPT-6.2 Astra and GPT-6.2 Sol announcement](https://openai.com/index/introducing-gpt-6-2-astra-sol/)
