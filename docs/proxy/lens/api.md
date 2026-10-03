---
title: "API reference"
description: "Ingest and read agent traces, start investigations, and retrieve Lens findings."
slug: "/proxy/lens/api"
---

# API reference

## Agent tracing API

All four endpoints require proxy authentication. Send a proxy key in the `Authorization: Bearer <key>` header.

| Endpoint | Purpose |
| --- | --- |
| `POST /v1/traces` | Ingest OTLP/HTTP traces as protobuf (`application/x-protobuf`) or JSON (`application/json`). Supports gzip with `Content-Encoding: gzip`. |
| `GET /v1/traces` | List trace summaries. Optional `start_ms` and `end_ms` are Unix milliseconds. The default window is the last 24 hours. |
| `GET /v1/traces/{trace_id}` | Read the trace's `summary`, `agents`, and `spans`. Accepts optional `trace_ref`. |
| `GET /v1/traces/{trace_id}/spans/{span_id}` | Read a span's `input`, `output`, and `attributes`. Accepts optional `trace_ref`. |

List responses contain `data` and `next_cursor`, with 50 summaries per page by default. Pass `next_cursor` back as `cursor` to read the next page. Use a summary's `trace_ref` when reading the trace or its spans.

```bash
curl -H "Authorization: Bearer <key>" \
  "https://<your-litellm-proxy>/v1/traces"
```

Proxy administrators can read all traces. Team keys can read their team's traces. Keys without a team can read traces sent with that key. Read-only proxy administrators cannot ingest traces.

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
