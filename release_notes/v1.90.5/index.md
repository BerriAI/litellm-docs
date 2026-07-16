---
title: "v1.90.5 - Docker Migration Assets Restored"
slug: "v1-90-5"
date: 2026-07-16T15:38:03
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
docker.litellm.ai/berriai/litellm:1.90.5
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.90.5
```

</TabItem>
</Tabs>

`v1.90.5` is a patch release on top of [`v1.90.4`](/release_notes/v1.90.4/v1-90-4). It restores the `litellm-proxy-extras` source folder (the Prisma schema and its migrations catalog) in the runtime stage of all three published Docker images. Images from `v1.90.0` through `v1.90.4` dropped `/app/litellm-proxy-extras`, which broke deployments that run their own pre-deploy migration job against the schema and migrations shipped at that path; the breakage could be silent, because `prisma migrate deploy` pointed at a schema with no adjacent migrations directory exits 0 without applying anything. Images now match what `v1.89.x` and earlier contained.

### What's Changed

- fix(docker): restore litellm-proxy-extras source dir in runtime images - [PR #33592](https://github.com/BerriAI/litellm/pull/33592)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.90.4...v1.90.5
