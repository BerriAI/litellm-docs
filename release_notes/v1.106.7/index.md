---
title: "LiteLLM v1.106.7 supports custom video providers on /v1/videos"
description: "Serves /v1/videos for providers in custom_provider_map. The proxy and its Helm charts no longer package the Lens beta."
slug: "v1-106-7"
date: 2026-11-04T04:28:59
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
docker.litellm.ai/berriai/litellm:1.106.7
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.106.7
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.106.7`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.106.7) and the full [releases page](https://github.com/BerriAI/litellm/releases).

:::danger Breaking Changes

**If your Helm values set `lensWorker.enabled`, remove it before upgrading so the chart renders.** We are readjusting how beta features work alongside LiteLLM, our core product. Starting with 1.106.7, the Lens beta is no longer packaged with the proxy or its Helm charts. If you use Lens today, v1.106.6 keeps working as it does now. See [PR #49173](https://github.com/BerriAI/litellm/pull/49173).

:::

`v1.106.7` is a patch release on top of [`v1.106.6`](/release_notes/v1.106.6/v1-106-6). There are no new database migrations. The `v1.106.7` tag points at [`25fc8bf`](https://github.com/BerriAI/litellm/commit/25fc8bfefc006f47a61cf6ac360384e57e6a24c2).

### What's Changed

- **Embeddings, images and audio:** Added `/v1/videos` support for custom providers registered in `custom_provider_map` - [PR #49802](https://github.com/BerriAI/litellm/pull/49802)
- **Lens:** Moved the Lens beta out of the proxy package and Helm charts - [PR #49173](https://github.com/BerriAI/litellm/pull/49173)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.106.6...v1.106.7
