---
title: "Migrate Langfuse Callback to OpenTelemetry v2"
sidebar_label: "Migrate the Langfuse SDK callback to OpenTelemetry v2"
description: "Move from the langfuse SDK callback to langfuse_otel on OpenTelemetry v2. Lists the breaking changes, the migration steps, how to verify, and how to roll back."
---
# Migrate the Langfuse SDK callback to OpenTelemetry v2

{/* keep-version-note */}

This guide moves a proxy from the SDK-based `langfuse` callback to the `langfuse_otel` callback on OpenTelemetry v2. Read the breaking changes before you start. With default settings, V2 sends far more data to Langfuse than the SDK callback did and leaves prompts out, so a plain callback swap changes both your Langfuse bill and what your traces show.

If you already run `langfuse_otel` without `LITELLM_OTEL_V2`, follow the [general V2 migration guide](./opentelemetry_v2_migration) instead.

## Breaking changes

Each of these takes effect as soon as you switch, and each has a setting that brings back the SDK behavior.

| What changed | What you see after switching | What to do |
|---|---|---|
| **Trace volume.** V2 sends the whole request tree by default | Every request adds HTTP, auth, Postgres, Redis, guardrail, MCP and spend-write spans, and admin calls such as `/model/info` become traces of their own. Langfuse ingestion can grow by an order of magnitude or more at the same request rate | Set `LITELLM_OTEL_LANGFUSE_SPAN_SCOPE=llm_only` for your own project and `LITELLM_OTEL_LANGFUSE_DESTINATION_SPAN_SCOPE=llm_only` <SinceVersion v="1.111.0" /> for key and team projects. On older releases, set `langfuse_span_scope: llm_only` on each key and team callback |
| **Prompt capture.** V2 captures no message content by default | Input and output are empty in Langfuse | Set `OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT=span_only`. This applies to every V2 OTel callback on the proxy. A key or team can override it with `capture_message_content` <SinceVersion v="1.108.0" /> |
| **Default host.** Without `LANGFUSE_HOST`, V2 sends to the US cloud (`https://us.cloud.langfuse.com`), while the SDK callback used the EU cloud (`https://cloud.langfuse.com`). `LANGFUSE_BASE_URL` is not read | Exports go to the wrong region and fail with 401 | Set `LANGFUSE_HOST` explicitly |
| **Stored key and team callbacks.** Saved `langfuse` entries are not converted | Those keys and teams keep logging through the SDK callback, or log twice once you add `langfuse_otel` | Re-register each one as `langfuse_otel` and delete the old entry ([step 3](#3-move-key-and-team-callbacks)) |
| **Secret field name.** V2 reads `langfuse_secret_key` only | An entry saved with the older `langfuse_secret` field logs to your project instead of the tenant's, with no error | Use `langfuse_secret_key` when you re-register |
| **Custom tenant hosts.** A `langfuse_host` on a key or team needs an allowlist entry | That tenant's traces are not sent to its host, and the proxy logs a warning | Add the host to `provider_url_destination_allowed_hosts` |
| **Other OTel callbacks.** `LITELLM_OTEL_V2=true` moves every OTel callback on the proxy to V2, except `logfire` | Your `otel`, Arize, Phoenix and similar exports change too | Check them against the [general V2 migration guide](./opentelemetry_v2_migration) before you set the flag |
| **Self-hosted servers.** V2 exports to `/api/public/otel/v1/traces` | Langfuse v2 servers return HTTP 404 | Upgrade the server first. The SDK callback has used the same endpoint since v1.104.0, so a server that works with your current setup on that release or newer is fine |

Metadata fields also change shape. See [Field changes](#field-changes) before you rely on dashboards, filters or masking.

## Migrate

### 1. Prepare

Upgrade the proxy. <SinceVersion v="1.109.0" /> is the minimum this guide assumes, since it is the first release where key and team projects work without proxy-wide Langfuse keys.

Record Langfuse ingestion for a fixed sample of requests on the SDK callback, so you have a baseline to compare against. Then save your current `callbacks`, `success_callback` and `failure_callback` config and every stored key and team `langfuse` entry (`GET /team/<team-id>/callback`, `GET /key/info`). You need these to roll back.

### 2. Switch the proxy callback

Replace `langfuse` with `langfuse_otel`. Remove `langfuse` from `callbacks`, `success_callback` and `failure_callback`, because running both callbacks logs every request twice.

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

Restart the proxy. Spell the scope values exactly as `llm_only` or `full`. An invalid `LITELLM_OTEL_LANGFUSE_SPAN_SCOPE` stops every V2 callback from loading, and the presets quietly fall back to the older OTel integration.

If you only want traces in key and team projects, with no proxy-wide Langfuse project, leave out `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY` and the `callbacks` line, and keep `LITELLM_OTEL_V2=true`.

### 3. Move key and team callbacks

Register `langfuse_otel` on each team that had a `langfuse` entry, with the same credentials, then delete the old entry.

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

For a key, replace the `langfuse` entry in its `metadata.logging` with the same object, through `/key/update` or the key's logging settings in the Admin UI. With `LITELLM_OTEL_LANGFUSE_DESTINATION_SPAN_SCOPE` set you can leave `langfuse_span_scope` out of each entry. Use `callback_type: success`. V2 picks the destination before the request has an outcome, so a success entry also receives that tenant's failed requests.

If a key or team sets `langfuse_host`, pass its key pair with it and allowlist the host. Your own `LANGFUSE_HOST` needs no entry.

```yaml
litellm_settings:
  provider_url_destination_allowed_hosts: ["langfuse.example.com"]
```

A key or team project replaces your own project for that request. To keep a copy in yours as well, set `otel_tenant_destination_mode: additive` under `litellm_settings`. See [per-key and per-team credentials](./opentelemetry_v2#per-key--per-team-credentials-multi-tenant) for the full routing rules.

### 4. Verify on staging

Point staging at a separate Langfuse project and send a plain request, a streaming request, a request that fails at the provider, and a request a guardrail blocks if you use guardrails. Send the same metadata and redaction settings your apps send in production.

Open each trace's observation tree in Langfuse and count the observations in the tree, not the rows in the trace list. Under `llm_only` you should see one generation per provider call and nothing else, with input, output, token usage, cost, trace name, user, session and tags filled in. A guardrail block before the model call leaves nothing under `llm_only`. Requests from a key or team with its own callback should land in that project. Compare ingestion for your sample against the baseline from step 1.

### 5. Roll out

Roll out in stages. Watch the proxy logs for exporter errors, where a 404 means the server has no OTLP endpoint and a 401 means the wrong key pair or region, and watch Langfuse ingestion. Update dashboards and saved filters using [Field changes](#field-changes).

## Roll back

Restore the saved callback config and the stored key and team `langfuse` entries, remove `langfuse_otel`, unset `LITELLM_OTEL_V2` if you turned it on for this migration only, and restart. Turning off the flag while `langfuse_otel` is still configured does not bring back the SDK callback. It switches `langfuse_otel` to the older OTel integration instead. Confirm that one generation arrives through the SDK callback before you send all traffic back.

## Field changes

| SDK callback field | On V2 |
|---|---|
| `trace_name`, `langfuse_trace_name` header | Unchanged. With no name set, a `full` trace is named `litellm-{call_type}` and an `llm_only` trace takes the generation's name |
| `generation_name` | Ignored. Generations are named `{operation} {model}`, for example `chat gpt-4o`, where the SDK callback used `litellm:{key_alias}` or `litellm-{call_type}`. Update name filters |
| `trace_user_id`, `langfuse_trace_user_id` header | Unchanged, but no longer falls back to the end-user ID |
| `session_id`, `langfuse_session_id` header | Unchanged |
| `tags` | Unchanged. Key tags, team tags and the `x-litellm-tags` header are included |
| `trace_release`, `trace_version`, `LANGFUSE_TRACING_ENVIRONMENT` | Mapped <SinceVersion v="1.111.0" />. `LANGFUSE_RELEASE` is not read |
| `trace_id`, `existing_trace_id`, `update_trace_keys` | Ignored. Link traces with a W3C `traceparent` header. V2 cannot update an existing trace |
| `generation_id`, `parent_observation_id` | Ignored. The observation ID is the LiteLLM call ID, which a caller can set with the `x-litellm-call-id` header |
| `trace_metadata`, custom generation metadata | Not passed through. Allowlist the keys you need with `LITELLM_OTEL_BAGGAGE_METADATA_KEYS`, see [request identity](./opentelemetry_v2#request-identity-on-every-span) |
| Usage `cache_read_input_tokens`, `cache_creation_input_tokens` | Renamed to `input_cached_tokens` and `input_cache_creation`. Reasoning tokens move out of `output` into `output_reasoning_tokens` |
| `mask_input`, `mask_output`, `langfuse_masking_function` | Ignored. With capture on, a caller that relied on them sends its prompt. Use `turn_off_message_logging` with `llm_only`, or `capture_message_content: no_content` on that destination |
| `redact_user_api_key_info` | Still strips key fields from Langfuse metadata, but not the `litellm.metadata.user_api_key_alias`, `user_api_key_user_id`, `user_api_key_end_user_id` and `user_api_key_org_id` attributes V2 adds to every span |
| Langfuse prompt link | Not supported. Generations are no longer linked to Langfuse prompts |
| `debug_langfuse` | Ignored |

## Keep the full trace instead

If you want auth, database, cache and guardrail spans in Langfuse, set both scopes to `full`. Unset also means `full`, but setting it explicitly records that someone accepted the extra ingestion.

```shell
export LITELLM_OTEL_LANGFUSE_SPAN_SCOPE=full
export LITELLM_OTEL_LANGFUSE_DESTINATION_SPAN_SCOPE=full
```

Dashboards that counted observations no longer count LLM calls. Filter on the model-call observations, such as `chat gpt-4o`, for usage and cost, and use the full tree for latency and failures. Spend writes and background database polls arrive as separate traces, and requests blocked before the model call have no generation.

:::warning Redaction under `full`

With capture on, `turn_off_message_logging` redacts the generation only. The request root span (`POST /v1/chat/completions`) still carries the raw prompt and response, including for `no-log` requests, and MCP tool arguments, tool results and guardrail responses are sent unredacted. If prompts must not reach Langfuse, use `llm_only`. `no_content` under `full` still sends guardrail responses, so pair it with `llm_only` too.

:::

For every V2 setting, see [OpenTelemetry v2](./opentelemetry_v2).
