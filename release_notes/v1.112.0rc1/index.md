---
title: "LiteLLM v1.112.0rc1 adds a control plane and Perplexity Orchestrator"
description: "Adds a control plane for dataplane fleets, the Perplexity Orchestrator provider, priority queues for 429 retries and app groups with shared budgets."
slug: "v1-112-0-rc-1"
date: 2026-11-24T22:29:04
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
docker.litellm.ai/berriai/litellm:1.112.0-rc.1
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.112.0rc1
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.112.0-rc.1`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.112.0-rc.1) and the full [releases page](https://github.com/BerriAI/litellm/releases).

The published GitHub tag is `v1.112.0-rc.1`. These notes compare it with `v1.111.0-rc.3`, the previous release candidate. Changes backported onto `rc/1.111.0` and already shipped in `v1.111.0` are omitted.

Customer-facing changes come first. Test, CI and internal changes are listed at the bottom.

:::danger Breaking Changes

Changes from [`v1.111.0`](/release_notes/v1.111.0/v1-111-0), the latest stable release, that need action when upgrading.

**The FOCUS export now uses the FOCUS 1.5 schema and no longer writes the `ProviderName` and `PublisherName` columns.** Queries and dashboards that read those columns from the CSV or Parquet export must read `ServiceProviderName` instead. See [PR #52105](https://github.com/BerriAI/litellm/pull/52105).

:::

## Key Highlights

`v1.112.0rc1` is the current release candidate for 1.112.0.

- **Control plane**: a control plane, started with `--control-plane`, manages dataplanes with fleet usage, a management passthrough, OCSF audit events and S3 Object Lock, Splunk and Sentinel audit sinks
- **New providers**: Perplexity Orchestrator, Vispark, ResetData, Gradium text to speech and Gnani transcription
- **Priority queues**: opt-in queues hold async non-streaming chat requests when a deployment returns 429 or 529
- **Customer Management**: app groups with shared budgets, budget carryover with a cap, request surcharges, non-USD pricing and per-app budgets
- **Realtime**: `gpt-live-1` over WebRTC with sideband attach, billing for Realtime WebRTC calls and Gemini Live Avatar on Vertex AI
- **Rust gateway**: Claude on Vertex AI, Bedrock Mantle and Claude Platform on AWS `/v1/messages` runs on Rust, and the native gateway now runs retries, fallbacks and cooldowns
- **Lens**: `/lens/login` sign-in, agent span forwarding through `POST /v1/traces` and the Lens 0.2.0 UI
- **Simplified Chinese**: the Admin UI account menu has a Language picker with Simplified Chinese and 4,243 more translated strings, and text without a translation stays in English. Translation PRs for more languages are welcome. Add a locale file next to `en.json` in [the locales folder](https://github.com/BerriAI/litellm/tree/main/litellm/ui/litellm-dashboard/src/i18n/locales) and register it in `languages.ts`

## New Providers and Endpoints

### New Providers (5 new providers)

| Provider | Supported LiteLLM Endpoints | Description |
| --- | --- | --- |
| Perplexity Orchestrator | `/v1/chat/completions`, `/v1/responses`, `/v1/messages` | Calls Claude, GPT and other models through Perplexity's orchestrator under `perplexity_orchestrator/`, with cost tracking for 47 models |
| Vispark | `/v1/chat/completions`, `/v1/responses`, `/v1/messages` | Vision Small, Medium and Large models under `vispark/` |
| ResetData | `/v1/chat/completions`, `/v1/responses`, `/v1/messages`, `/v1/audio/transcriptions` | OpenAI-compatible chat and Whisper transcription models under `resetdata/` |
| Gradium | `/v1/audio/speech` | Text to speech under `gradium/` |
| Gnani | `/v1/audio/transcriptions` | Prisma v2.5 and v3.0 REST transcription under `gnani/` |

## New Models / Updated Models

#### New Model Support (1,157 new catalog entries)

Counts are new catalog identifiers compared with `v1.111.0`, including aliases and regional variants. Prices are the values bundled in this release, in USD, and runtime pricing-map reloads can update them. Two GovCloud rows were removed, `bedrock/us-gov-east-1/claude-sonnet-4-5-20250929-v1:0`, `bedrock/us-gov-west-1/claude-sonnet-4-5-20250929-v1:0`.

- **Amazon Bedrock**: 776 new rows. 378 are Mantle rows across regions for Gemma 3, MiniMax M2, Mistral Devstral, Magistral, Ministral and Voxtral, DeepSeek V3.2 and GPT-5.6. 349 are regional Converse rows for Nova 2 Lite, Nova Lite, Pro and Micro, GLM 4.7 and 5, Nemotron Super 3, gpt-oss and GPT-5.6 Cyber and Daybreak Blue. The other 49 include Mistral, Llama 3.2, Kimi K2.5, Nova Sonic and Mantle Claude Fable 5, Mythos 5 and Opus 4.7
- **NVIDIA NIM**: 84 models from the refreshed bundled catalog
- **fal.ai**: 67 image and video endpoints, including Seedance 2.5 Flash and PixVerse v3.5 to v5
- **Perplexity Orchestrator**: 47 models under `perplexity_orchestrator/`

<details>
<summary>All 183 other new catalog entries</summary>

| Provider | Model | Context Window | Input ($/1M tokens) | Output ($/1M tokens) | Features / special pricing |
| --- | --- | --- | --- | --- | --- |
| AssemblyAI | `assemblyai/assemblyai-stt-3-7` | - | - | - | Transcription; $0.000058 per second of input |
| AssemblyAI | `assemblyai/assemblyai-stt-3-7-realtime` | - | - | - | Transcription; $0.000083 per second of input |
| AssemblyAI | `assemblyai/assemblyai-stt-3-7-realtime-agent` | - | - | - | Transcription; $0.000125 per second of input |
| AssemblyAI | `assemblyai/universal-2` | - | - | - | Transcription; $0.000042 per second of input |
| AssemblyAI | `assemblyai/universal-3-5-pro` | - | - | - | Transcription; $0.000058 per second of input |
| AssemblyAI | `assemblyai/universal-3-6-pro` | - | - | - | Transcription; $0.000125 per second of input |
| Azure | `azure/apac/gpt-6.2-astra` | 922,000 | $9.6 | $48 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use; Web search |
| Azure | `azure/apac/gpt-6.2-sol` | 922,000 | $2.4 | $12 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use; Web search |
| Azure | `azure/eu/gpt-6.2-astra` | 922,000 | $9.6 | $48 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use; Web search |
| Azure | `azure/eu/gpt-6.2-sol` | 922,000 | $2.4 | $12 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use; Web search |
| Azure | `azure/gpt-6.2-astra` | 922,000 | $8 | $40 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use; Web search |
| Azure | `azure/gpt-6.2-sol` | 922,000 | $2 | $10 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use; Web search |
| Azure | `azure/us-gov/gpt-4-turbo` | 128,000 | $12.5 | $37.5 | Chat; Tool calling |
| Azure | `azure/us-gov/gpt-4.1` | 128,000 | $2.75 | $11 | Chat; Vision; Tool calling; Prompt caching; Structured output |
| Azure | `azure/us-gov/gpt-4.1-mini` | 128,000 | $0.55 | $2.2 | Chat; Vision; Tool calling; Prompt caching; Structured output |
| Azure | `azure/us-gov/gpt-4o` | 128,000 | $3.438 | $13.75 | Chat; Vision; Tool calling; Prompt caching; Structured output |
| Azure | `azure/us-gov/gpt-4o-2024-05-13` | 128,000 | $6.25 | $18.75 | Chat; Vision; Tool calling; Prompt caching |
| Azure | `azure/us-gov/gpt-4o-2024-11-20` | 128,000 | $3.438 | $13.75 | Chat; Vision; Tool calling; Prompt caching; Structured output |
| Azure | `azure/us-gov/gpt-4o-mini` | 128,000 | $0.207 | $0.825 | Chat; Vision; Tool calling; Prompt caching; Structured output |
| Azure | `azure/us-gov/gpt-5.6-luna` | 922,000 | $0.275 | $1.65 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input |
| Azure | `azure/us-gov/gpt-5.6-sol` | 922,000 | $5.5 | $27.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input |
| Azure | `azure/us-gov/gpt-5.6-terra` | 922,000 | $2.75 | $16.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input |
| Azure | `azure/us-gov/o3-mini-2025-01-31` | 200,000 | $1.513 | $6.05 | Chat; Reasoning; Prompt caching |
| Azure | `azure/us-gov/text-embedding-ada-002` | 8,192 | $0.125 | $0 | Embedding |
| Azure | `azure/us/gpt-6.2-astra` | 922,000 | $8.8 | $44 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use; Web search |
| Azure | `azure/us/gpt-6.2-sol` | 922,000 | $2.2 | $11 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use; Web search |
| Azure AI | `azure_ai/Microsoft-Decision-1.1` | 32,768 | $0.042 | $0 | Decisions |
| Azure AI | `azure_ai/gpt-5.6-luna` | 922,000 | $0.2 | $1.2 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Azure AI | `azure_ai/gpt-5.6-luna-2026-07-09` | 922,000 | $0.2 | $1.2 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Azure AI | `azure_ai/gpt-5.6-sol` | 922,000 | $4 | $20 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Azure AI | `azure_ai/gpt-5.6-sol-2026-07-09` | 922,000 | $4 | $20 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Azure AI | `azure_ai/gpt-5.6-terra` | 922,000 | $2 | $12 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Azure AI | `azure_ai/gpt-5.6-terra-2026-07-09` | 922,000 | $2 | $12 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Azure AI | `azure_ai/kimi-k3.1-pro` | 1,048,576 | $2.3 | $11.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching |
| Baseten | `baseten/decision-models/baseten-bison-latest` | 32,768 | $0.1 | $0 | Decisions; Vision |
| Baseten | `baseten/decision-models/baseten-groundhog-latest` | 16,384 | $0.035 | $0 | Decisions; Vision |
| ChatGPT | `chatgpt/gpt-6.2-astra` | 922,000 | - | - | Responses; Reasoning; Vision; Tool calling; Structured output {/* keep-model-ids */} |
| ChatGPT | `chatgpt/gpt-6.2-astra-law` | 922,000 | - | - | Responses; Reasoning; Vision; Tool calling; Structured output {/* keep-model-ids */} |
| ChatGPT | `chatgpt/gpt-6.2-sol` | 922,000 | - | - | Responses; Reasoning; Vision; Tool calling; Structured output {/* keep-model-ids */} |
| Cloudflare | `cloudflare/@cf/thinkingmachines/inkling-2-small` | 1,048,576 | $0.3 | $1 | Chat; Reasoning; Vision; Tool calling |
| Cohere | `c4ai-aya-vision-32b` | 16,384 | - | - | Chat; Vision |
| Cohere | `command-a-reasoning-08-2025` | 256,000 | $0 | $0 | Chat; Reasoning; Tool calling; Structured output |
| Cohere | `command-a-translate-08-2025` | 8,000 | $0 | $0 | Chat; Tool calling; Structured output |
| Cohere | `command-a-vision-07-2025` | 128,000 | $0 | $0 | Chat; Vision; Structured output |
| Cohere | `command-r7b-arabic-02-2025` | 128,000 | - | - | Chat; Tool calling; Structured output |
| Cohere | `north-mini-code-1.0` | 256,000 | $0 | $0 | Chat; Reasoning; Tool calling |
| Cohere | `north-small-translate-1.0` | 16,000 | $0 | $0 | Chat |
| Cohere | `tiny-aya-earth` | 8,192 | - | - | Chat; Tool calling |
| Cohere | `tiny-aya-fire` | 8,192 | - | - | Chat; Tool calling |
| Cohere | `tiny-aya-global` | 8,192 | - | - | Chat; Tool calling |
| Cohere | `tiny-aya-water` | 8,192 | - | - | Chat; Tool calling |
| DashScope | `dashscope/qwen4-max` | 991,808 | $1.5 | $4.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search; Video input |
| Databricks | `databricks/system.ai.gemini-4-hydrogen` | 1,048,576 | $1.87502 | $9.37503 | Chat; Reasoning; Prompt caching |
| Databricks | `databricks/system.ai.gpt-6-2-astra` | 922,000 | $8.00002 | $40.00003 | Chat; Reasoning; Vision; Tool calling; Prompt caching |
| Databricks | `databricks/system.ai.gpt-6-2-sol` | 922,000 | $1.99997 | $9.99999 | Responses; Reasoning; Vision; Tool calling; Prompt caching |
| Fireworks AI | `fireworks_ai/accounts/fireworks/routers/deepseek-v4p1-flash-1017-flex` | 1,048,576 | $0.15 | $0.6 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Fireworks AI | `fireworks_ai/accounts/fireworks/routers/deepseek-v4p1-flash-1017-us` | 1,048,576 | $0.45 | $1.8 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Fireworks AI | `fireworks_ai/accounts/fireworks/routers/kimi-k3p1-pro-us` | 1,048,576 | $2.5 | $12.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Gemini | `gemini/gemini-4-neon` | 1,048,576 | $3 | $15 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use; Web search; Audio input; Video input |
| Gemini | `gemini/genie-4` | 1,048,576 | $1.5 | $9 | Chat; Vision |
| GitHub Copilot | `github_copilot/gemini-4-neon` | 200,000 | $3 | $15 | Chat; Reasoning; Vision; Tool calling |
| GitHub Copilot | `github_copilot/gpt-6.2-astra` | 922,000 | $8 | $40 | Responses; Reasoning; Vision; Tool calling; Structured output |
| GitHub Copilot | `github_copilot/gpt-6.2-sol` | 922,000 | $2 | $10 | Responses; Reasoning; Vision; Tool calling; Structured output |
| GitHub Copilot | `github_copilot/mai-code-2` | 128,000 | $0.5 | $2.5 | Responses; Reasoning; Vision; Tool calling; Structured output |
| GitHub Copilot | `github_copilot/mai-code-2-flash` | 128,000 | $0.05 | $0.25 | Responses; Reasoning; Vision; Tool calling; Structured output |
| GMI | `gmi/google/gemini-4-hydrogen` | 1,048,576 | $1.5 | $7.5 | Chat |
| Gnani | `gnani/prisma-v2.5` | - | - | - | Transcription |
| Gnani | `gnani/prisma-v3.0` | - | - | - | Transcription |
| Gradium | `gradium/default` | - | - | - | Text to speech; $0.00007 per character |
| Gradium | `gradium/gradium-tts-202602` | - | - | - | Text to speech; $0.00007 per character |
| Gradium | `gradium/gradium-tts-beta` | - | - | - | Text to speech; $0.00007 per character |
| InferenceAPIs | `inferenceapis/MiniMaxAI/MiniMax-M3.1-Flash` | 1,048,576 | $0.2 | $0.78 | Chat; Reasoning; Tool calling; Prompt caching |
| InferenceAPIs | `inferenceapis/moonshotai/Kimi-K2.6` | 262,144 | $0.98 | $4.55 | Chat; Reasoning; Tool calling |
| InferenceAPIs | `inferenceapis/moonshotai/Kimi-K3.1-Pro` | 1,048,576 | $2.6 | $13 | Chat; Reasoning; Tool calling; Prompt caching |
| InferenceAPIs | `inferenceapis/nvidia/NVIDIA-Nemotron-3.5-Super-VL` | 262,144 | $0.2 | $0.65 | Chat; Reasoning; Vision; Tool calling; Prompt caching |
| Jina AI | `jina-embeddings-v5-omni-nano` | 8,192 | $0.02 | $0 | Embedding |
| Jina AI | `jina-embeddings-v5-omni-small` | 32,768 | $0.05 | $0 | Embedding |
| Jina AI | `jina-embeddings-v5-text-nano` | 8,192 | $0.02 | $0 | Embedding |
| Jina AI | `jina-embeddings-v5-text-small` | 32,768 | $0.05 | $0 | Embedding |
| Mistral | `mistral/voxtral-mini-transcribe-latest` | - | - | - | Transcription; Audio input; $0.000058 per second of input |
| Mistral | `mistral/voxtral-small-transcribe-latest` | - | - | - | Transcription; Audio input; $0.000067 per second of input |
| Nebius | `nebius/thinkingmachines/Inkling-2-Small` | 1,048,576 | $0.3 | $1 | Chat; Reasoning; Vision; Tool calling; Structured output |
| OpenAI | `gpt-6.2-astra` | 922,000 | $8 | $40 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use; Web search |
| OpenAI | `gpt-6.2-astra-law` | 922,000 | $8 | $40 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use; Web search |
| OpenAI | `gpt-6.2-sol` | 922,000 | $2 | $10 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use; Web search |
| OpenAI | `gpt-live-1.1` | - | - | - | Realtime; Tool calling; Audio input; $0.000833 per second of input |
| OpenAI | `omni-moderation-csam-latest` | 32,768 | $0 | $0 | Moderation |
| OpenRouter | `openrouter/anthropic/claude-fable-5.2` | 1,000,000 | $8 | $40 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| OpenRouter | `openrouter/cloudflare/clef` | 65,537 | $0.192 | $0 | Evaluation |
| OpenRouter | `openrouter/cloudflare/clef-flash` | 24,576 | $0.019 | $0 | Evaluation |
| OpenRouter | `openrouter/deepseek/deepseek-v4-flash` | 1,048,576 | $0.09 | $0.18 | Chat; Reasoning; Tool calling; Structured output |
| OpenRouter | `openrouter/deepseek/deepseek-v4-pro` | 1,048,576 | $0.9 | $1.5 | Chat; Reasoning; Tool calling; Structured output |
| OpenRouter | `openrouter/google/gemini-4-hydrogen` | 1,048,576 | $1.5 | $7.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| OpenRouter | `openrouter/inception/mercury-decide` | 65,536 | $0.02 | $0 | Evaluation |
| OpenRouter | `openrouter/inception/mercury-decide:free` | 65,536 | $0 | $0 | Evaluation |
| OpenRouter | `openrouter/jaredpalmer/kev-4b` | 8,192 | $0.042 | $0 | Evaluation |
| OpenRouter | `openrouter/liquid/d1` | 65,536 | $0.02 | $0 | Evaluation |
| OpenRouter | `openrouter/openai/gpt-6-luna-decisions` | 1,050,000 | $0.1 | $0 | Evaluation |
| OpenRouter | `openrouter/openai/gpt-6.2-astra` | 1,050,000 | $8 | $40 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| OpenRouter | `openrouter/openai/gpt-6.2-sol` | 1,050,000 | $2 | $10 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| OpenRouter | `openrouter/perplexity/pplx-decider-v1.1-27b` | 262,144 | $0.02 | $0 | Evaluation |
| OpenRouter | `openrouter/respan/span-01` | - | $0.02 | $0 | Evaluation |
| OpenRouter | `openrouter/respan/span-01-lite` | - | $0 | $0 | Evaluation |
| OpenRouter | `openrouter/respan/span-01-lite:free` | - | $0 | $0 | Evaluation |
| OpenRouter | `openrouter/togethercomputer/tev1-4b-experimental` | 32,768 | $0.042 | $0 | Evaluation |
| OpenRouter | `openrouter/upstage/solar-decide` | 524,288 | $0.05 | $0 | Evaluation |
| OpenRouter | `openrouter/upstage/solar-decide-flash` | 524,288 | $0.05 | $0 | Evaluation |
| OpenRouter | `openrouter/~typesafe/jev-latest` | 262,144 | $0.042 | $0 | Evaluation |
| Perplexity | `perplexity/openai/gpt-6.1-terra` | - | $1 | $5 | Responses |
| Perplexity | `perplexity/openai/gpt-6.2-astra` | - | $8 | $40 | Responses |
| Perplexity | `perplexity/openai/gpt-6.2-sol` | - | $2 | $10 | Responses |
| Perplexity | `perplexity/pplx-decider-flash-v1.3` | - | $0.01 | $0 | Evaluation |
| Perplexity | `perplexity/pplx-decider-v1.3` | - | $0.02 | $0 | Evaluation |
| Perplexity | `perplexity/pplx-embed-v2-context-0.6b` | - | $0.02 | - | Embedding |
| Perplexity | `perplexity/pplx-embed-v2-context-9b` | - | $0.12 | - | Embedding |
| ResetData | `resetdata/deepseek/deepseek-v4-flash` | 1,048,576 | $0.07432 | $0.1486 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| ResetData | `resetdata/google/gemma-4-26b-a4b-it` | 262,144 | $0.06054 | $0.3328 | Chat; Vision; Tool calling; Structured output |
| ResetData | `resetdata/openai/whisper-large-v3-turbo` | - | - | - | Transcription; $0.000003 per second of input |
| ResetData | `resetdata/qwen/qwen3-coder-30b-a3b-instruct` | 262,144 | $0.07061 | $0.2723 | Chat; Tool calling; Structured output |
| ResetData | `resetdata/qwen/qwen3.8-27b` | 262,144 | $0.2905 | $2.453 | Chat; Reasoning; Vision; Tool calling; Structured output |
| ResetData | `resetdata/zai/glm-5.3` | 524,288 | $1.189 | $3.736 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Runway | `runwayml/seedance2_5_flash` | - | - | - | Video generation; $0.2 per second of output |
| Sarvam | `sarvam/deepseekv4.1-flash-1017` | 1,048,576 | $0.148936 | $0.585106 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Sarvam | `sarvam/deepseekv4.1-flash-1017-interactive` | 1,048,576 | $0.265957 | $1.117021 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Sarvam | `sarvam/gemma4` | 262,144 | $0.37234 | $0.957447 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Sarvam | `sarvam/glm5.3` | 1,048,576 | $1.340426 | $4.148936 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Sarvam | `sarvam/glm5.3-flash` | 1,048,576 | $0.143617 | $0.478723 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Sarvam | `sarvam/sarvam-105b` | 128,000 | $0.106383 | $0.265957 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Sarvam | `sarvam/sarvam-105b-conversations` | 32,000 | $0.106383 | $0.265957 | Chat; Tool calling; Prompt caching; Structured output |
| Snowflake | `snowflake/claude-haiku-5-5` | - | $0.1 | $0.5 | Chat; Vision; Tool calling; Prompt caching |
| Snowflake | `snowflake/claude-opus-4-5` | - | $5 | $25 | Chat; Vision; Tool calling; Prompt caching |
| Snowflake | `snowflake/claude-opus-4-6` | - | $5 | $25 | Chat; Vision; Tool calling; Prompt caching |
| Snowflake | `snowflake/claude-opus-4-7` | - | $5 | $25 | Chat; Vision; Tool calling; Prompt caching |
| Snowflake | `snowflake/claude-opus-4-8` | - | $5 | $25 | Chat; Vision; Tool calling; Prompt caching |
| Snowflake | `snowflake/claude-opus-5` | - | $5 | $25 | Chat; Vision; Tool calling; Prompt caching |
| Snowflake | `snowflake/claude-opus-5-5` | - | $4 | $20 | Chat; Vision; Tool calling; Prompt caching |
| Snowflake | `snowflake/claude-sonnet-5` | - | $2 | $10 | Chat; Vision; Tool calling; Prompt caching |
| Snowflake | `snowflake/claude-sonnet-5-5` | - | $2 | $10 | Chat; Vision; Tool calling; Prompt caching |
| Together AI | `together_ai/ByteDance-Seed/Seedream-3.0` | - | - | - | Image generation; $0.018 per image |
| Together AI | `together_ai/ByteDance-Seed/Seedream-4.0` | - | - | - | Image generation; $0.03 per image |
| Together AI | `together_ai/ByteDance/Seedream-5.0-lite` | - | - | - | Image generation; $0.035 per image |
| Together AI | `together_ai/Qwen/Qwen-Image` | - | - | - | Image generation; $0.0058 per image |
| Together AI | `together_ai/Qwen/Qwen-Image-2.0` | - | - | - | Image generation; $0.035 per image |
| Together AI | `together_ai/Qwen/Qwen-Image-2.0-Pro` | - | - | - | Image generation; $0.075 per image |
| Together AI | `together_ai/Qwen/Qwen3-TTS-12Hz-1.7B` | - | - | - | Text to speech; $0.00002 per character |
| Together AI | `together_ai/Qwen/Qwen4-Max` | 1,000,000 | $1.05 | $3.15 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Together AI | `together_ai/RunDiffusion/Juggernaut-pro-flux` | - | - | - | Image generation; $0.0049 per image |
| Together AI | `together_ai/Rundiffusion/Juggernaut-Lightning-Flux` | - | - | - | Image generation; $0.0017 per image |
| Together AI | `together_ai/Wan-AI/Wan2.6-image` | - | - | - | Image generation; $0.03 per image |
| Together AI | `together_ai/black-forest-labs/FLUX.1-kontext-max` | - | - | - | Image generation |
| Together AI | `together_ai/black-forest-labs/FLUX.1-kontext-pro` | - | - | - | Image generation |
| Together AI | `together_ai/black-forest-labs/FLUX.1.1-pro` | - | - | - | Image generation |
| Together AI | `together_ai/black-forest-labs/FLUX.2-dev` | - | - | - | Image generation; $0.0154 per image |
| Together AI | `together_ai/black-forest-labs/FLUX.2-flex` | - | - | - | Image generation; $0.03 per image |
| Together AI | `together_ai/black-forest-labs/FLUX.2-max` | - | - | - | Image generation |
| Together AI | `together_ai/black-forest-labs/FLUX.2-pro` | - | - | - | Image generation; $0.03 per image |
| Together AI | `together_ai/canopylabs/orpheus-3b-0.1-ft` | - | - | - | Text to speech; $0.000015 per character |
| Together AI | `together_ai/cartesia/sonic` | - | - | - | Text to speech; $0.000065 per character |
| Together AI | `together_ai/cartesia/sonic-3` | - | - | - | Text to speech; $0.000065 per character |
| Together AI | `together_ai/google/flash-image-2.5` | - | - | - | Image generation; $0.039 per image |
| Together AI | `together_ai/google/flash-image-3.1` | - | - | - | Image generation; $0.04657 per image |
| Together AI | `together_ai/google/flash-image-3.1-lite` | - | - | - | Image generation; $0.069 per image |
| Together AI | `together_ai/google/gemini-3-pro-image` | - | - | - | Image generation; $0.134 per image |
| Together AI | `together_ai/hexgrad/Kokoro-82M` | - | - | - | Text to speech; $0.000004 per character |
| Together AI | `together_ai/ideogram/ideogram-3.0` | - | - | - | Image generation; $0.06 per image |
| Together AI | `together_ai/ideogram/ideogram-4.0` | - | - | - | Image generation; $0.06 per image |
| Together AI | `together_ai/nvidia/nemotron-3-asr-streaming-0.6b` | - | - | - | Transcription; $0.000025 per second of input |
| Together AI | `together_ai/nvidia/nemotron-3.5-asr-streaming-0.6b` | - | - | - | Transcription; $0.000025 per second of input |
| Together AI | `together_ai/nvidia/parakeet-tdt-0.6b-v3` | - | - | - | Transcription; $0.000025 per second of input |
| Together AI | `together_ai/openai/gpt-image-1.5` | - | - | - | Image generation; $0.034 per image |
| Together AI | `together_ai/openai/gpt-image-2` | - | - | - | Image generation; $0.053 per image |
| Together AI | `together_ai/openai/whisper-large-v3` | - | - | - | Transcription; $0.000025 per second of input |
| Together AI | `together_ai/prunaai/p-image-ideogram` | - | - | - | Image generation; $0.00225 per image |
| Together AI | `together_ai/stabilityai/stable-diffusion-xl-base-1.0` | - | - | - | Image generation; $0.0019 per image |
| Together AI | `together_ai/tencent/Hy4` | 1,048,576 | $0.834 | $2.501 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Together AI | `together_ai/thinkingmachines/inkling` | 524,288 | $1 | $4.05 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Audio input |
| Vertex AI | `vertex_ai/gemini-4-neon` | 1,048,576 | $3 | $15 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use; Web search; Audio input; Video input |
| Vertex AI | `vertex_ai/meta/muse-ember-1.0` | 1,048,576 | $0.1 | $0.5 | Responses; Reasoning; Vision; Tool calling; Structured output; PDF input |
| Vertex AI | `vertex_ai/meta/muse-spark-1.3` | 1,048,576 | $1.25 | $4.25 | Responses; Reasoning; Vision; Tool calling; Structured output; PDF input |
| Vertex AI | `vertex_ai/meta/muse-wonder-1.0` | 1,048,576 | $4 | $20 | Responses; Reasoning; Vision; Tool calling; Structured output; PDF input |
| Vispark | `vispark/vision-large` | 1,000,000 | $7.37 | $22.11 | Chat; Reasoning; Vision; Tool calling; Structured output; PDF input |
| Vispark | `vispark/vision-medium` | 1,000,000 | $4.21 | $12.63 | Chat; Reasoning; Vision; Tool calling; Structured output; PDF input |
| Vispark | `vispark/vision-small` | 1,000,000 | $1.05 | $3.16 | Chat; Reasoning; Vision; Tool calling; Structured output; PDF input |

</details>

### Amazon Bedrock

- Add Bedrock GPT-6.2 Astra and Sol pricing and fix `bedrock_mantle/openai.gpt-6.2-*` failing through the proxy - [PR #52332](https://github.com/BerriAI/litellm/pull/52332), [PR #52359](https://github.com/BerriAI/litellm/pull/52359)
- Add missing Bedrock regional, Mantle and Azure Government pricing rows - [PR #52458](https://github.com/BerriAI/litellm/pull/52458)
- Add deprecation dates for GovCloud Mantle Nemotron Nano 12B v2 and 9B v2 - [PR #52552](https://github.com/BerriAI/litellm/pull/52552)
- Add STS session tags and session names derived from the caller identity, so CloudTrail can name the caller - [PR #52978](https://github.com/BerriAI/litellm/pull/52978)
- Fix native chat and `/v1/responses` calls ignoring `aws_bedrock_runtime_endpoint` - [PR #50582](https://github.com/BerriAI/litellm/pull/50582)
- Fix a prefill 400 on Claude 5.x when the last user message is empty on Converse and `/v1/responses` - [PR #50701](https://github.com/BerriAI/litellm/pull/50701)
- Fix `extra_body` values being ignored for Bedrock embedding defaults and nested objects - [PR #51710](https://github.com/BerriAI/litellm/pull/51710)
- Fix `guarded_text` parts in system and assistant messages being dropped on Bedrock Converse - [PR #51776](https://github.com/BerriAI/litellm/pull/51776)
- Fix no spend being recorded for Daybreak Blue and Red on `us.` and `global.` Bedrock profiles - [PR #52122](https://github.com/BerriAI/litellm/pull/52122)
- Fix `bedrock/<region>/<model>` ignoring the region on `/v1/messages` - [PR #52136](https://github.com/BerriAI/litellm/pull/52136)
- Fix Bedrock passthrough logs showing a placeholder prompt, empty settings and a null stream flag - [PR #52146](https://github.com/BerriAI/litellm/pull/52146)
- Fix Bedrock `ca.` inference profiles dropping `reasoning_effort` and logging no cost - [PR #52152](https://github.com/BerriAI/litellm/pull/52152)
- Fix Bedrock Claude prompt caching turning off when `supports_prompt_cache_breakpoint` is false, broken since v1.106.0 - [PR #52180](https://github.com/BerriAI/litellm/pull/52180)
- Fix GPT structured output on Bedrock Converse not sending `text.format.strict` - [PR #52419](https://github.com/BerriAI/litellm/pull/52419)
- Fix Bedrock GPT-6.2 Astra and Sol prices, including Mantle Ultrafast pricing - [PR #52464](https://github.com/BerriAI/litellm/pull/52464)
- Fix ConverseStream billing at the default tier instead of the served service tier - [PR #52565](https://github.com/BerriAI/litellm/pull/52565)
- Fix GovCloud Mantle Claude token counting going to the commercial `us-east-1` endpoint - [PR #52708](https://github.com/BerriAI/litellm/pull/52708)
- Fix the BM25 tool search tool being dropped on Claude chat requests, so Claude can find hidden tools - [PR #52959](https://github.com/BerriAI/litellm/pull/52959)
- Fix Nova embedding prompt tokens and spend to follow the token count Bedrock meters - [PR #53142](https://github.com/BerriAI/litellm/pull/53142)
- Fix Nova embedding cost ignoring text beside an image and billing audio and video as a flat 768 tokens - [PR #53296](https://github.com/BerriAI/litellm/pull/53296), [PR #53307](https://github.com/BerriAI/litellm/pull/53307)
- Fix native Bedrock chat dropping caller-supplied cache checkpoints under `drop_params` - [PR #53370](https://github.com/BerriAI/litellm/pull/53370)
- Fix a Bedrock `model_id` profile model failing when listed beside a model named by its ARN - [PR #53461](https://github.com/BerriAI/litellm/pull/53461)
- Fix SageMaker and Bedrock agent streams returning an empty 200 when AWS sends no events or cuts the last one - [PR #53482](https://github.com/BerriAI/litellm/pull/53482)
- Fix 400 on `tool_choice` with Bedrock Mistral Large 3 and Ministral 3 on Converse - [PR #53589](https://github.com/BerriAI/litellm/pull/53589)
- Fix Bedrock token counting with no AWS credentials returning 500 instead of 401 - [PR #53593](https://github.com/BerriAI/litellm/pull/53593)
- Fix Bedrock count-tokens pass-through 400s and 429s being logged at ERROR instead of as warnings - [PR #53595](https://github.com/BerriAI/litellm/pull/53595)
- Change Claude on Bedrock Mantle `/v1/messages` to be served by the Rust gateway - [PR #52328](https://github.com/BerriAI/litellm/pull/52328)
- Change `bedrock/mantle/` GovCloud calls to bill at GovCloud rates, which raises recorded spend by about 20% - [PR #52864](https://github.com/BerriAI/litellm/pull/52864)
- Change GovCloud Claude models to use Bedrock native structured output for `response_format` JSON schemas - [PR #53175](https://github.com/BerriAI/litellm/pull/53175)

### Anthropic

- Add forwarding of `diagnostics` on `/v1/messages` to Anthropic - [PR #52969](https://github.com/BerriAI/litellm/pull/52969)
- Fix 400 `extra_body: Extra inputs are not permitted` by sending `extra_body` fields at the top level - [PR #48373](https://github.com/BerriAI/litellm/pull/48373)
- Fix adaptive thinking being dropped on tool-call follow-up turns when `modify_params` is on - [PR #52615](https://github.com/BerriAI/litellm/pull/52615)
- Fix thread refusals losing their error codes and triggering deployment cooldown - [PR #53292](https://github.com/BerriAI/litellm/pull/53292)
- Fix Anthropic streams failing when a `data:` line is not a JSON object on chat, responses and `/v1/messages` - [PR #53393](https://github.com/BerriAI/litellm/pull/53393)
- Fix `/v1/messages` failing on `temperature`, `top_p` and `top_k` under `anthropic-version: 2026-10-21` - [PR #53407](https://github.com/BerriAI/litellm/pull/53407)
- Fix streaming `/v1/messages` sending only pings until the turn ended when the proxy added its retrieve tool - [PR #53658](https://github.com/BerriAI/litellm/pull/53658)
- Change Claude subscription OAuth usage covered by the seat allowance to log $0 and overage at API rates - [PR #52901](https://github.com/BerriAI/litellm/pull/52901)

### Azure

- Add `azure/us-gov/` pricing for gpt-5.6, gpt-4.1, gpt-4o and ada-002 - [PR #52135](https://github.com/BerriAI/litellm/pull/52135)
- Add pricing for Azure `gpt-6.2-astra`, `gpt-6.2-sol` and `azure_ai/Microsoft-Decision-1.1` - [PR #52293](https://github.com/BerriAI/litellm/pull/52293)
- Add `azure/gpt-live-1` sessions on `/v1/live/sessions` - [PR #53238](https://github.com/BerriAI/litellm/pull/53238)
- Fix pass-through `DELETE /azure/openai/v1/responses/{id}` returning 400 when sent without a body - [PR #50833](https://github.com/BerriAI/litellm/pull/50833)
- Fix Azure Responses models losing `phase` on replay and streamed text deltas missing it - [PR #51059](https://github.com/BerriAI/litellm/pull/51059)
- Fix Azure Document Intelligence OCR ignoring query options such as `outputContentFormat` and `pages` in `extra_body` - [PR #51102](https://github.com/BerriAI/litellm/pull/51102)
- Fix chat 400 and 401 on Foundry project URLs and 404 on `/openai/v1` bases - [PR #51144](https://github.com/BerriAI/litellm/pull/51144)
- Fix `reasoning_effort` being rejected on Azure AI DeepSeek V4 Flash and Pro models - [PR #51775](https://github.com/BerriAI/litellm/pull/51775)
- Fix unclosed sessions when cached Azure and base64 embedding clients are evicted - [PR #52266](https://github.com/BerriAI/litellm/pull/52266)
- Fix 500 on Compact for Foundry model routers by calling Responses natively - [PR #52474](https://github.com/BerriAI/litellm/pull/52474)
- Fix Azure AI Foundry GPT-5 Chat receiving `max_tokens` instead of `max_completion_tokens` - [PR #52680](https://github.com/BerriAI/litellm/pull/52680)
- Fix 404 on `azure_ai/` chat and embeddings for Azure OpenAI resource URLs by using the v1 path - [PR #52759](https://github.com/BerriAI/litellm/pull/52759)
- Fix Azure bridged streams returning chunks with a null `model` - [PR #53126](https://github.com/BerriAI/litellm/pull/53126)
- Fix chat calls on a mixed Azure group landing on batch-only deployments and getting a 400 - [PR #53454](https://github.com/BerriAI/litellm/pull/53454)
- Change `azure/gpt-image-1.5` retirement date to 2027-06-16 and set a successor for `azure_ai/Codestral-2501` - [PR #52699](https://github.com/BerriAI/litellm/pull/52699)

### Gemini and Vertex AI

- Add Meta Muse models on Vertex AI with native Responses routing - [PR #50768](https://github.com/BerriAI/litellm/pull/50768)
- Add `gemini/gemini-4-neon` and `vertex_ai/gemini-4-neon` pricing - [PR #52640](https://github.com/BerriAI/litellm/pull/52640), [PR #52648](https://github.com/BerriAI/litellm/pull/52648)
- Add explicit text inputs for Gemini embeddings and make local media errors return 400 instead of retried 500s - [PR #53135](https://github.com/BerriAI/litellm/pull/53135)
- Fix Vertex Gemini answering 400 to every `service_tier` value - [PR #34959](https://github.com/BerriAI/litellm/pull/34959)
- Fix Gemini Embedding 2 batch billing so media inputs such as video are no longer costed at $0 - [PR #49682](https://github.com/BerriAI/litellm/pull/49682)
- Fix Gemini requests failing when a past tool call has null or truncated arguments - [PR #50020](https://github.com/BerriAI/litellm/pull/50020)
- Fix Gemini image responses returning the thought draft image in `message.images` and `/v1/responses` - [PR #50709](https://github.com/BerriAI/litellm/pull/50709)
- Fix snake_case `generation_config` keys being dropped on `generateContent` - [PR #51139](https://github.com/BerriAI/litellm/pull/51139)
- Fix one `json_schema` row failing every other row in a Vertex AI batch file, broken since v1.81.3 - [PR #51790](https://github.com/BerriAI/litellm/pull/51790)
- Fix 400 on `reasoning_effort: "xhigh"` for `gemini-4-hydrogen` - [PR #52060](https://github.com/BerriAI/litellm/pull/52060)
- Fix `gemini/` image edits with no image returning 500, now a 400 - [PR #52087](https://github.com/BerriAI/litellm/pull/52087)
- Fix Gemini image generations and edits failing when `n` is above 1, and Vertex AI edits rejecting `n` - [PR #52103](https://github.com/BerriAI/litellm/pull/52103)
- Fix Gemini 400 errors when a client scrubs the thought signature from a tool call id - [PR #52207](https://github.com/BerriAI/litellm/pull/52207)
- Fix non-streamed Gemini `content_filter` choices dropping Google's block reason - [PR #52208](https://github.com/BerriAI/litellm/pull/52208)
- Fix Gemini thought signatures being stripped for proxy model names without `gemini` in them - [PR #52212](https://github.com/BerriAI/litellm/pull/52212)
- Fix streamed Gemini answers dropping Google's finish reason, now in `provider_specific_fields` on the last chunk - [PR #52242](https://github.com/BerriAI/litellm/pull/52242)
- Fix 400 on Gemini image models for unsupported thinking levels and logprobs when `drop_params` is on - [PR #52514](https://github.com/BerriAI/litellm/pull/52514)
- Fix cached input tokens billed at the full rate on Gemini and Vertex image generation - [PR #52572](https://github.com/BerriAI/litellm/pull/52572)
- Fix `drop_params` not dropping `logprobs` on Gemini models that refuse it - [PR #52700](https://github.com/BerriAI/litellm/pull/52700)
- Fix thinking tokens missing from `completion_tokens` and cost on non-streamed Gemini content filter replies - [PR #52930](https://github.com/BerriAI/litellm/pull/52930)
- Fix 500 on Gemini tool calls split across assistant turns on `/v1/responses` - [PR #52960](https://github.com/BerriAI/litellm/pull/52960)
- Fix percent encoded Gemini file ids resolving differently in the access check and the Gemini request - [PR #53004](https://github.com/BerriAI/litellm/pull/53004)
- Fix Gemini streams cut before a finish reason ending as a normal `stop` instead of an error - [PR #53187](https://github.com/BerriAI/litellm/pull/53187)
- Fix blank Gemini replies on malformed finish reasons, now failing so retries and fallbacks run - [PR #53231](https://github.com/BerriAI/litellm/pull/53231)
- Fix Gemini 2.x dropping distinct parallel tool calls that have identical arguments - [PR #53233](https://github.com/BerriAI/litellm/pull/53233)
- Fix zero-budget keys getting 200s on Google `generateContent` routes that leave the model out of the URL - [PR #53404](https://github.com/BerriAI/litellm/pull/53404)
- Fix Gemini and Vertex AI silently dropping `video_url` content parts - [PR #53406](https://github.com/BerriAI/litellm/pull/53406)
- Fix 422 on overlapping Gemini native `generateContent` calls for small-budget keys - [PR #53412](https://github.com/BerriAI/litellm/pull/53412)
- Fix Gemini tool and response schemas dropping `const` values - [PR #53413](https://github.com/BerriAI/litellm/pull/53413)
- Fix Gemini 3+ dropping web search beside function tools and not reporting `web_search_call` items - [PR #53423](https://github.com/BerriAI/litellm/pull/53423)
- Fix Vertex image edits redrawing a new picture each turn and failing with 400 on the third turn - [PR #53435](https://github.com/BerriAI/litellm/pull/53435)
- Fix unclear error for `n` above 1 with image `modalities` on Vertex, which now answers a clear 400 - [PR #53598](https://github.com/BerriAI/litellm/pull/53598)
- Fix Gemini prompt caching never hitting when system messages appear mid-conversation - [PR #53623](https://github.com/BerriAI/litellm/pull/53623)

### OpenAI

- Add `omni-moderation-csam-latest` to the cost map for `/v1/moderations` - [PR #52047](https://github.com/BerriAI/litellm/pull/52047)
- Add pricing for OpenAI `gpt-6.2-astra`, `gpt-6.2-sol` and `gpt-6.2-astra-law` - [PR #52316](https://github.com/BerriAI/litellm/pull/52316)
- Fix `prompt_cache_key`, `prompt_cache_options` and `12h` cache ttl being rejected or not forwarded to OpenAI - [PR #51457](https://github.com/BerriAI/litellm/pull/51457)
- Fix `gpt-4o-mini-tts` spend missing the audio output tokens OpenAI bills - [PR #52317](https://github.com/BerriAI/litellm/pull/52317)
- Fix SVG authoring tokens in `svg_usage` not being billed on image responses - [PR #52571](https://github.com/BerriAI/litellm/pull/52571)
- Fix `max_input_tokens` on `chatgpt/gpt-5.6-sol`, `-terra` and `-luna` to 922000 - [PR #52614](https://github.com/BerriAI/litellm/pull/52614) {/* keep-model-ids */}
- Fix 400 on very long system prompts to OpenAI models when `truncation` is `auto` - [PR #52964](https://github.com/BerriAI/litellm/pull/52964)
- Fix chat and embeddings requests failing when the `Authorization` header is omitted, broken since v1.108.1 - [PR #53132](https://github.com/BerriAI/litellm/pull/53132)
- Fix OpenAI-compatible backend errors dropping `error.param` and returning the whole body as `error.message` - [PR #53217](https://github.com/BerriAI/litellm/pull/53217)
- Fix O-series Responses requests sending unsupported `temperature` despite `drop_params` - [PR #53234](https://github.com/BerriAI/litellm/pull/53234)
- Fix vLLM errors relaying `error.type` as `BadRequestError` instead of the provider's error type - [PR #54031](https://github.com/BerriAI/litellm/pull/54031)

### Other providers

- Add Moonshot Kimi K3 and Together AI Inkling model support - [PR #33922](https://github.com/BerriAI/litellm/pull/33922)
- Add the Vispark provider with Vision Small, Medium and Large models - [PR #41192](https://github.com/BerriAI/litellm/pull/41192)
- Add Sarvam Token Factory models, pricing and `reasoning_effort` support for `sarvam/*` - [PR #49792](https://github.com/BerriAI/litellm/pull/49792)
- Add NVIDIA NIM model discovery in Add Model through the selected connection, with a refreshed bundled catalog - [PR #50439](https://github.com/BerriAI/litellm/pull/50439)
- Add ResetData provider and stop sending `OPENAI_API_KEY` to keyless JSON-configured providers - [PR #50819](https://github.com/BerriAI/litellm/pull/50819)
- Add a LiteLLM `User-Agent` on Sarvam chat requests - [PR #52012](https://github.com/BerriAI/litellm/pull/52012)
- Add DashScope `qwen4-max` and the `max` reasoning effort for ChatGPT GPT-5.6 - [PR #52097](https://github.com/BerriAI/litellm/pull/52097)
- Add deprecation source and successor models to GitHub Copilot models retired on 2026-11-16 - [PR #52160](https://github.com/BerriAI/litellm/pull/52160)
- Add cost tracking for `github_copilot/` MAI Code 2, MAI Code 2 Flash, GPT-6.2 Astra and GPT-6.2 Sol - [PR #52338](https://github.com/BerriAI/litellm/pull/52338), [PR #52395](https://github.com/BerriAI/litellm/pull/52395)
- Add automatic `copilot-integration-id` header for GitHub Copilot with a custom `GITHUB_COPILOT_CLIENT_ID` - [PR #52386](https://github.com/BerriAI/litellm/pull/52386)
- Add `together_ai/Qwen/Qwen4-Max` pricing so spend is tracked - [PR #52487](https://github.com/BerriAI/litellm/pull/52487)
- Add Gnani Prisma v2.5 and v3.0 REST transcription support - [PR #52520](https://github.com/BerriAI/litellm/pull/52520)
- Add Databricks GPT-6.2 Astra and Sol Unity Gateway models to the cost map - [PR #52635](https://github.com/BerriAI/litellm/pull/52635)
- Add zero pricing for Cohere free-tier Command A Reasoning, Translate and Vision - [PR #52687](https://github.com/BerriAI/litellm/pull/52687)
- Add `github_copilot/gemini-4-neon` to the model cost map - [PR #52704](https://github.com/BerriAI/litellm/pull/52704)
- Add `fal_ai` Iris-Z depth estimation pricing so calls are no longer tracked at $0 - [PR #52715](https://github.com/BerriAI/litellm/pull/52715)
- Add Baseten `baseten-bison-latest` and `baseten-groundhog-latest` decision models - [PR #53165](https://github.com/BerriAI/litellm/pull/53165)
- Add Runway `seedance2_5_flash` model pricing - [PR #53166](https://github.com/BerriAI/litellm/pull/53166)
- Add the 2026-11-19 end-of-life date for xAI `grok-build-0.1` - [PR #53167](https://github.com/BerriAI/litellm/pull/53167)
- Add retirement dates for Databricks `gpt-5` and `gpt-5-mini` - [PR #53168](https://github.com/BerriAI/litellm/pull/53168)
- Add Fireworks `kimi-k3p1-pro-us` at the published US-only rate - [PR #53377](https://github.com/BerriAI/litellm/pull/53377)
- Add the Perplexity Orchestrator provider with `perplexity_orchestrator/` models and cost tracking - [PR #53583](https://github.com/BerriAI/litellm/pull/53583)
- Fix `sap/` chat and embedding calls fetching a new OAuth token on every call - [PR #49260](https://github.com/BerriAI/litellm/pull/49260)
- Fix Cohere v2 chat ignoring `tool_choice` and returning 400 for `reasoning_effort` and `json_schema` - [PR #50834](https://github.com/BerriAI/litellm/pull/50834)
- Fix GitHub Copilot models returning 400 with a key ref and an empty or whitespace stored key - [PR #52032](https://github.com/BerriAI/litellm/pull/52032)
- Fix $0 spend and refused `/fal_ai` requests for 8s PixVerse effects, transition and extend clips - [PR #52107](https://github.com/BerriAI/litellm/pull/52107)
- Fix `reasoning_effort` being dropped on OpenCode Go chat requests - [PR #52156](https://github.com/BerriAI/litellm/pull/52156)
- Fix a stale input token limit for Baseten Kimi K3.1 Pro - [PR #52158](https://github.com/BerriAI/litellm/pull/52158)
- Fix `/v1/messages` mid-conversation system reminders becoming user turns on Databricks Claude Opus 5.5 - [PR #52214](https://github.com/BerriAI/litellm/pull/52214)
- Fix Together AI Kimi-K3.1-Pro sending `reasoning_effort: max` upstream as `high` - [PR #52294](https://github.com/BerriAI/litellm/pull/52294)
- Fix DashScope 1h cache writes billed at the 5m rate - [PR #52331](https://github.com/BerriAI/litellm/pull/52331)
- Fix wrong cache read and write costs for `dashscope/qwen4-max` - [PR #52334](https://github.com/BerriAI/litellm/pull/52334)
- Fix GitHub Copilot failures all showing the same "Connect GitHub Copilot" message instead of the real cause - [PR #52352](https://github.com/BerriAI/litellm/pull/52352)
- Fix Groq replies without `service_tier` failing on chat, `/v1/messages` and the Responses bridge - [PR #52431](https://github.com/BerriAI/litellm/pull/52431)
- Fix Ollama embeddings failing with 400 when the response has no `prompt_eval_count` - [PR #52432](https://github.com/BerriAI/litellm/pull/52432)
- Fix Tavily searches with automatically chosen advanced depth being priced as basic - [PR #52564](https://github.com/BerriAI/litellm/pull/52564)
- Fix Groq Whisper transcriptions returning no cost - [PR #52570](https://github.com/BerriAI/litellm/pull/52570)
- Fix `voyage/` embeddings ignoring `VOYAGE_API_BASE` - [PR #52645](https://github.com/BerriAI/litellm/pull/52645)
- Fix Codex CLI on `gpt-5.6-*` always getting 400 through the `chatgpt` provider - [PR #52731](https://github.com/BerriAI/litellm/pull/52731)
- Fix SAP Gemini 3.x replies being rejected when `reasoning_content` is a list - [PR #52741](https://github.com/BerriAI/litellm/pull/52741)
- Fix Perplexity image embeddings being billed at the text token rate - [PR #53125](https://github.com/BerriAI/litellm/pull/53125)
- Fix Mistral on Vertex AI and Bedrock answering 400 to tool call ids - [PR #53416](https://github.com/BerriAI/litellm/pull/53416)
- Fix OCI streaming failing with 500 `cannot use a decompressobj multiple times` - [PR #53439](https://github.com/BerriAI/litellm/pull/53439)
- Fix `stream_timeout` ignored on async streams for OpenAI-compatible providers, and timeouts returning 500 not 408 - [PR #53442](https://github.com/BerriAI/litellm/pull/53442)
- Change `together_ai/Qwen/Qwen4-Max` pricing to the promotional rate Together bills until 2026-11-23 - [PR #52814](https://github.com/BerriAI/litellm/pull/52814)
- Change Fireworks `inkling` deprecation date to 2026-11-20 - [PR #53303](https://github.com/BerriAI/litellm/pull/53303)

## LLM API Endpoints

### Responses API

- Fix cancelled polling responses completing later and the model call continuing to bill - [PR #49384](https://github.com/BerriAI/litellm/pull/49384)
- Fix refused Responses WebSocket turns logging only one failure row per socket - [PR #50731](https://github.com/BerriAI/litellm/pull/50731)
- Fix `GET /v1/responses/{id}/input_items` ignoring `limit`, `order`, `after`, `before` and `include` - [PR #51259](https://github.com/BerriAI/litellm/pull/51259)
- Fix streamed tool calls arriving with empty arguments when models send them only in done events - [PR #52069](https://github.com/BerriAI/litellm/pull/52069)
- Fix memory held after streamed `/v1/responses` requests finish until a full garbage collection - [PR #52215](https://github.com/BerriAI/litellm/pull/52215)
- Fix a caller's lowercase `authorization` header being sent upstream next to the configured key, causing 401 - [PR #52259](https://github.com/BerriAI/litellm/pull/52259)
- Fix truncated Responses streams ending with `response.completed` instead of an incomplete status - [PR #52489](https://github.com/BerriAI/litellm/pull/52489)
- Fix stored Responses chains billing the system prompt twice - [PR #52694](https://github.com/BerriAI/litellm/pull/52694)
- Fix Claude Code billing metadata changing the prompt sent to the Responses API and breaking prompt cache reuse - [PR #52732](https://github.com/BerriAI/litellm/pull/52732)
- Fix websocket error and guardrail block frames carrying no HTTP status, which left Codex hanging until timeout - [PR #52874](https://github.com/BerriAI/litellm/pull/52874), [PR #52942](https://github.com/BerriAI/litellm/pull/52942)
- Fix Responses tool results losing the references needed to load deferred tools on Anthropic routes - [PR #52977](https://github.com/BerriAI/litellm/pull/52977)
- Fix Responses WebSocket closing with code 1011 on an `http://` `api_base` - [PR #53240](https://github.com/BerriAI/litellm/pull/53240)
- Fix Codex `compaction_trigger` returning no compaction item for Claude on Bedrock via `/v1/responses` - [PR #53266](https://github.com/BerriAI/litellm/pull/53266)
- Fix a cut `/v1/responses` stream on Claude billing an estimate and missing the 499 marker or spend row - [PR #53394](https://github.com/BerriAI/litellm/pull/53394)
- Fix Codex over `ws /v1/responses` failing after its first tool call on providers without native WebSocket - [PR #53410](https://github.com/BerriAI/litellm/pull/53410)
- Change `previous_response_id` on chat completions and Messages requests to return 400 instead of 200 - [PR #53038](https://github.com/BerriAI/litellm/pull/53038)

### Chat Completions

- Fix custom provider streams crashing on chunks missing fields like `is_finished` - [PR #43501](https://github.com/BerriAI/litellm/pull/43501)
- Fix LiteLLM-internal MCP and `fake_stream` params being sent in provider request bodies - [PR #46083](https://github.com/BerriAI/litellm/pull/46083)
- Fix 500 when `extra_headers` is not an object, now a 400 naming `extra_headers` - [PR #50581](https://github.com/BerriAI/litellm/pull/50581)
- Fix custom prompt manager system messages being sent twice on async calls and three times with fallbacks - [PR #51836](https://github.com/BerriAI/litellm/pull/51836)
- Fix Gateway chat completions returning 501 for `max_tokens`, `top_p` and `stop` on Bedrock and Anthropic - [PR #52211](https://github.com/BerriAI/litellm/pull/52211)
- Fix concatenated tool call arguments in history failing on Anthropic and Bedrock - [PR #52216](https://github.com/BerriAI/litellm/pull/52216)
- Fix failed llama-3 requests waiting about 23 seconds on a tokenizer download before returning the error - [PR #52232](https://github.com/BerriAI/litellm/pull/52232)
- Fix 500 on comma-separated `model` with `stream=true`, which now returns a 400 before calling any provider - [PR #52264](https://github.com/BerriAI/litellm/pull/52264)
- Fix non-streaming chat responses on path-model routes returning the provider model name instead of the alias - [PR #53192](https://github.com/BerriAI/litellm/pull/53192)
- Fix completion routing dropping separate connect, write and pool timeouts - [PR #53391](https://github.com/BerriAI/litellm/pull/53391)
- Fix streamed chat with `n` above 1 giving `delta.role` to only one choice - [PR #53582](https://github.com/BerriAI/litellm/pull/53582)
- Change audio output requests to text models on Responses, Messages and Completions to return 400 without `drop_params` - [PR #49960](https://github.com/BerriAI/litellm/pull/49960)
- Change upstream 403 from OpenAI-style providers to `PermissionDeniedError` and stop retrying it - [PR #52179](https://github.com/BerriAI/litellm/pull/52179)

### Anthropic Messages API

- Fix 401 from the Rust gateway for Anthropic SDK clients that send the key as `X-Api-Key` - [PR #49410](https://github.com/BerriAI/litellm/pull/49410)
- Fix the OpenAI stream running on after a client closes a `/v1/messages` stream early - [PR #51274](https://github.com/BerriAI/litellm/pull/51274)
- Fix `/v1/messages` thinking blocks missing `signature` and bridged `openai/` responses returning empty `content` - [PR #52116](https://github.com/BerriAI/litellm/pull/52116)
- Fix stateless Messages requests to GPT-6.2 missing the prompt cache when a dropped continuation is sent - [PR #52743](https://github.com/BerriAI/litellm/pull/52743)
- Fix empty tool inputs on streamed `/v1/messages` calls to OpenAI models when arguments arrive only at the end - [PR #53306](https://github.com/BerriAI/litellm/pull/53306)
- Change Claude on Vertex AI `/v1/messages` to be served by the Rust gateway - [PR #52314](https://github.com/BerriAI/litellm/pull/52314)
- Change Claude Platform on AWS `/v1/messages` to be served by the Rust gateway and fix it billing zero - [PR #52681](https://github.com/BerriAI/litellm/pull/52681)

### Realtime

- Add Gemini Live Avatar support on Vertex AI `/v1/realtime` - [PR #53270](https://github.com/BerriAI/litellm/pull/53270)
- Add `gpt-live-1` over WebRTC with sideband attach, and billing for Realtime WebRTC calls - [PR #53282](https://github.com/BerriAI/litellm/pull/53282), [PR #53548](https://github.com/BerriAI/litellm/pull/53548)
- Fix push-to-talk transcription without `intent` being forced to server VAD under a transcript guardrail - [PR #50594](https://github.com/BerriAI/litellm/pull/50594)
- Fix Realtime WebSockets ignoring a team's model alias and picking another deployment - [PR #52124](https://github.com/BerriAI/litellm/pull/52124)
- Fix Gemini and Vertex Live barge-ins ending as completed instead of a cancelled `response.done` - [PR #52596](https://github.com/BerriAI/litellm/pull/52596)

### Images, audio and embeddings

- Add Gradium text-to-speech on `/v1/audio/speech` - [PR #46427](https://github.com/BerriAI/litellm/pull/46427)
- Fix custom image handlers not receiving `n`, `size`, `quality`, `response_format`, `user` and `mask` - [PR #52051](https://github.com/BerriAI/litellm/pull/52051)
- Fix `additional_drop_params` ignoring provider-specific embedding params like `input_type` - [PR #52098](https://github.com/BerriAI/litellm/pull/52098)
- Fix `additional_drop_params` ignored on image generation and edit when passed as a tuple or with non-string entries - [PR #52390](https://github.com/BerriAI/litellm/pull/52390)
- Fix custom embedding HTTP clients losing the upstream error status - [PR #52904](https://github.com/BerriAI/litellm/pull/52904)
- Fix empty usage logged for `text`, `srt` and `vtt` transcription and Groq, now logs clip duration - [PR #53256](https://github.com/BerriAI/litellm/pull/53256)
- Change `/v1/audio/speech` to stream audio as it arrives and log spend for `stream: true` - [PR #46222](https://github.com/BerriAI/litellm/pull/46222)

### Batches and files

- Fix `gpt-*` wildcard keys using the proxy's own key on files, batches, RAG and vector store files, broken since v1.96.0 - [PR #49744](https://github.com/BerriAI/litellm/pull/49744)
- Fix batches failing when a model-routed JSONL upload contains model alias rows - [PR #51843](https://github.com/BerriAI/litellm/pull/51843)
- Fix Vertex and Bedrock batches counting 0 input tokens, so `model_batch_enqueued_token_limit` was not enforced - [PR #53257](https://github.com/BerriAI/litellm/pull/53257)

### Vector stores

- Add YAML-configured fallbacks for unified vector store search - [PR #52093](https://github.com/BerriAI/litellm/pull/52093)
- Add failover of native vector store search passthrough to the store's configured `fallbacks` - [PR #52856](https://github.com/BerriAI/litellm/pull/52856)

### Count tokens

- Fix custom-named deployments ignoring `base_model` when picking a tokenizer - [PR #50734](https://github.com/BerriAI/litellm/pull/50734)
- Fix the Rust tokenizer erroring on lone surrogates and out-of-range token ids, to match tiktoken - [PR #51720](https://github.com/BerriAI/litellm/pull/51720)
- Fix token counts for grok-4.3 on non-xAI hosts and Azure grok-4-1-fast-non-reasoning - [PR #53418](https://github.com/BerriAI/litellm/pull/53418)
- Fix token count routes ignoring the key's team, tags, aliases and `router_settings` when picking a deployment - [PR #53425](https://github.com/BerriAI/litellm/pull/53425)

## Management Endpoints / UI

### Admin UI

- Add Simplified Chinese to the Admin UI language menu, with 4,243 more translated strings - [PR #48257](https://github.com/BerriAI/litellm/pull/48257), [PR #52990](https://github.com/BerriAI/litellm/pull/52990)
- Add bulk actions for virtual keys on the current page - [PR #52138](https://github.com/BerriAI/litellm/pull/52138)
- Add email labels, bulk clearing and editable thresholds to alerts - [PR #52139](https://github.com/BerriAI/litellm/pull/52139)
- Add customer portal budget groups, per-app budgets on the Usage page, and TPM and RPM limits for customers - [PR #52411](https://github.com/BerriAI/litellm/pull/52411), [PR #52477](https://github.com/BerriAI/litellm/pull/52477), [PR #52493](https://github.com/BerriAI/litellm/pull/52493), [PR #52608](https://github.com/BerriAI/litellm/pull/52608)
- Add a CSV export of the skill download history - [PR #52569](https://github.com/BerriAI/litellm/pull/52569)
- Add token usage and cache cost breakdowns to the Customer Portal - [PR #52601](https://github.com/BerriAI/litellm/pull/52601)
- Add app-scoped read access to Customer Management through object permissions, hidden without an app grant - [PR #52781](https://github.com/BerriAI/litellm/pull/52781)
- Add linking of overall app budgets to shared budget presets - [PR #52946](https://github.com/BerriAI/litellm/pull/52946)
- Add a read-only view of custom team metadata in team settings - [PR #53459](https://github.com/BerriAI/litellm/pull/53459)
- Add a notice in Cost Tracking settings when `config.yaml` controls cost margins - [PR #53475](https://github.com/BerriAI/litellm/pull/53475)
- Add CSV export to the Request Logs page - [PR #53501](https://github.com/BerriAI/litellm/pull/53501)
- Fix Admin UI buttons and Aria Agent failing when opened over plain HTTP - [PR #52129](https://github.com/BerriAI/litellm/pull/52129)
- Fix Aria Agent date tools failing with 400 on DeepSeek model groups - [PR #52189](https://github.com/BerriAI/litellm/pull/52189)
- Fix auto router setup not recognizing Bedrock `in.` and `ca.` inference profiles - [PR #52574](https://github.com/BerriAI/litellm/pull/52574)
- Fix temporary budget increases replacing permanent custom limits in Customer Management - [PR #52787](https://github.com/BerriAI/litellm/pull/52787)
- Fix the env-credential login warning's docs link landing on Quick Start - [PR #52788](https://github.com/BerriAI/litellm/pull/52788)
- Fix missing spacing below the Add Fallbacks button - [PR #52793](https://github.com/BerriAI/litellm/pull/52793)
- Fix AI Hub showing Unknown health for models published through a wildcard entry like `bedrock/*` - [PR #52875](https://github.com/BerriAI/litellm/pull/52875)
- Fix user Details showing the old role after saving a role change - [PR #52991](https://github.com/BerriAI/litellm/pull/52991)
- Fix auto-router simple setup being replaced by advanced controls when changing strategy - [PR #53054](https://github.com/BerriAI/litellm/pull/53054)
- Fix Create Key listing teams where the member cannot create keys - [PR #53139](https://github.com/BerriAI/litellm/pull/53139)
- Fix saved team policies appearing empty after reopening a team - [PR #53434](https://github.com/BerriAI/litellm/pull/53434)
- Fix picking a member model replacing their inherited model list when extending a member key - [PR #53445](https://github.com/BerriAI/litellm/pull/53445)
- Fix SSO users without an email showing a UUID instead of their saved alias - [PR #53476](https://github.com/BerriAI/litellm/pull/53476)
- Fix the Logs public model filter returning zero rows - [PR #53489](https://github.com/BerriAI/litellm/pull/53489)
- Fix the Logs details drawer showing only the user ID instead of the email for internal users - [PR #53499](https://github.com/BerriAI/litellm/pull/53499)
- Fix the models refresh button position and a used-up budget percent rendering glued to its limit - [PR #53939](https://github.com/BerriAI/litellm/pull/53939)
- Fix page controls and tab underlines misplaced below the new page headers - [PR #54100](https://github.com/BerriAI/litellm/pull/54100)
- Change Projects to show by default for Proxy, Org and Team Admins and remove the Projects toggle - [PR #49391](https://github.com/BerriAI/litellm/pull/49391)
- Change the dashboard and chat sidebars to the shadcn Sidebar, adding a Cmd/Ctrl+B toggle - [PR #51257](https://github.com/BerriAI/litellm/pull/51257)
- Change the customer management portal to show less explanatory text and use more consistent spacing - [PR #52381](https://github.com/BerriAI/litellm/pull/52381)
- Change the Projects nav item to no longer show a Beta badge - [PR #52389](https://github.com/BerriAI/litellm/pull/52389)
- Change the Applications page to list every application in a table - [PR #52496](https://github.com/BerriAI/litellm/pull/52496)
- Change Logging Callbacks to mark rows set in config.yaml and disable their Delete action - [PR #52507](https://github.com/BerriAI/litellm/pull/52507)
- Change the workspace switcher to offer Lens - [PR #52563](https://github.com/BerriAI/litellm/pull/52563)
- Change Model Hub to the model catalog layout with a Quick start section and Cmd/Ctrl+K search - [PR #52672](https://github.com/BerriAI/litellm/pull/52672)
- Change Customer Portal budget editing to a modal with preset and custom amounts, and usage rows open a detail page - [PR #52682](https://github.com/BerriAI/litellm/pull/52682)
- Change the login page to show the new LiteLLM logo - [PR #52789](https://github.com/BerriAI/litellm/pull/52789)
- Change the dashboard to follow the system color scheme when no theme is saved - [PR #52792](https://github.com/BerriAI/litellm/pull/52792)
- Change about 120 Admin UI labels to use one English name per concept - [PR #52968](https://github.com/BerriAI/litellm/pull/52968)
- Change page headers and spacing across the Admin UI to match Virtual Keys - [PR #53278](https://github.com/BerriAI/litellm/pull/53278), [PR #53283](https://github.com/BerriAI/litellm/pull/53283), [PR #53284](https://github.com/BerriAI/litellm/pull/53284), [PR #53440](https://github.com/BerriAI/litellm/pull/53440)
- Change team member defaults to live in their own Member Defaults tab - [PR #53371](https://github.com/BerriAI/litellm/pull/53371)
- Change the key overview to always show inherited budgets in a visible card - [PR #53375](https://github.com/BerriAI/litellm/pull/53375)
- Change Usage to open on month-to-date instead of the last seven days - [PR #53457](https://github.com/BerriAI/litellm/pull/53457)
- Change the sidebar item to Model Management and shortened three page titles to match their sidebar labels - [PR #53466](https://github.com/BerriAI/litellm/pull/53466)
- Change zh-CN dashboard text to keep acronyms like USD, URL and RPM in English - [PR #53472](https://github.com/BerriAI/litellm/pull/53472)
- Change the virtual key Overview tab, header and loading state to a redesigned layout - [PR #53514](https://github.com/BerriAI/litellm/pull/53514)
- Change the key Spend card to always show lifetime spend and align its columns at the top - [PR #53537](https://github.com/BerriAI/litellm/pull/53537)
- Remove the decision models announcement banner above the models table - [PR #53202](https://github.com/BerriAI/litellm/pull/53202)
- Remove the old username and password login page in favor of `/ui/login` - [PR #53205](https://github.com/BerriAI/litellm/pull/53205)

### Keys, teams and authentication

- Add `include_members=false` on `/team/info` and a paged team members endpoint for large rosters - [PR #51885](https://github.com/BerriAI/litellm/pull/51885)
- Add JWT claim mapping for customer org, customer member and customer team - [PR #52399](https://github.com/BerriAI/litellm/pull/52399)
- Add configurable customer identity headers for tenant and user on inference requests - [PR #52467](https://github.com/BerriAI/litellm/pull/52467)
- Add a per-app setting for whether requests may create unknown customers - [PR #52485](https://github.com/BerriAI/litellm/pull/52485)
- Add current budget-window spend to `/user/info`, `/v2/user/info` and `/team/info` - [PR #52673](https://github.com/BerriAI/litellm/pull/52673)
- Add custom spend windows and shared budget templates for app members in the customer portal - [PR #52784](https://github.com/BerriAI/litellm/pull/52784), [PR #52976](https://github.com/BerriAI/litellm/pull/52976), [PR #52989](https://github.com/BerriAI/litellm/pull/52989), [PR #53066](https://github.com/BerriAI/litellm/pull/53066)
- Add multiple percentage budget email alerts for teams in team settings or `metadata.max_budget_alert_emails` - [PR #52859](https://github.com/BerriAI/litellm/pull/52859), [PR #52860](https://github.com/BerriAI/litellm/pull/52860)
- Add budget alerts for app customer scopes to customer budget webhooks and custom callbacks - [PR #52955](https://github.com/BerriAI/litellm/pull/52955)
- Add required customer headers by gateway, team or key - [PR #53045](https://github.com/BerriAI/litellm/pull/53045)
- Add app groups with shared budgets and usage in Customer Management - [PR #53232](https://github.com/BerriAI/litellm/pull/53232)
- Add carryover of unused budget into the next period with a cap - [PR #53309](https://github.com/BerriAI/litellm/pull/53309)
- Fix `/scim/v2` errors to return the RFC 7644 SCIM Error schema - [PR #51322](https://github.com/BerriAI/litellm/pull/51322)
- Fix budget reservations using output caps the provider never sees, which let parallel calls overspend a key, broken since v1.102.0 - [PR #51752](https://github.com/BerriAI/litellm/pull/51752)
- Fix priority request headers and counters stopping once a priority pool's tokens run out - [PR #52081](https://github.com/BerriAI/litellm/pull/52081)
- Fix a view-only Default Role being ignored for users with no stored role - [PR #52295](https://github.com/BerriAI/litellm/pull/52295)
- Fix a wrong key on a proxy without a database returning 400 `No connected db` instead of 401 - [PR #52349](https://github.com/BerriAI/litellm/pull/52349)
- Fix a `model_max_budget` entry on a model group ignoring requests sent under its global aliases - [PR #52385](https://github.com/BerriAI/litellm/pull/52385)
- Fix exhausted team member, end user and org limits not being checked early when the team is not cached - [PR #52388](https://github.com/BerriAI/litellm/pull/52388)
- Fix JWT team callers getting 403 on subpaths of granted pass-through endpoints and on database outages - [PR #52397](https://github.com/BerriAI/litellm/pull/52397)
- Fix rotating the master key with `LITELLM_SALT_KEY` set leaving DB model credentials as ciphertext - [PR #52413](https://github.com/BerriAI/litellm/pull/52413)
- Fix 401 `No api key passed in` when `Connection` lists `x-litellm-api-key` - [PR #52427](https://github.com/BerriAI/litellm/pull/52427)
- Fix over-budget keys still getting 200 through custom auth by enforcing the key's `max_budget` - [PR #52654](https://github.com/BerriAI/litellm/pull/52654)
- Fix a stalled model access group scan holding up later authentication requests - [PR #52899](https://github.com/BerriAI/litellm/pull/52899)
- Fix organization admin spend log reads to follow the organizations they administer and aligned Gemini file id parsing - [PR #52943](https://github.com/BerriAI/litellm/pull/52943)
- Fix master key rotation leaving some stored secrets encrypted under the old key - [PR #52998](https://github.com/BerriAI/litellm/pull/52998)
- Fix budget windows resetting early, including multi-day hour budgets and non-UTC `litellm_settings.timezone` - [PR #53012](https://github.com/BerriAI/litellm/pull/53012), [PR #53020](https://github.com/BerriAI/litellm/pull/53020)
- Fix authorization errors naming built-in headers instead of the configured customer headers - [PR #53043](https://github.com/BerriAI/litellm/pull/53043)
- Fix known app customers getting 503 when PostgreSQL goes down - [PR #53056](https://github.com/BerriAI/litellm/pull/53056)
- Fix budget resets overwriting newer budget limit edits or restoring expired windows - [PR #53064](https://github.com/BerriAI/litellm/pull/53064)
- Fix daily and monthly budget windows reopening or miscounting across DST changes - [PR #53065](https://github.com/BerriAI/litellm/pull/53065)
- Fix budget resets firing early so schedules like `45m` and `5h` get their full interval - [PR #53151](https://github.com/BerriAI/litellm/pull/53151)
- Fix 403s on log compliance checks for users with an explicit Models list - [PR #53160](https://github.com/BerriAI/litellm/pull/53160)
- Fix admin session tokens from OAuth sign-in missing the user's email - [PR #53184](https://github.com/BerriAI/litellm/pull/53184)
- Fix `bearer` scheme in any casing being rejected on Realtime and HTTP routes - [PR #53259](https://github.com/BerriAI/litellm/pull/53259)
- Fix JWT team reads returning 401 during a database outage, now retries and answers 503 - [PR #53260](https://github.com/BerriAI/litellm/pull/53260)
- Fix proxy startup failing on `audience` and `public_key_url` under `litellm_jwtauth` - [PR #53288](https://github.com/BerriAI/litellm/pull/53288)
- Change `/spend/logs` and `/spend/logs/v2` so every key reads its own logs and out-of-scope filters return 403 - [PR #52449](https://github.com/BerriAI/litellm/pull/52449)
- Change `GET /customer/info` to require the proxy admin role, so org admins now get 401 - [PR #52451](https://github.com/BerriAI/litellm/pull/52451)
- Change unknown JWT team claims to return a generic 401 instead of a 404 that echoed the team id - [PR #53044](https://github.com/BerriAI/litellm/pull/53044)
- Change key and team `budget_limits` to return 422 for negative caps, unsupported durations and repeated durations - [PR #53218](https://github.com/BerriAI/litellm/pull/53218)

### Lens

- Add gateway model calls sent to Lens as traces when the Lens store is connected - [PR #53042](https://github.com/BerriAI/litellm/pull/53042)
- Add framework, task and session attributes to gateway traces sent to Lens, and Pi runs now group as one run - [PR #53186](https://github.com/BerriAI/litellm/pull/53186)
- Add `/lens/login` so a LiteLLM login signs in to standalone Lens and shows the user in its sidebar - [PR #53190](https://github.com/BerriAI/litellm/pull/53190), [PR #53212](https://github.com/BerriAI/litellm/pull/53212), [PR #53213](https://github.com/BerriAI/litellm/pull/53213)
- Add agent span forwarding to Lens through `POST /v1/traces` with gateway calls in the agent's trace - [PR #53285](https://github.com/BerriAI/litellm/pull/53285)
- Fix the Lens workspace still showing the full gateway sidebar - [PR #52771](https://github.com/BerriAI/litellm/pull/52771)
- Fix Lens joining separate runs of the same prompt from agents that send no session id - [PR #53194](https://github.com/BerriAI/litellm/pull/53194)
- Fix requests over 1 MiB reaching Lens with no cost record - [PR #53268](https://github.com/BerriAI/litellm/pull/53268)
- Fix the Lens page showing an upgrade notice on unconfigured gateways and a localhost link on hosted ones - [PR #53534](https://github.com/BerriAI/litellm/pull/53534)
- Fix Lens dropping the cost record of requests with large tool definitions - [PR #53711](https://github.com/BerriAI/litellm/pull/53711)
- Change embedded Lens UI to the released 0.1.0 version with new navigation and a hideable activity chart - [PR #53041](https://github.com/BerriAI/litellm/pull/53041)
- Change Lens's own calls to be ordinary calls labeled `lens-signals` and remove the `x-lens-internal` header - [PR #53163](https://github.com/BerriAI/litellm/pull/53163)
- Change gateway Codex runs to be named `codex-cli` so they match Codex's own traces in Lens - [PR #53197](https://github.com/BerriAI/litellm/pull/53197)
- Change the gateway to strip agent harness context from the traces it sends Lens - [PR #53226](https://github.com/BerriAI/litellm/pull/53226)
- Change gateway cost records sent to Lens to omit request and response bodies - [PR #53274](https://github.com/BerriAI/litellm/pull/53274)
- Change the Admin UI Lens page to the Lens 0.2.0 UI - [PR #53281](https://github.com/BerriAI/litellm/pull/53281)
- Change the dashboard to show the Lens UI served by the connected Lens - [PR #53473](https://github.com/BerriAI/litellm/pull/53473)
- Change Lens to show Claude Code's own traces and logs and stop sending the gateway's own records - [PR #53485](https://github.com/BerriAI/litellm/pull/53485)

## AI Integrations

### Guardrails

- Add an opt-in pre_call scan of tool descriptions as text for PANW and Presidio guardrails - [PR #50301](https://github.com/BerriAI/litellm/pull/50301)
- Add image scanning on `/apply_guardrail` with Bedrock guardrails - [PR #51016](https://github.com/BerriAI/litellm/pull/51016)
- Add Model Armor scanning of MCP tool results with `post_mcp_call` - [PR #51887](https://github.com/BerriAI/litellm/pull/51887)
- Add an opt-in Bedrock guardrail scan of tool-call arguments and tool descriptions as text - [PR #52999](https://github.com/BerriAI/litellm/pull/52999)
- Add `reject_unregistered_guardrails` to reject requests that name an unregistered guardrail - [PR #53214](https://github.com/BerriAI/litellm/pull/53214)
- Fix Generic Guardrail API rewritten `tool_calls` not reaching the client on any endpoint - [PR #50413](https://github.com/BerriAI/litellm/pull/50413)
- Fix `/apply_guardrail` requests missing from request logs, now logged with verdict and cost - [PR #51014](https://github.com/BerriAI/litellm/pull/51014)
- Fix the Alice guardrail sending each prompt to Alice four times - [PR #51392](https://github.com/BerriAI/litellm/pull/51392)
- Fix Gray Swan guardrail treating `error: true` replies and invalid scores as clean instead of following `fail_open` - [PR #52191](https://github.com/BerriAI/litellm/pull/52191)
- Fix per-request `extra_body` not reaching a generic guardrail service - [PR #52438](https://github.com/BerriAI/litellm/pull/52438)
- Fix post-call `MASK` guardrails leaving reasoning text unmasked on `/v1/responses` - [PR #52504](https://github.com/BerriAI/litellm/pull/52504)
- Fix guardrail rewrites on `/v1/messages` dropping `is_error` on tool results and `output_config` on system rows - [PR #52828](https://github.com/BerriAI/litellm/pull/52828)
- Fix policy template competitor name generation returning no names with newer OpenAI models - [PR #53311](https://github.com/BerriAI/litellm/pull/53311)
- Fix guardrails not seeing the `web_search` tool on `/v1/messages` - [PR #53376](https://github.com/BerriAI/litellm/pull/53376)
- Fix `tool_permission` returning 400 on every Gemini `streamGenerateContent` stream - [PR #53600](https://github.com/BerriAI/litellm/pull/53600)
- Change Straiker streaming to hold tool calls until the verdict and log prompts it blocks with a reply - [PR #51872](https://github.com/BerriAI/litellm/pull/51872)

### Logging and observability

- Add an OTel span for every failed retry and fallback attempt, with its destination and error - [PR #50310](https://github.com/BerriAI/litellm/pull/50310)
- Add prompt cache advisories to alerts, including alerts for repeated Anthropic prompt cache misses - [PR #51943](https://github.com/BerriAI/litellm/pull/51943), [PR #51973](https://github.com/BerriAI/litellm/pull/51973)
- Add opt-in prefix block hashes in spend logs for workload replay - [PR #52120](https://github.com/BerriAI/litellm/pull/52120)
- Add startup and shutdown hooks for custom callbacks during the proxy lifespan - [PR #52908](https://github.com/BerriAI/litellm/pull/52908)
- Fix settings reloads stacking Generic API logger flush tasks and keeping old headers - [PR #50879](https://github.com/BerriAI/litellm/pull/50879)
- Fix OTel V2 sending Langfuse traces to key or team hosts that were refused - [PR #51344](https://github.com/BerriAI/litellm/pull/51344)
- Fix spend log retention never deleting guardrail index rows, which grew by one row per `default_on` guardrail call - [PR #51518](https://github.com/BerriAI/litellm/pull/51518)
- Fix streaming success logging callbacks being dropped before they finished - [PR #52067](https://github.com/BerriAI/litellm/pull/52067)
- Fix disconnected streams logging an invented finish reason, now `finish_reason_unspecified` - [PR #52088](https://github.com/BerriAI/litellm/pull/52088)
- Fix async Interactions stream success logging being dropped by garbage collection or shutdown - [PR #52300](https://github.com/BerriAI/litellm/pull/52300)
- Fix stale request fields in streaming failure callbacks and finished requests held in memory - [PR #52408](https://github.com/BerriAI/litellm/pull/52408)
- Fix `DD_TAGS` not being sent on Datadog logs and LLM Observability spans - [PR #52415](https://github.com/BerriAI/litellm/pull/52415)
- Fix provider failures after a client disconnect never reaching failure callbacks - [PR #52450](https://github.com/BerriAI/litellm/pull/52450)
- Fix pass-through spend rows logging 0 prompt and completion tokens for TypeSafe and decisions calls, broken since v1.110.0 - [PR #52527](https://github.com/BerriAI/litellm/pull/52527)
- Fix generated images still being logged when `turn_off_message_logging` is on - [PR #52605](https://github.com/BerriAI/litellm/pull/52605)
- Fix traces and Prometheus deployment metrics showing `None` instead of the real provider outside chat - [PR #52622](https://github.com/BerriAI/litellm/pull/52622), [PR #52709](https://github.com/BerriAI/litellm/pull/52709)
- Fix Rust background task warnings and debug lines missing from the proxy log, and print their fields - [PR #53539](https://github.com/BerriAI/litellm/pull/53539), [PR #53717](https://github.com/BerriAI/litellm/pull/53717), [PR #53738](https://github.com/BerriAI/litellm/pull/53738)
- Fix the Rust gateway logging secrets unscrubbed, so its log lines now show `REDACTED` - [PR #53714](https://github.com/BerriAI/litellm/pull/53714)
- Fix MCP `authorization_token` values staying readable in debug logs - [PR #53740](https://github.com/BerriAI/litellm/pull/53740)
- Change the spend logs `key_alias` filter to an exact match that uses the index - [PR #47795](https://github.com/BerriAI/litellm/pull/47795)

## Spend Tracking, Budgets and Rate Limiting

### Cost tracking

- Add pricing for OpenRouter and Perplexity decisions models, which previously logged $0 spend - [PR #45476](https://github.com/BerriAI/litellm/pull/45476)
- Add key and user metadata objects to daily activity usage export rows - [PR #49360](https://github.com/BerriAI/litellm/pull/49360)
- Add `fal_ai` Seedance 2.5 Flash and PixVerse clip prices, Copilot deprecation dates and Groq and Nebius price fixes - [PR #51929](https://github.com/BerriAI/litellm/pull/51929), [PR #52041](https://github.com/BerriAI/litellm/pull/52041)
- Add non-USD pricing with `pricing_currency` overrides, ECB rate lookup and a currency estimate on the Usage card - [PR #51934](https://github.com/BerriAI/litellm/pull/51934), [PR #51971](https://github.com/BerriAI/litellm/pull/51971), [PR #51979](https://github.com/BerriAI/litellm/pull/51979)
- Add prices for Databricks `gemini-4-hydrogen`, fal_ai `iris-z` and Bedrock `eu.cohere.embed-v4:0` - [PR #52162](https://github.com/BerriAI/litellm/pull/52162)
- Add `bedrock_mantle/` and `bedrock/mantle/` prices for Mantle models and correct the Claude Haiku 4.5 rate - [PR #52231](https://github.com/BerriAI/litellm/pull/52231)
- Add pricing for fal_ai Kling V4 image models, Azure GPT-6 Luna flex, Snowflake and Bedrock Mantle Claude 5.5 - [PR #52299](https://github.com/BerriAI/litellm/pull/52299)
- Add pricing for fal_ai HeyGen Avatar 6 and Microsoft MAI-Image-2.7 endpoints - [PR #52340](https://github.com/BerriAI/litellm/pull/52340)
- Add surcharges on customer requests, set overall or as a per-app percentage - [PR #52406](https://github.com/BerriAI/litellm/pull/52406), [PR #52492](https://github.com/BerriAI/litellm/pull/52492)
- Add replacement models and deprecation links for 286 more dated model listings - [PR #52710](https://github.com/BerriAI/litellm/pull/52710)
- Add `gemini/genie-4` pricing so spend for it is tracked - [PR #52872](https://github.com/BerriAI/litellm/pull/52872)
- Add `azure_ai/kimi-k3.1-pro` pricing so calls to it are no longer tracked at $0 - [PR #52873](https://github.com/BerriAI/litellm/pull/52873)
- Add replacement models for most dated models on the deprecated models list - [PR #52893](https://github.com/BerriAI/litellm/pull/52893)
- Add 27 cost map rows for Together, Perplexity, InferenceAPIs and AssemblyAI and filled metadata on 72 existing rows - [PR #52912](https://github.com/BerriAI/litellm/pull/52912)
- Add `gpt-live-1.1` pricing at the published per-minute rate - [PR #52926](https://github.com/BerriAI/litellm/pull/52926)
- Add `fal_ai` Ideogram 4.6 text to image and edit pricing - [PR #52927](https://github.com/BerriAI/litellm/pull/52927)
- Add `together_ai/tencent/Hy4` to the cost map so its spend no longer tracks at zero - [PR #52985](https://github.com/BerriAI/litellm/pull/52985)
- Fix custom model prices not being saved despite a successful response - [PR #48746](https://github.com/BerriAI/litellm/pull/48746)
- Fix `gpt-4o-transcribe` audio input billed at $2.50 instead of $6.00 per 1M tokens - [PR #52303](https://github.com/BerriAI/litellm/pull/52303)
- Fix fal_ai Seedance 2.5 1080p videos billing at the 720p rate - [PR #52304](https://github.com/BerriAI/litellm/pull/52304)
- Fix missing file-search charge when web search runs in the same Responses call - [PR #52555](https://github.com/BerriAI/litellm/pull/52555)
- Fix the `claude-mythos-preview` deprecation date and add `azure/us-gov/gpt-4o-mini` pricing - [PR #52557](https://github.com/BerriAI/litellm/pull/52557)
- Fix wrong limits, prices and capability flags in the cost map and add missing recent models - [PR #52619](https://github.com/BerriAI/litellm/pull/52619)
- Fix `fireworks_ai/kimi-latest` being priced at Kimi K3 rates instead of Kimi K3.1 Pro - [PR #52634](https://github.com/BerriAI/litellm/pull/52634)
- Fix `generateContent` spend showing under `/chat/completions` or no endpoint on the Usage page - [PR #52701](https://github.com/BerriAI/litellm/pull/52701)
- Fix Azure and Together model retirement dates and add GMI Gemini 4 Hydrogen to the cost map - [PR #52763](https://github.com/BerriAI/litellm/pull/52763)
- Fix `fireworks_ai` spot router and deepseek-v4p1-flash-1017 ultrafast rows billing above Fireworks list prices - [PR #52928](https://github.com/BerriAI/litellm/pull/52928), [PR #52947](https://github.com/BerriAI/litellm/pull/52947)
- Fix priority rates for image input, cached image tokens and image output being ignored in cost - [PR #52972](https://github.com/BerriAI/litellm/pull/52972)
- Fix wrong spend for Fireworks router calls on chat completions and `/v1/messages` - [PR #52973](https://github.com/BerriAI/litellm/pull/52973)
- Fix the `wandb` NVIDIA Nemotron 3.5 Super VL output price to $0.47 per 1M tokens - [PR #52983](https://github.com/BerriAI/litellm/pull/52983)
- Fix Databricks Gemini 4 Carbon and Hydrogen prices to match the Databricks pricing page - [PR #52986](https://github.com/BerriAI/litellm/pull/52986)
- Fix `gpt-6-rosalind` long context and cache write prices being billed 50% too high - [PR #53050](https://github.com/BerriAI/litellm/pull/53050)
- Fix an extra spend row for forwarded-credential requests that time out on the final retry, broken since v1.110.2 - [PR #53072](https://github.com/BerriAI/litellm/pull/53072)
- Fix Together AI speech models priced per character being billed far below their rate - [PR #53130](https://github.com/BerriAI/litellm/pull/53130)
- Fix $0 cost logged for Azure AI GPT-5.6 and OpenRouter DeepSeek V4 requests - [PR #53149](https://github.com/BerriAI/litellm/pull/53149)
- Fix `gpt-4o-mini-tts` spend to match OpenAI's bill, about 20 to 35 percent lower for speech - [PR #53150](https://github.com/BerriAI/litellm/pull/53150)
- Fix speech billing ignoring a deployment's custom `input_cost_per_character`, including 0 - [PR #53265](https://github.com/BerriAI/litellm/pull/53265)
- Fix charges from failed requests being dropped when error logs are disabled - [PR #53271](https://github.com/BerriAI/litellm/pull/53271)
- Fix `gpt-4o-mini-tts` aac and flac speech spend logging about 19% above OpenAI's bill - [PR #53308](https://github.com/BerriAI/litellm/pull/53308)
- Fix duplicate billed rows and wrong deployment labels when a fallback fails after a timeout - [PR #53313](https://github.com/BerriAI/litellm/pull/53313)
- Fix Fireworks DeepSeek V4.1 Flash 1017 pricing and Azure and Vertex retirement dates - [PR #53331](https://github.com/BerriAI/litellm/pull/53331)
- Fix Prometheus budget gauges subtracting a request's own cost twice, and lost spend deliveries on UTC Postgres - [PR #54074](https://github.com/BerriAI/litellm/pull/54074)
- Change the FOCUS export to the 1.5 schema and remove `ProviderName` and `PublisherName` columns - [PR #52105](https://github.com/BerriAI/litellm/pull/52105)
- Change fal.ai FLUX 3 Max video pricing to the regular rate after the promotion ended - [PR #53670](https://github.com/BerriAI/litellm/pull/53670)

## MCP Gateway

- Add Parallel's free web search server to the MCP discovery registry - [PR #52141](https://github.com/BerriAI/litellm/pull/52141)
- Fix GitHub MCP sign-in looping on the connect page when the provider omits an already included scope, broken since v1.107.0-rc.1 - [PR #51788](https://github.com/BerriAI/litellm/pull/51788)
- Fix 401 and 500 errors from keyed MCP servers when the MCP JWT signer is on - [PR #51867](https://github.com/BerriAI/litellm/pull/51867)
- Fix 503 on every hosted admin MCP request for proxy admins on proxies with a lot of key and team data - [PR #52096](https://github.com/BerriAI/litellm/pull/52096)
- Fix `registry.json` showing the alias as each server's description and title - [PR #52319](https://github.com/BerriAI/litellm/pull/52319)
- Fix upstream `-32042` URL elicitation errors on `/mcp` being flattened, so the consent URL now reaches the client - [PR #52384](https://github.com/BerriAI/litellm/pull/52384)
- Fix repeated MCP sign-ins when permission refusals happen at the same time - [PR #52809](https://github.com/BerriAI/litellm/pull/52809)
- Fix MCP OAuth token refresh forgetting a missing permission request, which left reconnecting tools broken - [PR #53200](https://github.com/BerriAI/litellm/pull/53200)
- Change over-budget users and keys to be able to call MCP tools that are unpriced or cost $0 - [PR #52130](https://github.com/BerriAI/litellm/pull/52130)

## Agents, SDK and other changes

### Agents

- Add Compaction events when the Pi harness compacts context - [PR #52655](https://github.com/BerriAI/litellm/pull/52655)
- Fix unpriced models appearing free in agent evaluation recommendations - [PR #53455](https://github.com/BerriAI/litellm/pull/53455)

### SDK

- Add `aagent_eval_attempt` and custom `EvalAgent` agents that can be compared with supported harnesses - [PR #53366](https://github.com/BerriAI/litellm/pull/53366), [PR #53381](https://github.com/BerriAI/litellm/pull/53381)
- Fix `No module named 'fastapi'` on Messages streaming and cache hits with `pip install litellm` - [PR #52339](https://github.com/BerriAI/litellm/pull/52339)
- Fix `litellm.asystemone` calls to `litellm_proxy/` models losing confidence, `decision_id` and proxy cost - [PR #53195](https://github.com/BerriAI/litellm/pull/53195)
- Fix `e.response.text` being empty on provider errors from the Responses API and other endpoints - [PR #53587](https://github.com/BerriAI/litellm/pull/53587)

### Other

- Add an opt-in to skip reverse shadow evaluations that compare the same model group - [PR #52192](https://github.com/BerriAI/litellm/pull/52192)
- Add support for signed-in Cursor CLI subscriptions - [PR #52205](https://github.com/BerriAI/litellm/pull/52205)
- Add optional rubric grades from 1 to 5 to shadow evaluations, with APIs to start them and read grade distributions - [PR #52321](https://github.com/BerriAI/litellm/pull/52321)
- Fix the `lite codex` catalog dropping each model's configured service tiers and display name - [PR #49422](https://github.com/BerriAI/litellm/pull/49422)
- Fix requests failing UTF-8 encoding when a raw text body contains lone UTF-16 surrogates - [PR #49599](https://github.com/BerriAI/litellm/pull/49599)
- Fix Decisions API calls failing with `litellm.use_litellm_proxy` or a `litellm_proxy/` model - [PR #51611](https://github.com/BerriAI/litellm/pull/51611)
- Fix OCR and `/v1/messages` requests failing when the input is a dict subclass such as addict `Dict` - [PR #51812](https://github.com/BerriAI/litellm/pull/51812)
- Fix Skills Hub losing source and metadata on partial edits and ZIP replacement - [PR #51977](https://github.com/BerriAI/litellm/pull/51977)
- Fix Decisions answers being matched to questions by position instead of name - [PR #52597](https://github.com/BerriAI/litellm/pull/52597)
- Fix 400 on `/v1/decisions` with OpenAI `input_json` content parts - [PR #52805](https://github.com/BerriAI/litellm/pull/52805)
- Fix OAuth pass-through routes rejecting `client_id` in authorization URLs, broken since v1.110.1 - [PR #53379](https://github.com/BerriAI/litellm/pull/53379)
- Change OpenAI 403 `invalid_request_error` responses to raise `PermissionDeniedError` - [PR #53177](https://github.com/BerriAI/litellm/pull/53177)

## Performance / Loadbalancing / Reliability improvements

### Routing and fallbacks

- Add opt-in priority queues for async non-streaming chat when a deployment returns 429 or 529 - [PR #51892](https://github.com/BerriAI/litellm/pull/51892)
- Add a conversation limit so the complexity router classifies short asks in long conversations - [PR #52183](https://github.com/BerriAI/litellm/pull/52183)
- Add selectable conversation headers for router session affinity - [PR #52193](https://github.com/BerriAI/litellm/pull/52193)
- Add an option to reject raw provider model names that collide across unrelated model groups - [PR #52895](https://github.com/BerriAI/litellm/pull/52895)
- Add optional classifier output limits for the complexity router, settable from the dashboard - [PR #52979](https://github.com/BerriAI/litellm/pull/52979)
- Add shared cooldowns, allowed-fails counts and usage between the gateway and Python pods through Redis - [PR #53060](https://github.com/BerriAI/litellm/pull/53060)
- Fix tag-based routing picking the default deployment when pre-call guardrails are on - [PR #50488](https://github.com/BerriAI/litellm/pull/50488)
- Fix `enforce_fallback_model_access` checking a client-sent `model_group_alias` instead of the saved one - [PR #52077](https://github.com/BerriAI/litellm/pull/52077)
- Fix 413 and 422 `BadRequestError` still falling back when `fallback_on_unsupported_params` is false - [PR #52195](https://github.com/BerriAI/litellm/pull/52195)
- Fix the priority limiter counting cache-read tokens and returning 429 early on cached prompts - [PR #52209](https://github.com/BerriAI/litellm/pull/52209)
- Fix streamed `/v1/messages` and `/v1/responses` dropping one error when a cross-group fallback also fails - [PR #52217](https://github.com/BerriAI/litellm/pull/52217)
- Fix the native gateway skipping retries, fallbacks and cooldowns, and answering with the provider's model name - [PR #52274](https://github.com/BerriAI/litellm/pull/52274), [PR #52428](https://github.com/BerriAI/litellm/pull/52428), [PR #52466](https://github.com/BerriAI/litellm/pull/52466), [PR #52790](https://github.com/BerriAI/litellm/pull/52790)
- Fix team order and weighted failover on `/v1/responses`, `/v1/messages` and SDK calls - [PR #53264](https://github.com/BerriAI/litellm/pull/53264)
- Fix one caller's bad credential cooling down a shared deployment for every other caller - [PR #53431](https://github.com/BerriAI/litellm/pull/53431)
- Fix concurrent `/vertex_ai/*` calls on a least-busy group all hitting one deployment - [PR #53588](https://github.com/BerriAI/litellm/pull/53588)
- Change `silent_model` mirroring so clients can no longer opt out with `is_silent_experiment` in metadata - [PR #52083](https://github.com/BerriAI/litellm/pull/52083)
- Change unmatched `content_policy_fallbacks` to fall through to other fallbacks like `context_window_fallbacks` - [PR #52132](https://github.com/BerriAI/litellm/pull/52132)
- Improve auto-router by skipping frequent recovery queries when there are no observations - [PR #52523](https://github.com/BerriAI/litellm/pull/52523)

### Caching

- Add an option to exclude embeddings from response caching - [PR #52902](https://github.com/BerriAI/litellm/pull/52902)
- Fix cache hits logging `us-central1` for deployments with `vertex_location: global` - [PR #52150](https://github.com/BerriAI/litellm/pull/52150)
- Fix async Redis calls failing when `ssl: false` is set together with `ssl_check_hostname` - [PR #52344](https://github.com/BerriAI/litellm/pull/52344)
- Fix proxy boot crash when `cache_params.default_redis_ttl` is set with a Redis cache - [PR #52440](https://github.com/BerriAI/litellm/pull/52440)
- Fix `Cache-Control` `no-cache` and `no-store` request headers being ignored on cache lookups - [PR #52840](https://github.com/BerriAI/litellm/pull/52840)
- Fix duplicate success logging on cached `responses` calls with large base64 images - [PR #52852](https://github.com/BerriAI/litellm/pull/52852)
- Fix OpenTelemetry tracing preventing repeated requests from hitting the response cache - [PR #52971](https://github.com/BerriAI/litellm/pull/52971)
- Fix error when repeating cached Anthropic Responses SDK calls - [PR #53188](https://github.com/BerriAI/litellm/pull/53188)
- Fix cache hits changing the stored `finish_reason` on tool call completions - [PR #53236](https://github.com/BerriAI/litellm/pull/53236)
- Improve cache key hashing for huge requests and fix cache misses when `max_tokens` is lowered - [PR #52267](https://github.com/BerriAI/litellm/pull/52267)

### Deployment

- Add `labels` and `annotations` for the gateway ConfigMap in the Helm chart - [PR #44061](https://github.com/BerriAI/litellm/pull/44061)
- Add a control plane, started with `--control-plane`, that manages dataplanes with fleet usage and audit log sinks - [PR #49654](https://github.com/BerriAI/litellm/pull/49654), [PR #49655](https://github.com/BerriAI/litellm/pull/49655), [PR #49656](https://github.com/BerriAI/litellm/pull/49656), [PR #49657](https://github.com/BerriAI/litellm/pull/49657), [PR #49658](https://github.com/BerriAI/litellm/pull/49658), [PR #49659](https://github.com/BerriAI/litellm/pull/49659), [PR #49660](https://github.com/BerriAI/litellm/pull/49660), [PR #49661](https://github.com/BerriAI/litellm/pull/49661), [PR #49662](https://github.com/BerriAI/litellm/pull/49662), [PR #51762](https://github.com/BerriAI/litellm/pull/51762)
- Add a FIPS 140-3 proxy Docker image - [PR #50330](https://github.com/BerriAI/litellm/pull/50330)
- Add support for `include_litellm_headers: false` to omit `x-litellm-*` response headers, which was previously ignored - [PR #52949](https://github.com/BerriAI/litellm/pull/52949)
- Fix `os.environ/` references in config.yaml being sent as literal text by the Rust gateway - [PR #52025](https://github.com/BerriAI/litellm/pull/52025)
- Fix the startup schema drift check never reporting drift when schema updates are disabled - [PR #52435](https://github.com/BerriAI/litellm/pull/52435)
- Fix the Helm migration Job being OOMKilled after migrations succeed on a read-only root, broken since v1.105.1 - [PR #52460](https://github.com/BerriAI/litellm/pull/52460)
- Fix `/health/readiness` and `/key/info` errors persisting after a read replica reconnect timed out - [PR #52592](https://github.com/BerriAI/litellm/pull/52592)
- Fix slow failure and delayed readiness recovery when Postgres refuses connections - [PR #52617](https://github.com/BerriAI/litellm/pull/52617)
- Fix zombie `node` processes left behind after the Docker image starts - [PR #52642](https://github.com/BerriAI/litellm/pull/52642)
- Fix the Rust gateway opening more Postgres connections than the configured cap - [PR #52729](https://github.com/BerriAI/litellm/pull/52729)
- Fix proxies on a Unix-socket Postgres failing to boot because the migration lock URL dropped the `host` query param, broken since v1.108.0 - [PR #52797](https://github.com/BerriAI/litellm/pull/52797)
- Fix migration jobs crashing when psycopg cannot load libpq - [PR #53146](https://github.com/BerriAI/litellm/pull/53146)
- Change `fips_mode` to encrypt stored secrets with the FIPS provider's AES-256-GCM - [PR #51429](https://github.com/BerriAI/litellm/pull/51429)
- Change the Rust gateway to read config values and YAML the way the Python proxy does - [PR #52023](https://github.com/BerriAI/litellm/pull/52023)
- Change `fips_mode` to refuse startup without a `LITELLM_SALT_KEY` of at least 112 bits - [PR #52099](https://github.com/BerriAI/litellm/pull/52099)
- Change the FIPS image to install cryptography, grpcio and libpq from Chainguard apks for FIPS-module TLS - [PR #52997](https://github.com/BerriAI/litellm/pull/52997)

### Performance

- Add native Rust gateway handling of `/v1/messages` for master and virtual keys, including `models` lists and limits - [PR #52813](https://github.com/BerriAI/litellm/pull/52813), [PR #52839](https://github.com/BerriAI/litellm/pull/52839), [PR #53015](https://github.com/BerriAI/litellm/pull/53015), [PR #53332](https://github.com/BerriAI/litellm/pull/53332), [PR #53333](https://github.com/BerriAI/litellm/pull/53333)
- Improve request speed for long prompts by caching token counts per tokenizer - [PR #51904](https://github.com/BerriAI/litellm/pull/51904)
- Improve OpenAI-compatible streaming speed by decoding each chunk once - [PR #51905](https://github.com/BerriAI/litellm/pull/51905)
- Improve config reloads on proxies with large credential tables, which no longer stall requests - [PR #52305](https://github.com/BerriAI/litellm/pull/52305)
- Improve memory use by no longer keeping a full response copy that nothing reads - [PR #52524](https://github.com/BerriAI/litellm/pull/52524)
- Improve inference requests by caching app definition lookups instead of querying Postgres each time - [PR #52688](https://github.com/BerriAI/litellm/pull/52688)
- Improve routing latency in large routers by reading cooldowns only for each request's candidate deployments - [PR #52913](https://github.com/BerriAI/litellm/pull/52913)

## Documentation Updates

- Add a user guide for writing v2 callbacks - [PR #52076](https://github.com/BerriAI/litellm/pull/52076)

## Tests, CI and Internal Changes

Fixes for regressions that never reached a release, test and CI changes, dependency bumps and internal refactors.

- Add gemini-3.1-pro-preview flex tier cost tracking case - [PR #47845](https://github.com/BerriAI/litellm/pull/47845)
- Add tier 1 cost tracking cases for gpt-6.1-terra and sync suite price fields - [PR #49587](https://github.com/BerriAI/litellm/pull/49587)
- Run codex under the real model name as a team model, round trip and compaction - [PR #49896](https://github.com/BerriAI/litellm/pull/49896)
- Run codex in fast mode under the real model name - [PR #49899](https://github.com/BerriAI/litellm/pull/49899)
- Clean up fresh tech debt in routing, riva, least-busy, proxy cache and prompt template helpers - [PR #50192](https://github.com/BerriAI/litellm/pull/50192)
- Make the constructor stub work for mypy and guard it in CI - [PR #50354](https://github.com/BerriAI/litellm/pull/50354)
- Add azure gpt flex service tier cost tracking cases - [PR #50634](https://github.com/BerriAI/litellm/pull/50634)
- Type auth cache keys and keep the cache always native - [PR #51130](https://github.com/BerriAI/litellm/pull/51130)
- Move the invalidation channel to the native client - [PR #51135](https://github.com/BerriAI/litellm/pull/51135)
- Bump zip from 2.4.2 to 9.0.5 in /litellm/rust - [PR #51354](https://github.com/BerriAI/litellm/pull/51354)
- Port key and JWT authentication in a Rust core - [PR #51374](https://github.com/BerriAI/litellm/pull/51374)
- Move per-request miss, settlement and shutdown-drain tracking from Python into Rust - [PR #51384](https://github.com/BerriAI/litellm/pull/51384)
- Port parallel request limiter v3 to a rust callback - [PR #51537](https://github.com/BerriAI/litellm/pull/51537)
- Replace the python dynamic rate limiter v3 with a rust callback - [PR #51540](https://github.com/BerriAI/litellm/pull/51540)
- Share Replicate HTTP client factories and declare PagerDuty type alias - [PR #51594](https://github.com/BerriAI/litellm/pull/51594)
- Move non-auth writers out of the auth cache - [PR #51599](https://github.com/BerriAI/litellm/pull/51599)
- Add congestion-triggered priority queue controller - [PR #51883](https://github.com/BerriAI/litellm/pull/51883)
- Drop fresh suppressions in rate limiter and rust streaming, type perplexity cache read - [PR #51996](https://github.com/BerriAI/litellm/pull/51996)
- Drop os.environ/ stripping where config-load already resolved it - [PR #52026](https://github.com/BerriAI/litellm/pull/52026)
- Remove dead skip-marked tests and rewrite the Redis buffer drain test - [PR #52063](https://github.com/BerriAI/litellm/pull/52063)
- Update four stale integration and UI tests for intended behavior changes - [PR #52108](https://github.com/BerriAI/litellm/pull/52108)
- Wait for the scheduled reset to commit before reading the reset row - [PR #52128](https://github.com/BerriAI/litellm/pull/52128)
- Spend log contract fields and native flush at shutdown - [PR #52151](https://github.com/BerriAI/litellm/pull/52151)
- Add python porting rules to rust agents.md - [PR #52154](https://github.com/BerriAI/litellm/pull/52154)
- Allowlist the key Langfuse collector host in the OTel v2 console test - [PR #52157](https://github.com/BerriAI/litellm/pull/52157)
- Rust spend log row builder - [PR #52161](https://github.com/BerriAI/litellm/pull/52161)
- Rust spend log ledger writer - [PR #52163](https://github.com/BerriAI/litellm/pull/52163)
- Run the ledger's post-call spend counter step in rust - [PR #52166](https://github.com/BerriAI/litellm/pull/52166)
- Rust repositories for user, end user and budget auth objects - [PR #52170](https://github.com/BerriAI/litellm/pull/52170)
- Read virtual keys, jwt key mappings and model access groups through rust repositories - [PR #52173](https://github.com/BerriAI/litellm/pull/52173)
- Add typed agent evaluations (#52143) - [PR #52174](https://github.com/BerriAI/litellm/pull/52174)
- Read teams, team memberships and organizations through rust repositories - [PR #52176](https://github.com/BerriAI/litellm/pull/52176)
- Read projects, tags, access groups and object permissions through rust repositories - [PR #52178](https://github.com/BerriAI/litellm/pull/52178)
- Rust spend log callback - [PR #52182](https://github.com/BerriAI/litellm/pull/52182)
- Load the anthropic beta map only when a filter has a beta to filter - [PR #52188](https://github.com/BerriAI/litellm/pull/52188)
- Compare FOCUS RequesterDetails alias exactly after dropped-connection recovery - [PR #52198](https://github.com/BerriAI/litellm/pull/52198)
- Expect batch alias rows rewritten to the deployment model on model-routed uploads - [PR #52199](https://github.com/BerriAI/litellm/pull/52199)
- Run the owned security proxy in offline mode so the ECB rate lookup never leaves the rig - [PR #52202](https://github.com/BerriAI/litellm/pull/52202)
- Remove unused MCP, UI and management rust routes - [PR #52221](https://github.com/BerriAI/litellm/pull/52221)
- Resolve Redis and the database in their own crates and hand them to routes as axum state - [PR #52222](https://github.com/BerriAI/litellm/pull/52222)
- Port the proxy's middleware onto the native app - [PR #52223](https://github.com/BerriAI/litellm/pull/52223)
- Mark the cost tracking cases the reconciliation automation bills against the real provider - [PR #52226](https://github.com/BerriAI/litellm/pull/52226)
- Verify the LiteLLM license once at boot - [PR #52227](https://github.com/BerriAI/litellm/pull/52227)
- Serve one native app in both modes, answering a master key caller's /v1/messages with it in front of Python - [PR #52229](https://github.com/BerriAI/litellm/pull/52229)
- Reuse the shared session id reader and drop fresh restating comments - [PR #52250](https://github.com/BerriAI/litellm/pull/52250)
- Use a valid base64 Gemini signature fixture in replay tests - [PR #52311](https://github.com/BerriAI/litellm/pull/52311)
- Isolate global policy tests from the shared peer proxy - [PR #52318](https://github.com/BerriAI/litellm/pull/52318)
- Stop requiring safeguards calls to wait for the anthropic beta map - [PR #52329](https://github.com/BerriAI/litellm/pull/52329)
- Ignore picomatch GHSA-fc5q-39xc-vjpf for 7 days - [PR #52337](https://github.com/BerriAI/litellm/pull/52337)
- Mark anthropic cases for the cost tracking reconciliation automation - [PR #52358](https://github.com/BerriAI/litellm/pull/52358)
- Cover the prompt-management marker and vispark in the internal params wire walk - [PR #52363](https://github.com/BerriAI/litellm/pull/52363)
- Give the autorouter baseline Prisma client the rig's startup budget - [PR #52364](https://github.com/BerriAI/litellm/pull/52364)
- Coordinate congestion queues through Redis - [PR #52367](https://github.com/BerriAI/litellm/pull/52367)
- Expect the sse stream_format the proxy now sends for speech billing - [PR #52392](https://github.com/BerriAI/litellm/pull/52392)
- Large-body 400-user case and mixed-path memory soak for escaped regressions - [PR #52404](https://github.com/BerriAI/litellm/pull/52404)
- Recalibrate the overhead p50 ceilings after the #47790 header fix - [PR #52410](https://github.com/BerriAI/litellm/pull/52410)
- Snapshot logs after the denied request is recorded - [PR #52422](https://github.com/BerriAI/litellm/pull/52422)
- Cover adaptive thinking on tool turns under modify_params - [PR #52425](https://github.com/BerriAI/litellm/pull/52425)
- Back mapped jwt deployment profile cases with rust repository fakes - [PR #52442](https://github.com/BerriAI/litellm/pull/52442)
- Verify Projects license notice and page content - [PR #52454](https://github.com/BerriAI/litellm/pull/52454)
- Give responses_2rps its own overhead p50 ceiling - [PR #52459](https://github.com/BerriAI/litellm/pull/52459)
- Require the breaking-change marker only for evidenced breaks and live proof for LLM translation PRs - [PR #52465](https://github.com/BerriAI/litellm/pull/52465)
- Size team delete lock probes for the Prisma pool split - [PR #52481](https://github.com/BerriAI/litellm/pull/52481)
- Preserve single-object input through the completion bridge - [PR #52483](https://github.com/BerriAI/litellm/pull/52483)
- Size the concurrent first JWT call proxy for the Prisma pool split - [PR #52486](https://github.com/BerriAI/litellm/pull/52486)
- Clean up fresh tech debt from 2026-11-18 - [PR #52491](https://github.com/BerriAI/litellm/pull/52491)
- Hand the host to each routing call instead of keeping it on the router - [PR #52509](https://github.com/BerriAI/litellm/pull/52509)
- Delete router code nothing calls - [PR #52516](https://github.com/BerriAI/litellm/pull/52516)
- Size rig pools for the rust connection share and stop the router importing the proxy - [PR #52532](https://github.com/BerriAI/litellm/pull/52532)
- Relay SSE blocks without dropping a byte - [PR #52544](https://github.com/BerriAI/litellm/pull/52544)
- Stop running root entry limit on every PR - [PR #52579](https://github.com/BerriAI/litellm/pull/52579)
- Run a core set of unit, lint and smoke jobs on pull requests and the rest on main - [PR #52582](https://github.com/BerriAI/litellm/pull/52582)
- Add tier 1 cost tracking cases for gpt-6.2-sol, gpt-6.2-astra and azure_ai claude-opus-5-5 - [PR #52587](https://github.com/BerriAI/litellm/pull/52587)
- Split the core router unit job into three - [PR #52594](https://github.com/BerriAI/litellm/pull/52594)
- Give the group delete lock test two Prisma connections - [PR #52607](https://github.com/BerriAI/litellm/pull/52607)
- Run LiteLLM Rust DB on pushes to main only and cover release-line PRs - [PR #52609](https://github.com/BerriAI/litellm/pull/52609)
- Require live QA across shared translation routes - [PR #52631](https://github.com/BerriAI/litellm/pull/52631)
- Initialize JSON startup databases before capture - [PR #52650](https://github.com/BerriAI/litellm/pull/52650)
- Isolate the seeded roster per test - [PR #52652](https://github.com/BerriAI/litellm/pull/52652)
- Derive transcription charges from the cost map - [PR #52653](https://github.com/BerriAI/litellm/pull/52653)
- Fit the pull request gate into five minutes - [PR #52660](https://github.com/BerriAI/litellm/pull/52660)
- Rust repository for the spend logs window spend sum - [PR #52661](https://github.com/BerriAI/litellm/pull/52661)
- Stabilize the flaky prompt cache detector unit tests - [PR #52671](https://github.com/BerriAI/litellm/pull/52671)
- Move the rust pool refusal probe into a RefusalWatch behind a FailFastPool - [PR #52675](https://github.com/BerriAI/litellm/pull/52675)
- Seed fallback budgets in the Rust repository fake - [PR #52685](https://github.com/BerriAI/litellm/pull/52685)
- Recalibrate the small-body Postgres statement ceiling - [PR #52686](https://github.com/BerriAI/litellm/pull/52686)
- Expect bridged system prompts as input messages in tests #52599 left stale - [PR #52693](https://github.com/BerriAI/litellm/pull/52693)
- Expect the system prompt as the first Responses input message - [PR #52697](https://github.com/BerriAI/litellm/pull/52697)
- Avoid exhausting recursion in regex coverage - [PR #52706](https://github.com/BerriAI/litellm/pull/52706)
- Reuse Rust bridge builds across PR pushes and refresh the Cargo cache - [PR #52718](https://github.com/BerriAI/litellm/pull/52718)
- Split core-router and core-auth-spend shards - [PR #52719](https://github.com/BerriAI/litellm/pull/52719)
- Skip unit-core shards on test-only PRs - [PR #52720](https://github.com/BerriAI/litellm/pull/52720)
- Give each Lakera outage burst call its own prompt - [PR #52730](https://github.com/BerriAI/litellm/pull/52730)
- Integrate pod CPU windows so cpu_seconds_per_request stops under-reading - [PR #52735](https://github.com/BerriAI/litellm/pull/52735)
- Wait for the async upload failure report before checking it - [PR #52737](https://github.com/BerriAI/litellm/pull/52737)
- Pin the clock in the usage-based-v2 RPM pre-call test - [PR #52746](https://github.com/BerriAI/litellm/pull/52746)
- Bump litellm-enterprise 0.1.86 -&gt; 0.1.87, litellm-proxy-extras 0.4.117 -&gt; 0.4.119, litellm 1.111.0 -&gt; 1.112.0 - [PR #52748](https://github.com/BerriAI/litellm/pull/52748)
- Drain queued router accounting before comparing TPM sequences - [PR #52750](https://github.com/BerriAI/litellm/pull/52750)
- Use the production cache in auth fixtures - [PR #52754](https://github.com/BerriAI/litellm/pull/52754)
- Route jwt provisioning writes through rust repositories - [PR #52756](https://github.com/BerriAI/litellm/pull/52756)
- Price databricks system.ai.gpt-6-2-astra and gpt-6-2-sol from the Databricks DBU rates - [PR #52762](https://github.com/BerriAI/litellm/pull/52762)
- Match stored requests in the shared wire fixture - [PR #52765](https://github.com/BerriAI/litellm/pull/52765)
- Add jwt team members through the rust repository - [PR #52766](https://github.com/BerriAI/litellm/pull/52766)
- Clear 1146 basedpyright Any errors across 365 files - [PR #52768](https://github.com/BerriAI/litellm/pull/52768)
- Repair the unit tests failing on main's full run - [PR #52769](https://github.com/BerriAI/litellm/pull/52769)
- Reuse Rust bridge builds across PR pushes and refresh the Cargo cache (#52718) - [PR #52770](https://github.com/BerriAI/litellm/pull/52770)
- Expect cache fields in image usage - [PR #52777](https://github.com/BerriAI/litellm/pull/52777)
- Insert audit logs through the rust repository - [PR #52779](https://github.com/BerriAI/litellm/pull/52779)
- Add the StandardLoggingPayload types in rust - [PR #52783](https://github.com/BerriAI/litellm/pull/52783)
- Expect cache fields in gemini image edit usage - [PR #52798](https://github.com/BerriAI/litellm/pull/52798)
- Clean up fresh tech debt in the provider config loader and prompt helpers - [PR #52817](https://github.com/BerriAI/litellm/pull/52817)
- Read env-backed litellm_settings keys from LITELLM_&lt;KEY&gt; under config.yaml - [PR #52822](https://github.com/BerriAI/litellm/pull/52822)
- Move the Gemini Flash alias off the retired gemini-2.5-flash - [PR #52823](https://github.com/BerriAI/litellm/pull/52823)
- Name the keyspace in the JWT cache host calls - [PR #52830](https://github.com/BerriAI/litellm/pull/52830)
- Name each auth cache object with a typed key - [PR #52831](https://github.com/BerriAI/litellm/pull/52831)
- Name the Messages body fields once, on the request type - [PR #52836](https://github.com/BerriAI/litellm/pull/52836)
- Move RoutingStrategy and RoutingGroupSpec out of router-core - [PR #52847](https://github.com/BerriAI/litellm/pull/52847)
- Read null cached token counts as 0 in image usage - [PR #52857](https://github.com/BerriAI/litellm/pull/52857)
- Return a response for empty Invoke streams with complete_response - [PR #52862](https://github.com/BerriAI/litellm/pull/52862)
- Report unanswered RSS captures as probe incomplete, not worker death - [PR #52867](https://github.com/BerriAI/litellm/pull/52867)
- Add tier 1 cost tracking cases for azure gpt-6.2-sol and Mantle gpt-6.2-sol, gpt-6.2-astra and gpt-6.1-terra - [PR #52871](https://github.com/BerriAI/litellm/pull/52871)
- Align stored Responses bridge fixtures - [PR #52894](https://github.com/BerriAI/litellm/pull/52894)
- Include cache and margin fields in daily activity expectations - [PR #52897](https://github.com/BerriAI/litellm/pull/52897)
- Include cache and SVG fields in image routing fixture - [PR #52898](https://github.com/BerriAI/litellm/pull/52898)
- Skip gemini/genie-4 in the gemini tpm/rpm check - [PR #52900](https://github.com/BerriAI/litellm/pull/52900)
- Make the app association budget migration re-runnable - [PR #52909](https://github.com/BerriAI/litellm/pull/52909)
- Prove translation and cost fixes on every request shape - [PR #52911](https://github.com/BerriAI/litellm/pull/52911)
- Run the proxy-extras tests when a pull request touches proxy-extras - [PR #52917](https://github.com/BerriAI/litellm/pull/52917)
- Regenerate provider endpoints support - [PR #52918](https://github.com/BerriAI/litellm/pull/52918)
- Clear the two code-quality failures behind the stale provider file - [PR #52921](https://github.com/BerriAI/litellm/pull/52921)
- Remove unused agentSnippets from model hub - [PR #52931](https://github.com/BerriAI/litellm/pull/52931)
- Remove unused getCategories from compliance prompts - [PR #52932](https://github.com/BerriAI/litellm/pull/52932)
- Remove unused EndpointField from model hub parts - [PR #52933](https://github.com/BerriAI/litellm/pull/52933)
- Remove unused callback lookup helpers - [PR #52934](https://github.com/BerriAI/litellm/pull/52934)
- Remove unused validateToolDisplayName from MCP utils - [PR #52935](https://github.com/BerriAI/litellm/pull/52935)
- Keep the linear-scan test stable when the re cache is evicted - [PR #52940](https://github.com/BerriAI/litellm/pull/52940)
- Include cache and margin fields in the daily activity repository goldens - [PR #52944](https://github.com/BerriAI/litellm/pull/52944)
- Drain streaming logs before the next fallback test - [PR #52945](https://github.com/BerriAI/litellm/pull/52945)
- Build the key file version on Windows - [PR #52951](https://github.com/BerriAI/litellm/pull/52951)
- Record the bound on the org admin spend log filter - [PR #52961](https://github.com/BerriAI/litellm/pull/52961)
- Move the Claude Platform params next to AwsParams and VertexParams - [PR #52966](https://github.com/BerriAI/litellm/pull/52966)
- Ship the license public key in the litellm-proxy sdist - [PR #52970](https://github.com/BerriAI/litellm/pull/52970)
- Shrink zh-CN related test runs and write tests in English - [PR #52993](https://github.com/BerriAI/litellm/pull/52993)
- Serve the dynamic rate limiter's active teams from a native store - [PR #52995](https://github.com/BerriAI/litellm/pull/52995)
- Align scripted authentication with Rust routing - [PR #53001](https://github.com/BerriAI/litellm/pull/53001)
- Isolate native fallback cooldown state - [PR #53002](https://github.com/BerriAI/litellm/pull/53002)
- Run callbacks through one native stage around each inference call - [PR #53011](https://github.com/BerriAI/litellm/pull/53011)
- Expect soft budget duration in customer scopes - [PR #53017](https://github.com/BerriAI/litellm/pull/53017)
- Drop Redis-only fields from drained window spend - [PR #53022](https://github.com/BerriAI/litellm/pull/53022)
- Stop reverse proxies from buffering Rust SSE streams - [PR #53025](https://github.com/BerriAI/litellm/pull/53025)
- Read the api-key header ahead of x-api-key, as the proxy does - [PR #53026](https://github.com/BerriAI/litellm/pull/53026)
- Add databricks-gemini-nano-banana-2-1 - [PR #53027](https://github.com/BerriAI/litellm/pull/53027)
- Fix four flaky router and s3 log unit tests - [PR #53034](https://github.com/BerriAI/litellm/pull/53034)
- Await the WebSocket crash test without a deadline - [PR #53035](https://github.com/BerriAI/litellm/pull/53035)
- Drop narration comments added in the last day - [PR #53053](https://github.com/BerriAI/litellm/pull/53053)
- Name the customer app cache families as AuthObjects - [PR #53088](https://github.com/BerriAI/litellm/pull/53088)
- Remove databricks-gemini-nano-banana-2-1 until Databricks documents the endpoint - [PR #53108](https://github.com/BerriAI/litellm/pull/53108)
- Recalibrate the Postgres peak connection limit - [PR #53121](https://github.com/BerriAI/litellm/pull/53121)
- Regenerate provider endpoints support for Together AI speech - [PR #53124](https://github.com/BerriAI/litellm/pull/53124)
- Supply the usage cache in budget reset tests - [PR #53128](https://github.com/BerriAI/litellm/pull/53128)
- Assert both project cache eviction keys - [PR #53129](https://github.com/BerriAI/litellm/pull/53129)
- Place transcription sessions on both workers - [PR #53141](https://github.com/BerriAI/litellm/pull/53141)
- Bump litellm-enterprise 0.1.87 -&gt; 0.1.88, litellm-proxy-extras 0.4.119 -&gt; 0.4.120 - [PR #53143](https://github.com/BerriAI/litellm/pull/53143)
- Hold the JWT mapping insert the Rust repository now sends - [PR #53144](https://github.com/BerriAI/litellm/pull/53144)
- Import TypedDict from typing_extensions so the Lens proxy tests pass on Python 3.10 - [PR #53148](https://github.com/BerriAI/litellm/pull/53148) {/* keep-python-version */}
- Remove Postgres peak connection measurement - [PR #53154](https://github.com/BerriAI/litellm/pull/53154)
- Gate large-body case on response time and CPU with a loose client p50 ceiling - [PR #53155](https://github.com/BerriAI/litellm/pull/53155)
- Exempt the state and hook cache classes from the key family check - [PR #53157](https://github.com/BerriAI/litellm/pull/53157)
- Do not send Lens's own analysis calls back to Lens as traces - [PR #53158](https://github.com/BerriAI/litellm/pull/53158)
- Remove committed Lens review screenshots - [PR #53169](https://github.com/BerriAI/litellm/pull/53169)
- Stop a forged Authorization header from recording zero spend on an operator OAuth deployment - [PR #53170](https://github.com/BerriAI/litellm/pull/53170)
- Isolate exporter Prometheus counters - [PR #53172](https://github.com/BerriAI/litellm/pull/53172)
- Keep the Nova embedding transform_response a plain forwarder - [PR #53183](https://github.com/BerriAI/litellm/pull/53183)
- Verify streaming timeouts without wall-clock delays - [PR #53189](https://github.com/BerriAI/litellm/pull/53189)
- Add a conformance table and one layout, naming and order for messages configs - [PR #53199](https://github.com/BerriAI/litellm/pull/53199)
- Split the messages config into four parts and build the request in one pipeline - [PR #53203](https://github.com/BerriAI/litellm/pull/53203)
- Write anthropic-family configs as anthropic plus named host edits - [PR #53204](https://github.com/BerriAI/litellm/pull/53204)
- Wait on events instead of a one second deadline for closed socket rows - [PR #53228](https://github.com/BerriAI/litellm/pull/53228)
- Prove unlisted upload statuses are not retried from observed reports - [PR #53229](https://github.com/BerriAI/litellm/pull/53229)
- Give the tag update fake a database transaction - [PR #53230](https://github.com/BerriAI/litellm/pull/53230)
- Clear the code-quality failures on main - [PR #53237](https://github.com/BerriAI/litellm/pull/53237)
- Stop the Bedrock invoke outage test from assuming every cut-off stream is billed in full - [PR #53239](https://github.com/BerriAI/litellm/pull/53239)
- Declare GPT-Live and translation endpoints - [PR #53277](https://github.com/BerriAI/litellm/pull/53277)
- Accept the Live sessions route in the Rust catalog - [PR #53279](https://github.com/BerriAI/litellm/pull/53279)
- Read budget windows from the auth cache under the auth objects key family - [PR #53287](https://github.com/BerriAI/litellm/pull/53287)
- Regenerate the dashboard API types for reject_unregistered_guardrails - [PR #53289](https://github.com/BerriAI/litellm/pull/53289)
- Account for the ledger writer reserve - [PR #53293](https://github.com/BerriAI/litellm/pull/53293)
- Expect the CLI sign-in redirect - [PR #53294](https://github.com/BerriAI/litellm/pull/53294)
- Give the pin test's proxy_server stub the general settings reader - [PR #53295](https://github.com/BerriAI/litellm/pull/53295)
- Assert ledger callback counts apart from wire command order - [PR #53317](https://github.com/BerriAI/litellm/pull/53317)
- Measure only upload path allocations in the large upload rewrite test - [PR #53318](https://github.com/BerriAI/litellm/pull/53318)
- Stub realtime signing in the guardrail opt out test - [PR #53319](https://github.com/BerriAI/litellm/pull/53319)
- Serve inference routes through one driver that also reports them to the router - [PR #53324](https://github.com/BerriAI/litellm/pull/53324)
- Shape the cached virtual key in Rust and load it through one Python path - [PR #53325](https://github.com/BerriAI/litellm/pull/53325)
- Authenticate through the core and carry its caller - [PR #53342](https://github.com/BerriAI/litellm/pull/53342)
- Update two spend tests left stale by the rust spend log writer - [PR #53363](https://github.com/BerriAI/litellm/pull/53363)
- Remove the Lens spend log wiring that Lens 0.2.0 no longer uses - [PR #53380](https://github.com/BerriAI/litellm/pull/53380)
- Stop the MCP authorize login loop when the dashboard session key is dead - [PR #53383](https://github.com/BerriAI/litellm/pull/53383)
- Cover ResetData in the internal params chat route matrix - [PR #53398](https://github.com/BerriAI/litellm/pull/53398)
- Run the fast lint checks on pull requests again without compiling Rust - [PR #53421](https://github.com/BerriAI/litellm/pull/53421)
- Expect only the logs upload route to be retired on each component - [PR #53424](https://github.com/BerriAI/litellm/pull/53424)
- Type the cold storage helpers' spend log as a mapping - [PR #53430](https://github.com/BerriAI/litellm/pull/53430)
- Cover the logs handler now that the retired traces handler is gone - [PR #53433](https://github.com/BerriAI/litellm/pull/53433)
- Type the cold storage helpers with Mapping so ruff passes on main - [PR #53436](https://github.com/BerriAI/litellm/pull/53436)
- Stop key creation with per-model limits in an organization from returning 500 - [PR #53447](https://github.com/BerriAI/litellm/pull/53447)
- Move anthropic messages scalar helpers into python-compat - [PR #53456](https://github.com/BerriAI/litellm/pull/53456)
- Fix race in the Prometheus stored-credential 401 cell - [PR #53460](https://github.com/BerriAI/litellm/pull/53460)
- List the words the dashboard never translates - [PR #53467](https://github.com/BerriAI/litellm/pull/53467)
- Keep model capability flags in the cost map - [PR #53468](https://github.com/BerriAI/litellm/pull/53468)
- Drop function names from the cost map rule - [PR #53470](https://github.com/BerriAI/litellm/pull/53470)
- Assert ledger callback counts apart from wire command order in the remaining spend counter tests - [PR #53471](https://github.com/BerriAI/litellm/pull/53471)
- Expect the logs upload route to be retired and a keyless trace upload to answer 401 - [PR #53474](https://github.com/BerriAI/litellm/pull/53474)
- Move seven more pages onto the layout frame - [PR #53477](https://github.com/BerriAI/litellm/pull/53477)
- Mask a per-test verb so the elicitation guardrail cannot redact a neighbouring test - [PR #53479](https://github.com/BerriAI/litellm/pull/53479)
- Restore a PR's handwritten description when an edit resets it to the placeholder - [PR #53486](https://github.com/BerriAI/litellm/pull/53486)
- Let the dashboard layout draw the page frame - [PR #53496](https://github.com/BerriAI/litellm/pull/53496)
- Update OTLP upload tests and API types for the forwarding routes - [PR #53517](https://github.com/BerriAI/litellm/pull/53517)
- Seed the io token counter for both minutes a usage read can land in - [PR #53518](https://github.com/BerriAI/litellm/pull/53518)
- Wait for the held stream itself before sending the requests beside it - [PR #53519](https://github.com/BerriAI/litellm/pull/53519)
- Export Claude Code model call bodies by default - [PR #53520](https://github.com/BerriAI/litellm/pull/53520)
- Stop exporting Claude Code model call bodies by default (#53520) - [PR #53529](https://github.com/BerriAI/litellm/pull/53529)
- Expect a keyless log upload to answer 401 like a keyless trace upload - [PR #53530](https://github.com/BerriAI/litellm/pull/53530)
- Wait for a team block to reach the peer proxy before expecting a new team key to be refused - [PR #53532](https://github.com/BerriAI/litellm/pull/53532)
- Move seven full-height pages onto the layout frame - [PR #53536](https://github.com/BerriAI/litellm/pull/53536)
- Match the renamed Virtual Key and Admin labels in UI specs - [PR #53542](https://github.com/BerriAI/litellm/pull/53542)
- Expect only key-creating teams in the Create Key team dropdown - [PR #53543](https://github.com/BerriAI/litellm/pull/53543)
- Match the Skills Hub search placeholder - [PR #53544](https://github.com/BerriAI/litellm/pull/53544)
- Expect the Admin Settings heading on the admin page - [PR #53545](https://github.com/BerriAI/litellm/pull/53545)
- Expect the Models refresh action in the page header above the tabs - [PR #53549](https://github.com/BerriAI/litellm/pull/53549)
- Drop slop comments and string getattr from fresh code - [PR #53552](https://github.com/BerriAI/litellm/pull/53552)
- Fix three unit tests left red by the GPT-Live attach routes - [PR #53574](https://github.com/BerriAI/litellm/pull/53574)
- Expect the rollover guard in the budget update test - [PR #53575](https://github.com/BerriAI/litellm/pull/53575)
- Replace Unknown with proven types in 68 files - [PR #53642](https://github.com/BerriAI/litellm/pull/53642)
- Give the logger module one role and split it by concern - [PR #53690](https://github.com/BerriAI/litellm/pull/53690)
- Move the secret redactors out of the tracing crate - [PR #53709](https://github.com/BerriAI/litellm/pull/53709)
- Pick the Python logger for a Rust target in one place - [PR #53713](https://github.com/BerriAI/litellm/pull/53713)
- Drop the unused sink_layer and the log macro re-exports - [PR #53739](https://github.com/BerriAI/litellm/pull/53739)
- Type fresh dict returns and drop string getattr in team list membership - [PR #53771](https://github.com/BerriAI/litellm/pull/53771)
- Wait for the drop warning record before checking it - [PR #53842](https://github.com/BerriAI/litellm/pull/53842)
- Expect the default service tier on Vertex Gemini chat responses - [PR #53847](https://github.com/BerriAI/litellm/pull/53847)
- Walk the Perplexity Orchestrator chat route for internal params - [PR #53856](https://github.com/BerriAI/litellm/pull/53856)
- Drive the thinking signature retry with a foreign signed block - [PR #53874](https://github.com/BerriAI/litellm/pull/53874)
- Expect no output tokens on a /v1/messages attempt dropped before content - [PR #53885](https://github.com/BerriAI/litellm/pull/53885)
- Update stale integration and e2e expectations for intended changes - [PR #53940](https://github.com/BerriAI/litellm/pull/53940)
- Bill the deployment's custom pricing when the proxy pre-creates the logging object - [PR #53994](https://github.com/BerriAI/litellm/pull/53994)
- Convert Pydantic messages before async cache_control injection - [PR #54055](https://github.com/BerriAI/litellm/pull/54055)
- Bump versions on rc/1.112.0 - [PR #54114](https://github.com/BerriAI/litellm/pull/54114)
- Expect the Models refresh action on the tab row again (rc/1.112.0) - [PR #54206](https://github.com/BerriAI/litellm/pull/54206)

### PR roll-up by ownership area

PRs by ownership area (total: 760)

- Other: 267
- Models & Providers: 146
- UI: 76
- Performance: 68
- LLM API Endpoints: 59
- Spend / Budgets / Rate Limits: 49
- Auth & Management: 45
- Logging: 24
- Guardrails: 16
- MCP: 9
- Docs: 1

## New Contributors

- [@abesticode](https://github.com/abesticode) made their first contribution in [PR #51014](https://github.com/BerriAI/litellm/pull/51014)
- [@ANAMASGARD](https://github.com/ANAMASGARD) made their first contribution in [PR #52520](https://github.com/BerriAI/litellm/pull/52520)
- [@Ayushshuklai](https://github.com/Ayushshuklai) made their first contribution in [PR #52295](https://github.com/BerriAI/litellm/pull/52295)
- [@bofenghuang](https://github.com/bofenghuang) made their first contribution in [PR #51611](https://github.com/BerriAI/litellm/pull/51611)
- [@drweber](https://github.com/drweber) made their first contribution in [PR #48373](https://github.com/BerriAI/litellm/pull/48373)
- [@DucNgn](https://github.com/DucNgn) made their first contribution in [PR #52359](https://github.com/BerriAI/litellm/pull/52359)
- [@edvinsq](https://github.com/edvinsq) made their first contribution in [PR #53038](https://github.com/BerriAI/litellm/pull/53038)
- [@ellisc42](https://github.com/ellisc42) made their first contribution in [PR #53416](https://github.com/BerriAI/litellm/pull/53416)
- [@izzybn](https://github.com/izzybn) made their first contribution in [PR #53418](https://github.com/BerriAI/litellm/pull/53418)
- [@kabooboo](https://github.com/kabooboo) made their first contribution in [PR #46222](https://github.com/BerriAI/litellm/pull/46222)
- [@kirosvi](https://github.com/kirosvi) made their first contribution in [PR #44061](https://github.com/BerriAI/litellm/pull/44061)
- [@minhtuan-ne](https://github.com/minhtuan-ne) made their first contribution in [PR #49260](https://github.com/BerriAI/litellm/pull/49260)
- [@nicolasmota](https://github.com/nicolasmota) made their first contribution in [PR #51457](https://github.com/BerriAI/litellm/pull/51457)
- [@omarboukherys](https://github.com/omarboukherys) made their first contribution in [PR #49682](https://github.com/BerriAI/litellm/pull/49682)
- [@owen-hj](https://github.com/owen-hj) made their first contribution in [PR #53406](https://github.com/BerriAI/litellm/pull/53406)
- [@pradeep-ramola](https://github.com/pradeep-ramola) made their first contribution in [PR #43501](https://github.com/BerriAI/litellm/pull/43501)
- [@rhea-tk](https://github.com/rhea-tk) made their first contribution in [PR #53407](https://github.com/BerriAI/litellm/pull/53407)
- [@Shanmukh-l33t](https://github.com/Shanmukh-l33t) made their first contribution in [PR #52840](https://github.com/BerriAI/litellm/pull/52840)
- [@stanley-zhou](https://github.com/stanley-zhou) made their first contribution in [PR #50020](https://github.com/BerriAI/litellm/pull/50020)
- [@TheRealKraken](https://github.com/TheRealKraken) made their first contribution in [PR #50819](https://github.com/BerriAI/litellm/pull/50819)
- [@ULLAS-7](https://github.com/ULLAS-7) made their first contribution in [PR #52852](https://github.com/BerriAI/litellm/pull/52852)
- [@vansh-one](https://github.com/vansh-one) made their first contribution in [PR #41192](https://github.com/BerriAI/litellm/pull/41192)
- [@vikashmaddi-sarvam](https://github.com/vikashmaddi-sarvam) made their first contribution in [PR #52012](https://github.com/BerriAI/litellm/pull/52012)
- [@xinglan163](https://github.com/xinglan163) made their first contribution in [PR #51720](https://github.com/BerriAI/litellm/pull/51720)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.111.0-rc.3...v1.112.0-rc.1
