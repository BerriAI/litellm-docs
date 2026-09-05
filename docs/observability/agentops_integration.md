import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# AgentOps

Observability and DevTool platform for AI agents, at [agentops.ai](https://www.agentops.ai/).

:::info
We want to learn how we can make the callbacks better! Meet the LiteLLM [founders](https://calendly.com/d/4mp-gd3-k5k/berriai-1-1-onboarding-litellm-hosted-version) or
join our [discord](https://discord.gg/wuPM9dRgDw)
:::

## Pre-Requisites

```shell
uv add litellm
```

## Quick Start

<Tabs>
<TabItem value="python" label="SDK">

```python
import litellm
import os

os.environ["LITELLM_OTEL_V2"] = "true"
os.environ["AGENTOPS_API_KEY"] = ""
# LLM API Keys
os.environ["OPENAI_API_KEY"] = ""

# set agentops as a callback, litellm will send the data to agentops
litellm.callbacks = ["agentops"]

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
  callbacks: ["agentops"]
```

2. Set your credentials

```shell
LITELLM_OTEL_V2=true
AGENTOPS_API_KEY="your-api-key"
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

## What AgentOps renders

Open the AgentOps dashboard. AgentOps does not add a vendor mapper, so spans arrive in the canonical `gen_ai.*` schema; see [Span attributes](./opentelemetry_v2#span-attributes) for the full list of keys.

The preset sets three resource-level labels on the traces: `service.name` from `AGENTOPS_SERVICE_NAME`, a fixed `telemetry.sdk.name` of `agentops`, and `deployment.environment` from `AGENTOPS_ENVIRONMENT` when you set it. AgentOps routes the trace by the project encoded in the auth token, so the project never appears as a resource attribute.

![LiteLLM trace in AgentOps](/img/observability/otel_v2_agentops.png)

## Configuration

| Variable | Required | Notes |
|---|---|---|
| `AGENTOPS_API_KEY` | Yes | Exchanged for a short-lived JWT |
| `AGENTOPS_SERVICE_NAME` | No | Defaults to `agentops` |
| `AGENTOPS_ENVIRONMENT` | No | No default; `deployment.environment` is only stamped when you set it |

Traces are sent to `https://otlp.agentops.ai/v1/traces`.

## Good to know

AgentOps mints its auth token on the first span export rather than at startup, so the very first export can look briefly delayed. This happens once per process and is expected; the token is then cached for the process lifetime.

Set `AGENTOPS_SERVICE_NAME` and `AGENTOPS_ENVIRONMENT` if you want to separate environments in the AgentOps UI.

## Full OpenTelemetry reference

This page covers the AgentOps-specific setup. For span attributes, prompt and response capture, metrics, distributed tracing, and which routes are traced, see the [OpenTelemetry v2 guide](./opentelemetry_v2).

## Support & Talk to Founders

- [Schedule Demo 👋](https://calendly.com/d/4mp-gd3-k5k/berriai-1-1-onboarding-litellm-hosted-version)
- [Community Discord 💭](https://discord.gg/wuPM9dRgDw)
- Our emails ✉️ ishaan@berri.ai / krrish@berri.ai
