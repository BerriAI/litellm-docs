import Image from '@theme/IdealImage';
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# OpenTelemetry - Tracing LLMs with any observability tool

OpenTelemetry is a CNCF standard for observability. It connects to any observability tool, such as Jaeger, Zipkin, Datadog, New Relic, Traceloop, Levo AI and others.

<Image img={require('../../img/traceloop_dash.png')} />

:::note Change in v1.81.0

From v1.81.0, the request/response will be set as attributes on the parent "Received Proxy Server Request" span by default. This allows you to see the request/response in the parent span in your observability tool.

**Note:** When making multiple LLM calls within an external OTEL span context, the last call's attributes will overwrite previous calls' attributes on the parent span.

To use the older behavior with nested "litellm_request" spans (which creates separate spans for each call), set the following environment variable:

```shell
USE_OTEL_LITELLM_REQUEST_SPAN=true
```

:::

## Getting Started

Install the OpenTelemetry SDK:

```
uv add opentelemetry-api opentelemetry-sdk opentelemetry-exporter-otlp
```

Set the environment variables (different providers may require different variables):


<Tabs>

<TabItem value="traceloop" label="Log to Traceloop Cloud">

```shell
OTEL_EXPORTER="otlp_http"
OTEL_ENDPOINT="https://api.traceloop.com"
OTEL_HEADERS="Authorization=Bearer%20<your-api-key>"
```

</TabItem>

<TabItem value="otel-col" label="Log to OTEL HTTP Collector">

```shell
OTEL_EXPORTER_OTLP_ENDPOINT="http://0.0.0.0:4318"
OTEL_EXPORTER_OTLP_PROTOCOL=http/json
OTEL_EXPORTER_OTLP_HEADERS="api-key=key,other-config-value=value"
```

</TabItem>

<TabItem value="otel-col-grpc" label="Log to OTEL GRPC Collector">

```shell
OTEL_EXPORTER_OTLP_ENDPOINT="http://0.0.0.0:4318"
OTEL_EXPORTER_OTLP_PROTOCOL=grpc
OTEL_EXPORTER_OTLP_HEADERS="api-key=key,other-config-value=value"
```

> Note: OTLP gRPC requires `grpcio`. Install via `uv add "litellm[grpc]"` (or `grpcio`).

</TabItem>

<TabItem value="laminar" label="Log to Laminar">

```shell
OTEL_EXPORTER="otlp_grpc"
OTEL_ENDPOINT="https://api.lmnr.ai:8443"
OTEL_HEADERS="authorization=Bearer <project-api-key>"
```

> Note: OTLP gRPC requires `grpcio`. Install via `uv add "litellm[grpc]"` (or `grpcio`).

</TabItem>

<TabItem value="splunk" label="Splunk Observability Cloud">

```shell
OTEL_EXPORTER_OTLP_ENDPOINT="https://ingest.<realm>.observability.splunkcloud.com/v2/trace/otlp"
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
OTEL_EXPORTER_OTLP_HEADERS="X-SF-Token=<your-ingest-access-token>"
OTEL_SERVICE_NAME="litellm-proxy"
```

For **LiteLLM Proxy** setup, ingest token patterns, and trace verification, see **[Splunk Observability Cloud (OpenTelemetry)](/docs/observability/splunk_observability_cloud)**.

</TabItem>

</Tabs>

Use just 1 line of code, to instantly log your LLM responses **across all providers** with OpenTelemetry:

```python
litellm.callbacks = ["otel"]
```

## Running Multiple OpenTelemetry Handlers

You can run more than one OpenTelemetry handler in the same process, for example a generic OTLP exporter alongside a backend-specific subclass. Set `skip_set_global=True` on every handler past the first so each one gets its own private `TracerProvider`, `MeterProvider`, and `LoggerProvider`. Spans, metrics, and log events then flow only through that handler's exporter.

```python
import litellm
from litellm.integrations.opentelemetry import OpenTelemetry, OpenTelemetryConfig

# Primary handler. Claims the global TracerProvider.
primary = OpenTelemetry(config=OpenTelemetryConfig(
    exporter="otlp_http",
    endpoint="https://your-collector/v1/traces",
))

# Secondary handler. Has its own private providers.
secondary = OpenTelemetry(config=OpenTelemetryConfig(
    exporter="otlp_http",
    endpoint="https://second-collector/v1/traces",
    skip_set_global=True,
))

litellm.callbacks = [primary, secondary]
```

Init order does not matter. Both handlers receive their own spans regardless of which is constructed first.

## Capturing Message Content

LiteLLM honors the standard `OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT` environment variable to control whether prompts and completions are captured, and where:

```shell
# Do not capture message content
OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT=NO_CONTENT

# Capture content on span attributes only
OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT=SPAN_ONLY

# Capture content on event attributes only
OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT=EVENT_ONLY

# Capture content on both spans and events
OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT=SPAN_AND_EVENT
```

The legacy boolean form is also accepted: `true` maps to `EVENT_ONLY`, `false` maps to `NO_CONTENT`.

### Per-handler content policy

When running multiple OpenTelemetry handlers, set `capture_message_content` on each `OpenTelemetryConfig` so the handlers can have different content policies. For example, send full prompts to a debugging backend while stripping content from a compliance-focused OTLP collector:

```python
import litellm
from litellm.integrations.opentelemetry import OpenTelemetry, OpenTelemetryConfig

stripped = OpenTelemetry(config=OpenTelemetryConfig(
    exporter="otlp_http",
    endpoint="https://compliance-collector/v1/traces",
    capture_message_content="NO_CONTENT",
))

verbose = OpenTelemetry(config=OpenTelemetryConfig(
    exporter="otlp_http",
    endpoint="https://debug-collector/v1/traces",
    capture_message_content="SPAN_AND_EVENT",
    skip_set_global=True,
))

litellm.callbacks = [stripped, verbose]
```

The per-handler `capture_message_content` field overrides the env var. If neither is set, behavior falls back to the legacy `litellm.turn_off_message_logging` kill-switch (see the section below). When `litellm.turn_off_message_logging=True`, content is suppressed regardless of the per-handler setting.

## Opt-In to Latest GenAI Semantic Conventions

Set `OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental` to emit spans that follow the [latest OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/):

```shell
OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental
```

With the flag set:

- The LLM-call span is named `{operation} {model}` (for example, `chat gpt-4` or `embeddings text-embedding-3-small`) instead of `litellm_request`.
- Span kind is `CLIENT` instead of `INTERNAL`.
- The non-standard `raw_gen_ai_request` child span is suppressed.
- `gen_ai.provider.name` is emitted alongside the legacy `gen_ai.system` attribute.
- Request parameters (`gen_ai.request.frequency_penalty`, `presence_penalty`, `top_k`, `seed`, `stop_sequences`, `stream`, `choice.count`) and cache-token usage (`gen_ai.usage.cache_creation.input_tokens`, `gen_ai.usage.cache_read.input_tokens`) are emitted when present.
- The legacy per-message and per-choice events are replaced by a single `gen_ai.client.inference.operation.details` event carrying `gen_ai.input.messages` and `gen_ai.output.messages` arrays.

`OpenTelemetryConfig.semconv_stability` is the programmatic equivalent. The flag is comma-separable per the OTEL spec.

Default behavior is unchanged when the variable is unset, so existing dashboards keep working. Setting the flag aligns LiteLLM with what other OTEL Python GenAI instrumentations (`opentelemetry-instrumentation-openai-v2`, Google GenAI, etc.) emit.

## Redacting Messages, Response Content from OpenTelemetry Logging

### Redact Messages and Responses from all OpenTelemetry Logging

Set `litellm.turn_off_message_logging=True` This will prevent the messages and responses from being logged to OpenTelemetry, but request metadata will still be logged.

### Redact Messages and Responses from specific OpenTelemetry Logging

In the metadata typically passed for text completion or embedding calls you can set specific keys to mask the messages and responses for this call.

Setting `mask_input` to `True` will mask the input from being logged for this call

Setting `mask_output` to `True` will make the output from being logged for this call.

Be aware that if you are continuing an existing trace, and you set `update_trace_keys` to include either `input` or `output` and you set the corresponding `mask_input` or `mask_output`, then that trace will have its existing input and/or output replaced with a redacted message.

## Support

For any question or issue with the integration you can reach out to the OpenLLMetry maintainers on [Slack](https://traceloop.com/slack) or via [email](mailto:dev@traceloop.com).

## Troubleshooting

### Trace LiteLLM Proxy user/key/org/team information on failed requests

LiteLLM emits the user_api_key_metadata
- key hash
- key_alias
- org_id
- user_id
- team_id

for successful + failed requests

click under `litellm_request` in the trace

<Image img={require('../../img/otel_debug_trace.png')} />

### Not seeing traces land on Integration

If you don't see traces landing on your integration, set `OTEL_DEBUG="True"` in your LiteLLM environment and try again.

```shell
export OTEL_DEBUG="True"
```

This will emit any logging issues to the console.
