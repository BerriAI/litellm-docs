---
title: "v1.99.0 - Dark Mode, CLI OAuth Login & Batch Billing"
slug: "v1-99-0"
date: 2026-09-01T00:00:00
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
docker.litellm.ai/berriai/litellm:1.99.0
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.99.0
```

</TabItem>
</Tabs>

:::note

PyPI and Docker artifacts for this release were built from different SHAs, but are expected to be functionally the same. PyPI was built from [`d0c8667`](https://github.com/BerriAI/litellm/commit/d0c86678ed3c8951a2c47ed1b1fabcf8de65b553) and Docker from [`fa647f7`](https://github.com/BerriAI/litellm/commit/fa647f742d7baefe8eb1181899d9c81b41559772).

:::

:::danger Breaking Changes

**Audit logging now defaults to on for proxies running an Enterprise license.** `store_audit_logs` becomes tri-state: unset plus a premium license resolves to enabled, replacing roughly fifteen scattered gate checks with one resolver, and `LITELLM_STORE_AUDIT_LOGS` is now honoured by the key hooks that previously ignored it. An enterprise proxy that never set the flag starts writing audit rows on upgrade, which will grow the audit table. Set `store_audit_logs: false` explicitly to keep the prior behavior. See [PR #37518](https://github.com/BerriAI/litellm/pull/37518).

**Shadow eval jobs are budgeted in dollars instead of turns.** `POST /auto_router/shadow_eval/start` now takes `max_budget` in USD per key; a request that still sends `max_turns` gets a 422 naming the replacement. The sampler, sweep, stop guard, and derived status all gate on the billed `response_cost` of the shadow arm and the judge, and admission re-checks the proxy's cross-pod spend counter. Jobs created before the migration keep their configured turn budget, since `max_budget` stays NULL on those rows. See [PR #37555](https://github.com/BerriAI/litellm/pull/37555).

**A shadow eval job now covers a list of keys rather than one.** `api_key_ids` replaces `api_key_id` on the start payload, results come back pooled and per key, and sibling rows are tied together by a new `group_id` column. A caller still sending the singular `api_key_id` must move to the list form. See [PR #37251](https://github.com/BerriAI/litellm/pull/37251).

:::

## Key Highlights

- **The Admin UI's migration off antd and Tremor is complete** - `@tremor/react`, `antd`, and `@ant-design/icons` are all removed from the dashboard's dependencies, with the last components, the shared primitives, and every form ported onto shadcn (base-vega) and react-hook-form. 130 UI pull requests land in this window, and the dashboard is now on React 19
- **Dark mode ships** - a light/dark/system toggle in the top bar, semantic status tokens for success, warning and info, a dark variant of the LiteLLM logo, and an admin-supplied dark variant of a custom logo. Hardcoded Tailwind palette classes across the dashboard are mapped onto theme tokens so surfaces, form controls, inline styles and code blocks all follow the theme
- **`lite login` is a real OAuth flow** - the CLI now authenticates with an authorization code plus PKCE against the proxy, stores the credential and the refresh token in the OS keychain rather than a `token.json` on disk, and `lite login --config-claude` wires Claude Code up at login
- **Batch spend is accounted for end to end** - enqueued-token rate limiting admits batches against a token budget and refunds on completion or cancellation, cost rows are claimed atomically so multi-pod polling cannot double-bill, cancelled and failed batches that still produced output are billed, a single undecodable output line no longer zeroes a batch's spend, and Bedrock batches can be cancelled through `POST /v1/batches/{id}/cancel`
- **Provisioned throughput can be declared in `config.yaml`** - a PTU reservation no longer has to be created through the API; the rollup accrues flat cost for config-declared deployments, refuses an incomplete reservation the way the endpoints do, requires an operator-declared id, and warns when a config declares PTU while attribution is switched off
- **The complexity router is operator-configurable** - operator-defined tier sets for the LLM classifier, custom classifier plugins via `classifier_type: custom`, a plan-mode tier floor for coding-agent clients, a business classification rubric preset, and per-model reasoning effort in the tier editor

## Included from v1.99.0-rc.2

This stable also carries everything that landed on the release line after the rc.1 cut, shipped in v1.99.0-rc.2 and included here:

- **[Anthropic](../../docs/providers/anthropic)**
    - Translate `tool_result` document blocks in the `/v1/messages` bridge - [PR #38251](https://github.com/BerriAI/litellm/pull/38251)
- **Dashboard (dark mode follow-ups)**
    - Make provider logos readable in dark mode - [PR #38588](https://github.com/BerriAI/litellm/pull/38588)
    - One-click theme toggle and matching Docs/Blog styling in the top bar - [PR #38601](https://github.com/BerriAI/litellm/pull/38601)
    - Make code blocks and the logs JSON viewer follow the theme in dark mode - [PR #38771](https://github.com/BerriAI/litellm/pull/38771), [PR #38778](https://github.com/BerriAI/litellm/pull/38778)
    - Make playground chat bubbles theme-aware, and theme the created-key box - [PR #37978](https://github.com/BerriAI/litellm/pull/37978), [PR #37985](https://github.com/BerriAI/litellm/pull/37985)
- **Dashboard (bug fixes)**
    - Open select popups below the trigger instead of over it - [PR #38554](https://github.com/BerriAI/litellm/pull/38554)
    - Stop server-searched comboboxes from clobbering picks and queries, and let the paginated search select keep what the user types - [PR #38574](https://github.com/BerriAI/litellm/pull/38574), [PR #38475](https://github.com/BerriAI/litellm/pull/38475)
    - Keep a deleted-from search query instead of blanking the box - [PR #38830](https://github.com/BerriAI/litellm/pull/38830)
    - Keep focus in the add model public name input while typing, and restore its tooltip layout - [PR #38366](https://github.com/BerriAI/litellm/pull/38366), [PR #37986](https://github.com/BerriAI/litellm/pull/37986)
    - Restore the reopen control for the log drawer's trace sidebar - [PR #38782](https://github.com/BerriAI/litellm/pull/38782)
    - Stack the policy flow builder below the popup layer so guardrail options render - [PR #38273](https://github.com/BerriAI/litellm/pull/38273)
    - Drop stray text next to Close in the model connection test dialog - [PR #38852](https://github.com/BerriAI/litellm/pull/38852)
- **Docker**
    - Pin the image builds' apk python to 3.13 and bump wolfi-base for glibc 2.44 - [PR #38917](https://github.com/BerriAI/litellm/pull/38917), [PR #38973](https://github.com/BerriAI/litellm/pull/38973)
- **End-to-End Testing**
    - De-flake the select-anchoring, router-fallback, vertex realtime and vision fixture specs (test-only) - [PR #38848](https://github.com/BerriAI/litellm/pull/38848), [PR #38862](https://github.com/BerriAI/litellm/pull/38862)

## New Providers and Endpoints

### New Providers (5 new providers)

| Provider | Supported LiteLLM Endpoints | Description |
| --- | --- | --- |
| SCX.ai | `/chat/completions` | JSON-configured OpenAI-compatible provider, registered in the provider enum, config map, pricing map and dashboard, shipping GLM-5.2 and Qwen3.8-Max |
| Cognition | `/chat/completions` | Cognition gets its own provider identity rather than riding an OpenAI-compatible alias, with `swe-1.6`, `swe-1.7` and `swe-1.7-lightning` priced |
| AWS Bedrock AgentCore | `/search` | Bedrock AgentCore registered as a search provider |
| Amazon Comprehend Medical | `/*` passthrough | Passthrough provider for Comprehend Medical, routed and credentialed through the proxy |
| Valkey | Vector stores | Valkey as a managed vector store provider alongside the existing backends |

### New LLM API Endpoints (4 new endpoints)

| Endpoint | Method | Description | Documentation |
| --- | --- | --- | --- |
| `/model/deprecations` | GET | Lists deployments whose models carry a provider-announced `deprecation_date`, backing proactive deprecation alerts | [Proxy Config](../../docs/proxy/configs) |
| `/team/daily/activity/aggregated` | GET | Pre-aggregated team activity for the Usage tab, replacing the per-row scan it used to do client-side | [Cost Tracking](../../docs/proxy/cost_tracking) |
| `/team/{team_id}/callback/{callback_name}` | DELETE | Removes a single team-scoped logging callback without rewriting the whole callback set | [Team Logging](../../docs/proxy/team_logging) |
| `/auto_router/validate_complexity_router_config` | POST | Dry-runs a complexity-router config against the write gate so an invalid tier set is rejected before it is saved | [Auto Router](../../docs/adaptive_router) |

## New Models / Updated Models

#### New Model Support (136 new models)

| Provider | Model | Context Window | Input ($/1M tokens) | Output ($/1M tokens) | Features |
| --- | --- | --- | --- | --- | --- |
| OpenAI | `gpt-5.6-cyber` | 400K | $12.50 | $75.00 | Reasoning, vision, PDF input, function calling, parallel function calling, tool choice, prompt caching, response schema, web search, computer use, native streaming |
| OpenAI | `daybreak-red-latest` | 400K | $12.50 | $75.00 | Reasoning, vision, PDF input, function calling, parallel function calling, tool choice, prompt caching, response schema, web search, computer use, native streaming |
| OpenAI | `daybreak-blue-latest` | 1M | $4.00 | $20.00 | Reasoning, vision, PDF input, function calling, parallel function calling, tool choice, prompt caching, response schema, web search, computer use, native streaming |
| OpenAI | `chat-latest` | 400K | $5.00 | $30.00 | Vision, PDF input, function calling, parallel function calling, tool choice, prompt caching, response schema, web search, native streaming |
| Azure | `azure/gpt-audio-mini` | 128K | $0.60 | $2.40 | Function calling, parallel function calling, tool choice, native streaming |
| Azure | `azure/gpt-realtime-mini` | 32K | $0.60 | $2.40 | Realtime, audio input and output, function calling, parallel function calling, tool choice, $0.0000008 per image |
| Amazon Bedrock | `us.openai.gpt-5.6-sol` | 1M | $5.50 | $33.00 | Vision, function calling, tool choice |
| Amazon Bedrock | `global.openai.gpt-5.6-sol` | 1M | $5.00 | $30.00 | Vision, function calling, tool choice |
| Amazon Bedrock | `us.openai.gpt-5.6-terra` | 1M | $2.20 | $13.20 | Vision, function calling, tool choice |
| Amazon Bedrock | `global.openai.gpt-5.6-terra` | 1M | $2.00 | $12.00 | Vision, function calling, tool choice |
| Amazon Bedrock | `us.openai.gpt-5.6-luna` | 1M | $0.22 | $1.32 | Vision, function calling, tool choice |
| Amazon Bedrock | `global.openai.gpt-5.6-luna` | 1M | $0.20 | $1.20 | Vision, function calling, tool choice |
| Amazon Bedrock | `us.xai.grok-4.6` | 500K | $2.20 | $6.60 | Reasoning, vision, function calling, tool choice, prompt caching |
| Amazon Bedrock | `global.xai.grok-4.6` | 500K | $2.00 | $6.00 | Reasoning, vision, function calling, tool choice, prompt caching |
| Amazon Bedrock | `bedrock_mantle/xai.grok-4.6` | 500K | $2.20 | $6.60 | Reasoning, vision, function calling, tool choice, prompt caching, response schema |
| Amazon Bedrock | `bedrock/guardrails` | - | - | - | Guardrail usage and cost accounting |
| AWS Bedrock AgentCore | `agentcore/search` | - | - | - | Search |
| Databricks | `databricks/databricks-claude-opus-4-6` | 1M | $5.00 | $25.00 | Reasoning, function calling, tool choice |
| Databricks | `databricks/databricks-claude-sonnet-4-6` | 1M | $3.00 | $15.00 | Reasoning, function calling, tool choice |
| Databricks | `databricks/databricks-gemini-3-pro` | 1M | $2.50 | $15.00 | Function calling, tool choice |
| Databricks | `databricks/databricks-gemini-3-1-pro` | 1M | $2.50 | $15.00 | Function calling, tool choice |
| Databricks | `databricks/databricks-gemini-3-flash` | 1M | $0.625 | $3.75 | Function calling, tool choice |
| Databricks | `databricks/databricks-gemini-3-1-flash-lite` | 1M | $0.3125 | $1.88 | Function calling, tool choice |
| Databricks | `databricks/databricks-gpt-5-4` | 272K | $2.50 | $15.00 | Chat |
| Databricks | `databricks/databricks-gpt-5-4-mini` | 272K | $0.75 | $4.50 | Chat |
| Databricks | `databricks/databricks-gpt-5-4-nano` | 272K | $0.20 | $1.25 | Chat |
| Databricks | `databricks/databricks-gpt-5-2` | 272K | $1.75 | $14.00 | Chat |
| Databricks | `databricks/databricks-gpt-5-2-codex` | 272K | $1.75 | $14.00 | Chat |
| Databricks | `databricks/databricks-gpt-5-3-codex` | 272K | $1.75 | $14.00 | Chat |
| Databricks | `databricks/databricks-gpt-5-1-codex-max` | 272K | $1.25 | $10.00 | Chat |
| Databricks | `databricks/databricks-gpt-5-1-codex-mini` | 272K | $0.25 | $2.00 | Chat |
| Google Gemini | `gemini/gemini-3.1-flash-lite-image` | 65K | $0.25 | $1.50 | Image generation, vision, function calling, $0.00028 per image |
| Google Gemini | `gemini/gemini-3.5-live-translate-preview` | - | $3.50 | $21.00 | Audio input and output |
| Google Vertex AI | `vertex_ai/gemini-3.1-flash-lite-image` | 65K | $0.25 | $1.50 | Image generation, vision, PDF input, video input, prompt caching, $0.00028 per image |
| Google Vertex AI | `gemini-3.1-flash-lite-image` | 65K | $0.25 | $1.50 | Image generation, vision, PDF input, video input, prompt caching, $0.00028 per image |
| Fireworks AI | `fireworks_ai/kimi-k3` | 1M | $3.00 | $15.00 | Reasoning, vision, function calling, tool choice, response schema |
| Fireworks AI | `fireworks_ai/kimi-k3-fast` | 1M | $4.50 | $22.50 | Reasoning, vision, function calling, tool choice, response schema |
| Fireworks AI | `fireworks_ai/kimi-k3-us` | 1M | $3.30 | $16.50 | Reasoning, vision, function calling, tool choice, response schema |
| Fireworks AI | `fireworks_ai/glm-5p2-fast` | 1M | $2.10 | $6.60 | Reasoning, function calling, tool choice, response schema |
| Fireworks AI | `fireworks_ai/glm-5p2-fast-us` | 1M | $2.10 | $6.60 | Reasoning, function calling, tool choice, response schema |
| Fireworks AI | `fireworks_ai/deepseek-v4-flash-0731` | 1M | $0.14 | $0.28 | Reasoning, function calling, tool choice, response schema |
| Fireworks AI | `fireworks_ai/qwen3p8-max` | 262K | $2.00 | $6.00 | Reasoning, vision, function calling, tool choice, response schema |
| Fireworks AI | `fireworks_ai/muse-glimmer-30b` | 131K | $0.35 | $1.50 | Reasoning, vision, function calling, tool choice, response schema |
| Fireworks AI | `fireworks_ai/nemotron-3-ultra-nvfp4` | 262K | $0.60 | $2.40 | Reasoning, function calling, tool choice, response schema |
| Fireworks AI | `fireworks_ai/nemotron-lightning-3p5-30b-a3b` | 262K | $0.05 | $0.20 | Reasoning, function calling, tool choice, response schema |
| Mistral | `mistral/glm-5-2` | 1M | $1.40 | $4.40 | Reasoning, function calling, tool choice, prompt caching, response schema |
| Mistral | `mistral/zai-glm-5-2` | 1M | $1.40 | $4.40 | Reasoning, function calling, tool choice, prompt caching, response schema |
| Mistral | `mistral/mistral-ocr-4-1` | - | - | - | OCR |
| Moonshot | `moonshot/kimi-k3` | 1M | $3.00 | $15.00 | Reasoning, vision, video input, function calling, tool choice, response schema |
| OpenRouter | `openrouter/anthropic/claude-opus-5` | 1M | $5.00 | $25.00 | Reasoning, vision, PDF input, function calling, tool choice, prompt caching, response schema, computer use |
| OpenRouter | `openrouter/deepseek/deepseek-v4-pro` | 1M | $1.32 | $3.96 | Reasoning, function calling, tool choice, prompt caching, response schema |
| OpenRouter | `openrouter/deepseek/deepseek-v4-pro-0813` | 1M | $1.32 | $3.96 | Reasoning, function calling, tool choice, prompt caching, response schema |
| Perplexity | `perplexity/perplexity/kimi-k3` | - | $3.00 | $15.00 | Responses, reasoning, function calling, web search |
| Perplexity | `perplexity/perplexity/glm-5.2` | - | $1.40 | $4.40 | Responses, reasoning, function calling, web search |
| Perplexity | `perplexity/perplexity/kimi-k2.7-code` | - | $0.95 | $4.00 | Responses, function calling, web search |
| Perplexity | `perplexity/perplexity/deepseek-v4-flash-0731` | - | $0.13 | $0.26 | Responses, reasoning, function calling, web search |
| Perplexity | `perplexity/pplx-embed-context-v1-4b` | 32K | $0.05 | - | Embedding |
| Perplexity | `perplexity/pplx-embed-context-v1-0.6b` | 32K | $0.008 | - | Embedding |
| Voyage | `voyage/voyage-4-large` | 32K | $0.12 | - | Embedding |
| Voyage | `voyage/voyage-4` | 32K | $0.06 | - | Embedding |
| Voyage | `voyage/voyage-4-lite` | 32K | $0.02 | - | Embedding |
| Voyage | `voyage/voyage-code-4` | 32K | $0.12 | - | Embedding |
| Voyage | `voyage/voyage-context-4` | 120K | $0.12 | - | Embedding |
| Voyage | `voyage/voyage-multimodal-3.5` | 32K | $0.12 | - | Embedding, image embedding input |
| SCX.ai | `scx-ai/GLM-5.2` | 1M | $0.61 | $1.98 | Reasoning, function calling, tool choice, prompt caching, response schema |
| SCX.ai | `scx-ai/Qwen3.8-Max` | 1M | $1.65 | $4.99 | Reasoning, vision, function calling, tool choice, prompt caching, response schema |
| Cognition | `cognition/swe-1.6` | - | $0.50 | $2.50 | Function calling, prompt caching |
| Cognition | `cognition/swe-1.7` | - | $0.50 | $2.50 | Function calling, prompt caching |
| Cognition | `cognition/swe-1.7-lightning` | - | $2.50 | $12.50 | Function calling, prompt caching |
| fal.ai | `fal_ai/gpt-image-2`, `fal_ai/openai/gpt-image-2` | - | - | - | Image generation and edit, priced per size and quality from request params |

The fal.ai entry expands to 57 registry keys: the two base slugs plus every `low`/`medium`/`high` quality crossed with six output resolutions, for both generation and `/edit`. The Fireworks entries each carry an `accounts/fireworks/models/` alias, and the two `glm-5p2-fast` and two `kimi-k3` fast/US variants also carry an `accounts/fireworks/routers/` alias, so the slug you already use keeps resolving.

Beyond the new entries, this release is another large cost-map maintenance pass over 288 existing entries. 219 entries gain or correct a provider-announced `deprecation_date`, 25 gain Batch API input and output rates alongside a `regional_endpoint_uplift_multiplier`, and 15 gain a `prompt_cache_min_tokens` floor, including 4096 on Gemini 3.5, 3.6 and 3.7 Flash and 3.1 Pro Preview. Pricing moves in both directions: Gemini 3.6 Flash halves to $0.75 / $3.75 per 1M on both Gemini and Vertex, `gpt-5.6` and `gpt-5.6-sol` drop to $4.00 / $20.00 on a promotional cut, `mistral/codestral-latest` falls to $0.30 / $0.90 and Vertex DeepSeek V3.1 MaaS to $0.60 / $1.70, while `gemini-3.1-flash-image` doubles to $0.50 / $3.00 and `mistral/mistral-small-latest` rises to $0.15 / $0.60. The GPT-5.6 family's max input tokens is corrected from 1.05M to 922K across the Azure, US and EU entries. Flex and priority service-tier rates land on 8 and 5 entries respectively, `thinking_always_on` on 11, and `supports_prompt_cache_breakpoint` on 4. No pricing entries were removed.

#### Features

- **[Amazon Bedrock](../../docs/providers/bedrock)**
    - Serve GPT-5.6 cross-region inference profiles on Bedrock runtime - [PR #37821](https://github.com/BerriAI/litellm/pull/37821)
    - Forward LiteLLM identity and metadata into Bedrock `requestMetadata` - [PR #36861](https://github.com/BerriAI/litellm/pull/36861)
    - Add a config toggle to disable agent-runtime pass-through - [PR #37386](https://github.com/BerriAI/litellm/pull/37386)
    - Day-0 pricing for Grok 4.6 on Bedrock - [PR #37517](https://github.com/BerriAI/litellm/pull/37517)
- **[Cognition](../../docs/providers/cognition)**
    - Give Cognition its own provider identity, then price `swe-1.7` at the standard tier and add `swe-1.7-lightning` - [PR #37743](https://github.com/BerriAI/litellm/pull/37743), [PR #37763](https://github.com/BerriAI/litellm/pull/37763)
- **[SCX.ai](../../docs/providers/scx_ai)**
    - Add SCX.ai as a JSON-configured OpenAI-compatible provider - [PR #34752](https://github.com/BerriAI/litellm/pull/34752)
- **[Mistral](../../docs/providers/mistral)**
    - Add `zai-glm-5-2` and `glm-5-2` pricing - [PR #37110](https://github.com/BerriAI/litellm/pull/37110)
- **[Perplexity](../../docs/providers/perplexity)**
    - Add the Agent API third-party models - [PR #37112](https://github.com/BerriAI/litellm/pull/37112)
- **[Databricks](../../docs/providers/databricks)**
    - Add cost map entries for 14 newer Databricks models - [PR #28501](https://github.com/BerriAI/litellm/pull/28501)
- **[Moonshot](../../docs/providers/moonshot)**
    - Add `moonshot/kimi-k3` to the cost map - [PR #37552](https://github.com/BerriAI/litellm/pull/37552), [PR #37753](https://github.com/BerriAI/litellm/pull/37753)
- **[Anthropic](../../docs/providers/anthropic)**
    - Map `cache_control_injection_points` to the OpenAI `prompt_cache_breakpoint` on GPT-5.6+ targets - [PR #37628](https://github.com/BerriAI/litellm/pull/37628)
    - Map `metadata.user_id` to `prompt_cache_key` on the `/v1/messages` bridge - [PR #37623](https://github.com/BerriAI/litellm/pull/37623)
- **General**
    - Route `/chat/completions` through the Rust core for Anthropic and Bedrock - [PR #37241](https://github.com/BerriAI/litellm/pull/37241)
    - Surface TinyFish response headers and top-level response extras - [PR #32448](https://github.com/BerriAI/litellm/pull/32448)
    - Authenticate to Azure Postgres with Microsoft Entra ID tokens - [PR #37663](https://github.com/BerriAI/litellm/pull/37663)

### Bug Fixes

- **[Amazon Bedrock](../../docs/providers/bedrock)**
    - Preserve cache token usage when `invocationMetrics` replaces the usage block, and report provider thinking tokens instead of classifying them as text - [PR #36878](https://github.com/BerriAI/litellm/pull/36878), [PR #35998](https://github.com/BerriAI/litellm/pull/35998)
    - Forward provider response headers on chat completions, degrade gracefully on malformed tool-call arguments, and validate file-content retrieval against the configured output bucket - [PR #37003](https://github.com/BerriAI/litellm/pull/37003), [PR #33842](https://github.com/BerriAI/litellm/pull/33842), [PR #31435](https://github.com/BerriAI/litellm/pull/31435)
    - Read batch usage by payload shape rather than provider name, and report uploaded size in the `FileObject` returned by managed batch uploads - [PR #37078](https://github.com/BerriAI/litellm/pull/37078), [PR #36392](https://github.com/BerriAI/litellm/pull/36392)
- **[Anthropic](../../docs/providers/anthropic)**
    - Emit `tool_use` `content_block_start` without awaiting the next chunk, and resolve the provider exactly once on `/v1/messages` - [PR #37310](https://github.com/BerriAI/litellm/pull/37310), [PR #37757](https://github.com/BerriAI/litellm/pull/37757)
    - Fold guardrail-modified leading system rows into the top-level `system` param - [PR #37231](https://github.com/BerriAI/litellm/pull/37231)
    - Stop emitting empty thinking blocks on the Responses adapter, and preserve optional Responses tool properties - [PR #36033](https://github.com/BerriAI/litellm/pull/36033), [PR #36979](https://github.com/BerriAI/litellm/pull/36979)
    - Log partial stream spend when a `/v1/messages` client disconnects mid-stream - [PR #37558](https://github.com/BerriAI/litellm/pull/37558)
    - Gate sampling params on `/v1/messages` the way `/chat/completions` does, omit `thinking.type=disabled` for always-on thinking models, and accept a bool `thinking` param instead of raising `AttributeError` - [PR #37868](https://github.com/BerriAI/litellm/pull/37868), [PR #37510](https://github.com/BerriAI/litellm/pull/37510), [PR #37423](https://github.com/BerriAI/litellm/pull/37423)
- **[Google Vertex AI](../../docs/providers/vertex)**
    - Apply the regional endpoint uplift to cost tracking, resolving the served location from the passthrough URL, `optional_params`, and the deployment for native `/v1/messages` calls - [PR #37543](https://github.com/BerriAI/litellm/pull/37543)
    - Only fall back to a placeholder thought signature on the first parallel function call - [PR #37541](https://github.com/BerriAI/litellm/pull/37541)
    - Convert messages to contents in Gemini `count_tokens` - [PR #36981](https://github.com/BerriAI/litellm/pull/36981)
- **[Google Gemini](../../docs/providers/gemini)**
    - Price Gemini 3.6 Flash at Google's introductory rates on every service tier, and correct `gemini-3.1-flash-lite-image` capabilities while deduping its entries - [PR #37197](https://github.com/BerriAI/litellm/pull/37197), [PR #36849](https://github.com/BerriAI/litellm/pull/36849)
- **[Azure](../../docs/providers/azure)**
    - Rename `max_tokens` to `max_completion_tokens` for `gpt-5-chat` deployments - [PR #36857](https://github.com/BerriAI/litellm/pull/36857)
    - Strip non-OpenAI-spec message fields before the request on Azure AI - [PR #34445](https://github.com/BerriAI/litellm/pull/34445)
- **[Fireworks AI](../../docs/providers/fireworks_ai)**
    - Skip the `accounts/` rewrite for `FW-*` Foundry deployment ids - [PR #37242](https://github.com/BerriAI/litellm/pull/37242)
- **[SageMaker](../../docs/providers/aws_sagemaker)**
    - Send the inference component header and honor `hf_model_name` - [PR #37766](https://github.com/BerriAI/litellm/pull/37766)
- **General**
    - Stop forwarding a client Anthropic OAuth token to Bedrock and Vertex - [PR #37905](https://github.com/BerriAI/litellm/pull/37905)
    - Stop the Rust flag and the `client_side_timeout` marker from leaking into upstream provider request bodies - [PR #37218](https://github.com/BerriAI/litellm/pull/37218), [PR #37346](https://github.com/BerriAI/litellm/pull/37346)
    - Resolve the advisor sub-call through the proxy router - [PR #36246](https://github.com/BerriAI/litellm/pull/36246)
    - Surface provider errors from the container file content endpoint - [PR #37737](https://github.com/BerriAI/litellm/pull/37737)

## LLM API Endpoints

#### Features

- **[Batches](../../docs/batches)**
    - Enqueued-token rate limiting for batches, with a refund on completion and on cancellation - [PR #37539](https://github.com/BerriAI/litellm/pull/37539)
    - Support AWS Bedrock batch cancellation via `StopModelInvocationJob` - [PR #34087](https://github.com/BerriAI/litellm/pull/34087)
    - Redact or drop individual batch records instead of rejecting the whole file - [PR #37561](https://github.com/BerriAI/litellm/pull/37561)
- **[OCR](../../docs/ocr)**
    - Return Azure Document Intelligence's native payload from `/v1/ocr` via `req_format=native` - [PR #37194](https://github.com/BerriAI/litellm/pull/37194)
- **[Vector Stores](../../docs/completion/knowledgebase)**
    - Add Valkey as a managed vector store provider - [PR #37002](https://github.com/BerriAI/litellm/pull/37002)
- **[Image Generation](../../docs/image_generation)**
    - Add fal.ai `gpt-image-2` image generation and edit support - [PR #37729](https://github.com/BerriAI/litellm/pull/37729)
- **[Pass-through Endpoints](../../docs/pass_through/bedrock)**
    - Add the Amazon Comprehend Medical passthrough provider - [PR #37229](https://github.com/BerriAI/litellm/pull/37229)

#### Bugs

- **[Responses API](../../docs/response_api)**
    - Preserve reasoning input items and signed thinking blocks on the bridge - [PR #36355](https://github.com/BerriAI/litellm/pull/36355)
    - Mint Responses API item IDs in the completion bridge - [PR #37946](https://github.com/BerriAI/litellm/pull/37946)
    - Map incomplete responses to `finish_reason: length` instead of a 500, and map Bedrock Mantle context overflow to `ContextWindowExceededError` - [PR #37710](https://github.com/BerriAI/litellm/pull/37710), [PR #37862](https://github.com/BerriAI/litellm/pull/37862)
    - Unwrap object-form `tool_choice` before calling the Responses API, strip the `responses/` routing prefix on the path, and preserve Bedrock Mantle validation errors - [PR #36032](https://github.com/BerriAI/litellm/pull/36032), [PR #37345](https://github.com/BerriAI/litellm/pull/37345), [PR #36580](https://github.com/BerriAI/litellm/pull/36580)
- **[Batches](../../docs/batches)**
    - Stop one bad output line from zeroing an entire batch's spend, and decode a model-encoded output file id so completed batches book spend - [PR #37457](https://github.com/BerriAI/litellm/pull/37457), [PR #37573](https://github.com/BerriAI/litellm/pull/37573)
    - Bill cancelled and failed batches that still produced an output file - [PR #37205](https://github.com/BerriAI/litellm/pull/37205)
    - Price a retrieved batch from its deployment's model and rates - [PR #37219](https://github.com/BerriAI/litellm/pull/37219)
    - Don't crash logging when a completed batch has no output file, and don't retire a completed batch from cost recovery while `output_file_id` is lagging - [PR #34067](https://github.com/BerriAI/litellm/pull/34067), [PR #37715](https://github.com/BerriAI/litellm/pull/37715)
    - Return OpenAI-parity errors: 400 for an out-of-range `limit` on `GET /v1/batches`, 400 naming the missing required param on `POST /v1/batches`, and 404 rather than 500 for unresolvable batch and file ids - [PR #37198](https://github.com/BerriAI/litellm/pull/37198), [PR #37199](https://github.com/BerriAI/litellm/pull/37199), [PR #37201](https://github.com/BerriAI/litellm/pull/37201)
    - Read batch records the same way the upload validation does - [PR #37776](https://github.com/BerriAI/litellm/pull/37776)
- **[Files](../../docs/files_endpoints)**
    - List and page unscoped managed files locally - [PR #37855](https://github.com/BerriAI/litellm/pull/37855)
- **[Pass-through Endpoints](../../docs/pass_through/bedrock)**
    - Register WebSocket passthrough for OpenAI prefixes, and forward the Bedrock event-stream content-type on unbuffered passthrough - [PR #36151](https://github.com/BerriAI/litellm/pull/36151), [PR #33767](https://github.com/BerriAI/litellm/pull/33767)
    - Resolve Vertex live credentials from DB model deployments, and bound Vertex credential resolution so realtime failures are loud - [PR #37602](https://github.com/BerriAI/litellm/pull/37602), [PR #37604](https://github.com/BerriAI/litellm/pull/37604)
- **General**
    - End the turn when the agentic web-search loop hits its ceiling - [PR #37911](https://github.com/BerriAI/litellm/pull/37911)
    - Return SSE (`text/event-stream`) for A2A `message/stream` instead of NDJSON, and accept the whole JSON-RPC id union the spec defines - [PR #35037](https://github.com/BerriAI/litellm/pull/35037), [PR #37704](https://github.com/BerriAI/litellm/pull/37704)
    - Stop leaking stored credentials in direct vector-store search debug logs - [PR #37373](https://github.com/BerriAI/litellm/pull/37373)
    - Price fal.ai `gpt-image-2` per size and quality from the request params - [PR #37751](https://github.com/BerriAI/litellm/pull/37751)
    - Return 400 for non-object `metadata` and `litellm_metadata` instead of a silent drop or a 500 - [PR #37203](https://github.com/BerriAI/litellm/pull/37203)

## Management Endpoints / UI

#### Features

- **Design system**
    - Complete the move off Ant Design and Tremor: the last components, shared primitives and common components migrate onto shadcn, `@tremor/react` and `antd` are dropped from the dependency tree, and `@ant-design/icons` is swapped for `lucide-react` - [PR #37569](https://github.com/BerriAI/litellm/pull/37569), [PR #37574](https://github.com/BerriAI/litellm/pull/37574), [PR #37394](https://github.com/BerriAI/litellm/pull/37394), [PR #37521](https://github.com/BerriAI/litellm/pull/37521), [PR #37553](https://github.com/BerriAI/litellm/pull/37553)
    - Move every form onto react-hook-form and shadcn, covering virtual keys, add model, teams, users, policies, margins, agents, tags, memory, credentials, auto routers, vector stores, pass-through, projects, access groups, MCP, SSO, SCIM, alerting, fallbacks and the login and onboarding flows - [PR #37442](https://github.com/BerriAI/litellm/pull/37442), [PR #37446](https://github.com/BerriAI/litellm/pull/37446), [PR #37417](https://github.com/BerriAI/litellm/pull/37417), [PR #37305](https://github.com/BerriAI/litellm/pull/37305), [PR #37357](https://github.com/BerriAI/litellm/pull/37357), [PR #37266](https://github.com/BerriAI/litellm/pull/37266), [PR #37304](https://github.com/BerriAI/litellm/pull/37304), [PR #37353](https://github.com/BerriAI/litellm/pull/37353), [PR #37354](https://github.com/BerriAI/litellm/pull/37354), [PR #37334](https://github.com/BerriAI/litellm/pull/37334), [PR #37315](https://github.com/BerriAI/litellm/pull/37315)
    - Upgrade the dashboard to React 19 - [PR #37411](https://github.com/BerriAI/litellm/pull/37411)
    - Move dashboard toasts from antd `message`/`notification` onto sonner, and codemod every call site onto `lib/toast` - [PR #37207](https://github.com/BerriAI/litellm/pull/37207), [PR #37253](https://github.com/BerriAI/litellm/pull/37253)
- **Dark mode**
    - Add a light/dark/system theme toggle to the top bar, marked beta in the theme menu - [PR #37669](https://github.com/BerriAI/litellm/pull/37669), [PR #37680](https://github.com/BerriAI/litellm/pull/37680)
    - Add success, warning and info status tokens, and map hardcoded Tailwind palette classes onto semantic tokens - [PR #37393](https://github.com/BerriAI/litellm/pull/37393), [PR #37576](https://github.com/BerriAI/litellm/pull/37576)
    - Serve a dark-mode variant of the LiteLLM logo, and let admins supply a dark-mode variant of their custom logo - [PR #37656](https://github.com/BerriAI/litellm/pull/37656), [PR #37662](https://github.com/BerriAI/litellm/pull/37662)
- **Auto Router**
    - Multi-key shadow eval picker with a per-key breakdown, and the shadowed key named in job responses and the UI headline - [PR #37389](https://github.com/BerriAI/litellm/pull/37389), [PR #37221](https://github.com/BerriAI/litellm/pull/37221)
    - Configure the heuristic scorer from the Admin UI, add a Lite mixed-provider preset, and set a plan-mode override tier in the create and edit forms - [PR #37216](https://github.com/BerriAI/litellm/pull/37216), [PR #37068](https://github.com/BerriAI/litellm/pull/37068), [PR #37319](https://github.com/BerriAI/litellm/pull/37319)
    - Per-model reasoning effort in the complexity tier editor - [PR #37673](https://github.com/BerriAI/litellm/pull/37673)
- **Virtual Keys**
    - Link the key info header to its user, creator, team and organization - [PR #37187](https://github.com/BerriAI/litellm/pull/37187)
    - Add a per-key Savings tab to the key detail page - [PR #37693](https://github.com/BerriAI/litellm/pull/37693)
- **Usage and Logs**
    - Add a user ID request-log filter, and a searchable per-user usage filter on the Usage page - [PR #36781](https://github.com/BerriAI/litellm/pull/36781), [PR #36790](https://github.com/BerriAI/litellm/pull/36790), [PR #37206](https://github.com/BerriAI/litellm/pull/37206)
    - Add `/team/daily/activity/aggregated` and switch the Usage team tab to it - [PR #36562](https://github.com/BerriAI/litellm/pull/36562)
- **Teams and Projects**
    - Edit project input and output TPM limits from the Projects modal - [PR #37676](https://github.com/BerriAI/litellm/pull/37676)
    - Standardize the Teams page header, and decouple bulk invite from the invite user button - [PR #36897](https://github.com/BerriAI/litellm/pull/36897), [PR #37061](https://github.com/BerriAI/litellm/pull/37061)
- **Auth and Management**
    - `DELETE /team/{team_id}/callback/{callback_name}` for removing a single team callback - [PR #37331](https://github.com/BerriAI/litellm/pull/37331)
    - Source generic OIDC user claims from the ID or access token when UserInfo is incomplete - [PR #37696](https://github.com/BerriAI/litellm/pull/37696)
    - Proactive model deprecation alerts and a `/model/deprecations` endpoint - [PR #26900](https://github.com/BerriAI/litellm/pull/26900)
    - Bound the health-check table with `maximum_health_check_retention_period` - [PR #37681](https://github.com/BerriAI/litellm/pull/37681)
- **CLI**
    - Native CLI login with OAuth authorization code plus PKCE - [PR #37626](https://github.com/BerriAI/litellm/pull/37626)
    - Store the `lite login` credential and the `--pkce` refresh token in the OS keychain rather than `token.json` - [PR #37566](https://github.com/BerriAI/litellm/pull/37566), [PR #37665](https://github.com/BerriAI/litellm/pull/37665)
    - `lite login --config-claude` wires Claude Code at login - [PR #37507](https://github.com/BerriAI/litellm/pull/37507)

#### Bugs

- **Dark mode and theming**
    - Make dark-mode form controls visible, give status colours a readable foreground, make hardcoded palette surfaces theme-aware, make inline styles and code blocks follow the theme, and move the policy flow builder onto theme tokens - [PR #37648](https://github.com/BerriAI/litellm/pull/37648), [PR #37649](https://github.com/BerriAI/litellm/pull/37649), [PR #37650](https://github.com/BerriAI/litellm/pull/37650), [PR #37651](https://github.com/BerriAI/litellm/pull/37651), [PR #37654](https://github.com/BerriAI/litellm/pull/37654)
    - Restore hover feedback and dark-mode variants lost in the token migration, and keep semantic button colours on hover - [PR #37579](https://github.com/BerriAI/litellm/pull/37579), [PR #37580](https://github.com/BerriAI/litellm/pull/37580)
- **Forms**
    - Rebuild nested and list paths in the mounted-field projection, add mounted-field projections for the MCP server form graph, and render optional array and object MCP tool parameters as JSON inputs - [PR #37450](https://github.com/BerriAI/litellm/pull/37450), [PR #37440](https://github.com/BerriAI/litellm/pull/37440), [PR #37548](https://github.com/BerriAI/litellm/pull/37548)
    - Show select labels on the trigger instead of raw values, restore the cache control Role and Index field hints, and gate the pass-through guardrail field inputs when the section is disabled - [PR #37372](https://github.com/BerriAI/litellm/pull/37372), [PR #37437](https://github.com/BerriAI/litellm/pull/37437), [PR #37435](https://github.com/BerriAI/litellm/pull/37435)
    - Clear pass-through header rows when the create modal is reopened, and stop the Add Model mapping table from looping the page - [PR #37549](https://github.com/BerriAI/litellm/pull/37549), [PR #37741](https://github.com/BerriAI/litellm/pull/37741)
    - Highlight the first member search match so Enter picks it - [PR #37429](https://github.com/BerriAI/litellm/pull/37429)
    - Restore tab strip styling and panel persistence lost in the shadcn migration - [PR #37403](https://github.com/BerriAI/litellm/pull/37403)
    - Keep completion-mode models in the playground chat dropdown - [PR #37954](https://github.com/BerriAI/litellm/pull/37954)
- **Cost Optimization**
    - Draw one Per Day savings bar per date, surface the paginated fallback, and drive auto-router usage from the shared time picker - [PR #37643](https://github.com/BerriAI/litellm/pull/37643), [PR #37659](https://github.com/BerriAI/litellm/pull/37659), [PR #37871](https://github.com/BerriAI/litellm/pull/37871)
    - Keep keyword tier rules that target operator-defined tiers when hydrating the edit modal, and pin a default model on the complexity router - [PR #37413](https://github.com/BerriAI/litellm/pull/37413), [PR #36615](https://github.com/BerriAI/litellm/pull/36615)
    - Stop pairing key spend with the team budget when a key has no budget - [PR #37196](https://github.com/BerriAI/litellm/pull/37196)
- **Auth and Management**
    - Make `/team/member_delete`'s four cleanups atomic, and populate team member emails missing from the roster snapshot - [PR #37959](https://github.com/BerriAI/litellm/pull/37959), [PR #37759](https://github.com/BerriAI/litellm/pull/37759)
    - Stop the team fallback from widening model access, and resolve team `object_permission` independently in the unresolvable-team fallback - [PR #37962](https://github.com/BerriAI/litellm/pull/37962), [PR #37960](https://github.com/BerriAI/litellm/pull/37960)
    - Resolve bare model names against wildcard deployments in model access groups, and accept inherited model sentinels in project key limits - [PR #37492](https://github.com/BerriAI/litellm/pull/37492), [PR #37515](https://github.com/BerriAI/litellm/pull/37515)
    - SCIM: match group members by SSO identity or email before creating a placeholder, fail group sync when a member add or user creation fails, propagate team roster write failures, and keep the matched `user_id` on a `POST /Users` email match - [PR #37686](https://github.com/BerriAI/litellm/pull/37686), [PR #37688](https://github.com/BerriAI/litellm/pull/37688), [PR #37700](https://github.com/BerriAI/litellm/pull/37700), [PR #37701](https://github.com/BerriAI/litellm/pull/37701)
    - Retry JWKS fetches, serve stale keys, and return 503 when the IdP is unreachable - [PR #37690](https://github.com/BerriAI/litellm/pull/37690)
    - Cache the team member default budget as a typed model, and capture the requester IP in 401 and auth-time 429 failure logs - [PR #37695](https://github.com/BerriAI/litellm/pull/37695), [PR #37707](https://github.com/BerriAI/litellm/pull/37707)
    - Let org admins view their organization's usage, and return no rows when the aggregated activity entity filter is empty - [PR #37235](https://github.com/BerriAI/litellm/pull/37235), [PR #37414](https://github.com/BerriAI/litellm/pull/37414)
    - Split agent inference and management routes so admin nodes can create agents - [PR #37730](https://github.com/BerriAI/litellm/pull/37730)
    - Initialize the secret manager before resolving `os.environ` config references - [PR #37544](https://github.com/BerriAI/litellm/pull/37544)

## AI Integrations

### Logging

- **[OpenTelemetry](../../docs/observability/opentelemetry_integration)**
    - Emit LLM Call spans for speech, image, moderation, OCR and transcription - [PR #37752](https://github.com/BerriAI/litellm/pull/37752)
    - Bound and shut down credential-scoped tracer providers, and build the credential-scoped Resource once per logger - [PR #36591](https://github.com/BerriAI/litellm/pull/36591), [PR #37542](https://github.com/BerriAI/litellm/pull/37542)
    - Attribute Prisma database spans to PostgreSQL instead of localhost - [PR #36595](https://github.com/BerriAI/litellm/pull/36595)
    - Route Phoenix traces to per-key and per-team projects under OTel v2 - [PR #36706](https://github.com/BerriAI/litellm/pull/36706)
- **[Prometheus](../../docs/proxy/prometheus)**
    - Render `/metrics` off the event loop and coalesce concurrent scrapes - [PR #37702](https://github.com/BerriAI/litellm/pull/37702)
    - Fold auth and pre-call time into `litellm_request_total_latency_metric` - [PR #37958](https://github.com/BerriAI/litellm/pull/37958)
- **[DataDog](../../docs/proxy/logging#datadog)**
    - Normalize alias-derived tag values so metrics match what was sent - [PR #37682](https://github.com/BerriAI/litellm/pull/37682)
- **General**
    - Close three secret-leak paths in verbose logging, strip callback credentials from the auth object stamped into request metadata, and preserve uvicorn `color_message` args during secret redaction - [PR #37391](https://github.com/BerriAI/litellm/pull/37391), [PR #37233](https://github.com/BerriAI/litellm/pull/37233), [PR #37122](https://github.com/BerriAI/litellm/pull/37122)
    - Bound oversized error payloads written to stdout, and bound the shared logging executor backlog - [PR #37684](https://github.com/BerriAI/litellm/pull/37684), [PR #37694](https://github.com/BerriAI/litellm/pull/37694)
    - Stop deepcopying results redaction cannot redact - [PR #36638](https://github.com/BerriAI/litellm/pull/36638)
    - Surface per-request auto-router savings to logging callbacks, and group Codex turns under one session id - [PR #37894](https://github.com/BerriAI/litellm/pull/37894), [PR #37895](https://github.com/BerriAI/litellm/pull/37895)
    - Copy messages before the router call and raise the judge output cap in shadow eval, then drop the unused judge reasoning field and salvage truncated verdicts - [PR #37232](https://github.com/BerriAI/litellm/pull/37232), [PR #37239](https://github.com/BerriAI/litellm/pull/37239)

### Guardrails

- **[Bedrock Guardrails](../../docs/proxy/guardrails/bedrock)**
    - Track Bedrock guardrail usage units per invocation, and count Bedrock guardrail cost against spend and budgets - [PR #37225](https://github.com/BerriAI/litellm/pull/37225), [PR #37362](https://github.com/BerriAI/litellm/pull/37362)
- **[Azure Content Safety](../../docs/proxy/guardrails/quick_start)**
    - Scan text on `/guardrails/apply_guardrail` - [PR #36894](https://github.com/BerriAI/litellm/pull/36894)
- **[Noma](../../docs/proxy/guardrails/quick_start)**
    - Stop sending the conversation twice in the v2 payload - [PR #36764](https://github.com/BerriAI/litellm/pull/36764)
- **General**
    - Close PII and PCI masking gaps in SpendLogs, debug logs and the `logging_only` response - [PR #37965](https://github.com/BerriAI/litellm/pull/37965)
    - Run pre-call guardrails on batch input file uploads, scan batch records with the content hooks that are not guardrails, and omit `litellm_batch_guardrail` when no guardrail acted - [PR #37519](https://github.com/BerriAI/litellm/pull/37519), [PR #37786](https://github.com/BerriAI/litellm/pull/37786), [PR #37964](https://github.com/BerriAI/litellm/pull/37964)
    - Run policy pipelines when the caller sends its own metadata, covering `/v1/messages` and Claude Code - [PR #36889](https://github.com/BerriAI/litellm/pull/36889)
    - Record MCP tool guardrail evaluations and blocks - [PR #36978](https://github.com/BerriAI/litellm/pull/36978)
    - Cap the date window accepted by `/guardrails/usage`, retry usage upserts only on connection errors, and requeue rollup rows dropped after retry exhaustion - [PR #37380](https://github.com/BerriAI/litellm/pull/37380), [PR #37247](https://github.com/BerriAI/litellm/pull/37247), [PR #37387](https://github.com/BerriAI/litellm/pull/37387)
    - Read through to the DB on registry misses so just-created models, guardrails and agents resolve on sibling replicas - [PR #36263](https://github.com/BerriAI/litellm/pull/36263)

### Prompt Management

- **General**
    - Don't route requests without a `prompt_id` to prompt managers that cannot run them - [PR #37575](https://github.com/BerriAI/litellm/pull/37575)

### Secret Managers

- **General**
    - Store the `lite login` credential and its refresh token in the OS keychain instead of a file on disk - [PR #37566](https://github.com/BerriAI/litellm/pull/37566), [PR #37665](https://github.com/BerriAI/litellm/pull/37665)
    - Initialize the secret manager before resolving `os.environ` references in the config - [PR #37544](https://github.com/BerriAI/litellm/pull/37544)

## Spend Tracking, Budgets and Rate Limiting

- **Provisioned throughput**
    - Accrue flat cost for PTU deployments declared in `config.yaml`, on a source-agnostic deployment record - [PR #37556](https://github.com/BerriAI/litellm/pull/37556), [PR #37501](https://github.com/BerriAI/litellm/pull/37501)
    - Refuse an incomplete `config.yaml` reservation the way the endpoints do, require an operator-declared id, never retract a flat charge for a deployment the run cannot see, and warn when a config declares PTU while attribution is off - [PR #37703](https://github.com/BerriAI/litellm/pull/37703), [PR #37794](https://github.com/BerriAI/litellm/pull/37794), [PR #37793](https://github.com/BerriAI/litellm/pull/37793), [PR #37898](https://github.com/BerriAI/litellm/pull/37898)
    - Hand the prune a plain delete filter the query builder can serialise - [PR #37571](https://github.com/BerriAI/litellm/pull/37571)
- **Rate limiting and budgets**
    - Add project-level ITPM and OTPM quotas - [PR #35110](https://github.com/BerriAI/litellm/pull/35110)
    - Make per-model budgets track spend, enforce, and report the same counter - [PR #37736](https://github.com/BerriAI/litellm/pull/37736)
    - Tokenize each request once, off the event loop, for large prompts in budget reservation - [PR #37683](https://github.com/BerriAI/litellm/pull/37683)
    - Elect one sweeper per tick and bound the window scan in the reset budget job, and reconnect and retry on transient DB transport errors - [PR #36497](https://github.com/BerriAI/litellm/pull/36497), [PR #37705](https://github.com/BerriAI/litellm/pull/37705)
    - Add an admin toggle to block requests for models without pricing - [PR #35181](https://github.com/BerriAI/litellm/pull/35181)
- **Spend logs**
    - Hash raw API keys before persisting them to spend logs, so a non-`sk-` or Bearer-prefixed key cannot be stored or shown in plaintext in the Key Hash column - [PR #30736](https://github.com/BerriAI/litellm/pull/30736)
    - Add lifecycle timestamps to spend logs; the `endTime` backfill migration was reverted before the cut - [PR #37361](https://github.com/BerriAI/litellm/pull/37361), [PR #37554](https://github.com/BerriAI/litellm/pull/37554), [PR #37875](https://github.com/BerriAI/litellm/pull/37875)
    - Bound each spend-log write statement by row count as well as bytes - [PR #37758](https://github.com/BerriAI/litellm/pull/37758)
    - Record estimated input tokens and populate deployment attribution on failed-request spend logs - [PR #37365](https://github.com/BerriAI/litellm/pull/37365), [PR #37520](https://github.com/BerriAI/litellm/pull/37520)
    - Log spend for OpenAI passthrough embeddings with unmapped models - [PR #37425](https://github.com/BerriAI/litellm/pull/37425)
- **Cost calculation**
    - Claim batch cost rows atomically so multi-pod polling cannot double-bill - [PR #37685](https://github.com/BerriAI/litellm/pull/37685)
    - Price partial-stream spend rows at the real model and keep the prompt and cache fields - [PR #37734](https://github.com/BerriAI/litellm/pull/37734)
    - Recognize the ultrafast service tier in cost calculation, match streamed Messages usage cost to the recorded spend, and track provider-reported cost when the caller omits `include_usage` - [PR #37355](https://github.com/BerriAI/litellm/pull/37355), [PR #35114](https://github.com/BerriAI/litellm/pull/35114), [PR #35013](https://github.com/BerriAI/litellm/pull/35013), [PR #36593](https://github.com/BerriAI/litellm/pull/36593)
- **Cost map maintenance**
    - Consolidate eleven open registry audits into one changeset, and add provider-announced `deprecation_date` to 205 registry entries - [PR #37658](https://github.com/BerriAI/litellm/pull/37658), [PR #37283](https://github.com/BerriAI/litellm/pull/37283)
    - Apply the GPT-5.6 Sol promotional pricing cut, and correct GPT-5.6 max input tokens to 922K - [PR #37880](https://github.com/BerriAI/litellm/pull/37880), [PR #37722](https://github.com/BerriAI/litellm/pull/37722)
    - Correct Gemini 3.1 flash image and DeepSeek V4 pricing, add OpenAI deprecation dates, and set `prompt_cache_min_tokens=4096` on Gemini 3.5/3.6/3.7 Flash and 3.1 Pro Preview - [PR #37473](https://github.com/BerriAI/litellm/pull/37473), [PR #37516](https://github.com/BerriAI/litellm/pull/37516)
    - Add undated Azure aliases for `gpt-audio-mini` and `gpt-realtime-mini`, and `supports_mid_conversation_system` to bare first-party Claude keys - [PR #37867](https://github.com/BerriAI/litellm/pull/37867), [PR #36969](https://github.com/BerriAI/litellm/pull/36969)
    - Require pricing-owner approval for the model prices JSON files - [PR #37551](https://github.com/BerriAI/litellm/pull/37551)

## MCP Gateway

- **OAuth**
    - Serve token-forwarding servers when OAuth discovery fails, and stop OAuth discovery from causing outages - [PR #37399](https://github.com/BerriAI/litellm/pull/37399), [PR #36599](https://github.com/BerriAI/litellm/pull/36599)
    - Let a salt-key-orphaned OAuth credential be replaced by re-authorization - [PR #37672](https://github.com/BerriAI/litellm/pull/37672)
    - Deny the interactive `dcr_bridge` authorize for a user without server access, and resolve admin OAuth sessions to the same server set the connect page shows - [PR #37865](https://github.com/BerriAI/litellm/pull/37865), [PR #37900](https://github.com/BerriAI/litellm/pull/37900)
    - Scope the authorization server issuer for named MCP servers; note that an earlier attempt at the same fix was reverted in this window - [PR #37204](https://github.com/BerriAI/litellm/pull/37204), [PR #36482](https://github.com/BerriAI/litellm/pull/36482), [PR #37220](https://github.com/BerriAI/litellm/pull/37220)
- **Tools and routing**
    - Bind the tool existence check to the selected server, and strip `root_path` before matching the per-server MCP route spelling - [PR #37388](https://github.com/BerriAI/litellm/pull/37388), [PR #35576](https://github.com/BerriAI/litellm/pull/35576)
    - Forward the per-server auth header on OpenAPI tool calls, and stop reporting failed OpenAPI tool calls as successes - [PR #37410](https://github.com/BerriAI/litellm/pull/37410), [PR #37496](https://github.com/BerriAI/litellm/pull/37496)
    - Normalize auth schemes so MCP egress emits exactly one prefix - [PR #37668](https://github.com/BerriAI/litellm/pull/37668)
    - Attach the per-user BYOK credential when listing tools for non-OAuth2 auth types - [PR #34787](https://github.com/BerriAI/litellm/pull/34787)

## Performance / Loadbalancing / Reliability improvements

- **Routing**
    - Give auto prompt caching deployment affinity, and isolate deployment model info from cached backend metadata - [PR #37689](https://github.com/BerriAI/litellm/pull/37689), [PR #37687](https://github.com/BerriAI/litellm/pull/37687)
    - Route Responses API input through the auto-router, and let a routed deployment's own `litellm_params` beat forwarded auto-router marker params - [PR #37333](https://github.com/BerriAI/litellm/pull/37333), [PR #37615](https://github.com/BerriAI/litellm/pull/37615)
    - Honor key-level tag filtering in pre-routing, keep `acreate_file` fallbacks inside the requested model group, and forward `target_model_names` on file uploads to `litellm_proxy` deployments - [PR #37366](https://github.com/BerriAI/litellm/pull/37366), [PR #37424](https://github.com/BerriAI/litellm/pull/37424), [PR #36240](https://github.com/BerriAI/litellm/pull/36240)
    - Add `router_model_name` to auto-routed response bodies, and stop logging "Could not identify azure model" when the deployment name resolves from the cost map - [PR #37725](https://github.com/BerriAI/litellm/pull/37725), [PR #37869](https://github.com/BerriAI/litellm/pull/37869)
- **Complexity router**
    - Operator-defined tier sets for the LLM classifier, custom classifier plugins via `classifier_type: custom`, a plan-mode tier floor for coding-agent clients, per-tier `litellm_params`, and a business classification rubric preset - [PR #37226](https://github.com/BerriAI/litellm/pull/37226), [PR #37249](https://github.com/BerriAI/litellm/pull/37249), [PR #37230](https://github.com/BerriAI/litellm/pull/37230), [PR #37064](https://github.com/BerriAI/litellm/pull/37064), [PR #37534](https://github.com/BerriAI/litellm/pull/37534)
    - Gate the reasoning override on a non-SIMPLE score - [PR #37500](https://github.com/BerriAI/litellm/pull/37500)
- **Caching**
    - Bound the semantic cache embedding lookup so a dead embedding endpoint cannot block requests, and truncate the semantic cache embedding input - [PR #37742](https://github.com/BerriAI/litellm/pull/37742), [PR #37367](https://github.com/BerriAI/litellm/pull/37367)
    - Preserve the prompt cache for mid-conversation system messages on unflagged Claude models - [PR #36968](https://github.com/BerriAI/litellm/pull/36968)
    - Apply Azure AD and GCP IAM auth to every async Redis client path, and reset only the failed node on a cluster client timeout instead of the whole client - [PR #37740](https://github.com/BerriAI/litellm/pull/37740), [PR #37863](https://github.com/BerriAI/litellm/pull/37863)
- **Proxy runtime**
    - Stop large token counts from blocking the proxy event loop - [PR #37697](https://github.com/BerriAI/litellm/pull/37697)
    - Send SSE keepalives while a slow upstream is still silent, including on assistants runs and A2A streams - [PR #37322](https://github.com/BerriAI/litellm/pull/37322), [PR #37368](https://github.com/BerriAI/litellm/pull/37368)
    - Stop per-request tag and end-user Postgres reads in auth with registry caches - [PR #36801](https://github.com/BerriAI/litellm/pull/36801)
    - Forward `store` and `prompt_cache_key` on chat completions, and map nested `prompt_tokens_details.cache_creation_input_tokens` to `cache_write_tokens` - [PR #33195](https://github.com/BerriAI/litellm/pull/33195), [PR #37377](https://github.com/BerriAI/litellm/pull/37377)
- **Database and deployment**
    - Apply the configured connection params to the read replica URL, and compose `DATABASE_URL_READ_REPLICA` from a reader host secret key in Helm - [PR #37691](https://github.com/BerriAI/litellm/pull/37691), [PR #37109](https://github.com/BerriAI/litellm/pull/37109)
    - Fail the standalone Prisma migration entrypoint on migration errors, but keep a failed `prisma generate` from failing it - [PR #37692](https://github.com/BerriAI/litellm/pull/37692), [PR #37947](https://github.com/BerriAI/litellm/pull/37947)
    - Bound the Helm migrations Job so a blocked migration cannot stall the release, and let `USE_V2_MIGRATION_RESOLVER` select the v2 migration resolver - [PR #36975](https://github.com/BerriAI/litellm/pull/36975), [PR #36258](https://github.com/BerriAI/litellm/pull/36258)
    - Bump the wolfi-base digest for busybox 1.38.0-r1 and openssl 3.6.3-r5, and bump sqlparse to 0.6.0 to clear osv-scan findings - [PR #37950](https://github.com/BerriAI/litellm/pull/37950), [PR #37200](https://github.com/BerriAI/litellm/pull/37200)
- **Typing**
    - Drop roughly 2.6k basedpyright errors across 72 `Any` hotspot files - [PR #37073](https://github.com/BerriAI/litellm/pull/37073), [PR #37439](https://github.com/BerriAI/litellm/pull/37439)

## Documentation Updates

- Note that the Terraform provider now ships at the LiteLLM version - [PR #37912](https://github.com/BerriAI/litellm/pull/37912)

Documentation now lives in [BerriAI/litellm-docs](https://github.com/BerriAI/litellm-docs), so doc changes in this window are counted there rather than in this repository's PR set.

### PR roll-up by ownership area

PRs by ownership area (total: 451)

- UI: 130
- Other (CI / chore / tests / build / version bumps): 67
- Spend / Budgets / Rate Limits: 48
- Performance: 44
- Models & Providers: 43
- LLM API Endpoints: 41
- Logging: 23
- Auth & Management: 22
- MCP: 16
- Guardrails: 15
- Prompt Management: 1
- Docs: 1

## End-to-End Testing

We are investing heavily in end-to-end testing to cut regressions and make LiteLLM more stable release over release. Every version is exercised by a live suite that runs against a real deployed proxy and hits real provider endpoints, not mocks, so the behavior we validate is the behavior you get in production.

This window added 73 test-only pull requests, 14 of them touching the live e2e suite. The headline change is a record-and-replay transport seam: a fixture bundle format, canonical content-based match keys, query params and multipart form fields pinned as part of replay identity, and the seam moved down to the provider edge, so the non-streaming provider flows can be replayed deterministically while the live suite still runs against real providers. New permanent regressions pin prompt-cache, service-tier and cost-header billing, OpenAI passthrough routing and file-list isolation, the OpenAI WebSocket passthrough prefixes, and twelve previously closed issues.

The suite itself was hardened against the failures that were masking real signal: response-cache cross-talk, slow providers and single upstream blips are now tolerated deliberately rather than by luck, blind sleeps are replaced with deadline waits, and live suites were repointed off retired Gemini, Groq, Together AI and Vertex image models. On the ratchet side, six ruff rules now reject tests that cannot fail, `pytest.raises(Exception)` is banned outright, `PT011`/`PT012`/`PT014`/`PT017`/`RUF043` are enforced so a broad raises block cannot pass on the wrong error, and `F811` and `F821` are enforced so a duplicate or undefined name cannot silently replace the first. Thirty test files stranded in a second mirror now actually run, `tests/old_proxy_tests` was retired, and the conftest save/restore inventory is frozen so it can only shrink; the global-state cleanup unwound 182 leaking writes out of the cost-calc suites alone.

## New Contributors

- @ChenluJi made their first contribution in [PR #32448](https://github.com/BerriAI/litellm/pull/32448)
- @Sujithr07 made their first contribution in [PR #33195](https://github.com/BerriAI/litellm/pull/33195)
- @MUSE-CODE-SPACE made their first contribution in [PR #34067](https://github.com/BerriAI/litellm/pull/34067)
- @ayaangazali made their first contribution in [PR #34445](https://github.com/BerriAI/litellm/pull/34445)
- @bhuvan2134686 made their first contribution in [PR #34752](https://github.com/BerriAI/litellm/pull/34752)
- @shivijain2323 made their first contribution in [PR #35110](https://github.com/BerriAI/litellm/pull/35110)
- @Scott-Wilson-ZocDoc made their first contribution in [PR #36032](https://github.com/BerriAI/litellm/pull/36032)
- @LHMQ878 made their first contribution in [PR #36151](https://github.com/BerriAI/litellm/pull/36151)
- @harryzhou2000 made their first contribution in [PR #36355](https://github.com/BerriAI/litellm/pull/36355)
- @irosh-colombage-ZocDoc2 made their first contribution in [PR #36482](https://github.com/BerriAI/litellm/pull/36482)
- @itaimodi made their first contribution in [PR #36764](https://github.com/BerriAI/litellm/pull/36764)
- @brian5021 made their first contribution in [PR #36878](https://github.com/BerriAI/litellm/pull/36878)
- @oneKn8 made their first contribution in [PR #36968](https://github.com/BerriAI/litellm/pull/36968)
- @sailikhithk made their first contribution in [PR #36981](https://github.com/BerriAI/litellm/pull/36981)
- @bruno-olivia made their first contribution in [PR #37242](https://github.com/BerriAI/litellm/pull/37242)
- @longwind48 made their first contribution in [PR #37821](https://github.com/BerriAI/litellm/pull/37821)

Three fixes in this release reached the repository as maintainer-pushed copies so the full CI pipeline could run against them, with commit authorship preserved: [PR #37867](https://github.com/BerriAI/litellm/pull/37867), [PR #37868](https://github.com/BerriAI/litellm/pull/37868) and [PR #37869](https://github.com/BerriAI/litellm/pull/37869) are @mihidumh's work, and [PR #37219](https://github.com/BerriAI/litellm/pull/37219) is @marty-sullivan's.

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.98.0...v1.99.0
