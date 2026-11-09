# MCP ID-JAG Auth (Okta)

:::tip Full guide
See the [ID-JAG overview](./proxy/id_jag/overview.md) and the [requesting app setup guide](./proxy/id_jag/requesting_app.md) for configuration, SSO options, and troubleshooting.
:::

ID-JAG (Identity Assertion Authorization Grant, [draft-ietf-oauth-identity-assertion-authz-grant](https://datatracker.ietf.org/doc/draft-ietf-oauth-identity-assertion-authz-grant/)) lets LiteLLM obtain an access token for an MCP server whose authorization server is different from the user's identity provider. Okta ships this as [AI agent token exchange](https://developer.okta.com/docs/guides/ai-agent-token-exchange/-/main/).

Use ID-JAG when:

- The MCP server trusts a resource authorization server (for example an Okta custom authorization server) that is separate from the org authorization server that authenticates your users.
- You want an admin policy at the identity provider, rather than an interactive consent screen, to decide whether the gateway may call the MCP on a user's behalf. This is what makes it work for headless agents.
- You want the access the gateway receives to be user scoped, auditable, and revocable from the identity provider.

ID-JAG differs from [OBO token exchange](./mcp_obo_auth): OBO is a single RFC 8693 exchange against one authorization server, while ID-JAG is two legs across two authorization servers.

This page covers LiteLLM obtaining an access token from a resource authorization server with an ID-JAG. For the other direction, where an agent redeems an ID-JAG at LiteLLM's own token endpoint for a proxy credential, see [LiteLLM as resource app](./proxy/id_jag/resource_app.md) and the [grant rules](./proxy/cli_sso#redeem-an-identity-assertion-rfc-7523).

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
| `id_jag_subject_source` | Optional | `login_assertion` (default) presents the assertion captured at SSO login on leg 1. `refresh_token` exchanges it for a refresh token at login and presents that instead, see [SAML SSO as the requesting app](#saml-sso-as-the-requesting-app) and the [requesting app guide](./proxy/id_jag/requesting_app.md#okta-configure-sso). |
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

Leg 1 needs an identity token to assert. LiteLLM takes it from one of two places. If the request carries the user's `id_token` in `Authorization`, that token is the subject. Otherwise LiteLLM uses the identity assertion it captured for the authenticated user when they signed in through LiteLLM SSO, which is what lets an agent holding only a LiteLLM virtual key reach the MCP server as the user that key belongs to. The user is always the one the virtual key resolves to; no request field can select whose identity is asserted upstream.

When sending the `id_token` yourself, keep the LiteLLM key in `x-litellm-api-key` and reserve `Authorization` for the user token:

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

### Store-sourced subject with a virtual key only

With no `Authorization` header, the same call works for any user who has signed in through LiteLLM SSO at least once and whose assertion has not expired:

```bash title="Virtual key only" showLineNumbers
curl -X POST "https://litellm.example.com/internal_tools/mcp" \
  -H "Content-Type: application/json" \
  -H "x-litellm-api-key: Bearer <litellm-api-key>" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

Assertion reads are cached per process for `MCP_SSO_ASSERTION_CACHE_TTL_SECONDS` (default 60), so a fresh SSO login on one pod becomes visible to the others within one TTL.

### Which SSO logins capture the assertion

The assertion is the `id_token` in the IdP token response at UI or CLI sign-in, so every login that goes through an OIDC token endpoint captures one: Microsoft Entra (`MICROSOFT_CLIENT_ID`), Google (`GOOGLE_CLIENT_ID`) and generic OIDC (`GENERIC_CLIENT_ID`). The gateway only keeps it while at least one MCP server with `auth_type: oauth2_id_jag` is registered. SAML has no `id_token`, so a SAML-only deployment cannot use the store-sourced subject and every store-sourced call answers `412`; the proxy logs that gap once at startup and once per login.

The stored `id_token` expires on the IdP's schedule, about an hour on Entra and Google. LiteLLM renews it with the refresh token captured beside it, redeemed against the same client the login used (the Microsoft, Google or generic client and its token endpoint). A refresh token is only issued when the login asked for one. While at least one `oauth2_id_jag` server is registered, the Microsoft login adds the `offline_access` scope and the Google login sends `access_type=offline` with `prompt=consent`, so the IdP returns a refresh token and the user sees an offline-access consent once. A user who signed in before the server was registered holds an assertion without a refresh token and has to sign in again after it expires. Generic OIDC asks only when `GENERIC_SCOPE` carries `offline_access`.

### SAML SSO as the requesting app

When LiteLLM SSO runs through SAML, the login has no `id_token`. LiteLLM keeps the signed `<saml:Assertion>` from the validated response, base64url encoded, and presents it on leg 1 as `subject_token_type=urn:ietf:params:oauth:token-type:saml2` (RFC 8693). The MCP server config does not change for this. `subject_token_type` stays at its default because the stored assertion carries its own type, and leg 1 authenticates with the same `client_id` and `client_private_key` as the OIDC case:

```text title="Leg 1 with a SAML subject" showLineNumbers
POST /oauth2/v1/token
grant_type=urn:ietf:params:oauth:grant-type:token-exchange
requested_token_type=urn:ietf:params:oauth:token-type:id-jag
subject_token=<base64url saml:Assertion>
subject_token_type=urn:ietf:params:oauth:token-type:saml2
audience=<resource authorization server identifier>
scope=<scopes>
client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer
client_assertion=<private_key_jwt>
```

A SAML assertion is only usable until its `NotOnOrAfter`, which most IdPs set to a few minutes, and SAML has no refresh token of its own. With the default `id_jag_subject_source: login_assertion`, a call after that point returns the same `412` as an expired OIDC assertion and the user signs in through LiteLLM SSO again.

IdPs that do not accept a `saml2` subject on the ID-JAG exchange itself, Okta among them, take a two-step route. With `id_jag_subject_source: refresh_token`, LiteLLM exchanges the assertion for a refresh token at SSO login while it is still valid (`requested_token_type=urn:ietf:params:oauth:token-type:refresh_token`, `scope=openid offline_access`), stores that token encrypted next to the assertion with the lifetime the IdP returned, and presents it on leg 1 as `subject_token_type=urn:ietf:params:oauth:token-type:refresh_token`. The login exchange authenticates as the server's IdP client, so every server in this mode shares one `client_id` and `token_exchange_endpoint`. The Okta walkthrough in [LiteLLM as requesting app](./proxy/id_jag/requesting_app.md#okta-configure-sso) shows the full config, and its [troubleshooting table](./proxy/id_jag/requesting_app.md#troubleshooting) covers `invalid_grant` on a SAML subject and the multiple-client warning.

## Credential Errors at Connect Time

On a single-server route such as `/internal_tools/mcp` or `/mcp/internal_tools`, LiteLLM resolves the ID-JAG credential before it opens the MCP session, so a failure comes back as an HTTP status the client can act on rather than as a session that appears to have no tools. This runs for the store-sourced flow (no `Authorization` header), which is exactly where the failures below are decided before any authorization server is called.

| Status | Meaning | What fixes it |
|--------|---------|---------------|
| `412 Precondition Failed` | No identity assertion is stored for this user, or the stored one has expired. The body names which. | The user signs in through LiteLLM SSO so the gateway captures a current assertion. |
| `503 Service Unavailable` | The assertion store (the LiteLLM database) is unreachable. | Nothing on the user's side; check database connectivity. |

The 412 is a plain status with a JSON body, not an OAuth challenge. There is no `WWW-Authenticate` header, because the client cannot resolve it by fetching authorization server metadata and retrying; only a LiteLLM SSO login fixes it.

```bash
$ curl -s -i -X POST https://litellm.example.com/mcp/internal_tools \
    -H "x-litellm-api-key: Bearer <litellm-api-key>" \
    -H 'Content-Type: application/json' \
    -H 'Accept: application/json, text/event-stream' \
    -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
HTTP/1.1 412 Precondition Failed
content-type: application/json

{"detail":"precondition required: ID-JAG requires an IdP identity assertion for this user and none is stored. Sign in through LiteLLM SSO so the gateway captures one."}
```

A `tools/call` on the same route returns the same 412 rather than reporting that the tool does not exist.

On the aggregate `/mcp` route that serves several servers at once, one server's credential failure must not fail the whole connection, so it is reported per server instead. `tools/list` succeeds, the failing server contributes no tools, and the reason lands in the response's `_meta`:

```json
{"_meta":{"litellm.ai/server_outcomes":{"internal_tools":{"status":"internal","http_status":412}}},"tools":[]}
```

If you see that shape and want the status and message directly, call the server on its single-server route.

Known limitation: when the request carries an `Authorization` bearer, `tools/list` currently still resolves the subject from the stored assertion while `tools/call` uses the bearer. A caller with a valid `id_token` but no stored assertion therefore gets the empty list with the `_meta` 412 above rather than a connect-time status, and the pre-flight does not run for that request so it cannot reject a credential the tool call would accept. Signing in through LiteLLM SSO once removes the mismatch.

## Caching Behavior

LiteLLM caches the leg-2 access token by subject token and MCP server ID, so two different users get separate tokens while repeated calls from the same user to the same MCP server reuse the cached token until it expires. The cache TTL is based on the leg-2 `expires_in` minus LiteLLM's OAuth expiry buffer. If `expires_in` is missing or invalid, LiteLLM uses the default OAuth token cache TTL.

## Troubleshooting

| Symptom | Check |
|---------|-------|
| MCP server receives the LiteLLM key | Move the LiteLLM key to `x-litellm-api-key` and use `Authorization` for the user `id_token`. |
| `412 Precondition Failed` on connect | No stored SSO assertion for this user, or it has expired. Have the user sign in through LiteLLM SSO, then retry. See [Credential Errors at Connect Time](#credential-errors-at-connect-time). |
| `503 Service Unavailable` on connect | The assertion store is unreachable. Check the LiteLLM database connection. |
| `412 Precondition Failed` minutes after a SAML login | The SAML assertion passed its `NotOnOrAfter`, and SAML has no refresh token. The user signs in through LiteLLM SSO again. |
| `tools/list` returns no tools and `_meta` shows `http_status: 412` | You are on the aggregate `/mcp` route. Call the single-server route to get the status and message directly. |
| Leg 1 returns 400 or 403 | Confirm the cross-app access policy authorizes the gateway app for the resource and scopes, and that `audience` matches the resource authorization server identifier. |
| Leg 1 returns 401 | Confirm `client_id`, `client_private_key`, and `client_private_key_id` match the gateway app's registered JWKS. |
| Leg 2 rejects the assertion | Confirm `id_jag_resource_token_endpoint` points at the resource authorization server that trusts the org authorization server, and that its clock and the ID-JAG `exp` agree. |
| Authorization servers are called on every request | Confirm leg 2 returns `expires_in`, and that the same user `id_token` and MCP server are being reused. |
