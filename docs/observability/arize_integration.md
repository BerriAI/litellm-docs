import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Arize AX

Use Arize AX when you want the full-featured [Arize AI](https://arize.com/?utm_source=litellm-docs&utm_medium=partner&utm_campaign=partner-docs&utm_content=arize-ax-integration) platform for production LLM observability and evaluation, available as managed cloud or enterprise self-hosted deployment.

Arize AX is separate from [Arize Phoenix](https://arize.com/phoenix/), the open-source tracing and evaluation project for local development, experimentation, and self-hosted workflows. LiteLLM supports both backends, but they use different callbacks, credentials, and endpoints. If you are sending traces to Phoenix, use the [Arize Phoenix setup guide](./phoenix_integration) instead.

For production evaluation workflows, see Arize's [agent evaluation guide](https://arize.com/guides/ai-agent-handbook/agent-evaluation/) and [LLM evaluation guide](https://arize.com/resources/llm-evaluation/) for examples of using traces to debug failures, compare model behavior, and improve agent reliability.

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
os.environ["ARIZE_SPACE_ID"] = ""
os.environ["ARIZE_API_KEY"] = ""
os.environ["ARIZE_PROJECT_NAME"] = ""   # recommended: names the project traces land in
# LLM API Keys
os.environ["OPENAI_API_KEY"] = ""

# set arize as a callback, litellm will send the data to arize
litellm.callbacks = ["arize"]

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
  callbacks: ["arize"]
```

2. Set your credentials

```shell
LITELLM_OTEL_V2=true
ARIZE_SPACE_ID="your-space-id"
ARIZE_API_KEY="your-api-key"
ARIZE_PROJECT_NAME="your-project-name"   # recommended: names the project traces land in
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

## What Arize renders

Open your Arize project; the trace appears under the project named by `ARIZE_PROJECT_NAME`. Each request shows up as a `chat <model>` span under the request root.

The `openinference` mapper stamps the OpenInference vocabulary onto the LLM-call span alongside the canonical `gen_ai.*` keys, so Arize reads its native schema without dropping the canonical ones. That covers `llm.model_name` and `llm.provider`, the `llm.token_count.*` usage split, `llm.invocation_parameters`, the `llm.input_messages.*` and `llm.output_messages.*` message arrays when content capture is on, and `llm.tools.*` for tool definitions. See the [full attribute table](./opentelemetry_v2#seeing-your-traces) or the [OpenInference spec](https://github.com/Arize-ai/openinference/blob/main/spec/semantic_conventions.md) for the definitive vocabulary.

![LiteLLM trace in Arize](/img/observability/otel_v2_arize.png)

## Configuration

| Variable | Required | Notes |
|---|---|---|
| `ARIZE_SPACE_ID` | Yes | `ARIZE_SPACE_KEY` is the deprecated name and is still read for backward compatibility; prefer `ARIZE_SPACE_ID` in new configs |
| `ARIZE_API_KEY` | Yes | |
| `ARIZE_PROJECT_NAME` | No | Names the project traces land in. Nothing enforces it and spans are not rejected without it, but set it so your traces are grouped where you expect |
| `ARIZE_ENDPOINT` | No | gRPC endpoint, defaults to `https://otlp.arize.com/v1` |
| `ARIZE_HTTP_ENDPOINT` | No | Use instead of `ARIZE_ENDPOINT` to export over HTTP |

Setting `ARIZE_ENDPOINT` selects gRPC and `ARIZE_HTTP_ENDPOINT` selects HTTP; if neither is set, litellm uses the gRPC default.

## Advanced

### Send to Arize and another backend at once

Presets compose, so listing more than one sends the same traces to each destination in that tool's native format:

```yaml
litellm_settings:
  callbacks: ["arize", "langfuse_otel"]
```

### Per-team and per-key credentials {#pass-arize-spacekey-per-request}

Arize supports per-request credentials, so different teams or keys can log to different Arize spaces without running separate proxies. Set `arize_space_id` and `arize_api_key` on the team or key as described in [per-key / per-team credentials](./opentelemetry_v2#per-key--per-team-credentials-multi-tenant).

## Full OpenTelemetry reference

This page covers the Arize-specific setup. For span attributes, prompt and response capture, metrics, distributed tracing, and which routes are traced, see the [OpenTelemetry v2 guide](./opentelemetry_v2).

## Support & Talk to Founders

- [Schedule Demo 👋](https://calendly.com/d/4mp-gd3-k5k/berriai-1-1-onboarding-litellm-hosted-version)
- [Community Discord 💭](https://discord.gg/wuPM9dRgDw)
- Our emails ✉️ ishaan@berri.ai / krrish@berri.ai
