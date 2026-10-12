---
slug: gpt_6_sol_luna
title: "Day 0 Support: GPT-6 Sol and GPT-6 Luna"
date: 2026-09-22T12:00:00
image: /img/litellm_gpt_6_sol_luna_announcement.png
authors:
  - misbah
  - mateo
  - kerry
description: "Day 0 support for GPT-6 Sol and GPT-6 Luna on LiteLLM, at half the price of their GPT-5.6 counterparts."
tags: [openai, gpt-6, gpt-6-sol, gpt-6-luna, completion, day 0 support]
hide_table_of_contents: false
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

![LiteLLM x GPT-6 Sol and Luna](/img/litellm_gpt_6_sol_luna_announcement.png)

LiteLLM now supports [GPT-6 Sol and GPT-6 Luna](https://openai.com/index/introducing-gpt-6-sol-and-luna/). Route traffic to them through the LiteLLM AI Gateway with the same config you use for every other OpenAI model.

{/* truncate */}

Sol and Luna join GPT-6 Astra, trained with the same methods and priced for work at scale. `gpt-6-sol` is built for complex coding and agentic workflows at $2 input and $10 output per 1M tokens, and `gpt-6-luna` is the high-volume tier at $0.10 and $0.50. OpenAI prices both at half their GPT-5.6 counterparts' current rates. Per OpenAI, Sol at `xhigh` scores 33.2% on AutomationBench at $0.27 a task and 68.8% on DeepSWE v1.1 at `max`, while Luna reaches 66.6% on DeepSWE. Both keep a 1,050,000-token context window with 922K input and 128K output, take text and image input, and run reasoning effort from `none` to `max`, defaulting to `medium`. There is no GPT-6 Terra; Astra stays the top of the range.

:::note
**No image upgrade needed.** LiteLLM already treats GPT-6 names as the GPT-5 request family, so `max_completion_tokens` and the reasoning params are handled on any version from `v1.101.0`. Pricing landed in [PR #42515](https://github.com/BerriAI/litellm/pull/42515); hit **Reload Model Cost Map** in the Admin UI (or `POST /reload/model_cost_map`) to pull it, on `v1.76.0` and above.
:::

## Usage

<Tabs>
<TabItem value="proxy" label="LiteLLM Proxy">

**1. Setup config.yaml**

```yaml
model_list:
  - model_name: gpt-6-sol
    litellm_params:
      model: openai/gpt-6-sol
      api_key: os.environ/OPENAI_API_KEY
  - model_name: gpt-6-luna
    litellm_params:
      model: openai/gpt-6-luna
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
    "model": "gpt-6-sol",
    "messages": [
      {"role": "user", "content": "Write a Python function to check if a number is prime."}
    ],
    "reasoning_effort": "high"
  }'
```

</TabItem>
<TabItem value="sdk" label="LiteLLM Python SDK">

```python
from litellm import completion

response = completion(
    model="openai/gpt-6-sol",
    messages=[
        {"role": "user", "content": "Write a Python function to check if a number is prime."}
    ],
    reasoning_effort="high",
)

print(response.choices[0].message.content)
```

```python
# gpt-6-luna for focused, high-volume work
response = completion(
    model="openai/gpt-6-luna",
    messages=[
        {"role": "user", "content": "Classify this ticket as bug, feature, or question."}
    ],
    reasoning_effort="none",
    temperature=0,
)

print(response.choices[0].message.content)
```

</TabItem>
</Tabs>

## Responses API

For agentic and multi-turn workflows, use `/v1/responses` to preserve reasoning state across turns.

```bash
curl -X POST "http://0.0.0.0:4000/v1/responses" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_KEY" \
  -d '{
    "model": "gpt-6-sol",
    "input": "Plan and write a Python script that scrapes a webpage and summarizes it."
  }'
```

## Pricing

Prices are per 1M tokens (USD), shown as short context (≤272K tokens) / long context (>272K tokens).

| Model | Input | Cached input | Cache write | Output |
|-------|-------|--------------|-------------|--------|
| `gpt-6-sol` | $2.00 / $4.00 | $0.20 / $0.40 | $2.50 / $5.00 | $10.00 / $15.00 |
| `gpt-6-luna` | $0.10 / $0.20 | $0.01 / $0.02 | $0.125 / $0.25 | $0.50 / $0.75 |

Flex and Batch run at half these rates and Priority at double; LiteLLM tracks all of them from the same cost map row.

## Notes

`temperature` only applies when reasoning is off, so send `reasoning_effort="none"` alongside it, as in the Luna example above. Without it LiteLLM drops or refuses the parameter, since the default effort is `medium`.

Both models accept OpenAI's explicit prompt cache breakpoints, and LiteLLM passes them through on `/chat/completions`, `/responses` and `/v1/messages`; see [prompt caching](../../docs/completion/prompt_caching). OpenAI also says changing reasoning effort or tools mid-conversation no longer breaks the cache, which matters if you route different effort levels to the same deployment.

## Feedback

Running GPT-6 Sol or Luna through LiteLLM and hitting something unexpected? Share it on [GitHub discussion #42523](https://github.com/BerriAI/litellm/discussions/42523).
