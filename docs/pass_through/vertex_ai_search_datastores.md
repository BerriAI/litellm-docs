# Vertex AI Search Datastores (Pass-through)

Call the Vertex AI Discovery Engine Search API through LiteLLM, using Google's native request and response shapes.

Provider Doc: https://cloud.google.com/generative-ai-app-builder/docs/reference/rest/v1/projects.locations.dataStores.servingConfigs/search

:::tip Want the unified API instead?
This page is the raw Google API through the proxy. If you want to query the datastore through the OpenAI-compatible `POST /v1/vector_stores/{id}/search` endpoint, or use it for RAG in `/chat/completions`, register it as a [managed vector store](../vector_stores/managed_vector_stores.md) (provider `vertex_ai/search_api`).
:::

## What you get

- The full Discovery Engine API surface, unchanged.
- Configure credentials once on the proxy, use everywhere.
- If the datastore id in the URL is registered as a [managed vector store](../vector_stores/managed_vector_stores.md), LiteLLM resolves its project and credentials from the registration automatically.

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

Routes to `https://discoveryengine.googleapis.com`

## Examples

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
