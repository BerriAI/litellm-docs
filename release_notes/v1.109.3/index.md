---
title: "LiteLLM v1.109.3 and v1.106.12 fix GPT-6.2 caching on stored requests"
description: "GPT-6.2 caches system prompts on Chat Completions and Messages requests with store on or unset, and userless keys stop reading each other's key info."
slug: "v1-109-3"
date: 2026-11-20T03:58:13
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
docker.litellm.ai/berriai/litellm:1.109.3
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.109.3
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.109.3`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.109.3) and the full [releases page](https://github.com/BerriAI/litellm/releases).

`v1.109.3` is a patch release on top of [`v1.109.2`](/release_notes/v1.109.2/v1-109-2). There are no new database migrations. The `v1.109.3` tag points at [`37c2769`](https://github.com/BerriAI/litellm/commit/37c2769946f19d7075fe08e4da3c64b87ddc68ae).

### What's Changed

- **Caching:** Fixed GPT-6.2 system prompts missing the prompt cache on `/v1/chat/completions` and `/v1/messages` unless `store: false` - [PR #52906](https://github.com/BerriAI/litellm/pull/52906)
- **Keys, teams and auth:** Fixed JWT key mappings without `jwt_issuer` taking 5 minutes to apply when `litellm_jwtauth.issuers` is set, broken since v1.103.0 - [PR #52350](https://github.com/BerriAI/litellm/pull/52350)
- **Keys, teams and auth:** Fixed `/key/info` letting a key with no user read other userless keys by hash or alias - [PR #52838](https://github.com/BerriAI/litellm/pull/52838) and [PR #52925](https://github.com/BerriAI/litellm/pull/52925)
- **Deployment:** Changed filelock to 4.2.4 and soupsieve to 4.1 to match main - [PR #52937](https://github.com/BerriAI/litellm/pull/52937)
- **Deployment:** Changed the Docker images to a newer Wolfi base image - [PR #53008](https://github.com/BerriAI/litellm/pull/53008)

The changes are backported in [PR #52712](https://github.com/BerriAI/litellm/pull/52712), [PR #52929](https://github.com/BerriAI/litellm/pull/52929) and [PR #52937](https://github.com/BerriAI/litellm/pull/52937).

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.109.2...v1.109.3
