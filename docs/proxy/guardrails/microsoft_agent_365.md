import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Microsoft Agent 365 Guardrail

Sends every MCP tool call to the [Microsoft Agent 365](https://learn.microsoft.com/en-us/agent-365/overview) evaluation API before LiteLLM runs it. Microsoft Defender returns allow or block, and the call is recorded on the Microsoft side under the signed-in user

## Supported modes

| Mode | What it does |
|------|-------------|
| `pre_mcp_call` | Evaluates the tool name, arguments and server with Defender before execution. Blocks on a block verdict |

The guardrail only runs on MCP tool calls. Chat completions and other LLM routes are untouched

## How it works

Agent 365 evaluates in the context of a signed-in user, so every guarded tool call needs that user's Entra access token, audienced to your gateway app registration, in the `Authorization` header. The guardrail exchanges it On-Behalf-Of (OBO) for a delegated Agent 365 token and evaluates as that user. There is no service or agent identity mode: a call without a user token gets HTTP 401

The LiteLLM key travels separately in `x-litellm-api-key`. On a proxy that already accepts Entra tokens through [JWT auth](/docs/proxy/token_auth), the Entra token is the LiteLLM credential too

Per tool call

1. LiteLLM admission: key or JWT check, then the key's MCP server and tool permissions. A bad credential fails here with the usual 401 or 403
2. The guardrail reads the Entra token from `Authorization`. Missing: HTTP 401. On the per-server `/mcp` route the 401 carries a sign-in challenge, see [Browser sign-in](#browser-sign-in-from-the-mcp-client)
3. OBO exchange, cached for the token's lifetime
4. The pending call goes to Agent 365: tool name, arguments, server name, `conversationId`, and the tool's description and input schema when the server published them. The user's prompt is never sent
5. Allow with `defender.status: Evaluated`: LiteLLM runs the tool. Block: HTTP 400 with the Defender message and correlation id, and the MCP server is never contacted. Allowed but not evaluated (`Skipped`, `FailedOpen`): treated as unscanned, `unreachable_fallback` decides (blocked by default)

The guardrail can only be attached to MCP servers whose `Authorization` header stays with the gateway: `auth_type` `none`, `api_key`, `bearer_token`, `basic`, `authorization`, `token`, `aws_sigv4` (with no `Authorization` entry in `extra_headers`) and `oauth2_token_exchange`, where the same Entra token is what LiteLLM exchanges for the upstream. On `oauth2`, `oauth2_id_jag`, `oauth_delegate` and `true_passthrough` servers that header already carries an upstream or gateway OAuth token, so the guardrail never sees a user token and refuses every call with 401. Leave it off those servers or move them to `oauth2_token_exchange`. Forwarding a client key header such as `x-api-key` under `extra_headers` is fine, it travels in its own header

## Prerequisites

One-time Entra setup by a tenant administrator

1. Ask your Microsoft Agent 365 contact to onboard your tenant. Until then the evaluation endpoint answers `409 BAPForbiddenTenantAccess`
2. Register a gateway app under **Microsoft Entra ID > App registrations**, single tenant, no redirect URI. Record the client id and tenant id, and create a client secret under **Certificates & secrets**. These are the guardrail's `client_id`, `tenant_id` and `client_secret`
3. Under **Expose an API**, set the Application ID URI to `api://<client_id>` and add a scope named `access_as_user`. This is the scope your MCP clients request
4. Still under **Expose an API**, pre-authorize the client id of each application your users call from. For terminal testing, pre-authorize the Azure CLI (Microsoft's public app id `04b07795-8ddb-461a-bbee-02f9e1bf7b46`)
5. Under **API permissions > Add a permission > APIs my organization uses**, add the **Agent Tools** API (Microsoft's public app id `ea9ffc3e-8a23-4a7d-836d-234d7c7565c1`), delegated permission `ThreatProtection.Evaluate.All`, and grant admin consent. It must be delegated, not application: an application permission mints a token Agent 365 rejects

Check the setup before touching LiteLLM

```bash
az login --tenant <tenant_id>
az account get-access-token --tenant <tenant_id> --resource api://<gateway_client_id>
```

Decode the token and check `aud` is `api://<gateway_client_id>` and `scp` contains `access_as_user`. That is the token your MCP client sends

## Quick Start

### 1. Define the guardrail in `config.yaml`

```yaml
model_list:
  - model_name: gpt-4o
    litellm_params:
      model: openai/gpt-4o
      api_key: os.environ/OPENAI_API_KEY

guardrails:
  - guardrail_name: agent365-mcp
    litellm_params:
      guardrail: agent_365
      mode: pre_mcp_call
      default_on: true
      tenant_id: os.environ/AGENT365_TENANT_ID
      client_id: os.environ/AGENT365_CLIENT_ID
      client_secret: os.environ/AGENT365_CLIENT_SECRET

mcp_servers:
  deepwiki:
    transport: "http"
    url: "https://mcp.deepwiki.com/mcp"
```

### 2. Start the proxy

```bash
export AGENT365_TENANT_ID="<your Entra tenant id>"
export AGENT365_CLIENT_ID="<gateway app client id>"
export AGENT365_CLIENT_SECRET="<gateway app client secret>"

litellm --config config.yaml
```

### 3. Call an MCP tool

```bash
TOKEN=$(az account get-access-token --tenant <tenant_id> --resource api://<gateway_client_id> --query accessToken -o tsv)
curl -X POST http://localhost:4000/mcp-rest/tools/call \
  -H "x-litellm-api-key: Bearer sk-1234" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "server_id": "<server_id from /mcp-rest/tools/list>",
    "name": "read_wiki_structure",
    "arguments": {"repoName": "BerriAI/litellm"}
  }'
```

An allowed call returns the tool result. A blocked one returns HTTP 400

```json
{
  "error": "Blocked by Microsoft Defender",
  "message": "Invocation of 'ask_question' is blocked by Microsoft Threat Detection policies configured by your administrator.",
  "tool": "ask_question",
  "correlation_id": "<id to look the call up on the Microsoft side>"
}
```

Every evaluated call gets a row under **Logs** in the Admin UI ([UI logs](/docs/proxy/ui_logs)) with the guardrail name, latency and verdict. Blocked calls on the `/mcp` transport show as `guardrail_intervened`. Calls refused or blocked on `/mcp-rest/tools/call` have no Logs row yet ([litellm#40555](https://github.com/BerriAI/litellm/issues/40555))

## Caller scenarios

How the user token reaches the request

### A. Applications on a proxy with Entra JWT auth

With `enable_jwt_auth` and Entra as the issuer ([OIDC JWT auth](/docs/proxy/token_auth)), the application's Entra bearer is both the LiteLLM credential and the OBO subject. No `x-litellm-api-key` is needed. The token must be issued for the gateway app (`aud` `api://<gateway_client_id>`, `scp` with `access_as_user`); a token for Microsoft Graph or another API fails JWT admission

```yaml
general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  enable_jwt_auth: true
  litellm_jwtauth:
    user_id_jwt_field: oid
    user_email_jwt_field: email
    user_id_upsert: true
    team_id_default: entra-users
```

```bash
export JWT_PUBLIC_KEY_URL="https://login.microsoftonline.com/<tenant_id>/discovery/keys"
export JWT_AUDIENCE="api://<gateway_client_id>"
export JWT_ISSUER="https://sts.windows.net/<tenant_id>/"
```

`team_id_default` is the team whose MCP permissions JWT callers inherit. Use `https://login.microsoftonline.com/<tenant_id>/v2.0` as the issuer if the app issues v2 tokens

### B. MCP clients that sign the user in (Claude Code, VS Code, Cursor)

The user registers LiteLLM's per-server MCP URL with only the LiteLLM key. The first call gets a 401 with an [RFC 9728](https://www.rfc-editor.org/rfc/rfc9728) challenge, the client opens the Microsoft sign-in page, and from then on it attaches and refreshes the Entra token itself. Setup is under [Browser sign-in](#browser-sign-in-from-the-mcp-client); client-side mechanics are on [MCP OAuth](/docs/mcp_oauth)

### C. Custom clients that mint the token themselves

A script with no MCP OAuth support gets a gateway-audience token with MSAL or the Azure CLI (pre-authorized in prerequisite step 4) and sends it next to the LiteLLM key, exactly as in the Quick Start. The client owns refresh; Entra access tokens live about an hour. The same headers work on the `/mcp` transport and in `claude mcp add ... -H "Authorization: Bearer $TOKEN"`. The REST facade is documented on [MCP REST API](/docs/mcp_rest_api)

### D. LiteLLM key only

Admitted by LiteLLM, then refused by the guardrail with HTTP 401 and no tool execution

```json
{"detail": {"error": "Agent 365 guardrail rejected the tool call", "message": "Tool call 'read_wiki_structure' was blocked because the caller did not present an Entra bearer token; the Agent 365 guardrail authorizes tool calls On-Behalf-Of the signed-in user.", "tool": "read_wiki_structure", "guardrail_name": "agent365-mcp", "guardrail_mode": "pre_mcp_call"}}
```

On the per-server `/mcp` route the same 401 carries the sign-in challenge, so a capable client starts scenario B. The refusal only applies to servers the guardrail covers; the key keeps working on unguarded servers and on every LLM route

### Two layers of authorization

LiteLLM decides which keys, users and teams reach which servers and tools ([MCP permission management](/docs/mcp_control)). What the tool may do inside the upstream system is decided by the upstream from the credential LiteLLM presents. With a shared API key the upstream sees a service identity; to have it see the signed-in user, use `auth_type: oauth2_token_exchange` ([MCP OBO auth](/docs/mcp_obo_auth)) or per-user OAuth ([MCP OAuth](/docs/mcp_oauth)). The guardrail evaluates the call either way

## Configuration parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `tenant_id` | Yes | Entra tenant id. Falls back to `AGENT365_TENANT_ID` |
| `client_id` | Yes | Client id of the gateway app registration. Falls back to `AGENT365_CLIENT_ID` |
| `client_secret` | Yes | Client secret of that app. Also accepted as `api_key`. Falls back to `AGENT365_CLIENT_SECRET` |
| `api_base` | No | Agent 365 endpoint. Defaults to `https://agent365.svc.cloud.microsoft`. Falls back to `AGENT365_API_BASE` |
| `resource_app_id` | No | App id of the Agent 365 resource the OBO token is minted for. Defaults to the production resource. Falls back to `AGENT365_RESOURCE_APP_ID` |
| `authority_host` | No | Entra authority host for the OBO exchange, for sovereign clouds such as `https://login.microsoftonline.us`. Defaults to `https://login.microsoftonline.com`. Falls back to `AGENT365_AUTHORITY_HOST`, then `AZURE_AUTHORITY_HOST` |
| `agent_id` | No | Agent identity reported with every evaluation. Defaults to the caller's key alias |
| `timeout` | No | Seconds per token exchange and evaluation request. Defaults to 10 |
| `unreachable_fallback` | No | What happens when Agent 365 or Entra is unreachable, when Entra rejects the gateway's own credentials, or when Defender did not evaluate. `fail_closed` (default) blocks with HTTP 503. `fail_open` lets the call through unscanned and logs it. Blocks, rejections, throttling and caller-side failures always block |

## Failure behavior

By default the guardrail fails closed: when Agent 365 cannot be asked, the tool call is blocked with HTTP 503 and the MCP server is never contacted. The guardrail sits in the request path of every tool call, so a tenant that prefers availability over coverage can opt in with `unreachable_fallback: fail_open`; the call then runs and is recorded as unscanned rather than held up

| Situation | Result |
|-----------|--------|
| Defender blocks | HTTP 400 with the Defender message and correlation id. Always blocks |
| Agent 365 rejects the request (4xx other than 408/429) | HTTP 400. Always blocks |
| Allowed but Defender did not evaluate (`Skipped`, `FailedOpen`) | `fail_closed` (default): HTTP 503. `fail_open`: allowed, recorded as unscanned |
| No Entra token, or Entra rejects the caller's token (`invalid_grant`, expired, wrong audience, consent missing, malformed assertion) | HTTP 401 naming the guardrail. Always blocks. On the per-server `/mcp` route the response carries the `WWW-Authenticate` challenge so the client signs the user in |
| Entra rejects the gateway's credentials (`invalid_client`, `unauthorized_client`, `invalid_scope`, `invalid_resource`) | `fail_closed` (default): HTTP 503 naming the setting to check. `fail_open`: allowed, recorded as unscanned. Never a 401, so clients do not re-prompt |
| Agent 365 or Entra returns 408 or 429 | HTTP 503, recorded as Throttled. Always blocks |
| Agent 365 or Entra unreachable, timeout, 5xx or unparseable verdict | `fail_closed` (default): HTTP 503. `fail_open`: allowed, recorded as unscanned |

### Watching fail-open calls

With `fail_open`, every call let through unscanned is logged at error level with the reason and shows a `Unscanned` verdict with `guardrail_failed_to_respond` on its Logs row and OpenTelemetry span. Filter the Logs page on that status; a steady stream of rows means Agent 365 is not evaluating your tool calls

## Conversation grouping

Agent 365 groups evaluations by `conversationId`. The guardrail sends the `Mcp-Session-Id` when the transport has one, so all calls in one MCP session land in one Defender conversation. Stateless calls (`/mcp-rest/tools/call`, or a streamable request without a session) use LiteLLM's request id for that call, the same id the Logs row shows

## Browser sign-in from the MCP client

On the per-server routes `/<server>/mcp` and `/mcp/<server>`, a request without an Entra token is answered with HTTP 401 and `WWW-Authenticate: Bearer resource_metadata="..."` pointing at that server's RFC 9728 metadata, which names your tenant as the authorization server and lists the scope to request. Clients that implement MCP authorization (Claude Code, VS Code, Cursor) open the browser, sign the user in, cache and refresh the token, and retry. The `x-litellm-api-key` header keeps carrying the LiteLLM key. The aggregate `/mcp` route and the REST facade do not challenge, so register each guarded server by its own URL

The challenge appears when the server keeps `Authorization` with the gateway (see How it works) and an Agent 365 guardrail with `default_on: true` applies to the caller. A guardrail attached only to a key, team or policy still enforces on every call but does not challenge at connect time, because the anonymous metadata cannot tell which key's guardrail a client is about to use. An expired or wrong-audience token gets the same challenge, so the client signs in again. A key with no grant to the server gets the ordinary 403 first

The advertised scope is the server's `scopes` when set, otherwise `api://<client_id>/access_as_user`. Entra requires the scope to belong to the resource the client says it is calling, so for a public URL name the scope after it and add that URL as an Application ID URI on the gateway app with `access_as_user` under it

```yaml
mcp_servers:
  deepwiki:
    transport: http
    url: https://mcp.deepwiki.com/mcp
    scopes:
      - https://litellm.example.com/deepwiki/mcp/access_as_user
```

Entra has no dynamic client registration, so the client needs a registered client id: add a **Mobile and desktop applications** platform (on the gateway app or a separate public client) with the loopback redirect the client uses, and pre-authorize it for the scope as in prerequisite step 4. Then register the server without an `Authorization` header

```json
{
  "mcpServers": {
    "deepwiki": {
      "type": "http",
      "url": "https://litellm.example.com/deepwiki/mcp",
      "headers": {"x-litellm-api-key": "Bearer sk-1234"},
      "oauth": {"clientId": "<public client id>", "callbackPort": 51001}
    }
  }
}
```

On the first call Claude Code opens the browser, the user signs in, and the call proceeds. Keep the client's server URL, the Application ID URI and the scope on the same form: the metadata's `resource` equals the URL the client used and TypeScript SDK clients check that before signing in. To see the raw challenge

```bash
curl -i -X POST https://litellm.example.com/deepwiki/mcp \
  -H "x-litellm-api-key: Bearer sk-1234" \
  -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}'
```

```text
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer resource_metadata="https://litellm.example.com/.well-known/oauth-protected-resource/deepwiki/mcp", error="invalid_token", error_description="Missing or invalid subject token; authenticate with the IdP and retry"
```

```bash
curl -s https://litellm.example.com/.well-known/oauth-protected-resource/deepwiki/mcp
```

```json
{
  "authorization_servers": ["https://login.microsoftonline.com/<tenant_id>/v2.0"],
  "resource": "https://litellm.example.com/deepwiki/mcp",
  "scopes_supported": ["https://litellm.example.com/deepwiki/mcp/access_as_user"]
}
```
