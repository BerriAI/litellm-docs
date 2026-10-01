---
title: Lens API
---

# Lens API

To read results from an investigation you created in the dashboard, start with these three endpoints:

| Action | Endpoint |
| --- | --- |
| Find an investigation and its ID | `GET /lens` |
| Read its findings | `GET /lens/{id}` |
| Read an original trace | `GET /v1/traces/{trace_id}` |

Send `Authorization: Bearer <key>` with each request. Reading investigations requires a proxy administrator or read-only administrator key. A virtual key assigned to the worker pays for model calls; it does not grant access to these management endpoints.

```bash
export LITELLM_URL="https://<your-litellm-proxy>"
export LITELLM_API_KEY="<proxy-admin-key>"

curl -fsS -H "Authorization: Bearer $LITELLM_API_KEY" "$LITELLM_URL/lens"
curl -fsS -H "Authorization: Bearer $LITELLM_API_KEY" "$LITELLM_URL/lens/<id>"
curl -fsS -H "Authorization: Bearer $LITELLM_API_KEY" "$LITELLM_URL/v1/traces/<trace_id>"
```

For a particular run's findings, use `GET /lens/{id}/runs/{run_id}`. [Set up Lens](./lens.md) before starting investigations through the API.

## Trace endpoints

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

## Investigation endpoints

Use these endpoints to configure investigations or run them without the dashboard:

| Action | Endpoint |
| --- | --- |
| Preview matching runs and sample size | `POST /lens/preview/sample` |
| List lenses and their latest state | `GET /lens` |
| Read a lens and its findings | `GET /lens/{id}` |
| Update the saved settings | `PUT /lens/{id}` |
| Create a lens and start its first investigation | `POST /lens` |
| Run again with the saved settings | `POST /lens/{id}/runs` with `{}` |
| Run once with different settings or selected runs | `POST /lens/{id}/runs` with a `settings` override |
| List previous investigations | `GET /lens/{id}/runs` |
| Get an investigation's progress, findings, and selected runs | `GET /lens/{id}/runs/{run_id}` |
| Read supporting trace content | `GET /lens/{id}/executions/{execution_id}` |
| Cancel the active investigation | `POST /lens/{id}/cancel` |
| Mark a finding as expected and explain why | `PATCH /lens/{id}/findings/{finding_id}` |

An agent follows the same flow as the UI: preview the matching runs, create or start an investigation, check its progress, then read the findings. Scheduling is part of the saved settings. Run history returns 50 investigations per page; pass `offset=50` for the next page. To mark a finding as expected, send `{"status":"dismissed","reason":"Why this behavior is acceptable"}` to its feedback endpoint.

Creating, changing, starting, cancelling, and giving feedback require proxy administrator access. Read-only proxy administrators can preview activity and read lenses, findings, and history. Team and ordinary virtual keys cannot use the Lens API. The worker uses its own generated credential.

For example, save this as `lens.json`. Use an analysis model configured on your proxy:

```json
{
  "name": "Research quality",
  "context": "Answer the user's question with sources. State when a claim cannot be verified.",
  "checks": [
    {"id": "accuracy", "instruction": "Find claims that conflict with retrieved sources."}
  ],
  "source": "traces",
  "lookback_hours": 24,
  "service": "research-agent",
  "sample_percent": 100,
  "sample_size": null,
  "concurrency": 8,
  "model": "<your-analysis-model>",
  "monthly_budget": 100,
  "enabled": false
}
```

With a worker connected, preview the matching activity, then create the lens and run its first investigation. These commands use `jq` to read the returned IDs:

```bash
export LITELLM_URL="https://<your-litellm-proxy>"
export LITELLM_API_KEY="<proxy-admin-key>"

jq '{settings: .}' lens.json | curl -fsS \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d @- "$LITELLM_URL/lens/preview/sample"

result=$(curl -fsS -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" -d @lens.json "$LITELLM_URL/lens")
lens_id=$(echo "$result" | jq -r '.id')
run_id=$(echo "$result" | jq -r '.jobs[0].id')

curl -fsS -H "Authorization: Bearer $LITELLM_API_KEY" \
  "$LITELLM_URL/lens/$lens_id/runs/$run_id" \
  | jq '{status, stage, coverage, cost, findings}'
```

Repeat the last command to check progress and read the completed findings. Start another investigation or browse previous ones:

```bash
curl -fsS -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" -d '{}' \
  "$LITELLM_URL/lens/$lens_id/runs"

curl -fsS -H "Authorization: Bearer $LITELLM_API_KEY" \
  "$LITELLM_URL/lens/$lens_id/runs?offset=0"
```

The preview returns `eligible`, `selected`, and a page of `executions`. Send its `next_offset` as `offset` alongside `settings` to see the next page. Creation returns the lens `id` and its queued investigation in `jobs`. Poll `GET /lens/{id}/runs/{run_id}` for `status`, `stage`, `coverage`, `cost`, and `findings`.

Set `enabled` to `true` and `interval_minutes` to `1440` for daily investigations. To run once with different settings, send `{"settings": <complete settings object>}` to `POST /lens/{id}/runs`. An optional `execution_ids` array in those settings restricts analysis to IDs returned by the preview. This override does not change the saved settings.

## Upgrading an existing Lens setup

The renamed API uses `/lens`, lists lenses under `lenses`, and returns `lens_id` in worker claims. Stop workers after active scans finish, upgrade all proxy instances together, and recreate workers using the upgraded dashboard command. Saved lenses and results are preserved by the database migration. Existing API clients must update their paths and response fields.
