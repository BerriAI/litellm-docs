# Vertex AI Search Datastores (Pass-through)

Call the Vertex AI Discovery Engine REST API directly through the
LiteLLM proxy, using Discovery Engine's native URL shape.

Provider Doc: https://cloud.google.com/generative-ai-app-builder/docs/reference/rest/v1/projects.locations.dataStores.servingConfigs/search

:::tip Looking for the unified `/v1/vector_stores/{id}/search` API?

This page is for callers that want to send raw Discovery Engine
requests through the proxy. If you'd rather register a data store
once and query it via the OpenAI-compatible vector store API
(`POST /vector_stores/{id}/search`), see
[Vertex AI Search - Vector Store (Managed)](../providers/vertex_ai_search_vector_stores.md).

:::

## What you get

- Any Discovery Engine REST endpoint, reachable through the proxy.
- Centralized auth: no Google access tokens in your client.
- Cost tracking works automatically.

## Quick Start

**Step 1. Set credentials**

```bash
export DEFAULT_VERTEXAI_PROJECT="your-project-id"
export DEFAULT_VERTEXAI_LOCATION="us-central1"
export DEFAULT_GOOGLE_APPLICATION_CREDENTIALS="/path/to/credentials.json"
```

**Step 2. Start proxy**

```bash
litellm
```

**Step 3. Search your datastore**

```bash
curl -X POST \
  "http://localhost:4000/vertex_ai/discovery/v1/projects/my-project/locations/global/collections/default_collection/dataStores/my-datastore/servingConfigs/default_config:search" \
  -H "Content-Type: application/json" \
  -H "x-litellm-api-key: Bearer sk-1234" \
  -d '{
    "query": "How do I authenticate?",
    "pageSize": 10
  }'
```

## Endpoint

`{PROXY_BASE_URL}/vertex_ai/discovery/{endpoint:path}`

Routes to `https://discoveryengine.googleapis.com`. Any path under
the Discovery Engine API can be reached this way — the proxy adds
authentication and cost tracking but does not rewrite the request
body.

## Examples

### Basic Search

```bash
curl -X POST \
  "http://localhost:4000/vertex_ai/discovery/v1/projects/my-project/locations/global/collections/default_collection/dataStores/my-datastore/servingConfigs/default_config:search" \
  -H "Content-Type: application/json" \
  -H "x-litellm-api-key: Bearer sk-1234" \
  -d '{
    "query": "pricing",
    "pageSize": 10
  }'
```

### Search with Filters

```bash
curl -X POST \
  "http://localhost:4000/vertex_ai/discovery/v1/projects/my-project/locations/global/collections/default_collection/dataStores/my-datastore/servingConfigs/default_config:search" \
  -H "Content-Type: application/json" \
  -H "x-litellm-api-key: Bearer sk-1234" \
  -d '{
    "query": "tutorials",
    "pageSize": 20,
    "filter": "category = \"beginner\"",
    "spellCorrectionSpec": {"mode": "AUTO"}
  }'
```

### Python

```python
import requests

url = "http://localhost:4000/vertex_ai/discovery/v1/projects/my-project/locations/global/collections/default_collection/dataStores/my-datastore/servingConfigs/default_config:search"

response = requests.post(url, 
    headers={
        "Content-Type": "application/json",
        "x-litellm-api-key": "Bearer sk-1234"
    },
    json={"query": "pricing", "pageSize": 10}
)

for result in response.json().get("results", []):
    data = result["document"]["derivedStructData"]
    print(f"{data['title']}: {data['link']}")
```

### Use with Chat Completion

If the data store is also registered as a managed vector store (see
[Vertex AI Search - Vector Store (Managed)](../providers/vertex_ai_search_vector_stores.md)),
you can additionally reference it from a chat completion `file_search`
tool by ID:

```bash
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -d '{
    "model": "claude-3-5-sonnet",
    "messages": [{"role": "user", "content": "What is litellm?"}],
    "tools": [
        {
            "type": "file_search",
            "vector_store_ids": ["my-datastore"]
        }
    ]
  }'
```
