import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Auxen
https://auxen.ai/

Auxen hosts per-customer **dedicated** LLM endpoints. Each instance you provision runs on its own GPU and exposes an OpenAI-compatible `/v1/chat/completions` surface, so any client that speaks the OpenAI wire format (including LiteLLM) can call it.

**LiteLLM supports every Auxen model — just set `auxen/` as a prefix when sending completion requests.**

## API Key & API Base

Auxen issues a **per-instance** API key (prefixed `auxk_*`) and a per-instance base URL of the form `https://api.auxen.ai/v1/<instance_id>/v1`. Both come from the Auxen dashboard after you provision an instance.

```python
# env variables
os.environ['AUXEN_API_KEY']   # auxk_* — per-instance bearer token
os.environ['AUXEN_API_BASE']  # https://api.auxen.ai/v1/inst_xxx/v1
```

You can also pass `api_key=` and `api_base=` directly to `completion()` — they override the env vars.

## Sample Usage

```python
from litellm import completion
import os

os.environ['AUXEN_API_KEY']  = "auxk_..."
os.environ['AUXEN_API_BASE'] = "https://api.auxen.ai/v1/inst_xxx/v1"

response = completion(
    model="auxen/llama-3.1-8b",
    messages=[
        {"role": "user", "content": "hello from litellm"}
    ],
)
print(response)
```

## Sample Usage - Streaming

```python
from litellm import completion
import os

os.environ['AUXEN_API_KEY']  = "auxk_..."
os.environ['AUXEN_API_BASE'] = "https://api.auxen.ai/v1/inst_xxx/v1"

response = completion(
    model="auxen/llama-3.1-8b",
    messages=[
        {"role": "user", "content": "hello from litellm"}
    ],
    stream=True,
)

for chunk in response:
    print(chunk)
```

## Sample Usage - Tool / Function Calling

Tool-capable Auxen models (Llama 3.1/3.2, Qwen 2.5, Mistral Nemo, Mixtral, Command R) accept the OpenAI tools schema directly.

```python
from litellm import completion

response = completion(
    model="auxen/llama-3.1-8b",
    messages=[{"role": "user", "content": "What's the weather in Toronto?"}],
    tools=[{
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
    }],
)
print(response.choices[0].message.tool_calls)
```

## Pricing Model

**Auxen bills per-minute of dedicated GPU runtime, not per token.** This is unusual relative to most LiteLLM providers — per-token cost in LiteLLM's cost map is `0` for Auxen models because the marginal cost of an additional token is genuinely zero (the customer pays for the instance regardless of throughput). See [Auxen's pricing page](https://auxen.ai/pricing) for hourly rates by model size.

## Supported Models — ALL Auxen Models Supported

LiteLLM supports every model in the Auxen catalog. Set `auxen/` as a prefix.

| Model Name | Function Call |
|---|---|
| llama-3.1-8b | `completion(model="auxen/llama-3.1-8b", messages)` |
| llama-3.1-70b | `completion(model="auxen/llama-3.1-70b", messages)` |
| llama-3.2-3b | `completion(model="auxen/llama-3.2-3b", messages)` |
| qwen2.5-7b | `completion(model="auxen/qwen2.5-7b", messages)` |
| qwen2.5-14b | `completion(model="auxen/qwen2.5-14b", messages)` |
| qwen2.5-32b | `completion(model="auxen/qwen2.5-32b", messages)` |
| mistral-7b | `completion(model="auxen/mistral-7b", messages)` |
| mistral-nemo-12b | `completion(model="auxen/mistral-nemo-12b", messages)` |
| mixtral-8x7b | `completion(model="auxen/mixtral-8x7b", messages)` |
| gemma2-9b | `completion(model="auxen/gemma2-9b", messages)` |
| phi-3-mini | `completion(model="auxen/phi-3-mini", messages)` |
| command-r-7b | `completion(model="auxen/command-r-7b", messages)` |

## Proxy Configuration

<Tabs>
<TabItem value="sdk" label="SDK">

```python
from litellm import completion

response = completion(
    model="auxen/llama-3.1-8b",
    messages=[{"role": "user", "content": "hi"}],
    api_base="https://api.auxen.ai/v1/inst_xxx/v1",
    api_key="auxk_...",
)
```

</TabItem>
<TabItem value="proxy" label="PROXY">

1. Setup `config.yaml`:

```yaml
model_list:
  - model_name: llama-3.1-8b
    litellm_params:
        model: auxen/llama-3.1-8b
        api_base: os.environ/AUXEN_API_BASE
        api_key: os.environ/AUXEN_API_KEY
```

2. Run the proxy:

```bash
python litellm/proxy/main.py
```

3. Test it:

```bash
curl -L -X POST 'http://0.0.0.0:4000/v1/chat/completions' \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer sk-1234' \
-d '{
    "model": "llama-3.1-8b",
    "messages": [{"role": "user", "content": "hi"}]
}'
```

</TabItem>
</Tabs>
