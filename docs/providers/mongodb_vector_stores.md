import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# MongoDB - Vector Store (BETA)

:::warning BETA
The MongoDB vector store integration is a **BETA** feature. It supports searching existing MongoDB Vector Search indexes through the optional [LiteLLM MongoDB sidecar](https://github.com/BerriAI/litellm-mongodb). Prepare your collections, indexes, and embedded documents before connecting them to LiteLLM.
:::

Use documents in MongoDB Atlas or a self-managed MongoDB deployment as context for chat completions. LiteLLM embeds the user's query, searches your index, and passes the retrieved text to your chat model. You can also search directly to retrieve documents and similarity scores without generating an answer.

- [Connect your index](#connect-your-index) through the Admin UI, configuration file, or management API.
- [Use MongoDB in chat completions](#use-mongodb-in-chat-completions) with curl or the OpenAI Python SDK.
- [Follow a worked example](../tutorials/mongodb_vector_search.md) using original fictional policy documents in Atlas.

## Before you begin

You need:

- **A MongoDB deployment with Vector Search enabled.** For self-managed deployments, follow MongoDB's [deployment guide](https://www.mongodb.com/docs/search/self-managed/current/) and [version compatibility requirements](https://www.mongodb.com/docs/search/self-managed/current/deployment/compatibility-requirements/). A MongoDB server without Vector Search cannot serve these queries.
- **A populated collection and a queryable Vector Search index.** Documents must contain both readable text and stored embeddings. If you need to create an index, see MongoDB's [Vector Search index guide](https://www.mongodb.com/docs/vector-search/indexes/vector-search-type/).
- **A connection string reachable from the sidecar.** The database user needs permission to search the collection and list its search indexes. Allow the sidecar host through your database's network rules.
- **The embedding model used for your documents.** Query embeddings must use the same model and output dimensions as the stored vectors. A different model with the same dimensions can return irrelevant results without an error.

Install LiteLLM normally. The MongoDB driver runs only in the separate sidecar:

```bash
pip install 'litellm[proxy]'
```

For direct Python SDK use, install `litellm`, deploy the sidecar, then follow [Search with the Python SDK](#search-with-the-python-sdk). Neither the SDK nor the standard LiteLLM images need PyMongo. LiteLLM does not start or install the sidecar automatically.

:::note RC configuration change
If you tried MongoDB in `v1.101.0-rc.1`, move `mongodb_connection_string` to the sidecar's `MONGODB_CONNECTION_STRING` environment variable. Replace it in your LiteLLM registration with `api_base` and `api_key`. Existing MongoDB data and indexes stay in place; application search and chat requests stay the same. This integration remains BETA.
:::

### Choose your models

For proxy requests, use a configured LiteLLM proxy. Registration through the UI or management API also requires a proxy database. Add your models under **Models** in the Admin UI or in your existing `model_list` configuration:

| Model | Used for | Requirement |
|---|---|---|
| Embedding model | Converting each search query into a vector | Must match the model and dimensions used to embed your collection. |
| Chat model | Generating an answer from retrieved text | A LiteLLM-supported chat model. Only needed for chat completions. |

Configure credentials and any provider-specific settings on each model deployment. MongoDB does not require OpenAI: choose the embedding provider that matches your stored vectors and the chat provider you want to use. The [sample-document example](../tutorials/mongodb_vector_search.md) shows one setup using OpenAI.

## Deploy the sidecar

Run one sidecar per MongoDB connection string. Multiple LiteLLM registrations can use that sidecar for databases, collections, and indexes accessible to its MongoDB user. The sidecar runs the official MongoDB driver; LiteLLM continues to generate query embeddings through your configured model and route chat requests normally.

Set `MONGODB_CONNECTION_STRING` and a strong `MONGODB_SIDECAR_API_KEY` in the sidecar's deployment secrets. Give LiteLLM the same sidecar key. Keep MongoDB credentials and TLS files in the sidecar environment.

<Tabs>
<TabItem value="docker" label="Docker">

For a LiteLLM proxy or SDK running on the same host:

```bash
docker run --rm --name mongodb-sidecar \
  -p 127.0.0.1:8080:8080 \
  -e MONGODB_CONNECTION_STRING \
  -e MONGODB_SIDECAR_API_KEY \
  ghcr.io/berriai/litellm-mongodb:v0.1.0-beta.1
```

Use `http://127.0.0.1:8080` as the Sidecar URL. Pin the release tag or digest. The image supports Linux amd64 and arm64 and runs as user `10001:10001`.

</TabItem>
<TabItem value="compose" label="Docker Compose">

Add this optional service to the Compose project running LiteLLM:

```yaml
services:
  mongodb-sidecar:
    image: ghcr.io/berriai/litellm-mongodb:v0.1.0-beta.1
    network_mode: service:litellm
    environment:
      MONGODB_CONNECTION_STRING: ${MONGODB_CONNECTION_STRING:?required}
      MONGODB_SIDECAR_API_KEY: ${MONGODB_SIDECAR_API_KEY:?required}
    restart: unless-stopped
```

Replace `litellm` in `network_mode` with the name of your existing LiteLLM service, and pass `MONGODB_SIDECAR_API_KEY` to that service. Sharing the network namespace lets LiteLLM use `http://127.0.0.1:8080` as `api_base`. No host port is needed for the sidecar in this deployment. For separate network namespaces, expose the sidecar through HTTPS instead.

</TabItem>
<TabItem value="helm" label="Kubernetes / Helm">

Create a Kubernetes Secret named `mongodb-sidecar` in the LiteLLM namespace with keys `connection-string` and `api-key`. For the LiteLLM `litellm-helm` chart, add the sidecar through its existing `extraContainers` setting:

```yaml title="values-mongodb.yaml"
extraEnvVars:
  - name: MONGODB_SIDECAR_API_KEY
    valueFrom:
      secretKeyRef:
        name: mongodb-sidecar
        key: api-key
extraContainers:
  - name: mongodb-sidecar
    image: ghcr.io/berriai/litellm-mongodb:v0.1.0-beta.1
    ports:
      - name: mongodb-http
        containerPort: 8080
    env:
      - name: MONGODB_CONNECTION_STRING
        valueFrom:
          secretKeyRef:
            name: mongodb-sidecar
            key: connection-string
      - name: MONGODB_SIDECAR_API_KEY
        valueFrom:
          secretKeyRef:
            name: mongodb-sidecar
            key: api-key
    securityContext:
      runAsNonRoot: true
      runAsUser: 10001
      runAsGroup: 10001
      allowPrivilegeEscalation: false
      capabilities:
        drop: [ALL]
    livenessProbe:
      httpGet:
        path: /health/liveness
        port: mongodb-http
    startupProbe:
      httpGet:
        path: /health/liveness
        port: mongodb-http
      failureThreshold: 30
      periodSeconds: 2
```

Merge these values with your existing chart configuration, preserving any existing extra environment variables and containers. Set the MongoDB registration's `api_base` to `http://127.0.0.1:8080`; containers in the same Pod share the network. No additional Service or mandatory chart dependency is needed.

Monitor `/health/readiness` for MongoDB connectivity. A MongoDB readiness probe on a container in the LiteLLM Pod would remove the entire Pod from service during a MongoDB outage, affecting other providers. Use a separate sidecar Deployment and Service if MongoDB needs independent readiness, scaling, or availability.

</TabItem>
</Tabs>

Each secret can alternatively be mounted read-only and referenced with `MONGODB_CONNECTION_STRING_FILE` or `MONGODB_SIDECAR_API_KEY_FILE`. Set either the value or its file variable, never both. Files must be readable by container user 10001. For MongoDB TLS, include options such as `tlsCAFile` or `tlsCertificateKeyFile` in the URI and mount the files at those paths inside the sidecar. Certificate verification remains enabled by default.

LiteLLM requires HTTPS for remote sidecars. HTTP is accepted only for a literal loopback IP, such as `127.0.0.1` or `[::1]`, when both processes share a host or network namespace. This keeps the sidecar bearer key and query data off unencrypted network hops. For a separate sidecar host or Deployment, use an HTTPS reverse proxy with a certificate trusted by LiteLLM; `api_base` can include the proxy's path prefix, without `/v1`. Keep the service's HTTP port private behind that proxy.

Check `/health/liveness` for the HTTP process and `/health/readiness` for a bounded MongoDB ping. See the [sidecar operations guide](https://github.com/BerriAI/litellm-mongodb#operations) for timeouts, connection pooling, and releases.

## Connect your index

Register the existing index once, then reference it by ID in requests. Replace all values in angle brackets with your deployment's values.

| Value | Where to find it |
|---|---|
| `<index-name>` | The exact name of your MongoDB Vector Search index. This becomes the LiteLLM `vector_store_id`. |
| `<database-name>` / `<collection-name>` | The database and collection containing your documents. |
| `<vector-field>` | The vector `path` in the index definition. |
| `<text-field>` | The document field containing readable text, such as `text` or `metadata.body`. |
| `<embedding-model-name>` | The name of the embedding model registered on your LiteLLM proxy. |
| `<chat-model-name>` | The name of the chat model registered on your LiteLLM proxy. |

The index must be **READY** and queryable before searching. A registration's display name is independent of its ID. Saving a registration does not create an index, ingest documents, or verify that the connection works.

Choose one registration method:

<Tabs>
<TabItem value="ui" label="Admin UI">

1. Open **Tools > Vector Stores**, select **Manage Vector Stores**, and click **+ Add Vector Store**.
2. Select **MongoDB (BETA)** as the provider. This connector also supports self-managed MongoDB with Vector Search.
3. Enter the exact index name as **Vector Store ID**, then fill in **Sidecar URL**, **Sidecar API Key**, **Database**, and **Collection**.
4. Select the registered **Embedding Model**. Set **Vector Field Name** and **Text Field** to the fields in your collection. Leave **Candidates Considered** blank to use the default.
5. Click **Create**, then use **Test Vector Store** to search for something you know is in your documents. Inspect the returned text to verify the connection and field mapping.

Use **Manage Vector Stores** for registration. The separate **Create Vector Store** flow creates a new store on the provider and does not support MongoDB.

</TabItem>
<TabItem value="config" label="config.yaml">

Set `MONGODB_SIDECAR_API_KEY` in the proxy's environment to the key configured on the sidecar. Use a Sidecar URL reachable from the proxy process.

Add this registration to your existing proxy configuration, keeping your `model_list` and authentication settings:

```yaml showLineNumbers title="config.yaml"
vector_store_registry:
  - vector_store_name: "<display-name>"
    litellm_params:
      vector_store_id: "<index-name>"
      custom_llm_provider: mongodb
      api_base: http://127.0.0.1:8080
      api_key: os.environ/MONGODB_SIDECAR_API_KEY
      mongodb_database: "<database-name>"
      mongodb_collection: "<collection-name>"
      mongodb_text_field: "<text-field>"
      mongodb_embedding_field: "<vector-field>"
      litellm_embedding_model: "<embedding-model-name>"
```

Start or restart the proxy with the updated config:

```bash
litellm --config config.yaml --port 4000
```

Environment variables must be available to the running proxy process. For Docker, pass them with `--env-file` or `-e`; a host's `.env` file is not automatically available inside the container.

</TabItem>
<TabItem value="api" label="Management API">

On a proxy configured with a database, set `LITELLM_API_KEY` to a LiteLLM key with permission to manage vector stores. Replace the proxy URL if needed:

```bash showLineNumbers title="Register an existing MongoDB index"
curl -X POST 'http://localhost:4000/vector_store/new' \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "vector_store_id": "<index-name>",
    "custom_llm_provider": "mongodb",
    "vector_store_name": "<display-name>",
    "litellm_params": {
      "api_base": "http://127.0.0.1:8080",
      "api_key": "<sidecar-api-key>",
      "mongodb_database": "<database-name>",
      "mongodb_collection": "<collection-name>",
      "mongodb_text_field": "<text-field>",
      "mongodb_embedding_field": "<vector-field>",
      "litellm_embedding_model": "<embedding-model-name>"
    }
  }'
```

The registration is stored in the LiteLLM database. See [Managed Vector Stores](../vector_stores/managed_vector_stores.md) for management and access controls.

</TabItem>
</Tabs>

:::note First registration through the UI or management API
If the proxy started without any registered vector stores, direct search can work before chat retrieval is ready. Wait for the proxy's database sync or restart it after saving the first store before using `file_search` in chat completions. Loading a store through `config.yaml` at startup avoids this initial delay.
:::

## Use MongoDB in chat completions

Call `/v1/chat/completions` with a `file_search` tool referencing your registered index ID. LiteLLM retrieves the context and calls your chat model in the same request.

Set `LITELLM_API_KEY` to a LiteLLM key with access to the chat model and registered vector store. Replace the proxy URL, model name, index name, and question below with your own values.

<Tabs>
<TabItem value="chat-curl" label="curl">

```bash showLineNumbers title="Chat with your MongoDB documents"
curl -X POST 'http://localhost:4000/v1/chat/completions' \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "<chat-model-name>",
    "messages": [
      {
        "role": "system",
        "content": "Answer using the provided context. If the context does not contain the answer, say you do not know."
      },
      {
        "role": "user",
        "content": "<question-about-your-documents>"
      }
    ],
    "tools": [
      {
        "type": "file_search",
        "vector_store_ids": ["<index-name>"]
      }
    ]
  }'
```

</TabItem>
<TabItem value="chat-python" label="OpenAI Python SDK">

Point the client at your LiteLLM proxy and pass LiteLLM's `file_search` tool through `extra_body`:

```python showLineNumbers title="Chat completions through LiteLLM"
import os

from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:4000/v1",
    api_key=os.environ["LITELLM_API_KEY"],
)

response = client.chat.completions.create(
    model="<chat-model-name>",
    messages=[
        {
            "role": "system",
            "content": "Answer using the provided context. If the context does not contain the answer, say you do not know.",
        },
        {"role": "user", "content": "<question-about-your-documents>"},
    ],
    extra_body={
        "tools": [{"type": "file_search", "vector_store_ids": ["<index-name>"]}]
    },
)

message = response.model_dump()["choices"][0]["message"]
print(message["content"])

# Inspect the documents retrieved for this answer.
for page in (message.get("provider_specific_fields") or {}).get("search_results", []):
    for result in page["data"]:
        print(result["file_id"], result["score"], result["content"])
```

</TabItem>
</Tabs>

LiteLLM embeds the final user message with the store's configured embedding model, runs MongoDB's `$vectorSearch` aggregation, and adds the retrieved text to the conversation. The chat model then generates the answer in `choices[0].message.content`.

`file_search` on this endpoint is handled by LiteLLM before calling the chat model. Your application does not need to execute a tool call or send a separate search request. Use the exact index name in `vector_store_ids`, not the registration's display name.

### Verify retrieval

Successful retrieval returns its documents at `choices[0].message.provider_specific_fields.search_results`. Inspect their text and scores to confirm that the answer has relevant source material. See [Accessing Search Results](../completion/knowledgebase.md#accessing-search-results-citations) for more examples.

A successful chat response alone does not prove that MongoDB retrieval worked: chat can complete even if retrieval fails. If sources are missing, run a [direct search](#search-the-index-directly) to diagnose the connection independently.

## Search the index directly

Use direct search when you want to retrieve documents without generating a chat response. Set `LITELLM_API_KEY` to a LiteLLM key with access to the registered store.

```bash showLineNumbers title="Search through the proxy"
curl -X POST 'http://localhost:4000/v1/vector_stores/<index-name>/search' \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "<question-about-your-documents>",
    "max_num_results": 3
  }'
```

Results appear in the response's `data` array:

| Response field | Meaning |
|---|---|
| `content` | Text read from your configured `mongodb_text_field`. |
| `file_id` / `filename` | The MongoDB document's `_id` converted to a string. |
| `score` | MongoDB's `vectorSearchScore`. Higher values indicate more similar results; the score is not an answer-confidence percentage. |

`max_num_results` defaults to `10` and accepts values from `1` to `50`. Use a query relevant to known documents to check search quality. See the [sample-document tutorial](../tutorials/mongodb_vector_search.md#test-search) for a concrete query and expected result.

## Search with the Python SDK

Pass the sidecar settings directly to `litellm.vector_stores.search`; proxy registration is not required. Set `MONGODB_SIDECAR_API_KEY` and your embedding provider's credentials in the SDK process's environment. The MongoDB URI belongs in the separately deployed sidecar.

```python showLineNumbers title="Search without a proxy"
import os

import litellm

response = litellm.vector_stores.search(
    vector_store_id="<index-name>",
    query="<question-about-your-documents>",
    custom_llm_provider="mongodb",
    api_base="http://127.0.0.1:8080",
    api_key=os.environ["MONGODB_SIDECAR_API_KEY"],
    mongodb_database="<database-name>",
    mongodb_collection="<collection-name>",
    mongodb_text_field="<text-field>",
    mongodb_embedding_field="<vector-field>",
    litellm_embedding_model="<provider>/<embedding-model>",
    max_num_results=3,
)

print(response)
```

For async usage, call `await litellm.vector_stores.asearch(...)` with the same arguments. In direct SDK calls, use the provider's embedding model name. On the proxy, use the registered embedding model name.

## Settings reference

Pass these in the registered store's `litellm_params`, or as keyword arguments in a direct SDK search.

| Setting | Required | Description |
|---|---|---|
| `vector_store_id` | Yes | Exact MongoDB Vector Search index name. |
| `custom_llm_provider` | Yes | Set to `mongodb`. |
| `api_base` | Yes | Sidecar HTTPS origin or reverse-proxy path prefix. HTTP is supported only for literal loopback IPs. Do not append `/v1`. |
| `api_key` | Yes | Sidecar bearer key. Can also be supplied through `MONGODB_SIDECAR_API_KEY` in the LiteLLM environment. |
| `mongodb_database` | Yes | Database containing the collection. Required even if the URI contains a database name. |
| `mongodb_collection` | Yes | Collection containing the documents and vectors. |
| `litellm_embedding_model` | Yes | Model used to embed queries. Must match the model used for stored vectors. |
| `mongodb_embedding_field` | No | Vector field covered by the index. Defaults to `embedding`. |
| `mongodb_text_field` | No | Field containing readable text. Defaults to `text`; supports dotted paths such as `metadata.body`. |
| `mongodb_num_candidates` | No | Number of candidates considered before returning the top results. Defaults to `max(100, 10 * max_num_results)`. An explicit value must be at least `max_num_results` and at most `10000`. Higher values can improve recall at the cost of latency. |
| `litellm_embedding_config` | No | Additional embedding-call arguments, such as `dimensions`, `api_key`, or `api_base`. On the proxy, configure these on the embedding model deployment when possible. |

The search `query` must be non-empty and no longer than 32,000 characters. A list of strings is joined with spaces and embedded as a single query.

## Troubleshooting

| Symptom | What to check |
|---|---|
| Old configuration asks for `pymongo` or `mongodb_connection_string` | Use the LiteLLM release containing the BETA sidecar adapter, deploy the sidecar, and configure `api_base` and `api_key`. |
| HTTP 401: sidecar authentication failed | Match LiteLLM's `api_key` to the sidecar's `MONGODB_SIDECAR_API_KEY`. This is separate from your MongoDB password and LiteLLM client key. |
| HTTP 400: missing or non-queryable index | Check the exact database, collection, and index name. Wait for the index to become READY and queryable. |
| HTTP 400: dimension mismatch or vector field not indexed | Match the query embedding model and dimensions to your documents, and `mongodb_embedding_field` to the index's `path`. |
| HTTP 400: none of the matched documents has the text field | Set `mongodb_text_field` to the field containing readable text, including its dotted path if nested. |
| HTTP 400: credentials rejected | Check the sidecar's URI credentials, authentication database, and database user's permissions. |
| Atlas reports `bad auth : authentication failed` (code `8000`) | Verify the database user's password and cluster in the saved connection string. This is an authentication failure before index search. The database user is separate from your Atlas website login; see [Atlas connection troubleshooting](https://www.mongodb.com/docs/atlas/troubleshoot-connection/#authentication-to-the-cluster-failed). |
| Sidecar fails to start: invalid URI or missing secret | Check the sidecar environment and secret-file mounts. Percent-encode special characters in URI credentials; for example, `p@ss/word` becomes `p%40ss%2Fword`. |
| TLS file cannot be read | Ensure `tlsCAFile` and `tlsCertificateKeyFile` point to files readable by the sidecar process. In a container, use paths inside the sidecar container. |
| HTTP 408: deployment or query timed out | Check hostname resolution and connectivity. On Atlas, check the IP access list and whether the cluster is paused. On self-managed deployments, check the host, port, and firewall. |
| HTTP 503: connection dropped or refused | Check that the sidecar is running and its URL is reachable, then check MongoDB connectivity and TLS settings. Retry after a node restart or replica set failover. |
| Chat returns `Invalid value: 'file_search'` after registering the first store | Wait for database sync or restart the proxy to load the registration before retrying. Confirm `vector_store_ids` contains the registered index ID. |

Timeouts and dropped connections return retryable errors (`408` and `503`). After connectivity is restored, searches can resume without restarting LiteLLM.

## BETA limitations

- **Search only:** create collections and indexes, generate document embeddings, and ingest documents outside LiteLLM. MongoDB does not support LiteLLM's vector store creation, file management, or `/rag/ingest` APIs.
- **No search filtering or query rewriting:** `filters`, `ranking_options`, and `rewrite_query` are rejected, including `rewrite_query: false`. Provider-specific `mongodb_filter` is also unsupported and rejected.
- **No automatic embedding through MongoDB:** configure `litellm_embedding_model`; MongoDB's automated embedding integration is not used.
- **First registration can take time to reach chat requests:** when a running proxy has no vector store registry yet, its first UI or API registration needs database synchronization or a restart before `file_search` works in chat completions.
