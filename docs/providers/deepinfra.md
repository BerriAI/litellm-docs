import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# DeepInfra
https://deepinfra.com/

:::tip

**We support ALL DeepInfra models, just set `model=deepinfra/<any-model-on-deepinfra>` as a prefix when sending litellm requests**

:::

## Table of Contents

- [API Key](#api-key)
- [Chat Models](#chat-models)
- [Rerank Endpoint](#rerank-endpoint)

## API Key
```python
# env variable
os.environ['DEEPINFRA_API_KEY']
```

## Sample Usage
```python
from litellm import completion
import os

os.environ['DEEPINFRA_API_KEY'] = ""
response = completion(
    model="deepinfra/moonshotai/Kimi-K3",
    messages=[{"role": "user", "content": "write code for saying hi from LiteLLM"}]
)
```

## Sample Usage - Streaming
```python
from litellm import completion
import os

os.environ['DEEPINFRA_API_KEY'] = ""
response = completion(
    model="deepinfra/moonshotai/Kimi-K3",
    messages=[{"role": "user", "content": "write code for saying hi from LiteLLM"}],
    stream=True
)

for chunk in response:
    print(chunk)
```

## Chat Models

Use `deepinfra/<model-id>` with a model from the [DeepInfra catalog](https://deepinfra.com/models). These are representative chat models:

| Model | LiteLLM model ID |
|-------|------------------|
| GLM-5.3 | `deepinfra/zai-org/GLM-5.3` |
| Kimi K3 | `deepinfra/moonshotai/Kimi-K3` |
| GPT OSS 120B | `deepinfra/openai/gpt-oss-120b` |

## Rerank Endpoint

LiteLLM provides a Cohere API compatible `/rerank` endpoint for DeepInfra rerank models.

### Supported Rerank Models

| Model Name | Description |
|------------|-------------|
| `deepinfra/Qwen/Qwen3-Reranker-0.6B` | Lightweight rerank model (0.6B parameters) |
| `deepinfra/Qwen/Qwen3-Reranker-4B` | Medium rerank model (4B parameters) |
| `deepinfra/Qwen/Qwen3-Reranker-8B` | Large rerank model (8B parameters) |

### Usage - LiteLLM Python SDK

<Tabs>
<TabItem value="sdk" label="SDK">

```python
from litellm import rerank
import os

os.environ["DEEPINFRA_API_KEY"] = "your-api-key"

response = rerank(
    model="deepinfra/Qwen/Qwen3-Reranker-0.6B",
    query="What is the capital of France?",
    documents=[
        "Paris is the capital of France.",
        "London is the capital of the United Kingdom.",
        "Berlin is the capital of Germany.",
        "Madrid is the capital of Spain.",
        "Rome is the capital of Italy."
    ]
)
print(response)
```

</TabItem>
<TabItem value="proxy" label="PROXY">

1. Add to config.yaml
```yaml
model_list:
  - model_name: Qwen/Qwen3-Reranker-0.6B
    litellm_params:
      model: deepinfra/Qwen/Qwen3-Reranker-0.6B
      api_key: os.environ/DEEPINFRA_API_KEY
```

2. Start proxy 

```bash
litellm --config /path/to/config.yaml

# RUNNING on http://0.0.0.0:4000/
```

3. Test it! 

```bash 
curl -L -X POST 'http://0.0.0.0:4000/rerank' \
-H 'Authorization: Bearer sk-1234' \
-H 'Content-Type: application/json' \
-d '{
    "model": "Qwen/Qwen3-Reranker-0.6B",
    "query": "What is the capital of France?",
    "documents": [
        "Paris is the capital of France.",
        "London is the capital of the United Kingdom.",
        "Berlin is the capital of Germany.",
        "Madrid is the capital of Spain.",
        "Rome is the capital of Italy."
    ]
}'
```

</TabItem>
</Tabs>

### Supported Cohere Rerank API Params

| Param              | Type        | Description                                     |
| ------------------ | ----------- | ----------------------------------------------- |
| `query`            | `str`       | The query to rerank the documents against       |
| `documents`        | `list[str]` | The documents to rerank                         |


### Provider-specific parameters
Pass any deepinfra specific parameters as a keyword argument to the rerank function, e.g.

```
response = rerank(
    model="deepinfra/Qwen/Qwen3-Reranker-0.6B",
    query="What is the capital of France?",
    documents=[
        "Paris is the capital of France.",
        "London is the capital of the United Kingdom.",
        "Berlin is the capital of Germany.",
        "Madrid is the capital of Spain.",
        "Rome is the capital of Italy."
    ],
    my_custom_param="my_custom_value", # any other deepinfra specific parameters
)
```

### Response Format

```json
{
  "id": "request-id",
  "results": [
    {
      "index": 0,
      "relevance_score": 0.9975274205207825
    },
    {
      "index": 1,
      "relevance_score": 0.011687257327139378
    }
  ],
  "meta": {
    "billed_units": {
      "total_tokens": 427
    },
    "tokens": {
      "input_tokens": 427,
      "output_tokens": 0
    }
  }
}
```
