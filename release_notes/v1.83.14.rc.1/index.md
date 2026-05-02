---
title: "v1.83.14.rc.1 - GPT-5.5, Prompt Compression & Memory API"
slug: "v1-83-14-rc-1"
date: 2026-04-27T00:00:00
authors:
  - name: Krrish Dholakia
    title: CEO, LiteLLM
    url: https://www.linkedin.com/in/krish-d/
    image_url: https://pbs.twimg.com/profile_images/1298587542745358340/DZv3Oj-h_400x400.jpg
  - name: Ishaan Jaff
    title: CTO, LiteLLM
    url: https://www.linkedin.com/in/reffajnaahsi/
    image_url: https://pbs.twimg.com/profile_images/1613813310264340481/lz54oEiB_400x400.jpg
  - name: Ryan Crabbe
    title: Full Stack Engineer, LiteLLM
    url: https://www.linkedin.com/in/ryan-crabbe-0b9687214
    image_url: https://github.com/ryan-crabbe.png
  - name: Yuneng Jiang
    title: Senior Full Stack Engineer, LiteLLM
    url: https://www.linkedin.com/in/yuneng-david-jiang-455676139/
    image_url: https://avatars.githubusercontent.com/u/171294688?v=4
  - name: Shivam Rawat
    title: Forward Deployed Engineer, LiteLLM
    url: https://linkedin.com/in/shivam-rawat-482937318
    image_url: https://github.com/shivamrawat1.png
hide_table_of_contents: false
---

## Deploy this version

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
<TabItem value="docker" label="Docker">

```bash
docker run \
-e STORE_MODEL_IN_DB=True \
-p 4000:4000 \
docker.litellm.ai/berriai/litellm:main-v1.83.14.rc.1
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.83.14.rc1
```

</TabItem>
</Tabs>

> This is a release candidate cut on top of `v1.83.10-stable`. Validate on a staging proxy before promoting to the next stable tag.

## Key Highlights

- **Day-0 GPT-5.5 and GPT-5.5 Pro support** — OpenAI and Azure variants ship with full pricing maps, dated snapshots, and Responses-mode routing for the Pro tier.
- **Server-side Prompt Compression** — first-class proxy callback that transparently compresses long-context inputs (Claude Code, RAG, document workloads) before they hit the upstream model, with no client opt-in required.
- **`/v1/memory` CRUD endpoints** — proxy now exposes a memory store API with Prisma-backed metadata, consumed by the new agent loop.
- **LLM-as-a-Judge guardrail** — model-graded post-call guardrail with configurable rubrics, joining the Bedrock / Lakera / Presidio / Noma family.
- **MCP OAuth hardening** — discoverable + BYOK authorize/token endpoints are tightened, temporary OAuth sessions are now shared across proxy instances via Redis, and per-server access policy is uniformly enforced across the proxy and broker.
- **Per-member team budgets land in production** — individual member budgets, per-member cycle surfacing in the Teams UI, and atomic counter alignment for user/org spend checks.
- **Adaptive routing** — opt-in router policy that weights deployments by recent latency/error history on top of the existing wildcard fallback.

---

## New Models / Updated Models

#### New Model Support (22 new models)

| Provider     | Model                                                                                  | Context Window | Input ($/1M tokens) | Output ($/1M tokens) | Mode             |
| ------------ | -------------------------------------------------------------------------------------- | -------------- | ------------------- | -------------------- | ---------------- |
| OpenAI       | `gpt-5.5`, `gpt-5.5-2026-04-23`                                                        | 1,050,000      | $5.00               | $30.00               | chat             |
| OpenAI       | `gpt-5.5-pro`, `gpt-5.5-pro-2026-04-23`                                                | 1,050,000      | $60.00              | $360.00              | responses        |
| OpenAI       | `gpt-5.4-mini-2026-03-17`                                                              | 272,000        | $0.75               | $4.50                | chat             |
| OpenAI       | `gpt-5.4-nano-2026-03-17`                                                              | 272,000        | $0.20               | $1.25                | chat             |
| Azure OpenAI | `azure/gpt-5.5`, `azure/gpt-5.5-2026-04-23`                                            | 1,050,000      | $5.00               | $30.00               | chat             |
| Azure OpenAI | `azure/gpt-5.5-pro`, `azure/gpt-5.5-pro-2026-04-23`                                    | 1,050,000      | $60.00              | $360.00              | responses        |
| Azure OpenAI | `azure/gpt-5.4-mini-2026-03-17`                                                        | 1,050,000      | $0.75               | $4.50                | chat             |
| Azure OpenAI | `azure/gpt-5.4-nano-2026-03-17`                                                        | 1,050,000      | $0.20               | $1.25                | chat             |
| AWS Bedrock  | `anthropic.claude-mythos-preview`                                                      | 1,000,000      | -                   | -                    | chat             |
| AWS Bedrock  | `bedrock/us-east-1/zai.glm-5`, `bedrock/us-west-2/zai.glm-5`                           | 200,000        | $1.00               | $3.20                | chat             |
| AWS Bedrock  | `bedrock/us-east-1/minimax.minimax-m2.5`, `bedrock/us-west-2/minimax.minimax-m2.5`     | -              | -                   | -                    | chat             |
| Moonshot     | `moonshot/kimi-k2.6`                                                                   | 262,144        | $0.95               | $4.00                | chat             |
| OpenRouter   | `openrouter/anthropic/claude-opus-4.7`                                                 | 1,000,000      | $5.00               | $25.00               | chat             |
| Gemini       | `gemini/gemini-embedding-2`, `gemini-embedding-2`, `vertex_ai/gemini-embedding-2`      | 8,192          | $0.20               | -                    | embedding        |
| DashScope    | `dashscope/qwen-image-2.0`, `dashscope/qwen-image-2.0-pro`                             | -              | -                   | -                    | image_generation |

#### Features

- **[Bedrock](../../docs/providers/bedrock)**
    - Add GLM-5 and Minimax M2.5 entries with regional aliases - [PR #24423](https://github.com/BerriAI/litellm/pull/24423)
    - Day-0 support for Claude Mythos Preview via the `bedrock-mantle` endpoint - [PR #26196](https://github.com/BerriAI/litellm/pull/26196)
    - Allowlist Bedrock Invoke body fields and filter all `anthropic-beta` values - [PR #26148](https://github.com/BerriAI/litellm/pull/26148)
- **[OpenAI](../../docs/providers/openai)**
    - Versioned GPT-5.4 mini / nano snapshots - [PR #26115](https://github.com/BerriAI/litellm/pull/26115)
    - Add `gpt-5.5` and `gpt-5.5-pro` to the model cost map - [PR #26345](https://github.com/BerriAI/litellm/pull/26345), [PR #26348](https://github.com/BerriAI/litellm/pull/26348)
    - Day-0 support for GPT-5.5 and GPT-5.5 Pro - [PR #26449](https://github.com/BerriAI/litellm/pull/26449)
- **[Azure OpenAI](../../docs/providers/azure)**
    - `azure/gpt-5.5` + `azure/gpt-5.5-pro` entries with dated variants - [PR #26361](https://github.com/BerriAI/litellm/pull/26361)
- **[Gemini](../../docs/providers/gemini)**
    - Gemini Embedding 2 GA: cost map, blog, and tests - [PR #26391](https://github.com/BerriAI/litellm/pull/26391)
    - Expand `VideoMetadata` support to all Gemini models - [PR #25767](https://github.com/BerriAI/litellm/pull/25767)
- **[Vertex AI](../../docs/providers/vertex)**
    - Multi-region Vertex hosts (`aiplatform.*.rep.googleapis.com`) - [PR #26281](https://github.com/BerriAI/litellm/pull/26281)
- **[DashScope](../../docs/providers/dashscope)**
    - Image generation support for `qwen-image-2.0` and `qwen-image-2.0-pro` - [PR #25672](https://github.com/BerriAI/litellm/pull/25672)
- **[Moonshot](../../docs/providers/moonshot)**
    - Add `moonshot/kimi-k2.6` to the model registry - [PR #26203](https://github.com/BerriAI/litellm/pull/26203)
- **[Anthropic](../../docs/providers/anthropic)**
    - Migrate retired `claude-3-haiku-20240307` references to `claude-haiku-4-5-20251001` - [PR #26139](https://github.com/BerriAI/litellm/pull/26139)
- **General**
    - Migrate 38 models from legacy `max_tokens` to `max_input_tokens` / `max_output_tokens` - [PR #24422](https://github.com/BerriAI/litellm/pull/24422)

### Bug Fixes

- **[Anthropic](../../docs/providers/anthropic)**
    - Preserve `tool_use` input args in adapter streaming - [PR #24355](https://github.com/BerriAI/litellm/pull/24355)
    - Strip Gemini thought suffix from streaming `tool_use` id - [PR #25935](https://github.com/BerriAI/litellm/pull/25935)
    - Skip non-OpenAI file content blocks in file-id discovery helpers - [PR #26228](https://github.com/BerriAI/litellm/pull/26228)
    - Handle `tool_choice` type `'none'` in messages API - [PR #24457](https://github.com/BerriAI/litellm/pull/24457)
- **[Azure](../../docs/providers/azure)**
    - Preserve `role='assistant'` in streaming with `include_usage` - [PR #24354](https://github.com/BerriAI/litellm/pull/24354)
- **[Bedrock](../../docs/providers/bedrock)**
    - Sort assistant content blocks so text precedes `toolUse` - [PR #24368](https://github.com/BerriAI/litellm/pull/24368)
    - Above-200k token pricing fix for Claude Sonnet/Opus 4.6 + Sonnet 4.6 `max_input_tokens` to 1M - [PR #24164](https://github.com/BerriAI/litellm/pull/24164)
- **[Gemini](../../docs/providers/gemini)**
    - Filter params from embedding requests - [PR #24370](https://github.com/BerriAI/litellm/pull/24370)
    - Read web search cost from `model_info` instead of hardcoding - [PR #24372](https://github.com/BerriAI/litellm/pull/24372)
    - Include DOCUMENT modality tokens in cost calculation - [PR #24410](https://github.com/BerriAI/litellm/pull/24410)
- **[Vertex AI](../../docs/providers/vertex)**
    - Forward `dimensions` parameter in `multimodalembedding` requests - [PR #24415](https://github.com/BerriAI/litellm/pull/24415)
- **[Zhipu / GLM](../../docs/providers/zhipu)**
    - Map non-standard `finish_reason` values - [PR #24373](https://github.com/BerriAI/litellm/pull/24373)
- **[OVHcloud](../../docs/providers/ovhcloud)**
    - Fix tool calling not working - [PR #25948](https://github.com/BerriAI/litellm/pull/25948)
- **[Scaleway](../../docs/providers/scaleway)**
    - Add audio support - [PR #26110](https://github.com/BerriAI/litellm/pull/26110)

---

## LLM API Endpoints

#### Features

- **[Responses API](../../docs/response_api)**
    - Extract shared format mapping between Responses API and Chat Completions bridges - [PR #24417](https://github.com/BerriAI/litellm/pull/24417)
    - `use_chat_completions_api` flag for `openai/` models with custom `api_base` - [PR #25346](https://github.com/BerriAI/litellm/pull/25346)
    - `route_all_chat_openai_to_responses` global flag - [PR #25359](https://github.com/BerriAI/litellm/pull/25359)
    - Strip `custom_tool_call` namespace for all providers - [PR #26221](https://github.com/BerriAI/litellm/pull/26221)
- **[Anthropic Messages API](../../docs/anthropic_unified)**
    - Map `reasoning_auto_summary` to `thinking.display` for native `/v1/messages` - [PR #25883](https://github.com/BerriAI/litellm/pull/25883)
    - Normalize reasoning effort with graceful degradation - [PR #26111](https://github.com/BerriAI/litellm/pull/26111)
- **Memory API**
    - Add `/v1/memory` CRUD endpoints - [PR #26218](https://github.com/BerriAI/litellm/pull/26218)
    - Memory improvements v2 - [PR #26541](https://github.com/BerriAI/litellm/pull/26541)
- **General**
    - Apply GPT-5 temperature validation in Responses API - [PR #24371](https://github.com/BerriAI/litellm/pull/24371)

#### Bugs

- **[Responses API](../../docs/response_api)**
    - Normalize bridged object field - [PR #26327](https://github.com/BerriAI/litellm/pull/26327)
- **[Anthropic Messages API](../../docs/anthropic_unified)**
    - Preserve `anthropic_messages` call type for `/v1/messages` logging - [PR #26248](https://github.com/BerriAI/litellm/pull/26248)
- **[Image API](../../docs/image_generation)**
    - Forward `litellm_params` to `validate_environment` for Vertex AI credentials in `image_edit` - [PR #26160](https://github.com/BerriAI/litellm/pull/26160)
    - Enforce multipart-only file inputs on image edit endpoints - [PR #26293](https://github.com/BerriAI/litellm/pull/26293)
    - Align image URL fetch with the validated HTTP client (Bedrock + token counter paths) - [PR #26272](https://github.com/BerriAI/litellm/pull/26272)
- **[Vector Stores](../../docs/vector_stores)**
    - Restore BYOK key injection for vector store endpoints with team-scoped deployments - [PR #25746](https://github.com/BerriAI/litellm/pull/25746)
    - Respect object-level permissions for managed vector store endpoints - [PR #26351](https://github.com/BerriAI/litellm/pull/26351)
- **Memory API**
    - JSONify metadata before Prisma writes on `/v1/memory` - [PR #26536](https://github.com/BerriAI/litellm/pull/26536)
- **General**
    - Harden pass-through target URL construction - [PR #26467](https://github.com/BerriAI/litellm/pull/26467)

---

## Management Endpoints / UI

#### Features

- **Virtual Keys / Auth**
    - Refresh router after `POST /model/update` - [PR #26427](https://github.com/BerriAI/litellm/pull/26427)
    - Auto-add SSO team members to org on move (proxy admin only) - [PR #26377](https://github.com/BerriAI/litellm/pull/26377)
    - Apply team TPM/RPM + attribution for admins using `x-litellm-team-id` - [PR #26438](https://github.com/BerriAI/litellm/pull/26438)
    - Single-team DB fallback when JWT has no `team_id` - [PR #26418](https://github.com/BerriAI/litellm/pull/26418)
- **UI**
    - "My User" tab on team info page - [PR #26520](https://github.com/BerriAI/litellm/pull/26520)
    - Send Invitation Email toggle on Users tab - [PR #25808](https://github.com/BerriAI/litellm/pull/25808)
    - UI setting to disable `/key/generate` for org admins - [PR #26442](https://github.com/BerriAI/litellm/pull/26442)
    - Sortable Model and TTFT columns on Spend Logs - [PR #26488](https://github.com/BerriAI/litellm/pull/26488)
    - Surface per-member budget cycle in Teams › Members tab - [PR #26207](https://github.com/BerriAI/litellm/pull/26207)
- **Refactor**
    - Move projects management to enterprise package - [PR #25677](https://github.com/BerriAI/litellm/pull/25677)

#### Bugs

- **Virtual Keys / Auth**
    - Centralize `common_checks` to close authorization bypass - [PR #26279](https://github.com/BerriAI/litellm/pull/26279)
    - Tighten caller-permission checks on key route fields - [PR #26492](https://github.com/BerriAI/litellm/pull/26492)
    - Extend caller-permission checks to service-account + tighten raw-body acceptance - [PR #26493](https://github.com/BerriAI/litellm/pull/26493)
    - Enforce `upperbound_key_generate_params` on `/key/regenerate` - [PR #26340](https://github.com/BerriAI/litellm/pull/26340)
    - Preserve `service_account_id` in metadata on `/key/update` - [PR #26004](https://github.com/BerriAI/litellm/pull/26004)
    - Restrict `/global/spend/*` routes to admin roles - [PR #26490](https://github.com/BerriAI/litellm/pull/26490)
    - Harden team metadata handling in `/team/new` and `/team/update` - [PR #26464](https://github.com/BerriAI/litellm/pull/26464)
    - Extend request body parameter restrictions to cloud provider auth fields - [PR #26264](https://github.com/BerriAI/litellm/pull/26264)
    - Enforce format constraints on provider URL parameters - [PR #26287](https://github.com/BerriAI/litellm/pull/26287)
    - Bind RAG ingestion config to stored credential values - [PR #26512](https://github.com/BerriAI/litellm/pull/26512)
    - Broaden RAG ingestion credential cleanup to AWS endpoint/identity fields - [PR #26525](https://github.com/BerriAI/litellm/pull/26525)
    - Harden `/model/info` redaction for plural credential field names - [PR #26513](https://github.com/BerriAI/litellm/pull/26513)
- **UI**
    - Stop injecting $0 cost on model edit - [PR #26001](https://github.com/BerriAI/litellm/pull/26001)

---

## AI Integrations

### Logging

- **General**
    - Add `litellm_call_id` to `StandardLoggingPayload` and OTel span - [PR #26133](https://github.com/BerriAI/litellm/pull/26133)
- **[Vertex AI Passthrough](../../docs/pass_through/vertex_ai)**
    - Log `:embedContent` and `:batchEmbedContents` responses - [PR #26146](https://github.com/BerriAI/litellm/pull/26146)

### Guardrails

- **[Bedrock Guardrails](../../docs/proxy/guardrails/bedrock_guardrails)**
    - Use Bedrock OUTPUT source for `apply_guardrail` when scanning model responses - [PR #26144](https://github.com/BerriAI/litellm/pull/26144)
    - Dedupe post-call log entry when only `post_call` is configured - [PR #26474](https://github.com/BerriAI/litellm/pull/26474)
    - Hook mode + match redaction + streaming `request_data` for spend logs - [PR #25854](https://github.com/BerriAI/litellm/pull/25854), [PR #26266](https://github.com/BerriAI/litellm/pull/26266)
- **LLM-as-a-Judge**
    - Ship LLM-as-a-Judge guardrail - [PR #26360](https://github.com/BerriAI/litellm/pull/26360)
- **General**
    - Team-level guardrails and global policy guardrails can run together - [PR #26466](https://github.com/BerriAI/litellm/pull/26466)
    - Guardrail param handling in list and submission endpoints - [PR #26390](https://github.com/BerriAI/litellm/pull/26390)
    - Log `guardrail_information` on streaming post-call - [PR #26448](https://github.com/BerriAI/litellm/pull/26448)
    - Suppress deferred success log when post-call guardrail blocks - [PR #26528](https://github.com/BerriAI/litellm/pull/26528)

---

## Spend Tracking, Budgets and Rate Limiting

- **Per-member budgets**
    - Individual team-member budgets - [PR #26208](https://github.com/BerriAI/litellm/pull/26208)
    - Track per-member total spend on team memberships - [PR #26195](https://github.com/BerriAI/litellm/pull/26195)
    - Fix per-team member budget bypass - [PR #26204](https://github.com/BerriAI/litellm/pull/26204)
- **Rate limiting**
    - Reseed enforcement read path from DB on counter miss - [PR #26459](https://github.com/BerriAI/litellm/pull/26459)
- **Budgets**
    - Align user and org budget spend checks with the atomic counter pattern - [PR #26182](https://github.com/BerriAI/litellm/pull/26182)
    - Reset budget windows failing due to Prisma `Json?` null filter - [PR #26346](https://github.com/BerriAI/litellm/pull/26346)

---

## MCP Gateway

- **OAuth**
    - Harden OAuth `authorize`/`token` endpoints (BYOK + discoverable) - [PR #26274](https://github.com/BerriAI/litellm/pull/26274)
    - Share temporary MCP OAuth sessions across instances via Redis - [PR #26162](https://github.com/BerriAI/litellm/pull/26162), [PR #26318](https://github.com/BerriAI/litellm/pull/26318)
    - Align MCP OAuth proxy endpoints with per-server access policy - [PR #26516](https://github.com/BerriAI/litellm/pull/26516)
    - MCP broker OAuth endpoint access controls - [PR #26142](https://github.com/BerriAI/litellm/pull/26142)
- **Permissions / routing**
    - Resolve team/key MCP permissions by name or alias - [PR #26338](https://github.com/BerriAI/litellm/pull/26338)
    - Split MCP routes into inference vs. management (unblocks Admin UI on `DISABLE_LLM_API_ENDPOINTS` nodes) - [PR #26367](https://github.com/BerriAI/litellm/pull/26367)
- **Tool filtering**
    - Match tools with client-side namespace prefix in `mcp_semantic_tool_filter` - [PR #26117](https://github.com/BerriAI/litellm/pull/26117)

---

## Performance / Loadbalancing / Reliability improvements

- **Routing**
    - Adaptive routing - [PR #26049](https://github.com/BerriAI/litellm/pull/26049)
    - Wildcard order fallback to higher-order deployments - [PR #25772](https://github.com/BerriAI/litellm/pull/25772)
- **Prompt Compression**
    - First-class server-side prompt compression callback - [PR #25729](https://github.com/BerriAI/litellm/pull/25729)
- **Reliability**
    - Fix `/health/readiness` 503 loop when DB is unreachable - [PR #26134](https://github.com/BerriAI/litellm/pull/26134)
- **Developer ergonomics**
    - `--reload` flag for uvicorn hot reload (dev only) - [PR #25901](https://github.com/BerriAI/litellm/pull/25901)

---

## General Proxy Improvements

- **Build / Docker**
    - Streamline `Dockerfile.non_root` build time - [PR #26055](https://github.com/BerriAI/litellm/pull/26055)
    - Use numeric UID 65534 in `docker.non_root` for K8s `runAsNonRoot` - [PR #26268](https://github.com/BerriAI/litellm/pull/26268)
    - Restore pre-uv Prisma cache path - [PR #26201](https://github.com/BerriAI/litellm/pull/26201)
- **Migrations**
    - Opt-in v2 migration resolver - [PR #26194](https://github.com/BerriAI/litellm/pull/26194)
    - Freshness and destructive guards on migration workflow - [PR #26185](https://github.com/BerriAI/litellm/pull/26185)
- **CI / Infra**
    - Migrate more CI jobs from CircleCI to GitHub Actions - [PR #26261](https://github.com/BerriAI/litellm/pull/26261)
    - CCI: cache, cleanup, anchors, install-path parity, Python 3.12, Ruby/Node pins - [PR #26286](https://github.com/BerriAI/litellm/pull/26286)
    - CircleCI config cleanup and consolidation - [PR #26226](https://github.com/BerriAI/litellm/pull/26226)
    - Speed up proxy unit tests and split `proxy-utils` into its own matrix entry - [PR #26150](https://github.com/BerriAI/litellm/pull/26150)
    - Remove CCI/GHA test duplication and semantically shard proxy DB tests - [PR #26356](https://github.com/BerriAI/litellm/pull/26356)
    - Standalone `create-release-branch` workflow + `contents:write` permission - [PR #26342](https://github.com/BerriAI/litellm/pull/26342), [PR #26359](https://github.com/BerriAI/litellm/pull/26359)
    - Supply-chain guard to block fork PRs that modify dependencies - [PR #26511](https://github.com/BerriAI/litellm/pull/26511)
    - Use Postgres sidecar instead of shared DB for `auth_ui_unit_tests` - [PR #26141](https://github.com/BerriAI/litellm/pull/26141)
    - Fix `e2e_ui_testing` stale-bundle issue on Ubuntu (`cp -r` merge semantics) - [PR #26047](https://github.com/BerriAI/litellm/pull/26047)
    - Apply black formatting to fix CI lint failures - [PR #26140](https://github.com/BerriAI/litellm/pull/26140)
- **Test stability**
    - Stabilize spend-accuracy tests + patch Redis buffer data-loss path - [PR #26270](https://github.com/BerriAI/litellm/pull/26270)
    - Stabilize spend-accuracy test transport flakes - [PR #26290](https://github.com/BerriAI/litellm/pull/26290)
    - Deflake spend-tracking tests - [PR #26349](https://github.com/BerriAI/litellm/pull/26349)
    - Drain logging worker in `test_router_caching_ttl` to fix flakiness - [PR #26355](https://github.com/BerriAI/litellm/pull/26355)
    - Isolate `master_key`/`prisma_client` module globals between proxy tests - [PR #26362](https://github.com/BerriAI/litellm/pull/26362)
- **Packaging / dependencies**
    - Bump vulnerable dependencies - [PR #26365](https://github.com/BerriAI/litellm/pull/26365)
    - Declare MIT license in `litellm-proxy-extras` metadata - [PR #26369](https://github.com/BerriAI/litellm/pull/26369)
    - Declare proprietary license in `litellm-enterprise` metadata - [PR #26457](https://github.com/BerriAI/litellm/pull/26457)
- **UI**
    - Fetch button ignores active filters on Request Logs page - [PR #25788](https://github.com/BerriAI/litellm/pull/25788)
    - Stale filters applied after sort/page/time change on Request Logs - [PR #25789](https://github.com/BerriAI/litellm/pull/25789)
- **Misc**
    - Replace substring check with `startswith` in `is_model_gpt_5_model` - [PR #25793](https://github.com/BerriAI/litellm/pull/25793)

---

## Documentation Updates

- Add missing observability integrations to View All page - [PR #24420](https://github.com/BerriAI/litellm/pull/24420)
- Clarify `x-litellm-model-group` vs. provider model id in proxy docs - [PR #25497](https://github.com/BerriAI/litellm/pull/25497)
- Gemini 3 thinking_level defaults and release note - [PR #25842](https://github.com/BerriAI/litellm/pull/25842)
- Align fenced code block padding on blog and doc pages - [PR #25932](https://github.com/BerriAI/litellm/pull/25932)
- Add supported providers to prompt caching doc - [PR #26124](https://github.com/BerriAI/litellm/pull/26124)
- Remove `docs/my-website`, point contributors to `BerriAI/litellm-docs` - [PR #26454](https://github.com/BerriAI/litellm/pull/26454)

---

## New Contributors

- @dongyu-turo made their first contribution in [#24164](https://github.com/BerriAI/litellm/pull/24164)
- @Alpha-Zark made their first contribution in [#25672](https://github.com/BerriAI/litellm/pull/25672)
- @vinhphamhuu-ct made their first contribution in [#25767](https://github.com/BerriAI/litellm/pull/25767)
- @Bytechoreographer made their first contribution in [#25788](https://github.com/BerriAI/litellm/pull/25788)
- @BraulioV made their first contribution in [#25793](https://github.com/BerriAI/litellm/pull/25793)
- @Vigilans made their first contribution in [#25883](https://github.com/BerriAI/litellm/pull/25883)
- @nhyy244 made their first contribution in [#26110](https://github.com/BerriAI/litellm/pull/26110)
- @sakenuGOD made their first contribution in [#26117](https://github.com/BerriAI/litellm/pull/26117)
- @Michael-RZ-Berri made their first contribution in [#26124](https://github.com/BerriAI/litellm/pull/26124)
- @anmolg1997 made their first contribution in [#26228](https://github.com/BerriAI/litellm/pull/26228)

**Full Changelog**: https://github.com/BerriAI/litellm/compare/v1.83.10-stable...v1.83.14.rc.1

---

## 04/27/2026

* New Models / Updated Models: 29
* LLM API Endpoints: 18
* Management Endpoints / UI: 23
* AI Integrations (Logging / Guardrails): 11
* Spend Tracking, Budgets and Rate Limiting: 6
* MCP Gateway: 8
* Performance / Loadbalancing / Reliability improvements: 5
* General Proxy Improvements: 27
* Documentation Updates: 6
