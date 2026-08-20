import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Arize Phoenix

[Arize Phoenix](https://arize.com/phoenix/) is the open-source LLM tracing and evaluation project from [Arize AI](https://arize.com/?utm_source=litellm-docs&utm_medium=partner&utm_campaign=partner-docs&utm_content=phoenix-integration). Use it for local development, experimentation, and self-hosted workflows.

Phoenix is separate from [Arize AX](https://arize.com/products/ax/), the full-featured platform for production teams, AI-native companies, and enterprises, available as managed cloud or enterprise self-hosted deployment. LiteLLM supports both backends, but they use different callbacks, credentials, and endpoints. Use `arize_phoenix` for Phoenix, use `arize` for AX, or enable both when you need to send the same traces to each.

For teams building evaluation loops around LiteLLM traces, Arize's [agent evaluation guide](https://arize.com/guides/ai-agent-handbook/agent-evaluation/) and [LLM evaluation guide](https://arize.com/resources/llm-evaluation/) cover production workflows for tracing failures, evaluating model behavior, and improving agent reliability.

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
os.environ["PHOENIX_API_KEY"] = ""
os.environ["PHOENIX_COLLECTOR_ENDPOINT"] = "https://app.phoenix.arize.com/v1/traces"
os.environ["PHOENIX_PROJECT_NAME"] = ""   # optional, defaults to "default"
# LLM API Keys
os.environ["OPENAI_API_KEY"] = ""

# set arize_phoenix as a callback, litellm will send the data to phoenix
litellm.callbacks = ["arize_phoenix"]

# openai call
response = litellm.completion(
  model="gpt-4o",
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
  - model_name: gpt-4o
    litellm_params:
      model: openai/gpt-4o
      api_key: os.environ/OPENAI_API_KEY

litellm_settings:
  callbacks: ["arize_phoenix"]
```

2. Set your credentials

```shell
LITELLM_OTEL_V2=true
PHOENIX_API_KEY="your-api-key"
PHOENIX_COLLECTOR_ENDPOINT="https://app.phoenix.arize.com/v1/traces"
PHOENIX_PROJECT_NAME="my-project"   # optional
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

## What Phoenix renders

Open Phoenix; the project comes from `PHOENIX_PROJECT_NAME` (default `default`), stamped as the `openinference.project.name` resource attribute. Each request shows up as a `chat <model>` span under the request root.

Phoenix uses the same OpenInference vocabulary as Arize AX, so the LLM-call span carries `llm.model_name`, `llm.provider`, the `llm.token_count.*` usage split, `llm.invocation_parameters`, the message arrays when content capture is on, and `llm.tools.*`, alongside the canonical `gen_ai.*` keys. See the [full attribute table](./opentelemetry_v2#seeing-your-traces).

![LiteLLM trace in Phoenix](/img/observability/otel_v2_phoenix.png)

## Configuration

| Variable | Required | Notes |
|---|---|---|
| `PHOENIX_API_KEY` | Phoenix Cloud only | Required when the endpoint is on `app.phoenix.arize.com`; litellm raises without it. Self-hosted Phoenix does not need one |
| `PHOENIX_COLLECTOR_HTTP_ENDPOINT` | No | Collector endpoint; takes precedence over `PHOENIX_COLLECTOR_ENDPOINT` when both are set |
| `PHOENIX_COLLECTOR_ENDPOINT` | No | Collector endpoint, used when the HTTP variable is unset |
| `PHOENIX_PROJECT_NAME` | No | Defaults to `default`; also readable as `PHOENIX_COLLECTOR_PROJECT_NAME` |

If neither endpoint variable is set, litellm falls back to `http://localhost:6006/v1/traces`.

### Protocol is inferred from the endpoint, not the variable name

Neither variable is tied to a protocol. litellm picks the protocol from the value you give it: an endpoint starting with `grpc://`, or containing `:4317` without a `/v1/traces` path, exports over gRPC, and anything else exports over HTTP. So a Phoenix Cloud URL works in either variable, and pointing `PHOENIX_COLLECTOR_ENDPOINT` at `https://app.phoenix.arize.com/v1/traces` sends over HTTP as intended.

### Picking the right collector endpoint

Phoenix has more than one collector endpoint shape, and picking the wrong one is the most common Phoenix setup mistake. Point the endpoint at the shape that matches your deployment:

| Deployment | Endpoint |
|---|---|
| Phoenix Cloud (Spaces) | `https://app.phoenix.arize.com/s/<space-name>/v1/traces` |
| Phoenix Cloud (legacy) | `https://app.phoenix.arize.com/legacy/v1/traces` |
| Phoenix Cloud (old) | `https://app.phoenix.arize.com/v1/traces` |
| Self-hosted | `http://localhost:6006/v1/traces` |

## Advanced

### Send to Phoenix and Arize AX at once

Presets compose, so you can run both backends from one proxy:

```yaml
litellm_settings:
  callbacks: ["arize_phoenix", "arize"]
```

## Full OpenTelemetry reference

This page covers the Phoenix-specific setup. For span attributes, prompt and response capture, metrics, distributed tracing, and which routes are traced, see the [OpenTelemetry v2 guide](./opentelemetry_v2).

Looking for prompt management rather than tracing? See [Arize Phoenix Prompt Management](../proxy/arize_phoenix_prompts).

## Support & Talk to Founders

- [Schedule Demo 👋](https://calendly.com/d/4mp-gd3-k5k/berriai-1-1-onboarding-litellm-hosted-version)
- [Community Discord 💭](https://discord.gg/wuPM9dRgDw)
- Our emails ✉️ ishaan@berri.ai / krrish@berri.ai
