# Migrate the Langfuse SDK callback to OpenTelemetry v2

{/* keep-version-note */}

## Risks to review before migration

:::danger Ingestion volume and compatibility change

Replace `langfuse` with `langfuse_otel` and set `LITELLM_OTEL_V2=true` and you change what Langfuse is receiving. The default scope is `full` rather than LLM only. It will capture the HTTP root, auth, Postgres, Redis, guardrails, MCP tools, model calls and spend-write spans as they happen. Admin requests will also generate traces. This can lead to Langfuse ingestion being increased by an order of magnitude or more. Don't assume that the same request rate will equate to the same Langfuse bill.

Use `llm_only` for the closest volume match to the legacy callback. A simple request with one provider call will result in one generation being sent, however requests with multiple provider calls can result in multiple generations being sent. This is not a guarantee of identical billing. Guardrail blocks prior to a model call and MCP only activity will leave no observations in that destination under `llm_only`.

Self-hosted Langfuse OSS v2 servers don't expose the `/api/public/otel/v1/traces` endpoint and will return an HTTP 404 if you try an OTLP export. You must upgrade the server prior to cutover. The [Langfuse integration](./langfuse_integration) docs state that server **3.63.0 or newer** is required for SDK v4. That is not a guarantee that every server prior to that version will support the OTel preset. You must validate OTLP ingestion on your target server prior to a production rollout.

:::

**Prompts and responses are absent by default.** V2 defaults to `no_content` so your Langfuse input/output will be empty unless you enable span content capture via `OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT=span_only`, or explicitly enable it for a tenant destination. Enabling capture will send sensitive content. Please review redaction first.

**Names, metadata and trace continuation are not drop-in compatible.** The V2 Langfuse mapper has no equivalent to legacy `generation_name`, custom generation IDs, `existing_trace_id`, trace mutation, version/release fields and prompt linking. Any saved dashboards or integrations that rely on any of those fields will need to be updated. See the mapping table below.

**Tenant routing must also be migrated.** The stored key/team callback named `langfuse` is still the SDK callback. Change it to `langfuse_otel`, keep the same credentials and explicitly set its scope and content policy. The global scope variable does not restrict the tenant destinations. V2 defaults to `override` routing so a tenant's Langfuse destination will replace your global Langfuse exporter for that request. `additive` will keep both. A custom `langfuse_host` will require its key pair and an entry in `general_settings.provider_url_destination_allowed_hosts`. An unreachable tenant destination will not fall back to your project. See [tenant routing](./opentelemetry_v2#what-the-tenant-receives).

**DO NOT leave both callbacks enabled for the same traffic and project.** langfuse and `langfuse_otel` are separate integrations and both will log the request which will result in duplicate observations and extra ingestion. Turning on `LITELLM_OTEL_V2` does NOT convert the SDK callback into full tree tracing. The SDK callback will still create one generation for its logged call. You must remove it from the global success/failure callbacks and from the stored key/team callbacks if you're replacing it.

Redaction and capture are separate controls. A successful call goes through LiteLLM's shared `turn_off_message_logging` redaction prior to V2 consuming the logging payload. A capture opt-in does not in any way restore content that has already been redacted in that first stage. Don't assume that this proves redaction on the failure paths. You need to test redaction on failed calls separately and you must use `no_content` on any destination that absolutely must not receive the message content. The request metadata that V2 exports uses the same `redact_user_api_key_info` helper as the SDK callback for the `user_api_key_*` fields. It does not redact all OTel identity attributes (e.g. team identity, key hash) and is not a general purpose anonymisation switch. You must test your actual redaction policy with capture enabled prior to rollout.

## Choose a migration path

The [Langfuse integration recommendation](./langfuse_integration) is to use the **OpenTelemetry v2 `langfuse_otel` preset**. The [V2 scope guidance](./opentelemetry_v2#send-only-the-model-calls-to-langfuse) is to use **`llm_only`** unless you specifically need infrastructure spans in Langfuse. `full` is the implementation default but it's not the recommended scope for every deployment. Path A is following that scope recommendation. Path B is an explicit opt-in to full trace collection for those teams that need it.

## Path A, LLM-only logging with fewer breaking changes

Keep your model config and replace the legacy logging callback with this proxy config. Remove any instances of `success_callback: ["langfuse"]` or `failure_callback: ["langfuse"]` rather than just appending on the new callback.

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

Register the replacement team callback with both scope and capture policy. Remove the old langfuse entry once we've recorded its config for rollback. The operator scope variable up there only applies to the exporter that's built from the global environment creds.

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

For a key, put the same callback object in `metadata.logging` on `/key/generate` or `/key/update`. Use `success_and_failure` rather than success if the destination needs to receive failures as well. See [key and team destination setup](./opentelemetry_v2#set-it-on-a-key). Tenant capture can override the global setting so you need to explicitly set `no_content` for any destinations that must never receive prompts. An omitted capture policy will inherit the matching operator exporter policy rather than the policy of another OTel callback.

### Stage and verify the cutover

Save the YAML, the environment and the stored key/team logging entries. Start with staging and a separate Langfuse project so that the comparison traffic doesn't double your production observations. Send a simple successful request, a streaming request, a failed provider request and a guardrail blocked request (if your deployment has guardrails). Include the metadata and redaction settings that your apps actually send.

In Langfuse open up each test trace and look at its observation tree. Count the observations in the tree not the rows in the trace list. For the simple one provider call test under `llm_only` you should see one generation and no HTTP, no auth, no database, no Redis and no spend write observations. The input and output should contain the expected permitted content, token usage and cost (where available) and the `trace_name`, session, user and tags should all match your test request. A pre-model guardrail block will have no generation to export under that scope. A tenant test should land in the tenant project and follow your chosen override/additive policy.

Compare Langfuse ingestion usage over a fixed request sample against the SDK baseline prior to rolling out any traffic. Update the dashboards to filter on generation names, metadata, trace IDs and cost/usage fields. Roll it out gradually and monitor for exporter failures (particularly HTTP 404s and auth errors) as well as ingestion usage.

### Roll back to the SDK callback

Restore the saved langfuse callback config and stored key/team entries, remove `langfuse_otel`, restore the prior env and restart. If V2 was only enabled for the purpose of this migration then also unset `LITELLM_OTEL_V2`. Turning the flag off whilst still having `langfuse_otel` configured will select the older OTel integration (not the SDK callback). Ensure you have a LiteLLM/SDK version that is compatible with your Langfuse server when restoring a v2 era setup. Confirm one generation comes through the restored SDK callback before returning all traffic.

## Path B, explicitly opt into the full request trace

Use the same preset, same credentials and same content capture configuration as Path A. Set the operator scope to `full`. For each key or team destination that requires the full tree, also set `callback_vars.langfuse_span_scope` to `full`. If you leave the scope unset it has the same effect, just setting it explicitly makes the ingestion decision clear.

```shell
export LITELLM_OTEL_LANGFUSE_SPAN_SCOPE=full
```

This maintains the recommended V2 integration but with a higher volume scope. It's more expensive in terms of Langfuse ingestion than just generation only. The number of spans will be dependent on the operations you're doing so you should measure your workload rather than just go on the basis of one observation per request.

Langfuse now shows the HTTP request root and child observations for auth, guardrails, db/cache activity, model calls and spend writes. Model generations are still identifiable by `langfuse.observation.type=generation`. Dashboards which previously counted all observations are no longer counting LLM request count. You can now filter on generations to get at model usage and cost analysis and use the full tree for latency and failure analysis. Admin traces and requests which are blocked prior to inference will appear without a generation. The same staged rollout and rollback as Path A applies and you must explicitly approve the measured ingestion increase prior to production cutover.

## Legacy parameter mapping

This table describes the V2 `langfuse_otel` preset (not the older callback of the same name with V2 disabled). The metadata controls below are request `metadata` fields unless otherwise stated. Unsupported means there is no equivalent control in the V2 Langfuse mapper (not that the legacy field is automatically translated).

| Legacy `langfuse` metadata or parameter | Equivalent in OTel v2 | Migration impact |
| --- | --- | --- |
| `trace_name` | `metadata.trace_name`, exported as `langfuse.trace.name` | `langfuse_trace_name` proxy header takes precedence. Full request roots default to `litellm-{call_type}`. If using `llm_only` and no custom name is provided then the generation name will be the trace name. |
| `generation_name` | No equivalent custom name. The model span name is `{operation} {model}`. | Legacy defaults to `litellm:{key_alias}` if present, otherwise `litellm-{call_type}`. Name filters should be updated. |
| `trace_user_id` | `metadata.trace_user_id` to `user.id` | `langfuse_trace_user_id` header takes precedence. The V2 trace control parser does not make use of the old fallback from the completion `user` argument. |
| `session_id` | `metadata.session_id` to `session.id` | `langfuse_session_id` header takes precedence. |
| tags | `metadata.tags` to `langfuse.trace.tags` | Non-empty strings are preserved. Tags are taken from the body metadata rather than a `langfuse_tags` header. |
| `trace_id`, `existing_trace_id` | OTel trace context (not these metadata controls) | Use standard OTel trace context propagation to join up the distributed traces. V2 does not implement the SDK's arbitrary-ID normalisation or existing trace mutation semantics. |
| `generation_id`, `parent_observation_id` | OTel span identity and parent context | There is no equivalent caller override in the V2 mapper. `langfuse.observation.id` holds the LiteLLM call ID. |
| `update_trace_keys` | Unsupported | No SDK-style update of a preexisting Langfuse trace. |
| `trace_metadata`, arbitrary generation metadata | No wholesale passthrough equivalent | V2 emits the relevant identity fields in `langfuse.observation.metadata` and `langfuse.trace.metadata.*`. For custom metadata you'll need an explicit [baggage allowlist](./opentelemetry_v2#request-identity-on-every-span) which is not SDK trace metadata. |
| `user_api_key_alias`, `user_api_key_user_id`, `user_api_key_end_user_id`, `user_api_key_team_id`, `user_api_key_team_alias`, `user_api_key_org_id` | The same set of fields as in the observation metadata and the trace metadata attributes respectively | All must be non-empty strings (subject to `redact_user_api_key_info`), with team ID and team alias having their own dedicated identity mappings. |
| `version`, `trace_version`, `trace_release`, `debug_langfuse` | There is no equivalent control in the V2 Langfuse mapper | Do not rely on these SDK specific fields being present post cutover. |
| Langfuse prompt association via generation parameters | No prompt to link mapping in the V2 Langfuse mapper | Check the prompt related workflows individually prior to migration. |
| Model and model parameters | `langfuse.observation.model.name` and `.model.parameters` | V2 contains temperature, top_p, max_tokens, frequency/presence penalties and seed. The model name in the model name attribute is used to differentiate the request model from the provider deployment in the canonical OTel attributes. |
| Token usage | `langfuse.observation.usage_details` | V2 splits uncached input, cached input, cache creation, non-reasoning output and reasoning output. Do not sum these up together in `total`. |
| Response cost | `langfuse.observation.cost_details` with `total` | Uses the response cost calculated by LiteLLM where available. Missing cost is simply omitted rather than being forced to zero. |
| Prompt and response logging | `OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT=span_only` | Default is no content. Tenant `capture_message_content` can override the global policy. |
| `turn_off_message_logging`, `redact_user_api_key_info` | Shared LiteLLM redaction controls still apply | Test message redaction and identity exposure separately. Content capture is not an anonymisation policy. |
| Global `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_HOST` | Same environment credentials as the preset | Export via Langfuse's OTLP endpoint rather than creating generations through the SDK callback. |
| Per-key, per-team or dynamic per-request Langfuse credentials | V2 destination credentials `langfuse_public_key`, `langfuse_secret_key`, `langfuse_host` for `langfuse_otel` | Credentials route an OTel destination rather than an SDK client. You'll need to re-register your stored callbacks and test the routing. Set `langfuse_span_scope` and your capture policy separately for each destination. |

For the complete V2 configuration, see [OpenTelemetry v2](./opentelemetry_v2). The [general V2 migration guide](./opentelemetry_v2_migration) covers migration from OTel v1, rather than from the Langfuse SDK callback.
