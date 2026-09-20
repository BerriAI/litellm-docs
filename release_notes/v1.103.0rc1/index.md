---
title: "1.103.0rc1 - Config File Ownership, Fuse Routing & Gateway Hardening"
slug: "v1-103-0-rc-1"
date: 2026-09-20T03:08:52
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
docker.litellm.ai/berriai/litellm:1.103.0-rc.1
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.103.0rc1
```

</TabItem>
</Tabs>

The published GitHub tag is `v1.103.0-rc.1`. These notes compare it with `v1.102.0-rc.1`, the previous release candidate cut from `main`. Changes backported onto `rc/1.102.0` and already shipped in `v1.102.0` are omitted

:::danger Breaking Changes

These callouts cover changes to behavior available in `v1.102.0`, the latest stable release

**The config file now owns every setting it declares, and the database no longer overrides it.** One rule replaces the per-key mix of DB-wins, config-wins and merged precedence: if `config.yaml` declares a key, the file owns it and a runtime write to that key is refused with a 400 naming the file to edit, instead of being stored and silently ignored. This covers `POST /config/field/update`, `POST /config/field/delete`, `POST /config/update`, and the `allowed_ips` routes. Keys the file leaves out still come from the database and stay editable. `GET /config/field/info` and `GET /config/list` now resolve through the same store and report `source` and `editable`, and a config-owned field reports the value the file declares, so an `os.environ/...` reference is returned as written rather than resolved. In the Admin UI a config-owned field renders read-only. Startup warns once per key whose stored database value is being ignored, and the refusal carries the same sentence plus `stored_database_value_ignored: true`. Move any setting you edit at runtime out of the config file, or edit the file and restart. See [PR #41779](https://github.com/BerriAI/litellm/pull/41779), [PR #41862](https://github.com/BerriAI/litellm/pull/41862), [PR #41868](https://github.com/BerriAI/litellm/pull/41868), [PR #41931](https://github.com/BerriAI/litellm/pull/41931), [PR #41985](https://github.com/BerriAI/litellm/pull/41985), [PR #42009](https://github.com/BerriAI/litellm/pull/42009)

**Budgets are re-checked on every router fallback target.** A request that starts on a free model and falls back to a paid one is now gated at the fallback, and targets the caller cannot pay for are skipped rather than served. The primary attempt is unchanged. Workflows that relied on a free primary carrying an over-budget key onto a paid fallback will now receive the next affordable target or a budget error. See [PR #41379](https://github.com/BerriAI/litellm/pull/41379)

**An organization or project `max_budget` of 0 now means zero allowance, not unlimited.** This matches the existing key, team and user semantics. Set `max_budget` to `null` for unlimited. See [PR #41271](https://github.com/BerriAI/litellm/pull/41271), [PR #41997](https://github.com/BerriAI/litellm/pull/41997)

**A key's own per-model rpm/tpm override now beats the team's per-model limit.** Documented precedence (key metadata over team metadata) is now what the code does, on chat, batches and `/cost/predict-cache`. A key that overrides only RPM still has the team TPM pool enforced, and vice versa. Review teams that relied on the per-model team cap clamping keys that declare their own. See [PR #41302](https://github.com/BerriAI/litellm/pull/41302)

**Delegated MCP OAuth requires admission.** Legacy delegated MCP integrations that were not admitted to LiteLLM now receive 401 until they admit or migrate to `oauth_delegate`. See [PR #40923](https://github.com/BerriAI/litellm/pull/40923)

**A `CustomLogger` moderation callback now rejects the request.** `llm_api_check` moderation is dispatched through `during_call_hook`, so a flagged request returns 400 where it previously returned 200. See [PR #41685](https://github.com/BerriAI/litellm/pull/41685)

**Bedrock Realtime requires `aws-sdk-bedrock-runtime` 0.10 or 0.11.** The pin moved to `aws-sdk-bedrock-runtime[awscrt]>=0.10.0,<0.12.0`; 0.7.x is no longer supported and the init error now distinguishes an absent SDK from an unsupported version. Nova Sonic sessions fail until operators install a supported SDK with the `awscrt` extra. See [PR #41542](https://github.com/BerriAI/litellm/pull/41542)

**`/v1/rag/ingest` resolves the registered store and refuses providers without ingestion.** A request that names a registered store by id now uses that store's provider and `litellm_params` instead of defaulting to OpenAI Files, only per-upload options survive from the caller, and a provider with no ingestion implementation returns 400 naming the supported ones instead of a 200 with `status: failed` or a 500. See [PR #41940](https://github.com/BerriAI/litellm/pull/41940)

**Capability and Fuse v2 routers are limited to one each without a license.** Registering a second router of either classifier returns 403 naming the `auto_router` entitlement. Existing routers are unaffected. See [PR #41326](https://github.com/BerriAI/litellm/pull/41326)

**Pricing copied into `model_info` by pre-v1.102 Admin UI edits is ignored.** A stored `model_info` blob carrying a `key` field next to prices is treated as a copied `/model/info` response, so the row follows the cost map again and heals on its next save. Custom pricing declared in `litellm_params`, or typed without `key`, is untouched. `/model/info` now reports `model_info.pricing_overrides`. See [PR #41843](https://github.com/BerriAI/litellm/pull/41843)

**The `litellm-proxy` entrypoint is deprecated in favour of `lite`.** It still runs, printing one deprecation line on stderr. `lite autoroute up` and `down` are renamed to `start` and `stop`, with the old names kept as deprecated aliases. See [PR #41673](https://github.com/BerriAI/litellm/pull/41673), [PR #41672](https://github.com/BerriAI/litellm/pull/41672)

**Repeated failed Admin UI sign-in attempts are throttled**, and `lite login` session tokens are re-checked against the live user and team rows, so a removed member gets 403, a deleted user 401, and a demoted admin loses admin routes on the next request after the cache window. See [PR #40982](https://github.com/BerriAI/litellm/pull/40982), [PR #40657](https://github.com/BerriAI/litellm/pull/40657)

:::

## Key Highlights

- **Config file ownership**: one precedence rule across every settings surface, a `source` and `editable` flag on both read endpoints, read-only fields in the Admin UI, and a startup warning naming each stored value the file is ignoring
- **Fuse and Capability routing**: a capability classifier, Fuse V2 after capability forecasting, per-model Fast mode, maintained Fuse model and harness presets, TypeSafe Jev as a complexity classifier, and heuristic v2 score estimates in routing details
- **Gateway hardening**: MCP client allowlisting, live session visibility with admin force-close, delegated OAuth admission, RFC 8693 token exchange for IdP JWTs, and per-issuer JWT key scoping
- **Spend and budget correctness**: per-member organization spend, project budgets enforced additively, team-level `model_max_budget` with key overrides, temporary budget increases, lifetime `total_spend` on keys, and budgets re-checked on fallback targets
- **408 new model catalog entries**: additions across OpenRouter, AIHubMix, Azure, Together AI, Vertex AI, Deepgram and others, with 147 pricing corrections

## New Providers and Endpoints

### Expanded provider endpoint support

| Provider | Endpoint | What you can do |
| --- | --- | --- |
| [NVIDIA NIM](../../docs/providers/nvidia_nim) | `/nvidia_nim/*` | Reach NIM object detection and OCR `/v1/infer` through a pass-through route |
| [Amazon Transcribe](../../docs/pass_through/transcribe) | `/transcribe/*` | Submit transcription jobs through a pass-through route with completion-time pricing |
| [Deepgram](../../docs/pass_through/deepgram_listen_websocket) | `/v1/listen` | Stream audio over a WebSocket pass-through with duration-based cost tracking |
| [Azure AI Speech](../../docs/pass_through/azure_speech) | `/azure/speech/*` | Reach Azure AI Speech through a pass-through route |
| [xAI](../../docs/providers/xai) | `/v1/audio/transcriptions` | Transcribe audio with Grok Voice Transcribe |
| [Vertex AI](../../docs/providers/vertex) | `/v1/realtime` | Stream Chirp speech-to-text over the realtime API |
| [Hosted vLLM](../../docs/providers/vllm) | `/v1/batches` | Run batches inside LiteLLM against hosted vLLM deployments |
| [Mistral](../../docs/pass_through/mistral) | `/v1/files`, `/v1/batches` | Submit Mistral files and batches, with per-page OCR batch cost tracking |
| [AWS Textract](../../docs/providers/bedrock) | `/v1/ocr` | Run OCR through Textract on the Rust OCR path |
| [Microsoft Foundry](../../docs/providers/azure_ai) | `/a2a/*` | Reach Foundry agents with Entra auth and versioned card discovery |
| [TypeSafe AI](../../docs/pass_through/typesafe) | `/typesafe/*` | Reach the Jev evaluate endpoint with registry-priced spend tracking |

## New Models / Updated Models

#### New Model Support (408 new models)

Counts represent new catalog identifiers, including aliases and regional variants. Prices below are the values bundled in this release, in USD; runtime pricing-map reloads can update them. Input and output columns show base token rates; long-context, cache, image-token, and other specialized rates depend on the model

| Provider | Model | Context Window | Input ($/1M tokens) | Output ($/1M tokens) | Features / special pricing |
| --- | --- | --- | --- | --- | --- |
| AIHubMix | `aihubmix/agnes-2.5-flash` | 512,000 | $0.03 | $0.15 | Chat; Reasoning; Vision |
| AIHubMix | `aihubmix/agnes-2.5-pro` | 1,000,000 | $0.45 | $0.9 | Chat; Reasoning; Vision; Prompt caching |
| AIHubMix | `aihubmix/cc-glm-5.1` | 200,000 | $0.06 | $0.22 | Chat; Reasoning; Tool calling; Structured output |
| AIHubMix | `aihubmix/claude-fable-5` | 1,000,000 | $11 | $55 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| AIHubMix | `aihubmix/claude-haiku-4-5` | 200,000 | $1.1 | $5.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| AIHubMix | `aihubmix/claude-opus-4-8-think` | 1,000,000 | $5 | $25 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| AIHubMix | `aihubmix/claude-opus-5` | 1,000,000 | $5 | $25 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search |
| AIHubMix | `aihubmix/claude-sonnet-5` | 1,000,000 | $2 | $10 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| AIHubMix | `aihubmix/coding-glm-5.3` | 1,048,576 | $0.06 | $0.22 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| AIHubMix | `aihubmix/coding-kimi-k3` | 1,048,576 | $0.44 | $1.61333 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| AIHubMix | `aihubmix/coding-xiaomi-mimo-v2-omni` | - | $0.08 | $0.4 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| AIHubMix | `aihubmix/coding-xiaomi-mimo-v2.5` | 1,048,576 | $0.08 | $0.16 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| AIHubMix | `aihubmix/coding-xiaomi-mimo-v2.5-pro` | 1,048,576 | $0.2 | $0.4 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| AIHubMix | `aihubmix/command-a-plus-05-2026` | 128,000 | $2.5 | $10 | Chat; Reasoning; Vision; Tool calling; Structured output |
| AIHubMix | `aihubmix/deepseek-v4-flash` | 1,000,000 | $0.142 | $0.284 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| AIHubMix | `aihubmix/deepseek-v4-pro` | 1,000,000 | $1.69 | $3.38 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| AIHubMix | `aihubmix/doubao-seed-2-0-code-preview` | 256,000 | $0.4822 | $2.411 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Web search |
| AIHubMix | `aihubmix/doubao-seed-2-0-lite-260428` | 256,000 | $0.09041 | $0.54246 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search |
| AIHubMix | `aihubmix/doubao-seed-2-0-mini` | 256,000 | $0.030136 | $0.30136 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search |
| AIHubMix | `aihubmix/doubao-seed-2-0-pro` | 256,000 | $0.4822 | $2.411 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search |
| AIHubMix | `aihubmix/doubao-seed-2-1-turbo` | 256,000 | $0.46475 | $2.32375 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search |
| AIHubMix | `aihubmix/ernie-5.1` | 119,000 | $0.5634 | $2.5353 | Chat; Reasoning; Prompt caching |
| AIHubMix | `aihubmix/gemini-3-flash-preview` | 1,048,576 | $0.5 | $3 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search |
| AIHubMix | `aihubmix/gemini-3-flash-preview-search` | 1,048,576 | $0.5 | $3 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search |
| AIHubMix | `aihubmix/gemini-3.1-pro-preview` | 1,048,576 | $2 | $12 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search |
| AIHubMix | `aihubmix/gemini-3.1-pro-preview-customtools` | 1,048,576 | $2 | $12 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search |
| AIHubMix | `aihubmix/gemini-3.5-flash-lite` | 1,048,576 | $0.3 | $2.499999 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search |
| AIHubMix | `aihubmix/gemini-3.7-flash` | 1,048,576 | $0.75 | $3.75 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search |
| AIHubMix | `aihubmix/gemma-4-26b-a4b-it` | 262,144 | $0.14 | $0.39998 | Chat; Reasoning; Vision |
| AIHubMix | `aihubmix/gemma-4-31b-it` | 262,144 | $0.14 | $0.39998 | Chat; Reasoning; Vision |
| AIHubMix | `aihubmix/glm-5.2-fast-preview` | 1,000,000 | $2.254 | $7.889 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| AIHubMix | `aihubmix/glm-5.3` | 1,048,576 | $1.1268 | $3.9438 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| AIHubMix | `aihubmix/glm-5.3-flash` | 1,048,576 | $0.11268 | $0.39438 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| AIHubMix | `aihubmix/glm-5v-turbo` | 200,000 | $0.7042 | $3.09848 | Chat; Reasoning; Vision; Prompt caching |
| AIHubMix | `aihubmix/gpt-5.3-codex` | 400,000 | $1.75 | $14 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| AIHubMix | `aihubmix/gpt-5.4-high` | 1,050,000 | $2.5 | $15 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search |
| AIHubMix | `aihubmix/gpt-5.4-low` | 1,050,000 | $2.5 | $15 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search |
| AIHubMix | `aihubmix/gpt-5.4-mini` | 400,000 | $0.75 | $4.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search |
| AIHubMix | `aihubmix/gpt-5.4-nano` | 400,000 | $0.2 | $1.25 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search |
| AIHubMix | `aihubmix/gpt-5.5` | 1,050,000 | $5 | $30 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search |
| AIHubMix | `aihubmix/gpt-5.5-pro` | 1,050,000 | $30 | $180 | Chat; Reasoning; Vision; Tool calling; Structured output; Web search |
| AIHubMix | `aihubmix/gpt-5.6-luna` | 1,050,000 | $0.2 | $1.2 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| AIHubMix | `aihubmix/gpt-5.6-sol-disc` | 1,050,000 | $4 | $20 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| AIHubMix | `aihubmix/gpt-5.6-terra` | 1,050,000 | $2 | $12 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| AIHubMix | `aihubmix/gpt-chat-latest` | 400,000 | $5 | $30 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search |
| AIHubMix | `aihubmix/grok-4-20-non-reasoning` | 1,000,000 | $2 | $6 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| AIHubMix | `aihubmix/grok-4-20-reasoning` | 1,000,000 | $2 | $6 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| AIHubMix | `aihubmix/grok-4.6` | 500,000 | $2 | $6 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| AIHubMix | `aihubmix/grok-build-0.1` | 256,000 | $1 | $2 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| AIHubMix | `aihubmix/hy3` | 256,000 | $0.1562 | $0.6248 | Chat; Reasoning; Tool calling; Prompt caching; Structured output; Web search |
| AIHubMix | `aihubmix/hy4-preview` | 1,048,576 | $0.845 | $2.535 | Chat; Reasoning; Tool calling; Prompt caching; Structured output; Web search |
| AIHubMix | `aihubmix/kimi-k2.6` | 262,144 | $0.95 | $3.9995 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| AIHubMix | `aihubmix/kimi-k2.7-code-highspeed` | 262,144 | $1.9 | $7.999 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| AIHubMix | `aihubmix/kimi-k3` | 1,048,576 | $3 | $15 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| AIHubMix | `aihubmix/longcat-2.0` | 1,000,000 | $0.7746 | $3.0984 | Chat; Reasoning; Tool calling; Prompt caching |
| AIHubMix | `aihubmix/mai-thinking-1` | 256,000 | $2 | $8 | Chat; Reasoning; Structured output |
| AIHubMix | `aihubmix/mimo-v2-omni` | 256,000 | $0.44 | $2.2 | Chat; Vision; Prompt caching; Web search |
| AIHubMix | `aihubmix/mimo-v2-pro` | 1,000,000 | $1.1 | $3.3 | Chat; Prompt caching; Web search |
| AIHubMix | `aihubmix/minimax-m2.7` | 204,800 | $0.2958 | $1.1832 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| AIHubMix | `aihubmix/minimax-m3` | 1,000,000 | $0.288 | $1.152 | Chat; Reasoning; Vision; Tool calling; Structured output |
| AIHubMix | `aihubmix/muse-spark-1.2` | 1,048,576 | $1.375 | $4.675 | Chat; Reasoning; Vision; Tool calling |
| AIHubMix | `aihubmix/qwen3-coder-next` | 262,144 | $0.137 | $0.548 | Chat; Tool calling; Structured output |
| AIHubMix | `aihubmix/qwen3.5-122b-a10b` | 262,144 | $0.1126 | $0.9008 | Chat; Reasoning; Vision; Tool calling; Structured output; Web search |
| AIHubMix | `aihubmix/qwen3.5-397b-a17b` | 262,144 | $0.1644 | $0.9864 | Chat; Reasoning; Vision; Tool calling; Structured output; Web search |
| AIHubMix | `aihubmix/qwen3.6-27b` | 262,144 | $0.422 | $2.532 | Chat; Reasoning; Vision; Tool calling; Structured output; Web search |
| AIHubMix | `aihubmix/qwen3.6-35b-a3b` | 262,144 | $0.254 | $1.524 | Chat; Reasoning; Vision; Tool calling; Structured output; Web search |
| AIHubMix | `aihubmix/qwen3.6-max-preview` | 262,144 | $1.268 | $7.608 | Chat; Reasoning; Tool calling; Prompt caching; Structured output; Web search |
| AIHubMix | `aihubmix/qwen3.7-plus` | 1,000,000 | $0.282 | $1.128 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search |
| AIHubMix | `aihubmix/qwen3.8-2.4t-a95b` | 1,000,000 | $2 | $6 | Chat; Reasoning; Tool calling; Prompt caching; Structured output; Web search |
| AIHubMix | `aihubmix/qwen3.8-flash` | 1,000,000 | $0.1126 | $0.380025 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search |
| AIHubMix | `aihubmix/qwen3.8-max` | 1,000,000 | $1.69 | $5.07 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search |
| AIHubMix | `aihubmix/step-3.7-flash` | 256,000 | $0.22 | $1.32 | Chat; Reasoning; Vision; Prompt caching |
| Amazon Bedrock | `writer.palmyra-vision-7b` | 4,096 | $0.15 | $0.6 | Chat; Vision |
| Amazon Transcribe | `transcribe/StartTranscriptionJob` | - | - | - | Transcription; `input_cost_per_second`: $0.0001; `output_cost_per_second`: $0 |
| Azure AI | `azure_ai/FLUX.2-flex` | 32,000 | - | - | Image generation |
| Azure AI | `azure_ai/gpt-5.5-2026-04-24` | 1,050,000 | $5 | $30 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search; System messages; Parallel tools |
| Azure OpenAI | `azure/chat-latest` | 272,000 | $5 | $30 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search; System messages; Parallel tools |
| Azure OpenAI | `azure/eu/codex-mini` | - | $1.65 | $6.6 | Chat |
| Azure OpenAI | `azure/eu/computer-use-preview` | - | $3.3 | $13.2 | Chat |
| Azure OpenAI | `azure/eu/gpt-4.1` | - | $2.2 | $8.8 | Chat; `input_cost_per_token_batches`: $1.1e-06; `output_cost_per_token_batches`: $4.4e-06 |
| Azure OpenAI | `azure/eu/gpt-4.1-mini` | - | $0.44 | $1.76 | Chat; `input_cost_per_token_batches`: $2.2e-07; `output_cost_per_token_batches`: $8.8e-07 |
| Azure OpenAI | `azure/eu/gpt-4.1-nano` | - | $0.11 | $0.44 | Chat; `input_cost_per_token_batches`: $5.5e-08; `output_cost_per_token_batches`: $2.2e-07 |
| Azure OpenAI | `azure/eu/gpt-4o-2024-05-13` | - | $5.5 | $16.5 | Chat; `input_cost_per_token_batches`: $2.75e-06; `output_cost_per_token_batches`: $8.25e-06 |
| Azure OpenAI | `azure/eu/gpt-5` | - | $1.375 | $11 | Chat; `input_cost_per_token_batches`: $6.875e-07; `output_cost_per_token_batches`: $5.5e-06 |
| Azure OpenAI | `azure/eu/gpt-5-codex` | - | $1.375 | $11 | Chat |
| Azure OpenAI | `azure/eu/gpt-5-mini` | - | $0.275 | $2.2 | Chat; `input_cost_per_token_batches`: $1.375e-07; `output_cost_per_token_batches`: $1.1e-06 |
| Azure OpenAI | `azure/eu/gpt-5-nano` | - | $0.055 | $0.44 | Chat; `input_cost_per_token_batches`: $2.75e-08; `output_cost_per_token_batches`: $2.2e-07 |
| Azure OpenAI | `azure/eu/gpt-5-pro` | - | $16.5 | $132 | Chat; `input_cost_per_token_batches`: $8.25e-06; `output_cost_per_token_batches`: $6.6e-05 |
| Azure OpenAI | `azure/eu/gpt-5.1-codex-max` | - | $1.375 | $11 | Chat |
| Azure OpenAI | `azure/eu/gpt-5.2` | - | $1.925 | $15.4 | Chat; `input_cost_per_token_batches`: $9.625e-07; `output_cost_per_token_batches`: $7.7e-06 |
| Azure OpenAI | `azure/eu/gpt-5.2-chat` | - | $1.925 | $15.4 | Chat |
| Azure OpenAI | `azure/eu/gpt-5.2-codex` | - | $1.925 | $15.4 | Chat |
| Azure OpenAI | `azure/eu/gpt-5.2-pro` | - | $23.1 | $184.8 | Chat; `input_cost_per_token_batches`: $1.155e-05; `output_cost_per_token_batches`: $9.24e-05 |
| Azure OpenAI | `azure/eu/gpt-5.3-chat` | - | $1.925 | $15.4 | Chat |
| Azure OpenAI | `azure/eu/gpt-5.3-codex` | - | $1.925 | $15.4 | Chat |
| Azure OpenAI | `azure/eu/gpt-5.4-mini` | - | $0.825 | $4.95 | Chat; `input_cost_per_token_batches`: $4.125e-07; `output_cost_per_token_batches`: $2.475e-06 |
| Azure OpenAI | `azure/eu/gpt-5.4-nano` | - | $0.22 | $1.375 | Chat; `input_cost_per_token_batches`: $1.1e-07; `output_cost_per_token_batches`: $6.875e-07 |
| Azure OpenAI | `azure/eu/gpt-5.4-pro` | - | $33 | $198 | Chat; `input_cost_per_token_batches`: $1.65e-05; `output_cost_per_token_batches`: $9.9e-05 |
| Azure OpenAI | `azure/eu/gpt-5.5-2026-04-24` | 1,050,000 | $5.5 | $33 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search; System messages; Parallel tools; `input_cost_per_token_batches`: $2.75e-06; `output_cost_per_token_batches`: $1.65e-05 |
| Azure OpenAI | `azure/eu/gpt-6-astra` | - | $11 | $55 | Chat |
| Azure OpenAI | `azure/eu/o1-mini` | - | $1.21 | $4.84 | Chat; `input_cost_per_token_batches`: $6.05e-07; `output_cost_per_token_batches`: $2.42e-06 |
| Azure OpenAI | `azure/eu/o1-preview` | - | $16.5 | $66 | Chat |
| Azure OpenAI | `azure/eu/o3-2025-04-16` | - | $2.2 | $8.8 | Chat; `input_cost_per_token_batches`: $1.1e-06; `output_cost_per_token_batches`: $4.4e-06 |
| Azure OpenAI | `azure/eu/o3-deep-research` | - | $11 | $44 | Chat |
| Azure OpenAI | `azure/eu/o4-mini-2025-04-16` | - | $1.21 | $4.84 | Chat; `input_cost_per_token_batches`: $6.05e-07; `output_cost_per_token_batches`: $2.42e-06 |
| Azure OpenAI | `azure/eu/text-embedding-3-large` | - | $0.143 | - | Embeddings |
| Azure OpenAI | `azure/eu/text-embedding-3-small` | - | $0.022 | - | Embeddings |
| Azure OpenAI | `azure/eu/text-embedding-ada-002` | - | $0.11 | - | Embeddings |
| Azure OpenAI | `azure/gpt-5.5-2026-04-24` | 1,050,000 | $5 | $30 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search; System messages; Parallel tools; `input_cost_per_token_batches`: $2.5e-06; `output_cost_per_token_batches`: $1.5e-05 |
| Azure OpenAI | `azure/gpt-5.6-luna-2026-07-09` | 922,000 | $0.2 | $1.2 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search; System messages; Parallel tools |
| Azure OpenAI | `azure/gpt-5.6-sol-2026-07-09` | 922,000 | $4 | $20 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search; System messages; Parallel tools |
| Azure OpenAI | `azure/gpt-5.6-terra-2026-07-09` | 922,000 | $2 | $12 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search; System messages; Parallel tools |
| Azure OpenAI | `azure/gpt-6-astra-2026-09-03` | 922,000 | $10 | $50 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Computer use; Web search; System messages; Parallel tools |
| Azure OpenAI | `azure/gpt-chat-latest` | 272,000 | $5 | $30 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search; System messages; Parallel tools |
| Azure OpenAI | `azure/gpt-image-2.5-flare` | - | $5 | - | Image generation; Vision; PDF input |
| Azure OpenAI | `azure/gpt-image-2.5-sunburst` | - | $5 | - | Image generation; Vision; PDF input |
| Azure OpenAI | `azure/us/codex-mini` | - | $1.65 | $6.6 | Chat |
| Azure OpenAI | `azure/us/computer-use-preview` | - | $3.3 | $13.2 | Chat |
| Azure OpenAI | `azure/us/gpt-4.1` | - | $2.2 | $8.8 | Chat; `input_cost_per_token_batches`: $1.1e-06; `output_cost_per_token_batches`: $4.4e-06 |
| Azure OpenAI | `azure/us/gpt-4.1-mini` | - | $0.44 | $1.76 | Chat; `input_cost_per_token_batches`: $2.2e-07; `output_cost_per_token_batches`: $8.8e-07 |
| Azure OpenAI | `azure/us/gpt-4.1-nano` | - | $0.11 | $0.44 | Chat; `input_cost_per_token_batches`: $5.5e-08; `output_cost_per_token_batches`: $2.2e-07 |
| Azure OpenAI | `azure/us/gpt-4o-2024-05-13` | - | $5.5 | $16.5 | Chat; `input_cost_per_token_batches`: $2.75e-06; `output_cost_per_token_batches`: $8.25e-06 |
| Azure OpenAI | `azure/us/gpt-5` | - | $1.375 | $11 | Chat; `input_cost_per_token_batches`: $6.875e-07; `output_cost_per_token_batches`: $5.5e-06 |
| Azure OpenAI | `azure/us/gpt-5-codex` | - | $1.375 | $11 | Chat |
| Azure OpenAI | `azure/us/gpt-5-mini` | - | $0.275 | $2.2 | Chat; `input_cost_per_token_batches`: $1.375e-07; `output_cost_per_token_batches`: $1.1e-06 |
| Azure OpenAI | `azure/us/gpt-5-nano` | - | $0.055 | $0.44 | Chat; `input_cost_per_token_batches`: $2.75e-08; `output_cost_per_token_batches`: $2.2e-07 |
| Azure OpenAI | `azure/us/gpt-5-pro` | - | $16.5 | $132 | Chat; `input_cost_per_token_batches`: $8.25e-06; `output_cost_per_token_batches`: $6.6e-05 |
| Azure OpenAI | `azure/us/gpt-5.1-codex-max` | - | $1.375 | $11 | Chat |
| Azure OpenAI | `azure/us/gpt-5.2` | - | $1.925 | $15.4 | Chat; `input_cost_per_token_batches`: $9.625e-07; `output_cost_per_token_batches`: $7.7e-06 |
| Azure OpenAI | `azure/us/gpt-5.2-chat` | - | $1.925 | $15.4 | Chat |
| Azure OpenAI | `azure/us/gpt-5.2-codex` | - | $1.925 | $15.4 | Chat |
| Azure OpenAI | `azure/us/gpt-5.2-pro` | - | $23.1 | $184.8 | Chat; `input_cost_per_token_batches`: $1.155e-05; `output_cost_per_token_batches`: $9.24e-05 |
| Azure OpenAI | `azure/us/gpt-5.3-chat` | - | $1.925 | $15.4 | Chat |
| Azure OpenAI | `azure/us/gpt-5.3-codex` | - | $1.925 | $15.4 | Chat |
| Azure OpenAI | `azure/us/gpt-5.4-mini` | - | $0.825 | $4.95 | Chat; `input_cost_per_token_batches`: $4.125e-07; `output_cost_per_token_batches`: $2.475e-06 |
| Azure OpenAI | `azure/us/gpt-5.4-nano` | - | $0.22 | $1.375 | Chat; `input_cost_per_token_batches`: $1.1e-07; `output_cost_per_token_batches`: $6.875e-07 |
| Azure OpenAI | `azure/us/gpt-5.4-pro` | - | $33 | $198 | Chat; `input_cost_per_token_batches`: $1.65e-05; `output_cost_per_token_batches`: $9.9e-05 |
| Azure OpenAI | `azure/us/gpt-5.5-2026-04-24` | 1,050,000 | $5.5 | $33 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search; System messages; Parallel tools; `input_cost_per_token_batches`: $2.75e-06; `output_cost_per_token_batches`: $1.65e-05 |
| Azure OpenAI | `azure/us/gpt-chat-latest` | 272,000 | $5.5 | $33 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search; System messages; Parallel tools |
| Azure OpenAI | `azure/us/o1-mini` | - | $1.21 | $4.84 | Chat; `input_cost_per_token_batches`: $6.05e-07; `output_cost_per_token_batches`: $2.42e-06 |
| Azure OpenAI | `azure/us/o1-preview` | - | $16.5 | $66 | Chat |
| Azure OpenAI | `azure/us/o3-deep-research` | - | $11 | $44 | Chat |
| Azure OpenAI | `azure/us/text-embedding-3-large` | - | $0.143 | - | Embeddings |
| Azure OpenAI | `azure/us/text-embedding-3-small` | - | $0.022 | - | Embeddings |
| Azure OpenAI | `azure/us/text-embedding-ada-002` | - | $0.11 | - | Embeddings |
| Cohere | `command-a-plus-05-2026` | 128,000 | $0 | $0 | Chat; Reasoning; Vision; Tool calling; Tool choice; Structured output |
| DashScope | `dashscope/qwen3.8-flash` | 991,808 | $0.15 | $0.47 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; Web search; Video input |
| DashScope | `dashscope/qwen3.8-omni-flash` | 991,808 | $0.15 | $0.47 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; Web search; Audio input; Video input |
| Deepgram | `deepgram/streaming/detect_entities` | - | - | - | Transcription; `input_cost_per_second`: $2.833e-05; `output_cost_per_second`: $0 |
| Deepgram | `deepgram/streaming/diarize` | - | - | - | Transcription; `input_cost_per_second`: $3.333e-05; `output_cost_per_second`: $0 |
| Deepgram | `deepgram/streaming/keyterm` | - | - | - | Transcription; `input_cost_per_second`: $2.167e-05; `output_cost_per_second`: $0 |
| Deepgram | `deepgram/streaming/nova-3` | - | - | - | Transcription; `input_cost_per_second`: $8e-05; `output_cost_per_second`: $0 |
| Deepgram | `deepgram/streaming/nova-3-multilingual` | - | - | - | Transcription; `input_cost_per_second`: $9.667e-05; `output_cost_per_second`: $0 |
| Deepgram | `deepgram/streaming/redact` | - | - | - | Transcription; `input_cost_per_second`: $3.333e-05; `output_cost_per_second`: $0 |
| Fireworks AI | `fireworks_ai/accounts/fireworks/routers/glm-5p3-fast` | 1,048,576 | $2.1 | $6.6 | Chat; Reasoning; Tool calling; Tool choice; Structured output |
| Fireworks AI | `fireworks_ai/glm-5p3-fast` | 1,048,576 | $2.1 | $6.6 | Chat; Reasoning; Tool calling; Tool choice; Structured output |
| FriendliAI | `friendliai/LGAI-EXAONE/K-EXAONE-2.0-750B-A37B` | 262,144 | $0.6 | $2.4 | Chat; Reasoning; Tool calling; Tool choice; Prompt caching; Structured output; System messages; Parallel tools |
| FriendliAI | `friendliai/MiniMaxAI/MiniMax-M2.5` | 196,608 | $0.3 | $1.2 | Chat; Reasoning; Tool calling; Tool choice; Prompt caching; Structured output; System messages; Parallel tools |
| FriendliAI | `friendliai/deepseek-ai/DeepSeek-V3.2` | 163,840 | $0.5 | $1.5 | Chat; Reasoning; Tool calling; Tool choice; Prompt caching; Structured output; System messages; Parallel tools |
| FriendliAI | `friendliai/google/gemma-4-31B-it` | 262,144 | $0.14 | $0.4 | Chat; Reasoning; Vision; Tool calling; Tool choice; Structured output; System messages; Parallel tools |
| FriendliAI | `friendliai/zai-org/GLM-5.1` | 202,752 | $1.4 | $4.4 | Chat; Reasoning; Tool calling; Tool choice; Prompt caching; Structured output; System messages; Parallel tools |
| FriendliAI | `friendliai/zai-org/GLM-5.2` | 1,048,576 | $1.4 | $4.4 | Chat; Reasoning; Tool calling; Tool choice; Prompt caching; Structured output; System messages; Parallel tools |
| Gemini | `gemini-3.8-live` | 131,072 | $0.75 | $4.5 | Realtime; Vision; Tool calling; Web search; Audio input; Audio output; `input_cost_per_video_per_second`: $3.333333333e-05; `input_cost_per_audio_token`: $3e-06; `output_cost_per_audio_token`: $1.2e-05 |
| Gemini | `gemini-3.8-live-extended-thinking` | 131,072 | $0.75 | $4.5 | Realtime; Reasoning; Vision; Tool calling; Web search; Audio input; Audio output; `input_cost_per_video_per_second`: $3.333333333e-05; `input_cost_per_audio_token`: $3e-06; `output_cost_per_audio_token`: $1.2e-05 |
| Gemini | `gemini/gemini-3.8-live` | 131,072 | $0.75 | $4.5 | Realtime; Vision; Tool calling; Web search; Audio input; `input_cost_per_audio_token`: $3e-06; `output_cost_per_audio_token`: $1.2e-05 |
| Gemini | `gemini/gemini-3.8-live-extended-thinking` | 131,072 | $0.75 | $4.5 | Realtime; Vision; Tool calling; Web search; Audio input; `input_cost_per_audio_token`: $3e-06; `output_cost_per_audio_token`: $1.2e-05 |
| Mistral | `mistral/zai-glm-5` | 1,048,576 | $1.4 | $4.4 | Chat; Reasoning; Tool calling; Tool choice; Prompt caching; Structured output |
| Mistral | `mistral/zai-glm-5-3` | 1,048,576 | $1.4 | $4.4 | Chat; Reasoning; Tool calling; Tool choice; Prompt caching; Structured output |
| Mistral | `mistral/zai-glm-latest` | 1,048,576 | $1.4 | $4.4 | Chat; Reasoning; Tool calling; Tool choice; Prompt caching; Structured output |
| Nebius | `nebius/deepseek-ai/DeepSeek-V4-Pro-0813` | - | $1.32 | $3.96 | Chat; Reasoning; Tool calling |
| Nebius | `nebius/zai-org/GLM-5.3` | 1,048,576 | $1.4 | $4.4 | Chat; Reasoning; Tool calling |
| OpenAI | `gpt-5.5-cyber` | - | $12.5 | $75 | Chat; Reasoning |
| OpenAI | `gpt-rosalind-research` | - | $5 | $25 | Chat |
| OpenRouter | `openrouter/aion-labs/aion-2.0` | 131,072 | $0.8 | $1.6 | Chat; Reasoning; Tool calling; Tool choice; Prompt caching; Structured output |
| OpenRouter | `openrouter/aion-labs/aion-3.0` | 131,072 | $3 | $6 | Chat; Reasoning; Tool calling; Tool choice; Prompt caching; Structured output |
| OpenRouter | `openrouter/aion-labs/aion-3.0-mini` | 131,072 | $0.7 | $1.4 | Chat; Reasoning; Tool calling; Tool choice; Prompt caching; Structured output |
| OpenRouter | `openrouter/aion-labs/aion-rp-llama-3.1-8b` | 32,768 | $0.8 | $1.6 | Chat |
| OpenRouter | `openrouter/amazon/nova-2-lite-v1` | 1,000,000 | $0.3 | $2.5 | Chat; Reasoning; Vision; Tool calling; Tool choice; PDF input |
| OpenRouter | `openrouter/amazon/nova-lite-v1` | 300,000 | $0.06 | $0.24 | Chat; Vision; Tool calling |
| OpenRouter | `openrouter/amazon/nova-micro-v1` | 128,000 | $0.035 | $0.14 | Chat; Tool calling |
| OpenRouter | `openrouter/amazon/nova-premier-v1` | 1,000,000 | $2.5 | $12.5 | Chat; Vision; Tool calling; Prompt caching |
| OpenRouter | `openrouter/amazon/nova-pro-v1` | 300,000 | $0.8 | $3.2 | Chat; Vision; Tool calling |
| OpenRouter | `openrouter/anthracite-org/magnum-v4-72b` | 32,768 | $2.5 | $5 | Chat; Structured output |
| OpenRouter | `openrouter/anthropic/claude-fable-5.1:batch` | 1,000,000 | $5 | $25 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/anthropic/claude-fable-5:batch` | 1,000,000 | $5 | $25 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/anthropic/claude-haiku-4.5:batch` | 200,000 | $0.5 | $2.5 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/anthropic/claude-opus-4.1:batch` | 200,000 | $7.5 | $37.5 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/anthropic/claude-opus-4.5:batch` | 200,000 | $2.5 | $12.5 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/anthropic/claude-opus-4.6:batch` | 1,000,000 | $2.5 | $12.5 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/anthropic/claude-opus-4.7:batch` | 1,000,000 | $2.5 | $12.5 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/anthropic/claude-opus-4.8:batch` | 1,000,000 | $2.5 | $12.5 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/anthropic/claude-opus-5:batch` | 1,000,000 | $2.5 | $12.5 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/anthropic/claude-sonnet-4.5:batch` | 1,000,000 | $1.5 | $7.5 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/anthropic/claude-sonnet-4.6:batch` | 1,000,000 | $1.5 | $7.5 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/anthropic/claude-sonnet-5:batch` | 1,000,000 | $1 | $5 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/arcee-ai/trinity-large-thinking` | 262,144 | $0.25 | $0.8 | Chat; Reasoning; Tool calling; Tool choice; Prompt caching |
| OpenRouter | `openrouter/baidu/ernie-4.5-vl-424b-a47b` | 123,000 | $0.42 | $1.25 | Chat; Reasoning; Vision |
| OpenRouter | `openrouter/bytedance-seed/seed-1.6` | 262,144 | $0.25 | $2 | Chat; Reasoning; Vision; Tool calling; Tool choice; Structured output |
| OpenRouter | `openrouter/bytedance-seed/seed-1.6-flash` | 262,144 | $0.075 | $0.3 | Chat; Reasoning; Vision; Tool calling; Tool choice; Structured output |
| OpenRouter | `openrouter/bytedance-seed/seed-2-1-turbo` | 262,144 | $0.5 | $2.5 | Chat; Reasoning; Vision; Tool calling; Tool choice; Structured output |
| OpenRouter | `openrouter/bytedance-seed/seed-2.0-code` | 262,144 | $0.5 | $3 | Chat; Reasoning; Vision; Tool calling; Tool choice; Structured output |
| OpenRouter | `openrouter/bytedance-seed/seed-2.0-lite` | 262,144 | $0.25 | $2 | Chat; Reasoning; Vision; Tool calling; Tool choice; Structured output |
| OpenRouter | `openrouter/bytedance-seed/seed-2.0-mini` | 262,144 | $0.1 | $0.4 | Chat; Reasoning; Vision; Tool calling; Tool choice; Structured output |
| OpenRouter | `openrouter/cognitivecomputations/dolphin-mistral-24b-venice-edition` | 128,000 | $0.2 | $0.9 | Chat; Structured output |
| OpenRouter | `openrouter/cohere/command-a` | 256,000 | $2.5 | $10 | Chat; Structured output |
| OpenRouter | `openrouter/cohere/command-r-08-2024` | 128,000 | $0.15 | $0.6 | Chat; Tool calling; Tool choice; Structured output |
| OpenRouter | `openrouter/cohere/command-r-plus-08-2024` | 128,000 | $2.5 | $10 | Chat; Tool calling; Tool choice; Structured output |
| OpenRouter | `openrouter/cohere/command-r7b-12-2024` | 128,000 | $0.0375 | $0.15 | Chat; Structured output |
| OpenRouter | `openrouter/cohere/north-mini-code:free` | 256,000 | $0 | $0 | Chat; Reasoning; Tool calling; Tool choice |
| OpenRouter | `openrouter/deepseek/deepseek-v4-flash-0731:batch` | 1,048,576 | $0.11 | $0.33 | Chat; Reasoning; Tool calling; Tool choice; Prompt caching; Structured output |
| OpenRouter | `openrouter/deepseek/deepseek-v4-flash-0731:free` | 1,048,576 | $0 | $0 | Chat; Reasoning; Tool calling; Tool choice; Structured output |
| OpenRouter | `openrouter/deepseek/deepseek-v4-flash-vision-exp:batch` | 1,048,576 | $0.11 | $0.33 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output |
| OpenRouter | `openrouter/deepseek/deepseek-v4-pro-0813:batch` | 1,048,576 | $0.66 | $1.98 | Chat; Reasoning; Tool calling; Tool choice; Prompt caching; Structured output |
| OpenRouter | `openrouter/dots-studio/dots-3-note-preview:free` | 512,000 | $0 | $0 | Chat; Reasoning; Vision; Tool calling; Tool choice; Structured output |
| OpenRouter | `openrouter/google/gemini-2.5-flash-lite:batch` | 1,048,576 | $0.05 | $0.2 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search; Audio input; Video input; `input_cost_per_audio_token`: $1.5e-07 |
| OpenRouter | `openrouter/google/gemini-2.5-flash:batch` | 1,048,576 | $0.15 | $1.25 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search; Audio input; Video input; `input_cost_per_audio_token`: $5e-07 |
| OpenRouter | `openrouter/google/gemini-2.5-pro:batch` | 1,048,576 | $0.625 | $5 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search; Audio input; Video input; `input_cost_per_audio_token`: $6.25e-07 |
| OpenRouter | `openrouter/google/gemini-3-flash-preview:batch` | 1,048,576 | $0.25 | $1.5 | Chat; Reasoning; Vision; Tool calling; Tool choice; Structured output; PDF input; Web search; Audio input; Video input; `input_cost_per_audio_token`: $5e-07 |
| OpenRouter | `openrouter/google/gemini-3.1-flash-lite:batch` | 1,048,576 | $0.125 | $0.75 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search; Audio input; Video input; `input_cost_per_audio_token`: $2.5e-07 |
| OpenRouter | `openrouter/google/gemini-3.1-pro-preview:batch` | 1,048,576 | $1 | $6 | Chat; Reasoning; Vision; Tool calling; Tool choice; Structured output; PDF input; Web search; Audio input; Video input; `input_cost_per_audio_token`: $1e-06 |
| OpenRouter | `openrouter/google/gemini-3.5-flash-lite:batch` | 1,048,576 | $0.15 | $1.25 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search; Audio input; Video input; `input_cost_per_audio_token`: $1.5e-07 |
| OpenRouter | `openrouter/google/gemini-3.5-flash:batch` | 1,048,576 | $0.75 | $4.5 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search; Audio input; Video input; `input_cost_per_audio_token`: $1.5e-06 |
| OpenRouter | `openrouter/google/gemini-3.6-flash:batch` | 1,048,576 | $0.375 | $1.875 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search; Audio input; Video input; `input_cost_per_audio_token`: $3.75e-07 |
| OpenRouter | `openrouter/google/gemini-3.7-flash:batch` | 1,048,576 | $0.375 | $1.875 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search; Audio input; Video input; `input_cost_per_audio_token`: $3.75e-07 |
| OpenRouter | `openrouter/google/gemini-3.8-flash:batch` | 1,048,576 | $0.375 | $1.875 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search; Audio input; Video input; `input_cost_per_audio_token`: $3.75e-07 |
| OpenRouter | `openrouter/ibm-granite/granite-4.0-h-micro` | 131,000 | $0.017 | $0.112 | Chat; Structured output |
| OpenRouter | `openrouter/ibm-granite/granite-4.2-8b` | 131,072 | $0.06 | $0.25 | Chat; Reasoning; Tool calling; Tool choice; Prompt caching; Structured output |
| OpenRouter | `openrouter/inception/mercury-2` | 128,000 | $0.25 | $0.75 | Chat; Reasoning; Tool calling; Tool choice; Prompt caching; Structured output |
| OpenRouter | `openrouter/inception/mercury-2.5` | 260,000 | $0.04 | $0.15 | Chat; Reasoning; Tool calling; Tool choice; Prompt caching; Structured output |
| OpenRouter | `openrouter/inclusionai/ling-3.0-flash` | 262,144 | $0.021 | $0.063 | Chat; Reasoning; Tool calling; Tool choice; Prompt caching; Structured output |
| OpenRouter | `openrouter/inclusionai/ling-3.0-flash-fin` | 262,144 | $0.06 | $0.18 | Chat; Reasoning; Tool calling; Tool choice; Prompt caching; Structured output |
| OpenRouter | `openrouter/inclusionai/ling-3.0-flash-fin:free` | 262,144 | $0 | $0 | Chat; Reasoning; Tool calling; Tool choice |
| OpenRouter | `openrouter/inclusionai/ling-3.0-flash-sante:free` | 262,144 | $0 | $0 | Chat; Reasoning; Tool calling; Tool choice |
| OpenRouter | `openrouter/inclusionai/ling-3.0-flash-vl` | 131,072 | $0.06 | $0.18 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output |
| OpenRouter | `openrouter/inclusionai/ling-3.0-flash-vl:free` | 262,144 | $0 | $0 | Chat; Reasoning; Vision; Tool calling; Tool choice |
| OpenRouter | `openrouter/inference-net/schematron-v2-small` | 128,000 | $0.05 | $0.23 | Chat; Prompt caching; Structured output |
| OpenRouter | `openrouter/inference-net/schematron-v2-turbo` | 128,000 | $0.03 | $0.15 | Chat; Prompt caching; Structured output |
| OpenRouter | `openrouter/kwaipilot/kat-coder-pro-v2` | 262,144 | $0.3 | $1.2 | Chat; Tool calling; Tool choice; Prompt caching; Structured output |
| OpenRouter | `openrouter/kwaipilot/kat-coder-pro-v2.5` | 262,144 | $0.74 | $2.96 | Chat; Tool calling; Tool choice; Prompt caching; Structured output |
| OpenRouter | `openrouter/liquid/lfm-2.5-2.6b:free` | 65,536 | $0 | $0 | Chat; Reasoning; Tool calling; Tool choice; Structured output |
| OpenRouter | `openrouter/meituan/longcat-2.0` | 1,048,756 | $0.3 | $1.2 | Chat; Reasoning; Tool calling; Tool choice; Prompt caching |
| OpenRouter | `openrouter/meta/muse-glimmer-30b` | 131,072 | $0.35 | $1.5 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output |
| OpenRouter | `openrouter/meta/muse-glimmer-30b:batch` | 131,072 | $0.175 | $0.75 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output |
| OpenRouter | `openrouter/meta/muse-spark-1.1` | 1,048,576 | $1.25 | $4.25 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search; Audio input |
| OpenRouter | `openrouter/meta/muse-spark-1.2` | 1,048,576 | $1.25 | $4.25 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search; Audio input |
| OpenRouter | `openrouter/meta/muse-spark-1.2-contributor` | 1,048,576 | $0.1 | $0.2 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search; Audio input |
| OpenRouter | `openrouter/meta/muse-spark-1.3` | 1,048,576 | $1.25 | $4.25 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search; Audio input |
| OpenRouter | `openrouter/meta/muse-spark-1.3-contributor` | 1,048,576 | $0.1 | $0.2 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search; Audio input |
| OpenRouter | `openrouter/microsoft/phi-4` | 16,384 | $0.07 | $0.14 | Chat; Structured output |
| OpenRouter | `openrouter/microsoft/wizardlm-2-8x22b` | 65,535 | $0.62 | $0.62 | Chat; Structured output |
| OpenRouter | `openrouter/minimax/minimax-m3:batch` | 524,288 | $0.3 | $1.2 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output |
| OpenRouter | `openrouter/mistralai/codestral-2508:batch` | 256,000 | $0.15 | $0.45 | Chat; Tool calling; Tool choice; Prompt caching; Structured output; PDF input |
| OpenRouter | `openrouter/mistralai/ministral-8b-2512:batch` | 262,144 | $0.075 | $0.075 | Chat; Vision; Tool calling; Tool choice; Prompt caching; Structured output |
| OpenRouter | `openrouter/mistralai/mistral-large-2512:batch` | 262,144 | $0.25 | $0.75 | Chat; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input |
| OpenRouter | `openrouter/mistralai/mistral-medium-3-5:batch` | 262,144 | $0.75 | $3.75 | Chat; Reasoning; Vision; Tool calling; Tool choice; Structured output; PDF input |
| OpenRouter | `openrouter/mistralai/mistral-medium-3.1:batch` | 131,072 | $0.2 | $1 | Chat; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input |
| OpenRouter | `openrouter/mistralai/mistral-small-2603:batch` | 262,144 | $0.075 | $0.3 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output |
| OpenRouter | `openrouter/moonshotai/kimi-k3:batch` | 1,048,576 | $3 | $15 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output |
| OpenRouter | `openrouter/morph/morph-v3-fast` | 81,920 | $0.8 | $1.2 | Chat |
| OpenRouter | `openrouter/morph/morph-v3-large` | 262,144 | $0.9 | $1.9 | Chat; Structured output |
| OpenRouter | `openrouter/nex-agi/nex-n2.5-mini:free` | 262,144 | $0 | $0 | Chat; Reasoning; Vision; Tool calling; Tool choice; Structured output |
| OpenRouter | `openrouter/nex-agi/nex-n2.5-pro:free` | 262,144 | $0 | $0 | Chat; Reasoning; Vision; Tool calling; Tool choice; Structured output |
| OpenRouter | `openrouter/nousresearch/hermes-3-llama-3.1-405b` | 131,072 | $1 | $1 | Chat; Structured output |
| OpenRouter | `openrouter/nousresearch/hermes-3-llama-3.1-70b` | 131,072 | $0.7 | $0.7 | Chat; Structured output |
| OpenRouter | `openrouter/nousresearch/hermes-4-405b` | 131,072 | $1 | $3 | Chat; Reasoning; Structured output |
| OpenRouter | `openrouter/openai/gpt-3.5-turbo-0613` | 4,095 | $1 | $2 | Chat; Tool calling; Tool choice; Structured output |
| OpenRouter | `openrouter/openai/gpt-3.5-turbo:batch` | 16,385 | $0.25 | $0.75 | Chat; Tool calling; Tool choice; Structured output; Web search |
| OpenRouter | `openrouter/openai/gpt-4-turbo:batch` | 128,000 | $5 | $15 | Chat; Vision; Tool calling; Tool choice; Structured output; Web search |
| OpenRouter | `openrouter/openai/gpt-4.1-mini:batch` | 1,047,576 | $0.2 | $0.8 | Chat; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/openai/gpt-4.1-nano:batch` | 1,047,576 | $0.05 | $0.2 | Chat; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/openai/gpt-4.1:batch` | 1,047,576 | $1 | $4 | Chat; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/openai/gpt-4o-mini:batch` | 128,000 | $0.075 | $0.3 | Chat; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/openai/gpt-4o:batch` | 128,000 | $1.25 | $5 | Chat; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/openai/gpt-5-image` | 400,000 | $10 | $10 | Chat; Reasoning; Vision; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/openai/gpt-5-image-mini` | 400,000 | $2.5 | $2 | Chat; Reasoning; Vision; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/openai/gpt-5-mini:batch` | 400,000 | $0.125 | $1 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/openai/gpt-5-nano:batch` | 400,000 | $0.025 | $0.2 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/openai/gpt-5-pro:batch` | 400,000 | $7.5 | $60 | Chat; Reasoning; Vision; Tool calling; Tool choice; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/openai/gpt-5.1:batch` | 400,000 | $0.625 | $5 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/openai/gpt-5.2-pro:batch` | 400,000 | $10.5 | $84 | Chat; Reasoning; Vision; Tool calling; Tool choice; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/openai/gpt-5.2:batch` | 400,000 | $0.875 | $7 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/openai/gpt-5.4-image-2` | 272,000 | $8 | $15 | Chat; Reasoning; Vision; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/openai/gpt-5.4-mini:batch` | 400,000 | $0.375 | $2.25 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/openai/gpt-5.4-nano:batch` | 400,000 | $0.1 | $0.625 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/openai/gpt-5.4-pro:batch` | 1,050,000 | $15 | $90 | Chat; Reasoning; Vision; Tool calling; Tool choice; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/openai/gpt-5.4:batch` | 1,050,000 | $1.25 | $7.5 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/openai/gpt-5.5-pro:batch` | 1,050,000 | $15 | $90 | Chat; Reasoning; Vision; Tool calling; Tool choice; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/openai/gpt-5.5:batch` | 1,050,000 | $2.5 | $15 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/openai/gpt-5.6-luna-pro:batch` | 1,050,000 | $0.1 | $0.6 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/openai/gpt-5.6-luna:batch` | 1,050,000 | $0.1 | $0.6 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/openai/gpt-5.6-sol-pro:batch` | 1,050,000 | $1 | $5 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/openai/gpt-5.6-sol:batch` | 1,050,000 | $1 | $5 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/openai/gpt-5.6-terra-pro:batch` | 1,050,000 | $1 | $6 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/openai/gpt-5.6-terra:batch` | 1,050,000 | $1 | $6 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/openai/gpt-5:batch` | 400,000 | $0.625 | $5 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/openai/gpt-6-astra-pro:batch` | 1,050,000 | $5 | $25 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/openai/gpt-6-astra:batch` | 1,050,000 | $5 | $25 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/openai/gpt-oss-120b:batch` | 131,072 | $0.15 | $0.6 | Chat; Reasoning; Tool calling; Tool choice; Structured output |
| OpenRouter | `openrouter/openai/o3-mini:batch` | 200,000 | $0.55 | $2.2 | Chat; Reasoning; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/openai/o3:batch` | 200,000 | $1 | $4 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/openai/o4-mini:batch` | 200,000 | $0.55 | $2.2 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/perceptron/perceptron-mk1` | 32,768 | $0.15 | $1.5 | Chat; Reasoning; Vision; Structured output |
| OpenRouter | `openrouter/perplexity/sonar` | 127,072 | $1 | $1 | Chat; Vision; Web search |
| OpenRouter | `openrouter/perplexity/sonar-deep-research` | 128,000 | $2 | $8 | Chat; Reasoning; Web search |
| OpenRouter | `openrouter/perplexity/sonar-pro` | 200,000 | $3 | $15 | Chat; Vision; Web search |
| OpenRouter | `openrouter/perplexity/sonar-pro-search` | 200,000 | $3 | $15 | Chat; Reasoning; Vision; Structured output; Web search |
| OpenRouter | `openrouter/perplexity/sonar-reasoning-pro` | 128,000 | $2 | $8 | Chat; Reasoning; Vision; Web search |
| OpenRouter | `openrouter/prism-ml/ternary-bonsai-2-27b` | 262,144 | $0.075 | $0.5 | Chat; Reasoning; Vision; Tool calling; Tool choice; Structured output |
| OpenRouter | `openrouter/qwen/qwen3.5-9b:batch` | 262,144 | $0.17 | $0.25 | Chat; Reasoning; Vision; Tool calling; Tool choice; Structured output |
| OpenRouter | `openrouter/qwen/qwen3.8-2.4t-a95b:batch` | 1,010,000 | $2 | $6 | Chat; Reasoning; Tool calling; Tool choice; Prompt caching; Structured output |
| OpenRouter | `openrouter/qwen/qwen3.8-27b:free` | 262,144 | $0 | $0 | Chat; Reasoning; Vision; Tool calling; Tool choice; Structured output |
| OpenRouter | `openrouter/rekaai/reka-edge` | 16,384 | $0.1 | $0.1 | Chat; Vision; Tool calling; Tool choice; Structured output |
| OpenRouter | `openrouter/rekaai/reka-flash-3` | 65,536 | $0.1 | $0.2 | Chat; Reasoning; Structured output |
| OpenRouter | `openrouter/relace/relace-apply-3` | 256,000 | $0.85 | $1.25 | Chat |
| OpenRouter | `openrouter/relace/relace-search` | 256,000 | $1 | $3 | Chat; Tool calling; Tool choice; Structured output |
| OpenRouter | `openrouter/sakana/fugu-max` | 1,000,000 | $2 | $6 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/sakana/fugu-ultra` | 1,000,000 | $5 | $30 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; Web search |
| OpenRouter | `openrouter/sakana/fugu-ultra-v2` | 1,000,000 | $5 | $30 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/sakana/sakana-namazu` | 262,144 | $0.95 | $4 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/sao10k/l3-lunaris-8b` | 8,192 | $0.04 | $0.05 | Chat; Structured output |
| OpenRouter | `openrouter/sao10k/l3.1-euryale-70b` | 131,072 | $0.85 | $0.85 | Chat; Tool calling; Tool choice; Structured output |
| OpenRouter | `openrouter/sao10k/l3.3-euryale-70b` | 131,072 | $0.65 | $0.75 | Chat; Structured output |
| OpenRouter | `openrouter/stealth/union-alpha` | 262,144 | $0 | $0 | Chat; Vision; Tool calling; Tool choice; Structured output |
| OpenRouter | `openrouter/stepfun/step-3.5-flash` | 262,144 | $0.1 | $0.3 | Chat; Reasoning; Tool calling; Tool choice |
| OpenRouter | `openrouter/stepfun/step-3.7-flash` | 262,144 | $0.2 | $1.15 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output |
| OpenRouter | `openrouter/tencent/hunyuan-a13b-instruct` | 131,072 | $0.14 | $0.57 | Chat; Reasoning; Structured output |
| OpenRouter | `openrouter/tencent/hy-mt2-1.8b` | 8,192 | $0.044 | $0.177 | Chat |
| OpenRouter | `openrouter/tencent/hy-mt2-30b-a3b` | 8,192 | $0.074 | $0.295 | Chat; Structured output |
| OpenRouter | `openrouter/tencent/hy-mt2-7b` | 8,192 | $0.074 | $0.295 | Chat; Structured output |
| OpenRouter | `openrouter/tencent/hy3` | 262,144 | $0.132 | $0.528 | Chat; Reasoning; Tool calling; Tool choice; Prompt caching; Structured output |
| OpenRouter | `openrouter/tencent/hy3-preview` | 262,144 | $0.18 | $0.6 | Chat; Reasoning; Tool calling; Tool choice; Prompt caching |
| OpenRouter | `openrouter/tencent/hy4-preview` | 1,048,576 | $0.834 | $2.501 | Chat; Reasoning; Tool calling; Tool choice; Prompt caching; Structured output |
| OpenRouter | `openrouter/thedrummer/cydonia-24b-v4.1` | 131,072 | $0.3 | $0.5 | Chat; Prompt caching; Structured output |
| OpenRouter | `openrouter/thedrummer/skyfall-36b-v2` | 32,768 | $0.55 | $0.8 | Chat; Prompt caching; Structured output |
| OpenRouter | `openrouter/thedrummer/unslopnemo-12b` | 1,024,000 | $0.4 | $0.4 | Chat; Structured output |
| OpenRouter | `openrouter/thinkingmachines/inkling` | 1,048,576 | $1 | $4.05 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Audio input |
| OpenRouter | `openrouter/thinkingmachines/inkling-small` | 1,048,576 | $0.45 | $1.2 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Audio input |
| OpenRouter | `openrouter/thinkingmachines/inkling-small:free` | 1,048,576 | $0 | $0 | Chat; Reasoning; Vision; Tool calling; Audio input |
| OpenRouter | `openrouter/thinkingmachines/inkling:batch` | 524,288 | $1 | $4.05 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Audio input |
| OpenRouter | `openrouter/thinkingmachines/inkling:free` | 1,048,576 | $0 | $0 | Chat; Reasoning; Vision; Tool calling; Audio input |
| OpenRouter | `openrouter/unbiased/pareto` | 262,144 | $2.5 | $7.5 | Chat; Vision; Tool calling; Tool choice; Prompt caching |
| OpenRouter | `openrouter/upstage/solar-pro-3` | 131,072 | $0.15 | $0.6 | Chat; Reasoning; Tool calling; Tool choice; Prompt caching; Structured output |
| OpenRouter | `openrouter/upstage/solar-pro4` | 524,288 | $0.09 | $0.36 | Chat; Reasoning; Tool calling; Tool choice; Prompt caching; Structured output |
| OpenRouter | `openrouter/writer/palmyra-x5` | 1,040,000 | $0.6 | $6 | Chat |
| OpenRouter | `openrouter/x-ai/grok-4.3:batch` | 1,000,000 | $1 | $2 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/z-ai/glm-5.2:batch` | 1,048,576 | $0.7 | $2.2 | Chat; Reasoning; Tool calling; Tool choice; Prompt caching; Structured output |
| OpenRouter | `openrouter/z-ai/glm-5.3-flash:batch` | 1,048,576 | $0.075 | $0.25 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output |
| OpenRouter | `openrouter/z-ai/glm-5.3-flashx` | 1,048,576 | $0.37 | $1.25 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output |
| OpenRouter | `openrouter/z-ai/glm-5.3:batch` | 1,048,576 | $0.7 | $2.2 | Chat; Reasoning; Tool calling; Tool choice; Prompt caching; Structured output |
| OpenRouter | `openrouter/~anthropic/claude-fable-latest` | 1,000,000 | $10 | $50 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/~anthropic/claude-haiku-latest` | 200,000 | $1 | $5 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/~anthropic/claude-opus-latest` | 1,000,000 | $5 | $25 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/~anthropic/claude-sonnet-latest` | 1,000,000 | $2 | $10 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/~deepseek/deepseek-flash-latest` | 1,048,576 | $0.13 | $0.52 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output |
| OpenRouter | `openrouter/~deepseek/deepseek-pro-latest` | 1,048,576 | $0.57816 | $1.73448 | Chat; Reasoning; Tool calling; Tool choice; Prompt caching; Structured output |
| OpenRouter | `openrouter/~deepseek/deepseek-v4-flash-latest` | 1,310,720 | $0.04 | $0.08 | Chat; Reasoning; Tool calling; Tool choice; Prompt caching; Structured output |
| OpenRouter | `openrouter/~google/gemini-flash-latest` | 1,048,576 | $0.75 | $3.75 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search; Audio input; `input_cost_per_audio_token`: $7.5e-07 |
| OpenRouter | `openrouter/~google/gemini-pro-latest` | 1,048,576 | $2 | $12 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search; Audio input; `input_cost_per_audio_token`: $2e-06 |
| OpenRouter | `openrouter/~moonshotai/kimi-latest` | 1,048,576 | $1.7 | $8.5 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output |
| OpenRouter | `openrouter/~openai/gpt-astra-latest` | 1,050,000 | $10 | $50 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/~openai/gpt-luna-latest` | 1,050,000 | $0.2 | $1.2 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/~openai/gpt-mini-latest` | 400,000 | $0.75 | $4.5 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/~openai/gpt-sol-latest` | 1,050,000 | $2 | $10 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/~openai/gpt-terra-latest` | 1,050,000 | $2 | $12 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/~x-ai/grok-latest` | 500,000 | $2 | $6 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/~z-ai/glm-flash-latest` | 1,310,720 | $0.075 | $0.25 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output |
| OpenRouter | `openrouter/~z-ai/glm-latest` | 1,310,720 | $0.8442 | $2.6532 | Chat; Reasoning; Tool calling; Tool choice; Prompt caching; Structured output |
| Qwen | `qwen_ai_platform/qwen3.8-flash` | 991,808 | $0.15 | $0.47 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; Web search; Video input |
| Qwen | `qwen_ai_platform/qwen3.8-omni-flash` | 991,808 | $0.15 | $0.47 | Chat; Reasoning; Vision; Tool calling; Tool choice; Prompt caching; Structured output; Web search; Audio input; Video input |
| Together AI | `together_ai/NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO` | - | $0.6 | $0.6 | Chat |
| Together AI | `together_ai/Qwen/Qwen2-1.5B-Instruct` | - | $0.02 | $0.02 | Chat |
| Together AI | `together_ai/Qwen/Qwen2-72B-Instruct` | - | $0.9 | $0.9 | Chat |
| Together AI | `together_ai/Qwen/Qwen2-VL-72B-Instruct` | - | $1.2 | $1.2 | Chat |
| Together AI | `together_ai/Qwen/Qwen2.5-14B-Instruct` | - | $0.8 | $0.8 | Chat |
| Together AI | `together_ai/Qwen/Qwen2.5-72B-Instruct` | - | $1.2 | $1.2 | Chat |
| Together AI | `together_ai/Qwen/Qwen2.5-Coder-32B-Instruct` | - | $0.8 | $0.8 | Chat |
| Together AI | `together_ai/Qwen/Qwen2.5-VL-72B-Instruct` | - | $1.95 | $8 | Chat |
| Together AI | `together_ai/arcee-ai/trinity-mini` | - | $0.045 | $0.15 | Chat |
| Together AI | `together_ai/deepseek-ai/DeepSeek-R1-Distill-Llama-70B` | - | $2 | $2 | Chat |
| Together AI | `together_ai/deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B` | - | $0.18 | $0.18 | Chat |
| Together AI | `together_ai/deepseek-ai/DeepSeek-R1-Distill-Qwen-14B` | - | $1.6 | $1.6 | Chat |
| Together AI | `together_ai/deepseek-ai/DeepSeek-V4.1-Flash` | 1,048,576 | $0.3 | $1.2 | Chat; Tool calling; Tool choice; Prompt caching; Structured output |
| Together AI | `together_ai/deepseek-ai/deepseek-coder-33b-instruct` | - | $0.8 | $0.8 | Chat |
| Together AI | `together_ai/google/gemma-2-27b-it` | - | $0.8 | $0.8 | Chat |
| Together AI | `together_ai/meta-llama/Llama-3-8b-chat-hf` | - | $0.2 | $0.2 | Chat |
| Together AI | `together_ai/meta-llama/Llama-3.1-405B-Instruct` | - | $3.5 | $3.5 | Chat |
| Together AI | `together_ai/meta-llama/Llama-3.2-1B-Instruct` | - | $0.06 | $0.06 | Chat |
| Together AI | `together_ai/meta-llama/Llama-3.2-3B-Instruct` | - | $0.06 | $0.06 | Chat |
| Together AI | `together_ai/meta-llama/Meta-Llama-3-70B-Instruct-Turbo` | - | $0.88 | $0.88 | Chat |
| Together AI | `together_ai/meta-llama/Meta-Llama-3-8B-Instruct` | - | $0.2 | $0.2 | Chat |
| Together AI | `together_ai/nvidia/Llama-3.1-Nemotron-70B-Instruct-HF` | - | $0.88 | $0.88 | Chat |
| TypeSafe | `typesafe/jev-1.13.0` | - | $0.042 | $0 | - |
| TypeSafe | `typesafe/jev-latest` | - | $0.042 | $0 | - |
| TypeSafe | `typesafe/jev-preview` | - | $0.042 | $0 | - |
| Vertex AI | `vertex_ai/gemini-2.5-flash-native-audio` | - | $0.5 | $2 | Realtime; `input_cost_per_audio_token`: $3e-06; `output_cost_per_audio_token`: $1.2e-05 |
| Vertex AI | `vertex_ai/gemini-2.5-flash-preview-tts` | - | $0.5 | $10 | Speech; `output_cost_per_audio_token`: $1e-05; `input_cost_per_token_batches`: $2.5e-07 |
| Vertex AI | `vertex_ai/gemini-3.1-flash-live-preview` | - | $0.75 | $4.5 | Realtime; `input_cost_per_second`: $8.333333333e-05; `input_cost_per_audio_token`: $3e-06; `output_cost_per_audio_token`: $1.2e-05 |
| Vertex AI | `vertex_ai/gemini-3.1-flash-tts-preview` | - | $1 | $20 | Speech; `output_cost_per_audio_token`: $2e-05; `input_cost_per_token_batches`: $5e-07 |
| Vertex AI | `vertex_ai/gemini-3.5-transcribe` | - | - | $12 | Transcription; `input_cost_per_second`: $5e-05; `input_cost_per_audio_token`: $2e-06 |
| Vertex AI | `vertex_ai/gemini-3.5-transcribe-live` | - | - | $21 | Transcription; `input_cost_per_second`: $8.333333333e-05; `input_cost_per_audio_token`: $3.5e-06 |
| Vertex AI | `vertex_ai/gemini-omni-1.1-flash` | - | $1.5 | $9 | Chat |
| Vertex AI | `vertex_ai/gemini-robotics-er-2` | - | $1 | $5 | Chat; `input_cost_per_token_batches`: $5e-07; `output_cost_per_token_batches`: $2.5e-06 |
| Vertex AI | `vertex_ai/gemma-4-26b-a4b-it` | - | $0.15 | $0.6 | Chat |
| Volcengine | `volcengine/doubao-seed-2-1-pro-260628` | 256,000 | $0.8625 | $4.3125 | Chat; Reasoning; Vision; Tool calling; Prompt caching |
| Volcengine | `volcengine/doubao-seed-2-1-turbo-260628` | 256,000 | $0.43125 | $2.15625 | Chat; Reasoning; Vision; Tool calling; Prompt caching |
| Weights & Biases | `wandb/zai-org/GLM-5.3-Flash` | 1,049,000 | $0.15 | $0.5 | Chat; Reasoning; Tool calling; Tool choice; Prompt caching; Structured output |
| xAI | `xai/grok-voice-transcribe-1.0` | - | - | - | Transcription; `input_cost_per_second`: $2.778e-05; `output_cost_per_second`: $0 |
| xAI | `xai/grok-voice-transcribe-2.0` | - | - | - | Transcription; `input_cost_per_second`: $2.778e-05; `output_cost_per_second`: $0 |

#### Updated pricing (147 models)

| Provider / model | Changed token prices (USD per 1M tokens) |
| --- | --- |
| `amazon.nova-lite-v1:0` | Cache read: not set to $0.015 |
| `amazon.nova-micro-v1:0` | Cache read: not set to $0.00875 |
| `amazon.nova-pro-v1:0` | Cache read: not set to $0.2 |
| `apac.amazon.nova-lite-v1:0` | Cache read: not set to $0.01575 |
| `apac.amazon.nova-micro-v1:0` | Cache read: not set to $0.00925 |
| `apac.amazon.nova-pro-v1:0` | Cache read: not set to $0.21 |
| `azure/eu/gpt-4o-2024-11-20` | Cache read: not set to $1.375 |
| `azure/eu/gpt-5.1` | Input: $1.38 to $1.375; Cache read: $0.14 to $0.1375 |
| `azure/eu/gpt-5.1-chat` | Input: $1.38 to $1.375; Cache read: $0.14 to $0.1375 |
| `azure/eu/gpt-5.1-codex` | Input: $1.38 to $1.375; Cache read: $0.14 to $0.1375 |
| `azure/eu/gpt-5.1-codex-mini` | Cache read: $0.028 to $0.0275 |
| `azure/eu/gpt-5.4` | Cache read: $0.28 to $0.275 |
| `azure/eu/gpt-5.4-2026-03-05` | Cache read: $0.28 to $0.275 |
| `azure/eu/gpt-5.6-sol` | Input: $5.5 to $4.4; Output: $33 to $22; Cache read: $0.55 to $0.44; Cache write: $6.875 to $5.5 |
| `azure/gpt-4o-2024-11-20` | Input: $2.75 to $2.5; Output: $11 to $10 |
| `azure/gpt-4o-mini-2024-07-18` | Input: $0.165 to $0.15; Output: $0.66 to $0.6 |
| `azure/gpt-5.6-sol` | Input: $5 to $4; Output: $30 to $20; Cache read: $0.5 to $0.4; Cache write: $6.25 to $5 |
| `azure/gpt-realtime-1.5-2026-02-23` | Cache read: $4 to $0.4 |
| `azure/gpt-realtime-2025-08-28` | Cache read: $4 to $0.4 |
| `azure/o1-mini` | Input: $1.21 to $1.1; Output: $4.84 to $4.4; Cache read: $0.605 to $0.55 |
| `azure/us/gpt-4.1-nano-2025-04-14` | Cache read: $0.025 to $0.028 |
| `azure/us/gpt-4o-2024-11-20` | Cache read: not set to $1.375 |
| `azure/us/gpt-5.1` | Input: $1.38 to $1.375; Cache read: $0.14 to $0.1375 |
| `azure/us/gpt-5.1-chat` | Input: $1.38 to $1.375; Cache read: $0.14 to $0.1375 |
| `azure/us/gpt-5.1-codex` | Input: $1.38 to $1.375; Cache read: $0.14 to $0.1375 |
| `azure/us/gpt-5.1-codex-mini` | Cache read: $0.028 to $0.0275 |
| `azure/us/gpt-5.4` | Cache read: $0.28 to $0.275 |
| `azure/us/gpt-5.4-2026-03-05` | Cache read: $0.28 to $0.275 |
| `azure/us/gpt-5.6-sol` | Input: $5.5 to $4.4; Output: $33 to $22; Cache read: $0.55 to $0.44; Cache write: $6.875 to $5.5 |
| `azure/us/o4-mini-2025-04-16` | Cache read: $0.31 to $0.303 |
| `azure_ai/FW-GLM-5.2-Fast` | Input: $2.1 to $2.31; Output: $6.6 to $7.26; Cache read: $0.21 to $0.231 |
| `azure_ai/FW-Inkling` | Input: $1 to $1.1; Output: $4.05 to $4.46; Cache read: $0.17 to $0.19 |
| `azure_ai/FW-Kimi-K3` | Input: $3.3 to $3; Output: $16.5 to $15; Cache read: $0.33 to $0.3 |
| `azure_ai/FW-Nemotron-3-Ultra-NVFP4` | Input: $0.6 to $0.66; Output: $2.4 to $2.64; Cache read: $0.119 to $0.13 |
| `azure_ai/Llama-4-Maverick-17B-128E-Instruct-FP8` | Input: $1.41 to $0.25; Output: $0.35 to $1 |
| `azure_ai/Phi-4-mini-reasoning` | Input: $0.08 to $0.075; Output: $0.32 to $0.3 |
| `bedrock/us-gov-east-1/amazon.nova-pro-v1:0` | Cache read: not set to $0.24 |
| `bedrock/us-gov-west-1/amazon.nova-lite-v1:0` | Cache read: not set to $0.018 |
| `bedrock/us-gov-west-1/amazon.nova-micro-v1:0` | Cache read: not set to $0.0105 |
| `bedrock/us-gov-west-1/amazon.nova-pro-v1:0` | Cache read: not set to $0.24 |
| `bedrock_mantle/openai.gpt-5.6-sol` | Input: $5.5 to $4.4; Output: $33 to $22; Cache read: $0.55 to $0.44; Cache write: $6.875 to $5.5 |
| `chatgpt-image-latest` | Output: not set to $10 |
| `deep-research-pro-preview-12-2025` | Cache read: not set to $0.2 |
| `eu.amazon.nova-lite-v1:0` | Cache read: not set to $0.0195 |
| `eu.amazon.nova-micro-v1:0` | Cache read: not set to $0.0115 |
| `eu.amazon.nova-pro-v1:0` | Cache read: not set to $0.2625 |
| `fireworks_ai/accounts/fireworks/models/deepseek-v4-pro` | Input: $1.74 to $1.2; Output: $3.48 to $1.2; Cache read: $0.145 to $0.6 |
| `fireworks_ai/accounts/fireworks/models/qwen3-reranker-8b` | Input: $0 to $0.2 |
| `fireworks_ai/deepseek-v4-pro` | Input: $1.74 to $1.2; Output: $3.48 to $1.2; Cache read: $0.145 to $0.6 |
| `gemini-2.0-flash` | Input: $0.1 to $0.15; Output: $0.4 to $0.6 |
| `gemini-3-pro-image` | Cache read: not set to $0.2 |
| `gemini-3.1-flash-image` | Cache read: not set to $0.05 |
| `gemini-flash-latest` | Input: $0.3 to $0.75; Output: $2.5 to $3.75; Cache read: $0.03 to $0.075 |
| `gemini-flash-lite-latest` | Input: $0.1 to $0.3; Output: $0.4 to $2.5; Cache read: $0.01 to $0.03 |
| `gemini-pro-latest` | Input: $1.25 to $2; Output: $10 to $12; Cache read: $0.125 to $0.2 |
| `gemini/gemini-flash-latest` | Input: $0.3 to $0.75; Output: $2.5 to $3.75; Cache read: $0.03 to $0.075 |
| `gemini/gemini-flash-lite-latest` | Input: $0.1 to $0.3; Output: $0.4 to $2.5; Cache read: $0.01 to $0.03 |
| `gemini/gemini-pro-latest` | Input: $1.25 to $2; Output: $10 to $12; Cache read: $0.125 to $0.2 |
| `gemini/gemini-robotics-er-2-preview` | Input: $2 to $1; Output: $10 to $5; Cache read: $0.2 to $0.1 |
| `gpt-4o-mini-tts` | Input: $2.5 to $0.6 |
| `gpt-4o-mini-tts-2025-03-20` | Input: $2.5 to $0.6 |
| `gpt-4o-mini-tts-2025-12-15` | Input: $2.5 to $0.6 |
| `gpt-realtime-mini` | Cache read: not set to $0.06 |
| `inception/mercury-2.5` | Cache read: not set to $0.02 |
| `mistral/codestral-mamba-latest` | Cache read: not set to $0.025 |
| `mistral/devstral-latest` | Cache read: not set to $0.04 |
| `mistral/devstral-medium-latest` | Cache read: not set to $0.04 |
| `mistral/devstral-small-latest` | Cache read: not set to $0.01 |
| `mistral/mistral-code-agent-latest` | Cache read: not set to $0.04 |
| `mistral/mistral-medium-3` | Cache read: not set to $0.15 |
| `mistral/mistral-small` | Cache read: not set to $0.01 |
| `mistral/mistral-tiny` | Cache read: not set to $0.025 |
| `mistral/open-mistral-nemo` | Cache read: not set to $0.03 |
| `mistral/pixtral-large-latest` | Cache read: not set to $0.2 |
| `mistral/voxtral-small-2507` | Cache read: not set to $0.01 |
| `mistral/voxtral-small-latest` | Cache read: not set to $0.01 |
| `openrouter/anthropic/claude-3-haiku` | Cache read: not set to $0.03; Cache write: not set to $0.3 |
| `openrouter/bytedance/ui-tars-1.5-7b` | Cache read: not set to $0.1 |
| `openrouter/deepseek/deepseek-r1-0528` | Cache read: not set to $0.35 |
| `openrouter/deepseek/deepseek-v3.2` | Cache read: not set to $0.1345 |
| `openrouter/deepseek/deepseek-v4-flash` | Input: $0.0854 to $0.03724; Output: $0.1708 to $0.07448; Cache read: $0.01708 to $0.007448 |
| `openrouter/deepseek/deepseek-v4-flash-0731` | Input: $0.065 to $0.04; Output: $0.18 to $0.08 |
| `openrouter/deepseek/deepseek-v4-flash-vision-exp` | Input: $0.22 to $0.2156; Output: $0.66 to $0.6468; Cache read: $0.007 to $0.00686 |
| `openrouter/deepseek/deepseek-v4-pro` | Input: $0.859908 to $0.422298; Output: $1.719816 to $0.844596; Cache read: $0.071659 to $0.0351915 |
| `openrouter/deepseek/deepseek-v4-pro-0813` | Input: $0.57948 to $0.57816; Output: $1.73844 to $1.73448; Cache read: $0.019316 to $0.018396 |
| `openrouter/deepseek/deepseek-v4.1-flash` | Input: $0.15 to $0.3; Output: $0.6 to $1.2; Cache read: $0.003 to $0.006 |
| `openrouter/google/gemini-2.5-flash` | Cache write: not set to $0.0833333333 |
| `openrouter/google/gemini-2.5-flash-lite` | Cache write: not set to $0.0833333333 |
| `openrouter/google/gemini-2.5-pro` | Cache write: not set to $0.375 |
| `openrouter/google/gemini-3-flash-preview` | Cache write: not set to $0.0833333333 |
| `openrouter/google/gemini-3.1-flash-lite` | Cache write: not set to $0.0833333333 |
| `openrouter/google/gemini-3.1-flash-lite-preview` | Cache write: not set to $0.0833333333 |
| `openrouter/google/gemini-3.1-pro-preview` | Cache write: not set to $0.375 |
| `openrouter/google/gemini-3.5-flash` | Cache write: not set to $0.0833333333 |
| `openrouter/google/gemini-3.5-flash-lite` | Cache write: not set to $0.0833333333 |
| `openrouter/google/gemini-3.6-flash` | Cache write: not set to $0.0416666667 |
| `openrouter/google/gemini-3.7-flash` | Cache write: not set to $0.0416666667 |
| `openrouter/google/gemini-3.8-flash` | Cache write: not set to $0.0416666667 |
| `openrouter/google/gemma-4-26b-a4b-it` | Input: $0.042 to $0.09; Output: $0.22 to $0.3; Cache read: not set to $0.05 |
| `openrouter/gryphe/mythomax-l2-13b` | Input: $0.06 to $0.08; Output: $0.06 to $0.11 |
| `openrouter/meta-llama/llama-4-maverick` | Input: $0.2 to $0.1875; Output: $0.696 to $0.6525 |
| `openrouter/minimax/minimax-m1` | Input: $0.55 to $0.4 |
| `openrouter/mistralai/devstral-2512` | Cache read: not set to $0.04 |
| `openrouter/mistralai/ministral-14b-2512` | Cache read: not set to $0.02 |
| `openrouter/mistralai/ministral-3b-2512` | Cache read: not set to $0.01 |
| `openrouter/mistralai/ministral-8b-2512` | Cache read: not set to $0.015 |
| `openrouter/mistralai/mistral-large` | Cache read: not set to $0.2 |
| `openrouter/mistralai/mistral-large-2512` | Input: $0.5 to $0.55; Output: $1.5 to $1.65; Cache read: not set to $0.055 |
| `openrouter/mistralai/mistral-small-3.2-24b-instruct` | Input: $0.075 to $0.09375; Output: $0.2 to $0.25 |
| `openrouter/mistralai/mixtral-8x22b-instruct` | Cache read: not set to $0.2 |
| `openrouter/moonshotai/kimi-k2.7-code` | Input: $0.71 to $0.7062; Output: $3.5 to $3.21; Cache read: $0.15 to $0.18 |
| `openrouter/moonshotai/kimi-k3` | Input: $2.1 to $1.7; Output: $10.53 to $8.5; Cache read: $0.235 to $0.17 |
| `openrouter/nvidia/nemotron-3-nano-30b-a3b` | Input: $0.05 to $0.06; Output: $0.2 to $0.24 |
| `openrouter/nvidia/nemotron-3-super-120b-a12b` | Input: $0.085 to $0.08; Output: $0.4 to $0.45 |
| `openrouter/nvidia/nemotron-3-ultra-550b-a55b` | Input: $0.625 to $0.6; Output: $3.125 to $2.4; Cache read: $0.1875 to $0.12 |
| `openrouter/nvidia/nemotron-3.5-lightning` | Input: $0.08 to $0.07; Cache read: not set to $0.04 |
| `openrouter/openai/gpt-5.6-luna` | Cache write: not set to $0.25 |
| `openrouter/openai/gpt-5.6-terra` | Cache write: not set to $2.5 |
| `openrouter/openai/gpt-oss-120b` | Input: $0.037 to $0.15; Output: $0.17 to $0.6; Cache read: not set to $0.075 |
| `openrouter/openai/gpt-oss-20b` | Cache read: not set to $0.03 |
| `openrouter/qwen/qwen-plus-2025-07-28` | Cache read: not set to $0.052; Cache write: not set to $0.325 |
| `openrouter/qwen/qwen3-14b` | Input: $0.2275 to $0.12; Output: $0.91 to $0.24 |
| `openrouter/qwen/qwen3-235b-a22b-2507` | Input: $0.22 to $0.0875; Output: $0.88 to $0.35; Cache read: not set to $0.0175 |
| `openrouter/qwen/qwen3-30b-a3b-instruct-2507` | Input: $0.09 to $0.04815; Output: $0.3 to $0.19305 |
| `openrouter/qwen/qwen3-coder` | Cache read: not set to $0.1 |
| `openrouter/qwen/qwen3-coder-plus` | Cache read: not set to $0.13; Cache write: not set to $0.8125 |
| `openrouter/qwen/qwen3-vl-30b-a3b-instruct` | Input: $0.15 to $0.13; Output: $0.6 to $0.52 |
| `openrouter/qwen/qwen3.5-397b-a17b` | Cache read: not set to $0.225 |
| `openrouter/qwen/qwen3.6-plus` | Cache write: not set to $0.40625 |
| `openrouter/undi95/remm-slerp-l2-13b` | Input: $0.45 to $0.35 |
| `openrouter/z-ai/glm-4.7-flash` | Input: $0.06 to $0.0605 |
| `openrouter/z-ai/glm-5` | Cache read: not set to $0.12 |
| `openrouter/z-ai/glm-5.2` | Input: $0.6 to $0.5544; Output: $2 to $1.7424; Cache read: $0.15 to $0.10296 |
| `openrouter/z-ai/glm-5.3` | Input: $1.4 to $0.896; Output: $4.4 to $2.816; Cache read: $0.14 to $0.1664 |
| `openrouter/z-ai/glm-5.3-flash` | Input: $0.15 to $0.09; Output: $0.5 to $0.3; Cache read: $0.03 to $0.018 |
| `replicate/google/gemini-2.5-flash` | Input: $2.5 to $0.3 |
| `us.amazon.nova-lite-v1:0` | Cache read: not set to $0.015 |
| `us.amazon.nova-micro-v1:0` | Cache read: not set to $0.00875 |
| `us.amazon.nova-premier-v1:0` | Cache read: not set to $0.625 |
| `us.amazon.nova-pro-v1:0` | Cache read: not set to $0.2 |
| `vercel_ai_gateway/google/gemini-2.5-flash` | Cache read: not set to $0.03 |
| `vercel_ai_gateway/google/gemini-2.5-pro` | Input: $2.5 to $1.25; Cache read: not set to $0.125 |
| `vertex_ai/deep-research-pro-preview-12-2025` | Cache read: not set to $0.2 |
| `vertex_ai/gemini-3-pro-image` | Cache read: not set to $0.2 |
| `vertex_ai/gemini-3.1-flash-image` | Cache read: not set to $0.05 |
| `wandb/nvidia/NVIDIA-Nemotron-3-Ultra-550B-A55B` | Input: $0.75 to $0.5; Output: $2.75 to $2.15; Cache read: $0.15 to $0.1 |
| `wandb/nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B` | Input: $0.1 to $0.07; Output: $0.25 to $0.2; Cache read: $0.05 to $0.04 |

The registry also updates capability flags, context/output limits, non-token rates, and deprecation dates. Five entries were removed: `friendliai/meta-llama-3.1-70b-instruct`, `friendliai/meta-llama-3.1-8b-instruct`, `github_copilot/gemini-2.5-pro`, `github_copilot/gemini-3-pro-preview` and `gmi/google/gemini-3-pro-preview`

### Amazon Bedrock

- Send aws_session_tags on every STS call via one typed auth struct - [PR #40500](https://github.com/BerriAI/litellm/pull/40500)
- Sanitize client tool_call ids to Bedrock toolUseId constraints - [PR #40872](https://github.com/BerriAI/litellm/pull/40872)
- Carry s3_endpoint_url and s3_region_name into file content downloads - [PR #41138](https://github.com/BerriAI/litellm/pull/41138)
- Grant rerank, retrieve, agent, and agentcore actions in the web identity session policy - [PR #41168](https://github.com/BerriAI/litellm/pull/41168)
- Make prompt caching work on the Nova InvokeModel route - [PR #41343](https://github.com/BerriAI/litellm/pull/41343)
- Never emit Converse cachePoint for OpenAI-family models - [PR #41419](https://github.com/BerriAI/litellm/pull/41419)
- Forward userContext in Knowledge Base Retrieve requests - [PR #41475](https://github.com/BerriAI/litellm/pull/41475)
- Neutralize orphaned tool blocks instead of raising or injecting a dummy tool - [PR #41513](https://github.com/BerriAI/litellm/pull/41513)
- Support aws-sdk-bedrock-runtime 0.10/0.11 in Bedrock Realtime - [PR #41542](https://github.com/BerriAI/litellm/pull/41542)
- Gate Invoke tool search on the model map for Opus 4.8 and gen 5 Claude - [PR #41702](https://github.com/BerriAI/litellm/pull/41702)
- Bill Bedrock Titan embedding batch lines from inputTextTokenCount - [PR #41767](https://github.com/BerriAI/litellm/pull/41767)
- Clamp maxTokens to the 16-token minimum for OpenAI GPT and xAI Grok models on Converse - [PR #41870](https://github.com/BerriAI/litellm/pull/41870)
- Honor eager_input_streaming on Bedrock and Anthropic Claude tools - [PR #41871](https://github.com/BerriAI/litellm/pull/41871)
- Sign batch retrieve and cancel with deployment credentials when AWS_BEARER_TOKEN_BEDROCK is set - [PR #41904](https://github.com/BerriAI/litellm/pull/41904)

### Anthropic

- Add the per-turn-control beta when a message carries output_config - [PR #41189](https://github.com/BerriAI/litellm/pull/41189)
- Register thinking-binding-controls-2026-08-01 in beta headers config - [PR #41203](https://github.com/BerriAI/litellm/pull/41203)
- Tolerate message_delta events without usage when streaming - [PR #41336](https://github.com/BerriAI/litellm/pull/41336)
- Carry the served model from message_start onto stream chunks - [PR #41446](https://github.com/BerriAI/litellm/pull/41446)
- Estimate interrupted Anthropic stream usage from reasoning_content - [PR #41503](https://github.com/BerriAI/litellm/pull/41503)
- Keep cache_control for Gemini targets on /v1/messages and normalize Anthropic ttl units - [PR #41938](https://github.com/BerriAI/litellm/pull/41938)

### Azure

- Support FLUX.2 flex images - [PR #39424](https://github.com/BerriAI/litellm/pull/39424)
- Send the resolved Entra ID token on image generation requests - [PR #40147](https://github.com/BerriAI/litellm/pull/40147)
- Strip litellm format field from file and image content parts - [PR #41275](https://github.com/BerriAI/litellm/pull/41275)
- Keep api-version query after vector store search path - [PR #41384](https://github.com/BerriAI/litellm/pull/41384)
- Classify Azure Speech short audio behind a prefixed api base - [PR #41882](https://github.com/BerriAI/litellm/pull/41882)
- Drop tool_choice when the request has no tools - [PR #42031](https://github.com/BerriAI/litellm/pull/42031)

### Bedrock Mantle

- Price GovCloud regions from the regional cost row and accept region-prefixed model names - [PR #39846](https://github.com/BerriAI/litellm/pull/39846)
- Accept and forward verbosity on gpt-5.x chat completions - [PR #41509](https://github.com/BerriAI/litellm/pull/41509)

### DashScope

- Forward reasoning_effort to the provider - [PR #37506](https://github.com/BerriAI/litellm/pull/37506)

### Fireworks AI

- Resolve short model names to long cost map keys - [PR #40929](https://github.com/BerriAI/litellm/pull/40929)
- Flatten dict-form reasoning_effort to its effort string - [PR #41335](https://github.com/BerriAI/litellm/pull/41335)
- Bill cache-write, reasoning and audio tokens via the shared cost calculator - [PR #41339](https://github.com/BerriAI/litellm/pull/41339)
- Restore supports_vision on minimax-m3 in the cost map - [PR #41699](https://github.com/BerriAI/litellm/pull/41699)
- Default fireworks cached input to the documented 50% discount when the map has no cache-read rate - [PR #41917](https://github.com/BerriAI/litellm/pull/41917)

### Gemini and Vertex AI

- Bill Gemini Live sessions end to end - [PR #40915](https://github.com/BerriAI/litellm/pull/40915)
- Map minimal thinking to low for Gemini 3.7 and 3.8 Flash - [PR #41201](https://github.com/BerriAI/litellm/pull/41201)
- Bill Gemini Omni Interactions usage and Veo sampleCount on passthrough - [PR #41322](https://github.com/BerriAI/litellm/pull/41322)
- Propagate the provider's modelVersion to the response model - [PR #41338](https://github.com/BerriAI/litellm/pull/41338)
- Stream GCS batch output files from `/v1/files/{id}/content` - [PR #41506](https://github.com/BerriAI/litellm/pull/41506)
- Set vertex gemma-4-26b-a4b-it-maas context window to 262144 - [PR #41887](https://github.com/BerriAI/litellm/pull/41887)
- Preserve candidates with finishReason and no content - [PR #41892](https://github.com/BerriAI/litellm/pull/41892)

### Mistral

- Accept reasoning_effort on all models and drop client_metadata for Codex compatibility - [PR #41062](https://github.com/BerriAI/litellm/pull/41062)
- Add cache-read pricing to Mistral chat models missing it - [PR #41736](https://github.com/BerriAI/litellm/pull/41736)

### OpenAI

- Add openai_system_messages_first to put system messages first for prompt caching - [PR #41304](https://github.com/BerriAI/litellm/pull/41304)
- Resolve dated openai/azure snapshots to their undated cost map entry - [PR #41423](https://github.com/BerriAI/litellm/pull/41423)
- Drop top_p for gpt-5 reasoning models when drop_params is set - [PR #41469](https://github.com/BerriAI/litellm/pull/41469)

### xAI

- Keep 'instructions' on the xAI Responses API so system messages survive web search - [PR #38254](https://github.com/BerriAI/litellm/pull/38254)
- Honor nested web_search filters on the xAI Responses API - [PR #38268](https://github.com/BerriAI/litellm/pull/38268)
- Stop sending web_search_options to xAI's retired Live Search path - [PR #38278](https://github.com/BerriAI/litellm/pull/38278)

### Model catalog and pricing

- Auto-sync Friendli model metadata into price registry - [PR #35918](https://github.com/BerriAI/litellm/pull/35918)
- Sync Vertex AI prices: 14 models - [PR #40955](https://github.com/BerriAI/litellm/pull/40955)
- Add azure gpt-chat-latest rates and drop retired friendliai llama-3.1 entries - [PR #40976](https://github.com/BerriAI/litellm/pull/40976)
- Provider-scoped fill_missing_for_providers backfill from fallback generalization rules - [PR #41093](https://github.com/BerriAI/litellm/pull/41093)
- Rolling registry audit: Gemini latest aliases, Nova cache pricing, OpenRouter/Together sync, Mistral GLM 5.3, Azure snapshots, Grok caching - [PR #41112](https://github.com/BerriAI/litellm/pull/41112)
- Sync Azure, Azure AI, Gemini, OpenAI, Bedrock, Together AI, Fireworks and Vertex prices: 278 models, 59 new, 30 deprecated - [PR #41154](https://github.com/BerriAI/litellm/pull/41154)
- Add aihubmix provider pricing entries - [PR #41179](https://github.com/BerriAI/litellm/pull/41179)
- Add provider-neutral Gemini 2.5+ chat baseline fallback generalization - [PR #41320](https://github.com/BerriAI/litellm/pull/41320)
- Sync Google Gemini prices: 22 models - [PR #41457](https://github.com/BerriAI/litellm/pull/41457)
- Dedupe Nova cache_read_input_token_cost keys left by a text merge - [PR #41496](https://github.com/BerriAI/litellm/pull/41496)
- Sync Together AI prices: 6 models, 6 deprecated [sync failed: Google Gemini] - [PR #41570](https://github.com/BerriAI/litellm/pull/41570)
- Add stealth/union-alpha to the model cost map - [PR #41576](https://github.com/BerriAI/litellm/pull/41576)
- Rolling registry audit: Azure retirement dates, Bedrock Mantle Grok 4.3 context window - [PR #41597](https://github.com/BerriAI/litellm/pull/41597)
- Sync OpenRouter prices: 443 models, 191 new, 4 deprecated - [PR #41727](https://github.com/BerriAI/litellm/pull/41727)
- Add qwen3.8 flash rows, fix Cohere embed v3 context, Bedrock Mantle and OpenRouter pricing - [PR #41754](https://github.com/BerriAI/litellm/pull/41754)
- Sync OpenRouter prices: 2 models, 1 deprecated - [PR #41770](https://github.com/BerriAI/litellm/pull/41770)
- Sync OpenRouter prices: 15 models, 6 deprecated - [PR #41772](https://github.com/BerriAI/litellm/pull/41772)
- Sync OpenRouter prices: 172 models, 2 new - [PR #41833](https://github.com/BerriAI/litellm/pull/41833)
- Classify off_peak_pricing as a structured object in the model prices schema generator - [PR #41847](https://github.com/BerriAI/litellm/pull/41847)
- Backfill reseller Gemini entries from provider catalogs and prune retired ids - [PR #41902](https://github.com/BerriAI/litellm/pull/41902)
- Drop anthropic deprecation floors and correct azure gpt-4.1-nano retirement date - [PR #41964](https://github.com/BerriAI/litellm/pull/41964)
- Sync Azure prices: 5 models, 5 deprecated - [PR #41966](https://github.com/BerriAI/litellm/pull/41966)
- Sync OpenRouter prices: 2 models - [PR #41996](https://github.com/BerriAI/litellm/pull/41996)
- Sync OpenRouter prices: 2 models - [PR #42006](https://github.com/BerriAI/litellm/pull/42006)
- Sync OpenRouter prices: 5 models - [PR #42058](https://github.com/BerriAI/litellm/pull/42058)
- Sync OpenRouter prices: 2 models - [PR #42063](https://github.com/BerriAI/litellm/pull/42063)

### General

- Keep a handler alive while a response it issued is still reading - [PR #34829](https://github.com/BerriAI/litellm/pull/34829)
- Scan each log record once and collapse base64 payloads before the secret regex - [PR #40934](https://github.com/BerriAI/litellm/pull/40934)
- Keep body and proxy headers on BadRequestError mapped from a litellm_proxy 400 - [PR #40994](https://github.com/BerriAI/litellm/pull/40994)
- Keep litellm params out of provider request bodies - [PR #41018](https://github.com/BerriAI/litellm/pull/41018)
- Keep extra_headers out of the chat request body on the httpx handler path - [PR #41141](https://github.com/BerriAI/litellm/pull/41141)
- Reject an untranslatable tool_choice with a 400 instead of a 500 - [PR #41234](https://github.com/BerriAI/litellm/pull/41234)
- Opt-in outbound HTTP/2 for httpx clients - [PR #41268](https://github.com/BerriAI/litellm/pull/41268)
- Accept custom_provider_map providers before the first completion call - [PR #41300](https://github.com/BerriAI/litellm/pull/41300)
- Keep the resolved provider so router custom pricing resolves for azure_ai deployments - [PR #41623](https://github.com/BerriAI/litellm/pull/41623)
- Keep internal_server_error as the public type of an upstream 500 - [PR #41930](https://github.com/BerriAI/litellm/pull/41930)
- Memoize shared nodes and fail closed past the depth cap - [PR #41952](https://github.com/BerriAI/litellm/pull/41952)

## LLM API Endpoints

### Responses API

- Stop managed Responses WebSocket from leaking litellm_params into provider request body - [PR #33101](https://github.com/BerriAI/litellm/pull/33101)
- Route Responses API to native /openai/v1/responses for Foundry Models - [PR #33856](https://github.com/BerriAI/litellm/pull/33856)
- Guard empty-choices chunks in the Responses API streaming bridge - [PR #34455](https://github.com/BerriAI/litellm/pull/34455)
- Translate the reasoning object into a chat-completion reasoning effort - [PR #36363](https://github.com/BerriAI/litellm/pull/36363)
- Emit typed streaming failure events - [PR #40243](https://github.com/BerriAI/litellm/pull/40243)
- Honor nested additional_drop_params paths - [PR #40730](https://github.com/BerriAI/litellm/pull/40730)
- Hoist Codex additional_tools input items into the chat bridge tools - [PR #40989](https://github.com/BerriAI/litellm/pull/40989)
- Filter bridged kwargs like the native Responses path - [PR #41144](https://github.com/BerriAI/litellm/pull/41144)
- Recount tokens when a streamed response completes without usage - [PR #41337](https://github.com/BerriAI/litellm/pull/41337)
- Announce message item before text events in the chat completions bridge - [PR #41564](https://github.com/BerriAI/litellm/pull/41564)
- Keep the addressed response id off bridged provider requests - [PR #41689](https://github.com/BerriAI/litellm/pull/41689)
- Merge deployment litellm_params into native websocket response.create frames - [PR #41881](https://github.com/BerriAI/litellm/pull/41881)
- Restore encrypted_content and apply affinity on the native WebSocket relay - [PR #41893](https://github.com/BerriAI/litellm/pull/41893)
- Return 400 instead of 500 for /v1/responses without input - [PR #41939](https://github.com/BerriAI/litellm/pull/41939)
- Drop tool_search and local_shell in the chat completions bridge - [PR #41953](https://github.com/BerriAI/litellm/pull/41953)

### Anthropic Messages

- Log the provider usage on deferred /v1/messages calls and price cache writes without a creation rate - [PR #41172](https://github.com/BerriAI/litellm/pull/41172)
- Convert mid-conversation system turns to user turns on /v1/messages to chat completions - [PR #41493](https://github.com/BerriAI/litellm/pull/41493)
- Forward the deployment api_base to agentic follow-up calls on /v1/messages - [PR #41918](https://github.com/BerriAI/litellm/pull/41918)

### Batches and Files

- Support file delete and list for S3-backed managed files - [PR #39836](https://github.com/BerriAI/litellm/pull/39836)
- Add general_settings.allowed_file_extensions for /v1/files uploads - [PR #41106](https://github.com/BerriAI/litellm/pull/41106)
- Support Mistral files/batches and per-page OCR batch cost tracking - [PR #41934](https://github.com/BerriAI/litellm/pull/41934)
- Run hosted_vllm batches inside LiteLLM - [PR #41942](https://github.com/BerriAI/litellm/pull/41942)

### OCR

- Keep a downloaded document inlined when callbacks intercept the request - [PR #41719](https://github.com/BerriAI/litellm/pull/41719)
- Add Rust-only Textract and sign provider requests after host hooks - [PR #41977](https://github.com/BerriAI/litellm/pull/41977)
- Set DeepSeek OCR sampling defaults - [PR #41992](https://github.com/BerriAI/litellm/pull/41992)

### Realtime and Audio

- Propagate deferred Nova Sonic stream failures to the router - [PR #41064](https://github.com/BerriAI/litellm/pull/41064)
- Release max_parallel_requests slot when a realtime session ends without LLM callbacks - [PR #41113](https://github.com/BerriAI/litellm/pull/41113)
- Resolve litellm_credential_name in realtime health checks - [PR #41173](https://github.com/BerriAI/litellm/pull/41173)
- Add Azure AI Speech pass-through route - [PR #41557](https://github.com/BerriAI/litellm/pull/41557)
- Stream Chirp speech-to-text over /v1/realtime - [PR #41721](https://github.com/BerriAI/litellm/pull/41721)
- Add speech-to-text (Grok Voice Transcribe) via /v1/audio/transcriptions - [PR #41914](https://github.com/BerriAI/litellm/pull/41914)

### Vector Stores, RAG and Search

- Forward retrieval_filter from retrieval_config to vector store search - [PR #34427](https://github.com/BerriAI/litellm/pull/34427)
- Resolve model_group_alias to its target for /v1/models metadata - [PR #41483](https://github.com/BerriAI/litellm/pull/41483)
- Resolve registry stores on /v1/rag/ingest and reject providers without ingestion - [PR #41940](https://github.com/BerriAI/litellm/pull/41940)

### Image Generation and Edits

- Stop forwarding the raw `image[]` and `mask[]` form keys - [PR #39512](https://github.com/BerriAI/litellm/pull/39512)

### Agent-to-Agent

- Reach Microsoft Foundry agents with Entra auth and versioned card discovery - [PR #41511](https://github.com/BerriAI/litellm/pull/41511)

### Rerank

- Bill Vertex search_units from input records and give every rerank response a unique id - [PR #35180](https://github.com/BerriAI/litellm/pull/35180)

### Pass-through endpoints

- Serve the Claude Code gateway protocol under /claude_code_gateway - [PR #34267](https://github.com/BerriAI/litellm/pull/34267)
- Attribute Vertex passthrough successes to the resolved router deployment - [PR #41307](https://github.com/BerriAI/litellm/pull/41307)
- Add /nvidia_nim passthrough route for NIM object detection and OCR /v1/infer - [PR #41316](https://github.com/BerriAI/litellm/pull/41316)
- Keep target URL query when client sends no query params - [PR #41448](https://github.com/BerriAI/litellm/pull/41448)
- Stop forwarding LiteLLM credential headers on Bedrock agent-runtime passthrough - [PR #41504](https://github.com/BerriAI/litellm/pull/41504)
- Add Amazon Transcribe pass-through with completion-time job pricing - [PR #41515](https://github.com/BerriAI/litellm/pull/41515)
- Deepgram streaming /v1/listen WebSocket passthrough with duration-based cost tracking - [PR #41554](https://github.com/BerriAI/litellm/pull/41554)
- Add TypeSafe AI Jev evaluate passthrough with registry-priced spend tracking - [PR #41607](https://github.com/BerriAI/litellm/pull/41607)
- Forward every method on the typesafe pass-through route - [PR #41723](https://github.com/BerriAI/litellm/pull/41723)

### General

- Forward provider request id headers on mapped error responses - [PR #40925](https://github.com/BerriAI/litellm/pull/40925)
- Resolve x-litellm-call-id from response metadata when routes omit call_id - [PR #41056](https://github.com/BerriAI/litellm/pull/41056)
- Include litellm_call_id in LLM API exception logs - [PR #41205](https://github.com/BerriAI/litellm/pull/41205)
- Return 400 instead of 500 for lone surrogate escapes in request body - [PR #41297](https://github.com/BerriAI/litellm/pull/41297)
- Carry litellm_call_id through endpoint specific error logs and failure responses - [PR #41356](https://github.com/BerriAI/litellm/pull/41356)

## Management Endpoints / UI

### Admin UI

- Sum multi-round session duration in logs UI - [PR #35388](https://github.com/BerriAI/litellm/pull/35388)
- Accept ssh clone urls when registering a skill - [PR #35418](https://github.com/BerriAI/litellm/pull/35418)
- Hide admin write-form tabs on the models page from view-only admins - [PR #38867](https://github.com/BerriAI/litellm/pull/38867)
- Show per-second pricing for video models instead of $0.00 token costs - [PR #39308](https://github.com/BerriAI/litellm/pull/39308)
- Let team admins grant a team all proxy models - [PR #40196](https://github.com/BerriAI/litellm/pull/40196)
- Persist disabling cache control injection points on model update - [PR #40632](https://github.com/BerriAI/litellm/pull/40632)
- Let admins change a model's team from the model edit page - [PR #40700](https://github.com/BerriAI/litellm/pull/40700)
- Show user attribution in Top Virtual Keys usage tables - [PR #40729](https://github.com/BerriAI/litellm/pull/40729)
- Show internal user email in logs table and log detail drawer - [PR #40737](https://github.com/BerriAI/litellm/pull/40737)
- List every provider in the cache leakage by-model table - [PR #40875](https://github.com/BerriAI/litellm/pull/40875)
- Show the team alias on the model info page and in its raw JSON - [PR #40992](https://github.com/BerriAI/litellm/pull/40992)
- Move tags typed into key metadata JSON into the Tags field - [PR #41023](https://github.com/BerriAI/litellm/pull/41023)
- Block usage export and flag the range when a spend page fails - [PR #41294](https://github.com/BerriAI/litellm/pull/41294)
- Persist Models table search, filters, sort and page in the URL - [PR #41296](https://github.com/BerriAI/litellm/pull/41296)
- Add custom request headers to the API Playground - [PR #41309](https://github.com/BerriAI/litellm/pull/41309)
- Show average response time per model in usage model activity - [PR #41313](https://github.com/BerriAI/litellm/pull/41313)
- Configure capability and Fuse v2 classifiers - [PR #41315](https://github.com/BerriAI/litellm/pull/41315)
- Shared URL-state layer for tables and tabs - [PR #41331](https://github.com/BerriAI/litellm/pull/41331)
- Simplify Capability and Fuse advanced routing options - [PR #41371](https://github.com/BerriAI/litellm/pull/41371)
- Keep untimed guardrail entries on the request lifecycle - [PR #41374](https://github.com/BerriAI/litellm/pull/41374)
- Persist organizations and projects list, detail tab and key table state in the URL - [PR #41445](https://github.com/BerriAI/litellm/pull/41445)
- Link MCP Servers page to the user's connected MCP servers - [PR #41888](https://github.com/BerriAI/litellm/pull/41888)
- Show heuristic v2 score estimates in routing details - [PR #42001](https://github.com/BerriAI/litellm/pull/42001)
- Configure web search interception from the Admin UI - [PR #42007](https://github.com/BerriAI/litellm/pull/42007)
- Report whether the serving proxy has applied web search interception - [PR #42042](https://github.com/BerriAI/litellm/pull/42042)

### Keys, teams and organizations

- Let proxy admins choose which team fields team admins may edit - [PR #39996](https://github.com/BerriAI/litellm/pull/39996)
- Let team service account keys use key management endpoints for their own team - [PR #40807](https://github.com/BerriAI/litellm/pull/40807)
- Bind JWT claims to registered agents via agent_id_jwt_field - [PR #40904](https://github.com/BerriAI/litellm/pull/40904)
- Answer 409 on a credential name collision, make Terraform adoption opt-in - [PR #40917](https://github.com/BerriAI/litellm/pull/40917)
- Unified custom_key_policy hook for key generate, update and regenerate - [PR #40921](https://github.com/BerriAI/litellm/pull/40921)
- Allow virtual_key_claim_field per issuer - [PR #40927](https://github.com/BerriAI/litellm/pull/40927)
- Add POST /management/v1/users/bulk for batched user and team membership creation - [PR #41028](https://github.com/BerriAI/litellm/pull/41028)
- Add POST /management/v1/users/bulk_delete and POST `/management/v1/teams/{team_id}/members/bulk_delete` - [PR #41039](https://github.com/BerriAI/litellm/pull/41039)
- Keep org admins' own team memberships in other orgs visible on team list - [PR #41086](https://github.com/BerriAI/litellm/pull/41086)
- Show all model groups to proxy admins in /model_group/info - [PR #41094](https://github.com/BerriAI/litellm/pull/41094)
- Allow opted-in team members to manage their routers - [PR #41175](https://github.com/BerriAI/litellm/pull/41175)
- Track per-member organization spend - [PR #41255](https://github.com/BerriAI/litellm/pull/41255)
- List directly assigned team models in model access errors - [PR #41256](https://github.com/BerriAI/litellm/pull/41256)
- Enforce organization budgets when max_budget is 0 - [PR #41271](https://github.com/BerriAI/litellm/pull/41271)
- Filter /key/list by active, expired, revoked or deleted status and serve deleted keys from /key/info - [PR #41311](https://github.com/BerriAI/litellm/pull/41311)
- Team-level model_max_budget with key-level overrides - [PR #41330](https://github.com/BerriAI/litellm/pull/41330)
- Apply team_member_budget updates to members still on the team default - [PR #41347](https://github.com/BerriAI/litellm/pull/41347)
- Track team member spend when the member has no budget - [PR #41349](https://github.com/BerriAI/litellm/pull/41349)
- Track project spend and enforce project budgets additively - [PR #41354](https://github.com/BerriAI/litellm/pull/41354)
- Expose lifetime total_spend on virtual keys - [PR #41403](https://github.com/BerriAI/litellm/pull/41403)
- Let team admins edit rpm_limit and max_budget when enabled - [PR #41525](https://github.com/BerriAI/litellm/pull/41525)
- Temporary budget increase for team members - [PR #41620](https://github.com/BerriAI/litellm/pull/41620)
- Bulk update team member budgets - [PR #41632](https://github.com/BerriAI/litellm/pull/41632)
- Per-key default budget for dynamically created customers - [PR #41636](https://github.com/BerriAI/litellm/pull/41636)
- Keep a forked member budget's reset window and audit bulk member budget writes - [PR #41686](https://github.com/BerriAI/litellm/pull/41686)
- Propagate db model renames to key, team, org, project and user model allowlists - [PR #41694](https://github.com/BerriAI/litellm/pull/41694)
- Emit audit events for member_delete and role changes and carry the final roster on team create - [PR #41840](https://github.com/BerriAI/litellm/pull/41840)
- Let team admins manage projects via team_admin_editable_team_fields - [PR #41916](https://github.com/BerriAI/litellm/pull/41916)
- Parse role_permissions where it is read - [PR #41924](https://github.com/BerriAI/litellm/pull/41924)
- Register transcribe as a known provider for model grants - [PR #41926](https://github.com/BerriAI/litellm/pull/41926)
- /key/bulk_update writes only the fields each item carries - [PR #41949](https://github.com/BerriAI/litellm/pull/41949)
- Block project requests when max_budget is 0 - [PR #41997](https://github.com/BerriAI/litellm/pull/41997)

### Authentication

- Refresh lite login session token grants from the live user and team rows - [PR #40657](https://github.com/BerriAI/litellm/pull/40657)
- Gate the webhook test alert on proxy admins - [PR #40814](https://github.com/BerriAI/litellm/pull/40814)
- Limit repeated failed Admin UI sign-in attempts - [PR #40982](https://github.com/BerriAI/litellm/pull/40982)
- Hide default credentials login hint when UI_PASSWORD is set - [PR #41107](https://github.com/BerriAI/litellm/pull/41107)
- Scope JWT key mappings by issuer to prevent cross-issuer collisions - [PR #41281](https://github.com/BerriAI/litellm/pull/41281)
- Keep yaml pass-through endpoints visible to auth after db overlay - [PR #41303](https://github.com/BerriAI/litellm/pull/41303)
- Never forward the LiteLLM virtual key to Anthropic on the /anthropic passthrough - [PR #41340](https://github.com/BerriAI/litellm/pull/41340)
- Align pagination `count` validation with RFC 7644 - [PR #41444](https://github.com/BerriAI/litellm/pull/41444)
- Add RFC 8693 token exchange for IdP JWTs on the gateway token endpoint - [PR #41485](https://github.com/BerriAI/litellm/pull/41485)
- Inherit org alias, budget and rate limits for JWT and team-linked keys - [PR #41681](https://github.com/BerriAI/litellm/pull/41681)
- Evict jwt key mapping cache on user, team, org, and bulk key deletion - [PR #41707](https://github.com/BerriAI/litellm/pull/41707)
- Accept entitlements and roles entries without a value on SCIM user PUT - [PR #41830](https://github.com/BerriAI/litellm/pull/41830)

### Proxy configuration

- Honor LITELLM_DISABLE_ACCESS_LOG_PATHS to drop noisy uvicorn access log lines - [PR #41096](https://github.com/BerriAI/litellm/pull/41096)
- Skip background health check DB writes when the latest-row read fails - [PR #41145](https://github.com/BerriAI/litellm/pull/41145)
- Honor LITELLM_LOG for uvicorn and proxy extras loggers - [PR #41306](https://github.com/BerriAI/litellm/pull/41306)
- Hide model allowlist from client-facing model access denied errors - [PR #41310](https://github.com/BerriAI/litellm/pull/41310)
- Explicit priority for policy attachment execution order - [PR #41571](https://github.com/BerriAI/litellm/pull/41571)
- Persist only the keys a caller changed in save_config - [PR #41748](https://github.com/BerriAI/litellm/pull/41748)
- Make the config file win over the database, with `source` and `editable` on both read endpoints - [PR #41779](https://github.com/BerriAI/litellm/pull/41779)
- Make SettingsStore.clear() terminate when the config file owns a key - [PR #41862](https://github.com/BerriAI/litellm/pull/41862)
- Refuse config-owned keys on POST /config/update - [PR #41868](https://github.com/BerriAI/litellm/pull/41868)
- Refuse runtime writes to config-owned settings - [PR #41931](https://github.com/BerriAI/litellm/pull/41931)
- Say when a stored setting is ignored because the config file owns it - [PR #41985](https://github.com/BerriAI/litellm/pull/41985)
- Close the config-ownership gaps QA found in the settings store - [PR #42009](https://github.com/BerriAI/litellm/pull/42009)

### CLI and coding agents

- Sync Codex /model picker from proxy /v1/models in lite codex - [PR #40476](https://github.com/BerriAI/litellm/pull/40476)
- Drop enum.StrEnum so the CLI imports on Python 3.10 - [PR #41046](https://github.com/BerriAI/litellm/pull/41046)
- Show routed models and session stats for LLM API keys - [PR #41116](https://github.com/BerriAI/litellm/pull/41116)
- Label router costs and simplify the routed-model header - [PR #41186](https://github.com/BerriAI/litellm/pull/41186)
- Rename lite autoroute up/down to start/stop, keeping the old names as deprecated aliases - [PR #41672](https://github.com/BerriAI/litellm/pull/41672)
- Deprecate the litellm-proxy entrypoint in favour of lite - [PR #41673](https://github.com/BerriAI/litellm/pull/41673)
- Add a VS Code extension that registers LiteLLM as a language model provider - [PR #41865](https://github.com/BerriAI/litellm/pull/41865)

### Terraform

- Add tpm_limit, rpm_limit, budget_duration, allowed_models to litellm_team_member_add - [PR #38682](https://github.com/BerriAI/litellm/pull/38682)
- Unlink the Terraform registry docs entries that 404 on click - [PR #42003](https://github.com/BerriAI/litellm/pull/42003)

## AI Integrations

### Guardrails

- Add new upstream presidio pii entities including german set - [PR #36775](https://github.com/BerriAI/litellm/pull/36775)
- Add Microsoft Agent 365 MCP tool-call guardrail - [PR #38241](https://github.com/BerriAI/litellm/pull/38241)
- Record not_run evaluation when scoping leaves nothing to scan - [PR #39050](https://github.com/BerriAI/litellm/pull/39050)
- Log blocked streaming guardrail responses as failures, not success - [PR #40191](https://github.com/BerriAI/litellm/pull/40191)
- Protect cache_control-marked rows anywhere in history - [PR #40315](https://github.com/BerriAI/litellm/pull/40315)
- Don't add post_call output scan for MCP-only Presidio modes - [PR #40571](https://github.com/BerriAI/litellm/pull/40571)
- `logging_only` mode scans completed streams after delivery - [PR #40702](https://github.com/BerriAI/litellm/pull/40702)
- Enforce tag budgets for tags added by guardrails - [PR #40842](https://github.com/BerriAI/litellm/pull/40842)
- Write per-message guardrail rewrites back onto Responses input items - [PR #40939](https://github.com/BerriAI/litellm/pull/40939)
- Scan the Anthropic top-level system prompt and tool_use arguments - [PR #40984](https://github.com/BerriAI/litellm/pull/40984)
- Resolve caller identity from metadata buckets in custom code guardrail - [PR #41126](https://github.com/BerriAI/litellm/pull/41126)
- Support pre_call and during_call modes for llm_as_a_judge - [PR #41128](https://github.com/BerriAI/litellm/pull/41128)
- Keep polling file sanitization through non-terminal statuses - [PR #41131](https://github.com/BerriAI/litellm/pull/41131)
- Derive contextual grounding source and query from plain messages - [PR #41132](https://github.com/BerriAI/litellm/pull/41132)
- Protect the cached prefix through the last cache_control breakpoint - [PR #41161](https://github.com/BerriAI/litellm/pull/41161)
- Give post-call scans the scoped request conversation and tools - [PR #41220](https://github.com/BerriAI/litellm/pull/41220)
- Singulr v2 API contract with logging_only, pre_mcp_call and post_mcp_call - [PR #41329](https://github.com/BerriAI/litellm/pull/41329)
- Scan a bounded window per streamed chunk - [PR #41407](https://github.com/BerriAI/litellm/pull/41407)
- Release buffered stream chunks after each passing scan - [PR #41425](https://github.com/BerriAI/litellm/pull/41425)
- Run prompt injection heuristics off the event loop - [PR #41541](https://github.com/BerriAI/litellm/pull/41541)
- Stream Prompt Security post_call redactions in incremental_diff mode - [PR #41558](https://github.com/BerriAI/litellm/pull/41558)
- Name the blocking guardrail in x-litellm-applied-guardrails - [PR #41583](https://github.com/BerriAI/litellm/pull/41583)
- Preserve request-selected guardrails during tool execution - [PR #41619](https://github.com/BerriAI/litellm/pull/41619)
- Dispatch llm_api_check moderation through during_call_hook - [PR #41685](https://github.com/BerriAI/litellm/pull/41685)
- Add TypeSafe Jev relevance-based compaction guardrail - [PR #41757](https://github.com/BerriAI/litellm/pull/41757)
- Keep requested model guardrails and key disable_fallbacks on rate-limit fallback - [PR #41783](https://github.com/BerriAI/litellm/pull/41783)
- Resolve openai_moderations model at call time and default to omni-moderation-latest - [PR #41895](https://github.com/BerriAI/litellm/pull/41895)
- Deliver guardrail text rewrites on multi-choice, unfinished, and envelope-less streams - [PR #41933](https://github.com/BerriAI/litellm/pull/41933)
- Stop the Javelin api_version default leaking into Azure Content Safety - [PR #41941](https://github.com/BerriAI/litellm/pull/41941)
- Drop the scoped request conversation and tools from post-call scans - [PR #41986](https://github.com/BerriAI/litellm/pull/41986)
- Forward stream response attributes through the hook boundary and merge logged applied_guardrails - [PR #42027](https://github.com/BerriAI/litellm/pull/42027)

### Logging and observability

- Drop None metric and event attributes before OTLP export - [PR #36815](https://github.com/BerriAI/litellm/pull/36815)
- Clarify budget threshold messages - [PR #39102](https://github.com/BerriAI/litellm/pull/39102)
- Run the remaining inline token counts off the event loop - [PR #40262](https://github.com/BerriAI/litellm/pull/40262)
- Let the model emit objective + multi-query search shapes - [PR #40399](https://github.com/BerriAI/litellm/pull/40399)
- Cap per-index OpenInference message attributes span-wide - [PR #40562](https://github.com/BerriAI/litellm/pull/40562)
- Propagate W3C trace context on HTTP and WebSocket passthrough - [PR #40669](https://github.com/BerriAI/litellm/pull/40669)
- Label pre-call rate limit failures with the resolved api_provider - [PR #41059](https://github.com/BerriAI/litellm/pull/41059)
- Send llm_exceptions Slack alert for 5xx HTTPException and ProxyException - [PR #41125](https://github.com/BerriAI/litellm/pull/41125)
- Map the caller's Langfuse user, session and tags onto the root and generation spans - [PR #41140](https://github.com/BerriAI/litellm/pull/41140)
- Count 401 auth failures in litellm_proxy_failed_requests_metric - [PR #41170](https://github.com/BerriAI/litellm/pull/41170)
- Keep events appended during an in-flight flush instead of clearing them - [PR #41288](https://github.com/BerriAI/litellm/pull/41288)
- Add s3_log_prompts_only option to log prompts without responses - [PR #41327](https://github.com/BerriAI/litellm/pull/41327)
- Default litellm_trace_id to the OTel server span trace id - [PR #41386](https://github.com/BerriAI/litellm/pull/41386)
- Promote nested request metadata keys to litellm.metadata.* span attributes - [PR #41462](https://github.com/BerriAI/litellm/pull/41462)
- Add customer (end_user) budget gauges - [PR #41472](https://github.com/BerriAI/litellm/pull/41472)
- Fit per-index OpenInference messages to the span's remaining attribute budget - [PR #41498](https://github.com/BerriAI/litellm/pull/41498)
- Add all-metrics dashboard and fix stale dashboard_v2 gauges - [PR #41578](https://github.com/BerriAI/litellm/pull/41578)
- Opt-in llm_only span scope for Langfuse destinations and the operator Langfuse exporter - [PR #41740](https://github.com/BerriAI/litellm/pull/41740)
- Keep caller traceparent and tracestate on pass-through relays - [PR #41786](https://github.com/BerriAI/litellm/pull/41786)
- Anchor response duration and overhead at proxy receive time - [PR #41891](https://github.com/BerriAI/litellm/pull/41891)
- Surface a failed search as a web_search_tool_result_error block and end the turn - [PR #41905](https://github.com/BerriAI/litellm/pull/41905)
- Scope automatic breakpoints to supported Claude transports - [PR #41920](https://github.com/BerriAI/litellm/pull/41920)
- Keep request metadata out of the cost tracking failure alert - [PR #41950](https://github.com/BerriAI/litellm/pull/41950)
- Summarize embedding vectors as Langfuse observation output - [PR #41982](https://github.com/BerriAI/litellm/pull/41982)
- Map Responses API output onto the Langfuse generation output - [PR #41991](https://github.com/BerriAI/litellm/pull/41991)

### Secret Managers

- Sync AWS Secrets Manager on body-less key regenerate and key alias changes - [PR #41458](https://github.com/BerriAI/litellm/pull/41458)
- Rename AWS Secrets Manager secret when key alias changes - [PR #41468](https://github.com/BerriAI/litellm/pull/41468)
- Add separate login and secret namespaces for HashiCorp Vault - [PR #41539](https://github.com/BerriAI/litellm/pull/41539)

## Spend Tracking, Budgets and Rate Limiting

### Cost tracking

- Remove unsupported soft_budget param from user docstrings - [PR #36585](https://github.com/BerriAI/litellm/pull/36585)
- Index LiteLLM_SpendLogs by (api_key, startTime) - [PR #37983](https://github.com/BerriAI/litellm/pull/37983)
- Store litellm_call_id and match it in request_id lookups - [PR #39068](https://github.com/BerriAI/litellm/pull/39068)
- Bill cached realtime audio tokens at the audio cache-read rate - [PR #40627](https://github.com/BerriAI/litellm/pull/40627)
- Predict prompt-cache costs across deployments - [PR #40877](https://github.com/BerriAI/litellm/pull/40877)
- Report null cost for unpriced deployments instead of 0 - [PR #40878](https://github.com/BerriAI/litellm/pull/40878)
- Serialize /model/info listing once with orjson - [PR #41114](https://github.com/BerriAI/litellm/pull/41114)
- Bill gemini-embedding-2 per token and stop double charging audio - [PR #41157](https://github.com/BerriAI/litellm/pull/41157)
- Track spend for streams a deployment hook converted to non-streaming - [PR #41171](https://github.com/BerriAI/litellm/pull/41171)
- Estimate auto-router baseline costs from durable cache history - [PR #41177](https://github.com/BerriAI/litellm/pull/41177)
- Carry image and video input tokens through the Responses usage bridge - [PR #41237](https://github.com/BerriAI/litellm/pull/41237)
- Keep client User-Agent on auth failure spend logs - [PR #41291](https://github.com/BerriAI/litellm/pull/41291)
- Split aggregated usage query into key-free rollups and bounded top-N keys - [PR #41293](https://github.com/BerriAI/litellm/pull/41293)
- Price native Responses WebSocket turns at their returned service_tier - [PR #41318](https://github.com/BerriAI/litellm/pull/41318)
- Add LiteLLM_DailyGlobalSpend key-free rollup for the usage dashboard - [PR #41324](https://github.com/BerriAI/litellm/pull/41324)
- Preserve Anthropic pricing modifiers in router savings - [PR #41341](https://github.com/BerriAI/litellm/pull/41341)
- Remove duplicate user budget hook that 429'd zero-cost models - [PR #41345](https://github.com/BerriAI/litellm/pull/41345)
- Attribute router-rejected requests to the model group provider - [PR #41507](https://github.com/BerriAI/litellm/pull/41507)
- Price Azure PTU spillover requests at standard token rates - [PR #41569](https://github.com/BerriAI/litellm/pull/41569)
- Reject non-string model with 400 and log its spend as unknown-model - [PR #41633](https://github.com/BerriAI/litellm/pull/41633)
- Bill cache-read tokens at the input rate when the map has no cache-read rate - [PR #41832](https://github.com/BerriAI/litellm/pull/41832)
- Unpin cost-map pricing copied into model_info and report pricing overrides - [PR #41843](https://github.com/BerriAI/litellm/pull/41843)
- Requeue daily spend rows when the commit fails without the Redis buffer - [PR #41878](https://github.com/BerriAI/litellm/pull/41878)
- Keep the raw client model out of spend logs for rejections outside the router - [PR #41943](https://github.com/BerriAI/litellm/pull/41943)
- Bill DeepSeek V4.1 Flash and V4 Pro at off-peak rates outside peak hours - [PR #41960](https://github.com/BerriAI/litellm/pull/41960)

### Budgets

- Reconcile budget reservation before enqueuing spend to the DB - [PR #40310](https://github.com/BerriAI/litellm/pull/40310)
- Reset budgets by decrementing pre-reset spend instead of zeroing rows - [PR #41279](https://github.com/BerriAI/litellm/pull/41279)
- Key model rpm/tpm override takes precedence over team model limit - [PR #41302](https://github.com/BerriAI/litellm/pull/41302)
- Re-check budget on router fallback targets - [PR #41379](https://github.com/BerriAI/litellm/pull/41379)
- Count TPM/RPM usage before building rate-limit headers - [PR #41474](https://github.com/BerriAI/litellm/pull/41474)
- Page end-user cache invalidation after a budget reset - [PR #41488](https://github.com/BerriAI/litellm/pull/41488)
- Reject with 429 when a deployment's max_parallel_requests slots are all in use - [PR #41555](https://github.com/BerriAI/litellm/pull/41555)
- Reset sibling tpm/rpm counters when the shared rate limit window rolls over - [PR #41838](https://github.com/BerriAI/litellm/pull/41838)
- Render the 429 reset time in UTC as labelled - [PR #41911](https://github.com/BerriAI/litellm/pull/41911)
- Enforce model tpm limits against shared redis usage across replicas - [PR #41915](https://github.com/BerriAI/litellm/pull/41915)

### Rate limiting

- Add tpd_limit (tokens per day) for batch submissions - [PR #40997](https://github.com/BerriAI/litellm/pull/40997)

## MCP Gateway

### MCP Gateway

- Require admission for delegated OAuth - [PR #40923](https://github.com/BerriAI/litellm/pull/40923)
- Authorize JWT OAuth credential persistence - [PR #41314](https://github.com/BerriAI/litellm/pull/41314)
- Fail closed on missing upstream credentials - [PR #41364](https://github.com/BerriAI/litellm/pull/41364)
- Count admin static headers as api_key credential slots - [PR #41514](https://github.com/BerriAI/litellm/pull/41514)
- Restrict health discovery to virtual key grants - [PR #41609](https://github.com/BerriAI/litellm/pull/41609)
- Allowlist MCP client applications at the gateway - [PR #41667](https://github.com/BerriAI/litellm/pull/41667)
- Show live gateway sessions by AI client and user - [PR #41692](https://github.com/BerriAI/litellm/pull/41692)
- Upgrade SDK2 while preserving legacy gateway behavior - [PR #41718](https://github.com/BerriAI/litellm/pull/41718)
- Let proxy admins force-close live MCP sessions and revoke stored user credentials - [PR #41725](https://github.com/BerriAI/litellm/pull/41725)

## Performance / Loadbalancing / Reliability improvements

### Auto Router and model routing

- Preserve provider affinity - [PR #40228](https://github.com/BerriAI/litellm/pull/40228)
- Record flat retry attempts and cap retries from attempted_retries - [PR #40930](https://github.com/BerriAI/litellm/pull/40930)
- Route mid-stream error events through exception_type so content_policy_fallbacks fire - [PR #40988](https://github.com/BerriAI/litellm/pull/40988)
- Cool down team deployments on 429 when a sibling serves the same public model - [PR #40991](https://github.com/BerriAI/litellm/pull/40991)
- Name the all-deployments-in-cooldown error on 429 responses - [PR #40995](https://github.com/BerriAI/litellm/pull/40995)
- Honor team and key provider weights - [PR #41072](https://github.com/BerriAI/litellm/pull/41072)
- Keep weighted routing when a deployment id equals a model_name - [PR #41156](https://github.com/BerriAI/litellm/pull/41156)
- Preserve session model choice within each complexity tier - [PR #41174](https://github.com/BerriAI/litellm/pull/41174)
- Bind per-request routing_strategy override selectors to the request's callbacks - [PR #41178](https://github.com/BerriAI/litellm/pull/41178)
- Count num_retries_per_request across fallback hops - [PR #41191](https://github.com/BerriAI/litellm/pull/41191)
- Stop counting caller-set timeout 408s toward deployment cooldown - [PR #41230](https://github.com/BerriAI/litellm/pull/41230)
- Add capability classifier as Fuse foundation - [PR #41270](https://github.com/BerriAI/litellm/pull/41270)
- Add Fuse V2 classifier after capability forecasting - [PR #41272](https://github.com/BerriAI/litellm/pull/41272)
- Add per-model Fast mode toggle - [PR #41282](https://github.com/BerriAI/litellm/pull/41282)
- Stop registering a caller-supplied credential as a router deployment - [PR #41289](https://github.com/BerriAI/litellm/pull/41289)
- Resolve router_settings.model_group_alias before key/team model auth - [PR #41308](https://github.com/BerriAI/litellm/pull/41308)
- Limit unlicensed Capability and Fuse v2 routers to one each - [PR #41326](https://github.com/BerriAI/litellm/pull/41326)
- Validate routing_groups at save time and keep invalid DB groups from blocking SSO load - [PR #41351](https://github.com/BerriAI/litellm/pull/41351)
- Stream shadow traffic and fan out silent_model to multiple targets - [PR #41368](https://github.com/BerriAI/litellm/pull/41368)
- Discover token limits for hosted OpenAI-compatible models - [PR #41508](https://github.com/BerriAI/litellm/pull/41508)
- Add TypeSafe Jev as a complexity router classifier - [PR #41615](https://github.com/BerriAI/litellm/pull/41615)
- Add maintained Fuse model and harness presets - [PR #41617](https://github.com/BerriAI/litellm/pull/41617)
- Let a wildcard allowed_features license grant the auto_router feature - [PR #41684](https://github.com/BerriAI/litellm/pull/41684)
- Honor stream_timeout on the SDK-native passthrough route (/v1/messages, /converse) - [PR #41875](https://github.com/BerriAI/litellm/pull/41875)

### Caching, database and runtime

- Retry rate-limit fallbacks from a pristine request snapshot - [PR #40596](https://github.com/BerriAI/litellm/pull/40596)
- Log a timeout streak once per interval instead of one line per cache call - [PR #40817](https://github.com/BerriAI/litellm/pull/40817)
- Release completed max-parallel slots promptly - [PR #40843](https://github.com/BerriAI/litellm/pull/40843)
- Log one bounded summary for a burst of timed-out LoggingWorker callbacks - [PR #40912](https://github.com/BerriAI/litellm/pull/40912)
- Skip correlation contextvar stamping when request_correlation_in_logs is off - [PR #41054](https://github.com/BerriAI/litellm/pull/41054)
- Load team membership once per request and skip prisma on an L1 hit - [PR #41102](https://github.com/BerriAI/litellm/pull/41102)
- Cache custom HuggingFace tokenizers across /utils/token_counter requests - [PR #41216](https://github.com/BerriAI/litellm/pull/41216)
- Keep access-group raw SQL writes on the writer while writer_unavailable is stale - [PR #41283](https://github.com/BerriAI/litellm/pull/41283)
- Defer fastapi and tiktoken BPE imports out of import litellm - [PR #41585](https://github.com/BerriAI/litellm/pull/41585)
- Add litellm-http client pool and inject it into the OCR route - [PR #41897](https://github.com/BerriAI/litellm/pull/41897)
- Refuse native routes in processes forked after the runtime started - [PR #41987](https://github.com/BerriAI/litellm/pull/41987)

### PR roll-up by ownership area

Customer-visible PRs: **366**

- Management Endpoints / UI: 90
- Models & Providers: 86
- AI Integrations: 59
- LLM API Endpoints: 51
- Spend / Budgets / Rate Limits: 36
- Performance / Reliability: 35
- MCP: 9

## New Contributors

- [@AaronHowell](https://github.com/AaronHowell)
- [@abhirup7](https://github.com/abhirup7)
- [@adssoccer1](https://github.com/adssoccer1)
- [@clonylu](https://github.com/clonylu)
- [@elifozdamar](https://github.com/elifozdamar)
- [@etiennechabert](https://github.com/etiennechabert)
- [@gaurav-pandey-zocdoc](https://github.com/gaurav-pandey-zocdoc)
- [@HUAHAODIA](https://github.com/HUAHAODIA)
- [@IToSSc](https://github.com/IToSSc)
- [@joshgarnett](https://github.com/joshgarnett)
- [@Lee-Si-Yoon](https://github.com/Lee-Si-Yoon)
- [@max-sixty](https://github.com/max-sixty)
- [@MvdB](https://github.com/MvdB)
- [@rad-p44](https://github.com/rad-p44)
- [@runjivu](https://github.com/runjivu)
- [@zachbernstein-sdx](https://github.com/zachbernstein-sdx)
- [@zoroyihan7](https://github.com/zoroyihan7)

## Full Changelog

[Compare release contents on GitHub](https://github.com/BerriAI/litellm/compare/v1.102.0-rc.1..v1.103.0-rc.1)
