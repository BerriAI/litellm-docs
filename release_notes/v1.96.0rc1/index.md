---
title: "v1.96.0rc1 - MCP Entitlements, Redis Config Sync & Auto-Router Context"
slug: "v1-96-0-rc-1"
date: 2026-08-03T12:53:08
authors:
  - name: Krrish Dholakia
    title: CEO, LiteLLM
    url: https://www.linkedin.com/in/krish-d/
    image_url: https://pbs.twimg.com/profile_images/1298587542745358340/DZv3Oj-h_400x400.jpg
  - name: Ishaan Jaff
    title: CTO, LiteLLM
    url: https://www.linkedin.com/in/reffajnaahsi/
    image_url: https://pbs.twimg.com/profile_images/1613813310264340481/lz54oEiB_400x400.jpg
  - name: Yuneng Jiang
    title: Senior Full Stack Engineer, LiteLLM
    url: https://www.linkedin.com/in/yuneng-david-jiang-455676139/
    image_url: https://avatars.githubusercontent.com/u/171294688?v=4
hide_table_of_contents: false
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

## Deploy this version

<Tabs>
<TabItem value="docker" label="Docker">

```bash
docker run \
-e STORE_MODEL_IN_DB=True \
-p 4000:4000 \
docker.litellm.ai/berriai/litellm:1.96.0-rc.1
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.96.0rc1
```

</TabItem>
</Tabs>

:::danger Breaking Changes

**Auto-routers now pin a session to one deployment inside each model group by default.** The new `complexity_router_config.deployment_affinity` defaults to `true`, so an auto-router whose callers send a session id (via `x-litellm-session-id`, `x-litellm-trace-id`, or any `x-<vendor>-session-id` header) stops load-balancing those turns across deployments of the same model group. Tiering, spend, and which model serves a turn are unaffected; only the choice among deployments of one group changes. Set `deployment_affinity: false` under `complexity_router_config` to keep the previous behavior. See [PR #36146](https://github.com/BerriAI/litellm/pull/36146).

**Session deployment pins are now scoped by API key, so existing pins miss once on upgrade.** Callers using `optional_pre_call_checks: ["session_affinity"]` will see each active session take one load-balanced turn before re-pinning, because the cache key gained a hashed-API-key segment. No action is required and pins re-establish on the next request. The scoping closes a hole where two callers sending the same client-supplied session id shared one pin. See [PR #36146](https://github.com/BerriAI/litellm/pull/36146).

:::

## Key Highlights

`v1.96.0rc1` is the current release candidate for 1.96.0.

- **MCP entitlements reach the person, not just the key** - an internal user's `object_permission` now acts as an MCP entitlement level that intersects the key, team, agent, and org scopes, is read at both `tools/list` and `tools/call` time, is persisted by `/user/new` and `/user/update`, returned by `/v2/user/info`, and editable from the internal user page.
- **Guardrails can finally see MCP tool results** - a new `post_mcp_call` mode routes tool result text through the unified `apply_guardrail` seam, so a guardrail can mask values inside a result or reject it outright; previously a tool returning sensitive data bypassed every guardrail.
- **Config changes propagate to every pod immediately** - management writes publish an invalidation event on coordination Redis and every pod resyncs on receipt, debounced with jitter and capped at one resync per 10s, replacing the 30s poll lag on models, credentials, and settings. Without Redis both sides no-op and polling behavior is unchanged.
- **OpenAI cuts GPT-5.6 prices** - `gpt-5.6-terra` drops 20% and `gpt-5.6-luna` drops 80%, mirrored onto Bedrock Mantle, plus new flex long-context (above 272K) rates across the `gpt-5.6` family and a correction to the advertised `gpt-5.4-mini` and `gpt-5.4-nano` context windows.
- **The auto-router learns what it is actually routing** - the complexity classifier now sees prior turns and assistant turns, rates what a short reply approves, closes its rubric on the window it was given, and records its tier decision, request body, and its own classifier calls in spend logs and the log drawer.
- **Budgets become a first-class management surface** - a generic `/management/v1` list contract lands with `GET /management/v1/budgets` on top of it, and the budgets page gains sorting, filtering, and search.
- **Operational hardening for large deployments** - opt-in `database_statement_timeout` and `database_lock_timeout`, opt-in `REPLICA IDENTITY FULL` re-asserted after every migration, pod-hardening and migration-Job knobs on the componentized Helm chart, and an unreachable Redis that no longer blocks every request.

### Breaking changes

- **Mock testing params are gated behind one config flag** - six mock testing request params previously had three different behaviors, and a dropped param returned a normal success, so a fallback drill could pass without ever running. All six are now gated by a single config flag that is unset by default and rejects with a 400 naming the params and the key - [PR #35423](https://github.com/BerriAI/litellm/pull/35423)
- **User budgets are no longer enforced on team keys** - reverts [PR #32005](https://github.com/BerriAI/litellm/pull/32005), which caused team keys to reject on the key owner's personal budget; team keys use team budgets only and the `skip_user_budget_on_team_key` opt-out flag is removed - [PR #35271](https://github.com/BerriAI/litellm/pull/35271)
- **Keyless gateway OAuth admits session bearers at any MCP scope** - session-bearer admission and RFC 9728 `WWW-Authenticate` challenges now fire on per-server MCP URL paths, not only the aggregate `/mcp/` scope - [PR #34856](https://github.com/BerriAI/litellm/pull/34856)

## New Models / Updated Models

#### New Model Support (2 new models)

| Provider | Model | Context Window | Input ($/1M tokens) | Output ($/1M tokens) | Features |
| --- | --- | --- | --- | --- | --- |
| DashScope | `dashscope/qwen3.7-max` | 991.8K | $2.50 | $7.50 | Reasoning, function calling, tool choice, prompt caching, response schema |
| DashScope | `dashscope/qwen3.7-plus` | 991.8K | $0.40 (tiered) | $1.60 (tiered) | Reasoning, vision, function calling, tool choice, prompt caching, response schema |

`dashscope/qwen3.7-plus` is priced in two tiers: $0.40 / $1.60 per 1M up to 256K tokens, and $1.20 / $4.80 per 1M above 256K.

Beyond the new entries, this release applies OpenAI's price cut to the GPT-5.6 family: `gpt-5.6-terra` falls from $2.50 / $15.00 to $2.00 / $12.00 per 1M and `gpt-5.6-luna` from $1.00 / $6.00 to $0.20 / $1.20 per 1M, with the same reductions mirrored on `bedrock_mantle/openai.gpt-5.6-terra` and `bedrock_mantle/openai.gpt-5.6-luna` and applied consistently to the batch, flex, priority, and cache variants. Flex long-context rates above 272K tokens are added to `gpt-5.6`, `gpt-5.6-sol`, `gpt-5.6-terra`, and `gpt-5.6-luna`. The advertised context window on `gpt-5.4-mini` and `gpt-5.4-nano` is corrected from 1.05M to 272K on OpenAI, Azure, and Azure AI Foundry, and the Azure AI above-272K tiers are removed with it. Fireworks AI Kimi K2.5, K2.6, and K2.7 max output tokens drop from 262,144 to 32,768. No pricing entries were removed.

#### Features

- **[DashScope](../../docs/providers/dashscope)**
    - Add `qwen3.7-plus` and `qwen3.7-max` to the model cost map - [PR #35123](https://github.com/BerriAI/litellm/pull/35123)

### Bug Fixes

- **[OpenAI](../../docs/providers/openai)**
    - Correct GPT-5.6 prices for OpenAI, Bedrock, and flex long context - [PR #35270](https://github.com/BerriAI/litellm/pull/35270)
    - Adjust `gpt-5.6-terra` and `gpt-5.6-luna` prices per OpenAI's published rates - [PR #35258](https://github.com/BerriAI/litellm/pull/35258)
    - Correct `gpt-5.4-mini` and `gpt-5.4-nano` token limits - [PR #35182](https://github.com/BerriAI/litellm/pull/35182)
- **[Google Vertex AI](../../docs/providers/vertex)**
    - Forward `function_call` id on Vertex Gemini 3+ tool turns - [PR #34603](https://github.com/BerriAI/litellm/pull/34603)
    - Stop sending duplicate `thoughtSignature` copies to Gemini - [PR #35004](https://github.com/BerriAI/litellm/pull/35004)
    - Skip context caching when the cached block ends on a model turn - [PR #35172](https://github.com/BerriAI/litellm/pull/35172)
- **[Anthropic](../../docs/providers/anthropic)**
    - Split mixed stream chunks by payload kind - [PR #35289](https://github.com/BerriAI/litellm/pull/35289)
- **[Amazon Bedrock](../../docs/providers/bedrock)**
    - Cache `AssumeRole` credentials per attributed identity - [PR #35467](https://github.com/BerriAI/litellm/pull/35467)
- **[Fireworks AI](../../docs/providers/fireworks_ai)**
    - Correct Kimi K2.5, K2.6, and K2.7 max output token limits - [PR #35174](https://github.com/BerriAI/litellm/pull/35174)

## LLM API Endpoints

#### Features

- **General**
    - Request stream usage upstream by default and strip it from client streams - [PR #35290](https://github.com/BerriAI/litellm/pull/35290)

#### Bugs

- **[Anthropic `/v1/messages`](../../docs/anthropic_unified)**
    - Open the first content block with the real upstream type so reasoning-first streams start with thinking - [PR #34433](https://github.com/BerriAI/litellm/pull/34433)
    - Translate `stop_sequences` and disabled thinking for non-Claude targets - [PR #34589](https://github.com/BerriAI/litellm/pull/34589)
- **[Responses API](../../docs/response_api)**
    - Map all documented in-stream error codes to real HTTP statuses - [PR #35307](https://github.com/BerriAI/litellm/pull/35307)
- **[Batches](../../docs/batches)**
    - Encode the public model group on background-created output file ids - [PR #35406](https://github.com/BerriAI/litellm/pull/35406)
- **Managed files**
    - Source the Vertex AI managed-file read bucket and credentials from per-model `litellm_params` - [PR #34847](https://github.com/BerriAI/litellm/pull/34847)
- **[Passthrough](../../docs/pass_through/vertex_ai)**
    - Decide Vertex `rawPredict` passthrough streaming from the request body - [PR #34672](https://github.com/BerriAI/litellm/pull/34672)
- **A2A**
    - Keep config-defined agents registered and accept the documented `agents:` key - [PR #35163](https://github.com/BerriAI/litellm/pull/35163)

## Management Endpoints / UI

#### Features

- **Management API**
    - Generic list contract for `/management/v1` entity lists - [PR #35308](https://github.com/BerriAI/litellm/pull/35308)
    - `GET /management/v1/budgets` - [PR #35310](https://github.com/BerriAI/litellm/pull/35310)
    - Let AI API keys read `/model/info` - [PR #35473](https://github.com/BerriAI/litellm/pull/35473)
- **Virtual Keys & CLI**
    - Identify a key by `key_alias` on `/key/update` - [PR #34851](https://github.com/BerriAI/litellm/pull/34851)
    - Read `base_url` from a persistent CLI config file - [PR #35015](https://github.com/BerriAI/litellm/pull/35015)
- **Models + Endpoints**
    - Give auto-routers their own tab - [PR #35009](https://github.com/BerriAI/litellm/pull/35009)
    - Expose classifier context window fields on the Auto-Router screens - [PR #35315](https://github.com/BerriAI/litellm/pull/35315)
    - Expose the assistant-turn classifier context switch on the Auto-Router screens - [PR #35500](https://github.com/BerriAI/litellm/pull/35500)
- **Dashboard**
    - Sorting, filtering, and search on the budgets page - [PR #35309](https://github.com/BerriAI/litellm/pull/35309)
    - Deep-link the team and organization detail pages via `?team=` and `?org=` query params, and link organization teams to their team detail pages - [PR #35112](https://github.com/BerriAI/litellm/pull/35112), [PR #35117](https://github.com/BerriAI/litellm/pull/35117), [PR #35120](https://github.com/BerriAI/litellm/pull/35120)
    - Shareable log links via a `log_id` query param on the logs page - [PR #34879](https://github.com/BerriAI/litellm/pull/34879)
    - Split failed requests into their own series on the cache dashboard - [PR #34862](https://github.com/BerriAI/litellm/pull/34862)
    - Show which log rows are the auto-router's own classifier calls - [PR #35304](https://github.com/BerriAI/litellm/pull/35304)

#### Bugs

- **Teams & Users**
    - Stop serving a stale team model allowlist after `/team/update` - [PR #34266](https://github.com/BerriAI/litellm/pull/34266)
    - Align team member add with existing user provisioning rules - [PR #35435](https://github.com/BerriAI/litellm/pull/35435)
    - Skip team model aliases that point at deleted deployments - [PR #34993](https://github.com/BerriAI/litellm/pull/34993)
    - Show pass-through route selections and match team id substrings in team search - [PR #35319](https://github.com/BerriAI/litellm/pull/35319)
    - Report API-registered callbacks from `GET /team/{team_id}/callback` - [PR #35512](https://github.com/BerriAI/litellm/pull/35512)
- **Auth & SSO**
    - Grant only `/v1/messages` routes to JWT teams by default rather than all Anthropic routes - [PR #34222](https://github.com/BerriAI/litellm/pull/34222)
    - Resolve a managed batch or file deployment `model_id` to a model name for team access checks - [PR #32587](https://github.com/BerriAI/litellm/pull/32587)
- **SCIM**
    - Stop provisioning nested group ids as internal users - [PR #34997](https://github.com/BerriAI/litellm/pull/34997)
- **Model writes**
    - Reject model writes that corrupt an auto-router pseudo-model - [PR #34151](https://github.com/BerriAI/litellm/pull/34151)
    - Report when a model write does not survive the post-write reload - [PR #34861](https://github.com/BerriAI/litellm/pull/34861)
    - Stop model writes 500ing on another pod's delete - [PR #35400](https://github.com/BerriAI/litellm/pull/35400)
- **Config & credentials**
    - Resolve named credentials on provider-only batch and files calls - [PR #35028](https://github.com/BerriAI/litellm/pull/35028)
    - Drop an unsupported prisma `select` kwarg from the tag-management key lookup and the tool-management team lookup - [PR #35288](https://github.com/BerriAI/litellm/pull/35288), [PR #35293](https://github.com/BerriAI/litellm/pull/35293)
- **Policy engine**
    - Preserve config-defined policies across DB sync and expose them via the list APIs - [PR #35263](https://github.com/BerriAI/litellm/pull/35263)
- **Dashboard**
    - Let the internal user and organization forms save sub-cent budgets - [PR #35302](https://github.com/BerriAI/litellm/pull/35302)
    - Stop clamping the budgets Budget ID column at 15 characters - [PR #35268](https://github.com/BerriAI/litellm/pull/35268)
    - Keep the session view open when selecting a log inside it - [PR #35399](https://github.com/BerriAI/litellm/pull/35399)
    - Show public model names in usage breakdowns - [PR #35107](https://github.com/BerriAI/litellm/pull/35107)
    - Land general login on the keys dashboard and send MCP consent to `/ui/connect` - [PR #35523](https://github.com/BerriAI/litellm/pull/35523)
    - Point the navbar and sidebar logos at the dashboard home route - [PR #35041](https://github.com/BerriAI/litellm/pull/35041)
    - Size the Object Permissions card grid by container width - [PR #35019](https://github.com/BerriAI/litellm/pull/35019)
    - Nest the `source` object in the Claude Code marketplace settings snippet - [PR #35322](https://github.com/BerriAI/litellm/pull/35322)

## AI Integrations

### Logging

- **[OpenTelemetry](../../docs/observability/opentelemetry_integration)**
    - Make OTLP export work against Grafana Cloud - [PR #35060](https://github.com/BerriAI/litellm/pull/35060)
    - Cap tool-definition attributes so they cannot evict `gen_ai.*` from the LLM span - [PR #34828](https://github.com/BerriAI/litellm/pull/34828)
    - Label retrieval and agent metrics correctly and emit `gen_ai.provider.name` - [PR #35151](https://github.com/BerriAI/litellm/pull/35151)
    - Record the GenAI duration metric on failed requests - [PR #35152](https://github.com/BerriAI/litellm/pull/35152)
    - Add a Grafana dashboard for the OTel GenAI metrics to the cookbook - [PR #35159](https://github.com/BerriAI/litellm/pull/35159)
- **[Prometheus](../../docs/proxy/prometheus)**
    - Global `exclude_metrics` and `exclude_labels` options - [PR #34201](https://github.com/BerriAI/litellm/pull/34201)
    - Add a `service_tier` label to the latency and spend metrics - [PR #34966](https://github.com/BerriAI/litellm/pull/34966)
- **[s3](../../docs/proxy/logging#s3-buckets)**
    - Support SSE-KMS encryption params on both S3 logging paths - [PR #35291](https://github.com/BerriAI/litellm/pull/35291)
- **General**
    - Bind `litellm_metadata` by reference in `function_setup` so guardrail information reaches spend logs - [PR #35292](https://github.com/BerriAI/litellm/pull/35292)

### Guardrails

- **[General](../../docs/proxy/guardrails/quick_start)**
    - Scan and mask MCP tool results via a new `post_mcp_call` mode - [PR #35155](https://github.com/BerriAI/litellm/pull/35155)
    - Serve config-defined guardrails from the list and info endpoints without a DB, with stable ids - [PR #35259](https://github.com/BerriAI/litellm/pull/35259)
    - Run `post_call` guardrails on `/v1/messages` streaming via unified guardrail translation - [PR #35260](https://github.com/BerriAI/litellm/pull/35260)
- **[Bedrock Guardrails](../../docs/proxy/guardrails/bedrock)**
    - Run the Bedrock guardrail on MCP tool calls in `during_mcp_call` mode - [PR #35149](https://github.com/BerriAI/litellm/pull/35149)
- **Compresr / Headroom**
    - Stop compressing the turn the model must act on - [PR #35294](https://github.com/BerriAI/litellm/pull/35294)

## Spend Tracking, Budgets and Rate Limiting

- **Budgets**
    - Stop enforcing user budgets on team keys, reverting the earlier hierarchy change - [PR #35271](https://github.com/BerriAI/litellm/pull/35271)
    - Only enforce budgets on routes that can spend - [PR #35274](https://github.com/BerriAI/litellm/pull/35274)
- **Rate limiting**
    - Enforce token limits when the pre-call increment is zero - [PR #35422](https://github.com/BerriAI/litellm/pull/35422)
    - Move the v3 limiter per-request stash off request metadata onto a `ContextVar` - [PR #35278](https://github.com/BerriAI/litellm/pull/35278)
    - Keep the v3 limiter out of provider-facing metadata on Responses routes - [PR #35207](https://github.com/BerriAI/litellm/pull/35207)
- **[Cost tracking](../../docs/proxy/cost_tracking)**
    - Bill the fast service tier at the priority rate - [PR #35320](https://github.com/BerriAI/litellm/pull/35320)
    - Calculate cost and usage for completed Vertex AI batches, and aggregate batch output cost, usage, and models in a single pass - [PR #35186](https://github.com/BerriAI/litellm/pull/35186), [PR #35205](https://github.com/BerriAI/litellm/pull/35205)
    - Stamp the provider on embedding cache-hit spend logs - [PR #35282](https://github.com/BerriAI/litellm/pull/35282)

## MCP Gateway

- **Entitlements**
    - Enforce per-user MCP tool-call entitlements in the auth module - [PR #35146](https://github.com/BerriAI/litellm/pull/35146)
    - Enforce tool entitlements on every MCP tool dispatch path - [PR #35156](https://github.com/BerriAI/litellm/pull/35156)
    - Deny MCP access when a named entitlement cannot be read - [PR #35160](https://github.com/BerriAI/litellm/pull/35160)
    - Recover the tool-name prefix boundary from registered prefixes - [PR #34673](https://github.com/BerriAI/litellm/pull/34673)
- **OAuth**
    - Extend the keyless gateway OAuth flow to per-server MCP URL paths - [PR #34856](https://github.com/BerriAI/litellm/pull/34856)
    - Source the ID-JAG subject from the user's stored SSO assertion - [PR #35147](https://github.com/BerriAI/litellm/pull/35147)
    - Manual authorization-code delivery for headless MCP clients - [PR #34848](https://github.com/BerriAI/litellm/pull/34848)
- **Servers & discovery**
    - Never write discovery results to the row, heal rows a release already stamped, and retry failed discovery with backoff - [PR #34990](https://github.com/BerriAI/litellm/pull/34990)
    - Annotate connected-app reachability on the gateway connect page - [PR #34867](https://github.com/BerriAI/litellm/pull/34867)

## Performance / Loadbalancing / Reliability improvements

- **Config propagation**
    - Push config sync to pods via Redis pub/sub instead of waiting on the 30s poll - [PR #35436](https://github.com/BerriAI/litellm/pull/35436)
- **Database**
    - Bound DB statement and lock time via `general_settings` - [PR #35496](https://github.com/BerriAI/litellm/pull/35496)
    - Opt-in `REPLICA IDENTITY FULL` re-asserted after prisma migrations - [PR #35267](https://github.com/BerriAI/litellm/pull/35267)
    - Bound each spend-log write statement by payload bytes - [PR #34956](https://github.com/BerriAI/litellm/pull/34956)
- **Router & auto-router**
    - Give the ComplexityRouter LLM classifier prior-turn context - [PR #35185](https://github.com/BerriAI/litellm/pull/35185)
    - Let the classifier see assistant turns and rate what a short reply approves - [PR #35471](https://github.com/BerriAI/litellm/pull/35471)
    - Drop the tier-rubric override and close the rubric on the window it was given - [PR #35504](https://github.com/BerriAI/litellm/pull/35504)
    - Record why the auto-router picked a tier, capture the classifier request body, and mark the auto-router's own classifier calls in spend logs - [PR #35016](https://github.com/BerriAI/litellm/pull/35016), [PR #35164](https://github.com/BerriAI/litellm/pull/35164), [PR #35300](https://github.com/BerriAI/litellm/pull/35300)
    - Honor request-level `num_retries` over a deployment's `litellm_params` value - [PR #35483](https://github.com/BerriAI/litellm/pull/35483)
    - Serialize latency for non-chat responses in lowest-latency routing - [PR #33290](https://github.com/BerriAI/litellm/pull/33290)
- **Connections & caching**
    - Stop an unreachable Redis from blocking every request - [PR #35273](https://github.com/BerriAI/litellm/pull/35273)
    - Dispose recycled aiohttp client sessions deterministically, and keep the keep-alive connector config when a session is rebuilt - [PR #33428](https://github.com/BerriAI/litellm/pull/33428), [PR #34962](https://github.com/BerriAI/litellm/pull/34962)
- **Rust core**
    - Make `litellm-core` the callable `messages()` SDK and drop the ai-gateway handler - [PR #35044](https://github.com/BerriAI/litellm/pull/35044)
- **Deployment & Helm**
    - Pod-hardening and migration-Job knobs on the componentized chart - [PR #35489](https://github.com/BerriAI/litellm/pull/35489)
    - Render pod-level `securityContext` on the migration Job - [PR #35482](https://github.com/BerriAI/litellm/pull/35482)
    - Give the gateway and backend probes an explicit `timeoutSeconds` - [PR #35497](https://github.com/BerriAI/litellm/pull/35497)
    - Honor `USE_DDTRACE` in the componentized gateway and backend deployments - [PR #35490](https://github.com/BerriAI/litellm/pull/35490)
    - Bake prisma offline in the componentized migrations image - [PR #35485](https://github.com/BerriAI/litellm/pull/35485)
    - Pin the bundled postgres and redis to the bitnamilegacy images - [PR #34963](https://github.com/BerriAI/litellm/pull/34963)
- **Dependencies & maintenance**
    - Raise the aiohttp floor to 3.14.2 to clear pooled-connection timeouts - [PR #35337](https://github.com/BerriAI/litellm/pull/35337)
    - Move `pydantic-settings` into the base dependencies - [PR #35518](https://github.com/BerriAI/litellm/pull/35518)
    - Remove the dead `BedrockLLM` invoke code path - [PR #35188](https://github.com/BerriAI/litellm/pull/35188)

## Documentation Updates

- Require e2e proof on all three LLM endpoints when applicable in the PR template - [PR #35280](https://github.com/BerriAI/litellm/pull/35280)
- Require 15-25 word human-readable replies to AI PR review bots - [PR #35266](https://github.com/BerriAI/litellm/pull/35266)

### PR roll-up by ownership area

PRs by ownership area (total: 151)

- Other (CI / chore / tests / build / version bumps): 35
- Performance: 24
- Auth & Management: 20
- UI: 19
- Models & Providers: 11
- Logging: 9
- MCP: 9
- Spend / Budgets / Rate Limits: 9
- LLM API Endpoints: 8
- Guardrails: 5
- Docs: 2

## End-to-End Testing

We are investing heavily in end-to-end testing to cut regressions and make LiteLLM more stable release over release. Every version is exercised by a live suite that runs against a real deployed proxy and hits real provider endpoints, not mocks, so the behavior we validate is the behavior you get in production.

This window added 18 test-only PRs, 10 of them against the live e2e suite. New and repaired coverage lands on MCP tool polling across multi-worker lag, budget-reset timing polled to a deadline rather than a fixed sleep, the team-key budget hierarchy after the revert, and a throughput SLO derived per replica with locust's error breakdown surfaced. The coverage registry now excludes skipped tests from its numerator, so the reported number reflects what actually ran, and several suites are parked behind named Linear tickets (LIT-5027, LIT-5052, LIT-5054, LIT-5118, LIT-5119) rather than left flaking.

## New Contributors

- @ljogeiger made their first contribution in [PR #34603](https://github.com/BerriAI/litellm/pull/34603)
- @lihugang made their first contribution in [PR #35258](https://github.com/BerriAI/litellm/pull/35258)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.95.0-rc.1...v1.96.0-rc.1
