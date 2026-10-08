---
slug: mistral_large_4
title: "Day 0 Support: Mistral Large 4"
date: 2026-10-06T18:00:00
image: /img/litellm_mistral_large_4_announcement.png
authors:
  - misbah
  - mateo
  - kerry
description: "Day 0 support for Mistral Large 4 on LiteLLM, with pricing, the enforced 524K context window and reasoning_effort mapping."
tags: [mistral, mistral-large-4, completion, day 0 support]
hide_table_of_contents: false
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

![LiteLLM x Mistral Large 4](/img/litellm_mistral_large_4_announcement.png)

LiteLLM now supports [Mistral Large 4](https://mistral.ai/news/mistral-large-4/), in public preview on Mistral's API. Route traffic to it through the LiteLLM AI Gateway as `mistral/mistral-large-4`.

{/* truncate */}

Mistral Large 4 (Le Chonk) is a natively multimodal model with 1 trillion parameters and 49 billion active, scoring 61.7% on DeepSWE v1.1. It costs $0.68 input, $0.068 cached input and $2.09 output per 1M tokens, against $0.50, $0.05 and $1.50 for Large 3.

:::note
**No image upgrade needed.** Pricing landed in [PR #44870](https://github.com/BerriAI/litellm/pull/44870); hit **Reload Model Cost Map** in the Admin UI (or `POST /reload/model_cost_map`) to pull it, on `v1.76.0` and above.
:::

## Usage

<Tabs>
<TabItem value="proxy" label="LiteLLM Proxy">

**1. Setup config.yaml**

```yaml
model_list:
  - model_name: mistral-large-4
    litellm_params:
      model: mistral/mistral-large-4
      api_key: os.environ/MISTRAL_API_KEY
```

**2. Start the proxy**

```bash
docker run -d \
  -p 4000:4000 \
  -e MISTRAL_API_KEY=$MISTRAL_API_KEY \
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
    "model": "mistral-large-4",
    "messages": [
      {"role": "user", "content": "Write a function to merge two sorted lists."}
    ],
    "reasoning_effort": "high"
  }'
```

</TabItem>
<TabItem value="sdk" label="LiteLLM Python SDK">

```python
from litellm import completion

response = completion(
    model="mistral/mistral-large-4",
    messages=[
        {"role": "user", "content": "Write a function to merge two sorted lists."}
    ],
    reasoning_effort="high",
)

print(response.choices[0].message.content)
```

</TabItem>
</Tabs>

## Feedback

Running Mistral Large 4 through LiteLLM and hitting something unexpected? Share it on [GitHub discussion #44980](https://github.com/BerriAI/litellm/discussions/44980).
