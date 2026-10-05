---
title: "1.105.0rc1 - Claude Sonnet 5.5, GPT-6.1 Sol, litellm.agent(), Lens & Agent Traces"
slug: "v1-105-0-rc-1"
date: 2026-10-03T16:48:15
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
docker.litellm.ai/berriai/litellm:1.105.0-rc.1
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.105.0rc1
```

</TabItem>
</Tabs>

The published GitHub tag is `v1.105.0-rc.1`. These notes compare it with `v1.104.0-rc.1`, the previous release candidate cut from `main`. Changes backported onto `rc/1.104.0` and already shipped in `v1.104.0` are omitted

Customer-facing changes come first. Test, CI and internal changes are listed at the bottom

:::danger[Breaking Changes]

These callouts cover user-facing behavior that differs from `v1.104.0`, the latest stable release

**The proxy no longer starts when it cannot reach its database or apply its migrations**, so a new version never serves traffic against an outdated schema. During a rolling update the new pods stay down and the old pods keep serving. This became the default in `v1.104.0`, and it can no longer be turned off: `ENFORCE_PRISMA_MIGRATION_CHECK=false` is now ignored. See [PR #44141](https://github.com/BerriAI/litellm/pull/44141)

**Bedrock GPT-5.6, GPT-6 and GPT-6.1 move from Converse to native Chat Completions**, so response ids, `service_tier` and reasoning fields change shape. Use `bedrock/converse/<model>` to stay on Converse. See [PR #44307](https://github.com/BerriAI/litellm/pull/44307)

**`/sso/debug/*` returns 404 unless `ENABLE_SSO_DEBUG=true`.** See [PR #43150](https://github.com/BerriAI/litellm/pull/43150)

:::

:::warning Upgrading from `v1.104.0`

The `LiteLLM_SpendLogs` indexes are now built online after `prisma migrate deploy`: the migration job waits for them and fails if one is still missing, and a proxy that runs its own migrations builds them in the background after boot. Indexes you already built by hand from the `v1.104.0` notes are reused, not rebuilt. See [PR #43948](https://github.com/BerriAI/litellm/pull/43948), [PR #44203](https://github.com/BerriAI/litellm/pull/44203)

:::

## Key Highlights

- **New models on day one**: Claude Sonnet 5.5 across Anthropic, Bedrock, Bedrock Mantle, Vertex AI, Azure AI, OpenRouter and Perplexity, GPT-6.1 Sol across OpenAI, Azure, Bedrock and OpenRouter, and Grok 4.7 on Bedrock and Vertex AI, among 78 new catalog entries
- **New providers and routes**: Prism, Sail and Cortecs providers, native xAI batches and files, Fireworks router models, and Bedrock GPT-5.6+ served on native Chat Completions
- **`litellm.agent()`**: run Claude Code, Codex, OpenCode and Deep Agents through the AI gateway from the SDK
- **Lens and Agent Traces**: OTLP trace ingestion stored in ClickHouse with matched spend, scoped SQL over traces, a chat-style run view, and Lens (Beta) investigations run by a separate worker
- **Agent identities**: register agents with Entra ID identities, authenticate delegated requests and enforce authoritative agent permissions
- **Faster proxy at scale**: one request-scoped Redis pipeline for auth, spend, rate-limit and routing reads, gzip for buffered responses, and usage pages that page keys from the server instead of loading every key into the browser

## New Providers and Endpoints

### New Providers (3 new providers)

| Provider | Supported LiteLLM Endpoints | Description |
| --- | --- | --- |
| [Prism](../../docs/providers/prism) | `/v1/chat/completions`, `/v1/responses`, `/v1/messages` | Prism inference as an OpenAI-compatible provider, with DeepSeek V4 Flash and V4.1 Flash in the catalog |
| Sail | `/v1/chat/completions`, `/v1/responses`, `/v1/messages` | 12 Sail models, with `service_tier` mapped to Sail's completion window and billed at that window's price, including a new `balanced` tier |
| Cortecs | `/v1/chat/completions`, `/v1/responses`, `/v1/messages` | Cortecs, an EU LLM router, as an OpenAI-compatible provider |

### Expanded provider endpoint support

| Provider | Endpoint | What you can do |
| --- | --- | --- |
| [xAI](../../docs/providers/xai) | `/v1/files`, `/v1/batches` | Run native xAI batches and files |
| [Amazon Bedrock](../../docs/providers/bedrock) | `/v1/chat/completions` | Serve GPT-5.6, GPT-6 and GPT-6.1 on bedrock-runtime's native Chat Completions, with a `chat_completions/` opt-in for gpt-oss and Grok |
| [Fireworks AI](../../docs/providers/fireworks_ai) | `/v1/chat/completions` | Route to and list the `auto`, `auto-instant` and `firerouter` routers |

## New Models / Updated Models

#### New Model Support (78 new models)

Counts represent new catalog identifiers compared with `v1.104.0`, including aliases and regional variants. Prices below are the values bundled in this release, in USD; runtime pricing-map reloads can update them. Input and output columns show base token rates; long-context, cache, image-token, and other specialized rates depend on the model

| Provider | Model | Context Window | Input ($/1M tokens) | Output ($/1M tokens) | Features / special pricing |
| --- | --- | --- | --- | --- | --- |
| Amazon Bedrock | `anthropic.claude-sonnet-5-5` | 1,000,000 | $2 | $10 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `apac.anthropic.claude-sonnet-5-5` | 1,000,000 | $2.2 | $11 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `au.anthropic.claude-sonnet-5-5` | 1,000,000 | $2.2 | $11 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `bedrock/us-gov-east-1/anthropic.claude-sonnet-5-5` | 1,000,000 | $2.4 | $12 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `bedrock/us-gov-west-1/anthropic.claude-sonnet-5-5` | 1,000,000 | $2.4 | $12 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `eu.anthropic.claude-sonnet-5-5` | 1,000,000 | $2.2 | $11 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `global.anthropic.claude-sonnet-5-5` | 1,000,000 | $2 | $10 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `global.openai.gpt-6.1-sol` | 1,050,000 | $2 | $10 | Chat; Reasoning; Vision; Tool calling; Prompt caching |
| Amazon Bedrock | `global.xai.grok-4.7` | 500,000 | $2 | $6 | Chat; Reasoning; Vision; Tool calling |
| Amazon Bedrock | `jp.anthropic.claude-sonnet-5-5` | 1,000,000 | $2.2 | $11 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `openai.gpt-6.1-sol` | 1,050,000 | $2 | $10 | Chat; Reasoning; Vision; Tool calling; Prompt caching |
| Amazon Bedrock | `us-gov.anthropic.claude-sonnet-5-5` | 1,000,000 | $2.4 | $12 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `us.anthropic.claude-sonnet-5-5` | 1,000,000 | $2.2 | $11 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `us.openai.gpt-6.1-sol` | 1,050,000 | $2.2 | $11 | Chat; Reasoning; Vision; Tool calling; Prompt caching |
| Amazon Bedrock | `us.xai.grok-4.7` | 500,000 | $2.2 | $6.6 | Chat; Reasoning; Vision; Tool calling |
| Amazon Bedrock | `xai.grok-4.7` | 500,000 | $2 | $6 | Chat; Reasoning; Vision; Tool calling |
| Anthropic | `claude-sonnet-5-5` | 1,000,000 | $2 | $10 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; Computer use |
| Azure AI | `azure_ai/MAI-Cyber-1-Flash` | 256,000 | $0.6 | $3.5 | Chat; Reasoning; Tool calling; Prompt caching |
| Azure AI | `azure_ai/claude-sonnet-5-5` | 1,000,000 | $2 | $10 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Azure AI | `azure_ai/gpt-6.1-sol` | 922,000 | $2 | $10 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; Computer use |
| Azure AI | `azure_ai/mistral-ocr-2505` | - | - | - | OCR; `ocr_cost_per_page`: $0.001 |
| Azure AI | `azure_ai/mistral-ocr-2512` | - | - | - | OCR; `ocr_cost_per_page`: $0.002 |
| Azure OpenAI | `azure/gpt-6.1-sol` | 922,000 | $2 | $10 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; Computer use |
| Azure OpenAI | `azure/gpt-6.1-sol-2026-09-29` | 922,000 | $2 | $10 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; Computer use |
| Baseten | `baseten/deepseek-ai/DeepSeek-V4.1-Flash-Fast` | 1,048,576 | $0.6 | $2.4 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Bedrock Mantle | `bedrock_mantle/anthropic.claude-opus-5-5` | 1,000,000 | $4.4 | $22 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Bedrock Mantle | `bedrock_mantle/anthropic.claude-sonnet-5-5` | 1,000,000 | $2.2 | $11 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Bedrock Mantle | `bedrock_mantle/openai.gpt-6.1-sol` | 1,050,000 | $2.2 | $11 | Responses; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Bedrock Mantle | `bedrock_mantle/us-gov-west-1/anthropic.claude-opus-5-5` | 1,000,000 | $4.8 | $24 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Bedrock Mantle | `bedrock_mantle/us-gov-west-1/anthropic.claude-sonnet-5-5` | 1,000,000 | $2.4 | $12 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Databricks | `databricks/databricks-claude-opus-5-5` | 1,000,000 | $4.00001 | $19.99998 | Chat; Reasoning; Vision; Tool calling; Prompt caching |
| Fireworks AI | `fireworks_ai/accounts/fireworks/routers/auto` | - | - | - | Chat; Reasoning; Tool calling; Structured output |
| Fireworks AI | `fireworks_ai/accounts/fireworks/routers/auto-instant` | - | - | - | Chat; Reasoning; Tool calling; Structured output |
| Fireworks AI | `fireworks_ai/accounts/fireworks/routers/firerouter` | - | - | - | Chat; Reasoning; Tool calling; Structured output |
| Nebius | `nebius/Qwen/Qwen3.8-27B` | 262,144 | $0.45 | $3 | Chat; Reasoning; Tool calling |
| OpenAI | `gpt-4o-mini-tts-2025-03-20` | - | $0.6 | $10 | Speech; `output_cost_per_second`: $0.00025 |
| OpenAI | `gpt-6.1-sol` | 922,000 | $2 | $10 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; Computer use |
| OpenRouter | `openrouter/anthropic/claude-sonnet-5.5` | 1,000,000 | $2 | $10 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/anthropic/claude-sonnet-5.5:batch` | 1,000,000 | $1 | $5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/apodex/apodex-1.1-mini:free` | 262,144 | $0 | $0 | Chat; Reasoning; Tool calling; Structured output |
| OpenRouter | `openrouter/openai/gpt-6.1-sol` | 1,050,000 | $2 | $10 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/openai/gpt-6.1-sol-pro` | 1,050,000 | $2 | $10 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/openai/gpt-6.1-sol-pro:batch` | 1,050,000 | $1 | $5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/openai/gpt-6.1-sol:batch` | 1,050,000 | $1 | $5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search |
| OpenRouter | `openrouter/typesafe/jev-router` | 1,000,000 | $0 | $0 | Chat; Reasoning; Vision; Tool calling; Structured output; PDF input; Audio input |
| OpenRouter | `openrouter/unbiased/pareto-26.10-preview` | 1,048,576 | $0.8 | $3.2 | Chat; Vision; Tool calling; Prompt caching |
| Perplexity | `perplexity/anthropic/claude-fable-5-1` | - | $10 | $50 | Responses |
| Perplexity | `perplexity/anthropic/claude-opus-5-5` | - | $4 | $20 | Responses |
| Perplexity | `perplexity/anthropic/claude-sonnet-5-5` | - | $2 | $10 | Responses; Tool calling; Web search |
| Perplexity | `perplexity/google/gemini-3.8-flash` | - | $0.75 | $3.75 | Responses |
| Perplexity | `perplexity/openai/gpt-6-luna` | - | $0.1 | $0.5 | Responses |
| Perplexity | `perplexity/openai/gpt-6-sol` | - | $2 | $10 | Responses |
| Perplexity | `perplexity/openai/gpt-6.1-sol` | - | $2 | $10 | Responses |
| Perplexity | `perplexity/xai/grok-4.7` | - | $2 | $6 | Responses |
| Prism | `prism/deepseek-v4-flash` | 1,000,000 | $0.17 | $0.21 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Prism | `prism/deepseek-v4.1-flash` | 1,000,000 | $0.17 | $0.63 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Sail | `sail/Qwen/Qwen3.6-35B-A3B` | 262,144 | $0.05 | $0.4 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Sail | `sail/deepseek-ai/DeepSeek-V4-Flash-0731` | 1,048,576 | $0.09 | $0.18 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Sail | `sail/deepseek-ai/DeepSeek-V4-Pro-0813` | 1,048,576 | $0.92 | $2.77 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Sail | `sail/deepseek-ai/DeepSeek-V4.1-Flash` | 1,048,576 | $0.15 | $0.6 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Sail | `sail/google/gemma-4-12B-it` | 16,384 | $0.3 | $2 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Sail | `sail/google/gemma-4-31B-it` | 256,000 | $0.4 | $0.6 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Sail | `sail/moonshotai/Kimi-K2.6` | 262,144 | $1 | $4 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Sail | `sail/moonshotai/Kimi-K3` | 1,048,576 | $2.5 | $12.5 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Sail | `sail/nvidia/Gemma-4-31B-IT-NVFP4` | 262,144 | $0.14 | $0.4 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Sail | `sail/openai/gpt-oss-120b` | 131,072 | $0.06 | $0.4 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Sail | `sail/zai-org/GLM-5.3` | 1,048,576 | $0.98 | $3.08 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Sail | `sail/zai-org/GLM-5.3-Flash` | 1,048,576 | $0.11 | $0.35 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| Together AI | `together_ai/Salesforce/Llama-Rank-V1` | 8,192 | $0.1 | $0 | Rerank |
| Together AI | `together_ai/meta-llama/Meta-Llama-3.1-8B` | 16,384 | $0.2 | $0.2 | Completion |
| Vertex AI | `vertex_ai/claude-sonnet-5-5` | 1,000,000 | $2 | $10 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Vertex AI | `vertex_ai/claude-sonnet-5-5@default` | 1,000,000 | $2 | $10 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Vertex AI | `vertex_ai/gemini-3.8-flash-lite-tts` | 8,192 | $0.5 | $6 | Speech |
| Vertex AI | `vertex_ai/gemini-3.8-flash-tts` | 8,192 | $0.5 | $9 | Speech |
| Vertex AI | `vertex_ai/xai/grok-4.7` | 524,288 | $2 | $6 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Voyage AI | `voyage/rerank-1` | 8,000 | $0.05 | $0 | Rerank |
| Voyage AI | `voyage/rerank-lite-1` | 4,000 | $0.02 | $0 | Rerank |
| Voyage AI | `voyage/voyage-large-2-instruct` | 16,000 | $0.12 | $0 | Embedding |

#### Updated pricing (59 models)

| Provider / model | Changed token prices (USD per 1M tokens) |
| --- | --- |
| `azure/eu/gpt-6-astra` | Input: $11 to $12; Output: $55 to $60; Cache read: $1.1 to $1.2; Cache write: $13.75 to $15 |
| `azure/gpt-4o-mini` | Input: $0.165 to $0.15; Output: $0.66 to $0.6 |
| `azure/gpt-4o-mini-tts` | Input: $2.5 to $0.6 |
| `azure_ai/deepseek-v4.1-flash` | Input: $0.375 to $0.3; Output: $1.5 to $1.2; Cache read: $0.008 to $0.006 |
| `azure_ai/grok-4.6` | Input: $2 to $1.25 |
| `bedrock/ap-southeast-2/minimax.minimax-m2.5` | Input: $0.309 to $0.31; Output: $1.236 to $1.24 |
| `fireworks-ai-up-to-4b` | Input: $0.2 to $0.1; Output: $0.2 to $0.1 |
| `fireworks_ai/accounts/fireworks/models/deepseek-v4p1-flash` | Input: $0.22 to $0.3; Output: $0.66 to $1.2; Cache read: $0.007 to $0.006 |
| `fireworks_ai/deepseek-v4p1-flash` | Input: $0.22 to $0.3; Output: $0.66 to $1.2; Cache read: $0.007 to $0.006 |
| `github_copilot/claude-haiku-4.5` | Input: not set to $1; Output: not set to $5; Cache read: not set to $0.1; Cache write: not set to $1.25 |
| `github_copilot/claude-sonnet-4` | Input: not set to $3; Output: not set to $15; Cache read: not set to $0.3; Cache write: not set to $3.75 |
| `github_copilot/gpt-5-mini` | Input: not set to $0.25; Output: not set to $2; Cache read: not set to $0.025 |
| `github_copilot/gpt-5.3-codex` | Input: not set to $1.75; Output: not set to $14; Cache read: not set to $0.175 |
| `meta.llama3-1-405b-instruct-v1:0` | Input: $5.32 to $2.4; Output: $16 to $2.4 |
| `meta.llama3-1-70b-instruct-v1:0` | Input: $0.99 to $0.72; Output: $0.99 to $0.72 |
| `meta.llama3-2-11b-instruct-v1:0` | Input: $0.35 to $0.16; Output: $0.35 to $0.16 |
| `meta.llama3-2-90b-instruct-v1:0` | Input: $2 to $0.72; Output: $2 to $0.72 |
| `mistral.mistral-large-2407-v1:0` | Input: $3 to $2; Output: $9 to $6 |
| `moonshotai.kimi-k3` | Input: $3 to $3.3; Output: $15 to $16.5; Cache read: $0.3 to $0.33; Cache write: $3.75 to $4.125 |
| `openrouter/deepseek/deepseek-chat` | Input: $0.32 to $0.2574; Output: $0.89 to $1.0287 |
| `openrouter/deepseek/deepseek-chat-v3-0324` | Input: $0.25 to $0.29; Output: $1 to $1.14; Cache read: not set to $0.11 |
| `openrouter/deepseek/deepseek-v3.1-terminus` | Input: $0.27 to $0.3 |
| `openrouter/deepseek/deepseek-v3.2` | Input: $0.269 to $0.28; Output: $0.4 to $0.42; Cache read: $0.1345 to $0.028 |
| `openrouter/deepseek/deepseek-v4-flash` | Input: $0.049 to $0.04186; Output: $0.098 to $0.08372; Cache read: $0.0098 to $0.008372 |
| `openrouter/deepseek/deepseek-v4-flash-0731` | Input: $0.03 to $0.0108; Output: $0.32 to $1.28; Cache read: $0.016 to $0.0108 |
| `openrouter/deepseek/deepseek-v4-flash-vision-exp` | Input: $0.22 to $0.2156; Output: $0.66 to $0.6468; Cache read: $0.007 to $0.00686 |
| `openrouter/deepseek/deepseek-v4-pro` | Input: $0.844944 to $0.2088; Output: $1.689888 to $0.4176; Cache read: $0.070412 to $0.0174 |
| `openrouter/deepseek/deepseek-v4-pro-0813` | Input: $0.462 to $1.32; Output: $1.386 to $3.96; Cache read: $0.0154 to $0.044 |
| `openrouter/deepseek/deepseek-v4.1-flash` | Input: $0.3 to $0.03; Output: $1.2 to $0.5; Cache read: $0.006 to $0.01 |
| `openrouter/google/gemma-4-26b-a4b-it` | Input: $0.09 to $0.0765; Output: $0.3 to $0.255; Cache read: $0.05 to $0.0425 |
| `openrouter/inclusionai/ling-3.0-flash-vl` | Input: $0.06 to $0.021; Output: $0.18 to $0.0616; Cache read: $0.012 to $0.0042 |
| `openrouter/meta/muse-glimmer-30b` | Input: $0.3 to $0.35; Output: $1.2 to $1.5 |
| `openrouter/minimax/minimax-m1` | Input: $0.4 to $0.55 |
| `openrouter/minimax/minimax-m2.7` | Input: $0.3 to $0.21; Output: $1.2 to $0.84; Cache read: $0.06 to $0.042 |
| `openrouter/moonshotai/kimi-k2.6` | Input: $0.95 to $0.43415; Output: $4 to $1.828; Cache read: $0.16 to $0.07312 |
| `openrouter/moonshotai/kimi-k2.7-code` | Input: $0.6562 to $0.6712; Output: $3.3 to $3.35 |
| `openrouter/moonshotai/kimi-k3` | Input: $3 to $0.4357; Output: $15 to $10; Cache read: $0.3 to $0.4357 |
| `openrouter/nvidia/nemotron-3.5-lightning` | Input: $0.08 to $0.0595; Output: $0.2 to $0.17; Cache read: $0.04 to $0.02975 |
| `openrouter/openai/gpt-5.6-sol-pro` | Input: $2 to $4; Output: $10 to $20; Cache read: $0.2 to $0.4; Cache write: $2.5 to $5 |
| `openrouter/openai/gpt-oss-120b` | Input: $0.15 to $0.037; Output: $0.6 to $0.17; Cache read: $0.075 to not set |
| `openrouter/openai/gpt-oss-20b` | Cache read: $0.03 to $0.009 |
| `openrouter/prism-ml/ternary-bonsai-2-27b` | Cache read: not set to $0.0375 |
| `openrouter/qwen/qwen3-30b-a3b-instruct-2507` | Input: $0.1 to $0.04815; Output: $0.3 to $0.19305 |
| `openrouter/qwen/qwen3-vl-30b-a3b-instruct` | Input: $0.13 to $0.15; Output: $0.52 to $0.6 |
| `openrouter/qwen/qwen3.5-35b-a3b` | Input: $0.3125 to $0.1625; Output: $1.25 to $1.3 |
| `openrouter/qwen/qwen3.6-27b` | Output: $2.7 to $3.2 |
| `openrouter/x-ai/grok-4.7` | Input: $1.6 to $2; Output: $4.8 to $6; Cache read: $0.4 to $0.5 |
| `openrouter/z-ai/glm-4.6v` | Cache read: $0.055 to $0.05 |
| `openrouter/z-ai/glm-4.7` | Input: $0.4 to $0.6; Output: $1.75 to $2.2; Cache read: $0.08 to $0.11 |
| `openrouter/z-ai/glm-5.1` | Input: $0.966 to $0.9646; Output: $3.036 to $3.0316; Cache read: $0.1794 to $0.17914 |
| `openrouter/z-ai/glm-5.2` | Input: $0.6496 to $0.41; Output: $2.0416 to $3.99; Cache read: $0.12064 to $0.26 |
| `openrouter/z-ai/glm-5.3` | Input: $1.4 to $0.2219; Output: $4.4 to $3.39; Cache read: $0.26 to $0.1775 |
| `openrouter/z-ai/glm-5.3-flash` | Input: $0.045 to $0.15; Output: $0.6 to $0.5; Cache read: $0.0285 to $0.03 |
| `openrouter/~x-ai/grok-latest` | Input: $1.6 to $2; Output: $4.8 to $6; Cache read: $0.4 to $0.5 |
| `perplexity/openai/gpt-5.6-sol` | Input: $5 to $4; Output: $30 to $20; Cache read: $0.5 to $0.4 |
| `us.meta.llama3-1-405b-instruct-v1:0` | Input: $5.32 to $2.4; Output: $16 to $2.4 |
| `us.meta.llama3-1-70b-instruct-v1:0` | Input: $0.99 to $0.72; Output: $0.99 to $0.72 |
| `us.meta.llama3-2-11b-instruct-v1:0` | Input: $0.35 to $0.16; Output: $0.35 to $0.16 |
| `us.meta.llama3-2-90b-instruct-v1:0` | Input: $2 to $0.72; Output: $2 to $0.72 |

The registry also updates capability flags, context/output limits, non-token rates, and deprecation dates on 244 more entries

<details>
<summary>Removed catalog entries (1)</summary>

`azure_ai/muse-spark-1.3`

</details>

### New providers

- Add Prism provider - [PR #41961](https://github.com/BerriAI/litellm/pull/41961)
- Add Sail as a provider, with service_tier mapped to its completion window - [PR #42840](https://github.com/BerriAI/litellm/pull/42840)
- Add Cortecs as an OpenAI-compatible provider - [PR #43872](https://github.com/BerriAI/litellm/pull/43872)

### Amazon Bedrock

- Surface a converse-stream 200 that decodes to no events as a 502 instead of an empty turn - [PR #43213](https://github.com/BerriAI/litellm/pull/43213)
- Keep the provider status code on unprocessable image errors - [PR #43416](https://github.com/BerriAI/litellm/pull/43416)
- Add xai grok-4.7 pricing and sync llama, mistral large 2407 and minimax m2.5 prices - [PR #43623](https://github.com/BerriAI/litellm/pull/43623)
- Add bedrock_mantle rows for claude opus 5.5 and sonnet 5.5 - [PR #43647](https://github.com/BerriAI/litellm/pull/43647)
- Add openai gpt-6.1-sol global and base rows - [PR #43758](https://github.com/BerriAI/litellm/pull/43758)
- Add openai.gpt-6.1-sol us geo cris and Mantle rows - [PR #43763](https://github.com/BerriAI/litellm/pull/43763)
- Add beta header for output config in message - [PR #43778](https://github.com/BerriAI/litellm/pull/43778)
- Set gpt-6.1-sol max output tokens to 131072 - [PR #43782](https://github.com/BerriAI/litellm/pull/43782)
- Keep applicable beta headers - [PR #43829](https://github.com/BerriAI/litellm/pull/43829)
- Add beta header for thinking display updates - [PR #43832](https://github.com/BerriAI/litellm/pull/43832)
- Add beta for mid-conversation tool changes - [PR #43833](https://github.com/BerriAI/litellm/pull/43833)
- Accept Converse messages with no content key - [PR #43936](https://github.com/BerriAI/litellm/pull/43936)
- Serve gpt-5.6+ chat completions natively by default, with chat_completions/ opt-in for gpt-oss and grok - [PR #44307](https://github.com/BerriAI/litellm/pull/44307)

### Anthropic

- Drop thinking blocks with empty thinking text, not just missing signature - [PR #38049](https://github.com/BerriAI/litellm/pull/38049)
- Stand default cache points down when extra_body hides a direct client mark - [PR #43341](https://github.com/BerriAI/litellm/pull/43341)
- Forward the per-turn-control beta to Azure AI Foundry - [PR #43415](https://github.com/BerriAI/litellm/pull/43415)
- Add claude-sonnet-5-5 model pricing - [PR #43586](https://github.com/BerriAI/litellm/pull/43586)
- Correct Claude Sonnet 5.5 capabilities and provider keys - [PR #43587](https://github.com/BerriAI/litellm/pull/43587)
- Forward the dangerous-tool-use beta to Azure AI Foundry - [PR #43934](https://github.com/BerriAI/litellm/pull/43934)
- Keep thinking display updates beta - [PR #43969](https://github.com/BerriAI/litellm/pull/43969)

### Fireworks AI

- Route and list the auto, auto-instant and firerouter routers - [PR #43641](https://github.com/BerriAI/litellm/pull/43641)

### Gemini and Vertex AI

- Stop importing the vertexai SDK in partner-model completion - [PR #42274](https://github.com/BerriAI/litellm/pull/42274)
- Keep legacy bucket_name in credential resolution and add GCS_BATCH_BUCKET_NAME env var - [PR #42803](https://github.com/BerriAI/litellm/pull/42803)
- Make Gemma fake streams work with traced Responses - [PR #43147](https://github.com/BerriAI/litellm/pull/43147)
- Forward seed to the Gemini API instead of rejecting it - [PR #43197](https://github.com/BerriAI/litellm/pull/43197)
- Consider tools when validating context caching min tokens - [PR #43319](https://github.com/BerriAI/litellm/pull/43319)
- Preserve proxy_server_request in completion adapter - [PR #43536](https://github.com/BerriAI/litellm/pull/43536)
- Forward the per-turn-control beta for per-message output_config - [PR #43558](https://github.com/BerriAI/litellm/pull/43558)

### OpenAI

- Exclude fine-tuned and custom gpt-5-chat aliases from gpt-5 reasoning path - [PR #43185](https://github.com/BerriAI/litellm/pull/43185)
- Add openai gpt-6.1-sol from the pricing page - [PR #43738](https://github.com/BerriAI/litellm/pull/43738)
- Add openai gpt-6-astra ultrafast tier prices from the pricing page - [PR #43745](https://github.com/BerriAI/litellm/pull/43745)

### xAI

- Add native xAI batches and files support - [PR #42812](https://github.com/BerriAI/litellm/pull/42812)

### Hosted vLLM

- Keep reasoning_content on replayed assistant messages - [PR #43599](https://github.com/BerriAI/litellm/pull/43599)

### Model catalog and pricing

- Sync openrouter prices and add perceptron-mk1.5 - [PR #43246](https://github.com/BerriAI/litellm/pull/43246)
- Add fireworks us-only deepseek v4.1 flash priority prices - [PR #43247](https://github.com/BerriAI/litellm/pull/43247)
- Add typesafe/jev-router to the cost map - [PR #43248](https://github.com/BerriAI/litellm/pull/43248)
- Add fireworks priority prices for muse glimmer 30b and deepseek v4 flash vision exp - [PR #43252](https://github.com/BerriAI/litellm/pull/43252)
- Correct fireworks_ai deepseek-v4p1-flash pricing - [PR #43253](https://github.com/BerriAI/litellm/pull/43253)
- Registry audit 2026-09-26, MAI-Image-2.5-Flash price, Databricks Claude Opus 5.5, Azure Foundry retirement dates - [PR #43254](https://github.com/BerriAI/litellm/pull/43254)
- Remove duplicate openrouter/perceptron/perceptron-mk1.5 entry - [PR #43273](https://github.com/BerriAI/litellm/pull/43273)
- Price fireworks deepseek v4.1 flash at the prices api value - [PR #43311](https://github.com/BerriAI/litellm/pull/43311)
- Sync OpenRouter, Together, Cohere and Azure AI registry values with official sources - [PR #43337](https://github.com/BerriAI/litellm/pull/43337)
- Correct azure gpt-4o-mini tts, transcribe, alias and MAI-Image-2.5 prices - [PR #43357](https://github.com/BerriAI/litellm/pull/43357)
- Sync openrouter prices for deepseek, minimax, qwen and glm rows - [PR #43384](https://github.com/BerriAI/litellm/pull/43384)
- Drop stale cache hit field from openrouter deepseek-v4-pro-0813 - [PR #43389](https://github.com/BerriAI/litellm/pull/43389)
- Update azure_ai/grok-4.6 input price from Azure pricing page - [PR #43440](https://github.com/BerriAI/litellm/pull/43440)
- Add azure_ai/MAI-Cyber-1-Flash - [PR #43446](https://github.com/BerriAI/litellm/pull/43446)
- Sync openrouter prices from the models API - [PR #43506](https://github.com/BerriAI/litellm/pull/43506)
- Add deprecation_date to together_ai Salesforce/Llama-Rank-V1 - [PR #43507](https://github.com/BerriAI/litellm/pull/43507)
- Set together_ai gpt-oss-20b and gemma-4-31B-it deprecation_date to 2026-09-15 - [PR #43509](https://github.com/BerriAI/litellm/pull/43509)
- Add mistral ocr pricing and azure max output limits - [PR #43530](https://github.com/BerriAI/litellm/pull/43530)
- Registry audit 2026-09-28, openai deep-research shutdown dates, azure deepseek v4.1 flash direct price, vertex gemini 3.8 live avatar price, drop azure_ai/muse-spark-1.3 - [PR #43566](https://github.com/BerriAI/litellm/pull/43566)
- Add web search flag and model page source to anthropic claude-sonnet-5-5 - [PR #43584](https://github.com/BerriAI/litellm/pull/43584)
- Add tool calling and reasoning flags, correct max output for nebius DeepSeek-V4.1-Flash - [PR #43588](https://github.com/BerriAI/litellm/pull/43588)
- Take azure limits for deepseek-v4-flash-0731 and v3.2-speciale - [PR #43597](https://github.com/BerriAI/litellm/pull/43597)
- Align Azure, Bedrock, Copilot, Gemini, Groq, OpenAI and OpenRouter entries with official docs - [PR #43598](https://github.com/BerriAI/litellm/pull/43598)
- Add Vertex batch cache prices to vertex_ai/claude-sonnet-5-5 - [PR #43602](https://github.com/BerriAI/litellm/pull/43602)
- Add baseten DeepSeek-V4.1-Flash-Fast - [PR #43735](https://github.com/BerriAI/litellm/pull/43735)
- Lower fireworks up-to-4b size tier to the pricing page price - [PR #43740](https://github.com/BerriAI/litellm/pull/43740)
- Add azure and openrouter gpt-6.1-sol rows - [PR #43744](https://github.com/BerriAI/litellm/pull/43744)
- Take azure context limits from models-sold-directly - [PR #43759](https://github.com/BerriAI/litellm/pull/43759)
- Add deprecation_date to two together_ai nvidia rows - [PR #43809](https://github.com/BerriAI/litellm/pull/43809)
- Add fireworks priority prices for ember-1, nemotron and glm 5.3 us rows - [PR #43811](https://github.com/BerriAI/litellm/pull/43811)
- Add Gemini Veo, Mistral and Azure Claude 4.5 deprecation dates - [PR #43857](https://github.com/BerriAI/litellm/pull/43857)
- Add openai gpt-image-2.5 batch prices from the pricing page - [PR #43869](https://github.com/BerriAI/litellm/pull/43869)
- Add vertex_ai gemini-3.8 flash tts rows - [PR #43876](https://github.com/BerriAI/litellm/pull/43876)
- Add deprecation date for anthropic claude-sonnet-4-5 - [PR #43898](https://github.com/BerriAI/litellm/pull/43898)
- Add perplexity, openrouter, voyage and nebius models and fix registry metadata - [PR #43907](https://github.com/BerriAI/litellm/pull/43907)
- Raise baseten DeepSeek-V4.1-Flash max output to 262144 - [PR #43916](https://github.com/BerriAI/litellm/pull/43916)
- Add fireworks inkling priority prices from the prices api - [PR #43949](https://github.com/BerriAI/litellm/pull/43949)
- Sync openrouter prices from the models API - [PR #43950](https://github.com/BerriAI/litellm/pull/43950)
- Set supports_vision true on GLM-5.3-Flash - [PR #43951](https://github.com/BerriAI/litellm/pull/43951)
- Reprice fireworks deepseek v4.1 flash to the 2026-10-01 pricing update - [PR #44024](https://github.com/BerriAI/litellm/pull/44024)
- Add vertex_ai/xai/grok-4.7 pricing - [PR #44059](https://github.com/BerriAI/litellm/pull/44059)
- Restore later azure Models API retirement dates and date gpt-6.1-sol - [PR #44072](https://github.com/BerriAI/litellm/pull/44072)
- Sync openrouter prices from the models API - [PR #44105](https://github.com/BerriAI/litellm/pull/44105)
- Add azure_ai deprecation dates from the Azure retired models page - [PR #44142](https://github.com/BerriAI/litellm/pull/44142)
- Take azure_ai claude-sonnet-4-5 retirement date from the Azure schedule - [PR #44145](https://github.com/BerriAI/litellm/pull/44145)

## LLM API Endpoints

### Responses API

- Stream guardrail pre-call block as SSE with a typed output item - [PR #42507](https://github.com/BerriAI/litellm/pull/42507)
- Fall back on pre-output stream drops, fail truncated streams, honor request_timeout - [PR #43133](https://github.com/BerriAI/litellm/pull/43133)
- Record streamed /v1/responses container ownership before the response.completed frame - [PR #43140](https://github.com/BerriAI/litellm/pull/43140)
- Hold Responses lifecycle events until output so a pre-output fallback announces one response - [PR #43238](https://github.com/BerriAI/litellm/pull/43238)
- Run stream failure and success hooks on the iterating loop instead of blocking it - [PR #43270](https://github.com/BerriAI/litellm/pull/43270)
- Emit the reasoning item on streaming /v1/responses for signature-only thinking - [PR #43414](https://github.com/BerriAI/litellm/pull/43414)

### Anthropic Messages API

- Send a real error event when a /v1/messages stream fails - [PR #41826](https://github.com/BerriAI/litellm/pull/41826)
- Surface Responses bridge stream failures as Anthropic error events - [PR #43126](https://github.com/BerriAI/litellm/pull/43126)
- Rename the `litellm.llms.anthropic.experimental_pass_through` package to `pass_through` - [PR #43329](https://github.com/BerriAI/litellm/pull/43329)
- Stream /v1/messages lifecycle frames live when no fallback can take over - [PR #43600](https://github.com/BerriAI/litellm/pull/43600)

### Agents and Agent-to-Agent

- Add identity storage and validation contracts - [PR #43720](https://github.com/BerriAI/litellm/pull/43720)
- Enforce authoritative agent permissions - [PR #43721](https://github.com/BerriAI/litellm/pull/43721)
- Authenticate Entra identities and delegated requests - [PR #43722](https://github.com/BerriAI/litellm/pull/43722)
- Add identity registration and dashboard controls - [PR #43723](https://github.com/BerriAI/litellm/pull/43723)

### `litellm.agent()` (SDK)

- Add `litellm.agent()` to run Claude Code, Codex, OpenCode and Deep Agents through the AI gateway - [PR #43885](https://github.com/BerriAI/litellm/pull/43885)

### Vector Stores and RAG

- Enforce key/team vector_stores allowlist on /v1/rag/query - [PR #43953](https://github.com/BerriAI/litellm/pull/43953)

### Audio

- Honor base_url alias for Groq Whisper and report it as the api base - [PR #43917](https://github.com/BerriAI/litellm/pull/43917)

### Pass-through endpoints

- Strip caller credentials from websocket passthrough - [PR #43855](https://github.com/BerriAI/litellm/pull/43855)
- Relay Azure passthrough body model groups through the router - [PR #43896](https://github.com/BerriAI/litellm/pull/43896)
- Preserve decision request bodies under token limits - [PR #43920](https://github.com/BerriAI/litellm/pull/43920)

### General

- Keep `_litellm_*` kwargs out of provider request bodies by construction - [PR #43221](https://github.com/BerriAI/litellm/pull/43221)
- Validate stream_chunk_size once, before any provider call - [PR #43222](https://github.com/BerriAI/litellm/pull/43222)
- Keep the submitted body out of 422 validation errors - [PR #43231](https://github.com/BerriAI/litellm/pull/43231)
- Salvage concatenated JSON tool call arguments - [PR #43260](https://github.com/BerriAI/litellm/pull/43260)
- Count Gemini function_declarations tools - [PR #43417](https://github.com/BerriAI/litellm/pull/43417)
- Categorize internal param appropriately to prevent leaking into request - [PR #43783](https://github.com/BerriAI/litellm/pull/43783)
- Keep silent_model out of embedding provider requests - [PR #44064](https://github.com/BerriAI/litellm/pull/44064)

## Management Endpoints / UI

### Admin UI

- Right-align money and count columns across tables - [PR #37889](https://github.com/BerriAI/litellm/pull/37889)
- Render access group MCP and agent selections as wrapping chips - [PR #41228](https://github.com/BerriAI/litellm/pull/41228)
- Surface x-litellm-call-id in Logs search, table and drawer - [PR #42436](https://github.com/BerriAI/litellm/pull/42436)
- Filter tags by name and description on the Tag Management page - [PR #42949](https://github.com/BerriAI/litellm/pull/42949)
- Rename All Models tab to Deployed Models and model filters to All Proxy Models - [PR #43638](https://github.com/BerriAI/litellm/pull/43638)
- Add model leaderboard page - [PR #43649](https://github.com/BerriAI/litellm/pull/43649)
- Show the user who owns the key that discovered a tool - [PR #43892](https://github.com/BerriAI/litellm/pull/43892)
- Adopt the new LiteLLM logo and monogram - [PR #43913](https://github.com/BerriAI/litellm/pull/43913)
- Drop the Beta badge from the Cost Optimization nav item - [PR #43967](https://github.com/BerriAI/litellm/pull/43967)
- Give model leaderboard a distinct trophy icon - [PR #44036](https://github.com/BerriAI/litellm/pull/44036)
- Show daily token totals on the model leaderboard - [PR #44044](https://github.com/BerriAI/litellm/pull/44044)
- Leave unset callback select params out of the save payload - [PR #44213](https://github.com/BerriAI/litellm/pull/44213)
- Shrink the sidebar logo so it stops outweighing page titles - [PR #44247](https://github.com/BerriAI/litellm/pull/44247)

### Usage and analytics

- Aggregated daily activity endpoints return the top 100 keys in `breakdown.api_keys` by default (totals unchanged); set `api_key_limit` up to 1000 - [PR #43398](https://github.com/BerriAI/litellm/pull/43398)
- Bounded daily activity routes (aggregated, search, model_top_keys, export, cache_leakage_keys) for all usage entities - [PR #43408](https://github.com/BerriAI/litellm/pull/43408)
- Usage pages consume bounded daily activity routes instead of storing all keys client-side - [PR #43409](https://github.com/BerriAI/litellm/pull/43409)
- Recover session key owners from daily spend for usage attribution - [PR #43642](https://github.com/BerriAI/litellm/pull/43642)
- Look up hashed key names with two spend log rows per key - [PR #43656](https://github.com/BerriAI/litellm/pull/43656)
- Add native ROI calculator for gateway spend vs merged PRs - [PR #43669](https://github.com/BerriAI/litellm/pull/43669)
- Attribute completed batch cost rows to /batches in daily activity - [PR #43870](https://github.com/BerriAI/litellm/pull/43870)
- Keep NULL entity ids when excluding entity ids - [PR #44139](https://github.com/BerriAI/litellm/pull/44139)
- Reject non-canonical daily activity dates - [PR #44143](https://github.com/BerriAI/litellm/pull/44143)

### Keys, teams and authentication

- Delete large teams without per-member transaction fan-out - [PR #42998](https://github.com/BerriAI/litellm/pull/42998)
- Log key owner identity on expired key auth failures - [PR #43105](https://github.com/BerriAI/litellm/pull/43105)
- Gate /sso/debug routes behind ENABLE_SSO_DEBUG, off by default - [PR #43150](https://github.com/BerriAI/litellm/pull/43150)
- Persist SSO display name as user_alias on login - [PR #44065](https://github.com/BerriAI/litellm/pull/44065)

### Proxy configuration

- Add LITELLM_DISABLE_LAZY_ROUTES to register optional routers at startup - [PR #43911](https://github.com/BerriAI/litellm/pull/43911)

### CLI and coding agents

- Reuse saved agent setup and add reconfigure - [PR #43392](https://github.com/BerriAI/litellm/pull/43392)

### Deployment

- Keep wheel paths under Windows MAX_PATH for Store Python - [PR #43903](https://github.com/BerriAI/litellm/pull/43903)
- Drop the no-op PROXY_EXTRAS_SOURCE switch from the non-root image - [PR #44097](https://github.com/BerriAI/litellm/pull/44097)
- Always exit when database setup fails at boot - [PR #44141](https://github.com/BerriAI/litellm/pull/44141)

### Terraform

- Accept 2xx status codes in unified_access_group create - [PR #42461](https://github.com/BerriAI/litellm/pull/42461)

## AI Integrations

### Lens and Agent Traces

- Add Rust storage foundation - [PR #43819](https://github.com/BerriAI/litellm/pull/43819)
- Analyze agent activity with a separate worker - [PR #43889](https://github.com/BerriAI/litellm/pull/43889)
- Agent traces tab on logs with timeline and otel setup guide - [PR #43891](https://github.com/BerriAI/litellm/pull/43891)
- Correct ClickHouse rollup partitioning, dedupe keys, and retention changes - [PR #43901](https://github.com/BerriAI/litellm/pull/43901)
- Port OTLP ingestion to current trace foundation - [PR #43915](https://github.com/BerriAI/litellm/pull/43915)
- Store spend in ClickHouse automatically - [PR #43928](https://github.com/BerriAI/litellm/pull/43928)
- Investigate sampled traces and retain batch results - [PR #43942](https://github.com/BerriAI/litellm/pull/43942)
- Agent traces open in a side drawer with a chat-style run view - [PR #43972](https://github.com/BerriAI/litellm/pull/43972)
- Improve trace ingestion and trace details - [PR #43975](https://github.com/BerriAI/litellm/pull/43975)
- Track worker spend through virtual keys - [PR #43989](https://github.com/BerriAI/litellm/pull/43989)
- Rename Lens internals and move its API from `/engine` to `/lens` - [PR #44034](https://github.com/BerriAI/litellm/pull/44034)
- Inject tracing receiver and access context - [PR #44035](https://github.com/BerriAI/litellm/pull/44035)
- Move traces and setup into Lens - [PR #44068](https://github.com/BerriAI/litellm/pull/44068)
- Normalize agent spans in Rust - [PR #44071](https://github.com/BerriAI/litellm/pull/44071)
- Add scoped SQL queries and schema-aware help - [PR #44085](https://github.com/BerriAI/litellm/pull/44085)
- Simplify setup and investigation workflow - [PR #44089](https://github.com/BerriAI/litellm/pull/44089)
- Add test trace, tracing key and otel endpoints to tracing setup - [PR #44090](https://github.com/BerriAI/litellm/pull/44090)
- Label lens trace services as agents - [PR #44116](https://github.com/BerriAI/litellm/pull/44116)
- Recalculate ClickHouse TTL info only on retention changes - [PR #44117](https://github.com/BerriAI/litellm/pull/44117)

### Guardrails

- Honor experimental_use_latest_role_message_only on every request shape - [PR #42447](https://github.com/BerriAI/litellm/pull/42447)
- Enable explicit PANW MCP output scanning - [PR #43109](https://github.com/BerriAI/litellm/pull/43109)
- Honor litellm_params.timeout in every HTTP guardrail - [PR #43134](https://github.com/BerriAI/litellm/pull/43134)
- Fix agent 365 to the production endpoint and log the opt-in fail_open at error level - [PR #43189](https://github.com/BerriAI/litellm/pull/43189)
- Scan retrieved vector store chunks with the request's pre-call guardrails - [PR #43271](https://github.com/BerriAI/litellm/pull/43271)
- Block private destinations in custom code http_request and bound guardrail execution time - [PR #43280](https://github.com/BerriAI/litellm/pull/43280)
- Preserve Presidio output selection and restoration - [PR #43401](https://github.com/BerriAI/litellm/pull/43401)
- Scan and mask top-level instructions with guardrails - [PR #43629](https://github.com/BerriAI/litellm/pull/43629)
- Send a configured gateway_name from noma_v2 to Noma - [PR #43678](https://github.com/BerriAI/litellm/pull/43678)
- Send request conversation and tool calls to post-call monitor - [PR #43770](https://github.com/BerriAI/litellm/pull/43770)
- Scan Responses API input in Azure Prompt Shield - [PR #43786](https://github.com/BerriAI/litellm/pull/43786)
- Treat an unknown straiker api_version as unset instead of skipping the guardrail - [PR #43956](https://github.com/BerriAI/litellm/pull/43956)
- Scan Responses API input in Azure Text Moderation - [PR #43965](https://github.com/BerriAI/litellm/pull/43965)
- Route Straiker `sk_agt_` keys to v3 and fail closed on a missing verdict - [PR #44011](https://github.com/BerriAI/litellm/pull/44011)
- Restore Azure guardrail get_user_prompt dispatch and allow logging - [PR #44067](https://github.com/BerriAI/litellm/pull/44067)

### Logging and observability

- Add Databricks Zerobus trace logging callback - [PR #42013](https://github.com/BerriAI/litellm/pull/42013)
- Keep the DataLakeServiceClient alive until its TTL elapses - [PR #43082](https://github.com/BerriAI/litellm/pull/43082)
- Scrub PII and secrets inside object reprs and nested locals, add SENTRY_SEND_DEFAULT_PII opt-in - [PR #43123](https://github.com/BerriAI/litellm/pull/43123)
- Keep team callback credentials out of the stored request body - [PR #43217](https://github.com/BerriAI/litellm/pull/43217)
- Redact raw_request when turn_off_message_logging is set in the proxy config - [PR #43219](https://github.com/BerriAI/litellm/pull/43219)
- Detach post-response service spans by request phase, name redis spans by operation - [PR #43237](https://github.com/BerriAI/litellm/pull/43237)
- Excluded_services opt-out for datastore spans on tenant destinations - [PR #43278](https://github.com/BerriAI/litellm/pull/43278)
- Add SigNoz preset for OpenTelemetry v2 - [PR #43296](https://github.com/BerriAI/litellm/pull/43296)
- Deliver spans to app.langtrace.ai/api/trace with x-api-key - [PR #43322](https://github.com/BerriAI/litellm/pull/43322)
- Send cache and reasoning tokens in langfuse usage_details - [PR #43553](https://github.com/BerriAI/litellm/pull/43553)
- Keep request-body credentials out of stored spend-log requests - [PR #43635](https://github.com/BerriAI/litellm/pull/43635)
- Add s3_partition_granularity option for hourly S3 folders - [PR #43748](https://github.com/BerriAI/litellm/pull/43748)
- Register a UI-configured arize callback next to otel under OTel v2 - [PR #43906](https://github.com/BerriAI/litellm/pull/43906)
- Name Data Lake objects without base64 padding or slashes - [PR #43914](https://github.com/BerriAI/litellm/pull/43914)
- Keep tool payloads and logprobs unmasked in stored spend logs - [PR #44075](https://github.com/BerriAI/litellm/pull/44075)
- Tolerate non-dict callback_settings.otel and ignore bare EXCLUDED_SERVICES env - [PR #44086](https://github.com/BerriAI/litellm/pull/44086)
- Keep client call ids from sharing one Data Lake file - [PR #44099](https://github.com/BerriAI/litellm/pull/44099)

## Spend Tracking, Budgets and Rate Limiting

### Cost tracking

- Keep the served service_tier on streamed chunks and spend rows - [PR #42870](https://github.com/BerriAI/litellm/pull/42870)
- Record in spend logs whether a request used a client-forwarded Anthropic OAuth token - [PR #43063](https://github.com/BerriAI/litellm/pull/43063)
- Bill chat per-second pricing once with a new cost_per_second field - [PR #43614](https://github.com/BerriAI/litellm/pull/43614)
- Stop copying optional_params into response hidden params - [PR #43637](https://github.com/BerriAI/litellm/pull/43637)
- Bill ultrafast prompts above 272k at the ultrafast long-context rates - [PR #43764](https://github.com/BerriAI/litellm/pull/43764)
- Bill service tiers at catalog rates for custom-priced deployments - [PR #43890](https://github.com/BerriAI/litellm/pull/43890)

### Budgets

- Count provider budget spend on every API surface - [PR #38172](https://github.com/BerriAI/litellm/pull/38172)
- Email alerts at configured percentages of a team member budget - [PR #42665](https://github.com/BerriAI/litellm/pull/42665)
- Resolve model_group_alias in the zero-cost budget predicate - [PR #43512](https://github.com/BerriAI/litellm/pull/43512)

### Rate limiting

- Add fail_closed_rate_limit_enforcement to reject requests with 503 while Redis rate limit counters are unreachable - [PR #43251](https://github.com/BerriAI/litellm/pull/43251)

## MCP Gateway

- Share compatibility-aware result conversion across tool surfaces - [PR #43089](https://github.com/BerriAI/litellm/pull/43089)
- Add Microsoft 365 (Graph) server to the MCP catalog - [PR #43099](https://github.com/BerriAI/litellm/pull/43099)
- Configure protocol versions and capability discovery - [PR #43169](https://github.com/BerriAI/litellm/pull/43169)
- Report reachability without stored credentials - [PR #43240](https://github.com/BerriAI/litellm/pull/43240)
- Align hub publication status and controls - [PR #43241](https://github.com/BerriAI/litellm/pull/43241)
- Adopt shared server resolution and caller authorization - [PR #43263](https://github.com/BerriAI/litellm/pull/43263)
- Scan and pin upstream tool descriptions - [PR #43283](https://github.com/BerriAI/litellm/pull/43283)
- Scope OpenAPI listings to the exact server prefix and drop upstream OAuth metadata when a server is saved - [PR #43608](https://github.com/BerriAI/litellm/pull/43608)
- Keep MCP permissions visible after key, team and MCP server saves - [PR #43810](https://github.com/BerriAI/litellm/pull/43810)
- Resolve team-granted toolsets for non-admin keys and dashboard sessions - [PR #43908](https://github.com/BerriAI/litellm/pull/43908)

## Performance / Loadbalancing / Reliability improvements

### Auto Router and model routing

- Parse the classifier verdict out of surrounding prose instead of falling to the default tier - [PR #43215](https://github.com/BerriAI/litellm/pull/43215)
- Opt in to prompt-cache cost routing - [PR #43232](https://github.com/BerriAI/litellm/pull/43232)
- Fetch cooldown state and usage counters in one Redis round trip - [PR #43320](https://github.com/BerriAI/litellm/pull/43320)
- Compare historical and new savings consistently - [PR #43348](https://github.com/BerriAI/litellm/pull/43348)
- Bind Claude Code background sessions to their auto-router - [PR #43767](https://github.com/BerriAI/litellm/pull/43767)
- Strip encrypted reasoning the pinned deployment cannot decrypt - [PR #43781](https://github.com/BerriAI/litellm/pull/43781)
- Carry per-request routing reads on context variables instead of public method kwargs - [PR #43814](https://github.com/BerriAI/litellm/pull/43814)
- Honour the cooldown read interval in the routing prefetch - [PR #43815](https://github.com/BerriAI/litellm/pull/43815)
- Show actual and baseline spend for historical savings - [PR #44057](https://github.com/BerriAI/litellm/pull/44057)

### Caching, database and runtime

- Add maximum_daily_tag_spend_retention_period cleanup setting - [PR #39221](https://github.com/BerriAI/litellm/pull/39221)
- Give SpendLogToolIndex its own share of the cleanup budget and log a per-run summary - [PR #41768](https://github.com/BerriAI/litellm/pull/41768)
- Propagate auth cache invalidation over Redis Cluster via a node-level pub/sub client - [PR #43110](https://github.com/BerriAI/litellm/pull/43110)
- Hold one spend counter batch across admission and across post-call accounting - [PR #43369](https://github.com/BerriAI/litellm/pull/43369)
- One request-scoped Redis pipeline for auth, spend, rate-limit and routing reads - [PR #43407](https://github.com/BerriAI/litellm/pull/43407)
- Run aresponses through the async wrapper so the cache is read once - [PR #43769](https://github.com/BerriAI/litellm/pull/43769)
- Refresh auth management objects through the request Redis pipeline - [PR #43776](https://github.com/BerriAI/litellm/pull/43776)
- One post-call Redis pipeline per backend for spend, rate-limit, routing and response-cache writes - [PR #43779](https://github.com/BerriAI/litellm/pull/43779)
- Build the SpendLogs indexes in the migration job instead of in migrations - [PR #43948](https://github.com/BerriAI/litellm/pull/43948)
- Write the response-cache SET to Redis at once instead of on the post-call batch - [PR #43973](https://github.com/BerriAI/litellm/pull/43973)
- Gzip buffered responses for clients that accept it - [PR #44052](https://github.com/BerriAI/litellm/pull/44052)
- Bound the lock waits of the partitioned SpendLogs index build - [PR #44109](https://github.com/BerriAI/litellm/pull/44109)
- Hand libpq a root cert, not Prisma's sslcert, when the migration job builds indexes - [PR #44203](https://github.com/BerriAI/litellm/pull/44203)

### Dependency updates

- Bump pyjwt, moment and brace-expansion to clear osv-scan - [PR #43792](https://github.com/BerriAI/litellm/pull/43792)
- Bump oauthlib to 4.0.0 to clear osv-scan - [PR #43899](https://github.com/BerriAI/litellm/pull/43899)
- Bump gitpython and tornado, extend diskcache osv ignore to Nov 1 - [PR #43961](https://github.com/BerriAI/litellm/pull/43961)
- Bump pypdf from 6.16.2 to 6.19.0 - [PR #44033](https://github.com/BerriAI/litellm/pull/44033)

## Documentation Updates

- Point readers to the security announcements mailing list signup - [PR #43713](https://github.com/BerriAI/litellm/pull/43713)

## Tests, CI and Internal Changes

These 98 PRs change tests, CI, contributor tooling, release packaging, or Rust runtime scaffolding that is not yet wired into a user-facing path. They do not change proxy or SDK behavior on their own

<details>
<summary>Tests (48)</summary>

- Typed per-test metadata for the e2e suite - [PR #42044](https://github.com/BerriAI/litellm/pull/42044)
- Record each e2e test's steps, starting with ProxyClient - [PR #42393](https://github.com/BerriAI/litellm/pull/42393)
- Resolve the blank-S3 gateway repo root from the litellm package location - [PR #42911](https://github.com/BerriAI/litellm/pull/42911)
- Pin async 5xx retry through the production AsyncHTTPHandler - [PR #43080](https://github.com/BerriAI/litellm/pull/43080)
- Move tests into active CI selection - [PR #43235](https://github.com/BerriAI/litellm/pull/43235)
- Pin the team-admin status-code matrix across every management route - [PR #43249](https://github.com/BerriAI/litellm/pull/43249)
- Pin server resolution and authorization behavior - [PR #43261](https://github.com/BerriAI/litellm/pull/43261)
- Classify every credential-bearing param for the canary suite - [PR #43298](https://github.com/BerriAI/litellm/pull/43298)
- Credential canary suite harness - [PR #43300](https://github.com/BerriAI/litellm/pull/43300)
- Sweep proxy logs, metrics, a Datadog intake and the Logs drawer for credential canaries - [PR #43306](https://github.com/BerriAI/litellm/pull/43306)
- Request-path credential canary slots D1-D4 - [PR #43307](https://github.com/BerriAI/litellm/pull/43307)
- Credential canary slots for MCP and pass-through credentials - [PR #43308](https://github.com/BerriAI/litellm/pull/43308)
- Stored-config credential canary slots - [PR #43309](https://github.com/BerriAI/litellm/pull/43309)
- Drain the logging worker after each logging callback test so no later test inherits its events - [PR #43344](https://github.com/BerriAI/litellm/pull/43344)
- Stop VCR recording and replaying a test's own localhost upstream - [PR #43346](https://github.com/BerriAI/litellm/pull/43346)
- Group /v1/messages contracts under tests/integration/messages_endpoint - [PR #43352](https://github.com/BerriAI/litellm/pull/43352)
- Remove substring guard test_default_api_base - [PR #43355](https://github.com/BerriAI/litellm/pull/43355)
- Native /v1/messages reasoning integration tests built on a captured Claude Code request - [PR #43361](https://github.com/BerriAI/litellm/pull/43361)
- Read management routes back from the control plane replicas - [PR #43373](https://github.com/BerriAI/litellm/pull/43373)
- Assert the usage the Gemma responses stream actually reports - [PR #43422](https://github.com/BerriAI/litellm/pull/43422)
- Enforce shared upstream error contract in wheel checks - [PR #43520](https://github.com/BerriAI/litellm/pull/43520)
- Pin org-admin status codes in the team-admin matrix - [PR #43592](https://github.com/BerriAI/litellm/pull/43592)
- Callback credential canary slots C1-C3 and D5 - [PR #43630](https://github.com/BerriAI/litellm/pull/43630)
- Refresh retired OpenAI tool-call models - [PR #43676](https://github.com/BerriAI/litellm/pull/43676)
- Accept regional aliases that inherit Converse routing - [PR #43785](https://github.com/BerriAI/litellm/pull/43785)
- Repair MCP Responses and budget fixtures - [PR #43788](https://github.com/BerriAI/litellm/pull/43788)
- Settle the shared logging worker before recording shadow callbacks - [PR #43847](https://github.com/BerriAI/litellm/pull/43847)
- Repair completion, SAIL, and spend-log fixtures - [PR #43902](https://github.com/BerriAI/litellm/pull/43902)
- Restore the AWS env after a failed live call in the auth tests - [PR #43921](https://github.com/BerriAI/litellm/pull/43921)
- Refresh qualified retired OpenAI fixtures - [PR #43938](https://github.com/BerriAI/litellm/pull/43938)
- Scope user_api_key_auth overrides in proxy_server tests - [PR #43952](https://github.com/BerriAI/litellm/pull/43952)
- Repair stale tests and move retired OpenAI text-completion fixtures - [PR #43958](https://github.com/BerriAI/litellm/pull/43958)
- Repair stale tests and flaky CI infrastructure - [PR #43983](https://github.com/BerriAI/litellm/pull/43983)
- Migrate DB and Redis backed proxy tests into tests/integration - [PR #43996](https://github.com/BerriAI/litellm/pull/43996)
- Move auth, hooks, policy_engine and client tests into tests/unit/proxy - [PR #43998](https://github.com/BerriAI/litellm/pull/43998)
- Move management_endpoints, management_helpers and guardrails tests into tests/unit/proxy - [PR #44003](https://github.com/BerriAI/litellm/pull/44003)
- Move utils, agent_endpoints and endpoint tests into tests/unit/proxy - [PR #44006](https://github.com/BerriAI/litellm/pull/44006)
- Inject the HIBP client and the MCP loop clock so two backend tests stop flaking - [PR #44007](https://github.com/BerriAI/litellm/pull/44007)
- Move proxy_server, _experimental and db tests into tests/unit/proxy - [PR #44012](https://github.com/BerriAI/litellm/pull/44012)
- Move middleware, spend_tracking, pass_through, common_utils and root proxy tests into tests/unit/proxy - [PR #44015](https://github.com/BerriAI/litellm/pull/44015)
- Delete the legacy proxy test tree and shard tests/unit/proxy by glob - [PR #44018](https://github.com/BerriAI/litellm/pull/44018)
- Bill Sail windows that synchronous calls can still use - [PR #44058](https://github.com/BerriAI/litellm/pull/44058)
- Run the db push timeout hint test without a database URL - [PR #44073](https://github.com/BerriAI/litellm/pull/44073)
- Keep 1ms-timeout deployments off the provider cache - [PR #44082](https://github.com/BerriAI/litellm/pull/44082)
- Move live-provider legacy tests into tests/e2e - [PR #44120](https://github.com/BerriAI/litellm/pull/44120)
- Move legacy proxy, router and Redis tests into tests/integration - [PR #44128](https://github.com/BerriAI/litellm/pull/44128)
- Assert a saved Straiker api_version v1 with an `sk_agt_` key routes to v3 - [PR #44153](https://github.com/BerriAI/litellm/pull/44153)
- Repair stale and polluting tests red on scheduled main CI - [PR #44229](https://github.com/BerriAI/litellm/pull/44229)

</details>

<details>
<summary>CI (3)</summary>

- Fail on new unbounded SQL IN lists and add a Prisma chunking helper - [PR #42629](https://github.com/BerriAI/litellm/pull/42629)
- Sync the weekly release cycle with Linear releases - [PR #43636](https://github.com/BerriAI/litellm/pull/43636)
- Test Redis behavior against local Redis and print short tracebacks - [PR #44062](https://github.com/BerriAI/litellm/pull/44062)

</details>

<details>
<summary>Code quality and contributor tooling (19)</summary>

- Daily fresh tech debt cleanup, rolling PR (2026-09-25) - [PR #43151](https://github.com/BerriAI/litellm/pull/43151)
- Add shared server resolver without changing callers - [PR #43262](https://github.com/BerriAI/litellm/pull/43262)
- Replace Any with proven types in 5 files - [PR #43304](https://github.com/BerriAI/litellm/pull/43304)
- Add the backport-stable label only for a P0 regression - [PR #43351](https://github.com/BerriAI/litellm/pull/43351)
- Answer every team access check with TeamAccess.allows - [PR #43364](https://github.com/BerriAI/litellm/pull/43364)
- Consolidate hub publication predicate - [PR #43394](https://github.com/BerriAI/litellm/pull/43394)
- Clean up fresh tech debt from 2026-09-27 - [PR #43538](https://github.com/BerriAI/litellm/pull/43538)
- Replace Any with proven types in 8 files - [PR #43551](https://github.com/BerriAI/litellm/pull/43551)
- Drop UI, migration, and CODEOWNERS self owners - [PR #43653](https://github.com/BerriAI/litellm/pull/43653)
- Clean up fresh tech debt from 2026-09-28 - [PR #43674](https://github.com/BerriAI/litellm/pull/43674)
- Replace Any with proven types in 7 files - [PR #43704](https://github.com/BerriAI/litellm/pull/43704)
- Clean up fresh tech debt from 2026-09-29 - [PR #43830](https://github.com/BerriAI/litellm/pull/43830)
- Replace Any with proven types in 7 files - [PR #43844](https://github.com/BerriAI/litellm/pull/43844)
- Remove the LIT002 mutable-construction rule - [PR #43971](https://github.com/BerriAI/litellm/pull/43971)
- Clean up fresh tech debt from 2026-09-30 - [PR #43993](https://github.com/BerriAI/litellm/pull/43993)
- Point mcp_server test references at tests/unit/proxy - [PR #44055](https://github.com/BerriAI/litellm/pull/44055)
- Drop unused pytest-postgresql dev dependency - [PR #44056](https://github.com/BerriAI/litellm/pull/44056)
- Split the KeyActivityPanel condition chains to bring the lint budget back under its ceiling - [PR #44114](https://github.com/BerriAI/litellm/pull/44114)
- Remove banner comments, restating comments and dead in_loop_thread - [PR #44161](https://github.com/BerriAI/litellm/pull/44161)

</details>

<details>
<summary>Rust runtime internals (22)</summary>

- Add the openai_like chat config foundation - [PR #43379](https://github.com/BerriAI/litellm/pull/43379)
- Share anthropic types, request helpers, and streaming contracts across crates - [PR #43426](https://github.com/BerriAI/litellm/pull/43426)
- Expand gateway configuration parsing - [PR #43460](https://github.com/BerriAI/litellm/pull/43460)
- Share call lifecycle across route-owned inference - [PR #43461](https://github.com/BerriAI/litellm/pull/43461)
- Add the HTTP host driver - [PR #43462](https://github.com/BerriAI/litellm/pull/43462)
- Use shared execution in gateway inference - [PR #43463](https://github.com/BerriAI/litellm/pull/43463)
- Support the HTTP Responses API - [PR #43464](https://github.com/BerriAI/litellm/pull/43464)
- Connect Python inference bindings to shared routes - [PR #43465](https://github.com/BerriAI/litellm/pull/43465)
- Add structured route lifecycle tracing - [PR #43466](https://github.com/BerriAI/litellm/pull/43466)
- Separate gateway authentication and authorization - [PR #43467](https://github.com/BerriAI/litellm/pull/43467)
- Add virtual key storage contracts - [PR #43468](https://github.com/BerriAI/litellm/pull/43468)
- Add gateway UI login and sessions - [PR #43469](https://github.com/BerriAI/litellm/pull/43469)
- Add the MCP gateway - [PR #43470](https://github.com/BerriAI/litellm/pull/43470)
- Package the gateway container - [PR #43471](https://github.com/BerriAI/litellm/pull/43471)
- Add litellm-db and litellm-db-testing workspace scaffolding - [PR #43504](https://github.com/BerriAI/litellm/pull/43504)
- Remove delivery routing abstraction - [PR #43514](https://github.com/BerriAI/litellm/pull/43514)
- Centralize host execution and compose callbacks - [PR #43515](https://github.com/BerriAI/litellm/pull/43515)
- Select Rust caching through explicit cache objects - [PR #43601](https://github.com/BerriAI/litellm/pull/43601)
- Orchestrate Messages route execution - [PR #43719](https://github.com/BerriAI/litellm/pull/43719)
- Add shared llms wire type derives - [PR #43730](https://github.com/BerriAI/litellm/pull/43730)
- Centralize Python bridge execution wrappers - [PR #43871](https://github.com/BerriAI/litellm/pull/43871)
- Embed migration folders with a shared migrate! macro - [PR #44104](https://github.com/BerriAI/litellm/pull/44104)

</details>

<details>
<summary>Reverts of unreleased changes (2)</summary>

- Revert the server-side Team Usage export beyond the top-N key cap, which never shipped in a stable release - [PR #43376](https://github.com/BerriAI/litellm/pull/43376)
- Revert team key search beyond the top-N in the Team usage view, which never shipped in a stable release - [PR #43377](https://github.com/BerriAI/litellm/pull/43377)

</details>

<details>
<summary>Release and packaging (4)</summary>

- Bump litellm-enterprise 0.1.71 -&gt; 0.1.72, litellm-proxy-extras 0.4.102 -&gt; 0.4.103, litellm 1.104.0 -&gt; 1.105.0 - [PR #43789](https://github.com/BerriAI/litellm/pull/43789)
- Bump litellm-enterprise 0.1.72 -&gt; 0.1.73, litellm-proxy-extras 0.4.103 -&gt; 0.4.104 - [PR #44126](https://github.com/BerriAI/litellm/pull/44126)
- Bump litellm-proxy-extras 0.4.104 -&gt; 0.4.105 - [PR #44235](https://github.com/BerriAI/litellm/pull/44235)
- Rebuild the Admin UI bundle on rc/1.105.0 - [PR #44386](https://github.com/BerriAI/litellm/pull/44386)

</details>

### PR roll-up by ownership area

Customer-facing PRs in rc.1: **238**. Tests, CI and internal PRs: **98**. Total: **336**

- Models & Providers: 81
- Logging & Tracing: 36
- LLM API Endpoints: 27
- Performance: 26
- Auth & Management: 19
- Guardrails: 15
- UI: 13
- MCP: 10
- Spend / Budgets / Rate Limits: 10
- Docs: 1

## New Contributors

- [@4refael](https://github.com/4refael) made their first contribution in [PR #41826](https://github.com/BerriAI/litellm/pull/41826)
- [@agustin18](https://github.com/agustin18) made their first contribution in [PR #43319](https://github.com/BerriAI/litellm/pull/43319)
- [@ankit373](https://github.com/ankit373) made their first contribution in [PR #43553](https://github.com/BerriAI/litellm/pull/43553)
- [@daqiangganjun](https://github.com/daqiangganjun) made their first contribution in [PR #38172](https://github.com/BerriAI/litellm/pull/38172)
- [@DeviaVir](https://github.com/DeviaVir) made their first contribution in [PR #43558](https://github.com/BerriAI/litellm/pull/43558)
- [@fedaeho](https://github.com/fedaeho) made their first contribution in [PR #43512](https://github.com/BerriAI/litellm/pull/43512)
- [@Flexomatic81](https://github.com/Flexomatic81) made their first contribution in [PR #43588](https://github.com/BerriAI/litellm/pull/43588)
- [@galovics](https://github.com/galovics) made their first contribution in [PR #42949](https://github.com/BerriAI/litellm/pull/42949)
- [@hsm207](https://github.com/hsm207) made their first contribution in [PR #43536](https://github.com/BerriAI/litellm/pull/43536)
- [@shoemoney](https://github.com/shoemoney) made their first contribution in [PR #38049](https://github.com/BerriAI/litellm/pull/38049)
- [@shrey-berri](https://github.com/shrey-berri) made their first contribution in [PR #43221](https://github.com/BerriAI/litellm/pull/43221)
- [@stewartpark](https://github.com/stewartpark) made their first contribution in [PR #43147](https://github.com/BerriAI/litellm/pull/43147)
- [@YaseenBashaT](https://github.com/YaseenBashaT) made their first contribution in [PR #43197](https://github.com/BerriAI/litellm/pull/43197)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.104.0-rc.1...v1.105.0-rc.1
