---
title: "LiteLLM v1.108.16 (LTS) adds Perplexity Orchestrator and fixes Codex on Bedrock"
description: "Perplexity Orchestrator, Gradium and Gnani join the LTS line, Codex keeps working after its first tool call on Bedrock, and Anthropic SDK 2.x calls stop failing on the newest API version."
slug: "v1-108-16"
date: 2026-11-23T22:11:31
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

:::tip

`v1.108.16` is a patch release on the 1.108 LTS line. The `lts` image tag always points to the latest LTS release, so pull `docker.litellm.ai/berriai/litellm:lts` to stay on the newest LTS patch. See the [LTS pilot](/docs/enterprise/lts_pilot).

:::

## Deploy this version

<Tabs>
<TabItem value="docker" label="Docker">

```bash
docker run \
-e LITELLM_MASTER_KEY=sk-<paste-a-long-random-key> \
-e DATABASE_URL=postgresql://<user>:<password>@<host>:5432/<dbname> \
-e STORE_MODEL_IN_DB=True \
-p 4000:4000 \
docker.litellm.ai/berriai/litellm:1.108.16
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.108.16
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.108.16`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.108.16) and the full [releases page](https://github.com/BerriAI/litellm/releases).

:::danger Breaking Changes

**Set `api_key` or `AZURE_API_KEY` on `azure` `/openai/v1` deployments that relied on `OPENAI_API_KEY`.** See [PR #51144](https://github.com/BerriAI/litellm/pull/51144) and [PR #53408](https://github.com/BerriAI/litellm/pull/53408).

**Set `LITELLM_MCP_DCR_GATEWAY_CLIENT=true` to keep automatic gateway-owned registration for new clientless DCR bridges.** See [PR #53059](https://github.com/BerriAI/litellm/pull/53059).

:::

`v1.108.16` is a patch release on top of [`v1.108.15`](/release_notes/v1.108.15/v1-108-15). There are no new database migrations. The `v1.108.16` tag points at [`c9a0e74`](https://github.com/BerriAI/litellm/commit/c9a0e742cc02860accfcacebd7f238a6fbaaa1a6).

### What's Changed

- **Azure:** Fixed `azure_ai` calls that authenticate with only an Entra token failing with 400 from Foundry - [PR #49769](https://github.com/BerriAI/litellm/pull/49769)
- **Azure:** Fixed `azure_ai` chat and `/v1/messages` on Foundry project, resource and `/openai/v1` bases failing with 4xx errors - [PR #51144](https://github.com/BerriAI/litellm/pull/51144) and [PR #53408](https://github.com/BerriAI/litellm/pull/53408)
- **Anthropic:** Fixed `/v1/messages` with `temperature`, `top_p` or `top_k` failing under `anthropic-version: 2026-10-21` - [PR #53395](https://github.com/BerriAI/litellm/pull/53395)
- **Anthropic:** Fixed `extra_body` fields reaching Claude nested and failing with 400 `Extra inputs are not permitted` - [PR #53411](https://github.com/BerriAI/litellm/pull/53411)
- **AWS Bedrock:** Fixed Bedrock native chat and `/v1/responses` ignoring `aws_bedrock_runtime_endpoint` when `api_base` is also set - [PR #50582](https://github.com/BerriAI/litellm/pull/50582)
- **AWS Bedrock:** Fixed a Bedrock `model_id` profile model failing next to a deployment that names the same profile by ARN - [PR #53462](https://github.com/BerriAI/litellm/pull/53462)
- **AWS Bedrock:** Fixed Mistral Large 3 and Ministral 3 on Bedrock Converse answering 400 to `tool_choice` - [PR #53591](https://github.com/BerriAI/litellm/pull/53591)
- **Vertex AI and Gemini:** Added `gemini-decision-1` on `/v1/decisions` and `/v1/systemone` - [PR #53696](https://github.com/BerriAI/litellm/pull/53696)
- **Vertex AI and Gemini:** Fixed Gemini image chat returning the thought draft image next to the final one in `message.images` - [PR #50709](https://github.com/BerriAI/litellm/pull/50709)
- **Vertex AI and Gemini:** Fixed Gemini dropping `const` from tool and response schemas, so const fields came back empty or made up - [PR #53415](https://github.com/BerriAI/litellm/pull/53415)
- **Vertex AI and Gemini:** Fixed Gemini and Vertex AI silently dropping `video_url` content parts - [PR #53420](https://github.com/BerriAI/litellm/pull/53420)
- **Vertex AI and Gemini:** Fixed Vertex Gemini answering 400 to every `service_tier` value - [PR #53428](https://github.com/BerriAI/litellm/pull/53428)
- **Vertex AI and Gemini:** Fixed Gemini 3+ dropping web search when function tools are also sent - [PR #53432](https://github.com/BerriAI/litellm/pull/53432)
- **Vertex AI and Gemini:** Fixed Vertex image edits drawing a new picture every turn and failing with 400 on the third image turn - [PR #53446](https://github.com/BerriAI/litellm/pull/53446)
- **Vertex AI and Gemini:** Fixed Gemini image generation and edits ignoring `size`, `aspect_ratio`, `image_size` and `imageConfig` - [PR #53581](https://github.com/BerriAI/litellm/pull/53581)
- **Vertex AI and Gemini:** Fixed Anthropic SDK 2.x calls to Claude on Vertex AI `/v1/messages` failing with 400 over `anthropic-version` - [PR #53590](https://github.com/BerriAI/litellm/pull/53590)
- **Vertex AI and Gemini:** Fixed Gemini prompt caching never hitting when a conversation carries later system messages - [PR #53635](https://github.com/BerriAI/litellm/pull/53635)
- **Vertex AI and Gemini:** Fixed Gemini batch embeddings billing video and other media inputs at $0 or at the text rate - [PR #53679](https://github.com/BerriAI/litellm/pull/53679)
- **Vertex AI and Gemini:** Fixed `n` above 1 with image `modalities` on Vertex image models failing with an unclear error, now a clear 400 - [PR #53752](https://github.com/BerriAI/litellm/pull/53752)
- **Other providers:** Added Gradium text-to-speech on `/v1/audio/speech` - [PR #53463](https://github.com/BerriAI/litellm/pull/53463)
- **Other providers:** Added the Perplexity Orchestrator provider (`perplexity_orchestrator/`) with cost tracking - [PR #53585](https://github.com/BerriAI/litellm/pull/53585)
- **Other providers:** Added Gnani transcription with Prisma v2.5 and v3 on `/v1/audio/transcriptions` - [PR #53672](https://github.com/BerriAI/litellm/pull/53672)
- **Other providers:** Fixed Mistral on Vertex AI and Bedrock answering 400 to tool call ids in the conversation history - [PR #53426](https://github.com/BerriAI/litellm/pull/53426)
- **Other providers:** Fixed a `TypeError` when SAP streams `reasoning_content` as a list of signed blocks - [PR #53458](https://github.com/BerriAI/litellm/pull/53458)
- **Other providers:** Fixed empty or cut SageMaker and Bedrock agent streams returning 200, now a 502 so retries and fallbacks run - [PR #53482](https://github.com/BerriAI/litellm/pull/53482)
- **Chat completions:** Fixed a custom provider stream failing with `APIConnectionError: 'is_finished'` when a chunk lacks a field - [PR #53417](https://github.com/BerriAI/litellm/pull/53417)
- **Chat completions:** Fixed streamed chat with `n` above 1 giving `delta.role` to only one choice - [PR #53592](https://github.com/BerriAI/litellm/pull/53592)
- **Responses API:** Fixed Codex over `ws /v1/responses` failing after its first tool call on Bedrock, Azure AI and OpenRouter - [PR #53410](https://github.com/BerriAI/litellm/pull/53410)
- **Responses API:** Fixed faked `/v1/responses` streams returning reasoning items that later fail with 400 `invalid_encrypted_content` - [PR #53747](https://github.com/BerriAI/litellm/pull/53747)
- **Embeddings, images and audio:** Fixed audio output requests to Gemini TTS and gpt-audio on bridged endpoints returning an empty but billed 200 - [PR #53745](https://github.com/BerriAI/litellm/pull/53745)
- **Token counting:** Fixed token counts for grok-4.3 and Azure grok-4-1-fast-non-reasoning landing 23 to 328 tokens under the bill - [PR #53443](https://github.com/BerriAI/litellm/pull/53443)
- **MCP:** Fixed a forced hosted MCP `tool_choice` failing under `drop_params`, and Bedrock batch rows ignoring `drop_params` - [PR #53697](https://github.com/BerriAI/litellm/pull/53697)
- **MCP:** Changed gateway-owned DCR client registration to opt-in, fixing `403 oauth_principal_mismatch` for shared service keys - [PR #53059](https://github.com/BerriAI/litellm/pull/53059)
- **Guardrails:** Fixed `/v1/messages` guardrails dropping `cache_control` on Claude and Gemini aliases, which lost prompt caching - [PR #53832](https://github.com/BerriAI/litellm/pull/53832)
- **Caching:** Fixed cache hits logging success twice on large `/v1/responses` prompts and on `/v1/messages` to chat-only models - [PR #53465](https://github.com/BerriAI/litellm/pull/53465)
- **Cost tracking and pricing:** Fixed a cut `/v1/responses` stream on a bridged provider billing an estimate instead of the reported input - [PR #53419](https://github.com/BerriAI/litellm/pull/53419)
- **Cost tracking and pricing:** Fixed DB-only models losing custom pricing after a price data reload and logging $0 spend - [PR #53870](https://github.com/BerriAI/litellm/pull/53870)
- **SDK:** Fixed `e.response.text` being empty on Responses API and Anthropic errors raised to SDK callers - [PR #53743](https://github.com/BerriAI/litellm/pull/53743)
- **Other:** Fixed decision calls failing with `use_litellm_proxy` or a `litellm_proxy/` model, and Router sending them to OpenAI - [PR #53196](https://github.com/BerriAI/litellm/pull/53196)

The changes are backported in [PR #53180](https://github.com/BerriAI/litellm/pull/53180), [PR #53409](https://github.com/BerriAI/litellm/pull/53409), [PR #53414](https://github.com/BerriAI/litellm/pull/53414), [PR #53441](https://github.com/BerriAI/litellm/pull/53441), [PR #53483](https://github.com/BerriAI/litellm/pull/53483), [PR #53584](https://github.com/BerriAI/litellm/pull/53584) and [PR #53764](https://github.com/BerriAI/litellm/pull/53764).

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.108.15...v1.108.16
