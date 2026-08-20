import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Openlayer

AI evaluation and observability, at [openlayer.com](https://www.openlayer.com/).

:::info
We want to learn how we can make the callbacks better! Meet the LiteLLM [founders](https://calendly.com/d/4mp-gd3-k5k/berriai-1-1-onboarding-litellm-hosted-version) or
join our [discord](https://discord.gg/wuPM9dRgDw)
:::

## Pre-Requisites

```shell
uv add litellm
```

You need an Openlayer API key and the ID of the inference pipeline that traces should land in. The key is under Workspace settings, API keys; the pipeline ID is on the pipeline you want to publish to.

## Quick Start

<Tabs>
<TabItem value="python" label="SDK">

```python
import litellm
import os

os.environ["OPENLAYER_API_KEY"] = ""
os.environ["OPENLAYER_INFERENCE_PIPELINE_ID"] = ""
# LLM API Keys
os.environ["OPENAI_API_KEY"] = ""

# set openlayer as a callback, litellm will send the data to openlayer
litellm.callbacks = ["openlayer"]

# openai call
response = litellm.completion(
  model="gpt-4o",
  messages=[
    {"role": "user", "content": "Hi, i'm openai"}
  ]
)
```

</TabItem>
<TabItem value="proxy" label="LiteLLM Proxy">

1. Setup config.yaml

```yaml
model_list:
  - model_name: gpt-4o
    litellm_params:
      model: openai/gpt-4o
      api_key: os.environ/OPENAI_API_KEY

litellm_settings:
  callbacks: ["openlayer"]
```

2. Set your credentials

```shell
LITELLM_OTEL_V2=true
OPENLAYER_API_KEY="your-api-key"
OPENLAYER_INFERENCE_PIPELINE_ID="your-inference-pipeline-id"
```

3. Start LiteLLM Proxy

```bash
litellm --config /path/to/config.yaml
```

4. Test it!

```bash
curl -L -X POST 'http://0.0.0.0:4000/v1/chat/completions' \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer sk-1234' \
-d '{
  "model": "gpt-4o",
  "messages": [
    {
      "role": "user",
      "content": "Hey, how are you?"
    }
  ]
}'
```

</TabItem>
</Tabs>

## What Openlayer renders

Open the Data view of your inference pipeline. Each traced call arrives as a row carrying the provider, the model, prompt and completion token counts, cost, and latency, with the prompt and the response on the row itself. Openlayer reads the canonical `gen_ai.*` schema, so the integration adds no vendor mapper; see [Span attributes](./opentelemetry_v2#span-attributes) for the full list of keys.

Cost is computed by Openlayer from the provider and model on the span rather than from a self-reported figure, so it is filled in for every provider Openlayer prices. Embedding calls report their prompt tokens but are not priced.

The preset routes spans to `https://api.openlayer.com/v1/otel` with `Authorization: Bearer $OPENLAYER_API_KEY`, plus an `x-bt-parent` header of `pipeline_id:$OPENLAYER_INFERENCE_PIPELINE_ID` that selects the destination pipeline.

## Configuration

| Variable | Required | Notes |
|---|---|---|
| `OPENLAYER_API_KEY` | Yes | Workspace API key, sent as `Authorization: Bearer` |
| `OPENLAYER_INFERENCE_PIPELINE_ID` | Yes | Pipeline traces are published to, sent as `x-bt-parent: pipeline_id:<id>` |
| `OPENLAYER_OTEL_ENDPOINT` | No | Self-hosted collector. Defaults to `https://api.openlayer.com/v1/otel` |

Both required variables are validated at startup; the integration raises if either is missing, naming the one that is absent. To label spans with an environment, set `OTEL_ENVIRONMENT_NAME`, which stamps `deployment.environment` on every span.

The endpoint is a base URL rather than the signal path. LiteLLM appends `/v1/traces` for you and appends it only once, so the already suffixed spelling resolves to the same URL instead of doubling it.

## Which OpenTelemetry path is used

Setting `LITELLM_OTEL_V2=true` routes spans through the v2 preset, which is the path the proxy uses. Without it the callback falls back to the v1 OpenTelemetry logger, which is why the SDK example above needs no flag. Endpoint and credentials are read from the same place either way, so the two paths cannot drift apart.

## Full OpenTelemetry reference

This page covers the Openlayer specific setup. For span attributes, prompt and response capture, metrics, distributed tracing, and which routes are traced, see the [OpenTelemetry v2 guide](./opentelemetry_v2).

## Support & Talk to Founders

- [Schedule Demo 👋](https://calendly.com/d/4mp-gd3-k5k/berriai-1-1-onboarding-litellm-hosted-version)
- [Community Discord 💭](https://discord.gg/wuPM9dRgDw)
- Our emails ✉️ ishaan@berri.ai / krrish@berri.ai
