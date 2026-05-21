# Splunk Observability Cloud (OpenTelemetry)

Send LiteLLM traces to [Splunk Observability Cloud](https://www.splunk.com/en_us/products/observability-cloud.html) using the built-in **`otel`** callback and standard OpenTelemetry OTLP environment variables.

LiteLLM uses the same OpenTelemetry path as the [OpenTelemetry integration](./opentelemetry_integration.md). Splunk’s OTLP/HTTP trace ingest URL uses **`/v2/trace/otlp`** (not **`/v1/traces`**); LiteLLM normalizes generic collector URLs but **preserves** Splunk-style `/v2/trace/otlp` endpoints so spans reach Splunk correctly.

## Video walkthrough

<iframe width="840" height="500" src="https://www.loom.com/embed/9dc21b753bbe4f6fb3c1b44c06e39c20" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen title="LiteLLM Splunk Observability Cloud OTEL demo"></iframe>

Or [watch on Loom](https://www.loom.com/share/9dc21b753bbe4f6fb3c1b44c06e39c20).

## Prerequisites

1. Splunk Observability Cloud account and an **ingest access token** (used as `X-SF-Token`).
2. Your **realm** (for example `eu1`, `us0`) from the Splunk Observability Cloud UI or docs.

## LiteLLM Proxy

Same flow as integrations like [Datadog Logs](./datadog#datadog-logs): configure **`config.yaml`**, then set environment variables, then start the proxy.

**Step 1:** In `config.yaml`, enable the OpenTelemetry callback:

```yaml
litellm_settings:
  callbacks: ["otel"]
```

**Step 2:** Set the OTLP environment variables below.

You can load them from the process environment, a `.env` file, or the proxy **`environment_variables`** block in `config.yaml` ([config fields](/docs/proxy/configs)).

| Purpose | Variable |
|--------|----------|
| Trace ingest URL (Splunk OTLP/HTTP) | `OTEL_EXPORTER_OTLP_ENDPOINT` — e.g. `https://ingest.<realm>.observability.splunkcloud.com/v2/trace/otlp` |
| Auth | `OTEL_EXPORTER_OTLP_HEADERS` or `OTEL_HEADERS` — e.g. `X-SF-Token=<your-access-token>` (comma-separated `key=value` pairs for multiple headers) |
| Protocol | `OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf` for OTLP/HTTP (use `grpc` only if you target a gRPC OTLP endpoint) |
| Optional resource naming | `OTEL_SERVICE_NAME`, `OTEL_ENVIRONMENT_NAME`, etc. |

**Precedence:** `OTEL_EXPORTER_OTLP_PROTOCOL` is read before legacy `OTEL_EXPORTER`. If both are set, the OTLP protocol variable wins. `OTEL_EXPORTER_OTLP_ENDPOINT` is preferred over `OTEL_ENDPOINT` when both are set.

```shell
OTEL_EXPORTER_OTLP_ENDPOINT="https://ingest.eu1.observability.splunkcloud.com/v2/trace/otlp"
OTEL_EXPORTER_OTLP_PROTOCOL="http/protobuf"
OTEL_EXPORTER_OTLP_HEADERS="X-SF-Token=<your-ingest-access-token>"
OTEL_SERVICE_NAME="litellm-proxy"
```

**Step 3:** Start the proxy:

```bash
litellm --config /path/to/config.yaml
```

## Verify traces

1. In Splunk Observability Cloud, open **APM** / **Traces** (product names may vary by version).
2. Filter by service name (`OTEL_SERVICE_NAME`, default `litellm` if unset).
3. Optionally set `OTEL_DEBUG=True` in LiteLLM’s environment to surface exporter issues in logs (see [OpenTelemetry troubleshooting](/docs/observability/opentelemetry_integration#not-seeing-traces-land-on-integration)).

## See also

- [OpenTelemetry — Tracing LLMs](./opentelemetry_integration.md)
- [Splunk Observability Cloud — OTLP exporter](https://docs.splunk.com/observability/en/gdi/opentelemetry/opentelemetry.html) (vendor docs)
