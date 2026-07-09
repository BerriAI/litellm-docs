---
slug: gpt_5_6
title: "Day 0 Support: GPT-5.6 (Sol, Terra, Luna)"
date: 2026-07-09T10:00:00
authors:
  - mateo
  - krrish
  - ishaan-alt
description: "Day 0 support for the GPT-5.6 family (Sol, Terra, and Luna) on LiteLLM."
image: ./hero.png
tags: [openai, gpt-5.6, gpt-5.6-sol, gpt-5.6-terra, gpt-5.6-luna, completion, day 0 support]
hide_table_of_contents: false
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

![LiteLLM x GPT-5.6](./hero.png)

LiteLLM now supports the [GPT-5.6 family](https://openai.com/index/previewing-gpt-5-6-sol/). Route traffic to OpenAI's newest frontier models through the LiteLLM AI Gateway with no code changes.

{/* truncate */}

GPT-5.6 introduces a new naming system where the number identifies the generation and the tier name identifies a durable capability level. `gpt-5.6-sol` is the flagship for complex reasoning and agentic workloads, `gpt-5.6-terra` is a balanced model for everyday work with performance competitive with GPT-5.5 at roughly half the cost, and `gpt-5.6-luna` is the fastest and most affordable tier. Per OpenAI, the family sets a new state of the art on agentic coding (Terminal-Bench 2.1) with broad gains in long-horizon biology and cybersecurity workflows. GPT-5.6 also adds a new `max` reasoning effort for the deepest single-agent thinking and an `ultra` mode that coordinates subagents on the most complex tasks.

:::info Living post
**This post is updated as GPT-5.6 support expands.** Azure OpenAI support for the GPT-5.6 models is coming soon; today the post covers OpenAI direct. Check back soon for Azure availability and pricing details.
:::

:::note
**No Docker image upgrade needed.** GPT-5.6 routes through the existing `OpenAIGPT5Config` in LiteLLM (the version classifier already matches `gpt-5.4` and newer), so any recent version works out of the box.

For cost tracking, hit the **Reload Model Cost Map** button in the Admin UI (or `POST /reload/model_cost_map`) to pull the latest pricing from GitHub. This feature is available on `v1.76.0` and above.
:::

## Usage

<Tabs>
<TabItem value="proxy" label="LiteLLM Proxy">

**1. Setup config.yaml**

```yaml
model_list:
  - model_name: gpt-5.6-sol
    litellm_params:
      model: openai/gpt-5.6-sol
      api_key: os.environ/OPENAI_API_KEY
  - model_name: gpt-5.6-terra
    litellm_params:
      model: openai/gpt-5.6-terra
      api_key: os.environ/OPENAI_API_KEY
  - model_name: gpt-5.6-luna
    litellm_params:
      model: openai/gpt-5.6-luna
      api_key: os.environ/OPENAI_API_KEY
```

**2. Start the proxy**

```bash
docker run -d \
  -p 4000:4000 \
  -e OPENAI_API_KEY=$OPENAI_API_KEY \
  -v $(pwd)/config.yaml:/app/config.yaml \
  ghcr.io/berriai/litellm:v1.91.1 \
  --config /app/config.yaml
```

**3. Test it**

```bash
curl -X POST "http://0.0.0.0:4000/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_KEY" \
  -d '{
    "model": "gpt-5.6-sol",
    "messages": [
      {"role": "user", "content": "Write a Python function to check if a number is prime."}
    ]
  }'
```

</TabItem>
<TabItem value="sdk" label="LiteLLM Python SDK">

```python
from litellm import completion

response = completion(
    model="openai/gpt-5.6-sol",
    messages=[
        {"role": "user", "content": "Write a Python function to check if a number is prime."}
    ],
)

print(response.choices[0].message.content)
```

```python
# gpt-5.6-terra for balanced, cost-efficient everyday work
response = completion(
    model="openai/gpt-5.6-terra",
    messages=[
        {"role": "user", "content": "Summarize the key ideas in this design doc."}
    ],
)

print(response.choices[0].message.content)
```

```python
# gpt-5.6-luna for the fastest, lowest-cost tier
response = completion(
    model="openai/gpt-5.6-luna",
    messages=[
        {"role": "user", "content": "Classify this ticket as bug, feature, or question."}
    ],
)

print(response.choices[0].message.content)
```

</TabItem>
</Tabs>

## Responses API

For agentic and multi-turn workflows, use `/v1/responses` to preserve reasoning state and output item metadata across turns.

```bash
curl -X POST "http://0.0.0.0:4000/v1/responses" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_KEY" \
  -d '{
    "model": "gpt-5.6-sol",
    "input": "Plan and write a Python script that scrapes a webpage and summarizes it."
  }'
```

## Pricing

Prices are per 1M tokens (USD), shown as short context (≤272K tokens) / long context (>272K tokens).

| Model | Input | Cached input | Cache write | Output |
|-------|-------|--------------|-------------|--------|
| `gpt-5.6-sol` | $5.00 / $10.00 | $0.50 / $1.00 | $6.25 / $12.50 | $30.00 / $45.00 |
| `gpt-5.6-terra` | $2.50 / $5.00 | $0.25 / $0.50 | $3.125 / $6.25 | $15.00 / $22.50 |
| `gpt-5.6-luna` | $1.00 / $2.00 | $0.10 / $0.20 | $1.25 / $2.50 | $6.00 / $9.00 |

## Notes

- For cost tracking on the GPT-5.6 models, hit the **Reload Model Cost Map** button in the Admin UI (or `POST /reload/model_cost_map`). Works on any LiteLLM version `v1.76.0` or newer, with no container restart or image upgrade required.
- GPT-5.6 supports reasoning, function calling, parallel tool calls, vision (image input), prompt caching, web search, and structured output; see the [OpenAI provider docs](../../docs/providers/openai) for advanced usage.
- The GPT-5.6 family launched in limited preview and OpenAI is expanding availability through the API and Codex; check your OpenAI account for model access.
