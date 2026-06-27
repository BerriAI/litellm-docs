---
title: "v1.90.0 - Six New Providers, OpenTelemetry v2 Parity & Streaming Reliability"
slug: "v1-90-0"
date: 2026-06-26T19:52:37
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
docker.litellm.ai/berriai/litellm:1.90.0
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.90.0
```

</TabItem>
</Tabs>

## Key Highlights

- **Six new providers** - ModelScope, LibertAI, Parasail, Pinstripes, TinyFish (search), and FastCRW (search) - plus a new e2b code-execution sandbox primitive.
- **91 new models** across Fireworks AI, Scaleway, Tensormesh, LibertAI, Azure AI (including `gpt-5.5` and DeepSeek V4), and Bedrock Mantle.
- **OpenTelemetry v2 reaches metrics parity with v1**, emitting the six `gen_ai.client.*` metrics, stamping input/output message content, and scoping OTLP credentials per tenant.
- **A broad streaming-reliability sweep**: upstream connections are now released when the client disconnects mid-stream (Gemini, aiohttp), requests are cancelled cleanly, and partial spend is recorded on interrupted streams.
- **Two new guardrails** (Cisco AI Defense, Repello Argus) and a large Next.js App Router UI migration covering the models, teams, users, organizations, api-keys, and usage pages.

## New Providers and Endpoints

### New Providers (6 new providers)

| Provider | Supported LiteLLM Endpoints | Description |
| --- | --- | --- |
| ModelScope (`modelscope`) | Chat Completions | OpenAI-compatible provider for ModelScope-hosted models - [PR #28460](https://github.com/BerriAI/litellm/pull/28460) |
| LibertAI (`libertai`) | Chat Completions, Embeddings | JSON-configured OpenAI-compatible provider; ships 12 catalog models including `bge-m3` embeddings - [PR #30203](https://github.com/BerriAI/litellm/pull/30203) |
| TinyFish (`tinyfish`) | Search | Web search provider - [PR #30634](https://github.com/BerriAI/litellm/pull/30634) |
| FastCRW (`fastcrw`) | Search | Web search provider - [PR #30434](https://github.com/BerriAI/litellm/pull/30434) |
| Parasail (`parasail`) | Chat Completions | OpenAI-compatible provider |
| Pinstripes (`pinstripes`) | Chat Completions | New chat provider; ships 6 catalog models |

### New LLM API Endpoints

| Capability | Description | Documentation |
| --- | --- | --- |
| Code execution (e2b) | New sandbox / code-interpreter primitive for running model-generated code - [PR #30898](https://github.com/BerriAI/litellm/pull/30898) | [Sandbox](../../docs/sandbox) |

## New Models / Updated Models

#### New Model Support (91 new models)

| Provider | Model | Context | Input ($/1M) | Output ($/1M) | Features |
| --- | --- | --- | --- | --- | --- |
| Azure AI | `azure_ai/gpt-5.5` | 1,050,000 | $5 | $30 | reasoning, function calling, prompt caching, pdf, vision |
| Azure AI | `azure_ai/gpt-5.5-2026-04-23` | 1,050,000 | $5 | $30 | reasoning, function calling, prompt caching, pdf, vision |
| Azure AI | `azure_ai/deepseek-v4-flash` | 1,000,000 | $0.19 | $0.51 | reasoning, function calling |
| Azure AI | `azure_ai/deepseek-v4-pro` | 1,000,000 | $1.74 | $3.48 | reasoning, function calling |
| Azure AI | `azure_ai/deepseek-v3.1` | 131,072 | $1.23 | $4.94 | reasoning, function calling |
| Azure AI | `azure_ai/MAI-Image-2.5` | - | $5 | - | image generation |
| Azure AI | `azure_ai/MAI-Image-2.5-Flash` | - | $1.75 | - | image generation |
| Azure AI | `azure_ai/MAI-Image-2e` | - | $5 | - | image generation |
| Azure | `azure/gpt-realtime-whisper` | - | - | - | audio transcription |
| OpenAI | `gpt-realtime-whisper` | - | - | - | audio transcription |
| DeepSeek | `deepseek-v4-flash` / `deepseek/deepseek-v4-flash` | 1,000,000 | $0.14 | $0.28 | function calling, prompt caching |
| DeepSeek | `deepseek-v4-pro` / `deepseek/deepseek-v4-pro` | 1,000,000 | $0.43 | $0.87 | function calling, prompt caching |
| Mistral | `mistral/mistral-medium-3-5` | 262,144 | $1.50 | $7.50 | function calling, vision |
| GitHub Copilot | `github_copilot/mai-code-1-flash` | 128,000 | $0.75 | $4.50 | function calling |
| Fireworks AI | 24 models incl. `deepseek-v4-pro`, `glm-5p2`, `kimi-k2p6`/`kimi-k2p7-code`, `minimax-m3`, `qwen3p7-plus`, `gpt-oss-120b`/`gpt-oss-20b` | up to 1,048,576 | $0.07-$2.80 | $0.28-$8.80 | function calling, reasoning, vision |
| Bedrock Mantle | `bedrock_mantle/google.gemma-4-26b-a4b` / `gemma-4-31b` / `gemma-4-e2b` | 128k-256k | $0.04-$0.14 | $0.08-$0.40 | function calling, reasoning, vision |
| LibertAI | 12 models incl. `qwen3.6-35b-a3b(-thinking)`, `gemma-4-31b-it(-thinking)`, `deepseek-v4-flash`, `bge-m3` | up to 262,144 | $0.01-$0.25 | free-$1.75 | function calling, reasoning, vision, embedding |
| Pinstripes | 6 models incl. `ps/minimax-m2.7`, `ps/qwen3.6-35b-a3b`, `ps/glm-4.5-air`, `ps/deepseek-v4-flash` | up to 1,000,192 | $0.09-$0.30 | $0.20-$0.60 | function calling, reasoning |
| Scaleway | 17 models incl. `qwen3.5-397b-a17b`, `mistral-medium-3.5-128b`, `gemma-4-26b-a4b-it`, `gpt-oss-120b`, `whisper-large-v3` | up to 256,000 | free-$1.50 | free-$7.50 | function calling, reasoning, vision, audio, embedding |
| Tensormesh | 10 models incl. `Qwen3-Coder-480B-A35B-FP8`, `Qwen3.5-397B-A17B-FP8`, `Kimi-K2.6`, `DeepSeek-V4-Flash`, `gpt-oss-120b`/`gpt-oss-20b` | up to 262,144 | $0.07-$1.40 | $0.28-$4.40 | function calling, reasoning, prompt caching |
| Soniox | `soniox/stt-async-v5` | 8,000 | - | - | audio transcription |
| TinyFish | `tinyfish/search` | - | - | - | search |

The 91 new entries also include the full `fireworks_ai/accounts/...` model and router paths. Claude Fable 5 already shipped in v1.89.0, so it is not counted here. Full diff: `model_prices_and_context_window.json`.

#### Features

- **[Anthropic](../../docs/providers/anthropic)**
    - Surface compaction usage iterations data - [PR #27065](https://github.com/BerriAI/litellm/pull/27065)
    - Serve Anthropic-native `/v1/models` for Claude Code gateway discovery - [PR #30273](https://github.com/BerriAI/litellm/pull/30273)
- **[OpenRouter](../../docs/providers/openrouter)**
    - Map reasoning `max` level to `xhigh` - [PR #28881](https://github.com/BerriAI/litellm/pull/28881)
- **[Bedrock](../../docs/providers/bedrock)**
    - Optionally forward multimodal content blocks in AgentCore `InvokeAgentRuntime` - [PR #28885](https://github.com/BerriAI/litellm/pull/28885)
    - Support file content retrieval for batch output files - [PR #30595](https://github.com/BerriAI/litellm/pull/30595)
    - Make Bedrock Mantle Responses routing data-driven per model - [PR #30700](https://github.com/BerriAI/litellm/pull/30700)
- **[DashScope](../../docs/providers/dashscope)**
    - Add Responses API support - [PR #30286](https://github.com/BerriAI/litellm/pull/30286)
- **[OCI](../../docs/providers/oci)**
    - Make Cohere `{{trace}}` judges work (tool param types + agentic tool-calling continuation) - [PR #30646](https://github.com/BerriAI/litellm/pull/30646)

#### Bug Fixes

- **[Anthropic](../../docs/providers/anthropic)**
    - Apply `cache_control_injection_points` on the `/v1/messages` path - [PR #30341](https://github.com/BerriAI/litellm/pull/30341)
    - Strip LiteLLM-injected `total_tokens` from `/v1/messages` responses - [PR #30382](https://github.com/BerriAI/litellm/pull/30382)
    - Cap cache_control injection at 4 blocks - [PR #30480](https://github.com/BerriAI/litellm/pull/30480)
    - Drop orphaned `server_tool_use` on multi-turn replay from generic OpenAI clients - [PR #30486](https://github.com/BerriAI/litellm/pull/30486)
    - Don't leak tool `type` into OpenAI function parameters schema - [PR #30618](https://github.com/BerriAI/litellm/pull/30618)
- **[Bedrock](../../docs/providers/bedrock)**
    - Preserve `cache_control` for ARN models in the `/v1/messages` adapter - [PR #29823](https://github.com/BerriAI/litellm/pull/29823)
    - Handle `role: "system"` inside the messages array on `/v1/messages` - [PR #30443](https://github.com/BerriAI/litellm/pull/30443)
    - Use a unique function-call id for Bedrock Mantle responses->chat tool calls - [PR #30426](https://github.com/BerriAI/litellm/pull/30426)
    - Add SigV4 fallback to Bedrock Mantle chat completions auth - [PR #30714](https://github.com/BerriAI/litellm/pull/30714)
- **[Gemini / Vertex AI](../../docs/providers/gemini)**
    - Use `get_vertex_base_url` for `cachedContents` host - [PR #29707](https://github.com/BerriAI/litellm/pull/29707)
    - Buffer native Gemini SSE frames - [PR #30225](https://github.com/BerriAI/litellm/pull/30225)
    - Map Gemini upstream-error body code 429 to `RateLimitError` - [PR #30417](https://github.com/BerriAI/litellm/pull/30417)
    - Ensure checks show `gemini-3-flash-preview` supports `responseJsonSchema` - [PR #30696](https://github.com/BerriAI/litellm/pull/30696)
- **[OpenAI-compatible](../../docs/providers/openai_compatible)**
    - Preserve `cache_control` for OpenAI-compatible custom endpoints - [PR #30387](https://github.com/BerriAI/litellm/pull/30387)
    - hosted_vllm: remove `thinking_blocks` and convert list content to strings - [PR #30475](https://github.com/BerriAI/litellm/pull/30475)
    - Don't stack provider prefix on wildcard models with a custom prefix - [PR #30360](https://github.com/BerriAI/litellm/pull/30360)
- **[WatsonX](../../docs/providers/watsonx)**
    - Wrap string embedding input in an array for the WatsonX API - [PR #30897](https://github.com/BerriAI/litellm/pull/30897)
- **Pricing / Cost map**
    - Add cost mapping for `deepseek-v4-flash`/`deepseek-v4-pro` - [PR #27056](https://github.com/BerriAI/litellm/pull/27056)
    - Add `mistral-medium-3-5` to the cost map - [PR #29303](https://github.com/BerriAI/litellm/pull/29303)
    - Add `azure_ai/gpt-5.5` to the model cost map - [PR #30428](https://github.com/BerriAI/litellm/pull/30428)
    - Add GitHub Copilot MAI Code Flash pricing - [PR #30415](https://github.com/BerriAI/litellm/pull/30415)
    - Sync the Fireworks AI model registry with the current platform catalog - [PR #30616](https://github.com/BerriAI/litellm/pull/30616)
    - Add `soniox/stt-async-v5` - [PR #30672](https://github.com/BerriAI/litellm/pull/30672)
    - Correct swapped input/output token costs for `command-r7b-12-2024` - [PR #30413](https://github.com/BerriAI/litellm/pull/30413)
    - Add 1h cache-write cost for Anthropic Sonnet 4.5/4.6 - [PR #30474](https://github.com/BerriAI/litellm/pull/30474)
    - Route Volcengine (Doubao) tiered-pricing models to the tiered cost handler - [PR #30357](https://github.com/BerriAI/litellm/pull/30357); sort tiered thresholds numerically - [PR #30375](https://github.com/BerriAI/litellm/pull/30375); treat a DashScope explicit `0.0` tier cost as a real price - [PR #30653](https://github.com/BerriAI/litellm/pull/30653)
    - Drop synthesized zero costs in `register_model` to preserve sparse entries - [PR #30201](https://github.com/BerriAI/litellm/pull/30201)

## LLM API Endpoints

#### Features

- **[Responses API](../../docs/response_api)**
    - Propagate `completed_response` through `FallbackResponsesStreamWrapper` for streaming `/v1/responses` container ownership - [PR #30213](https://github.com/BerriAI/litellm/pull/30213)
- **[/v1/models](../../docs/proxy/model_management)**
    - Surface `max_input_tokens`/`max_output_tokens` on `/v1/models` - [PR #30272](https://github.com/BerriAI/litellm/pull/30272)
    - Include model group aliases in v1 model info - [PR #30626](https://github.com/BerriAI/litellm/pull/30626)
- **[Realtime](../../docs/realtime)**
    - Allow non-admin virtual keys to call GA Realtime WebRTC HTTP routes - [PR #30089](https://github.com/BerriAI/litellm/pull/30089)
- **[Files](../../docs/files_endpoints)**
    - Attach existing OpenAI file ids - [PR #30628](https://github.com/BerriAI/litellm/pull/30628)

#### Bugs

- **General**
    - Token counter: handle Anthropic `tool_reference` blocks to stop dropped spend logs - [PR #30302](https://github.com/BerriAI/litellm/pull/30302)
    - Streaming: guard `raise_on_model_repetition` against empty choices - [PR #30485](https://github.com/BerriAI/litellm/pull/30485)
    - Audio: don't override an explicit `response_format` with `verbose_json` - [PR #30599](https://github.com/BerriAI/litellm/pull/30599)
    - Validate the resolved model in `/realtime/client_secrets` for non-transcription sessions - [PR #30710](https://github.com/BerriAI/litellm/pull/30710)

## Management Endpoints / UI

#### Features

- **App Router migration** - models - [PR #30677](https://github.com/BerriAI/litellm/pull/30677), teams - [PR #30343](https://github.com/BerriAI/litellm/pull/30343), users - [PR #30334](https://github.com/BerriAI/litellm/pull/30334), organizations - [PR #30336](https://github.com/BerriAI/litellm/pull/30336), api-keys - [PR #30699](https://github.com/BerriAI/litellm/pull/30699), usage report - [PR #30694](https://github.com/BerriAI/litellm/pull/30694), agents + router-settings - [PR #30323](https://github.com/BerriAI/litellm/pull/30323)
- **UI cleanup** - remove the unreachable `/chat` page - [PR #30178](https://github.com/BerriAI/litellm/pull/30178), dead UI components - [PR #30340](https://github.com/BerriAI/litellm/pull/30340), orphaned pass-through-settings route - [PR #30692](https://github.com/BerriAI/litellm/pull/30692); remove in-product survey and feedback nudges - [PR #30773](https://github.com/BerriAI/litellm/pull/30773)
- **Virtual Keys** - expose per-model budget usage in `/key/info` - [PR #30394](https://github.com/BerriAI/litellm/pull/30394); grace-period key rotation returns the deprecated-key lookup result on 401 - [PR #30327](https://github.com/BerriAI/litellm/pull/30327)
- **Teams / Orgs** - add `key_limit` query param to `/team/info` - [PR #30006](https://github.com/BerriAI/litellm/pull/30006); list public team model names in `/v1/models` - [PR #30588](https://github.com/BerriAI/litellm/pull/30588)
- **Proxy CLI Auth** - add `verification_uri_complete` to the CLI SSO device flow - [PR #30571](https://github.com/BerriAI/litellm/pull/30571)
- **Proxy** - configurable response headers and login-page hint - [PR #30792](https://github.com/BerriAI/litellm/pull/30792); gate the "Default Credentials" hint on `/ui/login` behind an env flag - [PR #30234](https://github.com/BerriAI/litellm/pull/30234)

#### Bugs

- **Access control / keys**
    - `/key/list` now does exact `user_id`/`key_alias` matching by default, preventing cross-user key disclosure - [PR #30593](https://github.com/BerriAI/litellm/pull/30593)
    - Restrict `/customer/daily/activity` to admin-only - [PR #28849](https://github.com/BerriAI/litellm/pull/28849)
    - `org_admin` sees all org teams when the UI sends its own `user_id` - [PR #30247](https://github.com/BerriAI/litellm/pull/30247)
    - Allow internal roles to access vector store CRUD routes - [PR #30503](https://github.com/BerriAI/litellm/pull/30503)
    - Require premium only when enabling premium metadata fields - [PR #30506](https://github.com/BerriAI/litellm/pull/30506)
    - Guard `check_and_fix_namespace` against a `None` key - [PR #30435](https://github.com/BerriAI/litellm/pull/30435)
    - Warn at startup when `custom_auth` skips `common_checks` enforcement - [PR #30665](https://github.com/BerriAI/litellm/pull/30665)
    - Resolve list-files credentials from team BYOK deployments - [PR #30495](https://github.com/BerriAI/litellm/pull/30495); preserve `azure_ad_token` through `CredentialLiteLLMParams` for `/v1/files` + batches - [PR #30241](https://github.com/BerriAI/litellm/pull/30241)
    - Enforce budget for models not in the cost map - [PR #24949](https://github.com/BerriAI/litellm/pull/24949)
- **UI**
    - Stop the Virtual Keys page from an infinite render loop - [PR #30397](https://github.com/BerriAI/litellm/pull/30397)
    - Source api-keys identity from `useAuthorized` to stop "User ID is not set" - [PR #30903](https://github.com/BerriAI/litellm/pull/30903)
    - Render logos correctly under a custom `server_root_path` - [PR #31156](https://github.com/BerriAI/litellm/pull/31156)
    - Warn that team models are deleted in the delete-team modal - [PR #29990](https://github.com/BerriAI/litellm/pull/29990)
    - Three small fixes - Gemini `api_base`, credential form reset, Mode badge - [PR #30419](https://github.com/BerriAI/litellm/pull/30419)
    - Repoint the dead usage-guide link to cost-tracking docs - [PR #30859](https://github.com/BerriAI/litellm/pull/30859)
- **Proxy**
    - Support SMTP implicit SSL (port 465) - [PR #30395](https://github.com/BerriAI/litellm/pull/30395)

## AI Integrations

### Logging

- **[OpenTelemetry](../../docs/proxy/logging)**
    - Emit the six `gen_ai.client.*` metrics at v1 parity in v2 - [PR #30326](https://github.com/BerriAI/litellm/pull/30326)
    - One v2 logger owns the global provider; scope tenant OTLP creds per exporter - [PR #30590](https://github.com/BerriAI/litellm/pull/30590)
    - Export v2 gen_ai client metrics to the configured meter provider - [PR #30549](https://github.com/BerriAI/litellm/pull/30549)
    - Stamp `gen_ai.input/output.messages` on v2 spans - [PR #30548](https://github.com/BerriAI/litellm/pull/30548)
    - Cap metric attribute cardinality with include/exclude lists - [PR #30257](https://github.com/BerriAI/litellm/pull/30257)
    - Record the full error message on the standard exception event in v2 - [PR #30380](https://github.com/BerriAI/litellm/pull/30380)
    - Accept `UPPER_SNAKE_CASE` `OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT` in v2 - [PR #30562](https://github.com/BerriAI/litellm/pull/30562)
- **General**
    - Preserve `error_message` on `ProxyException` failures in spend logs - [PR #30381](https://github.com/BerriAI/litellm/pull/30381)

### Guardrails

- **Cisco AI Defense** - new integration - [PR #28249](https://github.com/BerriAI/litellm/pull/28249)
- **Repello Argus** - new integration - [PR #30465](https://github.com/BerriAI/litellm/pull/30465)
- **[Presidio](../../docs/proxy/guardrails/pii_masking_v2)** - add missing UK PII entity types - [PR #30537](https://github.com/BerriAI/litellm/pull/30537); don't mask the live request when the guardrail is `logging_only` - [PR #30461](https://github.com/BerriAI/litellm/pull/30461)
- **AIM** - return 400 not 500 when AIM blocks a request - [PR #30573](https://github.com/BerriAI/litellm/pull/30573)
- **General**
    - Stop re-initializing DB guardrails on every poll - [PR #30542](https://github.com/BerriAI/litellm/pull/30542)
    - Run the `pre_call` hook once for model-level guardrails - [PR #30543](https://github.com/BerriAI/litellm/pull/30543)
    - `disable_global_guardrails` overrides the team list - [PR #28563](https://github.com/BerriAI/litellm/pull/28563)
    - Surface OpenAI moderation `violation_categories` on guardrail traces - [PR #30659](https://github.com/BerriAI/litellm/pull/30659)

### Secret Managers

- **[AWS Secrets Manager](../../docs/secret)** - cross-region replication - [PR #30368](https://github.com/BerriAI/litellm/pull/30368)

## Spend Tracking, Budgets and Rate Limiting

- **Service-tier pricing** - apply the `service_tier` suffix to above-threshold cache rates and expose priority+threshold keys in `ModelInfo` - [PR #30450](https://github.com/BerriAI/litellm/pull/30450); price and surface the Anthropic response `service_tier` in cost tracking - [PR #30558](https://github.com/BerriAI/litellm/pull/30558); stop non-string `service_tier` from silently dropping cost tracking - [PR #30690](https://github.com/BerriAI/litellm/pull/30690), [PR #30706](https://github.com/BerriAI/litellm/pull/30706)
- **Budgets** - enforce budgets against authoritative DB spend when the cross-pod counter is stale - [PR #30684](https://github.com/BerriAI/litellm/pull/30684); release a budget reservation when a request is cancelled mid-flight - [PR #30522](https://github.com/BerriAI/litellm/pull/30522); recompute `budget_reset_at` when `budget_duration` changes - [PR #30555](https://github.com/BerriAI/litellm/pull/30555)
- **Rate limiting** - prevent internal `parallel_request_limiter` fields from leaking to upstream providers - [PR #30545](https://github.com/BerriAI/litellm/pull/30545)
- **Spend accuracy** - record partial spend on the failure row for interrupted streams - [PR #30788](https://github.com/BerriAI/litellm/pull/30788); recover output tokens for interrupted Anthropic streams - [PR #30787](https://github.com/BerriAI/litellm/pull/30787); stop Perplexity double-billing reasoning tokens in the manual cost fallback - [PR #30488](https://github.com/BerriAI/litellm/pull/30488); correct cached-token usage with `ChatCompletionUsageBlock` - [PR #30422](https://github.com/BerriAI/litellm/pull/30422)
- **Usage aggregation** - drain all daily-spend batches per flush cycle - [PR #30505](https://github.com/BerriAI/litellm/pull/30505); show session-aggregate cost and duration in request logs - [PR #30507](https://github.com/BerriAI/litellm/pull/30507); coalesce null aggregates for no-spend keys - [PR #29945](https://github.com/BerriAI/litellm/pull/29945); remove timezone date expansion in daily-activity aggregation - [PR #29569](https://github.com/BerriAI/litellm/pull/29569)

## MCP Gateway

- Make the MCP gateway name and description configurable via env vars - [PR #30473](https://github.com/BerriAI/litellm/pull/30473)
- Fail closed when the scope filter resolves to no servers - [PR #30353](https://github.com/BerriAI/litellm/pull/30353)
- Re-raise instead of silently dropping MCP team permissions - [PR #30477](https://github.com/BerriAI/litellm/pull/30477)
- Drop the phantom 401 span on delegated OAuth2 tool calls - [PR #30494](https://github.com/BerriAI/litellm/pull/30494)
- Challenge delegate-auth OAuth servers with the upstream `resource_metadata` - [PR #31255](https://github.com/BerriAI/litellm/pull/31255)
- Default the Linear MCP registry entry to streamable HTTP - [PR #30396](https://github.com/BerriAI/litellm/pull/30396)
- Preserve native tools in the semantic filter hook - [PR #26650](https://github.com/BerriAI/litellm/pull/26650)

## Performance / Loadbalancing / Reliability improvements

- **Streaming connection hygiene** - cancel the upstream Gemini request and release the httpx connection on client disconnect - [PR #30075](https://github.com/BerriAI/litellm/pull/30075); close the upstream LLM stream when the client disconnects mid-stream - [PR #30245](https://github.com/BerriAI/litellm/pull/30245); release the aiohttp connection when stream iteration ends abnormally - [PR #30271](https://github.com/BerriAI/litellm/pull/30271); use `e.request_data` for `logging_obj` in `ModifyResponseException` streaming passthrough - [PR #30800](https://github.com/BerriAI/litellm/pull/30800)
- **Caching** - add a valkey-semantic cache backend and fix semantic-cache scope keys - [PR #30675](https://github.com/BerriAI/litellm/pull/30675); url-encode the object name in the GCS cache GET path - [PR #30378](https://github.com/BerriAI/litellm/pull/30378); allow `use_redis_transaction_buffer` without a Redis cache - [PR #28764](https://github.com/BerriAI/litellm/pull/28764)
- **Router / fallbacks** - resolve a list-unhashable crash on model alias - [PR #30464](https://github.com/BerriAI/litellm/pull/30464); clean pattern_router state on upsert/delete - [PR #29601](https://github.com/BerriAI/litellm/pull/29601); preserve the fallback model in SDK fallback responses - [PR #28260](https://github.com/BerriAI/litellm/pull/28260); add `expose_router_debug_in_errors` (default True) to redact internal model_group/fallback names - [PR #30418](https://github.com/BerriAI/litellm/pull/30418)
- **Startup / workers** - fail fast on a non-PostgreSQL `DATABASE_URL` instead of hanging - [PR #30366](https://github.com/BerriAI/litellm/pull/30366); add `--max_requests_before_restart_jitter` to stagger worker restarts - [PR #30601](https://github.com/BerriAI/litellm/pull/30601); fix the IAM refresh-engine watcher race - [PR #30183](https://github.com/BerriAI/litellm/pull/30183); release the cron pod-lock by matching `async_set_cache` JSON encoding - [PR #30600](https://github.com/BerriAI/litellm/pull/30600)
- **Health checks** - correct Bedrock embedding health checks - [PR #30583](https://github.com/BerriAI/litellm/pull/30583); bump the health-check `max_tokens` default to 16 for GPT-5 compatibility - [PR #30708](https://github.com/BerriAI/litellm/pull/30708), [PR #26610](https://github.com/BerriAI/litellm/pull/26610)
- **Developer experience / CI** - around 30 PRs hardening the lint and type-check gates (standardizing on basedpyright, dropping mypy, ratcheting any-discipline budgets), an osv-scanner lockfile workflow, zizmor PR gating, a local fake-OpenAI test endpoint replacing the shared mock, dependency bumps, and a pinned build toolchain.

## Documentation Updates

- Add 1-click AWS/GCP Terraform deploy buttons and fix README deploy-button rendering - [PR #29879](https://github.com/BerriAI/litellm/pull/29879)
- Strengthen the coding conventions in `CLAUDE.md` - [PR #30333](https://github.com/BerriAI/litellm/pull/30333)
- Clarify the Linear portion of the PR template - [PR #30766](https://github.com/BerriAI/litellm/pull/30766)

## New Contributors

@hannahmadison, @ayushh0110, @Dotify71, @munnr, @V-3604, @yrk111222, @Silvenga, @djmaze, @apshada, @HumphreySun98, @Harshxth, @tomoyat1, @S0ngRu1, @habonlaci, @moshemalawach, @nahrinoda, @Vedant-Agarwal, @lollinng, @anneheartrecord, @hdt12a1, @vineethsaivs, @krishvsoni, @rvishwas26, @santino18727-debug, @darktheorys, @songkuan-zheng, @Thijmen, @Kropiunig, @jay-tau, @KnyazSh, @koztkozt, @us, @Anuj7411, @zkryakgul, @lavish619, @EugeneLugovtsov, @Bochenski, @menardorama, @factnn, @semmons99, @nitishagar, @FadelT, @jho1-godaddy, @yucheng-berri, @ad1269, @shzdehmd, @vanika02, @Nithish-Yenaganti, @simantak-dabhade, @devYRPauli, @clpatterson, @tcconnally

## Full Changelog

[`v1.89.0...v1.90.0`](https://github.com/BerriAI/litellm/compare/v1.89.0...v1.90.0)
