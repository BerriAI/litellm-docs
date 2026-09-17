# MCP OBO Auth

OAuth 2.0 On-Behalf-Of (OBO) auth lets LiteLLM exchange a user's incoming bearer token for a scoped token that is valid for a specific MCP server.

Use OBO when:

- Your MCP server should receive a token minted specifically for that MCP server.
- Your identity provider supports [RFC 8693 OAuth 2.0 Token Exchange](https://datatracker.ietf.org/doc/html/rfc8693), or is Microsoft Entra ID, which LiteLLM speaks natively (see [Microsoft Entra ID](#microsoft-entra-id-azure-ad) below).
- You want LiteLLM to keep the user's raw token from being forwarded directly to the MCP server.

## How It Works

```mermaid
flowchart TD
    A[User or agent calls LiteLLM with a bearer token] --> B[LiteLLM identifies the target MCP server]
    B --> C{MCP server auth_type is oauth2_token_exchange?}
    C -- No --> D[Use the server's configured auth flow]
    C -- Yes --> E[LiteLLM extracts the caller bearer token as the subject token]
    E --> F[LiteLLM POSTs an RFC 8693 token exchange request to the IdP]
    F --> G[IdP validates the subject token, audience, client, and scopes]
    G --> H[IdP returns a scoped access token for the MCP server]
    H --> I[LiteLLM caches the scoped token per subject token and MCP server]
    I --> J[LiteLLM calls the MCP server with the scoped bearer token]
    J --> K[MCP server executes the tool and returns the result]
```

In short:

1. The client sends a request to LiteLLM with a bearer token.
2. LiteLLM uses that bearer token as the RFC 8693 `subject_token`.
3. LiteLLM exchanges it at your identity provider's token exchange endpoint.
4. LiteLLM forwards only the exchanged scoped token to the MCP server.
5. LiteLLM caches the exchanged token until it expires, so repeated calls avoid another identity provider round trip.

## Configure an MCP Server for OBO

Set `auth_type: oauth2_token_exchange` on the MCP server.

```yaml title="config.yaml" showLineNumbers
mcp_servers:
  internal_tools:
    url: "https://mcp.example.com/mcp"
    transport: "http"
    auth_type: oauth2_token_exchange

    # OAuth 2.0 Token Exchange endpoint on your identity provider
    token_exchange_endpoint: "https://idp.example.com/oauth2/token"

    # Token exchange client registered with your identity provider
    client_id: "<idp-client-id>"
    client_secret: "<idp-client-secret>"

    # Optional but recommended: restrict the exchanged token to this MCP server
    audience: "api://internal-tools-mcp"
    scopes:
      - "mcp.tools.read"
      - "mcp.tools.execute"

    # Optional. Defaults to access_token.
    subject_token_type: "urn:ietf:params:oauth:token-type:access_token"
```

### Config Fields

| Field | Required | Description |
|-------|----------|-------------|
| `auth_type` | Yes | Must be `oauth2_token_exchange`. |
| `token_exchange_endpoint` | Yes | The identity provider endpoint that accepts RFC 8693 token exchange requests. |
| `client_id` | Yes | OAuth client identifier LiteLLM uses when calling the token exchange endpoint. |
| `client_secret` | Yes | OAuth client secret LiteLLM uses when calling the token exchange endpoint. |
| `audience` | Recommended | Resource identifier for the MCP server. LiteLLM sends this as the token exchange `audience`. |
| `scopes` | Optional | Scopes LiteLLM requests for the exchanged token. LiteLLM joins the list into the OAuth `scope` parameter. |
| `subject_token_type` | Optional | RFC 8693 subject token type. Defaults to `urn:ietf:params:oauth:token-type:access_token`. |
| `upstream_token_header` | Optional | Which upstream header carries the exchanged token. Defaults to `Authorization`. See [sending the token on a different header](#sending-the-exchanged-token-on-a-different-header). |
| `token_exchange_profile` | Optional | Wire dialect for the exchange. `rfc8693` (default) speaks the standard token-exchange grant; `entra_obo` speaks Microsoft Entra ID's On-Behalf-Of flow. See [Microsoft Entra ID](#microsoft-entra-id-azure-ad). |

### Sending the exchanged token on a different header

By default the exchanged token goes out as `Authorization: Bearer <token>`. When the MCP server sits
behind an API gateway that reads its own credential from a private header, and the server behind the
gateway still expects its own bearer on `Authorization`, both credentials have to travel on the same
request.

Set `upstream_token_header` to name the header the exchanged token should use. Anything under
`static_headers` is then left alone, so a shared credential still reaches the server behind the
gateway.

```yaml title="config.yaml" showLineNumbers
mcp_servers:
  my_mcp_server:
    url: "https://gateway.example.com/mcp"
    auth_type: oauth2_token_exchange
    token_exchange_endpoint: "https://idp.example.com/token"
    client_id: os.environ/MCP_CLIENT_ID
    client_secret: os.environ/MCP_CLIENT_SECRET
    audience: "api://esb"
    upstream_token_header: "esb-oauth"
    static_headers:
      Authorization: "Bearer os.environ/UPSTREAM_MCP_TOKEN"
```

Each upstream request then carries both, with the exchanged token scoped to the calling user:

```
esb-oauth: Bearer <token exchanged for this user>
Authorization: Bearer <the shared token you configured>
```

The exchanged token is still cached per user, so a short-lived token does not mean an exchange on
every request. Leaving `upstream_token_header` unset keeps the default.

If a redirect from the upstream crosses origin, the custom header is dropped rather than forwarded,
the same way HTTP clients drop `Authorization`. An upstream that legitimately redirects across
origins will not see the credential on the second hop.

## Token Exchange Request

For each uncached subject token and MCP server pair, LiteLLM sends a form-encoded request like this to `token_exchange_endpoint`:

```http
POST /oauth2/token
Content-Type: application/x-www-form-urlencoded

grant_type=urn:ietf:params:oauth:grant-type:token-exchange
&subject_token=<caller-bearer-token>
&subject_token_type=urn:ietf:params:oauth:token-type:access_token
&client_id=<idp-client-id>
&client_secret=<idp-client-secret>
&audience=api://internal-tools-mcp
&scope=mcp.tools.read mcp.tools.execute
```

Your identity provider should return an access token:

```json
{
  "access_token": "scoped-token-for-mcp-server",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

LiteLLM then calls the MCP server with:

```http
Authorization: Bearer scoped-token-for-mcp-server
```

## Microsoft Entra ID (Azure AD)

Microsoft Entra ID doesn't implement the RFC 8693 token-exchange grant above. Its On-Behalf-Of flow uses the RFC 7523 `jwt-bearer` grant instead: the caller's token rides as `assertion` rather than `subject_token`, there's no `audience` parameter, and a Microsoft-only `requested_token_use=on_behalf_of` extension is what turns the grant into a delegation rather than a plain jwt-bearer exchange. LiteLLM treats Entra as a first-class profile, so pointing at Entra is a config change, not a different integration: set `token_exchange_profile: entra_obo` and LiteLLM builds the jwt-bearer form instead of the RFC 8693 form.

```yaml title="config.yaml" showLineNumbers
mcp_servers:
  internal_tools:
    url: "https://mcp.example.com/mcp"
    transport: "http"
    auth_type: oauth2_token_exchange
    token_exchange_profile: entra_obo

    # Your Entra tenant's v2.0 token endpoint
    token_exchange_endpoint: "https://login.microsoftonline.com/<tenant-id>/oauth2/v2.0/token"

    # App registration LiteLLM uses to call the token endpoint. The caller's
    # token must have been issued with this client_id as its `aud`.
    client_id: "<entra-app-client-id>"
    client_secret: "<entra-app-client-secret>"

    # Entra has no audience parameter, so the target resource goes in scope
    # as <app-id-uri>/.default
    scopes:
      - "api://internal-tools-mcp/.default"
```

`audience` and `subject_token_type` are unused with `entra_obo`: Entra has no audience parameter (the target resource goes in `scope` instead), and the jwt-bearer grant doesn't examine subject token type.

For each uncached caller token and MCP server pair, LiteLLM sends:

```http
POST /<tenant-id>/oauth2/v2.0/token
Content-Type: application/x-www-form-urlencoded

grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer
&assertion=<caller-bearer-token>
&scope=api://internal-tools-mcp/.default
&requested_token_use=on_behalf_of
&client_id=<entra-app-client-id>
&client_secret=<entra-app-client-secret>
```

Entra returns the same access token response shape shown above, and LiteLLM caches and forwards the exchanged token the same way regardless of profile.

:::note
The caller's token must be issued for LiteLLM's app registration, not some other Entra app. If your harness authenticates against a different app registration, have it request a token for this app's scope first, then send that token to LiteLLM.
:::

## Calling an OBO MCP Server

The inbound request must include the user's bearer token so LiteLLM has a `subject_token` to exchange.

For direct MCP calls, keep the LiteLLM key in `x-litellm-api-key` and leave `Authorization` for the user token:

```bash title="Direct MCP call" showLineNumbers
curl -X POST "https://litellm.example.com/internal_tools/mcp" \
  -H "Content-Type: application/json" \
  -H "x-litellm-api-key: Bearer <litellm-api-key>" \
  -H "Authorization: Bearer <user-token>" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

For the Responses API, pass MCP tool headers with the LiteLLM key separated from the user token:

```bash title="Responses API with MCP OBO" showLineNumbers
curl -X POST "https://litellm.example.com/v1/responses" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <litellm-api-key>" \
  -d '{
    "model": "{{openai_large}}",
    "input": "List the available internal tools",
    "tools": [
      {
        "type": "mcp",
        "server_label": "internal_tools",
        "server_url": "https://litellm.example.com/internal_tools/mcp",
        "require_approval": "never",
        "headers": {
          "x-litellm-api-key": "Bearer <litellm-api-key>",
          "Authorization": "Bearer <user-token>"
        }
      }
    ]
  }'
```

:::tip
If the MCP client can only send one `Authorization` header, use `x-litellm-api-key` for the LiteLLM key and reserve `Authorization` for the user's token. LiteLLM needs the user token as the OBO `subject_token`.
:::

## Caching Behavior

LiteLLM caches exchanged tokens by:

- subject token
- MCP server ID

This means two different users get separate exchanged tokens, while repeated calls from the same user to the same MCP server reuse the cached token until it expires.

The cache TTL is based on `expires_in` minus LiteLLM's OAuth expiry buffer. If `expires_in` is missing or invalid, LiteLLM uses the default OAuth token cache TTL.

## Fallback Behavior

If an OBO server has no incoming subject token:

- If `client_id`, `client_secret`, and `token_url` are configured, LiteLLM can fall back to OAuth `client_credentials`.
- Otherwise, LiteLLM logs a warning and proceeds without token exchange.

For strict OBO deployments, configure clients so every request includes the user bearer token.

## Troubleshooting

| Symptom | Check |
|---------|-------|
| MCP server receives the LiteLLM key | Move the LiteLLM key to `x-litellm-api-key` and use `Authorization` for the user token. |
| Token exchange endpoint returns 400 | Confirm `audience`, `scopes`, `client_id`, and `subject_token_type` match your identity provider configuration. |
| MCP server receives no `Authorization` header | Confirm the MCP server has `auth_type: oauth2_token_exchange` and the inbound request includes a user bearer token. |
| Identity provider is called on every request | Confirm the identity provider returns `expires_in`, and that the same user token and MCP server are being reused. |

