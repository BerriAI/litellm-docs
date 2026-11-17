---
title: Performance alerts API
sidebar_label: API
description: List and review saved performance alerts, inspect their evidence, and enable or disable monitoring.
---

<SinceVersion v="1.110.0" />

Use the gateway's base URL without `/v1`. Set `LITELLM_BASE_URL` to that URL, without a trailing slash, and `LITELLM_API_KEY` to an existing gateway admin key. You can use a view-only admin key for reads. The gateway needs a database connection.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/alerts` | List saved alerts. |
| `GET` | `/alerts/{id}` | Read an alert and its usage history. |
| `PATCH` | `/alerts/{id}` | Resolve, dismiss, or reopen an alert. |
| `GET` | `/alerts/monitoring` | Read monitoring and allowance settings. |
| `PATCH` | `/alerts/monitoring` | Enable or disable monitoring. |

Gateway admins can read and write. View-only admins can read. Other roles receive `403`. These endpoints expose gateway-wide findings, not a user's own alerts.

The dashboard combines performance and model deprecation alerts. Its deprecation feed uses the [model deprecation APIs](./model-deprecations.md#api), so `GET /alerts` alone does not reproduce the whole dashboard inbox.

## List alerts

```bash
curl --get "$LITELLM_BASE_URL/alerts" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  --data-urlencode 'status=open' \
  --data-urlencode 'type=performance' \
  --data-urlencode 'limit=25'
```

| Query | Default | Values |
| --- | --- | --- |
| `status` | `open` | `open`, `resolved`, `dismissed` |
| `type` | No type filter | `performance`, `spend`, `traffic`, `latency`, `reliability`, `model_deprecation` |
| `limit` | `25` | Integer from 1 to 100 |
| `cursor` | First page | `next_cursor` from the preceding response |

`performance` includes spend spikes (`spend`), traffic spikes (`traffic`), slower responses (`latency`), and higher error rates (`reliability`). `model_deprecation` only matches persisted records of that type; it does not load the dashboard's live deprecation feed.

Example response with synthetic data. Spend is in USD, and this team rose from a $200 daily baseline to $1,200.

```json
{
  "data": [
    {
      "id": "42",
      "type": "spend",
      "resource_type": "team",
      "resource_id": "example-team",
      "window_start": "2026-11-09T00:00:00Z",
      "window_end": "2026-11-10T00:00:00Z",
      "evidence": {
        "value": 1200,
        "baseline": 200,
        "unit": "usd",
        "sample_size": 24000
      },
      "status": "open",
      "created_at": "2026-11-10T01:05:00Z",
      "updated_at": "2026-11-10T01:05:00Z",
      "updated_by": null,
      "resource_name": "Research team",
      "history": [
        {"date": "2026-11-02", "value": 160},
        {"date": "2026-11-03", "value": 180},
        {"date": "2026-11-04", "value": 220},
        {"date": "2026-11-05", "value": 200},
        {"date": "2026-11-06", "value": 240},
        {"date": "2026-11-07", "value": 180},
        {"date": "2026-11-08", "value": 220},
        {"date": "2026-11-09", "value": 1200}
      ]
    }
  ],
  "next_cursor": null
}
```

Results arrive newest first. If `next_cursor` is non-null, repeat the same request with `--data-urlencode "cursor=$NEXT_CURSOR"`, setting `NEXT_CURSOR` to that returned value. Keep the status and type filters unchanged. Stop when `next_cursor` is `null`.

## Read an alert

Set `ALERT_ID` to an `id` returned by the list. Treat IDs as strings.

```bash
curl "$LITELLM_BASE_URL/alerts/$ALERT_ID" \
  -H "Authorization: Bearer $LITELLM_API_KEY"
```

The response contains one alert object, with the same fields as an item in `data`.

| Field | Meaning |
| --- | --- |
| `type` | `spend`, `traffic`, `latency`, or `reliability` for a performance finding. |
| `resource_type` | `gateway`, `model`, `team`, `user`, or `key`. |
| `resource_id` | Resource identifier. Gateway alerts use `gateway`. Model alerts use the model-group name. Key alerts use the key hash, never the secret. |
| `window_start`, `window_end` | Observed UTC day, with an inclusive start and exclusive end. |
| `evidence` | Saved observed value, baseline, unit, and request sample size. |
| `created_at` | First detection time. |
| `updated_at`, `updated_by` | Last status update time and actor. `updated_by` is `null` before a status change. |
| `resource_name` | Current display name, or `null` if unavailable. |
| `history` | Up to eight daily values in the same unit, or `null` if unavailable. Missing dates are gaps. |

Units are `usd`, `requests`, `milliseconds`, and `ratio`. An error rate of `0.05` means 5%. For response-time alerts, `sample_size` counts timed requests. Other performance alerts count recorded requests.

The saved `evidence` stays fixed. `history` reflects current Usage, including late accounting. A missing chart does not remove the saved finding.

## Change status

```bash
curl -X PATCH "$LITELLM_BASE_URL/alerts/$ALERT_ID" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"status":"resolved"}'
```

Use `dismissed` to dismiss or `open` to reopen. The response returns the saved alert with its new `status`, `updated_at`, and `updated_by`. It omits `resource_name` and `history`; fetch the detail again if you need them.

Status changes do not reset the free allowance or suppress findings for later days. There is no public create or delete endpoint.

## Monitoring

```bash
curl "$LITELLM_BASE_URL/alerts/monitoring" \
  -H "Authorization: Bearer $LITELLM_API_KEY"
```

Example after the free allowance is exhausted.

```json
{
  "enabled": true,
  "alerts_used": 5,
  "alert_limit": 5,
  "disabled_by_config": false
}
```

`enabled` is the monitoring setting. Detection runs only if it is `true` and the allowance remains available. `alert_limit` is `null` for Enterprise. `alerts_used` is the lifetime free-allowance counter, capped at five, not a count of all Enterprise alerts.

Turn monitoring off with an admin key.

```bash
curl -X PATCH "$LITELLM_BASE_URL/alerts/monitoring" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"enabled":false}'
```

The response has the same monitoring fields. Send `{"enabled":true}` to turn it back on. The setting applies across workers sharing the database and keeps saved alerts and allowance usage.

If `disabled_by_config` is `true`, remove `general_settings.performance_alerts_enabled: false` from the proxy configuration and restart before enabling monitoring through this API.

## Errors

| Status | Meaning |
| --- | --- |
| `401` | Missing or invalid authentication. |
| `403` | The caller lacks the required gateway admin role. |
| `404` | No saved alert has this ID. |
| `409` | Configuration prevents enabling monitoring. |
| `422` | Invalid ID, filter, status, limit, or request body. |
| `503` | The gateway has no database connection for alerts. |
