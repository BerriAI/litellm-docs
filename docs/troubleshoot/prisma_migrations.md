# Troubleshooting Prisma Migration Errors

Common Prisma migration issues encountered when upgrading or downgrading LiteLLM proxy versions, plus the query engine resolution failure that can stop the proxy before any migration runs, and how to fix them.

For a full guide on safely reverting your LiteLLM version, see the **[Safe Rollback Guide](rollback)**.

## How Prisma Migrations Work in LiteLLM

- LiteLLM uses [Prisma](https://www.prisma.io/) to manage its PostgreSQL database schema.
- Migration history is tracked in the `_prisma_migrations` table in your database.
- When LiteLLM starts, it runs `prisma migrate deploy` to apply any new migrations.
- If database setup fails at startup (the database is unreachable, connection retries are exhausted, or `prisma migrate deploy` fails), the proxy exits nonzero instead of serving requests against an older schema. Under a rolling update the new pods crash-loop while the old pods keep serving, and the migration error is in the new pod's logs.
- The same applies when `DATABASE_URL` is set but the Prisma CLI is neither on `PATH` nor importable: the proxy exits with a red error instead of starting without a database. Install it with `pip install 'litellm[extra_proxy]'` or run a shipped LiteLLM image, which bundles it.
- Upgrading LiteLLM applies all migrations added since your last applied version.

## Common Errors

### 1. `relation "X" does not exist`

**Example error:**

```
ERROR: relation "LiteLLM_DeletedTeamTable" does not exist
Migration: 20260116142756_update_deleted_keys_teams_table_routing_settings
```

**Cause:** This typically happens after a version rollback. The `_prisma_migrations` table still records migrations from the newer version as "applied," but the underlying database tables were modified, dropped, or never fully created.

**How to fix:**

#### Step 1: Delete the failed migration entry and restart

Remove the problematic migration from the history so it can be re-applied:

```sql
-- View recent migrations
SELECT migration_name, finished_at, rolled_back_at, logs
FROM "_prisma_migrations"
ORDER BY started_at DESC
LIMIT 10;

-- Delete the failed migration entry
DELETE FROM "_prisma_migrations"
WHERE migration_name = '<failed_migration_name>';
```

After deleting the entry, restart LiteLLM and it will re-apply the migration on startup.

#### Step 2: If that doesn't work, use `prisma db push`

If deleting the migration entry and restarting doesn't resolve the issue, sync the schema directly:

> **Warning:** `prisma db push` can cause **data loss** if the Prisma schema removes columns or tables that exist in your database. Only use this as a last resort and ensure you have a database backup first.

```bash
DATABASE_URL="<your_database_url>" prisma db push
```

This bypasses migration history and forces the database schema to match the Prisma schema.

---

### 2. `New migrations cannot be applied before the error is recovered from`

**Cause:** A previous migration failed (recorded with an error in `_prisma_migrations`), and Prisma refuses to apply any new migrations until the failure is resolved.

**How to fix:**

1. Find the failed migration:

```sql
SELECT migration_name, finished_at, rolled_back_at, logs
FROM "_prisma_migrations"
WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL
ORDER BY started_at DESC;
```

2. Delete the failed entry and restart LiteLLM:

```sql
DELETE FROM "_prisma_migrations"
WHERE migration_name = '<failed_migration_name>';
```

3. If that doesn't work, use `prisma db push` (see [warning above](#step-2-if-that-doesnt-work-use-prisma-db-push), and back up your database first):

```bash
DATABASE_URL="<your_database_url>" prisma db push
```

---

### 3. Migration state mismatch after version rollback

**Cause:** You upgraded to version X (new migrations applied), rolled back to version Y, then upgraded again. The `_prisma_migrations` table has stale entries for migrations that were partially applied or correspond to a schema state that no longer exists.

**Fix:**

1. Inspect the migration table for problematic entries:

```sql
SELECT migration_name, started_at, finished_at, rolled_back_at, logs
FROM "_prisma_migrations"
ORDER BY started_at DESC
LIMIT 20;
```

2. For each migration that shouldn't be there (i.e., from the version you rolled back from), delete the entry:
     ```sql
     DELETE FROM "_prisma_migrations" WHERE migration_name = '<migration_name>';
     ```

3. Restart LiteLLM to re-run migrations.

4. If that doesn't work, use `prisma db push` (see [warning above](#step-2-if-that-doesnt-work-use-prisma-db-push), and back up your database first):

```bash
DATABASE_URL="<your_database_url>" prisma db push
```

---

### 4. `PermissionError` while resolving the query engine

**Example error:**

```
PermissionError: [Errno 13] Permission denied:
'/usr/local/lib/python{{python_version}}/site-packages/prisma/binaries/prisma-query-engine-debian-openssl-3.0.x'
```

**Cause:** before Prisma can talk to your database it has to decide which query engine binary to run, and it does that by walking the engine paths the Prisma CLI recorded when the client was generated. A generated client carries five of them, one per supported platform, so the walk always runs. It tests each candidate with `Path.exists()`, which reports a missing file as `False` but re-raises `PermissionError` when a directory on the way to the candidate denies the running uid; it only swallows `ENOENT`, `ENOTDIR`, `EBADF` and `ELOOP`. An image that generates the client as one uid and runs as another, or that installs the client somewhere the runtime uid cannot traverse, therefore dies at startup rather than moving on to the next candidate. Python 3.14 returns `False` here and is unaffected; every older interpreter LiteLLM supports raises. {/* keep-python-version */}

**How to fix:** point Prisma at an engine the runtime uid can read, setting both variables together. `PRISMA_QUERY_ENGINE_BINARY` on its own does not clear this, because the walk that raises runs before Prisma reads that variable. `PRISMA_BINARY_PLATFORM` is the one that short-circuits the walk, before any candidate is tested, so neither variable substitutes for the other:

```bash
export PRISMA_BINARY_PLATFORM=debian-openssl-3.0.x
export PRISMA_QUERY_ENGINE_BINARY=/opt/prisma/binaries/prisma-query-engine-debian-openssl-3.0.x
```

`PRISMA_BINARY_PLATFORM` has to name a platform the client was actually generated for. Prisma looks the name up directly in the generated paths, so naming one you did not generate trades the `PermissionError` for a `KeyError`. `PRISMA_QUERY_ENGINE_BINARY` has to point at an engine file the runtime uid can both read and execute. Set both in the environment rather than patching `BINARY_PATHS` at import time: `PRISMA_BINARY_PLATFORM` is a declared Prisma config option and `PRISMA_QUERY_ENGINE_BINARY` is read from the environment directly, so neither depends on Prisma internals that a version bump can move.

The official images already avoid the condition by baking the Prisma CLI and engines at a fixed, world-readable `/opt/prisma`, so any uid can resolve them. `v1.95.0` is the first stable release carrying that for both image variants. The standard image has had it since `v1.94.0`, but the whole `1.94.x` line lacks it for `litellm-non_root`, so a non-root deployment on `v1.94.1` or earlier still needs the two variables above. Custom images and plain `pip install` deployments are outside both fixes and always need them.

Images are published to `ghcr.io/berriai` and mirrored at `docker.litellm.ai/berriai`; `ghcr.io/berriai/litellm-non_root:v1.95.0` is the non-root variant.

---

### 5. Upgrade to v1.99.0 or later stalls on `20260818000000_add_spend_log_timestamps` (PostgreSQL 10)

**Symptom:** the proxy sits in `prisma migrate deploy` at startup and serves no traffic. Depending on the version it is either killed by the Prisma command timeout and restarts into the same migration, or it eventually comes up after a long pause during which `pg_stat_activity` shows `ALTER TABLE "LiteLLM_SpendLogs"` holding an `ACCESS EXCLUSIVE` lock. Deployments on PostgreSQL 11 or later apply the same migration in milliseconds.

**Cause:** the migration adds `created_at` and `updated_at` to `LiteLLM_SpendLogs` as `TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`. PostgreSQL 11 stores that default as column metadata and touches no rows, so the statement takes the same few milliseconds on an empty table and on one holding years of logs. PostgreSQL 10 has no such fast path: it rewrites the whole heap into a new file, rebuilds every index on the table, and holds an `ACCESS EXCLUSIVE` lock for the duration. On a 1,000,000 row, 1 GB `LiteLLM_SpendLogs` the statement took about 10 seconds on PostgreSQL 10 and under 2 ms on PostgreSQL 16; the time scales with table size, and the rewrite needs free disk for a second copy of the table and its indexes until the transaction commits. Because LiteLLM runs migrations at boot, a killed Prisma client rolls the rewrite back and the next restart starts it over from zero.

**How to fix:** apply the column addition yourself in a maintenance window, before you upgrade. The migration uses `ADD COLUMN IF NOT EXISTS`, so once the columns exist it becomes a no-op at startup and the upgrade proceeds normally. Check how much disk the rewrite needs first:

```sql
SELECT pg_size_pretty(pg_total_relation_size('"LiteLLM_SpendLogs"'));
```

The direct route is to run the migration's own statement with the proxy stopped. It performs the same rewrite, but with no client timeout and at a time you chose:

```sql
ALTER TABLE "LiteLLM_SpendLogs"
ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
```

If the table is too large to lock for that long, avoid the rewrite entirely. Adding the columns without a default and setting the default afterwards are both metadata-only changes on every PostgreSQL version, and the proxy can keep running on the old version while you do this:

```sql
ALTER TABLE "LiteLLM_SpendLogs"
ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3);

ALTER TABLE "LiteLLM_SpendLogs"
ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
```

New rows now get the default. Backfill the existing rows in batches, repeating the statement until it reports `UPDATE 0`, so no single transaction holds a long lock or bloats the table:

```sql
UPDATE "LiteLLM_SpendLogs"
SET "created_at" = CURRENT_TIMESTAMP, "updated_at" = CURRENT_TIMESTAMP
WHERE "request_id" IN (
    SELECT "request_id" FROM "LiteLLM_SpendLogs" WHERE "created_at" IS NULL LIMIT 10000
);
```

`CURRENT_TIMESTAMP` matches what the migration itself would have written. Use `COALESCE("endTime", "startTime", CURRENT_TIMESTAMP)` instead if you want the backfilled values to reflect when each request actually ran. Once the backfill finishes, add the constraint; this scans the table once but does not rewrite it:

```sql
ALTER TABLE "LiteLLM_SpendLogs"
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;
```

Then upgrade. Do not insert a row into `_prisma_migrations` by hand and do not run `prisma migrate resolve --applied`; let `prisma migrate deploy` record the migration itself when it finds the columns already in place.

If you would rather let the proxy perform the rewrite at boot, raise the timeout so the Prisma client is not killed mid-statement. From v1.101.0 `prisma migrate deploy` has its own limit, `LITELLM_PRISMA_MIGRATE_DEPLOY_TIMEOUT` (default 600 seconds). On v1.99.x and v1.100.x it runs under `LITELLM_PRISMA_COMMAND_TIMEOUT` (default 60 seconds), which also covers every other Prisma command. A longer timeout only stops the retry loop: the proxy is still unavailable and the table still locked until the rewrite completes, so plan the restart as a maintenance window either way.

---

### 6. `Database migration cannot proceed. Existing rows would make a pending schema change fail`

**Symptom on v1.108.0 and later:** the proxy, or the migration job, exits 2 before the first migration runs, and the log names the rows:

```
LiteLLM Proxy: Database migration cannot proceed. Existing rows would make a pending schema change fail:
  "LiteLLM_SpendLogs".api_key, startTime: 2 row(s) with an index entry over 2704 bytes, largest 3232 bytes (api_key up to 3207 bytes)
    blocks: CREATE INDEX "LiteLLM_SpendLogs_api_key_startTime_idx" (request-log index)
    fix:    Rows written before v1.99.0 hold the raw key. Hash them in place (one-way, idempotent):
            UPDATE "LiteLLM_SpendLogs" SET api_key = encode(sha256(convert_to(regexp_replace(api_key, '^[Bb][Ee][Aa][Rr][Ee][Rr] ', ''), 'UTF8')), 'hex')
            WHERE api_key <> '' AND api_key !~ '^[0-9a-fA-F]{64}$' AND api_key !~ '^hashed-jwt-[0-9A-Fa-f]{64}$';
No schema change was made. Fix the rows and start again, or run `litellm --check_migrations_against_existing_data` with the new image to check again.
```

`_prisma_migrations` is untouched. `litellm --check_migrations_against_existing_data` prints the same report without starting anything, see the [Upgrade Guide](../proxy/upgrade_guide.md#check-the-rows-before-the-schema).

**Symptom on v1.103.0 to v1.107.x:** the same rows fail inside the upgrade instead, with `index row size 2976 exceeds btree version 4 maximum 2704 for index "LiteLLM_SpendLogs_api_key_startTime_idx"` in the log. On v1.103.x and v1.104.x the index is created inside migration `20260823000000_add_spend_logs_api_key_starttime_index`, so that migration fails, the ones after it never run, and the pods start against a partly upgraded schema, so requests fail with errors such as `column t.tpd_limit does not exist`. From v1.105.0 the index is built after the migrations as a request-log index, so the migrations apply, the index is left `INVALID`, and the job exits 1 with `Database setup failed after multiple retries ... check your database connection` on every rerun.

**Cause:** before v1.99.0 the proxy hashed only `sk-` virtual keys before writing `LiteLLM_SpendLogs.api_key`; a JWT or a pass-through bearer token was stored as sent, sometimes several kilobytes long. A btree entry has to fit in a third of an 8 KB page, 2704 bytes including the entry header and every indexed column, which for `("api_key", "startTime")` leaves 2684 bytes for the key. Rows written since v1.99.0 hold a 64-character hash and are never affected.

**How to fix:** count the rows first:

```sql
SELECT count(*), max(octet_length("api_key"))
FROM "LiteLLM_SpendLogs"
WHERE octet_length("api_key") > 2684;
```

Then run the `UPDATE` from the report. It replaces every raw key with the hash the proxy writes today, which is one way and idempotent (a hashed row matches neither pattern and is skipped). In our test it took about 8 seconds per 100,000 legacy rows and did not block inserts. Rows the proxy wrote with the raw key keep their spend and are now found under the hashed key, the same way rows written since v1.99.0 are.

On v1.108.0 and later, start the proxy or the job again; the check passes and the upgrade proceeds. On an earlier version, also clean up what the failed attempt left behind. If the index was left invalid, drop it and let the next start rebuild it:

```sql
SELECT indexrelid::regclass FROM pg_index WHERE NOT indisvalid;
DROP INDEX CONCURRENTLY "LiteLLM_SpendLogs_api_key_startTime_idx";
```

If a migration failed, remove its entry as in [section 2](#2-new-migrations-cannot-be-applied-before-the-error-is-recovered-from) and restart.
