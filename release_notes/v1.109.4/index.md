---
title: "LiteLLM v1.110.3 and v1.109.4 make gateway MCP DCR registration opt-in"
description: "New clientless MCP DCR bridges relay the client's own registration unless you opt in, and v1.110.3 also fixes `GET /audit` returning 500 after a key or team update."
slug: "v1-109-4"
date: 2026-11-24T04:14:17
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
docker.litellm.ai/berriai/litellm:1.109.4
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.109.4
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.109.4`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.109.4) and the full [releases page](https://github.com/BerriAI/litellm/releases).

:::danger Breaking Changes

**Set `LITELLM_MCP_DCR_GATEWAY_CLIENT=true` to keep automatic gateway-owned registration for new clientless DCR bridges.** See [PR #53059](https://github.com/BerriAI/litellm/pull/53059).

:::

`v1.109.4` is a patch release on top of [`v1.109.3`](/release_notes/v1.109.3/v1-109-3). There are no new database migrations. The `v1.109.4` tag points at [`83b8353`](https://github.com/BerriAI/litellm/commit/83b8353b90203debc2cfd84c3f2f2a5a7263422c).

### What's Changed

- **MCP:** Changed gateway-owned DCR client registration to opt-in, fixing `403 oauth_principal_mismatch` for shared service keys - [PR #53059](https://github.com/BerriAI/litellm/pull/53059)

The changes are backported in [PR #53179](https://github.com/BerriAI/litellm/pull/53179).

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.109.3...v1.109.4
