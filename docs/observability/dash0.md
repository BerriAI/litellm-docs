# Dash0

{/* keep-version-note */}

Send LiteLLM traces and GenAI metrics to [Dash0](https://www.dash0.com) over OTLP. Dash0 reads the OpenTelemetry GenAI attributes on LiteLLM's spans, so model calls show up with their model, token usage and cost, and can be scored with [evals](https://www.dash0.com/docs/dash0/ai/observability/evals).

## Prerequisites

You need an [auth token](https://www.dash0.com/docs/dash0/miscellaneous/glossary/auth-tokens) with ingest permission and your organization's OTLP via HTTP [endpoint](https://www.dash0.com/docs/dash0/miscellaneous/glossary/endpoints), such as `https://ingress.eu-west-1.aws.dash0.com`. Both are in your Dash0 organization settings. No extra Python packages are required; LiteLLM uses the OTLP HTTP exporter that ships with `litellm[proxy]`.

## Setup

```shell title=".env"
LITELLM_OTEL_V2=true
LITELLM_OTEL_INTEGRATION_ENABLE_METRICS=true

OTEL_EXPORTER="otlp_http"
OTEL_ENDPOINT="https://ingress.eu-west-1.aws.dash0.com"
OTEL_HEADERS="Authorization=Bearer%20<auth-token>"
OTEL_SERVICE_NAME="litellm-proxy"
```

Use the endpoint shown for your organization and leave the path off; LiteLLM appends `/v1/traces` and `/v1/metrics` itself. Dash0 writes to the token's default [dataset](https://www.dash0.com/docs/dash0/miscellaneous/glossary/datasets). To pick another one, add a `Dash0-Dataset` header:

```shell
OTEL_HEADERS="Authorization=Bearer%20<auth-token>,Dash0-Dataset=<dataset>"
```

Start the proxy and send a request. To send traces only, drop `LITELLM_OTEL_INTEGRATION_ENABLE_METRICS`. Before sending production traffic, bound the metric attributes as described in [Control metric attribute cardinality](./opentelemetry_v2#control-metric-attribute-cardinality).

## Traces

Each request is one trace: the server span for the route, an `auth` span, and a `chat <model>` span carrying the canonical [OpenTelemetry GenAI](https://opentelemetry.io/docs/specs/semconv/gen-ai/) attributes. The **Gen AI** tab of Dash0's span sidebar groups these into model, parameters, token usage and response, and Dash0 derives token usage and cost metrics from them. See [About GenAI Spans](https://www.dash0.com/docs/dash0/telemetry/tracing/about-gen-ai-spans) for the attributes Dash0 reads.

## Prompts and responses

LiteLLM sends no message content by default. Dash0 evals judge the conversation, and they read only span and resource attributes, so set content capture to `span_only` to write `gen_ai.input.messages` and `gen_ai.output.messages` onto the span:

```shell
OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT="span_only"
```

`event_only` keeps the content off the span, where evals cannot see it. See [Capturing prompts & responses](./opentelemetry_v2#capturing-prompts--responses) for the other modes. To evaluate content without storing it, turn on GenAI attribute redaction for the dataset in Dash0; evals run before redaction, so they still judge the original text.
