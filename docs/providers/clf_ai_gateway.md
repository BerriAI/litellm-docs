# CLF AI Gateway
https://clfaigateway.dev

:::tip

**We support ALL CLF AI Gateway models, just set `model=clf_ai_gateway/<model-id>` as a prefix when sending litellm requests. For the current model list and live pricing, see https://clfaigateway.dev/models or `GET https://api.clfaigateway.dev/v1/public/models` (public, no key required).**

:::

CLF AI Gateway is an OpenAI-compatible gateway serving open-weight models (GLM, Kimi, DeepSeek, Qwen) on Cloudflare Workers AI upstream, on prepaid credits. It supports streaming, tool calling, structured output and `reasoning_effort`.

## API Key
```python
# env variable
os.environ['CLF_AI_GATEWAY_API_KEY']
```

Optional — override the base URL (defaults to `https://api.clfaigateway.dev/v1`):
```python
os.environ['CLF_AI_GATEWAY_API_BASE']
```

## Sample Usage
```python
from litellm import completion
import os

os.environ['CLF_AI_GATEWAY_API_KEY'] = ""
response = completion(
    model="clf_ai_gateway/glm-5.3",
    messages=[{"role": "user", "content": "write code for saying hi from LiteLLM"}]
)
```

## Sample Usage - Streaming
```python
from litellm import completion
import os

os.environ['CLF_AI_GATEWAY_API_KEY'] = ""
response = completion(
    model="clf_ai_gateway/glm-5.3",
    messages=[{"role": "user", "content": "write code for saying hi from LiteLLM"}],
    stream=True
)

for chunk in response:
    print(chunk)
```

## Sample Usage - Reasoning effort
The accepted `reasoning_effort` values differ per model (e.g. `glm-5.3` accepts `low`/`medium`/`high`/`max`, DeepSeek V4 accepts `low`/`medium`/`high`/`xhigh`). Sending a value the model does not accept returns a 400 that lists the valid set.
```python
from litellm import completion
import os

os.environ['CLF_AI_GATEWAY_API_KEY'] = ""
response = completion(
    model="clf_ai_gateway/glm-5.3",
    messages=[{"role": "user", "content": "Prove there are infinitely many primes."}],
    reasoning_effort="low"
)
```

## Usage with LiteLLM Proxy

1. Set CLF AI Gateway models on config.yaml

```yaml
model_list:
  - model_name: glm-5.3
    litellm_params:
      model: clf_ai_gateway/glm-5.3
      api_key: os.environ/CLF_AI_GATEWAY_API_KEY
```

2. Start Proxy

```
litellm --config config.yaml
```

3. Test it

```bash
curl --location 'http://0.0.0.0:4000/chat/completions' \
--header 'Content-Type: application/json' \
--data '{
    "model": "glm-5.3",
    "messages": [
      {"role": "user", "content": "what llm are you"}
    ]
}'
```

## Chat Models
| Model Name        | Context   | Image input | Function Call                                                        |
|-------------------|-----------|-------------|----------------------------------------------------------------------|
| glm-5.3           | 1,048,576 |             | `completion(model="clf_ai_gateway/glm-5.3", messages)`               |
| glm-5.3-flash     | 1,048,576 | ✅          | `completion(model="clf_ai_gateway/glm-5.3-flash", messages)`         |
| glm-5.2           | 262,144   |             | `completion(model="clf_ai_gateway/glm-5.2", messages)`               |
| glm-4.7-flash     | 131,072   |             | `completion(model="clf_ai_gateway/glm-4.7-flash", messages)`         |
| deepseek-v4-pro   | 1,048,576 |             | `completion(model="clf_ai_gateway/deepseek-v4-pro", messages)`       |
| deepseek-v4-flash | 1,048,576 |             | `completion(model="clf_ai_gateway/deepseek-v4-flash", messages)`     |
| kimi-k2.6         | 262,144   | ✅          | `completion(model="clf_ai_gateway/kimi-k2.6", messages)`             |
| kimi-k2.7-code    | 262,144   | ✅          | `completion(model="clf_ai_gateway/kimi-k2.7-code", messages)`        |
| qwen3.8-27b       | 262,144   | ✅          | `completion(model="clf_ai_gateway/qwen3.8-27b", messages)`           |

All models support tool calling and `reasoning_effort`; max output is 131,072 tokens per request. Prices and capabilities are kept in sync with `GET https://api.clfaigateway.dev/v1/public/models`.
