---
title: "v1.102.4 - Spend Logged Once for Large Responses Bridge Requests"
slug: "v1-102-4"
date: 2026-10-07T17:56:53
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
docker.litellm.ai/berriai/litellm:1.102.4
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.102.4
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.102.4`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.102.4) and the full [releases page](https://github.com/BerriAI/litellm/releases)

`v1.102.4` is a patch release on top of [`v1.102.3`](/release_notes/v1.102.3/v1-102-3). It fixes large non-streaming chat requests to `openai/responses/*` models being logged and charged twice. There are no new database migrations or breaking changes

## Spend logged once for large Responses bridge requests

A non-streaming chat completion sent to an `openai/responses/*` model with a very large prompt (roughly 256 KiB of message text or more) wrote two spend log rows for one request, and key, team and daily spend went up by twice the real cost. The request is now logged once, with the provider's Responses result, and budgets drop by the real cost

### What's Changed

- fix(logging): log spend once for large non-streaming requests on the chat to Responses bridge - [PR #44508](https://github.com/BerriAI/litellm/pull/44508)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.102.3...v1.102.4
