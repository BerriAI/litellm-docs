---
title: "v1.84.9 - Anthropic Cache-Control Cap"
slug: "v1-84-9"
date: 2026-06-16T18:19:59
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
docker.litellm.ai/berriai/litellm:1.84.9
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.84.9
```

</TabItem>
</Tabs>

`v1.84.9` is a patch release on top of [`v1.84.8`](/release_notes/v1.84.8/v1-84-8). It caps Anthropic `cache_control` injection at the 4-block API limit so prompt-caching requests no longer fail when more blocks are eligible.

### What's Changed

- fix(integrations): cap Anthropic cache_control injection at 4 blocks - [PR #30480](https://github.com/BerriAI/litellm/pull/30480)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.84.8...v1.84.9
