# Vector Stores - Overview

LiteLLM has three distinct ways to work with vector stores. They are separate APIs with separate endpoints, and knowing which one you need saves a lot of confusion:

1. **LiteLLM Managed Vector Stores**: you already have a vector store on a provider (a Bedrock Knowledge Base, a Vertex AI Search datastore, an Azure AI Search index, ...). You register it with LiteLLM once, and LiteLLM stores the provider, credentials, and id mapping. Every key on the proxy can then query it through one OpenAI-compatible endpoint, or attach it to `/chat/completions` and `/v1/responses` requests for RAG. Registration happens in `config.yaml`, over the [management API](./managed_vector_stores.md) (`POST /vector_store/new`), or in the Admin UI.

2. **OpenAI-compatible vector store API**: create and manage vector stores *on the provider itself* through LiteLLM, using the OpenAI API shape. `POST /v1/vector_stores` creates a new store upstream, `/v1/vector_stores/{id}/files` manages its files, and `/rag/ingest` wraps upload, chunking, embedding, and store creation in one call.

3. **Pass-through provider APIs**: call the provider's native API (native request and response shapes) through the proxy, for example `/vertex_ai/discovery/...` or `/bedrock/knowledgebases/...`. Use this when you need provider features the unified API does not expose.

:::info Terminology
A **managed vector store** in LiteLLM is a *registration*, not a new store: LiteLLM saves which provider a store lives on and how to authenticate to it, so requests can reference it by id. Nothing is created on the provider. Older docs call this concept a "knowledge base"; it is the same thing.
:::

## Which endpoint do I need?

| You want to | Use | Docs |
|---|---|---|
| Query an existing provider store through one unified API | Register it, then `POST /v1/vector_stores/{id}/search` | [Managed Vector Stores](./managed_vector_stores.md) |
| Give a model RAG context in `/chat/completions` | `tools: [{"type": "file_search", "vector_store_ids": [...]}]` with a registered store | [Using Vector Stores with Chat Completions](../completion/knowledgebase.md) |
| Use `file_search` on `/v1/responses` | Registered store + the `file_search` tool | [File Search tutorial](../tutorials/file_search_responses_api.md) |
| Create a brand new store on the provider | `POST /v1/vector_stores` | [Create](./create.md) |
| Upload, chunk, embed, and store documents in one call | `POST /rag/ingest` | [RAG Ingest](../rag_ingest.md) |
| Search plus rerank plus completion in one call | `POST /rag/query` | [RAG Query](../rag_query.md) |
| Manage the files inside a store | `/v1/vector_stores/{id}/files` | [Files](../vector_store_files.md) |
| Call the provider's native API directly | Pass-through routes | [Vertex AI Search](../pass_through/vertex_ai_search_datastores.md), [Azure AI (passthrough)](../providers/azure_ai/azure_ai_vector_stores_passthrough.md) |

Note the two similarly named create endpoints. `POST /v1/vector_stores` (plural) creates a new store **on the provider**. `POST /vector_store/new` (singular) registers an **existing** store with LiteLLM. See [Managed Vector Stores](./managed_vector_stores.md) for the full management API.

## Provider support

Support for the unified endpoints varies by provider. `Search` is `POST /v1/vector_stores/{id}/search`; `Create` is `POST /v1/vector_stores`.

| Provider (`custom_llm_provider`) | Search | Create | Notes |
|---|---|---|---|
| `openai` | Yes | Yes | Also supports the [files API](../vector_store_files.md) |
| `azure` (Azure OpenAI) | Yes | Yes | |
| `bedrock` (Knowledge Bases) | Yes | No | [Setup](../providers/bedrock_vector_store.md) |
| `vertex_ai` (RAG Engine) | Yes | Yes | |
| `vertex_ai/search_api` (Vertex AI Search) | Yes | No | Register the datastore as a [managed vector store](./managed_vector_stores.md) |
| `azure_ai` (Azure AI Search) | Yes | No | [Setup](../providers/azure_ai_vector_stores.md) |
| `gemini` (File Search) | Yes | Yes | [Setup](../providers/gemini_file_search.md) |
| `milvus` | Yes | Yes | [Setup](../providers/milvus_vector_stores.md) |
| `pg_vector` | Yes | Yes | Requires the [litellm-pgvector](../completion/knowledgebase.md) connector |
| `s3_vectors` | Yes | No | Create via [/rag/ingest](../rag_ingest.md), [Setup](../providers/s3_vectors.md) |
| `valkey` | Yes | No | Searches an existing valkey-search index, [setup](../providers/valkey_vector_stores.md) |
| `ragflow` | No | Yes | Dataset management only, [setup](../providers/ragflow_vector_store.md) |

Retrieve, list, update, and delete (`GET`/`POST`/`DELETE /v1/vector_stores/{id}`) forward the OpenAI request shape as-is, so use them with providers that expose an OpenAI-shaped vector stores API (OpenAI, Azure OpenAI). See [Create](./create.md#vector-store-management-and-routing-on-the-proxy) for routing details.
