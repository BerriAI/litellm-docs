import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Tencent TokenHub
https://www.tencentcloud.com/products/tokenhub

**We support ALL Tencent TokenHub models, just set `tencent/` as a prefix when sending completion requests**

TokenHub is Tencent Cloud's unified LLM gateway. It provides an OpenAI-compatible Chat Completions endpoint and an Anthropic-compatible Messages endpoint, giving you access to DeepSeek, GLM, Kimi, MiniMax, and Hunyuan models through a single API key.

## API Key
```python
# env variable
os.environ['TENCENT_API_KEY']
```

## Sample Usage
```python
from litellm import completion
import os

os.environ['TENCENT_API_KEY'] = ""
response = completion(
    model="tencent/deepseek-v4-pro",
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

os.environ['TENCENT_API_KEY'] = ""
response = completion(
    model="tencent/deepseek-v4-pro",
    messages=[
       {"role": "user", "content": "hello from litellm"}
   ],
    stream=True
)

for chunk in response:
    print(chunk)
```

## Supported Models
We support ALL models available on the TokenHub international endpoint.

| Model Name | Function Call |
|---|---|
| deepseek-v4-flash-202605 | `completion(model="tencent/deepseek-v4-flash-202605", messages)` |
| deepseek-v4-pro-202606 | `completion(model="tencent/deepseek-v4-pro-202606", messages)` |
| deepseek-v4-flash | `completion(model="tencent/deepseek-v4-flash", messages)` |
| deepseek-v4-pro | `completion(model="tencent/deepseek-v4-pro", messages)` |
| deepseek-v3.2 | `completion(model="tencent/deepseek-v3.2", messages)` |
| glm-5.1 | `completion(model="tencent/glm-5.1", messages)` |
| glm-5v-turbo | `completion(model="tencent/glm-5v-turbo", messages)` |
| glm-5-turbo | `completion(model="tencent/glm-5-turbo", messages)` |
| glm-5 | `completion(model="tencent/glm-5", messages)` |
| kimi-k2.6 | `completion(model="tencent/kimi-k2.6", messages)` |
| kimi-k2.5 | `completion(model="tencent/kimi-k2.5", messages)` |
| minimax-m3 | `completion(model="tencent/minimax-m3", messages)` |
| minimax-m2.7 | `completion(model="tencent/minimax-m2.7", messages)` |
| minimax-m2.5 | `completion(model="tencent/minimax-m2.5", messages)` |
| hy-mt2-plus | `completion(model="tencent/hy-mt2-plus", messages)` |

## Custom API Base

By default, LiteLLM uses the Singapore region endpoint. You can override it with `TENCENT_API_BASE`.

```python
import os

os.environ['TENCENT_API_BASE'] = "https://tokenhub.tencentcloudmaas.com/v1"  # Guangzhou region
```

## Thinking / Reasoning Mode

Many TokenHub models support extended thinking. LiteLLM supports both the `thinking` and `reasoning_effort` params.

<Tabs>
<TabItem value="thinking" label="thinking param">

```python
from litellm import completion
import os

os.environ['TENCENT_API_KEY'] = ""

resp = completion(
    model="tencent/deepseek-v4-pro",
    messages=[{"role": "user", "content": "What is 2+2?"}],
    thinking={"type": "enabled"},
)

print(resp.choices[0].message.reasoning_content)
print(resp.choices[0].message.content)
```

</TabItem>
<TabItem value="reasoning_effort" label="reasoning_effort param">

```python
from litellm import completion
import os

os.environ['TENCENT_API_KEY'] = ""

resp = completion(
    model="tencent/deepseek-v4-pro",
    messages=[{"role": "user", "content": "What is 2+2?"}],
    reasoning_effort="medium",
)

print(resp.choices[0].message.reasoning_content)
print(resp.choices[0].message.content)
```

</TabItem>
</Tabs>

:::note
When `reasoning_effort` is anything other than `"none"`, LiteLLM automatically maps it to `thinking={"type": "enabled"}`.
:::

### Basic Usage

<Tabs>
<TabItem value="sdk" label="SDK">

```python
from litellm import completion
import os

os.environ['TENCENT_API_KEY'] = ""
resp = completion(
    model="tencent/deepseek-v4-pro",
    messages=[{"role": "user", "content": "Tell me a joke."}],
)

print(
    resp.choices[0].message.reasoning_content
)
```

</TabItem>
<TabItem value="proxy" label="PROXY">

1. Setup config.yaml

```yaml
model_list:
  - model_name: deepseek-v4-pro
    litellm_params:
        model: tencent/deepseek-v4-pro
        api_key: os.environ/TENCENT_API_KEY
```

2. Run proxy

```bash
python litellm/proxy/main.py
```

3. Test it!

```bash
curl -L -X POST 'http://0.0.0.0:4000/v1/chat/completions' \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer sk-1234' \
-d '{
    "model": "deepseek-v4-pro",
    "messages": [
      {
        "role": "user",
        "content": "hello from litellm proxy"
      }
    ]
}'
```

</TabItem>

</Tabs>

## Anthropic-compatible Messages API

TokenHub also exposes an Anthropic-compatible Messages API. LiteLLM routes requests through this endpoint when available.

```python
os.environ['TENCENT_API_KEY'] = ""
```

To override the Anthropic-compatible base URL separately from the Chat Completions endpoint:

```python
os.environ['TENCENT_ANTHROPIC_API_BASE'] = "https://tokenhub-intl.tencentcloudmaas.com"
```

When both `TENCENT_ANTHROPIC_API_BASE` and `TENCENT_API_BASE` are set, the Anthropic-specific one takes precedence for Messages API calls.
