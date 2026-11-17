---
title: "LiteLLM v1.108.7 (LTS) adds Gemini batches and Bedrock image search"
description: "Adds Gemini batches on /v1/batches, Bedrock image search and gpt-image edits on Azure AI Foundry. Responses-only fields on bridges need drop_params."
slug: "v1-108-7"
date: 2026-11-12T20:27:30
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

`v1.108.7` is a patch release on the 1.108 LTS line. The `lts` image tag always points to the latest LTS release, so pull `docker.litellm.ai/berriai/litellm:lts` to stay on the newest LTS patch. See the [LTS pilot](/docs/enterprise/lts_pilot).

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
docker.litellm.ai/berriai/litellm:1.108.7
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.108.7
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.108.7`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.108.7) and the full [releases page](https://github.com/BerriAI/litellm/releases).

`v1.108.7` is a patch release on top of [`v1.108.6`](/release_notes/v1.108.6/v1-108-6). There are no new database migrations. The `v1.108.7` tag points at [`1b769ce`](https://github.com/BerriAI/litellm/commit/1b769ce7d8627ab70460cdef92cfa549a1b1ea40).

:::danger Breaking Changes

- **Responses API:** Set `drop_params: true` or stop sending Responses-only fields such as `max_tool_calls` to providers bridged through chat completions - [PR #48655](https://github.com/BerriAI/litellm/pull/48655), also in [`v1.109.0`](/release_notes/v1.109.0/v1-109-0)

:::

### What's Changed

- **Azure:** Added gpt-image edits on Azure AI Foundry deployments, including deployments under a custom name - [PR #49650](https://github.com/BerriAI/litellm/pull/49650)
- **AWS Bedrock:** Added image search on Bedrock knowledge bases with `query_image`, including image hits in the results - [PR #51062](https://github.com/BerriAI/litellm/pull/51062)
- **Vertex AI and Gemini:** Fixed Gemini image calls billing text, thinking and Vertex Priority tokens at the wrong rates - [PR #51017](https://github.com/BerriAI/litellm/pull/51017)
- **Vertex AI and Gemini:** Fixed `/gemini` `batchGenerateContent` batches logging $0 with model `unknown` instead of billing the calling key - [PR #51279](https://github.com/BerriAI/litellm/pull/51279)
- **Other providers:** Fixed `reasoning_effort` being dropped or rejected for Baseten models - [PR #40152](https://github.com/BerriAI/litellm/pull/40152), also in [`v1.109.0`](/release_notes/v1.109.0/v1-109-0)
- **Other providers:** Fixed `baseten/*` listing retired deployment IDs instead of the current Baseten Model APIs - [PR #46945](https://github.com/BerriAI/litellm/pull/46945), also in [`v1.109.0`](/release_notes/v1.109.0/v1-109-0)
- **Responses API:** Fixed missing or repeated `sequence_number` on bridged `/v1/responses` streaming events - [PR #44944](https://github.com/BerriAI/litellm/pull/44944)
- **Responses API:** Fixed streamed MCP follow-ups keeping only the latest tool round, so models repeated tool calls - [PR #47698](https://github.com/BerriAI/litellm/pull/47698), also in [`v1.109.0`](/release_notes/v1.109.0/v1-109-0)
- **Responses API:** Fixed 400 on Bedrock when a `previous_response_id` chain contains a failed turn - [PR #48647](https://github.com/BerriAI/litellm/pull/48647), also in [`v1.109.0`](/release_notes/v1.109.0/v1-109-0)
- **Responses API:** Changed Responses-only fields such as `max_tool_calls` to answer 400 on bridged providers unless `drop_params` is on - [PR #48655](https://github.com/BerriAI/litellm/pull/48655), also in [`v1.109.0`](/release_notes/v1.109.0/v1-109-0)
- **Batches and files:** Added Gemini batches on `/v1/batches`, with output download through `/v1/files` and spend tracking - [PR #51032](https://github.com/BerriAI/litellm/pull/51032)
- **Routing and fallbacks:** Fixed Decisions calls on a mixed model group hitting a Bedrock deployment and answering 400 - [PR #48175](https://github.com/BerriAI/litellm/pull/48175), also in [`v1.109.0`](/release_notes/v1.109.0/v1-109-0)

The changes are backported in [PR #51262](https://github.com/BerriAI/litellm/pull/51262), [PR #51266](https://github.com/BerriAI/litellm/pull/51266), [PR #51271](https://github.com/BerriAI/litellm/pull/51271) and [PR #51340](https://github.com/BerriAI/litellm/pull/51340).

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.108.6...v1.108.7
