---
title: "Amazon OpenSearch Vector Store with LiteLLM"
sidebar_label: "Amazon OpenSearch - Vector Store"
description: "Search Amazon OpenSearch Serverless collections and OpenSearch Service domains through LiteLLM's vector store API, with filters, hybrid search and a per-key index pass-through."
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Amazon OpenSearch - Vector Store

Search k-NN indexes in [Amazon OpenSearch Serverless](https://docs.aws.amazon.com/opensearch-service/latest/developerguide/serverless.html) collections and [Amazon OpenSearch Service](https://docs.aws.amazon.com/opensearch-service/latest/developerguide/what-is.html) domains through LiteLLM's unified vector store API. Any virtual key can then run retrieval against the index without holding AWS credentials, because LiteLLM signs every OpenSearch request with AWS SigV4 using the identity you register on the store.

Each search embeds the query with the model you registered, runs a [k-NN query](https://docs.opensearch.org/latest/query-dsl/specialized/k-nn/) against your index, and returns the same OpenAI-shaped results every other provider returns. On top of search, admins can open an index to developers through the [`/opensearch` pass-through](#pass-through-with-per-key-index-permissions), with read and write permissions set per key or team.

Vector store search is available <SinceVersion v="1.109.0" />. [Filters](#filters), [hybrid search](#hybrid-search) and the [pass-through](#pass-through-with-per-key-index-permissions) are available <SinceVersion v="1.111.0" />.

## Quick Start

You need three things:
1. An OpenSearch Serverless vector search collection or an OpenSearch Service domain, with a k-NN index of your documents
2. An AWS identity LiteLLM can sign with, allowed to read that index
3. An embedding model (the one that embedded your documents)

## 1. Create the k-NN index

LiteLLM searches an index you already have. It does not create the index or upload documents. Each document needs a text field (`text` by default) and a `knn_vector` field (`embedding` by default), and any other top-level string, number, or boolean field comes back in the result's `attributes`.

```json showLineNumbers title="PUT /support-docs"
{
  "settings": {"index": {"knn": true}},
  "mappings": {
    "properties": {
      "embedding": {
        "type": "knn_vector",
        "dimension": 1536,
        "method": {"name": "hnsw", "engine": "faiss", "space_type": "l2"}
      },
      "text": {"type": "text"},
      "filename": {"type": "keyword"},
      "category": {"type": "keyword"},
      "year": {"type": "integer"}
    }
  }
}
```

`dimension` must equal your embedding model's dimensions (1536 for `text-embedding-3-small`), and the documents must be embedded with the same model you register in LiteLLM. If you plan to use [filters](#filters), use the Faiss engine (OpenSearch 2.9 or later) or the Lucene engine (OpenSearch 2.4 or later), since an nmslib index cannot filter inside a k-NN query.

## 2. Let LiteLLM's AWS identity read the index

LiteLLM signs requests with the AWS identity configured on the store: access keys, an IAM role to assume, a named profile, or, with none of those set, the default AWS credential chain of the machine LiteLLM runs on (environment variables, EKS pod identity, IRSA, or an instance profile). The service it signs for comes from the endpoint, so a Serverless collection is signed for `aoss` and a domain for `es`.

<Tabs>
<TabItem value="serverless" label="OpenSearch Serverless">

The identity needs `aoss:APIAccessAll` in its IAM policy, and the collection's [data access policy](https://docs.aws.amazon.com/opensearch-service/latest/developerguide/serverless-data-access.html) has to grant it the index permissions. Search needs `aoss:ReadDocument`. [Filters](#filters) also need `aoss:DescribeIndex`, because LiteLLM reads the index mapping before a filtered search. The [pass-through](#pass-through-with-per-key-index-permissions) needs `aoss:WriteDocument` for writes.

```json showLineNumbers title="Data access policy"
[
  {
    "Rules": [
      {
        "ResourceType": "index",
        "Resource": ["index/my-collection/support-docs"],
        "Permission": ["aoss:ReadDocument", "aoss:DescribeIndex"]
      }
    ],
    "Principal": ["arn:aws:iam::123456789012:role/litellm-opensearch"]
  }
]
```

</TabItem>
<TabItem value="domain" label="OpenSearch Service domain">

The domain's access policy, or its fine-grained access control role mapping, has to allow the identity. Search sends `POST /<index>/_search`, so it needs `es:ESHttpPost`. [Filters](#filters) also need `es:ESHttpGet` to read the index mapping. The [pass-through](#pass-through-with-per-key-index-permissions) also needs `es:ESHttpGet` and `es:ESHttpHead` for reads, and `es:ESHttpPut` and `es:ESHttpDelete` for writes.

```json showLineNumbers title="Domain access policy"
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {"AWS": "arn:aws:iam::123456789012:role/litellm-opensearch"},
      "Action": ["es:ESHttpPost", "es:ESHttpGet"],
      "Resource": "arn:aws:es:us-east-1:123456789012:domain/my-domain/support-docs/*"
    }
  ]
}
```

</TabItem>
</Tabs>

## 3. Register the index with LiteLLM

Registering tells LiteLLM where the index is, how to sign for it, and which model embeds queries. It creates nothing in OpenSearch. Add the embedding model under **Models** first.

`api_base` is the collection or domain endpoint, with no index in the path. LiteLLM accepts each endpoint shape AWS hands out:

| Endpoint | Example `api_base` | Signs for |
|---|---|---|
| Serverless collection | `https://abc123.us-east-1.aoss.amazonaws.com` | `aoss` |
| Serverless collection, dual-stack | `https://abc123.aoss.us-east-1.on.aws` | `aoss` |
| Serverless collection, FIPS | `https://abc123.us-east-1.aoss-fips.amazonaws.com` | `aoss` |
| Domain | `https://search-my-domain-abc123.us-east-1.es.amazonaws.com` | `es` |
| Domain, dual-stack | `https://search-my-domain-abc123.aos.us-east-1.on.aws` | `es` |
| VPC endpoint or custom domain | `https://search.example.com` | `es` |

The signing region comes from the endpoint. For a VPC endpoint or custom domain, which carries no region, set `aws_region_name`, or LiteLLM falls back to `AWS_REGION`, then `AWS_REGION_NAME`, then `us-west-2`. A Serverless per-account endpoint (`https://123456789012.aoss.us-east-1.on.aws`) answers 400, so use the collection endpoint instead.

<Tabs>
<TabItem value="ui" label="Admin UI">

Open **Tools > Vector Stores**, go to the **Manage Vector Stores** tab, and click **+ Add Vector Store**. Pick **Amazon OpenSearch** as the provider.

Enter a **Vector Store ID**, the **OpenSearch Endpoint**, and the **Embedding Model** that produced the vectors in the index. Set **Index Name** when the OpenSearch index name differs from the Vector Store ID, and **Vector Field Name** and **Text Field** when your documents do not use `embedding` and `text`. Leave **AWS Region** empty unless the endpoint is a VPC endpoint or custom domain. Under **Existing Credentials**, pick a saved AWS credential, or leave it empty to use the identity LiteLLM runs as.

Creating a store does not test the connection. A wrong endpoint, index, or permission shows up on the first search, so run one from the **Test Vector Store** tab straight away.

</TabItem>
<TabItem value="config" label="config.yaml">

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: text-embedding-3-small
    litellm_params:
      model: openai/text-embedding-3-small
      api_key: os.environ/OPENAI_API_KEY

vector_store_registry:
  - vector_store_name: support-docs
    litellm_params:
      vector_store_id: support-docs
      custom_llm_provider: opensearch
      api_base: https://abc123.us-east-1.aoss.amazonaws.com
      opensearch_index_name: support-docs
      litellm_embedding_model: text-embedding-3-small
      aws_role_name: arn:aws:iam::123456789012:role/litellm-opensearch
      aws_session_name: litellm-opensearch
```

```bash
litellm --config /path/to/config.yaml
```

Drop the `aws_*` lines to sign with the identity LiteLLM runs as, such as an EKS pod identity.

</TabItem>
<TabItem value="api" label="Management API">

```bash showLineNumbers title="Register the index"
curl -X POST 'http://localhost:4000/vector_store/new' \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "vector_store_id": "support-docs",
    "custom_llm_provider": "opensearch",
    "vector_store_name": "support-docs",
    "litellm_params": {
      "api_base": "https://abc123.us-east-1.aoss.amazonaws.com",
      "opensearch_index_name": "support-docs",
      "litellm_embedding_model": "text-embedding-3-small"
    }
  }'
```

The store is written to the LiteLLM database and is searchable immediately, with no restart. See [Managed Vector Stores](../vector_stores/managed_vector_stores.md) for the rest of the management API.

</TabItem>
</Tabs>

## 4. Search the store

```bash showLineNumbers title="Search the index"
curl -X POST 'http://localhost:4000/v1/vector_stores/support-docs/search' \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"query": "How many days a year am I allowed to work from another country, and which form do I file?", "max_num_results": 3}'
```

```json
{
  "object": "vector_store.search_results.page",
  "search_query": "How many days a year am I allowed to work from another country, and which form do I file?",
  "data": [
    {
      "score": 0.58097684,
      "content": [
        {
          "type": "text",
          "text": "Remote work abroad policy (HR-112, revision 7): Employees may work from a country other than their home country for at most 37 calendar days per year. Requests must be filed in the Wanderdesk form at least 14 days before travel and approved by both the direct manager and the People Ops team. Days spent in transit count toward the limit."
        }
      ],
      "file_id": "1%3A0%3A1bpUh6EBHM3B89oa2RE2",
      "filename": "hr-remote-work-policy.md",
      "attributes": {"filename": "hr-remote-work-policy.md", "category": "hr"}
    },
    {
      "score": 0.42477226,
      "content": [
        {
          "type": "text",
          "text": "Office access policy (FAC-017): The office is open from 07:00 to 21:00 on weekdays. Weekend access requires a badge exception filed 48 hours in advance. Guests must be registered at the front desk kiosk and escorted at all times."
        }
      ],
      "file_id": "1%3A0%3A1rpUh6EBHM3B89oa2RE3",
      "filename": "facilities-office-access.md",
      "attributes": {"filename": "facilities-office-access.md", "category": "facilities"}
    },
    {
      "score": 0.41095334,
      "content": [
        {
          "type": "text",
          "text": "Travel expense policy (FIN-204): Hotel stays are reimbursed up to 240 USD per night in tier-1 cities and 165 USD elsewhere. Receipts must be uploaded to the Ledgerline portal within 30 days of the trip ending, and late receipts are reimbursed only with VP approval."
        }
      ],
      "file_id": "1%3A0%3A17pUh6EBHM3B89oa2RE3",
      "filename": "finance-expense-policy.md",
      "attributes": {"filename": "finance-expense-policy.md", "category": "finance"}
    }
  ]
}
```

`file_id` is the document's `_id`, `filename` is its `filename` field, and `attributes` holds the other top-level string, number, and boolean fields, without the text and embedding fields. `score` is OpenSearch's `_score` unchanged, so higher is closer, but its scale depends on the index's space type. `max_num_results` defaults to 10 and has to be between 1 and 50.

From the SDK, pass the store settings inline instead of registering the store:

```python showLineNumbers title="Search from the Python SDK"
import litellm

response = litellm.vector_stores.search(
    vector_store_id="support-docs",
    query="How many days a year am I allowed to work from another country?",
    custom_llm_provider="opensearch",
    api_base="https://abc123.us-east-1.aoss.amazonaws.com",
    litellm_embedding_model="openai/text-embedding-3-small",
    aws_role_name="arn:aws:iam::123456789012:role/litellm-opensearch",
    max_num_results=3,
)
```

`litellm.vector_stores.asearch` is the async equivalent. Once a store is registered, any LiteLLM feature that takes a vector store id can use it, including [RAG in `/chat/completions`](../completion/knowledgebase.md) through `tools: [{"type": "file_search", "vector_store_ids": ["support-docs"]}]`.

## Filters

<SinceVersion v="1.111.0" />

Search takes OpenAI's [attribute filters](https://platform.openai.com/docs/api-reference/vector-stores/search#vector_stores_search-filters). LiteLLM turns `eq` and `ne` into OpenSearch `term` queries, `in` and `nin` into `terms`, `gt`, `gte`, `lt` and `lte` into `range`, and `and` and `or` into `bool`, then puts the result inside the k-NN query as an [efficient filter](https://docs.opensearch.org/latest/vector-search/filter-search-knn/efficient-knn-filtering/), so a search still returns `max_num_results` hits after filtering.

```bash showLineNumbers title="Search this year's HR documents"
curl -X POST 'http://localhost:4000/v1/vector_stores/support-docs/search' \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "How many days a year am I allowed to work from another country, and which form do I file?",
    "max_num_results": 3,
    "filters": {"type": "and", "filters": [
      {"type": "eq", "key": "category", "value": "hr"},
      {"type": "gte", "key": "year", "value": 2026}
    ]}
  }'
```

```json
{
  "object": "vector_store.search_results.page",
  "search_query": "How many days a year am I allowed to work from another country, and which form do I file?",
  "data": [
    {
      "score": 1.6387603,
      "content": [{"type": "text", "text": "Remote work abroad policy (HR-112, revision 7): Employees may work from a country other than their home country for at most 37 calendar days per year. ..."}],
      "file_id": "1%3A0%3AI9ImyaEBTirLA3wtlZjc",
      "filename": "hr-remote-work-policy.md",
      "attributes": {"filename": "hr-remote-work-policy.md", "year": 2026, "category": "hr"}
    }
  ]
}
```

Filters match values exactly, so before each filtered search LiteLLM reads the index mapping (`GET /<index>/_mapping`) to find a field that can. A string filter needs a `keyword` field without a normalizer, or a `keyword` subfield on a text field, which is what OpenSearch's dynamic mapping creates as `<field>.keyword`. LiteLLM then queries the subfield for you. A text-only field, a number range on a string field, or a field inside a `nested` mapping answers 400 explaining why, since a query there would miss or overmatch silently.

The mapping read needs `aoss:DescribeIndex` on Serverless or `es:ESHttpGet` on a domain. Without it a filtered search answers 403 naming the permission. An index on the nmslib engine, or on OpenSearch older than 2.4, cannot filter inside a k-NN query and answers 400. With [`drop_params`](../completion/drop_params.md) on, both cases search again without the filter instead of failing, so the results come back unfiltered.

## Hybrid search

<SinceVersion v="1.111.0" />

Hybrid search runs a BM25 keyword `match` on the text field next to the k-NN query and combines the two rankings, so an exact term such as an incident id or a product code ranks first even when its embedding is not the closest. OpenSearch returns hybrid scores on different scales unless a [search pipeline with a normalization processor](https://docs.opensearch.org/latest/search-plugins/search-pipelines/normalization-processor/) combines them, so create one first:

```json showLineNumbers title="PUT /_search/pipeline/support-docs-hybrid"
{
  "phase_results_processors": [
    {
      "normalization-processor": {
        "normalization": {"technique": "min_max"},
        "combination": {"technique": "arithmetic_mean", "parameters": {"weights": [0.3, 0.7]}}
      }
    }
  ]
}
```

The weights apply in query order, keyword first and vector second. Then turn hybrid search on in the store registration, or with the **Hybrid Search** and **Search Pipeline** fields in the Admin UI:

```yaml showLineNumbers title="config.yaml"
vector_store_registry:
  - vector_store_name: support-docs
    litellm_params:
      vector_store_id: support-docs
      custom_llm_provider: opensearch
      api_base: https://abc123.us-east-1.aoss.amazonaws.com
      litellm_embedding_model: text-embedding-3-small
      opensearch_hybrid_search: true
      opensearch_search_pipeline: support-docs-hybrid
```

Searches need no change. LiteLLM sends the pipeline as the `search_pipeline` query parameter, and a filter applies to both the keyword and the vector query. `opensearch_hybrid_search` without `opensearch_search_pipeline` answers 400, or runs a plain k-NN search under `drop_params`. A store's `opensearch_search_pipeline` also runs on its plain k-NN searches, so you can set one without hybrid search to apply other search processors.

`opensearch_index_name`, `opensearch_search_pipeline` and `opensearch_hybrid_search` come only from the store registration. A search request or a `/v1/rag/query` call that sets one of them answers 400, so a key holder cannot point a search at another index or change how it ranks.

## Pass-through with per-key index permissions

<SinceVersion v="1.111.0" />

The `/opensearch` pass-through lets developers call the OpenSearch API on an index directly, with their LiteLLM key, while LiteLLM checks what each key may do on that index and signs the call with the store's AWS identity. Use it when an app needs native OpenSearch queries or has to write documents, such as an ingestion job that loads the index LiteLLM later searches. It works like the [Azure AI Search pass-through](./azure_ai/azure_ai_vector_stores_passthrough.md) and needs a proxy with a database.

### 1. Register the index

Register the store as in [step 3](#3-register-the-index-with-litellm), then give the OpenSearch index a LiteLLM index name with `POST /v1/indexes`, which only proxy admins can call. `index_name` is the name developers use in the path, `vector_store_index` is the real OpenSearch index, and `vector_store_name` is the store's name.

```bash showLineNumbers title="Register an index"
curl -X POST 'http://localhost:4000/v1/indexes' \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "index_name": "docs",
    "litellm_params": {
      "vector_store_index": "support-docs",
      "vector_store_name": "support-docs"
    }
  }'
```

The store's `vector_store_name` has to be unique, or the pass-through answers 400 because it cannot tell which store the index is on.

### 2. Grant keys or teams access

Set `allowed_vector_store_indexes` on a key or team. Each entry names a LiteLLM index and its permissions, `read`, `write`, or both. Only proxy admins can set it, since it grants access to the index.

```bash showLineNumbers title="A read-only key and a read/write key"
curl -X POST 'http://localhost:4000/key/generate' \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"allowed_vector_store_indexes": [{"index_name": "docs", "index_permissions": ["read"]}]}'

curl -X POST 'http://localhost:4000/key/generate' \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"allowed_vector_store_indexes": [{"index_name": "docs", "index_permissions": ["read", "write"]}]}'
```

`/team/new` and `/team/update` take the same field, and a key passes when either the key or its team has the permission. If the store belongs to a team, the key also needs access to the store itself, as it would to search it.

### 3. Call the index

Send OpenSearch API calls to `/opensearch/<index_name>/<api>` with the LiteLLM key as a bearer token. LiteLLM swaps in the real index name, signs the request, and returns OpenSearch's response unchanged, so `_index` in the response shows the real index.

```bash showLineNumbers title="Search, then write"
curl -X POST 'http://localhost:4000/opensearch/docs/_search' \
  -H "Authorization: Bearer $READ_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"query": {"match": {"text": "refunds"}}, "_source": ["text"]}'

curl -X POST 'http://localhost:4000/opensearch/docs/_doc' \
  -H "Authorization: Bearer $READ_WRITE_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"text": "Exchanges are free within 30 days."}'
```

The read-only key gets the search hits, and the same `_doc` write with it answers 403 with `User does not have permission to call vector store endpoint docs. Ask your administrator to add the necessary permissions to your API key/Team.` The [opensearch-py](https://docs.opensearch.org/latest/clients/python-low-level/) client works the same way when pointed at the pass-through:

```python showLineNumbers title="opensearch-py through LiteLLM"
from opensearchpy import OpenSearch, helpers

def client(key: str) -> OpenSearch:
    return OpenSearch(hosts=["http://localhost:4000/opensearch"], headers={"Authorization": f"Bearer {key}"})

writer = client(READ_WRITE_KEY)
writer.index(index="docs", body={"text": "Exchanges are free within 30 days."})
helpers.bulk(writer, [{"_index": "docs", "_source": {"text": "Returns need a receipt."}}], index="docs")

reader = client(READ_KEY)
reader.search(index="docs", body={"query": {"match": {"text": "refunds"}}, "_source": ["text"]})
```

### Search fallbacks

For backup search clusters, [define vector store fallbacks](../completion/knowledgebase.md#define-vector-store-fallbacks) in YAML. Both unified search and native `GET`/`POST /opensearch/{name}/_search` support fallback. Native backups must use the same provider/API type and physical index name; writes do not fail over.

### What each permission allows

| Permission | Method | API |
|---|---|---|
| `read` | `GET`, `HEAD` | `/<index>` |
| `read` | `GET`, `POST` | `_search`, `_count`, `_mget` |
| `read` | `GET`, `HEAD` | `_doc/<id>`, `_source/<id>` |
| `read` | `GET`, `POST` | `_explain/<id>` |
| `read` | `GET` | `_mapping` |
| `write` | `POST` | `_doc` |
| `write` | `PUT`, `POST`, `DELETE` | `_doc/<id>` |
| `write` | `PUT`, `POST` | `_create/<id>` |
| `write` | `POST` | `_update/<id>` |
| `write` | `POST`, `PUT` | `_bulk` |
| `write` | `POST` | `_delete_by_query`, `_update_by_query` |

Every other index API, such as creating or deleting the index or changing its mapping or settings, is open only to proxy admins.

A write that also reads documents needs `read` too, so a write-only key gets 403 for `_delete_by_query`, `_update_by_query`, an `_update` or bulk update with `_source` or `script`, `_source` in bulk action metadata, and `_source` query parameters on a write.

### What the pass-through refuses

A key's access is limited to the index in the URL path, so LiteLLM answers 400 for anything that could reach another index. That covers `index`, `_index`, `indices`, `indexed_shape`, `wrapper`, and `search_pipeline` anywhere in a query or `_mget` body, which rules out terms lookups and shape queries on other indexes, and the `pipeline`, `source`, and `source_content_type` query parameters. In a `_bulk` body, each action has to be `index`, `create`, `update`, or `delete`, an `_index` has to match the index in the path, and `index`, `indices`, and `pipeline` in action metadata answer 400.

Bodies have to be `application/json` or `application/x-ndjson`, in UTF-8. Any other content type answers 400.

## Settings reference

| Setting | UI label | Required | What to put in it |
|---|---|---|---|
| `vector_store_id` | Vector Store ID | Yes | The id clients search with. It is also the OpenSearch index name unless `opensearch_index_name` is set |
| `api_base` | OpenSearch Endpoint | Yes | The collection or domain endpoint, with no index in the path. See the [endpoint table](#3-register-the-index-with-litellm) |
| `litellm_embedding_model` | Embedding Model | Yes | The model that produced the vectors in the index. A different model returns plausible but wrong results, and a different dimension errors |
| `opensearch_index_name` | Index Name | No | The OpenSearch index to search, when it differs from `vector_store_id` |
| `opensearch_embedding_field` | Vector Field Name | No | Defaults to `embedding`. The `knn_vector` field the query runs against |
| `opensearch_text_field` | Text Field | No | Defaults to `text`. The field returned as each result's content, and the field hybrid search matches keywords in |
| `opensearch_search_pipeline` | Search Pipeline | No | A search pipeline to run every search through. Required for hybrid search |
| `opensearch_hybrid_search` | Hybrid Search | No | `true` to combine keyword and vector ranking. Needs `opensearch_search_pipeline` |
| `aws_region_name` | AWS Region | No | Only for an endpoint with no region in it, such as a VPC endpoint or custom domain |
| `aws_access_key_id`, `aws_secret_access_key`, `aws_session_token` | Existing Credentials | No | Static AWS credentials |
| `aws_role_name`, `aws_session_name`, `aws_external_id`, `aws_sts_endpoint` | Existing Credentials | No | An IAM role LiteLLM assumes before signing |
| `aws_web_identity_token` | Existing Credentials | No | A web identity token to assume `aws_role_name` with |
| `aws_profile_name` | Existing Credentials | No | A named profile from the AWS config files |

With no AWS settings, LiteLLM uses the default AWS credential chain of the machine it runs on. Any other `opensearch_*` setting answers 400.

## Troubleshooting

**401 asking you to set AWS credentials** means LiteLLM found no usable AWS identity. Set access keys, `aws_role_name`, or `aws_profile_name` on the store, or run LiteLLM with an AWS identity.

**403 from OpenSearch** means the identity signed correctly but is not allowed in. On Serverless, check that the collection's data access policy names the identity and grants `aoss:ReadDocument` on the index. On a domain, check the access policy and, with fine-grained access control, the role mapping.

**403 on a filtered search only** means the identity cannot read the index mapping. Grant `aoss:DescribeIndex` on Serverless or `es:ESHttpGet` on a domain, or turn on `drop_params` to search without the filter.

**400 saying the store does not support `api_key`** means the registration sets an `api_key`. OpenSearch stores always sign with SigV4, so remove it.

**Results arrive with empty text** means the hits are real but `opensearch_text_field` names a field your documents do not have. Set it to whichever field holds the prose.

**400 that filters cannot match a field exactly** means the field is mapped as text with no `keyword` subfield, or every keyword mapping on it has a normalizer. Add a `keyword` subfield and reindex, or filter on a different field.

## Not supported

OpenSearch vector stores are search-only. Create, list, retrieve, update, and delete on `/v1/vector_stores` answer 400 without sending anything to OpenSearch, so a store delete never touches the index, and LiteLLM cannot upload files or run `/rag/ingest` against OpenSearch. Create and load the index in OpenSearch, or load it through the [pass-through](#pass-through-with-per-key-index-permissions). Search also answers 400 for `ranking_options` and `rewrite_query`, which are dropped under `drop_params`, and always for `extra_body`, since merging caller JSON into the query would let any key holder run arbitrary queries.
