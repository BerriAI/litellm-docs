import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# SayGM

## Overview

| Property | Details |
|-------|-------|
| Description | SayGM is an LLM API gateway that serves GPT and open-weight models (DeepSeek, GLM, Kimi, Qwen, Gemma) over an OpenAI-compatible API on one prepaid key. Open-weight models also come in `-tee` variants served inside an Intel TDX enclave. |
| Provider Route on LiteLLM | `saygm/` |
| Link to Provider Doc | [SayGM ↗](https://saygm.com) ([llms.txt](https://saygm.com/llms.txt)) |
| Base URL | `https://api.saygm.com/v1` |
| Supported Operations | [`/chat/completions`](#usage---litellm-python-sdk), [`/responses`](#responses-api), [`/messages`](#usage---litellm-proxy-server) |

<br />
<br />

**We support all SayGM models that serve Chat Completions, just set `saygm/` as a prefix when sending requests**

SayGM's live model list, with prices and the API each model serves, is public at `GET https://api.saygm.com/v1/models` (no key needed). Models whose `api_shapes` include `chat.completions` work with the `saygm/` route. Claude models are served only on SayGM's Anthropic Messages endpoint and Gemini models only on `generateContent`, so they are not reachable through `saygm/`; use the `anthropic/` or `gemini/` provider with SayGM's base URL for those.

## Example Models

| Model | Maker |
|-------|-------|
| `saygm/deepseek-v4.1-flash` | DeepSeek |
| `saygm/glm-5.3` | Z.ai |
| `saygm/glm-5.3-flash` | Z.ai |
| `saygm/kimi-k3` | Moonshot AI |
| `saygm/gpt-6-sol` | OpenAI |
| `saygm/gpt-5.4-mini` | OpenAI |
| `saygm/glm-5.3-tee` | Z.ai (served in a TEE) |

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["SAYGM_API_KEY"] = ""  # your SayGM API key
os.environ["SAYGM_API_BASE"] = ""  # optional, defaults to https://api.saygm.com/v1
```

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="SayGM Non-streaming Completion"
import os
from litellm import completion

os.environ["SAYGM_API_KEY"] = ""  # your SayGM API key

response = completion(
    model="saygm/deepseek-v4.1-flash",
    messages=[{"role": "user", "content": "Hello, how are you?"}],
)

print(response.choices[0].message.content)
```

### Streaming

```python showLineNumbers title="SayGM Streaming Completion"
import os
from litellm import completion

os.environ["SAYGM_API_KEY"] = ""  # your SayGM API key

response = completion(
    model="saygm/glm-5.3-flash",
    messages=[{"role": "user", "content": "Write a short story about AI"}],
    stream=True,
)

for chunk in response:
    print(chunk)
```

### Tool Calling

SayGM models are not yet in LiteLLM's model cost map, so LiteLLM cannot look up whether a model supports function calling. Pass `allowed_openai_params=["tools"]` to send tools.

```python showLineNumbers title="SayGM Tool Calling"
import os
from litellm import completion

os.environ["SAYGM_API_KEY"] = ""  # your SayGM API key

response = completion(
    model="saygm/gpt-5.4-mini",
    messages=[{"role": "user", "content": "What's the weather in Paris?"}],
    tools=[{
        "type": "function",
        "function": {
            "name": "get_weather",
            "parameters": {
                "type": "object",
                "properties": {"city": {"type": "string"}},
                "required": ["city"],
            },
        },
    }],
    allowed_openai_params=["tools"],
)

print(response.choices[0].message.tool_calls)
```

### Responses API

LiteLLM translates `litellm.responses` calls for `saygm/` into SayGM chat completions and converts the result back into a Responses API object, so this works for every model on the route.

```python showLineNumbers title="SayGM Responses API"
import os
import litellm

os.environ["SAYGM_API_KEY"] = ""  # your SayGM API key

response = litellm.responses(
    model="saygm/deepseek-v4.1-flash",
    input="Say hello",
)

print(response.output_text)
```

## Usage - LiteLLM Proxy Server

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: deepseek-v4.1-flash
    litellm_params:
      model: saygm/deepseek-v4.1-flash
      api_key: os.environ/SAYGM_API_KEY
  - model_name: glm-5.3
    litellm_params:
      model: saygm/glm-5.3
      api_key: os.environ/SAYGM_API_KEY

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

Start the proxy:

```bash showLineNumbers title="Start LiteLLM Proxy"
export SAYGM_API_KEY="your-saygm-key"
export LITELLM_MASTER_KEY="sk-1234"
litellm --config config.yaml --port 4000

# RUNNING on http://0.0.0.0:4000
```

A deployment configured this way serves `/v1/chat/completions`, `/v1/responses`, and `/v1/messages` on the proxy.

<Tabs>
<TabItem value="chat" label="Chat Completions">

```bash showLineNumbers title="curl"
curl http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-v4.1-flash",
    "messages": [{"role": "user", "content": "Hello, how are you?"}]
  }'
```

</TabItem>
<TabItem value="openai-sdk" label="OpenAI SDK">

```python showLineNumbers title="SayGM via Proxy - OpenAI SDK"
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:4000",
    api_key="sk-1234",
)

response = client.chat.completions.create(
    model="deepseek-v4.1-flash",
    messages=[{"role": "user", "content": "hello from litellm"}],
)

print(response.choices[0].message.content)
```

</TabItem>
<TabItem value="responses" label="Responses">

```bash showLineNumbers title="curl"
curl http://localhost:4000/v1/responses \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "glm-5.3",
    "input": "Hello, how are you?"
  }'
```

</TabItem>
<TabItem value="messages" label="Messages">

```bash showLineNumbers title="curl"
curl http://localhost:4000/v1/messages \
  -H "x-api-key: $LITELLM_MASTER_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-v4.1-flash",
    "max_tokens": 64,
    "messages": [{"role": "user", "content": "Hello, how are you?"}]
  }'
```

</TabItem>
</Tabs>

You can also add SayGM from the Admin UI. Go to Models, then Add Model, pick SayGM as the provider, enter a `saygm/` model id, and paste your key.

## Cost Tracking

SayGM models are not yet in LiteLLM's model cost map, so spend is not computed automatically. SayGM prices are market-set and published per model in the `pricing.dimensions` object of `GET https://api.saygm.com/v1/models`, in nano-dollars per million tokens (`input_per_mtok_ndollars`, `output_per_mtok_ndollars`). Divide by 1e15 for the per-token dollar value and pass it as `input_cost_per_token` / `output_cost_per_token` on the deployment:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: glm-5.3
    litellm_params:
      model: saygm/glm-5.3
      api_key: os.environ/SAYGM_API_KEY
      input_cost_per_token: 0.000000784   # check /v1/models for the current rate
      output_cost_per_token: 0.000002464
```

SayGM also returns the charged amount per request in `usage.cost` (US dollars).

## Custom API Base

**Option 1: Environment variable**

```python showLineNumbers title="Custom API Base via env var"
import os
from litellm import completion

os.environ["SAYGM_API_BASE"] = "https://custom.saygm.example/v1"
os.environ["SAYGM_API_KEY"] = ""  # your API key

response = completion(
    model="saygm/deepseek-v4.1-flash",
    messages=[{"role": "user", "content": "Hello!"}],
)
```

**Option 2: Pass directly**

```python showLineNumbers title="Custom API Base via parameter"
from litellm import completion

response = completion(
    model="saygm/deepseek-v4.1-flash",
    messages=[{"role": "user", "content": "Hello!"}],
    api_base="https://custom.saygm.example/v1",
    api_key="your-api-key",
)
```

Passing `api_base="https://api.saygm.com/v1"` without the `saygm/` prefix also resolves to the SayGM provider, so `model="deepseek-v4.1-flash"` with that base URL is routed as `saygm` and picks up `SAYGM_API_KEY`.
