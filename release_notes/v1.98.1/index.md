---
title: "v1.98.1 - Claude Code on Bedrock GPT and Grok, End-User Budget Resets"
slug: "v1-98-1"
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
docker.litellm.ai/berriai/litellm:1.98.1
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.98.1
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.98.1`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.98.1) and the full [releases page](https://github.com/BerriAI/litellm/releases)

`v1.98.1` is a patch release on top of [`v1.98.0`](/release_notes/v1.98.0/v1-98-0). It lets Claude Code switch to Bedrock OpenAI GPT and xAI Grok models, fixes end-user budget resets, and maps GPT-6 model names to the GPT-5 request family. There are no new database migrations or breaking changes. The `v1.98.1` tag points at [`b521c4c`](https://github.com/BerriAI/litellm/commit/b521c4c74ed1432770c69b2a24196f96366de8a8)

## Claude Code works with Bedrock OpenAI GPT and xAI Grok models

Claude Code sends a `max_tokens=1` probe when you switch models with `/model`, and Bedrock OpenAI GPT and xAI Grok models reject anything under 16, so the switch failed with a 400. The Bedrock Converse route now raises `maxTokens` to 16 for `openai.gpt-*` and `xai.grok-*` models, and other Bedrock models keep the value they were sent

Once the switch worked, the first message on a GPT-6 model such as `us.openai.gpt-6-astra` still failed with `Unknown parameter: 'thinking'`. The Converse reasoning gate now recognizes any `openai.gpt-<digit>` model, so `reasoning_effort` maps to `reasoning.effort` and Claude Code's `thinking` block is dropped for these models instead of being forwarded

## End-user budget resets

A shared budget with more than about 32,700 end users never reset, because the reset job listed every end user by id in one statement and Postgres rejected it, so those end users stayed blocked. The job now resets end users by their budget link. A reset also zeroes the cached end-user spend counter in memory and Redis, so requests on every replica stop getting a 429 once the window rolls over instead of after the cache expires

## GPT-6 model names use the GPT-5 request family

OpenAI and Azure configs now treat `gpt-6` model names like `gpt-5`, so they get the same request parameter handling

## Docker images pin Python 3.13

The images installed an unpinned `python3`, which now resolves to Python 3.14, where the pinned `uvloop` no longer builds. Every image on this line, the migrations image included, now installs Python 3.13. The base image also moves to a wolfi-base with glibc 2.44, and the lockfile refreshes anyio, gitpython, pypdf, restrictedpython, soupsieve, sqlparse and tornado

### What's Changed

- fix(bedrock): clamp maxTokens to the 16-token minimum for OpenAI GPT and xAI Grok models on Converse - [PR #41870](https://github.com/BerriAI/litellm/pull/41870)
- fix(bedrock): match any `openai.gpt-<digit>` model in the Converse reasoning gate - [`9f48cca`](https://github.com/BerriAI/litellm/commit/9f48ccaecf3e1c02c14408fe1aab94d051a8bc1a)
- fix(docker): bump wolfi-base for glibc 2.44 and pin apk python to 3.13 - [`1af2cad`](https://github.com/BerriAI/litellm/commit/1af2cad04ab4d260d9cc2444ff8c3ff67c454c66)
- fix(docker): bump wolfi-base for glibc 2.44 and pin apk python to 3.13 in migrations image - [`0c0dda9`](https://github.com/BerriAI/litellm/commit/0c0dda97809e5096f58344be77eeac8ced1f86e6)
- fix: treat gpt-6 names as the gpt-5 request family in OpenAI and Azure configs - [PR #39631](https://github.com/BerriAI/litellm/pull/39631)
- fix(proxy): invalidate end-user spend counter and cache on budget reset - [PR #39729](https://github.com/BerriAI/litellm/pull/39729)
- fix(reset_budget_job): reset end users by budget link, not by user id - [PR #40639](https://github.com/BerriAI/litellm/pull/40639)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.98.0...v1.98.1
