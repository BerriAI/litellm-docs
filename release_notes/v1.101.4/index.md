---
title: "v1.101.4 - Straiker v3 Platform and Guardrail api_version Fixes"
slug: "v1-101-4"
date: 2026-10-01T05:10:00
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
docker.litellm.ai/berriai/litellm:1.101.4
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.101.4
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.101.4`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.101.4) and the full [releases page](https://github.com/BerriAI/litellm/releases)

:::info Upgrading

There are no new database migrations or breaking changes on top of [`v1.101.3`](/release_notes/v1.101.3/v1-101-3). If you are upgrading from `v1.101.2` or earlier, read the breaking change in the `v1.101.3` notes first: Admin UI and `lite` CLI users sign in once more after upgrading

:::

`v1.101.4` is a patch release on top of [`v1.101.3`](https://github.com/BerriAI/litellm/releases/tag/v1.101.3). It lets the Straiker guardrail use v3 platform keys and stops a shared `api_version` default from breaking Azure Content Safety guardrails. The `v1.101.4` tag points at [`f471923`](https://github.com/BerriAI/litellm/commit/f4719232112d87f9f815f37120f916c42a37a30e)

## Straiker guardrail supports v3 platform keys

Straiker v3 keys (`sk_agt_...`) got a 401 on every guarded request, because the guardrail only knew the v1 webhook route. With a v3 key the guardrail now relays traffic to `/api/v3/detect`, an `x-s6r-agent` request header names the calling app, and a block from Straiker reaches the caller as a 400 with the tenant's block message. Existing v1 keys see no change

A Straiker guardrail whose config carries a leftover `api_version` other than `v1` or `v3`, for example `2024-09-01` copied from an Azure block, now loads with a warning and picks its route from the key prefix. Without this, the proxy would have started without the guardrail and served requests unchecked

## Azure Content Safety guardrails work without `api_version`

The shared guardrail params defaulted `api_version` to Javelin's `v1`, so Azure Content Safety guardrails without an explicit `api_version` called Azure with `api-version=v1` and got a 404, which failed every request when the guardrail was `default_on`. The shared default is now unset, Azure guardrails fall back to `2024-09-01`, and a stored `v1` on an Azure guardrail created through `POST /guardrails` is treated as unset, so those guardrails start working after the upgrade without edits. Javelin still fills in `v1` itself

### What's Changed

- fix(guardrails): stop the Javelin api_version default leaking into Azure Content Safety - [PR #41941](https://github.com/BerriAI/litellm/pull/41941)
- feat(guardrails): straiker guardrail speaks the v3 platform API (/api/v3/detect) - [PR #41880](https://github.com/BerriAI/litellm/pull/41880)
- fix(guardrails): treat an unknown straiker api_version as unset instead of skipping the guardrail - [PR #43956](https://github.com/BerriAI/litellm/pull/43956)
- chore(deps): bump pyjwt to 2.14.0 - [`bdc4212`](https://github.com/BerriAI/litellm/commit/bdc421261e1b744bfdfe6819d652bc056146c417)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.101.3...v1.101.4
