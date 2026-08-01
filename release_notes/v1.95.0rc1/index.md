---
title: "v1.95.0rc1 - Claude Opus 5, MCP Gateway DCR & Rust /v1/messages"
slug: "v1-95-0-rc-1"
date: 2026-07-30T00:12:53
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
docker.litellm.ai/berriai/litellm:1.95.0-rc.1
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.95.0rc1
```

</TabItem>
</Tabs>

:::danger Breaking Changes

**Auto-routing sends prompts that match no scoring dimension to `default_tier` (MEDIUM) instead of SIMPLE.** The heuristic scorer had no way to say "I don't know"; a prompt matching none of its keyword lists scored 0.0, and 0.0 fell under the `simple_medium` boundary into SIMPLE, so absence of evidence was read as evidence of simplicity. This applies to every deployment on the heuristic scorer with no config change on your side, and it also covers LLM-classifier timeouts and errors, which fall back to that scorer. On a 257-session agent corpus the tier mix moved from 84/13/3/0 to 47/49/3/0 (SIMPLE/MEDIUM/COMPLEX/REASONING) and the blended per-turn price proxy rose about 53%. Set `default_tier: SIMPLE` on `complexity_router_config` to keep the previous behavior. One config shape is now rejected at startup rather than at request time: auto-routers with `plugins` configured whose `tiers` gives MEDIUM no models, since routing plugins do not consult `default_model` and the tier has nothing else to fall back to. Give MEDIUM models in `tiers`, or point `default_tier` at a tier that has them. See [PR #35050](https://github.com/BerriAI/litellm/pull/35050).

:::

## Key Highlights

- **Claude Opus 5 on day zero, everywhere** - the new 1M-context Opus lands simultaneously on Anthropic, Amazon Bedrock (including the `us`, `eu`, `au`, `jp`, and `global` inference profiles), Google Vertex AI, and Azure AI Foundry, with adaptive thinking, xhigh reasoning effort, computer use, PDF input, and prompt caching all recorded in the cost map.
- **Gemini 3.6 Flash and Gemini 3.5 Flash Lite** - day-0 pricing on both Google AI Studio and Vertex AI, at $1.50/$7.50 and $0.30/$2.50 per 1M tokens respectively.
- **MCP gateway grows a real front door** - an always-on aggregate DCR discovery endpoint, identity-only session tokens, RFC 8707 resource indicators on upstream OAuth legs, MCP server support on the Anthropic `/v1/messages` API, and a standalone `/connect` route that no longer depends on the Chat UI flag.
- **The Rust gateway takes over `/v1/messages`** - native Anthropic Messages now routes through the axum gateway behind `LITELLM_RUST`, joined by a 1:1 port of the Responses API WebSockets surface, BaseAWSLLM credential resolution and SigV4 in `litellm-core`, and Bedrock audio transcription over the Python-to-Rust bridge.
- **SAML 2.0 SSO for the admin UI** - a second enterprise SSO path alongside the existing OIDC flow.
- **The dashboard finishes its shadcn and DataTable migration** - roughly twenty routes move onto shadcn and the shared composable DataTable, plus new react-hook-form and zod form infrastructure behind Organization Settings and Create Organization.
- **Budget resets get correct** - a configurable `budget_reset_time` of day, word-form `budget_duration` values that no longer silently collapse to daily, and repair for users and teams whose `budget_reset_at` was left NULL.
- **Provider-level abuse controls per end user** - with `overwrite_user_with_key_hash`, LiteLLM resolves the identity behind an incoming request, stamps the resolved virtual key hash into the outgoing `user` param, and forwards that to the provider. Providers can then ban or rate-limit at the level of an individual user rather than your entire organization. See [PR #34417](https://github.com/BerriAI/litellm/pull/34417).

## New Models / Updated Models

#### New Model Support (16 new pricing entries)

| Provider | Model | Context Window | Input ($/1M tokens) | Output ($/1M tokens) | Features |
| --- | --- | --- | --- | --- | --- |
| Anthropic | `claude-opus-5` | 1M | $5.00 | $25.00 | Reasoning (adaptive + xhigh), vision, computer use, function calling, PDF input, prompt caching, native structured output |
| Amazon Bedrock | `anthropic.claude-opus-5` | 1M | $5.00 | $25.00 | Reasoning (adaptive + xhigh), vision, computer use, function calling, PDF input, prompt caching, parallel tool use config |
| Amazon Bedrock | `global.anthropic.claude-opus-5` | 1M | $5.00 | $25.00 | Same as above |
| Amazon Bedrock | `us.anthropic.claude-opus-5` | 1M | $5.50 | $27.50 | Same as above |
| Amazon Bedrock | `eu.anthropic.claude-opus-5` | 1M | $5.50 | $27.50 | Same as above |
| Amazon Bedrock | `au.anthropic.claude-opus-5` | 1M | $5.50 | $27.50 | Same as above |
| Amazon Bedrock | `jp.anthropic.claude-opus-5` | 1M | $5.50 | $27.50 | Same as above |
| Google Vertex AI | `vertex_ai/claude-opus-5` | 1M | $5.00 | $25.00 | Reasoning (adaptive + xhigh), vision, computer use, function calling, PDF input, prompt caching |
| Google Vertex AI | `vertex_ai/claude-opus-5@default` | 1M | $5.00 | $25.00 | Same as above |
| Azure AI Foundry | `azure_ai/claude-opus-5` | 1M | $5.00 | $25.00 | Reasoning (adaptive + xhigh), vision, computer use, function calling, PDF input, prompt caching |
| Google AI Studio | `gemini/gemini-3.6-flash` | 1.05M | $1.50 | $7.50 | Reasoning, vision, audio input, video input, PDF input, web search, URL context, prompt caching |
| Google AI Studio | `gemini/gemini-3.5-flash-lite` | 1.05M | $0.30 | $2.50 | Reasoning, vision, audio input, video input, PDF input, web search, URL context, prompt caching |
| Google Vertex AI | `gemini-3.6-flash` | 1.05M | $1.50 | $7.50 | Same as above |
| Google Vertex AI | `vertex_ai/gemini-3.6-flash` | 1.05M | $1.50 | $7.50 | Same as above |
| Google Vertex AI | `gemini-3.5-flash-lite` | 1.05M | $0.30 | $2.50 | Same as above |
| Google Vertex AI | `vertex_ai/gemini-3.5-flash-lite` | 1.05M | $0.30 | $2.50 | Same as above |

Beyond the new entries, this release raises the advertised context window on `azure_ai/claude-opus-4-6`, `claude-opus-4-7`, and `claude-opus-4-8` from 200K to 1M, marks the DeepSeek V4 `flash` and `pro` families as reasoning models, and records `supports_mid_conversation_system` across the Claude Fable 5, Sonnet 5, and Opus 4.8 entries on Vertex AI and Azure AI. No pricing entries were removed.

#### Features

- **[Anthropic](../../docs/providers/anthropic)**
    - Add Claude Opus 5 - [PR #34518](https://github.com/BerriAI/litellm/pull/34518)
- **[Google AI Studio / Vertex AI](../../docs/providers/vertex)**
    - Day-0 pricing for `gemini-3.6-flash` and `gemini-3.5-flash-lite` - [PR #34106](https://github.com/BerriAI/litellm/pull/34106)

### Bug Fixes

- **[Anthropic](../../docs/providers/anthropic)**
    - Only inject `cache_control` when the request does not already carry one - [PR #33886](https://github.com/BerriAI/litellm/pull/33886)
    - Strip `uniqueItems` and other unsupported array and object constraints from the `output_format` schema - [PR #34313](https://github.com/BerriAI/litellm/pull/34313)
    - Strip the remaining `output_format` schema keywords Anthropic rejects - [PR #34319](https://github.com/BerriAI/litellm/pull/34319)
- **[Amazon Bedrock](../../docs/providers/bedrock)**
    - Hoist Codex `additional_tools` input items to top-level `tools` on Bedrock Mantle - [PR #33228](https://github.com/BerriAI/litellm/pull/33228)
- **[Google Vertex AI](../../docs/providers/vertex)**
    - Incrementally parse accumulated Gemini stream JSON so a multi-value payload no longer wedges the stream - [PR #34320](https://github.com/BerriAI/litellm/pull/34320)
    - Handle an explicit `outputInfo: null` in the Vertex AI batch response - [PR #34473](https://github.com/BerriAI/litellm/pull/34473)
- **[Azure AI Foundry](../../docs/providers/azure_ai)**
    - Advertise the 1M context window for Claude Opus 4.6 and newer on Foundry - [PR #34556](https://github.com/BerriAI/litellm/pull/34556)
- **[Fireworks AI](../../docs/providers/fireworks_ai)**
    - Restore the `application/json` Content-Type header, fixing a 415 response - [PR #33929](https://github.com/BerriAI/litellm/pull/33929)

## LLM API Endpoints

#### Features

- **[Responses API](../../docs/response_api)**
    - 1:1 port of the OpenAI Responses API WebSockets surface to `litellm-rust` - [PR #33849](https://github.com/BerriAI/litellm/pull/33849)
- **[Anthropic `/v1/messages`](../../docs/anthropic_unified)**
    - Route native Anthropic `/messages` through Rust behind the `LITELLM_RUST` env var - [PR #33848](https://github.com/BerriAI/litellm/pull/33848)
    - Expose the Anthropic Messages route on the axum gateway - [PR #33880](https://github.com/BerriAI/litellm/pull/33880)
- **[Batches](../../docs/batches)**
    - Forward `bedrock_tags` to `CreateModelInvocationJob` for batch jobs - [PR #33733](https://github.com/BerriAI/litellm/pull/33733)
- **General**
    - Auto-enable `drop_params` for Codex user agents - [PR #34068](https://github.com/BerriAI/litellm/pull/34068)

#### Bugs

- **[Responses API](../../docs/response_api)**
    - Preserve reasoning content through prompt hooks - [PR #33422](https://github.com/BerriAI/litellm/pull/33422)
    - Keep one chat completion id per stream and always stream completed responses - [PR #34539](https://github.com/BerriAI/litellm/pull/34539)
    - Strip `include_usage` from `stream_options` instead of dropping the whole param - [PR #34549](https://github.com/BerriAI/litellm/pull/34549)
- **[Anthropic `/v1/messages`](../../docs/anthropic_unified)**
    - Model-aware mid-conversation system handling for Claude on Vertex AI and Azure - [PR #33807](https://github.com/BerriAI/litellm/pull/33807)
    - Route agentic-hook `/messages` requests back to Python for all stream modes - [PR #34126](https://github.com/BerriAI/litellm/pull/34126)
    - Backfill usage on non-streaming Bedrock Mantle `/v1/messages` responses - [PR #34446](https://github.com/BerriAI/litellm/pull/34446)
- **[Batches](../../docs/batches)**
    - Paginate the managed batch list by `unified_object_id` cursor - [PR #34192](https://github.com/BerriAI/litellm/pull/34192)
    - Resolve a managed unified `input_file_id` to a storage URL with an ownership check before dispatch - [PR #34474](https://github.com/BerriAI/litellm/pull/34474)
    - Make managed-file resolution additive, restoring the fall-back for missing-row and lookup errors - [PR #34584](https://github.com/BerriAI/litellm/pull/34584)
- **Realtime**
    - Emit the Nova Sonic `session.created` event on connect and `session.updated` on `session.update` - [PR #34133](https://github.com/BerriAI/litellm/pull/34133)
    - Install the `bedrock-realtime` extra for Nova Sonic realtime - [PR #34426](https://github.com/BerriAI/litellm/pull/34426)
- **A2A**
    - Accept semver `protocolVersion` values such as `0.3.0` in agent cards - [PR #34154](https://github.com/BerriAI/litellm/pull/34154)
    - Allow optional `securityScheme` fields so `/public/agent_hub` no longer 500s - [PR #33897](https://github.com/BerriAI/litellm/pull/33897)
    - Route `/a2a` through the gateway component - [PR #34958](https://github.com/BerriAI/litellm/pull/34958)
- **General**
    - Return 400 instead of 500 for chat completions sent without messages - [PR #34547](https://github.com/BerriAI/litellm/pull/34547)
    - Add `queued` to the Interaction status enum - [PR #34135](https://github.com/BerriAI/litellm/pull/34135)

## Management Endpoints / UI

#### Features

- **Auth & SSO**
    - SAML 2.0 SSO for the admin UI - [PR #31429](https://github.com/BerriAI/litellm/pull/31429)
    - Stamp the outgoing `user` param with the key hash via `overwrite_user_with_key_hash` - [PR #34417](https://github.com/BerriAI/litellm/pull/34417)
- **Organizations**
    - RESTful `PATCH /v2/organization/{organization_id}` - [PR #32350](https://github.com/BerriAI/litellm/pull/32350)
    - Rebuild Organization Settings on react-hook-form and zod with a dirty-field PATCH - [PR #34324](https://github.com/BerriAI/litellm/pull/34324)
    - Migrate the Create Organization form to shadcn and react-hook-form - [PR #34552](https://github.com/BerriAI/litellm/pull/34552)
- **Virtual Keys**
    - Block and unblock a key directly from the key info page - [PR #34116](https://github.com/BerriAI/litellm/pull/34116)
    - Deep-link the virtual key detail view via a `?key=` query param - [PR #34591](https://github.com/BerriAI/litellm/pull/34591)
    - Surface a key's `budget_reset_at` in key info and the keys table - [PR #34113](https://github.com/BerriAI/litellm/pull/34113)
- **Models + Endpoints**
    - Give each Models + Endpoints tab its own path - [PR #34327](https://github.com/BerriAI/litellm/pull/34327)
    - Extract shared tab-routing helpers and adopt them in Models + Endpoints - [PR #34435](https://github.com/BerriAI/litellm/pull/34435)
    - Make the DB config-reload interval configurable from `config.yaml` and the Admin UI - [PR #34130](https://github.com/BerriAI/litellm/pull/34130)
- **Shared DataTable migration**
    - Credentials, available teams, memory, audit logs, organizations, and agents tables - [PR #34053](https://github.com/BerriAI/litellm/pull/34053), [PR #34070](https://github.com/BerriAI/litellm/pull/34070), [PR #34079](https://github.com/BerriAI/litellm/pull/34079), [PR #34080](https://github.com/BerriAI/litellm/pull/34080), [PR #34081](https://github.com/BerriAI/litellm/pull/34081), [PR #34089](https://github.com/BerriAI/litellm/pull/34089)
    - Tool Policies, users and model health checks, request logs, models and endpoints, and routing groups tables - [PR #34176](https://github.com/BerriAI/litellm/pull/34176), [PR #34182](https://github.com/BerriAI/litellm/pull/34182), [PR #34343](https://github.com/BerriAI/litellm/pull/34343), [PR #34363](https://github.com/BerriAI/litellm/pull/34363), [PR #34571](https://github.com/BerriAI/litellm/pull/34571)
    - Controlled row selection on the shared DataTable - [PR #34167](https://github.com/BerriAI/litellm/pull/34167)
- **shadcn migration**
    - api-reference, prompts list, transform-request, old-usage, search-tools, agents, memory, and workflow runs - [PR #34263](https://github.com/BerriAI/litellm/pull/34263), [PR #34289](https://github.com/BerriAI/litellm/pull/34289), [PR #34303](https://github.com/BerriAI/litellm/pull/34303), [PR #34304](https://github.com/BerriAI/litellm/pull/34304), [PR #34323](https://github.com/BerriAI/litellm/pull/34323), [PR #34365](https://github.com/BerriAI/litellm/pull/34365), [PR #34366](https://github.com/BerriAI/litellm/pull/34366), [PR #34370](https://github.com/BerriAI/litellm/pull/34370)
    - mcp-servers, tag-management, tool-policies, logging-and-alerts, caching, policies, budgets, skills, ui-theme, access-groups, and vector-stores - [PR #34469](https://github.com/BerriAI/litellm/pull/34469), [PR #34468](https://github.com/BerriAI/litellm/pull/34468), [PR #34465](https://github.com/BerriAI/litellm/pull/34465), [PR #34466](https://github.com/BerriAI/litellm/pull/34466)
    - react-hook-form and zod form infrastructure - [PR #34170](https://github.com/BerriAI/litellm/pull/34170)
    - Migrate inline provider logo lookups and MCP, callback, guardrail, SSO, and search-tool logos onto the shared Logo component - [PR #34141](https://github.com/BerriAI/litellm/pull/34141), [PR #34169](https://github.com/BerriAI/litellm/pull/34169)
- **Typed management API**
    - Type the `PATCH /team/{team_id}` request body - [PR #34195](https://github.com/BerriAI/litellm/pull/34195)
    - Derive the dashboard `object_permission` type from the generated schema - [PR #34454](https://github.com/BerriAI/litellm/pull/34454)

#### Bugs

- **SCIM**
    - Use `members_with_roles` as the source of truth for group membership - [PR #34162](https://github.com/BerriAI/litellm/pull/34162)
    - Prune a deleted user from teams' `members_with_roles` - [PR #34180](https://github.com/BerriAI/litellm/pull/34180)
    - Parse the membership id from the filtered PATCH path when `value` is omitted - [PR #34181](https://github.com/BerriAI/litellm/pull/34181)
    - Sync the team roster and dedup teams on existing-user email upsert - [PR #34183](https://github.com/BerriAI/litellm/pull/34183)
- **Teams & Users**
    - Make team member add atomic so a concurrent add cannot lose a member - [PR #34185](https://github.com/BerriAI/litellm/pull/34185)
    - Restore the atomic user upsert when adding team members - [PR #34457](https://github.com/BerriAI/litellm/pull/34457)
    - Route the JWT default-team into memberships instead of the create payload - [PR #33082](https://github.com/BerriAI/litellm/pull/33082)
    - Populate `user_email` on `UserAPIKeyAuth` for JWT auth - [PR #34174](https://github.com/BerriAI/litellm/pull/34174)
    - Validate default team values in Default User Settings - [PR #34815](https://github.com/BerriAI/litellm/pull/34815)
- **Config & credentials**
    - Prevent provider key exposure through URL-valued model destinations and fallbacks - [PR #34189](https://github.com/BerriAI/litellm/pull/34189)
    - Stop `save_config` from snapshotting `environment_variables` into the DB - [PR #34119](https://github.com/BerriAI/litellm/pull/34119)
    - Hash a caller-supplied key in the key update audit log `object_id` - [PR #34632](https://github.com/BerriAI/litellm/pull/34632)
    - Surface SSO and SMTP settings supplied as process env vars - [PR #33576](https://github.com/BerriAI/litellm/pull/33576)
    - Reflect `REDIS_*` env cache config and stop the UI overwriting the stored password - [PR #34160](https://github.com/BerriAI/litellm/pull/34160)
- **CLI**
    - Stable port and persisted master key for `lite autoroute up` - [PR #34026](https://github.com/BerriAI/litellm/pull/34026)
    - Discover models via `/v1/models` so an AI-API-only key works for autoroute - [PR #34259](https://github.com/BerriAI/litellm/pull/34259)
- **Dashboard**
    - Find logs by request id across pages and dates - [PR #31743](https://github.com/BerriAI/litellm/pull/31743)
    - Scope and bound the End User filter on the logs page - [PR #34579](https://github.com/BerriAI/litellm/pull/34579)
    - Bind the key duration input to a single `Form.Item` so a pre-filled expiry submits - [PR #34521](https://github.com/BerriAI/litellm/pull/34521)
    - Stop cloning body-carrying requests into stream uploads in the fetchClient middleware - [PR #34122](https://github.com/BerriAI/litellm/pull/34122)
    - Distinguish the response cache from provider prompt caching - [PR #34138](https://github.com/BerriAI/litellm/pull/34138)
    - Keep entity usage tabs aligned with their panels - [PR #34573](https://github.com/BerriAI/litellm/pull/34573)
    - Add a tooltip to the Active key status badge - [PR #34109](https://github.com/BerriAI/litellm/pull/34109)
    - Restore the Add MCP Server dialog size and header spacing, and match MCP Servers tabs to the dashboard line tab pattern - [PR #34679](https://github.com/BerriAI/litellm/pull/34679), [PR #34685](https://github.com/BerriAI/litellm/pull/34685)
    - Center vertical toolbar dividers and truncate long team names in the models table team dropdown - [PR #34684](https://github.com/BerriAI/litellm/pull/34684), [PR #34689](https://github.com/BerriAI/litellm/pull/34689)
    - Serve `/ui/assets` from the nginx image instead of the SPA fallback, and bundle provider logos as static imports - [PR #34066](https://github.com/BerriAI/litellm/pull/34066), [PR #34125](https://github.com/BerriAI/litellm/pull/34125), [PR #34163](https://github.com/BerriAI/litellm/pull/34163)
    - Return Models + Endpoints tabs to in-memory routing while keeping the `?model` drill-in - [PR #34629](https://github.com/BerriAI/litellm/pull/34629)

## AI Integrations

### Logging

- **[OpenTelemetry](../../docs/observability/opentelemetry_integration)**
    - Keep an MCP tool call in one trace, anchored to its own request - [PR #34537](https://github.com/BerriAI/litellm/pull/34537)
    - Stamp an MCP tool failure on the request that carried it - [PR #34551](https://github.com/BerriAI/litellm/pull/34551)
- **[Langfuse](../../docs/observability/langfuse_integration)**
    - Send the v4 ingestion header for the otel callback - [PR #33907](https://github.com/BerriAI/litellm/pull/33907)
- **[Prometheus](../../docs/proxy/prometheus)**
    - Populate cache write token metrics for OpenAI-style usage - [PR #34803](https://github.com/BerriAI/litellm/pull/34803)
- **General**
    - Record cost and usage reported by the upstream target on passthrough routes - [PR #34590](https://github.com/BerriAI/litellm/pull/34590)
    - Move the logs end-user filter onto `/management/v1` - [PR #34691](https://github.com/BerriAI/litellm/pull/34691)
    - Sanitize per-key callback config out of logged metadata - [PR #32583](https://github.com/BerriAI/litellm/pull/32583)
    - Match the exact class in callback dedup so a custom subclass no longer blocks a built-in logger - [PR #34804](https://github.com/BerriAI/litellm/pull/34804)
    - Stop scheduling the sync `failure_handler` concurrently with `async_failure_handler` - [PR #34306](https://github.com/BerriAI/litellm/pull/34306)
    - Surface env-var-sourced theme and logging-callback settings, and drop the misleading `os.environ` tooltip - [PR #34156](https://github.com/BerriAI/litellm/pull/34156), [PR #34305](https://github.com/BerriAI/litellm/pull/34305)

### Guardrails

- **[General](../../docs/proxy/guardrails/quick_start)**
    - Add `only_scan_new_messages` for per-session incremental scanning - [PR #33278](https://github.com/BerriAI/litellm/pull/33278)
    - Add a `run_in_parallel` opt-in for concurrent `pre_call` and `post_call` guardrails - [PR #33770](https://github.com/BerriAI/litellm/pull/33770)
    - Add DeepKeep as a custom guardrail - [PR #33844](https://github.com/BerriAI/litellm/pull/33844)
    - Merge model-level guardrails before `pre_call_hook` - [PR #29654](https://github.com/BerriAI/litellm/pull/29654)
    - Classify all 4xx `HTTPException` guardrail blocks as intervened - [PR #33821](https://github.com/BerriAI/litellm/pull/33821)
    - Stop reporting a no-op guardrail as applied on passthrough - [PR #34411](https://github.com/BerriAI/litellm/pull/34411)
    - Keep guardrail information in spend logs when the caller sends its own metadata - [PR #34458](https://github.com/BerriAI/litellm/pull/34458)
    - Resolve `judge_model` credentials via a lazy Router lookup in `llm_as_a_judge` - [PR #34509](https://github.com/BerriAI/litellm/pull/34509)
- **[Model Armor](../../docs/proxy/guardrails/model_armor)**
    - Sanitize error details by default - [PR #33908](https://github.com/BerriAI/litellm/pull/33908)
    - Handle `None` metadata in the `post_call` response processor - [PR #34405](https://github.com/BerriAI/litellm/pull/34405)
- **Compresr / Headroom**
    - Compress content-parts messages in the headroom guardrail for Anthropic traffic - [PR #34586](https://github.com/BerriAI/litellm/pull/34586)
    - Derive `tokens_saved` when the compression service omits it - [PR #34578](https://github.com/BerriAI/litellm/pull/34578)
    - Preserve `cache_control` breakpoints in the compresr write-back - [PR #34660](https://github.com/BerriAI/litellm/pull/34660)
- **Straiker**
    - Add `/v1/messages` support - [PR #34548](https://github.com/BerriAI/litellm/pull/34548)
- **[Bedrock Guardrails](../../docs/proxy/guardrails/bedrock)**
    - Stop replaying expired Google OIDC tokens to STS on guardrail auth - [PR #34637](https://github.com/BerriAI/litellm/pull/34637)
- **Dashboard**
    - Hide guardrail group headers when only one group has entries - [PR #33885](https://github.com/BerriAI/litellm/pull/33885)

## Spend Tracking, Budgets and Rate Limiting

- **Budgets**
    - Configurable `budget_reset_time` of day - [PR #31007](https://github.com/BerriAI/litellm/pull/31007)
    - Reset users and teams whose `budget_reset_at` is NULL - [PR #33623](https://github.com/BerriAI/litellm/pull/33623)
    - Resolve word-form `budget_duration` so it no longer silently resets daily - [PR #34250](https://github.com/BerriAI/litellm/pull/34250)
    - Enforce a global `max_budget` against the resettable proxy budget row so `budget_duration` is honored - [PR #33732](https://github.com/BerriAI/litellm/pull/33732)
    - Set `budget_reset_at` when a JWT upsert seeds a `budget_duration` - [PR #34050](https://github.com/BerriAI/litellm/pull/34050)
    - Reject failed atomic budget reservations under `fail_closed_budget_enforcement` - [PR #34429](https://github.com/BerriAI/litellm/pull/34429)
    - Handle a tz-aware `temp_budget_expiry`, apply `temp_budget_increase` for cache-hit keys, and derive the increase without mutating the token - [PR #33840](https://github.com/BerriAI/litellm/pull/33840), [PR #33841](https://github.com/BerriAI/litellm/pull/33841), [PR #34121](https://github.com/BerriAI/litellm/pull/34121)
    - Raise the dashboard session budget default to $1 and make it configurable in config and the Admin UI - [PR #34146](https://github.com/BerriAI/litellm/pull/34146)
- **[Cost tracking](../../docs/proxy/cost_tracking)**
    - Map OpenAI `cache_write_tokens` for prompt cache creation billing - [PR #34046](https://github.com/BerriAI/litellm/pull/34046)
    - Track prompt compression saved tokens in daily spend aggregates - [PR #33810](https://github.com/BerriAI/litellm/pull/33810)
    - Attribute org spend for team-linked credentials minted without an `org_id` - [PR #34577](https://github.com/BerriAI/litellm/pull/34577)
    - Gate an unsupported `service_tier` on `drop_params` for the Bedrock Mantle Responses API - [PR #34058](https://github.com/BerriAI/litellm/pull/34058)
    - Raise the `/spend/logs/v2` `page_size` cap to 1000 - [PR #33994](https://github.com/BerriAI/litellm/pull/33994)
- **Cost Optimization page**
    - Add spend-by-tool and cache leakage views - [PR #33978](https://github.com/BerriAI/litellm/pull/33978)
    - Add configuration tabs - [PR #33899](https://github.com/BerriAI/litellm/pull/33899)
    - Mark Cost Optimization as beta in the left nav - [PR #34984](https://github.com/BerriAI/litellm/pull/34984)
    - Anchor the savings line at a $0 range start and swap the methodology Collapse for a shadcn HoverCard - [PR #34453](https://github.com/BerriAI/litellm/pull/34453), [PR #34598](https://github.com/BerriAI/litellm/pull/34598)
    - Keep the cache leakage time range picker inline at narrow widths and the date picker on the right - [PR #34439](https://github.com/BerriAI/litellm/pull/34439), [PR #34885](https://github.com/BerriAI/litellm/pull/34885)
- **Tool spend**
    - Roll up tool spend daily instead of scanning SpendLogs - [PR #34675](https://github.com/BerriAI/litellm/pull/34675)
    - Cap the `/v1/tool/spend` window at 30 days and bound every SpendLogs read - [PR #34582](https://github.com/BerriAI/litellm/pull/34582)
- **Dashboard**
    - Stop the key-edit form 403ing on non-budget saves - [PR #34112](https://github.com/BerriAI/litellm/pull/34112)

## MCP Gateway

- **[Dynamic Client Registration](../../docs/mcp)**
    - Always-on aggregate gateway DCR discovery front door - [PR #33174](https://github.com/BerriAI/litellm/pull/33174)
    - Identity-only session tokens for the gateway DCR front door - [PR #33182](https://github.com/BerriAI/litellm/pull/33182)
    - Admit gateway DCR session bearers at the aggregate `/mcp` scope - [PR #33190](https://github.com/BerriAI/litellm/pull/33190)
    - Return the DCR client's own `redirect_uris` to stop the `/callback` self-redirect loop - [PR #33756](https://github.com/BerriAI/litellm/pull/33756)
    - Fall through to an ephemeral DCR mint when passthrough authorize has no `client_id` - [PR #33884](https://github.com/BerriAI/litellm/pull/33884)
- **OAuth**
    - Send RFC 8707 resource indicators on upstream OAuth legs - [PR #34265](https://github.com/BerriAI/litellm/pull/34265)
    - Migrate `client_credentials` (M2M) onto the v2 resolver arm - [PR #32259](https://github.com/BerriAI/litellm/pull/32259)
    - Delete the unreachable v1 OBO handler and gate REST OAuth on the v2 resolver - [PR #34407](https://github.com/BerriAI/litellm/pull/34407)
    - Let an admin-pinned issuer drive OAuth discovery for url-less servers - [PR #34065](https://github.com/BerriAI/litellm/pull/34065)
    - Log actionable OAuth discovery failures for misconfigured server urls - [PR #34225](https://github.com/BerriAI/litellm/pull/34225)
    - Store the enterprise IdP identity assertion at SSO login for EMA egress - [PR #34072](https://github.com/BerriAI/litellm/pull/34072)
    - Standalone `/connect` route for MCP OAuth, decoupled from the Chat UI flag - [PR #34334](https://github.com/BerriAI/litellm/pull/34334)
- **Servers & tools**
    - Support MCP servers on the Anthropic `/v1/messages` API - [PR #33631](https://github.com/BerriAI/litellm/pull/33631)
    - Add Google Sheets, Drive, Calendar, and Docs to the OpenAPI registry, and move Drive to the official streamable HTTP MCP server - [PR #34059](https://github.com/BerriAI/litellm/pull/34059), [PR #34322](https://github.com/BerriAI/litellm/pull/34322)
    - Attach resolved OAuth credentials to OpenAPI `spec_path` tool calls - [PR #34063](https://github.com/BerriAI/litellm/pull/34063)
    - Stop leaking upstream server credentials in a tool-call 403 - [PR #34340](https://github.com/BerriAI/litellm/pull/34340)
    - Use a toolset row's stored tool name as written - [PR #34559](https://github.com/BerriAI/litellm/pull/34559)
    - Keep a key's MCP toolsets when saving an edit - [PR #34452](https://github.com/BerriAI/litellm/pull/34452)
    - Consolidate exception-tree walkers into one shared faults traversal - [PR #33183](https://github.com/BerriAI/litellm/pull/33183)

## Performance / Loadbalancing / Reliability improvements

- **Rust core**
    - Port `BaseAWSLLM` auth, credential resolution, and SigV4 to `litellm-core` as a base provider - [PR #33888](https://github.com/BerriAI/litellm/pull/33888)
    - Bedrock audio transcription via the Rust core over the Python-to-Rust bridge - [PR #33990](https://github.com/BerriAI/litellm/pull/33990)
    - Honor pre-computed Entra ID auth for Azure `/messages` - [PR #34107](https://github.com/BerriAI/litellm/pull/34107)
- **Streaming & core**
    - Build the per-chunk `Delta` directly instead of `setattr`/`delattr` churn - [PR #33992](https://github.com/BerriAI/litellm/pull/33992)
    - Fast-path `SafeAttributeModel.__delattr__` for declared fields - [PR #33993](https://github.com/BerriAI/litellm/pull/33993)
    - Forward SageMaker stream events as they arrive to cut TTFT - [PR #34338](https://github.com/BerriAI/litellm/pull/34338)
- **Router**
    - Edit fallback chains from router settings - [PR #32841](https://github.com/BerriAI/litellm/pull/32841)
    - `return_raw_model_name` toggle for the complexity router's response model field - [PR #33875](https://github.com/BerriAI/litellm/pull/33875)
    - Show in the log drawer and session sidebar when an auto-router served a request - [PR #34434](https://github.com/BerriAI/litellm/pull/34434)
    - Don't cool down the parent deployment on an advisor sub-call failure - [PR #33792](https://github.com/BerriAI/litellm/pull/33792)
    - Stop custom `model_info` leaking onto the shared backend cost map key, and propagate capability flags to it - [PR #34041](https://github.com/BerriAI/litellm/pull/34041), [PR #34047](https://github.com/BerriAI/litellm/pull/34047)
    - Honor request-level `num_retries` over `litellm_settings.num_retries`, and stop per-deployment `num_retries` double-counting as provider `max_retries` - [PR #34124](https://github.com/BerriAI/litellm/pull/34124), [PR #34129](https://github.com/BerriAI/litellm/pull/34129)
    - Release the pre-routing strategy slot when a deployment is replaced or deleted - [PR #34564](https://github.com/BerriAI/litellm/pull/34564)
    - Treat malformed cost-map token limits as absent on `/v1/models` - [PR #33903](https://github.com/BerriAI/litellm/pull/33903)
- **Proxy reliability**
    - Make in-memory and disk cache increments atomic - [PR #34013](https://github.com/BerriAI/litellm/pull/34013)
    - Share CLI SSO login sessions across workers without `enable_redis_auth_cache` - [PR #33261](https://github.com/BerriAI/litellm/pull/33261)
    - Avoid a DB outage during planned RDS IAM rotation - [PR #34749](https://github.com/BerriAI/litellm/pull/34749)
    - Stop `litellm/proxy` from shadowing installed packages on `sys.path` - [PR #34656](https://github.com/BerriAI/litellm/pull/34656)
    - Bake non-root prisma engines at `/opt/prisma` so migrations run offline for any uid - [PR #34325](https://github.com/BerriAI/litellm/pull/34325)
    - Pass an explicit Python version request to `uv tool install` - [PR #34750](https://github.com/BerriAI/litellm/pull/34750)
- **Dependencies & build**
    - Migrate the `litellm-rust` workspace to Rust edition 2024 - [PR #33940](https://github.com/BerriAI/litellm/pull/33940)
    - Advisory-clear bumps for gitpython, pypdf, pyasn1, js-yaml, brace-expansion, postcss, sharp, and Next.js - [PR #34056](https://github.com/BerriAI/litellm/pull/34056), [PR #34148](https://github.com/BerriAI/litellm/pull/34148), [PR #34168](https://github.com/BerriAI/litellm/pull/34168), [PR #34193](https://github.com/BerriAI/litellm/pull/34193), [PR #34329](https://github.com/BerriAI/litellm/pull/34329), [PR #34634](https://github.com/BerriAI/litellm/pull/34634), [PR #34798](https://github.com/BerriAI/litellm/pull/34798)

## Documentation Updates

- Add a TLDR section to the PR template - [PR #34203](https://github.com/BerriAI/litellm/pull/34203)
- Ask for a numbered list of reproduction steps in the issue template - [PR #34207](https://github.com/BerriAI/litellm/pull/34207)

### PR roll-up by ownership area

PRs by ownership area (total: 292)

- UI: 54
- Other (CI / chore / tests / build / version bumps): 46
- Spend / Budgets / Rate Limits: 33
- LLM API Endpoints: 31
- MCP: 29
- Auth & Management: 28
- Performance: 22
- Guardrails: 19
- Logging: 14
- Models & Providers: 14
- Docs: 2

## End-to-End Testing

We are investing heavily in end-to-end testing to cut regressions and make LiteLLM more stable release over release. Every version is exercised by a live suite that runs against a real deployed proxy and hits real provider endpoints, not mocks, so the behavior we validate is the behavior you get in production.

This window added 62 test PRs, the largest single-release investment in the suite so far. New coverage lands on live A2A agents, `/v1/images/edits`, `/openai` and `/vllm` chat passthrough cost logging, credential-backed `/v1/messages`, Azure AI Foundry and Anthropic `/v1/messages` through the Rust bridge, MCP access-group tool selection at key creation, a real Linear OAuth MCP driven through chat completions, budget and rate-limit resets across personal, team, and team-member keys, and a weekly session-anomaly load test against real providers. The Admin UI Playwright suite moved under `tests/e2e/ui`, and a run of hardening PRs removed cross-suite races on control-plane writes and data-plane sync lag.

## New Contributors

- @lyb0307 made their first contribution in [PR #33228](https://github.com/BerriAI/litellm/pull/33228)
- @jyeung-r7 made their first contribution in [PR #33623](https://github.com/BerriAI/litellm/pull/33623)
- @vineetpuranik made their first contribution in [PR #33940](https://github.com/BerriAI/litellm/pull/33940)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.94.0-rc.1...v1.95.0-rc.1
