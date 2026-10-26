# telemetry.dev

Send LiteLLM traces to [telemetry.dev](https://telemetry.dev) with the built-in `telemetry_dev` callback. The integration uses OTLP/HTTP protobuf and sends spans to `https://ingest.telemetry.dev/v1/traces`.

## Prerequisites

1. Create a telemetry.dev project.
2. Copy its project API key. Project keys start with `td_live_`.
3. Install LiteLLM with its proxy dependencies:

```shell
pip install 'litellm[proxy]'
```

## Configure the callback

Set the project API key in your environment:

```shell
export TELEMETRY_DEV_API_KEY="td_live_..."
```

Then add `telemetry_dev` to LiteLLM's callbacks.

### Python SDK

```python
import litellm

litellm.callbacks = ["telemetry_dev"]

response = litellm.completion(
    model="openai/gpt-4o-mini",
    messages=[{"role": "user", "content": "Hello"}],
)
```

### LiteLLM Proxy

```yaml title="config.yaml"
litellm_settings:
  callbacks: ["telemetry_dev"]
```

Start the proxy with the same environment variable available to the process:

```shell
litellm --config /path/to/config.yaml
```

## Configuration

| Variable | Required | Description |
| --- | --- | --- |
| `TELEMETRY_DEV_API_KEY` | Yes | telemetry.dev project API key. Sent as the OTLP `Authorization: Bearer <key>` header. |
| `TELEMETRY_DEV_BASE_URL` | No | Overrides the default ingest base URL, `https://ingest.telemetry.dev`. LiteLLM appends `/v1/traces`. |

telemetry.dev normalizes OpenTelemetry GenAI semantic convention attributes into model, provider, token, and latency fields. It computes cost server-side from the model and token usage.

