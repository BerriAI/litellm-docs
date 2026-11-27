---
title: "LiteLLM v1.110.3 and v1.109.4 make gateway MCP DCR registration opt-in"
description: "New clientless MCP DCR bridges relay the client's own registration unless you opt in, and v1.110.3 also fixes `GET /audit` returning 500 after a key or team update."
slug: "v1-110-3"
date: 2026-11-24T04:09:58
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
docker.litellm.ai/berriai/litellm:1.110.3
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.110.3
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.110.3`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.110.3) and the full [releases page](https://github.com/BerriAI/litellm/releases).

:::danger Breaking Changes

**Set `LITELLM_MCP_DCR_GATEWAY_CLIENT=true` to keep automatic gateway-owned registration for new clientless DCR bridges.** See [PR #53059](https://github.com/BerriAI/litellm/pull/53059).

:::

`v1.110.3` is a patch release on top of [`v1.110.2`](/release_notes/v1.110.2/v1-110-2). There are no new database migrations. The `v1.110.3` tag points at [`e76668a`](https://github.com/BerriAI/litellm/commit/e76668a4719faaa3f8ad68c2c5c42c45211f8135).

### What's Changed

- **Batches and files:** Fixed `/gemini` pass-through file get, download and delete skipping the file ownership check `/v1/files` applies - [PR #53171](https://github.com/BerriAI/litellm/pull/53171) and [PR #53210](https://github.com/BerriAI/litellm/pull/53210)
- **MCP:** Changed gateway-owned DCR client registration to opt-in, fixing `403 oauth_principal_mismatch` for shared service keys - [PR #53059](https://github.com/BerriAI/litellm/pull/53059)
- **Routing and fallbacks:** Fixed a complexity-routed request to a model in cooldown failing instead of using that model's fallbacks - [PR #52510](https://github.com/BerriAI/litellm/pull/52510)
- **Logging and observability:** Fixed `GET /audit` returning 500 after a key or team update, which left the Admin UI Audit Logs page empty, broken since v1.108.0 - [PR #50929](https://github.com/BerriAI/litellm/pull/50929) and [PR #53305](https://github.com/BerriAI/litellm/pull/53305)

The changes are backported in [PR #53109](https://github.com/BerriAI/litellm/pull/53109), [PR #53178](https://github.com/BerriAI/litellm/pull/53178), [PR #53207](https://github.com/BerriAI/litellm/pull/53207) and [PR #53298](https://github.com/BerriAI/litellm/pull/53298).

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.110.2...v1.110.3
