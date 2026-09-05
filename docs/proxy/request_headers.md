# Request Headers

Special headers that are supported by LiteLLM.

## Header Forwarding

By default, LiteLLM does not forward client headers to LLM provider APIs. However, you can selectively enable header forwarding for specific model groups. [Learn more about configuring header forwarding](./forward_client_headers.md).

## LiteLLM Headers

`x-litellm-timeout` Optional[float]: The timeout for the request in seconds.

`x-litellm-stream-timeout` Optional[float]: The timeout for getting the first chunk of the response in seconds (only applies for streaming requests). [Demo Video](https://www.loom.com/share/8da67e4845ce431a98c901d4e45db0e5)

`x-litellm-enable-message-redaction`: Optional[bool]: Don't log the message content to logging integrations. Just track spend. [Learn More](./logging#redact-messages-response-content)

`x-litellm-tags`: Optional[str]: A comma separated list (e.g. `tag1,tag2,tag3`) of tags to use for [tag-based routing](./tag_routing) **OR** [spend-tracking](/docs/proxy/cost_tracking#custom-tags).

`x-litellm-num-retries`: Optional[int]: The number of retries for the request. This outranks a `num_retries` in the request body, in a deployment's `litellm_params`, and in `litellm_settings`. [Learn More](../routing#where-num_retries-can-be-set-and-which-one-wins)

`x-litellm-keepalive-seconds`: Optional[float]: Emit an SSE `: ping` comment frame after this many seconds of stream silence, to keep idle-looking connections alive through load balancer timeouts. Subject to the deployment's `allow_client_keepalive_override` setting; has no effect if the deployment hasn't opted in. [Learn More](./timeout#keepalive-pings-for-idle-streaming-connections)

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
  -H "Authorization: Bearer sk-1234" \
  -H "x-litellm-trace-id: my-conversation-123" \
  -d '{
    "model": "{{openai_large}}",
    "messages": [{"role": "user", "content": "Hello, who won the world cup in 2022?"}]
  }'

curl http://0.0.0.0:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-1234" \
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

## OpenAI Headers

`openai-organization` Optional[str]: The organization to use for the OpenAI API. (currently needs to be enabled via `general_settings::forward_openai_org_id: true`)

## Custom Headers

Custom headers starting with `x-` can be forwarded to LLM provider APIs when the model is configured in `forward_client_headers_to_llm_api`. [Learn more about header forwarding configuration](./forward_client_headers.md).



