# Nadir

## Overview

| Property | Details |
|-------|-------|
| Description | Nadir is an intelligent LLM router. A single virtual model, `auto`, is classified by complexity server-side and routed to the cheapest model that clears the quality bar. |
| Provider Route on LiteLLM | `nadir/` |
| Link to Provider Doc | [Nadir Documentation ↗](https://getnadir.com/docs) |
| Base URL | `https://api.getnadir.com/v1` |
| Supported Operations | `/chat/completions` |

<br />

Nadir speaks the OpenAI `/v1/chat/completions` dialect, so no request translation is required.

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["NADIR_API_KEY"] = ""  # your Nadir API key
```

## Optional Variables

```python showLineNumbers title="Environment Variables"
os.environ["NADIR_API_BASE"] = ""  # defaults to https://api.getnadir.com/v1
```

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="Nadir Non-streaming Completion"
import os
import litellm
from litellm import completion

os.environ["NADIR_API_KEY"] = "your-api-key"

response = completion(
    model="nadir/auto",
    messages=[{"content": "Hello, how are you?", "role": "user"}],
)
print(response)
```

### Streaming

```python showLineNumbers title="Nadir Streaming Completion"
import os
import litellm
from litellm import completion

os.environ["NADIR_API_KEY"] = "your-api-key"

response = completion(
    model="nadir/auto",
    messages=[{"content": "Hello, how are you?", "role": "user"}],
    stream=True,
)
for chunk in response:
    print(chunk)
```

### Tool calling

```python showLineNumbers title="Nadir Tool Calling"
import os
from litellm import completion

os.environ["NADIR_API_KEY"] = "your-api-key"

tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get the current weather for a city",
            "parameters": {
                "type": "object",
                "properties": {"city": {"type": "string"}},
                "required": ["city"],
            },
        },
    }
]

response = completion(
    model="nadir/auto",
    messages=[{"role": "user", "content": "What is the weather in Paris?"}],
    tools=tools,
    tool_choice="auto",
)
print(response.choices[0].message.tool_calls)
```

Tool calls stream too. With `stream=True`, Nadir streams the tool-call deltas
and ends the turn with `finish_reason="tool_calls"`.

## Usage - LiteLLM Proxy

Add the following to your LiteLLM Proxy configuration file:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: nadir-auto
    litellm_params:
      model: nadir/auto
      api_key: os.environ/NADIR_API_KEY
```

Start your LiteLLM Proxy server:

```bash showLineNumbers title="Start LiteLLM Proxy"
litellm --config config.yaml
```

```bash showLineNumbers title="Nadir via Proxy - cURL"
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -d '{
    "model": "nadir-auto",
    "messages": [{"role": "user", "content": "Hello, how are you?"}]
  }'
```

## Model

Nadir exposes one virtual model. Send `nadir/auto` and the router picks the
underlying model per request.

| Model Name | Function Call |
|------------|---------------|
| auto | `completion(model="nadir/auto", messages=messages)` |

## Cost tracking

The `model` field on the response reports the model Nadir actually routed to.
Nadir returns the cost it computed for a non-streaming call, and LiteLLM records
that as the response cost, so the SDK's `response_cost`, the proxy's
`x-litellm-response-cost` header, and the spend logs all carry Nadir's number:

```python
print(f"Request cost: ${response._hidden_params['response_cost']}")
```

Streaming responses carry no cost from Nadir. LiteLLM prices them from the
routed model's own entry in the LiteLLM model cost map, for example
`openrouter/anthropic/claude-haiku-4.5`, so a routed model with no cost map
entry logs a streamed call at $0.

A non-streaming call that Nadir could not price is priced the same way. Nadir
still returns a total for it, flagged with `cost_breakdown.pricing_failed`, and
LiteLLM prices the call from the routed model's cost map entry instead of
recording that total.

## Supported OpenAI Parameters

Nadir validates requests against its own schema and drops anything outside it,
so LiteLLM advertises only the parameters the endpoint honors:

`frequency_penalty`, `max_tokens`, `parallel_tool_calls`, `presence_penalty`,
`response_format`, `service_tier`, `stream`, `temperature`, `tool_choice`,
`tools`, `top_p`, `user`

`user` is recorded as the end user on Nadir's usage log, so spend can be split
per end user. `service_tier` is forwarded only when the routed model's provider
accepts it.

`extra_headers` and `max_retries` are handled by the LiteLLM transport rather
than sent in the request body. Passing any other parameter raises
`litellm.UnsupportedParamsError` unless `drop_params=True` is set.

:::info

The legacy `functions` and `function_call` parameters are not supported. Use
`tools` and `tool_choice` instead.

:::
