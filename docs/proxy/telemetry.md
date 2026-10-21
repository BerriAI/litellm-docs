# Usage telemetry

The LiteLLM proxy can count how requests to it go, which providers it calls, and which Admin UI pages people open, then hand those counts to an HTTP endpoint you set or keep them in its own database. Every group is **off unless you turn it on**, nothing is recorded until you also pick a destination, and nothing leaves your deployment unless that destination is `http`. There is no default endpoint, so reports only ever go to the URL you set in `LITELLM_TELEMETRY_ENDPOINT`.

Available from v1.107.0.

Telemetry never contains prompts, completions, API keys, user ids, team ids, model names, IP addresses, header values or request bodies. Every field it can produce is listed on this page; a field that is not declared in the record schema cannot be exported. Token counts are only ever summed per row, never kept per request.

## Turn it on

Turn groups on and pick a destination with environment variables. `LITELLM_TELEMETRY_GROUPS` makes the whole Telemetry page read-only, the destination included, so set `LITELLM_TELEMETRY_DESTINATION` with it. `LITELLM_TELEMETRY_DESTINATION` on its own locks only the destination:

```bash
export LITELLM_TELEMETRY_GROUPS=heartbeat,request_success,token_info
export LITELLM_TELEMETRY_DESTINATION=http   # or local_table
export LITELLM_TELEMETRY_ENDPOINT=https://telemetry.example.com/v1/reports   # needed for http
```

A proxy admin can also save groups and a destination through the API. This needs a database, and it is refused while `LITELLM_TELEMETRY_GROUPS` or `LITELLM_TELEMETRY_DISABLED` is set:

```bash
curl -s -X PUT http://localhost:4000/telemetry/settings \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" -H 'content-type: application/json' \
  -d '{"groups": ["heartbeat", "request_success"], "destination": "local_table"}'
```

The saved choice is stored in the `LiteLLM_Config` table, so it survives restarts and reaches every worker at its next report window. Each call replaces both groups and destination, so send `destination` every time unless `LITELLM_TELEMETRY_DESTINATION` is set. A call without it saves no destination, and the proxy then records nothing and logs a warning. Neither the environment variables nor the API check for an enterprise license.

A proxy admin can see what is on from **Settings > Telemetry** in the Admin UI (`/ui/telemetry`). The page has a Proxy requests tab and an Admin UI tab, describes what each group sends, says where and how often reports go, and shows the last report this worker sent or, before the first one, a sample report built from made-up traffic. The page cannot turn telemetry on. Every control that would turn on a group or set a first destination saves nothing and opens a dialog instead, or is disabled while telemetry is off. On an enterprise license it asks you to contact your LiteLLM enterprise representative, and without one it says telemetry is an enterprise feature. So the page can only turn off groups saved through the API, or switch a destination that is already set.

To guarantee telemetry stays off whatever is saved through the UI or the API, set `LITELLM_TELEMETRY_DISABLED=true`. It wins over `LITELLM_TELEMETRY_GROUPS` and over the stored settings. Whenever valid `LITELLM_TELEMETRY_*` variables are set, the Admin UI shows a banner naming them (never their values).

An invalid value, such as an unknown group, a group without the one it needs, an endpoint that is not an HTTP or HTTPS URL, or `LITELLM_TELEMETRY_DESTINATION=http` without an endpoint, leaves telemetry off and the Telemetry page read-only, with no banner. The proxy still starts and logs a warning that names the variable.

There are two destinations, and the proxy never picks one for you:

| Destination | Where reports go | Needs |
|---|---|---|
| `http` | Each worker POSTs one JSON report per window to `LITELLM_TELEMETRY_ENDPOINT`, and once more on shutdown. After a network error, a 5xx, 408, 409 or 429, the next report starts at the failed window and adds its counts, unless the groups or destination change first. Reports carry no id, so a receiver that stored the failed POST counts that window twice. Any other response drops that report, and the shutdown report is never retried | `LITELLM_TELEMETRY_ENDPOINT`. Without it, `LITELLM_TELEMETRY_DESTINATION=http` leaves telemetry off, and the UI cannot save `http` |
| `local_table` | Each worker stores one report per window in the `LiteLLM_TelemetryReport` table, kept for `LITELLM_TELEMETRY_RETENTION_DAYS`. Nothing leaves the proxy, and an air-gapped install can export reports by hand (see [Export reports](#export-reports)) | A database |

If groups are on but no destination is chosen, or the chosen one is not available, nothing is recorded and the proxy logs a warning. The Telemetry page only flags a missing destination, so a saved `http` destination whose `LITELLM_TELEMETRY_ENDPOINT` was later removed still shows there as the destination. A proxy with neither a database nor `LITELLM_TELEMETRY_ENDPOINT` records nothing and logs no warning. A destination switched from the UI takes effect at each worker's next report window, like the groups. `LITELLM_TELEMETRY_DESTINATION` wins over the saved destination.

## Groups

Each group needs the one it builds on. `token_info` and `request_taxonomy` both build on `request_success`, so either can be on without the other. Turning a group off strips its fields before anything is counted, so rows that differed only in those fields merge into one.

| Group | Needs | Adds |
|---|---|---|
| `heartbeat` | | The report header: instance id, version, window and which groups are on. With only this group a report has no rows |
| `request_success` | `heartbeat` | Request rows with endpoint, status classes, stream, LiteLLM cache hit, whether the Rust gateway handled the request, request count, provider attempts and the two latency histograms |
| `token_info` | `request_success` | Token sums and provider prompt-cache hit on each request row |
| `request_taxonomy` | `request_success` | Provider and deployment hash on each request row, plus provider attempt rows |
| `event_details` | `request_taxonomy` | Block counts, block types and allowlisted header names on each request row |
| `instance_configuration` | `heartbeat` | Names of allowlisted config keys that are set. Nothing fills this yet, so it adds an empty list |
| `page_navigation` | `heartbeat` | Admin UI page views and tab switches |

## What a report contains

Each worker folds what it sees into in-memory counters and emits one report per 5 minute window. Reports are counts, sums and fixed-bucket histograms instead of individual requests.

**Report header**

| Field | Meaning |
|---|---|
| `schema_version` | Version of the report format |
| `window_start`, `window_end` | Unix timestamps of the window |
| `instance.instance_id` | Random id stored in the proxy database, the same for every worker and across restarts. Without a database each worker makes a new one on every boot |
| `instance.litellm_version` | The running LiteLLM version |
| `instance.groups` | The groups that are on |
| `instance.config_keys` | `instance_configuration` only. Names of allowlisted config keys that are set, never their values. Empty for now |
| `dropped_records` | Records that did not fit, since a window holds at most 2000 distinct rows |

Only POST requests to LLM and provider pass-through routes, MCP requests and A2A requests whose path ends in `/message/send` are counted. JSON-RPC calls to `POST /a2a/{agent_id}`, the URL an agent card advertises, are never counted, so A2A clients that use that URL leave no rows. Admin and management routes and websocket routes such as `/v1/realtime` are never counted, and pass-through endpoints you define in your config are only counted when their path ends like an LLM route, such as `/chat/completions`.

Provider pass-through requests are counted, but their rows have no provider, provider attempts or token counts yet, except Bedrock and GigaChat requests for a model on your model list. Most are recorded under their prefix, so `/anthropic/v1/messages` reads as `/anthropic`. A pass-through path that ends like an LLM route is recorded under that route instead, so `/openai/v1/chat/completions` reads as `/chat/completions` and looks like a native request that called no provider.

**Request rows** hold one row per distinct combination of:

| Field | Meaning |
|---|---|
| `endpoint` | The matched route, such as `/chat/completions`, `/v1/messages`, `:generateContent`, a pass-through prefix like `/anthropic`, `/mcp` or `/a2a`. Never the raw path |
| `handled_by_rust` | Whether the response came from the Rust gateway, read from its `x-litellm-rust: true` response header |
| `provider` | `request_taxonomy` only. Provider of the deployment that served the request, such as `anthropic`, or `null` when no provider was called |
| `deployment_hash` | `request_taxonomy` only. First 16 hex characters of an HMAC-SHA256 of the deployment id, keyed by a random secret the proxy creates once and keeps in `LiteLLM_Config`, so it stays the same across workers and restarts and cannot be matched across installs. A proxy without a database keys it from `LITELLM_SALT_KEY` or the master key instead, so proxies that share that key give the same hashes, and with neither each worker picks a random key on every boot. A worker that cannot read the stored secret at start uses the salt key until it restarts |
| `litellm_status` | Status class the client got: `2xx`, `3xx`, `4xx`, `5xx` |
| `provider_status` | Status class of the last provider call: `2xx` through `5xx`, `timeout` and `connection_error` when no provider response arrived, or `none` when no provider was called |
| `litellm_cache_hit` | Whether the LiteLLM response cache answered |
| `provider_cache_hit` | `token_info` only. Whether the last provider call reported a prompt cache read |
| `stream` | Whether the response was a `text/event-stream` stream. Other streamed responses, such as Bedrock event streams or streamed `/audio/speech`, read `false` |

A LiteLLM cache hit is the exception to the `provider` and `provider_status` rules above. Its row carries the deployment's `provider` and a `2xx` `provider_status`, and with `token_info` the cached response's token counts, though `provider_attempts` is 0.

Each request row carries `request_count`, histograms of `latency_to_headers_ms` and `latency_to_first_byte_ms` as seen by the client, measured from when the proxy receives the request to its response headers and to the first non-empty response body chunk. There is no total latency, since for a stream it mostly reflects how long the response is. Each row also carries `provider_attempts` (how many provider calls retries and fallbacks made). With `token_info` it also carries sums of `input_tokens`, `output_tokens` and `cache_read_tokens`. With `event_details` it also carries a `block_count` histogram, `block_types` counts (`text`, `image`, `audio`, `file`, `tool_use`, `tool_result`, `thinking`, `other`) and `header_keys` counts.

Blocks are only counted from a request's `messages` list, so rows for requests without one, such as embeddings, have empty block counts.

`header_keys` only names headers from a fixed allowlist: `anthropic-beta`, `anthropic-version`, `openai-beta`, `openai-organization`, `x-litellm-api-key`, `x-litellm-disable-callbacks`, `x-litellm-enable-message-redaction`, `x-litellm-num-retries`, `x-litellm-tags`, `x-litellm-timeout`, `x-stainless-lang` and `x-stainless-package-version`. Any other header is counted as `other`. Header values are never read.

**Provider attempt rows** (`request_taxonomy`) count every individual provider call, keyed on `provider` (`unknown` when the call has none), `deployment_hash`, `provider_status` and `stream`, with an `attempt_count` and a `latency_to_first_token_ms` histogram that only streamed attempts fill. There is no total attempt latency, since for a stream it mostly reflects how long the response is. A request that was refused by the proxy before routing, for example a bad key or an exceeded budget, adds no attempt row.

**Admin UI events** (`page_navigation`) count page views and tab clicks as `page`, `action` and `target`, for example `{"page": "playground", "action": "click", "target": "tab=compare", "count": 1}`. The dashboard sends the first segment of its route as the page, which never contains an id. The proxy only checks that `page` is at most 48 lowercase letters and hyphens, so any signed-in user who calls `POST /telemetry/ui_events` directly can put any such word there, a model name such as `claude-haiku` included. The browser asks the proxy whether `page_navigation` is on and only then sends these to the proxy's own `POST /telemetry/ui_events` route, never to a third party.

Latency histograms use the bucket bounds 50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000, 60000 and 120000 ms. Each bucket counts values up to and including its bound, and a last bucket counts anything slower. Each histogram in a report is an object with `counts`, one per bucket, and `invalid`, the number of negative, NaN or infinite values that were left out of the buckets. The bounds are not sent. They are fixed for a given `schema_version`, and changing them bumps it. For `schema_version` 1, `block_count` uses the bounds 1, 5, 20 and 100 and `provider_attempts` uses 0, 1, 2 and 3, each with a last bucket for anything above.

## Export reports

When reports are kept locally, a proxy admin or admin viewer can page through them:

```bash
curl -s "http://localhost:4000/telemetry/reports?limit=500" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY"
```

The response holds `reports` plus `next_after` and `next_after_id`. Pass those back as `after` and `after_id` to get the next page, until `next_after` is `null`. `limit` defaults to 500 and goes up to 5000. Another worker can commit a report just after a newer one was exported, so when you resume a later export, start a few windows before your last cursor and skip report ids you already have. Windows with no rows are not stored, so with only `heartbeat` on the table stays empty. Each time a worker stores a report, it deletes reports older than `LITELLM_TELEMETRY_RETENTION_DAYS` (30 by default), so after traffic stops the old reports stay until the next report is stored.

## Settings

| Environment variable | Description |
|---|---|
| `LITELLM_TELEMETRY_DISABLED` | `true` forces every group off, whatever is set elsewhere |
| `LITELLM_TELEMETRY_GROUPS` | Comma-separated groups to turn on. When set, it overrides the Admin UI settings, and an empty value means off |
| `LITELLM_TELEMETRY_DESTINATION` | `local_table` or `http`. When set, it overrides the destination saved in the Admin UI. With neither set, nothing is recorded |
| `LITELLM_TELEMETRY_ENDPOINT` | HTTP or HTTPS URL that receives one JSON report per window when the destination is `http`. The proxy sends only `content-type` and `user-agent` headers and no auth header, so a receiver that needs a token has to read it from the URL |
| `LITELLM_TELEMETRY_SETTLE_TIMEOUT_SECONDS` | How long a finished request waits for its provider attempts to be logged before its row is written. Default is `2` |
| `LITELLM_TELEMETRY_RETENTION_DAYS` | How long locally kept reports are retained. Default is `30` |

The old `--telemetry` CLI flag still parses but does nothing.
