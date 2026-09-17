---
title: "v1.100.0 - Access Group Budgets, Together AI Sync & Custom Router Tiers"
slug: "v1-100-0"
date: 2026-09-06T00:00:00
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
docker.litellm.ai/berriai/litellm:1.100.0
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.100.0
```

</TabItem>
</Tabs>

:::note

PyPI and Docker artifacts for this release were built from different SHAs, but are expected to be functionally the same. PyPI was built from [`10631eb`](https://github.com/BerriAI/litellm/commit/10631eb834c7802aa61611e807474170b8a4d425) and Docker from [`e4f2526`](https://github.com/BerriAI/litellm/commit/e4f25265704e2b2c6cf6e81be2e4c5cffff896f4).

:::

:::danger Breaking Changes

**MCP toolsets attached to a team, organization, or internal user are now enforced.** Previously a toolset attached at those levels was ignored: every tool on the granted servers stayed callable, and an inert team toolset let the org's full server list substitute in. Toolsets now restrict `tools/list` and `tools/call` to exactly the tools and servers they name, at every level. A team that relied on the fail-open behavior loses access to tools its toolset does not name; widen the toolset to restore them. See [PR #38488](https://github.com/BerriAI/litellm/pull/38488).

**`GET /spend/logs` is capped at the 10,000 most recent rows.** The endpoint used to read the entire `LiteLLM_SpendLogs` table into memory, which could stall the worker on large tables. Responses that hit the cap carry an `x-litellm-spend-logs-truncated: true` header; callers that need more rows should use the paginated `GET /spend/logs/v2`. See [PR #38420](https://github.com/BerriAI/litellm/pull/38420).

**`prompt_token_calculator` is deleted from `litellm.utils`.** The wrapper duplicated `token_counter` and silently applied OpenAI tokenization to most Claude ids. `from litellm.utils import prompt_token_calculator` now raises `ImportError`; call `litellm.token_counter(model=..., text=...)` instead. See [PR #38132](https://github.com/BerriAI/litellm/pull/38132).

**Complexity-router settings written outside `complexity_router_config` are rejected.** A setting like `tier_boundaries` placed directly under `litellm_params` used to be accepted at write time, never read by the router, and then forwarded to the provider where it failed every request. `/model/new`, `/model/update`, and `config.yaml` startup now refuse all 43 settings when misplaced, with an error naming the setting and where it belongs. A config that previously started with a misplaced setting must move it under `complexity_router_config`. See [PR #38570](https://github.com/BerriAI/litellm/pull/38570).

**Cerebras requests through the Router now default to zero SDK-level retries.** `max_retries` was missing from Cerebras' supported params, so the Router's `max_retries=0` was dropped and the SDK fell back to its default of 2. It now passes through, matching OpenAI and Azure behavior; pass `max_retries` explicitly to restore SDK retries. See [PR #36601](https://github.com/BerriAI/litellm/pull/36601).

**`router_model_name` is removed from auto-routed response bodies.** The field shipped only in the v1.99 release candidates and common SDKs strip unknown response fields, so it never reached callers. Use `return_raw_model_name: true` on the router instead, which reports the serving model through the standard `model` field. See [PR #38429](https://github.com/BerriAI/litellm/pull/38429).

**`litellm_settings.autorouter_savings_baseline_model` is deleted.** The proxy-wide baseline distorted every auto router's savings figure; each complexity router now derives its counterfactual from its own hardest configured tier. A leftover key in `config.yaml` is ignored and can be removed, and reported savings figures will change. See [PR #38700](https://github.com/BerriAI/litellm/pull/38700).

:::

## Key Highlights

- **Shared budgets on model access groups** - an access group can now carry one budget enforced across every deployment in it, tracked in a new per-window spend table, readable at enforcement time without a rollup scan, and settable from the dashboard. Budgets also gain opt-in rollover, carrying unused headroom into the next window
- **Together AI overhaul** - chat completions move onto a dedicated Together config with `api.together.ai` as the default endpoint, `reasoning_effort` mapped per model class, cache-read pricing applied, tools failing open for registry-unknown models, and a daily sync workflow that keeps the Together registry priced against the live serverless catalog
- **Operator-defined auto-router tiers** - the complexity router's tier set is now editable end to end: custom classifier-defined tiers, a preview of the exact classifier prompt an edited tier set sends, heuristic-first classifier chaining, a dry run of a real request body on `/auto_router/test_routing` before saving, and classifier cost counted in savings and benchmarks
- **MCP gateway session hardening** - RFC 7662 introspection lets an external gateway validate LiteLLM session tokens, session tokens can be signed asymmetrically with RS256, Anthropic MCP connectors can be bulk-imported via API and admin UI, and toolsets attached to teams, orgs and users are enforced
- **242 new models** - day-0 support for `gemini-3.5-transcribe` and `transcribe-live` on Gemini and Vertex, the xAI `grok-4.20` family and `grok-imagine` image models, 24 Mistral entries spanning Voxtral audio, Ministral, OCR 3 and 4 and the Code and Vibe CLI lines, RunwayML `gen4.5`, `veo3.1` and the Seedance 2 family, and Grounding with Bing Search as a new search provider

## Included after the v1.100.0-rc.1 cut

This stable also carries the one change that landed on the release line after the rc.1 cut:

- **Docker**
    - Bump wolfi-base for glibc 2.44 and pin the image builds' apk python to 3.13, so the images build again after Wolfi rolled its python package forward - [PR #39992](https://github.com/BerriAI/litellm/pull/39992) (cherry-pick of [PR #38917](https://github.com/BerriAI/litellm/pull/38917) and [PR #38973](https://github.com/BerriAI/litellm/pull/38973))

## New Providers and Endpoints

### New Providers (1 new provider)

| Provider | Supported LiteLLM Endpoints | Description |
| --- | --- | --- |
| [Bing Grounding](../../docs/search/bing_grounding) | `/search` | Grounding with Bing Search registered as a search provider, with per-query pricing in the cost map |

### New LLM API Endpoints (3 new endpoints)

| Endpoint | Method | Description | Documentation |
| --- | --- | --- | --- |
| `/public/v1/model_hub` | GET | Paginated, filterable public listing of the models the proxy exposes | [AI Hub](../../docs/proxy/ai_hub) |
| `/v1/mcp/server/import` | POST | Bulk-imports Anthropic MCP connectors as LiteLLM MCP servers | [MCP Gateway](../../docs/mcp) |
| `/introspect` | POST | RFC 7662 introspection for MCP gateway session tokens, authenticated with a LiteLLM virtual key | [MCP Gateway](../../docs/mcp) |

## New Models / Updated Models

#### New Model Support (242 new models)

| Provider | Model | Context Window | Input ($/1M tokens) | Output ($/1M tokens) | Features |
| --- | --- | --- | --- | --- | --- |
| Amazon Bedrock | `bedrock_mantle/openai.gpt-5.6-cyber` | 272K | $13.75 | $82.50 | Reasoning, Vision, Function calling, Tool choice, Prompt caching, Response schema |
| Google Gemini | `gemini/gemini-3.5-transcribe` | - | $2.00 | $12.00 | Audio input |
| Google Gemini | `gemini/gemini-3.5-transcribe-live` | - | $3.50 | $21.00 | Audio input |
| Google Gemini | `gemini/gemini-omni-1.1-flash` | 131K | $1.50 | $9.00 | Reasoning, Vision, Audio input, Video input |
| Google Gemini | `gemini/gemma-4-26b-a4b-it` | 262K | - | - | Reasoning, Vision, Function calling, Tool choice, Response schema |
| Google Gemini | `gemini/gemma-4-31b-it` | 262K | - | - | Reasoning, Vision, Function calling, Tool choice, Response schema |
| Google Gemini | `gemini/nano-banana-pro-preview` | 131K | $2.00 | $12.00 | Vision, Prompt caching, Response schema, Web search |
| Google Vertex AI | `gemini-live-2.5-flash-native-audio` | 1.05M | $0.50 | $2.00 | Vision, PDF input, Function calling, Parallel function calling, Tool choice, Prompt caching, Response schema, Web search, Audio input, Audio output |
| Google Vertex AI | `vertex_ai/gemini-3.5-transcribe-live-preview` | - | $3.50 | $21.00 | Audio input |
| Google Vertex AI | `vertex_ai/gemini-3.5-transcribe-preview` | - | $2.50 | $12.00 | Audio input |
| Google Vertex AI | `vertex_ai/veo-3.1-lite-generate-001` | 1K | - | - | video_generation |
| Mistral | `mistral/labs-leanstral-1-5-1` | 262K | - | - | Function calling, Tool choice, Response schema |
| Mistral | `mistral/ministral-14b-2512` | 262K | $0.20 | $0.20 | Vision, Function calling, Tool choice, Response schema |
| Mistral | `mistral/ministral-14b-latest` | 262K | $0.20 | $0.20 | Vision, Function calling, Tool choice, Response schema |
| Mistral | `mistral/ministral-3b-2512` | 131K | $0.10 | $0.10 | Vision, Function calling, Tool choice, Response schema |
| Mistral | `mistral/ministral-3b-latest` | 131K | $0.10 | $0.10 | Vision, Function calling, Tool choice, Response schema |
| Mistral | `mistral/mistral-code-agent-latest` | 256K | $0.40 | $2.00 | Function calling, Tool choice, Response schema |
| Mistral | `mistral/mistral-code-fim-latest` | 128K | $0.30 | $0.90 | Function calling, Tool choice, Response schema |
| Mistral | `mistral/mistral-code-latest` | 128K | $0.30 | $0.90 | Function calling, Tool choice, Response schema |
| Mistral | `mistral/mistral-embed-2312` | 8K | $0.10 | - | embedding |
| Mistral | `mistral/mistral-medium-3` | 262K | $1.50 | $7.50 | Reasoning, Vision, Function calling, Tool choice, Response schema |
| Mistral | `mistral/mistral-medium-3.5` | 262K | $1.50 | $7.50 | Reasoning, Vision, Function calling, Tool choice, Response schema |
| Mistral | `mistral/mistral-ocr-3` | - | - | - | ocr |
| Mistral | `mistral/mistral-ocr-3-0` | - | - | - | ocr |
| Mistral | `mistral/mistral-ocr-4` | - | - | - | ocr |
| Mistral | `mistral/mistral-vibe-cli-fast` | 262K | $0.15 | $0.60 | Reasoning, Vision, Function calling, Tool choice, Response schema |
| Mistral | `mistral/mistral-vibe-cli-latest` | 262K | $1.50 | $7.50 | Reasoning, Vision, Function calling, Tool choice, Response schema |
| Mistral | `mistral/mistral-vibe-cli-with-tools` | 262K | $1.50 | $7.50 | Reasoning, Vision, Function calling, Tool choice, Response schema |
| Mistral | `mistral/voxtral-mini-latest` | - | - | - | Audio input |
| Mistral | `mistral/voxtral-mini-realtime-2602` | - | - | - | Audio input |
| Mistral | `mistral/voxtral-mini-realtime-latest` | - | - | - | Audio input |
| Mistral | `mistral/voxtral-mini-transcribe-realtime-latest` | - | - | - | Audio input |
| Mistral | `mistral/voxtral-mini-tts-latest` | - | - | - | Audio output |
| Mistral | `mistral/voxtral-small-2507` | 33K | $0.10 | $0.40 | Function calling, Tool choice, Response schema, Audio input |
| Mistral | `mistral/voxtral-small-latest` | 33K | $0.10 | $0.40 | Function calling, Tool choice, Response schema, Audio input |
| xAI | `low/1024-x-1024/grok-imagine-image-2.0` | - | - | - | image_generation |
| xAI | `xai/grok-4.20` | 1M | $1.25 | $2.50 | Reasoning, Vision, Function calling, Tool choice, Prompt caching, Response schema, Web search |
| xAI | `xai/grok-4.20-multi-agent` | 1M | $1.25 | $2.50 | Reasoning, Vision, Prompt caching, Response schema, Web search |
| xAI | `xai/grok-4.20-multi-agent-latest` | 1M | $1.25 | $2.50 | Reasoning, Vision, Prompt caching, Response schema, Web search |
| xAI | `xai/grok-4.20-non-reasoning` | 1M | $1.25 | $2.50 | Vision, Function calling, Tool choice, Prompt caching, Response schema, Web search |
| xAI | `xai/grok-4.20-non-reasoning-latest` | 1M | $1.25 | $2.50 | Vision, Function calling, Tool choice, Prompt caching, Response schema, Web search |
| xAI | `xai/grok-4.20-reasoning` | 1M | $1.25 | $2.50 | Reasoning, Vision, Function calling, Tool choice, Prompt caching, Response schema, Web search |
| xAI | `xai/grok-4.20-reasoning-latest` | 1M | $1.25 | $2.50 | Reasoning, Vision, Function calling, Tool choice, Prompt caching, Response schema, Web search |
| xAI | `xai/grok-imagine-image` | - | - | - | image_generation |
| xAI | `xai/grok-imagine-image-2.0` | - | - | - | image_generation |
| xAI | `xai/grok-imagine-image-2026-03-02` | - | - | - | image_generation |
| xAI | `xai/grok-imagine-image-pro` | - | - | - | image_generation |
| xAI | `xai/grok-imagine-image-quality` | - | - | - | image_generation |
| xAI | `xai/grok-imagine-image-quality-20260403` | - | - | - | image_generation |
| xAI | `xai/grok-imagine-image-quality-latest` | - | - | - | image_generation |
| Databricks | `databricks/databricks-claude-fable-5` | 1M | $10.00 | $50.00 | Reasoning, Function calling, Tool choice, Prompt caching |
| Databricks | `databricks/databricks-claude-opus-4-7` | 1M | $5.00 | $25.00 | Reasoning, Vision, Function calling, Tool choice, Prompt caching |
| Databricks | `databricks/databricks-claude-opus-4-8` | 1M | $5.00 | $25.00 | Reasoning, Vision, Function calling, Tool choice, Prompt caching |
| Databricks | `databricks/databricks-claude-opus-5` | 1M | $5.00 | $25.00 | Reasoning, Vision, Function calling, Tool choice, Prompt caching |
| Databricks | `databricks/databricks-claude-sonnet-5` | 1M | $3.00 | $15.00 | Reasoning, Vision, Function calling, Tool choice, Prompt caching |
| Databricks | `databricks/databricks-glm-5-2` | 1M | $1.40 | $4.4 | Reasoning, Function calling, Tool choice, Prompt caching |
| Databricks | `databricks/databricks-glm-5-3-flash` | 1.05M | - | - | Reasoning, Vision, Function calling, Tool choice, Prompt caching |
| Databricks | `databricks/databricks-kimi-k3` | 1M | $3.00 | $15.00 | Reasoning, Vision, Function calling, Tool choice, Prompt caching |
| Fireworks AI | `fireworks_ai/accounts/fireworks/models/deepseek-v4-pro-0813` | 1.05M | $1.32 | $3.96 | Reasoning, Function calling, Tool choice, Response schema |
| Fireworks AI | `fireworks_ai/accounts/fireworks/models/glm-5p3` | 1.05M | $1.40 | $4.4 | Reasoning, Function calling, Tool choice, Response schema |
| Fireworks AI | `fireworks_ai/accounts/fireworks/models/qwen3-embedding-8b` | 41K | $0.10 | - | embedding |
| RunwayML | `runwayml/aleph2` | - | - | - | video_generation |
| RunwayML | `runwayml/gemini_omni_flash` | - | - | - | video_generation |
| RunwayML | `runwayml/gen4.5` | - | - | - | video_generation |
| RunwayML | `runwayml/hailuo3` | - | - | - | video_generation |
| RunwayML | `runwayml/seedance2` | - | - | - | video_generation |
| RunwayML | `runwayml/seedance2_5` | - | - | - | video_generation |
| RunwayML | `runwayml/seedance2_fast` | - | - | - | video_generation |
| RunwayML | `runwayml/seedance2_mini` | - | - | - | video_generation |
| RunwayML | `runwayml/veo3.1` | - | - | - | video_generation |
| RunwayML | `runwayml/veo3.1_fast` | - | - | - | video_generation |
| Moonshot | `moonshot/kimi-k2.7-code` | 262K | $0.95 | $4.00 | Reasoning, Vision, Function calling, Tool choice, Prompt caching, Response schema, Video input |
| DeepSeek | `deepseek-v4-flash-vision-exp` | 1M | $0.44 | $1.32 | Reasoning, Vision, Function calling, Parallel function calling, Tool choice, Prompt caching, Response schema, Native streaming |
| DeepSeek | `deepseek/deepseek-v4-flash-vision-exp` | 1M | $0.44 | $1.32 | Reasoning, Vision, Function calling, Parallel function calling, Tool choice, Prompt caching, Response schema, Native streaming |
| Dashscope | `dashscope/qwen-image-3.0` | - | - | - | image_generation |
| Dashscope | `dashscope/qwen-image-3.0-pro` | - | - | - | image_generation |
| Z.AI | `zai/glm-5.3` | 1M | $1.40 | $4.4 | Reasoning, Function calling, Tool choice, Prompt caching |
| Z.AI | `zai/glm-5.3-flash` | 1.05M | $0.15 | $0.50 | Reasoning, Vision, Function calling, Tool choice, Prompt caching |
| Tencent | `tencent/minimax-m3` | 1M | $0.30 | $1.20 | Reasoning, Function calling, Prompt caching, Native streaming |
| Groq | `groq/qwen/qwen3.8-27b` | 131K | $0.80 | $4.00 | Reasoning, Vision, Function calling, Tool choice, Response schema |
| Bing Grounding | `bing_grounding/search` | - | - | - | search |

Beyond the table, 161 of the 242 new entries come from registry audits of four OpenAI-compatible catalogs, each priced and capability-flagged against the provider's live API: 67 DeepInfra entries (the Claude family, Gemini 3.x, Qwen 3.5 through 3.8, DeepSeek V3.2 and V4, Kimi K2.5 through K3, GLM 4.6 through 5.2, Nemotron 3, and more), 50 Novita entries (DeepSeek R1 and V4, MiniMax M2.5 through M3, GLM 4.7 through 5.3, Kimi, Qwen, Step 3.7 and community variants), 25 Together AI entries (GLM 5.2 and 5.3, Kimi K2.7 Code and K3, DeepSeek V4, MiniMax M3, Qwen 3.5 through 3.8, Nemotron 3 Ultra), and 19 W&B Inference entries (DeepSeek V4, Kimi, Qwen, GLM 5.2, Nemotron, Granite 4.1).

This window also removed 10 retired entries: xAI's `grok-2` family, `grok-beta`, and `grok-vision-beta` (retired and repriced by xAI), and RunwayML's `gen3a_turbo` and `gen4_aleph` (superseded by `gen4.5` and `aleph2`).

The maintenance pass over existing entries touched 383 of them. Cache pricing moved the most: 96 entries gained or corrected cache-read rates and 56 cache-write rates, including Gemini `-latest`/preview alias cache reads at 10% of input, corrected flex-tier cache reads on Vertex flash-lite, Azure gpt-5.6 cache-write rates, 1-hour cache writes on Claude 3 Haiku and Opus at 2x input, and Mistral cache-read pricing across its catalog. 52 entries gained provider-announced deprecation dates, 48 corrected `prompt_cache_min_tokens` (Claude Fable 5 drops to 512 so prompt-cache-affinity routing engages), and 45 Gemini and Vertex entries gained the new `google_maps_grounding_cost_per_query` SKU. Bedrock Mantle's GPT-5.6/5.5/5.4 entries rise to the enforced 1,050,000 max input tokens with above-272K pricing tiers, 37 entries gained a `default_reasoning_effort`, 28 Claude 4.6-era entries gained `supports_legacy_thinking`, and 9 entries now declare their exact `reasoning_effort_levels`.

#### Features

- **[Together AI](../../docs/providers/togetherai)**
    - Route Together AI chat completions through a dedicated `TogetherAIChatConfig` on the standard HTTP handler, giving Together-specific request params and response fields a home while keeping the `litellm.TogetherAIConfig` import path working - [PR #38248](https://github.com/BerriAI/litellm/pull/38248)
    - Default Together AI endpoints to the canonical `https://api.together.ai/v1` host, honor `api_base` and `TOGETHER_AI_API_BASE` on rerank like chat, and resolve both Together hosts when passed as `api_base` - [PR #38233](https://github.com/BerriAI/litellm/pull/38233)
    - Accept `reasoning_effort` on Together models that can reason: values a model rejects clamp to the nearest accepted level, `reasoning_effort: none` sends Together's reasoning-off toggle, and DeepSeek-V4-Pro gets its documented high/max scale - [PR #38263](https://github.com/BerriAI/litellm/pull/38263)
    - Keep the Together AI registry current with a daily sync: a new script diffs registry entries against Together's live serverless catalog and deprecations doc, normalizes pricing (cached-input rates included), and opens a registry PR whenever anything moves; the first automated run refreshed Qwen3.8-2.4T-A95B pricing and gpt-oss-20b context - [PR #38257](https://github.com/BerriAI/litellm/pull/38257), [PR #38694](https://github.com/BerriAI/litellm/pull/38694)
    - Add `together_ai/zai-org/GLM-5.3-Flash` with Together's live pricing, prompt caching rates, 1M context window, and verified capability flags (tools, JSON schema, reasoning, vision) - [PR #38486](https://github.com/BerriAI/litellm/pull/38486)
- **[Amazon Bedrock](../../docs/providers/bedrock)**
    - Build every AWS endpoint and ARN from the region's partition, so China (`aws-cn`) and GovCloud (`aws-us-gov`) regions work across Bedrock, STS role assumption, S3 spend logs, and Secrets Manager - [PR #38747](https://github.com/BerriAI/litellm/pull/38747)
- **[Azure](../../docs/providers/azure)**
    - Authenticate the realtime websocket (and its health check) with an Azure AD token when no `api-key` is configured, so Entra ID-only deployments can open realtime sessions - [PR #34658](https://github.com/BerriAI/litellm/pull/34658)
- **[Azure AI Foundry](../../docs/providers/azure_ai)**
    - Support Entra ID / OAuth auth on every Azure AI Foundry route (embeddings, rerank, OCR, document intelligence, image generation and edits), cache Entra token providers per credential set and scope, and drop the silent fallback to the OpenAI key - [PR #35415](https://github.com/BerriAI/litellm/pull/35415)
- **[Vertex AI](../../docs/providers/vertex)**
    - Add `vertex_ai/veo-3.1-lite-generate-001` with 720p and 1080p per-second pricing, and map OpenAI-style `size` to Veo `resolution` so 1080p requests return 1080p video - [PR #30782](https://github.com/BerriAI/litellm/pull/30782)
- **[Dashscope](../../docs/providers/dashscope)**
    - Support `qwen-image-3.0` and `qwen-image-3.0-pro` image generation, send image calls to DashScope's multimodal generation endpoint, and forward `n` so multi-image requests return every image - [PR #38449](https://github.com/BerriAI/litellm/pull/38449)

### Bug Fixes

- **[Together AI](../../docs/providers/togetherai)**
    - Pass tools and `response_format` through for Together models missing from the registry so Together validates them itself, instead of a client-side 400 or a silent drop under `drop_params`; models the registry explicitly marks unsupported keep the loud contract - [PR #38265](https://github.com/BerriAI/litellm/pull/38265), [PR #38269](https://github.com/BerriAI/litellm/pull/38269)
    - Stop writing Together's `context_length` as `max_output_tokens` in the serverless sync, removing invented 1M-class output ceilings that made otpm limits reject small requests; GLM-5.2 and GLM-5.3-Flash carry their documented 128K ceiling - [PR #38820](https://github.com/BerriAI/litellm/pull/38820)
- **[Anthropic](../../docs/providers/anthropic)**
    - Keep a caller's `thinking.budget_tokens` on Claude 4.6 models on `/v1/messages` (a new `supports_legacy_thinking` flag forwards the legacy shape verbatim), so hard reasoning budgets are enforced; 4.7+ and Claude 5 families keep the translation - [PR #38108](https://github.com/BerriAI/litellm/pull/38108)
    - Carry the adaptive `output_config.effort` tier to every bridged Claude target that declares `reasoning_effort`, and leave the bare `thinking` block untouched for providers that take neither carrier - [PR #38533](https://github.com/BerriAI/litellm/pull/38533), [PR #38592](https://github.com/BerriAI/litellm/pull/38592)
    - Cap the thinking budget mapped from `reasoning_effort` below the request's `max_tokens` on `/v1/messages`, and skip extended thinking when even the minimum budget cannot fit - [PR #38836](https://github.com/BerriAI/litellm/pull/38836)
    - Reconcile enum values with the declared type in the `output_format` schema - [PR #37882](https://github.com/BerriAI/litellm/pull/37882)
- **[Amazon Bedrock](../../docs/providers/bedrock)**
    - Stop emitting an empty assistant delta after the `finish_reason` chunk on Converse streams; usage still reaches logging and spend tracking, and guardrail trace chunks keep their shape - [PR #36806](https://github.com/BerriAI/litellm/pull/36806)
    - Request summarized adaptive thinking when `reasoning_effort` is set on adaptive Claude models, so `reasoning_content` comes back populated, and report the provider's actual thinking token counts on Converse - [PR #37979](https://github.com/BerriAI/litellm/pull/37979)
    - Normalize the Codex history item types Bedrock Mantle rejects (`agent_message`, `context_compaction`, `local_shell_call`) so multi-agent Codex sessions stop failing on replayed history - [PR #38227](https://github.com/BerriAI/litellm/pull/38227)
    - Map `reasoning_effort` to `reasoning.effort` for OpenAI GPT-5.x models on Converse, and mark the gpt-5.6 entries as supporting reasoning - [PR #38279](https://github.com/BerriAI/litellm/pull/38279)
- **[Azure](../../docs/providers/azure)**
    - Use the `/openai/v1` image routes for the `v1`, `preview`, and `latest` api versions so image generation and edits stop 404ing on the v1 surface; dated api versions keep the deployment-scoped path - [PR #38285](https://github.com/BerriAI/litellm/pull/38285)
- **[Google Gemini](../../docs/providers/gemini)**
    - Bill Google Maps grounding as its own SKU on both the Gemini API and Vertex AI, with a `google_maps_grounding_requests` usage counter, a `google_maps_grounding_cost_per_query` cost key, and Maps tool-use tokens excluded from billable prompt tokens - [PR #38418](https://github.com/BerriAI/litellm/pull/38418)
- **[Vertex AI](../../docs/providers/vertex)**
    - Bill Vertex AI flex-tier traffic at the flex rate by mapping the `ON_DEMAND_FLEX` traffic type to the `flex` service tier and carrying it through the per-character cost route - [PR #37724](https://github.com/BerriAI/litellm/pull/37724)
- **[Databricks](../../docs/providers/databricks)**
    - Derive the OAuth token URL from the workspace origin so service principal (M2M) auth works when `api_base` carries an AI Gateway path - [PR #35940](https://github.com/BerriAI/litellm/pull/35940)
- **[Moonshot](../../docs/providers/moonshot)**
    - Send the reasoning effort Kimi K3 accepts: Moonshot takes `reasoning_effort` when the registry says the model reasons, and Together AI forwards a declared `max` unchanged instead of folding it to `high` - [PR #38611](https://github.com/BerriAI/litellm/pull/38611)
- **[DeepSeek](../../docs/providers/deepseek)**
    - Forward image content lists to DeepSeek vision models so attached images actually reach the model, and register `deepseek-v4-flash-vision-exp`; non-vision models, non-user roles, and RAG text keep the historical collapse-to-string behavior - [PR #38397](https://github.com/BerriAI/litellm/pull/38397)
- **[Tencent](../../docs/providers/tencent)**
    - Route `thinking` through `extra_body` so reasoning requests stop 500ing before reaching Tencent, coerce `thinking.type: enabled` to `adaptive` for MiniMax models, and map `reasoning_effort: none` to disabled thinking - [PR #38100](https://github.com/BerriAI/litellm/pull/38100)
- **[RunwayML](../../docs/providers/runwayml/videos)**
    - Route text-to-video, image-to-video, and video-to-video requests to the right RunwayML endpoint, return Runway errors with their real status codes, accept Runway's fractional progress while polling, and track video spend from deployment pricing plus refreshed resolution-tier rates - [PR #38115](https://github.com/BerriAI/litellm/pull/38115)
- **General**
    - Stop forwarding `temperature` and `top_p` to gpt-5.5/5.6 reasoning models that reject them; a new `default_reasoning_effort` map key gates the params across chat, Responses, and `/v1/messages`, and `drop_params` is honored instead of leaking the provider 400 - [PR #38593](https://github.com/BerriAI/litellm/pull/38593)
    - Honor per-level `reasoning_effort` flags on registry entries without an explicit `supports_reasoning`, so declared levels like `minimal` and `xhigh` are forwarded instead of degraded - [PR #38618](https://github.com/BerriAI/litellm/pull/38618)
    - Report `supports_parallel_function_calling` in `/v1/model/info`, `/model_group/info`, and `litellm.supports_parallel_function_calling()` by copying the registry value into model info - [PR #38692](https://github.com/BerriAI/litellm/pull/38692)

## LLM API Endpoints

#### Features

- **[Videos](../../docs/videos)**
    - Add the OpenAI Videos API for `hosted_vllm`, sending creates as multipart form data and passing vLLM-Omni fields such as `extra_params` through to the server - [PR #38148](https://github.com/BerriAI/litellm/pull/38148)
- **[Audio Transcription](../../docs/audio_transcription)**
    - Add day-0 support for `gemini-3.5-transcribe` and `gemini-3.5-transcribe-live` with registered pricing, working realtime sessions, and live usage estimated from streamed audio duration landing in spend logs - [PR #38540](https://github.com/BerriAI/litellm/pull/38540)
    - Support `gemini-3.5-transcribe` on Vertex AI via `/v1/audio/transcriptions`, defaulting the location to `global` and adding Vertex pricing for both transcribe models - [PR #38740](https://github.com/BerriAI/litellm/pull/38740)
- **[Search](../../docs/search)**
    - Add Grounding with Bing Search (`bing_grounding`) as a search provider, served on `/v1/search`, chat web-search interception, the SDK, and the Admin UI - [PR #38119](https://github.com/BerriAI/litellm/pull/38119)
- **[Vector Stores](../../docs/completion/knowledgebase)**
    - Enforce upload controls on `/v1/rag/ingest`: classify files by magic bytes instead of the client filename, allowlist PDF and text, reject archives, executables, and oversized files, and screen bytes with a malware scanner that fails closed - [PR #38135](https://github.com/BerriAI/litellm/pull/38135)
- **Interactions API**
    - Add native Vertex AI Interactions API support, so gemini-omni models serve `/v1beta/interactions` with streaming, SDK access, and cost tracking instead of a generateContent 400 - [PR #38229](https://github.com/BerriAI/litellm/pull/38229)
- **General**
    - Record and replay streamed provider responses chunk-for-chunk in the e2e harness, so the streamed `/v1/messages` path certifies offline with the provider's own SSE frame boundaries - [PR #38136](https://github.com/BerriAI/litellm/pull/38136)

#### Bugs

- **[/v1/messages](../../docs/anthropic_unified)**
    - Round-trip prior-turn thinking blocks to OpenAI-family backends as Responses reasoning items and `reasoning_content`, drop and self-heal empty thinking blocks that broke mixed-provider tool loops with Anthropic 400s, and keep signature-only thinking blocks so signed reasoning replays across tool turns - [PR #37953](https://github.com/BerriAI/litellm/pull/37953), [PR #38625](https://github.com/BerriAI/litellm/pull/38625), [PR #38809](https://github.com/BerriAI/litellm/pull/38809)
    - Carry `tool_result` and user-content document blocks through the chat and responses bridges, so PDFs attached via Claude Code or the Anthropic SDK reach Bedrock Converse and OpenAI models instead of vanishing - [PR #38251](https://github.com/BerriAI/litellm/pull/38251), [PR #38261](https://github.com/BerriAI/litellm/pull/38261), [PR #38267](https://github.com/BerriAI/litellm/pull/38267)
    - Pass deployment-level provider-native tools (e.g. Gemini `googleMaps`) and OpenAI-format tools through the bridge verbatim, and read every name a tool dict carries so restricted keys cannot slip disallowed tools through - [PR #38431](https://github.com/BerriAI/litellm/pull/38431)
    - Resolve effort tiers through the shared capability resolver, so a degraded level is always one the model map says the model accepts - [PR #38492](https://github.com/BerriAI/litellm/pull/38492)
    - Default translated structured output schemas to non-strict so optional properties survive on OpenAI backends, preserving explicit `strict` values - [PR #38211](https://github.com/BerriAI/litellm/pull/38211)
    - Buffer streamed turns carrying server-fulfilled tools (e.g. Headroom retrieval) so server-side tool calls never reach the client, keeping the stream alive with pings and relaying only the follow-up answer - [PR #36245](https://github.com/BerriAI/litellm/pull/36245)
    - Attach `MINIMAX_API_KEY` on MiniMax requests instead of demanding an Anthropic key, and strip litellm-internal thinking fields from outbound Together AI messages while keeping `reasoning_content` for preserved thinking - [PR #38393](https://github.com/BerriAI/litellm/pull/38393), [PR #38275](https://github.com/BerriAI/litellm/pull/38275)
    - Raise a clear local missing-credential error on the Anthropic passthrough instead of forwarding keyless requests upstream, and serialize guardrail dict-detail 400s cleanly like `/v1/chat/completions` and `/v1/responses` already do - [PR #38240](https://github.com/BerriAI/litellm/pull/38240), [PR #38741](https://github.com/BerriAI/litellm/pull/38741)
- **[Responses API](../../docs/response_api)**
    - Keep the conversation when chaining `previous_response_id` on the bridge: every stream event carries a usable id, the session lookup retries for a just-finished turn, and list-shaped `input` replays - [PR #37956](https://github.com/BerriAI/litellm/pull/37956)
    - Forward `reasoning_effort: "max"` through the Responses API bridge instead of silently dropping it - [PR #38222](https://github.com/BerriAI/litellm/pull/38222)
    - Flatten top-level `anyOf`/`oneOf`/`allOf` in tool schemas for the OpenAI and Azure model families whose validator rejects them, leaving GPT-5-family schemas intact - [PR #38792](https://github.com/BerriAI/litellm/pull/38792), [PR #38837](https://github.com/BerriAI/litellm/pull/38837)
    - Return streamed responses under owner-scoped managed ids on the OpenAI passthrough and the `/openai/v1/responses` and `/responses` aliases, closing a path where another virtual key could read, continue, or delete a streamed response - [PR #38320](https://github.com/BerriAI/litellm/pull/38320), [PR #38325](https://github.com/BerriAI/litellm/pull/38325)
- **[Batches](../../docs/batches)**
    - Aggregate reasoning tokens and per-line pass/fail counts, including failures reported only in the batch's error file, onto a completed batch's spend log - [PR #37208](https://github.com/BerriAI/litellm/pull/37208)
    - Fill a managed batch page past stored rows that will not parse, so SDK pagination reaches every remaining batch instead of stopping silently - [PR #38738](https://github.com/BerriAI/litellm/pull/38738)
    - Map real Bedrock record counts into `request_counts` and keep a completed batch billable until its output is actually processed - [PR #38744](https://github.com/BerriAI/litellm/pull/38744)
    - Let keys with no `user_id` or `team_id` read back their own batches, files, and vector stores while every other key stays denied - [PR #34849](https://github.com/BerriAI/litellm/pull/34849)
- **[Files](../../docs/files_endpoints)**
    - Decode `x-litellm-model` wrapped file ids back to the raw provider id on chat and responses requests, so gateway-issued ids stop drawing provider 404s - [PR #29832](https://github.com/BerriAI/litellm/pull/29832)
    - Run `async_pre_call_hook` on `POST /v1/files`, letting custom hooks inspect or reject uploads before they reach the provider - [PR #38607](https://github.com/BerriAI/litellm/pull/38607)
- **[Videos](../../docs/videos)**
    - Parse form-encoded and multipart video edit and extension bodies, so OpenAI SDK `videos.edit()` calls stop returning 500 - [PR #36513](https://github.com/BerriAI/litellm/pull/36513)
    - Forward the uploaded source file on `/v1/videos/edits` to the provider as multipart, keeping edit-by-id JSON unchanged - [PR #38155](https://github.com/BerriAI/litellm/pull/38155)
    - Match the OpenAI SDK wire format on image and video routes: file-less video creates go out as multipart, image edits forward provider params and `extra_body`, and file-less pass-through forms keep their multipart encoding - [PR #38104](https://github.com/BerriAI/litellm/pull/38104)
- **[Audio Transcription](../../docs/audio_transcription)**
    - Align Soniox SRT/VTT cues to real speech timing: whole words only, breaks on silence gaps and sentence ends, and no untimestamped translation tokens in cues - [PR #34440](https://github.com/BerriAI/litellm/pull/34440)
    - Synthesize SRT/VTT output for Gemini transcription from word timestamps, matching the subtitle documents whisper-1 already returns - [PR #38561](https://github.com/BerriAI/litellm/pull/38561)
- **[Speech](../../docs/text_to_speech)**
    - Keep caller metadata and the completion-computed cost through the TTS completion bridge, so Gemini TTS calls are spend-tracked and billed at the real price instead of $0 - [PR #38414](https://github.com/BerriAI/litellm/pull/38414)
- **[Realtime](../../docs/realtime)**
    - Keep the client's requested voice on Gemini and Vertex native-audio Live sessions, degrading unsupported OpenAI stock voice names to the default voice instead of killing the session - [PR #38395](https://github.com/BerriAI/litellm/pull/38395)
- **Embeddings**
    - Route all Bedrock `cohere.embed` models to the cohere embedding config and normalize `encoding_format: base64` to `float`, so default OpenAI SDK embedding calls succeed - [PR #38670](https://github.com/BerriAI/litellm/pull/38670)
    - Forward `aws_external_id` in Bedrock embeddings and SageMaker credential loading, matching the chat path, so roles requiring an ExternalId assume cleanly - [PR #38727](https://github.com/BerriAI/litellm/pull/38727)
- **[Rerank](../../docs/rerank)**
    - Sign Bedrock rerank requests with the shared header-filtered SigV4 helper, so forwarded client headers no longer break the AWS signature - [PR #38093](https://github.com/BerriAI/litellm/pull/38093)
- **Pass-through Endpoints**
    - Keep the caller's LiteLLM key and proxy-only auth headers off credential-less Vertex passthrough requests, while a caller's own Google token under custom auth still goes through; requests with no real Google credential get a clean 401 - [PR #38114](https://github.com/BerriAI/litellm/pull/38114), [PR #38299](https://github.com/BerriAI/litellm/pull/38299)
    - Register a Bedrock runtime passthrough config for `bedrock_mantle`, so `/bedrock/model/<deployment>/invoke`, streaming, and Converse work with spend tracked - [PR #38231](https://github.com/BerriAI/litellm/pull/38231)
- **A2A**
    - Normalize agent card `protocolBinding` casing and downgrade mis-cased interfaces to the 0.3 compat transport, so LangGraph Platform agents connect again - [PR #37917](https://github.com/BerriAI/litellm/pull/37917)
- **General**
    - Bill Gemini 3 grounding per unique web search query, matching Google's documented billing rule instead of charging duplicate queries - [PR #36397](https://github.com/BerriAI/litellm/pull/36397)
    - Bound the Hugging Face config.json fetch in cost calculation with a 10 second timeout so a stalled connection cannot hang the process - [PR #38752](https://github.com/BerriAI/litellm/pull/38752)

## Management Endpoints / UI

#### Features

- **Auto Router**
    - Edit the auto-router tier set with custom classifier-defined tiers: name two to eight tiers, write their classifier definitions, pick models per tier, with keyword rules following renames and stored sets round-tripping byte-identically - [PR #38602](https://github.com/BerriAI/litellm/pull/38602), [PR #38603](https://github.com/BerriAI/litellm/pull/38603)
    - Add a Gemini Family preset, run the Lite preset's medium and complex tiers at their documented reasoning efforts, and run the Anthropic Family preset's reasoning tier on Opus at high thinking - [PR #38138](https://github.com/BerriAI/litellm/pull/38138), [PR #38482](https://github.com/BerriAI/litellm/pull/38482), [PR #38490](https://github.com/BerriAI/litellm/pull/38490)
    - Validate an auto-router config against the backend's dry-run endpoint before saving, so rejections show inline in the backend's own wording instead of a raw 400 - [PR #38595](https://github.com/BerriAI/litellm/pull/38595)
    - Center the cost-optimization savings hero on one headline figure with a supporting spend rail and a four-tile per-session metrics row - [PR #38470](https://github.com/BerriAI/litellm/pull/38470)
- **Usage and Logs**
    - Drill into failed requests on the caching page by error code, with the error classes behind each code on hover - [PR #38156](https://github.com/BerriAI/litellm/pull/38156)
    - Filter Request Logs by cache hit or miss, and see per-session cached counts plus each request's computed cache key in the detail view - [PR #38432](https://github.com/BerriAI/litellm/pull/38432), [PR #38442](https://github.com/BerriAI/litellm/pull/38442)
    - Hide internal health check rows in Request Logs with a new toolbar switch, backed by `exclude_internal_health_checks` on `/spend/logs/ui` and `/spend/logs/v2` - [PR #38391](https://github.com/BerriAI/litellm/pull/38391)
- **Teams and Keys**
    - Export the Teams list to CSV with budgets, model grants, rate limits and member budgets, covering all pages under the current filters and sorting - [PR #38436](https://github.com/BerriAI/litellm/pull/38436)
    - Jump from team and key model chips straight to the models page filtered to that exact model group - [PR #38626](https://github.com/BerriAI/litellm/pull/38626)
    - Set, edit and clear a model access group's shared budget from the new Model Access Group Budgets tab; `/access_group/list` now returns each group's spend and budget - [PR #38843](https://github.com/BerriAI/litellm/pull/38843)
    - Authorize router fallbacks against the calling key with opt-in `general_settings.enforce_fallback_model_access`, so a key locked to an access group is never served a fallback model it cannot call directly - [PR #38572](https://github.com/BerriAI/litellm/pull/38572)
- **Models + Endpoints**
    - Hide currently-unhealthy models from `/models`, `/v1/models/{id}` and `/model/info` with opt-in `general_settings.model_list_healthy_only`, plus a `healthy_only` query param on `/model/info` - [PR #38313](https://github.com/BerriAI/litellm/pull/38313)
    - Page through the public Model Hub with the new paginated `GET /public/v1/model_hub`, with sorting, search and filters, resolving health only for the visible slice - [PR #38636](https://github.com/BerriAI/litellm/pull/38636)
- **Dark Mode and Theming**
    - Toggle light and dark with one click on the sun/moon icon, and give Docs and Blog one shared style in the top bar - [PR #38601](https://github.com/BerriAI/litellm/pull/38601)
    - Keep every provider logo readable in dark mode by flattening black marks to white and plating dark multicolor marks, 36 logos in all - [PR #38588](https://github.com/BerriAI/litellm/pull/38588)
- **Design System**
    - Move the dashboard onto class-variance-authority and CLI-owned shadcn primitives (field, alert, label, textarea, separator, skeleton), so `shadcn add` output compiles cleanly and status badges render one way everywhere - [PR #38125](https://github.com/BerriAI/litellm/pull/38125), [PR #38126](https://github.com/BerriAI/litellm/pull/38126), [PR #38300](https://github.com/BerriAI/litellm/pull/38300), [PR #38302](https://github.com/BerriAI/litellm/pull/38302)
    - Move every page header onto the shared PageHeader, so titles, icons, control rows and edge padding match across pages - [PR #38306](https://github.com/BerriAI/litellm/pull/38306)
    - Replace hand-picked z-index values with one named, linted scale so popups always paint above dialogs, and open select popups below their trigger instead of over it - [PR #38282](https://github.com/BerriAI/litellm/pull/38282), [PR #38554](https://github.com/BerriAI/litellm/pull/38554)
- **Health Checks**
    - Scope background health checks and health-check routing to chosen model groups with `general_settings.background_health_check_model_groups`, and merge shared-Redis health state per deployment instead of overwriting it - [PR #38539](https://github.com/BerriAI/litellm/pull/38539)
- **Terraform**
    - Reach resource and data-source parity with the community provider: 13 new resources, 31 new data sources, `terraform import` on every resource, and key update/read fixes - [PR #38158](https://github.com/BerriAI/litellm/pull/38158)
    - Manage JWT claim-to-key mappings declaratively with the new `litellm_jwt_key_mapping` resource - [PR #38714](https://github.com/BerriAI/litellm/pull/38714)
    - Gate CI on Terraform coverage of every management endpoint in the latest OpenAPI spec, with stale allowlist entries failing the gate too - [PR #38710](https://github.com/BerriAI/litellm/pull/38710), [PR #38720](https://github.com/BerriAI/litellm/pull/38720)
- **Helm**
    - Route extra ingress paths (passthrough and custom endpoints) in the componentized chart with the new `ingress.extraPaths` value - [PR #35700](https://github.com/BerriAI/litellm/pull/35700)

#### Bugs

- **Auto Router**
    - Disable the submit button when the LLM classifier has no model or a keyword rule names a missing tier, instead of failing the save with a raw 400 - [PR #38427](https://github.com/BerriAI/litellm/pull/38427)
    - Show the Custom Technical Keywords control on every router shape whose scorer runs, not just the plain heuristic - [PR #38451](https://github.com/BerriAI/litellm/pull/38451)
    - Carry a preset's per-tier `litellm_params`, such as `reasoning_effort`, through the prefill into the saved router - [PR #38453](https://github.com/BerriAI/litellm/pull/38453)
    - Order the auto-routers table newest first so a just-created router lands on page one - [PR #38545](https://github.com/BerriAI/litellm/pull/38545)
    - Let classifier numeric fields be edited in place instead of instantly refilling their default on backspace - [PR #38803](https://github.com/BerriAI/litellm/pull/38803)
    - Read the tier set through one shared row list and drop a stray `, ]` from the test dialog footers - [PR #38408](https://github.com/BerriAI/litellm/pull/38408)
- **Usage and Logs**
    - Keep what the user types in server-searched pickers: a picked user, team or error code no longer clobbers new queries, deletions or pastes on the Usage, Logs and Create Key pickers - [PR #38475](https://github.com/BerriAI/litellm/pull/38475), [PR #38574](https://github.com/BerriAI/litellm/pull/38574), [PR #38830](https://github.com/BerriAI/litellm/pull/38830)
    - Keep the usage filter on screen, disabled with a reason, when the caller's scope has nothing to filter - [PR #38581](https://github.com/BerriAI/litellm/pull/38581)
    - Restore the reopen control for the log drawer's trace sidebar after collapsing it - [PR #38782](https://github.com/BerriAI/litellm/pull/38782)
- **Playground**
    - Label a LiteLLM response-cache replay as "Response Cache: Hit" instead of a stale provider prompt-cache chip, and expose `x-litellm-cache-key` through CORS so the dashboard can read it - [PR #37951](https://github.com/BerriAI/litellm/pull/37951)
    - Read reasoning tokens from the Responses API's `output_tokens_details` so the reasoning chip shows for `/v1/responses` calls - [PR #37952](https://github.com/BerriAI/litellm/pull/37952)
    - Let `llm_api` virtual keys read `/model_group/info` so the playground model picker lists the key's models - [PR #38662](https://github.com/BerriAI/litellm/pull/38662)
- **Teams and Keys**
    - Render team and org TPM/RPM limits of 0 as 0 instead of Unlimited, and keep a stored 0 through an untouched Edit Member save - [PR #37916](https://github.com/BerriAI/litellm/pull/37916)
    - Repoint the key detail URL at the rotated hash after regenerating, so the page survives a reload instead of reading "Key not found" - [PR #37968](https://github.com/BerriAI/litellm/pull/37968)
    - Keep `/key/update`, `/key/block` and `/key/regenerate` succeeding when Redis refuses the cache eviction; the failure logs a warning instead of surfacing as a misleading auth error - [PR #38308](https://github.com/BerriAI/litellm/pull/38308)
    - Serialize `/team/member_add`, `/team/member_delete` and `/team/delete` under the team's advisory lock, closing races that let member references survive a delete or resurrect a removed member - [PR #37969](https://github.com/BerriAI/litellm/pull/37969)
- **Models + Endpoints**
    - Keep focus in the Add Model public name input while typing, and restore the Public Model Name tooltip's readable layout - [PR #38366](https://github.com/BerriAI/litellm/pull/38366), [PR #37986](https://github.com/BerriAI/litellm/pull/37986)
    - Drop the stray `, ]` next to Close in the model and search tool connection test dialogs, and type search tool params from the generated OpenAPI schema - [PR #38852](https://github.com/BerriAI/litellm/pull/38852), [PR #38633](https://github.com/BerriAI/litellm/pull/38633)
    - Link the Virtual Keys hint through the migrated `/ui/api-keys` route instead of the legacy `/public` path that 404s on componentized deployments - [PR #38596](https://github.com/BerriAI/litellm/pull/38596)
    - List all non-team models for users with an empty model list, matching call-time auth and intersecting with the calling key's own grant - [PR #38249](https://github.com/BerriAI/litellm/pull/38249)
- **Dark Mode and Theming**
    - Make playground chat bubbles and the created-key box follow the dark theme instead of staying white - [PR #37978](https://github.com/BerriAI/litellm/pull/37978), [PR #37985](https://github.com/BerriAI/litellm/pull/37985)
    - Make code blocks and the logs JSON viewer pick their colors from the active theme so payloads stay readable in dark mode - [PR #38771](https://github.com/BerriAI/litellm/pull/38771), [PR #38778](https://github.com/BerriAI/litellm/pull/38778)
- **Guardrails and Policies**
    - Render tag-based guardrail modes as a readable string instead of crashing the guardrails page - [PR #37493](https://github.com/BerriAI/litellm/pull/37493)
    - Stack the policy Flow Builder below the popup layer so its guardrail dropdown renders options - [PR #38273](https://github.com/BerriAI/litellm/pull/38273)
- **SSO and Authentication**
    - Resolve the highest-privilege Entra app role instead of the first in the claim, so `proxy_admin` no longer loses to `internal_user` on claim ordering - [PR #36728](https://github.com/BerriAI/litellm/pull/36728)
    - Match trailing-wildcard prefixes like `/internal-models/*` in JWT `team_allowed_routes` and `admin_allowed_routes` - [PR #37756](https://github.com/BerriAI/litellm/pull/37756)
- **SCIM**
    - Return `user_id` as Group `members[].value` and preserve existing team memberships when a POST /Users adoption carries no groups, so IdP reconciliation converges without membership churn - [PR #38161](https://github.com/BerriAI/litellm/pull/38161), [PR #38166](https://github.com/BerriAI/litellm/pull/38166)
    - Apply `default_team_params` (models, budgets, limits) to SCIM-created teams instead of granting All Proxy Models - [PR #38433](https://github.com/BerriAI/litellm/pull/38433)
- **Health Checks**
    - Strip every credential-bearing field (`client_secret`, `azure_ad_token`, `aws_session_token`, custom headers, Vertex credentials) from `GET /health` output, closing a leak path in both healthy and unhealthy entries - [PR #37090](https://github.com/BerriAI/litellm/pull/37090)
    - Keep `/health/readiness` returning 200 during a DB outage when `allow_requests_on_db_unavailable` is on, with the whole probe-path DB check under a 4s deadline - [PR #37640](https://github.com/BerriAI/litellm/pull/37640)
    - Apply `model_info.health_check_params` to health probes and the UI's Test Connection, so deployments needing extra params (like Bedrock Pegasus `mediaSource`) can pass - [PR #38101](https://github.com/BerriAI/litellm/pull/38101)
    - Probe `mode: image_edit` deployments with a real image edit call, and count a provider moderation verdict as healthy rather than an outage - [PR #38291](https://github.com/BerriAI/litellm/pull/38291), [PR #38417](https://github.com/BerriAI/litellm/pull/38417)
    - Probe Azure GA realtime with `intent=transcription` for transcription-only models instead of the beta path that always returns 400 - [PR #38390](https://github.com/BerriAI/litellm/pull/38390)
    - Report auto-router health from the models behind it: skip the impossible direct probe on strategy routers and flag a router whose tier, default or classifier model cannot serve, naming the broken model - [PR #37966](https://github.com/BerriAI/litellm/pull/37966), [PR #38174](https://github.com/BerriAI/litellm/pull/38174)
- **Helm and Deployment**
    - Boot the UI image as an arbitrary uid (OpenShift restricted-v2) by anchoring nginx writes under /tmp, which also enables readOnlyRootFilesystem with a single /tmp emptyDir - [PR #37982](https://github.com/BerriAI/litellm/pull/37982)
- **MCP**
    - Forward saved OAuth issuer, authorization, token and registration URLs from the MCP server edit form so Authorize & Fetch Token starts the real OAuth flow instead of returning a 400 - [PR #38154](https://github.com/BerriAI/litellm/pull/38154)
- **General**
    - Correct the skill install command and marketplace setup UX - [PR #33514](https://github.com/BerriAI/litellm/pull/33514)

## AI Integrations

### Logging

- **[OpenTelemetry](../../docs/observability/opentelemetry_integration)**
    - Set the span `service.name` per key or team via `otel_service_name` metadata on OTel v2 destinations, with `OTEL_SERVICE_NAME` as the fallback - [PR #38532](https://github.com/BerriAI/litellm/pull/38532)
    - Root credential-routed tenant spans in their own trace with a link back to the operator-side request trace, so per-team backends stop rendering missing-parent fragments - [PR #38847](https://github.com/BerriAI/litellm/pull/38847)
    - Run `/v1/messages` provider errors through the same exception mapping as `/v1/chat/completions` before failure logging, so error spans carry the provider and the upstream status survives - [PR #38310](https://github.com/BerriAI/litellm/pull/38310)
- **[Langfuse](../../docs/proxy/logging#langfuse)**
    - Support `langfuse_environment` as a per-key dynamic callback param, and warn and fall back to the default environment on an invalid `LANGFUSE_TRACING_ENVIRONMENT` instead of failing requests - [PR #38264](https://github.com/BerriAI/litellm/pull/38264), [PR #38582](https://github.com/BerriAI/litellm/pull/38582)
- **[Prometheus](../../docs/proxy/prometheus)**
    - Add `prometheus_deployment_and_latency_caller_identity` to expose the caller's alias, email, or both on the deployment and latency metric families, including early failure counters - [PR #38221](https://github.com/BerriAI/litellm/pull/38221)
- **[New Relic](../../docs/proxy/logging)**
    - Route each team's traces to its own New Relic account and region via the `newrelic` team callback, and emit per-team cost, token, request, and latency metrics with the same credentials - [PR #37603](https://github.com/BerriAI/litellm/pull/37603), [PR #37610](https://github.com/BerriAI/litellm/pull/37610)
- **[LangSmith](../../docs/proxy/logging)**
    - Keep root-run ids self-consistent so requests carrying a session or trace header stop making LangSmith reject the whole ingest batch - [PR #38116](https://github.com/BerriAI/litellm/pull/38116)
- **Alerting**
    - Add a native `ms_teams` alerting destination that posts Adaptive Cards to a Teams incoming webhook, configurable via `general_settings.alerting` or the Admin UI, with test alerts on `/health/services?service=ms_teams` - [PR #38367](https://github.com/BerriAI/litellm/pull/38367)
- **General**
    - Add `async_post_call_failure_deployment_hook`, firing once per failed deployment attempt with the fallback depth, so callbacks can count every hop in a fallback chain - [PR #36657](https://github.com/BerriAI/litellm/pull/36657)
    - Stop billing and logging stored-response reads as LLM calls, so polling a stored response back books no extra spend and logs no placeholder prompt - [PR #36890](https://github.com/BerriAI/litellm/pull/36890)
    - Percent-encode S3 object keys exactly once so s3_v2 log uploads whose keys contain `=` stop failing with 403 - [PR #38005](https://github.com/BerriAI/litellm/pull/38005)
    - Skip traceback formatting for the proxy's own expected 4xx rejections to cut failure-logging CPU (restore with `litellm.log_client_error_tracebacks`), while provider-originated 4xx errors keep their tracebacks - [PR #38102](https://github.com/BerriAI/litellm/pull/38102), [PR #38296](https://github.com/BerriAI/litellm/pull/38296)
    - Persist `attempted_fallbacks` and `original_model_group` into spend log metadata so each row shows whether a fallback served the request - [PR #38107](https://github.com/BerriAI/litellm/pull/38107)
    - Treat the redaction sentinel as empty tool call arguments instead of parsing it, keep redacted tool calls replayable via `previous_response_id`, and preserve `null` assistant content under `turn_off_message_logging` - [PR #38169](https://github.com/BerriAI/litellm/pull/38169), [PR #38182](https://github.com/BerriAI/litellm/pull/38182)
    - Rescue dequeued logging tasks at event-loop close so cache-hit success callbacks fire in short-lived SDK scripts - [PR #38394](https://github.com/BerriAI/litellm/pull/38394)
    - Write records below WARNING to stdout with ANSI colors only on a TTY, and enable JSON logs only when `JSON_LOGS=true`, so stream-based collectors stop classifying INFO logs as errors - [PR #38476](https://github.com/BerriAI/litellm/pull/38476)
    - Preserve a missing end user as `null` instead of `""` in callback payloads - [PR #38642](https://github.com/BerriAI/litellm/pull/38642)

### Guardrails

- **[Lakera](../../docs/proxy/guardrails/lakera_ai)**
    - Honor `skip_system_message_in_guardrail` and `skip_tool_message_in_guardrail` on Lakera v2, and add an `inject_system_message` advisory mode that lets the LLM weigh a flag instead of blocking - [PR #34940](https://github.com/BerriAI/litellm/pull/34940)
    - Mask flagged Responses API bodies in monitor mode again, so requests carrying `instructions` stop forwarding unmasked PII to the model - [PR #38841](https://github.com/BerriAI/litellm/pull/38841)
- **[Bedrock Guardrails](../../docs/proxy/guardrails/bedrock)**
    - Forward `aws_external_id` when the guardrail assumes a cross-account role, so roles requiring `sts:ExternalId` stop failing with AccessDenied - [PR #38376](https://github.com/BerriAI/litellm/pull/38376)
- **[Azure Prompt Shield](../../docs/proxy/guardrails/azure_content_guardrail)**
    - Track per-request usage and cost from `cost_tier` and `price_per_1000_text_records`, reported on the spend log entry, the guardrail OTel span, and the logs page while staying out of budgets and model spend - [PR #38387](https://github.com/BerriAI/litellm/pull/38387)
- **[Presidio](../../docs/proxy/guardrails/pii_masking_v2)**
    - Chunk oversized text before `/analyze` (tunable via `presidio_analyze_chunk_size_bytes`) so large content blocks stop failing against analyzer body caps - [PR #38483](https://github.com/BerriAI/litellm/pull/38483)
- **[CrowdStrike AIDR](../../docs/proxy/guardrails/crowdstrike_aidr)**
    - Add opt-in fail-open via `fail_on_error: false`, reading a delivered block verdict before schema validation and recording fail-open runs as `guardrail_failed_to_respond` in telemetry - [PR #38568](https://github.com/BerriAI/litellm/pull/38568)
- **General**
    - Carry `tool_reference` tool results through the guardrail translation round trip, so Claude Code sessions behind message-rewriting guardrails stop dying with tool-use 400s on deferred tool loads - [PR #38465](https://github.com/BerriAI/litellm/pull/38465)
    - Let the AI policy suggester drop sampling params its model refuses, and return a clear 400 for models without tool calling - [PR #38594](https://github.com/BerriAI/litellm/pull/38594)
    - Record post_call guardrail scans on native `/v1/messages` streams so the spend log and Guardrails Monitor show the output scan - [PR #38713](https://github.com/BerriAI/litellm/pull/38713)

### Prompt Management

- **General**
    - Reject the ambiguous keyed `prompt_data` plus `prompt_id` combination with a 400 instead of silently storing an empty template, resolve `.vN` ids on the prompt hooks, and return real `version`, `environment`, and `created_by` values on create - [PR #38404](https://github.com/BerriAI/litellm/pull/38404)
    - Apply prompt templates before routing on `/v1/responses` so a prompt's model swap resolves the swapped provider's credentials, and honor `ignore_prompt_manager_model` saved on the prompt - [PR #38407](https://github.com/BerriAI/litellm/pull/38407)
    - Propagate prompt PATCHes and DELETEs to every worker and pod through the periodic DB sync, unregistering stale callbacks along the way - [PR #38411](https://github.com/BerriAI/litellm/pull/38411), [PR #38434](https://github.com/BerriAI/litellm/pull/38434)

### Secret Managers

- **[CyberArk Conjur](../../docs/secret_managers/cyberark)**
    - Configure CyberArk Conjur from the Admin UI with new `/config_overrides/cyberark` endpoints, secrets encrypted at rest and masked in responses, connection testing, and hot reload across pods - [PR #38445](https://github.com/BerriAI/litellm/pull/38445)

## Spend Tracking, Budgets and Rate Limiting

- **[Budgets and Rate Limiting](../../docs/proxy/users)**
    - Track per-window budget spend in a new `LiteLLM_BudgetWindowSpend` table and read enforcement from it by primary key, so window budget checks no longer aggregate `LiteLLM_SpendLogs` on large tables - [PR #35854](https://github.com/BerriAI/litellm/pull/35854), [PR #35887](https://github.com/BerriAI/litellm/pull/35887)
    - Add an opt-in `budget_rollover` setting that carries over-cap spend into the next window instead of forgiving it at reset, and keep the proxy starting on Python 3.11 after the rollover change - [PR #38514](https://github.com/BerriAI/litellm/pull/38514), [PR #38687](https://github.com/BerriAI/litellm/pull/38687)
    - Enforce shared budgets on model access groups: set one budget on a group via `PUT /access_group/{group}/budget` and every key using the group draws from the same pool - [PR #38784](https://github.com/BerriAI/litellm/pull/38784)
    - Add opt-in flags that require positive rpm and tpm limits when adding a model (`enforce_rpm_tpm_on_model_add`) or creating and updating a project (`enforce_project_model_quota`) - [PR #36518](https://github.com/BerriAI/litellm/pull/36518), [PR #36514](https://github.com/BerriAI/litellm/pull/36514)
    - Unstick budget-blocked team members: `/team/member_update` budget changes now take effect immediately on every pod, a new `POST /team/{team_id}/member/{user_id}/reset_spend` resets a member's tracked spend, and the budget-exceeded error names the blocking entity - [PR #37971](https://github.com/BerriAI/litellm/pull/37971)
    - Reset a key's per-window budget counters (e.g. a daily cap) on spend reset and broadcast the cache eviction to every pod, so a reset key stops returning 429s - [PR #38686](https://github.com/BerriAI/litellm/pull/38686)
    - Allow team member default budgets that never reset; an explicit null `team_member_budget_duration` now clears the reset period instead of inheriting the team's - [PR #37708](https://github.com/BerriAI/litellm/pull/37708)
    - Serialize `model_max_budget` before the `/budget/update` write, so per-model caps can be set on existing budgets instead of returning a 500 - [PR #38430](https://github.com/BerriAI/litellm/pull/38430)
    - Add `soft_budget`, `tags`, and `soft_budget_alerting_emails` to the Terraform provider's `litellm_team` resource, with reads decoding the `/team/info` envelope so plans stay in sync - [PR #37918](https://github.com/BerriAI/litellm/pull/37918)
- **Prompt Caching Savings**
    - Report prompt caching savings as both the total caching saved and the subset LiteLLM's own injection earned, and stop fallback legs inheriting a sibling deployment's injection credit - [PR #38134](https://github.com/BerriAI/litellm/pull/38134)
- **Cost Optimization**
    - Measure both arms' cost in shadow evals, routing classifier included, so a job reports what the auto-router would have saved (or cost) next to its win rate - [PR #38631](https://github.com/BerriAI/litellm/pull/38631)
    - Count the auto-router's own LLM classifier charge in savings figures and benchmarks, so a losing router config no longer reads as saved money - [PR #38835](https://github.com/BerriAI/litellm/pull/38835)
- **[Cost Calculation](../../docs/proxy/cost_tracking)**
    - Track cost, spend and budgets for Google Interactions API requests, including streaming, background interactions billed exactly once on poll, and `google_search` grounding per query - [PR #33310](https://github.com/BerriAI/litellm/pull/33310)
    - Emit latency and cost headers on `/rerank`, including the `LITELLM_DETAILED_TIMING` breakdown - [PR #35419](https://github.com/BerriAI/litellm/pull/35419)
    - Price streamed traffic that previously logged $0: resolve slash-containing model aliases to a real cost key, bill native Gemini streams as the provider that served them, bill the model a streaming router (e.g. Fireworks FireRouter) actually served, and carry response cost and Anthropic citations through `stream_chunk_builder` - [PR #38344](https://github.com/BerriAI/litellm/pull/38344), [PR #36055](https://github.com/BerriAI/litellm/pull/36055), [PR #38656](https://github.com/BerriAI/litellm/pull/38656), [PR #38696](https://github.com/BerriAI/litellm/pull/38696)
    - Bill cached tokens correctly: parse Bedrock Converse's 1h/5m `cacheDetails` cache-write split, run Databricks through the cache-aware calculator (adding cache rates and five missing Claude entries), and cap each modality at what the cache did not cover so cached image tokens are no longer billed twice - [PR #36762](https://github.com/BerriAI/litellm/pull/36762), [PR #37975](https://github.com/BerriAI/litellm/pull/37975), [PR #37407](https://github.com/BerriAI/litellm/pull/37407)
    - Scale Anthropic cache read and write costs by fast mode and trust the served `speed` in response usage, so standard-served requests stop billing at fast rates - [PR #38378](https://github.com/BerriAI/litellm/pull/38378)
    - Apply Together AI per-model registry rates and cache-read pricing to models whose names carry a parameter size, and price the `/v1/messages` cost header by the deployment model rather than the client alias - [PR #38280](https://github.com/BerriAI/litellm/pull/38280), [PR #38691](https://github.com/BerriAI/litellm/pull/38691)
    - Make cost-breakdown headers respect the request's service tier, and carry Gemini web search cost into `/v1/messages` breakdown headers so all surfaces agree - [PR #38424](https://github.com/BerriAI/litellm/pull/38424), [PR #38439](https://github.com/BerriAI/litellm/pull/38439)
- **[Realtime and Audio Billing](../../docs/realtime)**
    - Bill Gemini Live native-audio output tokens at the audio rate on both the Gemini API and Vertex surfaces, and price `vertex_ai/gemini-live-2.5-flash-native-audio` GA sessions, with realtime cost falling through to `base_model` - [PR #38457](https://github.com/BerriAI/litellm/pull/38457), [PR #38419](https://github.com/BerriAI/litellm/pull/38419)
    - Bill trailing audio when a Gemini transcribe Live session closes mid-turn, so hanging up no longer makes streamed audio free - [PR #38563](https://github.com/BerriAI/litellm/pull/38563)
    - Correct Gemini TTS audio-output rates and native-audio Live API rates to Google's published pricing - [PR #38412](https://github.com/BerriAI/litellm/pull/38412)
- **Spend Logs**
    - Store the model Azure Model Router actually selected in spend logs, whatever the model group is named - [PR #37770](https://github.com/BerriAI/litellm/pull/37770)
    - Attribute spend and release budget reservations on router-model `/vllm` and `/azure` passthrough calls, so budgeted keys log real spend instead of $0 and false 429s - [PR #38111](https://github.com/BerriAI/litellm/pull/38111)
    - Keep schema reconciliation working on a partitioned `LiteLLM_SpendLogs` table, and fail fast with guidance when `db push` targets one - [PR #38452](https://github.com/BerriAI/litellm/pull/38452)
    - Quiet misleading `register_model` unresolved-cost warnings at startup; warn only for entries with incomplete custom pricing, naming the model instead of a hashed id - [PR #38542](https://github.com/BerriAI/litellm/pull/38542)
- **Model Pricing Map**
    - Audit the registry against live provider pricing: add missing Novita, DeepInfra, W&B, Together, Fireworks, Gemini, Mistral, Groq, Z.AI, Moonshot and xAI models, reprice retired xAI slugs, and fill in deprecation dates - [PR #38207](https://github.com/BerriAI/litellm/pull/38207), [PR #38560](https://github.com/BerriAI/litellm/pull/38560), [PR #38804](https://github.com/BerriAI/litellm/pull/38804)
    - Raise Bedrock Mantle GPT-5.6/5.5/5.4 `max_input_tokens` to Mantle's enforced 1,050,000, add the missing above-272K pricing tiers, and align sol rates with the AWS invoice - [PR #38225](https://github.com/BerriAI/litellm/pull/38225), [PR #38368](https://github.com/BerriAI/litellm/pull/38368), [PR #38615](https://github.com/BerriAI/litellm/pull/38615)
    - Add the 1.1x US data residency uplift to claude-sonnet-4-6 and mythos entries, price Claude 3 Haiku and Opus 1-hour cache writes at 2x input, and correct `prompt_cache_min_tokens` to 512 on Claude Fable 5 entries so prompt-cache-affinity routing engages - [PR #38369](https://github.com/BerriAI/litellm/pull/38369), [PR #38371](https://github.com/BerriAI/litellm/pull/38371), [PR #38405](https://github.com/BerriAI/litellm/pull/38405)
    - Bill Gemini `-latest`/preview alias cache reads at 10% of input, correct Vertex flash-lite flex cache-read pricing, and add Azure gpt-5.6 cache-write rates with US/EU priority corrected to 1.1x Global - [PR #38423](https://github.com/BerriAI/litellm/pull/38423), [PR #38422](https://github.com/BerriAI/litellm/pull/38422), [PR #38370](https://github.com/BerriAI/litellm/pull/38370)
    - Add 21 missing Together AI serverless models with pricing and capability flags, and let a map entry declare its exact `reasoning_effort_levels` (used by Kimi K3) - [PR #38230](https://github.com/BerriAI/litellm/pull/38230), [PR #38481](https://github.com/BerriAI/litellm/pull/38481)

## MCP Gateway

- **OAuth and session tokens**
    - Send the named `WWW-Authenticate` challenge DCR bridge clients need to start or restart OAuth, admitting credential-free requests only for the named bridge while keeping full LiteLLM key validation - [PR #37384](https://github.com/BerriAI/litellm/pull/37384)
    - Match the DCR access envelope lifetime to the provider's `expires_in` (one-hour fallback when omitted) and avoid premature refresh-token rotation, ending hourly reconnect prompts for long-lived provider tokens - [PR #38271](https://github.com/BerriAI/litellm/pull/38271)
    - Honor admin-entered authorize, token, and register URLs when OAuth discovery fails or a pinned issuer yields nothing, so the UI Authorize button redirects to the stored URL instead of returning 400 - [PR #38379](https://github.com/BerriAI/litellm/pull/38379)
    - Canonicalize `Bearer` casing on bridge egress so upstreams that reject lowercase `bearer` keep serving tools after a token refresh - [PR #38398](https://github.com/BerriAI/litellm/pull/38398)
    - Route a gateway-resolved OAuth token to a custom upstream header with per-server `upstream_token_header`, so a static `Authorization` and the minted token both reach servers behind an API gateway - [PR #38456](https://github.com/BerriAI/litellm/pull/38456)
    - Keep the user's upstream OAuth `Authorization` on `tools/call` when the MCP JWT signer hook injects headers, matching the existing `tools/list` behavior - [PR #38555](https://github.com/BerriAI/litellm/pull/38555)
    - Add an authenticated RFC 7662 `POST /introspect` endpoint for gateway session tokens, plus optional RS256 signing with `kid`-based rotation via `general_settings.mcp_session_token_signing`, so external validators never need the signing secret - [PR #38726](https://github.com/BerriAI/litellm/pull/38726), [PR #38728](https://github.com/BerriAI/litellm/pull/38728)
- **Tools and admission**
    - Accept a raw `x-litellm-api-key` (with or without a `Bearer ` prefix) on MCP streamable HTTP admission - [PR #38364](https://github.com/BerriAI/litellm/pull/38364)
    - Add a `litellm[mcp]` extra pinning `mcp>=1.28.1,<2.0`, and name the exact version floor and fix when streamable HTTP support is missing instead of silently serving zero tools - [PR #38399](https://github.com/BerriAI/litellm/pull/38399)
    - Bulk-import Anthropic MCP connectors through `POST /v1/mcp/server/import` and an "Import from JSON" button in the admin UI, with per-entry results and encrypted header credentials - [PR #38444](https://github.com/BerriAI/litellm/pull/38444)
    - Let `/key/update` keep or shrink a key's existing MCP server grants; only newly added out-of-team servers are rejected - [PR #38463](https://github.com/BerriAI/litellm/pull/38463)
- **Observability**
    - Anchor MCP tool-call spans to the gateway's own trace and carry the client's propagated context as a span link, so IDE-agent tool calls render as one complete trace in APM backends - [PR #38317](https://github.com/BerriAI/litellm/pull/38317)
- **A2A**
    - Search the agent registry semantically with `GET /v1/agents?query=...&top_k=...` and a new `agent_search` MCP tool; results cover only agents the calling key can access, carry a per-agent `search_score`, and bill embedding spend to the calling key - [PR #38609](https://github.com/BerriAI/litellm/pull/38609)
- **General**
    - Deflake the MCP folder CI job by draining queued logging between tests, alongside PTU rollup, license-check retry, and pricing test isolation fixes - [PR #37833](https://github.com/BerriAI/litellm/pull/37833)

## Performance / Loadbalancing / Reliability improvements

- **Routing**
    - Resolve hidden model aliases on explicit lookup so ordered fallbacks behind an alias still fire, and resolve `model_group_alias` before pre-routing dispatch so an alias pointing at an auto-router works like the router's own name - [PR #38272](https://github.com/BerriAI/litellm/pull/38272), [PR #38382](https://github.com/BerriAI/litellm/pull/38382)
    - Keep config.yaml fallbacks when a DB router_settings row holds an empty `fallbacks` list, so a UI delete no longer wipes yaml failover on every boot - [PR #38406](https://github.com/BerriAI/litellm/pull/38406)
    - Support mid-stream fallback on `/v1/messages`: a retriable SSE `event: error` frame or a raised pre-content stream error (Bedrock) now re-enters the fallback chain like on `/chat/completions` - [PR #38153](https://github.com/BerriAI/litellm/pull/38153), [PR #38606](https://github.com/BerriAI/litellm/pull/38606)
    - Resolve the provider from `api_base` in deployment validation and `acompletion`, so a bare model plus a known endpoint loads instead of failing startup and returning "no healthy deployments" - [PR #38235](https://github.com/BerriAI/litellm/pull/38235)
    - Report per-group `supported_reasoning_efforts` on `/model_group/info`, intersected across deployments, and forward `max` through the chat-to-Responses bridge instead of dropping it - [PR #37897](https://github.com/BerriAI/litellm/pull/37897)
    - Scrub forwarded Authorization headers and provider credentials from retry and fallback breadcrumbs before they reach spend logs and logging callbacks - [PR #38133](https://github.com/BerriAI/litellm/pull/38133)
    - Leave the caller's metadata dict untouched when scrubbing fallback stamp keys, and strip client-supplied `attempted_fallbacks` / `original_model_group` at the proxy boundary so guardrail cost and status stay on the spend row - [PR #38586](https://github.com/BerriAI/litellm/pull/38586), [PR #38690](https://github.com/BerriAI/litellm/pull/38690)
    - Merge client `litellm_metadata` into `metadata` on chat routes so team and body tags keep driving tag routing instead of falling to the default deployment - [PR #38739](https://github.com/BerriAI/litellm/pull/38739)
    - Pin batch, file, and fine-tuning job operations to the model group that owns the id on fallback, so a foreign provider is never asked about a resource it did not issue - [PR #38742](https://github.com/BerriAI/litellm/pull/38742)
- **Complexity router (Auto Router)**
    - Add `classifier_type: heuristic_first`: cheap, confident local scores route immediately and only ambiguous prompts pay a classifier call - [PR #38428](https://github.com/BerriAI/litellm/pull/38428)
    - Bound the classifier context with one budget for the whole block instead of clipping every turn to 200 characters, and keep both ends of a turn that must be cut so the ask at the end survives - [PR #38141](https://github.com/BerriAI/litellm/pull/38141), [PR #38145](https://github.com/BerriAI/litellm/pull/38145)
    - Route a client's own housekeeping prompts, like a coding agent's conversation-title calls, to the cheapest tier with no classifier call - [PR #38598](https://github.com/BerriAI/litellm/pull/38598)
    - Accept `messages`, `system`, and `tools` on `/auto_router/test_routing` so a dry run replays real agentic traffic through the same routing the serving path runs - [PR #38590](https://github.com/BerriAI/litellm/pull/38590)
    - Add an Edit prompt dialog for custom tier sets that writes `classification_prompt` and previews the assembled classifier prompt from the proxy - [PR #38605](https://github.com/BerriAI/litellm/pull/38605)
    - Drop a tier param no deployment in the routed group can take instead of failing the whole tier with a 400, and let a tier-pinned `reasoning_effort` supersede the client's `thinking` and `output_config.effort` carriers - [PR #38622](https://github.com/BerriAI/litellm/pull/38622), [PR #38698](https://github.com/BerriAI/litellm/pull/38698)
    - Refuse a shadow-eval judge model that also serves one of the arms it grades, and validate Anthropic SDK judge credentials at job creation instead of letting the job fail mid-run - [PR #38589](https://github.com/BerriAI/litellm/pull/38589), [PR #38701](https://github.com/BerriAI/litellm/pull/38701)
    - List every configured auto-router in the usage picker, with idle ones reading zero instead of absent - [PR #38129](https://github.com/BerriAI/litellm/pull/38129)
- **Caching**
    - Use upstream `RedisCluster` unmodified on redis-py >= 7.2.0 so a stalled cluster node is absorbed by per-connection recovery instead of amplified into a connection storm - [PR #38171](https://github.com/BerriAI/litellm/pull/38171)
    - Support Redis credential providers on every client path (async, health checks, Sentinel), with an explicit provider outranking password, env, and URL credentials - [PR #38094](https://github.com/BerriAI/litellm/pull/38094)
    - Treat a Redis key as already namespaced only when it starts with `<namespace>:`, so internal spend buffers get the prefix and least-privilege ACLs no longer break spend tracking - [PR #38403](https://github.com/BerriAI/litellm/pull/38403)
    - Retry async Redis cache writes cancelled at event-loop shutdown so short-lived SDK scripts write the cache entry before exiting - [PR #38385](https://github.com/BerriAI/litellm/pull/38385)
    - Send the Fireworks `x-session-affinity` header only from a caller-supplied session id instead of the per-request trace id, keeping Fireworks prompt caching warm - [PR #35754](https://github.com/BerriAI/litellm/pull/35754)
    - Let cache-control auto-injection reach the system prompt built from Responses API `instructions`, so prompt-caching discounts apply on the bridge - [PR #38120](https://github.com/BerriAI/litellm/pull/38120)
- **Proxy runtime**
    - Drop guaranteed-miss lookups from the auth path: four wasted Redis reads per project/team-key request and the per-request DB query for the litellm-dashboard sentinel team - [PR #38073](https://github.com/BerriAI/litellm/pull/38073), [PR #38471](https://github.com/BerriAI/litellm/pull/38471)
    - Reassemble streamed SSE JSON fragments for Vertex and Anthropic with an O(1)-append accumulator, replacing per-chunk buffer copies that made large tool-call streams quadratic - [PR #36610](https://github.com/BerriAI/litellm/pull/36610)
    - Give every `requests` call a timeout (30 seconds for guardrail auth and management clients, 600 for chat) so a silent host cannot park a worker's event loop or hang the CLI - [PR #38234](https://github.com/BerriAI/litellm/pull/38234)
    - Run SMTP email sends in a worker thread with a connection timeout (`SMTP_TIMEOUT`, default 30s) so a hung mail server cannot stall `/health/liveliness` - [PR #38473](https://github.com/BerriAI/litellm/pull/38473)
    - Honor global `ssl_verify` on the `aiohttp_openai/` handler path - [PR #38400](https://github.com/BerriAI/litellm/pull/38400)
    - Keep every value of a repeated form key, so both `timestamp_granularities[]` values reach transcription instead of only the last - [PR #37908](https://github.com/BerriAI/litellm/pull/37908)
    - Honor `DATABASE_DISABLE_PREPARED_STATEMENTS` in componentized entrypoints so PgBouncer transaction pooling stops crashing on prepared-statement collisions - [PR #38363](https://github.com/BerriAI/litellm/pull/38363)
    - Read the post-write router reload from the writer DB so `/model/new` succeeds under read-replica lag - [PR #38580](https://github.com/BerriAI/litellm/pull/38580)
    - Sync search tools into the router on create, update, and delete, so a new tool serves immediately and a deleted one stops - [PR #38392](https://github.com/BerriAI/litellm/pull/38392)
    - Serve current `/openapi.json` docs for lazily loaded routes, with a CI drift guard, and keep MCP, CloudZero, Vantage, and config-override routes in the spec on DB-connected proxies - [PR #38410](https://github.com/BerriAI/litellm/pull/38410), [PR #38416](https://github.com/BerriAI/litellm/pull/38416)
    - Preserve provider service-tier metadata on streamed chunks so Vertex/Gemini flex streams bill at flex rates - [PR #38458](https://github.com/BerriAI/litellm/pull/38458)
    - Count `tools`, `system`, and Anthropic image and document blocks in the `/v1/messages/count_tokens` local fallback instead of ignoring or crashing on them - [PR #38657](https://github.com/BerriAI/litellm/pull/38657)
    - Resolve Headroom CCR retrieval on streaming chat completions, so clients get the streamed answer instead of a raw `headroom_retrieve` tool call - [PR #35017](https://github.com/BerriAI/litellm/pull/35017)
- **Error handling**
    - Map upstream status codes for providers with no `exception_type` branch (a bad MiniMax key now returns 401 instead of a retried 500; OpenAI-like 403 raises `PermissionDeniedError`), and keep a refused connection an `APIConnectionError` so healthy deployments are not cooled down - [PR #38318](https://github.com/BerriAI/litellm/pull/38318), [PR #38624](https://github.com/BerriAI/litellm/pull/38624)
    - Map unmapped exceptions even when model and provider are both unset, instead of surfacing an `UnboundLocalError` - [PR #38496](https://github.com/BerriAI/litellm/pull/38496)
    - Skip stream chunks without a `choices` key in `stream_chunk_builder` instead of turning them into a 500 - [PR #34382](https://github.com/BerriAI/litellm/pull/34382)
- **SDK**
    - Carry queued logging tasks onto a new event loop instead of silently dropping spend and observability events across `asyncio.run()` boundaries - [PR #38144](https://github.com/BerriAI/litellm/pull/38144)
    - Count claude tokens in `prompt_token_calculator` with litellm's own `token_counter`, dropping the dead anthropic SDK path that raised `AttributeError` - [PR #38130](https://github.com/BerriAI/litellm/pull/38130)
    - Dispose the aiohttp session when `AsyncHTTPHandler` is finalized without a running event loop - [PR #36670](https://github.com/BerriAI/litellm/pull/36670)
    - Replace `Any` with real types across 178 backend files, typing each JSON boundary once with TypedDicts and Protocols - [PR #38501](https://github.com/BerriAI/litellm/pull/38501)

## Documentation Updates

Documentation now lives in [BerriAI/litellm-docs](https://github.com/BerriAI/litellm-docs), so doc changes in this window are counted there rather than in this repository's PR set.

### PR roll-up by ownership area

PRs by ownership area (total: 392)

- Other (CI / chore / tests / build / version bumps): 70
- Performance: 55
- Spend / Budgets / Rate Limits: 53
- UI: 53
- LLM API Endpoints: 49
- Models & Providers: 35
- Auth & Management: 25
- Logging: 21
- MCP: 16
- Guardrails: 9
- Prompt Management: 4
- Docs: 1
- Secret Managers: 1

## End-to-End Testing

We are investing heavily in end-to-end testing to cut regressions and make LiteLLM more stable release over release. Every version is exercised by a live suite that runs against a real deployed proxy and hits real provider endpoints, not mocks, so the behavior we validate is the behavior you get in production.

This window added 51 test-only pull requests, 18 of them touching the live e2e suite. The headline change is that the e2e suite now records itself: a Saturday run exercises the real providers and publishes a pinned fixture bundle, and weekday runs replay that bundle by digest with zero provider egress, guarded by a sentinel that fails the run if a single connection escapes and a hard failure on any stale bundle. The Postgres suites moved off CircleCI onto GitHub Actions service containers, and the enterprise package suite (244 tests covering guardrails, auth, and management endpoints) now runs as a required GitHub Actions check, with enterprise coverage measured for the first time. The mutation-testing workflow, silent for months, generates and scores mutants again, and follow-up work closed gaps that had left 149 mutants alive in the container, skills, and openai-like config factories. New ruff gates hold the line on test quality: TQ008 refuses new tests that patch litellm internals, B003 bans swapping out os.environ for a plain dict, and fifteen assertion and handler rules reject tests that cannot fail. A new contract table pins the status and error shape every provider failure maps to, 25 providers by 9 upstream statuses asserted end to end, so changing any provider's mapping now has to be a deliberate edit to the table. Together AI, freshly overhauled, gained regression suites across the chat, responses, and messages surfaces plus live e2e coverage of reasoning, tool calls, template kwargs, json_schema, cache-read pricing, and cost tracking against the real API.

The rest of the window closed coverage gaps and hardened what already runs. Forty-five caching tests that ran in no job at all now run on every PR, the migration DDL guard finally executes and row-rewriting DML is banned from migrations outright, and managed-files enforcement, the Bedrock combinations customers actually run, logging delivery read back from real S3, GCS, team Langfuse, and DataDog destinations, and the Admin UI's own key create and edit path all have live coverage for the first time, alongside newly pinned contracts for request validation, cost estimation, tiered-pricing rate fallbacks, the Azure AI 422 retry, and Prometheus caller-identity config validation. On the flake front, logging-worker drains stopped MCP and RAG tests bleeding into their neighbors, the vision tests serve their image from a repo fixture instead of Wikipedia, reasoning-model token budgets no longer starve one-word answers on Gemini and gpt-5.5, cache priming sizes its prefix deterministically above the cacheable minimum, tool-call and replayed-reasoning cases tolerate model nondeterminism without excusing a broken proxy, the router-fallback and cost-header cases wait out multi-replica config propagation, the harness retries saturated-upstream failures it previously mislabeled as regressions, the Vertex realtime suite moved off a retired model, and previously skipped cases covering per-model budget updates, batches validation, and three MCP flows are running again. A sweep of fixes also took the staging branch's own checks from red to green, so a contributor's PR status once again reflects only their own change.

## New Contributors

- @ozolam made their first contribution in [PR #33514](https://github.com/BerriAI/litellm/pull/33514)
- @AkshaySasi made their first contribution in [PR #34382](https://github.com/BerriAI/litellm/pull/34382)
- @Hamjaster made their first contribution in [PR #35754](https://github.com/BerriAI/litellm/pull/35754)
- @ump45nose made their first contribution in [PR #35940](https://github.com/BerriAI/litellm/pull/35940)
- @ousamabenyounes made their first contribution in [PR #36397](https://github.com/BerriAI/litellm/pull/36397)
- @ansh-agrawal made their first contribution in [PR #36514](https://github.com/BerriAI/litellm/pull/36514)
- @imranismail made their first contribution in [PR #36728](https://github.com/BerriAI/litellm/pull/36728)
- @danielva-monday made their first contribution in [PR #36762](https://github.com/BerriAI/litellm/pull/36762)
- @Siraj637909 made their first contribution in [PR #37090](https://github.com/BerriAI/litellm/pull/37090)
- @bisma-nawaz made their first contribution in [PR #37724](https://github.com/BerriAI/litellm/pull/37724)
- @mphilippnv made their first contribution in [PR #38221](https://github.com/BerriAI/litellm/pull/38221)
- @ksk2023 made their first contribution in [PR #38344](https://github.com/BerriAI/litellm/pull/38344)
- @aaaaaandrew made their first contribution in [PR #38656](https://github.com/BerriAI/litellm/pull/38656)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.99.0...v1.100.0
