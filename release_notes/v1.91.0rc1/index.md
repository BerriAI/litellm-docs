---
title: "v1.91.0rc1 - MCP OAuth v2, Rust OCR Gateway & Realtime Performance"
slug: "v1-91-0-rc-1"
date: 2026-06-27T20:13:02
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
docker.litellm.ai/berriai/litellm:1.91.0-rc.1
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.91.0rc1
```

</TabItem>
</Tabs>

## Key Highlights

`v1.91.0rc1` is the current release candidate for 1.91.0.

- **MCP Gateway OAuth 2.0 v2 resolver** - a new shared OAuth token foundation with cross-replica single-flight refresh, an outbound-credentials package with typed results, and the first authorization_code migration onto the v2 resolver.
- **Rust OCR gateway** - a new LiteLLM Rust workspace ships an async-first Mistral OCR bridge, packaged directly into the LiteLLM wheel, alongside an experimental Axum-based realtime AI gateway.
- **Realtime API performance** - upstream connection-pool pre-warming and client-disconnect cancellation cut session-establishment latency and stop wasted upstream work.
- **Least-privilege MCP defaults** - team keys can now default to least-privilege MCP access, scope to zero MCP servers via a sentinel, and harden client-IP resolution with trusted X-Forwarded-For hop counts.
- **~48 new models** - a large Cloudflare Workers AI batch, Gemini 3 image models, Mistral Medium 3.5 / OCR 3 & 4, GLM/zai, SambaNova, and AI/ML image models.

## New Providers and Endpoints

### New Providers (2 new providers)

| Provider | Supported LiteLLM Endpoints | Description |
| --- | --- | --- |
| Amazon Bedrock Mantle (`bedrock_mantle`) | Chat Completions | Bedrock Mantle support with VPC endpoint routing via `api_base`, surfaced as its own Add Model provider - [PR #31034](https://github.com/BerriAI/litellm/pull/31034), [PR #31141](https://github.com/BerriAI/litellm/pull/31141) |
| OpenSandbox (`opensandbox`) | Sandbox / code interpreter | New sandbox provider for the code-interpreter loop - [PR #31024](https://github.com/BerriAI/litellm/pull/31024) |

### New LLM API Endpoints

| Capability | Description | Documentation |
| --- | --- | --- |
| Rust OCR (Mistral) | A new LiteLLM Rust workspace ships an async-first Mistral OCR bridge, packaged into the LiteLLM wheel - [PR #31033](https://github.com/BerriAI/litellm/pull/31033), [PR #31253](https://github.com/BerriAI/litellm/pull/31253), [PR #31267](https://github.com/BerriAI/litellm/pull/31267) | [OCR](../../docs/ocr) |
| Code interpreter | Sandbox code-interpreter interceptor on the Responses API and a chat-completions code-interpreter loop - [PR #30905](https://github.com/BerriAI/litellm/pull/30905), [PR #31027](https://github.com/BerriAI/litellm/pull/31027) | [Sandbox](../../docs/sandbox) |

## New Models / Updated Models

#### New Model Support (~48 new models)

| Provider | Model | Context | Input ($/1M) | Output ($/1M) | Features |
| --- | --- | --- | --- | --- | --- |
| Gemini / Vertex AI | `gemini-3-pro-image`, `gemini-3.1-flash-image` (+ `gemini/`, `vertex_ai/` variants) | 1M | per-image | per-image | Image generation, GA pricing |
| AI/ML | `aiml/openai/gpt-image-2` | - | per-image | per-image | Image generation |
| Cloudflare Workers AI | ~28 text-generation models (Llama 3.x/4, Qwen 2.5/3/QwQ, GLM 4.7/5.2, Kimi K2.6/K2.7, gpt-oss 20b/120b, Gemma, Granite, Nemotron, DeepSeek-R1 distill, Mistral, Llama Guard) | varies | varies | varies | Native Workers AI via OpenAI-compatible endpoint |
| Mistral | `mistral-medium-2508`, `mistral-medium-2604`, `mistral-medium-latest` (Medium 3.5), `mistral-ocr-2512` (OCR 3), `mistral-ocr-4-0` (OCR 4) | varies | varies | varies | Chat, OCR |
| SambaNova | `sambanova/DeepSeek-V3.2`, `sambanova/gemma-4-31B-it` | varies | varies | varies | Chat |
| zai / OpenRouter | `zai/glm-4.7-flash`, `zai/glm-5.1`, `openrouter/z-ai/glm-5.1` | varies | varies | varies | Chat |
| Bedrock | `amazon.titan-embed-g1-text-02` | - | embedding | - | Embeddings |
| Darkbloom | `darkbloom/gemma-4-26b`, `darkbloom/gpt-oss-20b` | varies | varies | varies | Chat |

Exact per-model context windows and prices are in `model_prices_and_context_window.json`.

#### Features

- **[Fireworks AI](../../docs/providers/fireworks_ai)**
    - Sync chat completions endpoint with the full Fireworks API surface - [PR #30885](https://github.com/BerriAI/litellm/pull/30885)
- **[Cloudflare](../../docs/providers/cloudflare)**
    - Add current Workers AI text-generation models to the cost map - [PR #31051](https://github.com/BerriAI/litellm/pull/31051)
    - Route the native Workers AI provider through the OpenAI-compatible endpoint - [PR #31053](https://github.com/BerriAI/litellm/pull/31053)
- **[Mistral](../../docs/providers/mistral)**
    - Support Mistral OCR 4 (`mistral-ocr-4-0`) - [PR #31353](https://github.com/BerriAI/litellm/pull/31353)
    - Add `mistral/mistral-ocr-2512` (OCR 3) to the cost map - [PR #31463](https://github.com/BerriAI/litellm/pull/31463)
    - Retarget `mistral-medium-latest` to Medium 3.5 and add date-pinned aliases - [PR #31373](https://github.com/BerriAI/litellm/pull/31373)
- **[AI/ML](../../docs/providers/aiml_api)**
    - Add the `openai/gpt-image-2` image model - [PR #31323](https://github.com/BerriAI/litellm/pull/31323)
- **[Rerank](../../docs/rerank)**
    - Rerank transformation refresh across ~15 providers (Cohere v1/v2, Voyage, Jina, Vertex, Bedrock, Hugging Face, hosted vLLM, DashScope, DeepInfra, NVIDIA NIM, Fireworks, Watsonx) - [PR #31185](https://github.com/BerriAI/litellm/pull/31185)
- **[DeepSeek](../../docs/providers/deepseek)** / **[GitHub Copilot](../../docs/providers/github_copilot)** / **[Moonshot](../../docs/providers/moonshot)**
    - Chat transformation updates - [PR #31185](https://github.com/BerriAI/litellm/pull/31185)

#### Bug Fixes

- **[Anthropic](../../docs/providers/anthropic)**
    - Sanitize `tool_use` ids on the native `/v1/messages` path - [PR #31094](https://github.com/BerriAI/litellm/pull/31094)
    - Drop the unsupported `speed` param under `drop_params` - [PR #31152](https://github.com/BerriAI/litellm/pull/31152)
    - Normalize the Messages `system` role and adaptive-thinking for Claude Invoke - [PR #31364](https://github.com/BerriAI/litellm/pull/31364)
- **[Bedrock](../../docs/providers/bedrock)**
    - Only expand config-sourced AWS credential references - [PR #30867](https://github.com/BerriAI/litellm/pull/30867)
    - Prevent key-level `metadata.tags` from leaking into the Bedrock passthrough body - [PR #30985](https://github.com/BerriAI/litellm/pull/30985)
    - Surface web-identity token `aud`/`iss` on `InvalidIdentityToken` - [PR #31412](https://github.com/BerriAI/litellm/pull/31412)
- **[Vertex AI](../../docs/providers/vertex)**
    - Prevent a stale Vertex bearer token from causing a `/v1/messages` 401 after token expiry - [PR #31276](https://github.com/BerriAI/litellm/pull/31276)
    - Append the `rawPredict` suffix for a custom `api_base` - [PR #31529](https://github.com/BerriAI/litellm/pull/31529)

## LLM API Endpoints

#### Features

- **[Responses API](../../docs/response_api)**
    - Code-interpreter interceptor (sandbox) on the Responses API - [PR #30905](https://github.com/BerriAI/litellm/pull/30905)
    - Chat-completions code-interpreter loop - [PR #31027](https://github.com/BerriAI/litellm/pull/31027)
- **[Realtime API](../../docs/realtime)**
    - Add an OpenAI realtime translation layer to litellm-rust (1/2) - [PR #31129](https://github.com/BerriAI/litellm/pull/31129)
    - Add a minimal Rust router + Axum AI-gateway calling `router.realtime` (2/2) - [PR #31135](https://github.com/BerriAI/litellm/pull/31135)
- **OCR**
    - Make the Rust OCR bridge async-first - [PR #31253](https://github.com/BerriAI/litellm/pull/31253)
    - Add Rust OCR providers - [PR #31272](https://github.com/BerriAI/litellm/pull/31272)
    - Thin Rust OCR Python bridge - [PR #31368](https://github.com/BerriAI/litellm/pull/31368)
- **[Batches](../../docs/batches)**
    - Stream OpenAI to Vertex batch JSONL uploads - [PR #31036](https://github.com/BerriAI/litellm/pull/31036)
- **[Pass-through](../../docs/pass_through)**
    - Forward all multipart files with repeated field names - [PR #31391](https://github.com/BerriAI/litellm/pull/31391)
    - Schedule spend logging via the durable logging worker - [PR #31485](https://github.com/BerriAI/litellm/pull/31485)
- **Web Search**
    - Sync `tool_choice` when converting `web_search` tools - [PR #31375](https://github.com/BerriAI/litellm/pull/31375)
    - Wrap the agentic-loop response in a fake stream for streaming requests - [PR #31484](https://github.com/BerriAI/litellm/pull/31484)

#### Bugs

- **[Realtime API](../../docs/realtime)**
    - Fix post-tool-call `function_response` id omission - [PR #30446](https://github.com/BerriAI/litellm/pull/30446)
    - Stop revalidating realtime events at the logging boundary - [PR #31054](https://github.com/BerriAI/litellm/pull/31054)
- **General**
    - Skip the model override when the response has no `model` field - [PR #31183](https://github.com/BerriAI/litellm/pull/31183)
    - Recover cost on interrupted and agentic Anthropic streams - [PR #31035](https://github.com/BerriAI/litellm/pull/31035)

## Management Endpoints / UI

#### Features

- **Virtual Keys & Teams**
    - Scope team BYOK models by key `team_id` in `/model/info` - [PR #31009](https://github.com/BerriAI/litellm/pull/31009)
    - Restore wildcard expansion in `/v1/model/info` - [PR #31444](https://github.com/BerriAI/litellm/pull/31444)
    - Expand the all-proxy-models sentinel in direct-access lookup - [PR #31153](https://github.com/BerriAI/litellm/pull/31153)
    - Persist `budget_duration` on `/team/member_add` member budgets - [PR #31443](https://github.com/BerriAI/litellm/pull/31443)
    - Persist budget-window deletion on virtual keys - [PR #31107](https://github.com/BerriAI/litellm/pull/31107)
- **SCIM**
    - Ingest enterprise-extension attributes into user metadata - [PR #30893](https://github.com/BerriAI/litellm/pull/30893)
    - Drive the global proxy role from a SCIM admin group - [PR #30895](https://github.com/BerriAI/litellm/pull/30895)
- **Proxy CLI / Auth**
    - Mint a per-session agent credential on `lite login` - [PR #31072](https://github.com/BerriAI/litellm/pull/31072)
- **Config & Plugins**
    - LiteLLM plugin architecture v2 - [PR #30688](https://github.com/BerriAI/litellm/pull/30688)
    - Persist the global `retry_policy` via `/config/update` - [PR #29540](https://github.com/BerriAI/litellm/pull/29540)
    - Tighten role-based visibility of config and MCP fields - [PR #30587](https://github.com/BerriAI/litellm/pull/30587)
- **UI**
    - Show an agent's attached virtual key in the UI - [PR #29619](https://github.com/BerriAI/litellm/pull/29619)
    - Add Amazon Bedrock Mantle to the Add Model provider dropdown - [PR #31034](https://github.com/BerriAI/litellm/pull/31034)
    - Clarify OpenAI-compatible provider dropdown labels (chat vs legacy completions) - [PR #31046](https://github.com/BerriAI/litellm/pull/31046)
    - Render logos under a custom `server_root_path` - [PR #31156](https://github.com/BerriAI/litellm/pull/31156)

#### Bugs

- **UI**
    - Keep team Organization optional for proxy admins in single-org setups - [PR #30861](https://github.com/BerriAI/litellm/pull/30861)
    - Stop per-model usage export from duplicating user spend across models - [PR #30980](https://github.com/BerriAI/litellm/pull/30980)
    - Resolve `user_id` to email in the Spend Per User usage chart - [PR #30992](https://github.com/BerriAI/litellm/pull/30992)
    - Label the request-logs column "Key Alias" to match the filter - [PR #31037](https://github.com/BerriAI/litellm/pull/31037)
    - Stop listing `bedrock_mantle` models under the Bedrock provider - [PR #31478](https://github.com/BerriAI/litellm/pull/31478)
- **Auth & Management**
    - Resolve caller identity once into a Principal at the auth seam - [PR #30887](https://github.com/BerriAI/litellm/pull/30887)
    - Cache the auth-path team object under the canonical `team_id` key - [PR #31418](https://github.com/BerriAI/litellm/pull/31418)
    - Honor `user_api_key_cache_ttl` for management-object cache writes - [PR #31504](https://github.com/BerriAI/litellm/pull/31504)
    - Reject `model_list` in the proxy body and gate advisor client credentials - [PR #30585](https://github.com/BerriAI/litellm/pull/30585)
    - Redact the API key from `key/info` client error messages - [PR #31342](https://github.com/BerriAI/litellm/pull/31342)
    - Stop double-decrypting email/slack alerting env vars in `get_config` - [PR #31117](https://github.com/BerriAI/litellm/pull/31117)
    - Serialize team `budget_limits` to JSON in `jsonify_team_object` - [PR #31045](https://github.com/BerriAI/litellm/pull/31045)
    - Block a server credential leak to a caller-supplied `api_base` - [PR #30682](https://github.com/BerriAI/litellm/pull/30682)

## AI Integrations

### Logging

- **[Prometheus](../../docs/proxy/prometheus)**
    - Add a `requested_model` label to spend and request metrics - [PR #31410](https://github.com/BerriAI/litellm/pull/31410)
    - Add a per-team `litellm_team_members_metric` gauge - [PR #31506](https://github.com/BerriAI/litellm/pull/31506)
- **[OpenTelemetry](../../docs/observability/opentelemetry_integration)**
    - Resolve the `LITELLM_OTEL_V2` flag once instead of rebuilding settings per call - [PR #30989](https://github.com/BerriAI/litellm/pull/30989)
    - Use a hashable scope for `_emit_once` when `guardrail_mode` is a list - [PR #31262](https://github.com/BerriAI/litellm/pull/31262)
    - Point the AgentOps OTLP exporter at `otlp.agentops.ai` - [PR #31490](https://github.com/BerriAI/litellm/pull/31490)
- **General**
    - Add `POST /v1/callbacks/logs` to replay logging payloads through callbacks - [PR #31134](https://github.com/BerriAI/litellm/pull/31134)

### Guardrails

- **[Bedrock Guardrails](../../docs/proxy/guardrails)**
    - Select the latest user message by original role in `apply_guardrail` - [PR #30482](https://github.com/BerriAI/litellm/pull/30482)
- **General**
    - Add a headroom guardrail for message compression - [PR #31407](https://github.com/BerriAI/litellm/pull/31407)
    - Instrument during-call and post-call guardrail latency - [PR #31414](https://github.com/BerriAI/litellm/pull/31414)
    - Match the policy-pipeline block response to a direct guardrail attachment - [PR #31421](https://github.com/BerriAI/litellm/pull/31421)
    - Make the Generic Guardrail resilient to built-in tools and errors - [PR #31461](https://github.com/BerriAI/litellm/pull/31461)

## Spend Tracking, Budgets and Rate Limiting

- **Cost tracking**
    - Store `litellm_call_id` on spend logs for DB-to-trace correlation - [PR #31344](https://github.com/BerriAI/litellm/pull/31344)
    - Preserve Anthropic `server_tool_use` web-search usage in cost tracking - [PR #31355](https://github.com/BerriAI/litellm/pull/31355)
    - Restore per-query Gemini 3.x web-search billing - [PR #31363](https://github.com/BerriAI/litellm/pull/31363)
    - Preserve Gemini Embedding 2 `usageMetadata` for cost tracking - [PR #31354](https://github.com/BerriAI/litellm/pull/31354)
    - Correct the regional processing uplift to the gpt-5.4/5.5 series only - [PR #31136](https://github.com/BerriAI/litellm/pull/31136)
    - Isolate all per-deployment pricing overrides from sibling deployments - [PR #31021](https://github.com/BerriAI/litellm/pull/31021)
- **Spend UI and endpoints**
    - Fold the logs-tab total into the page query to avoid a separate `COUNT(*)` - [PR #31423](https://github.com/BerriAI/litellm/pull/31423)
    - Spend-management endpoint and OpenAI image-generation cost-calculator updates - [PR #31185](https://github.com/BerriAI/litellm/pull/31185)

## MCP Gateway

- **OAuth 2.0 v2 resolver**
    - Shared OAuth token foundation: challenge, store seam, expiry-aware cache, single-flight refresh - [PR #31275](https://github.com/BerriAI/litellm/pull/31275)
    - Scaffold the `outbound_credentials` package with a typed Result - [PR #31047](https://github.com/BerriAI/litellm/pull/31047)
    - Add a `resolve_credentials` dispatch skeleton - [PR #31056](https://github.com/BerriAI/litellm/pull/31056)
    - Graft the v2 resolver onto `_create_mcp_client` (none + api_key static family) - [PR #31058](https://github.com/BerriAI/litellm/pull/31058)
    - Migrate authorization_code MCP to the v2 resolver (single-replica) [1/2] - [PR #31473](https://github.com/BerriAI/litellm/pull/31473)
    - Cross-replica single-flight refresh for the v2 per-user OAuth store [2/2] - [PR #31493](https://github.com/BerriAI/litellm/pull/31493)
    - Challenge delegate-auth OAuth servers with upstream `resource_metadata` - [PR #31255](https://github.com/BerriAI/litellm/pull/31255)
- **Access control**
    - Opt-in least-privilege default for team-key MCP access - [PR #31380](https://github.com/BerriAI/litellm/pull/31380)
    - Scope a key to zero MCP servers with a no-mcp-servers sentinel - [PR #31029](https://github.com/BerriAI/litellm/pull/31029)
    - Allow `llm_api_routes` virtual keys to list MCP tools via `/v1/mcp/tools` - [PR #31031](https://github.com/BerriAI/litellm/pull/31031)
    - Let proxy admins assign MCP servers to teamless keys - [PR #31126](https://github.com/BerriAI/litellm/pull/31126)
    - Resolve config-defined servers in per-user credential and env-var endpoints - [PR #31171](https://github.com/BerriAI/litellm/pull/31171)
- **X-Forwarded-For hardening**
    - Add `mcp_xff_num_trusted_hops` to harden X-Forwarded-For client-IP resolution - [PR #31257](https://github.com/BerriAI/litellm/pull/31257)
    - Correct the misleading no-trusted-proxy warning for XFF access control - [PR #31264](https://github.com/BerriAI/litellm/pull/31264)
    - Warn loudly when X-Forwarded-For is present but `use_x_forwarded_for` is off - [PR #31266](https://github.com/BerriAI/litellm/pull/31266)
- **Bug fixes**
    - Stop exposing MCP server URLs on the AI Hub and public hub API - [PR #30902](https://github.com/BerriAI/litellm/pull/30902)
    - Stop auth failures on the `/mcp` path surfacing as cancelled tool calls - [PR #31011](https://github.com/BerriAI/litellm/pull/31011)
    - Resolve toolset tools by the server's known prefix - [PR #31254](https://github.com/BerriAI/litellm/pull/31254)
    - Stop logging tool-call input in the MCP client - [PR #31393](https://github.com/BerriAI/litellm/pull/31393)

## Performance / Loadbalancing / Reliability improvements

- **Streaming and realtime**
    - Pre-warm the upstream realtime connection pool to cut session-establishment latency - [PR #31163](https://github.com/BerriAI/litellm/pull/31163)
    - Cancel the upstream LLM stream when the client disconnects during time-to-first-token - [PR #31499](https://github.com/BerriAI/litellm/pull/31499)
    - Word-sliced cache replay for `stream=true` cache hits - [PR #30216](https://github.com/BerriAI/litellm/pull/30216)
    - Stop the O(n^2) re-parse of accumulated Gemini stream JSON - [PR #31297](https://github.com/BerriAI/litellm/pull/31297)
    - Surface a clean `RateLimitError` on a mid-stream 429 with no fallbacks - [PR #31298](https://github.com/BerriAI/litellm/pull/31298)
- **Router and timeouts**
    - Honor `litellm_settings.request_timeout` as an independent per-attempt timeout - [PR #31119](https://github.com/BerriAI/litellm/pull/31119)
    - Guard `num_retries=None` in `async_function_with_retries` - [PR #30036](https://github.com/BerriAI/litellm/pull/30036)
- **Caching and proxy**
    - Apply the Redis namespace to all key operations - [PR #31288](https://github.com/BerriAI/litellm/pull/31288)
    - Loop-scope async Lua script registration - [PR #31501](https://github.com/BerriAI/litellm/pull/31501)
    - Memoize `_get_all_llm_api_params`, rebuilt per request - [PR #31430](https://github.com/BerriAI/litellm/pull/31430)
    - Precompute service-tier cost-key suffixes - [PR #31431](https://github.com/BerriAI/litellm/pull/31431)
    - Bound event-loop blocking from oversized requests - [PR #31497](https://github.com/BerriAI/litellm/pull/31497)
    - Stop the pass-through route registry growing on every reload - [PR #31314](https://github.com/BerriAI/litellm/pull/31314)
    - Strip NUL bytes in `safe_dumps` only when present - [PR #31424](https://github.com/BerriAI/litellm/pull/31424)
    - Semantic-caching (Redis/Qdrant) and embedding-router updates - [PR #31305](https://github.com/BerriAI/litellm/pull/31305)
- **Supply chain and build**
    - Bump osv-flagged dependencies to clear known CVEs - [PR #31122](https://github.com/BerriAI/litellm/pull/31122)
    - Bump the wolfi-base digest to patch openssl CVE-2026-34182 - [PR #31133](https://github.com/BerriAI/litellm/pull/31133)
    - Add a Grype image scan for OS and library CVEs - [PR #31151](https://github.com/BerriAI/litellm/pull/31151)
    - Harden cargo fetches during maturin builds - [PR #31348](https://github.com/BerriAI/litellm/pull/31348)
    - Build the Admin UI from source in a build-platform-pinned stage - [PR #31130](https://github.com/BerriAI/litellm/pull/31130)

## Documentation Updates

- Add MCP server change guidelines - [PR #31038](https://github.com/BerriAI/litellm/pull/31038)

## New Contributors

This release candidate contains changes from existing maintainers only; there are no new contributors in this window.

## Full Changelog

[`v1.90.0...v1.91.0-rc.1`](https://github.com/BerriAI/litellm/compare/v1.90.0...v1.91.0-rc.1)
