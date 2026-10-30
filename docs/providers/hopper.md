---
title: Hopper
description: Use Hopper's DeepSeek and Gemma models with LiteLLM, including streaming, tools, prompt caching, and Anthropic Messages.
---

# Hopper

<SinceVersion v="1.109.0" />

[Hopper](https://withhopper.com) serves DeepSeek and Gemma through OpenAI-compatible Chat Completions and Anthropic-compatible Messages. Use the `hopper/` model prefix and a [Hopper API key](https://withhopper.com/console/keys). LiteLLM reads `HOPPER_API_KEY` and uses `https://api.withhopper.com/v1` by default.

:::note Availability
Hopper support is pending in [LiteLLM PR #49139](https://github.com/BerriAI/litellm/pull/49139). These examples require a build that includes that integration.
:::

## API key

Sign up or sign in to the [Hopper console](https://withhopper.com/console/keys), then create a key. New accounts receive $5 in credit shared across their keys. Check Hopper's [model and credit terms](https://docs.withhopper.com/models) for current details. Store the key in your server environment or secret manager.

## Python SDK

Install LiteLLM and set your key in the environment or your secret manager.

```bash
pip install litellm
export HOPPER_API_KEY="YOUR_HOPPER_API_KEY"
```

```python
from litellm import completion

response = completion(
    model="hopper/deepseek-v4.1-flash-1017",
    messages=[{"role": "user", "content": "Reply with READY."}],
    max_tokens=256,
    chat_template_kwargs={"thinking": False},
)
print(response.choices[0].message.content)
```

Set `HOPPER_API_BASE` or pass `api_base` to use another Hopper endpoint. An explicit `api_key` or `api_base` takes precedence over the environment.

## Models

The [Hopper catalog](https://withhopper.com/mcp) and authenticated `/v1/models` endpoint were checked on October 29, 2026. Prices below are USD per million tokens. Context is the combined input and output budget. Use the `hopper/` prefix in LiteLLM; requests sent directly to Hopper use the model ID without that prefix.

**`hopper/deepseek-v4.1-flash-1017`** has a 1,048,576-token context window. Input costs $0.09, cached input $0.007, and output $0.85. This is the standard model.

**`hopper/deepseek-v4.1-flash-1017-abliterated`** has a 1,048,576-token context window. Input costs $0.30, cached input $0.03, and output $1.20. This variant uses abliterated weights.

**`hopper/gemma-4-31b`** has a 262,144-token context window. Input costs $0.30, cached input $0.12, and output $0.40.

All three support text, tools, streaming, and prompt caching. Both DeepSeek variants support images and JSON-schema output. Hopper's Gemma deployment rejects images, and its JSON-schema output did not pass validation, so LiteLLM does not advertise those capabilities for Gemma.

Both DeepSeek variants accept a `max_tokens` request cap of 1,048,576. Input and output share the context window, so the prompt reduces the tokens available for generation. A live abliterated request processed 1,048,053 input tokens; full-length output generation has not been tested.

## Streaming and caching

```python
from litellm import completion

stream = completion(
    model="hopper/deepseek-v4.1-flash-1017",
    messages=[{"role": "user", "content": "Reply with exactly READY."}],
    max_tokens=256,
    chat_template_kwargs={"thinking": False},
    stream=True,
    stream_options={"include_usage": True},
)
for chunk in stream:
    if chunk.choices:
        print(chunk.choices[0].delta.content or "", end="")
    if getattr(chunk, "usage", None):
        print(chunk.usage)
```

Keep shared prompts and tool definitions at the start of the conversation to reuse cached prefixes. Cache hits appear in `usage.prompt_tokens_details.cached_tokens`. LiteLLM applies each model's cached-input rate to those tokens. A repeated prompt does not guarantee a cache hit.

For DeepSeek reasoning, pass `reasoning_effort="low"`, `"high"`, or `"max"`. For Gemma voice workloads, omit `reasoning_effort` to avoid enabling thinking and adding latency.

## Tools and structured output

All three models accept `tools` and `tool_choice`. Follow [LiteLLM's function-calling guide](../completion/function_call.md) to return tool results to the model. Both DeepSeek variants also accept `response_format` with a JSON schema. See [structured outputs](../completion/json_mode.md) for request examples.

## Gateway

Install the proxy with `pip install 'litellm[proxy]'`. Set `HOPPER_API_KEY` on the gateway and set `LITELLM_MASTER_KEY` to a strong key for its clients. The Hopper key authenticates upstream requests; clients use the LiteLLM key. Save this as `config.yaml`.

```yaml
model_list:
  - model_name: hopper-deepseek
    litellm_params:
      model: hopper/deepseek-v4.1-flash-1017
      api_key: os.environ/HOPPER_API_KEY
general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

```bash
litellm --config config.yaml --host 127.0.0.1 --port 4000
```

In a second terminal with `LITELLM_MASTER_KEY` set, send a request.

```bash
curl -i http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"hopper-deepseek","messages":[{"role":"user","content":"Reply with READY."}],"max_tokens":256,"chat_template_kwargs":{"thinking":false}}'
```

Expect HTTP 200, an assistant reply, token usage, and an `x-litellm-response-cost` header. To use Gemma or the abliterated variant, replace the model ID in the deployment.

## Anthropic Messages

LiteLLM forwards `/v1/messages` requests to Hopper's native Messages endpoint with the same key. The following request uses the gateway deployment above.

```bash
curl -i http://localhost:4000/v1/messages \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -H "anthropic-version: 2023-06-01" \
  -d '{"model":"hopper-deepseek","messages":[{"role":"user","content":"Reply with READY."}],"max_tokens":256,"thinking":{"type":"disabled"}}'
```

Expect a message with `content`, `stop_reason`, and `usage`. Add `"stream":true` for server-sent events. Hopper's Messages adapter accepts `budget_tokens` but does not enforce it as a hard thinking limit. It does not support `top_k`.

## Responses API

LiteLLM exposes `/v1/responses` through its Chat Completions bridge for Hopper. This is not a native Hopper Responses endpoint. Use the gateway deployment name and send conversation history in `input`.

```bash
curl -i http://localhost:4000/v1/responses \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"hopper-deepseek","input":"Reply with exactly READY.","max_output_tokens":256,"store":false}'
```

Expect a Responses object with `output` and `usage`. This example does not use stored response state.

## Troubleshooting

For `401`, check the Hopper key in the gateway environment and the LiteLLM key in the client. For `402`, check the account's [credit balance](https://withhopper.com/console/billing). For `404`, compare the unprefixed model ID with Hopper's `/v1/models` response. For `429`, honor `Retry-After`. See [Hopper's error reference](https://docs.withhopper.com/errors) for details.

See Hopper's [coding-agent setup guide](https://withhopper.com/agents/deepseek-v4.1-flash-1017.md), [abliterated model page](https://withhopper.com/cyber), and [Gemma guide](https://withhopper.com/skill.md) for direct provider setup.
