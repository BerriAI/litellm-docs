---
slug: ai-gateway-identity-and-finops
title: "Identity and FinOps for shared agents on the LiteLLM AI Gateway"
date: 2026-09-08T10:00:00
authors:
  - yassin
description: "How LiteLLM's Agent Gateway, Model Gateway, and MCP Gateway carry a caller's identity to a shared agent, and how that identity drives per-team FinOps budgets, proved against a real running proxy."
tags: [product, agents, mcp, security]
hide_table_of_contents: false
---

A customer running agents behind LiteLLM's AI Gateway asked us two questions that come up constantly once an agent stops being a toy and starts being shared infrastructure. First: when an agent, not a human, calls an MCP server on LiteLLM's behalf, how does that call get scoped to the identity of whoever is actually talking to the agent, so a finance agent can hand back payroll data to a manager and a redacted summary to everyone else? Second: if one agent is shared by two business units, how do you split its spend cleanly per unit and cap one without throttling the other, when keys and budgets are normally scoped one team per credential?

We built a real, live proof of concept to answer both questions against a running LiteLLM proxy, using a real model behind it and paying for real tokens. Along the way we found and fixed a genuine bug in how LiteLLM's Agent Gateway forwards caller identity.

{/* truncate */}

## The architecture: three gateways, one identity

LiteLLM's AI Gateway is really three gateways behind one proxy. The [Agent Gateway](../../docs/a2a) speaks the A2A protocol and lets a caller invoke an agent the same way it would invoke a model; the Model Gateway is the core LLM routing layer behind `/v1/chat/completions` and friends; the MCP Gateway hosts and proxies MCP servers so an agent can call tools without holding its own credentials for each one. An agent registered on LiteLLM sits behind the Agent Gateway and, on the way to answering a request, typically calls back out through the other two: it asks the Model Gateway for a completion and the MCP Gateway for tool results, all using its own agent-owned virtual key.

The four request patterns we set out to prove all sit on top of this:

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

The question in both cases is the same: does the identity of the human at the left edge of that diagram survive all the way to the right edge, and if it does, what can LiteLLM do with it once it's there.

## Interaction 1: a user calls a shared agent

We registered a finance agent and a second, trivial summarizer agent on the Agent Gateway. Both show up in the Admin UI's Agents tab with their own spend and status:

![Agents tab showing the finance-agent and summarizer-agent registered on the Agent Gateway](/img/a2a_gateway_poc_agents_tab.png)

Two personal, user-scoped keys sit under one shared team, `shared-agents-team`, one per business unit:

![Virtual Keys tab showing two personal keys, op-unit-a and op-unit-b, sharing one team](/img/a2a_gateway_poc_virtual_keys_tab.png)

Either unit calls the finance agent the same way, over the Agent Gateway's JSON-RPC surface:

```mermaid
sequenceDiagram
    participant U as Op Unit User
    participant AG as Agent Gateway (LiteLLM)
    participant FA as Finance Agent

    U->>AG: POST /a2a/{agent_id} message/send (Bearer: personal key)
    AG->>AG: authenticate key, resolve user_id and team_id
    AG->>FA: forward JSON-RPC + X-LiteLLM-User-Id header
    FA-->>AG: agent response
    AG-->>U: agent response
```

```bash
curl -X POST http://localhost:4600/a2a/0abb13e9-e195-4e80-a2c9-c293e4bcb60d \
  -H "Authorization: Bearer sk-wGq5WeqU3EC63f-0OirBCw" \
  -d '{
    "jsonrpc": "2.0",
    "id": "demo-1",
    "method": "message/send",
    "params": {
      "message": {
        "kind": "message",
        "messageId": "msg-1",
        "role": "user",
        "parts": [{"kind": "text", "text": "Give me a one sentence finance status update."}]
      }
    }
  }'
```

The team's `object_permission` grants both agents and the MCP server to `shared-agents-team`, independent of which member is calling; a key can only use what its team already allows, so the two op units share access without either one needing its own separate agent registration.

![Teams tab showing shared-agents-team with its resources and combined spend against a $5 budget](/img/a2a_gateway_poc_teams_tab.png)

## Interaction 2: the agent calls the model

Once the finance agent has a request, it answers it the same way any LiteLLM client would: a plain `POST /v1/chat/completions` against the Model Gateway, authenticated with its own agent-owned virtual key rather than the caller's key. The one thing it does differently is read the `X-LiteLLM-User-Id` header LiteLLM attached to the inbound request and pass that value through as the `user` field on its own outbound call. That single field is what lets a request placed by op-unit-a and a request placed by op-unit-b, both flowing through the identical agent using the identical model key, still be billed and budgeted separately on the way out.

## Interaction 3: the agent calls MCP

The finance agent also calls a finance MCP server through the MCP Gateway for two tools: `get_revenue_summary`, open to any caller, and `get_payroll_details`, gated on a JWT `groups` claim that requires `finance-payroll-access`. The MCP server itself enforces that gate; LiteLLM's job is making sure the right per-user credential reaches it in the first place.

![MCP Servers tab showing the finance_mcp server registered on the MCP Gateway](/img/a2a_gateway_poc_mcp_servers_tab.png)

LiteLLM supports exactly this through `delegate_auth_to_upstream` OAuth2 delegation: an end user completes an interactive PKCE login against the customer's own identity provider once, and LiteLLM stores the resulting per-user token, keyed by user id and MCP server, and attaches it on every subsequent call that user makes through that server. We wired this up and confirmed the storage and attachment mechanism, and confirmed the MCP server's own role check correctly denies `get_payroll_details` to a caller without the right group, which is the enforcement point that actually matters. What we did not get working live in this session was the interactive login itself: our sandbox Okta tenant kept returning "User is not assigned to the client application" despite app assignment, sign-on policy, and authorization server access policy all looking correct, and we ran out of things to try. So the tool-gating and token-storage halves of this story are proven; the human clicking through an Okta login screen is a gap we're leaving open for a follow-up.

## Interaction 4: agent calls agent, and where identity stops

The finance agent's last step is a second Agent Gateway call, this time to the summarizer agent, using its own service key rather than a human's. This worked exactly like interaction 1 in one respect and differently in another. It worked because the Agent Gateway authenticates that call the same way: it looks at whoever is calling it right now (the finance agent's key) and stamps that caller's identity onto the forwarded request. It differed because the finance agent's own key isn't tied to any end user, so there is no user id to stamp; the summarizer agent receives no `X-LiteLLM-User-Id` at all.

That's deliberate, not a residual gap. LiteLLM never relays a client-asserted identity header past the gateway; it only ever attaches the identity of whoever the gateway itself just authenticated. A malicious or buggy caller cannot hand the gateway an `X-LiteLLM-User-Id` and have it forwarded verbatim to a downstream agent. If a multi-hop agent chain needs to preserve the original human's identity across every hop, that has to be an explicit design decision on the calling agent's side (carrying it forward itself, the way our finance agent does when it forwards the header it received to the model and MCP calls), not something the gateway does implicitly for a hop it has no reason to trust.

## The bug: identity that only worked half the time

While wiring up interaction 4 with real, personal, user-scoped keys, we noticed the finance agent's own logs never showed a user id at all, on any interaction, not just the agent-to-agent one. Digging into `litellm/proxy/agent_endpoints/a2a_endpoints.py` turned up the cause: a helper, `_forwarding_headers()`, stamps `X-LiteLLM-User-Id` and `X-LiteLLM-Team-Id` from the authenticated caller onto the outbound request, but it was only ever called from the `tasks/*` and `tasks/resubscribe` JSON-RPC branches. The primary conversational path, `message/send` and `message/stream`, the one every one of our four interactions actually uses, forwarded the request untouched. Every agent invoked the normal way was silently blind to who was calling it; only the rarer task-management calls carried identity at all.

We reproduced this directly against our running proxy. With the unfixed code (commit `35451ecc7b`), calling the finance agent with op-unit-b's key produced a normal `200` response, but the agent's own log read:

```
[agent_backend] message_send text='Give me a one sentence finance status update.' end_user_id=None
```

With the fix applied (commit `fff3efa5c5`), the identical request against the identical agent produced:

```
[agent_backend] message_send text='Give me a one sentence finance status update.' end_user_id='81767727-927c-4b93-81b6-5896ede23d5e'
```

that value being op-unit-b's real customer id. The fix moves the identity stamp so it applies uniformly across every A2A method, matching what `tasks/*` already did, and we added regression tests covering both the forwarding itself and that a client cannot spoof the header to claim someone else's identity. The change is up for review in [PR #40305](https://github.com/BerriAI/litellm/pull/40305); the underlying gap is tracked as [LIT-7342](https://linear.app/litellm-ai/issue/LIT-7342/a2a-messagesend-does-not-forward-caller-identity-to-downstream-agents).

## The FinOps answer: budgets that live below the team

With identity actually reaching the agent, the FinOps question has a concrete answer. LiteLLM tracks a `LiteLLM_EndUserTable` "Customer" record per end user, each with its own budget that's checked and hard-enforced independently of whatever team or key budget also applies; a customer's spend hitting its cap raises a `429` regardless of how much headroom the team above it still has. We created one customer per business unit, `op-unit-a` capped at `$0.01` and `op-unit-b` at `$5.00`, both billed against calls made through the same shared finance agent and the same shared team budget.

```mermaid
sequenceDiagram
    participant A as Op Unit A ($0.01 budget, exhausted)
    participant B as Op Unit B ($5.00 budget)
    participant Agent as Finance Agent (shared)
    participant MG as Model Gateway

    A->>Agent: message/send
    Agent->>MG: /v1/chat/completions (user=op-unit-a)
    MG-->>Agent: 429 Too Many Requests
    B->>Agent: message/send
    Agent->>MG: /v1/chat/completions (user=op-unit-b)
    MG-->>Agent: 200, real answer
```

That is exactly what we saw once the fix was live. Op-unit-a's key, whose budget was already spent down from earlier testing, got a `429` on both the model call and the second agent hop, while op-unit-b's identical request, through the identical shared agent, went through end to end: a real model answer, a successful `get_revenue_summary` call returning real MCP tool output, and a successful relay to the summarizer agent. One business unit's cap does not touch the other's throughput, because the enforcement point is the individual customer's own budget, not the shared team's.

## Where this leaves the two questions

Per-user MCP scoping on a shared agent works the same way the model call does: LiteLLM's job is delivering the calling user's identity to the agent, and from there the agent (and the MCP server's own auth) decides what that identity is allowed to see; we proved the token storage and role-gating mechanics work, with the interactive Okta login itself as the one piece still on our list. FinOps isolation on a shared agent works today, per customer, orthogonally to team and key budgets, and we proved it live: one exhausted business unit throttled, the other one, sharing the same agent and the same team, completely unaffected.
