---
title: "API reference"
description: "List and read agent runs, read investigation findings, and query traces with SQL through LiteLLM."
slug: "/proxy/lens/api"
---

# API reference

Most integrations need three calls on your LiteLLM proxy: list recent runs, read one run step by step, and read the findings an investigation saved. For questions those calls do not answer, an agent can [query traces with SQL](#query-traces).

| Task | Endpoint |
| --- | --- |
| List recent runs | [`GET /v1/traces`](#list-runs) |
| Read a run and its steps | [`GET /v1/traces/{trace_id}`](#read-a-run) |
| Read an investigation's findings | [`GET /lens/{id}`](#read-findings) |
| Ask your own question with SQL | [`POST /v1/traces/query`](#query-traces) |
| Read OTLP log records | [`GET /v1/logs`](#logs) on the Lens server |

Every call uses your LiteLLM base URL and a proxy key in `Authorization: Bearer <key>`. There is no Lens command-line tool for these endpoints. Use curl, any HTTP client, or a coding agent that calls them directly.

The examples come from a support agent that answers order questions with a `lookup_order` tool. Responses are shortened to the fields most callers use.

## List runs {#list-runs}

```bash
curl -H "Authorization: Bearer <key>" \
  "https://<your-litellm-proxy>/v1/traces"
```

```json
{
  "data": [
    {
      "trace_id": "4a4c840fdaa6bcb41576696dcdd08cea",
      "trace_ref": "78D3FB0BFD713A60F9AB160F59D2CE0A590884B7875C4B9F5998E3BAB5F455C5",
      "name": "support_agent",
      "service": "support-agent",
      "agent_names": ["support_agent"],
      "input_preview": "Can you check order 1003 for me?",
      "start_time": "2026-10-21T00:22:46.051000+00:00",
      "duration_ms": 1533.24,
      "status": "unset",
      "span_count": 4,
      "llm_calls": 2,
      "tool_calls": 1,
      "error_count": 0,
      "input_tokens": 349,
      "output_tokens": 71,
      "models": ["gpt-5.4-mini-2026-03-17"],
      "spend": null
    }
  ],
  "next_cursor": null
}
```

Optional `start_ms` and `end_ms` are Unix milliseconds. The default window is the last 24 hours. Each page holds up to 50 summaries. Pass `next_cursor` back as `cursor` to read the next page. `spend` is `null` when no LiteLLM spend record matches the run's model calls.

A summary's `source` holds `type`, `url`, and `title` when the run set [`agent.source.url`](./first-trace.md#link-a-run-to-its-source), and is absent otherwise.

## Read a run {#read-a-run}

Pass the summary's `trace_ref` with the trace ID.

```bash
curl -H "Authorization: Bearer <key>" \
  "https://<your-litellm-proxy>/v1/traces/<trace_id>?trace_ref=<trace_ref>"
```

The response holds the same `summary` as the list, one entry per agent in `agents`, and every step in `spans`:

```json
{
  "summary": {"trace_id": "4a4c840fdaa6bcb41576696dcdd08cea", "name": "support_agent", "span_count": 4},
  "agents": [
    {"name": "support_agent", "parent_agent": null, "invocations": 1, "llm_calls": 2, "tool_calls": 1, "duration_ms": 1533.24}
  ],
  "spans": [
    {"span_id": "c0d29d46119bf872", "parent_span_id": null, "name": "support_agent", "type": "agent", "duration_ms": 1533.24, "input_preview": "Can you check order 1003 for me?"},
    {"span_id": "33dc407df5b1d464", "parent_span_id": "c0d29d46119bf872", "name": "ChatCompletion", "type": "llm", "model": "gpt-5.4-mini-2026-03-17", "duration_ms": 706.65, "input_tokens": 154, "output_tokens": 19},
    {"span_id": "49d1a643afcb252b", "parent_span_id": "c0d29d46119bf872", "name": "lookup_order", "type": "tool", "duration_ms": 0.04, "input_preview": "1003"},
    {"span_id": "d429b78e2b94987a", "parent_span_id": "c0d29d46119bf872", "name": "ChatCompletion", "type": "llm", "model": "gpt-5.4-mini-2026-03-17", "duration_ms": 822.27, "input_tokens": 195, "output_tokens": 52}
  ],
  "next_cursor": null
}
```

Spans carry a `type` of `agent`, `llm`, or `tool`, and `parent_span_id` builds the tree. Long traces return their spans in pages. Pass `next_cursor` back as `cursor`, and set `page_size` to change the page length.

To read a step's full input and output, add its span ID:

```bash
curl -H "Authorization: Bearer <key>" \
  "https://<your-litellm-proxy>/v1/traces/<trace_id>/spans/<span_id>?trace_ref=<trace_ref>"
```

```json
{
  "span_id": "49d1a643afcb252b",
  "input": "1003",
  "output": "{\"error\": \"order 1003 not found\"}",
  "attributes": {"openinference.span.kind": "TOOL"}
}
```

The response also holds `input_ui` and `output_ui`, the same content shaped for display. When a span's `error_truncated` is `true`, read the full error text from `GET /v1/traces/{trace_id}/spans/{span_id}/error`.

## Read findings {#read-findings}

Findings come from [investigations](./investigations.md). List existing investigations with `GET /lens`, or create one. These calls need a proxy administrator key.

```bash
curl -X POST "https://<your-litellm-proxy>/lens" \
  -H "Authorization: Bearer <admin-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Support agent order lookups",
    "model": "<analysis-model>",
    "agent_name": "support_agent",
    "context": "The support agent answers order status questions with the lookup_order tool. A good answer reports the status the tool returned and never invents a status, carrier, or date.",
    "lookback_hours": 24
  }'
```

`model` names an [analysis model](https://github.com/BerriAI/lens/blob/main/docs/analysis.md) configured on the Lens server. The response returns the investigation `id` and its first queued run in `jobs`. By default, the investigation keeps watching for new traces every 15 minutes (`interval_minutes`) under a 100 USD monthly limit (`monthly_budget`). Send `"enabled": false` for a single run.

Poll the investigation until its newest job reports `completed`:

```bash
curl -H "Authorization: Bearer <admin-key>" \
  "https://<your-litellm-proxy>/lens/<id>"
```

```json
{
  "id": "314722c5-0a03-430d-9acd-178516decff0",
  "jobs": [
    {
      "status": "completed",
      "stage": "Complete",
      "coverage": {"eligible": 6, "screened": 6, "selected": 6, "investigated": 1, "reused": 4},
      "cost": 0.0747
    }
  ],
  "findings": [
    {
      "id": "9928ebd6-db31-4f38-80e9-36e5a908916c",
      "title": "The agent reported lookup results without inventing shipping details",
      "kind": "pattern",
      "priority": "low",
      "status": "open",
      "description": "The users wanted an arrival date for order 1001 and the status of order 9999. The agent used lookup_order for both. For order 1001, its answer matched the returned status, carrier, and date...",
      "suggestion": "Keep reporting only the details returned by the lookup, preserve estimated dates as estimates, and state clearly when an order cannot be found.",
      "evidence": [
        {
          "span_id": "0ad4fe40bdb3b9f7",
          "quote": "Input: 1001\nOutput: {\"status\": \"shipped\", \"carrier\": \"UPS\", \"eta\": \"2026-10-23\"}"
        }
      ]
    }
  ]
}
```

Each evidence item quotes one step and names its `span_id`. The response also holds the saved `settings`, and each job's `cost` is in USD.

## Query traces with SQL {#query-traces}

`POST /v1/traces/query` runs a read-only ClickHouse SQL query over your traces and LiteLLM spend records. Before an agent writes a query, have it call `GET /v1/traces/query/help`. That response lists the tables, their columns, example queries, and the query rules, so you can give a coding agent a LiteLLM key and ask it to answer questions on its own.

```bash
curl -H "Authorization: Bearer <key>" \
  "https://<your-litellm-proxy>/v1/traces/query/help"
```

```bash
curl -X POST "https://<your-litellm-proxy>/v1/traces/query" \
  -H "Authorization: Bearer <key>" \
  -H "Content-Type: application/json" \
  -d "{\"sql\": \"SELECT SpanName, count() AS spans, round(avg(Duration) / 1e6, 1) AS avg_ms FROM otel_traces WHERE Timestamp >= now() - INTERVAL 1 DAY AND ServiceName = 'support-agent' GROUP BY SpanName ORDER BY spans DESC LIMIT 10\"}"
```

```json
{
  "data": [
    {"SpanName": "ChatCompletion", "spans": 12, "avg_ms": 753.5},
    {"SpanName": "lookup_order", "spans": 6, "avg_ms": 0},
    {"SpanName": "support_agent", "spans": 6, "avg_ms": 1521.1}
  ]
}
```

| Table | One row per |
| --- | --- |
| `otel_traces` | Span |
| `agent_traces_by_key` | Run summary |
| `spend_logs` | LiteLLM request |

A query sees the same rows as the caller's trace reads. Always bound `Timestamp` and add a `LIMIT`. Each query gets 256 MiB of memory and 10 seconds. Do not add a `FORMAT` clause. `Duration` is in nanoseconds. Read `spend_logs FINAL` when you add up costs. SQL that does not parse returns 400. A query that ClickHouse rejects, such as a write or a query over the limits, returns 503. The proxy must have a master key configured. Without one, both query endpoints return 503.

`GET /v1/traces/agents` lists each recorded agent name with its run count, failed runs, last activity, and frameworks:

```json
{
  "agents": [
    {"name": "support_agent", "runs": 6, "failed_runs": 0, "last_seen": "2026-10-21T00:22:50.437000Z", "frameworks": []}
  ]
}
```

It covers the trace retention window by default and accepts the same `start_ms` and `end_ms` as `GET /v1/traces`.

## Upload traces {#upload}

An agent uploads its telemetry in one of two ways. An agent whose model calls go through your LiteLLM gateway sends OTLP to the gateway's `/v1/traces` and `/v1/logs` with the LiteLLM key it already uses in `Authorization: Bearer <key>`. The gateway checks the key, records which key, user, team, and organization sent it, and forwards the upload to Lens. An agent that does not use LiteLLM uploads directly to Lens with a dedicated tracing key in `Authorization: Bearer <tracing-key>`.

Generate a tracing key with `POST /lens/admin/tracing/keys` on LiteLLM as a proxy administrator, or open **Home** in Lens, select **Standalone Lens**, then **Set up manually**, and select **Create tracing key**. `GET /lens/service` on LiteLLM returns the public ingestion base URL and connection status.

For a direct upload, use the Lens base URL, keeping `/lens-ingest` when present, followed by the path below.

| Endpoint | Purpose |
| --- | --- |
| `POST /v1/traces` | Ingest OTLP/HTTP traces as protobuf (`application/x-protobuf`) or JSON (`application/json`). Supports gzip with `Content-Encoding: gzip`. |
| `POST /v1/logs` | Ingest OTLP/HTTP logs from any exporter, including coding-agent session events. See [OTLP logs](#logs) |
| `POST /v1/traces/receipt` | Check delivery of a `trace_id` and up to 1,000 `span_ids` uploaded with the same tracing key. Returns `received`; never returns trace contents |

A tracing key permits ingestion and its own delivery receipts only. It cannot read traces or call models. Lens itself rejects a LiteLLM key with 401, so a LiteLLM key uploads only through the gateway.

A successful upload confirms ClickHouse accepted it. A 429 or 503 is retryable, so use bounded exporter retries. During an extended outage, the exporter can drop traces. Keys refresh on each Lens replica every 30 seconds, with a 90-second maximum credential snapshot age.

## OTLP logs {#logs}

`POST /v1/logs` accepts any OTLP/HTTP log export, as protobuf or JSON. A record needs no particular instrumentation scope, attribute, or trace context to be kept: Lens stores every `LogRecord` in the request, whether it comes from a coding agent, an application logger, or a custom exporter, and whether or not it carries a `trace_id`. Records from Claude Code and Codex CLI are also assembled into [coding agent sessions](./coding-agents.md), which does not change how the record itself is stored.

Each stored record keeps its `time_unix_nano`, `observed_time_unix_nano`, severity number and text, event name, body, attributes, `dropped_attributes_count`, trace ID, span ID, and trace flags, together with the resource attributes and schema URL and the scope name, version, attributes, and schema URL it arrived under. The body and every attribute keep their OTLP type. A value reads back as `{"type": ..., "value": ...}`, where `type` is one of `null`, `string`, `boolean`, `integer`, `double`, `bytes`, `array`, or `map`, so an integer stays an integer and a nested map stays a map.

Read stored records from the Lens server. LiteLLM forwards log uploads to Lens and does not serve these two read routes, so use the Lens base URL and a credential Lens accepts, such as the Lens admin token.

```bash
curl -H "Authorization: Bearer <lens-admin-token>" \
  "https://<your-lens-server>/v1/logs?service=checkout&severity=WARN"
```

```json
{
  "data": [
    {
      "record_id": "a540aca4909350299a4660bb3927e7292ead275332561db8f3a9d27e5400e2f9",
      "timestamp_ns": "1795844656000000000",
      "observed_timestamp_ns": "1795844656000000000",
      "severity_number": 13,
      "severity_text": "WARN",
      "event_name": "app.thing",
      "semantic_event_name": null,
      "scope_name": "my.generic.logger",
      "service_name": "checkout",
      "trace_id": "",
      "span_id": "",
      "conversation_id": null
    }
  ],
  "next_cursor": null
}
```

Records come back newest first. `start_ms` and `end_ms` are Unix milliseconds, default to the last 24 hours, and must fall inside the trace retention window. Each filter is an exact match:

| Parameter | Matches |
| --- | --- |
| `service` | The `service.name` resource attribute |
| `severity` | The record's severity text, such as `WARN` |
| `event` | The record's `event.name` attribute, returned as `semantic_event_name` |
| `trace_id` | The record's trace ID |
| `conversation_id` | The coding agent session the record belongs to |

`page_size` is 1 to 100. Pass `next_cursor` back as `cursor` to read the next page. `timestamp_ns` is the record's `time_unix_nano`. When the exporter leaves that unset, Lens uses the `event.timestamp` attribute, then the observed time. A record without a trace has an empty `trace_id` and `span_id`.

Read one record in full with its `record_id`:

```bash
curl -H "Authorization: Bearer <lens-admin-token>" \
  "https://<your-lens-server>/v1/logs/<record_id>"
```

```json
{
  "record_id": "a540aca4909350299a4660bb3927e7292ead275332561db8f3a9d27e5400e2f9",
  "timestamp_ns": "1795844656000000000",
  "raw_timestamp_ns": "1795844656000000000",
  "observed_timestamp_ns": "1795844656000000000",
  "severity_number": 13,
  "severity_text": "WARN",
  "event_name": "app.thing",
  "semantic_event_name": null,
  "body": {"type": "map", "value": {"k": {"type": "integer", "value": 7}}},
  "attributes": {"a": {"type": "boolean", "value": true}},
  "resource_attributes": {"service.name": {"type": "string", "value": "checkout"}},
  "resource_schema_url": "",
  "scope_name": "my.generic.logger",
  "scope_version": "1.2",
  "scope_attributes": {},
  "scope_schema_url": "",
  "trace_id": "",
  "span_id": "",
  "trace_flags": 0,
  "dropped_attributes_count": 2,
  "service_name": "checkout",
  "conversation_id": null,
  "codex": null
}
```

`raw_timestamp_ns` is the `time_unix_nano` the exporter sent, before any fallback. `codex` is set only for Codex CLI records. Log reads follow the same rules as trace reads: an administrator sees every record, and other callers see the records their user or teams own.

One upload can hold up to 16,384 log records and 64 MiB of decoded content, and Lens rejects a request over either limit as a whole. Raise them on the Lens server with `OTLP_MAX_LOG_RECORDS` and `OTLP_MAX_DECODED_LOG_BYTES`.

## Who can read traces {#access}

These rules come from the gateway. Lens adds no users, roles or grants of its own, as described in [Use the permissions you already have](./rbac.md#gateway-permissions).

Proxy administrators and proxy administrator viewers can read every trace. Every other user, SCIM-provisioned users included, reads the traces owned by their user plus the traces of each team that shares them, as described under [Share a team's traces](#trace-access). SQL queries follow the same rules. A key that belongs to no user, such as a team service account key, cannot read traces and gets a 403.

### Share a team's traces {#trace-access}

A team shares its traces with its members through the `/spend/logs` member permission. A team admin always sees the team's traces, and a regular member sees them once the team's `team_member_permissions` includes `/spend/logs`. Grant it from the Admin UI (Teams, open the team, Member Permissions tab) or with the API:

```bash
curl -X POST "https://<your-litellm-proxy>/team/permissions_update" \
  -H "Authorization: Bearer <admin-key>" \
  -H "Content-Type: application/json" \
  -d '{"team_id": "<team-id>", "team_member_permissions": ["/spend/logs"]}'
```

To grant it to every existing team at once:

```bash
curl -X POST "https://<your-litellm-proxy>/team/permissions_bulk_update" \
  -H "Authorization: Bearer <admin-key>" \
  -H "Content-Type: application/json" \
  -d '{"permissions": ["/spend/logs"], "apply_to_all_teams": true}'
```

To have every new team share its traces, including the teams that [SCIM](../identity_provisioning.md) creates from identity provider groups, set it in [`default_team_params`](../self_serve.md#set-default-params-for-new-teams). Group membership in the identity provider then decides who sees which traces, with no per-team step:

```yaml
litellm_settings:
  default_team_params:
    team_member_permissions: ["/spend/logs"]
```

Later SCIM updates to a group keep the team's permissions. The same permission lets members view the team's spend logs. Investigations and findings under `/lens` stay limited to proxy administrators.

## Investigations API {#use-the-api}

These endpoints on your LiteLLM proxy manage investigations. Send a proxy administrator key in the `Authorization: Bearer <key>` header.

| Endpoint | Purpose |
| --- | --- |
| `GET /lens` | List investigations under `lenses`, plus `workers` and `tracing_enabled`. |
| `POST /lens` | Create an investigation and queue its first run. Send `name`, `model`, and `context` or `checks`; returns the investigation `id` and `jobs`. |
| `GET /lens/{id}` | Read saved `settings`, recent `jobs`, and `findings`. Each job includes `status`, `stage`, `coverage`, and `cost`. |
| `POST /lens/{id}/runs` | Queue another run. Send `{}` to reuse saved settings, or a `settings` object for a one-time override. |
| `POST /lens/{id}/cancel` | Cancel the current run. A watching investigation runs again at its next interval. |

Read-only proxy administrators can preview activity and read investigations, findings, and history. Team and ordinary virtual keys cannot use this API.
