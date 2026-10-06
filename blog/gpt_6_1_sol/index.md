---
slug: gpt_6_1_sol
title: "Day 0 Support: GPT-6.1 Sol"
date: 2026-09-29T12:00:00
image: /img/litellm_gpt_6_1_sol_announcement.png
authors:
  - misbah
  - mateo
  - kerry
description: "Day 0 support for GPT-6.1 Sol on LiteLLM, with cached input at half GPT-6 Sol's price."
tags: [openai, gpt-6, gpt-6.1-sol, completion, day 0 support]
hide_table_of_contents: false
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

![LiteLLM x GPT-6.1 Sol](/img/litellm_gpt_6_1_sol_announcement.png)

LiteLLM now supports [GPT-6.1 Sol](https://openai.com/index/introducing-gpt-6-1-sol/). Route traffic to it through the LiteLLM AI Gateway with the same config you use for every other OpenAI model.

{/* truncate */}

GPT-6.1 Sol is an upgrade to GPT-6 Sol at the same $2 input and $10 output per 1M tokens, with cached input cut in half to $0.10. Per OpenAI, it matches GPT-6 Astra on DeepSWE v1.1 at roughly a fifth of the cost, and on Terminal-Bench Science it averages $5.47 a task against $23.21 for Opus 5.5.

:::note
**No image upgrade needed.** Pricing landed in [PR #43738](https://github.com/BerriAI/litellm/pull/43738); hit **Reload Model Cost Map** in the Admin UI (or `POST /reload/model_cost_map`) to pull it, on `v1.76.0` and above.
:::

## Usage

<Tabs>
<TabItem value="proxy" label="LiteLLM Proxy">

**1. Setup config.yaml**

```yaml
model_list:
  - model_name: gpt-6.1-sol
    litellm_params:
      model: openai/gpt-6.1-sol
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
    "model": "gpt-6.1-sol",
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
    model="openai/gpt-6.1-sol",
    messages=[
        {"role": "user", "content": "Write a Python function to check if a number is prime."}
    ],
    reasoning_effort="high",
)

print(response.choices[0].message.content)
```

</TabItem>
</Tabs>

## Pricing

Per 1M tokens (USD), short context (≤272K tokens) / long context (>272K tokens).

| Model | Input | Cached input | Cache write | Output |
|-------|-------|--------------|-------------|--------|
| `gpt-6.1-sol` | $2.00 / $4.00 | $0.10 / $0.20 | $2.50 / $5.00 | $10.00 / $15.00 |

Batch and Flex run at half these rates and Fast mode at double; LiteLLM tracks all of them from the same cost map row.

## Notes

OpenAI serves tool calling for this model on the Responses API only. LiteLLM bridges a `/chat/completions` request with tools to `/v1/responses` for you, so existing tool-calling code keeps working.

Reasoning effort runs `low` to `max`, defaulting to `medium`. Unlike GPT-6 Sol, `none` is not supported, so `temperature` is not available on this model.

## Feedback

Running GPT-6.1 Sol through LiteLLM and hitting something unexpected? Share it on [GitHub discussion #43742](https://github.com/BerriAI/litellm/discussions/43742).
