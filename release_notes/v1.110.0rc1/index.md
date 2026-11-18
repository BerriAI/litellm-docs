---
title: "LiteLLM v1.110.0rc1 adds the Agent Skills Hub and a Rust-only router"
description: "Release candidate for LiteLLM 1.110.0 with the Agent Skills Hub, a Rust-only router, the spend ledger by default and the latest OpenAI realtime models."
slug: "v1-110-0-rc-1"
date: 2026-11-11T00:06:06
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
docker.litellm.ai/berriai/litellm:1.110.0-rc.1
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.110.0rc1
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.110.0-rc.1`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.110.0-rc.1) and the full [releases page](https://github.com/BerriAI/litellm/releases).

The published GitHub tag is `v1.110.0-rc.1`. These notes compare it with `v1.109.0-rc.1`, the previous release candidate. Changes backported onto `rc/1.109.0` and already shipped in `v1.109.0` are omitted.

Customer-facing changes come first. Test, CI and internal changes are listed at the bottom.

:::danger Breaking Changes

These callouts cover user-facing behavior that differs from [`v1.109.0`](/release_notes/v1.109.0/v1-109-0), the latest stable release.

**The router always runs on the Rust core.** A router config the Rust core declines now raises an error at startup instead of falling back to the Python router, and `LITELLM_RUST` no longer picks the router core. Fix the config that the startup error names. See [PR #50178](https://github.com/BerriAI/litellm/pull/50178).

**Stored `general_settings` keys that no settings API manages no longer apply.** Values left in the database by older versions, such as a stale `enforce_user_param`, stop taking effect. Set any you still need in the config file or through a supported setting. See [PR #48967](https://github.com/BerriAI/litellm/pull/48967).

**Streamed `/v1/responses` no longer ends with `[DONE]`.** Every SSE event is now named, like OpenAI's Responses stream. Update clients that wait for `[DONE]` or read only unnamed `onmessage` events. See [PR #47980](https://github.com/BerriAI/litellm/pull/47980).

**Raw response ids that the proxy did not issue are rejected by default.** Reuse the managed ids the proxy returned, or set `allow_unmanaged_response_ids` to keep accepting raw ids. See [PR #49402](https://github.com/BerriAI/litellm/pull/49402).

**Batch requests can only name S3 buckets the admin allows.** A request body with `s3_bucket_name` or `s3_output_bucket_name` now gets a 401 unless the bucket is in `general_settings.allowed_client_side_s3_buckets`. Add the buckets your clients use before upgrading. See [PR #47496](https://github.com/BerriAI/litellm/pull/47496).

:::

## Key Highlights

- **Rust router core**: `Router` always runs on the Rust core, with fixes for weighted failover, retries counted toward cooldowns and reads that raced deployment updates
- **Spend ledger**: spend is charged through the `LiteLLM_SpendLogDelivery` ledger by default, and admins can turn off prompt storage per key or team
- **Agent Skills Hub**: portable skill upload and import from the dashboard, version history, and a member submission flow with an admin review queue
- **Realtime and Bedrock**: the latest OpenAI realtime audio models with translation routes, and native structured output for Claude on Bedrock
- **Model lifecycle**: `-latest` aliases for first-party models, plus model deprecation alerts and opt-in emails to affected key owners
- **Reliability**: each request frees its Redis batch scope when it ends, which stops about 40 KiB of worker memory growth per request, and `total_timeout` caps a whole request including retries

## New Providers and Endpoints

### New Providers (2 new providers)

| Provider | Supported LiteLLM Endpoints | Description |
| --- | --- | --- |
| Wally | `/v1/chat/completions` | OpenAI-compatible provider under `wally/`, with priced models and an Add Model form entry |
| EmpirioLabs AI | `/v1/decisions`, `/v1/systemone`, `/v1/embeddings` | Decisions and embeddings provider under `empiriolabs/` |

## New Models / Updated Models

#### New Model Support (370 new models)

Counts represent new catalog identifiers compared with `v1.109.0`, including aliases and regional variants. Prices are the values bundled in this release, in USD, and runtime pricing-map reloads can update them. 52 rows for retired models were removed, such as `azure/gpt-4`, `azure/gpt-35-turbo-16k` and `azure/command-r-plus`.

<details>
<summary>All 370 new catalog entries</summary>

| Provider | Model | Context Window | Input ($/1M tokens) | Output ($/1M tokens) | Features / special pricing |
| --- | --- | --- | --- | --- | --- |
| Amazon Bedrock | `bedrock/claude-fable-latest` | 1,000,000 | $10 | $50 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use; Alias of `global.anthropic.claude-fable-5-1` |
| Amazon Bedrock | `bedrock/claude-haiku-latest` | 1,000,000 | $0.1 | $0.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use; Alias of `global.anthropic.claude-haiku-5-5` |
| Amazon Bedrock | `bedrock/claude-opus-latest` | 1,000,000 | $4 | $20 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use; Alias of `global.anthropic.claude-opus-5-5` |
| Amazon Bedrock | `bedrock/claude-sonnet-latest` | 1,000,000 | $2 | $10 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use; Alias of `global.anthropic.claude-sonnet-5-5` |
| Amazon Bedrock | `bedrock/glm-latest` | 1,000,000 | $1.68 | $5.28 | Chat; Reasoning; Tool calling; Prompt caching; Structured output; Alias of `global.zai.glm-5.3` |
| Amazon Bedrock | `bedrock/gpt-astra-latest` | 922,000 | $10 | $50 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Alias of `global.openai.gpt-6-astra` |
| Amazon Bedrock | `bedrock/gpt-luna-latest` | 922,000 | $0.1 | $0.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Alias of `global.openai.gpt-6-luna` |
| Amazon Bedrock | `bedrock/gpt-sol-latest` | 1,000,000 | $2 | $10 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Alias of `global.openai.gpt-6.1-sol` |
| Amazon Bedrock | `bedrock/gpt-terra-latest` | 922,000 | $1 | $5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Alias of `global.openai.gpt-6.1-terra` |
| Amazon Bedrock | `bedrock/grok-latest` | 524,288 | $2 | $6 | Chat; Reasoning; Vision; Tool calling; Alias of `global.xai.grok-4.7` |
| Amazon Bedrock | `bedrock/kimi-latest` | 1,000,000 | $3 | $15 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Alias of `global.moonshotai.kimi-k3` |
| Amazon Bedrock | `bedrock/us-gov-east-1/anthropic.claude-3-5-sonnet-20240620-v1:0` | 200,000 | $3.6 | $18 | Chat; Vision; Tool calling; Structured output; PDF input |
| Amazon Bedrock | `bedrock/us-gov-east-1/anthropic.claude-3-7-sonnet-20250219-v1:0` | 200,000 | $3.6 | $18 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `bedrock/us-gov-east-1/anthropic.claude-3-haiku-20240307-v1:0` | 195,904 | $0.3 | $1.5 | Chat; Vision; Tool calling; Structured output; PDF input |
| Amazon Bedrock | `bedrock/us-gov-east-1/moonshotai.kimi-k3` | 868,928 | $3.96 | $19.8 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Amazon Bedrock | `bedrock/us-gov-west-1/anthropic.claude-3-5-sonnet-20240620-v1:0` | 200,000 | $3.6 | $18 | Chat; Vision; Tool calling; Structured output; PDF input |
| Amazon Bedrock | `bedrock/us-gov-west-1/anthropic.claude-3-7-sonnet-20250219-v1:0` | 200,000 | $3.6 | $18 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `bedrock/us-gov-west-1/anthropic.claude-3-haiku-20240307-v1:0` | 195,904 | $0.3 | $1.5 | Chat; Vision; Tool calling; Structured output; PDF input |
| Amazon Bedrock | `bedrock/us-gov-west-1/moonshotai.kimi-k3` | 868,928 | $3.96 | $19.8 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Amazon Bedrock | `global.moonshotai.kimi-k3.1` | 868,928 | $4 | $20 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Amazon Bedrock | `in.moonshotai.kimi-k3.1` | 868,928 | $4.4 | $22 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Amazon Bedrock | `moonshotai.kimi-k3.1` | 868,928 | $4.4 | $22 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Amazon Bedrock | `us-gov.xai.grok-4.7` | 524,288 | $2.64 | $7.92 | Chat; Reasoning; Vision; Tool calling |
| Amazon Bedrock | `us.moonshotai.kimi-k3.1` | 868,928 | $4.4 | $22 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Amazon Bedrock Mantle | `bedrock_mantle/claude-haiku-latest` | 1,000,000 | $0.11 | $0.55 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use; Alias of `bedrock_mantle/anthropic.claude-haiku-5-5` |
| Amazon Bedrock Mantle | `bedrock_mantle/claude-opus-latest` | 1,000,000 | $4.4 | $22 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use; Alias of `bedrock_mantle/anthropic.claude-opus-5-5` |
| Amazon Bedrock Mantle | `bedrock_mantle/claude-sonnet-latest` | 1,000,000 | $2.2 | $11 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use; Alias of `bedrock_mantle/anthropic.claude-sonnet-5-5` |
| Amazon Bedrock Mantle | `bedrock_mantle/gpt-astra-latest` | 922,000 | $11 | $55 | Responses; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search; Alias of `bedrock_mantle/openai.gpt-6-astra` |
| Amazon Bedrock Mantle | `bedrock_mantle/gpt-luna-latest` | 922,000 | $0.11 | $0.55 | Responses; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search; Alias of `bedrock_mantle/openai.gpt-6-luna` |
| Amazon Bedrock Mantle | `bedrock_mantle/gpt-sol-latest` | 1,000,000 | $2.2 | $11 | Responses; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search; Alias of `bedrock_mantle/openai.gpt-6.1-sol` |
| Amazon Bedrock Mantle | `bedrock_mantle/gpt-terra-latest` | 922,000 | $1.1 | $5.5 | Responses; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search; Alias of `bedrock_mantle/openai.gpt-6.1-terra` |
| Amazon Bedrock Mantle | `bedrock_mantle/grok-latest` | 524,288 | $2.2 | $6.6 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Alias of `bedrock_mantle/xai.grok-4.7` |
| Amazon Bedrock Mantle | `bedrock_mantle/us-gov-east-1/nvidia.nemotron-nano-12b-v2` | 128,000 | $0.24 | $0.72 | Chat; Vision; Tool calling; Structured output |
| Amazon Bedrock Mantle | `bedrock_mantle/us-gov-east-1/nvidia.nemotron-nano-3-30b` | 262,144 | $0.072 | $0.288 | Chat; Tool calling; Structured output |
| Amazon Bedrock Mantle | `bedrock_mantle/us-gov-east-1/nvidia.nemotron-nano-9b-v2` | 128,000 | $0.072 | $0.276 | Chat; Tool calling; Structured output |
| Amazon Bedrock Mantle | `bedrock_mantle/us-gov-east-1/nvidia.nemotron-super-3-120b` | 256,000 | $0.18 | $0.78 | Chat; Reasoning; Tool calling; Structured output |
| Amazon Bedrock Mantle | `bedrock_mantle/us-gov-east-1/xai.grok-4.7` | 524,288 | $2.64 | $7.92 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Amazon Bedrock Mantle | `bedrock_mantle/us-gov-west-1/nvidia.nemotron-nano-12b-v2` | 128,000 | $0.24 | $0.72 | Chat; Vision; Tool calling; Structured output |
| Amazon Bedrock Mantle | `bedrock_mantle/us-gov-west-1/nvidia.nemotron-nano-3-30b` | 262,144 | $0.072 | $0.288 | Chat; Tool calling; Structured output |
| Amazon Bedrock Mantle | `bedrock_mantle/us-gov-west-1/nvidia.nemotron-nano-9b-v2` | 128,000 | $0.072 | $0.276 | Chat; Tool calling; Structured output |
| Amazon Bedrock Mantle | `bedrock_mantle/us-gov-west-1/nvidia.nemotron-super-3-120b` | 256,000 | $0.18 | $0.78 | Chat; Reasoning; Tool calling; Structured output |
| Amazon Bedrock Mantle | `bedrock_mantle/us-gov-west-1/xai.grok-4.7` | 524,288 | $2.64 | $7.92 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Amazon Bedrock Mantle | `bedrock_mantle/xai.grok-4.7` | 524,288 | $2.2 | $6.6 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Anthropic | `claude-fable-latest` | 1,000,000 | $10 | $50 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search; PDF input; Computer use; Alias of `claude-fable-5-1` |
| Anthropic | `claude-haiku-latest` | 1,000,000 | $0.1 | $0.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search; PDF input; Computer use; Alias of `claude-haiku-5-5` |
| Anthropic | `claude-opus-latest` | 1,000,000 | $4 | $20 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search; PDF input; Computer use; Alias of `claude-opus-5-5` |
| Anthropic | `claude-sonnet-latest` | 1,000,000 | $2 | $10 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search; PDF input; Computer use; Alias of `claude-sonnet-5-5` |
| Azure | `azure/gpt-astra-latest` | 922,000 | $10 | $50 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search; PDF input; Computer use; Alias of `azure/gpt-6-astra` |
| Azure | `azure/gpt-luna-latest` | 922,000 | $0.1 | $0.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search; PDF input; Computer use; Alias of `azure/gpt-6-luna` |
| Azure | `azure/gpt-mini-latest` | 272,000 | $0.75 | $4.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search; PDF input; Alias of `azure/gpt-5.4-mini` |
| Azure | `azure/gpt-realtime-2.1-2026-07-07` | 32,000 | $4 | $24 | Realtime; Reasoning; Tool calling; Prompt caching; Audio input; Audio output |
| Azure | `azure/gpt-realtime-2.1-mini-2026-07-07` | 32,000 | $0.6 | $2.4 | Realtime; Reasoning; Tool calling; Prompt caching; Audio input; Audio output |
| Azure | `azure/gpt-realtime-translate-2026-05-06` | 32,000 | - | - | Realtime; Audio input; Audio output; $0.000566667 per second in |
| Azure | `azure/gpt-realtime-translate-2026-05-07` | 32,000 | - | - | Realtime; Audio input; Audio output; $0.000566667 per second in |
| Azure | `azure/gpt-realtime-whisper-2026-05-06` | 32,000 | - | - | Audio transcription; Audio input; $0.000283333 per second in |
| Azure | `azure/gpt-realtime-whisper-2026-05-07` | 32,000 | - | - | Audio transcription; Audio input; $0.000283333 per second in |
| Azure | `azure/gpt-sol-latest` | 922,000 | $2 | $10 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search; PDF input; Computer use; Alias of `azure/gpt-6.1-sol` |
| Azure | `azure/gpt-terra-latest` | 922,000 | $1 | $5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search; PDF input; Computer use; Alias of `azure/gpt-6.1-terra` |
| Azure | `azure/us/gpt-realtime-1.5` | 32,000 | $4.4 | $17.6 | Realtime; Tool calling; Audio input; Audio output |
| Azure | `azure/us/gpt-realtime-2.1-mini` | 32,000 | $0.66 | $2.64 | Realtime; Reasoning; Tool calling; Prompt caching; Audio input; Audio output |
| Azure | `azure/us/gpt-realtime-2.1` | 32,000 | $4.4 | $26.4 | Realtime; Reasoning; Tool calling; Prompt caching; Audio input; Audio output |
| Azure AI | `azure_ai/claude-fable-latest` | 1,000,000 | $10 | $50 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use; Alias of `azure_ai/claude-fable-5-1` |
| Azure AI | `azure_ai/claude-haiku-latest` | 1,000,000 | $0.1 | $0.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use; Alias of `azure_ai/claude-haiku-5-5` |
| Azure AI | `azure_ai/claude-mythos-5-1` | 1,000,000 | $10 | $50 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Azure AI | `azure_ai/claude-opus-latest` | 1,000,000 | $4 | $20 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use; Alias of `azure_ai/claude-opus-5-5` |
| Azure AI | `azure_ai/claude-sonnet-latest` | 1,000,000 | $2 | $10 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use; Alias of `azure_ai/claude-sonnet-5-5` |
| Azure AI | `azure_ai/cohere-rerank-v5-fast` | 32,768 | $0.02 | $0 | Rerank |
| Azure AI | `azure_ai/cohere-rerank-v5-pro` | 32,768 | $0.05 | $0 | Rerank |
| Azure AI | `azure_ai/deepseek-flash-latest` | 1,000,000 | $0.19 | $0.51 | Chat; Reasoning; Tool calling; Prompt caching; Alias of `azure_ai/deepseek-v4-flash` |
| Azure AI | `azure_ai/deepseek-pro-latest` | 1,000,000 | $1.74 | $3.48 | Chat; Reasoning; Tool calling; Prompt caching; Alias of `azure_ai/deepseek-v4-pro` |
| Azure AI | `azure_ai/glm-flash-latest` | 1,048,576 | $0.188 | $0.625 | Chat; Reasoning; Tool calling; Prompt caching; Alias of `azure_ai/FW-GLM-5.3-Flash` |
| Azure AI | `azure_ai/glm-latest` | 1,048,576 | $1.75 | $5.5 | Chat; Reasoning; Tool calling; Prompt caching; Alias of `azure_ai/FW-GLM-5.3` |
| Azure AI | `azure_ai/gpt-astra-latest` | 922,000 | $10 | $50 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search; PDF input; Computer use; Alias of `azure_ai/gpt-6-astra` |
| Azure AI | `azure_ai/gpt-luna-latest` | 922,000 | $0.1 | $0.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search; PDF input; Computer use; Alias of `azure_ai/gpt-6-luna` |
| Azure AI | `azure_ai/gpt-mini-latest` | 272,000 | $0.75 | $4.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search; PDF input; Alias of `azure_ai/gpt-5.4-mini` |
| Azure AI | `azure_ai/gpt-sol-latest` | 922,000 | $2 | $10 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search; PDF input; Computer use; Alias of `azure_ai/gpt-6.1-sol` |
| Azure AI | `azure_ai/gpt-terra-latest` | 922,000 | $1 | $5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search; PDF input; Computer use; Alias of `azure_ai/gpt-6.1-terra` |
| Azure AI | `azure_ai/grok-latest` | 500,000 | $2 | $6 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search; Alias of `azure_ai/grok-4.7` |
| Azure AI | `azure_ai/kimi-latest` | 1,048,576 | $3 | $15 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Alias of `azure_ai/FW-Kimi-K3` |
| Azure AI | `azure_ai/minimax-latest` | 512,000 | $0.33 | $1.32 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Alias of `azure_ai/FW-MiniMax-M3` |
| Baseten | `baseten/deepseek-flash-latest` | 1,048,576 | $0.13 | $0.26 | Chat; Reasoning; Tool calling; Prompt caching; Structured output; Alias of `baseten/deepseek-ai/DeepSeek-V4-Flash-0731` |
| Baseten | `baseten/deepseek-pro-latest` | 1,048,576 | $1.32 | $3.96 | Chat; Reasoning; Tool calling; Prompt caching; Structured output; Alias of `baseten/deepseek-ai/DeepSeek-V4-Pro-0813` |
| Baseten | `baseten/glm-flash-latest` | 1,048,576 | $0.15 | $0.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Alias of `baseten/zai-org/GLM-5.3-Flash` |
| Baseten | `baseten/glm-latest` | 1,048,576 | $1.4 | $4.4 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Alias of `baseten/zai-org/GLM-5.3` |
| Baseten | `baseten/kimi-latest` | 1,048,576 | $3 | $15 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Alias of `baseten/moonshotai/Kimi-K3` |
| Baseten | `baseten/moonshotai/Kimi-K3.1-Pro` | 1,000,000 | $2 | $10 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| DashScope | `dashscope/qwen-flash-latest` | 991,808 | $0.15 | $0.47 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search; Alias of `dashscope/qwen3.8-flash` |
| DashScope | `dashscope/qwen-max-latest` | 991,808 | $2 | $6 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Alias of `dashscope/qwen3.8-max` |
| Databricks | `databricks/claude-fable-latest` | 1,000,000 | $10 | $50 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Alias of `databricks/databricks-claude-fable-5-1` |
| Databricks | `databricks/claude-haiku-latest` | 1,000,000 | $0.1 | $0.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Alias of `databricks/databricks-claude-haiku-5-5` |
| Databricks | `databricks/claude-opus-latest` | 1,000,000 | $4 | $20 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Alias of `databricks/databricks-claude-opus-5-5` |
| Databricks | `databricks/claude-sonnet-latest` | 1,000,000 | $2 | $10 | Chat; Reasoning; Tool calling; Prompt caching; Alias of `databricks/databricks-claude-sonnet-5-5` |
| Databricks | `databricks/databricks-kimi-k3-1-pro` | 1,048,576 | $2 | $10 | Chat; Reasoning; Vision; Tool calling; Prompt caching |
| Databricks | `databricks/glm-flash-latest` | 1,048,576 | $0.15 | $0.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Alias of `databricks/databricks-glm-5-3-flash` |
| Databricks | `databricks/glm-latest` | 1,048,576 | $1.4 | $4.4 | Chat; Reasoning; Tool calling; Prompt caching; Structured output; Alias of `databricks/databricks-glm-5-3` |
| Databricks | `databricks/gpt-astra-latest` | 922,000 | $10 | $50 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Alias of `databricks/databricks-gpt-6-astra` |
| Databricks | `databricks/gpt-luna-latest` | 922,000 | $0.1 | $0.5 | Responses; Reasoning; Vision; Tool calling; Prompt caching; Alias of `databricks/databricks-gpt-6-luna` |
| Databricks | `databricks/gpt-mini-latest` | 272,000 | $0.75 | $4.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Alias of `databricks/databricks-gpt-5-4-mini` |
| Databricks | `databricks/gpt-sol-latest` | 922,000 | $2 | $10 | Responses; Reasoning; Vision; Tool calling; Prompt caching; Alias of `databricks/databricks-gpt-6-1-sol` |
| Databricks | `databricks/gpt-terra-latest` | 922,000 | $1 | $5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Alias of `databricks/databricks-gpt-6-1-terra` |
| Databricks | `databricks/grok-latest` | 500,000 | $2.5 | $7.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Alias of `databricks/databricks-grok-4-7` |
| Databricks | `databricks/kimi-latest` | 1,000,000 | $3 | $15 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Alias of `databricks/databricks-kimi-k3` |
| Deepgram | `deepgram/streaming/nova-3-medical` | - | - | - | Audio transcription; $0.00012833 per second in |
| DeepSeek | `deepseek/deepseek-flash-latest` | 1,000,000 | $0.3 | $1.2 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Alias of `deepseek/deepseek-v4-flash` |
| DeepSeek | `deepseek/deepseek-pro-latest` | 1,000,000 | $1.32 | $3.96 | Chat; Reasoning; Tool calling; Prompt caching; Structured output; Alias of `deepseek/deepseek-v4-pro` |
| Empirio Labs | `empiriolabs/aplomb-1` | 1,000,000 | $0.02 | $0 | Chat; Vision; Audio input |
| Empirio Labs | `empiriolabs/deepseek-v4-1-flash-1017` | 1,000,000 | $0.2 | $0.8 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Empirio Labs | `empiriolabs/deepseek-v4-flash-0731:variant1` | 1,000,000 | $0.44 | $1.32 | Chat; Reasoning; Tool calling; Structured output |
| Empirio Labs | `empiriolabs/deepseek-v4-flash-0731` | 1,000,000 | $0.424 | $1.272 | Chat; Reasoning; Tool calling; Structured output |
| Empirio Labs | `empiriolabs/deepseek-v4-pro-0813` | 1,000,000 | $1.32 | $3.96 | Chat; Reasoning; Tool calling; Structured output |
| Empirio Labs | `empiriolabs/deepseek-v4-pro:variant1` | 1,000,000 | $2.4 | $4.8 | Chat; Reasoning; Tool calling; Structured output; Web search |
| Empirio Labs | `empiriolabs/deepseek-v4-pro:variant2` | 1,000,000 | $1.65 | $3.301 | Chat; Reasoning; Tool calling; Prompt caching; Structured output; Web search |
| Empirio Labs | `empiriolabs/deepseek-v4-pro:variant3` | 1,000,000 | $2.4 | $4.8 | Chat; Reasoning; Tool calling; Structured output |
| Empirio Labs | `empiriolabs/deepseek-v4-pro` | 1,000,000 | $1.65 | $3.3 | Chat; Reasoning; Tool calling; Structured output |
| Empirio Labs | `empiriolabs/fugu-max` | 1,000,000 | $2 | $6 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search |
| Empirio Labs | `empiriolabs/fugu-ultra-v1-0` | 1,000,000 | $7.5 | $45 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search |
| Empirio Labs | `empiriolabs/fugu-ultra-v1-1` | 1,000,000 | $5 | $30 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search |
| Empirio Labs | `empiriolabs/fugu-ultra-v2-0` | 1,000,000 | $5 | $30 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search |
| Empirio Labs | `empiriolabs/gemma-4-26b-a4b` | 262,144 | $0.05 | $0.29 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Empirio Labs | `empiriolabs/glm-4-6v-flashx` | 131,072 | $0.04 | $0.4 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search |
| Empirio Labs | `empiriolabs/glm-4-7-flashx` | 202,752 | $0.07 | $0.4 | Chat; Reasoning; Tool calling; Prompt caching; Structured output; Web search |
| Empirio Labs | `empiriolabs/glm-5-1` | 202,745 | $0.825 | $3.301 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Empirio Labs | `empiriolabs/glm-5-2:variant1` | 1,048,576 | $1.1 | $3.851 | Chat; Reasoning; Tool calling; Prompt caching; Structured output; Web search |
| Empirio Labs | `empiriolabs/glm-5-2:variant2` | 1,048,576 | $1.4 | $4.4 | Chat; Reasoning; Tool calling; Structured output; Web search |
| Empirio Labs | `empiriolabs/glm-5-2` | 1,048,576 | $1.4 | $4.4 | Chat; Reasoning; Tool calling; Structured output; Web search |
| Empirio Labs | `empiriolabs/glm-5-3-flash` | 1,048,576 | $0.075 | $0.25 | Chat; Reasoning; Vision; Tool calling; Structured output; Web search |
| Empirio Labs | `empiriolabs/glm-5-3` | 1,048,576 | $1.4 | $4.4 | Chat; Reasoning; Tool calling; Structured output; Web search |
| Empirio Labs | `empiriolabs/kimi-k2-6` | 262,144 | $0.8939 | $3.7131 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Empirio Labs | `empiriolabs/kimi-k2-7-code-highspeed` | 262,144 | $1.9 | $8 | Chat; Reasoning; Vision; Tool calling; Structured output; Web search |
| Empirio Labs | `empiriolabs/kimi-k2-7-code:variant1` | 262,144 | $0.8939 | $3.7131 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search |
| Empirio Labs | `empiriolabs/kimi-k2-7-code` | 262,144 | $0.95 | $4 | Chat; Reasoning; Vision; Tool calling; Structured output; Web search |
| Empirio Labs | `empiriolabs/kimi-k3-1-pro` | 1,048,576 | $2 | $10 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search |
| Empirio Labs | `empiriolabs/kimi-k3` | 1,048,576 | $3 | $15 | Chat; Reasoning; Vision; Tool calling; Structured output; Web search |
| Empirio Labs | `empiriolabs/mimo-v2-6-flash` | 1,048,576 | $0.14 | $0.28 | Chat; Reasoning; Vision; Tool calling; Structured output; Web search; Audio input |
| Empirio Labs | `empiriolabs/mimo-v2-6-pro-ultraspeed` | 1,048,576 | $4.35 | $8.7 | Chat; Reasoning; Vision; Tool calling; Structured output; Audio input |
| Empirio Labs | `empiriolabs/mimo-v2-6-pro` | 1,048,576 | $0.435 | $0.87 | Chat; Reasoning; Vision; Tool calling; Structured output; Web search; Audio input |
| Empirio Labs | `empiriolabs/minimax-m2-7-highspeed` | 204,800 | $0.3 | $1.2 | Chat; Reasoning; Tool calling; Prompt caching |
| Empirio Labs | `empiriolabs/minimax-m2-7` | 204,800 | $0.15 | $0.6 | Chat; Reasoning; Tool calling; Prompt caching |
| Empirio Labs | `empiriolabs/minimax-m3-1-flash` | 1,048,576 | $0.1125 | $0.45 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Web search |
| Empirio Labs | `empiriolabs/minimax-m3:priority` | 1,048,458 | $0.3375 | $1.35 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Web search |
| Empirio Labs | `empiriolabs/minimax-m3` | 1,048,576 | $0.225 | $0.9 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Web search |
| Empirio Labs | `empiriolabs/mistral-small-4` | 262,144 | $0.15 | $0.6 | Chat; Vision; Tool calling; Structured output; Web search |
| Empirio Labs | `empiriolabs/muse-glimmer-30b` | 131,072 | $0.2 | $0.8 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Empirio Labs | `empiriolabs/muse-spark-1-1` | 1,048,576 | $1.25 | $4.25 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search; Audio input |
| Empirio Labs | `empiriolabs/muse-spark-1-2` | 1,048,576 | $1.25 | $4.25 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search; Audio input |
| Empirio Labs | `empiriolabs/muse-spark-1-3` | 1,048,576 | $1.25 | $4.25 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search |
| Empirio Labs | `empiriolabs/nova-lite-1-0` | 317,379 | $0.069 | $0.28 | Chat; Vision; Tool calling; Prompt caching |
| Empirio Labs | `empiriolabs/nova-lite-2` | 1,000,000 | $0.38 | $3.16 | Chat; Reasoning; Vision; Tool calling; Prompt caching |
| Empirio Labs | `empiriolabs/nova-micro-1-0` | 133,003 | $0.04 | $0.16 | Chat; Tool calling; Prompt caching |
| Empirio Labs | `empiriolabs/nova-pro-1-0` | 317,319 | $2.4 | $9.6 | Chat; Vision; Tool calling |
| Empirio Labs | `empiriolabs/perplexity-advanced-deep-research` | - | $12 | $60 | Chat; Reasoning; Vision; Web search |
| Empirio Labs | `empiriolabs/perplexity-deep-research` | 919,327 | $4.8 | $19 | Chat; Reasoning; Vision; Web search |
| Empirio Labs | `empiriolabs/perplexity-pro-search` | - | $7.8 | $39 | Chat; Reasoning; Vision; Web search |
| Empirio Labs | `empiriolabs/perplexity-sonar-pro` | 919,328 | $7.2 | $36 | Chat; Reasoning; Vision; Web search |
| Empirio Labs | `empiriolabs/perplexity-sonar-reasoning-pro` | 919,330 | $4.8 | $19 | Chat; Reasoning; Vision; Web search |
| Empirio Labs | `empiriolabs/perplexity-sonar` | 919,327 | $2.4 | $2.4 | Chat; Reasoning; Vision; Web search |
| Empirio Labs | `empiriolabs/qwen3-5-122b-a10b` | 258,048 | $0.115 | $0.917 | Chat; Reasoning; Vision; Tool calling; Structured output; Web search |
| Empirio Labs | `empiriolabs/qwen3-5-27b` | 258,048 | $0.086 | $0.688 | Chat; Reasoning; Vision; Tool calling; Structured output; Web search |
| Empirio Labs | `empiriolabs/qwen3-5-35b-a3b` | 258,048 | $0.057 | $0.459 | Chat; Reasoning; Vision; Tool calling; Structured output; Web search |
| Empirio Labs | `empiriolabs/qwen3-5-397b-a17b` | 258,048 | $0.172 | $1.032 | Chat; Reasoning; Vision; Tool calling; Structured output; Web search |
| Empirio Labs | `empiriolabs/qwen3-5-4b` | 262,144 | $0.04 | $0.07 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Empirio Labs | `empiriolabs/qwen3-5-9b` | 262,144 | $0.09 | $0.13 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Empirio Labs | `empiriolabs/qwen3-5-flash:variant1` | 995,904 | $0.029 | $0.287 | Chat; Reasoning; Vision; Tool calling; Structured output; Web search |
| Empirio Labs | `empiriolabs/qwen3-5-flash` | 995,904 | $0.09 | $0.368 | Chat; Reasoning; Vision; Tool calling; Structured output; Web search |
| Empirio Labs | `empiriolabs/qwen3-5-omni-flash` | 196,608 | $0.8 | $4.4 | Chat; Vision; Tool calling; Web search; Audio input |
| Empirio Labs | `empiriolabs/qwen3-5-omni-plus` | 196,608 | $2.8 | $16.6 | Chat; Vision; Tool calling; Structured output; Web search; Audio input |
| Empirio Labs | `empiriolabs/qwen3-5-plus:variant1` | 983,616 | $0.115 | $0.688 | Chat; Reasoning; Vision; Tool calling; Structured output; Web search |
| Empirio Labs | `empiriolabs/qwen3-5-plus` | 983,616 | $0.36 | $2.21 | Chat; Reasoning; Vision; Tool calling; Structured output; Web search |
| Empirio Labs | `empiriolabs/qwen3-6-27b` | 229,376 | $0.4126 | $2.4754 | Chat; Reasoning; Vision; Tool calling; Structured output; Web search |
| Empirio Labs | `empiriolabs/qwen3-6-35b-a3b` | 131,072 | $0.07 | $0.42 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Empirio Labs | `empiriolabs/qwen3-6-flash:variant1` | 983,616 | $0.165 | $0.99 | Chat; Reasoning; Vision; Tool calling; Structured output; Web search |
| Empirio Labs | `empiriolabs/qwen3-6-flash` | 983,616 | $0.25 | $1.5 | Chat; Reasoning; Vision; Tool calling; Structured output; Web search |
| Empirio Labs | `empiriolabs/qwen3-6-plus:variant1` | 983,616 | $0.276 | $1.651 | Chat; Reasoning; Vision; Tool calling; Structured output; Web search |
| Empirio Labs | `empiriolabs/qwen3-6-plus` | 983,616 | $0.5 | $3 | Chat; Reasoning; Vision; Tool calling; Structured output; Web search |
| Empirio Labs | `empiriolabs/qwen3-7-flash:variant1` | 983,616 | $0.028 | $0.11 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search |
| Empirio Labs | `empiriolabs/qwen3-7-flash` | 983,616 | $0.03 | $0.13 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search |
| Empirio Labs | `empiriolabs/qwen3-7-max:variant1` | 983,616 | $1.65 | $4.951 | Chat; Reasoning; Tool calling; Structured output; Web search |
| Empirio Labs | `empiriolabs/qwen3-7-max` | 983,616 | $2.5 | $7.5 | Chat; Reasoning; Tool calling; Structured output; Web search |
| Empirio Labs | `empiriolabs/qwen3-7-plus:variant1` | 983,616 | $0.276 | $1.101 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search |
| Empirio Labs | `empiriolabs/qwen3-7-plus` | 983,616 | $0.4 | $1.6 | Chat; Reasoning; Vision; Tool calling; Structured output; Web search |
| Empirio Labs | `empiriolabs/qwen3-8-27b` | 262,144 | $0.17 | $0.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Empirio Labs | `empiriolabs/qwen3-8-flash` | 983,616 | $0.16 | $0.47 | Chat; Reasoning; Vision; Tool calling; Structured output; Web search |
| Empirio Labs | `empiriolabs/qwen3-8-max-0902` | 983,616 | $2 | $6 | Chat; Reasoning; Vision; Tool calling; Structured output; Web search |
| Empirio Labs | `empiriolabs/qwen3-8-max:variant1` | 983,616 | $1.65 | $4.951 | Chat; Reasoning; Vision; Tool calling; Structured output; Web search |
| Empirio Labs | `empiriolabs/qwen3-8-max` | 983,616 | $2 | $6 | Chat; Reasoning; Vision; Tool calling; Structured output; Web search |
| Empirio Labs | `empiriolabs/qwen3-8-omni-flash` | 1,006,592 | $0.3 | $0.94 | Chat; Reasoning; Vision; Tool calling; Structured output; Web search; Audio input |
| Empirio Labs | `empiriolabs/seed-2-0-code` | 229,096 | $0.4 | $2.4 | Chat; Reasoning; Vision; Tool calling |
| Empirio Labs | `empiriolabs/seed-2-0-lite` | 229,096 | $0.31 | $2.5 | Chat; Reasoning; Vision; Tool calling; Structured output |
| Empirio Labs | `empiriolabs/seed-2-0-mini` | 229,156 | $0.12 | $0.5 | Chat; Reasoning; Vision; Tool calling; Structured output |
| Empirio Labs | `empiriolabs/seed-2-0-pro` | 229,096 | $0.63 | $3.79 | Chat; Reasoning; Vision; Tool calling; Structured output |
| Empirio Labs | `empiriolabs/seed-2-1-turbo` | 229,093 | $0.63 | $3.13 | Chat; Reasoning; Vision; Tool calling; Structured output |
| Empirio Labs | `empiriolabs/skylark-embedding-vision` | 8,000 | $0.25 | - | Embedding |
| Empirio Labs | `empiriolabs/step-3-5-flash-2603` | 262,144 | $0.1 | $0.3 | Chat; Reasoning; Tool calling; Prompt caching; Web search |
| Empirio Labs | `empiriolabs/step-3-5-flash` | 262,144 | $0.1 | $0.3 | Chat; Reasoning; Tool calling; Prompt caching; Web search |
| Empirio Labs | `empiriolabs/step-3-7-flash` | 262,144 | $0.2 | $1.15 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search |
| Empirio Labs | `empiriolabs/step-5-preview` | 1,024,000 | $1 | $2.7 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Empirio Labs | `empiriolabs/stepaudio-2-5-chat` | 262,144 | $1.5 | $3.5 | Chat; Tool calling; Prompt caching; Structured output; Web search; Audio input |
| Empirio Labs | `empiriolabs/stepaudio-3-chat` | 262,144 | $1.5 | $3.5 | Chat; Reasoning; Tool calling; Prompt caching; Structured output; Audio input |
| Empirio Labs | `empiriolabs/text-embedding-v4` | 8,192 | $0.07 | - | Embedding |
| Empirio Labs | `empiriolabs/tongyi-embedding-vision-flash` | 1,024 | $0.09 | - | Embedding |
| Empirio Labs | `empiriolabs/tongyi-embedding-vision-plus` | 1,024 | $0.09 | - | Embedding |
| Fireworks AI | `fireworks_ai/accounts/fireworks/models/kimi-k3p1-pro` | 1,048,576 | $2 | $10 | Chat; Reasoning; Vision; Tool calling; Structured output |
| Fireworks AI | `fireworks_ai/accounts/fireworks/routers/deepseek-v4p1-flash-1017-ultrafast` | 1,048,576 | $2.4 | $9.6 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Fireworks AI | `fireworks_ai/kimi-latest` | 1,048,576 | $3 | $15 | Chat; Reasoning; Vision; Tool calling; Structured output; Alias of `fireworks_ai/accounts/fireworks/models/kimi-k3` |
| Fireworks AI | `fireworks_ai/minimax-latest` | 512,000 | $0.3 | $1.2 | Chat; Reasoning; Vision; Tool calling; Structured output; Alias of `fireworks_ai/accounts/fireworks/models/minimax-m3` |
| Gemini | `gemini/gemini-omni-1.2-flash` | 131,072 | $1.5 | $9 | Chat; Reasoning; Vision; Audio output |
| GitHub Copilot | `github_copilot/claude-fable-latest` | 200,000 | $10 | $50 | Chat; Reasoning; Vision; Tool calling; Structured output; Alias of `github_copilot/claude-fable-5.1` |
| GitHub Copilot | `github_copilot/claude-haiku-latest` | 128,000 | $0.1 | $0.5 | Chat; Reasoning; Vision; Tool calling; Structured output; Alias of `github_copilot/claude-haiku-5.5` |
| GitHub Copilot | `github_copilot/claude-opus-latest` | 200,000 | $4 | $20 | Chat; Reasoning; Vision; Tool calling; Structured output; Alias of `github_copilot/claude-opus-5.5` |
| GitHub Copilot | `github_copilot/claude-sonnet-latest` | 200,000 | $2 | $10 | Chat; Reasoning; Vision; Tool calling; Structured output; Alias of `github_copilot/claude-sonnet-5.5` |
| GitHub Copilot | `github_copilot/gpt-astra-latest` | 922,000 | $10 | $50 | Responses; Reasoning; Vision; Tool calling; Structured output; Alias of `github_copilot/gpt-6-astra` |
| GitHub Copilot | `github_copilot/gpt-luna-latest` | 922,000 | $0.1 | $0.5 | Responses; Reasoning; Vision; Tool calling; Structured output; Alias of `github_copilot/gpt-6-luna` |
| GitHub Copilot | `github_copilot/gpt-sol-latest` | 922,000 | $2 | $10 | Responses; Reasoning; Vision; Tool calling; Structured output; Alias of `github_copilot/gpt-6.1-sol` |
| GitHub Copilot | `github_copilot/gpt-terra-latest` | 922,000 | $1 | $5 | Responses; Reasoning; Vision; Tool calling; Structured output; Alias of `github_copilot/gpt-6.1-terra` |
| GitHub Copilot | `github_copilot/grok-latest` | 500,000 | $2 | $6 | Chat; Reasoning; Vision; Tool calling; Structured output; Alias of `github_copilot/grok-4.7` |
| GitHub Copilot | `github_copilot/kimi-latest` | 917,504 | $3 | $15 | Chat; Vision; Tool calling; Structured output; Alias of `github_copilot/kimi-k3` |
| GMI Cloud | `gmi/MiniMaxAI/MiniMax-M2.5` | 196,608 | $0.3 | $1.2 | Chat |
| GMI Cloud | `gmi/MiniMaxAI/MiniMax-M2.7` | 196,608 | $0.21 | $0.84 | Chat |
| GMI Cloud | `gmi/MiniMaxAI/MiniMax-M2` | 196,608 | $0.3 | $1.2 | Chat |
| GMI Cloud | `gmi/MiniMaxAI/MiniMax-M3.1-Flash` | 1,048,576 | $0.1125 | $0.45 | Chat |
| GMI Cloud | `gmi/MiniMaxAI/MiniMax-M3` | 1,048,576 | $0.24 | $0.96 | Chat |
| GMI Cloud | `gmi/Qwen/Qwen3-235B-A22B-FP8` | 32,768 | $0.17 | $1.09 | Chat |
| GMI Cloud | `gmi/Qwen/Qwen3-235B-A22B-Instruct-2507-FP8` | 262,144 | $0.0875 | $0.35 | Chat |
| GMI Cloud | `gmi/Qwen/Qwen3-235B-A22B-Thinking-2507-FP8` | 262,141 | $0.35 | $4.2 | Chat |
| GMI Cloud | `gmi/Qwen/Qwen3-30B-A3B` | 40,946 | $0.08 | $0.25 | Chat |
| GMI Cloud | `gmi/Qwen/Qwen3-32B-FP8` | 32,768 | $0.1 | $0.6 | Chat |
| GMI Cloud | `gmi/Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8` | 262,128 | $0.9 | $4.5 | Chat |
| GMI Cloud | `gmi/Qwen/Qwen3-Next-80B-A3B-Instruct` | 262,144 | $0.15 | $1.5 | Chat |
| GMI Cloud | `gmi/Qwen/Qwen3-Next-80B-A3B-Thinking` | 262,144 | $0.15 | $1.5 | Chat |
| GMI Cloud | `gmi/Qwen/Qwen3.5-122B-A10B` | 262,144 | $0.4 | $3.2 | Chat |
| GMI Cloud | `gmi/Qwen/Qwen3.5-27B` | 262,144 | $0.3 | $2.4 | Chat |
| GMI Cloud | `gmi/Qwen/Qwen3.5-35B-A3B` | 262,144 | $0.25 | $2 | Chat |
| GMI Cloud | `gmi/Qwen/Qwen3.5-397B-A17B` | 262,144 | $0.6 | $3.6 | Chat |
| GMI Cloud | `gmi/Qwen/Qwen3.6-35B-A3B` | 262,144 | $0.248 | $1.485 | Chat |
| GMI Cloud | `gmi/Qwen/Qwen3.6-Plus-2026-04-02` | 262,144 | $0.5 | $3 | Chat |
| GMI Cloud | `gmi/Qwen/Qwen3.6-Plus` | 262,144 | $0.5 | $3 | Chat |
| GMI Cloud | `gmi/Qwen/Qwen3.7-Max` | 262,144 | $2.5 | $7.5 | Chat |
| GMI Cloud | `gmi/Qwen/Qwen3.8-27B` | 1,048,575 | $0.45 | $3.2 | Chat |
| GMI Cloud | `gmi/Qwen/Qwen3.8-Flash` | 1,048,575 | $0.16 | $0.47 | Chat |
| GMI Cloud | `gmi/Qwen/Qwen3.8-Max-0902` | 262,144 | $1.65 | $4.951 | Chat |
| GMI Cloud | `gmi/Qwen/Qwen3.8-Max` | 262,144 | $2 | $6 | Chat |
| GMI Cloud | `gmi/XiaomiMiMo/MiMo-V2.5-Pro` | 1,050,000 | $0.3045 | $0.609 | Chat |
| GMI Cloud | `gmi/XiaomiMiMo/MiMo-V2.5` | 1,050,000 | $0.119 | $0.238 | Chat |
| GMI Cloud | `gmi/XiaomiMiMo/MiMo-V2.6-Flash` | 1,050,000 | $0.112 | $0.224 | Chat |
| GMI Cloud | `gmi/XiaomiMiMo/MiMo-V2.6-Pro` | 1,050,000 | $0.348 | $0.696 | Chat |
| GMI Cloud | `gmi/deepseek-ai/DeepSeek-Prover-V2-671B` | 131,072 | $0.5 | $2.18 | Chat |
| GMI Cloud | `gmi/deepseek-ai/DeepSeek-R1-0528` | 131,072 | $0.57 | $2.29 | Chat |
| GMI Cloud | `gmi/deepseek-ai/DeepSeek-R1-Distill-Llama-70B` | 131,072 | $0.25 | $0.75 | Chat |
| GMI Cloud | `gmi/deepseek-ai/DeepSeek-R1-Distill-Llama-8B` | 131,072 | $0.14 | $0.39 | Chat |
| GMI Cloud | `gmi/deepseek-ai/DeepSeek-R1-Distill-Qwen-14B` | 131,072 | $0.2 | $0.2 | Chat |
| GMI Cloud | `gmi/deepseek-ai/DeepSeek-R1-Distill-Qwen-32B` | 131,072 | $0.5 | $0.9 | Chat |
| GMI Cloud | `gmi/deepseek-ai/DeepSeek-R1-Distill-Qwen-7B` | 131,072 | $0.1 | $0.2 | Chat |
| GMI Cloud | `gmi/deepseek-ai/DeepSeek-R1` | 131,072 | $0.5 | $2.18 | Chat |
| GMI Cloud | `gmi/deepseek-ai/DeepSeek-V3.1-Terminus` | 131,072 | $0.27 | $1 | Chat |
| GMI Cloud | `gmi/deepseek-ai/DeepSeek-V3.1` | 163,840 | $0.27 | $1 | Chat |
| GMI Cloud | `gmi/deepseek-ai/DeepSeek-V3.2-Exp` | 163,840 | $0.27 | $0.41 | Chat |
| GMI Cloud | `gmi/deepseek-ai/DeepSeek-V3.2-Speciale` | 163,840 | $0.28 | $0.4 | Chat |
| GMI Cloud | `gmi/deepseek-ai/DeepSeek-V4-Flash-0731` | 1,048,576 | $0.286 | $0.858 | Chat |
| GMI Cloud | `gmi/deepseek-ai/DeepSeek-V4-Flash` | 1,048,575 | $0.091 | $0.182 | Chat |
| GMI Cloud | `gmi/deepseek-ai/DeepSeek-V4-Pro-0813` | 1,048,575 | $1.056 | $3.168 | Chat |
| GMI Cloud | `gmi/deepseek-ai/DeepSeek-V4.1-Flash` | 1,048,575 | $0.18 | $0.72 | Chat |
| GMI Cloud | `gmi/deepseek-ai/deepseek-v4-flash-vision-exp` | 1,048,575 | $0.44 | $1.32 | Chat |
| GMI Cloud | `gmi/deepseek-ai/deepseek-v4.1-flash-1017` | 1,048,575 | $0.18 | $0.72 | Chat |
| GMI Cloud | `gmi/gmicloud/Ripple-65B-Preview` | 1,000,000 | $0.2 | $0.6 | Chat |
| GMI Cloud | `gmi/google/gemini-3.1-flash-lite-preview` | 1,048,576 | $0.25 | $1.5 | Chat |
| GMI Cloud | `gmi/google/gemini-3.1-pro-preview` | 1,048,576 | $2 | $12 | Chat |
| GMI Cloud | `gmi/google/gemini-3.5-flash-lite` | 1,048,576 | $0.3 | $2.5 | Chat |
| GMI Cloud | `gmi/google/gemini-3.5-flash` | 1,048,576 | $1.5 | $9 | Chat |
| GMI Cloud | `gmi/google/gemini-3.6-flash` | 1,048,576 | $1.5 | $7.5 | Chat |
| GMI Cloud | `gmi/google/gemini-3.7-flash` | 1,048,576 | $0.75 | $3.75 | Chat |
| GMI Cloud | `gmi/google/gemini-3.8-flash` | 1,048,576 | $0.75 | $3.75 | Chat |
| GMI Cloud | `gmi/google/gemini-4-argon` | 1,048,576 | $2 | $10 | Chat |
| GMI Cloud | `gmi/google/gemma-4-26b-a4b-it` | 256,000 | $0.13 | $0.4 | Chat |
| GMI Cloud | `gmi/google/gemma-4-31b-it` | 262,144 | $0.14 | $0.4 | Chat |
| GMI Cloud | `gmi/meta-llama/Llama-3.3-70B-Instruct` | 131,072 | $0.25 | $0.75 | Chat |
| GMI Cloud | `gmi/meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8` | 1,048,576 | $0.25 | $0.8 | Chat |
| GMI Cloud | `gmi/meta-llama/Llama-4-Scout-17B-16E-Instruct` | 1,048,576 | $0.08 | $0.5 | Chat |
| GMI Cloud | `gmi/moonshotai/Kimi-K2-Instruct-0905` | 262,144 | $0.57 | $2.29 | Chat |
| GMI Cloud | `gmi/moonshotai/Kimi-K2.5` | 262,144 | $0.6 | $3 | Chat |
| GMI Cloud | `gmi/moonshotai/Kimi-K2.6` | 262,144 | $0.855 | $3.6 | Chat |
| GMI Cloud | `gmi/moonshotai/kimi-k2.7-code-highspeed` | 262,144 | $1.9 | $8 | Chat |
| GMI Cloud | `gmi/moonshotai/kimi-k2.7-code` | 262,144 | $0.95 | $4 | Chat |
| GMI Cloud | `gmi/moonshotai/kimi-k3.1-pro` | 1,048,576 | $2 | $10 | Chat |
| GMI Cloud | `gmi/moonshotai/kimi-k3` | 1,048,576 | $3 | $15 | Chat |
| GMI Cloud | `gmi/nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-BF16` | 65,536 | $0.15 | $1 | Chat |
| GMI Cloud | `gmi/nvidia/NVIDIA-Nemotron-3.5-Super-VL-120B-A12B-BF16` | 32,768 | $0.1 | $0.5 | Chat |
| GMI Cloud | `gmi/nvidia/nemotron-3-ultra-550b-a55b` | 262,144 | $0.8 | $2.6 | Chat |
| GMI Cloud | `gmi/openai/gpt-5.4-mini` | 409,600 | $0.75 | $4.5 | Chat |
| GMI Cloud | `gmi/openai/gpt-5.4-nano` | 409,600 | $0.2 | $1.25 | Chat |
| GMI Cloud | `gmi/openai/gpt-5.4-pro` | 409,600 | $30 | $180 | Chat |
| GMI Cloud | `gmi/openai/gpt-5.4` | 409,600 | $2.5 | $15 | Chat |
| GMI Cloud | `gmi/openai/gpt-5.5` | 1,050,000 | $5 | $30 | Chat |
| GMI Cloud | `gmi/openai/gpt-5.6-luna` | 1,050,000 | $1 | $6 | Chat |
| GMI Cloud | `gmi/openai/gpt-5.6-sol` | 1,050,000 | $5 | $30 | Chat |
| GMI Cloud | `gmi/openai/gpt-5.6-terra` | 1,050,000 | $2.5 | $15 | Chat |
| GMI Cloud | `gmi/openai/gpt-6-astra` | 1,050,000 | $10 | $50 | Chat |
| GMI Cloud | `gmi/openai/gpt-6-luna` | 1,050,000 | $0.1 | $0.5 | Chat |
| GMI Cloud | `gmi/openai/gpt-6-sol` | 1,050,000 | $2 | $10 | Chat |
| GMI Cloud | `gmi/openai/gpt-6.1-sol` | 1,050,000 | $2 | $10 | Chat |
| GMI Cloud | `gmi/openai/gpt-oss-120b` | 131,072 | $0.05 | $0.25 | Chat |
| GMI Cloud | `gmi/openai/gpt-oss-20b` | 131,072 | $0.04 | $0.15 | Chat |
| GMI Cloud | `gmi/stepfun-ai/Step-3.7-Flash` | 256,000 | $0.2 | $1.15 | Chat |
| GMI Cloud | `gmi/stepfun-ai/Step-5-Preview` | 1,048,576 | $1 | $2.7 | Chat |
| GMI Cloud | `gmi/tencent/HunyuanOCR` | 32,768 | $0.5 | $0.5 | Chat |
| GMI Cloud | `gmi/tencent/Hy3` | 262,144 | $0.14 | $0.58 | Chat |
| GMI Cloud | `gmi/tencent/hy3-preview` | 262,144 | $0.18 | $0.6 | Chat |
| GMI Cloud | `gmi/tencent/hy4-preview` | 262,144 | $0.834 | $2.501 | Chat |
| GMI Cloud | `gmi/tencent/hy4` | 1,000,000 | $0.417 | $1.2505 | Chat |
| GMI Cloud | `gmi/x-ai/grok-4.5` | 2,000,000 | $2 | $6 | Chat |
| GMI Cloud | `gmi/xai/grok4.6` | 2,000,000 | $2 | $6 | Chat |
| GMI Cloud | `gmi/zai-org/GLM-4.5-Air-FP8` | 131,076 | $0.2 | $1.1 | Chat |
| GMI Cloud | `gmi/zai-org/GLM-4.5-FP8` | 131,072 | $0.6 | $2.2 | Chat |
| GMI Cloud | `gmi/zai-org/GLM-4.6` | 204,800 | $0.6 | $2 | Chat |
| GMI Cloud | `gmi/zai-org/GLM-4.7-Flash` | 202,752 | $0.07 | $0.4 | Chat |
| GMI Cloud | `gmi/zai-org/GLM-5-FP8` | 202,752 | $0.6 | $1.92 | Chat |
| GMI Cloud | `gmi/zai-org/GLM-5.1-FP8` | 202,752 | $1.4 | $4.4 | Chat |
| GMI Cloud | `gmi/zai-org/GLM-5.2-FP8` | 1,048,576 | $1.4 | $4.4 | Chat |
| GMI Cloud | `gmi/zai-org/GLM-5.3-Flash` | 1,048,576 | $0.075 | $0.25 | Chat |
| GMI Cloud | `gmi/zai-org/GLM-5.3` | 1,048,576 | $0.7 | $2.2 | Chat |
| Jina AI | `jina-reranker-m0` | 10,240 | $0.05 | $0 | Rerank |
| Jina AI | `jina-reranker-v3.5` | 131,072 | $0.05 | $0 | Rerank |
| MiniMax | `minimax/minimax-latest` | 1,000,000 | $0.3 | $1.2 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Alias of `minimax/MiniMax-M3` |
| Moonshot | `moonshot/kimi-k3.1-pro-highspeed` | 1,048,576 | $4 | $20 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Moonshot | `moonshot/kimi-latest` | 1,048,576 | $3 | $15 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Alias of `moonshot/kimi-k3` |
| Nebius | `nebius/MiniMaxAI/MiniMax-M3.1-Flash` | 1,048,576 | $0.15 | $0.6 | Chat; Reasoning; Vision; Tool calling |
| Nebius | `nebius/deepseek-ai/DeepSeek-V4.1-Flash-1017` | 1,048,576 | $0.3 | $1.2 | Chat; Reasoning; Vision; Tool calling |
| Nebius | `nebius/meta-models/muse-spark-open` | 1,048,576 | $1.25 | $4.25 | Chat; Reasoning; Vision; Tool calling |
| Nebius | `nebius/moonshotai/Kimi-K3.1-Pro` | - | $2 | $10 | Chat; Reasoning; Vision; Tool calling; Prompt caching |
| Nebius | `nebius/nvidia/Nemotron-3.5-Super-VL` | 1,048,576 | $0.3 | $0.9 | Chat; Reasoning; Vision; Tool calling |
| OpenAI | `gpt-6-cyber` | 922,000 | $20 | $100 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search; PDF input; Computer use |
| OpenAI | `gpt-astra-latest` | 922,000 | $10 | $50 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search; PDF input; Computer use; Alias of `gpt-6-astra` |
| OpenAI | `gpt-image-2.6-flare` | - | $5 | - | Image generation; Vision; PDF input |
| OpenAI | `gpt-image-2.6-sunburst` | - | $5 | - | Image generation; Vision; PDF input |
| OpenAI | `gpt-luna-latest` | 922,000 | $0.1 | $0.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search; PDF input; Computer use; Alias of `gpt-6-luna` |
| OpenAI | `gpt-mini-latest` | 272,000 | $0.75 | $4.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search; PDF input; Alias of `gpt-5.4-mini` |
| OpenAI | `gpt-sol-latest` | 922,000 | $2 | $10 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search; PDF input; Computer use; Alias of `gpt-6.1-sol` |
| OpenAI | `gpt-terra-latest` | 922,000 | $1 | $5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search; PDF input; Computer use; Alias of `gpt-6.1-terra` |
| Parallel AI | `parallel_ai/decision` | 32,000 | $0 | $0 | Evaluation; $0.001 per query |
| Perplexity | `perplexity/google/gemini-4-argon` | - | $2 | $10 | Responses |
| Perplexity | `perplexity/perplexity/nemotron-3.5-super-120b-a12b` | - | $0.2 | $0.5 | Responses |
| Tencent TokenHub | `tencent/hy4-preview` | 960,000 | $0.834 | $2.501 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Tencent TokenHub | `tencent/hy4` | 960,000 | $0.834 | $2.501 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Together AI | `together_ai/deepseek-pro-latest` | 1,048,576 | $1.32 | $3.96 | Chat; Tool calling; Prompt caching; Structured output; Alias of `together_ai/deepseek-ai/DeepSeek-V4-Pro-0813` |
| Together AI | `together_ai/essentialai/rnj-1-instruct` | - | $0.15 | $0.15 | Chat |
| Together AI | `together_ai/glm-flash-latest` | 1,048,575 | $0.15 | $0.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Alias of `together_ai/zai-org/GLM-5.3-Flash` |
| Together AI | `together_ai/glm-latest` | 1,048,575 | $1.4 | $4.4 | Chat; Reasoning; Tool calling; Prompt caching; Structured output; Alias of `together_ai/zai-org/GLM-5.3` |
| Together AI | `together_ai/kimi-latest` | 1,048,576 | $3 | $15 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Alias of `together_ai/moonshotai/Kimi-K3` |
| Together AI | `together_ai/moonshotai/Kimi-K3.1-Pro` | 1,048,576 | $2 | $10 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Together AI | `together_ai/qwen-flash-latest` | 1,000,000 | $0.15 | $0.47 | Chat; Alias of `together_ai/Qwen/Qwen3.8-Flash` |
| Together AI | `together_ai/ricursive-ai/Ripple-65B-Preview` | 131,072 | $0.2 | $0.6 | Chat; Prompt caching |
| Vertex AI | `vertex_ai/claude-fable-latest` | 1,000,000 | $10 | $50 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use; Alias of `vertex_ai/claude-fable-5-1` |
| Vertex AI | `vertex_ai/claude-haiku-latest` | 1,000,000 | $0.1 | $0.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use; Alias of `vertex_ai/claude-haiku-5-5` |
| Vertex AI | `vertex_ai/claude-opus-latest` | 1,000,000 | $4 | $20 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use; Alias of `vertex_ai/claude-opus-5-5` |
| Vertex AI | `vertex_ai/claude-sonnet-latest` | 1,000,000 | $2 | $10 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use; Alias of `vertex_ai/claude-sonnet-5-5` |
| Vertex AI | `vertex_ai/gemini-omni-1.2-flash` | 131,072 | $1.5 | $9 | Chat; Reasoning; Vision |
| Vertex AI | `vertex_ai/grok-latest` | 524,288 | $2 | $6 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Alias of `vertex_ai/xai/grok-4.7` |
| Wally | `wally/deepseek-v4-flash-0731` | 1,048,576 | $0.44 | $1.32 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Wally | `wally/deepseek-v4-pro-fast` | 1,048,576 | $1.91 | $3.83 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Wally | `wally/deepseek-v4.1-flash-1017` | 1,048,576 | $0.375 | $1.5 | Chat; Reasoning; Tool calling; Prompt caching |
| Wally | `wally/deepseek-v4.1-flash-f2` | 1,048,576 | $0.3 | $1.2 | Chat; Reasoning; Vision; Tool calling; Prompt caching |
| Wally | `wally/deepseek-v4.1-flash-fast` | 1,048,576 | $0.6 | $2.4 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Wally | `wally/deepseek-v4.1-flash` | 1,048,569 | $0.3 | $1.2 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Wally | `wally/glm-5.3-fast` | 1,048,576 | $2.1 | $6.6 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Wally | `wally/glm-5.3-flash` | 1,048,567 | $0.272 | $0.65 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Wally | `wally/kimi-k3` | 1,048,576 | $3 | $15 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Wally | `wally/minimax-m3` | 524,287 | $0.33 | $1.32 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Weights and Biases | `wandb/deepseek-ai/DeepSeek-V4.1-Flash-1017` | 1,049,000 | $0.13 | $0.65 | Chat; Reasoning; Vision; Prompt caching |
| xAI | `xai/grok-latest` | 500,000 | $2 | $6 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Web search; Alias of `xai/grok-4.7` |
| Z.AI | `zai/glm-flash-latest` | 1,048,576 | $0.15 | $0.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Alias of `zai/glm-5.3-flash` |
| Z.AI | `zai/glm-latest` | 1,000,000 | $1.4 | $4.4 | Chat; Reasoning; Tool calling; Prompt caching; Structured output; Alias of `zai/glm-5.3` |

</details>

### New providers

- Add Wally as an OpenAI-compatible provider, so `wally/<model>` routes, its prices and limits are in the cost map, and it appears in the Admin UI add-model form - [PR #45662](https://github.com/BerriAI/litellm/pull/45662)

### Decisions providers

- Add Parallel AI web-grounded Decisions so the Parallel Decisions API can be routed through LiteLLM, with nullable `confidence` on choices and scores - [PR #49188](https://github.com/BerriAI/litellm/pull/49188)
- Add EmpirioLabs AI as a Decisions provider, so `empiriolabs/aplomb-1` works on `/v1/decisions` and `/v1/systemone` instead of failing with Unknown Decisions provider - [PR #49977](https://github.com/BerriAI/litellm/pull/49977)

### Amazon Bedrock

- Forward the client's `per-turn-control-2026-07-01` beta header to Bedrock Invoke, matching the Anthropic, Azure and Vertex routes - [PR #43086](https://github.com/BerriAI/litellm/pull/43086)
- Fail a Nova Sonic realtime session whose Bedrock stream drops with an `error` event instead of closing 1000, so the Logs page shows the failure and cooldown counts stay accurate - [PR #49170](https://github.com/BerriAI/litellm/pull/49170)
- Keep Claude's thinking on Bedrock when `response_format` `json_schema` is set, including default thinking on Opus 5, Sonnet 5 and Haiku 5.5, and report reasoning tokens in usage - [PR #49696](https://github.com/BerriAI/litellm/pull/49696)
- Send native structured output for `json_schema` on Bedrock Claude models that cannot force a tool, such as Opus 5.5, Sonnet 5.5 and Fable 5.1, so replies stop coming back fenced, with wrong keys or empty - [PR #49703](https://github.com/BerriAI/litellm/pull/49703)
- Reserve DeepSeek V3.2 output capacity in its prompt limit and add retirement dates to the GovCloud West Llama 3 rows - [PR #49732](https://github.com/BerriAI/litellm/pull/49732)
- Map token counting on the alias Claude Sonnet 4.5 and Haiku 4.5 Bedrock rows to bedrock-runtime by adding `token_count_model`, so Count tokens works on them - [PR #49981](https://github.com/BerriAI/litellm/pull/49981)
- Drop Claude's signed thinking when replaying history to GLM, GPT-6 Luna or Nova 2 on Bedrock Converse and to GPT-6 Luna on the Bedrock Responses APIs, which answered 400 - [PR #50073](https://github.com/BerriAI/litellm/pull/50073)
- Remove the GovCloud Kimi K3 `bedrock_mantle` cost map rows, since AWS does not offer that route - [PR #50117](https://github.com/BerriAI/litellm/pull/50117)
- Add published GovCloud batch, flex, priority and caching prices to 28 existing Bedrock cost map rows - [PR #50121](https://github.com/BerriAI/litellm/pull/50121)
- Add GovCloud prices for Kimi, Haiku and Grok on Bedrock, and routing metadata for Grok - [PR #50128](https://github.com/BerriAI/litellm/pull/50128)
- Default to native structured output on Bedrock Opus 5.5, Fable 5.1, Sonnet 5 and Haiku 5.5 in every thinking mode, which avoids the costlier JSON tool shim and streams in many chunks - [PR #50221](https://github.com/BerriAI/litellm/pull/50221)
- Default to native structured output on Bedrock Opus 5 and Opus 4.8 using `outputConfig.textFormat` in every thinking mode, instead of the JSON tool shim that costs 1.25x to 1.5x more - [PR #50222](https://github.com/BerriAI/litellm/pull/50222)
- Add a cost map row for `bedrock/us-gov.xai.grok-4.7` so GovCloud Grok 4.7 calls have price and context information - [PR #50288](https://github.com/BerriAI/litellm/pull/50288)
- Add the published batch rates for GovCloud Grok 4.7 on Bedrock so batch calls are priced - [PR #50291](https://github.com/BerriAI/litellm/pull/50291)
- Add cost map rows for Bedrock Kimi K3.1 Highspeed, priced from the prices AWS now publishes - [PR #50451](https://github.com/BerriAI/litellm/pull/50451)
- Forward Codex helper agent messages that carry encrypted content to Bedrock GPT intact, so a sub-agent gets its task instead of asking for it again - [PR #50457](https://github.com/BerriAI/litellm/pull/50457)
- Derive the web identity session policy per AWS caller, so Bedrock realtime, async invoke, Mantle token counting and agent-runtime pass-through stop returning 403 when the role allows them - [PR #50592](https://github.com/BerriAI/litellm/pull/50592)

### Anthropic

- Stop surfacing Anthropic `server_tool_use` blocks as client `tool_calls`, so web fetch and code execution no longer come back as `function_call` on `/v1/responses` - [PR #48385](https://github.com/BerriAI/litellm/pull/48385)
- Sync the beta header allowlist for `anthropic`, `vertex_ai` and `azure_ai`, so betas they accept like task budgets now take effect and `computer_20251124` chat calls stop answering 400 - [PR #49409](https://github.com/BerriAI/litellm/pull/49409)
- Pick the beta allowlist row per deployment so Foundry-hosted `anthropic` deployments stop sending unsupported betas that return 400, and surface `input_transformations` on chat completions - [PR #49689](https://github.com/BerriAI/litellm/pull/49689)
- Carry `prompt_cache_breakpoint` on chat messages to `cache_control` for Claude, so OpenAI-shaped clients get prompt caching instead of it being silently dropped - [PR #49783](https://github.com/BerriAI/litellm/pull/49783)
- Fix `get_supported_openai_params` to list `temperature` and `top_p` only for Anthropic models that keep them, since Opus 4.7 rejects both - [PR #50144](https://github.com/BerriAI/litellm/pull/50144)
- Stop streamed Anthropic structured output from swapping number-like tool argument pieces for `Infinity` when a json_schema has `"properties": null` - [PR #50470](https://github.com/BerriAI/litellm/pull/50470)
- Make `reasoning_effort: "none"` disable thinking on `claude-haiku-5-5`, `claude-sonnet-5` and `claude-opus-5` on every route, so they stop thinking and billing for it - [PR #50541](https://github.com/BerriAI/litellm/pull/50541)
- Refresh the WIF bearer token on Anthropic connection error retries, so a token that expires mid-attempt no longer causes a 401 - [PR #50570](https://github.com/BerriAI/litellm/pull/50570)
- Exchange Google identity tokens again on a mandatory refresh for Anthropic WIF deployments, and read `oidc/` references out of `ANTHROPIC_IDENTITY_TOKEN` instead of sending them as the token - [PR #50583](https://github.com/BerriAI/litellm/pull/50583)

### Azure

- Stream `azure_ai` models natively on an Azure OpenAI host on `/v1/messages`, fixing faked streams, the 404 without tools and the 500 on env-only deployments - [PR #49216](https://github.com/BerriAI/litellm/pull/49216)
- Keep `azure_ad_token` out of the request body for `azure_ai`, so chat with only an Entra token stops returning 400 from Foundry for Claude deployments, Cohere embeddings and GPT via `/v1/messages` - [PR #49769](https://github.com/BerriAI/litellm/pull/49769)
- Cite the Azure retirement schedule for the Ada embedding row that already carries a `deprecation_date` - [PR #50044](https://github.com/BerriAI/litellm/pull/50044)
- Strip reasoning `status` and, under `drop_params`, reasoning `content` from Responses input sent to Azure, which rejected them, without modifying the caller's own history - [PR #50046](https://github.com/BerriAI/litellm/pull/50046)
- Sync retirement dates for three Azure model entries with Azure's published retirement schedule - [PR #50296](https://github.com/BerriAI/litellm/pull/50296)
- Align Azure Whisper retirement dates with Azure's later ARM retirement date and add source links to two Azure TTS retirement dates - [PR #50430](https://github.com/BerriAI/litellm/pull/50430)
- Add `azure_ai/cohere-rerank-v5-pro` and `azure_ai/cohere-rerank-v5-fast`, priced at $0.05 and $0.02 per 1M input tokens from the Azure retail price feed - [PR #50499](https://github.com/BerriAI/litellm/pull/50499)
- Align the retirement date and source of the Azure `chat-latest` alias row with its documented alias - [PR #50509](https://github.com/BerriAI/litellm/pull/50509)
- Add Data Zone cost map rows for `gpt-realtime-2.1`, `gpt-realtime-2.1-mini` and `gpt-realtime-1.5` on Azure, so US Data Zone calls get a price - [PR #50519](https://github.com/BerriAI/litellm/pull/50519)

### Gemini and Vertex AI

- Map Anthropic context overflow errors from Vertex AI Claude to a context window error, so `context_window_fallbacks` now fires instead of returning a generic 400 or 500 - [PR #36963](https://github.com/BerriAI/litellm/pull/36963)
- Answer 400 for an unsupported Gemini chat audio format instead of 500, drop it under `drop_params`, and stop ignoring a format set inside `speech_config` - [PR #49423](https://github.com/BerriAI/litellm/pull/49423)
- Add a `supports_continuation` capability flag for models that support `continuationToken` long decode, and keep a deployment's `model_info` override in `/model_group/info` - [PR #49500](https://github.com/BerriAI/litellm/pull/49500)
- Resend once with the placeholder signature when AI Studio or Vertex AI rejects a thought signature replayed from the other backend, instead of returning a 400 - [PR #49697](https://github.com/BerriAI/litellm/pull/49697)
- Lower the `gemini/gemini-3.5-flash-lite` batch cache read price to 1.5e-08 and add the shutdown dates for `gemini/gemini-2.5-pro` and `gemini/gemini-2.5-flash` - [PR #49871](https://github.com/BerriAI/litellm/pull/49871)
- Remove the batch prices and the `/v1/batch` endpoint from `vertex_ai/gemini-robotics-er-2-preview` and `gemini-robotics-er-2-preview` to match the Vertex model page - [PR #49895](https://github.com/BerriAI/litellm/pull/49895)
- Add missing Vertex audio, long-context Flex and Priority image prices, and remove six fixed retirement dates that Google publishes only as earliest possible dates - [PR #49964](https://github.com/BerriAI/litellm/pull/49964)
- Point `successor_model` on `gemini/gemini-2.5-pro` and `gemini/gemini-2.5-flash` at the replacements Google now names on its deprecations page - [PR #50064](https://github.com/BerriAI/litellm/pull/50064)
- Add `vertex_ai/gemini-omni-1.2-flash` with its published token prices, larger output limit and Interactions-only capabilities - [PR #50227](https://github.com/BerriAI/litellm/pull/50227)
- Add Gemini Omni 1.2 Flash pricing so proxy calls are no longer logged at $0, point retired Gemini video models at it, and correct the Omni 1.1 input limit to 131072 - [PR #50229](https://github.com/BerriAI/litellm/pull/50229)
- Return 400 instead of 500 from `/v1/images/edits` when a Vertex AI Gemini image edit request has no image, so client SDKs stop retrying and 5xx alarms stay quiet - [PR #50244](https://github.com/BerriAI/litellm/pull/50244)
- Honor `vertex_location` for Vertex AI Chirp text-to-speech so a deployment pinned to a US or EU region calls that multi-region host instead of the global one - [PR #50255](https://github.com/BerriAI/litellm/pull/50255)
- Correct the shutdown date of `gemini/gemini-embedding-2-preview` to 2026-11-06, when Google routes it to `gemini-embedding-2` - [PR #50429](https://github.com/BerriAI/litellm/pull/50429)
- Add Google's recommended replacement models to five Gemini cost map rows that omitted them - [PR #50468](https://github.com/BerriAI/litellm/pull/50468)
- Add the Flex cache read price above 200k tokens, `cache_read_input_token_cost_above_200k_tokens_flex`, to `gemini/gemini-2.5-pro` - [PR #50480](https://github.com/BerriAI/litellm/pull/50480)
- Add the Flex above-200k cache read price to the `gemini/gemini-3.1-pro-preview` and customtools rows - [PR #50607](https://github.com/BerriAI/litellm/pull/50607)

### OpenAI

- Bill requests to `gov.api.openai.com` with OpenAI's 10% FedRAMP uplift, a 1.1x multiplier, which they were missing before - [PR #49951](https://github.com/BerriAI/litellm/pull/49951)
- Add `gpt-image-2.6-sunburst` and `gpt-image-2.6-flare` to the cost map with Standard image generation prices - [PR #50134](https://github.com/BerriAI/litellm/pull/50134)
- Add the published Batch image output prices to OpenAI image rows so they match `input_cost_per_image_token_batches`, with billed cost unchanged - [PR #50138](https://github.com/BerriAI/litellm/pull/50138)
- Stop sending `OPENAI_ADMIN_KEY` as the bearer token for an `openai/` deployment with an empty `api_key` when running openai 3.x - [PR #50218](https://github.com/BerriAI/litellm/pull/50218)
- Add `max_input_tokens` of 922000 for `gpt-6-cyber` and a `deprecation_date` of 2027-02-01 for `gpt-5.5-cyber-preview` in the model catalog - [PR #50254](https://github.com/BerriAI/litellm/pull/50254)

### Other providers

- Forward `text` and `max_output_tokens` to the ChatGPT Codex backend, so `chatgpt/*` honors strict JSON schemas, `text.verbosity` and `max_tokens` instead of silently ignoring them - [PR #38086](https://github.com/BerriAI/litellm/pull/38086)
- Fix Mistral dropping a named function `tool_choice`, so the forced tool now reaches Mistral, `codestral` and Mistral on `vertex_ai` instead of the model picking any tool - [PR #39737](https://github.com/BerriAI/litellm/pull/39737)
- List `hosted_vllm/*` wildcard models on `/v1/models` when the vLLM server has no api key, and read the same server that chat calls use instead of `VLLM_API_BASE` - [PR #40066](https://github.com/BerriAI/litellm/pull/40066)
- Keep vLLM's `stop_reason` and `token_ids` on `hosted_vllm` chat choices and stream chunks, including streams and cache hits that used to drop them - [PR #48393](https://github.com/BerriAI/litellm/pull/48393)
- Fix Databricks `json_object` requests that 400 when the last message has several text parts, by joining plain text blocks for non-Claude models - [PR #49385](https://github.com/BerriAI/litellm/pull/49385)
- Fix Cohere v2 non-streaming chat responses to return `finish_reason` `tool_calls` for tool calls and `length` for `MAX_TOKENS`, so agent loops run the tool instead of stopping - [PR #49529](https://github.com/BerriAI/litellm/pull/49529)
- Update the EmpirioLabs model rows and add `/v1/embeddings` for EmpirioLabs, so `embedding(model="empiriolabs/text-embedding-v4")` reaches the OpenAI-compatible endpoint - [PR #49980](https://github.com/BerriAI/litellm/pull/49980)
- Add `successor_model` to seven retiring `together_ai` rows, using the replacements Together names on its deprecations page and changelog - [PR #50026](https://github.com/BerriAI/litellm/pull/50026)
- Add `together_ai/moonshotai/Kimi-K3.1-Pro` to the model catalog, since Together serves it but it had no row - [PR #50069](https://github.com/BerriAI/litellm/pull/50069)
- Add Databricks retirement successors and the `kimi-k2-7` retirement date to the cost map, taken from the Databricks retired models page - [PR #50094](https://github.com/BerriAI/litellm/pull/50094)
- Add serverless pricing for Kimi K3.1 Pro on Fireworks to the cost map, so spend is tracked for it - [PR #50095](https://github.com/BerriAI/litellm/pull/50095)
- Fix GitHub Copilot per-user connections that use a custom GitHub client ID, which failed with no Copilot access found after sign-in - [PR #50116](https://github.com/BerriAI/litellm/pull/50116)
- Fix GitHub Copilot requests that failed with 403 from `copilot_internal/v2/token` by sending the GitHub token directly instead of exchanging it - [PR #50126](https://github.com/BerriAI/litellm/pull/50126)
- Fix NVIDIA Riva 403 errors behind a token check by calling Riva over gRPC directly and sending the api key exactly once, and apply the request timeout to streaming calls - [PR #50140](https://github.com/BerriAI/litellm/pull/50140)
- Add published retirement dates for five Mistral models in the model catalog so their lifecycle can be looked up - [PR #50294](https://github.com/BerriAI/litellm/pull/50294)
- Add `databricks/databricks-kimi-k3-1-pro` pay-per-token pricing for the new Kimi K3.1 Pro endpoint on Databricks - [PR #50303](https://github.com/BerriAI/litellm/pull/50303)
- Add sourced retirement dates and replacement models for Fireworks deprecations in the model catalog - [PR #50334](https://github.com/BerriAI/litellm/pull/50334)
- Sync Weights & Biases `wandb` prices to the CoreWeave Forge Serverless Inference page and add DeepSeek V4.1-Flash-1017 - [PR #50476](https://github.com/BerriAI/litellm/pull/50476)
- Sync the Baseten Kimi K3.1 Pro output token limit with the limit Baseten now publishes - [PR #50477](https://github.com/BerriAI/litellm/pull/50477)
- Add `moonshot/kimi-k3.1-pro-highspeed` with Moonshot's published prices of $4 per 1M input tokens and $20 per 1M output tokens - [PR #50538](https://github.com/BerriAI/litellm/pull/50538)
- Update Together Qwen3.7-Max pricing to the current published price and add a cost map entry for Together Rnj-1 Instruct - [PR #50548](https://github.com/BerriAI/litellm/pull/50548)

### Model catalog and pricing

- Consolidate verified provider metadata and prices in the cost map, covering Databricks, Perplexity Agent API, Vertex AI, DeepInfra, Novita, Nebius and Bedrock Opus 5 rows - [PR #49361](https://github.com/BerriAI/litellm/pull/49361)
- Add `search_context_cost_per_query` and `supports_web_search` to the Bedrock Mantle GPT-5.4 and later rows and the GovCloud West Mantle rows, so Web Search is priced on them - [PR #49687](https://github.com/BerriAI/litellm/pull/49687)
- Add the 2027-01-14 shutdown date to the bare `gpt-4o`, `gpt-4o-mini`, `gpt-4.1` and `gpt-4.1-mini` rows, so `/model/deprecations` reports deployments on those ids - [PR #49707](https://github.com/BerriAI/litellm/pull/49707)
- Add `deepgram/streaming/nova-3-medical` so `/deepgram/v1/listen` stops closing with 1008, and raise the Nova-3 streaming rates that under-billed by about 37% against Deepgram's page - [PR #49733](https://github.com/BerriAI/litellm/pull/49733)
- Record the provider's recommended replacement as `successor_model` on deprecating cost map rows and report it from `/model/deprecations` - [PR #49789](https://github.com/BerriAI/litellm/pull/49789)
- Price Mistral Large 4 at its current list price of $0.70 input, $0.07 cached and $2.10 output per million tokens, down from $1.36, $0.14 and $4.18, on both model names - [PR #49814](https://github.com/BerriAI/litellm/pull/49814)
- Fill missing Claude capability fields from the family baseline on Anthropic, Azure, Bedrock and Vertex, so model info shows parallel tool calls and system messages as supported - [PR #49815](https://github.com/BerriAI/litellm/pull/49815)
- Mark `typesafe/jev-latest` as supporting Box questions with `supports_box_questions`, so they are no longer refused or dropped before the call - [PR #49835](https://github.com/BerriAI/litellm/pull/49835)
- Add the `fedramp_uplift_multiplier` key to the cost map row schema so a row can carry a FedRAMP price uplift - [PR #49950](https://github.com/BerriAI/litellm/pull/49950)
- Add an optional `deprecation_source` attribute to cost map rows holding the provider page or feed a `deprecation_date` was read from - [PR #49955](https://github.com/BerriAI/litellm/pull/49955)
- Record `deprecation_source` on every dated cost map row with a known provider notice, so models.litellm.ai can link to the page a `deprecation_date` came from - [PR #49968](https://github.com/BerriAI/litellm/pull/49968)
- Remove 52 cost map rows that providers retired before 2026, so they stop showing as live models in the catalog and on models.litellm.ai - [PR #49974](https://github.com/BerriAI/litellm/pull/49974)
- Sync cost map rows for xAI, Fireworks, Azure and Gemini, including Fireworks Ultramarine 1 Flash US prices that were 1.5x too high and the missing DeepSeek V4.1 Flash 1017 Ultra-fast router - [PR #50028](https://github.com/BerriAI/litellm/pull/50028)
- Fix the `gpt-5.6-cyber` input limit to 272000 tokens and add Azure GPT-6 Flex pricing, Bedrock GovCloud rows and GMI rows to the cost map - [PR #50082](https://github.com/BerriAI/litellm/pull/50082)
- Add `baseten/moonshotai/Kimi-K3.1-Pro` to the cost map with prices, a 1M input limit, and function calling and tool choice support - [PR #50093](https://github.com/BerriAI/litellm/pull/50093)
- Add `together_ai/ricursive-ai/Ripple-65B-Preview` to the cost map with input, cached input and output prices from the Together models API - [PR #50163](https://github.com/BerriAI/litellm/pull/50163)
- Add Gemini Flex prices for prompts over 200k tokens, Live grounding prices, seven GMI rows and EmpirioLabs page prices to the cost map - [PR #50208](https://github.com/BerriAI/litellm/pull/50208)
- Add cost map rows for five released models including `gpt-6-cyber` and Kimi K3.1 Pro so their spend no longer logs as zero, plus capability flags on three rows - [PR #50245](https://github.com/BerriAI/litellm/pull/50245)
- Add OpenRouter-style `-latest` model aliases for first-party providers, so callers no longer need to hardcode pinned names like `gpt-6-luna` - [PR #50315](https://github.com/BerriAI/litellm/pull/50315)
- Add the OpenAI deprecations page as the deprecation source for the `o1` cost map row, matching its `o1-2024-12-17` sibling - [PR #50402](https://github.com/BerriAI/litellm/pull/50402)
- Add the published cached input rate above 272K tokens to the Perplexity `gpt-5.5` cost map row - [PR #50436](https://github.com/BerriAI/litellm/pull/50436)
- Fix `azure_ai/jais-30b-chat` and `watsonx/core42/jais-13b-chat` prices that stored a per-1K-token price as the per-token price and overstated their cost - [PR #50452](https://github.com/BerriAI/litellm/pull/50452)
- Move `-latest` model aliases into the cost map, so a bare alias like `gpt-mini-latest` with no provider resolves to its owner's provider instead of failing - [PR #50491](https://github.com/BerriAI/litellm/pull/50491)
- Let a cost map row point at another model with `alias_of`, so a `-latest` name no longer needs an `aliases` entry on its target row - [PR #50512](https://github.com/BerriAI/litellm/pull/50512)
- Correct the shutdown dates on three OpenAI fine-tune rows and add shutdown dates to the Codestral 2405 rows - [PR #50529](https://github.com/BerriAI/litellm/pull/50529)

## LLM API Endpoints

### Responses API

- Send `sequence_number` on every bridged `/v1/responses` streaming event, including cached, mock and guardrail block streams, and stop `response.output_item.done` from always reporting `1` - [PR #44944](https://github.com/BerriAI/litellm/pull/44944)
- Preserve Responses SSE event framing on streamed `/v1/responses`, naming every event and ending without Chat's `[DONE]`, so named-event clients receive the events - [PR #47980](https://github.com/BerriAI/litellm/pull/47980)
- Authorize and decode response IDs used in comparison requests, so reused proxy IDs no longer fail and comparisons follow the same user and team ownership rules as previous responses - [PR #49402](https://github.com/BerriAI/litellm/pull/49402)
- Fix Azure and OpenAI `json_object` requests returning 400 after chat to Responses translation by keeping the system prompt in `input` - [PR #49957](https://github.com/BerriAI/litellm/pull/49957)
- Fix `POST /v1/responses/compact` returning 500 with `'acompact_responses' is not a valid CallTypes` when a `during_call` guardrail is on by default - [PR #50274](https://github.com/BerriAI/litellm/pull/50274)
- Return 429 instead of 500 for streamed `/v1/responses` `flex_unavailable` errors, so server-error alerts stay quiet and 429-only retry logic works - [PR #50336](https://github.com/BerriAI/litellm/pull/50336)
- Return Bedrock's error to the client when a streamed `/v1/responses` call fails midway with an error chunk that has no event type, instead of a gateway crash or `stream closed early` - [PR #50466](https://github.com/BerriAI/litellm/pull/50466)

### Chat Completions

- Accept OpenAI `allowed_tools` as `tool_choice` on chat completions for OpenAI and Azure, flatten it for the Responses bridge, and keep a clear 400 on providers that would ignore it - [PR #49043](https://github.com/BerriAI/litellm/pull/49043)
- Keep provider fields such as Azure's `content_filter_results` on streamed chat completion chunks, restoring behavior that regressed in v1.86.0 for plain text stream frames - [PR #49398](https://github.com/BerriAI/litellm/pull/49398)
- Answer an upstream overload with 503 `server_is_overloaded` on OpenAI routes instead of a generic 500, and stop `/v1/completions` returning the raw 529 with an `internal_server_error` type - [PR #49993](https://github.com/BerriAI/litellm/pull/49993)
- Drop Anthropic-only `output_config` under `drop_params: true` on providers that do not read it, so OpenAI chat/completions stops returning 400 `Unknown parameter: 'output_config'` - [PR #50542](https://github.com/BerriAI/litellm/pull/50542)
- Accept `tool_choice={"type": "web_search"}` in `litellm.completion` instead of returning a 400, so the Chat route can force an OpenAI hosted tool - [PR #50578](https://github.com/BerriAI/litellm/pull/50578)

### Anthropic Messages API

- Answer an upstream Anthropic 529 as 529 `overloaded_error` on `/v1/messages` instead of 500 `api_error`, restoring a pass-through that regressed in v1.100.0 - [PR #46063](https://github.com/BerriAI/litellm/pull/46063)
- Return Anthropic error envelopes for proxy-raised auth, model access, malformed JSON and budget errors on `/v1/messages`, the gateway and `/anthropic/` routes - [PR #48466](https://github.com/BerriAI/litellm/pull/48466)
- Round-trip encrypted reasoning for `chatgpt/` models through `/v1/messages`, so the next tool-call turn keeps it, including Azure and OpenAI turns bridged to Responses - [PR #49076](https://github.com/BerriAI/litellm/pull/49076)
- Default JSON-schema `strict` to `true` for Messages requests routed through Responses when it is omitted, matching Chat, while keeping an explicit `true` or `false` - [PR #50375](https://github.com/BerriAI/litellm/pull/50375)
- Keep encrypted thinking blocks when the Messages API routes to a configured Azure Responses target, so reasoning is replayed on tool continuations - [PR #50381](https://github.com/BerriAI/litellm/pull/50381)
- Let a per-request header opt a stream into `usage.cost` without the global `include_cost_in_streaming_usage` flag, so only chosen `/v1/messages` streams leave the fast path - [PR #50574](https://github.com/BerriAI/litellm/pull/50574)

### Count tokens

- Count tool requests for grok-4-1, grok-4.3 and DeepSeek V4.1 the way their hosts bill them, fixing counts that ran up to 90% low from a missing hidden prompt - [PR #49074](https://github.com/BerriAI/litellm/pull/49074)

### Prompt caching

- Trim `prompt_cache_breakpoint` to what each API accepts under `drop_params`, so OpenAI, Azure OpenAI and Mantle chat stop answering 400 and Responses keeps the marker when `ttl` is unsupported - [PR #49064](https://github.com/BerriAI/litellm/pull/49064)
- Write the prompt caching pin when `turn_off_message_logging: true` is set, so follow-up requests stop bouncing across the group and paying cache writes on deployments that never serve a read - [PR #50276](https://github.com/BerriAI/litellm/pull/50276)

### Realtime

- Support the latest OpenAI realtime audio models with translation routes and transcription streams, bill audio by provider duration and cached tokens, and accept GA-only Azure models from beta realtime clients - [PR #35600](https://github.com/BerriAI/litellm/pull/35600)
- Check the model in every OpenAI websocket passthrough frame, so keys with a model list are no longer refused outright and connected sessions are billed - [PR #48979](https://github.com/BerriAI/litellm/pull/48979)

### Batches and files

- Let admins restrict which S3 buckets proxy clients may pick for batch jobs, so a client can no longer point a batch at any bucket using the admin's AWS credentials - [PR #47496](https://github.com/BerriAI/litellm/pull/47496)
- Keep the upload the managed file id encodes when two target models share a wildcard deployment, and show the managed id in the vector store file list - [PR #49420](https://github.com/BerriAI/litellm/pull/49420)

### Pass-through endpoints

- Authenticate Vertex AI pass-through requests once, so budgeted keys stop getting a 422 on their first or second call - [PR #48942](https://github.com/BerriAI/litellm/pull/48942)

### Images, audio and video

- Serve `custom_provider_map` `BaseVideoConfig` providers on `/v1/videos`, and return 400 instead of 500 for built-in providers without video support - [PR #49785](https://github.com/BerriAI/litellm/pull/49785)
- Keep transcript text out of transcription error messages for Gemini, Vertex and seven other providers, including client responses, proxy logs and APM spans - [PR #50137](https://github.com/BerriAI/litellm/pull/50137)
- Add first-class OpenRouter video request fields for common inputs, with provider mapping and conflict checks for image inputs - [PR #50319](https://github.com/BerriAI/litellm/pull/50319)

### Embeddings and rerank

- Honor the caller's `timeout` on HuggingFace embeddings and sync Bedrock Cohere embeddings, including the HuggingFace model lookup, so slow endpoints fail fast - [PR #48593](https://github.com/BerriAI/litellm/pull/48593)
- Count embedding batches per input in router pre-call checks, so list-input embedding calls stop logging failed token counts and oversized inputs get a 400 before the provider call - [PR #49851](https://github.com/BerriAI/litellm/pull/49851)

### General

- Surface a failed agentic follow-up model call as an error instead of returning a 200 whose turn asks to run `litellm_web_search`, a tool the client never sent - [PR #49227](https://github.com/BerriAI/litellm/pull/49227)
- Forward `continuation_token` on `/interactions` so a long decode can be resumed, add the `requires_continuation` status, and accept resume requests without `input` - [PR #50151](https://github.com/BerriAI/litellm/pull/50151)
- Add `total_timeout` to cap how long a whole non-streaming proxy request takes, including retries and backoffs, where `timeout` only caps one provider call - [PR #50496](https://github.com/BerriAI/litellm/pull/50496)

## Management Endpoints / UI

### Admin UI

- Show linked user names instead of raw user UUIDs in the Created by and Last Updated by fields on five detail pages, so admins can tell who changed an object - [PR #47181](https://github.com/BerriAI/litellm/pull/47181)
- Rebuild the public AI Hub as a searchable list with a details pane that works on phones, with Agents and MCP tabs always shown and token counts read as 8K or 200K - [PR #49496](https://github.com/BerriAI/litellm/pull/49496)
- Rebuild the command palette on shadcn Command, so `Cmd+K` no longer stacks over open dialogs, `Ctrl+K` no longer opens it on macOS and IME Enter no longer opens a key - [PR #49528](https://github.com/BerriAI/litellm/pull/49528)
- Move the hardcoded English text on the Agents and Knowledge pages of the Admin UI onto i18n translation keys - [PR #49530](https://github.com/BerriAI/litellm/pull/49530)
- Move the hardcoded English text on the admin and settings pages of the Admin UI onto i18n translation keys - [PR #49546](https://github.com/BerriAI/litellm/pull/49546)
- Show the off state of switches in the Admin UI light theme with a medium gray track, so admins can see the control next to a setting's label - [PR #49718](https://github.com/BerriAI/litellm/pull/49718)
- Let admins set an optional custom user ID in the Invite User dialog and the Create User form, so invited users match the ID from `GENERIC_USER_ID_ATTRIBUTE` at SSO login - [PR #49749](https://github.com/BerriAI/litellm/pull/49749)
- Refresh the bundled `litellm/blog_posts.json` backup with the latest 50 posts, so offline deployments no longer show a March post as the latest update - [PR #49971](https://github.com/BerriAI/litellm/pull/49971)
- Let admins upload a local skill ZIP from the dashboard Add Skill form, alongside the Source URL option - [PR #50008](https://github.com/BerriAI/litellm/pull/50008)
- Redesign the dashboard top bar, give Aria its own page that knows the signed-in user for personal spend questions, and separate announcements, articles and deployment settings in notifications - [PR #50009](https://github.com/BerriAI/litellm/pull/50009)
- Restyle Chat to match the dashboard, move the theme toggle to the top bar, put Settings and Sign out in the account menu, and keep New Chat as the only blank conversation entry - [PR #50034](https://github.com/BerriAI/litellm/pull/50034)
- Show a model deprecation banner on the Admin UI models page, so deprecated models are visible without setting up Slack alerting - [PR #50080](https://github.com/BerriAI/litellm/pull/50080)
- Move the shell, entry pages, AI hub and shared widget text onto i18n keys, with English on screen unchanged - [PR #50110](https://github.com/BerriAI/litellm/pull/50110)
- Move the Models, Model Insights and Transform Request page text onto i18n keys, with English on screen unchanged - [PR #50112](https://github.com/BerriAI/litellm/pull/50112)
- Show each deployment's full prices in the model hub, including cached, long prompt, flex, priority, batch and size based prices, on both the logged in and public hubs - [PR #50145](https://github.com/BerriAI/litellm/pull/50145)
- Move about 110 remaining Logs and Usage page strings onto i18n keys, with English on screen unchanged - [PR #50146](https://github.com/BerriAI/litellm/pull/50146)
- Move about 150 remaining models page strings onto i18n keys, with English on screen unchanged - [PR #50147](https://github.com/BerriAI/litellm/pull/50147)
- Move the remaining sidebar, account menu and shared widget text onto i18n keys, with English on screen unchanged - [PR #50148](https://github.com/BerriAI/litellm/pull/50148)
- Add portable version history for skills, so updates keep version labels and earlier publications and stale edits cannot overwrite newer ones - [PR #50152](https://github.com/BerriAI/litellm/pull/50152)
- Redesign the public AI Hub as a catalog with only Model Hub and Skills Hub, and send old tab links to Models with the selection cleared - [PR #50153](https://github.com/BerriAI/litellm/pull/50153)
- Add a portable Agent Skills Hub API with shared upload, import and discovery that no longer depends on Claude plugin routes - [PR #50159](https://github.com/BerriAI/litellm/pull/50159)
- Let members submit skills or updates for review, with a private admin review queue and submission history using portable ZIP upload and import - [PR #50160](https://github.com/BerriAI/litellm/pull/50160)
- Show where a recommended replacement model came from, the cost map or deployment configuration, plus a provider deprecation notice link, on the alert detail page, inbox and bell - [PR #50162](https://github.com/BerriAI/litellm/pull/50162)
- Show per-skill download counts in the published skills table and let admins inspect authenticated downloader history, counting portable, retained-version and Claude-compatible ZIP downloads together - [PR #50165](https://github.com/BerriAI/litellm/pull/50165)
- Add opt-in model deprecation emails to affected key owners and current team admins, with 30 day and 1 day reminders and the recommended replacement, enabled under Logging & Alerts, Email Alerts - [PR #50172](https://github.com/BerriAI/litellm/pull/50172)
- Let admins scan pending Skills Hub submissions with a separately hosted SkillSpector service and review advisory findings before approving or rejecting - [PR #50194](https://github.com/BerriAI/litellm/pull/50194)
- Add a sortable Skills Hub catalog with publication audit columns, tags, people, dates, scan results and download totals, visible to catalog readers including public visitors - [PR #50195](https://github.com/BerriAI/litellm/pull/50195)
- Add an Install / Share action to portable skill details that gives authenticated install and share commands, keeping each recipient's access checks - [PR #50211](https://github.com/BerriAI/litellm/pull/50211)
- Move about 120 remaining keys, teams, agents and cost strings in the Admin UI onto the translation system so they can be localized - [PR #50238](https://github.com/BerriAI/litellm/pull/50238)
- Move about 230 remaining playground, chat and compliance strings across 15 Admin UI files onto the translation system so they can be localized - [PR #50239](https://github.com/BerriAI/litellm/pull/50239)
- Move the remaining Aria, chat composer and admin widget text in the Admin UI onto the translation system so it can be localized - [PR #50242](https://github.com/BerriAI/litellm/pull/50242)
- Move the model deprecation alerts page text in the Admin UI onto the translation system so it can be localized - [PR #50271](https://github.com/BerriAI/litellm/pull/50271)
- Center the deployment health banner icon on its title in critical and warning banners, in light and dark mode - [PR #50302](https://github.com/BerriAI/litellm/pull/50302)
- Keep Admin UI chat strings that are written into assistant messages in English, so models never get translated text as conversation history - [PR #50304](https://github.com/BerriAI/litellm/pull/50304)
- Add a beta language setting to the Admin UI account menu, with a safe English fallback for text that is only partly translated - [PR #50309](https://github.com/BerriAI/litellm/pull/50309)
- Move about 150 remaining hardcoded English strings in helpers, zod schemas and fallbacks in the Admin UI onto the translation system - [PR #50312](https://github.com/BerriAI/litellm/pull/50312)
- Let admins set `tpm_limit` and `rpm_limit` on tags from the Admin UI, and prefill budget and limit fields in the Edit Tag button so limits can be cleared - [PR #50314](https://github.com/BerriAI/litellm/pull/50314)
- Fix the Health table sorting of Last Check and Last Success and the Created date of a regenerated key on non-US browsers, by no longer parsing formatted dates and spend back into values - [PR #50350](https://github.com/BerriAI/litellm/pull/50350)
- Remove the workspace icon from the collapsed navigation selector, keeping the current workspace in its accessible label and hover title - [PR #50369](https://github.com/BerriAI/litellm/pull/50369)
- Format dashboard numbers, money and dates through i18next, so an English UI on a non-English browser shows counts with US separators like `8,123,456` - [PR #50443](https://github.com/BerriAI/litellm/pull/50443)

### Keys, teams and authentication

- Return a 400 instead of a 500 from `GET /key/info` when no `key` is passed and the session has no api key, such as an admin UI session token - [PR #43577](https://github.com/BerriAI/litellm/pull/43577)
- Validate custom IDs on `/user/new`, returning 422 for empty, whitespace-only and NUL-containing IDs, and reject concurrent duplicate creation so only one user is created - [PR #49748](https://github.com/BerriAI/litellm/pull/49748)
- Hash Admin UI passwords with PBKDF2 in FIPS mode, since a FIPS OpenSSL refuses scrypt and every password write failed, and log the 401 a login on a scrypt row returns - [PR #49874](https://github.com/BerriAI/litellm/pull/49874)
- Let `default_team_params` attach `access_group_ids` to every new team, and show an Access Groups row on the Default Team Settings page with a clearer note that the Models row only applies to SSO auto-created teams - [PR #49908](https://github.com/BerriAI/litellm/pull/49908)
- Add a link-only JWT mapping that never creates virtual keys, and stop filtering existing-key selection by route so custom and management routes are included - [PR #49956](https://github.com/BerriAI/litellm/pull/49956)
- Let team admins edit models on team service account keys in the UI, which refused with Team admins can only change budget fields while `/key/update` accepted the change - [PR #49970](https://github.com/BerriAI/litellm/pull/49970)
- Fix a team admin's first save on a member key sending only the key id, which dropped budget edits while a success toast showed and let renames look saved - [PR #50007](https://github.com/BerriAI/litellm/pull/50007)
- Set per-team and per-key deployment weights in the Admin UI, show saved weights, and stop saving a team from dropping weights that were set through the API - [PR #50552](https://github.com/BerriAI/litellm/pull/50552)
- Reject response ids with no recorded owner and apply scope settings consistently across related resource operations - [PR #50600](https://github.com/BerriAI/litellm/pull/50600)

### SSO and SCIM

- Make `/update/sso_settings` a true PATCH and send only changed SSO fields from the UI, so editing role mappings no longer saves the masked secret and breaks SSO logins - [PR #49527](https://github.com/BerriAI/litellm/pull/49527)
- Fix editing one SSO field in the UI nulling SAML and other unseen SSO settings, which made SAML login return 501, and keep a blank saved secret from erasing the legacy env-row secret - [PR #49973](https://github.com/BerriAI/litellm/pull/49973)

### Model management

- Price expanded wildcard `/model/info` rows as the model their calls route to, so alias and routing group rows show the price calls bill - [PR #49128](https://github.com/BerriAI/litellm/pull/49128)
- Return 401 instead of 500 on chat, Responses and Decisions when Entra rejects the deployment's credential, and stop the router retrying a request that can never succeed - [PR #49863](https://github.com/BerriAI/litellm/pull/49863)
- Keep the stored `credential_info` keys when a credential is patched, instead of dropping them in the database - [PR #49919](https://github.com/BerriAI/litellm/pull/49919)
- Support a custom model logo through `model_info.logo_url`, shown in the Model Management table, hover details and model details for models routed through a compatible gateway - [PR #50371](https://github.com/BerriAI/litellm/pull/50371)
- Let admins add a LiteLLM Gateway provider once and pick `All LiteLLM Gateway Models (Wildcard)`, discovering upstream models with that gateway's URL and key and keeping its logo visible - [PR #50374](https://github.com/BerriAI/litellm/pull/50374)

### Usage and analytics

- Restore the per-user spend breakdown on `/user/daily/activity/aggregated`, so User Usage Spend Per User no longer shows no data since v1.105.0 - [PR #49464](https://github.com/BerriAI/litellm/pull/49464)
- Cancel `/team/spend/by_user` in Postgres after 30s so retries stop piling slow `LiteLLM_SpendLogs` aggregations onto the database, and show Failed to load on the Spend Per User card when the request fails - [PR #49922](https://github.com/BerriAI/litellm/pull/49922)
- Cancel the Admin UI's raw `LiteLLM_SpendLogs` reads in Postgres after 30s, so a page that timed out no longer leaves its scan or aggregation running on the database - [PR #49965](https://github.com/BerriAI/litellm/pull/49965)
- Add Model deprecations alerts under Observability and Alerts in the Admin UI, with daily requests stacked by key so admins can see which keys still need to migrate - [PR #50022](https://github.com/BerriAI/litellm/pull/50022)

### Proxy configuration

- Add a `general_settings.fips_mode` startup gate so the proxy refuses to start on non-FIPS crypto, replacing the MD5 probe that passed on non-FIPS OpenSSL - [PR #48600](https://github.com/BerriAI/litellm/pull/48600)
- Ignore stored `general_settings` keys that no settings API manages, fixing Claude Code 401s from a stale `enforce_user_param` left by an old UI save since v1.103.0 - [PR #48967](https://github.com/BerriAI/litellm/pull/48967)
- Preserve DB-stored general settings during config reload, so a stored download cap of 2 per minute no longer lets a third download through - [PR #49735](https://github.com/BerriAI/litellm/pull/49735)
- Let a license in `general_settings.litellm_license` unlock enterprise settings such as `allowed_ips`, `enforced_params` and `hide_secrets`, keep a valid `LITELLM_LICENSE` active when the config license is invalid, and fix the environment typo in license errors - [PR #49745](https://github.com/BerriAI/litellm/pull/49745)
- Authenticate billing metrics to the telemetry collector with a Cognito bearer token that the proxy fetches and refreshes - [PR #49852](https://github.com/BerriAI/litellm/pull/49852)
- Add `MAX_REQUEST_HEADER_SIZE` and `--max_request_header_size` to raise the h11 request header buffer, avoiding intermittent HTTP 400 responses when a gateway adds large identity headers - [PR #49883](https://github.com/BerriAI/litellm/pull/49883)
- Fix `fips_mode: true` refusing to boot on a FIPS image whose default config keeps MD5 working, by probing scrypt instead of MD5 in the OpenSSL check - [PR #50305](https://github.com/BerriAI/litellm/pull/50305)
- Hold `DB_RECONCILE_LOCK` around credential create, update and delete, so a concurrent config reload stops undoing them in memory - [PR #50551](https://github.com/BerriAI/litellm/pull/50551)

### CLI and coding agents

- Give Codex accurate `/v1/models` entries for Claude, Gemini and Bedrock-hosted GPT models, and show the Fast tier only when every deployment behind a model has a priority price - [PR #49825](https://github.com/BerriAI/litellm/pull/49825)
- Fix `lite logout` so it removes the local `token.json` login even when the OS keychain cannot be checked, and `lite whoami` no longer reports a signed-in state - [PR #50098](https://github.com/BerriAI/litellm/pull/50098)
- Serve Codex the model catalog of its own release on `/v1/models`, fetched from GitHub, and fall back to the current behavior when GitHub is unreachable or offline mode is on - [PR #50318](https://github.com/BerriAI/litellm/pull/50318)

### Terraform

- Drop a `litellm_key` deleted outside Terraform from state and treat its 404 on delete as gone, so `terraform destroy` no longer fails with `No keys found` - [PR #47877](https://github.com/BerriAI/litellm/pull/47877)
- Fix `/tag/update` returning 500 when the body carries the tag's own `budget_id`, which made every budgeted tag update from the Terraform `litellm_tag` resource fail - [PR #50324](https://github.com/BerriAI/litellm/pull/50324)

## AI Integrations

### Guardrails

- Check tools sent to `/v1/messages` and `/v1/responses` in `tool_permission` pre_call, so deny rules now fire on Anthropic and Responses request tools - [PR #41011](https://github.com/BerriAI/litellm/pull/41011)
- Run realtime guardrails on Nova Sonic sessions for typed text, tool outputs and speech, forward masked text, and honor key and team guardrail opt-outs on both realtime paths - [PR #49833](https://github.com/BerriAI/litellm/pull/49833)
- Apply masking guardrails to Bedrock InvokeModel requests and replies for Claude, matching the native `/v1/messages` route, so raw card numbers no longer reach Bedrock and replies come back masked - [PR #49947](https://github.com/BerriAI/litellm/pull/49947)
- Scan only the last user turn on requests with Zscaler AI Guard, so system prompts and old turns no longer trigger blocks and scan size stops growing with the conversation - [PR #50139](https://github.com/BerriAI/litellm/pull/50139)
- Add prebuilt content filter credential patterns for OpenAI, Anthropic and Gemini API keys, alongside the existing AWS, GitHub and Slack patterns - [PR #50268](https://github.com/BerriAI/litellm/pull/50268)
- Stop model-level `post_call` guardrails from running twice per proxy response, which doubled moderation provider calls and latency and logged two evaluations per guardrail - [PR #50300](https://github.com/BerriAI/litellm/pull/50300)

### Logging and observability

- Keep reasoning, citations and search results out of stored logs when redaction is on, by also redacting `provider_specific_fields` - [PR #47398](https://github.com/BerriAI/litellm/pull/47398)
- Keep the caller's `call_type` in logs when chat completions, text completions and `/v1/messages` calls are bridged to the Responses API, instead of logging them as `responses` - [PR #49710](https://github.com/BerriAI/litellm/pull/49710)
- Keep the deployment id on Prometheus failure metrics for proxy failures such as a pre-call guardrail 400, instead of reporting a `None` `model_id` - [PR #49717](https://github.com/BerriAI/litellm/pull/49717)
- Fix team- or key-level OpenTelemetry v2 destinations such as New Relic missing allowlisted `litellm.metadata.*` request metadata when no proxy-wide `otel` callback is listed - [PR #50373](https://github.com/BerriAI/litellm/pull/50373)
- Name the model the auto router picked on OTel LLM spans in `gen_ai.request.model` and `gen_ai.response.model`, instead of the router name - [PR #50498](https://github.com/BerriAI/litellm/pull/50498)

## Spend Tracking, Budgets and Rate Limiting

### Cost tracking

- Omit the `x-litellm-response-cost` header for unpriced responses, so callers can tell a free model apart from one with no price - [PR #49467](https://github.com/BerriAI/litellm/pull/49467)
- Stop one call's custom price from rewriting `litellm.model_cost` for every other request, by carrying the full per-call price entry on the logging object - [PR #49532](https://github.com/BerriAI/litellm/pull/49532)
- Bill web search interception follow-ups once under the outer request, so intercepted Responses streams write one success spend row and chat and Responses key spend stops counting the follow-up twice - [PR #49762](https://github.com/BerriAI/litellm/pull/49762)
- Bill Batch cached tokens at the Standard cache price when a row has no Batch cache price, so `vertex_ai` Gemini Batch cached audio no longer costs more than Standard - [PR #50062](https://github.com/BerriAI/litellm/pull/50062)
- Keep data residency, regional and speed multipliers for per-call custom prices, and show the billed per-call entry instead of catalog rates in the standard logging payload - [PR #50063](https://github.com/BerriAI/litellm/pull/50063)
- Fix spend commits failing on `litellm[proxy]` installs without `prometheus-client`, which affected keys, teams and users with the ledger on or off - [PR #50230](https://github.com/BerriAI/litellm/pull/50230)
- Keep spend for native Responses streams when a guardrail rejects the response, instead of logging a failure with no spend record - [PR #50286](https://github.com/BerriAI/litellm/pull/50286)
- Bill xAI image calls from the billed `usage.cost_in_usd_ticks` and add 1K and 2K resolution prices for `grok-imagine-image-2.0`, so 2K generations stop logging at the 1K price - [PR #50481](https://github.com/BerriAI/litellm/pull/50481)
- Honor a deployment's `input_cost_per_pixel` when costing xAI image calls, instead of letting billed ticks or resolution prices override it - [PR #50490](https://github.com/BerriAI/litellm/pull/50490)

### Spend logs and daily rollups

- Read only the newest rows when paging sessions, so each session page no longer groups the whole date window twice and status filters stop recomputing outcomes - [PR #48886](https://github.com/BerriAI/litellm/pull/48886)
- Add an opt-in `latest_turn` mode for `store_prompts_in_spend_logs` that stores only the current turn of stateless requests, so spend log storage stops growing with the square of the turn count - [PR #49544](https://github.com/BerriAI/litellm/pull/49544)
- Log each endpoint's own call type on failed audio, transcription, moderation, image generation and rerank spend rows, instead of an empty value or `IGNORE_THIS` on rejections like a 429 - [PR #49684](https://github.com/BerriAI/litellm/pull/49684)
- Remove the unused experimental accounting-event settings and their generated API types, and replace the capture scaffolding with a SpendLogs projection - [PR #49843](https://github.com/BerriAI/litellm/pull/49843)
- Add an opt-in SpendLogs ledger so rollup totals stay in step across spend queues and accounting no longer depends on local request logs existing - [PR #49856](https://github.com/BerriAI/litellm/pull/49856)
- Charge spend through the `LiteLLM_SpendLogDelivery` ledger by default, and fix undecodable deliveries blocking later charges, deadlocks with team roster changes and model renames, and full rows being queued when logging is off - [PR #49872](https://github.com/BerriAI/litellm/pull/49872)
- Let admins turn off prompt storage in spend logs per key or per team, instead of only globally - [PR #50135](https://github.com/BerriAI/litellm/pull/50135)
- Stop usage routes from returning 500 when the database drops during key, user, guardrail, team, organization, customer or agent detail lookups - [PR #50253](https://github.com/BerriAI/litellm/pull/50253)
- Stop spend flushes from scanning every retained delivery receipt for metrics, and stop storage and delay alerts from re-firing on every flush - [PR #50565](https://github.com/BerriAI/litellm/pull/50565)

### Budgets

- Charge budget windows when the cached key or team expired before the request ended, so keys and teams no longer run past their caps on long requests - [PR #47608](https://github.com/BerriAI/litellm/pull/47608)
- Let admins reset a tag's spend through `/tag/update` before its budget window ends, so a budget-blocked tag can be unblocked - [PR #50323](https://github.com/BerriAI/litellm/pull/50323)
- Label every budget reset time in the Admin UI with UTC, so US viewers no longer see a monthly window shifted a day early - [PR #50591](https://github.com/BerriAI/litellm/pull/50591)

### Rate limiting

- Estimate embedding image and audio data URIs as media in TPM pre-call checks, so image embeddings under a token limit stop returning 429 - [PR #49831](https://github.com/BerriAI/litellm/pull/49831)

## MCP Gateway

### Auth and OAuth

- Answer bare `OPTIONS` requests on MCP routes without running LiteLLM auth, so clients that probe with `OPTIONS` stop getting a 401 and looping on re-auth - [PR #49497](https://github.com/BerriAI/litellm/pull/49497)
- Derive MCP session sign-in and bridge token signing keys with the FIPS provider's KBKDF, so `fips_mode` no longer makes them return 500 because FIPS OpenSSL 3 refuses scrypt - [PR #50032](https://github.com/BerriAI/litellm/pull/50032)

### Rate limits and guardrails

- Add `mcp_block_behavior` to guardrails so an MCP tool block returns HTTP 400 instead of 200, letting clients that check status codes see the block - [PR #50284](https://github.com/BerriAI/litellm/pull/50284)

### Protocol and catalog

- Add an opt-in per-server setting to skip MCP tool output validation, so a stateless tool call stops re-downloading the upstream's whole tool list - [PR #49961](https://github.com/BerriAI/litellm/pull/49961)

## Performance / Loadbalancing / Reliability improvements

### Auto Router and model routing

- Reserve the deployment `least-busy` picks as soon as it is chosen, so a burst of concurrent requests spreads across deployments instead of piling onto one - [PR #47484](https://github.com/BerriAI/litellm/pull/47484)
- Scope context fallback precedence to the requested group, so a context error advances ordered deployments when no context rule matches and unrelated context rules stop disabling generic recovery - [PR #49779](https://github.com/BerriAI/litellm/pull/49779)
- Fix weighted failover so every endpoint re-picks within the group after a failure, and so a request with its own `api_key` or `api_base` no longer re-picks the failed deployment - [PR #49941](https://github.com/BerriAI/litellm/pull/49941)
- Keep a deployment's `max_input_tokens` override off the shared backend cost map key, so plain deployments of the same model stop showing a sibling's token limits - [PR #49952](https://github.com/BerriAI/litellm/pull/49952)
- Delete the Python router core so `Router` always runs on the Rust core, and remove the router rollout rule and the `LITELLM_RUST` choice for the router - [PR #50178](https://github.com/BerriAI/litellm/pull/50178)
- Honor a request's own `fallbacks` in the mid-stream continuation check, so a request fallback carrying its own `messages` no longer gets the old prefix spliced on - [PR #50260](https://github.com/BerriAI/litellm/pull/50260)
- Stop a 404 from a response id lookup from putting the deployment in cooldown, so a missing response no longer takes a healthy deployment out of service - [PR #50262](https://github.com/BerriAI/litellm/pull/50262)
- Keep the request's metadata on fallback hops so Prometheus fallback counters keep the caller's key and team labels instead of `None` - [PR #50263](https://github.com/BerriAI/litellm/pull/50263)
- Fix a team key asking for a bare model name such as `gpt-4o-mini` getting a 400 when the team only has a provider wildcard like `openai/*` - [PR #50264](https://github.com/BerriAI/litellm/pull/50264)
- Share the priority scheduler queue through the router's Redis cache, so priority order holds across workers and instances when Redis is configured - [PR #50265](https://github.com/BerriAI/litellm/pull/50265)
- Drop `supports_web_search: false` deployments when a request uses Anthropic `web_search_*` or Gemini `googleSearch` and `google_search` tools, not only OpenAI web search types - [PR #50275](https://github.com/BerriAI/litellm/pull/50275)
- Add the Switchyard stage router as an auto router strategy that reads tool results to tell when an agent turn is hard, so trivial turns stop paying frontier prices, and list every strategy up front in the Add Auto Router form - [PR #50407](https://github.com/BerriAI/litellm/pull/50407)
- Count retries and fallback hops toward `allowed_fails`, cooldown and rpm at the proxy, so a deployment that keeps returning 429 cools down as it does through the Router SDK - [PR #50445](https://github.com/BerriAI/litellm/pull/50445)
- Release a cancelled or retried request's ITPM/OTPM reservation and least-busy in-flight count right away, and stop refunding one reservation twice - [PR #50486](https://github.com/BerriAI/litellm/pull/50486)
- Cut per-request router CPU by skipping unused deployment reads in the callback filter step and caching Anthropic capability lookups on the Rust `/v1/messages` route - [PR #50641](https://github.com/BerriAI/litellm/pull/50641)
- Honor a request's own `fallbacks` in the mid-stream continuation check so a fallback that brings its own messages is no longer stitched onto the cut stream - [PR #50798](https://github.com/BerriAI/litellm/pull/50798)
- Fix router reads racing deployment upserts on other threads, which could fail a request with `IndexError` or return the neighbouring model's deployments after a removal - [PR #50933](https://github.com/BerriAI/litellm/pull/50933)
- Fix router reads racing deployment upserts on other threads, which failed requests with `IndexError: list index out of range` after the provider had already answered - [PR #50993](https://github.com/BerriAI/litellm/pull/50993)

### Caching, database and runtime

- Align native AWS, GCP and Azure credential loading and expiry with the Python SDKs, so cached AWS credentials expire on time and assumed roles stop calling STS on every request - [PR #49589](https://github.com/BerriAI/litellm/pull/49589)
- Add a `gateway-forward` reverse proxy to the Rust gateway that forwards HTTP and WebSocket requests to the Python proxy and accepts responses with more than 100 headers - [PR #49604](https://github.com/BerriAI/litellm/pull/49604)
- Defer the optional Prisma import in SSO settings, so the proxy starts on installations without database extras - [PR #49771](https://github.com/BerriAI/litellm/pull/49771)
- Drop the unused `LiteLLM_AccountingEvent` and `LiteLLM_AccountingDelivery` tables and fix Prisma drift reports on the SpendLogs delivery id default - [PR #49923](https://github.com/BerriAI/litellm/pull/49923)
- Remove the experimental Redis cache stack and the V2 cache API, including the V2 cache imports and native memory and Redis cache handles - [PR #50005](https://github.com/BerriAI/litellm/pull/50005)
- Stop caching and replaying replies that have no output, so empty Gemini replies on `/v1/messages` and `/v1/chat/completions` are no longer served to every repeat request - [PR #50057](https://github.com/BerriAI/litellm/pull/50057)
- Treat Postgres restart and shutdown errors (`57P03`) as the database being unavailable, so spend logs, usage rollups and tool discovery rows are kept and valid keys no longer get a 401 - [PR #50132](https://github.com/BerriAI/litellm/pull/50132)
- Serve the proxy's common Redis calls with Rust stores instead of a separate redis-py path for each Redis family - [PR #50170](https://github.com/BerriAI/litellm/pull/50170)
- Free each request's Redis batch scope when the request ends, which stops about 40 KiB of worker memory growth per request and the slowdown and pod evictions that followed on proxies using Redis - [PR #50751](https://github.com/BerriAI/litellm/pull/50751)
- Free each request's Redis batch scope when the request ends, which stops about 40 KiB of worker memory growth per request and the slowdown and pod evictions that followed on proxies using Redis - [PR #50949](https://github.com/BerriAI/litellm/pull/50949)

### Docker and Helm

- Build `litellm-proxy` gateway platform wheels and bake them into the Docker images, while `litellm[proxy]` stays unchanged for pip users - [PR #49605](https://github.com/BerriAI/litellm/pull/49605)

### Dependency updates

- Allow `huggingface-hub` 2.x so LiteLLM can be installed next to packages that need it, and use Xet for hub file downloads from hub 2.1 - [PR #49056](https://github.com/BerriAI/litellm/pull/49056)
- Bump `oauthlib` to 4.0.1 and pin `filelock` per Python version to clear the red osv-scan - [PR #49204](https://github.com/BerriAI/litellm/pull/49204)
- Bump `@azure/msal-node` to 7.x in the VS Code extension so the OSV scan stays green after the suppression expires - [PR #50198](https://github.com/BerriAI/litellm/pull/50198)

## Documentation Updates

- Document that agents updating a PR summary preserve the author's reviewed wording and keep draft tags only on newly written text - [PR #49803](https://github.com/BerriAI/litellm/pull/49803)

## Tests, CI and Internal Changes

- Clean up tech debt in proxy auth reads, ChatGPT credential forwarding, messages drop_params reads and spend log reads - [PR #46643](https://github.com/BerriAI/litellm/pull/46643)
- Share the coding-CLI e2e harness between suites so a Codex suite can reuse the Claude Code helpers - [PR #49370](https://github.com/BerriAI/litellm/pull/49370)
- Add an e2e suite that runs the Codex CLI through LiteLLM and checks a command round trip on five deployments - [PR #49374](https://github.com/BerriAI/litellm/pull/49374)
- Add Codex e2e tests for file edit, long session and auto-compaction through LiteLLM on five deployments - [PR #49386](https://github.com/BerriAI/litellm/pull/49386)
- Move MCP Servers, MCP OAuth callback and shared MCP picker text onto i18n keys - [PR #49473](https://github.com/BerriAI/litellm/pull/49473)
- Move Teams, Users and Organizations page text onto i18n keys - [PR #49484](https://github.com/BerriAI/litellm/pull/49484)
- Add the Rust router core and its PythonHost bridge with the host call-out as the only boundary - [PR #49513](https://github.com/BerriAI/litellm/pull/49513)
- Isolate the stranger batch authorization integration test from the batch-cost poller on a private proxy - [PR #49522](https://github.com/BerriAI/litellm/pull/49522)
- Move Guardrails page text and the garden catalog onto i18n keys - [PR #49524](https://github.com/BerriAI/litellm/pull/49524)
- Fix four integration tests that failed intermittently without any product code cause - [PR #49554](https://github.com/BerriAI/litellm/pull/49554)
- Add a Rust vs Python `/v1/messages` parity characterization test suite - [PR #49610](https://github.com/BerriAI/litellm/pull/49610)
- Make the Rust `/v1/messages` path copy Python behavior wherever Rust serves the call - [PR #49611](https://github.com/BerriAI/litellm/pull/49611)
- Declare the tool and Responses token count framing keys in the model catalog so the cost map guard stops failing - [PR #49683](https://github.com/BerriAI/litellm/pull/49683)
- Repair stale integration contract fixtures so scheduled runs reach their remaining assertions - [PR #49700](https://github.com/BerriAI/litellm/pull/49700)
- Align remaining release qualification integration checks and let offline builds resolve cached dependencies - [PR #49714](https://github.com/BerriAI/litellm/pull/49714)
- Repair agent detail reads and bulk deletion setup in the integration tests - [PR #49719](https://github.com/BerriAI/litellm/pull/49719)
- Declare the `thinking_on_by_default` key in the model catalog so the cost map guard stops failing - [PR #49720](https://github.com/BerriAI/litellm/pull/49720)
- Remove the `weekly_load_anomaly.yml` and `deploy-dev-on-main.yml` workflows whose secrets are dead - [PR #49722](https://github.com/BerriAI/litellm/pull/49722)
- Assert Vertex lists on content chunks in the Gemini streaming test - [PR #49734](https://github.com/BerriAI/litellm/pull/49734)
- Repair release qualification test timing and deployment label checks - [PR #49737](https://github.com/BerriAI/litellm/pull/49737)
- Look up streamed Responses spend rows by the client-facing id in provider integration tests - [PR #49752](https://github.com/BerriAI/litellm/pull/49752)
- Budget proxy restart integration tests from a calibrated boot time to stop 180s timeouts - [PR #49761](https://github.com/BerriAI/litellm/pull/49761)
- Restore main E2E qualification across providers and UI, and use the regional STS endpoint for role identity checks - [PR #49763](https://github.com/BerriAI/litellm/pull/49763)
- Read `successor_model` in the model catalog so `check-registry` accepts it on deprecating rows - [PR #49791](https://github.com/BerriAI/litellm/pull/49791)
- Assert native structured output in the Bedrock test for models that reject forced tools - [PR #49799](https://github.com/BerriAI/litellm/pull/49799)
- Expect the Anthropic budget envelope on a broken Messages stream in the spend test - [PR #49800](https://github.com/BerriAI/litellm/pull/49800)
- Add a Codex e2e test that calls a local MCP tool on a first and a resumed turn - [PR #49817](https://github.com/BerriAI/litellm/pull/49817)
- Revert the AWS STS identity check change from PR #49763, which only addressed a test infrastructure issue - [PR #49939](https://github.com/BerriAI/litellm/pull/49939)
- Hold the MCP progress test's upstream notification acks until dispatched to stop a random failure on main - [PR #49967](https://github.com/BerriAI/litellm/pull/49967)
- Retire the e2e quiet_stack lock and batch the claude_code model registration to cut idle worker time - [PR #49984](https://github.com/BerriAI/litellm/pull/49984)
- Clear about 1,100 basedpyright Any errors across 303 files by typing payloads and kwargs - [PR #49986](https://github.com/BerriAI/litellm/pull/49986)
- Run the OSV dependency scan on PRs into rc branches - [PR #49987](https://github.com/BerriAI/litellm/pull/49987)
- Move Playground, Chat and Moyai page text onto i18n with no change to the English shown - [PR #49991](https://github.com/BerriAI/litellm/pull/49991)
- Move Logs, Usage and Telemetry page text onto i18n with no change to the English shown - [PR #49992](https://github.com/BerriAI/litellm/pull/49992)
- Move Keys, Projects, Cost and Budgets page text onto i18n with no change to the English shown - [PR #49994](https://github.com/BerriAI/litellm/pull/49994)
- Give the session pages EXPLAIN test double a `read_db` transaction so the scheduled integration run passes again - [PR #49996](https://github.com/BerriAI/litellm/pull/49996)
- Keep the background status poller out of the Responses cancel wire test so it stops seeing an extra status GET - [PR #50002](https://github.com/BerriAI/litellm/pull/50002)
- Use neutral example names `service` and `app:` in the baggage tag mapping editor placeholders and tests - [PR #50011](https://github.com/BerriAI/litellm/pull/50011)
- Poll for the cached JWT rejection sentinel instead of a single Redis read to fix a flaky integration test - [PR #50014](https://github.com/BerriAI/litellm/pull/50014)
- Remove the retired `database_upgrade_5rps` e2e case and its harness tests - [PR #50076](https://github.com/BerriAI/litellm/pull/50076)
- Run the OSV scan and unit tests on PRs into `stable/**`, `rc/**` and `lts/**` branches - [PR #50086](https://github.com/BerriAI/litellm/pull/50086)
- Keep the observability outage test's sink port reserved for the whole outage so an unrelated listener cannot break it - [PR #50100](https://github.com/BerriAI/litellm/pull/50100)
- Make three flaky unit tests deterministic so clock timing no longer fails them on main - [PR #50114](https://github.com/BerriAI/litellm/pull/50114)
- Drop a skills archive rejection test whose zip-byte parametrize ids differed across xdist workers - [PR #50118](https://github.com/BerriAI/litellm/pull/50118)
- Stop the full history clone on the db-and-spend unit shard and fetch the schema merge base by sha - [PR #50120](https://github.com/BerriAI/litellm/pull/50120)
- Expect 503 `server_is_overloaded` for an upstream 529 in the Anthropic tool search result matrix test - [PR #50154](https://github.com/BerriAI/litellm/pull/50154)
- Expect 503 `server_is_overloaded` for an overloaded first turn in the prompt cache pin TTL test - [PR #50155](https://github.com/BerriAI/litellm/pull/50155)
- Expect 503 `server_is_overloaded` for an upstream overload on the responses bridge cache control test - [PR #50166](https://github.com/BerriAI/litellm/pull/50166)
- Add the Rust Redis foundation with no runtime change, including a subscription acknowledgement timeout - [PR #50169](https://github.com/BerriAI/litellm/pull/50169)
- Expect thinking usage fields in the Bedrock chat translation test for Sonnet 5 - [PR #50175](https://github.com/BerriAI/litellm/pull/50175)
- Expect thinking usage fields in the Bedrock messages translation test for Sonnet 5 - [PR #50179](https://github.com/BerriAI/litellm/pull/50179)
- Expect thinking usage fields in the Bedrock responses translation test for Sonnet 5 - [PR #50181](https://github.com/BerriAI/litellm/pull/50181)
- Drop the make-me-human-readable tags from the PR template's handwritten description - [PR #50183](https://github.com/BerriAI/litellm/pull/50183)
- Drop a redundant `$defs` deep copy in Bedrock tool conversion - [PR #50240](https://github.com/BerriAI/litellm/pull/50240)
- Move JSON schema helpers out of `common_utils` into `json_schema_utils` - [PR #50241](https://github.com/BerriAI/litellm/pull/50241)
- Update daily activity integration tests to expect per-user entity spend rows and email and alias metadata - [PR #50251](https://github.com/BerriAI/litellm/pull/50251)
- Update Claude Code plugin preference tests for patch bumps on versionless updates and 409 on conflicting writes - [PR #50252](https://github.com/BerriAI/litellm/pull/50252)
- Require rerunnable setup and collapsed long output in the PR template proof section - [PR #50258](https://github.com/BerriAI/litellm/pull/50258)
- Align router wire tests with the strict `is True` check for `include_fallback_errors` - [PR #50259](https://github.com/BerriAI/litellm/pull/50259)
- Expect a primary stream's stall to cool its deployment in the hosted vLLM stream stall wire test - [PR #50261](https://github.com/BerriAI/litellm/pull/50261)
- Let type checkers see the real `Router` constructor arguments so `make check` stops failing on valid calls - [PR #50278](https://github.com/BerriAI/litellm/pull/50278)
- Align Copilot login-guard test fixtures with direct access tokens instead of the removed token exchange - [PR #50285](https://github.com/BerriAI/litellm/pull/50285)
- Read access-window, default-fallback and pick timing through the router core's injected clock - [PR #50295](https://github.com/BerriAI/litellm/pull/50295)
- Seed direct access tokens in Copilot wire test fixtures instead of the obsolete exchange credential - [PR #50307](https://github.com/BerriAI/litellm/pull/50307)
- Expect native output on Bedrock Opus 4.8 profiles in tests now that the JSON tool is retired - [PR #50343](https://github.com/BerriAI/litellm/pull/50343)
- Expect the generic unsupported-parameter 400 for temperature on fixed-sampling Claude in Bedrock Mantle tests - [PR #50344](https://github.com/BerriAI/litellm/pull/50344)
- Wait for saved MCP credentials before deleting the server in the browser integration test - [PR #50366](https://github.com/BerriAI/litellm/pull/50366)
- Keep the osv-scan suppressions for the oldest supported Python until 2027-02-01 so expiring entries stop turning the scan red - [PR #50386](https://github.com/BerriAI/litellm/pull/50386)
- Sync Azure GPT flex price fields for gpt-6-astra, gpt-6-luna and gpt-6.1-sol in the test suite rows - [PR #50410](https://github.com/BerriAI/litellm/pull/50410)
- Make Rust router events serializable so a host can log or forward them as JSON instead of parsing Debug text - [PR #50416](https://github.com/BerriAI/litellm/pull/50416)
- Fix the TTL-preserving token increment test to drive the native counter increments instead of a private attribute - [PR #50418](https://github.com/BerriAI/litellm/pull/50418)
- Remove the paragraph-ending period restriction from the agent writing rules - [PR #50419](https://github.com/BerriAI/litellm/pull/50419)
- Bump litellm to 1.110.0, litellm-enterprise to 0.1.83 and litellm-proxy-extras to 0.4.114 - [PR #50437](https://github.com/BerriAI/litellm/pull/50437)
- Update five UI e2e specs to follow the Aria sidebar move and the Skills Hub rename so scheduled litellm-e2e goes green - [PR #50453](https://github.com/BerriAI/litellm/pull/50453)
- Share one circuit breaker between `RedisCache` and the Rust Redis stores so a wedged Redis stops stalling `reset_spend` - [PR #50473](https://github.com/BerriAI/litellm/pull/50473)
- Update the routing tests to expect `/v1/responses` to pin the served deployment for an hour - [PR #50474](https://github.com/BerriAI/litellm/pull/50474)
- Add a Codex e2e row where a sub-agent must read the task its parent hands it - [PR #50494](https://github.com/BerriAI/litellm/pull/50494)
- Declare each lazy `litellm` attribute once and resolve them all through a single function - [PR #50523](https://github.com/BerriAI/litellm/pull/50523)
- Read lazy attributes with `getattr` instead of a one-off TypedDict wrapper - [PR #50543](https://github.com/BerriAI/litellm/pull/50543)
- Delete 28 dead skipped tests from `test_key_generate_prisma.py` that never run anywhere - [PR #50550](https://github.com/BerriAI/litellm/pull/50550)
- Move 283 hardcoded English strings in dashboard JSX onto i18n - [PR #50575](https://github.com/BerriAI/litellm/pull/50575)
- Update two messages translation tests to expect redacted thinking blocks on Azure and Bedrock Mantle - [PR #50576](https://github.com/BerriAI/litellm/pull/50576)
- Match the full card number in masking tests instead of a 4111 substring that timestamps can contain - [PR #50612](https://github.com/BerriAI/litellm/pull/50612)
- Make the held statement relay in integration tests follow cached prepared statements so the config reload test stops failing - [PR #50651](https://github.com/BerriAI/litellm/pull/50651)
- Update an integration test to expect response ids to stay scoped to the key that minted them - [PR #50703](https://github.com/BerriAI/litellm/pull/50703)
- Update stale integration test expectations and repin the Together reasoning replay e2e test to a model that is still served - [PR #50756](https://github.com/BerriAI/litellm/pull/50756)
- Drop the empty-string n case from the Gemini long decode integration test because Google rejects it with a 400 - [PR #50794](https://github.com/BerriAI/litellm/pull/50794)
- Update integration and e2e spend tests that still expected the old accounting queues now that the SpendLogs ledger is the default - [PR #50805](https://github.com/BerriAI/litellm/pull/50805)
- Ignore Ollama model-info calls in the Decisions integration test decoy check so it no longer fails depending on test order - [PR #50827](https://github.com/BerriAI/litellm/pull/50827)
- Repair four integration tests, including the Redis client cache eviction case and the detached worktree native extension case under `env -i` - [PR #50855](https://github.com/BerriAI/litellm/pull/50855)

### PR roll-up by ownership area

PRs by ownership area (total: 372)

- Models & Providers: 105
- Other: 90
- UI: 40
- LLM API Endpoints: 34
- Auth & Management: 33
- Performance: 32
- Spend / Budgets / Rate Limits: 22
- Guardrails: 6
- Logging: 5
- MCP: 4
- Docs: 1

## New Contributors

- [@adityabatra072](https://github.com/adityabatra072) made their first contribution in [PR #45662](https://github.com/BerriAI/litellm/pull/45662)
- [@alchemicjon](https://github.com/alchemicjon) made their first contribution in [PR #47398](https://github.com/BerriAI/litellm/pull/47398)
- [@alekc](https://github.com/alekc) made their first contribution in [PR #38086](https://github.com/BerriAI/litellm/pull/38086)
- [@apex-mochen](https://github.com/apex-mochen) made their first contribution in [PR #43577](https://github.com/BerriAI/litellm/pull/43577)
- [@chuckiihub](https://github.com/chuckiihub) made their first contribution in [PR #49851](https://github.com/BerriAI/litellm/pull/49851)
- [@davanstrien](https://github.com/davanstrien) made their first contribution in [PR #49056](https://github.com/BerriAI/litellm/pull/49056)
- [@devin-gupta](https://github.com/devin-gupta) made their first contribution in [PR #49188](https://github.com/BerriAI/litellm/pull/49188)
- [@HootRock](https://github.com/HootRock) made their first contribution in [PR #47980](https://github.com/BerriAI/litellm/pull/47980)
- [@Hugo-DDT](https://github.com/Hugo-DDT) made their first contribution in [PR #49076](https://github.com/BerriAI/litellm/pull/49076)
- [@JeongCheolLee](https://github.com/JeongCheolLee) made their first contribution in [PR #48385](https://github.com/BerriAI/litellm/pull/48385)
- [@julienparenti](https://github.com/julienparenti) made their first contribution in [PR #50255](https://github.com/BerriAI/litellm/pull/50255)
- [@kaust1495](https://github.com/kaust1495) made their first contribution in [PR #44944](https://github.com/BerriAI/litellm/pull/44944)
- [@meryemsakin](https://github.com/meryemsakin) made their first contribution in [PR #41011](https://github.com/BerriAI/litellm/pull/41011)
- [@MukeshK17](https://github.com/MukeshK17) made their first contribution in [PR #50244](https://github.com/BerriAI/litellm/pull/50244)
- [@pasqualtroncone](https://github.com/pasqualtroncone) made their first contribution in [PR #39737](https://github.com/BerriAI/litellm/pull/39737)
- [@PrabalParihar](https://github.com/PrabalParihar) made their first contribution in [PR #48393](https://github.com/BerriAI/litellm/pull/48393)
- [@PyExtreme](https://github.com/PyExtreme) made their first contribution in [PR #50057](https://github.com/BerriAI/litellm/pull/50057)
- [@qibinjin](https://github.com/qibinjin) made their first contribution in [PR #50046](https://github.com/BerriAI/litellm/pull/50046)
- [@qtim0](https://github.com/qtim0) made their first contribution in [PR #50137](https://github.com/BerriAI/litellm/pull/50137)
- [@sidsri14](https://github.com/sidsri14) made their first contribution in [PR #50073](https://github.com/BerriAI/litellm/pull/50073)
- [@tc3oliver](https://github.com/tc3oliver) made their first contribution in [PR #47484](https://github.com/BerriAI/litellm/pull/47484)
- [@thinhnx128](https://github.com/thinhnx128) made their first contribution in [PR #50538](https://github.com/BerriAI/litellm/pull/50538)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.109.0-rc.1...v1.110.0-rc.1
