# Usage telemetry

The LiteLLM proxy can count how requests to it go, which providers it calls, and which Admin UI pages people open, then hand those counts to an HTTPS endpoint or keep them in its own database. Every group is **off unless you turn it on**, and nothing leaves your deployment unless you also set an endpoint

Telemetry never contains prompts, completions, API keys, user ids, team ids, model names, IP addresses, header values or request bodies. Every field it can produce is listed on this page; a field that is not declared in the record schema cannot be exported. Token counts are only ever summed per row, never kept per request

## Turn it on

A proxy admin turns groups on from **Settings > Telemetry** in the Admin UI (`/ui/telemetry`). The page has a Proxy requests tab and an Admin UI tab, describes what each group sends, says where and how often reports go, and shows the last report this worker sent or, before the first one, a sample report built from made-up traffic. The choice is stored in the `LiteLLM_Config` table, so it survives restarts and reaches every worker at its next report window

You can also pin the groups with an environment variable, which makes the page read-only:

```bash
export LITELLM_TELEMETRY_GROUPS=heartbeat,request_success,token_info
export LITELLM_TELEMETRY_ENDPOINT=https://telemetry.example.com/v1/reports   # optional
```

To guarantee telemetry stays off whatever is saved in the UI, set `LITELLM_TELEMETRY_DISABLED=true`. It wins over `LITELLM_TELEMETRY_GROUPS` and over the stored settings. Whenever any `LITELLM_TELEMETRY_*` variable is set, the Admin UI shows a banner naming the variables (never their values)

With an endpoint set, each worker POSTs one JSON report per window to it, and once more on shutdown. Without one, reports are kept in the `LiteLLM_TelemetryReport` table so an air-gapped install can export them by hand (see [Export reports](#export-reports)). With neither an endpoint nor a database nothing is collected

## Groups

Each group needs the one it builds on. `token_info` and `request_taxonomy` both build on `request_success`, so either can be on without the other. Turning a group off strips its fields before anything is counted, so rows that differed only in those fields merge into one

| Group | Needs | Adds |
|---|---|---|
| `heartbeat` | | The report header: instance id, version, window and which groups are on. With only this group a report has no rows |
| `request_success` | `heartbeat` | Request rows with endpoint, status classes, stream, LiteLLM cache hit, whether the Rust gateway handled the request, request count, provider attempts and the two latency histograms |
| `token_info` | `request_success` | Token sums and provider prompt-cache hit on each request row |
| `request_taxonomy` | `request_success` | Provider and deployment hash on each request row, plus provider attempt rows |
| `event_details` | `request_taxonomy` | Block counts, block types and allowlisted header names on each request row |
| `instance_configuration` | `heartbeat` | Names of allowlisted config keys that are set |
| `page_navigation` | `heartbeat` | Admin UI page views and tab switches |

## What a report contains

Each worker folds what it sees into in-memory counters and emits one report per window (5 minutes by default). Reports are counts, sums and fixed-bucket histograms instead of individual requests

**Report header**

| Field | Meaning |
|---|---|
| `schema_version` | Version of the report format |
| `window_start`, `window_end` | Unix timestamps of the window |
| `instance.instance_id` | Random id stored in the proxy database, the same for every worker and across restarts. Without a database it is a new id on every boot |
| `instance.litellm_version` | The running LiteLLM version |
| `instance.groups` | The groups that are on |
| `instance.config_keys` | `instance_configuration` only. Names of allowlisted config keys that are set, never their values. Empty for now |
| `dropped_records` | Records that did not fit, since a window holds at most 2000 distinct rows |

**Request rows**, one per distinct combination of:

| Field | Meaning |
|---|---|
| `endpoint` | Route template, such as `/chat/completions`. Never the raw path |
| `handled_by_rust` | Whether the response came from the Rust gateway, read from its `x-litellm-rust: true` response header |
| `provider` | `request_taxonomy` only. Provider of the deployment that served the request, such as `anthropic`, or `null` when no provider was called |
| `deployment_hash` | `request_taxonomy` only. First 16 hex characters of SHA-256 over the instance id and the deployment id, so it cannot be matched across installs |
| `litellm_status` | Status class the client got: `2xx`, `3xx`, `4xx`, `5xx` |
| `provider_status` | Status class of the last provider call, or `none` |
| `litellm_cache_hit` | Whether the LiteLLM response cache answered |
| `provider_cache_hit` | `token_info` only. Whether the last provider call reported a prompt cache read |
| `stream` | Whether the response was streamed |

Each request row carries `request_count`, histograms of `latency_to_headers_ms` and `latency_to_first_byte_ms` as seen by the client, measured from when the proxy receives the request to its response headers and to the first non-empty response body chunk. There is no total latency, since for a stream it mostly reflects how long the response is. Each row also carries `provider_attempts` (how many provider calls retries and fallbacks made). With `token_info` it also carries sums of `input_tokens`, `output_tokens` and `cache_read_tokens`. With `event_details` it also carries a `block_count` histogram, `block_types` counts (`text`, `image`, `audio`, `file`, `tool_use`, `tool_result`, `thinking`, `other`) and `header_keys` counts

`header_keys` only names headers from a fixed allowlist: `anthropic-beta`, `anthropic-version`, `openai-beta`, `openai-organization`, `x-litellm-api-key`, `x-litellm-disable-callbacks`, `x-litellm-enable-message-redaction`, `x-litellm-num-retries`, `x-litellm-tags`, `x-litellm-timeout`, `x-stainless-lang` and `x-stainless-package-version`. Any other header is counted as `other`. Header values are never read

**Provider attempt rows** (`request_taxonomy`) count every individual provider call, keyed on `provider`, `deployment_hash`, `provider_status` and `stream`, with an `attempt_count` and a `latency_to_first_token_ms` histogram. There is no total attempt latency, since for a stream it mostly reflects how long the response is. A request that was refused by the proxy before routing, for example a bad key or an exceeded budget, adds no attempt row

**Admin UI events** (`page_navigation`) count page views and tab clicks as `page`, `action` and `target`, for example `{"page": "playground", "action": "click", "target": "tab=compare", "count": 1}`. The page is the first segment of the dashboard route and never contains an id, and the proxy rejects any event that does not match a short lowercase pattern. The browser asks the proxy whether `page_navigation` is on and only then sends these to the proxy's own `POST /telemetry/ui_events` route, never to a third party

Latency histograms use the bucket bounds 50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000, 60000 and 120000 ms, with a last bucket for anything slower. Each histogram in a report is an object with `counts`, one per bucket, and `invalid`, the number of negative, NaN or infinite values that were left out of the buckets. The bounds are not sent: they are fixed for a given `schema_version`, and changing them bumps it. For `schema_version` 1, `block_count` uses the bounds 1, 5, 20 and 100 and `provider_attempts` uses 0, 1, 2 and 3, each with a last bucket for anything above

## Export reports

When reports are kept locally, a proxy admin or admin viewer can page through them:

```bash
curl -s "http://localhost:4000/telemetry/reports?limit=500" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY"
```

The response holds `reports` plus `next_after` and `next_after_id`. Pass those back as `after` and `after_id` to get the next page, until `next_after` is `null`. Reports older than `LITELLM_TELEMETRY_RETENTION_DAYS` (30 by default) are deleted, and windows with no traffic are not stored

## Settings

| Environment variable | Description |
|---|---|
| `LITELLM_TELEMETRY_DISABLED` | `true` forces every group off, whatever is set elsewhere |
| `LITELLM_TELEMETRY_GROUPS` | Comma-separated groups to turn on. When set, it overrides the Admin UI settings, and an empty value means off |
| `LITELLM_TELEMETRY_ENDPOINT` | HTTPS URL that receives one JSON report per window. When unset, reports go to the local table |
| `LITELLM_TELEMETRY_FLUSH_INTERVAL_SECONDS` | Length of a report window. Default is `300` |
| `LITELLM_TELEMETRY_SETTLE_TIMEOUT_SECONDS` | How long a finished request waits for its provider attempts to be logged before its row is written. Default is `2` |
| `LITELLM_TELEMETRY_RETENTION_DAYS` | How long locally kept reports are retained. Default is `30` |

The old `--telemetry` CLI flag still parses but does nothing
