---
title: "LiteLLM v1.110.4 and v1.109.5 speed up restricted end-user refreshes"
description: "Restricted end-user refreshes stop scanning the whole end-user table, and the standalone UI image moves to nginx 1.31.10 and zlib 1.4."
slug: "v1-110-4"
date: 2026-11-25T00:30:03
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
docker.litellm.ai/berriai/litellm:1.110.4
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.110.4
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.110.4`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.110.4) and the full [releases page](https://github.com/BerriAI/litellm/releases).

`v1.110.4` is a patch release on top of [`v1.110.3`](/release_notes/v1.110.3/v1-110-3). There are no new database migrations. A partial `LiteLLM_EndUserTable_restricted_idx` index is built after migrations run, without blocking writes. The migration job builds it, and a proxy that runs its own migrations builds it in the background once it serves. The `v1.110.4` tag points at [`92f4055`](https://github.com/BerriAI/litellm/commit/92f40556109b96aba18581d0737c48c4f94c9c3a).

### What's Changed

- **Deployment:** Fixed the standalone UI image shipping outdated nginx and zlib, now nginx 1.31.10 and zlib 1.4 - [PR #54150](https://github.com/BerriAI/litellm/pull/54150)
- **Performance:** Improved end-user restriction refreshes to read only restricted customers instead of the whole end-user table - [PR #51772](https://github.com/BerriAI/litellm/pull/51772)

The changes are backported in [PR #54069](https://github.com/BerriAI/litellm/pull/54069).

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.110.3...v1.110.4
