---
title: "LiteLLM v1.108.19 (LTS) adds Volcengine Seedream and Perplexity agent tools"
description: "Volcengine Ark Seedream joins the LTS line, Perplexity Agent API models take function tools, and agent calls bill at their own price."
slug: "v1-108-19"
date: 2026-11-26T19:04:36
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

`v1.108.19` is a patch release on the 1.108 LTS line. The `lts` image tag always points to the latest LTS release, so pull `docker.litellm.ai/berriai/litellm:lts` to stay on the newest LTS patch. See the [LTS pilot](/docs/enterprise/lts_pilot).

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
docker.litellm.ai/berriai/litellm:1.108.19
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.108.19
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.108.19`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.108.19) and the full [releases page](https://github.com/BerriAI/litellm/releases).

`v1.108.19` is a patch release on top of [`v1.108.18`](https://github.com/BerriAI/litellm/releases/tag/v1.108.18). There are no new database migrations. The `v1.108.19` tag points at [`56da5c3`](https://github.com/BerriAI/litellm/commit/56da5c3954805373220392a149e8821c55bededd).

### What's Changed

- **OpenAI:** Fixed `disable_parallel_tool_use`, `speed` and web search filters doing nothing on `/v1/messages` - [PR #54367](https://github.com/BerriAI/litellm/pull/54367)
- **Azure:** Fixed audio transcriptions ignoring the deployment's `api_version` and failing with a 500 on `api_version="v1"` - [PR #53402](https://github.com/BerriAI/litellm/pull/53402)
- **Azure:** Fixed Document Intelligence OCR ignoring `pages`, `outputContentFormat` and other `extra_body` options - [PR #53750](https://github.com/BerriAI/litellm/pull/53750)
- **Vertex AI and Gemini:** Fixed Gemini image requests that get no image answering a billed 200 with empty `data` instead of an error - [PR #53429](https://github.com/BerriAI/litellm/pull/53429)
- **Other providers:** Added Volcengine Ark Seedream image generation, image editing and pricing - [PR #54507](https://github.com/BerriAI/litellm/pull/54507)
- **Other providers:** Fixed Perplexity Agent API models rejecting or silently dropping function tools on `/v1/chat/completions` - [PR #53952](https://github.com/BerriAI/litellm/pull/53952) and [PR #54047](https://github.com/BerriAI/litellm/pull/54047)
- **Other providers:** Fixed OpenRouter stream chunks with only `reasoning_details` being dropped, which lost Claude's thinking signature - [PR #54564](https://github.com/BerriAI/litellm/pull/54564)
- **Chat completions:** Fixed streamed usage, as on watsonx, falling back to a local token estimate when SSE lines without data come first - [PR #54463](https://github.com/BerriAI/litellm/pull/54463)
- **Chat completions:** Fixed vLLM and other mid-stream upstream aborts ending as a clean `stop`, which kept half answers and skipped fallbacks - [PR #54466](https://github.com/BerriAI/litellm/pull/54466)
- **Chat completions:** Fixed streamed chunks leaving out `finish_reason: null` before the last chunk, which the Mistral SDK rejects - [PR #54623](https://github.com/BerriAI/litellm/pull/54623)
- **Messages API:** Fixed tool ids like `functions.Bash:0` being rewritten for non-Anthropic backends, stalling Claude Code after one call, broken since v1.91.0 - [PR #54445](https://github.com/BerriAI/litellm/pull/54445)
- **Messages API:** Fixed GPT and other non-Claude models ignoring an explicit `output_config.effort` beside a thinking budget - [PR #54594](https://github.com/BerriAI/litellm/pull/54594)
- **Agents:** Fixed agent calls on chat, `/v1/responses` and `/v1/messages` billing 0 or another agent's price instead of their own - [PR #54584](https://github.com/BerriAI/litellm/pull/54584)
- **Logging and observability:** Fixed Prometheus rate-limit gauges missing streamed `/v1/messages`, `/anthropic` pass-through and Foundry Claude calls - [PR #47039](https://github.com/BerriAI/litellm/pull/47039) and [PR #54373](https://github.com/BerriAI/litellm/pull/54373)
- **Deployment:** Changed the Docker images to bundle OpenSSL 3.5 LTS for Prisma instead of the end-of-life OpenSSL 3.6 - [PR #54428](https://github.com/BerriAI/litellm/pull/54428)

The changes are backported in [PR #54383](https://github.com/BerriAI/litellm/pull/54383) and [PR #54572](https://github.com/BerriAI/litellm/pull/54572).

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.108.18...v1.108.19
