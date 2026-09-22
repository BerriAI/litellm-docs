# Voyage AI
https://docs.voyageai.com/embeddings/

## API Key
```python
# env variable
os.environ['VOYAGE_API_KEY']
```

## Sample Usage - Embedding
```python
from litellm import embedding
import os

os.environ['VOYAGE_API_KEY'] = ""
response = embedding(
    model="voyage/voyage-3.5",
    input=["good morning from litellm"],
)
print(response)
```

## Supported Parameters

VoyageAI embeddings support the following optional parameters:

- `input_type`: Specifies the type of input for retrieval optimization
  - `"query"`: Use for search queries
  - `"document"`: Use for documents being indexed
- `dimensions`: Output embedding dimensions (256, 512, 1024, or 2048)
- `encoding_format`: Output format (`"float"`, `"int8"`, `"uint8"`, `"binary"`, `"ubinary"`)
- `truncation`: Whether to truncate inputs exceeding max tokens (default: `True`)

### Example with Parameters

```python
from litellm import embedding
import os

os.environ['VOYAGE_API_KEY'] = "your-api-key"

# Embedding with custom dimensions and input type
response = embedding(
    model="voyage/voyage-3.5",
    input=["Your text here"],
    dimensions=512,
    input_type="document"
)
print(f"Embedding dimensions: {len(response.data[0]['embedding'])}")
```

## Supported Models
All models listed here https://docs.voyageai.com/embeddings/#models-and-specifics are supported

| Model Name              | Function Call                                              |
|-------------------------|------------------------------------------------------------|
| voyage-4-large          | `embedding(model="voyage/voyage-4-large", input)`          |
| voyage-4                | `embedding(model="voyage/voyage-4", input)`                |
| voyage-4-lite           | `embedding(model="voyage/voyage-4-lite", input)`           |
| voyage-code-4           | `embedding(model="voyage/voyage-code-4", input)`           |
| voyage-context-4        | `embedding(model="voyage/voyage-context-4", input)`        |
| voyage-context-3        | `embedding(model="voyage/voyage-context-3", input)`        |
| voyage-3.5              | `embedding(model="voyage/voyage-3.5", input)`              | 
| voyage-3.5-lite         | `embedding(model="voyage/voyage-3.5-lite", input)`         | 
| voyage-3-large          | `embedding(model="voyage/voyage-3-large", input)`          | 
| voyage-3                | `embedding(model="voyage/voyage-3", input)`                | 
| voyage-3-lite           | `embedding(model="voyage/voyage-3-lite", input)`           | 
| voyage-code-3           | `embedding(model="voyage/voyage-code-3", input)`           | 
| voyage-finance-2        | `embedding(model="voyage/voyage-finance-2", input)`        | 
| voyage-law-2            | `embedding(model="voyage/voyage-law-2", input)`            | 
| voyage-code-2           | `embedding(model="voyage/voyage-code-2", input)`           | 
| voyage-multilingual-2   | `embedding(model="voyage/voyage-multilingual-2", input)`   | 
| voyage-large-2-instruct | `embedding(model="voyage/voyage-large-2-instruct", input)` | 
| voyage-large-2          | `embedding(model="voyage/voyage-large-2", input)`          |
| voyage-2                | `embedding(model="voyage/voyage-2", input)`                | 
| voyage-lite-02-instruct | `embedding(model="voyage/voyage-lite-02-instruct", input)` | 
| voyage-01               | `embedding(model="voyage/voyage-01", input)`               | 
| voyage-lite-01          | `embedding(model="voyage/voyage-lite-01", input)`          |
| voyage-lite-01-instruct | `embedding(model="voyage/voyage-lite-01-instruct", input)` |

## Contextual Embeddings (voyage-context-4, voyage-context-3)

Voyage's `voyage-context-4` and `voyage-context-3` models produce contextualized chunk embeddings: each chunk is embedded with awareness of the whole document it came from, which retrieves better on long documents than embedding the chunks on their own. LiteLLM sends any Voyage model with `context` in its name to Voyage's `/v1/contextualizedembeddings` endpoint, so the same `embedding()` call and `/v1/embeddings` proxy route work; only the input and response shapes differ from the regular models

### Input shapes

A flat list of strings, or a single string, embeds each string as its own document. LiteLLM forwards it with `enable_auto_chunking: true`, `chunk_size: 32000`, and `input_type: "document"`, so a string of up to 32,000 tokens comes back as one embedding and a longer one is split into chunks of up to 32,000 tokens on Voyage's side. Sending `input_type: "query"` skips those defaults and embeds each string as a search query. Any `input_type`, `chunk_size`, or `enable_auto_chunking` you pass yourself replaces the default

```python
from litellm import embedding
import os

os.environ['VOYAGE_API_KEY'] = "your-api-key"

# Each string is embedded as its own document
response = embedding(
    model="voyage/voyage-context-4",
    input=["The quick brown fox", "jumps over the lazy dog"],
)
print(f"Documents embedded: {len(response.data)}")

# Search queries
response = embedding(
    model="voyage/voyage-context-4",
    input=["what does the fox do", "who is lazy"],
    input_type="query",
)
```

A nested list is the pre-chunked form: each inner list is one document you already split into chunks, and LiteLLM forwards it unchanged

```python
# Single document with multiple chunks
response = embedding(
    model="voyage/voyage-context-4",
    input=[
        [
            "Chapter 1: Introduction to AI",
            "This chapter covers the basics of artificial intelligence.",
            "We will explore machine learning and deep learning."
        ]
    ]
)
print(f"Number of chunk groups: {len(response.data)}")

# Multiple documents
response = embedding(
    model="voyage/voyage-context-4",
    input=[
        ["Paris is the capital of France.", "It is known for the Eiffel Tower."],
        ["Tokyo is the capital of Japan.", "It is a major economic hub."]
    ]
)
print(f"Processed {len(response.data)} documents")
```

### Response shape

The response keeps Voyage's nested layout: `data` has one entry per input, and that entry's `data` holds one embedding per chunk. `response.data[0]["data"][0]["embedding"]` is the first chunk of the first input, which with flat input and the default chunk size is the whole string

### LiteLLM Proxy

Add the model to `config.yaml`:

```yaml
model_list:
  - model_name: voyage-context-4
    litellm_params:
      model: voyage/voyage-context-4
      api_key: os.environ/VOYAGE_API_KEY
```

Flat list, one document per string:

```bash
curl http://localhost:4000/v1/embeddings \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "voyage-context-4",
    "input": ["The quick brown fox", "jumps over the lazy dog"]
  }'
```

Flat list as search queries:

```bash
curl http://localhost:4000/v1/embeddings \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "voyage-context-4",
    "input": ["what does the fox do", "who is lazy"],
    "input_type": "query"
  }'
```

Nested list, one document already split into chunks:

```bash
curl http://localhost:4000/v1/embeddings \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "voyage-context-4",
    "input": [["The quick brown fox", "jumps over the lazy dog"]]
  }'
```

### Specifications

| Model | Per chunk | Per request | Output dimensions | Price/M tokens |
|-------|-----------|-------------|-------------------|----------------|
| voyage-context-4 | 32,000 tokens | 120,000 tokens, 1,000 inputs, 16,000 chunks | 256, 512, 1024 (default), 2048 | $0.12 |
| voyage-context-3 | 32,000 tokens | 120,000 tokens, 1,000 inputs, 16,000 chunks | 256, 512, 1024 (default), 2048 | $0.18 |

The limits are Voyage's, from https://docs.voyageai.com/docs/contextualized-chunk-embeddings, and the per-request token total counts every chunk in the call

### When to use contextual embeddings

Reach for `voyage-context-4` when you split long documents into chunks and the surrounding document should inform each chunk's embedding, because structure, section references, and cross-chunk dependencies matter. Reach for `voyage-4-large`, `voyage-4`, or `voyage-4-lite` for independent pieces of text and short queries, where document context adds nothing and the standard models are cheaper and faster

## Model Selection Guide

| Model | Best For | Context Length | Price/M Tokens |
|-------|----------|----------------|----------------|
| voyage-4-large | Best general-purpose and multilingual quality | 32K | $0.12 |
| voyage-4 | General-purpose, multilingual | 32K | $0.06 |
| voyage-4-lite | Latency-sensitive applications | 32K | $0.02 |
| voyage-code-4 | Code retrieval and coding agents | 32K | $0.12 |
| voyage-context-4 | Contextual document embeddings | 32K per chunk, 120K per request | $0.12 |
| voyage-3.5 | General-purpose, multilingual | 32K | $0.06 |
| voyage-3.5-lite | Latency-sensitive applications | 32K | $0.02 |
| voyage-3-large | Best overall quality | 32K | $0.18 |
| voyage-code-3 | Code retrieval and search | 32K | $0.18 |
| voyage-finance-2 | Financial documents | 32K | $0.12 |
| voyage-law-2 | Legal documents | 16K | $0.12 |
| voyage-context-3 | Contextual document embeddings | 32K per chunk, 120K per request | $0.18 |

## Rerank

Voyage AI provides reranking models to improve search relevance by reordering documents based on their relevance to a query.

### Quick Start

```python
from litellm import rerank
import os

os.environ["VOYAGE_API_KEY"] = "your-api-key"

response = rerank(
    model="voyage/rerank-2.5",
    query="What is the capital of France?",
    documents=[
        "Paris is the capital of France.",
        "London is the capital of England.",
        "Berlin is the capital of Germany.",
    ],
    top_n=3,
)

print(response)
```

### Async Usage

```python
from litellm import arerank
import os
import asyncio

os.environ["VOYAGE_API_KEY"] = "your-api-key"

async def main():
    response = await arerank(
        model="voyage/rerank-2.5-lite",
        query="Best programming language for beginners?",
        documents=[
            "Python is great for beginners due to simple syntax.",
            "JavaScript runs in browsers and is versatile.",
            "Rust has a steep learning curve but is very safe.",
        ],
        top_n=2,
    )
    print(response)

asyncio.run(main())
```

### LiteLLM Proxy Usage

Add to your `config.yaml`:

```yaml
model_list:
  - model_name: rerank-2.5
    litellm_params:
      model: voyage/rerank-2.5
      api_key: os.environ/VOYAGE_API_KEY
  - model_name: rerank-2.5-lite
    litellm_params:
      model: voyage/rerank-2.5-lite
      api_key: os.environ/VOYAGE_API_KEY
```

Test with curl:

```bash
curl http://localhost:4000/rerank \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "rerank-2.5",
    "query": "What is the capital of France?",
    "documents": [
        "Paris is the capital of France.",
        "London is the capital of England.",
        "Berlin is the capital of Germany."
    ],
    "top_n": 3
  }'
```

### Supported Rerank Models

| Model | Context Length | Description | Price/M Tokens |
|-------|----------------|-------------|----------------|
| rerank-2.5 | 32K | Best quality, multilingual, instruction-following | $0.05 |
| rerank-2.5-lite | 32K | Optimized for latency and cost | $0.02 |
| rerank-2 | 16K | Legacy model | $0.05 |
| rerank-2-lite | 8K | Legacy model, faster | $0.02 |

### Supported Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `model` | string | Model name (e.g., `voyage/rerank-2.5`) |
| `query` | string | The search query |
| `documents` | list | List of documents to rerank |
| `top_n` | int | Number of top results to return |
| `return_documents` | bool | Whether to include document text in response |
