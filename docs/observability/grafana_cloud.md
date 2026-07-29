# Grafana Cloud

Send LiteLLM traces and metrics to [Grafana Cloud](https://grafana.com/products/cloud/) over OTLP, and scrape the proxy's operational Prometheus metrics alongside them. Everything here uses LiteLLM's built-in OpenTelemetry and Prometheus support; there is nothing to install on the Grafana side beyond a token

Grafana Cloud accepts OTLP directly, so a single endpoint carries both traces and GenAI metrics and no collector or Alloy agent is required. Reach for the [Prometheus](#prometheus-metrics) path when you also want the operational `litellm_*` metrics, which are exposed for scraping rather than pushed over OTLP

## Prerequisites

- A Grafana Cloud stack
- An access policy token with the `traces:write` and `metrics:write` scopes. Create one from **Connections > Add new connection > OpenTelemetry (OTLP)**, or from **Access Policies** in your Grafana Cloud account
- Your stack's OTLP endpoint and instance ID, shown on that same page. The endpoint looks like `https://otlp-gateway-prod-us-west-0.grafana.net/otlp`; the region in it varies per stack

## Send traces and metrics over OTLP

Grafana Cloud authenticates OTLP with HTTP Basic auth, where the username is your stack's numeric instance ID and the password is the access policy token. Build the credential once:

```shell
echo -n "<instance-id>:<access-policy-token>" | base64
```

Then point LiteLLM at the gateway:

```shell title=".env"
LITELLM_OTEL_V2=true
LITELLM_OTEL_INTEGRATION_ENABLE_METRICS=true

OTEL_EXPORTER="otlp_http"
OTEL_ENDPOINT="https://otlp-gateway-prod-us-west-0.grafana.net/otlp"
OTEL_HEADERS="Authorization=Basic%20<base64-from-above>"
```

```yaml title="config.yaml"
litellm_settings:
  callbacks: ["otel"]
```

Start the proxy and send a request; traces land in Tempo and metrics in the hosted Prometheus, both queryable from Explore

:::info Why `Basic%20` and not `Basic `

`OTEL_HEADERS` follows the OTLP spec, which encodes header values in [W3C Baggage](https://www.w3.org/TR/baggage/#baggage-http-header-format) format, so a space is written `%20`. Grafana Cloud's own setup screens hand you the value in exactly this form. LiteLLM decodes it before the header goes on the wire, so a literal space works too if you prefer to write one

:::

Keep `OTEL_EXPORTER="otlp_http"`. The gateway is an HTTP endpoint, and Grafana Cloud's own setup screens configure OTLP over HTTP

### What Grafana renders

Traces arrive as standard [OpenTelemetry GenAI](https://opentelemetry.io/docs/specs/semconv/gen-ai/) spans, so **Explore**, with Tempo selected, shows a span per LLM call with model, provider, token counts, and latency, nested under the proxy's HTTP server span. LiteLLM stamps a `service.name` resource attribute, so the spans are also grouped by service wherever Grafana keys off it

![LiteLLM traces in Grafana Cloud Tempo](/img/observability/grafana_cloud_traces.png)

Each request is one trace: the server span for the route, an `auth` span, and a `chat <model>` span carrying the GenAI attributes

![gen_ai span attributes on a LiteLLM LLM-call span](/img/observability/grafana_cloud_span_attributes.png)

Metrics arrive as OTLP histograms and are queryable in **Explore**, with your hosted Prometheus selected, under their Prometheus-normalized names:

![LiteLLM GenAI cost metric in Grafana Cloud](/img/observability/grafana_cloud_metrics.png)


| LiteLLM instrument | Queryable as |
|---|---|
| `gen_ai.client.operation.duration` | `gen_ai_client_operation_duration_seconds_bucket` |
| `gen_ai.client.token.usage` | `gen_ai_client_token_usage_bucket` |
| `gen_ai.usage.cost` | `gen_ai_usage_cost_USD_sum` |
| `gen_ai.server.time_to_first_token` | `gen_ai_server_time_to_first_token_seconds_bucket` |

These four are the names Grafana Cloud's **AI Observability** integration dashboards query, so installing that integration from **Connections > Add new connection > AI Observability** points its cost, token, and latency panels at LiteLLM data without building them yourself.

:::note Histogram temporality

LiteLLM exports histograms with cumulative aggregation temporality, which is what Grafana Cloud's OTLP gateway accepts. Older LiteLLM releases sent delta histograms, which the gateway rejects with `invalid temporality and type combination`; the symptom is `Failed to export batch code: 400` in the proxy log and no GenAI metrics in Grafana at all

::: The integration also queries agent counters (`gen_ai_agent_invocations_total` and friends) and ships VectorDB, MCP, and GPU dashboards. LiteLLM emits no counter instruments and no agent telemetry, so those panels stay empty

Two further instruments, `gen_ai.client.response.time_per_output_token` and `gen_ai.client.response.duration`, are emitted but not read by the prebuilt dashboards. Chart them yourself when you want per-token generation speed

:::note

Cost and time-to-first-token were previously emitted as `gen_ai.client.token.cost` and `gen_ai.client.response.time_to_first_token`, which the prebuilt dashboards do not match. If your panels are empty and Explore shows those older names, upgrade LiteLLM

:::

### Send only traces

Metrics are opt-in. Drop `LITELLM_OTEL_INTEGRATION_ENABLE_METRICS` and the same endpoint carries traces alone

## Prometheus metrics

The OTLP path covers per-request GenAI telemetry. LiteLLM's operational metrics, budgets, rate limits, deployment health, spend, and the rest documented in [Prometheus metrics](../proxy/prometheus), live on the proxy's `/metrics` endpoint instead and reach Grafana Cloud by scraping

Point [Grafana Alloy](https://grafana.com/docs/alloy/latest/) at the proxy and remote_write to your stack:

```alloy title="config.alloy"
prometheus.scrape "litellm" {
  targets    = [{__address__ = "litellm-proxy:4000"}]
  bearer_token = "<litellm-api-key>"
  forward_to = [prometheus.remote_write.grafana_cloud.receiver]
}

prometheus.remote_write "grafana_cloud" {
  endpoint {
    url = "https://prometheus-prod-<region>.grafana.net/api/prom/push"
    basic_auth {
      username = "<instance-id>"
      password = "<access-policy-token>"
    }
  }
}
```

`/metrics` requires a LiteLLM API key by default, which is what `bearer_token` above supplies; set `require_auth_for_metrics_endpoint: false` under `litellm_settings` to expose it unauthenticated instead. Multi-worker deployments also need `PROMETHEUS_MULTIPROC_DIR` set, otherwise each worker reports only its own share

LiteLLM maintains Grafana dashboards for these metrics at [cookbook/litellm_proxy_server/grafana_dashboard](https://github.com/BerriAI/litellm/tree/main/cookbook/litellm_proxy_server/grafana_dashboard); import the JSON and point it at your hosted Prometheus data source

## Control cardinality

Grafana Cloud bills on active series, and both telemetry paths default to attribute sets rich enough to multiply them. A per-request field such as a request ID creates one series per request, so this is worth setting before you send production volume, not after the first bill

For OTLP metrics, filter attributes with an allowlist or denylist under `callback_settings.otel.attributes`:

```yaml title="config.yaml"
callback_settings:
  otel:
    attributes:
      include_list:
        - gen_ai.operation.name
        - gen_ai.system
        - gen_ai.request.model
        - gen_ai.framework
        - metadata.user_api_key_team_id
```

The filter applies to metrics only, so traces keep their full attribute set. See [Control metric attribute cardinality](./opentelemetry_v2#control-metric-attribute-cardinality) for the full list and the denylist form

For Prometheus metrics, restrict labels per metric with `include_labels`:

```yaml title="config.yaml"
litellm_settings:
  prometheus_metrics_config:
    - group: "core"
      metrics:
        - "litellm_proxy_total_requests_metric"
        - "litellm_spend_metric"
      include_labels:
        - "model"
        - "team"
```

Grafana Cloud's **Cost Management > Cardinality** page shows which metrics and labels dominate your series count once data is flowing, which is the fastest way to find what to trim

## Troubleshooting

**401 or 403 from the OTLP gateway.** The base64 credential is `instance-id:token`, not the token alone, and the instance ID is the numeric stack ID rather than your stack name. Re-run the `base64` command and confirm the token carries `traces:write` and `metrics:write`

**Traces arrive but metrics do not.** `LITELLM_OTEL_INTEGRATION_ENABLE_METRICS=true` is required in addition to `LITELLM_OTEL_V2=true`. Metrics also export on a 5 second period, so allow a moment after the first request. If the proxy log shows `Failed to export batch code: 400` naming a temporality problem, see the note above

**Nothing arrives at all.** Confirm `LITELLM_OTEL_V2=true` is set; without it the v2 integration does not run. Set `OTEL_EXPORTER="console"` to check that LiteLLM is producing spans before blaming the network

**Metrics land but the AI Observability dashboards are empty.** Those dashboards query the metric names in the table above. Older LiteLLM releases emit cost and time-to-first-token under different names that will not match; check in Explore which names are actually arriving
