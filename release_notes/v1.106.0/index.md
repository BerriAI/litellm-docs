---
title: "LiteLLM v1.106.0 adds Claude Haiku 5.5, a Rust Lens service and MCP rate limits"
description: "Adds Claude Haiku 5.5 on day one, a standalone Rust Lens service and MCP rate limits on every operation. MCP servers no longer get the caller's key."
slug: "v1-106-0"
date: 2026-10-18T05:53:32
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
docker.litellm.ai/berriai/litellm:1.106.0
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.106.0
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.106.0`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.106.0) and the full [releases page](https://github.com/BerriAI/litellm/releases)

These notes cover everything since `v1.105.0`. Changes added to the release line after rc.1, through rc.4 and the fixes backported before the stable tag, are under [Included after the v1.106.0-rc.1 cut](#included-after-the-v11060-rc1-cut)

Customer-facing changes come first. Test, CI and internal changes are listed at the bottom

:::danger Breaking Changes

These callouts cover user-facing behavior that differs from `v1.105.0`, the previous stable release

**The response cache skips requests with more than 4 messages by default.** The new `cache_params.max_messages` defaults to 4, so longer conversations and Responses inputs are neither looked up nor stored, exact or semantic. Raise it, or set it to `null` to remove the limit. See [PR #43878](https://github.com/BerriAI/litellm/pull/43878)

**Responses WebSocket sessions are capped at 60 minutes by default.** Sessions on `/v1/responses` close with code 1000 after `general_settings.responses_websocket_session_limit_seconds` (default 3600, maximum 7200), idle or not. The old 30 second first-message timeout is gone. See [PR #44433](https://github.com/BerriAI/litellm/pull/44433)

**The caller's LiteLLM key is never forwarded to MCP servers**, including `x-litellm-api-key` configured under a server's Extra Headers. Give upstream servers their own credential through a static header or OAuth. See [PR #45401](https://github.com/BerriAI/litellm/pull/45401)

**`PATCH /credentials/{name}` no longer renames a credential.** A different `credential_name` returns 400. Use the new `display_name` to relabel a credential, or create a new one to change its name. See [PR #43148](https://github.com/BerriAI/litellm/pull/43148)

**Decisions requests that send media a model cannot read now return 400.** `images` on `/v1/systemone`, `audio` and `videos` on either route, and TypeSafe `assets` used to be dropped with a 200. They now return 400 naming the field unless `drop_params` is set, and OpenAI decision models now receive System One `images`, which are billed. See [PR #46628](https://github.com/BerriAI/litellm/pull/46628)

**`/v1/responses/compact` now checks `previous_response_id` the same way `/v1/responses` does.** Another user's or team's id returns 403, and so does an id the proxy never issued unless `general_settings.allow_unmanaged_response_ids` is `true`. Ids handed out by the websocket `/v1/responses` route are refused for every key. See [PR #46827](https://github.com/BerriAI/litellm/pull/46827)

:::

## Key Highlights

- **New models on day one**: Claude Haiku 5.5 across Anthropic, Bedrock, Bedrock Mantle, Vertex AI, Azure AI and Perplexity, Kimi K3 and GLM 5.3 on Bedrock, Mistral Large 4, and Gemini Nano Banana 2.1, among 59 new catalog entries
- **Lens as a standalone Rust service**: trace ingestion and investigations move out of the gateway, with always-on investigations, a Findings inbox, signals, end-user feedback and datasets built from real traces
- **Admin UI Home page**: the dashboard opens on a Home page with a usage summary, recent launches, blog updates and a model leaderboard, alongside a Decisions tab in the Playground, a redesigned Usage page and a Cmd+K command palette
- **More Decisions providers and media**: Laya, Bespoke Nimble and Databricks serve Decisions and act as Auto Router classifiers, Cloudflare Clef reads images, Clef-omni reads audio and video, and TypeSafe Jev 1.14 takes images. Reka joins as an OpenAI-compatible provider
- **MCP Gateway controls**: rate limits cover every MCP operation with a new server-level rpm, OAuth adds Client ID Metadata Document support, and the caller's LiteLLM key is never forwarded upstream
- **Observability**: Arize on OTel v2 works per team, Prometheus can cap series per metric, and `litellm.agent()` gains an in-process tool-calling loop

## Included after the v1.106.0-rc.1 cut

- Cloudflare Clef reads images on both Decisions routes, the new `cloudflare/clef-omni` reads audio and video, and TypeSafe Jev 1.14 (`typesafe/jev-1.14.0`) takes images through `assets`, `box` questions and the opt-in `TypeSafe-Danger-Zone-*` headers (rc.4) - [PR #46628](https://github.com/BerriAI/litellm/pull/46628)
- Deployments can set `model_info.mode: decisions`, which behaves the same as `mode: evaluation` for health checks and the Admin UI (rc.4) - [PR #46628](https://github.com/BerriAI/litellm/pull/46628)
- Home page What's new cards show the newest LiteLLM blog posts tagged `day 0 support`, so new launches appear without a proxy upgrade (rc.2) - [PR #46309](https://github.com/BerriAI/litellm/pull/46309)
- The yes / no Decisions answer type is labelled "Yes / No" instead of `noul` (rc.2) - [PR #45933](https://github.com/BerriAI/litellm/pull/45933)
- Setting `custom_prometheus_metadata_labels: ["project_alias"]` no longer breaks the project per-model rate limit gauges or skips the other metrics for project keys (rc.3) - [PR #46491](https://github.com/BerriAI/litellm/pull/46491)
- `streaming_buffer_until_moderated: true` on the Decision Model guardrail holds a streamed answer until the decision model passes it (rc.3) - [PR #46383](https://github.com/BerriAI/litellm/pull/46383)
- `/v1/responses/compact` works with the caller's own `previous_response_id`, which used to fail with a 400 from OpenAI - [PR #46827](https://github.com/BerriAI/litellm/pull/46827)
- Redis Cluster with `max_connections` set waits for a free connection under load instead of switching Redis off for 60 seconds - [PR #47006](https://github.com/BerriAI/litellm/pull/47006)

## New Providers and Endpoints

### New Providers (3 new providers)

| Provider | Supported LiteLLM Endpoints | Description |
| --- | --- | --- |
| Reka | `/v1/chat/completions`, `/v1/responses`, `/v1/messages` | Reka as an OpenAI-compatible provider under `reka/`, with Responses and Messages bridged to its chat completions |
| Laya | `/v1/decisions`, Auto Router | Laya decision models and an OSS classifier for the Auto Router |
| Bespoke | `/v1/systemone`, Auto Router | Bespoke Nimble decision models and an OSS classifier for the Auto Router |

### Expanded provider endpoint support

| Provider | Endpoint | What you can do |
| --- | --- | --- |
| [Databricks](../../docs/providers/databricks) | `/v1/decisions`, Auto Router | Call Databricks `ai_decide` as a Decisions provider and Auto Router classifier |

## New Models / Updated Models

#### New Model Support (59 new models)

Counts represent new catalog identifiers compared with `v1.105.0`, including aliases and regional variants. Prices below are the values bundled in this release, in USD; runtime pricing-map reloads can update them. Input and output columns show base token rates; long-context, cache, image-token, and other specialized rates depend on the model

| Provider | Model | Context Window | Input ($/1M tokens) | Output ($/1M tokens) | Features / special pricing |
| --- | --- | --- | --- | --- | --- |
| Amazon Bedrock | `amazon.nova-2-5-sonic` | - | $0.33 | $2.75 | Realtime; `input_cost_per_audio_token`: $3/1M; `output_cost_per_audio_token`: $12/1M |
| Amazon Bedrock | `anthropic.claude-haiku-5-5` | 1,000,000 | $0.1 | $0.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `apac.anthropic.claude-haiku-5-5` | 1,000,000 | $0.11 | $0.55 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `au.anthropic.claude-haiku-5-5` | 1,000,000 | $0.11 | $0.55 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `bedrock/us-gov-east-1/anthropic.claude-haiku-5-5` | 1,000,000 | $0.12 | $0.6 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `bedrock/us-gov-west-1/anthropic.claude-haiku-5-5` | 1,000,000 | $0.12 | $0.6 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `eu.anthropic.claude-haiku-5-5` | 1,000,000 | $0.11 | $0.55 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `global.anthropic.claude-haiku-5-5` | 1,000,000 | $0.1 | $0.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `global.twelvelabs.pegasus-1-5-v1:0` | 98,304 | - | $7.5 | Chat; `input_cost_per_video_per_second`: $0.00049 |
| Amazon Bedrock | `global.zai.glm-5.3` | 1,000,000 | $1.68 | $5.28 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Amazon Bedrock | `in.moonshotai.kimi-k3` | 1,000,000 | $3.3 | $16.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Amazon Bedrock | `jp.anthropic.claude-haiku-5-5` | 1,000,000 | $0.11 | $0.55 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `us-gov.anthropic.claude-haiku-5-5` | 1,000,000 | $0.12 | $0.6 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `us.anthropic.claude-haiku-5-5` | 1,000,000 | $0.11 | $0.55 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `us.twelvelabs.pegasus-1-5-v1:0` | 98,304 | - | $7.5 | Chat; `input_cost_per_video_per_second`: $0.00049 |
| Amazon Bedrock | `us.zai.glm-5.3` | 1,000,000 | $1.848 | $5.808 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Anthropic | `claude-haiku-5-5` | 1,000,000 | $0.1 | $0.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; Computer use |
| Azure AI | `azure_ai/claude-haiku-5-5` | 1,000,000 | $0.1 | $0.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Azure AI | `azure_ai/grok-4.7` | 500,000 | $2 | $6 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search |
| Azure AI | `azure_ai/kimi-k2-thinking` | 262,144 | $0.6 | $2.5 | Chat; Reasoning; Tool calling |
| Azure OpenAI | `azure/apac/gpt-6.1-sol` | 922,000 | $2.4 | $12 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; Computer use |
| Azure OpenAI | `azure/eu/gpt-6.1-sol` | 922,000 | $2.4 | $12 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; Computer use |
| Azure OpenAI | `azure/model-router` | 200,000 | $0.14 | $0 | Chat; Vision |
| Azure OpenAI | `azure/us/gpt-6.1-sol` | 922,000 | $2.2 | $11 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; Computer use |
| Azure OpenAI | `azure/whisper` | - | - | - | Transcription; `input_cost_per_second`: $0.0001; `output_cost_per_second`: $0.0001 |
| Bedrock Mantle | `bedrock_mantle/anthropic.claude-haiku-5-5` | 1,000,000 | $0.11 | $0.55 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Bedrock Mantle | `bedrock_mantle/us-gov-west-1/anthropic.claude-haiku-5-5` | 1,000,000 | $0.12 | $0.6 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Bespoke | `bespoke/bespokelabs/Bespoke-Nimble-9B` | 8,192 | $0 | $0 | Decisions |
| Bespoke | `bespoke/nimble` | 8,192 | $0 | $0 | Decisions |
| Bespoke | `bespoke/nimble-latest` | 8,192 | $0 | $0 | Decisions |
| ChatGPT | `chatgpt/gpt-6-astra` | 922,000 | - | - | Responses; Reasoning; Vision; Tool calling; Structured output |
| ChatGPT | `chatgpt/gpt-6-luna` | 922,000 | - | - | Responses; Reasoning; Vision; Tool calling; Structured output |
| ChatGPT | `chatgpt/gpt-6-sol` | 922,000 | - | - | Responses; Reasoning; Vision; Tool calling; Structured output |
| ChatGPT | `chatgpt/gpt-6.1-sol` | 922,000 | - | - | Responses; Reasoning; Vision; Tool calling; Structured output |
| Cohere | `cohere/embed-v5.0-fast` | 128,000 | $0.08 | $0 | Embedding |
| Cohere | `cohere/embed-v5.0-pro` | 128,000 | $0.12 | $0 | Embedding |
| Databricks | `databricks/databricks-openjev-qwen35-4b` | - | $0 | $0 | Decisions |
| Gemini | `gemini/gemini-nano-banana-2.1` | 131,072 | $1.5 | $7.5 | Image generation; Reasoning; Vision; PDF input; Web search; `output_cost_per_image`: $0.0336; `output_cost_per_image_token`: $30/1M |
| Laya | `laya/english` | - | $0 | $0 | Decisions |
| Laya | `laya/multilingual` | - | $0 | $0 | Decisions |
| Laya | `laya/typed-decisions` | - | $0 | $0 | Decisions |
| Mistral | `mistral/mistral-large-4` | 1,048,576 | $0.68 | $2.09 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Mistral | `mistral/mistral-large-4-0` | 1,048,576 | $0.68 | $2.09 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| OpenRouter | `openrouter/anthropic/claude-haiku-5.5` | 1,000,000 | $0.1 | $0.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/anthropic/claude-haiku-5.5:batch` | 1,000,000 | $0.05 | $0.25 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/google/gemini-nano-banana-2.1` | 65,536 | $1.5 | $7.5 | Chat; Reasoning; Vision; Tool calling; Structured output; Web search; `output_cost_per_image_token`: $30/1M |
| OpenRouter | `openrouter/inclusionai/ling-3.0-flash-sante` | 262,144 | $0.042 | $0.1232 | Chat; Reasoning; Tool calling; Prompt caching |
| OpenRouter | `openrouter/inclusionai/ling-3.1-flash` | 262,144 | $0 | $0 | Chat; Reasoning; Tool calling |
| OpenRouter | `openrouter/mistralai/mistral-large-4-0` | 1,048,576 | $0.68 | $2.09 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| OpenRouter | `openrouter/openai/gpt-image-2` | - | $5 | - | Image generation; Vision; `input_cost_per_image_token`: $8/1M; `output_cost_per_image_token`: $30/1M |
| OpenRouter | `openrouter/openai/gpt-image-2.5-flare` | - | $5 | - | Image generation; Vision; `input_cost_per_image_token`: $8/1M; `output_cost_per_image_token`: $30/1M |
| OpenRouter | `openrouter/openai/gpt-image-2.5-sunburst` | - | $5 | - | Image generation; Vision; `input_cost_per_image_token`: $8/1M; `output_cost_per_image_token`: $30/1M |
| OpenRouter | `openrouter/stepfun/step-5-preview` | 1,000,000 | $1 | $2.7 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Perplexity | `perplexity/anthropic/claude-haiku-5-5` | - | $0.1 | $0.5 | Responses; Tool calling; Web search |
| Vertex AI | `gemini-nano-banana-2.1` | 131,072 | $1.5 | $7.5 | Image generation; Reasoning; Vision; Prompt caching; PDF input; Web search; `input_cost_per_image`: $0.00168; `output_cost_per_image`: $0.0336 |
| Vertex AI | `vertex_ai/claude-haiku-5-5` | 1,000,000 | $0.1 | $0.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Vertex AI | `vertex_ai/claude-haiku-5-5@default` | 1,000,000 | $0.1 | $0.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Vertex AI | `vertex_ai/gemini-nano-banana-2.1` | 131,072 | $1.5 | $7.5 | Image generation; Reasoning; Vision; Prompt caching; PDF input; Web search; `input_cost_per_image`: $0.00168; `output_cost_per_image`: $0.0336 |
| xAI | `xai/grok-imagine-video-1.5-lite` | - | - | - | Video generation; `input_cost_per_image`: $0.01; `output_cost_per_second`: $0.02 |

### New providers

- Add Reka as an OpenAI-compatible provider under the `reka/` prefix, reading `REKA_API_KEY` and `REKA_API_BASE`, listed in the Add Model form, with `/v1/responses` and `/v1/messages` bridged to its chat completions - [PR #44278](https://github.com/BerriAI/litellm/pull/44278)

### Decisions providers

- Add Bespoke Nimble as a Decisions provider behind `BESPOKE_API_BASE`, served on `POST /bespoke/v1/systemone` and selectable as the Auto Router OSS Classifier - [PR #44246](https://github.com/BerriAI/litellm/pull/44246)
- Add Databricks `ai_decide` as a `/v1/decisions` provider and Auto Router classifier (`opensource_classifier_config.provider: databricks`), keyed by `DATABRICKS_API_KEY` or `DATABRICKS_TOKEN`, with a Databricks option in the Add Auto Router form - [PR #45200](https://github.com/BerriAI/litellm/pull/45200)
- Add Laya as a Decisions provider and Auto Router OSS classifier: routers set `classifier_type: oss_classifier` with `opensource_classifier_config.provider: laya` (or `jev` for Jev-compatible self-hosted classifiers), and existing Jev configurations keep working - [PR #43626](https://github.com/BerriAI/litellm/pull/43626)

### Amazon Bedrock

- Route `bedrock_mantle/anthropic.claude-*` chat completions to Mantle's native Messages endpoint, and price Mantle calls from their own `bedrock_mantle/` cost-map row when one exists - [PR #43646](https://github.com/BerriAI/litellm/pull/43646)
- Add an `anthropic_messages` health check mode, used by default for Bedrock Mantle Claude deployments, so they stop showing unhealthy on `/health` and Test Connect - [PR #44419](https://github.com/BerriAI/litellm/pull/44419)
- Count tokens for Claude Opus 4.8, 5 and 5.5 on Bedrock Mantle when bedrock-runtime cannot count them, instead of falling back to the local tokenizer - [PR #45317](https://github.com/BerriAI/litellm/pull/45317)
- Send the project id to Bedrock Mantle as the documented `anthropic-workspace-id` header, so `aws_bedrock_project_id` takes effect - [PR #44173](https://github.com/BerriAI/litellm/pull/44173)
- Honor the per-request `timeout` on Converse and Invoke streaming calls - [PR #44134](https://github.com/BerriAI/litellm/pull/44134)
- Drop lookaround regex patterns from tool schemas for Converse models that reject them (Kimi K3, Grok 4.6 and 4.7), controlled by the new `supports_regex_lookaround` cost-map and `model_info` flag - [PR #44138](https://github.com/BerriAI/litellm/pull/44138)
- Stop sending Converse `cachePoint` blocks to Kimi K3, gated by a new `supports_prompt_cache_breakpoint` flag - [PR #44292](https://github.com/BerriAI/litellm/pull/44292)
- Drop or reject reasoning effort levels a Bedrock GPT model does not support, following `drop_params`, instead of forwarding them for a Bedrock 400 - [PR #44183](https://github.com/BerriAI/litellm/pull/44183)
- Split a leading `<reasoning>` tag out of the answer only for gpt-oss on native Chat Completions, so GPT 5.6 and Grok answers keep it - [PR #44432](https://github.com/BerriAI/litellm/pull/44432)
- Forward each Nova Sonic assistant sentence once over the realtime API instead of twice - [PR #44987](https://github.com/BerriAI/litellm/pull/44987)
- Report Scheduled Bedrock batch jobs as `in_progress` on retrieve instead of `validating` - [PR #45157](https://github.com/BerriAI/litellm/pull/45157)
- A converse-stream 200 made only of unrecognized event frames now ends as a 502 naming the event types, and frames named after a Bedrock exception raise with that exception's status, instead of returning a blank `end_turn` at $0 - [PR #44112](https://github.com/BerriAI/litellm/pull/44112)
- Send OpenAI explicit prompt cache breakpoints for Bedrock Mantle GPT-5.6 and newer, honor `supports_prompt_cache_breakpoint` set on a deployment, and stop malformed `cache_control_injection_points` from failing every request with a 500 - [PR #38729](https://github.com/BerriAI/litellm/pull/38729)

### Anthropic

- Stop repeating streamed thinking text in the signature chunk, so saved and replayed thinking blocks carry the text once - [PR #44127](https://github.com/BerriAI/litellm/pull/44127)
- Forward the `inline-tools-2026-09-15` beta header to Anthropic and Vertex AI, so mid-session tool changes no longer fail with a 400 - [PR #45297](https://github.com/BerriAI/litellm/pull/45297)
- Fail a token-file or inline-token federation credential that is missing its rule or organization id with a 401 naming the missing id - [PR #45178](https://github.com/BerriAI/litellm/pull/45178)
- Pass a leading system message through count_tokens' `system` parameter, so `/v1/responses/input_tokens` with `instructions` and `/v1/messages/count_tokens` get Anthropic's count - [PR #45463](https://github.com/BerriAI/litellm/pull/45463)
- Normalize images before provider token counting on Anthropic and Azure AI Anthropic - [PR #45185](https://github.com/BerriAI/litellm/pull/45185)
- Anthropic: workload identity federation with short-lived tokens minted from an OIDC assertion (token file, env token, LiteLLM-signed issuer or Keycloak), set up through config, env vars or a named credential, plus `GET /credentials/{name}/jwks` - [PR #44448](https://github.com/BerriAI/litellm/pull/44448)

### ChatGPT and GitHub Copilot

- Refuse to start the ChatGPT or GitHub Copilot device-code login inside a proxy request, answering 400 instead of freezing the worker for up to 15 minutes - [PR #39585](https://github.com/BerriAI/litellm/pull/39585)
- Honor the caller's `stream` flag on `chatgpt/*` models, so non-streaming `/v1/responses`, `/v1/chat/completions` and `/v1/messages` calls return JSON instead of raw SSE or a 500 - [PR #41235](https://github.com/BerriAI/litellm/pull/41235)
- Preserve the requested `service_tier` on ChatGPT Responses calls, mapping `fast` to `priority` - [PR #40108](https://github.com/BerriAI/litellm/pull/40108)
- Add `chatgpt/` catalog rows for `gpt-6-sol`, `gpt-6-luna`, `gpt-6-astra` and `gpt-6.1-sol`, so chat completions calls to them go through the Responses bridge - [PR #44758](https://github.com/BerriAI/litellm/pull/44758)

### Exa AI

- Fall back to highlights or summary for the search result snippet when Exa returns no `text` - [PR #42213](https://github.com/BerriAI/litellm/pull/42213)

### Fireworks AI

- Add the `fireworks_forward_user_id` deployment setting, which sends the key's LiteLLM user id to Fireworks as `user` on chat completions, Responses and Messages - [PR #45265](https://github.com/BerriAI/litellm/pull/45265)

### Gemini and Vertex AI

- Stop replaying Claude thinking block signatures to Gemini, so mixed Claude and Gemini model groups no longer fail with `Invalid thought signature` - [PR #44661](https://github.com/BerriAI/litellm/pull/44661)
- Forward `system` and `tools` to Vertex partner model count_tokens, and fall back to the local tokenizer on a Vertex count error - [PR #43900](https://github.com/BerriAI/litellm/pull/43900)
- Dial the multi-region Live API host for Vertex realtime sessions with `vertex_location: us` or `eu`, and allow plain `ws://` api_base values - [PR #45166](https://github.com/BerriAI/litellm/pull/45166)
- Accept file content blocks with `video_metadata` (`fps`, `start_offset`, `end_offset`) on Gemini multimodal embeddings - [PR #45305](https://github.com/BerriAI/litellm/pull/45305)
- Apply the regional endpoint uplift on the Vertex image generation and edit cost path, and add a 1.1x uplift to `vertex_ai/gemini-3.1-flash-image` - [PR #44679](https://github.com/BerriAI/litellm/pull/44679), [PR #44673](https://github.com/BerriAI/litellm/pull/44673)

### Mistral

- Add Mistral Large 4 (`mistral/mistral-large-4`, `mistral/mistral-large-4-0`) with a 524,288-token context window, pricing, prompt caching and reasoning - [PR #44870](https://github.com/BerriAI/litellm/pull/44870)

### OCI

- Resolve the OCI GenAI endpoint realm from the compartment OCID, so Government realm regions such as `us-luke-1` reach `oci.oraclegovcloud.com` - [PR #43180](https://github.com/BerriAI/litellm/pull/43180)

### Ollama

- Turn streamed and fenced prompt-based JSON tool calls on `ollama/` models into real tool calls - [PR #45053](https://github.com/BerriAI/litellm/pull/45053)
- Answer in text after a tool result on `ollama/` models instead of repeating the tool call - [PR #45079](https://github.com/BerriAI/litellm/pull/45079)
- Use one id per `ollama/` stream, return 400 for non-text tool content, separate consecutive tool results, and drop the empty message item from Responses streams - [PR #45177](https://github.com/BerriAI/litellm/pull/45177)

### OpenAI

- Leave `model` off the upstream OpenAI URL for realtime `intent=transcription` sessions, which OpenAI rejected with `invalid_model` - [PR #43854](https://github.com/BerriAI/litellm/pull/43854)

### OpenAI-compatible providers

- Send provider attribution headers on the default SDK path, fixing Novita's `X-Novita-Source` and adding Perplexity's `X-Pplx-Integration` - [PR #44291](https://github.com/BerriAI/litellm/pull/44291)

### SAP

- Forward `cache_control` on SAP messages and tools, and stop sending `cache_control: null` that SAP rejected with a 400 - [PR #39122](https://github.com/BerriAI/litellm/pull/39122)

### Scaleway

- Add Scaleway rerank support on `/v1/rerank` - [PR #44160](https://github.com/BerriAI/litellm/pull/44160)

### VoyageAI by MongoDB

- Rename the Voyage AI provider to VoyageAI by MongoDB, and send MongoDB-issued `al-` keys to `ai.mongodb.com` for embeddings and rerank; the `voyage` provider id is unchanged - [PR #41812](https://github.com/BerriAI/litellm/pull/41812)

### Model catalog and pricing

- Add `claude-haiku-5-5` pricing, then consolidate its over-100k token rates and capability flags across providers, with corrected forced tool use and thinking flags on Azure AI and Vertex AI - [PR #45108](https://github.com/BerriAI/litellm/pull/45108), [PR #45151](https://github.com/BerriAI/litellm/pull/45151), [PR #45114](https://github.com/BerriAI/litellm/pull/45114), [PR #45116](https://github.com/BerriAI/litellm/pull/45116)
- Lower the Claude Sonnet 5.5 cache read price on Anthropic, Bedrock, Bedrock Mantle and Vertex AI - [PR #45113](https://github.com/BerriAI/litellm/pull/45113), [PR #45216](https://github.com/BerriAI/litellm/pull/45216), [PR #45223](https://github.com/BerriAI/litellm/pull/45223), [PR #45217](https://github.com/BerriAI/litellm/pull/45217)
- Add the US data residency multiplier to anthropic `claude-opus-5-5` - [PR #45078](https://github.com/BerriAI/litellm/pull/45078)
- Add OpenAI TTS and GPT-5.x deprecation dates - [PR #44175](https://github.com/BerriAI/litellm/pull/44175)
- Add openai gpt-6.1-sol ultrafast tier prices - [PR #45408](https://github.com/BerriAI/litellm/pull/45408)
- Add xAI grok-voice-transcribe-1.0 deprecation date - [PR #44237](https://github.com/BerriAI/litellm/pull/44237)
- Registry audit 2026-10-03, adding Cohere Embed v5, xAI grok-imagine-video-1.5-lite, OpenRouter GPT Image rows and Gemini 3.5 Transcribe limits - [PR #44376](https://github.com/BerriAI/litellm/pull/44376)
- Set Gemini Deep Research input limits, Vertex Gemini 3.6 and 3.7 Flash retirement dates, and Azure data zone gpt-6.1-sol pricing - [PR #44633](https://github.com/BerriAI/litellm/pull/44633)
- Add Bedrock flex prices, Anthropic web search flags, Gemini shutdown dates, OpenRouter alias fixes and Mistral Large 4 context - [PR #44910](https://github.com/BerriAI/litellm/pull/44910)
- Remove malformed, duplicate and decommissioned PaLM cost-map entries - [PR #44880](https://github.com/BerriAI/litellm/pull/44880)
- Correct `supported_endpoints` on Gemini and Vertex image rows and drop `/v1/batch` from `gemini/gemini-nano-banana-2.1` - [PR #44891](https://github.com/BerriAI/litellm/pull/44891), [PR #44940](https://github.com/BerriAI/litellm/pull/44940)
- Add gemini/gemini-nano-banana-2.1 from the Gemini pricing page - [PR #44868](https://github.com/BerriAI/litellm/pull/44868)
- Add Vertex AI gemini-nano-banana-2.1 and Nano Banana 2 priority pricing - [PR #44892](https://github.com/BerriAI/litellm/pull/44892)
- Add the priority tier audio input price to three Gemini rows - [PR #44632](https://github.com/BerriAI/litellm/pull/44632)
- Add a deprecation date to vertex_ai gemini-3.1-flash-lite-image - [PR #44639](https://github.com/BerriAI/litellm/pull/44639)
- Correct `input_cost_per_second` on Vertex gemini-3.5 transcribe-live and live-translate - [PR #45002](https://github.com/BerriAI/litellm/pull/45002)
- Mark Azure `us/` and `eu/` Responses-only models as `mode: responses`, so their chat completions calls are bridged to Azure Responses - [PR #44323](https://github.com/BerriAI/litellm/pull/44323)
- Add `max_input_tokens` to Azure MAI-Image and azure_ai/flux.2-pro rows, and set Azure text-embedding max input to 8192 - [PR #44375](https://github.com/BerriAI/litellm/pull/44375), [PR #44405](https://github.com/BerriAI/litellm/pull/44405), [PR #44449](https://github.com/BerriAI/litellm/pull/44449)
- Add azure_ai/kimi-k2-thinking and its retirement date - [PR #44382](https://github.com/BerriAI/litellm/pull/44382), [PR #44455](https://github.com/BerriAI/litellm/pull/44455)
- Add azure_ai/grok-4.7 and update the azure_ai/grok-4.6 input price - [PR #44937](https://github.com/BerriAI/litellm/pull/44937)
- Add azure gpt-6-sol priority processing prices - [PR #44829](https://github.com/BerriAI/litellm/pull/44829)
- Sync Azure OpenAI audio, realtime and image prices with the Azure pricing page - [PR #44992](https://github.com/BerriAI/litellm/pull/44992)
- Update Azure retirement dates for gpt-realtime-2.1, gpt-4o-realtime-preview-2024-10-01, jamba-instruct, gpt-4o-transcribe, kimi-k2.7-code and sora-2 - [PR #44526](https://github.com/BerriAI/litellm/pull/44526), [PR #44567](https://github.com/BerriAI/litellm/pull/44567), [PR #44585](https://github.com/BerriAI/litellm/pull/44585), [PR #44986](https://github.com/BerriAI/litellm/pull/44986), [PR #45355](https://github.com/BerriAI/litellm/pull/45355)
- Date azure_ai claude-opus-5-5 and claude-sonnet-5-5 and fill azure/eu/gpt-6-astra limits - [PR #45018](https://github.com/BerriAI/litellm/pull/45018)
- Price Bedrock Amazon Nova 2 Pro preview at the standard tier - [PR #44302](https://github.com/BerriAI/litellm/pull/44302)
- Add Bedrock priority and flex prices for Grok 4.3, 4.6, 4.7 and Kimi K3 - [PR #44670](https://github.com/BerriAI/litellm/pull/44670)
- Add Bedrock GLM 5.3 cross-region rows, Nova 2.5 Sonic and the Kimi K3 India cross-region row - [PR #44710](https://github.com/BerriAI/litellm/pull/44710), [PR #44990](https://github.com/BerriAI/litellm/pull/44990)
- Add Bedrock TwelveLabs Pegasus 1.5 inference profiles - [PR #45477](https://github.com/BerriAI/litellm/pull/45477)
- Update Bedrock GovCloud OpenAI prices, add the GPT-6 Astra ultrafast tier and the Titan Image v2 EOL date - [PR #45077](https://github.com/BerriAI/litellm/pull/45077)
- Add Bedrock gpt-6.1-sol ultrafast tier prices and its 1M context window - [PR #45482](https://github.com/BerriAI/litellm/pull/45482), [PR #45488](https://github.com/BerriAI/litellm/pull/45488)
- Take Bedrock and Bedrock Mantle context limits, output limits and EOL dates from the Bedrock model cards - [PR #45091](https://github.com/BerriAI/litellm/pull/45091), [PR #45409](https://github.com/BerriAI/litellm/pull/45409), [PR #45417](https://github.com/BerriAI/litellm/pull/45417)
- Add Bedrock deprecation dates for DeepSeek R1, Qwen3 Coder and Claude Sonnet 4.5 - [PR #45089](https://github.com/BerriAI/litellm/pull/45089), [PR #45496](https://github.com/BerriAI/litellm/pull/45496)
- Remove the bare Bedrock `xai.grok-4.7` and `openai.gpt-6.1-sol` rows that AWS cannot invoke, so `us.` profile ARNs bill at the `us.` price - [PR #45460](https://github.com/BerriAI/litellm/pull/45460), [PR #45479](https://github.com/BerriAI/litellm/pull/45479)
- Sync OpenRouter prices, limits and deprecation dates from the models API - [PR #44287](https://github.com/BerriAI/litellm/pull/44287), [PR #44466](https://github.com/BerriAI/litellm/pull/44466), [PR #44533](https://github.com/BerriAI/litellm/pull/44533), [PR #44975](https://github.com/BerriAI/litellm/pull/44975), [PR #45469](https://github.com/BerriAI/litellm/pull/45469)
- Update together_ai Kimi-K3 and Qwen3.8-Flash prices to published rates - [PR #44864](https://github.com/BerriAI/litellm/pull/44864)
- Update the baseten DeepSeek-V4.1-Flash-Fast cache read price and max output - [PR #45468](https://github.com/BerriAI/litellm/pull/45468)
- `litellm.supports_audio_output()` reads the `supports_audio_output` cost map key instead of `supports_audio_input` - [PR #45294](https://github.com/BerriAI/litellm/pull/45294)
- Azure: add `azure/model-router` pricing (the router's own $0.14 per 1M input token fee, charged on top of the routed model) and `azure/whisper` audio transcription pricing - [PR #44872](https://github.com/BerriAI/litellm/pull/44872)

## LLM API Endpoints

### Responses API

- Let Anthropic `/v1/responses` follow-ups with `previous_response_id` send a tool result plus `instructions` without a 400; a follow-up's `instructions` now replace the earlier turns' instead of stacking behind them - [PR #45322](https://github.com/BerriAI/litellm/pull/45322)
- Drop LiteLLM-minted reasoning items when replaying Responses history to OpenAI and Azure, so a conversation can switch from Claude to GPT - [PR #44132](https://github.com/BerriAI/litellm/pull/44132)
- Idle Responses WebSockets stay open instead of closing after 30s, and every session is capped by the new `general_settings.responses_websocket_session_limit_seconds` (default 3600, 60 to 7200) - [PR #44433](https://github.com/BerriAI/litellm/pull/44433)

### Chat Completions over the Responses API bridge

- Return a bridged reply's text and tool calls as one choice with `finish_reason: "tool_calls"`, so clients reading only `choices[0]` (e.g. Google ADK) run the tool; the gpt-5.4/5.5 routing change from the first attempt was reverted - [PR #44295](https://github.com/BerriAI/litellm/pull/44295), [PR #44344](https://github.com/BerriAI/litellm/pull/44344), [PR #44346](https://github.com/BerriAI/litellm/pull/44346)
- Keep `prompt_cache_breakpoint` markers on text, image and file blocks so tool-calling chats on gpt-5.6 get prompt-cache reads, and drop them when the model does not support breakpoints - [PR #44119](https://github.com/BerriAI/litellm/pull/44119)
- Keep cache breakpoints on blocks the bridge stringifies, drop malformed markers under `drop_params`, and accept the `ttl: "30m"` breakpoint field - [PR #40032](https://github.com/BerriAI/litellm/pull/40032)
- Send `input_audio` parts as Responses `input_audio` instead of billing the base64 as text; without `drop_params` the provider's own error now comes back - [PR #45224](https://github.com/BerriAI/litellm/pull/45224)
- Honor the request's `cache` controls (e.g. `"no-cache": true`) on chat completions bridged to the Responses API - [PR #44676](https://github.com/BerriAI/litellm/pull/44676)
- Surface the provider's `RateLimitError` instead of a nested `MidStreamFallbackError` when a bridged stream hits a 429 - [PR #44989](https://github.com/BerriAI/litellm/pull/44989)
- Report truncated bridged Responses output as `incomplete`, end those streams with `response.incomplete`, and echo request `temperature`, `top_p` and `max_output_tokens` - [PR #44460](https://github.com/BerriAI/litellm/pull/44460)

### Prompt caching

- Default gateway-injected prompt cache breakpoints to implicit lookup on `/v1/chat/completions`, `/v1/responses` and `/v1/messages`, and keep breakpoints through the chat to Responses bridge, so growing agent histories reuse earlier cached prefixes - [PR #42281](https://github.com/BerriAI/litellm/pull/42281), [PR #45121](https://github.com/BerriAI/litellm/pull/45121)
- Count client `cache_control` marks on assistant tool calls when injecting breakpoints, so Claude requests stay within the 4-breakpoint limit - [PR #43556](https://github.com/BerriAI/litellm/pull/43556)

### Batches and files

- Save file details for every batch output and error file, so they appear in `GET /v1/files` and Bedrock batch output files retrieve without a 500 - [PR #41761](https://github.com/BerriAI/litellm/pull/41761)

### Vector Stores

- Return LiteLLM managed file ids from `GET /v1/vector_stores/{id}/files`, so listed ids can be retrieved, deleted and used as `after` / `before` cursors - [PR #43800](https://github.com/BerriAI/litellm/pull/43800)

### Pass-through endpoints

- Use OpenAI workload identity federation tokens on `/openai_passthrough` and `/openai` when no static OpenAI key is set - [PR #44140](https://github.com/BerriAI/litellm/pull/44140)
- Resolve `oidc/` pass-through credentials on every request, so rotating projected Kubernetes service account tokens work for pass-through auth - [PR #44577](https://github.com/BerriAI/litellm/pull/44577)

### SDK

- Add `litellm.run_tool_loop()` and `litellm.arun_tool_loop()` to run a completion plus tool-execution loop until the model stops calling tools - [PR #44381](https://github.com/BerriAI/litellm/pull/44381)
- Build an independent `litellm-core` distribution from its own packaging manifest via `scripts/build_core_distribution.py`; legacy packaging is unchanged - [PR #44340](https://github.com/BerriAI/litellm/pull/44340)
- Add `Harness.TOOL_LOOP` to `litellm.agent()`, an in-process tool-calling loop over `litellm.acompletion()` that turns plain Python functions into tools from their type hints and docstrings, returns tool errors to the model, and supports `output=`, `permissions="ask"`, `max_turns`, sessions, cost and usage; gateway calls are tagged `harness,tool_loop` in spend logs - [PR #44391](https://github.com/BerriAI/litellm/pull/44391)
- Add a public `hidden_params` property on SDK response objects alongside `_hidden_params`, which keeps working; proxy response headers are unchanged - [PR #44668](https://github.com/BerriAI/litellm/pull/44668)

### General

- Local token counting prices a base64 PDF document per page (text plus rendered image) instead of as one image, so `count_tokens` fallbacks track the billed input - [PR #45301](https://github.com/BerriAI/litellm/pull/45301)
- `GET /v1/models?client_version=...` returns a Codex-native catalog, with `model_info.service_tiers` exposed per model so Codex can offer tiers like `/ultrafast`; the OpenAI list shape is unchanged without `client_version` - [PR #44136](https://github.com/BerriAI/litellm/pull/44136)
- `GET /v1/models` with `check_provider_endpoint: true` discovers upstream models for `litellm_proxy/*` and `hosted_vllm` wildcard deployments - [PR #38617](https://github.com/BerriAI/litellm/pull/38617)
- Return 400 naming the missing field instead of 500 on LLM routes, 400 for `page` or `page_size` below 1 on activity and vector store lists, and the provider's 404 for unknown video, eval, vector store and skill ids - [PR #43787](https://github.com/BerriAI/litellm/pull/43787)

## Management Endpoints / UI

### Admin UI

#### Home page

- New Home page at `/ui/home` is the dashboard root, with a 7-day usage strip, What's new launch cards, blog updates and a model leaderboard; logging in or opening `/ui` now lands on Home, and Virtual Keys keeps its sidebar entry and `/ui/api-keys` - [PR #45858](https://github.com/BerriAI/litellm/pull/45858)
- Home What's new cards show the three newest LiteLLM blog posts tagged `day 0 support`, and `/public/litellm_blog_posts` returns each post's tags and up to 50 posts - [PR #46309](https://github.com/BerriAI/litellm/pull/46309)

#### Playground and Decisions

- New Decisions tab in the Playground (`?tab=system-one`) for trying decision models on `/v1/decisions` or `/v1/systemone` with the session key or a virtual key, keeping a separate draft per endpoint and showing each choice, yes / no and score answer with its confidence plus usage and latency - [PR #44043](https://github.com/BerriAI/litellm/pull/44043), [PR #44664](https://github.com/BerriAI/litellm/pull/44664), [PR #45729](https://github.com/BerriAI/litellm/pull/45729), [PR #45817](https://github.com/BerriAI/litellm/pull/45817)
- Build decision requests in a Form tab, with an Input box and one card per question, instead of hand-writing the JSON body - [PR #45739](https://github.com/BerriAI/litellm/pull/45739)
- Pick one of four example presets (bug triage, support ticket routing, comment moderation, lead scoring) or Clear the request to start from empty; the picker reads Custom once the request is edited - [PR #45848](https://github.com/BerriAI/litellm/pull/45848)
- Label the yes / no question type "Yes / No" in the request form and the Add Model form, and explain it on hover - [PR #45841](https://github.com/BerriAI/litellm/pull/45841), [PR #45933](https://github.com/BerriAI/litellm/pull/45933)
- Decisions playground lays out the form first with a large Send button under it, shows results only once a request runs, and replaces the editable JSON tab with a read-only cURL tab showing the exact request - [PR #45903](https://github.com/BerriAI/litellm/pull/45903)
- Models + Endpoints shows a decision models banner in place of the cost optimization feedback banner, provider search finds decision model providers, and the playground model picker lists decision models - [PR #45735](https://github.com/BerriAI/litellm/pull/45735)

#### Models + Endpoints

- Add Tencent to the Add Model provider dropdown with its logo, an optional API base and a required API key - [PR #40924](https://github.com/BerriAI/litellm/pull/40924)
- Add Model lists only catalog models instead of also showing deployment aliases registered by custom pricing, using the new `catalog_only=true` option on `GET /public/litellm_model_cost_map` - [PR #44877](https://github.com/BerriAI/litellm/pull/44877)
- Show the Add Model model picker once the model catalog finishes loading, even when the provider was picked first - [PR #45426](https://github.com/BerriAI/litellm/pull/45426)
- Add the Evaluation mode (`Evaluation - /v1/decisions`) to the Add Model form so decision models can be added and tested from the UI; `POST /health/test_connection` now accepts `mode: "evaluation"` - [PR #45481](https://github.com/BerriAI/litellm/pull/45481)
- Decision models banner links to the supported providers docs in place of the Add a decision model button, and the dashboard calls the decisions playground Decisions instead of System One - [PR #45732](https://github.com/BerriAI/litellm/pull/45732)
- Drop the per-provider decision models sublabel from the Add Model provider dropdown - [PR #45755](https://github.com/BerriAI/litellm/pull/45755)
- Configure Anthropic workload identity federation from Add Credential, Edit Credential and Add Model, with federated credentials marked in the credentials table; Edit Credential now saves only the values the admin changed - [PR #44889](https://github.com/BerriAI/litellm/pull/44889)
- Configure OpenAI workload identity federation from LLM Credentials and Add Model, swapping API Key for Identity Provider ID, Service Account ID and Identity Token File - [PR #45528](https://github.com/BerriAI/litellm/pull/45528)

#### Auto-Routers

- Opt into cache-aware routing under auto-router Advanced settings, Sessions and efficiency, with optional output-token estimates and a prediction timeout - [PR #43396](https://github.com/BerriAI/litellm/pull/43396)
- Rename the Jev classifier to OSS Classifier and add Laya as a provider choice with checkpoint and timeout settings - [PR #43768](https://github.com/BerriAI/litellm/pull/43768)
- Auto-router setup groups classifier, tier and advanced settings; a Decisions Model classifier picks an onboarded decision model deployment, and tiers start prefilled with editable recommendations - [PR #45916](https://github.com/BerriAI/litellm/pull/45916)
- Add a per-router tokens, cost, cost per million tokens and savings table to Cost Optimization, Auto-Router, Usage, backed by new daily token records - [PR #45152](https://github.com/BerriAI/litellm/pull/45152)

#### Usage and Model Leaderboard

- Redesign the Usage page with a stat strip with sparklines, a stacked daily chart by model, a Top agents panel built from User-Agent tags on the admin global view, and a provider share bar, shared across the global, team, organization, tag and customer views - [PR #45221](https://github.com/BerriAI/litellm/pull/45221), [PR #45229](https://github.com/BerriAI/litellm/pull/45229)
- Move Key Activity search back to the top of the tab and add a model name search to Model Activity - [PR #44521](https://github.com/BerriAI/litellm/pull/44521)
- Model Leaderboard's Top models chart starts at the first day with usage so bars stay wide and readable - [PR #44249](https://github.com/BerriAI/litellm/pull/44249)
- Remove the Top models by task card from Model Leaderboard - [PR #44502](https://github.com/BerriAI/litellm/pull/44502)

#### Teams, users and access groups

- Keys declared in `team_metadata_schema` show as fixed labels in team metadata, with only the value editable - [PR #41482](https://github.com/BerriAI/litellm/pull/41482)
- The model picker in access group, team, organization and default user settings lists saved models that are no longer available in an Unavailable group so they can be removed - [PR #43944](https://github.com/BerriAI/litellm/pull/43944)
- Model access group chips on team and key pages link to the access group filter on Models + Endpoints - [PR #45402](https://github.com/BerriAI/litellm/pull/45402)
- Invitation and reset password links show in a read-only field with a Copy button beside them - [PR #44454](https://github.com/BerriAI/litellm/pull/44454)

#### Logs

- Logs tabs share page spacing, show refresh status in the toolbar and keep pagination at the bottom of full-height tables - [PR #44306](https://github.com/BerriAI/litellm/pull/44306)

#### General

- Add a Cmd+K (Ctrl+K) command palette and top bar search that finds virtual keys by alias or ID and jumps to any sidebar page - [PR #45456](https://github.com/BerriAI/litellm/pull/45456)
- LiteAdmin moves from the floating button into a header pill that opens a docked side panel, toggled with Cmd/Ctrl+J, and shows on the Playground again - [PR #44293](https://github.com/BerriAI/litellm/pull/44293)
- LiteAdmin is now enterprise-only - [PR #44399](https://github.com/BerriAI/litellm/pull/44399)
- Below 768px the sidebar starts hidden and opens over the page, and secondary header tools move into a More menu - [PR #44603](https://github.com/BerriAI/litellm/pull/44603)
- Add Moyai to the product switcher with a launch page and Quick connect, which issues Moyai a scoped virtual key; UI Settings shows the connection with a Disconnect button - [PR #45196](https://github.com/BerriAI/litellm/pull/45196)
- Restore the background blur behind dashboard modals - [PR #45877](https://github.com/BerriAI/litellm/pull/45877)

### Keys, teams and authentication

- Show Projects in the nav to org and team admins, scope `/project/list` and `/project/info` to the org admin's org, and offer Projects in the page-visibility picker - [PR #41325](https://github.com/BerriAI/litellm/pull/41325)
- Add `auto_register_map_existing_key` to `litellm_jwtauth` so a JWT user's first call reuses their existing virtual key instead of minting a second one (off by default) - [PR #42375](https://github.com/BerriAI/litellm/pull/42375)
- Limit which models an end user can call with a `models` list on `/customer/new`, `/customer/update` and `/customer/info`; calls outside it get 403 `customer_model_access_denied` - [PR #43904](https://github.com/BerriAI/litellm/pull/43904)
- Apply path-less SCIM group PATCH ops (Okta Push Groups renames) instead of storing them under an empty metadata key, and let affected teams save again in the UI - [PR #43978](https://github.com/BerriAI/litellm/pull/43978)
- Add opt-in `general_settings.vector_store_deny_by_default` so keys, teams and users can only query vector stores listed in their `object_permission` - [PR #44244](https://github.com/BerriAI/litellm/pull/44244)
- `disable_model_add_for_internal_users` now blocks team admins and opted-in members from creating models and auto routers through the API as well as the UI - [PR #44438](https://github.com/BerriAI/litellm/pull/44438)
- Add `denied_passthrough_routes` on keys and teams to carve sub-paths out of an `allowed_passthrough_routes` grant - [PR #44924](https://github.com/BerriAI/litellm/pull/44924)
- A team alias listed on an end user wins over a same-named key alias in the customer model check, matching routing - [PR #44677](https://github.com/BerriAI/litellm/pull/44677)
- Add `search_tool_deny_by_default` under `general_settings`, so keys need an explicit search tool grant on `/v1/search`, `/search`, websearch interception and `/search_tools/list` - [PR #44490](https://github.com/BerriAI/litellm/pull/44490)

### Credentials

- Add an optional credential `display_name` and make `credential_name` immutable on `PATCH /credentials/{name}`; config-defined credentials are read-only and GET returns `source` - [PR #43148](https://github.com/BerriAI/litellm/pull/43148)
- Keep credential edits on the credential being edited, reject names that collide with config credentials (409), and add a Source column to the credentials list - [PR #45890](https://github.com/BerriAI/litellm/pull/45890)
- Encrypt search tool `litellm_params` at rest and cover them in master key rotation - [PR #43631](https://github.com/BerriAI/litellm/pull/43631)

### Model management

- Accept team-scoped models by their public name on `POST /fallback`, and read stored fallback rules fresh so concurrent writes stop dropping rules - [PR #45455](https://github.com/BerriAI/litellm/pull/45455)

### Usage and analytics

- Stop caching failed spend-log key alias lookups as confirmed misses, and survive a dropped DB connection during the lookup on daily activity routes - [PR #43560](https://github.com/BerriAI/litellm/pull/43560)
- Count Auto-Router savings by selected UTC request day so the Auto-Router and Overall tabs agree, and remove the "Avg saved per session" tile - [PR #44115](https://github.com/BerriAI/litellm/pull/44115)
- Write per-router Auto-Router daily rollups with `disable_spend_logs: true` and for requests without a session id - [PR #44226](https://github.com/BerriAI/litellm/pull/44226)
- ROI calculator connects GitLab as well as GitHub, attributes cost to branches from paired `repo:` and `branch:` tags, and splits Overview, People and Branches into tabs - [PR #44324](https://github.com/BerriAI/litellm/pull/44324)
- ROI calculator measures shipping velocity, quality signals and recorded spend from repository activity without an estimator model, and links several provider usernames to one email - [PR #44426](https://github.com/BerriAI/litellm/pull/44426)
- ROI calculator people, merged-change and branch lists default to Matched people only - [PR #44465](https://github.com/BerriAI/litellm/pull/44465)
- Retire the integrated ROI Calculator: its dashboard page, Observability nav entry, API routes, OAuth callbacks and scheduled refresh are removed, `/ui/roi-calculator/` returns 404, and stored calculator configuration stays in the database. The standalone litellm-roi-calculator project remains available - [PR #44477](https://github.com/BerriAI/litellm/pull/44477)

### CLI and coding agents

- `lite pi` pins compat flags so pi stops sending `store` and prompt cache fields that Anthropic models reject - [PR #40739](https://github.com/BerriAI/litellm/pull/40739)
- Let `lite login` and Claude Code gateway sign-in complete on `DISABLE_ADMIN_UI=true` nodes - [PR #44620](https://github.com/BerriAI/litellm/pull/44620)
- Claude Code gateway sign-in returns a rotating 14-day refresh token, and `POST /claude_code_gateway/oauth/revoke` revokes it - [PR #44635](https://github.com/BerriAI/litellm/pull/44635)
- Statusline cost comparison shows full-session gateway spend, including requests without a baseline estimate - [PR #44959](https://github.com/BerriAI/litellm/pull/44959)
- Fix 401 "user no longer exists" on the first request with a key from a first-time SSO `lite login` - [PR #45020](https://github.com/BerriAI/litellm/pull/45020)

### Deployment

- Bundle the optional LiteAdmin Slack worker in the Enterprise gateway image, with Slack accounts connected through the gateway's existing SSO login - [PR #44444](https://github.com/BerriAI/litellm/pull/44444)
- Stop logging license values, decoded payloads and license-bearing URLs during license verification - [PR #44956](https://github.com/BerriAI/litellm/pull/44956)
- Allowlist `/moyai/connect/*` for split gateway and backend deployments and tag the Moyai UI settings Redis write as `config_params` - [PR #45220](https://github.com/BerriAI/litellm/pull/45220)

### Terraform

- Keep an omitted `allowed_routes` on `litellm_key` known at plan time and stop updates from re-sending stale routes from state - [PR #44487](https://github.com/BerriAI/litellm/pull/44487)

## AI Integrations

### Lens and Agent Traces

#### Lens service and deployment

- Move trace ingestion, ClickHouse lifecycle and trace reads into a standalone Rust Lens service; agents upload directly to Lens with dedicated tracing keys, the old gateway upload URLs return 410, and Python workers are replaced - [PR #45148](https://github.com/BerriAI/litellm/pull/45148)
- Simplify Lens installation: Helm supplies private credentials, persistent ClickHouse and ingress-derived endpoints, Compose generates and keeps credentials, and setup shows install guidance or copyable framework configuration - [PR #45230](https://github.com/BerriAI/litellm/pull/45230)
- Configure trace storage with one `general_settings.tracing.store` block (`type`, `url`, `database`, `retention_days`), use one ClickHouse URL for writes and reads, and apply one 14-day default TTL to trace and spend tables - [PR #43941](https://github.com/BerriAI/litellm/pull/43941)
- Select the Lens worker image matching the running LiteLLM release, reject incompatible workers before they claim work, and expose a private worker token for Compose and Helm installs - [PR #44428](https://github.com/BerriAI/litellm/pull/44428)
- Pin the Helm-installed Lens worker to its approved image digest and harden the worker image with pinned base images and hashed Python dependencies - [PR #44467](https://github.com/BerriAI/litellm/pull/44467)
- Align the Lens source setup guide and tracing Compose file with worker images that are actually published - [PR #44476](https://github.com/BerriAI/litellm/pull/44476)
- Fix Lens investigations failing on Python 3.10 with `module 'asyncio' has no attribute 'timeout'` - [PR #44911](https://github.com/BerriAI/litellm/pull/44911)
- Track ClickHouse tracing migrations in a checksummed `_sqlx_migrations` ledger so restarts apply only pending migrations and reapply the current `retention_days` to every trace table; an edited, already-applied migration now disables tracing at startup while the proxy keeps serving traffic - [PR #44580](https://github.com/BerriAI/litellm/pull/44580)

#### Trace ingestion

- Support Claude Agent SDK traces with prompts, tool arguments and outputs, token counts, the agent name and a Claude logo - [PR #44248](https://github.com/BerriAI/litellm/pull/44248)
- Accept native Claude Code response logs on the authenticated `/v1/logs` endpoint to rebuild replies, failed-tool output and subagent branches; group a whole session with `lens.session.capture=true` - [PR #44711](https://github.com/BerriAI/litellm/pull/44711)
- Keep native Claude Code logs that arrive without trace context, and recover headless tool results that precede trailing system messages - [PR #44894](https://github.com/BerriAI/litellm/pull/44894)
- Use configured framework agent names instead of service names for the Agent column and filter, and render GenAI messages that use `parts` instead of crashing the Traces page - [PR #44218](https://github.com/BerriAI/litellm/pull/44218)
- Show the first user message as a run's input instead of the latest follow-up - [PR #44958](https://github.com/BerriAI/litellm/pull/44958)
- Link a trace to the Slack, Teams, Discord, Linear, GitHub or Jira thread that started it via `agent.source.type`, `agent.source.url` and `agent.source.title` span attributes - [PR #45169](https://github.com/BerriAI/litellm/pull/45169)
- Keep request logs that carry numeric or mixed-type tags, and return meaningful RPC error codes in rejected OTLP batches - [PR #45206](https://github.com/BerriAI/litellm/pull/45206)

#### Trace cost correlation

- Keep distinct spend rows, persist gateway call IDs and match gateway and provider IDs with ownership checks so agent traces show the correct cost across 12 agent SDKs - [PR #44421](https://github.com/BerriAI/litellm/pull/44421)
- Stop summing costs from conflicting spend IDs on one span, and stop unrelated tool HTTP calls from hiding a model call's cost - [PR #44456](https://github.com/BerriAI/litellm/pull/44456)
- Price native Claude Code calls in Lens by forwarding and storing the provider request ID, show partial totals with the number of priced calls, and link each step to its spend log - [PR #44738](https://github.com/BerriAI/litellm/pull/44738)
- Accept historical spend rows that have no provider request ID - [PR #44930](https://github.com/BerriAI/litellm/pull/44930)
- Keep refreshing runs every five seconds until gateway costs arrive, instead of showing unknown cost for up to ten minutes - [PR #45105](https://github.com/BerriAI/litellm/pull/45105)
- Redact credential-like custom metadata in ClickHouse spend rows, drop custom metadata when message logging is off, and keep spend null when no cost was calculated - [PR #44363](https://github.com/BerriAI/litellm/pull/44363)

#### Trace API and SQL queries

- Scope trace reads to the caller's user, key or permitted teams to match log visibility, and return 400 with a `trace_ref` hint when a trace ID is shared across runs - [PR #44228](https://github.com/BerriAI/litellm/pull/44228)
- `POST /v1/traces/query` now returns only `{"data": [...]}`, dropping the raw ClickHouse `meta`, `rows` and `statistics` fields - [PR #44609](https://github.com/BerriAI/litellm/pull/44609)
- Serve the curated SQL examples in `/v1/traces/query/help` from shared query files - [PR #44388](https://github.com/BerriAI/litellm/pull/44388)
- Add `GET /v1/traces/agents` and an agent picker in the Lens header that scopes Traces to one agent and remembers the choice - [PR #45202](https://github.com/BerriAI/litellm/pull/45202)
- Load large trace lists and details in bounded pages within ClickHouse limits instead of failing with HTTP 500, with Load more steps for long runs - [PR #44384](https://github.com/BerriAI/litellm/pull/44384)
- Batch run-list reads, cap the pagination cache at 128 MiB, and restart Refresh trace from the first page - [PR #44398](https://github.com/BerriAI/litellm/pull/44398)
- Cache trace reads in process so repeated opens, pages and list polls share one ClickHouse read, and report typed read failures the UI can retry - [PR #44422](https://github.com/BerriAI/litellm/pull/44422)
- Open large traces and list pages faster, and queue concurrent trace reads instead of rejecting the ninth with 503 - [PR #45228](https://github.com/BerriAI/litellm/pull/45228)
- Preserve ASGI lifespan state across all proxy entrypoints, so Agent Traces no longer returns 501 on split gateway and backend deployments or with eager route loading - [PR #44214](https://github.com/BerriAI/litellm/pull/44214)
- Share spend log ownership checks with the Trace API and remove its API key access grants - [PR #44239](https://github.com/BerriAI/litellm/pull/44239)

#### Traces UI

- Read a run as a Thread, one turn per user prompt with the work folded into a Worked bar, replacing the Conversation tab - [PR #44947](https://github.com/BerriAI/litellm/pull/44947)
- Show the agent, the user who asked and the Slack thread first in the run header, with one Copy for agent menu - [PR #45261](https://github.com/BerriAI/litellm/pull/45261)
- Open Lens on Traces by default and add a Show details button to reopen a closed span panel - [PR #44260](https://github.com/BerriAI/litellm/pull/44260)
- Replace the timeline bars with a live dot field showing whether traces are arriving, and let the traces view fill the screen - [PR #44390](https://github.com/BerriAI/litellm/pull/44390)
- Keep every Lens view (open run, step, filters, sample session) in the URL so it can be shared, and add a Demo data switch in the header - [PR #44468](https://github.com/BerriAI/litellm/pull/44468)
- Add a Copy link button to the trace header - [PR #44749](https://github.com/BerriAI/litellm/pull/44749)
- Make Copy for agent fetch the selected step's content through the supported JSON trace APIs - [PR #44902](https://github.com/BerriAI/litellm/pull/44902)
- Show tool commands, paths and queries beside tool names, and render recorded message arrays as conversation instead of JSON - [PR #44645](https://github.com/BerriAI/litellm/pull/44645)
- Keep model and tool calls in execution order when grouping repeated steps - [PR #44895](https://github.com/BerriAI/litellm/pull/44895)
- Page long conversations by visible entries, with a separate paging control per subagent - [PR #44878](https://github.com/BerriAI/litellm/pull/44878)
- Refresh open traces when new spans arrive while keeping the selected step, and label received sessions Recorded instead of Completed - [PR #44900](https://github.com/BerriAI/litellm/pull/44900)
- Open runs on their top-level step and show "No input recorded" instead of the model name for empty inputs - [PR #45254](https://github.com/BerriAI/litellm/pull/45254)
- Replace the trace table's Failed column with a Findings column from completed investigations - [PR #44696](https://github.com/BerriAI/litellm/pull/44696)
- Persist the runs table's column choices and show column-shaped loading skeletons - [PR #44579](https://github.com/BerriAI/litellm/pull/44579)
- Keep previous runs visible while the time range changes and unify Lens loading states - [PR #44789](https://github.com/BerriAI/litellm/pull/44789)
- Type to filter the traces agent dropdown - [PR #44745](https://github.com/BerriAI/litellm/pull/44745)
- Apply typed search text as soon as the search box loses focus - [PR #44665](https://github.com/BerriAI/litellm/pull/44665)
- Give the Traces list a flush search row with filters on a compact second row - [PR #44972](https://github.com/BerriAI/litellm/pull/44972)
- Lens traces refresh button is always enabled, refetching runs and clearing timeline zoom - [PR #44252](https://github.com/BerriAI/litellm/pull/44252)
- Trace drawer adds search across steps, an errors filter, a conversation view, inline tool calls and full screen mode; ROI estimation covers only authors linked to gateway users and searches models by their real names - [PR #44351](https://github.com/BerriAI/litellm/pull/44351)
- Trace drawer closes on an outside click, the empty runs state offers Set up tracing, and Lens demo mode is marked with a blue frame - [PR #44473](https://github.com/BerriAI/litellm/pull/44473)

#### Setup and onboarding

- Add Preview sample with interactive sample traces and investigations, align all 14 framework setup guides, and report incompatible worker claims instead of leaving investigations stuck - [PR #44268](https://github.com/BerriAI/litellm/pull/44268)
- Guide new users from their first trace through connecting a worker and creating their first investigation - [PR #44475](https://github.com/BerriAI/litellm/pull/44475)
- Show Lens setup inline as the empty state of each tab instead of a modal, and fix overlapping controls on narrow screens - [PR #44604](https://github.com/BerriAI/litellm/pull/44604)
- Add a Lens Settings tab for tracing status and worker setup, and edit investigations inline instead of in a modal - [PR #44479](https://github.com/BerriAI/litellm/pull/44479)
- Simplify the example investigation preview to one compact finding with expandable evidence - [PR #44123](https://github.com/BerriAI/litellm/pull/44123)
- Show Lens setup validation errors under the field they belong to and allow retrying after a save error - [PR #44354](https://github.com/BerriAI/litellm/pull/44354)

#### Investigations

- Run investigations continuously every 15 minutes by default over new traces only, with Findings and Investigations tables and Run now scoped to an agent and time range - [PR #44418](https://github.com/BerriAI/litellm/pull/44418)
- Restore compact Traces, Findings and Investigations tabs and show live trace reviews, conclusions and worker queue status - [PR #44472](https://github.com/BerriAI/litellm/pull/44472)
- Analyze large trace workspaces with on-demand read and search, confined Python, parallel analysis and context compaction - [PR #44640](https://github.com/BerriAI/litellm/pull/44640)
- Reuse unchanged trace reviews without new model calls, consolidate duplicate findings across runs, and separate reserved from spent analysis budget - [PR #44778](https://github.com/BerriAI/litellm/pull/44778)
- Run investigations with models served through wildcard routes, and report missing pricing or worker access before queuing - [PR #44233](https://github.com/BerriAI/litellm/pull/44233)
- Show redacted investigation failure details (stage, validation error, finish reason) and derive output limits from model capacity - [PR #44406](https://github.com/BerriAI/litellm/pull/44406)
- Mark runs with usable results and some failed tasks as Partial, and cap rejected final results at three retries - [PR #44692](https://github.com/BerriAI/litellm/pull/44692)
- Keep final investigation coverage when the worker also reports source diagnostics - [PR #44682](https://github.com/BerriAI/litellm/pull/44682)
- Include span start and end timestamps in investigation evidence - [PR #44702](https://github.com/BerriAI/litellm/pull/44702)
- Release the reserved budget and return the provider error when an analysis model call fails - [PR #44431](https://github.com/BerriAI/litellm/pull/44431)
- Stop progress updates from exhausting budget reservation retries and ending investigations early - [PR #45432](https://github.com/BerriAI/litellm/pull/45432)
- Lead the investigation detail with a run report and one suggested next action - [PR #44786](https://github.com/BerriAI/litellm/pull/44786)
- Show investigation progress as one staged bar with time remaining - [PR #44301](https://github.com/BerriAI/litellm/pull/44301)
- Reduce re-rendering on live investigations and label the percentage as overall progress - [PR #44935](https://github.com/BerriAI/litellm/pull/44935)
- Add eight preset Watch for checks to investigation setup - [PR #44313](https://github.com/BerriAI/litellm/pull/44313)
- Add Copy for agent to investigation details - [PR #44945](https://github.com/BerriAI/litellm/pull/44945)

#### Findings

- Rank findings by priority with the share of traces affected, a daily frequency chart and inline highlighted evidence - [PR #45143](https://github.com/BerriAI/litellm/pull/45143)
- Write findings as issue briefs with the problem, user goal, what happened and test cases, copyable to Claude Code or Codex - [PR #44311](https://github.com/BerriAI/litellm/pull/44311)
- Show investigation names beside each finding - [PR #44753](https://github.com/BerriAI/litellm/pull/44753)

#### Signals, feedback and datasets

- Flag traces with global signals checked by a System 1 evaluation model, configured under Lens Settings and served by `GET /lens/signals`, `PUT /lens/signals` and `POST /lens/traces/signals` - [PR #45094](https://github.com/BerriAI/litellm/pull/45094)
- Classify signals within seconds of a trace finishing instead of minutes - [PR #45186](https://github.com/BerriAI/litellm/pull/45186)
- Record end-user feedback scores and comments through `PUT /lens/feedback` and show them on traces - [PR #45171](https://github.com/BerriAI/litellm/pull/45171)
- Reject feedback writes from keys without a team - [PR #45266](https://github.com/BerriAI/litellm/pull/45266)
- Add Datasets: versioned eval cases built from real traces, steps and findings, exportable as JSONL - [PR #44765](https://github.com/BerriAI/litellm/pull/44765)

#### Performance

- Prune ClickHouse partitions when sampling traces for investigations and sample in one pass - [PR #45087](https://github.com/BerriAI/litellm/pull/45087)
- Bound single-trace investigation reads by the sampled start time - [PR #45088](https://github.com/BerriAI/litellm/pull/45088)
- Claim worker jobs from an indexed due queue instead of scanning every investigation - [PR #45095](https://github.com/BerriAI/litellm/pull/45095)

### Guardrails

- Add the LLM Shield Proxy guardrail, which swaps PII for stand-ins before the provider call and restores the original values in the response, streaming included - [PR #42645](https://github.com/BerriAI/litellm/pull/42645)
- Encrypt secret-named guardrail `litellm_params` at rest, re-key them on master key rotation, and reject client-sent `litellm_enc::` values with a 400 - [PR #43627](https://github.com/BerriAI/litellm/pull/43627)
- Add `logging_only_scope` (`input` or `output`) and `logging_only_continue_on_input_failure` so `logging_only` guardrails can observe only requests, only responses, or keep scanning the response after a flagged request, with matching Admin UI controls - [PR #43695](https://github.com/BerriAI/litellm/pull/43695), [PR #45782](https://github.com/BerriAI/litellm/pull/45782)
- Add a `stream_scope` guardrail setting (`streaming`, `non_streaming` or `both`, per mode) and treat Bedrock `converse-stream` and `invoke-with-response-stream` pass-through calls as streaming - [PR #43801](https://github.com/BerriAI/litellm/pull/43801)
- Run the end-of-stream `post_call` scan on already-delivered content when a client disconnects mid-stream, so the request log carries a guardrail verdict - [PR #43839](https://github.com/BerriAI/litellm/pull/43839)
- Run unified guardrails on `/v1/images/edits`, scanning the text prompt the same way as `/v1/images/generations` - [PR #44195](https://github.com/BerriAI/litellm/pull/44195)
- Skip the guardrail VAD `session.update` injection on realtime transcription sessions, which previously broke them - [PR #44843](https://github.com/BerriAI/litellm/pull/44843)
- Run transcript guardrails on OpenAI and Azure realtime transcription sessions, reporting a `guardrail_violation` without sending assistant-turn events the session rejects - [PR #44844](https://github.com/BerriAI/litellm/pull/44844)
- Support `logging_only` mode for the Akto guardrail on both requests and responses - [PR #45461](https://github.com/BerriAI/litellm/pull/45461)
- Extend the Akto guardrail to block or mask replies in `post_call`, check MCP tool arguments and results via `pre_mcp_call` / `post_mcp_call`, and send attachments to Akto - [PR #44343](https://github.com/BerriAI/litellm/pull/44343)

### Logging and observability

#### OpenTelemetry

- Nest response-cache and routing spans under `cache.get` / `cache.set` and `route {model_group}` phases, and name Redis spans by key family instead of Python method - [PR #44150](https://github.com/BerriAI/litellm/pull/44150)
- Name Postgres spans `postgres.{verb} {table}` with the table on `db.collection.name`, and emit DB spans for spend writes, raw Prisma queries and background jobs - [PR #44240](https://github.com/BerriAI/litellm/pull/44240)
- Trace the auto-router's selected configuration, routing reason and classifier failures - [PR #44926](https://github.com/BerriAI/litellm/pull/44926)
- Stop an SDK `Router` from loading the whole proxy on its first request when looking up the OTel v2 logger - [PR #44485](https://github.com/BerriAI/litellm/pull/44485)

#### Arize

- Emit OpenInference tool calls and a standard `metadata` attribute on Arize OTel v2 LLM spans - [PR #43698](https://github.com/BerriAI/litellm/pull/43698)
- Add `arize_otlp_protocol` (`grpc` or `http/protobuf`) to team and key Arize callbacks, with a dropdown in the team and key logging forms - [PR #44492](https://github.com/BerriAI/litellm/pull/44492)
- Name an Arize project (`ARIZE_PROJECT_NAME`, falling back to `litellm`) on every OTel v2 Arize export so Arize no longer rejects team traces - [PR #44605](https://github.com/BerriAI/litellm/pull/44605)
- Skip the operator Arize exporter on OTel v2 when no Arize credentials are set, so only team destinations export - [PR #44596](https://github.com/BerriAI/litellm/pull/44596)
- Honor per-team `arize_success_sampling_rate` and `arize_error_sampling_rate` on OTel v2, keeping or dropping each trace whole - [PR #44595](https://github.com/BerriAI/litellm/pull/44595)

#### Prometheus

- Add `litellm_project_model_rate_limit_allowed_metric` and `litellm_project_model_rate_limit_used_metric` gauges for project per-model limits, plus Grafana dashboard panels - [PR #43561](https://github.com/BerriAI/litellm/pull/43561)
- Add `prometheus_metrics_max_series_per_metric` to cap series on every labeled metric, counting overflow on an `other` series, and `prometheus_metrics_ttl_seconds` to drop idle series - [PR #44420](https://github.com/BerriAI/litellm/pull/44420)
- Add the `model_group` label to the end-to-end latency metrics - [PR #44860](https://github.com/BerriAI/litellm/pull/44860)

#### General

- Fire failure callbacks once per failed streaming request, so `s3_v2` writes one failure object instead of one per retry - [PR #44442](https://github.com/BerriAI/litellm/pull/44442)
- Bound the base64 data URI regex used for log truncation, so prompts with many `data:` lines no longer stall the proxy - [PR #45132](https://github.com/BerriAI/litellm/pull/45132)
- Skip sync success callbacks for internal sub-calls, so a `litellm.aquery` RAG call logs the completion instead of the vector store search - [PR #45345](https://github.com/BerriAI/litellm/pull/45345)
- Log `/v1/messages` mid-stream failures as failure spend rows and run failure callbacks, matching `/v1/chat/completions` - [PR #44800](https://github.com/BerriAI/litellm/pull/44800)
- Explicit `metadata.trace_id` and `metadata.session_id` now win over the `traceparent` and `baggage` header fallbacks on chat, Responses and Messages - [PR #43688](https://github.com/BerriAI/litellm/pull/43688)
- Emit `postgres` service spans and `litellm_db_*` metrics only when a call actually reaches Postgres, not on in-memory auth cache hits - [PR #44148](https://github.com/BerriAI/litellm/pull/44148)
- Log the provider's final `finish_reason` (e.g. `tool_calls`, `length`) when the last stream chunk carries both content and the finish reason - [PR #44318](https://github.com/BerriAI/litellm/pull/44318)

## Spend Tracking, Budgets and Rate Limiting

### Cost tracking

- Carry key, team and project tags and `spend_logs_metadata` into pass-through spend logs, matching native routes - [PR #42662](https://github.com/BerriAI/litellm/pull/42662)
- Bill per-second transcription models like `deepgram/nova-3` again through `cost_per_token`, using the audio length when known - [PR #44458](https://github.com/BerriAI/litellm/pull/44458)
- Add the Azure Model Router flat fee to `azure/` deployments, as `azure_ai/` already did - [PR #44876](https://github.com/BerriAI/litellm/pull/44876)
- Price Gemini batch image output tokens at the batch image rate with the new `output_cost_per_image_token_batches` key - [PR #44897](https://github.com/BerriAI/litellm/pull/44897)
- Bill background Gemini interactions durably across pods and restarts, and return Gemini's 404 or 400 for a deleted or unknown interaction - [PR #41955](https://github.com/BerriAI/litellm/pull/41955)
- Streamed requests through a model alias are priced from the deployment's model, matching non-streamed requests - [PR #44341](https://github.com/BerriAI/litellm/pull/44341)
- Match a deployment's pricing id against the cost map only within the deployment's own provider, so explicit `model_info` prices no longer bill $0 on an id collision - [PR #45472](https://github.com/BerriAI/litellm/pull/45472)
- Mark ZDR background responses `stale_expired` when the provider returns 404 instead of re-polling them hourly for 7 days - [PR #41724](https://github.com/BerriAI/litellm/pull/41724)
- Log spend once for large non-streaming chat requests on the chat to Responses bridge, which were charged twice - [PR #44508](https://github.com/BerriAI/litellm/pull/44508)

### Spend logs and daily rollups

- Requeue spend-log batches when Postgres runs out of connections instead of dropping every row - [PR #44270](https://github.com/BerriAI/litellm/pull/44270)
- Bound daily spend rollup row-lock waits with `SPEND_ROLLUP_LOCK_TIMEOUT_MS` (default 5000 ms) and retry timed-out batches instead of dropping them - [PR #44450](https://github.com/BerriAI/litellm/pull/44450), [PR #45273](https://github.com/BerriAI/litellm/pull/45273)
- Add `general_settings.spend_logs_metadata_fields` with an `include` or `exclude` list to choose which metadata keys are stored in `LiteLLM_SpendLogs` - [PR #44659](https://github.com/BerriAI/litellm/pull/44659)

### Budgets

- Project soft-budget alerts within the key's budget reset window instead of to calendar month end - [PR #31942](https://github.com/BerriAI/litellm/pull/31942)
- Resolve hidden `model_group_alias` entries in the zero-cost budget check - [PR #43741](https://github.com/BerriAI/litellm/pull/43741)
- Judge the free-model budget waiver by the group an alias routes to - [PR #44638](https://github.com/BerriAI/litellm/pull/44638)
- Show a disabled Reset spend icon with an explanatory tooltip on team member rows instead of hiding it - [PR #44629](https://github.com/BerriAI/litellm/pull/44629)
- Clearing a team's member Default Budget in the UI now removes the cap instead of saving $0 - [PR #44644](https://github.com/BerriAI/litellm/pull/44644)

### Rate limiting

- Add `max_batch_file_records`, `max_batch_file_uploads_per_day` and `max_file_downloads_per_minute` caps for batch files, settable per key or team by proxy admins - [PR #43632](https://github.com/BerriAI/litellm/pull/43632)
- Apply user TPM/RPM limit changes on every proxy right away, clear them with an explicit `null`, and edit them on the Users page - [PR #44130](https://github.com/BerriAI/litellm/pull/44130)
- Add opt-in `litellm_settings.force_redis_hash_tag_grouping` so the v3 rate limiter works on Redis Enterprise clustering such as Azure Managed Redis - [PR #45085](https://github.com/BerriAI/litellm/pull/45085)
- Read the clock once per operation in the v1 parallel request limiter so the per-minute key cannot tear at a minute rollover - [PR #45522](https://github.com/BerriAI/litellm/pull/45522)

## MCP Gateway

### Auth and OAuth

- Never forward the caller's LiteLLM key to upstream MCP servers, including through Extra Headers set to `x-litellm-api-key` - [PR #45401](https://github.com/BerriAI/litellm/pull/45401)
- Support OAuth providers that only accept Client ID Metadata Documents by publishing `GET /oauth/client-metadata.json`, with `general_settings.mcp_prefer_client_id_metadata_document` to prefer it over dynamic registration - [PR #45231](https://github.com/BerriAI/litellm/pull/45231)
- Bind OAuth clients to their upstream issuer, so editing a server to a new issuer authorizes against the new one, and reject unverified callback issuers - [PR #37777](https://github.com/BerriAI/litellm/pull/37777)
- Forward `application_type` during client registration so native MCP clients with loopback redirects can register - [PR #45159](https://github.com/BerriAI/litellm/pull/45159)
- Keep mapped caller JWTs request-local so they reach MCP guardrails and guarded tool calls succeed - [PR #45901](https://github.com/BerriAI/litellm/pull/45901)

### Rate limits and guardrails

- Rate limit every MCP operation (list, get and read, not only `tools/call`) and add a server-level `rpm` shared by all callers, settable in the Admin UI - [PR #44600](https://github.com/BerriAI/litellm/pull/44600)
- Hand the listed tool's description and input schema to pre-call guardrail hooks - [PR #41162](https://github.com/BerriAI/litellm/pull/41162)

### Protocol and catalog

- Accept explicitly configured modern MCP upstreams (e.g. `protocol_version: "2026-07-28"`) and reject incompatible transport settings before saving - [PR #44232](https://github.com/BerriAI/litellm/pull/44232)
- Paginate `tools/list`, prompts and resources with opaque `nextCursor` values that resume on any replica - [PR #44446](https://github.com/BerriAI/litellm/pull/44446)
- Let legacy clients answer input requests from modern upstreams, with continuation state bound to the caller and upstream - [PR #45464](https://github.com/BerriAI/litellm/pull/45464)
- Return an explicit tool error when elicitation relay fails instead of a fabricated user decline - [PR #45255](https://github.com/BerriAI/litellm/pull/45255)
- Preserve upstream tool schemas, annotations and metadata in REST discovery, send schema-derived parameter headers, and validate arguments offline without fetching external `$ref` schemas - [PR #44425](https://github.com/BerriAI/litellm/pull/44425)
- Keep MCP server configuration consistent across workers through a catalog revision, so creates, edits and deletes apply on every worker immediately - [PR #42568](https://github.com/BerriAI/litellm/pull/42568)
- Respect upstream freshness and scope cached discovery results to the caller, credentials and target - [PR #45165](https://github.com/BerriAI/litellm/pull/45165)

### Admin MCP and UI

- Embed the Enterprise LiteAdmin MCP at `/admin/mcp`, enabled with `LITELLM_ENABLE_ADMIN_MCP=true` - [PR #44610](https://github.com/BerriAI/litellm/pull/44610)
- Show saved MCP submission rules in the Submitted MCPs tab, and stop saving the rules editor from wiping them - [PR #44648](https://github.com/BerriAI/litellm/pull/44648)

## Performance / Loadbalancing / Reliability improvements

### Auto Router and model routing

- Remove a prioritized request's scheduler queue entry once it is admitted, times out or is cancelled, fixing the Redis-backed `TypeError` on about half of prioritized requests and stale entries blocking requests during cooldown - [PR #43061](https://github.com/BerriAI/litellm/pull/43061)
- Sync streaming fallbacks resume on the configured backup instead of retrying the failed primary until recursion fails - [PR #43959](https://github.com/BerriAI/litellm/pull/43959)
- Keep `include_fallback_errors` off the provider call on the sync `Router.completion` path, so OpenAI no longer answers 400 `Unknown parameter` - [PR #45218](https://github.com/BerriAI/litellm/pull/45218)
- Honor a per-request `fallbacks`, `context_window_fallbacks` or `content_policy_fallbacks` list when a stream fails after opening, and stop `null` key and team router settings saved from the dashboard from turning off router-level fallbacks and retries - [PR #45227](https://github.com/BerriAI/litellm/pull/45227)
- Every fallback hop drops the encrypted reasoning its target deployment cannot decrypt and keeps the summary, on Responses, chat, Anthropic messages and the mid-stream path - [PR #45393](https://github.com/BerriAI/litellm/pull/45393)
- Price a model group from the deployments that serve it instead of following the group's own alias, so budget waivers and `GET /model_group/info` agree with routing - [PR #44732](https://github.com/BerriAI/litellm/pull/44732)
- Required-param validation accepts values supplied by `router_settings.default_litellm_params`, so `/v1/messages` without `max_tokens` and `/rerank` without `documents` no longer return 400 when a router default covers them - [PR #44483](https://github.com/BerriAI/litellm/pull/44483)
- Attribute each background health check result to its own `model_id`, so `GET /health/latest` no longer marks a dead host healthy when deployments share one `litellm_params.model` - [PR #44982](https://github.com/BerriAI/litellm/pull/44982)
- Map upstream 402 responses to `PaymentRequiredError`, a `BadRequestError` subclass, and cool down 402 deployments in multi-deployment groups - [PR #44879](https://github.com/BerriAI/litellm/pull/44879)
- Keep the auto-router baseline's cache identity and accounting unchanged by tier overrides and duplicate callbacks - [PR #44960](https://github.com/BerriAI/litellm/pull/44960)
- Auto Router routing preview and serving resolve the default model the same way, and serving honors `config.default_model` before inferring a tier default - [PR #44436](https://github.com/BerriAI/litellm/pull/44436)
- Auto Router UI shows only the selected heuristic's tuning, splits Heuristic and LLM tuning, and supports v1 or v2 heuristics when chaining - [PR #44928](https://github.com/BerriAI/litellm/pull/44928)
- Stop SDK retries from nesting inside router retries on async router calls such as `aresponses`, so `num_retries: 2` makes 3 provider attempts instead of 9 - [PR #44791](https://github.com/BerriAI/litellm/pull/44791)

### Caching, database and runtime

- Add `cache_params.max_messages` (default 4): requests with more messages or Responses `input` items are neither looked up nor stored, and semantic caches now embed Messages API `tool_result` text and list-form Responses tool outputs - [PR #43878](https://github.com/BerriAI/litellm/pull/43878)
- Key the response cache by the router model group carried in `litellm_metadata`, so `/v1/responses` cache entries no longer leak across model groups - [PR #44542](https://github.com/BerriAI/litellm/pull/44542)
- Queue daily model usage in memory and write it on the spend log flush instead of upserting once per request - [PR #44243](https://github.com/BerriAI/litellm/pull/44243)
- Treat Postgres connection exhaustion (`53300`, Prisma `P2024`) as backpressure: requeue tool usage batches, return 503 on key lookup, skip engine reconnects, add `database_idle_in_transaction_session_timeout`, and print the per-pod connection budget at startup - [PR #44266](https://github.com/BerriAI/litellm/pull/44266)
- Keep the original database error when the `log_db_metrics` failure hook itself raises - [PR #44383](https://github.com/BerriAI/litellm/pull/44383)
- Log v1 migration failures at ERROR so `LITELLM_LOG=ERROR` shows the Prisma error and retry count - [PR #44202](https://github.com/BerriAI/litellm/pull/44202)
- Exit with one clear error when `DATABASE_URL` is set but the Prisma toolchain is missing, including on the `--skip_server_startup` migration entrypoint - [PR #44207](https://github.com/BerriAI/litellm/pull/44207)
- Include the database error text (passwords redacted) when the Lens rename check cannot reach Postgres - [PR #45341](https://github.com/BerriAI/litellm/pull/45341)
- Add a `LITELLM_FIPS_MODE` startup gate that refuses boot unless OpenSSL enforces FIPS, refuses disabled TLS verification, and stops startup on password migration crypto failures - [PR #42700](https://github.com/BerriAI/litellm/pull/42700)
- Answer a rejected websocket handshake on `/v1/responses` or `/v1/realtime` with one log line instead of an ASGI crash traceback - [PR #45251](https://github.com/BerriAI/litellm/pull/45251)
- Retry a `/v1/messages` stream the provider drops before the first content chunk within the model group, using `num_retries` - [PR #44276](https://github.com/BerriAI/litellm/pull/44276)
- Never store or serve a cached chat completion, Responses or Messages answer with no output - [PR #44709](https://github.com/BerriAI/litellm/pull/44709)
- Stop the `prompt_caching` pre-call check from tokenizing the whole conversation, cutting pre-LLM time at very large prompts, and add request-phase span events - [PR #44221](https://github.com/BerriAI/litellm/pull/44221)
- Load enterprise alerting loggers lazily so `import litellm` no longer loads proxy types - [PR #44762](https://github.com/BerriAI/litellm/pull/44762)
- Drop `boto3`, `tokenizers` and `huggingface-hub` from `litellm-core` dependencies and load them only where needed - [PR #44447](https://github.com/BerriAI/litellm/pull/44447)
- Stop queued model registry read-throughs from spending the resync budget, fixing 400 `Invalid model name` bursts right after adding a model - [PR #44277](https://github.com/BerriAI/litellm/pull/44277)
- Defer pydantic schema builds for LiteLLM models until first use, skipping about 1,380 schema builds at proxy import; set `DEFER_PYDANTIC_BUILD=false` to build eagerly again. Deferred builds are serialized across threads so the first concurrent requests on a fresh worker no longer fail with a 400 - [PR #44720](https://github.com/BerriAI/litellm/pull/44720), [PR #45034](https://github.com/BerriAI/litellm/pull/45034)

### Docker and Helm

- One-command Docker quickstart (`scripts/quickstart.sh`) that starts the gateway, Postgres and the admin UI, generates keys and a random Postgres password, picks a free port and binds to 127.0.0.1 - [PR #43673](https://github.com/BerriAI/litellm/pull/43673)
- Windows PowerShell quickstart (`scripts/quickstart.ps1`), styled terminal output for both quickstarts, and support for podman and nerdctl - [PR #44310](https://github.com/BerriAI/litellm/pull/44310)
- Helm `migrationJob` accepts `jobLabels`, `jobAnnotations`, `podLabels`, `command` and `args` - [PR #42242](https://github.com/BerriAI/litellm/pull/42242)
- Remove the `migrationJob.retries` and `migrationJob.disableSchemaUpdate` Helm values, which no template ever read; use `migrationJob.enabled: false` to skip the migration Job - [PR #42141](https://github.com/BerriAI/litellm/pull/42141)
- Pin `openssl-3.6-dev` in the pgbouncer-builder stage, then revert the pin because no runtime stage ships `libssl3`; pgbouncer builds against unpinned `openssl-dev` again - [PR #44991](https://github.com/BerriAI/litellm/pull/44991), [PR #44997](https://github.com/BerriAI/litellm/pull/44997)

### Dependency updates

- Bump source-map-js, smol-toml, mako, multidict and werkzeug to clear OSV advisories - [PR #44728](https://github.com/BerriAI/litellm/pull/44728)
- Bump langgraph-sdk from 0.4.2 to 0.4.4 - [PR #44713](https://github.com/BerriAI/litellm/pull/44713)
- Bump the dashboard's next to 16.3.8 to clear osv-scan - [PR #45207](https://github.com/BerriAI/litellm/pull/45207)

## Documentation Updates

- Add architecture decision records for the Rust core - [PR #45205](https://github.com/BerriAI/litellm/pull/45205)

## Tests, CI and Internal Changes

These 166 PRs change tests, CI, contributor tooling, release packaging, or Rust runtime scaffolding that is not yet wired into a user-facing path. They do not change proxy or SDK behavior on their own

<details>
<summary>Translation test matrix (14)</summary>

- Exact four-part translation cases on a shared fake provider and shared YAML deployment - [PR #44451](https://github.com/BerriAI/litellm/pull/44451)
- Anthropic-route basic translation cases for six Claude models on messages, chat completions and responses - [PR #44607](https://github.com/BerriAI/litellm/pull/44607)
- Run the Anthropic /v1/responses basic translation cases now that the bridge echoes request params - [PR #44615](https://github.com/BerriAI/litellm/pull/44615)
- Bedrock Converse-route basic translation cases for six Claude models - [PR #44646](https://github.com/BerriAI/litellm/pull/44646)
- Azure AI-route basic translation cases for six Claude models - [PR #44658](https://github.com/BerriAI/litellm/pull/44658)
- Basic translation cases for the gemini route - [PR #44662](https://github.com/BerriAI/litellm/pull/44662)
- Basic translation cases for the openai_responses route - [PR #44663](https://github.com/BerriAI/litellm/pull/44663)
- Basic translation cases for the openai route - [PR #44667](https://github.com/BerriAI/litellm/pull/44667)
- Basic translation cases for the azure route - [PR #44672](https://github.com/BerriAI/litellm/pull/44672)
- Rename the translation runner's run to assert_translation - [PR #44741](https://github.com/BerriAI/litellm/pull/44741)
- Basic translation cases for the bedrock_mantle route - [PR #44750](https://github.com/BerriAI/litellm/pull/44750)
- Basic translation cases for the vertex_ai route - [PR #44751](https://github.com/BerriAI/litellm/pull/44751)
- Basic translation cases for the bedrock_invoke route - [PR #44752](https://github.com/BerriAI/litellm/pull/44752)
- hosted_vllm /v1/decisions and provider-400 translation cases - [PR #45661](https://github.com/BerriAI/litellm/pull/45661)

</details>

<details>
<summary>E2E harness and metadata (13)</summary>

- Assert the sibling-replica cooldown through the router - [PR #44706](https://github.com/BerriAI/litellm/pull/44706)
- Enum values, auto-discovering label gates and secret hiding for e2e metadata - [PR #44949](https://github.com/BerriAI/litellm/pull/44949)
- Tag llm_translation tests with Subject metadata and record harness steps - [PR #44950](https://github.com/BerriAI/litellm/pull/44950)
- Tag claude_code cells with Subject metadata and record CLI driver steps - [PR #44961](https://github.com/BerriAI/litellm/pull/44961)
- Tag management tests with Subject metadata and record management client steps - [PR #44962](https://github.com/BerriAI/litellm/pull/44962)
- Tag guardrails and logging tests with Subject metadata and record client steps - [PR #44963](https://github.com/BerriAI/litellm/pull/44963)
- Tag router, batches and MCP tests with Subject metadata and record client steps - [PR #44964](https://github.com/BerriAI/litellm/pull/44964)
- Tag a2a, access_control, other, secret_manager and migrations tests with Subject metadata - [PR #44965](https://github.com/BerriAI/litellm/pull/44965)
- Tag the remaining quota_management tests and record budget and spend client steps - [PR #44966](https://github.com/BerriAI/litellm/pull/44966)
- Let the realtime send step accept input audio buffer frames - [PR #45127](https://github.com/BerriAI/litellm/pull/45127)
- Record steps for raw transport calls and poll helpers - [PR #45150](https://github.com/BerriAI/litellm/pull/45150)
- Move the harness self-tests out of tests/e2e so they stop inflating e2e counts - [PR #45172](https://github.com/BerriAI/litellm/pull/45172)
- Cover Responses API gaps on Gemini, Azure, compact and context management - [PR #45248](https://github.com/BerriAI/litellm/pull/45248)

</details>

<details>
<summary>Legacy test cleanup (11)</summary>

- Remove 130 legacy tests owned by stronger unit proofs - [PR #44157](https://github.com/BerriAI/litellm/pull/44157)
- Move whole-unit legacy test files into tests/unit and delete dead skips - [PR #44807](https://github.com/BerriAI/litellm/pull/44807)
- Move the unit half of 126 mixed legacy files into tests/unit - [PR #45090](https://github.com/BerriAI/litellm/pull/45090)
- Delete 73 legacy tests covered by e2e, unable to fail, or dead in CI - [PR #45195](https://github.com/BerriAI/litellm/pull/45195)
- Remove dead imports and helpers left behind by legacy test deletion - [PR #45208](https://github.com/BerriAI/litellm/pull/45208)
- Move 81 legacy live tests in pass-through, spend, batches, audio, search, guardrails, image and OCR dirs offline - [PR #45288](https://github.com/BerriAI/litellm/pull/45288)
- Make 77 legacy live tests offline in litellm_utils, router_unit and responses dirs - [PR #45298](https://github.com/BerriAI/litellm/pull/45298)
- Delete 34 legacy tests already covered by e2e - [PR #45340](https://github.com/BerriAI/litellm/pull/45340)
- Make 38 legacy live base-class translation tests offline - [PR #45351](https://github.com/BerriAI/litellm/pull/45351)
- Move 76 live top-level tests to offline unit and integration coverage - [PR #45352](https://github.com/BerriAI/litellm/pull/45352)
- Replace 61 live logging and OTel tests with offline unit and integration coverage - [PR #45362](https://github.com/BerriAI/litellm/pull/45362)

</details>

<details>
<summary>Test fixes and new coverage (43)</summary>

- Fire MCP client test deadlines on conditions instead of wall-clock time - [PR #44166](https://github.com/BerriAI/litellm/pull/44166)
- Opt the config pass-through spend-log case into auth - [PR #44265](https://github.com/BerriAI/litellm/pull/44265)
- Let the integration run.py select cells by pytest node id - [PR #44319](https://github.com/BerriAI/litellm/pull/44319)
- Give the pass-through auth regression test a real FastAPI app - [PR #44403](https://github.com/BerriAI/litellm/pull/44403)
- Pin the OpenAI-reported web search count with mixed actions - [PR #44414](https://github.com/BerriAI/litellm/pull/44414)
- Fix six CircleCI test regressions on main caused by drifted tests and leaked state - [PR #44429](https://github.com/BerriAI/litellm/pull/44429)
- Match the OS bind error in the owned-proxy port-race retry - [PR #44462](https://github.com/BerriAI/litellm/pull/44462)
- Wait for the step search value to settle in the TraceDrawer test - [PR #44470](https://github.com/BerriAI/litellm/pull/44470)
- Keep the SSO assertion round trip from matching its refresh token inside random ciphertext - [PR #44494](https://github.com/BerriAI/litellm/pull/44494)
- Pin the ROI estimator flag and the prompt-cache counter in two drifted tests - [PR #44499](https://github.com/BerriAI/litellm/pull/44499)
- Send the Lens preview body as selection in the tracing endpoint tests - [PR #44525](https://github.com/BerriAI/litellm/pull/44525)
- Repair the security sweep and Lens billing integration tests for ROI, JWKS and release identity changes - [PR #44529](https://github.com/BerriAI/litellm/pull/44529)
- Assert the Messages API health probe on Mantle Claude - [PR #44612](https://github.com/BerriAI/litellm/pull/44612)
- Point the scratch upgraded proxy's read replica at the scratch database - [PR #44613](https://github.com/BerriAI/litellm/pull/44613)
- Pin the Claude-tokenizer recount for streamed claude-sonnet-5 no-usage cases - [PR #44643](https://github.com/BerriAI/litellm/pull/44643)
- Keep scripted upstream connections open past the proxy's keepalive - [PR #44695](https://github.com/BerriAI/litellm/pull/44695)
- Expect PartRow start_time and end_time as required LENS_CONTENT fields - [PR #44719](https://github.com/BerriAI/litellm/pull/44719)
- Use the current Lens worker protocol in the billing integration tests - [PR #44760](https://github.com/BerriAI/litellm/pull/44760)
- Namespace Claude session ids in the tracing seed and allowlist the new `/v1/logs` route on the backend - [PR #44761](https://github.com/BerriAI/litellm/pull/44761)
- Extract the Rust cache test split - [PR #44780](https://github.com/BerriAI/litellm/pull/44780)
- Deflake the JEV classifier select and two router tests that inherited leaked state - [PR #44840](https://github.com/BerriAI/litellm/pull/44840)
- Fix shared-provider discovery, Codex catalog size and generated master key mismatches in CircleCI suites - [PR #44905](https://github.com/BerriAI/litellm/pull/44905)
- Resolve deferred pydantic model names from the model's own module and add the missing Lens review foreign key migration, both fixes for changes in this release - [PR #44981](https://github.com/BerriAI/litellm/pull/44981)
- Run the static root path issuer discovery test in-process - [PR #44988](https://github.com/BerriAI/litellm/pull/44988)
- Set server_id on OpenAPI local fake tools - [PR #44998](https://github.com/BerriAI/litellm/pull/44998)
- Wait for warm-up spend rows in the capped observability test and count only the post-wipe half in X4 - [PR #45006](https://github.com/BerriAI/litellm/pull/45006)
- Fix stale MCP bridge-hook, applied-guardrails and pagination-revoke integration tests - [PR #45008](https://github.com/BerriAI/litellm/pull/45008)
- Make the stagger-offset and linear-dedup guards independent of runner identity and load - [PR #45031](https://github.com/BerriAI/litellm/pull/45031)
- Match the lowercased bind error in the owned-proxy port-race retry - [PR #45097](https://github.com/BerriAI/litellm/pull/45097)
- Turn the model-info refresh off in every integration proxy config - [PR #45104](https://github.com/BerriAI/litellm/pull/45104)
- Scope the team-scoped models upstream check to its own model - [PR #45106](https://github.com/BerriAI/litellm/pull/45106)
- Hold the wire barrier until the test releases it or the wire closes - [PR #45124](https://github.com/BerriAI/litellm/pull/45124)
- Align misc unit tests with the NativeCall bridge and widened e2e diff gates - [PR #45180](https://github.com/BerriAI/litellm/pull/45180)
- Restore Vertex model sets mutated by get_optional_params tests - [PR #45209](https://github.com/BerriAI/litellm/pull/45209)
- Wait on deployment registration instead of boot model-info traffic in the routing test - [PR #45267](https://github.com/BerriAI/litellm/pull/45267)
- Boot owned proxies with a readiness-sized worker healthcheck budget - [PR #45292](https://github.com/BerriAI/litellm/pull/45292)
- Audit the websocket rejection log on every live route - [PR #45293](https://github.com/BerriAI/litellm/pull/45293)
- Update Usage page selectors in the UI e2e tests after the redesign - [PR #45347](https://github.com/BerriAI/litellm/pull/45347)
- Run the response cache tool-call tests on a proxy without the message cap - [PR #45350](https://github.com/BerriAI/litellm/pull/45350)
- Drop the publicly known master key prefix from the Voyage routing test - [PR #45431](https://github.com/BerriAI/litellm/pull/45431)
- Expect the unwrapped provider error in bridged /v1/messages error frames - [PR #45465](https://github.com/BerriAI/litellm/pull/45465)
- Import seed_tracing_fixtures from the pytest scripts path in the Rust trace tests - [PR #45485](https://github.com/BerriAI/litellm/pull/45485)
- Update stale MCP call_tool and usage card assertions, and add timeout headroom to the request-log index boot test - [PR #45523](https://github.com/BerriAI/litellm/pull/45523)

</details>

<details>
<summary>CI, lint gates and contributor tooling (20)</summary>

- Gate every lint rule on its merge-base count and cap `Any` at a fixed codebase-wide total, replacing the budget files - [PR #40193](https://github.com/BerriAI/litellm/pull/40193)
- Add lint rule LIT015 requiring pydantic models to be frozen - [PR #42348](https://github.com/BerriAI/litellm/pull/42348)
- Suppress the unfixed braces GHSA-vfj7-8cjw-p6xm (dashboard devDependency only) to clear osv-scan, expiring 2026-11-03 - [PR #44347](https://github.com/BerriAI/litellm/pull/44347)
- Move the Postgres, MCP and Redis suites to CircleCI integration - [PR #44453](https://github.com/BerriAI/litellm/pull/44453)
- Run unit selections from GitHub Actions test-path and drop the CircleCI unit jobs - [PR #44461](https://github.com/BerriAI/litellm/pull/44461)
- Run integration-mcp on an xlarge machine - [PR #44608](https://github.com/BerriAI/litellm/pull/44608)
- Split slow unit shards and build the Rust bridge once per run - [PR #44622](https://github.com/BerriAI/litellm/pull/44622)
- Move the PR template to PULL_REQUEST_TEMPLATE/general.md and add a Rust template - [PR #44693](https://github.com/BerriAI/litellm/pull/44693)
- Skip the generated dashboard bundle in the master key guard - [PR #44890](https://github.com/BerriAI/litellm/pull/44890)
- Generate a master key for the migration startup jobs - [PR #44978](https://github.com/BerriAI/litellm/pull/44978)
- Give the database-backed CircleCI jobs their own Postgres - [PR #45007](https://github.com/BerriAI/litellm/pull/45007)
- Run the default CodeQL suite on full scans and security-extended on PRs - [PR #45149](https://github.com/BerriAI/litellm/pull/45149)
- Update CODEOWNERS for a renamed maintainer account - [PR #45173](https://github.com/BerriAI/litellm/pull/45173)
- Fail the lint gates on an empty base scan, then revert that since zero violations is a legitimate count - [PR #45314](https://github.com/BerriAI/litellm/pull/45314), [PR #45319](https://github.com/BerriAI/litellm/pull/45319)
- Trim rust-test debuginfo so the job fits on the runner disk - [PR #45318](https://github.com/BerriAI/litellm/pull/45318)
- Add a `unit passed` collector job and fold the proxy-db shards into test-unit.yml - [PR #45466](https://github.com/BerriAI/litellm/pull/45466)
- Render lint, unit and smoke checks as `<tier> / <job>` with one required collector per tier - [PR #45480](https://github.com/BerriAI/litellm/pull/45480)
- Run only integration jobs on PR CircleCI pipelines and move the router and guardrails suites to GitHub Actions - [PR #45509](https://github.com/BerriAI/litellm/pull/45509)
- Run every build_and_test job in every CircleCI pipeline on rc/1.106.0 - [PR #45651](https://github.com/BerriAI/litellm/pull/45651)

</details>

<details>
<summary>Rust runtime and Python bridge (17)</summary>

- Derive string enum serde through strum and serde_with - [PR #44675](https://github.com/BerriAI/litellm/pull/44675)
- Rename the litellm-framing crate to litellm-framer - [PR #44683](https://github.com/BerriAI/litellm/pull/44683)
- Rename litellm-core to litellm-inference - [PR #44802](https://github.com/BerriAI/litellm/pull/44802)
- Extract the inference-transcription crate - [PR #44809](https://github.com/BerriAI/litellm/pull/44809)
- Extract the inference-responses crate - [PR #44811](https://github.com/BerriAI/litellm/pull/44811)
- Extract the inference-messages crate - [PR #44818](https://github.com/BerriAI/litellm/pull/44818)
- Extract the inference-chat crate - [PR #44827](https://github.com/BerriAI/litellm/pull/44827)
- Extract the inference-ocr crate - [PR #44832](https://github.com/BerriAI/litellm/pull/44832)
- Prune inference crate dependencies and rewrite the layering docs - [PR #44836](https://github.com/BerriAI/litellm/pull/44836)
- Extract the inference-testing crate - [PR #44873](https://github.com/BerriAI/litellm/pull/44873)
- Remove rule-gated native secret-manager selection - [PR #44906](https://github.com/BerriAI/litellm/pull/44906)
- Unify native call inputs and Messages settings - [PR #45126](https://github.com/BerriAI/litellm/pull/45126)
- Share field and response marshaling across bridge routes - [PR #45187](https://github.com/BerriAI/litellm/pull/45187)
- Take NativeCall directly and fold the Python bridge routes into per-route folders - [PR #45413](https://github.com/BerriAI/litellm/pull/45413)
- Derive strum VariantArray and string conversions - [PR #45434](https://github.com/BerriAI/litellm/pull/45434)
- Derive NativeCall extraction - [PR #45449](https://github.com/BerriAI/litellm/pull/45449)
- Ship a signature base and read the resolved call in the Python bridge - [PR #45450](https://github.com/BerriAI/litellm/pull/45450)

</details>

<details>
<summary>Refactors and typing (15)</summary>

- Clean up fresh tech debt from 2026-10-02 - [PR #44362](https://github.com/BerriAI/litellm/pull/44362)
- Replace Any with proven types in 4 files - [PR #44370](https://github.com/BerriAI/litellm/pull/44370)
- Replace Any with proven types in 9 files - [PR #44389](https://github.com/BerriAI/litellm/pull/44389)
- Replace Any with proven types in 137 files - [PR #44478](https://github.com/BerriAI/litellm/pull/44478)
- Clean up fresh tech debt from 2026-10-03 - [PR #44484](https://github.com/BerriAI/litellm/pull/44484)
- Replace Any with proven types in 6 files - [PR #44491](https://github.com/BerriAI/litellm/pull/44491)
- Drop the unused `Any` import in the harness options that failed lint on main - [PR #44625](https://github.com/BerriAI/litellm/pull/44625), [PR #44627](https://github.com/BerriAI/litellm/pull/44627)
- Move SpanAttributes, SpecialHeaders and AllowedModelRegion out of `litellm.proxy._types`, which still re-exports them - [PR #44717](https://github.com/BerriAI/litellm/pull/44717)
- Import proxy-only types under TYPE_CHECKING in SDK modules so `import litellm` skips `litellm.proxy._types` - [PR #44740](https://github.com/BerriAI/litellm/pull/44740)
- Replace Any with proven types in 157 files - [PR #44798](https://github.com/BerriAI/litellm/pull/44798)
- Remove fresh tech debt from the 2026-10-05 window - [PR #44821](https://github.com/BerriAI/litellm/pull/44821)
- Expose core private helpers under public names, keeping the old names as aliases - [PR #44871](https://github.com/BerriAI/litellm/pull/44871)
- Remove fresh tech debt from the 2026-10-06 window - [PR #45017](https://github.com/BerriAI/litellm/pull/45017)
- Replace Any with proven types in 16 files - [PR #45029](https://github.com/BerriAI/litellm/pull/45029)

</details>

<details>
<summary>Release and packaging (5)</summary>

- Bump litellm-proxy-extras 0.4.104 -&gt; 0.4.105 on main - [PR #44234](https://github.com/BerriAI/litellm/pull/44234)
- Bump litellm-enterprise 0.1.73 -&gt; 0.1.74, litellm-proxy-extras 0.4.105 -&gt; 0.4.106, litellm 1.105.0 -&gt; 1.106.0 - [PR #44942](https://github.com/BerriAI/litellm/pull/44942)
- Bump litellm-proxy-extras to 0.4.107 and litellm-enterprise to 0.1.75 - [PR #45291](https://github.com/BerriAI/litellm/pull/45291)
- Bump litellm-enterprise 0.1.75 -&gt; 0.1.76, litellm-proxy-extras 0.4.107 -&gt; 0.4.108 - [PR #45534](https://github.com/BerriAI/litellm/pull/45534)
- Rebuild the Admin UI bundle on rc/1.106.0 - [PR #45930](https://github.com/BerriAI/litellm/pull/45930)

</details>

<details>
<summary>Other tests and internal changes (28)</summary>

- Add `make lens-dev` to run the proxy, worker and dashboard together for local Lens development - [PR #44413](https://github.com/BerriAI/litellm/pull/44413)
- Type the ClickHouse query help response - [PR #44285](https://github.com/BerriAI/litellm/pull/44285)
- Extract the trace snapshot cache into its own crate - [PR #44424](https://github.com/BerriAI/litellm/pull/44424)
- Generate tracing HTTP request models from Rust schemas - [PR #44591](https://github.com/BerriAI/litellm/pull/44591)
- Inject Lens backends as services instead of a fake HTTP client - [PR #44369](https://github.com/BerriAI/litellm/pull/44369)
- Move TraceView into `components/lens/traces` - [PR #44501](https://github.com/BerriAI/litellm/pull/44501)
- Share CopyButton between Lens traces and logs - [PR #44513](https://github.com/BerriAI/litellm/pull/44513)
- Extract shared timeline and time-range controls - [PR #44584](https://github.com/BerriAI/litellm/pull/44584)
- Untrack `tsconfig.tsbuildinfo` and gitignore `*.tsbuildinfo` - [PR #44261](https://github.com/BerriAI/litellm/pull/44261)
- Migrate the dashboard to zod 4 and openai 6 - [PR #44345](https://github.com/BerriAI/litellm/pull/44345)
- Rename dashboard `view_logs` components to `logs` and split them into request, audit and detail - [PR #44505](https://github.com/BerriAI/litellm/pull/44505)
- Route dev dashboard API calls on `Accept: application/json` and fail fast on non-JSON 2xx responses - [PR #44528](https://github.com/BerriAI/litellm/pull/44528)
- Route dashboard URL state through nuqs parsers - [PR #44537](https://github.com/BerriAI/litellm/pull/44537)
- Add standalone typed LLM wire contracts to the Rust `llms-types` crate - [PR #45188](https://github.com/BerriAI/litellm/pull/45188)
- Path-qualify Rust attribute aliases so rust-analyzer resolves them - [PR #45416](https://github.com/BerriAI/litellm/pull/45416)
- Add the Anthropic beta header policy to the Rust crates, not yet wired into requests - [PR #45419](https://github.com/BerriAI/litellm/pull/45419)
- Add the `inline-tools-2026-09-15` beta to the Rust `AnthropicBeta` list - [PR #45439](https://github.com/BerriAI/litellm/pull/45439)
- Remove the dead `Cache._native_cache` runtime path and its Rust bridge code - [PR #44785](https://github.com/BerriAI/litellm/pull/44785)
- Rebuild the Rust bridge on `uv sync` when Rust sources change - [PR #44708](https://github.com/BerriAI/litellm/pull/44708)
- Expose public names for private provider helpers - [PR #45037](https://github.com/BerriAI/litellm/pull/45037)
- Expose public names for private proxy helpers - [PR #45170](https://github.com/BerriAI/litellm/pull/45170)
- Inject one UTC clock read per operation into gateway tracking, PTU rollup and Mavvrik export - [PR #45520](https://github.com/BerriAI/litellm/pull/45520)
- Rename `management/teams/access.py` to `authz.py`, keeping a re-export shim - [PR #44624](https://github.com/BerriAI/litellm/pull/44624)
- Remove the publicly known master key from docs, tests and CI, and add a CI guard against reintroducing it - [PR #44718](https://github.com/BerriAI/litellm/pull/44718)
- Add and then revert cost-map candidate reordering for rule-only model names (no net change) - [PR #44144](https://github.com/BerriAI/litellm/pull/44144), [PR #44335](https://github.com/BerriAI/litellm/pull/44335)
- Fix MCP tool listing return types and remove a redundant wrapper - [PR #44556](https://github.com/BerriAI/litellm/pull/44556)
- Type Moyai connect helpers and read MCP server `rpm` directly - [PR #45315](https://github.com/BerriAI/litellm/pull/45315)
- Backport three stale e2e test fixes from `main` - [PR #47229](https://github.com/BerriAI/litellm/pull/47229)

</details>

### PR roll-up by ownership area

Customer-facing PRs: **397**. Tests, CI and internal PRs: **166**. Total: **563**

- Other (tests, CI, internal): 166
- Models & Providers: 107
- UI: 77
- Logging & Tracing: 72
- Performance: 41
- LLM API Endpoints: 26
- Spend / Budgets / Rate Limits: 25
- Auth & Management: 22
- MCP: 15
- Guardrails: 11
- Docs: 1

## New Contributors

- [@Aasif-Multani](https://github.com/Aasif-Multani) made their first contribution in [PR #44183](https://github.com/BerriAI/litellm/pull/44183)
- [@amarrtech](https://github.com/amarrtech) made their first contribution in [PR #43959](https://github.com/BerriAI/litellm/pull/43959)
- [@ankitasahni511](https://github.com/ankitasahni511) made their first contribution in [PR #42242](https://github.com/BerriAI/litellm/pull/42242)
- [@anniejeng](https://github.com/anniejeng) made their first contribution in [PR #44278](https://github.com/BerriAI/litellm/pull/44278)
- [@Bernedotcom2312](https://github.com/Bernedotcom2312) made their first contribution in [PR #42141](https://github.com/BerriAI/litellm/pull/42141)
- [@D41910](https://github.com/D41910) made their first contribution in [PR #44800](https://github.com/BerriAI/litellm/pull/44800)
- [@hektorjg](https://github.com/hektorjg) made their first contribution in [PR #44508](https://github.com/BerriAI/litellm/pull/44508)
- [@hyamie](https://github.com/hyamie) made their first contribution in [PR #46594](https://github.com/BerriAI/litellm/pull/46594)
- [@jimaldon](https://github.com/jimaldon) made their first contribution in [PR #40924](https://github.com/BerriAI/litellm/pull/40924)
- [@joeym82956](https://github.com/joeym82956) made their first contribution in [PR #44318](https://github.com/BerriAI/litellm/pull/44318)
- [@kohjunhao](https://github.com/kohjunhao) made their first contribution in [PR #44173](https://github.com/BerriAI/litellm/pull/44173)
- [@mayuriphad](https://github.com/mayuriphad) made their first contribution in [PR #38617](https://github.com/BerriAI/litellm/pull/38617)
- [@misbahsy](https://github.com/misbahsy) made their first contribution in [PR #43673](https://github.com/BerriAI/litellm/pull/43673)
- [@msdianprince-7](https://github.com/msdianprince-7) made their first contribution in [PR #38729](https://github.com/BerriAI/litellm/pull/38729)
- [@nilpntr](https://github.com/nilpntr) made their first contribution in [PR #44577](https://github.com/BerriAI/litellm/pull/44577)
- [@ninadphalak](https://github.com/ninadphalak) made their first contribution in [PR #42645](https://github.com/BerriAI/litellm/pull/42645)
- [@RachelHuangZW](https://github.com/RachelHuangZW) made their first contribution in [PR #43061](https://github.com/BerriAI/litellm/pull/43061)
- [@rohan-akto](https://github.com/rohan-akto) made their first contribution in [PR #44343](https://github.com/BerriAI/litellm/pull/44343)
- [@Solomon-mithra](https://github.com/Solomon-mithra) made their first contribution in [PR #31942](https://github.com/BerriAI/litellm/pull/31942)
- [@sorgfresser](https://github.com/sorgfresser) made their first contribution in [PR #42281](https://github.com/BerriAI/litellm/pull/42281)
- [@SteffanWolter](https://github.com/SteffanWolter) made their first contribution in [PR #40108](https://github.com/BerriAI/litellm/pull/40108)
- [@wakqasahmed](https://github.com/wakqasahmed) made their first contribution in [PR #42213](https://github.com/BerriAI/litellm/pull/42213)
- [@yamaceay](https://github.com/yamaceay) made their first contribution in [PR #39122](https://github.com/BerriAI/litellm/pull/39122)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.105.0...v1.106.0
