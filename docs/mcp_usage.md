
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import Image from '@theme/IdealImage';

# MCP Client Recipes

This page is the source of truth for connecting clients to the LiteLLM MCP Gateway. Every recipe below starts from the same gateway setup and ends with one successful tool invocation. All recipes were smoke-tested on 2026-08-26 against LiteLLM v1.100.0 (see the [test record](#smoke-test-record)).

### Gateway setup

Add an MCP server to your proxy config and start the proxy. The recipes below use the public DeepWiki server so you can reproduce them without any upstream credential.

```yaml title="config.yaml" showLineNumbers
model_list:
  - model_name: gpt-4o-mini
    litellm_params:
      model: openai/gpt-4o-mini
      api_key: os.environ/OPENAI_API_KEY

general_settings:
  master_key: sk-1234

mcp_servers:
  deepwiki:
    url: "https://mcp.deepwiki.com/mcp"
    transport: "http"
```

```bash
litellm --config config.yaml
```

The proxy exposes two kinds of MCP endpoints. Which one you use is a deliberate choice:

| Endpoint | URL | When to use |
|----------|-----|-------------|
| Aggregate | `http://localhost:4000/mcp` | One connection that exposes every MCP server your key is allowed to access. Tool names are prefixed with the server name (e.g. `deepwiki-ask_question`). |
| Server-specific | `http://localhost:4000/{server_name}/mcp` | Scope the connection to a single server. `{server_name}` must match the key under `mcp_servers` in your config (or the server alias in the UI). |

Replace `http://localhost:4000` with your LiteLLM Proxy base URL throughout.

Two credentials are involved and they go in different places. Your LiteLLM virtual key is sent by the client in the `x-litellm-api-key` header. `Authorization: Bearer <key>` also works, but prefer `x-litellm-api-key` so the `Authorization` header stays free for OAuth or upstream credential passthrough. The upstream MCP credential, if the server needs one, lives in the proxy config (`auth_type`/`auth_value`) or is forwarded per request with [server-specific headers](./mcp#using-your-mcp-with-client-side-credentials).

There are two ways to consume the gateway. Direct MCP clients (Cursor, Claude Code, FastMCP, MCP Inspector) speak the MCP protocol to the URLs above and need a real, reachable URL. LLM API calls through the proxy (`/v1/responses`, `/v1/chat/completions`) instead reference the gateway with the literal string `litellm_proxy` inside the `tools` array, because the request is already at the proxy and no second network hop is needed.

### Use on LiteLLM UI

Follow this walkthrough to use your MCP on LiteLLM UI

<iframe width="840" height="500" src="https://www.loom.com/embed/57e0763267254bc79dbe6658d0b8758c" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen></iframe>

### Cursor IDE

Open Cursor Settings with `⇧+⌘+J` (Mac) or `Ctrl+Shift+J` (Windows/Linux), go to the "MCP Tools" tab, click "New MCP Server", and paste:

```json title="Cursor MCP Configuration" showLineNumbers
{
  "mcpServers": {
    "LiteLLM": {
      "url": "http://localhost:4000/mcp",
      "headers": {
        "x-litellm-api-key": "Bearer sk-1234"
      }
    }
  }
}
```

The `url` must be a real URL to your proxy: the aggregate endpoint as shown, or `http://localhost:4000/deepwiki/mcp` to scope Cursor to one server. Replace `sk-1234` with your LiteLLM virtual key, keeping the `Bearer ` prefix. Once the server shows as connected, ask Cursor's agent to use a tool (for example "use deepwiki to summarize BerriAI/litellm") and it will call through the gateway.

### Claude Code

Register the gateway with the `claude mcp add` CLI. The `--header` flag is required: without it Claude Code falls back to OAuth discovery and fails with "Incompatible auth server: does not support dynamic client registration" unless the server is configured for OAuth in LiteLLM (see the [Claude Code tutorial](./tutorials/claude_mcp) for the OAuth setup).

```bash title="Add the gateway to Claude Code" showLineNumbers
claude mcp add --transport http litellm-deepwiki http://localhost:4000/deepwiki/mcp \
  --header "x-litellm-api-key: Bearer sk-1234"

claude mcp list
# litellm-deepwiki: http://localhost:4000/deepwiki/mcp (HTTP) - ✔ Connected
```

Then invoke a tool:

```bash
claude -p "Use the deepwiki ask_question tool to summarize what BerriAI/litellm is about."
```

You can also route Claude Code's model traffic through the same proxy by setting `ANTHROPIC_BASE_URL=http://localhost:4000` and `ANTHROPIC_AUTH_TOKEN=sk-1234` before launching `claude`, so both LLM calls and MCP tool calls go through LiteLLM.

### Responses API through LiteLLM

When the request already goes to the proxy's `/v1/responses` endpoint, use the literal value `litellm_proxy` as the `server_url`. Do not put your proxy's HTTP URL here; the proxy resolves `litellm_proxy` internally to its configured MCP servers. To scope the request to one server, use `litellm_proxy/mcp/{server_name}`.

Demo Video Using Responses API with LiteLLM Proxy: [Demo video here](https://www.loom.com/share/34587e618c5c47c0b0d67b4e4d02718f?sid=2caf3d45-ead4-4490-bcc1-8d6dd6041c02)

<Tabs>
<TabItem value="curl" label="cURL">

```bash title="cURL Example" showLineNumbers
curl --location 'http://localhost:4000/v1/responses' \
--header 'Content-Type: application/json' \
--header "Authorization: Bearer sk-1234" \
--data '{
    "model": "gpt-4o-mini",
    "input": [
    {
      "role": "user",
      "content": "give me TLDR of what BerriAI/litellm repo is about",
      "type": "message"
    }
  ],
    "tools": [
        {
            "type": "mcp",
            "server_label": "deepwiki",
            "server_url": "litellm_proxy/mcp/deepwiki",
            "require_approval": "never"
        }
    ],
    "tool_choice": "required"
}'
```

</TabItem>
<TabItem value="python" label="Python SDK">

```python title="Python SDK Example" showLineNumbers
import openai

client = openai.OpenAI(
    api_key="sk-1234",  # your litellm proxy api key
    base_url="http://localhost:4000"  # your litellm proxy base url
)

response = client.responses.create(
    model="gpt-4o-mini",
    input=[
        {
            "role": "user",
            "content": "give me TLDR of what BerriAI/litellm repo is about",
            "type": "message"
        }
    ],
    tools=[
        {
            "type": "mcp",
            "server_label": "deepwiki",
            "server_url": "litellm_proxy/mcp/deepwiki",
            "require_approval": "never"
        }
    ],
    tool_choice="required"
)

print(response)
```

</TabItem>
</Tabs>

With `require_approval: "never"` the proxy executes the tool calls automatically and the response includes the tool output alongside the assistant message. Use `server_url: "litellm_proxy"` (no suffix) to expose every server your key can access instead of one.

#### Specifying MCP Tools

You can restrict which tools are available with the `allowed_tools` parameter. To get the tool name, navigate to the LiteLLM UI, MCP Servers > MCP Tools, click the tool, and copy the tool name.

<Tabs>
<TabItem value="curl" label="cURL">

```bash title="cURL Example with allowed_tools" showLineNumbers
curl --location 'http://localhost:4000/v1/responses' \
--header 'Content-Type: application/json' \
--header "Authorization: Bearer sk-1234" \
--data '{
    "model": "gpt-4o-mini",
    "input": [
    {
      "role": "user",
      "content": "give me TLDR of what BerriAI/litellm repo is about",
      "type": "message"
    }
  ],
    "tools": [
        {
            "type": "mcp",
            "server_label": "litellm",
            "server_url": "litellm_proxy",
            "require_approval": "never",
            "allowed_tools": ["deepwiki-ask_question"]
        }
    ],
    "tool_choice": "required"
}'
```

</TabItem>
<TabItem value="python" label="Python SDK">

```python title="Python SDK Example with allowed_tools" showLineNumbers
import openai

client = openai.OpenAI(
    api_key="sk-1234",
    base_url="http://localhost:4000"
)

response = client.responses.create(
    model="gpt-4o-mini",
    input=[
        {
            "role": "user",
            "content": "give me TLDR of what BerriAI/litellm repo is about",
            "type": "message"
        }
    ],
    tools=[
        {
            "type": "mcp",
            "server_label": "litellm",
            "server_url": "litellm_proxy",
            "require_approval": "never",
            "allowed_tools": ["deepwiki-ask_question"]
        }
    ],
    tool_choice="required"
)

print(response)
```

</TabItem>
</Tabs>

### Chat Completions through LiteLLM

The same MCP tool definition works on `/v1/chat/completions`, for every LLM provider behind LiteLLM. The scoped form is `litellm_proxy/mcp/{server_name}`; bare `litellm_proxy` exposes all servers your key can access.

```bash title="Chat Completions with MCP Tools" showLineNumbers
curl --location 'http://localhost:4000/v1/chat/completions' \
--header 'Content-Type: application/json' \
--header "Authorization: Bearer sk-1234" \
--data '{
  "model": "gpt-4o-mini",
  "messages": [
    {"role": "user", "content": "give me TLDR of what BerriAI/litellm repo is about"}
  ],
  "tools": [
    {
      "type": "mcp",
      "server_url": "litellm_proxy/mcp/deepwiki",
      "server_label": "deepwiki",
      "require_approval": "never"
    }
  ]
}'
```

With `require_approval: "never"` the proxy fetches the MCP tools, converts them to OpenAI-compatible function definitions, executes any tool calls the model makes, and returns the final assistant message in a single API call. The executed tool list is returned under `provider_specific_fields.mcp_list_tools`. If you omit `require_approval`, tool calls are returned to you for manual execution, matching upstream OpenAI behavior.

#### How it works when server_url="litellm_proxy"

When server_url="litellm_proxy", LiteLLM bridges non-MCP providers to your MCP tools.

- Tool Discovery: LiteLLM fetches MCP tools and converts them to OpenAI-compatible definitions
- LLM Call: Tools are sent to the LLM with your input; LLM selects which tools to call
- Tool Execution: LiteLLM automatically parses arguments, routes calls to MCP servers, executes tools, and retrieves results
- Response Integration: Tool results are sent back to LLM for final response generation
- Output: Complete response combining LLM reasoning with tool execution results

This enables MCP tool usage with any LiteLLM-supported provider, regardless of native MCP support.

### Generic Streamable HTTP / FastMCP client

Any client that supports Streamable HTTP transport can connect to the gateway with a real URL plus the `x-litellm-api-key` header.

<Tabs>
<TabItem value="fastmcp" label="Python FastMCP">

```python title="FastMCP client" showLineNumbers
import asyncio

from fastmcp import Client
from fastmcp.client.transports import StreamableHttpTransport

transport = StreamableHttpTransport(
    "http://localhost:4000/deepwiki/mcp",
    headers={"x-litellm-api-key": "Bearer sk-1234"},
)
client = Client(transport)


async def main():
    async with client:
        tools = await client.list_tools()
        print("tools:", [t.name for t in tools])
        result = await client.call_tool(
            "deepwiki-ask_question",
            {"repoName": "BerriAI/litellm", "question": "What is this repo about?"},
        )
        print("result:", result.content[0].text)


asyncio.run(main())
```

</TabItem>
<TabItem value="curl" label="cURL">

```bash title="Raw Streamable HTTP request" showLineNumbers
curl --location 'http://localhost:4000/deepwiki/mcp' \
--header 'Content-Type: application/json' \
--header 'Accept: application/json, text/event-stream' \
--header 'x-litellm-api-key: Bearer sk-1234' \
--data '{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list"
}'
```

To call a tool, POST `{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"deepwiki-ask_question","arguments":{"repoName":"BerriAI/litellm","question":"What is this repo about?"}}}` to the same URL.

</TabItem>
</Tabs>

Use `http://localhost:4000/mcp` instead of the server-specific URL to expose every allowed server over one connection.

### Smoke test record

All recipes on this page were run against LiteLLM v1.100.0 on 2026-08-26 with a Streamable HTTP MCP server behind the gateway. Direct protocol legs (tools/list and tools/call over the aggregate and server-specific endpoints), the FastMCP client, Claude Code (connect plus one tool invocation), Responses API, and Chat Completions (scoped and unscoped) all returned successful tool results. The Cursor recipe's endpoint and header shape were verified over the same protocol legs; the Cursor app itself was not driven. Claude Code without the `x-litellm-api-key` header reproduces the dynamic client registration failure described above.

For connectivity failures, see the [MCP Troubleshooting Guide](./mcp_troubleshoot).
