---
slug: gpt_5_5
title: "Day 0 Support: GPT-5.5 and GPT-5.5 Pro"
date: 2026-04-24T10:00:00
authors:
  - mateo
  - krrish
  - ishaan-alt
description: "Day 0 support for GPT-5.5 and GPT-5.5 Pro on LiteLLM."
tags: [openai, gpt-5.5, gpt-5.5-pro, completion, day 0 support]
hide_table_of_contents: false
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

LiteLLM now supports [GPT-5.5 and GPT-5.5 Pro](https://openai.com/index/introducing-gpt-5-5/) on Day 0. Route traffic to OpenAI's latest frontier model through the LiteLLM AI Gateway with no code changes.

{/* truncate */}

GPT-5.5 is OpenAI's "smartest and most intuitive to use model" yet, with significant gains on agentic coding, computer use, and deep research workflows. Per OpenAI, it is a faster, sharper thinker for fewer tokens compared to GPT-5.4. GPT-5.5 Pro targets the most demanding reasoning tasks.

:::note
**No Docker image upgrade needed.** GPT-5.5 routes through the existing `OpenAIGPT5Config` in LiteLLM, so any recent version works out of the box.

For cost tracking, hit the **Reload Model Cost Map** button in the Admin UI (or `POST /reload/model_cost_map`) to pull the latest pricing from GitHub. This feature is available on `v1.76.0` and above.
:::

## Usage

<Tabs>
<TabItem value="proxy" label="LiteLLM Proxy">

**1. Setup config.yaml**

```yaml
model_list:
  - model_name: gpt-5.5
    litellm_params:
      model: openai/gpt-5.5
      api_key: os.environ/OPENAI_API_KEY
  - model_name: gpt-5.5-pro
    litellm_params:
      model: openai/gpt-5.5-pro
      api_key: os.environ/OPENAI_API_KEY
```

**2. Start the proxy**

```bash
docker run -d \
  -p 4000:4000 \
  -e OPENAI_API_KEY=$OPENAI_API_KEY \
  -v $(pwd)/config.yaml:/app/config.yaml \
  ghcr.io/berriai/litellm:v1.83.7-stable \
  --config /app/config.yaml
```

**3. Test it**

```bash
curl -X POST "http://0.0.0.0:4000/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_KEY" \
  -d '{
    "model": "gpt-5.5",
    "messages": [
      {"role": "user", "content": "Write a Python function to check if a number is prime."}
    ]
  }'
```

</TabItem>
<TabItem value="sdk" label="LiteLLM SDK">

```python
from litellm import completion

response = completion(
    model="openai/gpt-5.5",
    messages=[
        {"role": "user", "content": "Write a Python function to check if a number is prime."}
    ],
)

print(response.choices[0].message.content)
```

```python
# GPT-5.5 Pro
response = completion(
    model="openai/gpt-5.5-pro",
    messages=[
        {"role": "user", "content": "Prove that the sum of two odd integers is even."}
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
    "model": "gpt-5.5",
    "input": "Plan and write a Python script that scrapes a webpage and summarizes it."
  }'
```

## Reasoning Effort

`reasoning_effort` controls how much thinking the model applies. Supported values per model (verified against OpenAI's live API on 2026-04-24):

| Model | Default | Allowed values |
|-------|---------|----------------|
| `gpt-5.5` | `medium` | `none`, `low`, `medium`, `high`, `xhigh` |
| `gpt-5.5-pro` | `high` | `medium`, `high`, `xhigh` |

```python
from litellm import completion

response = completion(
    model="openai/gpt-5.5",
    messages=[{"role": "user", "content": "Solve: what is the optimal strategy for..."}],
    reasoning_effort="high",
)
```

LiteLLM enforces these caps locally — passing an unsupported value (e.g. `minimal`) raises an `UnsupportedParamsError` instead of round-tripping to OpenAI for a 400.

## Notes

- For cost tracking on `gpt-5.5` and `gpt-5.5-pro`, hit the **Reload Model Cost Map** button in the Admin UI (or `POST /reload/model_cost_map`). Works on any LiteLLM version `v1.76.0` or newer — no container restart or image upgrade required.
- `gpt-5.5-pro` is a Responses API-only model (`mode: "responses"`). LiteLLM's Responses API bridge transparently translates `completion()` calls to `/v1/responses`, so the SDK example above works without code changes.
- GPT-5.5 supports reasoning, function calling, parallel tool calls, vision (image input), PDF input, prompt caching, web search, and structured output — see the [OpenAI provider docs](../../docs/providers/openai) for advanced usage.
- Context window: 1.05M input tokens / 128K output tokens. Long-context tier pricing kicks in above 272K tokens.
- Azure availability: not yet — this post covers OpenAI direct only.
