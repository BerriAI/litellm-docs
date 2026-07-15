---
title: "v1.93.0rc1 - GPT-5.6, Client-Forwarded MCP Credentials & Meta Model API"
slug: "v1-93-0-rc-1"
date: 2026-07-11T23:30:00
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
docker.litellm.ai/berriai/litellm:1.93.0-rc.1
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.93.0rc1
```

</TabItem>
</Tabs>

## Key Highlights

- **GPT-5.6 and more new models** - day-0 pricing and metadata for OpenAI GPT-5.6 (`sol` / `terra` / `luna`) on OpenAI and Azure, xAI Grok-4.5, OpenAI Realtime 2.1 (and `-mini`), Google Cloud Chirp 3 speech-to-text, and the `jp` regional inference profile for Bedrock Claude Opus 4.8.
- **Meta Model API provider** - a new OpenAI-compatible provider (`meta`) serving `muse-spark-1.1` on day-0 across Chat Completions, `/v1/messages`, and Responses.
- **Client-forwarded MCP credentials** - new `true_passthrough` and `oauth_delegate` auth modes plus a `dcr_bridge` sealed-envelope path let clients hold their own upstream MCP credentials, with PKCE S256 enforced on both authorize arms and upstream discovery bound to each server.
- **shadcn / Base UI dashboard migration** - the shared DataTable, charts (recharts), and the full-height sidebar shell move onto Base UI primitives, with a redesigned account menu and reusable filter/column-visibility controls.
- **Smarter complexity router** - keyword tier overrides, semantic keyword matching, an optional LLM-based classifier, and per-decision routing logs for the auto router.

## New Providers and Endpoints

### New Providers (1 new provider)

| Provider | Supported LiteLLM Endpoints | Description |
| --- | --- | --- |
| Meta Model API (`meta`) | Chat Completions, `/v1/messages`, Responses | OpenAI-compatible Meta Model API provider serving `muse-spark-1.1` on day-0 - [PR #32701](https://github.com/BerriAI/litellm/pull/32701) |

## New Models / Updated Models

#### New Model Support (31 new pricing entries)

| Provider | Model | Context Window | Input ($/1M tokens) | Output ($/1M tokens) | Features |
| --- | --- | --- | --- | --- | --- |
| OpenAI | `gpt-5.6` (and `-sol` / `-terra` / `-luna`) | 1.05M | $5.00 (`terra` $2.50, `luna` $1.00) | $30.00 (`terra` $15.00, `luna` $6.00) | Reasoning, vision, function calling, prompt caching, PDF input, web search |
| Azure | `azure/gpt-5.6` (and `us` / `eu` regional + `-sol` / `-terra` / `-luna`) | 1.05M | $5.00 | $30.00 | Reasoning, vision, function calling, prompt caching, PDF input, web search |
| Azure | `azure/{us,eu}/gpt-5.4`, `azure/{us,eu}/gpt-5.5` (data-zone + long-context) | 1.05M | $2.75 / $5.50 | $16.50 / $33.00 | Reasoning, vision, function calling, prompt caching, PDF input |
| OpenAI | `gpt-realtime-2.1`, `gpt-realtime-2.1-mini` | 128K | $4.00 / $0.60 | $24.00 / $2.40 | Audio input/output, function calling |
| xAI | `xai/grok-4.5`, `xai/grok-4.5-latest` | 500K | $2.00 | $6.00 | Reasoning, vision, function calling, web search |
| Meta | `meta/muse-spark-1.1` | 1.05M | $1.25 | $4.25 | Reasoning, vision, function calling, prompt caching, PDF input, web search |
| Amazon Bedrock | `jp.anthropic.claude-opus-4-8` | 1M | $5.50 | $27.50 | Reasoning, computer use, vision, PDF input, adaptive thinking |
| Google Vertex AI | `vertex_ai/chirp_3` (Speech-to-Text) | n/a | $0.00026667 / sec | n/a | Audio transcription |

GPT-5.6 ships priority, flex, batch, and above-272k long-context pricing tiers on both OpenAI and Azure - [PR #32659](https://github.com/BerriAI/litellm/pull/32659), [PR #32678](https://github.com/BerriAI/litellm/pull/32678). Azure `gpt-5.4` / `gpt-5.5` gained data-zone and long-context entries - [PR #32279](https://github.com/BerriAI/litellm/pull/32279), and Bedrock regional inference profiles now resolve to their regional pricing in `get_model_info` - [PR #32389](https://github.com/BerriAI/litellm/pull/32389).

#### Features

- **[OpenAI](../../docs/providers/openai)**
    - Add GPT-5.6 (`sol` / `terra` / `luna`) pricing and metadata - [PR #32659](https://github.com/BerriAI/litellm/pull/32659)
    - Add `gpt-realtime-2.1` models with regional processing uplift - [PR #32387](https://github.com/BerriAI/litellm/pull/32387)
    - Forward the `verbosity` param to chat completion providers - [PR #32254](https://github.com/BerriAI/litellm/pull/32254)
- **[Azure](../../docs/providers/azure)**
    - Add Azure GPT-5.6 (`sol` / `terra` / `luna`) pricing and metadata - [PR #32678](https://github.com/BerriAI/litellm/pull/32678)
    - Add Azure data-zone and long-context pricing for `gpt-5.4` / `gpt-5.5` - [PR #32279](https://github.com/BerriAI/litellm/pull/32279)
- **[xAI](../../docs/providers/xai)**
    - Add `xai/grok-4.5` pricing and metadata - [PR #32549](https://github.com/BerriAI/litellm/pull/32549)
- **[Meta](../../docs/providers/meta)**
    - Add the Meta Model API provider and `muse-spark-1.1` on day-0 - [PR #32701](https://github.com/BerriAI/litellm/pull/32701)
- **[Amazon Bedrock](../../docs/providers/bedrock)**
    - Add `jp.anthropic.claude-opus-4-8` to the model cost map - [PR #32840](https://github.com/BerriAI/litellm/pull/32840)
    - Retain `clear_tool_uses_20250919` context-management edits and emit the `context-management-2025-06-27` beta for Claude Invoke - [PR #32658](https://github.com/BerriAI/litellm/pull/32658)
    - Flag mapped Claude 4.8+ entries with `supports_mid_conversation_system` - [PR #32882](https://github.com/BerriAI/litellm/pull/32882)
- **[Google Vertex AI](../../docs/providers/vertex)**
    - Add Google Cloud Speech-to-Text Chirp 3 transcription support - [PR #32274](https://github.com/BerriAI/litellm/pull/32274)
- **[Anthropic](../../docs/providers/anthropic)**
    - Translate adaptive thinking/effort to pre-4.6 model support and thread the real provider through capability probes - [PR #32867](https://github.com/BerriAI/litellm/pull/32867), [PR #32874](https://github.com/BerriAI/litellm/pull/32874)
    - Resolve `@default` Vertex AI models to adaptive thinking by stripping the `@version` suffix in lookup candidates - [PR #32833](https://github.com/BerriAI/litellm/pull/32833)

### Bug Fixes

- **[Amazon Bedrock](../../docs/providers/bedrock)**
    - Preserve the stream param and decode SSE for Bedrock Mantle streaming - [PR #32141](https://github.com/BerriAI/litellm/pull/32141)
    - Emit an SSE error event when an invoke Messages stream ends without `message_stop` - [PR #32159](https://github.com/BerriAI/litellm/pull/32159)
    - Stop stale SigV4 headers clobbering a fresh signature on strip-and-retry re-sign - [PR #32371](https://github.com/BerriAI/litellm/pull/32371)
    - Honor `cache_control` ttl on message-level cache points - [PR #32538](https://github.com/BerriAI/litellm/pull/32538), [PR #32551](https://github.com/BerriAI/litellm/pull/32551)
    - Keep mid-conversation system messages in place for Claude Invoke, gated on model support - [PR #32578](https://github.com/BerriAI/litellm/pull/32578), [PR #32831](https://github.com/BerriAI/litellm/pull/32831)
    - Honor AWS auth params in the realtime handler - [PR #32275](https://github.com/BerriAI/litellm/pull/32275)
- **[Google Vertex AI](../../docs/providers/vertex)**
    - Build the full request path when a custom `api_base` has no path - [PR #32367](https://github.com/BerriAI/litellm/pull/32367)
    - Return the `create_vertex_url` result directly for openai-path partner models with a custom `api_base` - [PR #32380](https://github.com/BerriAI/litellm/pull/32380)
    - Forward realtime health check params - [PR #32550](https://github.com/BerriAI/litellm/pull/32550)
- **[Azure](../../docs/providers/azure)**
    - Build the responses `input_items` url with the path before the query string - [PR #32270](https://github.com/BerriAI/litellm/pull/32270)
- **General**
    - Forward provider response headers on streaming `/v1/messages` responses - [PR #32160](https://github.com/BerriAI/litellm/pull/32160)
    - Surface in-body error payloads on OpenAI-compatible streams - [PR #32237](https://github.com/BerriAI/litellm/pull/32237)
    - Resolve `os.environ/` references universally in DB-sourced models - [PR #32405](https://github.com/BerriAI/litellm/pull/32405)
    - Stop per-request custom pricing from clobbering shared `model_cost` pricing - [PR #32163](https://github.com/BerriAI/litellm/pull/32163)

## LLM API Endpoints

#### Features

- **[Responses API](../../docs/response_api)**
    - Preserve custom-tool round-trips and allowlists for the Codex CLI in the responses bridge - [PR #32258](https://github.com/BerriAI/litellm/pull/32258)
    - Preserve `reasoning_tokens` through the chat -> responses usage translation - [PR #32837](https://github.com/BerriAI/litellm/pull/32837)
- **[Pass-through](../../docs/pass_through)**
    - Stream non-SSE pass-through responses instead of buffering them in memory - [PR #32386](https://github.com/BerriAI/litellm/pull/32386)
- **General**
    - Merge websearch tool params - [PR #32162](https://github.com/BerriAI/litellm/pull/32162)
    - Stamp `completion_start_time` on the first chunk for `/v1/messages` and `/v1/responses` - [PR #32284](https://github.com/BerriAI/litellm/pull/32284)

#### Bugs

- **[Responses API](../../docs/response_api)**
    - Make response-id encoding idempotent to prevent double-encoding - [PR #32034](https://github.com/BerriAI/litellm/pull/32034)
    - Map an upstream 4xx on cancel to a client error instead of a 500, and surface the upstream error status on get - [PR #32271](https://github.com/BerriAI/litellm/pull/32271), [PR #32287](https://github.com/BerriAI/litellm/pull/32287)
    - Raise `APIError` on in-stream error events and widen `ErrorEventError.param` to accept a dict - [PR #32835](https://github.com/BerriAI/litellm/pull/32835)
    - Stop scheduling the sync `success_handler` concurrently with `async_success_handler` - [PR #32239](https://github.com/BerriAI/litellm/pull/32239)
    - Decrypt response ids for `input_items` follow-ups - [PR #32269](https://github.com/BerriAI/litellm/pull/32269)
- **[Rerank](../../docs/rerank)**
    - Log `optional_rerank_params` at debug so request content is not written to logs - [PR #32533](https://github.com/BerriAI/litellm/pull/32533)
- **General**
    - Stop request params from clobbering merged target query params in pass-through - [PR #32404](https://github.com/BerriAI/litellm/pull/32404)

## Management Endpoints / UI

#### Features

- **UI (shadcn / Base UI migration)**
    - Switch the shadcn primitives from Radix to Base UI - [PR #32124](https://github.com/BerriAI/litellm/pull/32124)
    - Add a shared composable DataTable and reskin it onto shadcn table primitives, with a filter drawer, column visibility, and search - [PR #32680](https://github.com/BerriAI/litellm/pull/32680), [PR #32209](https://github.com/BerriAI/litellm/pull/32209), [PR #32856](https://github.com/BerriAI/litellm/pull/32856)
    - shadcn charts foundation with tremor-compatible wrappers and conversion of the caching, projects, activity, usage, and per-user charts to shadcn/recharts - [PR #32668](https://github.com/BerriAI/litellm/pull/32668), [PR #32721](https://github.com/BerriAI/litellm/pull/32721), [PR #32722](https://github.com/BerriAI/litellm/pull/32722), [PR #32725](https://github.com/BerriAI/litellm/pull/32725), [PR #32726](https://github.com/BerriAI/litellm/pull/32726), [PR #32729](https://github.com/BerriAI/litellm/pull/32729)
    - Full-height sidebar shell with a content-scoped top bar, a redesigned account menu, and a shared CopyButton - [PR #32793](https://github.com/BerriAI/litellm/pull/32793), [PR #32931](https://github.com/BerriAI/litellm/pull/32931), [PR #32945](https://github.com/BerriAI/litellm/pull/32945)
    - Typed openapi-fetch foundation (`fetchClient`) with a first typed caller - [PR #29884](https://github.com/BerriAI/litellm/pull/29884)
- **Dashboard**
    - Enterprise license expiry banner on the admin dashboard - [PR #32540](https://github.com/BerriAI/litellm/pull/32540)
    - Session id filter and duration/start-time sort on request logs and the session sidebar - [PR #32568](https://github.com/BerriAI/litellm/pull/32568), [PR #32432](https://github.com/BerriAI/litellm/pull/32432)
    - Cost optimization feedback banner on the models page - [PR #32174](https://github.com/BerriAI/litellm/pull/32174)
    - Expose MCP `max_concurrent_requests` in the server create and edit forms - [PR #32397](https://github.com/BerriAI/litellm/pull/32397)
    - Root the gateway breadcrumb in the AI Gateway selector - [PR #32886](https://github.com/BerriAI/litellm/pull/32886)
    - Back the Redis URL and Database Index UI fields end-to-end - [PR #32075](https://github.com/BerriAI/litellm/pull/32075)
- **Auth & Management**
    - RESTful `PATCH /team/{team_id}` with JSON merge patch semantics, reachable by org admins - [PR #32883](https://github.com/BerriAI/litellm/pull/32883)
    - JWT auth falls back to DB team memberships when the token has no team claims - [PR #31356](https://github.com/BerriAI/litellm/pull/31356)
    - `lite auth print-token` for Claude Code `apiKeyHelper` support - [PR #32846](https://github.com/BerriAI/litellm/pull/32846)
    - Add an `expires` filter to `GET /key/list` - [PR #32953](https://github.com/BerriAI/litellm/pull/32953)
    - Make the Microsoft Graph endpoint configurable for GCC High - [PR #32517](https://github.com/BerriAI/litellm/pull/32517)

#### Bugs

- **UI**
    - Scope the key models dropdown options to the key's team - [PR #32382](https://github.com/BerriAI/litellm/pull/32382)
    - Reflect the persisted "Store Prompts in Spend Logs" toggle on load - [PR #32145](https://github.com/BerriAI/litellm/pull/32145)
    - Prevent the reasoning block from expanding the chat playground layout - [PR #32485](https://github.com/BerriAI/litellm/pull/32485)
    - Rename the Virtual Keys "Key Hash" filter label to "Key ID" - [PR #32672](https://github.com/BerriAI/litellm/pull/32672)
    - Forward refs through UI primitives and fail tests on swallowed refs - [PR #32401](https://github.com/BerriAI/litellm/pull/32401)
    - Strip a trailing slash from `--base-url` in the lite CLI - [PR #32845](https://github.com/BerriAI/litellm/pull/32845)
- **Auth & Management**
    - Surface OAuth error params in the SSO callback - [PR #32433](https://github.com/BerriAI/litellm/pull/32433)
    - Resolve team org from `team_id` so org admins can update team budgets - [PR #32560](https://github.com/BerriAI/litellm/pull/32560)
    - Honor `os.environ/` references for all AWS auth params in DB-sourced models - [PR #32256](https://github.com/BerriAI/litellm/pull/32256)
    - Hash Bearer-prefixed API keys before writing spend logs - [PR #31799](https://github.com/BerriAI/litellm/pull/31799)

## AI Integrations

### Logging

- **[OpenTelemetry](../../docs/observability/opentelemetry_integration)**
    - Stamp `gen_ai.response.time_to_first_chunk` on streaming LLM spans - [PR #32236](https://github.com/BerriAI/litellm/pull/32236)
    - Emit the `gen_ai.client.operation.exception` event on failed LLM calls and restore `error.*` span attributes on v2 error spans - [PR #32655](https://github.com/BerriAI/litellm/pull/32655), [PR #32524](https://github.com/BerriAI/litellm/pull/32524)
    - Move litellm error detail keys under the `litellm.*` namespace - [PR #32591](https://github.com/BerriAI/litellm/pull/32591)
- **[Prometheus](../../docs/proxy/prometheus)**
    - Skip budget metric DB/cache lookups when the gauges are a NoOpMetric - [PR #32834](https://github.com/BerriAI/litellm/pull/32834)
- **[DataDog](../../docs/proxy/logging#datadog)**
    - Split log batches proactively to stay under intake payload limits - [PR #32860](https://github.com/BerriAI/litellm/pull/32860)
- **General**
    - Classify `allm_passthrough_route` as async to prevent duplicate success callbacks - [PR #32265](https://github.com/BerriAI/litellm/pull/32265)
    - Capture `logging_obj` before `post_call_failure_hook` pops it on the streaming ModifyResponseException path - [PR #32665](https://github.com/BerriAI/litellm/pull/32665)

### Guardrails

- **[Model Armor](../../docs/proxy/guardrails/model_armor)**
    - Scan MCP tool calls in `pre_mcp_call` / `during_mcp_call` modes - [PR #32296](https://github.com/BerriAI/litellm/pull/32296)
- **[Content Filter](../../docs/proxy/guardrails)**
    - Add `pre_mcp_call` support to Content Filter - [PR #32936](https://github.com/BerriAI/litellm/pull/32936)
- **[CrowdStrike AIDR](../../docs/proxy/guardrails)**
    - Send only new messages since the last assistant turn - [PR #31974](https://github.com/BerriAI/litellm/pull/31974)
- **[GraySwan](../../docs/proxy/guardrails)**
    - Forward the GraySwan scan id header - [PR #32544](https://github.com/BerriAI/litellm/pull/32544)
- **General**
    - Walk the Responses-API text taxonomy in the shared content helpers - [PR #32542](https://github.com/BerriAI/litellm/pull/32542)
    - Honor `disable_exception_on_block` by raising `ModifyResponseException` for Bedrock guardrails - [PR #32289](https://github.com/BerriAI/litellm/pull/32289)
    - Match a multi-mode `guardrail_mode` without a false-COMPLIANT result - [PR #32832](https://github.com/BerriAI/litellm/pull/32832)
    - Filter the Add-Guardrail mode dropdown per provider - [PR #32712](https://github.com/BerriAI/litellm/pull/32712)
    - Mask credentials embedded in a `guardrail_response` before persisting it - [PR #32687](https://github.com/BerriAI/litellm/pull/32687)
    - Log real token/compression stats on the headroom guardrail - [PR #32158](https://github.com/BerriAI/litellm/pull/32158)

### Secret Managers

- **General**
    - Harden external secret-manager name validation - [PR #32092](https://github.com/BerriAI/litellm/pull/32092)

## Spend Tracking, Budgets and Rate Limiting

- **Budgets**
    - Throttle keys after a spend limit instead of revoking access - [PR #31300](https://github.com/BerriAI/litellm/pull/31300)
    - Resolve team org from `team_id` so org admins can update team budgets - [PR #32560](https://github.com/BerriAI/litellm/pull/32560)
- **Rate Limiting**
    - Per-tag RPM limiting on a single key - [PR #31502](https://github.com/BerriAI/litellm/pull/31502)
    - Separate ITPM/OTPM deployment rate limits on the router - [PR #31952](https://github.com/BerriAI/litellm/pull/31952)
    - Trigger gateway fallbacks on local rate limit errors - [PR #31788](https://github.com/BerriAI/litellm/pull/31788)
    - Populate `x-ratelimit-*` remaining/limit values in the standard logging object for streaming - [PR #32711](https://github.com/BerriAI/litellm/pull/32711)
- **Cost Tracking**
    - Enforce budget and cost tracking for Dashscope tiered pricing - [PR #32942](https://github.com/BerriAI/litellm/pull/32942)
    - Price Anthropic pass-through message batches correctly in the batch cost job - [PR #32307](https://github.com/BerriAI/litellm/pull/32307)
    - Filter `/global/spend/report` by `team_id` when `group_by=team` - [PR #32170](https://github.com/BerriAI/litellm/pull/32170)
    - Sum multi-round session cost in the logs UI, and bound the logs-tab pagination count - [PR #32796](https://github.com/BerriAI/litellm/pull/32796), [PR #31825](https://github.com/BerriAI/litellm/pull/31825)
    - Honor `store_prompts_in_spend_logs` for `guardrail_information` - [PR #32688](https://github.com/BerriAI/litellm/pull/32688)

## MCP Gateway

- **Client-Forwarded Credentials (`true_passthrough` / `oauth_delegate` / `dcr_bridge`)**
    - Add the `true_passthrough` and `oauth_delegate` auth modes, with upstream OAuth discovery bound to each server - [PR #31989](https://github.com/BerriAI/litellm/pull/31989), [PR #32414](https://github.com/BerriAI/litellm/pull/32414)
    - Add the `dcr_bridge` column and plumbing, a sealed-envelope module for client-held credentials, and the discovery facade plus register/token relay with mandatory PKCE S256 - [PR #32745](https://github.com/BerriAI/litellm/pull/32745), [PR #32748](https://github.com/BerriAI/litellm/pull/32748), [PR #32753](https://github.com/BerriAI/litellm/pull/32753), [PR #32747](https://github.com/BerriAI/litellm/pull/32747)
    - Admit `dcr_bridge` `oauth_delegate` clients via a single envelope bearer, with consumer helpers for key derivation - [PR #32824](https://github.com/BerriAI/litellm/pull/32824), [PR #32794](https://github.com/BerriAI/litellm/pull/32794)
    - Relay an upstream 401 on client-forwarded pass-through tool calls - [PR #32556](https://github.com/BerriAI/litellm/pull/32556)
- **OAuth 2.0 (On-Behalf-Of)**
    - `oauth2_token_exchange` auth type via the REST API and dashboard, plus an `entra_obo` token_exchange profile selectable in the UI and API - [PR #31772](https://github.com/BerriAI/litellm/pull/31772), [PR #31983](https://github.com/BerriAI/litellm/pull/31983), [PR #32144](https://github.com/BerriAI/litellm/pull/32144)
    - Persist `oauth2_flow` explicitly on create, backfill legacy null rows on startup, and read it verbatim from DB rows - [PR #32288](https://github.com/BerriAI/litellm/pull/32288), [PR #32290](https://github.com/BerriAI/litellm/pull/32290), [PR #32292](https://github.com/BerriAI/litellm/pull/32292)
    - Add an OAuth flow selector on the MCP edit page - [PR #32298](https://github.com/BerriAI/litellm/pull/32298)
    - Apply the outbound concurrency limit to OBO tool calls - [PR #32071](https://github.com/BerriAI/litellm/pull/32071)
- **Semantic Filter**
    - Apply the semantic filter to expanded `litellm_proxy` tools and show the filtered-out count - [PR #32285](https://github.com/BerriAI/litellm/pull/32285)
    - Keep tool names whole in the filter response header - [PR #32282](https://github.com/BerriAI/litellm/pull/32282)
    - Fail closed and surface semantic-filter context-window errors - [PR #32715](https://github.com/BerriAI/litellm/pull/32715)
- **Bug Fixes**
    - Log MCP tool calls returning `isError=true` as failures - [PR #32238](https://github.com/BerriAI/litellm/pull/32238)
    - Re-register a DCR client when the proxy origin no longer matches its registered `redirect_uri` - [PR #32527](https://github.com/BerriAI/litellm/pull/32527)
    - Invalidate a browser-authorized upstream token when a mint-relevant field changes - [PR #32652](https://github.com/BerriAI/litellm/pull/32652)
    - Defer the proxy import so `completion(tools=...)` works without proxy extras - [PR #32339](https://github.com/BerriAI/litellm/pull/32339)
    - Alias/display-name tool routing, REST filters, and BYOK auth - [PR #32320](https://github.com/BerriAI/litellm/pull/32320)

## Performance / Loadbalancing / Reliability improvements

- **Routing**
    - Keyword tier overrides and semantic keyword matching for the complexity auto router - [PR #32859](https://github.com/BerriAI/litellm/pull/32859)
    - Optional LLM-based classifier for the complexity router, plus custom technical keywords and per-decision routing logs - [PR #32169](https://github.com/BerriAI/litellm/pull/32169), [PR #32262](https://github.com/BerriAI/litellm/pull/32262), [PR #32943](https://github.com/BerriAI/litellm/pull/32943)
- **Reliability**
    - Recover the Prisma DB reconnect loop when the client is disconnected - [PR #32323](https://github.com/BerriAI/litellm/pull/32323)
    - Configure a coordination Redis independently of the response cache, building the usage cache from `REDIS_*` env - [PR #32661](https://github.com/BerriAI/litellm/pull/32661), [PR #32635](https://github.com/BerriAI/litellm/pull/32635)
    - Only use `SSLConnection` when ssl is truthy in the connection-pool kwargs - [PR #32825](https://github.com/BerriAI/litellm/pull/32825)
    - Keep the Prometheus `/metrics` Mount in the gateway route trim - [PR #32317](https://github.com/BerriAI/litellm/pull/32317)
    - Wire the `general_settings` request allowlist to litellm globals - [PR #32243](https://github.com/BerriAI/litellm/pull/32243)
- **Hot paths**
    - Negative-cache missing user/key lookups on the request hot path - [PR #32368](https://github.com/BerriAI/litellm/pull/32368)
    - Stop `CacheCodec` dropping null fields on a cache round-trip - [PR #32207](https://github.com/BerriAI/litellm/pull/32207)

## Documentation Updates

- Point OSS contributors at the daily OSS branch - [PR #32830](https://github.com/BerriAI/litellm/pull/32830)

### PR roll-up by ownership area

PRs by ownership area (total: 240)

- Other (CI / chore / tests / refactors / version bumps): 56
- UI: 42
- MCP: 36
- Models & Providers: 31
- Performance: 14
- Spend / Budgets / Rate Limits: 13
- LLM API Endpoints: 13
- Guardrails: 10
- Auth & Management: 9
- Logging: 9
- Docs: 6
- Secret Managers: 1

## New Contributors

- @thibault-linktree made their first contribution in [PR #32034](https://github.com/BerriAI/litellm/pull/32034)
- @akapur99 made their first contribution in [PR #32829](https://github.com/BerriAI/litellm/pull/32829)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.92.0-rc.1...v1.93.0-rc.1
