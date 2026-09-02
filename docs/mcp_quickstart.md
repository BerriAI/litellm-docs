# MCP Gateway Quickstart

Go from no LiteLLM process to a successful MCP `tools/list` and one tool call in about 10 minutes. This guide uses only a terminal; no Admin UI, database, OAuth, ngrok, or enterprise license is required.

All commands below were run end to end against **LiteLLM v1.98.0** on Python 3.12. The MCP server used is [DeepWiki](https://mcp.deepwiki.com/mcp), a public HTTP MCP server that requires no credentials.

**Prerequisites:** Python 3.10+, `curl`, outbound internet access, and (only for step 6) an OpenAI API key.

## 1. Install a pinned LiteLLM release

```bash
python3 -m venv litellm-venv
source litellm-venv/bin/activate
pip install 'litellm[proxy]==1.98.0'
```

Verify the install:

```bash
litellm --version
# LiteLLM: Current Version = 1.98.0
```

**If this fails:** confirm `python3 --version` is 3.10 or newer and that you activated the venv (`which litellm` should point inside `litellm-venv`).

## 2. Set the required environment variables

```bash
export LITELLM_MASTER_KEY="sk-1234"
export OPENAI_API_KEY="sk-your-openai-key"   # only used by step 6
```

`LITELLM_MASTER_KEY` is the admin key you will send on every request to the gateway. Also make sure `DATABASE_URL` is **not** set in your shell (`unset DATABASE_URL`); if it is set, the proxy attempts to connect to Postgres on startup, which this quickstart does not need.

## 3. Create config.yaml

Save this file as `config.yaml` in your working directory:

```yaml title="config.yaml" showLineNumbers
model_list:
  - model_name: gpt-4o-mini
    litellm_params:
      model: openai/gpt-4o-mini
      api_key: os.environ/OPENAI_API_KEY

mcp_servers:
  deepwiki:
    url: "https://mcp.deepwiki.com/mcp"
    transport: "http"
```

This registers one model and one HTTP MCP server. Because the server is defined in `config.yaml`, nothing is stored in a database.

## 4. Start the gateway and verify health

```bash
litellm --config config.yaml --port 4000
```

Wait for `Uvicorn running on http://0.0.0.0:4000` in the logs, then in a second terminal:

```bash
curl -s http://localhost:4000/health/liveliness
# "I'm alive!"
```

**If this fails:** a `ModuleNotFoundError: No module named 'prisma'` traceback on startup means `DATABASE_URL` is set; `unset DATABASE_URL` and restart. For other startup errors see [Locate the Error Source](./mcp_troubleshoot.md#locate-the-error-source).

## 5. List MCP tools and call one

List tools over the MCP JSON-RPC endpoint. This is the same `/mcp` endpoint and `x-litellm-api-key` header every MCP client recipe (Cursor, Claude Code, MCP Inspector) uses:

```bash
curl -s -X POST http://localhost:4000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "x-litellm-api-key: Bearer sk-1234" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

Expected: an SSE `event: message` line followed by a JSON-RPC result listing three tools named `deepwiki-ask_question`, `deepwiki-read_wiki_contents`, and `deepwiki-read_wiki_structure`. Tool names are prefixed with the server name from `config.yaml`.

Now call one tool:

```bash
curl -s -X POST http://localhost:4000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "x-litellm-api-key: Bearer sk-1234" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"deepwiki-read_wiki_structure","arguments":{"repoName":"BerriAI/litellm"}}}'
```

Expected: a JSON-RPC result whose `content[0].text` starts with `Available pages for BerriAI/litellm:` followed by a topic list.

**If this fails:** an auth error means the `x-litellm-api-key` value does not match `LITELLM_MASTER_KEY`; an empty tool list or a `Failed to get tools from server deepwiki` warning in the proxy logs means LiteLLM cannot reach the MCP server, so run the [curl smoke test](./mcp_troubleshoot.md#curl-smoke-test) directly against `https://mcp.deepwiki.com/mcp` from the same machine.

## 6. Call a tool through an LLM (Responses API)

The same tools are available to models through the OpenAI-compatible `/v1/responses` endpoint. `server_url: litellm_proxy` tells LiteLLM to use its own MCP gateway:

```bash
curl -s http://localhost:4000/v1/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-1234" \
  -d '{
    "model": "gpt-4o-mini",
    "input": "Use the deepwiki ask_question tool to answer: what is the BerriAI/litellm repo about? One sentence.",
    "tools": [
      {
        "type": "mcp",
        "server_label": "deepwiki",
        "server_url": "litellm_proxy",
        "require_approval": "never",
        "allowed_tools": ["deepwiki-ask_question"]
      }
    ],
    "tool_choice": "required"
  }'
```

Expected: a response with `"status": "completed"` whose output contains `mcp_tools_fetched`, `tool_execution_results`, and a final `message` item summarizing the repository. `allowed_tools` matters here: without it the model may call `read_wiki_contents`, whose output can exceed the model's context window and fail the request with `context_length_exceeded`.

**If this fails:** a `401`/`invalid_api_key` error from OpenAI means `OPENAI_API_KEY` is wrong; for MCP-side failures during the request see [Responses/Completions with Embedded MCP Calls](./mcp_troubleshoot.md#responsescompletions-with-embedded-mcp-calls).

## 7. Choose your integration path

You have now exercised both ways to consume the gateway. Point MCP clients (Cursor, Claude Code, MCP Inspector, agent runtimes) at `http://localhost:4000/mcp` with the `x-litellm-api-key` header when the client decides which tools to call; see [Using your MCP](./mcp_usage.md) for client recipes. Use `/v1/responses` or `/v1/chat/completions` with a `type: mcp` tool entry when you want the LLM to drive tool use through one API call, and [MCP REST API](./mcp_rest_api.md) when you want to invoke a known tool directly without an LLM.

From here, [MCP Overview](./mcp.md) covers adding your own servers (SSE, stdio, auth headers, OAuth) and controlling tool access by key or team.

## Cleanup

Stop the proxy with `Ctrl+C`, then:

```bash
deactivate
rm -rf litellm-venv config.yaml
```
