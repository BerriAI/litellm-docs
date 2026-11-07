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

<SinceVersion v="1.103.0" />

The mirrored call follows the `stream` flag of the primary request. A streaming request is mirrored as a streaming call, and LiteLLM reads the mirrored stream to the end in the background, so the silent model's spend log row and logging callbacks get streaming timings such as time to first token. A non-streaming request is mirrored as a non-streaming call. Earlier versions always mirrored with `stream=False`.

## Multiple silent models

<SinceVersion v="1.103.0" />

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
5. **Isolation**: The background call uses a `deepcopy` of the original request parameters and sets `metadata["is_silent_experiment"] = True`. It also strips out logging IDs to prevent collisions in usage tracking. Spend logs and logging callbacks mark the call as mirrored, as [Find mirrored calls in logs](#find-mirrored-calls-in-logs) describes.

## Key Features
- **Latency Isolation**: The primary request returns as soon as it's ready. The background (silent) call does not block.
- **Unified Logging**: Background calls are processed via the Router, meaning they are automatically logged to your configured observability tools (Langfuse, S3, etc.).
- **Evaluation**: Mirrored calls carry `is_silent_experiment: true` in spend logs and logging callbacks, so you can filter them and compare them with the primary calls. See [Find mirrored calls in logs](#find-mirrored-calls-in-logs).

## Find mirrored calls in logs

<SinceVersion v="1.109.0" />

LiteLLM marks each mirrored call with `is_silent_experiment: true` in these places.

| Destination | Where the mark is |
|---|---|
| Spend logs | `metadata.is_silent_experiment` |
| Logging callbacks | `standard_logging_object["metadata"]["is_silent_experiment"]` |
| Langfuse | Generation metadata |
| Prometheus | `metadata_is_silent_experiment` label |
| Datadog Cloud Cost Management | `is_silent_experiment` cost tag |

Only the router sets this mark. A client that sends `is_silent_experiment` in its request metadata does not mark its spend log row, its logging payload, or its Langfuse generation.

Real calls carry no `is_silent_experiment` key at all, rather than `false`. A filter on `is_silent_experiment = false` matches nothing, so filter on `true` to find mirrored calls and on a missing key to find real calls.

LLM calls that start while a mirrored call runs also carry the mark, because they serve the mirror. This covers retries, fallbacks, and the calls that pre-call hooks, guardrails, and semantic cache embeddings make. Calls that a logging callback starts after the mirrored call finishes, such as an LLM judge in an evaluation callback, carry no mark.

### Spend logs

`/spend/logs/v2` has no query parameter for `is_silent_experiment`. Read `metadata.is_silent_experiment` from the rows it returns, or query the `LiteLLM_SpendLogs` table directly.

```sql
SELECT request_id, model, spend
FROM "LiteLLM_SpendLogs"
WHERE metadata->>'is_silent_experiment' = 'true';
```

To list real calls instead, use `WHERE NOT metadata ? 'is_silent_experiment'`.

If you set `general_settings.spend_logs_metadata_fields` with an `include` list, add `is_silent_experiment` to the list to keep the mark on spend log rows. Versions before 1.109.0 do not know this key, so naming it there stops the proxy at startup.

### Logging callbacks

A custom callback reads the mark from `kwargs["standard_logging_object"]["metadata"].get("is_silent_experiment")`, which is `True` on mirrored calls and missing on real calls.

Do not use the raw request metadata in `kwargs["litellm_params"]["metadata"]` for this. It has `is_silent_experiment: True` on mirrored calls, but it also keeps any `is_silent_experiment` value a client sends. Callbacks that read the raw request metadata, such as PostHog and Helicone, show a client-sent value too.

### Prometheus

Add `metadata.is_silent_experiment` to `custom_prometheus_metadata_labels`. Metrics for mirrored calls then get the label `metadata_is_silent_experiment="true"`, and other calls get `metadata_is_silent_experiment="None"`.

```yaml
litellm_settings:
  callbacks: ["prometheus"]
  custom_prometheus_metadata_labels: ["metadata.is_silent_experiment"]
```

### Datadog Cloud Cost Management

Add `is_silent_experiment` to the `cost_tag_keys` of the `datadog_cost_management` callback. Costs of mirrored calls then get the tag `is_silent_experiment:true`.

```yaml
litellm_settings:
  callbacks: ["datadog_cost_management"]

callback_settings:
  datadog_cost_management:
    cost_tag_keys: ["is_silent_experiment"]
```

The router is the only source of this label and this tag. A client's request metadata or request tags and an admin's key or team metadata do not set them, even when they contain `is_silent_experiment`.
