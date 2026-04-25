import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Splunk Observability Cloud (OpenTelemetry)

Send LiteLLM traces to [Splunk Observability Cloud](https://www.splunk.com/en_us/products/observability-cloud.html) using the built-in **`otel`** callback and standard OpenTelemetry OTLP environment variables.

LiteLLM uses the same OpenTelemetry path as the [OpenTelemetry integration](./opentelemetry_integration.md). Splunk’s OTLP/HTTP trace ingest URL uses **`/v2/trace/otlp`** (not **`/v1/traces`**); LiteLLM normalizes generic collector URLs but **preserves** Splunk-style `/v2/trace/otlp` endpoints so spans reach Splunk correctly.

## Video walkthrough

<iframe width="840" height="500" src="https://www.loom.com/embed/9dc21b753bbe4f6fb3c1b44c06e39c20" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen title="LiteLLM Splunk Observability Cloud OTEL demo"></iframe>

Or [watch on Loom](https://www.loom.com/share/9dc21b753bbe4f6fb3c1b44c06e39c20).

## Prerequisites

1. Splunk Observability Cloud account and an **ingest access token** (used as `X-SF-Token`).
2. Your **realm** (for example `eu1`, `us0`) from the Splunk Observability Cloud UI or docs.
3. OpenTelemetry OTLP packages (same as the main OTEL guide):

```shell
uv add opentelemetry-api opentelemetry-sdk opentelemetry-exporter-otlp
```

## Environment variables

LiteLLM reads configuration via `OpenTelemetryConfig.from_env()` (see [`opentelemetry.py` in the LiteLLM repo](https://github.com/BerriAI/litellm/blob/main/litellm/integrations/opentelemetry.py)).

| Purpose | Variable |
|--------|----------|
| Trace ingest URL (Splunk OTLP/HTTP) | `OTEL_EXPORTER_OTLP_ENDPOINT` — e.g. `https://ingest.<realm>.observability.splunkcloud.com/v2/trace/otlp` |
| Auth | `OTEL_EXPORTER_OTLP_HEADERS` or `OTEL_HEADERS` — e.g. `X-SF-Token=<your-access-token>` (comma-separated `key=value` pairs for multiple headers) |
| Protocol | `OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf` for OTLP/HTTP (use `grpc` only if you target a gRPC OTLP endpoint) |
| Optional resource naming | `OTEL_SERVICE_NAME`, `OTEL_ENVIRONMENT_NAME`, etc. |

**Precedence:** `OTEL_EXPORTER_OTLP_PROTOCOL` is read before legacy `OTEL_EXPORTER`. If both are set, the OTLP protocol variable wins. `OTEL_EXPORTER_OTLP_ENDPOINT` is preferred over `OTEL_ENDPOINT` when both are set.

:::warning Sensitive data in traces

OpenTelemetry spans may include request/response content and metadata. Review [redacting messages and responses](/docs/observability/opentelemetry_integration#redacting-messages-response-content-from-opentelemetry-logging) and [scrubbing / PII guidance](/docs/observability/scrub_data) before enabling full payloads in production.

:::

## LiteLLM Proxy

<Tabs>
<TabItem value="yaml" label="config.yaml">

```yaml
model_list:
  - model_name: gpt-4o-mini
    litellm_params:
      model: gpt-4o-mini
      api_key: os.environ/OPENAI_API_KEY

litellm_settings:
  callbacks: ["otel"]

general_settings:
  master_key: sk-1234

environment_variables:
  OTEL_EXPORTER_OTLP_ENDPOINT: "https://ingest.eu1.observability.splunkcloud.com/v2/trace/otlp"
  OTEL_EXPORTER_OTLP_PROTOCOL: "http/protobuf"
  OTEL_EXPORTER_OTLP_HEADERS: "os.environ/SPLUNK_OTEL_HEADERS"
  OTEL_SERVICE_NAME: "litellm-proxy"
```

Point `SPLUNK_OTEL_HEADERS` (or inline the header string) at a secret that expands to `X-SF-Token=<token>`.

</TabItem>
<TabItem value="env" label=".env (example)">

```dotenv
SPLUNK_ACCESS_TOKEN=your-ingest-access-token

OTEL_EXPORTER_OTLP_ENDPOINT=https://ingest.eu1.observability.splunkcloud.com/v2/trace/otlp
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
OTEL_EXPORTER_OTLP_HEADERS=X-SF-Token=${SPLUNK_ACCESS_TOKEN}
OTEL_SERVICE_NAME=litellm-proxy
```

Load these into the process environment before starting the proxy (for example `export` / systemd / Kubernetes secrets).

</TabItem>
</Tabs>

Start the proxy:

```bash
litellm --config /path/to/config.yaml
```

## Python SDK

```python
import os
import litellm

os.environ["OTEL_EXPORTER_OTLP_ENDPOINT"] = (
    "https://ingest.eu1.observability.splunkcloud.com/v2/trace/otlp"
)
os.environ["OTEL_EXPORTER_OTLP_PROTOCOL"] = "http/protobuf"
os.environ["OTEL_EXPORTER_OTLP_HEADERS"] = "X-SF-Token=your-ingest-access-token"
os.environ["OTEL_SERVICE_NAME"] = "my-app"

litellm.callbacks = ["otel"]

response = litellm.completion(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Hello"}],
)
```

## Verify traces

1. In Splunk Observability Cloud, open **APM** / **Traces** (product names may vary by version).
2. Filter by service name (`OTEL_SERVICE_NAME`, default `litellm` if unset).
3. Optionally set `OTEL_DEBUG=True` in LiteLLM’s environment to surface exporter issues in logs (see [OpenTelemetry troubleshooting](/docs/observability/opentelemetry_integration#not-seeing-traces-land-on-integration)).

## See also

- [OpenTelemetry — Tracing LLMs](./opentelemetry_integration.md)
- [Splunk Observability Cloud — OTLP exporter](https://docs.splunk.com/observability/en/gdi/opentelemetry/opentelemetry.html) (vendor docs)
