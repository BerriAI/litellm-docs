---
title: Claude Desktop (Cowork)
sidebar_label: Claude Desktop (Cowork)
description: Point Claude Desktop (Cowork, Chat, and Code sessions) at LiteLLM as its inference gateway, with single sign-on through LiteLLM JWT auth or a static virtual key, MCP servers through the LiteLLM MCP gateway under the same identity, fleet rollout, and the failures people actually hit.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Claude Desktop (Cowork) Integration

Claude Desktop on third-party inference sends every model call from Cowork, Chat, and Code sessions to a gateway you name, and LiteLLM is that gateway: unified logging, per-user and per-team budgets, model access control, and any Claude deployment behind it (Anthropic, Bedrock, Vertex AI, Foundry) without touching the client again. This page covers the two ways a device authenticates to LiteLLM, single sign-on through your identity provider (nothing to hand out or rotate, spend attributed to the person) and a static virtual key (the quickest way to try it), then what shows up in the model picker, how the same identity reaches MCP servers through the LiteLLM MCP gateway, how to ship the configuration to a fleet, and what to check when something does not work.

<iframe
  src="https://www.loom.com/embed/adb864c1f7c74de3bfc9584ca6d32080"
  frameBorder="0"
  allowFullScreen
  style={{ width: '100%', aspectRatio: '16/9', maxWidth: '900px', marginBottom: '20px' }}
></iframe>

## How it fits together

Claude Desktop treats LiteLLM the way it treats Anthropic's own API: it discovers models with `GET /v1/models` at launch and sends chat traffic to `POST /v1/messages` with streaming and tool use, carrying `Authorization: Bearer <credential>` on every request. The credential is either a LiteLLM virtual key or, with single sign-on, the ID token your identity provider issued to the signed-in user, which LiteLLM validates with [JWT auth](../proxy/token_auth.md) on every request and maps to a LiteLLM user and teams.

| Setting | Value |
|---|---|
| Gateway base URL | `https://your-litellm-proxy.com`, no `/v1` suffix |
| Credential, single sign-on | the user's ID token, validated by LiteLLM JWT auth |
| Credential, static key | a LiteLLM virtual key |
| Endpoints used | `GET /v1/models`, `POST /v1/messages`, and `POST /mcp` for MCP servers |
| LiteLLM version | v1.98.0 or later for model discovery, v1.89.0 or later for the `issuers` JWT config |
| Claude Desktop version | 1.6889.0 or later for single sign-on |

## Option A: Single sign-on with your identity provider

With `inferenceCredentialKind: interactive`, Claude Desktop runs an OpenID Connect sign-in (authorization code with PKCE) in the system browser against your identity provider, keeps the refresh token in OS secure storage, and sends the ID token to LiteLLM as the bearer credential. LiteLLM checks the signature against the provider's signing keys, the issuer, and the audience, then maps the token's claims to a LiteLLM user and, through a groups claim, to LiteLLM teams. Nobody provisions or rotates keys, a user removed from the identity provider loses access when the token expires, MFA and conditional access apply, and the only thing the user sees is a **Sign in to your organization** button. This path needs a database behind LiteLLM, because users and spend are written to it.

### 1. Register Claude Desktop in your identity provider

Claude Desktop is a native app, so it registers as a public client (PKCE, no client secret) with a loopback redirect URI.

<Tabs>
<TabItem value="entra" label="Microsoft Entra ID">

In the Entra admin center create an app registration for accounts in your directory only, then under **Authentication** add a **Mobile and desktop applications** platform with the custom redirect URI `http://127.0.0.1/callback`. Use `127.0.0.1` rather than `localhost`, keep the `/callback` path, and add it under that platform specifically: it is the only one Entra lets use any local port, which the app needs because it picks a free port at sign-in time. No client secret or API permissions are needed. Copy the **Application (client) ID** and **Directory (tenant) ID**.

The issuer is `https://login.microsoftonline.com/YOUR_TENANT_ID/v2.0` and the signing keys are at `https://login.microsoftonline.com/YOUR_TENANT_ID/discovery/v2.0/keys`. The stable user id claim is `oid`. To map users to LiteLLM teams by group, add a **groups** claim to the ID token under **Token configuration**; it carries group object ids.

</TabItem>
<TabItem value="okta" label="Okta">

In the Okta admin console create an app integration of type **OIDC, Native Application** with the **Authorization Code** and **Refresh Token** grant types. Okta matches the redirect URI exactly, port included, so pick a fixed port such as `53180`, register `http://127.0.0.1:53180/callback`, and set the same port in Claude Desktop below. Assign the users or groups who should get access.

The issuer is `https://YOUR_ORG.okta.com`, the plain org URL rather than the metadata URI ending in `/.well-known/openid-configuration` (a custom authorization server's issuer is `https://YOUR_ORG.okta.com/oauth2/AUTH_SERVER_ID`), and the signing keys are at `https://YOUR_ORG.okta.com/oauth2/v1/keys`. The stable user id claim is `sub`. Add a `groups` claim to the ID token for team mapping.

</TabItem>
</Tabs>

### 2. Configure LiteLLM to validate the token

Describe the identity provider to LiteLLM with an `issuers` entry (LiteLLM v1.89.0 or later). Each entry binds one `iss` value to its signing keys and audience and carries that provider's claim names, so several providers can sit side by side. The audience is the client id you registered: an ID token's `aud` is the client it was issued to, and checking it is what stops a token minted for some other app in the same tenant from reaching your gateway.

<Tabs>
<TabItem value="entra" label="Microsoft Entra ID">

```yaml title="config.yaml"
general_settings:
  enable_jwt_auth: true
  litellm_jwtauth:
    user_id_upsert: true
    issuers:
      - issuer: https://login.microsoftonline.com/YOUR_TENANT_ID/v2.0
        jwks_url: https://login.microsoftonline.com/YOUR_TENANT_ID/discovery/v2.0/keys
        audience: YOUR_CLIENT_ID
        user_id_jwt_field: oid
        user_email_jwt_field: email
        team_ids_jwt_field: groups

model_list:
  - model_name: {{anthropic}}
    litellm_params:
      model: anthropic/{{anthropic}}
      api_key: os.environ/ANTHROPIC_API_KEY
  - model_name: {{anthropic_large}}
    litellm_params:
      model: anthropic/{{anthropic_large}}
      api_key: os.environ/ANTHROPIC_API_KEY
  - model_name: claude-haiku-4-5
    litellm_params:
      model: anthropic/claude-haiku-4-5
      api_key: os.environ/ANTHROPIC_API_KEY
```

</TabItem>
<TabItem value="okta" label="Okta">

```yaml title="config.yaml"
general_settings:
  enable_jwt_auth: true
  litellm_jwtauth:
    user_id_upsert: true
    issuers:
      - issuer: https://YOUR_ORG.okta.com
        jwks_url: https://YOUR_ORG.okta.com/oauth2/v1/keys
        audience: YOUR_CLIENT_ID
        user_id_jwt_field: sub
        user_email_jwt_field: email
        team_ids_jwt_field: groups

model_list:
  - model_name: {{anthropic}}
    litellm_params:
      model: anthropic/{{anthropic}}
      api_key: os.environ/ANTHROPIC_API_KEY
  - model_name: {{anthropic_large}}
    litellm_params:
      model: anthropic/{{anthropic_large}}
      api_key: os.environ/ANTHROPIC_API_KEY
  - model_name: claude-haiku-4-5
    litellm_params:
      model: anthropic/claude-haiku-4-5
      api_key: os.environ/ANTHROPIC_API_KEY
```

</TabItem>
</Tabs>

`jwks_url` is optional: without it LiteLLM reads `jwks_uri` from `{issuer}/.well-known/openid-configuration`. `user_id_upsert: true` creates the LiteLLM user on first request, so spend accrues per person under **Internal Users** and the `oid` or `sub` value lands on every spend log row; `user_allowed_email_domain: yourcompany.com` refuses tokens from any other email domain. `team_ids_jwt_field: groups` turns the token's group memberships into LiteLLM team memberships: create a team whose `team_id` equals the group's id (an Entra group object id, an Okta group name) and that team's `models`, `max_budget`, rate limits, and MCP server permissions apply to everyone in the group. LiteLLM adds the user to the team the first time a token carries that group, so they also show up under the team's members, and a user who belongs to exactly one team keeps resolving to it even when a later token omits the claim. A token whose groups match no team is still accepted as the user, with no team budget and no MCP servers, so drop the line if you do not need teams. A token whose `iss` matches no entry falls back to the `JWT_PUBLIC_KEY_URL`, `JWT_AUDIENCE`, and `JWT_ISSUER` environment variables, which is the single-provider setup [JWT auth](../proxy/token_auth.md) describes and works here too.

:::warning `public_key_url` and `audience` are not `litellm_jwtauth` keys
Anthropic's gateway guide shows `litellm_jwtauth` with `public_key_url` and `audience` directly under it. LiteLLM has no such keys and refuses to start with `ValueError: Invalid arguments provided: ...` naming `public_key_url` and `audience`. Put them in an `issuers` entry as above, or set `JWT_PUBLIC_KEY_URL` and `JWT_AUDIENCE` as environment variables.
:::

### 3. Configure Claude Desktop

Open the configuration window: **Help > Troubleshooting > Enable Developer Mode**, then **Developer > Configure Third-Party Inference…**. In the **Connection** section set **Inference provider** to **Gateway**, **Gateway base URL** to your proxy URL, and **Credential kind** to **Interactive sign-in**, which hides the API key field and reveals **Gateway SSO IdP (OIDC)**: enter the **Client ID** and **Issuer URL** from step 1, leave **Scopes** empty for the default `openid profile email offline_access`, and fill **Redirect port** only for Okta (`53180`). **Apply locally** writes the configuration for this device, which is enough to try it out; **Export** produces the managed configuration for a fleet (see [Rolling out to a fleet](#rolling-out-to-a-fleet)).

The exported keys, in a macOS `.mobileconfig` payload:

```xml
<key>inferenceProvider</key>
<string>gateway</string>
<key>inferenceGatewayBaseUrl</key>
<string>https://your-litellm-proxy.com</string>
<key>inferenceCredentialKind</key>
<string>interactive</string>
<key>inferenceGatewayOidc</key>
<string>{"issuer":"https://login.microsoftonline.com/YOUR_TENANT_ID/v2.0","clientId":"YOUR_CLIENT_ID"}</string>
```

For Okta the JSON is `{"issuer":"https://YOUR_ORG.okta.com","clientId":"YOUR_CLIENT_ID","redirectPort":53180}`. `inferenceGatewayOidc` is one key whose value is a JSON string (a `REG_SZ` on Windows, a native object in Linux's `managed-settings.json`); dotted keys such as `inferenceGatewayOidc.clientId` are never read. Leave `bearerTokenType` at its default `id_token`, which is what the `issuers` entry validates; Google Workspace needs `access_token` there, because it issues no fresh ID token on refresh and re-prompts users about hourly otherwise.

### 4. Verify

On the next launch the user sees **Sign in to your organization**, signs in through the browser, and lands back in the app with the model picker filled from your proxy. In the LiteLLM UI, **Logs** shows each request under the user's id, and **Internal Users** shows the upserted user with spend. The same endpoints can be exercised from a shell with any ID token your provider issues for that client id:

```bash
curl https://your-litellm-proxy.com/v1/models \
  -H "Authorization: Bearer $ID_TOKEN" -H "anthropic-version: 2023-06-01"

curl -N https://your-litellm-proxy.com/v1/messages \
  -H "Authorization: Bearer $ID_TOKEN" -H "anthropic-version: 2023-06-01" -H "content-type: application/json" \
  -d '{"model":"{{anthropic}}","max_tokens":64,"stream":true,"messages":[{"role":"user","content":"hello"}]}'
```

The first returns the Anthropic-shaped model list the picker is built from; the second streams a reply. A `401` with `Audience doesn't match` means the token was issued to a different client id than the one in `audience`; `Missing JWT Public Key URL from environment.` means the token's `iss` matched no `issuers` entry; `Token Expired` is the state the app resolves on its own by refreshing the token, or by prompting **Sign in again** when the refresh fails.

## Option B: Static virtual key

A [virtual key](../proxy/virtual_keys.md) is the right credential for a proof of concept, a shared workstation, or a gateway that already hands out per-team keys. Everyone on the same managed profile shares that key and its budget, and rotating it means pushing a new profile, which is why fleets end up on single sign-on.

Create the key in the LiteLLM UI under **Virtual Keys > + Create New Key**, scoped to the Claude models with a `max_budget`, and copy it. In Claude Desktop, enable Developer Mode under **Help > Troubleshooting**, open **Developer > Configure Third-Party Inference…**, set **Inference provider** to **Gateway**, enter the **Gateway base URL** and the key as the **Gateway API key**, keep **Credential kind** at **Static API key** and **Gateway auth scheme** at **Bearer** (LiteLLM also accepts `x-api-key`), and apply.

<img src="https://colony-recorder.s3.amazonaws.com/files/2026-04-22/64274593-33e6-4a7b-a7f3-a08f8aea8209/ascreenshot_8a9c909a978544888dafb6e0c7e3f468_text_export.jpeg" alt="Enable Developer Mode under Help > Troubleshooting" style={{ maxWidth: '700px', marginBottom: '20px' }} />

<img src="https://colony-recorder.s3.amazonaws.com/files/2026-04-22/dbb36dff-bbbe-4ddd-b30e-25b2c41bff47/ascreenshot_a7516b203052432f9a1d08cbe92cd214_text_export.jpeg" alt="Developer > Configure Third-Party Inference" style={{ maxWidth: '700px', marginBottom: '20px' }} />

<img src="https://colony-recorder.s3.amazonaws.com/files/2026-04-22/2d0daa12-d874-42ca-bc3e-f38c27c701e4/ascreenshot_8c8be28828974c10ab53124fa13e67c3_text_export.jpeg" alt="Gateway URL and API key fields" style={{ maxWidth: '700px', marginBottom: '20px' }} />

<img src="https://colony-recorder.s3.amazonaws.com/files/2026-04-22/6a5b1233-de81-48be-8a17-e026d3dd9b49/ascreenshot_23dbd432db6d4f90ab5b0d598edd5a40_text_export.jpeg" alt="Create a virtual key in the LiteLLM UI" style={{ maxWidth: '700px', marginBottom: '20px' }} />

<img src="https://colony-recorder.s3.amazonaws.com/files/2026-04-22/9e72faf1-0b5e-49d5-8ac4-b64dcd2b2f94/ascreenshot_813a1b584a1f4523ab7f7702f5985be0_text_export.jpeg" alt="Claude Desktop connected through LiteLLM" style={{ maxWidth: '700px', marginBottom: '20px' }} />

The exported form is `inferenceProvider: gateway`, `inferenceGatewayBaseUrl`, and `inferenceGatewayApiKey`, with `inferenceGatewayAuthScheme: x-api-key` only if you chose that scheme. Requests then show up under that key in **Logs** and **Usage**.

## Models in the picker

Claude Desktop builds the picker from `GET /v1/models` and keeps only ids that contain `claude` or `anthropic`, case-insensitively, so the `model_name` values in your `model_list` are what matter, not the upstream ids behind them: `{{anthropic}}` served from Bedrock or Vertex AI passes, `smart-router` does not. LiteLLM does not return the `anthropic_family_tier` field that would let an opaque alias through the filter, so either put `claude` in the name or list the model in `inferenceModels`, which replaces discovery with exactly the entries you give (the first is the default):

```json
[
  {"name": "{{anthropic}}", "supports1m": true},
  {"name": "{{anthropic_large}}", "labelOverride": "Opus 5 via LiteLLM"},
  {"name": "claude-haiku-4-5"}
]
```

`supports1m` adds a second, 1M-context picker entry for that model (the string shorthand `"{{anthropic}}[1m]"` means the same); set it only on a `name` that exactly matches the id your proxy returns and only for deployments that accept 1M-token requests. `anthropicFamilyTier` (`sonnet`, `opus`, `haiku`, `fable`, `mythos`) with `isFamilyDefault: true` tells the app which entry a bare tier alias resolves to. Organizations on Claude for Teams or Enterprise also need each gateway model name on their `availableModels` allowlist, or it shows greyed out; [Auto Router with Claude Code and Claude Desktop](./claude_code_autorouter.md) covers the allowlist rules and how to put an auto router behind a name the picker accepts. Non-Claude models behind LiteLLM work the same way once their `model_name` contains `claude`; add `drop_params: true` to those entries so the Anthropic-specific request fields Cowork and Code sessions send are dropped where the provider has no equivalent instead of failing the request.

## MCP servers through the LiteLLM MCP gateway

Managed MCP servers on Claude Desktop are `managedMcpServers` entries, and pointing them at LiteLLM's [MCP gateway](../mcp.md) instead of at each upstream server keeps MCP traffic under the same logging, access control, and identity as inference. LiteLLM exposes every configured server on one streamable HTTP endpoint, `https://your-litellm-proxy.com/mcp`, authenticated with the same bearer credential; the `x-mcp-servers` header narrows one entry to specific servers (the per-server path `/mcp/<server_name>` does the same), and tools appear as `<server>-<tool>`.

```yaml title="config.yaml"
mcp_servers:
  deepwiki:
    url: https://mcp.deepwiki.com/mcp
    transport: http
  github:
    url: https://api.githubcopilot.com/mcp
    transport: http
    auth_type: bearer_token
    auth_value: os.environ/GITHUB_TOKEN
```

Access to a server is granted rather than assumed: a signed-in user sees only the servers their team, key, or organization is permitted to use, and every other server is simply absent from `tools/list`. With single sign-on the grant lives on the team the token's groups map to, so create that team with the servers in its `object_permission` (the same call sets the models and budget the group gets):

```bash
curl -X POST https://your-litellm-proxy.com/team/new \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" -H "content-type: application/json" \
  -d '{"team_id": "GROUP_ID_FROM_THE_TOKEN", "team_alias": "Claude Desktop users",
       "models": ["{{anthropic}}", "{{anthropic_large}}", "claude-haiku-4-5"], "max_budget": 500,
       "object_permission": {"mcp_servers": ["deepwiki", "github"]}}'
```

A low-risk server can instead be opened to everyone with `allow_all_keys: true` ([Public MCP servers](../mcp_control.md#public-mcp-servers-allow_all_keys)), and [MCP access control](../mcp_control.md) covers access groups and per-tool permissions. On the Claude Desktop side, a static virtual key goes in the entry's headers:

```json
[
  {
    "name": "litellm",
    "transport": "http",
    "url": "https://your-litellm-proxy.com/mcp",
    "headers": {"Authorization": "Bearer sk-...", "x-mcp-servers": "deepwiki,github"}
  }
]
```

Static headers cannot carry a signed-in user's own token, so single sign-on fleets use `headersHelper` instead: an executable Claude Desktop runs that prints the headers as a flat JSON object, re-run on the `headersHelperTtlSec` schedule and again when the server answers 401 or 403 (Claude Desktop 1.46388.1 or later). A helper that obtains an ID token for the same app registration keeps chat and MCP spend on the same LiteLLM user. `toolPolicy`, a map of tool name to `allow`, `ask`, or `blocked`, sets the confirmation policy per tool. Servers that need the user's own upstream login (GitHub, Atlassian, and the like) take `"oauth": true` against the per-server URL `https://your-litellm-proxy.com/mcp/<server_name>` with LiteLLM's [MCP OAuth passthrough](../mcp_oauth_passthrough.md) or the [gateway-hosted DCR bridge](../mcp_oauth_passthrough.md#gateway-hosted-sign-in-dcr-bridge); Claude Desktop starts that sign-in only when the server answers an unauthenticated request with HTTP 401, on the loopback callback `http://127.0.0.1:53280/callback`. A server marked `available_on_public_internet: false` is hidden from callers outside the private ranges (or the `mcp_internal_ip_ranges` you set), so a laptop on the public internet sees only the rest ([MCP servers on the public internet](../mcp_public_internet.md)).

Claude Desktop's built-in connectors (`"server": "microsoft365"`, `"github"`, `"websearch"`) run inside the app against those vendors' own APIs and never pass through LiteLLM; only `url` entries do. To keep GitHub or Microsoft 365 traffic under LiteLLM, configure the vendor's MCP server as an `mcp_servers` entry on the proxy and point a `url` entry at it.

## Rolling out to a fleet

**Export** in the configuration window turns what you applied into the template your MDM expects: a `.mobileconfig` (macOS), a `.reg` file or ADMX (Windows), or Intune OMA-URI JSON. Managed configuration is read from `/Library/Managed Preferences/<user>/com.anthropic.claudefordesktop.plist` on macOS, `HKLM\SOFTWARE\Policies\Claude` (or `HKCU`) on Windows, and `/etc/claude-desktop/managed-settings.json` on Linux, while **Apply locally** writes to `~/Library/Application Support/Claude-3p/configLibrary/`, `%LOCALAPPDATA%\Claude-3p\configLibrary\`, and `~/.config/Claude-3p/configLibrary/`. `bootstrapUrl` lets devices fetch the same configuration from a server you host instead of an MDM profile; LiteLLM does not serve a bootstrap endpoint today.

Two more keys matter behind LiteLLM. `inferenceCustomHeaders`, a JSON object of extra headers sent on every inference and discovery request (routing and tenant headers only, never credentials), is how a profile stamps `x-litellm-tags` on every request, which [tag budgets](../proxy/tag_budgets.md), [tag routing](../proxy/tag_routing.md), and the Usage page all group by; `{"x-litellm-tags": "claude-desktop,finance"}` gives a department its own budget without a separate key or team. `inferenceStreamIdleTimeoutSec` (300 to 1800) extends how long a Cowork or Code session waits for model output on a streaming response, but only when LiteLLM writes SSE keep-alive pings while the upstream model is silent; a response with nothing on it still times out at the default.

## Usage attribution

Under single sign-on every request is attributed to the LiteLLM user upserted from the token, and to the team when a groups claim maps to one, so **Usage** breaks spend down by person and by team and budgets apply at both levels. Under a static key the key is the unit, and one key per team or per purpose with its own `max_budget` is the practical granularity. Either way, `x-litellm-tags` from `inferenceCustomHeaders` adds a third axis, such as a department or cost center, without changing who authenticates.

## Troubleshooting

**The model picker is empty, or the connection test passes but no Claude model appears.** Discovery keeps only ids containing `claude` or `anthropic`; rename the `model_name` or set `inferenceModels`. LiteLLM older than v1.98.0 answers `/v1/models` in OpenAI shape only, which the app cannot parse; upgrade, or set `inferenceModels` so the app skips discovery.

**`Authentication Error, Missing JWT Public Key URL from environment.` on every request.** The token's `iss` matched no `issuers` entry (compare the `iss` claim in the token with the `issuer` value; Entra tokens carry `/v2.0` at the end) and no `JWT_PUBLIC_KEY_URL` fallback is set.

**`ValueError: Invalid arguments provided` naming `public_key_url` and `audience` at startup.** The config followed Anthropic's snippet. Move those values into an `issuers` entry.

**`Authentication Error, Validation fails: Audience doesn't match`.** The token was issued to a different client id; `audience` must be the client id of the Claude Desktop app registration, and `bearerTokenType` must be left at `id_token`, since an access token's audience is the API it was requested for.

**`Token Expired`, or users are asked to sign in every hour.** Refresh needs the `offline_access` scope, which the default scopes include; a custom `scopes` value in `id_token` mode must list it explicitly. Google Workspace re-prompts hourly in `id_token` mode regardless; use `bearerTokenType: access_token` there.

**`gateway SSO: server does not advertise device_authorization_endpoint`.** The app could not read `inferenceGatewayOidc`, usually because it was pushed as dotted keys or invalid JSON. Re-export from the configuration window.

**`OIDC discovery failed (HTTP 404)` or `(HTTP 405)`.** The `issuer` value is the metadata URI instead of the issuer base URL; remove the `/.well-known/openid-configuration` suffix.

**The browser shows Connected but the app reports `Token exchange failed (HTTP 401)`.** The identity provider registration is a confidential (Web) client expecting a secret. Register a Native application (Okta) or a Mobile and desktop applications platform (Entra) instead; the type cannot be changed after creation.

**`tools/list` on the LiteLLM MCP endpoint comes back empty.** The signed-in user has no grant on any server: the token's groups match no team, or the team's `object_permission` lists no `mcp_servers`. Add the servers to the team or set `allow_all_keys: true` on the server.

**Requests to a non-Claude model fail with 400.** Cowork and Code sessions send Anthropic-specific fields; set `drop_params: true` on that `model_list` entry.

**The 1M context window entry is missing.** `supports1m` sits on an `inferenceModels` entry whose `name` does not match the discovered id exactly.

## Related

- [JWT auth](../proxy/token_auth.md) for every `litellm_jwtauth` option, including role mappings and JWT-to-virtual-key mapping
- [Virtual keys](../proxy/virtual_keys.md)
- [MCP gateway](../mcp.md), [MCP access control](../mcp_control.md), and [MCP OAuth passthrough](../mcp_oauth_passthrough.md)
- [Auto Router with Claude Code and Claude Desktop](./claude_code_autorouter.md)
- [Claude Code with LiteLLM](./claude_responses_api.md)
- Anthropic's [gateway guide](https://claude.com/docs/third-party/claude-desktop/gateway), [configuration reference](https://claude.com/docs/third-party/claude-desktop/configuration), and [MCP servers and extensions](https://claude.com/docs/third-party/claude-desktop/extensions) for Claude Desktop on third-party inference
