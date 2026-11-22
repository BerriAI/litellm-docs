import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Billable Request Metering

LiteLLM Enterprise [pricing is usage-based](../enterprise#how-is-pricing-structured). Billable request metering reports that usage. The proxy counts successful requests to LLM, MCP, and A2A endpoints. It sends one OpenTelemetry counter to LiteLLM's collector. It authenticates with your deployment's OAuth client ID and secret.

Metering sends request counts with the endpoint category, route, status, model ID, LiteLLM version, and license ID when available. Prompts, responses, and virtual keys never leave the deployment. The gateway sends the license key to the LiteLLM license server only if its offline signature check fails. See [Activate your license](../enterprise/activate.md). Metering runs separately from your [OTEL logging](../observability/opentelemetry_integration) and metrics pipeline.

:::info

Get a `LITELLM_LICENSE`, OAuth client ID, and OAuth client secret during LiteLLM onboarding. [Contact us](https://enterprise.litellm.ai/demo) if you need these credentials.

:::

These OAuth settings replace the certificate settings from earlier builds. Use an image containing the [OAuth metering implementation](https://github.com/BerriAI/litellm/blob/f52f26d9c636038c6e3609cc7d17cf625d434c3e/litellm/proxy/enterprise_billing/billing_metrics.py).

## Quick Start

### 1. Set environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `LITELLM_BILLING_METRICS_ENDPOINT` | Yes | Collector URL. Use `https://telemetry.litellm.ai` |
| `LITELLM_BILLING_METRICS_CLIENT_ID` | Yes | OAuth client ID from LiteLLM onboarding |
| `LITELLM_BILLING_METRICS_CLIENT_SECRET` | Yes | OAuth client secret from your secret manager |
| `LITELLM_BILLING_METRICS_TOKEN_URL` | Yes | HTTPS OAuth token endpoint from onboarding |
| `LITELLM_BILLING_METRICS_EXPORT_INTERVAL_MS` | No | Push interval in milliseconds. Default `60000` |

```bash
export LITELLM_BILLING_METRICS_ENDPOINT="https://telemetry.litellm.ai"
export LITELLM_BILLING_METRICS_TOKEN_URL="https://litellm-prod.auth.us-west-1.amazoncognito.com/oauth2/token"
```

Inject `LITELLM_LICENSE`, `LITELLM_BILLING_METRICS_CLIENT_ID`, and `LITELLM_BILLING_METRICS_CLIENT_SECRET` through your secret manager. The exporter obtains a bearer token with the OAuth client-credentials flow. Both URLs must use HTTPS.

### 2. Start the proxy

```bash
litellm --config config.yaml
```

### 3. Verify

The line below is logged at INFO level, so it only shows when the proxy runs with `LITELLM_LOG=INFO` (or `--detailed_debug`). Send a request through the proxy, then check the logs for:

```
Enterprise billing metrics enabled: exporting to https://telemetry.litellm.ai every 60000 ms
```

If this line is missing, look for a warning naming the misconfigured variable. Invalid startup configuration disables metering. The proxy continues to serve requests if metering fails.

## Deploy

<Tabs>
<TabItem value="helm" label="Helm">

The [LiteLLM chart](./deploy/helm.md) has one `billingMetrics` block for both deployment modes. Create a Secret named `litellm-billing-metrics` with `client-id` and `client-secret` keys through your secret manager. Then enable metering:

```yaml title="values.yaml"
billingMetrics:
  enabled: true
  secretName: litellm-billing-metrics
```

| Value | Default | Description |
|-------|---------|-------------|
| `billingMetrics.enabled` | `false` | Enable metering |
| `billingMetrics.endpoint` | `https://telemetry.litellm.ai` | Collector URL |
| `billingMetrics.tokenUrl` | `https://litellm-prod.auth.us-west-1.amazoncognito.com/oauth2/token` | OAuth token endpoint |
| `billingMetrics.secretName` | `litellm-billing-metrics` | Secret with `client-id` and `client-secret` |
| `billingMetrics.exportIntervalMs` | `""` | Push interval. The proxy defaults to `60000` |

</TabItem>
<TabItem value="terraform" label="Terraform (AWS / GCP)">

The reference stacks at [`terraform/litellm/aws`](https://github.com/BerriAI/litellm/tree/main/litellm/deploy/terraform/litellm/aws) (ECS Fargate) and [`terraform/litellm/gcp`](https://github.com/BerriAI/litellm/tree/main/litellm/deploy/terraform/litellm/gcp) (Cloud Run) enable metering when `billing_metrics_endpoint` is set:

```hcl
billing_metrics_endpoint  = "https://telemetry.litellm.ai"
billing_metrics_client_id = "your-client-id"
```

Supply `TF_VAR_billing_metrics_client_secret` through your secret manager. The module stores it in AWS Secrets Manager or Google Secret Manager and injects it into the runtime. Terraform state contains the secret. Restrict access to the state backend. Set `billing_metrics_token_url` if onboarding provides a different token endpoint.

</TabItem>
<TabItem value="docker" label="Docker">

Use a compatible image containing the OAuth metering implementation, as described in the [Docker guide](./docker_quick_start.md). Add these variables to your existing gateway container:

```bash
docker run \
  --env-file litellm.env \
  -e LITELLM_BILLING_METRICS_ENDPOINT="https://telemetry.litellm.ai" \
  -e LITELLM_BILLING_METRICS_TOKEN_URL="https://litellm-prod.auth.us-west-1.amazoncognito.com/oauth2/token" \
  -v "$(pwd)/config.yaml:/app/config.yaml:ro" \
  -p 127.0.0.1:4000:4000 \
  "$LITELLM_IMAGE" \
  --config /app/config.yaml
```

Set `LITELLM_IMAGE` to your tested image reference. Keep `litellm.env` private. Include the license, OAuth client ID and secret, master key, and database connection settings from your existing deployment.

</TabItem>
</Tabs>

## What counts as billable

A request counts when it returns a 2xx status on an LLM inference endpoint (chat completions, embeddings, responses, images, audio, and the other inference routes), the MCP transport, or the A2A `message/send` route. GET reads, management endpoints, health probes, and failed requests do not count.

The count lines up with the **successful requests** number on the Admin UI usage page.

## FAQ

**Does this affect proxy performance?** No meaningful impact at the default settings. The per-request cost is about 1.6 microseconds.

**What if the collector is unreachable?** Requests are unaffected. The counter is cumulative, so counts recorded during an outage are included in the next successful export.

**What happens on restart?** The proxy attempts a final flush on graceful shutdown. A crash or failed flush can lose counts before the proxy exports them.

**Air-gapped deployments?** Metering needs outbound HTTPS to the collector and OAuth token endpoint. If your deployment cannot reach it, talk to us during onboarding.
