---
title: "1.109.0rc1 - 11 New Providers, Kubernetes Pod Routing, Mid-Stream Fallback & Daily Deployment Limits"
slug: "v1-109-0-rc-1"
date: 2026-11-03T16:00:00
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

This release is published as [`ghcr.io/berriai/litellm:v1.109.0-rc.1`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.109.0-rc.1) and the full [releases page](https://github.com/BerriAI/litellm/releases).

The published GitHub tag is `v1.109.0-rc.1`. These notes compare it with [`v1.108.0`](https://github.com/BerriAI/litellm/releases/tag/v1.108.0), the latest stable release. Changes that already shipped in `v1.108.0` are omitted.

Customer-facing changes come first. Test, CI and internal changes are listed at the bottom.

:::danger Breaking Changes

These callouts cover behavior that differs from `v1.108.0`, the latest stable release. If you upgrade from `v1.106.x`, also read the breaking changes in the [1.107.0rc1 notes](/release_notes/v1.107.0rc1/v1-107-0-rc-1), which shipped in `v1.108.0`.

**Streaming responses requested with `stream_options.include_usage` now end with a usage chunk whose `choices` is an empty list, matching OpenAI.** The final chunk used to carry `"choices": [{"index": 0, "delta": {}}]`. Code or a custom `async_post_call_streaming_iterator_hook` that reads `chunk.choices[0]` on every chunk will raise an `IndexError` on that chunk, so check `if chunk.choices:` first, the same as with the OpenAI SDK. Usage that LiteLLM adds on its own, through proxy injection, `always_include_stream_usage` or deployment and router `stream_options`, keeps the previous shape. See [PR #47109](https://github.com/BerriAI/litellm/pull/47109)

**A chat stream from OpenAI, Azure or an OpenAI-compatible provider that closes before any chunk carries a `finish_reason` now fails instead of ending as if it had finished.** The caller gets an error saying the stream ended before a finish_reason was received, router fallbacks can catch it, and the usage already streamed is billed on the failure log. A stream that sent no chunks at all still ends with a normal stop. There is no setting to restore the old behavior, so if you serve a self-hosted or custom OpenAI-compatible backend, check that its streams end with a `finish_reason` before you upgrade. See [PR #47665](https://github.com/BerriAI/litellm/pull/47665)

**Sending `temperature`, `top_p` or `top_k` to Gemini 3.5 Flash-Lite, Gemini 3.6 Flash or a later Gemini Flash model now returns a 400 unless `drop_params` is on.** Google ignores these parameters on those models, and LiteLLM used to forward them and return a 200. The model map now sets `supports_sampling_params: false` on those `gemini/` and `vertex_ai/` rows, and Vertex batch rows follow the same rule. Set `drop_params: true` to drop the parameters, or list them in `allowed_openai_params` to forward them as before. See [PR #47645](https://github.com/BerriAI/litellm/pull/47645)

**OpenAI and OpenAI-compatible 401 and 404 errors typed `invalid_request_error` now raise `AuthenticationError` and `NotFoundError` instead of `BadRequestError`.** Proxy clients get a 401 or a 404 instead of a 400, and the router applies its retry, cooldown and fallback rules for those classes. Code that catches `BadRequestError` for an invalid API key or a missing resource, such as a deleted vector store, must catch the new classes. Every other status keeps raising `BadRequestError`. See [PR #32537](https://github.com/BerriAI/litellm/pull/32537)

**The disk cache backend was removed.** `cache_params` with `type: disk` and the `litellm[caching]` install extra are gone, so a proxy configured with the disk cache now refuses to start, and `litellm.Cache(type="disk")` raises a `ValueError` that lists the supported types. Switch to `type: local` or `type: redis`. A leftover `disk_cache_dir` is ignored with a warning. See [PR #48114](https://github.com/BerriAI/litellm/pull/48114)

**Image generation without a model no longer falls back to `dall-e-2`.** OpenAI shut down `dall-e-2` and `dall-e-3` on 2026-05-12, so their image generation and edit configs and the Azure `dall-e-2` create-and-poll flow were removed. `litellm.image_generation()` with no model or provider now fails locally with "model is required", so pass a model such as `gpt-image-2`. `image_edit` and `image_variation` with no model leave `model` out of the provider request instead of sending `dall-e-2`. See [PR #48703](https://github.com/BerriAI/litellm/pull/48703)

**The `lakera_v2` guardrail with `on_flagged: block`, the default, now returns a 400 when Lakera flags only PII.** Before, a PII-only detection was masked and the request was forwarded whatever `on_flagged` said. Set `on_flagged: mask` to keep the old behavior, which masks PII-only detections and blocks anything else. `mask` needs `payload` and `breakdown`, which are on by default. See [PR #48944](https://github.com/BerriAI/litellm/pull/48944)

**A team virtual key owned by a proxy admin or admin viewer now reaches only the MCP servers and toolsets its team grants.** Such a key with no MCP list of its own used to reach every MCP server in the registry and any toolset. Grant the servers or toolsets to the team, or use a key with no team. The master key and the admin dashboard session keep the whole registry. A `litellm_proxy` MCP tool on `/v1/responses`, `/v1/chat/completions` or `/v1/messages` that names a toolset the team was never granted now gets a 403. See [PR #49161](https://github.com/BerriAI/litellm/pull/49161)

**A `model_id` in the request body no longer overrides a deployment's own `model_id`.** Clients could use it to move SageMaker chat and embedding calls to another inference component. The router now drops the request's value when the deployment sets one, and SageMaker chat drops a client `X-Amzn-SageMaker-Inference-Component` header in the same case. To let clients choose again, list `model_id` in the deployment's `configurable_clientside_auth_params`. See [PR #49045](https://github.com/BerriAI/litellm/pull/49045)

**Key owners and team members can no longer change `budget_duration` or `budget_id` on `/key/update` without the authorization that a `max_budget` change needs.** Before, they could shorten the reset window to clear spend on a capped key, or move the key to a larger budget tier. Make these changes with a user who can change the key's `max_budget`. See [PR #47681](https://github.com/BerriAI/litellm/pull/47681)

**`GET /customer/list` now returns one page of customers, 50 by default and at most 100, ordered by `user_id`.** It used to return every customer, so a script that reads the whole list now gets only the first 50. Pass `page` and `page_size` to walk the pages, or `search` to filter by customer ID or alias. The `/end_user/list` alias behaves the same way. See [PR #48700](https://github.com/BerriAI/litellm/pull/48700)

**A `fallbacks`, `content_policy_fallbacks` or `default_fallbacks` target written as a string now raises a `TypeError` when the router starts.** A config such as `fallbacks: [{"gpt-4": "gpt-3.5"}]` or `default_fallbacks: "gpt-3.5"` used to start, but its fallback never ran, because the router read the string one character at a time. The proxy now fails at startup with this config. Put each target in a list, such as `{"gpt-4": ["gpt-3.5"]}`. See [PR #48943](https://github.com/BerriAI/litellm/pull/48943)

**With `router_settings.tag_routing_prefix` set, only request tags that carry the prefix drive tag routing.** Unprefixed request tags used to route too, so a spend tag such as `user_id:234` could refuse a model group whose deployments are untagged. Tags inherited from the key, team or project still route with or without the prefix. If you route on unprefixed request tags, add the prefix to them or unset `tag_routing_prefix`. See [PR #47428](https://github.com/BerriAI/litellm/pull/47428)

**The AWS and GCP Terraform modules no longer default to the `v1.86.0-dev` images.** A module version from the Terraform Registry sets `image_tag` to its own release, so bumping the module bumps all four images. A module sourced from a git ref of the repo has no default and fails validation until you set `image_tag` to a published LiteLLM release or set all four `*_image` URIs. Both modules now require Terraform 1.9.0 or later. See [PR #46960](https://github.com/BerriAI/litellm/pull/46960)

:::

## Key Highlights

- **New providers**: Hostinger Router, CLF AI Gateway, Kyma API, BigModel (Zhipu AI), StreamLake, ZeroGPU, ai&, Refuseless, OpenCode Go and OpenInfer, plus Nace as a decisions provider
- **New endpoints**: `/v1/extraction` served by Cloudflare Clairic, Deepgram streaming text-to-speech on `/deepgram/v1/speak`, and the eu/jev decision pass-through on `/eu_jev/v1/systemone`
- **Native structured output on Bedrock Claude**: `json_schema` goes out natively on Haiku 5.5, Sonnet 5.5, Opus 4.8 and Sonnet 5 so adaptive thinking comes back, with a json tool retry when Bedrock rejects a schema
- **Codex on every provider**: Codex client `tool_search` works on Anthropic and other providers bridged through Responses, repeated Codex tool lists are deduplicated, and ChatGPT subscription logins pass through the gateway per user
- **Kubernetes pod routing**: set `kubernetes_pod_discovery: true` on a deployment whose `api_base` is a headless service and the router discovers the pods behind it, keeps a session on one pod, and shows the pods on the model page
- **Mid-stream fallback for chat completions**: with `enable_mid_stream_fallback_continuation`, a chat stream that breaks after text continues on the fallback model from where it stopped
- **Daily deployment limits**: `rpd` and `tpd` limits per deployment, with `daily_reset_time` to line up with a provider's own quota reset
- **Spend log storage cap**: `maximum_spend_logs_size` keeps `LiteLLM_SpendLogs` under a size on disk, deleting the oldest rows or dropping the oldest partitions first down to a target

## New Providers and Endpoints

### New Providers (11 new providers)

| Provider | Supported LiteLLM Endpoints | Description |
| --- | --- | --- |
| Hostinger Router | `/v1/chat/completions`, `/v1/embeddings`, `/v1/responses`, `/v1/messages` | OpenAI-compatible router under `hostinger_router/`, reading `HOSTINGER_ROUTER_API_KEY` |
| CLF AI Gateway | `/v1/chat/completions` | OpenAI-compatible gateway for open-weight GLM, Kimi, DeepSeek and Qwen models under `clf_ai_gateway/`, reading `CLF_AI_GATEWAY_API_KEY` |
| Kyma API | `/v1/chat/completions` | OpenAI-compatible provider under `kyma/`, reading `KYMA_API_KEY` and billed from Kyma's reported `usage.cost` |
| BigModel (Zhipu AI) | `/v1/chat/completions`, `/v1/responses`, `/v1/messages` | Native GLM provider under `bigmodel/`, reading `BIGMODEL_API_KEY` |
| StreamLake | `/v1/chat/completions` | OpenAI-compatible provider under `streamlake/`, reading `STREAMLAKE_API_KEY` |
| ZeroGPU | `/v1/chat/completions`, `/v1/responses` | OpenAI-compatible provider under `zerogpu/`, reading `ZEROGPU_API_KEY` |
| ai& | `/v1/chat/completions`, `/v1/responses`, `/v1/messages` | OpenAI-compatible provider under `aiand/`, reading `AIAND_API_KEY` |
| Refuseless | `/v1/chat/completions`, `/v1/responses` | OpenAI-compatible provider under `refuseless/`, reading `REFUSELESS_API_KEY` |
| OpenCode Go | `/v1/chat/completions`, `/v1/responses`, `/v1/messages` | OpenCode Go subscription models under `opencode_go/`, reading `OPENCODE_API_KEY` |
| OpenInfer | `/v1/chat/completions`, `/v1/responses`, `/v1/messages` | OpenAI-compatible provider under `openinfer/`, reading `OPENINFER_API_KEY` |
| Nace | `/v1/decisions`, `/v1/systemone` | Drex decisions provider under `nace/`, reading `NACE_API_KEY` |

### New LLM API Endpoints (3 new endpoints)

| Endpoint | Method | Description |
| --- | --- | --- |
| `/v1/extraction` | POST | Structured extraction, also on `/extraction`, served by Cloudflare Clairic with guardrail scanning and spend tracking |
| `/deepgram/v1/speak` | WebSocket | Deepgram streaming text-to-speech pass-through, also on `/deepgram/speak` |
| `/eu_jev/v1/systemone` | POST | Pass-through to the EU-hosted eu/jev decision API, reading `EU_JEV_API_KEY`, with spend tracking |

### Expanded provider endpoint support

| Provider | Endpoint | What you can do |
| --- | --- | --- |
| xAI | `/v1/search` | Run native X Search |
| DeepSeek | `/v1/search` | Run DeepSeek web search, priced per query |
| Amazon OpenSearch | `/v1/vector_stores/{id}/search` | Search an OpenSearch k-NN index as a vector store |
| Soniox | `/v1/realtime` | Stream realtime speech-to-text with server VAD and translation sessions |
| DashScope | `/v1/images/edits`, `/v1/audio/speech`, `/v1/messages` | Edit images, generate speech and call the native Anthropic Messages route from one DashScope deployment |
| Tencent TokenHub | `/v1/images/generations`, `/v1/images/edits` | Generate and edit images with Seedream |
| VolcEngine | `/v1/videos` | Generate, edit and extend Doubao-Seedance videos |
| Vertex AI | `/v1/audio/speech` | Generate speech with Gemini 3.1 Flash TTS |
| Azure AI Foundry | `/v1/responses` | Call Foundry agents through the project Responses API |
## New Models / Updated Models

#### New Model Support (311 new models)

Counts represent new catalog identifiers compared with `v1.108.0`, including aliases and regional variants. Prices are the values bundled in this release, in USD, and runtime pricing-map reloads can update them. No catalog entries were removed.

<details>
<summary>All 311 new catalog entries</summary>

| Provider | Model | Context Window | Input ($/1M tokens) | Output ($/1M tokens) | Features / special pricing |
| --- | --- | --- | --- | --- | --- |
| Abliteration | `abliteration/abliterated-model` | 262,144 | $1 | $3 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.1/1M |
| Abliteration | `abliteration/abliterated-model-large` | 1,000,000 | $3 | $5 | Chat; Reasoning; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.3/1M |
| Abliteration | `abliteration/abliterated-model-large-flash` | 1,048,576 | $1 | $2 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.1/1M |
| Abliteration | `abliteration/abliterated-model-large-v2` | 1,000,000 | $3 | $5 | Chat; Reasoning; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.3/1M |
| ai& | `aiand/deepseek-ai/deepseek-v4-flash` | 1,048,576 | $0.15 | $0.25 | Chat; Reasoning; Tool calling; Prompt caching; `cache_read_input_token_cost`: $0.08/1M |
| ai& | `aiand/deepseek-ai/deepseek-v4-pro` | 1,048,576 | $1 | $2.5 | Chat; Reasoning; Tool calling; Prompt caching; `cache_read_input_token_cost`: $0.25/1M |
| ai& | `aiand/deepseek-ai/deepseek-v4.1-flash` | 1,048,576 | $0.3 | $0.6 | Chat; Reasoning; Vision; Tool calling; Prompt caching; `cache_read_input_token_cost`: $0.02/1M |
| ai& | `aiand/deepseek-ai/deepseek-v4.1-flash-1017` | 1,048,576 | $0.3 | $0.6 | Chat; Reasoning; Vision; Tool calling; Prompt caching; `cache_read_input_token_cost`: $0.02/1M |
| ai& | `aiand/google/gemma-4-31b-it` | 262,144 | $0.2 | $0.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; `cache_read_input_token_cost`: $0.05/1M |
| ai& | `aiand/meta/muse-spark-open` | 1,048,576 | $1.25 | $4.25 | Chat; Reasoning; Vision; Tool calling; Prompt caching; `cache_read_input_token_cost`: $0.15/1M |
| ai& | `aiand/moonshotai/kimi-k2.7-code` | 262,144 | $0.75 | $3.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; `cache_read_input_token_cost`: $0.2/1M |
| ai& | `aiand/moonshotai/kimi-k3` | 1,048,576 | $3 | $12.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; `cache_read_input_token_cost`: $0.5/1M |
| ai& | `aiand/motif-technologies/motif-3` | 262,144 | $0.5 | $2 | Chat; Reasoning; Tool calling; Prompt caching; `cache_read_input_token_cost`: $0.2/1M |
| ai& | `aiand/openai/gpt-oss-120b` | 131,072 | $0.15 | $0.6 | Chat; Reasoning; Tool calling; Prompt caching; `cache_read_input_token_cost`: $0.08/1M |
| ai& | `aiand/qwen/qwen3.6-27b` | 262,144 | $0.32 | $3.2 | Chat; Reasoning; Vision; Tool calling; Prompt caching; `cache_read_input_token_cost`: $0.2/1M |
| ai& | `aiand/qwen/qwen3.8-27b` | 262,144 | $0.4 | $3 | Chat; Reasoning; Vision; Tool calling; Prompt caching; `cache_read_input_token_cost`: $0.2/1M |
| ai& | `aiand/zai-org/glm-5.2` | 1,048,576 | $1 | $4 | Chat; Reasoning; Tool calling; Prompt caching; `cache_read_input_token_cost`: $0.3/1M |
| ai& | `aiand/zai-org/glm-5.3` | 1,048,576 | $1 | $4 | Chat; Reasoning; Tool calling; Prompt caching; `cache_read_input_token_cost`: $0.3/1M |
| ai& | `aiand/zai-org/glm-5.3-flash` | 1,048,550 | $0.15 | $0.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; `cache_read_input_token_cost`: $0.03/1M |
| Amazon Bedrock | `bedrock/ap-northeast-1/mistral.voxtral-mini-3b-2507` | 32,768 | $0.05 | $0.05 | Chat; Audio input; `input_cost_per_token_batches`: $0.03/1M; `input_cost_per_token_flex`: $0.03/1M; `input_cost_per_token_priority`: $0.09/1M; `output_cost_per_token_batches`: $0.03/1M; `output_cost_per_token_flex`: $0.03/1M; `output_cost_per_token_priority`: $0.09/1M |
| Amazon Bedrock | `bedrock/ap-northeast-1/mistral.voxtral-small-24b-2507` | 32,768 | $0.12 | $0.36 | Chat; Audio input; `input_cost_per_token_batches`: $0.06/1M; `input_cost_per_token_flex`: $0.06/1M; `input_cost_per_token_priority`: $0.21/1M; `output_cost_per_token_batches`: $0.18/1M; `output_cost_per_token_flex`: $0.18/1M; `output_cost_per_token_priority`: $0.63/1M |
| Amazon Bedrock | `bedrock/ap-southeast-2/mistral.voxtral-mini-3b-2507` | 32,768 | $0.0412 | $0.0412 | Chat; Audio input; `input_cost_per_token_batches`: $0.0206/1M; `input_cost_per_token_flex`: $0.0206/1M; `input_cost_per_token_priority`: $0.0721/1M; `output_cost_per_token_batches`: $0.0206/1M; `output_cost_per_token_flex`: $0.0206/1M; `output_cost_per_token_priority`: $0.0721/1M |
| Amazon Bedrock | `bedrock/ap-southeast-2/mistral.voxtral-small-24b-2507` | 32,768 | $0.103 | $0.309 | Chat; Audio input; `input_cost_per_token_batches`: $0.0515/1M; `input_cost_per_token_flex`: $0.0515/1M; `input_cost_per_token_priority`: $0.18025/1M; `output_cost_per_token_batches`: $0.1545/1M; `output_cost_per_token_flex`: $0.1545/1M; `output_cost_per_token_priority`: $0.54075/1M |
| Amazon Bedrock | `bedrock/claude_platform/claude-fable-5` | 1,000,000 | $10 | $50 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; `cache_creation_input_token_cost`: $12.5/1M; `cache_creation_input_token_cost_above_1hr`: $20/1M; `cache_creation_input_token_cost_batches`: $6.25/1M; `cache_read_input_token_cost`: $1/1M; `cache_read_input_token_cost_batches`: $0.5/1M; `input_cost_per_token_batches`: $5/1M; `output_cost_per_token_batches`: $25/1M |
| Amazon Bedrock | `bedrock/claude_platform/claude-fable-5-1` | 1,000,000 | $10 | $50 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; `cache_creation_input_token_cost`: $12.5/1M; `cache_creation_input_token_cost_above_1hr`: $20/1M; `cache_creation_input_token_cost_batches`: $6.25/1M; `cache_read_input_token_cost`: $0.25/1M; `cache_read_input_token_cost_batches`: $0.125/1M; `input_cost_per_token_batches`: $5/1M; `output_cost_per_token_batches`: $25/1M |
| Amazon Bedrock | `bedrock/claude_platform/claude-haiku-4-5` | 200,000 | $1 | $5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; `cache_creation_input_token_cost`: $1.25/1M; `cache_creation_input_token_cost_above_1hr`: $2/1M; `cache_creation_input_token_cost_batches`: $0.625/1M; `cache_read_input_token_cost`: $0.1/1M; `cache_read_input_token_cost_batches`: $0.05/1M; `input_cost_per_token_batches`: $0.5/1M; `output_cost_per_token_batches`: $2.5/1M |
| Amazon Bedrock | `bedrock/claude_platform/claude-haiku-5-5` | 1,000,000 | $0.1 | $0.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; `cache_creation_input_token_cost`: $0.125/1M; `cache_creation_input_token_cost_above_100k_tokens`: $0.625/1M; `cache_creation_input_token_cost_above_100k_tokens_batches`: $0.3125/1M; `cache_creation_input_token_cost_above_1hr`: $0.2/1M; `cache_creation_input_token_cost_above_1hr_above_100k_tokens`: $1/1M; `cache_creation_input_token_cost_batches`: $0.0625/1M; `cache_read_input_token_cost`: $0.01/1M; `cache_read_input_token_cost_above_100k_tokens`: $0.05/1M; `cache_read_input_token_cost_above_100k_tokens_batches`: $0.025/1M; `cache_read_input_token_cost_batches`: $0.005/1M; `input_cost_per_token_above_100k_tokens`: $0.5/1M; `input_cost_per_token_above_100k_tokens_batches`: $0.25/1M; `input_cost_per_token_batches`: $0.05/1M; `output_cost_per_token_above_100k_tokens`: $2.5/1M; `output_cost_per_token_above_100k_tokens_batches`: $1.25/1M; `output_cost_per_token_batches`: $0.25/1M |
| Amazon Bedrock | `bedrock/claude_platform/claude-opus-4-5` | 200,000 | $5 | $25 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; `cache_creation_input_token_cost`: $6.25/1M; `cache_creation_input_token_cost_above_1hr`: $10/1M; `cache_creation_input_token_cost_batches`: $3.125/1M; `cache_read_input_token_cost`: $0.5/1M; `cache_read_input_token_cost_batches`: $0.25/1M; `input_cost_per_token_batches`: $2.5/1M; `output_cost_per_token_batches`: $12.5/1M |
| Amazon Bedrock | `bedrock/claude_platform/claude-opus-4-6` | 1,000,000 | $5 | $25 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; `cache_creation_input_token_cost`: $6.25/1M; `cache_creation_input_token_cost_above_1hr`: $10/1M; `cache_creation_input_token_cost_batches`: $3.125/1M; `cache_read_input_token_cost`: $0.5/1M; `cache_read_input_token_cost_batches`: $0.25/1M; `input_cost_per_token_batches`: $2.5/1M; `output_cost_per_token_batches`: $12.5/1M |
| Amazon Bedrock | `bedrock/claude_platform/claude-opus-4-7` | 1,000,000 | $5 | $25 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; `cache_creation_input_token_cost`: $6.25/1M; `cache_creation_input_token_cost_above_1hr`: $10/1M; `cache_creation_input_token_cost_batches`: $3.125/1M; `cache_read_input_token_cost`: $0.5/1M; `cache_read_input_token_cost_batches`: $0.25/1M; `input_cost_per_token_batches`: $2.5/1M; `output_cost_per_token_batches`: $12.5/1M |
| Amazon Bedrock | `bedrock/claude_platform/claude-opus-4-8` | 1,000,000 | $5 | $25 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; `cache_creation_input_token_cost`: $6.25/1M; `cache_creation_input_token_cost_above_1hr`: $10/1M; `cache_creation_input_token_cost_batches`: $3.125/1M; `cache_read_input_token_cost`: $0.5/1M; `cache_read_input_token_cost_batches`: $0.25/1M; `input_cost_per_token_batches`: $2.5/1M; `output_cost_per_token_batches`: $12.5/1M |
| Amazon Bedrock | `bedrock/claude_platform/claude-opus-5` | 1,000,000 | $5 | $25 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; `cache_creation_input_token_cost`: $6.25/1M; `cache_creation_input_token_cost_above_1hr`: $10/1M; `cache_creation_input_token_cost_batches`: $3.125/1M; `cache_read_input_token_cost`: $0.5/1M; `cache_read_input_token_cost_batches`: $0.25/1M; `input_cost_per_token_batches`: $2.5/1M; `output_cost_per_token_batches`: $12.5/1M |
| Amazon Bedrock | `bedrock/claude_platform/claude-opus-5-5` | 1,000,000 | $4 | $20 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; `cache_creation_input_token_cost`: $5/1M; `cache_creation_input_token_cost_above_1hr`: $8/1M; `cache_creation_input_token_cost_batches`: $2.5/1M; `cache_read_input_token_cost`: $0.2/1M; `cache_read_input_token_cost_batches`: $0.1/1M; `input_cost_per_token_batches`: $2/1M; `output_cost_per_token_batches`: $10/1M |
| Amazon Bedrock | `bedrock/claude_platform/claude-sonnet-4-5` | 200,000 | $3 | $15 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; `cache_creation_input_token_cost`: $3.75/1M; `cache_creation_input_token_cost_above_1hr`: $6/1M; `cache_creation_input_token_cost_batches`: $1.875/1M; `cache_read_input_token_cost`: $0.3/1M; `cache_read_input_token_cost_batches`: $0.15/1M; `input_cost_per_token_batches`: $1.5/1M; `output_cost_per_token_batches`: $7.5/1M |
| Amazon Bedrock | `bedrock/claude_platform/claude-sonnet-4-6` | 1,000,000 | $3 | $15 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; `cache_creation_input_token_cost`: $3.75/1M; `cache_creation_input_token_cost_above_1hr`: $6/1M; `cache_creation_input_token_cost_batches`: $1.875/1M; `cache_read_input_token_cost`: $0.3/1M; `cache_read_input_token_cost_batches`: $0.15/1M; `input_cost_per_token_batches`: $1.5/1M; `output_cost_per_token_batches`: $7.5/1M |
| Amazon Bedrock | `bedrock/claude_platform/claude-sonnet-5` | 1,000,000 | $2 | $10 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; `cache_creation_input_token_cost`: $2.5/1M; `cache_creation_input_token_cost_above_1hr`: $4/1M; `cache_creation_input_token_cost_batches`: $1.25/1M; `cache_read_input_token_cost`: $0.2/1M; `cache_read_input_token_cost_batches`: $0.1/1M; `input_cost_per_token_batches`: $1/1M; `output_cost_per_token_batches`: $5/1M |
| Amazon Bedrock | `bedrock/claude_platform/claude-sonnet-5-5` | 1,000,000 | $2 | $10 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; `cache_creation_input_token_cost`: $2.5/1M; `cache_creation_input_token_cost_above_1hr`: $4/1M; `cache_creation_input_token_cost_batches`: $1.25/1M; `cache_read_input_token_cost`: $0.1/1M; `cache_read_input_token_cost_batches`: $0.05/1M; `input_cost_per_token_batches`: $1/1M; `output_cost_per_token_batches`: $5/1M |
| Amazon Bedrock | `bedrock/eu-west-2/mistral.voxtral-mini-3b-2507` | 32,768 | $0.06 | $0.06 | Chat; Audio input; `input_cost_per_token_batches`: $0.03/1M; `input_cost_per_token_flex`: $0.03/1M; `input_cost_per_token_priority`: $0.11/1M; `output_cost_per_token_batches`: $0.03/1M; `output_cost_per_token_flex`: $0.03/1M; `output_cost_per_token_priority`: $0.11/1M |
| Amazon Bedrock | `bedrock/eu-west-2/mistral.voxtral-small-24b-2507` | 32,768 | $0.16 | $0.47 | Chat; Audio input; `input_cost_per_token_batches`: $0.08/1M; `input_cost_per_token_flex`: $0.08/1M; `input_cost_per_token_priority`: $0.28/1M; `output_cost_per_token_batches`: $0.23/1M; `output_cost_per_token_flex`: $0.23/1M; `output_cost_per_token_priority`: $0.82/1M |
| Amazon Bedrock | `bedrock_mantle/openai.gpt-6.1-terra` | 922,000 | $1.1 | $5.5 | Responses; Reasoning; Vision; Tool calling; Prompt caching; Structured output; `cache_creation_input_token_cost`: $1.375/1M; `cache_creation_input_token_cost_above_272k_tokens`: $2.75/1M; `cache_read_input_token_cost`: $0.055/1M; `cache_read_input_token_cost_above_272k_tokens`: $0.11/1M; `input_cost_per_token_above_272k_tokens`: $2.2/1M; `output_cost_per_token_above_272k_tokens`: $8.25/1M |
| Amazon Bedrock | `global.openai.gpt-6.1-terra` | 922,000 | $1 | $5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; `cache_creation_input_token_cost`: $1.25/1M; `cache_creation_input_token_cost_above_272k_tokens`: $2.5/1M; `cache_read_input_token_cost`: $0.05/1M; `cache_read_input_token_cost_above_272k_tokens`: $0.1/1M; `input_cost_per_token_above_272k_tokens`: $2/1M; `output_cost_per_token_above_272k_tokens`: $7.5/1M |
| Amazon Bedrock | `us.openai.gpt-6.1-terra` | 922,000 | $1.1 | $5.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; `cache_creation_input_token_cost`: $1.375/1M; `cache_creation_input_token_cost_above_272k_tokens`: $2.75/1M; `cache_read_input_token_cost`: $0.055/1M; `cache_read_input_token_cost_above_272k_tokens`: $0.11/1M; `input_cost_per_token_above_272k_tokens`: $2.2/1M; `output_cost_per_token_above_272k_tokens`: $8.25/1M |
| Azure | `azure/apac/gpt-6.1-terra` | 922,000 | $1.2 | $6 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; `cache_creation_input_token_cost`: $1.5/1M; `cache_creation_input_token_cost_above_272k_tokens`: $3/1M; `cache_read_input_token_cost`: $0.06/1M; `cache_read_input_token_cost_above_272k_tokens`: $0.12/1M; `input_cost_per_token_above_272k_tokens`: $2.4/1M; `output_cost_per_token_above_272k_tokens`: $9/1M |
| Azure | `azure/eu/gpt-6.1-terra` | 922,000 | $1.2 | $6 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; `cache_creation_input_token_cost`: $1.5/1M; `cache_creation_input_token_cost_above_272k_tokens`: $3/1M; `cache_read_input_token_cost`: $0.06/1M; `cache_read_input_token_cost_above_272k_tokens`: $0.12/1M; `input_cost_per_token_above_272k_tokens`: $2.4/1M; `output_cost_per_token_above_272k_tokens`: $9/1M |
| Azure | `azure/gpt-6.1-terra` | 922,000 | $1 | $5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; `cache_creation_input_token_cost`: $1.25/1M; `cache_creation_input_token_cost_above_272k_tokens`: $2.5/1M; `cache_read_input_token_cost`: $0.05/1M; `cache_read_input_token_cost_above_272k_tokens`: $0.1/1M; `input_cost_per_token_above_272k_tokens`: $2/1M; `output_cost_per_token_above_272k_tokens`: $7.5/1M |
| Azure | `azure/us/gpt-6.1-terra` | 922,000 | $1.1 | $5.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; `cache_creation_input_token_cost`: $1.375/1M; `cache_creation_input_token_cost_above_272k_tokens`: $2.75/1M; `cache_read_input_token_cost`: $0.055/1M; `cache_read_input_token_cost_above_272k_tokens`: $0.11/1M; `input_cost_per_token_above_272k_tokens`: $2.2/1M; `output_cost_per_token_above_272k_tokens`: $8.25/1M |
| Azure AI | `azure_ai/gpt-6.1-terra` | 922,000 | $1 | $5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; `cache_creation_input_token_cost`: $1.25/1M; `cache_creation_input_token_cost_above_272k_tokens`: $2.5/1M; `cache_read_input_token_cost`: $0.05/1M; `cache_read_input_token_cost_above_272k_tokens`: $0.1/1M; `input_cost_per_token_above_272k_tokens`: $2/1M; `output_cost_per_token_above_272k_tokens`: $7.5/1M |
| Azure AI | `azure_ai/MAI-Code-1.1-Flash` | 256,000 | $0.2 | $1.2 | Chat; Reasoning; Vision; Tool calling; Prompt caching; `cache_read_input_token_cost`: $0.02/1M |
| Baseten | `baseten/decision-models/baseten-elephant-9b-latest` | 16,384 | $0.035 | $0 | Vision |
| Baseten | `baseten/decision-models/baseten-joey-2b-latest` | 16,384 | $0.01 | $0 | Vision |
| Baseten | `baseten/decision-models/baseten-mammoth-27b-latest` | 16,384 | $0.1 | $0 | Vision |
| BigModel | `bigmodel/glm-5.3` | 1,000,000 | $1.142857 | $4 | Chat; Reasoning; Tool calling; Prompt caching; `cache_read_input_token_cost`: $0.285714/1M |
| BigModel | `bigmodel/glm-5.3-flash` | 1,000,000 | $0.114286 | $0.4 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Video input; `cache_read_input_token_cost`: $0.032857/1M |
| BigModel | `bigmodel/glm-5.3-flashx` | 1,000,000 | $0.285714 | $1 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Video input; `cache_read_input_token_cost`: $0.081429/1M |
| Cerebras | `cerebras/llama-3.1-70b` | 128,000 | $0.6 | $0.6 | Chat; Tool calling |
| Cerebras | `cerebras/llama-3.1-8b` | 128,000 | $0.1 | $0.1 | Chat; Tool calling |
| ChatGPT | `chatgpt/gpt-6-astra-law` | 922,000 | - | - | Responses; Reasoning; Vision; Tool calling; Structured output |
| ChatGPT | `chatgpt/gpt-6-rosalind` | 922,000 | - | - | Responses; Reasoning; Vision; Tool calling; Structured output |
| ChatGPT | `chatgpt/gpt-6.1-terra` | 922,000 | - | - | Responses; Reasoning; Vision; Tool calling; Structured output |
| CLF AI Gateway | `clf_ai_gateway/deepseek-v4-flash` | 1,048,576 | $0.176 | $0.528 | Chat; Reasoning; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.005/1M |
| CLF AI Gateway | `clf_ai_gateway/deepseek-v4-pro` | 1,048,576 | $0.528 | $1.584 | Chat; Reasoning; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.017/1M |
| CLF AI Gateway | `clf_ai_gateway/deepseek-v4.1-flash` | 1,048,576 | $0.12 | $0.48 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.002/1M |
| CLF AI Gateway | `clf_ai_gateway/glm-4.7-flash` | 131,072 | $0.024 | $0.16 | Chat; Reasoning; Tool calling; Structured output |
| CLF AI Gateway | `clf_ai_gateway/glm-5.2` | 262,144 | $0.56 | $1.76 | Chat; Reasoning; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.104/1M |
| CLF AI Gateway | `clf_ai_gateway/glm-5.3` | 1,048,576 | $0.56 | $1.76 | Chat; Reasoning; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.104/1M |
| CLF AI Gateway | `clf_ai_gateway/glm-5.3-flash` | 1,048,576 | $0.06 | $0.2 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.012/1M |
| CLF AI Gateway | `clf_ai_gateway/kimi-k2.6` | 262,144 | $0.38 | $1.6 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.064/1M |
| CLF AI Gateway | `clf_ai_gateway/kimi-k2.7-code` | 262,144 | $0.38 | $1.6 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.076/1M |
| CLF AI Gateway | `clf_ai_gateway/qwen3.8-27b` | 262,144 | $0.18 | $1.28 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.02/1M |
| Cohere | `rerank-v5.0-fast` | 32,768 | $0.02 | $0 | Rerank |
| Cohere | `rerank-v5.0-pro` | 32,768 | $0.05 | $0 | Rerank |
| DashScope | `dashscope/qwen-audio-3.0-tts-flash` | - | - | - | Speech; `input_cost_per_character`: $0.000015 |
| DashScope | `dashscope/qwen-audio-3.0-tts-plus` | - | - | - | Speech; `input_cost_per_character`: $0.00002 |
| DashScope | `dashscope/qwen-audio-3.1-tts-flash` | - | $0.23 | $1.87 | Speech |
| DashScope | `dashscope/qwen-audio-3.1-tts-plus` | - | - | - | Speech; `input_cost_per_character`: $0.00003 |
| DashScope | `dashscope/qwen3-tts-flash` | - | - | - | Speech; `input_cost_per_character`: $0.00001 |
| Databricks | `databricks/databricks-claude-haiku-5-5` | 1,000,000 | $0.10003 | $0.50001 | Chat; Reasoning; Vision; Tool calling; Prompt caching; `cache_creation_input_token_cost`: $0.12502/1M; `cache_creation_input_token_cost_above_100k_tokens`: $0.62503/1M; `cache_creation_input_token_cost_above_1hr`: $0.19999/1M; `cache_creation_input_token_cost_above_1hr_above_100k_tokens`: $1.00002/1M; `cache_read_input_token_cost`: $0.01001/1M; `cache_read_input_token_cost_above_100k_tokens`: $0.04998/1M; `input_cost_per_token_above_100k_tokens`: $0.50001/1M; `input_dbu_cost_per_token`: $1.429/1M; `output_cost_per_token_above_100k_tokens`: $2.49998/1M; `output_dbu_cost_per_token`: $7.143/1M |
| Databricks | `databricks/databricks-claude-sonnet-5-5` | 1,000,000 | $1.99997 | $9.99999 | Chat; Reasoning; Tool calling; Prompt caching; `cache_creation_input_token_cost`: $2.49998/1M; `cache_creation_input_token_cost_above_1hr`: $4.00001/1M; `cache_read_input_token_cost`: $0.10003/1M; `input_dbu_cost_per_token`: $28.571/1M; `output_dbu_cost_per_token`: $142.86/1M |
| Databricks | `databricks/databricks-deepseek-v4-1-flash` | 1,000,000 | $0.30002 | $1.20001 | Chat; Reasoning; Vision; Tool calling; Prompt caching; `cache_creation_input_token_cost`: $0.30002/1M; `cache_creation_input_token_cost_priority`: $0.525/1M; `cache_read_input_token_cost`: $0.03003/1M; `cache_read_input_token_cost_priority`: $0.0525/1M; `input_cost_per_token_priority`: $0.525/1M; `input_dbu_cost_per_token`: $4.286/1M; `output_cost_per_token_priority`: $2.1/1M; `output_dbu_cost_per_token`: $17.143/1M |
| Databricks | `databricks/databricks-deepseek-v4-1-flash-1017` | 1,000,000 | $0.30002 | $1.20001 | Chat; Reasoning; Vision; Tool calling; Prompt caching; `cache_creation_input_token_cost`: $0.30002/1M; `cache_read_input_token_cost`: $0.007/1M; `input_dbu_cost_per_token`: $4.286/1M; `output_dbu_cost_per_token`: $17.143/1M |
| Databricks | `databricks/databricks-gemini-2-5-flash-lite` | 1,048,576 | $0.12502 | $0.50001 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Audio input; Video input; `cache_creation_input_token_cost`: $0.12502/1M; `cache_read_input_audio_token_cost`: $0.03752/1M; `cache_read_input_token_cost`: $0.01253/1M; `input_cost_per_audio_token`: $0.37499/1M; `input_cost_per_image_token`: $0.12502/1M; `input_dbu_cost_per_token`: $1.786/1M; `output_dbu_cost_per_token`: $7.143/1M |
| Databricks | `databricks/databricks-gemini-3-1-flash-lite-image` | 65,536 | $0.31248 | $1.87502 | Chat; Vision; `cache_creation_input_token_cost`: $0.31248/1M; `cache_read_input_token_cost`: $0.31248/1M; `input_cost_per_image_token`: $0.31248/1M; `input_dbu_cost_per_token`: $4.464/1M; `output_cost_per_image_token`: $37.49998/1M; `output_dbu_cost_per_token`: $26.786/1M |
| Databricks | `databricks/databricks-gemini-4-argon` | 1,048,576 | $2.49998 | $12.49997 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Audio input; Video input; `cache_creation_input_token_cost`: $2.49998/1M; `cache_creation_input_token_cost_priority`: $4.50002/1M; `cache_read_input_token_cost`: $0.12502/1M; `cache_read_input_token_cost_priority`: $0.22498/1M; `input_cost_per_token_priority`: $4.50002/1M; `input_dbu_cost_per_token`: $35.714/1M; `output_cost_per_token_priority`: $22.50003/1M; `output_dbu_cost_per_token`: $178.57/1M |
| Databricks | `databricks/databricks-gpt-5-4-pro` | 922,000 | $29.99997 | $180.0001 | Responses; Reasoning; Vision; Tool calling; Prompt caching; `cache_creation_input_token_cost`: $29.99997/1M; `cache_read_input_token_cost`: $29.99997/1M; `input_cost_per_token_above_272k_tokens`: $60/1M; `input_dbu_cost_per_token`: $428.57/1M; `output_cost_per_token_above_272k_tokens`: $270/1M; `output_dbu_cost_per_token`: $2571.4/1M |
| Databricks | `databricks/databricks-gpt-6-1-sol` | 922,000 | $1.99997 | $9.99999 | Responses; Reasoning; Vision; Tool calling; Prompt caching; `cache_creation_input_token_cost`: $2.49998/1M; `cache_creation_input_token_cost_above_272k_tokens`: $5.00003/1M; `cache_creation_input_token_cost_above_272k_tokens_priority`: $9.99999/1M; `cache_creation_input_token_cost_priority`: $5.00003/1M; `cache_read_input_token_cost`: $0.10003/1M; `cache_read_input_token_cost_above_272k_tokens`: $0.19999/1M; `cache_read_input_token_cost_above_272k_tokens_priority`: $0.39998/1M; `cache_read_input_token_cost_priority`: $0.19999/1M; `input_cost_per_token_above_272k_tokens`: $4.00001/1M; `input_cost_per_token_above_272k_tokens_priority`: $8.00002/1M; `input_cost_per_token_priority`: $4.00001/1M; `input_dbu_cost_per_token`: $28.571/1M; `output_cost_per_token_above_272k_tokens`: $15/1M; `output_cost_per_token_above_272k_tokens_priority`: $29.9999/1M; `output_cost_per_token_priority`: $19.9997/1M; `output_dbu_cost_per_token`: $142.86/1M |
| Databricks | `databricks/databricks-gpt-6-1-terra` | 922,000 | $1.00002 | $5.00003 | Chat; Reasoning; Vision; Tool calling; Prompt caching; `cache_creation_input_token_cost`: $1.24999/1M; `cache_creation_input_token_cost_above_272k_tokens`: $2.49998/1M; `cache_creation_input_token_cost_above_272k_tokens_priority`: $5.00003/1M; `cache_creation_input_token_cost_priority`: $2.49998/1M; `cache_read_input_token_cost`: $0.04998/1M; `cache_read_input_token_cost_above_272k_tokens`: $0.10003/1M; `cache_read_input_token_cost_above_272k_tokens_priority`: $0.19999/1M; `cache_read_input_token_cost_priority`: $0.10003/1M; `input_cost_per_token_above_272k_tokens`: $1.99997/1M; `input_cost_per_token_above_272k_tokens_priority`: $4.00001/1M; `input_cost_per_token_priority`: $1.99997/1M; `input_dbu_cost_per_token`: $14.286/1M; `output_cost_per_token_above_272k_tokens`: $7.50001/1M; `output_cost_per_token_above_272k_tokens_priority`: $15.00002/1M; `output_cost_per_token_priority`: $9.99999/1M; `output_dbu_cost_per_token`: $71.429/1M |
| Databricks | `databricks/databricks-gpt-6-astra` | 922,000 | $9.99999 | $50.00002 | Chat; Reasoning; Vision; Tool calling; Prompt caching; `cache_creation_input_token_cost`: $12.49997/1M; `cache_creation_input_token_cost_above_272k_tokens`: $25/1M; `cache_creation_input_token_cost_above_272k_tokens_priority`: $50.00002/1M; `cache_creation_input_token_cost_priority`: $25.00001/1M; `cache_read_input_token_cost`: $1.00002/1M; `cache_read_input_token_cost_above_272k_tokens`: $1.99997/1M; `cache_read_input_token_cost_above_272k_tokens_priority`: $4.00001/1M; `cache_read_input_token_cost_priority`: $1.99997/1M; `input_cost_per_token_above_272k_tokens`: $20/1M; `input_cost_per_token_above_272k_tokens_priority`: $40.00003/1M; `input_cost_per_token_priority`: $19.99998/1M; `input_dbu_cost_per_token`: $142.86/1M; `output_cost_per_token_above_272k_tokens`: $75.0001/1M; `output_cost_per_token_above_272k_tokens_priority`: $150.0002/1M; `output_cost_per_token_priority`: $99.9999/1M; `output_dbu_cost_per_token`: $714.29/1M |
| Databricks | `databricks/databricks-gpt-6-luna` | 922,000 | $0.10003 | $0.50001 | Responses; Reasoning; Vision; Tool calling; Prompt caching; `cache_creation_input_token_cost`: $0.12502/1M; `cache_creation_input_token_cost_above_272k_tokens`: $0.24997/1M; `cache_creation_input_token_cost_above_272k_tokens_priority`: $0.50001/1M; `cache_creation_input_token_cost_priority`: $0.24997/1M; `cache_read_input_token_cost`: $0.01001/1M; `cache_read_input_token_cost_above_272k_tokens`: $0.02002/1M; `cache_read_input_token_cost_above_272k_tokens_priority`: $0.03997/1M; `cache_read_input_token_cost_priority`: $0.02002/1M; `input_cost_per_token_above_272k_tokens`: $0.19999/1M; `input_cost_per_token_above_272k_tokens_priority`: $0.39998/1M; `input_cost_per_token_priority`: $0.19999/1M; `input_dbu_cost_per_token`: $1.429/1M; `output_cost_per_token_above_272k_tokens`: $0.7497/1M; `output_cost_per_token_above_272k_tokens_priority`: $1.5001/1M; `output_cost_per_token_priority`: $1.0003/1M; `output_dbu_cost_per_token`: $7.143/1M |
| Databricks | `databricks/databricks-gpt-6-sol` | 922,000 | $1.99997 | $9.99999 | Responses; Reasoning; Vision; Tool calling; Prompt caching; `cache_creation_input_token_cost`: $2.49998/1M; `cache_creation_input_token_cost_above_272k_tokens`: $5.00003/1M; `cache_creation_input_token_cost_above_272k_tokens_priority`: $9.99999/1M; `cache_creation_input_token_cost_priority`: $5.00003/1M; `cache_read_input_token_cost`: $0.19999/1M; `cache_read_input_token_cost_above_272k_tokens`: $0.39998/1M; `cache_read_input_token_cost_above_272k_tokens_priority`: $0.80003/1M; `cache_read_input_token_cost_priority`: $0.39998/1M; `input_cost_per_token_above_272k_tokens`: $4.00001/1M; `input_cost_per_token_above_272k_tokens_priority`: $8.00002/1M; `input_cost_per_token_priority`: $4.00001/1M; `input_dbu_cost_per_token`: $28.571/1M; `output_cost_per_token_above_272k_tokens`: $15.0003/1M; `output_cost_per_token_above_272k_tokens_priority`: $29.9999/1M; `output_cost_per_token_priority`: $19.9997/1M; `output_dbu_cost_per_token`: $142.86/1M |
| Databricks | `databricks/databricks-gpt-image-1` | - | $5.00003 | - | Image generation; `cache_creation_input_token_cost`: $5.00003/1M; `cache_read_input_token_cost`: $1.24999/1M; `input_cost_per_image_token`: $9.99999/1M; `input_dbu_cost_per_token`: $71.429/1M; `output_cost_per_image_token`: $40.00003/1M |
| Databricks | `databricks/databricks-gpt-image-1-5` | - | $5.00003 | $9.99999 | Image generation; Vision; PDF input; `cache_creation_input_token_cost`: $5.00003/1M; `cache_read_input_token_cost`: $1.24999/1M; `input_cost_per_image_token`: $8.00002/1M; `input_dbu_cost_per_token`: $71.429/1M; `output_cost_per_image_token`: $32.00001/1M; `output_dbu_cost_per_token`: $142.86/1M |
| Databricks | `databricks/databricks-gpt-image-1-mini` | - | $1.99997 | - | Image generation; `cache_creation_input_token_cost`: $1.99997/1M; `cache_read_input_token_cost`: $0.19999/1M; `input_cost_per_image_token`: $2.49998/1M; `input_dbu_cost_per_token`: $28.571/1M; `output_cost_per_image_token`: $8.00002/1M |
| Databricks | `databricks/databricks-gpt-image-2` | - | $5.00003 | - | Image generation; Vision; PDF input; `cache_creation_input_token_cost`: $5.00003/1M; `cache_read_input_token_cost`: $1.24999/1M; `input_cost_per_image_token`: $8.00002/1M; `input_dbu_cost_per_token`: $71.429/1M; `output_cost_per_image_token`: $29.99997/1M |
| Databricks | `databricks/databricks-grok-4-7` | 500,000 | $2.49998 | $7.50001 | Chat; Reasoning; Vision; Tool calling; Prompt caching; `cache_creation_input_token_cost`: $2.49998/1M; `cache_read_input_token_cost`: $0.62503/1M; `input_dbu_cost_per_token`: $35.714/1M; `output_dbu_cost_per_token`: $107.14/1M |
| Databricks | `databricks/databricks-kimi-k2-7` | 262,144 | $0.94997 | $4.00001 | Chat; Reasoning; Vision; Tool calling; Prompt caching; `cache_creation_input_token_cost`: $0.94997/1M; `cache_read_input_token_cost`: $0.18998/1M; `input_dbu_cost_per_token`: $13.571/1M; `output_dbu_cost_per_token`: $57.143/1M |
| Databricks | `databricks/databricks-typesafeai-jev-1-14-0` | - | $0.042 | $0 | Vision; `cache_creation_input_token_cost`: $0.042/1M; `cache_read_input_token_cost`: $0.042/1M; `input_dbu_cost_per_token`: $0.6/1M |
| Deepgram | `deepgram/aura` | - | - | - | `input_cost_per_character`: $0.000015 |
| Deepgram | `deepgram/aura-2` | - | - | - | `input_cost_per_character`: $0.00003 |
| ElevenLabs | `elevenlabs/eleven_flash_v2` | - | - | - | Speech; `input_cost_per_character`: $0.00004 |
| ElevenLabs | `elevenlabs/eleven_flash_v2_5` | - | - | - | Speech; `input_cost_per_character`: $0.00004 |
| ElevenLabs | `elevenlabs/eleven_turbo_v2` | - | - | - | Speech; `input_cost_per_character`: $0.00004 |
| ElevenLabs | `elevenlabs/eleven_turbo_v2_5` | - | - | - | Speech; `input_cost_per_character`: $0.00004 |
| ElevenLabs | `elevenlabs/eleven_v3_conversational` | - | - | - | Speech; `input_cost_per_character`: $0.00004 |
| ElevenLabs | `elevenlabs/eleven_v4` | - | - | - | Speech; `input_cost_per_character`: $0.00008 |
| ElevenLabs | `elevenlabs/eleven_v4_turbo` | - | - | - | Speech; `input_cost_per_character`: $0.00004 |
| EU JEV | `eu_jev/eu-jeff-1.0.0` | 32,768 | $0.0415 | $0 | - |
| EU JEV | `eu_jev/eu-jeff-latest` | 32,768 | $0.0415 | $0 | - |
| Fireworks AI | `fireworks_ai/accounts/fireworks/models/rune` | 262,144 | $0.042 | $0 | `cache_read_input_token_cost`: $0.0084/1M |
| Fireworks AI | `fireworks_ai/accounts/fireworks/models/ultramarine-1-flash-us` | 1,048,576 | $0.225 | $0.75 | Chat; Vision; Structured output; `cache_read_input_token_cost`: $0.045/1M; `cache_read_input_token_cost_priority`: $0.05625/1M; `input_cost_per_token_priority`: $0.28125/1M; `output_cost_per_token_priority`: $0.9375/1M |
| Fireworks AI | `fireworks_ai/accounts/fireworks/routers/deepseek-v4p1-flash-1017-spot` | 1,048,576 | $0.21 | $0.84 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.0042/1M |
| Fireworks AI | `fireworks_ai/accounts/fireworks/routers/deepseek-v4p1-flash-spot` | 1,048,576 | $0.21 | $0.84 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.0042/1M |
| Fireworks AI | `fireworks_ai/accounts/fireworks/routers/glm-5p3-spot` | 1,048,576 | $0.98 | $3.08 | Chat; Reasoning; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.182/1M |
| Fireworks AI | `fireworks_ai/accounts/fireworks/routers/kimi-k3-spot` | 1,048,576 | $2.1 | $10.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.21/1M |
| Fireworks AI | `fireworks_ai/accounts/fireworks/routers/spot-deepseek-v4-flash` | 1,048,576 | $0.105 | $0.21 | Chat; Reasoning; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.021/1M |
| GitHub Copilot | `github_copilot/gpt-6.1-terra` | 922,000 | $1 | $5 | Responses; Reasoning; Vision; Tool calling; Structured output; `cache_creation_input_token_cost`: $1.25/1M; `cache_creation_input_token_cost_above_272k_tokens`: $2.5/1M; `cache_read_input_token_cost`: $0.05/1M; `cache_read_input_token_cost_above_272k_tokens`: $0.1/1M; `input_cost_per_token_above_272k_tokens`: $2/1M; `output_cost_per_token_above_272k_tokens`: $7.5/1M |
| Hostinger Router | `hostinger_router/claude-sonnet-5` | 1,000,000 | $2.64 | $13.2 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; `cache_creation_input_token_cost`: $3.3/1M; `cache_creation_input_token_cost_above_1hr`: $5.28/1M; `cache_read_input_token_cost`: $0.264/1M |
| Hostinger Router | `hostinger_router/gpt-5.2` | 272,000 | $2.1 | $16.8 | Chat; Reasoning; Vision; Tool calling; Structured output; `cache_read_input_token_cost`: $0.21/1M |
| Hostinger Router | `hostinger_router/text-embedding-3-large` | 8,191 | $0.1716 | $0 | Embedding |
| Hostinger Router | `hostinger_router/text-embedding-3-small` | 8,191 | $0.03 | $0 | Embedding |
| Kyma API | `kyma/claude-fable-5` | 1,000,000 | $13.5 | $67.5 | Chat; Reasoning; Vision; Tool calling; Structured output; PDF input |
| Kyma API | `kyma/claude-fable-5.1` | 1,000,000 | $13.5 | $67.5 | Chat; Reasoning; Vision; Tool calling; Structured output; PDF input |
| Kyma API | `kyma/claude-haiku-4-5` | 200,000 | $1.35 | $6.75 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.135/1M |
| Kyma API | `kyma/claude-haiku-5.5` | 1,000,000 | $0.135 | $0.675 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; `cache_read_input_token_cost`: $0.0135/1M |
| Kyma API | `kyma/claude-opus-4-7` | 1,000,000 | $6.75 | $33.75 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.675/1M |
| Kyma API | `kyma/claude-opus-5` | 1,000,000 | $6.75 | $33.75 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; `cache_read_input_token_cost`: $0.675/1M |
| Kyma API | `kyma/claude-opus-5.5` | 1,000,000 | $5.4 | $27 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; `cache_read_input_token_cost`: $0.27/1M |
| Kyma API | `kyma/claude-sonnet-4-6` | 1,000,000 | $4.05 | $20.25 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.405/1M |
| Kyma API | `kyma/claude-sonnet-5` | 1,000,000 | $2.7 | $13.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; `cache_read_input_token_cost`: $0.27/1M |
| Kyma API | `kyma/claude-sonnet-5.5` | 1,000,000 | $2.7 | $13.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; `cache_read_input_token_cost`: $0.135/1M |
| Kyma API | `kyma/deepseek-r1` | 64,000 | $0.7425 | $2.957 | Chat; Reasoning; Tool calling; Structured output |
| Kyma API | `kyma/deepseek-v3` | 160,000 | $0.518 | $0.7571 | Chat; Reasoning; Tool calling; Structured output |
| Kyma API | `kyma/deepseek-v4-flash` | 1,000,000 | $0.123 | $0.2458 | Chat; Reasoning; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.0243/1M |
| Kyma API | `kyma/deepseek-v4-flash-vision-exp` | 1,048,576 | $0.3892 | $1.168 | Chat; Reasoning; Vision; Tool calling; Structured output |
| Kyma API | `kyma/deepseek-v4.1-flash` | 1,048,576 | $0.27 | $0.81 | Chat; Reasoning; Vision; Tool calling; Structured output |
| Kyma API | `kyma/gemini-3-flash` | 1,048,576 | $0.675 | $4.05 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.0675/1M |
| Kyma API | `kyma/gemini-3.1-pro` | 1,048,576 | $2.7 | $16.2 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; `cache_read_input_token_cost`: $0.27/1M |
| Kyma API | `kyma/gemini-3.5-flash` | 1,048,576 | $2.025 | $12.15 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.2025/1M |
| Kyma API | `kyma/gemini-3.5-flash-lite` | 1,048,576 | $0.405 | $3.375 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.0405/1M |
| Kyma API | `kyma/gemini-3.6-flash` | 1,048,576 | $1.013 | $5.063 | Chat; Reasoning; Vision; Tool calling; Prompt caching; `cache_read_input_token_cost`: $0.10125/1M |
| Kyma API | `kyma/gemini-3.7-flash` | 1,048,576 | $2.026 | $10.126 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; `cache_read_input_token_cost`: $0.10125/1M |
| Kyma API | `kyma/gemini-3.8-flash` | 1,048,576 | $2.026 | $10.126 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input |
| Kyma API | `kyma/gemini-4-argon` | 1,048,576 | $5.4 | $27 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; `cache_read_input_token_cost`: $0.27/1M |
| Kyma API | `kyma/gemma-4-31b` | 128,000 | $0.1642 | $0.4689 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.1642/1M |
| Kyma API | `kyma/glm-4.5-air` | 131,072 | $0.1797 | $1.175 | Chat; Reasoning; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.03375/1M |
| Kyma API | `kyma/glm-4.7-flash` | 203,000 | $0.081 | $0.54 | Chat; Reasoning; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.0135/1M |
| Kyma API | `kyma/glm-5.1` | 203,000 | $1.89 | $5.94 | Chat; Reasoning; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.27675/1M |
| Kyma API | `kyma/glm-5.2` | 1,000,000 | $0.9029 | $3.083 | Chat; Reasoning; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.29835/1M |
| Kyma API | `kyma/glm-5.3` | 1,310,720 | $1.178 | $3.702 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Kyma API | `kyma/glm-5.3-flash` | 1,310,720 | $0.172 | $0.5733 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Kyma API | `kyma/gpt-5.6-luna` | 1,050,000 | $0.2944 | $1.767 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; `cache_read_input_token_cost`: $0.027/1M |
| Kyma API | `kyma/gpt-5.6-luna-pro` | 1,050,000 | $0.2703 | $1.621 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; `cache_read_input_token_cost`: $0.027/1M |
| Kyma API | `kyma/gpt-5.6-sol` | 1,050,000 | $5.4 | $27 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; `cache_read_input_token_cost`: $0.675/1M |
| Kyma API | `kyma/gpt-5.6-sol-pro` | 1,050,000 | $5.4 | $27 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; `cache_read_input_token_cost`: $0.675/1M |
| Kyma API | `kyma/gpt-5.6-terra` | 1,050,000 | $2.7 | $16.2 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.27/1M; `input_cost_per_token_above_272k_tokens`: $5.4/1M; `output_cost_per_token_above_272k_tokens`: $24.3/1M |
| Kyma API | `kyma/gpt-5.6-terra-pro` | 1,050,000 | $2.7 | $16.2 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; `cache_read_input_token_cost`: $0.27/1M |
| Kyma API | `kyma/gpt-6-astra` | 1,050,000 | $13.5 | $67.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $1.35/1M |
| Kyma API | `kyma/gpt-6-luna` | 1,050,000 | $0.1639 | $0.8195 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; `cache_read_input_token_cost`: $0.0135/1M; `input_cost_per_token_above_272k_tokens`: $0.27/1M; `output_cost_per_token_above_272k_tokens`: $1.0125/1M |
| Kyma API | `kyma/gpt-6.1-sol` | 1,050,000 | $2.7 | $13.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; `cache_read_input_token_cost`: $0.135/1M; `input_cost_per_token_above_272k_tokens`: $5.4/1M; `output_cost_per_token_above_272k_tokens`: $20.25/1M |
| Kyma API | `kyma/gpt-oss-120b` | 128,000 | $0.0473 | $0.2303 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Kyma API | `kyma/grok-4.20` | 2,000,000 | $1.763 | $3.528 | Chat; Reasoning; Vision; Tool calling; Structured output; PDF input |
| Kyma API | `kyma/grok-4.20-multi-agent` | 2,000,000 | $1.767 | $3.534 | Chat; Reasoning; Vision; Structured output; PDF input |
| Kyma API | `kyma/grok-4.3` | 1,000,000 | $1.92 | $3.838 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.27/1M; `input_cost_per_token_above_200k_tokens`: $3.375/1M; `output_cost_per_token_above_200k_tokens`: $6.75/1M |
| Kyma API | `kyma/grok-4.5` | 500,000 | $2.73 | $8.189 | Chat; Reasoning; Vision; Tool calling; Structured output; PDF input |
| Kyma API | `kyma/grok-4.6` | 500,000 | $2.758 | $8.274 | Chat; Reasoning; Vision; Tool calling; Structured output; PDF input |
| Kyma API | `kyma/grok-4.7` | 500,000 | $2.16 | $6.48 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; `cache_read_input_token_cost`: $0.54/1M |
| Kyma API | `kyma/grok-build` | 256,000 | $1.389 | $2.777 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.27/1M; `input_cost_per_token_above_200k_tokens`: $2.7/1M; `output_cost_per_token_above_200k_tokens`: $5.4/1M |
| Kyma API | `kyma/hy3` | 262,144 | $0.1594 | $0.6576 | Chat; Reasoning; Tool calling; Structured output |
| Kyma API | `kyma/hy4-preview` | 1,048,576 | $1.1259 | $3.3764 | Chat; Reasoning; Tool calling; Structured output |
| Kyma API | `kyma/kimi-k2.6` | 262,144 | $0.5909 | $2.758 | Chat; Reasoning; Vision; Tool calling; Structured output |
| Kyma API | `kyma/kimi-k2.7-code` | 262,144 | $1.009 | $4.774 | Chat; Reasoning; Vision; Tool calling; Structured output |
| Kyma API | `kyma/kimi-k3` | 1,048,576 | $3.052 | $15.258 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.405/1M |
| Kyma API | `kyma/kimi-k3.1-pro` | 1,048,576 | $2.7 | $13.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.27/1M |
| Kyma API | `kyma/llama-3.3-70b` | 128,000 | $0.135 | $0.432 | Chat; Tool calling; Prompt caching; Structured output |
| Kyma API | `kyma/llama-4-maverick` | 1,048,576 | $0.3344 | $1.337 | Chat; Vision; Tool calling; Structured output |
| Kyma API | `kyma/mimo-v2.5` | 1,050,000 | $0.1859 | $0.3718 | Chat; Reasoning; Vision; Tool calling; Structured output |
| Kyma API | `kyma/mimo-v2.6-flash` | 1,050,000 | $0.189 | $0.378 | Chat; Reasoning; Vision; Tool calling; Structured output |
| Kyma API | `kyma/mimo-v2.6-pro` | 1,050,000 | $0.5805 | $1.1745 | Chat; Reasoning; Vision; Tool calling; Structured output |
| Kyma API | `kyma/minimax-m2.5` | 196,608 | $0.4188 | $1.675 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Kyma API | `kyma/minimax-m2.7` | 204,800 | $0.405 | $1.62 | Chat; Reasoning; Tool calling; Structured output |
| Kyma API | `kyma/minimax-m3` | 1,048,576 | $0.3956 | $1.582 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.0756/1M |
| Kyma API | `kyma/minimax-m3.1-flash` | 1,048,576 | $0.2025 | $0.81 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.02025/1M |
| Kyma API | `kyma/muse-glimmer-30b` | 131,072 | $0.4554 | $1.821 | Chat; Reasoning; Vision; Tool calling; Structured output |
| Kyma API | `kyma/muse-spark-1.1` | 1,048,576 | $1.542 | $5.243 | Chat; Reasoning; Vision; Tool calling; Structured output; PDF input |
| Kyma API | `kyma/muse-spark-1.2` | 1,048,576 | $1.773 | $6.025 | Chat; Reasoning; Vision; Tool calling; Structured output; PDF input |
| Kyma API | `kyma/muse-spark-1.3` | 1,048,576 | $1.688 | $5.738 | Chat; Reasoning; Vision; Tool calling; Structured output; PDF input |
| Kyma API | `kyma/muse-spark-open` | 1,048,576 | $1.688 | $5.738 | Chat; Reasoning; Vision; Tool calling; Structured output |
| Kyma API | `kyma/muse-wonder` | 1,048,576 | $5.4 | $27 | Chat; Reasoning; Vision; Tool calling; Structured output; PDF input |
| Kyma API | `kyma/nemotron-3-ultra-550b` | 1,000,000 | $0.675 | $3.375 | Chat; Reasoning; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.135/1M |
| Kyma API | `kyma/nemotron-3.5-super-vl` | 1,048,576 | $0.081 | $0.4725 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.0135/1M |
| Kyma API | `kyma/qwen-3-32b` | 32,768 | $0.108 | $0.378 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Kyma API | `kyma/qwen-3-coder` | 131,072 | $0.3546 | $1.612 | Chat; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.135/1M |
| Kyma API | `kyma/qwen-3.6-plus` | 1,000,000 | $0.4388 | $2.633 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; `input_cost_per_token_above_256k_tokens`: $1.755/1M; `output_cost_per_token_above_256k_tokens`: $5.265/1M |
| Kyma API | `kyma/qwen-3.7-max` | 1,000,000 | $2.071 | $6.207 | Chat; Reasoning; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.16875/1M |
| Kyma API | `kyma/qwen-3.7-plus` | 1,000,000 | $0.4325 | $1.731 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.0864/1M; `input_cost_per_token_above_256k_tokens`: $1.296/1M; `output_cost_per_token_above_256k_tokens`: $5.184/1M |
| Kyma API | `kyma/qwen-3.8-max` | 1,000,000 | $2.228 | $6.684 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.2781/1M |
| Kyma API | `kyma/qwen3.7-flash` | 1,000,000 | $0.0435 | $0.1886 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.0081/1M; `input_cost_per_token_above_256k_tokens`: $0.27/1M; `input_cost_per_token_above_32k_tokens`: $0.135/1M; `output_cost_per_token_above_256k_tokens`: $1.08/1M; `output_cost_per_token_above_32k_tokens`: $0.54/1M |
| Kyma API | `kyma/qwen3.8-27b` | 1,000,000 | $0.3826 | $2.732 | Chat; Reasoning; Vision; Tool calling; Structured output |
| Kyma API | `kyma/qwen3.8-flash` | 1,000,000 | $0.2045 | $0.641 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Kyma API | `kyma/sonar` | 127,072 | $1.35 | $1.35 | Chat; Vision; Prompt caching |
| Kyma API | `kyma/sonar-pro` | 200,000 | $4.05 | $20.25 | Chat; Vision; Prompt caching |
| Kyma API | `kyma/step-3.7-flash` | 256,000 | $0.2229 | $1.282 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.054/1M |
| Kyma API | `kyma/step-5-preview` | 1,048,576 | $1.35 | $3.645 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.135/1M |
| Mistral | `mistral/deepseek-v4-1-flash-1017` | 1,048,576 | $0.3 | $1.2 | Chat; Reasoning; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.007/1M |
| Mistral | `mistral/voxtral-mini-transcribe-3` | - | - | - | Transcription; Audio input; `input_cost_per_second`: $0.000058 |
| Mistral | `mistral/voxtral-mini-transcribe-3-0` | - | - | - | Transcription; Audio input; `input_cost_per_second`: $0.000058 |
| Mistral | `mistral/voxtral-mini-transcribe-realtime-3` | - | - | - | Transcription; Audio input; `input_cost_per_second`: $0.000133 |
| Mistral | `mistral/voxtral-mini-transcribe-realtime-3-0` | - | - | - | Transcription; Audio input; `input_cost_per_second`: $0.000133 |
| Mistral | `mistral/voxtral-mini-tts-3` | - | - | - | Speech; Audio output; `input_cost_per_character`: $0.000013 |
| Mistral | `mistral/voxtral-mini-tts-3-0` | - | - | - | Speech; Audio output; `input_cost_per_character`: $0.000013 |
| Mistral | `mistral/voxtral-small-transcribe-3` | - | - | - | Transcription; Audio input; `input_cost_per_second`: $0.000067 |
| Mistral | `mistral/voxtral-small-transcribe-3-0` | - | - | - | Transcription; Audio input; `input_cost_per_second`: $0.000067 |
| Mistral | `mistral/zai-glm-5-3-flash` | 1,048,576 | $0.15 | $0.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.03/1M |
| Moonshot AI | `moonshot/kimi-k3.1-pro` | 1,048,576 | $2 | $10 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; `cache_creation_input_token_cost`: $2/1M; `cache_creation_input_token_cost_above_1hr`: $4/1M; `cache_read_input_token_cost`: $0.2/1M |
| Morph | `morph/morph-dsv41flash` | 1,048,576 | $0.12 | $0.8 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.008/1M |
| Morph | `morph/morph-dsv41flash-1017` | 1,048,576 | $0.12 | $0.8 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.008/1M |
| Morph | `morph/morph-dsv41flash-abliterated` | 1,048,576 | $0.3 | $1.2 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.03/1M |
| Morph | `morph/morph-dsv4flash` | 1,048,576 | $0.141953 | $0.399625 | Chat; Reasoning; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.035937/1M |
| Morph | `morph/morph-glm53-744b` | 1,048,576 | $1.19 | $6 | Chat; Reasoning; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.1955/1M |
| Morph | `morph/morph-glm53flash` | 1,048,576 | $0.2 | $0.7 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.04/1M |
| Morph | `morph/morph-kimik3` | 1,048,576 | $2.5 | $14 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.29/1M |
| Morph | `morph/morph-kimik3-fast` | 1,048,576 | $6 | $22.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.6/1M |
| OpenAI | `gpt-6-astra-law` | 922,000 | $10 | $50 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; `cache_read_input_token_cost`: $1/1M |
| OpenAI | `gpt-6-rosalind` | 922,000 | $15 | $75 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; `cache_creation_input_token_cost`: $18.75/1M; `cache_creation_input_token_cost_above_12hr`: $37.5/1M; `cache_creation_input_token_cost_above_12hr_above_272k_tokens`: $75/1M; `cache_creation_input_token_cost_above_272k_tokens`: $37.5/1M; `cache_read_input_token_cost`: $1.5/1M; `cache_read_input_token_cost_above_272k_tokens`: $3/1M; `input_cost_per_token_above_272k_tokens`: $30/1M; `output_cost_per_token_above_272k_tokens`: $112.5/1M |
| OpenAI | `gpt-6.1-terra` | 922,000 | $1 | $5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; `cache_creation_input_token_cost`: $1.25/1M; `cache_creation_input_token_cost_above_12hr`: $2.5/1M; `cache_creation_input_token_cost_above_12hr_above_272k_tokens`: $5/1M; `cache_creation_input_token_cost_above_12hr_above_272k_tokens_batches`: $2.5/1M; `cache_creation_input_token_cost_above_12hr_above_272k_tokens_flex`: $2.5/1M; `cache_creation_input_token_cost_above_12hr_above_272k_tokens_priority`: $10/1M; `cache_creation_input_token_cost_above_12hr_batches`: $1.25/1M; `cache_creation_input_token_cost_above_12hr_flex`: $1.25/1M; `cache_creation_input_token_cost_above_12hr_priority`: $5/1M; `cache_creation_input_token_cost_above_272k_tokens`: $2.5/1M; `cache_creation_input_token_cost_above_272k_tokens_batches`: $1.25/1M; `cache_creation_input_token_cost_above_272k_tokens_flex`: $1.25/1M; `cache_creation_input_token_cost_above_272k_tokens_priority`: $5/1M; `cache_creation_input_token_cost_batches`: $0.625/1M; `cache_creation_input_token_cost_flex`: $0.625/1M; `cache_creation_input_token_cost_priority`: $2.5/1M; `cache_read_input_token_cost`: $0.05/1M; `cache_read_input_token_cost_above_272k_tokens`: $0.1/1M; `cache_read_input_token_cost_above_272k_tokens_batches`: $0.05/1M; `cache_read_input_token_cost_above_272k_tokens_flex`: $0.05/1M; `cache_read_input_token_cost_above_272k_tokens_priority`: $0.2/1M; `cache_read_input_token_cost_batches`: $0.025/1M; `cache_read_input_token_cost_flex`: $0.025/1M; `cache_read_input_token_cost_priority`: $0.1/1M; `input_cost_per_token_above_272k_tokens`: $2/1M; `input_cost_per_token_above_272k_tokens_batches`: $1/1M; `input_cost_per_token_above_272k_tokens_flex`: $1/1M; `input_cost_per_token_above_272k_tokens_priority`: $4/1M; `input_cost_per_token_batches`: $0.5/1M; `input_cost_per_token_flex`: $0.5/1M; `input_cost_per_token_priority`: $2/1M; `output_cost_per_token_above_272k_tokens`: $7.5/1M; `output_cost_per_token_above_272k_tokens_batches`: $3.75/1M; `output_cost_per_token_above_272k_tokens_flex`: $3.75/1M; `output_cost_per_token_above_272k_tokens_priority`: $15/1M; `output_cost_per_token_batches`: $2.5/1M; `output_cost_per_token_flex`: $2.5/1M; `output_cost_per_token_priority`: $10/1M |
| OpenCode Go | `opencode_go/beam-free` | 1,048,576 | $0 | $0 | Chat; Reasoning; Tool calling |
| OpenCode Go | `opencode_go/claude-haiku-5-5` | 1,000,000 | $0.1 | $0.5 | Chat; Reasoning; Vision; Tool calling; `cache_creation_input_token_cost`: $0.125/1M; `cache_read_input_token_cost`: $0.01/1M |
| OpenCode Go | `opencode_go/deepseek-v4-pro` | 1,000,000 | $1.32 | $3.96 | Chat; Reasoning; Tool calling; `cache_read_input_token_cost`: $0.044/1M |
| OpenCode Go | `opencode_go/deepseek-v4.1-flash` | 1,000,000 | $0.3 | $1.2 | Chat; Reasoning; Vision; Tool calling; `cache_read_input_token_cost`: $0.006/1M |
| OpenCode Go | `opencode_go/gemini-4-argon` | 1,048,576 | $2 | $10 | Chat; Reasoning; Vision; Tool calling; `cache_read_input_token_cost`: $0.1/1M |
| OpenCode Go | `opencode_go/glm-5.2` | 1,000,000 | $1.4 | $4.4 | Chat; Reasoning; Tool calling; `cache_read_input_token_cost`: $0.26/1M |
| OpenCode Go | `opencode_go/glm-5.3` | 1,000,000 | $1.4 | $4.4 | Chat; Reasoning; Tool calling; `cache_read_input_token_cost`: $0.26/1M |
| OpenCode Go | `opencode_go/glm-5.3-flash` | 1,000,000 | $0.15 | $0.5 | Chat; Reasoning; Vision; Tool calling; `cache_read_input_token_cost`: $0.03/1M |
| OpenCode Go | `opencode_go/gpt-5.6-luna` | 922,000 | $0.2 | $1.2 | Responses; Reasoning; Vision; Tool calling; `cache_creation_input_token_cost`: $0.25/1M; `cache_read_input_token_cost`: $0.02/1M |
| OpenCode Go | `opencode_go/gpt-6-luna` | 922,000 | $0.1 | $0.5 | Responses; Reasoning; Vision; Tool calling; `cache_creation_input_token_cost`: $0.125/1M; `cache_read_input_token_cost`: $0.01/1M |
| OpenCode Go | `opencode_go/grok-4.7` | 500,000 | $2 | $6 | Responses; Reasoning; Vision; Tool calling; `cache_read_input_token_cost`: $0.5/1M |
| OpenCode Go | `opencode_go/hy3` | 192,000 | $0.14 | $0.58 | Chat; Reasoning; Tool calling; `cache_read_input_token_cost`: $0.035/1M |
| OpenCode Go | `opencode_go/hy4-preview` | 1,024,000 | $0.834 | $2.501 | Chat; Reasoning; Tool calling; `cache_read_input_token_cost`: $0.042/1M |
| OpenCode Go | `opencode_go/kimi-k2.7-code` | 262,144 | $0.95 | $4 | Chat; Reasoning; Vision; Tool calling; `cache_read_input_token_cost`: $0.19/1M |
| OpenCode Go | `opencode_go/kimi-k3` | 1,048,576 | $3 | $15 | Chat; Reasoning; Vision; Tool calling; `cache_creation_input_token_cost`: $3/1M; `cache_read_input_token_cost`: $0.3/1M |
| OpenCode Go | `opencode_go/kimi-k3.1-pro` | 1,048,576 | $2 | $10 | Chat; Reasoning; Vision; Tool calling; `cache_creation_input_token_cost`: $2/1M; `cache_read_input_token_cost`: $0.2/1M |
| OpenCode Go | `opencode_go/longcat-2.0` | 1,000,000 | $0.3 | $1.2 | Chat; Reasoning; Tool calling; `cache_read_input_token_cost`: $0.006/1M |
| OpenCode Go | `opencode_go/longcat-2.5-preview-free` | 1,000,000 | $0 | $0 | Chat; Reasoning; Vision; Tool calling |
| OpenCode Go | `opencode_go/mimo-v2.5` | 1,000,000 | $0.14 | $0.28 | Chat; Reasoning; Vision; Tool calling; `cache_read_input_token_cost`: $0.0028/1M |
| OpenCode Go | `opencode_go/mimo-v2.5-pro` | 1,048,576 | $0.435 | $0.87 | Chat; Reasoning; Tool calling; `cache_read_input_token_cost`: $0.003625/1M |
| OpenCode Go | `opencode_go/mimo-v2.6-flash` | 1,048,576 | $0.14 | $0.28 | Chat; Reasoning; Vision; Tool calling; `cache_read_input_token_cost`: $0.0028/1M |
| OpenCode Go | `opencode_go/mimo-v2.6-pro` | 1,048,576 | $0.435 | $0.87 | Chat; Reasoning; Vision; Tool calling; `cache_read_input_token_cost`: $0.003625/1M |
| OpenCode Go | `opencode_go/minimax-m3` | 1,000,000 | $0.3 | $1.2 | Chat; Reasoning; Vision; Tool calling; `cache_read_input_token_cost`: $0.06/1M |
| OpenCode Go | `opencode_go/minimax-m3.1-flash` | 1,000,000 | $0.15 | $0.6 | Chat; Reasoning; Vision; Tool calling; `cache_read_input_token_cost`: $0.015/1M |
| OpenCode Go | `opencode_go/muse-spark-1.2-contributor` | 1,048,576 | $0.1 | $0.2 | Responses; Reasoning; Vision; Tool calling; `cache_read_input_token_cost`: $0.002/1M |
| OpenCode Go | `opencode_go/muse-spark-1.3-contributor` | 1,048,576 | $0.1 | $0.2 | Responses; Reasoning; Vision; Tool calling; `cache_read_input_token_cost`: $0.002/1M |
| OpenCode Go | `opencode_go/qwen3.7-plus` | 1,000,000 | $0.4 | $1.6 | Chat; Reasoning; Vision; Tool calling; `cache_creation_input_token_cost`: $0.5/1M; `cache_read_input_token_cost`: $0.04/1M |
| OpenCode Go | `opencode_go/qwen3.8-flash` | 1,000,000 | $0.15 | $0.47 | Chat; Reasoning; Vision; Tool calling; `cache_creation_input_token_cost`: $0.2/1M; `cache_read_input_token_cost`: $0.016/1M |
| OpenCode Go | `opencode_go/qwen3.8-max` | 1,000,000 | $2 | $6 | Chat; Reasoning; Vision; Tool calling; `cache_creation_input_token_cost`: $2.5/1M; `cache_read_input_token_cost`: $0.25/1M |
| OpenCode Go | `opencode_go/step-5-preview` | 1,000,000 | $1 | $2.7 | Chat; Reasoning; Vision; Tool calling; `cache_read_input_token_cost`: $0.1/1M |
| Refuseless | `refuseless/deepseek-v4.1-flash-abliterated` | 1,048,576 | $0.14 | $0.5 | Chat; Reasoning; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.035/1M |
| Refuseless | `refuseless/deepseek-v4.1-flash-fast` | 1,048,576 | $0.05 | $0.15 | Chat; Reasoning; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.003/1M |
| Refuseless | `refuseless/glm-5.3-abliterated` | 1,048,576 | $1 | $2 | Chat; Reasoning; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.15/1M |
| Refuseless | `refuseless/glm-5.3-flash-abliterated` | 1,048,576 | $0.12 | $0.5 | Chat; Reasoning; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.04/1M |
| Refuseless | `refuseless/minimax-m3.1-flash` | 1,048,576 | $0.05 | $0.25 | Chat; Reasoning; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.002/1M |
| Soniox | `soniox/stt-rt-preview` | - | - | - | Transcription; Audio input; `input_cost_per_second`: $0.000033 |
| Soniox | `soniox/stt-rt-preview-v2` | - | - | - | Transcription; Audio input; `input_cost_per_second`: $0.000033 |
| Soniox | `soniox/stt-rt-v3` | - | - | - | Transcription; Audio input; `input_cost_per_second`: $0.000033 |
| Soniox | `soniox/stt-rt-v3-preview` | - | - | - | Transcription; Audio input; `input_cost_per_second`: $0.000033 |
| Soniox | `soniox/stt-rt-v4` | - | - | - | Transcription; Audio input; `input_cost_per_second`: $0.000033 |
| Soniox | `soniox/stt-rt-v5` | - | - | - | Transcription; Audio input; `input_cost_per_second`: $0.000033 |
| StreamLake | `streamlake/deepseek-r1` | 98,304 | $0.571 | $2.286 | Chat; Reasoning; Tool calling; Prompt caching; `cache_read_input_token_cost`: $0.229/1M |
| StreamLake | `streamlake/DeepSeek-V3` | 56,000 | $0.286 | $1.143 | Chat; Tool calling; Prompt caching; `cache_read_input_token_cost`: $0.114/1M |
| StreamLake | `streamlake/deepseek-v3.1` | 98,304 | $0.571 | $1.714 | Chat; Reasoning; Tool calling; Prompt caching; `cache_read_input_token_cost`: $0.229/1M |
| StreamLake | `streamlake/deepseek-v4-flash` | 1,048,576 | $0.14 | $0.28 | Chat; Reasoning; Tool calling; Prompt caching; `cache_read_input_token_cost`: $0.028/1M |
| StreamLake | `streamlake/deepseek-v4-flash-0731` | 1,048,576 | $0.44 | $1.32 | Chat; Reasoning; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.014/1M |
| StreamLake | `streamlake/deepseek-v4-pro` | 1,048,576 | $1.74 | $3.48 | Chat; Reasoning; Tool calling; Prompt caching; `cache_read_input_token_cost`: $0.145/1M |
| StreamLake | `streamlake/DeepSeek-V4-Pro-0813` | 1,048,566 | $1.32 | $3.96 | Chat; Reasoning; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.044/1M |
| StreamLake | `streamlake/deepseek-v4.1-flash-1017` | 1,048,576 | $0.3 | $1.2 | Chat; Reasoning; Vision; Tool calling; Prompt caching; `cache_read_input_token_cost`: $0.006/1M |
| StreamLake | `streamlake/deepseek-v4.1-flash-260910` | 1,048,568 | $0.3 | $1.2 | Chat; Reasoning; Vision; Tool calling; Prompt caching; `cache_read_input_token_cost`: $0.006/1M |
| StreamLake | `streamlake/glm-5` | 202,752 | $1 | $3.2 | Chat; Reasoning; Tool calling; Prompt caching; `cache_read_input_token_cost`: $0.2/1M |
| StreamLake | `streamlake/glm-5.1` | 202,752 | $1.4 | $4.4 | Chat; Reasoning; Tool calling; Prompt caching; `cache_read_input_token_cost`: $0.26/1M |
| StreamLake | `streamlake/glm-5.2` | 1,048,566 | $1.4 | $4.4 | Chat; Reasoning; Tool calling; Prompt caching; `cache_read_input_token_cost`: $0.26/1M |
| StreamLake | `streamlake/GLM-5.3` | 1,048,576 | $1.4 | $4.4 | Chat; Reasoning; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.26/1M |
| StreamLake | `streamlake/GLM-5.3-Flash` | 1,048,576 | $0.15 | $0.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.03/1M |
| StreamLake | `streamlake/Kimi-K2-Instruct-0905` | 224,000 | $0.571 | $2.286 | Chat; Tool calling; Prompt caching; `cache_read_input_token_cost`: $0.143/1M |
| StreamLake | `streamlake/kimi-k2.6` | 262,144 | $0.95 | $4 | Chat; Vision; Tool calling; Prompt caching; `cache_read_input_token_cost`: $0.16/1M |
| StreamLake | `streamlake/kimi-k2.7-code` | 262,144 | $0.95 | $4 | Chat; Reasoning; Vision; Tool calling; Prompt caching; `cache_read_input_token_cost`: $0.19/1M |
| StreamLake | `streamlake/mimo-v2.6-flash` | - | $0.14 | $0.28 | Chat; Vision; Prompt caching; `cache_read_input_token_cost`: $0.0028/1M |
| StreamLake | `streamlake/mimo-v2.6-pro` | - | $0.435 | $0.87 | Chat; Vision; Prompt caching; `cache_read_input_token_cost`: $0.0036/1M |
| StreamLake | `streamlake/minimax-m2.5` | 196,608 | $0.3 | $1.2 | Chat; Reasoning; Tool calling; Prompt caching; `cache_creation_input_token_cost`: $0.375/1M; `cache_read_input_token_cost`: $0.03/1M |
| StreamLake | `streamlake/minimax-m3` | 1,000,000 | $0.6 | $2.4 | Chat; Reasoning; Vision; Tool calling; Prompt caching; `cache_read_input_token_cost`: $0.12/1M; `cache_read_input_token_cost_above_512k_tokens`: $0.24/1M; `input_cost_per_token_above_512k_tokens`: $1.2/1M; `output_cost_per_token_above_512k_tokens`: $4.8/1M |
| StreamLake | `streamlake/qwen3.5-397b-a17b` | 258,048 | $0.6 | $3.6 | Chat; Reasoning; Vision; Tool calling; Prompt caching; `cache_read_input_token_cost`: $0.12/1M |
| StreamLake | `streamlake/qwen3.6-27b` | 229,376 | $0.6 | $3.6 | Chat; Vision; Tool calling |
| StreamLake | `streamlake/qwen3.6-35b-a3b` | 229,376 | $0.375 | $2.25 | Chat; Vision; Tool calling |
| StreamLake | `streamlake/qwen3.8-2.4t-a95b` | 983,616 | $2 | $6 | Chat; Reasoning; Vision; Tool calling; Prompt caching; `cache_creation_input_token_cost`: $2.5/1M; `cache_read_input_token_cost`: $0.25/1M; `explicit_cache_read_input_token_cost`: $0.17/1M |
| StreamLake | `streamlake/qwen3.8-27b` | 983,616 | $0.5 | $3 | Chat; Reasoning; Vision; Tool calling; Prompt caching; `cache_creation_input_token_cost`: $0.625/1M; `cache_read_input_token_cost`: $0.1/1M; `explicit_cache_read_input_token_cost`: $0.05/1M |
| Tencent | `tencent/seedream-image-v5.0-flash` | - | - | - | Image generation; `output_cost_per_image`: $0.018; `output_cost_per_image_token`: $1.6/1M |
| Tencent | `tencent/seedream-image-v5.0-lite` | - | - | - | Image generation; `output_cost_per_image`: $0.035; `output_cost_per_image_token`: $1.6/1M |
| Tencent | `tencent/seedream-image-v5.0-pro` | - | - | - | Image generation; `output_cost_per_image`: $0.09; `output_cost_per_image_token`: $1.6/1M |
| Together AI | `together_ai/MiniMaxAI/MiniMax-M3.1-Flash` | 1,048,576 | $0.15 | $0.6 | Chat; Prompt caching; `cache_read_input_token_cost`: $0.015/1M |
| Weights & Biases | `wandb/reflection/Beam-1.0-501B-A23B` | 1,049,000 | $1 | $3 | Chat; Reasoning; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.1/1M |
| Weights & Biases | `wandb/zai-org/GLM-5.3` | 1,049,000 | $1.2 | $4 | Chat; Reasoning; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.19/1M |
| Z.AI | `zai/glm-5v-turbo` | 200,000 | $1.2 | $4 | Chat; Reasoning; Vision; Tool calling; Prompt caching; `cache_read_input_token_cost`: $0.24/1M |
| ZeroGPU | `zerogpu/deepseek-v4.1-flash` | 1,048,576 | $0.3 | $1.2 | Chat; Reasoning; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.003/1M |
| ZeroGPU | `zerogpu/glm-5.3-flash` | 1,048,576 | $0.1 | $0.35 | Chat; Reasoning; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.015/1M |
| ZeroGPU | `zerogpu/gpt-4.1-mini` | 1,047,576 | $0.4 | $1.6 | Chat; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.1/1M |
| ZeroGPU | `zerogpu/gpt-5.4-nano` | 272,000 | $0.2 | $1.25 | Chat; Reasoning; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.02/1M |
| ZeroGPU | `zerogpu/gpt-5.6-luna` | 272,000 | $0.2 | $1.2 | Chat; Reasoning; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.2/1M |
| ZeroGPU | `zerogpu/gpt-6-luna` | 272,000 | $0.1 | $0.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; `cache_read_input_token_cost`: $0.01/1M |
| ZeroGPU | `zerogpu/gpt-oss-120b` | 128,000 | $0.15 | $0.6 | Chat; Reasoning; Tool calling; Structured output; `cache_read_input_token_cost`: $0.03/1M |
| ZeroGPU | `zerogpu/LFM2.5-1.2B-Instruct` | 32,768 | $0.02 | $0.05 | Chat |
| ZeroGPU | `zerogpu/LFM2.5-1.2B-Thinking` | 32,768 | $0.02 | $0.05 | Chat |
| ZeroGPU | `zerogpu/llama-3.1-8b-instruct-fast` | 131,072 | $0.15 | $0.28 | Chat; Tool calling; Structured output; `cache_read_input_token_cost`: $0.025/1M |
| ZeroGPU | `zerogpu/llama-3.2-3b-instruct-fast` | 131,072 | $0.05 | $0.3 | Chat; `cache_read_input_token_cost`: $0.025/1M |
| ZeroGPU | `zerogpu/qwen3-30b-a3b-fp8` | 32,768 | $0.1 | $0.45 | Chat; Reasoning; Tool calling; Structured output; `cache_read_input_token_cost`: $0.05/1M |
| ZeroGPU | `zerogpu/qwen3.6-35b-a3b` | 262,144 | $0.2 | $1.5 | Chat; Reasoning; Vision; Tool calling; Structured output; `cache_read_input_token_cost`: $0.2/1M |

</details>

### New providers

- Add ai& under the `aiand/` prefix, reading `AIAND_API_KEY`, with native `/v1/messages`, model pricing, `aiand/*` wildcard listing and an Add Model entry - [PR #38958](https://github.com/BerriAI/litellm/pull/38958)
- Add CLF AI Gateway as an OpenAI-compatible provider under the `clf_ai_gateway/` prefix, reading `CLF_AI_GATEWAY_API_KEY`, with ten priced GLM, Kimi, DeepSeek and Qwen models and the `reasoning_effort` levels each one accepts - [PR #39324](https://github.com/BerriAI/litellm/pull/39324)
- Add StreamLake under the `streamlake/` prefix, reading `STREAMLAKE_API_KEY`, with tools and `reasoning_effort` accepted on endpoint ids, `streamlake/*` wildcard listing and rows from StreamLake's current price page - [PR #41006](https://github.com/BerriAI/litellm/pull/41006)
- Add OpenInfer as an OpenAI-compatible provider under the `openinfer/` prefix, reading `OPENINFER_API_KEY`, with native `/v1/responses` and `/v1/messages`, tool calls on unpriced models and priced `@oi/GLM-5.3-Flash`, `@oi/Qwen3.5-27B` and `@oi/Qwen3.5-9B` - [PR #41034](https://github.com/BerriAI/litellm/pull/41034)
- Add ZeroGPU as an OpenAI-compatible provider under the `zerogpu/` prefix, reading `ZEROGPU_API_KEY`, with ten priced text generation models and an Add Model entry - [PR #43874](https://github.com/BerriAI/litellm/pull/43874)
- Add Hostinger Router as an OpenAI-compatible provider under the `hostinger_router/` prefix, reading `HOSTINGER_ROUTER_API_KEY`, with chat completions and embeddings, `/v1/responses` for `gpt-5.2`, `/v1/messages` for `claude-sonnet-5`, credit-based pricing and an Add Model entry - [PR #44863](https://github.com/BerriAI/litellm/pull/44863)
- Add Nace as a Drex decisions provider under the `nace/` prefix, reading `NACE_API_KEY`, with an Add Model entry - [PR #46523](https://github.com/BerriAI/litellm/pull/46523)
- Add OpenCode Go under the `opencode_go/` prefix with model discovery, Chat Completions, Responses, Messages and Gemini routing, session affinity and published pricing - [PR #48140](https://github.com/BerriAI/litellm/pull/48140)
- Add Refuseless as an OpenAI-compatible provider under the `refuseless/` prefix, reading `REFUSELESS_API_KEY`, with model pricing and an Add Model entry - [PR #48497](https://github.com/BerriAI/litellm/pull/48497)
- Add BigModel (Zhipu AI) under the `bigmodel/` prefix with native Chat Completions, Responses and Messages APIs, reading `BIGMODEL_API_KEY` and keeping a GLM Coding Plan `api_base` on chat - [PR #48563](https://github.com/BerriAI/litellm/pull/48563)
- Add Kyma API as an OpenAI-compatible provider under the `kyma/` prefix, reading `KYMA_API_KEY`, billed from the `usage.cost` Kyma reports with 83 catalog rows as the fallback price - [PR #48756](https://github.com/BerriAI/litellm/pull/48756)

### Decisions providers

- Support Entra ID auth for `Microsoft-Decision-1` on `/v1/decisions` and `/v1/systemone`, with deployment credentials taking priority over the env key - [PR #46539](https://github.com/BerriAI/litellm/pull/46539)
- Bill an unpriced returned TypeSafe version at the requested model's rates, and answer a malformed upstream reply, such as a missing `answers` field, with a 500 naming the field - [PR #47508](https://github.com/BerriAI/litellm/pull/47508)
- Let `typesafe/*` allowlists on keys, teams and projects cover bare Jev ids on `/typesafe` calls, and list TypeSafe Jev models in the admin model picker - [PR #47697](https://github.com/BerriAI/litellm/pull/47697)
- Remove the 128 question cap on System One requests - [PR #47985](https://github.com/BerriAI/litellm/pull/47985)
- Keep Decisions usage empty when the provider reports none, instead of billing a made-up zero - [PR #48261](https://github.com/BerriAI/litellm/pull/48261)
- Explain in the warning that Cloudflare chat completions need the OpenAI-compatible `/ai/v1` endpoint when an `api_base` ending in `/ai/run` is rewritten, while decision models keep their own endpoint - [PR #48265](https://github.com/BerriAI/litellm/pull/48265)
- Set `azure_ai/Microsoft-Decision-1` `max_input_tokens` to 32,768 - [PR #48434](https://github.com/BerriAI/litellm/pull/48434)
- Support LM Studio decision models - [PR #48448](https://github.com/BerriAI/litellm/pull/48448)
- Add the Baseten `baseten-elephant-9b-latest` and `baseten-mammoth-27b-latest` decision models - [PR #48453](https://github.com/BerriAI/litellm/pull/48453)
- Honor the `base_url` alias for custom Decisions backends - [PR #48505](https://github.com/BerriAI/litellm/pull/48505)
- Leave out probabilities the provider omitted instead of reporting them as 0 - [PR #48524](https://github.com/BerriAI/litellm/pull/48524)
- Reuse the Databricks base OAuth token cache for Decisions calls instead of a separate one - [PR #48527](https://github.com/BerriAI/litellm/pull/48527)
- Add keyless Microsoft Entra authentication for Azure Decisions deployments, reusing the base Azure auth path - [PR #48529](https://github.com/BerriAI/litellm/pull/48529)
- Accept images on `hosted_vllm` decision deployments - [PR #48621](https://github.com/BerriAI/litellm/pull/48621)
- Catch a `ValidationError` from a malformed Decisions provider body instead of letting it escape - [PR #48662](https://github.com/BerriAI/litellm/pull/48662)
- Price the Databricks `openjev` decision model at its published 0.6 DBU per 1M input tokens - [PR #48694](https://github.com/BerriAI/litellm/pull/48694)
- Price the two Baseten decision models at their published input rates - [PR #48849](https://github.com/BerriAI/litellm/pull/48849)
- Support Ollama decision models - [PR #48871](https://github.com/BerriAI/litellm/pull/48871)
- Add the Baseten `baseten-joey-2b-latest` decision model - [PR #49123](https://github.com/BerriAI/litellm/pull/49123)
- Honor a Decisions deployment's own `supports_audio_input` and `supports_video_input` flags over the cost map, per media kind, the way `supports_box_questions` already works - [PR #49207](https://github.com/BerriAI/litellm/pull/49207)

### Amazon Bedrock

- Omit the system prompt from Bedrock audio transcription and report Converse token usage, so transcriptions are no longer billed at $0 - [PR #41565](https://github.com/BerriAI/litellm/pull/41565)
- Route Bedrock model ids from families with no Invoke transformation (MiniMax, NVIDIA, Writer, Z.AI, Google, xAI) to Converse when they are newer than the cost map, instead of failing with `BedrockError` - [PR #43290](https://github.com/BerriAI/litellm/pull/43290)
- Apply the 16 token `maxTokens` floor to Kimi K3 on Converse - [PR #43875](https://github.com/BerriAI/litellm/pull/43875)
- Drop the `dangerous-tool-use` beta on Invoke requests that carry structured outputs or a strict tool without safeguards, which Bedrock rejects as an invalid beta flag on Claude models before Opus 4.7 - [PR #44471](https://github.com/BerriAI/litellm/pull/44471)
- Stop a chat-mode Bedrock Mantle deployment from rewriting the shared Responses routing row, which moved other deployments and SDK calls onto Chat Completions until restart - [PR #46263](https://github.com/BerriAI/litellm/pull/46263)
- Keep `reasoning_content`, signed `thinking_blocks`, reasoning token counts and the `json_mode` finish reason on Converse fake streams for `json_schema` requests - [PR #46863](https://github.com/BerriAI/litellm/pull/46863)
- Send `json_schema` as native structured output on Bedrock Claude models whose profiles accept it, Haiku 5.5 and Sonnet 5.5 included, under the new `supports_bedrock_native_structured_output` key, so adaptive thinking comes back; Fable 5 and schemas native output cannot hold, such as recursive `$ref`, keep the json tool - [PR #46870](https://github.com/BerriAI/litellm/pull/46870)
- Backfill Priority and Batch prices on Bedrock rows from the AWS offer index - [PR #46987](https://github.com/BerriAI/litellm/pull/46987)
- Set `supports_none_reasoning_effort` on the Bedrock `gpt-6-sol` and `gpt-6-luna` rows - [PR #47000](https://github.com/BerriAI/litellm/pull/47000)
- Apply `bedrock_request_metadata_fields` on the `/bedrock` pass-through routes and answer malformed caller metadata with Bedrock's `ValidationException` 400 - [PR #47040](https://github.com/BerriAI/litellm/pull/47040)
- Send native structured output first on Claude Opus 4.8 and Sonnet 5, and retry with the json tool when Bedrock rejects it, including schemas Bedrock cannot compile - [PR #47100](https://github.com/BerriAI/litellm/pull/47100)
- Add the July 7, 2026 end-of-life date to the Llama 3.1 405B and Llama 3.2 rows - [PR #47196](https://github.com/BerriAI/litellm/pull/47196)
- Take the 200K context window for Claude Sonnet 4 from the Bedrock model card - [PR #47202](https://github.com/BerriAI/litellm/pull/47202)
- Take the 1,050,000 token context window from the Daybreak Mantle model cards - [PR #47211](https://github.com/BerriAI/litellm/pull/47211)
- Take the Grok 4.7 and Pegasus v1.5 context windows from the Bedrock model cards - [PR #47226](https://github.com/BerriAI/litellm/pull/47226)
- Add the `aws_bedrock_control_plane_endpoint` deployment setting so batch create, retrieve and cancel can go through a VPC endpoint or compatible gateway - [PR #47260](https://github.com/BerriAI/litellm/pull/47260)
- Take the 256K context window for Qwen3 Coder 480B from the Bedrock model card - [PR #47283](https://github.com/BerriAI/litellm/pull/47283)
- Resolve AWS region, endpoint and bearer token lookups off the event loop, so a slow secret manager read no longer stalls other requests on the worker - [PR #47331](https://github.com/BerriAI/litellm/pull/47331)
- Apply the deployment's `guardrailConfig` on the `/bedrock` pass-through Converse and Invoke routes, in the body for Converse and as `X-Amzn-Bedrock-Guardrail*` headers for Invoke, replacing any guardrail the caller sent - [PR #47429](https://github.com/BerriAI/litellm/pull/47429)
- Add model end-of-life dates for Writer Palmyra X4 and X5 and TwelveLabs Pegasus v1.2 - [PR #47462](https://github.com/BerriAI/litellm/pull/47462)
- Declare the Bedrock `gpt-oss` rows text-only, so modality routing sends image requests elsewhere - [PR #48149](https://github.com/BerriAI/litellm/pull/48149)
- Price `bedrock/claude_platform/*` calls from their own cost map rows and apply the 1.1x `inference_geo` multiplier to US-only inference - [PR #48150](https://github.com/BerriAI/litellm/pull/48150)
- Take Nova Sonic context and output limits from the Bedrock model cards - [PR #48247](https://github.com/BerriAI/litellm/pull/48247)
- Price native `guardrailConfig` trace usage into spend and `x-litellm-response-cost` on chat, Responses and pass-through, and apply `guardrailConfig` on `/v1/messages` - [PR #48278](https://github.com/BerriAI/litellm/pull/48278)
- Add the `global.` and `us.` `openai.gpt-6.1-terra` rows - [PR #48441](https://github.com/BerriAI/litellm/pull/48441)
- Set Bedrock `gpt-6.1-terra` `max_input_tokens` to 1,050,000, set the gpt-5.x and gpt-6 rows to the card context window minus max output, and add a Mantle `token_count_model` to the `bedrock_mantle` `claude-opus-5-5` rows - [PR #48479](https://github.com/BerriAI/litellm/pull/48479)
- Add `token_count_model` to three Mantle-native Claude rows - [PR #48682](https://github.com/BerriAI/litellm/pull/48682)
- Retry once without `strict` when Bedrock rejects strict tool schemas under `drop_params` - [PR #48733](https://github.com/BerriAI/litellm/pull/48733)
- Send region-prefixed embedding model ids and model ARNs to that region without the prefix and bill the region's price - [PR #49072](https://github.com/BerriAI/litellm/pull/49072)
- Backfill the published regional service tier prices on Bedrock rows - [PR #49113](https://github.com/BerriAI/litellm/pull/49113)
- Set `gpt-5.6-cyber` Mantle `max_input_tokens` to 922,000 and list `/v1/chat/completions` for it, matching the model card - [PR #49350](https://github.com/BerriAI/litellm/pull/49350)
- Restore the `eu.anthropic.claude-haiku-4-5-20251001-v1:0` row, so EU profile calls bill at the regional price instead of falling back to the base Haiku 4.5 row - [PR #49375](https://github.com/BerriAI/litellm/pull/49375)
- Raise the GovCloud West Llama 3 max output tokens to the model card's 8K - [PR #49543](https://github.com/BerriAI/litellm/pull/49543)
- Default `max_tokens` on Bedrock Invoke and Mantle Claude to the model's own output cap, read from the deployment's `model_info.max_output_tokens`, the ARN `base_model` or the Mantle row, instead of a fixed 128k that smaller models reject; `litellm.AnthropicConfig(max_tokens)` still applies, bounded by the deployment's cap - [PR #49692](https://github.com/BerriAI/litellm/pull/49692)

### Anthropic

- Stop inserting the empty-content placeholder text into assistant turns that carry only tool calls - [PR #34822](https://github.com/BerriAI/litellm/pull/34822)
- Send PDF `image_url` content to Claude as document blocks - [PR #46984](https://github.com/BerriAI/litellm/pull/46984)
- Handle `json_schema` envelope edge cases on the Claude json tool path, including non-ASCII text, cut Bedrock Invoke streams and a non-object `output_format` under `drop_params` - [PR #47478](https://github.com/BerriAI/litellm/pull/47478)
- Keep a `redacted_thinking` content item on every Claude route, Bedrock included, and replay each thinking block once in its original position - [PR #47489](https://github.com/BerriAI/litellm/pull/47489)
- Raise `DEFAULT_ANTHROPIC_CHAT_MAX_TOKENS` from 4,096 to 128,000 - [PR #48502](https://github.com/BerriAI/litellm/pull/48502)
- Let `drop_params` drop `speed` on `claude-opus-4-7`, since Anthropic removed its fast mode - [PR #48764](https://github.com/BerriAI/litellm/pull/48764)
- Drop beta-gated body fields such as `thinking.block_binding`, `thinking.display`, `output_config` and tool addition or removal blocks when a provider leg drops their `anthropic-beta` value, so the request degrades instead of failing with a 400 - [PR #48793](https://github.com/BerriAI/litellm/pull/48793)
- Map the `model_context_window_exceeded` stop reason to finish reason `length` on chat and Responses - [PR #48874](https://github.com/BerriAI/litellm/pull/48874)
- Map `pause_turn` to finish reason `length` with the raw `stop_reason` kept in `provider_specific_fields`, report a paused Responses turn as incomplete, and return a refusal's `stop_details.explanation` in `message.refusal` - [PR #49192](https://github.com/BerriAI/litellm/pull/49192)
- Answer 400 naming a non-string `role` or `tool_call_id` instead of a 500 from the Claude chat conversion - [PR #49237](https://github.com/BerriAI/litellm/pull/49237)

### Azure

- Keep OpenAI `prompt_cache_breakpoint` marks on the Azure AI Foundry chat completions path - [PR #45299](https://github.com/BerriAI/litellm/pull/45299)
- Add `responses_api_version` so Azure Responses calls stop using a deployment's dated chat `api_version`, refresh provider model sets after `register_model`, and align the Azure `gpt-6.1-sol` reasoning effort flags with OpenAI - [PR #46377](https://github.com/BerriAI/litellm/pull/46377)
- Reuse the cached Entra token provider on the Azure Responses path instead of building a new credential per request when `enable_azure_ad_token_refresh` is on - [PR #46421](https://github.com/BerriAI/litellm/pull/46421)
- Count Grok reasoning tokens in `completion_tokens` on `azure_ai/grok-*`, streaming and non-streaming - [PR #46969](https://github.com/BerriAI/litellm/pull/46969)
- Set the `azure/container` code interpreter session price from the Azure OpenAI pricing page - [PR #47292](https://github.com/BerriAI/litellm/pull/47292)
- Cache the remaining per-request Entra credentials and keep token refresh off the event loop - [PR #47348](https://github.com/BerriAI/litellm/pull/47348)
- Reach Azure AI Foundry agents through the project Responses API, keeping project-endpoint auth, system prompts and `agent_reference` checks on follow-up turns - [PR #47717](https://github.com/BerriAI/litellm/pull/47717)
- Add `azure_ai/MAI-Code-1.1-Flash` - [PR #47779](https://github.com/BerriAI/litellm/pull/47779)
- Drop `tool_reference` parts from tool messages on Azure AI chat - [PR #48032](https://github.com/BerriAI/litellm/pull/48032)
- Forward the `thinking-binding-controls-2026-08-01` beta header to Azure AI Foundry - [PR #48033](https://github.com/BerriAI/litellm/pull/48033)
- Accept explicit `/openai/v1` and `/openai/v1/responses` `api_base` values for Azure Responses calls - [PR #48118](https://github.com/BerriAI/litellm/pull/48118)
- Set Azure `gpt-chat-latest` `max_input_tokens` to 128,000 - [PR #48252](https://github.com/BerriAI/litellm/pull/48252)
- Declare audio input and output support on the Azure audio snapshot rows - [PR #48475](https://github.com/BerriAI/litellm/pull/48475)
- Map Azure's `context_length_exceeded` error code to `ContextWindowExceededError` - [PR #48616](https://github.com/BerriAI/litellm/pull/48616)
- Share one Entra token request per worker when concurrent cold requests hit a cached Azure token provider - [PR #48769](https://github.com/BerriAI/litellm/pull/48769)
- Add batch prices to the unversioned Azure `o3`, `o4-mini`, `o3-mini`, `gpt-4o` and `gpt-4o-mini` rows - [PR #49182](https://github.com/BerriAI/litellm/pull/49182)

### Baseten

- Forward `reasoning_effort` to the Baseten Model API instead of dropping it or raising `UnsupportedParamsError` - [PR #40152](https://github.com/BerriAI/litellm/pull/40152)
- List current Baseten Model APIs for `baseten/*` and `/v1/models` instead of three retired 2023 deployment ids - [PR #46945](https://github.com/BerriAI/litellm/pull/46945)
- Add Baseten and Nebius rows for Reflection `Beam-1.0` - [PR #46991](https://github.com/BerriAI/litellm/pull/46991)
- Add the Baseten `DeepSeek-V4.1-Flash-1017` models - [PR #47252](https://github.com/BerriAI/litellm/pull/47252)
- Update `reflection/Beam-1.0` prices from the Baseten models API - [PR #47784](https://github.com/BerriAI/litellm/pull/47784)

### ChatGPT

- Forward each Codex user's own ChatGPT OAuth login through the proxy, with per-model `chatgpt_auth_file` for multiple ChatGPT accounts - [PR #41522](https://github.com/BerriAI/litellm/pull/41522)
- Derive the upstream session id from `prompt_cache_key`, so repeat Codex turns hit ChatGPT's prompt cache - [PR #42014](https://github.com/BerriAI/litellm/pull/42014)
- Route ChatGPT models missing from the cost map through the Responses API - [PR #48244](https://github.com/BerriAI/litellm/pull/48244)
- Forward client credentials for ChatGPT image generation - [PR #48522](https://github.com/BerriAI/litellm/pull/48522)
- Send system input items to Codex as `developer`, which the backend accepts, instead of answering 400 - [PR #48668](https://github.com/BerriAI/litellm/pull/48668)

### Cohere

- Send a string `stop` as a one-item `stop_sequences` list - [PR #47091](https://github.com/BerriAI/litellm/pull/47091)
- Emit streamed tool calls from Cohere v2 `tool-call-start` and `tool-call-delta` chunks and map `TOOL_CALL` to finish reason `tool_calls` - [PR #47794](https://github.com/BerriAI/litellm/pull/47794)
- Price native Cohere v2 embed calls on Azure AI Foundry relays and the Cohere pass-through from `meta.billed_units` - [PR #48978](https://github.com/BerriAI/litellm/pull/48978)

### Databricks

- Call the workspace's native Anthropic route for Claude on `/v1/messages`, forwarding `anthropic-beta`, `anthropic-version` and `safeguards`, and route Unity Catalog Claude names to the AI Gateway messages route - [PR #46091](https://github.com/BerriAI/litellm/pull/46091)
- Stream Claude `json_schema` answers as text on every Databricks streaming path, ending with finish reason `stop` - [PR #47424](https://github.com/BerriAI/litellm/pull/47424)
- Sync Databricks model prices - [PR #48884](https://github.com/BerriAI/litellm/pull/48884)
- Add Databricks priority pay-per-token prices - [PR #48891](https://github.com/BerriAI/litellm/pull/48891)
- Add retirement dates for Databricks DeepSeek V4 Flash (0731), V4 Pro (0813) and Inkling - [PR #49124](https://github.com/BerriAI/litellm/pull/49124)

### DashScope

- Price explicit Qwen cache hits through `explicit_cache_read_input_token_cost`, keeping `cache_read_input_token_cost` as the implicit cache rate - [PR #45567](https://github.com/BerriAI/litellm/pull/45567)
- Derive every DashScope surface from one domain, base or `/api/v1` value, and add a native Anthropic Messages config at `/apps/anthropic` - [PR #47812](https://github.com/BerriAI/litellm/pull/47812)
- Add DashScope image edits and text-to-speech, billing reported speech characters and input images - [PR #48998](https://github.com/BerriAI/litellm/pull/48998)

### DeepSeek

- Pass `reasoning_effort` through to the DeepSeek API instead of collapsing it to a thinking on or off toggle - [PR #38736](https://github.com/BerriAI/litellm/pull/38736)

### Gemini and Vertex AI

- Support Gemini 3.1 Flash TTS on Vertex AI speech, keeping existing Gemini TTS models and voice mappings - [PR #31915](https://github.com/BerriAI/litellm/pull/31915)
- Log the Gemini 3 sampling deprecation once per model per worker - [PR #40868](https://github.com/BerriAI/litellm/pull/40868)
- Call Gemini once per TTS request and log the speech bridge's token usage and spend - [PR #44551](https://github.com/BerriAI/litellm/pull/44551)
- Forward and auto-add the compaction, thinking display and tool change betas on Claude routes for Vertex AI and Azure AI - [PR #44747](https://github.com/BerriAI/litellm/pull/44747)
- Build the `cachedContents` collection URL under a custom `api_base`, keeping gateway prefixes and the publisher model's location - [PR #44783](https://github.com/BerriAI/litellm/pull/44783)
- Price streamed Vertex pass-through calls with the regional uplift instead of the global rate - [PR #44795](https://github.com/BerriAI/litellm/pull/44795)
- Send integer enums to Gemini as `INTEGER` with `format: enum` instead of dropping them - [PR #44908](https://github.com/BerriAI/litellm/pull/44908)
- Remember created and found context caches until shortly before they expire instead of listing `cachedContents` on every request, rebuilding once when generation rejects a remembered cache - [PR #46857](https://github.com/BerriAI/litellm/pull/46857)
- Match only standalone 403 status tokens when mapping Vertex errors, instead of any substring - [PR #47134](https://github.com/BerriAI/litellm/pull/47134)
- Drop the placeholder `deprecation_date` from `gemini-3.8-flash` - [PR #47294](https://github.com/BerriAI/litellm/pull/47294)
- Drop the placeholder `deprecation_date` from `gemini-4-argon` - [PR #47404](https://github.com/BerriAI/litellm/pull/47404)
- Drop the placeholder `deprecation_date` from `gemini-3.8-live` - [PR #47447](https://github.com/BerriAI/litellm/pull/47447)
- Add `LITELLM_GEMINI_DEFAULT_MAX_OUTPUT_TOKENS` to set the output budget for Gemini text requests that send no limit - [PR #47542](https://github.com/BerriAI/litellm/pull/47542)
- Honor `supports_sampling_params` on the Gemini and Vertex path and set it to false on Gemini 3.6 Flash, 3.5 Flash-Lite and later, dropping `temperature`, `top_p` and `top_k` under `drop_params` - [PR #47645](https://github.com/BerriAI/litellm/pull/47645)
- Drop the flex prices from `gemini-nano-banana-2.1` - [PR #47666](https://github.com/BerriAI/litellm/pull/47666)
- Add `thought_signature_in_tool_call_id` to keep tool call ids short for clients that cap them, and pair a tool result with its call when the client re-adds the signature - [PR #47692](https://github.com/BerriAI/litellm/pull/47692)
- Add a `deprecation_date` to the retired `veo-2.0-generate-001` - [PR #47847](https://github.com/BerriAI/litellm/pull/47847)
- Add Vertex batch rates for the Llama 4 MaaS models - [PR #48085](https://github.com/BerriAI/litellm/pull/48085)
- Bill `gemini-2.5-flash-native-audio` video input at the audio and video rate - [PR #48248](https://github.com/BerriAI/litellm/pull/48248)
- Send tool result media beside the function response for Gemini models older than Gemini 3 - [PR #48428](https://github.com/BerriAI/litellm/pull/48428)
- Reuse the Vertex credential cache on rerank - [PR #48430](https://github.com/BerriAI/litellm/pull/48430)
- Bound how long the shared Vertex credential cache keeps entries - [PR #48442](https://github.com/BerriAI/litellm/pull/48442)
- Keep requested image aspect ratios and pick each Gemini image model's supported size tier - [PR #48463](https://github.com/BerriAI/litellm/pull/48463)
- Keep images and files with their MIME type in tool results and history across Responses, chat and Gemini conversions, and answer malformed media with a sanitized 400 - [PR #48484](https://github.com/BerriAI/litellm/pull/48484)
- Resolve Vertex `/v1/messages` authentication off the event loop - [PR #48523](https://github.com/BerriAI/litellm/pull/48523)
- Drop the placeholder retirement date from `gemini-3.1-flash-lite-image` - [PR #48587](https://github.com/BerriAI/litellm/pull/48587)
- Forward request timeouts on Gemini and Vertex embeddings - [PR #48690](https://github.com/BerriAI/litellm/pull/48690)
- Keep every grounding web source in annotations instead of only the first chunk's URL - [PR #48745](https://github.com/BerriAI/litellm/pull/48745)
- Accept Google's current Managed Agents fields on create, get, delete and `list_versions`, and forward `agent_config` on interactions - [PR #48750](https://github.com/BerriAI/litellm/pull/48750)
- Send Vertex Claude labels as the `X-Vertex-AI-Labels` header instead of the request body - [PR #48753](https://github.com/BerriAI/litellm/pull/48753)
- Split Gemini and Vertex SSE lines only on CR and LF, so text holding U+2028 no longer breaks the stream, and keep merged think tags balanced - [PR #48755](https://github.com/BerriAI/litellm/pull/48755)
- Send the caller's `anthropic-version` in the Vertex Claude `/v1/messages` body instead of the header, which Vertex rejected with a 400 - [PR #48814](https://github.com/BerriAI/litellm/pull/48814)
- Add batch above 200K and image output batch prices for Gemini models - [PR #48945](https://github.com/BerriAI/litellm/pull/48945)
- Bill Claude web search per request on Vertex deployments priced in `model_info`, instead of the Gemini grounding calculator - [PR #49160](https://github.com/BerriAI/litellm/pull/49160)
- Flag `supports_computer_use` on the four models Google's computer use docs list - [PR #49252](https://github.com/BerriAI/litellm/pull/49252)
- Flag `supports_computer_use` on the Gemini 3 Flash preview, 3.5, 3.6, 3.7 and 3.8 Flash, 3.5 Flash-Lite, Robotics ER 2 preview and `gemini/gemini-4-argon` rows - [PR #49297](https://github.com/BerriAI/litellm/pull/49297)
- Add the batch image output price to `gemini-nano-banana-2.1` and `gemini-3.1-flash-lite-image` - [PR #49317](https://github.com/BerriAI/litellm/pull/49317)
- Add batch, flex and priority text output prices to `gemini-2.5-flash-image` - [PR #49358](https://github.com/BerriAI/litellm/pull/49358)

### GitHub Copilot

- Treat a malformed or non-UTF-8 `api-key.json` like a missing one, so the request refreshes or prints the login hint - [PR #44723](https://github.com/BerriAI/litellm/pull/44723)
- Backfill `github_copilot` prices from the Copilot pricing table - [PR #47085](https://github.com/BerriAI/litellm/pull/47085)
- Refresh the `github_copilot` cost map rows - [PR #47254](https://github.com/BerriAI/litellm/pull/47254)
- Add a 2026-11-16 `deprecation_date` to `github_copilot/claude-opus-4.8` - [PR #47370](https://github.com/BerriAI/litellm/pull/47370)
- Add 2026-10-19 deprecation dates to the GitHub Copilot models retired that day, including `gpt-5-mini`, `gpt-5.4`, `gpt-5.5` and `grok-4.5` - [PR #47487](https://github.com/BerriAI/litellm/pull/47487)
- Add a 2026-06-01 `deprecation_date` to `github_copilot/gpt-4.1` - [PR #47492](https://github.com/BerriAI/litellm/pull/47492)
- Support a GHE.com host on per-user Copilot credentials through `github_copilot_host` - [PR #47610](https://github.com/BerriAI/litellm/pull/47610)
- Add a 2026-11-16 `deprecation_date` to `github_copilot/claude-opus-4.8-fast` - [PR #48251](https://github.com/BerriAI/litellm/pull/48251)
- Add `github_copilot/gpt-6.1-terra` and raise the GitHub Copilot gpt-6 `max_input_tokens` to 922,000 - [PR #48450](https://github.com/BerriAI/litellm/pull/48450)

### Mistral

- Forward `prompt_cache_key` to the Mistral API and accept `reasoning_effort` on devstral and code-agent models - [PR #47432](https://github.com/BerriAI/litellm/pull/47432)
- Add `mistral/zai-glm-5-3-flash` to the cost map - [PR #48270](https://github.com/BerriAI/litellm/pull/48270)
- Replay earlier assistant reasoning to Mistral as a thinking chunk inside `content`, only for models that accept it - [PR #48778](https://github.com/BerriAI/litellm/pull/48778)
- Price `mistral-large-4` at its list price now that the launch sale has ended, since calls were billed at about half the real cost - [PR #48825](https://github.com/BerriAI/litellm/pull/48825)
- Add `mistral/deepseek-v4-1-flash-1017` - [PR #48879](https://github.com/BerriAI/litellm/pull/48879)

### Ollama

- Forward `api_key`, headers and timeout on native Ollama embeddings - [PR #48707](https://github.com/BerriAI/litellm/pull/48707)
- Forward assistant tool call ids in `ollama_chat` requests - [PR #49278](https://github.com/BerriAI/litellm/pull/49278)
- Price `ollama/` and `ollama_chat/` calls from the local cost map, free when unmapped, instead of querying the Ollama server during cost calculation - [Commit 322457c](https://github.com/BerriAI/litellm/commit/322457c62b76e839e100d385e96cb341cd763d3f)

### OpenAI

- Honor per-deployment workload identity on non-chat OpenAI routes - [PR #39966](https://github.com/BerriAI/litellm/pull/39966)
- Route `gpt-transcribe` to the GPT audio transcription config and bill it from `usage.seconds` when no duration is known - [PR #44021](https://github.com/BerriAI/litellm/pull/44021)
- Return provider response headers on non-streaming OpenAI-compatible chat completions, leaving out header values HTTP cannot carry - [PR #46928](https://github.com/BerriAI/litellm/pull/46928)
- Send chat completions through the OpenAI client's `post`, so the SDK's per-message param transform no longer holds the event loop on large prompts - [PR #46967](https://github.com/BerriAI/litellm/pull/46967)
- Return the served `service_tier` on `aiohttp_openai` responses - [PR #47263](https://github.com/BerriAI/litellm/pull/47263)
- Log a warning naming the model, the level and the fix when the GPT-5 reasoning effort gate drops `reasoning_effort` under `drop_params` - [PR #47761](https://github.com/BerriAI/litellm/pull/47761)
- Update `gpt-6-luna` Decisions cache rates from the Decisions guide - [PR #48066](https://github.com/BerriAI/litellm/pull/48066)
- Add the 12-hour cache write rate for `gpt-5.6-cyber` - [PR #48246](https://github.com/BerriAI/litellm/pull/48246)
- Add OpenAI batch and ultrafast 12-hour cache write rates for the GPT-6 and GPT-5.6 families - [PR #48433](https://github.com/BerriAI/litellm/pull/48433)
- Remove the `dall-e-2` and `dall-e-3` code paths after OpenAI's shutdown; `image_generation` without a model now fails locally with `model is required`, and image edits and variations no longer send `dall-e-2` - [PR #48703](https://github.com/BerriAI/litellm/pull/48703)
- Drop the `gpt-5-nano` priority input price OpenAI does not sell, which showed 50x the standard rate in `/model/info` and SDK estimates - [PR #48763](https://github.com/BerriAI/litellm/pull/48763)

### OpenCode Go

- Forward caller-supplied stable session metadata to OpenCode across Chat Completions, Responses and Messages - [PR #48121](https://github.com/BerriAI/litellm/pull/48121)
- Bill OpenCode Go requests from the reported `usage.opencode.list_cost`, keeping static rows as the fallback - [PR #48254](https://github.com/BerriAI/litellm/pull/48254)

### Abliteration

- Add Abliteration model pricing and capabilities and list the provider in the Add Model form - [PR #48498](https://github.com/BerriAI/litellm/pull/48498)

### ai&

- Show ai&'s name and logo in the dashboard and retire `deepseek-v4-flash`, `glm-5.2` and `kimi-k2.7-code` from its model list - [PR #49158](https://github.com/BerriAI/litellm/pull/49158)

### AWS Polly

- Read the Polly engine from the bare model name, so `standard` and other engines are no longer sent as `neural` - [PR #47963](https://github.com/BerriAI/litellm/pull/47963)

### Cerebras

- Add the `cerebras/llama-3.1-8b` and `cerebras/llama-3.1-70b` hyphenated aliases - [PR #48158](https://github.com/BerriAI/litellm/pull/48158)

### DeepInfra

- Add DeepInfra `DeepSeek-V4.1-Flash` and `DeepSeek-V4.1-Flash-1017` at the current promo rate - [PR #47132](https://github.com/BerriAI/litellm/pull/47132)

### ElevenLabs

- Map `wav` and `pcm` TTS formats to ElevenLabs' 24kHz output formats - [PR #48455](https://github.com/BerriAI/litellm/pull/48455)

### Fireworks AI

- Mark `fireworks_ai/minimax-m3` as vision capable, so image requests are no longer refused with a 400 before the call - [PR #43390](https://github.com/BerriAI/litellm/pull/43390)
- Enable function calling and tool choice for `fireworks_ai` `deepseek-v4p1-flash-1017` - [PR #47326](https://github.com/BerriAI/litellm/pull/47326)
- Add standard prices to `fireworks_ai` `minimax-m3p1-flash` - [PR #47371](https://github.com/BerriAI/litellm/pull/47371)
- Add 2026-11-07 deprecation dates to Fireworks `gpt-oss-120b`, Nemotron and Inkling rows from the prices API - [PR #47518](https://github.com/BerriAI/litellm/pull/47518)
- Add the 2026-11-07 `deprecation_date` to `fireworks_ai` `glm-5p3-flash-us` - [PR #47591](https://github.com/BerriAI/litellm/pull/47591)
- Add `fireworks_ai` `deepseek-v4p1-flash-1017-us` at the US-only premium - [PR #47667](https://github.com/BerriAI/litellm/pull/47667)
- Add priority prices for Muse Spark Open on Fireworks AI - [PR #47785](https://github.com/BerriAI/litellm/pull/47785)
- Add a 2026-08-14 `deprecation_date` to `fireworks_ai` `deepseek-v4-flash` - [PR #49146](https://github.com/BerriAI/litellm/pull/49146)

### FriendliAI

- Drop LiteLLM-internal assistant fields before sending to FriendliAI, so multi-turn Claude Code sessions no longer fail after the first tool call - [PR #45092](https://github.com/BerriAI/litellm/pull/45092)

### Groq

- Accept streamed reasoning replies in Groq chat history - [PR #48268](https://github.com/BerriAI/litellm/pull/48268)

### Hosted vLLM

- Accept the vLLM production-stack router's file and batch objects, which omit `object` and report `pending` and `running` statuses, instead of answering 500 - [PR #49068](https://github.com/BerriAI/litellm/pull/49068)

### Hugging Face

- Stop forcing `truncate=false` on TEI rerank and pass truncate params through - [PR #48706](https://github.com/BerriAI/litellm/pull/48706)

### Morph

- Support Morph open-weight chat models and cached input pricing - [PR #48676](https://github.com/BerriAI/litellm/pull/48676)

### NVIDIA Riva

- Add `riva_offline` mode for offline-only ASR models, answering 413 for audio over the server's message limit - [PR #41021](https://github.com/BerriAI/litellm/pull/41021)

### OCI

- Keep every system instruction for Gemini models on OCI by merging them into one leading system message - [PR #49458](https://github.com/BerriAI/litellm/pull/49458)

### OpenRouter

- List OpenRouter's live catalog for `openrouter/*` when `check_provider_endpoint` is on, keeping only chat-callable ids and fetching off the event loop - [PR #48820](https://github.com/BerriAI/litellm/pull/48820)
- Record the upstream provider OpenRouter served in the logging payload and spend logs as `upstream_provider` - [PR #49287](https://github.com/BerriAI/litellm/pull/49287)
- Report the model OpenRouter served on streamed responses, cached replays included - [PR #49498](https://github.com/BerriAI/litellm/pull/49498)

### Refuseless

- Update Refuseless GLM 5.3 and DeepSeek V4.1 Flash prices - [PR #48844](https://github.com/BerriAI/litellm/pull/48844)

### SageMaker

- Parse every streamed SageMaker record however the payload parts are cut, so split events no longer drop the rest of the answer - [PR #47495](https://github.com/BerriAI/litellm/pull/47495)

### Tencent

- Add Seedream image generation and editing through TokenHub, priced from TokenHub usage - [PR #48735](https://github.com/BerriAI/litellm/pull/48735)

### Together AI

- Add `together_ai/reflection/Beam-1.0-501B-A23B` - [PR #46964](https://github.com/BerriAI/litellm/pull/46964)
- Add `together_ai/deepseek-ai/DeepSeek-V4.1-Flash-1017` - [PR #47291](https://github.com/BerriAI/litellm/pull/47291)
- Add a 2026-11-06 `deprecation_date` to two `together_ai` rows - [PR #48651](https://github.com/BerriAI/litellm/pull/48651)
- Set `together_ai/Qwen/Qwen3.7-Max` back to the published 1.50 USD input and 4.50 USD output per 1M tokens - [PR #49125](https://github.com/BerriAI/litellm/pull/49125)
- Add a 2026-11-04 `deprecation_date` to `together_ai` `Qwen3.8-2.4T-A95B` - [PR #49542](https://github.com/BerriAI/litellm/pull/49542)

### VolcEngine

- Add Doubao-Seedance video generation on `/v1/videos`, with status, content, list, delete, edit and extension mapped to the Ark task API - [PR #46156](https://github.com/BerriAI/litellm/pull/46156)

### Weights and Biases

- Add W&B `reflection/Beam-1.0-501B-A23B` and `GLM-5.3` to the cost map - [PR #47690](https://github.com/BerriAI/litellm/pull/47690)
- Set the W&B `GLM-5.2` `max_input_tokens` to 262,000 from the CoreWeave Forge page - [PR #49148](https://github.com/BerriAI/litellm/pull/49148)
- Set the W&B `DeepSeek-V3.1` and `Llama-3.1-8B` `max_input_tokens` to 128,000 from the CoreWeave Forge page - [PR #49616](https://github.com/BerriAI/litellm/pull/49616)

### Z.AI

- Support `response_format` and `max_completion_tokens` on Z.AI, add `zai/GLM-5.3` and `zai/GLM-5.3-Flash` aliases and price `glm-5v-turbo` - [PR #48335](https://github.com/BerriAI/litellm/pull/48335)

### Model catalog and pricing

- Add Perplexity `pplx-decider` v1.2 and flash v1.2 rows with latest aliases, and add Azure Mistral and Vertex Gemini deprecation dates - [PR #47114](https://github.com/BerriAI/litellm/pull/47114)
- Add VolcEngine `doubao-seed-2-1-pro-260915` and `doubao-seed-2-1-lite-260915`, and undated `azure/eu` and `azure/us` rows for `o1`, `o3`, `o3-mini`, `o4-mini`, `gpt-4o` and `gpt-4o-mini` - [PR #47561](https://github.com/BerriAI/litellm/pull/47561)
- Add ElevenLabs v4 and Flash/Turbo TTS rows at API rates, Together `minimax-m3.1-flash`, Mistral Voxtral 3 transcription and TTS rows, and Azure AI Phi-4 retirement dates - [PR #47623](https://github.com/BerriAI/litellm/pull/47623)
- Add provider retirement dates, fix Azure AI Sonnet 5.5 prices, add Fireworks spot routers and Azure `gpt-6.1-terra` rows, update the Azure AI `mistral-small-2503` retirement date, and absorb GPT-5.6 Terra and Luna price fields and Groq caching prices from the rolling audit - [PR #48188](https://github.com/BerriAI/litellm/pull/48188)
- Drop the legacy `max_tokens` field from the cost map in favor of `max_input_tokens` and `max_output_tokens` - [PR #48471](https://github.com/BerriAI/litellm/pull/48471)
- Skip cost map rules in the old `extends` or mixed format with a warning, since every shipped cost map now uses the split routing and capability rule format - [PR #48737](https://github.com/BerriAI/litellm/pull/48737)
- Add Gemini long-prompt batch rates and Azure GPT-6 Astra long-context flex rates from the rolling registry audit - [PR #49114](https://github.com/BerriAI/litellm/pull/49114)

## LLM API Endpoints

### Responses API

- Log and bill every round of a non-streaming MCP auto-execute on the outer call - [PR #43667](https://github.com/BerriAI/litellm/pull/43667)
- Report the requested model in the nested `response.model` of streamed Responses events, background `response.queued` and guardrail block frames included - [PR #46662](https://github.com/BerriAI/litellm/pull/46662)
- Round-trip Anthropic compaction blocks as Responses `compaction` items, so the next turn reuses the summary instead of compacting again - [PR #46754](https://github.com/BerriAI/litellm/pull/46754)
- Bill every round of a streamed MCP auto-execute on one spend row, bridged providers included - [PR #47445](https://github.com/BerriAI/litellm/pull/47445)
- Bill the partial usage of a Responses stream that fails mid-way, end it with an error, honor `stream_timeout` between chunks, and report bridged `/v1/messages` failures to the proxy's failure hooks - [PR #47537](https://github.com/BerriAI/litellm/pull/47537)
- Honor `max_agentic_loops` as the round cap for streamed MCP auto-execute - [PR #47688](https://github.com/BerriAI/litellm/pull/47688)
- Keep every MCP tool round in the follow-up input of a streamed Responses MCP auto-execute - [PR #47698](https://github.com/BerriAI/litellm/pull/47698)
- Honor per-call custom pricing on the native Responses API path, bound to the request instead of registered globally - [PR #48119](https://github.com/BerriAI/litellm/pull/48119)
- Replay `web_search_call` input items that have no `action` - [PR #48417](https://github.com/BerriAI/litellm/pull/48417)
- Skip failed spend-log turns when rebuilding a session from `previous_response_id` - [PR #48647](https://github.com/BerriAI/litellm/pull/48647)
- Reject, or drop under `drop_params`, Responses params the chat completions bridge cannot translate - [PR #48655](https://github.com/BerriAI/litellm/pull/48655)
- Keep typed output parts when the provider omits `logprobs` - [PR #48686](https://github.com/BerriAI/litellm/pull/48686)
- Forward the top-level `moderation` param to OpenAI - [PR #48708](https://github.com/BerriAI/litellm/pull/48708)
- Stream every citation batch before completion, holding citations until reasoning closes - [PR #48747](https://github.com/BerriAI/litellm/pull/48747)
- Drop the null `created_by` OpenAI rejects when output items are replayed as input - [PR #48783](https://github.com/BerriAI/litellm/pull/48783)
- Resume background response streams from OpenAI and Azure with `stream` and `starting_after` on `GET /v1/responses/{id}` and `aget_responses` - [PR #48819](https://github.com/BerriAI/litellm/pull/48819)
- Normalize an empty `function_call_output` to an empty tool result - [PR #48845](https://github.com/BerriAI/litellm/pull/48845)
- Drop params the compact endpoint rejects for OpenAI and Azure, and send Azure compaction to the v1 route - [PR #48876](https://github.com/BerriAI/litellm/pull/48876)
- Replay the original Responses item order, `phase` and message boundaries on the next chat turn - [PR #48912](https://github.com/BerriAI/litellm/pull/48912)
- Support Codex client `tool_search` on Anthropic and other bridged providers, keeping tools loaded by earlier searches across `previous_response_id` - [PR #48972](https://github.com/BerriAI/litellm/pull/48972)
- Keep each Codex tool once when its tool list repeats across turns on the Bedrock chat bridge and Mantle - [PR #49006](https://github.com/BerriAI/litellm/pull/49006)
- Send `text.verbosity` as chat `verbosity` when a Responses request is bridged to chat completions, including client tool search follow-up turns - [PR #49049](https://github.com/BerriAI/litellm/pull/49049)
- Keep the proxy's decoded error body, code and type on `litellm.responses()` errors from `litellm_proxy/` models, matching chat completions - [PR #49073](https://github.com/BerriAI/litellm/pull/49073)
- Send a dict `reasoning_effort` the same way on every Responses bridge, so Azure and ChatGPT keep `mode` and `context`, and drop or reject reasoning fields xAI, Fireworks and Perplexity ignore - [PR #49082](https://github.com/BerriAI/litellm/pull/49082)
- Merge repeated Codex tools from `additional_tools` input items only when `drop_params` is on, and forward every copy otherwise - [PR #49112](https://github.com/BerriAI/litellm/pull/49112)

### Chat Completions over the Responses API bridge

- Send the whole `reasoning_effort` dict when chat is bridged to Responses, dropping only a `mode` or `context` the model does not take under `drop_params` - [PR #48807](https://github.com/BerriAI/litellm/pull/48807)

### Anthropic Messages API

- Carry `safeguard_results` and `stop_details` in synthesized `message_delta` events, so Claude Code auto mode keeps the classifier verdict - [PR #46096](https://github.com/BerriAI/litellm/pull/46096)
- Send `/v1/messages` PDF documents to OpenAI-shaped providers as file parts, and answer 400 or drop them for models that cannot read PDFs - [PR #47166](https://github.com/BerriAI/litellm/pull/47166)
- Answer 400 naming the block for a malformed `tool_result` text on `/v1/messages` and `/v1/messages/count_tokens` for OpenAI and Azure models, or drop it under `drop_params` - [PR #47347](https://github.com/BerriAI/litellm/pull/47347)
- Keep tool names over 64 characters when a guardrail rewrites a `/v1/messages` request, so Bedrock no longer rejects mismatched `tool_reference` and `tool_choice` names - [PR #47434](https://github.com/BerriAI/litellm/pull/47434)
- Include a null `stop_sequence` in native `/v1/messages` responses - [PR #47987](https://github.com/BerriAI/litellm/pull/47987)
- Release the upstream `/v1/messages` stream when the client disconnects - [PR #48220](https://github.com/BerriAI/litellm/pull/48220)
- Keep `/v1/messages` requests with `stop_sequences` off the OpenAI Responses bridge so the stop sequences apply - [PR #48534](https://github.com/BerriAI/litellm/pull/48534)
- Merge deployment and client `anthropic-beta` values instead of letting the client's overwrite the deployment's - [PR #48594](https://github.com/BerriAI/litellm/pull/48594)
- Estimate initial input tokens on `message_start` for bridged `/v1/messages` streams without fetching images - [PR #48618](https://github.com/BerriAI/litellm/pull/48618)
- Make opening usage estimates on bridged streams opt-in through `anthropic_messages_estimate_initial_input_tokens` - [PR #48633](https://github.com/BerriAI/litellm/pull/48633)
- Drop the non-spec `custom` object from `/v1/messages` tool definitions, which Anthropic and Vertex reject, hoisting `custom.defer_loading` to `defer_loading` on Claude routes - [PR #48893](https://github.com/BerriAI/litellm/pull/48893)
- Keep Mistral thinking text on streaming `/v1/messages` - [PR #49059](https://github.com/BerriAI/litellm/pull/49059)
- Retry `/v1/messages` once without `strict` when Claude rejects strict tools under `drop_params` - [PR #49102](https://github.com/BerriAI/litellm/pull/49102)
- Price a native `/v1/messages` body as served unless its provider reports its own cost, billing the requested `speed` when the body reports none - [PR #49356](https://github.com/BerriAI/litellm/pull/49356)

### Web search interception

- Keep the provider prefix on the agentic follow-up model, so routes such as `bedrock/mantle/` no longer fail with `LLM Provider NOT provided` - [PR #38885](https://github.com/BerriAI/litellm/pull/38885)
- Stream the native `server_tool_use` and `web_search_tool_result` blocks to Anthropic SDK, Claude Desktop and Claude Code clients, so citation panels and result counts fill in - [PR #40967](https://github.com/BerriAI/litellm/pull/40967)
- Search only the query inside Claude Code's web search prompt in the short-circuit search - [PR #43458](https://github.com/BerriAI/litellm/pull/43458)

### Count tokens

- Count a message history that carries an Anthropic compaction block by adding the compaction beta on Anthropic and Vertex count calls, instead of answering 500 - [PR #44784](https://github.com/BerriAI/litellm/pull/44784)
- Count tools the way DeepSeek V4 and Qwen3.5 chat templates render them - [PR #47173](https://github.com/BerriAI/litellm/pull/47173)
- Count DeepSeek V3 and V4 text with DeepSeek's bundled tokenizer instead of `cl100k_base` - [PR #47353](https://github.com/BerriAI/litellm/pull/47353)
- Count Responses and chat input tokens for Claude the way inference sends the request, translating tool use first and answering 400 on translation errors - [PR #47363](https://github.com/BerriAI/litellm/pull/47363)
- Price PDF pages for OpenAI and Azure models the way they bill, counting only drawn images - [PR #47554](https://github.com/BerriAI/litellm/pull/47554)
- Stop re-downloading a Hugging Face tokenizer after a failed download until the retry window passes - [PR #47586](https://github.com/BerriAI/litellm/pull/47586)
- Count inline `auto` detail image tiles from bounded data URLs without fetching caller URLs - [PR #48526](https://github.com/BerriAI/litellm/pull/48526)
- Count an Anthropic-format `tool_choice` without a `KeyError` - [PR #48624](https://github.com/BerriAI/litellm/pull/48624)
- Count search result blocks and reject unsupported blocks on Anthropic token counts - [PR #48699](https://github.com/BerriAI/litellm/pull/48699)
- Count OpenAI models newer than tiktoken's table with `o200k_base` - [PR #48728](https://github.com/BerriAI/litellm/pull/48728)
- Read one-object, null and list spellings of repeated fields in Google `countTokens` and `generateContent`, matching Vertex - [PR #48771](https://github.com/BerriAI/litellm/pull/48771)
- Answer 400 before counting a Responses request whose only tool is a built-in tool with no Claude equivalent - [PR #48798](https://github.com/BerriAI/litellm/pull/48798)
- Keep the framed local estimate when a cost-map `token_count_model` for Bedrock cannot count, while an admin-set one keeps its error - [PR #48805](https://github.com/BerriAI/litellm/pull/48805)
- Keep a loaded Hugging Face tokenizer when a slower download fails, retrying once per `HUGGINGFACE_TOKENIZER_LOAD_RETRY_SECONDS` window - [PR #48916](https://github.com/BerriAI/litellm/pull/48916)

### Prompt caching

- Stop stripping `cache_control` from the caller's own messages and tools on OpenAI, Fireworks AI and other providers, so a fallback keeps the hints, and trim extra Claude cache hints under `drop_params` - [PR #35602](https://github.com/BerriAI/litellm/pull/35602)
- Pick the chat-path `cache_control` dialect from the deployment's provider prefix, so chat and `/v1/messages` send the same cache format on an `azure_ai` deployment - [PR #45295](https://github.com/BerriAI/litellm/pull/45295)
- Drop a malformed `prompt_cache_breakpoint` under `drop_params` on the direct `/v1/responses` path - [PR #45330](https://github.com/BerriAI/litellm/pull/45330)
- Send `prompt_cache_retention` to OpenAI from `completion()`, `Router.completion()` and `/v1/chat/completions` instead of silently dropping it - [PR #47480](https://github.com/BerriAI/litellm/pull/47480)
- Stop counting the cache mark on a server tool call that never ran, so the cache control hook keeps within Anthropic's breakpoint limit - [PR #49468](https://github.com/BerriAI/litellm/pull/49468)

### Context management

- Honor `clear_at_least`, `exclude_tools` and `clear_tool_inputs` in the `clear_tool_uses` polyfill, matching the Anthropic API - [PR #47123](https://github.com/BerriAI/litellm/pull/47123)
- Count the system prompt toward the `clear_tool_uses` `input_tokens` trigger, matching Anthropic - [PR #47857](https://github.com/BerriAI/litellm/pull/47857)
- Run `clear_tool_uses_20250919` in the gateway when `/v1/messages` goes to OpenAI models through the Responses API, returning `applied_edits`, instead of dropping it without a warning - [PR #47861](https://github.com/BerriAI/litellm/pull/47861)

### Realtime

- Send the Gemini Live setup on the client's first message, so a `session.update` with `output_modalities` or `modalities` applies instead of every answer coming back as audio - [PR #39864](https://github.com/BerriAI/litellm/pull/39864)
- Add Soniox realtime speech-to-text on `/v1/realtime` with server VAD, manual finalize, translation sessions and cost from processed audio duration - [PR #44822](https://github.com/BerriAI/litellm/pull/44822)
- Keep `turn_detection.type` when a transcript guardrail turns off auto-response - [PR #44939](https://github.com/BerriAI/litellm/pull/44939)
- Route Azure WebRTC `client_secrets` and `calls` to the GA `/openai/v1/realtime` API with the ephemeral key as a bearer, since the preview surface returns 404 - [PR #47316](https://github.com/BerriAI/litellm/pull/47316)

### Batches and files

- Let proxy admin keys read raw `gs://` and `s3://` file ids on `GET /files/{id}/content`, fixing the last step of the unmanaged Vertex batch flow; other keys get 403, and the id is fully decoded before the check - [PR #40621](https://github.com/BerriAI/litellm/pull/40621)
- Stop forwarding `api_version` to the OpenAI fine-tuning client, which failed every call with an unexpected keyword argument - [PR #44995](https://github.com/BerriAI/litellm/pull/44995)
- Batch Vertex AI Claude models under `publishers/anthropic/models/` in Anthropic's native row shape instead of failing with 404 - [PR #45715](https://github.com/BerriAI/litellm/pull/45715)
- Return a 400 that names the line for malformed Bedrock batch JSONL lines instead of a 500 - [PR #45992](https://github.com/BerriAI/litellm/pull/45992)
- Send provider file ids for `training_file` and `validation_file` when creating a fine-tuning job from managed files - [PR #46552](https://github.com/BerriAI/litellm/pull/46552)
- Scope provider and model file lists to the caller's managed files under `require_managed_files`, paged with `after_id` and `before_id` - [PR #47682](https://github.com/BerriAI/litellm/pull/47682)
- Return real batch token counts next to OpenAI's batch usage fields from retrieve and the cost poller - [PR #47740](https://github.com/BerriAI/litellm/pull/47740)
- Stop unbillable batches from blocking file deletes and new-batch polling - [PR #48752](https://github.com/BerriAI/litellm/pull/48752)
- Cost an unmanaged `gs://` batch through the deployment that created it - [PR #49301](https://github.com/BerriAI/litellm/pull/49301)

### Vector Stores

- Use an HTTP/2 httpx client for the Vertex AI `search_api` vector store, with `litellm.http2` or `LITELLM_HTTP2=False` as the opt-out - [PR #40631](https://github.com/BerriAI/litellm/pull/40631)
- Route a team key's model-less vector store calls to a team deployment of the store's provider instead of the team's first deployment - [PR #46894](https://github.com/BerriAI/litellm/pull/46894)
- Add Amazon OpenSearch k-NN search as a vector store provider, signing `on.aws` and FIPS hosts, with an entry in the vector store provider dropdown - [PR #47759](https://github.com/BerriAI/litellm/pull/47759)
- Put the Azure vector store id before the `api-version` query on retrieve, update and delete, which returned 404 - [PR #48224](https://github.com/BerriAI/litellm/pull/48224)

### Search

- Add DeepSeek as a `/v1/search` provider at 0.00075 USD per query, rejecting queries over 128 characters before the call - [PR #47401](https://github.com/BerriAI/litellm/pull/47401)
- Price Tavily advanced and Linkup deep searches at their own cost map entries - [PR #47411](https://github.com/BerriAI/litellm/pull/47411)
- Return highlights, highlight scores, score and the response envelope from Exa search - [PR #47423](https://github.com/BerriAI/litellm/pull/47423)
- Add native xAI X Search on `/v1/search` - [PR #48677](https://github.com/BerriAI/litellm/pull/48677)
- Return `raw_content`, `score`, `favicon` and the response envelope from Tavily search - [PR #48684](https://github.com/BerriAI/litellm/pull/48684)
- Forward every Perplexity search filter unchanged instead of a fixed subset - [PR #49344](https://github.com/BerriAI/litellm/pull/49344)

### Images, audio and video

- Keep `model_id` in proxy video ids, so per-model keys resolve on `GET /v1/videos/{id}` and `/content` - [PR #44614](https://github.com/BerriAI/litellm/pull/44614)
- Answer 400 with `UnsupportedEndpointError` for providers that do not support audio transcription - [PR #47971](https://github.com/BerriAI/litellm/pull/47971)
- Forward `max_retries` to the OpenAI-compatible image client and pin it to 0 for routed calls, so the Router is the only retry owner - [PR #48705](https://github.com/BerriAI/litellm/pull/48705)
- Treat an absent `image` as an empty list in async image edits - [PR #48872](https://github.com/BerriAI/litellm/pull/48872)
- Support `outputContentFormat=markdown` for Azure Document Intelligence OCR, in any casing, reporting `stringIndexType` on the response - [PR #48926](https://github.com/BerriAI/litellm/pull/48926)
- Stop the router image check from answering 500 on a list input to `/v1/moderations` - [PR #49454](https://github.com/BerriAI/litellm/pull/49454)

### Extraction

- Add `/v1/extraction` with Cloudflare Clairic support, guardrail scanning, Clairic billing and a 400 for `stream=true` unless `drop_params` drops it - [PR #47473](https://github.com/BerriAI/litellm/pull/47473)

### Interactions

- Keep background interaction bills through worker crashes and late restarts, polling with the serving deployment's credentials and keeping the request's tags and metadata - [PR #45743](https://github.com/BerriAI/litellm/pull/45743)

### Pass-through endpoints

- Send the deployment `api_key` or `VLLM_API_KEY` as a bearer on both `/vllm` pass-through routes - [PR #46861](https://github.com/BerriAI/litellm/pull/46861)
- Add the `/eu_jev/v1/systemone` pass-through for the EU-hosted eu/jev decision API, reading `EU_JEV_API_KEY`, with spend tracking and `eu_jev/eu-jeff-1.0.0` pricing - [PR #46875](https://github.com/BerriAI/litellm/pull/46875)
- Add `general_settings.vertex_ai_pass_through_drop_anthropic_betas` to drop chosen `anthropic-beta` values on the Vertex AI pass-through routes, including values sent through `x-pass-anthropic-beta` - [PR #47185](https://github.com/BerriAI/litellm/pull/47185)
- Let pass-through upstreams report the model name in `x-litellm-upstream-model`, recorded on success and failure rows - [PR #48275](https://github.com/BerriAI/litellm/pull/48275)
- Forward the client's `OpenAI-Beta` header on the OpenAI pass-through and default `agents=v1` on `/v1/agents` and `/v1/vaults` paths - [PR #49009](https://github.com/BerriAI/litellm/pull/49009)
- Log the URL model and the declared provider on Gemini and Vertex pass-through failures, so failure rows and Prometheus counters no longer show an empty model - [PR #49075](https://github.com/BerriAI/litellm/pull/49075)
- Let a WebSocket pass-through relay bill a session from the client text frames it delivers, for upstreams that report no usage - [PR #49281](https://github.com/BerriAI/litellm/pull/49281)
- Add Deepgram streaming text-to-speech WebSocket routes on `/deepgram/v1/speak` and `/deepgram/speak` - [PR #49282](https://github.com/BerriAI/litellm/pull/49282)
- Forward a valid client `metadata.user_id` to Anthropic Messages on pass-through routes, only for Messages create on the Anthropic base and only when no guardrail scans the request - [PR #49333](https://github.com/BerriAI/litellm/pull/49333)
- Read `/watsonx` pass-through credentials from the deployment flagged `use_in_pass_through`, falling back to `WATSONX_API_KEY` and `WATSONX_API_BASE` - [PR #49462](https://github.com/BerriAI/litellm/pull/49462)
- Fit the Deepgram listen unpriced-model refusal within a WebSocket close frame - [PR #49502](https://github.com/BerriAI/litellm/pull/49502)

### Agents

- Add `Harness.PI`, which runs the pi coding agent CLI for `litellm.agent()` against the per-session model endpoint without reading the user's own pi settings - [PR #45467](https://github.com/BerriAI/litellm/pull/45467)
- Set `PWD` to the sandbox working directory for local sandbox commands, so OpenCode turns in `litellm.agent()` work inside the sandbox - [PR #47530](https://github.com/BerriAI/litellm/pull/47530)
- Serve the `/a2a/{agent_id}/message/stream` routes - [PR #49471](https://github.com/BerriAI/litellm/pull/49471)
- Send an agent's `litellm_params.api_key` as bearer auth on the A2A hop - [PR #49474](https://github.com/BerriAI/litellm/pull/49474)
- Answer proxy refusals on `/a2a` POST routes as JSON-RPC errors - [PR #49476](https://github.com/BerriAI/litellm/pull/49476)
- Show non-admin callers the proxy URL in agent cards instead of the backend agent URL, and drop alternate backend interfaces from their cards - [PR #49483](https://github.com/BerriAI/litellm/pull/49483)
- Log authenticated A2A calls that the proxy rejects before dispatch - [PR #49492](https://github.com/BerriAI/litellm/pull/49492)

### SDK

- Treat `initial_prompt_value` and `final_prompt_value` as optional in custom prompt templates - [PR #39762](https://github.com/BerriAI/litellm/pull/39762)
- Decide MCP gateway routing without importing the proxy handler, so a base SDK install no longer fails with `ModuleNotFoundError` on function-tool calls and every `responses()` call - [PR #45961](https://github.com/BerriAI/litellm/pull/45961)
- Hand out bytes buffered before an aiohttp connection drops, so a cut stream bills its partial usage - [PR #47838](https://github.com/BerriAI/litellm/pull/47838)
- Name the timeout phase and the limit that fired in `litellm.Timeout` messages instead of `after None seconds` - [PR #48250](https://github.com/BerriAI/litellm/pull/48250)
- Honor an empty `mock_response` - [PR #48266](https://github.com/BerriAI/litellm/pull/48266)
- Support Python 3.15 - [PR #48359](https://github.com/BerriAI/litellm/pull/48359)
- Close an owned aiohttp session when its transport is garbage collected - [PR #48650](https://github.com/BerriAI/litellm/pull/48650)
- Keep the owned aiohttp session open while a response stream is still being read - [PR #48920](https://github.com/BerriAI/litellm/pull/48920)
- Log a warning naming the pool limits when a request waits more than a second for a pooled aiohttp connection - [PR #49499](https://github.com/BerriAI/litellm/pull/49499)

### General

- Honor the status code when mapping OpenAI `invalid_request_error` exceptions, so 401 and 404 bodies no longer become `BadRequestError` - [PR #32537](https://github.com/BerriAI/litellm/pull/32537)
- Convert upstream logprobs on streamed chunks so streams with `logprobs` end with their finish chunk - [PR #33549](https://github.com/BerriAI/litellm/pull/33549)
- Keep `prompt_tokens_details` and `completion_tokens_details` when a streamed chunk carries dict usage - [PR #36678](https://github.com/BerriAI/litellm/pull/36678)
- Restore the tokenizer estimate for streams that send no usage, instead of logging them at 0 tokens and $0 - [PR #44230](https://github.com/BerriAI/litellm/pull/44230)
- Keep `finish_reason` and provider usage when rebuilding streamed text completions - [PR #44349](https://github.com/BerriAI/litellm/pull/44349)
- Answer 400 before the call when an embedding request carries more inputs than the deployment's `max_embedding_batch_size`, counting `extra_body.input` too - [PR #44574](https://github.com/BerriAI/litellm/pull/44574)
- Cut per-chunk pydantic round trips on OpenAI-compatible streams - [PR #47030](https://github.com/BerriAI/litellm/pull/47030)
- Report the deployment's configured `api_base` when a chat or native Responses stream fails mid-way, without adding the prompt to the error - [PR #47045](https://github.com/BerriAI/litellm/pull/47045)
- Send the `include_usage` chunk with an empty `choices` array when the caller set `stream_options.include_usage` - [PR #47109](https://github.com/BerriAI/litellm/pull/47109)
- Map stream read timeouts to `litellm.Timeout` on chat, `/v1/messages` and `/v1/responses`, keeping mid-stream fallback on a stall - [PR #47198](https://github.com/BerriAI/litellm/pull/47198)
- Join `api_base` and route with one shared helper, so trailing slashes no longer produce `//` URLs on Perplexity search, Ollama embeddings, DashScope, VolcEngine, GigaChat and other providers - [PR #47535](https://github.com/BerriAI/litellm/pull/47535)
- Fail a stream that ends without a finish reason instead of treating it as complete - [PR #47665](https://github.com/BerriAI/litellm/pull/47665)
- Match the SSE `[DONE]` marker exactly, so text or errors that mention `[DONE]` no longer end a stream - [PR #47832](https://github.com/BerriAI/litellm/pull/47832)
- Recognize OpenAI `context_length_exceeded` errors as `ContextWindowExceededError` - [PR #47954](https://github.com/BerriAI/litellm/pull/47954)
- Omit stream usage on `/v1/completions` unless the caller asked for it - [PR #48052](https://github.com/BerriAI/litellm/pull/48052)
- Surface upstream abort finish reasons as server errors - [PR #48328](https://github.com/BerriAI/litellm/pull/48328)
- Map SGLang context window overflow errors to `ContextWindowExceededError` - [PR #48837](https://github.com/BerriAI/litellm/pull/48837)
- Move later developer messages into the leading system message for models whose cost map sets `supports_mid_conversation_system` to false, and merge consecutive system messages in linear time - [PR #48897](https://github.com/BerriAI/litellm/pull/48897)
- Warn when `drop_params` drops a requested reasoning level on the remaining provider paths, including Gemini non-integer thinking budgets, logging one warning per request - [PR #48933](https://github.com/BerriAI/litellm/pull/48933)
- Put LiteLLM's bill in `usage.cost` on the last streamed usage frame - [PR #48955](https://github.com/BerriAI/litellm/pull/48955)
- Rebuild each choice of an `n>1` chat stream on its own, so guardrails, spend logs and callbacks see every choice - [PR #49002](https://github.com/BerriAI/litellm/pull/49002)
- Keep the upstream error body and headers on `e.response` for OpenAI and Azure errors, 429 and 5xx included - [PR #49079](https://github.com/BerriAI/litellm/pull/49079)
- Stop raising and catching AttributeErrors inside pydantic on every streamed OpenAI and Azure chunk - [PR #49166](https://github.com/BerriAI/litellm/pull/49166)
- Keep rerank token usage from Bedrock, hosted vLLM and Together AI in spend logs - [PR #49308](https://github.com/BerriAI/litellm/pull/49308)
- Report finish reason `tool_calls` instead of `stop` after streamed OpenAI-compatible tool calls - [PR #49388](https://github.com/BerriAI/litellm/pull/49388)

## Management Endpoints / UI

### Admin UI

#### Aria

- Merge the gateway assistant and the Usage assistant into one Aria Agent that opens in a floating popup with suggested questions, and prompt it from Usage - [PR #48082](https://github.com/BerriAI/litellm/pull/48082)
- Add usage charts to Aria answers and export an answer, charts included, as a PDF - [PR #48094](https://github.com/BerriAI/litellm/pull/48094)
- Move Aria's empty model state into the model picker - [PR #48223](https://github.com/BerriAI/litellm/pull/48223)
- Keep Aria reachable from the dashboard header - [PR #48454](https://github.com/BerriAI/litellm/pull/48454)
- Bundle the Aria avatar image so it loads on the dashboard dev server and the split-chart nginx image instead of showing a broken image - [PR #48890](https://github.com/BerriAI/litellm/pull/48890)

#### Auto-Routers

- Simplify auto router setup with defaults picked from deployed models, classify each user turn by default, and allow custom models in the simple setup - [PR #48451](https://github.com/BerriAI/litellm/pull/48451)
- Offer the same model groups in the simple auto router setup as in the advanced setup, leaving out only embedding models - [PR #48851](https://github.com/BerriAI/litellm/pull/48851)
- Resolve auto router template suggestions through the ids a `*` catch-all lists, crediting each id to the wildcard and provider the router actually sends it to - [PR #49331](https://github.com/BerriAI/litellm/pull/49331)

#### Chat

- Redesign the Chat page with the Moyai UI, a Models sidebar with an embedded Model Hub, and image generation - [PR #48108](https://github.com/BerriAI/litellm/pull/48108)
- Keep MCP tool results in the conversation across follow-up Chat requests - [PR #48124](https://github.com/BerriAI/litellm/pull/48124)
- Attach PDF, text, Word and Excel documents in Chat - [PR #48137](https://github.com/BerriAI/litellm/pull/48137)
- Let Chat replies, including MCP runs, finish in the background after the browser disconnects and resume when it returns, with a Continue chats in the background setting - [PR #49461](https://github.com/BerriAI/litellm/pull/49461)
- Add a deep research mode to Chat that keeps its web citations with the conversation - [PR #49508](https://github.com/BerriAI/litellm/pull/49508)

#### General

- Show the Chat page by default by changing the `enable_chat_ui` default to `true` - [PR #46918](https://github.com/BerriAI/litellm/pull/46918)
- Count every stable release of the minor line in the upgrade notice for a patch release, so v1.105.1 no longer reads as 0 new features - [PR #46942](https://github.com/BerriAI/litellm/pull/46942)
- Add `LITELLM_UI_USE_SI_TERMINOLOGY=true` to make the Admin UI say SI instead of AI in its own copy, leaving third-party product, provider and law names and user data unchanged - [PR #47440](https://github.com/BerriAI/litellm/pull/47440)
- Show a failed state with a Retry button on the Logs table, Usage spend totals and Caching activity chart when their fetch fails, instead of an empty view - [PR #47671](https://github.com/BerriAI/litellm/pull/47671)
- Take the upgrade notice from the newest stable release in the docs changelog feed and link to its changelog page, instead of GitHub's latest release - [PR #47998](https://github.com/BerriAI/litellm/pull/47998)
- Make headers optional in the pass-through endpoint form, turn authentication on by default and show its switch without the Enterprise badge - [PR #48081](https://github.com/BerriAI/litellm/pull/48081)
- Restore clipboard copy buttons in key details, log details and the audit log drawer - [PR #48425](https://github.com/BerriAI/litellm/pull/48425)
- Render string-valued settings as text inputs on the General Settings page - [PR #48431](https://github.com/BerriAI/litellm/pull/48431)
- Show the search tool tester's error instead of an empty result list when a query fails - [PR #48478](https://github.com/BerriAI/litellm/pull/48478)
- Honor the dark mode and locally uploaded logos from UI theme settings in Connect and Chat - [PR #48532](https://github.com/BerriAI/litellm/pull/48532)
- Keep vendor names such as XecGuard AI and Airia AI, and the copyable Claude Code and Codex agent instructions, in AI wording under `LITELLM_UI_USE_SI_TERMINOLOGY` - [PR #48670](https://github.com/BerriAI/litellm/pull/48670)

#### Guardrails

- Add Delete to the guardrail detail page and share one delete dialog with the table row, which asks for the typed name and warns when a policy pipeline step uses the guardrail - [PR #45893](https://github.com/BerriAI/litellm/pull/45893)
- Keep the Add Guardrail wizard's step navigation inside the dialog - [PR #48688](https://github.com/BerriAI/litellm/pull/48688)

#### Logs

- Percent-encode the request id when opening a spend log's details, so ids with URL special characters load - [PR #48630](https://github.com/BerriAI/litellm/pull/48630)

#### Models + Endpoints

- Show the Kubernetes pods discovered behind a deployment on the model page for admins - [PR #44666](https://github.com/BerriAI/litellm/pull/44666)
- Show admin-defined `custom_tags` and `custom_metadata` from `model_info` in the Model Hub table and model details, including on `model_group_alias` rows - [PR #46064](https://github.com/BerriAI/litellm/pull/46064)
- Add the 1 hour cache write cost to the Add Model and model edit forms - [PR #46830](https://github.com/BerriAI/litellm/pull/46830)
- Show a field error for negative or non-numeric prices in the model edit form instead of saving them - [PR #46978](https://github.com/BerriAI/litellm/pull/46978)
- Keep model parameter deletions after a page refresh - [PR #48456](https://github.com/BerriAI/litellm/pull/48456)
- Persist the display order of model group aliases - [PR #48500](https://github.com/BerriAI/litellm/pull/48500)
- Add Meta Model API to the Add Model provider dropdown - [PR #49314](https://github.com/BerriAI/litellm/pull/49314)
- Restore the Z.AI credential fields in the Add Model provider catalog - [PR #49325](https://github.com/BerriAI/litellm/pull/49325)

#### Playground and Decisions

- Redesign the Playground chat around one composer and an inspector panel - [PR #46934](https://github.com/BerriAI/litellm/pull/46934)
- Include endpoint-qualified models in the Decisions Playground model list - [PR #48504](https://github.com/BerriAI/litellm/pull/48504)
- Show reasoning in the Playground for `/v1/responses` from the current Responses API reasoning events - [PR #48850](https://github.com/BerriAI/litellm/pull/48850)

#### Teams, users and organizations

- Show the caller's own member spend, budget and reset date as My Spend on Your Teams - [PR #45674](https://github.com/BerriAI/litellm/pull/45674)
- Show Never resets instead of n/a for an unset budget reset period, with a single Never resets option in Create Team when no default is set - [PR #47065](https://github.com/BerriAI/litellm/pull/47065)
- Offer access group models and expanded wildcards in the team per-model rate limit and budget pickers, and drop the `no-default-models` sentinel that never matched a request - [PR #47630](https://github.com/BerriAI/litellm/pull/47630)
- Sort every users table data column, with unlimited budgets ordered as infinity - [PR #48105](https://github.com/BerriAI/litellm/pull/48105)
- Sort every organizations table data column - [PR #48106](https://github.com/BerriAI/litellm/pull/48106)
- Sort every teams table data column, with unlimited limits ordered as infinity - [PR #48109](https://github.com/BerriAI/litellm/pull/48109)
- Make the Download CSV Template button in bulk invite download the template - [PR #48199](https://github.com/BerriAI/litellm/pull/48199)
- Add a budget period tooltip with the period dates, max budget, reset interval and spend to the key, team, user and organization spend tiles, and schedule `budget_reset_at` when an organization is created - [PR #48487](https://github.com/BerriAI/litellm/pull/48487)
- Show the budget period date range instead of "cycle" on team member spend - [PR #48488](https://github.com/BerriAI/litellm/pull/48488)
- Keep a team's model grants, including All Proxy Models, when saving unrelated team settings - [PR #49258](https://github.com/BerriAI/litellm/pull/49258)

#### Budgets

- Show the spend limit and rate limits in the create and edit budget dialogs without a collapsed section, and send only changed fields on edit - [PR #47662](https://github.com/BerriAI/litellm/pull/47662)
- Sort budgets by reset duration, with unlimited limits ordered as infinity - [PR #48107](https://github.com/BerriAI/litellm/pull/48107)

#### Usage

- Keep the Usage view, tab, date range and filters in the URL so links can be bookmarked and shared, add a View usage action on Internal Users rows and a Copy Share Link button - [PR #43425](https://github.com/BerriAI/litellm/pull/43425)
- Add a Claude Code and Claude Desktop client usage panel to Usage, scoped to all users, one user or a team's members - [PR #47974](https://github.com/BerriAI/litellm/pull/47974)
- Add a `usage_default_time_range` UI setting (`today`, `last_7_days`, `last_30_days`, `month_to_date` or `year_to_date`) for the range Usage opens with - [PR #48207](https://github.com/BerriAI/litellm/pull/48207)
- Remove the deprecated Old Usage page - [PR #49284](https://github.com/BerriAI/litellm/pull/49284)

#### Virtual Keys

- Prefill the Organization picker in key edit from the `org_id` that `/key/list` returns - [PR #39535](https://github.com/BerriAI/litellm/pull/39535)
- Show the gateway URL and optional Claude Code and Codex setup instructions after creating a key - [PR #47199](https://github.com/BerriAI/litellm/pull/47199)
- Sort virtual keys by expiry, last activity, spend and limits - [PR #48074](https://github.com/BerriAI/litellm/pull/48074)
- Leave a blank expiry out of key edit and regenerate requests - [PR #48634](https://github.com/BerriAI/litellm/pull/48634)

### Keys, teams and authentication

- Refresh the cached team on `/team/block` and `/team/unblock`, so a block or unblock takes effect at once instead of after the cache entry expires - [PR #35643](https://github.com/BerriAI/litellm/pull/35643)
- Apply `default_key_generate_params.allowed_routes` on key generation and to the key type presets it covers, while Full Access and service account keys keep their routes and owners cannot change routes the default set - [PR #41236](https://github.com/BerriAI/litellm/pull/41236)
- Let `/key/update` assign a project to a key that has none - [PR #41700](https://github.com/BerriAI/litellm/pull/41700)
- Use the team's own OpenAI deployment credentials for RAG ingest and query on OpenAI vector stores, and allow viewer and JWT team access to the RAG routes - [PR #45497](https://github.com/BerriAI/litellm/pull/45497)
- Evict a key deleted with `/key/delete` from every worker's auth cache and the Redis copy, instead of only the worker that served the call - [PR #47609](https://github.com/BerriAI/litellm/pull/47609)
- Require the same budget permission for `budget_duration` and `budget_id` changes on `/key/update` as for `max_budget`, so a key owner can no longer reset or lift a capped key's budget - [PR #47681](https://github.com/BerriAI/litellm/pull/47681)
- Scope search tool access in non-admin Admin UI sessions to the user's own grants - [PR #48464](https://github.com/BerriAI/litellm/pull/48464)
- Return a 403 naming the Enterprise license when a key or user is created with `get_spend_routes` permissions on a proxy without a license - [PR #48623](https://github.com/BerriAI/litellm/pull/48623)
- Page `/customer/list` with `page`, `page_size` (default 50, max 100) and a `search` on customer ID or alias, and page the customer filters on Usage - [PR #48700](https://github.com/BerriAI/litellm/pull/48700)
- Enforce team and key Allowed Vector Stores when no vector store registry is loaded, and answer 400 on a malformed `vector_store_ids` - [PR #48915](https://github.com/BerriAI/litellm/pull/48915)

### SSO and SCIM

- Store SCIM `PATCH` enterprise extension attributes, such as manager, in `metadata.scim_enterprise`, merging sub-attributes into what is already stored - [PR #46738](https://github.com/BerriAI/litellm/pull/46738)
- Delete a SCIM group through the team delete's bulk path instead of removing one member at a time - [PR #47544](https://github.com/BerriAI/litellm/pull/47544)
- Refuse only new SSO users past the free 5-user limit with a 403, so existing users can still sign in without an Enterprise license - [PR #48097](https://github.com/BerriAI/litellm/pull/48097)
- Keep a user's teams in record order through SCIM and JWT team sync, so CLI SSO and Claude Code gateway sign-ins bind the same first team, and look up SSO claim groups once per sign-in - [PR #49033](https://github.com/BerriAI/litellm/pull/49033)
- Create the `team_id_jwt_field` team on Admin UI SSO login when `team_id_upsert` is set and JWT auth is on - [PR #49256](https://github.com/BerriAI/litellm/pull/49256)

### Model management

- List every priced Gemini Enterprise Agent Platform (formerly Vertex AI) family, including Mistral, Llama, Qwen, AI21, OpenAI, image, video and embedding rows, under a `vertex_ai/*` grant - [PR #41959](https://github.com/BerriAI/litellm/pull/41959)
- Add `general_settings.return_wildcard_routes` so `/v1/models` lists wildcard routes like `openai/*` by default, while the request's `return_wildcard_routes` still wins - [PR #43624](https://github.com/BerriAI/litellm/pull/43624)
- Match partial wildcards against prefix-stripped model ids on model listings, and list alias wildcards as routable ids instead of raw catalog ids - [PR #46390](https://github.com/BerriAI/litellm/pull/46390)
- Persist the `model_info` fields sent on `POST /model/update`, such as `base_model` and `mode`, so clients like the Terraform provider can change them in place - [PR #46902](https://github.com/BerriAI/litellm/pull/46902)
- Show `return_wildcard_routes` on the Admin UI General Settings page - [PR #47979](https://github.com/BerriAI/litellm/pull/47979)
- Keep the stored secret when `PATCH /credentials` sends back the masked value a read returned - [PR #48950](https://github.com/BerriAI/litellm/pull/48950)
- Load the model rows a create, update or upsert wrote on every worker as soon as the write returns, instead of after the debounced resync - [PR #49034](https://github.com/BerriAI/litellm/pull/49034)
- List only routable models for a wildcard alias over a provider org, such as `together_ai/*` over `together_ai/<org>/*`, on `/v1/models` and `/model/info` - [PR #49152](https://github.com/BerriAI/litellm/pull/49152)
- Keep a model's `access_windows` when it is edited - [PR #49316](https://github.com/BerriAI/litellm/pull/49316)

### Health checks

- Report an OpenAI realtime deployment with a missing or invalid API key as unhealthy, and time out a silent handshake under `model_info.health_check_timeout` - [PR #41233](https://github.com/BerriAI/litellm/pull/41233)
- Show the newest health check per model group on the Model Hub - [PR #47552](https://github.com/BerriAI/litellm/pull/47552)
- Ask OpenAI and Azure audio chat models for audio output in the health check probe, and judge the probed model when `health_check_model` is set - [PR #47730](https://github.com/BerriAI/litellm/pull/47730)
- Probe the cheapest cost-map chat models a partial wildcard serves, skip retired models, and fall back to the provider's cheapest chat models when none match - [PR #49060](https://github.com/BerriAI/litellm/pull/49060)
- Scope `/health` results for wildcard keys, team model allowlists and aliases with the same model access check auth runs on a request - [PR #49155](https://github.com/BerriAI/litellm/pull/49155)

### Usage and analytics

- Show subscription-covered providers, such as ChatGPT subscription deployments, and their account fees separately in Usage, managed through `/subscription_accounts/usage`, `/subscription_accounts/new`, `/subscription_accounts/update` and `/subscription_accounts/delete` - [PR #44772](https://github.com/BerriAI/litellm/pull/44772)
- Add a per-guardrail spend breakdown with per-key spend under `breakdown.guardrails` to user, team and organization daily activity - [PR #48702](https://github.com/BerriAI/litellm/pull/48702)
- Keep daily activity rows with no key, model or model group in reports and exports under `unattributed`, `unknown-model-group` and unknown-model buckets instead of dropping them, reporting a real key named like a bucket with a `raw:` prefix - [PR #48925](https://github.com/BerriAI/litellm/pull/48925)

### Error responses

- Return a status-derived `type` and a JSON `null` `param` instead of the literal string `None` in errors from the proxy server, auth, spend, management and key health routes - [PR #39540](https://github.com/BerriAI/litellm/pull/39540)
- Label errors from the shared management handler by the status they answer, so a 400 no longer carries `internal_server_error`, while provider 5xx and timeouts keep it and internal hosts are redacted - [PR #39555](https://github.com/BerriAI/litellm/pull/39555)
- Answer unexpected `/key/info` database failures with a generic 500 that points to the server logs instead of the raw exception - [PR #46190](https://github.com/BerriAI/litellm/pull/46190)
- Reject a request body that parses as JSON but is not an object with a 400 after authentication, instead of failing inside request handling - [PR #48438](https://github.com/BerriAI/litellm/pull/48438)
- Log routine 401 rejections, such as a missing header, a blocked key or a non-admin key on an admin route, as one WARNING line without a traceback - [PR #48613](https://github.com/BerriAI/litellm/pull/48613)
- Name management and health route errors by their status instead of `auth_error`, keep `auth_error` for 401 and 403, and answer a database outage with 503 - [PR #48739](https://github.com/BerriAI/litellm/pull/48739)

### Proxy configuration

- Delete callbacks configured under `callbacks` or `failure_callback` with `POST /config/callback/delete`, so the Admin UI Delete no longer returns 404 for those rows - [PR #42740](https://github.com/BerriAI/litellm/pull/42740)
- Support `--reload` with multiple workers on uvicorn 0.50.0 or later, stopping the worker pool on a broken edit until the next save; older uvicorn and Windows keep single-worker reload with a warning - [PR #45909](https://github.com/BerriAI/litellm/pull/45909)
- Unset environment variables removed from the database row on every worker, tracked by row revision - [PR #46709](https://github.com/BerriAI/litellm/pull/46709)
- Accept `s3://` URIs in `LITELLM_MODEL_COST_MAP_URL` - [PR #46972](https://github.com/BerriAI/litellm/pull/46972)
- Fall back to the bundled cost map when `LITELLM_MODEL_COST_MAP_URL` cannot be parsed as a URL - [PR #47133](https://github.com/BerriAI/litellm/pull/47133)
- Warn at boot when a config `environment_variables` key replaces a value already set in the process environment - [PR #47165](https://github.com/BerriAI/litellm/pull/47165)
- Resolve `oidc/file/<path>` and `oidc/env/<VAR>` references in an admin-configured `api_key` on each request instead of sending them upstream as literal text - [PR #47341](https://github.com/BerriAI/litellm/pull/47341)
- Decode `zstd` and `gzip` request bodies before auth reads them, bounded by `max_request_size_mb` and a per-worker in-flight limit - [PR #47418](https://github.com/BerriAI/litellm/pull/47418)
- Resolve an admin-set `oidc/google/<audience>` `api_key` to a GCE metadata server ID token on each request, cached until a minute before it expires - [PR #47703](https://github.com/BerriAI/litellm/pull/47703)
- Add `LITELLM_SUPPRESS_STARTUP_OUTPUT` and `litellm_settings.suppress_startup_output` to turn off the startup prints, while boot warnings are still written - [PR #47708](https://github.com/BerriAI/litellm/pull/47708)
- Add `LITELLM_DISABLE_LATEST_RELEASE_CHECK=true` to stop the proxy fetching the latest release for the upgrade notice - [PR #48065](https://github.com/BerriAI/litellm/pull/48065)
- Add `LITELLM_OFFLINE_MODE`, one switch that stops the outbound fetches LiteLLM makes on its own, such as the remote cost map, the release check and non-bundled tokenizers - [PR #48096](https://github.com/BerriAI/litellm/pull/48096)
- Store boolean settings as JSON booleans on `/config/field/update` - [PR #48595](https://github.com/BerriAI/litellm/pull/48595)
- Read stored `router_settings` from the writer database on `POST /fallback` and `DELETE /fallback/{model}`, so a stale Redis copy no longer drops earlier rules and config file settings stay out of the database row - [PR #48999](https://github.com/BerriAI/litellm/pull/48999)
- Treat an empty agent or skill search embedding model setting as not configured - [PR #49485](https://github.com/BerriAI/litellm/pull/49485)

### CLI and coding agents

- Start `lite` without initializing the litellm SDK and load only the subcommand being run, so commands start in a fraction of a second - [PR #46803](https://github.com/BerriAI/litellm/pull/46803)
- Add `lite claude --subscription` to keep Claude Code on its claude.ai login and send the LiteLLM key in `x-litellm-api-key`, with `claude_subscription` and `pkce` as `lite config` keys - [PR #47385](https://github.com/BerriAI/litellm/pull/47385)
- Send pi's session id from `lite pi` so its sessions group and stick - [PR #47700](https://github.com/BerriAI/litellm/pull/47700)
- Let the proxy decide whether a classic `lite login` token has expired in `print-token` and `whoami`, bounded to 3 seconds - [PR #47712](https://github.com/BerriAI/litellm/pull/47712)
- Add a `litellm-setup` agent skill under `skills/` that walks a coding agent through a Docker plus Postgres or uv install of the proxy - [PR #47731](https://github.com/BerriAI/litellm/pull/47731)
- Restore model discovery on the Claude Code gateway by serving `/claude_code_gateway/v1/models` as a model list route - [PR #48221](https://github.com/BerriAI/litellm/pull/48221)
- Add `lite codex --subscription` to keep Codex on its ChatGPT login and send the LiteLLM key only in `x-litellm-api-key`, with a `codex_subscription` `lite config` key - [PR #48741](https://github.com/BerriAI/litellm/pull/48741)
- Give `lite codex` aliases of a Codex-known model that model's catalog entry from `/v1/model/info`, so Codex stops sending every MCP and app tool inline - [PR #48894](https://github.com/BerriAI/litellm/pull/48894)
- Write each model group's `supported_reasoning_efforts` from `/model_group/info` into the client config for `lite pi`, `lite opencode` and `lite codex`, and offer the same levels in the proxy's Codex catalog, limited to the six every release parses for Codex before 0.138.0 - [PR #48949](https://github.com/BerriAI/litellm/pull/48949)
- Add `general_settings.claude_code_marketplace_auth_required` so `GET /claude-code/marketplace.json` needs a LiteLLM key and `/public/skill_hub` returns an empty list without one - [PR #48980](https://github.com/BerriAI/litellm/pull/48980)
- Let a Claude Code gateway user pick the session team on the browser verification page - [PR #49001](https://github.com/BerriAI/litellm/pull/49001)
- Honor `litellm_settings.drop_params: false` for Claude Code and Codex requests, and keep their drop_params default otherwise - [PR #49058](https://github.com/BerriAI/litellm/pull/49058)

### Terraform

- Default the AWS Terraform module's component images to `ghcr.io/berriai/litellm-<component>:${image_tag}`, with each published module version stamping `image_tag` to its own release tag - [PR #46960](https://github.com/BerriAI/litellm/pull/46960)

## AI Integrations

### Lens and Agent Traces


### Guardrails

- Add opt-in `include_masked_response_on_block` to the PANW Prisma AIRS guardrail, returning `response_masked_data` on a block - [PR #46219](https://github.com/BerriAI/litellm/pull/46219)
- Accept Gemini native tools and Anthropic content blocks in `generic_guardrail_api`, add opt-in `forward_messages_as_sent`, and name the error type when a check fails open - [PR #46338](https://github.com/BerriAI/litellm/pull/46338)
- End a chat completions stream with an error event and `[DONE]` when a guardrail blocks after the first chunk, instead of cutting the body off - [PR #46953](https://github.com/BerriAI/litellm/pull/46953)
- Add `num_retries` (up to 5) to `generic_guardrail_api` to retry checks lost after connect - [PR #46965](https://github.com/BerriAI/litellm/pull/46965)
- Run `pre_call` guardrails on every Responses WebSocket turn and bill each turn its own guardrail cost, booking a rejected frame as a failed request - [PR #47013](https://github.com/BerriAI/litellm/pull/47013)
- Resolve overlapping Presidio entity spans by the outermost detection in numbered PII tokens, so restored values are no longer corrupted - [PR #47024](https://github.com/BerriAI/litellm/pull/47024)
- Redact secrets in tool calls, tool results and Anthropic system prompts with the secret detection guardrail - [PR #47122](https://github.com/BerriAI/litellm/pull/47122)
- Allow `pre_mcp_call`, `during_mcp_call` and `post_mcp_call` modes on the generic guardrail API, so it attaches to MCP tool calls instead of being skipped at startup - [PR #48060](https://github.com/BerriAI/litellm/pull/48060)
- Add a native `reco` guardrail (`pre_call`) with `reco_tenant_id`, failing closed by default with configurable `unreachable_fallback` and `fail_on_error` - [PR #48243](https://github.com/BerriAI/litellm/pull/48243)
- Leave `litellm_metadata` out of the scan text pass-through guardrails build from the request body - [PR #48276](https://github.com/BerriAI/litellm/pull/48276)
- Make the hide-secrets guardrail honor `skip_tool_message_in_guardrail`, leaving tool messages and Anthropic `tool_result` blocks as sent while still masking tool call arguments - [PR #48689](https://github.com/BerriAI/litellm/pull/48689)
- Run the guardrails a Responses WebSocket frame selects through `guardrails`, `guardrail_config` or policies, including `during_call` guardrails, and name the malformed field in an error event - [PR #48725](https://github.com/BerriAI/litellm/pull/48725)
- Scan Responses API tool results in texts-mode guardrails - [PR #48827](https://github.com/BerriAI/litellm/pull/48827)
- Skip embeddings input in `google_text_moderation`, so documents indexed by subject are no longer blocked - [PR #48934](https://github.com/BerriAI/litellm/pull/48934)
- Make `lakera_v2` `on_flagged: block` reject PII-only detections with a 400, and add `on_flagged: mask` for the old mask-and-forward behavior - [PR #48944](https://github.com/BerriAI/litellm/pull/48944)
- Add `streaming_scan_in_background` to run sampled `post_call` stream scans as background tasks so the stream keeps flowing, ending it before the next chunk on a block - [PR #48952](https://github.com/BerriAI/litellm/pull/48952)
- Stream a guardrail block on `/v1/messages` as Anthropic stream events instead of a bare data line - [PR #49010](https://github.com/BerriAI/litellm/pull/49010)
- Scan and rewrite streamed `/v1/completions` under `post_call` guardrails - [PR #49035](https://github.com/BerriAI/litellm/pull/49035)
- Keep the upstream error when a `/v1/messages` stream ends in one under stream guardrails, instead of a 400 that hides it - [PR #49088](https://github.com/BerriAI/litellm/pull/49088)
- Send the Headroom guardrail an `x-headroom-affinity` header built from the tenant and the caller's own session id - [PR #49255](https://github.com/BerriAI/litellm/pull/49255)
- Scan files, tool calls and tool results with the Ovalix guardrail, discover the app from the key alias, and inspect requests whose key has no user as `unknown` - [PR #49309](https://github.com/BerriAI/litellm/pull/49309)
- Add `response_format: native` to `POST /guardrails/apply_guardrail` to return a configured guardrail's native findings - [PR #49460](https://github.com/BerriAI/litellm/pull/49460)
- Add `litellm.guardrails.apply()` to run a configured gateway guardrail on an input or response and get its native findings without a completion - [PR #49469](https://github.com/BerriAI/litellm/pull/49469)
- Add `outputScope` (`INTERVENTIONS` or `FULL`) to the Bedrock guardrail to return full ApplyGuardrail assessments, including findings that did not intervene - [PR #49470](https://github.com/BerriAI/litellm/pull/49470)

### Logging and observability

#### Arize

- Decide per-team Arize sampling per request from the trace id, so every pod reaches the same verdict - [PR #47468](https://github.com/BerriAI/litellm/pull/47468)

#### General

- Keep strong references to Responses stream and WebSocket logging tasks, so garbage collection no longer drops their success logs - [PR #31074](https://github.com/BerriAI/litellm/pull/31074)
- Redact Responses API `instructions` and callback output when message redaction is on, in logged params, spend log bodies and each opted-out callback's own copy - [PR #43315](https://github.com/BerriAI/litellm/pull/43315)
- Record streamed output whose chunks have no choice index, so partial output is kept when the client disconnects - [PR #46947](https://github.com/BerriAI/litellm/pull/46947)
- Emit every startup line as JSON when `json_logs` is on, including the banner and the first records of spawned workers - [PR #47035](https://github.com/BerriAI/litellm/pull/47035)
- Fire one CustomLogger hook per async speech, transcription, image, OCR and search call instead of both the sync and async hooks - [PR #47124](https://github.com/BerriAI/litellm/pull/47124)
- Keep root logger INFO lines when `json_logs` is on and `LITELLM_LOG` is set - [PR #47175](https://github.com/BerriAI/litellm/pull/47175)
- Deliver configured success callbacks for completed batches during reconciliation, once per callback - [PR #47192](https://github.com/BerriAI/litellm/pull/47192)
- Log one INFO line per token count call on `/v1/messages/count_tokens`, `/utils/token_counter`, `/v1/responses/input_tokens` and the Gemini and Bedrock count routes, with the call id, models, count and status - [PR #47657](https://github.com/BerriAI/litellm/pull/47657)
- Keep `x-litellm-overhead-duration-ms` anchored at receive time when a guardrail adds `litellm_metadata` to a chat completions request - [PR #47790](https://github.com/BerriAI/litellm/pull/47790)
- Stop log lines from leaving terminal colors on - [PR #48966](https://github.com/BerriAI/litellm/pull/48966)
- Log the inbound request and the outgoing provider request once under `--detailed_debug`, summarizing large values, instead of dumping the body at every layer - [PR #48973](https://github.com/BerriAI/litellm/pull/48973)
- Skip the `llm_exceptions` alert for `BudgetExceededError` - [PR #49290](https://github.com/BerriAI/litellm/pull/49290)

#### Langfuse

- Emit request metadata under `langfuse.observation.metadata` and `langfuse.trace.metadata` keys on the OTel v2 Langfuse mapper - [PR #42697](https://github.com/BerriAI/litellm/pull/42697)
- Derive trace-level name, input, output and tags on Langfuse OTel traces LiteLLM starts, leaving joined traces' own fields alone - [PR #42705](https://github.com/BerriAI/litellm/pull/42705)
- Send `langfuse.observation.completion_start_time` from `langfuse_otel` and the OTel v2 Langfuse mapper, so Langfuse shows time to first token - [PR #45597](https://github.com/BerriAI/litellm/pull/45597)
- Keep a credential-less `langfuse_otel` on OTel v2, so key and team Langfuse destinations get user, tags, session and cost without global Langfuse keys - [PR #48718](https://github.com/BerriAI/litellm/pull/48718)

#### OpenTelemetry

- Report response cache hits at zero cost with a cache-hit flag on OTel v1 and v2 spans - [PR #43604](https://github.com/BerriAI/litellm/pull/43604)
- Put the error message on every failed span's status, so backends such as Langfuse show it - [PR #44185](https://github.com/BerriAI/litellm/pull/44185)
- Leave out span cost when the price lookup failed instead of reporting the call as free, while cache hits stay at zero - [PR #44187](https://github.com/BerriAI/litellm/pull/44187)
- Label configured pass-through routes with the `litellm.passthrough` operation and read the operation from the upstream - [PR #48675](https://github.com/BerriAI/litellm/pull/48675)
- Suppress every span of a request whose URL matches `OTEL_PYTHON_FASTAPI_EXCLUDED_URLS`, not only the server span - [PR #48720](https://github.com/BerriAI/litellm/pull/48720)
- Print OTel v2 spans to stdout only when `OTEL_EXPORTER=console` asks for it, instead of next to a vendor exporter such as `langfuse_otel` or `arize` - [PR #48723](https://github.com/BerriAI/litellm/pull/48723)
- Close the `/v1/models` server span and parent it to the caller's `traceparent`, without attaching the model list payload - [PR #49141](https://github.com/BerriAI/litellm/pull/49141)

#### Prometheus

- Keep the requested model label on Prometheus metrics after a fallback - [PR #45555](https://github.com/BerriAI/litellm/pull/45555)
- Count a provider 401 for a deployment's own credential in `litellm_llm_api_failed_requests_metric` and the deployment failure metrics, while a caller's own failing credential stays out - [PR #46668](https://github.com/BerriAI/litellm/pull/46668)
- Emit the spend update queue size after aggregations and flushes too, so the queue size metric drops when the queue drains - [PR #46956](https://github.com/BerriAI/litellm/pull/46956)
- Read decimal values in the remaining rate-limit headers again for the remaining requests and tokens gauges - [PR #47039](https://github.com/BerriAI/litellm/pull/47039)
- Serve `/metrics` from the split backend service when Prometheus is enabled - [PR #47129](https://github.com/BerriAI/litellm/pull/47129)
- Label deployment failures with the deployment's provider instead of `None` - [PR #47384](https://github.com/BerriAI/litellm/pull/47384)

#### S3

- Run the legacy `s3` callback for streamed `/v1/messages` calls - [PR #47156](https://github.com/BerriAI/litellm/pull/47156)

## Spend Tracking, Budgets and Rate Limiting

### Cost tracking

- Bill a deployment's per-second rates on chat completions, `/v1/responses` and native Anthropic `/v1/messages` instead of $0 - [PR #42417](https://github.com/BerriAI/litellm/pull/42417)
- Bill streamed `/v1/completions` without `stream_options` like chat, and drop Azure's empty prompt-filter frame - [PR #45366](https://github.com/BerriAI/litellm/pull/45366)
- Bill only the OpenAI pass-through `/responses` calls OpenAI bills, leaving `input_tokens`, `input_items`, delete and non-background retrieve or cancel unbilled, and give billed background reads their own spend log row - [PR #47171](https://github.com/BerriAI/litellm/pull/47171)
- Bill both model calls of a chat completions MCP auto-execute on one spend row, and log each auto-executed tool call under its own spend log id - [PR #47422](https://github.com/BerriAI/litellm/pull/47422)
- Price `base_model` deployments past rule-only cost map entries - [PR #47497](https://github.com/BerriAI/litellm/pull/47497)
- Send the billed cost of a background Responses call to the creating key's and team's loggers, following their message logging settings - [PR #47506](https://github.com/BerriAI/litellm/pull/47506)
- Register one spend logger across callback registries and deduplicate equivalent success callbacks, so a completed request is billed once - [PR #47510](https://github.com/BerriAI/litellm/pull/47510)
- Add `model_info.pricing_provider` to name the provider whose cost map rows price a deployment, and price a deployment from its own entry when its id matches another provider's cost map key - [PR #47620](https://github.com/BerriAI/litellm/pull/47620)
- Bill Gemini audio input and cached audio at the flex, priority and batch rates - [PR #48086](https://github.com/BerriAI/litellm/pull/48086)
- Bill OpenAI 12-hour prompt cache writes at their own rate, with a long-context rate above the token threshold - [PR #48088](https://github.com/BerriAI/litellm/pull/48088)
- Parse 12-hour cache write rates for the batch and ultrafast tiers - [PR #48259](https://github.com/BerriAI/litellm/pull/48259)
- Keep custom pricing on database-only deployments across price data reloads - [PR #48486](https://github.com/BerriAI/litellm/pull/48486)
- Include Claude web search fees in streamed usage cost - [PR #48528](https://github.com/BerriAI/litellm/pull/48528)
- Bill both rounds of a streamed chat completions MCP auto-execute on one success row, and show their summed usage on the final usage chunk - [PR #48899](https://github.com/BerriAI/litellm/pull/48899)
- Bill the requested model's rates when the response names an unpriced model, such as a Fireworks display name, instead of $0 - [PR #48900](https://github.com/BerriAI/litellm/pull/48900)
- Bill each SDK call its own native Bedrock guardrail trace when calls share one metadata dict - [PR #48923](https://github.com/BerriAI/litellm/pull/48923)
- Bill a provider-reported `usage.cost` on every path unless the deployment carries its own prices - [PR #48953](https://github.com/BerriAI/litellm/pull/48953)
- Finalize a synchronous response's cost once for the `x-litellm-response-cost` header, the spend log and the daily rollups - [PR #48993](https://github.com/BerriAI/litellm/pull/48993)
- Bill completion-bridge agents such as LangGraph and `databricks_agent` at their own prices on `/a2a` `message/send` and `message/stream`, instead of a $0 row or no row - [PR #49150](https://github.com/BerriAI/litellm/pull/49150)
- Bill the margin once on rebuilt streams and on streamed Responses through the chat bridge - [PR #49254](https://github.com/BerriAI/litellm/pull/49254)
- Keep zero prices for batch cache writes, speech and Perplexity search instead of replacing them with defaults - [PR #49294](https://github.com/BerriAI/litellm/pull/49294)
- Split a provider-reported total cost between input and output by the cost map rate ratio - [PR #49357](https://github.com/BerriAI/litellm/pull/49357)
- Price `POST /v1/decisions` through the OpenAI pass-through with the Decisions cost map rates instead of logging $0 and no tokens - [PR #49392](https://github.com/BerriAI/litellm/pull/49392)

### Spend logs and daily rollups

- Log and bill Responses-style bodies sent to `/cursor/chat/completions` against the calling key - [PR #30277](https://github.com/BerriAI/litellm/pull/30277)
- Store the user email in spend log metadata so it shows in Admin UI request logs - [PR #41150](https://github.com/BerriAI/litellm/pull/41150)
- Use the caller's `litellm_session_id` as the spend log `session_id` and scope session history replay to the owning key, user and team - [PR #44199](https://github.com/BerriAI/litellm/pull/44199)
- Log each dropped `/v1/messages` attempt through its own logging copy and open the retry without its usage - [PR #45194](https://github.com/BerriAI/litellm/pull/45194)
- Put daily tag spend back on the in-memory queue when the Redis `RPUSH` fails - [PR #47307](https://github.com/BerriAI/litellm/pull/47307)
- Add size-triggered spend log cleanup with `general_settings.maximum_spend_logs_size`, `maximum_spend_logs_cleanup_target_size` and `maximum_spend_logs_size_check_interval`, deleting oldest rows first and reporting the `litellm_spend_log_storage_bytes` gauge - [PR #47450](https://github.com/BerriAI/litellm/pull/47450)
- Drop fully elapsed `LiteLLM_SpendLogs` partitions oldest first in the size cleanup pass, never the current or default partition - [PR #47451](https://github.com/BerriAI/litellm/pull/47451)
- Record `spend_logs_metadata` on `/interactions` calls - [PR #47848](https://github.com/BerriAI/litellm/pull/47848)
- Track the per-request rollup enqueues so shutdown drains them, and log each rollup failure with the request id - [PR #48131](https://github.com/BerriAI/litellm/pull/48131)
- Add `general_settings.disable_pre_routing_error_logs` to skip spend rows for requests rejected before routing - [PR #48239](https://github.com/BerriAI/litellm/pull/48239)
- Floor team member `total_spend` at the current cycle spend for rows written before `total_spend` existed, so a budget reset keeps their history - [PR #48260](https://github.com/BerriAI/litellm/pull/48260)
- Match `extra_spend_tag_headers` case-insensitively - [PR #48620](https://github.com/BerriAI/litellm/pull/48620)
- Treat a NaN or infinite reported cost as unreported and record any other non-finite cost as 0, so it no longer wedges daily spend writes - [PR #48829](https://github.com/BerriAI/litellm/pull/48829)
- Add opt-in durable usage capture with `general_settings.accounting_capture`, writing usage to the new `LiteLLM_AccountingEvent` and `LiteLLM_AccountingDelivery` ledger tables beside the existing spend updates, with `accounting_sync_ack` to wait for the commit on foreground requests and `accounting_sync_ack_failure_policy` (`fail_closed` returns 503, or `log`) - [PR #48862](https://github.com/BerriAI/litellm/pull/48862), [PR #49133](https://github.com/BerriAI/litellm/pull/49133)
- Mark mirrored `silent_model` calls with `is_silent_experiment` in spend logs and logging payloads from a router-only key clients cannot set - [PR #48888](https://github.com/BerriAI/litellm/pull/48888)
- Use the `sessionId`, `threadId` or `conversationId` from Bedrock `requestMetadata` or the `X-Amzn-Bedrock-Request-Metadata` header as the session id on Bedrock pass-through routes - [PR #49193](https://github.com/BerriAI/litellm/pull/49193)
- Log `/v1/images/generations` requests the router refuses before picking a deployment - [PR #49349](https://github.com/BerriAI/litellm/pull/49349)

### Budgets

- Add opt-in `general_settings.self_serve_budget_policy` (`lower_only` or `ceiling`) so key owners can change `max_budget` or `budget_limits` on their own keys through `/key/update` - [PR #44763](https://github.com/BerriAI/litellm/pull/44763)
- Track per-model budget spend locally instead of queueing increments for Redis when no Redis is configured - [PR #46831](https://github.com/BerriAI/litellm/pull/46831)
- Add `general_settings.request_tag_mappings` to map W3C `baggage` values to request tags for tag spend and budgets, with exact value rules ahead of `tag_prefix` fallbacks - [PR #47358](https://github.com/BerriAI/litellm/pull/47358)
- Count billed background Responses calls toward the creator's project and per-model budgets, under the model name the client sent - [PR #47504](https://github.com/BerriAI/litellm/pull/47504)
- Let `model_max_budget` entries name a model family pattern or an access group, sharing each budget window across replicas - [PR #47722](https://github.com/BerriAI/litellm/pull/47722)
- Raise the live budget counters for failure spend rows that carry a cost, such as a stream that breaks mid-flight, so an over-budget key stops passing - [PR #47741](https://github.com/BerriAI/litellm/pull/47741)
- Keep the team's budget reset schedule when a temporary budget increase is set on a member who inherits the team default - [PR #48495](https://github.com/BerriAI/litellm/pull/48495)
- Apply `max_end_user_budget_id` to end users without a row on cached keys - [PR #48704](https://github.com/BerriAI/litellm/pull/48704)
- Enforce an end user's per-model `model_max_budget` from their linked or default budget for virtual keys, the master key and JWT auth - [PR #48815](https://github.com/BerriAI/litellm/pull/48815)
- Keep model discovery routes available to over-budget keys while custom pass-through routes keep their budget checks - [PR #49463](https://github.com/BerriAI/litellm/pull/49463)

### Rate limiting

- Count native Responses WebSocket turns toward deployment limits and budgets, write one spend log row per turn, and refund unsettled reservations on disconnect - [PR #45727](https://github.com/BerriAI/litellm/pull/45727)
- Let `general_settings.enforce_project_model_quota` require RPM and TPM limits per provider or per model, checked on model adds and team model writes too - [PR #47693](https://github.com/BerriAI/litellm/pull/47693)
- Reject negative `rpm_limit` and `tpm_limit` values on key, user and budget requests - [PR #48444](https://github.com/BerriAI/litellm/pull/48444)
- Preserve the rate limiter's admission state across SSE keepalive tasks so stream cleanup releases the request's slot - [PR #48452](https://github.com/BerriAI/litellm/pull/48452)
- Release the `max_parallel_requests` slot when a synthetic stream completes - [PR #48628](https://github.com/BerriAI/litellm/pull/48628)
- Estimate audio and other media tokens in combined TPM reservations - [PR #48865](https://github.com/BerriAI/litellm/pull/48865)
- Stop `enable_pre_call_checks` from filtering deployments by their in-memory `rpm` count, so deployment `rpm` and `tpm` only limit traffic when `optional_pre_call_checks` includes `enforce_model_rate_limits` - [PR #48873](https://github.com/BerriAI/litellm/pull/48873)
- Add deployment `rpd` and `tpd` daily limits in `litellm_params`, enforced under `enforce_model_rate_limits` after the minute checks - [PR #48875](https://github.com/BerriAI/litellm/pull/48875)
- Add `daily_reset_time` (`HH:MM` in UTC) next to `rpd` and `tpd` to pick when daily limits start over, with the 429 retry-after counting to that reset - [PR #48957](https://github.com/BerriAI/litellm/pull/48957)
- Cap the default OTPM reservation for requests without `max_tokens`, configurable with `NO_MAX_TOKENS_TPM_RESERVATION_FRACTION`, reconcile ITPM and OTPM reservations after every call, and refund a failed attempt's reservation - [PR #49054](https://github.com/BerriAI/litellm/pull/49054)
- Check and count deployment `itpm` and `otpm` on every Responses WebSocket turn, refusing a turn with a 429 frame once a counter is at its limit - [PR #49069](https://github.com/BerriAI/litellm/pull/49069)
- Count native Responses WebSocket turn tokens toward key, team, user, end user and tag TPM limits, refusing a turn with no tokens left with a 429 frame while the socket stays open - [PR #49257](https://github.com/BerriAI/litellm/pull/49257)

## MCP Gateway

### Auth and OAuth

- Never forward the LiteLLM key used for admission to an upstream MCP server, for any auth type - [PR #46932](https://github.com/BerriAI/litellm/pull/46932)
- Let `proxy_admin_viewer` store and delete its own per-user MCP credentials - [PR #46994](https://github.com/BerriAI/litellm/pull/46994)
- Seal the `litellm_cp_return_to` cookie so edge firewalls stop blocking the MCP OAuth sign-in for Codex and Claude Code loopback redirects - [PR #47595](https://github.com/BerriAI/litellm/pull/47595)
- List tools of `authorization` auth MCP servers without a shared token - [PR #47677](https://github.com/BerriAI/litellm/pull/47677)
- Keep the toolset scope when refreshing an MCP caller's catalog authority - [PR #48095](https://github.com/BerriAI/litellm/pull/48095)
- Advertise the toolset's own OAuth protected resource on toolset URLs instead of the aggregate `/mcp` resource - [PR #48474](https://github.com/BerriAI/litellm/pull/48474)
- Reject revoked Admin UI browser sessions during gateway authorization - [PR #48494](https://github.com/BerriAI/litellm/pull/48494)

### Access and tool permissions

- Let personal keys under `personal_key_model_access_from_teams` inherit MCP server, MCP tool and agent access from their owner's teams - [PR #46293](https://github.com/BerriAI/litellm/pull/46293)
- Let `disallowed_tools` win over `allowed_tools` on every MCP path, with a warning when a server lists a tool in both - [PR #48625](https://github.com/BerriAI/litellm/pull/48625)
- Refuse calls to MCP tools a guardrail hides from the tool listing - [PR #48669](https://github.com/BerriAI/litellm/pull/48669)
- Bind a team key owned by a `proxy_admin` or `proxy_admin_viewer` to its team's MCP servers and toolsets, while the master key, teamless admin keys and the admin dashboard keep the whole registry - [PR #49161](https://github.com/BerriAI/litellm/pull/49161)

### Protocol and catalog

- Log the upstream exchange when an MCP health check fails - [PR #44125](https://github.com/BerriAI/litellm/pull/44125)
- Bound paginated `tools/list` by `LITELLM_MCP_TOOL_LISTING_TIMEOUT` while keeping explicit per-server timeouts - [PR #46513](https://github.com/BerriAI/litellm/pull/46513)
- Retry upstream 429s on `tools/list` up to `LITELLM_MCP_UPSTREAM_RATE_LIMIT_MAX_RETRIES` times (default 3), and return an error when every server fails - [PR #46649](https://github.com/BerriAI/litellm/pull/46649)
- Upgrade to MCP SDK 2.3.0 and raise the per-event SSE size cap to 64 MiB, configurable with `LITELLM_MCP_MAX_SSE_EVENT_SIZE_BYTES`, so large `tools/call` results no longer fail - [PR #47034](https://github.com/BerriAI/litellm/pull/47034)
- Surface the upstream HTTP status when a failed POST closes the MCP session - [PR #47569](https://github.com/BerriAI/litellm/pull/47569)
- Send `tools/call` stream headers as soon as the call is authorized instead of waiting for the next body message - [PR #47897](https://github.com/BerriAI/litellm/pull/47897)
- Report an upstream SSE event over the size limit with a message that says to paginate `tools/list` - [PR #48424](https://github.com/BerriAI/litellm/pull/48424)
- Move `litellm.proxy._experimental.mcp_server` to `litellm.proxy.mcp_server` and `litellm.experimental_mcp_client` to `litellm.mcp_client`, keeping the old paths as shims that warn with `DeprecationWarning` - [PR #48513](https://github.com/BerriAI/litellm/pull/48513)
- Accept YAML OpenAPI documents for OpenAPI-backed MCP servers - [PR #48622](https://github.com/BerriAI/litellm/pull/48622)
- Log MCP requests the SDK rejects - [PR #49184](https://github.com/BerriAI/litellm/pull/49184)

### Admin MCP and UI

- Enforce route permissions on LiteAdmin's admin MCP credential tools, matching the HTTP routes they call - [PR #48080](https://github.com/BerriAI/litellm/pull/48080)
- Search tool names and descriptions and multi-select tools per server in the MCP toolset editor - [PR #48601](https://github.com/BerriAI/litellm/pull/48601)
- Offer the `authorization` MCP auth type in the create and edit forms - [PR #48629](https://github.com/BerriAI/litellm/pull/48629)

## Performance / Loadbalancing / Reliability improvements

### Auto Router and model routing

- Keep the held `user_turn` tier for Codex compaction requests in the complexity router - [PR #48627](https://github.com/BerriAI/litellm/pull/48627)
- Add `max_tokens_from_tier_model` (`true`, `"clamp"` or `false`) under `complexity_router_config` to pick how a routed request's output limit is set - [PR #48632](https://github.com/BerriAI/litellm/pull/48632)
- Read complexity router session tier pins from Redis and refresh their TTL without writing a stale value back, so every worker sees the same pin - [PR #48645](https://github.com/BerriAI/litellm/pull/48645)
- Let a child request carrying `x-parent-session-id` in `classification_mode: user_turn` store its own tier without replacing the parent's - [PR #48701](https://github.com/BerriAI/litellm/pull/48701)
- Allow `os.environ/` references in complexity router Jev connection settings only from proxy admins, and refuse them from other callers with `environment_reference_denied` - [PR #48717](https://github.com/BerriAI/litellm/pull/48717)
- Infer custom classifier tiers from the model mappings, and keep custom tier floors on classifier fallback - [PR #48987](https://github.com/BerriAI/litellm/pull/48987)
- Budget the complexity router's classifier input by the decision provider's request limits, and record `classifier_input_*` fields on the routing span - [PR #49306](https://github.com/BerriAI/litellm/pull/49306)

### Routing, fallbacks and cooldowns

- Let session and API key affinity pins yield to deployments that already failed the request, while `previous_response_id` pins still win - [PR #32309](https://github.com/BerriAI/litellm/pull/32309)
- Add opt-in `enable_mid_stream_fallback_continuation` so a chat completions stream that breaks after plain text continues on the fallback with the partial text as an assistant prefill - [PR #41127](https://github.com/BerriAI/litellm/pull/41127)
- Discover Kubernetes pods behind a headless service `api_base` with `litellm_params.kubernetes_pod_discovery: true` - [PR #44342](https://github.com/BerriAI/litellm/pull/44342)
- Keep requests with an explicit session id on one discovered Kubernetes pod by rendezvous hashing, and record the pod in logs, spend logs and traces - [PR #44393](https://github.com/BerriAI/litellm/pull/44393)
- Apply `content_policy_fallbacks` when router settings update at runtime, layered over the `litellm_settings` rules and validated on `/config/update` - [PR #45428](https://github.com/BerriAI/litellm/pull/45428)
- Unregister a discarded router's strategy selectors from every litellm callback list - [PR #45795](https://github.com/BerriAI/litellm/pull/45795)
- Count an explicit `allowed_fails` of 3 as set, and keep the fallback deployment out of cooldown when every deployment of the requested model is cooling - [PR #46183](https://github.com/BerriAI/litellm/pull/46183)
- Add opt-in `model_info.enforce_supported_endpoints` so chat routes on a model declared non-chat by `supported_endpoints` answer 400 before any provider call, unless a fallback can answer - [PR #46257](https://github.com/BerriAI/litellm/pull/46257)
- Key prompt caching affinity on tools and the `/v1/messages` system prompt - [PR #46411](https://github.com/BerriAI/litellm/pull/46411)
- Apply each deployment's declared `reasoning_effort_levels` on every provider and on `/v1/chat/completions`, `/v1/messages` and `/v1/responses`, rounding up by default with `reasoning_effort_rounding` to switch to down - [PR #46601](https://github.com/BerriAI/litellm/pull/46601)
- Record the cooled deployments, with masked `api_base`, in `error_information.error_cooldown_deployments` on the all-cooled failure row - [PR #47120](https://github.com/BerriAI/litellm/pull/47120)
- Bound fake-streamed calls by the request timeout instead of `stream_timeout` - [PR #47162](https://github.com/BerriAI/litellm/pull/47162)
- Drop `router_settings_override` before routing and apply the key and team overrides on every branch, so it no longer reaches the provider - [PR #47257](https://github.com/BerriAI/litellm/pull/47257)
- Route batch creates to `mode: batch` deployments in mixed model groups and expose `supported_endpoints` on `/model_group/info` - [PR #47376](https://github.com/BerriAI/litellm/pull/47376)
- Route only on prefixed caller tags once `router_settings.tag_routing_prefix` is set, while key, team and project tags keep applying - [PR #47428](https://github.com/BerriAI/litellm/pull/47428)
- Schedule `default_priority` requests once, and answer a non-integer `priority` with a 400 or drop it under `drop_params` - [PR #47498](https://github.com/BerriAI/litellm/pull/47498)
- Ignore a first-token time left over from a previous attempt, so a negative time to first token no longer reaches spend logs or empties the latency routing window - [PR #47541](https://github.com/BerriAI/litellm/pull/47541)
- Skip non-dict tool entries in the prompt caching affinity key instead of raising - [PR #47565](https://github.com/BerriAI/litellm/pull/47565)
- Accept request priority from the `x-litellm-priority` header on router-served chat and text completions and `/queue/chat/completions` - [PR #47618](https://github.com/BerriAI/litellm/pull/47618)
- Continue Responses mid-stream fallbacks on models without assistant prefill, and skip continuation for constrained output - [PR #47672](https://github.com/BerriAI/litellm/pull/47672)
- Stop concurrent deployment deletes from crashing deployment lookups or returning a neighbouring deployment's credentials - [PR #47680](https://github.com/BerriAI/litellm/pull/47680)
- Normalize native Responses latency per output token for latency routing - [PR #47727](https://github.com/BerriAI/litellm/pull/47727)
- Keep image requests off deployments declared `supports_vision: false` in pre-call checks - [PR #48152](https://github.com/BerriAI/litellm/pull/48152)
- Route Decisions calls only to deployments whose provider supports Decisions - [PR #48175](https://github.com/BerriAI/litellm/pull/48175)
- Add opt-in `session_affinity_repin_on_failover` to move a session pin to the deployment that answered after a successful failover - [PR #48206](https://github.com/BerriAI/litellm/pull/48206)
- Drop negative or NaN latency samples before ranking, so latency-based routing no longer turns every request to the group into a 500 - [PR #48216](https://github.com/BerriAI/litellm/pull/48216)
- Skip declared text-only deployments for image requests on every routing strategy - [PR #48241](https://github.com/BerriAI/litellm/pull/48241)
- Honor a deployment's `model_info.allow_fail_open` for tag routing even when affinity or cooldown filtered it out - [PR #48470](https://github.com/BerriAI/litellm/pull/48470)
- Isolate cooldowns of forwarded Anthropic subscription credentials per credential - [PR #48485](https://github.com/BerriAI/litellm/pull/48485)
- Serve a team's wildcard deployment before a proxy-wide wildcard - [PR #48490](https://github.com/BerriAI/litellm/pull/48490)
- Keep a lone deployment warm under router `allowed_fails` unless the cooldown policy names the exception - [PR #48644](https://github.com/BerriAI/litellm/pull/48644)
- Pass `response.created`, `response.queued` and `response.in_progress` through as they arrive on background OpenAI Responses streams that cannot fall back - [PR #48817](https://github.com/BerriAI/litellm/pull/48817)
- Cool down failing deployments when fallbacks use string targets - [PR #48913](https://github.com/BerriAI/litellm/pull/48913)
- Raise a `TypeError` at `Router` init, and so at proxy startup, when `fallbacks`, `content_policy_fallbacks` or `default_fallbacks` give a target as a string, such as `{"gpt-4": "gpt-3.5"}`, instead of a list; these configs started before but the router walked the string one character at a time, so the named fallback never ran. Write `{"gpt-4": ["gpt-3.5"]}` instead - [PR #48943](https://github.com/BerriAI/litellm/pull/48943)
- Keep a deployment's own `model_id` over the request body's, unless the deployment lists `model_id` in `configurable_clientside_auth_params` - [PR #49045](https://github.com/BerriAI/litellm/pull/49045)
- Apply key and team `router_settings` to `/v1/images/generations` - [PR #49286](https://github.com/BerriAI/litellm/pull/49286)
- Recover a streamed context window error raised before any output through the context window fallbacks - [PR #49293](https://github.com/BerriAI/litellm/pull/49293)
- Detect image content, including Responses `computer_screenshot` parts, without translating the routed request - [PR #49371](https://github.com/BerriAI/litellm/pull/49371)
- Read the shared priority queue from Redis, so expired entries left by a dead replica stop blocking waiting requests - [PR #49387](https://github.com/BerriAI/litellm/pull/49387)

### Caching, database and runtime

- Keep reasoning, citations, audio, images and tool calls on streamed cache hits, replayed in a live stream's order - [PR #32096](https://github.com/BerriAI/litellm/pull/32096)
- Resync configuration after a Redis reconnect - [PR #43313](https://github.com/BerriAI/litellm/pull/43313)
- Keep the `litellm` command light so spawned workers answer uvicorn's first health ping, default the worker healthcheck timeout to 60 seconds and warn on uvicorn below 0.37 - [PR #45039](https://github.com/BerriAI/litellm/pull/45039)
- Hand the event loop back once a streaming response has held it for 50 ms, instead of holding it for the whole buffered stream - [PR #46925](https://github.com/BerriAI/litellm/pull/46925)
- Freeze the startup heap with `gc.freeze()` once the proxy is up, so full garbage collection passes stop re-walking it - [PR #47137](https://github.com/BerriAI/litellm/pull/47137)
- Build the OpenAPI schema off the event loop and reuse the rendered `/openapi.json`, so a cold request no longer stalls the worker - [PR #47352](https://github.com/BerriAI/litellm/pull/47352)
- Resolve whether a deployment has usage limits once per deployment instead of on every request - [PR #47393](https://github.com/BerriAI/litellm/pull/47393)
- Price deployments for savings reporting from the router's cached model info instead of deep-copying cost map entries on every call - [PR #47400](https://github.com/BerriAI/litellm/pull/47400)
- Flush the tool discovery queue to `LiteLLM_ToolTable` when `use_redis_transaction_buffer` is on - [PR #47653](https://github.com/BerriAI/litellm/pull/47653)
- Buffer tool discoveries in Redis and write `LiteLLM_ToolTable` in one statement per drain, on its own lock and scheduler job - [PR #48089](https://github.com/BerriAI/litellm/pull/48089)
- Let the Rust gateway connect to Redis with the Redis settings in `config.yaml` - [PR #48284](https://github.com/BerriAI/litellm/pull/48284)
- Refuse migrations that existing rows would make fail before the first one runs, and add `litellm --check_migrations_against_existing_data`, which dry-runs the pending migrations' real SQL in rolled-back transactions so Postgres reports the row or schema that would block the upgrade, exiting 2 when one fails - [PR #48493](https://github.com/BerriAI/litellm/pull/48493), [PR #48961](https://github.com/BerriAI/litellm/pull/48961)
- Abort a request with a 499 when the client disconnects during the body upload, so a half-uploaded body never reaches the provider - [PR #48640](https://github.com/BerriAI/litellm/pull/48640)
- Key cached async clients by a per-loop token instead of `id(loop)`, so a reused loop address no longer hands out a client bound to a dead loop - [PR #48877](https://github.com/BerriAI/litellm/pull/48877)
- Key the response cache by the model group in the router's metadata for the call, so a caller's own `caching_groups` can no longer fill another group's entry - [PR #48917](https://github.com/BerriAI/litellm/pull/48917)
- Persist pending tag spend and drain success callbacks within the shutdown budget - [PR #48988](https://github.com/BerriAI/litellm/pull/48988)
- Skip the base64 data URI scan on plain text and copy a few large strings inline when building logging payloads - [PR #49228](https://github.com/BerriAI/litellm/pull/49228)

### Docker and Helm

- Stop the `litellm-helm` chart from adding placeholder models to every install, shipping `proxy_config.model_list: []` instead - [PR #47056](https://github.com/BerriAI/litellm/pull/47056)
- Route `ingress.extraPaths` entries to another Service in the namespace with `serviceName` and `servicePort` in the `helm/litellm` chart - [PR #48674](https://github.com/BerriAI/litellm/pull/48674)

### Dependency updates

- Bump aiohttp to 3.14.5 in the lockfile, and so the Docker image, to clear osv-scan - [PR #47369](https://github.com/BerriAI/litellm/pull/47369)
- Require `anyio>=4.14.0`, ruling out a lock-waiter deadlock in the httpx and Prisma clients on pip and uv installs that kept an older anyio - [PR #47378](https://github.com/BerriAI/litellm/pull/47378)
- Bump langgraph, tornado (6.6 on Python 3.11+), ddtrace, msgpack and pylint, with dated scan ignores, to clear osv-scan and image-scan - [PR #48302](https://github.com/BerriAI/litellm/pull/48302)
- Allow `filelock` 4.x (`<5`), so installs on Python 3.11+ can take the 4.2.1+ releases that fix three CVEs while Python 3.10 keeps 3.x - [PR #49137](https://github.com/BerriAI/litellm/pull/49137)
- Bump pyasn1 to 0.6.5, pypdf to 6.21.4 and minimatch to 11.0.2 to clear osv-scan - [PR #49362](https://github.com/BerriAI/litellm/pull/49362)

## Documentation Updates

- Rename `security.md` to `SECURITY.md` and change the security contact to security@berri.ai - [PR #47581](https://github.com/BerriAI/litellm/pull/47581)
- Describe the guardrail spend fields and reporting key IDs of `/user/daily/activity` in the OpenAPI schema - [PR #49236](https://github.com/BerriAI/litellm/pull/49236)
- Replace stale `docs/proxy/enterprise` links in the proxy and Admin UI with the current docs pages - [PR #49491](https://github.com/BerriAI/litellm/pull/49491)

## Tests, CI and Internal Changes

These 167 changes touch tests, CI, contributor tooling, repo docs, build and packaging, and dependency housekeeping. They do not change proxy or SDK behavior on their own. Changes listed as commits have no public PR.

<details>
<summary>Integration and e2e tests (38)</summary>

- Defer the empty-count Gemini cases in the integration tests on rc/1.109.0 - [Commit b09a68b](https://github.com/BerriAI/litellm/commit/b09a68b03895ef2bedf46c690e92d299437d25fa)
- Scope offline resolution to the restricted integration runner - [Commit 4eb5e1e](https://github.com/BerriAI/litellm/commit/4eb5e1e326283c815b57b2fc9d9392fd3fb66784)
- Align the remaining release qualification checks in the integration tests - [Commit 5133050](https://github.com/BerriAI/litellm/commit/5133050db60b2c1393aeb3bda79507f95e4218b5)
- Repair stale contract fixtures in the integration tests - [Commit d77199e](https://github.com/BerriAI/litellm/commit/d77199e03af95392ac9e9322e639e566bb4d03c2)
- Scope the migration lock checks in the integration tests on rc/1.109.0 - [Commit db495be](https://github.com/BerriAI/litellm/commit/db495be5024f9292e410bb9d19d7ad4cf2d33e61)
- Replace the third-party agent A2A e2e test with an integration test - [PR #49541](https://github.com/BerriAI/litellm/pull/49541)
- Move the Sail, Weave and Presidio e2e tests to integration tests - [PR #49533](https://github.com/BerriAI/litellm/pull/49533)
- Match Databricks classifier budget telemetry in an integration test - [PR #49382](https://github.com/BerriAI/litellm/pull/49382)
- Fix integration tests that fail on test order, races and intended changes - [PR #49310](https://github.com/BerriAI/litellm/pull/49310)
- Update integration tests left stale by recent product changes - [PR #49143](https://github.com/BerriAI/litellm/pull/49143)
- Give the Langfuse destination tests the otel callback's stdout exporter - [PR #49129](https://github.com/BerriAI/litellm/pull/49129)
- Scope the signoz, otel conversation id and series cap proxy fixtures to their module - [PR #48965](https://github.com/BerriAI/litellm/pull/48965)
- Update stale integration and guardrail e2e tests to intended behavior - [PR #48665](https://github.com/BerriAI/litellm/pull/48665)
- Repair seven stale integration tests on main - [PR #47600](https://github.com/BerriAI/litellm/pull/47600)
- Remove the BUG skip for 1 test that passes on main - [PR #47603](https://github.com/BerriAI/litellm/pull/47603)
- Call the renamed metadata deployment helper in the Mantle `count_tokens` wire tests - [PR #47592](https://github.com/BerriAI/litellm/pull/47592)
- Call `_fallback_deployment` in the `count_tokens` wire tests added by an earlier change - [PR #47593](https://github.com/BerriAI/litellm/pull/47593)
- Expect the Exa search envelope's `provider_metadata` in the integration tests - [PR #47572](https://github.com/BerriAI/litellm/pull/47572)
- Remove the BUG skips for 3 tests that pass on main - [PR #47364](https://github.com/BerriAI/litellm/pull/47364)
- Read router cooldown failure rows from the proxy that served them - [PR #47457](https://github.com/BerriAI/litellm/pull/47457)
- Wait for every worker to report the websocket session cap instead of sleeping - [PR #47412](https://github.com/BerriAI/litellm/pull/47412)
- Read stream stall spend rows from the proxy that served them - [PR #47410](https://github.com/BerriAI/litellm/pull/47410)
- Read the virtual key from its own `pre` in the Save your Key dialog in the UI e2e test - [PR #47408](https://github.com/BerriAI/litellm/pull/47408)
- Expect the requested model in streamed Responses events on the arize v2 rig - [PR #47407](https://github.com/BerriAI/litellm/pull/47407)
- Check SSO sign-in removal without reaching the public internet - [PR #47409](https://github.com/BerriAI/litellm/pull/47409)
- Wait for every worker in `Scenario.model` - [PR #47277](https://github.com/BerriAI/litellm/pull/47277)
- Look up owned cache keys and clean up sweep models - [PR #47255](https://github.com/BerriAI/litellm/pull/47255)
- Stop `GET /__observations` from draining the upstream log - [PR #47256](https://github.com/BerriAI/litellm/pull/47256)
- Give each owned proxy a private database and Redis by default - [PR #47213](https://github.com/BerriAI/litellm/pull/47213)
- Replace the live Linear MCP OAuth e2e tests with integration coverage - [PR #47154](https://github.com/BerriAI/litellm/pull/47154)
- Report uncollected shard files as collection errors instead of crashing xdist - [PR #47075](https://github.com/BerriAI/litellm/pull/47075)
- Let `get_text_external` accept JSON next to text so a pod-log error reads as the Kubernetes Status, not a 406 - [PR #47150](https://github.com/BerriAI/litellm/pull/47150)
- Remove the BUG skips for 2 tests that pass on main - [PR #47142](https://github.com/BerriAI/litellm/pull/47142)
- Remove the BUG skip for 1 test that passes on main - [PR #46937](https://github.com/BerriAI/litellm/pull/46937)

</details>

<details>
<summary>Performance tests (26)</summary>

- Ramp the load cases until the pod stops keeping up and floor `sustained_rps` - [PR #47758](https://github.com/BerriAI/litellm/pull/47758)
- Emit per-location seconds, offending locations and the ten longest holds as `event_loop_stalls` breakdowns - [PR #47757](https://github.com/BerriAI/litellm/pull/47757)
- Add `chat_completions_2rps`, `responses_2rps` and `messages_2rps` direct vs bridge cases - [PR #47752](https://github.com/BerriAI/litellm/pull/47752)
- Allowlist anyio `TaskHandle._run_coro` in `event_loop_stalls` - [PR #47746](https://github.com/BerriAI/litellm/pull/47746)
- Emit `event_loop_stalls` hold counts as `perf_` JUnit properties - [PR #47706](https://github.com/BerriAI/litellm/pull/47706)
- Emit the database upgrade run's perf rows and upgrade timings as JUnit properties - [PR #47696](https://github.com/BerriAI/litellm/pull/47696)
- Record the row count and size of each table the Admin UI journeys query - [PR #47683](https://github.com/BerriAI/litellm/pull/47683)
- Tag a UI journey sample with its API response, not a Next.js prefetch under `/ui/` - [PR #47650](https://github.com/BerriAI/litellm/pull/47650)
- Emit a top-contributors breakdown property per perf metric - [PR #47632](https://github.com/BerriAI/litellm/pull/47632)
- Let the UI journey fixture run on a restore upgraded by a released migrations image - [PR #47628](https://github.com/BerriAI/litellm/pull/47628)
- Record the data request status per UI journey sample and bound each journey with a wall clock - [PR #47622](https://github.com/BerriAI/litellm/pull/47622)
- Set the small case's `postgres_max_background_statement_per_request` ceiling to 0.9 - [PR #47616](https://github.com/BerriAI/litellm/pull/47616)
- Set every perf ceiling to 1.2x the lane median - [PR #47590](https://github.com/BerriAI/litellm/pull/47590)
- Measure Admin UI journey latency in a browser on the 1TB SpendLogs restore - [PR #47486](https://github.com/BerriAI/litellm/pull/47486)
- Set the seven new perf ceilings from 124 lane runs across v1.103.0 to v1.106.0 - [PR #47527](https://github.com/BerriAI/litellm/pull/47527)
- Gate the gateway's own overhead header, Redis latency and Postgres load in the perf cases - [PR #47472](https://github.com/BerriAI/litellm/pull/47472)
- Read the memory baseline after a one minute warm-up - [PR #47455](https://github.com/BerriAI/litellm/pull/47455)
- Stop flagging load-balanced worker reads as restarts in the database upgrade test - [PR #47425](https://github.com/BerriAI/litellm/pull/47425)
- Align perf read queries with current dashboard calls - [PR #47243](https://github.com/BerriAI/litellm/pull/47243)
- Measure SpendLog-backed UI query latency - [PR #46955](https://github.com/BerriAI/litellm/pull/46955)
- Qualify database upgrades with shared 5 RPS traffic - [PR #46802](https://github.com/BerriAI/litellm/pull/46802)
- Cap the request-handler bucket in `event_loop_stalls` at 2, twice the gc-aware maximum - [PR #47128](https://github.com/BerriAI/litellm/pull/47128)
- Charge an `event_loop_stalls` hold to the longest gc pass that fits it, not to the sum of every pass since the last hold - [PR #47089](https://github.com/BerriAI/litellm/pull/47089)
- Fail the `event_loop_stalls` perf case on a gateway event-loop hold over 100 ms that is not on its allowlist - [PR #46974](https://github.com/BerriAI/litellm/pull/46974)
- Cap every background Postgres statement at 0.9 calls per request - [PR #46957](https://github.com/BerriAI/litellm/pull/46957)
- Cap every awaited Postgres statement at 0.5 calls per request - [PR #46944](https://github.com/BerriAI/litellm/pull/46944)

</details>

<details>
<summary>Cost calculation and translation tests (18)</summary>

- Use explicit prices in cost calculation checks - [Commit 0c466b0](https://github.com/BerriAI/litellm/commit/0c466b05ce26f6526dc49bb0c3598ebcda9b8685)
- Expect the EOF error frame when an Anthropic `json_schema` stream is cut - [PR #49521](https://github.com/BerriAI/litellm/pull/49521)
- Expect Cohere rerank-v4 `prompt_tokens` from `billed_units.total_tokens` in cost tests - [PR #49455](https://github.com/BerriAI/litellm/pull/49455)
- Test that Bedrock Claude prompt caching on `/v1/messages` reports and charges cache tokens - [PR #49265](https://github.com/BerriAI/litellm/pull/49265)
- Cover unpriced provider slugs and explicit zero rates in cost tests - [PR #42467](https://github.com/BerriAI/litellm/pull/42467)
- Run Azure AI Claude bridge pairs, add Anthropic usage speed and a Vertex Gemini audio priority price to cost tests - [PR #47582](https://github.com/BerriAI/litellm/pull/47582)
- Add a Sonnet 5.5 Anthropic direct cross-model mid row to the translation matrix - [PR #47566](https://github.com/BerriAI/litellm/pull/47566)
- Add Sonnet 5.5 Converse and Gemini direct cross-model mid rows to the translation matrix - [PR #47328](https://github.com/BerriAI/litellm/pull/47328)
- Add tier 1 cost tracking cases and wire bridge legs for 2026-10-19 - [PR #47342](https://github.com/BerriAI/litellm/pull/47342)
- Add tier 1 cost tracking cells and sync usage shapes for 2026-10-17 - [PR #47141](https://github.com/BerriAI/litellm/pull/47141)
- Add `claude-haiku-5-5` Vertex AI translation cases - [PR #47136](https://github.com/BerriAI/litellm/pull/47136)
- Allow Anthropic usage speed in the cross-model contract - [PR #47130](https://github.com/BerriAI/litellm/pull/47130)
- Add Sonnet 5.5 and Gemini Vertex rows to the cross-model mid tier - [PR #46896](https://github.com/BerriAI/litellm/pull/46896)
- Recapture Azure AI Claude bases after the usage speed field - [PR #47117](https://github.com/BerriAI/litellm/pull/47117)
- Recapture Anthropic Claude bases after the usage speed field - [PR #47116](https://github.com/BerriAI/litellm/pull/47116)
- Rekey Vertex Gemini cost cases, add Bedrock Mantle GPT and `claude-opus-5-5`, and drop suite-only price fields - [PR #46962](https://github.com/BerriAI/litellm/pull/46962)
- Bill Vertex `gemini-3.8-flash` reasoning tokens at the reasoning price in cost tests - [PR #46939](https://github.com/BerriAI/litellm/pull/46939)
- Add tier 1 cost tracking cases for `gpt-5.6-terra`, `gemini-4-argon` and `gemini-3.1-pro-preview` - [PR #46931](https://github.com/BerriAI/litellm/pull/46931)

</details>

<details>
<summary>Test audits (27)</summary>

- Audit the responses tests added in #47445 - [PR #48902](https://github.com/BerriAI/litellm/pull/48902)
- Audit the proxy tests added in #46997 - [PR #48918](https://github.com/BerriAI/litellm/pull/48918)
- Audit the extraction tests added in #47473 - [PR #48898](https://github.com/BerriAI/litellm/pull/48898)
- Audit the spend tests added in #47506 for billed background cost reaching the creator's loggers - [PR #48919](https://github.com/BerriAI/litellm/pull/48919)
- Audit the routing tests added in #46601 - [PR #48910](https://github.com/BerriAI/litellm/pull/48910)
- Audit the scim tests added in #47544 - [PR #48791](https://github.com/BerriAI/litellm/pull/48791)
- Audit the mcp tests added in #47422 - [PR #48821](https://github.com/BerriAI/litellm/pull/48821)
- Audit the proxy tests added in #47352 - [PR #48804](https://github.com/BerriAI/litellm/pull/48804)
- Audit the nvidia_riva tests added in #41021 - [PR #48801](https://github.com/BerriAI/litellm/pull/48801)
- Audit the router tests added in #41368 - [PR #48794](https://github.com/BerriAI/litellm/pull/48794)
- Audit the proxy tests added in #47358 - [PR #48784](https://github.com/BerriAI/litellm/pull/48784)
- Audit the router tests added in #47376 - [PR #48792](https://github.com/BerriAI/litellm/pull/48792)
- Audit the decisions tests added in #47508 - [PR #48777](https://github.com/BerriAI/litellm/pull/48777)
- Audit the router tests added in #47498 - [PR #48799](https://github.com/BerriAI/litellm/pull/48799)
- Audit the anthropic tests added in #47478 - [PR #48803](https://github.com/BerriAI/litellm/pull/48803)
- Audit the token_counter tests added in #47586 - [PR #48800](https://github.com/BerriAI/litellm/pull/48800)
- Audit the anthropic and bedrock tests added in #47489 - [PR #48782](https://github.com/BerriAI/litellm/pull/48782)
- Audit the files tests added in #40621 - [PR #48788](https://github.com/BerriAI/litellm/pull/48788)
- Audit the proxy tests added in #46815 - [PR #48768](https://github.com/BerriAI/litellm/pull/48768)
- Audit the spend tests added in #47353 - [PR #48785](https://github.com/BerriAI/litellm/pull/48785)
- Audit the responses tests added in #47504 - [PR #48787](https://github.com/BerriAI/litellm/pull/48787)
- Audit the llms tests added in #47535 - [PR #48786](https://github.com/BerriAI/litellm/pull/48786)
- Audit the proxy tests added in #47418 - [PR #48766](https://github.com/BerriAI/litellm/pull/48766)
- Audit the spend tests added in #47815 - [PR #48774](https://github.com/BerriAI/litellm/pull/48774)
- Audit the gemini tests added in #47542 - [PR #48758](https://github.com/BerriAI/litellm/pull/48758)
- Audit the sagemaker tests added in #47495 - [PR #48767](https://github.com/BerriAI/litellm/pull/48767)
- Audit the harness tests added in #47530 - [PR #48751](https://github.com/BerriAI/litellm/pull/48751)

</details>

<details>
<summary>Unit tests (24)</summary>

- Cancel disconnected MCP HTTP tool handlers in tests - [PR #49436](https://github.com/BerriAI/litellm/pull/49436)
- Trace the router deployment index lock in the file that owns it - [PR #49520](https://github.com/BerriAI/litellm/pull/49520)
- Deflake the JSON accumulator drain test and the armed routing prefetch test - [PR #49505](https://github.com/BerriAI/litellm/pull/49505)
- Keep foreign asyncio task noise out of the budget limiter caplog asserts - [PR #43375](https://github.com/BerriAI/litellm/pull/43375)
- Fix flaky spend-log cleanup budget, login lockout and wedged Redis tests - [PR #47108](https://github.com/BerriAI/litellm/pull/47108)
- Assert peak allocation instead of a drain timing ratio in the `json_fragment_accumulator` test - [PR #43370](https://github.com/BerriAI/litellm/pull/43370)
- Keep unix socket paths in unit tests under the macOS `AF_UNIX` limit - [PR #45040](https://github.com/BerriAI/litellm/pull/45040)
- Set string fallback targets after `Router` init in the SDK cooldown cases - [PR #48954](https://github.com/BerriAI/litellm/pull/48954)
- Cover every web source for a grounded Gemini passage - [PR #48861](https://github.com/BerriAI/litellm/pull/48861)
- Pin the `max_parallel_requests` slot release when a streamed `/v1/messages` MCP auto-execute ends - [PR #47788](https://github.com/BerriAI/litellm/pull/47788)
- Remove checks that pin implementation details and add a shadcn testing rule - [PR #48663](https://github.com/BerriAI/litellm/pull/48663)
- Test that a team's wildcard serves its keys before a proxy-wide wildcard of the same pattern - [PR #48501](https://github.com/BerriAI/litellm/pull/48501)
- Make the tokenizer offload check deterministic - [PR #48458](https://github.com/BerriAI/litellm/pull/48458)
- Pin that a stream stuck on one chunk closes its provider stream and logs one failure - [PR #38753](https://github.com/BerriAI/litellm/pull/38753)
- Read the Interactions spec from a vendored snapshot and canary the live one daily - [PR #48002](https://github.com/BerriAI/litellm/pull/48002)
- Fix flaky team delete, refusal sink, loop-blocking, Moyai tamper and model-cost leak tests - [PR #47135](https://github.com/BerriAI/litellm/pull/47135)
- Detect Vault reads on the event-loop thread in Bedrock tests - [PR #47597](https://github.com/BerriAI/litellm/pull/47597)
- Isolate model cost maps in runtime registration tests - [PR #47559](https://github.com/BerriAI/litellm/pull/47559)
- Stop writing image edit responses to disk in tests - [PR #47463](https://github.com/BerriAI/litellm/pull/47463)
- Catch regressions in the validation lines added by an earlier change - [PR #47420](https://github.com/BerriAI/litellm/pull/47420)
- Add a native vs Python parity harness for Responses - [PR #46567](https://github.com/BerriAI/litellm/pull/46567)
- Annotate Baseten test locals with `Final` - [PR #47205](https://github.com/BerriAI/litellm/pull/47205)
- Relocate rust-bridge dispatch tests before routing changes - [PR #46926](https://github.com/BerriAI/litellm/pull/46926)

</details>

<details>
<summary>CI and workflows (14)</summary>

- Cut the weekly rc branch on Monday 3am PT instead of Friday - [PR #49472](https://github.com/BerriAI/litellm/pull/49472)
- Clone the public repo over HTTPS in CircleCI so main jobs stop failing at checkout - [PR #49394](https://github.com/BerriAI/litellm/pull/49394)
- Cache Rust compilation with sccache - [PR #49117](https://github.com/BerriAI/litellm/pull/49117)
- Check the cost map by loading it through model-catalog - [PR #48908](https://github.com/BerriAI/litellm/pull/48908)
- Run the dashboard API types and Terraform endpoint checks on every change that can alter the spec - [PR #49022](https://github.com/BerriAI/litellm/pull/49022)
- Run zizmor with `--no-ignores` and move the spend logs and cost map guards to `pull_request` - [PR #48947](https://github.com/BerriAI/litellm/pull/48947)
- Run `spend-logs-guard` only on `pull_request_target` and re-run it by hand after approval - [PR #48941](https://github.com/BerriAI/litellm/pull/48941)
- Run `spend-logs-guard` and `cost-map-guard` without installing the litellm project - [PR #48683](https://github.com/BerriAI/litellm/pull/48683)
- Require a code owner approval in `spend-logs-guard` for `LiteLLM_SpendLogs` schema and migration changes - [PR #48518](https://github.com/BerriAI/litellm/pull/48518)
- Remove the Together AI and weekly cost map sync workflows - [PR #48473](https://github.com/BerriAI/litellm/pull/48473)
- Keep the MCP SDK1 peer on mcp 1.x and turn autovacuum off for the size cleanup test - [PR #47651](https://github.com/BerriAI/litellm/pull/47651)
- Delete the unused model prices JSON schema file - [PR #47079](https://github.com/BerriAI/litellm/pull/47079)

</details>

<details>
<summary>Build and packaging (5)</summary>

- Ship the cost map inside the native extension - [PR #48907](https://github.com/BerriAI/litellm/pull/48907)
- Upgrade `reqwest` to 0.13 and move MCP out of `litellm-http` - [PR #48039](https://github.com/BerriAI/litellm/pull/48039)
- Bump litellm-enterprise from 0.1.79 to 0.1.80 and litellm from 1.108.0 to 1.109.0 - [PR #48673](https://github.com/BerriAI/litellm/pull/48673)
- Update the Next.js build artifacts - [PR #48692](https://github.com/BerriAI/litellm/pull/48692)
- Cache the Rust extension build in its own Docker stage - [PR #47033](https://github.com/BerriAI/litellm/pull/47033)

</details>

<details>
<summary>Dependencies (3)</summary>

- Drop expired `exclude-newer` pins for certifi, mlflow and pypdf - [PR #48461](https://github.com/BerriAI/litellm/pull/48461)
- Remove expired boto3, botocore and grpcio overrides - [PR #48447](https://github.com/BerriAI/litellm/pull/48447)
- Bump vite from 8.3.0 to 8.3.4 in the VS Code extension - [PR #47627](https://github.com/BerriAI/litellm/pull/47627)

</details>

<details>
<summary>Docs in the repo (14)</summary>

- Wrap the agent-drafted summary in the PR template in make-me-human-readable tags - [PR #49494](https://github.com/BerriAI/litellm/pull/49494)
- Add a handwritten 1-3 sentence description section to the PR template - [PR #49475](https://github.com/BerriAI/litellm/pull/49475)
- Explain meter, band, channel and When in the model-catalog agent docs - [PR #49447](https://github.com/BerriAI/litellm/pull/49447)
- Link the README to the Python SDK and autorouter guides - [PR #48986](https://github.com/BerriAI/litellm/pull/48986)
- Allow focused proof for mechanical PRs in the QA guide - [PR #49031](https://github.com/BerriAI/litellm/pull/49031)
- Add ADRs for the Python SDK and proxy, starting with provider usage extras - [PR #36668](https://github.com/BerriAI/litellm/pull/36668)
- Link the LiteLLM OSS Champions program from the README Contributing section - [PR #48734](https://github.com/BerriAI/litellm/pull/48734)
- Clarify the heuristic v2 keyword settings in the complexity router README - [PR #48666](https://github.com/BerriAI/litellm/pull/48666)
- Document the incremental database access migration - [PR #48476](https://github.com/BerriAI/litellm/pull/48476)
- Remove the description heading from the PR template - [PR #47631](https://github.com/BerriAI/litellm/pull/47631)
- Clarify the unit test clock rule - [PR #47604](https://github.com/BerriAI/litellm/pull/47604)
- Lead the PR template with a short plain description and collapse the rest - [PR #47594](https://github.com/BerriAI/litellm/pull/47594)
- Rewrite the stale `completion_cost` docstring - [PR #47022](https://github.com/BerriAI/litellm/pull/47022)
- Keep directory rules in nested AGENTS.md files and pin integration tests to CircleCI - [PR #46796](https://github.com/BerriAI/litellm/pull/46796)

</details>

<details>
<summary>Chores (5)</summary>

- Remove the unused `arize_phoenix` callback from the e2e stage mirror config - [PR #49538](https://github.com/BerriAI/litellm/pull/49538)
- Add google-convention docstring rules to the strict ruff gate - [PR #48245](https://github.com/BerriAI/litellm/pull/48245)
- Add a code owner for the model cost map - [PR #48101](https://github.com/BerriAI/litellm/pull/48101)
- Add a code owner for `helm/` and `terraform/` - [PR #47452](https://github.com/BerriAI/litellm/pull/47452)
- Drop the Conventional Branches pre-push hook in favor of a `litellm_` prefix - [PR #44951](https://github.com/BerriAI/litellm/pull/44951)

</details>

### PR roll-up by ownership area

Customer-facing changes: **711**. Tests, CI and internal changes: **167**. Total: **878**

- New Models / Updated Models: 225
- Tests, CI and internal: 167
- LLM API Endpoints: 148
- Management Endpoints / UI: 124
- Performance / Loadbalancing / Reliability improvements: 70
- Spend Tracking, Budgets and Rate Limiting: 62
- AI Integrations: 55
- MCP Gateway: 24
- Documentation Updates: 3

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
- [@jhoblitt](https://github.com/jhoblitt) made their first contribution in [PR #48060](https://github.com/BerriAI/litellm/pull/48060)
- [@jodok](https://github.com/jodok) made their first contribution in [PR #48448](https://github.com/BerriAI/litellm/pull/48448)
- [@jonvarley-fw](https://github.com/jonvarley-fw) made their first contribution in [PR #47326](https://github.com/BerriAI/litellm/pull/47326)
- [@jorik](https://github.com/jorik) made their first contribution in [PR #46421](https://github.com/BerriAI/litellm/pull/46421)
- [@joshdabosh](https://github.com/joshdabosh) made their first contribution in [PR #45092](https://github.com/BerriAI/litellm/pull/45092)
- [@justinfx](https://github.com/justinfx) made their first contribution in [PR #44763](https://github.com/BerriAI/litellm/pull/44763)
- [@lets-order-some-fries](https://github.com/lets-order-some-fries) made their first contribution in [PR #36678](https://github.com/BerriAI/litellm/pull/36678)
- [@limdeng](https://github.com/limdeng) made their first contribution in [PR #45567](https://github.com/BerriAI/litellm/pull/45567)
- [@MaximeBOUDIER](https://github.com/MaximeBOUDIER) made their first contribution in [PR #46902](https://github.com/BerriAI/litellm/pull/46902)
- [@mdevhurt1](https://github.com/mdevhurt1) made their first contribution in [PR #39762](https://github.com/BerriAI/litellm/pull/39762)
- [@MFJG-dev](https://github.com/MFJG-dev) made their first contribution in [PR #45961](https://github.com/BerriAI/litellm/pull/45961)
- [@mika-lt](https://github.com/mika-lt) made their first contribution in [PR #48799](https://github.com/BerriAI/litellm/pull/48799)
- [@ninglinLiu](https://github.com/ninglinLiu) made their first contribution in [PR #46171](https://github.com/BerriAI/litellm/pull/46171)
- [@norkelbyte](https://github.com/norkelbyte) made their first contribution in [PR #48751](https://github.com/BerriAI/litellm/pull/48751)
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
- [@tavren27](https://github.com/tavren27) made their first contribution in [PR #48766](https://github.com/BerriAI/litellm/pull/48766)
- [@tbartik](https://github.com/tbartik) made their first contribution in [PR #34822](https://github.com/BerriAI/litellm/pull/34822)
- [@TemoSulava](https://github.com/TemoSulava) made their first contribution in [PR #47263](https://github.com/BerriAI/litellm/pull/47263)
- [@tessellark](https://github.com/tessellark) made their first contribution in [PR #48763](https://github.com/BerriAI/litellm/pull/48763)
- [@ucfjoe](https://github.com/ucfjoe) made their first contribution in [PR #40152](https://github.com/BerriAI/litellm/pull/40152)
- [@vanrajsinh650](https://github.com/vanrajsinh650) made their first contribution in [PR #46190](https://github.com/BerriAI/litellm/pull/46190)
- [@vanshsingh3711-wq](https://github.com/vanshsingh3711-wq) made their first contribution in [PR #44551](https://github.com/BerriAI/litellm/pull/44551)
- [@VincentG1234](https://github.com/VincentG1234) made their first contribution in [PR #44574](https://github.com/BerriAI/litellm/pull/44574)
- [@ZHOUKAILIAN](https://github.com/ZHOUKAILIAN) made their first contribution in [PR #41006](https://github.com/BerriAI/litellm/pull/41006)
- [@zoveki](https://github.com/zoveki) made their first contribution in [PR #48734](https://github.com/BerriAI/litellm/pull/48734)
- [@zuraiz-anjum](https://github.com/zuraiz-anjum) made their first contribution in [PR #44230](https://github.com/BerriAI/litellm/pull/44230)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.108.0...v1.109.0-rc.1
