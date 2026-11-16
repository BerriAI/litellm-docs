---
title: "LiteLLM v1.106.9 forwards ChatGPT logins and rejects Azure body fields"
description: "Codex and Pi keep their own ChatGPT login through the gateway, and model routes reject Azure login fields in the request body unless they are in metadata."
slug: "v1-106-9"
date: 2026-11-12T01:06:15
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
docker.litellm.ai/berriai/litellm:1.106.9
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.106.9
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.106.9`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.106.9) and the full [releases page](https://github.com/BerriAI/litellm/releases).

`v1.106.9` is a patch release on top of [`v1.106.8`](/release_notes/v1.106.8/v1-106-8). There are no new database migrations. The `v1.106.9` tag points at [`36742a0`](https://github.com/BerriAI/litellm/commit/36742a02ea378ba89c6b0c5833092914a66d1b18).

:::danger Breaking Changes

**Model and pass-through routes reject Azure login fields in the request body.** A request body with `tenant_id`, `client_id`, `client_secret`, `azure_username`, `azure_password` or `azure_scope` is rejected. Send these fields in `metadata`, or restore the old behavior with `general_settings.allow_client_side_credentials: true` or `configurable_clientside_auth_params` on the deployment. See [PR #51254](https://github.com/BerriAI/litellm/pull/51254). [`v1.108.6`](/release_notes/v1.108.6/v1-108-6) and [`v1.109.1`](/release_notes/v1.109.1/v1-109-1) have the same change.

:::

### What's Changed

- **OpenAI:** Added forwarding of a client's own ChatGPT subscription through the gateway, so Codex and Pi keep their ChatGPT login while using a separate gateway key. A recognized client ChatGPT login now takes precedence over a saved gateway login - [PR #41522](https://github.com/BerriAI/litellm/pull/41522)
- **Keys, teams and auth:** Changed model and pass-through routes to refuse body `client_id`, `client_secret`, `tenant_id` and Azure login fields, unless they are sent in `metadata` or an admin opted in - [PR #51254](https://github.com/BerriAI/litellm/pull/51254)

The changes are backported in [PR #49888](https://github.com/BerriAI/litellm/pull/49888) and [PR #51261](https://github.com/BerriAI/litellm/pull/51261).

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.106.8...v1.106.9
