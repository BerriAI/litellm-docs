import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# AWS S3 Vectors

Use [Amazon S3 Vectors](https://aws.amazon.com/s3/features/vectors/) as the vector store behind LiteLLM's unified vector store and RAG endpoints. LiteLLM calls the S3 Vectors REST API directly with SigV4-signed requests; no boto3 client is needed for the vector operations themselves.

| Property | Details |
|----------|---------|
| Provider Route on LiteLLM | `s3_vectors` |
| Supported Endpoints | `POST /v1/vector_stores/{id}/search`, `POST /rag/ingest`, `POST /rag/query`, `file_search` on `/chat/completions` and `/v1/responses` |
| Not Supported | `POST /v1/vector_stores` (OpenAI-shaped create). Use `/rag/ingest`, which auto-creates the vector bucket and index |
| Vector store id format | `<vector_bucket_name>:<index_name>` |
| Provider Doc | [Amazon S3 Vectors ↗](https://docs.aws.amazon.com/AmazonS3/latest/userguide/s3-vectors.html) |

## How it works

`/rag/ingest` takes a document, chunks it, generates embeddings with any LiteLLM embedding model, then writes the vectors into an index inside an S3 vector bucket (`PutVectors`). The bucket and index are created automatically if they do not exist. The resulting store is addressed as `bucket_name:index_name` everywhere else: `/v1/vector_stores/{id}/search` embeds your query with the configured embedding model and runs `QueryVectors` against that index, and the same id works in the `file_search` tool on `/chat/completions` and `/v1/responses`.

On the proxy, a successful ingest also registers the store in the LiteLLM database (see [tracking and access control](#how-ingested-files-are-tracked) below), so it shows up in the Admin UI and can be searched by id without any per-request AWS configuration.

## Quick Start

### 1. Setup config.yaml

You need an embedding model for ingest and search. AWS credentials come from the environment (or any other supported method, see [Credentials](#credentials)).

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: text-embedding-3-small
    litellm_params:
      model: openai/text-embedding-3-small
      api_key: os.environ/OPENAI_API_KEY
```

```bash showLineNumbers title="Environment"
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export AWS_REGION_NAME="us-west-2"

litellm --config config.yaml
```

### 2. Ingest a document

Pass `custom_llm_provider: "s3_vectors"` in the `vector_store` block. Setting `aws_region_name` and `embedding_model` here matters: every key in the `vector_store` block is persisted onto the store's registration, so later searches against the registered store reuse them automatically.

```bash showLineNumbers title="Ingest into S3 Vectors"
curl -X POST "http://localhost:4000/v1/rag/ingest" \
    -H "Authorization: Bearer sk-1234" \
    -H "Content-Type: application/json" \
    -d "{
        \"file\": {
            \"filename\": \"document.txt\",
            \"content\": \"$(base64 -i document.txt)\",
            \"content_type\": \"text/plain\"
        },
        \"ingest_options\": {
            \"embedding\": {\"model\": \"text-embedding-3-small\"},
            \"vector_store\": {
                \"custom_llm_provider\": \"s3_vectors\",
                \"vector_bucket_name\": \"my-embeddings\",
                \"aws_region_name\": \"us-west-2\",
                \"embedding_model\": \"text-embedding-3-small\"
            }
        }
    }"
```

```json title="Response"
{
  "id": "ingest_abc123",
  "status": "completed",
  "vector_store_id": "my-embeddings:litellm-index-a1b2c3d4",
  "file_id": "document.txt"
}
```

When `index_name` is omitted LiteLLM generates one (`litellm-index-<id>`). Pass an explicit `index_name` to keep ingesting into the same index across requests. The full list of ingest options is in the [RAG Ingest reference](../rag_ingest.md#vector_store-aws-s3-vectors).

:::warning Keep the embedding model consistent
The index dimension is fixed at creation time from the ingest embedding model (auto-detected, e.g. 1536 for `text-embedding-3-small`). Searches must embed the query with a model of the same dimension. Set `embedding_model` inside the `vector_store` block (as above) or on the registry entry; if it is not set anywhere, search falls back to `text-embedding-3-small`.
:::

### 3. Search the store

```bash showLineNumbers title="Search"
curl -X POST "http://localhost:4000/v1/vector_stores/my-embeddings:litellm-index-a1b2c3d4/search" \
    -H "Authorization: Bearer sk-1234" \
    -H "Content-Type: application/json" \
    -d '{"query": "What does the document say about pricing?", "max_num_results": 5}'
```

```json title="Response"
{
  "object": "vector_store.search_results.page",
  "search_query": "What does the document say about pricing?",
  "data": [
    {
      "score": 0.87,
      "content": [{"text": "Pricing is based on ...", "type": "text"}],
      "file_id": "s3-vectors-chunk-0",
      "filename": "document.txt",
      "attributes": {"source_text": "Pricing is based on ...", "chunk_index": "0", "filename": "document.txt"}
    }
  ]
}
```

`max_num_results` maps to S3 Vectors `topK` (default 5). Results are read from the `source_text` metadata key LiteLLM writes at ingest time; vectors written to the index by other tools without that key are skipped.

### 4. Use it for RAG in chat completions

```bash showLineNumbers title="file_search tool"
curl -X POST "http://localhost:4000/v1/chat/completions" \
    -H "Authorization: Bearer sk-1234" \
    -H "Content-Type: application/json" \
    -d '{
        "model": "{{openai_large}}",
        "messages": [{"role": "user", "content": "Summarize our pricing policy"}],
        "tools": [{"type": "file_search", "vector_store_ids": ["my-embeddings:litellm-index-a1b2c3d4"]}]
    }'
```

`/rag/query` (search plus completion in one call) works with the same store id, see [RAG Query](../rag_query.md).

## Register an existing index

If the vector bucket and index already exist (created by an earlier ingest, another tool, or Terraform), register them in the [vector store registry](../vector_stores/managed_vector_stores.md) so every key on the proxy can search them:

```yaml showLineNumbers title="config.yaml"
vector_store_registry:
  - vector_store_name: "product-docs"
    litellm_params:
      vector_store_id: "my-embeddings:my-index"
      custom_llm_provider: "s3_vectors"
      aws_region_name: "us-west-2"
      embedding_model: "text-embedding-3-small"
```

`aws_region_name` is required for search. `embedding_model` should match the model the index was built with. Instead of the `bucket:index` id you can also set `vector_bucket_name` in `litellm_params` and use the plain index name as `vector_store_id`.

## Configuration reference

Search-side `litellm_params` (registry entry, or persisted automatically from ingest):

| Parameter | Required | Description |
|-----------|----------|-------------|
| `custom_llm_provider` | yes | `"s3_vectors"` |
| `vector_store_id` | yes | `bucket:index`, or plain index name when `vector_bucket_name` is set |
| `aws_region_name` | yes | Region of the vector bucket |
| `embedding_model` | no | Model used to embed search queries. Default `text-embedding-3-small` |
| `vector_bucket_name` | no | Lets `vector_store_id` be a bare index name |
| `aws_access_key_id`, `aws_secret_access_key`, `aws_session_token`, `aws_role_name`, `aws_session_name`, `aws_profile_name`, `aws_web_identity_token` | no | Explicit AWS credentials, see [Credentials](#credentials) |
| `litellm_credential_name` | no | Reference a named credential from `credential_list` |

Ingest-side options (the `vector_store` block of `ingest_options`) are documented in the [RAG Ingest reference](../rag_ingest.md#vector_store-aws-s3-vectors): `vector_bucket_name` (required), `index_name`, `dimension`, `distance_metric` (`cosine`, default, or `euclidean`), `non_filterable_metadata_keys` (default `["source_text"]`), plus the same AWS credential parameters.

## Region, endpoint, and encryption

LiteLLM always calls the regional S3 Vectors endpoint `https://s3vectors.<aws_region_name>.api.aws`. There is no `api_base` override for this provider. For ingest, the region resolves from `aws_region_name` in the request, then the `AWS_REGION_NAME` and `AWS_REGION` environment variables, then falls back to `us-west-2`. For search, `aws_region_name` must be present on the registry entry or persisted ingest params.

Auto-created vector buckets use the S3 Vectors default server-side encryption (SSE-S3). LiteLLM does not pass an encryption configuration on `CreateVectorBucket`, so to use SSE-KMS create the vector bucket yourself with your KMS key and point LiteLLM at it; the existence check sees the bucket and skips creation. Bucket names follow S3 rules: at least 3 characters, lowercase letters, numbers, hyphens, and periods only.

## Credentials

Authentication reuses LiteLLM's standard AWS credential resolution (the same `BaseAWSLLM` chain as Bedrock). In order: explicit `aws_*` parameters on the registry entry or ingest request, a named credential via `litellm_credential_name`, environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`), `aws_profile_name`, STS role assumption via `aws_role_name` and `aws_session_name`, web identity tokens (IRSA on EKS), and finally the default boto3 chain (instance profiles, ECS task roles). See [Bedrock authentication](./bedrock.md#boto3---authentication) for details on each method.

### IAM permissions

| Action | Needed for |
|--------|-----------|
| `s3vectors:QueryVectors` | search, `/rag/query`, `file_search` |
| `s3vectors:PutVectors` | `/rag/ingest` |
| `s3vectors:GetVectorBucket` | `/rag/ingest` existence check |
| `s3vectors:CreateVectorBucket` | `/rag/ingest` auto-create |
| `s3vectors:GetIndex` | `/rag/ingest` existence check |
| `s3vectors:CreateIndex` | `/rag/ingest` auto-create |

With pre-created buckets and indexes, the minimal ingest policy is `GetVectorBucket`, `GetIndex`, and `PutVectors`; search-only credentials need just `QueryVectors`. The proxy also needs whatever credentials the embedding model requires (an OpenAI key in the quick start above, or `bedrock/amazon.titan-embed-text-v2:0` to stay inside AWS).

## How ingested files are tracked

On a database-connected proxy, `/rag/ingest` saves the new store to the `LiteLLM_ManagedVectorStoresTable` with the `team_id` and `user_id` of the calling key, adds it to the in-memory registry, and records each ingested file (filename or URL, timestamp) in the store's `ingested_files` metadata. Ingesting again into the same bucket and index appends to that file list instead of creating a new entry. The store then appears in the Admin UI under Vector Stores, and access follows the standard [vector store permission model](../vector_stores/managed_vector_stores.md): set `object_permission.vector_stores` on a key or team to control which store ids its requests may reference.

The raw file bytes are not stored in S3 or in the LiteLLM database; only chunk text (in vector metadata as `source_text`) and file metadata are kept.

## Is there a "default vector store" setting?

No. LiteLLM has no proxy-wide default vector store provider today. `/rag/ingest` defaults to `custom_llm_provider: "openai"` when the `vector_store` block omits the provider, so every ingest request that should land in S3 Vectors must pass `custom_llm_provider: "s3_vectors"` explicitly. After ingest, no provider choice is needed anywhere else: search, `/rag/query`, and `file_search` all address the store by its id, and the persisted registration carries the provider and AWS settings.

## Can S3 be the default storage for /v1/files?

Not today. `/v1/files` uploads go to the target LLM provider (OpenAI, Azure, Bedrock, Vertex), and the only alternative storage backend for the `target_storage` upload parameter is `azure_storage` (Azure Blob Storage); there is no S3 storage backend. Two S3-adjacent paths do exist: files uploaded for [Bedrock batches](./bedrock_batches.md) are staged in your S3 bucket via the model's `s3_bucket_name` parameter, and for the RAG flow on this page no file storage is needed at all, since `/rag/ingest` accepts the file inline (multipart or base64), as a `file_url`, or as an existing provider `file_id`.

## Validation

After an ingest, confirm the pipeline end to end: the ingest response has `"status": "completed"` and a `vector_store_id`; a search against that id returns your document text in `data[].content`; the Admin UI lists the store under Vector Stores; and in the AWS console the vector bucket and index are visible under Amazon S3, Vector buckets, in the configured region. If search returns an empty `data` array, check that the query embedding model matches the ingest model (dimension mismatch is rejected by S3 Vectors) and that the vectors carry `source_text` metadata.
