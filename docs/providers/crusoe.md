import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Crusoe

## Overview

| Property | Details |
|-------|-------|
| Description | Crusoe Cloud provides GPU-accelerated inference for open-source large language models, optimized for performance and cost efficiency. |
| Provider Route on LiteLLM | `crusoe/` |
| Link to Provider Doc | [Crusoe Serverless Inference Documentation ↗](https://docs.crusoecloud.com/serverless-inference/available-models) |
| Base URL | `https://api.inference.crusoecloud.com/v1` (older LiteLLM versions call a different host by default, see [Custom API Base](#custom-api-base)) |
| Supported Operations | [`/chat/completions`](/docs/providers/crusoe#usage---litellm-python-sdk) |

<br />
<br />

**We support ALL Crusoe models, just set `crusoe/` as a prefix when sending completion requests**

## Available Models

| Model | Provider | Context Window |
|-------|----------|----------------|
| `crusoe/deepseek-ai/Deepseek-V4-Flash` | DeepSeek | 1,048,576 tokens |
| `crusoe/deepseek-ai/DeepSeek-V4.1-Flash` | DeepSeek | 1,048,576 tokens |
| `crusoe/deepseek-ai/DeepSeek-V4-Pro` | DeepSeek | 1,048,576 tokens |
| `crusoe/google/gemma-4-31b-it` | Google | 262,144 tokens |
| `crusoe/nvidia/NVIDIA-Nemotron-3-Super-120B-A12B` | NVIDIA | 262,144 tokens |
| `crusoe/nvidia/NVIDIA-Nemotron-3.5-Super-VL` | NVIDIA | 262,144 tokens |
| `crusoe/nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B` | NVIDIA | 262,144 tokens |
| `crusoe/nvidia/Nemotron-3-Nano-Omni-Reasoning-30B-A3B` | NVIDIA | 262,144 tokens |
| `crusoe/nvidia/Nemotron-3.5-Lightning-30B-A3B` | NVIDIA | 262,144 tokens |
| `crusoe/openai/gpt-oss-120b` | OpenAI | 131,072 tokens |
| `crusoe/Qwen/Qwen3.8-27B` | Qwen | 262,144 tokens |
| `crusoe/yutori/n2` | Yutori | 262,144 tokens |
| `crusoe/zai-org/GLM-5.3` | Z.ai | 1,048,576 tokens |
| `crusoe/zai-org/GLM-5.3-Flash` | Z.ai | 1,048,576 tokens |

Crusoe retires models often. To list the model ids your key can call, send `GET https://api.inference.crusoecloud.com/v1/models` with your Crusoe API key, and put `crusoe/` in front of each `id`. Copy ids from that endpoint rather than from Crusoe's docs pages, which spell some of them differently.

LiteLLM's cost map does not have current prices for these models, so their spend logs as $0 or at an outdated price. To track spend, set `input_cost_per_token` and `output_cost_per_token` for each model you use from [Crusoe's pricing](https://www.crusoe.ai/cloud/pricing#Serverless-Inference), in the model's `litellm_params` on the proxy or as `completion()` arguments in the SDK.

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["CRUSOE_API_KEY"] = ""  # your Crusoe API key
```

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="Crusoe Non-streaming Completion"
import os
import litellm
from litellm import completion

os.environ["CRUSOE_API_KEY"] = ""  # your Crusoe API key

messages = [{"content": "Hello, how are you?", "role": "user"}]

# Crusoe call
response = completion(
    model="crusoe/deepseek-ai/Deepseek-V4-Flash",
    messages=messages
)

print(response)
```

### Streaming

```python showLineNumbers title="Crusoe Streaming Completion"
import os
import litellm
from litellm import completion

os.environ["CRUSOE_API_KEY"] = ""  # your Crusoe API key

messages = [{"content": "Write a short story about AI", "role": "user"}]

# Crusoe call with streaming
response = completion(
    model="crusoe/deepseek-ai/Deepseek-V4-Flash",
    messages=messages,
    stream=True
)

for chunk in response:
    print(chunk)
```

### Function Calling

```python showLineNumbers title="Crusoe Function Calling"
import os
import litellm
from litellm import completion

os.environ["CRUSOE_API_KEY"] = ""  # your Crusoe API key

tools = [{
    "type": "function",
    "function": {
        "name": "get_weather",
        "description": "Get the current weather in a location",
        "parameters": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "string",
                    "description": "The city and state, e.g. San Francisco, CA"
                }
            },
            "required": ["location"]
        }
    }
}]

messages = [{"role": "user", "content": "What's the weather in Boston?"}]

response = completion(
    model="crusoe/deepseek-ai/Deepseek-V4-Flash",
    messages=messages,
    tools=tools,
    tool_choice="auto"
)

print(response)
```

## Usage - LiteLLM Proxy Server

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: deepseek-v4-flash
    litellm_params:
      model: crusoe/deepseek-ai/Deepseek-V4-Flash
      api_key: os.environ/CRUSOE_API_KEY
  - model_name: deepseek-v4-pro
    litellm_params:
      model: crusoe/deepseek-ai/DeepSeek-V4-Pro
      api_key: os.environ/CRUSOE_API_KEY
  - model_name: gpt-oss-120b
    litellm_params:
      model: crusoe/openai/gpt-oss-120b
      api_key: os.environ/CRUSOE_API_KEY
  - model_name: qwen3.8-27b
    litellm_params:
      model: crusoe/Qwen/Qwen3.8-27B
      api_key: os.environ/CRUSOE_API_KEY
  - model_name: glm-5.3
    litellm_params:
      model: crusoe/zai-org/GLM-5.3
      api_key: os.environ/CRUSOE_API_KEY
```

## Custom API Base

**Option 1: Environment variable**

Older LiteLLM versions, including v1.106 and earlier, send Crusoe calls to `https://managed-inference-api-proxy.crusoecloud.com/v1` by default. That host's firewall answers some prompts with an HTTP 403 "Sorry, you have been blocked" page, for example prompts that contain file paths like `../../etc/passwd` or SQL injection strings like `' OR 1=1 --`. To see which host your version calls, send a request that succeeds and read the `x-litellm-model-api-base` response header on the proxy, or `response._hidden_params["api_base"]` in the SDK. A blocked request does not show the host. If it is the old host, set `CRUSOE_API_BASE` to `https://api.inference.crusoecloud.com/v1` as below. If your deployment restricts outbound traffic, allow the host your version calls.

```python showLineNumbers title="Custom API Base via env var"
import os
from litellm import completion

os.environ["CRUSOE_API_BASE"] = "https://api.inference.crusoecloud.com/v1"
os.environ["CRUSOE_API_KEY"] = ""  # your API key

response = completion(
    model="crusoe/deepseek-ai/Deepseek-V4-Flash",
    messages=[{"content": "Hello!", "role": "user"}],
)
```

**Option 2: Pass directly**

```python showLineNumbers title="Custom API Base via parameter"
from litellm import completion

response = completion(
    model="crusoe/deepseek-ai/Deepseek-V4-Flash",
    messages=[{"content": "Hello!", "role": "user"}],
    api_base="https://api.inference.crusoecloud.com/v1",
    api_key="your-api-key",
)
```

## Supported OpenAI Parameters

- `temperature`
- `max_tokens`
- `max_completion_tokens`
- `top_p`
- `frequency_penalty`
- `presence_penalty`
- `stop`
- `n`
- `stream`
- `tools`
- `tool_choice`
- `response_format`
- `seed`
- `user`
- `logit_bias`
- `logprobs`
- `top_logprobs`
