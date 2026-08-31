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

1. **An Entra app registration for your gateway** (a confidential client with a client secret) that
   - exposes an API scope (for example `api://<client_id>/access_as_user`) so client apps can mint user tokens audienced to the gateway
   - has the delegated `ThreatProtection.Evaluate.All` permission on the Agent 365 resource app, with admin consent granted

2. **Tenant onboarding to Agent 365.** Your tenant must be onboarded to Microsoft Agent 365 for the evaluation endpoint to accept requests

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
| `unreachable_fallback` | No | `fail_closed` (default) blocks the tool call when Agent 365 or Entra cannot be reached; `fail_open` allows it unscanned. Caller-side failures (missing or rejected bearer token, evaluation 4xx) always block |

## Failure behavior

| Situation | Result |
|-----------|--------|
| Defender verdict is block | HTTP 400 with the Defender message and correlation id. Always blocks |
| Agent 365 rejects the evaluation request (HTTP 4xx other than 408/429) | HTTP 400. Always blocks, regardless of `unreachable_fallback` |
| Caller sent no Entra bearer token | HTTP 401. Always blocks, regardless of `unreachable_fallback` |
| OBO exchange rejected by Entra | HTTP 401. Always blocks, regardless of `unreachable_fallback` |
| Agent 365 or Entra returns 408 or 429 (throttled) | HTTP 503, recorded as Throttled. Always blocks, regardless of `unreachable_fallback` |
| Agent 365 or Entra unreachable, timeout, or 5xx | `fail_closed`: HTTP 503. `fail_open`: allowed, recorded as unscanned |

## Conversation grouping

Evaluations are grouped into conversations on the Microsoft side by `conversationId`. The guardrail uses the `Mcp-Session-Id` header of a stateful MCP session when present, and falls back to the request's call id, so multi-turn MCP sessions share Defender chat history
