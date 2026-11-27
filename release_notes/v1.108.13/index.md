---
title: "LiteLLM v1.108.13 (LTS) fixes Unix-socket Postgres boot and GPT-6.2 caching"
description: "Proxies on a Unix-socket Postgres such as Cloud SQL boot again, and GPT-6.2 and Claude Code requests keep their prompt cache."
slug: "v1-108-13"
date: 2026-11-20T03:59:55
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

`v1.108.13` is a patch release on the 1.108 LTS line. The `lts` image tag always points to the latest LTS release, so pull `docker.litellm.ai/berriai/litellm:lts` to stay on the newest LTS patch. See the [LTS pilot](/docs/enterprise/lts_pilot).

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
docker.litellm.ai/berriai/litellm:1.108.13
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.108.13
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.108.13`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.108.13) and the full [releases page](https://github.com/BerriAI/litellm/releases).

`v1.108.13` is a patch release on top of [`v1.108.12`](/release_notes/v1.108.12/v1-108-12). There are no new database migrations. The `v1.108.13` tag points at [`7af0eac`](https://github.com/BerriAI/litellm/commit/7af0eac1d15d661c690d41e554bcc749e4ec41bb).

### What's Changed

- **Messages API:** Fixed Claude Code's rotating billing header breaking prompt caching and inflating input tokens on non-Anthropic models - [PR #52922](https://github.com/BerriAI/litellm/pull/52922)
- **Caching:** Fixed GPT-6.2 system prompts missing the prompt cache on `/v1/chat/completions` and `/v1/messages` unless `store: false` - [PR #52906](https://github.com/BerriAI/litellm/pull/52906)
- **Keys, teams and auth:** Fixed JWT key mappings without `jwt_issuer` taking 5 minutes to apply when `litellm_jwtauth.issuers` is set, broken since v1.103.0 - [PR #52350](https://github.com/BerriAI/litellm/pull/52350)
- **Keys, teams and auth:** Fixed `/key/info` letting a key with no user read other userless keys by hash or alias - [PR #52838](https://github.com/BerriAI/litellm/pull/52838) and [PR #52925](https://github.com/BerriAI/litellm/pull/52925)
- **Deployment:** Fixed proxy boot on Unix-socket Postgres like Cloud SQL, where the migration lock dialed `localhost:5432` - [PR #52797](https://github.com/BerriAI/litellm/pull/52797)

The changes are backported in [PR #52713](https://github.com/BerriAI/litellm/pull/52713), [PR #52819](https://github.com/BerriAI/litellm/pull/52819), [PR #52907](https://github.com/BerriAI/litellm/pull/52907) and [PR #52919](https://github.com/BerriAI/litellm/pull/52919).

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.108.12...v1.108.13
