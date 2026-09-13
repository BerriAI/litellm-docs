import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Cheaper Inference

## Overview

| Property | Details |
|-------|-------|
| Description | Cheaper Inference is an OpenAI-compatible gateway that serves each request from one of several providers for the requested model, ranked by discount, speed or a balance of both, at or below the model maker's list price. |
| Provider Route on LiteLLM | `cheaperinference/` |
| Link to Provider Doc | [Cheaper Inference ↗](https://cheaperinference.com/docs) |
| Base URL | `https://api.cheaperinference.com/v1` |
| Supported Operations | [`/chat/completions`](/docs/providers/cheaperinference#usage---litellm-python-sdk), [`/responses`](/docs/providers/cheaperinference#responses-api) |

<br />
<br />

https://cheaperinference.com/docs

**We support ALL Cheaper Inference models, just set `cheaperinference/` as a prefix when sending completion requests.**

Model IDs are unprefixed on this gateway (for example `claude-sonnet-5`, `glm-5.3-flash`), so a request looks like `cheaperinference/claude-sonnet-5`. The current catalog is returned by `GET /v1/models`.

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["CHEAPERINFERENCE_API_KEY"] = ""  # your Cheaper Inference API key
```

You can overwrite the base url with:

```python showLineNumbers title="Optional Base URL Override"
os.environ["CHEAPERINFERENCE_API_BASE"] = "https://api.cheaperinference.com/v1"
```

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="Cheaper Inference Non-streaming Completion"
import os
import litellm
from litellm import completion

os.environ["CHEAPERINFERENCE_API_KEY"] = ""  # your Cheaper Inference API key

messages = [{"content": "Hello, how are you?", "role": "user"}]

response = completion(
    model="cheaperinference/{{anthropic}}",
    messages=messages,
)

print(response)
```

### Streaming

```python showLineNumbers title="Cheaper Inference Streaming Completion"
import os
import litellm
from litellm import completion

os.environ["CHEAPERINFERENCE_API_KEY"] = ""  # your Cheaper Inference API key

messages = [{"content": "Hello, how are you?", "role": "user"}]

response = completion(
    model="cheaperinference/{{anthropic}}",
    messages=messages,
    stream=True,
)

for chunk in response:
    print(chunk)
```

### Function Calling

```python showLineNumbers title="Cheaper Inference Function Calling"
import os
import litellm
from litellm import completion

os.environ["CHEAPERINFERENCE_API_KEY"] = ""  # your Cheaper Inference API key

tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get the current weather in a given location",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {"type": "string", "description": "City name"}
                },
                "required": ["location"],
            },
        },
    }
]

response = completion(
    model="cheaperinference/{{anthropic}}",
    messages=[{"role": "user", "content": "What is the weather in Berlin?"}],
    tools=tools,
    tool_choice="auto",
)

print(response.choices[0].message.tool_calls)
```

### Responses API

Cheaper Inference exposes a stateless OpenAI Responses layer, so `litellm.responses` works with the same prefix. Requests must be stateless: `previous_response_id`, stored responses, and provider-hosted tools are not supported by the gateway.

```python showLineNumbers title="Cheaper Inference Responses API"
import os
import litellm

os.environ["CHEAPERINFERENCE_API_KEY"] = ""  # your Cheaper Inference API key

response = litellm.responses(
    model="cheaperinference/{{openai_small}}",
    input="Hello!",
    store=False,
)

print(response)
```

## Usage - LiteLLM Proxy

Add the following to your LiteLLM Proxy configuration file:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: cheaperinference-sonnet
    litellm_params:
      model: cheaperinference/{{anthropic}}
      api_key: os.environ/CHEAPERINFERENCE_API_KEY
  - model_name: cheaperinference-glm-flash
    litellm_params:
      model: cheaperinference/glm-5.3-flash
      api_key: os.environ/CHEAPERINFERENCE_API_KEY
```

Start the proxy server:

```bash showLineNumbers title="Start LiteLLM Proxy"
litellm --config config.yaml
```

Send a request:

<Tabs>
<TabItem value="curl" label="curl">

```bash showLineNumbers title="curl Request"
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -d '{
    "model": "cheaperinference-sonnet",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

</TabItem>
<TabItem value="openai-sdk" label="OpenAI SDK">

```python showLineNumbers title="OpenAI SDK against the proxy"
from openai import OpenAI

client = OpenAI(
    api_key="sk-1234",  # your LiteLLM proxy key
    base_url="http://localhost:4000",
)

response = client.chat.completions.create(
    model="cheaperinference-sonnet",
    messages=[{"role": "user", "content": "Hello!"}],
)

print(response.choices[0].message.content)
```

</TabItem>
</Tabs>

## Supported Models

Pricing is USD per 1M tokens, as returned by `GET /v1/models` on 2026-09-13. Four OpenAI models are priced in two bands: prompts above 272k input tokens bill at the higher rate shown in the last column. Treat the table as indicative rather than current: some routes here reprice hourly, and `GET /v1/models` reports a `pricing_version` hash so a cached copy can be checked against the live catalog.

| Model ID | Input | Output | Cache read | Above 272k input / output |
|---|---|---|---|---|
| `cheaperinference/gpt-6-astra` | $7.00 | $35.00 | $0.70 | $14.00 / $52.50 |
| `cheaperinference/gpt-5.6-sol` | $1.00 | $5.00 | $0.10 | $2.00 / $7.50 |
| `cheaperinference/gpt-5.6-terra` | $0.80 | $4.80 | $0.08 | $1.60 / $7.20 |
| `cheaperinference/gpt-5.6-luna` | $0.08 | $0.48 | $0.008 | $0.16 / $0.72 |
| `cheaperinference/gpt-5-mini` | $0.201421 | $1.611374 | $0.020142 |  |
| `cheaperinference/gpt-oss-120b` | $0.04 | $0.20 | $0.0085 |  |
| `cheaperinference/claude-opus-5` | $3.50 | $17.50 | $0.35 |  |
| `cheaperinference/claude-sonnet-5` | $1.40 | $7.00 | $0.14 |  |
| `cheaperinference/gemini-3.7-flash` | $0.525 | $2.625 | $0.0525 |  |
| `cheaperinference/grok-4.5` | $1.40 | $4.20 | $0.17 |  |
| `cheaperinference/kimi-k3` | $2.10 | $10.50 | $0.239969 |  |
| `cheaperinference/qwen-3-8-max` | $1.75 | $5.25 | $0.2125 |  |
| `cheaperinference/glm-5.3` | $0.77 | $2.42 | $0.119 |  |
| `cheaperinference/glm-5.3-flash` | $0.105 | $0.35 | $0.01275 |  |
| `cheaperinference/deepseek-v4.1-flash` | $0.120853 | $0.483412 | $0.002417 |  |
| `cheaperinference/deepseek-v4-flash-0731` | $0.032227 | $0.064454 | $0.006445 |  |

Any other model ID from `GET /v1/models` also works with the `cheaperinference/` prefix; only the 16 models listed above carry pricing in LiteLLM's cost map today.

## Notes

Responses echo the serving route's own model id rather than the id you sent: a request for `cheaperinference/glm-5.3-flash` comes back with `"model": "z-ai/glm-5.3-flash"`, alongside a `provider` field naming the upstream that served it. Cost tracking follows the model you requested, so spend is calculated correctly; only a direct `litellm.completion_cost(completion_response=...)` call on the raw response needs the model passed explicitly.

The price of a request is set by whichever route serves it, and the gateway documents that a request is never billed above the model maker's direct list price. Standard OpenAI parameters are forwarded (`temperature`, `top_p`, `max_tokens`, `tools`, `tool_choice`, `response_format`, reasoning controls), but support is model-specific, so verify the exact request shape for a model before moving production traffic. Wallet balance is checked before a request starts and settled after it completes; a request against an empty wallet fails with a balance error rather than a rate-limit error.
