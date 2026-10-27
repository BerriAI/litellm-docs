# Abliteration

Use [Abliteration](https://abliteration.ai) through LiteLLM with the `abliteration/` model prefix. LiteLLM reads `ABLITERATION_API_KEY` and sends requests to `https://api.abliteration.ai/v1`.

## Get started

Create an API key in your [Abliteration account](https://abliteration.ai) and set `ABLITERATION_API_KEY` in your environment or secret manager. Install `litellm` for the Python SDK, or `litellm[proxy]` for the gateway.

```bash
export ABLITERATION_API_KEY="YOUR_ABLITERATION_API_KEY"
pip install litellm
```

```python
from litellm import completion

response = completion(
    model="abliteration/abliterated-model-large-v2",
    messages=[{"role": "user", "content": "Reply with hello."}],
    reasoning_effort="low",
)
print(response.choices[0].message.content)
```

A successful request returns an assistant reply and token usage. You do not need to set `api_base`.

## Models and pricing

Prices below are USD per million tokens, checked against the [published pricing](https://abliteration.ai/pricing) and live model catalog on October 26, 2026. Context is the combined input and output budget, so the full output limit is available only when the prompt fits in the remaining context. Prefix each model ID with `abliteration/` in LiteLLM.

| Model ID | Context | Max output | Input | Cached input | Output |
| --- | ---: | ---: | ---: | ---: | ---: |
| `abliterated-model` | 262,144 | 262,134 | $1 | $0.1 | $3 |
| `abliterated-model-large` | 1,000,000 | 999,990 | $3 | $0.3 | $5 |
| `abliterated-model-large-v2` | 1,000,000 | 999,990 | $3 | $0.3 | $5 |
| `abliterated-model-large-flash` | 1,048,576 | 262,144 | $1 | $0.1 | $2 |

`abliterated-model-large` is deprecated but remains available for existing integrations. Use `abliterated-model-large-v2` for new text workloads. `abliterated-model` and `abliterated-model-large-flash` accept images. The two other models accept text only.

## Gateway setup

Install the proxy with `pip install 'litellm[proxy]'`. Set `ABLITERATION_API_KEY` on the gateway process, and set `LITELLM_MASTER_KEY` to a strong key for gateway clients. The provider key authenticates upstream requests. The gateway key authenticates your client to LiteLLM.

Add this deployment to your existing configuration, or save it as `config.yaml` for a new gateway.

```yaml
model_list:
  - model_name: abliteration-chat
    litellm_params:
      model: abliteration/abliterated-model-large-v2
      api_key: os.environ/ABLITERATION_API_KEY

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
    "model": "abliteration-chat",
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
    model="abliteration/abliterated-model-large-v2",
    messages=[{"role": "user", "content": "Reply with hello."}],
    reasoning_effort="low",
    stream=True,
    stream_options={"include_usage": True},
)
for chunk in stream:
    if chunk.choices:
        print(chunk.choices[0].delta.content or "", end="")
    if chunk.usage:
        print(chunk.usage)
```

LiteLLM uses `usage.prompt_tokens_details.cached_tokens` to charge reused input at the cached-input rate. Uncached input uses the standard input rate. A repeated prompt does not guarantee a cache hit.

Abliteration caches prompt prefixes automatically. Cache creation uses the standard input rate. Keep stable instructions and tool definitions at the start of the prompt. Pass a stable `prompt_cache_key` per conversation to improve reuse. Cache retention is not guaranteed, and `prompt_cache_retention` is unsupported. See [Abliteration prompt caching](https://docs.abliteration.ai/capabilities/prompt-caching).

## Tools, structured output, and reasoning

Chat Completions supports `tools`, `tool_choice`, and `response_format`. Use [LiteLLM function calling](../completion/function_call.md) for tool-result continuations and [structured outputs](../completion/json_mode.md) for JSON Schema examples.

Use `reasoning_effort="low"`, `"high"`, or `"max"` to select reasoning depth. `none` disables reasoning on all models except Large v2, where it selects low reasoning and hides the trace. Reasoning text, when returned, is available as `message.reasoning_content`. On native Responses, `abliterated-model` accepts effort through `xhigh` but rejects `max`. See [Abliteration reasoning](https://docs.abliteration.ai/capabilities/thinking).

## Responses API

LiteLLM translates `responses()` requests into Chat Completions for this provider. The example below uses the same model and token rates as `completion()`. Abliteration also publishes a native Responses API, but this integration keeps LiteLLM's existing translation route.

```python
from litellm import responses

response = responses(
    model="abliteration/abliterated-model-large-v2",
    input="Reply with hello.",
    reasoning={"effort": "low"},
    store=False,
)
print(response.output)
```

Gateway clients can send the same request to `/v1/responses` with the configured deployment name.

## Anthropic Messages API

LiteLLM translates Anthropic Messages requests into Chat Completions for this provider. Use the same gateway deployment with an Anthropic client, or call LiteLLM directly. Anthropic Messages requires `max_tokens`. This example uses the provider's published output maximum for Large v2.

```python
import asyncio
import litellm

async def main():
    response = await litellm.anthropic.messages.acreate(
        model="abliteration/abliterated-model-large-v2",
        messages=[{"role": "user", "content": "Reply with hello."}],
        max_tokens=999990,
        output_config={"effort": "low"},
    )
    print(response["content"])

asyncio.run(main())
```

Web search is a separate provider charge of $8 per 1,000 searches plus token usage. The model token rates above do not include that charge or account-specific subscription discounts. See [Abliteration pricing](https://docs.abliteration.ai/pricing).

## Troubleshooting

For `401`, check the key in the gateway process environment. For `402`, check provider credits. For `404`, compare the unprefixed model ID with `GET https://api.abliteration.ai/v1/models`. For `429`, honor the provider's retry guidance. A working model catalog does not guarantee that every listed model is currently available for inference.
