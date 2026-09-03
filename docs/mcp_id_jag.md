# MCP ID-JAG Auth (Okta)

ID-JAG (Identity Assertion Authorization Grant, [draft-ietf-oauth-identity-assertion-authz-grant](https://datatracker.ietf.org/doc/draft-ietf-oauth-identity-assertion-authz-grant/)) lets LiteLLM obtain an access token for an MCP server whose authorization server is different from the user's identity provider. Okta ships this as [AI agent token exchange](https://developer.okta.com/docs/guides/ai-agent-token-exchange/-/main/).

Use ID-JAG when:

- The MCP server trusts a resource authorization server (for example an Okta custom authorization server) that is separate from the org authorization server that authenticates your users.
- You want an admin policy at the identity provider, rather than an interactive consent screen, to decide whether the gateway may call the MCP on a user's behalf. This is what makes it work for headless agents.
- You want the access the gateway receives to be user scoped, auditable, and revocable from the identity provider.

ID-JAG differs from [OBO token exchange](./mcp_obo_auth): OBO is a single RFC 8693 exchange against one authorization server, while ID-JAG is two legs across two authorization servers.

## How It Works

```mermaid
flowchart TD
    A[User signs in and the client gets an Okta id_token] --> B[Client calls LiteLLM with the id_token]
    B --> C{MCP server auth_type is oauth2_id_jag?}
    C -- No --> D[Use the server's configured auth flow]
    C -- Yes --> E[Leg 1: LiteLLM POSTs an RFC 8693 token exchange to the org authorization server, requested_token_type=id-jag]
    E --> F[Org authorization server applies admin policy and returns a signed ID-JAG assertion]
    F --> G[Leg 2: LiteLLM POSTs an RFC 7523 jwt-bearer grant with the ID-JAG to the resource authorization server]
    G --> H[Resource authorization server validates the ID-JAG and returns an access token]
    H --> I[LiteLLM caches the access token per subject token and MCP server]
    I --> J[LiteLLM calls the MCP server with the access token]
    J --> K[MCP server executes the tool and returns the result]
```

In short:

1. The client sends a request to LiteLLM with the user's `id_token`.
2. LiteLLM uses that `id_token` as the RFC 8693 `subject_token` and exchanges it for an ID-JAG assertion at the org authorization server (`token_exchange_endpoint`).
3. LiteLLM presents the ID-JAG to the resource authorization server (`id_jag_resource_token_endpoint`) via the RFC 7523 `jwt-bearer` grant and receives the MCP access token.
4. LiteLLM forwards only the access token to the MCP server.
5. LiteLLM caches the access token until it expires, so repeated calls from the same user avoid both authorization-server round trips.

LiteLLM authenticates to both authorization servers with a private-key-JWT `client_assertion` (RFC 7523), which is what Okta requires. It falls back to `client_secret` when no private key is configured.

## Set Up Okta

ID-JAG requires the **Okta for AI Agents** subscription. At a high level:

1. Register the LiteLLM gateway as an OAuth app (the agent). Configure it for `private_key_jwt` client authentication and upload the public key as a JWKS, keeping the matching private key for LiteLLM. Note the `kid`.
2. Confirm the org authorization server token endpoint, `https://<your-org>.okta.com/oauth2/v1/token`. This is leg 1's `token_exchange_endpoint`.
3. Set up the resource (custom) authorization server that the MCP trusts, with its token endpoint `https://<your-org>.okta.com/oauth2/<custom-as-id>/v1/token`. This is leg 2's `id_jag_resource_token_endpoint`. Its issuer identifier is the `audience` for leg 1.
4. Configure the cross-app access policy that authorizes the gateway app to obtain an ID-JAG for the resource, including the scopes it may request.

See Okta's [AI agent token exchange guide](https://developer.okta.com/docs/guides/ai-agent-token-exchange/-/main/) for the click-by-click setup.

## Configure an MCP Server for ID-JAG

Set `auth_type: oauth2_id_jag` on the MCP server.

```yaml title="config.yaml" showLineNumbers
mcp_servers:
  internal_tools:
    url: "https://mcp.example.com/mcp"
    transport: "http"
    auth_type: oauth2_id_jag

    # Org authorization server token endpoint (leg 1: token exchange -> ID-JAG)
    token_exchange_endpoint: "https://your-org.okta.com/oauth2/v1/token"

    # Resource (custom) authorization server token endpoint (leg 2: jwt-bearer -> access token)
    id_jag_resource_token_endpoint: "https://your-org.okta.com/oauth2/<custom-as-id>/v1/token"

    # Gateway app registered with Okta
    client_id: "<okta-agent-client-id>"

    # Private-key-JWT client authentication (RFC 7523). Okta requires this.
    client_private_key: |
      -----BEGIN PRIVATE KEY-----
      ...
      -----END PRIVATE KEY-----
    client_private_key_id: "<jwks-kid>"
    client_assertion_signing_alg: "RS256"

    # Resource authorization server identifier; sent as the leg-1 audience
    audience: "https://your-org.okta.com/oauth2/<custom-as-id>"

    # Optional RFC 8707 resource indicator for leg 1
    id_jag_resource: "https://mcp.example.com/"

    # Optional scopes requested for the access token
    scopes:
      - "mcp.tools.read"
      - "mcp.tools.execute"
```

### Config Fields

| Field | Required | Description |
|-------|----------|-------------|
| `auth_type` | Yes | Must be `oauth2_id_jag`. |
| `token_exchange_endpoint` | Yes | Org authorization server token endpoint for leg 1 (RFC 8693 token exchange). |
| `id_jag_resource_token_endpoint` | Yes | Resource authorization server token endpoint for leg 2 (RFC 7523 jwt-bearer grant). |
| `client_id` | Yes | OAuth client identifier for the gateway app at the authorization servers. |
| `client_private_key` | Recommended | PEM private key LiteLLM uses to sign the `client_assertion`. Required for Okta. |
| `client_private_key_id` | Optional | Key id advertised as `kid` in the `client_assertion` JWT header. |
| `client_assertion_signing_alg` | Optional | Signing algorithm for the `client_assertion`. Defaults to `RS256`. |
| `client_secret` | Optional | Used as a fallback only when `client_private_key` is not set. |
| `audience` | Recommended | Resource authorization server identifier. LiteLLM sends this as the leg-1 `audience`. |
| `id_jag_resource` | Optional | RFC 8707 resource indicator sent on leg 1. |
| `scopes` | Optional | Scopes LiteLLM requests. Joined into the OAuth `scope` parameter. |
| `subject_token_type` | Optional | Subject token type for leg 1. Defaults to `urn:ietf:params:oauth:token-type:id_token` for ID-JAG. |

## The Two Legs

### Leg 1: token exchange for an ID-JAG

For each uncached subject token and MCP server pair, LiteLLM POSTs an RFC 8693 token exchange to `token_exchange_endpoint`:

```http
POST /oauth2/v1/token
Content-Type: application/x-www-form-urlencoded

grant_type=urn:ietf:params:oauth:grant-type:token-exchange
&requested_token_type=urn:ietf:params:oauth:token-type:id-jag
&subject_token=<user-id-token>
&subject_token_type=urn:ietf:params:oauth:token-type:id_token
&audience=https://your-org.okta.com/oauth2/<custom-as-id>
&resource=https://mcp.example.com/
&scope=mcp.tools.read mcp.tools.execute
&client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer
&client_assertion=<signed-jwt>
```

The org authorization server applies its admin policy and returns the ID-JAG assertion:

```json
{
  "issued_token_type": "urn:ietf:params:oauth:token-type:id-jag",
  "access_token": "<id-jag-jwt>",
  "token_type": "N_A",
  "expires_in": 300
}
```

The ID-JAG is a signed JWT with `typ: oauth-id-jag+jwt` whose `aud` is the resource authorization server.

### Leg 2: jwt-bearer for the access token

LiteLLM presents the ID-JAG to `id_jag_resource_token_endpoint` with the RFC 7523 grant:

```http
POST /oauth2/<custom-as-id>/v1/token
Content-Type: application/x-www-form-urlencoded

grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer
&assertion=<id-jag-jwt>
&client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer
&client_assertion=<signed-jwt>
```

The resource authorization server validates the ID-JAG and returns the access token:

```json
{
  "access_token": "access-token-for-mcp-server",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

LiteLLM then calls the MCP server with:

```http
Authorization: Bearer access-token-for-mcp-server
```

## Calling an ID-JAG MCP Server

The inbound request must include the user's `id_token` so LiteLLM has a `subject_token` for leg 1. Keep the LiteLLM key in `x-litellm-api-key` and reserve `Authorization` for the user token:

```bash title="Direct MCP call" showLineNumbers
curl -X POST "https://litellm.example.com/internal_tools/mcp" \
  -H "Content-Type: application/json" \
  -H "x-litellm-api-key: Bearer <litellm-api-key>" \
  -H "Authorization: Bearer <user-okta-id-token>" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

:::tip
If the MCP client can only send one `Authorization` header, use `x-litellm-api-key` for the LiteLLM key and reserve `Authorization` for the user's `id_token`. LiteLLM needs the `id_token` as the leg-1 `subject_token`.
:::

## Caching Behavior

LiteLLM caches the leg-2 access token by subject token and MCP server ID, so two different users get separate tokens while repeated calls from the same user to the same MCP server reuse the cached token until it expires. The cache TTL is based on the leg-2 `expires_in` minus LiteLLM's OAuth expiry buffer. If `expires_in` is missing or invalid, LiteLLM uses the default OAuth token cache TTL.

## Troubleshooting

| Symptom | Check |
|---------|-------|
| MCP server receives the LiteLLM key | Move the LiteLLM key to `x-litellm-api-key` and use `Authorization` for the user `id_token`. |
| Leg 1 returns 400 or 403 | Confirm the cross-app access policy authorizes the gateway app for the resource and scopes, and that `audience` matches the resource authorization server identifier. |
| Leg 1 returns 401 | Confirm `client_id`, `client_private_key`, and `client_private_key_id` match the gateway app's registered JWKS. |
| Leg 2 rejects the assertion | Confirm `id_jag_resource_token_endpoint` points at the resource authorization server that trusts the org authorization server, and that its clock and the ID-JAG `exp` agree. |
| Authorization servers are called on every request | Confirm leg 2 returns `expires_in`, and that the same user `id_token` and MCP server are being reused. |
