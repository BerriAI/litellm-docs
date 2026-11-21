---
title: "LiteLLM v1.108.14 (LTS) fixes Claude tool search on Responses follow-ups"
description: "Claude's tool search stays on /v1/responses follow-up turns, and /v1/decisions accepts OpenAI input_json content parts."
slug: "v1-108-14"
date: 2026-11-20T23:42:30
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

:::tip

`v1.108.14` is a patch release on the 1.108 LTS line. The `lts` image tag always points to the latest LTS release, so pull `docker.litellm.ai/berriai/litellm:lts` to stay on the newest LTS patch. See the [LTS pilot](/docs/enterprise/lts_pilot).

:::

## Deploy this version

<Tabs>
<TabItem value="docker" label="Docker">

```bash
docker run \
-e LITELLM_MASTER_KEY=sk-<paste-a-long-random-key> \
-e DATABASE_URL=postgresql://<user>:<password>@<host>:5432/<dbname> \
-e STORE_MODEL_IN_DB=True \
-p 4000:4000 \
docker.litellm.ai/berriai/litellm:1.108.14
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.108.14
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.108.14`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.108.14) and the full [releases page](https://github.com/BerriAI/litellm/releases).

`v1.108.14` is a patch release on top of [`v1.108.13`](/release_notes/v1.108.13/v1-108-13). There are no new database migrations. The `v1.108.14` tag points at [`2e46e4c`](https://github.com/BerriAI/litellm/commit/2e46e4c77f3192b041ca13942a4c1035ef453969).

### What's Changed

- **Anthropic:** Fixed Claude's tool search going missing on `/v1/responses` follow-up turns, which led to 400s from Anthropic - [PR #50821](https://github.com/BerriAI/litellm/pull/50821)
- **Other:** Added support for OpenAI `input_json` content parts on `/v1/decisions` - [PR #52807](https://github.com/BerriAI/litellm/pull/52807)

The changes are backported in [PR #53007](https://github.com/BerriAI/litellm/pull/53007) and [PR #52807](https://github.com/BerriAI/litellm/pull/52807).

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.108.13...v1.108.14
