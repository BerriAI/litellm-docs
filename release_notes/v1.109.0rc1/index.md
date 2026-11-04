---
title: "LiteLLM v1.109.0rc1 adds 11 providers, Codex tool search and daily limits"
description: "Release candidate for LiteLLM 1.109.0 with 11 new providers, a redesigned Playground, Codex tool search and daily deployment limits."
slug: "v1-109-0-rc-1"
date: 2026-11-04T02:17:12
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
-e LITELLM_MASTER_KEY=sk-<paste-a-long-random-key> \
-e DATABASE_URL=postgresql://<user>:<password>@<host>:5432/<dbname> \
-e STORE_MODEL_IN_DB=True \
-p 4000:4000 \
docker.litellm.ai/berriai/litellm:1.109.0-rc.1
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.109.0rc1
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.109.0-rc.1`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.109.0-rc.1) and the full [releases page](https://github.com/BerriAI/litellm/releases)

The published GitHub tag is `v1.109.0-rc.1`. These notes compare it with `v1.108.0-rc.1`, the previous release candidate. Changes backported onto `rc/1.108.0` and already shipped in `v1.108.0` are omitted

Customer-facing changes come first. Test, CI and internal changes are listed at the bottom

:::danger Breaking Changes

These callouts cover user-facing behavior that differs from [`v1.108.0`](/release_notes/v1.108.0/v1-108-0), the latest stable release

**The disk cache backend is removed.** A config with `cache_params.type: disk` now stops the proxy at startup. Switch to `local` or `redis`, and expect a cold cache. See [PR #48114](https://github.com/BerriAI/litellm/pull/48114)

**A proxy config with a string fallback target no longer starts.** Those targets never routed, so write the target in list form as the startup error shows. See [PR #48943](https://github.com/BerriAI/litellm/pull/48943)

**Both Helm charts no longer deploy Lens, and an enabled `lensWorker` value fails the render.** Deploy Lens from its own chart and set `lens.*`. A bare `helm install` of `litellm-helm` also no longer ships the `gpt-3.5-turbo` and `fake-openai-endpoint` placeholder models, so add models under `proxy_config.model_list` or from the Admin UI. See [PR #49169](https://github.com/BerriAI/litellm/pull/49169), [PR #47056](https://github.com/BerriAI/litellm/pull/47056)

**Sourcing the Terraform module from a git ref of the monorepo now requires `image_tag`, or all four `*_image` URIs, and Terraform 1.9.0 or newer.** Registry versions keep working with no input. See [PR #46960](https://github.com/BerriAI/litellm/pull/46960)

**`import litellm` raises `ImportError` when the native extension `_native.abi3.so` is missing.** Every wheel and Docker image ships it, so only installs from source need to build it. See [PR #48852](https://github.com/BerriAI/litellm/pull/48852)

**The final usage chunk of a stream with `include_usage` now has an empty `choices` array, like OpenAI.** Code that reads `chunk.choices[0]` on every chunk should guard it with `if chunk.choices:`. Streamed `/v1/completions` responses also leave out `usage` unless the request asks for it. See [PR #47109](https://github.com/BerriAI/litellm/pull/47109), [Commit e14d2fd](https://github.com/BerriAI/litellm/commit/e14d2fdc38f7272b5b50c67c0bdefa2830aff268)

**Streams that fail partway now fail visibly.** A stalled stream answers 408 `litellm.Timeout` instead of 500 `APIConnectionError`, a stream that ends with an `abort` finish reason answers 500 instead of a clean stop, and a stream that sends content but never a finish reason reaches the client as an error and is logged as a failure. Retries, cooldowns, alerts and fallbacks now apply to these streams. See [PR #47198](https://github.com/BerriAI/litellm/pull/47198), [PR #48328](https://github.com/BerriAI/litellm/pull/48328), [PR #47665](https://github.com/BerriAI/litellm/pull/47665)

**OpenAI-compatible 401 and 404 answers with an `invalid_request_error` body now raise `AuthenticationError` and `NotFoundError` instead of `BadRequestError`.** Update code and retry policies that catch `BadRequestError` for these errors. See [PR #32537](https://github.com/BerriAI/litellm/pull/32537)

**Claude requests that send no `max_tokens` now ask for much more output.** Anthropic models missing from the cost map get `max_tokens: 128000` instead of 4096. Set `DEFAULT_ANTHROPIC_CHAT_MAX_TOKENS=4096` to keep the old value. Bedrock Invoke and Mantle Claude send the deployment's `model_info.max_output_tokens` or the model's mapped limit instead of 4096, which holds more of the Bedrock tokens-per-minute quota, so busy accounts can see more 429s. Send `max_tokens` to keep the old footprint. See [PR #48502](https://github.com/BerriAI/litellm/pull/48502), [PR #49692](https://github.com/BerriAI/litellm/pull/49692)

**Gemini 3.6 Flash, Gemini 3.5 Flash-Lite and newer Gemini models answer 400 for `temperature`, `top_p` or `top_k`** instead of a 200 where Google ignored them. Set `drop_params`, or list `temperature` and `top_p` in `allowed_openai_params` to force them through. See [PR #47645](https://github.com/BerriAI/litellm/pull/47645)

**With `drop_params: false` under `litellm_settings`, Claude Code and Codex requests that carry unsupported settings now answer 400 like other clients.** Set `drop_params: true` to keep dropping them. See [PR #49058](https://github.com/BerriAI/litellm/pull/49058)

**`enable_pre_call_checks: true` no longer stops picking a deployment once its minute count reaches `rpm`.** Add `optional_pre_call_checks: ["enforce_model_rate_limits"]` to `router_settings` to keep a hard cap. See [PR #48873](https://github.com/BerriAI/litellm/pull/48873)

**The customer list routes now return 50 customers per page by default** instead of the whole directory. Pass a page size from 1 to 100 and page through the results. See [PR #48700](https://github.com/BerriAI/litellm/pull/48700)

**More `model_max_budget` caps are enforced.** An end user's per-model cap from their linked budget now refuses requests once it is passed, master-key calls that send `user` included, and end users already over a cap get 422 right after the upgrade. Pattern and access group entries in `model_max_budget`, saved but ignored on `v1.108.0`, are enforced too. Review these caps before upgrading. See [PR #48815](https://github.com/BerriAI/litellm/pull/48815), [PR #47722](https://github.com/BerriAI/litellm/pull/47722)

**`lakera_v2` with `on_flagged: block`, which is the default, now returns 400 when Lakera flags only PII.** Set `on_flagged: mask` to keep masking the PII and allowing the request. See [PR #48944](https://github.com/BerriAI/litellm/pull/48944)

**MCP access is narrower in two cases.** A `none` or `bearer_token` MCP server with `Authorization` in `extra_headers` no longer receives the caller's LiteLLM key, so send LiteLLM auth in `x-litellm-api-key` to keep forwarding a separate upstream `Authorization`. Admin credentials on a team, such as an admin's team key, CLI login or JWT, now get only that team's MCP servers and toolsets, while the dashboard and master key still see everything. See [PR #46932](https://github.com/BerriAI/litellm/pull/46932), [PR #49161](https://github.com/BerriAI/litellm/pull/49161)

**Custom cost maps in the old rule format lose fallback info for unmapped Claude ids.** Nothing changes on the default remote map or the bundled backup, but if you pin or overwrite a map from before July 2026, move to a current copy before upgrading. See [PR #48737](https://github.com/BerriAI/litellm/pull/48737)

:::

## Key Highlights

- **New providers**: ai&, CLF AI Gateway, StreamLake, OpenInfer, ZeroGPU, Hostinger Router, OpenCode Go, Refuseless, BigModel and Kyma API, plus Nace Drex and LM Studio decision models, among 311 new catalog entries
- **New endpoints and media**: `/v1/extraction` with Cloudflare Clairic, Deepgram streaming text to speech on `/deepgram/v1/speak`, A2A `message/stream`, Amazon OpenSearch k-NN vector stores, Doubao-Seedance video and DashScope image edits and speech
- **Admin UI and Chat**: a redesigned Playground with a per-request routing, guardrail and cost inspector, file attachments and Deep research in Chat, shareable Usage links and a two-model Auto Router setup
- **Coding agents**: Codex discovers MCP tools through tool search, the Claude Code gateway lists models and lets you pick a team at CLI login, and Codex and Pi can keep their own ChatGPT subscription through the gateway
- **Limits and budgets**: deployment `rpd` and `tpd` daily limits, Responses WebSocket turns counted toward deployment and key limits, and W3C `baggage` values mapped to spend tags
- **Reliability**: streams that stall, abort or end without a finish reason now fail visibly, spend rollups and callbacks drain on shutdown, and `/model/new` applies on every worker right away when Redis is on

## New Providers and Endpoints

### New Providers (11 new providers)

| Provider | Supported LiteLLM Endpoints | Description |
| --- | --- | --- |
| ai& | `/v1/chat/completions`, `/v1/responses`, `/v1/messages` | OpenAI-compatible provider under `aiand/`, reading `AIAND_API_KEY` |
| CLF AI Gateway | `/v1/chat/completions` | OpenAI-compatible provider under `clf_ai_gateway/`, reading `CLF_AI_GATEWAY_API_KEY` |
| StreamLake | `/v1/chat/completions` | OpenAI-compatible provider under `streamlake/` |
| OpenInfer | `/v1/chat/completions`, `/v1/responses`, `/v1/messages` | OpenAI-compatible provider under `openinfer/` |
| ZeroGPU | `/v1/chat/completions`, `/v1/responses`, `/v1/messages` | OpenAI-compatible provider under `zerogpu/` |
| Hostinger Router | `/v1/chat/completions`, `/v1/responses`, `/v1/messages`, `/v1/embeddings` | OpenAI-compatible provider under `hostinger_router/` |
| Nace | `/v1/decisions` | Decisions provider for Drex models, listed in the Add Model form |
| OpenCode Go | `/v1/chat/completions`, `/v1/responses`, `/v1/messages` | Provider that picks the upstream API per model from catalog metadata, with published Go prices |
| Refuseless | `/v1/chat/completions`, `/v1/responses` | OpenAI-compatible provider under `refuseless/`, with five priced models |
| BigModel | `/v1/chat/completions`, `/v1/responses`, `/v1/messages` | Z.AI-family provider under `bigmodel/`, reading `BIGMODEL_API_KEY` |
| Kyma API | `/v1/chat/completions` | OpenAI-compatible provider under `kyma/`, billed from the `usage.cost` Kyma reports |

### New LLM API Endpoints (3 new endpoints)

| Endpoint | Method | Description |
| --- | --- | --- |
| `/v1/extraction` | POST | Extract typed `fields` from input with Cloudflare Clairic through `cloudflare/clairic`, also available as `/extraction`, `litellm.extraction` and `litellm.aextraction` |
| `/deepgram/v1/speak` | WebSocket | Streams Deepgram text to speech with a LiteLLM key, billed per character, also served at `/deepgram/speak` |
| `/a2a/{agent_id}/message/stream` | POST | Streams an A2A agent's `message/stream` response, also served at `/v1/a2a/{agent_id}/message/stream` |

## New Models / Updated Models

#### New Model Support (311 new models)

Counts represent new catalog identifiers compared with `v1.108.0`, including aliases and regional variants. Prices are the values bundled in this release, in USD, and runtime pricing-map reloads can update them. No rows were removed

<details>
<summary>All 311 new catalog entries</summary>

| Provider | Model | Context Window | Input ($/1M tokens) | Output ($/1M tokens) | Features / special pricing |
| --- | --- | --- | --- | --- | --- |
| Abliteration | `abliteration/abliterated-model` | 262,144 | $1 | $3 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Abliteration | `abliteration/abliterated-model-large` | 1,000,000 | $3 | $5 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Abliteration | `abliteration/abliterated-model-large-flash` | 1,048,576 | $1 | $2 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Abliteration | `abliteration/abliterated-model-large-v2` | 1,000,000 | $3 | $5 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| AIAND | `aiand/deepseek-ai/deepseek-v4-flash` | 1,048,576 | $0.15 | $0.25 | Chat; Reasoning; Tool calling; Prompt caching |
| AIAND | `aiand/deepseek-ai/deepseek-v4-pro` | 1,048,576 | $1 | $2.5 | Chat; Reasoning; Tool calling; Prompt caching |
| AIAND | `aiand/deepseek-ai/deepseek-v4.1-flash` | 1,048,576 | $0.3 | $0.6 | Chat; Reasoning; Vision; Tool calling; Prompt caching |
| AIAND | `aiand/deepseek-ai/deepseek-v4.1-flash-1017` | 1,048,576 | $0.3 | $0.6 | Chat; Reasoning; Vision; Tool calling; Prompt caching |
| AIAND | `aiand/google/gemma-4-31b-it` | 262,144 | $0.2 | $0.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching |
| AIAND | `aiand/meta/muse-spark-open` | 1,048,576 | $1.25 | $4.25 | Chat; Reasoning; Vision; Tool calling; Prompt caching |
| AIAND | `aiand/moonshotai/kimi-k2.7-code` | 262,144 | $0.75 | $3.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching |
| AIAND | `aiand/moonshotai/kimi-k3` | 1,048,576 | $3 | $12.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching |
| AIAND | `aiand/motif-technologies/motif-3` | 262,144 | $0.5 | $2 | Chat; Reasoning; Tool calling; Prompt caching |
| AIAND | `aiand/openai/gpt-oss-120b` | 131,072 | $0.15 | $0.6 | Chat; Reasoning; Tool calling; Prompt caching |
| AIAND | `aiand/qwen/qwen3.6-27b` | 262,144 | $0.32 | $3.2 | Chat; Reasoning; Vision; Tool calling; Prompt caching |
| AIAND | `aiand/qwen/qwen3.8-27b` | 262,144 | $0.4 | $3 | Chat; Reasoning; Vision; Tool calling; Prompt caching |
| AIAND | `aiand/zai-org/glm-5.2` | 1,048,576 | $1 | $4 | Chat; Reasoning; Tool calling; Prompt caching |
| AIAND | `aiand/zai-org/glm-5.3` | 1,048,576 | $1 | $4 | Chat; Reasoning; Tool calling; Prompt caching |
| AIAND | `aiand/zai-org/glm-5.3-flash` | 1,048,550 | $0.15 | $0.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching |
| Amazon Bedrock | `bedrock/ap-northeast-1/mistral.voxtral-mini-3b-2507` | 32,768 | $0.05 | $0.05 | Chat; Audio input |
| Amazon Bedrock | `bedrock/ap-northeast-1/mistral.voxtral-small-24b-2507` | 32,768 | $0.12 | $0.36 | Chat; Audio input |
| Amazon Bedrock | `bedrock/ap-southeast-2/mistral.voxtral-mini-3b-2507` | 32,768 | $0.0412 | $0.0412 | Chat; Audio input |
| Amazon Bedrock | `bedrock/ap-southeast-2/mistral.voxtral-small-24b-2507` | 32,768 | $0.103 | $0.309 | Chat; Audio input |
| Amazon Bedrock | `bedrock/claude_platform/claude-fable-5` | 1,000,000 | $10 | $50 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; Computer use |
| Amazon Bedrock | `bedrock/claude_platform/claude-fable-5-1` | 1,000,000 | $10 | $50 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; Computer use |
| Amazon Bedrock | `bedrock/claude_platform/claude-haiku-4-5` | 200,000 | $1 | $5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `bedrock/claude_platform/claude-haiku-5-5` | 1,000,000 | $0.1 | $0.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; Computer use |
| Amazon Bedrock | `bedrock/claude_platform/claude-opus-4-5` | 200,000 | $5 | $25 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `bedrock/claude_platform/claude-opus-4-6` | 1,000,000 | $5 | $25 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; Computer use |
| Amazon Bedrock | `bedrock/claude_platform/claude-opus-4-7` | 1,000,000 | $5 | $25 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; Computer use |
| Amazon Bedrock | `bedrock/claude_platform/claude-opus-4-8` | 1,000,000 | $5 | $25 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; Computer use |
| Amazon Bedrock | `bedrock/claude_platform/claude-opus-5` | 1,000,000 | $5 | $25 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; Computer use |
| Amazon Bedrock | `bedrock/claude_platform/claude-opus-5-5` | 1,000,000 | $4 | $20 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; Computer use |
| Amazon Bedrock | `bedrock/claude_platform/claude-sonnet-4-5` | 200,000 | $3 | $15 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `bedrock/claude_platform/claude-sonnet-4-6` | 1,000,000 | $3 | $15 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; Computer use |
| Amazon Bedrock | `bedrock/claude_platform/claude-sonnet-5` | 1,000,000 | $2 | $10 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; Computer use |
| Amazon Bedrock | `bedrock/claude_platform/claude-sonnet-5-5` | 1,000,000 | $2 | $10 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; Computer use |
| Amazon Bedrock | `bedrock/eu-west-2/mistral.voxtral-mini-3b-2507` | 32,768 | $0.06 | $0.06 | Chat; Audio input |
| Amazon Bedrock | `bedrock/eu-west-2/mistral.voxtral-small-24b-2507` | 32,768 | $0.16 | $0.47 | Chat; Audio input |
| Amazon Bedrock | `global.openai.gpt-6.1-terra` | 922,000 | $1 | $5 | Chat; Reasoning; Vision; Tool calling; Prompt caching |
| Amazon Bedrock | `us.openai.gpt-6.1-terra` | 922,000 | $1.1 | $5.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching |
| Amazon Bedrock Mantle | `bedrock_mantle/openai.gpt-6.1-terra` | 922,000 | $1.1 | $5.5 | Responses; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Azure | `azure/apac/gpt-6.1-terra` | 922,000 | $1.2 | $6 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; Computer use |
| Azure | `azure/eu/gpt-6.1-terra` | 922,000 | $1.2 | $6 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; Computer use |
| Azure | `azure/gpt-6.1-terra` | 922,000 | $1 | $5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; Computer use |
| Azure | `azure/us/gpt-6.1-terra` | 922,000 | $1.1 | $5.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; Computer use |
| Azure AI | `azure_ai/gpt-6.1-terra` | 922,000 | $1 | $5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; Computer use |
| Azure AI | `azure_ai/MAI-Code-1.1-Flash` | 256,000 | $0.2 | $1.2 | Chat; Reasoning; Vision; Tool calling; Prompt caching |
| Baseten | `baseten/decision-models/baseten-elephant-9b-latest` | 16,384 | $0.035 | $0 | Decisions; Vision |
| Baseten | `baseten/decision-models/baseten-joey-2b-latest` | 16,384 | $0.01 | $0 | Decisions; Vision |
| Baseten | `baseten/decision-models/baseten-mammoth-27b-latest` | 16,384 | $0.1 | $0 | Decisions; Vision |
| BigModel | `bigmodel/glm-5.3` | 1,000,000 | $1.142857 | $4 | Chat; Reasoning; Tool calling; Prompt caching |
| BigModel | `bigmodel/glm-5.3-flash` | 1,000,000 | $0.114286 | $0.4 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Video input |
| BigModel | `bigmodel/glm-5.3-flashx` | 1,000,000 | $0.285714 | $1 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Video input |
| Cerebras | `cerebras/llama-3.1-70b` | 128,000 | $0.6 | $0.6 | Chat; Tool calling |
| Cerebras | `cerebras/llama-3.1-8b` | 128,000 | $0.1 | $0.1 | Chat; Tool calling |
| ChatGPT | `chatgpt/gpt-6-astra-law` | 922,000 | - | - | Responses; Reasoning; Vision; Tool calling; Structured output |
| ChatGPT | `chatgpt/gpt-6-rosalind` | 922,000 | - | - | Responses; Reasoning; Vision; Tool calling; Structured output |
| ChatGPT | `chatgpt/gpt-6.1-terra` | 922,000 | - | - | Responses; Reasoning; Vision; Tool calling; Structured output |
| CLF AI Gateway | `clf_ai_gateway/deepseek-v4-flash` | 1,048,576 | $0.176 | $0.528 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| CLF AI Gateway | `clf_ai_gateway/deepseek-v4-pro` | 1,048,576 | $0.528 | $1.584 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| CLF AI Gateway | `clf_ai_gateway/deepseek-v4.1-flash` | 1,048,576 | $0.12 | $0.48 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| CLF AI Gateway | `clf_ai_gateway/glm-4.7-flash` | 131,072 | $0.024 | $0.16 | Chat; Reasoning; Tool calling; Structured output |
| CLF AI Gateway | `clf_ai_gateway/glm-5.2` | 262,144 | $0.56 | $1.76 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| CLF AI Gateway | `clf_ai_gateway/glm-5.3` | 1,048,576 | $0.56 | $1.76 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| CLF AI Gateway | `clf_ai_gateway/glm-5.3-flash` | 1,048,576 | $0.06 | $0.2 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| CLF AI Gateway | `clf_ai_gateway/kimi-k2.6` | 262,144 | $0.38 | $1.6 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| CLF AI Gateway | `clf_ai_gateway/kimi-k2.7-code` | 262,144 | $0.38 | $1.6 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| CLF AI Gateway | `clf_ai_gateway/qwen3.8-27b` | 262,144 | $0.18 | $1.28 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Cohere | `rerank-v5.0-fast` | 32,768 | $0.02 | $0 | Rerank |
| Cohere | `rerank-v5.0-pro` | 32,768 | $0.05 | $0 | Rerank |
| DashScope | `dashscope/qwen-audio-3.0-tts-flash` | - | - | - | Text to speech; `input_cost_per_character`: $0.000015 |
| DashScope | `dashscope/qwen-audio-3.0-tts-plus` | - | - | - | Text to speech; `input_cost_per_character`: $0.00002 |
| DashScope | `dashscope/qwen-audio-3.1-tts-flash` | - | $0.23 | $1.87 | Text to speech |
| DashScope | `dashscope/qwen-audio-3.1-tts-plus` | - | - | - | Text to speech; `input_cost_per_character`: $0.00003 |
| DashScope | `dashscope/qwen3-tts-flash` | - | - | - | Text to speech; `input_cost_per_character`: $0.00001 |
| Databricks | `databricks/databricks-claude-haiku-5-5` | 1,000,000 | $0.10003 | $0.50001 | Chat; Reasoning; Vision; Tool calling; Prompt caching |
| Databricks | `databricks/databricks-claude-sonnet-5-5` | 1,000,000 | $1.99997 | $9.99999 | Chat; Reasoning; Tool calling; Prompt caching |
| Databricks | `databricks/databricks-deepseek-v4-1-flash` | 1,000,000 | $0.30002 | $1.20001 | Chat; Reasoning; Vision; Tool calling; Prompt caching |
| Databricks | `databricks/databricks-deepseek-v4-1-flash-1017` | 1,000,000 | $0.30002 | $1.20001 | Chat; Reasoning; Vision; Tool calling; Prompt caching |
| Databricks | `databricks/databricks-gemini-2-5-flash-lite` | 1,048,576 | $0.12502 | $0.50001 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Audio input; Video input; `input_cost_per_audio_token`: $0.00000037 |
| Databricks | `databricks/databricks-gemini-3-1-flash-lite-image` | 65,536 | $0.31248 | $1.87502 | Chat; Vision |
| Databricks | `databricks/databricks-gemini-4-argon` | 1,048,576 | $2.49998 | $12.49997 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Audio input; Video input |
| Databricks | `databricks/databricks-gpt-5-4-pro` | 922,000 | $29.99997 | $180.0001 | Responses; Reasoning; Vision; Tool calling; Prompt caching |
| Databricks | `databricks/databricks-gpt-6-1-sol` | 922,000 | $1.99997 | $9.99999 | Responses; Reasoning; Vision; Tool calling; Prompt caching |
| Databricks | `databricks/databricks-gpt-6-1-terra` | 922,000 | $1.00002 | $5.00003 | Chat; Reasoning; Vision; Tool calling; Prompt caching |
| Databricks | `databricks/databricks-gpt-6-astra` | 922,000 | $9.99999 | $50.00002 | Chat; Reasoning; Vision; Tool calling; Prompt caching |
| Databricks | `databricks/databricks-gpt-6-luna` | 922,000 | $0.10003 | $0.50001 | Responses; Reasoning; Vision; Tool calling; Prompt caching |
| Databricks | `databricks/databricks-gpt-6-sol` | 922,000 | $1.99997 | $9.99999 | Responses; Reasoning; Vision; Tool calling; Prompt caching |
| Databricks | `databricks/databricks-gpt-image-1` | - | $5.00003 | - | Image generation |
| Databricks | `databricks/databricks-gpt-image-1-5` | - | $5.00003 | $9.99999 | Image generation; Vision; PDF input |
| Databricks | `databricks/databricks-gpt-image-1-mini` | - | $1.99997 | - | Image generation |
| Databricks | `databricks/databricks-gpt-image-2` | - | $5.00003 | - | Image generation; Vision; PDF input |
| Databricks | `databricks/databricks-grok-4-7` | 500,000 | $2.49998 | $7.50001 | Chat; Reasoning; Vision; Tool calling; Prompt caching |
| Databricks | `databricks/databricks-kimi-k2-7` | 262,144 | $0.94997 | $4.00001 | Chat; Reasoning; Vision; Tool calling; Prompt caching |
| Databricks | `databricks/databricks-typesafeai-jev-1-14-0` | - | $0.042 | $0 | Evaluation; Vision |
| Deepgram | `deepgram/aura` | - | - | - | `input_cost_per_character`: $0.000015 |
| Deepgram | `deepgram/aura-2` | - | - | - | `input_cost_per_character`: $0.00003 |
| ElevenLabs | `elevenlabs/eleven_flash_v2` | - | - | - | Text to speech; `input_cost_per_character`: $0.00004 |
| ElevenLabs | `elevenlabs/eleven_flash_v2_5` | - | - | - | Text to speech; `input_cost_per_character`: $0.00004 |
| ElevenLabs | `elevenlabs/eleven_turbo_v2` | - | - | - | Text to speech; `input_cost_per_character`: $0.00004 |
| ElevenLabs | `elevenlabs/eleven_turbo_v2_5` | - | - | - | Text to speech; `input_cost_per_character`: $0.00004 |
| ElevenLabs | `elevenlabs/eleven_v3_conversational` | - | - | - | Text to speech; `input_cost_per_character`: $0.00004 |
| ElevenLabs | `elevenlabs/eleven_v4` | - | - | - | Text to speech; `input_cost_per_character`: $0.00008 |
| ElevenLabs | `elevenlabs/eleven_v4_turbo` | - | - | - | Text to speech; `input_cost_per_character`: $0.00004 |
| EU JEV | `eu_jev/eu-jeff-1.0.0` | 32,768 | $0.0415 | $0 | Evaluation |
| EU JEV | `eu_jev/eu-jeff-latest` | 32,768 | $0.0415 | $0 | Evaluation |
| Fireworks AI | `fireworks_ai/accounts/fireworks/models/rune` | 262,144 | $0.042 | $0 | Decisions |
| Fireworks AI | `fireworks_ai/accounts/fireworks/models/ultramarine-1-flash-us` | 1,048,576 | $0.225 | $0.75 | Chat; Vision; Structured output |
| Fireworks AI | `fireworks_ai/accounts/fireworks/routers/deepseek-v4p1-flash-1017-spot` | 1,048,576 | $0.21 | $0.84 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Fireworks AI | `fireworks_ai/accounts/fireworks/routers/deepseek-v4p1-flash-spot` | 1,048,576 | $0.21 | $0.84 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Fireworks AI | `fireworks_ai/accounts/fireworks/routers/glm-5p3-spot` | 1,048,576 | $0.98 | $3.08 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Fireworks AI | `fireworks_ai/accounts/fireworks/routers/kimi-k3-spot` | 1,048,576 | $2.1 | $10.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Fireworks AI | `fireworks_ai/accounts/fireworks/routers/spot-deepseek-v4-flash` | 1,048,576 | $0.105 | $0.21 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| GitHub Copilot | `github_copilot/gpt-6.1-terra` | 922,000 | $1 | $5 | Responses; Reasoning; Vision; Tool calling; Structured output |
| Hostinger Router | `hostinger_router/claude-sonnet-5` | 1,000,000 | $2.64 | $13.2 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Hostinger Router | `hostinger_router/gpt-5.2` | 272,000 | $2.1 | $16.8 | Chat; Reasoning; Vision; Tool calling; Structured output |
| Hostinger Router | `hostinger_router/text-embedding-3-large` | 8,191 | $0.1716 | $0 | Embedding |
| Hostinger Router | `hostinger_router/text-embedding-3-small` | 8,191 | $0.03 | $0 | Embedding |
| Kyma | `kyma/claude-fable-5` | 1,000,000 | $13.5 | $67.5 | Chat; Reasoning; Vision; Tool calling; Structured output; PDF input |
| Kyma | `kyma/claude-fable-5.1` | 1,000,000 | $13.5 | $67.5 | Chat; Reasoning; Vision; Tool calling; Structured output; PDF input |
| Kyma | `kyma/claude-haiku-4-5` | 200,000 | $1.35 | $6.75 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Kyma | `kyma/claude-haiku-5.5` | 1,000,000 | $0.135 | $0.675 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input |
| Kyma | `kyma/claude-opus-4-7` | 1,000,000 | $6.75 | $33.75 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Kyma | `kyma/claude-opus-5` | 1,000,000 | $6.75 | $33.75 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input |
| Kyma | `kyma/claude-opus-5.5` | 1,000,000 | $5.4 | $27 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input |
| Kyma | `kyma/claude-sonnet-4-6` | 1,000,000 | $4.05 | $20.25 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Kyma | `kyma/claude-sonnet-5` | 1,000,000 | $2.7 | $13.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input |
| Kyma | `kyma/claude-sonnet-5.5` | 1,000,000 | $2.7 | $13.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input |
| Kyma | `kyma/deepseek-r1` | 64,000 | $0.7425 | $2.957 | Chat; Reasoning; Tool calling; Structured output |
| Kyma | `kyma/deepseek-v3` | 160,000 | $0.518 | $0.7571 | Chat; Reasoning; Tool calling; Structured output |
| Kyma | `kyma/deepseek-v4-flash` | 1,000,000 | $0.123 | $0.2458 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Kyma | `kyma/deepseek-v4-flash-vision-exp` | 1,048,576 | $0.3892 | $1.168 | Chat; Reasoning; Vision; Tool calling; Structured output |
| Kyma | `kyma/deepseek-v4.1-flash` | 1,048,576 | $0.27 | $0.81 | Chat; Reasoning; Vision; Tool calling; Structured output |
| Kyma | `kyma/gemini-3-flash` | 1,048,576 | $0.675 | $4.05 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Kyma | `kyma/gemini-3.1-pro` | 1,048,576 | $2.7 | $16.2 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input |
| Kyma | `kyma/gemini-3.5-flash` | 1,048,576 | $2.025 | $12.15 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Kyma | `kyma/gemini-3.5-flash-lite` | 1,048,576 | $0.405 | $3.375 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Kyma | `kyma/gemini-3.6-flash` | 1,048,576 | $1.013 | $5.063 | Chat; Reasoning; Vision; Tool calling; Prompt caching |
| Kyma | `kyma/gemini-3.7-flash` | 1,048,576 | $2.026 | $10.126 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input |
| Kyma | `kyma/gemini-3.8-flash` | 1,048,576 | $2.026 | $10.126 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input |
| Kyma | `kyma/gemini-4-argon` | 1,048,576 | $5.4 | $27 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input |
| Kyma | `kyma/gemma-4-31b` | 128,000 | $0.1642 | $0.4689 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Kyma | `kyma/glm-4.5-air` | 131,072 | $0.1797 | $1.175 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Kyma | `kyma/glm-4.7-flash` | 203,000 | $0.081 | $0.54 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Kyma | `kyma/glm-5.1` | 203,000 | $1.89 | $5.94 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Kyma | `kyma/glm-5.2` | 1,000,000 | $0.9029 | $3.083 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Kyma | `kyma/glm-5.3` | 1,310,720 | $1.178 | $3.702 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Kyma | `kyma/glm-5.3-flash` | 1,310,720 | $0.172 | $0.5733 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Kyma | `kyma/gpt-5.6-luna` | 1,050,000 | $0.2944 | $1.767 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input |
| Kyma | `kyma/gpt-5.6-luna-pro` | 1,050,000 | $0.2703 | $1.621 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input |
| Kyma | `kyma/gpt-5.6-sol` | 1,050,000 | $5.4 | $27 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input |
| Kyma | `kyma/gpt-5.6-sol-pro` | 1,050,000 | $5.4 | $27 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input |
| Kyma | `kyma/gpt-5.6-terra` | 1,050,000 | $2.7 | $16.2 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Kyma | `kyma/gpt-5.6-terra-pro` | 1,050,000 | $2.7 | $16.2 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input |
| Kyma | `kyma/gpt-6-astra` | 1,050,000 | $13.5 | $67.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Kyma | `kyma/gpt-6-luna` | 1,050,000 | $0.1639 | $0.8195 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input |
| Kyma | `kyma/gpt-6.1-sol` | 1,050,000 | $2.7 | $13.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input |
| Kyma | `kyma/gpt-oss-120b` | 128,000 | $0.0473 | $0.2303 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Kyma | `kyma/grok-4.20` | 2,000,000 | $1.763 | $3.528 | Chat; Reasoning; Vision; Tool calling; Structured output; PDF input |
| Kyma | `kyma/grok-4.20-multi-agent` | 2,000,000 | $1.767 | $3.534 | Chat; Reasoning; Vision; Structured output; PDF input |
| Kyma | `kyma/grok-4.3` | 1,000,000 | $1.92 | $3.838 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Kyma | `kyma/grok-4.5` | 500,000 | $2.73 | $8.189 | Chat; Reasoning; Vision; Tool calling; Structured output; PDF input |
| Kyma | `kyma/grok-4.6` | 500,000 | $2.758 | $8.274 | Chat; Reasoning; Vision; Tool calling; Structured output; PDF input |
| Kyma | `kyma/grok-4.7` | 500,000 | $2.16 | $6.48 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input |
| Kyma | `kyma/grok-build` | 256,000 | $1.389 | $2.777 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Kyma | `kyma/hy3` | 262,144 | $0.1594 | $0.6576 | Chat; Reasoning; Tool calling; Structured output |
| Kyma | `kyma/hy4-preview` | 1,048,576 | $1.1259 | $3.3764 | Chat; Reasoning; Tool calling; Structured output |
| Kyma | `kyma/kimi-k2.6` | 262,144 | $0.5909 | $2.758 | Chat; Reasoning; Vision; Tool calling; Structured output |
| Kyma | `kyma/kimi-k2.7-code` | 262,144 | $1.009 | $4.774 | Chat; Reasoning; Vision; Tool calling; Structured output |
| Kyma | `kyma/kimi-k3` | 1,048,576 | $3.052 | $15.258 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Kyma | `kyma/kimi-k3.1-pro` | 1,048,576 | $2.7 | $13.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Kyma | `kyma/llama-3.3-70b` | 128,000 | $0.135 | $0.432 | Chat; Tool calling; Prompt caching; Structured output |
| Kyma | `kyma/llama-4-maverick` | 1,048,576 | $0.3344 | $1.337 | Chat; Vision; Tool calling; Structured output |
| Kyma | `kyma/mimo-v2.5` | 1,050,000 | $0.1859 | $0.3718 | Chat; Reasoning; Vision; Tool calling; Structured output |
| Kyma | `kyma/mimo-v2.6-flash` | 1,050,000 | $0.189 | $0.378 | Chat; Reasoning; Vision; Tool calling; Structured output |
| Kyma | `kyma/mimo-v2.6-pro` | 1,050,000 | $0.5805 | $1.1745 | Chat; Reasoning; Vision; Tool calling; Structured output |
| Kyma | `kyma/minimax-m2.5` | 196,608 | $0.4188 | $1.675 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Kyma | `kyma/minimax-m2.7` | 204,800 | $0.405 | $1.62 | Chat; Reasoning; Tool calling; Structured output |
| Kyma | `kyma/minimax-m3` | 1,048,576 | $0.3956 | $1.582 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Kyma | `kyma/minimax-m3.1-flash` | 1,048,576 | $0.2025 | $0.81 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Kyma | `kyma/muse-glimmer-30b` | 131,072 | $0.4554 | $1.821 | Chat; Reasoning; Vision; Tool calling; Structured output |
| Kyma | `kyma/muse-spark-1.1` | 1,048,576 | $1.542 | $5.243 | Chat; Reasoning; Vision; Tool calling; Structured output; PDF input |
| Kyma | `kyma/muse-spark-1.2` | 1,048,576 | $1.773 | $6.025 | Chat; Reasoning; Vision; Tool calling; Structured output; PDF input |
| Kyma | `kyma/muse-spark-1.3` | 1,048,576 | $1.688 | $5.738 | Chat; Reasoning; Vision; Tool calling; Structured output; PDF input |
| Kyma | `kyma/muse-spark-open` | 1,048,576 | $1.688 | $5.738 | Chat; Reasoning; Vision; Tool calling; Structured output |
| Kyma | `kyma/muse-wonder` | 1,048,576 | $5.4 | $27 | Chat; Reasoning; Vision; Tool calling; Structured output; PDF input |
| Kyma | `kyma/nemotron-3-ultra-550b` | 1,000,000 | $0.675 | $3.375 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Kyma | `kyma/nemotron-3.5-super-vl` | 1,048,576 | $0.081 | $0.4725 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Kyma | `kyma/qwen-3-32b` | 32,768 | $0.108 | $0.378 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Kyma | `kyma/qwen-3-coder` | 131,072 | $0.3546 | $1.612 | Chat; Tool calling; Prompt caching; Structured output |
| Kyma | `kyma/qwen-3.6-plus` | 1,000,000 | $0.4388 | $2.633 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Kyma | `kyma/qwen-3.7-max` | 1,000,000 | $2.071 | $6.207 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Kyma | `kyma/qwen-3.7-plus` | 1,000,000 | $0.4325 | $1.731 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Kyma | `kyma/qwen-3.8-max` | 1,000,000 | $2.228 | $6.684 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Kyma | `kyma/qwen3.7-flash` | 1,000,000 | $0.0435 | $0.1886 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Kyma | `kyma/qwen3.8-27b` | 1,000,000 | $0.3826 | $2.732 | Chat; Reasoning; Vision; Tool calling; Structured output |
| Kyma | `kyma/qwen3.8-flash` | 1,000,000 | $0.2045 | $0.641 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Kyma | `kyma/sonar` | 127,072 | $1.35 | $1.35 | Chat; Vision; Prompt caching |
| Kyma | `kyma/sonar-pro` | 200,000 | $4.05 | $20.25 | Chat; Vision; Prompt caching |
| Kyma | `kyma/step-3.7-flash` | 256,000 | $0.2229 | $1.282 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Kyma | `kyma/step-5-preview` | 1,048,576 | $1.35 | $3.645 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Mistral | `mistral/deepseek-v4-1-flash-1017` | 1,048,576 | $0.3 | $1.2 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Mistral | `mistral/voxtral-mini-transcribe-3` | - | - | - | Transcription; Audio input; `input_cost_per_second`: $0.00005833 |
| Mistral | `mistral/voxtral-mini-transcribe-3-0` | - | - | - | Transcription; Audio input; `input_cost_per_second`: $0.00005833 |
| Mistral | `mistral/voxtral-mini-transcribe-realtime-3` | - | - | - | Transcription; Audio input; `input_cost_per_second`: $0.00013333 |
| Mistral | `mistral/voxtral-mini-transcribe-realtime-3-0` | - | - | - | Transcription; Audio input; `input_cost_per_second`: $0.00013333 |
| Mistral | `mistral/voxtral-mini-tts-3` | - | - | - | Text to speech; `input_cost_per_character`: $0.000013 |
| Mistral | `mistral/voxtral-mini-tts-3-0` | - | - | - | Text to speech; `input_cost_per_character`: $0.000013 |
| Mistral | `mistral/voxtral-small-transcribe-3` | - | - | - | Transcription; Audio input; `input_cost_per_second`: $0.00006667 |
| Mistral | `mistral/voxtral-small-transcribe-3-0` | - | - | - | Transcription; Audio input; `input_cost_per_second`: $0.00006667 |
| Mistral | `mistral/zai-glm-5-3-flash` | 1,048,576 | $0.15 | $0.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Moonshot | `moonshot/kimi-k3.1-pro` | 1,048,576 | $2 | $10 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Morph | `morph/morph-dsv41flash` | 1,048,576 | $0.12 | $0.8 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Morph | `morph/morph-dsv41flash-1017` | 1,048,576 | $0.12 | $0.8 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Morph | `morph/morph-dsv41flash-abliterated` | 1,048,576 | $0.3 | $1.2 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Morph | `morph/morph-dsv4flash` | 1,048,576 | $0.141953 | $0.399625 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Morph | `morph/morph-glm53-744b` | 1,048,576 | $1.19 | $6 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Morph | `morph/morph-glm53flash` | 1,048,576 | $0.2 | $0.7 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Morph | `morph/morph-kimik3` | 1,048,576 | $2.5 | $14 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Morph | `morph/morph-kimik3-fast` | 1,048,576 | $6 | $22.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| OpenAI | `gpt-6-astra-law` | 922,000 | $10 | $50 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; Computer use |
| OpenAI | `gpt-6-rosalind` | 922,000 | $15 | $75 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; Computer use |
| OpenAI | `gpt-6.1-terra` | 922,000 | $1 | $5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; Computer use |
| OpenCode Go | `opencode_go/beam-free` | 1,048,576 | $0 | $0 | Chat; Reasoning; Tool calling |
| OpenCode Go | `opencode_go/claude-haiku-5-5` | 1,000,000 | $0.1 | $0.5 | Chat; Reasoning; Vision; Tool calling |
| OpenCode Go | `opencode_go/deepseek-v4-pro` | 1,000,000 | $1.32 | $3.96 | Chat; Reasoning; Tool calling |
| OpenCode Go | `opencode_go/deepseek-v4.1-flash` | 1,000,000 | $0.3 | $1.2 | Chat; Reasoning; Vision; Tool calling |
| OpenCode Go | `opencode_go/gemini-4-argon` | 1,048,576 | $2 | $10 | Chat; Reasoning; Vision; Tool calling |
| OpenCode Go | `opencode_go/glm-5.2` | 1,000,000 | $1.4 | $4.4 | Chat; Reasoning; Tool calling |
| OpenCode Go | `opencode_go/glm-5.3` | 1,000,000 | $1.4 | $4.4 | Chat; Reasoning; Tool calling |
| OpenCode Go | `opencode_go/glm-5.3-flash` | 1,000,000 | $0.15 | $0.5 | Chat; Reasoning; Vision; Tool calling |
| OpenCode Go | `opencode_go/gpt-5.6-luna` | 922,000 | $0.2 | $1.2 | Responses; Reasoning; Vision; Tool calling |
| OpenCode Go | `opencode_go/gpt-6-luna` | 922,000 | $0.1 | $0.5 | Responses; Reasoning; Vision; Tool calling |
| OpenCode Go | `opencode_go/grok-4.7` | 500,000 | $2 | $6 | Responses; Reasoning; Vision; Tool calling |
| OpenCode Go | `opencode_go/hy3` | 192,000 | $0.14 | $0.58 | Chat; Reasoning; Tool calling |
| OpenCode Go | `opencode_go/hy4-preview` | 1,024,000 | $0.834 | $2.501 | Chat; Reasoning; Tool calling |
| OpenCode Go | `opencode_go/kimi-k2.7-code` | 262,144 | $0.95 | $4 | Chat; Reasoning; Vision; Tool calling |
| OpenCode Go | `opencode_go/kimi-k3` | 1,048,576 | $3 | $15 | Chat; Reasoning; Vision; Tool calling |
| OpenCode Go | `opencode_go/kimi-k3.1-pro` | 1,048,576 | $2 | $10 | Chat; Reasoning; Vision; Tool calling |
| OpenCode Go | `opencode_go/longcat-2.0` | 1,000,000 | $0.3 | $1.2 | Chat; Reasoning; Tool calling |
| OpenCode Go | `opencode_go/longcat-2.5-preview-free` | 1,000,000 | $0 | $0 | Chat; Reasoning; Vision; Tool calling |
| OpenCode Go | `opencode_go/mimo-v2.5` | 1,000,000 | $0.14 | $0.28 | Chat; Reasoning; Vision; Tool calling |
| OpenCode Go | `opencode_go/mimo-v2.5-pro` | 1,048,576 | $0.435 | $0.87 | Chat; Reasoning; Tool calling |
| OpenCode Go | `opencode_go/mimo-v2.6-flash` | 1,048,576 | $0.14 | $0.28 | Chat; Reasoning; Vision; Tool calling |
| OpenCode Go | `opencode_go/mimo-v2.6-pro` | 1,048,576 | $0.435 | $0.87 | Chat; Reasoning; Vision; Tool calling |
| OpenCode Go | `opencode_go/minimax-m3` | 1,000,000 | $0.3 | $1.2 | Chat; Reasoning; Vision; Tool calling |
| OpenCode Go | `opencode_go/minimax-m3.1-flash` | 1,000,000 | $0.15 | $0.6 | Chat; Reasoning; Vision; Tool calling |
| OpenCode Go | `opencode_go/muse-spark-1.2-contributor` | 1,048,576 | $0.1 | $0.2 | Responses; Reasoning; Vision; Tool calling |
| OpenCode Go | `opencode_go/muse-spark-1.3-contributor` | 1,048,576 | $0.1 | $0.2 | Responses; Reasoning; Vision; Tool calling |
| OpenCode Go | `opencode_go/qwen3.7-plus` | 1,000,000 | $0.4 | $1.6 | Chat; Reasoning; Vision; Tool calling |
| OpenCode Go | `opencode_go/qwen3.8-flash` | 1,000,000 | $0.15 | $0.47 | Chat; Reasoning; Vision; Tool calling |
| OpenCode Go | `opencode_go/qwen3.8-max` | 1,000,000 | $2 | $6 | Chat; Reasoning; Vision; Tool calling |
| OpenCode Go | `opencode_go/step-5-preview` | 1,000,000 | $1 | $2.7 | Chat; Reasoning; Vision; Tool calling |
| Refuseless | `refuseless/deepseek-v4.1-flash-abliterated` | 1,048,576 | $0.14 | $0.5 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Refuseless | `refuseless/deepseek-v4.1-flash-fast` | 1,048,576 | $0.05 | $0.15 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Refuseless | `refuseless/glm-5.3-abliterated` | 1,048,576 | $1 | $2 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Refuseless | `refuseless/glm-5.3-flash-abliterated` | 1,048,576 | $0.12 | $0.5 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Refuseless | `refuseless/minimax-m3.1-flash` | 1,048,576 | $0.05 | $0.25 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Soniox | `soniox/stt-rt-preview` | - | - | - | Transcription; Audio input; `input_cost_per_second`: $0.00003333 |
| Soniox | `soniox/stt-rt-preview-v2` | - | - | - | Transcription; Audio input; `input_cost_per_second`: $0.00003333 |
| Soniox | `soniox/stt-rt-v3` | - | - | - | Transcription; Audio input; `input_cost_per_second`: $0.00003333 |
| Soniox | `soniox/stt-rt-v3-preview` | - | - | - | Transcription; Audio input; `input_cost_per_second`: $0.00003333 |
| Soniox | `soniox/stt-rt-v4` | - | - | - | Transcription; Audio input; `input_cost_per_second`: $0.00003333 |
| Soniox | `soniox/stt-rt-v5` | - | - | - | Transcription; Audio input; `input_cost_per_second`: $0.00003333 |
| StreamLake | `streamlake/deepseek-r1` | 98,304 | $0.571 | $2.286 | Chat; Reasoning; Tool calling; Prompt caching |
| StreamLake | `streamlake/DeepSeek-V3` | 56,000 | $0.286 | $1.143 | Chat; Tool calling; Prompt caching |
| StreamLake | `streamlake/deepseek-v3.1` | 98,304 | $0.571 | $1.714 | Chat; Reasoning; Tool calling; Prompt caching |
| StreamLake | `streamlake/deepseek-v4-flash` | 1,048,576 | $0.14 | $0.28 | Chat; Reasoning; Tool calling; Prompt caching |
| StreamLake | `streamlake/deepseek-v4-flash-0731` | 1,048,576 | $0.44 | $1.32 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| StreamLake | `streamlake/deepseek-v4-pro` | 1,048,576 | $1.74 | $3.48 | Chat; Reasoning; Tool calling; Prompt caching |
| StreamLake | `streamlake/DeepSeek-V4-Pro-0813` | 1,048,566 | $1.32 | $3.96 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| StreamLake | `streamlake/deepseek-v4.1-flash-1017` | 1,048,576 | $0.3 | $1.2 | Chat; Reasoning; Vision; Tool calling; Prompt caching |
| StreamLake | `streamlake/deepseek-v4.1-flash-260910` | 1,048,568 | $0.3 | $1.2 | Chat; Reasoning; Vision; Tool calling; Prompt caching |
| StreamLake | `streamlake/glm-5` | 202,752 | $1 | $3.2 | Chat; Reasoning; Tool calling; Prompt caching |
| StreamLake | `streamlake/glm-5.1` | 202,752 | $1.4 | $4.4 | Chat; Reasoning; Tool calling; Prompt caching |
| StreamLake | `streamlake/glm-5.2` | 1,048,566 | $1.4 | $4.4 | Chat; Reasoning; Tool calling; Prompt caching |
| StreamLake | `streamlake/GLM-5.3` | 1,048,576 | $1.4 | $4.4 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| StreamLake | `streamlake/GLM-5.3-Flash` | 1,048,576 | $0.15 | $0.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| StreamLake | `streamlake/Kimi-K2-Instruct-0905` | 224,000 | $0.571 | $2.286 | Chat; Tool calling; Prompt caching |
| StreamLake | `streamlake/kimi-k2.6` | 262,144 | $0.95 | $4 | Chat; Vision; Tool calling; Prompt caching |
| StreamLake | `streamlake/kimi-k2.7-code` | 262,144 | $0.95 | $4 | Chat; Reasoning; Vision; Tool calling; Prompt caching |
| StreamLake | `streamlake/mimo-v2.6-flash` | - | $0.14 | $0.28 | Chat; Vision; Prompt caching |
| StreamLake | `streamlake/mimo-v2.6-pro` | - | $0.435 | $0.87 | Chat; Vision; Prompt caching |
| StreamLake | `streamlake/minimax-m2.5` | 196,608 | $0.3 | $1.2 | Chat; Reasoning; Tool calling; Prompt caching |
| StreamLake | `streamlake/minimax-m3` | 1,000,000 | $0.6 | $2.4 | Chat; Reasoning; Vision; Tool calling; Prompt caching |
| StreamLake | `streamlake/qwen3.5-397b-a17b` | 258,048 | $0.6 | $3.6 | Chat; Reasoning; Vision; Tool calling; Prompt caching |
| StreamLake | `streamlake/qwen3.6-27b` | 229,376 | $0.6 | $3.6 | Chat; Vision; Tool calling |
| StreamLake | `streamlake/qwen3.6-35b-a3b` | 229,376 | $0.375 | $2.25 | Chat; Vision; Tool calling |
| StreamLake | `streamlake/qwen3.8-2.4t-a95b` | 983,616 | $2 | $6 | Chat; Reasoning; Vision; Tool calling; Prompt caching |
| StreamLake | `streamlake/qwen3.8-27b` | 983,616 | $0.5 | $3 | Chat; Reasoning; Vision; Tool calling; Prompt caching |
| Tencent TokenHub | `tencent/seedream-image-v5.0-flash` | - | - | - | Image generation; `output_cost_per_image`: $0.018 |
| Tencent TokenHub | `tencent/seedream-image-v5.0-lite` | - | - | - | Image generation; `output_cost_per_image`: $0.035 |
| Tencent TokenHub | `tencent/seedream-image-v5.0-pro` | - | - | - | Image generation; `output_cost_per_image`: $0.09 |
| Together AI | `together_ai/MiniMaxAI/MiniMax-M3.1-Flash` | 1,048,576 | $0.15 | $0.6 | Chat; Prompt caching |
| Weights and Biases | `wandb/reflection/Beam-1.0-501B-A23B` | 1,049,000 | $1 | $3 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Weights and Biases | `wandb/zai-org/GLM-5.3` | 1,049,000 | $1.2 | $4 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Z.AI | `zai/glm-5v-turbo` | 200,000 | $1.2 | $4 | Chat; Reasoning; Vision; Tool calling; Prompt caching |
| ZeroGPU | `zerogpu/deepseek-v4.1-flash` | 1,048,576 | $0.3 | $1.2 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| ZeroGPU | `zerogpu/glm-5.3-flash` | 1,048,576 | $0.1 | $0.35 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| ZeroGPU | `zerogpu/gpt-4.1-mini` | 1,047,576 | $0.4 | $1.6 | Chat; Tool calling; Prompt caching; Structured output |
| ZeroGPU | `zerogpu/gpt-5.4-nano` | 272,000 | $0.2 | $1.25 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| ZeroGPU | `zerogpu/gpt-5.6-luna` | 272,000 | $0.2 | $1.2 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| ZeroGPU | `zerogpu/gpt-6-luna` | 272,000 | $0.1 | $0.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| ZeroGPU | `zerogpu/gpt-oss-120b` | 128,000 | $0.15 | $0.6 | Chat; Reasoning; Tool calling; Structured output |
| ZeroGPU | `zerogpu/LFM2.5-1.2B-Instruct` | 32,768 | $0.02 | $0.05 | Chat |
| ZeroGPU | `zerogpu/LFM2.5-1.2B-Thinking` | 32,768 | $0.02 | $0.05 | Chat |
| ZeroGPU | `zerogpu/llama-3.1-8b-instruct-fast` | 131,072 | $0.15 | $0.28 | Chat; Tool calling; Structured output |
| ZeroGPU | `zerogpu/llama-3.2-3b-instruct-fast` | 131,072 | $0.05 | $0.3 | Chat |
| ZeroGPU | `zerogpu/qwen3-30b-a3b-fp8` | 32,768 | $0.1 | $0.45 | Chat; Reasoning; Tool calling; Structured output |
| ZeroGPU | `zerogpu/qwen3.6-35b-a3b` | 262,144 | $0.2 | $1.5 | Chat; Reasoning; Vision; Tool calling; Structured output |

</details>

### New providers

- Add ai& as an OpenAI-compatible provider under the `aiand/` prefix, reading `AIAND_API_KEY`, listed in the Add Model form, with priced models and native `/v1/responses` and `/v1/messages` - [PR #38958](https://github.com/BerriAI/litellm/pull/38958)
- Add CLF AI Gateway as an OpenAI-compatible provider under the `clf_ai_gateway/` prefix, reading `CLF_AI_GATEWAY_API_KEY`, listed in the Add Model form, with ten priced models - [PR #39324](https://github.com/BerriAI/litellm/pull/39324)
- Add StreamLake as an OpenAI-compatible provider under the `streamlake/` prefix with 26 priced models, addable from the config or the Add Model page - [PR #41006](https://github.com/BerriAI/litellm/pull/41006)
- Add OpenInfer as an OpenAI-compatible provider under the `openinfer/` prefix with priced models and native `/v1/responses` and `/v1/messages` - [PR #41034](https://github.com/BerriAI/litellm/pull/41034)
- Add ZeroGPU as an OpenAI-compatible provider under the `zerogpu/` prefix with 13 priced models, native `/v1/responses` and an Add Model entry - [PR #43874](https://github.com/BerriAI/litellm/pull/43874)
- Add Hostinger Router as an OpenAI-compatible provider under the `hostinger_router/` prefix for chat, responses, messages and embeddings, with prices from Hostinger's public catalog - [PR #44863](https://github.com/BerriAI/litellm/pull/44863)
- Add an eu/jev decision API pass-through with spend tracking, so calls use the virtual key under model access checks and request-per-minute limits and are logged and priced - [PR #46875](https://github.com/BerriAI/litellm/pull/46875)
- Add OpenCode Go as a provider that selects the right upstream API per model across chat completions, Responses and Messages, with published Go prices and live model discovery - [PR #48140](https://github.com/BerriAI/litellm/pull/48140)
- Add Refuseless as an OpenAI-compatible provider under the `refuseless/` prefix with Chat Completions and native `/v1/responses` routes and five priced models - [PR #48497](https://github.com/BerriAI/litellm/pull/48497)
- Add BigModel under the `bigmodel/` prefix for Chat Completions, Responses and Anthropic Messages, reading `BIGMODEL_API_KEY`, with GLM-5.3, Flash and FlashX pricing and an Admin UI credential form - [PR #48563](https://github.com/BerriAI/litellm/pull/48563)
- Add Kyma API as an OpenAI-compatible provider under the `kyma/` prefix, billed from the `usage.cost` Kyma reports with 83 catalog rows as the fallback price, and refuse image and audio routes before calling Kyma - [Commit cd42694](https://github.com/BerriAI/litellm/commit/cd42694b48e30ab74ba6e24e83aabf4b40c041b5)

### Decisions providers

- Add Nace Drex as a Decisions provider, listed in the Add Model form with Drex models and the decision-model connection test - [PR #46523](https://github.com/BerriAI/litellm/pull/46523)
- Support Entra ID auth for `azure_ai` Microsoft-Decision-1 on `/v1/decisions` and `/v1/systemone`, so an API key is no longer required - [PR #46539](https://github.com/BerriAI/litellm/pull/46539)
- Bill an unpriced returned TypeSafe version at the requested model's rates instead of $0, and name the missing or null `answers` field in malformed System One replies with a 500 - [PR #47508](https://github.com/BerriAI/litellm/pull/47508)
- Remove the cap on how many questions one System One request can carry - [Commit 1e6dc81](https://github.com/BerriAI/litellm/commit/1e6dc8176929b065fbb77dcbbf3416c3068fad04)
- Set `gpt-6-luna` Decisions cache rates to the standard cached and 30m write rates, so cached reads bill at 0.01 USD per 1M tokens - [PR #48066](https://github.com/BerriAI/litellm/pull/48066)
- Keep missing token usage and SDK cost unknown on native Decisions calls instead of reporting zero tokens and a $0 cost - [PR #48261](https://github.com/BerriAI/litellm/pull/48261)
- Add LM Studio decision models on the Decisions routes and SDK calls through LM Studio's native System One endpoint, with optional bearer authentication - [PR #48448](https://github.com/BerriAI/litellm/pull/48448)
- Send `/v1/decisions` and `/v1/systemone` requests to a custom backend's `base_url` instead of returning a misleading authentication error - [PR #48505](https://github.com/BerriAI/litellm/pull/48505)
- Keep missing choice and score probabilities absent in Decisions responses while preserving explicit `0.0` values - [PR #48524](https://github.com/BerriAI/litellm/pull/48524)
- Handle an invalid JSON body from a Decisions provider in `transform_decisions_response` instead of raising an unhandled `ValidationError` - [PR #48662](https://github.com/BerriAI/litellm/pull/48662)
- Support Ollama decision models on the Decisions endpoints and the Python SDK without the hosted-vLLM workaround, keeping both Ollama prefixes as the provider in spend logs - [PR #48871](https://github.com/BerriAI/litellm/pull/48871)

### ai&

- Show ai& by its name and logo in the Admin UI, drop retired ai& models from `aiand/*` listings and health checks on their date, and price `deepseek-v4.1-flash-1017` and `meta/muse-spark-open` - [PR #49158](https://github.com/BerriAI/litellm/pull/49158)

### Amazon Bedrock

- Omit the system prompt from Bedrock Voxtral transcription and report its token usage, so `/v1/audio/transcriptions` stops returning 400 and spend is no longer $0 - [PR #41565](https://github.com/BerriAI/litellm/pull/41565)
- Route a Bedrock model id with no Invoke provider to Converse, so a model missing from the cost map no longer answers 404 `Unknown provider=None` - [PR #43290](https://github.com/BerriAI/litellm/pull/43290)
- Raise `maxTokens` to Bedrock's minimum of 16 for Kimi K3 on Converse, so Claude Code's `/model` check with `max_tokens: 1` no longer returns 400 - [PR #43875](https://github.com/BerriAI/litellm/pull/43875)
- Drop the `dangerous-tool-use-2026-09-03` beta from Bedrock Invoke requests without `safeguards`, so Claude Code auto mode no longer gets 400 `invalid beta flag` - [PR #44471](https://github.com/BerriAI/litellm/pull/44471)
- Return a 400 that names the bad line for malformed Bedrock batch JSONL input instead of a 500 with a raw Python error - [PR #45992](https://github.com/BerriAI/litellm/pull/45992)
- Stop a `mode: chat` or `mode: responses` Mantle deployment from rewriting its siblings' routing, so each deployment's own `model_info.mode` decides between Chat Completions and the Responses API - [PR #46263](https://github.com/BerriAI/litellm/pull/46263)
- Keep reasoning, thinking blocks and `reasoning_tokens` on fake streams, and end JSON-mode fake streams on `stop` instead of `finish_reason="tool_calls"` with no tool calls - [PR #46863](https://github.com/BerriAI/litellm/pull/46863)
- Use native structured output on Bedrock Haiku 5.5 and Sonnet 5.5 and stop the 400s on JSON schema requests for Fable 5 and `minimum`-style limits on Sonnet 4.6 - [PR #46870](https://github.com/BerriAI/litellm/pull/46870)
- Send native structured output first on Bedrock Opus 4.8 and Sonnet 5 so `json_schema` requests keep their reasoning, and retry once with the json tool when Bedrock rejects the native request - [PR #47100](https://github.com/BerriAI/litellm/pull/47100)
- Mark the Bedrock, us-gov and Bedrock Mantle gpt-oss rows `supports_vision: false`, so auto router `modality_routing` sends image requests to a vision tier instead of a Bedrock 400 - [PR #48149](https://github.com/BerriAI/litellm/pull/48149)
- Price `bedrock/claude_platform/<model>` calls from their own cost map rows at Claude API rates, so Claude Platform on AWS requests no longer log $0 spend - [PR #48150](https://github.com/BerriAI/litellm/pull/48150)
- Set context window and max output limits for `amazon.nova-2-5-sonic` and `amazon.nova-2-sonic-v1:0` from the Bedrock model cards - [PR #48247](https://github.com/BerriAI/litellm/pull/48247)
- Add the `global.openai.gpt-6.1-terra` and `us.openai.gpt-6.1-terra` Bedrock inference profiles to the cost map - [PR #48441](https://github.com/BerriAI/litellm/pull/48441)
- Correct `max_input_tokens` to 922000 on Bedrock OpenAI GPT rows and add a `token_count_model` to the two `bedrock_mantle` `claude-opus-5-5` rows - [PR #48479](https://github.com/BerriAI/litellm/pull/48479)
- Add `token_count_model` to three Mantle-native Claude models, so token counting for them runs in an allowed region - [PR #48682](https://github.com/BerriAI/litellm/pull/48682)
- Retry without `strict` when Bedrock rejects strict tool schemas and `drop_params` is on, instead of returning the 400 - [Commit a0c490e](https://github.com/BerriAI/litellm/commit/a0c490ea5471c8ef2c09b26e0ea744fe1de9961a)
- Route `bedrock/<region>/<embedding model>` to that region with the bare model id and bill that region's price, so AWS no longer rejects it with `The provided model identifier is invalid` - [PR #49072](https://github.com/BerriAI/litellm/pull/49072)
- Add the published Priority, Batch and Flex prices missing from Bedrock regional rows, so tiered requests bill AWS's rates instead of falling back to Standard - [PR #49113](https://github.com/BerriAI/litellm/pull/49113)
- Align the limits and supported endpoints of `bedrock_mantle/openai.gpt-5.6-cyber` with its Bedrock model card - [PR #49350](https://github.com/BerriAI/litellm/pull/49350)
- Restore the `eu.anthropic.claude-haiku-4-5-20251001-v1:0` cost map row, so EU Bedrock calls are billed at the EU price and exact-name lookups work again - [PR #49375](https://github.com/BerriAI/litellm/pull/49375)
- Raise max output tokens on two GovCloud West Llama 3 rows to the 8K on their model card - [PR #49543](https://github.com/BerriAI/litellm/pull/49543)
- Default `max_tokens` on Bedrock Invoke and Mantle Claude to the deployment's `model_info.max_output_tokens`, then the mapped model limit, so long answers are not cut at 4096 and Haiku 4.5 stops answering 400 - [PR #49692](https://github.com/BerriAI/litellm/pull/49692)

### Anthropic

- Stop adding the `[System: ...]` placeholder to Claude assistant turns that carry tool calls or non-text blocks, so the model no longer echoes it back - [PR #34822](https://github.com/BerriAI/litellm/pull/34822)
- Add the compaction, thinking display and tool change betas for Claude on `vertex_ai` and `azure_ai` when a request uses them, so those requests stop returning 400 - [PR #44747](https://github.com/BerriAI/litellm/pull/44747)
- Send PDF `image_url` content on `/v1/chat/completions` to Claude as document blocks, including PDFs served with extra content type parameters, instead of an image block that Anthropic and Vertex AI reject with a 400 - [PR #46984](https://github.com/BerriAI/litellm/pull/46984)
- Fix Claude `json_schema` answers that dropped keys listed only in `required`, came back half unwrapped, escaped non-ASCII text, or lost the closing brace on a cut stream - [PR #47478](https://github.com/BerriAI/litellm/pull/47478)
- Keep a `redacted_thinking` content item in assistant messages on every Claude route, so Claude receives it and Bedrock Converse stops answering 400 on a doubled block - [PR #47489](https://github.com/BerriAI/litellm/pull/47489)
- Raise the fallback `max_tokens` for Anthropic models missing from the cost map from 4096 to 128000, with `DEFAULT_ANTHROPIC_CHAT_MAX_TOKENS` still overriding it - [PR #48502](https://github.com/BerriAI/litellm/pull/48502)
- Remove `supports_speed` from `claude-opus-4-7`, so `drop_params` drops `speed` and the request goes through instead of getting Anthropic's 400 after fast mode was removed - [PR #48764](https://github.com/BerriAI/litellm/pull/48764)
- Add the thinking betas when `thinking.block_binding` or `display` set to `updates` is sent, and drop other beta-gated body fields such as `clear_at` under `drop_params`, so calls no longer get Anthropic's 400 - [PR #48793](https://github.com/BerriAI/litellm/pull/48793)
- Map Anthropic's `model_context_window_exceeded` stop reason to `length` on chat and `incomplete` on Responses instead of reporting a normal `stop` - [PR #48874](https://github.com/BerriAI/litellm/pull/48874)
- Map Claude's `pause_turn` to `length` on chat, return a refusal's explanation in `message.refusal`, `delta.refusal` and a Responses `refusal` part, and let a paused turn be resent - [PR #49192](https://github.com/BerriAI/litellm/pull/49192)
- Return a 400 naming the bad field when a `role` or tool call id sent to Claude is not a string, instead of a 500 `unhashable type` error - [PR #49237](https://github.com/BerriAI/litellm/pull/49237)

### Azure

- Keep OpenAI prompt cache breakpoints on Foundry chat completions by sending text parts instead of one flattened string, so explicit cache mode caches repeats - [PR #45299](https://github.com/BerriAI/litellm/pull/45299)
- Route Azure `/v1/responses` past dated `api_version` pins, count Grok reasoning tokens on `azure_ai`, refresh provider sets after `register_model`, and stop advertising `reasoning_effort: none` on `gpt-6.1-sol` - [PR #46377](https://github.com/BerriAI/litellm/pull/46377)
- Reuse the cached Entra token provider on the Responses path, so Azure Responses calls stop fetching a new token on every request and blocking the proxy's event loop - [PR #46421](https://github.com/BerriAI/litellm/pull/46421)
- Bill Grok reasoning tokens on non-streaming `azure_ai` calls whatever the deployment is named, instead of under-billing when the name lacks grok - [PR #46969](https://github.com/BerriAI/litellm/pull/46969)
- Cache Azure Entra username and password, Bing grounding and OIDC fallback token providers, and fetch tokens off the event loop, so calls stop paying a blocking AAD round trip each - [PR #47348](https://github.com/BerriAI/litellm/pull/47348)
- Add `azure_ai/MAI-Code-1.1-Flash` to the cost map with input, cached input and output prices from Azure - [PR #47779](https://github.com/BerriAI/litellm/pull/47779)
- Drop `tool_reference` parts from tool messages on `azure_ai` chat, so Claude Code sessions routed to non-Claude models on Foundry stop failing with a 400 after ToolSearch runs - [PR #48032](https://github.com/BerriAI/litellm/pull/48032)
- Forward the `thinking-binding-controls-2026-08-01` beta header to Claude on Azure AI Foundry, so `thinking.block_binding` on `/v1/messages` stops returning 400 - [PR #48033](https://github.com/BerriAI/litellm/pull/48033)
- Accept explicit v1 base URLs for Azure `/v1/responses` deployments - [Commit 96abce8](https://github.com/BerriAI/litellm/commit/96abce842b9e90a51c1c7e44f297379d9f9f072d)
- Set `max_input_tokens` to 128000 for `azure/gpt-chat-latest`, `azure/us/gpt-chat-latest` and `azure_ai/gpt-chat-latest`, down from 272000, to match the Azure model page - [PR #48252](https://github.com/BerriAI/litellm/pull/48252)
- Set `max_input_tokens` to 32768 for `azure_ai/Microsoft-Decision-1` - [PR #48434](https://github.com/BerriAI/litellm/pull/48434)
- Declare audio input and output support on both dated Azure audio models, so model metadata no longer returns null audio capabilities - [PR #48475](https://github.com/BerriAI/litellm/pull/48475)
- Add `azure/` Decisions support at `/openai/v1/decisions` that uses Entra credentials with a refreshable token provider when no API key is set, and keep Azure API keys working - [PR #48529](https://github.com/BerriAI/litellm/pull/48529)
- Map Azure's `context_length_exceeded` error code to `ContextWindowExceededError`, so `context_window_fallbacks` run for chat completions, Responses and embeddings - [PR #48616](https://github.com/BerriAI/litellm/pull/48616)
- Share one Entra token request per worker across a burst of Azure requests, instead of one token fetch per request on a cold start and in a token's last five minutes - [PR #48769](https://github.com/BerriAI/litellm/pull/48769)
- Add Batch API prices to the unversioned `azure/o3`, `azure/o4-mini`, `azure/o3-mini`, `azure/gpt-4o` and `azure/gpt-4o-mini` rows, so batch calls on those aliases no longer bill at the standard rate - [PR #49182](https://github.com/BerriAI/litellm/pull/49182)

### Baseten

- Forward `reasoning_effort` to the Baseten Model API instead of dropping it or raising, so callers control thinking effort on Kimi K3, DeepSeek V4, GLM and gpt-oss - [PR #40152](https://github.com/BerriAI/litellm/pull/40152)
- List current Baseten Model APIs for `baseten/*` from the cost map and honor `check_provider_endpoint: true`, instead of three retired 2023 deployment ids - [PR #46945](https://github.com/BerriAI/litellm/pull/46945)
- Lower the `baseten/reflection/Beam-1.0` prices to 0.40 USD input, 1.20 USD output and 0.04 USD cached input per 1M tokens, matching the Baseten models API - [PR #47784](https://github.com/BerriAI/litellm/pull/47784)
- Add the `baseten/decision-models/baseten-elephant-9b-latest` and `baseten/decision-models/baseten-mammoth-27b-latest` Decisions models at $0 input - [PR #48453](https://github.com/BerriAI/litellm/pull/48453)
- Price `baseten-elephant-9b-latest` and `baseten-mammoth-27b-latest` decision models at their published input rates instead of $0 - [PR #48849](https://github.com/BerriAI/litellm/pull/48849)
- Add `baseten/decision-models/baseten-joey-2b-latest` in `decisions` mode with 16384 input tokens, vision support, 0.01 USD per 1M input tokens and no output charge - [PR #49123](https://github.com/BerriAI/litellm/pull/49123)

### Cerebras

- Add `cerebras/llama-3.1-8b` and `cerebras/llama-3.1-70b` hyphenated model names, so either spelling gets cost tracking - [PR #48158](https://github.com/BerriAI/litellm/pull/48158)

### ChatGPT

- Forward a client's own ChatGPT subscription through the gateway, so Codex and Pi keep their ChatGPT login while using a separate gateway key, with accounts isolated and tokens never saved - [PR #41522](https://github.com/BerriAI/litellm/pull/41522)
- Use a stable `prompt_cache_key` as the upstream ChatGPT session id, so repeat turns reuse one session and its prompt cache - [PR #42014](https://github.com/BerriAI/litellm/pull/42014)
- Forward the caller's ChatGPT login and workspace for image generation, so Codex image requests stop asking for interactive authentication when the caller already supplied credentials - [PR #48522](https://github.com/BerriAI/litellm/pull/48522)
- Send typed `system` input items to the Codex backend as `developer`, so ChatGPT-subscription models stop failing with `400 System messages are not allowed` - [PR #48668](https://github.com/BerriAI/litellm/pull/48668)

### Cloudflare

- Clarify the Cloudflare chat endpoint warning to say the chat rewrite targets `/ai/v1`, while Decisions models still use `/ai/run/{model}` - [PR #48265](https://github.com/BerriAI/litellm/pull/48265)

### Cohere

- Send a string `stop` to Cohere chat and v2 chat as a one item `stop_sequences` list, as the Cohere API expects, instead of forwarding the bare string - [PR #47091](https://github.com/BerriAI/litellm/pull/47091)
- Emit streamed tool calls from Cohere v2 `tool-call-start` and `tool-call-delta` chunks with id, name and arguments, so agents on models like `cohere/command-a-plus-05-2026` can use tools with `stream` on - [PR #47794](https://github.com/BerriAI/litellm/pull/47794)

### DashScope

- Bill explicit Qwen cache hits at their own `explicit_cache_read_input_token_cost` and explicit cache writes at 125% for `qwen3.7-max`, instead of pricing every hit at the implicit rate - [PR #45567](https://github.com/BerriAI/litellm/pull/45567)
- Derive the OpenAI, Anthropic and native DashScope bases from one domain credential, and send `/v1/messages` to the native API for a DashScope root or `/apps/anthropic` base instead of returning 404 - [PR #47812](https://github.com/BerriAI/litellm/pull/47812)
- Add DashScope image edits on `/v1/images/edits` and text-to-speech on `/v1/audio/speech` with Qwen image and TTS pricing, and bill image edits on every provider at a deployment's own image price - [PR #48998](https://github.com/BerriAI/litellm/pull/48998)

### Databricks

- Call the workspace's native Messages route for Databricks Claude on `/v1/messages`, so `safeguard_results` reach auto mode and platforms that reject `safeguards` no longer answer 400 under `drop_params` - [PR #46091](https://github.com/BerriAI/litellm/pull/46091)
- Stream Databricks Claude `json_schema` answers as text instead of an internal `json_tool_call` tool call, with valid JSON and `stop` as the finish reason - [PR #47424](https://github.com/BerriAI/litellm/pull/47424)
- Reuse the Databricks OAuth M2M token exchange for decisions requests, so `/v1/decisions` with OAuth credentials and no static key no longer returns 401 - [PR #48527](https://github.com/BerriAI/litellm/pull/48527)
- Price `databricks/databricks-openjev-qwen35-4b` at 0.6 DBU per 1M input tokens, so `/v1/decisions` and `/v1/systemone` calls stop logging $0 spend - [PR #48694](https://github.com/BerriAI/litellm/pull/48694)
- Sync Databricks cost map rows with the pricing pages, adding 19 missing endpoints, long-context rates and `databricks-typesafeai-jev-1-14-0`, and fixing 21 stale prices - [PR #48884](https://github.com/BerriAI/litellm/pull/48884)
- Add priority pay-per-token prices to 31 Databricks cost map rows, so priority requests are no longer billed at the standard rate - [PR #48891](https://github.com/BerriAI/litellm/pull/48891)
- Add retirement dates for `databricks-deepseek-v4-flash-0731` (2026-11-05), `databricks-deepseek-v4-pro-0813` (2026-10-30) and `databricks-inkling` to the cost map - [PR #49124](https://github.com/BerriAI/litellm/pull/49124)

### DeepSeek

- Pass `reasoning_effort` through to DeepSeek instead of silently using the provider default, with explicit `thinking` settings still taking precedence - [PR #38736](https://github.com/BerriAI/litellm/pull/38736)
- Forward Anthropic headers to DeepSeek on `/v1/messages`, so uploaded-image requests no longer fail with a missing-header error - [PR #46959](https://github.com/BerriAI/litellm/pull/46959)
- Add DeepSeek as a `/v1/search` provider with `search_provider: deepseek`, reading `DEEPSEEK_API_KEY`, priced at 0.00075 USD per query, with a 400 for a composed query over DeepSeek's 128 character cap - [PR #47401](https://github.com/BerriAI/litellm/pull/47401)

### Fireworks AI

- Mark `fireworks_ai/minimax-m3` as a vision model again, so image requests stop returning 400 - [PR #43390](https://github.com/BerriAI/litellm/pull/43390)
- Add priority tier prices and the reasoning flag to `fireworks_ai/accounts/fireworks/models/muse-spark-open` - [PR #47785](https://github.com/BerriAI/litellm/pull/47785)
- Fill in `max_output_tokens`, reasoning, response schema and tool choice support and `deprecation_date` on the five Fireworks spot router rows from their base models - [PR #48858](https://github.com/BerriAI/litellm/pull/48858)
- Add `fireworks_ai/accounts/fireworks/models/ultramarine-1-flash-us` at 0.225 USD input and 0.75 USD output per 1M tokens with a 1048576 token context, and date the DeepSeek V4 Flash standard rows - [PR #49146](https://github.com/BerriAI/litellm/pull/49146)

### FriendliAI

- Drop `thinking_blocks`, `reasoning_items` and `provider_specific_fields` from messages sent to FriendliAI, so Claude Code turns after a tool call stop failing - [PR #45092](https://github.com/BerriAI/litellm/pull/45092)

### Gemini and Vertex AI

- Add Gemini 3.1 Flash TTS on Vertex AI and AI Studio with two-speaker voices, and send mp3, opus, alaw and mulaw speech from Vertex through Google Cloud Text-to-Speech - [PR #31915](https://github.com/BerriAI/litellm/pull/31915)
- Log the Gemini 3 sampling deprecation notice once per model per worker instead of at WARNING on every request - [PR #40868](https://github.com/BerriAI/litellm/pull/40868)
- Call Google once per Gemini TTS `/v1/audio/speech` request and log its tokens and cost, so spend logs no longer show 0 tokens and callbacks stop firing twice - [PR #44551](https://github.com/BerriAI/litellm/pull/44551)
- Send context cache list and create calls to the `cachedContents` collection under a custom `api_base`, so Gemini and Vertex AI caching works through a gateway - [PR #44783](https://github.com/BerriAI/litellm/pull/44783)
- Send integer enums to Gemini 3 and newer as INTEGER with string values instead of dropping them, so tool parameters stay within the listed values - [PR #44908](https://github.com/BerriAI/litellm/pull/44908)
- Reuse known Vertex AI and Gemini context caches until shortly before `expireTime`, instead of listing all `cachedContents` on every request or creating duplicates for concurrent requests - [PR #46857](https://github.com/BerriAI/litellm/pull/46857)
- Map Vertex errors to 403 only when the text has a standalone `403`, so a 429 whose request id contains `4039` stays a rate limit and retries keep working - [PR #47134](https://github.com/BerriAI/litellm/pull/47134)
- Add `LITELLM_GEMINI_DEFAULT_MAX_OUTPUT_TOKENS` to set the output budget for text requests with no limit, capped at the cost map's `max_output_tokens` - [PR #47542](https://github.com/BerriAI/litellm/pull/47542)
- Honor `supports_sampling_params` on Gemini and Vertex AI and flag Gemini 3.6 Flash, 3.5 Flash-Lite and later, so `temperature`, `top_p` and `top_k` answer 400 unless `drop_params` is set - [PR #47645](https://github.com/BerriAI/litellm/pull/47645)
- Add opt-in `thought_signature_in_tool_call_id: false` to keep Gemini tool call ids short and move the thought signature to `provider_specific_fields`, for clients that cap id length - [PR #47692](https://github.com/BerriAI/litellm/pull/47692)
- Add `deprecation_date` 2026-06-30 to the retired `vertex_ai/veo-2.0-generate-001` - [PR #47847](https://github.com/BerriAI/litellm/pull/47847)
- Add Batch rates to `vertex_ai/meta/llama-4-scout-17b-128e-instruct-maas` and `vertex_ai/meta/llama-4-maverick-17b-16e-instruct-maas`, so Vertex batch jobs no longer bill at on-demand rates - [PR #48085](https://github.com/BerriAI/litellm/pull/48085)
- Bill video input for `gemini-2.5-flash-native-audio-preview-12-2025` at the audio and video rate of $3 per 1M tokens instead of the text rate - [PR #48248](https://github.com/BerriAI/litellm/pull/48248)
- Send image tool results to Gemini 2.5 in the older supported format so they are no longer rejected, while keeping nested media for Gemini 3 and later - [PR #48428](https://github.com/BerriAI/litellm/pull/48428)
- Reuse Google credentials across Vertex AI rerank requests instead of reloading and refreshing them on every call - [PR #48430](https://github.com/BerriAI/litellm/pull/48430)
- Cap the shared Vertex AI credential cache at the existing LRU size limit instead of keeping every credential and project pair indefinitely - [PR #48442](https://github.com/BerriAI/litellm/pull/48442)
- Map requested image sizes to a supported aspect ratio on Vertex AI generation and editing, and send Gemini the matching resolution, instead of silently producing square images - [PR #48463](https://github.com/BerriAI/litellm/pull/48463)
- Keep Vertex AI Claude `/v1/messages` authentication off the event loop, so slow Google credential requests no longer stall health checks and neighboring requests - [PR #48523](https://github.com/BerriAI/litellm/pull/48523)
- Keep every web source Gemini attaches to a grounded passage as annotations, including when a non-web source comes first, instead of only the first one - [PR #48745](https://github.com/BerriAI/litellm/pull/48745)
- Send `labels` for Vertex AI Claude in the `X-Vertex-AI-Labels` header instead of the request body, so calls with `labels` no longer fail with a 400 - [PR #48753](https://github.com/BerriAI/litellm/pull/48753)
- Read one-object, `null` and null-item spellings of repeated fields in Google `countTokens` and `generateContent`, so bodies Vertex AI accepts no longer answer 400 - [PR #48771](https://github.com/BerriAI/litellm/pull/48771)
- Add Vertex AI Batch prices above 200k tokens for `gemini-2.5-pro` and `gemini-3.1-pro-preview`, and Batch image output token prices for the Gemini image models - [PR #48945](https://github.com/BerriAI/litellm/pull/48945)
- Flag `supports_computer_use` on `gemini/gemini-4-argon`, `gemini/gemini-3.8-flash`, `gemini/gemini-3.5-flash-lite` and `gemini/gemini-3-flash-preview`, the models the Gemini computer use docs list - [PR #49252](https://github.com/BerriAI/litellm/pull/49252)
- Add the Batch image output price (`output_cost_per_image_token_batches`) to `gemini/gemini-nano-banana-2.1` and `gemini/gemini-3.1-flash-lite-image`, so batch image generation is no longer billed at the Standard rate - [PR #49317](https://github.com/BerriAI/litellm/pull/49317)
- Add Batch, Flex and Priority text output prices to `gemini/gemini-2.5-flash-image`, so text and thinking output on those tiers is no longer billed at the Standard rate - [PR #49358](https://github.com/BerriAI/litellm/pull/49358)

### GitHub Copilot

- Treat a malformed `api-key.json` like a missing one, so a login saves a fresh key instead of every Copilot request failing with a parser error - [PR #44723](https://github.com/BerriAI/litellm/pull/44723)
- Add an optional `github_copilot_host` on per-user Copilot credentials, so GHE.com users can connect through device flow and token exchange - [PR #47610](https://github.com/BerriAI/litellm/pull/47610)
- Add the 2026-11-16 deprecation date to `github_copilot/claude-opus-4.8-fast` - [PR #48251](https://github.com/BerriAI/litellm/pull/48251)
- Add `github_copilot/gpt-6.1-terra` and raise `max_input_tokens` to 922000 on the Copilot gpt-6 rows - [PR #48450](https://github.com/BerriAI/litellm/pull/48450)

### Groq

- Remove response-only reasoning from outgoing history, so replaying a streamed Groq reasoning reply no longer returns HTTP 400 on the next turn - [PR #48268](https://github.com/BerriAI/litellm/pull/48268)

### Mistral

- Forward `prompt_cache_key` to `*.mistral.ai` hosts and send a `reasoning_effort` object as its level, instead of answering 400 and 500 - [PR #47432](https://github.com/BerriAI/litellm/pull/47432)
- Add `mistral/zai-glm-5-3-flash` to the cost map, so calls are billed instead of logged at $0 and `reasoning_effort` is no longer rejected with a 400 - [PR #48270](https://github.com/BerriAI/litellm/pull/48270)
- Replay an earlier assistant turn's reasoning to Mistral as a thinking chunk in `content` for models with reasoning support, and keep dropping it for the rest - [Commit 7abff3d](https://github.com/BerriAI/litellm/commit/7abff3dd63893f372818bcc91d5e1e48fae6afa5)
- Price Mistral Large 4 at its list price of $1.36 in, $0.14 cached in and $4.18 out per million tokens now that the launch sale ended - [PR #48825](https://github.com/BerriAI/litellm/pull/48825)
- Add the `mistral/deepseek-v4-1-flash-1017` cost map row so LiteLLM can price DeepSeek V4.1 Flash 1017 served by Mistral - [PR #48879](https://github.com/BerriAI/litellm/pull/48879)

### Morph

- Accept tools, structured output and reasoning controls on Morph open-weight chat models, and add eight Morph models with cached-input pricing - [PR #48676](https://github.com/BerriAI/litellm/pull/48676)

### NVIDIA Riva

- Add admin-only `riva_offline: true` for Riva deployments, which sends the whole buffer through `offline_recognize` so offline-only models like Parakeet TDT and Whisper stop failing with `INVALID_ARGUMENT` - [PR #41021](https://github.com/BerriAI/litellm/pull/41021)

### OCI

- Merge system messages at the start of OCI Gemini requests, so earlier system instructions are no longer dropped when an app adds a later summary or memory message - [PR #49458](https://github.com/BerriAI/litellm/pull/49458)

### Ollama

- Forward assistant `tool_calls[].id` in `ollama_chat` requests, so MiniMax on Ollama Cloud matches tool results to their calls instead of reporting the tool returned nothing - [PR #49278](https://github.com/BerriAI/litellm/pull/49278)
- Keep Ollama capability and pricing lookups local, so they stop contacting an unrelated server set in the environment - [PR #49727](https://github.com/BerriAI/litellm/pull/49727)

### OpenAI

- Honor per-deployment workload identity on every `openai/` route, including batches, assistants and realtime, so keyless federated deployments no longer demand a static key - [PR #39966](https://github.com/BerriAI/litellm/pull/39966)
- Route `gpt-*transcribe` models to the GPT audio transcription config, so `gpt-transcribe` works without `response_format` and bills OpenAI's `usage.seconds` - [PR #44021](https://github.com/BerriAI/litellm/pull/44021)
- Forward the provider's `service_tier` on non-streamed `aiohttp_openai` responses instead of dropping it - [PR #47263](https://github.com/BerriAI/litellm/pull/47263)
- Log a warning naming the model, level and fix when `drop_params` drops a GPT-5 reasoning effort the model map does not enable, on chat, `/v1/messages`, `/v1/responses` and Bedrock - [PR #47761](https://github.com/BerriAI/litellm/pull/47761)
- Map OpenAI `context_length_exceeded` errors to `ContextWindowExceededError` instead of `BadRequestError` - [PR #47954](https://github.com/BerriAI/litellm/pull/47954)
- Add the 12-hour cache write rate for `gpt-5.6-cyber` from the OpenAI pricing page - [PR #48246](https://github.com/BerriAI/litellm/pull/48246)
- Add `gpt-6.1-terra` to the cost map with prices from the OpenAI pricing page, including the 12-hour batch cache write rates - [PR #48429](https://github.com/BerriAI/litellm/pull/48429)
- Add OpenAI Batch and Ultrafast 12-hour cache write rates to the cost map from the OpenAI pricing page - [PR #48433](https://github.com/BerriAI/litellm/pull/48433)
- Drop the `input_cost_per_token_priority` price from `gpt-5-nano` and `gpt-5-nano-2025-08-07`, so `/model/info` no longer shows a priority input price 50x the standard one - [PR #48763](https://github.com/BerriAI/litellm/pull/48763)
- Add `gpt-6-rosalind` to the cost map with prices from the OpenAI pricing page - [PR #49268](https://github.com/BerriAI/litellm/pull/49268)
- Add `gpt-6-astra-law` to the cost map with prices from the OpenAI pricing page - [PR #49444](https://github.com/BerriAI/litellm/pull/49444)

### OpenCode

- Send `x-opencode-session` automatically to OpenCode Go on chat completions, Responses and native Messages when the caller supplies a stable conversation ID - [PR #48121](https://github.com/BerriAI/litellm/pull/48121)

### OpenRouter

- List OpenRouter's live chat catalog on `/v1/models` for `openrouter/*` when `check_provider_endpoint` is on, so `lite pi` no longer refuses to start on an empty list - [PR #48820](https://github.com/BerriAI/litellm/pull/48820)

### Perplexity

- Forward Perplexity search options like recency, date and language filters instead of dropping them, and return provider validation errors to the caller - [PR #49344](https://github.com/BerriAI/litellm/pull/49344)

### SageMaker

- Parse every streamed SageMaker record however the payload parts are cut, and raise container errors instead of ending a failed stream as a normal 200 stop - [PR #47495](https://github.com/BerriAI/litellm/pull/47495)
- Keep a deployment's pinned `model_id`, such as a SageMaker inference component, over the request body's and a router default, and let `configurable_clientside_auth_params` opt in to client choice - [PR #49045](https://github.com/BerriAI/litellm/pull/49045)

### Tencent

- Add Seedream 5.0 pro, flash and lite image generation and editing to the Tencent provider through TokenHub's own image endpoint, with spend from TokenHub's token counts - [PR #48735](https://github.com/BerriAI/litellm/pull/48735)

### Together AI

- Price Together AI Qwen3.7-Max at 1.50 USD input, 0.30 USD cached input and 4.50 USD output per 1M tokens, so it is no longer billed 67% above Together's published price - [PR #49125](https://github.com/BerriAI/litellm/pull/49125)
- List a Together AI id on `/v1/models` for a wildcard alias like `together_ai/*` only when it resolves to a real Together model, and read Together's model list from the cost map - [PR #49152](https://github.com/BerriAI/litellm/pull/49152)
- Add the 2026-11-04 `deprecation_date` to `together_ai/Qwen/Qwen3.8-2.4T-A95B`, from Together's scheduled deprecations table - [PR #49542](https://github.com/BerriAI/litellm/pull/49542)

### vLLM

- Send the pass-through key as `Authorization: Bearer` on both `/vllm` routes and stop a `/v1` base from calling `/v1/v1/...`, so servers started with `--api-key` stop answering 401 - [PR #46861](https://github.com/BerriAI/litellm/pull/46861)
- Accept images on `hosted_vllm` decision deployments and pass them to vLLM's `/v1/systemone` `images` field, instead of refusing them with a 400 - [PR #48621](https://github.com/BerriAI/litellm/pull/48621)
- Accept the vLLM production-stack router's file and batch objects on `hosted_vllm`, filling the missing `object` field and mapping `pending` and `running` to `validating` and `in_progress`, so uploads and batches no longer answer 500 - [PR #49068](https://github.com/BerriAI/litellm/pull/49068)

### xAI

- Add native xAI X Search to the Search API and WebSearch interception, returning citation URLs as search results and recording xAI's reported bill including tokens and tool usage - [PR #48677](https://github.com/BerriAI/litellm/pull/48677)

### Z.AI

- Accept `response_format` and `max_completion_tokens` on `zai/*` models and add `zai/glm-5v-turbo` pricing, cached input included - [PR #48335](https://github.com/BerriAI/litellm/pull/48335)

### Model catalog and pricing

- Read `s3://` URIs for `LITELLM_MODEL_COST_MAP_URL` at startup, on `POST /reload/model_cost_map` and on scheduled reloads, instead of failing with `UnsupportedProtocol` and pricing from the bundled map - [PR #46972](https://github.com/BerriAI/litellm/pull/46972)
- Add Mistral Voxtral 3, ElevenLabs speech and Together `MiniMaxAI/MiniMax-M3.1-Flash` rows, set ElevenLabs v3 and Multilingual v2 to 0.08 USD per 1K characters, and date `azure_ai/Phi-4*` retirement - [PR #47623](https://github.com/BerriAI/litellm/pull/47623)
- Add `wandb/reflection/Beam-1.0-501B-A23B` and `wandb/zai-org/GLM-5.3` to the cost map, priced from the CoreWeave Forge Serverless Inference page - [PR #47690](https://github.com/BerriAI/litellm/pull/47690)
- Add provider retirement dates, fix the Azure AI Claude Sonnet 5.5 cache read price, bill Azure web search at the Bing rate, and add Fireworks spot routers in a rolling cost map audit - [PR #48188](https://github.com/BerriAI/litellm/pull/48188)
- Drop the legacy `max_tokens` field from the cost map in favor of `max_input_tokens` and `max_output_tokens`, while `/model/info` still returns `max_tokens` - [PR #48471](https://github.com/BerriAI/litellm/pull/48471)
- Price four `abliteration/` chat models with cache read rates and capabilities, and keep `reasoning_effort` instead of dropping it - [PR #48498](https://github.com/BerriAI/litellm/pull/48498)
- Remove the `2027-06-28` `deprecation_date` from `gemini-3.1-flash-lite-image` and `vertex_ai/gemini-3.1-flash-lite-image`, since Google publishes only a floor date - [PR #48587](https://github.com/BerriAI/litellm/pull/48587)
- Generate `provider_endpoints_support.json` from the cost map, so `/public/endpoints` and models.litellm.ai/providers show an endpoint only when a usable model exists for it - [PR #48619](https://github.com/BerriAI/litellm/pull/48619)
- Add a `2026-11-06` `deprecation_date` to two `together_ai` models that Together lists for removal from serverless on that date - [PR #48651](https://github.com/BerriAI/litellm/pull/48651)
- Stop reading the legacy `extends` and mixed-rule cost map format in fallback rules, so unmapped Claude ids on an old-format custom map lose fallback routing and model info - [PR #48737](https://github.com/BerriAI/litellm/pull/48737)
- Lower the input, output and cache read prices of three Refuseless models, including `refuseless/glm-5.3-abliterated`, to the provider's new list prices - [PR #48844](https://github.com/BerriAI/litellm/pull/48844)
- Add Gemini long-prompt Batch rates and Azure GPT-6 Astra long-context Flex rates to the cost map, so those requests stop falling back to the wrong rate - [PR #49114](https://github.com/BerriAI/litellm/pull/49114)
- Set `max_input_tokens` for `wandb/zai-org/GLM-5.2` to 262000, the context CoreWeave lists, instead of 1049000 - [PR #49148](https://github.com/BerriAI/litellm/pull/49148)
- Add Deepgram text-to-speech prices for `deepgram/aura` at 0.015 USD and `deepgram/aura-2` at 0.030 USD per 1,000 characters - [PR #49280](https://github.com/BerriAI/litellm/pull/49280)
- Flag `supports_computer_use` on 15 Vertex AI and Gemini rows and add Cohere `rerank-v5.0-pro` and `rerank-v5.0-fast` rows so lookups stop failing for them - [PR #49297](https://github.com/BerriAI/litellm/pull/49297)
- Set `max_input_tokens` to 128K for the W&B DeepSeek V3.1 and Llama 3.1 8B rows, matching the CoreWeave Forge serverless inference page - [PR #49616](https://github.com/BerriAI/litellm/pull/49616)

## LLM API Endpoints

### Responses API

- Log and bill Responses-style bodies sent to `/cursor/chat/completions`, and stop sending the proxy's key hash, alias and caller IP to OpenAI in `metadata` - [PR #30277](https://github.com/BerriAI/litellm/pull/30277)
- Report the requested model in the nested `response.model` of streamed `/v1/responses` events instead of the backend deployment name - [PR #46662](https://github.com/BerriAI/litellm/pull/46662)
- Round-trip Anthropic compaction blocks as `compaction` output items on `/v1/responses`, streamed too, and send a replayed `compaction` item back to Claude so long sessions keep their summary - [PR #46754](https://github.com/BerriAI/litellm/pull/46754)
- Run `pre_call` guardrails on every Responses WebSocket turn and bill each turn its own guardrail cost, instead of checking the first frame once and re-billing its records on later turns - [PR #47013](https://github.com/BerriAI/litellm/pull/47013)
- Count `/v1/responses/input_tokens` the way inference sends the request, through the bridge for Claude and with the caller's body forwarded to OpenAI, so function tools no longer fail and OpenAI errors come back unchanged - [PR #47363](https://github.com/BerriAI/litellm/pull/47363)
- Honor `max_agentic_loops` as the round cap for streamed MCP auto-execute on `/v1/responses`, keeping 5 as the default and still ignoring any value sent in the request body - [PR #47688](https://github.com/BerriAI/litellm/pull/47688)
- Keep every earlier MCP tool call and result in the follow-up input of streamed `/v1/responses` calls, so multi-step tool chains stop repeating tools and hitting the round cap - [PR #47698](https://github.com/BerriAI/litellm/pull/47698)
- Replay `web_search_call` input items that have no `action` as sent on `/v1/responses`, so later turns in Codex and Azure conversations no longer fail with 500 - [PR #48417](https://github.com/BerriAI/litellm/pull/48417)
- Preserve audio, PDF and image content in tool results and assistant history across Responses and Gemini conversions instead of dropping it - [PR #48484](https://github.com/BerriAI/litellm/pull/48484)
- Skip failed spend-log turns when rebuilding a session from `previous_response_id`, so one failed retry no longer makes every later retry answer 400 on Bedrock - [PR #48647](https://github.com/BerriAI/litellm/pull/48647)
- Preserve typed text parts in Responses streaming when a provider omits `logprobs`, so reading `event.part.text` no longer raises `AttributeError` - [PR #48686](https://github.com/BerriAI/litellm/pull/48686)
- Forward the top-level `moderation` param on `/v1/responses` to OpenAI instead of dropping it, so moderation results or OpenAI's 400 reach the caller - [PR #48708](https://github.com/BerriAI/litellm/pull/48708)
- Run the guardrails and policies a Responses WebSocket frame selects on top of the key's and team's, and fix a 500 when a guardrail with settings meets another guardrail list - [PR #48725](https://github.com/BerriAI/litellm/pull/48725)
- Stream every citation batch before completion on `/v1/responses` with continuous annotation indices, so streaming clients no longer miss citations that appear in the final answer - [PR #48747](https://github.com/BerriAI/litellm/pull/48747)
- Drop a null `created_by` from Responses output and `input` items, so replaying a `/v1/responses/compact` result no longer gets OpenAI's 400 `Unknown parameter: 'input[1].created_by'` - [PR #48783](https://github.com/BerriAI/litellm/pull/48783)
- Pass `response.created`, `queued` and `in_progress` through on background OpenAI `/v1/responses` streams as soon as OpenAI sends them, so a client that stops reading early can still cancel or retrieve the run - [PR #48817](https://github.com/BerriAI/litellm/pull/48817)
- Forward `stream` and `starting_after` when retrieving a background response on OpenAI, Azure and Azure AI Foundry, so clients can resume a lost event stream and get the events they missed - [PR #48819](https://github.com/BerriAI/litellm/pull/48819)
- Send an empty `function_call_output` to Anthropic and Gemini as an empty tool result instead of serialized JSON the model read as the result - [PR #48845](https://github.com/BerriAI/litellm/pull/48845)
- Keep `metadata` and `user` out of `/v1/responses/compact` upstream requests for OpenAI, Azure and Azure AI, and send Azure compaction to the v1 route, so calls no longer get a 400 or 500 - [PR #48876](https://github.com/BerriAI/litellm/pull/48876)
- Advertise tool search for Claude routes in the Codex model list and translate Codex's client `tool_search` requests and results, so Codex discovers MCP tools instead of loading every schema up front - [PR #48972](https://github.com/BerriAI/litellm/pull/48972)
- Send each Codex tool once, using the newest copy, when its tool list repeats across turns, so a Codex session that switches to GPT on Bedrock no longer fails on the duplicate-tool error - [PR #49006](https://github.com/BerriAI/litellm/pull/49006)
- Keep the proxy's error body, code and type on `litellm.responses()` errors from `litellm_proxy/` models, and pass a downstream proxy's redacted `provider_specific_fields` through chained proxies on chat and Responses - [PR #49073](https://github.com/BerriAI/litellm/pull/49073)
- Merge a tool list that Codex repeats across turns only when `drop_params` is on, and otherwise send the request as sent, so deliberate duplicate tool definitions are no longer dropped - [PR #49112](https://github.com/BerriAI/litellm/pull/49112)

### Chat Completions over the Responses API bridge

- Route `chatgpt/` models missing from the catalog through the Responses bridge, so they no longer return 404 on Chat Completions - [PR #48244](https://github.com/BerriAI/litellm/pull/48244)
- Reject or drop Responses params the chat completions bridge cannot translate, such as `max_tool_calls`, so Bedrock Claude no longer answers 400 and `drop_params` works - [PR #48655](https://github.com/BerriAI/litellm/pull/48655)
- Send the whole `reasoning_effort` dict when chat completions are bridged to the Responses API, and drop only a refused effort under `drop_params` - [Commit 9675c13](https://github.com/BerriAI/litellm/commit/9675c13cb02b2e183deb04b0ae912ed85b20f1e2)
- Replay the original Responses items in order with their `phase` and boundaries on the next chat turn for the `openai` provider, instead of one merged message - [PR #48912](https://github.com/BerriAI/litellm/pull/48912)
- Forward text `verbosity` when bridging Responses requests to chat completions, stored tool-search follow-ups included, instead of silently dropping it - [PR #49049](https://github.com/BerriAI/litellm/pull/49049)
- Send a dict `reasoning_effort` with its `mode` and `context` the same way on the Azure, ChatGPT, Azure AI and GitHub Copilot Responses bridges, so pro reasoning on Azure no longer runs and bills as standard - [PR #49082](https://github.com/BerriAI/litellm/pull/49082)

### Anthropic Messages API

- Stream native `server_tool_use` and `web_search_tool_result` blocks for web search interception, so Claude Code counts its searches, and keep `caller`, redacted thinking `data` and citations on re-streamed replies - [PR #40967](https://github.com/BerriAI/litellm/pull/40967)
- Strip Claude Code's `Perform a web search for the query:` prefix before the short-circuit web search, so search providers get the user's actual query - [PR #43458](https://github.com/BerriAI/litellm/pull/43458)
- Carry `safeguard_results` and `stop_details` in synthesized `message_delta` events, so Claude Code in auto mode keeps its server verdict when a post-call guardrail rewrites a streamed `/v1/messages` reply - [PR #46096](https://github.com/BerriAI/litellm/pull/46096)
- Honor `clear_at_least`, `exclude_tools` and `clear_tool_inputs` in the `clear_tool_uses_20250919` polyfill on `/v1/messages` to non-Anthropic models, and answer 400 for a malformed field like the Anthropic API - [PR #47123](https://github.com/BerriAI/litellm/pull/47123)
- Send `/v1/messages` PDF documents to OpenAI-shaped providers as chat `file` parts, so Azure OpenAI no longer answers 400, and handle them on `azure_ai/`, Vertex partner models, OCI, GigaChat, SAP and OpenRouter - [PR #47166](https://github.com/BerriAI/litellm/pull/47166)
- Answer 400 naming the bad field for a null or numeric `tool_result` text on `/v1/messages` and count_tokens, instead of a 500 on OpenAI models, and drop that block under `drop_params` - [PR #47347](https://github.com/BerriAI/litellm/pull/47347)
- Keep tool names over 64 characters when a guardrail rewrites a `/v1/messages` request, so Bedrock no longer answers 400 `Tool reference '<name>' not found in available tools` - [PR #47434](https://github.com/BerriAI/litellm/pull/47434)
- Count the system prompt toward the `clear_tool_uses_20250919` `input_tokens` trigger on `/v1/messages` routes where LiteLLM fills in context management, as Anthropic's API does, and stop a 500 when it is listed before `compact_20260112` - [PR #47857](https://github.com/BerriAI/litellm/pull/47857)
- Run `clear_tool_uses_20250919` edits in the gateway for OpenAI models on `/v1/messages` and count tokens, so old tool results are cleared instead of silently dropped - [PR #47861](https://github.com/BerriAI/litellm/pull/47861)
- Include a null `stop_sequence` in native Anthropic Messages responses, streaming included - [Commit e5cedbb](https://github.com/BerriAI/litellm/commit/e5cedbb861e6023e992a927de8b838b32156e918)
- Close the upstream request when a `/v1/messages` stream is canceled before the first token, instead of leaving it open - [PR #48220](https://github.com/BerriAI/litellm/pull/48220)
- Add the missing model listing route under `/claude_code_gateway`, so Claude clients using it as their base URL no longer get a 404 on model discovery - [PR #48221](https://github.com/BerriAI/litellm/pull/48221)
- Honor `stop_sequences` sent to `/v1/messages` for OpenAI chat models by routing requests with a nonempty stop list through Chat Completions, which forwards `stop` - [PR #48534](https://github.com/BerriAI/litellm/pull/48534)
- Merge a Claude deployment's `anthropic-beta` with the client's on `/v1/messages` instead of replacing it, so admin-enabled betas such as 1M context reach Claude Code users - [PR #48594](https://github.com/BerriAI/litellm/pull/48594)
- Estimate the prompt size in the first `message_start` of `/v1/messages` streams served through a Chat Completions backend such as `hosted_vllm`, instead of always sending 0 - [PR #48618](https://github.com/BerriAI/litellm/pull/48618)
- Make the opening prompt usage estimate on `/v1/messages` streams through a Chat Completions backend opt-in, so the default stays 0 until the provider's real usage arrives - [PR #48633](https://github.com/BerriAI/litellm/pull/48633)
- Send the caller's `anthropic-version` in the Vertex AI Claude `/v1/messages` body instead of the header, so the anthropic Python SDK 2.x no longer gets a 400 - [PR #48814](https://github.com/BerriAI/litellm/pull/48814)
- Drop the non-spec `custom` object from `/v1/messages` and `count_tokens` tool definitions under `drop_params`, and move a boolean `custom.defer_loading` to the top-level `defer_loading` flag for Claude - [PR #48893](https://github.com/BerriAI/litellm/pull/48893)
- Stream a guardrail block on `/v1/messages` as the normal Anthropic event sequence, so the Anthropic SDK shows the guardrail's message instead of crashing, and add `x-litellm-call-id` to blocked responses - [PR #49010](https://github.com/BerriAI/litellm/pull/49010)
- Stream each signed Mistral thinking chunk on `/v1/messages` as a `thinking_delta` and send the signature once when the block ends, so Claude Code shows the full thought instead of only its first word - [PR #49059](https://github.com/BerriAI/litellm/pull/49059)
- Retry `/v1/messages` once without `strict` under `drop_params` when Claude rejects strict tool limits on Bedrock invoke, Bedrock mantle and Anthropic, with a warning, instead of answering 400 - [PR #49102](https://github.com/BerriAI/litellm/pull/49102)
- Return the upstream 200 on `/v1/messages` for a plain Anthropic deployment when the body has null or missing `content`, instead of a 500 - [PR #49356](https://github.com/BerriAI/litellm/pull/49356)

### Count tokens

- Count tokens for Anthropic histories that carry a compaction block and forward `context_management` edits, so `/v1/messages/count_tokens` no longer answers 400 - [PR #44784](https://github.com/BerriAI/litellm/pull/44784)
- Count tools for DeepSeek V4 and Qwen3.5 on `/v1/messages/count_tokens` the way their chat templates render them, instead of counting 6 to 80 percent below the billed input tokens - [PR #47173](https://github.com/BerriAI/litellm/pull/47173)
- Count DeepSeek V3 and V4 text with DeepSeek's own tokenizer, so `/v1/messages/count_tokens` lands within 2.5 percent of the billed tokens instead of missing by 3 to 98 percent - [PR #47353](https://github.com/BerriAI/litellm/pull/47353)
- Count PDF pages for OpenAI and Azure models the way they bill, so `count_tokens` no longer overcounts PDFs about 12x and Azure-only chat models use `o200k_base` - [PR #47554](https://github.com/BerriAI/litellm/pull/47554)
- Log one INFO line per token count call with `litellm_call_id`, `request_model`, `input_tokens` and `status_code`, on success and on failure - [PR #47657](https://github.com/BerriAI/litellm/pull/47657)
- Count readable inline `auto` images in `token_counter` with the high-detail tile calculation, including images under 768 pixels, without making HTTP requests - [PR #48526](https://github.com/BerriAI/litellm/pull/48526)
- Count Anthropic search results, including those inside tool results, on locally counted models, and return a 400 instead of a 500 for unsupported content blocks - [PR #48699](https://github.com/BerriAI/litellm/pull/48699)
- Count OpenAI models newer than tiktoken's table with `o200k_base`, and strip `openai/` and `azure/` prefixes before picking the encoding - [Commit 5eb1042](https://github.com/BerriAI/litellm/commit/5eb1042bbf57f19d0d698b5c7b67b133000fbf5f)
- Count tokens with a Claude subscription caller's forwarded token when the deployment has no configured key, instead of answering 401 - [Commit e2d78b6](https://github.com/BerriAI/litellm/commit/e2d78b69cd8b8e51569c9334eda6dd2aa491b002)
- Answer 400 before counting a Claude request whose only tool is an OpenAI Responses built-in such as `mcp`, and translate `tool_search` and `namespace` tools in `/utils/token_counter` - [PR #48798](https://github.com/BerriAI/litellm/pull/48798)
- Keep the framed local estimate when a Bedrock count model from the cost map answers 400, 404, 401 or 403, while an admin-set `token_count_model` keeps its error - [Commit ff5bf48](https://github.com/BerriAI/litellm/commit/ff5bf4826dab9ee145de96966488cbd195a1063a)
- Keep a loaded Hugging Face tokenizer when a later download fails and retry in the background every 60 seconds, set by `HUGGINGFACE_TOKENIZER_LOAD_RETRY_SECONDS`, so token counts answer at once - [PR #48916](https://github.com/BerriAI/litellm/pull/48916)

### Prompt caching

- Strip `cache_control` from a copy for OpenAI-compatible providers instead of editing the caller's request, so a Claude fallback keeps its caching hints, trimmed to the newest 4 under `drop_params` - [PR #35602](https://github.com/BerriAI/litellm/pull/35602)
- Pick the chat prompt cache format from the deployment's provider prefix, so an `azure_ai/` deployment no longer loses `prompt_cache_options` because of `AZURE_AI_API_BASE` - [PR #45295](https://github.com/BerriAI/litellm/pull/45295)
- Drop a malformed `prompt_cache_breakpoint` under `drop_params` on `/v1/responses`, `/v1/messages` and `/v1/responses/compact`, so OpenAI no longer answers 400 - [PR #45330](https://github.com/BerriAI/litellm/pull/45330)
- Key prompt caching affinity on tools and the `/v1/messages` system prompt, so cache breakpoints on a tool or a list system prompt write a pin that the lookup finds - [PR #46411](https://github.com/BerriAI/litellm/pull/46411)
- Send `prompt_cache_retention` to OpenAI instead of silently dropping it, so 24 hour prompt caching applies - [PR #47480](https://github.com/BerriAI/litellm/pull/47480)
- Skip non-dict `tools` entries in the `prompt_caching` affinity key, so the provider's 400 comes back instead of a proxy 500 or a Python error message - [PR #47565](https://github.com/BerriAI/litellm/pull/47565)
- Stop counting the cache mark on a dropped unanswered server tool call, so the system prompt keeps its `cache_control` breakpoint when a slot is free - [PR #49468](https://github.com/BerriAI/litellm/pull/49468)

### Realtime

- Send the Gemini and Vertex Live setup with the first content, built from every earlier `session.update`, so instructions and tools reach the model on `/v1/realtime` - [PR #39864](https://github.com/BerriAI/litellm/pull/39864)
- Read the first event in the OpenAI realtime health check, so a deployment with a wrong or missing API key reports unhealthy instead of healthy - [PR #41233](https://github.com/BerriAI/litellm/pull/41233)
- Add Soniox live speech-to-text on `/v1/realtime` with OpenAI transcription events, tracked against keys, budgets and spend - [PR #44822](https://github.com/BerriAI/litellm/pull/44822)
- Keep `turn_detection.type` when a transcript guardrail disables auto-response, so OpenAI GA no longer rejects the session or answers before the guardrail runs - [PR #44939](https://github.com/BerriAI/litellm/pull/44939)
- Route Azure WebRTC `/v1/realtime/client_secrets` and calls to the GA `/openai/v1/realtime` API without `api-version`, so token mint stops answering 404 and the SDP exchange stops failing with "Invalid or expired token" - [PR #47316](https://github.com/BerriAI/litellm/pull/47316)

### Batches and files

- Let proxy admin keys read raw `gs://` and `s3://` file ids on `GET /files/{id}/content` again, and answer 403 for other keys, so the unmanaged Vertex batch flow works - [PR #40621](https://github.com/BerriAI/litellm/pull/40621)
- Run Claude on Vertex AI through the managed batch route as Anthropic Messages rows and return priced OpenAI batch rows, instead of a 404 at batch create - [PR #45715](https://github.com/BerriAI/litellm/pull/45715)
- Send the routed deployment's own file ids when creating a fine-tuning job from files uploaded with `target_model_names`, instead of the gateway's file id that OpenAI rejects with a 400 - [PR #46552](https://github.com/BerriAI/litellm/pull/46552)
- Send Bedrock batch create, retrieve and cancel to the deployment setting `aws_bedrock_control_plane_endpoint` when set, so private endpoint and locked-down VPC setups can run batches - [PR #47260](https://github.com/BerriAI/litellm/pull/47260)
- Route batch creates to `mode: batch` deployments in a mixed Azure model group, so they stop answering 400 `invalid_deployment_type`, and list `supported_endpoints` on `/model_group/info` - [PR #47376](https://github.com/BerriAI/litellm/pull/47376)
- Scope provider and model file lists to the caller's own and team managed files for non-admins under `require_managed_files`, and support `limit`, `after`, `after_id` and `before_id` paging - [PR #47682](https://github.com/BerriAI/litellm/pull/47682)
- Return real prompt and completion token counts next to OpenAI's batch usage fields on batch create, retrieve and stored rows, so responses-endpoint batches no longer show zero tokens - [PR #47740](https://github.com/BerriAI/litellm/pull/47740)
- Free the input files of batches that never bill after 7 days, split each poll between old and new batches, and stop polling unfinished batches after 14 days, so file deletes and new-batch polling no longer stall - [PR #48752](https://github.com/BerriAI/litellm/pull/48752)

### Vector Stores

- Use an HTTP/2 client and a cached OAuth token for Vertex AI Search vector store searches, so a burst of searches shares one Google connection per worker - [PR #40631](https://github.com/BerriAI/litellm/pull/40631)
- Use the team's own OpenAI deployment on `/rag/ingest` and `/rag/query`, let viewers and team JWTs use /rag routes, and return the real status for a failed ingest instead of 200 - [PR #45497](https://github.com/BerriAI/litellm/pull/45497)
- Route team key vector store search to a team model of the store's provider, instead of the team's first model and a `Vector store search is not supported` error - [PR #46894](https://github.com/BerriAI/litellm/pull/46894)
- Add Amazon OpenSearch k-NN indexes as a vector store provider, registered from config or the Admin UI, so search and `file_search` answer from them with SigV4-signed queries instead of a 500 - [PR #47759](https://github.com/BerriAI/litellm/pull/47759)
- Put the Azure vector store id before the `api-version` query on retrieve, update and delete, so these calls no longer return 404 - [PR #48224](https://github.com/BerriAI/litellm/pull/48224)
- Enforce team and key Allowed Vector Stores on Responses, chat, messages, pass-through and direct store routes when no vector store registry is loaded, answering 401 for other stores - [PR #48915](https://github.com/BerriAI/litellm/pull/48915)

### Pass-through endpoints

- Apply `bedrock_request_metadata_fields` on the `/bedrock` pass-through routes, so AWS SDK traffic logs the key, team and org and ignores `user_api_key_*` values sent in the request body - [PR #47040](https://github.com/BerriAI/litellm/pull/47040)
- Add `general_settings.vertex_ai_pass_through_drop_anthropic_betas` to remove chosen `anthropic-beta` values on `/vertex_ai/*` and `/vertex-ai/*`, so Vertex Claude calls stop answering 400 for a beta it rejects - [PR #47185](https://github.com/BerriAI/litellm/pull/47185)
- Apply a Bedrock model's `guardrailConfig` on `/bedrock` pass-through converse and invoke routes, so callers can no longer skip or swap the admin's guardrail - [PR #47429](https://github.com/BerriAI/litellm/pull/47429)
- Let pass-through upstreams name a request's model with the `x-litellm-upstream-model` response header, so spend without a body `model` no longer lands under `unknown` - [PR #48275](https://github.com/BerriAI/litellm/pull/48275)
- Forward the client's `OpenAI-Beta` header on agents, vaults and ChatKit paths of `/openai` and `/openai_passthrough`, defaulting to `agents=v1` on the first two, so the Agents API no longer fails with 400 `invalid_beta` - [PR #49009](https://github.com/BerriAI/litellm/pull/49009)
- Log the URL's model and the declared provider on failed Gemini and Vertex pass-through calls, so spend logs and metrics no longer show an empty model or a missing provider - [PR #49075](https://github.com/BerriAI/litellm/pull/49075)
- Use `sessionId`, `threadId` or `conversationId` from Bedrock request metadata as the session id on Bedrock pass-through routes, so tagged turns share one session instead of each getting its own - [PR #49193](https://github.com/BerriAI/litellm/pull/49193)
- Add `/deepgram/v1/speak` and `/deepgram/speak` WebSocket routes for Deepgram streaming text to speech, billed per character at the voice generation's rate, and refuse a voice with no cost map price - [PR #49282](https://github.com/BerriAI/litellm/pull/49282)
- Forward a valid `metadata.user_id` (up to 255 characters) to Anthropic Messages on `/anthropic/v1/messages` and custom pass-through routes, so Claude Code's session and device ids reach Anthropic - [PR #49333](https://github.com/BerriAI/litellm/pull/49333)
- Log token counts and cost for OpenAI Decisions calls on the `/openai` pass-through route, so key and team budgets move instead of recording $0 - [PR #49392](https://github.com/BerriAI/litellm/pull/49392)
- Read `api_key` and `api_base` for `/watsonx/{endpoint}` from a watsonx deployment with `use_in_pass_through: true`, instead of only `WATSONX_API_KEY` and `WATSONX_API_BASE` - [PR #49462](https://github.com/BerriAI/litellm/pull/49462)
- Fit the Deepgram `/listen` unpriced model refusal in the WebSocket close frame, so callers get the reason instead of a 1006 close with no reason - [PR #49502](https://github.com/BerriAI/litellm/pull/49502)

### Agents and Agent-to-Agent

- Reach Microsoft Foundry agents by name through the project Responses API with `agent_reference` on `azure_ai/agents/<name>`, for chat completions, Messages and A2A, while classic `asst_...` ids keep the old route - [PR #47717](https://github.com/BerriAI/litellm/pull/47717)
- Accept Google's current Managed Agents fields `id`, `system_instruction` and `agent_config` on create and interactions, and keep `name` and `instructions` as aliases - [PR #48750](https://github.com/BerriAI/litellm/pull/48750)
- Bill completion-bridge agents such as LangGraph and Databricks at their own prices under `a2a_agent/<agent name>` on `/a2a` send and stream, instead of $0 on sends and no row on streams - [PR #49150](https://github.com/BerriAI/litellm/pull/49150)
- Serve `POST /a2a/{agent_id}/message/stream` and its `/v1` alias instead of returning 404, with guardrails scanning the streamed chunks - [PR #49471](https://github.com/BerriAI/litellm/pull/49471)
- Send an A2A agent's `litellm_params.api_key` as `Authorization: Bearer <key>` on every hop, instead of silently calling the agent unauthenticated - [PR #49474](https://github.com/BerriAI/litellm/pull/49474)
- Answer proxy refusals on `/a2a/{agent}` POST routes as JSON-RPC errors with `error.code` `-32000`, so strict A2A clients can read the reason, with HTTP status codes unchanged - [PR #49476](https://github.com/BerriAI/litellm/pull/49476)
- Show non-admin callers the proxy URL instead of the stored backend URL in agent cards from `GET /v1/agents` and `GET /v1/agents/{agent_id}` - [PR #49483](https://github.com/BerriAI/litellm/pull/49483)
- Treat an empty `agent_search_embedding_model` or `skill_search_embedding_model` as not configured, so search returns the 400 "not configured" error instead of a confusing 503 - [PR #49485](https://github.com/BerriAI/litellm/pull/49485)

### Images, audio and video

- Keep the model in proxy video ids, so status, content, remix, edit and extension calls resolve per-model keys and reach the deployment that created the video - [PR #44614](https://github.com/BerriAI/litellm/pull/44614)
- Add Doubao-Seedance video generation for `volcengine/` models on `/v1/videos` with per-resolution pricing, instead of answering that video is not supported - [PR #46156](https://github.com/BerriAI/litellm/pull/46156)
- Read the Polly engine from the bare model name, so `aws_polly/standard`, `aws_polly/long-form` and `aws_polly/generative` stop going out as `neural` - [PR #47963](https://github.com/BerriAI/litellm/pull/47963)
- Return 400 with the provider and model name instead of 500 when a provider cannot transcribe audio, while the router still tries another deployment or fallback - [PR #47971](https://github.com/BerriAI/litellm/pull/47971)
- Map ElevenLabs text-to-speech `response_format` values `wav` and `pcm` to the 24kHz `wav_24000` and `pcm_24000` formats, so they work on every account tier instead of returning 403 - [PR #48455](https://github.com/BerriAI/litellm/pull/48455)
- Remove the dall-e-2 and dall-e-3 code paths, so `litellm.image_generation(prompt=...)` with no model raises a 400 locally instead of calling OpenAI with dall-e-2 - [PR #48703](https://github.com/BerriAI/litellm/pull/48703)
- Honor an explicit `max_retries` for image generation on OpenAI-compatible providers and leave retries to the Router on the proxy, so one request stops multiplying upstream generations - [PR #48705](https://github.com/BerriAI/litellm/pull/48705)
- Return HTTP 400 `No image provided` for async BFL image edits without an image instead of HTTP 500 - [PR #48872](https://github.com/BerriAI/litellm/pull/48872)
- Apply key and team `router_settings` (fallbacks, retries, timeouts, `model_group_alias`) on `/v1/images/generations`, so a failing primary image model uses the key's configured fallback - [PR #49286](https://github.com/BerriAI/litellm/pull/49286)

### Embeddings and rerank

- Add optional `model_info.max_embedding_batch_size` to cap the inputs per `/v1/embeddings` request, routing to a deployment that admits the batch and answering 400 when none does - [PR #44574](https://github.com/BerriAI/litellm/pull/44574)
- Forward the requested timeout for Gemini and Vertex AI embed-content embeddings in sync and async calls, instead of always using the 300-second default - [PR #48690](https://github.com/BerriAI/litellm/pull/48690)
- Stop forcing `truncate=false` on Hugging Face TEI rerank and pass `truncate` through, so servers started with `--auto-truncate` stop failing long documents with a 413 - [PR #48706](https://github.com/BerriAI/litellm/pull/48706)
- Forward configured credentials, custom headers and the requested timeout on Ollama embeddings, so protected Ollama servers stop returning 401 - [PR #48707](https://github.com/BerriAI/litellm/pull/48707)

### SDK

- Treat `initial_prompt_value` and `final_prompt_value` as optional in prompt templates, so a template that omits them no longer fails every request with a 500 - [PR #39762](https://github.com/BerriAI/litellm/pull/39762)
- Add a pi harness to `litellm.agent()` through `Harness.PI` and `PiOptions`, so pi routes its model calls through the AI Gateway - [PR #45467](https://github.com/BerriAI/litellm/pull/45467)
- Decide MCP gateway routing without importing the proxy handler, so `responses()`, `completion()`, Anthropic `messages` with a tool and `chatgpt/` models stop failing with `No module named 'mcp'` on a base SDK install - [PR #45961](https://github.com/BerriAI/litellm/pull/45961)
- Fix the misspelling of decommissioned in the Palm decommission error message - [PR #46171](https://github.com/BerriAI/litellm/pull/46171)
- Set `PWD` to the working directory of local sandbox commands, so OpenCode through `litellm.agent()` works in the sandbox folder and resumes a session in another folder - [PR #47530](https://github.com/BerriAI/litellm/pull/47530)
- Honor `mock_response=""` in sync, async and streaming completion calls instead of sending a request to the provider - [PR #48266](https://github.com/BerriAI/litellm/pull/48266)
- Keep the upstream status, headers and body on `e.response` for OpenAI and Azure errors, so `e.response.text` and `e.response.json()` work on `openai/`, `azure/`, `azure_text/` and `litellm_proxy/` models - [PR #49079](https://github.com/BerriAI/litellm/pull/49079)
- Add `litellm.guardrails.apply` to invoke a configured gateway guardrail from the SDK and get its native findings, without generating a completion - [PR #49469](https://github.com/BerriAI/litellm/pull/49469)

### General

- Raise `AuthenticationError` for 401 and `NotFoundError` for 404 when an OpenAI-compatible provider answers with an `invalid_request_error` body, instead of `BadRequestError` - [PR #32537](https://github.com/BerriAI/litellm/pull/32537)
- Convert upstream `logprobs` to LiteLLM's own type, so streams with `logprobs` through OpenAI-compatible providers end with their finish chunk instead of a 500 error frame - [PR #33549](https://github.com/BerriAI/litellm/pull/33549)
- Keep the provider prefix on web search follow-up requests, so Bedrock Mantle and OpenRouter org models no longer fail with `LLM Provider NOT provided` or reach the wrong provider - [PR #38885](https://github.com/BerriAI/litellm/pull/38885)
- Keep `finish_reason` and provider usage when rebuilding streamed text completions, so `prompt_tokens` no longer reads 0 and a usage trailer with empty `choices` no longer raises `IndexError` - [PR #44349](https://github.com/BerriAI/litellm/pull/44349)
- Apply each deployment's `reasoning_effort_levels` on every provider and route, rounding efforts and thinking budgets onto declared levels and letting `azure_ai` accept a declared `reasoning_effort` - [PR #46601](https://github.com/BerriAI/litellm/pull/46601)
- Return upstream response headers on non-streaming chat for `bedrock_mantle/` and other OpenAI-like providers, including `llm_provider-x-amzn-requestid`, the way streaming already does - [PR #46928](https://github.com/BerriAI/litellm/pull/46928)
- Record a missing or null choice index as choice zero in streamed chat output, so progress chunks from llama-swap style backends no longer end the stream with a proxy error - [PR #46947](https://github.com/BerriAI/litellm/pull/46947)
- End a chat completions stream with an error event and `data: [DONE]` when a guardrail blocks mid-stream, and end a `/v1/responses` stream with `response.failed`, instead of cutting the connection - [PR #46953](https://github.com/BerriAI/litellm/pull/46953)
- Send the streamed `include_usage` chunk with `choices: []` like OpenAI when the caller set `include_usage`, so strict clients such as LangChain.js stop counting usage twice - [PR #47109](https://github.com/BerriAI/litellm/pull/47109)
- Map httpx stream read timeouts to `litellm.Timeout` (408) on chat, messages and responses, and fail a stalled `/v1/responses` stream with code `request_timeout` instead of an empty `server_error` - [PR #47198](https://github.com/BerriAI/litellm/pull/47198)
- Decode `zstd` and `gzip` request bodies before auth reads them, so compressed requests no longer fail with 400 `Invalid JSON`, with 413 past the size limit and 503 under load - [PR #47418](https://github.com/BerriAI/litellm/pull/47418)
- Return `highlights`, `highlight_scores` and `score` on Exa search results and Exa's response envelope as `provider_metadata`, so `costDollars` and `requestId` reach callers - [PR #47423](https://github.com/BerriAI/litellm/pull/47423)
- Add `/v1/extraction` and `litellm.extraction` with Cloudflare Clairic support, which takes typed `fields` and bills input tokens only at 0.10 USD per 1M - [PR #47473](https://github.com/BerriAI/litellm/pull/47473)
- Join `api_base` and the route with one slash, so an `api_base` ending in `/` no longer sends `//` and gets 404 from Envoy and Mistral - [PR #47535](https://github.com/BerriAI/litellm/pull/47535)
- Fail a stream that ends without a finish reason instead of reporting a normal completion, and log it as a failure instead of a success - [PR #47665](https://github.com/BerriAI/litellm/pull/47665)
- Carry `litellm_received_at` to a planted `litellm_metadata` bucket, so `x-litellm-overhead-duration-ms` on chat requests with a guardrail counts auth and pre-call work - [PR #47790](https://github.com/BerriAI/litellm/pull/47790)
- Match the SSE `[DONE]` marker exactly, so a streamed tool call with `[DONE]` in its arguments is no longer dropped and clients get `tool_calls` instead of a plain stop - [PR #47832](https://github.com/BerriAI/litellm/pull/47832)
- Omit usage from streamed text completions unless the caller requests it - [Commit e14d2fd](https://github.com/BerriAI/litellm/commit/e14d2fdc38f7272b5b50c67c0bdefa2830aff268)
- Name the timeout phase and the exact limit that fired in provider timeout errors instead of reporting `after None seconds` and always blaming the connection - [PR #48250](https://github.com/BerriAI/litellm/pull/48250)
- Raise a 500 when a streamed chat completion reports an `abort` finish reason instead of ending as a clean stop, so existing retry and fallback handling runs - [PR #48328](https://github.com/BerriAI/litellm/pull/48328)
- Return a clear 400 for non-object JSON bodies on object-only API routes instead of crashing request parsing or auth error handling - [PR #48438](https://github.com/BerriAI/litellm/pull/48438)
- Return Tavily's `raw_content`, `score`, `favicon`, `answer`, `images` and `request_id` from `/v1/search` instead of only each result's title, url and excerpt - [PR #48684](https://github.com/BerriAI/litellm/pull/48684)
- Split streamed SSE lines only on CR and LF and keep merged `<think>` tags balanced, so text containing U+2028 no longer cuts a Gemini or Vertex AI stream short with no more content or usage - [Commit d06b889](https://github.com/BerriAI/litellm/commit/d06b889d413237881e3dc27486e4345dd7aa18f9)
- Raise `ContextWindowExceededError` for SGLang's total token overflow 400, so `context_window_fallbacks` fire for SGLang deployments - [PR #48837](https://github.com/BerriAI/litellm/pull/48837)
- Move later developer messages into the leading system message for models with `supports_mid_conversation_system: false`, so Qwen3.5 and Qwen3.8 no longer answer 400 `System message must be at the beginning` - [PR #48897](https://github.com/BerriAI/litellm/pull/48897)
- Support `outputContentFormat=markdown` on `/ocr` for Azure Document Intelligence and fill `pages[].markdown` with each page's slice, instead of always returning plain text - [PR #48926](https://github.com/BerriAI/litellm/pull/48926)
- Log one WARNING with the param, value, model and reason when `drop_params` drops a requested reasoning level, and make fal honor the global `drop_params` instead of answering 400 - [PR #48933](https://github.com/BerriAI/litellm/pull/48933)
- Rebuild each choice of an `n` greater than 1 chat stream from its own chunks, so `tool_permission` checks each choice and spend logs keep every choice instead of only the first - [PR #49002](https://github.com/BerriAI/litellm/pull/49002)
- Honor a Decisions deployment's own `supports_audio_input` and `supports_video_input` flags over the cost map, so unlisted models stop answering 400 on every clip and load-balanced groups skip deployments that would refuse a clip - [PR #49207](https://github.com/BerriAI/litellm/pull/49207)
- End OpenAI-compatible tool call streams with `finish_reason` `tool_calls` when the upstream reports `stop`, matching non-streaming responses so clients run the tools - [PR #49388](https://github.com/BerriAI/litellm/pull/49388)
- Stop `POST /v1/moderations` with a list `input` from returning a 500 `'str' object has no attribute 'get'` - [PR #49454](https://github.com/BerriAI/litellm/pull/49454)
- Report the model that answered instead of `auto` in OpenRouter routed streams, including final usage chunks and cached replays - [PR #49498](https://github.com/BerriAI/litellm/pull/49498)

## Management Endpoints / UI

### Admin UI

#### Guardrails and policies

- Add a Delete button to the guardrail detail page that shares the table row's delete flow, now with a typed-name confirmation and a warning about what still uses the guardrail - [PR #45893](https://github.com/BerriAI/litellm/pull/45893)
- Keep the Guardrail Garden wizard's Next, Previous and Cancel buttons inside the dialog when topics are selected, so guardrail creation can finish - [PR #48688](https://github.com/BerriAI/litellm/pull/48688)

#### Home and LiteAdmin

- Unify the gateway and usage assistants as Aria Agent, opened in a floating popup with suggested questions and reachable from the Usage page - [Commit f0f1540](https://github.com/BerriAI/litellm/commit/f0f15404d5d29334d658a65d7dbb1d29183291bf)
- Add usage charts and PDF export of answers to Aria - [Commit e476697](https://github.com/BerriAI/litellm/commit/e4766973a0466e2cdb99ad243aac0081d2bce83b)
- Show No available models inside the Aria model picker instead of a separate banner above the composer - [PR #48223](https://github.com/BerriAI/litellm/pull/48223)
- Move the Aria launcher from a floating bottom-right button to the dashboard header beside Docs, so it no longer covers Logs pagination - [PR #48454](https://github.com/BerriAI/litellm/pull/48454)
- Bundle the Aria Agent avatar with the Admin UI, so it no longer shows a broken image where the UI is not served from the proxy's `/ui` mount - [PR #48890](https://github.com/BerriAI/litellm/pull/48890)

#### Logs

- Show a failed state with Retry on the Logs table, Usage totals and Caching chart when their fetch errors, instead of an empty page - [PR #47671](https://github.com/BerriAI/litellm/pull/47671)
- Make the copy icons in virtual key and log details work when the browser Clipboard API is unavailable, and show a success or error toast instead of failing silently - [PR #48425](https://github.com/BerriAI/litellm/pull/48425)
- Percent-encode the request id in the spend log detail URL, so Logs rows with `#`, `?` or `%` in the id show their request and response, and fix `lite debug claude` the same way - [PR #48630](https://github.com/BerriAI/litellm/pull/48630)

#### Models + Endpoints

- Show a Kubernetes pods card on the model page, backed by the new `GET /model/{model_id}/kubernetes_pods`, listing the service host, ready pod count and pod IPs - [PR #44666](https://github.com/BerriAI/litellm/pull/44666)
- Add a 1 hour cache write cost field to the Add Model and model edit forms, so UI-priced Claude deployments bill 1 hour cache writes at the admin's rate instead of the cost map default - [PR #46830](https://github.com/BerriAI/litellm/pull/46830)
- Reject negative prices on the model edit form with "Enter a price of 0 or more" instead of saving them as negative per-token costs - [PR #46978](https://github.com/BerriAI/litellm/pull/46978)
- Show the newest health check per model group on the model hub, on `/public/v1/model_hub` and `/public/model_hub`, instead of whichever stored check sorts last - [PR #47552](https://github.com/BerriAI/litellm/pull/47552)
- Make pass-through headers optional in the endpoint form, and show the authentication switch on by default and from saved values for all users - [PR #48081](https://github.com/BerriAI/litellm/pull/48081)
- Simplify Auto Router creation to two suggested models from the latest deployed families, with Cheapest and Best quality alternatives and classifier settings moved under Advanced - [PR #48451](https://github.com/BerriAI/litellm/pull/48451)
- Delete keys removed in the LiteLLM Params JSON editor so they stay gone after refresh, and stop unsaved defaults from putting deleted flags back into storage - [PR #48456](https://github.com/BerriAI/litellm/pull/48456)
- Add sortable Alias Name and Target Model Group headers to the Model Group Alias table, with pinned aliases and a persistent display order kept per user in the browser - [PR #48500](https://github.com/BerriAI/litellm/pull/48500)
- Offer the same deployed models in Simple Auto Router setup as in Advanced configuration, so ChatGPT Responses models no longer disappear from the Everyday and Hard tasks selectors - [PR #48851](https://github.com/BerriAI/litellm/pull/48851)
- Add Meta Model API to the Add Model provider dropdown, so models like `meta/muse-spark-1.1` can be onboarded from the UI - [PR #49314](https://github.com/BerriAI/litellm/pull/49314)
- Restore the Z.AI API Key and API Base fields in Add Credential and make Z.AI selectable in Add Model - [PR #49325](https://github.com/BerriAI/litellm/pull/49325)
- Suggest Auto Router templates for Claude models listed by an `anthropic/claude-*` wildcard in the Add Auto Router dialog, instead of calling every Claude model missing - [PR #49331](https://github.com/BerriAI/litellm/pull/49331)

#### Playground and Decisions

- Turn the Chat UI on by default with `enable_chat_ui` defaulting to `true`, so Chat shows in the view switcher without an admin finding the toggle first - [PR #46918](https://github.com/BerriAI/litellm/pull/46918)
- Redesign the Playground chat around a single composer and an inspector panel showing routing, guardrails, speed and cost per reply, with other options moved into a Settings popover - [PR #46934](https://github.com/BerriAI/litellm/pull/46934)
- Show models that serve both chat and decisions in the Decisions Playground picker when their endpoint capabilities are declared - [PR #48504](https://github.com/BerriAI/litellm/pull/48504)
- Show reasoning in the Playground for `/v1/responses` by handling `response.reasoning_text.delta` and `response.reasoning_summary_text.delta`, instead of only the removed `response.reasoning.delta` event - [PR #48850](https://github.com/BerriAI/litellm/pull/48850)
- Resume Chat replies after the browser closes, for text chats and MCP tool runs, when Redis-backed background responses are on, with a `Continue chats in the background` toggle in UI Settings - [PR #49461](https://github.com/BerriAI/litellm/pull/49461)
- Add Deep research to the Chat Tools menu, which researches the web in the background and returns a report with clickable citations and saved sources - [PR #49508](https://github.com/BerriAI/litellm/pull/49508)
- Change the Chat home heading and composer placeholder to describe general chat, with research wording when Deep research is on - [PR #49531](https://github.com/BerriAI/litellm/pull/49531)

#### Settings

- Add a General Settings toggle that includes wildcard routes in model listings, which clients can still override per request - [PR #47979](https://github.com/BerriAI/litellm/pull/47979)
- Show text inputs for String settings in Router Settings general settings, including saved retention periods and cleanup timeouts, instead of empty value cells - [PR #48431](https://github.com/BerriAI/litellm/pull/48431)

#### Teams, users and access groups

- Show the caller's own spend and member budget per team on Your Teams, with `/v2/team/list` returning `caller_membership`, so a user in several teams no longer opens each My User tab - [PR #45674](https://github.com/BerriAI/litellm/pull/45674)
- Show `Never resets` instead of `n/a` for an unset budget reset period, and label the blank option `Keep current` or `No change` where an empty period leaves the stored value as is - [PR #47065](https://github.com/BerriAI/litellm/pull/47065)
- Offer access-group models in the team per-model rate limit and budget pickers, and every model for a team with an empty model list, instead of only `no-default-models` - [PR #47630](https://github.com/BerriAI/litellm/pull/47630)
- Sort every Users table data column, including alias, budget, updated date, SSO, status and key count, across all matching users before pagination - [PR #48105](https://github.com/BerriAI/litellm/pull/48105)
- Sort every Organizations table data column, including budget, members, models and separate TPM and RPM limits - [PR #48106](https://github.com/BerriAI/litellm/pull/48106)
- Sort every Teams table data column, including budgets, rate limits, organization names and member, model and key counts, across all matching teams before pagination - [PR #48109](https://github.com/BerriAI/litellm/pull/48109)
- Make the Download CSV Template button in Bulk Invite Users download `bulk_users_template.csv` with an example row, instead of doing nothing - [PR #48199](https://github.com/BerriAI/litellm/pull/48199)
- Show the budget period date range, such as Oct 1 - Nov 1, 2026, instead of Current Cycle Spend on the team Members table and My User tab - [PR #48488](https://github.com/BerriAI/litellm/pull/48488)
- Keep a team's model access when saving unrelated settings like its budget, and show unrestricted teams as All Proxy Models in the team editor - [PR #49258](https://github.com/BerriAI/litellm/pull/49258)

#### Usage

- Keep Usage view, tab, dates and filters in the URL, add a View usage action on Internal Users, and add a Copy Share Link button - [PR #43425](https://github.com/BerriAI/litellm/pull/43425)
- Mark ChatGPT subscription requests as Included in subscription on Usage, and add a card to record each account's monthly fee apart from metered spend - [PR #44772](https://github.com/BerriAI/litellm/pull/44772)
- Inspect client usage for users and team members on the Usage page - [Commit e41d375](https://github.com/BerriAI/litellm/commit/e41d3751692f9564676c279afa098cba34c534d0)
- Let admins choose the default time range for the Usage page in UI Settings, keeping the seven day default when unset and honoring ranges in shared links - [PR #48207](https://github.com/BerriAI/litellm/pull/48207)
- Remove the deprecated Old Usage page and its Experimental sidebar entry, and send old `?page=usage` bookmarks to the current Usage page at `/ui/usage` - [PR #49284](https://github.com/BerriAI/litellm/pull/49284)

#### Virtual Keys

- Prefill the Organization picker in the key edit form from `org_id`, so keys opened from the Virtual Keys list or an agent's page no longer show All Organizations - [PR #39535](https://github.com/BerriAI/litellm/pull/39535)
- Show the gateway URL with a Copy URL button and a collapsible Agent instructions card for Claude Code and Codex in the Save your Key modal - [PR #47199](https://github.com/BerriAI/litellm/pull/47199)
- Sort virtual keys by expiry, last activity, budget reset, lifetime spend and token or request limits across all matching keys before pagination - [PR #48074](https://github.com/BerriAI/litellm/pull/48074)
- Leave `duration` out of key edit and regenerate requests when the expiry field is blank, so proxies with an upperbound `duration` stop rejecting them with `Invalid duration format` - [PR #48634](https://github.com/BerriAI/litellm/pull/48634)

#### General

- Count the whole minor line in the upgrade notice for patch releases, so v1.105.1 no longer reads as 0 new features and admins on older patches see everything upgrading brings - [PR #46942](https://github.com/BerriAI/litellm/pull/46942)
- Add `LITELLM_UI_USE_SI_TERMINOLOGY` to show SI instead of AI in the Admin UI, exposed on `/.well-known/litellm-ui-config`, with prompts sent to models keeping AI - [PR #47440](https://github.com/BerriAI/litellm/pull/47440)
- Rebuild the dashboard bundle to remove the retired example master key from its compiled files, so copied snippets no longer carry it - [PR #47612](https://github.com/BerriAI/litellm/pull/47612)
- Take the upgrade notice's version and link from the docs changelog instead of GitHub's latest release, so the bell only offers releases with a published changelog page - [PR #47998](https://github.com/BerriAI/litellm/pull/47998)
- Add the Moyai Chat workspace with an embedded Model Hub, images and usage metrics - [Commit ca64a3b](https://github.com/BerriAI/litellm/commit/ca64a3bef2ee0c6430f338c6967288d998ed7f7e)
- Keep MCP tool results across follow-up requests in Chat - [Commit 6292f21](https://github.com/BerriAI/litellm/commit/6292f217a31d3e4a1841f70dc6b848ba6b8e6d02)
- Let Chat attach PDF, text and code, Word and Excel files, up to four per message and 10 MB each, and keep them after reload - [PR #48137](https://github.com/BerriAI/litellm/pull/48137)
- Stop sending a separate telemetry request to a hosted service when a Chat message is submitted in the Admin UI - [PR #48225](https://github.com/BerriAI/litellm/pull/48225)
- Show the proxy's error message in a toast when a search from the search tools tester is rejected, instead of showing 0 results and No results found - [PR #48478](https://github.com/BerriAI/litellm/pull/48478)
- Add a tooltip to the key, team, user and organization Spend tiles showing the budget period, max budget, reset interval and spend so far, and schedule resets for organizations created with a budget duration - [PR #48487](https://github.com/BerriAI/litellm/pull/48487)
- Show the configured dark logo in Connect and Chat in dark mode, support private server images, and show organization branding in the Chat sidebar and mobile drawer - [PR #48532](https://github.com/BerriAI/litellm/pull/48532)
- Keep XecGuard and Airia vendor names and copied agent instructions in AI wording when SI terminology is on, instead of showing "XecGuard SI" and "SI gateway" - [PR #48670](https://github.com/BerriAI/litellm/pull/48670)
- Render keyboard shortcut hints across the Admin UI through the shared shadcn `Kbd` component, so the chips look the same on every page - [PR #48885](https://github.com/BerriAI/litellm/pull/48885)

### Keys, teams and authentication

- Refresh the cached team on `/team/block` and `/team/unblock` and tell other proxies over Redis, so blocked team keys stop working and unblocked ones resume without waiting for the cache to expire - [PR #35643](https://github.com/BerriAI/litellm/pull/35643)
- Send the status's error `type` and a missing `param` as JSON `null` instead of the string "None" on proxy server, auth, spend and key health errors - [PR #39540](https://github.com/BerriAI/litellm/pull/39540)
- Label errors from shared-handler routes such as `/key/generate` and `/v1/batches` as `invalid_request_error` for a 4xx and `auth_error` for a proxy 401 or 403, instead of `internal_server_error` - [PR #39555](https://github.com/BerriAI/litellm/pull/39555)
- Apply `default_key_generate_params.allowed_routes` to newly generated keys, including UI AI APIs keys - [PR #41236](https://github.com/BerriAI/litellm/pull/41236)
- Allow `/key/update` to assign a project to a key that has none, instead of answering 400 `Project reassignment is not supported` - [PR #41700](https://github.com/BerriAI/litellm/pull/41700)
- List every priced Vertex family under a `vertex_ai/*` grant and keep publisher segments like `meta/` in listed ids, so each listed id is callable - [PR #41959](https://github.com/BerriAI/litellm/pull/41959)
- Return a generic error from `/key/info` on unexpected database failures instead of raw database-driver details in the 500 body, and log the full exception on the server - [PR #46190](https://github.com/BerriAI/litellm/pull/46190)
- Let personal keys inherit MCP server, MCP tool and agent access from the owner's teams when `personal_key_model_access_from_teams` is on, instead of listing no MCP servers while reaching every agent - [PR #46293](https://github.com/BerriAI/litellm/pull/46293)
- Evict a deleted key from every worker's auth cache over coordination Redis, so `/key/delete` stops other workers serving the key until the TTL - [PR #47609](https://github.com/BerriAI/litellm/pull/47609)
- Gate `budget_duration` and `budget_id` changes on `/key/update` like `max_budget`, so key owners and team members get a 403 instead of shortening the reset period or moving to a bigger budget tier - [PR #47681](https://github.com/BerriAI/litellm/pull/47681)
- Let `typesafe/*` allowlists cover `/typesafe` calls with the priced Jev model ids so `jev-latest` no longer gets a 403, and list `typesafe/*` and Jev models in the Admin UI model pickers when a TypeSafe key is set - [PR #47697](https://github.com/BerriAI/litellm/pull/47697)
- Align LiteAdmin MCP route checks with the gateway's existing access rules - [PR #48080](https://github.com/BerriAI/litellm/pull/48080)
- Stop looking up the placeholder dashboard team for Admin UI search so searches no longer 404, and scope non-admin dashboard users to their granted tools under `search_tool_deny_by_default` - [PR #48464](https://github.com/BerriAI/litellm/pull/48464)
- Log routine proxy auth 401 rejections as one WARNING without a traceback, so ERROR logs only show real crashes inside auth - [PR #48613](https://github.com/BerriAI/litellm/pull/48613)
- Return a 403 naming the Enterprise licence when `/key/generate` or `/user/new` sets `get_spend_routes` without one, instead of a bare 500 - [PR #48623](https://github.com/BerriAI/litellm/pull/48623)
- Label 400 and 404 rejections from management and health routes `invalid_request_error` instead of `auth_error`, and answer 503 for database outages and failovers - [PR #48739](https://github.com/BerriAI/litellm/pull/48739)
- Keep the stored secret when `PATCH /credentials/{name}` receives the masked read-back of a secret, instead of saving the mask as the key and breaking every model on that credential - [PR #48950](https://github.com/BerriAI/litellm/pull/48950)
- Show a team dropdown on the Claude Code gateway's Complete CLI Login page and issue the session for the picked team, refusing a team the developer is not on with a 400 - [PR #49001](https://github.com/BerriAI/litellm/pull/49001)
- Keep the team lists for `lite login`, the `--pkce` preselect and the Claude Code gateway dropdown in the user record's order, and add teams in the order sent on user create, group sync, SCIM and JWT sync - [PR #49033](https://github.com/BerriAI/litellm/pull/49033)
- Scope `/health` with the same model checks as chat, so wildcard keys see models they can call and team keys no longer see or probe models their team forbids - [PR #49155](https://github.com/BerriAI/litellm/pull/49155)

### SSO and SCIM

- Store SCIM PATCH enterprise extension attributes like `department` and `costCenter` in `metadata.scim_enterprise` instead of silently dropping them, and answer 400 for a wrong-typed enterprise value - [PR #46738](https://github.com/BerriAI/litellm/pull/46738)
- Delete a SCIM group through the team delete's bulk path, so its memberships and members' team keys are removed instead of staying active - [PR #47544](https://github.com/BerriAI/litellm/pull/47544)
- Refuse a sixth billable user before creating their account on free SSO, while existing users can still sign in instead of being locked out - [PR #48097](https://github.com/BerriAI/litellm/pull/48097)
- Create the `team_id_jwt_field` team on UI SSO login when `team_id_upsert` and `enable_jwt_auth` are set, then add the user to it, matching what the API JWT path already does - [PR #49256](https://github.com/BerriAI/litellm/pull/49256)

### Model management

- Show admin-defined `model_info.custom_tags` and `model_info.custom_metadata` on Model Hub, merged across a model group's deployments, so lifecycle and capacity info no longer gets dropped - [PR #46064](https://github.com/BerriAI/litellm/pull/46064)
- Match partial wildcards like `cloudflare/@cf/*` against prefix-stripped model ids, so `/v1/models` and `/model/info` list the real models and alias ids over a wildcard can be called - [PR #46390](https://github.com/BerriAI/litellm/pull/46390)
- Save the `model_info` fields sent to `POST /model/update` instead of discarding them, so a Terraform `base_model` change no longer returns 200 and does nothing - [PR #46902](https://github.com/BerriAI/litellm/pull/46902)
- Ask OpenAI and Azure audio chat models for audio output in the `/health` probe, so `gpt-audio` deployments no longer show unhealthy from a 400 - [PR #47730](https://github.com/BerriAI/litellm/pull/47730)
- Apply a model added with `/model/new` on every worker as soon as it is written when Redis is on, instead of after up to 16 seconds, and rewrite only the deployments that change on access group edits - [PR #49034](https://github.com/BerriAI/litellm/pull/49034)
- Probe the two cheapest cost map chat models a partial wildcard like `databricks/databricks-claude-*` serves before the provider-wide models, so its health row reports on a model the deployment serves - [PR #49060](https://github.com/BerriAI/litellm/pull/49060)
- Let models with saved access windows be edited without an HTTP 500, keeping the windows unless an admin replaces or clears them - [PR #49316](https://github.com/BerriAI/litellm/pull/49316)

### Usage and analytics

- Paginate the customer list routes, defaulting to 50 customers per page with sizes from 1 to 100, and let the Usage customer filter search and load more customers - [PR #48700](https://github.com/BerriAI/litellm/pull/48700)

### Proxy configuration

- Add a `general_settings.return_wildcard_routes` setting that shows wildcard routes in `/v1/models` by default, with request parameters still overriding it - [PR #43624](https://github.com/BerriAI/litellm/pull/43624)
- Run every worker with `--reload` when `--num_workers`, `NUM_WORKERS` or `DEFAULT_NUM_WORKERS_LITELLM_PROXY` is above 1 on uvicorn 0.50.0 or newer, restarting the whole pool on each save instead of falling back to one worker - [PR #45909](https://github.com/BerriAI/litellm/pull/45909)
- Unset a removed stored environment variable on every worker by row revision, so a removed provider key stops serving traffic without restarting every pod - [PR #46709](https://github.com/BerriAI/litellm/pull/46709)
- Log one boot WARNING naming each config `environment_variables` key that replaces a value already set in the process environment, without printing the value - [PR #47165](https://github.com/BerriAI/litellm/pull/47165)
- Let `enforce_project_model_quota` take `default`, `providers` and `models` entries naming which `rpm` and `tpm` limits each provider or model needs, with `[]` exempting it, and name each model's missing limits in the 400 - [PR #47693](https://github.com/BerriAI/litellm/pull/47693)
- Add `suppress_startup_output`, or `LITELLM_SUPPRESS_STARTUP_OUTPUT=true`, to turn off the startup banner, model list and Search Tools list, and drop color codes when stdout is not a color terminal - [PR #47708](https://github.com/BerriAI/litellm/pull/47708)
- Add `LITELLM_DISABLE_LATEST_RELEASE_CHECK=true` to make `/get/latest_release_info` return `null` without any outbound request, for locked-down networks - [PR #48065](https://github.com/BerriAI/litellm/pull/48065)
- Add `LITELLM_OFFLINE_MODE=true` to stop the catalog, release, breached-password and tokenizer fetches LiteLLM makes on its own and use the bundled copy instead - [PR #48096](https://github.com/BerriAI/litellm/pull/48096)
- Store boolean settings sent to `/config/field/update` as real `true` or `false` instead of text such as "true" or "yes", so the proxy no longer treats a switch shown as on as off - [PR #48595](https://github.com/BerriAI/litellm/pull/48595)

### CLI and coding agents

- Start `lite` and `litellm-proxy` from a small `litellm_cli` package without initializing the litellm SDK, so each command no longer pays about 4.6 s of imports on a 1 vCPU VM - [PR #46803](https://github.com/BerriAI/litellm/pull/46803)
- Add `lite claude --subscription` and `--no-subscription`, which keep Claude Code's claude.ai login in `Authorization` and send the LiteLLM key in `x-litellm-api-key` - [PR #47385](https://github.com/BerriAI/litellm/pull/47385)
- Send pi's `x-session-id` header from `lite pi`, so a pi session groups in the logs and sticks to one deployment with session affinity - [PR #47700](https://github.com/BerriAI/litellm/pull/47700)
- Let the proxy decide when a `lite login` token has expired, so `lite auth print-token` and `lite whoami` no longer treat it as expired after 24 hours and Claude Code keeps working - [PR #47712](https://github.com/BerriAI/litellm/pull/47712)
- Add a `litellm-setup` agent skill that takes coding agents like Claude Code from nothing to a running proxy on uv or Docker, and hide the repo's contributor skills from end-user installs - [PR #47731](https://github.com/BerriAI/litellm/pull/47731)
- Keep the ChatGPT login with `lite codex --subscription`, send the LiteLLM key only in the `x-litellm-api-key` header, and add a `codex_subscription` `lite config` key to turn it on by default - [Commit 295d79f](https://github.com/BerriAI/litellm/commit/295d79fc7d9f935165e07c66e150a8579d511d4c)
- Give `lite codex` aliases of a Codex-known model that model's catalog entry, so Codex keeps tool search and stops sending every MCP tool definition on every turn - [PR #48894](https://github.com/BerriAI/litellm/pull/48894)
- Offer each model group's reasoning levels from `/model_group/info` in `lite pi`, `lite opencode` and `lite codex`, and add the same levels to the Codex catalog at `/v1/models?client_version=...` - [PR #48949](https://github.com/BerriAI/litellm/pull/48949)
- Add `general_settings.claude_code_marketplace_auth_required` to put the Claude Code marketplace behind a LiteLLM key header and empty the public skill hub, and return a fixed message on 500s from both routes - [PR #48980](https://github.com/BerriAI/litellm/pull/48980)
- Honor `litellm_settings.drop_params: false` for Claude Code and Codex requests, so unsupported settings answer 400 like other clients instead of being dropped silently with a 200 - [PR #49058](https://github.com/BerriAI/litellm/pull/49058)

### Terraform

- Default the AWS Terraform module's component images to the module release tag through `image_tag`, instead of deploying stale `v1.86.0-dev` images for every module version - [PR #46960](https://github.com/BerriAI/litellm/pull/46960)

## AI Integrations

### Guardrails

- Add an opt-in `include_masked_response_on_block` setting to the PANW Prisma AIRS guardrail that returns AIRS `response_masked_data` in the 400 body of a blocked response - [PR #46219](https://github.com/BerriAI/litellm/pull/46219)
- Accept Gemini native tools in `generic_guardrail_api`, add an opt-in `forward_messages_as_sent`, and name the error type in the fail-open log line so a timeout no longer reads like a refused connection - [PR #46338](https://github.com/BerriAI/litellm/pull/46338)
- Add an opt-in `num_retries` setting, from 0 to 5, to `generic_guardrail_api` guardrails so a check lost after connect retries on a fresh connection instead of failing the request - [PR #46965](https://github.com/BerriAI/litellm/pull/46965)
- Merge overlapping Presidio entity spans so `output_parse_pii: true` no longer corrupts numbered PII tokens like `<PHONE_NUMBER_3>` and returns the user's original value - [PR #47024](https://github.com/BerriAI/litellm/pull/47024)
- Mask secrets in tool results, tool inputs, tool call arguments, `system` and `instructions` with the `hide-secrets` guardrail, which used to scan only message text, and remember clean text so resent tool history is scanned once - [PR #47122](https://github.com/BerriAI/litellm/pull/47122)
- Allow `pre_mcp_call`, `during_mcp_call` and `post_mcp_call` modes on the generic guardrail API, so a guardrail set that way is attached to MCP tool calls instead of being dropped at startup - [PR #48060](https://github.com/BerriAI/litellm/pull/48060)
- Add Reco as a native `pre_call` guardrail with `reco_tenant_id` validation at startup, failing closed by default through `fail_on_error: true` - [PR #48243](https://github.com/BerriAI/litellm/pull/48243)
- Exclude LiteLLM's injected `litellm_metadata` from the text guardrails scan on pass-through routes, so key hash, user email, team and spend fields are no longer sent as prompt text - [PR #48276](https://github.com/BerriAI/litellm/pull/48276)
- Make `hide-secrets` honor `skip_tool_message_in_guardrail`, so tool results reach the model as sent when the flag is on, while tool call arguments, user text and system prompts are still masked - [PR #48689](https://github.com/BerriAI/litellm/pull/48689)
- Scan `/v1/responses` tool results in guardrails that read `texts` and write edits back into `output`, as chat completions already does - [PR #48827](https://github.com/BerriAI/litellm/pull/48827)
- Skip `/v1/embeddings` input in `google_text_moderation`, so embedding requests are no longer blocked with a 400 on benign words like `stocks` or `mortgage` - [PR #48934](https://github.com/BerriAI/litellm/pull/48934)
- Make `on_flagged: block` on `lakera_v2` return 400 for PII-only detections instead of masking and allowing them, and add `on_flagged: mask` to keep the mask-and-allow behavior - [PR #48944](https://github.com/BerriAI/litellm/pull/48944)
- Add opt-in `streaming_scan_in_background` for Bedrock guardrails so sampled stream scans run while chunks keep flowing, and a flagged scan ends the stream before the next chunk - [PR #48952](https://github.com/BerriAI/litellm/pull/48952)
- Scan and rewrite streamed `/v1/completions` under `post_call` guardrails when the stream ends, so masked words come back masked and blocked words no longer return 200 - [PR #49035](https://github.com/BerriAI/litellm/pull/49035)
- Keep the upstream error when a `/v1/messages` stream ends in one, so `tool_permission` no longer replaces it with its own 400 and Presidio masks these streams too - [PR #49088](https://github.com/BerriAI/litellm/pull/49088)
- Send an opaque tenant-scoped `x-headroom-affinity` header on Headroom compression and retrieval requests, so both reach the same pod and retrieval stops missing its local cache - [PR #49255](https://github.com/BerriAI/litellm/pull/49255)
- Scan attached files, tool calls and tool results with the Ovalix guardrail, and send requests with no user as actor `unknown` so they keep Ovalix enforcement - [PR #49309](https://github.com/BerriAI/litellm/pull/49309)
- Add a `response_format` option to `/guardrails/apply_guardrail` that returns a configured guardrail's native structured findings, keeping the `response_text` response when it is omitted - [PR #49460](https://github.com/BerriAI/litellm/pull/49460)
- Add Bedrock guardrail `outputScope` configuration, so `FULL` returns non-detected assessments such as a positive grounding score - [PR #49470](https://github.com/BerriAI/litellm/pull/49470)

### Logging and observability

#### Arize

- Decide per-team Arize sampling from a SHA-256 of the trace id, so every pod and worker keeps or drops the same traces - [PR #47468](https://github.com/BerriAI/litellm/pull/47468)

#### Langfuse

- Send key, user, end user, team and org identity as `langfuse.observation.metadata` and `langfuse.trace.metadata` on OTEL v2, so Langfuse can filter generations by them - [PR #42697](https://github.com/BerriAI/litellm/pull/42697)
- Set trace-level name, input, output and tags on `langfuse_otel` traces that LiteLLM starts, named `litellm-{call_type}` unless the caller set a name - [PR #42705](https://github.com/BerriAI/litellm/pull/42705)
- Send LiteLLM's completion start time as `langfuse.observation.completion_start_time` from `langfuse_otel` so Langfuse shows time to first token, including for streamed `/v1/messages`, native Gemini, Interactions and A2A calls - [PR #45597](https://github.com/BerriAI/litellm/pull/45597)
- Send user, tags and session to key and team Langfuse destinations on OTel v2 without global Langfuse keys, and stop the duplicate generation or orphaned span - [PR #48718](https://github.com/BerriAI/litellm/pull/48718)

#### OpenTelemetry

- Report cache hits at zero cost with a `litellm.cache_hit` flag on OTel V1 and V2 spans, and emit an LLM-call span for V2 cache hits - [PR #43604](https://github.com/BerriAI/litellm/pull/43604)
- Put the error text on the status of every failed OTel span, so Langfuse and Phoenix show it instead of an empty ERROR message - [PR #44185](https://github.com/BerriAI/litellm/pull/44185)
- Leave the span cost out when the price lookup failed instead of sending 0, so Arize and Langfuse can tell an unpriced call from a free one - [PR #44187](https://github.com/BerriAI/litellm/pull/44187)
- Label spans and duration metrics for configured `pass_through_endpoints` routes `litellm.passthrough` instead of `chat` under OTel GenAI semconv or OTel v2, so they leave the chat charts - [PR #48675](https://github.com/BerriAI/litellm/pull/48675)
- Suppress auth and database spans for excluded requests such as `/model/info` on OTel v2, instead of exporting orphan traces - [PR #48720](https://github.com/BerriAI/litellm/pull/48720)
- Print OTel v2 spans to stdout only when `OTEL_EXPORTER=console` is set, so prompts stop appearing in container logs next to Langfuse, Arize or key and team destinations - [PR #48723](https://github.com/BerriAI/litellm/pull/48723)
- End the request span for `/v1/models` and `GET /v1/models/{model_id}`, so model list calls show up in the caller's trace by `traceparent` - [PR #49141](https://github.com/BerriAI/litellm/pull/49141)

#### Prometheus

- Count successful fallback requests under the model the caller requested in Prometheus, so filtering by the original model finds them - [PR #45555](https://github.com/BerriAI/litellm/pull/45555)
- Count provider-side 401s in `litellm_deployment_failure_responses` and `litellm_deployment_state` again, so a deployment with a rotated or revoked provider key no longer looks healthy - [PR #46668](https://github.com/BerriAI/litellm/pull/46668)
- Report the in-memory spend update queue size as a numeric Prometheus sample after enqueueing, aggregation and database flushes - [PR #46956](https://github.com/BerriAI/litellm/pull/46956)
- Set the remaining rate-limit gauges from decimal headers like `12.0` and `856.5` again, and skip only the gauge whose header value cannot be read as a number - [PR #47039](https://github.com/BerriAI/litellm/pull/47039)
- Keep `/metrics` on the backend after startup when Prometheus is enabled instead of answering 404 - [PR #47129](https://github.com/BerriAI/litellm/pull/47129)
- Label deployment failure metrics with the provider of the deployment the request was routed to instead of `api_provider=None`, on embeddings, native `/v1/responses`, native `/v1/messages`, rate limit and unsupported param failures - [PR #47384](https://github.com/BerriAI/litellm/pull/47384)

#### S3

- Run the legacy `success_callback: ["s3"]` for streamed `/v1/messages` calls, so each streamed call writes an object to the bucket like non-streamed calls do - [PR #47156](https://github.com/BerriAI/litellm/pull/47156)

#### General

- Delete callbacks configured under `callbacks` or `failure_callback` from the Logging Callbacks page, instead of answering 404 for anything outside `success_callback` - [PR #42740](https://github.com/BerriAI/litellm/pull/42740)
- Redact Responses `instructions` in request and response logs, spend log request bodies and callback payloads when message logging is off - [PR #43315](https://github.com/BerriAI/litellm/pull/43315)
- Emit every proxy startup line as a JSON log record when `json_logs` is on, including the banner, model list and notices from workers spawned by uvicorn or granian - [PR #47035](https://github.com/BerriAI/litellm/pull/47035)
- Report the deployment's configured `api_base`, model group, key name and team in the alert for a stream that fails mid-way, instead of `https://api.openai.com` with no context - [PR #47045](https://github.com/BerriAI/litellm/pull/47045)
- Fire one `CustomLogger` failure hook per async call for failed speech, transcription, image, OCR and search calls and proxy-rejected requests, instead of both the sync and async hooks - [PR #47124](https://github.com/BerriAI/litellm/pull/47124)
- Keep root logger INFO lines when `json_logs` is on and `LITELLM_LOG` is set, so INFO logs from custom callbacks and third-party libraries are no longer dropped - [PR #47175](https://github.com/BerriAI/litellm/pull/47175)
- Deliver configured success callbacks for completed batches, and keep the response id, model, usage and cost when redaction is on - [PR #47192](https://github.com/BerriAI/litellm/pull/47192)
- Send the billed background Responses cost to the creating key's and team's loggers, redaction included - [PR #47506](https://github.com/BerriAI/litellm/pull/47506)
- Mark mirrored `silent_model` calls with `is_silent_experiment` in spend logs and callback payloads, set only by the router so a flag a client sends in metadata no longer marks a row - [PR #48888](https://github.com/BerriAI/litellm/pull/48888)
- Stop the `--detailed_debug` error log line from switching the terminal to bold red without resetting it, so later log lines no longer stay red - [PR #48966](https://github.com/BerriAI/litellm/pull/48966)
- Print the request body under `--detailed_debug` only where it enters the proxy and where it leaves for the provider, and drop per-request log lines with nothing to say - [PR #48973](https://github.com/BerriAI/litellm/pull/48973)
- Log image generation requests the router refuses, so deployment limits no longer leave a gap in failure logging - [PR #49349](https://github.com/BerriAI/litellm/pull/49349)
- Log A2A calls rejected before dispatch, such as forbidden or unknown agents, with the caller and target agent - [PR #49492](https://github.com/BerriAI/litellm/pull/49492)

### Secret Managers

- Resolve `oidc/file/` and `oidc/env/` references in an admin-configured `api_key` on every call, so rotated tokens work and the model stops answering 401 `Invalid API Key` - [PR #47341](https://github.com/BerriAI/litellm/pull/47341)
- Resolve `api_key: oidc/google/<audience>` per request into that audience's Google ID token, so `hosted_vllm` and other OpenAI-compatible models no longer answer 401 - [PR #47703](https://github.com/BerriAI/litellm/pull/47703)

## Spend Tracking, Budgets and Rate Limiting

### Cost tracking

- Keep cached and reasoning token counts when a stream's last chunk carries usage as a plain dict, so those streams are no longer priced as if every input token were fresh - [PR #36678](https://github.com/BerriAI/litellm/pull/36678)
- Bill a deployment's per-second rates on native Anthropic `/v1/messages` instead of the per-token price - [PR #42417](https://github.com/BerriAI/litellm/pull/42417)
- Log and bill both model calls of a non-stream MCP auto-execute on `/v1/responses` under the client's response id, and answer 200 instead of 400 for bridged providers like Anthropic - [PR #43667](https://github.com/BerriAI/litellm/pull/43667)
- Restore the token estimate for streams whose backend sends no usage, so spend logs, budgets and TPM limits no longer record 0 tokens and $0 - [PR #44230](https://github.com/BerriAI/litellm/pull/44230)
- Price streamed Vertex AI pass-through calls with the regional 10% uplift and the deployment's location, so they bill the same as non-streamed calls - [PR #44795](https://github.com/BerriAI/litellm/pull/44795)
- Ask for usage on streamed `/v1/completions` without `stream_options`, so spend follows the provider's counts instead of counted text - [PR #45366](https://github.com/BerriAI/litellm/pull/45366)
- Keep background interaction bills through crashes, late restarts and per-model `api_key` or Vertex AI project deployments, and keep a request's tags on bills written by another replica - [PR #45743](https://github.com/BerriAI/litellm/pull/45743)
- Stop billing `GET /responses/{id}`, `input_tokens`, `input_items` and `DELETE /responses/{id}` on the OpenAI pass-through as Responses calls, and stop their ERROR log lines - [PR #47171](https://github.com/BerriAI/litellm/pull/47171)
- Bill Tavily `search_depth: "advanced"` and Linkup `depth: "deep"` searches at their own `tavily/search-advanced` and `linkup/search-deep` prices instead of the basic rate - [PR #47411](https://github.com/BerriAI/litellm/pull/47411)
- Bill both model calls of a chat completions MCP auto-execute on one spend row, so the row matches `usage` and `x-litellm-response-cost` - [PR #47422](https://github.com/BerriAI/litellm/pull/47422)
- Bill every round of a streamed `/v1/responses` MCP auto-execute on one spend row, and sum all model calls in the final `response.completed` usage - [PR #47445](https://github.com/BerriAI/litellm/pull/47445)
- Bill `base_model` deployments such as `azure/eu/o3` and `azure/eu/o4-mini` from the response model's price row instead of $0 - [PR #47497](https://github.com/BerriAI/litellm/pull/47497)
- Register one shared billing logger in both callback registries, so a request is no longer counted twice - [PR #47510](https://github.com/BerriAI/litellm/pull/47510)
- Bill partial usage from the prompt and streamed text when a Responses stream fails mid-way, and report failed bridged `/v1/messages` streams to the proxy - [PR #47537](https://github.com/BerriAI/litellm/pull/47537)
- Add `model_info.pricing_provider` to price a deployment from another provider's cost map rows, so it no longer bills $0 under `custom_llm_provider: openai` - [PR #47620](https://github.com/BerriAI/litellm/pull/47620)
- Bill the usage a stream sent before its connection dropped by handing out buffered aiohttp bytes first, so a cut `/v1/messages` attempt records its `message_start` tokens instead of 0 - [PR #47838](https://github.com/BerriAI/litellm/pull/47838)
- Bill Gemini audio input and cached audio at the Flex, Priority and Batch rates instead of the Standard rate - [PR #48086](https://github.com/BerriAI/litellm/pull/48086)
- Bill OpenAI 12-hour prompt cache writes on the Responses API at their own `cache_creation_input_token_cost_above_12hr` rate instead of the 30-minute write rate - [PR #48088](https://github.com/BerriAI/litellm/pull/48088)
- Bill `litellm.responses()` and `litellm.aresponses()` at the `input_cost_per_token` and `output_cost_per_token` set on the call, instead of cost map prices or no cost - [PR #48119](https://github.com/BerriAI/litellm/pull/48119)
- Bill `opencode_go/*` requests from the cost OpenCode reports on the response, streamed and native `/v1/messages` included, instead of $0 or static price rows - [PR #48254](https://github.com/BerriAI/litellm/pull/48254)
- Bill OpenAI batch requests that report 12-hour cache writes at the batch 12-hour rate, and accept the 12-hour batch and ultrafast cache write fields in the cost map - [PR #48259](https://github.com/BerriAI/litellm/pull/48259)
- Bill Bedrock native `guardrailConfig` trace usage as guardrail cost in spend and `x-litellm-response-cost`, and apply the deployment `guardrailConfig` on `/v1/messages` - [PR #48278](https://github.com/BerriAI/litellm/pull/48278)
- Keep custom pricing for DB-only deployments across Price Data Reload, so native `/v1/messages` requests stop logging $0 spend until a restart - [PR #48486](https://github.com/BerriAI/litellm/pull/48486)
- Include native Claude web search fees in the cost of streamed responses when the proxy rebuilds usage from an OpenAI-format stream - [PR #48528](https://github.com/BerriAI/litellm/pull/48528)
- Bill a NaN or infinite provider cost at its token price and record any other non-finite cost as $0, so one bad cost no longer blocks daily spend writes or answers 500 - [PR #48829](https://github.com/BerriAI/litellm/pull/48829)
- Bill both model calls of a streamed chat completions request that auto-executes an MCP tool on one spend row, with the last usage chunk matching it, instead of billing only one call - [PR #48899](https://github.com/BerriAI/litellm/pull/48899)
- Bill the requested model's rates when the response names an unpriced model, so Fireworks calls that answer with a display name no longer log $0 - [PR #48900](https://github.com/BerriAI/litellm/pull/48900)
- Bill each SDK call only its own native Bedrock guardrail trace when calls share one `metadata=` dict, instead of adding the guardrail units of all earlier calls - [PR #48923](https://github.com/BerriAI/litellm/pull/48923)
- Bill a numeric `usage.cost` from OpenAI-compatible gateways on plain and streamed chat and Responses calls, unless the deployment sets its own `input_cost_per_token`, `output_cost_per_token` or `base_model` - [PR #48953](https://github.com/BerriAI/litellm/pull/48953)
- Put LiteLLM's bill in `usage.cost` on the last usage frame of chat and Responses streams, so it matches the spend row and `x-litellm-response-cost` instead of the upstream's number - [PR #48955](https://github.com/BerriAI/litellm/pull/48955)
- Price native Cohere embed calls on the Foundry `/v1/embed` and `/v2/embed` relays and `/cohere/v2/embed` from `billed_units`, and bill direct Cohere image embeds at the cost map's image price instead of $0 - [PR #48978](https://github.com/BerriAI/litellm/pull/48978)
- Finalize a synchronous request's cost once before response headers are sent, so headers, spend logs, rollups and budget counters agree and completed provider usage survives failed post-call hooks and cancellation - [PR #48993](https://github.com/BerriAI/litellm/pull/48993)
- Bill Claude web search per request on Vertex AI deployments priced in `model_info`, and bill token-only Claude deployments at the cost map search price, with 0.01 USD rows for Vertex Sonnet 4.5 and Haiku 4.5 - [PR #49160](https://github.com/BerriAI/litellm/pull/49160)
- Apply the configured margin once, not twice, to `completion_cost(stream_chunk_builder(chunks))` and to the `usage.cost` of streamed `/v1/responses` calls served through the chat bridge - [PR #49254](https://github.com/BerriAI/litellm/pull/49254)
- Keep explicit zero prices in batch cache, speech and Perplexity search cost calculation and fall back only when a price is unset, while unpriced speech still raises - [PR #49294](https://github.com/BerriAI/litellm/pull/49294)
- Cost an unmanaged `gs://` Vertex batch through the deployment that created it, so batches on a second deployment sharing a base model get a spend row instead of none - [PR #49301](https://github.com/BerriAI/litellm/pull/49301)
- Split a provider-reported `usage.cost` total between input and output by the cost map rate ratio, instead of booking all of it as output cost with input at 0 - [PR #49357](https://github.com/BerriAI/litellm/pull/49357)
- Price streamed `/v1/messages` requests served through the Responses bridge per token, with any margin or discount applied once, instead of booking input cost 0 and the whole amount as output cost - [PR #49365](https://github.com/BerriAI/litellm/pull/49365)

### Spend logs and daily rollups

- Keep `user_api_key_user_email` in spend log metadata by default, so request logs show the internal user's email instead of an opaque SSO id - [PR #41150](https://github.com/BerriAI/litellm/pull/41150)
- Use the caller's `litellm_session_id` or `metadata.session_id` as the spend log `session_id` when `request_correlation_in_logs` is on, on every route - [PR #44199](https://github.com/BerriAI/litellm/pull/44199)
- List the cooled deployments, each with its `model_id` and `api_base`, in `error_cooldown_deployments` on the failure row when the router answers 429 because every deployment is cooling - [PR #47120](https://github.com/BerriAI/litellm/pull/47120)
- Put drained daily tag spend back on the in-memory queue when the Redis `RPUSH` fails, so the next tick retries it instead of losing that tick's tag spend - [PR #47307](https://github.com/BerriAI/litellm/pull/47307)
- Read deployment pricing for savings calculations from the router's cached model info instead of deep-copying it for every daily rollup row - [PR #47400](https://github.com/BerriAI/litellm/pull/47400)
- Add `maximum_spend_logs_size`, `maximum_spend_logs_cleanup_target_size` and `maximum_spend_logs_size_check_interval` to delete the oldest spend log rows once the table passes a size limit - [PR #47450](https://github.com/BerriAI/litellm/pull/47450)
- Drop the oldest day partitions first when size-based spend log cleanup runs with `use_spend_logs_partitioning`, so disk space comes back at once, and report `partitions_dropped` in the run summary - [PR #47451](https://github.com/BerriAI/litellm/pull/47451)
- Run one spend log cleanup pass at a time per pod, with or without Redis, so the age job and the size job no longer delete at once - [PR #47500](https://github.com/BerriAI/litellm/pull/47500)
- Run `ANALYZE` when spend log size cleanup finds reset table statistics and keep its reclaimable count, so the pass runs instead of skipping or over-deleting - [PR #47501](https://github.com/BerriAI/litellm/pull/47501)
- Ignore a first-token time left over from a failed attempt, so retried requests stop logging a negative completion time that made latency-based routing drop the group - [PR #47541](https://github.com/BerriAI/litellm/pull/47541)
- Record `spend_logs_metadata` on `/v1beta/interactions` instead of leaving it `null` in the spend log - [PR #47848](https://github.com/BerriAI/litellm/pull/47848)
- Drain the per-request key, team, user and daily rollups on shutdown and log their failures with the request id, so a pod recycle no longer drops rollups for a request whose spend log landed - [PR #48131](https://github.com/BerriAI/litellm/pull/48131)
- Add opt-in `general_settings.disable_pre_routing_error_logs` to skip zero-spend failure rows for requests rejected before routing, such as invalid keys or exceeded budgets - [PR #48239](https://github.com/BerriAI/litellm/pull/48239)
- Match `extra_spend_tag_headers` case-insensitively, so entries such as `X-Org-Id` produce spend tags instead of being silently missing from spend logs - [PR #48620](https://github.com/BerriAI/litellm/pull/48620)
- Return each day's guardrail cost per guardrail and per API key from the user, team and organization daily activity endpoints, next to the model and provider breakdowns - [PR #48702](https://github.com/BerriAI/litellm/pull/48702)
- Include spend and request counts with no model or key in daily activity reports, drilldowns and exports under fallback bucket labels, so breakdowns add up to the totals - [PR #48925](https://github.com/BerriAI/litellm/pull/48925)
- Flush the tag spend queue and wait for queued success callbacks within the shutdown budget on SIGTERM, so restarts no longer lose tag rows and SpendLogs rows for in-flight requests - [PR #48988](https://github.com/BerriAI/litellm/pull/48988)
- Add opt-in durable usage capture that batches usage events and delivery manifests, bounds buffered work and drains within the shutdown deadline, with optional commit acknowledgements on non-stream foreground requests - [PR #49133](https://github.com/BerriAI/litellm/pull/49133)
- Record OpenRouter's top-level `provider` as `upstream_provider` in the logging payload hidden params and spend log metadata, for streaming and non-streaming chat completions - [PR #49287](https://github.com/BerriAI/litellm/pull/49287)
- Keep rerank token usage in spend logs, including provider-reported totals and zero counts, instead of dropping it - [PR #49308](https://github.com/BerriAI/litellm/pull/49308)

### Budgets

- Add opt-in `general_settings.self_serve_budget_policy`, so key owners can change `max_budget` and `budget_limits` on their own keys through `/key/update` in `lower_only` or `ceiling` mode - [PR #44763](https://github.com/BerriAI/litellm/pull/44763)
- Map W3C `baggage` values to tags with `general_settings.request_tag_mappings`, so spend and budgets track per entrypoint and an exhausted tag budget rejects the request before the provider call - [PR #47358](https://github.com/BerriAI/litellm/pull/47358)
- Count billed background Responses spend toward the creating key's project and its per-model budgets on the key, tier, team and user - [PR #47504](https://github.com/BerriAI/litellm/pull/47504)
- Show the spend limit and rate limits in the Create and Edit budget dialogs without a collapsed section, so every field entered is saved - [PR #47662](https://github.com/BerriAI/litellm/pull/47662)
- Enforce model family patterns such as `claude-opus*` and access group entries in `model_max_budget` with one shared counter per entry, and show the family total on `/key/info` - [PR #47722](https://github.com/BerriAI/litellm/pull/47722)
- Raise the live budget counters for failure spend rows that carry a cost, so a key whose stream broke partway is refused right away instead of after the next counter repair - [PR #47741](https://github.com/BerriAI/litellm/pull/47741)
- Sort budgets by reset duration, comparing elapsed time so `1h`, `7d` and `30d` order correctly across all matching budgets before pagination - [PR #48107](https://github.com/BerriAI/litellm/pull/48107)
- Report team member `total_spend` as at least their current cycle spend on the Members tab and team APIs, and show the next reset time in the Budget Reset column - [PR #48260](https://github.com/BerriAI/litellm/pull/48260)
- Keep the team reset schedule when `/team/member_update` sets a temporary budget increase on a member inheriting the team default, so their spend keeps resetting and clearing the increase leaves them a budget - [PR #48495](https://github.com/BerriAI/litellm/pull/48495)
- Count Anthropic-style `tool_choice` on `/v1/messages` without a `KeyError`, so budget reservations stop charging the full input context and small end-user budgets stop failing concurrent requests - [PR #48624](https://github.com/BerriAI/litellm/pull/48624)
- Apply `max_end_user_budget_id` to end users without a row on cached keys, so a new end user gets the default budget's limits on every request and not only the first - [PR #48704](https://github.com/BerriAI/litellm/pull/48704)
- Enforce an end user's per-model budget `model_max_budget` from their linked budget on virtual keys, the master key and JWTs, so they can no longer spend past it - [PR #48815](https://github.com/BerriAI/litellm/pull/48815)
- Stop sending `llm_exceptions` alerts for `BudgetExceededError`, so over-budget keys that get a 422 no longer raise high-severity LLM failure alerts on every request - [PR #49290](https://github.com/BerriAI/litellm/pull/49290)
- Keep model discovery and the caller's key and user info working after a key or team-member budget is exhausted - [PR #49463](https://github.com/BerriAI/litellm/pull/49463)

### Rate limiting

- Count every `response.create` turn on a native Responses WebSocket toward its deployment's budget, TPM and RPM and refuse over-limit turns with a 429 frame, instead of only checking the first turn - [PR #45727](https://github.com/BerriAI/litellm/pull/45727)
- Reject negative RPM and TPM limits with a 422 when creating keys, users, teams, budgets and customers, instead of saving limits that make every request return 429 - [PR #48444](https://github.com/BerriAI/litellm/pull/48444)
- Release `max_parallel_requests` slots after completed streams when SSE keepalive is on, so a limit-3 key no longer returns 429 on its fourth sequential request - [PR #48452](https://github.com/BerriAI/litellm/pull/48452)
- Release virtual key concurrency slots when synthetic streams such as streamed web search complete, so sequential requests stop exhausting the limit - [PR #48628](https://github.com/BerriAI/litellm/pull/48628)
- Count images and audio in combined TPM reservations across Chat, Responses and Anthropic content shapes, and stop counting encoded Responses tool images as text - [PR #48865](https://github.com/BerriAI/litellm/pull/48865)
- Add deployment `rpd` and `tpd` daily limits enforced by `enforce_model_rate_limits`, so a deployment that spent its daily quota falls over to the next one in the group until midnight UTC - [PR #48875](https://github.com/BerriAI/litellm/pull/48875)
- Add `daily_reset_time` (`HH:MM` in UTC) to `litellm_params` to choose when a deployment's `rpd` and `tpd` daily limits start over, instead of always resetting at midnight UTC - [PR #48957](https://github.com/BerriAI/litellm/pull/48957)
- Reserve at most a quarter of `otpm` for a request without `max_tokens` and reconcile token counters to real usage after each call, so a deployment whose model max exceeds its `otpm` no longer answers 429 to every such request - [PR #49054](https://github.com/BerriAI/litellm/pull/49054)
- Check and count a deployment's `itpm` and `otpm` on every Responses WebSocket turn, with a 429 error frame at the limit, and keep the limiter's keys out of provider metadata - [PR #49069](https://github.com/BerriAI/litellm/pull/49069)
- Count each native `/v1/responses` WebSocket turn toward key and tag `tpm_limit`s and return a 429 for a turn with no tokens left, so Codex sessions stop spending past the limit - [PR #49257](https://github.com/BerriAI/litellm/pull/49257)

## MCP Gateway

### Auth and OAuth

- Stop forwarding the caller's LiteLLM virtual key to MCP servers upstream for every auth type, instead of only OAuth pass-through, when `Authorization` is in `extra_headers` - [PR #46932](https://github.com/BerriAI/litellm/pull/46932)
- Let `proxy_admin_viewer` store its own MCP OAuth token, BYOK key, env vars and OAuth client registration, instead of a 403 on every self-scoped MCP credential write - [PR #46994](https://github.com/BerriAI/litellm/pull/46994)
- Seal the `litellm_cp_return_to` cookie, so edge firewalls such as AWS WAF stop answering 403 on the MCP OAuth sign-in callback for local coding agents - [PR #47595](https://github.com/BerriAI/litellm/pull/47595)
- List tools for per-user auth MCP servers without a shared token on `/mcp-rest/tools/list` and `/mcp` tools/list, so users no longer see an empty catalog while tool calls still need their own token - [PR #47677](https://github.com/BerriAI/litellm/pull/47677)
- Advertise valid OAuth resource metadata for MCP toolset URLs, so Codex and Claude Code can sign in to them - [PR #48474](https://github.com/BerriAI/litellm/pull/48474)
- Require a live browser session when MCP gateway authorization starts, when the connect flow is read and when consent completes, so a UI cookie from a logged-out session can no longer mint gateway tokens - [PR #48494](https://github.com/BerriAI/litellm/pull/48494)
- Limit an admin's team key with no MCP servers picked, and an admin's CLI login or JWT on a team, to that team's MCP servers and toolsets, and answer 403 for LLM requests naming only denied toolsets - [PR #49161](https://github.com/BerriAI/litellm/pull/49161)

### Rate limits and guardrails

- Refuse calls to MCP tools hidden by discovery guardrails before upstream execution, including calls made without a prior listing - [PR #48669](https://github.com/BerriAI/litellm/pull/48669)

### Protocol and catalog

- Apply `LITELLM_MCP_TOOL_LISTING_TIMEOUT` to paginated `tools/list` per upstream server, so one hung MCP server no longer delays the unified `/mcp` listing by about 70 seconds - [PR #46513](https://github.com/BerriAI/litellm/pull/46513)
- Retry upstream 429 on `tools/list` up to 3 times and return JSON-RPC error `-32603` when every in-scope server fails, instead of a 200 with an empty tool list - [PR #46649](https://github.com/BerriAI/litellm/pull/46649)
- Upgrade to MCP SDK 2.3.0 and raise the per-event SSE size cap to 64 MiB, so large MCP tool results stop failing through the gateway - [PR #47034](https://github.com/BerriAI/litellm/pull/47034)
- Surface the upstream HTTP status when a failed POST closes an MCP session, so a rate limited handshake gets the 429 retry instead of an `internal` failure - [PR #47569](https://github.com/BerriAI/litellm/pull/47569)
- Send MCP tool-call response headers as soon as authorization completes instead of waiting about 15 seconds for the first SSE event - [PR #47897](https://github.com/BerriAI/litellm/pull/47897)
- Keep the selected toolset on `/toolset/{name}/mcp` when the catalog refreshes, so a key granted several toolsets no longer sees the tools of all of them - [PR #48095](https://github.com/BerriAI/litellm/pull/48095)
- Return HTTP 502 with the per-event byte limit and a hint to paginate `tools/list` for oversized MCP tool catalogs, and keep healthy servers' tools in aggregate listings - [PR #48424](https://github.com/BerriAI/litellm/pull/48424)
- Load deprecated MCP helper package aliases on demand, so legacy imports work without the optional MCP gateway dependencies installed - [PR #48615](https://github.com/BerriAI/litellm/pull/48615)
- Accept YAML OpenAPI documents when generating MCP tools from URLs and local files, instead of failing with a JSON parsing error - [PR #48622](https://github.com/BerriAI/litellm/pull/48622)
- Refuse calls to an MCP tool listed in both `allowed_tools` and `disallowed_tools`, matching its absence from discovery, and warn at startup about overlapping YAML entries - [PR #48625](https://github.com/BerriAI/litellm/pull/48625)
- Record MCP SDK request rejections such as unknown methods and invalid parameters as zero-cost failures under `MCP: request_rejected` with the caller's attribution, and keep persistent HTTP sessions alive after initialization - [PR #49184](https://github.com/BerriAI/litellm/pull/49184)

### Admin MCP and UI

- Log the sanitized upstream exchange when an MCP health check fails on an HTTP error, so `/v1/mcp/server/health` failures show the upstream status and body - [PR #44125](https://github.com/BerriAI/litellm/pull/44125)
- Flush the tool discovery queue on every pod when `use_redis_transaction_buffer` is on, so the Tool Policies page and `GET /v1/tool/list` show discovered tools - [PR #47653](https://github.com/BerriAI/litellm/pull/47653)
- Search tools across servers in the MCP toolset editor and add or remove many at once, keeping saved tools from servers that are down or deleted - [PR #48601](https://github.com/BerriAI/litellm/pull/48601)
- Offer the `Authorization (raw header)` auth type in the MCP server create and edit forms, for upstreams that need a scheme such as `ApiKey <key>` - [PR #48629](https://github.com/BerriAI/litellm/pull/48629)

## Performance / Loadbalancing / Reliability improvements

### Auto Router and model routing

- Let affinity pins skip a deployment that already failed this request, so weighted failover and retries use a healthy deployment in the same group instead of the cross-group fallback - [PR #32309](https://github.com/BerriAI/litellm/pull/32309)
- Add opt-in `router_settings.enable_mid_stream_fallback_continuation`, so a chat stream cut mid-answer continues on a prefill-capable fallback with the partial answer instead of ending truncated - [PR #41127](https://github.com/BerriAI/litellm/pull/41127)
- Add opt-in `kubernetes_pod_discovery: true`, so the Router resolves a headless service `api_base` to ready pod IPs and round-robins across them - [PR #44342](https://github.com/BerriAI/litellm/pull/44342)
- Pin requests that carry a session ID to one discovered Kubernetes pod, so vLLM's per-pod prefix cache is reused across a multi-turn session - [PR #44393](https://github.com/BerriAI/litellm/pull/44393)
- Log each failed streamed `/v1/messages` attempt through its own logging copy, so retries and fallbacks record the right usage, cost and deployment instead of mixing attempts - [PR #45194](https://github.com/BerriAI/litellm/pull/45194)
- Apply `content_policy_fallbacks` on every worker when router settings update at runtime through `POST /fallback` or `/config/update` - [PR #45428](https://github.com/BerriAI/litellm/pull/45428)
- Count failures when `allowed_fails` is explicitly set to 3 and stop fallback traffic that found no deployment from cooling down healthy fallback deployments - [PR #46183](https://github.com/BerriAI/litellm/pull/46183)
- Let admins set `model_info.enforce_supported_endpoints: true` on a non-chat deployment so chat requests skip it before any provider call and fall back or answer 400 - [PR #46257](https://github.com/BerriAI/litellm/pull/46257)
- Bound fake-streamed calls by the request timeout instead of `stream_timeout`, so slow Bedrock answers served without streaming are no longer cut off while live streams keep `stream_timeout` - [PR #47162](https://github.com/BerriAI/litellm/pull/47162)
- Apply key and team `router_settings` to hook, client-credential, comma-batch and `user_config` requests, and stop sending `router_settings_override` to the provider, so those requests keep retries, fallbacks and timeouts - [PR #47257](https://github.com/BerriAI/litellm/pull/47257)
- Resolve whether a deployment tracks usage limits once per deployment instead of on every request, saving about 0.2 ms of CPU per routed request - [PR #47393](https://github.com/BerriAI/litellm/pull/47393)
- Route only on prefixed caller tags once `tag_routing_prefix` is set, while key, team and project tags keep routing, so a spend tag like `user_id:234` no longer gets a 401 - [PR #47428](https://github.com/BerriAI/litellm/pull/47428)
- Queue `router_settings.default_priority` requests once, treat `priority` 0 as a real priority and answer 400 for a non-integer `priority`, instead of a 500 on every chat request - [PR #47498](https://github.com/BerriAI/litellm/pull/47498)
- Accept request priority from the `x-litellm-priority` header on router-served chat and text completions and `/queue/chat/completions`, ahead of a body `priority` - [PR #47618](https://github.com/BerriAI/litellm/pull/47618)
- Continue a cut `/v1/responses` stream on a fallback model without assistant prefill, by sending the partial reply as history plus a user turn, instead of returning the primary's `server_error` - [PR #47672](https://github.com/BerriAI/litellm/pull/47672)
- Make `Router` deployment lookups wait for a concurrent delete, upsert or add, so a shared `Router` no longer raises `IndexError` or returns a neighbouring deployment - [PR #47680](https://github.com/BerriAI/litellm/pull/47680)
- Normalize native Responses latency to seconds per output token, so latency-based routing compares native and bridged deployments in the same unit - [PR #47727](https://github.com/BerriAI/litellm/pull/47727)
- Skip deployments declared `supports_vision: false` for image requests on chat and `/v1/responses` when `enable_pre_call_checks` is on, so mixed groups stop returning provider 400s - [PR #48152](https://github.com/BerriAI/litellm/pull/48152)
- Route `/v1/decisions` calls only to deployments whose provider supports Decisions, so a mixed OpenAI and Bedrock group no longer sends calls to Bedrock and answers 400 - [PR #48175](https://github.com/BerriAI/litellm/pull/48175)
- Add an opt-in router setting that keeps a session on its replacement deployment after a successful failover, instead of staying pinned to the original - [PR #48206](https://github.com/BerriAI/litellm/pull/48206)
- Ignore negative and NaN latency samples in latency-based routing, so one bad sample no longer returns 500 for the whole model group - [PR #48216](https://github.com/BerriAI/litellm/pull/48216)
- Skip deployments declared `supports_vision: false` for image requests on every routing strategy by default, and add `x-litellm-model-id` to chat completion errors - [PR #48241](https://github.com/BerriAI/litellm/pull/48241)
- Keep a model group's tag fail-open opt-in through affinity and cooldown filtering, so Responses API continuations pinned to a deployment without its own flag no longer fail tag authorization - [PR #48470](https://github.com/BerriAI/litellm/pull/48470)
- Stop an exhausted forwarded Claude subscription from putting the shared model into cooldown and blocking other callers - [PR #48485](https://github.com/BerriAI/litellm/pull/48485)
- Serve a team's own wildcard deployment, such as a BYOK `openrouter/*`, before a proxy-wide wildcard of the same pattern, so team credentials are used and spend stops landing on the shared key - [PR #48490](https://github.com/BerriAI/litellm/pull/48490)
- Keep the held `user_turn` route for Codex compaction requests, so a synthetic summarize turn no longer re-runs the classifier and moves the session to another model - [PR #48627](https://github.com/BerriAI/litellm/pull/48627)
- Add an opt-in Respect caller budget mode to complexity routing that keeps a caller's smaller output limit instead of the routed model's ceiling, through rerouting and cache-aware cost estimates - [PR #48632](https://github.com/BerriAI/litellm/pull/48632)
- Keep a lone deployment with no fallback in rotation under router `allowed_fails`, so calls reach the provider instead of answering 429 "No deployments available" for `cooldown_time` - [PR #48644](https://github.com/BerriAI/litellm/pull/48644)
- Keep session tier pins coherent across proxy workers, so identical tool continuations keep the latest session tier when requests move between workers - [PR #48645](https://github.com/BerriAI/litellm/pull/48645)
- Give child agents their own tier pin in `user_turn` mode, so a child's new ask no longer replaces the parent's tier - [PR #48701](https://github.com/BerriAI/litellm/pull/48701)
- Resolve environment-backed credentials and URLs in JEV auto router connections instead of silently falling back to heuristic routing, and require proxy-admin privileges for new references - [PR #48717](https://github.com/BerriAI/litellm/pull/48717)
- Remove the deployment `rpm` filter from `enable_pre_call_checks`, so `rpm` and `tpm` are routing weights unless `enforce_model_rate_limits` is set - [PR #48873](https://github.com/BerriAI/litellm/pull/48873)
- Cool down failing deployments again when `fallbacks` or `default_fallbacks` use string targets, instead of silently skipping the cooldown - [PR #48913](https://github.com/BerriAI/litellm/pull/48913)
- Reject a bare string fallback target such as `fallbacks: [{gpt-4: gpt-3.5}]` or `default_fallbacks: gpt-3.5` at `Router` init with a `TypeError` showing the list form, instead of silently never routing to it - [PR #48943](https://github.com/BerriAI/litellm/pull/48943)
- Infer route names for custom Python classifiers from their tier-to-model mapping, and respect plan-mode floors when the default-model fallback runs for those names - [PR #48987](https://github.com/BerriAI/litellm/pull/48987)
- Read stored router settings from the database on `POST /fallback` and `DELETE /fallback/{model}`, so a stale cache no longer drops an earlier fallback rule and config-file settings stop being copied into the stored row - [PR #48999](https://github.com/BerriAI/litellm/pull/48999)
- Try the configured context window fallback when a streamed request hits a context window error before any output reaches the client, instead of returning the error - [PR #49293](https://github.com/BerriAI/litellm/pull/49293)
- Budget the full Decisions classifier request against the provider's input limits and trim oversized input head and tail, instead of silently falling back to heuristic routing, and record the trimming and fallback reason - [PR #49306](https://github.com/BerriAI/litellm/pull/49306)
- Stop routed moderation and embedding requests from failing with a 500 during image detection, and let malformed Messages requests reach the provider's existing 400 - [PR #49371](https://github.com/BerriAI/litellm/pull/49371)

### Caching, database and runtime

- Keep streamed `/v1/responses` and WebSocket logging tasks alive and wait up to 5 seconds for them on shutdown, so a restart no longer drops a log your callback was still writing - [PR #31074](https://github.com/BerriAI/litellm/pull/31074)
- Replay reasoning, citations and audio on streamed cache hits, and send reasoning, then text, then tool calls like a live stream - [PR #32096](https://github.com/BerriAI/litellm/pull/32096)
- Resync proxy configuration right after a Redis subscription reconnects, so workers no longer stay stale until the next poll - [PR #43313](https://github.com/BerriAI/litellm/pull/43313)
- Load LiteLLM inside each spawned worker after uvicorn's ping thread starts, so multi-worker proxies on slow hosts no longer crash-loop on `Child process died` - [PR #45039](https://github.com/BerriAI/litellm/pull/45039)
- Remove a discarded Router's strategy selectors and pre-call checks from the global callback lists, so later requests no longer copy handlers from routers that are gone - [PR #45795](https://github.com/BerriAI/litellm/pull/45795)
- Queue Redis budget increments only when a Redis cache is configured, so Redis-less pods stop growing memory by about 185 bytes per budgeted request - [PR #46831](https://github.com/BerriAI/litellm/pull/46831)
- Hand the event loop back every 50 ms while streaming buffered responses, so one long stream no longer stalls other requests on the worker for up to 0.6 s - [PR #46925](https://github.com/BerriAI/litellm/pull/46925)
- Send OpenAI chat completions through `client.post` so the SDK's per-message param walk stops holding the event loop, about 300 ms at 1M tokens - [PR #46967](https://github.com/BerriAI/litellm/pull/46967)
- Cut per-chunk pydantic round trips on OpenAI-compatible streams by building each plain chunk's delta once - [PR #47030](https://github.com/BerriAI/litellm/pull/47030)
- Fall back to the bundled cost map when `LITELLM_MODEL_COST_MAP_URL` is not a parseable URL, instead of crashing `import litellm` and proxy boot with `ValueError` - [PR #47133](https://github.com/BerriAI/litellm/pull/47133)
- Run `gc.freeze()` once the proxy is up, so gen-2 garbage collection passes stop re-walking startup objects and pausing every in-flight request for 0.6 to 0.8 s - [PR #47137](https://github.com/BerriAI/litellm/pull/47137)
- Resolve Bedrock AWS region and secret lookups off the event loop on `/v1/messages`, `/v1/responses`, files, batches, vector stores and realtime, so a remote Vault no longer stalls other requests on the worker - [PR #47331](https://github.com/BerriAI/litellm/pull/47331)
- Build the OpenAPI schema on a worker thread and reuse the rendered body, so a cold `/openapi.json` no longer stalls health checks and admin calls on the worker for about 6 s - [PR #47352](https://github.com/BerriAI/litellm/pull/47352)
- Remember a failed HuggingFace tokenizer download for 5 minutes, so llama-3, llama-2 and cohere token counts stop retrying it and adding about 23s to each request - [PR #47586](https://github.com/BerriAI/litellm/pull/47586)
- Forward `dispatched_call_type` in the proxy failure handler, so a bad key, failed custom auth or provider error returns its real 401, 4xx or 5xx instead of a generic `TypeError` - [PR #47815](https://github.com/BerriAI/litellm/pull/47815)
- Buffer tool discoveries in Redis and write `LiteLLM_ToolTable` in one statement per drain on its own lock, so `call_count` counts real tool calls instead of flush cycles - [PR #48089](https://github.com/BerriAI/litellm/pull/48089)
- Remove the disk cache backend and the `diskcache` dependency, so a `cache_params.type: disk` config stops at startup with an error listing the supported cache types - [PR #48114](https://github.com/BerriAI/litellm/pull/48114)
- Check pending migrations against existing rows before the first one runs and refuse with a named report, and add `litellm --check_migrations_against_existing_data` to run the same checks without applying anything - [PR #48493](https://github.com/BerriAI/litellm/pull/48493)
- Abort a request with a 499 when the client disconnects during the body upload, instead of treating the body as `{}` and logging a missing `messages` failure - [PR #48640](https://github.com/BerriAI/litellm/pull/48640)
- Close the aiohttp session of an evicted OpenAI or Azure SDK client when the client is garbage collected, so aiohttp stops logging `Unclosed client session` - [PR #48650](https://github.com/BerriAI/litellm/pull/48650)
- Require the compiled `_native` extension at `import litellm`, so a broken install fails at import instead of running with fork safety and exception mapping off - [PR #48852](https://github.com/BerriAI/litellm/pull/48852)
- Key cached async clients by a per-loop token instead of `id(loop)`, so a new event loop no longer gets a collected loop's client - [PR #48877](https://github.com/BerriAI/litellm/pull/48877)
- Size btree entries by the bytes Postgres stores in the pre-migration index check, so a repetitive `api_key` over 2704 bytes no longer blocks startup - [PR #48911](https://github.com/BerriAI/litellm/pull/48911)
- Read the response cache key's `model_group` and `caching_groups` from the router's metadata for the call instead of the caller's `metadata`, so a request can no longer fill another model group's cache entry - [PR #48917](https://github.com/BerriAI/litellm/pull/48917)
- Keep the aiohttp session open until a response stream finishes reading, so a client dropped mid-stream no longer ends it with `httpx.ReadError: Connection closed` - [PR #48920](https://github.com/BerriAI/litellm/pull/48920)
- Stop counting rows at boot before pending migrations and make `litellm --check_migrations_against_existing_data` a rolled-back dry run of each pending migration that reports Postgres's own error or the time taken - [PR #48961](https://github.com/BerriAI/litellm/pull/48961)
- Stop raising and catching about a dozen AttributeErrors in pydantic on every plain OpenAI or Azure streamed chunk, cutting proxy CPU per chunk by about 5% on Azure streams - [PR #49166](https://github.com/BerriAI/litellm/pull/49166)
- Skip the base64 image scan on log message text that has no data URI markers and copy small payloads inline, so requests without images spend less time in logging - [PR #49228](https://github.com/BerriAI/litellm/pull/49228)
- Read the priority scheduler's shared queue from Redis on each poll, so an expired dead-replica entry stops blocking waiters until they time out with a 408 - [PR #49387](https://github.com/BerriAI/litellm/pull/49387)
- Warn with the destination, wait time and connector limits when an aiohttp request queues for a connection slot, so a pool timeout is distinguishable from a slow upstream - [PR #49499](https://github.com/BerriAI/litellm/pull/49499)

### Docker and Helm

- Stop the `litellm-helm` chart from adding placeholder `gpt-3.5-turbo` and `fake-openai-endpoint` models by default, so DB-managed installs no longer list fake models or get 401s on a same-named model - [PR #47056](https://github.com/BerriAI/litellm/pull/47056)
- Route extra ingress paths to custom Services in the Helm chart, with explicit Service names and numeric or named ports, while keeping component aliases and the built-in routes - [PR #48674](https://github.com/BerriAI/litellm/pull/48674)
- Stop bundling Lens in the `helm/litellm` and `helm/litellm-helm` charts and connect to a separately deployed Lens through a connection-only `lens:` block, off by default - [PR #49169](https://github.com/BerriAI/litellm/pull/49169)

### Dependency updates

- Bump aiohttp from 3.14.3 to 3.14.5 and yarl from 1.23.0 to 1.25.1 in the lock file - [PR #47369](https://github.com/BerriAI/litellm/pull/47369)
- Require `anyio>=4.14.0,<5.0` so installs no longer keep an older anyio that can hang the next caller on a lock nobody holds - [PR #47378](https://github.com/BerriAI/litellm/pull/47378)
- Allow installing LiteLLM on Python 3.15 - [PR #48359](https://github.com/BerriAI/litellm/pull/48359)
- Allow `filelock` 4.x in both package manifests, so projects using LiteLLM can install newer filelock releases without a dependency conflict - [PR #49137](https://github.com/BerriAI/litellm/pull/49137)
- Bump `pyasn1` to 0.6.5 and `pypdf` to 6.21.4 in the proxy image lockfile, and the dev-only `minimatch` to 11.0.2 in the dashboard and VS Code extension - [PR #49362](https://github.com/BerriAI/litellm/pull/49362)

## Documentation Updates

- Clarify which complexity router settings apply to the weighted heuristic and which apply to heuristic v2 - [PR #48666](https://github.com/BerriAI/litellm/pull/48666)
- Link the LiteLLM OSS Champions program from the Contributing section of the README - [PR #48734](https://github.com/BerriAI/litellm/pull/48734)
- Link the README to the Python SDK page and add a collapsible Auto Routing section with Python and gateway examples - [PR #48986](https://github.com/BerriAI/litellm/pull/48986)
- Describe the daily activity guardrail spend fields and the `api_key` filter, including `unattributed` and the `raw:` prefix, in the OpenAPI reference - [PR #49236](https://github.com/BerriAI/litellm/pull/49236)
- Replace stale `docs/proxy/enterprise` links that returned 404 with the current docs pages - [PR #49491](https://github.com/BerriAI/litellm/pull/49491)

## Tests, CI and Internal Changes

These 229 changes touch tests, CI, contributor tooling, refactors, Rust runtime scaffolding that is not yet wired into a user-facing path, or release bookkeeping. They do not change proxy or SDK behavior on their own. Changes listed as commits have no public PR


<details>
<summary>Integration and e2e tests (94)</summary>

- Qualify database upgrades with shared 5 RPS traffic in the perf suite - [PR #46802](https://github.com/BerriAI/litellm/pull/46802)
- Add Sonnet 5.5 and Gemini Vertex AI rows to the cross-model mid tier translation tests - [PR #46896](https://github.com/BerriAI/litellm/pull/46896)
- Remove the BUG skip from an integration test that passes on main - [PR #46937](https://github.com/BerriAI/litellm/pull/46937)
- Cap every awaited Postgres statement at 0.5 calls per request in the perf cases - [PR #46944](https://github.com/BerriAI/litellm/pull/46944)
- Measure SpendLog-backed Admin UI query latency in the perf suite - [PR #46955](https://github.com/BerriAI/litellm/pull/46955)
- Cap every background Postgres statement at 0.9 calls per request in the perf cases - [PR #46957](https://github.com/BerriAI/litellm/pull/46957)
- Fail the event_loop_stalls perf case on a gateway event-loop hold over 100 ms that is not allowlisted - [PR #46974](https://github.com/BerriAI/litellm/pull/46974)
- Report integration shard test files that collect nothing as pytest collection errors instead of crashing xdist - [PR #47075](https://github.com/BerriAI/litellm/pull/47075)
- Charge each event loop hold to the longest gc pass that fits it in the `event_loop_stalls` e2e case - [PR #47089](https://github.com/BerriAI/litellm/pull/47089)
- Recapture Anthropic Claude translation test bases after the `usage.speed` field - [PR #47116](https://github.com/BerriAI/litellm/pull/47116)
- Recapture Azure AI Claude translation test bases after the `usage.speed` field - [PR #47117](https://github.com/BerriAI/litellm/pull/47117)
- Cap the request handler bucket in the `event_loop_stalls` e2e case at 2 holds - [PR #47128](https://github.com/BerriAI/litellm/pull/47128)
- Allow `speed` in the Anthropic usage contract of the cross-model translation tests - [PR #47130](https://github.com/BerriAI/litellm/pull/47130)
- Add `claude-haiku-5-5` Vertex AI cases to the translation integration tests - [PR #47136](https://github.com/BerriAI/litellm/pull/47136)
- Remove stale BUG skips from 2 integration tests that now pass - [PR #47142](https://github.com/BerriAI/litellm/pull/47142)
- Accept JSON next to text in the e2e `get_text_external` helper so pod log errors read as the Kubernetes Status - [PR #47150](https://github.com/BerriAI/litellm/pull/47150)
- Replace the live MCP OAuth e2e tests with an integration test - [PR #47154](https://github.com/BerriAI/litellm/pull/47154)
- Give each owned integration proxy a private database and Redis by default - [PR #47213](https://github.com/BerriAI/litellm/pull/47213)
- Align the perf read-API cases with the requests the dashboard sends today - [PR #47243](https://github.com/BerriAI/litellm/pull/47243)
- Look up owned cache keys by value and clean up sweep models in integration tests - [PR #47255](https://github.com/BerriAI/litellm/pull/47255)
- Stop `GET /__observations` on the scripted upstream from draining its request log - [PR #47256](https://github.com/BerriAI/litellm/pull/47256)
- Wait for every worker to list a new model in `Scenario.model` on multi-worker owned proxies - [PR #47277](https://github.com/BerriAI/litellm/pull/47277)
- Add Sonnet 5.5 Bedrock Converse and Gemini direct rows to the cross-model translation tests - [PR #47328](https://github.com/BerriAI/litellm/pull/47328)
- Read owned proxy spend and agent rows from the owned proxy's own database in integration tests - [PR #47333](https://github.com/BerriAI/litellm/pull/47333)
- Remove stale BUG skips from 3 integration tests that now pass - [PR #47364](https://github.com/BerriAI/litellm/pull/47364)
- Expect the requested model in streamed Responses events in the arize v2 integration tests - [PR #47407](https://github.com/BerriAI/litellm/pull/47407)
- Read the virtual key from its own `pre` in the Save your Key dialog in the UI e2e specs - [PR #47408](https://github.com/BerriAI/litellm/pull/47408)
- Check SSO sign-in removal with Microsoft sign-in so the integration test needs no public internet access - [PR #47409](https://github.com/BerriAI/litellm/pull/47409)
- Read stream stall spend rows from the proxy that served them in the hosted vLLM wire test - [PR #47410](https://github.com/BerriAI/litellm/pull/47410)
- Wait for every worker to report the websocket session cap in the integration test instead of sleeping - [PR #47412](https://github.com/BerriAI/litellm/pull/47412)
- Compare gateway pods instead of worker pids in the database upgrade perf test, so it stops failing with Gateway workers restarted - [PR #47425](https://github.com/BerriAI/litellm/pull/47425)
- Read the perf memory baseline after a one minute warm-up so light cases stop reporting negative growth - [PR #47455](https://github.com/BerriAI/litellm/pull/47455)
- Read router cooldown failure rows from the proxy that served them in the integration tests - [PR #47457](https://github.com/BerriAI/litellm/pull/47457)
- Gate the gateway overhead header, Redis latency and Postgres load in the perf cases - [PR #47472](https://github.com/BerriAI/litellm/pull/47472)
- Measure Admin UI journey latency in a headless browser on the 1TB SpendLogs restore perf lane - [PR #47486](https://github.com/BerriAI/litellm/pull/47486)
- Set the seven new perf ceilings from 124 lane runs across v1.103.0 to v1.106.0 - [PR #47527](https://github.com/BerriAI/litellm/pull/47527)
- Expect the Exa search envelope's `provider_metadata` in three search integration tests - [PR #47572](https://github.com/BerriAI/litellm/pull/47572)
- Set every perf ceiling to 1.2x the lane median so small regressions turn the lane red - [PR #47590](https://github.com/BerriAI/litellm/pull/47590)
- Build the Mantle count_tokens wire test deployments with `_metadata_deployment` - [PR #47592](https://github.com/BerriAI/litellm/pull/47592)
- Call `_fallback_deployment` in the Mantle count_tokens wire tests to clear three undefined name lint errors - [PR #47593](https://github.com/BerriAI/litellm/pull/47593)
- Remove the BUG skip from the audio transcription input rate billing test, which passes on main - [PR #47603](https://github.com/BerriAI/litellm/pull/47603)
- Lower the small perf case's `postgres_max_background_statement_per_request` ceiling to 0.9 - [PR #47616](https://github.com/BerriAI/litellm/pull/47616)
- Record the data request status per UI journey perf sample and cap each journey with a wall clock budget - [PR #47622](https://github.com/BerriAI/litellm/pull/47622)
- Let the UI journey perf fixture run on a restore upgraded by a released migrations image - [PR #47628](https://github.com/BerriAI/litellm/pull/47628)
- Emit a top-contributors breakdown property for each perf metric - [PR #47632](https://github.com/BerriAI/litellm/pull/47632)
- Tag a UI journey perf sample with its API response instead of a Next.js prefetch under `/ui/` - [PR #47650](https://github.com/BerriAI/litellm/pull/47650)
- Record the row count and size of each table the Admin UI perf journeys query - [PR #47683](https://github.com/BerriAI/litellm/pull/47683)
- Emit the database upgrade run's perf rows and upgrade timings as JUnit properties - [PR #47696](https://github.com/BerriAI/litellm/pull/47696)
- Emit `event_loop_stalls` hold counts as `perf_` JUnit properties - [PR #47706](https://github.com/BerriAI/litellm/pull/47706)
- Allowlist anyio `TaskHandle._run_coro` in the `event_loop_stalls` perf case - [PR #47746](https://github.com/BerriAI/litellm/pull/47746)
- Add direct vs bridge perf cases for chat completions, Responses and Messages at 2 rps - [PR #47752](https://github.com/BerriAI/litellm/pull/47752)
- Emit per-location seconds, offending locations and the longest holds as `event_loop_stalls` breakdowns - [PR #47757](https://github.com/BerriAI/litellm/pull/47757)
- Ramp the perf load cases until the pod stops keeping up and floor `sustained_rps` - [PR #47758](https://github.com/BerriAI/litellm/pull/47758)
- Add an integration test that a team's wildcard deployment serves its keys before a proxy-wide wildcard - [PR #48501](https://github.com/BerriAI/litellm/pull/48501)
- Remove four flaky Admin UI e2e checks that pinned implementation details and add a shadcn testing rule - [PR #48663](https://github.com/BerriAI/litellm/pull/48663)
- Add an integration test that cancels a real local sandbox run and checks its child process is gone - [PR #48751](https://github.com/BerriAI/litellm/pull/48751)
- Cover the Gemini default output budget and long decode request bodies with proxy integration tests - [PR #48758](https://github.com/BerriAI/litellm/pull/48758)
- Cover gzip and zstd compressed request bodies with real proxy integration tests - [PR #48766](https://github.com/BerriAI/litellm/pull/48766)
- Cover SageMaker streams that fail after their first chunks with integration tests - [Commit 000d4f6](https://github.com/BerriAI/litellm/commit/000d4f6bb3c8d3cf0e2bb9540a61ccd77ffcd5b9)
- Cover the failure spend row token count of a Responses request with a compaction item - [PR #48774](https://github.com/BerriAI/litellm/pull/48774)
- Cover Decisions malformed replies and returned-version pricing with integration tests - [PR #48777](https://github.com/BerriAI/litellm/pull/48777)
- Cover replayed Claude thinking blocks on Anthropic, Bedrock, Vertex AI and Azure AI routes with integration tests - [PR #48782](https://github.com/BerriAI/litellm/pull/48782)
- Cover baggage tag mappings on pass-through routes and UI saves with integration tests - [PR #48784](https://github.com/BerriAI/litellm/pull/48784)
- Cover token estimation for a DeepSeek V4 stream with no usage block in a spend row test - [Commit 6ba77b7](https://github.com/BerriAI/litellm/commit/6ba77b7013666c5b16ddc369c88f926b6318f486)
- Cover the shared api_base URL join on Azure, Vertex and Bedrock with integration tests - [PR #48786](https://github.com/BerriAI/litellm/pull/48786)
- Cover per-model budgets for background responses with an integration test - [PR #48787](https://github.com/BerriAI/litellm/pull/48787)
- Cover file id access checks for `s3://` and `gs://` ids with integration tests - [PR #48788](https://github.com/BerriAI/litellm/pull/48788)
- Cover SCIM group delete and concurrent team delete with integration tests - [PR #48791](https://github.com/BerriAI/litellm/pull/48791)
- Cover batch routing and endpoint listing on mixed model groups with integration tests - [PR #48792](https://github.com/BerriAI/litellm/pull/48792)
- Cover `silent_model` shadow traffic through the proxy and SDK with integration tests - [PR #48794](https://github.com/BerriAI/litellm/pull/48794)
- Cover the priority queue route with streaming, refusal and error integration tests - [PR #48799](https://github.com/BerriAI/litellm/pull/48799)
- Cover remembered HuggingFace tokenizer download failures with a real proxy test - [PR #48800](https://github.com/BerriAI/litellm/pull/48800)
- Cover the Nvidia Riva provider with integration tests against an owned gRPC server - [PR #48801](https://github.com/BerriAI/litellm/pull/48801)
- Cover Anthropic `json_schema` edge cases with integration tests - [PR #48803](https://github.com/BerriAI/litellm/pull/48803)
- Cover cold `/openapi.json` builds with real proxy integration tests - [PR #48804](https://github.com/BerriAI/litellm/pull/48804)
- Cover MCP auto-execute billing when the follow-up call fails on every retry with an integration test - [PR #48821](https://github.com/BerriAI/litellm/pull/48821)
- Cover every web source for a grounded Gemini passage with unit and wire tests - [PR #48861](https://github.com/BerriAI/litellm/pull/48861)
- Cover the Cloudflare Clairic extraction endpoint with real proxy integration tests - [PR #48898](https://github.com/BerriAI/litellm/pull/48898)
- Cover streamed Responses MCP auto-execute billing with integration tests - [PR #48902](https://github.com/BerriAI/litellm/pull/48902)
- Cover `reasoning_effort_levels` rounding across routes with integration tests - [PR #48910](https://github.com/BerriAI/litellm/pull/48910)
- Add integration tests for the global proxy spend counter and key budget enforcement - [PR #48918](https://github.com/BerriAI/litellm/pull/48918)
- Add integration cells for background response billing sent to the creator's Langfuse project - [PR #48919](https://github.com/BerriAI/litellm/pull/48919)
- Set string fallback targets after Router init in the SDK cooldown integration cases - [PR #48954](https://github.com/BerriAI/litellm/pull/48954)
- Scope the signoz, otel conversation id and series cap proxy fixtures to their module in integration tests - [Commit 42d2909](https://github.com/BerriAI/litellm/commit/42d29092105f3f1b618a2375e15743a703b3d077)
- Update 149 integration tests left stale by recent product changes - [PR #49143](https://github.com/BerriAI/litellm/pull/49143)
- Cover Bedrock Claude prompt caching on `/v1/messages` with an integration test - [PR #49265](https://github.com/BerriAI/litellm/pull/49265)
- Fix integration tests that failed on test order, races and intentionally changed behavior - [PR #49310](https://github.com/BerriAI/litellm/pull/49310)
- Update the Databricks auto-router integration test for the classifier budget fields - [PR #49382](https://github.com/BerriAI/litellm/pull/49382)
- Cancel disconnected HTTP tool handlers in the MCP integration test peers - [PR #49436](https://github.com/BerriAI/litellm/pull/49436)
- Trace the deployment index lock in the file that owns it in the router concurrency integration test - [PR #49520](https://github.com/BerriAI/litellm/pull/49520)
- Expect the EOF error frame when an Anthropic `json_schema` stream is cut in the translation integration test - [PR #49521](https://github.com/BerriAI/litellm/pull/49521)
- Move the Sail, Weave and Presidio e2e tests to integration tests - [PR #49533](https://github.com/BerriAI/litellm/pull/49533)
- Drop the unused `arize_phoenix` callback from the e2e stage mirror config - [PR #49538](https://github.com/BerriAI/litellm/pull/49538)
- Replace the third-party agent A2A e2e test with an integration test against a scripted agent - [PR #49541](https://github.com/BerriAI/litellm/pull/49541)

</details>

<details>
<summary>Rust core (35)</summary>

- Add a parity test that runs native and Python Responses calls and compares them - [PR #46567](https://github.com/BerriAI/litellm/pull/46567)
- Add a Rust codec for LiteLLM response ids used by native Responses - [PR #46572](https://github.com/BerriAI/litellm/pull/46572)
- Detect Python-only features in the Rust bridge catalog instead of ad hoc Rust declines - [PR #46714](https://github.com/BerriAI/litellm/pull/46714)
- Decide native routing in the Rust bridge catalog and drop the old routing predicates - [PR #46750](https://github.com/BerriAI/litellm/pull/46750)
- Move dispatch tests into the Rust test suite and update the Rust workflow path filters - [PR #46926](https://github.com/BerriAI/litellm/pull/46926)
- Fold the `inference-transcription` prepare stage into its handler - [PR #47214](https://github.com/BerriAI/litellm/pull/47214)
- Fold the `inference-responses` prepare stage into its handler - [PR #47215](https://github.com/BerriAI/litellm/pull/47215)
- Fold the `inference-ocr` prepare stage into its handler - [PR #47216](https://github.com/BerriAI/litellm/pull/47216)
- Fold the `inference-messages` prepare stage into its handler - [PR #47217](https://github.com/BerriAI/litellm/pull/47217)
- Fold the `inference-chat` prepare stage into its handler - [PR #47218](https://github.com/BerriAI/litellm/pull/47218)
- Rename the Rust inference crate's `RouteError` to `Error` - [PR #47771](https://github.com/BerriAI/litellm/pull/47771)
- Carry one typed decline from Rust core to each host, so declined SDK calls fall back to Python - [PR #47772](https://github.com/BerriAI/litellm/pull/47772)
- Honor SSL verification, CA bundles, client certificates and proxies for Rust WebSocket connections - [PR #47968](https://github.com/BerriAI/litellm/pull/47968)
- Upgrade Rust reqwest to 0.13 and give MCP a client from the shared outbound pool - [PR #48039](https://github.com/BerriAI/litellm/pull/48039)
- Build Rust outbound requests as plain `reqwest::Request` - [PR #48041](https://github.com/BerriAI/litellm/pull/48041)
- Adopt one error discipline across litellm-rust with source chains and a shared `Report` - [PR #48042](https://github.com/BerriAI/litellm/pull/48042)
- Add typed `find_end_user` database query foundation to the Rust db crate - [PR #48214](https://github.com/BerriAI/litellm/pull/48214)
- Add typed key spend update query to the Rust db crate - [PR #48217](https://github.com/BerriAI/litellm/pull/48217)
- Add typed user spend update query to the Rust db crate - [PR #48229](https://github.com/BerriAI/litellm/pull/48229)
- Add typed team spend update query to the Rust db crate - [PR #48230](https://github.com/BerriAI/litellm/pull/48230)
- Add typed end-user spend upsert query to the Rust db crate - [PR #48231](https://github.com/BerriAI/litellm/pull/48231)
- Add transaction-scoped team lock query to the Rust db crate - [PR #48232](https://github.com/BerriAI/litellm/pull/48232)
- Add typed team-member spend upsert query to the Rust db crate - [PR #48233](https://github.com/BerriAI/litellm/pull/48233)
- Add typed spend-log insert query to the Rust db crate - [PR #48234](https://github.com/BerriAI/litellm/pull/48234)
- Add typed daily user spend upsert query to the Rust db crate - [PR #48235](https://github.com/BerriAI/litellm/pull/48235)
- Add typed daily team spend upsert query to the Rust db crate - [PR #48236](https://github.com/BerriAI/litellm/pull/48236)
- Add typed daily end-user spend upsert query to the Rust db crate - [PR #48237](https://github.com/BerriAI/litellm/pull/48237)
- Add the standalone Redis client and Redis test fixture crates to the Rust workspace - [PR #48269](https://github.com/BerriAI/litellm/pull/48269)
- Support Redis Cluster in the Rust Redis client - [PR #48271](https://github.com/BerriAI/litellm/pull/48271)
- Run Lua scripts and pipelines with per-op errors in the Rust Redis client - [PR #48273](https://github.com/BerriAI/litellm/pull/48273)
- Add a circuit breaker crate and guard the Rust Redis client with it - [PR #48277](https://github.com/BerriAI/litellm/pull/48277)
- Build Rust gateway Redis clients from config.yaml and environment settings - [PR #48284](https://github.com/BerriAI/litellm/pull/48284)
- Add a Rust model catalog that parses, lowers and validates the cost map into typed prices - [PR #48853](https://github.com/BerriAI/litellm/pull/48853)
- Ship the cost map inside the native extension - [PR #48907](https://github.com/BerriAI/litellm/pull/48907)
- Extract `SecretValue` into its own crate and wrap Redis credentials with it - [PR #49186](https://github.com/BerriAI/litellm/pull/49186)

</details>

<details>
<summary>CI and release tooling (26)</summary>

- Cache the Rust extension build in its own Docker stage so Python-only changes skip the recompile - [PR #47033](https://github.com/BerriAI/litellm/pull/47033)
- Delete the model prices JSON schema file and its cost map guard allowance - [PR #47079](https://github.com/BerriAI/litellm/pull/47079)
- Bump litellm-enterprise to 0.1.78 and litellm-proxy-extras to 0.4.110 - [PR #47228](https://github.com/BerriAI/litellm/pull/47228)
- Keep the MCP SDK1 peer on mcp 1.x and turn autovacuum off for the size cleanup test tables in CI - [PR #47651](https://github.com/BerriAI/litellm/pull/47651)
- Bump litellm to 1.108.0, litellm-enterprise to 0.1.79 and litellm-proxy-extras to 0.4.111 - [PR #47668](https://github.com/BerriAI/litellm/pull/47668)
- Bump langgraph and tornado and add dated scan ignores to clear osv-scan and image-scan - [PR #48302](https://github.com/BerriAI/litellm/pull/48302)
- Remove expired boto3, botocore and grpcio release cutoffs from the uv config - [PR #48447](https://github.com/BerriAI/litellm/pull/48447)
- Drop expired certifi, mlflow and pypdf release cutoffs from the uv config - [PR #48461](https://github.com/BerriAI/litellm/pull/48461)
- Remove the Together AI and weekly cost map sync workflows, their scripts and tests - [PR #48473](https://github.com/BerriAI/litellm/pull/48473)
- Add a Spend logs guard CI check that needs owner approval on `LiteLLM_SpendLogs` schema and migration changes - [PR #48518](https://github.com/BerriAI/litellm/pull/48518)
- Bump `litellm` to 1.109.0 and `litellm-enterprise` to 0.1.80 on main - [PR #48673](https://github.com/BerriAI/litellm/pull/48673)
- Run the spend-logs and cost-map guard checks without installing the litellm project, cutting each from minutes to seconds - [PR #48683](https://github.com/BerriAI/litellm/pull/48683)
- Rebuild the committed Admin UI bundle from current main for 1.109.0 - [PR #48692](https://github.com/BerriAI/litellm/pull/48692)
- Keep the spend logs guard approval through a later COMMENTED review - [PR #48901](https://github.com/BerriAI/litellm/pull/48901)
- Require the spend logs guard approval to cover the head's spend-log lines - [PR #48904](https://github.com/BerriAI/litellm/pull/48904)
- Flag any schema.prisma change inside model LiteLLM_SpendLogs in the spend logs guard - [PR #48905](https://github.com/BerriAI/litellm/pull/48905)
- Check the cost map in CI by loading it through the Rust model catalog - [PR #48908](https://github.com/BerriAI/litellm/pull/48908)
- Run the spend logs guard only on pull_request_target events and re-run it by hand after approval - [PR #48941](https://github.com/BerriAI/litellm/pull/48941)
- Run zizmor with `--no-ignores` and move the spend logs and cost map guards to the pull_request trigger - [PR #48947](https://github.com/BerriAI/litellm/pull/48947)
- Run the dashboard API types and Terraform endpoint checks on every change that can alter the OpenAPI spec - [PR #49022](https://github.com/BerriAI/litellm/pull/49022)
- Measure the lint, unit test and guard PR checks from the target branch's current tip instead of a stale `base.sha` - [PR #49078](https://github.com/BerriAI/litellm/pull/49078)
- Cache Rust compilation in CI with sccache - [PR #49117](https://github.com/BerriAI/litellm/pull/49117)
- Build the base checkout's native extension before the OpenAPI docs gate imports its proxy - [PR #49136](https://github.com/BerriAI/litellm/pull/49136)
- Bump litellm-enterprise to 0.1.81 and litellm-proxy-extras to 0.4.112 - [PR #49149](https://github.com/BerriAI/litellm/pull/49149)
- Clone the public repo over HTTPS in CircleCI jobs so main jobs stop failing at checkout - [PR #49394](https://github.com/BerriAI/litellm/pull/49394)
- Cut the weekly rc branch on Monday 3am PT instead of Friday - [PR #49472](https://github.com/BerriAI/litellm/pull/49472)

</details>

<details>
<summary>Refactors and typing (25)</summary>

- Replace `Any` with proven types in 6 files - [PR #47268](https://github.com/BerriAI/litellm/pull/47268)
- Replace `Any` with proven types in 15 files and validate untyped JSON with strict pydantic adapters - [PR #47509](https://github.com/BerriAI/litellm/pull/47509)
- Clear 1181 basedpyright `Any` errors across 431 files - [PR #47789](https://github.com/BerriAI/litellm/pull/47789)
- Replace `Any` with proven types in 50 files - [PR #47818](https://github.com/BerriAI/litellm/pull/47818)
- Widen `delete_nested_value` to `Mapping` and drop two unused `Span` aliases - [PR #48001](https://github.com/BerriAI/litellm/pull/48001)
- Give the proxy one lifespan owner for database connections and background work, closed on failed startup and shutdown - [PR #48506](https://github.com/BerriAI/litellm/pull/48506)
- Inject database repositories through per-repository dependencies, starting with the banner routes - [PR #48507](https://github.com/BerriAI/litellm/pull/48507)
- Rename model-version transformation files to family names without changing class or function names - [PR #48509](https://github.com/BerriAI/litellm/pull/48509)
- Rename `llms/anthropic/pass_through` to `llms/anthropic/messages` and keep import shims for the old paths - [PR #48510](https://github.com/BerriAI/litellm/pull/48510)
- Move the MCP server and client out of experimental paths and keep deprecated shims for the old imports - [PR #48513](https://github.com/BerriAI/litellm/pull/48513)
- Inject deployment warning snooze storage through its own repository dependency - [PR #48592](https://github.com/BerriAI/litellm/pull/48592)
- Drop the spend-log `api_key` special case from the pre-migration row check remedy - [PR #48636](https://github.com/BerriAI/litellm/pull/48636)
- Fence the `Router` surface and document the router-core boundary - [PR #48839](https://github.com/BerriAI/litellm/pull/48839)
- Add router entry points and keep the old members as a deprecated mixin - [PR #48840](https://github.com/BerriAI/litellm/pull/48840)
- Move router callers onto the entry points and invert the proxy imports - [PR #48847](https://github.com/BerriAI/litellm/pull/48847)
- Replace `Any` with proven types in 28 files - [Commit f89b9c6](https://github.com/BerriAI/litellm/commit/f89b9c61504801fcc99e40e37af532bb38bbfa30)
- Replace `Any` with proven types in 21 files - [PR #48921](https://github.com/BerriAI/litellm/pull/48921)
- Replace `Any` with proven types in 14 files across caching, proxy routes, integrations and types - [PR #48928](https://github.com/BerriAI/litellm/pull/48928)
- Inject gateway activity through a typed repository instead of the global Prisma client - [PR #49116](https://github.com/BerriAI/litellm/pull/49116)
- Route the router family through `RoutingContext` and close the surface used outside the router - [PR #49118](https://github.com/BerriAI/litellm/pull/49118)
- Extract `PythonCore` behind `RouterCore` and pass the router its config - [PR #49119](https://github.com/BerriAI/litellm/pull/49119)
- Add i18next plumbing to the Admin UI and move the Workflows page onto it with no visible change - [PR #49144](https://github.com/BerriAI/litellm/pull/49144)
- Move the Policies, Tool Policies and Guardrails Monitor page text onto i18n messages with no change on screen - [PR #49343](https://github.com/BerriAI/litellm/pull/49343)
- Restore four router helper behaviors the RoutingContext refactor changed for direct callers - [PR #49395](https://github.com/BerriAI/litellm/pull/49395)
- Remove 17 unused API calls from `networking.tsx` in the Admin UI - [PR #49507](https://github.com/BerriAI/litellm/pull/49507)

</details>

<details>
<summary>Unit tests (16)</summary>

- Cover streams stuck on one repeated chunk with tests for early close and a single failure log - [PR #38753](https://github.com/BerriAI/litellm/pull/38753)
- Bound peak allocation in the streaming JSON drain test instead of a timing ratio - [PR #43370](https://github.com/BerriAI/litellm/pull/43370)
- Keep foreign asyncio task noise out of the budget limiter log capture tests - [PR #43375](https://github.com/BerriAI/litellm/pull/43375)
- Pin that `api_version` never reaches the OpenAI client on fine-tuning calls - [PR #44995](https://github.com/BerriAI/litellm/pull/44995)
- Keep unix socket paths in unit tests under the macOS AF_UNIX limit - [PR #45040](https://github.com/BerriAI/litellm/pull/45040)
- Annotate the Baseten unit test locals with `Final` - [PR #47205](https://github.com/BerriAI/litellm/pull/47205)
- Add unit cases that fail when the validation checks added in an earlier change are weakened - [PR #47420](https://github.com/BerriAI/litellm/pull/47420)
- Stop the image edit unit tests from writing response images to disk - [PR #47463](https://github.com/BerriAI/litellm/pull/47463)
- Isolate model cost maps in runtime registration unit tests and restore them after each test - [PR #47559](https://github.com/BerriAI/litellm/pull/47559)
- Add the Sonnet 5.5 Anthropic direct row to the cross-model translation tests - [PR #47566](https://github.com/BerriAI/litellm/pull/47566)
- Remove the two-second timing dependency from the Bedrock Vault lookup regression tests - [PR #47597](https://github.com/BerriAI/litellm/pull/47597)
- Pin the `max_parallel_requests` slot release after a streamed `/v1/messages` MCP auto-execute - [PR #47788](https://github.com/BerriAI/litellm/pull/47788)
- Read the Interactions spec from a vendored snapshot and canary the live one daily - [PR #48002](https://github.com/BerriAI/litellm/pull/48002)
- Make the custom tokenizer offload test check the loader thread instead of relying on timing - [PR #48458](https://github.com/BerriAI/litellm/pull/48458)
- Fix the six OTel Langfuse destination tests by building the provider with `console_default=True` - [PR #49129](https://github.com/BerriAI/litellm/pull/49129)
- Deflake the JSON accumulator drain test and the armed routing prefetch test - [PR #49505](https://github.com/BerriAI/litellm/pull/49505)

</details>

<details>
<summary>Contributor tooling (14)</summary>

- Add ADRs for the Python SDK and proxy and a provider section in `CONTRIBUTING.md` - [PR #36668](https://github.com/BerriAI/litellm/pull/36668)
- Drop the Conventional Branches pre-push hook in favor of the `litellm_` branch prefix - [PR #44951](https://github.com/BerriAI/litellm/pull/44951)
- Keep directory rules in nested `AGENTS.md` and state that CircleCI owns `tests/integration` - [PR #46796](https://github.com/BerriAI/litellm/pull/46796)
- Add a code owner for `helm/` and `terraform/` in `.github/CODEOWNERS` - [PR #47452](https://github.com/BerriAI/litellm/pull/47452)
- Lead the PR template with a short plain description and collapse the other sections - [PR #47594](https://github.com/BerriAI/litellm/pull/47594)
- Clarify the unit test clock rule to allow incidental production clock reads - [PR #47604](https://github.com/BerriAI/litellm/pull/47604)
- Remove the Description heading from the PR template - [PR #47631](https://github.com/BerriAI/litellm/pull/47631)
- Add a code owner for the model cost map files - [PR #48101](https://github.com/BerriAI/litellm/pull/48101)
- Add Google-convention docstring rules to the strict ruff gate - [PR #48245](https://github.com/BerriAI/litellm/pull/48245)
- Document the incremental database access migration in a repository agent skill - [PR #48476](https://github.com/BerriAI/litellm/pull/48476)
- Allow focused proof instead of live e2e testing for mechanical PRs in the PR template and AGENTS.md - [PR #49031](https://github.com/BerriAI/litellm/pull/49031)
- Explain meter, band, channel and When in the Rust model catalog docs - [PR #49447](https://github.com/BerriAI/litellm/pull/49447)
- Add a handwritten 1-3 sentence description section to the PR template - [PR #49475](https://github.com/BerriAI/litellm/pull/49475)
- Wrap the agent-drafted PR summary placeholder in `<make-me-human-readable>` tags in the PR template - [PR #49494](https://github.com/BerriAI/litellm/pull/49494)

</details>

<details>
<summary>Other internal (11)</summary>

- Rewrite the stale `completion_cost` docstring and fix a typo in its unmapped-model error - [PR #47022](https://github.com/BerriAI/litellm/pull/47022)
- Add the spend log storage probe and reclaimable-bytes count that later size-based cleanup builds on, with no callers yet - [PR #47449](https://github.com/BerriAI/litellm/pull/47449)
- Rename the lowercase policy file to the conventional upper case name that OSS tooling looks for, and use the project contact address - [PR #47581](https://github.com/BerriAI/litellm/pull/47581)
- Bump `vite` from 8.3.0 to 8.3.4 in `vscode-extension`, which only the test runner uses - [PR #47627](https://github.com/BerriAI/litellm/pull/47627)
- Recognize the development preview workspace in the Chat view switcher - [Commit f6b2086](https://github.com/BerriAI/litellm/commit/f6b20865020026612e05fb51ba8e993fc91d9486)
- Add accounting contracts, pricing snapshots and two ledger tables, not yet used by the proxy - [PR #48862](https://github.com/BerriAI/litellm/pull/48862)
- Add a durable accounting event ledger writer that commits events with their pending deliveries - [PR #48883](https://github.com/BerriAI/litellm/pull/48883)
- Call the renamed `drops_params` helper on the OpenAI Responses compact path - [PR #49030](https://github.com/BerriAI/litellm/pull/49030)
- Add bounded transactional persistence for durable usage capture - [PR #49190](https://github.com/BerriAI/litellm/pull/49190)
- Let the WebSocket pass-through relay bill a session from client text through an optional meter - [PR #49281](https://github.com/BerriAI/litellm/pull/49281)
- Remove the wrong 10 minutes comment on `DEFAULT_A2A_AGENT_TIMEOUT` - [PR #49465](https://github.com/BerriAI/litellm/pull/49465)

</details>

<details>
<summary>Cost calculation tests (8)</summary>

- Cover unpriced provider slugs and explicit zero rates in cost calculation tests - [PR #42467](https://github.com/BerriAI/litellm/pull/42467)
- Add tier 1 cost tracking cases for gpt-5.6-terra, gemini-4-argon and gemini-3.1-pro-preview - [PR #46931](https://github.com/BerriAI/litellm/pull/46931)
- Bill vertex gemini-3.8-flash reasoning tokens at the reasoning price in the cost test suite - [PR #46939](https://github.com/BerriAI/litellm/pull/46939)
- Rekey Vertex Gemini cost cases, add Bedrock Mantle GPT and Claude Opus 5.5 cases, and drop suite-only price fields - [PR #46962](https://github.com/BerriAI/litellm/pull/46962)
- Add tier 1 cost tracking cases and sync stored usage shapes with live replies - [PR #47141](https://github.com/BerriAI/litellm/pull/47141)
- Add Vertex Claude Haiku 5.5 long context cases and GPT and Gemini 3.8 Flash bridge legs to the cost tests - [PR #47342](https://github.com/BerriAI/litellm/pull/47342)
- Run the azure_ai Claude bridge cost pairs and add Anthropic usage speed and Vertex Gemini audio priority price cases - [PR #47582](https://github.com/BerriAI/litellm/pull/47582)
- Expect Cohere rerank-v4 `prompt_tokens` from `billed_units.total_tokens` in the cost integration case - [PR #49455](https://github.com/BerriAI/litellm/pull/49455)

</details>

<details>
<summary>Superseded within this release (2)</summary>

- Keep JSON integers outside the 64-bit range exact in request bodies, including requests that use key or team model aliases, instead of rounding them to floats - [PR #48213](https://github.com/BerriAI/litellm/pull/48213)
- Revert large-integer request parsing, so large JSON integers may round again - [PR #48289](https://github.com/BerriAI/litellm/pull/48289)

</details>

### PR roll-up by ownership area

Customer-facing changes: **701**. Tests, CI and internal changes: **231**. Total: **932**

- Other (tests, CI, internal): 231
- Models & Providers: 185
- LLM API Endpoints: 162
- Spend / Budgets / Rate Limits: 82
- Performance: 77
- UI: 62
- Auth & Management: 52
- Logging & Tracing: 32
- MCP: 23
- Guardrails: 19
- Docs: 5
- Secret Managers: 2

## New Contributors

- [@16niraj](https://github.com/16niraj) made their first contribution in [PR #48662](https://github.com/BerriAI/litellm/pull/48662)
- [@abhishekacharya200](https://github.com/abhishekacharya200) made their first contribution in [PR #45992](https://github.com/BerriAI/litellm/pull/45992)
- [@aidanasingh](https://github.com/aidanasingh) made their first contribution in [PR #32309](https://github.com/BerriAI/litellm/pull/32309)
- [@AJ-ing](https://github.com/AJ-ing) made their first contribution in [PR #41034](https://github.com/BerriAI/litellm/pull/41034)
- [@albertoperdomo2](https://github.com/albertoperdomo2) made their first contribution in [PR #46662](https://github.com/BerriAI/litellm/pull/46662)
- [@algirdasci](https://github.com/algirdasci) made their first contribution in [PR #44863](https://github.com/BerriAI/litellm/pull/44863)
- [@AlonSoko](https://github.com/AlonSoko) made their first contribution in [PR #47123](https://github.com/BerriAI/litellm/pull/47123)
- [@alvcol](https://github.com/alvcol) made their first contribution in [PR #46861](https://github.com/BerriAI/litellm/pull/46861)
- [@amaan-ai20](https://github.com/amaan-ai20) made their first contribution in [PR #43874](https://github.com/BerriAI/litellm/pull/43874)
- [@axelray-dev](https://github.com/axelray-dev) made their first contribution in [PR #44471](https://github.com/BerriAI/litellm/pull/44471)
- [@bap1106](https://github.com/bap1106) made their first contribution in [PR #39324](https://github.com/BerriAI/litellm/pull/39324)
- [@businessarshgoyal](https://github.com/businessarshgoyal) made their first contribution in [PR #38753](https://github.com/BerriAI/litellm/pull/38753)
- [@david-koh](https://github.com/david-koh) made their first contribution in [PR #41565](https://github.com/BerriAI/litellm/pull/41565)
- [@deepanshupal](https://github.com/deepanshupal) made their first contribution in [PR #44199](https://github.com/BerriAI/litellm/pull/44199)
- [@devanshc777](https://github.com/devanshc777) made their first contribution in [PR #47897](https://github.com/BerriAI/litellm/pull/47897)
- [@DewellNaa](https://github.com/DewellNaa) made their first contribution in [PR #48335](https://github.com/BerriAI/litellm/pull/48335)
- [@discobot](https://github.com/discobot) made their first contribution in [PR #30277](https://github.com/BerriAI/litellm/pull/30277)
- [@dkrisman](https://github.com/dkrisman) made their first contribution in [PR #40967](https://github.com/BerriAI/litellm/pull/40967)
- [@eduardopessin](https://github.com/eduardopessin) made their first contribution in [PR #42467](https://github.com/BerriAI/litellm/pull/42467)
- [@edujuan](https://github.com/edujuan) made their first contribution in [PR #46875](https://github.com/BerriAI/litellm/pull/46875)
- [@ekpog200](https://github.com/ekpog200) made their first contribution in [PR #44614](https://github.com/BerriAI/litellm/pull/44614)
- [@fabioAntGit](https://github.com/fabioAntGit) made their first contribution in [PR #45467](https://github.com/BerriAI/litellm/pull/45467)
- [@Gopal3746](https://github.com/Gopal3746) made their first contribution in [PR #45715](https://github.com/BerriAI/litellm/pull/45715)
- [@hamzashah-dev](https://github.com/hamzashah-dev) made their first contribution in [PR #35643](https://github.com/BerriAI/litellm/pull/35643)
- [@HardMax71](https://github.com/HardMax71) made their first contribution in [PR #44185](https://github.com/BerriAI/litellm/pull/44185)
- [@Hazelhof](https://github.com/Hazelhof) made their first contribution in [PR #38736](https://github.com/BerriAI/litellm/pull/38736)
- [@hgnnmnn](https://github.com/hgnnmnn) made their first contribution in [PR #48199](https://github.com/BerriAI/litellm/pull/48199)
- [@igorborgest](https://github.com/igorborgest) made their first contribution in [PR #47848](https://github.com/BerriAI/litellm/pull/47848)
- [@irvallensar](https://github.com/irvallensar) made their first contribution in [PR #44021](https://github.com/BerriAI/litellm/pull/44021)
- [@ishaan-j-berri](https://github.com/ishaan-j-berri) made their first contribution in [PR #48137](https://github.com/BerriAI/litellm/pull/48137)
- [@islomjon-aiand](https://github.com/islomjon-aiand) made their first contribution in [PR #38958](https://github.com/BerriAI/litellm/pull/38958)
- [@jeevan1098](https://github.com/jeevan1098) made their first contribution in [PR #48213](https://github.com/BerriAI/litellm/pull/48213)
- [@jesus-berri](https://github.com/jesus-berri) made their first contribution in [PR #43425](https://github.com/BerriAI/litellm/pull/43425)
- [@jhoblitt](https://github.com/jhoblitt) made their first contribution in [PR #48060](https://github.com/BerriAI/litellm/pull/48060)
- [@jodok](https://github.com/jodok) made their first contribution in [PR #48448](https://github.com/BerriAI/litellm/pull/48448)
- [@jorik](https://github.com/jorik) made their first contribution in [PR #46421](https://github.com/BerriAI/litellm/pull/46421)
- [@joshdabosh](https://github.com/joshdabosh) made their first contribution in [PR #45092](https://github.com/BerriAI/litellm/pull/45092)
- [@justinfx](https://github.com/justinfx) made their first contribution in [PR #44763](https://github.com/BerriAI/litellm/pull/44763)
- [@lets-order-some-fries](https://github.com/lets-order-some-fries) made their first contribution in [PR #36678](https://github.com/BerriAI/litellm/pull/36678)
- [@limdeng](https://github.com/limdeng) made their first contribution in [PR #45567](https://github.com/BerriAI/litellm/pull/45567)
- [@MaximeBOUDIER](https://github.com/MaximeBOUDIER) made their first contribution in [PR #46902](https://github.com/BerriAI/litellm/pull/46902)
- [@mdevhurt1](https://github.com/mdevhurt1) made their first contribution in [PR #39762](https://github.com/BerriAI/litellm/pull/39762)
- [@MFJG-dev](https://github.com/MFJG-dev) made their first contribution in [PR #45961](https://github.com/BerriAI/litellm/pull/45961)
- [@mika-lt](https://github.com/mika-lt) made their first contribution in [PR #48799](https://github.com/BerriAI/litellm/pull/48799)
- [@Mrun25](https://github.com/Mrun25) made their first contribution in [PR #46390](https://github.com/BerriAI/litellm/pull/46390)
- [@ninglinLiu](https://github.com/ninglinLiu) made their first contribution in [PR #46171](https://github.com/BerriAI/litellm/pull/46171)
- [@norkelbyte](https://github.com/norkelbyte) made their first contribution in [PR #48737](https://github.com/BerriAI/litellm/pull/48737)
- [@occ](https://github.com/occ) made their first contribution in [PR #42014](https://github.com/BerriAI/litellm/pull/42014)
- [@ondraz](https://github.com/ondraz) made their first contribution in [PR #46857](https://github.com/BerriAI/litellm/pull/46857)
- [@otiscuilei](https://github.com/otiscuilei) made their first contribution in [PR #32537](https://github.com/BerriAI/litellm/pull/32537)
- [@paveln83](https://github.com/paveln83) made their first contribution in [PR #48803](https://github.com/BerriAI/litellm/pull/48803)
- [@pcbeingused333](https://github.com/pcbeingused333) made their first contribution in [PR #44795](https://github.com/BerriAI/litellm/pull/44795)
- [@pfolex](https://github.com/pfolex) made their first contribution in [PR #48158](https://github.com/BerriAI/litellm/pull/48158)
- [@prassu017](https://github.com/prassu017) made their first contribution in [PR #48417](https://github.com/BerriAI/litellm/pull/48417)
- [@Pyhroff](https://github.com/Pyhroff) made their first contribution in [PR #47091](https://github.com/BerriAI/litellm/pull/47091)
- [@quietjules](https://github.com/quietjules) made their first contribution in [PR #48801](https://github.com/BerriAI/litellm/pull/48801)
- [@roywei](https://github.com/roywei) made their first contribution in [PR #44349](https://github.com/BerriAI/litellm/pull/44349)
- [@selimfedakar](https://github.com/selimfedakar) made their first contribution in [PR #48845](https://github.com/BerriAI/litellm/pull/48845)
- [@setouchi-h](https://github.com/setouchi-h) made their first contribution in [PR #45795](https://github.com/BerriAI/litellm/pull/45795)
- [@sidhunt](https://github.com/sidhunt) made their first contribution in [PR #43290](https://github.com/BerriAI/litellm/pull/43290)
- [@SilverMarcs](https://github.com/SilverMarcs) made their first contribution in [PR #48745](https://github.com/BerriAI/litellm/pull/48745)
- [@simonp9](https://github.com/simonp9) made their first contribution in [PR #48800](https://github.com/BerriAI/litellm/pull/48800)
- [@tavren27](https://github.com/tavren27) made their first contribution in [PR #48725](https://github.com/BerriAI/litellm/pull/48725)
- [@tbartik](https://github.com/tbartik) made their first contribution in [PR #34822](https://github.com/BerriAI/litellm/pull/34822)
- [@TemoSulava](https://github.com/TemoSulava) made their first contribution in [PR #47263](https://github.com/BerriAI/litellm/pull/47263)
- [@tessellark](https://github.com/tessellark) made their first contribution in [PR #48735](https://github.com/BerriAI/litellm/pull/48735)
- [@ucfjoe](https://github.com/ucfjoe) made their first contribution in [PR #40152](https://github.com/BerriAI/litellm/pull/40152)
- [@vanrajsinh650](https://github.com/vanrajsinh650) made their first contribution in [PR #46190](https://github.com/BerriAI/litellm/pull/46190)
- [@vanshsingh3711-wq](https://github.com/vanshsingh3711-wq) made their first contribution in [PR #44551](https://github.com/BerriAI/litellm/pull/44551)
- [@VincentG1234](https://github.com/VincentG1234) made their first contribution in [PR #44574](https://github.com/BerriAI/litellm/pull/44574)
- [@ZHOUKAILIAN](https://github.com/ZHOUKAILIAN) made their first contribution in [PR #41006](https://github.com/BerriAI/litellm/pull/41006)
- [@zoveki](https://github.com/zoveki) made their first contribution in [PR #48734](https://github.com/BerriAI/litellm/pull/48734)
- [@zuraiz-anjum](https://github.com/zuraiz-anjum) made their first contribution in [PR #44230](https://github.com/BerriAI/litellm/pull/44230)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.108.0-rc.1...v1.109.0-rc.1
