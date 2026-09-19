import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Parseable

Parseable provides setup guides for the [LiteLLM SDK](https://www.parseable.com/docs/ingest-data/ai-agents/litellm-sdk) and [LiteLLM Gateway](https://www.parseable.com/docs/ingest-data/gateways/litellm).

## Overview

Send LiteLLM traces, logs and metrics to [Parseable](https://www.parseable.com/) with OpenTelemetry. The SDK integration records telemetry from Python applications that call LiteLLM. The Gateway integration records gateway traces and Prometheus metrics for routing, failures, spend, token usage, rate limits and infrastructure dependencies.

Both integrations send telemetry through an OpenTelemetry Collector. The Collector stores Parseable credentials and routes traces, logs and metrics to separate datasets.

## Prerequisites

You need a running Parseable instance, a Parseable API key with ingest access, an OpenTelemetry Collector that LiteLLM can reach and a model provider API key.

## Monitoring LiteLLM

Choose the LiteLLM SDK when your Python application imports and calls LiteLLM. Choose the LiteLLM Gateway when applications send requests through a central LiteLLM endpoint.

<Tabs>
<TabItem value="LiteLLM SDK" label="LiteLLM SDK" default>

Create separate Parseable datasets for traces, logs and metrics, then configure the OpenTelemetry Collector to forward each signal. See the [Parseable LiteLLM SDK guide](https://www.parseable.com/docs/ingest-data/ai-agents/litellm-sdk) for dataset and Collector configuration.

<Tabs>
<TabItem value="No Code" label="No Code (Recommended)" default>

**Step 1:** Install LiteLLM and the OpenTelemetry packages.

```bash
pip install litellm \
  opentelemetry-api \
  opentelemetry-sdk \
  opentelemetry-exporter-otlp
```

**Step 2:** Enable the OpenTelemetry callback before making LiteLLM calls.

```python
import litellm

litellm.callbacks = ["otel"]
```

**Step 3:** Point LiteLLM at the OpenTelemetry Collector.

```bash
export OTEL_EXPORTER="otlp_http"
export OTEL_ENDPOINT="http://localhost:4318"
export OTEL_SERVICE_NAME="litellm-sdk"
export LITELLM_OTEL_V2="true"
export LITELLM_OTEL_INTEGRATION_ENABLE_METRICS="true"
export LITELLM_OTEL_INTEGRATION_ENABLE_EVENTS="true"
export USE_OTEL_LITELLM_REQUEST_SPAN="true"
export OTEL_SEMCONV_STABILITY_OPT_IN="gen_ai_latest_experimental"
export OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT="no_content"
```

`LITELLM_OTEL_INTEGRATION_ENABLE_EVENTS` exports GenAI events as logs. `USE_OTEL_LITELLM_REQUEST_SPAN` and `OTEL_SEMCONV_STABILITY_OPT_IN` create the `CLIENT` spans used by the Parseable dashboard queries.

**Step 4:** Run the application.

```python
import litellm

litellm.callbacks = ["otel"]

response = litellm.completion(
    model="openai/{{openai_small}}",
    messages=[{"role": "user", "content": "What is observability?"}],
)

print(response.choices[0].message.content)
```

</TabItem>

<TabItem value="Code" label="Code">

Use code-based configuration when you need to enable GenAI events and metrics or control message capture and semantic convention settings.

**Step 1:** Install LiteLLM and the OpenTelemetry packages.

```bash
pip install litellm \
  opentelemetry-api \
  opentelemetry-sdk \
  opentelemetry-exporter-otlp
```

**Step 2:** Configure the LiteLLM OpenTelemetry callback.

```python
import os

import litellm
from litellm.integrations.opentelemetry import OpenTelemetry, OpenTelemetryConfig

os.environ["USE_OTEL_LITELLM_REQUEST_SPAN"] = "true"

litellm.callbacks = [
    OpenTelemetry(
        config=OpenTelemetryConfig(
            exporter="otlp_http",
            endpoint="http://localhost:4318",
            enable_metrics=True,
            enable_events=True,
            capture_message_content="NO_CONTENT",
            semconv_stability="gen_ai_latest_experimental",
        )
    )
]
```

**Step 3:** Make a LiteLLM request.

```python
response = litellm.completion(
    model="openai/{{openai_small}}",
    messages=[
        {"role": "user", "content": "Explain distributed tracing."}
    ],
    metadata={"mask_input": True, "mask_output": True},
)

print(response.choices[0].message.content)
```

`USE_OTEL_LITELLM_REQUEST_SPAN=true` creates a model-call span for each SDK request. `capture_message_content="NO_CONTENT"` and request-level masking keep raw prompts and responses out of exported telemetry.

</TabItem>
</Tabs>

## View Traces, Logs and Metrics in Parseable

Open `<sdk-traces-dataset>` from the Traces page, `<sdk-logs-dataset>` from the Logs page and `<sdk-metrics-dataset>` from the Metrics page. SDK metrics include request duration, token usage, cost and streaming latency.

The [Parseable SDK guide](https://www.parseable.com/docs/ingest-data/ai-agents/litellm-sdk) provides Collector pipelines, dataset headers, SQL queries and troubleshooting steps.

## Dashboard

The [LiteLLM SDK Observability dashboard](https://github.com/parseablehq/dashboards/blob/main/litellm-sdk-observability/litellm-sdk-observability-sql.json) contains 50 tiles across nine sections. Its SQL queries combine LiteLLM logs, traces and metrics to cover request health, latency, token usage, spend and telemetry quality.

Import the JSON template in Parseable. Set **Logs Dataset** to `<sdk-logs-dataset>`, **Traces Dataset** to `<sdk-traces-dataset>` and **Metrics Dataset** to `<sdk-metrics-dataset>`. Use the Service, Environment, Request Model, Provider and Log Level variables to filter dashboard tiles.

### Models and usage

The Models and Usage section shows model and provider distribution, streaming usage, scenario distribution and SDK inventory. Use it to compare traffic across models and confirm which services and SDK versions produce telemetry.

![LiteLLM SDK models and usage dashboard in Parseable](https://raw.githubusercontent.com/parseablehq/dashboards/main/litellm-sdk-observability/assets/ModelsAndUsage.png)

### Tokens and cost

The Tokens and Cost section shows input and output token consumption, spend by model over time and model economics. Use it to find high-volume models and compare token volume with recorded spend.

![LiteLLM SDK tokens and cost dashboard in Parseable](https://raw.githubusercontent.com/parseablehq/dashboards/main/litellm-sdk-observability/assets/TokensAndCost.png)

The remaining sections cover Traffic and Reliability, Performance and Latency, Cost and FinOps, Logs, Trace Explorer and Metrics and Telemetry. See [Parseable Dashboards](https://www.parseable.com/docs/user-guide/dashboards) for import and customization instructions.

</TabItem>

<TabItem value="LiteLLM Gateway" label="LiteLLM Gateway">

The Gateway sends OpenTelemetry traces to the Collector and exposes gateway metrics at `/metrics` for the Collector to scrape. The [Parseable LiteLLM Gateway guide](https://www.parseable.com/docs/ingest-data/gateways/litellm) provides dataset and Collector configuration.

**Step 1:** Install LiteLLM Gateway and the telemetry packages.

```bash
pip install "litellm[proxy]" \
  opentelemetry-api \
  opentelemetry-sdk \
  opentelemetry-exporter-otlp-proto-http \
  opentelemetry-instrumentation-fastapi \
  prometheus-client==0.20.0
```

**Step 2:** Enable OpenTelemetry and Prometheus callbacks in `config.yaml`.

```yaml
litellm_settings:
  callbacks:
    - otel
    - prometheus

callback_settings:
  otel:
    attributes:
      exclude_list:
        - hidden_params
        - metadata.requester_metadata
        - metadata.requester_ip_address
        - metadata.spend_logs_metadata
        - metadata.mcp_tool_call_metadata
        - metadata.vector_store_request_metadata
        - metadata.prompt_management_metadata
```

The attribute exclusion list prevents request-specific metadata from creating high-cardinality metric series.

**Step 3:** Point LiteLLM at the OpenTelemetry Collector.

```bash
export LITELLM_MASTER_KEY="<litellm-master-key>"
export LITELLM_OTEL_V2="true"
export LITELLM_OTEL_INTEGRATION_ENABLE_METRICS="true"
export USE_OTEL_LITELLM_REQUEST_SPAN="true"
export OTEL_SEMCONV_STABILITY_OPT_IN="gen_ai_latest_experimental"
export OTEL_EXPORTER="otlp_http"
export OTEL_ENDPOINT="http://localhost:4318"
export OTEL_SERVICE_NAME="litellm-gateway"
export OTEL_ENVIRONMENT_NAME="production"
export OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT="no_content"
```

Use the same `LITELLM_MASTER_KEY` in LiteLLM and the Collector's Prometheus receiver. The request-span and semantic-convention settings create the `CLIENT` spans used by the Parseable dashboard queries.

**Step 4:** Start the Gateway.

```bash
litellm --config config.yaml --port 4000
```

Configure the Collector to receive traces over OTLP/HTTP and scrape `http://<litellm-host>:4000/metrics` with the LiteLLM master key. Send traces to `<gateway-traces-dataset>` and metrics to `<gateway-metrics-dataset>` in Parseable.

## View Traces and Metrics in Parseable

Open `<gateway-traces-dataset>` from the Traces page to inspect request paths, routing, guardrails, cache or database activity and provider calls. Open `<gateway-metrics-dataset>` from the Metrics page to inspect GenAI metrics and LiteLLM Prometheus metrics.

## Dashboard

The [LiteLLM Proxy Observability dashboard](https://github.com/parseablehq/dashboards/blob/main/litellm-proxy-observability/litellm-proxy-observability-mixed.json) contains 52 tiles across seven sections. It combines SQL trace queries with PromQL gateway metrics to cover request health, latency, tokens, spend, model behavior and deployment health.

Import the JSON template in Parseable. Set **Trace Dataset** to `<gateway-traces-dataset>` and **Metrics Dataset** to `<gateway-metrics-dataset>`.

### Gateway overview

The Overview section shows request count, trace error rate, total tokens, total spend, average request latency, P95 request latency and P95 time to first token. It includes panels for in-flight requests and request volume by model. Use these signals to select a follow-up section: Traffic and Reliability, Latency, Tokens and Cost, Cost and FinOps, Models and Usage or Trace Explorer.

![LiteLLM Gateway Observability dashboard in Parseable](https://raw.githubusercontent.com/parseablehq/dashboards/main/litellm-proxy-observability/assets/Overview.png)

### Models and usage

The Models and Usage section shows model and provider distribution, finish reasons, streaming usage and service inventory. Its Model Performance and Cost table compares call count, error rate, average and P95 latency, token volume and cost for each model.

![LiteLLM Gateway models and usage dashboard in Parseable](https://raw.githubusercontent.com/parseablehq/dashboards/main/litellm-proxy-observability/assets/ModelsAndUsage.png)

### Tokens and cost

The Tokens and Cost section shows input and output token totals, average cost per call, average tokens per call, token rate and spend rate by model. Its time-series panels compare token consumption and model cost over the selected period.

![LiteLLM Gateway tokens and cost dashboard in Parseable](https://raw.githubusercontent.com/parseablehq/dashboards/main/litellm-proxy-observability/assets/TokensAndCost.png)

See [Parseable Dashboards](https://www.parseable.com/docs/user-guide/dashboards) for import and customization instructions.

</TabItem>
</Tabs>
