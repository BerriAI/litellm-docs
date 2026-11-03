---
title: "LiteLLM v1.106.4, v1.105.5, v1.104.7 and v1.103.9 refresh image base layers"
description: "Fixes a startup crash when the remote model cost map is unreachable, and moves the Docker images to newer base images."
slug: "v1-106-4"
date: 2026-10-25T09:39:15
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
docker.litellm.ai/berriai/litellm:1.106.4
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.106.4
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.106.4`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.106.4) and the full [releases page](https://github.com/BerriAI/litellm/releases)

`v1.106.4` is a patch release on top of [`v1.106.3`](/release_notes/v1.106.3/v1-106-3). It fixes a startup crash when the remote model cost map is unreachable and moves the Docker images to newer base images on `stable/1.106.x`. There are no new database migrations. The `v1.106.4` tag points at [`ea7ca16`](https://github.com/BerriAI/litellm/commit/ea7ca16dbc3904d9e59a9505f379a2ca3091821f)

### What's Changed

- The proxy no longer sometimes exits on startup with an `ImportError` when it cannot reach the remote model cost map. This started in `v1.104.0` - [PR #46711](https://github.com/BerriAI/litellm/pull/46711)
- Docker images move to newer base images, so image scans stop flagging brotli 1.2.0, the emSign ECC Root CA - G3 and packages from repo lockfiles that the images never install - [PR #48283](https://github.com/BerriAI/litellm/pull/48283), [PR #48300](https://github.com/BerriAI/litellm/pull/48300)

The startup fix and the version bump are backported in [PR #48294](https://github.com/BerriAI/litellm/pull/48294)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.106.3...v1.106.4
