import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# LiteLLM Managed Vector Stores

Register an existing provider vector store (Bedrock Knowledge Base, Vertex AI Search datastore, Azure AI Search index, Milvus collection, Valkey search index, [MongoDB Vector Search index (BETA)](../providers/mongodb_vector_stores.md), ...) with LiteLLM, so that every consumer of the proxy can use it through one OpenAI-compatible API without knowing the provider or holding its credentials.

A managed vector store is a mapping, stored in `config.yaml` or in the LiteLLM database, of:

| Field | Required | Description |
|---|---|---|
| `vector_store_id` | Yes | The id clients will reference, typically the provider's own store id (Knowledge Base id, datastore id, index name) |
| `custom_llm_provider` | Yes | Which provider backend to route to, e.g. `bedrock`, `vertex_ai/search_api`, `azure_ai`, `milvus`, `mongodb` (BETA), `valkey`, `gemini`, `openai`, `pg_vector` |
| `vector_store_name` | No | Human readable name shown in the UI |
| `vector_store_description` | No | Description shown in the UI |
| `vector_store_metadata` | No | Free-form metadata object |
| `litellm_credential_name` | No | Name of a [stored credential](../proxy/config_settings.md) to authenticate with |
| `litellm_params` | No | Provider parameters, e.g. `vertex_project` and `vertex_location` for Vertex AI, `aws_region_name` for Bedrock |

Registering does not create anything on the provider. To create a new store upstream, use [`POST /v1/vector_stores`](./create.md) instead.

## Register a vector store

<Tabs>
<TabItem value="config" label="config.yaml">

```yaml showLineNumbers title="config.yaml"
vector_store_registry:
  - vector_store_name: "docs-knowledgebase"
    litellm_params:
      vector_store_id: "T37J8R4WTM"
      custom_llm_provider: "bedrock"
      aws_region_name: "us-west-2"

  - vector_store_name: "website-search"
    litellm_params:
      vector_store_id: "my-datastore_1234567890"
      custom_llm_provider: "vertex_ai/search_api"
      vertex_project: "my-gcp-project"
      vertex_location: "global"
```

`vector_store_id` and `custom_llm_provider` are required inside `litellm_params`; the proxy fails to start without them.

</TabItem>
<TabItem value="api" label="Management API">

```bash showLineNumbers title="Register a Vertex AI Search datastore"
curl -X POST 'http://localhost:4000/vector_store/new' \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "vector_store_id": "my-datastore_1234567890",
    "custom_llm_provider": "vertex_ai/search_api",
    "vector_store_name": "website-search",
    "litellm_params": {
      "vertex_project": "my-gcp-project",
      "vertex_location": "global"
    }
  }'
```

The store is written to the LiteLLM database and is immediately available to direct search; no restart needed. If the proxy started with no registered vector stores, chat retrieval for its first UI or API registration becomes available after database synchronization or a proxy restart. The response echoes the stored object with sensitive `litellm_params` values redacted.

</TabItem>
<TabItem value="ui" label="Admin UI">

In the Admin UI go to **Tools > Vector Stores > Add new vector store**, pick the provider, and fill in the store id and provider parameters. The UI calls the same `POST /vector_store/new` endpoint. Screenshots are in the [chat completions guide](../completion/knowledgebase.md).

</TabItem>
</Tabs>

## Use a registered store

Search it through the unified endpoint. LiteLLM resolves the provider and credentials from the registration:

```bash showLineNumbers title="Unified search"
curl -X POST 'http://localhost:4000/v1/vector_stores/my-datastore_1234567890/search' \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"query": "How do I authenticate?"}'
```

The response is the OpenAI `vector_store.search_results.page` shape regardless of provider. See [Search](./search.md) for all request parameters.

Or attach it to a chat completion, and LiteLLM will search the store and inject the results as context before calling the model:

```bash showLineNumbers title="RAG in /chat/completions"
curl -X POST 'http://localhost:4000/v1/chat/completions' \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "gpt-5.6",
    "messages": [{"role": "user", "content": "What is LiteLLM?"}],
    "tools": [{"type": "file_search", "vector_store_ids": ["my-datastore_1234567890"]}]
  }'
```

The request must reference the store explicitly (top-level `vector_store_ids` or inside `tools`); registering a store does not by itself change any chat completion. Details, citations, and streaming behavior: [Using Vector Stores with Chat Completions](../completion/knowledgebase.md).

### Retrieved context goes through your pre-call guardrails

A document in the store is untrusted input: it can carry an instruction aimed at the model (indirect prompt injection through RAG). So every guardrail that runs `pre_call` on the request (`default_on: true` in the config, or requested through `guardrails` on the request, key, or team) also scans each store's retrieved context before it is injected into the prompt, one scan per store. A guardrail that blocks returns the same 400 it would return for the user's own message, with `guardrail_name` and `guardrail_mode` in the error, and the model is never called. A guardrail that masks rewrites the injected context instead. Guardrails set to `during_call` or `post_call` keep seeing the request and the response as before and are not run on the retrieved context

```json title="A blocked chunk, with the Azure Prompt Shield guardrail from the guardrails docs"
{
  "error": {
    "message": "Violated Azure Prompt Shield guardrail policy",
    "type": "invalid_request_error",
    "param": null,
    "code": "400",
    "provider_specific_fields": {
      "error": "Violated Azure Prompt Shield guardrail policy",
      "detection_message": "Attack detected: {'attackDetected': True}",
      "guardrail_name": "azure-prompt-shield",
      "guardrail_mode": "pre_call"
    }
  }
}
```

A guardrail that fails while scanning the retrieved context fails the request too, rather than injecting the context unscanned

## Management API reference

All endpoints require a LiteLLM key (`Authorization: Bearer ...`). Access can be restricted with `general_settings.disable_vector_stores_for_internal_users` and `allow_vector_stores_for_team_admins`; proxy admins always have access.

| Endpoint | Method | Body / params |
|---|---|---|
| `/vector_store/new` | POST | The fields from the table above |
| `/vector_store/list` | GET | `page`, `page_size` (also available as `/v1/vector_store/list`) |
| `/vector_store/info` | POST | `{"vector_store_id": "..."}` |
| `/vector_store/update` | POST | `vector_store_id` plus any of `custom_llm_provider`, `vector_store_name`, `vector_store_description`, `vector_store_metadata` |
| `/vector_store/delete` | POST | `{"vector_store_id": "..."}` |

`GET /vector_store/list` returns `{"object": "list", "data": [...], "total_count": n, "current_page": n, "total_pages": n}`. Stores registered via the API or UI are stamped with the creating key's `team_id` and `user_id`; stores created with a team are scoped to that team in list and search results (proxy admins see everything).

## Restricting keys and teams to specific stores

Set `object_permission.vector_stores` when creating a key or team to control which store ids its LLM requests may reference:

```bash showLineNumbers title="Key limited to one store"
curl -X POST 'http://localhost:4000/key/generate' \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "object_permission": {"vector_stores": ["my-datastore_1234567890"]}
  }'
```

A request through that key using any other registered store id in `vector_store_ids` is rejected. An empty or unset list means the key is not restricted, unless [`vector_store_deny_by_default`](#deny-vector-stores-by-default) is on. The same field works on teams and users.

## Deny vector stores by default

Without restrictions, any key the proxy accepts can query any store id the proxy's provider credentials can reach, including a Bedrock Knowledge Base id that was never registered with LiteLLM. To make every store opt-in, turn on `vector_store_deny_by_default`:

```yaml showLineNumbers title="config.yaml"
general_settings:
  vector_store_deny_by_default: true
```

The setting defaults to `false`. With it on, every store id a request references, through `/v1/rag/query` or `/rag/query` (`retrieval_config.vector_store_id`), a `/v1/vector_stores/{vector_store_id}/...` path, a top-level `vector_store_ids`, or `vector_store_ids` in a `file_search` tool, must be listed in `object_permission.vector_stores` of each identity the request resolves to. A request naming several stores needs a grant for every one of them. A `vector_store_ids` value that is not a list of strings is rejected with `400`

| Caller | Grants required |
|---|---|
| Virtual key without a team | The key |
| Virtual key with a team | The key and its team |
| Team member without a virtual key (JWT or `lite login` session) | The team the request resolved to |
| User without a virtual key or team | The user |

A missing permission record, a `null` list, and an empty list all grant nothing. A user's personal grants only count when the request has no virtual key and no team, so they never widen or narrow a key or team request, and grants on other teams the user belongs to are ignored. If a key names a team that cannot be loaded, the request is denied rather than treated as a key without a team. Denied requests fail before any provider call with `key_vector_store_access_denied`, `team_vector_store_access_denied`, or `user_vector_store_access_denied`

For a team key, grant the store on both objects:

```bash showLineNumbers title="Team and key both grant the store"
curl -X POST 'http://localhost:4000/team/new' \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"team_alias": "support", "object_permission": {"vector_stores": ["YOUR_KNOWLEDGE_BASE_ID"]}}'

curl -X POST 'http://localhost:4000/key/generate' \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"team_id": "<team_id from above>", "object_permission": {"vector_stores": ["YOUR_KNOWLEDGE_BASE_ID"]}}'
```

Registering a store does not grant access to it, and a provider-native store that is granted explicitly can stay unregistered. The master key is not restricted. Dashboard login sessions are not covered by this setting yet

Setting the flag back to `false` restores the earlier behavior, where an empty or unset list means unrestricted. It does not turn off the existing check: a nonempty `vector_stores` list that leaves out the requested store is still rejected
