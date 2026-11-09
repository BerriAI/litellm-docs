---
title: "LiteLLM v1.103.5 fixes tool calls in chat completions on GPT-5.4 and newer"
description: "Fixes tool calls in chat completions on GPT-5.4 and newer. Tool calls stay on choices[0], and each call in a reply gets its own index."
slug: "v1-103-5"
date: 2026-10-17T17:02:19
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
docker.litellm.ai/berriai/litellm:1.103.5
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.103.5
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.103.5`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.103.5) and the full [releases page](https://github.com/BerriAI/litellm/releases)

`v1.103.5` is a patch release on top of [`v1.103.4`](/release_notes/v1.103.4/v1-103-4). It fixes how LiteLLM turns a Responses API reply back into a chat completion, which affects `/chat/completions` calls with tools on GPT-5.4 and newer and on `responses/` deployments. The `v1.103.5` tag points at [`dec1691`](https://github.com/BerriAI/litellm/commit/dec1691c90c7bf4417f7b7d956ab4b65f10728b5)

### What's Changed

- Tool calls no longer land on a separate `choices[1]`, so agents that only read `choices[0]` run them again - [PR #46099](https://github.com/BerriAI/litellm/pull/46099)
- Multiple tool calls in one non-streaming reply now get their own `index` instead of all being 0 - [PR #46109](https://github.com/BerriAI/litellm/pull/46109)

Both fixes are backported in [PR #46949](https://github.com/BerriAI/litellm/pull/46949)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.103.4...v1.103.5
