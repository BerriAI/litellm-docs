---
title: "1.104.0rc1 - Claude Opus 5.5, GPT-6, Master Key Enforcement & Team Routing Controls"
slug: "v1-104-0-rc-1"
date: 2026-09-27T08:02:58
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
docker.litellm.ai/berriai/litellm:1.104.0-rc.1
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.104.0rc1
```

</TabItem>
</Tabs>

The published GitHub tag is `v1.104.0-rc.1`. These notes compare it with `v1.103.0-rc.1`, the previous release candidate cut from `main`. Changes backported onto `rc/1.103.0` and already shipped in `v1.103.0` are omitted, and so are the three Usage page follow-ups built on the top-N key cap, which were reverted on `rc/1.104.0` before this tag so the Usage pages load every key the same way `v1.103.0` does

Customer-facing changes come first. Test, CI and internal changes are listed at the bottom

:::danger[Breaking Changes]

These callouts cover user-facing behavior that differs from `v1.103.0`, the latest stable release

**The proxy refuses to start with an unset, empty, or publicly known master key.** A deployment with no `LITELLM_MASTER_KEY`, an empty one, or `sk-1234` stops booting after the upgrade. The startup error names where the bad key came from and prints a command that generates a secure one. If the database holds values encrypted with the old key, also set `LITELLM_MIGRATE_FROM_MASTER_KEY` so the next boot re-encrypts them. To keep the old behavior on a local sandbox, set `LITELLM_DANGEROUSLY_PERMIT_WEAK_OR_UNSET_MASTER_KEY=true` or `general_settings.dangerously_permit_weak_or_unset_master_key: true`. See [PR #42019](https://github.com/BerriAI/litellm/pull/42019), [PR #42011](https://github.com/BerriAI/litellm/pull/42011)

**An exhausted budget now returns HTTP 422 instead of 429.** Clients stop treating a spent budget as a retryable rate limit. Real rpm/tpm limits still return 429. Set `litellm_settings.budget_exceeded_status_code: 429` to keep the old status. See [PR #42097](https://github.com/BerriAI/litellm/pull/42097)

:::

## Key Highlights

- **New frontier models on day one**: Claude Opus 5.5 across Anthropic, Bedrock, Vertex AI and Azure AI, and GPT-6 Sol and GPT-6 Luna across OpenAI, Bedrock and Azure Foundry, among 331 new catalog entries
- **New providers and routes**: Eden AI and Nadir providers, TinyFish, fal.ai queue and OpenRouter decisions pass-through routes, OpenAI models on Bedrock's native Responses API, and Claude on Bedrock Mantle's native Messages API
- **Gateway hardening**: the proxy refuses a weak or missing master key, dashboard sign-in adds breached-password detection and forced password resets, sessions are revoked on logout, and auth fails closed during a database outage
- **Routing controls**: group-scoped priority routing, time-windowed team reservation of deployments, native compact-to-fit across conversation APIs, a JEV classifier for the Auto Router, and configurable provider affinity headers
- **Admin UI**: the LiteAdmin assistant, prompt caching savings, internal-user savings and Auto Router usage, and Capability and Fuse v2 routing forecasts

## New Providers and Endpoints

### New Providers (2 new providers)

| Provider | Supported LiteLLM Endpoints | Description |
| --- | --- | --- |
| [Eden AI](../../docs/providers/edenai) | `/v1/chat/completions`, `/v1/responses`, `/v1/messages`, `/v1/embeddings`, audio, images, `/v1/videos` | Eden AI's unified API across chat, embeddings, audio, image and video models |
| [Nadir](../../docs/providers/nadir) | `/v1/chat/completions` | Nadir's `nadir/auto` router, with the cost Nadir reports recorded as the response cost |

### Expanded provider endpoint support

| Provider | Endpoint | What you can do |
| --- | --- | --- |
| [TinyFish](../../docs/pass_through/tinyfish) | `/tinyfish/*` | Run TinyFish Agent API automations through a pass-through route with per-step billing |
| [fal.ai](../../docs/providers/fal_ai) | `/fal_ai/*` | Submit and poll fal queue jobs through a pass-through route with spend tracking |
| [OpenRouter](../../docs/providers/openrouter) | `/openrouter/alpha/decisions` | Reach OpenRouter's decisions API through a pass-through route |
| [Amazon Bedrock](../../docs/providers/bedrock) | `/v1/responses` | Serve OpenAI models on bedrock-runtime's native Responses API |
| [Bedrock Mantle](../../docs/providers/bedrock_mantle) | `/v1/messages` | Serve Claude models on Mantle's native Anthropic Messages API |
| [Vertex AI](../../docs/providers/vertex_batch) | `/v1/files`, `/v1/batches` | Submit native Vertex batch JSONL with cost tracking |

## New Models / Updated Models

#### New Model Support (331 new models)

Counts represent new catalog identifiers, including aliases and regional variants. Prices below are the values bundled in this release, in USD; runtime pricing-map reloads can update them. Input and output columns show base token rates; long-context, cache, image-token, and other specialized rates depend on the model

| Provider | Model | Context Window | Input ($/1M tokens) | Output ($/1M tokens) | Features / special pricing |
| --- | --- | --- | --- | --- | --- |
| Amazon Bedrock | `anthropic.claude-mythos-5-1` | 1,000,000 | $10 | $50 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `anthropic.claude-opus-5-5` | 1,000,000 | $4 | $20 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `apac.anthropic.claude-fable-5` | 1,000,000 | $11 | $55 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `apac.anthropic.claude-mythos-preview` | 1,000,000 | $27.5 | $137.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching |
| Amazon Bedrock | `apac.anthropic.claude-opus-4-7` | 1,000,000 | $5.5 | $27.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `apac.anthropic.claude-opus-4-8` | 1,000,000 | $5.5 | $27.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `apac.anthropic.claude-opus-5` | 1,000,000 | $5.5 | $27.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `apac.anthropic.claude-opus-5-5` | 1,000,000 | $4.4 | $22 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `apac.anthropic.claude-sonnet-4-6` | 1,000,000 | $3.3 | $16.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `apac.anthropic.claude-sonnet-5` | 1,000,000 | $2.2 | $11 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `au.anthropic.claude-fable-5` | 1,000,000 | $11 | $55 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `au.anthropic.claude-mythos-preview` | 1,000,000 | $27.5 | $137.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching |
| Amazon Bedrock | `au.anthropic.claude-opus-5-5` | 1,000,000 | $4.4 | $22 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `bedrock/ap-northeast-1/qwen.qwen3-next-80b-a3b` | 128,000 | $0.18 | $1.45 | Chat; Tool calling; Structured output |
| Amazon Bedrock | `bedrock/ap-south-1/qwen.qwen3-next-80b-a3b` | 128,000 | $0.18 | $1.41 | Chat; Tool calling; Structured output |
| Amazon Bedrock | `bedrock/ap-southeast-2/qwen.qwen3-next-80b-a3b` | 128,000 | $0.1545 | $1.236 | Chat; Tool calling; Structured output |
| Amazon Bedrock | `bedrock/eu-west-1/qwen.qwen3-next-80b-a3b` | 128,000 | $0.18 | $1.41 | Chat; Tool calling; Structured output |
| Amazon Bedrock | `bedrock/eu-west-2/nvidia.nemotron-super-3-120b` | 256,000 | $0.23 | $1.01 | Chat; Reasoning; Tool calling; Structured output |
| Amazon Bedrock | `bedrock/eu-west-2/qwen.qwen3-next-80b-a3b` | 128,000 | $0.23 | $1.86 | Chat; Tool calling; Structured output |
| Amazon Bedrock | `bedrock/sa-east-1/qwen.qwen3-next-80b-a3b` | 128,000 | $0.18 | $1.45 | Chat; Tool calling; Structured output |
| Amazon Bedrock | `bedrock/us-gov-east-1/anthropic.claude-opus-5-5` | 1,000,000 | $4.8 | $24 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `bedrock/us-gov-west-1/anthropic.claude-opus-5-5` | 1,000,000 | $4.8 | $24 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `deepseek.r1-v1:0` | 128,000 | $1.35 | $5.4 | Chat; Reasoning |
| Amazon Bedrock | `eu.anthropic.claude-opus-5-5` | 1,000,000 | $4.4 | $22 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `global.anthropic.claude-mythos-5-1` | 1,000,000 | $10 | $50 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `global.anthropic.claude-opus-5-5` | 1,000,000 | $4 | $20 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `global.moonshotai.kimi-k3` | 1,000,000 | $3 | $15 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Amazon Bedrock | `global.openai.gpt-5.4` | 1,000,000 | $2.5 | $15 | Chat; Reasoning; Vision; Tool calling |
| Amazon Bedrock | `global.openai.gpt-5.5` | 1,000,000 | $5 | $30 | Chat; Reasoning; Vision; Tool calling |
| Amazon Bedrock | `global.openai.gpt-6-luna` | 1,050,000 | $0.1 | $0.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching |
| Amazon Bedrock | `global.openai.gpt-6-sol` | 1,050,000 | $2 | $10 | Chat; Reasoning; Vision; Tool calling; Prompt caching |
| Amazon Bedrock | `jp.anthropic.claude-opus-5-5` | 1,000,000 | $4.4 | $22 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `mistral.pixtral-large-2502-v1:0` | 128,000 | $2 | $6 | Chat; Tool calling |
| Amazon Bedrock | `moonshotai.kimi-k3` | 1,000,000 | $3 | $15 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Amazon Bedrock | `openai.gpt-6-luna` | 1,050,000 | $0.1 | $0.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching |
| Amazon Bedrock | `openai.gpt-6-sol` | 1,050,000 | $2 | $10 | Chat; Reasoning; Vision; Tool calling; Prompt caching |
| Amazon Bedrock | `us-gov.anthropic.claude-opus-5-5` | 1,000,000 | $4.8 | $24 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `us.anthropic.claude-mythos-5` | 1,000,000 | $11 | $55 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `us.anthropic.claude-mythos-5-1` | 1,000,000 | $11 | $55 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `us.anthropic.claude-mythos-preview` | 1,000,000 | $27.5 | $137.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching |
| Amazon Bedrock | `us.anthropic.claude-opus-5-5` | 1,000,000 | $4.4 | $22 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `us.moonshotai.kimi-k3` | 1,000,000 | $3.3 | $16.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Amazon Bedrock | `us.openai.gpt-5.4` | 1,000,000 | $2.75 | $16.5 | Chat; Reasoning; Vision; Tool calling |
| Amazon Bedrock | `us.openai.gpt-5.5` | 1,000,000 | $5.5 | $33 | Chat; Reasoning; Vision; Tool calling |
| Amazon Bedrock | `us.openai.gpt-6-luna` | 1,050,000 | $0.11 | $0.55 | Chat; Reasoning; Vision; Tool calling; Prompt caching |
| Amazon Bedrock | `us.openai.gpt-6-sol` | 1,050,000 | $2.2 | $11 | Chat; Reasoning; Vision; Tool calling; Prompt caching |
| Anthropic | `claude-opus-5-5` | 1,000,000 | $4 | $20 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Azure AI | `azure_ai/Cohere-command-a-plus-05-2026` | 128,000 | $0.8 | $3.2 | Chat; Reasoning; Tool calling |
| Azure AI | `azure_ai/FW-DeepSeek-V4-Flash` | 1,000,000 | $0.15 | $0.31 | Chat; Reasoning; Tool calling; Prompt caching |
| Azure AI | `azure_ai/FW-DeepSeek-V4.1-Flash` | 1,000,000 | $0.375 | $1.5 | Chat; Reasoning; Tool calling; Prompt caching |
| Azure AI | `azure_ai/FW-GLM-5.3` | 1,048,576 | $1.75 | $5.5 | Chat; Reasoning; Tool calling; Prompt caching |
| Azure AI | `azure_ai/FW-GLM-5.3-Flash` | 1,048,576 | $0.188 | $0.625 | Chat; Reasoning; Tool calling; Prompt caching |
| Azure AI | `azure_ai/FW-GPT-OSS-120B` | 131,072 | $0.165 | $0.66 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Azure AI | `azure_ai/MAI-Image-2.5-Pro` | - | $5 | - | Image generation |
| Azure AI | `azure_ai/MAI-Image-2.6` | - | $5 | - | Image generation |
| Azure AI | `azure_ai/MAI-Image-2.6-Flash` | - | $1.75 | - | Image generation |
| Azure AI | `azure_ai/claude-opus-5-5` | 1,000,000 | $4 | $20 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Azure AI | `azure_ai/deepseek-v4.1-flash` | 1,000,000 | $0.375 | $1.5 | Chat; Reasoning; Tool calling; Prompt caching |
| Azure AI | `azure_ai/gpt-6-luna` | 922,000 | $0.1 | $0.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; Computer use |
| Azure AI | `azure_ai/gpt-6-sol` | 922,000 | $2 | $10 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; Computer use |
| Azure AI | `azure_ai/gpt-image-2` | - | $5 | - | Image generation; Vision |
| Azure AI | `azure_ai/mistral-medium-3-5` | 128,000 | $1.5 | $7.5 | Chat; Vision; Structured output |
| Azure AI | `azure_ai/muse-spark-1.3` | 1,048,576 | $1.25 | $4.25 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Azure OpenAI | `azure/eu/gpt-6-luna` | 922,000 | $0.12 | $0.6 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; Computer use |
| Azure OpenAI | `azure/eu/gpt-6-sol` | 922,000 | $2.4 | $12 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; Computer use |
| Azure OpenAI | `azure/gpt-6-luna` | 922,000 | $0.1 | $0.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; Computer use |
| Azure OpenAI | `azure/gpt-6-luna-2026-09-22` | 922,000 | $0.1 | $0.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; Computer use |
| Azure OpenAI | `azure/gpt-6-sol` | 922,000 | $2 | $10 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; Computer use |
| Azure OpenAI | `azure/gpt-6-sol-2026-09-22` | 922,000 | $2 | $10 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; Computer use |
| Azure OpenAI | `azure/gpt-audio` | 128,000 | $2.5 | $10 | Chat; Tool calling |
| Azure OpenAI | `azure/gpt-audio-1.5` | 128,000 | $2.5 | $10 | Chat; Tool calling |
| Azure OpenAI | `azure/gpt-live-1` | - | - | - | Realtime; Tool calling; Audio input; `input_cost_per_second`: $0.00083333 |
| Azure OpenAI | `azure/gpt-live-transcribe` | 32,000 | - | - | Transcription; Audio input; `input_cost_per_second`: $0.00028333 |
| Azure OpenAI | `azure/gpt-realtime` | 32,000 | $4 | $16 | Realtime; Tool calling; Audio input |
| Azure OpenAI | `azure/gpt-realtime-1.5` | 32,000 | $4 | $16 | Realtime; Tool calling; Audio input |
| Azure OpenAI | `azure/gpt-realtime-translate` | 32,000 | - | - | Realtime; Audio input; `input_cost_per_second`: $0.00056667 |
| Azure OpenAI | `azure/gpt-transcribe` | - | - | - | Transcription; Audio input; `input_cost_per_second`: $0.000075 |
| Azure OpenAI | `azure/us/gpt-6-luna` | 922,000 | $0.11 | $0.55 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; Computer use |
| Azure OpenAI | `azure/us/gpt-6-sol` | 922,000 | $2.2 | $11 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; Computer use |
| Baseten | `baseten/deepseek-ai/DeepSeek-V4-Flash-0731` | 1,048,576 | $0.13 | $0.26 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Baseten | `baseten/deepseek-ai/DeepSeek-V4-Pro` | 1,048,576 | $1.74 | $3.48 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Baseten | `baseten/deepseek-ai/DeepSeek-V4-Pro-0813` | 1,048,576 | $1.32 | $3.96 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Baseten | `baseten/deepseek-ai/DeepSeek-V4.1-Flash` | 1,048,576 | $0.3 | $1.2 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Baseten | `baseten/moonshotai/Kimi-K2.6` | 262,000 | $0.95 | $4 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Baseten | `baseten/moonshotai/Kimi-K2.7-Code` | 262,000 | $0.95 | $4 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Baseten | `baseten/moonshotai/Kimi-K3` | 1,048,576 | $3 | $15 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Baseten | `baseten/nvidia/NVIDIA-Nemotron-3-Ultra-550B-A55B` | 202,800 | $0.6 | $2.4 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Baseten | `baseten/thinkingmachines/inkling` | 1,048,576 | $1 | $4.05 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Baseten | `baseten/thinkingmachines/inkling-small` | 1,048,576 | $0.5 | $1.2 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Baseten | `baseten/zai-org/GLM-5.2` | 1,048,576 | $1.4 | $4.4 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Baseten | `baseten/zai-org/GLM-5.2-Fast` | 1,048,576 | $2.1 | $6.6 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Baseten | `baseten/zai-org/GLM-5.3-Fast` | 1,048,576 | $2.1 | $6.6 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Baseten | `baseten/zai-org/GLM-5.3-Flash` | 1,048,576 | $0.15 | $0.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Bedrock Mantle | `bedrock_mantle/anthropic.claude-haiku-4-5` | 200,000 | $1 | $5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Bedrock Mantle | `bedrock_mantle/deepseek.v3.1` | 128,000 | $0.58 | $1.68 | Chat; Tool calling |
| Bedrock Mantle | `bedrock_mantle/moonshotai.kimi-k2-thinking` | 256,000 | $0.6 | $2.5 | Chat; Reasoning; Tool calling |
| Bedrock Mantle | `bedrock_mantle/openai.gpt-6-luna` | 1,050,000 | $0.11 | $0.55 | Responses; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Bedrock Mantle | `bedrock_mantle/openai.gpt-6-sol` | 1,050,000 | $2.2 | $11 | Responses; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Bedrock Mantle | `bedrock_mantle/qwen.qwen3-235b-a22b-2507` | 256,000 | $0.22 | $0.88 | Chat; Reasoning; Tool calling |
| Bedrock Mantle | `bedrock_mantle/qwen.qwen3-32b` | 32,000 | $0.15 | $0.6 | Chat; Reasoning; Tool calling |
| Bedrock Mantle | `bedrock_mantle/qwen.qwen3-coder-30b-a3b-instruct` | 256,000 | $0.15 | $0.6 | Chat; Tool calling |
| Bedrock Mantle | `bedrock_mantle/qwen.qwen3-coder-480b-a35b-instruct` | 128,000 | $0.45 | $1.8 | Chat; Tool calling |
| Bedrock Mantle | `bedrock_mantle/qwen.qwen3-next-80b-a3b-instruct` | 256,000 | $0.14 | $1.2 | Chat; Reasoning; Tool calling |
| Bedrock Mantle | `bedrock_mantle/qwen.qwen3-vl-235b-a22b-instruct` | 256,000 | $0.53 | $2.66 | Chat; Vision; Tool calling |
| Cohere | `c4ai-aya-expanse-32b` | 128,000 | $0.5 | $1.5 | Chat |
| Fireworks AI | `fireworks_ai/accounts/fireworks/models/ember-1` | 1,048,576 | $3 | $15 | Chat; Reasoning; Vision; Tool calling; Structured output |
| Fireworks AI | `fireworks_ai/accounts/fireworks/routers/deepseek-v4p1-flash-us` | 1,048,576 | $0.45 | $1.8 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Fireworks AI | `fireworks_ai/accounts/fireworks/routers/glm-5p3-flash-us` | 1,048,576 | $0.225 | $0.75 | Chat; Vision; Tool calling; Structured output |
| Fireworks AI | `fireworks_ai/accounts/fireworks/routers/glm-5p3-us` | 1,048,576 | $2.1 | $6.6 | Chat; Reasoning; Tool calling; Structured output |
| Fireworks AI | `fireworks_ai/deepseek-v4-pro-0813` | 1,048,576 | $1.32 | $3.96 | Chat; Reasoning; Tool calling; Structured output |
| Fireworks AI | `fireworks_ai/deepseek-v4p1-flash-us` | 1,048,576 | $0.45 | $1.8 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Fireworks AI | `fireworks_ai/glm-5p3` | 1,048,576 | $1.4 | $4.4 | Chat; Reasoning; Tool calling; Structured output |
| Fireworks AI | `fireworks_ai/glm-5p3-flash` | 1,048,576 | $0.15 | $0.5 | Chat; Vision; Tool calling; Structured output |
| Fireworks AI | `fireworks_ai/glm-5p3-flash-us` | 1,048,576 | $0.225 | $0.75 | Chat; Vision; Tool calling; Structured output |
| Fireworks AI | `fireworks_ai/glm-5p3-us` | 1,048,576 | $2.1 | $6.6 | Chat; Reasoning; Tool calling; Structured output |
| Gemini | `gemini/deep-research-max-preview-04-2026` | 131,072 | $2 | $12 | Chat; Vision; Web search |
| Gemini | `gemini/deep-research-preview-04-2026` | 131,072 | $2 | $12 | Chat; Vision; Web search |
| Gemini | `gemini/gemini-3.8-flash-lite-tts` | 8,192 | $0.5 | $6 | Speech |
| Gemini | `gemini/gemini-3.8-flash-tts` | 8,192 | $0.5 | $9 | Speech |
| Gemini | `gemini/lyria-realtime-exp` | 1,048,576 | $0 | $0 | Chat |
| Groq | `groq/llama-guard-3-8b` | 8,192 | $0.2 | $0.2 | Chat |
| Nebius | `nebius/deepseek-ai/DeepSeek-V4.1-Flash` | 1,048,576 | $0.3 | $1.2 | Chat; Vision |
| OpenAI | `gpt-6-luna` | 922,000 | $0.1 | $0.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; Computer use |
| OpenAI | `gpt-6-sol` | 922,000 | $2 | $10 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; Computer use |
| OpenRouter | `openrouter/aion-labs/aion-3.5` | 262,144 | $3 | $6 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| OpenRouter | `openrouter/aion-labs/aion-3.5-mini` | 262,144 | $0.7 | $1.4 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| OpenRouter | `openrouter/anthropic/claude-opus-5.5` | 1,000,000 | $4 | $20 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/anthropic/claude-opus-5.5:batch` | 1,000,000 | $2 | $10 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/cohere/command-a-plus` | 192,000 | $0.3 | $1.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| OpenRouter | `openrouter/deepseek/deepseek-v4.1-flash:batch` | 1,048,576 | $0.112 | $0.336 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| OpenRouter | `openrouter/fireworks/ember-1` | 1,048,576 | $3 | $15 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| OpenRouter | `openrouter/nex-agi/nex-n2.5-mini` | 262,144 | $0.025 | $0.1 | Chat; Reasoning; Vision; Prompt caching; Structured output |
| OpenRouter | `openrouter/nex-agi/nex-n2.5-pro` | 262,144 | $0.075 | $0.25 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| OpenRouter | `openrouter/openai/gpt-6-luna` | 1,050,000 | $0.1 | $0.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/openai/gpt-6-luna-pro` | 1,050,000 | $0.1 | $0.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/openai/gpt-6-luna-pro:batch` | 1,050,000 | $0.05 | $0.25 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/openai/gpt-6-luna:batch` | 1,050,000 | $0.05 | $0.25 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/openai/gpt-6-sol` | 1,050,000 | $2 | $10 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/openai/gpt-6-sol-pro` | 1,050,000 | $2 | $10 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/openai/gpt-6-sol-pro:batch` | 1,050,000 | $1 | $5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/openai/gpt-6-sol:batch` | 1,050,000 | $1 | $5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/openai/gpt-oss-20b:batch` | 131,072 | $0.024 | $0.112 | Chat; Reasoning; Tool calling; Structured output |
| OpenRouter | `openrouter/perceptron/perceptron-mk1.5` | 36,864 | $0.15 | $1.5 | Chat; Reasoning; Vision; Tool calling; Structured output; Audio input; Video input |
| OpenRouter | `openrouter/qwen/qwen3.8-max-prime` | 1,000,000 | $4 | $12 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Video input |
| OpenRouter | `openrouter/qwen/qwen3.8-omni-flash` | 1,000,000 | $0.15 | $0.47 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Audio input |
| OpenRouter | `openrouter/stealth/space-bunny-alpha` | 1,000,000 | $0 | $0 | Chat; Reasoning; Vision; Tool calling; Video input |
| OpenRouter | `openrouter/typesafe/jev-1.13` | 32,000 | $0.042 | $0 | evaluation |
| OpenRouter | `openrouter/upstage/solar-mini4` | 524,288 | $0.05 | $0.2 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| OpenRouter | `openrouter/x-ai/grok-4.7` | 500,000 | $1.6 | $4.8 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/xiaomi/mimo-v2.6-flash` | 1,048,576 | $0.14 | $0.28 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Audio input |
| OpenRouter | `openrouter/xiaomi/mimo-v2.6-pro` | 1,048,576 | $0.435 | $0.87 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Audio input |
| OpenRouter | `openrouter/xiaomi/mimo-v2.6-pro-ultraspeed` | 1,048,576 | $4.35 | $8.7 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Audio input |
| OpenRouter | `openrouter/z-ai/glm-5.3-prime` | 1,000,000 | $2.8 | $8.8 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Together AI | `together_ai/together/Tev1-4B-experimental` | 32,768 | $0.042 | $0 | Chat |
| Vertex AI | `gemini-3.8-flash-cyber` | 1,048,576 | $1.5 | $7.5 | Chat; Reasoning; Vision; Prompt caching; Structured output; PDF input; Audio input; Video input |
| Vertex AI | `vertex_ai/chirp_2` | - | - | - | Transcription; `input_cost_per_second`: $0.00026667 |
| Vertex AI | `vertex_ai/claude-opus-5-5` | 1,000,000 | $4 | $20 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Vertex AI | `vertex_ai/claude-opus-5-5@default` | 1,000,000 | $4 | $20 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Vertex AI | `vertex_ai/gemini-2.0-flash` | - | $0.15 | $0.6 | Chat |
| Vertex AI | `vertex_ai/gemini-2.0-flash-lite` | - | $0.075 | $0.3 | Chat |
| Vertex AI | `vertex_ai/gemini-2.5-flash-tts` | - | $0.5 | $10 | Speech |
| Vertex AI | `vertex_ai/gemini-2.5-pro-tts` | - | $1 | $20 | Speech |
| Vertex AI | `vertex_ai/gemini-3.8-flash-cyber` | 1,048,576 | $1.5 | $7.5 | Chat; Reasoning; Vision; Prompt caching; Structured output; PDF input; Audio input; Video input |
| Vertex AI | `vertex_ai/gemini-3.8-live` | 131,072 | $0.75 | $4.5 | Realtime; Vision; Tool calling; Web search; Audio input |
| Vertex AI | `vertex_ai/gemini-omni-1.1-flash-preview` | 57,920 | $1.5 | $9 | Chat; Reasoning; Vision; Video input |
| Vertex AI | `vertex_ai/meta/llama-3.3-70b-instruct-maas` | 128,000 | $0.72 | $0.72 | Chat; Tool calling |
| Vertex AI | `vertex_ai/virtual-try-on-001` | - | - | - | Image generation; `output_cost_per_image`: $0.06 |
| Vertex AI | `vertex_ai/zai-org/glm-5.2-maas` | 1,000,000 | $1.4 | $4.4 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Weights & Biases | `wandb/deepseek-ai/DeepSeek-V4.1-Flash` | 1,049,000 | $0.2 | $0.65 | Chat; Reasoning; Vision; Prompt caching |
| Weights & Biases | `wandb/google/gemma-4-26B-A4B-it` | 262,000 | $0.1 | $0.3 | Chat; Reasoning; Vision; Tool calling; Prompt caching |
| Xiaomi MiMo | `xiaomi_mimo/mimo-v2.6-flash` | 1,048,576 | $0.14 | $0.28 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Audio input; Video input |
| Xiaomi MiMo | `xiaomi_mimo/mimo-v2.6-pro` | 1,048,576 | $0.435 | $0.87 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Audio input; Video input |
| fal.ai | `fal_ai/bytedance/seedance-2.0/image-to-video` | - | - | - | Video generation; `output_cost_per_second`: $0.3034; `output_cost_per_second_480p`: $0.1346; `output_cost_per_second_720p`: $0.3034 |
| fal.ai | `fal_ai/bytedance/seedance-2.0/reference-to-video` | - | - | - | Video generation; `output_cost_per_second`: $0.3034; `output_cost_per_second_480p`: $0.1346; `output_cost_per_second_720p`: $0.3034 |
| fal.ai | `fal_ai/bytedance/seedance-2.0/text-to-video` | - | - | - | Video generation; `output_cost_per_second`: $0.3034; `output_cost_per_second_480p`: $0.1346; `output_cost_per_second_720p`: $0.3034 |
| fal.ai | `fal_ai/bytedance/seedance-2.5/image-to-video` | - | - | - | Video generation; `output_cost_per_second`: $0.473; `output_cost_per_second_480p`: $0.2205; `output_cost_per_second_720p`: $0.473 |
| fal.ai | `fal_ai/bytedance/seedance-2.5/reference-to-video` | - | - | - | Video generation; `output_cost_per_second`: $0.473; `output_cost_per_second_480p`: $0.2205; `output_cost_per_second_720p`: $0.473 |
| fal.ai | `fal_ai/bytedance/seedance-2.5/text-to-video` | - | - | - | Video generation; `output_cost_per_second`: $0.473; `output_cost_per_second_480p`: $0.2205; `output_cost_per_second_720p`: $0.473 |
| fal.ai | `fal_ai/fal-ai/flux-lora-depth` | - | - | - | Image generation; `output_cost_per_image`: $0.035; `output_cost_per_pixel`: $0.00000003 |
| fal.ai | `fal_ai/fal-ai/flux/dev` | - | - | - | Image generation; `output_cost_per_image`: $0.025; `output_cost_per_pixel`: $0.00000002 |
| fal.ai | `fal_ai/fal-ai/moondream3-preview/query` | - | $0.4 | $3.5 | Chat; Reasoning; Vision |
| fal.ai | `fal_ai/fal-ai/nano-banana-2` | - | - | - | Image generation; `output_cost_per_image`: $0.08; `output_cost_per_image_0.5K`: $0.06; `output_cost_per_image_1K`: $0.08 |
| fal.ai | `fal_ai/fal-ai/nano-banana-pro` | - | - | - | Image generation; `output_cost_per_image`: $0.15; `output_cost_per_image_1K`: $0.15; `output_cost_per_image_2K`: $0.15 |
| fal.ai | `fal_ai/fal-ai/trellis` | - | - | - | Image generation; `output_cost_per_image`: $0.02 |
| fal.ai | `fal_ai/fal-ai/trellis-2` | - | - | - | Image generation; `output_cost_per_image`: $0.3; `output_cost_per_image_512`: $0.25; `output_cost_per_image_1024`: $0.3 |
| fal.ai | `fal_ai/high/1024-x-1024/openai/gpt-image-2.5/flare/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.05268 |
| fal.ai | `fal_ai/high/1024-x-1024/openai/gpt-image-2.5/flare/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.05268 |
| fal.ai | `fal_ai/high/1024-x-1024/openai/gpt-image-2.5/sunburst/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.05268 |
| fal.ai | `fal_ai/high/1024-x-1024/openai/gpt-image-2.5/sunburst/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.05268 |
| fal.ai | `fal_ai/high/1024-x-1536/openai/gpt-image-2.5/flare/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.04116 |
| fal.ai | `fal_ai/high/1024-x-1536/openai/gpt-image-2.5/flare/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.04116 |
| fal.ai | `fal_ai/high/1024-x-1536/openai/gpt-image-2.5/sunburst/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.04116 |
| fal.ai | `fal_ai/high/1024-x-1536/openai/gpt-image-2.5/sunburst/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.04116 |
| fal.ai | `fal_ai/high/1024-x-768/openai/gpt-image-2.5/flare/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.03612 |
| fal.ai | `fal_ai/high/1024-x-768/openai/gpt-image-2.5/flare/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.03612 |
| fal.ai | `fal_ai/high/1024-x-768/openai/gpt-image-2.5/sunburst/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.03612 |
| fal.ai | `fal_ai/high/1024-x-768/openai/gpt-image-2.5/sunburst/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.03612 |
| fal.ai | `fal_ai/high/1920-x-1080/openai/gpt-image-2.5/flare/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.0396 |
| fal.ai | `fal_ai/high/1920-x-1080/openai/gpt-image-2.5/flare/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.0396 |
| fal.ai | `fal_ai/high/1920-x-1080/openai/gpt-image-2.5/sunburst/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.0396 |
| fal.ai | `fal_ai/high/1920-x-1080/openai/gpt-image-2.5/sunburst/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.0396 |
| fal.ai | `fal_ai/high/2560-x-1440/openai/gpt-image-2.5/flare/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.05529 |
| fal.ai | `fal_ai/high/2560-x-1440/openai/gpt-image-2.5/flare/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.05529 |
| fal.ai | `fal_ai/high/2560-x-1440/openai/gpt-image-2.5/sunburst/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.05529 |
| fal.ai | `fal_ai/high/2560-x-1440/openai/gpt-image-2.5/sunburst/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.05529 |
| fal.ai | `fal_ai/high/3840-x-2160/openai/gpt-image-2.5/flare/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.10008 |
| fal.ai | `fal_ai/high/3840-x-2160/openai/gpt-image-2.5/flare/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.10008 |
| fal.ai | `fal_ai/high/3840-x-2160/openai/gpt-image-2.5/sunburst/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.10008 |
| fal.ai | `fal_ai/high/3840-x-2160/openai/gpt-image-2.5/sunburst/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.10008 |
| fal.ai | `fal_ai/low/1024-x-1024/openai/gpt-image-2.5/flare/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.00588 |
| fal.ai | `fal_ai/low/1024-x-1024/openai/gpt-image-2.5/flare/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.00588 |
| fal.ai | `fal_ai/low/1024-x-1024/openai/gpt-image-2.5/sunburst/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.00588 |
| fal.ai | `fal_ai/low/1024-x-1024/openai/gpt-image-2.5/sunburst/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.00588 |
| fal.ai | `fal_ai/low/1024-x-1536/openai/gpt-image-2.5/flare/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.00474 |
| fal.ai | `fal_ai/low/1024-x-1536/openai/gpt-image-2.5/flare/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.00474 |
| fal.ai | `fal_ai/low/1024-x-1536/openai/gpt-image-2.5/sunburst/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.00474 |
| fal.ai | `fal_ai/low/1024-x-1536/openai/gpt-image-2.5/sunburst/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.00474 |
| fal.ai | `fal_ai/low/1024-x-768/openai/gpt-image-2.5/flare/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.00402 |
| fal.ai | `fal_ai/low/1024-x-768/openai/gpt-image-2.5/flare/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.00402 |
| fal.ai | `fal_ai/low/1024-x-768/openai/gpt-image-2.5/sunburst/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.00402 |
| fal.ai | `fal_ai/low/1024-x-768/openai/gpt-image-2.5/sunburst/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.00402 |
| fal.ai | `fal_ai/low/1920-x-1080/openai/gpt-image-2.5/flare/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.00441 |
| fal.ai | `fal_ai/low/1920-x-1080/openai/gpt-image-2.5/flare/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.00441 |
| fal.ai | `fal_ai/low/1920-x-1080/openai/gpt-image-2.5/sunburst/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.00441 |
| fal.ai | `fal_ai/low/1920-x-1080/openai/gpt-image-2.5/sunburst/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.00441 |
| fal.ai | `fal_ai/low/2560-x-1440/openai/gpt-image-2.5/flare/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.00615 |
| fal.ai | `fal_ai/low/2560-x-1440/openai/gpt-image-2.5/flare/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.00615 |
| fal.ai | `fal_ai/low/2560-x-1440/openai/gpt-image-2.5/sunburst/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.00615 |
| fal.ai | `fal_ai/low/2560-x-1440/openai/gpt-image-2.5/sunburst/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.00615 |
| fal.ai | `fal_ai/low/3840-x-2160/openai/gpt-image-2.5/flare/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.01113 |
| fal.ai | `fal_ai/low/3840-x-2160/openai/gpt-image-2.5/flare/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.01113 |
| fal.ai | `fal_ai/low/3840-x-2160/openai/gpt-image-2.5/sunburst/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.01113 |
| fal.ai | `fal_ai/low/3840-x-2160/openai/gpt-image-2.5/sunburst/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.01113 |
| fal.ai | `fal_ai/max/1024-x-1024/openai/gpt-image-2.5/flare/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.21072 |
| fal.ai | `fal_ai/max/1024-x-1024/openai/gpt-image-2.5/flare/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.21072 |
| fal.ai | `fal_ai/max/1024-x-1024/openai/gpt-image-2.5/sunburst/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.21072 |
| fal.ai | `fal_ai/max/1024-x-1024/openai/gpt-image-2.5/sunburst/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.21072 |
| fal.ai | `fal_ai/max/1024-x-1536/openai/gpt-image-2.5/flare/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.16464 |
| fal.ai | `fal_ai/max/1024-x-1536/openai/gpt-image-2.5/flare/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.16464 |
| fal.ai | `fal_ai/max/1024-x-1536/openai/gpt-image-2.5/sunburst/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.16464 |
| fal.ai | `fal_ai/max/1024-x-1536/openai/gpt-image-2.5/sunburst/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.16464 |
| fal.ai | `fal_ai/max/1024-x-768/openai/gpt-image-2.5/flare/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.14445 |
| fal.ai | `fal_ai/max/1024-x-768/openai/gpt-image-2.5/flare/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.14445 |
| fal.ai | `fal_ai/max/1024-x-768/openai/gpt-image-2.5/sunburst/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.14445 |
| fal.ai | `fal_ai/max/1024-x-768/openai/gpt-image-2.5/sunburst/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.14445 |
| fal.ai | `fal_ai/max/1920-x-1080/openai/gpt-image-2.5/flare/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.1584 |
| fal.ai | `fal_ai/max/1920-x-1080/openai/gpt-image-2.5/flare/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.1584 |
| fal.ai | `fal_ai/max/1920-x-1080/openai/gpt-image-2.5/sunburst/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.1584 |
| fal.ai | `fal_ai/max/1920-x-1080/openai/gpt-image-2.5/sunburst/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.1584 |
| fal.ai | `fal_ai/max/2560-x-1440/openai/gpt-image-2.5/flare/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.2211 |
| fal.ai | `fal_ai/max/2560-x-1440/openai/gpt-image-2.5/flare/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.2211 |
| fal.ai | `fal_ai/max/2560-x-1440/openai/gpt-image-2.5/sunburst/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.2211 |
| fal.ai | `fal_ai/max/2560-x-1440/openai/gpt-image-2.5/sunburst/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.2211 |
| fal.ai | `fal_ai/max/3840-x-2160/openai/gpt-image-2.5/flare/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.40026 |
| fal.ai | `fal_ai/max/3840-x-2160/openai/gpt-image-2.5/flare/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.40026 |
| fal.ai | `fal_ai/max/3840-x-2160/openai/gpt-image-2.5/sunburst/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.40026 |
| fal.ai | `fal_ai/max/3840-x-2160/openai/gpt-image-2.5/sunburst/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.40026 |
| fal.ai | `fal_ai/medium/1024-x-1024/openai/gpt-image-2.5/flare/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.01317 |
| fal.ai | `fal_ai/medium/1024-x-1024/openai/gpt-image-2.5/flare/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.01317 |
| fal.ai | `fal_ai/medium/1024-x-1024/openai/gpt-image-2.5/sunburst/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.01317 |
| fal.ai | `fal_ai/medium/1024-x-1024/openai/gpt-image-2.5/sunburst/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.01317 |
| fal.ai | `fal_ai/medium/1024-x-1536/openai/gpt-image-2.5/flare/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.01029 |
| fal.ai | `fal_ai/medium/1024-x-1536/openai/gpt-image-2.5/flare/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.01029 |
| fal.ai | `fal_ai/medium/1024-x-1536/openai/gpt-image-2.5/sunburst/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.01029 |
| fal.ai | `fal_ai/medium/1024-x-1536/openai/gpt-image-2.5/sunburst/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.01029 |
| fal.ai | `fal_ai/medium/1024-x-768/openai/gpt-image-2.5/flare/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.00903 |
| fal.ai | `fal_ai/medium/1024-x-768/openai/gpt-image-2.5/flare/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.00903 |
| fal.ai | `fal_ai/medium/1024-x-768/openai/gpt-image-2.5/sunburst/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.00903 |
| fal.ai | `fal_ai/medium/1024-x-768/openai/gpt-image-2.5/sunburst/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.00903 |
| fal.ai | `fal_ai/medium/1920-x-1080/openai/gpt-image-2.5/flare/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.01029 |
| fal.ai | `fal_ai/medium/1920-x-1080/openai/gpt-image-2.5/flare/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.01029 |
| fal.ai | `fal_ai/medium/1920-x-1080/openai/gpt-image-2.5/sunburst/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.01029 |
| fal.ai | `fal_ai/medium/1920-x-1080/openai/gpt-image-2.5/sunburst/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.01029 |
| fal.ai | `fal_ai/medium/2560-x-1440/openai/gpt-image-2.5/flare/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.01434 |
| fal.ai | `fal_ai/medium/2560-x-1440/openai/gpt-image-2.5/flare/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.01434 |
| fal.ai | `fal_ai/medium/2560-x-1440/openai/gpt-image-2.5/sunburst/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.01434 |
| fal.ai | `fal_ai/medium/2560-x-1440/openai/gpt-image-2.5/sunburst/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.01434 |
| fal.ai | `fal_ai/medium/3840-x-2160/openai/gpt-image-2.5/flare/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.02595 |
| fal.ai | `fal_ai/medium/3840-x-2160/openai/gpt-image-2.5/flare/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.02595 |
| fal.ai | `fal_ai/medium/3840-x-2160/openai/gpt-image-2.5/sunburst/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.02595 |
| fal.ai | `fal_ai/medium/3840-x-2160/openai/gpt-image-2.5/sunburst/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.02595 |
| fal.ai | `fal_ai/minimax/h3/reference-to-video` | - | - | - | Video generation; `output_cost_per_second`: $0.13; `output_cost_per_second_480p`: $0.05; `output_cost_per_second_768p`: $0.06 |
| fal.ai | `fal_ai/minimax/h3/text-to-video` | - | - | - | Video generation; `output_cost_per_second`: $0.13; `output_cost_per_second_480p`: $0.05; `output_cost_per_second_768p`: $0.06 |
| fal.ai | `fal_ai/openai/gpt-image-2.5/flare/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.03612 |
| fal.ai | `fal_ai/openai/gpt-image-2.5/flare/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.03612 |
| fal.ai | `fal_ai/openai/gpt-image-2.5/sunburst/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.03612 |
| fal.ai | `fal_ai/openai/gpt-image-2.5/sunburst/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.03612 |
| fal.ai | `fal_ai/xhigh/1024-x-1024/openai/gpt-image-2.5/flare/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.09366 |
| fal.ai | `fal_ai/xhigh/1024-x-1024/openai/gpt-image-2.5/flare/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.09366 |
| fal.ai | `fal_ai/xhigh/1024-x-1024/openai/gpt-image-2.5/sunburst/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.09366 |
| fal.ai | `fal_ai/xhigh/1024-x-1024/openai/gpt-image-2.5/sunburst/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.09366 |
| fal.ai | `fal_ai/xhigh/1024-x-1536/openai/gpt-image-2.5/flare/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.07377 |
| fal.ai | `fal_ai/xhigh/1024-x-1536/openai/gpt-image-2.5/flare/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.07377 |
| fal.ai | `fal_ai/xhigh/1024-x-1536/openai/gpt-image-2.5/sunburst/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.07377 |
| fal.ai | `fal_ai/xhigh/1024-x-1536/openai/gpt-image-2.5/sunburst/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.07377 |
| fal.ai | `fal_ai/xhigh/1024-x-768/openai/gpt-image-2.5/flare/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.0642 |
| fal.ai | `fal_ai/xhigh/1024-x-768/openai/gpt-image-2.5/flare/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.0642 |
| fal.ai | `fal_ai/xhigh/1024-x-768/openai/gpt-image-2.5/sunburst/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.0642 |
| fal.ai | `fal_ai/xhigh/1024-x-768/openai/gpt-image-2.5/sunburst/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.0642 |
| fal.ai | `fal_ai/xhigh/1920-x-1080/openai/gpt-image-2.5/flare/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.07041 |
| fal.ai | `fal_ai/xhigh/1920-x-1080/openai/gpt-image-2.5/flare/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.07041 |
| fal.ai | `fal_ai/xhigh/1920-x-1080/openai/gpt-image-2.5/sunburst/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.07041 |
| fal.ai | `fal_ai/xhigh/1920-x-1080/openai/gpt-image-2.5/sunburst/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.07041 |
| fal.ai | `fal_ai/xhigh/2560-x-1440/openai/gpt-image-2.5/flare/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.09828 |
| fal.ai | `fal_ai/xhigh/2560-x-1440/openai/gpt-image-2.5/flare/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.09828 |
| fal.ai | `fal_ai/xhigh/2560-x-1440/openai/gpt-image-2.5/sunburst/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.09828 |
| fal.ai | `fal_ai/xhigh/2560-x-1440/openai/gpt-image-2.5/sunburst/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.09828 |
| fal.ai | `fal_ai/xhigh/3840-x-2160/openai/gpt-image-2.5/flare/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.1779 |
| fal.ai | `fal_ai/xhigh/3840-x-2160/openai/gpt-image-2.5/flare/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.1779 |
| fal.ai | `fal_ai/xhigh/3840-x-2160/openai/gpt-image-2.5/sunburst/edit` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.1779 |
| fal.ai | `fal_ai/xhigh/3840-x-2160/openai/gpt-image-2.5/sunburst/text-to-image` | - | - | - | Image generation; Vision; `output_cost_per_image`: $0.1779 |
| xAI | `xai/grok-4.20-0309` | 1,000,000 | $1.25 | $2.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search |
| xAI | `xai/grok-4.20-beta` | 1,000,000 | $1.25 | $2.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search |
| xAI | `xai/grok-4.20-beta-0309` | 1,000,000 | $1.25 | $2.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search |
| xAI | `xai/grok-4.20-beta-latest` | 1,000,000 | $1.25 | $2.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search |
| xAI | `xai/grok-4.20-beta-latest-non-reasoning` | 1,000,000 | $1.25 | $2.5 | Chat; Vision; Tool calling; Prompt caching; Structured output; Web search |
| xAI | `xai/grok-4.20-beta-latest-reasoning` | 1,000,000 | $1.25 | $2.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search |
| xAI | `xai/grok-4.20-beta-non-reasoning` | 1,000,000 | $1.25 | $2.5 | Chat; Vision; Tool calling; Prompt caching; Structured output; Web search |
| xAI | `xai/grok-4.20-beta-reasoning` | 1,000,000 | $1.25 | $2.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search |
| xAI | `xai/grok-4.20-experimental-beta-0304` | 1,000,000 | $1.25 | $2.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search |
| xAI | `xai/grok-4.20-experimental-beta-0304-non-reasoning` | 1,000,000 | $1.25 | $2.5 | Chat; Vision; Tool calling; Prompt caching; Structured output; Web search |
| xAI | `xai/grok-4.20-experimental-beta-0304-reasoning` | 1,000,000 | $1.25 | $2.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search |
| xAI | `xai/grok-4.20-experimental-beta-latest` | 1,000,000 | $1.25 | $2.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search |
| xAI | `xai/grok-4.20-experimental-beta-non-reasoning-latest` | 1,000,000 | $1.25 | $2.5 | Chat; Vision; Tool calling; Prompt caching; Structured output; Web search |
| xAI | `xai/grok-4.20-experimental-beta-reasoning-latest` | 1,000,000 | $1.25 | $2.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search |
| xAI | `xai/grok-4.20-multi-agent-beta-latest` | 1,000,000 | $1.25 | $2.5 | Responses; Reasoning; Vision; Prompt caching; Structured output; Web search |
| xAI | `xai/grok-4.20-multi-agent-experimental-beta-0304` | 1,000,000 | $1.25 | $2.5 | Responses; Reasoning; Vision; Prompt caching; Structured output; Web search |
| xAI | `xai/grok-4.20-multi-agent-experimental-beta-latest` | 1,000,000 | $1.25 | $2.5 | Responses; Reasoning; Vision; Prompt caching; Structured output; Web search |
| xAI | `xai/grok-4.20-non-reasoning-gv2` | 1,000,000 | $1.25 | $2.5 | Chat; Vision; Tool calling; Prompt caching; Structured output; Web search |
| xAI | `xai/grok-4.20-reasoning-gv2` | 1,000,000 | $1.25 | $2.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search |
| xAI | `xai/grok-4.7` | 500,000 | $2 | $6 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search |

#### Updated pricing (73 models)

| Provider / model | Changed token prices (USD per 1M tokens) |
| --- | --- |
| `anthropic.claude-mythos-preview` | Input: $0 to $27.5; Output: $0 to $137.5; Cache read: not set to $2.75; Cache write: not set to $34.375 |
| `azure/eu/gpt-5.6` | Input: $5.5 to $4.4; Output: $33 to $22; Cache read: $0.55 to $0.44; Cache write: $6.875 to $5.5 |
| `azure/gpt-5.6` | Input: $5 to $4; Output: $30 to $20; Cache read: $0.5 to $0.4; Cache write: $6.25 to $5 |
| `azure/us/gpt-5.6` | Input: $5.5 to $4.4; Output: $33 to $22; Cache read: $0.55 to $0.44; Cache write: $6.875 to $5.5 |
| `baseten/openai/gpt-oss-120b` | Cache read: not set to $0.1 |
| `baseten/zai-org/GLM-4.7` | Cache read: not set to $0.12 |
| `bedrock/eu-west-3/mistral.mistral-large-2402-v1:0` | Input: $10.4 to $5.2; Output: $31.2 to $15.6 |
| `bedrock/us-east-1/mistral.mistral-large-2402-v1:0` | Input: $8 to $4; Output: $24 to $12 |
| `bedrock/us-west-2/mistral.mistral-large-2402-v1:0` | Input: $8 to $4; Output: $24 to $12 |
| `bedrock_mantle/openai.gpt-daybreak-blue-5.6-sol` | Input: $5.5 to $4.4; Output: $33 to $22; Cache read: $0.55 to $0.44; Cache write: $6.875 to $5.5 |
| `cohere.command-text-v14` | Input: $1.5 to $1 |
| `deepseek/deepseek-coder` | Cache read: not set to $0.014 |
| `deepseek/deepseek-r1` | Cache read: not set to $0.14 |
| `deepseek/deepseek-v3.2` | Cache read: not set to $0.028 |
| `eu.anthropic.claude-opus-4-5-20251101-v1:0` | Input: $5 to $5.5; Output: $25 to $27.5; Cache read: $0.5 to $0.55; Cache write: $6.25 to $6.875 |
| `fireworks_ai/accounts/fireworks/models/minimax-m2p7` | Input: $0.3 to not set; Output: $1.2 to not set; Cache read: $0.06 to not set |
| `fireworks_ai/accounts/fireworks/routers/kimi-k3-us` | Input: $3.3 to $4.5; Output: $16.5 to $22.5; Cache read: $0.33 to $0.45 |
| `fireworks_ai/kimi-k3-us` | Input: $3.3 to $4.5; Output: $16.5 to $22.5; Cache read: $0.33 to $0.45 |
| `gemini-2.5-flash-image` | Cache read: $0.03 to not set |
| `gemini-3-pro-image-preview` | Cache read: not set to $0.2 |
| `gemini-3.1-flash-image-preview` | Cache read: not set to $0.05 |
| `gemini-live-2.5-flash-preview-native-audio-09-2025` | Cache read: $0.075 to not set |
| `gemini/gemini-live-2.5-flash-preview-native-audio-09-2025` | Cache read: $0.075 to not set |
| `gemini/gemini-robotics-er-2-streaming-preview` | Input: $2 to $1; Output: $10 to $5 |
| `mistral.mistral-large-2402-v1:0` | Input: $8 to $4; Output: $24 to $12 |
| `openrouter/deepseek/deepseek-r1` | Cache read: not set to $0.14 |
| `openrouter/deepseek/deepseek-v3.2-exp` | Cache read: not set to $0.02 |
| `openrouter/deepseek/deepseek-v4-flash` | Input: $0.03724 to $0.049; Output: $0.07448 to $0.098; Cache read: $0.007448 to $0.0098 |
| `openrouter/deepseek/deepseek-v4-flash-0731` | Input: $0.04 to $0.03; Output: $0.08 to $0.32 |
| `openrouter/deepseek/deepseek-v4-flash-vision-exp` | Input: $0.2156 to $0.22; Output: $0.6468 to $0.66; Cache read: $0.00686 to $0.007 |
| `openrouter/deepseek/deepseek-v4-pro` | Input: $0.422298 to $0.844944; Output: $0.844596 to $1.689888; Cache read: $0.035192 to $0.070412 |
| `openrouter/deepseek/deepseek-v4-pro-0813` | Input: $0.57816 to $0.462; Output: $1.73448 to $1.386; Cache read: $0.018396 to $0.0154 |
| `openrouter/meta/muse-glimmer-30b` | Input: $0.35 to $0.3; Output: $1.5 to $1.2 |
| `openrouter/minimax/minimax-m2` | Input: $0.255 to $0.3; Output: $1.02 to $1.2 |
| `openrouter/mistralai/mistral-large-2512` | Input: $0.55 to $0.5; Output: $1.65 to $1.5; Cache read: $0.055 to $0.05 |
| `openrouter/moonshotai/kimi-k2.7-code` | Input: $0.7062 to $0.6562; Output: $3.21 to $3.3 |
| `openrouter/moonshotai/kimi-k3` | Input: $1.7 to $3; Output: $8.5 to $15; Cache read: $0.17 to $0.3 |
| `openrouter/moonshotai/kimi-k3:batch` | Input: $3 to $2.28; Output: $15 to $11.4; Cache read: $0.3 to $0.228 |
| `openrouter/nvidia/nemotron-3-nano-30b-a3b` | Input: $0.06 to $0.05; Output: $0.24 to $0.2 |
| `openrouter/nvidia/nemotron-3.5-lightning` | Input: $0.07 to $0.08 |
| `openrouter/openai/gpt-oss-120b:batch` | Input: $0.15 to $0.0296; Output: $0.6 to $0.136 |
| `openrouter/openai/gpt-oss-20b` | Input: $0.03 to $0.018; Output: $0.13 to $0.09 |
| `openrouter/qwen/qwen3-30b-a3b-instruct-2507` | Input: $0.04815 to $0.1; Output: $0.19305 to $0.3 |
| `openrouter/qwen/qwen3-next-80b-a3b-instruct` | Input: $0.09 to $0.1 |
| `openrouter/qwen/qwen3.6-27b` | Input: $0.3 to $0.32; Output: $2 to $2.7; Cache read: $0.03 to $0.15 |
| `openrouter/qwen/qwen3.6-35b-a3b` | Input: $0.1 to $0.15; Output: $0.9 to $1 |
| `openrouter/z-ai/glm-5.2` | Input: $0.5544 to $0.6496; Output: $1.7424 to $2.0416; Cache read: $0.10296 to $0.12064 |
| `openrouter/z-ai/glm-5.3` | Input: $0.896 to $1.4; Output: $2.816 to $4.4; Cache read: $0.1664 to $0.26 |
| `openrouter/z-ai/glm-5.3-flash` | Input: $0.09 to $0.045; Output: $0.3 to $0.6; Cache read: $0.018 to $0.0285 |
| `openrouter/z-ai/glm-5.3-flash:batch` | Input: $0.075 to $0.06; Output: $0.25 to $0.2; Cache read: $0.015 to $0.012 |
| `openrouter/z-ai/glm-5.3-flashx` | Cache read: $0.075 to $0.09 |
| `openrouter/z-ai/glm-5.3:batch` | Input: $0.7 to $0.45; Output: $2.2 to $2; Cache read: $0.13 to $0.1 |
| `openrouter/~anthropic/claude-opus-latest` | Input: $5 to $4; Output: $25 to $20; Cache read: $0.5 to $0.2; Cache write: $6.25 to $5 |
| `openrouter/~deepseek/deepseek-flash-latest` | Input: $0.13 to $0.3; Output: $0.52 to $1.2; Cache read: $0.0026 to $0.006 |
| `openrouter/~deepseek/deepseek-pro-latest` | Input: $0.57816 to $1.32; Output: $1.73448 to $3.96; Cache read: $0.018396 to $0.044 |
| `openrouter/~deepseek/deepseek-v4-flash-latest` | Output: $0.08 to $0.64 |
| `openrouter/~moonshotai/kimi-latest` | Input: $1.7 to $3; Output: $8.5 to $15; Cache read: $0.17 to $0.3 |
| `openrouter/~openai/gpt-luna-latest` | Input: $0.2 to $0.1; Output: $1.2 to $0.5; Cache read: $0.02 to $0.01; Cache write: $0.25 to $0.125 |
| `openrouter/~x-ai/grok-latest` | Input: $2 to $1.6; Output: $6 to $4.8; Cache read: $0.5 to $0.4 |
| `openrouter/~z-ai/glm-flash-latest` | Input: $0.075 to $0.15; Output: $0.25 to $0.5; Cache read: $0.015 to $0.05 |
| `openrouter/~z-ai/glm-latest` | Input: $0.8442 to $0.6538; Output: $2.6532 to $2.0548; Cache read: $0.15678 to $0.12142 |
| `together_ai/Qwen/Qwen3.7-Max` | Input: $2.5 to $1.5; Output: $7.5 to $4.5; Cache read: $0.5 to $0.3 |
| `together_ai/Qwen/Qwen3.8-Flash` | Input: $0.15 to $0.09; Output: $0.47 to $0.282 |
| `vertex_ai/deepseek-ai/deepseek-v3.1-maas` | Cache read: not set to $0.06 |
| `vertex_ai/deepseek-ai/deepseek-v3.2-maas` | Cache read: not set to $0.056 |
| `vertex_ai/gemini-2.5-flash-image` | Cache read: $0.03 to not set |
| `vertex_ai/gemini-3-pro-image-preview` | Cache read: not set to $0.2 |
| `vertex_ai/gemini-3.1-flash-image-preview` | Cache read: not set to $0.05 |
| `vertex_ai/google/gemma-4-26b-a4b-it-maas` | Cache read: not set to $0.015 |
| `vertex_ai/minimaxai/minimax-m2-maas` | Cache read: not set to $0.03 |
| `vertex_ai/moonshotai/kimi-k2-thinking-maas` | Cache read: not set to $0.06 |
| `vertex_ai/qwen/qwen3-coder-480b-a35b-instruct-maas` | Cache read: not set to $0.022 |
| `vertex_ai/zai-org/glm-4.7-maas` | Cache read: not set to $0.06 |

The registry also updates capability flags, context/output limits, non-token rates, and deprecation dates on 630 more entries

<details>
<summary>Removed catalog entries (275)</summary>

`1024-x-1024/dall-e-2`, `256-x-256/dall-e-2`, `512-x-512/dall-e-2`, `amazon.nova-sonic-v1:0`, `anthropic.claude-3-haiku-20240307-v1:0`, `anthropic.claude-3-sonnet-20240229-v1:0`, `apac.anthropic.claude-3-5-sonnet-20240620-v1:0`, `apac.anthropic.claude-3-5-sonnet-20241022-v2:0`, `apac.anthropic.claude-3-haiku-20240307-v1:0`, `apac.anthropic.claude-3-sonnet-20240229-v1:0`, `azure/eu/o1-preview-2024-09-12`, `azure/global/gpt-5.1-chat`, `azure/gpt-3.5-turbo-0125`, `azure/gpt-35-turbo-0125`, `azure/gpt-35-turbo-1106`, `azure/gpt-5-chat-latest`, `azure/gpt-5.1-chat-2025-11-13`, `azure/gpt-5.2-chat-2025-12-11`, `azure/o1-preview`, `azure/o1-preview-2024-09-12`, `azure/us/o1-preview-2024-09-12`, `azure_ai/Llama-3.2-11B-Vision-Instruct`, `azure_ai/Llama-3.2-90B-Vision-Instruct`, `azure_ai/MAI-Image-2e`, `azure_ai/Meta-Llama-3.1-405B-Instruct`, `azure_ai/Meta-Llama-3.1-8B-Instruct`, `azure_ai/claude-opus-4-1`, `azure_ai/cohere-rerank-v3.5`, `azure_ai/global/grok-3`, `azure_ai/global/grok-3-mini`, `azure_ai/mistral-document-ai-2505`, `bedrock/us-gov-east-1/anthropic.claude-3-5-sonnet-20240620-v1:0`, `bedrock/us-gov-east-1/anthropic.claude-3-haiku-20240307-v1:0`, `bedrock/us-gov-west-1/anthropic.claude-3-5-sonnet-20240620-v1:0`, `bedrock/us-gov-west-1/anthropic.claude-3-7-sonnet-20250219-v1:0`, `bedrock/us-gov-west-1/anthropic.claude-3-haiku-20240307-v1:0`, `cerebras/zai-glm-4.6`, `cerebras/zai-glm-4.7`, `chatgpt-4o-latest`, `claude-3-7-sonnet-20250219`, `claude-3-haiku-20240307`, `claude-3-opus-20240229`, `claude-4-opus-20250514`, `claude-4-sonnet-20250514`, `claude-opus-4-1`, `claude-opus-4-1-20250805`, `claude-opus-4-20250514`, `claude-sonnet-4-20250514`, `codex-mini-latest`, `cohere.command-r-plus-v1:0`, `cohere.command-r-v1:0`, `command`, `command-light`, `command-r`, `command-r-plus`, `dall-e-2`, `dall-e-3`, `databricks/databricks-claude-3-7-sonnet`, `databricks/databricks-gpt-5-1-codex-max`, `databricks/databricks-gpt-5-1-codex-mini`, `databricks/databricks-gpt-5-2-codex`, `databricks/databricks-llama-2-70b-chat`, `databricks/databricks-meta-llama-3-1-405b-instruct`, `databricks/databricks-meta-llama-3-70b-instruct`, `databricks/databricks-mixtral-8x7b-instruct`, `databricks/databricks-mpt-30b-instruct`, `databricks/databricks-mpt-7b-instruct`, `deepinfra/google/gemini-2.0-flash-001`, `embed-english-light-v2.0`, `embed-english-v2.0`, `embed-multilingual-v2.0`, `eu.anthropic.claude-3-haiku-20240307-v1:0`, `eu.anthropic.claude-3-sonnet-20240229-v1:0`, `fireworks_ai/deepseek-v4-pro`, `fireworks_ai/minimax-m2p7`, `friendliai/LGAI-EXAONE/K-EXAONE-2.0-750B-A37B`, `gemini-2.0-flash`, `gemini-2.0-flash-001`, `gemini-2.0-flash-lite`, `gemini-2.0-flash-lite-001`, `gemini-2.5-flash-lite-preview-06-17`, `gemini-3-pro-preview`, `gemini/gemini-1.5-flash`, `gemini/gemini-2.0-flash`, `gemini/gemini-2.0-flash-001`, `gemini/gemini-2.0-flash-lite`, `gemini/gemini-2.0-flash-lite-001`, `gemini/gemini-2.5-flash-lite-preview-06-17`, `gemini/gemini-2.5-flash-lite-preview-09-2025`, `gemini/gemini-2.5-flash-preview-09-2025`, `gemini/gemini-3-pro-preview`, `gemini/gemini-robotics-er-1.5-preview`, `gemini/gemini-robotics-er-1.6-preview`, `gemini/imagen-3.0-generate-002`, `gemini/imagen-4.0-fast-generate-001`, `gemini/imagen-4.0-generate-001`, `gemini/imagen-4.0-ultra-generate-001`, `gemini/veo-2.0-generate-001`, `gpt-4-0125-preview`, `gpt-4-0314`, `gpt-4-turbo-preview`, `gpt-4o-audio-preview`, `gpt-4o-mini-audio-preview`, `gpt-4o-mini-realtime-preview`, `gpt-4o-mini-search-preview-2025-03-11`, `gpt-4o-mini-tts-2025-03-20`, `gpt-4o-realtime-preview`, `gpt-4o-realtime-preview-2024-12-17`, `gpt-4o-realtime-preview-2025-06-03`, `gpt-4o-search-preview-2025-03-11`, `gpt-audio-mini-2025-10-06`, `gpt-realtime-mini-2025-10-06`, `groq/gemma-7b-it`, `groq/llama-3.1-8b-instant`, `groq/llama-3.3-70b-versatile`, `groq/meta-llama/llama-4-maverick-17b-128e-instruct`, `groq/meta-llama/llama-4-scout-17b-16e-instruct`, `groq/meta-llama/llama-guard-4-12b`, `groq/moonshotai/kimi-k2-instruct-0905`, `groq/playai-tts`, `groq/qwen/qwen3-32b`, `groq/qwen/qwen3.6-27b`, `hd/1024-x-1024/dall-e-3`, `hd/1024-x-1792/dall-e-3`, `hd/1792-x-1024/dall-e-3`, `mistral/codestral-2405`, `mistral/devstral-2512`, `mistral/devstral-medium-2507`, `mistral/devstral-small-2505`, `mistral/devstral-small-2507`, `mistral/labs-devstral-small-2512`, `mistral/magistral-medium-1-2-2509`, `mistral/magistral-medium-2506`, `mistral/magistral-medium-2509`, `mistral/magistral-small-1-2-2509`, `mistral/magistral-small-2506`, `mistral/mistral-large-2402`, `mistral/mistral-large-2407`, `mistral/mistral-large-2411`, `mistral/mistral-medium-2312`, `mistral/mistral-medium-2505`, `mistral/mistral-medium-2508`, `mistral/mistral-medium-3-1-2508`, `mistral/mistral-ocr-2505-completion`, `mistral/mistral-small-3-2-2506`, `mistral/open-codestral-mamba`, `mistral/open-mistral-7b`, `mistral/open-mistral-nemo-2407`, `mistral/open-mixtral-8x22b`, `mistral/open-mixtral-8x7b`, `mistral/pixtral-12b-2409`, `mistral/pixtral-large-2411`, `moonshot/kimi-k2-0711-preview`, `moonshot/kimi-k2-0905-preview`, `moonshot/kimi-k2-thinking`, `moonshot/kimi-k2-thinking-turbo`, `moonshot/kimi-k2-turbo-preview`, `moonshot/kimi-latest`, `moonshot/kimi-latest-128k`, `moonshot/kimi-latest-32k`, `moonshot/kimi-latest-8k`, `moonshot/kimi-thinking-preview`, `moonshot/moonshot-v1-128k-0430`, `moonshot/moonshot-v1-32k-0430`, `moonshot/moonshot-v1-8k-0430`, `o3-deep-research-2025-06-26`, `o4-mini-deep-research-2025-06-26`, `openrouter/anthropic/claude-opus-4`, `openrouter/deepseek/deepseek-v4-flash-0731:batch`, `openrouter/deepseek/deepseek-v4-flash-0731:free`, `openrouter/deepseek/deepseek-v4-flash-vision-exp:batch`, `openrouter/deepseek/deepseek-v4-pro-0813:batch`, `openrouter/google/gemini-2.0-flash-001`, `openrouter/kwaipilot/kat-coder-pro-v2`, `openrouter/meta/muse-glimmer-30b:batch`, `openrouter/minimax/minimax-m3:batch`, `openrouter/qwen/qwen3.5-9b:batch`, `openrouter/qwen/qwen3.8-2.4t-a95b:batch`, `openrouter/stealth/union-alpha`, `openrouter/thinkingmachines/inkling:batch`, `openrouter/z-ai/glm-5.2:batch`, `rerank-english-v2.0`, `rerank-multilingual-v2.0`, `sambanova/DeepSeek-R1-Distill-Llama-70B`, `sambanova/DeepSeek-V3-0324`, `sambanova/Llama-4-Scout-17B-16E-Instruct`, `sambanova/Meta-Llama-3.1-405B-Instruct`, `sambanova/Meta-Llama-3.1-8B-Instruct`, `sambanova/Meta-Llama-3.2-1B-Instruct`, `sambanova/Meta-Llama-3.2-3B-Instruct`, `sambanova/Meta-Llama-Guard-3-8B`, `sambanova/QwQ-32B`, `sambanova/Qwen2-Audio-7B-Instruct`, `sambanova/Qwen3-32B`, `scaleway/google/gemma-3-27b-it`, `scaleway/hcompany/holo2-30b-a3b`, `scaleway/mistralai/devstral-2-123b-instruct-2512`, `scaleway/mistralai/voxtral-small-24b-2507`, `standard/1024-x-1024/dall-e-3`, `standard/1024-x-1792/dall-e-3`, `standard/1792-x-1024/dall-e-3`, `text-moderation-007`, `text-moderation-latest`, `text-moderation-stable`, `together_ai/Qwen/Qwen3-235B-A22B-Instruct-2507-tput`, `together_ai/Qwen/Qwen3-235B-A22B-Thinking-2507`, `together_ai/Qwen/Qwen3-235B-A22B-fp8-tput`, `together_ai/deepseek-ai/DeepSeek-R1`, `together_ai/deepseek-ai/DeepSeek-R1-0528-tput`, `together_ai/deepseek-ai/DeepSeek-V4-Pro`, `together_ai/google/gemma-3n-E4B-it`, `together_ai/intfloat/multilingual-e5-large-instruct`, `together_ai/meta-llama/Llama-3.2-3B-Instruct-Turbo`, `together_ai/meta-llama/Llama-3.3-70B-Instruct-Turbo-Free`, `together_ai/meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8`, `together_ai/meta-llama/Llama-Guard-4-12B`, `together_ai/meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo`, `together_ai/moonshotai/Kimi-K2-Instruct-0905`, `together_ai/moonshotai/Kimi-K2.5`, `together_ai/pearl-ai/gemma-4-31b-it`, `together_ai/thinkingmachines/Inkling-Small`, `us-gov.anthropic.claude-3-haiku-20240307-v1:0`, `us.amazon.nova-premier-v1:0`, `us.anthropic.claude-3-haiku-20240307-v1:0`, `us.anthropic.claude-3-sonnet-20240229-v1:0`, `vercel_ai_gateway/google/gemini-2.0-flash`, `vercel_ai_gateway/google/gemini-2.0-flash-lite`, `vertex_ai/claude-3-7-sonnet@20250219`, `vertex_ai/claude-opus-4`, `vertex_ai/claude-opus-4-1`, `vertex_ai/claude-opus-4-1@20250805`, `vertex_ai/claude-opus-4@20250514`, `vertex_ai/claude-sonnet-4`, `vertex_ai/claude-sonnet-4@20250514`, `vertex_ai/gemini-3.1-flash-live-preview`, `vertex_ai/gemini-robotics-er-2`, `vertex_ai/imagegeneration@006`, `vertex_ai/imagen-3.0-capability-001`, `vertex_ai/imagen-3.0-fast-generate-001`, `vertex_ai/imagen-3.0-generate-001`, `vertex_ai/imagen-3.0-generate-002`, `vertex_ai/imagen-4.0-fast-generate-001`, `vertex_ai/imagen-4.0-generate-001`, `vertex_ai/imagen-4.0-ultra-generate-001`, `wandb/MiniMaxAI/MiniMax-M2.5`, `wandb/Qwen/Qwen3-235B-A22B-Instruct-2507`, `wandb/Qwen/Qwen3-235B-A22B-Thinking-2507`, `wandb/Qwen/Qwen3-Coder-480B-A35B-Instruct`, `wandb/deepseek-ai/DeepSeek-R1-0528`, `wandb/deepseek-ai/DeepSeek-V3-0324`, `wandb/meta-llama/Llama-4-Scout-17B-16E-Instruct`, `wandb/microsoft/Phi-4-mini-instruct`, `wandb/moonshotai/Kimi-K2-Instruct`, `wandb/zai-org/GLM-4.5`, `xai/grok-3`, `xai/grok-3-beta`, `xai/grok-3-fast-beta`, `xai/grok-3-fast-latest`, `xai/grok-3-latest`, `xai/grok-3-mini`, `xai/grok-3-mini-beta`, `xai/grok-3-mini-fast`, `xai/grok-3-mini-fast-beta`, `xai/grok-3-mini-fast-latest`, `xai/grok-3-mini-latest`, `xai/grok-4`, `xai/grok-4-0709`, `xai/grok-4-1-fast`, `xai/grok-4-1-fast-non-reasoning`, `xai/grok-4-1-fast-non-reasoning-latest`, `xai/grok-4-1-fast-reasoning`, `xai/grok-4-1-fast-reasoning-latest`, `xai/grok-4-fast-non-reasoning`, `xai/grok-4-fast-reasoning`, `xai/grok-4-latest`

</details>

### New providers

- Add Nadir intelligent-router provider (nadir/auto) - [PR #33227](https://github.com/BerriAI/litellm/pull/33227)
- Add Eden AI provider across chat, Responses, Messages, embeddings, audio, images and video - [PR #41101](https://github.com/BerriAI/litellm/pull/41101)

### Amazon Bedrock

- Strip body params the AWS endpoint rejects - [PR #31203](https://github.com/BerriAI/litellm/pull/31203)
- Drop unsupported sampling params on converse reasoning models - [PR #39834](https://github.com/BerriAI/litellm/pull/39834)
- Send s3BucketOwner on batch input and output data config - [PR #42262](https://github.com/BerriAI/litellm/pull/42262)
- Add us.moonshotai.kimi-k3 pricing and fill the global Kimi K3 entry - [PR #42271](https://github.com/BerriAI/litellm/pull/42271)
- Forward anthropic-beta headers verbatim on the Claude platform messages path - [PR #42275](https://github.com/BerriAI/litellm/pull/42275)
- Keep batch S3 credentials out of chat requests and debug logs - [PR #42312](https://github.com/BerriAI/litellm/pull/42312)
- Sign batch S3 requests with s3_access_key_id and s3_secret_access_key - [PR #42342](https://github.com/BerriAI/litellm/pull/42342)
- Add bare moonshotai.kimi-k3 cost map entry - [PR #42363](https://github.com/BerriAI/litellm/pull/42363)
- Send every Mantle beta in the anthropic-beta header on the bedrock/mantle route - [PR #42376](https://github.com/BerriAI/litellm/pull/42376)
- Price bedrock/mantle/&lt;model&gt; deployments from the base model row - [PR #42402](https://github.com/BerriAI/litellm/pull/42402)
- Treat blank AWS_S3_\* env vars as unset for batch jobs - [PR #42528](https://github.com/BerriAI/litellm/pull/42528)
- Add Claude Opus 5.5 pricing and capabilities - [PR #42588](https://github.com/BerriAI/litellm/pull/42588)
- Send json_schema as a forced tool on Claude Opus 4.7 and 4.8 Converse - [PR #42644](https://github.com/BerriAI/litellm/pull/42644)
- Honour stream_chunk_size in Invoke streaming - [PR #42686](https://github.com/BerriAI/litellm/pull/42686)
- Route unmapped openai family model ids to converse - [PR #42713](https://github.com/BerriAI/litellm/pull/42713)
- Add gpt-6-sol and gpt-6-luna model pricing - [PR #42746](https://github.com/BerriAI/litellm/pull/42746)
- Serve the OpenAI models on bedrock-runtime's native Responses API (internal copy of #38489) - [PR #42767](https://github.com/BerriAI/litellm/pull/42767)
- Add bare openai.gpt-6-sol and openai.gpt-6-luna cost map rows - [PR #42798](https://github.com/BerriAI/litellm/pull/42798)
- Add 17 aws-bedrock cost map rows from provider sync - [PR #42852](https://github.com/BerriAI/litellm/pull/42852)
- Add gpt-5.4 and gpt-5.5 us and global inference profile pricing - [PR #42941](https://github.com/BerriAI/litellm/pull/42941)
- Extrapolate global cris pricing for gpt-5.4 and gpt-5.5 - [PR #42971](https://github.com/BerriAI/litellm/pull/42971)
- Map Anthropic batch row params the way real time does - [PR #43087](https://github.com/BerriAI/litellm/pull/43087)

### Anthropic

- Forward safeguards and anthropic-beta unchanged on native /v1/messages - [PR #42152](https://github.com/BerriAI/litellm/pull/42152)
- Forward Claude Code safeguards and dangerous-tool-use beta to Bedrock Invoke and Vertex on /v1/messages - [PR #42288](https://github.com/BerriAI/litellm/pull/42288)
- Keep reasoning_effort a string for targets that stay on chat completions - [PR #42401](https://github.com/BerriAI/litellm/pull/42401)
- Return 400 instead of 500 when a content list holds a bare string - [PR #42420](https://github.com/BerriAI/litellm/pull/42420)
- Add Claude Opus 5.5 - [PR #42489](https://github.com/BerriAI/litellm/pull/42489)
- Keep the replayed prefix byte-stable for preserved thinking on chat completions - [PR #42630](https://github.com/BerriAI/litellm/pull/42630)
- Preserve MCP tool results in the non-Anthropic Messages bridge - [PR #42783](https://github.com/BerriAI/litellm/pull/42783)

### Azure

- Bridge gpt-5.4+ function tools with reasoning to the Foundry Responses API - [PR #42041](https://github.com/BerriAI/litellm/pull/42041)
- Propagate asyncio.CancelledError instead of raising a 500 - [PR #42295](https://github.com/BerriAI/litellm/pull/42295)
- Add gpt-audio and gpt-realtime alias rows from the Azure model list - [PR #42981](https://github.com/BerriAI/litellm/pull/42981)
- Update gpt-audio-mini and gpt-5-chat deprecation dates from the retirement schedule - [PR #43017](https://github.com/BerriAI/litellm/pull/43017)

### Bedrock Mantle

- Serve /v1/messages for Claude models on Mantle's native Anthropic Messages API - [PR #42049](https://github.com/BerriAI/litellm/pull/42049)

### fal.ai

- Add Seedance 2.5 / 2.0 video generation via fal queue API - [PR #41980](https://github.com/BerriAI/litellm/pull/41980)
- Add gpt-image-2.5 flare/sunburst, flux/dev and image edits - [PR #42095](https://github.com/BerriAI/litellm/pull/42095)
- Price images from the dimensions fal returns - [PR #42282](https://github.com/BerriAI/litellm/pull/42282)
- Add MiniMax H3 text-to-video and reference-to-video - [PR #42286](https://github.com/BerriAI/litellm/pull/42286)
- Surface fal errors in video status and content instead of completed and generic 500 - [PR #42306](https://github.com/BerriAI/litellm/pull/42306)
- Add flux-lora-depth image edits and moondream3 chat completions - [PR #42334](https://github.com/BerriAI/litellm/pull/42334)
- Price non-canonical image sizes from the nearest row and honour dump options - [PR #42336](https://github.com/BerriAI/litellm/pull/42336)
- Add queue-only /fal_ai pass-through route with spend tracking - [PR #42360](https://github.com/BerriAI/litellm/pull/42360)
- Handle seconds=auto and oversized sizes for minimax h3 videos - [PR #42504](https://github.com/BerriAI/litellm/pull/42504)
- Align /fal_ai queue gate with the pricer and normalise resolution type - [PR #42505](https://github.com/BerriAI/litellm/pull/42505)
- Reuse the status client and headers on the video result probe - [PR #42511](https://github.com/BerriAI/litellm/pull/42511)
- Honour global api_base for image generation and reject non-string reasoning_effort with 400 - [PR #42512](https://github.com/BerriAI/litellm/pull/42512)
- Price nano-banana-2 and nano-banana-pro image generations by resolution - [PR #43101](https://github.com/BerriAI/litellm/pull/43101)

### Fireworks AI

- Route firerouter short names and bill pass-through legs at the routed model's rates - [PR #42814](https://github.com/BerriAI/litellm/pull/42814)

### Gemini and Vertex AI

- Forward response schema and tool parameters through the generateContent adapter - [PR #42067](https://github.com/BerriAI/litellm/pull/42067)
- Simplify model version check - [PR #42465](https://github.com/BerriAI/litellm/pull/42465)
- Add gemini-3.8-flash-tts and gemini-3.8-flash-lite-tts prices - [PR #42752](https://github.com/BerriAI/litellm/pull/42752)
- Native batch JSONL passthrough with cost tracking - [PR #42810](https://github.com/BerriAI/litellm/pull/42810)
- Add deprecation dates for retired claude 3 and jamba 1.5 partner models - [PR #42867](https://github.com/BerriAI/litellm/pull/42867)
- Add gemini-3.8-flash-cyber pricing - [PR #42879](https://github.com/BerriAI/litellm/pull/42879)
- Keep batch output_file_id null until Vertex reports outputInfo - [PR #43030](https://github.com/BerriAI/litellm/pull/43030)
- Translate /v1/responses batch rows through the Responses-to-Chat bridge - [PR #43042](https://github.com/BerriAI/litellm/pull/43042)
- Surface the Gemma container's own error inside a 200 :predict response - [PR #43075](https://github.com/BerriAI/litellm/pull/43075)
- Stop advertising OpenAI platform-only params on Gemma and Llama routes - [PR #43079](https://github.com/BerriAI/litellm/pull/43079)
- Return chunk content, extractive text, and structData from search_api vector store hits - [PR #43100](https://github.com/BerriAI/litellm/pull/43100)

### GitHub Copilot and ChatGPT

- Answer get_api_base for github_copilot and chatgpt without running the login flow - [PR #42602](https://github.com/BerriAI/litellm/pull/42602)

### Ollama

- Send PNG and JPEG images without requiring Pillow - [PR #41979](https://github.com/BerriAI/litellm/pull/41979)
- Read the JSON thinking field on non-streaming completions - [PR #42838](https://github.com/BerriAI/litellm/pull/42838)

### OpenAI

- Forward non-enum reasoning_effort through the Responses bridge instead of dropping it - [PR #42452](https://github.com/BerriAI/litellm/pull/42452)
- Add GPT-6 Sol and GPT-6 Luna - [PR #42515](https://github.com/BerriAI/litellm/pull/42515)

### OpenRouter

- Price typesafe/jev-1.13 and add an openrouter decisions pass-through - [PR #42301](https://github.com/BerriAI/litellm/pull/42301)
- Remove the retired stealth/union-alpha model from the cost map - [PR #42386](https://github.com/BerriAI/litellm/pull/42386)

### Qianwen AI Platform

- Rename the mainland China brand to Qianwen AI Platform - [PR #42284](https://github.com/BerriAI/litellm/pull/42284)

### Together AI

- Backfill deprecation_date from Together deprecation history - [PR #43135](https://github.com/BerriAI/litellm/pull/43135)

### xAI

- Add grok-4.7 to the cost map - [PR #42264](https://github.com/BerriAI/litellm/pull/42264)
- Accept max_completion_tokens as a supported param - [PR #42353](https://github.com/BerriAI/litellm/pull/42353)

### Xiaomi MiMo

- Add mimo-v2.6-pro and mimo-v2.6-flash cost map rows with live e2e coverage - [PR #42362](https://github.com/BerriAI/litellm/pull/42362)

### Model catalog and pricing

- **New and updated catalog rows**
    - Add MAI-Image-2.5-Pro pricing, fix Fireworks/Together entries, absorb verified open registry PRs, add Groq deprecation and Bedrock regional Qwen3 Next pricing - [PR #34941](https://github.com/BerriAI/litellm/pull/34941)
    - Add xai grok-4.20 aliases and image token prices from /v1/language-models - [PR #42384](https://github.com/BerriAI/litellm/pull/42384)
    - Add Claude Opus 5.5 for Vertex AI and Azure AI - [PR #42599](https://github.com/BerriAI/litellm/pull/42599)
    - Add openrouter/aion-labs/aion-3.5-mini pricing - [PR #42743](https://github.com/BerriAI/litellm/pull/42743)
    - Add Azure Foundry pricing for gpt-6-sol and gpt-6-luna - [PR #42747](https://github.com/BerriAI/litellm/pull/42747)
    - Add openrouter/stealth/space-bunny-alpha - [PR #42759](https://github.com/BerriAI/litellm/pull/42759)
    - Add baseten/zai-org/GLM-5.3-Fast pricing - [PR #42764](https://github.com/BerriAI/litellm/pull/42764)
    - Add together_ai/together/Tev1-4B-experimental - [PR #42807](https://github.com/BerriAI/litellm/pull/42807)
    - Add gemini preview aliases and deep research 04-2026 rows - [PR #42833](https://github.com/BerriAI/litellm/pull/42833)
    - Add openai chat-latest, codex and deep-research rows from the model docs - [PR #42834](https://github.com/BerriAI/litellm/pull/42834)
    - Add vertex ai llama 3.3 70b, veo 2/3, virtual try-on and 2.5 tts rows - [PR #42837](https://github.com/BerriAI/litellm/pull/42837)
    - Add openrouter/openai/gpt-oss-120b:batch from the OpenRouter models API - [PR #42847](https://github.com/BerriAI/litellm/pull/42847)
    - Add gemini lyria-realtime-exp row inherited from lyria-3.5 - [PR #42848](https://github.com/BerriAI/litellm/pull/42848)
    - Add 39 together_ai chat rows priced by the Together models API - [PR #42851](https://github.com/BerriAI/litellm/pull/42851)
    - Add retired azure gpt-5 chat and o1-preview data zone rows - [PR #42878](https://github.com/BerriAI/litellm/pull/42878)
    - Add vertex_ai/gemini-3.8-live - [PR #42891](https://github.com/BerriAI/litellm/pull/42891)
    - Add wandb DeepSeek-V4.1-Flash and gemma-4-26B-A4B-it - [PR #42924](https://github.com/BerriAI/litellm/pull/42924)
    - Add azure realtime, audio and partner model rows - [PR #42954](https://github.com/BerriAI/litellm/pull/42954)
    - Sync azure models, add MAI-Image-2.6, deepseek-v4.1-flash, muse-spark-1.3 - [PR #42970](https://github.com/BerriAI/litellm/pull/42970)
    - Add supports_reasoning to azure/eu/gpt-6-astra - [PR #42989](https://github.com/BerriAI/litellm/pull/42989)
    - Add fireworks glm-5p3 US-only rows and kimi-k3-us priority prices - [PR #43092](https://github.com/BerriAI/litellm/pull/43092)
    - Add fireworks deepseek-v4p1-flash US-only rows - [PR #43097](https://github.com/BerriAI/litellm/pull/43097)
- **Price corrections**
    - Registry audit 2026-09-22, absorb open pricing PRs - [PR #42543](https://github.com/BerriAI/litellm/pull/42543)
    - Drop the unpublished cached rate from the Gemini Live preview entries - [PR #42651](https://github.com/BerriAI/litellm/pull/42651)
    - Align bedrock_mantle/openai.gpt-daybreak-blue-5.6-sol with its Bedrock model card - [PR #42672](https://github.com/BerriAI/litellm/pull/42672)
    - Align regional Bedrock Mistral Large 24.02 keys with the AWS pricing page - [PR #42684](https://github.com/BerriAI/litellm/pull/42684)
    - Registry audit 2026-09-23, in-region Bedrock Claude prices - [PR #42779](https://github.com/BerriAI/litellm/pull/42779)
    - Sync openrouter prices from the models API - [PR #42832](https://github.com/BerriAI/litellm/pull/42832)
    - Bedrock bare Claude ids priced at the Global SKU (aws-bedrock sync) - [PR #42875](https://github.com/BerriAI/litellm/pull/42875)
    - Correct gemini robotics er 2 preview audio input price - [PR #42877](https://github.com/BerriAI/litellm/pull/42877)
    - Halve openrouter deepseek-v4-flash-0731 output price - [PR #42881](https://github.com/BerriAI/litellm/pull/42881)
    - Correct fireworks kimi k3 us pricing to the published rate - [PR #42884](https://github.com/BerriAI/litellm/pull/42884)
    - Sync openrouter prices and add fireworks ember-1 - [PR #42889](https://github.com/BerriAI/litellm/pull/42889)
    - Source and chat completions endpoint for bedrock mantle gpt-5.4 and gpt-5.5 - [PR #42890](https://github.com/BerriAI/litellm/pull/42890)
    - Source for bedrock mantle gpt-5.6 luna, sol, terra and grok-4.6 - [PR #42898](https://github.com/BerriAI/litellm/pull/42898)
    - Update openrouter kimi-k2.7-code input price - [PR #42932](https://github.com/BerriAI/litellm/pull/42932)
    - Sync vertex-ai rows (gemma 4 maas cache price, chirp_2) - [PR #42942](https://github.com/BerriAI/litellm/pull/42942)
    - Retirement dates, chatgpt reasoning flags, bing pricing, bedrock mantle and mythos, azure gpt-5.6 alias, anthropic batch rates, new nebius, openrouter and xai rows - [PR #42951](https://github.com/BerriAI/litellm/pull/42951)
    - Sync openrouter prices for deepseek v4 and glm-5.3 - [PR #42952](https://github.com/BerriAI/litellm/pull/42952)
    - Add batch prices for vertex gemini-3.8-flash-cyber - [PR #42953](https://github.com/BerriAI/litellm/pull/42953)
    - Sync openrouter deepseek-v4-pro prices - [PR #42956](https://github.com/BerriAI/litellm/pull/42956)
    - Sync openrouter deepseek-v4-pro prices - [PR #42964](https://github.com/BerriAI/litellm/pull/42964)
    - Sync openrouter deepseek-v4-pro prices - [PR #42969](https://github.com/BerriAI/litellm/pull/42969)
    - Sync openrouter deepseek v4 flash, v4 pro and v4.1 flash prices - [PR #42974](https://github.com/BerriAI/litellm/pull/42974)
    - Sync openrouter deepseek-v4-pro prices - [PR #42978](https://github.com/BerriAI/litellm/pull/42978)
    - Add vertex ai priority audio input prices for gemini flash rows - [PR #42980](https://github.com/BerriAI/litellm/pull/42980)
    - Align openrouter deepseek-v4-pro cache hit price with cache read - [PR #42985](https://github.com/BerriAI/litellm/pull/42985)
    - Drop stale cache_hit field from openrouter deepseek-v4-pro - [PR #42994](https://github.com/BerriAI/litellm/pull/42994)
    - Add vertex cache read, batch and above 200k prices for gemini image preview rows - [PR #42995](https://github.com/BerriAI/litellm/pull/42995)
    - Add video and reasoning output prices to vertex gemini-omni-1.1-flash - [PR #43036](https://github.com/BerriAI/litellm/pull/43036)
    - Drop the priority input price from vertex gemini-2.5-flash-image - [PR #43050](https://github.com/BerriAI/litellm/pull/43050)
    - Add vertex priority prices for gemini-3-pro-image-preview and batch price for gemini-embedding-001 - [PR #43069](https://github.com/BerriAI/litellm/pull/43069)
    - Add video input price to gemini 3.8 live rows - [PR #43073](https://github.com/BerriAI/litellm/pull/43073)
    - Drop cache read price from vertex gemini-2.5-flash-image - [PR #43078](https://github.com/BerriAI/litellm/pull/43078)
    - Sync openrouter deepseek v4 and glm-5.3-flash prices, add mistral-large-2512 - [PR #43090](https://github.com/BerriAI/litellm/pull/43090)
    - Sync gemini priority, flex and video token prices from the Gemini API pricing page - [PR #43091](https://github.com/BerriAI/litellm/pull/43091)
    - Add gemini tts batch output prices from the Gemini API pricing page - [PR #43103](https://github.com/BerriAI/litellm/pull/43103)
    - Add openai cached image input prices from the pricing page - [PR #43143](https://github.com/BerriAI/litellm/pull/43143)
- **Deprecation and retirement dates**
    - Add azure_ai gpt-image-2 and groq llama-guard-3-8b deprecation dates - [PR #42738](https://github.com/BerriAI/litellm/pull/42738)
    - Add deprecation_date to claude-mythos-preview from the Anthropic deprecations page - [PR #42845](https://github.com/BerriAI/litellm/pull/42845)
    - Add the sora-2-pro shutdown date to the sora-2-pro-high-res rows - [PR #42846](https://github.com/BerriAI/litellm/pull/42846)
    - Add fireworks deprecation dates for kimi k2.6 fast, kimi k2.7 code fast and glm 5.2 fast us - [PR #42849](https://github.com/BerriAI/litellm/pull/42849)
    - Add the June 1, 2026 retirement date to the vertex_ai gemini-2.0-flash rows - [PR #42850](https://github.com/BerriAI/litellm/pull/42850)
    - Add fireworks deprecation date for glm 5.2 fast serverless rows - [PR #42866](https://github.com/BerriAI/litellm/pull/42866)
    - Add openai deprecation date for gpt-5-chat-latest and gpt-5-chat - [PR #42872](https://github.com/BerriAI/litellm/pull/42872)
    - Add azure gpt-4o-mini-transcribe and gpt-4o-mini-tts deprecation dates - [PR #42873](https://github.com/BerriAI/litellm/pull/42873)
    - Add fireworks 2026-09-25 deprecation dates for glm 5.2, kimi k2.6, kimi k2.7 code, deepseek v4 and muse glimmer rows - [PR #42874](https://github.com/BerriAI/litellm/pull/42874)
    - Sync vertex-ai deprecation dates from Vertex model lifecycle pages - [PR #42882](https://github.com/BerriAI/litellm/pull/42882)
    - Add azure gpt-realtime-mini deprecation date - [PR #42883](https://github.com/BerriAI/litellm/pull/42883)
    - Add azure gpt-realtime-mini-2025-10-06 deprecation date - [PR #42885](https://github.com/BerriAI/litellm/pull/42885)
    - Add azure deprecation dates for gpt-6 and gpt-realtime-whisper - [PR #42897](https://github.com/BerriAI/litellm/pull/42897)
    - Add azure deprecation dates for regional gpt-6 rows - [PR #42933](https://github.com/BerriAI/litellm/pull/42933)
    - Update azure gpt-4.1-nano and gpt-4o-2024-05-13 retirement dates - [PR #42947](https://github.com/BerriAI/litellm/pull/42947)
    - Take the later azure deprecation date for gpt-4.1-nano, gpt-4o-transcribe and gpt-realtime-2.1 - [PR #42986](https://github.com/BerriAI/litellm/pull/42986)
    - Add the Vertex shutdown date to gemini-2.5-flash-native-audio - [PR #43024](https://github.com/BerriAI/litellm/pull/43024)
    - Add azure deprecation dates from the Models API for five realtime and transcribe rows - [PR #43037](https://github.com/BerriAI/litellm/pull/43037)
    - Move azure gpt-realtime-2.1-mini deprecation date to the later Models API date - [PR #43058](https://github.com/BerriAI/litellm/pull/43058)
    - Add openai deprecation dates from the deprecations page - [PR #43102](https://github.com/BerriAI/litellm/pull/43102)
    - Add azure retirement dates from the retired Foundry models page - [PR #43104](https://github.com/BerriAI/litellm/pull/43104)
    - Add computer-use-preview deprecation date from the openai deprecations page - [PR #43116](https://github.com/BerriAI/litellm/pull/43116)
    - Add azure retirement dates for command-r-plus and gpt-4 - [PR #43117](https://github.com/BerriAI/litellm/pull/43117)
    - Add together-ai deprecation dates for gpt-oss-20b and gemma-4-31B-it - [PR #43127](https://github.com/BerriAI/litellm/pull/43127)
- **Removals and cleanup**
    - Remove models past their deprecation date - [PR #42435](https://github.com/BerriAI/litellm/pull/42435)
    - Remove retired models flagged by the provider sync - [PR #42521](https://github.com/BerriAI/litellm/pull/42521)
    - Drop duplicate cache_read_input_token_cost_batches keys from the price maps - [PR #42623](https://github.com/BerriAI/litellm/pull/42623)
- **Automated provider price syncs** (78 PRs: OpenRouter 51, AWS Bedrock 11, OpenAI 3, Baseten 3, Vertex AI 3, Azure 2, Google Gemini 2, Together AI 1, Fireworks AI 1, xAI 1)
    - [PR #42077](https://github.com/BerriAI/litellm/pull/42077), [PR #42082](https://github.com/BerriAI/litellm/pull/42082), [PR #42089](https://github.com/BerriAI/litellm/pull/42089), [PR #42092](https://github.com/BerriAI/litellm/pull/42092), [PR #42096](https://github.com/BerriAI/litellm/pull/42096), [PR #42154](https://github.com/BerriAI/litellm/pull/42154), [PR #42155](https://github.com/BerriAI/litellm/pull/42155), [PR #42157](https://github.com/BerriAI/litellm/pull/42157), [PR #42162](https://github.com/BerriAI/litellm/pull/42162), [PR #42163](https://github.com/BerriAI/litellm/pull/42163), [PR #42164](https://github.com/BerriAI/litellm/pull/42164), [PR #42166](https://github.com/BerriAI/litellm/pull/42166), [PR #42168](https://github.com/BerriAI/litellm/pull/42168), [PR #42169](https://github.com/BerriAI/litellm/pull/42169), [PR #42175](https://github.com/BerriAI/litellm/pull/42175), [PR #42178](https://github.com/BerriAI/litellm/pull/42178), [PR #42179](https://github.com/BerriAI/litellm/pull/42179), [PR #42182](https://github.com/BerriAI/litellm/pull/42182), [PR #42184](https://github.com/BerriAI/litellm/pull/42184), [PR #42187](https://github.com/BerriAI/litellm/pull/42187), [PR #42192](https://github.com/BerriAI/litellm/pull/42192), [PR #42227](https://github.com/BerriAI/litellm/pull/42227), [PR #42234](https://github.com/BerriAI/litellm/pull/42234), [PR #42240](https://github.com/BerriAI/litellm/pull/42240), [PR #42243](https://github.com/BerriAI/litellm/pull/42243), [PR #42246](https://github.com/BerriAI/litellm/pull/42246), [PR #42249](https://github.com/BerriAI/litellm/pull/42249), [PR #42250](https://github.com/BerriAI/litellm/pull/42250), [PR #42251](https://github.com/BerriAI/litellm/pull/42251), [PR #42253](https://github.com/BerriAI/litellm/pull/42253), [PR #42254](https://github.com/BerriAI/litellm/pull/42254), [PR #42258](https://github.com/BerriAI/litellm/pull/42258), [PR #42261](https://github.com/BerriAI/litellm/pull/42261), [PR #42265](https://github.com/BerriAI/litellm/pull/42265), [PR #42269](https://github.com/BerriAI/litellm/pull/42269), [PR #42270](https://github.com/BerriAI/litellm/pull/42270), [PR #42279](https://github.com/BerriAI/litellm/pull/42279), [PR #42280](https://github.com/BerriAI/litellm/pull/42280), [PR #42289](https://github.com/BerriAI/litellm/pull/42289), [PR #42290](https://github.com/BerriAI/litellm/pull/42290), [PR #42297](https://github.com/BerriAI/litellm/pull/42297), [PR #42298](https://github.com/BerriAI/litellm/pull/42298), [PR #42305](https://github.com/BerriAI/litellm/pull/42305), [PR #42320](https://github.com/BerriAI/litellm/pull/42320), [PR #42333](https://github.com/BerriAI/litellm/pull/42333), [PR #42337](https://github.com/BerriAI/litellm/pull/42337), [PR #42338](https://github.com/BerriAI/litellm/pull/42338), [PR #42349](https://github.com/BerriAI/litellm/pull/42349), [PR #42357](https://github.com/BerriAI/litellm/pull/42357), [PR #42365](https://github.com/BerriAI/litellm/pull/42365), [PR #42371](https://github.com/BerriAI/litellm/pull/42371), [PR #42377](https://github.com/BerriAI/litellm/pull/42377), [PR #42381](https://github.com/BerriAI/litellm/pull/42381), [PR #42407](https://github.com/BerriAI/litellm/pull/42407), [PR #42418](https://github.com/BerriAI/litellm/pull/42418), [PR #42438](https://github.com/BerriAI/litellm/pull/42438), [PR #42485](https://github.com/BerriAI/litellm/pull/42485), [PR #42500](https://github.com/BerriAI/litellm/pull/42500), [PR #42501](https://github.com/BerriAI/litellm/pull/42501), [PR #42502](https://github.com/BerriAI/litellm/pull/42502), [PR #42557](https://github.com/BerriAI/litellm/pull/42557), [PR #42558](https://github.com/BerriAI/litellm/pull/42558), [PR #42577](https://github.com/BerriAI/litellm/pull/42577), [PR #42578](https://github.com/BerriAI/litellm/pull/42578), [PR #42589](https://github.com/BerriAI/litellm/pull/42589), [PR #42590](https://github.com/BerriAI/litellm/pull/42590), [PR #42591](https://github.com/BerriAI/litellm/pull/42591), [PR #42592](https://github.com/BerriAI/litellm/pull/42592), [PR #42632](https://github.com/BerriAI/litellm/pull/42632), [PR #42642](https://github.com/BerriAI/litellm/pull/42642), [PR #42648](https://github.com/BerriAI/litellm/pull/42648), [PR #42673](https://github.com/BerriAI/litellm/pull/42673), [PR #42677](https://github.com/BerriAI/litellm/pull/42677), [PR #42680](https://github.com/BerriAI/litellm/pull/42680), [PR #42685](https://github.com/BerriAI/litellm/pull/42685), [PR #42756](https://github.com/BerriAI/litellm/pull/42756), [PR #42771](https://github.com/BerriAI/litellm/pull/42771), [PR #42806](https://github.com/BerriAI/litellm/pull/42806)

## LLM API Endpoints

### Responses API

- Stream one lifecycle across MCP auto-execute rounds - [PR #40121](https://github.com/BerriAI/litellm/pull/40121)
- Stop agentic follow-up from passing request params twice - [PR #41560](https://github.com/BerriAI/litellm/pull/41560)
- Patch custom_tool_call_output in place on guardrail write-back - [PR #41561](https://github.com/BerriAI/litellm/pull/41561)
- Forward safety_identifier through the chat completion bridge - [PR #42193](https://github.com/BerriAI/litellm/pull/42193)
- Build follow-up kwargs in one place so no executor can repeat a request param - [PR #42307](https://github.com/BerriAI/litellm/pull/42307)
- Drop client_metadata and merge system messages for Databricks chat-only models - [PR #42390](https://github.com/BerriAI/litellm/pull/42390)

### Agents and Agent-to-Agent

- Attach access groups to agents and enforce them for models, MCP servers and agent calls - [PR #41634](https://github.com/BerriAI/litellm/pull/41634)
- Send message/stream for Bedrock AgentCore streaming requests - [PR #42239](https://github.com/BerriAI/litellm/pull/42239)
- Add optional per-agent kill switch webhook - [PR #42841](https://github.com/BerriAI/litellm/pull/42841)

### OCR

- Remove the Python OCR execution path and require the Rust route - [PR #43081](https://github.com/BerriAI/litellm/pull/43081)

### Realtime and Audio

- Surface an upstream handshake refusal as an error event and policy close - [PR #42388](https://github.com/BerriAI/litellm/pull/42388)

### Vector Stores and Search

- Keep config-defined vector stores listed and read-only - [PR #42574](https://github.com/BerriAI/litellm/pull/42574)

### Pass-through endpoints

- Add TinyFish Agent API passthrough with per-step billing - [PR #41099](https://github.com/BerriAI/litellm/pull/41099)
- Log upstream 4xx/5xx error bodies and carry them into the failure hook - [PR #42695](https://github.com/BerriAI/litellm/pull/42695)

### General

- Stop /utils/transform_request from calling the provider and blocking the event loop - [PR #33954](https://github.com/BerriAI/litellm/pull/33954)
- Prefilled GitHub issue link on unmapped internal errors - [PR #42065](https://github.com/BerriAI/litellm/pull/42065)
- Keep an explicit provider prompt_tokens=0 or completion_tokens=0 in streamed usage - [PR #42323](https://github.com/BerriAI/litellm/pull/42323)
- Let a later usage event zero out stale cache counts (#40736) - [PR #42330](https://github.com/BerriAI/litellm/pull/42330)
- Opt-in litellm_call_id in JSON error bodies - [PR #42391](https://github.com/BerriAI/litellm/pull/42391)
- Add stream and safe config flags to the bug report link - [PR #42428](https://github.com/BerriAI/litellm/pull/42428)
- Stop a nested additional_drop_params entry from crashing openai-compatible calls - [PR #42492](https://github.com/BerriAI/litellm/pull/42492)
- Point the blocked-address remediation at litellm_settings - [PR #42508](https://github.com/BerriAI/litellm/pull/42508)
- Isolate callback errors in async_post_call_success_deployment_hook - [PR #42535](https://github.com/BerriAI/litellm/pull/42535)
- Repair seven regressions caught by CircleCI on main - [PR #42640](https://github.com/BerriAI/litellm/pull/42640)
- Stop stream_chunk_size reaching provider request bodies - [PR #42664](https://github.com/BerriAI/litellm/pull/42664)


## Management Endpoints / UI

### Admin UI

- Surface the owner's user budget on keys without their own budget - [PR #38220](https://github.com/BerriAI/litellm/pull/38220)
- Add upgrade banner with latest release changelog stats - [PR #40429](https://github.com/BerriAI/litellm/pull/40429)
- Let the Create Key user picker find users by user_id, not just email - [PR #41687](https://github.com/BerriAI/litellm/pull/41687)
- Add internal-user savings and auto-router usage - [PR #42026](https://github.com/BerriAI/litellm/pull/42026)
- Show prompt caching requests and net savings - [PR #42055](https://github.com/BerriAI/litellm/pull/42055)
- Show Capability and FUSE v2 routing forecasts - [PR #42057](https://github.com/BerriAI/litellm/pull/42057)
- Expose remaining complexity router advanced settings - [PR #42293](https://github.com/BerriAI/litellm/pull/42293)
- Add per-user breakdown to team usage export - [PR #42367](https://github.com/BerriAI/litellm/pull/42367)
- Rename reminder markers to Ignore Custom Tags - [PR #42370](https://github.com/BerriAI/litellm/pull/42370)
- Add native LiteAdmin assistant - [PR #42443](https://github.com/BerriAI/litellm/pull/42443)
- Add span type filter to request logs - [PR #42491](https://github.com/BerriAI/litellm/pull/42491)
- Simplify auto-router setup and clarify feature limits - [PR #42625](https://github.com/BerriAI/litellm/pull/42625)
- Show ten prompt caching requests per page - [PR #42638](https://github.com/BerriAI/litellm/pull/42638)
- Prefer native providers in auto-router presets - [PR #42639](https://github.com/BerriAI/litellm/pull/42639)
- Keep per-user MCP credentials updatable and clearable after setup - [PR #42652](https://github.com/BerriAI/litellm/pull/42652)
- Keep untouched stored auto-router booleans and reminder marker casing on save - [PR #42703](https://github.com/BerriAI/litellm/pull/42703)
- Hide LiteAdmin in Playground and add admin preference - [PR #42755](https://github.com/BerriAI/litellm/pull/42755)
- Make the audit log detail drawer wider and resizable - [PR #42808](https://github.com/BerriAI/litellm/pull/42808)
- Offer reset of custom member budgets when team default changes - [PR #42835](https://github.com/BerriAI/litellm/pull/42835)
- Configure prompt caching request rows per page - [PR #42842](https://github.com/BerriAI/litellm/pull/42842)
- Explain unbackfilled key lifetime spend and ship a backfill script - [PR #42967](https://github.com/BerriAI/litellm/pull/42967)
- Stop following streamed tokens, add jump to bottom button - [PR #42968](https://github.com/BerriAI/litellm/pull/42968)
- Pass is_proxy_admin for proxy admins on the models page team drill-in - [PR #43003](https://github.com/BerriAI/litellm/pull/43003)
- Group cost optimization cache leakage by model group - [PR #43008](https://github.com/BerriAI/litellm/pull/43008)

### Keys, teams and authentication

- Invalidate cached object permissions on key update - [PR #36719](https://github.com/BerriAI/litellm/pull/36719)
- Accept token_id as an alternative to the plaintext key - [PR #39578](https://github.com/BerriAI/litellm/pull/39578)
- Count team unified access group MCP servers when validating key MCP grants - [PR #41231](https://github.com/BerriAI/litellm/pull/41231)
- Use the user's own budget as the ceiling for UI session personal keys - [PR #41588](https://github.com/BerriAI/litellm/pull/41588)
- Show whether a member follows the team default budget and allow resetting to it - [PR #41906](https://github.com/BerriAI/litellm/pull/41906)
- Refuse to start with an unset, empty, or publicly known master key - [PR #42019](https://github.com/BerriAI/litellm/pull/42019)
- Fail closed when the team membership lookup hits a db outage - [PR #42036](https://github.com/BerriAI/litellm/pull/42036)
- Reject deactivated JWT users and refresh cached status - [PR #42064](https://github.com/BerriAI/litellm/pull/42064)
- Breached password detection, self-service change-password and forced password reset - [PR #42278](https://github.com/BerriAI/litellm/pull/42278)
- Evict the cached user row when SCIM or /user/delete removes a user - [PR #42315](https://github.com/BerriAI/litellm/pull/42315)
- Fail closed when the JWT single-team fallback or compact editor membership read hits a DB outage - [PR #42344](https://github.com/BerriAI/litellm/pull/42344)
- Let jwt team_allowed_routes paths grant auth=true passthrough - [PR #42346](https://github.com/BerriAI/litellm/pull/42346)
- Surface a database outage from the user read as 503 no_db_connection - [PR #42399](https://github.com/BerriAI/litellm/pull/42399)
- Answer 503 no_db_connection on management routes when the caller's user read hits a database outage - [PR #42410](https://github.com/BerriAI/litellm/pull/42410)
- Enforce disable_custom_api_keys from general_settings - [PR #42437](https://github.com/BerriAI/litellm/pull/42437)
- Write key deleted audit logs for cascade and alias key deletions - [PR #42446](https://github.com/BerriAI/litellm/pull/42446)
- Revoke UI session tokens on logout and password change - [PR #42463](https://github.com/BerriAI/litellm/pull/42463)
- Configurable key_alias_pattern for key generate, update, and regenerate - [PR #42553](https://github.com/BerriAI/litellm/pull/42553)
- Let team admins update member key budgets when enabled - [PR #42555](https://github.com/BerriAI/litellm/pull/42555)
- Authorize key model aliases the same way as team aliases - [PR #43049](https://github.com/BerriAI/litellm/pull/43049)

### Proxy configuration

- Keep config-defined deployments when a config read returns no model_list - [PR #41505](https://github.com/BerriAI/litellm/pull/41505)
- Report the source of alerting, UI and router settings on read - [PR #41788](https://github.com/BerriAI/litellm/pull/41788)
- Drop cost-map metadata echoed back on model save - [PR #41944](https://github.com/BerriAI/litellm/pull/41944)
- Remove the dead telemetry flag from the SDK, proxy CLI and configs - [PR #42071](https://github.com/BerriAI/litellm/pull/42071)
- Add GET /utils/model_info to look up cost map info for unregistered models - [PR #42121](https://github.com/BerriAI/litellm/pull/42121)
- Detach stored credential when model editor selects None - [PR #42291](https://github.com/BerriAI/litellm/pull/42291)
- Admin-only /debug/report sharing the bug report environment - [PR #42440](https://github.com/BerriAI/litellm/pull/42440)
- Never render credential-bearing config keys in the bug report - [PR #42493](https://github.com/BerriAI/litellm/pull/42493)
- Make the lazy OpenAPI snapshot byte-identical on every Python version - [PR #42519](https://github.com/BerriAI/litellm/pull/42519)
- Validate model credential name only when it changes - [PR #42701](https://github.com/BerriAI/litellm/pull/42701)
- Document request body and response schemas for the Responses API in OpenAPI - [PR #42802](https://github.com/BerriAI/litellm/pull/42802)
- Honor model_info.discoverable on the model listing endpoints - [PR #42825](https://github.com/BerriAI/litellm/pull/42825)
- List key and team model aliases in GET /v1/models - [PR #42908](https://github.com/BerriAI/litellm/pull/42908)
- Let callbacks filter the model listing routes per caller - [PR #43027](https://github.com/BerriAI/litellm/pull/43027)

### CLI and coding agents

- Add --validate_config dry-run flag - [PR #41705](https://github.com/BerriAI/litellm/pull/41705)
- Preserve newer installed status lines during setup - [PR #42356](https://github.com/BerriAI/litellm/pull/42356)
- Import proxy_server once on script-style boot - [PR #42584](https://github.com/BerriAI/litellm/pull/42584)

### Deployment

- Render a fixed replicaCount on componentized deployments when HPA is disabled - [PR #42207](https://github.com/BerriAI/litellm/pull/42207)
- Add a quickstart compose file served from the product repo - [PR #42326](https://github.com/BerriAI/litellm/pull/42326)
- Expose /api/event_logging/batch on the gateway allowlist - [PR #42572](https://github.com/BerriAI/litellm/pull/42572)
- Bump wolfi-base digest to pick up glibc 2.44-r6 - [PR #42643](https://github.com/BerriAI/litellm/pull/42643)

### Terraform

- Expose server_metadata on litellm_key so undeclared metadata is visible - [PR #42453](https://github.com/BerriAI/litellm/pull/42453)
- Add display_name to litellm_model resource and model data sources - [PR #42987](https://github.com/BerriAI/litellm/pull/42987)


## AI Integrations

### Guardrails

- Scan each choice's tool-call arguments apart on n&gt;1 streams and log why a rewrite was discarded - [PR #40986](https://github.com/BerriAI/litellm/pull/40986)
- Straiker guardrail speaks the v3 platform API (/api/v3/detect) - [PR #41880](https://github.com/BerriAI/litellm/pull/41880)
- Add default fallback policy attachments - [PR #42119](https://github.com/BerriAI/litellm/pull/42119)
- Opt-in include_guardrail_response returns guardrail_information in the response - [PR #42327](https://github.com/BerriAI/litellm/pull/42327)
- Mask PII in streaming /v1/messages output - [PR #42351](https://github.com/BerriAI/litellm/pull/42351)
- Run key-attached guardrails on /v1/videos - [PR #42354](https://github.com/BerriAI/litellm/pull/42354)
- Store the masked output in spend logs when Presidio masks the response - [PR #42441](https://github.com/BerriAI/litellm/pull/42441)
- Keep inherited parent guardrails when a child policy condition misses - [PR #42548](https://github.com/BerriAI/litellm/pull/42548)
- Gate disable_global_guardrails on keys and teams to proxy admins - [PR #42699](https://github.com/BerriAI/litellm/pull/42699)
- Stream non-Anthropic raw SSE through the post_call hook unbuffered - [PR #42777](https://github.com/BerriAI/litellm/pull/42777)
- Keep deployment labels on cache-hit post_call guardrail rejections - [PR #42780](https://github.com/BerriAI/litellm/pull/42780)
- Mask streamed /v1/messages output when the first upstream read is a keepalive, a data-less ping, or a split utf8 character - [PR #43023](https://github.com/BerriAI/litellm/pull/43023)

### Logging and observability

- Migrate the sdk callback to langfuse v4. The Docker image now ships `langfuse>=4.7,<5`. If you install the SDK yourself, upgrade from `langfuse` 2.x or 3.x, which the logger now rejects at startup. Traces go through Langfuse's OpenTelemetry (OTLP) ingestion, so a self-hosted Langfuse server must accept OTLP, and trace ids and span nesting differ from the v2 integration - [PR #36741](https://github.com/BerriAI/litellm/pull/36741)
- Replace colons in generated log filenames - [PR #40452](https://github.com/BerriAI/litellm/pull/40452)
- Attribute provider and model_info on pre_call_hook rejections - [PR #41077](https://github.com/BerriAI/litellm/pull/41077)
- Bound concurrent S3 uploads per flush and add opt-in JSONL batch files - [PR #41258](https://github.com/BerriAI/litellm/pull/41258)
- Keep intercepted searches under the parent request's session and trace - [PR #41711](https://github.com/BerriAI/litellm/pull/41711)
- Add normalized_error cluster key to error_information - [PR #41715](https://github.com/BerriAI/litellm/pull/41715)
- Honor SSL_CERT_FILE and ssl_verify in OTLP HTTP exporters - [PR #42106](https://github.com/BerriAI/litellm/pull/42106)
- Apply DB-stored callback redaction settings before logger init - [PR #42122](https://github.com/BerriAI/litellm/pull/42122)
- Map OCR page markdown onto the generation output - [PR #42267](https://github.com/BerriAI/litellm/pull/42267)
- Deliver every distinct alert queued in one flush window - [PR #42314](https://github.com/BerriAI/litellm/pull/42314)
- Make flush() survive an event loop change - [PR #42355](https://github.com/BerriAI/litellm/pull/42355)
- Per-team success and error sampling rates for the Arize AX callback - [PR #42383](https://github.com/BerriAI/litellm/pull/42383)
- Price terminal Responses stream events from their inner response - [PR #42385](https://github.com/BerriAI/litellm/pull/42385)
- Map completions, images, speech, transcription and moderation output onto the Langfuse generation output - [PR #42394](https://github.com/BerriAI/litellm/pull/42394)
- Json.dumps with default=str so non-serializable metadata does not crash batch flush - [PR #42424](https://github.com/BerriAI/litellm/pull/42424)
- Record the GenAI exception event through the Logs API on both OpenTelemetry lines - [PR #42431](https://github.com/BerriAI/litellm/pull/42431)
- Map rerank and search output and the OCR, image edit and search input onto the Langfuse generation - [PR #42444](https://github.com/BerriAI/litellm/pull/42444)
- Keep text completion choice fields beside the synthesized message - [PR #42537](https://github.com/BerriAI/litellm/pull/42537)
- Replay approved pre-call guardrail snapshots - [PR #42774](https://github.com/BerriAI/litellm/pull/42774)
- Scan the exceeded budget wording linearly so a crafted error message cannot stall the proxy - [PR #42778](https://github.com/BerriAI/litellm/pull/42778)
- Pass provider response headers to callbacks on every endpoint - [PR #42824](https://github.com/BerriAI/litellm/pull/42824)
- Root post-response service spans in their own trace linked to the request - [PR #42826](https://github.com/BerriAI/litellm/pull/42826)
- Add model_group label to deployment request and rate limit metrics - [PR #42966](https://github.com/BerriAI/litellm/pull/42966)
- Upload fresh events first, drop terminal failures and hour-old retries by default, opt-in adaptive concurrency - [PR #43022](https://github.com/BerriAI/litellm/pull/43022)

### Secret Managers

- Restore secret scheduled for deletion instead of failing CreateSecret - [PR #42454](https://github.com/BerriAI/litellm/pull/42454)
- Route secret resolution through native Rust backends - [PR #42619](https://github.com/BerriAI/litellm/pull/42619)


## Spend Tracking, Budgets and Rate Limiting

### Cost tracking

- Honor deployment pricing for image generation - [PR #39311](https://github.com/BerriAI/litellm/pull/39311)
- Bill batch prompts above 272K at OpenAI's long-context batch tier - [PR #39861](https://github.com/BerriAI/litellm/pull/39861)
- Attribute CLI session spend to the per-user cli-session alias instead of the hashed session token - [PR #40541](https://github.com/BerriAI/litellm/pull/40541)
- Warn and count $0 cost on billable requests - [PR #42345](https://github.com/BerriAI/litellm/pull/42345)
- Honor per-second custom pricing on chat completions for every provider - [PR #42403](https://github.com/BerriAI/litellm/pull/42403)
- Return 400 from /spend/calculate for a model with no pricing row - [PR #42497](https://github.com/BerriAI/litellm/pull/42497)
- Capture-rate check of LiteLLM spend against the OpenAI bill - [PR #43044](https://github.com/BerriAI/litellm/pull/43044)
- Apply a deployment's pricing override to realtime sessions - [PR #43114](https://github.com/BerriAI/litellm/pull/43114)

### Budgets

- Renew budget reservation counter TTL while the request is in flight - [PR #40322](https://github.com/BerriAI/litellm/pull/40322)
- Enforce virtual key budgets for JEV test routing - [PR #41879](https://github.com/BerriAI/litellm/pull/41879)
- Return 422 instead of 429 for BudgetExceededError - [PR #42097](https://github.com/BerriAI/litellm/pull/42097)
- Release unclaimed budget reservations at request end - [PR #42304](https://github.com/BerriAI/litellm/pull/42304)
- Await budget redis pipeline before sync reads (internal copy of #32618) - [PR #43125](https://github.com/BerriAI/litellm/pull/43125)

### Rate limiting

- Enforce tpm_limit and rpm_limit set on tag objects - [PR #41807](https://github.com/BerriAI/litellm/pull/41807)
- Share model rate-limit buckets between a model_group_alias and its target - [PR #42516](https://github.com/BerriAI/litellm/pull/42516)


## MCP Gateway

### MCP Gateway

- Handle split UTF-8 routing previews - [PR #34919](https://github.com/BerriAI/litellm/pull/34919)
- Paginate prompt and resource discovery - [PR #39189](https://github.com/BerriAI/litellm/pull/39189)
- Keep oauth scopes in admin api credential redaction - [PR #39805](https://github.com/BerriAI/litellm/pull/39805)
- Keep server lists stable across refreshes - [PR #41074](https://github.com/BerriAI/litellm/pull/41074)
- Apply post-call rewrites without stale structured output - [PR #41530](https://github.com/BerriAI/litellm/pull/41530)
- Tools/call no longer 404s on a worker that has not served tools/list - [PR #42072](https://github.com/BerriAI/litellm/pull/42072)
- Explain missing public client dependencies - [PR #42148](https://github.com/BerriAI/litellm/pull/42148)
- Keep config-defined servers read-only - [PR #42299](https://github.com/BerriAI/litellm/pull/42299)
- Restore legacy SSE and bounded cancellation cleanup - [PR #42382](https://github.com/BerriAI/litellm/pull/42382)
- Cap an agent key's tools at what the invoking user and team may call - [PR #42478](https://github.com/BerriAI/litellm/pull/42478)
- Preserve discovery attribution and sanitize logging headers - [PR #42541](https://github.com/BerriAI/litellm/pull/42541)
- Preserve credential authority in DCR bridge authentication - [PR #42563](https://github.com/BerriAI/litellm/pull/42563)
- Reject origins outside the configured allowlist - [PR #42649](https://github.com/BerriAI/litellm/pull/42649)
- Return 401 challenge for REST token-exchange tool calls without a subject token - [PR #42782](https://github.com/BerriAI/litellm/pull/42782)
- Forward caller bearer on REST oauth_delegate tool calls - [PR #42787](https://github.com/BerriAI/litellm/pull/42787)
- Keep tool attribution on guardrail-blocked REST calls - [PR #42790](https://github.com/BerriAI/litellm/pull/42790)
- Reject duplicate MCP server names and aliases - [PR #42791](https://github.com/BerriAI/litellm/pull/42791)
- Allow ["\*"] wildcard in mcp_tool_permissions to grant all current and future tools - [PR #43108](https://github.com/BerriAI/litellm/pull/43108)


## Performance / Loadbalancing / Reliability improvements

### Auto Router and model routing

- Add configurable provider affinity header mapping - [PR #41033](https://github.com/BerriAI/litellm/pull/41033)
- Make context-window escalation opt-in - [PR #41872](https://github.com/BerriAI/litellm/pull/41872)
- Add JEV classifier alongside LLM classifier - [PR #41886](https://github.com/BerriAI/litellm/pull/41886)
- Add NotFoundErrorRetries so a retry policy can pin 404 retries - [PR #42045](https://github.com/BerriAI/litellm/pull/42045)
- Skip cooldown for background response cost poll 404s - [PR #42046](https://github.com/BerriAI/litellm/pull/42046)
- Stamp model_group when retrieving a batch, so batch tokens are attributable (internal copy of #38499) - [PR #42062](https://github.com/BerriAI/litellm/pull/42062)
- Native compact-to-fit across conversation APIs - [PR #42074](https://github.com/BerriAI/litellm/pull/42074)
- Keep prompt caching affinity when the breakpoint moves - [PR #42080](https://github.com/BerriAI/litellm/pull/42080)
- Configure heuristic v2 success threshold - [PR #42252](https://github.com/BerriAI/litellm/pull/42252)
- Walk every entry of a fallback list after a mid-stream failure - [PR #42283](https://github.com/BerriAI/litellm/pull/42283)
- Add group-scoped priority routing strategy - [PR #42378](https://github.com/BerriAI/litellm/pull/42378)
- Time-windowed team reservation of deployments via model_info.access_windows - [PR #42398](https://github.com/BerriAI/litellm/pull/42398)
- Explain fallback outcome in plain words in the raised error - [PR #42509](https://github.com/BerriAI/litellm/pull/42509)
- Serve Responses turns from a sibling when the encrypted content origin has no boundary peer - [PR #43015](https://github.com/BerriAI/litellm/pull/43015)
- Match provider-prefixed fallback keys for bare model groups served by wildcard deployments - [PR #43062](https://github.com/BerriAI/litellm/pull/43062)
- Honor disable_fallbacks on mid-stream fallback - [PR #43111](https://github.com/BerriAI/litellm/pull/43111)

### Caching, database and runtime

- Authenticate sync clusters with IAM credential providers - [PR #40204](https://github.com/BerriAI/litellm/pull/40204)
- Coordinate v2 migration startup and qualify container recovery - [PR #40932](https://github.com/BerriAI/litellm/pull/40932)
- Record aborted outcome when spend-log cleanup is cancelled at shutdown - [PR #41213](https://github.com/BerriAI/litellm/pull/41213)
- Wait for the spend-log table before creating startup views - [PR #41974](https://github.com/BerriAI/litellm/pull/41974)
- Stop re-sending un-resendable spend batches from the Redis buffer - [PR #41994](https://github.com/BerriAI/litellm/pull/41994)
- Park requeued spend logs in Redis so they survive a pod restart during a DB outage - [PR #42022](https://github.com/BerriAI/litellm/pull/42022)
- Default to the v2 migration resolver - [PR #42105](https://github.com/BerriAI/litellm/pull/42105)
- Publish auth cache invalidations in the background so a wedged coordination Redis cannot stall user updates - [PR #42534](https://github.com/BerriAI/litellm/pull/42534)
- Honor DATABASE_DISABLE_PREPARED_STATEMENTS in the litellm CLI - [PR #42556](https://github.com/BerriAI/litellm/pull/42556)
- Keep embedding cache hits aligned with request inputs - [PR #42571](https://github.com/BerriAI/litellm/pull/42571)
- Keep the in-flight daily spend batch when shutdown cancels the flush - [PR #42593](https://github.com/BerriAI/litellm/pull/42593)
- Fail parked DB lookups at a deadline and flip readiness while they stall - [PR #42654](https://github.com/BerriAI/litellm/pull/42654)
- Do not requeue a daily spend batch whose commit already left for postgres - [PR #42786](https://github.com/BerriAI/litellm/pull/42786)
- Apply user_api_key_cache_max_size to the key object partition - [PR #42796](https://github.com/BerriAI/litellm/pull/42796)
- Stamp provider on sync cache-hit logs so responses spend logs record provider - [PR #42830](https://github.com/BerriAI/litellm/pull/42830)

### Native Rust runtime (opt-in)

- Preserve Python defaults with opt-in Rust dispatch - [PR #42174](https://github.com/BerriAI/litellm/pull/42174)
- Add native disk cache backend - [PR #42311](https://github.com/BerriAI/litellm/pull/42311)
- Add native S3 cache backend - [PR #42313](https://github.com/BerriAI/litellm/pull/42313)
- Add native Valkey semantic cache backend - [PR #42316](https://github.com/BerriAI/litellm/pull/42316)
- Serve RedisClusterCache natively as a Redis topology - [PR #42317](https://github.com/BerriAI/litellm/pull/42317)
- Serve Redis Semantic caches natively in Rust - [PR #42319](https://github.com/BerriAI/litellm/pull/42319)
- Native Azure Blob response cache backend - [PR #42321](https://github.com/BerriAI/litellm/pull/42321)
- Serve QdrantSemanticCache natively from Rust - [PR #42324](https://github.com/BerriAI/litellm/pull/42324)
- Add native GCS object-store cache backend - [PR #42325](https://github.com/BerriAI/litellm/pull/42325)
- Align the cache crates with Python and wire every native backend - [PR #42530](https://github.com/BerriAI/litellm/pull/42530)
- Dispatch Python logging through the Rust diagnostics processor - [PR #42616](https://github.com/BerriAI/litellm/pull/42616)
- Stamp x-litellm-rust on native sync and async streams at the bridge boundary - [PR #42758](https://github.com/BerriAI/litellm/pull/42758)
- Shape Anthropic Messages requests natively - [PR #42982](https://github.com/BerriAI/litellm/pull/42982)
- Read secrets through Python from Rust routes and declare Rust-only routes with NO_PYTHON - [PR #43057](https://github.com/BerriAI/litellm/pull/43057)
- Hand upstream response headers to the native Messages stream - [PR #43178](https://github.com/BerriAI/litellm/pull/43178)
- Traverse and release the retained headers dict - [PR #43274](https://github.com/BerriAI/litellm/pull/43274)


## Documentation Updates

### Documentation

- Stop advertising sk-1234 as the master key in shipped configs and examples - [PR #42011](https://github.com/BerriAI/litellm/pull/42011)


## Tests, CI and Internal Changes

These 184 PRs change tests, CI, contributor tooling, release packaging, or Rust runtime scaffolding that is not yet wired into a user-facing path. They do not change proxy or SDK behavior on their own

<details>
<summary>Tests (108)</summary>

- Replace custom endpoints_client with provider SDK clients - [PR #34358](https://github.com/BerriAI/litellm/pull/34358)
- Assert cache-priced vertex grok rows advertise supports_prompt_caching - [PR #41526](https://github.com/BerriAI/litellm/pull/41526)
- Cover actor edges and wildcard models - [PR #41769](https://github.com/BerriAI/litellm/pull/41769)
- Cover dashboard form journeys - [PR #41773](https://github.com/BerriAI/litellm/pull/41773)
- Cover chat and responses registry gaps - [PR #41794](https://github.com/BerriAI/litellm/pull/41794)
- Cover legacy lowest TPM selection - [PR #41795](https://github.com/BerriAI/litellm/pull/41795)
- Endpoint, breakdown component and failure support in the cost harness - [PR #41999](https://github.com/BerriAI/litellm/pull/41999)
- Embeddings, rerank, completions and moderations cost cases - [PR #42020](https://github.com/BerriAI/litellm/pull/42020)
- Audio, image and per-unit cost cases - [PR #42024](https://github.com/BerriAI/litellm/pull/42024)
- Passthrough route cost cases - [PR #42028](https://github.com/BerriAI/litellm/pull/42028)
- Pricing dimension and provider reported cost cases - [PR #42035](https://github.com/BerriAI/litellm/pull/42035)
- Restore scoped execution and credential isolation regressions - [PR #42050](https://github.com/BerriAI/litellm/pull/42050)
- Restore MCP OAuth happy-path coverage (LIT-3467) - [PR #42051](https://github.com/BerriAI/litellm/pull/42051)
- Provider wire cost cases - [PR #42052](https://github.com/BerriAI/litellm/pull/42052)
- Proxy behaviour cost cases - [PR #42060](https://github.com/BerriAI/litellm/pull/42060)
- Add autorouter estimate keys to the GCS pub/sub spend-log golden - [PR #42061](https://github.com/BerriAI/litellm/pull/42061)
- Batch and realtime cost cases - [PR #42066](https://github.com/BerriAI/litellm/pull/42066)
- Migrate phase 6 provider unit tests to tests/unit - [PR #42107](https://github.com/BerriAI/litellm/pull/42107)
- Migrate wave 1 phase 2 legacy unit tests to tests/unit - [PR #42108](https://github.com/BerriAI/litellm/pull/42108)
- Migrate phase 5 provider unit tests to tests/unit - [PR #42109](https://github.com/BerriAI/litellm/pull/42109)
- Migrate bedrock, baseten and base_llm batch tests to tests/unit - [PR #42110](https://github.com/BerriAI/litellm/pull/42110)
- Migrate wave 1 phase 8 legacy llm tests to tests/unit - [PR #42112](https://github.com/BerriAI/litellm/pull/42112)
- Block external sockets at import time and add a socket policy regression test - [PR #42113](https://github.com/BerriAI/litellm/pull/42113)
- Migrate phase 7 provider unit tests to tests/unit - [PR #42114](https://github.com/BerriAI/litellm/pull/42114)
- Migrate nvidia, oci, ocr, oobabooga and openai legacy tests to tests/unit - [PR #42115](https://github.com/BerriAI/litellm/pull/42115)
- Migrate phase 9 legacy llm provider tests to tests/unit - [PR #42117](https://github.com/BerriAI/litellm/pull/42117)
- Migrate wave 1 phase 3 anthropic, apiserpent, azure and azure_ai legacy tests - [PR #42118](https://github.com/BerriAI/litellm/pull/42118)
- Boot the unified Google proxy fixture with a real master key - [PR #42120](https://github.com/BerriAI/litellm/pull/42120)
- Migrate wave 1 phase 1 legacy tests to tests/unit - [PR #42123](https://github.com/BerriAI/litellm/pull/42123)
- Deflake fuzzy picker, breached-password HIBP, and MCP stdio timeout tests (rolling deflake 2026-09-22) - [PR #42125](https://github.com/BerriAI/litellm/pull/42125)
- Migrate openai, openai_like and openrouter legacy tests to tests/unit - [PR #42128](https://github.com/BerriAI/litellm/pull/42128)
- Migrate phase 16 legacy tests to tests/unit - [PR #42131](https://github.com/BerriAI/litellm/pull/42131)
- Migrate phase 14 wave 2 provider tests to tests/unit - [PR #42132](https://github.com/BerriAI/litellm/pull/42132)
- Make every tests/unit directory a package so pytest collection is unique - [PR #42135](https://github.com/BerriAI/litellm/pull/42135)
- Migrate phase 15 legacy tests to tests/unit - [PR #42136](https://github.com/BerriAI/litellm/pull/42136)
- Migrate phase 12 legacy llm provider tests to tests/unit - [PR #42137](https://github.com/BerriAI/litellm/pull/42137)
- Migrate legacy provider tests to tests/unit (wave 2, phase 13) - [PR #42145](https://github.com/BerriAI/litellm/pull/42145)
- Migrate a2a_protocol legacy tests to tests/unit (wave 3 phase 17) - [PR #42160](https://github.com/BerriAI/litellm/pull/42160)
- Cover the release-to-release upgrade path - [PR #42294](https://github.com/BerriAI/litellm/pull/42294)
- Fix stale budget-status and bad-database-url assertions - [PR #42339](https://github.com/BerriAI/litellm/pull/42339)
- Add conversational matrix across chat, messages and responses - [PR #42359](https://github.com/BerriAI/litellm/pull/42359)
- Isolate the agent read-through singleton between unknown-agent tests - [PR #42389](https://github.com/BerriAI/litellm/pull/42389)
- Move Xiaomi MiMo coverage from live e2e to the providers wire shard - [PR #42395](https://github.com/BerriAI/litellm/pull/42395)
- Chain a proxy-issued previous_response_id in the cost suite - [PR #42396](https://github.com/BerriAI/litellm/pull/42396)
- Check the MCP Tools tab against the upstream's own tools/list - [PR #42397](https://github.com/BerriAI/litellm/pull/42397)
- Make bedrock collector and secret scan timing tests deterministic - [PR #42405](https://github.com/BerriAI/litellm/pull/42405)
- Assert a cooldown reaches a sibling replica within the 1s Redis read interval - [PR #42422](https://github.com/BerriAI/litellm/pull/42422)
- Make the detailed-timing receive-anchor test timezone independent - [PR #42429](https://github.com/BerriAI/litellm/pull/42429)
- Give every ui settings endpoint test a fresh settings store - [PR #42430](https://github.com/BerriAI/litellm/pull/42430)
- Add secret manager lanes for HashiCorp Vault and CyberArk Conjur - [PR #42503](https://github.com/BerriAI/litellm/pull/42503)
- Run the memory cell alone on the shared stack - [PR #42518](https://github.com/BerriAI/litellm/pull/42518)
- Move unified_google_tests to gemini-3.5-flash-lite - [PR #42520](https://github.com/BerriAI/litellm/pull/42520)
- Drop route dispatch assertions, test the bridge directly - [PR #42536](https://github.com/BerriAI/litellm/pull/42536)
- One request lands the same spend on every surface - [PR #42540](https://github.com/BerriAI/litellm/pull/42540)
- Guard leaked cassette patches and make injected-transport embedding tests immune - [PR #42542](https://github.com/BerriAI/litellm/pull/42542)
- Hold every worker under an idle RSS budget before any traffic - [PR #42552](https://github.com/BerriAI/litellm/pull/42552)
- Count a zombie grandchild as gone in the migrate deploy timeout test - [PR #42570](https://github.com/BerriAI/litellm/pull/42570)
- Make two proxy-infra tests independent of sibling-test state - [PR #42581](https://github.com/BerriAI/litellm/pull/42581)
- Point unit tests at model ids still in the cost map - [PR #42606](https://github.com/BerriAI/litellm/pull/42606)
- Accept the per-size image cost keys in the price-map schema check - [PR #42612](https://github.com/BerriAI/litellm/pull/42612)
- Point image-generation deployment price test at a live gemini row - [PR #42615](https://github.com/BerriAI/litellm/pull/42615)
- Point CircleCI-only suites at models still in the cost map - [PR #42617](https://github.com/BerriAI/litellm/pull/42617)
- Regression tests for August provider translation and streaming bugs - [PR #42621](https://github.com/BerriAI/litellm/pull/42621)
- Regression tests for August cost tracking and budgeting bugs - [PR #42622](https://github.com/BerriAI/litellm/pull/42622)
- Drop legacy InvalidStatusCode tests and pin websockets imports - [PR #42624](https://github.com/BerriAI/litellm/pull/42624)
- Tolerate provider-side flakes on five full-suite cells - [PR #42628](https://github.com/BerriAI/litellm/pull/42628)
- Repoint the Azure image cost test at gpt-image-2 - [PR #42631](https://github.com/BerriAI/litellm/pull/42631)
- Raise the post-success hook error from a guardrail in the failure-hook regression - [PR #42646](https://github.com/BerriAI/litellm/pull/42646)
- Allow skipped nodes and drop the shard cap - [PR #42687](https://github.com/BerriAI/litellm/pull/42687)
- Add read-replica routing harness to the CircleCI integration suite - [PR #42692](https://github.com/BerriAI/litellm/pull/42692)
- Regression tests for July provider translation, routing and streaming bugs - [PR #42693](https://github.com/BerriAI/litellm/pull/42693)
- Regression tests for July cost tracking, budgeting and spend bugs - [PR #42694](https://github.com/BerriAI/litellm/pull/42694)
- Add MCP gateway coverage wave 1 with a dedicated mcp shard and proxy coverage artifact - [PR #42711](https://github.com/BerriAI/litellm/pull/42711)
- Model the blocking OCR hook as a guardrail so its raise propagates - [PR #42775](https://github.com/BerriAI/litellm/pull/42775)
- Deterministic integration audit of the v3 platform relay - [PR #42781](https://github.com/BerriAI/litellm/pull/42781)
- Cover customer reported cache key, cache_control, bedrock request id, responses schema, scim and tag budget contracts - [PR #42785](https://github.com/BerriAI/litellm/pull/42785)
- Assert /v1/responses usage reports Anthropic system cache write then read - [PR #42855](https://github.com/BerriAI/litellm/pull/42855)
- Assert /v1/models reports max_input_tokens and max_output_tokens - [PR #42858](https://github.com/BerriAI/litellm/pull/42858)
- Cover per key tag rpm limits and tag budget_duration resets - [PR #42859](https://github.com/BerriAI/litellm/pull/42859)
- Edge-case matrices for malformed token limits and callback_settings shapes - [PR #42895](https://github.com/BerriAI/litellm/pull/42895)
- Take keys out of the legacy proxy, enterprise and mcp unit tests before moving them - [PR #42901](https://github.com/BerriAI/litellm/pull/42901)
- Assert the images sent to Ollama instead of echoing them through response - [PR #42905](https://github.com/BerriAI/litellm/pull/42905)
- Stop a comprehension variable from shadowing the body() helper - [PR #42906](https://github.com/BerriAI/litellm/pull/42906)
- Run the files peak-memory guards without coverage tracing - [PR #42914](https://github.com/BerriAI/litellm/pull/42914)
- Patch create_mcp_server_if_identifier_free in the store-model-in-db MCP tests - [PR #42916](https://github.com/BerriAI/litellm/pull/42916)
- Run the cache-hit redis outage test on the shared owned_redis helper - [PR #42925](https://github.com/BerriAI/litellm/pull/42925)
- Give the logout specs their own admin session - [PR #42930](https://github.com/BerriAI/litellm/pull/42930)
- Accept the otel cost write as a linked root trace - [PR #42931](https://github.com/BerriAI/litellm/pull/42931)
- Hide the LiteAdmin button in the shared admin session - [PR #43033](https://github.com/BerriAI/litellm/pull/43033)
- Pin end-user and tag attribution from Codex-style headers on /v1/responses - [PR #43093](https://github.com/BerriAI/litellm/pull/43093)
- Cover Azure code_interpreter container files by native id with a service-account key - [PR #43122](https://github.com/BerriAI/litellm/pull/43122)
- Reorganize core crate tests and split cache and OCR suites - [PR #43177](https://github.com/BerriAI/litellm/pull/43177)
- Agent clients for Claude Code, Codex and opencode - [PR #43181](https://github.com/BerriAI/litellm/pull/43181)
- Move tests/test_litellm root and small trees into tests/unit - [PR #43186](https://github.com/BerriAI/litellm/pull/43186)
- Move tests/test_litellm/llms into tests/unit/llms - [PR #43191](https://github.com/BerriAI/litellm/pull/43191)
- Move tests/test_litellm integrations and secret_managers into tests/unit - [PR #43194](https://github.com/BerriAI/litellm/pull/43194)
- Move tests/test_litellm core utils, routing, responses, caching and rust_bridge into tests/unit - [PR #43199](https://github.com/BerriAI/litellm/pull/43199)
- Drop the repeated UNIT_FLAG key in test_unit_shard_missing_paths - [PR #43212](https://github.com/BerriAI/litellm/pull/43212)
- Stop CI tests from downloading tokenizer files and images - [PR #43257](https://github.com/BerriAI/litellm/pull/43257)
- Fix stale and state-leaking tests red on scheduled CircleCI - [PR #43266](https://github.com/BerriAI/litellm/pull/43266)
- Finish the non-proxy half of tests/test_litellm - [PR #43281](https://github.com/BerriAI/litellm/pull/43281)
- Port langfuse callbacks-in-db coverage to the local harness - [PR #43282](https://github.com/BerriAI/litellm/pull/43282)
- Run the Langfuse DB-callback test on its own scratch database - [PR #43288](https://github.com/BerriAI/litellm/pull/43288)
- Scope the management proxy fixture to its package so its spend monitor cannot race the spend tests - [PR #43302](https://github.com/BerriAI/litellm/pull/43302)
- Assert only litellm-owned batch behavior and move the blank S3 env pin to an integration test - [PR #43321](https://github.com/BerriAI/litellm/pull/43321)
- Report batch cleanup leftovers as a plain UserWarning on rc/1.104.0 - [PR #43406](https://github.com/BerriAI/litellm/pull/43406)
- Skip the LangSmith batch serialization e2e on rc/1.104.0 until CI has a LangSmith key - [PR #43418](https://github.com/BerriAI/litellm/pull/43418)
- Stop test modules from putting their own directory on sys.path on rc/1.104.0 - [PR #43420](https://github.com/BerriAI/litellm/pull/43420)

</details>

<details>
<summary>CI (27)</summary>

- Wire tests/unit into CircleCI and keep draining GHA shards green - [PR #42103](https://github.com/BerriAI/litellm/pull/42103)
- Excuse retired test-quality rules in the budget ratchet - [PR #42116](https://github.com/BerriAI/litellm/pull/42116)
- Fix the stage-mirror batch reds and keep a redacted pytest log - [PR #42143](https://github.com/BerriAI/litellm/pull/42143)
- Let the install smoke test boot its key-less proxy config - [PR #42296](https://github.com/BerriAI/litellm/pull/42296)
- Skip cost map file checks on PRs that leave the cost map untouched - [PR #42406](https://github.com/BerriAI/litellm/pull/42406)
- Print add-mask lines only under GitHub Actions - [PR #42423](https://github.com/BerriAI/litellm/pull/42423)
- Allowlist _render_json in the recursive detector - [PR #42442](https://github.com/BerriAI/litellm/pull/42442)
- Route credential, cost map, and UI login calls to the control plane - [PR #42506](https://github.com/BerriAI/litellm/pull/42506)
- Drop dead misc shard paths and skip missing paths with a warning - [PR #42603](https://github.com/BerriAI/litellm/pull/42603)
- Move the compat-matrix populator from a GCE VM to a Render cron job - [PR #42608](https://github.com/BerriAI/litellm/pull/42608)
- Close open pull requests superseded by a merged fix on their linked issue - [PR #42609](https://github.com/BerriAI/litellm/pull/42609)
- Remove the unused create-release workflow - [PR #42696](https://github.com/BerriAI/litellm/pull/42696)
- Add merge smoke checks workflow with loopback-only harness and 11 curated cases - [PR #42709](https://github.com/BerriAI/litellm/pull/42709)
- Drop litellm_internal_staging and litellm_oss_staging references, main is the only trunk - [PR #42745](https://github.com/BerriAI/litellm/pull/42745)
- Add tests-only CircleCI pipeline with coverage and docs validation - [PR #42773](https://github.com/BerriAI/litellm/pull/42773)
- Fix the litellm-tests unit job (sysmon, codecov on failure, env -i allowlist, selection errors, reruns param) - [PR #42900](https://github.com/BerriAI/litellm/pull/42900)
- Move caching, proxy-extras, gateway and enterprise tests into tests/unit and run them from litellm-tests - [PR #42902](https://github.com/BerriAI/litellm/pull/42902)
- Move tests/proxy_unit_tests to tests/unit/proxy and run the proxy-db shards from litellm-tests - [PR #42903](https://github.com/BerriAI/litellm/pull/42903)
- Move provider-independent MCP tests into tests/unit and run mcp-integration from litellm-tests - [PR #42904](https://github.com/BerriAI/litellm/pull/42904)
- Resolve and install the Claude Code CLI per run - [PR #43038](https://github.com/BerriAI/litellm/pull/43038)
- Skip unpublished npm versions in the Claude Code PR-gate resolver - [PR #43053](https://github.com/BerriAI/litellm/pull/43053)
- Run the claude_code harness unit-test trees in the lint job - [PR #43077](https://github.com/BerriAI/litellm/pull/43077)
- Cut rc/&lt;X.Y.0&gt; off main every Friday at 3am Pacific - [PR #43121](https://github.com/BerriAI/litellm/pull/43121)
- Run migrated unit selections on every event in legacy GHA shards - [PR #43182](https://github.com/BerriAI/litellm/pull/43182)
- Drop main and litellm_\* branch filters from the CircleCI litellm-main workflows - [PR #43272](https://github.com/BerriAI/litellm/pull/43272)
- Stop stale CI reds, keep unit tests off the host env, retry CyberArk policy conflicts - [PR #43294](https://github.com/BerriAI/litellm/pull/43294)
- Cut CircleCI wall time without loosening test isolation - [PR #43347](https://github.com/BerriAI/litellm/pull/43347)

</details>

<details>
<summary>Code quality and contributor tooling (16)</summary>

- Remove 1,173 Any errors across 169 backend files - [PR #40251](https://github.com/BerriAI/litellm/pull/40251)
- Define the tier contract for unit, integration and e2e - [PR #42099](https://github.com/BerriAI/litellm/pull/42099)
- Replace Any with proven types in 30 files - [PR #42127](https://github.com/BerriAI/litellm/pull/42127)
- Replace Any with proven types in 32 files - [PR #42220](https://github.com/BerriAI/litellm/pull/42220)
- Extract explicit operation context and dispatch - [PR #42292](https://github.com/BerriAI/litellm/pull/42292)
- Cap comprehensions at one for and one if clause (LIT014) - [PR #42650](https://github.com/BerriAI/litellm/pull/42650)
- Clear fresh tech debt from the last 24 hours (rolling, 2026-09-06 to 2026-09-24) - [PR #42710](https://github.com/BerriAI/litellm/pull/42710)
- Replace Any with proven types in 5 files - [PR #42722](https://github.com/BerriAI/litellm/pull/42722)
- Add LIT013 flagging \*-ok suppressions that suppress nothing and remove the 240 stale ones - [PR #42793](https://github.com/BerriAI/litellm/pull/42793)
- Drop empty sections from the PR body and tighten the User Flow - [PR #42794](https://github.com/BerriAI/litellm/pull/42794)
- Simplify pull request template into plain English questions - [PR #42813](https://github.com/BerriAI/litellm/pull/42813)
- Restore the full pull request template (reverts #42813) - [PR #42828](https://github.com/BerriAI/litellm/pull/42828)
- Declare litellm-owned kwargs as typed objects and derive the lists from their fields - [PR #42843](https://github.com/BerriAI/litellm/pull/42843)
- Replace Any with proven types in 13 files - [PR #42937](https://github.com/BerriAI/litellm/pull/42937)
- Require UI before/after screenshots and intentional UX change note in PR template - [PR #43021](https://github.com/BerriAI/litellm/pull/43021)
- Carve harness tests out of the no-unit-tests hard rule - [PR #43076](https://github.com/BerriAI/litellm/pull/43076)

</details>

<details>
<summary>Rust runtime internals (29)</summary>

- Split token counter backends - [PR #42165](https://github.com/BerriAI/litellm/pull/42165)
- Add typed secret managers and shared auth adapters - [PR #42173](https://github.com/BerriAI/litellm/pull/42173)
- Scaffold cache foundation for Python parity - [PR #42196](https://github.com/BerriAI/litellm/pull/42196)
- Preserve Python settings semantics at the native boundary - [PR #42300](https://github.com/BerriAI/litellm/pull/42300)
- Add CyberArk Conjur secret manager backend - [PR #42303](https://github.com/BerriAI/litellm/pull/42303)
- Add HashiCorp Vault secret manager crate - [PR #42308](https://github.com/BerriAI/litellm/pull/42308)
- Add Azure Key Vault secret manager backend - [PR #42309](https://github.com/BerriAI/litellm/pull/42309)
- Add cache and secret migration foundations - [PR #42328](https://github.com/BerriAI/litellm/pull/42328)
- Declare _CacheTestHandle.valkey_semantic in native stub - [PR #42364](https://github.com/BerriAI/litellm/pull/42364)
- Keep native Redis semantic binding and Qdrant batch writes after merge - [PR #42379](https://github.com/BerriAI/litellm/pull/42379)
- Align secret manager operation contexts - [PR #42480](https://github.com/BerriAI/litellm/pull/42480)
- Add python-compat crate for Python data formats - [PR #42510](https://github.com/BerriAI/litellm/pull/42510)
- Add standalone cost calculator - [PR #42604](https://github.com/BerriAI/litellm/pull/42604)
- Add immutable model catalog crate - [PR #42605](https://github.com/BerriAI/litellm/pull/42605)
- Add a guarded native response-cache resolver foundation - [PR #42769](https://github.com/BerriAI/litellm/pull/42769)
- Add native dispatch foundation - [PR #42799](https://github.com/BerriAI/litellm/pull/42799)
- Extend native dispatch foundation to chat completions, responses, and messages - [PR #42805](https://github.com/BerriAI/litellm/pull/42805)
- Declare above_32k cost fields on ModelInfo - [PR #42856](https://github.com/BerriAI/litellm/pull/42856)
- Move tests.rs files inline or under tests/ and drop autotests = false - [PR #43028](https://github.com/BerriAI/litellm/pull/43028)
- Extract the host coroutine into its own crate - [PR #43129](https://github.com/BerriAI/litellm/pull/43129)
- Add Rust registry validation - [PR #43136](https://github.com/BerriAI/litellm/pull/43136)
- Replace Framer trait with tokio-util codecs - [PR #43193](https://github.com/BerriAI/litellm/pull/43193)
- Hand out an owned Client and route all providers through the pool - [PR #43245](https://github.com/BerriAI/litellm/pull/43245)
- Move credential inheritance and SDK limits into a driver preflight - [PR #43259](https://github.com/BerriAI/litellm/pull/43259)
- Preserve nested optional import failures - [PR #43265](https://github.com/BerriAI/litellm/pull/43265)
- Promote anthropic messages out of experimental_pass_through - [PR #43269](https://github.com/BerriAI/litellm/pull/43269)
- Prepare inference and auth foundations for the gateway - [PR #43287](https://github.com/BerriAI/litellm/pull/43287)
- Add config, router and gateway crates - [PR #43289](https://github.com/BerriAI/litellm/pull/43289)
- Expand logging and test coverage across gateway and Anthropic messages - [PR #43295](https://github.com/BerriAI/litellm/pull/43295)

</details>

<details>
<summary>Release and packaging (4)</summary>

- Bump litellm-enterprise 0.1.69 -&gt; 0.1.70, litellm-proxy-extras 0.4.100 -&gt; 0.4.101, litellm 1.103.0 -&gt; 1.104.0 - [PR #42633](https://github.com/BerriAI/litellm/pull/42633)
- Bump litellm-enterprise 0.1.70 -&gt; 0.1.71, litellm-proxy-extras 0.4.101 -&gt; 0.4.102 - [PR #43120](https://github.com/BerriAI/litellm/pull/43120)
- Rebuild Admin UI bundle for rc/1.104.0 - [PR #43372](https://github.com/BerriAI/litellm/pull/43372)
- Remove the top-N key cap, its follow-ups and the daily global spend rollup code from rc/1.104.0 - [PR #43385](https://github.com/BerriAI/litellm/pull/43385)

</details>

### PR roll-up by ownership area

Customer-facing PRs: **447**. Tests, CI and internal PRs: **184**. Total: **631**

- Models & Providers: 236
- Other (tests, CI, internal): 184
- Performance: 47
- Auth & Management: 43
- LLM API Endpoints: 25
- Logging: 24
- UI: 24
- MCP: 18
- Spend / Budgets / Rate Limits: 15
- Guardrails: 12
- Secret Managers: 2
- Docs: 1

## New Contributors

- [@ahamedshaik16](https://github.com/ahamedshaik16) made their first contribution in [PR #42966](https://github.com/BerriAI/litellm/pull/42966)
- [@chopratejas](https://github.com/chopratejas) made their first contribution in [PR #41560](https://github.com/BerriAI/litellm/pull/41560)
- [@doramirdor](https://github.com/doramirdor) made their first contribution in [PR #33227](https://github.com/BerriAI/litellm/pull/33227)
- [@kerry-berri](https://github.com/kerry-berri) made their first contribution in [PR #40429](https://github.com/BerriAI/litellm/pull/40429)
- [@kumarpriyanshu09](https://github.com/kumarpriyanshu09) made their first contribution in [PR #41526](https://github.com/BerriAI/litellm/pull/41526)
- [@patel-26meet](https://github.com/patel-26meet) made their first contribution in [PR #39311](https://github.com/BerriAI/litellm/pull/39311)
- [@Pawan-Shahane](https://github.com/Pawan-Shahane) made their first contribution in [PR #41979](https://github.com/BerriAI/litellm/pull/41979)
- [@philschmid](https://github.com/philschmid) made their first contribution in [PR #42465](https://github.com/BerriAI/litellm/pull/42465)
- [@PhimmStraiker](https://github.com/PhimmStraiker) made their first contribution in [PR #41880](https://github.com/BerriAI/litellm/pull/41880)
- [@SiluPanda](https://github.com/SiluPanda) made their first contribution in [PR #40204](https://github.com/BerriAI/litellm/pull/40204)
- [@togear](https://github.com/togear) made their first contribution in [PR #41033](https://github.com/BerriAI/litellm/pull/41033)
- [@Zechereh](https://github.com/Zechereh) made their first contribution in [PR #41099](https://github.com/BerriAI/litellm/pull/41099)

## Full Changelog

[Compare release contents on GitHub](https://github.com/BerriAI/litellm/compare/v1.103.0-rc.1...v1.104.0-rc.1)
