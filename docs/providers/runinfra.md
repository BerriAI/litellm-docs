import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# RunInfra

LiteLLM supports all chat models available through the RunInfra API.

| Property | Details |
|-------|-------|
| Description | RunInfra provides hosted, OpenAI-compatible inference APIs for open-weights models. |
| Provider Route on LiteLLM | `runinfra/` |
| Provider Doc | [RunInfra docs](https://runinfra.ai/docs) |
| API Endpoint for Provider | https://api.runinfra.ai/v1 |
| Supported OpenAI Endpoints | `/chat/completions` |

## API Key

Create an API key from the dashboard at [runinfra.ai](https://runinfra.ai), then set it in your environment.

```python
import os

os.environ["RUNINFRA_API_KEY"] = "your-api-key"
```

## Usage

```python
from litellm import completion
import os

os.environ["RUNINFRA_API_KEY"] = "your-api-key"

response = completion(
    model="runinfra/deepseek-ai/DeepSeek-V4-Flash-0731",
    messages=[{"role": "user", "content": "What is LiteLLM?"}],
)
print(response)
```

## Streaming

Streaming is supported on all models.

```python
from litellm import completion
import os

os.environ["RUNINFRA_API_KEY"] = "your-api-key"

stream = completion(
    model="runinfra/deepseek-ai/DeepSeek-V4-Flash-0731",
    messages=[{"role": "user", "content": "What is LiteLLM?"}],
    stream=True,
)
for chunk in stream:
    if chunk.choices[0].delta.content is not None:
        print(chunk.choices[0].delta.content, end="")
```

## Usage with LiteLLM Proxy

1. Add the model to your `config.yaml`.

```yaml
model_list:
  - model_name: deepseek-v4-flash
    litellm_params:
      model: runinfra/deepseek-ai/DeepSeek-V4-Flash-0731
      api_key: os.environ/RUNINFRA_API_KEY
```

2. Start the proxy.

```bash
litellm --config /path/to/config.yaml
```

3. Send a request.

<Tabs>
<TabItem value="curl" label="Curl">

```bash
curl http://0.0.0.0:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-1234" \
  -d '{
    "model": "deepseek-v4-flash",
    "messages": [{"role": "user", "content": "What is LiteLLM?"}]
  }'
```

</TabItem>
<TabItem value="openai" label="OpenAI SDK">

```python
from openai import OpenAI

client = OpenAI(base_url="http://0.0.0.0:4000", api_key="sk-1234")

response = client.chat.completions.create(
    model="deepseek-v4-flash",
    messages=[{"role": "user", "content": "What is LiteLLM?"}],
)
print(response.choices[0].message.content)
```

</TabItem>
</Tabs>

## Supported Models

| Model | LiteLLM model name | Context window | Max output tokens |
|-------|-------|-------|-------|
| DeepSeek V4 Flash | `runinfra/deepseek-ai/DeepSeek-V4-Flash-0731` | 1,048,576 | 32,768 |
| DeepSeek V4 Pro | `runinfra/deepseek-ai/DeepSeek-V4-Pro-0813` | 1,048,576 | 32,768 |
| NVIDIA Nemotron 3.5 Lightning 30B | `runinfra/nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-BF16` | 262,144 | 32,768 |
| Ornith 1.5 35B | `runinfra/ornith-ai/Ornith-1.5-35B-A3B` | 262,144 | 32,768 |
| Qwen3.8 2.4T A95B | `runinfra/Inferact/Qwen3.8-2.4T-A95B-NVFP4` | 262,144 | 32,768 |
| Qwen3.8 27B | `runinfra/Qwen/Qwen3.8-27B` | 262,144 | 32,768 |

All models support tool calling and streaming. Qwen3.8 27B and Ornith 1.5 35B also accept image input. Current per-model pricing is listed on the [RunInfra model pages](https://runinfra.ai/docs).
