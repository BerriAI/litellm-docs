---
title: "API reference"
description: "Ingest and read agent traces, start investigations, and retrieve Lens findings."
slug: "/proxy/lens/api"
---

# API reference

## Agent tracing API

Uploads go to Lens using a dedicated tracing key in `Authorization: Bearer <tracing-key>`. Generate a key with `POST /lens/tracing/keys` on LiteLLM as a proxy administrator, or use **Lens > Traces > Set up tracing**. `GET /lens/service` returns the public ingestion base URL and connection status. Trace reads use your LiteLLM URL and normal proxy authentication.

### Upload to Lens

Use the Lens base URL, keeping `/lens-ingest` when present, followed by the path below. The dashboard's **Traces endpoint** already includes `/v1/traces`.

| Endpoint | Purpose |
| --- | --- |
| `POST /v1/traces` | Ingest OTLP/HTTP traces as protobuf (`application/x-protobuf`) or JSON (`application/json`). Supports gzip with `Content-Encoding: gzip`. |
| `POST /v1/logs` | Ingest OTLP/HTTP logs, including coding-agent session events |
| `POST /v1/traces/receipt` | Check delivery of a `trace_id` and up to 1,000 `span_ids` uploaded with the same tracing key. Returns `received`; never returns trace contents |

### Read through LiteLLM

Use your LiteLLM base URL and a proxy key associated with a user who can read the traces.

| Endpoint | Purpose |
| --- | --- |
| `GET /v1/traces` | List trace summaries. Optional `start_ms` and `end_ms` are Unix milliseconds. The default window is the last 24 hours. |
| `GET /v1/traces/{trace_id}` | Read the trace's `summary`, `agents`, and `spans`. Accepts optional `trace_ref`. |
| `GET /v1/traces/{trace_id}/spans/{span_id}` | Read a span's `input`, `output`, and `attributes`. Accepts optional `trace_ref`. |

A trace's `summary.source` holds `type`, `url`, and `title` when the run set [`agent.source.url`](./first-trace.md#link-a-run-to-its-source), and is absent otherwise.

List responses contain `data` and `next_cursor`, with 50 summaries per page by default. Pass `next_cursor` back as `cursor` to read the next page. Use a summary's `trace_ref` when reading the trace or its spans.

```bash
curl -H "Authorization: Bearer <key>" \
  "https://<your-litellm-proxy>/v1/traces"
```

Proxy administrators and proxy administrator viewers can read every trace. A tracing key permits ingestion and its own delivery receipts only. It cannot read traces or call models. Ordinary model keys do not authorize ingestion. The gateway upload routes return 410; exporter URLs must point directly to Lens. Every other user, SCIM-provisioned users included, reads the traces owned by their user plus the traces of each team that shares them, as described under [who can see which traces](#trace-access). A key that belongs to no user, such as a team service account key, cannot read traces and gets a 403.

A successful upload confirms ClickHouse accepted it. A 429 or 503 is retryable; use bounded exporter retries. During an extended outage, traces can be dropped by the exporter. Keys refresh on each Lens replica every 30 seconds, with a 90-second maximum credential snapshot age

### Who can see which traces {#trace-access}

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

## Lens API {#use-the-api}

Start investigations and read findings on your LiteLLM proxy. Send a proxy administrator key in the `Authorization: Bearer <key>` header.

| Endpoint | Purpose |
| --- | --- |
| `GET /lens` | List investigations under `lenses`, plus `workers` and `tracing_enabled`. |
| `POST /lens` | Create an investigation and queue its first run. Send `name`, `model`, and `context` or `checks`; returns the investigation `id` and `jobs`. |
| `GET /lens/{id}` | Read saved `settings`, recent `jobs`, and `findings`. Each job includes `status`, `stage`, `coverage`, and `cost`. |
| `POST /lens/{id}/runs` | Queue another run. Send `{}` to reuse saved settings, or a `settings` object for a one-time override. |

```bash
curl -H "Authorization: Bearer <key>" \
  "https://<your-litellm-proxy>/lens"
```

Read-only proxy administrators can preview activity and read investigations, findings, and history. Team and ordinary virtual keys cannot use this API.
