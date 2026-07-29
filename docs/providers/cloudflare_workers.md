# Cloudflare Workers AI

LiteLLM supports Cloudflare Workers AI chat completions, responses, embeddings, and reranking.

## API credentials

```python
import os

os.environ["CLOUDFLARE_API_KEY"] = "your-api-token"
os.environ["CLOUDFLARE_ACCOUNT_ID"] = "your-account-id"
```

## Chat completion

```python
from litellm import completion

response = completion(
    model="cloudflare/@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    messages=[{"role": "user", "content": "Hello from LiteLLM"}],
)
print(response)
```

### Streaming

```python
from litellm import completion

response = completion(
    model="cloudflare/@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    messages=[{"role": "user", "content": "Hello from LiteLLM"}],
    stream=True,
)

for chunk in response:
    print(chunk)
```

## Embeddings

```python
from litellm import embedding

response = embedding(
    model="cloudflare/@cf/baai/bge-m3",
    input=["Cloudflare Workers AI embeddings"],
)
print(response)
```

Embedding requests use Cloudflare's OpenAI-compatible
`/accounts/{account_id}/ai/v1/embeddings` endpoint.

## Reranking

```python
from litellm import rerank

response = rerank(
    model="cloudflare/@cf/baai/bge-reranker-base",
    query="What is LiteLLM?",
    documents=[
        "LiteLLM is an LLM gateway.",
        "Cloudflare operates a global network.",
    ],
    top_n=1,
)
print(response)
```

Reranking uses Cloudflare's native
`/accounts/{account_id}/ai/run/{model}` endpoint. LiteLLM maps `documents` to
Cloudflare `contexts` and `top_n` to `top_k`.

## Supported models

Use the `cloudflare/` prefix with a compatible model ID from the
[Cloudflare Workers AI model catalog](https://developers.cloudflare.com/workers-ai/models/).
The catalog is the source of truth for availability and deprecation status.

Current examples by supported LiteLLM endpoint:

| Endpoint | Example models |
| --- | --- |
| Chat completions and responses | `@cf/meta/llama-3.3-70b-instruct-fp8-fast`, `@cf/meta/llama-4-scout-17b-16e-instruct`, `@cf/openai/gpt-oss-120b` |
| Embeddings | `@cf/baai/bge-base-en-v1.5`, `@cf/baai/bge-large-en-v1.5`, `@cf/baai/bge-m3`, `@cf/google/embeddinggemma-300m` |
| Reranking | `@cf/baai/bge-reranker-base` |

Image generation and audio are not yet exposed through this provider. Follow
[the image support issue](https://github.com/BerriAI/litellm/issues/35055) and
[the audio support issue](https://github.com/BerriAI/litellm/issues/35056) for
implementation progress or to contribute.
