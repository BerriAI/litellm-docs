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
| Langfuse (`langfuse` callback) | Generation metadata |
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

## Compare responses in Langfuse

This Router SDK example sends one non-streaming chat request and mirrors it to one silent model. It creates a trace for the comparison and can save the primary and shadow results to a JSON file of your choice.

The example was tested with Python 3.12, LiteLLM 1.109.1, and OpenTelemetry 1.45.1. {/* keep-python-version */}

```shell
pip install 'litellm==1.109.1' 'opentelemetry-sdk==1.45.1' 'opentelemetry-exporter-otlp-proto-http==1.45.1'
```

Set `OPENAI_API_KEY` for the model calls and `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, and `LANGFUSE_HOST` for your [Langfuse project](./observability/langfuse_integration). Then enable the [OpenTelemetry v2 preset](./observability/opentelemetry_v2) and its message capture:

```shell
export LITELLM_OTEL_V2=true
export LITELLM_OTEL_LANGFUSE_SPAN_SCOPE=llm_only
export OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT=span_only
export OTEL_EXPORTER_OTLP_TRACES_TIMEOUT=5
```

Langfuse receives prompt and response content, and the optional JSON file contains response text. Use a test prompt and save the file in a directory where you control access.

Save this as `compare_shadow.py`:

```python title="compare_shadow.py"
import argparse
import asyncio
import json
from pathlib import Path
from time import monotonic
from uuid import uuid4

import litellm
from litellm.integrations.custom_logger import CustomLogger
from opentelemetry.sdk.trace import TracerProvider

PRIMARY_MODEL = "openai/{{openai_small}}"
SHADOW_MODEL = "openai/{{openai_large}}"
SHADOW_WAIT_SECONDS = 5


class Comparison(CustomLogger):
    def __init__(self, comparison_id):
        super().__init__()
        self.comparison_id = comparison_id
        self.results = {}
        self.done = asyncio.Event()

    async def async_log_success_event(self, kwargs, response_obj, start_time, end_time):
        self.record(kwargs, "success", response_obj)

    async def async_log_failure_event(self, kwargs, response_obj, start_time, end_time):
        self.record(kwargs, "error")

    def record(self, kwargs, status, response=None):
        payload = kwargs.get("standard_logging_object") or {}
        metadata = payload.get("metadata") or {}
        requester = metadata.get("requester_metadata") or {}
        if requester.get("comparison_id") != self.comparison_id:
            return

        role = "shadow" if metadata.get("is_silent_experiment") is True else "primary"
        error = payload.get("error_information") or {}
        text = response.choices[0].message.content if response and response.choices else None
        self.results[role] = {
            "status": status,
            "model": payload.get("model"),
            "response": text,
            "latency_seconds": payload.get("response_time"),
            "cost_usd": kwargs.get("response_cost") if status == "success" else None,
            "litellm_call_id": payload.get("litellm_call_id"),
            "error_type": error.get("error_class") or None,
        }
        if "primary" in self.results and "shadow" in self.results:
            self.done.set()


async def compare(trace_id, output):
    comparison = Comparison(uuid4().hex)
    litellm.callbacks = ["langfuse_otel", comparison]
    router = litellm.Router(
        model_list=[
            {
                "model_name": "primary",
                "litellm_params": {"model": PRIMARY_MODEL, "silent_model": "shadow"},
            },
            {"model_name": "shadow", "litellm_params": {"model": SHADOW_MODEL}},
        ],
        num_retries=0,
        timeout=30,
    )

    start = monotonic()
    response = await router.acompletion(
        model="primary",
        messages=[{"role": "user", "content": "Why is the sky blue? Answer in one sentence."}],
        metadata={"metadata": {"comparison_id": comparison.comparison_id}},
        stream=False,
        caching=False,
    )
    primary_latency = monotonic() - start
    answer = response.choices[0].message.content if response.choices else None
    print("Primary response:", answer, flush=True)
    print("Trace ID:", trace_id, flush=True)

    try:
        await asyncio.wait_for(comparison.done.wait(), timeout=SHADOW_WAIT_SECONDS)
    except TimeoutError:
        pass

    primary = {
        "model": PRIMARY_MODEL,
        "latency_seconds": primary_latency,
        "cost_usd": None,
        "litellm_call_id": None,
        "error_type": None,
        **comparison.results.get("primary", {}),
        "status": "success",
        "response": answer,
    }
    shadow = comparison.results.get("shadow", {"model": SHADOW_MODEL, "status": "unobserved"})
    if output is not None:
        record = {
            "comparison_id": comparison.comparison_id,
            "trace_id": trace_id,
            "primary": primary,
            "shadow": shadow,
        }
        data = json.dumps(record, ensure_ascii=False, indent=2)
        with output.open("x", encoding="utf-8") as file:
            file.write(data + "\n")
    print("Shadow status:", shadow["status"], flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("output", nargs="?", type=Path, help="Path to a new comparison JSON file")
    args = parser.parse_args()
    if args.output is not None and args.output.exists():
        parser.error(f"Output file already exists: {args.output}")

    # This provider supplies the trace context. The Langfuse preset owns its exporter.
    tracer = TracerProvider().get_tracer("shadow-comparison")
    with tracer.start_as_current_span("compare-shadow") as span:
        asyncio.run(compare(f"{span.get_span_context().trace_id:032x}", args.output))
```

```shell
python compare_shadow.py comparison.json
```

The script prints the primary answer before waiting for the callbacks. Pass a path to a new file for offline comparison, or omit the path to use Langfuse alone. In the JSON, `error` means the shadow failure callback ran. `unobserved` means the five-second wait after the primary returned ended without a shadow callback. The script preserves the primary answer in both cases. A `null` cost means LiteLLM did not report a cost.

Use the printed trace ID to find the `primary` and `shadow` generations in Langfuse. The JSON uses the callback's mirror marker to assign each role. For OTLP inspection, each recorded `litellm_call_id` matches that generation's `langfuse.observation.id` attribute.

Run this example as a standalone process. When the comparison finishes, `asyncio.run()` cancels tasks still pending on its event loop. On normal process exit, the preset's OpenTelemetry SDK shuts down its exporter and attempts to send the completed spans. The exporter uses the configured HTTP timeout. The JSON file is written before shutdown, so it is available even if export fails.
