---
sidebar_label: "Traffic Mirroring"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# A/B Testing - Traffic Mirroring

Traffic mirroring allows you to "mimic" production traffic to a secondary (silent) model for evaluation purposes. The silent model's response is gathered in the background and does not affect the latency or result of the primary request.

This is useful for:
- Testing a new model's performance on production prompts before switching.
- Comparing costs and latency between different providers.
- Debugging issues by mirroring traffic to a more verbose model.

## Quick Start

To enable traffic mirroring, add `silent_model` to the `litellm_params` of a deployment.

<Tabs>
<TabItem value="sdk" label="SDK">

```python
from litellm import Router

model_list = [
    {
        "model_name": "{{openai_small}}",
        "litellm_params": {
            "model": "azure/chatgpt-v-2",
            "api_key": "...",
            "silent_model": "{{openai_large}}" # Mirror traffic to {{openai_large}}
        },
    },
    {
        "model_name": "{{openai_large}}",
        "litellm_params": {
            "model": "openai/{{openai_large}}",
            "api_key": "..."
        },
    }
]

router = Router(model_list=model_list)

# The request to "{{openai_small}}" will trigger a background call to "{{openai_large}}"
response = await router.acompletion(
    model="{{openai_small}}",
    messages=[{"role": "user", "content": "How does traffic mirroring work?"}]
)
```

</TabItem>
<TabItem value="proxy" label="Proxy">

Add `silent_model` to your `config.yaml`:

```yaml
model_list:
  - model_name: primary-model
    litellm_params:
      model: azure/{{openai_small}}
      api_key: os.environ/AZURE_API_KEY
      silent_model: evaluation-model # Mirror traffic here
  - model_name: evaluation-model
    litellm_params:
      model: openai/{{openai_large}}
      api_key: os.environ/OPENAI_API_KEY
```

</TabItem>
</Tabs>

## Streaming requests

Available from v1.103.0.

The mirrored call follows the `stream` flag of the primary request. A streaming request is mirrored as a streaming call, and LiteLLM reads the mirrored stream to the end in the background, so the silent model's spend log row and logging callbacks get streaming timings such as time to first token. A non-streaming request is mirrored as a non-streaming call. Earlier versions always mirrored with `stream=False`.

## Multiple silent models

Available from v1.103.0.

`silent_model` also takes a list of model names. LiteLLM then mirrors each request to every model in the list, with one background call per model.

```yaml
model_list:
  - model_name: primary-model
    litellm_params:
      model: azure/{{openai_small}}
      api_key: os.environ/AZURE_API_KEY
      silent_model: [evaluation-model-a, evaluation-model-b]
  - model_name: evaluation-model-a
    litellm_params:
      model: openai/{{openai_large}}
      api_key: os.environ/OPENAI_API_KEY
  - model_name: evaluation-model-b
    litellm_params:
      model: anthropic/{{anthropic}}
      api_key: os.environ/ANTHROPIC_API_KEY
```

## How it works
1. **Request Received**: A request is made to a model group (e.g. `primary-model`).
2. **Deployment Picked**: LiteLLM picks a deployment from the group.
3. **Primary Call**: LiteLLM makes the call to the primary deployment.
4. **Mirroring**: For each model in `silent_model`, LiteLLM triggers a background call to that model with the same `stream` flag as the primary request.
   - For **Sync** calls: Starts one background thread per silent model.
   - For **Async** calls: Uses `asyncio.create_task`.
5. **Isolation**: The background call uses a `deepcopy` of the original request parameters and sets `metadata["is_silent_experiment"] = True`. It also strips out logging IDs to prevent collisions in usage tracking.

## Key Features
- **Latency Isolation**: The primary request returns as soon as it's ready. The background (silent) call does not block.
- **Unified Logging**: Background calls are processed via the Router, meaning they are automatically logged to your configured observability tools (Langfuse, S3, etc.).
- **Evaluation**: Use the `is_silent_experiment: True` flag in your logs to filter and compare results between the primary and mirrored calls.
