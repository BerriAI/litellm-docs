---
title: "LiteLLM v1.110.1, v1.111.0rc2 and v1.106.11 fix GPT-6.2 prompt caching"
description: "GPT-6.2 caches system prompts again for Chat Completions and Messages requests that set store to false, so repeated prompts cost less."
slug: "v1-106-11"
date: 2026-11-19T06:34:51
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
docker.litellm.ai/berriai/litellm:1.106.11
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.106.11
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.106.11`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.106.11) and the full [releases page](https://github.com/BerriAI/litellm/releases).

`v1.106.11` is a patch release on top of [`v1.106.10`](/release_notes/v1.106.10/v1-106-10). There are no new database migrations. The `v1.106.11` tag points at [`c6ad936`](https://github.com/BerriAI/litellm/commit/c6ad936242c32ae8c30de62e754c8a4904db04c3).

### What's Changed

- **OpenAI:** Fixed GPT-6.2 prompt caching for system prompts sent to `/v1/chat/completions` or `/v1/messages` with `store: false` - [PR #52599](https://github.com/BerriAI/litellm/pull/52599) and [PR #52694](https://github.com/BerriAI/litellm/pull/52694)

The change is backported in [PR #52665](https://github.com/BerriAI/litellm/pull/52665), [PR #52698](https://github.com/BerriAI/litellm/pull/52698) and [PR #52738](https://github.com/BerriAI/litellm/pull/52738).

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.106.10...v1.106.11
