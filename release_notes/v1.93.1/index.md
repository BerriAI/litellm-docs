---
title: "v1.93.1 - Auth Cache Propagation, Temp Budgets & CLI SSO Sessions"
slug: "v1-93-1"
date: 2026-07-25T17:54:12
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

## Deploy this version

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
<TabItem value="docker" label="Docker">

```bash
docker run \
-e STORE_MODEL_IN_DB=True \
-p 4000:4000 \
docker.litellm.ai/berriai/litellm:1.93.1
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.93.1
```

</TabItem>
</Tabs>

`v1.93.1` is a patch release on top of [`v1.93.0`](/release_notes/v1.93.0/v1-93-0). It backports seven fixes onto the 1.93.x line, most of them around key auth and budgets.

Two read-path writers used to republish a stale auth blob back to the shared cache on every request, so with `enable_redis_auth_cache` and multiple replicas a `/key/update` or `/key/delete` never took effect fleet-wide while traffic continued, and a deleted key kept authenticating. The auth object is now written only by the DB-load paths.

Temporary budget increases work again in two ways they previously did not: an expiry written with a timezone no longer fails the request with "can't compare offset-naive and offset-aware datetimes", and a key served from the auth cache keeps its increased budget instead of reverting to the original and being blocked. The helper that applies the increase now returns a copy rather than mutating the token, so an increase cannot leak into shared cache state.

`lite login` completes on multi-replica deployments without `enable_redis_auth_cache`, because the CLI SSO login session is now stored in its own Redis-backed cache that every worker reads authoritatively. Spend from keys attached to an org-linked team but minted without an `organization_id` is now credited to the org, so org budgets see the traffic they are meant to govern. And the non-root runtime image bakes the prisma engines at a fixed world-readable path, so `prisma migrate deploy` no longer needs to download an engine at startup; this is what makes migrations work under an arbitrary uid, an air-gapped network, or a read-only root filesystem, matching the fix the default image already had.

The release also carries routine dependency maintenance updates to pypdf, pyasn1 and gitpython in the image lockfile.

### What's Changed

- fix(proxy): stop stale auth cache re-publish so key updates and deletes propagate across replicas - [PR #33565](https://github.com/BerriAI/litellm/pull/33565)
- fix(proxy/auth): handle tz-aware temp_budget_expiry - [PR #33840](https://github.com/BerriAI/litellm/pull/33840)
- fix(auth): apply temp_budget_increase for cache-hit keys - [PR #33841](https://github.com/BerriAI/litellm/pull/33841)
- refactor(auth): derive temp budget increase without mutating the token - [PR #34121](https://github.com/BerriAI/litellm/pull/34121)
- fix(proxy): share CLI SSO login sessions across workers without enable_redis_auth_cache - [PR #33261](https://github.com/BerriAI/litellm/pull/33261)
- fix(docker): bake non_root prisma engines at /opt/prisma so migrations run offline for any uid - [PR #34325](https://github.com/BerriAI/litellm/pull/34325)
- fix(proxy): attribute org spend for team-linked credentials minted without org_id - [PR #34577](https://github.com/BerriAI/litellm/pull/34577)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.93.0...v1.93.1
