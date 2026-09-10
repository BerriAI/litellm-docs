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

The guardrail has two authentication modes. The default, `on_behalf_of`, evaluates every tool call as the human who is signed in to the MCP client. The second, `agent_identity`, evaluates as a [Microsoft Entra Agent ID](https://learn.microsoft.com/en-us/entra/agent-id/) that the gateway owns, for agents that run headless or behind a shared LiteLLM key with no Entra user in the loop. The rest of this page describes `on_behalf_of`; see [Agent identity mode](#agent-identity-mode) for the other

In `on_behalf_of` mode the guardrail uses the Entra On-Behalf-Of (OBO) flow. The caller sends their own Entra access token, audienced to your gateway's app registration, in the `Authorization` header of the MCP request. The guardrail exchanges that token for a delegated Agent 365 token and evaluates the tool call as that user, so Defender policies and audit records apply to the real person, not to the gateway

The LiteLLM credential travels separately in the `x-litellm-api-key` header, which leaves the `Authorization` header free to carry the user's Entra token

## Prerequisites

Everything below is one-time setup in your Entra tenant, done by a tenant administrator. Step 6 is a check you can run to confirm the setup works before you configure LiteLLM at all

### 1. Onboard your tenant to Agent 365

Ask your Microsoft Agent 365 contact to onboard your Entra tenant id. Until that is done, the evaluation endpoint rejects every request with `409 BAPForbiddenTenantAccess` no matter how the app registration is configured

### 2. Register the gateway app

In the Azure portal, under **Microsoft Entra ID → App registrations → New registration**

- Name it for the gateway, for example `litellm-agent365-gateway`
- Supported account types: **Accounts in this organizational directory only**
- Leave the redirect URI empty. The gateway never signs users in itself

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

Registering LiteLLM as an MCP server in Claude Code, for example

```bash
claude mcp add --transport http litellm-agent365 \
  http://localhost:4000/mcp \
  -H "x-litellm-api-key: Bearer sk-1234" \
  -H "Authorization: Bearer $ENTRA_USER_TOKEN"
```

The user then types something like *"use the deepwiki tool on microsoft/vscode: what is the extension host?"*. The agent decides on its own which MCP tool to call

### What happens on each tool call

1. The agent sends `tools/call` to LiteLLM, carrying the LiteLLM key in `x-litellm-api-key` and the user's Entra token in `Authorization`
2. The `pre_mcp_call` hook reads the user's Entra token off the `Authorization` header
3. The guardrail exchanges it On-Behalf-Of for a delegated Agent 365 token, cached for the token's lifetime so later calls in the same session skip the exchange
4. It posts the pending call to the Agent 365 evaluation endpoint: tool name, arguments, server name, and `conversationId`
5. Microsoft Defender returns a verdict
6. On allow, LiteLLM executes the tool and returns its result. On block, LiteLLM returns HTTP 400 and never contacts the MCP server

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

## Agent identity mode

Set `auth_mode: agent_identity` when the callers of your MCP endpoint have no Entra user token to send: a scheduled agent, a CI job, a service that talks to LiteLLM with a shared key. The guardrail then acts as an Entra Agent ID of its own and mints the Agent 365 token itself, so the MCP request needs only `x-litellm-api-key`. Defender evaluates and audits as the agent's user account, which shows up in the Microsoft audit trail under its own name rather than as a human or a bare app registration

### Tenant setup

Everything here is one-time Graph or portal work by a tenant administrator, after steps 1 and 5 of the prerequisites above (tenant onboarded, `ThreatProtection.Evaluate.All` visible in the tenant). Create an agent identity blueprint (`POST /applications` with `@odata.type` `Microsoft.Graph.AgentIdentityBlueprint`, then `POST /servicePrincipals` with `Microsoft.Graph.AgentIdentityBlueprintPrincipal` for its `appId`) and add a client secret to it; the blueprint's application id and that secret become the guardrail's `client_id` and `client_secret`. Create an agent identity from the blueprint (`POST /servicePrincipals/microsoft.graph.agentIdentity` with `agentIdentityBlueprintId` set to the blueprint's application id); its `appId` becomes `agent_identity_client_id`. Create an agent user parented by that identity (`POST /users/microsoft.graph.agentUser` with `identityParentId` set to the agent identity's object id); its `userPrincipalName` becomes `agent_user_upn`. Finally grant the agent identity the delegated `ThreatProtection.Evaluate.All` scope on the Agent Tools resource (`POST /oauth2PermissionGrants` with `clientId` the agent identity's object id, `resourceId` the Agent Tools service principal in your tenant, `consentType` `AllPrincipals`)

### Configure and call

```yaml
guardrails:
  - guardrail_name: agent365-mcp
    litellm_params:
      guardrail: agent_365
      mode: pre_mcp_call
      default_on: true
      auth_mode: agent_identity
      tenant_id: os.environ/AGENT365_TENANT_ID
      client_id: os.environ/AGENT365_BLUEPRINT_CLIENT_ID
      client_secret: os.environ/AGENT365_BLUEPRINT_CLIENT_SECRET
      agent_identity_client_id: os.environ/AGENT365_AGENT_IDENTITY_CLIENT_ID
      agent_user_upn: os.environ/AGENT365_AGENT_USER_UPN
```

```bash
curl -X POST http://localhost:4000/mcp-rest/tools/call \
  -H "x-litellm-api-key: Bearer sk-1234" \
  -H "Content-Type: application/json" \
  -d '{
    "server_id": "<server_id from /mcp-rest/tools/list>",
    "name": "read_wiki_structure",
    "arguments": {"repoName": "BerriAI/litellm"}
  }'
```

No `Authorization` header is needed, and one sent anyway is ignored by the guardrail. Registering LiteLLM in Claude Code is the same `claude mcp add` command as above without the `Authorization` header

### What happens on each tool call

On the first tool call the guardrail runs the Entra Agent ID token chain: a client-credentials token for the blueprint with `fmi_path` set to the agent identity, an agent identity token obtained with that blueprint token as a client assertion, and finally a delegated `ThreatProtection.Evaluate.All` token for the agent user through the `user_fic` grant. The final token is cached until shortly before it expires and shared by concurrent calls, so later calls skip the chain. The evaluation request and the verdict handling are the same as in `on_behalf_of` mode

A rejected chain (wrong blueprint secret, agent user disabled, missing permission grant) is a gateway-side problem rather than a caller problem, so `unreachable_fallback` decides: `fail_closed` returns HTTP 503 with the Entra error code in the message, `fail_open` lets the call through unscanned and records it as such. Startup fails with a clear message when `auth_mode` is `agent_identity` and `agent_identity_client_id` or `agent_user_upn` is missing

## Configuration parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `auth_mode` | No | `on_behalf_of` (default) exchanges the caller's Entra token; `agent_identity` mints the token as an Entra Agent ID, see [Agent identity mode](#agent-identity-mode) |
| `tenant_id` | Yes | Entra tenant id used for the token exchange. Falls back to `AGENT365_TENANT_ID` |
| `client_id` | Yes | Client id of the gateway's Entra app registration, or of the agent identity blueprint in `agent_identity` mode. Falls back to `AGENT365_CLIENT_ID` |
| `client_secret` | Yes | Client secret of that app registration or blueprint. Also accepted via the standard `api_key` field. Falls back to `AGENT365_CLIENT_SECRET` |
| `agent_identity_client_id` | In `agent_identity` mode | Client id of the Entra agent identity created from the blueprint. Falls back to `AGENT365_AGENT_IDENTITY_CLIENT_ID` |
| `agent_user_upn` | In `agent_identity` mode | User principal name of the agent user parented by the agent identity. Falls back to `AGENT365_AGENT_USER_UPN` |
| `api_base` | No | Agent 365 endpoint. Defaults to the production endpoint `https://agent365.svc.cloud.microsoft`. Falls back to `AGENT365_API_BASE` |
| `resource_app_id` | No | Application id of the Agent 365 resource the OBO token is minted for. Defaults to the production resource. Falls back to `AGENT365_RESOURCE_APP_ID` |
| `agent_id` | No | Agent identity reported to Agent 365 with every evaluation. Defaults to the caller's key alias |
| `timeout` | No | Per-request timeout in seconds for the token exchange and the evaluation call. Defaults to 10 |
| `unreachable_fallback` | No | `fail_closed` (default) blocks the tool call when Agent 365 or Entra cannot be reached; `fail_open` allows it unscanned. Caller-side failures (missing or rejected bearer token, evaluation 4xx) always block |

## Failure behavior

| Situation | Result |
|-----------|--------|
| Defender verdict is block | HTTP 400 with the Defender message and correlation id. Always blocks |
| Agent 365 rejects the evaluation request (HTTP 4xx other than 408/429) | HTTP 400. Always blocks, regardless of `unreachable_fallback` |
| Caller sent no Entra bearer token (`on_behalf_of` mode) | HTTP 401. Always blocks, regardless of `unreachable_fallback` |
| OBO exchange rejected by Entra (`on_behalf_of` mode) | HTTP 401. Always blocks, regardless of `unreachable_fallback` |
| Agent identity token chain rejected by Entra (`agent_identity` mode) | `fail_closed`: HTTP 503 with the Entra error code. `fail_open`: allowed, recorded as unscanned |
| Agent 365 or Entra returns 408 or 429 (throttled) | HTTP 503, recorded as Throttled. Always blocks, regardless of `unreachable_fallback` |
| Agent 365 or Entra unreachable, timeout, or 5xx | `fail_closed`: HTTP 503. `fail_open`: allowed, recorded as unscanned |

## Conversation grouping

Evaluations are grouped into conversations on the Microsoft side by `conversationId`. The guardrail uses the `Mcp-Session-Id` header of a stateful MCP session when present, and falls back to the request's call id, so multi-turn MCP sessions share Defender chat history
