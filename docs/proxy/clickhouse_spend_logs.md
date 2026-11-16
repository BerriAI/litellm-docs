---
title: Spend logs in ClickHouse
description: Export LiteLLM request costs to ClickHouse, verify delivery, and plan a gradual move from PostgreSQL request logs.
---

# Spend logs in ClickHouse

<SinceVersion v="1.105.0" />

Use the `clickhouse` callback to write new request records to ClickHouse's `spend_logs` table. Each record includes the model, cost, token counts, status, timing, and available key, user, and team metadata. Lens is not required for this callback.

Start by keeping PostgreSQL logging enabled while you verify ClickHouse. The callback does not copy historical rows or switch the LiteLLM Logs page and `/spend/logs` APIs to ClickHouse. PostgreSQL remains the gateway database for keys, users, teams, and budget accounting.

This procedure is tested with the published [LiteLLM 1.108.9 release](https://github.com/BerriAI/litellm/releases/tag/v1.108.9) and ClickHouse 26.9.6.6. Use the same LiteLLM version for schema initialization and the running proxy.

## Before you start

You need an existing LiteLLM proxy configuration, a ClickHouse HTTP(S) endpoint reachable from the proxy, and permission to create and alter the spend schema. The initialization credential needs database and table creation, reads, inserts, and alters. A runtime writer needs insert access to the initialized `spend_logs` table.

Use HTTPS for a remote database. The usual HTTPS port is `8443` and the HTTP port is `8123`. Port `9000` uses the native ClickHouse protocol and does not work with this callback.

Run the Python commands below in the proxy's environment. For a Python installation, install the package with the database dependencies:

```bash
python -m pip install 'litellm[extra_proxy]==1.108.9'
```

For a container deployment, run schema initialization inside a container using the same image as the gateway, with the ClickHouse environment variables supplied. Preserve your existing gateway configuration, credentials, and PostgreSQL database.

## Set up new request logging

### 1. Configure the connection and retention

Supply these environment variables to the proxy and the schema-initialization process through your secret manager or deployment settings.

`CLICKHOUSE_URL` is required. Set it to an authenticated HTTP(S) connection URL. URL-encode special characters in the username and password:

```text
https://spend_writer:URL_ENCODED_PASSWORD@clickhouse.example.com:8443
```

`CLICKHOUSE_DATABASE` selects the database for the spend table. This guide uses `litellm_spend`; the default is `litellm`.

`AGENT_TRACING_RETENTION_DAYS` sets retention to a positive number of days. This guide uses `30`; the default is `14`, including for this standalone callback.

Keep the authenticated URL out of `config.yaml` and source control. These non-secret settings can be exported in the shell that runs the next step:

```bash
export CLICKHOUSE_DATABASE=litellm_spend
export AGENT_TRACING_RETENTION_DAYS=30
```

Use a separate database for a new standalone spend-log installation. If you already send spend records through Lens, keep that pipeline and storage configuration; do not enable a second writer to the same table as part of this setup.

Retention is measured from each record's request start time, not its insertion time. Choose it before importing older data. ClickHouse removes expired rows through background TTL processing.

### 2. Initialize the schema

The callback writes to an existing table. Run this once before enabling it, with `CLICKHOUSE_URL` loaded in the environment:

```bash
python - <<'PY'
import asyncio
from litellm.rust_bridge.clickhouse import ClickHouseSpendStorage, spend_storage_config

asyncio.run(ClickHouseSpendStorage(spend_storage_config()).ensure_schema())
print("ClickHouse spend schema is ready")
PY
```

Expect `ClickHouse spend schema is ready`. The initializer creates the database, the `spend_logs` table, and its migration ledger. It also applies the configured retention. Do not copy a PostgreSQL table definition into ClickHouse or maintain a separate copy of the schema SQL.

Run the initializer again when you change retention or upgrade the writer, using that deployment's selected database and retention. Review a shorter retention before applying it because it makes older rows eligible for deletion. Changing the proxy environment alone does not apply the table TTL.

### 3. Enable the callback

Merge this into your existing `config.yaml`. Append `clickhouse` to any callbacks you already use and keep your model list and PostgreSQL settings.

```yaml
litellm_settings:
  callbacks: ["clickhouse"]
  turn_off_message_logging: true
```

`turn_off_message_logging: true` leaves the ClickHouse `messages` and `response` fields empty. It also affects other logging integrations, so retain your existing content policy if those integrations need request or response bodies. PostgreSQL's `store_prompts_in_spend_logs` setting does not control this callback's content storage.

Restart or roll out the proxy through your existing deployment process. For a Python deployment, start it with your existing configuration:

```bash
litellm --config config.yaml
```

### 4. Verify a real request

Use a model already configured on your proxy. Set `LITELLM_PROXY_API_BASE` to its reachable API base URL, `LITELLM_PROXY_API_KEY` to an authorized virtual key, and `LITELLM_MODEL` to that model's name. Load the key securely rather than putting it in the command.

```bash
curl --fail-with-body "${LITELLM_PROXY_API_BASE%/}/chat/completions" \
  -H "Authorization: Bearer $LITELLM_PROXY_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"model\":\"$LITELLM_MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"Reply with OK.\"}],\"metadata\":{\"tags\":[\"clickhouse-verification\"]}}"
```

This is a billable model request. Expect a successful model response and retain its `id` and `usage` values for comparison. Allow a few seconds for asynchronous logging, then run this SQL in your ClickHouse SQL console:

```sql
SELECT request_id, status, model, spend,
       prompt_tokens, completion_tokens, total_tokens,
       length(messages) AS message_bytes,
       length(response) AS response_bytes
FROM litellm_spend.spend_logs FINAL
WHERE start_time >= now() - INTERVAL 10 MINUTE
  AND has(request_tags, 'clickhouse-verification')
ORDER BY start_time DESC
LIMIT 10;
```

Expect a `success` row matching your response ID and token usage. The content byte counts should be zero with message logging disabled. Spend is in USD; an unknown cost can be `NULL`. Verify the model's pricing if you expect a nonzero cost but see zero or `NULL`.

Use `FINAL` when reconciling rows or adding up costs. The table uses `ReplacingMergeTree`, so replacement rows can coexist until ClickHouse merges them. Bound analytics queries by `start_time`.

## Move an existing deployment gradually

### Keep both stores during validation

Leave `general_settings.disable_spend_logs` unset or `false`. Send representative requests through each route you use, including streaming and provider failures. Compare ClickHouse with PostgreSQL for the same request IDs, time window, token counts, status, and spend. Confirm your reports and access controls work against ClickHouse before changing where users read their logs.

Failure token counts can differ between the two stores. In the release tested here, a rejected request without provider usage produced zero ClickHouse tokens while PostgreSQL recorded an estimated count. Reconcile successful usage separately from failures rather than treating every field as an identical copy.

For API-based comparison, use the [paginated spend logs API](./cost_tracking.md#paginated-spend-logs---spendlogsv2). The gateway's spend-log APIs continue reading PostgreSQL. Enabling the callback does not redirect them.

### Decide what to do with historical records

There is no built-in PostgreSQL-to-ClickHouse historical backfill command for this callback. Enabling it starts logging new requests. Existing records remain in PostgreSQL, with their existing retention policy.

Keeping historical records in PostgreSQL and choosing a start date for new ClickHouse reports is the shortest migration path. If you need one historical dataset, plan a separate export and transformation before retiring the original history. The schemas differ, including timestamp names and types, serialized metadata, nullable costs, and request identifiers. Preserve those semantics and validate counts and cost totals before deleting any source data.

Set a ClickHouse retention window that includes the history you intend to import. A record older than that window can expire immediately after import. A callback restart does not replay missed records, and re-enabling PostgreSQL logging does not restore records omitted while it was disabled.

### Optionally stop new PostgreSQL request rows

Skip this step if you need per-request history in the LiteLLM Logs page or spend-log APIs. When your reports read ClickHouse and you accept losing new PostgreSQL request detail, merge this setting and restart the proxy:

```yaml
general_settings:
  disable_spend_logs: true
```

This stops new `LiteLLM_SpendLogs` rows while the ClickHouse callback continues. Keep PostgreSQL connected. Aggregate spend and budget accounting still use the gateway database, and features that depend on individual PostgreSQL request rows lose that new history. Do not set `disable_spend_tracking` or `disable_cumulative_spend_updates` as part of this change.

Repeat the verification request. Confirm a new ClickHouse row, no corresponding new PostgreSQL spend-log row, and continued key spend accounting. Existing PostgreSQL rows are not deleted by this setting; their configured retention still applies.

### Roll back logging changes

Set `general_settings.disable_spend_logs` back to `false` and restart to resume new PostgreSQL request rows. Verify a new request appears there. If you also want to stop ClickHouse exports, remove only `clickhouse` from the callback list and restart. Keep the ClickHouse data for reconciliation.

## Operate and troubleshoot

Writes are asynchronous, with a default flush interval of one second and batch size of 10,000 rows. `CLICKHOUSE_FLUSH_INTERVAL_SECONDS` and `CLICKHOUSE_BATCH_SIZE` override these values. There is no durable delivery queue: process exits and failed inserts can lose records. The default retry limit is three failed insert attempts, controlled by `CLICKHOUSE_MAX_RETRIES`. Treat this as an analytics export, and validate its delivery guarantees against your accounting requirements.

**CLICKHOUSE_URL is required.** Supply the variable to the running proxy as well as the initialization process.

**ClickHouse spend logging requires the Rust extension.** Use a published package or image with the native extension for your platform. Run the schema-initialization command in that same runtime before rollout.

**Database or `spend_logs` table does not exist.** Run schema initialization against the same endpoint and database as the writer, then repeat the verification request.

**ClickHouse rejects an insert.** Check the proxy's `ClickHouse: insert into spend_logs failed` log, database permissions, endpoint protocol, and schema version. A successful model response does not prove log delivery.

**ClickHouse: dropped ... rows.** Delivery exhausted its retries. Restore connectivity or permissions and verify a new request. Dropped rows are not replayed automatically.

**Costs are zero or `NULL`.** Check the response's usage and [model pricing](./model_cost_map.md). A missing price is not proof that a request was free.

**Logs disappear after a retention change.** Inspect the table's TTL and the records' `start_time`. Reverting the TTL cannot recover deleted records.

ClickHouse queries use your database's permissions. LiteLLM's key, user, and team visibility rules are not automatically applied to users querying ClickHouse directly. Give reporting users only the database access their role requires.

For the default PostgreSQL storage path, see [Spend tracking](./cost_tracking.md). For agent traces and their matched request costs, see [Lens deployment](./lens/deployment.md).
