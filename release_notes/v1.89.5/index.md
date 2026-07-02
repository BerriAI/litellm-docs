---
title: "v1.89.5 - Vertex Batch Upload Fix & Key Redaction"
slug: "v1-89-5"
date: 2026-06-29T18:17:14
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

:::info Update: no performance regression found

An earlier version of this note flagged a potential throughput regression. We investigated and could not confirm or reproduce any regression in the released version. The one report we received came from a deployment running custom code on top of what we shipped, and our testing points to those changes, not LiteLLM, as the likely cause.

Correctness and error rates were never affected. If you're on this version, there's nothing you need to do.

We're still monitoring incoming reports and will update this note if anything changes.

:::

## Deploy this version

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
<TabItem value="docker" label="Docker">

```bash
docker run \
-e STORE_MODEL_IN_DB=True \
-p 4000:4000 \
docker.litellm.ai/berriai/litellm:1.89.5
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.89.5
```

</TabItem>
</Tabs>

`v1.89.5` is a patch release on top of [`v1.89.4`](/release_notes/v1.89.4/v1-89-4). It switches Vertex AI batch-file uploads to a single media upload so large uploads no longer fail with 499 errors, and redacts the API key from `/key/info` client error messages.

### What's Changed

- fix(vertex_ai/files): single media upload for batch files to fix 499s on large uploads - [PR #31653](https://github.com/BerriAI/litellm/pull/31653)
- fix(proxy/client): redact api key from key/info client error messages - [PR #31342](https://github.com/BerriAI/litellm/pull/31342)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.89.4...v1.89.5
