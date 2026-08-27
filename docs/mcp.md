import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import Image from '@theme/IdealImage';

# MCP Overview

LiteLLM Proxy provides an MCP Gateway that allows you to use a fixed endpoint for all MCP tools and control MCP access by Key, Team. 

<Image 
  img={require('../img/mcp_2.png')}
  style={{width: '100%', display: 'block', margin: '2rem auto'}}
/>
<p style={{textAlign: 'left', color: '#666'}}>
  LiteLLM MCP Architecture: Use MCP tools with all LiteLLM supported models
</p>

## Choose your path

This page is the quickstart: enable storage, add an MCP server, and make your first tool call. Once that works, jump to the guide that matches your job:

| I want to... | Go to |
|--------------|-------|
| Add a server and make my first tool call | [Quickstart](#adding-your-mcp) (this page) |
| Connect a direct MCP client (Cursor, Claude Code, FastMCP) | [Using your MCP](./mcp_usage.md) |
| Invoke MCP tools through `/v1/responses` or `/chat/completions` | [Using your MCP](./mcp_usage.md#use-with-responses-api) |
| Call a tool over plain HTTP, without an LLM | [MCP REST API](./mcp_rest_api.md) |
| Configure auth types, static headers, server variables, aliases | [MCP Configuration Reference](./mcp_config_reference.md) |
| Secure production access (OAuth, permissions, guardrails) | [MCP OAuth](./mcp_oauth.md) and [MCP Permission Management](./mcp_control.md) |
| Deploy, track cost, or debug | [Deployment](./mcp_deployment.md), [Cost Tracking](./mcp_cost.md), [Troubleshooting](./mcp_troubleshoot.md) |

## Overview
| Feature | Description |
|---------|-------------|
| MCP Operations | • List Tools<br/>• Call Tools <br/>• Prompts <br/>• Resources |
| Direct REST API | [`/mcp-rest/tools/list` and `/mcp-rest/tools/call`](./mcp_rest_api.md); call tools with curl without an LLM |
| Supported MCP Transports | • Streamable HTTP<br/>• SSE<br/>• Standard Input/Output (stdio) |
| LiteLLM Permission Management | • By Key<br/>• By Team<br/>• By Organization |

:::caution MCP protocol update
Starting in LiteLLM v1.80.18, the LiteLLM MCP protocol version is `2025-11-25`.<br/> 
LiteLLM namespaces multiple MCP servers by prefixing each tool name with its MCP server name, so newly created servers now must use names that comply with SEP-986; noncompliant names cannot be added anymore. Existing servers that still violate SEP-986 only emit warnings today, but future MCP-side rollouts may block those names entirely, so we recommend updating any legacy server names proactively before MCP enforcement makes them unusable.
:::

## Adding your MCP

### Prerequisites

To store MCP servers in the database, you need to enable database storage:

**Environment Variable:**
```bash
export STORE_MODEL_IN_DB=True
```

**OR in config.yaml:**
```yaml
general_settings:
  store_model_in_db: true
```

To store only specific object types in the database, see [Fine-grained Database Storage Control](./mcp_config_reference.md#fine-grained-database-storage-control).

For diagnosing connectivity problems after setup, see the [MCP Troubleshooting Guide](./mcp_troubleshoot.md).

<Tabs>
<TabItem value="ui" label="LiteLLM UI">

On the LiteLLM UI, Navigate to "MCP Servers" and click "Add New MCP Server".

On this form, you should enter your MCP Server URL and the transport you want to use.

LiteLLM supports the following MCP transports:
- Streamable HTTP
- SSE (Server-Sent Events)
- Standard Input/Output (stdio)

<Image 
  img={require('../img/add_mcp.png')}
  style={{width: '80%', display: 'block', margin: '0'}}
/>

<br/>
<br/>

### Add HTTP MCP Server

This video walks through adding and using an HTTP MCP server on LiteLLM UI and using it in Cursor IDE.

<iframe width="840" height="500" src="https://www.loom.com/embed/e2aebce78e8d46beafeb4bacdde31f14" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen></iframe>

<br/>
<br/>

### Add SSE MCP Server

This video walks through adding and using an SSE MCP server on LiteLLM UI and using it in Cursor IDE.

<iframe width="840" height="500" src="https://www.loom.com/embed/07e04e27f5e74475b9cf8ef8247d2c3e" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen></iframe>

<br/>
<br/>

### Add STDIO MCP Server

For stdio MCP servers, select "Standard Input/Output (stdio)" as the transport type and provide the stdio configuration in JSON format:

<Image 
  img={require('../img/add_stdio_mcp.png')}
  style={{width: '80%', display: 'block', margin: '0'}}
/>

<br/>
<br/>

For UI-side authentication options (OAuth, AWS SigV4, static headers, server variables), see the [MCP Configuration Reference](./mcp_config_reference.md).

</TabItem>

<TabItem value="config" label="config.yaml">

Add your MCP servers directly in your `config.yaml` file:

```yaml title="config.yaml" showLineNumbers
model_list:
  - model_name: gpt-4o
    litellm_params:
      model: openai/gpt-4o
      api_key: sk-xxxxxxx

mcp_servers:
  # HTTP Streamable Server
  deepwiki_mcp:
    url: "https://mcp.deepwiki.com/mcp"
  # SSE Server
  zapier_mcp:
    url: "https://actions.zapier.com/mcp/sk-akxxxxx/sse"

  # Standard Input/Output (stdio) Server - CircleCI Example
  circleci_mcp:
    transport: "stdio"
    command: "npx"
    args: ["-y", "@circleci/mcp-server-circleci"]
    env:
      CIRCLECI_TOKEN: "your-circleci-token"
      CIRCLECI_BASE_URL: "https://circleci.com"
```

The full list of fields (transports, auth types, `extra_headers`, `static_headers`, `allow_all_keys`, aliases) is in the [MCP Configuration Reference](./mcp_config_reference.md).

</TabItem>
</Tabs>

## Make your first tool call

With a server registered, call it through the proxy's `/v1/responses` endpoint. Use the literal value `litellm_proxy` as the `server_url` so the proxy routes to its configured MCP servers:

```bash title="First MCP tool call" showLineNumbers
curl --location 'http://localhost:4000/v1/responses' \
--header 'Content-Type: application/json' \
--header "Authorization: Bearer $LITELLM_API_KEY" \
--data '{
    "model": "gpt-4o",
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

You can also verify the server directly, with no LLM involved:

```bash title="List tools over REST" showLineNumbers
curl http://localhost:4000/mcp-rest/tools/list \
  -H "Authorization: Bearer $LITELLM_API_KEY"
```

From here, [Using your MCP](./mcp_usage.md) covers connecting real clients (Cursor, Claude Code, FastMCP), passing client-side credentials, and using MCP tools with `/chat/completions`.

## Where detailed guides live

Each topic below used to live on this page and now has one canonical owner page.

### Converting OpenAPI Specs to MCP Servers

LiteLLM can convert OpenAPI specifications into MCP servers, exposing any REST API as MCP tools without writing custom server code. See the **[MCP from OpenAPI Specs guide](./mcp_openapi.md)**.

### MCP OAuth

LiteLLM supports OAuth 2.0 for MCP servers -- both interactive (PKCE) flows for user-facing clients and machine-to-machine (M2M) `client_credentials` for backend services. See the **[MCP OAuth guide](./mcp_oauth.md)** for setup instructions, the full sequence diagram, and a test server. For passthrough modes see [MCP OAuth Passthrough](./mcp_oauth_passthrough.md), and for token exchange see [MCP OBO Auth](./mcp_obo_auth.md).

### AWS SigV4 Authentication

For MCP servers hosted on AWS Bedrock AgentCore, LiteLLM signs every outgoing MCP request with your AWS credentials. See the **[MCP AWS SigV4 guide](./mcp_aws_sigv4.md)**.

### Forwarding Custom Headers to MCP Servers

Forward additional custom headers from MCP clients to backend MCP servers with `extra_headers`, including mapping request headers into stdio env vars. See **[Using your MCP: Forwarding Custom Headers](./mcp_usage.md#forwarding-custom-headers-to-mcp-servers)**.

### MCP Aliases

Assign a short, stable alias to an MCP server so URLs and headers stay readable. See **[MCP Configuration Reference: MCP Aliases](./mcp_config_reference.md#mcp-aliases)**.

### Server Variables

Parameterize MCP server URLs and headers with per-request variables. See **[MCP Configuration Reference: Server Variables](./mcp_config_reference.md#server-variables)**.

### Control MCP Access for End Users

Enforce object permissions, budgets, and spend tracking for end users of your AI application via the `x-litellm-end-user-id` header. See **[MCP Permission Management: Control MCP Access for End Users](./mcp_control.md#control-mcp-access-for-end-users)**.

### Calling the Proxy's /v1/responses Endpoint

Full examples for `/v1/responses` with `server_url: "litellm_proxy"`, including sending custom headers to specific MCP servers. See **[Using your MCP](./mcp_usage.md#calling-the-proxys-v1responses-endpoint)**.

### Using your MCP with client side credentials

Pass a client-side authentication token through LiteLLM to your MCP server, per server (`x-mcp-{server_alias}-{header_name}`) or via the legacy `x-mcp-auth` header. See **[Using your MCP: client side credentials](./mcp_usage.md#using-your-mcp-with-client-side-credentials)**.

### Use MCP tools with `/chat/completions`

MCP-aware tooling on the classic `/v1/chat/completions` endpoint works with every LLM provider behind LiteLLM. See **[Using your MCP: /chat/completions](./mcp_usage.md#use-mcp-tools-with-chatcompletions)**.

### LiteLLM Python SDK MCP Bridge

Use `litellm.experimental_mcp_client` to list and call MCP tools from the Python SDK with any LiteLLM supported model. See the **[LiteLLM Python SDK MCP Bridge guide](./mcp_sdk.md)**.

## LiteLLM Proxy - Walk through MCP Gateway
LiteLLM exposes an MCP Gateway for admins to add all their MCP servers to LiteLLM. The key benefits of using LiteLLM Proxy with MCP are:

1. Use a fixed endpoint for all MCP tools
2. MCP Permission management by Key, Team, or User

This video demonstrates how you can onboard an MCP server to LiteLLM Proxy, use it and set access controls.

<iframe width="840" height="500" src="https://www.loom.com/embed/f7aa8d217879430987f3e64291757bfc" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen></iframe>

## FAQ

**Q: How do I use OAuth2 client_credentials (machine-to-machine) with MCP servers behind LiteLLM?**

LiteLLM supports automatic token management for the `client_credentials` grant. Configure `client_id`, `client_secret`, and `token_url` on your MCP server and LiteLLM will fetch, cache, and refresh tokens automatically. See the [MCP OAuth M2M guide](./mcp_oauth.md#machine-to-machine-m2m-auth) for setup instructions.

**Q: When I fetch an OAuth token from the LiteLLM UI, where is it stored?**

The UI keeps only transient state in `sessionStorage` so the OAuth redirect flow can finish; the token is not persisted in the server or database.

**Q: I'm seeing MCP connection errors. What should I check?**

Walk through the [MCP Troubleshooting Guide](./mcp_troubleshoot.md) for step-by-step isolation (Client → LiteLLM vs. LiteLLM → MCP), log examples, and verification methods like MCP Inspector and `curl`.
