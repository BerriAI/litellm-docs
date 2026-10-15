---
title: "v1.99.4 - End-User Budget Resets and GPT-6 Request Mapping"
slug: "v1-99-4"
date: 2026-09-25T06:20:00
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
docker.litellm.ai/berriai/litellm:1.99.4
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.99.4
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.99.4`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.99.4) and the full [releases page](https://github.com/BerriAI/litellm/releases)

`v1.99.4` is a patch release on top of [`v1.99.3`](/release_notes/v1.99.3/v1-99-3). It fixes end-user budget resets and maps GPT-6 model names to the GPT-5 request family. There are no new database migrations or breaking changes. The `v1.99.4` tag points at [`b6f084f`](https://github.com/BerriAI/litellm/commit/b6f084fc486707527d86458ec4ba07ced7942953)

## End-user budget resets

A shared budget with more than about 32,700 end users never reset, because the reset job listed every end user by id in one statement and Postgres rejected it, so those end users stayed blocked. The job now resets end users by their budget link. A reset also zeroes the cached end-user spend counter in memory and Redis, so requests on every replica stop getting a 429 once the window rolls over instead of after the cache expires

## GPT-6 model names use the GPT-5 request family

OpenAI and Azure configs now treat `gpt-6` model names like `gpt-5`, so they get the same request parameter handling. The lockfile also refreshes anyio, gitpython and soupsieve

### What's Changed

- fix: treat gpt-6 names as the gpt-5 request family in OpenAI and Azure configs - [PR #39631](https://github.com/BerriAI/litellm/pull/39631)
- fix(proxy): invalidate end-user spend counter and cache on budget reset - [PR #39729](https://github.com/BerriAI/litellm/pull/39729)
- fix(reset_budget_job): reset end users by budget link, not by user id - [PR #40639](https://github.com/BerriAI/litellm/pull/40639)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.99.3...v1.99.4
