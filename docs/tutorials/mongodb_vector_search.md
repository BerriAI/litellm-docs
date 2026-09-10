# Chat with sample documents in MongoDB (BETA)

Create three fictional policy documents, index them in MongoDB Atlas, test semantic search in the LiteLLM Admin UI, and use the results in a chat completion. The sample text below was written for this tutorial and does not describe real company policies.

:::warning BETA
MongoDB vector stores are a **BETA** feature in LiteLLM. The integration searches existing MongoDB indexes. This tutorial prepares documents using the MongoDB Python driver before registering the index with LiteLLM. See the [integration guide](../providers/mongodb_vector_stores.md) for general setup and limitations.
:::

## Before you begin

You need:

- An Atlas cluster with Vector Search and capacity for an additional search index, a database user allowed to create and read the demo collection, and permission to create the index.
- A connection string and network access to the cluster from both your setup script and the MongoDB sidecar.
- A running LiteLLM proxy with `litellm[proxy]` installed, a database configured for saved registrations, and access to the Admin UI.
- An OpenAI API key for the embedding and chat models used in this example. Other providers can be used when both document and query embeddings use the same model and dimensions.

## Add the models to LiteLLM

Under **Models** in the LiteLLM Admin UI, add these deployments with your OpenAI API key, or reuse equivalent deployments already on your proxy:

| Purpose | Provider | Provider model | Name on the proxy |
|---|---|---|---|
| Embed documents and search queries | OpenAI | `text-embedding-3-small` | `text-embedding-3-small` |
| Generate chat answers | OpenAI | `gpt-4o-mini` | `gpt-4o-mini` |

For configuration files, the LiteLLM model identifiers are `openai/text-embedding-3-small` and `openai/gpt-4o-mini`. Set `model_info.mode: embedding` on the embedding deployment so the UI identifies it as an embedding model. Use the embedding model's default **1536 dimensions** for this example.

## Prepare the sample documents

Install the dependencies in a separate setup environment. PyMongo is used to prepare the sample data; it is not a dependency of the LiteLLM proxy or SDK:

```bash
python -m venv .venv-mongodb-setup
source .venv-mongodb-setup/bin/activate
pip install openai pymongo
```

Set `MONGODB_CONNECTION_STRING` to your cluster's full URI and `LITELLM_API_KEY` to a LiteLLM key with access to the embedding model. Set `LITELLM_BASE_URL` if your proxy uses a different address:

```bash
export MONGODB_CONNECTION_STRING='mongodb+srv://<database-user>:<password>@<cluster-hostname>/'
export LITELLM_API_KEY='<litellm-api-key>'
export LITELLM_BASE_URL='http://localhost:4000/v1'
```

Use the database user's credentials, which are separate from your Atlas website login. Percent-encode special characters in the username and password.

Save this as `prepare_documents.py` and run it with `python prepare_documents.py`. It embeds the original sample text through the proxy's embeddings API and inserts the documents using PyMongo. It stops if the demo collection already exists, so it does not overwrite existing data.

```python title="prepare_documents.py"
import os

from openai import OpenAI
from pymongo import MongoClient

samples = [
    {
        "_id": "projector-booking",
        "text": "For this fictional demo, projectors may be reserved for 45 minutes. Include reservation code DEMO-7321 with every projector booking.",
    },
    {
        "_id": "desk-reservation",
        "text": "For this fictional demo, standing desks can be reserved for two hours. Cancel a desk reservation at least 15 minutes before it starts.",
    },
    {
        "_id": "visitor-badges",
        "text": "For this fictional demo, visitors collect badges at the welcome desk. Return each badge before leaving the building.",
    },
]

with MongoClient(os.environ["MONGODB_CONNECTION_STRING"]) as mongo:
    database = mongo["litellm_docs_demo"]
    if "policies" in database.list_collection_names():
        raise RuntimeError("Demo collection already exists. Use a fresh database for this tutorial.")

    with OpenAI(
        base_url=os.environ.get("LITELLM_BASE_URL", "http://localhost:4000/v1"),
        api_key=os.environ["LITELLM_API_KEY"],
    ) as client:
        embeddings = client.embeddings.create(
            model="text-embedding-3-small",
            input=[document["text"] for document in samples],
        )

    for item in embeddings.data:
        samples[item.index]["embedding"] = item.embedding

    collection = database.create_collection("policies")
    collection.insert_many(samples)
    print("Inserted three sample documents into litellm_docs_demo.policies.")
```

Document insertion is performed by the setup script, outside LiteLLM's vector store API. LiteLLM's MongoDB integration does not support `/rag/ingest` or vector store file upload.

## Prepare the Atlas index

In Atlas, create a **Vector Search** index on `litellm_docs_demo.policies` named `litellm_demo_policy_idx`, using this definition:

```json title="Vector Search index definition"
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 1536,
      "similarity": "cosine"
    }
  ]
}
```

Wait until it is **READY** and queryable. If you change the database, collection, or index name, use those values throughout the remaining steps.

## Deploy the MongoDB sidecar

Follow the [sidecar deployment guide](../providers/mongodb_vector_stores.md#deploy-the-sidecar) for Docker, Compose, or Kubernetes. Set the sidecar's `MONGODB_CONNECTION_STRING` to the URI used by the setup script, and set `MONGODB_SIDECAR_API_KEY` to a strong secret shared with LiteLLM. The URI and any MongoDB TLS files stay in the sidecar.

For a proxy running on the Docker host, use `http://127.0.0.1:8080` as the Sidecar URL. The Compose example shares LiteLLM's network namespace and uses the same loopback URL. Remote sidecars require HTTPS. Confirm the sidecar's `/health/readiness` endpoint returns HTTP 200 before registering the index.

## Register the index in the Admin UI

Open **Tools > Vector Stores > Manage Vector Stores > + Add Vector Store**, then enter:

| UI field | Value |
|---|---|
| Provider | MongoDB (BETA) |
| Vector Store Name | `MongoDB Demo Policies` |
| Vector Store ID | `litellm_demo_policy_idx` |
| Sidecar URL | The sidecar address reachable from your LiteLLM proxy. |
| Sidecar API Key | The sidecar's `MONGODB_SIDECAR_API_KEY` value. |
| Database | `litellm_docs_demo` |
| Collection | `policies` |
| Embedding Model | `text-embedding-3-small` |
| Vector Field Name | `embedding` |
| Text Field | `text` |
| Candidates Considered | Leave blank. |

Click **Create**. If this index is already registered on your proxy, select the existing registration for the next step. Keep the query embedding model the same as the model used in the setup script; the chat model can be changed independently.

## Test search

In **Test Vector Store**, select **MongoDB Demo Policies** and run:

```text
How long can I book a projector, and which reservation code should I use?
```

Look for the document with ID `projector-booking`. Its text should contain **45 minutes** and **DEMO-7321**. Expand the result to inspect the retrieved text. Similarity scores can vary.

You can run the same search through the API. Use a LiteLLM key with access to this store; replace `http://localhost:4000` if your proxy uses a different address:

```bash
curl -X POST 'http://localhost:4000/v1/vector_stores/litellm_demo_policy_idx/search' \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "How long can I book a projector, and which reservation code should I use?",
    "max_num_results": 3
  }'
```

This checks the connection, query embedding, index, and returned text together. Use a question about the sample documents to evaluate relevance.

## Use the documents in a chat completion

If this is the first vector store registered on a running proxy, wait for the proxy's database sync or restart it before testing chat. See the [first-registration note](../providers/mongodb_vector_stores.md#connect-your-index).

Use a LiteLLM key with access to both the store and the chat model:

```bash
curl -X POST 'http://localhost:4000/v1/chat/completions' \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [
      {
        "role": "system",
        "content": "Use the provided demo policies to answer the question. If there is no relevant context, say you do not know."
      },
      {
        "role": "user",
        "content": "How long can I book a projector, and which reservation code should I use?"
      }
    ],
    "tools": [
      {
        "type": "file_search",
        "vector_store_ids": ["litellm_demo_policy_idx"]
      }
    ]
  }'
```

Verify both parts of the response:

- `choices[0].message.content` answers **45 minutes** and **DEMO-7321**.
- `choices[0].message.provider_specific_fields.search_results` includes the `projector-booking` document and its text.

A successful chat response alone does not prove retrieval worked. Check the source results to confirm that MongoDB supplied the context. The [general chat guide](../providers/mongodb_vector_stores.md#use-mongodb-in-chat-completions) includes a Python example that prints these results.

For your own collection, replace the database, collection, index, field names, and embedding model using the [MongoDB integration guide](../providers/mongodb_vector_stores.md#connect-your-index).
