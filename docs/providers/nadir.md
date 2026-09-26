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

## Supported OpenAI Parameters

Nadir validates requests against its own schema and drops anything outside it,
so LiteLLM advertises only the parameters the endpoint honors:

`frequency_penalty`, `max_tokens`, `presence_penalty`, `response_format`,
`stream`, `temperature`, `top_p`

`extra_headers` and `max_retries` are handled by the LiteLLM transport rather
than sent in the request body. Passing any other parameter raises
`litellm.UnsupportedParamsError` unless `drop_params=True` is set.

:::info

`tools`, `tool_choice`, and `functions` are **not** supported. Function calling
is not part of Nadir's request schema today.

:::
