# MCP Per-User and Per-Key Upstream Credentials

Register an MCP server once in LiteLLM, then let each user or service account (virtual key) reach that server's origin with its own upstream credential instead of the credential stored on the server. This page compares the options, explains where each credential is stored, and covers what works for service-account keys that are not attached to a user.

For the server-level `auth_type` settings this page overrides, see [MCP Non-OAuth Authentication](./mcp_authentication.md) and [MCP OAuth](./mcp_oauth.md).

## Options at a glance

| Option | Who supplies the credential | Where it is stored | Keyed by | Works for a key with no `user_id` |
|---|---|---|---|---|
| [Per-request header](#per-request-header-override) | The client, on every request | Nowhere in LiteLLM | n/a | Yes |
| [BYOK server](#byok-servers-per-user-api-keys) (`is_byok`) | Each user, once | LiteLLM database, encrypted | `(user_id, server_id)` | No |
| [Per-user env vars](#per-user-env-vars) (`env_vars` with `scope: user`) | Each user, once | LiteLLM database, encrypted | `(user_id, server_id)` | No |
| [Per-user OAuth](#per-user-oauth) (`auth_type: oauth2`, authorization code) | Each user, via the OAuth flow | LiteLLM database, encrypted | `(user_id, server_id)` | No |
| [DCR bridge](#dcr-bridge-per-key-oauth-for-service-accounts) (`dcr_bridge: true`) | Each client, via one OAuth flow | The client, as a sealed token | Key hash | Yes |

Precedence at call time: a per-request header always wins. If none is sent, LiteLLM uses the stored per-user credential for that server type, and if none exists it either falls back to the server's static credential (env vars with a global fallback) or rejects the call with a provisioning hint (BYOK, OAuth, env vars with no fallback).

## Per-request header override

Any caller can override the stored upstream credential for one server by sending `x-mcp-{server_alias}-authorization` alongside its LiteLLM key. LiteLLM forwards the value verbatim as the upstream `Authorization` header, so include the scheme.

```bash
curl -X POST "http://localhost:4000/mcp" \
  -H "Authorization: Bearer sk-1234" \
  -H "x-mcp-servers: github" \
  -H "x-mcp-github-authorization: Bearer ghp_xxx" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

The alias is lowercased and any character outside `a-z0-9_` becomes `_`, so a server aliased `Jira Cloud` is addressed as `x-mcp-jira_cloud-authorization`. Other upstream headers follow the same `x-mcp-{server_alias}-{header_name}` pattern; see [Header routing](./auth_overview.md).

LiteLLM stores nothing, so this is the simplest option for a service account: the credential lives with the client and the same LiteLLM key can carry a different upstream credential per request. It applies to every auth type, including BYOK and OAuth servers.

## BYOK servers (per-user API keys)

A BYOK (bring your own key) server has no shared upstream credential. Each user stores their own API key once, and LiteLLM injects it on that user's tool calls.

BYOK is a flag on the server record, set when creating or updating a server through the Admin UI or the [REST API](./mcp_rest_api.md). It is not read from `config.yaml`.

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

Each user then stores their key. The endpoint authenticates the caller with their LiteLLM key and stores the credential under that key's `user_id`.

```bash
curl -X POST "http://localhost:4000/v1/mcp/server/{server_id}/user-credential" \
  -H "Authorization: Bearer sk-user-key" \
  -H "Content-Type: application/json" \
  -d '{"credential": "ghp_xxx"}'
```

A tool call from a user with no stored credential fails with `401` and a `byok_auth_required` error body naming the server, plus a `WWW-Authenticate` header pointing an OAuth-capable MCP client at LiteLLM's built-in BYOK authorization page (`/v1/mcp/oauth/authorize`), where the user pastes their key. Clients that do not follow `WWW-Authenticate` can call the endpoint above directly or use the Admin UI.

`DELETE /v1/mcp/server/{server_id}/user-credential` removes the caller's key. A proxy admin can pass `?user_id=` to revoke another user's key, and `GET /v1/mcp/server/{server_id}/user-credentials` lists which users have a stored credential (no secret values are returned).

## Per-user env vars

Env vars are a more flexible variant of BYOK for servers that need a credential in a custom header or several values. Declare variables on the server, mark the ones each user must supply with `scope: user`, and reference them in `static_headers` with `${NAME}`.

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

Users fill in their values with `POST /v1/mcp/server/{server_id}/user-env-vars` and a body of `{"values": {"TENANT_TOKEN": "..."}}`, check what is still missing with `GET /v1/mcp/server/{server_id}/user-env-vars` (values are write-only and never echoed back), and clear them with `DELETE` on the same path. A tool call that references a `scope: user` variable with no stored value and no global fallback is rejected with `412` and a `setup_url` the user can open to fill it in.

## Per-user OAuth

For an upstream that speaks OAuth, register the server with `auth_type: oauth2` and an authorization-code grant. LiteLLM runs the browser flow, stores each user's access and refresh tokens encrypted under `(user_id, server_id)`, refreshes them, and injects them on that user's calls. Setup is covered in [MCP OAuth](./mcp_oauth.md).

Tokens obtained outside LiteLLM can be seeded with `POST /v1/mcp/server/{server_id}/oauth-user-credential` and a body of `{"access_token": "...", "refresh_token": "...", "expires_in": 3600}`. This endpoint is closed on servers whose `oauth_identity_binding` is set to `enforce`, because it cannot verify who the token belongs to. `GET .../oauth-user-credential/status` reports whether the caller has a token and when it expires, `GET /v1/mcp/user-credentials` lists every server the caller has connected, and `DELETE .../oauth-user-credential` revokes it (admins can pass `?user_id=`).

## Service accounts and keys with no user

Every stored credential above (BYOK, env vars, per-user OAuth) is keyed by the `user_id` on the calling virtual key. A service-account key that is scoped to a team but not attached to a user has no `user_id`, so on those servers it is rejected with `401` (BYOK, OAuth) or `412` (env vars) and cannot store a credential either: the management endpoints return `400 User ID not found in token`.

You have three ways to give a service account its own upstream credential.

**Send the credential per request.** Use the [per-request header](#per-request-header-override). Nothing is stored in LiteLLM and it works with any key.

**Create a machine user per service account.** Create an internal user for the service (for example `svc-ci-bot`), then create the virtual key with `user_id` set to that user. The key now owns a `user_id`, so credentials can be stored and used like any other user's. Seed them by calling the `user-credential`, `user-env-vars`, or `oauth-user-credential` endpoints with that service's own key. Admins can list and revoke those credentials but cannot write a credential on behalf of another user; the write endpoints always store under the calling key's `user_id`.

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

**Use the DCR bridge for OAuth upstreams.** See the next section. It keys the credential by the virtual key itself, so no user is needed.

## DCR bridge: per-key OAuth for service accounts

On a `true_passthrough` or `oauth_delegate` server, setting `dcr_bridge: true` makes LiteLLM host the client's OAuth registration and sign-in. The client completes one OAuth flow against LiteLLM; LiteLLM obtains the upstream token and hands it back sealed inside the token the client holds. On each call LiteLLM unseals the envelope and forwards the upstream token.

The envelope is bound to the hash of the virtual key that minted it rather than to a `user_id`, and the mint flow accepts an active key with no user. That makes it the one stored-style OAuth option that works for a service-account key without a machine user, at the cost that the credential lives in the client's token store instead of the LiteLLM database, so there is nothing for an admin to list or revoke centrally beyond rotating the key.

`dcr_bridge` can be set in `config.yaml`, the Admin UI, or the REST API. Full setup, supported clients, and the security model are in [Gateway-hosted sign-in (DCR bridge)](./mcp_oauth_passthrough.md#gateway-hosted-sign-in-dcr-bridge).

## What is not supported

There is no stored per-key or per-team header override object. Keys and teams control which MCP servers they may call through access lists (`object_permission.mcp_servers`), and the upstream credential comes from one of the mechanisms above. If you need a fixed upstream credential per key without attaching a user, send it per request or use the DCR bridge.
