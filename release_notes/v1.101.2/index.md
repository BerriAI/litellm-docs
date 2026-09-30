---
title: "v1.101.2 - Bedrock Invoke Streaming & End-User Budget Resets"
slug: "v1-101-2"
date: 2026-09-24T00:17:20
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
docker.litellm.ai/berriai/litellm:1.101.2
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.101.2
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.101.2`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.101.2) and the full [releases page](https://github.com/BerriAI/litellm/releases)

`v1.101.2` is a patch release on top of [`v1.101.1`](/release_notes/v1.101.1/v1-101-1). It stops `/v1/messages` streams on Bedrock Invoke from stalling and fixes end-user budget resets for large shared budgets. There are no configuration changes. Both the Docker image and the PyPI package were built from [`ccb327f`](https://github.com/BerriAI/litellm/commit/ccb327f032c69754445763dbec669a5d2517630c)

## Bedrock Invoke streams on /v1/messages no longer stall

`/v1/messages` on Bedrock Invoke held upstream bytes in a 1024-byte buffer, so complete events sat in it whenever Bedrock paused mid-stream. Claude Code showed a silent stream while the model wrote a large file. Bedrock bytes now pass straight through, the same way the chat completions Bedrock paths already worked

## Large shared end-user budgets reset again

A shared end-user budget with more than about 32,700 customers never reset, because the reset job listed every customer id in one statement and PostgreSQL refused it, so those customers stayed blocked. End users are now reset by their budget link, so the statement size tracks the number of budgets instead of the number of customers

### What's Changed

- fix(bedrock): stream /v1/messages Invoke bytes through instead of holding them in a 1024-byte chunker - [PR #42607](https://github.com/BerriAI/litellm/pull/42607)
- fix(reset_budget_job): reset end users by budget link, not by user id - [PR #40639](https://github.com/BerriAI/litellm/pull/40639)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.101.1...v1.101.2
