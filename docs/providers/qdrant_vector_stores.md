# Qdrant - Vector Store

Search an existing Qdrant collection through LiteLLM's SDK or its OpenAI-compatible vector store search endpoint. LiteLLM generates the query embedding and returns document text, scores, and payload metadata. This provider is separate from the [Qdrant semantic response cache](../proxy/caching.md).

Use Qdrant 1.10 or later, which provides the [Query Points API](https://api.qdrant.tech/api-reference/search/query-points). Populate the collection in Qdrant before registering it in LiteLLM. The query embedding model must match the model used to index the documents, including its dimensions and any embedding configuration.

## SDK

```python
import os
from litellm import vector_stores

response = vector_stores.search(
    custom_llm_provider="qdrant",
    vector_store_id="documents",
    query="What is the refund policy?",
    api_base="http://localhost:6333",
    api_key=os.environ.get("QDRANT_API_KEY"),
    litellm_embedding_model="openai/text-embedding-3-small",
    litellm_embedding_config={"api_key": os.environ["OPENAI_API_KEY"]},
    qdrant_text_field="text",
    max_num_results=5,
)
print(response)
```

For asynchronous search, use `await vector_stores.asearch(...)` with the same parameters. No Qdrant Python dependency is required. LiteLLM uses Qdrant's HTTP API through its shared HTTP transport.

## Proxy

Register the collection in `config.yaml`. The embedding model can be a model alias on the proxy, so embeddings use the configured deployment credentials and routing.

```yaml
model_list:
  - model_name: query-embeddings
    litellm_params:
      model: openai/text-embedding-3-small
      api_key: os.environ/OPENAI_API_KEY

vector_store_registry:
  - vector_store_name: qdrant-documents
    litellm_params:
      vector_store_id: documents
      custom_llm_provider: qdrant
      api_base: http://localhost:6333
      api_key: os.environ/QDRANT_API_KEY
      litellm_embedding_model: query-embeddings
      qdrant_text_field: text
```

Omit `api_key` for a self-hosted Qdrant server without authentication. Start LiteLLM with this config, then search the collection.

```bash
curl -X POST 'http://localhost:4000/v1/vector_stores/documents/search' \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"query":"What is the refund policy?","max_num_results":5}'
```

The Admin UI also supports registration under **Tools > Vector Stores > Add new vector store**. Select **Qdrant** and enter the existing collection name, HTTP endpoint, embedding model, and payload text field.

## RAG

Reference the registered collection with `file_search` to retrieve context for a chat completion. The chat model must also be configured on the proxy.

```bash
curl -X POST 'http://localhost:4000/v1/chat/completions' \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "chat-model",
    "messages": [{"role":"user","content":"What is the refund policy?"}],
    "tools": [{"type":"file_search","vector_store_ids":["documents"]}]
  }'
```

See [managed vector stores](../vector_stores/managed_vector_stores.md) for registration and access controls, and [chat completions with vector stores](../completion/knowledgebase.md) for retrieval options.

## Configuration

| Parameter | Description |
| --- | --- |
| `vector_store_id` | Existing Qdrant collection name. |
| `api_base` | Qdrant HTTP endpoint, or `QDRANT_API_BASE`. Reverse proxy path prefixes are supported. |
| `api_key` | Optional API key, or `QDRANT_API_KEY`. Sent in the `api-key` header. |
| `litellm_embedding_model` | Required embedding model or proxy model alias. |
| `litellm_embedding_config` | Optional embedding provider configuration. Credentials are separate from Qdrant credentials. |
| `qdrant_text_field` | Payload text field, default `text`. Dotted paths such as `metadata.body` are supported. |
| `qdrant_vector_name` | Dense vector name, sent as `using`. Omit for an unnamed vector. |
| `max_num_results` | Result count, from 1 to 50, default 10. |
| `filters` | OpenAI-style metadata comparison or compound filter. |
| `ranking_options.score_threshold` | Threshold from 0 to 1, forwarded to Qdrant. Scores retain the collection's native distance semantics. |

Each result contains `content`, `score`, `file_id`, `filename`, and `attributes`. `file_id` comes from the payload when present, otherwise from the point ID. `filename` comes from the payload when present. Other payload fields are returned as attributes, excluding the selected top-level text field. A nested text field remains inside its parent metadata object. Missing or non-string document text raises an error instead of silently returning empty RAG context.

## Filters and native search options

`filters` supports `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `in`, and `nin`, along with nested `and` and `or` groups.

```json
{
  "query": "What is the refund policy?",
  "filters": {
    "type": "and",
    "filters": [
      {"type":"eq","key":"language","value":"en"},
      {"type":"gte","key":"year","value":2025}
    ]
  }
}
```

Qdrant equality filters accept strings, integers, and booleans. Range filters accept finite numbers. Membership filters accept non-empty arrays of strings or integers. Unsupported filters fail rather than being dropped.

For Qdrant-native filtering, pass `extra_body={"filter": {...}}` to the SDK. Native `params` and `score_threshold` can also be passed through `extra_body`. Use `extra_body.score_threshold` for thresholds outside the unified API's 0 to 1 range, such as a Euclidean distance threshold. Do not combine native and unified filters or specify the threshold twice. Native options cannot override the query vector, vector name, collection, result count, or payload retrieval.

## Scope

This integration supports dense retrieval from existing collections. Collection creation, file ingestion, file management, sparse or hybrid search, custom rankers, and query rewriting are not supported. Create and populate collections with Qdrant's own API or SDK. Qdrant query scores are returned unchanged and are not normalized to 0 to 1.
