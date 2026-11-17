---
title: "LiteLLM v1.108.5 (LTS) fixes workload identity on OpenAI routes and transcription cost"
description: "Keyless workload identity OpenAI deployments work on every route, transcription cost is correct for some FLAC files, and ollama_chat parallel tool calls stream with their own index."
slug: "v1-108-5"
date: 2026-11-10T22:51:37
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

`v1.108.5` is a patch release on the 1.108 LTS line. The `lts` image tag always points to the latest LTS release, so pull `docker.litellm.ai/berriai/litellm:lts` to stay on the newest LTS patch. See the [LTS pilot](/docs/enterprise/lts_pilot).

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
docker.litellm.ai/berriai/litellm:1.108.5
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.108.5
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.108.5`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.108.5) and the full [releases page](https://github.com/BerriAI/litellm/releases).

`v1.108.5` is a patch release on top of [`v1.108.4`](/release_notes/v1.108.4/v1-108-4). There are no new database migrations. The `v1.108.5` tag points at [`2a61f21`](https://github.com/BerriAI/litellm/commit/2a61f2114d45016bae77930903e65172cd8e762c).

### What's Changed

- **OpenAI:** Fixed keyless workload identity deployments answering 401 on image edits, audio, files, batches and other routes - [PR #50962](https://github.com/BerriAI/litellm/pull/50962)
- **Other providers:** Fixed `ollama_chat/` streams giving every parallel tool call index 0, so clients ran only the first call - [PR #50718](https://github.com/BerriAI/litellm/pull/50718)
- **Messages API:** Fixed `/v1/messages` answering 400 for a param listed in the deployment's `additional_drop_params` - [PR #50755](https://github.com/BerriAI/litellm/pull/50755)
- **Cost tracking and pricing:** Fixed incorrect transcription cost for some FLAC files, which could push a key over its budget - [PR #50860](https://github.com/BerriAI/litellm/pull/50860)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.108.4...v1.108.5
