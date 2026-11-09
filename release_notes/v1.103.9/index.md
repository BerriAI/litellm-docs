---
title: "LiteLLM v1.106.4, v1.105.5, v1.104.7 and v1.103.9 refresh image base layers"
description: "Docker images move to newer base images, so image scans stop flagging packages the images do not use."
slug: "v1-103-9"
date: 2026-10-25T08:57:32
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
docker.litellm.ai/berriai/litellm:1.103.9
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.103.9
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.103.9`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.103.9) and the full [releases page](https://github.com/BerriAI/litellm/releases)

`v1.103.9` is a patch release on top of [`v1.103.8`](/release_notes/v1.103.8/v1-103-8). It moves the Docker images to newer base images on `stable/1.103.x`. There are no new database migrations. The `v1.103.9` tag points at [`58daf87`](https://github.com/BerriAI/litellm/commit/58daf875b74091a6bfd1fd59f18f1e4dcd356bc5)

### What's Changed

- Docker images move to newer base images, so image scans stop flagging brotli 1.2.0, the emSign ECC Root CA - G3 and packages from repo lockfiles that the images never install - [PR #48281](https://github.com/BerriAI/litellm/pull/48281)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.103.8...v1.103.9
