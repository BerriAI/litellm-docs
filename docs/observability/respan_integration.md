import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Respan

[Respan](https://www.respan.ai/) (formerly Keywords AI) is an LLM engineering platform for observability, evaluation, and gateway routing. LiteLLM exports traces to Respan over the standard OTLP/HTTP protocol using LiteLLM's built-in OpenTelemetry callback — no Respan-specific package is required.

## Features

- Automatic trace collection for all LiteLLM requests
- Standard OTLP/HTTP transport (JSON or Protobuf)
- Works with both the LiteLLM SDK and the LiteLLM Proxy
- Token usage, cost, latency, and error data captured per call
- Full span hierarchy preserved across nested LLM and tool calls

## Prerequisites

1. **Respan account**: Sign up at [respan.ai](https://www.respan.ai/) and create an API key from your dashboard
2. **Dependencies**: Install LiteLLM and the OpenTelemetry SDK:

   ```bash
   uv add litellm opentelemetry-api opentelemetry-sdk opentelemetry-exporter-otlp
   ```

## Configuration

### Environment variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Yes | Respan OTLP endpoint base URL | `https://api.respan.ai/api` |
| `OTEL_EXPORTER_OTLP_HEADERS` | Yes | Authorization header with your Respan API key | `Authorization=Bearer YOUR_RESPAN_API_KEY` |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | Yes | OTLP transport format | `http/json` (or `http/protobuf`) |

Respan accepts traces at `/api/v2/traces`. The OpenTelemetry SDK appends `/v1/traces` to the configured endpoint by default; Respan handles the path mapping automatically when the base endpoint is set to `https://api.respan.ai/api`.

## Usage

### Basic setup (SDK)

```python
import os
import litellm

# Respan OTLP configuration
os.environ["OTEL_EXPORTER_OTLP_ENDPOINT"] = "https://api.respan.ai/api"
os.environ["OTEL_EXPORTER_OTLP_HEADERS"] = "Authorization=Bearer YOUR_RESPAN_API_KEY"
os.environ["OTEL_EXPORTER_OTLP_PROTOCOL"] = "http/json"

# Enable LiteLLM's built-in OpenTelemetry callback
litellm.callbacks = ["otel"]

# Make LLM requests as usual
response = litellm.completion(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Hello!"}],
)
```

Traces appear in the [Respan traces page](https://platform.respan.ai/platform/traces) with model, input, output, token usage, cost, and latency.

### With LiteLLM Proxy

1. Set the credentials in your environment:

   ```bash
   export OTEL_EXPORTER_OTLP_ENDPOINT="https://api.respan.ai/api"
   export OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer YOUR_RESPAN_API_KEY"
   export OTEL_EXPORTER_OTLP_PROTOCOL="http/json"
   ```

2. Enable the OTel callback in `config.yaml`:

   ```yaml
   # config.yaml
   litellm_settings:
     callbacks: ["otel"]
   ```

3. Run the proxy:

   ```bash
   litellm --config /path/to/config.yaml
   ```

### Attaching metadata

Pass any key in `metadata` and it is exported as a span attribute. Respan reads standard fields automatically:

```python
response = litellm.completion(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Hello!"}],
    metadata={
        "generation_name": "welcome-message",
        "trace_id": "trace-123",
        "session_id": "sess-42",
        "user_id": "alice",
        "tags": ["prod", "beta-user"],
    },
)
```

## Data collected

The integration automatically collects:

- **Request details**: model, messages, parameters (temperature, max_tokens, etc.)
- **Response details**: generated content, token usage, finish reason
- **Timing information**: total request duration and time to first token
- **Cost**: derived from token usage and model pricing
- **Errors**: exception type, message, and stack trace when calls fail

## Troubleshooting

### Authentication errors

A `401` response from `api.respan.ai` indicates the Bearer token is missing or invalid. Verify that `OTEL_EXPORTER_OTLP_HEADERS` is set exactly as `Authorization=Bearer YOUR_RESPAN_API_KEY` (no extra spaces, no quoting issues) and that the key has not been revoked in the Respan dashboard.

### Traces not appearing

Enable verbose logging to inspect endpoint resolution and OTLP submission:

<Tabs>
<TabItem value="sdk" label="SDK">

```python
import litellm
litellm._turn_on_debug()
```

</TabItem>
<TabItem value="proxy" label="PROXY">

```bash
export LITELLM_LOG="DEBUG"
```

</TabItem>
</Tabs>

## Related links

- [Respan documentation](https://www.respan.ai/docs/documentation/get-started/overview)
- [Respan + OpenTelemetry guide](https://www.respan.ai/docs/integrations/opentelemetry)
- [Respan + LiteLLM integration page](https://www.respan.ai/docs/integrations/litellm)
- [LiteLLM OpenTelemetry callback](/docs/observability/opentelemetry_integration)
