---
title: "v1.102.0 - Auto Router Controls, Native OCR & Gateway Reliability"
slug: "v1-102-0"
date: 2026-09-19T00:00:00
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
docker.litellm.ai/berriai/litellm:1.102.0
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.102.0
```

</TabItem>
</Tabs>


:::danger Breaking Changes

These callouts cover changes to behavior available in `v1.101.0`, the previous stable release

**Organization endpoints now require an enterprise license.** Unlicensed calls to organization APIs return 403 after authentication. Enable the license before using organization APIs. See [PR #40613](https://github.com/BerriAI/litellm/pull/40613)

**Responses IDs are authorized regardless of their format.** Provider IDs this proxy did not issue are refused by default for retrieval, cancellation, deletion, and chaining. Set `allow_unmanaged_response_ids` only on deployments that intentionally accept unmanaged IDs. See [PR #39548](https://github.com/BerriAI/litellm/pull/39548)

**New model writes no longer accept pricing overrides through `model_info`.** Put custom pricing in `litellm_params`. Clients that echoed displayed catalog rates into `model_info` will now keep following the catalog. See [PR #36222](https://github.com/BerriAI/litellm/pull/36222)

**Supported OCR uses the native engine by default, and Rust controls are now process-wide.** Replace `LITELLM_USE_RUST_OCR` and per-request or deployment `rust` settings with `LITELLM_RUST` or `litellm.rust(bool)`. Use `LITELLM_RUST=0` for the Python OCR path. See [PR #40734](https://github.com/BerriAI/litellm/pull/40734), [PR #39928](https://github.com/BerriAI/litellm/pull/39928)

**Auto Router replaces the caller’s output cap with the selected tier model’s limit by default.** Per-tier limits still take precedence. Set `max_tokens_from_tier_model: false` to retain the caller’s cap. See [PR #40209](https://github.com/BerriAI/litellm/pull/40209)

**Editing multiple heuristic-v1 routers requires the auto-router license.** Existing snapshots and unchanged defaults remain valid; one changed router is available without the license. A second tuned router is refused. See [PR #39952](https://github.com/BerriAI/litellm/pull/39952), [PR #40007](https://github.com/BerriAI/litellm/pull/40007)

**Prompt Security blocks file-modification verdicts by default.** Set `block_on_file_modify: false` if your workflow intentionally accepts rewritten files. See [PR #38204](https://github.com/BerriAI/litellm/pull/38204)

**Existing Bedrock and Azure passthrough requests enforce the resolved model’s access rules.** Relays must use models granted to the key and team. Update grants for integrations that previously relied on broader passthrough access. See [PR #39660](https://github.com/BerriAI/litellm/pull/39660), [PR #39863](https://github.com/BerriAI/litellm/pull/39863)

**MCP requests enforce server and end-user tool grants more strictly.** Initializing with no granted MCP servers returns 403, denied served-MCP tools are no longer silently omitted, and end-user tool permissions constrain listing and calls. Grant the required servers, access groups, and tools. See [PR #39234](https://github.com/BerriAI/litellm/pull/39234), [PR #40616](https://github.com/BerriAI/litellm/pull/40616), [PR #40865](https://github.com/BerriAI/litellm/pull/40865)

**Policy pipeline ordering is now deterministic.** Pipelines run from global to team, key, tag, then model scope, followed by explicitly requested policies. Review workflows whose result depended on the previous unspecified order. See [PR #39697](https://github.com/BerriAI/litellm/pull/39697)

**Marengo 2.7 embedding usage reports request and image counts instead of estimated tokens.** Update consumers that depended on nonzero token usage. Billing now uses request, image, and duration rates. See [PR #40180](https://github.com/BerriAI/litellm/pull/40180)

**MAI image requests validate count and size instead of silently ignoring them.** Use `n: 1` and supported generation dimensions. Image edits do not support `size`; enable `drop_params` to omit unsupported options. See [PR #40074](https://github.com/BerriAI/litellm/pull/40074)

**GPT-5.1, GPT-5.2, GPT-5.4, and GPT-5.4 Pro no longer advertise minimal reasoning effort.** This includes their dated snapshots. Use a supported effort or `drop_params` for requests that previously sent `minimal`. See [PR #40581](https://github.com/BerriAI/litellm/pull/40581)

**Headerless Azure Realtime clients use the GA upstream by default.** Beta clients must send `OpenAI-Beta: realtime=v1` or pin `realtime_protocol` / `LITELLM_AZURE_REALTIME_PROTOCOL`. Health checks follow the GA default. See [PR #40769](https://github.com/BerriAI/litellm/pull/40769)

**Very large local token counts become sampled estimates.** The default exact-count ceiling is 4,000,000 characters per string. Set `TOKEN_COUNTER_MAX_EXACT_CHARS` to choose a different limit. See [PR #40186](https://github.com/BerriAI/litellm/pull/40186)

**Model health checks enforce deployment visibility and limit returned fields.** Explicit out-of-scope targets return 403, team-specific deployments follow routing permissions, and results contain an allowlist of display fields. Update monitoring clients that depended on the previous responses. See [PR #40765](https://github.com/BerriAI/litellm/pull/40765)

**The existing lite login --config-claude command now writes a static gateway token.** Claude Code settings previously used `apiKeyHelper` to retrieve the login token dynamically. Rerun `lite login --config-claude` when the stored login key expires. See [PR #40330](https://github.com/BerriAI/litellm/pull/40330)

:::

## Key Highlights

- **Auto Router controls and visibility**: custom heuristic dimensions, editable scoring weights, an optional NON_REASONING tier, per-tier output limits, healthier fallbacks, and routed-model/session-savings feedback for coding agents
- **Native OCR and expanded provider endpoints**: native OCR execution across supported providers, Meta Muse Voice realtime transcription, Mistral text-to-speech, Vertex Lyria music, and native Fireworks Responses
- **Gateway reliability**: optional shared PgBouncer connections and a spend collector, fewer database and Redis calls, stable Redis outage handling, and request/token-based autoscaling controls
- **MCP, logging, and guardrails**: schema-discovery proxy mode, improved OAuth compatibility and permission enforcement, configurable OTel trace URLs and HTTP/JSON export, PointFive logging, Conduct Guard, and broader post-call pipeline coverage
- **99 new model catalog entries**: additions across Bedrock, Azure AI, OpenAI, Fireworks, OpenRouter, Together AI, and other providers, alongside pricing and capability corrections

## Included after the v1.102.0-rc.1 cut

The stable tag includes these release-line additions, including changes after rc.2:

- **Provider request bodies** drop LiteLLM-internal params, keep `extra_headers` out of the chat body on the httpx handler path, filter bridged kwargs the way the native Responses path does, and stop sending the addressed response id to bridged providers - [PR #41018](https://github.com/BerriAI/litellm/pull/41018), [PR #41141](https://github.com/BerriAI/litellm/pull/41141), [PR #41144](https://github.com/BerriAI/litellm/pull/41144), [PR #41689](https://github.com/BerriAI/litellm/pull/41689).
- **Image edits** stop forwarding the raw `image[]` and `mask[]` form keys upstream - [PR #39512](https://github.com/BerriAI/litellm/pull/39512).
- **Spend and budgets** track spend for streams a deployment hook converted to non-streaming, run the post-call deployment hook on those converted chat streams, and apply `team_member_budget` updates to members still on the team default - [PR #41171](https://github.com/BerriAI/litellm/pull/41171), [PR #41495](https://github.com/BerriAI/litellm/pull/41495), [PR #41347](https://github.com/BerriAI/litellm/pull/41347).
- **Routing and retries** replay rate-limit fallbacks from a pristine request snapshot and bind per-request `routing_strategy` override selectors to that request's callbacks - [PR #40596](https://github.com/BerriAI/litellm/pull/40596), [PR #41178](https://github.com/BerriAI/litellm/pull/41178).
- **Auth and management** let a wildcard `allowed_features` license grant the `auto_router` feature, keep org admins' own team memberships in other organizations visible on team list, and keep access-group raw SQL writes on the writer while `writer_unavailable` is stale - [PR #41684](https://github.com/BerriAI/litellm/pull/41684), [PR #41086](https://github.com/BerriAI/litellm/pull/41086), [PR #41283](https://github.com/BerriAI/litellm/pull/41283).
- **CLI** imports on Python 3.10 again after dropping `enum.StrEnum` - [PR #41046](https://github.com/BerriAI/litellm/pull/41046).

## New Providers and Endpoints

### Expanded provider endpoint support

| Provider | Endpoint | What you can do |
| --- | --- | --- |
| [Meta](../../docs/providers/meta) | `/v1/realtime` | Stream Muse Voice transcription using OpenAI-compatible realtime events |
| [Fireworks AI](../../docs/providers/fireworks_ai) | `/v1/responses` | Use Fireworks’ native Responses API, including server-side MCP and chaining |
| [Mistral](../../docs/providers/mistral) | `/v1/audio/speech` | Generate speech with Voxtral TTS and supported voice-cloning inputs |
| [Vertex AI](../../docs/providers/vertex) | `/v1/audio/speech` | Generate music with Lyria models |
| [Hosted vLLM](../../docs/providers/vllm) | `/v1/images/edits` | Use image editing through hosted vLLM deployments |

## New Models / Updated Models

#### New Model Support (99 new models)

Counts represent new catalog identifiers, including aliases and regional variants. Prices below are the values bundled in this release, in USD; runtime pricing-map reloads can update them. Input and output columns show base token rates; long-context, cache, image-token, and other specialized rates depend on the model

| Provider | Model | Context Window | Input ($/1M tokens) | Output ($/1M tokens) | Features / special pricing |
| --- | --- | --- | --- | --- | --- |
| Azure AI | `azure_ai/codex-mini` | 200,000 | $1.5 | $6 | Responses; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; System messages; Parallel tools |
| Azure AI | `azure_ai/cohere-command-a` | 131,072 | $2.5 | $10 | Chat; Tool calling; Tool choice |
| Azure AI | `azure_ai/gpt-6-astra` | 922,000 | $10 | $50 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Computer use; Web search; System messages; Parallel tools |
| Azure AI | `azure_ai/gpt-chat-latest` | 272,000 | $5 | $30 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search; System messages; Parallel tools |
| Azure AI | `azure_ai/grok-4-20-non-reasoning` | 262,000 | $1.25 | $2.5 | Chat; Vision; Tool calling; Tool choice; Structured output; Web search |
| Azure AI | `azure_ai/grok-4-20-reasoning` | 262,000 | $1.25 | $2.5 | Chat; Reasoning; Vision; Tool calling; Tool choice; Structured output; Web search |
| Azure AI | `azure_ai/model-router` | 200,000 | $0.14 | $0 | Chat |
| Azure AI | `azure_ai/whisper` | - | - | - | Transcription; `input_cost_per_second`: $0.0001; `output_cost_per_second`: $0.0001 |
| Amazon Bedrock | `bedrock/us-gov-east-1/anthropic.claude-fable-5-1` | 1,000,000 | $12 | $60 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `bedrock/us-gov-east-1/anthropic.claude-opus-5` | 1,000,000 | $6 | $30 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `bedrock/us-gov-east-1/nvidia.nemotron-nano-9b-v2` | 128,000 | $0.072 | $0.276 | Chat; System messages |
| Amazon Bedrock | `bedrock/us-gov-west-1/amazon.nova-2-multimodal-embeddings-v1:0` | 8,172 | $0.162 | $0 | Embeddings; Audio input; `input_cost_per_audio_per_second`: $0.000168; `input_cost_per_image`: $7.2e-05; `input_cost_per_video_per_second`: $0.00084 |
| Amazon Bedrock | `bedrock/us-gov-west-1/amazon.nova-lite-v1:0` | 300,000 | $0.072 | $0.288 | Chat; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input |
| Amazon Bedrock | `bedrock/us-gov-west-1/amazon.nova-micro-v1:0` | 128,000 | $0.042 | $0.168 | Chat; Tool calling; Tool choice; Prompt caching; Structured output |
| Amazon Bedrock | `bedrock/us-gov-west-1/anthropic.claude-fable-5-1` | 1,000,000 | $12 | $60 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `bedrock/us-gov-west-1/anthropic.claude-opus-5` | 1,000,000 | $6 | $30 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `bedrock/us-gov-west-1/nvidia.nemotron-nano-9b-v2` | 128,000 | $0.072 | $0.276 | Chat; System messages |
| Amazon Bedrock | `eu.twelvelabs.marengo-embed-3-0-v1:0` | 500 | - | $0 | Embeddings; `input_cost_per_audio_per_second`: $0.00014; `input_cost_per_image`: $0.0001; `input_cost_per_query`: $7e-05; `input_cost_per_video_per_second`: $0.0007 |
| Amazon Bedrock | `global.cohere.embed-v4:0` | 128,000 | $0.12 | $0 | Embeddings |
| Amazon Bedrock | `global.twelvelabs.pegasus-1-2-v1:0` | - | - | $7.5 | Chat; `input_cost_per_video_per_second`: $0.00049 |
| Amazon Bedrock | `twelvelabs.marengo-embed-3-0-v1:0` | 500 | - | $0 | Embeddings; `input_cost_per_audio_per_second`: $0.00014; `input_cost_per_image`: $0.0001; `input_cost_per_query`: $7e-05; `input_cost_per_video_per_second`: $0.0007 |
| Amazon Bedrock | `us.cohere.embed-v4:0` | 128,000 | $0.12 | $0 | Embeddings |
| Amazon Bedrock | `us.twelvelabs.marengo-embed-3-0-v1:0` | 500 | - | $0 | Embeddings; `input_cost_per_audio_per_second`: $0.00014; `input_cost_per_image`: $0.0001; `input_cost_per_query`: $7e-05; `input_cost_per_video_per_second`: $0.0007 |
| Amazon Bedrock | `global.openai.gpt-6-astra` | 1,050,000 | $10 | $50 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching |
| Amazon Bedrock | `us-gov.anthropic.claude-3-haiku-20240307-v1:0` | 200,000 | $0.3 | $1.5 | Chat; Vision; Tool calling; Tool choice; Structured output; PDF input |
| Amazon Bedrock | `us-gov.anthropic.claude-fable-5-1` | 1,000,000 | $12 | $60 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `us-gov.anthropic.claude-opus-5` | 1,000,000 | $6 | $30 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `us-gov.nvidia.nemotron-nano-12b-v2` | 128,000 | $0.24 | $0.72 | Chat; Vision; System messages |
| Amazon Bedrock | `us-gov.nvidia.nemotron-nano-3-30b` | 262,144 | $0.072 | $0.288 | Chat; Tool calling; Tool choice; System messages |
| Amazon Bedrock | `us-gov.nvidia.nemotron-nano-9b-v2` | 128,000 | $0.072 | $0.276 | Chat; System messages |
| Amazon Bedrock | `us-gov.nvidia.nemotron-super-3-120b` | 256,000 | $0.18 | $0.78 | Chat; Reasoning; Tool calling; Tool choice; System messages |
| Amazon Bedrock | `us-gov.openai.gpt-oss-120b-1:0` | 128,000 | $0.18 | $0.72 | Chat; Reasoning; Tool calling; Tool choice; Structured output |
| Amazon Bedrock | `us-gov.openai.gpt-oss-20b-1:0` | 128,000 | $0.084 | $0.36 | Chat; Reasoning; Tool calling; Tool choice; Structured output |
| Amazon Bedrock | `us-gov.xai.grok-4.6` | 500,000 | $2.64 | $7.92 | Chat; Reasoning; Vision; Tool calling; Tool choice |
| Amazon Bedrock | `us.openai.gpt-6-astra` | 1,050,000 | $11 | $55 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching |
| Bedrock Mantle | `bedrock_mantle/openai.gpt-6-astra` | 1,050,000 | $11 | $55 | Responses; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output |
| Bedrock Mantle | `bedrock_mantle/openai.gpt-daybreak-blue-5.6-sol` | 1,050,000 | $5.5 | $33 | Responses; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output |
| Bedrock Mantle | `bedrock_mantle/us-gov-east-1/openai.gpt-oss-120b` | 131,072 | $0.18 | $0.72 | Chat; Reasoning; Tool calling; Tool choice; Structured output; Parallel tools |
| Bedrock Mantle | `bedrock_mantle/us-gov-east-1/openai.gpt-oss-20b` | 131,072 | $0.084 | $0.36 | Chat; Reasoning; Tool calling; Tool choice; Structured output; Parallel tools |
| Bedrock Mantle | `bedrock_mantle/us-gov-east-1/xai.grok-4.6` | 500,000 | $2.64 | $7.92 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output |
| Bedrock Mantle | `bedrock_mantle/us-gov-west-1/google.gemma-4-26b-a4b` | 256,000 | $0.156 | $0.48 | Chat; Reasoning; Vision; Tool calling; Tool choice |
| Bedrock Mantle | `bedrock_mantle/us-gov-west-1/google.gemma-4-31b` | 256,000 | $0.168 | $0.48 | Chat; Reasoning; Vision; Tool calling; Tool choice |
| Bedrock Mantle | `bedrock_mantle/us-gov-west-1/google.gemma-4-e2b` | 128,000 | $0.048 | $0.096 | Chat; Reasoning; Vision; Tool calling; Tool choice |
| Bedrock Mantle | `bedrock_mantle/us-gov-west-1/openai.gpt-oss-120b` | 131,072 | $0.18 | $0.72 | Chat; Reasoning; Tool calling; Tool choice; Structured output; Parallel tools |
| Bedrock Mantle | `bedrock_mantle/us-gov-west-1/openai.gpt-oss-20b` | 131,072 | $0.084 | $0.36 | Chat; Reasoning; Tool calling; Tool choice; Structured output; Parallel tools |
| Bedrock Mantle | `bedrock_mantle/us-gov-west-1/xai.grok-4.6` | 500,000 | $2.64 | $7.92 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output |
| Cerebras | `cerebras/qwen-3.8-27b` | 65,536 | $0.99 | $1.49 | Chat; Reasoning; Vision; Tool calling; Tool choice; Structured output; Parallel tools |
| ChatGPT subscription | `chatgpt/gpt-5.5` | 1,050,000 | - | - | Responses; Vision; Tool calling; Structured output; Parallel tools; Subscription access; no per-token price in catalog |
| ChatGPT subscription | `chatgpt/gpt-5.6-luna` | 1,050,000 | - | - | Responses; Vision; Tool calling; Structured output; Parallel tools; Subscription access; no per-token price in catalog |
| ChatGPT subscription | `chatgpt/gpt-5.6-sol` | 1,050,000 | - | - | Responses; Vision; Tool calling; Structured output; Parallel tools; Subscription access; no per-token price in catalog |
| ChatGPT subscription | `chatgpt/gpt-5.6-terra` | 1,050,000 | - | - | Responses; Vision; Tool calling; Structured output; Parallel tools; Subscription access; no per-token price in catalog |
| Cohere | `rerank-v4.0-fast` | 32,768 | $0 | $0 | Rerank; `input_cost_per_query`: $0.002 |
| Cohere | `rerank-v4.0-pro` | 32,768 | $0 | $0 | Rerank; `input_cost_per_query`: $0.0025 |
| DeepSeek | `deepseek-flash` | 1,000,000 | $0.3 | $1.2 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; System messages; Parallel tools; Assistant prefill |
| DeepSeek | `deepseek/deepseek-flash` | 1,000,000 | $0.3 | $1.2 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; System messages; Parallel tools; Assistant prefill |
| Fireworks AI | `fireworks_ai/accounts/fireworks/models/deepseek-v4p1-flash` | 1,048,576 | $0.22 | $0.66 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output |
| Fireworks AI | `fireworks_ai/deepseek-v4p1-flash` | 1,048,576 | $0.22 | $0.66 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output |
| Gemini | `gemini/lyria-3.5` | 1,048,576 | $0 | $0 | Chat; Audio output; `output_cost_per_image`: $0.08 |
| Inception | `inception/mercury-2.5` | 260,000 | $0.2 | $0.75 | Chat; Tool calling; Tool choice; Structured output; System messages |
| Meta | `meta/muse-voice-transcribe-1.0` | - | - | - | Realtime transcription; Audio input; `input_cost_per_second`: $5e-05 |
| OpenAI | `gpt-image-2.5-flare` | - | $5 | - | Image generation; Vision; PDF input; `input_cost_per_image_token`: $8e-06; `output_cost_per_image_token`: $3e-05 |
| OpenAI | `gpt-image-2.5-flare-2026-09-08` | - | $5 | - | Image generation; Vision; PDF input; `input_cost_per_image_token`: $8e-06; `output_cost_per_image_token`: $3e-05 |
| OpenAI | `gpt-image-2.5-sunburst` | - | $5 | - | Image generation; Vision; PDF input; `input_cost_per_image_token`: $8e-06; `output_cost_per_image_token`: $3e-05 |
| OpenAI | `gpt-image-2.5-sunburst-2026-09-08` | - | $5 | - | Image generation; Vision; PDF input; `input_cost_per_image_token`: $8e-06; `output_cost_per_image_token`: $3e-05 |
| OpenAI | `gpt-live-1` | - | - | - | Realtime; Tool calling; Audio input; Audio output; `input_cost_per_second`: $0.000833333333333 |
| OpenRouter | `openrouter/deepseek/deepseek-v4.1-flash` | 1,048,576 | $0.15 | $0.6 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output |
| OpenRouter | `openrouter/openai/gpt-5.6-luna-pro` | 1,050,000 | $0.2 | $1.2 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input |
| OpenRouter | `openrouter/openai/gpt-5.6-sol` | 1,050,000 | $2 | $10 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input |
| OpenRouter | `openrouter/openai/gpt-5.6-sol-pro` | 1,050,000 | $2 | $10 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input |
| OpenRouter | `openrouter/openai/gpt-5.6-terra-pro` | 1,050,000 | $2 | $12 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input |
| OpenRouter | `openrouter/openai/gpt-6-astra-pro` | 1,050,000 | $10 | $50 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input |
| OpenRouter | `openrouter/openai/gpt-chat-latest` | 400,000 | $5 | $30 | Chat; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input |
| OpenRouter | `openrouter/qwen/qwen3.8-max-0902` | 1,000,000 | $2 | $6 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output |
| Together AI | `together_ai/MiniMaxAI/MiniMax-M2.7` | 196,608 | $0.3 | $1.2 | Chat |
| Together AI | `together_ai/Qwen/QwQ-32B` | 131,072 | $1.2 | $1.2 | Chat |
| Together AI | `together_ai/Qwen/Qwen3-Coder-Next-FP8` | 262,144 | $0.5 | $1.2 | Chat |
| Together AI | `together_ai/Qwen/Qwen3-VL-32B-Instruct` | 262,144 | $0.5 | $1.5 | Chat |
| Together AI | `together_ai/Qwen/Qwen3-VL-8B-Instruct` | 262,144 | $0.18 | $0.68 | Chat |
| Together AI | `together_ai/deepseek-ai/DeepSeek-R1-0528` | 163,840 | $3 | $7 | Chat |
| Together AI | `together_ai/mistralai/Ministral-3-14B-Instruct-2512` | 262,144 | $0.2 | $0.2 | Chat |
| Together AI | `together_ai/mistralai/Mistral-7B-Instruct-v0.3` | 32,768 | $0.2 | $0.2 | Chat |
| Together AI | `together_ai/moonshotai/Kimi-K2.5-fp4` | 262,144 | $0.5 | $2.8 | Chat |
| Together AI | `together_ai/moonshotai/Kimi-K2.6` | 262,144 | $1.2 | $4.5 | Chat |
| Together AI | `together_ai/nvidia/NVIDIA-Nemotron-Nano-9B-v2` | 131,072 | $0.06 | $0.25 | Chat |
| Together AI | `together_ai/zai-org/GLM-5` | 202,752 | $1 | $3.2 | Chat |
| Together AI | `together_ai/zai-org/GLM-5.1` | 202,752 | $1.4 | $4.4 | Chat |
| Vertex AI | `vertex_ai/gemini-3.5-live-translate-preview` | - | $3.5 | $21 | Realtime; Audio input; Audio output; `input_cost_per_audio_token`: $3.5e-06; `output_cost_per_audio_token`: $2.1e-05 |
| Vertex AI | `vertex_ai/lyria-002` | - | - | - | Audio generation; Audio output; `output_cost_per_image`: $0.06 |
| Vertex AI | `vertex_ai/lyria-3-clip-preview` | 131,072 | $0 | $0 | Audio generation; Audio output; `output_cost_per_image`: $0.04 |
| Vertex AI | `vertex_ai/lyria-3-pro-preview` | 131,072 | $0 | $0 | Audio generation; Audio output; `output_cost_per_image`: $0.08 |
| Vertex AI | `vertex_ai/xai/grok-4.3` | 200,000 | $1.25 | $2.5 | Chat; Reasoning; Vision; Tool calling; Tool choice; Structured output |
| Vertex AI | `vertex_ai/xai/grok-4.6` | 524,288 | $2 | $6 | Chat; Reasoning; Vision; Tool calling; Tool choice; Structured output |
| Voyage | `voyage/voyage-multilingual-2` | 32,000 | $0.12 | $0 | Embeddings |
| Weights & Biases | `wandb/deepseek-ai/DeepSeek-V4-Pro-0813` | - | $1.31 | $3.96 | Chat; Reasoning; Prompt caching |
| Weights & Biases | `wandb/ibm-granite/granite-4.2-8b` | - | $0.1 | $0.15 | Chat; Reasoning; Prompt caching |
| xAI | `xai/grok-imagine-video` | - | - | - | Video generation; `input_cost_per_image`: $0.002; `output_cost_per_second`: $0.05; `output_cost_per_second_480p`: $0.05; `output_cost_per_second_720p`: $0.07 |
| xAI | `xai/grok-imagine-video-1.5` | - | - | - | Video generation; `input_cost_per_image`: $0.01; `output_cost_per_second`: $0.08; `output_cost_per_second_1080p`: $0.25; `output_cost_per_second_480p`: $0.08; `output_cost_per_second_720p`: $0.14 |
| xAI | `xai/grok-imagine-video-1.5-2026-05-30` | - | - | - | Video generation; `input_cost_per_image`: $0.01; `output_cost_per_second`: $0.08; `output_cost_per_second_1080p`: $0.25; `output_cost_per_second_480p`: $0.08; `output_cost_per_second_720p`: $0.14 |
| xAI | `xai/grok-imagine-video-1.5-preview` | - | - | - | Video generation; `input_cost_per_image`: $0.01; `output_cost_per_second`: $0.08; `output_cost_per_second_1080p`: $0.25; `output_cost_per_second_480p`: $0.08; `output_cost_per_second_720p`: $0.14 |

A dash means the catalog does not define that token-based price or context field. Non-token pricing fields above use their named billing unit

#### Updated pricing

| Provider / model | Changed token prices (USD per 1M tokens) |
| --- | --- |
| `bedrock_mantle/openai.gpt-oss-20b` | Input: $0.075 to $0.07 |
| `bedrock_mantle/openai.gpt-oss-safeguard-20b` | Input: $0.075 to $0.07; Output: $0.3 to $0.2 |
| `deepseek-v4-flash` | Input: $0.44 to $0.3; Output: $1.32 to $1.2; Cache read: $0.014 to $0.006 |
| `deepseek-v4-flash-vision-exp` | Input: $0.44 to $0.3; Output: $1.32 to $1.2; Cache read: $0.014 to $0.006 |
| `deepseek/deepseek-v4-flash` | Input: $0.44 to $0.3; Output: $1.32 to $1.2; Cache read: $0.014 to $0.006 |
| `deepseek/deepseek-v4-flash-vision-exp` | Input: $0.44 to $0.3; Output: $1.32 to $1.2; Cache read: $0.014 to $0.006 |
| `eu.anthropic.claude-3-5-haiku-20241022-v1:0` | Input: $0.25 to $0.8; Output: $1.25 to $4; Cache read: $0.025 to $0.08; Cache write: $0.3125 to $1 |
| `eu.twelvelabs.marengo-embed-2-7-v1:0` | Input: $70 to not set |
| `gpt-5.4-pro` | Cache read: $3 to not set |
| `gpt-5.4-pro-2026-03-05` | Cache read: $3 to not set |
| `gpt-5.5-pro` | Cache read: $3 to not set |
| `gpt-5.5-pro-2026-04-23` | Cache read: $3 to not set |
| `jina-reranker-v2-base-multilingual` | Input: $0.018 to $0.05; Output: $0.018 to $0 |
| `openrouter/deepseek/deepseek-chat-v3.1` | Input: $0.2 to $0.25; Output: $0.8 to $0.95; Cache read: not set to $0.13 |
| `openrouter/deepseek/deepseek-v4-flash` | Input: $0.08778 to $0.0854; Output: $0.17556 to $0.1708; Cache read: $0.017556 to $0.01708 |
| `openrouter/deepseek/deepseek-v4-pro` | Input: $1.32 to $0.859908; Output: $3.96 to $1.719816; Cache read: not set to $0.071659 |
| `openrouter/deepseek/deepseek-v4-pro-0813` | Input: $1.32 to $0.57948; Output: $3.96 to $1.73844; Cache read: not set to $0.019316 |
| `openrouter/google/gemma-4-26b-a4b-it` | Input: $0.07 to $0.042; Output: $0.34 to $0.22 |
| `openrouter/moonshotai/kimi-k2.7-code` | Input: $0.66 to $0.71; Output: $3.4 to $3.5; Cache read: $0.18 to $0.15 |
| `openrouter/moonshotai/kimi-k3` | Input: $3 to $2.1; Output: $15 to $10.53; Cache read: $0.3 to $0.235 |
| `openrouter/qwen/qwen3-14b` | Input: $0.12 to $0.2275; Output: $0.24 to $0.91 |
| `openrouter/qwen/qwen3-235b-a22b-2507` | Input: $0.0875 to $0.22; Output: $0.35 to $0.88 |
| `openrouter/qwen/qwen3-30b-a3b-instruct-2507` | Input: $0.04815 to $0.09; Output: $0.19305 to $0.3 |
| `openrouter/qwen/qwen3-next-80b-a3b-instruct` | Input: $0.1 to $0.09 |
| `openrouter/qwen/qwen3.5-122b-a10b` | Input: $0.29 to $0.26; Output: $2.4 to $2.08 |
| `openrouter/qwen/qwen3.5-35b-a3b` | Input: $0.25 to $0.3125; Cache read: not set to $0.15625 |
| `openrouter/z-ai/glm-4.6` | Input: $0.55 to $0.43; Output: $2.2 to $1.75; Cache read: not set to $0.08 |
| `openrouter/z-ai/glm-5.2` | Input: $0.966 to $0.6; Output: $3.036 to $2; Cache read: $0.1932 to $0.15 |
| `openrouter/z-ai/glm-5.3-flash` | Input: $0.075 to $0.15; Output: $0.25 to $0.5; Cache read: $0.015 to $0.03 |
| `together_ai/Qwen/Qwen2.5-72B-Instruct-Turbo` | Input: not set to $1.2; Output: not set to $1.2 |
| `together_ai/Qwen/Qwen2.5-7B-Instruct-Turbo` | Input: not set to $0.3; Output: not set to $0.3 |
| `together_ai/mistralai/Mistral-7B-Instruct-v0.1` | Input: not set to $0.2; Output: not set to $0.2 |
| `together_ai/mistralai/Mistral-Small-24B-Instruct-2501` | Input: not set to $0.1; Output: not set to $0.3 |
| `twelvelabs.marengo-embed-2-7-v1:0` | Input: $70 to not set |
| `us.twelvelabs.marengo-embed-2-7-v1:0` | Input: $70 to not set |
| `vertex_ai/gemini-3.5-transcribe-preview` | Input: $2.5 to $2 |
| `vertex_ai/mistral-small-2503` | Input: $1 to $0.1; Output: $3 to $0.3 |
| `vertex_ai/mistral-small-2503@001` | Input: $1 to $0.1; Output: $3 to $0.3 |
| `vertex_ai/openai/gpt-oss-20b-maas` | Input: $0.075 to $0.07; Output: $0.3 to $0.25; Cache read: not set to $0.007 |
| `vertex_ai/xai/grok-4.20-non-reasoning` | Input: $2 to $1.25; Output: $6 to $2.5 |
| `vertex_ai/xai/grok-4.20-reasoning` | Input: $2 to $1.25; Output: $6 to $2.5 |

The registry also updates capability flags, context/output limits, non-token rates, and deprecation dates. No model entries were removed

### Amazon Bedrock

- Stop leaking Anthropic `thinking`/`reasoning_effort` into DeepSeek Converse requests - [PR #33409](https://github.com/BerriAI/litellm/pull/33409)
- Preserve Bedrock’s `x-amzn-RequestId` on chat errors - [PR #40089](https://github.com/BerriAI/litellm/pull/40089)
- Support TwelveLabs Marengo Embed 3.0 on Bedrock and bill Marengo embeddings by requests, images, and duration - [PR #40180](https://github.com/BerriAI/litellm/pull/40180)
- Pass deployment-configured `aws_session_tags` to STS AssumeRole for Bedrock and SageMaker - [PR #40446](https://github.com/BerriAI/litellm/pull/40446)

### Anthropic

- Skip one-shot Claude Code cache injection - [PR #40175](https://github.com/BerriAI/litellm/pull/40175)
- Key the /v1/messages prompt cache on Claude Code's session_id only - [PR #40342](https://github.com/BerriAI/litellm/pull/40342)

### Azure AI

- Route Azure AI passthrough calls to the configured deployment, enforce model access, and track spend across supported endpoint types - [PR #39863](https://github.com/BerriAI/litellm/pull/39863)
- Validate MAI image count and size options; unsupported values return 400 or are dropped with `drop_params` - [PR #40074](https://github.com/BerriAI/litellm/pull/40074)

### Azure OpenAI

- Honor `DEFAULT_MAX_RETRIES` when creating Azure SDK clients - [PR #40464](https://github.com/BerriAI/litellm/pull/40464)

### Bedrock Mantle

- Validate Bedrock Mantle `reasoning.summary`; unsupported values are dropped only when `drop_params` is enabled - [PR #40798](https://github.com/BerriAI/litellm/pull/40798)

### DashScope

- Remap chat-shaped api_base to the live rerank route - [PR #39237](https://github.com/BerriAI/litellm/pull/39237)

### Databricks

- Translate `reasoning_effort` correctly for Databricks-hosted Gemini 2.5 models - [PR #32786](https://github.com/BerriAI/litellm/pull/32786), [PR #40909](https://github.com/BerriAI/litellm/pull/40909)
- Keep top-level reasoning_content from OpenAI-compatible gateway models - [PR #40449](https://github.com/BerriAI/litellm/pull/40449)
- Route Databricks Unity model services through AI Gateway - [PR #40492](https://github.com/BerriAI/litellm/pull/40492)

### Fireworks AI

- Call Fireworks’ native Responses API, including server-side MCP and response chaining - [PR #39826](https://github.com/BerriAI/litellm/pull/39826)
- Fold instructions and developer items into one leading system message on the Responses path - [PR #40268](https://github.com/BerriAI/litellm/pull/40268)
- Keep reasoning_content on replayed assistant messages - [PR #40682](https://github.com/BerriAI/litellm/pull/40682)

### General

- Drop unsupported Responses reasoning parameters when `drop_params` is enabled, while preserving supported reasoning models - [PR #38842](https://github.com/BerriAI/litellm/pull/38842)

### Meta

- Stream Meta Muse Voice transcription through the Realtime API, with binary PCM input, turn completion, and duration-based billing - [PR #39395](https://github.com/BerriAI/litellm/pull/39395)

### Mistral

- Use Mistral Voxtral text-to-speech through `/v1/audio/speech`, with voice mapping, binary audio responses, voice cloning, and per-character billing - [PR #38755](https://github.com/BerriAI/litellm/pull/38755)

### Model catalog and pricing

- Add Bedrock GPT-6 Astra, GPT Image 2.5, Cohere Rerank 4, Vertex Grok and live translation, Lyria, Voyage, ChatGPT, and xAI video catalog entries; correct web-search fees and model capability metadata - [PR #31884](https://github.com/BerriAI/litellm/pull/31884)
- Add missing Bedrock GovCloud pricing, including in-region and cross-region inference model IDs - [PR #39764](https://github.com/BerriAI/litellm/pull/39764)
- Add azure_ai/gpt-6-astra Foundry pricing - [PR #39983](https://github.com/BerriAI/litellm/pull/39983)
- Price Azure AI Foundry catalog aliases and charge the model-router fee once - [PR #40189](https://github.com/BerriAI/litellm/pull/40189)
- Correct Jina reranker pricing and OpenAI reasoning-effort metadata, and add OpenRouter GPT-5.6 Sol - [PR #40581](https://github.com/BerriAI/litellm/pull/40581)
- Registry audit rolling PR: deepseek-flash, gpt-live-1, xAI/Groq deprecation dates, Perplexity Nemotron reasoning - [PR #40606](https://github.com/BerriAI/litellm/pull/40606)
- Add Cerebras, Inception, Together AI, and OpenRouter catalog entries; correct existing prices and Bedrock OpenAI reasoning capabilities - [PR #40740](https://github.com/BerriAI/litellm/pull/40740)
- Add DeepSeek V4.1 Flash on Fireworks - [PR #40812](https://github.com/BerriAI/litellm/pull/40812)
- Update Azure and Together AI deprecation dates and correct Computer Use and OpenRouter capability metadata - [PR #40855](https://github.com/BerriAI/litellm/pull/40855)
- Preserve reasoning support for unmapped OpenAI-family model IDs through capability fallbacks - [PR #40902](https://github.com/BerriAI/litellm/pull/40902)

### OpenAI

- Remove tool-schema regex patterns that OpenAI cannot compile while preserving the rest of the schema - [PR #40485](https://github.com/BerriAI/litellm/pull/40485)

### Oracle Cloud Infrastructure

- Keep stable OCI streaming response IDs and avoid duplicate Cohere tool-call answers - [PR #39507](https://github.com/BerriAI/litellm/pull/39507), [PR #39965](https://github.com/BerriAI/litellm/pull/39965)

### Vertex AI

- Generate Lyria music through `/v1/audio/speech`, with correct audio formats and music pricing - [PR #30856](https://github.com/BerriAI/litellm/pull/30856)
- Support fine-tuned Gemini endpoints in managed batches - [PR #39668](https://github.com/BerriAI/litellm/pull/39668)
- Return 400 with a clear parameter error for unsupported Vertex AI reasoning efforts - [PR #40748](https://github.com/BerriAI/litellm/pull/40748)

### Voyage

- Accept a single string or flat list of documents for Voyage contextual embeddings, while preserving explicit chunking options - [PR #35091](https://github.com/BerriAI/litellm/pull/35091)

### Weights & Biases

- Preserve reasoning_effort in chat completions - [PR #39190](https://github.com/BerriAI/litellm/pull/39190)
- Treat unmapped W&B models as reasoning-capable while allowing exact catalog entries to override the fallback - [PR #40625](https://github.com/BerriAI/litellm/pull/40625)

## LLM API Endpoints

### Agent-to-Agent

- Forward caller identity headers on message/send and message/stream - [PR #40305](https://github.com/BerriAI/litellm/pull/40305)

### Chat Completions, Responses, and Messages

- Handle empty choices and missing roles when building responses, including partial streams used for fallback - [PR #37781](https://github.com/BerriAI/litellm/pull/37781), [PR #40294](https://github.com/BerriAI/litellm/pull/40294)
- Preserve refusal text and refusal stop reasons when translating Responses or Chat Completions to Anthropic Messages - [PR #39723](https://github.com/BerriAI/litellm/pull/39723)
- Keep provider_specific_fields off the native /v1/messages wire - [PR #39967](https://github.com/BerriAI/litellm/pull/39967)
- Keep provider id and metadata on Responses API bridged chat completions - [PR #39981](https://github.com/BerriAI/litellm/pull/39981)
- Keep background polling alive after the client disconnects - [PR #40114](https://github.com/BerriAI/litellm/pull/40114)
- Keep reasoning_effort for mode: responses bridge deployments - [PR #40249](https://github.com/BerriAI/litellm/pull/40249)
- Keep mid-conversation system messages in input instead of folding them into instructions - [PR #40269](https://github.com/BerriAI/litellm/pull/40269)
- Replay OpenAI encrypted reasoning byte for byte through the /v1/messages bridge - [PR #40451](https://github.com/BerriAI/litellm/pull/40451)
- Echo a named tool_choice in the Responses API shape on the chat-completions bridge - [PR #40462](https://github.com/BerriAI/litellm/pull/40462)
- Preserve hosted web search calls - [PR #40828](https://github.com/BerriAI/litellm/pull/40828)
- Accept supported deferred stream-logging formats on native routes - [PR #40869](https://github.com/BerriAI/litellm/pull/40869)

### Files

- Delete Bedrock files through signed requests to configured buckets and preserve deployment credentials and managed file IDs during deletion - [PR #40161](https://github.com/BerriAI/litellm/pull/40161)

### Image Edits

- Add image edit support - [PR #40329](https://github.com/BerriAI/litellm/pull/40329)

### OCR

- Preserve native OCR provider errors and run post-call logging hooks - [PR #40061](https://github.com/BerriAI/litellm/pull/40061), [PR #40154](https://github.com/BerriAI/litellm/pull/40154)
- Run supported OCR through the native engine by default for Mistral, Azure Mistral, Azure Document Intelligence, Reducto, Vertex Mistral, and Vertex DeepSeek, with bounded document fetching and provider-specific authentication; use `LITELLM_RUST=0` for the Python path - [PR #40502](https://github.com/BerriAI/litellm/pull/40502), [PR #40507](https://github.com/BerriAI/litellm/pull/40507), [PR #40509](https://github.com/BerriAI/litellm/pull/40509), [PR #40530](https://github.com/BerriAI/litellm/pull/40530), [PR #40532](https://github.com/BerriAI/litellm/pull/40532), [PR #40533](https://github.com/BerriAI/litellm/pull/40533), [PR #40534](https://github.com/BerriAI/litellm/pull/40534), [PR #40535](https://github.com/BerriAI/litellm/pull/40535), [PR #40734](https://github.com/BerriAI/litellm/pull/40734)

### Realtime

- Dial Azure's GA realtime upstream for GA clients - [PR #40769](https://github.com/BerriAI/litellm/pull/40769)

### Search

- Propagate GET provider HTTP errors - [PR #40779](https://github.com/BerriAI/litellm/pull/40779)

### Vector Search and retrieval

- Expose vector-store retrieval failures in responses; opt into request failure with `vector_store_search_failure_mode: error` - [PR #39516](https://github.com/BerriAI/litellm/pull/39516)
- Scope emulated file_search to the request's vector stores - [PR #39972](https://github.com/BerriAI/litellm/pull/39972)
- Inject Headroom retrieval tools only for service-declared cache hashes and preserve assistant content blocks - [PR #39974](https://github.com/BerriAI/litellm/pull/39974)

## Management Endpoints / UI

### Admin UI

- Show batch IDs, partial-success counts, models, reasoning tokens, and cost breakdowns in Request Logs, and attribute batch spend to organizations - [PR #39626](https://github.com/BerriAI/litellm/pull/39626)
- Keep Playground conversations and session state when refreshing Virtual Keys, and hide Create Key from view-only roles - [PR #39991](https://github.com/BerriAI/litellm/pull/39991)
- Add key-scoped auto-router usage tab - [PR #39999](https://github.com/BerriAI/litellm/pull/39999)
- Send empty vector_stores when the last team vector store is removed - [PR #40144](https://github.com/BerriAI/litellm/pull/40144)
- Make automatic auto-router setup discoverable and show what it configured - [PR #40146](https://github.com/BerriAI/litellm/pull/40146)
- List the ChatGPT subscription provider in the Add Model form - [PR #40170](https://github.com/BerriAI/litellm/pull/40170)
- Guard playground cost metric against null and NaN - [PR #40257](https://github.com/BerriAI/litellm/pull/40257)
- Repair pass-through delete confirm dialog and disable delete for config endpoints - [PR #40303](https://github.com/BerriAI/litellm/pull/40303)
- Scope shadow eval models to configured chat groups - [PR #40488](https://github.com/BerriAI/litellm/pull/40488)
- Jump straight to the last Request Logs page instead of advancing one page - [PR #40644](https://github.com/BerriAI/litellm/pull/40644)
- Open related users, teams, organizations, and creators directly from entity tables across Keys, Teams, Deleted Keys, Deleted Teams, Memory, and Prompts - [PR #40646](https://github.com/BerriAI/litellm/pull/40646), [PR #40647](https://github.com/BerriAI/litellm/pull/40647), [PR #40749](https://github.com/BerriAI/litellm/pull/40749), [PR #40750](https://github.com/BerriAI/litellm/pull/40750), [PR #40751](https://github.com/BerriAI/litellm/pull/40751), [PR #40752](https://github.com/BerriAI/litellm/pull/40752), [PR #40753](https://github.com/BerriAI/litellm/pull/40753)
- Search Key Activity by key alias, key hash, user id, or email - [PR #40652](https://github.com/BerriAI/litellm/pull/40652)
- Show loading state instead of stale rows while a table search is pending - [PR #40656](https://github.com/BerriAI/litellm/pull/40656)
- Search, sort and role filter for the team member table - [PR #40659](https://github.com/BerriAI/litellm/pull/40659)
- Clarify blank TPM/RPM hint on budget modals - [PR #40697](https://github.com/BerriAI/litellm/pull/40697)
- Persist cleared selections and default choices across shared selectors and local forms - [PR #40795](https://github.com/BerriAI/litellm/pull/40795), [PR #40826](https://github.com/BerriAI/litellm/pull/40826)
- Make the env-credential login warning banner dismissible - [PR #40831](https://github.com/BerriAI/litellm/pull/40831)

### Authentication and management

- Cascade-delete JWT key mappings when their virtual key is deleted - [PR #33703](https://github.com/BerriAI/litellm/pull/33703)
- Let internal users read request/response for their own spend logs - [PR #35448](https://github.com/BerriAI/litellm/pull/35448)
- Keep model edits from turning displayed catalog prices into permanent deployment overrides; set custom prices through `litellm_params` - [PR #36222](https://github.com/BerriAI/litellm/pull/36222)
- Report model limits from the resolved deployment in `/v1/models`, including aliased models - [PR #39296](https://github.com/BerriAI/litellm/pull/39296)
- Check ownership for every addressed Responses API ID; unmanaged provider IDs require `allow_unmanaged_response_ids` - [PR #39548](https://github.com/BerriAI/litellm/pull/39548)
- Apply key and team model allowlists to Bedrock passthrough requests - [PR #39660](https://github.com/BerriAI/litellm/pull/39660)
- Apply team model aliases on the JWT auth path - [PR #39985](https://github.com/BerriAI/litellm/pull/39985)
- Disable shared environment-credential login with `general_settings.disable_env_credential_login` and guide admins through account setup - [PR #40116](https://github.com/BerriAI/litellm/pull/40116)
- Show Create Vector Store only to proxy admins - [PR #40148](https://github.com/BerriAI/litellm/pull/40148)
- Let authorized internal users open vector store details - [PR #40150](https://github.com/BerriAI/litellm/pull/40150)
- Keep a body litellm_session_id in SpendLogs under missing_session_id omit - [PR #40379](https://github.com/BerriAI/litellm/pull/40379)
- Ignore team_id="" on /key/update so team-less keys can be updated and imported - [PR #40421](https://github.com/BerriAI/litellm/pull/40421)
- Resolve team-scoped auto-routers by their public name - [PR #40432](https://github.com/BerriAI/litellm/pull/40432)
- Retain metadata when retrieving public team aliases - [PR #40554](https://github.com/BerriAI/litellm/pull/40554)
- Require an enterprise license for organization endpoints - [PR #40613](https://github.com/BerriAI/litellm/pull/40613)
- Support explicit project detachment - [PR #40836](https://github.com/BerriAI/litellm/pull/40836)
- Persist clearing user model budgets - [PR #40837](https://github.com/BerriAI/litellm/pull/40837)
- Allow non-admin users to search key aliases by substring within their authorized scope - [PR #40907](https://github.com/BerriAI/litellm/pull/40907)

### Coding agents and skills

- Run the pi coding agent through the gateway with `lite pi`, including model limits and key-based access - [PR #36841](https://github.com/BerriAI/litellm/pull/36841)
- Search accessible hosted skills by semantic similarity through `GET /v1/skills?query=...` and the `skill_search` MCP tool - [PR #39401](https://github.com/BerriAI/litellm/pull/39401)
- Configure Claude Code, Codex, or both with a gateway key and reversible settings; restore Claude settings with `lite unconfigure claude` - [PR #40319](https://github.com/BerriAI/litellm/pull/40319), [PR #40829](https://github.com/BerriAI/litellm/pull/40829)
- Let the apiKeyHelper supply Claude Code's key under lite claude - [PR #40489](https://github.com/BerriAI/litellm/pull/40489)
- Register HTTPS ZIP archives as Claude Code marketplace plugin sources, with an optional SHA-256 checksum - [PR #40496](https://github.com/BerriAI/litellm/pull/40496)
- Expose gateway models under Claude-compatible IDs for Claude Code model discovery and requests - [PR #40515](https://github.com/BerriAI/litellm/pull/40515)
- Grant key- and team-scoped access to private Claude Code marketplace plugins through Allowed Skills - [PR #40518](https://github.com/BerriAI/litellm/pull/40518)
- Set `litellm_settings.public_skills_index: true` to publish all stored skills through a public Agent Skills index and downloadable archives - [PR #40770](https://github.com/BerriAI/litellm/pull/40770)

### Terraform management

- Read team per-model rpm/tpm limits from metadata and clear them on removal - [PR #40439](https://github.com/BerriAI/litellm/pull/40439)
- Recover Terraform state when a virtual key no longer exists, including cascade deletion - [PR #40443](https://github.com/BerriAI/litellm/pull/40443), [PR #40880](https://github.com/BerriAI/litellm/pull/40880)
- Encode Terraform per-model key budgets in the structure the proxy accepts - [PR #40450](https://github.com/BerriAI/litellm/pull/40450)
- Allow custom team_id on litellm_team - [PR #40459](https://github.com/BerriAI/litellm/pull/40459)
- Recompute Terraform-managed key expiry when its duration changes - [PR #40511](https://github.com/BerriAI/litellm/pull/40511)
- Preserve prior Terraform key state when an update is rejected - [PR #40512](https://github.com/BerriAI/litellm/pull/40512), [PR #40527](https://github.com/BerriAI/litellm/pull/40527)
- Read key settings stored in metadata back into Terraform state - [PR #40513](https://github.com/BerriAI/litellm/pull/40513)
- Preserve server-side key metadata that Terraform does not manage - [PR #40514](https://github.com/BerriAI/litellm/pull/40514)

## AI Integrations

### Guardrails

- Block Prompt Security file-modification verdicts by default; set `block_on_file_modify: false` to permit rewriting - [PR #38204](https://github.com/BerriAI/litellm/pull/38204)
- Apply post-call policy pipelines to supported Responses and streaming paths, including background retrieval, text and tool-call rewrites, and legacy post-call hooks - [PR #38721](https://github.com/BerriAI/litellm/pull/38721), [PR #38788](https://github.com/BerriAI/litellm/pull/38788), [PR #39233](https://github.com/BerriAI/litellm/pull/39233), [PR #40271](https://github.com/BerriAI/litellm/pull/40271), [PR #40274](https://github.com/BerriAI/litellm/pull/40274), [PR #40284](https://github.com/BerriAI/litellm/pull/40284)
- Resolve generateContent routes and async-first passthrough call types - [PR #38869](https://github.com/BerriAI/litellm/pull/38869)
- Apply key and team guardrails to MCP tool calls - [PR #39629](https://github.com/BerriAI/litellm/pull/39629)
- Run attached policy pipelines in deterministic order: global, team, key, tag, then model - [PR #39697](https://github.com/BerriAI/litellm/pull/39697)
- Stop logging the request payload as guardrail_response on pre_call hooks - [PR #39699](https://github.com/BerriAI/litellm/pull/39699)
- Add inspect_embeddings toggle for AIM and Cato - [PR #39918](https://github.com/BerriAI/litellm/pull/39918)
- Detect short credentials assigned to credential-named fields without changing the configured entropy thresholds - [PR #40190](https://github.com/BerriAI/litellm/pull/40190)
- Log expected skip and deny events below WARNING - [PR #40208](https://github.com/BerriAI/litellm/pull/40208)
- Preserve guardrail results and scan identifiers in telemetry, including streamed responses and request rewrites - [PR #40211](https://github.com/BerriAI/litellm/pull/40211), [PR #40327](https://github.com/BerriAI/litellm/pull/40327), [PR #40806](https://github.com/BerriAI/litellm/pull/40806), [PR #40882](https://github.com/BerriAI/litellm/pull/40882)
- Allow framework-supported logging-only mode - [PR #40267](https://github.com/BerriAI/litellm/pull/40267)
- Pass original request object to post-call guardrail hooks - [PR #40414](https://github.com/BerriAI/litellm/pull/40414)
- Scan and rewrite Responses custom_tool_call output items - [PR #40461](https://github.com/BerriAI/litellm/pull/40461)
- Fail closed with a named error when a Responses input rewrite cannot be applied - [PR #40609](https://github.com/BerriAI/litellm/pull/40609)
- Log only scan time as streaming post_call guardrail duration - [PR #40760](https://github.com/BerriAI/litellm/pull/40760)
- Add [Conduct Guard](../../docs/proxy/guardrails/conduct) through YAML and the Admin UI, including supported hooks, request parameters, and warning/advisory telemetry; requires `conduct-litellm-guard>=0.2.5` - [PR #40785](https://github.com/BerriAI/litellm/pull/40785)

### Logging

- Initialize string success/failure callbacks at startup after config load - [PR #38226](https://github.com/BerriAI/litellm/pull/38226)
- Export batched request logs to [PointFive](../../docs/observability/pointfive) from YAML or the Admin UI, with message redaction on successes and failures - [PR #38509](https://github.com/BerriAI/litellm/pull/38509)
- Surface runtime-registered callbacks in UI Logging page - [PR #38974](https://github.com/BerriAI/litellm/pull/38974)
- Prevent streaming span leaks in MLflow logging and restore compatibility with MLflow 2.x trace completion - [PR #39049](https://github.com/BerriAI/litellm/pull/39049)
- Finish response metadata before synchronous logging callbacks read it - [PR #39869](https://github.com/BerriAI/litellm/pull/39869)
- Split Azure Sentinel log batches below ingestion limits and retry oversized batches - [PR #39880](https://github.com/BerriAI/litellm/pull/39880)
- Include the upstream provider request ID in failure logs - [PR #40045](https://github.com/BerriAI/litellm/pull/40045)
- Bucket latency by input sequence length - [PR #40059](https://github.com/BerriAI/litellm/pull/40059)
- Give each call in a session header its own trace instead of upserting one trace per session - [PR #40177](https://github.com/BerriAI/litellm/pull/40177)
- Freeze refreshable credentials before signing and retry 403 uploads with a fresh signature - [PR #40187](https://github.com/BerriAI/litellm/pull/40187)
- Configure the complete OTel v2 trace export URL and HTTP/JSON protocol through environment settings or the Admin UI - [PR #40286](https://github.com/BerriAI/litellm/pull/40286), [PR #40290](https://github.com/BerriAI/litellm/pull/40290)
- Accept non-string callback settings in `default_team_settings` - [PR #40458](https://github.com/BerriAI/litellm/pull/40458)
- Export team max and remaining budget gauges to the Metric API - [PR #40542](https://github.com/BerriAI/litellm/pull/40542)
- Keep call_type and request start time on failed-request spend logs - [PR #40558](https://github.com/BerriAI/litellm/pull/40558)
- Keep tool call and result structure under redaction and emit tool output tokens - [PR #40666](https://github.com/BerriAI/litellm/pull/40666)
- Name Langfuse traces from the langfuse_trace_name header or metadata.trace_name - [PR #40793](https://github.com/BerriAI/litellm/pull/40793)

### Secret Managers

- Encrypt virtual keys stored in AWS Secrets Manager with a customer-managed KMS key using `kms_key_id` - [PR #40475](https://github.com/BerriAI/litellm/pull/40475)

## Spend Tracking, Budgets and Rate Limiting

- Honor deployment-specific custom prices for OCR calls - [PR #36609](https://github.com/BerriAI/litellm/pull/36609), [PR #40767](https://github.com/BerriAI/litellm/pull/40767)
- Don't reserve budget on token counting routes - [PR #36718](https://github.com/BerriAI/litellm/pull/36718)
- Attach v3 priority rate limit headers on /v1/messages - [PR #37228](https://github.com/BerriAI/litellm/pull/37228)
- Record spend for native Responses API WebSocket sessions - [PR #38856](https://github.com/BerriAI/litellm/pull/38856)
- Allow editing soft budget on existing keys - [PR #39002](https://github.com/BerriAI/litellm/pull/39002)
- Bill realtime reasoning tokens nested in text_tokens once - [PR #39850](https://github.com/BerriAI/litellm/pull/39850)
- Account a batch's cost once, from the first retrieve that sees it final - [PR #39980](https://github.com/BerriAI/litellm/pull/39980)
- Price caching savings on the billed request basis - [PR #40160](https://github.com/BerriAI/litellm/pull/40160)
- Itemize auto-router classification spend - [PR #40168](https://github.com/BerriAI/litellm/pull/40168)
- Estimate cache-read, cache-write, and reasoning-token costs in `/cost/estimate`, including custom pricing and consistent rate breakdowns - [PR #40174](https://github.com/BerriAI/litellm/pull/40174)
- Expose the loaded pricing-map revision and ETag through the cost-map APIs and Price Data Reload page - [PR #40179](https://github.com/BerriAI/litellm/pull/40179)
- Show auto-router classification rate - [PR #40192](https://github.com/BerriAI/litellm/pull/40192)
- Compare auto-router targets by deployment identity - [PR #40206](https://github.com/BerriAI/litellm/pull/40206)
- Recover key alias for session tokens from spend logs - [PR #40275](https://github.com/BerriAI/litellm/pull/40275)
- Keep team member budget enforced at the cap and across Redis counter expiry - [PR #40304](https://github.com/BerriAI/litellm/pull/40304)
- Emit internal user budget webhook alerts - [PR #40396](https://github.com/BerriAI/litellm/pull/40396)
- Prevent spend counter double counting - [PR #40572](https://github.com/BerriAI/litellm/pull/40572)
- Skip priority headers that cannot be encoded in HTTP responses instead of failing Anthropic Messages requests - [PR #40636](https://github.com/BerriAI/litellm/pull/40636)
- Reset linked end-user budgets correctly - [PR #40639](https://github.com/BerriAI/litellm/pull/40639)
- Price recovered tokens when a /v1/messages client disconnects mid-stream - [PR #40766](https://github.com/BerriAI/litellm/pull/40766)
- Persist cleared budget caps and reset intervals and show the cleared values when forms reopen - [PR #40895](https://github.com/BerriAI/litellm/pull/40895)

## MCP Gateway

- Validate and bind per-user OAuth credentials to the authenticated caller when identity binding is enabled, including credential refresh - [PR #38724](https://github.com/BerriAI/litellm/pull/38724)
- Forward staged credentials on /mcp-rest/test/connection like /test/tools/list - [PR #38806](https://github.com/BerriAI/litellm/pull/38806)
- Apply agent MCP grants and toolsets, and return a clear 403 when a request names a gateway MCP server the key cannot access - [PR #39234](https://github.com/BerriAI/litellm/pull/39234)
- Start the named server's OAuth directly for a resource-scoped gateway flow - [PR #39933](https://github.com/BerriAI/litellm/pull/39933)
- Add opt-in per-server oauth relay discovery - [PR #39936](https://github.com/BerriAI/litellm/pull/39936)
- Honor explicit `null` values when updating MCP toolsets - [PR #40022](https://github.com/BerriAI/litellm/pull/40022)
- Show inherited MCP servers on the internal user editor and flag access groups with no members - [PR #40036](https://github.com/BerriAI/litellm/pull/40036)
- Accept on_violation block and alert for mcp_security - [PR #40155](https://github.com/BerriAI/litellm/pull/40155)
- Encrypt stored static headers and stdio environment - [PR #40164](https://github.com/BerriAI/litellm/pull/40164)
- Discover and call tools on demand through `/mcp/proxy` using `search_tools`, `get_tool_schema`, and `call_tool`, with existing MCP access controls - [PR #40298](https://github.com/BerriAI/litellm/pull/40298)
- Emit completed MCP proxy-call logs with the correct upstream metadata - [PR #40337](https://github.com/BerriAI/litellm/pull/40337)
- Log proxy tool dispatch exceptions - [PR #40351](https://github.com/BerriAI/litellm/pull/40351)
- Surface connection failures across transports - [PR #40359](https://github.com/BerriAI/litellm/pull/40359)
- Log upstream request method, body and response on tool-list and OAuth2 token failures - [PR #40440](https://github.com/BerriAI/litellm/pull/40440)
- Challenge and scope gateway-owned server authentication - [PR #40453](https://github.com/BerriAI/litellm/pull/40453)
- Report resolved upstream authentication in debug headers - [PR #40454](https://github.com/BerriAI/litellm/pull/40454)
- Preserve dotted MCP tool argument names - [PR #40494](https://github.com/BerriAI/litellm/pull/40494)
- Refresh MCP tool previews after connection edits and require explicit credentials when changing the destination origin - [PR #40498](https://github.com/BerriAI/litellm/pull/40498)
- Respect optional discovery capabilities and quiet unsupported methods - [PR #40525](https://github.com/BerriAI/litellm/pull/40525)
- Write failure spend log for guardrail-blocked /mcp-rest/tools/call - [PR #40555](https://github.com/BerriAI/litellm/pull/40555)
- Reject initialize with 403 when the key grants no MCP servers - [PR #40616](https://github.com/BerriAI/litellm/pull/40616)
- Accept VS Code OAuth registration callbacks - [PR #40664](https://github.com/BerriAI/litellm/pull/40664)
- Check OpenAPI specifications without native MCP handshakes - [PR #40665](https://github.com/BerriAI/litellm/pull/40665)
- Return actionable OAuth-registration errors and bound MCP discovery retries - [PR #40679](https://github.com/BerriAI/litellm/pull/40679)
- Restore MCP catalog provider logos - [PR #40781](https://github.com/BerriAI/litellm/pull/40781)
- Cache upstream discovery lists - [PR #40790](https://github.com/BerriAI/litellm/pull/40790)
- Use gateway authentication for root discovery - [PR #40791](https://github.com/BerriAI/litellm/pull/40791)
- Match per-server OAuth metadata issuers - [PR #40808](https://github.com/BerriAI/litellm/pull/40808)
- Enforce end-user MCP tool permissions on both tool listing and execution - [PR #40865](https://github.com/BerriAI/litellm/pull/40865)

## Performance / Loadbalancing / Reliability improvements

### Auto Router

- Preserve existing heuristic-v1 router tuning across upgrades and enforce the free one-router editing quota consistently - [PR #39952](https://github.com/BerriAI/litellm/pull/39952), [PR #40007](https://github.com/BerriAI/litellm/pull/40007), [PR #40140](https://github.com/BerriAI/litellm/pull/40140)
- Build semantic routing configuration without blocking the event loop - [PR #39954](https://github.com/BerriAI/litellm/pull/39954)
- Restore adaptive-routing scores from both their initial prior and persisted learning - [PR #39955](https://github.com/BerriAI/litellm/pull/39955)
- Use deployment `model_info` pricing when scoring adaptive routes by cost - [PR #39957](https://github.com/BerriAI/litellm/pull/39957)
- Add declarative custom dimensions to the heuristic scorer - [PR #40156](https://github.com/BerriAI/litellm/pull/40156)
- Edit built-in and custom heuristic dimensions in the dashboard, rebalance weights, and opt into match-count scoring - [PR #40205](https://github.com/BerriAI/litellm/pull/40205)
- Set auto-routed output limits from the selected tier model; retain caller limits with `max_tokens_from_tier_model: false` - [PR #40209](https://github.com/BerriAI/litellm/pull/40209)
- Add an optional `NON_REASONING` auto-router tier below `SIMPLE`, enabled with `enable_non_reasoning_tier` - [PR #40273](https://github.com/BerriAI/litellm/pull/40273)
- Discard incompatible encrypted reasoning when switching auto-router tiers so the request can continue - [PR #40280](https://github.com/BerriAI/litellm/pull/40280)
- Show the routed model and session savings in Claude Code and Codex, with key-scoped data from `GET /auto_router/session` - [PR #40330](https://github.com/BerriAI/litellm/pull/40330)
- Refresh auto-router reasoning presets for supported model families - [PR #40341](https://github.com/BerriAI/litellm/pull/40341)
- Resolve routing candidates consistently, including provider-qualified patterns, team routes, and default deployments - [PR #40491](https://github.com/BerriAI/litellm/pull/40491)
- Classify the actual coding-agent task, including encrypted delegated tasks, without unrelated Codex envelopes or Claude Code system text - [PR #40599](https://github.com/BerriAI/litellm/pull/40599), [PR #40608](https://github.com/BerriAI/litellm/pull/40608), [PR #40655](https://github.com/BerriAI/litellm/pull/40655)
- Record the exact classifier input and masked source request for auto-router diagnostics - [PR #40604](https://github.com/BerriAI/litellm/pull/40604)
- Fall back to a healthy default model when the selected auto-router tier cannot serve the request - [PR #40757](https://github.com/BerriAI/litellm/pull/40757)
- Expose auto-router tier, cause, score, and reasoning effort in response headers - [PR #40792](https://github.com/BerriAI/litellm/pull/40792)
- Skip hosted-web-search requests in shadow evaluation to avoid incomplete comparisons - [PR #40827](https://github.com/BerriAI/litellm/pull/40827)
- Restore inherited compression settings when an override is cleared - [PR #40839](https://github.com/BerriAI/litellm/pull/40839)

### Deployment, caching, and database reliability

- Authenticate to Amazon ElastiCache using IAM credentials - [PR #38413](https://github.com/BerriAI/litellm/pull/38413)
- Recover database indexes left invalid by an interrupted migration - [PR #39384](https://github.com/BerriAI/litellm/pull/39384)
- Clean up the full migration process tree after a startup migration timeout - [PR #39509](https://github.com/BerriAI/litellm/pull/39509)
- Share worker database connections through optional PgBouncer, including rotating RDS IAM/Azure Entra tokens and the spend collector - [PR #39683](https://github.com/BerriAI/litellm/pull/39683), [PR #40623](https://github.com/BerriAI/litellm/pull/40623), [PR #40660](https://github.com/BerriAI/litellm/pull/40660)
- Serve metrics through a dedicated process or sidecar in Helm, AWS Terraform, and GCP Cloud Run deployments - [PR #40163](https://github.com/BerriAI/litellm/pull/40163), [PR #40614](https://github.com/BerriAI/litellm/pull/40614)
- Keep cost-based routing data separate from latency samples - [PR #40225](https://github.com/BerriAI/litellm/pull/40225)
- Honor idle-connection defaults, CA bundles, and SSL settings in componentized database deployments - [PR #40285](https://github.com/BerriAI/litellm/pull/40285), [PR #40428](https://github.com/BerriAI/litellm/pull/40428), [PR #40815](https://github.com/BerriAI/litellm/pull/40815)
- Reduce repeated database and Redis work in authentication, budget reservation, and post-call spend tracking - [PR #40371](https://github.com/BerriAI/litellm/pull/40371), [PR #40593](https://github.com/BerriAI/litellm/pull/40593), [PR #40834](https://github.com/BerriAI/litellm/pull/40834), [PR #40841](https://github.com/BerriAI/litellm/pull/40841)
- Bound concurrent key and spend database lookups with `PROXY_DB_LOOKUP_MAX_CONCURRENCY` to reduce overload during cache misses - [PR #40387](https://github.com/BerriAI/litellm/pull/40387)
- Opt into request-per-second and token-per-second gateway autoscaling in the supported Helm and Terraform deployments - [PR #40479](https://github.com/BerriAI/litellm/pull/40479)
- Offload spend tracking to an optional pod-local collector; workers resume local processing if the collector is unavailable - [PR #40545](https://github.com/BerriAI/litellm/pull/40545)
- Reconnect the Prisma writer when its database session becomes read-only - [PR #40610](https://github.com/BerriAI/litellm/pull/40610)
- Keep Redis circuit breakers stable during outages, count pool-wait timeouts, reduce repeated logs, and use available local routing counters - [PR #40620](https://github.com/BerriAI/litellm/pull/40620), [PR #40624](https://github.com/BerriAI/litellm/pull/40624), [PR #40764](https://github.com/BerriAI/litellm/pull/40764)
- Separate virtual-key caching from other management objects and make management-cache capacity configurable - [PR #40713](https://github.com/BerriAI/litellm/pull/40713), [PR #40725](https://github.com/BerriAI/litellm/pull/40725)
- Run migrations when the Prisma command is available as a Python module but absent from PATH - [PR #40768](https://github.com/BerriAI/litellm/pull/40768)
- Attribute requests rejected before dispatch to the correct endpoint in cache analytics - [PR #40824](https://github.com/BerriAI/litellm/pull/40824)

### Load balancing and retries

- Handle deployments with no recorded latency samples without failing routing - [PR #39970](https://github.com/BerriAI/litellm/pull/39970)
- Share in-flight counts, failure thresholds, and cooldowns across workers so load balancing and deployment recovery stay consistent - [PR #40009](https://github.com/BerriAI/litellm/pull/40009), [PR #40025](https://github.com/BerriAI/litellm/pull/40025), [PR #40224](https://github.com/BerriAI/litellm/pull/40224)
- Skip a deployment that refused a retryable request across router entrypoints - [PR #40014](https://github.com/BerriAI/litellm/pull/40014), [PR #40306](https://github.com/BerriAI/litellm/pull/40306)
- Keep provider response headers on streaming chat completions - [PR #40091](https://github.com/BerriAI/litellm/pull/40091)
- Rank streaming latency routes using raw time to first token - [PR #40202](https://github.com/BerriAI/litellm/pull/40202)
- Use configured weight, RPM, or TPM from any deployment in simple-shuffle routing - [PR #40222](https://github.com/BerriAI/litellm/pull/40222)
- Prevent deployment tags from changing request tag routing during retries and fallbacks - [PR #40226](https://github.com/BerriAI/litellm/pull/40226)
- Keep request-specific routing strategies from accumulating global callbacks - [PR #40229](https://github.com/BerriAI/litellm/pull/40229)
- Route streaming requests by a chosen time-to-first-token percentile using `ttft_percentile` - [PR #40352](https://github.com/BerriAI/litellm/pull/40352)

### Request handling and runtime

- Honor string-valued `drop_params` settings loaded from YAML or database deployments - [PR #33738](https://github.com/BerriAI/litellm/pull/33738)
- Serve one deployment under several ingress prefixes with `SERVER_ROOT_PATHS`, including correctly prefixed MCP OAuth discovery - [PR #35935](https://github.com/BerriAI/litellm/pull/35935)
- Register skill injection when the proxy starts, avoiding callback side effects from SDK imports - [PR #38914](https://github.com/BerriAI/litellm/pull/38914)
- Restore the standalone AI Gateway release-image build - [PR #39523](https://github.com/BerriAI/litellm/pull/39523)
- Restore secure upstream WebSocket connections in the Rust gateway - [PR #39530](https://github.com/BerriAI/litellm/pull/39530)
- Return proper nullable error fields on non-LLM routes instead of the literal string `"None"` - [PR #39536](https://github.com/BerriAI/litellm/pull/39536)
- Reduce repeated database writes and duplicate rows for model health checks - [PR #39539](https://github.com/BerriAI/litellm/pull/39539)
- Keep spend-log flush notifications local to their worker event loop - [PR #39556](https://github.com/BerriAI/litellm/pull/39556)
- Move remote media and template fetching, plus asynchronous Bedrock request signing, off inference workers’ event loops - [PR #39839](https://github.com/BerriAI/litellm/pull/39839), [PR #40270](https://github.com/BerriAI/litellm/pull/40270), [PR #40311](https://github.com/BerriAI/litellm/pull/40311)
- Load database-backed credentials before reconciling models on each worker - [PR #39876](https://github.com/BerriAI/litellm/pull/39876)
- Control optional Rust execution through `litellm.rust(bool)` or `LITELLM_RUST`; request-level controls are removed - [PR #39928](https://github.com/BerriAI/litellm/pull/39928)
- Redact provider credentials from passthrough failure tracebacks - [PR #39964](https://github.com/BerriAI/litellm/pull/39964)
- Allow spend-log partition maintenance to run within its configured statement timeout - [PR #40098](https://github.com/BerriAI/litellm/pull/40098)
- Log the budget-reservation configuration notice once at startup - [PR #40167](https://github.com/BerriAI/litellm/pull/40167)
- Bound concurrent token counting and move large counts off the event loop; strings above `TOKEN_COUNTER_MAX_EXACT_CHARS` use sampled estimates - [PR #40186](https://github.com/BerriAI/litellm/pull/40186)
- Load the first remote pricing map synchronously and run failed-fetch retries in the background - [PR #40350](https://github.com/BerriAI/litellm/pull/40350)
- Batch gateway request-count rollups to reduce database writes - [PR #40362](https://github.com/BerriAI/litellm/pull/40362)
- Start `lite` CLI commands without downloading the remote pricing map - [PR #40372](https://github.com/BerriAI/litellm/pull/40372)
- Optionally count supported budget-admission input tokens in Rust, with Python fallback for unsupported requests - [PR #40381](https://github.com/BerriAI/litellm/pull/40381)
- Record unknown-model failures with a fixed model label and sanitized stored error text - [PR #40622](https://github.com/BerriAI/litellm/pull/40622), [PR #40820](https://github.com/BerriAI/litellm/pull/40820)
- Prioritize liveness and core inference routes in request dispatch - [PR #40687](https://github.com/BerriAI/litellm/pull/40687)
- Load provider passthrough routes on demand while preserving route precedence - [PR #40691](https://github.com/BerriAI/litellm/pull/40691)
- Track Bedrock passthrough streaming usage incrementally, avoiding full-response buffering - [PR #40724](https://github.com/BerriAI/litellm/pull/40724)
- Scope health checks to accessible models and access groups, and return only approved display fields - [PR #40765](https://github.com/BerriAI/litellm/pull/40765)
- Resolve included files in bucket-hosted proxy configurations - [PR #40772](https://github.com/BerriAI/litellm/pull/40772)
- Expose authenticated gateway memory summaries on the data plane, including pod identity and Linux memory readings without psutil - [PR #40773](https://github.com/BerriAI/litellm/pull/40773)
- Extend optional Rust budget-admission counting to supported `cl100k_base` tokenizers - [PR #40777](https://github.com/BerriAI/litellm/pull/40777)
- Deduplicate matched policy attachments in one pass - [PR #40883](https://github.com/BerriAI/litellm/pull/40883)

### PR roll-up by ownership area

Customer-visible PRs for the original rc.1 notes: **317**. The release-line additions listed above are separate from this existing roll-up.

- Performance: 92
- Models & Providers: 40
- Auth & Management: 37
- LLM API Endpoints: 31
- MCP: 29
- Guardrails: 24
- UI: 24
- Spend / Budgets / Rate Limits: 22
- Logging: 17
- Secret Managers: 1

## New Contributors

- [@Atharva-Kanherkar](https://github.com/Atharva-Kanherkar)
- [@CaptainAni187](https://github.com/CaptainAni187)
- [@ZXT-zjbiliy](https://github.com/ZXT-zjbiliy)
- [@clement-paradex](https://github.com/clement-paradex)
- [@dclarksymmetry](https://github.com/dclarksymmetry)
- [@gym-cmd](https://github.com/gym-cmd)
- [@haydster7](https://github.com/haydster7)
- [@jon-walton](https://github.com/jon-walton)
- [@joshua-berri](https://github.com/joshua-berri)
- [@jrlprost](https://github.com/jrlprost)
- [@kerry-berri](https://github.com/kerry-berri)
- [@krth1k](https://github.com/krth1k)
- [@shotsan](https://github.com/shotsan)
- [@yinonkahta-p5](https://github.com/yinonkahta-p5)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.101.0...v1.102.0
