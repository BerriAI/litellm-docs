---
title: "LiteLLM v1.106.5, v1.105.6, v1.104.8 and v1.103.10 trim failure logs for rejected requests"
description: "Failure logs for rejected requests keep only core request fields, and the GCS logger uses the bucket configured on the proxy."
slug: "v1-106-5"
date: 2026-10-27T19:58:45
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
docker.litellm.ai/berriai/litellm:1.106.5
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.106.5
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.106.5`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.106.5) and the full [releases page](https://github.com/BerriAI/litellm/releases)

`v1.106.5` is a patch release on top of [`v1.106.4`](/release_notes/v1.106.4/v1-106-4). It changes what failure logs for rejected requests carry and how the GCS logger picks its bucket on `stable/1.106.x`. There are no new database migrations. The `v1.106.5` tag points at [`2569eb8`](https://github.com/BerriAI/litellm/commit/2569eb88694ce148dea5f324f240f79d256af8ae)

### What's Changed

- Failure logs for rejected requests keep only core request fields, `tags` and guardrail details - [PR #48599](https://github.com/BerriAI/litellm/pull/48599)
- The GCS logger uses the bucket and credentials configured on the proxy - [PR #48599](https://github.com/BerriAI/litellm/pull/48599)

The change and the version bump are backported in [PR #48605](https://github.com/BerriAI/litellm/pull/48605)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.106.4...v1.106.5
