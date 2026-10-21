# Native /v1/responses Passthrough for OpenAI-Compatible Providers

A deployment whose `litellm_params.model` is prefixed `openai/` already sends `/v1/responses` natively to `{api_base}/responses`. A deployment whose provider has no Responses API config of its own, which is the case for `custom_openai/`, `openai_like/`, `baseten/` and most other OpenAI-compatible providers, bridges `/v1/responses` through `/v1/chat/completions` by default: the input is converted to messages, the chat completion is converted back into a Responses object, and Responses-only request fields are approximated or dropped. When the server serves `/responses` itself, add `/v1/responses` to `model_info.supported_endpoints` to forward the request untranslated. The opt-in is read per deployment and does not depend on the provider prefix, so it works the same for a named provider such as `baseten/` as for `custom_openai/`. Available from v1.101.0

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

The same line on a named OpenAI-compatible provider keeps that provider's API base, API key and cost map prices, so there is no need to switch the deployment to `custom_llm_provider: openai` to get native Responses:

```yaml
model_list:
  - model_name: glm-5.2
    litellm_params:
      model: baseten/zai-org/GLM-5.2
      api_key: os.environ/BASETEN_API_KEY
    model_info:
      supported_endpoints: ["/v1/chat/completions", "/v1/responses"]
```

With the opt-in, a request to the proxy's `/v1/responses` is POSTed to `{api_base}/responses` (`https://inference.example.com/v1/responses` here) with `Authorization: Bearer <api_key>`, for streaming and non-streaming requests alike. Deployments with `mode: responses` in `model_info` behave the same way. Without the opt-in the deployment keeps bridging through `/v1/chat/completions`, and `/v1/chat/completions` calls to the deployment are not affected either way. The `/v1/messages` and `/v1/responses` opt-ins are independent: list both when the server serves both, see [Native /v1/messages passthrough](./anthropic_unified/native_passthrough.md)

```bash
curl http://0.0.0.0:4000/v1/responses \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "content-type: application/json" \
  -d '{"model": "my-open-model", "input": "Say hi in three words"}'
```

## `previous_response_id` on stateless backends

The native path forwards `previous_response_id` to the backend as sent, so the backend is what resolves it. OpenAI-compatible servers that do not store responses reject it, typically with a 400, and that error is returned to the caller unchanged. Against such a backend either send the full conversation history in `input` on every turn, or leave the opt-in off and use the bridged path with `store_prompts_in_spend_logs: true`, which lets LiteLLM resolve `previous_response_id` from its own spend logs

| Deployment `model` | `/v1/responses` with the opt-in | `/v1/responses` without it |
|---|---|---|
| `openai/<model>` | Native | Native |
| `custom_openai/<model>` | Native passthrough | Bridged via `/v1/chat/completions` |
| `baseten/<model>` and other OpenAI-compatible providers without their own Responses API config | Native passthrough | Bridged via `/v1/chat/completions` |

Some named OpenAI-compatible providers (for example `hosted_vllm/`) ship their own Responses API support and also send `/v1/responses` natively without the opt-in. Check the provider's page for that
