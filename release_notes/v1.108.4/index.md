---
title: "LiteLLM v1.108.4 (LTS) fixes Bedrock pass-through guardrails and video polls"
description: "Bedrock pass-through routes enforce the model's guardrailConfig, video polls keep their model, and tool calls work on a base SDK install without mcp."
slug: "v1-108-4"
date: 2026-11-09T23:00:51
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

`v1.108.4` is a patch release on the 1.108 LTS line. The `lts` image tag always points to the latest LTS release, so pull `docker.litellm.ai/berriai/litellm:lts` to stay on the newest LTS patch. See the [LTS pilot](/docs/enterprise/lts_pilot).

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
docker.litellm.ai/berriai/litellm:1.108.4
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.108.4
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.108.4`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.108.4) and the full [releases page](https://github.com/BerriAI/litellm/releases).

`v1.108.4` is a patch release on top of [`v1.108.3`](/release_notes/v1.108.3/v1-108-3). There are no new database migrations. The `v1.108.4` tag points at [`e6f080f`](https://github.com/BerriAI/litellm/commit/e6f080fb5633aa71ea81b652bd72069aff1f0228).

### What's Changed

- **AWS Bedrock:** Fixed 400s from GLM, GPT-6 Luna and Nova 2 on Bedrock when the conversation carries Claude's signed thinking - [PR #50399](https://github.com/BerriAI/litellm/pull/50399)
- **AWS Bedrock:** Changed `/bedrock` pass-through routes to enforce the model's `guardrailConfig` over any guardrail the caller sends - [PR #47429](https://github.com/BerriAI/litellm/pull/47429)
- **Vertex AI and Gemini:** Fixed Vertex AI Claude batches failing with 404 at create - [PR #50365](https://github.com/BerriAI/litellm/pull/50365)
- **Messages API:** Fixed `chatgpt/` models on `/v1/messages` dropping encrypted reasoning between turns - [PR #50456](https://github.com/BerriAI/litellm/pull/50456)
- **Messages API:** Fixed `/v1/messages` to OpenAI sending `background: true` upstream, which billed full runs that came back empty - [PR #50462](https://github.com/BerriAI/litellm/pull/50462)
- **Embeddings, images and audio:** Fixed `/v1/videos` polls failing with per-model keys or hitting the wrong provider account with a 404 - [PR #44614](https://github.com/BerriAI/litellm/pull/44614)
- **Routing and fallbacks:** Fixed team keys being served by a proxy-wide wildcard instead of the team's own BYOK wildcard deployment - [PR #48490](https://github.com/BerriAI/litellm/pull/48490)
- **SDK:** Fixed `completion()`, `responses()` and `messages` with tools failing with `No module named 'mcp'` on a base install, broken since v1.106.0 - [PR #45961](https://github.com/BerriAI/litellm/pull/45961)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.108.3...v1.108.4
