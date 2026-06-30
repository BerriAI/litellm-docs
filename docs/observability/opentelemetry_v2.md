import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# OpenTelemetry v2 - Full-request tracing

OpenTelemetry v2 (OTel v2) is LiteLLM Proxy's next-generation tracing. It gives you **one clean trace per request** that shows the whole story of a request — the incoming HTTP call, authentication, guardrails, the LLM call itself, and the internal database/cache work — all nested in a single tree.

It follows standard [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/), so the traces it produces are readable in any OTel backend (Grafana Tempo, Jaeger, Honeycomb, Datadog, …) and come with ready-made presets for popular LLM observability tools (Arize, Phoenix, Langfuse, Weave, Langtrace, Levo, AgentOps).

:::info Opt-in feature

OTel v2 is **off by default**. Nothing in it runs until you set `LITELLM_OTEL_V2=true`. It is separate from the existing [OpenTelemetry integration](./opentelemetry_integration) — pick one. If you are moving from v1, see [Migrating to OpenTelemetry v2](./opentelemetry_v2_migration).

:::

## New to OpenTelemetry?

If you have never used OpenTelemetry, these are the only terms you need for this page:

- **Trace** — the full record of one request.
- **Span** — one step inside a trace, such as the HTTP request, the auth check, or the LLM call. Spans nest to form the tree shown below.
- **Exporter** — the piece that sends finished spans somewhere. The simplest one, `console`, just prints them to your terminal.
- **Collector** — a separate network service that receives spans. You only need one when exporting over `otlp_http` or `otlp_grpc`, not for the console exporter.
- **Backend** — the system that receives, stores, and displays traces so you can search and visualize them. This can be a general tracing tool such as Jaeger, Grafana Tempo, or Datadog, or an LLM-focused tool such as Langfuse, Arize, or Phoenix.

If you just want to see something work, jump to the [Quickstart](#quickstart). To send to one of the LLM tools above with a single line of config, see [presets](#2-send-traces-to-a-specific-tool-presets).

## What you get

A single request to your proxy produces **one trace** that looks like this:

```
POST /v1/chat/completions                  ← HTTP request (server span)
├── auth /v1/chat/completions              ← authentication
│   ├── postgres get_key_object            ← DB lookups during auth
│   └── postgres get_team_membership
├── execute_guardrail presidio-pii         ← each guardrail that runs
├── chat gpt-4o                            ← the LLM call (model, tokens, cost)
└── batch_write_to_db                      ← spend/usage written to DB
```

Highlights:

- **One trace, end to end** — the HTTP request, auth, guardrails, the LLM call, and DB writes all live in the same trace, correctly nested.
- **Rich GenAI attributes** — every LLM-call span carries `gen_ai.*` attributes: model, provider, token usage, cost, finish reasons, request parameters, and more.
- **Standards-based** — built on the official OpenTelemetry GenAI semantic conventions, so it works with any OTel-compatible backend.
- **Vendor presets** — one line to ship traces to Arize, Phoenix, Langfuse, Weave, Langtrace, Levo, or AgentOps in the format each tool expects.
- **Safe by default** — prompts and responses are **not** captured unless you explicitly opt in. Noisy routes (health checks, metrics scrapes, UI assets) are excluded automatically.
- **Distributed tracing** — if your client sends a `traceparent` header, LiteLLM's spans nest inside your existing trace.

## Requirements

OTel v2 instruments the proxy's FastAPI app, so it needs the OpenTelemetry SDK plus the FastAPI instrumentation package:

```shell
pip install "litellm[proxy]" \
  opentelemetry-api \
  opentelemetry-sdk \
  opentelemetry-exporter-otlp \
  opentelemetry-instrumentation-fastapi
```

> These packages ship with the proxy Docker image. You only need to install them manually for a `pip`-based proxy.

## Quickstart

The fastest way to see a trace, with no extra infrastructure, is the `console` exporter, which prints each finished span to your terminal. This assumes you already have a running LiteLLM proxy (by default on `http://localhost:4000`) with at least one model defined in `config.yaml`. If you do not, set that up first with the [proxy getting-started guide](../proxy/docker_quick_start) and come back.

Set two environment variables in the same environment your proxy runs in (export them in the shell, add them to your `.env`, or pass them with `docker -e`), then start the proxy:

```shell
export LITELLM_OTEL_V2=true
export OTEL_EXPORTER="console"

litellm --config config.yaml
```

Send a request to a model your proxy serves. Here it is `gpt-4o`, authenticated with your proxy key in place of `sk-1234`:

```shell
curl http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer sk-1234" \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-4o", "messages": [{"role": "user", "content": "Say hello in one word"}]}'
```

A span prints to the proxy's stdout. To understand the full shape and what each field means, see [Seeing your traces](#seeing-your-traces) and [Span attributes](#span-attributes). Once this works, point the exporter at a real destination with [Getting started](#getting-started).

## Getting started

Start with the [Quickstart](#quickstart) above to confirm tracing works using the `console` exporter, which needs no other setup. When you are ready to send traces somewhere durable, pick a destination below.

### 1. Send traces to any OTLP collector

This path sends spans over OTLP (the OpenTelemetry Protocol) to a collector or backend you are already running at the endpoint below; if you do not have one yet, stay on the console exporter from the [Quickstart](#quickstart) until you do. Set the feature flag plus the standard `OTEL_*` environment variables in the proxy's environment. No config change is needed.

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

Pass auth headers your backend needs via `OTEL_HEADERS`:

```shell
OTEL_HEADERS="api-key=your-key,x-tenant=acme"
```

Then start the proxy as usual:

```shell
litellm --config config.yaml
```

Make a request, and you'll see one trace per request in your backend.

### 2. Send traces to a specific tool (presets)

For LLM observability tools, use a **preset**. A preset knows the tool's endpoint and emits attributes in the schema that tool expects. To enable one, add its name to `callbacks` in your config and set the tool's credentials as env vars.

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
| Langtrace | `langtrace` | none of its own | — | Langtrace, via an OpenTelemetry Collector (Langtrace ingests JSON-only OTLP) | Langtrace | No |
| Levo | `levo` | `LEVOAI_API_KEY`, `LEVOAI_ORG_ID`, `LEVOAI_WORKSPACE_ID`, `LEVOAI_COLLECTOR_URL` | — | Levo collector | canonical `gen_ai.*` only | No |
| AgentOps | `agentops` | `AGENTOPS_API_KEY` | `AGENTOPS_SERVICE_NAME`, `AGENTOPS_ENVIRONMENT` | AgentOps (`https://otlp.agentops.cloud`) | canonical `gen_ai.*` only | No |

Notes:

- **Arize AX vs Arize Phoenix** are different backends from the same company. AX (`arize`) is the hosted platform; Phoenix (`arize_phoenix`) is the open-source tracer you self-host or run on Phoenix Cloud. They use different credentials and endpoints, so pick the callback for the backend you actually run. You can also enable both at once to send to each.
- **Langtrace** ingests JSON-only OTLP at a custom path, so litellm v2 (which sends protobuf to `/v1/traces`) cannot export to it directly. Route through an OpenTelemetry Collector that re-encodes to JSON; the `langtrace` preset only adds the Langtrace attribute schema to your spans. See the Langtrace tab above for the collector config.
- Vocabulary is additive: every preset's spans always carry the canonical OpenTelemetry `gen_ai.*` attributes; the listed vocabulary is layered on top so the destination tool reads its native schema.

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

Once a backend is configured with its preset, the same request shows up in that tool's UI as a `chat gpt-4o` span under the request root. The panels below leave a slot for a screenshot of that trace in each backend. To fill one in, capture the trace your request produced, save it under `static/img/observability/`, and replace the placeholder path; crop to the span list plus the attribute panel and scrub any credential headers first.

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

By default, OTel v2 records **metadata only** (model, tokens, cost, timing) and **never** writes prompt or response text to your traces. This is intentional — it keeps sensitive content out of your observability backend.

To capture message content, opt in explicitly:

```shell
# no_content (default) — never capture prompts/responses
OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT="no_content"

# span_only — write prompts/responses as attributes on spans
OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT="span_only"

# event_only — write prompts/responses on log events instead of span attributes
OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT="event_only"

# span_and_event — write content to both spans and events
OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT="span_and_event"
```

The gate is enforced centrally, so it applies to **every** backend at once — a user request can never force its prompt into your backend while capture is disabled.

## Span attributes

Attributes come from a chain of mappers. The canonical `genai` mapper is always applied first, the `legacy` compatibility mapper is added on top by default, and each preset layers its own vocabulary. The keys below are the canonical `genai` keys per span kind.

With the Arize or Phoenix preset, the `openinference` mapper adds Arize's [OpenInference](https://github.com/Arize-ai/openinference/blob/main/spec/semantic_conventions.md) vocabulary to the same spans: message content under `llm.input_messages` / `llm.output_messages` (and `input.value` / `output.value`), the model under `llm.model_name`, token counts under `llm.token_count.*`, and the span role under `openinference.span.kind`. These restate the canonical `gen_ai.*` keys (which stay present) in the spelling Arize renders.

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

**Guardrail span** — uses the `litellm.guardrail.*` namespace: `name`, `mode`, `status`, `provider`, `action`, `response`, `violation_categories`, `confidence_score`, `risk_score`, `masked_entity_count`, `duration`, `id`, `policy_template`, `detection_method`. `status` is one of `success`, `guardrail_intervened`, `guardrail_failed_to_respond`, or `not_run`.

**Datastore span** (redis, postgres) — `db.system.name` and `db.operation.name`, alongside `litellm.service.name` and `litellm.service.call_type`.

**Internal service span** — only the `litellm.service.*` keys (no `db.*`).

**MCP tool-call span** — `gen_ai.operation.name` (`execute_tool`), `mcp.method.name`, `mcp.session.id`, `gen_ai.tool.name`, `litellm.mcp.server.name`, `litellm.call_id`, and `litellm.cost.total`. The tool arguments and result are gated by the same content-capture setting as prompt content.

**Root server span** — the HTTP semantic-convention keys `http.request.method`, `http.route`, `http.response.status_code`, and `url.path`, stamped by the FastAPI instrumentation.

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

Request-identity values are promoted into OpenTelemetry Baggage on the LLM-call span and copied onto every span in the trace. A guardrail or datastore span is then filterable by team or key without LiteLLM stamping each one by hand.

By default this promotes the team id and alias, the API-key hash, the requested and provider models, and the allowlisted team-metadata sub-keys onto every span. It also promotes a handful of metadata fields (org id, user id, key alias, end-user id, requester IP) under the `litellm.metadata.*` namespace.

Two defaults stay conservative for privacy. The end-user id is promotable but off by default, since it identifies an individual. A team's free-form metadata is never promoted whole; only the sub-keys you allowlist leave the process.

Override any of these with the `LITELLM_OTEL_BAGGAGE_PROMOTED_KEYS`, `LITELLM_OTEL_BAGGAGE_METADATA_KEYS`, and `LITELLM_OTEL_BAGGAGE_TEAM_METADATA_KEYS` env vars (comma-separated), or the matching YAML lists under `callback_settings.otel`.

## Metrics

Alongside traces, OTel v2 can emit GenAI **client metrics**: histograms for call latency, token usage, and cost that your backend aggregates across requests. Like the rest of OTel v2 they stay off until you turn them on.

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

High-frequency, non-LLM routes are **excluded by default** so they don't flood your traces: health checks (`/health*`), the Prometheus scrape (`/metrics`), and static UI/docs assets (`/ui`, `/docs`, `/redoc`, `/_next`, `/openapi.json`, favicons, …).

To change the set, use the standard OpenTelemetry env var (comma-separated paths, substring-matched):

```shell
# Trace everything, including health checks
OTEL_PYTHON_FASTAPI_EXCLUDED_URLS=""

# Exclude only your own custom paths
OTEL_PYTHON_FASTAPI_EXCLUDED_URLS="/health,/internal"
```

## Per-key / per-team destinations (multi-tenant)

One proxy can serve many tenants and send each tenant's traces only to that tenant's own backend, so a team never sees another team's traces. The proxy admin owns the routing; a team or key just points at a destination by name and never handles another tenant's secrets.

```
Proxy admin                          Team admin
  creates a destination  ───────►      picks it from a list
  (backend + secrets + scope)          (only ones in their scope show up)
        │                                      │
        └──────────► at request time ◄─────────┘
              the proxy matches caller to destination
              and sends that request's trace there
```

### The idea in one minute

There are two pieces.

A **destination** is a named place to send traces, created by the proxy admin. It reuses the same backends and credentials as the [presets](#2-send-traces-to-a-specific-tool-presets) above: it holds which backend it is (`langfuse_otel`, `arize`, `weave_otel`, or a `generic` OTLP endpoint, meaning any backend that speaks the OpenTelemetry Protocol), the connection details and secrets for that backend, and an **access scope** that says which teams or organizations are allowed to use it. An **organization** here is a group of teams; a team belongs to one org.

A **team, key, or organization** turns a destination on by listing its name in a setting called `logging_exporters`. That is the only thing a team admin ever touches; the secrets stay with the proxy admin.

At request time the proxy looks at the key that made the call, the team that key belongs to, and that team's organization, collects every destination name those three list, keeps only the destinations whose access scope actually includes this caller, and sends the request's trace to each one. If nothing matches, the trace goes only to your normal global exporter from the sections above.

### Who can change what

Three roles appear below. The **proxy admin** runs the whole proxy and holds every secret. An **org admin** runs one organization (a group of teams). A **team admin** runs a single team. The split exists so a team admin can opt their own team in without ever seeing or editing another tenant's secrets.

| Action | Proxy admin | Org admin (of the team's org) | Team admin (of the team) |
|---|:-:|:-:|:-:|
| Create or delete a destination | Yes | No | No |
| Edit a destination's backend, host, or secrets | Yes | No | No |
| Make a destination global, or grant it to whole orgs | Yes | No | No |
| Grant a destination to a team | Yes, any team | Yes, teams in their org | Yes, their own team |
| Turn a destination on for a team or key (`logging_exporters`) | Yes | Yes | Yes (their team) |

### Set it up in the UI

This is the common path, and it always takes two things to be true before a team's traces flow: the destination's access scope must include the team, and the team must list the destination in its **Logging Exporters**. The admin handles the first; the team admin handles the second. Note these are two different screens: the admin works in **Settings, Logging Callbacks** (where destinations are created), and the team admin works in a team's **Logging Exporters** picker (where a destination is switched on).

Proxy admin, create the destination:

1. Open the proxy UI and go to **Settings**, then **Logging Callbacks**.
2. Click to add a logging destination. Choose the **backend** (`langfuse_otel`, `arize`, `weave_otel`, or `generic`), fill in the **host** and the **secrets** for that backend, and set the **Access** scope: make it Global (every team), or pick specific Teams or Orgs. The secret values are the same ones you would set as that preset's env vars, copied from the backend's own dashboard (for example, your Langfuse project's API keys); see the [Preset reference](#preset-reference) for which fields each backend needs.
3. Save. From now on the secrets and the Global/Org scope are admin-only; team admins can only attach the destination to teams already in its scope.

![Adding a logging destination: choose the backend, set the host and secrets, then set the access scope with the Global, Teams, Organizations, and Auto-enable controls](/img/observability/otel_v2_destination_admin.png)

The destinations you create appear in the Logging Callbacks list, each tagged with its access scope:

![Active logging callbacks, each row showing its scope: one Global, one scoped to a single team](/img/observability/otel_v2_destinations_list.png)

Team admin, switch it on for a team:

1. Go to **Teams**, pick your team, open **Settings** (or go to **Virtual Keys**, pick a key, and edit it).
2. In the **Logging Exporters** multi-select, choose the destination. Only destinations in your scope appear here; other tenants' destinations are never listed.
3. Save. Every request from that team or key now also sends its trace to the destination you picked.

### Set it up over the API

The UI calls these endpoints; you can use them directly. The placeholders are: `$ADMIN_KEY` is a proxy-admin virtual key and `$TEAM_ADMIN_KEY` is the team admin's virtual key (mint either on the **Virtual Keys** page in the UI, or with `/key/generate`), `<team-id>` comes from the Teams page, and `pk-...` / `sk-...` are the backend's own keys from its dashboard. As in the UI, both the grant (step 1 or 2) and the turn-on (step 3) must be done before traces flow.

Step 1, proxy admin creates a destination (here a Langfuse destination granted to one team):

```shell
curl -X POST http://localhost:4000/credentials \
  -H "Authorization: Bearer $ADMIN_KEY" -H "Content-Type: application/json" \
  -d '{
    "credential_name": "tenant-a-langfuse",
    "credential_values": {
      "langfuse_public_key": "pk-...",
      "langfuse_secret_key": "sk-...",
      "langfuse_host": "https://cloud.langfuse.com"
    },
    "credential_info": {
      "credential_type": "logging",
      "description": "langfuse_otel",
      "host": "https://cloud.langfuse.com",
      "access": { "teams": ["<team-id>"] }
    }
  }'
```

`credential_type` must be `logging`, and `description` names the backend. Step 2 (an alternative to the grant in step 1): a team admin grants their own team with a narrow patch, and cannot touch secrets, host, or the global/org scope:

```shell
curl -X PATCH http://localhost:4000/credentials/tenant-a-langfuse \
  -H "Authorization: Bearer $TEAM_ADMIN_KEY" -H "Content-Type: application/json" \
  -d '{"credential_info": {"access": {"teams": ["<their-team-id>"]}}}'
```

Step 3, turn the destination on for a team by adding its name to the team's `logging_exporters`:

```shell
curl -X POST http://localhost:4000/team/update \
  -H "Authorization: Bearer $TEAM_ADMIN_KEY" -H "Content-Type: application/json" \
  -d '{"team_id": "<team-id>", "metadata": {"logging_exporters": ["tenant-a-langfuse"]}}'
```

The same `metadata.logging_exporters` works on a key (`/key/update`) and on an organization, and the proxy unions all three at request time.

### Backends and the fields each one needs

The admin fills these into the destination's secret fields; the values come from the backend's own dashboard, the same as the preset env vars in the [Preset reference](#preset-reference). Anything OTLP-compatible that is not one of the first three uses `generic`.

| Backend (`description`) | Secret fields |
|---|---|
| `langfuse_otel` | `langfuse_public_key`, `langfuse_secret_key`, `langfuse_host` (optional; defaults to Langfuse US cloud) |
| `arize` | `arize_space_id` (or `arize_space_key`), `arize_api_key`, `arize_project_name`; `arize_endpoint` optional |
| `weave_otel` | `wandb_api_key`, `weave_project_id` (optional); `weave_endpoint` optional |
| `generic` | `otel_endpoint` (required), `otel_headers` (optional, `key=value,key2=value2`) |

### Good to know

Resolution is **default-deny**: a team only reaches a destination it both lists in `logging_exporters` and is in scope for. A misconfigured or misspelled name simply sends nothing, rather than leaking a trace to the wrong tenant.

Two shortcuts skip the per-team opt-in, and both are admin-only, set on the destination itself. A destination marked **global** is available to every team without an admin granting it team by team; a team admin still lists it to turn it on. A destination marked **auto-enable** goes further and applies to every request automatically, without any team listing it at all; use it when you want one backend to capture every request's trace across the whole proxy. In the UI both are toggles in the destination modal next to the Access scope; over the API they are `credential_info.access.global` and `credential_info.auto_enable`, for example:

```shell
curl -X PATCH http://localhost:4000/credentials/tenant-a-langfuse \
  -H "Authorization: Bearer $ADMIN_KEY" -H "Content-Type: application/json" \
  -d '{"credential_info": {"auto_enable": true}}'
```

This routing applies to **traces only**. The GenAI client metrics (see [Metrics](#metrics)) still go to your single globally-configured exporter, not to per-tenant destinations.

## Distributed tracing

If the incoming request has a W3C `traceparent` header, LiteLLM continues that trace instead of starting a new one. Your LiteLLM spans then appear inline inside whatever distributed trace your application already has — so you can follow a request from your app, through the proxy, to the LLM provider, in one view.

## Configuration reference

All values are environment variables. Boolean flags accept `true`/`false`.

| Variable | Default | Purpose |
|---|---|---|
| `LITELLM_OTEL_V2` | `false` | **Master switch.** OTel v2 does nothing until this is `true`. |
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

## Troubleshooting

**No traces showing up?**

1. Confirm `LITELLM_OTEL_V2=true` is set in the proxy's environment.
2. Try `OTEL_EXPORTER="console"` first — if spans print to stdout, the problem is your exporter endpoint/headers, not LiteLLM.
3. Make sure you hit an LLM route (e.g. `/v1/chat/completions`). Health checks and UI routes are excluded by default.
4. Check that `opentelemetry-instrumentation-fastapi` is installed (see [Requirements](#requirements)).

**Only see the LLM call but no `auth`/`postgres`/server span?** Those server and DB spans require the FastAPI instrumentation package — install `opentelemetry-instrumentation-fastapi`.

**I see metadata but no prompts/responses.** That's the default. Set `OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT=span_only` to capture content.

## Support

For questions, open an issue at [BerriAI/litellm](https://github.com/BerriAI/litellm/issues).
