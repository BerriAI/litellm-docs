---
title: Upgrade Guide
description: How to plan and run a LiteLLM Proxy upgrade, including how database migrations run and how long they take at production scale.
---

# Upgrade Guide

Upgrading LiteLLM Proxy means rolling out a new image and letting it bring the database schema up to date. The image swap is quick; the database work is what needs planning, because its cost depends on how large your tables are and on what the new release changes. This page covers how to prepare, how migrations run, and how long to expect them to take.

## Before you upgrade

Read the [release notes](/release_notes) for every version between the one you run and the one you are moving to, and look for anything marked as a breaking change or a database change. Pin the exact image tag you are moving to rather than a floating tag such as `main-latest`, so every pod in the rollout runs the same code.

How you pick the new version depends on how you deploy. With Docker or Helm, set the image tag to the release you want. With the [Terraform modules](./deploy.md#deploy-with-terraform-aws-and-gcp), bump the module `version` instead; each module version defaults all four component images to the same LiteLLM release, so leave the image inputs alone unless you deliberately pin something else.

Take a backup or snapshot of the database first. Migrations only move forward, so restoring that backup is how you go back if an upgrade has to be reversed. If your spend log table is large, run the upgrade once against a restored copy of production before doing it for real; it is the only way to get a firm duration for your hardware and data, and it shows you exactly which migrations will apply.

## How migrations run

By default every proxy pod runs `prisma migrate deploy` when it starts, and only one of them does the work at a time: the others wait on a database lock and then find nothing left to apply. Once migrations finish, the pod starts serving and builds the request log indexes in the background. Larger deployments usually move this out of the pods into the [Helm PreSync migrations job](./prod.md#run-migrations-from-the-helm-presync-hook) and set `DISABLE_SCHEMA_UPDATE=true` on the pods, so a rollout waits for one job instead of racing pods against each other. See [Use prisma migrate deploy](./prod.md#use-prisma-migrate-deploy) for how migrations ship with each release.

## Database migrations

### What takes time

Each migration falls into one of two groups, and only the second depends on how much data you have.

Most migrations only change schema: they add a table, add a nullable column, add a column with a constant default, or add an index to a small table. On PostgreSQL 11 or later, adding a column, even one with a default, updates the catalog without touching existing rows, so these finish in milliseconds whether `LiteLLM_SpendLogs` is empty or holds a year of traffic. The fixed cost of an upgrade made up of these migrations is starting the Prisma CLI and checking migration state, roughly 15 seconds, regardless of how many migrations are pending.

The second group reads or rewrites every row of a table, so its time grows with the table. Building an index on `LiteLLM_SpendLogs`, changing a column's type, adding a constraint that must be validated, and backfilling data with `UPDATE` are in this group. LiteLLM builds the request log indexes on `LiteLLM_SpendLogs` with `CREATE INDEX CONCURRENTLY` after the migrations finish, which keeps spend log writes flowing during the build. A migration that builds a plain `CREATE INDEX` on a large table, or rewrites one, holds a lock that stops spend log writes for the whole time it runs.

`LiteLLM_SpendLogs` is the table that grows. At 100 requests per second it gains roughly 3 billion rows a year, and at 10,000 requests per second hundreds of billions, which is tens of GB to tens of TB on disk depending on whether you store request and response bodies. The daily spend tables, keys, teams, and users stay small enough that operations on them take seconds at any traffic level.

### Expected duration

The table below gives expected times by the size of `LiteLLM_SpendLogs` (`pg_total_relation_size`, table plus indexes) for each kind of work. The 10 GB row is measured; the larger rows are extrapolated from it and from a 35 GB table, where the request log index build took 2 minutes 12 seconds. The plain index and rewrite estimates also apply the slowdown described below.

The columns are the kinds of work described above. "Request log indexes" is the concurrent build LiteLLM runs after migrations, during which spend log writes continue. "Plain index" is one `CREATE INDEX` on `LiteLLM_SpendLogs` inside a migration, which blocks spend log writes while it runs. "Table rewrite" is a migration that rewrites the table, such as a column type change, which blocks reads and writes.

| Table size | Schema only | Request log indexes | Plain index | Table rewrite |
|---|---|---|---|---|
| 10 GB (measured) | about 15 s | about 20 s | 4 to 8 s | about 1 min |
| 100 GB (estimate) | about 15 s | about 6 min | 1 to 2 min | about 15 min |
| 1 TB (estimate) | about 15 s | about 1 h | 10 to 20 min | about 2.5 h |
| 10 TB (estimate) | about 15 s | about 10 h | 1.5 to 3.5 h | about 1 day |

The measurements come from PostgreSQL 14 on an 8 vCPU, 32 GB machine with the database on local disk, default `maintenance_work_mem`, and no other traffic, using synthetic spend log rows without stored request or response bodies. Per GB, the index build ran about 1.7 times slower on the 35 GB table than on the 10 GB one, once the table no longer fit in memory, so read the estimates as a floor rather than a ceiling. Network attached storage, a busy primary, or a smaller instance will be slower. Rows that store request and response bodies are larger, so the same number of requests makes a bigger table. When you need a firm figure, time the upgrade against a restored copy of your production database.

The request log index build does not delay a proxy that runs its own migrations: it runs in the background once the proxy is serving, and a build that is interrupted resumes on the next start. The [Helm migrations job](./prod.md#run-migrations-from-the-helm-presync-hook) is different. It builds the indexes before it exits, and the chart stops it after `migrationJob.activeDeadlineSeconds` (default 1800 seconds), so on a table of several hundred GB or more raise that value, and the `--timeout` of `helm upgrade`, to cover the request log indexes column above.

Schema only migrations are the common case, and most upgrades contain nothing else. The two right hand columns are what to look for before upgrading a large deployment, because they hold a lock on `LiteLLM_SpendLogs` for the whole time they run.

### Check what an upgrade will apply

To see which migrations your database already has, query the Prisma migration history:

```sql
SELECT migration_name, finished_at
FROM "_prisma_migrations"
ORDER BY finished_at DESC
LIMIT 10;
```

Every migration in the [`litellm-proxy-extras` migrations folder](https://github.com/BerriAI/litellm/tree/main/litellm-proxy-extras/litellm_proxy_extras/migrations) for the target version that is not in that list will run. Open the `migration.sql` of each one and look for statements that touch `LiteLLM_SpendLogs`: a `CREATE INDEX` without `CONCURRENTLY`, `ALTER COLUMN ... TYPE`, `ADD CONSTRAINT`, or `UPDATE` means the upgrade will take time proportional to that table and will block writes to it while it runs, so schedule it in a maintenance window. If the only statements are `CREATE TABLE`, `ADD COLUMN`, and indexes on other tables, expect the fixed cost above.

### Keep migrations fast

The most effective way to keep upgrades short is to keep `LiteLLM_SpendLogs` from growing without bound. Set a [retention period](./spend_logs_deletion.md) so old rows are deleted, and at high volume [partition the table](./spend_logs_deletion.md#partitioning-for-high-volume-deployments) so retention drops whole partitions and each index build only has to cover the partitions that remain.

### When a migration is slow or stuck

Every schema change has to take a lock on its table, so a long running query or an idle transaction holding a lock on a LiteLLM table delays the migration until it ends. If a migration seems stuck, look in `pg_stat_activity` for sessions that have been open a long time against LiteLLM tables.

On PostgreSQL 10, adding a column with a default rewrites the whole table under an `ACCESS EXCLUSIVE` lock, which turns a migration that is instant elsewhere into one that scales with table size. See [Upgrade stalls on PostgreSQL 10](../troubleshoot/prisma_migrations.md#5-upgrade-to-v1990-or-later-stalls-on-20260818000000_add_spend_log_timestamps-postgresql-10) for the measured cost and how to handle it.

The proxy stops `prisma migrate deploy` after `LITELLM_PRISMA_MIGRATE_DEPLOY_TIMEOUT` seconds (default 600) and retries it. If you expect an upgrade to run longer than that, for example one that builds a plain index on a large spend log table, raise the timeout for that rollout so the proxy does not cut the migration off partway. The request log index build is not covered by this timeout.
