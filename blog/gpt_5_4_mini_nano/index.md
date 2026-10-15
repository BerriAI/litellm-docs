---
slug: gpt_5_4_mini_nano
title: "Day 0 Support: GPT-5.4-mini and GPT-5.4-nano"
date: 2026-03-17T10:00:00
authors: [sameer, krrish, ishaan]
description: "GPT-5.4-mini and GPT-5.4-nano model support in LiteLLM"
tags: [openai, gpt-5.4-mini, gpt-5.4-nano, completion]
hide_table_of_contents: false
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

LiteLLM now supports GPT-5.4-mini and GPT-5.4-nano, cost-effective models for simple completions and high-throughput workloads.

{/* truncate */}

:::note
If you're on **v1.82.3-stable** or above, you don't need any update to use these models.
:::

## Usage

<Tabs>
<TabItem value="proxy" label="LiteLLM Proxy">

**1. Setup config.yaml**

```yaml
model_list:
  - model_name: gpt-5.4-mini
    litellm_params:
      model: openai/gpt-5.4-mini
      api_key: os.environ/OPENAI_API_KEY
  - model_name: gpt-5.4-nano
    litellm_params:
      model: openai/gpt-5.4-nano
      api_key: os.environ/OPENAI_API_KEY
```

**2. Start the proxy**

```bash
litellm --config /path/to/config.yaml
```

**3. Test it**

```bash
# GPT-5.4-mini
curl -X POST "http://localhost:4000/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_KEY" \
  -d '{
    "model": "gpt-5.4-mini",
    "messages": [{"role": "user", "content": "What is the capital of France?"}]
  }'

# GPT-5.4-nano
curl -X POST "http://localhost:4000/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_KEY" \
  -d '{
    "model": "gpt-5.4-nano",
    "messages": [{"role": "user", "content": "What is 2 + 2?"}]
  }'
```

</TabItem>
<TabItem value="sdk" label="LiteLLM SDK">

```python
from litellm import completion

# GPT-5.4-mini
response = completion(
    model="openai/gpt-5.4-mini",
    messages=[{"role": "user", "content": "What is the capital of France?"}],
)
print(response.choices[0].message.content)

# GPT-5.4-nano
response = completion(
    model="openai/gpt-5.4-nano",
    messages=[{"role": "user", "content": "What is 2 + 2?"}],
)
print(response.choices[0].message.content)
```

</TabItem>
</Tabs>

## Notes

- Both models support function calling, vision, and tool-use; see the [OpenAI provider docs](../../docs/providers/openai) for advanced usage.
- GPT-5.4-nano is the most cost-effective option for simple tasks; GPT-5.4-mini offers a balance of speed and capability.
