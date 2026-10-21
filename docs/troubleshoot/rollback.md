# Safe Rollback Guide

This guide outlines the process for safely rolling back a LiteLLM Proxy deployment to a previous version.

We recommend rolling back to the previous [stable release](https://github.com/BerriAI/litellm/releases). Stable releases come out every week and follow the `vX.Y.Z` tag convention (e.g., `v1.89.4`).

## 1. Determine Rollback Scope

Before proceeding, identify why you are rolling back:
- **Application Logic Error**: Reverting code changes but keeping the database schema.
- **Database Migration Failure**: Reverting changes that included database schema updates.
- **Performance Regression**: Reverting to a known stable version.

## 2. Back Up the Database

> **Always back up before rolling back.** Before making any changes, take a database snapshot or dump. This is your safety net if something goes wrong during the rollback.

```bash
# PostgreSQL example
pg_dump -h <host> -U <user> -d <database> -F c -f litellm_backup_$(date +%Y%m%d_%H%M%S).dump
```

If you are on a managed database (e.g., AWS RDS, GCP Cloud SQL), create a snapshot through your cloud console instead.

## 3. Pre-Rollback Checks

Before reverting, review these items:

- **`LITELLM_SALT_KEY`**: Do **not** change this value during rollback. It is used to encrypt/decrypt your LLM API Key credentials stored in the database. Changing it will make existing credentials unreadable. See [Best Practices for Production](../proxy/prod#set-the-salt-key).
- **`config.yaml`**: If you added settings specific to the newer version, the older version may not recognize them. Review your config and remove or comment out any settings that were introduced in the version you are rolling back from.
- **`DISABLE_SCHEMA_UPDATE`**: If you use the [Helm PreSync hook for migrations](../proxy/prod#run-migrations-from-the-helm-presync-hook) with `DISABLE_SCHEMA_UPDATE=true` on your pods, migrations will **not** auto-run on restart. You will need to handle migration cleanup manually (see Step 5) or re-run the PreSync hook against the older chart version.

## 4. Revert Application Version

Revert your deployment to the previous stable Docker image or Helm chart version.

### Docker
Update your deployment manifest (e.g., K8s Deployment, Docker Compose) to use the previous version:
```yaml
# Example: Reverting to the previous stable release
image: docker.litellm.ai/berriai/litellm:v<VERSION>
```

See [all available images](https://github.com/orgs/BerriAI/packages).

### Helm
If you deployed via Helm, use `helm rollback`:
```bash
helm rollback <release-name> [revision-number]
```

## 5. Handle Database Migrations

If you are rolling back to a version that did not have a specific migration, you may need to resolve the migration state in the database.

> LiteLLM uses `prisma migrate deploy` for production by default. If a migration partially failed or you are reverting code that expects an older schema, you need to clean up the migration history in the `_prisma_migrations` table. See [Best Practices for Production](../proxy/prod#use-prisma-migrate-deploy).

### Option A: Delete stale migration entries (recommended)

Connect to your PostgreSQL database and remove migration entries that belong to the version you are rolling back from. This lets LiteLLM re-apply them cleanly if you upgrade again later.

```sql
-- View recent migrations
SELECT migration_name, finished_at, rolled_back_at, logs
FROM "_prisma_migrations"
ORDER BY started_at DESC
LIMIT 10;

-- Delete migration entries from the version you are rolling back from
DELETE FROM "_prisma_migrations"
WHERE migration_name = '<migration_name_from_newer_version>';
```

After deleting the entries, restart LiteLLM and it will re-apply the correct migrations for its version on startup.

> **Note:** If you have `DISABLE_SCHEMA_UPDATE=true` set on your pods, migrations will not auto-run. You need to either temporarily set it to `false`, or re-run the Helm PreSync migration job targeting the older version.

### Option B: Use `prisma migrate resolve` (if you have CLI access)

If you have access to the Prisma CLI (e.g., in a local development environment or a debug container with the `litellm-proxy-extras` package installed):

```bash
DATABASE_URL="<your_database_url>" prisma migrate resolve --rolled-back "<migration_name>"
```

> **Note:** This requires the Prisma CLI to be available in your environment (installed via `prisma-client-py`). If you don't have CLI access (e.g., no shell into the running container), use **Option A** (direct SQL) instead.

### Auto-Recovery Logic
LiteLLM's internal `ProxyExtrasDBManager` automatically attempts to handle idempotent migrations. In many cases, simply rolling back the version and restarting the proxy will be enough if the database changes are additive (e.g., new columns or tables).

### Rolling back past team-attributed tag spend

The release that added `team_id` to `LiteLLM_DailyTagSpend` replaced its unique index with one that includes `team_id`. Rolling back keeps the new column and indexes, but older versions write tag spend against the old unique index. Until you recreate it, every tag spend write fails with `there is no unique or exclusion constraint matching the ON CONFLICT specification`, and that spend is lost. Request logs and the other daily spend tables still write.

Recreating the old index fails if the same tag, date, key, model, provider, MCP tool and endpoint now have rows for more than one team. This happens whenever a key moves between teams, or JWT callers on different teams share the empty key. Merge those rows first. Stop every LiteLLM instance and take a database snapshot before you run these statements.

If an earlier attempt to create the old index failed, drop the invalid index it left behind.

```sql
DROP INDEX CONCURRENTLY IF EXISTS "LiteLLM_DailyTagSpend_tag_date_api_key_model_custom_llm_pro_key";
```

Then merge the rows that share the old key into one row. This deletes the extra rows first, then writes the summed values onto the row it keeps.

```sql
BEGIN;
LOCK TABLE "LiteLLM_DailyTagSpend" IN SHARE ROW EXCLUSIVE MODE;
CREATE TEMP TABLE tag_merge ON COMMIT DROP AS
SELECT (array_agg(id ORDER BY updated_at DESC))[1] AS keep_id,
       tag, date, api_key, model, custom_llm_provider, mcp_namespaced_tool_name, endpoint,
       SUM(prompt_tokens) AS prompt_tokens, SUM(completion_tokens) AS completion_tokens,
       SUM(cache_read_input_tokens) AS cache_read_input_tokens,
       SUM(cache_creation_input_tokens) AS cache_creation_input_tokens,
       SUM(compression_saved_tokens) AS compression_saved_tokens,
       SUM(compression_savings_spend) AS compression_savings_spend,
       SUM(prompt_caching_savings_spend) AS prompt_caching_savings_spend,
       SUM(gateway_injected_caching_savings_spend) AS gateway_injected_caching_savings_spend,
       SUM(autorouter_savings_spend) AS autorouter_savings_spend,
       SUM(spend) AS spend, SUM(api_requests) AS api_requests,
       SUM(successful_requests) AS successful_requests, SUM(failed_requests) AS failed_requests,
       SUM(total_response_time_ms) AS total_response_time_ms, SUM(timed_requests) AS timed_requests
FROM "LiteLLM_DailyTagSpend"
GROUP BY tag, date, api_key, model, custom_llm_provider, mcp_namespaced_tool_name, endpoint
HAVING count(*) > 1;
DELETE FROM "LiteLLM_DailyTagSpend" t USING tag_merge m
WHERE t.tag IS NOT DISTINCT FROM m.tag AND t.date = m.date AND t.api_key = m.api_key
  AND t.model IS NOT DISTINCT FROM m.model AND t.custom_llm_provider IS NOT DISTINCT FROM m.custom_llm_provider
  AND t.mcp_namespaced_tool_name IS NOT DISTINCT FROM m.mcp_namespaced_tool_name
  AND t.endpoint IS NOT DISTINCT FROM m.endpoint AND t.id <> m.keep_id;
UPDATE "LiteLLM_DailyTagSpend" t SET
  prompt_tokens = m.prompt_tokens, completion_tokens = m.completion_tokens,
  cache_read_input_tokens = m.cache_read_input_tokens, cache_creation_input_tokens = m.cache_creation_input_tokens,
  compression_saved_tokens = m.compression_saved_tokens, compression_savings_spend = m.compression_savings_spend,
  prompt_caching_savings_spend = m.prompt_caching_savings_spend,
  gateway_injected_caching_savings_spend = m.gateway_injected_caching_savings_spend,
  autorouter_savings_spend = m.autorouter_savings_spend, spend = m.spend, api_requests = m.api_requests,
  successful_requests = m.successful_requests, failed_requests = m.failed_requests,
  total_response_time_ms = m.total_response_time_ms, timed_requests = m.timed_requests,
  team_id = '', updated_at = now()
FROM tag_merge m WHERE t.id = m.keep_id;
COMMIT;
```

Then recreate the old unique index, outside a transaction.

```sql
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "LiteLLM_DailyTagSpend_tag_date_api_key_model_custom_llm_pro_key"
ON "LiteLLM_DailyTagSpend" ("tag", "date", "api_key", "model", "custom_llm_provider", "mcp_namespaced_tool_name", "endpoint");
```

Start the older version after the index is valid. Totals per tag stay the same, and the merged rows lose their team attribution. In our test the merge folded 54 rows into 25 and left spend, request and token totals unchanged.

## 6. Verification Checklist

After rolling back, verify the health of the system:

- [ ] **Health Endpoint**: Confirm the `/health` endpoint returns `200 OK`.
- [ ] **Check Logs**: Confirm no Prisma errors appear. Look for `relation "..." does not exist`, `column "..." does not exist`, or `prisma migrate` failures in the logs.
- [ ] **Spend Tracking**: Run a test completion and confirm the spend is recorded in the `LiteLLM_SpendLogs` table.
- [ ] **Billing (Lago)**: If using Lago for billing (e.g., Lago → Stripe), check proxy logs for `Logged Lago Object` to confirm usage events are being sent.
- [ ] **State Consistency**: If using Redis for caching or rate limiting, consider clearing the cache if the newer version changed the cache key structure.
- [ ] **Admin UI**: Verify the Admin UI loads and shows correct data for keys and teams.

## 7. Troubleshooting

### "New migrations cannot be applied"
If you see this error after a rollback, it means the database has a migration in a "failed" state.
1. Identify the failed migration name (see the SQL query in Step 5).
2. Delete the failed entry from `_prisma_migrations`.
3. Restart the proxy.

### "relation X does not exist"
This typically means a migration entry exists in `_prisma_migrations` but the actual table/column was never created or was dropped.
1. Delete the stale migration entry.
2. Restart LiteLLM so it re-runs the migration.

For more details on Prisma errors, see [Prisma Migrations Troubleshoot](prisma_migrations).
