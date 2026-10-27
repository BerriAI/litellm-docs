# GraphN

Use [GraphN](https://graphn.ai) through LiteLLM with the `graphn/` model prefix. LiteLLM reads `GRAPHN_API_KEY` and sends requests to `https://model.graphn.ai/v1`. Chat Completions, the Responses API and the Anthropic Messages API all go to GraphN's native endpoints.

## Get started

Create an API key in the [GraphN console](https://graphn.ai) and set `GRAPHN_API_KEY` in your environment or secret manager. Install `litellm` for the Python SDK, or `litellm[proxy]` for the gateway.

```bash
export GRAPHN_API_KEY="YOUR_GRAPHN_API_KEY"
pip install litellm
```

```python
from litellm import completion

response = completion(
    model="graphn/glm-5.3",
    messages=[{"role": "user", "content": "Reply with hello."}],
    reasoning_effort="low",
)
print(response.choices[0].message.content)
```

A successful request returns an assistant reply and token usage. You do not need to set `api_base`; set `GRAPHN_API_BASE` only to point LiteLLM at a different GraphN endpoint.

## Models and pricing

Prices below are USD per million tokens, checked against the [published pricing](https://graphn.ai/pricing) and live inference on October 27, 2026. Context is the combined input and output budget, and GraphN rejects a request whose prompt plus `max_tokens` exceeds it rather than shortening the output. Prefix each model ID with `graphn/` in LiteLLM.

| Model ID | Context | Max output | Input | Cached input | Output | Images |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `glm-5.3` | 1,048,576 | 131,072 | $1.40 | $0.14 | $4.40 | No |
| `deepseek-v4.1-flash` | 1,048,576 | 384,000 | $0.30 | $0.03 | $1.20 | Yes |
| `qwen3.8-27b` | 262,144 | 32,768 | $0.45 | $0.045 | $3.20 | Yes, plus video |
| `kimi-k2.5` | 256,000 | 256,000 | $0.60 | | $3.00 | Yes |
| `qwen3-vl-235b` | 262,144 | 32,768 | $0.53 | | $2.66 | Yes |
| `mistral-large-3` | 256,000 | 256,000 | $0.50 | | $1.50 | Yes |
| `qwen3-80b` | 131,072 | 32,768 | $0.20 | | $0.60 | No |
| `gpt-oss-120b` | 131,072 | 32,768 | $0.15 | | $0.60 | No |
| `qwen3-vl` | 262,144 | 65,536 | $0.10 | | $0.15 | Yes, plus video |

Every model supports `tools`, `tool_choice`, and `response_format` with JSON Schema. See [LiteLLM function calling](../completion/function_call.md) and [structured outputs](../completion/json_mode.md). The full catalog, with per-model pages, is at [graphn.ai/docs/models](https://graphn.ai/docs/models).

## Gateway setup

Install the proxy with `pip install 'litellm[proxy]'`. Set `GRAPHN_API_KEY` on the gateway process, and set `LITELLM_MASTER_KEY` to a strong key for gateway clients. The provider key authenticates upstream requests. The gateway key authenticates your client to LiteLLM.

Add this deployment to your existing configuration, or save it as `config.yaml` for a new gateway.

```yaml
model_list:
  - model_name: graphn-chat
    litellm_params:
      model: graphn/glm-5.3
      api_key: os.environ/GRAPHN_API_KEY

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
    "model": "graphn-chat",
    "messages": [{"role": "user", "content": "Reply with hello."}],
    "reasoning_effort": "low"
  }'
```

Expect HTTP 200 with an assistant message in `choices[0].message.content` and counts in `usage`. The `x-litellm-response-cost` response header carries the cost of the call at GraphN's list price.

## Streaming and prompt caching

Set `stream=True` and request usage in the final chunk.

```python
from litellm import completion

stream = completion(
    model="graphn/glm-5.3",
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

`glm-5.3`, `deepseek-v4.1-flash` and `qwen3.8-27b` cache repeated prompt prefixes automatically, with no request flag. LiteLLM uses `usage.prompt_tokens_details.cached_tokens` to charge reused input at the cached-input rate and the rest at the standard input rate. A repeated prompt does not guarantee a cache hit.

## Reasoning

Reasoning text, when returned, is available as `message.reasoning_content`. How you control it depends on the model.

`gpt-oss-120b` takes `reasoning_effort` `"low"`, `"medium"` or `"high"`. `deepseek-v4.1-flash` takes `"none"`, `"low"`, `"high"` or `"max"` and rejects `"medium"` with a 400. `glm-5.3` bounds its reasoning only at `"low"` or `"high"`; any other value, and leaving it unset, runs at its maximum, so set an effort when you also set a small `max_tokens`. `kimi-k2.5` does not reason unless asked: it takes `"none"`, `"low"`, `"medium"` or `"high"`, and on short prompts only `"high"` returns reasoning. Reasoning tokens count toward `max_tokens`, and a model still thinking at the limit returns an empty answer.

`qwen3-vl` and `qwen3.8-27b` think by default. `qwen3.8-27b` also takes `reasoning_effort` `"none"`, `"low"`, `"medium"` or `"xhigh"` and rejects `"high"`. On either model, `"none"` or the chat template flag turns thinking off.

```python
from litellm import completion

response = completion(
    model="graphn/qwen3.8-27b",
    messages=[{"role": "user", "content": "Reply with hello."}],
    extra_body={"chat_template_kwargs": {"enable_thinking": False}},
)
```

`qwen3-80b`, `qwen3-vl-235b` and `mistral-large-3` do not return reasoning.

## Responses API

LiteLLM routes `responses()` to GraphN's native `/v1/responses` endpoint. Send conversation history in `input`; do not rely on `previous_response_id` for stored history.

```python
from litellm import responses

response = responses(
    model="graphn/deepseek-v4.1-flash",
    input="Reply with hello.",
    reasoning={"effort": "low"},
    store=False,
)
print(response.output)
```

Gateway clients can send the same request to `/v1/responses` with the configured deployment name.

## Anthropic Messages API

LiteLLM forwards `/v1/messages` requests for `graphn/` models to GraphN's native Messages endpoint, so Anthropic SDK clients and tools such as Claude Code can use GraphN models through the gateway.

```bash
curl http://localhost:4000/v1/messages \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "graphn-chat",
    "max_tokens": 2000,
    "messages": [{"role": "user", "content": "Reply with hello."}]
  }'
```

## Troubleshooting

For `401`, check the key in the gateway process environment. For `400` with `context_length_exceeded`, lower `max_tokens` so the prompt and output fit the model's context. For `400` on a reasoning request, compare the effort level with the list above. For `404`, compare the unprefixed model ID with `GET https://model.graphn.ai/v1/models`. For `429`, honor the provider's retry guidance.
