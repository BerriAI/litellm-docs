---
title: "LiteLLM v1.108.8 (LTS) fixes Azure Decisions calls and an MCP sign-in loop"
description: "Azure deployments work on /v1/decisions, Gemini file ownership checks cover each form of a file id, and MCP sign-in no longer loops on detailed scopes."
slug: "v1-108-8"
date: 2026-11-13T20:21:21
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

`v1.108.8` is a patch release on the 1.108 LTS line. The `lts` image tag always points to the latest LTS release, so pull `docker.litellm.ai/berriai/litellm:lts` to stay on the newest LTS patch. See the [LTS pilot](/docs/enterprise/lts_pilot).

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
docker.litellm.ai/berriai/litellm:1.108.8
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.108.8
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.108.8`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.108.8) and the full [releases page](https://github.com/BerriAI/litellm/releases).

`v1.108.8` is a patch release on top of [`v1.108.7`](/release_notes/v1.108.7/v1-108-7). There are no new database migrations. The `v1.108.8` tag points at [`e1476b2`](https://github.com/BerriAI/litellm/commit/e1476b249a130ba551d179466a6de6e17a050945).

### What's Changed

- **Azure:** Fixed 400 on `/v1/decisions` for `azure/` deployments - [PR #51460](https://github.com/BerriAI/litellm/pull/51460)
- **Batches and files:** Fixed file ownership checks missing other spellings of a Gemini file id, such as `files/<id>` or its URL - [PR #51503](https://github.com/BerriAI/litellm/pull/51503)
- **MCP:** Fixed sign-in loop ending in `Authentication incomplete` on servers that answer `mcp_all` with detailed scopes, broken since v1.107.0 - [PR #51578](https://github.com/BerriAI/litellm/pull/51578)

The change is backported in [PR #51640](https://github.com/BerriAI/litellm/pull/51640).

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.108.7...v1.108.8
