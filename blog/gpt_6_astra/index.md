---
slug: gpt_6_astra
title: "Day 0 Support: GPT-6 Astra"
date: 2026-09-03T11:00:00
image: /img/litellm_gpt_6_astra_announcement.png
authors:
  - misbah
  - mateo
  - krrish
  - ishaan-alt
description: "Day 0 support for OpenAI's GPT-6 Astra on LiteLLM, with pricing, reasoning params, and the Responses API bridge."
tags: [openai, gpt-6, gpt-6-astra, completion, day 0 support]
hide_table_of_contents: false
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

![LiteLLM x GPT-6 Astra](/img/litellm_gpt_6_astra_announcement.png)

LiteLLM now supports `gpt-6-astra`, OpenAI's next major model. Route traffic to it through the LiteLLM AI Gateway with the same config you use for every other OpenAI model.

{/* truncate */}

Astra is the first model on the GPT-6 name, and OpenAI's own [research post](https://openai.com/index/ten-advances-in-mathematics-and-theoretical-computer-science/) previewed it producing machine-checked proofs for ten open problems in mathematics and theoretical computer science. It scores 98% on FrontierMath Tier 4, 99.9% on ARC-AGI 3, and 100% on ExploitBench, with a 1,050,000-token context window, 128K max output, an April 30 2026 knowledge cutoff, and text and image input. Through the API it behaves like the GPT-5 reasoning line: `max_completion_tokens` instead of `max_tokens`, `reasoning_effort` up to `xhigh`, no `temperature` while reasoning is on, prompt caching, and the long-context pricing tier above 272K input tokens.

:::note
**Cost tracking works on the version you already run.** Hit the **Reload Model Cost Map** button in the Admin UI (or `POST /reload/model_cost_map`) to pull the `gpt-6-astra` pricing from GitHub. This feature is available on `v1.76.0` and above.

**Parameter handling needs the next release.** The GPT-5 reasoning classifier in LiteLLM matched `gpt-5*` names only, so on older versions a `gpt-6-astra` request keeps `max_tokens` and `temperature` as sent and OpenAI rejects them. The fix widening it to GPT-6 is on `main` now and ships in this Saturday's release candidate; until you upgrade, send `max_completion_tokens` yourself and leave `temperature` unset.
:::

## Usage

<Tabs>
<TabItem value="proxy" label="LiteLLM Proxy">

**1. Setup config.yaml**

```yaml
model_list:
  - model_name: gpt-6-astra
    litellm_params:
      model: openai/gpt-6-astra
      api_key: os.environ/OPENAI_API_KEY
```

**2. Start the proxy**

```bash
docker run -d \
  -p 4000:4000 \
  -e OPENAI_API_KEY=$OPENAI_API_KEY \
  -v $(pwd)/config.yaml:/app/config.yaml \
  ghcr.io/berriai/litellm:main-latest \
  --config /app/config.yaml
```

**3. Test it**

```bash
curl -X POST "http://0.0.0.0:4000/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_KEY" \
  -d '{
    "model": "gpt-6-astra",
    "messages": [
      {"role": "user", "content": "Prove that there are infinitely many primes."}
    ],
    "reasoning_effort": "high"
  }'
```

</TabItem>
<TabItem value="sdk" label="LiteLLM Python SDK">

```python
from litellm import completion

response = completion(
    model="openai/gpt-6-astra",
    messages=[
        {"role": "user", "content": "Prove that there are infinitely many primes."}
    ],
    reasoning_effort="high",
)

print(response.choices[0].message.content)
```

</TabItem>
</Tabs>

## Responses API

For agentic and multi-turn workflows, use `/v1/responses` to preserve reasoning state across turns. A `litellm.completion()` call that combines function tools with active reasoning is bridged to `/v1/responses` automatically, the same way it is for GPT-5.4 and newer.

```bash
curl -X POST "http://0.0.0.0:4000/v1/responses" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_KEY" \
  -d '{
    "model": "gpt-6-astra",
    "input": "Plan and write a Python script that scrapes a webpage and summarizes it.",
    "reasoning": {"effort": "high"}
  }'
```

## Pricing

Prices are per 1M tokens (USD), shown as short context (≤272K tokens) / long context (>272K tokens).

| Model | Input | Cached input | Cache write | Output |
|-------|-------|--------------|-------------|--------|
| `gpt-6-astra` | $10.00 / $20.00 | $1.00 / $2.00 | $12.50 / $25.00 | $50.00 / $75.00 |

The `flex` service tier is billed at half the standard rate and `priority` at double, on both the short and long context tiers, and the Batch API is billed at half the standard input and output rate. Pass `service_tier` on the request and LiteLLM picks the matching rate. Fast mode costs 2x the applicable rate for up to 2.5x the speed.

## Notes

- `gpt-6-astra` accepts `reasoning_effort` values `low`, `medium`, `high`, and `xhigh` on Chat Completions, plus `max` on the Responses API; `none` and `minimal` are rejected, so `temperature` cannot be used with it.
- Availability is rolling out through the API; check your OpenAI account for model access.
- See the [OpenAI provider docs](../../docs/providers/openai) for the full parameter reference.

## Feedback

Running GPT-6 Astra through LiteLLM and hitting something unexpected? Share it on [GitHub discussion #39633](https://github.com/BerriAI/litellm/discussions/39633).
