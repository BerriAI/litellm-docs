import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import Image from '@theme/IdealImage';

# MCP Configuration Reference

Full reference for configuring MCP servers on LiteLLM, from the UI or `config.yaml`. For the minimal setup flow, start with the [MCP Quickstart](./mcp.md).

## config.yaml Options

```yaml title="config.yaml" showLineNumbers
model_list:
  - model_name: gpt-4o
    litellm_params:
      model: openai/gpt-4o
      api_key: sk-xxxxxxx

litellm_settings:
  # MCP Aliases - Map aliases to server names for easier tool access
  mcp_aliases:
    "github": "github_mcp_server"
    "zapier": "zapier_mcp_server"
    "deepwiki": "deepwiki_mcp_server"

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

  # Full configuration with all optional fields
  my_http_server:
    url: "https://my-mcp-server.com/mcp"
    transport: "http"
    description: "My custom MCP server"
    auth_type: "api_key"
    auth_value: "abc123"
```

**Configuration Options:**
- **Server Name**: Use any descriptive name for your MCP server (e.g., `zapier_mcp`, `deepwiki_mcp`, `circleci_mcp`)
- **Alias**: This name will be prefilled with the server name with "_" replacing spaces, else edit it to be the prefix in tool names
- **URL**: The endpoint URL for your MCP server (required for HTTP/SSE transports)
- **Transport**: Optional transport type (defaults to `sse`)
  - `sse` - SSE (Server-Sent Events) transport
  - `http` - Streamable HTTP transport
  - `stdio` - Standard Input/Output transport
- **Command**: The command to execute for stdio transport (required for stdio)
- **allow_all_keys**: Set to `true` to make the server available to every LiteLLM API key, even if the key/team doesn't list the server in its MCP permissions.
- **Args**: Array of arguments to pass to the command (optional for stdio)
- **Env**: Environment variables to set for the stdio process (optional for stdio)
- **Description**: Optional description for the server
- **Auth Type**: Optional authentication type. See [Auth Types](#auth-types) below.
- **Extra Headers**: Optional list of additional header names that should be forwarded from client to the MCP server
- **Static Headers**: Optional map of header key/value pairs to include every request to the MCP server.
- **Spec Version**: Optional MCP specification version (defaults to `2025-06-18`)

## Auth Types

Supported `auth_type` values:

| Value | Header sent (managed SSE/HTTP transport) |
|-------|-------------|
| `none` | No auth header added |
| `api_key` | `X-API-Key: <auth_value>` |
| `bearer_token` | `Authorization: Bearer <auth_value>` |
| `basic` | `Authorization: Basic <auth_value>` |
| `authorization` | `Authorization: <auth_value>` (verbatim, no prefix) |
| `token` | `Authorization: token <auth_value>` (GitHub-style) |
| `oauth2` | `Authorization: Bearer <resolved_token>`; PKCE or M2M `client_credentials`. See [MCP OAuth](./mcp_oauth.md) |
| `oauth2_token_exchange` | `Authorization: Bearer <exchanged_token>`; RFC 8693 On-Behalf-Of. See [MCP OBO Auth](./mcp_obo_auth.md) |
| `aws_sigv4` | Per-request AWS SigV4 signature. See [MCP AWS SigV4](./mcp_aws_sigv4.md) |

The header shown above is the default. Set `upstream_token_header` on the server to send the resolved token somewhere other than `Authorization`, which is what an MCP server behind an API gateway usually needs. See [MCP OAuth](./mcp_oauth.md#sending-the-token-on-a-different-header)

Note: the header table above describes the managed SSE/HTTP transport path. The OpenAPI-tool path emits `Authorization: ApiKey <value>` instead of `X-API-Key` for `auth_type: api_key`; the deprecated `x-mcp-auth` broadcast header also uses the `ApiKey` form.

Examples for each auth type:

```yaml title="MCP auth examples (config.yaml)" showLineNumbers
mcp_servers:
  api_key_example:
    url: "https://my-mcp-server.com/mcp"
    auth_type: "api_key"
    auth_value: "abc123"        # headers={"X-API-Key": "abc123"}

  # OAuth 2.0 Client Credentials (v1.77.5)
  oauth2_example:
    url: "https://my-mcp-server.com/mcp"
    auth_type: "oauth2"
    authorization_url: "https://my-mcp-server.com/oauth/authorize" # optional override
    token_url: "https://my-mcp-server.com/oauth/token"             # optional override
    registration_url: "https://my-mcp-server.com/oauth/register"   # optional override
    client_id: os.environ/OAUTH_CLIENT_ID
    client_secret: os.environ/OAUTH_CLIENT_SECRET
    scopes: ["tool.read", "tool.write"] # optional override

  bearer_example:
    url: "https://my-mcp-server.com/mcp"
    auth_type: "bearer_token"
    auth_value: "abc123"        # headers={"Authorization": "Bearer abc123"}

  basic_example:
    url: "https://my-mcp-server.com/mcp"
    auth_type: "basic"
    auth_value: "dXNlcjpwYXNz"  # headers={"Authorization": "Basic dXNlcjpwYXNz"}

  custom_auth_example:
    url: "https://my-mcp-server.com/mcp"
    auth_type: "authorization"
    auth_value: "Token example123"  # headers={"Authorization": "Token example123"}

  # AWS SigV4 for Bedrock AgentCore MCP servers
  agentcore_mcp:
    url: "https://bedrock-agentcore.us-east-1.amazonaws.com/runtimes/<url-encoded-ARN>/invocations"
    transport: "http"
    auth_type: "aws_sigv4"
    aws_role_name: os.environ/AWS_ROLE_ARN          # optional, IAM role to assume
    aws_access_key_id: os.environ/AWS_ACCESS_KEY_ID  # optional, falls back to IAM role
    aws_secret_access_key: os.environ/AWS_SECRET_ACCESS_KEY
    aws_region_name: us-east-1
    aws_service_name: bedrock-agentcore

  # Example with extra headers forwarding
  github_mcp:
    url: "https://api.githubcopilot.com/mcp"
    auth_type: "bearer_token"
    auth_value: "ghp_example_token"
    extra_headers: ["custom_key", "x-custom-header"]  # These headers will be forwarded from client

  # Example with static headers
  my_mcp_server:
    url: "https://my-mcp-server.com/mcp"
    static_headers: # These headers will be requested to the MCP server
      X-API-Key: "abc123"
      X-Custom-Header: "some-value"
```

## OAuth Configuration & Overrides

LiteLLM attempts [OAuth 2.0 Authorization Server Discovery](https://datatracker.ietf.org/doc/html/rfc8414) by default. When you create an MCP server in the UI and set `Authentication: OAuth`, LiteLLM will locate the provider metadata, dynamically register a client, and perform PKCE-based authorization without you providing any additional details.

**Customize the OAuth flow when needed:**

<Image 
  img={require('../img/mcp_oauth.png')}
  style={{width: '80%', display: 'block', margin: '0'}}
/>

- **Provide explicit client credentials**: If the MCP provider does not offer dynamic client registration or you prefer to manage the client yourself, fill in `client_id`, `client_secret`, and the desired `scopes`.
- **Override discovery URLs**: In some environments, LiteLLM might not be able to reach the provider's metadata endpoints. Use the optional `authorization_url`, `token_url`, and `registration_url` fields to point LiteLLM directly to the correct endpoints.

See the [MCP OAuth guide](./mcp_oauth.md) for the full flow reference, sequence diagrams, and a test server.

## AWS SigV4 Authentication

For MCP servers hosted on [AWS Bedrock AgentCore](https://docs.aws.amazon.com/bedrock/latest/userguide/agentcore.html), select **AWS SigV4** as the authentication type. LiteLLM will sign every outgoing MCP request with your AWS credentials using [Signature Version 4](https://docs.aws.amazon.com/general/latest/gr/signature-version-4.html).

<Image
  img={require('../img/mcp_aws_sigv4_ui.png')}
  style={{width: '80%', display: 'block', margin: '0'}}
/>

Fill in your AWS region, service name (defaults to `bedrock-agentcore`), and optionally your AWS access key and secret. If credentials are omitted, LiteLLM falls back to the boto3 credential chain (IAM roles, environment variables, etc.).

[**See full SigV4 setup guide**](./mcp_aws_sigv4.md)

## Static Headers

Sometimes your MCP server needs specific headers on every request. Maybe it's an API key, maybe it's a custom header the server expects. Instead of configuring auth, you can just set them directly.

<Image 
  img={require('../img/static_headers.png')}
  style={{width: '80%', display: 'block', margin: '0'}}
/>

These headers get sent with every request to the server. That's it.

**When to use this:**
- Your server needs custom headers that don't fit the standard auth patterns
- You want full control over exactly what headers are sent
- You're debugging and need to quickly add headers without changing auth configuration

## Server Variables

Store credentials on the server and reference them in static headers or authentication with `${VAR_NAME}` (e.g. `${DB_PROTOCOL}://${CORP_USERNAME}:${CORP_PASSWORD}@${DB_HOSTNAME}`). Scope each variable as **Instance** (shared) or **Per-user** (each user supplies their own).

<iframe width="840" height="500" src="https://www.loom.com/embed/12878e2be19140069170c3a270b50d1c" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen></iframe>

**When to use this:**
- Each user needs to connect with their own static credentials
- You want to reuse certain shared details (e.g., DB url) across users

## Fine-grained Database Storage Control

By default, when `store_model_in_db` is `true`, all object types (models, MCPs, guardrails, vector stores, etc.) are stored in the database. If you want to store only specific object types, use the `supported_db_objects` setting.

**Example: Store only MCP servers in the database**

```yaml title="config.yaml" showLineNumbers
general_settings:
  store_model_in_db: true
  supported_db_objects: ["mcp"]  # Only store MCP servers in DB

model_list:
  - model_name: gpt-4o
    litellm_params:
      model: openai/gpt-4o
      api_key: sk-xxxxxxx
```

**See all available object types:** [Config Settings - supported_db_objects](./proxy/config_settings.md#general_settings---reference)

If `supported_db_objects` is not set, all object types are loaded from the database (default behavior).

## MCP Aliases

You can define aliases for your MCP servers in the `litellm_settings` section. This allows you to:

1. **Map friendly names to server names**: Use shorter, more memorable aliases
2. **Override server aliases**: If a server doesn't have an alias defined, the system will use the first matching alias from `mcp_aliases`
3. **Ensure uniqueness**: Only the first alias for each server is used, preventing conflicts

**Example:**
```yaml
litellm_settings:
  mcp_aliases:
    "github": "github_mcp_server"      # Maps "github" alias to "github_mcp_server"
    "zapier": "zapier_mcp_server"      # Maps "zapier" alias to "zapier_mcp_server"
    "docs": "deepwiki_mcp_server"      # Maps "docs" alias to "deepwiki_mcp_server"
    "github_alt": "github_mcp_server"  # This will be ignored since "github" already maps to this server
```

**Benefits:**
- **Simplified tool access**: Use `github_create_issue` instead of `github_mcp_server_create_issue`
- **Consistent naming**: Standardize alias patterns across your organization
- **Easy migration**: Change server names without breaking existing tool references

## MCP Walkthroughs

- **Strands (STDIO)**: [watch tutorial](https://screen.studio/share/ruv4D73F)

> Add it from the UI

```json title="strands-mcp" showLineNumbers
{
  "mcpServers": {
    "strands-agents": {
      "command": "uvx",
      "args": ["strands-agents-mcp-server"],
      "env": {
        "FASTMCP_LOG_LEVEL": "INFO"
      },
      "disabled": false,
      "autoApprove": ["search_docs", "fetch_doc"]
    }
  }
}
```

> config.yml

```yaml title="config.yml – strands MCP" showLineNumbers
mcp_servers:
  strands_mcp:
    transport: "stdio"
    command: "uvx"
    args: ["strands-agents-mcp-server"]
    env:
      FASTMCP_LOG_LEVEL: "INFO"
```
