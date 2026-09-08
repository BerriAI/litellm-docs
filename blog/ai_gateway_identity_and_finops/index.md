---
slug: ai-gateway-identity-and-finops
title: "Secure shared AI agents with identity-aware access and spend controls"
date: 2026-09-08T10:00:00
authors:
  - yassin
description: "How LiteLLM preserves caller identity across shared agents, governs model and MCP access, and enforces independent budgets for each business unit."
tags: [product, agents, mcp, security, finops]
hide_table_of_contents: false
---

A shared agent should not mean a shared identity.

When a finance agent serves multiple business units, platform teams still need to know who initiated each request, which models and tools that caller can access, and whose budget should be charged. Without that context, a shared agent becomes a shared account: access controls get broader, spend is harder to attribute, and one team's usage can affect everyone else.

LiteLLM provides one control plane for this workflow across the Agent Gateway, Model Gateway, and MCP Gateway. Teams can share the same agent infrastructure while keeping access, credentials, spend, and audit data tied to the right caller.

{/* truncate */}

## One gateway for the complete agent workflow

A typical agent request crosses four boundaries:

1. A user calls an agent.
2. The agent calls a model.
3. The agent calls an MCP tool.
4. The agent calls another agent.

LiteLLM governs each boundary through a single proxy:

```mermaid
flowchart LR
    User(["User"]) -- "1: message/send" --> AG["Agent Gateway"]
    AG --> Agent["Finance Agent"]
    Agent -- "2: /v1/chat/completions" --> MG["Model Gateway"]
    Agent -- "3: tool calls" --> MCG["MCP Gateway"]
    MCG --> MCP["Finance MCP Server"]
    Agent -- "4: message/send" --> AG2["Agent Gateway"]
    AG2 --> Agent2["Summarizer Agent"]
```

The [Agent Gateway](../../docs/a2a) authenticates callers, controls which teams and keys can invoke each agent, and records request, response, latency, and cost data. The Model Gateway routes LLM traffic and applies budgets and rate limits. The MCP Gateway centralizes tool access and upstream authentication.

Together, they let platform teams operate agents as shared services without giving up per-user governance.

## Authenticate every call to a shared agent

Start by registering each agent in the Agent Gateway. Agents appear in the Admin UI with their status and spend data:

![Agents tab showing the finance-agent and summarizer-agent registered on the Agent Gateway](/img/a2a_gateway_poc_agents_tab.png)

Users can have personal virtual keys while belonging to the same shared team. In this example, two business units use separate keys under `shared-agents-team`:

![Virtual Keys tab showing two personal keys, op-unit-a and op-unit-b, sharing one team](/img/a2a_gateway_poc_virtual_keys_tab.png)

The team's object permissions define which agents and MCP servers its keys can access. This lets both business units use the same finance agent without duplicating the agent registration or distributing its upstream credentials.

![Teams tab showing shared-agents-team with its resources and combined spend against a $5 budget](/img/a2a_gateway_poc_teams_tab.png)

When a request reaches the Agent Gateway, LiteLLM authenticates the virtual key and resolves its user and team. The gateway forwards that verified context to the agent as `X-LiteLLM-User-Id` and `X-LiteLLM-Team-Id`.

```mermaid
sequenceDiagram
    participant U as Business Unit User
    participant AG as LiteLLM Agent Gateway
    participant FA as Finance Agent

    U->>AG: message/send with personal virtual key
    AG->>AG: Authenticate key and resolve user + team
    AG->>FA: Forward request with verified identity
    FA-->>AG: Agent response
    AG-->>U: Agent response
```

The identity comes from LiteLLM's authenticated key context. A caller cannot replace it by supplying a different LiteLLM identity header.

Clients invoke the shared agent through the standard A2A JSON-RPC interface:

```bash
curl -X POST "$LITELLM_BASE_URL/a2a/$AGENT_ID" \
  -H "Authorization: Bearer $LITELLM_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "request-1",
    "method": "message/send",
    "params": {
      "message": {
        "kind": "message",
        "messageId": "message-1",
        "role": "user",
        "parts": [
          {"kind": "text", "text": "Give me a one-sentence finance status update."}
        ]
      }
    }
  }'
```

## Keep user attribution on model calls

The finance agent calls the Model Gateway with its own agent-owned virtual key. That keeps the agent's service credentials separate from the user's credentials.

For per-user attribution, the agent reads the verified `X-LiteLLM-User-Id` value from the inbound request and supplies it as the `user` field on its outbound model request. It also forwards LiteLLM trace and agent context headers so calls remain grouped under the same execution and spend is attributed to the correct agent.

This gives LiteLLM two useful dimensions at the same time:

- The agent-owned key identifies the workload making the model call.
- The `user` field identifies the customer or business unit whose budget applies.

Multiple teams can therefore share one agent and one model route while LiteLLM maintains separate usage and budget records for each caller.

## Apply each user's permissions to MCP tools

The same finance agent can access tools through the MCP Gateway without storing separate credentials for every upstream system.

In this example, the finance MCP server exposes two tools:

- `get_revenue_summary`, available to any authorized caller
- `get_payroll_details`, restricted to users with the `finance-payroll-access` group

![MCP Servers tab showing the finance_mcp server registered on the MCP Gateway](/img/a2a_gateway_poc_mcp_servers_tab.png)

For interactive per-user OAuth, configure the MCP server with `auth_type: oauth2` and `oauth2_flow: authorization_code`. The user completes a PKCE sign-in with the organization's identity provider. LiteLLM stores the resulting credential for that user and MCP server, then attaches it to later tool calls for the same user.

The upstream MCP server remains the authorization authority. It evaluates the token's claims and decides whether the user can access payroll details or only the broader revenue summary. LiteLLM centralizes the OAuth flow and credential handling without flattening every user into one shared upstream identity.

See [MCP OAuth](../../docs/mcp_oauth) for configuration options, including machine-to-machine and on-behalf-of flows.

## Preserve the original user across agent-to-agent calls

An agent-to-agent call has two identities:

- The immediate caller, such as the finance agent's service key
- The originating user who started the workflow

LiteLLM authenticates and records the immediate caller at every gateway hop. It does not silently treat a service key as the original human. This keeps the trust boundary clear and prevents an arbitrary caller from asserting another user's LiteLLM identity.

If a downstream agent needs the originating user's context, the calling agent carries that verified context explicitly as application metadata or a permitted forwarded header. The downstream agent can then use it for business logic, while LiteLLM continues to authenticate the service identity that made the hop.

This distinction is useful for multi-agent systems: platform logs show which agent made each call, and application context shows which user initiated the overall workflow.

## Enforce independent budgets below the shared team

Shared infrastructure does not require a shared spend limit.

LiteLLM supports budgets at multiple levels, including keys, teams, agents, and customers. For a shared-agent deployment, create a customer record for each business unit and pass that customer ID in the model request's `user` field.

For example:

- `op-unit-a`: $0.01 budget
- `op-unit-b`: $5.00 budget
- Both units: the same finance agent and `shared-agents-team`

```mermaid
sequenceDiagram
    participant A as Op Unit A ($0.01 budget)
    participant B as Op Unit B ($5.00 budget)
    participant Agent as Shared Finance Agent
    participant MG as LiteLLM Model Gateway

    A->>Agent: message/send
    Agent->>MG: chat completion with user=op-unit-a
    MG-->>Agent: 429 when Op Unit A is over budget
    B->>Agent: message/send
    Agent->>MG: chat completion with user=op-unit-b
    MG-->>Agent: 200 while Op Unit B has budget
```

When one unit reaches its limit, LiteLLM rejects that unit's model requests without consuming the other unit's budget or throttling its traffic. The shared team budget can still provide an aggregate ceiling across both units.

This gives FinOps teams both views they need: consolidated spend for the shared service and independent controls for each business unit using it.

## A practical deployment pattern

To apply this architecture:

1. Register shared agents in the Agent Gateway.
2. Grant teams access to the required agents and MCP servers through object permissions.
3. Issue user-scoped virtual keys under the appropriate team.
4. Read the verified inbound user context and pass it as `user` on model calls.
5. Configure per-user OAuth for MCP servers that enforce user-specific permissions.
6. Create customer budgets for each business unit, with an optional aggregate team budget.
7. Use LiteLLM Logs to audit the user, key, team, agent, latency, and cost for each request.

The result is a shared agent platform with clear security and financial boundaries: users see only the tools and data they are authorized to access, spend is attributed to the correct business unit, and each unit can be governed independently without duplicating agent infrastructure.

Explore the [Agent Gateway](../../docs/a2a), [MCP Gateway](../../docs/mcp), and [budget and rate-limit controls](../../docs/proxy/users) to build this pattern in your LiteLLM deployment.
