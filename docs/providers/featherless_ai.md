# Featherless AI
https://featherless.ai/

:::tip

**We support ALL Featherless AI models, just set `model=featherless_ai/<any-model-on-featherless>` as a prefix when sending litellm requests. For the complete supported model list, visit https://featherless.ai/models **

:::

| Property | Details |
|-------|-------|
| Description | Featherless is a serverless AI inference platform that makes tens of thousands of open-source AI models instantly available through a single API. |
| Provider Route on LiteLLM | `featherless_ai/` |
| Provider Doc | [Featherless AI ↗](https://featherless.ai/docs/overview) |
| API Endpoint for Provider | https://api.featherless.ai/v1 |
| Supported OpenAI Endpoints | `/chat/completions` |

## API Key
```python
# env variable
os.environ['FEATHERLESS_AI_API_KEY']
```

## Sample Usage
```python
from litellm import completion
import os

os.environ['FEATHERLESS_AI_API_KEY'] = ""
response = completion(
    model="featherless_ai/Qwen/Qwen3.8-27B",
    messages=[{"role": "user", "content": "write code for saying hi from LiteLLM"}]
)
```

## Sample Usage - Streaming
```python
from litellm import completion
import os

os.environ['FEATHERLESS_AI_API_KEY'] = ""
response = completion(
    model="featherless_ai/Qwen/Qwen3.8-27B",
    messages=[{"role": "user", "content": "write code for saying hi from LiteLLM"}],
    stream=True
)

for chunk in response:
    print(chunk)
```

## Usage with LiteLLM Proxy

Add the model to your `config.yaml`, set your keys and start the proxy.

```yaml
model_list:
  - model_name: qwen3.8-27b
    litellm_params:
      model: featherless_ai/Qwen/Qwen3.8-27B
      api_key: os.environ/FEATHERLESS_AI_API_KEY
```

```bash
export FEATHERLESS_AI_API_KEY="your-featherless-key"
export LITELLM_MASTER_KEY="sk-1234"
litellm --config config.yaml
```

```bash
curl http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "qwen3.8-27b", "messages": [{"role": "user", "content": "hello from litellm"}]}'
```

## Chat Models

These are some of the popular models on Featherless. Any other chat model on [featherless.ai/models](https://featherless.ai/models) works the same way with the `featherless_ai/` prefix.

| Model Name                                 | Function Call                                                                                  |
|---------------------------------------------|-----------------------------------------------------------------------------------------------|
| moonshotai/Kimi-K3.1-Pro                    | `completion(model="featherless_ai/moonshotai/Kimi-K3.1-Pro", messages=messages)` |
| deepseek-ai/DeepSeek-V4.1-Flash             | `completion(model="featherless_ai/deepseek-ai/DeepSeek-V4.1-Flash", messages=messages)` |
| zai-org/GLM-5.3                             | `completion(model="featherless_ai/zai-org/GLM-5.3", messages=messages)` |
| MiniMaxAI/MiniMax-M3.1-Flash                | `completion(model="featherless_ai/MiniMaxAI/MiniMax-M3.1-Flash", messages=messages)` |
| Qwen/Qwen3.8-27B                            | `completion(model="featherless_ai/Qwen/Qwen3.8-27B", messages=messages)` |
| Qwen/Qwen3-Coder-30B-A3B-Instruct           | `completion(model="featherless_ai/Qwen/Qwen3-Coder-30B-A3B-Instruct", messages=messages)` |
| stepfun-ai/Step-5-Preview                   | `completion(model="featherless_ai/stepfun-ai/Step-5-Preview", messages=messages)` |
| google/gemma-4-31B-it                       | `completion(model="featherless_ai/google/gemma-4-31B-it", messages=messages)` |
| openai/gpt-oss-120b                         | `completion(model="featherless_ai/openai/gpt-oss-120b", messages=messages)` |
| NousResearch/Hermes-4-70B                   | `completion(model="featherless_ai/NousResearch/Hermes-4-70B", messages=messages)` |
