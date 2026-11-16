---
title: "LiteLLM v1.109.1 and v1.110.0rc2 reject Azure login fields in the body"
description: "Model and pass-through routes reject tenant_id, client_id, client_secret and Azure login fields in the request body unless they are in metadata."
slug: "v1-110-0-rc-2"
date: 2026-11-12T02:53:14
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
docker.litellm.ai/berriai/litellm:1.110.0-rc.2
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.110.0rc2
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.110.0-rc.2`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.110.0-rc.2) and the full [releases page](https://github.com/BerriAI/litellm/releases).

The published GitHub tag is `v1.110.0-rc.2`. These notes compare it with `v1.110.0-rc.1`, the previous release candidate on `rc/1.110.0`. It is a small rc patch with one change backported onto the rc branch, and everything else is unchanged from `v1.110.0-rc.1`, whose [release notes](/release_notes/v1.110.0rc1/v1-110-0-rc-1) cover the full 1.110 line. There are no new database migrations. The `v1.110.0-rc.2` tag points at [`bf3cb0c`](https://github.com/BerriAI/litellm/commit/bf3cb0cd7bd46310142940a88d2cc32912c1bb66).

:::danger Breaking Changes

**Model and pass-through routes reject Azure login fields in the request body.** A request body with `tenant_id`, `client_id`, `client_secret`, `azure_username`, `azure_password` or `azure_scope` is rejected. Send these fields in `metadata`, or restore the old behavior with `general_settings.allow_client_side_credentials: true` or `configurable_clientside_auth_params` on the deployment. See [PR #51254](https://github.com/BerriAI/litellm/pull/51254). [`v1.106.9`](/release_notes/v1.106.9/v1-106-9), [`v1.108.6`](/release_notes/v1.108.6/v1-108-6) and [`v1.109.1`](/release_notes/v1.109.1/v1-109-1) have the same change.

:::

### What's Changed

- **Keys, teams and auth:** Changed model and pass-through routes to refuse body `client_id`, `client_secret`, `tenant_id` and Azure login fields, unless they are sent in `metadata` or an admin opted in - [PR #51254](https://github.com/BerriAI/litellm/pull/51254)

The change is backported in [PR #51263](https://github.com/BerriAI/litellm/pull/51263).

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.110.0-rc.1...v1.110.0-rc.2
