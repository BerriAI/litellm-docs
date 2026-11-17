---
title: "LiteLLM v1.104.9 and v1.103.11 speed up request lookups in the Logs view"
description: "Builds the spend log indexes that some installs lack after migrations, so request lookups in the Logs view stay fast on large spend log tables."
slug: "v1-104-9"
date: 2026-11-10T20:29:03
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
docker.litellm.ai/berriai/litellm:1.104.9
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.104.9
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.104.9`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.104.9) and the full [releases page](https://github.com/BerriAI/litellm/releases).

`v1.104.9` is a patch release on top of [`v1.104.8`](/release_notes/v1.104.8/v1-104-8). There are no new database migrations. The two `LiteLLM_SpendLogs` index migrations stay no-ops, and the indexes are now built after migrations run. The migration job builds them, and a proxy that runs its own migrations builds them in the background once it serves. The `v1.104.9` tag points at [`8aa2ffb`](https://github.com/BerriAI/litellm/commit/8aa2ffb6377e35b7e5e5c3a091f8bc944e006a4a).

### What's Changed

- **Logging and observability:** Improved request lookups in the Logs view on large spend log tables by building any missing indexes after migrations - [PR #43948](https://github.com/BerriAI/litellm/pull/43948), [PR #44109](https://github.com/BerriAI/litellm/pull/44109), [PR #44203](https://github.com/BerriAI/litellm/pull/44203)

The changes are backported in [PR #50823](https://github.com/BerriAI/litellm/pull/50823), and the version bump is in [PR #50985](https://github.com/BerriAI/litellm/pull/50985).

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.104.8...v1.104.9
