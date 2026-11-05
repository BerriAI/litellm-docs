# Migrate the Langfuse SDK callback to OpenTelemetry v2

{/* keep-version-note */}

This guide is about the transition from the SDK based `langfuse` callback to the [OpenTelemetry v2](./opentelemetry_v2) `langfuse_otel` preset. It's for the scenario where you want to keep your ingestion costs, your content policies and your dashboards. See [Langfuse integration](./langfuse_integration) for the integration overview.

## Turn it on

Replace `langfuse` with `langfuse_otel`, set `LITELLM_OTEL_V2=true` and restart the proxy. Have a look at the changes below before you choose either Path A (LLM only logging) or Path B (full tracing).

## What changes

### Ingestion volume and scope

:::danger Ingestion costs

The default `full` scope can boost Langfuse ingestion by an order of magnitude or more at the same request rate.

:::

Replace `langfuse` with `langfuse_otel` and set `LITELLM_OTEL_V2=true` and that's what Langfuse will be receiving. The default scope is `full` not LLM only. It will capture the HTTP root, auth, Postgres, Redis, guardrails, MCP tools, model calls and spend-write spans as they occur. Admin requests will also generate traces. This can see Langfuse ingestion go up by an order of magnitude or more. Don't assume that the same request rate will result in the same Langfuse bill.

Use `llm_only` for the closest volume match to the legacy callback. A single request with a single provider call will result in one generation being sent, however a request with multiple provider calls can result in multiple generations being sent. This is not a guarantee of identical billing. Guardrail blocks prior to a model call and MCP only activity will result in no observations being recorded in that destination under `llm_only`.

### Server compatibility and HTTP 404

Self-hosted Langfuse OSS v2 servers do not expose the `/api/public/otel/v1/traces` endpoint and will return an HTTP 404 if you attempt an OTLP export. You must upgrade the server prior to cutover. The [Langfuse integration](./langfuse_integration) docs state that server **3.63.0 or newer** is required for SDK v4. That doesn't necessarily mean that every server prior to that version will support the OTel preset. You must confirm OTLP ingestion works on your target server prior to a production cutover.

### Content capture is off by default

V2 defaults to `no_content` so your Langfuse input/output will be blank unless you turn on span content capture via `OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT=span_only` or turn it on for a tenant destination. Turning capture on will send sensitive content. Check redaction first.

### Names and metadata are not drop-in compatible

The V2 Langfuse mapper has no equivalent to the legacy `generation_name`, custom generation IDs, `existing_trace_id`, trace mutation, version/release fields and prompt linking. Any dashboards or integrations that you've saved which are reliant on any of those fields will need to be updated. See [How legacy fields map](#how-legacy-fields-map).

### Key and team destinations

The stored key/team callback `langfuse` is still the SDK callback. Change it to `langfuse_otel`, same credentials, explicitly set its scope and content policy. The global scope variable does not restrict tenant destinations. V2 defaults to `override` routing so a tenant's Langfuse destination will take over your global Langfuse exporter for that request. `additive` will keep both. A custom `langfuse_host` will require its key pair and an entry in `general_settings.provider_url_destination_allowed_hosts`. An unreachable tenant destination will not fall back to your project. See [tenant routing](./opentelemetry_v2#what-the-tenant-receives).

### Duplicate callbacks

Don't leave both callbacks enabled for the same traffic and project. `langfuse` and `langfuse_otel` are separate integrations and both will log the request which will lead to duplicate observations and extra ingestion. Turning on `LITELLM_OTEL_V2` does not in any way turn the SDK callback into full tree tracing. The SDK callback will still generate one generation for its logged call. You'll need to remove it from the global success/failure callbacks and from the stored key/team callbacks if you're replacing it.

### Redaction and capture

Redaction and capture are separate controls. A successful call passes through LiteLLM's shared `turn_off_message_logging` redaction prior to V2 even having a look at the logging payload. Under `llm_only` a capture opt-in in no way undoes the redaction that has already occurred in that first stage. Under the default `full` scope it does, because the request root observation (`POST /v1/chat/completions`) still carries the raw prompt and response with `turn_off_message_logging` on, while the generation shows `redacted-by-litellm`. If you redact messages and turn capture on, use `llm_only`. Don't assume that this proves redaction on the failure paths. You need to test redaction on the failure paths separately and you must use `no_content` on any destination where it is absolutely critical that the message content doesn't get to that destination. The request metadata that V2 exports for the `user_api_key_*` fields is using the same `redact_user_api_key_info` helper as the SDK callback. It doesn't redact all of the OTel identity attributes (e.g. team identity, key hash) and it's not a general purpose anonymisation switch. You need to test your actual redaction policy with capture enabled prior to rollout.

## Choose a migration path

The [Langfuse integration recommendation](./langfuse_integration) is to use the **OpenTelemetry v2 `langfuse_otel` preset**. The [V2 scope guidance](./opentelemetry_v2#send-only-the-model-calls-to-langfuse) is to use **`llm_only`** unless you specifically need infrastructure spans in Langfuse. `full` is the implementation default but it's not the recommended scope for every deployment. Path A is following that scope recommendation. Path B is an explicit opt-in to full trace collection for those teams that need it.

## Path A, LLM-only logging with fewer breaking changes

Keep your model config and replace the legacy logging callback with this proxy config. Remove any instances of `success_callback: ["langfuse"]` or `failure_callback: ["langfuse"]` (rather than just appending on the new callback).

```yaml
litellm_settings:
  callbacks: ["langfuse_otel"]
```

Set the environment and restart the proxy. Use the host for your Langfuse region or for your self hosted deployment.

```shell
export LITELLM_OTEL_V2=true
export LANGFUSE_PUBLIC_KEY="pk-lf-..."
export LANGFUSE_SECRET_KEY="sk-lf-..."
export LANGFUSE_HOST="https://cloud.langfuse.com"
export LITELLM_OTEL_LANGFUSE_SPAN_SCOPE=llm_only
export OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT=span_only
```

### Set key and team destinations explicitly

Register the replacement team callback with both scope and capture policy. Save the old `langfuse` entry for rollback and then remove it. The operator scope variable only applies to the exporter built from the global environment credentials.

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

For a key, put the same callback object in `metadata.logging` on `/key/generate` or `/key/update`. Use `success_and_failure` rather than success if the destination is going to need to receive failures as well. See [key and team destination setup](./opentelemetry_v2#set-it-on-a-key). Tenant capture can override the global setting so you do need to explicitly set `no_content` for any destinations which are absolutely not to receive prompts. An omitted capture policy will inherit the matching operator exporter policy rather than the policy of another OTel callback.

### Stage and verify the cutover

Save the YAML, the environment and the stored key/team logging entries. Start with staging and have a separate Langfuse project so that you don't double your production observation traffic. Just send a simple successful request, a streaming request, a failed provider request and a guardrail blocked request (if your deployment has guardrails). Include the metadata and redaction settings that your apps actually send.

In Langfuse, open up each test trace and look at the observation tree. Count the observations in the tree not the rows in the trace list. For the simple one provider call test under `llm_only` you'll see one generation and no HTTP, no auth, no database, no Redis and no spend write observations. The input and output will have the expected permitted content, token usage and cost (where available) and the `trace_name`, session, user and tags will all match your test request. A pre-model guardrail block will have no generation to export under that scope. A tenant test will end up in the tenant project and will follow your chosen override/additive policy.

Compare Langfuse ingestion usage over a fixed request sample against the SDK baseline prior to any traffic going live. Update the dashboards to be able to filter on generation names, metadata, trace IDs and cost/usage fields. Roll it out in stages and keep a close eye out for exporter failures (in particular HTTP 404s and auth errors) as well as ingestion usage.

### Roll back to the SDK callback

Restore the saved langfuse callback config and the stored key/team entries, remove `langfuse_otel`, restore the prior env and restart. If V2 was only ever enabled for the purposes of this migration then also unset `LITELLM_OTEL_V2`. Turning the flag off whilst still having `langfuse_otel` configured will result in the older OTel integration (not the SDK callback) being selected. Ensure you have a LiteLLM/SDK version that is compatible with your Langfuse server when you're restoring a v2 era setup. Confirm one generation goes through the restored SDK callback before you return all traffic.

## Path B, explicitly opt into the full request trace

Use the same preset, same credentials and same content capture configuration as Path A. Set the operator scope to `full`. For each key or team destination that requires the full tree also set `callback_vars.langfuse_span_scope` to `full`. Leaving the scope unset has the same effect, just setting it explicitly makes the ingestion decision unambiguous.

```shell
export LITELLM_OTEL_LANGFUSE_SPAN_SCOPE=full
```

This keeps the recommended V2 integration but with a broader volume scope. It's more expensive in terms of Langfuse ingestion than simply generation only. The number of spans will be dependent on the operations you're doing so you should measure your workload rather than just go on the basis of one observation per request.

Langfuse now shows the HTTP request root and child observations for auth, guardrails, db/cache activity, routing and model calls. Spend writes and background database polls arrive as separate traces. Langfuse types the request root and the `route <model>` observation as generations too, because they carry `gen_ai.request.model`, and with capture on it infers usage and cost for the root from its raw input and output. The dashboards which previously just counted all observations are no longer counting the LLM request count. Filter on the model call observations, named `<operation> <model>` such as `chat gpt-4o`, to get at model usage and cost analysis and use the full tree for latency and failure analysis. Admin traces and requests which are blocked prior to inference will appear without a generation. The same staged rollout and rollback as Path A applies and you must explicitly approve the measured ingestion increase prior to production cutover.

## How legacy fields map

These mappings are for the V2 `langfuse_otel` preset, not for the older callback that would be selected if V2 is disabled. Controls are `metadata` fields unless otherwise specified. Unsupported fields are not automatically mapped.

### Trace and generation names

`metadata.trace_name` exports as `langfuse.trace.name`. The `langfuse_trace_name` proxy header takes precedence. Full request roots default to `litellm-{call_type}`. Under `llm_only` the generation name becomes the trace name if no custom name is supplied.

Legacy `generation_name` has no custom name equivalent. The V2 model span uses `{operation} {model}`. Legacy defaults to `litellm:{key_alias}` if present, otherwise `litellm-{call_type}`. Update the name filters.

### User, session and tags

`metadata.trace_user_id` maps to `user.id` with the `langfuse_trace_user_id` header taking precedence. V2 doesn't make use of the old fallback from the completion `user` argument. `metadata.session_id` maps to `session.id` with the `langfuse_session_id` header taking precedence.

`metadata.tags` maps to `langfuse.trace.tags` and retains non-empty strings. The tags are taken from the body metadata rather than a `langfuse_tags` header.

### Trace IDs and parent observations

Use standard OTel trace context propagation to link up the distributed traces rather than `trace_id`/`existing_trace_id` metadata. V2 doesn't implement the SDK's arbitrary-ID normalisation or the existing trace mutation semantics.

`generation_id` and `parent_observation_id` make use of the OTel span identity and parent context, with no equivalent caller override in the V2 mapper. `langfuse.observation.id` has the LiteLLM call ID.

### Metadata and identity fields

`trace_metadata` and arbitrary generation metadata have no wholesale passthrough equivalent. V2 does emit the identity fields in `langfuse.observation.metadata` and `langfuse.trace.metadata.*`. Custom metadata requires an explicit [baggage allowlist](./opentelemetry_v2#request-identity-on-every-span) (which is not SDK trace metadata).

Fields `user_api_key_alias`, `user_api_key_user_id`, `user_api_key_end_user_id`, `user_api_key_team_id`, `user_api_key_team_alias` and `user_api_key_org_id` are in the observation metadata and the trace metadata attributes. They must be non-empty strings and are subject to `redact_user_api_key_info`. There are also team ID and team alias identity mappings.

### Model, usage and cost

Model and model parameters map to `langfuse.observation.model.name` and `.model.parameters`. V2 includes temperature, top_p, max_tokens, frequency/presence penalties and seed. The model name is the request model or model group (`gen_ai.request.model`). The deployment is in `litellm.provider.model` and the model the provider reports is in `gen_ai.response.model`.

Token usage maps to `langfuse.observation.usage_details`, broken down into uncached input, cached input, cache creation, non-reasoning output and reasoning output. Do not sum these up to get `total`.

Response cost maps to `langfuse.observation.cost_details` with `total`. It uses the response cost calculated by LiteLLM where that's available. Any missing cost is simply omitted rather than being forced to zero.

### Content and redaction

Prompt and response logging requires `OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT=span_only` (default is no content). Tenant `capture_message_content` can override the global policy. Shared `turn_off_message_logging` and `redact_user_api_key_info` controls still apply, except that under `full` the request root observation is not message redacted. Test message redaction and identity exposure separately as per [Redaction and capture](#redaction-and-capture). Content capture is not an anonymisation policy.

### Credentials

Global `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY` and `LANGFUSE_HOST` are still the preset environment credentials. V2 is exporting via Langfuse's OTLP endpoint rather than creating the generations via the SDK callback.

Per-key and per-team credentials use `langfuse_public_key`, `langfuse_secret_key` and `langfuse_host` on a `langfuse_otel` destination in the key or team `metadata.logging`. They route to an OTel destination rather than an SDK client. Dynamic per-request `langfuse_public_key` and `langfuse_secret_key` only swap the credentials on your global Langfuse exporter, and a per-request `langfuse_host` is ignored. Re-register the stored callbacks and test the routing. Set `langfuse_span_scope` and capture policy separately for each destination.

### Fields with no equivalent

`update_trace_keys` has no equivalent SDK style update of a pre-existing Langfuse trace. The V2 Langfuse mapper likewise has no equivalent control for `version`, `trace_version`, `trace_release` or `debug_langfuse`. Don't rely on these SDK specific fields after cutover.

Langfuse prompt association via generation parameters has no prompt-link mapping in V2. You'll need to check prompt related workflows individually prior to migration.

For the full V2 config see [OpenTelemetry v2](./opentelemetry_v2). The [general V2 migration guide](./opentelemetry_v2_migration) is the one that covers migration from OTel v1 rather than from the Langfuse SDK callback.
