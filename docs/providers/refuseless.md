# Refuseless

Use [Refuseless](https://refuseless.com) through LiteLLM with the `refuseless/` model prefix. LiteLLM reads `REFUSELESS_API_KEY` and sends requests to `https://api.refuseless.com/v1`.

## Get started

Create an API key in your [Refuseless account](https://refuseless.com) and set `REFUSELESS_API_KEY` in your environment or secret manager. Install `litellm` for the Python SDK, or `litellm[proxy]` for the gateway.

```bash
export REFUSELESS_API_KEY="YOUR_REFUSELESS_API_KEY"
pip install litellm
```

```python
from litellm import completion

response = completion(
    model="refuseless/glm-5.3-abliterated",
    messages=[{"role": "user", "content": "Reply with hello."}],
    reasoning_effort="low",
)
print(response.choices[0].message.content)
```

A successful request returns an assistant reply and token usage. You do not need to set `api_base`.

## Models and pricing

Prices below are USD per million tokens, checked against the [published pricing](https://refuseless.com/pricing) and live model catalog on October 26, 2026. Context is the combined input and output budget, so the full output limit is available only when the prompt fits in the remaining context. Prefix each model ID with `refuseless/` in LiteLLM.

| Model ID | Context | Max output | Input | Cached input | Output |
| --- | ---: | ---: | ---: | ---: | ---: |
| `glm-5.3-abliterated` | 1,048,576 | 131,072 | $1.25 | $0.25 | $2.25 |
| `glm-5.3-flash-abliterated` | 1,048,576 | 131,072 | $0.25 | $0.15 | $0.8 |
| `deepseek-v4.1-flash-abliterated` | 1,048,576 | 130,000 | $0.22 | $0.045 | $0.75 |
| `deepseek-v4.1-flash-fast` | 1,048,576 | 262,144 | $0.05 | $0.003 | $0.15 |
| `minimax-m3.1-flash` | 1,048,576 | 512,000 | $0.05 | $0.002 | $0.25 |

The first three models use abliterated weights. The other two use unmodified weights.

Refuseless also lists `deepseek-v4.1-flash-free`, but live inference returned `404 model_not_found` at verification. LiteLLM excludes it from its model catalog and the supported-model table above until inference works. Choose one of the five verified models instead.

## Gateway setup

Install the proxy with `pip install 'litellm[proxy]'`. Set `REFUSELESS_API_KEY` on the gateway process, and set `LITELLM_MASTER_KEY` to a strong key for gateway clients. The provider key authenticates upstream requests. The gateway key authenticates your client to LiteLLM.

Add this deployment to your existing configuration, or save it as `config.yaml` for a new gateway.

```yaml
model_list:
  - model_name: refuseless-chat
    litellm_params:
      model: refuseless/glm-5.3-abliterated
      api_key: os.environ/REFUSELESS_API_KEY

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

```bash
litellm --config config.yaml --port 4000
```

In a second terminal with `LITELLM_MASTER_KEY` set, send a request.

```bash
curl http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "refuseless-chat",
    "messages": [{"role": "user", "content": "Reply with hello."}],
    "reasoning_effort": "low"
  }'
```

Expect HTTP 200 with an assistant message in `choices[0].message.content` and counts in `usage`.

## Streaming and prompt caching

Set `stream=True` and request usage in the final chunk.

```python
from litellm import completion

stream = completion(
    model="refuseless/glm-5.3-abliterated",
    messages=[{"role": "user", "content": "Reply with hello."}],
    reasoning_effort="low",
    stream=True,
    stream_options={"include_usage": True},
)
for chunk in stream:
    if chunk.choices:
        print(chunk.choices[0].delta.content or "", end="")
    if getattr(chunk, "usage", None):
        print(chunk.usage)
```

LiteLLM uses `usage.prompt_tokens_details.cached_tokens` to charge reused input at the cached-input rate. Uncached input uses the standard input rate. A repeated prompt does not guarantee a cache hit.

## Tools, structured output, and reasoning

Chat Completions supports `tools`, `tool_choice`, and `response_format`. Use [LiteLLM function calling](../completion/function_call.md) for tool-result continuations and [structured outputs](../completion/json_mode.md) for JSON Schema examples.

Use `reasoning_effort="low"`, `"high"`, or `"max"`. The live catalog publishes supported effort levels per model and defaults to `low`. Refuseless also advertises `off` for its paid DeepSeek variants. Do not assume OpenAI effort names such as `medium` and `xhigh` are accepted by the provider. LiteLLM uses the declared effort levels to resolve supported requests. Reasoning text, when returned, is available as `message.reasoning_content`. See [Refuseless reasoning](https://docs.refuseless.com/guides/reasoning).

## Responses API

LiteLLM routes `responses()` to the provider's native `/v1/responses` endpoint. Send conversation history in `input`. These APIs are stateless, so do not rely on `previous_response_id` for stored history.

```python
from litellm import responses

response = responses(
    model="refuseless/glm-5.3-abliterated",
    input="Reply with hello.",
    reasoning={"effort": "low"},
    store=False,
)
print(response.output)
```

Gateway clients can send the same request to `/v1/responses` with the configured deployment name.

## Troubleshooting

For `401`, check the key in the gateway process environment. For `402`, check provider credits. For `404`, compare the unprefixed model ID with `GET https://api.refuseless.com/v1/models`. For `429`, honor the provider's retry guidance. A working model catalog does not guarantee that every listed model is currently available for inference.
