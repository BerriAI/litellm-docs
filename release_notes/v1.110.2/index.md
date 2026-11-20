---
title: "LiteLLM v1.110.2 and v1.111.0rc3 fix Responses stream restarts"
description: "Responses streams stop retrying once output reached the client, and GPT-6.2 caches system prompts on stored Chat Completions and Messages requests."
slug: "v1-110-2"
date: 2026-11-20T04:05:22
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
docker.litellm.ai/berriai/litellm:1.110.2
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.110.2
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.110.2`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.110.2) and the full [releases page](https://github.com/BerriAI/litellm/releases).

`v1.110.2` is a patch release on top of [`v1.110.1`](/release_notes/v1.110.1/v1-110-1). There are no new database migrations. The `v1.110.2` tag points at [`c3cafa3`](https://github.com/BerriAI/litellm/commit/c3cafa3782642685ef10777e4c5931400c0a7176).

### What's Changed

- **Anthropic:** Fixed `temperature=1` returning 400 on Claude models that removed sampling params on Anthropic, Vertex AI and Azure AI, broken since v1.110.0-rc.2 - [PR #52341](https://github.com/BerriAI/litellm/pull/52341)
- **Responses API:** Fixed streams retrying after output reached the client, which sent duplicate events and billed extra calls - [PR #52461](https://github.com/BerriAI/litellm/pull/52461)
- **Responses API:** Fixed streams that fail after reasoning output restarting on a fallback group and sending a second response - [PR #52616](https://github.com/BerriAI/litellm/pull/52616)
- **Caching:** Fixed GPT-6.2 system prompts missing the prompt cache on `/v1/chat/completions` and `/v1/messages` unless `store: false` - [PR #52906](https://github.com/BerriAI/litellm/pull/52906)
- **Cost tracking and pricing:** Fixed forwarded Anthropic credentials on `/v1/messages` ignoring the deployment's custom prices, broken since v1.109.0 - [PR #52313](https://github.com/BerriAI/litellm/pull/52313)
- **Keys, teams and auth:** Fixed JWT key mappings without `jwt_issuer` taking 5 minutes to apply when `litellm_jwtauth.issuers` is set, broken since v1.103.0 - [PR #52350](https://github.com/BerriAI/litellm/pull/52350)
- **Keys, teams and auth:** Fixed `/key/info` letting a key with no user read other userless keys by hash or alias - [PR #52838](https://github.com/BerriAI/litellm/pull/52838) and [PR #52925](https://github.com/BerriAI/litellm/pull/52925)
- **Performance:** Fixed memory growth from every finished request staying in memory until a full GC pass, broken since v1.110.0-rc.1 - [PR #51888](https://github.com/BerriAI/litellm/pull/51888)

The changes are backported in [PR #52463](https://github.com/BerriAI/litellm/pull/52463), [PR #52469](https://github.com/BerriAI/litellm/pull/52469), [PR #52690](https://github.com/BerriAI/litellm/pull/52690), [PR #52751](https://github.com/BerriAI/litellm/pull/52751), [PR #52920](https://github.com/BerriAI/litellm/pull/52920) and [PR #52938](https://github.com/BerriAI/litellm/pull/52938).

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.110.1...v1.110.2
