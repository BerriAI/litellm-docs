---
title: LiteAsk
---

LiteAsk lets proxy administrators inspect and manage gateway resources from a chat panel in the dashboard. It uses your existing dashboard session and the same management APIs as the dashboard forms

## Open LiteAsk

Sign in to a gateway version that includes LiteAsk using your usual login or SSO. If your role is `proxy_admin`, the **LiteAsk** button appears at the bottom right of the gateway dashboard. Read-only proxy administrators, organization administrators, team administrators and other users do not see it

Open the panel and choose a configured chat model that supports function calling. If inference uses a different origin from the management API, first review the displayed address and select **Use configured gateway** to send your existing session credential there. Your session must have access to that model. Model requests use the gateway's normal authorization, rate limits, budgets and logging

LiteAsk ships with the dashboard. It does not need a separate agent deployment, shared administrator key, additional login, Redis approval store or LiteAsk-specific environment variable

## Ask for information or a change

Try `Show the spend and budget for the platform team`, `Create a team named staging with a $50 monthly budget`, or `Move this key to the staging team`. Use resource names or key hashes instead of pasting API keys into the conversation

Lookups run immediately. For a change, LiteAsk shows the operation and arguments in a review card inside the conversation. Select **Confirm change** to send that request under your current session, or **Cancel** to discard it. Each change needs its own confirmation

After a successful change, the relevant dashboard data refreshes. If a write is interrupted or its response cannot be verified, inspect the resource before trying again. LiteAsk does not automatically retry management writes

## Supported operations

| Resource | Operations |
| --- | --- |
| Virtual keys | List, inspect, create, update, delete, block and unblock; assign an existing key to a team |
| Teams | List, inspect, create, update and delete; add, update and remove members |
| Users | List, inspect, create, update and delete |
| Budgets | List, inspect, create, update and delete |
| Spend | Query gateway, team and key reports, subject to the reports' existing licensing and permissions |
| Request logs | Query operational details such as model, status, time, token usage and cost |

The initial tools expose common resource fields, including model access, budgets and rate limits. They do not expose every API option. Optional null inputs mean omitted or unchanged; use the ordinary dashboard forms for clearing fields or changing unsupported settings

Model/provider configuration, SSO settings, arbitrary metadata and arbitrary HTTP requests are outside this initial catalog. Request log tools do not send stored prompts, responses or raw request bodies to the assistant model

## Session and generated keys

LiteAsk follows the gateway's existing authentication and authorization policy. Opening the widget does not grant additional access. Every model request and management operation is authenticated by its normal endpoint

Newly generated keys appear in a separate copy panel and are excluded from tool results sent to the model. Conversations and pending reviews stay in browser memory. Starting a new chat or changing the signed-in account clears that state

## Split deployments

LiteAsk uses the dashboard's existing management API address for management operations. For inference, it suggests `LITELLM_UI_API_DOC_BASE_URL` when configured, then `PROXY_BASE_URL`, and otherwise uses the management address

When the management backend and inference gateway have different public addresses, set `LITELLM_UI_API_DOC_BASE_URL` to the inference gateway address. The selected model must be available there. Use the same CORS and session-header configuration as the Playground

A different inference origin requires explicit approval for the current session and address. Changing the account, credential or address clears that approval and the conversation. LiteAsk rejects invalid addresses, embedded credentials and HTTPS-to-HTTP downgrades. Use the final inference address because LiteAsk does not follow redirects
