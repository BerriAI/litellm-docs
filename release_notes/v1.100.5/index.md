---
title: "v1.100.5 - Per End User Semantic Cache Scope"
slug: "v1-100-5"
date: 2026-10-01T23:39:07
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
docker.litellm.ai/berriai/litellm:1.100.5
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.100.5
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.100.5`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.100.5) and the full [releases page](https://github.com/BerriAI/litellm/releases)

`v1.100.5` is a patch release on top of [`v1.100.4`](https://github.com/BerriAI/litellm/releases/tag/v1.100.4). It adds an opt-in setting that keeps semantic cache hits separate per end user, and refreshes four locked dependencies

## Semantic cache scope per end user

With a semantic cache (`redis-semantic`, `qdrant-semantic` or `valkey-semantic`), every end user behind one virtual key shared a cache bucket, so one user could be served another user's semantically similar answer. Set `semantic_cache_scope: end_user` under `cache_params`, or pick "End user" under Semantic Cache Scope on the Admin UI's Cache Settings tab, and each end user only gets hits from their own requests. Requests without an end-user id fall back to the shared key bucket. The default stays `key`

The tenant scope now also reads the identity that `/v1/responses` and `/v1/messages` carry, so under the default `key` scope those two routes no longer share hits across keys, teams and orgs. Semantic cache entries written on those routes before the upgrade miss once

`semantic_cache_scope` accepts only `key` or `end_user`. Sending null or an empty string to `/cache/settings` returns an error, and a stored value like that leaves response caching off after the next restart

## Dependency refresh

PyJWT 2.15.0, pypdf 6.19.0, urllib3 2.8.0 and tornado 6.5.9. PyJWT now rejects JWT segments that use base64 padding or non url-safe characters, which only identity providers outside RFC 7515 emit

### What's Changed

- feat(caching): add semantic_cache_scope to isolate semantic cache hits per end user - [PR #39590](https://github.com/BerriAI/litellm/pull/39590)
- test: deflake JWT tamper assertions and fuzzy picker widget driver - [`25c5f0d`](https://github.com/BerriAI/litellm/commit/25c5f0d993dc87069d18ad8b0a9b1fe8c57ada31)
- chore(deps): bump pyjwt to 2.15.0, pypdf to 6.19.0, urllib3 to 2.8.0, tornado to 6.5.9 - [PR #44151](https://github.com/BerriAI/litellm/pull/44151)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.100.4...v1.100.5
