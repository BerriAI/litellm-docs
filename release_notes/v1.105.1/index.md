---
title: "LiteLLM v1.105.1 fixes SpendLogs rows and daily model usage writes"
description: "Fixes dropped SpendLogs rows with batched daily model usage writes, and logs spend once for large requests on the chat to Responses bridge."
slug: "v1-105-1"
date: 2026-10-14T04:33:53
authors:
  - name: Krrish Dholakia
    title: CEO, LiteLLM
    url: https://www.linkedin.com/in/krish-d/
    image_url: https://pbs.twimg.com/profile_images/1298587542745358340/DZv3Oj-h_400x400.jpg
  - name: Ishaan Jaff
    title: CTO, LiteLLM
    url: https://www.linkedin.com/in/reffajnaahsi/
    image_url: https://pbs.twimg.com/profile_images/1613813310264340481/lz54oEiB_400x400.jpg
  - name: Kerry Lu
    title: Rust Engineer, LiteLLM
    url: https://github.com/kerrylu-berri
    image_url: https://github.com/kerrylu-berri.png
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
docker.litellm.ai/berriai/litellm:1.105.1
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.105.1
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.105.1`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.105.1) and the full [releases page](https://github.com/BerriAI/litellm/releases)

`v1.105.1` is a patch release on top of [`v1.105.0`](/release_notes/v1.105.0/v1-105-0). It backports two spend tracking fixes from `main` onto `stable/1.105.x`. There are no new database migrations and no breaking changes. The `v1.105.1` tag points at [`d665dc1`](https://github.com/BerriAI/litellm/commit/d665dc1a6315847fcad6cc2c1264ceb47c06abce)

## Key Highlights

- **Batched model usage writes**: the model leaderboard rollup no longer upserts `LiteLLM_DailyModelUsage` on every request, which removes the row lock contention that dropped SpendLogs rows when heavy traffic went to one model
- **Single spend log on the Responses bridge**: non-streaming requests of 256 KiB or more sent through the chat to Responses bridge log their spend once instead of twice

## Spend Tracking, Budgets and Rate Limiting

- The daily model usage rollup added with the model leaderboard in `v1.105.0` wrote one `LiteLLM_DailyModelUsage` upsert per request. At high request rates for a single model those upserts fought over the same row and held Prisma connections, so some SpendLogs rows were never written. Rollup rows are now queued in memory and written in batches by the existing spend log flush job. See [PR #44243](https://github.com/BerriAI/litellm/pull/44243)
- Non-streaming requests on the chat to Responses bridge whose messages were 256 KiB or larger ran the async success logging twice, which wrote two SpendLogs rows and counted key, team and daily spend twice. The two handlers now run one after the other on the same logging object, and the second one skips if the first already logged. See [PR #44508](https://github.com/BerriAI/litellm/pull/44508)

Both fixes and the version bump are backported together in [PR #46313](https://github.com/BerriAI/litellm/pull/46313)

### PR roll-up by ownership area

- Spend / Budgets / Rate Limits: 2

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.105.0...v1.105.1
