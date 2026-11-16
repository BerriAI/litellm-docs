---
title: Database Migrations
description: Prepare LiteLLM database migrations, test pending SQL, size migration timeouts, and recover from legacy schema changes.
toc_max_heading_level: 2
---

# Database Migrations

{/* keep-version-note */}

Use this reference for database preparation and recovery. For the deployment sequence, traffic checks, and request draining, see the [Upgrade Guide](./upgrade_guide.md).

## Run the migration job

Run migrations once per shared database using the **target LiteLLM image**. Keep `DISABLE_SCHEMA_UPDATE=true` on all serving instances, and require the job to succeed before the new version receives traffic. Test that both old and new versions can read and write against the upgraded schema before production. Disabling schema updates prevents a serving instance from changing the schema; it does not make incompatible application versions compatible.

The [Helm chart](./deploy/helm.md) enables a migration Job with `pre-install` and `pre-upgrade` hooks by default. For Argo CD, use its PreSync hook instead:

```yaml title="values.yaml"
migrationJob:
  enabled: true
  hooks:
    helm:
      enabled: false
    argocd:
      enabled: true
```

The official [Terraform modules](./deploy/terraform.md) run an ECS migration task on AWS or a Cloud Run migration job on GCP before updating the services.

For a custom deployment, run this command in a separate container using the target proxy image, with `DATABASE_URL` and the required database credentials configured:

```bash
DISABLE_SCHEMA_UPDATE=false litellm --skip_server_startup
```

This command runs schema migrations **and request-log indexing**, waits for both, and exits without starting the gateway. Require a successful exit. A migration that cannot apply to existing rows fails with PostgreSQL's error and a nonzero exit; use the [dry run](#dry-run-the-migrations-before-the-upgrade) to find that failure earlier.

## Upgrading from a version before v1.104.0

:::danger Old instances can drop the upgraded schema

Before the migration job or the first new instance runs, set `DISABLE_SCHEMA_UPDATE=true` on **every old LiteLLM deployment that shares the database**. Finish rolling out that setting while the database still has the old schema. Include other deployments, restart policies, and automated image rollbacks.

The legacy migration resolver can compare the live database with the old image's `schema.prisma` and execute the difference. It drops tables and columns the old image does not know, including their data, but leaves their completed migrations in `_prisma_migrations`. An old instance restart or image rollback can trigger this.

:::

Before v1.84.0, the post-migration sanity check runs even when no migrations are pending. In v1.84.0 through v1.103.x, it can still run after migrations or during `P3009` / `P3018` recovery. v1.104.0 makes the v2 resolver the default, which does not execute this schema diff. Selecting the legacy resolver with `USE_V2_MIGRATION_RESOLVER=false` or `--use_legacy_migration_resolver` keeps the risk on later versions too.

Keep schema updates disabled throughout the rollout and on any rollback image. If compatibility with the upgraded schema has not been verified, do not roll back only the image. Stop the deployment and restore the pre-upgrade database snapshot with its matching old image. Plan to recover writes made since that snapshot separately, or accept their loss.

### Recovery when migration history is ahead of the schema

If an old instance already reset the schema, stop **all LiteLLM instances and migration jobs** on that database and prevent automatic restarts. Back up the damaged database. The safest recovery is to restore the pre-upgrade snapshot and repeat the upgrade with schema updates disabled on the old deployments.

A missing table such as `LiteLLM_DailyEndUserSpend` can cause `P3018` with PostgreSQL error `42P01`, or runtime failures even when startup reports `No pending migrations to apply`. The migration ledger does not prove the tables exist. Deleting only the failed migration entry does not recreate a missing table whose creation migration is still recorded as complete.

If a snapshot restore is not possible, have your database administrator test a repair on a copy first. Confirm that the live schema matches the **exact old image's** `schema.prisma`, then compare the ledger with the migration directories shipped in that image. Remove only ledger rows for migrations absent from that image, and let the target image re-apply them. Do not clear the whole ledger or mark missing-table migrations as applied. Do not use this procedure if the schema is only partly reset or has other changes.

<details>
<summary>Version-specific repair for v1.80.0-stable.1 to v1.105.0</summary>

Use this SQL **only** when v1.80.0-stable.1's legacy resolver reset the database to that image's schema during an upgrade to v1.105.0, with every LiteLLM process stopped and a backup taken. It removes newer migration records so v1.105.0 can replay them. The three explicit names are backdated migrations that a timestamp cutoff misses. Other source or target versions need their own migration comparison.

```sql
DELETE FROM "_prisma_migrations"
WHERE migration_name > '20251115120539_baseline_diff'
   OR migration_name IN (
     '20251113000000_add_project_table',
     '20251113000001_add_project_fields',
     '20251114180624_Add_org_usage_table'
   );
```

Run the v1.105.0 migration job with schema updates enabled, leaving every old deployment stopped. Require a successful exit, compare the repaired schema with the target image's `schema.prisma` using `prisma migrate diff`, and verify affected reads and writes before resuming traffic with gateway schema updates disabled.

</details>

Replaying migrations recreates schema, **not data dropped by the old instance**. Recover that data from backups. Never run the old image with schema updates enabled against the repaired database.

## Dry-run the migrations before the upgrade

From v1.109.0, use the target image's dry run to test pending migrations before the upgrade:

```bash
docker run \
  -e DATABASE_URL \
  "$TARGET_IMAGE" --check_migrations_against_existing_data
```

Set `TARGET_IMAGE` to the pinned target proxy image and `DATABASE_URL` to a **restored production database copy**. The container must be able to reach that database.

The dry run executes the real SQL of each pending migration, in order, in a transaction that rolls back before the next migration starts. The schema and `_prisma_migrations` stay unchanged. A migration that depends on an earlier one, such as an index on a newly added column, replays that dependency with it. Exit code `0` lists successful migrations and their execution times. Exit code `2` reports PostgreSQL's error for the first failure, lists the earlier timings, and stops.

:::warning A dry run takes database locks

Statements really execute, so they take table locks. A plain `CREATE INDEX` on a large `LiteLLM_SpendLogs` table can block writes for minutes. A migration's `CREATE INDEX CONCURRENTLY` runs as a plain index build in the dry run because PostgreSQL does not allow the concurrent form inside a transaction. Prefer a restored database copy; if you run against production, plan for its lock and load impact.

:::

Use the timings to estimate lock duration, then time the complete migration job on a production-sized copy. Actual production duration depends on database load and lock waits. Request-log indexes built separately after schema migrations are **not included** in this dry run.

If the database has tables but no `_prisma_migrations` history, the dry run performs the same checks as startup before baselining: the migrations folder must be the one shipped with the build, and the live schema must match the build's `schema.prisma`. It rejects a custom `LITELLM_MIGRATION_DIR`. When both checks pass, it reports `nothing to dry-run`; otherwise, it reports the schema difference or custom-folder refusal.

On **v1.108.0 only**, this flag runs read-only row counts, and the proxy refuses to boot on the incompatible data it finds. From v1.109.0, startup applies pending migrations and reports PostgreSQL's first failure. See [migration data errors](../troubleshoot/prisma_migrations.md#6-database-migration-cannot-proceed-on-rows-the-schema-change-cannot-take) for version-specific failures and recovery.

## Migration duration and timeouts

The migration job applies schema changes, then builds missing request-log indexes. **Both stages count toward its runtime.** Existing valid indexes are skipped.

| Work | What determines duration | Database impact |
| --- | --- | --- |
| New tables or nullable columns | Usually short; lock waits can delay them | Brief locks can delay other queries |
| Request-log indexes | Spend-log size, disk speed, memory, and load | Concurrent builds allow reads and writes but consume resources |
| Plain index builds, table rewrites, or backfills in migration SQL | Rows scanned or changed | Can block writes or other queries; test and plan a maintenance window if needed |

Time the **complete job** against a production-sized copy. Table size alone does not predict an upgrade window. Use [spend-log retention](./spend_logs_deletion.md) to limit the data future index builds scan.

| Timeout | Scope |
| --- | --- |
| `LITELLM_PRISMA_MIGRATE_DEPLOY_TIMEOUT` on the migration job; default `600` seconds | Schema migration subprocess only; excludes request-log indexing |
| Helm `migrationJob.activeDeadlineSeconds`; default `1800` seconds | Complete migration Job, including indexing and retries |
| `helm upgrade --timeout` or the deployment controller's timeout | Deployment wait, which must allow the migration Job and rollout to finish |
| Terraform ECS task or Cloud Run job timeout and deployment wait limit | The corresponding module's migration and deployment stages; Helm settings do not apply |

### Check applied migrations

```sql
SELECT migration_name, finished_at
FROM "_prisma_migrations"
WHERE finished_at IS NOT NULL
  AND rolled_back_at IS NULL
ORDER BY finished_at;
```

Compare the full result with the [migration files](https://github.com/BerriAI/litellm/tree/main/litellm/proxy-extras/litellm_proxy_extras/migrations) at your **target release tag**. Inspect pending SQL for operations on large tables. Migration history alone does not confirm that the job finished, because request-log indexing is a separate stage.

## Rolling upgrades and spend log cleanup

[Spend log cleanup](./spend_logs_deletion.md#when-the-job-runs) uses `LiteLLM_ScheduledJobRun`, created by migration `20261105000000_scheduled_job_runs`. Older versions schedule cleanup with an in-process timer and a Redis lock, or no lock when Redis is absent. The two schedulers do not coordinate, so both can run until the last old instance is gone.

Both use the same retention cutoff and delete in small batches under their own statement timeouts. The overlap adds duplicate work and delete load. For a large table or slow rollout, unset retention settings before the upgrade and restore them afterward, or allow capacity for the extra load.

The new table does not prevent an old instance from starting with the v2 resolver or `DISABLE_SCHEMA_UPDATE=true`. The legacy resolver with schema updates enabled can drop it. Apply the [legacy-version safeguards](#upgrading-from-a-version-before-v11040) before the target migration job runs, including for later images that explicitly select the legacy resolver.

## When a migration is slow or stuck

Start with the migration job's logs and status. Check lock waits in `pg_stat_activity` and index-build progress in `pg_stat_progress_create_index` before changing timeouts. Set a longer schema timeout only when that stage needs it; give the whole job and deployment enough time for both stages and retries.

See [migration troubleshooting](../troubleshoot/prisma_migrations.md) for failed migrations and PostgreSQL version-specific issues.
