import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# ✨ Billable Request Metering

LiteLLM Enterprise [pricing is usage-based](../enterprise#how-is-pricing-structured). Billable request metering is how a licensed, connected deployment reports that usage: the proxy counts successful requests to LLM, MCP, and A2A endpoints and pushes a single OpenTelemetry counter to LiteLLM's collector over OTLP/HTTP, authenticated with a mutual TLS client certificate issued for your deployment.

:::info

Requires a `LITELLM_LICENSE` and metering credentials from your LiteLLM onboarding. If you have neither, [contact us](https://enterprise.litellm.ai/demo).

:::

Metering is off unless every required setting below is present, and a misconfiguration can never break the proxy: on any error the exporter is disabled and requests continue to be served normally.

## What is sent

One counter, `litellm.enterprise.billable_requests`, incremented once per 2xx response on a billable endpoint. Each increment carries the endpoint category (`llm`, `mcp`, or `a2a`), the route (e.g. `/chat/completions`), the status code, and the model id when the response includes one. The exporter also stamps the LiteLLM version and the license org id as resource attributes.

Nothing else leaves the deployment. No prompts, no responses, no virtual keys, and never the license key itself; the deployment is identified by the TLS client certificate, not by anything in the payload. The metering exporter runs on its own OpenTelemetry meter provider, fully separate from any [OTEL logging](../observability/opentelemetry_integration) you configure, so your own metrics pipeline is untouched and metering data never reaches your OTEL backend.

## What counts as billable

A billable request is an inbound request that returns a 2xx status on the inference surface (POST requests to chat completions, completions, embeddings, responses, rerank, moderations, images, audio, `/v1/messages`, videos, OCR, search, RAG, Gemini `generateContent`, and provider passthrough routes), on the MCP transport (`/mcp` and its per-server aliases, plus `/mcp-rest/tools/call`), or on the A2A `message/send` route. GET reads, management and discovery endpoints, health probes, and failed requests do not bill.

The exported count is designed to line up with the **successful requests** number on the Admin UI usage page. Where the two can diverge (websocket realtime traffic, some management writes), the metered count is always the lower one.

## Configure with environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `LITELLM_BILLING_METRICS_ENDPOINT` | Yes | Collector URL to push to. Use `https://telemetry.litellm.ai` unless told otherwise |
| `LITELLM_BILLING_METRICS_CLIENT_CERT` | Yes | mTLS client certificate issued for your deployment. File path or inline PEM |
| `LITELLM_BILLING_METRICS_CLIENT_KEY` | Yes | Private key for the client certificate. File path or inline PEM |
| `LITELLM_BILLING_METRICS_CA_CERT` | No | CA bundle for verifying the collector's server certificate. Only for private or test collectors; `telemetry.litellm.ai` presents a publicly trusted certificate, so leave this unset |
| `LITELLM_BILLING_METRICS_EXPORT_INTERVAL_MS` | No | Push cadence in milliseconds. Default `60000` |

```bash
export LITELLM_LICENSE="eyJ..."
export LITELLM_BILLING_METRICS_ENDPOINT="https://telemetry.litellm.ai"
export LITELLM_BILLING_METRICS_CLIENT_CERT="/etc/litellm/billing-mtls/tls.crt"
export LITELLM_BILLING_METRICS_CLIENT_KEY="/etc/litellm/billing-mtls/tls.key"

litellm --config config.yaml
```

Each certificate variable accepts either a filesystem path or the PEM content itself (recognized by the `-----BEGIN` prefix). Inline PEM exists for secret stores that inject values as environment content and cannot mount files, such as ECS tasks reading AWS Secrets Manager or Cloud Run reading Secret Manager; the proxy writes it to a private temp file at startup and points the exporter there. Mixing the two also works, e.g. a mounted CA with injected client credentials.

All of these can also be supplied through the config's `environment_variables` block instead of the shell:

```yaml
environment_variables:
  LITELLM_BILLING_METRICS_ENDPOINT: "https://telemetry.litellm.ai"
  LITELLM_BILLING_METRICS_CLIENT_CERT: "-----BEGIN CERTIFICATE-----\n..."
  LITELLM_BILLING_METRICS_CLIENT_KEY: "-----BEGIN PRIVATE KEY-----\n..."
```

## Verify it is running

A successfully configured proxy logs one line when the first request arrives:

```
Enterprise billing metrics enabled: exporting to https://telemetry.litellm.ai every 60000 ms
```

This is the only positive signal. If metering is disabled because the deployment is unlicensed, the proxy logs it at debug level only; every other disable path (missing or unreadable configuration, exporter init failure) logs a warning naming the variable at fault. Quiet logs alone do not mean metering is on, so check for the `enabled` line on each component that serves billable traffic.

## Deploy

<Tabs>
<TabItem value="helm" label="Helm">

Both the [single-deployment chart](https://github.com/BerriAI/litellm/tree/main/helm/litellm-helm) and the [microservices chart](./microservices_helm) take a top-level `billingMetrics` block, off by default. Create a TLS Secret from your issued certificate and enable the block:

```bash
kubectl create secret tls litellm-billing-metrics-mtls --cert=client.crt --key=client.key
```

```yaml
billingMetrics:
  enabled: true
```

`litellm-billing-metrics-mtls` is the conventional Secret name the chart looks for; set `billingMetrics.secretName` if yours is named differently. The Secret is mounted read-only and the certificate never passes through the environment. On the microservices chart both the `gateway` and the `backend` meter (the backend serves the per-server MCP transport); the migrations Job gets no metering config. Enabling the block without a Secret name, or with an empty endpoint, fails the Helm render rather than deploying a proxy that silently never exports.

| Value | Default | Description |
|-------|---------|-------------|
| `billingMetrics.enabled` | `false` | Enable metering |
| `billingMetrics.endpoint` | `https://telemetry.litellm.ai` | Collector to push to |
| `billingMetrics.secretName` | `litellm-billing-metrics-mtls` | Existing TLS Secret with `tls.crt` and `tls.key` |
| `billingMetrics.caSecretName` | `""` | Existing Secret with `ca.crt`; private/test collectors only |
| `billingMetrics.exportIntervalMs` | `""` | Push cadence; the proxy defaults to `60000` |

</TabItem>
<TabItem value="terraform" label="Terraform (AWS / GCP)">

The reference stacks at [`terraform/litellm/aws`](https://github.com/BerriAI/litellm/tree/main/terraform/litellm/aws) (ECS Fargate) and [`terraform/litellm/gcp`](https://github.com/BerriAI/litellm/tree/main/terraform/litellm/gcp) (Cloud Run) gate metering entirely on `billing_metrics_endpoint`; when it is empty (the default) no billing configuration is added to the containers. The certificate and key are passed as PEM variables, stored in Secrets Manager or Secret Manager, and injected as environment values, so no volume is needed:

```hcl
billing_metrics_endpoint = "https://telemetry.litellm.ai"
```

```bash
export TF_VAR_billing_metrics_client_cert_pem="$(cat client.crt)"
export TF_VAR_billing_metrics_client_key_pem="$(cat client.key)"
```

A plan-time precondition requires the certificate and key together whenever the endpoint is set, so a half-configured metering block fails `terraform plan` instead of deploying a proxy that logs "missing config" and never exports. `billing_metrics_ca_cert_pem` stays empty for the production collector.

</TabItem>
<TabItem value="docker" label="Docker">

```bash
docker run \
  -e LITELLM_LICENSE="eyJ..." \
  -e LITELLM_BILLING_METRICS_ENDPOINT="https://telemetry.litellm.ai" \
  -e LITELLM_BILLING_METRICS_CLIENT_CERT="$(cat client.crt)" \
  -e LITELLM_BILLING_METRICS_CLIENT_KEY="$(cat client.key)" \
  -v $(pwd)/config.yaml:/app/config.yaml \
  -p 4000:4000 \
  ghcr.io/berriai/litellm:main-stable \
  --config /app/config.yaml
```

Passing the PEM content directly as environment values works because the certificate variables accept inline PEM; mounting the files and passing paths works equally well.

</TabItem>
</Tabs>

## FAQ

**Does this affect proxy performance?** The per-request cost is negligible (about 1.6 microseconds of classification and counting). The background export costs roughly one percent of throughput at the default 60 second interval and grows if you shorten `LITELLM_BILLING_METRICS_EXPORT_INTERVAL_MS`.

**What happens on restart?** The proxy flushes the counter on shutdown, so buffered counts are not lost on a normal restart or rollout.

**What if the collector is unreachable?** Requests are unaffected. Export failures are logged and the proxy keeps serving; the counter is cumulative, so transient export failures do not lose already-recorded counts within the exporter's retention.

**Air-gapped deployments?** Metering needs outbound HTTPS to the collector. If your deployment cannot reach it, talk to us about alternatives during onboarding.
