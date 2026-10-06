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
| `GET /lens/{id}/runs?offset=0` | Read run history in pages of 50. List entries omit large result payloads. |
| `GET /lens/{id}/runs/{job_id}` | Read a run's findings, selected sample, assessments, coverage, settings, and cost. |
| `PATCH /lens/{id}/findings/{finding_id}` | Save a finding's `status` (`open`, `resolved`, or `dismissed`) and optional feedback `reason`. |

```bash
curl -H "Authorization: Bearer <key>" \
  "https://<your-litellm-proxy>/lens"
```

Read-only proxy administrators can preview activity and read investigations, findings, and history. Team and ordinary virtual keys cannot use this API.

### Run results and reuse

Creating an investigation queues its first run. `POST /lens/{id}/runs` returns a Lens object with the run ID in `jobs[0].id`. If that investigation already has an active run, the API returns it instead of creating an overlapping run. A one-time override uses a complete `settings` object and leaves the saved settings unchanged.

Lens checks for completed reviews with matching criteria and trace content before making model calls. `coverage.reusable` records how many selected reviews are eligible for reuse. `coverage.reused` counts reviews actually reused in this run; `coverage.screened` includes both reused and newly reviewed traces. Use `screened - reused` for the newly reviewed count. A cancelled run can reuse fewer reviews than were eligible.

A completed run with fully incorporated, unchanged reviews can have zero `cost` and no `findings`. The Lens object's `findings` still contains accumulated findings from earlier runs. Run details contain the findings created or updated by that run. Pending grouping or investigation can still incur cost even when trace reviews are reused. See [repeated runs and review reuse](./investigations.md#repeated-runs-and-review-reuse).

### Finding identity and feedback

A finding's `occurrences` contains distinct affected execution IDs. Its `investigation_runs` contains the contributing investigation run IDs. Evidence may include counterexamples that are not affected executions. Recurring evidence extends the saved finding, and `merged_finding_ids` retains aliases for merged findings. Feedback requests can use the retained ID or a merged alias.

```bash
curl -X PATCH \
  "https://<your-litellm-proxy>/lens/<lens-id>/findings/<finding-id>" \
  -H "Authorization: Bearer <key>" \
  -H "Content-Type: application/json" \
  -d '{"status":"resolved","reason":"Attachment retrieval now succeeds."}'
```

Feedback is saved with the status action. A resolved issue can reopen when a new affected execution supports it; a dismissed finding remains dismissed. Feedback and supporting evidence survive finding reconciliation.

### Budget fields

The Lens object's `spent` is settled cost for `budget_month`, formatted as `YYYY-MM` in UTC. `settings.monthly_budget` is the limit. `reservations` contains model allowances with `amount`, `month`, and `expires_at`; count only unexpired reservations for the current month when calculating available budget. Expired reservations do not consume available budget even if still present in the response.

The worker's virtual key has independent budget and access controls. See [budgets and cost](./investigations.md#budgets-and-cost) for reservation handling, retries, and stopping conditions.
