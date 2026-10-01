---
title: "v1.100.3 - GPT-6 Request Handling & End-User Budget Resets"
slug: "v1-100-3"
date: 2026-09-25T06:21:39
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
docker.litellm.ai/berriai/litellm:1.100.3
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.100.3
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.100.3`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.100.3) and the full [releases page](https://github.com/BerriAI/litellm/releases)

`v1.100.3` is a patch release on top of [`v1.100.2`](/release_notes/v1.100.2/v1-100-2). It makes GPT-6 models take the same request handling as GPT-5, fixes two ways an end-user budget reset could leave customers blocked, and refreshes several locked dependencies. There are no configuration changes. Both the Docker image and the PyPI package were built from [`385266c`](https://github.com/BerriAI/litellm/commit/385266c14d6a4cb069751fd3525692e0a760ec57)

## GPT-6 models get GPT-5 request handling

GPT-6 names such as `gpt-6-astra` failed every GPT-5 check, so they were treated as plain chat models. Chat completions returned 400 on `reasoning_effort`, `max_tokens` and function tools, and the Responses and Messages routes forwarded `temperature`, which OpenAI rejects. One helper now matches GPT-5 and GPT-6 names, still excluding `gpt-5-chat`, and the OpenAI chat, OpenAI Responses and both Azure configs use it

## End-user budget resets take effect everywhere

An end-user budget reset zeroed the spend in the database but not the cached spend counter, and only the worker that ran the reset evicted its cached end-user object. Requests kept getting 429 after the window rolled over until every cache expired. The reset now zeroes the counter in memory and Redis and evicts the cached end user, and enforcement checks the database spend when a cached counter looks stale

A shared end-user budget with more than about 32,700 customers never reset, because the reset job listed every customer id in one statement and PostgreSQL refused it, so those customers stayed blocked. End users are now reset by their budget link, so the statement size tracks the number of budgets instead of the number of customers

## Dependencies

The lockfile moves anyio to 4.14.2, gitpython to 3.1.60, pypdf to 6.16.1, soupsieve to 2.9 and tornado to 6.5.8. No declared dependency range changed

### What's Changed

- fix: treat gpt-6 names as the gpt-5 request family in OpenAI and Azure configs - [PR #39631](https://github.com/BerriAI/litellm/pull/39631)
- fix(proxy): invalidate end-user spend counter and cache on budget reset - [PR #39729](https://github.com/BerriAI/litellm/pull/39729)
- fix(reset_budget_job): reset end users by budget link, not by user id - [PR #40639](https://github.com/BerriAI/litellm/pull/40639)
- chore(deps): refresh anyio, gitpython, pypdf, soupsieve and tornado in the lockfile - [PR #43132](https://github.com/BerriAI/litellm/pull/43132)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.100.2...v1.100.3
