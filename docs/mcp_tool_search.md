import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# MCP Tool Search

Swap the full MCP catalog for a fixed set of virtual tools (`mcp_tool_search`, `mcp_tool_call`, `agent_search`, `skill_search`) so a key with hundreds of tools available only ever exposes four on `tools/list`. The LLM searches by keyword by default, or by meaning once an embedding model is configured (see [Ranking](#ranking)), gets back the ranked matches, then calls the discovered tool by name. For clients that should never receive full tool schemas up front, [`/mcp/proxy`](#schema-discovery-endpoint-mcpproxy) serves a separate three-tool surface that searches, fetches one schema, and calls by opaque ID. `agent_search` does the same for the [A2A agent registry](./a2a.md#search-the-registry) and `skill_search` for the [LiteLLM-hosted skill registry](./skills.md#semantic-search-over-litellm-hosted-skills), both ranked by embeddings instead of keywords.

:::info[Related Documentation]
- [MCP Overview](./mcp.md)
- [MCP Permission Management](./mcp_control.md) for the underlying `object_permission` model
- [MCP Semantic Filter](./mcp_semantic_filter.md) for the embeddings-based alternative applied at the `/v1/responses` layer
:::

## Quick start

Generate a key with `mcp_tool_search_enabled: true` under `object_permission`, pair it with `mcp_servers` (or `mcp_access_groups`) so search has something to look through, then discover and call.

```bash title="1. Create a key with tool search enabled" showLineNumbers
curl -X POST http://localhost:4000/key/generate \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "object_permission": {
      "mcp_tool_search_enabled": true,
      "mcp_servers": ["github", "slack"]
    }
  }'
```

```console title="2. tools/list returns only the virtual tools" showLineNumbers
$ curl -s http://localhost:4000/mcp-rest/tools/list \
    -H "Authorization: Bearer $KEY" | jq '[.tools[].name]'
["mcp_tool_search", "mcp_tool_call", "agent_search", "skill_search"]
```

```console title="3. Search discovers the real tools" showLineNumbers
$ curl -s -X POST http://localhost:4000/mcp-rest/tools/call \
    -H "Authorization: Bearer $KEY" \
    -d '{"name":"mcp_tool_search","arguments":{"query":"add numbers"}}' \
  | jq -r '.content[0].text | fromjson | [.[].name]'
["math-add", "math-multiply"]
```

```console title="4. Call a discovered tool" showLineNumbers
$ curl -s -X POST http://localhost:4000/mcp-rest/tools/call \
    -H "Authorization: Bearer $KEY" \
    -d '{"name":"mcp_tool_call","arguments":{"tool_name":"math-add","arguments":{"a":3,"b":4}}}' \
  | jq '{result: .content[0].text, isError}'
{
  "result": "7",
  "isError": false
}
```

The same key works over the streamable-http protocol endpoint (`/mcp/`) for real MCP clients:

```python title="MCP Python SDK against /mcp/" showLineNumbers
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

async with streamablehttp_client(
    "http://localhost:4000/mcp/",
    headers={"Authorization": f"Bearer {KEY}"},
) as (read, write, _):
    async with ClientSession(read, write) as session:
        await session.initialize()

        tools = await session.list_tools()
        print([t.name for t in tools.tools])
        # ['mcp_tool_search', 'mcp_tool_call', 'agent_search', 'skill_search']

        found = await session.call_tool("mcp_tool_search", {"query": "add numbers"})
        print(found.content[0].text)

        result = await session.call_tool(
            "mcp_tool_call",
            {"tool_name": "math-add", "arguments": {"a": 3, "b": 4}},
        )
        print(result.content[0].text)  # "7"
```

Keys without the flag get the existing behavior unchanged: `tools/list` returns the full catalog, and the two virtual tool names are rejected with a `forbidden` error.

## Enable as a default for every new key

If you want every new key to opt into tool search without every caller having to remember the flag, put it under `litellm_settings.default_key_generate_params.object_permission` in `config.yaml`. Any `/key/generate` request that omits the field will have the default merged in; a request that sets a partial `object_permission` (say, only `mcp_servers`) keeps its explicit fields and only picks up the ones it left unset.

```yaml title="config.yaml" showLineNumbers
litellm_settings:
  default_key_generate_params:
    object_permission:
      mcp_tool_search_enabled: true
      mcp_servers: ["github", "slack"]
```

The default is merged **after** the caller-scope validation runs, so it never turns an ordinary non-admin personal-key request into a 403. Team-scoped fields like `mcp_servers` are still checked against the caller's own team when the caller sets them explicitly; the admin-configured default is applied only to the persisted key, not to the request being validated.

## How it works

When `mcp_tool_search_enabled: true` is set on a key's `object_permission`, both the streamable-http endpoint (`/mcp/`) and the REST surface (`/mcp-rest/tools/list`) return exactly four tools regardless of how many MCP servers the key can reach:

- `mcp_tool_search(query, top_k=5)` returns the ranked list of real tools that match the query.
- `mcp_tool_call(tool_name, arguments)` executes one of the tools the LLM discovered through search.
- `agent_search(query, top_k=5)` returns the A2A agents the key can reach, ranked by semantic similarity to the task described in `query`. It needs `litellm_settings.agent_search_embedding_model`; see [Search the registry](./a2a.md#search-the-registry).
- `skill_search(query, top_k=5)` returns the LiteLLM-hosted skills (`custom_llm_provider=litellm_proxy`) the key can reach, ranked by semantic similarity. It needs `litellm_settings.skill_search_embedding_model`; see [Semantic Search over LiteLLM-Hosted Skills](./skills.md#semantic-search-over-litellm-hosted-skills).

Both handlers run through the same filtered catalog and dispatch path as the normal `/tools/call` route, so search only surfaces tools the key is already allowed to see, and calls still resolve through `_get_allowed_mcp_servers` and `execute_mcp_tool`.

### Ranking

`mcp_tool_search` ranks the caller's reachable tools in one of two modes, chosen by `litellm_settings.mcp_tool_search.embedding_model`. Both modes search the text `name + "\n" + description` of each tool.

**Keyword (default, `embedding_model` unset).** No embeddings and no extra dependency. The proxy lowercases the query, splits it on whitespace, and scores each tool by how many query tokens appear as a substring of its lowercased name and description. A tool that contains both `add` and `numbers` scores 2, one that contains only `add` scores 1, and tools that score 0 are dropped. The rest are sorted by score, ties keep catalog order, and the first `top_k` are returned. A query has to share a token with the tool text, so `"exchange"` finds a tool described as "Get the latest foreign exchange rates" but `"FX"` does not.

**Semantic (`embedding_model` set).** Point `embedding_model` at a `model_name` from your `model_list` and the proxy ranks by meaning instead. It embeds the query and each reachable tool's name plus description, scores every tool by cosine similarity to the query, drops tools below `similarity_threshold`, and returns the best `top_k` with a `score` field on each result. Tool vectors are cached in memory per embedding model (up to 5000 vectors per process, least recently searched evicted first), so repeat searches over an unchanged catalog only embed the query. The embedding call goes through the same rate limit, budget, and guardrail pre-call hooks as `/embeddings`, is billed to the calling key, and shows up in spend logs like any other embedding request. If the embedding call fails, the search returns an error result (`isError: true`, text starting `embedding the search query failed`) instead of falling back to keyword ranking.

```yaml title="config.yaml" showLineNumbers
model_list:
  - model_name: text-embedding-3-small
    litellm_params:
      model: openai/text-embedding-3-small
      api_key: os.environ/OPENAI_API_KEY

litellm_settings:
  mcp_tool_search:
    embedding_model: text-embedding-3-small  # unset = keyword ranking
    top_k: 5
    similarity_threshold: 0.2
    core_tools:
      - treasury-get_rates
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `embedding_model` | string | `null` | A `model_name` from `model_list` used to rank tools by meaning. Unset keeps keyword ranking. Setting it on a proxy with no `model_list` makes every search return an error. |
| `top_k` | integer, 1 to 100 | `5` | Most ranked tools one search returns. The `top_k` argument on the `mcp_tool_search` call can narrow this but not widen it, since the smaller of the two wins. Core tools do not count against it. |
| `similarity_threshold` | float, 0.0 to 1.0 | `0.0` | Lowest cosine similarity a tool needs to appear in semantic results. The default `0.0` only drops tools with a negative similarity. Ignored in keyword mode. |
| `core_tools` | list of strings | `[]` | Tool names, in the `server-tool` form that `tools/list` shows, returned first on every search without a score. |

`core_tools` is the hybrid mode. The listed tools come back first on every search and the remaining reachable tools are ranked after them, semantically or by keyword depending on `embedding_model`. A core tool the caller's key, team, or server permissions do not allow is omitted, so listing a tool here never grants access to it. An empty query returns only the core tools, which is an empty list when `core_tools` is unset.

The embedded text is the whole tool name plus description, so a tool whose text is longer than the embedding model's input limit (8192 tokens for OpenAI `text-embedding-3-*`) cannot be embedded. On builds that include [PR #43554](https://github.com/BerriAI/litellm/pull/43554) (v1.107.0-dev.2 and later) that tool is left out of semantic results, the rest of the catalog is still ranked, and the proxy skips re-embedding it for an hour. On earlier builds one oversized tool makes every semantic search fail with the embedding provider's input-too-long error. The workaround there is to hide that tool with `disallowed_tools` on its MCP server, or to leave `embedding_model` unset.

An invalid `mcp_tool_search` block (for example `top_k: 0`) does not stop the proxy from starting. Each search returns the validation error as an error result until the block is fixed.

These settings can also be changed at runtime from the Admin UI under MCP Servers, Tool Search, or through `GET /get/mcp_tool_search_settings` and `PATCH /update/mcp_tool_search_settings` (updates are proxy admin only). Values saved this way are stored in the database and picked up by every pod within about 10 seconds, with no restart.

## Schema discovery endpoint (`/mcp/proxy`)

`/mcp/proxy` is a separate streamable-http MCP endpoint for clients that should discover tools and fetch schemas one at a time instead of loading the full catalog. Unlike the virtual tools above, it does not depend on `mcp_tool_search_enabled`. Any key that can reach MCP servers can connect, and `tools/list` always returns exactly three meta-tools:

| Tool | Arguments | Returns |
|------|-----------|---------|
| `search_tools` | `query` | Up to 5 matching tools as `{tool_id, name, description}`, plus `score` in semantic mode. No input schemas. |
| `get_tool_schema` | `tool_id` | The tool's `tool_id`, `name`, `description`, `inputSchema`, and `outputSchema` when the upstream server declares one. |
| `call_tool` | `tool_id`, `arguments` | The upstream tool result, after `arguments` is validated against the tool's `inputSchema`. |

`search_tools` uses the same ranking and the same `litellm_settings.mcp_tool_search` block as `mcp_tool_search`, including `embedding_model`, `similarity_threshold`, and `core_tools`. It always asks for 5 results, so the effective limit is the smaller of 5 and `top_k`. A `tool_id` is an opaque 32-character hash of the owning MCP server and tool name. It stays stable for a given server and tool, and it only resolves for keys that can reach that tool, so an unknown or unauthorized ID returns `Unknown or unauthorized tool_id`. `call_tool` rejects arguments that fail schema validation with an `Invalid arguments: ...` error before contacting the upstream server, then dispatches through the same permission checks and `execute_mcp_tool` path as a direct `tools/call`.

The endpoint only serves tools. Prompts and resources are not advertised in `initialize`, their methods return `METHOD_NOT_FOUND` with `Operation unavailable on /mcp/proxy`, and calling any tool other than the three meta-tools returns an error result.

```python title="MCP Python SDK against /mcp/proxy" showLineNumbers
import json

from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

async with streamablehttp_client(
    "http://localhost:4000/mcp/proxy",
    headers={"Authorization": f"Bearer {KEY}"},
) as (read, write, _):
    async with ClientSession(read, write) as session:
        await session.initialize()
        hits = json.loads((await session.call_tool("search_tools", {"query": "add numbers"})).content[0].text)
        schema = await session.call_tool("get_tool_schema", {"tool_id": hits[0]["tool_id"]})
        result = await session.call_tool("call_tool", {"tool_id": hits[0]["tool_id"], "arguments": {"a": 3, "b": 4}})
```

## Prerequisites

Requires LiteLLM v1.92.x or later. Semantic ranking, `similarity_threshold`, and `core_tools` require v1.102.0 or later plus an embedding model in `model_list`, and `/mcp/proxy` requires v1.102.0 or later. Neither needs an extra Python dependency.

## Access control

Tool search does not widen the access surface. `mcp_tool_search` walks the same filtered catalog the normal `tools/list` handler uses, so a tool the key cannot reach is invisible to search. `mcp_tool_call` resolves the caller's allowed servers, applies the request-IP-based `filter_server_ids_by_ip` pass, and dispatches through `execute_mcp_tool`, which enforces the server allowlist and the caller's `mcp_tool_permissions`. Attempting to route a `mcp_tool_call` at a server outside the key's scope returns a `403` from the same guard that protects direct calls:

```console
$ curl -s -X POST http://localhost:4000/mcp-rest/tools/call \
    -H "Authorization: Bearer $KEY" \
    -d '{"name":"mcp_tool_call","arguments":{"tool_name":"secret-server-delete_all","arguments":{}}}'
{"detail":"User not allowed to call this tool. Allowed MCP servers: [math]"}
```

Inspect the flag on any key with `/key/info`:

```bash
curl "http://localhost:4000/key/info?key=$KEY" \
  -H "Authorization: Bearer $ADMIN_KEY" \
  | jq '.info.object_permission | {mcp_tool_search_enabled, mcp_servers}'
```

## When to use tool search vs. semantic filter

Both features address large-catalog blowout, but they live at different layers. Tool search is an MCP-layer opt-in per key; the LLM sees four virtual tools and drives discovery itself over the MCP protocol, which suits agent frameworks that speak MCP end to end. The [semantic filter](./mcp_semantic_filter.md) sits on `/v1/responses` and `/v1/chat/completions` and rewrites the tool list on each request using embeddings, which suits chat-completion callers that never touch `/mcp/` directly. They can coexist; a key with tool search on will only expose the four virtual tools even when semantic filtering is enabled upstream.
