import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Runware

https://runware.ai

**We support all Runware text / LLM models — just set `model=runware/<model-id>` when sending LiteLLM requests.**

| Property | Details |
|-------|-------|
| Description | Runware is an OpenAI-compatible inference platform serving open-weight and frontier LLMs for chat, coding, and agentic workloads. |
| Provider Route on LiteLLM | `runware/` |
| Supported Endpoints | `/chat/completions` |
| API Reference | [Runware OpenAI compatibility](https://runware.ai/docs/platform/openai) |
| Base URL | `https://api.runware.ai/v1` |

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["RUNWARE_API_KEY"] = ""  # your Runware API key
```

Get your Runware API key from the [Runware dashboard](https://runware.ai/dashboard).

## Model IDs

Runware accepts two interchangeable id formats for the same model:

- the **bare model id** — e.g. `minimax-m2-7`, `deepseek-v4-pro`, `alibaba-qwen3-5-397b`

Prefix either form with `runware/` (e.g. `runware/minimax-m2-7`). LiteLLM forwards the id to Runware verbatim. Browse the full, current catalogue — with pricing and context windows — in the [Runware models catalogue](https://runware.ai/docs/models).

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="Runware Non-streaming Completion"
from litellm import completion
import os

os.environ["RUNWARE_API_KEY"] = ""  # your Runware API key
response = completion(
    model="runware/minimax-m2-7",
    messages=[{"role": "user", "content": "What is LiteLLM?"}]
)
print(response)
```

### Streaming

```python showLineNumbers title="Runware Streaming Completion"
from litellm import completion
import os

os.environ["RUNWARE_API_KEY"] = ""  # your Runware API key
stream = completion(
    model="runware/minimax-m2-7",
    messages=[{"role": "user", "content": "What is LiteLLM?"}],
    stream=True
)

for chunk in stream:
    if chunk.choices[0].delta.content is not None:
        print(chunk.choices[0].delta.content, end="")
```

:::info
Reasoning models (such as MiniMax M2.7) emit their internal reasoning on a separate channel. LiteLLM surfaces it as `chunk.choices[0].delta.reasoning_content`, which arrives before the regular `delta.content`.
:::

### Tool Calling

:::warning
LiteLLM only forwards `tools` / `tool_choice` for models it knows support function calling. Runware models are not yet present in LiteLLM's model cost map, so **by default the `tools` parameter is dropped before the request is sent**. Register the model first (see the snippet below) so LiteLLM keeps the tool params. Runware's endpoint itself does support function calling for tool-capable models such as `minimax-m2-7`.
:::

```python showLineNumbers title="Runware Tool Calling"
from litellm import completion
import litellm
import os

os.environ["RUNWARE_API_KEY"] = ""  # your Runware API key

# Register the model so LiteLLM keeps tool params (and can track cost).
litellm.register_model({
    "runware/minimax-m2-7": {
        "max_tokens": 196608,
        "input_cost_per_token": 0.0000003,
        "output_cost_per_token": 0.0000012,
        "litellm_provider": "runware",
        "mode": "chat",
        "supports_function_calling": True,
    }
})

tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get current weather",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {"type": "string"}
                }
            }
        }
    }
]

response = completion(
    model="runware/minimax-m2-7",
    messages=[{"role": "user", "content": "What's the weather in Paris?"}],
    tools=tools
)
print(response)
```

## Usage - LiteLLM Proxy

Add the following to your LiteLLM Proxy configuration file. Use `model_info` to flag function-calling support for tool-capable models:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: runware/minimax-m2-7
    litellm_params:
      model: runware/minimax-m2-7
      api_key: os.environ/RUNWARE_API_KEY
    model_info:
      supports_function_calling: true
  - model_name: runware/deepseek-v4-pro
    litellm_params:
      model: runware/deepseek-v4-pro
      api_key: os.environ/RUNWARE_API_KEY
```

Start your LiteLLM Proxy server:

```bash showLineNumbers title="Start LiteLLM Proxy"
litellm --config config.yaml

# RUNNING on http://0.0.0.0:4000
```

<Tabs>
<TabItem value="openai-sdk" label="OpenAI SDK">

```python showLineNumbers title="Runware via Proxy - Non-streaming"
from openai import OpenAI

# Initialize client with your proxy URL
client = OpenAI(
    base_url="http://localhost:4000",  # Your proxy URL
    api_key="your-proxy-api-key"       # Your proxy API key
)

response = client.chat.completions.create(
    model="runware/minimax-m2-7",
    messages=[{"role": "user", "content": "What is LiteLLM?"}]
)

print(response.choices[0].message.content)
```

</TabItem>

<TabItem value="litellm-sdk" label="LiteLLM SDK">

```python showLineNumbers title="Runware via Proxy - LiteLLM SDK"
import litellm

response = litellm.completion(
    model="litellm_proxy/runware/minimax-m2-7",
    messages=[{"role": "user", "content": "What is LiteLLM?"}],
    api_base="http://localhost:4000",
    api_key="your-proxy-api-key"
)

print(response.choices[0].message.content)
```

</TabItem>

<TabItem value="curl" label="cURL">

```bash showLineNumbers title="Runware via Proxy - cURL"
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-proxy-api-key" \
  -d '{
    "model": "runware/minimax-m2-7",
    "messages": [{"role": "user", "content": "What is LiteLLM?"}]
  }'
```

</TabItem>
</Tabs>

## Additional Resources

- [Runware Website](https://runware.ai)
- [Runware OpenAI Compatibility Docs](https://runware.ai/docs/platform/openai)
- [Runware Models Catalogue](https://runware.ai/docs/models)
