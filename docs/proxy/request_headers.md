# Request Headers

Special headers that are supported by LiteLLM.

## Header Forwarding

By default, LiteLLM does not forward client headers to LLM provider APIs. However, you can selectively enable header forwarding for specific model groups. [Learn more about configuring header forwarding](./forward_client_headers.md).

## LiteLLM Headers

`x-litellm-timeout` Optional[float]: The timeout for the request in seconds.

`x-litellm-priority` Optional[int]: The [scheduler](../scheduler#priority-header) queue priority for the request. Lower values run first. This outranks a `priority` in the request body. <SinceVersion v="1.109.0" />

`x-litellm-stream-timeout` Optional[float]: The timeout for getting the first chunk of the response in seconds (only applies for streaming requests). [Demo Video](https://www.loom.com/share/8da67e4845ce431a98c901d4e45db0e5)

`x-litellm-enable-message-redaction`: Optional[bool]: Don't log the message content to logging integrations. Just track spend. [Learn More](./logging#redact-messages-response-content)

`x-litellm-tags`: Optional[str]: A comma separated list (e.g. `tag1,tag2,tag3`) of tags to use for [tag-based routing](./tag_routing) **OR** [spend-tracking](/docs/proxy/cost_tracking#custom-tags).

`x-litellm-num-retries`: Optional[int]: The number of retries for the request. This outranks a `num_retries` in the request body, in a deployment's `litellm_params`, and in `litellm_settings`. [Learn More](../routing#where-num_retries-can-be-set-and-which-one-wins)

`x-litellm-keepalive-seconds`: Optional[float]: Emit an SSE `: ping` comment frame after this many seconds of stream silence, to keep idle-looking connections alive through load balancer timeouts. Subject to the deployment's `allow_client_keepalive_override` setting; has no effect if the deployment hasn't opted in. [Learn More](./timeout#keepalive-pings-for-idle-streaming-connections)

`x-litellm-include-cost-in-streaming-usage`: Optional[bool]: Add `cost` to the usage-carrying event of this one stream (`/v1/messages`, Anthropic and OpenAI pass-throughs) without turning on `litellm_settings.include_cost_in_streaming_usage` for every request. [Learn More](../completion/usage#proxy-include-cost-in-streaming-usage) <SinceVersion v="1.110.0" />

`x-litellm-spend-logs-metadata`: Optional[str]: JSON string containing custom metadata to include in spend logs. Example: `{"user_id": "12345", "project_id": "proj_abc", "request_type": "chat_completion"}`. [Learn More](./cost_tracking)

`x-litellm-customer-id`: Optional[str]: Standard header for passing a customer/end-user ID. Always checked without any configuration. [Learn More](./customers)

`x-litellm-end-user-id`: Optional[str]: Standard header for passing a customer/end-user ID. Always checked without any configuration. [Learn More](./customers)

`x-litellm-trace-id` Optional[str]: A stable id used to correlate all LLM calls belonging to one conversation or agentic flow. The value is stored in the `session_id` column of the `LiteLLM_SpendLogs` table and in request metadata (`trace_id` and `session_id`), and it propagates to nested MCP tool calls and A2A agent calls so inner LLM calls share the same session id. Highest priority of the three headers.

`x-litellm-session-id` Optional[str]: Same behavior as `x-litellm-trace-id`. Used if `x-litellm-trace-id` is not present. The two headers are interchangeable and set the same chain id.

`x-<vendor>-session-id` Optional[str]: Fallback pattern. Any header matching `x-<vendor>-session-id` (for example `x-claude-code-session-id`) is auto-detected as the session id if neither explicit LiteLLM header is present. The value must look like a session id: alphanumeric characters, hyphens, or underscores, at least 8 characters long.

LiteLLM resolves the session id in a fixed priority order: `x-litellm-trace-id` first, then `x-litellm-session-id`, then any `x-<vendor>-session-id` header. The first match wins, and the resolved value becomes the chain id shared across the request and any nested MCP or A2A calls it triggers.

### Session correlation example

Send two chat completion requests with the same `x-litellm-trace-id` value to group them into one session:

```bash
curl http://0.0.0.0:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "x-litellm-trace-id: my-conversation-123" \
  -d '{
    "model": "{{openai_large}}",
    "messages": [{"role": "user", "content": "Hello, who won the world cup in 2022?"}]
  }'

curl http://0.0.0.0:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "x-litellm-trace-id: my-conversation-123" \
  -d '{
    "model": "{{openai_large}}",
    "messages": [{"role": "user", "content": "And who was the top scorer?"}]
  }'
```

All requests sharing that value can be found by querying spend logs by session id, or through the session grouping in the Admin UI logs page.

## Anthropic Headers

`anthropic-version` Optional[str]: The version of the Anthropic API to use.  
`anthropic-beta` Optional[str]: The beta version of the Anthropic API to use.
    - For `/v1/messages` endpoint, this will always be forward the header to the underlying model.
    - For `/chat/completions` endpoint, this will only be forwarded if the model is configured in `forward_client_headers_to_llm_api`. [Learn more](./forward_client_headers.md)

`anthropic-user-profile-id` Optional[str]: The Anthropic user profile ID of the end user behind a Claude request. Anthropic can use this ID to apply a safety action to that user instead of the whole organization. LiteLLM forwards it only to models whose name contains `claude`. Claude on Anthropic, Azure AI Foundry, Vertex AI, and Claude Platform on AWS (`bedrock/claude_platform/...`) gets it as a header. On Bedrock Mantle, LiteLLM sends only the top-level body field `user_profile_id`, not the profile header. No `forward_client_headers_to_llm_api` entry is needed.

Bedrock Runtime's Converse and InvokeModel APIs do not support user profiles, so LiteLLM sends neither the header nor the body field to them. Bedrock Mantle and Vertex AI accept any well-formed ID without looking up the profile, so a successful response does not confirm that the ID matches a profile. Link each AWS account or Google Cloud project to the Anthropic organization that created your profiles in Anthropic's Verification Portal so that the profile's programs apply to its requests. Azure AI Foundry deployments hosted on Anthropic return `400` for every profile ID until Anthropic links the Foundry resource to that organization. See [Anthropic's user profile documentation](https://platform.claude.com/docs/en/manage-claude/user-profiles).

### Pin an Anthropic user profile ID to a key or team

A proxy administrator can set `anthropic_user_profile_id` in a key's or team's `metadata`. With proxy-owned credentials, LiteLLM uses the first ID it finds in this order: the key's pin, the team's pin, an `anthropic-user-profile-id` set in the deployment's `extra_headers`, and then the caller's header. Caller headers, including mixed-case and empty values, cannot remove a pin. Client body fields and `x-pass-` headers cannot replace it either. Use a separate key for each end user whose profile you want to pin. Each proxy worker caches team records, so a team pin change can take up to 60 seconds to reach requests.

The mapping applies to Claude requests on `/v1/messages`, `/v1/chat/completions`, and `/v1/responses`, the supported token count routes (`/v1/messages/count_tokens`, `/utils/token_counter`, `/v1/responses/input_tokens`, and Google `countTokens`), and the `/anthropic` and `/vertex_ai` pass-through routes. Routes you configure under `pass_through_endpoints` and the `/azure_ai` pass-through send the pin when the request body's `model` names a Claude model or the caller sends the header, unless the route forwards the caller's own credential. Pass-through routes to other vendors, such as `/openrouter`, do not add the pin. Model-group relays on `/azure_ai` and `/vllm` send the pin to Claude deployments and forward a caller's `x-pass-anthropic-user-profile-id` header as sent to other models. Token count forwarding uses the Claude count-token APIs on Anthropic, Azure AI Foundry, and Vertex AI. Bedrock token counts, Mantle included, do not carry the ID.

For `/utils/token_counter`, use the `call_endpoint=true` query parameter to call the provider's token count API. Local tokenizer counts do not send a provider request or a profile ID.

Only a proxy administrator can create, change, or remove a mapping. Unauthorized changes return `403`. Non-null profile values must be strings containing only printable ASCII characters without whitespace; invalid values return `400`. An empty string does not pin a profile, so a non-empty team mapping can still apply.

Add a Claude model to the proxy config:

```yaml
model_list:
  - model_name: {{anthropic}}
    litellm_params:
      model: anthropic/{{anthropic}}
      api_key: os.environ/ANTHROPIC_API_KEY
```

Create a key pinned to the end user's profile ID, using a proxy administrator's credential. Replace `uprof_...` with a real profile ID from the Anthropic organization that owns the upstream credential:

```bash
curl -X POST http://0.0.0.0:4000/key/generate \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"metadata": {"anthropic_user_profile_id": "uprof_..."}}'
```

Use the returned key as `LITELLM_API_KEY` when you call the model:

```bash
curl http://0.0.0.0:4000/v1/messages \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "{{anthropic}}",
    "max_tokens": 64,
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

Anthropic receives the pinned `anthropic-user-profile-id` with this request, even if the client sends a different ID.

### Caller-owned credentials

When a route actually forwards a caller's own Claude OAuth bearer token to Anthropic, or a request-body `api_key` to Anthropic, Azure AI Foundry, Bedrock, or Bedrock Mantle, LiteLLM preserves the caller's profile instead of applying the proxy's organization-specific pin. The caller can supply the profile in the HTTP `anthropic-user-profile-id` header or, on model requests, in the request body's `headers` or `extra_headers` object. The HTTP header takes precedence over those body headers. An absent or empty caller profile does not restore the administrator's pin on this credential path.

This exception is limited to forwarded caller credentials. Supplying an OAuth-looking header that the route does not consume, or a request-body `api_key` to Vertex AI, which does not use it as the credential, does not remove a pin used with proxy-owned credentials. Request-body AWS keys such as `aws_access_key_id` keep the pin too, because a deployment's bearer token, profile, or role can take precedence over them. On `/v1/messages`, a deployment that sets `x-api-key`, `Authorization`, or `api-key` in its `extra_headers` sends that credential instead of a request-body `api_key`, so those requests keep the pin. A request-body `api_key` that is an Anthropic OAuth token (`sk-ant-oat...`, with no `Bearer ` prefix) replaces that header instead, so the request bills the caller's account and keeps the caller's own profile id. On a pinned key, LiteLLM drops credential headers such as `authorization` and `x-api-key` that a caller sends in `provider_specific_header` from Claude requests and still sends them to other models and providers. To bill a Claude request to the caller's own account, send the credential as a request-body `api_key`. Count routes that use the server's credential keep the administrator's pin. On `/vertex_ai`, when the proxy has no Vertex credentials for the route and forwards the caller's own Google credentials, LiteLLM forwards the caller's headers as sent and does not apply the pin.

Use profiles that belong to the organization associated with each upstream credential. An organization mismatch can return `400`. The configured router error and fallback policies still apply; do not rely on a profile mismatch to disable all fallbacks. If a key or team routes across organizations, use separate keys or teams with the matching profile for each organization.

## OpenAI Headers

`openai-organization` Optional[str]: The organization to use for the OpenAI API. (currently needs to be enabled via `general_settings::forward_openai_org_id: true`)

## Custom Headers

Custom headers starting with `x-` can be forwarded to LLM provider APIs when the model is configured in `forward_client_headers_to_llm_api`. [Learn more about header forwarding configuration](./forward_client_headers.md).



