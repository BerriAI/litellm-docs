
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import Image from '@theme/IdealImage';

# Using your MCP

This document covers how to use LiteLLM as an MCP Gateway. You can see how to use it with Responses API, Cursor IDE, and OpenAI SDK.

### Use on LiteLLM UI 

Follow this walkthrough to use your MCP on LiteLLM UI

<iframe width="840" height="500" src="https://www.loom.com/embed/57e0763267254bc79dbe6658d0b8758c" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen></iframe>

### Use with Responses API

Replace `http://localhost:4000` with your LiteLLM Proxy base URL.

Demo Video Using Responses API with LiteLLM Proxy: [Demo video here](https://www.loom.com/share/34587e618c5c47c0b0d67b4e4d02718f?sid=2caf3d45-ead4-4490-bcc1-8d6dd6041c02)


<Tabs>
<TabItem value="curl" label="cURL">

```bash title="cURL Example" showLineNumbers
curl --location 'http://localhost:4000/v1/responses' \
--header 'Content-Type: application/json' \
--header "Authorization: Bearer sk-1234" \
--data '{
    "model": "gpt-5",
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
            "require_approval": "never"
        }
    ],
    "stream": true,
    "tool_choice": "required"
}'
```

</TabItem>
<TabItem value="python" label="Python SDK">

```python title="Python SDK Example" showLineNumbers
"""
Use LiteLLM Proxy MCP Gateway to call MCP tools.

When using LiteLLM Proxy, you can use the same MCP tools across all your LLM providers.
"""
import openai

client = openai.OpenAI(
    api_key="sk-1234", # paste your litellm proxy api key here
    base_url="http://localhost:4000" # paste your litellm proxy base url here
)
print("Making API request to Responses API with MCP tools")

response = client.responses.create(
    model="gpt-5",
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
            "require_approval": "never"
        }
    ],
    stream=True,
    tool_choice="required"
)

for chunk in response:
    print("response chunk: ", chunk)
```

</TabItem>
</Tabs>

#### Specifying MCP Tools

You can specify which MCP tools are available by using the `allowed_tools` parameter. This allows you to restrict access to specific tools within an MCP server.

To get the list of allowed tools when using LiteLLM MCP Gateway, you can naigate to the LiteLLM UI on MCP Servers > MCP Tools > Click the Tool > Copy Tool Name.

<Tabs>
<TabItem value="curl" label="cURL">

```bash title="cURL Example with allowed_tools" showLineNumbers
curl --location 'http://localhost:4000/v1/responses' \
--header 'Content-Type: application/json' \
--header "Authorization: Bearer sk-1234" \
--data '{
    "model": "gpt-5",
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
            "server_url": "litellm_proxy/mcp",
            "require_approval": "never",
            "allowed_tools": ["GitMCP-fetch_litellm_documentation"]
        }
    ],
    "stream": true,
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
    model="gpt-5",
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
            "server_url": "litellm_proxy/mcp",
            "require_approval": "never",
            "allowed_tools": ["GitMCP-fetch_litellm_documentation"]
        }
    ],
    stream=True,
    tool_choice="required"
)

print(response)
```

</TabItem>
</Tabs>

### Use with Cursor IDE

Use tools directly from Cursor IDE with LiteLLM MCP:

**Setup Instructions:**

1. **Open Cursor Settings**: Use `⇧+⌘+J` (Mac) or `Ctrl+Shift+J` (Windows/Linux)
2. **Navigate to MCP Tools**: Go to the "MCP Tools" tab and click "New MCP Server"
3. **Add Configuration**: Copy and paste the JSON configuration below, then save with `Cmd+S` or `Ctrl+S`

```json title="Basic Cursor MCP Configuration" showLineNumbers
{
  "mcpServers": {
    "LiteLLM": {
      "url": "litellm_proxy",
      "headers": {
        "x-litellm-api-key": "Bearer $LITELLM_API_KEY"
      }
    }
  }
}
```

#### How it works when server_url="litellm_proxy"

When server_url="litellm_proxy", LiteLLM bridges non-MCP providers to your MCP tools.

- Tool Discovery: LiteLLM fetches MCP tools and converts them to OpenAI-compatible definitions
- LLM Call: Tools are sent to the LLM with your input; LLM selects which tools to call
- Tool Execution: LiteLLM automatically parses arguments, routes calls to MCP servers, executes tools, and retrieves results
- Response Integration: Tool results are sent back to LLM for final response generation
- Output: Complete response combining LLM reasoning with tool execution results

This enables MCP tool usage with any LiteLLM-supported provider, regardless of native MCP support.

#### Auto-execution for require_approval: "never"

Setting require_approval: "never" triggers automatic tool execution, returning the final response in a single API call without additional user interaction.
## Calling the Proxy's /v1/responses Endpoint

When calling your LiteLLM Proxy's `/v1/responses` endpoint to use MCP tools, **always use `server_url: "litellm_proxy"`** in the tools array. This tells the proxy to use its configured MCP servers.

:::important Do not use the full proxy URL
Using `server_url: "https://your-proxy.com/mcp"` is incorrect when the request is already going to the proxy. The proxy needs the literal value `litellm_proxy` to route to its configured MCP servers.
:::

```bash title="Correct: Using litellm_proxy" showLineNumbers
curl --location 'https://your-proxy.com/v1/responses' \
--header 'Content-Type: application/json' \
--header "Authorization: Bearer $LITELLM_API_KEY" \
--data '{
    "model": "gpt-4",
    "tools": [
        {
            "type": "mcp",
            "server_label": "litellm",
            "server_url": "litellm_proxy",
            "require_approval": "never"
        }
    ],
    "input": "Run available tools",
    "tool_choice": "required"
}'
```

### Sending Custom Headers to MCP Servers

To pass custom headers (e.g., API keys, auth tokens) to specific MCP servers, use either:

**Option 1: Request headers**: Add `x-mcp-{server_alias}-{header_name}` to your request headers. The proxy forwards these to the matching MCP server.

```bash
# Send Authorization header to the "weather2" MCP server
--header 'x-mcp-weather2-authorization: Bearer your-token'

# Send custom header to the "github" MCP server  
--header 'x-mcp-github-x-api-key: your-api-key'
```

**Option 2: Headers in tool config**: Include a `headers` object in the tool definition. These are merged with request headers.

```json
{
    "type": "mcp",
    "server_label": "litellm",
    "server_url": "litellm_proxy",
    "require_approval": "never",
    "headers": {
        "x-litellm-api-key": "Bearer YOUR_LITELLM_API_KEY",
        "x-mcp-servers": "Zapier_MCP,dev-group",
        "x-mcp-weather2-authorization": "Bearer your-weather-api-token"
    }
}
```

## Use MCP tools with `/chat/completions`

:::tip Works with all providers
This flow is **provider-agnostic**: the same MCP tool definition works for _every_ LLM backend behind LiteLLM (OpenAI, Azure OpenAI, Anthropic, Amazon Bedrock, Vertex, self-hosted deployments, etc.).
:::

LiteLLM Proxy also supports MCP-aware tooling on the classic `/v1/chat/completions` endpoint. Provide the MCP tool definition directly in the `tools` array and LiteLLM will fetch and transform the MCP server's tools into OpenAI-compatible function calls. When `require_approval` is set to `"never"`, the proxy automatically executes the returned tool calls and feeds the results back into the model before returning the assistant response.

```bash title="Chat Completions with MCP Tools" showLineNumbers
curl --location '<your-litellm-proxy-base-url>/v1/chat/completions' \
--header 'Content-Type: application/json' \
--header "Authorization: Bearer $LITELLM_API_KEY" \
--data '{
  "model": "gpt-4o-mini",
  "messages": [
    {"role": "user", "content": "Summarize the latest open PR."}
  ],
  "tools": [
    {
      "type": "mcp",
      "server_url": "litellm_proxy/github/mcp",
      "server_label": "github_mcp",
      "require_approval": "never"
    }
  ]
}'
```

If you omit `require_approval` or set it to any value other than `"never"`, the MCP tool calls are returned to the client so that you can review and execute them manually, matching the upstream OpenAI behavior.


## Using your MCP with client side credentials

Use this if you want to pass a client side authentication token to LiteLLM to then pass to your MCP to auth to your MCP.


### New Server-Specific Auth Headers (Recommended)

You can specify MCP auth tokens using server-specific headers in the format `x-mcp-{server_alias}-{header_name}`. This allows you to use different authentication for different MCP servers.

**Benefits:**
- **Server-specific authentication**: Each MCP server can use different auth methods
- **Better security**: No need to share the same auth token across all servers
- **Flexible header names**: Support for different auth header types (authorization, x-api-key, etc.)
- **Clean separation**: Each server's auth is clearly identified

### Legacy Auth Header (Deprecated)

You can also specify your MCP auth token using the header `x-mcp-auth`. This will be forwarded to all MCP servers and is deprecated in favor of server-specific headers.

<Tabs>
<TabItem value="openai" label="OpenAI API">

#### Connect via OpenAI Responses API with Server-Specific Auth

Use the OpenAI Responses API and include server-specific auth headers:

```bash title="cURL Example with Server-Specific Auth" showLineNumbers
curl --location 'https://api.openai.com/v1/responses' \
--header 'Content-Type: application/json' \
--header "Authorization: Bearer $OPENAI_API_KEY" \
--data '{
    "model": "gpt-4o",
    "tools": [
        {
            "type": "mcp",
            "server_label": "litellm",
            "server_url": "litellm_proxy",
            "require_approval": "never",
            "headers": {
                "x-litellm-api-key": "Bearer YOUR_LITELLM_API_KEY",
                "x-mcp-github-authorization": "Bearer YOUR_GITHUB_TOKEN",
                "x-mcp-zapier-x-api-key": "YOUR_ZAPIER_API_KEY"
            }
        }
    ],
    "input": "Run available tools",
    "tool_choice": "required"
}'
```

#### Connect via OpenAI Responses API with Legacy Auth

Use the OpenAI Responses API and include the `x-mcp-auth` header for your MCP server authentication:

```bash title="cURL Example with Legacy MCP Auth" showLineNumbers
curl --location 'https://api.openai.com/v1/responses' \
--header 'Content-Type: application/json' \
--header "Authorization: Bearer $OPENAI_API_KEY" \
--data '{
    "model": "gpt-4o",
    "tools": [
        {
            "type": "mcp",
            "server_label": "litellm",
            "server_url": "litellm_proxy",
            "require_approval": "never",
            "headers": {
                "x-litellm-api-key": "Bearer YOUR_LITELLM_API_KEY",
                "x-mcp-auth": YOUR_MCP_AUTH_TOKEN
            }
        }
    ],
    "input": "Run available tools",
    "tool_choice": "required"
}'
```

</TabItem>

<TabItem value="litellm" label="LiteLLM Proxy">

#### Connect via LiteLLM Proxy Responses API with Server-Specific Auth

Use this when calling LiteLLM Proxy for LLM API requests to `/v1/responses` endpoint with server-specific authentication:

```bash title="cURL Example with Server-Specific Auth" showLineNumbers
curl --location '<your-litellm-proxy-base-url>/v1/responses' \
--header 'Content-Type: application/json' \
--header "Authorization: Bearer $LITELLM_API_KEY" \
--data '{
    "model": "gpt-4o",
    "tools": [
        {
            "type": "mcp",
            "server_label": "litellm",
            "server_url": "litellm_proxy",
            "require_approval": "never",
            "headers": {
                "x-litellm-api-key": "Bearer YOUR_LITELLM_API_KEY",
                "x-mcp-github-authorization": "Bearer YOUR_GITHUB_TOKEN",
                "x-mcp-zapier-x-api-key": "YOUR_ZAPIER_API_KEY"
            }
        }
    ],
    "input": "Run available tools",
    "tool_choice": "required"
}'
```

#### Connect via LiteLLM Proxy Responses API with Legacy Auth

Use this when calling LiteLLM Proxy for LLM API requests to `/v1/responses` endpoint with MCP authentication:

```bash title="cURL Example with Legacy MCP Auth" showLineNumbers
curl --location '<your-litellm-proxy-base-url>/v1/responses' \
--header 'Content-Type: application/json' \
--header "Authorization: Bearer $LITELLM_API_KEY" \
--data '{
    "model": "gpt-4o",
    "tools": [
        {
            "type": "mcp",
            "server_label": "litellm",
            "server_url": "litellm_proxy",
            "require_approval": "never",
            "headers": {
                "x-litellm-api-key": "Bearer YOUR_LITELLM_API_KEY",
                "x-mcp-auth": "YOUR_MCP_AUTH_TOKEN"
            }
        }
    ],
    "input": "Run available tools",
    "tool_choice": "required"
}'
```

</TabItem>

<TabItem value="cursor" label="Cursor IDE">

#### Connect via Cursor IDE with Server-Specific Auth

Use tools directly from Cursor IDE with LiteLLM MCP and include server-specific authentication:

**Setup Instructions:**

1. **Open Cursor Settings**: Use `⇧+⌘+J` (Mac) or `Ctrl+Shift+J` (Windows/Linux)
2. **Navigate to MCP Tools**: Go to the "MCP Tools" tab and click "New MCP Server"
3. **Add Configuration**: Copy and paste the JSON configuration below, then save with `Cmd+S` or `Ctrl+S`

```json title="Cursor MCP Configuration with Server-Specific Auth" showLineNumbers
{
  "mcpServers": {
    "LiteLLM": {
      "url": "litellm_proxy",
      "headers": {
        "x-litellm-api-key": "Bearer $LITELLM_API_KEY",
        "x-mcp-github-authorization": "Bearer $GITHUB_TOKEN",
        "x-mcp-zapier-x-api-key": "$ZAPIER_API_KEY"
      }
    }
  }
}
```

#### Connect via Cursor IDE with Legacy Auth

Use tools directly from Cursor IDE with LiteLLM MCP and include your MCP authentication token:

**Setup Instructions:**

1. **Open Cursor Settings**: Use `⇧+⌘+J` (Mac) or `Ctrl+Shift+J` (Windows/Linux)
2. **Navigate to MCP Tools**: Go to the "MCP Tools" tab and click "New MCP Server"
3. **Add Configuration**: Copy and paste the JSON configuration below, then save with `Cmd+S` or `Ctrl+S`

```json title="Cursor MCP Configuration with Legacy Auth" showLineNumbers
{
  "mcpServers": {
    "LiteLLM": {
      "url": "litellm_proxy",
      "headers": {
        "x-litellm-api-key": "Bearer $LITELLM_API_KEY",
        "x-mcp-auth": "$MCP_AUTH_TOKEN"
      }
    }
  }
}
```

</TabItem>

<TabItem value="http" label="Streamable HTTP">

#### Connect via Streamable HTTP Transport with Server-Specific Auth

Connect to LiteLLM MCP using HTTP transport with server-specific authentication:

**Server URL:**
```text showLineNumbers
litellm_proxy
```

**Headers:**
```text showLineNumbers
x-litellm-api-key: Bearer YOUR_LITELLM_API_KEY
x-mcp-github-authorization: Bearer YOUR_GITHUB_TOKEN
x-mcp-zapier-x-api-key: YOUR_ZAPIER_API_KEY
```

#### Connect via Streamable HTTP Transport with Legacy Auth

Connect to LiteLLM MCP using HTTP transport with MCP authentication:

**Server URL:**
```text showLineNumbers
litellm_proxy
```

**Headers:**
```text showLineNumbers
x-litellm-api-key: Bearer YOUR_LITELLM_API_KEY
x-mcp-auth: Bearer YOUR_MCP_AUTH_TOKEN
```

This URL can be used with any MCP client that supports HTTP transport. The `x-mcp-auth` header will be forwarded to your MCP server for authentication.

</TabItem>

<TabItem value="fastmcp" label="Python FastMCP">

#### Connect via Python FastMCP Client with Server-Specific Auth

Use the Python FastMCP client to connect to your LiteLLM MCP server with server-specific authentication:

```python title="Python FastMCP Example with Server-Specific Auth" showLineNumbers
import asyncio
import json

from fastmcp import Client
from fastmcp.client.transports import StreamableHttpTransport

# Create the transport with your LiteLLM MCP server URL and server-specific auth headers
server_url = "litellm_proxy"
transport = StreamableHttpTransport(
    server_url,
    headers={
        "x-litellm-api-key": "Bearer YOUR_LITELLM_API_KEY",
        "x-mcp-github-authorization": "Bearer YOUR_GITHUB_TOKEN",
        "x-mcp-zapier-x-api-key": "YOUR_ZAPIER_API_KEY"
    }
)

# Initialize the client with the transport
client = Client(transport=transport)


async def main():
    # Connection is established here
    print("Connecting to LiteLLM MCP server with server-specific authentication...")
    async with client:
        print(f"Client connected: {client.is_connected()}")

        # Make MCP calls within the context
        print("Fetching available tools...")
        tools = await client.list_tools()

        print(f"Available tools: {json.dumps([t.name for t in tools], indent=2)}")
        
        # Example: Call a tool (replace 'tool_name' with an actual tool name)
        if tools:
            tool_name = tools[0].name
            print(f"Calling tool: {tool_name}")
            
            # Call the tool with appropriate arguments
            result = await client.call_tool(tool_name, arguments={})
            print(f"Tool result: {result}")


# Run the example
if __name__ == "__main__":
    asyncio.run(main())
```

#### Connect via Python FastMCP Client with Legacy Auth

Use the Python FastMCP client to connect to your LiteLLM MCP server with MCP authentication:

```python title="Python FastMCP Example with Legacy MCP Auth" showLineNumbers
import asyncio
import json

from fastmcp import Client
from fastmcp.client.transports import StreamableHttpTransport

# Create the transport with your LiteLLM MCP server URL and auth headers
server_url = "litellm_proxy"
transport = StreamableHttpTransport(
    server_url,
    headers={
        "x-litellm-api-key": "Bearer YOUR_LITELLM_API_KEY",
        "x-mcp-auth": "Bearer YOUR_MCP_AUTH_TOKEN"
    }
)

# Initialize the client with the transport
client = Client(transport=transport)


async def main():
    # Connection is established here
    print("Connecting to LiteLLM MCP server with authentication...")
    async with client:
        print(f"Client connected: {client.is_connected()}")

        # Make MCP calls within the context
        print("Fetching available tools...")
        tools = await client.list_tools()

        print(f"Available tools: {json.dumps([t.name for t in tools], indent=2)}")
        
        # Example: Call a tool (replace 'tool_name' with an actual tool name)
        if tools:
            tool_name = tools[0].name
            print(f"Calling tool: {tool_name}")
            
            # Call the tool with appropriate arguments
            result = await client.call_tool(tool_name, arguments={})
            print(f"Tool result: {result}")


# Run the example
if __name__ == "__main__":
    asyncio.run(main())
```

</TabItem>
</Tabs>

### Customize the MCP Auth Header Name

By default, LiteLLM uses `x-mcp-auth` to pass your credentials to MCP servers. You can change this header name in one of the following ways:
1. Set the `LITELLM_MCP_CLIENT_SIDE_AUTH_HEADER_NAME` environment variable

```bash title="Environment Variable" showLineNumbers
export LITELLM_MCP_CLIENT_SIDE_AUTH_HEADER_NAME="authorization"
```


2. Set the `mcp_client_side_auth_header_name` in the general settings on the config.yaml file

```yaml title="config.yaml" showLineNumbers
model_list:
  - model_name: gpt-4o
    litellm_params:
      model: openai/gpt-4o
      api_key: sk-xxxxxxx

general_settings:
  mcp_client_side_auth_header_name: "authorization"
```

#### Using the authorization header

In this example the `authorization` header will be passed to the MCP server for authentication.

```bash title="cURL with authorization header" showLineNumbers
curl --location '<your-litellm-proxy-base-url>/v1/responses' \
--header 'Content-Type: application/json' \
--header "Authorization: Bearer $LITELLM_API_KEY" \
--data '{
    "model": "gpt-4o",
    "tools": [
        {
            "type": "mcp",
            "server_label": "litellm",
            "server_url": "litellm_proxy",
            "require_approval": "never",
            "headers": {
                "x-litellm-api-key": "Bearer YOUR_LITELLM_API_KEY",
                "authorization": "Bearer sk-zapier-token-123"
            }
        }
    ],
    "input": "Run available tools",
    "tool_choice": "required"
}'
```

## Forwarding Custom Headers to MCP Servers

LiteLLM supports forwarding additional custom headers from MCP clients to backend MCP servers using the `extra_headers` configuration parameter. This allows you to pass custom authentication tokens, API keys, or other headers that your MCP server requires.

**Configuration**


<Tabs>
<TabItem value="config" label="config.yaml">
Configure `extra_headers` in your MCP server configuration to specify which header names should be forwarded:

```yaml title="config.yaml with extra_headers" showLineNumbers
mcp_servers:
  github_mcp:
    url: "https://api.githubcopilot.com/mcp"
    auth_type: "bearer_token"
    auth_value: "ghp_default_token"
    extra_headers: ["custom_key", "x-custom-header", "Authorization"]
    description: "GitHub MCP server with custom header forwarding"
```
</TabItem>
<TabItem value="clientside" label="Dynamically on Client Side">

Use this when giving users access to a [group of MCP servers](/docs/mcp_control#control-mcp-access-for-end-users).

**Format:** `x-mcp-{server_alias}-{header_name}: value`

This allows you to use different authentication for different MCP servers.


**Examples:**
- `x-mcp-github-authorization: Bearer ghp_xxxxxxxxx` - GitHub MCP server with Bearer token
- `x-mcp-zapier-x-api-key: sk-xxxxxxxxx` - Zapier MCP server with API key
- `x-mcp-deepwiki-authorization: Basic base64_encoded_creds` - DeepWiki MCP server with Basic auth

```python title="Python Client with Server-Specific Auth" showLineNumbers
from fastmcp import Client
import asyncio

# Standard MCP configuration with multiple servers
config = {
    "mcpServers": {
        "mcp_group": {
            "url": "http://localhost:4000/mcp/",
            "headers": {
                "x-mcp-servers": "dev_group", # assume this gives access to github, zapier and deepwiki
                "x-litellm-api-key": "Bearer sk-1234",
                "x-mcp-github-authorization": "Bearer gho_token", 
                "x-mcp-zapier-x-api-key": "sk-xxxxxxxxx",
                "x-mcp-deepwiki-authorization": "Basic base64_encoded_creds",
                "custom_key": "value"
            }
        }
    }
}

# Create a client that connects to all servers
client = Client(config)


async def main():
    async with client:
        tools = await client.list_tools()
        print(f"Available tools: {tools}")

        # call mcp 
        await client.call_tool(
            name="github_mcp-search_issues",
            arguments={'query': 'created:>2024-01-01', 'sort': 'created', 'order': 'desc', 'perPage': 30}
        )

if __name__ == "__main__":
    asyncio.run(main())

```



**Benefits:**
- **Server-specific authentication**: Each MCP server can use different auth methods
- **Better security**: No need to share the same auth token across all servers
- **Flexible header names**: Support for different auth header types (authorization, x-api-key, etc.)
- **Clean separation**: Each server's auth is clearly identified



</TabItem>
</Tabs>


#### Client Usage

When connecting from MCP clients, include the custom headers that match the `extra_headers` configuration:

<Tabs>
<TabItem value="fastmcp" label="Python FastMCP">

```python title="FastMCP Client with Custom Headers" showLineNumbers
from fastmcp import Client
import asyncio

# MCP client configuration with custom headers
config = {
    "mcpServers": {
        "github": {
            "url": "http://localhost:4000/github_mcp/mcp",
            "headers": {
                "x-litellm-api-key": "Bearer sk-1234",
                "Authorization": "Bearer gho_token", 
                "custom_key": "custom_value",
                "x-custom-header": "additional_data"
            }
        }
    }
}

# Create a client that connects to the server
client = Client(config)

async def main():
    async with client:
        # List available tools
        tools = await client.list_tools()
        print(f"Available tools: {tools}")
        
        # Call a tool if available
        if tools:
            result = await client.call_tool(tools[0].name, {})
            print(f"Tool result: {result}")

# Run the client
asyncio.run(main())
```

</TabItem>

<TabItem value="cursor" label="Cursor IDE">

```json title="Cursor MCP Configuration with Custom Headers" showLineNumbers
{
  "mcpServers": {
    "GitHub": {
      "url": "http://localhost:4000/github_mcp/mcp",
      "headers": {
        "x-litellm-api-key": "Bearer $LITELLM_API_KEY",
        "Authorization": "Bearer $GITHUB_TOKEN",
        "custom_key": "custom_value",
        "x-custom-header": "additional_data"
      }
    }
  }
}
```

</TabItem>

<TabItem value="http" label="HTTP Client">

```bash title="cURL with Custom Headers" showLineNumbers
curl --location 'http://localhost:4000/github_mcp/mcp' \
--header 'Content-Type: application/json' \
--header 'x-litellm-api-key: Bearer sk-1234' \
--header 'Authorization: Bearer gho_token' \
--header 'custom_key: custom_value' \
--header 'x-custom-header: additional_data' \
--data '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
}'
```

</TabItem>
</Tabs>

#### How It Works

1. **Configuration**: Define `extra_headers` in your MCP server config with the header names you want to forward
2. **Client Headers**: Include the corresponding headers in your MCP client requests
3. **Header Forwarding**: LiteLLM automatically forwards matching headers to the backend MCP server
4. **Authentication**: The backend MCP server receives both the configured auth headers and the custom headers


### Passing Request Headers to STDIO env Vars

If your stdio MCP server needs per-request credentials, you can map HTTP headers from the client request directly into the environment for the launched stdio process. Reference the header name in the env value using the `${X-HEADER_NAME}` syntax. LiteLLM will read that header from the incoming request and set the env var before starting the command.

```json title="Forward X-GITHUB_PERSONAL_ACCESS_TOKEN header to stdio env" showLineNumbers
{
  "mcpServers": {
    "github": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e",
        "GITHUB_PERSONAL_ACCESS_TOKEN",
        "ghcr.io/github/github-mcp-server"
      ],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${X-GITHUB_PERSONAL_ACCESS_TOKEN}"
      }
    }
  }
}
```

In this example, when a client makes a request with the `X-GITHUB_PERSONAL_ACCESS_TOKEN` header, the proxy forwards that value into the stdio process as the `GITHUB_PERSONAL_ACCESS_TOKEN` environment variable.
