# GPUStack

| Property | Details |
| --- | --- |
| Description | GPUStack is an open-source platform for deploying and managing AI models. |
| Provider Route on LiteLLM | `gpustack/` |
| Supported Operations | `/embeddings`, `/rerank` |
| Link to Provider Docs | [GPUStack documentation ↗](https://docs.gpustack.ai/) |

LiteLLM supports GPUStack embedding and rerank models through GPUStack's OpenAI-compatible embedding API and rerank API.

## API Base and Key

Set the GPUStack API base and API key:

```python
import os

os.environ["GPUSTACK_API_BASE"] = "http://localhost:80/v1"
os.environ["GPUSTACK_API_KEY"] = "your-gpustack-api-key"
```

`GPUSTACK_API_BASE` can be either the server root, such as `http://localhost:80`, or its `/v1` base. LiteLLM appends the correct operation endpoint without duplicating `/v1`.

You can also pass `api_base` and `api_key` directly to each LiteLLM call.

## Embeddings

```python showLineNumbers
from litellm import embedding

response = embedding(
    model="gpustack/your-embedding-model",
    input=["GPUStack serves embedding models."],
)

print(response.data[0]["embedding"])
```

Explicit configuration:

```python showLineNumbers
from litellm import embedding

response = embedding(
    model="gpustack/your-embedding-model",
    input=["GPUStack serves embedding models."],
    api_base="http://localhost:80/v1",
    api_key="your-gpustack-api-key",
)
```

Supported embedding parameters include `dimensions`, `encoding_format`, and `user`.

## Rerank

```python showLineNumbers
from litellm import rerank

response = rerank(
    model="gpustack/your-reranker-model",
    query="What is GPUStack?",
    documents=[
        "GPUStack deploys and manages AI models.",
        "Paris is the capital of France.",
    ],
    top_n=1,
    return_documents=True,
)

print(response.results)
```

Supported rerank parameters include `top_n` and `return_documents`.

## LiteLLM Proxy

```yaml showLineNumbers
model_list:
  - model_name: gpustack-embedding
    litellm_params:
      model: gpustack/your-embedding-model
      api_base: os.environ/GPUSTACK_API_BASE
      api_key: os.environ/GPUSTACK_API_KEY
    model_info:
      mode: embedding

  - model_name: gpustack-reranker
    litellm_params:
      model: gpustack/your-reranker-model
      api_base: os.environ/GPUSTACK_API_BASE
      api_key: os.environ/GPUSTACK_API_KEY
    model_info:
      mode: rerank
```

Start the proxy:

```bash
litellm --config /path/to/config.yaml
```

Call the embedding endpoint:

```bash
curl http://localhost:4000/v1/embeddings \
  -H "Authorization: Bearer <LITELLM_MASTER_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpustack-embedding",
    "input": ["GPUStack serves embedding models."]
  }'
```

Call the rerank endpoint:

```bash
curl http://localhost:4000/rerank \
  -H "Authorization: Bearer <LITELLM_MASTER_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpustack-reranker",
    "query": "What is GPUStack?",
    "documents": [
      "GPUStack deploys and manages AI models.",
      "Paris is the capital of France."
    ],
    "top_n": 1,
    "return_documents": true
  }'
```
