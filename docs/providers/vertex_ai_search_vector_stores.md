import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Vertex AI Search - Vector Store (Managed)

Use Vertex AI Search (Discovery Engine) data stores as a LiteLLM-managed
vector store: register the data store once and then search it through
LiteLLM's OpenAI-compatible `/v1/vector_stores/{id}/search` endpoint or
the Python SDK.

This is the **managed** integration. For the raw Discovery Engine
pass-through endpoint (where the caller hand-writes the full Discovery
Engine URL), see
[Vertex AI Search Datastores (pass-through)](../pass_through/vertex_ai_search_datastores.md).

## Quick Start

You need three things:

1. A Vertex AI Search **data store** (Discovery Engine).
2. The data store ID (e.g. `my-datastore_1234567890`).
3. Vertex AI credentials — a service account with the
   `Discovery Engine Viewer` (or higher) role.

### 1. Create a Vertex AI Search data store

Create the data store on Google Cloud — either from the
[Vertex AI Search console](https://console.cloud.google.com/gen-app-builder/data-stores)
or via the Discovery Engine REST API.

Quick API example (replace `$PROJECT_ID`):

```bash
curl -X POST \
  "https://discoveryengine.googleapis.com/v1/projects/$PROJECT_ID/locations/global/collections/default_collection/dataStores?dataStoreId=my-datastore" \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: application/json" \
  -d '{
    "displayName": "My data store",
    "industryVertical": "GENERIC",
    "solutionTypes": ["SOLUTION_TYPE_SEARCH"],
    "contentConfig": "CONTENT_REQUIRED"
  }'
```

After the data store is created, note its **data store ID** — that's
what you'll pass as `vector_store_id` to LiteLLM.

### 2. Register the data store with LiteLLM

You have three equivalent ways to register a Vertex AI Search data
store. All three write the same row to LiteLLM's
`LiteLLM_ManagedVectorStoresTable`, after which the store is
searchable through the unified `/v1/vector_stores/{id}/search`
endpoint.

<Tabs>
<TabItem value="config" label="config.yaml">

Add a `vector_store_registry` entry to your `config.yaml`:

```yaml showLineNumbers
vector_store_registry:
  - vector_store_name: "vertex-ai-litellm-website-knowledgebase"
    litellm_params:
      vector_store_id: "my-datastore_1234567890"
      custom_llm_provider: "vertex_ai/search_api"
      vertex_project: "my-gcp-project"
      vertex_location: "global"
      vector_store_description: "LiteLLM website knowledgebase"
      vector_store_metadata:
        source: "https://docs.litellm.ai"
```

Then start the proxy:

```bash
litellm --config /path/to/config.yaml
```

</TabItem>

<TabItem value="api" label="POST /vector_store/new (API)">

If the proxy is already running, register the data store via API:

```bash showLineNumbers
curl -X POST 'http://0.0.0.0:4000/vector_store/new' \
  -H 'Authorization: Bearer sk-1234' \
  -H 'Content-Type: application/json' \
  -d '{
    "vector_store_id": "my-datastore_1234567890",
    "custom_llm_provider": "vertex_ai/search_api",
    "vector_store_name": "vertex-ai-litellm-website-knowledgebase",
    "vector_store_description": "LiteLLM website knowledgebase",
    "litellm_params": {
      "vertex_project": "my-gcp-project",
      "vertex_location": "global"
    },
    "vector_store_metadata": {
      "source": "https://docs.litellm.ai"
    }
  }'
```

A successful response returns `{"status": "success", "vector_store": {...}}`
with the registered store. The store is now usable in any subsequent
search request without restarting the proxy.

</TabItem>

<TabItem value="ui" label="Admin UI">

1. Sign into the LiteLLM Admin UI.
2. Go to **Vector Stores** → **Add new vector store**.
3. Select provider **Vertex AI Search**.
4. Fill in:
   - **Vector Store ID** — your Discovery Engine data store ID
     (e.g. `my-datastore_1234567890`).
   - **Vector Store Name** — a friendly name for routing.
   - **Vertex Project** — the GCP project that owns the data store.
   - **Vertex Location** — usually `global`.
5. Save. The store is immediately available for search.

</TabItem>
</Tabs>

### 3. Search the data store

Once registered, search the data store through the unified vector
store search endpoint:

<Tabs>
<TabItem value="curl" label="curl">

```bash showLineNumbers
curl -X POST 'http://0.0.0.0:4000/v1/vector_stores/my-datastore_1234567890/search' \
  -H 'Authorization: Bearer sk-1234' \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "How do I authenticate?"
  }'
```

</TabItem>

<TabItem value="sdk" label="Python SDK">

```python showLineNumbers
import litellm

response = litellm.vector_stores.search(
    vector_store_id="my-datastore_1234567890",
    query="How do I authenticate?",
    custom_llm_provider="vertex_ai/search_api",
    vertex_project="my-gcp-project",
    vertex_location="global",
)
print(response)
```

</TabItem>

<TabItem value="async-sdk" label="Async SDK">

```python showLineNumbers
import litellm

response = await litellm.vector_stores.asearch(
    vector_store_id="my-datastore_1234567890",
    query="How do I authenticate?",
    custom_llm_provider="vertex_ai/search_api",
    vertex_project="my-gcp-project",
    vertex_location="global",
)
print(response)
```

</TabItem>
</Tabs>

LiteLLM normalizes the Discovery Engine response into the OpenAI
vector-store search shape.

## Required Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `vector_store_id` | string | Discovery Engine data store ID (e.g. `my-datastore_1234567890`). |
| `custom_llm_provider` | string | Always `"vertex_ai/search_api"`. |
| `vertex_project` | string | GCP project that owns the data store. |
| `vertex_location` | string | Discovery Engine location. Usually `"global"`. |

Authentication uses Application Default Credentials. Set
`GOOGLE_APPLICATION_CREDENTIALS` to the path of a service-account
JSON key, or run on a GCP environment with an attached service
account that has the **Discovery Engine Viewer** role.

## Supported Features

| Feature | Status | Notes |
|---------|--------|-------|
| Unified API (`/v1/vector_stores/{id}/search`) | ✅ Supported | OpenAI-compatible request and response. |
| Logging | ✅ Supported | Standard LiteLLM logging across integrations. |
| Cost Tracking | ✅ Supported | Per-query cost using `input_cost_per_query` from the model map. |
| Guardrails | ❌ Not yet supported | Guardrails are not currently applied to vector store searches. |
| Pass-through | ✅ Supported | See [Vertex AI Search Datastores (pass-through)](../pass_through/vertex_ai_search_datastores.md). |

## Response Format

The response follows the standard LiteLLM vector store format:

```json
{
  "object": "vector_store.search_results.page",
  "search_query": "How do I authenticate?",
  "data": [
    {
      "score": 1.0,
      "content": [
        {
          "text": "https://github.com/BerriAI/litellm.",
          "type": "text"
        }
      ],
      "file_id": "0",
      "filename": "LiteLLM - Getting Started | liteLLM",
      "attributes": {
        "document_id": "0",
        "link": "https://docs.litellm.ai/docs/",
        "title": "LiteLLM - Getting Started | liteLLM"
      }
    }
  ]
}
```

## Use with Chat Completions (file_search tool)

After registration, the store can also be referenced by ID from a
chat completion `file_search` tool:

```bash showLineNumbers
curl http://0.0.0.0:4000/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer sk-1234' \
  -d '{
    "model": "claude-3-5-sonnet",
    "messages": [{"role": "user", "content": "What is litellm?"}],
    "tools": [
      {
        "type": "file_search",
        "vector_store_ids": ["my-datastore_1234567890"]
      }
    ]
  }'
```

## When to use this vs. the pass-through

| You want to… | Use |
|--------------|-----|
| Search Discovery Engine through LiteLLM's unified `/v1/vector_stores/{id}/search` (no Discovery Engine URLs in your client). | **This page** — Managed Vertex AI Search vector store. |
| Call any Discovery Engine REST endpoint directly through the proxy (e.g. data store admin operations, custom `:search` payloads). | [Vertex AI Search Datastores (pass-through)](../pass_through/vertex_ai_search_datastores.md). |
