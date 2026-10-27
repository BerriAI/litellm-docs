---
title: Upgrade Guide
description: Upgrade LiteLLM with Helm or Terraform. Run schema migrations and request-log indexing in a separate job before the gateway rollout.
---

# Upgrade Guide

Helm charts and the official Terraform modules provide a **separate migration job** for schema changes and request-log indexing. Keep `DISABLE_SCHEMA_UPDATE=true` on the gateway pods and let the job finish before rolling out the new gateway version.

```mermaid
flowchart LR
    subgraph Job["Migration job"]
        Schema["Schema migrations"] --> Indexes["Request-log indexes"]
    end
    Indexes -->|Success| Gateway["Roll out gateway pods"]
```

## Before you upgrade

Read the [release notes](/release_notes) for the versions you will cross. Check breaking changes and database changes, take a database snapshot, and test the upgrade against a restored copy of production to measure its duration. Rolling back an image does not undo database changes.

### Check the rows before the schema

From v1.108.0 the migration job reads the rows a pending schema change depends on before it applies anything, and refuses when they would make the change fail. Run the same check yourself before the upgrade, from any machine that can reach the database, with the **target** image:

```bash
docker run --rm \
-e DATABASE_URL=postgresql://<user>:<password>@<host>:5432/<dbname> \
docker.litellm.ai/berriai/litellm:X.Y.Z --check_migrations_against_existing_data
```

It writes nothing and takes no table lock. Exit code 0 means the pending migrations and request-log indexes fit the rows the database has. Exit code 2 prints what blocks them, with the table and columns, the row count, the statement they block and the SQL that clears them:

```
LiteLLM Proxy: Database migration cannot proceed. Existing rows would make a pending schema change fail:
  "LiteLLM_SpendLogs".api_key, startTime: 2 row(s) with an index entry over 2704 bytes, largest 3232 bytes (api_key up to 3207 bytes)
    blocks: CREATE INDEX "LiteLLM_SpendLogs_api_key_startTime_idx" (request-log index)
    fix:    Rows written before v1.99.0 hold the raw key. Hash them in place (one-way, idempotent):
            UPDATE "LiteLLM_SpendLogs" SET api_key = ...
No schema change was made. Fix the rows and start again, or run `litellm --check_migrations_against_existing_data` with the new image to check again.
```

The checks come from the pending migration SQL itself: a btree index whose entry for some row would not fit in a third of a page, a UNIQUE index or constraint over duplicate values, `SET NOT NULL` or a `NOT NULL` column with no default on a table that has rows, a `FOREIGN KEY` with orphan rows, and a `CHECK` constraint some rows fail. Each one is a single read-only count on the table it guards, which on a large `LiteLLM_SpendLogs` can take minutes. A count that does not finish within `LITELLM_MIGRATION_DATA_CHECK_TIMEOUT` (default **600 seconds**) is reported as unverified and refused, so raise that value rather than skip the check. The check does not see failures that are not about rows (lock waits, disk, permissions), and `ALTER COLUMN ... TYPE` and indexes over expressions get no check, so the rehearsal against a restored copy stays the complete test. The spend-log key case in the example is explained in [migration troubleshooting](../troubleshoot/prisma_migrations.md#6-database-migration-cannot-proceed-existing-rows-would-make-a-pending-schema-change-fail).

## Upgrade with Helm or Terraform

| Deployment | Select the release | Run migrations before rollout |
|---|---|---|
| [Helm](./deploy.md#deploy-with-helm) | Pin the chart and image versions. Keep the migration job and application images on the same LiteLLM release. | Keep `migrationJob.enabled: true` and enable the hook for your deployment controller. Wait for the job to complete. |
| [Terraform](./deploy.md#deploy-with-terraform-aws-and-gcp) | Bump the module `version`. Component images default to that release; review any image overrides. | Run `terraform init -upgrade`, review `terraform plan`, then apply. The modules run an ECS migration task on AWS or a Cloud Run migration job on GCP before updating the services. |

<details>
<summary>Helm and Argo CD hook settings</summary>

For `helm upgrade`, use these values. The componentized `litellm` chart defaults to Helm hooks; the older `litellm-helm` chart defaults to Argo CD hooks and needs this change when used with Helm directly.

```yaml title="values.yaml"
migrationJob:
  enabled: true
  hooks:
    helm:
      enabled: true
    argocd:
      enabled: false
```

For Argo CD, enable `argocd` and disable `helm` instead. The PreSync job then runs before the application sync. See the chart values for [`litellm`](https://github.com/BerriAI/litellm/blob/main/helm/litellm/values.yaml) and [`litellm-helm`](https://github.com/BerriAI/litellm/blob/main/helm/litellm-helm/values.yaml).

</details>

Check the **migration job logs** for both schema and indexing completion. After the gateway rollout, verify [`/health/readiness`](./health.md#probe-endpoints) and send a test request through the gateway.

## Database migrations

### What takes time

The migration job runs schema migrations first, then builds any missing request-log indexes. **Both stages count toward the job's runtime.** Existing valid indexes are skipped.

| Work | What affects duration | Effect on the database |
|---|---|---|
| Schema changes, such as new tables or nullable columns | Usually short; lock waits can still delay them | Brief locks can delay other queries |
| Request-log indexes | `LiteLLM_SpendLogs` size, disk speed, memory, and database load | Concurrent index builds allow reads and writes, but consume database resources |
| A migration with a plain index build, table rewrite, or data backfill | Rows scanned or changed; inspect the release's migration SQL | Can block writes or other queries; test and plan a maintenance window if needed |

### Expected duration

Time the **complete migration job** against a production-sized database copy. A schema-only upgrade can be quick while a new index on a large spend-log table takes much longer. Table size alone is not enough to predict an upgrade window.

For Helm, set `migrationJob.activeDeadlineSeconds` (default **1800 seconds**) and the deployment controller's timeout to cover the complete job. With `helm upgrade`, also set `--timeout` accordingly. For Terraform, check the ECS task or Cloud Run job timeout and the deployment wait limit; Helm settings do not apply there.

Use [spend-log retention](./spend_logs_deletion.md) to limit the data future index builds must scan.

<details>
<summary>Check which schema migrations are already applied</summary>

```sql
SELECT migration_name, finished_at
FROM "_prisma_migrations"
WHERE finished_at IS NOT NULL
  AND rolled_back_at IS NULL
ORDER BY finished_at;
```

Compare the full result with the [migration files](https://github.com/BerriAI/litellm/tree/main/litellm-proxy-extras/litellm_proxy_extras/migrations) at your **target release tag**, rather than `main`. Inspect pending SQL for operations on large tables. Request-log indexing is a separate stage, so migration history alone does not confirm that the job is done.

</details>

## Custom deployments

If your deployment does not provide a migration job, run this in a separate container using the **target LiteLLM proxy image**, with `DATABASE_URL` and the required database credentials configured:

```bash
DISABLE_SCHEMA_UPDATE=false litellm --skip_server_startup
```

This LiteLLM command runs schema migrations **and request-log indexing**, waits for both to finish, and exits without starting the gateway. Require a successful exit before rolling out gateway containers with `DISABLE_SCHEMA_UPDATE=true`. From v1.108.0 it runs the [row check](#check-the-rows-before-the-schema) first and exits 2 with the report, before the first migration, when existing rows would make one fail.

## When a migration is slow or stuck

Start with the **migration job's logs and status**. Check database lock waits in `pg_stat_activity` and index-build progress in `pg_stat_progress_create_index` before changing timeouts.

`LITELLM_PRISMA_MIGRATE_DEPLOY_TIMEOUT` controls the schema migration subprocess (default **600 seconds**). Set it on the **migration job** if that stage needs longer; it does not cover request-log indexing. The whole-job and deployment timeouts must allow enough time for both stages and retries.

See [migration troubleshooting](../troubleshoot/prisma_migrations.md) for failed migrations and PostgreSQL version-specific issues.
