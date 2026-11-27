---
title: "Portweights API with LiteLLM: Your Fine-Tuned LoRA Adapters"
sidebar_label: "Portweights"
description: "Call your own fine-tuned LoRA adapters, deployed as private OpenAI-compatible endpoints on Portweights, from the LiteLLM Python SDK or AI Gateway."
---

# Portweights

https://portweights.com

Portweights hosts your fine-tuned LoRA adapters as private, OpenAI-compatible endpoints. You upload an adapter (or import it from Hugging Face) and get a base URL, a model ID and an API key. Because the endpoint is OpenAI-compatible, LiteLLM calls it through the `openai/` route.

| Property | Details |
|-------|-------|
| Description | Private hosting for fine-tuned LoRA adapters (Qwen3-8B today), billed per token. |
| Provider Route on LiteLLM | `openai/` (OpenAI-compatible endpoint, with `api_base`) |
| Supported Endpoints | `/chat/completions` (with streaming) |
| API Reference | [Portweights](https://portweights.com) |

Each deployment has its own model ID (for example `qwen3-8b-1a2b3c4d`) and its own key. The base URL depends on the region you deployed to:

| Region | `api_base` |
|-------|-------|
| India | `https://in.api.portweights.com/v1` |
| US | `https://us.api.portweights.com/v1` |
| Europe | `https://eu.api.portweights.com/v1` |

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["PORTWEIGHTS_API_KEY"] = ""  # the key shown when you deployed the adapter
```

## Usage - LiteLLM Python SDK

```python showLineNumbers title="Portweights Chat Completion"
from litellm import completion
import os

response = completion(
    model="openai/qwen3-8b-1a2b3c4d",                 # your deployment's model ID
    api_base="https://in.api.portweights.com/v1",     # your deployment's region
    api_key=os.environ["PORTWEIGHTS_API_KEY"],
    messages=[{"role": "user", "content": "Summarize this support ticket in one line: ..."}],
)
print(response.choices[0].message.content)
```

```python showLineNumbers title="Portweights Streaming"
from litellm import completion
import os

stream = completion(
    model="openai/qwen3-8b-1a2b3c4d",
    api_base="https://in.api.portweights.com/v1",
    api_key=os.environ["PORTWEIGHTS_API_KEY"],
    messages=[{"role": "user", "content": "Summarize this support ticket in one line: ..."}],
    stream=True,
)
for chunk in stream:
    print(chunk.choices[0].delta.content or "", end="")
```

Qwen3 thinking is off by default. To turn it on for a request, pass `extra_body={"chat_template_kwargs": {"enable_thinking": True}}`; the reasoning comes back separately from the reply.

## Usage - LiteLLM AI Gateway (Proxy)

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: support-triage            # the name your apps call
    litellm_params:
      model: openai/qwen3-8b-1a2b3c4d     # your deployment's model ID
      api_base: https://in.api.portweights.com/v1
      api_key: os.environ/PORTWEIGHTS_API_KEY
```

```bash showLineNumbers title="Start the gateway"
litellm --config config.yaml
```

```bash showLineNumbers title="Call it"
curl http://0.0.0.0:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-1234" \
  -d '{"model": "support-triage", "messages": [{"role": "user", "content": "Hello"}]}'
```

## Deploying an adapter

```bash showLineNumbers title="Portweights CLI"
pip install portweights
portweights login
portweights deploy --hf your-name/your-lora --region in   # prints the base URL, model ID and key
```

Adapters must be LoRA adapters in PEFT format (`adapter_config.json` and `adapter_model.safetensors`) for a supported base model. To check whether a Hugging Face adapter will load before deploying, use https://portweights.com/check.
