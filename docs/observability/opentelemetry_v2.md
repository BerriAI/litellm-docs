import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# OpenTelemetry v2 - Full-request tracing

OpenTelemetry v2 (OTel v2) is LiteLLM Proxy's next-generation tracing. Each request becomes one clean trace covering the incoming HTTP call, authentication, guardrails, the LLM call, and the internal database and cache work, all nested in a single tree. It follows the standard [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/), so traces are readable in any OTel backend (Grafana Tempo, Jaeger, Honeycomb, Datadog) and ship with presets for the popular LLM observability tools (Arize, Phoenix, Langfuse, Weave, Langtrace, Levo, AgentOps).

:::info Opt-in feature

OTel v2 is off by default; nothing in it runs until you set `LITELLM_OTEL_V2=true`. It is separate from the existing [OpenTelemetry integration](./opentelemetry_integration); pick one. If you are moving from v1, see [Migrating to OpenTelemetry v2](./opentelemetry_v2_migration).

:::

## Quickstart

Two environment variables turn tracing on with the `console` exporter, which needs no extra infrastructure and prints each finished span to your terminal. This assumes a running LiteLLM proxy (by default on `http://localhost:4000`) with at least one model in `config.yaml`; if you do not have one, start with the [proxy getting-started guide](../proxy/docker_quick_start) and come back.

Set the variables in the same environment your proxy runs in (export them in the shell, add them to your `.env`, or pass them with `docker -e`), then start the proxy:

```shell
export LITELLM_OTEL_V2=true
export OTEL_EXPORTER="console"

litellm --config config.yaml
```

Send a request to a model your proxy serves, authenticated with your proxy key in place of `sk-1234`:

```shell
curl http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer sk-1234" \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-4o", "messages": [{"role": "user", "content": "Say hello in one word"}]}'
```

A span prints to the proxy's stdout. To send traces somewhere durable, point the exporter at an [OTLP collector](#send-traces-to-any-otlp-collector) or a [vendor preset](#send-traces-to-a-specific-tool-presets) below.

### Configuration reference

All settings are environment variables; boolean flags accept `true`/`false`.

| Variable | Default | Purpose |
|---|---|---|
| `LITELLM_OTEL_V2` | `false` | Master switch. OTel v2 does nothing until this is `true`. |
| `OTEL_EXPORTER` (alias `OTEL_EXPORTER_OTLP_PROTOCOL`) | `console` | Exporter kind: `console`, `otlp_http`, `otlp_grpc`. |
| `OTEL_ENDPOINT` (alias `OTEL_EXPORTER_OTLP_ENDPOINT`) | none | OTLP collector URL. Setting an endpoint implies `otlp_http` unless you override `OTEL_EXPORTER`. |
| `OTEL_HEADERS` (alias `OTEL_EXPORTER_OTLP_HEADERS`) | none | Comma-separated `key=value` auth headers for your backend. |
| `OTEL_SERVICE_NAME` | `litellm` | `service.name` resource attribute shown in your backend. |
| `OTEL_ENVIRONMENT_NAME` | none | `deployment.environment` resource attribute (e.g. `production`). |
| `OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT` | `no_content` | Prompt/response capture: `no_content`, `span_only`, `event_only`, `span_and_event`. |
| `OTEL_PYTHON_FASTAPI_EXCLUDED_URLS` | health/metrics/UI routes | Comma-separated paths to exclude from tracing (substring match). Set to `""` to trace everything. |
| `LITELLM_OTEL_INTEGRATION_ENABLE_METRICS` | `false` | Also emit the GenAI client metrics (duration, token usage, cost, streaming timings). See [Metrics](#metrics). |
| `LITELLM_OTEL_LEGACY_COMPAT` | `true` | Also emit attributes under the older Traceloop key names. See [Attribute conventions](#attribute-conventions). |

The full set of keys on each span kind is in [Span attributes](#span-attributes).

### Requirements

OTel v2 instruments the proxy's FastAPI app, so it needs the OpenTelemetry SDK plus the FastAPI instrumentation package. These ship with the proxy Docker image; install them manually only for a `pip`-based proxy:

```shell
pip install "litellm[proxy]" \
  opentelemetry-api \
  opentelemetry-sdk \
  opentelemetry-exporter-otlp \
  opentelemetry-instrumentation-fastapi
```

## What you get

A single request to your proxy produces one trace that looks like this:

```
POST /v1/chat/completions                  ← HTTP request (server span)
├── auth /v1/chat/completions              ← authentication
│   ├── postgres get_key_object            ← DB lookups during auth
│   └── postgres get_team_membership
├── execute_guardrail presidio-pii         ← each guardrail that runs
├── chat gpt-4o                            ← the LLM call (model, tokens, cost)
└── batch_write_to_db                      ← spend/usage written to DB
```

The HTTP request, auth, guardrails, the LLM call, and DB writes all live in one correctly nested trace. Every LLM-call span carries rich `gen_ai.*` attributes: model, provider, token usage, cost, finish reasons, and request parameters. Because it builds on the official OpenTelemetry GenAI semantic conventions, it works with any OTel-compatible backend, and one-line vendor presets ship traces to Arize, Phoenix, Langfuse, Weave, Langtrace, Levo, or AgentOps in each tool's native format. Prompts and responses are not captured unless you explicitly opt in, and noisy routes (health checks, metrics scrapes, UI assets) are excluded automatically. If your client sends a `traceparent` header, LiteLLM's spans nest inside your existing trace.

## Send traces to any OTLP collector

This path sends spans over OTLP (the OpenTelemetry Protocol) to a collector or backend you already run; if you do not have one yet, stay on the console exporter until you do. Set the feature flag plus the standard `OTEL_*` environment variables in the proxy's environment. No config change is needed.

<Tabs>

<TabItem value="otlp-http" label="OTLP HTTP collector">

```shell
LITELLM_OTEL_V2=true
OTEL_EXPORTER="otlp_http"
OTEL_ENDPOINT="http://localhost:4318"
```

</TabItem>

<TabItem value="otlp-grpc" label="OTLP gRPC collector">

```shell
LITELLM_OTEL_V2=true
OTEL_EXPORTER="otlp_grpc"
OTEL_ENDPOINT="http://localhost:4317"
```

> gRPC export needs `grpcio`. Install with `pip install grpcio`.

</TabItem>

</Tabs>

Pass any auth headers your backend needs via `OTEL_HEADERS`, then start the proxy:

```shell
OTEL_HEADERS="api-key=your-key,x-tenant=acme"

litellm --config config.yaml
```

Make a request and you will see one trace per request in your backend.

## Send traces to a specific tool (presets)

For LLM observability tools, use a preset. A preset knows the tool's endpoint and emits attributes in the schema that tool expects. To enable one, add its name to `callbacks` in your config and set the tool's credentials as env vars.

<Tabs>

<TabItem value="arize" label="Arize">

```yaml title="config.yaml"
litellm_settings:
  callbacks: ["arize"]
```

```shell
LITELLM_OTEL_V2=true
ARIZE_SPACE_ID="your-space-id"
ARIZE_API_KEY="your-api-key"
ARIZE_PROJECT_NAME="your-project-name"   # required: Arize rejects spans with no project
```

</TabItem>

<TabItem value="phoenix" label="Arize Phoenix">

```yaml title="config.yaml"
litellm_settings:
  callbacks: ["arize_phoenix"]
```

```shell
LITELLM_OTEL_V2=true
PHOENIX_API_KEY="your-api-key"
PHOENIX_COLLECTOR_ENDPOINT="https://app.phoenix.arize.com/v1/traces"
PHOENIX_PROJECT_NAME="my-project"   # optional
```

</TabItem>

<TabItem value="langfuse" label="Langfuse">

```yaml title="config.yaml"
litellm_settings:
  callbacks: ["langfuse_otel"]
```

```shell
LITELLM_OTEL_V2=true
LANGFUSE_PUBLIC_KEY="pk-..."
LANGFUSE_SECRET_KEY="sk-..."
LANGFUSE_HOST="https://cloud.langfuse.com"   # or your self-hosted URL
```

</TabItem>

<TabItem value="weave" label="Weave (W&B)">

```yaml title="config.yaml"
litellm_settings:
  callbacks: ["weave_otel"]
```

```shell
LITELLM_OTEL_V2=true
WANDB_API_KEY="your-api-key"
WANDB_PROJECT_ID="your-entity/your-project"
```

</TabItem>

<TabItem value="langtrace" label="Langtrace">

Langtrace does not accept litellm's OTLP spans directly. It ingests JSON-encoded OTLP at a custom path (`/api/trace`) with an `x-api-key` header, whereas litellm v2 sends protobuf to `/v1/traces`. Run an OpenTelemetry Collector between them: litellm exports to the collector, and the collector re-encodes the spans to JSON and forwards them to Langtrace. The `langtrace` callback still applies Langtrace's attribute schema; the collector only handles delivery.

```yaml title="config.yaml"
litellm_settings:
  callbacks: ["langtrace"]
```

```shell
LITELLM_OTEL_V2=true
OTEL_ENDPOINT="http://otel-collector:4318"
```

Collector config (`otel-collector-config.yaml`), with `LANGTRACE_API_KEY` set in the collector's environment:

```yaml
receivers:
  otlp:
    protocols:
      http:
        endpoint: 0.0.0.0:4318
exporters:
  otlphttp/langtrace:
    encoding: json
    compression: none
    traces_endpoint: https://app.langtrace.ai/api/trace
    headers:
      x-api-key: ${env:LANGTRACE_API_KEY}
      Content-Type: application/json
service:
  pipelines:
    traces:
      receivers: [otlp]
      exporters: [otlphttp/langtrace]
```

</TabItem>

<TabItem value="levo" label="Levo">

```yaml title="config.yaml"
litellm_settings:
  callbacks: ["levo"]
```

```shell
LITELLM_OTEL_V2=true
LEVOAI_API_KEY="your-api-key"
LEVOAI_ORG_ID="your-org-id"
LEVOAI_WORKSPACE_ID="your-workspace-id"
LEVOAI_COLLECTOR_URL="your-levo-collector-url"   # contact Levo support for this
```

</TabItem>

<TabItem value="agentops" label="AgentOps">

```yaml title="config.yaml"
litellm_settings:
  callbacks: ["agentops"]
```

```shell
LITELLM_OTEL_V2=true
AGENTOPS_API_KEY="your-api-key"
```

</TabItem>

</Tabs>

:::tip Send to several backends at once

To send the same traces to multiple vendors, list each preset in `callbacks` and set each one's env vars. For example, Langfuse and Arize together:

```yaml title="config.yaml"
litellm_settings:
  callbacks: ["langfuse_otel", "arize"]
```

Each preset adds its own destination, so your spans reach all of them in parallel, each in that tool's native format.

:::

### Preset reference

Every preset turns into one exporter on a single shared tracer. The table lists, for each one, the callback name you put in `callbacks`, the credentials it reads, where it sends, the attribute vocabulary it adds on top of the canonical `gen_ai.*` keys, and whether it supports per-request (per-team/key) credentials.

| Preset | Callback | Required env vars | Optional env vars | Destination | Vocabulary | Per-request creds |
|---|---|---|---|---|---|---|
| Arize AX | `arize` | `ARIZE_SPACE_ID` (or `ARIZE_SPACE_KEY`), `ARIZE_API_KEY`, `ARIZE_PROJECT_NAME` | `ARIZE_ENDPOINT` (gRPC, default `https://otlp.arize.com/v1`), `ARIZE_HTTP_ENDPOINT` (HTTP) | Arize AX platform | OpenInference | Yes |
| Arize Phoenix | `arize_phoenix` | `PHOENIX_API_KEY` | `PHOENIX_COLLECTOR_HTTP_ENDPOINT` or `PHOENIX_COLLECTOR_ENDPOINT` (gRPC), `PHOENIX_PROJECT_NAME` | Phoenix (self-hosted or Phoenix Cloud) | OpenInference | No |
| Langfuse | `langfuse_otel` | `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY` | `LANGFUSE_HOST` (or `LANGFUSE_OTEL_HOST`; default `https://us.cloud.langfuse.com`, EU is `https://cloud.langfuse.com`) | Langfuse Cloud or self-hosted | Langfuse | Yes |
| Weave (W&B) | `weave_otel` | `WANDB_API_KEY`, `WANDB_PROJECT_ID` (`<entity>/<project>`) | `WANDB_HOST` (default `https://trace.wandb.ai`) | Weights & Biases Weave | OpenInference + Weave | Yes |
| Langtrace | `langtrace` | none of its own | (none) | Langtrace, via an OpenTelemetry Collector (Langtrace ingests JSON-only OTLP) | Langtrace | No |
| Levo | `levo` | `LEVOAI_API_KEY`, `LEVOAI_ORG_ID`, `LEVOAI_WORKSPACE_ID`, `LEVOAI_COLLECTOR_URL` | (none) | Levo collector | canonical `gen_ai.*` only | No |
| AgentOps | `agentops` | `AGENTOPS_API_KEY` | `AGENTOPS_SERVICE_NAME`, `AGENTOPS_ENVIRONMENT` | AgentOps (`https://otlp.agentops.cloud`) | canonical `gen_ai.*` only | No |

Notes:

- **Arize AX vs Arize Phoenix** are different backends from the same company. AX (`arize`) is the hosted platform; Phoenix (`arize_phoenix`) is the open-source tracer you self-host or run on Phoenix Cloud. They use different credentials and endpoints, so pick the callback for the backend you actually run. You can also enable both at once to send to each.
- **Langtrace** ingests JSON-only OTLP at a custom path, so litellm v2 (which sends protobuf to `/v1/traces`) cannot export to it directly. Route through an OpenTelemetry Collector that re-encodes to JSON; the `langtrace` preset only adds the Langtrace attribute schema to your spans. See the Langtrace tab above for the collector config.
- Vocabulary is additive: every preset's spans always carry the canonical OpenTelemetry `gen_ai.*` attributes, and the listed vocabulary is layered on top so the destination tool reads its native schema.

## Seeing your traces

Run the [Quickstart](#quickstart) request against the `console` exporter and the proxy prints a `chat gpt-4o` span to stdout. With content capture off, the message bodies are absent and only the structural attributes appear:

```json
{
  "name": "chat gpt-4o",
  "kind": "SpanKind.CLIENT",
  "attributes": {
    "gen_ai.operation.name": "chat",
    "gen_ai.provider.name": "openai",
    "gen_ai.request.model": "gpt-4o",
    "gen_ai.response.id": "chatcmpl-...",
    "gen_ai.response.model": "gpt-4o-2024-08-06",
    "gen_ai.response.finish_reasons": ["stop"],
    "gen_ai.usage.input_tokens": 12,
    "gen_ai.usage.output_tokens": 1,
    "litellm.call_id": "...",
    "litellm.provider.model": "gpt-4o",
    "litellm.request.streaming": false,
    "litellm.cost.total": 0.0000,
    "gen_ai.system": "openai",
    "gen_ai.usage.prompt_tokens": 12,
    "gen_ai.usage.completion_tokens": 1,
    "gen_ai.usage.total_tokens": 13,
    "llm.is_streaming": false
  }
}
```

The `gen_ai.system`, `gen_ai.usage.*_tokens`, and `llm.is_streaming` keys come from the default `legacy` compatibility mapper; set `LITELLM_OTEL_LEGACY_COMPAT=false` to keep only the canonical keys.

Once a backend is configured with its preset, the same request shows up in that tool's UI as a `chat gpt-4o` span under the request root.

<Tabs>

<TabItem value="arize-shot" label="Arize">

Open your Arize project; the trace appears under the project named by `ARIZE_PROJECT_NAME`, with the OpenInference attributes (`openinference.span.kind=LLM`, `llm.model_name`, `llm.token_count.*`) alongside the canonical keys.

![LiteLLM trace in Arize](/img/observability/otel_v2_arize.png)

</TabItem>

<TabItem value="phoenix-shot" label="Arize Phoenix">

Open Phoenix; the project comes from `PHOENIX_PROJECT_NAME` (default `default`), stamped as the `openinference.project.name` resource attribute.

![LiteLLM trace in Phoenix](/img/observability/otel_v2_phoenix.png)

</TabItem>

<TabItem value="langfuse-shot" label="Langfuse">

Open the Langfuse traces view; endpoint resolution is `LANGFUSE_OTEL_HOST`, then `LANGFUSE_HOST`, then the US cloud default, with `/api/public/otel` appended for a self-hosted host.

![LiteLLM trace in Langfuse](/img/observability/otel_v2_langfuse.png)

</TabItem>

<TabItem value="weave-shot" label="Weave (W&B)">

Open the Weave project at `wandb.ai/<entity>/weave`; `WANDB_PROJECT_ID` must be in `entity/project` form, which is the most common setup mistake.

![LiteLLM trace in Weave](/img/observability/otel_v2_weave.png)

</TabItem>

<TabItem value="agentops-shot" label="AgentOps">

Open the AgentOps dashboard. AgentOps mints its auth token on the first span export rather than at startup, so the very first export can look briefly delayed; this happens once per process and is expected.

![LiteLLM trace in AgentOps](/img/observability/otel_v2_agentops.png)

</TabItem>

<TabItem value="langtrace-shot" label="Langtrace">

Open the Langtrace UI; the spans flow through your existing OTLP collector carrying the `langtrace` keys.

![LiteLLM trace in Langtrace](/img/observability/otel_v2_langtrace.png)

</TabItem>

</Tabs>

## Capturing prompts & responses

By default, OTel v2 records metadata only (model, tokens, cost, timing) and never writes prompt or response text to your traces. This is intentional; it keeps sensitive content out of your observability backend.

To capture message content, opt in explicitly:

```shell
# no_content (default): never capture prompts/responses
OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT="no_content"

# span_only: write prompts/responses as attributes on spans
OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT="span_only"

# event_only: write prompts/responses on log events instead of span attributes
OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT="event_only"

# span_and_event: write content to both spans and events
OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT="span_and_event"
```

The gate is enforced centrally, so it applies to every backend at once; a user request can never force its prompt into your backend while capture is disabled.

## Span attributes

Attributes come from a chain of mappers. The canonical `genai` mapper is always applied first, the `legacy` compatibility mapper is added on top by default, and each preset layers its own vocabulary. The keys below are the canonical `genai` keys per span kind.

The LLM-call span carries the request parameters:

| Attribute | When set |
|---|---|
| `gen_ai.operation.name` | always (`chat`, `text_completion`, `embeddings`, `execute_tool`) |
| `gen_ai.provider.name` | always |
| `gen_ai.request.model` | always |
| `gen_ai.request.temperature`, `top_p`, `top_k`, `max_tokens` | when set on the request |
| `gen_ai.request.frequency_penalty`, `presence_penalty`, `seed` | when set |
| `gen_ai.request.stop_sequences` | when set (string array) |

The response, usage, and content:

| Attribute | When set |
|---|---|
| `gen_ai.response.id`, `gen_ai.response.model` | on success |
| `gen_ai.response.finish_reasons` | on success (string array) |
| `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens` | on success |
| `gen_ai.input.messages`, `gen_ai.output.messages` | only when content capture is on |
| `gen_ai.system_instructions` | content capture on, when a system prompt is present |

Cost and LiteLLM-specific identity:

| Attribute | When set |
|---|---|
| `litellm.call_id` | always |
| `litellm.provider.model` | the model string actually sent to the provider |
| `litellm.request.streaming` | always (`true`/`false`) |
| `litellm.cost.total` | on success |
| `litellm.cost.input`, `output`, `cache_read`, `cache_creation`, `tool_usage` | when the source reported the breakdown |
| `litellm.cost.original`, `discount_amount`, `discount_percent`, `margin_*` | when reported |

Status, errors, and a few conditional keys on the LLM-call span:

- **On failure:** the span records the standard `exception` event (`exception.type`, `exception.message`), sets `error.type`, and sets its status to `ERROR`.
- **On success:** the status is left `UNSET` (the semantic-convention default, matching the FastAPI server span). Only a genuine error sets `ERROR`, so do not key an alert on a status of `OK`.
- **`server.address`, `server.port`:** when the provider endpoint is known.
- **`gen_ai.tool.{idx}.{name,description,parameters}`:** one set per tool definition in the request.

### Other span kinds

**Guardrail span** uses the `litellm.guardrail.*` namespace: `name`, `mode`, `status`, `provider`, `action`, `response`, `violation_categories`, `confidence_score`, `risk_score`, `masked_entity_count`, `duration`, `id`, `policy_template`, `detection_method`. `status` is one of `success`, `guardrail_intervened`, `guardrail_failed_to_respond`, or `not_run`.

**Datastore span** (redis, postgres) carries `db.system.name` and `db.operation.name`, alongside `litellm.service.name` and `litellm.service.call_type`.

**Internal service span** carries only the `litellm.service.*` keys (no `db.*`).

**MCP tool-call span** carries `gen_ai.operation.name` (`execute_tool`), `mcp.method.name`, `mcp.session.id`, `gen_ai.tool.name`, `litellm.mcp.server.name`, `litellm.call_id`, and `litellm.cost.total`. The tool arguments and result are gated by the same content-capture setting as prompt content.

**Root server span** carries the HTTP semantic-convention keys `http.request.method`, `http.route`, `http.response.status_code`, and `url.path`, stamped by the FastAPI instrumentation.

## Attribute conventions

LiteLLM emits one canonical set of GenAI attributes and layers other vocabularies on top by adding a mapper; the active set is controlled by `mapper_names`, with `genai` always first. The `legacy` mapper is on by default (`LITELLM_OTEL_LEGACY_COMPAT=true`) and re-emits the same data under the older semconv-ai / Traceloop names, so dashboards built against those keep working through a migration. Turn it off with `LITELLM_OTEL_LEGACY_COMPAT=false` once your queries use the canonical keys. Vendor mappers (`openinference`, `langfuse`, `weave`, `langtrace`) are added by their presets and never replace the canonical keys.

The most common keys line up across vocabularies as follows:

| Canonical (`genai`) | Legacy (Traceloop) | OpenInference |
|---|---|---|
| `gen_ai.usage.input_tokens` | `gen_ai.usage.prompt_tokens` | `llm.token_count.prompt` |
| `gen_ai.usage.output_tokens` | `gen_ai.usage.completion_tokens` | `llm.token_count.completion` |
| `gen_ai.provider.name` | `gen_ai.system` | `llm.provider` |
| `litellm.request.streaming` | `llm.is_streaming` | n/a |
| `gen_ai.request.model` | n/a | `llm.model_name` |

## Identity baggage

Request-identity values are promoted into OpenTelemetry Baggage on the LLM-call span and copied onto every span in the trace, so a guardrail or datastore span is filterable by team or key without LiteLLM stamping each one by hand. By default this promotes the team id and alias, the API-key hash, the requested and provider models, and the allowlisted team-metadata sub-keys onto every span, plus a handful of metadata fields (org id, user id, key alias, end-user id, requester IP) under the `litellm.metadata.*` namespace. The end-user id is promotable but off by default, since it identifies an individual. A team's free-form metadata is never promoted whole; only the sub-keys you allowlist leave the process. Override any of these with the `LITELLM_OTEL_BAGGAGE_PROMOTED_KEYS`, `LITELLM_OTEL_BAGGAGE_METADATA_KEYS`, and `LITELLM_OTEL_BAGGAGE_TEAM_METADATA_KEYS` env vars (comma-separated) or the matching YAML lists under `callback_settings.otel`.

## Metrics

Alongside traces, OTel v2 can emit GenAI client metrics: histograms for call latency, token usage, and cost that your backend aggregates across requests. Like the rest of OTel v2 they stay off until you turn them on.

Set the flag in the proxy environment next to `LITELLM_OTEL_V2`:

```shell
LITELLM_OTEL_V2=true
LITELLM_OTEL_INTEGRATION_ENABLE_METRICS=true
```

Metrics ship through the exporter you already configured for traces. `OTEL_EXPORTER` (`console`, `otlp_http`, `otlp_grpc`), `OTEL_ENDPOINT`, and `OTEL_HEADERS` decide where the metric stream goes exactly as they do for spans, so the collector that receives your traces receives the metrics too.

### What's recorded

Each successful LLM call records the standard OpenTelemetry GenAI client metrics:

| Metric | Unit | What it measures |
|---|---|---|
| `gen_ai.client.operation.duration` | `s` | Wall-clock time for the whole LLM call |
| `gen_ai.client.token.usage` | `{token}` | Tokens consumed, split into input and output by the `gen_ai.token.type` attribute |
| `gen_ai.client.token.cost` | `USD` | LiteLLM's computed cost for the call |
| `gen_ai.client.response.time_to_first_token` | `s` | Time to the first streamed token (streaming calls) |
| `gen_ai.client.response.time_per_output_token` | `s` | Average time per output token |
| `gen_ai.client.response.duration` | `s` | Provider-side generation time |

Every sample carries the same identity attributes as the matching span (operation, provider/system, request model, framework, and selected `metadata.*` fields), so you can group the histograms by model, provider, key, or team. These are the same six metrics the [v1 OpenTelemetry integration](./opentelemetry_integration) emits, with identical names and units, so a dashboard built for one reads the other.

### Control metric attribute cardinality

By default every metric sample is stamped with the full identity attribute set, which includes per-request fields such as `hidden_params` and several `metadata.*` values. Those are close to unique per request, so each one multiplies the number of time series your backend tracks (one series per distinct attribute combination). At volume this explodes metric cardinality, and some backends, for example Splunk Observability Cloud, start throttling or dropping the metrics.

v2 reads the same filter v1 does, from `callback_settings.otel.attributes` in your config. Nest an `attributes` block there with either an `include_list` (allowlist; emit only the listed attributes) or an `exclude_list` (denylist; emit everything except the listed attributes). The two are mutually exclusive. The filter applies to metrics only; spans keep their full attribute set, so traces stay rich while metric cardinality stays bounded.

The block sits under `callback_settings.otel`. With `LITELLM_OTEL_V2` set, listing `otel` in `callbacks` builds the v2 logger and reads this block (it builds the legacy v1 logger only when the flag is off); the block is also read on the default path when no `otel` callback is listed.

Unlike v1, v2 has no per-instance `attributes` field, so this global block is the only source. v2 also resolves the filter lazily on the first metric a request records rather than at boot, so a bad config (both lists set, or a forbidden name) surfaces on that first recorded request and editing the lists takes effect only after a restart. The filter is read only on the default OTLP path (callback name `otel` or unset); preset destinations such as `arize`, `arize_phoenix`, and `langfuse_otel` emit their metrics with the full attribute set, the same as in v1.

```yaml title="config.yaml"
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

When you want the smallest, most predictable attribute set, list exactly the attributes to keep with `include_list`. Anything not listed is dropped from metrics:

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
        - metadata.user_api_key_org_id
```

`gen_ai.token.type` is never filtered out. It is stamped on `gen_ai.client.token.usage` after the filter runs, so the input/output split survives whatever list you set, and naming it in either `include_list` or `exclude_list` is rejected.

## Which routes are traced

High-frequency, non-LLM routes are excluded by default so they do not flood your traces: health checks (`/health*`), the Prometheus scrape (`/metrics`), and static UI/docs assets (`/ui`, `/docs`, `/redoc`, `/_next`, `/openapi.json`, and favicons).

To change the set, use the standard OpenTelemetry env var (comma-separated paths, substring-matched):

```shell
# Trace everything, including health checks
OTEL_PYTHON_FASTAPI_EXCLUDED_URLS=""

# Exclude only your own custom paths
OTEL_PYTHON_FASTAPI_EXCLUDED_URLS="/health,/internal"
```

## Per-key / per-team destinations (multi-tenant)

Some presets support per-request credentials: if a request carries team- or key-scoped credentials, its spans are routed to that tenant's project automatically. This lets one proxy serve many tenants, each seeing only their own traces, with no extra setup beyond configuring those credentials on the key or team.

The presets that support this, and the dynamic params they read, are:

| Preset | Dynamic params (set on the key/team) |
|---|---|
| `arize` | `arize_space_key` (or `arize_space_id`), `arize_api_key` |
| `langfuse_otel` | `langfuse_public_key`, `langfuse_secret_key` |
| `weave_otel` | `wandb_api_key`, `weave_project_id` |

A request's dynamic credentials are scoped to the exporter that owns them. When several backends are configured at once, one tenant's Arize key is applied only to the Arize exporter and never stamped onto a co-configured Langfuse, Weave, or self-hosted OTLP exporter, so credentials never leak across backends. Presets not listed above (`arize_phoenix`, `langtrace`, `levo`, `agentops`) do not read per-request credentials and always export with their configured credentials.

## Distributed tracing

If the incoming request has a W3C `traceparent` header, LiteLLM continues that trace instead of starting a new one. Your LiteLLM spans then appear inline inside whatever distributed trace your application already has, so you can follow a request from your app, through the proxy, to the LLM provider, in one view.

## OpenTelemetry terms

A trace is the full record of one request. A span is one step inside it, such as the HTTP request, the auth check, or the LLM call, and spans nest to form the tree shown above. An exporter sends finished spans somewhere; the simplest one, `console`, prints them to your terminal. A collector is a separate network service that receives spans, needed only when exporting over `otlp_http` or `otlp_grpc`. A backend stores and displays traces, whether a general tracing tool such as Jaeger, Grafana Tempo, or Datadog, or an LLM-focused tool such as Langfuse, Arize, or Phoenix.

## How it works

You do not need this section to use OTel v2, but it explains why the trace looks the way it does.

The root server span is owned by the standard FastAPI instrumentation rather than by LiteLLM, and the gen-AI spans hang off it as siblings. A guardrail sits directly under the request root alongside the LLM call rather than inside it, because a pre-call guardrail runs before the LLM call even starts, so it belongs to the request lifecycle rather than to the call. Request-level spans (the LLM call and guardrails) parent to the request through an anchor captured once at request entry rather than to whatever span happens to be active, which keeps them correctly placed even inside the live `auth` span or when a pass-through request closes its span from a detached task. Datastore and service spans keep ambient parenting, so an auth DB lookup still nests under `auth`.

Not every internal call becomes a span. Outbound datastore calls (redis, postgres) and genuine background work such as budget jobs are traced; framework instrumentation that would only duplicate a gen-AI span, like the LLM-timing wrapper or the router, feeds Prometheus and Datadog but stays out of the trace. The LLM-call span opens synchronously at the request boundary, just before the upstream call, and closes on the async success or failure callback once token usage and cost are known, so a request rejected before it reaches a provider never produces a phantom client span.

## Troubleshooting

**No traces showing up?**

1. Confirm `LITELLM_OTEL_V2=true` is set in the proxy's environment.
2. Try `OTEL_EXPORTER="console"` first; if spans print to stdout, the issue is your exporter endpoint or headers rather than LiteLLM.
3. Make sure you hit an LLM route (e.g. `/v1/chat/completions`). Health checks and UI routes are excluded by default.
4. Check that `opentelemetry-instrumentation-fastapi` is installed (see [Requirements](#requirements)).

**Only see the LLM call but no `auth`/`postgres`/server span?** Those server and DB spans require the FastAPI instrumentation package; install `opentelemetry-instrumentation-fastapi`.

**I see metadata but no prompts/responses.** That is the default. Set `OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT=span_only` to capture content.

## Support

For questions, open an issue at [BerriAI/litellm](https://github.com/BerriAI/litellm/issues).
