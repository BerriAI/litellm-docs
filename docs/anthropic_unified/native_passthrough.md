# Native /v1/messages and /v1/responses Passthrough for OpenAI-Compatible Providers

When a deployment's provider has no native Anthropic Messages support, LiteLLM translates each `/v1/messages` request into the provider's own API: `openai/` deployments go through the OpenAI Responses API (see [the parameter mapping](./messages_to_responses_mapping.md)) and everything else goes through `/v1/chat/completions`. That translation only keeps what the target API can express: `cache_control` blocks are dropped, `thinking` is mapped to the provider's own reasoning parameter, and other Anthropic-only request details are approximated or lost

Many OpenAI-compatible servers (self-hosted vLLM, inference hubs, model vendors with an Anthropic-compatible endpoint) also expose the Anthropic Messages API natively. For those, you can opt a deployment into forwarding the Anthropic payload untranslated. Available from v1.92.0

## Opt in with `supported_endpoints`

Add `/v1/messages` to `model_info.supported_endpoints` on the deployment:

```yaml
model_list:
  - model_name: my-open-model
    litellm_params:
      model: openai/some-open-model
      api_base: https://inference.example.com/v1
      api_key: os.environ/EXAMPLE_API_KEY
    model_info:
      supported_endpoints: ["/v1/chat/completions", "/v1/messages"]
```

With the opt-in, a request to the proxy's `/v1/messages` is POSTed to `{api_base}/v1/messages` with the Anthropic body unchanged, apart from `cache_control` (see below). A trailing `/v1` on `api_base` is stripped first, so `https://inference.example.com/v1` and `https://inference.example.com` both resolve to `https://inference.example.com/v1/messages`. LiteLLM sends `Authorization: Bearer <api_key>` unless the request already carries an `Authorization` or `x-api-key` header, defaults `anthropic-version` to `2023-06-01`, and forwards `anthropic-beta` headers, both the ones the caller sent and the ones LiteLLM adds for features like context management. Streaming and response parsing work the same way they do for a native Anthropic deployment

Without the opt-in the deployment behaves as before and the request is translated. `/v1/chat/completions` calls to the same deployment are not affected either way

## `cache_control` is reduced to its portable core

Strict implementations of the Messages API reject Anthropic-only `cache_control` extensions such as `ttl` with `cache_control.ttl: 1h is not supported`, and clients like Claude Code send `{"type": "ephemeral", "ttl": "1h"}` on every prompt block whenever 1h prompt caching is on. So by default every `cache_control` in the forwarded body is reduced to `{"type": "ephemeral"}`, at the request level and in system blocks, tools, message content blocks, and `tool_result` content. Application data such as `tool_use.input` and tool `input_schema` is never touched

When the upstream honors `ttl`, keep it with `cache_control_ttl: true` in `model_info`:

```yaml
model_list:
  - model_name: my-open-model
    litellm_params:
      model: openai/some-open-model
      api_base: https://inference.example.com/v1
      api_key: os.environ/EXAMPLE_API_KEY
    model_info:
      supported_endpoints: ["/v1/chat/completions", "/v1/messages"]
      cache_control_ttl: true
```

Deployments of providers with built-in Anthropic Messages support (`anthropic/`, `bedrock/`, `vertex_ai/`, and others) keep forwarding `cache_control` as sent

Test it with an Anthropic-only feature in the request:

```bash
curl http://0.0.0.0:4000/v1/messages \
  -H "Authorization: Bearer sk-1234" \
  -H "content-type: application/json" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "my-open-model",
    "max_tokens": 64,
    "system": [{"type": "text", "text": "You are concise", "cache_control": {"type": "ephemeral"}}],
    "messages": [{"role": "user", "content": "Say hi in three words"}]
  }'
```

The response comes back in the provider's native Anthropic shape, including its own `usage` fields such as `cache_creation_input_tokens` and `cache_read_input_tokens`

The opt-in only matters for providers LiteLLM would otherwise translate, such as `openai/` and `custom_openai/` deployments. Providers with built-in Anthropic Messages support (`anthropic/`, `bedrock/`, `vertex_ai/`, and others) already forward natively and ignore it

## Native `/v1/responses` passthrough

A deployment whose `litellm_params.model` is prefixed `openai/` already sends `/v1/responses` natively to `{api_base}/responses`. A generic OpenAI-compatible deployment such as `custom_openai/` has no Responses API config of its own, so by default LiteLLM bridges `/v1/responses` through `/v1/chat/completions`: the input is converted to messages, the chat completion is converted back into a Responses object, and Responses-only request fields are approximated or dropped. When the server serves `/responses` itself, add `/v1/responses` to `model_info.supported_endpoints` to forward the request untranslated. Available from v1.102.0

```yaml
model_list:
  - model_name: my-open-model
    litellm_params:
      model: custom_openai/some-open-model
      api_base: https://inference.example.com/v1
      api_key: os.environ/EXAMPLE_API_KEY
    model_info:
      supported_endpoints: ["/v1/chat/completions", "/v1/responses"]
```

With the opt-in, a request to the proxy's `/v1/responses` is POSTed to `{api_base}/responses` (`https://inference.example.com/v1/responses` here) with `Authorization: Bearer <api_key>`, for streaming and non-streaming requests alike. Deployments with `mode: responses` in `model_info` behave the same way. Without the opt-in the deployment keeps bridging through `/v1/chat/completions`, and `/v1/chat/completions` calls to the deployment are not affected either way. The `/v1/messages` and `/v1/responses` opt-ins are independent: list both when the server serves both

```bash
curl http://0.0.0.0:4000/v1/responses \
  -H "Authorization: Bearer sk-1234" \
  -H "content-type: application/json" \
  -d '{"model": "my-open-model", "input": "Say hi in three words"}'
```

### `previous_response_id` on stateless backends

The native path forwards `previous_response_id` to the backend as sent, so the backend is what resolves it. OpenAI-compatible servers that do not store responses reject it, typically with a 400, and that error is returned to the caller unchanged. Against such a backend either send the full conversation history in `input` on every turn, or leave the opt-in off and use the bridged path with `store_prompts_in_spend_logs: true`, which lets LiteLLM resolve `previous_response_id` from its own spend logs

| Deployment `model` | `/v1/messages` with the opt-in | `/v1/messages` without it | `/v1/responses` with the opt-in | `/v1/responses` without it |
|---|---|---|---|---|
| `openai/<model>` | Native passthrough | Translated via the Responses API | Native | Native |
| `custom_openai/<model>` | Native passthrough | Translated via `/v1/chat/completions` | Native passthrough | Bridged via `/v1/chat/completions` |

Some named OpenAI-compatible providers (for example `hosted_vllm/`) ship their own Responses API support and also send `/v1/responses` natively without the opt-in. Check the provider's page for that
