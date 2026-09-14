import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Langtrace

Open-source observability and evaluations for LLM applications, at [langtrace.ai](https://langtrace.ai/).

:::info
We want to learn how we can make the callbacks better! Meet the LiteLLM [founders](https://calendly.com/d/4mp-gd3-k5k/berriai-1-1-onboarding-litellm-hosted-version) or
join our [discord](https://discord.gg/wuPM9dRgDw)
:::

## Pre-Requisites

```shell
uv add litellm
```

Langtrace ingests JSON-encoded OTLP at a custom path (`/api/trace`) with an `x-api-key` header, whereas litellm sends protobuf to `/v1/traces`. It therefore cannot receive litellm's spans directly. Run an OpenTelemetry Collector between them: litellm exports to the collector, and the collector re-encodes the spans to JSON and forwards them to Langtrace.

The `langtrace` callback applies Langtrace's attribute schema; the collector only handles delivery. That is why the preset reads no credentials of its own, and `LANGTRACE_API_KEY` lives in the collector's environment rather than the proxy's.

## Quick Start

<Tabs>
<TabItem value="python" label="SDK">

```python
import litellm
import os

os.environ["LITELLM_OTEL_V2"] = "true"
os.environ["OTEL_ENDPOINT"] = "http://otel-collector:4318"
# LLM API Keys
os.environ["OPENAI_API_KEY"] = ""

# set langtrace as a callback, litellm will send the data to langtrace
litellm.callbacks = ["langtrace"]

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
  callbacks: ["langtrace"]
```

2. Point litellm at your collector

```shell
LITELLM_OTEL_V2=true
OTEL_ENDPOINT="http://otel-collector:4318"
```

3. Configure the collector

`otel-collector-config.yaml`, with `LANGTRACE_API_KEY` set in the collector's environment:

```yaml
receivers:
  otlp:
    protocols:
      http:
        endpoint: 0.0.0.0:4318
exporters:
  otlphttp/langtrace:
    encoding: json
    compression: none
    traces_endpoint: https://app.langtrace.ai/api/trace
    headers:
      x-api-key: ${env:LANGTRACE_API_KEY}
      Content-Type: application/json
service:
  pipelines:
    traces:
      receivers: [otlp]
      exporters: [otlphttp/langtrace]
```

4. Start LiteLLM Proxy

```bash
litellm --config /path/to/config.yaml
```

5. Test it!

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

## What Langtrace renders

Open the Langtrace UI; the spans flow through your collector carrying the `langtrace.*` and `llm.*` keys alongside the canonical `gen_ai.*` ones.

The `langtrace` mapper adds `langtrace.service.name` for the provider, request and response identifiers (`llm.model`, `gen_ai.response.model`, `gen_ai.response_id`, `gen_ai.system_fingerprint`), the request params (`llm.temperature`, `top_p`, `top_k`, `max_tokens`, `frequency_penalty`, `presence_penalty`), the `llm.stream` flag, the `llm.token.counts.*` usage split, and `llm.prompts` / `llm.completions` when content capture is on. See the [full attribute table](./opentelemetry_v2#seeing-your-traces).

![LiteLLM trace in Langtrace](/img/observability/otel_v2_langtrace.png)

## Full OpenTelemetry reference

This page covers the Langtrace-specific setup. For span attributes, prompt and response capture, metrics, distributed tracing, and which routes are traced, see the [OpenTelemetry v2 guide](./opentelemetry_v2).

## Support & Talk to Founders

- [Schedule Demo 👋](https://calendly.com/d/4mp-gd3-k5k/berriai-1-1-onboarding-litellm-hosted-version)
- [Community Discord 💭](https://discord.gg/wuPM9dRgDw)
- Our emails ✉️ ishaan@berri.ai / krrish@berri.ai
