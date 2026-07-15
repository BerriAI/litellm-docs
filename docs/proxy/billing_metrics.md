import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Billable Request Metering

LiteLLM Enterprise [pricing is usage-based](../enterprise#how-is-pricing-structured). Billable request metering reports that usage. The proxy counts successful requests to LLM, MCP, and A2A endpoints and pushes one OpenTelemetry counter to LiteLLM's collector, authenticated with the mTLS client certificate issued for your deployment.

Only the request count is sent. Prompts, responses, virtual keys, and your license key never leave the deployment. Metering runs separately from any [OTEL logging](../observability/opentelemetry_integration) you configure and never touches your own metrics pipeline.

:::info

You need a `LITELLM_LICENSE` and metering credentials (`client.crt` and `client.key`) from your LiteLLM onboarding. Missing either? [Contact us](https://enterprise.litellm.ai/demo).

:::

## Quick Start

### 1. Set environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `LITELLM_BILLING_METRICS_ENDPOINT` | Yes | Collector URL. Use `https://telemetry.litellm.ai` |
| `LITELLM_BILLING_METRICS_CLIENT_CERT` | Yes | mTLS client certificate. File path or inline PEM |
| `LITELLM_BILLING_METRICS_CLIENT_KEY` | Yes | Private key for the certificate. File path or inline PEM |
| `LITELLM_BILLING_METRICS_CA_CERT` | No | CA bundle for the collector. Leave unset for `telemetry.litellm.ai` |
| `LITELLM_BILLING_METRICS_EXPORT_INTERVAL_MS` | No | Push interval in milliseconds. Default `60000` |

```bash
export LITELLM_LICENSE="eyJ..."
export LITELLM_BILLING_METRICS_ENDPOINT="https://telemetry.litellm.ai"
export LITELLM_BILLING_METRICS_CLIENT_CERT="/etc/litellm/billing-mtls/client.crt"
export LITELLM_BILLING_METRICS_CLIENT_KEY="/etc/litellm/billing-mtls/client.key"
```

The certificate variables accept a file path or the PEM content itself. Use inline PEM when your secret store injects values as environment variables and cannot mount files, for example ECS with AWS Secrets Manager or Cloud Run with Secret Manager.

You can also set these in the config file:

```yaml
environment_variables:
  LITELLM_BILLING_METRICS_ENDPOINT: "https://telemetry.litellm.ai"
  LITELLM_BILLING_METRICS_CLIENT_CERT: "-----BEGIN CERTIFICATE-----\n..."
  LITELLM_BILLING_METRICS_CLIENT_KEY: "-----BEGIN PRIVATE KEY-----\n..."
```

### 2. Start the proxy

```bash
litellm --config config.yaml
```

### 3. Verify

Send a request through the proxy, then check the logs for:

```
Enterprise billing metrics enabled: exporting to https://telemetry.litellm.ai every 60000 ms
```

If this line is missing, look for a warning naming the misconfigured variable. Metering problems never affect request serving. On any error the exporter is disabled and the proxy runs normally.

## Deploy

<Tabs>
<TabItem value="helm" label="Helm">

Both the [standard chart](https://github.com/BerriAI/litellm/tree/main/helm/litellm-helm) and the [microservices chart](./deploy#deploy-with-helm) have a `billingMetrics` block, off by default.

1. Create a TLS Secret from your issued certificate:

```bash
kubectl create secret tls litellm-billing-metrics-mtls --cert=client.crt --key=client.key
```

2. Enable metering in your values:

```yaml
billingMetrics:
  enabled: true
```

The chart looks for the Secret name `litellm-billing-metrics-mtls` by default.

| Value | Default | Description |
|-------|---------|-------------|
| `billingMetrics.enabled` | `false` | Enable metering |
| `billingMetrics.endpoint` | `https://telemetry.litellm.ai` | Collector URL |
| `billingMetrics.secretName` | `litellm-billing-metrics-mtls` | Existing TLS Secret with `tls.crt` and `tls.key` |
| `billingMetrics.caSecretName` | `""` | Existing Secret with `ca.crt`. Leave empty for the default collector |
| `billingMetrics.exportIntervalMs` | `""` | Push interval. The proxy defaults to `60000` |

</TabItem>
<TabItem value="terraform" label="Terraform (AWS / GCP)">

The reference stacks at [`terraform/litellm/aws`](https://github.com/BerriAI/litellm/tree/main/terraform/litellm/aws) (ECS Fargate) and [`terraform/litellm/gcp`](https://github.com/BerriAI/litellm/tree/main/terraform/litellm/gcp) (Cloud Run) enable metering when `billing_metrics_endpoint` is set:

```hcl
billing_metrics_endpoint = "https://telemetry.litellm.ai"
```

```bash
export TF_VAR_billing_metrics_client_cert_pem="$(cat client.crt)"
export TF_VAR_billing_metrics_client_key_pem="$(cat client.key)"
```

The stack stores the certificate and key in Secrets Manager (AWS) or Secret Manager (GCP) and injects them as environment variables. No volume is needed.

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

</TabItem>
</Tabs>

## What counts as billable

A request counts when it returns a 2xx status on an LLM inference endpoint (chat completions, embeddings, responses, images, audio, and the other inference routes), the MCP transport, or the A2A `message/send` route. GET reads, management endpoints, health probes, and failed requests do not count.

The count lines up with the **successful requests** number on the Admin UI usage page.

## FAQ

**Does this affect proxy performance?** No meaningful impact at the default settings. The per-request cost is about 1.6 microseconds.

**What if the collector is unreachable?** Requests are unaffected. The counter is cumulative, so counts recorded during an outage are included in the next successful export.

**What happens on restart?** The proxy flushes the counter on shutdown, so no counts are lost.

**Air-gapped deployments?** Metering needs outbound HTTPS to the collector. If your deployment cannot reach it, talk to us during onboarding.
