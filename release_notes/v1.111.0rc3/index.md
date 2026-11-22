---
title: "LiteLLM v1.110.2 and v1.111.0rc3 fix Responses stream restarts"
description: "Responses streams stop retrying once output reached the client, and GPT-6.2 caches system prompts on stored Chat Completions and Messages requests."
slug: "v1-111-0-rc-3"
date: 2026-11-20T05:53:41
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
docker.litellm.ai/berriai/litellm:1.111.0-rc.3
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.111.0rc3
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.111.0-rc.3`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.111.0-rc.3) and the full [releases page](https://github.com/BerriAI/litellm/releases).

`v1.111.0rc3` is a release candidate on top of [`v1.111.0rc2`](/release_notes/v1.111.0rc2/v1-111-0-rc-2). There are no new database migrations. The `v1.111.0-rc.3` tag points at [`5608526`](https://github.com/BerriAI/litellm/commit/5608526a2ac0c254a9b24d7974d529805b39c17b).

### What's Changed

- **Anthropic:** Fixed `temperature=1` returning 400 on Claude models that removed sampling params on Anthropic, Vertex AI and Azure AI, broken since v1.110.0-rc.2 - [PR #52341](https://github.com/BerriAI/litellm/pull/52341)
- **Responses API:** Fixed streams retrying after output reached the client, which sent duplicate events and billed extra calls - [PR #52461](https://github.com/BerriAI/litellm/pull/52461)
- **Responses API:** Fixed streams that fail after reasoning output restarting on a fallback group and sending a second response - [PR #52616](https://github.com/BerriAI/litellm/pull/52616)
- **Caching:** Fixed GPT-6.2 system prompts missing the prompt cache on `/v1/chat/completions` and `/v1/messages` unless `store: false` - [PR #52906](https://github.com/BerriAI/litellm/pull/52906)
- **Cost tracking and pricing:** Fixed forwarded Anthropic credentials on `/v1/messages` ignoring the deployment's custom prices, broken since v1.109.0 - [PR #52313](https://github.com/BerriAI/litellm/pull/52313)
- **Keys, teams and auth:** Fixed 503s on a burst of first requests for new customer org aliases, which left their spend untracked - [PR #52080](https://github.com/BerriAI/litellm/pull/52080)
- **Keys, teams and auth:** Fixed JWT key mappings without `jwt_issuer` taking 5 minutes to apply when `litellm_jwtauth.issuers` is set, broken since v1.103.0 - [PR #52350](https://github.com/BerriAI/litellm/pull/52350)
- **Keys, teams and auth:** Fixed `/key/info` letting a key with no user read other userless keys by hash or alias - [PR #52838](https://github.com/BerriAI/litellm/pull/52838) and [PR #52925](https://github.com/BerriAI/litellm/pull/52925)
- **Admin UI:** Fixed SSO login redirecting to an `http://` URL when the proxy runs behind TLS termination, broken since v1.108.0 - [PR #52213](https://github.com/BerriAI/litellm/pull/52213)
- **Deployment:** Fixed each proxy worker opening six extra Postgres connections at boot - [PR #52378](https://github.com/BerriAI/litellm/pull/52378)
- **Performance:** Fixed failed calls holding large request bodies in memory until a full GC, growing workers to several GiB - [PR #52600](https://github.com/BerriAI/litellm/pull/52600)

The changes are backported in [PR #52462](https://github.com/BerriAI/litellm/pull/52462), [PR #52470](https://github.com/BerriAI/litellm/pull/52470), [PR #52691](https://github.com/BerriAI/litellm/pull/52691), [PR #52752](https://github.com/BerriAI/litellm/pull/52752), [PR #52764](https://github.com/BerriAI/litellm/pull/52764), [PR #52914](https://github.com/BerriAI/litellm/pull/52914) and [PR #52939](https://github.com/BerriAI/litellm/pull/52939).

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.111.0-rc.2...v1.111.0-rc.3
