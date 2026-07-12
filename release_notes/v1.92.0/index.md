---
title: "v1.92.0 - Claude Sonnet 5, Production MCP OAuth & New Providers"
slug: "v1-92-0"
date: 2026-07-11T00:00:00
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
docker.litellm.ai/berriai/litellm:1.92.0
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.92.0
```

</TabItem>
</Tabs>

## Key Highlights

- **Claude Sonnet 5** - first-class support across Anthropic, Amazon Bedrock (including the regional inference profiles), Vertex AI, and Azure AI, with a 1M-token context window, reasoning, computer use, PDF input, and introductory pricing through 2026-08-31.
- **Production-ready MCP OAuth (On-Behalf-Of)** - the token_exchange arm moves onto the v2 resolver with RFC 9728 -> RFC 8414 endpoint discovery (no IdP guessing), persisted Dynamic Client Registration, per-server outbound concurrency limits, and a `mcp_tool_search` virtual tool for large tool catalogs.
- **Two new providers** - Tencent (DeepSeek V4 flash/pro via TokenHub, chat and `/v1/messages`) and Google Distributed Cloud (GDC) Gemini for on-prem/sovereign deployments.
- **Access-control hardening** - admin-gating of `permissions` and `allowed_routes` across the key, user, and team endpoints, AES-256-GCM at-rest credential encryption with a versioned re-encryption migration, and redaction of secrets from startup and router error logs.
- **Faster hot paths** - spend-counter increments and pre-call budget reads are now gathered concurrently, the cost-callback deepcopy moved off the request event loop, OTel runtime imports are memoized, and Redis-cluster reconnect plus read-replica boot resilience keep the proxy serving during infra blips.

## New Providers and Endpoints

### New Providers (2 new providers)

| Provider | Supported LiteLLM Endpoints | Description |
| --- | --- | --- |
| Tencent (`tencent`) | Chat Completions, `/v1/messages` | Tencent TokenHub provider serving DeepSeek V4 (flash and pro) with reasoning, prompt caching, and Anthropic Messages support - [PR #31903](https://github.com/BerriAI/litellm/pull/31903) |
| Google Distributed Cloud - GDC (`gdc`) | Chat Completions | Google Distributed Cloud Gemini provider for on-prem and sovereign-cloud deployments - [PR #31895](https://github.com/BerriAI/litellm/pull/31895) |

## New Models / Updated Models

#### New Model Support (13 new pricing entries across 4 models)

| Provider | Model | Context Window | Input ($/1M tokens) | Output ($/1M tokens) | Features |
| --- | --- | --- | --- | --- | --- |
| Anthropic / Bedrock / Vertex / Azure AI | `claude-sonnet-5` | 1M | $2.00 | $10.00 | Reasoning, vision, function calling, prompt caching, computer use, PDF input, adaptive thinking |
| Bedrock Mantle | `bedrock_mantle/xai.grok-4.3` | 131K | $1.25 | $2.50 | Reasoning, vision, function calling |
| Tencent | `tencent/deepseek-v4-flash` | 1M | $0.14 | $0.28 | Reasoning, function calling, prompt caching |
| Tencent | `tencent/deepseek-v4-pro` | 1M | $0.435 | $0.87 | Reasoning, function calling, prompt caching |

Claude Sonnet 5 ships with pricing entries for Anthropic (`claude-sonnet-5`), Amazon Bedrock (`anthropic.claude-sonnet-5` plus the `us` / `eu` / `au` / `jp` / `global` regional inference profiles), Vertex AI (`vertex_ai/claude-sonnet-5`), and Azure AI (`azure_ai/claude-sonnet-5`) - [PR #31740](https://github.com/BerriAI/litellm/pull/31740), with introductory pricing applied through 2026-08-31 - [PR #31917](https://github.com/BerriAI/litellm/pull/31917).

#### Features

- **[Anthropic](../../docs/providers/anthropic)**
    - Add Claude Sonnet 5 with reasoning, computer use, and PDF input - [PR #31740](https://github.com/BerriAI/litellm/pull/31740)
    - Keep `context_management` working when `drop_params` is enabled - [PR #32020](https://github.com/BerriAI/litellm/pull/32020)
    - Preserve `x-anthropic-billing-header` system blocks for first-party Anthropic - [PR #29584](https://github.com/BerriAI/litellm/pull/29584)
- **[Amazon Bedrock](../../docs/providers/bedrock)**
    - Forward `strict` and `additionalProperties` to the Converse `toolSpec` - [PR #29814](https://github.com/BerriAI/litellm/pull/29814)
    - Add `xai.grok-4.3` to the model cost map for Bedrock Mantle SigV4 auth - [PR #31916](https://github.com/BerriAI/litellm/pull/31916)
    - SigV4/IAM auth on the Bedrock Mantle Responses API route - [PR #29788](https://github.com/BerriAI/litellm/pull/29788)
    - Honor `ttl` for `tool_config` cache injection points - [PR #31929](https://github.com/BerriAI/litellm/pull/31929)
    - Map `guardrailConfig` to InvokeModel guardrail headers - [PR #31985](https://github.com/BerriAI/litellm/pull/31985)
- **[Google Vertex AI](../../docs/providers/vertex)**
    - Pass the full `imageConfig` dict for Gemini image generation - [PR #31811](https://github.com/BerriAI/litellm/pull/31811)
    - Propagate Vertex AI metadata in streaming success callbacks - [PR #29899](https://github.com/BerriAI/litellm/pull/29899)
    - Single media upload for batch files to fix 499s on large uploads - [PR #31653](https://github.com/BerriAI/litellm/pull/31653)
- **[Google Gemini](../../docs/providers/gemini)**
    - Support Gemini TTS `languageCode` parameters - [PR #29623](https://github.com/BerriAI/litellm/pull/29623)
    - New Google Distributed Cloud (GDC) Gemini provider - [PR #31895](https://github.com/BerriAI/litellm/pull/31895)
- **[Tencent](../../docs/providers)**
    - Add Tencent TokenHub as a provider serving DeepSeek V4 - [PR #31903](https://github.com/BerriAI/litellm/pull/31903)
- **[Fireworks AI](../../docs/providers/fireworks_ai)**
    - Enable tool calling for `glm-5p1` in the model cost map - [PR #29697](https://github.com/BerriAI/litellm/pull/29697)
- **[Databricks](../../docs/providers/databricks)**
    - Split parallel tool calls so each tool message follows its `tool_calls` - [PR #31633](https://github.com/BerriAI/litellm/pull/31633)
- **General**
    - Add Parasail as a JSON-configured OpenAI-compatible provider - [PR #29842](https://github.com/BerriAI/litellm/pull/29842)

### Bug Fixes

- **[Amazon Bedrock](../../docs/providers/bedrock)**
    - Drop `toolSpec.strict` for Opus 4.7/4.8 to unblock tool calls - [PR #31923](https://github.com/BerriAI/litellm/pull/31923)
    - Drop `strict`/`additionalProperties` from `toolSpec` for Claude Sonnet 4 - [PR #31943](https://github.com/BerriAI/litellm/pull/31943)
    - Omit empty `additionalModelRequestFields` and `system` from the Converse payload - [PR #29565](https://github.com/BerriAI/litellm/pull/29565)
    - Expand `os.environ/` references for AWS auth params, then all fields, in DB-sourced models - [PR #32256](https://github.com/BerriAI/litellm/pull/32256), [PR #32405](https://github.com/BerriAI/litellm/pull/32405)
- **[Anthropic](../../docs/providers/anthropic)**
    - Bill streaming 1h prompt-cache writes at the 1h rate - [PR #32073](https://github.com/BerriAI/litellm/pull/32073)
    - Drop unsignable thinking blocks and allow a null signature in logging - [PR #31654](https://github.com/BerriAI/litellm/pull/31654)
    - Require a caller `api_key` and validate `api_base` in the advisor tool - [PR #32093](https://github.com/BerriAI/litellm/pull/32093)

## LLM API Endpoints

#### Features

- **[Responses API](../../docs/response_api)**
    - Passthrough `/v1/messages` to native provider endpoints via `supported_endpoints` - [PR #31685](https://github.com/BerriAI/litellm/pull/31685)
    - Route GitHub Copilot `/v1/messages` to the native Anthropic endpoint - [PR #31802](https://github.com/BerriAI/litellm/pull/31802)
    - Add cache-control injection support for the `/v1/messages` endpoint - [PR #31778](https://github.com/BerriAI/litellm/pull/31778)
- **[/v1/messages](../../docs/anthropic_unified)**
    - Drop top-level `additional_drop_params` on `/v1/messages` - [PR #31645](https://github.com/BerriAI/litellm/pull/31645)
- **[Image Generation](../../docs/image_generation)**
    - Azure AI MAI-Image-2.5 image generation support - [PR #29688](https://github.com/BerriAI/litellm/pull/29688)
- **[A2A](../../docs/a2a)**
    - Support `a2a-sdk` 1.x proxy routing for 0.3 and 1.0 agents - [PR #30950](https://github.com/BerriAI/litellm/pull/30950)
- **[Sandbox](../../docs/sandbox)**
    - Reuse the e2b container across requests when `metadata.session_id` is set - [PR #31688](https://github.com/BerriAI/litellm/pull/31688)
- **General**
    - Extend the response-headers hook to streaming, TTS, image generation, and pass-through - [PR #24232](https://github.com/BerriAI/litellm/pull/24232)
    - `websearch_interception` agentic-loop fixes for chat completions and Anthropic messages - [PR #31669](https://github.com/BerriAI/litellm/pull/31669)
    - Make the TinyFish search provider permissive and attribute errors - [PR #31997](https://github.com/BerriAI/litellm/pull/31997)

#### Bugs

- **[Responses API](../../docs/response_api)**
    - Preserve forced-function `tool_choice` name in the Responses-to-Chat transform - [PR #29812](https://github.com/BerriAI/litellm/pull/29812)
    - Map a system-only chat request to a system input item in the Responses bridge - [PR #29817](https://github.com/BerriAI/litellm/pull/29817)
    - Merge `metadata.tags` into `litellm_metadata` on the `/v1/responses` route - [PR #31793](https://github.com/BerriAI/litellm/pull/31793)
    - Route per-model on GitHub Copilot `/v1/responses` based on model info - [PR #29747](https://github.com/BerriAI/litellm/pull/29747)
    - Drop unmappable Bedrock Responses tools instead of failing the request - [PR #31663](https://github.com/BerriAI/litellm/pull/31663)
- **[Realtime API](../../docs/realtime)**
    - Stop a second Gemini Live setup, retry a hung handshake, and close a guardrail bypass - [PR #31519](https://github.com/BerriAI/litellm/pull/31519)
    - Trigger Nova Sonic generation on `response.create` so realtime sessions stop hanging - [PR #31924](https://github.com/BerriAI/litellm/pull/31924)
    - Route realtime HTTP endpoints through the router for credential resolution - [PR #32077](https://github.com/BerriAI/litellm/pull/32077)
- **[OCR](../../docs/ocr)**
    - Preserve content, tables, and `keyValuePairs` in Azure AI doc-intelligence `/v1/ocr` - [PR #32018](https://github.com/BerriAI/litellm/pull/32018)
- **[A2A](../../docs/a2a)**
    - Populate response usage in the A2A chat transformation - [PR #31980](https://github.com/BerriAI/litellm/pull/31980)
- **General**
    - Return upstream error bodies unchanged in pass-through - [PR #32133](https://github.com/BerriAI/litellm/pull/32133)
    - Normalize Anthropic pass-through server tool usage - [PR #29827](https://github.com/BerriAI/litellm/pull/29827)
    - Redact provider credentials embedded in fallback error messages - [PR #32083](https://github.com/BerriAI/litellm/pull/32083)
    - Support Responses input in the Redis semantic cache - [PR #29581](https://github.com/BerriAI/litellm/pull/29581)

## Management Endpoints / UI

#### Features

- **Virtual Keys & Access Control**
    - Admin-gate `permissions` on `/key/update`, `/key/regenerate`, `/user/new`, `/user/update`, and bulk key updates - [PR #31810](https://github.com/BerriAI/litellm/pull/31810), [PR #31998](https://github.com/BerriAI/litellm/pull/31998), [PR #32002](https://github.com/BerriAI/litellm/pull/32002)
    - Admin-gate `allowed_routes` presence on `/key/update` and `/key/regenerate` - [PR #31987](https://github.com/BerriAI/litellm/pull/31987)
    - Gate non-admin `/key/generate` `budget_limits` and permissions - [PR #31469](https://github.com/BerriAI/litellm/pull/31469)
    - Reject team-scoped `object_permission` on personal keys for non-admins - [PR #31471](https://github.com/BerriAI/litellm/pull/31471)
    - Support `object_permission` in `default_key_generate_params` - [PR #31776](https://github.com/BerriAI/litellm/pull/31776)
    - Reject non-finite `budget_limits` windows and hard-reject CLI session-token personal-key budgets on `/key/generate` - [PR #31630](https://github.com/BerriAI/litellm/pull/31630), [PR #31631](https://github.com/BerriAI/litellm/pull/31631)
    - Tighten role gating on the `/get/config/callbacks` response and extend banned-params + admin-clear lists - [PR #31745](https://github.com/BerriAI/litellm/pull/31745), [PR #31742](https://github.com/BerriAI/litellm/pull/31742)
    - Audit default-user-settings and remaining system-wide-settings updates - [PR #31753](https://github.com/BerriAI/litellm/pull/31753), [PR #31754](https://github.com/BerriAI/litellm/pull/31754)
    - JWT auth opt-in fallback to the DB team on an unresolved claim - [PR #28913](https://github.com/BerriAI/litellm/pull/28913)
    - Reject non-existent team/key/model scope entries on policy attachment create - [PR #32131](https://github.com/BerriAI/litellm/pull/32131)
- **UI**
    - shadcn migration foundation: Tailwind v4, shadcn init, and antd cascade fix - [PR #31995](https://github.com/BerriAI/litellm/pull/31995)
    - Migrate the chat UI from antd to shadcn/ui and add key-management and usage panels - [PR #32074](https://github.com/BerriAI/litellm/pull/32074)
    - Rotate model credentials in a dedicated modal so a normal save can't overwrite secrets - [PR #28089](https://github.com/BerriAI/litellm/pull/28089)
    - Disclaim that the Update API Key modal only rotates `api_key` - [PR #31805](https://github.com/BerriAI/litellm/pull/31805)
    - Add budget duration to the edit-team-member form - [PR #29717](https://github.com/BerriAI/litellm/pull/29717)
    - Render provider icons on the public model hub - [PR #29958](https://github.com/BerriAI/litellm/pull/29958)

#### Bugs

- **Virtual Keys & Models**
    - Show team projects to internal users on key creation - [PR #28855](https://github.com/BerriAI/litellm/pull/28855)
    - Label the default key type as "Full Access" on the key edit page - [PR #29870](https://github.com/BerriAI/litellm/pull/29870)
    - Keep virtual-keys filters across delete and refresh - [PR #31533](https://github.com/BerriAI/litellm/pull/31533)
    - Allow deleting a BYOK model after its team is deleted, and delete a team's BYOK models on team deletion - [PR #29875](https://github.com/BerriAI/litellm/pull/29875), [PR #29977](https://github.com/BerriAI/litellm/pull/29977)
    - Count only legacy `function_call.arguments` in the token counter - [PR #31741](https://github.com/BerriAI/litellm/pull/31741)
    - Fix the typo `generic_role_mappoings` -> `generic_role_mappings` - [PR #29753](https://github.com/BerriAI/litellm/pull/29753)
- **UI**
    - Stop the Request Logs page from overflowing horizontally and size its columns - [PR #31426](https://github.com/BerriAI/litellm/pull/31426)
    - Fix the Router Settings Loadbalancing tab save - [PR #31735](https://github.com/BerriAI/litellm/pull/31735)
    - Allow any git host on the skills add form - [PR #31652](https://github.com/BerriAI/litellm/pull/31652)
    - Include cache token columns in the usage export - [PR #32015](https://github.com/BerriAI/litellm/pull/32015)
    - Unify migrated-route URLs and migrate the API Reference page - [PR #29953](https://github.com/BerriAI/litellm/pull/29953)
    - Make the workflow runs page fill full width - [PR #29868](https://github.com/BerriAI/litellm/pull/29868)

## AI Integrations

### Logging

- **[Prometheus](../../docs/proxy/prometheus)**
    - Add an `api_provider` label to token, latency, request, and cache metrics - [PR #32126](https://github.com/BerriAI/litellm/pull/32126)
    - Add `litellm_overhead_with_guardrails_latency_metric` - [PR #31593](https://github.com/BerriAI/litellm/pull/31593)
    - Expose `project_alias` in custom metadata labels and expose MCP tool metadata - [PR #31784](https://github.com/BerriAI/litellm/pull/31784), [PR #31899](https://github.com/BerriAI/litellm/pull/31899)
    - Bound per-request budget metric emission with a timeout - [PR #31632](https://github.com/BerriAI/litellm/pull/31632)
- **[OpenTelemetry](../../docs/observability/opentelemetry_integration)**
    - Stamp `gen_ai.response.time_to_first_chunk` on streaming LLM spans - [PR #32236](https://github.com/BerriAI/litellm/pull/32236)
    - Restore `error.*` span attributes on v2 error spans - [PR #32524](https://github.com/BerriAI/litellm/pull/32524)
- **[S3](../../docs/proxy/logging)**
    - Send `Content-MD5` on PUT and support optional server-side encryption in the s3 v2 logger - [PR #31928](https://github.com/BerriAI/litellm/pull/31928)
- **[Microsoft Sentinel](../../docs/proxy/logging)**
    - Resolve the audit stream from `AZURE_SENTINEL_AUDIT_STREAM_NAME` - [PR #32010](https://github.com/BerriAI/litellm/pull/32010)
- **[FOCUS Export](../../docs/proxy/cost_tracking)**
    - Include organization metadata in Vantage FOCUS Tags export and add a GCS destination for FOCUS export - [PR #28184](https://github.com/BerriAI/litellm/pull/28184), [PR #29751](https://github.com/BerriAI/litellm/pull/29751)
- **General**
    - Route realtime success logging through the bounded worker - [PR #31733](https://github.com/BerriAI/litellm/pull/31733)
    - Restore the admin key/team `callback_vars.turn_off_message_logging` override - [PR #31905](https://github.com/BerriAI/litellm/pull/31905)
    - Resolve `model_map_value` for proxy custom pricing in standard logging - [PR #31940](https://github.com/BerriAI/litellm/pull/31940)
    - Log hashed cache keys - [PR #29890](https://github.com/BerriAI/litellm/pull/29890)
    - Add a Galileo health check for the UI callback test - [PR #29908](https://github.com/BerriAI/litellm/pull/29908)

### Guardrails

- **[Model Armor](../../docs/proxy/guardrails/model_armor)**
    - Scan file and document attachments with Model Armor - [PR #31655](https://github.com/BerriAI/litellm/pull/31655)
- **[CrowdStrike AIDR](../../docs/proxy/guardrails)**
    - Capture user and model metadata, reading identity from both metadata bags - [PR #29517](https://github.com/BerriAI/litellm/pull/29517), [PR #29991](https://github.com/BerriAI/litellm/pull/29991)
- **[Headroom](../../docs/proxy/guardrails)**
    - Add CCR (compress-cache-retrieve) via an agentic loop - [PR #31681](https://github.com/BerriAI/litellm/pull/31681)
    - Add an `unreachable_fallback` fail-open option to the headroom guardrail - [PR #32026](https://github.com/BerriAI/litellm/pull/32026)
- **General**
    - Buffer streamed responses until moderated, with a clean SSE on block - [PR #31389](https://github.com/BerriAI/litellm/pull/31389)
    - Expose streaming knobs on `generic_guardrail_api` - [PR #31730](https://github.com/BerriAI/litellm/pull/31730)
    - Keep the create-guardrail modal open on outside click and default the guardrails page to the Guardrails tab - [PR #29871](https://github.com/BerriAI/litellm/pull/29871), [PR #29872](https://github.com/BerriAI/litellm/pull/29872)

### Secret Managers

- **General**
    - AES-256-GCM at-rest credential encryption with a versioned format and a re-encryption migration - [PR #31215](https://github.com/BerriAI/litellm/pull/31215)

## Spend Tracking, Budgets and Rate Limiting

- **Budgets & Fallbacks**
    - Key-level `budget_fallbacks` to reroute requests when a per-model budget is exceeded - [PR #31783](https://github.com/BerriAI/litellm/pull/31783), with UI configuration on the key create/edit forms - [PR #32072](https://github.com/BerriAI/litellm/pull/32072)
    - Add a `disable_budget_reservation` general setting - [PR #29493](https://github.com/BerriAI/litellm/pull/29493)
    - Reserve team-budget raises for proxy admins and don't block `/team/update` on an unchanged budget - [PR #30030](https://github.com/BerriAI/litellm/pull/30030), [PR #29525](https://github.com/BerriAI/litellm/pull/29525)
    - Prevent duplicate budget alert emails on concurrent threshold crossings and apply `EMAIL_SIGNATURE` to them - [PR #32011](https://github.com/BerriAI/litellm/pull/32011), [PR #31712](https://github.com/BerriAI/litellm/pull/31712)
- **Cost Tracking**
    - Standardize rate-limit errors with `category`, `rate_limit_type`, `model`, and `llm_provider` fields - [PR #27687](https://github.com/BerriAI/litellm/pull/27687)
    - Store the cost breakdown for `/v1/realtime` sessions - [PR #30069](https://github.com/BerriAI/litellm/pull/30069)
    - Track cost for unmanaged Vertex AI batch jobs - [PR #31442](https://github.com/BerriAI/litellm/pull/31442)
    - Report real token usage on blocked responses - [PR #31217](https://github.com/BerriAI/litellm/pull/31217)
    - Emit the `x-litellm-response-cost` header on `/messages` and `/generateContent` - [PR #31675](https://github.com/BerriAI/litellm/pull/31675)
    - Recognize `*.cognitiveservices.azure.com` as OpenAI-compatible in pass-through cost tracking - [PR #29730](https://github.com/BerriAI/litellm/pull/29730)
    - Record agent `cost_per_query` and input tokens on the A2A native send path - [PR #31979](https://github.com/BerriAI/litellm/pull/31979)
    - Count only active users toward the license seat limit - [PR #31227](https://github.com/BerriAI/litellm/pull/31227)
    - Log per-token-type reasoning and cache cost breakdown - [PR #31623](https://github.com/BerriAI/litellm/pull/31623)

## MCP Gateway

- **OAuth 2.0 (On-Behalf-Of) v2**
    - Migrate the token_exchange (OBO) arm to the v2 resolver and make it production-ready with discovery threading, audit hardening, and an RFC 9728 challenge - [PR #31526](https://github.com/BerriAI/litellm/pull/31526), [PR #31622](https://github.com/BerriAI/litellm/pull/31622)
    - Discover the OBO token endpoint via RFC 9728 -> RFC 8414 instead of guessing the IdP - [PR #31762](https://github.com/BerriAI/litellm/pull/31762)
    - Persist the DCR `client_id` so interactive OAuth token refresh works, including on-create Authorize & Fetch - [PR #31912](https://github.com/BerriAI/litellm/pull/31912), [PR #31920](https://github.com/BerriAI/litellm/pull/31920)
    - Resolve per-user OAuth identity authoritatively at the token endpoint - [PR #31657](https://github.com/BerriAI/litellm/pull/31657)
    - Support `client_secret_basic` for upstream OAuth token endpoints and add a token-endpoint auth-method selector in the UI - [PR #31635](https://github.com/BerriAI/litellm/pull/31635), [PR #31739](https://github.com/BerriAI/litellm/pull/31739)
    - Gate OAuth authorize/token/register/discovery on `auth_type=oauth2` - [PR #31736](https://github.com/BerriAI/litellm/pull/31736)
    - Mirror the upstream token lifetime instead of forcing a 1h OBO expiry - [PR #29951](https://github.com/BerriAI/litellm/pull/29951)
    - Reset OAuth state on create-server modal close so a prior server's token no longer leaks into the next add-server session - [PR #30000](https://github.com/BerriAI/litellm/pull/30000)
    - Let non-creator users OAuth into OBO-mode servers and allow team access-group grants in the authorize/token check - [PR #29867](https://github.com/BerriAI/litellm/pull/29867), [PR #30041](https://github.com/BerriAI/litellm/pull/30041)
- **Server Management & Tools**
    - Add `mcp_tool_search` virtual tools for large tool catalogs - [PR #31777](https://github.com/BerriAI/litellm/pull/31777)
    - Bound outbound tool-call concurrency per MCP server - [PR #31641](https://github.com/BerriAI/litellm/pull/31641)
    - Add an `all-proxy-mcpservers` sentinel to grant teams every MCP server - [PR #32012](https://github.com/BerriAI/litellm/pull/32012)
    - Roll up MCP tool spend to user counters and the usage UI - [PR #31576](https://github.com/BerriAI/litellm/pull/31576)
    - Hydrate the MCP server registry from the DB on startup when `store_model_in_db` is false - [PR #31775](https://github.com/BerriAI/litellm/pull/31775)
    - Emit a `tools/list` CLIENT span for MCP discovery under otel_v2 - [PR #31525](https://github.com/BerriAI/litellm/pull/31525)
- **Bug Fixes**
    - Stop one unauthenticated server from emptying the aggregate `tools/list` - [PR #31684](https://github.com/BerriAI/litellm/pull/31684)
    - Surface `tools/list` auth failures as a 401 challenge on single-server routes - [PR #31921](https://github.com/BerriAI/litellm/pull/31921)
    - Load MCP tool configuration tools via the OBO/passthrough-aware GET path - [PR #29960](https://github.com/BerriAI/litellm/pull/29960)
    - Tighten role-based visibility on `/v1/mcp/server/submissions` - [PR #31932](https://github.com/BerriAI/litellm/pull/31932)
    - Highlight MCP cards red when the logged-in user is missing per-user env vars - [PR #29856](https://github.com/BerriAI/litellm/pull/29856)
    - BYOM visibility, preview UX, and admin-settings gating - [PR #31809](https://github.com/BerriAI/litellm/pull/31809)
    - Re-add the chat UI and allow a simple UI for MCP OBO auth - [PR #31893](https://github.com/BerriAI/litellm/pull/31893)
    - Keep an in-flight OAuth resume from resetting when the create-server modal mounts closed - [PR #32416](https://github.com/BerriAI/litellm/pull/32416)

## Performance / Loadbalancing / Reliability improvements

- **Spend & Auth hot paths**
    - Gather independent per-scope spend-counter increments - [PR #31578](https://github.com/BerriAI/litellm/pull/31578)
    - Move the cost-callback payload deepcopy off the request event loop - [PR #31579](https://github.com/BerriAI/litellm/pull/31579)
    - Gather independent pre-call budget-enforcement reads in `common_checks` - [PR #31604](https://github.com/BerriAI/litellm/pull/31604)
    - Memoize the per-request lazy import of OTel runtime hooks - [PR #31707](https://github.com/BerriAI/litellm/pull/31707)
    - Load the virtual-keys team filter from the fast v2 endpoint - [PR #31638](https://github.com/BerriAI/litellm/pull/31638)
- **Reliability**
    - Keep serving reads from the read replica when the primary DB is down at startup - [PR #31951](https://github.com/BerriAI/litellm/pull/31951)
    - Re-establish async Redis-cluster connections after a node restart - [PR #31577](https://github.com/BerriAI/litellm/pull/31577)
    - Isolate poison spend-log rows so one bad record can't drop the whole batch - [PR #31705](https://github.com/BerriAI/litellm/pull/31705)
    - Stop leaking `master_key` and `database_url` in startup DEBUG logs - [PR #31944](https://github.com/BerriAI/litellm/pull/31944)
- **Routing**
    - Tag-routing denylist support via a `!` prefix - [PR #31728](https://github.com/BerriAI/litellm/pull/31728)
    - Declarative fallback generalizations for unknown models - [PR #29718](https://github.com/BerriAI/litellm/pull/29718)
    - Skip the health check for semantic auto_router deployments - [PR #31668](https://github.com/BerriAI/litellm/pull/31668)
- **Build**
    - Bump the wolfi-base digest for glibc 2.43-r10 - [PR #32277](https://github.com/BerriAI/litellm/pull/32277)

## Documentation Updates

- Require a reproduction video for reported issues in the contribution guidelines - [PR #30063](https://github.com/BerriAI/litellm/pull/30063)

### PR roll-up by ownership area

PRs by ownership area (total: 226)

- LLM API Endpoints: 30
- UI: 28
- MCP: 28
- Models & Providers: 27
- Other (CI / chore / tests / version bumps): 24
- Auth & Management: 23
- Logging: 22
- Spend / Budgets / Rate Limits: 18
- Guardrails: 12
- Performance: 11
- Docs: 2
- Secret Managers: 1

## New Contributors

- @roytev made their first contribution in [PR #29565](https://github.com/BerriAI/litellm/pull/29565)
- @balcsida made their first contribution in [PR #29581](https://github.com/BerriAI/litellm/pull/29581)
- @PigeonMark made their first contribution in [PR #29584](https://github.com/BerriAI/litellm/pull/29584)
- @johngarrido made their first contribution in [PR #29623](https://github.com/BerriAI/litellm/pull/29623)
- @arnav-144p made their first contribution in [PR #29753](https://github.com/BerriAI/litellm/pull/29753)
- @Kaihuang724 made their first contribution in [PR #29842](https://github.com/BerriAI/litellm/pull/29842)
- @fengjikui made their first contribution in [PR #29890](https://github.com/BerriAI/litellm/pull/29890)
- @fernando-izar made their first contribution in [PR #31632](https://github.com/BerriAI/litellm/pull/31632)

## Full Changelog

[`v1.91.0...v1.92.0`](https://github.com/BerriAI/litellm/compare/v1.91.0...v1.92.0)
