# Migrate the Langfuse SDK callback to OpenTelemetry v2

{/* keep-version-note */}

## Turn it on

Read [What changes](#what-changes) first, then:

1. Replace `langfuse` with `langfuse_otel` in your callbacks.
2. Set `LITELLM_OTEL_V2=true`.
3. Set the scope to either [Path A](#path-a-llm-only-logging-with-fewer-breaking-changes) (LLM only logging) or [Path B](#path-b-explicitly-opt-into-the-full-request-trace) (full tracing). If no scope is specified the proxy runs at `full`.
4. Restart the proxy.

The flag also moves your other OTel callbacks (other than `logfire`) to V2. See the [general V2 migration guide](./opentelemetry_v2_migration).

## What changes

### Ingestion volume and scope

:::danger Ingestion costs

The default `full` scope can increase Langfuse ingestion by an order of magnitude or more at the same request rate.

:::

Replace `langfuse` with `langfuse_otel` and set `LITELLM_OTEL_V2=true` and that's what Langfuse will end up with. The default scope is `full` (not LLM only). It will capture the HTTP root, auth, Postgres, Redis, guardrails, MCP tools, model calls and spend-write spans as they happen. Admin requests will also produce traces. This could see Langfuse ingestion go up by an order of magnitude or more. Don't assume that the same request rate will lead to the same Langfuse bill.

Use `llm_only` <SinceVersion v="1.103.0" /> for the best volume match to the legacy callback. A single request with a single provider call will result in one generation being sent, a request with multiple provider calls can result in multiple generations being sent. This is not a guarantee of identical billing. Guardrail blocks prior to a model call and MCP only activity will result in no observations being recorded in that destination under `llm_only`.

### Server compatibility and HTTP 404

Self-hosted Langfuse OSS v2 servers don't expose the `/api/public/otel/v1/traces` endpoint and will return an HTTP 404 if you try to do an OTLP export. The SDK callback has been using that same endpoint since LiteLLM v1.104.0 so this only applies to you if you're migrating from an older release. You'll need to upgrade the server prior to cutover. The [Langfuse integration](./langfuse_integration) docs state that a server **3.63.0 or newer** is required for SDK v4. That doesn't necessarily mean that every server prior to that version will support the OTel preset. You must confirm OTLP ingestion works on your target server before you do a production cutover.

### Content capture is off by default

V2 defaults to `no_content` so your Langfuse input/output will be blank unless you turn on span content capture via `OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT=span_only` or turn it on for a tenant destination <SinceVersion v="1.108.0" />. If you turn capture on you'll be sending sensitive content. Check redaction first. The variable is global so it also turns capture on for every other V2 OTel callback on the proxy.

### Names and metadata are not drop-in compatible

The V2 Langfuse mapper has no equivalent to the legacy `generation_name`, custom generation IDs, `existing_trace_id`, trace mutation, version/release fields and prompt linking. Any dashboards or integrations you've saved that are relying on any of those fields will need to be updated. See [How legacy fields map](#how-legacy-fields-map).

### Key and team destinations

The stored key/team callback `langfuse` is still the SDK callback. Change it to `langfuse_otel` (same credentials), explicitly set its scope and content policy. V2 reads only `langfuse_secret_key` so an entry saved with the older `langfuse_secret` name will log to your project with no error. The global scope variable does not restrict tenant destinations. V2 defaults to `override` routing so a tenant's Langfuse destination will take over your global Langfuse exporter for that request. Under `full` the database reads that resolve the key during auth still go to your exporter in both modes. `additive` will keep both. A custom `langfuse_host` will require its key pair and an entry in `general_settings.provider_url_destination_allowed_hosts`. An unreachable tenant destination will not fall back to your project. A destination missing its key pair will send that request to your project with no error. A tenant host missing from the allowlist is skipped with a warning, so the model call will go to your Langfuse host as its own trace (signed with the tenant's keys) and the rest of the request will go to your project. All of this requires your own `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` on the proxy as without them `langfuse_otel` will fall back to the older OTel integration and V2 tenant routing won't apply. See [tenant routing](./opentelemetry_v2#what-the-tenant-receives).

### Duplicate callbacks

Don't leave both callbacks enabled for the same traffic and project. `langfuse` and `langfuse_otel` are separate integrations and if both are enabled they will both log the request which will result in duplicate observations and extra ingestion. Turning on `LITELLM_OTEL_V2` in no way turns the SDK callback into full tree tracing. The SDK callback will still generate one generation for its logged call. You'll have to remove it from the global success/failure callbacks and from the stored key/team callbacks if you're replacing it.

### Redaction and capture

Redaction and capture are distinct controls. A successful call goes through LiteLLM's shared `turn_off_message_logging` redaction prior to V2 even seeing the logging payload. Under `llm_only` a capture opt-in has no effect on the redaction that has already taken place in that first stage. Under the default `full` scope it does have an effect as the request root observation (`POST /v1/chat/completions`) will still contain the raw prompt and response with `turn_off_message_logging` on, whilst the generation will be `redacted-by-litellm`. The root will contain them for `no-log` requests too (the SDK callback will have skipped them) and `full` will send MCP tool arguments and results and guardrail responses without message redaction. If you're redacting messages and turning on capture then you must have `llm_only` on the operator and on every key and team destination as a destination without `langfuse_span_scope` runs at `full`. Don't assume that this proves redaction on the failure paths. You have to test redaction on the failure paths separately and you must have `no_content` on any destination where it is absolutely critical that the message content doesn't make it to that destination. Under `full` `no_content` will still send guardrail responses which can contain the checked text so you must have `llm_only` there too. The request metadata that V2 exports for the `user_api_key_*` fields is using the same `redact_user_api_key_info` helper as the SDK callback. It does not redact the `litellm.metadata.*` identity attributes that V2 puts on every span post auth (`user_api_key_alias`, `user_api_key_user_id`, `user_api_key_org_id` and `user_api_key_end_user_id` plus `requester_ip_address` on MCP spans), the team identity, the key hash or the client address and user agent on the `full` root span and it's not a general purpose anonymisation switch. V2 ignores the per-request `mask_input` and `mask_output` metadata and the `langfuse_masking_function` parameter so a caller that relies on those will end up sending its prompt once capture is on. You need to test your actual redaction policy with capture enabled prior to rollout.

## Choose a migration path

The [Langfuse integration recommendation](./langfuse_integration) is to use the **OpenTelemetry v2 `langfuse_otel` preset**. The [V2 scope guidance](./opentelemetry_v2#send-only-the-model-calls-to-langfuse) is to use **`llm_only`** unless you specifically need infrastructure spans in Langfuse. `full` is the implementation default but it's not the recommended scope for every deployment. Path A is following that scope recommendation. Path B is an explicit opt-in to full trace collection for those teams that need it.

## Path A, LLM-only logging with fewer breaking changes

Keep your model config and replace the legacy logging callback with this proxy config. Get rid of any `success_callback: ["langfuse"]` or `failure_callback: ["langfuse"]` instances (rather than just adding on the new callback).

```yaml
litellm_settings:
  callbacks: ["langfuse_otel"]
```

Set the environment and restart the proxy. Use the host for your Langfuse region or for your self hosted deployment. A misspelt scope value will break every V2 callback (not just Langfuse). The presets will fall back to the old OTel integration which in turn will take over the key and team `langfuse_otel` entries without their scope and will simply stop the generic `otel` callback. So use `llm_only` exactly.

```shell
export LITELLM_OTEL_V2=true
export LANGFUSE_PUBLIC_KEY="pk-lf-..."
export LANGFUSE_SECRET_KEY="sk-lf-..."
export LANGFUSE_HOST="https://cloud.langfuse.com"
export LITELLM_OTEL_LANGFUSE_SPAN_SCOPE=llm_only
export OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT=span_only
```

### Set key and team destinations explicitly

Register the replacement team callback with both scope and capture policy <SinceVersion v="1.108.0" />. Save the old `langfuse` entry for rollback and then remove it. The operator scope variable only applies to the exporter built from the global environment credentials.

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
```

For a key, put the same callback object in `metadata.logging` on `/key/generate` or `/key/update`. A `success` entry will also get failed requests as V2 picks the destination prior to the request having an outcome. A failure only entry will have no destination and hence can't take `capture_message_content`, but its keys will still send every model call (both successful and failed) to your Langfuse host as its own trace signed with them. See [key and team destination setup](./opentelemetry_v2#set-it-on-a-key). Tenant capture can override the global setting so you do in fact need to explicitly set `no_content` for any destinations which you are absolutely not wanting to receive prompts. An omitted capture policy will inherit your own Langfuse exporter's policy or the generic `otel` callback's policy if you have no Langfuse exporter of your own.

### Stage and verify the cutover

Save the YAML, the environment and the stored key/team logging entries. Start with staging and have a separate Langfuse project so as not to double up your production observation traffic. Just send a simple successful request, a streaming request, a failed provider request and a guardrail blocked request (if your deployment has guardrails). Include the metadata and redaction settings that your apps actually send.

In Langfuse, go into each test trace and have a look at the observation tree. Count the observations in the tree not the rows in the trace list. For the simple one provider call test under `llm_only` you'll see one generation and no HTTP, no auth, no database, no Redis and no spend write observations. The input and output will have the expected permitted content, token usage and cost (where available) and the `trace_name`, session, user and tags will all match your test request. A pre-model guardrail block will have no generation to export under that scope. A tenant test will end up in the tenant project and will respect your chosen override/additive policy.

Compare Langfuse ingestion usage over a fixed request sample against the SDK baseline prior to any traffic going live. Update the dashboards to allow filtering on generation names, metadata, trace IDs and cost/usage fields. Roll it out in stages and be very vigilant for exporter failures (in particular HTTP 404s and auth errors) as well as ingestion usage.

### Roll back to the SDK callback

Restore the saved langfuse callback config and the stored key/team entries, remove `langfuse_otel`, restore the prior env and restart. If V2 was only ever enabled for the purposes of this migration then also unset `LITELLM_OTEL_V2`. Turning the flag off whilst still having `langfuse_otel` configured will result in the older OTel integration (not the SDK callback) being selected. You must have a LiteLLM/SDK version that is compatible with your Langfuse server when you're restoring a v2 era setup. Confirm one generation goes through the restored SDK callback before you return all traffic.

## Path B, explicitly opt into the full request trace

Use the same preset, same credentials and same content capture configuration as Path A. Set the operator scope to `full`. For each key or team destination that requires the full tree also set `callback_vars.langfuse_span_scope` to `full`. Leaving the scope unset has the same effect, just setting it explicitly makes the ingestion decision unambiguous.

```shell
export LITELLM_OTEL_LANGFUSE_SPAN_SCOPE=full
```

This keeps the recommended V2 integration but with a wider volume scope. It's more expensive in terms of Langfuse ingestion than simply generation only. The number of spans will be dependent on the operations you're doing so you'll want to measure your actual workload rather than just go on the basis of one observation per request.

Langfuse now shows the HTTP request root and its child observations for auth, guardrails, db/cache activity, routing and model calls. Spend writes and background db polls show up as separate traces. Langfuse types the request root and the `route <model>` observation as generations and with capture on it works out the usage and cost for the root from the raw input and output. The dashboards which previously just showed a count of all observations are no longer showing the LLM request count. To get at model usage and cost analysis you filter on the model call observations (the `<operation> <model>` type e.g. `chat gpt-4o`) and use the full tree for latency and failure analysis. Admin traces and requests which are blocked prior to inference will appear without a generation. The same staged rollout and rollback as Path A applies and you must explicitly approve the measured ingestion increase prior to production cutover.

## How legacy fields map

These are the mappings for the V2 `langfuse_otel` preset (not for the older callback which would be selected if V2 is disabled). The controls are `metadata` fields unless otherwise stated. Unsupported fields are not automatically mapped.

### Trace and generation names

`metadata.trace_name` exports as `langfuse.trace.name`. The `langfuse_trace_name` proxy header takes precedence. Full request roots default to `litellm-{call_type}` <SinceVersion v="1.109.0" /> in the absence of an `traceparent`. Under `llm_only` the generation name becomes the trace name if no custom name is provided.

Legacy `generation_name` has no custom name equivalent. The V2 model span uses `{operation} {model}`. Legacy defaults to `litellm:{key_alias}` if present, otherwise `litellm-{call_type}`. Update the name filters.

### User, session and tags

`metadata.trace_user_id` maps to `user.id` with the `langfuse_trace_user_id` header taking precedence. V2 makes no use of the old fallback to the end user ID. `metadata.session_id` maps to `session.id` with the `langfuse_session_id` header taking precedence.

`metadata.tags` maps to `langfuse.trace.tags` and preserves non-empty strings. The tags are taken from the request metadata (which also contains the key and team tags and the `x-litellm-tags` header) rather than a `langfuse_tags` header.

### Trace IDs and parent observations

Use standard OTel trace context propagation to link up the distributed traces rather than the `trace_id`/`existing_trace_id` metadata. V2 doesn't implement the SDK's arbitrary-ID normalisation or the existing trace mutation semantics.

`generation_id` and `parent_observation_id` make use of the OTel span identity and parent context (no equivalent caller override in the V2 mapper). `langfuse.observation.id` has the LiteLLM call ID which a caller can set via the `x-litellm-call-id` header.

### Metadata and identity fields

`trace_metadata` and arbitrary generation metadata has no wholesale passthrough equivalent. V2 does emit the identity fields in `langfuse.observation.metadata` and `langfuse.trace.metadata.*` <SinceVersion v="1.109.0" />. Custom metadata requires an explicit [baggage allowlist](./opentelemetry_v2#request-identity-on-every-span) (which is not SDK trace metadata).

Fields `user_api_key_alias`, `user_api_key_user_id`, `user_api_key_end_user_id`, `user_api_key_team_id`, `user_api_key_team_alias` and `user_api_key_org_id` are in both the observation metadata and the trace metadata attributes. They must be non-empty strings. `redact_user_api_key_info` will remove them from the observation and trace metadata (apart from the trace metadata `team_id` and `team_alias`) but `user_api_key_alias`, `user_api_key_user_id`, `user_api_key_end_user_id` and `user_api_key_org_id` will still be exported as the `litellm.metadata.*` attributes on every span. There are also team ID and team alias identity mappings.

### Model, usage and cost

Model and model parameters map to `langfuse.observation.model.name` and `.model.parameters`. V2 includes temperature, top_p, max_tokens, frequency/presence penalties and seed. The model name is the request model or model group (`gen_ai.request.model`). The deployment is in `litellm.provider.model` and the model the provider reports is in `gen_ai.response.model`.

Token usage maps to `langfuse.observation.usage_details` (broken down into uncached input, cached input, cache creation, non-reasoning output and reasoning output) and also carries `total` (the total token count). The keys are `input`, `input_cached_tokens`, `input_cache_creation`, `output`, `output_reasoning_tokens` and `total`. The SDK callback sent `cache_read_input_tokens` and `cache_creation_input_tokens` and counted the reasoning tokens in `output`.

Response cost maps to `langfuse.observation.cost_details` with `total`. It uses the response cost calculated by LiteLLM where that's available. Cost is only omitted in the case where LiteLLM was unable to look up a price <SinceVersion v="1.109.0" /> and a failed request will export a cost of 0 unless a stream recovered usage first or a guardrail added cost.

### Content and redaction

Prompt and response logging requires `OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT=span_only` (default is no content). Tenant `capture_message_content` can override the global policy. Shared `turn_off_message_logging` and `redact_user_api_key_info` controls still apply with the exception that under `full` the request root observation, MCP tool spans and guardrail responses are not message redacted and the `litellm.metadata.*` identity attributes are never stripped. Test message redaction and identity exposure separately as per [Redaction and capture](#redaction-and-capture). Content capture is not an anonymisation policy.

### Credentials

Global `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY` and `LANGFUSE_HOST` are still the preset environment creds. V2 is exporting via Langfuse's OTLP endpoint rather than creating the generations via the SDK callback. With no `LANGFUSE_HOST` the preset goes to the US cloud (`https://us.cloud.langfuse.com`), the SDK callback defaults to the EU cloud (`https://cloud.langfuse.com`). `LANGFUSE_OTEL_HOST` takes precedence over `LANGFUSE_HOST`. V2 doesn't read `LANGFUSE_BASE_URL` (which the SDK callback would have read when `LANGFUSE_HOST` was unset) so that value is now in `LANGFUSE_HOST`.

Per-key and per-team credentials use `langfuse_public_key`, `langfuse_secret_key` and `langfuse_host` on a `langfuse_otel` destination in the key or team `metadata.logging`. They route to an OTel destination rather than an SDK client. The proxy will reject dynamic per-request `langfuse_public_key` and `langfuse_secret_key` with a 401 unless `general_settings.allow_client_side_credentials` is on. When they are allowed they will only send the model call observation to that project (as its own trace linked to the request trace) with the rest of the tree remaining in your project and a per-request `langfuse_host` is ignored. Re-register the stored callbacks and test the routing. Set `langfuse_span_scope` and capture policy separately for each destination.

### Fields with no equivalent

`update_trace_keys` has no equivalent SDK style update of a pre-existing Langfuse trace. The V2 Langfuse mapper has no equivalent control for `version`, `trace_version`, `trace_release` or `debug_langfuse` either. Don't rely on those SDK specific fields once you've cut over.

Per request the `mask_input`, `mask_output` and `langfuse_masking_function` have no V2 equivalent. V2 only reads the `langfuse_trace_name`, `langfuse_trace_user_id` and `langfuse_session_id` headers, it doesn't read every `langfuse_*` header.

Langfuse prompt association via generation parameters has no prompt link mapping in V2. You'll need to check the prompt related workflows individually prior to migration.

For the full V2 config see [OpenTelemetry v2](./opentelemetry_v2). The [general V2 migration guide](./opentelemetry_v2_migration) is the one that covers the migration from OTel v1 rather than from the Langfuse SDK callback.
