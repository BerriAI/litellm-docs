---
title: "Migrate Langfuse Callback to OpenTelemetry v2"
sidebar_label: "Migrate the Langfuse SDK callback to OpenTelemetry v2"
description: "Move from the langfuse SDK callback to langfuse_otel on OpenTelemetry v2. Lists the breaking changes, the migration steps, how to verify, and how to roll back."
---
# Migrate the Langfuse SDK callback to OpenTelemetry v2

{/* keep-version-note */}

This guide takes a proxy from the SDK based `langfuse` callback to the `langfuse_otel` callback on OpenTelemetry v2. Read the breaking changes before you start. With the default settings V2 will be sending a lot more data to Langfuse than the SDK callback did and will be omitting the prompts entirely. A straight swap of callbacks will therefore change both your Langfuse bill and what your traces show.

If you're already running `langfuse_otel` without `LITELLM_OTEL_V2` then follow the [general V2 migration guide](./opentelemetry_v2_migration) instead.

## Breaking changes

Each of those takes effect immediately on switch and each has a setting which reverts to the SDK behavior.

| What changed | What you see after switching | What to do |
|---|---|---|
| **Trace volume.** V2 sends the entire request tree by default | Each request will generate an HTTP, auth, Postgres, Redis, guardrail, MCP and spend-write span plus all the admin calls (e.g. `/model/info`) will become their own trace. Langfuse ingestion can easily be an order of magnitude higher at the same request rate | Set `LITELLM_OTEL_LANGFUSE_SPAN_SCOPE=llm_only` for your own project and `LITELLM_OTEL_LANGFUSE_DESTINATION_SPAN_SCOPE=llm_only` <SinceVersion v="1.111.0" /> for key and team projects. On older releases you'll need to set `langfuse_span_scope: llm_only` on each key and team callback |
| **Prompt capture.** V2 captures no message content by default | Input and output are empty in Langfuse | Set `OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT=span_only`. This applies to every V2 OTel callback on the proxy. A key or team can override it with `capture_message_content` <SinceVersion v="1.108.0" /> |
| **Default host.** Without `LANGFUSE_HOST` V2 sends to the US cloud (`https://us.cloud.langfuse.com`), the SDK callback was using the EU cloud (`https://cloud.langfuse.com`). `LANGFUSE_BASE_URL` is not read | Exports to the wrong region and fail with 401 | Set `LANGFUSE_HOST` explicitly |
| **Stored key and team callbacks.** Saved `langfuse` entries are not converted | Those keys and teams will continue to log via the SDK callback, or will log twice if you add `langfuse_otel` | Re-register each as `langfuse_otel` and delete the old entry ([step 3](#3-move-key-and-team-callbacks)) |
| **Secret field name.** V2 reads `langfuse_secret_key` only | An entry saved with the old `langfuse_secret` field logs to your project rather than the tenant's, with no error | Use `langfuse_secret_key` when you re-register |
| **Custom tenant hosts.** A `langfuse_host` on a key or team requires an allowlist entry | That tenant's traces aren't sent to its host and the proxy logs a warning | Add the host to `provider_url_destination_allowed_hosts` |
| **Other OTel callbacks.** `LITELLM_OTEL_V2=true` moves all OTel callbacks on the proxy to V2 (with the exception of `logfire`) | Your `otel`, Arize, Phoenix and similar exports will also be affected | Check them against the [general V2 migration guide](./opentelemetry_v2_migration) prior to setting the flag |
| **Self-hosted servers.** V2 exports to `/api/public/otel/v1/traces` | Langfuse v2 servers return HTTP 404 | Upgrade the server first. The SDK callback has been using the same endpoint since v1.104.0 so a server that works with your current setup on that version or later is fine. |

Metadata fields also change shape. See [Field changes](#field-changes) prior to relying on any dashboards, filters or masking.

## Migrate

### 1. Prepare

Upgrade the proxy. This guide assumes <SinceVersion v="1.109.0" /> or later as that's the first release where key and team projects will work without requiring proxy wide Langfuse keys.

Record a Langfuse ingestion for a fixed sample of requests on the SDK callback so that you have a baseline to compare it against. Then save your current `callbacks`, `success_callback` and `failure_callback` config and all your stored keys and team `langfuse` entries (`GET /team/<team-id>/callback`, `GET /key/info`). You're going to need all of that to roll back.

### 2. Switch the proxy callback

Replace `langfuse` with `langfuse_otel`. Remove `langfuse` from `callbacks`, `success_callback` and `failure_callback` as running both callbacks ends up logging every request twice.

```yaml
litellm_settings:
  callbacks: ["langfuse_otel"]
```

```shell
export LITELLM_OTEL_V2=true
export LANGFUSE_PUBLIC_KEY="pk-lf-..."
export LANGFUSE_SECRET_KEY="sk-lf-..."
export LANGFUSE_HOST="https://cloud.langfuse.com"   # your region or self-hosted URL
export LITELLM_OTEL_LANGFUSE_SPAN_SCOPE=llm_only
export LITELLM_OTEL_LANGFUSE_DESTINATION_SPAN_SCOPE=llm_only   # key and team projects
export OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT=span_only
```

Restart the proxy. Spell the scope values out exactly as `llm_only` or `full`. An invalid `LITELLM_OTEL_LANGFUSE_SPAN_SCOPE` will stop every V2 callback from loading and the presets will just quietly fall back to the old OTel integration.

If you just want traces in the key and team projects with no proxy wide Langfuse project then omit `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY` and the `callbacks` line and keep `LITELLM_OTEL_V2=true`.

### 3. Move key and team callbacks

Register `langfuse_otel` on each team that had a `langfuse` entry using the same credentials and then delete the old entry.

```shell
curl -X POST 'http://localhost:4000/team/<team-id>/callback' \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "callback_name": "langfuse_otel",
    "callback_type": "success",
    "callback_vars": {
      "langfuse_public_key": "pk-lf-...",
      "langfuse_secret_key": "sk-lf-...",
      "langfuse_span_scope": "llm_only",
      "capture_message_content": "span_only"
    }
  }'

curl -X DELETE 'http://localhost:4000/team/<team-id>/callback/langfuse' \
  -H "Authorization: Bearer $LITELLM_API_KEY"
```

For a key, replace the `langfuse` entry in its `metadata.logging` with the same object via `/key/update` or the key's logging settings in the Admin UI. With `LITELLM_OTEL_LANGFUSE_DESTINATION_SPAN_SCOPE` set you can omit `langfuse_span_scope` from each entry. Use `callback_type: success`. V2 picks the destination prior to the request having an outcome so a success entry will also receive that tenant's failed requests.

If a key or team sets `langfuse_host` then pass along its key pair with it and allowlist the host. Your own `LANGFUSE_HOST` requires no entry.

```yaml
litellm_settings:
  provider_url_destination_allowed_hosts: ["langfuse.example.com"]
```

A key or team project will be used to fulfil that request. If you want to keep a copy in yours as well then set `otel_tenant_destination_mode: additive` under `litellm_settings`. See [per-key and per-team credentials](./opentelemetry_v2#per-key--per-team-credentials-multi-tenant) for the full routing rules.

### 4. Verify on staging

Point stage at a separate Langfuse project and send a plain request, a streaming request, a request that fails at the provider and a request that a guardrail would block if you're using guardrails. Send the same metadata and redaction settings that your apps send in production.

Open up each trace's observation tree in Langfuse and count the observations in the tree (not the rows in the trace list). Under `llm_only` you should see one generation per provider call and nothing else, with input, output, token usage, cost, trace name, user, session and tags all populated. The guardrail block prior to the model call will leave nothing under `llm_only`. Requests from a key or team that has its own callback will end up in that project. Compare the ingestion for your sample against the baseline from step 1.

### 5. Roll out

Roll it out in stages. Monitor the proxy logs for exporter errors (404 means the server has no OTLP endpoint, 401 means the wrong key pair or region) and Langfuse ingestion. Update your dashboards and saved filters using [Field changes](#field-changes).

## Roll back

Restore the saved callback config and the stored key and team `langfuse` entries. Remove `langfuse_otel`, unset `LITELLM_OTEL_V2` if you turned it on for this migration only and then restart. If you turn the flag off whilst `langfuse_otel` is still configured you do not get the SDK callback back. It just switches `langfuse_otel` over to the old OTel integration. Make sure one generation gets through the SDK callback prior to sending all the traffic back.

## Field changes

| SDK callback field | On V2 |
|---|---|
| `trace_name`, `langfuse_trace_name` header | Unchanged. If no name is set an `full` trace becomes `litellm-{call_type}` and an `llm_only` trace takes on the name of the generation |
| `generation_name` | Ignored. Generations are named `{operation} {model}` for instance (`chat gpt-4o`), with the SDK callback using `litellm:{key_alias}` or `litellm-{call_type}`). Update the name filters. |
| `trace_user_id`, `langfuse_trace_user_id` header | Unchanged, but no longer falls back to the end-user ID |
| `session_id`, `langfuse_session_id` header | Unchanged |
| `tags` | Unchanged. Key tags, team tags and the `x-litellm-tags` header are included |
| `trace_release`, `trace_version`, `LANGFUSE_TRACING_ENVIRONMENT` | Mapped <SinceVersion v="1.111.0" />. `LANGFUSE_RELEASE` is not read |
| `trace_id`, `existing_trace_id` | On the proxy calls that have the same value in `metadata` or `litellm_metadata` (or a `langfuse_trace_id` header) will share one trace (see [trace ID with `langfuse_otel`](./langfuse_integration#trace-id-with-langfuse_otel)). A W3C `traceparent` header will win if both are present. V2 cannot update the fields of an existing trace. |
| `update_trace_keys` | Ignored. V2 cannot update an existing trace |
| `generation_id`, `parent_observation_id` | Ignored. The observation ID is the LiteLLM call ID which a caller can set via the `x-litellm-call-id` header. |
| `trace_metadata`, custom generation metadata | Not passed through. Allowlist the keys you require via `LITELLM_OTEL_BAGGAGE_METADATA_KEYS` (see [request identity](./opentelemetry_v2#request-identity-on-every-span)) |
| Usage `cache_read_input_tokens`, `cache_creation_input_tokens` | Renamed to `input_cached_tokens` and `input_cache_creation`. Reasoning tokens move out of `output` into `output_reasoning_tokens` |
| `mask_input`, `mask_output`, `langfuse_masking_function` | Ignored. If a caller is using them and has capture on, it will send its prompt. Use `turn_off_message_logging` with `llm_only` or `capture_message_content: no_content` on that destination. |
| `redact_user_api_key_info` | Still strips the key fields from the Langfuse metadata, just not the `litellm.metadata.user_api_key_alias`, `user_api_key_user_id`, `user_api_key_end_user_id` and `user_api_key_org_id` attributes that V2 adds to every span. |
| Langfuse prompt link | Not supported. Generations are no longer linked to Langfuse prompts |
| `debug_langfuse` | Ignored |

## Keep the full trace instead

If you want auth, database, cache and guardrail spans in Langfuse then set both scopes to `full`. Unset is also `full`, just setting it explicitly means that you've accepted the extra ingestion.

```shell
export LITELLM_OTEL_LANGFUSE_SPAN_SCOPE=full
export LITELLM_OTEL_LANGFUSE_DESTINATION_SPAN_SCOPE=full
```

Dashboards that were counting observations are no longer counting LLM calls. You can filter on the model call observations (e.g. `chat gpt-4o`) for usage and cost and use the full tree for latency and failures. Spend writes and background database polls come in as separate traces and requests that were blocked prior to the model call have no generation.

:::warning Redaction under `full`

With capture on `turn_off_message_logging` only redacts the generation. The request root span (`POST /v1/chat/completions`) still has the raw prompt and response (including for `no-log` requests). MCP tool args, tool results and guardrail responses are all sent unredacted. If you want the prompts not to make it to Langfuse then use `llm_only`. `no_content` under `full` still transmits the guardrail responses so you'll need to pair that with `llm_only` too.

:::

For each V2 setting, see [OpenTelemetry v2](./opentelemetry_v2).
