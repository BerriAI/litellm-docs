# Troubleshooting Prisma Migration Errors

Common Prisma migration issues encountered when upgrading or downgrading LiteLLM proxy versions, plus the query engine resolution failure that can stop the proxy before any migration runs, and how to fix them.

For a full guide on safely reverting your LiteLLM version, see the **[Safe Rollback Guide](rollback)**.

## How Prisma Migrations Work in LiteLLM

- LiteLLM uses [Prisma](https://www.prisma.io/) to manage its PostgreSQL database schema.
- Migration history is tracked in the `_prisma_migrations` table in your database.
- When LiteLLM starts, it runs `prisma migrate deploy` to apply any new migrations.
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
