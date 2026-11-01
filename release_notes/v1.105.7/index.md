---
title: "LiteLLM v1.106.6 and v1.105.7 fix the gzip performance regression"
description: "The proxy gzips only dashboard analytics responses and compresses them on a worker thread, so gzip no longer slows down inference requests."
slug: "v1-105-7"
date: 2026-10-28T22:55:25
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
docker.litellm.ai/berriai/litellm:1.105.7
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.105.7
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.105.7`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.105.7) and the full [releases page](https://github.com/BerriAI/litellm/releases).

:::danger Breaking Changes

**Inference and other endpoints outside the dashboard analytics routes no longer return gzip responses.** The proxy ignores `Accept-Encoding: gzip` on those routes, so their responses are larger on the wire. LiteLLM has no setting to restore the old behavior. If you need compressed responses, turn on compression in a reverse proxy or load balancer in front of the proxy. See [PR #46712](https://github.com/BerriAI/litellm/pull/46712).

:::

`v1.105.7` is a patch release on top of [`v1.105.6`](/release_notes/v1.105.6/v1-105-6). It fixes the gzip performance regression on `stable/1.105.x` that the [`v1.105.6`](/release_notes/v1.105.6/v1-105-6) notes warn about. There are no new database migrations. The `v1.105.7` tag points at [`3f775a9`](https://github.com/BerriAI/litellm/commit/3f775a9e224ea779fa778ec84749c594406c9843).

### What's Changed

- The proxy only gzips responses from the dashboard analytics routes, such as the Usage and Cost Optimization pages, and compresses them on a worker thread instead of the event loop. Requests sent with `Accept-Encoding: gzip`, which most HTTP clients and the OpenAI SDKs send by default, no longer slow down other requests on the same worker - [PR #46712](https://github.com/BerriAI/litellm/pull/46712)

The change and the version bump are backported in [PR #48679](https://github.com/BerriAI/litellm/pull/48679).

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.105.6...v1.105.7
