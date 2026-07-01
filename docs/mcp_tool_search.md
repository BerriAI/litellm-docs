import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# MCP Tool Search

Swap the full MCP catalog for a fixed pair of virtual tools (`mcp_tool_search`, `mcp_tool_call`) so a key with hundreds of tools available only ever exposes two on `tools/list`. The LLM searches by keyword, gets back the ranked matches, then calls the discovered tool by name.

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
["mcp_tool_search", "mcp_tool_call"]
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
        # ['mcp_tool_search', 'mcp_tool_call']

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

When `mcp_tool_search_enabled: true` is set on a key's `object_permission`, both the streamable-http endpoint (`/mcp/`) and the REST surface (`/mcp-rest/tools/list`) return exactly two tools regardless of how many MCP servers the key can reach:

- `mcp_tool_search(query, top_k=5)` returns the ranked list of real tools that match the query.
- `mcp_tool_call(tool_name, arguments)` executes one of the tools the LLM discovered through search.

Both handlers run through the same filtered catalog and dispatch path as the normal `/tools/call` route, so search only surfaces tools the key is already allowed to see, and calls still resolve through `_get_allowed_mcp_servers` and `execute_mcp_tool`.

### Search algorithm

Ranking is a token-overlap count against the tool's `name` and `description` fields; no embeddings and no extra dependency. For each request the proxy:

1. Lowercases the query and splits it on whitespace into tokens (`"add numbers"` becomes `["add", "numbers"]`).
2. For every tool the caller can reach, builds a haystack of `lower(name + " " + description)`.
3. Scores each tool by the number of query tokens found as a substring of the haystack. A tool that contains both `add` and `numbers` scores 2; a tool that contains only `add` scores 1.
4. Drops anything with a score of 0, sorts the rest by score descending, and returns the first `top_k` (default 5).

There is no similarity threshold beyond "score > 0", so a query that lands on only one token still returns matches. Order among tools with the same score follows Python's stable sort of the underlying catalog. Empty queries return an empty list. The `top_k` argument on `mcp_tool_search` is per-call, so an LLM can widen the window itself when the first result set is too narrow.

## Prerequisites

Requires LiteLLM v1.92.x or later.

## Access control

Tool search does not widen the access surface. `mcp_tool_search` walks the same filtered catalog the normal `tools/list` handler uses, so a tool the key cannot reach is invisible to search. `mcp_tool_call` resolves the caller's allowed servers, applies the request-IP-based `filter_server_ids_by_ip` pass, and dispatches through `execute_mcp_tool`, which enforces the server allowlist and per-key `mcp_tool_permissions`. Attempting to route a `mcp_tool_call` at a server outside the key's scope returns a `403` from the same guard that protects direct calls:

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

Both features address large-catalog blowout, but they live at different layers. Tool search is an MCP-layer opt-in per key; the LLM sees two tools and drives discovery itself over the MCP protocol, which suits agent frameworks that speak MCP end to end. The [semantic filter](./mcp_semantic_filter.md) sits on `/v1/responses` and `/v1/chat/completions` and rewrites the tool list on each request using embeddings, which suits chat-completion callers that never touch `/mcp/` directly. They can coexist; a key with tool search on will only expose the two virtual tools even when semantic filtering is enabled upstream.
