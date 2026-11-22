---
title: "LiteLLM v1.109.2 adds Gemini batches and fixes OOM on 429 retries"
description: "Adds Gemini batches on /v1/batches, refuses over-limit keys before the proxy reads the request body, and fixes SSO login behind TLS termination."
slug: "v1-109-2"
date: 2026-11-19T02:37:12
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
docker.litellm.ai/berriai/litellm:1.109.2
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.109.2
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.109.2`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.109.2) and the full [releases page](https://github.com/BerriAI/litellm/releases).

`v1.109.2` is a patch release on top of [`v1.109.1`](/release_notes/v1.109.1/v1-109-1). There are no new database migrations. The `v1.109.2` tag points at [`fa6d80e`](https://github.com/BerriAI/litellm/commit/fa6d80e77770e862fa0e8799c123f909c0f25982).

:::danger Breaking Changes

- **Deployment:** Switch exec probes on the UI image from `curl` to `wget`, since that image no longer ships `curl` - [PR #52298](https://github.com/BerriAI/litellm/pull/52298)

:::

### What's Changed

- **OpenAI:** Fixed GPT-6.2 prompt caching for system prompts sent to `/v1/chat/completions` or `/v1/messages` with `store: false` - [PR #52599](https://github.com/BerriAI/litellm/pull/52599) and [PR #52694](https://github.com/BerriAI/litellm/pull/52694)
- **Vertex AI and Gemini:** Added Gemini batches on `/v1/batches`, with output download through `/v1/files` and spend tracking - [PR #51032](https://github.com/BerriAI/litellm/pull/51032)
- **Vertex AI and Gemini:** Fixed Gemini batches created through `/gemini` logging $0 spend with model `unknown` - [PR #51279](https://github.com/BerriAI/litellm/pull/51279)
- **Vertex AI and Gemini:** Fixed `reasoning_effort: "xhigh"` returning 400 on `gemini-4-hydrogen`, and added its pricing - [PR #52060](https://github.com/BerriAI/litellm/pull/52060)
- **Other providers:** Fixed Perplexity billing cached prompt tokens at the full input rate when the response has no `usage.cost` - [PR #51669](https://github.com/BerriAI/litellm/pull/51669)
- **Other providers:** Fixed the `/fal_ai` pass-through price check missing submits sent with `/requests/..` or an encoded `?` in the path - [PR #51671](https://github.com/BerriAI/litellm/pull/51671)
- **Embeddings, images and audio:** Fixed custom image handlers not receiving `n`, `size`, `quality`, `response_format`, `user` or `mask` - [PR #52051](https://github.com/BerriAI/litellm/pull/52051)
- **Batches and files:** Fixed file ownership checks not matching other spellings of the same provider file id, like `files%2F<id>` - [PR #51498](https://github.com/BerriAI/litellm/pull/51498)
- **Routing and fallbacks:** Fixed streamed `/v1/responses` calls that fail before any output skipping the same model group retry - [PR #51953](https://github.com/BerriAI/litellm/pull/51953) and [PR #52461](https://github.com/BerriAI/litellm/pull/52461)
- **Keys, teams and auth:** Fixed out-of-memory restarts when blocked or over-limit keys retry large requests, now refused before the body is read - [PR #51428](https://github.com/BerriAI/litellm/pull/51428), [PR #51525](https://github.com/BerriAI/litellm/pull/51525), [PR #51675](https://github.com/BerriAI/litellm/pull/51675) and [PR #52169](https://github.com/BerriAI/litellm/pull/52169)
- **Keys, teams and auth:** Fixed budgets with long unit spellings like `1month`, `7days` or `2weeks` resetting every midnight - [PR #51672](https://github.com/BerriAI/litellm/pull/51672)
- **Keys, teams and auth:** Fixed team member spend never resetting for users auto-joined to a default team or given `default_team_member_models`, broken since v1.95.0 - [PR #51728](https://github.com/BerriAI/litellm/pull/51728) and [PR #51960](https://github.com/BerriAI/litellm/pull/51960)
- **Admin UI:** Fixed usage pages returning 500 when a database lookup for key, user or team details fails - [PR #50253](https://github.com/BerriAI/litellm/pull/50253)
- **Admin UI:** Fixed the Spend Per User card on User Usage showing no users - [PR #49464](https://github.com/BerriAI/litellm/pull/49464)
- **Admin UI:** Fixed Login with SSO redirecting to `http://` behind TLS termination, broken since v1.108.0 - [PR #52213](https://github.com/BerriAI/litellm/pull/52213)
- **Deployment:** Changed the UI image to slim nginx, which drops `curl` but keeps `wget` and `nc` - [PR #52298](https://github.com/BerriAI/litellm/pull/52298)
- **Deployment:** Changed filelock, oauthlib, opentelemetry, dnspython, tornado, next, soupsieve and msal-node to newer releases - [PR #51712](https://github.com/BerriAI/litellm/pull/51712), [PR #52322](https://github.com/BerriAI/litellm/pull/52322) and [PR #52420](https://github.com/BerriAI/litellm/pull/52420)
- **Other:** Changed `/health` errors to drop Python stack traces, which stay in the proxy log with `--detailed_debug` - [PR #52005](https://github.com/BerriAI/litellm/pull/52005)

The changes are backported in [PR #51044](https://github.com/BerriAI/litellm/pull/51044), [PR #52243](https://github.com/BerriAI/litellm/pull/52243), [PR #52310](https://github.com/BerriAI/litellm/pull/52310), [PR #52418](https://github.com/BerriAI/litellm/pull/52418), [PR #52561](https://github.com/BerriAI/litellm/pull/52561), [PR #52664](https://github.com/BerriAI/litellm/pull/52664), [PR #52684](https://github.com/BerriAI/litellm/pull/52684) and [PR #52707](https://github.com/BerriAI/litellm/pull/52707).

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.109.1...v1.109.2
