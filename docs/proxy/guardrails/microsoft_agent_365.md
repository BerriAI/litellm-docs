import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Microsoft Agent 365 Guardrail

Send every MCP tool call through the [Microsoft Agent 365](https://learn.microsoft.com/en-us/agent-365/overview) tool evaluation API before LiteLLM executes it. Microsoft Defender scores the pending call and returns an allow or block verdict, and Agent 365 records the call for observability, both attributed to the signed-in user rather than to a service account

## Supported modes

| Mode | What it does |
|------|-------------|
| `pre_mcp_call` | Evaluates the MCP tool call (tool name, arguments, server) with Microsoft Defender before execution. Blocks when Defender returns a block verdict |

This guardrail only runs on MCP tool calls. It does not inspect chat completions or other LLM traffic

## How authentication works

The guardrail uses the Entra On-Behalf-Of (OBO) flow. The caller sends their own Entra access token, audienced to your gateway's app registration, in the `Authorization` header of the MCP request. The guardrail exchanges that token for a delegated Agent 365 token and evaluates the tool call as that user, so Defender policies and audit records apply to the real person, not to the gateway

The LiteLLM credential travels separately in the `x-litellm-api-key` header, which leaves the `Authorization` header free to carry the user's Entra token

## Prerequisites

Everything below is one-time setup in your Entra tenant, done by a tenant administrator. Step 6 is a check you can run to confirm the setup works before you configure LiteLLM at all

### 1. Onboard your tenant to Agent 365

Ask your Microsoft Agent 365 contact to onboard your Entra tenant id. Until that is done, the evaluation endpoint rejects every request with `409 BAPForbiddenTenantAccess` no matter how the app registration is configured

### 2. Register the gateway app

In the Azure portal, under **Microsoft Entra ID → App registrations → New registration**

- Name it for the gateway, for example `litellm-agent365-gateway`
- Supported account types: **Accounts in this organizational directory only**
- Leave the redirect URI empty. The gateway never signs users in itself. The one exception is the loopback redirect described under [Browser sign-in from the MCP client](#browser-sign-in-from-the-mcp-client), which belongs to the MCP client, not the gateway

Record the **Application (client) ID** and **Directory (tenant) ID**. Then under **Certificates & secrets → New client secret**, create a secret and record its value. These three become the guardrail's `client_id`, `tenant_id` and `client_secret`

### 3. Expose an API scope on the gateway app

Under **Expose an API** on that app registration

- Set the Application ID URI to `api://<client_id>`
- **Add a scope** named `access_as_user`, consentable by admins and users, state Enabled

This scope is what your MCP client requests. The user token it receives is audienced to the gateway app, which is what makes the On-Behalf-Of exchange possible

### 4. Pre-authorize your MCP client applications

Still under **Expose an API**, choose **Add a client application** and enter the client id of each application your users run the agent from, selecting the `access_as_user` scope. Without this, users hit a consent prompt or the token request fails outright

For a quick test you can pre-authorize the Azure CLI (`04b07795-8ddb-461a-bbee-02f9e1bf7b46`), which lets you mint a user token from a terminal with no browser flow

### 5. Grant the Agent 365 permission and consent it

Under **API permissions → Add a permission → APIs my organization uses**, search for **Agent Tools** (application id `ea9ffc3e-8a23-4a7d-836d-234d7c7565c1`), choose **Delegated permissions**, and select `ThreatProtection.Evaluate.All`. Then choose **Grant admin consent**

The permission must be delegated, not application. The guardrail evaluates as the signed-in user, so an application permission mints a token Agent 365 rejects

### 6. Verify the tenant setup before configuring LiteLLM

Sign in as a user in the tenant and mint a token for the gateway app

```bash
az login --tenant <tenant_id>
az account get-access-token \
  --tenant <tenant_id> \
  --resource api://<gateway_client_id>
```

A token here confirms steps 2 through 4. Decode it and check that `aud` is `api://<gateway_client_id>` and that `scp` contains `access_as_user`. This is exactly the token your MCP client will send in the `Authorization` header

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
export AGENT365_CLIENT_ID="<gateway app registration client id>"
export AGENT365_CLIENT_SECRET="<gateway app registration client secret>"

litellm --config config.yaml
```

### 3. Call an MCP tool

The caller authenticates to LiteLLM with `x-litellm-api-key` and carries their Entra user token (audienced to the gateway app) in `Authorization`

```bash
curl -X POST http://localhost:4000/mcp-rest/tools/call \
  -H "x-litellm-api-key: Bearer sk-1234" \
  -H "Authorization: Bearer $ENTRA_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "server_id": "<server_id from /mcp-rest/tools/list>",
    "name": "read_wiki_structure",
    "arguments": {"repoName": "BerriAI/litellm"}
  }'
```

An allowed call returns the tool result. A call blocked by Defender returns HTTP 400 with the Defender message and a `correlation_id` for the Microsoft audit trail

## End-to-end user workflow

Once the guardrail is on, nothing about the user's experience changes until Defender blocks something. Here is the full round trip

### What the user does

They point an MCP-capable agent at LiteLLM's MCP endpoint and ask an ordinary question. That agent can be Claude Code, VS Code, or your own client. They sign in to Entra once and the client holds the token

The simplest way to register LiteLLM in Claude Code is with a token the user minted themselves

```bash
claude mcp add --transport http litellm-agent365 \
  http://localhost:4000/mcp \
  -H "x-litellm-api-key: Bearer sk-1234" \
  -H "Authorization: Bearer $ENTRA_USER_TOKEN"
```

That token expires after about an hour, so for day-to-day use let the client sign the user in itself. See [Browser sign-in from the MCP client](#browser-sign-in-from-the-mcp-client) below

The user then types something like *"use the deepwiki tool on microsoft/vscode: what is the extension host?"*. The agent decides on its own which MCP tool to call

### What happens on each tool call

1. The agent sends `tools/call` to LiteLLM, carrying the LiteLLM key in `x-litellm-api-key` and the user's Entra token in `Authorization`
2. The `pre_mcp_call` hook reads the user's Entra token off the `Authorization` header
3. The guardrail exchanges it On-Behalf-Of for a delegated Agent 365 token, cached for the token's lifetime so later calls in the same session skip the exchange
4. It posts the pending call to the Agent 365 evaluation endpoint: tool name, arguments, server name, and `conversationId`, plus the tool's description and input schema when the MCP server published them in `tools/list`, so Defender can judge the call against what the tool claims to do
5. Microsoft Defender returns a verdict
6. On allow with `defender.status` `Evaluated`, LiteLLM executes the tool and returns its result. On block, LiteLLM returns HTTP 400 and never contacts the MCP server. When Agent 365 says `allowed: true` but Defender did not evaluate (`defender.status` is `Skipped` or `FailedOpen`), the call is treated as unscanned and `unreachable_fallback` decides

The user's prompt is not sent to Agent 365. Only the pending tool call is evaluated

### What comes back

An allowed evaluation

```json
{
  "allowed": true,
  "defender": {"status": "Evaluated", "verdict": "Allow"},
  "observability": {"status": "Emitted"},
  "correlationId": "9f2c41d8-7b60-4e1a-9a3f-2c5d8e40b117"
}
```

A blocked one, which the caller receives as HTTP 400

```json
{
  "error": "Blocked by Microsoft Defender",
  "message": "Invocation of 'ask_question' is blocked by Microsoft Threat Detection policies configured by your administrator.",
  "tool": "ask_question",
  "correlation_id": "9f2c41d8-7b60-4e1a-9a3f-2c5d8e40b117"
}
```

The agent surfaces that message to the user in its own words, and there is no tool result to report

### Where to see it afterwards

Every evaluated tool call writes a request log row on the proxy, visible under **Logs → Request Logs** in the LiteLLM UI, carrying the guardrail name, the `pre_mcp_call` mode, the evaluation latency and the verdict. Blocked calls appear as failures with a `guardrail_intervened` status and the correlation id in the error detail

Use that correlation id to line a call up with the matching record on the Microsoft side

## Configuration parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `tenant_id` | Yes | Entra tenant id used for the On-Behalf-Of token exchange. Falls back to `AGENT365_TENANT_ID` |
| `client_id` | Yes | Client id of the gateway's Entra app registration. Falls back to `AGENT365_CLIENT_ID` |
| `client_secret` | Yes | Client secret of the gateway's app registration. Also accepted via the standard `api_key` field. Falls back to `AGENT365_CLIENT_SECRET` |
| `api_base` | No | Agent 365 endpoint. Defaults to the production endpoint `https://agent365.svc.cloud.microsoft`. Falls back to `AGENT365_API_BASE` |
| `resource_app_id` | No | Application id of the Agent 365 resource the OBO token is minted for. Defaults to the production resource. Falls back to `AGENT365_RESOURCE_APP_ID` |
| `agent_id` | No | Agent identity reported to Agent 365 with every evaluation. Defaults to the caller's key alias |
| `timeout` | No | Per-request timeout in seconds for the token exchange and the evaluation call. Defaults to 10 |
| `unreachable_fallback` | No | `fail_closed` (default) blocks the tool call when Agent 365 or Entra cannot be reached, or when Agent 365 allows the call without Defender evaluating it; `fail_open` allows it unscanned. Caller-side failures (missing or rejected bearer token, evaluation 4xx) always block. Entra rejecting the gateway's own credentials (`invalid_client`, `unauthorized_client`, `invalid_scope`, `invalid_resource`) counts as unavailable, since the caller cannot fix it by signing in again |

## Failure behavior

| Situation | Result |
|-----------|--------|
| Defender verdict is block | HTTP 400 with the Defender message and correlation id. Always blocks |
| Agent 365 rejects the evaluation request (HTTP 4xx other than 408/429) | HTTP 400. Always blocks, regardless of `unreachable_fallback` |
| Agent 365 allows but Defender did not evaluate (`defender.status` is `Skipped` or `FailedOpen`) | `fail_closed`: HTTP 503. `fail_open`: allowed, recorded as unscanned |
| Caller sent no Entra bearer token | HTTP 401 with a `WWW-Authenticate` challenge pointing at the server's protected resource metadata, so a compatible client can sign the user in and retry. Always blocks, regardless of `unreachable_fallback` |
| OBO exchange rejected because of the caller's token (`invalid_grant`, consent missing, token expired) | HTTP 401. Always blocks, regardless of `unreachable_fallback` |
| OBO exchange rejected because of the gateway's credentials (`invalid_client`, `unauthorized_client`, `invalid_scope`, `invalid_resource`) | `fail_closed`: HTTP 503 naming the guardrail setting to check. `fail_open`: allowed, recorded as unscanned. Never a 401, so clients do not re-prompt the user to sign in |
| Agent 365 or Entra returns 408 or 429 (throttled) | HTTP 503, recorded as Throttled. Always blocks, regardless of `unreachable_fallback` |
| Agent 365 or Entra unreachable, timeout, or 5xx | `fail_closed`: HTTP 503. `fail_open`: allowed, recorded as unscanned |

## Conversation grouping

Evaluations are grouped on the Microsoft side by `conversationId`. The guardrail sends LiteLLM's own request id for the tool call, the same id the Logs page shows for that row, so every Defender record lines up with exactly one proxy log entry. Only when the proxy has not assigned a request id does it fall back to the MCP session id (the `Mcp-Session-Id` header of a stateful session), and it generates a fresh id if neither exists. Client-supplied headers never override a proxy-owned id

## Browser sign-in from the MCP client

When the guardrail applies to an MCP server and the request carries no Entra bearer token, LiteLLM answers `tools/list` and `tools/call` with HTTP 401 and a `WWW-Authenticate: Bearer resource_metadata="..."` header that points at that server's [RFC 9728](https://www.rfc-editor.org/rfc/rfc9728) protected resource metadata. The metadata names your Entra tenant as the authorization server and lists the scope the client should request. MCP clients that implement the MCP authorization spec (Claude Code does) follow that pointer, open a browser for Entra sign-in, cache the token and refresh it on their own, then retry the call. The user never handles a token, and the `x-litellm-api-key` header keeps carrying the LiteLLM key exactly as before

Two things have to be true for the challenge to appear. The server must not use its own `oauth2` auth (that mode advertises its own sign-in), and an Agent 365 guardrail must apply to the caller (default on, or attached to their key, team, or policy). The scope the metadata advertises is the server's `scopes` when set, otherwise `api://<client_id>/access_as_user` for the guardrail's gateway app, which is the scope prerequisite step 3 creates. Set `scopes` when you expose a different Application ID URI, for example one per MCP server

```yaml
mcp_servers:
  deepwiki:
    transport: http
    url: https://mcp.deepwiki.com/mcp
    scopes:
      - https://litellm.example.com/deepwiki/mcp/access_as_user
```

Entra checks that the scope the client requests belongs to the resource the client says it is calling, so name the scope after the URL the client uses for that MCP server. Under **Expose an API** on the gateway app registration, add an Application ID URI equal to that URL (`https://litellm.example.com/deepwiki/mcp` for the example above) and add the `access_as_user` scope under it. A token minted for that scope is still audienced to the gateway app, so the On-Behalf-Of exchange works unchanged

Entra does not support dynamic client registration, so the client needs a registered client id. Add a **Mobile and desktop applications** platform to the gateway app registration (or a separate public client app) with the loopback redirect the client uses, `http://localhost:51001/callback` in the Claude Code example below, and pre-authorize that client id for the scope as in prerequisite step 4. Then register the server in the client with the client id and no `Authorization` header

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

On the first call Claude Code opens the browser, the user signs in to Entra, and the tool call proceeds. `/mcp` in Claude Code then shows the server as connected and authenticated. The challenge names the metadata document for the route the client connected to (`/.well-known/oauth-protected-resource/<server>/mcp` for `/<server>/mcp`, `/.well-known/oauth-protected-resource/mcp/<server>` for `/mcp/<server>`), and that document's `resource` equals the URL the client used. MCP clients built on the TypeScript SDK check that equality before starting sign-in, so keep the client's server URL, the Application ID URI, and the scope on the same form. You can see the raw challenge yourself

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
  "authorization_servers": ["https://login.microsoftonline.com/<tenant id>/v2.0"],
  "resource": "https://litellm.example.com/deepwiki/mcp",
  "scopes_supported": ["https://litellm.example.com/deepwiki/mcp/access_as_user"]
}
```
