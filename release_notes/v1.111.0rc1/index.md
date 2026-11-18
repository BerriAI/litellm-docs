---
title: "LiteLLM v1.111.0rc1 adds Customer Management and performance alerts"
description: "Adds Customer Management with budgets for customer orgs, teams and members, performance alerts, Claude Fable 5.2 and Mythos 5.2, and Gemini 4 Carbon."
slug: "v1-111-0-rc-1"
date: 2026-11-18T02:22:41
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
docker.litellm.ai/berriai/litellm:1.111.0-rc.1
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.111.0rc1
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.111.0-rc.1`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.111.0-rc.1) and the full [releases page](https://github.com/BerriAI/litellm/releases).

The published GitHub tag is `v1.111.0-rc.1`. These notes compare it with `v1.110.0-rc.3`, the previous release candidate. Changes backported onto `rc/1.110.0` and already shipped in `v1.110.0` are omitted.

Customer-facing changes come first. Test, CI and internal changes are listed at the bottom.

:::danger Breaking Changes

Changes from [`v1.110.0`](https://github.com/BerriAI/litellm/releases/tag/v1.110.0), the latest stable release, that may need action when upgrading.

- **Packaging**: the Docker image now runs as non-root by default, and we consolidated to one image (no more `litellm-database` or `litellm-non_root`) and one Helm chart, `helm/litellm` - [PR #43332](https://github.com/BerriAI/litellm/pull/43332), [PR #43330](https://github.com/BerriAI/litellm/pull/43330)
- **Vertex AI**: client-supplied `vertex_location` and `vertex_project` are rejected unless the admin opts in - [PR #47028](https://github.com/BerriAI/litellm/pull/47028)
- **SSO and JWT sign-in**: the email fallback only links to an unlinked user with an exact, verified email match. Set `LITELLM_EMAIL_FALLBACK_LINKS_ANY_USER=true` for the old behavior - [PR #51897](https://github.com/BerriAI/litellm/pull/51897)
- **Chat Completions**: a message without a `role` now returns 400 - [PR #51124](https://github.com/BerriAI/litellm/pull/51124)
- **Bedrock**: a `service_tier` the model cannot serve now returns 400 unless unsupported params are dropped - [PR #50516](https://github.com/BerriAI/litellm/pull/50516)
- **Management APIs**: `/customer/new` and `/customer/update` reject unknown fields, and key, user, team and project writes reject unknown guardrail names - [PR #50965](https://github.com/BerriAI/litellm/pull/50965), [PR #51080](https://github.com/BerriAI/litellm/pull/51080)

:::

## Key Highlights

`v1.111.0rc1` is the current release candidate for 1.111.0.

- **Customer Management**: a customer organization, team and member hierarchy with budget templates, rollups, per-level rate limits, daily usage and its own dashboard area
- **Performance alerts**: an Alerts page that flags spend and traffic spikes, slower responses and higher error rates against the previous seven days, on by default with opt-in daily summaries by email and Slack
- **Rust gateway**: Anthropic, Bedrock Invoke and Azure AI Foundry Claude `/v1/messages` run only on Rust, budgets are held and settled by a Rust engine, and the S3 logger is now a Rust callback
- **Faster streams, less memory**: streams close right after their last event, which removes a 30 to 100 ms hold, and the Rust router frees finished requests instead of keeping them until a full garbage collection
- **Dynamic rate limiter**: teams and customer organizations can borrow idle model capacity up to a cap, priority class shares split among active teams, and a `rate_limited_by` header names the limit behind a 429
- **New models and providers**: Claude Fable 5.2 and Mythos 5.2 across Anthropic, Bedrock, Vertex AI and Azure, Gemini 4 Carbon and Hydrogen, Microsoft Web IQ search, and Replicate video, image and speech generation
- **One image, one chart**: a single non-root Docker image with one entrypoint, and `helm/litellm` as the only Helm chart with a monolith mode

## New Providers and Endpoints

### New Providers (1 new provider)

| Provider | Supported LiteLLM Endpoints | Description |
| --- | --- | --- |
| Microsoft Web IQ | `/v1/search` | Native web search provider under `webiq/`, usable from the SDK, the gateway and the Admin UI search tool picker |

## New Models / Updated Models

#### New Model Support (98 new models, plus 1,020 fal.ai and Replicate models)

Counts represent new catalog identifiers compared with `v1.110.0`, including aliases and regional variants. Prices are the values bundled in this release, in USD, and runtime pricing-map reloads can update them. Two retired FriendliAI rows were removed, `friendliai/MiniMaxAI/MiniMax-M2.5` and `friendliai/deepseek-ai/DeepSeek-V3.2`.

- **fal.ai**: 736 new image and video models, including FLUX (122), Kling (52), Hailuo and MiniMax (37), Seedance (16) and Nano Banana 2.1
- **Replicate**: 284 new image, video, text and speech models, including FLUX (46), Wan (21), MiniMax (10), Nano Banana 2.1 and ElevenLabs speech

<details>
<summary>All 98 other new catalog entries</summary>

| Provider | Model | Context Window | Input ($/1M tokens) | Output ($/1M tokens) | Features / special pricing |
| --- | --- | --- | --- | --- | --- |
| Amazon Bedrock | `anthropic.claude-fable-5-2` | 1,000,000 | $8 | $40 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `anthropic.claude-mythos-5-2` | 1,000,000 | $8 | $40 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `bedrock/claude_platform/claude-fable-5-2` | 1,000,000 | $8 | $40 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use; Web search |
| Amazon Bedrock | `bedrock/us-gov-east-1/anthropic.claude-fable-5-2` | 1,000,000 | $9.6 | $48 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `bedrock/us-gov-east-1/anthropic.claude-mythos-5-2` | 1,000,000 | $9.6 | $48 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `bedrock/us-gov-west-1/anthropic.claude-fable-5-2` | 1,000,000 | $9.6 | $48 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `bedrock/us-gov-west-1/anthropic.claude-mythos-5-2` | 1,000,000 | $9.6 | $48 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `eu.anthropic.claude-fable-5-2` | 1,000,000 | $8.8 | $44 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `eu.anthropic.claude-mythos-5-2` | 1,000,000 | $8.8 | $44 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `global.anthropic.claude-fable-5-2` | 1,000,000 | $8 | $40 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `global.anthropic.claude-mythos-5-2` | 1,000,000 | $8 | $40 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `us-gov.anthropic.claude-fable-5-2` | 1,000,000 | $9.6 | $48 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `us-gov.anthropic.claude-mythos-5-2` | 1,000,000 | $9.6 | $48 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `us.anthropic.claude-fable-5-2` | 1,000,000 | $8.8 | $44 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock | `us.anthropic.claude-mythos-5-2` | 1,000,000 | $8.8 | $44 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Amazon Bedrock Mantle | `bedrock_mantle/us-gov-east-1/openai.gpt-5.6-cyber` | 922,000 | $16.875 | $101.25 | Responses; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Anthropic | `claude-fable-5-2` | 1,000,000 | $8 | $40 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use; Web search |
| Anthropic | `claude-mythos-5-2` | 1,000,000 | $8 | $40 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Azure AI | `azure_ai/claude-fable-5-2` | 1,000,000 | $8 | $40 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use; Web search |
| Azure AI | `azure_ai/claude-fable-5-2-fast` | 1,000,000 | $16 | $80 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use; Web search |
| Azure AI | `azure_ai/claude-mythos-5-2` | 1,000,000 | $8 | $40 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use; Web search |
| Azure AI | `azure_ai/claude-mythos-5-2-fast` | 1,000,000 | $16 | $80 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use; Web search |
| Azure AI | `azure_ai/deepseek-v4.1-flash-1017` | 1,000,000 | $0.3 | $1.2 | Chat; Prompt caching |
| Azure AI | `azure_ai/mistral-large-4-latest` | 1,048,576 | $0.7 | $2.1 | Chat; Reasoning; Vision; Tool calling; Structured output |
| Databricks | `databricks/databricks-claude-fable-5-2` | 1,000,000 | $8 | $40 | Chat; Reasoning; Vision; Tool calling; Prompt caching |
| Databricks | `databricks/databricks-gemini-4-carbon` | 1,048,576 | $2 | $10 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Audio input; Video input |
| Databricks | `databricks/system.ai.claude-fable-5-2` | 1,000,000 | $8 | $40 | Chat; Reasoning; Vision; Tool calling; Prompt caching |
| Databricks | `databricks/system.ai.gemini-4-carbon` | 1,048,576 | $2 | $10 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Audio input; Video input |
| DeepInfra | `deepinfra/XiaomiMiMo/MiMo-V2.6-Flash` | 1,048,576 | $0.14 | $0.28 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Audio input; Video input |
| DeepInfra | `deepinfra/nvidia/NVIDIA-Nemotron-3.5-Super-VL` | 262,144 | $0.15 | $0.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Video input |
| DeepInfra | `deepinfra/tencent/Hy4-preview` | 1,048,576 | $0.834 | $2.501 | Chat; Reasoning; Tool calling; Prompt caching; Structured output |
| DeepInfra | `deepinfra/zai-org/GLM-5.3-Flash` | 1,048,576 | $0.15 | $0.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; Video input |
| Fireworks AI | `fireworks_ai/accounts/fireworks/routers/deepseek-flash-latest` | 1,048,576 | $0.3 | $1.2 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Fireworks AI | `fireworks_ai/accounts/fireworks/routers/glm-fast-latest` | 1,048,576 | $2.1 | $6.6 | Chat; Reasoning; Tool calling; Structured output |
| Fireworks AI | `fireworks_ai/accounts/fireworks/routers/glm-flash-latest` | 1,048,576 | $0.15 | $0.5 | Chat; Vision; Tool calling; Structured output |
| Fireworks AI | `fireworks_ai/accounts/fireworks/routers/glm-latest` | 1,048,576 | $1.4 | $4.4 | Chat; Reasoning; Tool calling; Structured output |
| Fireworks AI | `fireworks_ai/accounts/fireworks/routers/kimi-fast-latest` | 1,048,576 | $4.5 | $22.5 | Chat; Reasoning; Vision; Tool calling; Structured output |
| Fireworks AI | `fireworks_ai/accounts/fireworks/routers/kimi-latest` | 1,048,576 | $3 | $15 | Chat; Reasoning; Vision; Tool calling; Structured output |
| Fireworks AI | `fireworks_ai/accounts/fireworks/routers/minimax-latest` | 512,000 | $0.3 | $1.2 | Chat; Reasoning; Vision; Tool calling; Structured output |
| Fireworks AI | `fireworks_ai/accounts/fireworks/routers/qwen-max-latest` | 262,144 | $2 | $6 | Chat; Reasoning; Vision; Tool calling; Structured output |
| Gemini | `gemini/gemini-4-carbon` | 1,048,576 | $2 | $10 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use; Web search; Audio input; Video input |
| Gemini | `gemini/gemini-decision-1` | 262,144 | $0.1 | $0 | Decisions; Vision; PDF input; Audio input; Video input |
| Gemini | `gemini/nano-banana-latest` | 131,072 | $1.5 | $7.5 | Image generation; Reasoning; Vision; PDF input; Web search; $0.0336 per image; Alias of `gemini/gemini-nano-banana-2.1` |
| GitHub Copilot | `github_copilot/claude-fable-5.2` | 200,000 | $8 | $40 | Chat; Reasoning; Vision; Tool calling; Structured output |
| GitHub Copilot | `github_copilot/gemini-4-carbon` | 200,000 | $2 | $10 | Chat; Reasoning; Vision; Tool calling |
| GitHub Copilot | `github_copilot/gemini-4-hydrogen` | 200,000 | $1.5 | $7.5 | Chat; Reasoning; Vision; Tool calling |
| GMI Cloud | `gmi/google/gemini-4-carbon` | 1,048,576 | $2 | $10 | Chat |
| GMI Cloud | `gmi/xai/grok4.7` | 500,000 | $2 | $6 | Chat |
| Meta | `meta/muse-ember-1.0` | 1,048,576 | $0.1 | $0.5 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search |
| MiniMax | `minimax/MiniMax-M3.1-Flash` | 1,000,000 | $0.15 | $0.6 | Chat; Reasoning; Vision; Tool calling; Prompt caching |
| Nace | `nace/drex-max` | 262,144 | $0.03 | $0 | Evaluation; Vision |
| Nace | `nace/drex-max-v1.1` | 262,144 | $0.03 | $0 | Evaluation; Vision |
| Perplexity | `perplexity/anthropic/claude-fable-5-2` | - | $8 | $40 | Responses |
| Perplexity | `perplexity/google/gemini-4-carbon` | - | $2 | $10 | Responses |
| Perplexity | `perplexity/google/gemini-4-hydrogen` | - | $1.5 | $7.5 | Responses |
| Runway | `runwayml/bria_fibo_edit_1_5` | - | - | - | Image generation; $0.05 per image |
| Runway | `runwayml/eleven_v3` | - | - | - | Text to speech; $0.0002 per character |
| Runway | `runwayml/eleven_v4` | - | - | - | Text to speech; $0.00005 per character |
| Runway | `runwayml/gemini_2.5_flash` | - | - | - | Image generation; $0.05 per image |
| Runway | `runwayml/gemini_image3.1_flash_lite` | - | - | - | Image generation; $0.04 per image |
| Runway | `runwayml/gemini_omni_flash_1.1` | - | - | - | Video generation; $0.1 per second |
| Runway | `runwayml/gemini_omni_flash_1.2` | - | - | - | Video generation; $0.07 per second |
| Runway | `runwayml/grok_imagine_1_5` | - | - | - | Video generation; $0.16 per second |
| Runway | `runwayml/grok_imagine_1_5_lite` | - | - | - | Video generation; $0.03 per second |
| Runway | `runwayml/h3_max` | - | - | - | Video generation; $0.08 per second |
| Runway | `runwayml/happyhorse_1_0` | - | - | - | Video generation; $0.15 per second |
| Runway | `runwayml/kling2.5_turbo_pro` | - | - | - | Video generation; $0.12 per second |
| Runway | `runwayml/kling3.0_4k` | - | - | - | Video generation; $0.43 per second |
| Runway | `runwayml/kling3.0_pro` | - | - | - | Video generation; $0.17 per second |
| Runway | `runwayml/kling3.0_standard` | - | - | - | Video generation; $0.13 per second |
| Runway | `runwayml/klingO3_4k` | - | - | - | Video generation; $0.43 per second |
| Runway | `runwayml/klingO3_pro` | - | - | - | Video generation; $0.17 per second |
| Runway | `runwayml/klingO3_standard` | - | - | - | Video generation; $0.13 per second |
| Runway | `runwayml/kling_4` | - | - | - | Video generation; $0.1256 per second |
| Runway | `runwayml/kling_4_flash` | - | - | - | Video generation; $0.094 per second |
| Runway | `runwayml/muse_image` | - | - | - | Image generation; $0.01 per image |
| Runway | `runwayml/seedance-latest` | - | - | - | Video generation; $0.3 per second; Alias of `runwayml/seedance2_5` |
| Runway | `runwayml/seedream5_flash` | - | - | - | Image generation; $0.02 per image |
| Runway | `runwayml/seedream5_lite` | - | - | - | Image generation; $0.04 per image |
| Runway | `runwayml/wan3` | - | - | - | Video generation; $0.1 per second |
| Runway | `runwayml/wan3_prime` | - | - | - | Video generation; $0.14 per second |
| Soniox | `soniox/stt-async-v6` | 8,000 | - | - | Audio transcription; Audio input; $0.000028 per second |
| Soniox | `soniox/stt-rt-v6` | - | - | - | Audio transcription; Audio input |
| Together AI | `together_ai/elorian-labs/glimpse-1.0` | 262,144 | $0.6 | $3 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Together AI | `together_ai/thinkingmachines/Inkling-2-Small` | 1,048,576 | $0.3 | $1 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output |
| Vercel AI Gateway | `vercel_ai_gateway/openai/gpt-6-luna-decisions` | 1,050,000 | $0.1 | $0 | Evaluation |
| Vercel AI Gateway | `vercel_ai_gateway/typesafe-ai/jev` | 32,000 | $0.042 | $0 | Evaluation; Vision |
| Vercel AI Gateway | `vercel_ai_gateway/typesafe-ai/jev-1.13.0` | 32,000 | $0.042 | $0 | Evaluation; Vision |
| Vercel AI Gateway | `vercel_ai_gateway/typesafe-ai/jev-1.14.0` | 32,000 | $0.042 | $0 | Evaluation; Vision |
| Vertex AI | `vertex_ai/claude-fable-5-2` | 1,000,000 | $8 | $40 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Vertex AI | `vertex_ai/claude-fable-5-2@default` | 1,000,000 | $8 | $40 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Vertex AI | `vertex_ai/claude-mythos-5-2` | 1,000,000 | $8 | $40 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Vertex AI | `vertex_ai/claude-mythos-5-2@default` | 1,000,000 | $8 | $40 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use |
| Vertex AI | `vertex_ai/deep-research-preview-04-2026` | - | $2 | $12 | Chat |
| Vertex AI | `vertex_ai/gemini-4-carbon` | 1,048,576 | $2 | $10 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Computer use; Web search; Audio input; Video input |
| Vertex AI | `vertex_ai/gemini-4-carbon-cyber-permissive` | 1,048,576 | $4 | $20 | Chat; Reasoning; Vision; Tool calling; Prompt caching; Structured output; PDF input; Web search; Audio input; Video input |
| Vertex AI | `vertex_ai/nano-banana-latest` | 131,072 | $1.5 | $7.5 | Image generation; Reasoning; Vision; Prompt caching; PDF input; Web search; Video input; $0.0336 per image; Alias of `vertex_ai/gemini-nano-banana-2.1` |
| WebIQ | `webiq/search` | - | - | - | Search |

</details>

### Decisions providers

- Add the Nace `drex-max` decision model, send images inline the way Nace reads them, and let the Auto Router pick a tier with `drex-max` through `provider: nace` - [PR #48426](https://github.com/BerriAI/litellm/pull/48426)
- Add Vercel AI Gateway as a Decisions provider, so Decisions requests for its models reach the gateway instead of failing with a 400 and spend is reported instead of zero - [PR #50642](https://github.com/BerriAI/litellm/pull/50642)

### New providers

- Add Microsoft Web IQ as a native search provider, usable through the SDK and gateway and selectable in the Admin UI - [PR #50883](https://github.com/BerriAI/litellm/pull/50883)

### Amazon Bedrock

- Answer 400 for service tiers a Bedrock model cannot serve instead of silently ignoring them, forward the reserved tier to Bedrock, and let auto pick the tier, so requests are no longer billed at a faster price they did not get - [PR #50516](https://github.com/BerriAI/litellm/pull/50516)
- Send `s3://` image, document and video URLs to Bedrock Converse as S3 sources in chat, Responses, Messages and Gemini generateContent requests, so Nova models read the file instead of the gateway returning a 500 - [PR #50577](https://github.com/BerriAI/litellm/pull/50577)
- Answer 400 instead of 500 for malformed Bedrock count-tokens requests such as a missing or empty `messages` list, a message without a role or content, or a model id that is only a region prefix - [PR #50708](https://github.com/BerriAI/litellm/pull/50708)
- Add GovCloud in-region pricing rows for Bedrock Claude Fable 5.2 and Mythos 5.2 in `us-gov-east-1` and `us-gov-west-1`, so spend is tracked for those keys - [PR #50746](https://github.com/BerriAI/litellm/pull/50746)
- Fix Bedrock catalog rows by using GovCloud end-of-life dates from the lifecycle table, adding a GovCloud Mantle row for GPT-5.6 Cyber and correcting the Daybreak Blue input limit - [PR #51095](https://github.com/BerriAI/litellm/pull/51095)
- Send `max_tokens` and `priority` in Bedrock and SageMaker Cohere embedding requests instead of silently dropping them, so callers can cap how much of each input is embedded - [PR #51435](https://github.com/BerriAI/litellm/pull/51435)
- Put `extra_body` fields inside `modelInput` for Bedrock async-invoke embeddings, so Nova and TwelveLabs options passed this way now reach the model - [PR #51676](https://github.com/BerriAI/litellm/pull/51676)
- Clamp Bedrock effort before the `drop_params` effort gate, so `xhigh` on Opus 4.6 is sent as `output_config.effort="max"` instead of being dropped - [PR #51972](https://github.com/BerriAI/litellm/pull/51972)

### Anthropic

- Add `claude-fable-5-2` and its `bedrock/claude_platform/claude-fable-5-2` Claude Platform on AWS mirror to the cost map, so both rows have pricing and model info - [PR #50715](https://github.com/BerriAI/litellm/pull/50715)

### Azure

- Add `azure_ai/claude-fable-5-2` and `claude-fable-5-2-fast` to the cost map from the Azure Foundry Claude page, with 1M context and 128K max output - [PR #50723](https://github.com/BerriAI/litellm/pull/50723)
- Mark the `azure_ai` Claude rows that bill web search as `supports_web_search`, so callers that gate on the flag no longer hide a tool Azure supports - [PR #50960](https://github.com/BerriAI/litellm/pull/50960)
- Add `azure_ai/mistral-large-4-latest` to the model catalog at Mistral's list price, with the retirement date taken from the Azure Models API - [PR #51047](https://github.com/BerriAI/litellm/pull/51047)
- Swap an API version that is too old for Azure Responses with the default Responses version, so Azure `gpt-6` chat requests with tools stop failing with a 400 - [PR #51116](https://github.com/BerriAI/litellm/pull/51116)
- Strip the GPT-5 routing marker from the deployment name on Azure Responses requests, so Azure receives the real deployment name instead of the marker - [PR #51438](https://github.com/BerriAI/litellm/pull/51438)
- Send `reasoning_effort` to Kimi K3 on Azure AI Foundry and keep its `reasoning_content` across tool calls, so Claude Code sessions stop losing the model's earlier thinking - [PR #51747](https://github.com/BerriAI/litellm/pull/51747)
- Drop the Python traceback from Azure stream-cut errors sent to clients and Slack alerts, so a mid-response drop shows a short error line instead of server file paths repeated several times - [PR #51760](https://github.com/BerriAI/litellm/pull/51760)
- Send no `api-version` on Foundry project `/openai/v1` Responses bases, so Azure deployments pointed at those URLs stop failing every Responses and chat call - [PR #51767](https://github.com/BerriAI/litellm/pull/51767)

### Gemini and Vertex AI

- Resolve the correct default `max_tokens` for versioned Claude ids on Vertex AI, so requests without `max_tokens` stop being rejected on models capped below the old 128000 fallback, such as Haiku 4.5 - [PR #40376](https://github.com/BerriAI/litellm/pull/40376)
- Add Claude Fable 5.2 on Vertex AI and point `claude-fable-latest` at it, so `vertex_ai/claude-fable-5-2` has model info and tracks spend - [PR #50713](https://github.com/BerriAI/litellm/pull/50713)
- Add a setting that labels Vertex calls with the caller's key, team, org and project names, so Cloud Billing can split Vertex spend by label. The proxy drops any identity labels callers try to set - [PR #50732](https://github.com/BerriAI/litellm/pull/50732)
- Add `gemini/gemini-4-carbon` with Standard, Batch, Flex and Priority prices, token limits and capability flags, so requests to it are cost tracked - [PR #50931](https://github.com/BerriAI/litellm/pull/50931)
- Add `vertex_ai/claude-mythos-5-2` and `vertex_ai/claude-mythos-5-2@default` to the cost map, so lookups work and spend no longer bills at $0 - [PR #50940](https://github.com/BerriAI/litellm/pull/50940)
- Add `vertex_ai/gemini-4-carbon` and `vertex_ai/gemini-4-carbon-cyber-permissive` with Standard, Priority and Batch prices from the Vertex pricing page - [PR #50942](https://github.com/BerriAI/litellm/pull/50942)
- Give the Gemini 4 Carbon rows the shared Gemini 3 free tier of 5,000 grounding queries a month, so grounded calls stop billing from the first query - [PR #50951](https://github.com/BerriAI/litellm/pull/50951)
- Give the Gemini 4 Argon rows the shared Gemini 3 free tier of 5,000 grounding queries a month, so grounded calls stop billing from the first query - [PR #50959](https://github.com/BerriAI/litellm/pull/50959)
- Add the missing batch and flex tier prices to the Gemini `-latest` alias rows, including batch context caching and the above 200k prompt prices for `gemini-pro-latest` - [PR #51150](https://github.com/BerriAI/litellm/pull/51150)
- Drop floor-only retirement dates on twelve Vertex rows, update the Veo 3.1 successor and fix the `gemini-3.1-flash-image` input token limit, following the Vertex model pages - [PR #51180](https://github.com/BerriAI/litellm/pull/51180)
- Add `gemini/gemini-decision-1` to the model catalog at $0.10 per 1M input tokens, so Decisions API spend on it can be tracked - [PR #51215](https://github.com/BerriAI/litellm/pull/51215)
- Reuse one Google token per worker across Vertex AI RAG Engine searches and cold bursts, so 21 searches on a 2-worker proxy cost 2 token fetches instead of one per search - [PR #51239](https://github.com/BerriAI/litellm/pull/51239)
- Add `gemini/gemini-4-hydrogen` to the cost map with prices from the Gemini API pricing page, so calls to it are costed instead of logged at zero - [PR #51423](https://github.com/BerriAI/litellm/pull/51423)
- Add `vertex_ai/gemini-4-hydrogen` to the cost map with prices from the Vertex pricing page, covering Standard, Priority and Flex or Batch tiers - [PR #51432](https://github.com/BerriAI/litellm/pull/51432)
- Move the November 17 shutdown date on Gemini TTS and Live preview rows to the dates on Google's deprecations page, which are December 18, 2026 and March 31, 2027 - [PR #51657](https://github.com/BerriAI/litellm/pull/51657)
- Send `extra_body` fields flat as predict parameters for Vertex BGE embedding models, like other Vertex text embedding models, instead of nesting them under `parameters.extra_body` - [PR #51662](https://github.com/BerriAI/litellm/pull/51662)
- Report PDF tokens and cost on Vertex Gemini `embedContent` responses, priced at the image rate, so PDF embeddings no longer show 0 tokens and $0 - [PR #51673](https://github.com/BerriAI/litellm/pull/51673)
- Send `document_ocr`, `audio_track_extraction` and `auto_truncate` on Gemini embeddings for both regular and batch requests, since they were silently ignored before - [PR #51686](https://github.com/BerriAI/litellm/pull/51686)
- Drop the Flex price fields from three Vertex AI Gemini 4 rows, because Google does not support Flex PayGo on Gemini 4 and costs were being calculated from prices that cannot apply - [PR #51735](https://github.com/BerriAI/litellm/pull/51735)
- Stream Gemini text-to-speech audio in `delta.audio` on chat completions, so streaming TTS requests return audio instead of only an empty final stop chunk - [PR #51750](https://github.com/BerriAI/litellm/pull/51750)
- Send union-root tool schemas as `parametersJsonSchema` on Vertex AI and the Gemini API, so tools whose parameters allow one of several shapes no longer fail with a 400 - [PR #51835](https://github.com/BerriAI/litellm/pull/51835)

### OpenAI

- Add batch prices for `gpt-image-2.6-sunburst` and `gpt-image-2.6-flare` and drop the long context batch prices OpenAI no longer publishes for `gpt-5.5-pro`, so batch image calls are no longer billed at double the price - [PR #51647](https://github.com/BerriAI/litellm/pull/51647)
- Cap and bill web search rounds on OpenAI chat completions sent through the Responses API, so an admin's cap is honored instead of searching on until the request fails with a 500 - [PR #51802](https://github.com/BerriAI/litellm/pull/51802)

### Other providers

- Give each streamed tool call from `ollama_chat/` models its own index, so OpenAI-style clients assemble several tool calls instead of one call with glued-together arguments - [PR #49183](https://github.com/BerriAI/litellm/pull/49183)
- Forward `reasoning_effort` to MiniMax models the cost map marks as reasoning, so low and high effort requests behave differently, and add `MiniMax-M3.1-Flash` to the cost map - [PR #49583](https://github.com/BerriAI/litellm/pull/49583)
- Stop emitting an empty assistant choice between the finish chunk and the usage chunk in OpenRouter streams, so clients that treat a post-finish choice as accounting data still see usage - [PR #50210](https://github.com/BerriAI/litellm/pull/50210)
- Omit an empty `tools` list from `hosted_vllm` chat requests, along with `tool_choice` and `parallel_tool_calls`, so vLLM-style backends stop returning a 400 - [PR #50812](https://github.com/BerriAI/litellm/pull/50812)
- Raise an error on failed OpenRouter non-streaming completions that come back as HTTP 200, so callers can retry or fall back, while still recording tokens and cost - [PR #50880](https://github.com/BerriAI/litellm/pull/50880)
- Add Databricks `claude-fable-5-2`, date the `glm-5-2` retirement and correct the `llama-3-1-8b` context window, following the Databricks supported-models page - [PR #51076](https://github.com/BerriAI/litellm/pull/51076)
- Price Databricks `claude-fable-5-2` from the proprietary pricing page instead of Bedrock-inherited prices, and fix the cache read price that was set equal to input - [PR #51232](https://github.com/BerriAI/litellm/pull/51232)
- Send Magistral reasoning to Mistral as its supported native levels instead of prompt instructions, so thinking stays separate from the answer. Invalid reasoning settings return a clear error unless dropping unsupported params is on - [PR #51329](https://github.com/BerriAI/litellm/pull/51329)
- Add Replicate video generation, image generation and text to speech through the predictions API, so `/v1/videos`, `/v1/images/generations` and `/v1/audio/speech` work with `replicate/` models instead of failing - [PR #51360](https://github.com/BerriAI/litellm/pull/51360)
- Add fal.ai Nano Banana 2.1, bill it from the `x-fal-billable-units` header and route `google/` models correctly, so `fal_ai/google/nano-banana-2.1` stops returning a 404 and billing zero - [PR #51410](https://github.com/BerriAI/litellm/pull/51410)
- Support GitHub App authentication for the GitHub Copilot provider. Admins upload the App's PEM key in the dashboard, where it is stored encrypted and installation tokens refresh automatically, with a separate credential per application - [PR #51427](https://github.com/BerriAI/litellm/pull/51427)
- Register Ollama deployment prices from the built-in catalog without calling the provider, so setting up a deployment no longer hits the default local Ollama address - [PR #51561](https://github.com/BerriAI/litellm/pull/51561)
- Mark `together_ai/elorian-labs/glimpse-1.0` as supporting function calling and structured outputs, matching Together's documentation - [PR #51612](https://github.com/BerriAI/litellm/pull/51612)
- Declare `low`, `medium` and `high` reasoning effort for `mistral/mistral-large-4` and `mistral/mistral-large-4-0`, so a requested low or medium level is no longer sent to Mistral as high - [PR #51693](https://github.com/BerriAI/litellm/pull/51693)
- Stop listing 23 retired Together AI ids under the `together_ai/*` wildcard on `/v1/models`, so picking a listed model no longer ends in a 400 - [PR #51827](https://github.com/BerriAI/litellm/pull/51827)

### Model catalog and pricing

- Add Bedrock Fable 5.2 and Mythos 5.2 rows plus Azure realtime cache, Vertex and Friendli registry updates to the cost map, with both registry copies kept identical - [PR #50707](https://github.com/BerriAI/litellm/pull/50707)
- Add `gpt-6-cyber` long context prices from the OpenAI pricing page, so requests above 272K input tokens bill at the right rate - [PR #50770](https://github.com/BerriAI/litellm/pull/50770)
- Add the `github_copilot/claude-fable-5.2` row from the Copilot models and pricing table, so the model resolves a price - [PR #50775](https://github.com/BerriAI/litellm/pull/50775)
- Price `wandb/deepseek-ai/DeepSeek-V4.1-Flash-1017` at the CoreWeave Forge listed input, cached input and output rates instead of prices inherited from DeepSeek-V4.1-Flash - [PR #50776](https://github.com/BerriAI/litellm/pull/50776)
- Add `claude-mythos-5-2` on the Anthropic API and Azure AI, drop an unsupported Mantle token counting model from GovCloud Fable 5.2, and add the Friendli GLM-5.1 deprecation date - [PR #50777](https://github.com/BerriAI/litellm/pull/50777)
- Add the 2027-02-10 shutdown date for `gpt-image-2` from the OpenAI deprecations page - [PR #50829](https://github.com/BerriAI/litellm/pull/50829)
- Add `together_ai/elorian-labs/glimpse-1.0` priced from the Together models API, so its spend stops tracking at zero - [PR #50830](https://github.com/BerriAI/litellm/pull/50830)
- Add `meta/muse-ember-1.0` with base and long-context rates from the Meta pricing page, so its requests resolve a price - [PR #50847](https://github.com/BerriAI/litellm/pull/50847)
- Fix registry metadata for Together, Mistral, Fireworks, Azure AI and Copilot models after the 2026-11-10 audit, with field-level changes cited to official provider pages - [PR #51003](https://github.com/BerriAI/litellm/pull/51003)
- Add `github_copilot/gemini-4-carbon` to the model catalog so the newly launched Copilot model has pricing and limits and works with cost tracking - [PR #51012](https://github.com/BerriAI/litellm/pull/51012)
- Update the `together_ai/together/Tev1-4B-experimental` input price to match what the Together models API returns, so spend for this model is calculated at the published rate - [PR #51013](https://github.com/BerriAI/litellm/pull/51013)
- Add the first batch of `fal_ai` image and video models to the cost map, priced from each fal.ai model page and linked to its source, so their spend is tracked - [PR #51035](https://github.com/BerriAI/litellm/pull/51035)
- Add 282 Replicate models to the cost map priced from each model page, and add a source link to the 25 existing rows, so Replicate spend is tracked for official models - [PR #51067](https://github.com/BerriAI/litellm/pull/51067)
- Update Tencent Hy4 and Hy4 preview costs to the current TokenHub promotional rates, which are half the list price, and add a December 31, 2026 reminder to revisit them - [PR #51072](https://github.com/BerriAI/litellm/pull/51072)
- Add 61 more `fal_ai` image and video models to the cost map, priced from their fal.ai model pages with source links, so their spend is tracked - [PR #51077](https://github.com/BerriAI/litellm/pull/51077)
- Add `replicate/google/gemini-4-carbon` to the model catalog, priced from the Replicate model page - [PR #51125](https://github.com/BerriAI/litellm/pull/51125)
- Add three more `fal_ai` rows to the cost map, priced from the fal pricing API and model pages, so their spend is tracked - [PR #51126](https://github.com/BerriAI/litellm/pull/51126)
- Add 19 Fal endpoints and Databricks Gemini 4 Carbon rows, restore three DeepInfra prices and fix Bedrock Kimi K2.5 priority and GLM 5 flex pricing, so spend on these models is billed correctly - [PR #51193](https://github.com/BerriAI/litellm/pull/51193)
- Add 24 `runwayml` models to the cost map and correct the `seedance2` and `eleven_multilingual_v2` rates to match the Runway pricing page - [PR #51216](https://github.com/BerriAI/litellm/pull/51216)
- Record the deprecation source and the successor model on the three dated Fireworks `deepseek-v4-flash` rows, with no change to prices or limits, so deprecation notices point users to the right replacement - [PR #51285](https://github.com/BerriAI/litellm/pull/51285)
- Add batch and priority image output token prices to `gemini/gemini-2.5-flash-image`, so image generation under those tiers is billed at the stated rate instead of the Standard rate - [PR #51368](https://github.com/BerriAI/litellm/pull/51368)
- Update the cost map with the xAI retired image rates, rows for Kling 4, GMI Gemini 4 Carbon and Grok 4.7, and `-latest` aliases for Seedance and Nano Banana, so spend stops tracking at the wrong rate - [PR #51395](https://github.com/BerriAI/litellm/pull/51395)
- Add seven fal.ai cost map rows for Seedream 5.5, Flux virtual try-on, Patina material and Vidu templates, so calls to these models are no longer tracked at zero spend - [PR #51407](https://github.com/BerriAI/litellm/pull/51407)
- Add cost map rows for Azure DeepSeek V4.1 Flash 1017 and two Perplexity Agent API models, so calls to them are no longer logged at zero spend - [PR #51444](https://github.com/BerriAI/litellm/pull/51444)
- Point `gpt-image-1-mini`, `gpt-image-1.5` and `chatgpt-image-latest` at the GPT-Image-2.6 models as their successor, following OpenAI's updated recommendation for the December 1 2026 shutdown - [PR #51475](https://github.com/BerriAI/litellm/pull/51475)
- Point the deprecated Fireworks `deepseek-v4-flash` rows at the live `deepseek-v4p1-flash` as successor, since the previous successor is itself retired - [PR #51478](https://github.com/BerriAI/litellm/pull/51478)
- Point `gpt-5`, `gpt-5-mini`, `gpt-5-nano`, `gpt-5-pro`, `o3` and `o3-pro` at the GPT-6 models as successor, following OpenAI's updated recommendation for the December 11 2026 shutdown - [PR #51492](https://github.com/BerriAI/litellm/pull/51492)
- Add `fal_ai/google/gemini-omni-flash/v1.2/upscale` to the cost map, priced per second of upscaled video, so calls to it are no longer unpriced - [PR #51500](https://github.com/BerriAI/litellm/pull/51500)
- Add `together_ai/thinkingmachines/Inkling-2-Small` to the cost map with prices from the Together models API, so its spend is no longer tracked at zero - [PR #51501](https://github.com/BerriAI/litellm/pull/51501)
- Restore backward compatibility for cost map loading after the Rust loader move, so a cost map with a non-object top-level value such as a `_comment` string loads again instead of failing - [PR #51545](https://github.com/BerriAI/litellm/pull/51545)
- Add `fal_ai/decart/lucy-5b/image-to-video` to the cost map at $0.15 per video, taken from its fal.ai page - [PR #51551](https://github.com/BerriAI/litellm/pull/51551)
- Record `gpt-audio-1.5` and `gpt-realtime-1.5` as the successors for the `gpt-4o-mini-audio-preview-2024-12-17` and `gpt-4o-mini-realtime-preview-2024-12-17` snapshots in the cost map - [PR #51563](https://github.com/BerriAI/litellm/pull/51563)
- Record the November 19, 2026 retirement and successor for `databricks/databricks-gemini-3-6-flash` in the cost map - [PR #51593](https://github.com/BerriAI/litellm/pull/51593)
- Add Soniox v6 and DeepInfra cost map rows, correct capabilities and prices that provider docs contradict, and date the retirements of Soniox, Bedrock Claude and Azure Whisper models - [PR #51620](https://github.com/BerriAI/litellm/pull/51620)
- Add `github_copilot/gemini-4-hydrogen` to the cost map, taken from the GitHub Copilot changelog launch post - [PR #51696](https://github.com/BerriAI/litellm/pull/51696)
- Add the 4K output rate to `runwayml/seedance2_5` as `output_cost_per_second_4k`, so 4K generations are no longer costed at the 720p base rate - [PR #51697](https://github.com/BerriAI/litellm/pull/51697)
- Move the retirement date for `azure_ai/claude-haiku-4-5` and `azure_ai/claude-opus-4-5` to 2027-03-16, so `/model/deprecations` stops warning about dates Azure no longer publishes - [PR #51716](https://github.com/BerriAI/litellm/pull/51716)
- Add two fal.ai Seedream 5.0 Pro US rows, edit and text-to-image, priced per image from the endpoint pages - [PR #51881](https://github.com/BerriAI/litellm/pull/51881)

## LLM API Endpoints

### Responses API

- Keep the `namespace == name` shape for deferred top-level function tools returned from `/v1/responses`, matching what the OpenAI Agents SDK expects for tool search with `defer_loading: true` - [PR #50602](https://github.com/BerriAI/litellm/pull/50602)
- Send the streamed `/v1/responses` fallback metadata as a typed `litellm.fallback_metadata` Responses event, so OpenAI SDK clients no longer misread it as an audio delta event - [PR #50804](https://github.com/BerriAI/litellm/pull/50804)
- Replay Claude tool search on `/v1/responses` follow-up turns, return the tool search output on turn one, and stop Anthropic 400 errors when a follow-up drops a loaded tool - [PR #50821](https://github.com/BerriAI/litellm/pull/50821)
- Keep reasoning item IDs consistent across streaming events and completed responses, so clients that track items by ID no longer see duplicate entries, across HTTP, WebSocket, completion bridges and Rust handlers - [PR #51243](https://github.com/BerriAI/litellm/pull/51243)
- Accept a string or tuple `allowed_openai_params` on Responses API models, so chat and `/v1/messages` requests stop failing with a 500 "can only concatenate list" error - [PR #51751](https://github.com/BerriAI/litellm/pull/51751)

### Chat Completions

- Download PDF URLs with the async client on streamed chat requests so the event loop is no longer blocked, and run the message transform once instead of twice for async OpenAI-compatible calls - [PR #49176](https://github.com/BerriAI/litellm/pull/49176)
- Accept the Responses API's flat `allowed_tools` `tool_choice` layout on chat completions instead of returning 400, and drop it when a provider cannot enforce it and `drop_params` is on - [PR #50467](https://github.com/BerriAI/litellm/pull/50467)
- Keep unset-effort `gpt-5.4` and `gpt-5.5` tool calls on Chat Completions for OpenAI and Azure instead of bridging to `/responses`, avoiding extra translation layer bugs - [PR #50968](https://github.com/BerriAI/litellm/pull/50968)
- Log the GPT-5 `reasoning_effort` drop warning only when the provider really gets no effort, so Azure users stop editing settings for a problem they do not have - [PR #50995](https://github.com/BerriAI/litellm/pull/50995)
- Answer 400 with OpenAI's message and `param` for a chat message sent without a role, instead of sending it upstream as an assistant turn, and keep that 400 out of cooldown counts - [PR #51124](https://github.com/BerriAI/litellm/pull/51124)
- Run baggage tag mappings, auth checks and budget reservation on `/queue/chat/completions`, so queued chat calls are tagged and limited the same way as `/v1/chat/completions` - [PR #51753](https://github.com/BerriAI/litellm/pull/51753)
- Return Claude thinking blocks on the Rust gateway's chat completions instead of a 500, so it matches the Python proxy when Claude thinks before answering - [PR #51774](https://github.com/BerriAI/litellm/pull/51774)

### Anthropic Messages API

- Reset the upstream connection when an abandoned `/v1/messages` stream on `bedrock/invoke/*` closes early, so aborted Bedrock Invoke streams actually stop - [PR #50657](https://github.com/BerriAI/litellm/pull/50657)
- Apply `additional_drop_params` on `/v1/messages` before the unsupported param checks, so a deployment set to drop a param like `top_k` no longer answers 400 when a client sends it - [PR #50753](https://github.com/BerriAI/litellm/pull/50753)
- Forward message threads on native `/v1/messages` so Claude Code with threads on keeps its chat and tools, and keep `error.details.error_code` intact so SDK replay works - [PR #50976](https://github.com/BerriAI/litellm/pull/50976)
- Drop the stale beta label from the `/v1/messages` and token counting Swagger tags so users can see these endpoints are stable - [PR #51046](https://github.com/BerriAI/litellm/pull/51046)
- Restore synchronous iteration for streamed `/v1/messages` calls routed to OpenAI or Azure, so apps using a plain for loop work again and closing a stream early also closes the upstream connection - [PR #51305](https://github.com/BerriAI/litellm/pull/51305)
- Serve Bedrock invoke Messages requests only through the Rust gateway, with request rewriting, AWS credentials, SigV4 signing and stream error handling ported from Python - [PR #51330](https://github.com/BerriAI/litellm/pull/51330)
- Close nested objects in strict JSON schemas on the Messages to Responses bridge, as the Chat bridge already does, so strict schema requests to OpenAI models through `/v1/messages` stop failing with a 400 - [PR #51337](https://github.com/BerriAI/litellm/pull/51337)
- Keep Anthropic's signed empty thinking blocks on the Rust Messages path, so they still match the thinking sections stored on Anthropic's side - [PR #51349](https://github.com/BerriAI/litellm/pull/51349)
- Pass only the `user_id` from Anthropic request metadata to Rust, so a hook that sets metadata to a large object no longer breaks the Rust Messages path - [PR #51355](https://github.com/BerriAI/litellm/pull/51355)
- Name the deployment in the error when a Rust `/v1/messages` stream drops or stalls mid-stream, so callers get `litellm_debug_info` instead of a raw transport error - [PR #51358](https://github.com/BerriAI/litellm/pull/51358)
- Stop requiring Redis to import the Messages streaming path, so Anthropic and Bedrock streams keep their success callbacks, cost tracking and logging when Redis is not installed - [PR #51685](https://github.com/BerriAI/litellm/pull/51685)
- Serve Claude on Azure AI Foundry through `/v1/messages` on the Rust gateway only, with parity fixes so callers see no change while non-Claude azure_ai models keep their Python path - [PR #51721](https://github.com/BerriAI/litellm/pull/51721)
- Apply a deployment's `litellm_params` such as `thinking`, `system`, `tools` and `stream` on `/v1/messages` in the Rust gateway when the client omits them, and fill model capabilities from the cost map so Claude 5.5 stops answering 400 - [PR #51834](https://github.com/BerriAI/litellm/pull/51834)
- Close several high and medium Rust `/v1/messages` parity gaps, including signing Bedrock invoke with SigV4 when `api_key` is empty, so the Rust gateway matches the Python proxy - [PR #52042](https://github.com/BerriAI/litellm/pull/52042)

### Count tokens

- Count Mistral tokens with Mistral's own `/v1/responses/input_tokens` endpoint instead of a local estimate, so counts match Mistral's tokenizer and billing - [PR #50653](https://github.com/BerriAI/litellm/pull/50653)
- Send a prompt-only `call_endpoint=true` token count to the provider count API on Anthropic, OpenAI and Azure AI too, so Claude counts match the provider instead of a low local estimate - [PR #50783](https://github.com/BerriAI/litellm/pull/50783)
- Return the `x-litellm-call-id` header on every token count response, matching the id in the proxy's token count log line, so a count that looks wrong can be traced to its log - [PR #51037](https://github.com/BerriAI/litellm/pull/51037)
- Count tokens with the `thinking`, reasoning effort and `tool_choice` that inference sends, so proxy counts match provider billing for Claude and DeepSeek V4 instead of coming back low - [PR #51079](https://github.com/BerriAI/litellm/pull/51079)
- Count the request's `tool_choice` on the token count routes, so forcing a tool or turning tools off is counted the way OpenAI and xAI bill it instead of the same as unset - [PR #51133](https://github.com/BerriAI/litellm/pull/51133)
- Answer 400 `invalid_request_error` instead of 500 on `/v1/messages/count_tokens` when a message has no `role` or `content` on Anthropic and Azure AI deployments, naming the message - [PR #51284](https://github.com/BerriAI/litellm/pull/51284)
- Count Anthropic conversations that add or remove tools mid-conversation, including inline tool definitions and tool references, and keep removed tool definitions counted as Anthropic does, instead of rejecting those blocks - [PR #51447](https://github.com/BerriAI/litellm/pull/51447)

### Prompt caching

- Send `cache_control` as a `prompt_cache_breakpoint` on the chat-to-Responses bridge, so function tool requests to GPT models served through the Responses API keep the client's cache marks - [PR #51783](https://github.com/BerriAI/litellm/pull/51783)

### Batches and files

- Let teams use their own allowed S3 buckets for batch jobs and file uploads, in addition to the global allowlist, so individual teams can be given their own buckets - [PR #50571](https://github.com/BerriAI/litellm/pull/50571)
- Send managed batch file uploads to the batch deployment of a mixed model group even when a chat deployment has a lower order, so the follow-up batch create stops getting a 400 from Azure - [PR #50971](https://github.com/BerriAI/litellm/pull/50971)
- Retrieve and delete a managed file when the request also names a model through the routing header or the `model` query param, instead of answering 404 on providers like OpenAI - [PR #51780](https://github.com/BerriAI/litellm/pull/51780)

### Pass-through endpoints

- Publish opted-in pass-through endpoints on the public Model Hub with a readable name, so users can find non-LLM routes such as an NER service next to the models - [PR #43905](https://github.com/BerriAI/litellm/pull/43905)
- Add an Amazon OpenSearch index pass-through with per-key and per-team read or write grants. LiteLLM signs each call with its own AWS credentials so apps never hold them - [PR #50573](https://github.com/BerriAI/litellm/pull/50573)
- Forward `x-pass-` headers on the `/bedrock/model` pass-through routes, so guardrail and request metadata headers sent on invoke now reach AWS - [PR #50728](https://github.com/BerriAI/litellm/pull/50728)
- Log and bill Titan embedding replies on the Bedrock `/invoke` passthrough as embeddings with the provider's token count and image charge, so they are no longer missing from spend logs - [PR #51701](https://github.com/BerriAI/litellm/pull/51701)

### Images, audio and video

- Support gpt-image edits on Azure AI Foundry by using the same deployment route and multipart format as Azure OpenAI, so `azure_ai` image edits with gpt-image models stop failing before the request is sent - [PR #49650](https://github.com/BerriAI/litellm/pull/49650)
- Measure audio duration for multipart uploads that pass a `Path` inside a tuple, so the locally calculated duration is kept when the provider does not return one - [PR #49806](https://github.com/BerriAI/litellm/pull/49806)
- Answer malformed Replicate video `seconds` with a 400 and drop non-decimal `size` digits, instead of returning 500 or 503 for values like `nan`, `1e999` or `abc` - [PR #51670](https://github.com/BerriAI/litellm/pull/51670)

### Embeddings and rerank

- Honor `COHERE_API_BASE` for Cohere embeddings, so gateway users no longer send their gateway key to api.cohere.ai and get 401s, matching rerank and chat - [PR #50249](https://github.com/BerriAI/litellm/pull/50249)
- Honor `cancel_on_disconnect` on the rerank endpoints, so a client disconnect drops the upstream provider connection like it already does on other inference endpoints - [PR #51252](https://github.com/BerriAI/litellm/pull/51252)
- Unwrap `extra_body` into the provider request body for Bedrock, Gemini, Vertex, Ollama, SageMaker and NVIDIA NIM embeddings, so extra fields stop being sent as a literal `extra_body` key and ignored - [PR #51335](https://github.com/BerriAI/litellm/pull/51335)

### Vector stores

- Return a LiteLLM managed file id from RAG ingest through a team's OpenAI wildcard model and use the team's OpenAI credentials on vector store file routes, so getting, reading or detaching the file stops failing with a bad API key error - [PR #50459](https://github.com/BerriAI/litellm/pull/50459)
- Let Bedrock knowledge bases on multimodal embedding models be searched with an image through vector store search, and return the matching images instead of failing or running as a text search - [PR #51063](https://github.com/BerriAI/litellm/pull/51063)
- Map OpenAI-style vector store search filters to OpenSearch k-NN filters and add optional hybrid search that mixes keyword and vector ranking, so exact ids such as incident numbers rank first - [PR #51131](https://github.com/BerriAI/litellm/pull/51131)
- Map OpenAI style vector store search filters to the AWS `RetrievalFilter` shape on Bedrock Knowledge Bases, so filtered searches stop failing with an AWS 400 and a malformed filter gets a clear 400 before AWS is called - [PR #51291](https://github.com/BerriAI/litellm/pull/51291)

### General

- Serve Codex its own Bedrock runtime and Mantle model catalog entries for Bedrock deployments, so Codex sees the models it can actually call through LiteLLM - [PR #50743](https://github.com/BerriAI/litellm/pull/50743)
- Let custom providers registered through `custom_provider_map` serve native Gemini `generateContent`, so a model group can mix a real Gemini leg with a custom leg for Google GenAI SDK traffic - [PR #51083](https://github.com/BerriAI/litellm/pull/51083)
- Support `gemini/gemini-decision-1` on `/v1/decisions` and `/v1/systemone` with spend tracking, instead of failing with Unknown Decisions provider 'gemini' - [PR #51220](https://github.com/BerriAI/litellm/pull/51220)
- Route Vertex Interactions GET, cancel and DELETE calls through the selected deployment, check access to that deployment and fix the Vertex cancellation URL, so lifecycle calls hit the same project as the create call - [PR #51511](https://github.com/BerriAI/litellm/pull/51511)
- Bind Vertex Deep Research agents to their own deployments, add a cost map row so their jobs stop logging at $0, and extend background cost polling to 130 minutes so long runs are still billed - [PR #51517](https://github.com/BerriAI/litellm/pull/51517)

## Management Endpoints / UI

### Admin UI

- Keep the Request Logs model cell to the model of the row's own call with a small +N count for others, and keep the full list in the hover popup, so long sessions stop widening the column - [PR #49619](https://github.com/BerriAI/litellm/pull/49619)
- Serve Next.js navigation payloads under the `/ui` prefix so prefetching works again instead of returning 404, which makes Admin UI page navigation faster - [PR #50758](https://github.com/BerriAI/litellm/pull/50758)
- Keep the upgrade notice off the request path and count patch notes written with an area label, so the banner stops saying 0 new features and the first dashboard request no longer waits on an airgapped proxy - [PR #51027](https://github.com/BerriAI/litellm/pull/51027)
- Let admins set per-threshold budget alert recipients on virtual keys from the Admin UI, using the backend support that already existed - [PR #51061](https://github.com/BerriAI/litellm/pull/51061)
- Remove the deprecated API Reference page, its route and its Developer Tools sidebar entry from the Admin UI - [PR #51246](https://github.com/BerriAI/litellm/pull/51246)
- Remove the deprecated Learning Resources link from the Developer Tools sidebar in the Admin UI - [PR #51251](https://github.com/BerriAI/litellm/pull/51251)
- Let admins restore an older retained skill version as a new version from the Skill Hub, with an optional note, instead of re-uploading files by hand. Non-admins and stale or concurrent updates are rejected - [PR #51309](https://github.com/BerriAI/litellm/pull/51309)
- Let authors edit and withdraw their own pending skill submissions from the Skill Hub. Ownership and pending state are checked inside database transactions, stale approvals are rejected and scans are cleared after an edit - [PR #51312](https://github.com/BerriAI/litellm/pull/51312)
- Remove the standalone Model Leaderboard page since Usage already covers the comparisons, and redirect both old bookmark formats to Usage. The backend APIs and shared charts stay - [PR #51426](https://github.com/BerriAI/litellm/pull/51426)
- Add a Hide Aria Agent for everyone setting under UI Settings, so admins can remove Aria from navigation, the Usage page, shortcuts and direct Aria URLs for the whole deployment - [PR #51506](https://github.com/BerriAI/litellm/pull/51506)
- Add a vector stores tab to access group forms and list a group's stores by name, including on each team's page, so vector store access is visible and editable in the dashboard - [PR #51581](https://github.com/BerriAI/litellm/pull/51581)
- Let admins control Aria access for internal users with the `aria_internal_user_access` setting, so they can hide Aria or let it answer questions about team spend, not just their own - [PR #51641](https://github.com/BerriAI/litellm/pull/51641)

### Customer Management

- Add a Customer Management (beta) mode to the Admin UI with pages to list, create, edit, block and unblock customers and to see their usage and the keys billed to them - [PR #50807](https://github.com/BerriAI/litellm/pull/50807)
- Show daily model usage, totals, rankings and a date picker on customer pages, filtered to the selected customer on the server, above the Keys list - [PR #51419](https://github.com/BerriAI/litellm/pull/51419)
- Remove the standalone Chargebacks page from the Customer Management and show chargebacks on the home screen only, along with its navigation entry, routing and translations - [PR #51474](https://github.com/BerriAI/litellm/pull/51474)
- Show customer organization usage and budget utilization in the list, with spend, requests, tokens, budget percentages and member counts, so organizations can be compared across reporting periods - [PR #51483](https://github.com/BerriAI/litellm/pull/51483)
- Add Teams, Members and Settings pages to customer organizations in the dashboard, so admins can edit display names and budgets, pick member budget templates and manage overrides without changing IDs - [PR #51507](https://github.com/BerriAI/litellm/pull/51507)
- Add detail pages for customer organizations with Usage, Customer teams, Customer members and Settings tabs, so admins can create and manage customer teams and members from the dashboard - [PR #51521](https://github.com/BerriAI/litellm/pull/51521)
- Read and submit the API's existing `budget_id` in the customer member budget form instead of an unsupported template field, which also fixes the dashboard build and typecheck - [PR #51523](https://github.com/BerriAI/litellm/pull/51523)
- Add idempotent customer org and customer member upsert APIs so provisioning retries succeed, and reject duplicate customer org aliases with a 409 so they stop breaking customer requests - [PR #51607](https://github.com/BerriAI/litellm/pull/51607)
- Pick a customer organization's default budget template by name on create and by id on patch, so the default no longer has to be flagged by hand and can be moved later - [PR #51636](https://github.com/BerriAI/litellm/pull/51636)
- Align customer budget displays with recorded reset windows, so monthly and yearly profiles stop showing No cap, calendar totals stop marking a member's budget exhausted and the table matches the management summary - [PR #51658](https://github.com/BerriAI/litellm/pull/51658)
- Add an atomic budget group editor for existing customers, so grouped saves commit in one step, background refreshes keep drafts and scalar templates no longer block unrelated edits - [PR #51661](https://github.com/BerriAI/litellm/pull/51661)
- Show member spend right after Usage over time and above Top models on the customer usage page, so admins no longer scroll past the model table to see who spent - [PR #51677](https://github.com/BerriAI/litellm/pull/51677)
- Make the customer organization, team and member settings tab full width, so the form lines up with the header and tabs instead of sitting in a narrow left column - [PR #51700](https://github.com/BerriAI/litellm/pull/51700)
- Show overall customer usage totals and let admins sort customers by budget, so totals no longer cover only the visible page and newly created customers stop appearing last - [PR #51713](https://github.com/BerriAI/litellm/pull/51713)
- Reuse the new usage spend design across customer teams and members tables, so every customer management table looks and behaves the same - [PR #51724](https://github.com/BerriAI/litellm/pull/51724)
- Rename Customer Portal to Customer Management across every user-facing label, matching the product's new name - [PR #51891](https://github.com/BerriAI/litellm/pull/51891)
- Clarify customer usage periods and keep selected date ranges when navigating, so customer detail views include today's UTC usage after local midnight diverges - [PR #51899](https://github.com/BerriAI/litellm/pull/51899)
- Default the Customer Management usage range to month to date, so opening it with no dates stops showing the full calendar month and carrying future end dates into org links - [PR #51923](https://github.com/BerriAI/litellm/pull/51923)

### Alerts

- Add a persisted alerts table and APIs to list, read and update alert status. Admins and view-only admins can read alerts and only admins can resolve, dismiss or reopen them - [PR #50658](https://github.com/BerriAI/litellm/pull/50658)
- Add opt-in alerts for spend spikes, traffic changes, slower responses and higher error rates by comparing yesterday's usage with the previous seven-day average across the gateway, models, teams, users and keys - [PR #50666](https://github.com/BerriAI/litellm/pull/50666)
- Name the API base, model group and deployment in stream error alerts for Anthropic chat, `/v1/completions`, `/v1/responses` and `/v1/messages`, so admins can tell which deployment broke mid-stream - [PR #51034](https://github.com/BerriAI/litellm/pull/51034)
- Show performance alerts and model deprecations together on the Alerts page, with usage graphs, links to the affected resource's Activity page, and options to resolve or dismiss alerts - [PR #51104](https://github.com/BerriAI/litellm/pull/51104)
- Turn performance monitoring on by default with an admin switch to turn it off, giving non-Enterprise gateways five performance alerts before detection stops and Enterprise gateways no limit - [PR #51123](https://github.com/BerriAI/litellm/pull/51123)
- Stop detecting traffic drops in performance alerts and keep only traffic spikes, so quiet days no longer create drop alerts across many resources - [PR #51338](https://github.com/BerriAI/litellm/pull/51338)
- Add a Manage alerts control for admins with a gateway-wide switch for deprecation alerts and opt-in daily performance summaries by email and Slack, and update email setup text to cover both categories - [PR #51418](https://github.com/BerriAI/litellm/pull/51418)

### Keys, teams and authentication

- Reject client-supplied Vertex location and project values unless the admin opts in, so callers cannot point the proxy's Google service account at a project or region the admin did not choose - [PR #47028](https://github.com/BerriAI/litellm/pull/47028)
- Let access groups hold vector stores, so admins no longer add stores to each key or team one by one and the stores count like ones on the team's or key's own list - [PR #50290](https://github.com/BerriAI/litellm/pull/50290)
- Grant existing access groups through principal attribute rules, so admins can map a JWT claim to an access group while editable profile fields never become a source of access - [PR #50455](https://github.com/BerriAI/litellm/pull/50455)
- Build the dashboard plugin session claim only from FIPS provider key derivation, random generator, AES and HMAC when `general_settings.fips_mode` is true - [PR #50544](https://github.com/BerriAI/litellm/pull/50544)
- Return 403 naming `/team/member_add` instead of 503 when budget enforcement finds a team user with no membership row, so the error tells admins how to fix the key - [PR #50603](https://github.com/BerriAI/litellm/pull/50603)
- Reject unknown fields on `/customer/new` and `/customer/update` with a 422 naming each field instead of silently dropping them, so typos like `tpm_limti` no longer look applied - [PR #50965](https://github.com/BerriAI/litellm/pull/50965)
- Allow keys limited to `management_routes` to call `PATCH /model/{model_id}/update`, so partial model updates no longer return a 403 - [PR #50979](https://github.com/BerriAI/litellm/pull/50979)
- Recheck users that were cached as missing when resolving CLI session grants, so a freshly signed-in user is no longer rejected as not existing after a burst of concurrent sign-ins - [PR #51030](https://github.com/BerriAI/litellm/pull/51030)
- Reject unknown guardrail names when creating or updating keys, users, teams and projects, so typos and non-existent guardrails can no longer be stored - [PR #51080](https://github.com/BerriAI/litellm/pull/51080)
- Check model access against the model the handler actually selects on Google generation and Azure-style image URL routes, while keeping configured model overrides and normal budget fallbacks - [PR #51226](https://github.com/BerriAI/litellm/pull/51226)
- Allow checking video status and downloading completed videos after a key's overall or per-model budget runs out, while new video generation stays budget-limited - [PR #51227](https://github.com/BerriAI/litellm/pull/51227)
- Honor user, team and team access group grants for private skills in the dashboard, so members see the private skills they have access to, and add a direct Skills grant control in user settings - [PR #51416](https://github.com/BerriAI/litellm/pull/51416)
- Enforce model access groups when a request pins a deployment ID, while keeping valid wildcard permissions working - [PR #51442](https://github.com/BerriAI/litellm/pull/51442)
- Email key owners before their opted-in virtual keys expire, using a background job with a global on switch and per key opt-in, so owners get advance notice instead of sudden 401s - [PR #51482](https://github.com/BerriAI/litellm/pull/51482)
- Return vector store names on access group responses and list the vector stores a team gets through its access groups on team info, so the dashboard can show both - [PR #51484](https://github.com/BerriAI/litellm/pull/51484)
- Let dashboard sessions use the user's team models and team access groups, so Aria stops showing No available models for users whose model access comes only from a team - [PR #51663](https://github.com/BerriAI/litellm/pull/51663)
- Keep the `x-litellm-spend-logs-metadata` header when a request fails authentication, including invalid keys and exceeded budgets, so failure spend logs and callbacks carry the caller metadata - [PR #51745](https://github.com/BerriAI/litellm/pull/51745)
- Match the sign-in email fallback to the right user for JWT and UI SSO, so a new sign-in id only picks an unlinked user whose email matches exactly and is not flagged unverified - [PR #51897](https://github.com/BerriAI/litellm/pull/51897)

### SSO and SCIM

- Fix Microsoft and Google SSO sign-in returning a 500 about a missing client secret when an admin removes the SSO client at the same moment, by reading the secret together with the client id - [PR #50773](https://github.com/BerriAI/litellm/pull/50773)
- Skip SCIM groups that have no matching team, so a PATCH or PUT from the identity provider still deactivates the user instead of answering 404 and leaving their keys working - [PR #51829](https://github.com/BerriAI/litellm/pull/51829)

### Model management

- List callable ids for partial aliases like `team1/gpt-*` over a catch-all deployment, so every listed model id works instead of returning a 400 - [PR #50963](https://github.com/BerriAI/litellm/pull/50963)
- Log Test Connection spend with the mode's call type and model id, so image and other non-chat health checks stop recording $0 and a blank `model_id` in spend logs - [PR #50987](https://github.com/BerriAI/litellm/pull/50987)
- List key and team model aliases on `/model_group/info` and apply listing callbacks to them, so pi, OpenCode and Codex show the alias with its context window and reasoning levels - [PR #51754](https://github.com/BerriAI/litellm/pull/51754)
- Stop wildcard aliases over an org the provider does not have from listing every catalog id on the models endpoints, where each listed model then failed with a 404 - [PR #51805](https://github.com/BerriAI/litellm/pull/51805)
- Stop team model writes from pulling in proxy-level settings by refusing new `os.environ/` values from anyone but a proxy admin, while team admins can still save a model they send back unchanged - [PR #51874](https://github.com/BerriAI/litellm/pull/51874)

### Usage and analytics

- Add an Activity tab to key, team, user and model detail pages that reuses the Usage charts and APIs, so usage is visible without leaving the page - [PR #50630](https://github.com/BerriAI/litellm/pull/50630)
- Open the Logs drawer by `request_id` first and only fall back to `litellm_call_id`, so it stops hanging for 30 seconds on spend logs tables that lack the call id index - [PR #50789](https://github.com/BerriAI/litellm/pull/50789)

### Proxy configuration

- Hash MCP advisory-lock keys with SHA-256 when `fips_mode` is on, so creating or renaming an MCP server and saving a user's MCP env vars stop returning 500 on a FIPS Python - [PR #51165](https://github.com/BerriAI/litellm/pull/51165)
- Make fallback configuration writes atomic in PostgreSQL and serve the fallback GET from saved configuration immediately, so concurrent writes stop overwriting each other and Terraform stops failing on stale replica reads - [PR #51245](https://github.com/BerriAI/litellm/pull/51245)
- Restore the `/budget/new` and `/budget/update` operation ids that the admin MCP connector pins, after a handler rename changed them - [PR #51959](https://github.com/BerriAI/litellm/pull/51959)

### CLI and coding agents

- Send the whole model catalog to Codex 0.166.0-alpha.1 and newer instead of a list trimmed to 1 MB, since older Codex versions discard larger lists and newer ones no longer do - [PR #50736](https://github.com/BerriAI/litellm/pull/50736)
- List images in the Codex catalog only for models the cost map says support vision, and turn it off when any deployment behind a model has it off - [PR #50738](https://github.com/BerriAI/litellm/pull/50738)
- Add a CLI command that connects a per-user GitHub Copilot credential through a device code on github.com, so developers without Admin UI access can link their own account - [PR #50863](https://github.com/BerriAI/litellm/pull/50863)
- Point Claude Code's `apiKeyHelper` at `lite auth print-token` after `lite login --pkce --config-claude`, so the key renews itself and developers stop hitting 401 Expired Key and re-approving SSO every day - [PR #51319](https://github.com/BerriAI/litellm/pull/51319)

## AI Integrations

### Guardrails

- Add CollieAi as a native guardrail that checks prompts and responses against a CollieAi policy. It observes only by default, logs each finding in the guardrail log, and enforces when block mode is set in config - [PR #49224](https://github.com/BerriAI/litellm/pull/49224)
- Apply agent-scoped Rubrik policies using `rac_agent_id` from key or team metadata, and moderate `/v1/completions` prompts before the model call so text-completion prompts no longer reach the webhook unchecked - [PR #49912](https://github.com/BerriAI/litellm/pull/49912)
- Stream the guardrail block message when a block happens after an SSE keepalive ping on chat, text completion and Anthropic messages requests, instead of ending the stream in an error - [PR #51114](https://github.com/BerriAI/litellm/pull/51114)
- Write guardrail create, update and delete changes to the audit log, storing only a fixed list of fields so secrets are never recorded - [PR #51118](https://github.com/BerriAI/litellm/pull/51118)
- Add a `stream_mode` option, per phase logging and fail open handling for Straiker 408, 429 and 500 responses, and answer a blocked prompt with an HTTP 200 reply instead of a 400 on chat, messages and responses routes - [PR #51401](https://github.com/BerriAI/litellm/pull/51401)

### Logging and observability

- Serialize `litellm.Message` objects passed as `messages` in `langfuse_otel`, `weave_otel` and `langtrace`, so token usage and model parameters are recorded and the per-call error stops appearing - [PR #46845](https://github.com/BerriAI/litellm/pull/46845)
- Record `litellm_overhead_latency_metric` for streamed requests, including the proxy's first-chunk work, so the Prometheus overhead metric is no longer missing for streams - [PR #49920](https://github.com/BerriAI/litellm/pull/49920)
- Let a key's logging callback entry reference a gateway credential set by a proxy admin, so per-key Arize tracing no longer needs credentials pasted into every key's metadata - [PR #50572](https://github.com/BerriAI/litellm/pull/50572)
- Let a team or key OTel v2 destination set its own `baggage_metadata_keys`, so teams on a shared proxy can choose which request metadata reaches their traces without an env var change - [PR #50813](https://github.com/BerriAI/litellm/pull/50813)
- Add the CustomLoggerV2 types, dispatcher and callback call sites, wrapping every legacy `CustomLogger` as a V2 callback so native V2 callbacks can sit anywhere in the same ordered list - [PR #51214](https://github.com/BerriAI/litellm/pull/51214)
- Send the Langfuse environment, release and version on OTel v2 traces, so `LANGFUSE_TRACING_ENVIRONMENT` and per key or team `langfuse_environment` stop landing in the `default` environment - [PR #51385](https://github.com/BerriAI/litellm/pull/51385)
- Add three Prometheus series for the dynamic rate limiter covering a team's share on a model, how far it runs past that share, and why it was throttled, with a `reason` label matching the 429 `rate_limited_by` header - [PR #51417](https://github.com/BerriAI/litellm/pull/51417)
- Report the provider's actual model in `gen_ai.response.model` on experimental GenAI traces instead of the client facing alias, when `OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental` is set - [PR #51430](https://github.com/BerriAI/litellm/pull/51430)
- Mark provider token usage as unknown on failed chat spans when none was recovered, and add a separate estimated input token count for text-only prompts. Billing and successful request usage stay the same - [PR #51443](https://github.com/BerriAI/litellm/pull/51443)
- Add the contract for Rust callbacks in CustomLoggerV2, including the typed fields they read and how they ask Python for data mid-call. No Rust callback ships in this change - [PR #51526](https://github.com/BerriAI/litellm/pull/51526)
- Reserve span capacity only for pending failure usage fields in Langfuse OTEL, so failed requests near the attribute limit keep their existing attributes and still report usage - [PR #51538](https://github.com/BerriAI/litellm/pull/51538)
- Replace the Python `s3_v2` logger with a Rust callback that keeps the same name, settings, object keys, batching and retries, so S3 logging config needs no changes - [PR #51539](https://github.com/BerriAI/litellm/pull/51539)
- Keep a content-block system prompt in logged messages, so the system prompt Claude Code sends as a list of blocks to `/v1/messages` now appears in the standard logging payload for every logger - [PR #51699](https://github.com/BerriAI/litellm/pull/51699)
- Add the `LITELLM_OTEL_LANGFUSE_DESTINATION_SPAN_SCOPE` setting so key and team Langfuse destinations can default to `llm_only` without setting it on every key. An explicit `langfuse_span_scope` still wins - [PR #51726](https://github.com/BerriAI/litellm/pull/51726)
- Send one async success log per sync bridged Responses stream, so custom logger hooks and success callbacks stop running three or four times for a single call - [PR #51787](https://github.com/BerriAI/litellm/pull/51787)

### Prompt management

- Preserve temperature and output token limits from prompts selected by the Complexity Router, for both Dotprompt and Langfuse on Chat Completions, with template settings winning on conflicts - [PR #51702](https://github.com/BerriAI/litellm/pull/51702)

## Spend Tracking, Budgets and Rate Limiting

### Customer hierarchy

- Split customer spend by the key's current team, with a `teams` breakdown and a `team_ids` filter on customer usage routes, so admins can see what each team spent for one customer - [PR #50764](https://github.com/BerriAI/litellm/pull/50764)
- Reset a deleted customer's spend counter across workers, so recreating a customer with the same id starts fresh and is no longer refused by a stale budget block - [PR #51224](https://github.com/BerriAI/litellm/pull/51224)
- Enforce customer budget `rpm_limit` and `tpm_limit` for requests authenticated with a JWT, as already done for virtual keys, so JWT callers can no longer exceed their customer's rate limits - [PR #51405](https://github.com/BerriAI/litellm/pull/51405)
- Add a customer organization, team and member hierarchy with budget templates, so platforms reselling the gateway can give each level its own budget and share named default budgets across members - [PR #51459](https://github.com/BerriAI/litellm/pull/51459)
- Enforce customer org, team and member budgets and rate limits on the request path, with daily spend tracking and recurring budget resets, so stored customer budgets now govern incoming requests - [PR #51489](https://github.com/BerriAI/litellm/pull/51489)
- Add daily customer usage rows to the existing accounting delivery and reset customer budgets through the existing reset job, so customers get daily history and recurring budget resets - [PR #51493](https://github.com/BerriAI/litellm/pull/51493)
- Add customer usage tracking and drilldowns by customer org, team and member through the accounting ledger and shared daily analytics, so the Customer Management can show spend at each level - [PR #51495](https://github.com/BerriAI/litellm/pull/51495)
- Register an unknown customer member in the aliased organization's `default` team on its first request, so new users of a customer no longer get a 401 until an admin creates them - [PR #51546](https://github.com/BerriAI/litellm/pull/51546)
- Run requests with unknown customer ids untracked instead of refusing them with a 401, so a missing customer record no longer fails traffic. Mismatched or ambiguous aliases still return 403 or 400 - [PR #51548](https://github.com/BerriAI/litellm/pull/51548)
- Enforce settled customer budgets across workers through Redis, so a $100 budget on three workers no longer lets a customer spend up to $300 - [PR #51568](https://github.com/BerriAI/litellm/pull/51568)
- Send webhook alerts when a customer organization, customer team or customer member crosses its budget, and keep monthly budgets from repeating alerts or missing the final crossing under replica lag - [PR #51579](https://github.com/BerriAI/litellm/pull/51579)
- Add customer budget rollup with resets on each budget row's window, named templates, team overrides, monthly plus annual limits and a `pause_allow_increase` cap policy with an admin-reviewed increase request queue - [PR #51582](https://github.com/BerriAI/litellm/pull/51582)
- Register an unknown `x-litellm-customer-org-alias` as a new organization that is charged for the request, so a customer's first request stands up its own org instead of running untracked - [PR #51637](https://github.com/BerriAI/litellm/pull/51637)
- Fix customer budget alert webhooks after the hierarchy schema changes, so recurring alerts dedupe per period, member alerts stop querying a removed relation and team alerts use the effective budget - [PR #51645](https://github.com/BerriAI/litellm/pull/51645)
- Register a customer member with no budget when its customer org has no default budget, so the first request no longer drops the member and its spend is tracked - [PR #51660](https://github.com/BerriAI/litellm/pull/51660)
- Drop a customer `budget_override_expires_at` that is sent without a `budget_override`, so a stale past expiry can no longer make a later override be silently ignored - [PR #51667](https://github.com/BerriAI/litellm/pull/51667)
- Refuse a key pinned to one customer org before registering an unknown org alias, so the 403 comes back without first writing a new organization row - [PR #51674](https://github.com/BerriAI/litellm/pull/51674)
- Add free tier limits to the Customer Management with an Enterprise upgrade path, showing a free tier note and a warning banner in the dashboard once a limit is reached - [PR #51687](https://github.com/BerriAI/litellm/pull/51687)
- Keep a customer budget reset from being undone by a stale hierarchy cache entry, so requests stop getting `ExceededBudget` after the database spend has already reset to 0 - [PR #51694](https://github.com/BerriAI/litellm/pull/51694)
- Keep existing memberships on member upsert without a team and scope free tier capacity locks per org, so existing members stop getting 403 at 5 teams and creates are no longer serialized - [PR #51698](https://github.com/BerriAI/litellm/pull/51698)
- Delete a customer team's override budget when the team has no overall budget, so deleting such a team stops leaving an unreachable row in `LiteLLM_BudgetTable` - [PR #51703](https://github.com/BerriAI/litellm/pull/51703)
- Let admins search customer members by ID or alias in the Members tab, so they no longer have to page through the list 20 at a time - [PR #51896](https://github.com/BerriAI/litellm/pull/51896)
- Let admins move existing customer members between teams through the API and UI, so members no longer have to be recreated and lose their history - [PR #51913](https://github.com/BerriAI/litellm/pull/51913)
- Keep uncapped customer org, team and member spend across scheduled budget resets, so spend no longer reads lower than the summed daily usage - [PR #51918](https://github.com/BerriAI/litellm/pull/51918)
- Sort customer organizations, teams and members by budget limit in Customer Management - [PR #51924](https://github.com/BerriAI/litellm/pull/51924)
- Cascade delete large customer organizations within the transaction timeout, so deleting an org with thousands of teams stops failing with a misleading database error - [PR #51969](https://github.com/BerriAI/litellm/pull/51969)

### Cost tracking

- Bill OpenAI transcriptions by the seconds the provider reports in usage instead of guessing from the audio file - [PR #50727](https://github.com/BerriAI/litellm/pull/50727)
- Bill a refused response, such as a content violation, that the router falls back from, so the retried request no longer goes unbilled - [PR #50735](https://github.com/BerriAI/litellm/pull/50735)
- Bill an OpenAI or Azure pass-through background response only once across repeated reads, so polling a finished response no longer charges the full cost on every read - [PR #50841](https://github.com/BerriAI/litellm/pull/50841)
- Stop billing a FLAC with no sample count in its header as 576 trillion seconds, which used to produce absurd costs and lock keys out - [PR #50842](https://github.com/BerriAI/litellm/pull/50842)
- Bill batch cached image input tokens for OpenAI image models using the new `cache_read_input_image_token_cost_batches` field instead of the text cache rate - [PR #50997](https://github.com/BerriAI/litellm/pull/50997)
- Bill Vertex Gemini image calls with text, thinking and image tokens at their own rates, and use Priority prices when Vertex serves the call on Priority, so image spend is no longer over or under counted - [PR #51017](https://github.com/BerriAI/litellm/pull/51017)
- Bill Vertex Gemini image edits from the token counts Vertex returns, with input, text and image tokens each at their own price, instead of a flat per-image charge - [PR #51038](https://github.com/BerriAI/litellm/pull/51038)
- Report zero cost on streamed chat and Responses calls whose token rates are explicitly zero, so `usage.cost` is no longer omitted for free calls, while missing prices still leave cost unset - [PR #51093](https://github.com/BerriAI/litellm/pull/51093)
- Bill flat per-video fal.ai models with a new `output_cost_per_video` field covering 27 video models, so their spend is no longer $0 and the `/fal_ai` pass-through stops returning 400 for them - [PR #51225](https://github.com/BerriAI/litellm/pull/51225)
- Bill Anthropic pass-through calls, including streaming, at the deployment's custom price, using the model actually sent upstream after overrides and pre-call hooks and respecting team eligibility - [PR #51267](https://github.com/BerriAI/litellm/pull/51267)
- Keep a cost margin or discount change made in the Admin UI from being undone by an in-flight config reload, so requests right after the change are billed at the new price - [PR #51273](https://github.com/BerriAI/litellm/pull/51273)
- Preserve Bedrock cross-region pricing for streaming and non-streaming Messages requests, including cached tokens, when Bedrock returns the model without its region prefix, so recorded spend matches client visible cost - [PR #51479](https://github.com/BerriAI/litellm/pull/51479)
- Bill a fal video request that has no resolution at the row's default rate instead of the 720p tier, so models that run at 1080p or 480p by default are charged correctly - [PR #51665](https://github.com/BerriAI/litellm/pull/51665)
- Bill fal video clips by duration and resolution, so a configured per-clip price such as Pixverse's is charged instead of $0 or the per-second fallback - [PR #51679](https://github.com/BerriAI/litellm/pull/51679)
- Keep a deployment's per-second video price over the cost map row's flat price, so deployments with `off_peak_pricing` or custom per-second rates are no longer billed at the catalog's flat rate - [PR #51688](https://github.com/BerriAI/litellm/pull/51688)

### Spend logs and daily rollups

- Write spend log rows for failed requests on config-defined pass-through endpoints, so failures on custom routes are no longer silently dropped and built-in route failures carry a filled `api_base` - [PR #41831](https://github.com/BerriAI/litellm/pull/41831)
- Add `general_settings.redact_tokens_in_spend_logs` to mask token-shaped values such as provider keys, JWTs and PEM keys in stored spend log request and response bodies before the row is written. It is off by default - [PR #48968](https://github.com/BerriAI/litellm/pull/48968)
- Run spend log cleanup from a database-backed scheduled job table, so the job survives restarts, keeps an audit trail of runs and no longer depends on a replica's local memory - [PR #50131](https://github.com/BerriAI/litellm/pull/50131)
- Write the settling read of an OpenAI pass-through background response in-process when the spend collector is on, so its cost row appears in spend logs and matches the key's spend - [PR #50957](https://github.com/BerriAI/litellm/pull/50957)
- Report guardrail spend separately in daily activity with a new `guardrail_spend` column, so tenants paying for their own guardrails are no longer billed twice in model spend - [PR #51010](https://github.com/BerriAI/litellm/pull/51010)
- Keep rows logged without an API key in owner-scoped spend log reads, so admins and team members filtering by user or team see the same rows as before the index change - [PR #51127](https://github.com/BerriAI/litellm/pull/51127)
- Keep the first round spend row for non-streaming web search on `/v1/messages`, with its own upstream ID, usage and cost, instead of dropping it when the follow-up call shares the response ID - [PR #51441](https://github.com/BerriAI/litellm/pull/51441)
- Show customer identity in spend logs with a collapsed Customer section below Metrics and recognizable customer labels, and stop persisting another customer's hierarchy for unauthorized requests - [PR #51596](https://github.com/BerriAI/litellm/pull/51596)
- Keep spend log token redaction off unless `general_settings.redact_tokens_in_spend_logs` is true, so default spend logging does not pay the CPU cost of scanning stored text - [PR #51729](https://github.com/BerriAI/litellm/pull/51729)

### Budgets

- Show committed spend in the Prometheus remaining budget gauges for keys, teams, users and orgs, so free requests stop resetting them to older values and the customer gauge stops subtracting each charge twice - [PR #49199](https://github.com/BerriAI/litellm/pull/49199)
- Make scheduled key, user and team spend resets idempotent, so overlapping resets stop deducting the same spend twice, floating-point residue no longer shows as tiny negative balances and spend never goes below zero - [PR #50298](https://github.com/BerriAI/litellm/pull/50298)
- Keep applying pending spend to keys, teams and users when another worker's accounting maintenance lock is orphaned, so budgets and `/key/info` stop reading low for up to a minute - [PR #50774](https://github.com/BerriAI/litellm/pull/50774)
- Add `model_tpm_limit` and `model_rpm_limit` per-model maps to budgets and customers, and reject negative values instead of silently dropping them - [PR #50797](https://github.com/BerriAI/litellm/pull/50797)
- Judge the zero-cost budget waiver by the model a key or team alias actually serves, so a free alias no longer gets a 422 and a free name aliased to a paid model no longer skips the budget - [PR #51058](https://github.com/BerriAI/litellm/pull/51058)
- Record the window of each end-user, customer team and customer member's last budget reset, so a retried reset job no longer drops spend that should have carried into the new window - [PR #51143](https://github.com/BerriAI/litellm/pull/51143)
- Support annual budgets with a `12mo` duration that resets on January 1 using the configured timezone and reset time, and count the whole calendar year including leap days - [PR #51508](https://github.com/BerriAI/litellm/pull/51508)
- Replace the Python budget hold and settle engine with a Rust engine that reserves, resizes, releases and settles budgets when a request is admitted at auth - [PR #51535](https://github.com/BerriAI/litellm/pull/51535)
- Fix budget updates that returned an internal error because the customer lookup asked for a relation that does not exist, and refresh inherited budget caches through the stored organization and team ids - [PR #51654](https://github.com/BerriAI/litellm/pull/51654)
- Support `budget_limits` windows on internal users, so a user can carry a monthly cap and a tight hourly cap together as keys and teams already can, and the first window to run out blocks requests - [PR #51763](https://github.com/BerriAI/litellm/pull/51763)
- Match budget window starts to stored millisecond precision, so a `reset_at` with microseconds no longer makes recorded window spend read as zero - [PR #51921](https://github.com/BerriAI/litellm/pull/51921)

### Rate limiting

- Count a Responses WebSocket turn's tokens before its last event is sent, so usage-based routing with a `tpm` limit returns the 429 on the next turn instead of a turn late - [PR #50730](https://github.com/BerriAI/litellm/pull/50730)
- Enforce per-customer per-model `model_tpm_limit` and `model_rpm_limit` in the v3 limiter, so one customer cannot exceed a model's allowance across many keys and replicas - [PR #50857](https://github.com/BerriAI/litellm/pull/50857)
- Re-check and reserve per-model `model_rpm_limit` and `model_tpm_limit` on retries and fallback targets, so a fallback model can no longer be called past its limit - [PR #50994](https://github.com/BerriAI/litellm/pull/50994)
- Settle a fallback's tokens on the model group that served the request and return the reserved estimate to the requested model, so v3 rate limits are charged to the right group - [PR #51082](https://github.com/BerriAI/litellm/pull/51082)
- Add a `rate_limited_by` header to rate limit 429 responses naming the limit that fired, such as a customer's per-model allowance, a key or a team, so clients no longer parse the message - [PR #51228](https://github.com/BerriAI/litellm/pull/51228)
- Add `team_model_limit_borrows_idle_capacity_from_other_teams` so a team's model TPM and RPM limits can borrow idle capacity in the dynamic rate limiter, instead of returning 429s while the model sits unused - [PR #51328](https://github.com/BerriAI/litellm/pull/51328)
- Let a team opt in to `model_preferences` in its metadata so a request for a saturated model is served by a permitted alternate below the `saturation_threshold`, with a response header naming the steer - [PR #51350](https://github.com/BerriAI/litellm/pull/51350)
- Add `team_model_limit_max_borrow_multiple` to cap how far one team can borrow idle model capacity, so a single team cannot take most of the idle TPM and RPM - [PR #51359](https://github.com/BerriAI/litellm/pull/51359)
- Add `priority_class_share_splits_equally_among_active_teams` so a priority class share is split among the teams active on a model, instead of one team emptying the pool and teammates getting 429s - [PR #51366](https://github.com/BerriAI/litellm/pull/51366)
- Hold router fallbacks, nested calls, Responses WebSocket turns and oversized prompts to a borrowing team's model share, so they no longer skip or misuse the team's borrowed capacity limits - [PR #51367](https://github.com/BerriAI/litellm/pull/51367)
- Give a team that borrowed idle capacity its full share back once the model saturates, so idle-time tokens no longer count against it and cause immediate refusals - [PR #51415](https://github.com/BerriAI/litellm/pull/51415)
- Run team `router_settings.fallbacks` on the proxy's own 429s and add an opt-in `router_settings.fallback_on_saturation` that starts the fallback walk at `saturation_threshold`, replacing team `model_preferences` - [PR #51439](https://github.com/BerriAI/litellm/pull/51439)
- Keep a capped borrowing team's cap on its own counter `model_per_team_max_borrow_multiple`, so idle usage stops counting against it and it gets a fresh share when the model saturates - [PR #51494](https://github.com/BerriAI/litellm/pull/51494)
- Add per-model batch enqueued token limits on projects, so an admin can cap how many batch tokens one application has queued for a model and stop it filling the queue for others on the team - [PR #51608](https://github.com/BerriAI/litellm/pull/51608)
- Let customer organizations and keys borrow idle model capacity and split class shares in the dynamic rate limiter, instead of treating their per-model limits as hard caps - [PR #51705](https://github.com/BerriAI/litellm/pull/51705)
- Publish a team's share gauges for requests served while the model is idle, so teams with a per-model token share appear on the dynamic rate limiter dashboard with zero borrowed tokens - [PR #51709](https://github.com/BerriAI/litellm/pull/51709)
- Charge tokens used while the model was idle against a team's class share, so `priority_class_share_config.split_equally_among_active` protects a light team from being starved - [PR #51952](https://github.com/BerriAI/litellm/pull/51952)

## MCP Gateway

### Auth and OAuth

- Answer a single-server MCP listing with the gateway's own 401 challenge when the upstream rejects the credential and the user can sign in again, so clients stop showing a revoked connection as connected with 0 tools - [PR #50389](https://github.com/BerriAI/litellm/pull/50389)
- Forward the LiteLLM key to MCP servers when the admin lists it in Extra Headers or the caller sends `x-mcp-{alias}-authorization` or `x-mcp-auth`, restoring behavior dropped in earlier releases - [PR #50604](https://github.com/BerriAI/litellm/pull/50604)
- Accept comma-separated vendor scope grants on the MCP connect check, so users reconnecting an expired Slack sign-in no longer loop between Slack and the connect page - [PR #50717](https://github.com/BerriAI/litellm/pull/50717)
- Scope the MCP gateway sign-in to the servers picked on the connect page, so servers switched off no longer reach the coding tool and all servers start on by default - [PR #50973](https://github.com/BerriAI/litellm/pull/50973)
- Treat the `mcp_all` OAuth scope as a wildcard that any granted scope covers, so reconnecting the Datadog MCP server no longer loops between its allow screen and ends in Authentication incomplete - [PR #51578](https://github.com/BerriAI/litellm/pull/51578)

### Protocol and catalog

- Cache upstream MCP tool lists for an admin-set lifetime (default 0), so agents that list tools at the start of every session get them from the gateway instead of waiting on the server - [PR #51160](https://github.com/BerriAI/litellm/pull/51160)
- Route `resources/read` on the aggregate `/mcp` route to the server that lists the URI, so reads no longer fail when more than one MCP server is configured - [PR #51462](https://github.com/BerriAI/litellm/pull/51462)

## Performance / Loadbalancing / Reliability improvements

### Rust core

- Add a supervised opt-in Rust forwarding server on the public port with `LITELLM_RUST_FIRST=1`, while Python still handles every request and sees client IPs and trusted proxies exactly as if the client connected directly - [PR #49606](https://github.com/BerriAI/litellm/pull/49606)
- Add the Rust database layer's SQLx writer pool, built from the same `DATABASE_URL` settings Prisma uses for pool sizes, TLS, timeouts, schema, PgBouncer mode and rotating RDS IAM or Entra tokens. Nothing queries through it yet - [PR #49798](https://github.com/BerriAI/litellm/pull/49798)
- Classify native database errors into the same kinds as Prisma, such as unreachable, capacity and deadlock, and recycle poisoned pools so the Rust database layer recovers from failures like Prisma does - [PR #49801](https://github.com/BerriAI/litellm/pull/49801)
- Add an optional native reader pool for configured read replicas with explicit writer or reader routing and fallback, so reads that move to Rust later keep going to the replica - [PR #49804](https://github.com/BerriAI/litellm/pull/49804)
- Emit DB service events from Rust database queries so they appear in the same Prometheus and OpenTelemetry DB metrics as Prisma queries, with the same call type, table and success or failure labels - [PR #49810](https://github.com/BerriAI/litellm/pull/49810)
- Let proxy `/v1/messages` requests run on the Rust path with `LITELLM_RUST=1`, by adjusting detectors so the proxy's shared aiohttp session and default stream timeout no longer force the Python path - [PR #50335](https://github.com/BerriAI/litellm/pull/50335)
- Move Redis key construction out of router-core and into the stores, so `RouterCache` operations name state such as cooldowns and usage and the Python host builds the keys - [PR #50356](https://github.com/BerriAI/litellm/pull/50356)
- Serve deployment health check states from a new native `deployment_health` Redis store instead of the DualCache and redis-py, with a Rust store and pyo3 binding behind `DeploymentHealthCache` - [PR #50357](https://github.com/BerriAI/litellm/pull/50357)
- Log native `/v1/messages` success once through the Python logging path after the proxy releases it, so Rust-served requests are logged the same way as Python ones - [PR #50420](https://github.com/BerriAI/litellm/pull/50420)
- Fill the logging object for native `/v1/messages` requests the same way Python does, including `model_parameters`, `litellm_params` and the standard logging payload fields - [PR #50421](https://github.com/BerriAI/litellm/pull/50421)
- Pass non-message 200 bodies through on the native `/v1/messages` handler as Python does, and refuse non-string request headers as bad requests instead of failing later - [PR #50422](https://github.com/BerriAI/litellm/pull/50422)
- Run native async chat and embedding calls through the same async wrapper steps as Python, so Rust error responses carry `x-litellm-timeout` and other wrapper behavior matches - [PR #50423](https://github.com/BerriAI/litellm/pull/50423)
- Raise native `/v1/messages` failures as the same Python exceptions with the same headers and spend handling, so errors from the Rust path look identical to clients - [PR #50424](https://github.com/BerriAI/litellm/pull/50424)
- Bill native `/v1/messages` streams that the client abandons mid-stream like Python does, so spend, spend logs and the key's budget and tpm reflect the chunks already delivered - [PR #50425](https://github.com/BerriAI/litellm/pull/50425)
- Write the native unary `/v1/messages` cache entry after the router stamps it, as Python does, so cache hits carry `model_id` and the router headers such as `x-litellm-cache-key` - [PR #50426](https://github.com/BerriAI/litellm/pull/50426)
- Move the cost map inputs, fetch and `register_model` overlay into Rust, so Rust hosts reuse the same cost map rules and S3 cost maps and the S3 cache share one S3 access path - [PR #50501](https://github.com/BerriAI/litellm/pull/50501)
- Install the rustls crypto provider at the Python host boundary so dependencies that build a TLS client without naming a provider, such as `redis` 1.8, stop panicking - [PR #50502](https://github.com/BerriAI/litellm/pull/50502)
- Add the `litellm-s3` Rust crate with an `AwsCredentialsProvider` and cost map fetch that caps downloads at 100 MB and retries with standard jitter - [PR #50547](https://github.com/BerriAI/litellm/pull/50547)
- Look up router host step answers by id instead of scanning every candidate, which cuts about 2 ms of a 3.2 ms Rust select at 1,000 deployments - [PR #50704](https://github.com/BerriAI/litellm/pull/50704)
- Stop listing a model group's deployments three times per request on the Rust router `acompletion` path, which saves milliseconds per call at large deployment counts - [PR #50749](https://github.com/BerriAI/litellm/pull/50749)
- Count the whole `router_usage` family on the native Redis store, so Redis spans keep their parent and usage reads no longer go through the Python batch path - [PR #50862](https://github.com/BerriAI/litellm/pull/50862)
- Serve the router's deployment affinity and complexity router session pins from a native Redis store, so the pin read rides the native pre-call pipeline - [PR #50870](https://github.com/BerriAI/litellm/pull/50870)
- Serve Anthropic Messages for the `anthropic` provider on Rust only, porting every Python-only `/v1/messages` feature to Rust, with no `LITELLM_RUST` opt-in and no Python fallback - [PR #51119](https://github.com/BerriAI/litellm/pull/51119)
- Replace the Python `RedisBatch` with the native Rust Redis store for request path operations, and delete the dead Python batch code and its tests - [PR #51383](https://github.com/BerriAI/litellm/pull/51383)
- Rebuild the Rust in-memory cache on an exact expiry index, so deleting or re-arming a key no longer leaves dead expiry records behind - [PR #51388](https://github.com/BerriAI/litellm/pull/51388)
- Stop re-serializing the Messages request body in Python logging callbacks by handing down the already processed bytes from Rust, saving about 1 ms per request on large bodies - [PR #51440](https://github.com/BerriAI/litellm/pull/51440)
- Add a Rust `fnmatch` crate that matches Python's `fnmatchcase` glob rules, as groundwork for moving auth route checks into Rust. It is not wired into any request path yet - [PR #51530](https://github.com/BerriAI/litellm/pull/51530)
- Decide authentication route rules in Rust instead of Python, with no change to which routes are allowed for each key type - [PR #51531](https://github.com/BerriAI/litellm/pull/51531)
- Take the native rollup `lock_timeout` from the caller so Rust and Python use the same `SPEND_ROLLUP_LOCK_TIMEOUT_MS` value, and keep team lock statements unnamed so they work under PgBouncer - [PR #51549](https://github.com/BerriAI/litellm/pull/51549)
- Plan the authentication path in Rust so the choice of auth route for each request is decided in one place, with no change to which requests are accepted - [PR #51605](https://github.com/BerriAI/litellm/pull/51605)
- Shape the fallback hop kwargs for each attempt in router-core and hand them to Python, moving logic into Rust with no change in behavior - [PR #51644](https://github.com/BerriAI/litellm/pull/51644)
- Scan opt-in spend log tokens natively in Rust, so enabling token redaction no longer drops throughput on large prompts while redaction rules stay the same - [PR #51770](https://github.com/BerriAI/litellm/pull/51770)
- Stop the Rust router from keeping every finished request in memory until a full garbage collection, so busy proxies no longer grow far past their real working set - [PR #51888](https://github.com/BerriAI/litellm/pull/51888)
- Settle ready async values inline instead of spawning them on tokio in the Python host, which saves a large amount of time on Redis batch calls - [PR #51906](https://github.com/BerriAI/litellm/pull/51906)
- Free a failed Rust router call's request right away, including calls that fail once and then succeed on retry, instead of holding it until the next garbage collection - [PR #51963](https://github.com/BerriAI/litellm/pull/51963)
- Load the Anthropic beta map only when a filter has a beta to filter, so cold Rust `/v1/messages` workers stop downloading it on requests with no `anthropic-beta` header - [PR #52188](https://github.com/BerriAI/litellm/pull/52188)

### Auto Router and model routing

- Merge default metadata under the request's own metadata instead of replacing it, so a team's labels reach GCP billing and the admin default only fills in what the caller left out - [PR #50700](https://github.com/BerriAI/litellm/pull/50700)
- Keep box questions on a deployment when a same-model sibling turns them off, so the first deployment stops answering 400 after another one sets `supports_box_questions: false` - [PR #50724](https://github.com/BerriAI/litellm/pull/50724)
- Keep Claude Code subagent and background side requests from sharing the main agent's complexity router tier pin, and use Claude's request-type headers to tell the three kinds of traffic apart - [PR #50741](https://github.com/BerriAI/litellm/pull/50741)
- Let deployments declare a shared `model_info.encrypted_content_boundary` so regional endpoints of one org count as peers and a follow-up can keep its encrypted reasoning - [PR #50750](https://github.com/BerriAI/litellm/pull/50750)
- Let a retry leave a deployment pinned by encrypted reasoning after a 5xx, 429 or connection error, so healthy deployments in the group get tried instead of failing every retry - [PR #50769](https://github.com/BerriAI/litellm/pull/50769)
- Pin the default model for a `user_turn` ask whose complexity classifier failed, so its continuations stay consistent and the next new ask is classified again - [PR #50793](https://github.com/BerriAI/litellm/pull/50793)
- Let an explicit routing tag outrank the encrypted content pin, so a request tagged for deployment B is no longer pinned to A and then dropped by the tag filter - [PR #50975](https://github.com/BerriAI/litellm/pull/50975)
- Apply the Router's `num_retries` and `fallbacks` in sync `router.responses()` and `generate_content()`, so they retry and fall back like the async versions - [PR #51011](https://github.com/BerriAI/litellm/pull/51011)
- Report a session's whole spend as `total_spend` on `/auto_router/session`, including unrouted calls such as direct Haiku background requests, and name why savings stay unestimated - [PR #51066](https://github.com/BerriAI/litellm/pull/51066)
- Keep auto router classifier deployments serving while an admin moves them to a new workspace, by replacing the deployment in place so requests stop failing with no healthy deployments - [PR #51111](https://github.com/BerriAI/litellm/pull/51111)
- Preserve held tiers for OpenCode subagent results in the complexity router, so those results no longer trigger fresh classifications and tier changes - [PR #51176](https://github.com/BerriAI/litellm/pull/51176)
- Stop a Responses stream fallback from replaying a tool call that was already delivered, so an error after a tool call reaches the client instead of running the action twice - [PR #51683](https://github.com/BerriAI/litellm/pull/51683)
- Name the request size when usage-based routing refuses an over-tpm request, and fail right away with a 429 instead of waiting about 3 minutes, while group fallbacks still run - [PR #51838](https://github.com/BerriAI/litellm/pull/51838)

### Caching, database and runtime

- Exclude RSA key exchange and ChaCha20 from the outbound TLS cipher list in FIPS mode, so outbound connections only use FIPS approved suites - [PR #50671](https://github.com/BerriAI/litellm/pull/50671)
- Accept a bare service account email for GCP Memorystore IAM, so workers stop falling back to memory and rate limits, budgets and key blocks stay shared across workers - [PR #50676](https://github.com/BerriAI/litellm/pull/50676)
- Log one warning at proxy boot counting keys and teams still on the deprecated empty `models` default and explaining how to keep their access before LiteLLM 2.0.0 drops that rule - [PR #50720](https://github.com/BerriAI/litellm/pull/50720)
- Reuse the upstream choice object for plain HTTP-handler stream chunks from providers like DeepSeek, Mistral, Groq, Anthropic, Gemini and Bedrock, which cuts proxy CPU per streamed chunk by about 5 percent - [PR #50786](https://github.com/BerriAI/litellm/pull/50786)
- Let the OS assign Prisma engine ports and read the real port from the engine startup message, so proxies and workers booting at once stop failing on a port clash - [PR #50850](https://github.com/BerriAI/litellm/pull/50850)
- Keep a request's cache opt-in when its key has cache metadata, so `use-cache: true` requests on those keys hit the cache and stop being billed again on repeat calls - [PR #50999](https://github.com/BerriAI/litellm/pull/50999)
- Narrow user and team spend log reads to the owner's API keys so the `api_key` and `startTime` index is used, which stops `/spend/logs/ui` and `/team/spend/by_user` from scanning the whole date window - [PR #51026](https://github.com/BerriAI/litellm/pull/51026)
- Let `/team/delete` transactions wait for a pooled database connection instead of failing with a 503 after 2 seconds when the pool is only busy - [PR #51099](https://github.com/BerriAI/litellm/pull/51099)
- Load `LITELLM_MODEL_COST_MAP_URL` from a private `gs://` bucket using Google application default credentials, so the model cost map can be hosted on GCS like it can on S3 - [PR #51108](https://github.com/BerriAI/litellm/pull/51108)
- Count a rate-limit fallback in `x-litellm-attempted-fallbacks` and name it in a new `x-litellm-fallback-reason` header, so clients can tell when a local per-model limit sent a request to a fallback - [PR #51138](https://github.com/BerriAI/litellm/pull/51138)
- Map Gemini stream-opening errors to catchable LiteLLM API errors on sync and async Router calls, instead of raw provider errors or `TypeError`, while keeping timeout fallbacks and original causes - [PR #51218](https://github.com/BerriAI/litellm/pull/51218)
- Bound the detached streaming drain pump for Anthropic messages so it cannot outlive its stream, fixing potential memory leaks - [PR #51268](https://github.com/BerriAI/litellm/pull/51268)
- Hold the logging object weakly in the detached stream failure hook, so finished streamed `/v1/messages` requests are freed right away instead of waiting for a full garbage collection pass - [PR #51318](https://github.com/BerriAI/litellm/pull/51318)
- Fetch `/public/litellm_blog_posts` through the pooled async HTTP client, so an unreachable docs site no longer freezes the worker for 5 seconds on every Admin UI load - [PR #51369](https://github.com/BerriAI/litellm/pull/51369)
- Import `soundfile` lazily in the Transcribe logging handler, so Anthropic and Bedrock messages streams no longer need it installed - [PR #51480](https://github.com/BerriAI/litellm/pull/51480)
- Close streams right after the last event is sent and rebuild the served output for logging afterward, removing a 30 to 100 ms hold that made up most of the latency LiteLLM added to a stream - [PR #51487](https://github.com/BerriAI/litellm/pull/51487)
- Read a model's saturation from Redis in the dynamic rate limiter, so every worker agrees on whether a model is saturated and a team past its share is limited consistently - [PR #51519](https://github.com/BerriAI/litellm/pull/51519)
- Build the Usage type schemas eagerly at import, so a burst of parallel first requests on a fresh worker no longer fails with an internal schema error - [PR #51591](https://github.com/BerriAI/litellm/pull/51591)
- Retain unwritten tool usage records and auto-router turns after a database disconnect and retry them once connectivity returns, requeuing only unwritten turns from partial batches to avoid double counting - [PR #51706](https://github.com/BerriAI/litellm/pull/51706)
- Stop a global `model_fallbacks` list from recursing on every completion call, which made SDK and proxy chat and Responses requests hang until a recursion error and never reach the provider - [PR #51817](https://github.com/BerriAI/litellm/pull/51817)
- Read token model fields from the class instead of the deprecated `__fields__` in the auth path, which cuts per-request overhead - [PR #51901](https://github.com/BerriAI/litellm/pull/51901)
- Format dual cache debug logs lazily, so cache reads and writes skip string building when debug logging is off - [PR #51902](https://github.com/BerriAI/litellm/pull/51902)
- Extract usage once per chunk when assembling stream usage, which cuts repeated work on long streamed responses - [PR #51903](https://github.com/BerriAI/litellm/pull/51903)
- Reuse validated models on `UserApiKeyCache` memory hits, so repeated key lookups skip revalidation - [PR #51912](https://github.com/BerriAI/litellm/pull/51912)
- Add database indexes for customer member team, budget and override lookups, so Customer Management filters stop scanning whole tables - [PR #51961](https://github.com/BerriAI/litellm/pull/51961)
- Add a migration that drops the `updated_at` default on `LiteLLM_DailyCustomerMemberSpend` and renames a truncated foreign key, so migrations match `schema.prisma` and the next generated migration has no surprise statements - [PR #52175](https://github.com/BerriAI/litellm/pull/52175)

### Docker and Helm

- Replace the two Helm charts with a single `helm/litellm` chart that can run as one monolith proxy Deployment and uses one shared image, so only one image value needs bumping - [PR #43330](https://github.com/BerriAI/litellm/pull/43330)
- Ship one root `Dockerfile` that runs as a non-root user with a single `docker-entrypoint.sh` that can start any component, and one compose file, replacing the ten Dockerfiles and per-image wrappers - [PR #43332](https://github.com/BerriAI/litellm/pull/43332)
- Run every AWS and GCP Terraform workload from the single `litellm` image, so ECS tasks, Cloud Run services and the migrations job no longer depend on retired per-component images - [PR #43358](https://github.com/BerriAI/litellm/pull/43358)
- Add `scheme` and `tlsConfig` values to the gateway ServiceMonitor in the Helm chart, so Prometheus can scrape the gateway over https or through an Istio sidecar under strict mTLS - [PR #50759](https://github.com/BerriAI/litellm/pull/50759)
- Route every gateway allowlist path to the gateway in the componentized Helm ingress and keep ALB rules under the 100 rule limit, with a CI check to stop future path drift - [PR #50760](https://github.com/BerriAI/litellm/pull/50760)
- Refresh the pinned Wolfi base image for build and runtime to a version with patched glibc, keeping the same 2.44 ABI, so the image scan passes again - [PR #51550](https://github.com/BerriAI/litellm/pull/51550)

### Dependency updates

- Add `tzdata` to the `litellm[proxy]` extra so a legacy `TZ` value such as `Asia/Calcutta` no longer makes startup exit with code 3 on hosts without the legacy zone database - [PR #49914](https://github.com/BerriAI/litellm/pull/49914)
- Bump `soupsieve` to the fixed release where the Python version allows it and add a dated scan ignore for the oldest supported Python, so the OSV scan passes again - [PR #51585](https://github.com/BerriAI/litellm/pull/51585)
- Bump opentelemetry to 1.45.2, along with dnspython, tornado and soupsieve, past advisories published on November 13 so the osv-scan check passes again - [PR #51712](https://github.com/BerriAI/litellm/pull/51712)

## Documentation Updates

- Update the repository's reporting policy with the new mailing list signup link and disclosure form, and drop the video requirement - [PR #51199](https://github.com/BerriAI/litellm/pull/51199)

## Tests, CI and Internal Changes

- Let `SemanticToolFilterHook` take its MCP tool loader as a parameter so tests inject a loader instead of patching a class attribute - [PR #50483](https://github.com/BerriAI/litellm/pull/50483)
- Fail dashboard lint on hardcoded English in JSX and in toast messages using `eslint-plugin-i18next`, so new text goes through i18n - [PR #50593](https://github.com/BerriAI/litellm/pull/50593)
- Clean up recent tech debt by reading a typed setting directly, adding a missing return type and deleting two unused helpers, with no behavior change - [PR #50617](https://github.com/BerriAI/litellm/pull/50617)
- Clear 1141 basedpyright `Any` errors across 182 files so the type checker can catch real bugs, with no behavior change - [PR #50711](https://github.com/BerriAI/litellm/pull/50711)
- Keep moved private prompt template helpers importable from `common_utils`, make patches through the old module reach the real helper, and warn with the helper's new location - [PR #50721](https://github.com/BerriAI/litellm/pull/50721)
- Add integration tests for `claude-fable-5-2` capability flags and prompt-cache pricing on the scripted Anthropic upstream - [PR #50722](https://github.com/BerriAI/litellm/pull/50722)
- Add Vertex AI and Bedrock Converse wire and cost tests for `claude-fable-5-2` and add it to the Bedrock Converse model list so capability flags and prompt-cache pricing stay correct - [PR #50742](https://github.com/BerriAI/litellm/pull/50742)
- Update the audio transcription billing test to expect the seconds OpenAI reports for a one second upload, matching the intended billing behavior - [PR #50767](https://github.com/BerriAI/litellm/pull/50767)
- Update the team model visibility integration test to check that a team's models show only for that team's keys and admins - [PR #50772](https://github.com/BerriAI/litellm/pull/50772)
- Repair integration tests that still asserted behavior replaced on purpose by earlier merged changes, including batch cache pricing, OTel baggage and a stream EOF case - [PR #50782](https://github.com/BerriAI/litellm/pull/50782)
- Drop the empty-string n case from the Gemini long decode integration test because Google rejects it with a 400 - [PR #50796](https://github.com/BerriAI/litellm/pull/50796)
- Update spend and integration tests that still expected the pre-ledger accounting queues, and fix a few tests failing for unrelated reasons - [PR #50814](https://github.com/BerriAI/litellm/pull/50814)
- Update the Mantle `count_tokens` wire test to expect the 400 `invalid_request_error` for a content-less leading system message - [PR #50820](https://github.com/BerriAI/litellm/pull/50820)
- Route every Rust-to-Python call through the `rust_bridge` host modules as a pure refactor to make the boundary consistent - [PR #50822](https://github.com/BerriAI/litellm/pull/50822)
- Rewrite the spend ledger parity test to assert that spend is applied under another worker's maintenance lock while cleanup waits for it - [PR #50843](https://github.com/BerriAI/litellm/pull/50843)
- Empty the shared client cache before the tier pin batch test so it stops failing depending on test order - [PR #50854](https://github.com/BerriAI/litellm/pull/50854)
- Cap the OAuth metadata lookup in the mixed capabilities MCP subscription integration test so it stops timing out intermittently - [PR #50867](https://github.com/BerriAI/litellm/pull/50867)
- Let the gunicorn server take a private listener and split the port fallback and gateway database setup into smaller functions - [PR #50871](https://github.com/BerriAI/litellm/pull/50871)
- Remove unused files from the repo root, including `GEMINI.md`, `mcp_servers.json`, `router_plugins.json`, the root `package.json` and the `examples` folder - [PR #50936](https://github.com/BerriAI/litellm/pull/50936)
- Remove the stale `cookbook` folder and move the Grafana dashboards and test-used files under `litellm` - [PR #50944](https://github.com/BerriAI/litellm/pull/50944)
- Remove CircleCI and move the scripts that GitHub Actions jobs still call into `.github/scripts/ci/` - [PR #50950](https://github.com/BerriAI/litellm/pull/50950)
- Sync the Vertex 3.1 Pro price fields and Bedrock Converse usage shapes in the cost calculation integration cases with the real catalog rows - [PR #50956](https://github.com/BerriAI/litellm/pull/50956)
- Move lint, scanner, doc and script config off the repo root, with Ruff and pyright settings now in `pyproject.toml` - [PR #50966](https://github.com/BerriAI/litellm/pull/50966)
- Update the budget partial update integration test to expect the per-model tpm and rpm limit fields in budget info - [PR #50967](https://github.com/BerriAI/litellm/pull/50967)
- Drain client traffic after sending GOAWAY in the HTTP/2 integration test server so the vector store search test stops failing on a plain disconnect - [PR #50972](https://github.com/BerriAI/litellm/pull/50972)
- Recognize the model list's registry lock in the held write helper of the concurrent deployment delete tests so they pass again - [PR #50974](https://github.com/BerriAI/litellm/pull/50974)
- Move the docker, compose, helm and terraform sources under `litellm/deploy` to shrink the repo root - [PR #50981](https://github.com/BerriAI/litellm/pull/50981)
- Scope the Vertex Anthropic structured output test capture to inference routes so stray requests like a model list lookup no longer crash it - [PR #50983](https://github.com/BerriAI/litellm/pull/50983)
- Move `ui` and `vscode-extension` under `litellm` and delete the `docs` folder now that docs live in litellm-docs - [PR #50992](https://github.com/BerriAI/litellm/pull/50992)
- Move `enterprise`, `litellm-proxy-extras`, `litellm-rust` and `packaging` under `litellm` and the CLI source to `litellm/cli` - [PR #51000](https://github.com/BerriAI/litellm/pull/51000)
- Move scripts, backend, migrations and `schema.prisma` under `litellm` to shrink the repo root - [PR #51006](https://github.com/BerriAI/litellm/pull/51006)
- Add a CI check that fails when the repo root grows past 15 entries - [PR #51007](https://github.com/BerriAI/litellm/pull/51007)
- Keep fake upstream servers in integration tests off ephemeral ports so they stop colliding with the port Prisma picks for its query engine and failing the scheduled run - [PR #51019](https://github.com/BerriAI/litellm/pull/51019)
- Make the MCP comma scope connect test save and read the grant through real credential storage, so a broken stored grant now fails the test - [PR #51065](https://github.com/BerriAI/litellm/pull/51065)
- Build Rust with a fast `ci` cargo profile in image-scan jobs instead of full release optimizations, so dependency PRs finish the scan, migration and boot checks much sooner - [PR #51075](https://github.com/BerriAI/litellm/pull/51075)
- Deflake the db metrics spans and drain timeout unit tests and split the largest proxy-infra shard in two, so PR runs stop needing reruns and the required unit check finishes sooner - [PR #51078](https://github.com/BerriAI/litellm/pull/51078)
- Fix two flaky integration tests by running baseline accounting in a private Postgres and correcting the series cap count that was off by one request - [PR #51096](https://github.com/BerriAI/litellm/pull/51096)
- Update two Vertex image edit spend tests to expect token-based billing when the edit returns usage, instead of the old flat per-image price - [PR #51109](https://github.com/BerriAI/litellm/pull/51109)
- Teach the model catalog to read `min_billed_input_tokens` so cost map rows that set it pass the cost map guard - [PR #51128](https://github.com/BerriAI/litellm/pull/51128)
- Update the Vertex image edit regional uplift spend test to expect the token-based cost now used for Gemini image edits - [PR #51148](https://github.com/BerriAI/litellm/pull/51148)
- Update the Gemini image edit usage test to expect an empty output breakdown when the provider gives no breakdown, since image token counts are no longer invented - [PR #51149](https://github.com/BerriAI/litellm/pull/51149)
- Remove three recently added comments in the rubrik guardrail, pass-through headers and plugin mode code that only restate the code next to them, with no behavior change - [PR #51163](https://github.com/BerriAI/litellm/pull/51163)
- Update the offline mode test to expect the 202 the latest release check now returns while it looks up the release in the background - [PR #51213](https://github.com/BerriAI/litellm/pull/51213)
- Remove the secret manager e2e suite, which has soft-failed on every Buildkite build since late October and is already covered by unit and integration tests - [PR #51241](https://github.com/BerriAI/litellm/pull/51241)
- Make a flaky spend counter test wait on explicit events for background counter updates before asserting, instead of racing unfinished updates - [PR #51249](https://github.com/BerriAI/litellm/pull/51249)
- Make the cancelled supervisor unit test deterministic so it stops failing CI with the child killed by SIGTERM - [PR #51258](https://github.com/BerriAI/litellm/pull/51258)
- Drop the duplicate `compact-2026-09-04` match arm in `AnthropicBeta::rejected_by` that failed the rust-lint check on main - [PR #51280](https://github.com/BerriAI/litellm/pull/51280)
- Update the guardrail effects test to expect the `content_filter` finish reason on a blocked chat stream, matching the new behavior from the late block fix - [PR #51281](https://github.com/BerriAI/litellm/pull/51281)
- Check the full auto router session response, including the expected `total_spend`, and wait for the total before asserting in session integration tests - [PR #51283](https://github.com/BerriAI/litellm/pull/51283)
- Remove an integration test for the OpenAPI docs gate that needed network access to download maturin and failed on every scheduled run, since the lint workflow already covers the behavior - [PR #51300](https://github.com/BerriAI/litellm/pull/51300)
- Install the Rust gateway in the scheduled integration job and make the forwarding test harness fail loudly when the proxy falls back to Python, so a missing binary can no longer pass silently - [PR #51307](https://github.com/BerriAI/litellm/pull/51307)
- Split the longest unit test shard in two, isolate its child Python tests and switch its file exclusions to `--deselect` so they take effect and 805 tests stop running twice - [PR #51316](https://github.com/BerriAI/litellm/pull/51316)
- Deselect `test_unit_test_proxy_hooks.py` from the shard that wrongly still collected it and pin the unused `proxy-infra-root` codecov flag, as follow-ups to the unit shard split - [PR #51324](https://github.com/BerriAI/litellm/pull/51324)
- Scope the bridged call recorder in tests to each request with `success_callback`, so delayed logs from other tests can no longer make them fail - [PR #51339](https://github.com/BerriAI/litellm/pull/51339)
- Remove the duplicate `gemini/gemini-decision-1` entry from the cost map so the duplicate key test passes and PRs stop inheriting a red check - [PR #51341](https://github.com/BerriAI/litellm/pull/51341)
- Let only main save Actions caches, make sccache use a different backend, and stop smoke jobs compiling Rust and numpy from source, so PR runs stop evicting caches and hitting 429s - [PR #51343](https://github.com/BerriAI/litellm/pull/51343)
- Add CollieAi to the expected list of guardrails that cannot do directional logging-only scope in the guardrail settings integration test - [PR #51345](https://github.com/BerriAI/litellm/pull/51345)
- Update the quiet stream keepalive test to expect Rust routing for Anthropic Messages, which is now served only by the Rust path - [PR #51346](https://github.com/BerriAI/litellm/pull/51346)
- Update integration tests that still expected Python to serve Anthropic `/v1/messages` so they expect Rust after the Rust-only cutover - [PR #51351](https://github.com/BerriAI/litellm/pull/51351)
- Update the idle reconnect test to expect Rust routing for streamed Anthropic Messages while keeping its checks on fresh connections, responses and spend records - [PR #51364](https://github.com/BerriAI/litellm/pull/51364)
- Read `output_cost_per_billable_unit` in the Rust model catalog registry check, so a new price field and the cost map rows using it can land in the same PR - [PR #51365](https://github.com/BerriAI/litellm/pull/51365)
- Read `output_cost_per_video` in the Rust model catalog registry check, so the fal.ai per video price rows can land with the field they use - [PR #51433](https://github.com/BerriAI/litellm/pull/51433)
- Point the admin MCP schema push image test at `/app/litellm/schema.prisma` to match the moved package layout, so the image scan verify jobs stop failing - [PR #51446](https://github.com/BerriAI/litellm/pull/51446)
- Point the database integration tests at the moved `litellm/proxy-extras` and enterprise packages, so about 40 migration and boot tests find the Prisma schema again - [PR #51453](https://github.com/BerriAI/litellm/pull/51453)
- Update the thinking signature retry test to expect Rust to drop a null `signature` on retry - [PR #51461](https://github.com/BerriAI/litellm/pull/51461)
- Bump litellm to 1.111.0, litellm-enterprise to 0.1.84 and litellm-proxy-extras to 0.4.115, so nightly builds from main pin subpackage wheels that include the new migrations - [PR #51486](https://github.com/BerriAI/litellm/pull/51486)
- Remove five unit tests that went red on main between Nov 5 and Nov 12 without a code change behind them - [PR #51488](https://github.com/BerriAI/litellm/pull/51488)
- Rename customer member budget columns so `budget_id` is the org budget the member follows and `budget_override_id` holds the member's own override, matching the meaning on orgs and teams - [PR #51490](https://github.com/BerriAI/litellm/pull/51490)
- Update the request log index rename integration test to expect the separate daily user spend index build that now happens at that migration step - [PR #51504](https://github.com/BerriAI/litellm/pull/51504)
- Update the pass-through endpoint integration test to expect the default Model Hub settings that are now saved on every endpoint, so the scheduled run stops failing - [PR #51505](https://github.com/BerriAI/litellm/pull/51505)
- Give the skills panel test 5 seconds to show the catalog on its first cold render, so the `ui-unit` check stops failing on and off - [PR #51509](https://github.com/BerriAI/litellm/pull/51509)
- Wait for in-flight request accounting to finish before deleting the Vault config in the config override tests, so late spend logging no longer reads a Vault secret after it is gone - [PR #51515](https://github.com/BerriAI/litellm/pull/51515)
- Compare SageMaker embedding request bodies as parsed JSON instead of raw text and assert that the caller's encoding wins, so the wire tests stop breaking on field order - [PR #51536](https://github.com/BerriAI/litellm/pull/51536)
- Identify team datastore spans by team id in the OTEL excluded services matrix test, so the new operator-only cache lookup before key auth is not counted as a team span - [PR #51554](https://github.com/BerriAI/litellm/pull/51554)
- Run the worker-replacement chaos test on its own proxy with normal supervision, so uvicorn notices dead workers quickly and the test stops timing out in CI - [PR #51590](https://github.com/BerriAI/litellm/pull/51590)
- Give the K3 worker crash spend test the calibrated proxy startup budget used by K4 instead of a fixed 300 seconds, so slow runners stop timing it out - [PR #51592](https://github.com/BerriAI/litellm/pull/51592)
- Bump `litellm-enterprise` to 0.1.85 and `litellm-proxy-extras` to 0.4.116 so nightly builds pin wheels that include the new migrations - [PR #51643](https://github.com/BerriAI/litellm/pull/51643)
- Hold the balance row until both requests are waiting in the concurrent member reset test, so one request can no longer finish early and fail a valid response - [PR #51655](https://github.com/BerriAI/litellm/pull/51655)
- Resolve budget request route identifiers from their own fixtures in the credential sweep tests, instead of probing them with a chat request id - [PR #51659](https://github.com/BerriAI/litellm/pull/51659)
- Build Rust code without optimizations in the MCP dependency resolution workflow, so it finishes in about 11 minutes instead of timing out at 30 - [PR #51684](https://github.com/BerriAI/litellm/pull/51684)
- Make the unbuffered Noma streaming secret exposure test deterministic, so the scripted email no longer lands on the chunk where the sampled guardrail scan runs - [PR #51707](https://github.com/BerriAI/litellm/pull/51707)
- Saturate the model before measuring dynamic limiter team share metrics in the Prometheus integration test, so it matches the limiter giving a borrowing team a fresh share - [PR #51714](https://github.com/BerriAI/litellm/pull/51714)
- Point the Rust gateway install step in the integration workflow at `litellm/packaging` after the source move broke it - [PR #51743](https://github.com/BerriAI/litellm/pull/51743)
- Give the S3 v2 slow-sink ramp test a callback limit that outlasts its 400 request burst, so it stops failing on slow CI runners - [PR #51744](https://github.com/BerriAI/litellm/pull/51744)
- Keep proxy startup out of the per-test timeout in the OTEL excluded services matrix tests, so a slow shared proxy start no longer fails them all at once - [PR #51759](https://github.com/BerriAI/litellm/pull/51759)
- Move example configs, Helm and Terraform examples and about 20 e2e tests off `gpt-4o` and `gpt-4.1` before OpenAI shuts them down on 2027-01-14 - [PR #51800](https://github.com/BerriAI/litellm/pull/51800)
- Drop a comprehension suppression and restating comments from the new customer hierarchy and v2 callback code - [PR #51804](https://github.com/BerriAI/litellm/pull/51804)
- Keep the `litellm-proxy` package version in step with `litellm` through `cz bump` and a test, so images built from main report the right version - [PR #51807](https://github.com/BerriAI/litellm/pull/51807)
- Move audio, realtime and Langfuse e2e tests off OpenAI model ids that have shutdown dates between January and February 2027 - [PR #51816](https://github.com/BerriAI/litellm/pull/51816)
- Align the queued chat baggage mapping test fixtures so they use the fixture's actual vocabulary for tag mapping and tag budget checks - [PR #51847](https://github.com/BerriAI/litellm/pull/51847)
- Restore isolated gateway launcher imports in the configuration tests so they can check real client addresses behind Rust again after the runtime source move - [PR #51848](https://github.com/BerriAI/litellm/pull/51848)
- Update the queued streaming guardrail test to expect the intentional HTTP 403 JSON response when a failure happens before the first chunk - [PR #51849](https://github.com/BerriAI/litellm/pull/51849)
- Run the batch lifecycle e2e test with a key that only reaches its own deployment, so the Azure provider fallback case stops failing with a 404 after upload - [PR #51857](https://github.com/BerriAI/litellm/pull/51857)
- Expect adaptive thinking temperature dropping under `drop_params` in the Claude Opus 4.6 integration test, matching the intended change in #51834 - [PR #51859](https://github.com/BerriAI/litellm/pull/51859)
- Cut unit check time with cheaper per-test resets and fewer non-unit tests, since fixture setup was most of the unit test time - [PR #51864](https://github.com/BerriAI/litellm/pull/51864)
- Bump `litellm-enterprise` 0.1.85 to 0.1.86 and `litellm-proxy-extras` 0.4.116 to 0.4.117 so the next build pins wheels that include the new migrations - [PR #51876](https://github.com/BerriAI/litellm/pull/51876)
- Hold the concurrent upsert in the router deletion test where its build reads the list back, so it stops failing in every scheduled integration run - [PR #51878](https://github.com/BerriAI/litellm/pull/51878)
- Drop two batch e2e waits that never finish in time, saving about 9 minutes in the longest e2e file - [PR #51882](https://github.com/BerriAI/litellm/pull/51882)
- Move the Rust-backed S3 logger from `s3_v3` to `s3_v2` with file moves only and no behavior or name changes inside the files - [PR #51893](https://github.com/BerriAI/litellm/pull/51893)
- Move the Python-format helpers in `callbacks-s3-log` into `python-compat`, each pinned by fixtures written by CPython or pydantic - [PR #51895](https://github.com/BerriAI/litellm/pull/51895)
- Expect no native database pool in the proxy lifespan cleanup test, since the proxy stopped opening one in #49798 - [PR #51911](https://github.com/BerriAI/litellm/pull/51911)
- Record a stack when an owned proxy crashes in integration tests, so startup segmentation faults leave something to debug - [PR #51922](https://github.com/BerriAI/litellm/pull/51922)
- Keep detached stream failure hook state on the logging object and pass it to the callback as an argument, with no behavior change - [PR #51962](https://github.com/BerriAI/litellm/pull/51962)
- Flag conditionals with more than three boolean clauses through ruff `PLR0916` - [PR #51964](https://github.com/BerriAI/litellm/pull/51964)
- Remove the unreachable `VertexAIFilesHandler.afile_content`, since Vertex file reads already go through the Vertex files transformation - [PR #51966](https://github.com/BerriAI/litellm/pull/51966)
- Give the customer reset fixtures in the spend ledger parity tests an explicit cap, since uncapped customers now keep spend across resets - [PR #52058](https://github.com/BerriAI/litellm/pull/52058)
- Reuse the provider identity across dashboard and CLI sign-in in the blank user id SSO test, matching the stricter email fallback - [PR #52062](https://github.com/BerriAI/litellm/pull/52062)
- Expect zero admission tokens in the priority rate limit header test, since admission on an idle model now reserves one request and no tokens - [PR #52065](https://github.com/BerriAI/litellm/pull/52065)
- Update four stale integration and UI tests that still expected old behavior after intended changes, with no product code change - [PR #52108](https://github.com/BerriAI/litellm/pull/52108)
- Stop requiring safeguards calls to wait for the Anthropic beta map in the cold worker integration test, matching the lazy load from #52188 - [PR #52329](https://github.com/BerriAI/litellm/pull/52329)
- Bump `litellm-proxy-extras` 0.4.117 to 0.4.118 on rc/1.111.0 so the release pins a wheel that includes the new migrations - [PR #52370](https://github.com/BerriAI/litellm/pull/52370)

### PR roll-up by ownership area

PRs by ownership area (total: 525)

- Other: 111
- Models & Providers: 96
- Performance: 84
- Spend / Budgets / Rate Limits: 78
- LLM API Endpoints: 56
- Auth & Management: 36
- UI: 35
- Logging: 15
- MCP: 7
- Guardrails: 5
- Docs: 1
- Prompt Management: 1

## New Contributors

- [@collieai-dev](https://github.com/collieai-dev) made their first contribution in [PR #49224](https://github.com/BerriAI/litellm/pull/49224)
- [@giladk1221](https://github.com/giladk1221) made their first contribution in [PR #50883](https://github.com/BerriAI/litellm/pull/50883)
- [@hktitof](https://github.com/hktitof) made their first contribution in [PR #40376](https://github.com/BerriAI/litellm/pull/40376)
- [@kaizen-38](https://github.com/kaizen-38) made their first contribution in [PR #51318](https://github.com/BerriAI/litellm/pull/51318)
- [@kenneth-berri](https://github.com/kenneth-berri) made their first contribution in [PR #50764](https://github.com/BerriAI/litellm/pull/50764)
- [@kirti22jain](https://github.com/kirti22jain) made their first contribution in [PR #51608](https://github.com/BerriAI/litellm/pull/51608)
- [@maciej-berri](https://github.com/maciej-berri) made their first contribution in [PR #51440](https://github.com/BerriAI/litellm/pull/51440)
- [@mishdotdev](https://github.com/mishdotdev) made their first contribution in [PR #50642](https://github.com/BerriAI/litellm/pull/50642)
- [@nurlanmnn](https://github.com/nurlanmnn) made their first contribution in [PR #50979](https://github.com/BerriAI/litellm/pull/50979)
- [@princejain756](https://github.com/princejain756) made their first contribution in [PR #50657](https://github.com/BerriAI/litellm/pull/50657)
- [@raunakpandey1](https://github.com/raunakpandey1) made their first contribution in [PR #49806](https://github.com/BerriAI/litellm/pull/49806)
- [@saruar-dev](https://github.com/saruar-dev) made their first contribution in [PR #48426](https://github.com/BerriAI/litellm/pull/48426)
- [@satwik-bankapur](https://github.com/satwik-bankapur) made their first contribution in [PR #49914](https://github.com/BerriAI/litellm/pull/49914)
- [@srik-straiker](https://github.com/srik-straiker) made their first contribution in [PR #51401](https://github.com/BerriAI/litellm/pull/51401)
- [@taxfree-python](https://github.com/taxfree-python) made their first contribution in [PR #46845](https://github.com/BerriAI/litellm/pull/46845)
- [@tedswinyar](https://github.com/tedswinyar) made their first contribution in [PR #49183](https://github.com/BerriAI/litellm/pull/49183)
- [@VISHNU0906](https://github.com/VISHNU0906) made their first contribution in [PR #50210](https://github.com/BerriAI/litellm/pull/50210)
- [@zhengqiuyang](https://github.com/zhengqiuyang) made their first contribution in [PR #50249](https://github.com/BerriAI/litellm/pull/50249)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.110.0-rc.3...v1.111.0-rc.1
