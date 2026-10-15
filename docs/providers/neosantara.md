import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Neosantara

## Overview

| Property | Details |
|-------|-------|
| Description | Neosantara provides an OpenAI-compatible API for chat completions and the Responses API. |
| Provider Route on LiteLLM | `neosantara/` |
| Link to Provider Doc | [Neosantara ↗](https://docs.neosantara.xyz) |
| Base URL | `https://api.neosantara.xyz/v1` |
| Supported Operations | [`/chat/completions`](#usage---litellm-python-sdk), [`/responses`](#responses-api), [function calling](#function-calling) |

<br />
<br />

**We support Neosantara models through the `neosantara/` prefix in LiteLLM.**

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["NEOSANTARA_API_KEY"] = ""  # your Neosantara API key
```

A free-tier Neosantara account can call `gemini-3.1-flash-lite`, which the examples on this page use. Some models, such as `gemini-3.5-flash`, answer 403 `insufficient_tier` until the account has deposited credits.

You can override the default base URL with:

```python showLineNumbers title="Optional Base URL Override"
os.environ["NEOSANTARA_API_BASE"] = "https://api.neosantara.xyz/v1"
```

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="Neosantara Non-streaming Completion"
import os
from litellm import completion

os.environ["NEOSANTARA_API_KEY"] = ""

response = completion(
    model="neosantara/gemini-3.1-flash-lite",
    messages=[{"role": "user", "content": "Hello from LiteLLM"}],
    max_tokens=64,
)

print(response.choices[0].message.content)
```

### Streaming

```python showLineNumbers title="Neosantara Streaming Completion"
import os
from litellm import completion

os.environ["NEOSANTARA_API_KEY"] = ""

response = completion(
    model="neosantara/gemini-3.1-flash-lite",
    messages=[{"role": "user", "content": "Write a one-line poem about Jakarta"}],
    max_tokens=64,
    stream=True,
)

for chunk in response:
    if chunk.choices[0].delta.content is not None:
        print(chunk.choices[0].delta.content, end="")
```

## Function Calling

### Chat Completions

Function calling works on Neosantara through `completion()`. Depending on the model, LiteLLM may require explicitly allowing the OpenAI params on this provider route.

```python showLineNumbers title="Neosantara Function Calling via completion()"
import os
from litellm import completion

os.environ["NEOSANTARA_API_KEY"] = ""

response = completion(
    model="neosantara/gemini-3.1-flash-lite",
    messages=[{"role": "user", "content": "What is the weather in Jakarta? Use the tool."}],
    tools=[
        {
            "type": "function",
            "function": {
                "name": "get_weather",
                "description": "Get weather by city name",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "city": {"type": "string"}
                    },
                    "required": ["city"]
                }
            }
        }
    ],
    tool_choice="auto",
    allowed_openai_params=["tools", "tool_choice"],
    max_tokens=128,
)

print(response.choices[0].message.tool_calls)
```

## Responses API

Neosantara also supports LiteLLM's `responses()` interface.

```python showLineNumbers title="Neosantara Responses API"
import os
from litellm import responses

os.environ["NEOSANTARA_API_KEY"] = ""

response = responses(
    model="neosantara/gemini-3.1-flash-lite",
    input="Reply with exactly: pong",
    max_output_tokens=8,
)

print(response.output_text)
```

### Responses API Tool Calling

Function calling also works through `responses()`:

```python showLineNumbers title="Neosantara Function Calling via responses()"
import os
from litellm import responses

os.environ["NEOSANTARA_API_KEY"] = ""

response = responses(
    model="neosantara/gemini-3.1-flash-lite",
    input="What is the weather in Jakarta? Use the tool.",
    tools=[
        {
            "type": "function",
            "name": "get_weather",
            "description": "Get weather by city name",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {"type": "string"}
                },
                "required": ["city"]
            }
        }
    ],
    max_output_tokens=128,
)

print(response.output)
```

## Parameter Compatibility

LiteLLM maps `max_completion_tokens` to `max_tokens` for Neosantara automatically.

```python showLineNumbers title="Neosantara max_completion_tokens Compatibility"
import os
from litellm import completion

os.environ["NEOSANTARA_API_KEY"] = ""

response = completion(
    model="neosantara/gemini-3.1-flash-lite",
    messages=[{"role": "user", "content": "Summarize LiteLLM in one sentence"}],
    max_completion_tokens=64,
)

print(response.choices[0].message.content)
```

## Reasoning Effort

LiteLLM can pass `reasoning_effort` through to Neosantara, but like tool calling on `completion()`, you should explicitly allow the parameter on this provider route.

```python showLineNumbers title="Neosantara reasoning_effort"
import os
from litellm import completion

os.environ["NEOSANTARA_API_KEY"] = ""

response = completion(
    model="neosantara/gemini-3.1-flash-lite",
    messages=[{"role": "user", "content": "Reply with exactly: reasoned"}],
    reasoning_effort="high",
    allowed_openai_params=["reasoning_effort"],
    max_tokens=8,
)

print(response.choices[0].message.content)
```

## Usage - LiteLLM Proxy

Add the following to your LiteLLM Proxy configuration file:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: neosantara-gemini-flash-lite
    litellm_params:
      model: neosantara/gemini-3.1-flash-lite
      api_key: os.environ/NEOSANTARA_API_KEY

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

Start your LiteLLM Proxy server:

```bash showLineNumbers title="Start LiteLLM Proxy"
export NEOSANTARA_API_KEY="your-neosantara-api-key"
export LITELLM_MASTER_KEY="${LITELLM_MASTER_KEY:-sk-$(openssl rand -hex 16)}"
printf 'Local proxy key: %s\n' "$LITELLM_MASTER_KEY"
litellm --config config.yaml

# RUNNING on http://0.0.0.0:4000
```

In another terminal, set `LITELLM_MASTER_KEY` to the key printed above and call the proxy:

<Tabs>
<TabItem value="openai-sdk" label="OpenAI SDK">

```python showLineNumbers title="Neosantara via Proxy - OpenAI SDK"
import os
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:4000",
    api_key=os.environ["LITELLM_MASTER_KEY"],
)

response = client.chat.completions.create(
    model="neosantara-gemini-flash-lite",
    messages=[{"role": "user", "content": "Say hello from the proxy"}],
)

print(response.choices[0].message.content)
```

</TabItem>

<TabItem value="litellm-sdk" label="LiteLLM SDK">

```python showLineNumbers title="Neosantara via Proxy - LiteLLM SDK"
import os
import litellm

response = litellm.completion(
    model="litellm_proxy/neosantara-gemini-flash-lite",
    messages=[{"role": "user", "content": "Say hello from the proxy"}],
    api_base="http://localhost:4000",
    api_key=os.environ["LITELLM_MASTER_KEY"],
)

print(response.choices[0].message.content)
```

</TabItem>

<TabItem value="curl" label="cURL">

```bash showLineNumbers title="Neosantara via Proxy - cURL"
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -d '{
    "model": "neosantara-gemini-flash-lite",
    "messages": [{"role": "user", "content": "Say hello from the proxy"}]
  }'
```

```bash showLineNumbers title="Neosantara via Proxy - Responses API"
curl http://localhost:4000/v1/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -d '{
    "model": "neosantara-gemini-flash-lite",
    "input": "Reply with exactly: pong"
  }'
```

</TabItem>
</Tabs>

### Tools and reasoning_effort on the Proxy

Depending on the model, the proxy can answer 400 `UnsupportedParamsError` to `tools`, `tool_choice`, `parallel_tool_calls`, or `reasoning_effort`, as it does for `glm-4.7-flash`. Allow the params on the deployment, the same way `allowed_openai_params` works on `completion()`:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: neosantara-glm-flash
    litellm_params:
      model: neosantara/glm-4.7-flash
      api_key: os.environ/NEOSANTARA_API_KEY
      allowed_openai_params: ["tools", "tool_choice", "parallel_tool_calls", "reasoning_effort"]
```

### Spend Tracking on the Proxy

Neosantara models are not in LiteLLM's model cost map, so the proxy records $0 spend for them and key or team budgets never move. To track spend, set `input_cost_per_token` and `output_cost_per_token` in `litellm_params`, as shown in [Custom Pricing](../proxy/custom_pricing). Both are in USD per token, so divide a Neosantara price per million tokens by 1,000,000.

## Notes

- Use the `neosantara/` model prefix when calling Neosantara through LiteLLM.
- The default auth env var is `NEOSANTARA_API_KEY`.
- `NEOSANTARA_API_BASE` can be used to point LiteLLM at a custom Neosantara-compatible base URL.
- `max_completion_tokens` is mapped to `max_tokens` automatically.
- On `completion()` and on the proxy, `tools`, `tool_choice`, `parallel_tool_calls`, and `reasoning_effort` may require `allowed_openai_params` so LiteLLM will pass them through.
