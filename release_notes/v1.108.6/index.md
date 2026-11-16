---
title: "LiteLLM v1.108.6 (LTS) fixes negative spend and Gemini image edit cost"
description: "Spend stays correct after scheduled budget resets on multi-pod deployments, Gemini image edits bill by tokens, and model routes reject Azure body fields."
slug: "v1-108-6"
date: 2026-11-12T01:12:23
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

`v1.108.6` is a patch release on the 1.108 LTS line. The `lts` image tag always points to the latest LTS release, so pull `docker.litellm.ai/berriai/litellm:lts` to stay on the newest LTS patch. See the [LTS pilot](/docs/enterprise/lts_pilot).

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
docker.litellm.ai/berriai/litellm:1.108.6
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.108.6
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.108.6`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.108.6) and the full [releases page](https://github.com/BerriAI/litellm/releases).

`v1.108.6` is a patch release on top of [`v1.108.5`](/release_notes/v1.108.5/v1-108-5). There are no new database migrations. The `v1.108.6` tag points at [`65781e1`](https://github.com/BerriAI/litellm/commit/65781e15922f3a7c33b8f991adf56c11d26d0a60).

:::danger Breaking Changes

**Model and pass-through routes reject Azure login fields in the request body.** A request body with `tenant_id`, `client_id`, `client_secret`, `azure_username`, `azure_password` or `azure_scope` is rejected. Send these fields in `metadata`, or restore the old behavior with `general_settings.allow_client_side_credentials: true` or `configurable_clientside_auth_params` on the deployment. See [PR #51254](https://github.com/BerriAI/litellm/pull/51254). [`v1.106.9`](/release_notes/v1.106.9/v1-106-9) and [`v1.109.1`](/release_notes/v1.109.1/v1-109-1) have the same change.

:::

### What's Changed

- **OpenAI:** Fixed gpt-5.4 and gpt-5.5 function-tool calls without `reasoning_effort` being bridged to `/v1/responses` - [PR #50968](https://github.com/BerriAI/litellm/pull/50968)
- **Vertex AI and Gemini:** Fixed Gemini image edits being billed at a flat per-image price instead of by tokens - [PR #51038](https://github.com/BerriAI/litellm/pull/51038)
- **Chat completions:** Fixed 400 on chat and bridged `/v1/responses` calls that send an `allowed_tools` tool choice - [PR #50726](https://github.com/BerriAI/litellm/pull/50726)
- **MCP:** Fixed Slack and GitHub MCP reconnects looping between the provider and the Connect page, broken since v1.107.0 - [PR #51045](https://github.com/BerriAI/litellm/pull/51045)
- **Guardrails:** Changed Zscaler AI Guard to scan only the latest user message on requests, not the whole conversation - [PR #50139](https://github.com/BerriAI/litellm/pull/50139)
- **Cost tracking and pricing:** Fixed 500 on usage routes when the database drops during key, user or team detail lookups - [PR #50253](https://github.com/BerriAI/litellm/pull/50253)
- **Keys, teams and auth:** Fixed key, user and team spend going negative after a scheduled budget reset on multi-pod deployments, broken since v1.103.0 - [PR #51120](https://github.com/BerriAI/litellm/pull/51120)
- **Keys, teams and auth:** Changed model and pass-through routes to refuse body `client_id`, `client_secret`, `tenant_id` and Azure login fields, unless they are sent in `metadata` or an admin opted in - [PR #51254](https://github.com/BerriAI/litellm/pull/51254)
- **Admin UI:** Fixed the empty Spend Per User card and missing per-user data on `/user/daily/activity/aggregated` - [PR #51043](https://github.com/BerriAI/litellm/pull/51043)

The changes are backported in [PR #50435](https://github.com/BerriAI/litellm/pull/50435), [PR #51064](https://github.com/BerriAI/litellm/pull/51064), [PR #51122](https://github.com/BerriAI/litellm/pull/51122), [PR #51229](https://github.com/BerriAI/litellm/pull/51229), [PR #51240](https://github.com/BerriAI/litellm/pull/51240) and [PR #51260](https://github.com/BerriAI/litellm/pull/51260).

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.108.5...v1.108.6
