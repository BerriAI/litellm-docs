import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# LangWatch

LLM observability, evaluations and agent simulations, at [langwatch.ai](https://langwatch.ai/). LangWatch is [open source](https://github.com/langwatch/langwatch) and can be used in the cloud or self-hosted.

LiteLLM sends traces to LangWatch through the [OpenTelemetry v2](./opentelemetry_v2) `langwatch` preset. LangWatch reads the OpenTelemetry GenAI semantic conventions natively, so no extra setup is needed on the LangWatch side.

:::info
We want to learn how we can make the callbacks better! Meet the LiteLLM [founders](https://calendly.com/d/4mp-gd3-k5k/berriai-1-1-onboarding-litellm-hosted-version) or
join our [discord](https://discord.gg/wuPM9dRgDw)
:::

## Pre-Requisites

```shell
uv add litellm
```

Get your API key from your project settings on [app.langwatch.ai](https://app.langwatch.ai) (or on your self-hosted LangWatch).

## Quick Start

<Tabs>
<TabItem value="python" label="SDK">

```python
import litellm
import os

os.environ["LITELLM_OTEL_V2"] = "true"
os.environ["LANGWATCH_API_KEY"] = ""
# LLM API Keys
os.environ["OPENAI_API_KEY"] = ""

# set langwatch as a callback, litellm will send the data to langwatch
litellm.callbacks = ["langwatch"]

# openai call
response = litellm.completion(
  model="{{openai_large}}",
  messages=[
    {"role": "user", "content": "Hi 👋 - i'm openai"}
  ]
)
```

</TabItem>
<TabItem value="proxy" label="LiteLLM Proxy">

1. Setup config.yaml

```yaml
model_list:
  - model_name: {{openai_large}}
    litellm_params:
      model: openai/{{openai_large}}
      api_key: os.environ/OPENAI_API_KEY

litellm_settings:
  callbacks: ["langwatch"]
```

2. Set your credentials

```shell
LITELLM_OTEL_V2=true
LANGWATCH_API_KEY="your-api-key"
LANGWATCH_ENDPOINT="https://app.langwatch.ai"   # optional: your self-hosted LangWatch URL
```

3. Start LiteLLM Proxy

```bash
litellm --config /path/to/config.yaml
```

4. Test it!

```bash
curl -L -X POST 'http://0.0.0.0:4000/v1/chat/completions' \
-H 'Content-Type: application/json' \
-H "Authorization: Bearer $LITELLM_API_KEY" \
-d '{
  "model": "{{openai_large}}",
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

## What LangWatch renders

Open your LangWatch project and go to the Traces view. Each request shows up as a trace with the `chat <model>` span inside it, carrying the model, provider, token usage and cost from the canonical `gen_ai.*` keys; see [Span attributes](./opentelemetry_v2#span-attributes) for the full list.

Prompts and responses are only captured if you opt in. To see them in LangWatch, set:

```shell
OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT="span_only"
```

See [Capturing prompts & responses](./opentelemetry_v2#capturing-prompts--responses) for the other modes.

## Configuration

| Variable | Required | Notes |
|---|---|---|
| `LANGWATCH_API_KEY` | Yes | Sent as `Authorization: Bearer <key>`. Traces land in the LangWatch project the key belongs to |
| `LANGWATCH_ENDPOINT` | No | Base URL of your LangWatch, default `https://app.langwatch.ai`. The preset appends `/api/otel/v1/traces` |

The integration raises at startup if `LANGWATCH_API_KEY` is missing. To label spans with an environment, set `OTEL_ENVIRONMENT_NAME`, which stamps `deployment.environment` on every span.

## Full OpenTelemetry reference

This page covers the LangWatch-specific setup. For span attributes, prompt and response capture, metrics, distributed tracing, and which routes are traced, see the [OpenTelemetry v2 guide](./opentelemetry_v2).

## Support & Talk to Founders

- [Schedule Demo 👋](https://calendly.com/d/4mp-gd3-k5k/berriai-1-1-onboarding-litellm-hosted-version)
- [Community Discord 💭](https://discord.gg/wuPM9dRgDw)
- Our emails ✉️ ishaan@berri.ai / krrish@berri.ai
