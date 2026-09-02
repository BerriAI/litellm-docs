import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# MCP Tool Search

Swap the full MCP catalog for a fixed set of virtual tools (`mcp_tool_search`, `mcp_tool_call`, `agent_search`) so a key with hundreds of tools available only ever exposes three on `tools/list`. The LLM searches by meaning (or by keyword when no embedding model is configured), gets back the ranked matches, then calls the discovered tool by name. `agent_search` does the same for the [A2A agent registry](./a2a.md#search-the-registry).

:::info Related Documentation
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
["mcp_tool_search", "mcp_tool_call", "agent_search"]
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
        # ['mcp_tool_search', 'mcp_tool_call', 'agent_search']

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

When `mcp_tool_search_enabled: true` is set on a key's `object_permission`, both the streamable-http endpoint (`/mcp/`) and the REST surface (`/mcp-rest/tools/list`) return exactly three tools regardless of how many MCP servers the key can reach:

- `mcp_tool_search(query, top_k=5)` returns the ranked list of real tools that match the query. See [Semantic search](#semantic-search) for how ranking works and how to tune it.
- `mcp_tool_call(tool_name, arguments)` executes one of the tools the LLM discovered through search.
- `agent_search(query, top_k=5)` returns the A2A agents the key can reach, ranked by semantic similarity to the task described in `query`. It needs `litellm_settings.agent_search_embedding_model`; see [Search the registry](./a2a.md#search-the-registry).

Both handlers run through the same filtered catalog and dispatch path as the normal `/tools/call` route, so search only surfaces tools the key is already allowed to see, and calls still resolve through `_get_allowed_mcp_servers` and `execute_mcp_tool`.

### Semantic search

By default `mcp_tool_search` ranks by keyword overlap, so a query has to share a token with the tool's `name` or `description`: `"exchange"` finds a tool described as "Get the latest foreign exchange rates", but `"FX"` does not. Point `litellm_settings.mcp_tool_search.embedding_model` at an embedding model from your `model_list` and the proxy ranks by meaning instead. It embeds the query and each reachable tool's `name` plus `description`, scores them by cosine similarity, and returns the best `top_k`. Tool embeddings are cached per model, so repeat searches over an unchanged catalog only embed the query. The embedding call is billed to the calling key and shows up in spend logs like any other embedding request

```yaml title="config.yaml" showLineNumbers
model_list:
  - model_name: text-embedding-3-small
    litellm_params:
      model: openai/text-embedding-3-small
      api_key: os.environ/OPENAI_API_KEY

litellm_settings:
  mcp_tool_search:
    embedding_model: text-embedding-3-small  # unset = keyword matching
    top_k: 5                                 # 1-100, most ranked tools a search returns
    similarity_threshold: 0.2                # 0.0-1.0, drop weaker matches (0.0 = no cutoff)
    core_tools:                              # always returned first, when the caller can reach them
      - treasury-get_rates
```

```console title="FX now finds the foreign exchange tool" showLineNumbers
$ curl -s -X POST http://localhost:4000/mcp-rest/tools/call \
    -H "Authorization: Bearer $KEY" \
    -d '{"name":"mcp_tool_search","arguments":{"query":"FX"}}' \
  | jq -r '.content[0].text | fromjson | [.[] | {name, score}]'
[
  {
    "name": "treasury-get_rates",
    "score": 0.2631137623742877
  }
]
```

`top_k` caps how many ranked tools come back; the `top_k` argument on the `mcp_tool_search` call is applied on top of it, so a caller can narrow the window but not widen it past the configured value. `similarity_threshold` is the lowest cosine similarity a tool needs to appear; leave it at `0.0` to always fill `top_k`, or raise it when you would rather return nothing than a weak match. Semantic results carry a `score` field so the LLM can judge confidence

`core_tools` is the hybrid mode: the named tools (in the `server-tool` form that `tools/list` shows) are returned first on every search, without a score, and do not count against `top_k`. The remaining reachable tools are ranked semantically after them. A core tool the caller's key, team, or server permissions do not allow is simply omitted, so listing a tool here never grants access to it. An empty query returns only the core tools. Without an embedding model the same core-first ordering applies on top of keyword matching

These settings can also be changed at runtime from the Admin UI under MCP Servers, Tool Search, or through `GET /get/mcp_tool_search_settings` and `PATCH /update/mcp_tool_search_settings` (proxy admin only). Values saved this way are stored in the database and picked up by every pod within a few seconds, no restart needed

## Prerequisites

Requires LiteLLM v1.92.x or later. Semantic ranking and `core_tools` require an embedding model in `model_list`; no extra Python dependency is needed.

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

Both features address large-catalog blowout, but they live at different layers. Tool search is an MCP-layer opt-in per key; the LLM sees three tools and drives discovery itself over the MCP protocol, which suits agent frameworks that speak MCP end to end. The [semantic filter](./mcp_semantic_filter.md) sits on `/v1/responses` and `/v1/chat/completions` and rewrites the tool list on each request using embeddings, which suits chat-completion callers that never touch `/mcp/` directly. They can coexist; a key with tool search on will only expose the three virtual tools even when semantic filtering is enabled upstream.
