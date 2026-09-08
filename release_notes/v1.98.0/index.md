---
title: "v1.98.0 - Provisioned Throughput Billing, Shadow Evals & Routing Groups"
slug: "v1-98-0"
date: 2026-08-22T00:00:00
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
docker.litellm.ai/berriai/litellm:1.98.0
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.98.0
```

</TabItem>
</Tabs>

:::danger Breaking Changes

**The Langfuse metadata blob is now sourced from the StandardLoggingPayload allowlist instead of raw request metadata.** Roughly 20 fields no longer appear on the generation, measured live at 52 keys down to 38, so any saved Langfuse filter, dashboard, or alert built on `model_group`, `model_info`, `deployment`, `deployment_model_name`, `model_group_alias`, `model_group_size`, `litellm_api_version`, `litellm_received_at`, `litellm_parent_otel_span`, `queue_time_seconds`, `attempted_retries`, `max_retries`, `agent_id`, `caller_tags`, `inherited_tags`, `global_max_parallel_requests`, `user_api_key`, or the remaining `user_api_key_*` budget and permission-id fields will stop matching. `model_group` and the deployment id are still recoverable from `hidden_params`. Direct-SDK callers passing flat custom metadata must nest it, `metadata={"metadata": {"my_key": "v"}}`, and it arrives under `requester_metadata`; proxy callers are unaffected. `debug_langfuse` now emits caller scalars rather than the raw metadata dump. See [PR #36744](https://github.com/BerriAI/litellm/pull/36744).

**The Global Control Plane worker registry now requires an Enterprise license.** A proxy configured with `worker_registry` and no valid `LITELLM_LICENSE` refuses to boot instead of silently running unlicensed. Set a valid license to keep the control plane, or remove the `worker_registry` key to start without it. See [PR #36996](https://github.com/BerriAI/litellm/pull/36996).

**A `litellm_settings.callbacks` entry whose dotted path names a class now fails config load.** Those entries used to be accepted and silently inert: the proxy booted, served traffic, and never ran the hook. Point the entry at an instance or a function, for example `custom_callbacks.proxy_handler_instance`, to start again. See [PR #36858](https://github.com/BerriAI/litellm/pull/36858).

:::

## Key Highlights

- **Reserved capacity is billed as reserved capacity** - a deployment can now carry `ptu_count` and `cost_per_ptu_per_hour` with an effective window, the daily rollup writes per-model flat cost by active hour, and per-token billing is switched off entirely on that deployment so a team paying for provisioned throughput is no longer charged twice for the same traffic. Attribution is opt-in behind an env var, and a price sent alongside PTU config is rejected with a 400
- **You can measure the auto-router before you adopt it** - a shadow eval job samples a slice of one key's successful traffic, replays it through the auto-router in a detached task that never serves a response or adds latency, and has an LLM judge compare both answers blind with randomized A/B labels. Counts, status, judge spend, and win rates by tier and incumbent model are all derived at read time from one append-only row per sample, and the job also runs in reverse
- **Routing groups are callable models** - `model=<group_name>` now routes across the union of member deployments using the group's own strategy, group names appear in `/v1/models` so Claude Code and Codex discovery surface them, and they are grantable on keys and teams. The Create Group modal has promised this since day one
- **Every response can state its own cost breakdown** - six `x-litellm-response-cost-*` headers ship next to the total, where input, cache read, cache creation, output, and tool usage sum exactly to the total and reasoning is a subset of output, so a platform team attributes spend per component with no local pricing table
- **TPM reservations follow declared output size** - expected output tokens are now declarable per key, per team, and per model instead of one static floor for every tenant, so concurrent requests stop overrunning a team's TPM limit and teams whose models emit far less stop being throttled. No config means byte-identical behavior and no migration
- **The Admin UI's move off antd and Tremor took its largest step yet** - 75 UI pull requests in this window carry the navbar, playground, guardrails, usage, cost tracking, models and endpoints, team and user surfaces, the log details drawer, the AI Hub, and much of the shared component library onto shadcn (base-vega) primitives. The migration is not finished; both libraries remain dependencies and still back parts of the dashboard

## New Providers and Endpoints

### New Providers (1 new provider)

| Provider | Supported LiteLLM Endpoints | Description |
| --- | --- | --- |
| Nimble | `/search` | Nimble's Search API as the 18th native search provider, registered in the provider enum, config map, pricing map, and dashboard, priced at $0.005 per query |

### New LLM API Endpoints (2 new endpoints)

| Endpoint | Method | Description | Documentation |
| --- | --- | --- | --- |
| `/v1/indexes` | GET | Admin-only listing of every registered vector store index, newest first, so indexes created through `POST /v1/indexes` can be audited | [Vector Stores](../../docs/completion/knowledgebase) |
| `/auto_router/shadow_eval/{start,stop,{job_id}}` | POST, GET | Start, stop, and read a pre-adoption shadow eval job for an auto-router, returning derived counts, judge spend, latest error, and win rates | [Auto Router](../../docs/adaptive_router) |

## New Models / Updated Models

#### New Model Support (52 new models)

| Provider | Model | Context Window | Input ($/1M tokens) | Output ($/1M tokens) | Features |
| --- | --- | --- | --- | --- | --- |
| Anthropic | `claude-mythos-5` | 1M | $10.00 | $50.00 | Reasoning, adaptive thinking, xhigh and max reasoning effort, vision, PDF input, computer use, function calling, tool choice, prompt caching, response schema, output config |
| Anthropic | `claude-mythos-preview` | 1M | $10.00 | $50.00 | Reasoning, adaptive thinking, xhigh and max reasoning effort, vision, PDF input, computer use, function calling, tool choice, prompt caching, response schema, output config |
| OpenAI | `gpt-transcribe` | - | - | - | Audio transcription, $0.000075 per second |
| OpenAI | `gpt-live-transcribe` | - | - | - | Audio transcription, $0.00028333 per second |
| OpenAI | `gpt-realtime-translate` | 16K | - | - | Realtime, audio input and output, $0.00056667 per second |
| Google Gemini | `gemini/gemini-3.7-flash` | 1M | $0.75 | $3.75 | Reasoning, vision, audio input, video input, PDF input, function calling, parallel function calling, tool choice, prompt caching, response schema, web search, URL context, native streaming |
| Google Gemini | `gemini/gemini-3.1-flash-tts-preview` | 8K | $1.00 | $20.00 | Audio speech |
| Google Gemini | `gemini/gemini-robotics-er-2-streaming-preview` | - | $2.00 | $10.00 | Vision, audio input, video input, function calling, web search |
| Google Vertex AI | `vertex_ai/gemini-3.7-flash` | 1M | $0.75 | $3.75 | Reasoning, vision, audio input, video input, PDF input, function calling, parallel function calling, tool choice, prompt caching, response schema, web search, URL context, native streaming |
| Google Vertex AI | `gemini-3.7-flash` | 1M | $0.75 | $3.75 | Reasoning, vision, audio input, video input, PDF input, function calling, parallel function calling, tool choice, prompt caching, response schema, web search, URL context, native streaming |
| xAI | `xai/grok-4.6` | 500K | $2.00 | $6.00 | Reasoning, vision, function calling, tool choice, prompt caching, response schema, web search, above-200K tier pricing |
| xAI | `xai/grok-build-0.1` | 256K | $1.00 | $2.00 | Reasoning, vision, function calling, tool choice, prompt caching, response schema, above-200K tier pricing |
| xAI | `xai/grok-4.20-0309-non-reasoning` | 1M | $1.25 | $2.50 | Vision, function calling, tool choice, prompt caching, response schema, web search |
| xAI | `xai/grok-4.20-multi-agent-0309` | 1M | $1.25 | $2.50 | Reasoning, vision, function calling, tool choice, prompt caching, response schema, web search |
| Mistral | `mistral/mistral-small-2603` | 262K | $0.15 | $0.60 | Reasoning, function calling, tool choice, response schema, assistant prefill |
| Mistral | `mistral/labs-leanstral-1-5` | 262K | $0.00 | $0.00 | Function calling, tool choice, response schema |
| Mistral | `mistral/mistral-moderation-2603` | 131K | $0.00 | $0.00 | Moderation |
| Mistral | `mistral/voxtral-mini-2602` | - | - | - | Audio transcription, $0.00005 per second |
| Mistral | `mistral/voxtral-mini-transcribe-realtime-2602` | - | - | - | Audio transcription, $0.0001 per second |
| Mistral | `mistral/voxtral-mini-tts-2603` | - | - | - | Audio speech, $0.000016 per output character |
| Groq | `groq/qwen/qwen3.6-27b` | 131K | $0.60 | $3.00 | Reasoning, vision, function calling, tool choice |
| Groq | `groq/meta-llama/llama-prompt-guard-2-22m` | 512 | $0.03 | $0.03 | Chat |
| Groq | `groq/meta-llama/llama-prompt-guard-2-86m` | 512 | $0.04 | $0.04 | Chat |
| Groq | `groq/canopylabs/orpheus-v1-english` | 4K | - | - | Audio speech, $0.000022 per character |
| Groq | `groq/canopylabs/orpheus-arabic-saudi` | 4K | - | - | Audio speech, $0.00004 per character |
| Meta | `meta/muse-spark-1.2` | 1M | $1.25 | $4.25 | Reasoning, minimal and xhigh reasoning effort, vision, PDF input, function calling, parallel function calling, tool choice, prompt caching, response schema, web search |
| Meta | `meta/muse-spark-1.2-contributor` | 1M | $0.10 | $0.20 | Reasoning, minimal and xhigh reasoning effort, vision, PDF input, function calling, parallel function calling, tool choice, prompt caching, response schema, web search |
| Azure AI | `azure_ai/grok-4.3` | 200K | $1.25 | $2.50 | Reasoning, vision, function calling, tool choice, prompt caching, response schema, web search |
| Azure AI | `azure_ai/FW-DeepSeek-V3.2` | 164K | $0.62 | $1.85 | Reasoning, function calling, tool choice, prompt caching |
| Azure AI | `azure_ai/FW-DeepSeek-V4-Pro` | 1M | $1.925 | $3.828 | Reasoning, function calling, tool choice, prompt caching |
| Azure AI | `azure_ai/FW-GLM-5` | 200K | $1.10 | $3.52 | Reasoning, function calling, tool choice, prompt caching |
| Azure AI | `azure_ai/FW-GLM-5.1` | 203K | $1.54 | $4.84 | Reasoning, function calling, tool choice, prompt caching |
| Azure AI | `azure_ai/FW-GLM-5.2` | 1M | $1.54 | $4.84 | Reasoning, function calling, tool choice, prompt caching |
| Azure AI | `azure_ai/FW-GLM-5.2-Fast` | 1M | $2.10 | $6.60 | Reasoning, function calling, tool choice, prompt caching |
| Azure AI | `azure_ai/FW-Inkling` | 1M | $1.00 | $4.05 | Reasoning, function calling, tool choice, prompt caching |
| Azure AI | `azure_ai/FW-Kimi-K2.5` | 262K | $0.66 | $3.30 | Reasoning, vision, function calling, tool choice, prompt caching |
| Azure AI | `azure_ai/FW-Kimi-K2.6` | 262K | $1.045 | $4.40 | Reasoning, vision, function calling, tool choice, prompt caching |
| Azure AI | `azure_ai/FW-Kimi-K2.7-Code` | 262K | $1.05 | $4.40 | Reasoning, vision, function calling, tool choice, prompt caching |
| Azure AI | `azure_ai/FW-Kimi-K3` | 1M | $3.30 | $16.50 | Reasoning, vision, function calling, tool choice, prompt caching |
| Azure AI | `azure_ai/FW-MiniMax-M2.5` | 1M | $0.33 | $1.32 | Reasoning, function calling, tool choice, prompt caching |
| Azure AI | `azure_ai/FW-MiniMax-M3` | 512K | $0.33 | $1.32 | Reasoning, vision, function calling, tool choice, prompt caching |
| Azure AI | `azure_ai/FW-Nemotron-3-Ultra-NVFP4` | 262K | $0.60 | $2.40 | Reasoning, function calling, tool choice, prompt caching |
| DashScope | `dashscope/deepseek-v4-flash` | 1M | $0.20 | $0.40 | Reasoning, function calling, tool choice, prompt caching, response schema |
| DashScope | `dashscope/deepseek-v4-flash-0731` | 1M | $0.20 | $0.40 | Reasoning, function calling, tool choice, prompt caching, response schema |
| DashScope | `dashscope/deepseek-v4-pro` | 1M | $2.40 | $4.80 | Reasoning, function calling, tool choice, prompt caching, response schema |
| DashScope | `dashscope/glm-5.1` | 203K | $1.40 | $4.40 | Reasoning, function calling, tool choice, prompt caching, response schema |
| DashScope | `dashscope/glm-5.2` | 1M | $1.40 | $4.40 | Reasoning, function calling, tool choice, prompt caching, response schema |
| DashScope | `dashscope/kimi-k2.7-code` | 229K | $0.95 | $4.00 | Reasoning, vision, function calling, tool choice, prompt caching, response schema |
| DashScope | `dashscope/qwen3.8-max` | 992K | $2.00 | $6.00 | Reasoning, vision, function calling, tool choice, prompt caching, response schema |
| DeepInfra | `deepinfra/nvidia/NVIDIA-Nemotron-3.5-Lightning` | 262K | $0.05 | $0.20 | Reasoning, function calling, tool choice |
| OpenRouter | `openrouter/nvidia/nemotron-3.5-lightning` | 262K | $0.05 | $0.20 | Reasoning, function calling, tool choice |
| Nimble | `nimble/search` | - | - | - | Search, $0.005 per query |

Beyond the new entries, this release is a large cost-map maintenance pass: 270 existing entries gain or correct a provider-announced `deprecation_date` across Bedrock, Mistral, Cohere, Gemini, OpenAI, and xAI, and 85 gain a `search_context_cost_per_query` block. xAI pricing is corrected in both directions: the `grok-4.20` reasoning and non-reasoning variants drop from $2.00 / $6.00 to $1.25 / $2.50 per 1M and their context window is corrected from 2M to 1M, while `grok-code-fast` rises from $0.20 / $1.50 to $1.00 / $2.00. The Bedrock Mantle `openai.gpt-5.6-sol`, `-terra`, and `-luna` entries move from a 272K to a 1M context window with matching above-272K tiers, `gpt-5-pro` max output rises from 128K to 272K, the DeepSeek V4 entries go from 8K to 393K max output, and the Groq `llama-3.1-8b-instant`, `llama-3.3-70b-versatile`, and `gpt-oss` entries are resynced with Groq's own docs. Native structured output is flagged on 17 entries, `supports_tool_search` on 43, and reasoning-effort flags on a further 29. No pricing entries were removed.

#### Features

- **[Fireworks AI](../../docs/providers/fireworks_ai)**
    - Support router slugs via the `routers/` prefix - [PR #34257](https://github.com/BerriAI/litellm/pull/34257)
    - Translate NIM and vLLM extra params to Fireworks-native arguments - [PR #35969](https://github.com/BerriAI/litellm/pull/35969)
- **[Azure AI](../../docs/providers/azure_ai)**
    - Add Fireworks FW model pricing on Azure AI Foundry and Grok 4.3 metadata - [PR #35613](https://github.com/BerriAI/litellm/pull/35613), [PR #27932](https://github.com/BerriAI/litellm/pull/27932)
- **[Google Gemini](../../docs/providers/gemini)**
    - Day-0 pricing for `gemini-3.7-flash` - [PR #36792](https://github.com/BerriAI/litellm/pull/36792)
- **[xAI](../../docs/providers/xai)**
    - Day-0 pricing for `grok-4.6` - [PR #36805](https://github.com/BerriAI/litellm/pull/36805)
- **[DashScope](../../docs/providers/dashscope)**
    - Add the latest Model Studio models to the cost map - [PR #36496](https://github.com/BerriAI/litellm/pull/36496)
- **[Meta](../../docs/providers/meta_llama)**
    - Add `meta/muse-spark-1.2` and its contributor tier - [PR #36717](https://github.com/BerriAI/litellm/pull/36717)
- **[OpenRouter](../../docs/providers/openrouter)**
    - Add NVIDIA Nemotron 3.5 Lightning on OpenRouter and DeepInfra - [PR #36696](https://github.com/BerriAI/litellm/pull/36696)
- **[OpenAI](../../docs/providers/openai)**
    - Enable xhigh reasoning support for the `gpt-5.4-mini` models - [PR #26909](https://github.com/BerriAI/litellm/pull/26909)

### Bug Fixes

- **[Amazon Bedrock](../../docs/providers/bedrock)**
    - Use the deployment's credentials for AWS requests, and resolve aliases in batch file records - [PR #36160](https://github.com/BerriAI/litellm/pull/36160), [PR #36159](https://github.com/BerriAI/litellm/pull/36159)
    - Resolve the managed-batch output bucket on every path that reads it, and stop managed-batch `litellm_params` leaking to the provider - [PR #37047](https://github.com/BerriAI/litellm/pull/37047), [PR #37048](https://github.com/BerriAI/litellm/pull/37048)
    - Drop `toolSpec.strict` for Claude Sonnet 5 on Converse - [PR #33196](https://github.com/BerriAI/litellm/pull/33196)
    - Add a text block to Converse user messages carrying documents - [PR #36499](https://github.com/BerriAI/litellm/pull/36499)
    - Send the tool-search beta header for Haiku 4.5 on Invoke `/v1/messages` - [PR #36502](https://github.com/BerriAI/litellm/pull/36502)
    - Preserve adaptive thinking effort through the `/v1/messages` bridge - [PR #36507](https://github.com/BerriAI/litellm/pull/36507)
    - Hoist `custom.defer_loading` before dropping `custom` on invoke tools - [PR #36855](https://github.com/BerriAI/litellm/pull/36855)
    - Reject the Anthropic server-side `web_search` tool with an actionable error instead of a provider failure - [PR #36473](https://github.com/BerriAI/litellm/pull/36473)
    - Enable native structured output for GLM 5 and DeepSeek V3.2, and advertise it on every Bedrock id - [PR #35669](https://github.com/BerriAI/litellm/pull/35669), [PR #36597](https://github.com/BerriAI/litellm/pull/36597)
    - Give the Bedrock Mantle GPT-5.6 Sol, Terra, and Luna entries a 1M context window with long-context pricing - [PR #36698](https://github.com/BerriAI/litellm/pull/36698)
- **[Anthropic](../../docs/providers/anthropic)**
    - Preserve midturn system corrections - [PR #34290](https://github.com/BerriAI/litellm/pull/34290)
    - Preserve `speed=fast` in usage for `/v1/messages` and pass-through - [PR #36447](https://github.com/BerriAI/litellm/pull/36447)
    - Flag native structured outputs on Anthropic-direct `claude-sonnet-5` and `claude-haiku-4-5` - [PR #35930](https://github.com/BerriAI/litellm/pull/35930)
- **[Google Vertex AI](../../docs/providers/vertex)**
    - Translate `/v1/embeddings` batch rows to the Gemini embedding shape - [PR #35092](https://github.com/BerriAI/litellm/pull/35092)
- **[Azure AI](../../docs/providers/azure_ai)**
    - Recognize real Search doc endpoints so teams can read and write through passthrough - [PR #36798](https://github.com/BerriAI/litellm/pull/36798)
- **[Databricks](../../docs/providers/databricks)**
    - Surface provider usage, including prompt-cache counts, in streaming chunks - [PR #36943](https://github.com/BerriAI/litellm/pull/36943)
- **[NVIDIA NIM](../../docs/providers/nvidia_nim)**
    - Preserve image passages and stop sending `top_k` to `/v1/ranking` - [PR #34177](https://github.com/BerriAI/litellm/pull/34177)
- **[Groq](../../docs/providers/groq)**
    - Sync the Groq registry with Groq's docs - [PR #36664](https://github.com/BerriAI/litellm/pull/36664)
- **[OpenAI](../../docs/providers/openai)**
    - Return a length-truncated 200 when the output budget fits no token - [PR #36859](https://github.com/BerriAI/litellm/pull/36859)
- **General**
    - Ship boto3 with the base SDK so Bedrock works out of the box on `pip install litellm` - [PR #36568](https://github.com/BerriAI/litellm/pull/36568)
    - Let an explicit provider outrank a known OpenAI model name - [PR #36800](https://github.com/BerriAI/litellm/pull/36800)
    - Refresh deprecation dates, correct xAI pricing, add missing provider models, and correct DeepSeek V4 max output - [PR #36403](https://github.com/BerriAI/litellm/pull/36403), [PR #36538](https://github.com/BerriAI/litellm/pull/36538), [PR #36788](https://github.com/BerriAI/litellm/pull/36788), [PR #36925](https://github.com/BerriAI/litellm/pull/36925)

## LLM API Endpoints

#### Features

- **[Anthropic `/v1/messages`](../../docs/anthropic_unified)**
    - Serve an Anthropic-native `/v1/models` so Claude Code's gateway discovery populates its model picker - [PR #35455](https://github.com/BerriAI/litellm/pull/35455)
- **[Vector Stores](../../docs/completion/knowledgebase)**
    - Admin-only `GET /v1/indexes` listing every registered vector store index - [PR #36289](https://github.com/BerriAI/litellm/pull/36289)

#### Bugs

- **[Responses API](../../docs/response_api)**
    - Preserve Codex namespace tool calls - [PR #32536](https://github.com/BerriAI/litellm/pull/32536)
    - Initialize `completed_response` on the bridge streaming iterator - [PR #35413](https://github.com/BerriAI/litellm/pull/35413)
    - Map interaction step and turn history onto Responses API roles and content types - [PR #36733](https://github.com/BerriAI/litellm/pull/36733)
- **[Batches](../../docs/batches)**
    - Stop forwarding `custom_llm_provider` twice in list and cancel - [PR #32813](https://github.com/BerriAI/litellm/pull/32813)
- **[Managed files](../../docs/files_endpoints)**
    - Stop `/{provider}/v1/files` capturing `/openai_passthrough` - [PR #36092](https://github.com/BerriAI/litellm/pull/36092)
    - Scope file list pagination cursors to the caller, and report `has_more` false on caller-scoped pages - [PR #36093](https://github.com/BerriAI/litellm/pull/36093), [PR #36326](https://github.com/BerriAI/litellm/pull/36326)
- **[Passthrough](../../docs/pass_through/anthropic_completion)**
    - Stop forwarding the client's `Accept-Encoding` upstream, which garbled Claude Code's `/v1/models` and `count_tokens` bodies on stock Docker images once Anthropic began brotli-compressing JSON - [PR #37058](https://github.com/BerriAI/litellm/pull/37058)
- **Anthropic `/v1/models`**
    - Always emit the token limits, null when unknown - [PR #36961](https://github.com/BerriAI/litellm/pull/36961)
- **Web search**
    - Stop leaking interception control fields to providers - [PR #36480](https://github.com/BerriAI/litellm/pull/36480)
- **General**
    - Make `tool_result` images visible to OpenAI-compatible providers - [PR #34462](https://github.com/BerriAI/litellm/pull/34462)
    - Stop a bare 429 in an error body outranking the status code in exception mapping - [PR #36705](https://github.com/BerriAI/litellm/pull/36705)

## Management Endpoints / UI

#### Features

- **Virtual Keys**
    - Per-key prompt caching toggle via `enable_prompt_caching`, with an Admin UI switch on key create and edit - [PR #36466](https://github.com/BerriAI/litellm/pull/36466)
    - Add a `config_updated_at` audit timestamp - [PR #36488](https://github.com/BerriAI/litellm/pull/36488)
- **Proxy CLI**
    - Make the hidden `lite` command list configurable through `~/.litellm/config.json` - [PR #36816](https://github.com/BerriAI/litellm/pull/36816)
- **Auto-router screens**
    - Shadow evals tab beside auto-router usage, with a direction picker and reverse-mode display - [PR #36588](https://github.com/BerriAI/litellm/pull/36588), [PR #36994](https://github.com/BerriAI/litellm/pull/36994)
    - Deployment affinity toggle, and models shown under each tier in the routing benchmark chart - [PR #36302](https://github.com/BerriAI/litellm/pull/36302), [PR #36291](https://github.com/BerriAI/litellm/pull/36291)
    - Highlight Auto Router in the navbar announcement - [PR #36315](https://github.com/BerriAI/litellm/pull/36315)
- **Dashboard**
    - Render request metrics on the `/ui/chat` surface, including provider prompt cache tokens in the chat response metrics - [PR #36845](https://github.com/BerriAI/litellm/pull/36845), [PR #36827](https://github.com/BerriAI/litellm/pull/36827)
    - Show vector store indexes on the Vector Stores page - [PR #36306](https://github.com/BerriAI/litellm/pull/36306)
    - Surface PTU inputs on the model form and flat cost on the Usage page - [PR #35393](https://github.com/BerriAI/litellm/pull/35393)
    - Migrate the playground chat controls to shadcn - [PR #36129](https://github.com/BerriAI/litellm/pull/36129)
    - Warn in the Admin UI when no Redis is configured - [PR #36495](https://github.com/BerriAI/litellm/pull/36495)
    - Link user detail team names to their team pages - [PR #37022](https://github.com/BerriAI/litellm/pull/37022)

#### Bugs

- **Auth & roles**
    - Carry team grants in `lite login` session tokens so team-bound CLI users stop seeing the whole proxy on `/v1/models` - [PR #36826](https://github.com/BerriAI/litellm/pull/36826)
    - Expand config-defined model access groups when resolving team models for `/v2/model/info` - [PR #34211](https://github.com/BerriAI/litellm/pull/34211)
    - Treat SAML as configured in UI SSO detection - [PR #36196](https://github.com/BerriAI/litellm/pull/36196)
    - Restore `management_v1` query-param validation under `fastapi>=0.140.7` - [PR #35773](https://github.com/BerriAI/litellm/pull/35773)
- **Teams & access groups**
    - Sync `assigned_team_ids` and `assigned_key_ids` from the team and key write paths - [PR #36825](https://github.com/BerriAI/litellm/pull/36825), [PR #36843](https://github.com/BerriAI/litellm/pull/36843)
    - Sweep dangling team references and cache on team delete - [PR #36819](https://github.com/BerriAI/litellm/pull/36819)
    - Resolve `member_delete` cleanup by user id rather than the addressed email - [PR #36839](https://github.com/BerriAI/litellm/pull/36839)
    - Stop the duplicate legacy invitation email and fix its onboarding link - [PR #36455](https://github.com/BerriAI/litellm/pull/36455)
- **Proxy CLI**
    - Launch agents as a child process on Windows - [PR #36822](https://github.com/BerriAI/litellm/pull/36822)
- **Dashboard**
    - Hide admin-only Logs tabs from roles that cannot call their endpoints, and restore the Deleted Teams tab for organization admins - [PR #36333](https://github.com/BerriAI/litellm/pull/36333), [PR #36478](https://github.com/BerriAI/litellm/pull/36478)
    - Gate organization and agent usage views, policy and prompt lookups, the Old Usage page, and four sidebar pages behind the roles their endpoints allow - [PR #36334](https://github.com/BerriAI/litellm/pull/36334), [PR #36335](https://github.com/BerriAI/litellm/pull/36335), [PR #36469](https://github.com/BerriAI/litellm/pull/36469), [PR #36475](https://github.com/BerriAI/litellm/pull/36475)
    - Scope the Virtual Keys and Logs team lists to the caller - [PR #36472](https://github.com/BerriAI/litellm/pull/36472)
    - Show and edit key-level router settings on a virtual key - [PR #36674](https://github.com/BerriAI/litellm/pull/36674)
    - Stop a deselected MCP server keeping its grant on a virtual key, and match the MCP servers count badge to its sibling permission badges - [PR #36840](https://github.com/BerriAI/litellm/pull/36840), [PR #36984](https://github.com/BerriAI/litellm/pull/36984)
    - Restore playground model filtering by endpoint, keep `mode: completion` models in the chat dropdown, and distinguish hosted from local vLLM in the provider dropdown - [PR #36130](https://github.com/BerriAI/litellm/pull/36130), [PR #37954](https://github.com/BerriAI/litellm/pull/37954), [PR #36974](https://github.com/BerriAI/litellm/pull/36974)
    - Add NVIDIA Riva to the model provider list - [PR #36769](https://github.com/BerriAI/litellm/pull/36769)
    - Align the spend and budget columns, and rename the models table Status column to Source - [PR #35176](https://github.com/BerriAI/litellm/pull/35176), [PR #37021](https://github.com/BerriAI/litellm/pull/37021)
    - Show zeroed auto-router usage stats when a window has no sessions, and open the classifier prompt editor above the edit auto-router form - [PR #36868](https://github.com/BerriAI/litellm/pull/36868), [PR #36438](https://github.com/BerriAI/litellm/pull/36438)
    - Keep the cost tracking removal confirmation open until it settles, de-duplicate the reset budget option, stop the models tab strip scrolling vertically, and anchor chips-combobox popups to the field - [PR #36960](https://github.com/BerriAI/litellm/pull/36960), [PR #37010](https://github.com/BerriAI/litellm/pull/37010), [PR #36993](https://github.com/BerriAI/litellm/pull/36993), [PR #36995](https://github.com/BerriAI/litellm/pull/36995)
- **Dashboard internals: the shadcn migration**
    - Page-level migrations off antd and Tremor: guardrails-monitor, projects and logs, cost-optimization, cost-tracking, admin-panel, team settings, users dashboard, prompts, models-and-endpoints, guardrails, usage, playground, and the AI Hub - [PR #34606](https://github.com/BerriAI/litellm/pull/34606), [PR #36629](https://github.com/BerriAI/litellm/pull/36629), [PR #36631](https://github.com/BerriAI/litellm/pull/36631), [PR #36635](https://github.com/BerriAI/litellm/pull/36635), [PR #36641](https://github.com/BerriAI/litellm/pull/36641), [PR #36642](https://github.com/BerriAI/litellm/pull/36642), [PR #36643](https://github.com/BerriAI/litellm/pull/36643), [PR #36648](https://github.com/BerriAI/litellm/pull/36648), [PR #36832](https://github.com/BerriAI/litellm/pull/36832), [PR #36834](https://github.com/BerriAI/litellm/pull/36834), [PR #36838](https://github.com/BerriAI/litellm/pull/36838), [PR #36847](https://github.com/BerriAI/litellm/pull/36847), [PR #36908](https://github.com/BerriAI/litellm/pull/36908)
    - Navbar, log details drawer, settings page and bulk user invite, key info and permissions views, router settings and shared badges, MCP permission panels, model hub and model select, shared dropdowns and selectors, root-level dashboard components, cost tracking components, shared `common_components`, and ten remaining small files - [PR #36902](https://github.com/BerriAI/litellm/pull/36902), [PR #36904](https://github.com/BerriAI/litellm/pull/36904), [PR #36936](https://github.com/BerriAI/litellm/pull/36936), [PR #36913](https://github.com/BerriAI/litellm/pull/36913), [PR #36915](https://github.com/BerriAI/litellm/pull/36915), [PR #36964](https://github.com/BerriAI/litellm/pull/36964), [PR #36918](https://github.com/BerriAI/litellm/pull/36918), [PR #36924](https://github.com/BerriAI/litellm/pull/36924), [PR #36927](https://github.com/BerriAI/litellm/pull/36927), [PR #36955](https://github.com/BerriAI/litellm/pull/36955), [PR #36910](https://github.com/BerriAI/litellm/pull/36910), [PR #36966](https://github.com/BerriAI/litellm/pull/36966)
    - Log viewer internals: TokenFlow and JsonViewer, SimpleMessageBlock and SimpleToolCallBlock, HistoryTree and CollapsibleMessage, TruncatedValue and OutputCard, SectionHeader and ToolsSection, the guardrail and duration controls, search and user controls, team detail controls, and the policy impact popover - [PR #36735](https://github.com/BerriAI/litellm/pull/36735), [PR #36737](https://github.com/BerriAI/litellm/pull/36737), [PR #36738](https://github.com/BerriAI/litellm/pull/36738), [PR #36739](https://github.com/BerriAI/litellm/pull/36739), [PR #36793](https://github.com/BerriAI/litellm/pull/36793), [PR #36693](https://github.com/BerriAI/litellm/pull/36693), [PR #36694](https://github.com/BerriAI/litellm/pull/36694), [PR #36695](https://github.com/BerriAI/litellm/pull/36695), [PR #36653](https://github.com/BerriAI/litellm/pull/36653)
    - Move the usage, guardrails content, and guardrails monitor tables onto the shared DataTable, make illegal DataTable prop combinations unrepresentable, migrate the access group create modal to RHF and zod, re-sync badge and skeleton onto the base-vega style, and declare `DateRangePickerValue` locally instead of importing it from Tremor - [PR #36707](https://github.com/BerriAI/litellm/pull/36707), [PR #36708](https://github.com/BerriAI/litellm/pull/36708), [PR #36709](https://github.com/BerriAI/litellm/pull/36709), [PR #36470](https://github.com/BerriAI/litellm/pull/36470), [PR #37033](https://github.com/BerriAI/litellm/pull/37033), [PR #36991](https://github.com/BerriAI/litellm/pull/36991), [PR #36962](https://github.com/BerriAI/litellm/pull/36962)

## AI Integrations

### Logging

- **[Langfuse](../../docs/proxy/logging#langfuse)**
    - Source the emitted metadata blob from the StandardLoggingPayload, so a team's own Langfuse credentials stop arriving inside that team's own traces - [PR #36744](https://github.com/BerriAI/litellm/pull/36744)
    - Restrict trace steering keys to real Langfuse trace fields, and coerce header-sourced mask and trace-update steering values - [PR #36862](https://github.com/BerriAI/litellm/pull/36862), [PR #36740](https://github.com/BerriAI/litellm/pull/36740)
    - Emit the OTel trace version and release on the keys Langfuse v4 reads - [PR #36702](https://github.com/BerriAI/litellm/pull/36702)
- **[Arize](../../docs/proxy/logging#arize-ai)**
    - Trace MCP tool calls instead of crashing on `CallToolResult` - [PR #36453](https://github.com/BerriAI/litellm/pull/36453)
- **[Slack alerting](../../docs/proxy/alerting)**
    - Dedupe scheduled Slack spend reports across pods - [PR #36489](https://github.com/BerriAI/litellm/pull/36489)
- **General**
    - Opt-in `session_id` and `trace_id` correlation on JSON log records via contextvars - [PR #34418](https://github.com/BerriAI/litellm/pull/34418)
    - Fail config load when a `callbacks` entry is not dispatchable, instead of booting with a silently inert hook - [PR #36858](https://github.com/BerriAI/litellm/pull/36858)
    - Log requests rejected for an unparsable body in spend logs - [PR #36673](https://github.com/BerriAI/litellm/pull/36673)

### Guardrails

- **[Palo Alto Networks Prisma AIRS](../../docs/proxy/guardrails/panw_prisma_airs)**
    - Return the full scan response on blocked requests, surface `scan_id` on allowed requests, and scan tool call arguments as plain text rather than a tool event - [PR #37036](https://github.com/BerriAI/litellm/pull/37036), [PR #37037](https://github.com/BerriAI/litellm/pull/37037), [PR #37038](https://github.com/BerriAI/litellm/pull/37038)
- **[Bedrock Guardrails](../../docs/proxy/guardrails/bedrock)**
    - Skip `ApplyGuardrail` when there is no content to scan, so a tool-only turn stops failing the whole request - [PR #36441](https://github.com/BerriAI/litellm/pull/36441)
    - Scan and re-emit raw Anthropic SSE streams in the post-call hook - [PR #36598](https://github.com/BerriAI/litellm/pull/36598)
- **General**
    - Isolate guardrail load failures per row so one bad entry stops taking the rest with it - [PR #36432](https://github.com/BerriAI/litellm/pull/36432)
    - Report real token usage on guardrail-blocked `/v1/responses` replies - [PR #36907](https://github.com/BerriAI/litellm/pull/36907)

## Spend Tracking, Budgets and Rate Limiting

- **Provisioned throughput (PTU)**
    - Configure `ptu_count`, `cost_per_ptu_per_hour`, and an effective window on a model deployment - [PR #35341](https://github.com/BerriAI/litellm/pull/35341)
    - Write per-model PTU flat cost by active hour in the daily rollup, and surface it on the daily activity read path - [PR #35343](https://github.com/BerriAI/litellm/pull/35343), [PR #35391](https://github.com/BerriAI/litellm/pull/35391)
    - Gate PTU flat-cost attribution behind an opt-in env var - [PR #36138](https://github.com/BerriAI/litellm/pull/36138)
    - Stop per-token billing, and stop billing for grounded search, on a PTU-configured deployment - [PR #36829](https://github.com/BerriAI/litellm/pull/36829), [PR #37043](https://github.com/BerriAI/litellm/pull/37043)
- **Rate limiting**
    - Declare expected output tokens per key, team, and model so TPM reservation stops using one static floor - [PR #36143](https://github.com/BerriAI/litellm/pull/36143)
    - Reserve the larger declared output budget for TPM limits - [PR #37001](https://github.com/BerriAI/litellm/pull/37001)
- **Cost tracking**
    - Emit six per-component `x-litellm-response-cost-*` headers next to the total - [PR #36965](https://github.com/BerriAI/litellm/pull/36965)
    - Track OpenAI and Azure web search tool cost per call, and bill xAI web search from `server_side_tool_usage_details` - [PR #35286](https://github.com/BerriAI/litellm/pull/35286), [PR #30817](https://github.com/BerriAI/litellm/pull/30817)
    - Support cache creation cost in tiered pricing, all-or-nothing - [PR #36720](https://github.com/BerriAI/litellm/pull/36720)
    - Net prompt-caching savings against the cache-write premium - [PR #36452](https://github.com/BerriAI/litellm/pull/36452)
    - Apply the Anthropic regional geo uplift to cached tokens, and aggregate the 5m and 1h cache-write split across the iterations path - [PR #34850](https://github.com/BerriAI/litellm/pull/34850), [PR #34860](https://github.com/BerriAI/litellm/pull/34860)
    - Price dict-shaped image input token details at the image rate - [PR #33490](https://github.com/BerriAI/litellm/pull/33490)
    - Stop a zero output rate from zeroing transcription cost - [PR #36914](https://github.com/BerriAI/litellm/pull/36914)
    - Forward resolved provider and deployment pricing in `/cost/estimate` - [PR #35880](https://github.com/BerriAI/litellm/pull/35880)
    - Never price a strategy-router alias, and stop `get_router_model_info` wiping cached pricing - [PR #36691](https://github.com/BerriAI/litellm/pull/36691), [PR #36985](https://github.com/BerriAI/litellm/pull/36985)
- **Passthrough and batches**
    - Track spend for OpenAI passthrough `/v1/embeddings`, inject streaming usage cost on OpenAI passthrough streams, and track streamed passthrough Responses cost - [PR #36660](https://github.com/BerriAI/litellm/pull/36660), [PR #36503](https://github.com/BerriAI/litellm/pull/36503), [PR #36529](https://github.com/BerriAI/litellm/pull/36529)
    - Carry the budget reservation into passthrough request metadata, so successful requests stop leaking reservations into Redis and tripping false `BudgetExceededError` - [PR #36592](https://github.com/BerriAI/litellm/pull/36592)
    - Attribute Vertex and Anthropic passthrough batch cost to the creating key, team, and tags - [PR #34456](https://github.com/BerriAI/litellm/pull/34456), [PR #36468](https://github.com/BerriAI/litellm/pull/36468)
    - Account a managed batch's cost exactly once, give a batch's cost row a primary key of its own, mark a terminal batch with no output file as processed, and stop uncostable batches starving the cost poll page - [PR #37050](https://github.com/BerriAI/litellm/pull/37050), [PR #36876](https://github.com/BerriAI/litellm/pull/36876), [PR #35360](https://github.com/BerriAI/litellm/pull/35360), [PR #36714](https://github.com/BerriAI/litellm/pull/36714)
    - Strip NUL bytes from passthrough batch tags before the managed object write - [PR #36688](https://github.com/BerriAI/litellm/pull/36688)
- **Spend logs and budgets**
    - Requeue Redis spend buffer transactions when the DB commit fails, requeue spend logs on a transport error, and stop losing rows when a flush is cancelled - [PR #33881](https://github.com/BerriAI/litellm/pull/33881), [PR #36716](https://github.com/BerriAI/litellm/pull/36716), [PR #34826](https://github.com/BerriAI/litellm/pull/34826)
    - Atomic budget cascade with chunked reset scans in the reset budget job - [PR #36287](https://github.com/BerriAI/litellm/pull/36287)
    - Honor an explicit null `budget_duration` on team and key create, with clearable UI dropdowns - [PR #36699](https://github.com/BerriAI/litellm/pull/36699)
    - Tolerate a concurrent creator when creating spend views - [PR #36824](https://github.com/BerriAI/litellm/pull/36824)

## MCP Gateway

- Scope gateway session bearers to the RFC 8707 resource - [PR #35045](https://github.com/BerriAI/litellm/pull/35045)
- Serve the aggregate MCP endpoint on bare `/mcp` instead of a 307 redirect - [PR #34845](https://github.com/BerriAI/litellm/pull/34845)
- Resolve admin OAuth sessions from any worker via DB-backed drafts, and keep admin-entered OAuth endpoints in management reads - [PR #36844](https://github.com/BerriAI/litellm/pull/36844), [PR #36888](https://github.com/BerriAI/litellm/pull/36888)
- Bound MCP client requests with a session read timeout - [PR #36675](https://github.com/BerriAI/litellm/pull/36675)
- Expose client HTTP headers to logging callbacks and hooks - [PR #36724](https://github.com/BerriAI/litellm/pull/36724)
- Drop the caller host and configured upstream headers from logged metadata - [PR #36901](https://github.com/BerriAI/litellm/pull/36901)

## Performance / Loadbalancing / Reliability improvements

- **Router & auto-router**
    - Make routing groups callable as virtual models and list them in `/v1/models` - [PR #36519](https://github.com/BerriAI/litellm/pull/36519)
    - Pre-adoption shadow eval for the auto-router with a blind pairwise judge, extended to sample `/v1/messages` and `/v1/responses` traffic and to run reverse-direction jobs - [PR #36587](https://github.com/BerriAI/litellm/pull/36587), [PR #36830](https://github.com/BerriAI/litellm/pull/36830), [PR #36865](https://github.com/BerriAI/litellm/pull/36865)
    - Calibrate the complexity classifier rubric with worked examples, selectable per router, and stop scoring system prompt text for code and technical complexity - [PR #36578](https://github.com/BerriAI/litellm/pull/36578), [PR #36721](https://github.com/BerriAI/litellm/pull/36721)
    - Add a required-AND (`&`) tag prefix and an `allow_fail_open` flag, let untagged requests bypass a tagged pre-routing strategy on shared model names, and stop re-applying router-selecting request tags to the routed tier's deployments - [PR #36193](https://github.com/BerriAI/litellm/pull/36193), [PR #36627](https://github.com/BerriAI/litellm/pull/36627), [PR #36628](https://github.com/BerriAI/litellm/pull/36628)
    - Forward auto-router alias params from the marker entry rather than the first same-name deployment - [PR #36626](https://github.com/BerriAI/litellm/pull/36626)
    - Per-deployment `allowed_fails_policy` and `cooldown_time` overrides, cooldown for failed fallback deployments, and a corrected cooldown TTL after Redis backfill - [PR #34416](https://github.com/BerriAI/litellm/pull/34416), [PR #35104](https://github.com/BerriAI/litellm/pull/35104)
    - Keep batch fallbacks inside the model group that owns the file - [PR #36181](https://github.com/BerriAI/litellm/pull/36181)
    - Warn when a deployment's credentials contradict its provider - [PR #36486](https://github.com/BerriAI/litellm/pull/36486)
- **Streaming & connections**
    - Global `litellm_settings.sse_keepalive_ping_interval_seconds`, on top of the per-deployment `keepalive_seconds` SSE heartbeat, so silent streams stop being killed by ingress idle timeouts - [PR #36154](https://github.com/BerriAI/litellm/pull/36154), [PR #34423](https://github.com/BerriAI/litellm/pull/34423)
    - Refactor HTTP handler initialization with client support - [PR #30952](https://github.com/BerriAI/litellm/pull/30952)
    - Cache Anthropic `/v1/messages` responses, including streaming - [PR #34581](https://github.com/BerriAI/litellm/pull/34581)
    - Unwrap decorated `__init__`s when deriving the Redis `from_url` kwargs allowlist - [PR #36654](https://github.com/BerriAI/litellm/pull/36654)
- **Database & background jobs**
    - Write each daily spend batch in one upsert statement - [PR #36448](https://github.com/BerriAI/litellm/pull/36448)
    - Bound spend-logs retention cleanup so one run cannot saturate the database - [PR #36594](https://github.com/BerriAI/litellm/pull/36594)
    - Stagger scheduled background jobs across jobs and pods - [PR #36589](https://github.com/BerriAI/litellm/pull/36589)
    - Force a Prisma recreate on a Postgres cached-plan error - [PR #36428](https://github.com/BerriAI/litellm/pull/36428)
    - Serialize model reconciles so concurrent model writes stop evicting each other - [PR #36687](https://github.com/BerriAI/litellm/pull/36687)
    - Skip prisma-dependent hooks when no database is attached - [PR #36273](https://github.com/BerriAI/litellm/pull/36273)
- **Deployment**
    - Make VPC, Aurora, and Redis optional in the AWS Terraform module, so a locked-down account can reuse its own networking, Postgres, and Redis - [PR #36676](https://github.com/BerriAI/litellm/pull/36676)
    - Add `startupProbe` and `hpa.behavior` knobs to the componentized Helm chart - [PR #36382](https://github.com/BerriAI/litellm/pull/36382)

## Documentation Updates

- Describe the Terraform provider release as automatic - [PR #36467](https://github.com/BerriAI/litellm/pull/36467)
- Require a user flow and a live-proxy proof in bug reports, and a user flow plus a stuck-at proof in feature requests - [PR #36498](https://github.com/BerriAI/litellm/pull/36498), [PR #36500](https://github.com/BerriAI/litellm/pull/36500)
- Show only the latest run as Before/After in the proof-of-fix section, with nested cases - [PR #37063](https://github.com/BerriAI/litellm/pull/37063)
- Replace the Changes PR template section with Caveats - [PR #36423](https://github.com/BerriAI/litellm/pull/36423)
- Rewrite the CLAUDE.md comment rule with explicit any-of exceptions, require `ReadOnly` on every TypedDict field, tell agents to let heavy gates queue for machine-wide slots, and drop the `@` prefix from the PR template path - [PR #36301](https://github.com/BerriAI/litellm/pull/36301), [PR #36421](https://github.com/BerriAI/litellm/pull/36421), [PR #37005](https://github.com/BerriAI/litellm/pull/37005), [PR #37057](https://github.com/BerriAI/litellm/pull/37057), [PR #36726](https://github.com/BerriAI/litellm/pull/36726)

### PR roll-up by ownership area

PRs by ownership area (total: 277)

- UI: 75
- Models & Providers: 39
- Spend / Budgets / Rate Limits: 37
- Other (CI / chore / tests / build / version bumps): 36
- Performance: 27
- Auth & Management: 16
- LLM API Endpoints: 14
- Docs: 10
- Logging: 9
- Guardrails: 7
- MCP: 7

## End-to-End Testing

We are investing heavily in end-to-end testing to cut regressions and make LiteLLM more stable release over release. Every version is exercised by a live suite that runs against a real deployed proxy and hits real provider endpoints, not mocks, so the behavior we validate is the behavior you get in production.

This window added 18 test-only pull requests, 10 of them touching the live e2e suite. Vendor API coverage was hardened so that provider denials, disconnects, server errors, and missing credentials hard-fail instead of passing, and new cells cover Google-native `generateContent` framing, Prometheus queue time, the Anthropic `web_search` server tool on Bedrock, and the model allow-list's positive case rather than only its denials. Admin UI e2e tests no longer stop at a success toast: every mutating flow now asserts the outgoing request body and reads the resource back from the API, with new coverage for Logs, Playground, Usage, and MCP edit and delete. Three reproducers for open gateway gaps in passthrough headers and per-model budgets are checked in skipped, with the product gap named in each skip reason, so removing the skip becomes the regression test once a fix lands. On the maintenance side, OTel assertions now target the attempt that served the stream rather than the span count, live Bedrock tests were repointed off the retired Claude 3 Sonnet, and the stale antd selectors that were failing the UI suite on every run were repointed at what the migrated dashboard actually renders.

## New Contributors

- @Praveen11558 made their first contribution in [PR #30952](https://github.com/BerriAI/litellm/pull/30952)
- @geraint0923 made their first contribution in [PR #30817](https://github.com/BerriAI/litellm/pull/30817)
- @dcadenas made their first contribution in [PR #32536](https://github.com/BerriAI/litellm/pull/32536)
- @anxkhn made their first contribution in [PR #32813](https://github.com/BerriAI/litellm/pull/32813)
- @kr0k made their first contribution in [PR #33196](https://github.com/BerriAI/litellm/pull/33196)
- @vairodp made their first contribution in [PR #33490](https://github.com/BerriAI/litellm/pull/33490)
- @atomic made their first contribution in [PR #34177](https://github.com/BerriAI/litellm/pull/34177)
- @heathriel made their first contribution in [PR #34257](https://github.com/BerriAI/litellm/pull/34257)
- @eugene-yao-zocdoc made their first contribution in [PR #34290](https://github.com/BerriAI/litellm/pull/34290)
- @alexshtf made their first contribution in [PR #35669](https://github.com/BerriAI/litellm/pull/35669)
- @HuanQian571 made their first contribution in [PR #35773](https://github.com/BerriAI/litellm/pull/35773)
- @milesadkins made their first contribution in [PR #35969](https://github.com/BerriAI/litellm/pull/35969)
- @daleselaji-dev made their first contribution in [PR #36160](https://github.com/BerriAI/litellm/pull/36160)
- @fancybear-dev made their first contribution in [PR #36196](https://github.com/BerriAI/litellm/pull/36196)
- @ilchemla made their first contribution in [PR #36347](https://github.com/BerriAI/litellm/pull/36347)
- @Louis-Vauterin made their first contribution in [PR #36382](https://github.com/BerriAI/litellm/pull/36382)
- @william-xue made their first contribution in [PR #36529](https://github.com/BerriAI/litellm/pull/36529)
- @lostmartian made their first contribution in [PR #36660](https://github.com/BerriAI/litellm/pull/36660)
- @FahimaGold made their first contribution in [PR #36705](https://github.com/BerriAI/litellm/pull/36705)
- @guptaishaan made their first contribution in [PR #36907](https://github.com/BerriAI/litellm/pull/36907)
- @pokepoke81 made their first contribution in [PR #36943](https://github.com/BerriAI/litellm/pull/36943)
- @erensh27 made their first contribution in [PR #36965](https://github.com/BerriAI/litellm/pull/36965)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.97.0...v1.98.0
