---
title: "v1.103.3 - Safer Database Migrations, Streamed Alias Spend and Dependency Updates"
slug: "v1-103-3"
date: 2026-10-03T23:33:00
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
docker.litellm.ai/berriai/litellm:1.103.3
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.103.3
```

</TabItem>
</Tabs>

This release is published as [`ghcr.io/berriai/litellm:v1.103.3`](https://github.com/BerriAI/litellm/pkgs/container/litellm). See the [GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.103.3) and the full [releases page](https://github.com/BerriAI/litellm/releases)

:::danger Breaking Changes

**The proxy now exits when database setup fails at startup** instead of logging the failure and serving traffic against an outdated schema. A failed `prisma migrate deploy` exits with code 1 after its retries, in both the proxy and the standalone migration entrypoint. Set `ENFORCE_PRISMA_MIGRATION_CHECK=false` or pass `--no-enforce_prisma_migration_check` to keep the old behavior. See [PR #44205](https://github.com/BerriAI/litellm/pull/44205)

**Streamed requests through an alias are priced from the deployment's model, not the alias.** This fixes streamed spend recorded as $0 for aliases like `claude-opus-4.6`. An alias that points at a deployment with no pricing, such as `gpt-4o` mapped to `openai/my-finetune`, now records $0 on streamed requests, matching what the same request already recorded without streaming. Add pricing to the deployment to keep billing it. See [PR #44341](https://github.com/BerriAI/litellm/pull/44341)

**Chat replies bridged from the Responses API return text and tool calls in one choice.** `choices[0]` now carries both the text and the tool calls with `finish_reason: "tool_calls"`, where earlier releases put the tool calls in a separate `choices[1]`. Clients that read the tool calls from `choices[1]` need to read `choices[0]` instead. See [PR #44346](https://github.com/BerriAI/litellm/pull/44346)

:::

:::warning Upgrading from `v1.102.x` or earlier

The two `LiteLLM_SpendLogs` index migrations from `v1.103.0` are now no-ops, and the post-migration check no longer builds them either, so startup never blocks spend log writes on an index build. Build the indexes online yourself, outside a transaction, from a session that stays connected until each one finishes:

```sql
SET statement_timeout = 0;
CREATE INDEX CONCURRENTLY IF NOT EXISTS "LiteLLM_SpendLogs_api_key_startTime_idx" ON "LiteLLM_SpendLogs"("api_key", "startTime");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "LiteLLM_SpendLogs_litellm_call_id_idx" ON "LiteLLM_SpendLogs"("litellm_call_id");
```

If your spend logs table is partitioned, Postgres cannot build these concurrently on the parent. Build a matching index concurrently on each partition first, then run the same `CREATE INDEX` without `CONCURRENTLY` on the parent, which only attaches them. Upgrading from `v1.102.x` or earlier also means Admin UI and `lite` CLI users sign in once more; see the [`v1.103.1` notes](/release_notes/v1.103.1/v1-103-1)

:::

`v1.103.3` is a patch release on top of [`v1.103.2`](https://github.com/BerriAI/litellm/releases/tag/v1.103.2). It makes startup fail fast on a broken migration, takes the `LiteLLM_SpendLogs` index builds out of the startup path, bills streamed requests through an alias correctly, and updates the base image and several Python dependencies. The `v1.103.3` tag points at [`ecae261`](https://github.com/BerriAI/litellm/commit/ecae261b100cdf6bcb1d024ae69e4efa4a891be0)

## Startup refuses an outdated schema

Before this release, a migration that failed at startup was logged and the proxy kept going, so requests touching a missing column or index failed with 500s. `ENFORCE_PRISMA_MIGRATION_CHECK` now defaults to true, and the standalone migration entrypoint reads the same values as the proxy flag, so `false`, `0`, `no` and `off` opt out in both places

The `LiteLLM_SpendLogs` index migrations held a lock that blocked spend log writes for the whole build, and `CREATE INDEX CONCURRENTLY` fails outright on a partitioned table. Both migrations now run as `SELECT 1`, and the post-migration drift check skips those two indexes so it does not rebuild them with a blocking `CREATE INDEX`. `litellm-proxy-extras` moves to `0.4.100.post1` to ship the updated migrations

## Streamed spend through an alias

Streamed chat completions through a dotted alias like `claude-opus-4.6` recorded $0 spend, because pricing looked up the alias instead of the deployment's model. The proxy now writes the alias only onto the chunks it sends to the client and prices the stream from the provider's model, so streamed and non-streamed requests bill the same way. Logged streamed responses still show the alias

## Image and dependency updates

The Docker images move to a newer `wolfi-base` digest that ships glibc 2.44-r6. `pyjwt` moves to 2.15.0, `pypdf` to 6.19.0, `tornado` to 6.5.9, `urllib3` to 2.8.0 and `gitpython` to 3.1.62, all within the existing version ranges

### What's Changed

- fix(proxy): enforce the migration check by default and stop building SpendLogs indexes in migrations - [PR #44205](https://github.com/BerriAI/litellm/pull/44205)
- chore(release): bump litellm-proxy-extras 0.4.100 -> 0.4.100.post1 for stable/1.103.x - [PR #44225](https://github.com/BerriAI/litellm/pull/44225)
- fix(proxy-extras): stop the migration sanity check from building the hand-built SpendLogs indexes - [PR #44286](https://github.com/BerriAI/litellm/pull/44286)
- fix(proxy): stamp the client alias on a copy of each streamed chunk so pricing sees the deployment model - [PR #44341](https://github.com/BerriAI/litellm/pull/44341)
- fix(responses): merge bridged tool calls into the same choice as the text - [PR #44346](https://github.com/BerriAI/litellm/pull/44346)
- chore(docker): bump wolfi-base digest to pick up glibc 2.44-r6 - [PR #42643](https://github.com/BerriAI/litellm/pull/42643)
- chore(deps): bump pyjwt, pypdf, tornado, urllib3 and gitpython - [PR #44352](https://github.com/BerriAI/litellm/pull/44352)
- test(e2e): move the Together structured-output and text-completion tests to models that still answer - [PR #44437](https://github.com/BerriAI/litellm/pull/44437)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.103.2...v1.103.3
