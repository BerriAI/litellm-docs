# MCP Per-User and Per-Key Upstream Credentials

Register an MCP server once in LiteLLM, then let users and service accounts call it with their own upstream credentials. For credentials stored in LiteLLM, give each service account a distinct machine user and attach its virtual key to that user

Stored BYOK keys, per-user env vars, and per-user OAuth tokens belong to `(user_id, server_id)`, not to an individual virtual key. **Two keys with the same `user_id` share the stored credential for that server.** Use separate machine users when service accounts need separate upstream identities. There is no native stored per-key or per-team credential override

## Store a credential for a service account

First register the shared MCP server. The example below assumes a [BYOK server](#byok-servers-per-user-api-keys) with alias `github`. Create a machine user, create its virtual key with access to that server, then store the upstream credential using the newly generated key

```bash
curl -X POST "http://localhost:4000/user/new" \
  -H "Authorization: Bearer sk-master" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "svc-ci-bot", "user_role": "internal_user", "auto_create_key": false}'

curl -X POST "http://localhost:4000/key/generate" \
  -H "Authorization: Bearer sk-master" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "svc-ci-bot", "key_alias": "ci-bot", "object_permission": {"mcp_servers": ["github"]}}'

curl -X POST "http://localhost:4000/v1/mcp/server/{server_id}/user-credential" \
  -H "Authorization: Bearer sk-ci-bot-key" \
  -H "Content-Type: application/json" \
  -d '{"credential": "ghp_ci_bot_token"}'
```

Replace `{server_id}` with the ID returned when registering the MCP server, and `sk-ci-bot-key` with the key returned by `/key/generate`. Subsequent tool calls made with that key use the machine user's stored upstream credential

For [per-user env vars](#per-user-env-vars) or [OAuth tokens](#per-user-oauth), use the corresponding credential endpoint with the same machine-user key. Direct OAuth token provisioning is unavailable when `oauth_identity_binding.mode` is `enforce`; complete the gateway OAuth flow instead

**Provision with the service account's own key.** The write endpoints always use the caller's `user_id`. An admin key cannot select another user as the destination. Admins can list BYOK credential owners and revoke another user's BYOK or OAuth credential

A key without a `user_id` cannot use these credential-storage endpoints: they return `400 User ID not found in token`. Calls requiring a stored BYOK or interactive OAuth credential fail with `401`; missing required per-user env vars cause a tool call to fail with `412`. Client-supplied credentials are an alternative where the server's auth mode supports them, but are not stored in LiteLLM

## Options at a glance

| Option | Who supplies the credential | Where it is stored | Keyed by | Works for a key with no `user_id` |
|---|---|---|---|---|
| [Per-request header](#per-request-header-override) | The client, on every request | Nowhere in LiteLLM | n/a | Yes, on supported auth modes |
| [BYOK server](#byok-servers-per-user-api-keys) (`is_byok`) | Each user, once | LiteLLM database, encrypted | `(user_id, server_id)` | No |
| [Per-user env vars](#per-user-env-vars) (`env_vars` with `scope: user`) | Each user, once | LiteLLM database, encrypted | `(user_id, server_id)` | No |
| [Per-user OAuth](#per-user-oauth) (`auth_type: oauth2`, authorization code) | Each user, via the OAuth flow | LiteLLM database, encrypted | `(user_id, server_id)` | No |
| [Delegated DCR bridge](#dcr-bridge-client-held-oauth-credentials) (`oauth_delegate`, `dcr_bridge: true`) | The client, via OAuth | The client, as a sealed token | Browser user or admitted key hash | Yes for key-bound minting; browser sign-in binds the user instead |

Choose the credential source to match the server's auth mode. Per-request headers do not universally override stored credentials: interactive OAuth, OBO, and ID-JAG preserve their configured credential resolution. Required per-user env vars must still be provisioned even when the client sends an auth header

For server-level settings, see [MCP Non-OAuth Authentication](./mcp_authentication.md) and [MCP OAuth](./mcp_oauth.md)

## Per-request header override

For static-credential and BYOK servers, a caller can supply its upstream credential on each request using `x-mcp-{server_alias}-{header_name}`. For example, `x-mcp-github-authorization: Bearer ghp_xxx` supplies an `Authorization` header for the `github` server. Include the scheme when sending `Authorization`; use the header name required by the upstream, such as `x-api-key`, for other credential types

This works without a `user_id` on supported auth modes, but the credential stays with the client. It does not replace the stored token on an `oauth2` authorization-code server or bypass OBO/ID-JAG token exchange. It also does not bypass missing required per-user env vars

See [Header routing](./auth_overview.md#3-per-user-header-passthrough) for the naming convention and [MCP client authentication](./mcp.md) for client examples. For `true_passthrough` and `oauth_delegate`, follow [MCP OAuth Passthrough](./mcp_oauth_passthrough.md) for admission and upstream-token handling

## BYOK servers (per-user API keys)

A BYOK (bring your own key) server has no shared upstream credential. Each user stores their own API key once, and LiteLLM injects it on that user's tool calls

BYOK is a flag on the server record, set when creating or updating a server through the Admin UI or the [REST API](./mcp_rest_api.md). It is not read from `config.yaml`

```bash
curl -X POST "http://localhost:4000/v1/mcp/server" \
  -H "Authorization: Bearer sk-master" \
  -H "Content-Type: application/json" \
  -d '{
    "server_name": "github",
    "alias": "github",
    "url": "https://api.githubcopilot.com/mcp/",
    "transport": "http",
    "auth_type": "bearer_token",
    "is_byok": true
  }'
```

Each user then stores their key. The endpoint authenticates the caller with their LiteLLM key and stores the credential under that key's `user_id`

```bash
curl -X POST "http://localhost:4000/v1/mcp/server/{server_id}/user-credential" \
  -H "Authorization: Bearer sk-user-key" \
  -H "Content-Type: application/json" \
  -d '{"credential": "ghp_xxx"}'
```

A tool call with neither a stored credential nor a supported per-request override fails with `401` and a `byok_auth_required` error body naming the server, plus a `WWW-Authenticate` header pointing an OAuth-capable MCP client at LiteLLM's built-in BYOK authorization page (`/v1/mcp/oauth/authorize`), where the user pastes their key. Clients that do not follow `WWW-Authenticate` can call the endpoint above directly or use the Admin UI

`DELETE /v1/mcp/server/{server_id}/user-credential` removes the caller's key. A proxy admin can pass `?user_id=` to revoke another user's key, and `GET /v1/mcp/server/{server_id}/user-credentials` lists which users have a stored credential (no secret values are returned)

## Per-user env vars

The [Server Variables overview](./mcp.md#server-variables) introduces shared and per-user variables. Use per-user env vars for servers that need a credential in a custom header or several values. Declare variables on the server, mark the ones each user must supply with `scope: user`, and reference them in `static_headers` with `${NAME}`

```json
{
  "server_name": "internal-tools",
  "url": "https://tools.internal/mcp",
  "transport": "http",
  "auth_type": "none",
  "static_headers": {
    "X-Tenant-Token": "${TENANT_TOKEN}",
    "X-Region": "${REGION}"
  },
  "env_vars": [
    {"name": "TENANT_TOKEN", "scope": "user", "description": "Your tenant token"},
    {"name": "REGION", "scope": "global", "value": "us-east-1"}
  ]
}
```

Users fill in their values with `POST /v1/mcp/server/{server_id}/user-env-vars` and a body of `{"values": {"TENANT_TOKEN": "..."}}`, check what is still missing with `GET /v1/mcp/server/{server_id}/user-env-vars` (values are write-only and never echoed back), and clear them with `DELETE` on the same path. A tool call that references a `scope: user` variable with no stored value and no global fallback is rejected with `412` and a `setup_url` the user can open to fill it in

## Per-user OAuth

For an upstream that speaks OAuth, register the server with `auth_type: oauth2` and an authorization-code grant. LiteLLM runs the browser flow, stores each user's access and refresh tokens encrypted under `(user_id, server_id)`, refreshes them, and injects them on that user's calls. Setup is covered in [MCP OAuth](./mcp_oauth.md)

Tokens obtained outside LiteLLM can be seeded with `POST /v1/mcp/server/{server_id}/oauth-user-credential` and a body of `{"access_token": "...", "refresh_token": "...", "expires_in": 3600}`. This endpoint is closed on servers whose `oauth_identity_binding.mode` is set to `enforce`, because it cannot verify who the token belongs to. `GET .../oauth-user-credential/status` reports whether the caller has a token and when it expires, `GET /v1/mcp/user-credentials` lists every server the caller has connected, and `DELETE .../oauth-user-credential` revokes it (admins can pass `?user_id=`)

## DCR bridge: client-held OAuth credentials

For `true_passthrough` and `oauth_delegate` servers, `dcr_bridge: true` hosts OAuth registration and sign-in at the gateway. The client holds the resulting credential. On `oauth_delegate`, the sealed credential binds the upstream token to the browser user for interactive sign-in, or to the admitted key hash when the token request authenticates with a virtual key

The OAuth-only client setup requires working LiteLLM browser sign-in and an interactive client. Signing in as an administrator binds that browser user, not a separate service-account key. The key-authenticated mint path accepts an active key without a `user_id`, but it still needs an upstream OAuth authorization-code exchange and keeps the credential client-side. It does not provide a gateway-stored credential override for that key

See [Gateway-hosted sign-in (DCR bridge)](./mcp_oauth_passthrough.md#gateway-hosted-sign-in-dcr-bridge) for setup and supported clients. For fully scripted delegation with client-held credentials, use the documented two-header `oauth_delegate` flow with `dcr_bridge` disabled

## What is not supported

There is no stored per-key or per-team header override object. Keys and teams control which MCP servers they may call through access lists (`object_permission.mcp_servers`), and the upstream credential comes from one of the mechanisms above. For gateway-stored credentials, use a distinct machine user per service account. Without a user, keep credentials client-side and use a forwarding mode supported by the upstream. The DCR bridge has the interactive setup requirements described above
