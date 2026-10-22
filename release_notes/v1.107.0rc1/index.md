---
title: "1.107.0rc1 - Gemini 4 Argon, Microsoft 365 Copilot, OpenAI Live Sessions & Azure PTU Sharing"
slug: "v1-107-0-rc-1"
date: 2026-10-18T08:00:57
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
docker.litellm.ai/berriai/litellm:1.107.0-rc.1
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.107.0rc1
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.107.0-rc.1`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.107.0-rc.1) and the full [releases page](https://github.com/BerriAI/litellm/releases)

The published GitHub tag is `v1.107.0-rc.1`. These notes compare it with `v1.106.0-rc.1`, the previous release candidate cut from `main`. Changes backported onto `rc/1.106.0` and already shipped in `v1.106.0` are omitted

Customer-facing changes come first. Test, CI and internal changes are listed at the bottom

:::danger Breaking Changes

These callouts cover user-facing behavior that differs from `v1.106.0`, the latest stable release

**Fallbacks to models the caller cannot use are now skipped.** `enforce_fallback_model_access` defaults to `true`. Set `general_settings.enforce_fallback_model_access: false` to restore the old behavior. See [PR #46127](https://github.com/BerriAI/litellm/pull/46127)

**The proxy no longer starts when a configured logging callback cannot load**, for example with an unsupported `langfuse` SDK. Install a supported version or remove the callback. See [PR #46378](https://github.com/BerriAI/litellm/pull/46378)

**OpenRouter models are no longer in the built-in cost map.** Spend still comes from OpenRouter's `usage.cost`, but `litellm.get_model_info("openrouter/...")` now raises, so set any context window or price you rely on in `model_info`. See [PR #45665](https://github.com/BerriAI/litellm/pull/45665), [PR #45666](https://github.com/BerriAI/litellm/pull/45666), [PR #45667](https://github.com/BerriAI/litellm/pull/45667), [PR #45668](https://github.com/BerriAI/litellm/pull/45668), [PR #45669](https://github.com/BerriAI/litellm/pull/45669)

**`refusal` moved from `provider_specific_fields` to `message.refusal`** on chat completion responses. See [PR #44788](https://github.com/BerriAI/litellm/pull/44788)

**Token counting returns an error instead of a local estimate** when the provider's counting call fails or the deployment has no provider key, on `/v1/messages/count_tokens`, `/v1/responses/input_tokens` and Gemini `countTokens`. See [PR #46121](https://github.com/BerriAI/litellm/pull/46121), [PR #46815](https://github.com/BerriAI/litellm/pull/46815)

**The Bedrock guardrail returns 400 for attachments it cannot scan**, such as PDFs, audio or images sent by URL. Set `skip_unscannable_attachments: true` to let them through. See [PR #43383](https://github.com/BerriAI/litellm/pull/43383)

:::

## Key Highlights

- **New models**: Gemini 4 Argon on the Gemini API and Vertex AI with automatic continuation of long answers, Meta Muse Spark Open on Together AI, Fireworks AI and Baseten, MiniMax H3 video, xAI Grok Voice 3.0 and Wan 3.0 video on DashScope, among 187 new catalog entries
- **New providers**: Inference APIs, CoralBricks, ScaleDown and Microsoft 365 Copilot, plus Databricks Agent Platform agents in the agent gateway
- **OpenAI Live and SDK 3**: OpenAI Live sessions on `/v1/live/sessions` with the same auth, budgets and spend logging as Realtime, LiteLLM installs next to OpenAI SDK 3, and prompt cache breakpoints work on gpt-5.6
- **Shared Azure PTU capacity**: one Azure PTU deployment can be split across teams with per-team token ceilings, flat-cost splitting in the daily rollup and PTU-hour reporting
- **Admin and observability**: an Errors tab on Usage, opt-in telemetry controls under Settings, per-user GitHub OAuth for GitHub Copilot, and `disable_requester_ip_address_logging` to keep caller IPs out of spend logs
- **MCP Gateway**: ID-JAG grants on the gateway token endpoint and a shared gateway client for DCR bridge servers

## New Providers and Endpoints

### New Providers (4 new providers)

| Provider | Supported LiteLLM Endpoints | Description |
| --- | --- | --- |
| Inference APIs | `/v1/chat/completions`, `/v1/responses`, `/v1/messages` | OpenAI-compatible provider under `inferenceapis/`, reading `INFERENCEAPIS_API_KEY` |
| CoralBricks | `/v1/chat/completions`, `/v1/responses`, `/v1/messages` | OpenAI-compatible provider under `coralbricks/`, reading `CORALBRICKS_API_KEY` |
| ScaleDown | `/v1/chat/completions` | Native classify, extract, summarize, decisions and compress operations under `scaledown/` |
| Microsoft 365 Copilot | `/v1/chat/completions` | Graph Copilot Chat under `microsoft_365_copilot/`, exchanging the caller's JWT for a delegated Entra token |

### New LLM API Endpoints (1 new endpoint)

| Endpoint | Method | Description |
| --- | --- | --- |
| `/v1/live/sessions` | POST | OpenAI Live sessions, also on `/live/sessions` and `/openai/v1/live/sessions`, billed from `usage.seconds` |

### Expanded provider endpoint support

| Provider | Endpoint | What you can do |
| --- | --- | --- |
| Databricks Agent Platform | `/a2a/<agent>`, agent gateway | Call Model Serving agent endpoints and Databricks Apps agents with PAT or OAuth M2M auth |
| DashScope, Qwen Cloud, Qwen AI Platform | `/v1/videos` | Wan 3.0, Wan 2.7 and HappyHorse video generation |
| MiniMax | `/v1/videos` | MiniMax-H3 and H3-Max video generation |

## New Models / Updated Models

#### New Model Support (187 new models)

Counts represent new catalog identifiers compared with `v1.106.0`, including aliases and regional variants. Prices are the values bundled in this release, in USD, and runtime pricing-map reloads can update them. The 496 `openrouter` rows and 11 retired `github_copilot` rows were removed, see the Breaking Changes above

<details>
<summary>All 187 new catalog entries</summary>

| Provider | Model | Context Window | Input ($/1M tokens) | Output ($/1M tokens) | Features / special pricing |
| --- | --- | --- | --- | --- | --- |
| Amazon Bedrock | `amazon.nova-premier-v1:0` | 1,000,000 | $2.5 | $12.5 | Chat; Vision; Tool calling; Prompt caching; Structured output; PDF input |
| Amazon Bedrock | `jp.amazon.nova-2-lite-v1:0` | 1,000,000 | $0.396 | $3.311 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Video input |
| Amazon Bedrock | `twelvelabs.pegasus-1-5-v1:0` | 98,304 | - | $7.5 | Chat; Video input; `input_cost_per_video_per_second`: $0.00049 |
| Amazon Bedrock | `us.stability.stable-conservative-upscale-v1:0` | 77 | - | - | Image edit; `output_cost_per_image`: $0.4 |
| Amazon Bedrock | `us.stability.stable-creative-upscale-v1:0` | 77 | - | - | Image edit; `output_cost_per_image`: $0.6 |
| Amazon Bedrock | `us.stability.stable-fast-upscale-v1:0` | 77 | - | - | Image edit; `output_cost_per_image`: $0.03 |
| Amazon Bedrock | `us.stability.stable-image-control-sketch-v1:0` | 77 | - | - | Image edit; `output_cost_per_image`: $0.07 |
| Amazon Bedrock | `us.stability.stable-image-control-structure-v1:0` | 77 | - | - | Image edit; `output_cost_per_image`: $0.07 |
| Amazon Bedrock | `us.stability.stable-image-erase-object-v1:0` | 77 | - | - | Image edit; `output_cost_per_image`: $0.07 |
| Amazon Bedrock | `us.stability.stable-image-inpaint-v1:0` | 77 | - | - | Image edit; `output_cost_per_image`: $0.07 |
| Amazon Bedrock | `us.stability.stable-image-remove-background-v1:0` | 77 | - | - | Image edit; `output_cost_per_image`: $0.07 |
| Amazon Bedrock | `us.stability.stable-image-search-recolor-v1:0` | 77 | - | - | Image edit; `output_cost_per_image`: $0.07 |
| Amazon Bedrock | `us.stability.stable-image-search-replace-v1:0` | 77 | - | - | Image edit; `output_cost_per_image`: $0.07 |
| Amazon Bedrock | `us.stability.stable-image-style-guide-v1:0` | 77 | - | - | Image edit; `output_cost_per_image`: $0.07 |
| Amazon Bedrock | `us.stability.stable-outpaint-v1:0` | 77 | - | - | Image edit; `output_cost_per_image`: $0.06 |
| Amazon Bedrock | `us.stability.stable-style-transfer-v1:0` | 77 | - | - | Image edit; `output_cost_per_image`: $0.08 |
| Azure AI | `azure_ai/claude-opus-5-5-fast` | 1,000,000 | $8 | $40 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Azure AI | `azure_ai/Cohere-Embed-V5-Fast` | 128,000 | $0.08 | $0 | Embedding; `input_cost_per_image_token`: $0.4/1M |
| Azure AI | `azure_ai/Cohere-Embed-V5-Pro` | 128,000 | $0.12 | $0 | Embedding; `input_cost_per_image_token`: $0.4/1M |
| Baseten | `baseten/meta-models/muse-spark-open` | 1,048,576 | $1.25 | $4.25 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Audio input |
| Baseten | `baseten/nvidia/NVIDIA-Nemotron-3.5-Super-VL-120B-A12B` | 1,048,576 | $0.2 | $0.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| ChatGPT | `chatgpt/gpt-rosalind-discovery` | - | - | - | Responses |
| Coral Bricks | `coralbricks/deepseek-v4.1-flash` | 1,048,576 | $0.01 | $1.2 | Chat; Reasoning; Vision; Tool calling; Prompt caching |
| Coral Bricks | `coralbricks/deepseek-v4.1-flash-fast` | 1,048,576 | $0.01 | $1.2 | Chat; Reasoning; Vision; Tool calling; Prompt caching |
| Coral Bricks | `coralbricks/deepseek-v4.1-flash-fast-fp4` | 1,048,576 | $0.01 | $1.2 | Chat; Reasoning; Vision; Tool calling; Prompt caching |
| Coral Bricks | `coralbricks/glm-5.3` | 1,048,576 | $1.12 | $4.4 | Chat; Reasoning; Tool calling; Prompt caching |
| Coral Bricks | `coralbricks/glm-5.3-fast` | 1,048,576 | $1.12 | $4.4 | Chat; Reasoning; Tool calling; Prompt caching |
| Coral Bricks | `coralbricks/glm-5.3-fp4` | 1,048,576 | $1.12 | $4.4 | Chat; Reasoning; Tool calling; Prompt caching |
| DashScope | `dashscope/happyhorse-1.0-i2v` | - | - | - | Video generation; `output_cost_per_second`: $0.220034; `output_cost_per_second_720p`: $0.123769; `output_cost_per_second_1080p`: $0.220034 |
| DashScope | `dashscope/happyhorse-1.0-r2v` | - | - | - | Video generation; `output_cost_per_second`: $0.220034; `output_cost_per_second_720p`: $0.123769; `output_cost_per_second_1080p`: $0.220034 |
| DashScope | `dashscope/happyhorse-1.0-t2v` | - | - | - | Video generation; `output_cost_per_second`: $0.220034; `output_cost_per_second_720p`: $0.123769; `output_cost_per_second_1080p`: $0.220034 |
| DashScope | `dashscope/happyhorse-1.1-i2v` | - | - | - | Video generation; `output_cost_per_second`: $0.165026; `output_cost_per_second_480p`: $0.061885; `output_cost_per_second_720p`: $0.123769 |
| DashScope | `dashscope/happyhorse-1.1-r2v` | - | - | - | Video generation; `output_cost_per_second`: $0.165026; `output_cost_per_second_480p`: $0.061885; `output_cost_per_second_720p`: $0.123769 |
| DashScope | `dashscope/happyhorse-1.1-t2v` | - | - | - | Video generation; `output_cost_per_second`: $0.165026; `output_cost_per_second_480p`: $0.061885; `output_cost_per_second_720p`: $0.123769 |
| DashScope | `dashscope/wan2.7-i2v` | - | - | - | Video generation; `output_cost_per_second`: $0.143353; `output_cost_per_second_720p`: $0.086012; `output_cost_per_second_1080p`: $0.143353 |
| DashScope | `dashscope/wan2.7-r2v` | - | - | - | Video generation; `output_cost_per_second`: $0.143353; `output_cost_per_second_720p`: $0.086012; `output_cost_per_second_1080p`: $0.143353 |
| DashScope | `dashscope/wan2.7-t2v` | - | - | - | Video generation; `output_cost_per_second`: $0.143353; `output_cost_per_second_720p`: $0.086012; `output_cost_per_second_1080p`: $0.143353 |
| DashScope | `dashscope/wan3.0-video` | - | - | - | Video generation; `output_cost_per_second`: $0.165025; `output_cost_per_second_480p`: $0.041256; `output_cost_per_second_720p`: $0.082513 |
| DashScope | `dashscope/wan3.0-video-prime` | - | - | - | Video generation; `output_cost_per_second`: $0.254399; `output_cost_per_second_480p`: $0.0636; `output_cost_per_second_720p`: $0.127199 |
| Databricks | `databricks/ai_decide` | - | $0 | $0 | Decisions |
| Databricks | `databricks/system.ai.deepseek-v4-flash-0731` | - | - | - | Chat |
| Databricks | `databricks/system.ai.kimi-k3` | - | - | - | Chat |
| Fireworks AI | `fireworks_ai/accounts/fireworks/models/muse-spark-open` | 1,048,576 | $1.25 | $4.25 | Chat; Vision; Tool calling |
| Fireworks AI | `fireworks_ai/accounts/fireworks/routers/rune` | 262,144 | $0.042 | $0 | Decisions |
| Gemini | `gemini/gemini-4-argon` | 1,048,576 | $2 | $10 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; Audio input; Video input; `google_maps_grounding_cost_per_query`: $0.014; `output_cost_per_reasoning_token`: $10/1M |
| GitHub Copilot | `github_copilot/claude-fable-5` | 200,000 | - | - | Chat; Reasoning; Vision; Tool calling; Structured output |
| GitHub Copilot | `github_copilot/claude-fable-5.1` | 200,000 | - | - | Chat; Reasoning; Vision; Tool calling; Structured output |
| GitHub Copilot | `github_copilot/claude-haiku-5.5` | 128,000 | $0.1 | $0.5 | Chat; Reasoning; Vision; Tool calling; Structured output |
| GitHub Copilot | `github_copilot/claude-opus-4.8` | 200,000 | - | - | Chat; Reasoning; Vision; Tool calling; Structured output |
| GitHub Copilot | `github_copilot/claude-opus-4.8-fast` | 200,000 | - | - | Chat; Reasoning; Vision; Tool calling; Structured output |
| GitHub Copilot | `github_copilot/claude-opus-5` | 200,000 | - | - | Chat; Reasoning; Vision; Tool calling; Structured output |
| GitHub Copilot | `github_copilot/claude-opus-5.5` | 200,000 | - | - | Chat; Reasoning; Vision; Tool calling; Structured output |
| GitHub Copilot | `github_copilot/claude-sonnet-5` | 200,000 | - | - | Chat; Reasoning; Vision; Tool calling; Structured output |
| GitHub Copilot | `github_copilot/claude-sonnet-5.5` | 200,000 | - | - | Chat; Reasoning; Vision; Tool calling; Structured output |
| GitHub Copilot | `github_copilot/gemini-3.7-flash` | 200,000 | - | - | Chat; Reasoning; Vision; Tool calling |
| GitHub Copilot | `github_copilot/gemini-3.8-flash` | 200,000 | - | - | Chat; Reasoning; Vision; Tool calling |
| GitHub Copilot | `github_copilot/gemini-4-argon` | 200,000 | $2 | $10 | Chat; Reasoning; Vision; Tool calling |
| GitHub Copilot | `github_copilot/gpt-5.4` | 272,000 | - | - | Chat; Reasoning; Vision; Tool calling; Structured output |
| GitHub Copilot | `github_copilot/gpt-5.4-mini` | 272,000 | - | - | Responses; Reasoning; Vision; Tool calling; Structured output |
| GitHub Copilot | `github_copilot/gpt-5.5` | 272,000 | - | - | Responses; Reasoning; Vision; Tool calling; Structured output |
| GitHub Copilot | `github_copilot/gpt-5.6-luna` | 200,000 | - | - | Responses; Reasoning; Vision; Tool calling; Structured output |
| GitHub Copilot | `github_copilot/gpt-5.6-sol` | 272,000 | - | - | Responses; Reasoning; Vision; Tool calling; Structured output |
| GitHub Copilot | `github_copilot/gpt-5.6-terra` | 272,000 | - | - | Responses; Reasoning; Vision; Tool calling; Structured output |
| GitHub Copilot | `github_copilot/gpt-6-astra` | 272,000 | - | - | Responses; Reasoning; Vision; Tool calling; Structured output |
| GitHub Copilot | `github_copilot/gpt-6-luna` | 272,000 | - | - | Responses; Reasoning; Vision; Tool calling; Structured output |
| GitHub Copilot | `github_copilot/gpt-6-sol` | 272,000 | - | - | Responses; Reasoning; Vision; Tool calling; Structured output |
| GitHub Copilot | `github_copilot/gpt-6.1-sol` | 272,000 | - | - | Responses; Reasoning; Vision; Tool calling; Structured output |
| GitHub Copilot | `github_copilot/kimi-k3` | 917,504 | - | - | Chat; Vision; Tool calling; Structured output |
| GitHub Copilot | `github_copilot/mai-code-1.1-flash` | 128,000 | - | - | Responses; Vision; Tool calling; Structured output |
| InferenceAPIs | `inferenceapis/deepseek-ai/DeepSeek-V3` | 1,048,576 | $0.19 | $0.38 | Chat; Reasoning; Tool calling; Prompt caching |
| InferenceAPIs | `inferenceapis/deepseek-ai/DeepSeek-V4-Flash` | 1,048,576 | $0.19 | $0.38 | Chat; Reasoning; Tool calling; Prompt caching |
| InferenceAPIs | `inferenceapis/deepseek-ai/DeepSeek-V4-Flash-0731` | 1,048,576 | $0.19 | $0.38 | Chat; Reasoning; Tool calling; Prompt caching |
| InferenceAPIs | `inferenceapis/deepseek-ai/DeepSeek-V4-Pro` | 1,048,576 | $1.72 | $5.15 | Chat; Reasoning; Tool calling; Prompt caching |
| InferenceAPIs | `inferenceapis/deepseek-ai/DeepSeek-V4-Pro-0813` | 1,048,576 | $1.72 | $5.15 | Chat; Reasoning; Tool calling; Prompt caching |
| InferenceAPIs | `inferenceapis/deepseek-ai/DeepSeek-V4.1-Flash` | 1,048,576 | $0.4 | $1.6 | Chat; Reasoning; Tool calling; Prompt caching |
| InferenceAPIs | `inferenceapis/deepseek-chat` | 1,048,576 | $0.19 | $0.38 | Chat; Reasoning; Tool calling; Prompt caching |
| InferenceAPIs | `inferenceapis/deepseek-flash` | 1,048,576 | $0.4 | $1.6 | Chat; Reasoning; Tool calling; Prompt caching |
| InferenceAPIs | `inferenceapis/deepseek-reasoner` | 1,048,576 | $0.19 | $0.38 | Chat; Reasoning; Tool calling; Prompt caching |
| InferenceAPIs | `inferenceapis/deepseek-v3` | 1,048,576 | $0.19 | $0.38 | Chat; Reasoning; Tool calling; Prompt caching |
| InferenceAPIs | `inferenceapis/deepseek-v4-flash` | 1,048,576 | $0.19 | $0.38 | Chat; Reasoning; Tool calling; Prompt caching |
| InferenceAPIs | `inferenceapis/deepseek-v4-pro` | 1,048,576 | $1.72 | $5.15 | Chat; Reasoning; Tool calling; Prompt caching |
| InferenceAPIs | `inferenceapis/deepseek-v4.1-flash` | 1,048,576 | $0.4 | $1.6 | Chat; Reasoning; Tool calling; Prompt caching |
| InferenceAPIs | `inferenceapis/glm-5.3` | 1,048,575 | $1.82 | $5.72 | Chat; Reasoning; Tool calling; Prompt caching |
| InferenceAPIs | `inferenceapis/glm-5.3-flash` | 1,048,575 | $0.2 | $0.66 | Chat; Reasoning; Tool calling; Prompt caching |
| InferenceAPIs | `inferenceapis/gpt-oss-120b` | 131,072 | $0.2 | $0.8 | Chat; Reasoning; Tool calling |
| InferenceAPIs | `inferenceapis/gpt-oss-20b` | 131,072 | $0.04 | $0.19 | Chat; Reasoning; Tool calling |
| InferenceAPIs | `inferenceapis/kimi-k2.7-code` | 262,144 | $0.89 | $4.42 | Chat; Reasoning; Tool calling; Prompt caching |
| InferenceAPIs | `inferenceapis/llama-3.1-8b-instant` | 131,072 | $0.2 | $0.5 | Chat; Tool calling |
| InferenceAPIs | `inferenceapis/llama-3.3-70b` | 131,072 | $0.2 | $0.5 | Chat; Tool calling |
| InferenceAPIs | `inferenceapis/llama-3.3-70b-instruct` | 131,072 | $0.2 | $0.5 | Chat; Tool calling |
| InferenceAPIs | `inferenceapis/llama-3.3-70b-versatile` | 131,072 | $0.2 | $0.5 | Chat; Tool calling |
| InferenceAPIs | `inferenceapis/meta-llama/Llama-3.3-70B-Instruct` | 131,072 | $0.2 | $0.5 | Chat; Tool calling |
| InferenceAPIs | `inferenceapis/meta-llama/Llama-3.3-70B-Instruct-Turbo` | 131,072 | $0.2 | $0.5 | Chat; Tool calling |
| InferenceAPIs | `inferenceapis/minimax-m3` | 524,288 | $0.39 | $1.56 | Chat; Reasoning; Tool calling; Prompt caching |
| InferenceAPIs | `inferenceapis/MiniMaxAI/MiniMax-M3` | 524,288 | $0.39 | $1.56 | Chat; Reasoning; Tool calling; Prompt caching |
| InferenceAPIs | `inferenceapis/moonshotai/Kimi-K2.7-Code` | 262,144 | $0.89 | $4.42 | Chat; Reasoning; Tool calling; Prompt caching |
| InferenceAPIs | `inferenceapis/openai/gpt-oss-120b` | 131,072 | $0.2 | $0.8 | Chat; Reasoning; Tool calling |
| InferenceAPIs | `inferenceapis/openai/gpt-oss-20b` | 131,072 | $0.04 | $0.19 | Chat; Reasoning; Tool calling |
| InferenceAPIs | `inferenceapis/Qwen/Qwen3-VL-235B-A22B-Instruct` | 262,144 | $0.26 | $1.15 | Chat; Vision; Tool calling |
| InferenceAPIs | `inferenceapis/Qwen/Qwen3.8-Flash` | 1,000,000 | $0.15 | $0.5 | Chat; Reasoning; Tool calling; Prompt caching |
| InferenceAPIs | `inferenceapis/qwen3-vl` | 262,144 | $0.26 | $1.15 | Chat; Vision; Tool calling |
| InferenceAPIs | `inferenceapis/qwen3-vl-235b` | 262,144 | $0.26 | $1.15 | Chat; Vision; Tool calling |
| InferenceAPIs | `inferenceapis/qwen3.8-flash` | 1,000,000 | $0.15 | $0.5 | Chat; Reasoning; Tool calling; Prompt caching |
| InferenceAPIs | `inferenceapis/zai-org/GLM-5.3` | 1,048,575 | $1.82 | $5.72 | Chat; Reasoning; Tool calling; Prompt caching |
| InferenceAPIs | `inferenceapis/zai-org/GLM-5.3-Flash` | 1,048,575 | $0.2 | $0.66 | Chat; Reasoning; Tool calling; Prompt caching |
| Meta | `meta/muse-wonder-1.0` | 1,048,576 | $4 | $20 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search |
| Microsoft 365 Copilot | `microsoft_365_copilot/chat` | - | $0 | $0 | Chat |
| MiniMax | `minimax/MiniMax-H3` | - | - | - | Video generation; `output_cost_per_second`: $0.08; `output_cost_per_second_768p`: $0.08; `output_cost_per_second_2k`: $0.13 |
| MiniMax | `minimax/MiniMax-H3-Max` | - | - | - | Video generation; `output_cost_per_second`: $0.08; `output_cost_per_second_480p`: $0.05; `output_cost_per_second_768p`: $0.08 |
| OCI | `oci/openai.gpt-oss-120b` | 128,000 | $0.15 | $0.6 | Chat; Reasoning; Tool calling |
| OCI | `oci/openai.gpt-oss-20b` | 128,000 | $0.07 | $0.3 | Chat; Reasoning; Tool calling |
| OCI | `oci/xai.grok-4.20-0309-non-reasoning` | 1,000,000 | $1.25 | $2.5 | Chat; Tool calling |
| OCI | `oci/xai.grok-4.20-0309-reasoning` | 1,000,000 | $1.25 | $2.5 | Chat; Reasoning; Tool calling |
| OCI | `oci/xai.grok-4.20-non-reasoning` | 1,000,000 | $1.25 | $2.5 | Chat; Tool calling |
| OCI | `oci/xai.grok-4.20-reasoning` | 1,000,000 | $1.25 | $2.5 | Chat; Reasoning; Tool calling |
| OpenAI | `computer-use-preview-2025-03-11` | 8,192 | $3 | $12 | Chat; Reasoning; Vision; Tool calling; PDF input |
| OpenAI | `gpt-4o-mini-search-preview-2025-03-11` | 128,000 | $0.15 | $0.6 | Chat; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search |
| OpenAI | `gpt-4o-search-preview-2025-03-11` | 128,000 | $2.5 | $10 | Chat; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search |
| OpenAI | `gpt-5.5-cyber-preview` | - | $12.5 | $75 | Chat; Reasoning |
| OpenAI | `gpt-audio-mini-2025-10-06` | 128,000 | $0.6 | $2.4 | Chat; Tool calling; Audio input; Audio output; `input_cost_per_audio_token`: $10/1M; `output_cost_per_audio_token`: $20/1M |
| OpenAI | `gpt-rosalind-discovery` | - | $5 | $25 | Chat |
| OpenAI | `o3-deep-research-2025-06-26` | 200,000 | $10 | $40 | Responses; Reasoning; Vision; Prompt caching; PDF input |
| OpenAI | `o4-mini-deep-research-2025-06-26` | 200,000 | $2 | $8 | Responses; Reasoning; Vision; Prompt caching; PDF input |
| Perplexity | `perplexity/openai/gpt-5-nano` | - | $0.05 | $0.4 | Responses |
| Perplexity | `perplexity/openai/gpt-5.3-codex` | - | $3.5 | $28 | Responses |
| Perplexity | `perplexity/openai/gpt-6-astra` | - | $10 | $50 | Responses |
| Perplexity | `perplexity/perplexity/deepseek-v4-pro-0813` | - | $1.32 | $3.96 | Responses |
| Perplexity | `perplexity/pplx-decider-v1.1-27b` | 262,144 | $0.02 | $0 | Decisions |
| Qwen AI Platform | `qwen_ai_platform/happyhorse-1.0-i2v` | - | - | - | Video generation; `output_cost_per_second`: $0.220034; `output_cost_per_second_720p`: $0.123769; `output_cost_per_second_1080p`: $0.220034 |
| Qwen AI Platform | `qwen_ai_platform/happyhorse-1.0-r2v` | - | - | - | Video generation; `output_cost_per_second`: $0.220034; `output_cost_per_second_720p`: $0.123769; `output_cost_per_second_1080p`: $0.220034 |
| Qwen AI Platform | `qwen_ai_platform/happyhorse-1.0-t2v` | - | - | - | Video generation; `output_cost_per_second`: $0.220034; `output_cost_per_second_720p`: $0.123769; `output_cost_per_second_1080p`: $0.220034 |
| Qwen AI Platform | `qwen_ai_platform/happyhorse-1.1-i2v` | - | - | - | Video generation; `output_cost_per_second`: $0.165026; `output_cost_per_second_480p`: $0.061885; `output_cost_per_second_720p`: $0.123769 |
| Qwen AI Platform | `qwen_ai_platform/happyhorse-1.1-r2v` | - | - | - | Video generation; `output_cost_per_second`: $0.165026; `output_cost_per_second_480p`: $0.061885; `output_cost_per_second_720p`: $0.123769 |
| Qwen AI Platform | `qwen_ai_platform/happyhorse-1.1-t2v` | - | - | - | Video generation; `output_cost_per_second`: $0.165026; `output_cost_per_second_480p`: $0.061885; `output_cost_per_second_720p`: $0.123769 |
| Qwen AI Platform | `qwen_ai_platform/wan2.7-i2v` | - | - | - | Video generation; `output_cost_per_second`: $0.143353; `output_cost_per_second_720p`: $0.086012; `output_cost_per_second_1080p`: $0.143353 |
| Qwen AI Platform | `qwen_ai_platform/wan2.7-r2v` | - | - | - | Video generation; `output_cost_per_second`: $0.143353; `output_cost_per_second_720p`: $0.086012; `output_cost_per_second_1080p`: $0.143353 |
| Qwen AI Platform | `qwen_ai_platform/wan2.7-t2v` | - | - | - | Video generation; `output_cost_per_second`: $0.143353; `output_cost_per_second_720p`: $0.086012; `output_cost_per_second_1080p`: $0.143353 |
| Qwen AI Platform | `qwen_ai_platform/wan3.0-video` | - | - | - | Video generation; `output_cost_per_second`: $0.165025; `output_cost_per_second_480p`: $0.041256; `output_cost_per_second_720p`: $0.082513 |
| Qwen AI Platform | `qwen_ai_platform/wan3.0-video-prime` | - | - | - | Video generation; `output_cost_per_second`: $0.254399; `output_cost_per_second_480p`: $0.0636; `output_cost_per_second_720p`: $0.127199 |
| Qwen Cloud | `qwencloud/happyhorse-1.0-i2v` | - | - | - | Video generation; `output_cost_per_second`: $0.24; `output_cost_per_second_720p`: $0.14; `output_cost_per_second_1080p`: $0.24 |
| Qwen Cloud | `qwencloud/happyhorse-1.0-r2v` | - | - | - | Video generation; `output_cost_per_second`: $0.24; `output_cost_per_second_720p`: $0.14; `output_cost_per_second_1080p`: $0.24 |
| Qwen Cloud | `qwencloud/happyhorse-1.0-t2v` | - | - | - | Video generation; `output_cost_per_second`: $0.24; `output_cost_per_second_720p`: $0.14; `output_cost_per_second_1080p`: $0.24 |
| Qwen Cloud | `qwencloud/happyhorse-1.1-i2v` | - | - | - | Video generation; `output_cost_per_second`: $0.18; `output_cost_per_second_480p`: $0.07; `output_cost_per_second_720p`: $0.14 |
| Qwen Cloud | `qwencloud/happyhorse-1.1-r2v` | - | - | - | Video generation; `output_cost_per_second`: $0.18; `output_cost_per_second_480p`: $0.07; `output_cost_per_second_720p`: $0.14 |
| Qwen Cloud | `qwencloud/happyhorse-1.1-t2v` | - | - | - | Video generation; `output_cost_per_second`: $0.18; `output_cost_per_second_480p`: $0.07; `output_cost_per_second_720p`: $0.14 |
| Qwen Cloud | `qwencloud/wan2.7-i2v` | - | - | - | Video generation; `output_cost_per_second`: $0.15; `output_cost_per_second_720p`: $0.1; `output_cost_per_second_1080p`: $0.15 |
| Qwen Cloud | `qwencloud/wan2.7-r2v` | - | - | - | Video generation; `output_cost_per_second`: $0.15; `output_cost_per_second_720p`: $0.1; `output_cost_per_second_1080p`: $0.15 |
| Qwen Cloud | `qwencloud/wan2.7-t2v` | - | - | - | Video generation; `output_cost_per_second`: $0.15; `output_cost_per_second_720p`: $0.1; `output_cost_per_second_1080p`: $0.15 |
| Qwen Cloud | `qwencloud/wan3.0-video` | - | - | - | Video generation; `output_cost_per_second`: $0.2; `output_cost_per_second_480p`: $0.05; `output_cost_per_second_720p`: $0.1 |
| Qwen Cloud | `qwencloud/wan3.0-video-prime` | - | - | - | Video generation; `output_cost_per_second`: $0.28; `output_cost_per_second_480p`: $0.068; `output_cost_per_second_720p`: $0.14 |
| ScaleDown | `scaledown/classify` | - | $0.05 | $0 | Chat |
| ScaleDown | `scaledown/compress` | - | $0.05 | $0 | Chat |
| ScaleDown | `scaledown/decisions` | - | $0.05 | $0 | Chat |
| ScaleDown | `scaledown/extract` | - | $0.05 | $0 | Chat |
| ScaleDown | `scaledown/summarize` | - | $0.05 | $0 | Chat |
| SCX AI | `scx-ai/DeepSeek-V4.1-flash` | 1,000,000 | $0.15 | $0.6 | Chat; Reasoning; Vision; Tool calling; Prompt caching |
| SCX AI | `scx-ai/GLM-5.3` | 1,000,000 | $0.98 | $3.08 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| SCX AI | `scx-ai/Kimi-K3` | 1,000,000 | $2.83 | $14.13 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Tencent | `tencent/deepseek-v4-pro-0813` | 1,000,000 | $1.32 | $3.96 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Tencent | `tencent/deepseek-v4.1-flash` | 1,000,000 | $0.3 | $1.2 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Tencent | `tencent/glm-5.2` | 1,000,000 | $1.4 | $4.4 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Tencent | `tencent/glm-5.3` | 1,000,000 | $1.4 | $4.4 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Tencent | `tencent/glm-5.3-flash` | 1,000,000 | $0.15 | $0.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Video input |
| Tencent | `tencent/glm-5.3-flashx` | 1,000,000 | $0.37 | $1.25 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Video input |
| Tencent | `tencent/kimi-k2.7-code` | 256,000 | $0.95 | $4 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Tencent | `tencent/kimi-k2.7-code-highspeed` | 256,000 | $1.9 | $8 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Tencent | `tencent/kimi-k2.8-preview` | 1,000,000 | $1 | $4 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Tencent | `tencent/kimi-k3` | 1,000,000 | $3 | $15 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Together AI | `together_ai/meta-models/Muse-Spark-Open-816B-A42B` | 1,048,576 | $1.25 | $4.25 | Chat; Tool calling; Prompt caching; Structured output |
| Together AI | `together_ai/nvidia/NVIDIA-Nemotron-3.5-Super-VL` | 262,144 | $0.15 | $0.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Vertex AI | `gemini-robotics-er-2-preview` | 131,072 | $1 | $5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; Audio input; Video input; `input_cost_per_audio_token`: $1/1M; `output_cost_per_reasoning_token`: $5/1M |
| Vertex AI | `vertex_ai/deepseek-ai/deepseek-v4.1-flash-maas` | 1,048,576 | $0.3 | $1.2 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Vertex AI | `vertex_ai/gemini-4-argon` | 1,048,576 | $2 | $10 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; Audio input; Video input; `google_maps_grounding_cost_per_query`: $0.014; `input_cost_per_audio_token`: $2/1M; `output_cost_per_reasoning_token`: $10/1M |
| Vertex AI | `vertex_ai/gemini-4-argon-cyber-permissive` | 1,048,576 | $4 | $20 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; Audio input; Video input; `google_maps_grounding_cost_per_query`: $0.014; `input_cost_per_audio_token`: $4/1M; `output_cost_per_reasoning_token`: $20/1M |
| Vertex AI | `vertex_ai/gemini-robotics-er-2-preview` | 131,072 | $1 | $5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; Audio input; Video input; `input_cost_per_audio_token`: $1/1M; `output_cost_per_reasoning_token`: $5/1M |
| Vertex AI | `vertex_ai/semantic-ranker-default` | - | $0 | $0 | Rerank; `input_cost_per_query`: $0.001 |
| Vertex AI | `vertex_ai/semantic-ranker-default-002` | - | $0 | $0 | Rerank; `input_cost_per_query`: $0.001 |
| Vertex AI | `vertex_ai/semantic-ranker-default-003` | - | $0 | $0 | Rerank; `input_cost_per_query`: $0.001 |
| Vertex AI | `vertex_ai/semantic-ranker-default-004` | - | $0 | $0 | Rerank; `input_cost_per_query`: $0.001 |
| Vertex AI | `vertex_ai/semantic-ranker-default@latest` | - | $0 | $0 | Rerank; `input_cost_per_query`: $0.001 |
| Vertex AI | `vertex_ai/semantic-ranker-fast` | - | $0 | $0 | Rerank; `input_cost_per_query`: $0.001 |
| Vertex AI | `vertex_ai/semantic-ranker-fast-004` | - | $0 | $0 | Rerank; `input_cost_per_query`: $0.001 |
| Vertex AI | `vertex_ai/semantic-ranker-fast@latest` | - | $0 | $0 | Rerank; `input_cost_per_query`: $0.001 |
| Weights & Biases | `wandb/nvidia/NVIDIA-Nemotron-3.5-Super-VL-120B-A12B` | 1,049,000 | $0.15 | $0.75 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| xAI | `xai/grok-voice-2.0` | - | - | - | Realtime; Tool calling; Audio input; Audio output; `input_cost_per_second`: $0.001333; `input_cost_per_text_message`: $0.004 |
| xAI | `xai/grok-voice-3.0` | - | - | - | Realtime; Tool calling; Audio input; Audio output; `input_cost_per_second`: $0.001333; `input_cost_per_text_message`: $0.004 |
| xAI | `xai/grok-voice-latest` | - | - | - | Realtime; Tool calling; Audio input; Audio output; `input_cost_per_second`: $0.001333; `input_cost_per_text_message`: $0.004 |

</details>

### New providers

- Add Inference APIs as an OpenAI-compatible provider under the `inferenceapis/` prefix, reading `INFERENCEAPIS_API_KEY`, listed in the Add Model form, with 12 priced chat models and native `/v1/responses` and `/v1/messages` - [PR #41669](https://github.com/BerriAI/litellm/pull/41669)
- Add ScaleDown as a native text provider under the `scaledown/` prefix with classify, extract, summarize, decisions and compress operations, `x-api-key` authentication, tracked cost, and an Add Model entry in the Admin UI - [PR #44168](https://github.com/BerriAI/litellm/pull/44168)
- Add CoralBricks as an OpenAI-compatible provider under the `coralbricks/` prefix, reading `CORALBRICKS_API_KEY`, listed in the Add Model form, with pricing for `glm-5.3-fast` and `deepseek-v4.1-flash-fast` - [PR #44700](https://github.com/BerriAI/litellm/pull/44700)
- Add Microsoft 365 Copilot as a chat provider under the `microsoft_365_copilot/` prefix that exchanges the caller's JWT for a delegated Graph token through RFC 8693 or JWT bearer on-behalf-of, configured with an LLM credential in the Add Model form - [PR #45158](https://github.com/BerriAI/litellm/pull/45158)

### Decisions providers

- Add Laya and Bespoke Nimble to the Add Model form and serve `laya/*` and `bespoke/*` deployments on the Decisions routes through `<api_base>/v1/systemone` - [PR #45260](https://github.com/BerriAI/litellm/pull/45260)
- Call the `ai_decide` AI Function route at `<workspace>/api/2.0/ai-functions/ai-decide` for `databricks/ai_decide`, so Decisions and the Databricks Auto Router classifier no longer get a 404 - [PR #45722](https://github.com/BerriAI/litellm/pull/45722)
- Bill `/v1/decisions` and `/v1/systemone` from `<field>_decisions` cost map keys, so `gpt-6-luna` Decisions are priced at 0.10 USD per 1M input tokens with no output or cache charges - [PR #45904](https://github.com/BerriAI/litellm/pull/45904)
- Add Fireworks AI `accounts/fireworks/routers/rune` on `/v1/decisions` and `/v1/systemone`, reading `FIREWORKS_AI_API_KEY` and billing cached tokens at the cheaper rate - [PR #46057](https://github.com/BerriAI/litellm/pull/46057)
- Answer 400 on a malformed `provider_specific_header` in `litellm.decisions` and `litellm.systemone` instead of silently dropping it - [PR #46619](https://github.com/BerriAI/litellm/pull/46619)
- Keep `box` answers from OpenAI-format decisions providers instead of parsing them as refusals - [PR #46633](https://github.com/BerriAI/litellm/pull/46633)
- Read a deployment's own `supports_box_questions` flag before the cost map, so a flagged deployment accepts `box` questions - [PR #46696](https://github.com/BerriAI/litellm/pull/46696)

### Amazon Bedrock

- Map Bedrock Mantle's OpenAI-shaped `context_length_exceeded` errors to `ContextWindowExceededError`, so Claude Code compacts and `context_window_fallbacks` fire - [PR #41747](https://github.com/BerriAI/litellm/pull/41747)
- List the models the account can invoke behind `bedrock/*` when `check_provider_endpoint: true`, instead of the static catalog or no Bedrock models at all - [PR #43981](https://github.com/BerriAI/litellm/pull/43981)
- Send `max_completion_tokens` instead of `max_tokens` to Bedrock Mantle gpt-5.x and gpt-6 chat completions, which rejected `max_tokens` with a 400 - [PR #43982](https://github.com/BerriAI/litellm/pull/43982)
- Turn each `tool_reference` in a tool result into a text block holding the tool name on Bedrock Converse, so ToolSearch results no longer reach Bedrock as empty `toolResult.content` and fail with a 400 - [PR #44590](https://github.com/BerriAI/litellm/pull/44590)
- Default Bedrock Grok 4.6 and 4.7 to native Chat Completions, remint positional `call_<n>` tool call ids as unique `call_<uuid>` and drop `stop` for Grok, so Claude Code no longer 400s after a ToolSearch turn - [PR #45473](https://github.com/BerriAI/litellm/pull/45473)
- Place images from a tool result beside the tool result on Bedrock OpenAI GPT models, which rejected images nested in `toolResult.content` with a 400 - [PR #45579](https://github.com/BerriAI/litellm/pull/45579)
- Add the `twelvelabs.pegasus-1-5-v1:0` row and set the context window of the Bedrock GPT-5.x rows to 1,050,000 tokens from the model cards - [PR #45621](https://github.com/BerriAI/litellm/pull/45621)
- Drop `stop` for Bedrock GPT 5.6 and newer instead of sending `stopSequences` that Bedrock rejects with a 400, which unblocks Claude Code auto mode - [PR #45664](https://github.com/BerriAI/litellm/pull/45664)
- Reprice the regionless `bedrock/moonshotai.kimi-k2.5` and `bedrock/moonshotai.kimi-k2-thinking` rows to the us-east-1 Bedrock prices - [PR #45836](https://github.com/BerriAI/litellm/pull/45836)
- Raise the max output tokens of the Bedrock `zai.glm-4.7` and `zai.glm-4.7-flash` rows from 4,000 to 128,000, from the model cards - [PR #45976](https://github.com/BerriAI/litellm/pull/45976)
- Take context windows, max output tokens and end-of-life dates for 46 Bedrock rows from the Bedrock model cards - [PR #45980](https://github.com/BerriAI/litellm/pull/45980)
- Replay `redacted_thinking` on Converse and return its `data` as Claude's own string, so a Converse turn replays on Invoke and `anthropic/` instead of getting a 400 - [PR #46532](https://github.com/BerriAI/litellm/pull/46532)
- Use `base_model` for Claude capability checks on application inference profile ARNs, so adaptive `thinking` on an Opus 4.8 ARN is no longer rewritten into a fixed budget - [PR #46569](https://github.com/BerriAI/litellm/pull/46569)
- Grant `sts:GetWebIdentityToken` and `sts:TagGetWebIdentityToken` in the web identity session policy, so `bedrock/claude_platform/*` models using OIDC web identity auth no longer return 403 - [PR #46670](https://github.com/BerriAI/litellm/pull/46670)
- Type `PerformanceConfigBlock.latency` as `standard` or `optimized` to match the values Bedrock accepts, instead of `throughput` - [PR #46698](https://github.com/BerriAI/litellm/pull/46698)
- Add the `jp.amazon.nova-2-lite-v1:0` Japan geo inference profile to the model catalog - [PR #46721](https://github.com/BerriAI/litellm/pull/46721)
- Add Priority and Flex tier prices to `openai.gpt-oss-120b-1:0` and `openai.gpt-oss-20b-1:0` - [PR #46728](https://github.com/BerriAI/litellm/pull/46728)
- Reject malformed Nova Sonic realtime session settings, keep cache read and write tokens on streamed cache hits, keep Prometheus rate limit gauges on `/v1/messages`, and price exact cost-map names so Bedrock calls stop billing zero - [PR #47090](https://github.com/BerriAI/litellm/pull/47090)

### Anthropic

- Add an empty `""` placeholder when the last Claude user message has `null`, `[]` or missing `content`, so these requests no longer fail with a prefill 400 - [PR #41397](https://github.com/BerriAI/litellm/pull/41397)
- Keep `stop_reason` and `stop_details` from Anthropic refusals on the response and the logged response across `/chat/completions`, `/v1/responses` and `/v1/messages`, so callbacks see more than `content_filter` - [PR #46104](https://github.com/BerriAI/litellm/pull/46104)
- Stream `json_schema` answers as `delta.content` on Bedrock Mantle and Claude Platform, and join answers that Claude splits into one tool block per field into a single object - [PR #46331](https://github.com/BerriAI/litellm/pull/46331)
- Check forced tool support on the real Vertex model, skip a non-string `metadata.user_id` instead of returning a 500, and drop `speed` under `drop_params` for providers that reject it - [PR #46337](https://github.com/BerriAI/litellm/pull/46337)
- Keep signed thinking blocks with empty text on chat completions, return the 400 when a `/v1/messages` caller sets `block_binding.prefix_mismatch_behavior` to `error`, and keep `thinking.block_binding` on Bedrock Invoke - [PR #46342](https://github.com/BerriAI/litellm/pull/46342)
- Translate OpenAI's `tool_search` tool on `/v1/chat/completions` into Anthropic's regex tool search for Claude models instead of answering 500, and answer 400 naming the fix where a route cannot run it - [PR #46389](https://github.com/BerriAI/litellm/pull/46389)
- Keep the `tool_search_tool_result` block in `provider_specific_fields["tool_results"]` and replay it after its `server_tool_use`, so the second call of a Claude tool search loop no longer gets a 400 - [PR #46440](https://github.com/BerriAI/litellm/pull/46440)
- Forward `service_tier` on chat completions to Anthropic and Azure Foundry Claude, map OpenAI's `default` to `standard_only`, and answer 400 with a `drop_params` hint for tiers Claude does not take - [PR #46461](https://github.com/BerriAI/litellm/pull/46461)
- Count the cache mark on a replayed server tool call the way `modify_params` sends it, so the cache control hook no longer adds a fifth mark that Anthropic rejects with a 400 - [PR #46591](https://github.com/BerriAI/litellm/pull/46591)
- Drop unknown legacy `thinking` keys under `drop_params` when rebuilding adaptive `thinking`, and drop `budget_tokens` from the rebuilt block, so Claude no longer returns 400 - [PR #46741](https://github.com/BerriAI/litellm/pull/46741)

### Azure

- Add `azure_ai/Cohere-Embed-V5-Fast` and `azure_ai/Cohere-Embed-V5-Pro` embedding models to the cost map - [PR #45764](https://github.com/BerriAI/litellm/pull/45764)
- Move the `deprecation_date` of `azure/gpt-realtime-translate` to 2027-11-09, matching the Azure Models API - [PR #45849](https://github.com/BerriAI/litellm/pull/45849)
- Move the `deprecation_date` of `azure_ai/kimi-k2.7-code` to 2027-04-16, matching the Azure Models API - [PR #45945](https://github.com/BerriAI/litellm/pull/45945)
- Sync Azure `text-embedding-3-large`, `text-embedding-3-small`, `text-embedding-ada-002`, `tts-1-hd` and legacy GPT-4 Turbo and GPT-3.5 Turbo Instruct prices with the Azure OpenAI pricing page - [PR #46200](https://github.com/BerriAI/litellm/pull/46200)
- Add `azure_ai/claude-opus-5-5-fast` at twice the `azure_ai/claude-opus-5-5` prices with a 2027-10-01 deprecation date - [PR #46760](https://github.com/BerriAI/litellm/pull/46760)

### Baseten

- Add `baseten/meta-models/muse-spark-open` and `baseten/nvidia/NVIDIA-Nemotron-3.5-Super-VL-120B-A12B` to the model catalog - [PR #46794](https://github.com/BerriAI/litellm/pull/46794)

### Crusoe

- Default Crusoe calls to `https://api.inference.crusoecloud.com/v1`, since the legacy host's firewall rejected some prompts with a 403, and `CRUSOE_API_BASE` still overrides it - [PR #33121](https://github.com/BerriAI/litellm/pull/33121)

### DashScope

- Add Wan 3.0, Wan 2.7 and HappyHorse video generation on `/v1/videos` for `dashscope/`, `qwencloud` and `qwen_ai_platform`, with per-region pricing - [PR #43706](https://github.com/BerriAI/litellm/pull/43706)

### Databricks

- Keep `#/$defs` refs as the client sent them in Databricks `json_schema` response formats, so nested types no longer fail with a 400 on non-Claude models - [PR #45659](https://github.com/BerriAI/litellm/pull/45659)
- Send a single plain text block as a string to non-Claude Databricks models, so JSON mode no longer fails with a 400 on `model_info.mode: responses` deployments - [PR #45686](https://github.com/BerriAI/litellm/pull/45686)
- Accept `service_tier` on Databricks requests, including `/v1/responses` calls to chat models, and return the served `service_tier` on non-streamed responses so pricing can see it - [PR #46111](https://github.com/BerriAI/litellm/pull/46111)

### Gemini and Vertex AI

- Add `litellm_settings.gemini_include_thoughts_default`, and set it to `false` to stop requesting Gemini thought summaries while thinking and reasoning tokens stay on - [PR #36460](https://github.com/BerriAI/litellm/pull/36460)
- Send a tool result containing a string `$ref` to Gemini and Vertex AI as raw JSON text in `content`, so the next turn is no longer rejected with a 400 - [PR #38284](https://github.com/BerriAI/litellm/pull/38284)
- Report an unreadable `vertex_credentials` file as a file read failure that points to the log, instead of saying the JSON is invalid - [PR #40173](https://github.com/BerriAI/litellm/pull/40173)
- Keep every non-null `anyOf` branch when stripping `null` types for Gemini and Vertex AI, so doubled or single `null` unions no longer leak a `null` branch or fail with a 500, and `["integer","null"]` fields stop coming back as `0` - [PR #41683](https://github.com/BerriAI/litellm/pull/41683)
- Route Vertex AI Model Garden and partner models such as `xai/grok-*` through the chat completions adapter on `:generateContent`, `:streamGenerateContent` and `:countTokens`, instead of 404 and 500 errors from the native Google path - [PR #41836](https://github.com/BerriAI/litellm/pull/41836)
- Stop adding `temperature: 1.0` to Gemini 3 and newer requests that omit it, and keep forwarding an explicit `temperature` as before - [PR #45107](https://github.com/BerriAI/litellm/pull/45107)
- Map 12 OpenAI voice names such as `alloy` to Gemini prebuilt TTS voices, so Gemini TTS no longer fails with a 400 and passes the default health check - [PR #45303](https://github.com/BerriAI/litellm/pull/45303)
- Unwrap Vertex AI Claude `json_schema` answers nested under keys such as `parameters` or `input`, and send `output_config.format` instead of the deprecated `output_format`, so structured outputs stop failing with a 400 - [PR #45871](https://github.com/BerriAI/litellm/pull/45871)
- Price Vertex AI `semantic-ranker` rerank at 1.00 USD per 1,000 queries, instead of logging every rerank request at zero spend - [PR #46061](https://github.com/BerriAI/litellm/pull/46061)
- Add `vertex_ai/gemini-robotics-er-2-preview` to the model catalog - [PR #46126](https://github.com/BerriAI/litellm/pull/46126)
- Add `gemini/gemini-4-argon` to the model catalog with Gemini API prices - [PR #46227](https://github.com/BerriAI/litellm/pull/46227)
- Add `vertex_ai/gemini-4-argon` to the model catalog with Vertex AI prices and capability flags - [PR #46228](https://github.com/BerriAI/litellm/pull/46228)
- Raise `gemini/gemini-4-argon` `max_output_tokens` from 32768 to 65536 to match the default output limit in the model docs - [PR #46236](https://github.com/BerriAI/litellm/pull/46236)
- Add `vertex_ai/gemini-4-argon` standard, priority and flex/batch pricing with the non-global uplift, so Vertex AI calls return a response cost - [PR #46237](https://github.com/BerriAI/litellm/pull/46237)
- Continue Gemini 4 long answers automatically with Google's `continuationToken` until `max_tokens` is spent, sum usage across the calls, and cancel interactions at `{id}/cancel` - [PR #46240](https://github.com/BerriAI/litellm/pull/46240)
- Remove the duplicate `vertex_ai/gemini-4-argon` rows and the bare `gemini-4-argon` row, so only the `vertex_ai/` prefixed name resolves - [PR #46246](https://github.com/BerriAI/litellm/pull/46246)
- Add `vertex_ai/gemini-4-argon-cyber-permissive` to the model catalog with Vertex AI prices - [PR #46249](https://github.com/BerriAI/litellm/pull/46249)
- Pass the per-request `timeout` to Vertex AI and Google AI Studio Gemini streaming calls, so a stalled stream raises instead of waiting for the 6000s default - [PR #46349](https://github.com/BerriAI/litellm/pull/46349)
- Add the 2025-11-14 shutdown date to `gemini-2.0-flash-exp-image-generation` and its `gemini/` row - [PR #46489](https://github.com/BerriAI/litellm/pull/46489)
- Add Flex prices for input, cached input and output to `gemini-nano-banana-2.1` and `vertex_ai/gemini-nano-banana-2.1` - [PR #46512](https://github.com/BerriAI/litellm/pull/46512)
- Add `vertex_ai/deepseek-ai/deepseek-v4.1-flash-maas` to the model catalog with Vertex AI prices - [PR #46729](https://github.com/BerriAI/litellm/pull/46729)
- Price `vertex_ai/deepseek-ai/deepseek-v4.1-flash-maas` at zero while Vertex AI offered it at no charge - [PR #46753](https://github.com/BerriAI/litellm/pull/46753)
- Move `vertex_ai/deepseek-ai/deepseek-v4.1-flash-maas` from $0 to its published paid price now that the free period has ended - [PR #46793](https://github.com/BerriAI/litellm/pull/46793)
- Drop `cache_read_input_token_cost_flex` from the four Vertex AI Gemini 3 preview rows, since Vertex AI lists cached Flex input as unavailable - [PR #46826](https://github.com/BerriAI/litellm/pull/46826)

### GitHub Copilot

- Add a Per-user GitHub OAuth auth type for GitHub Copilot credentials, so each `github_copilot/` request uses the calling user's own GitHub login and Internal Users connect their account under LLM Credentials, Your connections - [PR #45241](https://github.com/BerriAI/litellm/pull/45241)
- Sync the GitHub Copilot model catalog with the models Copilot serves, removing 11 retired ids that returned `model_not_supported` and adding 22 current ones - [PR #45386](https://github.com/BerriAI/litellm/pull/45386)
- Add `github_copilot/claude-haiku-5.5` to the cost map - [PR #45656](https://github.com/BerriAI/litellm/pull/45656)
- Add `github_copilot/gemini-4-argon` to the model catalog at Copilot list pricing - [PR #46280](https://github.com/BerriAI/litellm/pull/46280)
- Add 2026-11-16 deprecation dates to `github_copilot/claude-opus-5` and `github_copilot/gpt-5.6-terra` - [PR #46792](https://github.com/BerriAI/litellm/pull/46792)

### Meta

- Add `meta/muse-wonder-1.0` with Meta's pricing and support for `max` and `xhigh` reasoning effort - [PR #46072](https://github.com/BerriAI/litellm/pull/46072)

### MiniMax

- Add MiniMax-H3 and H3-Max video generation on `/v1/videos`, with per-second prices per resolution and billing for input images past the free allowance - [PR #43705](https://github.com/BerriAI/litellm/pull/43705)

### OCI

- Drop `reasoning_effort` on OCI Grok 4.20 and non-function tools on every OCI model under `drop_params`, so Codex and Claude Code no longer fail every turn with a 400 - [PR #40732](https://github.com/BerriAI/litellm/pull/40732)

### Ollama

- Give Ollama OpenAI-compatible responses a unique `chatcmpl-` id instead of Ollama's reused one, which silently dropped successful requests from spend logs, and keep the original in `provider_specific_fields.original_response_id` - [PR #39227](https://github.com/BerriAI/litellm/pull/39227)

### OpenAI

- Add `gpt-rosalind-discovery` to the cost map with the prices on OpenAI's pricing page - [PR #45653](https://github.com/BerriAI/litellm/pull/45653)

### SageMaker

- Send `model_id` on SageMaker embedding deployments as `InferenceComponentName`, and add a `sagemaker/openai/<endpoint>` route that sends an OpenAI `input` body and parses `data[].embedding` responses - [PR #44985](https://github.com/BerriAI/litellm/pull/44985)
- Stop sending the deployment's AWS credentials in the `sagemaker_chat` request body, while the request is still signed with them - [PR #45724](https://github.com/BerriAI/litellm/pull/45724)

### SCX.ai

- Add `scx-ai/DeepSeek-V4.1-flash`, `scx-ai/GLM-5.3` and `scx-ai/Kimi-K3` to the model catalog with SCX.ai's published prices, so their spend is no longer logged at $0 - [PR #46496](https://github.com/BerriAI/litellm/pull/46496)

### Soniox

- Decode Soniox `context`, `translation` and flag form fields sent through `/v1/audio/transcriptions` into typed values, and fill `language_hints` from OpenAI `language` when none are set - [PR #40605](https://github.com/BerriAI/litellm/pull/40605)

### Together AI

- Restore `together_ai/moonshotai/Kimi-K3` to Together's standard serverless price now that the launch promotion has ended - [PR #46226](https://github.com/BerriAI/litellm/pull/46226)
- Set `together_ai/Qwen/Qwen3.7-Max` to its published price and restore the 2026-09-15 removal dates on the affected Together models - [PR #46281](https://github.com/BerriAI/litellm/pull/46281)
- Add `together_ai/nvidia/NVIDIA-Nemotron-3.5-Super-VL` to the model catalog with Together's published prices - [PR #46693](https://github.com/BerriAI/litellm/pull/46693)

### Weights and Biases

- Add `wandb/nvidia/NVIDIA-Nemotron-3.5-Super-VL-120B-A12B` to the model catalog - [PR #46795](https://github.com/BerriAI/litellm/pull/46795)

### xAI

- Add `xai/grok-voice-3.0`, `xai/grok-voice-2.0` and `xai/grok-voice-latest` realtime rows priced per second - [PR #46602](https://github.com/BerriAI/litellm/pull/46602)

### Model catalog and pricing

- Register text pricing for five ScaleDown models at 0.05 USD per million input tokens with free output, so cost calculation no longer reports them as unmapped - [PR #44167](https://github.com/BerriAI/litellm/pull/44167)
- Add a 2026-10-23 `deprecation_date` to `gemini/deep-research-pro-preview-12-2025` and drop the withdrawn shutdown date from `gemini/gemini-3.1-flash-image`, matching Google's changelog - [PR #45491](https://github.com/BerriAI/litellm/pull/45491)
- Raise `together_ai/Qwen/Qwen3.7-Max` to Together's current 2.50 USD input and 7.50 USD output per 1M tokens, which was underbilled by 40%, and correct the `azure_ai/kimi-k2.7-code` `deprecation_date` - [PR #45595](https://github.com/BerriAI/litellm/pull/45595)
- Add the Perplexity Agent API models and set `claude-sonnet-4-5` to a 200,000 token context, since Anthropic retired its 1M context beta for that model - [PR #45647](https://github.com/BerriAI/litellm/pull/45647)
- Add a 2026-10-22 `deprecation_date` to `together_ai/meta-llama/Llama-3.3-70B-Instruct-Turbo` and `together_ai/deepseek-ai/DeepSeek-V4-Flash-0731` - [PR #45657](https://github.com/BerriAI/litellm/pull/45657)
- Remove the first 105 `openrouter` rows from the model cost map, part 1 of 5, since OpenRouter bills from its own `usage.cost` - [PR #45665](https://github.com/BerriAI/litellm/pull/45665)
- Remove 29 more `openrouter` rows from the model cost map, part 2 of 5 - [PR #45666](https://github.com/BerriAI/litellm/pull/45666)
- Remove 139 more `openrouter` rows from the model cost map, part 3 of 5, and drop the `*_above_32k_tokens`, `*_above_128k_tokens` and `*_above_256k_tokens` fields only they used - [PR #45667](https://github.com/BerriAI/litellm/pull/45667)
- Remove 202 more `openrouter` rows from the model cost map, part 4 of 5, including the `openrouter/openai/gpt-image-*` rows - [PR #45668](https://github.com/BerriAI/litellm/pull/45668)
- Remove the last 21 `openrouter` rows from the model cost map, part 5 of 5, so no `openrouter` row remains - [PR #45669](https://github.com/BerriAI/litellm/pull/45669)
- Correct six Bedrock Titan Text and Nova 2 Lite prices to the AWS Price List, add `amazon.nova-premier-v1:0` and clear two rescinded Together retirement dates - [PR #45793](https://github.com/BerriAI/litellm/pull/45793)
- Add six OpenAI dated snapshots with a 2026-07-23 `deprecation_date`, price both Perplexity decider models at 0.02 USD per 1M input tokens and drop a stale cached price from a Together model - [PR #45842](https://github.com/BerriAI/litellm/pull/45842)
- Fix `tencent/deepseek-v4-pro` TokenHub pricing, add ten TokenHub DeepSeek, GLM and Kimi models, correct Fireworks context windows and Bedrock Claude 3.5 Sonnet limits, and update four Together removal dates - [PR #46206](https://github.com/BerriAI/litellm/pull/46206)
- Add 2027-01-14 shutdown dates to five OpenAI GPT-4o and GPT-4.1 snapshots, move Azure `gpt-chat-latest` to 2027-05-18, bill the per text input charge on xAI voice models and refresh Sail DeepSeek V4.1 Flash prices - [PR #46675](https://github.com/BerriAI/litellm/pull/46675)
- Add 16 missing priced OpenAI, Together, Fireworks and Bedrock models to the model catalog, so their spend is no longer unmapped - [PR #46742](https://github.com/BerriAI/litellm/pull/46742)

## LLM API Endpoints

### Responses API

- Keep the provider's request id header on mid-stream errors from `/v1/responses` and Bedrock event streams, so the failed log row carries `error_provider_request_id` - [PR #45453](https://github.com/BerriAI/litellm/pull/45453)
- Map structured OpenAI `cyber_policy` errors, including streamed error events, to `ContentPolicyViolationError` so configured content-policy fallbacks run - [PR #45828](https://github.com/BerriAI/litellm/pull/45828)
- Translate OpenAI's `tool_search` tool to Anthropic's regex tool search for Claude models on `/v1/responses`, and return Claude's searches as `tool_search_call` items, streaming included - [PR #45882](https://github.com/BerriAI/litellm/pull/45882)
- Keep the provider's `code` and `message` from top-level stream `error` events instead of reporting `Response API in-stream error` - [PR #46438](https://github.com/BerriAI/litellm/pull/46438)
- Map Anthropic's bm25 and regex tool search tools to OpenAI's server `tool_search` on OpenAI Responses requests, so a Claude to OpenAI fallback no longer answers 400 - [PR #46441](https://github.com/BerriAI/litellm/pull/46441)
- Open faked Responses stream items empty so text and tool arguments arrive once, which stops streamed `/v1/messages` tool calls from getting doubled JSON input - [PR #46533](https://github.com/BerriAI/litellm/pull/46533)
- Use a deployment's own provider and `api_key` for `/v1/responses` over WebSocket, like HTTP, instead of falling back to the global OpenAI key - [PR #46724](https://github.com/BerriAI/litellm/pull/46724)
- Write one spend log row per `response.create` turn on a native Responses WebSocket, keyed by the `resp_` id, instead of one summed row at socket close - [PR #46768](https://github.com/BerriAI/litellm/pull/46768)

### Chat Completions over the Responses API bridge

- Return every message, reasoning item and tool call of a bridged reply on `choices[0]`, so clients that only read the first choice run the tool - [PR #46099](https://github.com/BerriAI/litellm/pull/46099)
- Number bridged chat tool calls 0, 1 and so on instead of 0 for every call, matching native chat - [PR #46109](https://github.com/BerriAI/litellm/pull/46109)
- Keep `defer_loading` on function tools sent to the Responses API and route requests with a `tool_search` tool to Responses on OpenAI and Azure, so GPT-5.5 tool search stops answering 400 - [PR #46439](https://github.com/BerriAI/litellm/pull/46439)
- Round-trip `tool_search_call` and `tool_search_output` items between bridged chat turns through `provider_specific_fields.tool_search_items`, so GPT-5.5 keeps each search and its `namespace` - [PR #46444](https://github.com/BerriAI/litellm/pull/46444)
- Return only the first message item as `content` for `json_schema` and `json_object` requests, so structured output no longer comes back as two JSON documents glued together - [PR #46508](https://github.com/BerriAI/litellm/pull/46508)

### Anthropic Messages API

- Stop writing extra keys such as `input_examples` into the caller's own tool `input_schema` while translating Anthropic tools, so strict tools no longer get a 400 under a guardrail and a later fallback to Claude keeps every field - [PR #34653](https://github.com/BerriAI/litellm/pull/34653)
- Keep `thinking` blocks with empty text and a valid `signature` on `/v1/messages` requests, so replayed turns on Claude models that omit thinking text no longer lose their reasoning - [PR #41362](https://github.com/BerriAI/litellm/pull/41362)
- Add `general_settings.safeguards_classifier_model`, which judges each tool call on non-Claude `/v1/messages` routes and returns Anthropic-shaped `safeguard_results`, so Claude Code auto mode keeps its server-side check - [PR #45600](https://github.com/BerriAI/litellm/pull/45600)
- Forward `service_tier` on `/v1/messages` to Anthropic, Azure AI and Bedrock Mantle, so a `standard_only` request no longer lands on Priority Tier capacity - [PR #46370](https://github.com/BerriAI/litellm/pull/46370)
- Emit one `tool_use` block per call when a `/v1/messages` stream chunk carries several tool calls, so parallel tool calls from Mistral models no longer merge into invalid JSON - [PR #46492](https://github.com/BerriAI/litellm/pull/46492)
- Send `detail: auto` on `input_image` parts bridged from `/v1/messages` to Responses and in the Admin UI playground, so image requests to vLLM-backed `openai/` models stop returning 400 - [PR #46720](https://github.com/BerriAI/litellm/pull/46720)
- Honor `litellm_settings.request_timeout` and `REQUEST_TIMEOUT` on native Messages calls instead of timing out long turns after 600 seconds - [PR #46749](https://github.com/BerriAI/litellm/pull/46749)

### Count tokens

- Return the provider's own status and message when its token counting call fails on `/v1/messages/count_tokens`, `/v1/responses/input_tokens` and the Gemini `countTokens` route, instead of a 200 with a local tiktoken estimate - [PR #46121](https://github.com/BerriAI/litellm/pull/46121)
- Count system prompts and tools on Vertex Gemini and Google AI Studio, honor the deployment's `api_base`, and fall back to Mantle when a Bedrock Claude count gets a runtime 404 - [PR #46430](https://github.com/BerriAI/litellm/pull/46430)
- Count `/v1/messages/count_tokens` requests for OpenAI models the way `/v1/messages` converts them, so PDFs, images, tool blocks and list-form `system` prompts are included - [PR #46759](https://github.com/BerriAI/litellm/pull/46759)
- Count `/v1/messages/count_tokens` requests for Gemini models the way `/v1/messages` converts them, so PDFs, images and tool turns are included and AI Studio Gemini returns a count instead of a 500 - [PR #46767](https://github.com/BerriAI/litellm/pull/46767)
- Return a 400 naming the Anthropic blocks that `/v1/messages/count_tokens` can't convert for OpenAI and Gemini models, instead of a low count with a 200 - [PR #46772](https://github.com/BerriAI/litellm/pull/46772)
- Return a 401 naming the missing provider key from the count endpoints instead of a local estimate, with errors in Anthropic's envelope on `/v1/messages/count_tokens` and Google's on `:countTokens` - [PR #46815](https://github.com/BerriAI/litellm/pull/46815)
- Add `token_count_model` and `token_count_framing` settings and report `litellm_count_source` and `litellm_count_model` on count responses, so Bedrock Claude Sonnet 5.5 and Kimi K3 counts work, and answer 400 for malformed `tools` instead of 500 - [PR #47209](https://github.com/BerriAI/litellm/pull/47209)

### Prompt caching

- Carry `cache_control` on `/v1/responses` message, `function_call` and `function_call_output` items onto the bridged chat messages, so Claude on Bedrock, Vertex AI and Azure AI gets cache hits - [PR #32511](https://github.com/BerriAI/litellm/pull/32511)
- Keep a deployment's configured prompt cache breakpoint when chat completions and `/v1/messages` are bridged to Responses for Bedrock Mantle GPT-5.6, so explicit cache writes happen again - [PR #45500](https://github.com/BerriAI/litellm/pull/45500)
- Rewrite `cache_control` marks to `prompt_cache_breakpoint` on the `/v1/messages` to Responses bridge for OpenAI gpt-5.6 and newer, and keep the system prompt as a developer message so its mark survives - [PR #46082](https://github.com/BerriAI/litellm/pull/46082)
- Keep the prompt caching affinity pin for 3600 seconds when the cacheable prefix has a `"ttl": "1h"` breakpoint, instead of a fixed 300 seconds, so the prefix stays on the deployment that holds its cache - [PR #46084](https://github.com/BerriAI/litellm/pull/46084)
- Rewrite `cache_control` marks to `prompt_cache_breakpoint` on `/v1/chat/completions` for OpenAI gpt-5.6 and newer, instead of stripping them - [PR #46101](https://github.com/BerriAI/litellm/pull/46101)
- Rewrite `cache_control` marks to `prompt_cache_breakpoint` on native `/v1/responses` for OpenAI gpt-5.6 and newer, instead of stripping them - [PR #46105](https://github.com/BerriAI/litellm/pull/46105)
- Cache screenshots inside `tool_result` blocks on the `/v1/messages` to Responses bridge, and honor `cache_control` on blocks inside a tool result - [PR #46324](https://github.com/BerriAI/litellm/pull/46324)
- Strip `prompt_cache_breakpoint` from messages, content parts, tool calls and tools under `drop_params` for OpenAI models that cannot read it - [PR #46453](https://github.com/BerriAI/litellm/pull/46453)
- Keep the 1 hour routing pin on a response cache hit for a Bedrock application inference profile, matching the base model's 1h cache TTL instead of 5 minutes - [PR #47174](https://github.com/BerriAI/litellm/pull/47174)

### Realtime

- Proxy OpenAI Live sessions on `/v1/live/sessions`, `/live/sessions` and `/openai/v1/live/sessions`, with the same key auth, model access checks, routing, budgets and spend logging as Realtime, and Live voice billed from `usage.seconds` - [PR #43621](https://github.com/BerriAI/litellm/pull/43621)
- Send `response.create` after a transcript only when a transcript guardrail turned off the auto-response, so clients with `create_response: false` stop getting a response they never asked for - [PR #43791](https://github.com/BerriAI/litellm/pull/43791)
- Forward Nova Sonic tool calls with their arguments over `/v1/realtime`, accept flat and nested tool shapes, and return an error for a `session.update` Bedrock cannot apply instead of ending the session - [PR #46214](https://github.com/BerriAI/litellm/pull/46214)

### Batches and files

- Return a 400 that names the line number when a Vertex AI batch upload has a malformed JSONL row, instead of a 500 pointing at the wrong line - [PR #40097](https://github.com/BerriAI/litellm/pull/40097)
- Add opt-in `batch_line_item_callbacks` (`s3_v2`, `gcs_bucket`) that writes each batch line's request, response, tokens, cost and creator to the bucket after a managed batch is billed - [PR #41691](https://github.com/BerriAI/litellm/pull/41691)
- Parse Vertex AI batch and file timestamps as UTC, so `created_at` is no longer shifted by the host timezone and a whole-second `createTime` no longer fails batch create and retrieve with a 500 - [PR #45550](https://github.com/BerriAI/litellm/pull/45550)
- Read a completed xAI batch id as a file from the batch itself instead of xAI's files API, which always answered 404, so the results file is named at once and its size fills in from the batch cost job - [PR #45559](https://github.com/BerriAI/litellm/pull/45559)
- Check input file ownership when creating batches and fine-tuning jobs from managed files, returning 404 for a missing file and 403 for another owner's file, and keep a regenerated key's own files with it - [PR #45855](https://github.com/BerriAI/litellm/pull/45855)

### Vector Stores

- Give each default-constructed vector store registry its own list, so a fresh `VectorStoreRegistry()` no longer inherits stores registered on an earlier one - [PR #38879](https://github.com/BerriAI/litellm/pull/38879)
- Send the provider exactly the caller's `metadata` when creating or updating vector stores through the proxy, so stores stop filling OpenAI's 16 metadata slots and later updates no longer fail with 400 - [PR #47159](https://github.com/BerriAI/litellm/pull/47159)

### Pass-through endpoints

- Let configured pass-through endpoints take priority over a built-in `/<prefix>/{param:path}` provider route with the same prefix, and remove an endpoint's route when it is deleted or dropped from config - [PR #44133](https://github.com/BerriAI/litellm/pull/44133)
- Classify streamed `/v1/messages` pass-through calls as Anthropic on any host, so a custom `ANTHROPIC_API_BASE` gateway logs real tokens, cost and the provider message id instead of zero spend - [PR #45602](https://github.com/BerriAI/litellm/pull/45602)
- Return AWS-shaped errors on the Bedrock passthrough, so AWS SDKs read the error code and message of a guardrail block or a Bedrock failure instead of an empty `ClientError` - [PR #46522](https://github.com/BerriAI/litellm/pull/46522)

### Agents and Agent-to-Agent

- Add opt-in `general_settings.agent_access_default_deny` so a key with no agent grants on itself or its team can reach no agents - [PR #43979](https://github.com/BerriAI/litellm/pull/43979)
- Add a per-agent `litellm_params.a2a_protocol_version` (`0.3` or `1.0`) that overrides the agent card's declared version, so LangGraph agents on langgraph-api 0.15 stop failing with `has no field named "kind"` - [PR #44463](https://github.com/BerriAI/litellm/pull/44463)
- Add the `databricks_agent` provider so Databricks Agent Platform agents (Model Serving endpoints, the unified responses URL and Databricks Apps) work in the agent gateway with PAT or OAuth M2M auth, plus a Databricks Agent card in the Admin UI - [PR #45681](https://github.com/BerriAI/litellm/pull/45681)

### SDK

- Keep the provider's response headers on streaming SDK errors, so a streamed Gemini 429 exposes them on `litellm_response_headers` like a non-streaming call - [PR #41528](https://github.com/BerriAI/litellm/pull/41528)
- Stop prompt-based tool calling from editing the caller's messages, so a list-content system message no longer gains another copy of the tool list every turn - [PR #41676](https://github.com/BerriAI/litellm/pull/41676)
- Resolve `litellm.proxy` lazily on attribute access, so `litellm.proxy._types` works without `import litellm` loading proxy modules - [Commit 691ca03](https://github.com/BerriAI/litellm/commit/691ca03266539c7278c88a4d10eb161fc7e68e2b)
- Add `CustomStreamWrapper.close()` and release the upstream connection when a sync stream ends or fails, so Anthropic and other sync streams stop pinning pooled connections - [PR #46354](https://github.com/BerriAI/litellm/pull/46354)

### General

- Honor an explicit `custom_llm_provider` and `api_base` on async image generation, speech, transcription and every realtime route, so bare custom model names no longer fail with `LLM Provider NOT provided` - [PR #36346](https://github.com/BerriAI/litellm/pull/36346)
- Show the target model's metadata for a listed team or key alias on `GET /v1/models`, and stop returning 404 for aliases, including router `model_group_alias` names, on `GET /v1/models/{model_id}` - [PR #41041](https://github.com/BerriAI/litellm/pull/41041)
- Strip trailing slashes from `api_base` before adding the route for Perplexity, Jina, Tavily and other providers, so URLs no longer get a `//` that answers 404 or 403 - [PR #42887](https://github.com/BerriAI/litellm/pull/42887)
- Pass `refusal`, `logprobs` and `system_fingerprint` from the provider response through on `/v1/chat/completions`, including explicit nulls, instead of moving `refusal` into `provider_specific_fields` - [PR #44788](https://github.com/BerriAI/litellm/pull/44788)
- Keep the mapped status and message when a provider error hits the assistants and threads routes, so a provider 404 returns 404 instead of a blank 500, with file paths and secrets scrubbed from the body - [PR #44994](https://github.com/BerriAI/litellm/pull/44994)
- Drop `stream_options` from the forced non-streaming call in web search, code interpreter and headroom interception and replay it on the final stream, so streamed requests no longer fail with 400 on Azure - [PR #45433](https://github.com/BerriAI/litellm/pull/45433)
- Return provider-matching 400s instead of 500s or a silently changed 200 for OCR requests with no `file`, reversed daily activity date ranges, `max_output_tokens` of 0 on `/v1/responses`, and more than 16 vector store file attributes - [PR #45537](https://github.com/BerriAI/litellm/pull/45537)
- Keep request fields and headers that a pre-call hook deletes off the provider request on native chat, Responses, Messages and OCR routes - [PR #45692](https://github.com/BerriAI/litellm/pull/45692)
- Add an `index` to streamed `thinking_blocks` from Anthropic, Bedrock Converse and Databricks, so the OpenAI SDK `client.chat.completions.stream()` helper no longer crashes on reasoning output - [PR #46611](https://github.com/BerriAI/litellm/pull/46611)
- Intercept OpenAI's bare `{"type": "web_search"}` tool on chat completions, so Claude models no longer answer 500 and OpenAI models no longer answer 400 - [PR #46736](https://github.com/BerriAI/litellm/pull/46736)

## Management Endpoints / UI

### Admin UI

#### Auto-Routers

- Group classifier, tier and advanced settings in auto-router setup, and let a new decision router pick an onboarded decision model instead of entering a provider and raw model name - [PR #45913](https://github.com/BerriAI/litellm/pull/45913)

#### General

- Add a Settings, Telemetry page with a switch per telemetry group and a destination picker, and record page views and tab clicks only when that group is on - [PR #45494](https://github.com/BerriAI/litellm/pull/45494)
- Restore the background blur behind dashboard modals - [PR #45866](https://github.com/BerriAI/litellm/pull/45866)
- Drop the beta marker from the dark mode toggle - [PR #46305](https://github.com/BerriAI/litellm/pull/46305)
- Remove the deprecation banner from Memory, Prompts, Agent Builder and MCP Network Settings, and make it permanent on Workflows, the old Usage page and the API Reference tab - [PR #46314](https://github.com/BerriAI/litellm/pull/46314)
- Move the new version notice from a banner into the notifications bell, which now lists announcements with a read state per item - [PR #46334](https://github.com/BerriAI/litellm/pull/46334)
- Replace the stacked deployment warning banners with a header health icon, one alert banner and a side panel where proxy admins snooze, ignore or restore each warning - [PR #46498](https://github.com/BerriAI/litellm/pull/46498)
- Add a Cost per Query (USD) field to the search tool add and edit forms, and keep a stored price when a tool is edited - [PR #46723](https://github.com/BerriAI/litellm/pull/46723)
- Read the signed-in user's role from the new `GET /management/v1/users/me` instead of the session cookie, and sign out when it cannot be loaded - [PR #47224](https://github.com/BerriAI/litellm/pull/47224)

#### Home and LiteAdmin

- Let LiteAdmin detach a key from its team through a confirmation-gated tool, and preselect an accessible Sonnet 5.5 model in new chats - [PR #45625](https://github.com/BerriAI/litellm/pull/45625)
- Add a LiteAdmin composer to Home and independent LiteAdmin chat tabs, so New chat opens a tab instead of clearing the current conversation - [PR #46068](https://github.com/BerriAI/litellm/pull/46068)
- Simplify LiteAdmin on Home to a standalone heading and one composer with editable suggestions, and place the virtual key action beside the Home title - [PR #46301](https://github.com/BerriAI/litellm/pull/46301)
- Widen the LiteAdmin model selector on Home so longer model names fit - [PR #46446](https://github.com/BerriAI/litellm/pull/46446)
- Place the Home Create New Virtual Key button under the title in the default style, like the Virtual Keys page - [PR #46778](https://github.com/BerriAI/litellm/pull/46778)

#### Logs

- Skip failure rows for expired Admin UI session keys on dashboard info routes such as `/key/list` and `/team/list`, so a stale tab no longer floods Request Logs with 401 rows - [PR #45881](https://github.com/BerriAI/litellm/pull/45881)

#### Models + Endpoints

- Fix Add Model showing an empty model field for 14 providers, including MiniMax, Cursor and SageMaker, by resolving the provider key to the slug the backend declares - [PR #43707](https://github.com/BerriAI/litellm/pull/43707)
- Add a Status filter with All, Active and Paused options to Models and Endpoints - [PR #43710](https://github.com/BerriAI/litellm/pull/43710)
- Show the public JWKS of a LiteLLM-signed Anthropic credential in its edit modal with a Copy JWKS button - [PR #45527](https://github.com/BerriAI/litellm/pull/45527)
- Show the Microsoft 365 Copilot logo instead of the Azure one for Microsoft 365 Copilot models - [PR #45687](https://github.com/BerriAI/litellm/pull/45687)
- Fix credential edits saving onto a different credential, merge `PATCH /credentials` onto the writer's row, refuse `POST /credentials` for a name defined in `config.yaml` with 409, and show each credential's name and source in the Admin UI - [PR #45835](https://github.com/BerriAI/litellm/pull/45835)
- Disable the add, edit and delete controls for model group aliases that `config.yaml` owns, with a read-only notice on the alias tab - [PR #45857](https://github.com/BerriAI/litellm/pull/45857)
- Gray out the router settings and fallbacks that `config.yaml` owns, with a badge and tooltip, and skip them on save - [PR #45861](https://github.com/BerriAI/litellm/pull/45861)
- Run the Add Model validation when Test Connect is clicked so an incomplete form shows inline errors instead of crashing with `t[0] is undefined`, and clear provider inputs after a successful add - [PR #46834](https://github.com/BerriAI/litellm/pull/46834)

#### Playground and Decisions

- Show cost-map decision models as decisions in the public Model Hub and list the supported ones in the AI Hub, with docs links and a prefilled Add Model form - [PR #45965](https://github.com/BerriAI/litellm/pull/45965)
- Give the Decisions playground a labeled setup card, one editor card with Form and cURL tabs, and an always visible Response card - [PR #45981](https://github.com/BerriAI/litellm/pull/45981)
- Show the legacy `evaluation` mode as `decisions` in the Model Hub mode filter, Mode column and guardrail decision-model picker - [PR #46098](https://github.com/BerriAI/litellm/pull/46098)
- Label Decisions playground issues by question key instead of an index, and fix the alignment of the Response card header - [PR #46145](https://github.com/BerriAI/litellm/pull/46145)

#### Teams, users and access groups

- Page the team and organization members tables at 25 rows and look up budget rows from a map built once per team, so teams with thousands of members open quickly - [PR #26667](https://github.com/BerriAI/litellm/pull/26667)
- Show `$X of $Y (team member)` on keys that have no budget of their own in the Virtual Keys table, the team Virtual Keys tab and the key detail page, instead of Unlimited - [PR #43927](https://github.com/BerriAI/litellm/pull/43927)
- Rename the key edit `Team ID` field to `Team`, list teams by alias, and add a clear button that detaches a key from its team - [PR #45629](https://github.com/BerriAI/litellm/pull/45629)
- Accept email addresses containing `#` in the member forms, so budget and rate limit edits work for Entra ID guests - [PR #45688](https://github.com/BerriAI/litellm/pull/45688)

#### Usage

- Add `GET /user/daily/activity/aggregated/users`, a Top Users by Spend panel on the Usage Overview and a User Activity tab, so JWT-authenticated users show up in usage - [PR #45310](https://github.com/BerriAI/litellm/pull/45310)
- Add an admin-only Errors tab to Usage with error rate over time, failed requests by status code, and failures by key, team, user and model - [PR #45396](https://github.com/BerriAI/litellm/pull/45396)
- Title the Usage Overview chart `Daily usage` (or `Weekly usage`) and label the ranked model list `Top models` - [PR #45604](https://github.com/BerriAI/litellm/pull/45604)

### Keys, teams and authentication

- List team access group models on `/v1/model/info`, and keep keys with their own model list from seeing team models they cannot call on the listing routes and `GET /v1/models/{model_id}` - [PR #32599](https://github.com/BerriAI/litellm/pull/32599)
- Return a plain `Invalid API key provided.` 401 for an unknown key, without the key table name or the hash of the submitted key - [PR #39787](https://github.com/BerriAI/litellm/pull/39787)
- Name the rejected control characters and `..` path segments in the 400 returned for an invalid `key_alias` - [PR #41412](https://github.com/BerriAI/litellm/pull/41412)
- Return HTTP 200 with the blocked end users from `POST /customer/block` instead of a 500 after the block was already saved - [PR #41677](https://github.com/BerriAI/litellm/pull/41677)
- Add opt-in `personal_key_model_access_from_teams` so personal keys can call, and list on `/v1/models`, the union of models from their owner's current teams, checked on every request - [PR #43692](https://github.com/BerriAI/litellm/pull/43692)
- Expand the `all-team-models` value in project model access checks, so keys in a project set to All Team Models stop getting 403 `project_model_access_denied` - [PR #43734](https://github.com/BerriAI/litellm/pull/43734)
- Check project ownership when generating, updating, regenerating and bulk updating keys, and refuse moving a project to another team while other teams' keys are attached - [PR #44165](https://github.com/BerriAI/litellm/pull/44165)
- Add a proxy-admin team setting `require_trace_id` that rejects LLM, MCP and A2A requests from the team with HTTP 400 when they carry no trace ID, with a switch on the team pages - [PR #44933](https://github.com/BerriAI/litellm/pull/44933)
- Add a `raise_max_budget` team admin editable field, off by default, that lets team admins raise their team's `max_budget` up to the organization's cap - [PR #45404](https://github.com/BerriAI/litellm/pull/45404)
- Add opt-in `create_member_keys` under team admin editable fields so team admins can create LLM API keys for internal user and viewer teammates through `/key/generate` and the Create Key form - [PR #45870](https://github.com/BerriAI/litellm/pull/45870)
- Enforce `enforce_fallback_model_access` by default, so configured and request-body fallbacks to models outside the caller's allowed models are skipped and the primary model's error is returned - [PR #46127](https://github.com/BerriAI/litellm/pull/46127)
- Add four opt-in Team admin editable fields for the member default budget, budget duration, TPM limit and RPM limit, so team admins can manage them from the team Settings tab - [PR #46353](https://github.com/BerriAI/litellm/pull/46353)
- Add an opt-in `soft_budget` entry under Team admin editable fields, so team admins can set their team's soft budget from the team Settings tab - [PR #46485](https://github.com/BerriAI/litellm/pull/46485)
- Evict and broadcast the cached user on every `/user/update` and `/user/bulk_update`, so a models-only or role-only change takes effect on every proxy right away instead of after the cache entry expires - [PR #46500](https://github.com/BerriAI/litellm/pull/46500)
- Add an opt-in `metadata` entry under Team admin editable fields so team admins can edit their team's metadata, while proxy-controlled metadata keys stay with proxy admins - [PR #46506](https://github.com/BerriAI/litellm/pull/46506)
- Honor `end_user_id_jwt_field` when a JWT maps to a virtual key, so spend rows, customer budgets and limits use the verified end-user claim over a body `user` or the `x-litellm-end-user-id` header - [PR #46637](https://github.com/BerriAI/litellm/pull/46637)
- Give `/team/delete` transactions a 30 second timeout, land concurrent first SSO sign-ins on one account instead of a 500, stop an intermittent 500 in the spend metadata merge, and keep key settings drafts when the form refreshes - [PR #47043](https://github.com/BerriAI/litellm/pull/47043)

### SSO and SCIM

- Refuse an SSO sign-in that resolves no user id with HTTP 401, and fail a Microsoft sign-in when Graph returns an error instead of a profile, so a blank account session is never created - [PR #44098](https://github.com/BerriAI/litellm/pull/44098)
- Write a SCIM group's whole roster in one locked transaction, so `POST`, `PUT` and `PATCH` on `/scim/v2/Groups` with hundreds of members no longer time out at the load balancer - [PR #45197](https://github.com/BerriAI/litellm/pull/45197)
- Store the SSO exchange token with the same helper as password login, so the UI session cookie keeps its `Secure` flag on https deployments - [PR #45840](https://github.com/BerriAI/litellm/pull/45840)
- Fall back to the `id_token` claims when the generic SSO userinfo response is not JSON, and return a 401 `auth_error` naming the userinfo endpoint instead of a 500 when no usable `id_token` exists - [PR #46187](https://github.com/BerriAI/litellm/pull/46187)
- Resolve SCIM group member identities with one chunked query per push instead of one query per member, cutting an 851-member no-change `PUT` from about 11s on a 20k-user table - [PR #46412](https://github.com/BerriAI/litellm/pull/46412)
- Route SSO token exchange and userinfo calls for the generic, Google and Microsoft providers through LiteLLM's httpx client, so non-PKCE logins honor `ssl_verify` and `SSL_VERIFY` and IdP connection failures return a 401 naming the endpoint - [PR #46547](https://github.com/BerriAI/litellm/pull/46547)
- Share SAML sign-in state over Redis whenever Redis is configured, without `enable_redis_auth_cache`, so a callback that lands on another replica or worker no longer returns 401 - [PR #46807](https://github.com/BerriAI/litellm/pull/46807)

### Model management

- Name the replacement for a deprecating deployment with `model_info.successor_model`, shown in `GET /v1/model/deprecations` and in the daily Slack deprecation alert - [PR #41670](https://github.com/BerriAI/litellm/pull/41670)
- Drop model capability flags such as `supports_max_reasoning_effort` from a deployment's `litellm_params` before calling the provider, and warn at load to move them to `model_info` - [PR #46647](https://github.com/BerriAI/litellm/pull/46647)

### Usage and analytics

- Record failed requests by HTTP status and by key, team, user and model group, and serve them from the admin-only `GET /gateway/errors/activity`, with `by_status_code` added to `GET /gateway/daily/activity` - [PR #45244](https://github.com/BerriAI/litellm/pull/45244)
- Scope `/global/activity/cache_hits` to the caller's own and permitted-team logs for non-admin callers, including its key alias and model filter options - [PR #46210](https://github.com/BerriAI/litellm/pull/46210)

### Proxy configuration

- Refuse `POST /fallback` and `DELETE /fallback/{model}` with a 400 when `router_settings.fallbacks` is set in `config.yaml`, matching `/config/update` - [PR #45860](https://github.com/BerriAI/litellm/pull/45860)
- Treat blank numeric environment variables as unset so the proxy no longer crash-loops at boot, and resolve blank guardrail `litellm_params` env values to the field default instead of silently dropping the guardrail - [PR #46341](https://github.com/BerriAI/litellm/pull/46341)
- Store list-valued audit log changes as JSON text, so changes that carry a list, such as ignoring or snoozing a deployment warning, are written to the audit log instead of failing - [PR #46555](https://github.com/BerriAI/litellm/pull/46555)
- Keep JSON nulls as null in audit log values instead of storing the string `None`, so a cleared budget reads as an empty value while keys stay masked - [PR #46577](https://github.com/BerriAI/litellm/pull/46577)
- Revert the `LITELLM_FIPS_MODE` startup gate and its loud password migration failure, because its FIPS probe misreports real enforcing runtimes - [PR #46740](https://github.com/BerriAI/litellm/pull/46740)

### CLI and coding agents

- Add an `installation_preference` field (`available`, `auto_install` or `required`) to Claude Code marketplace plugins and emit it as `installationPreference` in `marketplace.json`, so Claude Desktop can install archive plugins automatically - [PR #41430](https://github.com/BerriAI/litellm/pull/41430)
- Grant private Claude Code skills through access groups with `access_skill_names`, so a group's teams and keys see them on `/claude-code/plugins`, and show group-granted skills as inherited on the team Skills card - [PR #46294](https://github.com/BerriAI/litellm/pull/46294)
- Run group subcommands such as `credentials list` in the `lite` shell under their real name, keep quoted JSON arguments together, and open the bare `lite` shell on the server from `lite login` - [PR #46511](https://github.com/BerriAI/litellm/pull/46511)

### Deployment

- Add `GET /health/deployment_warnings` to list active warnings with severity, and `PATCH /health/deployment_warnings/{warning_id}` to ignore or snooze one for up to 30 days for every admin, with changes written to the audit log - [PR #46347](https://github.com/BerriAI/litellm/pull/46347)
- Chain RDS IAM database auth through the pod's IRSA role when STS refuses the direct web identity exchange for `AWS_ROLE_NAME`, so a database role that only trusts the pod role connects at startup - [PR #46540](https://github.com/BerriAI/litellm/pull/46540)
- Forward `AWS_SESSION_TOKEN` to the STS AssumeRole and direct RDS clients for RDS IAM auth, so the proxy starts with temporary AWS credentials instead of failing with `InvalidClientTokenId` - [PR #46559](https://github.com/BerriAI/litellm/pull/46559)

### Terraform

- Stop sending `blocked` on `litellm_user` updates in the Terraform provider, so changing a user no longer fails with a 400 from `/user/update` - [PR #45410](https://github.com/BerriAI/litellm/pull/45410)
- Add an optional `team_member_model_max_budget` JSON string to `litellm_team`, read back from `/team/info` so out-of-band edits show as drift, and clear the caps when the attribute is removed - [PR #46274](https://github.com/BerriAI/litellm/pull/46274)
- Add opt-in write-only `*_wo` secret attributes with `*_wo_version` companions, such as `credential_values_wo`, to keep secrets out of state, and let `litellm_mcp_server` set `client_id`, `client_secret_wo` and `auth_value_wo` - [PR #46538](https://github.com/BerriAI/litellm/pull/46538)
- Accept any 2xx from the proxy on MCP server, model, key and organization requests, so a `201` or `202` no longer fails `terraform apply` or `terraform destroy` or leaves the resource out of state - [PR #46550](https://github.com/BerriAI/litellm/pull/46550)
- Stop the perpetual plan diff on `litellm_mcp_server` by making `alias` computed, keeping the configured `spec_version` when the proxy returns none, and storing an `mcp_info` with only unmodeled fields as empty - [PR #46781](https://github.com/BerriAI/litellm/pull/46781)
- Send `additional_drop_params` to the proxy as the deployment's drop list instead of deleting the keys it names, and read it back so drift shows in `terraform plan` - [PR #46782](https://github.com/BerriAI/litellm/pull/46782)

## AI Integrations

### Lens and Agent Traces

- Embed the independent Lens UI in the dashboard and delegate authenticated `/lens/*` requests to the standalone Lens service, so Lens deploys and releases on its own - [PR #45529](https://github.com/BerriAI/litellm/pull/45529)
- Load the Lens package stylesheet in the gateway, so embedded Lens shows its layout styles - [PR #45829](https://github.com/BerriAI/litellm/pull/45829)

### Guardrails

- Add a built-in `airia` guardrail that checks prompts before the call and responses after it, blocking or redacting as Airia decides and failing closed on a malformed Gateway reply - [PR #40784](https://github.com/BerriAI/litellm/pull/40784)
- Scan inline PNG and JPEG images and text documents with the Bedrock guardrail, and block requests carrying attachments it cannot scan with a 400 unless `skip_unscannable_attachments: true` is set - [PR #43383](https://github.com/BerriAI/litellm/pull/43383)
- Refresh the HiddenLayer guardrail JWT off the event loop, so a 401 no longer blocks unrelated requests - [PR #45437](https://github.com/BerriAI/litellm/pull/45437)
- Stream detect-only `post_call` policy pipeline steps live when `streaming_buffer_until_moderated` is `false`, still scanning the full answer at the end of the stream - [PR #45516](https://github.com/BerriAI/litellm/pull/45516)
- Guardrail each content block of a streamed Bedrock Converse response on its own, so a masked block no longer corrupts the stream or breaks parallel tool call JSON - [PR #45822](https://github.com/BerriAI/litellm/pull/45822)
- Resolve a decision guardrail's model in the caller's team scope, so a guardrail on a team's own model no longer returns 502 and the call is charged to that team - [PR #46085](https://github.com/BerriAI/litellm/pull/46085)
- Send the request's top-level `user` string to Zscaler AI Guard in the execute-policy body - [PR #46094](https://github.com/BerriAI/litellm/pull/46094)
- Add a `wingback` guardrail that sends chat requests to Wingback for checks - [PR #46136](https://github.com/BerriAI/litellm/pull/46136)
- Add the Airia guardrail card and logo to the Guardrail Garden and the guardrail provider list - [PR #46562](https://github.com/BerriAI/litellm/pull/46562)
- Read the four `streaming_*` keys from the Noma v2 guardrail config for both `noma_v2` and `noma` with `use_v2: true`, so buffering and scan cadence settings take effect - [PR #46606](https://github.com/BerriAI/litellm/pull/46606)
- Record every content filter match in `logging_only` mode as `guardrail_flagged` with risk score 10, keep scanning the response, and offer `logging_only` in the Admin UI mode picker - [PR #46673](https://github.com/BerriAI/litellm/pull/46673)
- Relay Bedrock passthrough `converse-stream` frames while post_call guardrails scan them, and scan Claude `invoke-with-response-stream` output too, ending a blocked stream with an AWS exception the SDK reads - [PR #47157](https://github.com/BerriAI/litellm/pull/47157)
- Send Bedrock Converse messages and tools to guardrails in the chat completions shape and write their masks back into the Converse request, returning a 500 when an edit cannot be written back safely - [PR #47234](https://github.com/BerriAI/litellm/pull/47234)

### Logging and observability

#### Azure Storage

- Upload audit log events to Azure Storage as JSON files under `audit_logs/` when `audit_log_callbacks` includes `azure_storage` - [PR #43838](https://github.com/BerriAI/litellm/pull/43838)

#### Datadog

- Tag Datadog spans with `litellm.user_email` for JWT-authenticated requests, and show `model_info.description` on `/model_group/info` and in the Model Hub table - [PR #42749](https://github.com/BerriAI/litellm/pull/42749)

#### FOCUS and Ternary

- Add a `ternary` callback that exports LiteLLM spend to Ternary as a daily FOCUS CSV, loading polars only on the first export and keeping rows by their own `date` under any Postgres timezone - [PR #46106](https://github.com/BerriAI/litellm/pull/46106)

#### General

- Redact the nested request body and the reasoning in `provider_specific_fields` from callback payloads when message redaction is on - [PR #45923](https://github.com/BerriAI/litellm/pull/45923)
- Accept every known logging callback on `/health/services`, so the Admin UI Test button works for loggers like zerobus instead of returning 400 `Service must be in list`, and return 400 for a known logger that is not configured - [PR #46297](https://github.com/BerriAI/litellm/pull/46297)
- Fail proxy startup with an error naming the logger when a configured logging callback's SDK is missing or outside the supported version range, instead of returning a 500 on the first request - [PR #46378](https://github.com/BerriAI/litellm/pull/46378)

#### Langfuse

- Log token usage for streamed `/v1/responses` calls, and chat calls bridged to the Responses API, in Langfuse instead of showing 0 input and 0 output tokens - [PR #42212](https://github.com/BerriAI/litellm/pull/42212)

#### OpenTelemetry

- Return the W3C `traceresponse` header on sampled responses when `LITELLM_OTEL_V2=1`, naming the trace and the gateway's server span, which carries the response's `litellm.call_id` - [PR #42079](https://github.com/BerriAI/litellm/pull/42079)
- Let a team or key set `callback_vars.capture_message_content` to `no_content` or `span_only` for its own OTel v2 destination, overriding the global setting - [PR #44264](https://github.com/BerriAI/litellm/pull/44264)
- Let a team or key set `callback_vars.excluded_services` to override the global OTel v2 excluded services for its own destination, where `none` excludes nothing - [PR #45880](https://github.com/BerriAI/litellm/pull/45880)

#### Prometheus

- Collect `litellm_redis_circuit_breaker_state` as one series per state across worker processes under `PROMETHEUS_MULTIPROC_DIR`, so recycled Celery or gunicorn workers stop piling up series - [PR #46357](https://github.com/BerriAI/litellm/pull/46357)
- Report the Redis circuit-breaker metrics through the Prometheus services logger, so a Redis cache no longer registers `litellm_redis_circuit_breaker_*` collectors on the default registry without being asked - [PR #46484](https://github.com/BerriAI/litellm/pull/46484)

#### S3

- Bound the S3 object key filename to 255 UTF-8 bytes, keeping the start of the response ID plus a SHA-256, so `s3_v2` logs for long `/v1/responses` IDs upload to filesystem-backed stores and download with `aws s3 cp` - [PR #40825](https://github.com/BerriAI/litellm/pull/40825)
- Bound each `s3_v2` upload attempt with `S3_UPLOAD_ATTEMPT_TIMEOUT_SECONDS` (default 30), add jitter to the backoff and retry 429s and transport errors within the same flush - [PR #46340](https://github.com/BerriAI/litellm/pull/46340)

#### Sentry

- Start Sentry at boot once `SENTRY_DSN` is set and keep request bodies and frame locals out of events unless `SENTRY_SEND_DEFAULT_PII=true`, return `rate_limit_error` on cooldown 429s, and export the Lens row counters to Prometheus - [PR #46344](https://github.com/BerriAI/litellm/pull/46344)

#### Telemetry

- Add opt-in telemetry in `litellm.telemetry` with a fixed allowlist of record fields and consent groups, where a group only counts when all its parent groups are on - [PR #45484](https://github.com/BerriAI/litellm/pull/45484)
- Aggregate telemetry records into fixed-bucket histogram rows and export each window as one JSON report over HTTP, retrying on 429 and 5xx responses - [PR #45487](https://github.com/BerriAI/litellm/pull/45487)
- Record request latency, status and provider attempts for the enabled telemetry groups, flushed every 5 minutes, with `LITELLM_TELEMETRY_DISABLED=true` turning everything off - [PR #45489](https://github.com/BerriAI/litellm/pull/45489)
- Store telemetry reports in the `LiteLLM_TelemetryReport` table when `LITELLM_TELEMETRY_DESTINATION=local_table`, keep one instance ID across restarts and workers, and add `GET /telemetry/reports` for admins to export them - [PR #45490](https://github.com/BerriAI/litellm/pull/45490)

## Spend Tracking, Budgets and Rate Limiting

### Cost tracking

- Bill Responses API `image_generation` tool calls and web search reported only in `tool_usage.web_search.num_requests` as `tool_usage_cost` - [PR #41877](https://github.com/BerriAI/litellm/pull/41877)
- Split one Azure PTU deployment across teams with `model_info.ptu_shares`, enforce each share as a per-team token ceiling, split the flat cost across teams in the daily rollup, and report PTU-hours in team usage - [PR #43043](https://github.com/BerriAI/litellm/pull/43043)
- Accept `<provider>/<model-pattern>` keys such as `vertex_ai/claude-*` in `cost_discount_config`, with a Model pattern field in the Admin UI Provider Discounts form - [PR #43335](https://github.com/BerriAI/litellm/pull/43335)
- Keep an explicit zero hourly cache write rate in pricing tiers instead of billing those writes at the ordinary write rate - [PR #45545](https://github.com/BerriAI/litellm/pull/45545)
- Bill a background Responses call once on a proxy with a database, to the creator's key, team, user, end user and tags, instead of again on every read and on the background poll - [PR #45703](https://github.com/BerriAI/litellm/pull/45703)
- Bill Gemini tool-use prompt tokens from URL context, code execution and File Search as input, so a response reporting 14,138 prompt tokens no longer records an input cost for only 23 - [PR #46021](https://github.com/BerriAI/litellm/pull/46021)
- Apply the Anthropic `fast` multiplier to the cache read and cache creation costs in `cost_breakdown`, so they add up to the billed `input_cost` - [PR #46112](https://github.com/BerriAI/litellm/pull/46112)
- Bill `azure_ai` Claude web searches per `usage.server_tool_use.web_search_requests` instead of once per response - [PR #46114](https://github.com/BerriAI/litellm/pull/46114)
- Bill a deployment with custom `input_cost_per_token` and `output_cost_per_token` at its own rates instead of the upstream `x-litellm-response-cost` header, so chained LiteLLM proxies honor the operator's price - [PR #46120](https://github.com/BerriAI/litellm/pull/46120)
- Bill a Bedrock inference-profile ARN that ends in an `eu.` or `us.` prefixed model id at that regional price row instead of the base model row - [PR #46128](https://github.com/BerriAI/litellm/pull/46128)
- Bill `azure_ai` Claude web searches per request for deployments that carry their own prices too, instead of once per response - [PR #46135](https://github.com/BerriAI/litellm/pull/46135)
- Bill Gemini and Vertex AI explicit context cache creation tokens from the `cachedContents` response as `cache_creation_input_tokens`, so cache creation is no longer under-billed - [PR #46144](https://github.com/BerriAI/litellm/pull/46144)
- Keep the Vertex AI cache creation token count out of request kwargs and clamp negative counts to 0, so a request body cannot change the billed tokens - [PR #46152](https://github.com/BerriAI/litellm/pull/46152)
- Scope `/spend/tags` to the caller's own and permitted-team logs for non-admin callers, and make its `start_date` and `end_date` parameters filter the aggregation window - [PR #46194](https://github.com/BerriAI/litellm/pull/46194)
- Price a `chatgpt/` deployment through `model_info.base_model` when its own provider row has no rates, instead of logging $0 spend - [PR #46318](https://github.com/BerriAI/litellm/pull/46318)
- Split `xai` spend rows across `input_cost` and `output_cost` instead of booking the whole total as output - [PR #46320](https://github.com/BerriAI/litellm/pull/46320)
- Report a `response_cost` of 0 in `x-litellm-response-cost` on a response cache hit, so the header matches `/spend/logs` - [PR #46471](https://github.com/BerriAI/litellm/pull/46471)
- Price `agentcore/search` at 0.007 USD per query, matching AWS's 7 USD per 1,000 queries, instead of 0 - [PR #46571](https://github.com/BerriAI/litellm/pull/46571)
- Bill xAI Grok Voice realtime sessions by audio seconds plus client text messages, using the new optional `input_cost_per_text_message` pricing field, instead of logging $0 spend - [PR #46600](https://github.com/BerriAI/litellm/pull/46600)
- Price reasoning tokens of a bridged `/v1/messages` call from the chat completion the bridge translated, so `cost_breakdown.reasoning_cost` is always present and `output_cost` agrees with `spend` - [PR #46726](https://github.com/BerriAI/litellm/pull/46726)
- Bill a search tool that fails over to an unpriced backup at the backup's own price instead of the failed primary's `input_cost_per_query` - [PR #46734](https://github.com/BerriAI/litellm/pull/46734)
- Bill bridged `/v1/messages` Responses replies like native `/v1/responses` for reasoning tokens and the flex service tier - [PR #47009](https://github.com/BerriAI/litellm/pull/47009)

### Spend logs and daily rollups

- Honor `litellm_settings.disable_end_user_cost_tracking` in spend logs, ClickHouse rows and the end-user tables, and stop failed requests from creating customer rows - [PR #40945](https://github.com/BerriAI/litellm/pull/40945)
- Bound spend log cleanup delete batches to the Postgres statement timeout instead of Prisma's 5 second transaction timeout, so slow batches stop failing with a 422 and expired logs get deleted - [PR #43279](https://github.com/BerriAI/litellm/pull/43279)
- Run `POST /global/spend/refresh` on the writer instead of the read replica, so it no longer fails and the Old Usage page shows the fresh monthly total - [PR #45699](https://github.com/BerriAI/litellm/pull/45699)
- Write spend log rows for `/vllm` chat and text completion calls to router models, which left key, team and user spend at zero, and for `/azure` and `/azure_ai` calls on proxies with a sync success callback - [PR #45733](https://github.com/BerriAI/litellm/pull/45733)
- Add `general_settings.disable_requester_ip_address_logging` to store a null caller IP in new spend log rows and mask IPs in stored headers and errors, also toggleable in Admin UI General Settings - [PR #45804](https://github.com/BerriAI/litellm/pull/45804)
- Move the call-id index aside with the other six indexes in `db_scripts/partition_spend_logs.sql`, so the next migration job no longer fails with an index-already-exists error after spend logs are partitioned - [PR #46131](https://github.com/BerriAI/litellm/pull/46131)

### Budgets

- Enforce the personal `max_budget` of a user whose JWT carries the proxy admin role on LLM routes, as is already done for other users - [PR #43070](https://github.com/BerriAI/litellm/pull/43070)
- Add `team_member_model_max_budget` on `/team/new` and `/team/update` and `model_max_budget` on `/team/member_update` for per-model team member budgets, with over-budget requests following `router_settings.fallbacks` and matching editors in the Admin UI - [PR #43887](https://github.com/BerriAI/litellm/pull/43887)
- Report `budget_reset_at` on each `model_max_budget_usage` entry, and end monthly budget windows one calendar month after they open, counted in UTC - [PR #45797](https://github.com/BerriAI/litellm/pull/45797)
- Reset end-user spend in committed pages of `RESET_BUDGET_JOB_BATCH_SIZE` rows, so the budget reset job still commits when `LiteLLM_EndUserTable` has millions of rows - [PR #46502](https://github.com/BerriAI/litellm/pull/46502)

### Rate limiting

- Add `general_settings.disable_fallbacks_on_per_model_rate_limits` so per-model key, team, organization and project limits (`model_rpm_limit`, `model_tpm_limit`) return 429 instead of retrying on a fallback - [PR #45459](https://github.com/BerriAI/litellm/pull/45459)
- Release the legacy rate limiter's slot only from an admitted Responses WebSocket, so rejected realtime attempts no longer lower a key's in-flight count under `LEGACY_MULTI_INSTANCE_RATE_LIMITING` - [PR #46822](https://github.com/BerriAI/litellm/pull/46822)

## MCP Gateway

### Auth and OAuth

- Request offline access and consent from Google upstream OAuth providers, so Google MCP connections receive refresh tokens - [PR #41197](https://github.com/BerriAI/litellm/pull/41197)
- Skip budget checks on zero-spend MCP discovery routes and JSON-RPC methods such as `/mcp-rest/tools/list`, `/v1/mcp/tools`, `initialize` and `tools/list`, so over-budget keys can still start MCP clients while `tools/call` stays enforced - [PR #41276](https://github.com/BerriAI/litellm/pull/41276)
- Keep the parsed key when the `litellm_key_header_name` header is absent from the request, so clients using `Authorization` or `x-litellm-api-key` no longer get a 401 and MCP toolsets load - [PR #44469](https://github.com/BerriAI/litellm/pull/44469)
- Scope gateway OAuth consent on aggregate `/mcp` to the servers in `x-mcp-servers`, and add opt-in `general_settings.mcp_require_explicit_server_scope` that answers 400 `mcp_server_scope_required` on a bare `/mcp` - [PR #44957](https://github.com/BerriAI/litellm/pull/44957)
- Let MCP server create and update bodies on `/v1/mcp/server` carry the four `token_exchange_*` fields, so saving an MCP server with OAuth token exchange no longer returns 401 - [PR #45723](https://github.com/BerriAI/litellm/pull/45723)
- Pass only the JSON-RPC `method` to MCP admission auth, so a `tools/call` that adds an extra `model` field is still checked against the key's budget - [PR #45844](https://github.com/BerriAI/litellm/pull/45844)
- Preserve existing scopes when a managed OAuth server asks for more permissions, and relay insufficient-scope denials as a 403 OAuth challenge so MCP clients can request the missing scope - [PR #45886](https://github.com/BerriAI/litellm/pull/45886)
- Add optional `id_jag_resource_client_id` and `id_jag_resource_client_secret` so ID-JAG leg 2 can use its own confidential client instead of the IdP client - [PR #46211](https://github.com/BerriAI/litellm/pull/46211)
- Persist the first DCR client for config-declared MCP servers whoever registers it when `PROXY_BASE_URL` is set, so non-admin users stop being signed out each time the access token expires - [PR #46544](https://github.com/BerriAI/litellm/pull/46544)
- Accept a validated JWT as the OBO subject token after virtual-key mapping, and answer 401 with IdP authentication instructions when it is missing or invalid - [PR #46549](https://github.com/BerriAI/litellm/pull/46549)
- Accept an ID-JAG as an RFC 7523 `jwt-bearer` grant on the gateway token endpoint, and keep the IdP `id_token`, SAML assertion or OIDC refresh token from login as the subject for `oauth2_id_jag` servers - [PR #47058](https://github.com/BerriAI/litellm/pull/47058)
- Cap an ID-JAG access token to the MCP routes when its signed `resource` is only `{base}/mcp`, and refuse an unknown `resource` with 400 `invalid_target` - [PR #47138](https://github.com/BerriAI/litellm/pull/47138)
- Add Authorization URL, Token URL and Scopes fields to the OAuth Delegate form for MCP servers, and register one shared gateway client on `{PROXY_BASE_URL}/callback` for DCR bridge servers so upstreams that restrict redirect domains accept sign-in - [PR #47153](https://github.com/BerriAI/litellm/pull/47153)

### Rate limits and guardrails

- Pass the caller's bearer privately to MCP pre-call guardrails after JWT-to-key mapping, so the Agent 365 guardrail stops rejecting valid tool calls - [PR #45746](https://github.com/BerriAI/litellm/pull/45746)
- Exclude the gateway's own key from the caller bearer passed to MCP guardrails when it is sent in both `x-litellm-api-key` and `Authorization`, while caller JWTs still reach the guardrail - [PR #45897](https://github.com/BerriAI/litellm/pull/45897)
- Stop proxy-started legacy MCP listeners from using up a server's `rpm`, so a client gets its full configured budget - [PR #46982](https://github.com/BerriAI/litellm/pull/46982)

### Protocol and catalog

- Keep one upstream MCP session per gateway `mcp-session-id` and server across tool calls, so stateful upstream servers remember state between calls - [PR #42741](https://github.com/BerriAI/litellm/pull/42741)
- Leave out tool texts too long to embed instead of failing every MCP tool search with an embedding length error - [PR #43554](https://github.com/BerriAI/litellm/pull/43554)
- Forward MCP progress messages through the gateway with output guardrails applied, and cancel in-flight upstream tool calls promptly instead of waiting for the session lock - [PR #46134](https://github.com/BerriAI/litellm/pull/46134)
- Relay upstream tool, prompt and resource change notifications and resource subscriptions through caller-scoped streams, rechecking access before delivery - [PR #46153](https://github.com/BerriAI/litellm/pull/46153)
- Route a bare tool name on a single-server scope (`/{server_name}/mcp` or `x-mcp-servers`) to that server, so `tools/call` stops answering `Tool not found` on a replica that has not listed it - [PR #46225](https://github.com/BerriAI/litellm/pull/46225)
- Advertise supported notification capabilities of authorized upstream servers in `server/discover`, keep legacy `initialize` flags, and limit optional probes to the remaining listing budget - [PR #46264](https://github.com/BerriAI/litellm/pull/46264)
- Resolve `get_tool_schema` and `call_tool` on `/mcp/proxy` from the server that owns the `tool_id`, so slow sibling servers no longer delay the call - [PR #46545](https://github.com/BerriAI/litellm/pull/46545)
- Add `general_settings.mcp_disabled_capabilities` to stop advertising `prompts` and `resources`, with matching switches on the Admin UI MCP network settings card - [PR #46563](https://github.com/BerriAI/litellm/pull/46563)
- Read the first `Router` stream chunk through `__aiter__`, so streamed `/v1/chat/completions` with an auto-run MCP tool no longer returns a 500 - [PR #46578](https://github.com/BerriAI/litellm/pull/46578)

### Admin MCP and UI

- Add `mcp_tool_permissions` to access groups, a per-server tool allowlist that keys, teams and agents inherit, where an empty list denies every tool on that server, with create, edit and detail pages in the Admin UI - [PR #46300](https://github.com/BerriAI/litellm/pull/46300)
- Scope the MCP server selector on team, key and user forms to the servers they can reach, and add `user_id` to `GET /v1/mcp/server` to list servers for one user - [PR #46565](https://github.com/BerriAI/litellm/pull/46565)

## Performance / Loadbalancing / Reliability improvements

### Auto Router and model routing

- Keep the region, RPM and param checks running when the router cannot count a request's tokens and skip only the context-window check, so an EU-pinned end user's audio or image prompt no longer reaches a US deployment - [PR #44544](https://github.com/BerriAI/litellm/pull/44544)
- Let an exact same-model `base_model` widen a non-Azure deployment's context window in the router, so a prompt that fits the window shown by `/model/info` is no longer rejected - [PR #46197](https://github.com/BerriAI/litellm/pull/46197)
- Report a fallback skipped for access or budget as skipped instead of failed, so the 500 no longer repeats the primary error as if the fallback had been called - [PR #46291](https://github.com/BerriAI/litellm/pull/46291)
- Add `fallback_on_unsupported_params` to `Router` and `router_settings`, so setting it to `False` raises a param rejection instead of answering from a fallback model - [PR #46350](https://github.com/BerriAI/litellm/pull/46350)
- Read the first stream chunk inside `Router` chat completions, so a stream that fails before any token spends `num_retries` and walks the fallbacks like a non-streaming request - [PR #46493](https://github.com/BerriAI/litellm/pull/46493)

### Caching, database and runtime

- Track management audit log writes and drain them for up to 5 seconds on shutdown, so a SIGTERM during a deploy no longer drops audit rows for calls that returned 200 - [PR #43594](https://github.com/BerriAI/litellm/pull/43594)
- Sign RDS IAM database tokens for the region in the RDS hostname, with `AWS_RDS_REGION` and `AWS_RDS_READ_REPLICA_REGION` overrides, so cross-region writers and read replicas connect - [PR #44782](https://github.com/BerriAI/litellm/pull/44782)
- Build the served text of a finished `/v1/messages` stream in a worker thread and stringify Redis cache values only when `set_verbose` is on, so other requests no longer wait on the event loop - [PR #45252](https://github.com/BerriAI/litellm/pull/45252)
- Roll back and retry a boot-time migration that times out waiting for a table lock, so a long `LiteLLM_SpendLogs` reader no longer blocks every pod's spend log writes during a rollout - [PR #45389](https://github.com/BerriAI/litellm/pull/45389)
- Start at most one cold MCP schema validation worker per CPU the proxy can run on - [PR #45791](https://github.com/BerriAI/litellm/pull/45791)
- Broadcast a cache invalidation to every instance on team writes, so team edits apply on all instances right away instead of after up to 60 seconds - [PR #46113](https://github.com/BerriAI/litellm/pull/46113)
- Print a startup warning when `--max_requests_before_restart` runs with a single worker, and say in its help text that it is only safe with 2 or more workers - [PR #46185](https://github.com/BerriAI/litellm/pull/46185)
- Bound the SIGTERM wait on uvicorn and gunicorn by `GRACEFUL_SHUTDOWN_TIMEOUT`, so a request still running after the timeout is cancelled and the proxy's shutdown teardown still runs - [PR #46186](https://github.com/BerriAI/litellm/pull/46186)
- Start new migrations with `SET LOCAL lock_timeout = '10s'` in their SQL instead of a connection option, so pooled database URLs boot and a migration stuck behind a table lock times out and retries - [PR #46329](https://github.com/BerriAI/litellm/pull/46329)
- Resend a POST or PATCH on a fresh connection only when nothing reached the upstream, so a request the provider already read is no longer run and billed twice after a dropped connection - [PR #46336](https://github.com/BerriAI/litellm/pull/46336)
- Restore the 15 second default for `AIOHTTP_KEEPALIVE_TIMEOUT` in the Python and Rust HTTP clients, so gateways that close idle connections stop causing 500s on the first request after a quiet spell - [PR #46355](https://github.com/BerriAI/litellm/pull/46355)
- Keep response cache hits free of fields the provider never sent, so a hit no longer adds `system_fingerprint: null` to the body - [PR #46359](https://github.com/BerriAI/litellm/pull/46359)
- Compress gzip responses over 16 KiB in a worker thread instead of on the event loop, so large embeddings responses no longer stall health checks and other requests - [PR #46362](https://github.com/BerriAI/litellm/pull/46362)
- Run `prisma migrate deploy` inside the pinned migration coordinator lock and turn off Prisma's session advisory lock, so a restart behind a transaction pooler no longer waits 600 seconds on a stranded lock - [PR #46368](https://github.com/BerriAI/litellm/pull/46368)
- Start the `telemetry_reports` migration with `SET LOCAL lock_timeout`, so a boot behind a held `LiteLLM_TelemetryReport` lock gives up and retries instead of waiting forever - [PR #46386](https://github.com/BerriAI/litellm/pull/46386)
- Default every Redis client to a 5 second socket timeout when none is set and raise the `REDIS_SOCKET_TIMEOUT` default from 0.1 to 5 seconds, so a hung Redis no longer blocks requests indefinitely - [PR #46501](https://github.com/BerriAI/litellm/pull/46501)
- Finish Prisma engine requests when their caller is cancelled during shutdown, so the final spend flush no longer fails and daily user and team spend for 200 responses is kept - [PR #46503](https://github.com/BerriAI/litellm/pull/46503)
- Accept database passwords with spaces or quotes in the v2 migration lock, redact the password from lock errors and report `P1001` when the database is unreachable - [PR #46592](https://github.com/BerriAI/litellm/pull/46592)
- Build the `/public/providers/fields` and `/public/agents/fields` responses once per process and serve them from memory instead of re-reading and re-validating the provider file on every request - [PR #46617](https://github.com/BerriAI/litellm/pull/46617)
- Hold only Prisma's own advisory lock during `prisma migrate deploy`, so a booting pod no longer times out behind a replica building request log indexes - [PR #46660](https://github.com/BerriAI/litellm/pull/46660)
- Limit gzip to 35 dashboard analytics GET routes and compress every eligible response in a worker thread, so inference and other API responses are no longer compressed on the proxy - [PR #46712](https://github.com/BerriAI/litellm/pull/46712)

### Docker and Helm

- Support a separate hostname per component in the componentized Helm chart with `ingress.componentHosts`, so the UI, backend and gateway each get their own DNS name and the UI finds the backend and gateway at runtime - [PR #46360](https://github.com/BerriAI/litellm/pull/46360)
- Read the database and Redis host or full URL from a Kubernetes Secret with the new `hostKey` and `urlKey` fields on each `passwordSecret` block, so `host` is no longer required in the values file - [PR #46410](https://github.com/BerriAI/litellm/pull/46410)
- Add a `litellm-gateway` command to quickstart installs with `status`, `up`, `down`, `restart`, `logs`, `open`, `update` and `uninstall`, and open a menu when the install command is rerun on an existing install - [PR #46486](https://github.com/BerriAI/litellm/pull/46486)
- Add `db.useIAMAuth` and `db.useAzureEntraAuth` to the `litellm-helm` chart, so RDS IAM and Azure Entra users start the proxy with a minted token and no password Secret - [PR #46534](https://github.com/BerriAI/litellm/pull/46534)
- Expose `redis.ssl`, `redis.sslCertReqs` and `redis.sslCaCerts` in the `helm/litellm` chart, rendered as `REDIS_SSL`, `REDIS_SSL_CERT_REQS` and `REDIS_SSL_CA_CERTS` for every component - [PR #46536](https://github.com/BerriAI/litellm/pull/46536)

### Dependency updates

- Allow `openai>=2.20.0,<4.0.0` so LiteLLM installs next to OpenAI SDK 3, while SDK 2 users keep the same minimum - [PR #44927](https://github.com/BerriAI/litellm/pull/44927)
- Bump mlflow to 3.17.0 in the lockfile and drop its osv-scanner suppression - [PR #45777](https://github.com/BerriAI/litellm/pull/45777)

## Documentation Updates

- Point the GCP one-click deploy button and tutorial at the `terraform-google-litellm` mirror repository - [Commit 320536d](https://github.com/BerriAI/litellm/commit/320536d23c28539d55dbbe6e5a644f942c44b96e)

## Tests, CI and Internal Changes

These 218 changes touch tests, CI, contributor tooling, refactors, Rust runtime scaffolding that is not yet wired into a user-facing path, or product changes that were reverted before the cut. They do not change proxy or SDK behavior on their own. Changes listed as commits have no public PR


<details>
<summary>Integration and e2e tests (66)</summary>

- Add an e2e case that checks persisted spend for configured pricing - [PR #41566](https://github.com/BerriAI/litellm/pull/41566)
- Cover the `agents_a2a` endpoint contracts with integration tests - [PR #44650](https://github.com/BerriAI/litellm/pull/44650)
- Cover the `images` endpoint contracts with integration tests - [PR #44653](https://github.com/BerriAI/litellm/pull/44653)
- Cover the `small_inference` endpoint contracts with integration tests - [PR #44654](https://github.com/BerriAI/litellm/pull/44654)
- Cover the `scim` endpoint contracts with integration tests - [PR #44656](https://github.com/BerriAI/litellm/pull/44656)
- Cover the `embeddings` endpoint contracts with integration tests - [PR #44660](https://github.com/BerriAI/litellm/pull/44660)
- Cover the `mcp_runtime` endpoint contracts with integration tests - [PR #44671](https://github.com/BerriAI/litellm/pull/44671)
- Cover the `keys_auth` endpoint contracts with integration tests - [PR #44674](https://github.com/BerriAI/litellm/pull/44674)
- Cover the `google_genai` endpoint contracts with integration tests - [PR #44680](https://github.com/BerriAI/litellm/pull/44680)
- Cover the `model_management` endpoint contracts with integration tests - [PR #44684](https://github.com/BerriAI/litellm/pull/44684)
- Cover the `prompts_tags_caching` endpoint contracts with integration tests - [PR #44686](https://github.com/BerriAI/litellm/pull/44686)
- Cover the `mcp_management` endpoint contracts with integration tests - [PR #44687](https://github.com/BerriAI/litellm/pull/44687)
- Cover the `chat_completions` endpoint contracts with integration tests - [PR #44688](https://github.com/BerriAI/litellm/pull/44688)
- Cover the `realtime` endpoint contracts with integration tests - [PR #44689](https://github.com/BerriAI/litellm/pull/44689)
- Cover the `pass_through` endpoint contracts with integration tests - [PR #44690](https://github.com/BerriAI/litellm/pull/44690)
- Cover the `videos_containers` endpoint contracts with integration tests - [PR #44691](https://github.com/BerriAI/litellm/pull/44691)
- Cover the `fine_tuning` endpoint contracts with integration tests - [PR #44697](https://github.com/BerriAI/litellm/pull/44697)
- Cover the `audio` endpoint contracts with integration tests - [PR #44699](https://github.com/BerriAI/litellm/pull/44699)
- Cover the `files_batches` endpoint contracts with integration tests - [PR #44703](https://github.com/BerriAI/litellm/pull/44703)
- Cover the `anthropic_messages` endpoint contracts with integration tests - [PR #44704](https://github.com/BerriAI/litellm/pull/44704)
- Cover the `teams` endpoint contracts with integration tests - [PR #44705](https://github.com/BerriAI/litellm/pull/44705)
- Cover the `guardrails_policies` endpoint contracts with integration tests - [PR #44722](https://github.com/BerriAI/litellm/pull/44722)
- Cover the `orgs_users_customers` endpoint contracts with integration tests - [PR #44725](https://github.com/BerriAI/litellm/pull/44725)
- Cover the `responses` endpoint contracts with integration tests - [PR #44733](https://github.com/BerriAI/litellm/pull/44733)
- Pin the assistants and evals endpoint contracts in integration tests - [PR #44734](https://github.com/BerriAI/litellm/pull/44734)
- Cover the `budgets_spend` endpoint contracts with integration tests - [PR #44736](https://github.com/BerriAI/litellm/pull/44736)
- Cover the `config_utils` endpoint contracts with integration tests - [PR #44737](https://github.com/BerriAI/litellm/pull/44737)
- Cover the `vector_stores` endpoint contracts with integration tests - [PR #44739](https://github.com/BerriAI/litellm/pull/44739)
- Cover the `health_routing` endpoint contracts with integration tests - [PR #44744](https://github.com/BerriAI/litellm/pull/44744)
- Make MCP scope-discovery server aliases digits-only in the integration test - [PR #45675](https://github.com/BerriAI/litellm/pull/45675)
- Model the team membership lookup in MCP DCR admission fixtures and assert Decisions call types per route - [PR #45917](https://github.com/BerriAI/litellm/pull/45917)
- Pin the What's new catalog to a local copy in the canary egress rig - [PR #45925](https://github.com/BerriAI/litellm/pull/45925)
- Assert lock-timeout retry and exhaustion in migration tests instead of an unbounded wait - [PR #45955](https://github.com/BerriAI/litellm/pull/45955)
- Retry the owned Redis test helper on another port when its port is already served - [PR #46019](https://github.com/BerriAI/litellm/pull/46019)
- Attribute pass-through probe traffic in MCP tests to the caller instead of the whole peer log - [PR #46020](https://github.com/BerriAI/litellm/pull/46020)
- Give the ownership test proxy its own DB pool headroom - [PR #46025](https://github.com/BerriAI/litellm/pull/46025)
- Isolate every multi-worker integration suite by default - [PR #46027](https://github.com/BerriAI/litellm/pull/46027)
- Migrate before the timed owned proxy launch and gate the credential probe on every worker - [PR #46030](https://github.com/BerriAI/litellm/pull/46030)
- Give chaos and timing tests a harness API and gate raw signals - [PR #46031](https://github.com/BerriAI/litellm/pull/46031)
- Cut CircleCI proxy boot time with concurrent worker stacks and single-worker test proxies - [PR #46037](https://github.com/BerriAI/litellm/pull/46037)
- Rename the e2e `load` tests to `perf` and consolidate the opt-in into `E2E_PERF_TESTS` - [PR #46077](https://github.com/BerriAI/litellm/pull/46077)
- Wait for SIGSTOP to take effect before handing back a suspended proxy process in integration tests - [PR #46088](https://github.com/BerriAI/litellm/pull/46088)
- Isolate shared proxy state behind six order-dependent flaky integration tests - [PR #46172](https://github.com/BerriAI/litellm/pull/46172)
- Remove six test setup causes of CircleCI integration failures - [PR #46490](https://github.com/BerriAI/litellm/pull/46490)
- Update the breakpoint cache mark census expectation after a cache control change - [PR #46509](https://github.com/BerriAI/litellm/pull/46509)
- Fix three more CircleCI integration failures caused by test setup - [PR #46510](https://github.com/BerriAI/litellm/pull/46510)
- Delete the flaky team model TPM concurrency test - [PR #46541](https://github.com/BerriAI/litellm/pull/46541)
- Update stale CircleCI integration expectations - [PR #46570](https://github.com/BerriAI/litellm/pull/46570)
- Cache the two-turn `tool_search` guardrail replays in integration tests - [PR #46614](https://github.com/BerriAI/litellm/pull/46614)
- Expect the list-position index on streamed thinking blocks in the integration suite - [PR #46618](https://github.com/BerriAI/litellm/pull/46618)
- Extend runtime regression contracts for Messages and the SDK - [PR #46641](https://github.com/BerriAI/litellm/pull/46641)
- Pin the xAI reported-cost split and the coordinator-held Prisma lock wait in CI tests - [PR #46645](https://github.com/BerriAI/litellm/pull/46645)
- Expect signed empty thinking blocks to survive `/v1/messages` replay in the integration suite - [PR #46686](https://github.com/BerriAI/litellm/pull/46686)
- Add an e2e perf rig with out-of-process mocks, a `PerformanceTestCase` runner, per-request limits and the `small_bodies_5rps` case - [PR #46713](https://github.com/BerriAI/litellm/pull/46713)
- Add the `mixed_size_requests_2rps` perf case with coding-agent bodies, tools, JWT and key callers and two guardrails - [PR #46717](https://github.com/BerriAI/litellm/pull/46717)
- Remove BUG skips for three integration tests that pass on main - [PR #46725](https://github.com/BerriAI/litellm/pull/46725)
- Drop inherited provider API keys from the integration runner env - [PR #46733](https://github.com/BerriAI/litellm/pull/46733)
- Wait on the right signal in five flaky integration contracts - [PR #46737](https://github.com/BerriAI/litellm/pull/46737)
- Hand every harness server a port from one per-worker block - [PR #46761](https://github.com/BerriAI/litellm/pull/46761)
- Attach e2e perf case metrics and limits as JUnit properties - [PR #46774](https://github.com/BerriAI/litellm/pull/46774)
- Start perf users staggered with jitter and give tool-call streams a first token - [PR #46776](https://github.com/BerriAI/litellm/pull/46776)
- Build OpenAI and Anthropic SDK models before integration tests start threads - [PR #46797](https://github.com/BerriAI/litellm/pull/46797)
- Count the Postgres statements and Redis commands a request waits on in e2e perf datastore limits, and report background work on its own - [PR #46798](https://github.com/BerriAI/litellm/pull/46798)
- Send the `Connection` close header on every integration browser request - [PR #46805](https://github.com/BerriAI/litellm/pull/46805)
- Wait for the gen-AI span before reading the excluded-services operator trace - [PR #46846](https://github.com/BerriAI/litellm/pull/46846)
- Drain SDK logging in the integration harness so lifecycle tests stay stable - [PR #47143](https://github.com/BerriAI/litellm/pull/47143)

</details>

<details>
<summary>Refactors and typing (43)</summary>

- Clear 670 basedpyright `Any` errors by validating provider payloads at the boundary - [PR #45388](https://github.com/BerriAI/litellm/pull/45388)
- Replace `Any` with proven types in 3 files - [PR #45565](https://github.com/BerriAI/litellm/pull/45565)
- Import `LiteLLM_SkillsTable` from `litellm.models` - [Commit 6c71452](https://github.com/BerriAI/litellm/commit/6c714523559fd0d13af9ab574048f276982fc409)
- Import team and user table models from `litellm.models` - [Commit 3fafd00](https://github.com/BerriAI/litellm/commit/3fafd0062af38be86ad95a5426e3edd65d8bbff6)
- Move `LitellmUserRoles` and `KeyManagementRoutes` into `litellm.types.proxy.auth.user_roles` - [Commit a3f05fb](https://github.com/BerriAI/litellm/commit/a3f05fb52fadf0114affdea1f844c6074f369fa4)
- Move the typesafe pass-through logging handler out of the proxy package - [Commit 396e8d1](https://github.com/BerriAI/litellm/commit/396e8d1e6c0cbb70c396afb22ee7819e512fd3b4)
- Move Anthropic pass-through SSE stream assembly into `litellm/llms` - [Commit 7f5abff](https://github.com/BerriAI/litellm/commit/7f5abfffb4fb3fca21118ea99287c3e3de9df6e5)
- Move `CommonProxyErrors` into `litellm/types/proxy` - [Commit 38880fd](https://github.com/BerriAI/litellm/commit/38880fd5ce266ee2abd8f38a635149ba82d5d9d5)
- Move `is_jwt` into `litellm.types.proxy.auth.user_api_key_auth` - [Commit 7831d8a](https://github.com/BerriAI/litellm/commit/7831d8a9915e9171cacdd18038d73070f706f1ef)
- Move the prompt cache observation lookup out of the proxy hook - [Commit ebf2156](https://github.com/BerriAI/litellm/commit/ebf2156ec4a64996fbf03d27412d9fdd116fd783)
- Move raw SSE stream assembly helpers out of proxy guardrails - [Commit 3981228](https://github.com/BerriAI/litellm/commit/3981228d7038383fcc7e998e2561ef124f8c878c)
- Move Slack alerting leaf types out of `proxy/_types.py` - [Commit 9c8083e](https://github.com/BerriAI/litellm/commit/9c8083e323ca6619fe3d28aa653e68952ab7db1b)
- Move the prompt cache pricing helper out of the proxy package - [Commit c397b57](https://github.com/BerriAI/litellm/commit/c397b57f2b8685d05e7c5ffc5bdacef6a310f33f)
- Move `PassThroughGuardrailSettings` into the pass-through types module - [Commit 8f047e0](https://github.com/BerriAI/litellm/commit/8f047e0a333401c02075f03943a636e966bce8c9)
- Move `stream_chunk_builder` into `streaming_chunk_builder_utils` - [Commit 9e3cd2f](https://github.com/BerriAI/litellm/commit/9e3cd2f0a4868f8d444ed6cfceb1abf710ce8f07)
- Move `NewSkillRequest` to `litellm.models.skills` - [Commit 7383f59](https://github.com/BerriAI/litellm/commit/7383f59ad2719ee0edf7725f5fa50e2f7f326919)
- Clean up typing and duplicated export job code in per-user Copilot auth, the Ternary FOCUS export and telemetry, with no behavior change - [PR #45769](https://github.com/BerriAI/litellm/pull/45769)
- Move cache token extractors out of proxy savings - [Commit 8d510a6](https://github.com/BerriAI/litellm/commit/8d510a6b1bdd1aa2ae1824863c8010112a3461ce)
- Move `responses_api_bridge_check` out of `litellm.main` - [Commit d02dc43](https://github.com/BerriAI/litellm/commit/d02dc43154218b38962efdab1f35cf4b7320d508)
- Import `CustomLogger` and `CustomLLM` under `TYPE_CHECKING` in adapter TypedDicts - [Commit 13191e5](https://github.com/BerriAI/litellm/commit/13191e5b661b1a155855429261668a66b43da896)
- Move `path_utils` from proxy `common_utils` to `litellm_core_utils` - [Commit 9d559d8](https://github.com/BerriAI/litellm/commit/9d559d85795b6175f4851ad20a00da916b34fdba)
- Import `litellm` lazily in Prometheus types helpers - [Commit 4606bf5](https://github.com/BerriAI/litellm/commit/4606bf532e8d4c7ca465de42aa4c2ba5f7d2ab72)
- Move `AUTH_OBJECTS_TARGET` into `litellm.constants` - [Commit 12c36b0](https://github.com/BerriAI/litellm/commit/12c36b054b2247b47eb9ccbc1aa7a3ae0cefe249)
- Move complexity router request models next to their base config - [Commit 0fc6d4d](https://github.com/BerriAI/litellm/commit/0fc6d4d16d8b1b044de69c594cdc813be2f34260)
- Import proxy helpers inside the repository methods that use them - [Commit d1c4d06](https://github.com/BerriAI/litellm/commit/d1c4d0666ff0e601ae2c4e48827dacc2e3b9cab6)
- Move `ColdStorageHandler` out of the proxy into `litellm_core_utils` - [Commit c9e0ec8](https://github.com/BerriAI/litellm/commit/c9e0ec871989194b29b78d041bf7d15abc276861)
- Type `UserAPIKeyAuth`, its token view and `hash_token` in place - [Commit dec8ec5](https://github.com/BerriAI/litellm/commit/dec8ec5daa6b1cc8c163a7b60a923199a3ada01b)
- Move `UserAPIKeyAuth`, its token view and `hash_token` into `litellm.types.proxy.auth.user_api_key_auth` - [Commit 9e7e5c2](https://github.com/BerriAI/litellm/commit/9e7e5c24e4315ca8b5d87d2c30de64b5fb816aa1)
- Annotate `GenerateRequestBase` containers and `check_max_budget` - [Commit b7d48ec](https://github.com/BerriAI/litellm/commit/b7d48ecd281fb229d7c7e9e89f4da12ce5b632e3)
- Move `GenerateRequestBase` and `LiteLLM_ObjectPermissionBase` into `litellm.types.proxy.management_endpoints.request_base` - [Commit 981710f](https://github.com/BerriAI/litellm/commit/981710fab81c5551c09717b66da57ed41504885a)
- Move `resource_ownership` out of the proxy into `litellm_core_utils` - [Commit c582bc6](https://github.com/BerriAI/litellm/commit/c582bc6e68a1b78e9d63d6d63f37ee66f8c976c1)
- Import `UserAPIKeyAuth` from `litellm.types.proxy.auth` in the SDK - [Commit a1e5c90](https://github.com/BerriAI/litellm/commit/a1e5c90e56b31a5592693027fbdce4c3014acbbb)
- Annotate user request metadata and `check_user_info` validators - [Commit a859d84](https://github.com/BerriAI/litellm/commit/a859d844edab037372cb79748ad9cf9cc6efebd4)
- Annotate key request containers and `drop_blank_team_id` - [Commit 2374b0c](https://github.com/BerriAI/litellm/commit/2374b0c398865e332f6b3b77f31a09ef707d4ed5)
- Move key request models into `litellm.types.proxy.management_endpoints.key_requests` - [Commit c9d706a](https://github.com/BerriAI/litellm/commit/c9d706adb5d387807d9d03fd9d90c49ef8a66847)
- Move user request models into `litellm.types.proxy.management_endpoints.user_requests` - [Commit 513e7a8](https://github.com/BerriAI/litellm/commit/513e7a89ac17e5301ceb57fa30e078454cacee7f)
- Move `MemberDeleteRequest` into `litellm.types.proxy.management_endpoints.team_endpoints` - [Commit 2011004](https://github.com/BerriAI/litellm/commit/2011004d0adf28c45d0bc2194b3cdba67f666327)
- Replace `Any` with proven types in 12 files - [PR #45943](https://github.com/BerriAI/litellm/pull/45943)
- Replace `Any` with proven types in 6 files - [PR #46042](https://github.com/BerriAI/litellm/pull/46042)
- Rename `is_claude_4_5_on_bedrock` to `supports_bedrock_prompt_cache_ttl` - [PR #46058](https://github.com/BerriAI/litellm/pull/46058)
- Name the pre-content stream retry helpers for both stream paths and let the retry loop take its attempt function - [PR #46474](https://github.com/BerriAI/litellm/pull/46474)
- Clear 1143 basedpyright `Any` errors across 273 files - [PR #46574](https://github.com/BerriAI/litellm/pull/46574)
- Replace `Any` with proven types in 24 files - [PR #46663](https://github.com/BerriAI/litellm/pull/46663)

</details>

<details>
<summary>Rust core (28)</summary>

- Bump the Rust workspace's `serde_with` to 3.21.0 to clear osv-scan - [PR #45498](https://github.com/BerriAI/litellm/pull/45498)
- Type the AWS connection params in `auth-aws` - [PR #45610](https://github.com/BerriAI/litellm/pull/45610)
- Give Messages configs typed LiteLLM params - [PR #45611](https://github.com/BerriAI/litellm/pull/45611)
- Add native DeepSeek `/v1/messages` support to the Rust core, opted in with `LITELLM_RUST` - [PR #45614](https://github.com/BerriAI/litellm/pull/45614)
- Add native Vertex AI Claude `/v1/messages` support to the Rust core, opted in with `LITELLM_RUST` - [PR #45626](https://github.com/BerriAI/litellm/pull/45626)
- Type the Vertex AI connection params in `auth-gcp` - [PR #45641](https://github.com/BerriAI/litellm/pull/45641)
- Use one `LitellmParams` type for a config and a caller - [PR #45642](https://github.com/BerriAI/litellm/pull/45642)
- Route Python state reads through host modules in the Rust bridge - [PR #45689](https://github.com/BerriAI/litellm/pull/45689)
- Add native EdenAI `/v1/messages` support to the Rust core and pass the provider's billed cost to spend logging - [PR #45698](https://github.com/BerriAI/litellm/pull/45698)
- Add a live provider harness for the Messages route - [PR #45823](https://github.com/BerriAI/litellm/pull/45823)
- Share provider constants through `llms-types` and restructure the Rust `AGENTS.md` - [PR #45850](https://github.com/BerriAI/litellm/pull/45850)
- Add native MiniMax `/v1/messages` support to the Rust core, including SSE streaming and cache hints - [PR #45896](https://github.com/BerriAI/litellm/pull/45896)
- Add native Tencent `/v1/messages` support to the Rust core, including SSE streaming and cache hints - [PR #45899](https://github.com/BerriAI/litellm/pull/45899)
- Add native Bedrock Claude Platform and Bedrock Mantle `/v1/messages` support to the Rust core - [PR #45908](https://github.com/BerriAI/litellm/pull/45908)
- Add native OpenRouter `/v1/messages` support to the Rust core - [PR #45910](https://github.com/BerriAI/litellm/pull/45910)
- Use one stream codec shape per API format - [PR #45996](https://github.com/BerriAI/litellm/pull/45996)
- Add native OpenRouter `/v1/responses` support to the Rust core - [PR #46000](https://github.com/BerriAI/litellm/pull/46000)
- Run the Python driver as one async body in `host-python` - [PR #46235](https://github.com/BerriAI/litellm/pull/46235)
- Use a generator-style execution protocol with stream step names in the Rust bridge - [PR #46282](https://github.com/BerriAI/litellm/pull/46282)
- Return an unstarted `Execution` from native entrypoints and drive it in Python - [PR #46299](https://github.com/BerriAI/litellm/pull/46299)
- Move `host-python` driver tests out of the inline module - [PR #46325](https://github.com/BerriAI/litellm/pull/46325)
- Collect `host-python` failures in a `thiserror` `Error` enum - [PR #46361](https://github.com/BerriAI/litellm/pull/46361)
- Pin Messages and Responses callback contracts on the native path - [PR #46443](https://github.com/BerriAI/litellm/pull/46443)
- Assert native serving through the `x-litellm-rust` response marker - [PR #46531](https://github.com/BerriAI/litellm/pull/46531)
- Select native routes per test without `LITELLM_RUST` - [PR #46620](https://github.com/BerriAI/litellm/pull/46620)
- Remove the `LoggerRule` concept from the Rust bridge catalog - [PR #46711](https://github.com/BerriAI/litellm/pull/46711)
- Move the route host modules under `host/routes` - [PR #46786](https://github.com/BerriAI/litellm/pull/46786)
- Let each route host pick the body params - [PR #46787](https://github.com/BerriAI/litellm/pull/46787)

</details>

<details>
<summary>CI and release tooling (22)</summary>

- Shard the integration suites by recorded timings and give their workers private databases and fixtures - [PR #44146](https://github.com/BerriAI/litellm/pull/44146)
- Fix stale and flaky tests across CircleCI, GHA and Buildkite - [PR #45530](https://github.com/BerriAI/litellm/pull/45530)
- Finish the lint, unit and smoke check layout - [PR #45706](https://github.com/BerriAI/litellm/pull/45706)
- Move packaging and install checks off the CircleCI `build_and_test` job - [PR #45757](https://github.com/BerriAI/litellm/pull/45757)
- Use CircleCI native timing splits and fewer parallel nodes for integration suites - [PR #45837](https://github.com/BerriAI/litellm/pull/45837)
- Gate undocumented POST routes in the proxy OpenAPI document - [PR #45843](https://github.com/BerriAI/litellm/pull/45843)
- Give heavy integration suite workers private proxies, databases, Redis and provider edges - [PR #45863](https://github.com/BerriAI/litellm/pull/45863)
- Run every CircleCI check from the integration workflow - [PR #45938](https://github.com/BerriAI/litellm/pull/45938)
- Trigger the gateway-dev deploy on every push to main - [PR #45958](https://github.com/BerriAI/litellm/pull/45958)
- Remove pass-through and `user_api_key_auth` coverage scripts that no CI job runs - [PR #45969](https://github.com/BerriAI/litellm/pull/45969)
- Move redis-compat and MCP unit suites from CircleCI to GitHub Actions - [PR #46026](https://github.com/BerriAI/litellm/pull/46026)
- Run integration shards on large machines and size workers per suite - [PR #46034](https://github.com/BerriAI/litellm/pull/46034)
- Bump litellm to 1.107.0, litellm-enterprise to 0.1.77 and litellm-proxy-extras to 0.4.109 - [PR #46239](https://github.com/BerriAI/litellm/pull/46239)
- Run the two slowest unit shards on 4 workers - [PR #46743](https://github.com/BerriAI/litellm/pull/46743)
- Run the `mcp-elicitation` shard with dist load so the 74 params of `test_interactions.py` spread over its 4 workers - [PR #46770](https://github.com/BerriAI/litellm/pull/46770)
- Run the MCP interactions integration contract in its own unit shard so the `mcp-elicitation` shard stops timing out - [PR #46773](https://github.com/BerriAI/litellm/pull/46773)
- Run MCP interactions and Redis cluster IAM integration tests only in CircleCI - [PR #46780](https://github.com/BerriAI/litellm/pull/46780)
- Restore loadscope on the `mcp-interactions` shard so its MCP subscription cases do not race across workers - [PR #46783](https://github.com/BerriAI/litellm/pull/46783)
- Classify `token_count_framing` and `token_count_fallback_model` in the cost map schema generator - [PR #46784](https://github.com/BerriAI/litellm/pull/46784)
- Bump `claude-agent-sdk` to 0.2.165 in the CI dependency group to clear osv-scan - [PR #46976](https://github.com/BerriAI/litellm/pull/46976)
- Bump litellm-enterprise to 0.1.78 and litellm-proxy-extras to 0.4.110 so the release candidate publishes its new migrations - [PR #47230](https://github.com/BerriAI/litellm/pull/47230)
- Rebuild the Admin UI bundle for `rc/1.107.0` - [PR #47232](https://github.com/BerriAI/litellm/pull/47232)

</details>

<details>
<summary>Cost calculation tests (20)</summary>

- Check that a streamed request bills the same `SpendLogs` row as the non-streamed request - [PR #45730](https://github.com/BerriAI/litellm/pull/45730)
- Move the OpenAI cost tracking cases from `cost_tracking_cases.json` to `CostTrackingTestCase` literals - [PR #45879](https://github.com/BerriAI/litellm/pull/45879)
- Bill Decisions spend from captured provider responses on `/v1/decisions` and `/v1/systemone` in cost tests - [PR #45902](https://github.com/BerriAI/litellm/pull/45902)
- Add tier 1 Claude 5 and gpt-6 native cost cases - [PR #46124](https://github.com/BerriAI/litellm/pull/46124)
- Add `BridgeCostParityTestCase` with a gpt-6-sol `/v1/messages` to Responses pair - [PR #46130](https://github.com/BerriAI/litellm/pull/46130)
- Add Azure gpt-6 `/v1/messages` bridge cost parity pairs - [PR #46139](https://github.com/BerriAI/litellm/pull/46139)
- Add Claude 5 `/v1/responses` bridge cost parity pairs - [PR #46140](https://github.com/BerriAI/litellm/pull/46140)
- Add Bedrock Converse Claude 5 `/v1/responses` bridge cost parity pairs - [PR #46141](https://github.com/BerriAI/litellm/pull/46141)
- Add gpt-6 chat to Responses bridge cost parity pairs - [PR #46143](https://github.com/BerriAI/litellm/pull/46143)
- Add long context tier cost cases for gpt-6 (272k) and `claude-haiku-5-5` (100k) - [PR #46147](https://github.com/BerriAI/litellm/pull/46147)
- Add xAI grok-4.7, Bedrock runtime chat completions and Bedrock Mantle cost cases - [PR #46154](https://github.com/BerriAI/litellm/pull/46154)
- Add tier 1 gpt `cache_read` cases and recapture `input_text` usage shapes - [PR #46623](https://github.com/BerriAI/litellm/pull/46623)
- Let `CostMapEntry` hold flex, priority and ultrafast cache and tier prices - [PR #46629](https://github.com/BerriAI/litellm/pull/46629)
- Add best-guess tier 1 cases for `vertex_ai` and `azure_ai` Claude and gpt-6 `cache_write_5m` - [PR #46687](https://github.com/BerriAI/litellm/pull/46687)
- Add tier 1 Claude Messages stream twins and recapture drifted usage shapes - [PR #46690](https://github.com/BerriAI/litellm/pull/46690)
- Add `azure_ai` `claude-haiku-5-5` cases and gpt-6 service tier cache prices - [PR #46694](https://github.com/BerriAI/litellm/pull/46694)
- Cover turn-2 usage shapes across bridged `previous_response_id`, cached streams and pass-through cache writes - [PR #46703](https://github.com/BerriAI/litellm/pull/46703)
- Cover custom deployment aliases, off-peak pricing, bridge usage shapes and duplicate spend rows - [PR #46708](https://github.com/BerriAI/litellm/pull/46708)
- Pin LiteLLM's own prompt count over a tool-call history when the stream carries no usage - [PR #46710](https://github.com/BerriAI/litellm/pull/46710)
- Assert the streamed `usage.cost` matches the spend row on every cost case - [PR #46762](https://github.com/BerriAI/litellm/pull/46762)

</details>

<details>
<summary>Translation test matrix (11)</summary>

- Add `claude-haiku-5-5` basic translation cases to the integration suite - [PR #45176](https://github.com/BerriAI/litellm/pull/45176)
- Add `StreamingTranslationTestCase` with a Claude Sonnet 5.5 chat completions case - [PR #46151](https://github.com/BerriAI/litellm/pull/46151)
- Share rich request and response templates across translation tests - [PR #46546](https://github.com/BerriAI/litellm/pull/46546)
- Recapture Bedrock Invoke `claude-sonnet-4-6` bases after a usage shape change - [PR #46579](https://github.com/BerriAI/litellm/pull/46579)
- Add `gpt-6-astra` translation cases - [PR #46580](https://github.com/BerriAI/litellm/pull/46580)
- Add `claude-fable-5-1` translation cases - [PR #46581](https://github.com/BerriAI/litellm/pull/46581)
- Share rich fixtures across Claude, GPT and Gemini providers in translation tests - [PR #46585](https://github.com/BerriAI/litellm/pull/46585)
- Compare coding-agent response contracts across model tiers - [PR #46597](https://github.com/BerriAI/litellm/pull/46597)
- Cover response contracts across translation endpoints - [PR #46632](https://github.com/BerriAI/litellm/pull/46632)
- Add a `claude-sonnet-5-5` Anthropic Messages `service_tier` case - [PR #46678](https://github.com/BerriAI/litellm/pull/46678)
- Recapture Azure `gpt-6-astra` content filters - [PR #46691](https://github.com/BerriAI/litellm/pull/46691)

</details>

<details>
<summary>Test suite migration (11)</summary>

- Move offline router, retry and latency tests from `local_testing` to `tests/unit` - [PR #45551](https://github.com/BerriAI/litellm/pull/45551)
- Move offline logging, secret manager and provider tests from legacy directories to `tests/unit` - [PR #45554](https://github.com/BerriAI/litellm/pull/45554)
- Move offline proxy auth, hook, spend and pass-through tests to `tests/unit` - [PR #45568](https://github.com/BerriAI/litellm/pull/45568)
- Move offline Anthropic prompt caching tests to `tests/unit` - [PR #45616](https://github.com/BerriAI/litellm/pull/45616)
- Migrate SDK and proxy-booting legacy CircleCI tests to their tiers - [PR #45758](https://github.com/BerriAI/litellm/pull/45758)
- Migrate `tests/llm_translation` into the unit, integration and e2e tiers - [PR #45759](https://github.com/BerriAI/litellm/pull/45759)
- Migrate `local_testing` SDK and provider tests out of `build_and_test` - [PR #45760](https://github.com/BerriAI/litellm/pull/45760)
- Move routing, caching and callback tests out of `local_testing` - [PR #45761](https://github.com/BerriAI/litellm/pull/45761)
- Migrate legacy proxy access-check, schema migration and MCP tests to the new tiers - [PR #45937](https://github.com/BerriAI/litellm/pull/45937)
- Migrate `tests/proxy_behavior` into the integration and unit tiers - [PR #45939](https://github.com/BerriAI/litellm/pull/45939)
- Migrate legacy unit directories and unrun folders into `tests/unit`, `tests/integration` and `tests/e2e` - [PR #45940](https://github.com/BerriAI/litellm/pull/45940)

</details>

<details>
<summary>Unit tests (7)</summary>

- Add a unit test that SDK-echoed null `tool_calls` never reach the Headroom `/v1/compress` call - [PR #39667](https://github.com/BerriAI/litellm/pull/39667)
- Wait on conditions instead of wall-clock time in guardrail parallelism and scope-option tests - [PR #45571](https://github.com/BerriAI/litellm/pull/45571)
- Let the cold concurrent schema validation test set its own timeout so it stops flaking on a single CPU core - [PR #46184](https://github.com/BerriAI/litellm/pull/46184)
- Wait on the work itself instead of fixed sleeps in unit tests - [PR #46261](https://github.com/BerriAI/litellm/pull/46261)
- Cover the OTel V2 `otel` callback on `/health/services` - [PR #46394](https://github.com/BerriAI/litellm/pull/46394)
- Baseline breaker metrics from live state after gc in the Redis cache tests - [PR #46652](https://github.com/BerriAI/litellm/pull/46652)
- Wait for the wedged Redis to be reached instead of a fixed 0.1s sleep in the team roster sync tests - [PR #46727](https://github.com/BerriAI/litellm/pull/46727)

</details>

<details>
<summary>Contributor tooling (7)</summary>

- Ignore `.mypy_cache` in git - [Commit 0519882](https://github.com/BerriAI/litellm/commit/0519882fefb99250aa441d3179363d1acec2172b)
- Load nested `AGENTS.md` files as Greptile review context scoped to their directories - [PR #45636](https://github.com/BerriAI/litellm/pull/45636)
- Ban semicolons and colons in human-facing text in the AGENTS.md files - [PR #45684](https://github.com/BerriAI/litellm/pull/45684)
- Remove committed PR screenshots from the repo - [PR #45816](https://github.com/BerriAI/litellm/pull/45816)
- Drop Greptile from the PR template, `AGENTS.md` and CI - [PR #46013](https://github.com/BerriAI/litellm/pull/46013)
- Steer tests away from implementation details and deliberate reverts in AGENTS.md - [PR #46317](https://github.com/BerriAI/litellm/pull/46317)
- Update the `CODEOWNERS` entry for a maintainer handle - [PR #46452](https://github.com/BerriAI/litellm/pull/46452)

</details>

<details>
<summary>Superseded within this release (3)</summary>

- Serve the bundled `whats_new.json` on Home by default, replaced before the cut by the blog-sourced What's new cards that already shipped in v1.106.0 - [PR #45934](https://github.com/BerriAI/litellm/pull/45934)
- Add `azure_ai/claude-fable-5-5`, removed again by a later PR in this release - [PR #46201](https://github.com/BerriAI/litellm/pull/46201)
- Remove `azure_ai/claude-fable-5-5` again because Azure does not list the model - [PR #46428](https://github.com/BerriAI/litellm/pull/46428)

</details>

### PR roll-up by ownership area

Customer-facing changes: **382**. Tests, CI and internal changes: **218**. Total: **600**

- Other (tests, CI, internal): 218
- Models & Providers: 109
- LLM API Endpoints: 65
- Auth & Management: 45
- UI: 35
- Spend / Budgets / Rate Limits: 34
- Performance: 33
- MCP: 27
- Logging & Tracing: 20
- Guardrails: 13
- Docs: 1

## New Contributors

- [@Acacian](https://github.com/Acacian) made their first contribution in [PR #41528](https://github.com/BerriAI/litellm/pull/41528)
- [@adityajoy-1902](https://github.com/adityajoy-1902) made their first contribution in [PR #42079](https://github.com/BerriAI/litellm/pull/42079)
- [@airia-open-source](https://github.com/airia-open-source) made their first contribution in [PR #40784](https://github.com/BerriAI/litellm/pull/40784)
- [@akram1089](https://github.com/akram1089) made their first contribution in [PR #43594](https://github.com/BerriAI/litellm/pull/43594)
- [@Apeksha9389](https://github.com/Apeksha9389) made their first contribution in [PR #46471](https://github.com/BerriAI/litellm/pull/46471)
- [@Arjun-Aravind](https://github.com/Arjun-Aravind) made their first contribution in [PR #45437](https://github.com/BerriAI/litellm/pull/45437)
- [@Aryan-Pardeshi](https://github.com/Aryan-Pardeshi) made their first contribution in [PR #36460](https://github.com/BerriAI/litellm/pull/36460)
- [@debanshd](https://github.com/debanshd) made their first contribution in [PR #41683](https://github.com/BerriAI/litellm/pull/41683)
- [@ErenAta16](https://github.com/ErenAta16) made their first contribution in [PR #34653](https://github.com/BerriAI/litellm/pull/34653)
- [@jsvisa](https://github.com/jsvisa) made their first contribution in [PR #46021](https://github.com/BerriAI/litellm/pull/46021)
- [@le-shi](https://github.com/le-shi) made their first contribution in [PR #32599](https://github.com/BerriAI/litellm/pull/32599)
- [@link89](https://github.com/link89) made their first contribution in [PR #40825](https://github.com/BerriAI/litellm/pull/40825)
- [@marcusgreer](https://github.com/marcusgreer) made their first contribution in [PR #45410](https://github.com/BerriAI/litellm/pull/45410)
- [@matthowardcohere](https://github.com/matthowardcohere) made their first contribution in [PR #46274](https://github.com/BerriAI/litellm/pull/46274)
- [@mayank-affirm](https://github.com/mayank-affirm) made their first contribution in [PR #41747](https://github.com/BerriAI/litellm/pull/41747)
- [@narmstrong-berri](https://github.com/narmstrong-berri) made their first contribution in [PR #46492](https://github.com/BerriAI/litellm/pull/46492)
- [@rameswaran-mohan](https://github.com/rameswaran-mohan) made their first contribution in [PR #41670](https://github.com/BerriAI/litellm/pull/41670)
- [@Raushankumar0720](https://github.com/Raushankumar0720) made their first contribution in [PR #42887](https://github.com/BerriAI/litellm/pull/42887)
- [@RonP3](https://github.com/RonP3) made their first contribution in [PR #43791](https://github.com/BerriAI/litellm/pull/43791)
- [@ryuto-takemoto](https://github.com/ryuto-takemoto) made their first contribution in [PR #44544](https://github.com/BerriAI/litellm/pull/44544)
- [@setarm01](https://github.com/setarm01) made their first contribution in [PR #46197](https://github.com/BerriAI/litellm/pull/46197)
- [@shubhamjain0594](https://github.com/shubhamjain0594) made their first contribution in [PR #45579](https://github.com/BerriAI/litellm/pull/45579)
- [@soham96](https://github.com/soham96) made their first contribution in [PR #44167](https://github.com/BerriAI/litellm/pull/44167)
- [@sukhdeepjohar](https://github.com/sukhdeepjohar) made their first contribution in [PR #45107](https://github.com/BerriAI/litellm/pull/45107)
- [@Sushit-prog](https://github.com/Sushit-prog) made their first contribution in [PR #38284](https://github.com/BerriAI/litellm/pull/38284)
- [@TaylorHawkes](https://github.com/TaylorHawkes) made their first contribution in [PR #41669](https://github.com/BerriAI/litellm/pull/41669)
- [@thementalcoding](https://github.com/thementalcoding) made their first contribution in [PR #43710](https://github.com/BerriAI/litellm/pull/43710)
- [@VimarshDwivedi](https://github.com/VimarshDwivedi) made their first contribution in [PR #46184](https://github.com/BerriAI/litellm/pull/46184)
- [@WongAnneLister](https://github.com/WongAnneLister) made their first contribution in [PR #36346](https://github.com/BerriAI/litellm/pull/36346)
- [@yuefdev](https://github.com/yuefdev) made their first contribution in [PR #41677](https://github.com/BerriAI/litellm/pull/41677)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.106.0-rc.1...v1.107.0-rc.1
