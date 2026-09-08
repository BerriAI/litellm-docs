# MCP Non-OAuth Authentication

This page covers upstream MCP authentication that does not use an OAuth flow, including no authentication, fixed credentials, and AWS SigV4. For OAuth setup, see [MCP OAuth](./mcp_oauth.md), [MCP OAuth Passthrough](./mcp_oauth_passthrough.md), or [MCP On-Behalf-Of Auth](./mcp_obo_auth.md).

LiteLLM handles two separate authentication hops for an MCP request:

- **Client to LiteLLM:** the MCP client proves that it can use the LiteLLM gateway, usually with a LiteLLM API key.
- **LiteLLM to the upstream MCP server:** LiteLLM authenticates to the selected upstream according to that server's `auth_type`.

The `auth_type` on an MCP server controls the second hop. A LiteLLM API key used for gateway admission is not copied to the upstream server.

:::note Transport scope

The wire examples on this page cover remote MCP servers using SSE or Streamable HTTP. [OpenAPI-generated MCP tools](./mcp_openapi.md) have separate auth-header handling.

:::

## Choose a non-OAuth auth type

For a fixed, non-OAuth credential, choose the type that matches the header required by the upstream server:

| `auth_type` | What you provide | Default credential sent upstream | Use case |
|---|---|---|---|
| `none` | Nothing | No credential | The upstream allows anonymous requests or relies on network-level access control |
| `api_key` | API key value | `X-API-Key: <auth_value>` | The upstream expects an `X-API-Key` header |
| `bearer_token` | Token only | `Authorization: Bearer <auth_value>` | A fixed bearer token, personal access token, or service token |
| `basic` | Raw `username:password` | `Authorization: Basic <base64(username:password)>` | HTTP Basic authentication |
| `token` | Token only | `Authorization: token <auth_value>` | An upstream that explicitly uses the GitHub-style `token` scheme |
| `authorization` | Complete header value, including its scheme | `Authorization: <auth_value>` | A custom authorization scheme; available in config and API |
| `aws_sigv4` | AWS credentials or an IAM role | A new AWS SigV4 signature for each request | AWS Bedrock AgentCore MCP servers |

## What the client sends

Static upstream credentials are stored on the MCP server configuration. The client does not send the upstream username, password, or API key on each tool request.

For example, the client can make the same request whether the upstream server uses `none`, `basic`, or `api_key`:

```http title="Client to LiteLLM"
POST /inventory/mcp HTTP/1.1
Host: litellm.example.com
x-litellm-api-key: Bearer sk-litellm
Content-Type: application/json

{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}
```

LiteLLM authenticates the client, selects the `inventory` MCP server, and builds the upstream request from that server's `auth_type`. The following sections show the resulting upstream credential.

The client does supply the upstream token for `true_passthrough` and `oauth_delegate`. See [MCP OAuth Passthrough](./mcp_oauth_passthrough.md).

## Non-OAuth auth types

### None

`auth_type: none` means the auth resolver contributes no upstream credential.

- **Behavior:** LiteLLM adds no `Authorization`, `X-API-Key`, or other credential header for this auth type.
- **Use when:** the upstream MCP endpoint requires no application credential. Common examples are a public MCP server or a private endpoint protected by network policy.
- **Do not use when:** the upstream requires Basic Auth, an API key, a bearer token, or a caller-owned token.

```yaml title="config.yaml"
mcp_servers:
  public_inventory:
    url: "https://mcp.example.com/mcp"
    transport: "http"
    auth_type: "none"
```

The upstream request has no auth credential added by LiteLLM:

```http title="LiteLLM to upstream"
POST /mcp HTTP/1.1
Host: mcp.example.com
Content-Type: application/json
```

:::warning Do not put credentials in the URL

A URL such as `https://username:password@mcp.example.com/mcp` is rejected when `auth_type` is `none`. LiteLLM does not infer Basic Auth from URL userinfo. Remove the credentials from the URL and configure [`auth_type: basic`](#basic-auth) instead.

:::

### Basic Auth

`auth_type: basic` turns a raw username and password into a standard HTTP Basic header.

- **Authentication value:** enter `username:password`. Do not base64-encode it and do not add the `Basic` prefix.
- **Behavior:** LiteLLM base64-encodes the full value, adds the `Basic` scheme, and sends the same service credential on every upstream request.
- **Use when:** the upstream documentation asks for HTTP Basic authentication.

```yaml title="config.yaml"
mcp_servers:
  inventory:
    url: "https://mcp.example.com/mcp"
    transport: "http"
    auth_type: "basic"
    auth_value: os.environ/MCP_BASIC_AUTH # value: username:password
```

For `MCP_BASIC_AUTH=username:password`, LiteLLM sends:

```http title="LiteLLM to upstream"
Authorization: Basic dXNlcm5hbWU6cGFzc3dvcmQ=
```

The username and password belong in `auth_value`, not in the server URL.

### API key

`auth_type: api_key` sends one fixed key in `X-API-Key`.

- **Authentication value:** enter only the key value.
- **Behavior:** LiteLLM sends the same key on each upstream request.
- **Use when:** the upstream documentation requires `X-API-Key`.

```yaml title="config.yaml"
mcp_servers:
  inventory:
    url: "https://mcp.example.com/mcp"
    transport: "http"
    auth_type: "api_key"
    auth_value: os.environ/INVENTORY_API_KEY
```

```http title="LiteLLM to upstream"
X-API-Key: <INVENTORY_API_KEY>
```

If the upstream expects a different header name, use [`static_headers`](#custom-and-forwarded-headers) or set `upstream_token_header`.

### Bearer token

`auth_type: bearer_token` adds the `Bearer` scheme to a fixed token.

- **Authentication value:** enter only the token. Do not add the `Bearer` prefix.
- **Behavior:** LiteLLM sends `Authorization: Bearer <token>` on each upstream request.
- **Use when:** the upstream accepts a fixed bearer token, such as a service token or personal access token. For tokens that must be minted, refreshed, exchanged, or supplied by the caller, see [MCP OAuth](./mcp_oauth.md).

```yaml title="config.yaml"
mcp_servers:
  inventory:
    url: "https://mcp.example.com/mcp"
    transport: "http"
    auth_type: "bearer_token"
    auth_value: os.environ/INVENTORY_TOKEN
```

```http title="LiteLLM to upstream"
Authorization: Bearer <INVENTORY_TOKEN>
```

### Token

`auth_type: token` uses the lowercase `token` authorization scheme.

- **Authentication value:** enter only the token. Do not add the `token` prefix.
- **Behavior:** LiteLLM sends `Authorization: token <token>`.
- **Use when:** the upstream explicitly documents this scheme. Use `bearer_token` for standard bearer authentication.

```yaml title="config.yaml"
mcp_servers:
  legacy_service:
    url: "https://mcp.example.com/mcp"
    transport: "http"
    auth_type: "token"
    auth_value: os.environ/LEGACY_SERVICE_TOKEN
```

```http title="LiteLLM to upstream"
Authorization: token <LEGACY_SERVICE_TOKEN>
```

### Authorization

`auth_type: authorization` sends the authentication value verbatim in the `Authorization` header.

- **Authentication value:** enter the complete value, including the scheme or prefix.
- **Behavior:** LiteLLM does not add, remove, or change the scheme.
- **Use when:** the upstream uses an authorization scheme that the other static types do not cover. This value is supported in `config.yaml` and the server API, but is not currently listed in the Admin UI selector.

```yaml title="config.yaml"
mcp_servers:
  custom_scheme:
    url: "https://mcp.example.com/mcp"
    transport: "http"
    auth_type: "authorization"
    auth_value: os.environ/CUSTOM_AUTH_HEADER # value: Custom <token>
```

```http title="LiteLLM to upstream"
Authorization: Custom <CUSTOM_AUTH_TOKEN>
```

### AWS SigV4

`auth_type: aws_sigv4` signs every request with AWS Signature Version 4 instead of attaching one fixed token.

- **Behavior:** LiteLLM hashes and signs each request, then adds the generated `Authorization`, `x-amz-date`, and temporary-credential headers required by AWS.
- **Use when:** the upstream is an AWS Bedrock AgentCore MCP server.
- **Credential source:** use explicit AWS credentials, the boto3 credential chain, or an IAM role that LiteLLM can assume.

```yaml title="config.yaml"
mcp_servers:
  agentcore:
    url: "https://bedrock-agentcore.us-east-1.amazonaws.com/runtimes/<url-encoded-ARN>/invocations"
    transport: "http"
    auth_type: "aws_sigv4"
    aws_role_name: os.environ/AWS_ROLE_ARN
    aws_region_name: "us-east-1"
    aws_service_name: "bedrock-agentcore"
```

See [MCP AWS SigV4 Auth](./mcp_aws_sigv4.md) for setup and troubleshooting.

## Custom and forwarded headers

Some upstreams require a custom header name or more than one fixed header. These settings are separate from `auth_type`:

- **`static_headers`:** LiteLLM adds the configured values to every upstream request. Use this for a custom static credential, tenant identifier, or secondary gateway credential.
- **`extra_headers`:** LiteLLM copies only the named headers from the current client request to the upstream. Use this for request-specific context that the client owns.

```yaml title="config.yaml"
mcp_servers:
  custom_headers:
    url: "https://mcp.example.com/mcp"
    transport: "http"
    auth_type: "none"
    static_headers:
      X-Custom-Auth: os.environ/MCP_CUSTOM_AUTH
    extra_headers:
      - X-Tenant-ID
```

The `none` resolver still contributes no credential in this example. `X-Custom-Auth` is present because it was declared separately in `static_headers`.

For a caller-owned OAuth bearer in `Authorization`, use `true_passthrough` or `oauth_delegate` instead of treating it as a generic extra header.
