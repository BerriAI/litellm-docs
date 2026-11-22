---
title: "LiteLLM v1.110.1, v1.111.0rc2 and v1.106.11 fix GPT-6.2 prompt caching"
description: "GPT-6.2 caches system prompts again for Chat Completions and Messages requests that set store to false, so repeated prompts cost less."
slug: "v1-110-1"
date: 2026-11-19T03:47:43
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
docker.litellm.ai/berriai/litellm:1.110.1
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.110.1
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.110.1`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.110.1) and the full [releases page](https://github.com/BerriAI/litellm/releases).

`v1.110.1` is a patch release on top of [`v1.110.0`](/release_notes/v1.110.0/v1-110-0). There are no new database migrations. The `v1.110.1` tag points at [`47b394b`](https://github.com/BerriAI/litellm/commit/47b394ba1b5bbe7f4b3f119a95b56957f4a32fad).

:::danger Breaking Changes

- **Deployment:** Switch exec probes on the UI image from `curl` to `wget`, since that image no longer ships `curl` - [PR #52298](https://github.com/BerriAI/litellm/pull/52298)

:::

### What's Changed

- **OpenAI:** Fixed GPT-6.2 prompt caching for system prompts sent to `/v1/chat/completions` or `/v1/messages` with `store: false` - [PR #52599](https://github.com/BerriAI/litellm/pull/52599) and [PR #52694](https://github.com/BerriAI/litellm/pull/52694)
- **Deployment:** Changed the UI image to slim nginx, which drops `curl` but keeps `wget` and `nc` - [PR #52298](https://github.com/BerriAI/litellm/pull/52298)
- **Deployment:** Changed the Docker images to a newer Wolfi base image - [PR #52749](https://github.com/BerriAI/litellm/pull/52749)

The changes are backported in [PR #52595](https://github.com/BerriAI/litellm/pull/52595) and [PR #52658](https://github.com/BerriAI/litellm/pull/52658).

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.110.0...v1.110.1
