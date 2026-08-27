---
title: "v1.91.4 - Docker Migration Assets & Prisma Bake"
slug: "v1-91-4"
date: 2026-07-18T19:14:34
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

## Deploy this version

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
<TabItem value="docker" label="Docker">

```bash
docker run \
-e STORE_MODEL_IN_DB=True \
-p 4000:4000 \
docker.litellm.ai/berriai/litellm:1.91.4
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.91.4
```

</TabItem>
</Tabs>

`v1.91.4` is a patch release on top of [`v1.91.3`](/release_notes/v1.91.3/v1-91-3). It backports two Docker fixes onto the 1.91.x line. The first restores the `/app/litellm-proxy-extras` source directory in the runtime images, so downstream migration jobs that point `prisma migrate deploy` at that path apply migrations again instead of silently succeeding with no schema. The second bakes the prisma CLI and engines at `/opt/prisma`, a fixed path every runtime uid can read, so fresh-database migrations work under kubernetes `runAsUser`, `docker --user`, and other non-root deployments with no network access. The release also carries routine dependency maintenance updates to mcp and soupsieve in the image lockfile.

### What's Changed

- fix(docker): restore litellm-proxy-extras source dir in runtime images - [PR #33592](https://github.com/BerriAI/litellm/pull/33592)
- fix(docker): bake prisma CLI and engines at a fixed path so fresh-DB migrations work for any uid offline - [PR #33853](https://github.com/BerriAI/litellm/pull/33853)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.91.3...v1.91.4
