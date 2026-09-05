import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Levo

API and LLM security testing and observability, at [levo.ai](https://levo.ai/).

:::info
We want to learn how we can make the callbacks better! Meet the LiteLLM [founders](https://calendly.com/d/4mp-gd3-k5k/berriai-1-1-onboarding-litellm-hosted-version) or
join our [discord](https://discord.gg/wuPM9dRgDw)
:::

## Pre-Requisites

```shell
uv add litellm
```

You need a Levo collector URL in addition to your API key. Contact Levo support if you do not have one.

## Quick Start

<Tabs>
<TabItem value="python" label="SDK">

```python
import litellm
import os

os.environ["LITELLM_OTEL_V2"] = "true"
os.environ["LEVOAI_API_KEY"] = ""
os.environ["LEVOAI_ORG_ID"] = ""
os.environ["LEVOAI_WORKSPACE_ID"] = ""
os.environ["LEVOAI_COLLECTOR_URL"] = ""
# LLM API Keys
os.environ["OPENAI_API_KEY"] = ""

# set levo as a callback, litellm will send the data to levo
litellm.callbacks = ["levo"]

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
  callbacks: ["levo"]
```

2. Set your credentials

```shell
LITELLM_OTEL_V2=true
LEVOAI_API_KEY="your-api-key"
LEVOAI_ORG_ID="your-org-id"
LEVOAI_WORKSPACE_ID="your-workspace-id"
LEVOAI_COLLECTOR_URL="your-levo-collector-url"   # contact Levo support for this
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

## What Levo renders

Open the Levo dashboard. Levo does not add a vendor mapper, so spans arrive in the canonical `gen_ai.*` schema; see [Span attributes](./opentelemetry_v2#span-attributes) for the full list of keys.

The preset routes spans to `LEVOAI_COLLECTOR_URL` with `Authorization: Bearer $LEVOAI_API_KEY`, plus `x-levo-organization-id` and `x-levo-workspace-id` headers built from `LEVOAI_ORG_ID` and `LEVOAI_WORKSPACE_ID`.

## Configuration

| Variable | Required | Notes |
|---|---|---|
| `LEVOAI_API_KEY` | Yes | |
| `LEVOAI_ORG_ID` | Yes | |
| `LEVOAI_WORKSPACE_ID` | Yes | |
| `LEVOAI_COLLECTOR_URL` | Yes | Used as-is with no path manipulation, so provide the exact URL Levo gave you |

All four are validated at startup; the integration raises if any is missing. To label spans with an environment, set `OTEL_ENVIRONMENT_NAME`, which stamps `deployment.environment` on every span.

## Full OpenTelemetry reference

This page covers the Levo-specific setup. For span attributes, prompt and response capture, metrics, distributed tracing, and which routes are traced, see the [OpenTelemetry v2 guide](./opentelemetry_v2).

## Support & Talk to Founders

- [Schedule Demo 👋](https://calendly.com/d/4mp-gd3-k5k/berriai-1-1-onboarding-litellm-hosted-version)
- [Community Discord 💭](https://discord.gg/wuPM9dRgDw)
- Our emails ✉️ ishaan@berri.ai / krrish@berri.ai
