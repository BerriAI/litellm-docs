# Fortytwo

<SinceVersion v="1.109.0" />

## Overview

| Property | Details |
| --- | --- |
| Description | Fortytwo serves Qwen3.8 27B through an OpenAI-compatible Chat Completions API. |
| Provider route | `fortytwo/` |
| Provider documentation | [Fortytwo documentation](https://docs.fortytwo.network/docs/openai-compatibility) |
| Default base URL | `https://api.fortytwo.network/v1` |
| Supported operations | Chat Completions, plus Responses and Messages through LiteLLM's adapters. |

Fortytwo's upstream API serves Chat Completions. LiteLLM translates Responses and Anthropic Messages requests into Chat Completions; Fortytwo does not serve those two APIs natively.

## API key

Get a key from the [Fortytwo platform](https://platform.fortytwo.network) and set `FORTYTWO_API_KEY` in your environment. `FORTYTWO_API_BASE` optionally overrides the default base URL.

```shell
export FORTYTWO_API_KEY="your-api-key"
```

## Model and prices

| Model | Context window | Maximum output | Input / 1M tokens | Cached input / 1M tokens | Output / 1M tokens |
| --- | --- | --- | --- | --- | --- |
| `fortytwo/qwen/qwen3.8-27b` | 262,144 | 235,929 | $0.425 | $0.085 | $2.55 |

See [Fortytwo models](https://docs.fortytwo.network/docs/models) for the current limits and prices. LiteLLM uses its model cost map for spend tracking, including cached input tokens reported by the upstream.

The model supports function tools, image input, reasoning and strict JSON-schema output. For `response_format` with `type: json_schema`, set `strict: true`. Only `frequency_penalty=0` is supported; omit it or use zero.

## Python SDK

### Chat

```python keep-model-ids
from litellm import completion

response = completion(
    model="fortytwo/qwen/qwen3.8-27b",
    messages=[{"role": "user", "content": "Say hello in one sentence."}],
)
print(response.choices[0].message.content)
```

### Streaming

```python keep-model-ids
from litellm import completion

stream = completion(
    model="fortytwo/qwen/qwen3.8-27b",
    messages=[{"role": "user", "content": "Explain a binary search in two sentences."}],
    stream=True,
    stream_options={"include_usage": True},
)
for chunk in stream:
    print(chunk)
```

### Tool calling

```python keep-model-ids
from litellm import completion

response = completion(
    model="fortytwo/qwen/qwen3.8-27b",
    messages=[{"role": "user", "content": "What is the weather in London?"}],
    tools=[
        {
            "type": "function",
            "function": {
                "name": "get_weather",
                "description": "Get the weather for a city.",
                "parameters": {
                    "type": "object",
                    "properties": {"city": {"type": "string"}},
                    "required": ["city"],
                },
            },
        }
    ],
    tool_choice="required",
)
print(response.choices[0].message.tool_calls)
```

### Reasoning

Fortytwo returns reasoning in `reasoning`; LiteLLM exposes it as `reasoning_content`, including streamed reasoning. `reasoning_effort` accepts `none`, `minimal`, `low`, `medium`, `high`, `xhigh` and `max`. The API default is `medium`.

```python keep-model-ids
from litellm import completion

response = completion(
    model="fortytwo/qwen/qwen3.8-27b",
    messages=[{"role": "user", "content": "What is 17 times 19?"}],
    reasoning_effort="low",
)
print(response.choices[0].message.reasoning_content)
print(response.choices[0].message.content)
```

## LiteLLM proxy

Save this model configuration locally. The proxy reads the key from the environment.

```yaml keep-model-ids
model_list:
  - model_name: fortytwo-qwen
    litellm_params:
      model: fortytwo/qwen/qwen3.8-27b
      api_key: os.environ/FORTYTWO_API_KEY
```

Start the proxy with `litellm --config config.yaml` from the release that includes this provider, then request the configured alias:

```shell
curl http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"fortytwo-qwen","messages":[{"role":"user","content":"Hello"}]}'
```

For streaming cost, send `stream: true` and `stream_options: {"include_usage": true}`. LiteLLM reports `usage.cost` in the final usage chunk. Non-streaming proxy responses include the `x-litellm-response-cost` header.
