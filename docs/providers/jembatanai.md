---
title: "Use JembatanAI with LiteLLM"
sidebar_label: "JembatanAI"
description: "Send chat completions to JembatanAI with the LiteLLM Python SDK or Proxy. Choose a key that allows gateway use and a model from its catalog."
---

# JembatanAI

{/* keep-version-note */}

JembatanAI serves chat completions through LiteLLM's [OpenAI-compatible endpoint configuration](./openai_compatible.md). Use a Token Plan, Custom Token, Custom Token Premium, or pay-per-use key. For Unlimited access through LiteLLM, JembatanAI requires the Unlimited Reseller Gateway plan. See [JembatanAI's terms, sections 2.4 and 2.5](https://jembatanai.com/en/terms.html).

Set `JEMBATANAI_API_KEY` in your environment. To see which models the key can use, query the [JembatanAI API](https://jembatanai.com/en/docs.html).

```bash
curl -fsS https://freeai.jembatanai.com/v1/models \
  -H "Authorization: Bearer $JEMBATANAI_API_KEY"
```

Choose an ID from `data[].id` and keep its full namespace. For example, if the list contains `deepseek/deepseek-v4.1-flash`, set the LiteLLM model to `openai/deepseek/deepseek-v4.1-flash`.

## Python SDK

```python
import os

from litellm import completion

response = completion(
    model="openai/deepseek/deepseek-v4.1-flash",
    api_base="https://freeai.jembatanai.com/v1",
    api_key=os.environ["JEMBATANAI_API_KEY"],
    messages=[{"role": "user", "content": "Say hello."}],
)
print(response.choices[0].message.content)
```

## LiteLLM Proxy

Add this entry to your proxy configuration. Clients send `jembatanai-chat` as the model when calling the proxy's `/v1/chat/completions` endpoint.

```yaml
model_list:
  - model_name: jembatanai-chat
    litellm_params:
      model: openai/deepseek/deepseek-v4.1-flash
      api_base: https://freeai.jembatanai.com/v1
      api_key: os.environ/JEMBATANAI_API_KEY
```
