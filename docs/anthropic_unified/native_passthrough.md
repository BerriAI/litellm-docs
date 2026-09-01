# Native /v1/messages Passthrough for OpenAI-Compatible Providers

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

## `/v1/responses` is not part of the opt-in

`supported_endpoints` does not change how `/v1/responses` is routed. Whether a `/v1/responses` request reaches the provider natively depends on the provider prefix of the deployment's `model`, not on `model_info`:

- A deployment whose `litellm_params.model` is prefixed `openai/` sends `/v1/responses` natively to `{api_base}/responses`. No `supported_endpoints` entry is needed
- A generic OpenAI-compatible deployment, such as one prefixed `custom_openai/`, is bridged through `/v1/chat/completions` instead, even when `/v1/responses` is listed in `supported_endpoints`

So for an OpenAI-compatible server that natively serves chat completions, the Anthropic Messages API, and the Responses API, use the `openai/` prefix with your `api_base` and add the `/v1/messages` opt-in:

| Deployment `model` | `/v1/messages` with the opt-in | `/v1/messages` without it | `/v1/responses` |
|---|---|---|---|
| `openai/<model>` | Native passthrough | Translated via the Responses API | Native |
| `custom_openai/<model>` | Native passthrough | Translated via `/v1/chat/completions` | Bridged via `/v1/chat/completions` |

Some named OpenAI-compatible providers (for example `hosted_vllm/`) ship their own Responses API support and also send `/v1/responses` natively. Check the provider's page for that
