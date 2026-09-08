---
title: "v1.90.6 - Prisma Bake for Non-Root Migrations"
slug: "v1-90-6"
date: 2026-07-19T02:09:06
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
docker.litellm.ai/berriai/litellm:1.90.6
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.90.6
```

</TabItem>
</Tabs>

`v1.90.6` is a patch release on top of [`v1.90.5`](/release_notes/v1.90.5/v1-90-5). Where `v1.90.5` restored the `litellm-proxy-extras` source folder to the runtime images, this release makes those migration assets usable from any account: the prisma CLI and its engines are now baked at `/opt/prisma`, a fixed path every runtime uid can read. Deployments that run as a non-root user, such as kubernetes `runAsUser` and `docker --user`, previously had prisma fall back to downloading its engines into a home directory it could not write, so a fresh-database migration failed on hosts with no outbound network access. Migrations now run offline under any uid. The release also carries routine dependency maintenance updates to mcp, pypdf, pydantic-settings, python-multipart, and starlette in the image lockfile.

### What's Changed

- fix(docker): bake prisma CLI and engines at a fixed path so fresh-DB migrations work for any uid offline - [PR #33853](https://github.com/BerriAI/litellm/pull/33853)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.90.5...v1.90.6
