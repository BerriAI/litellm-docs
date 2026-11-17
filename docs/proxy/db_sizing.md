---
title: Database Sizing
description: Size Postgres for LiteLLM Proxy through 20K RPS, with cloud recommendations, connection budgets, and storage estimates.
---

# Database Sizing

See [Production Best Practices](./prod.md) for configuration and [What is stored in the DB](./db_info.md) for database contents. Size Redis with [Redis Sizing](./redis_sizing.md). [Gateway benchmarks](../benchmarks.md) cover proxy throughput and latency.

## Workload {#what-the-proxy-asks-of-the-database}

Postgres serves authentication reads and accounting writes. Authentication uses indexed reads from `LiteLLM_VerificationToken`, `LiteLLM_UserTable`, and `LiteLLM_TeamTable`. Caching reduces repeat reads.

Accounting updates key, user, team, and organization spend. Per-request logs go into `LiteLLM_SpendLogs`. These writes drive database capacity, so enable [batched spend writes](./prod.md#batch-spend-writes) and use the [Redis transaction buffer](./prod.md#redis-transaction-buffer) above roughly 1K RPS.

## Sizing by request rate

These instance sizes are planning estimates. The 10K–20K tier extrapolates the 5K baseline with unchanged logging, batching, and query mix. Validate it with a load test. These instance families jump from 16 to 32 vCPU, so 10K–20K uses one tier.

Size storage from retention and connections from the worker pool budget below. A [read replica](./db_read_replica.md) can serve supported read traffic, but it does not remove write contention on the primary.

<span id="cloud-recommendations" />

### AWS RDS for PostgreSQL

| Sustained RPS | Instance type | vCPU | RAM |
| --- | --- | --- | --- |
| Up to 1K | `db.m7g.xlarge` | 4 | 16 GiB |
| 1K to 5K | `db.m7g.2xlarge` | 8 | 32 GiB |
| 5K to 10K | `db.m7g.4xlarge` | 16 | 64 GiB |
| 10K to 20K | `db.m7g.8xlarge` | 32 | 128 GiB |

See [RDS instance specifications](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.DBInstanceClass.Summary.html). Use [gp3 storage](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_Storage.html#gp3-storage), [Multi-AZ](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.MultiAZ.html), and [Database Insights](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_DatabaseInsights.html).

### Google Cloud SQL for PostgreSQL

| Sustained RPS | Instance type (Enterprise Plus) | vCPU | RAM |
| --- | --- | --- | --- |
| Up to 1K | `db-perf-optimized-N-4` | 4 | 32 GB |
| 1K to 5K | `db-perf-optimized-N-8` | 8 | 64 GB |
| 5K to 10K | `db-perf-optimized-N-16` | 16 | 128 GB |
| 10K to 20K | `db-perf-optimized-N-32` | 32 | 256 GB |

See [Cloud SQL machine specifications](https://docs.cloud.google.com/sql/docs/postgres/machine-series-overview#n2-machine-types). Enable regional high availability and automatic storage increase. SSD throughput depends on both disk size and vCPU limits. Check the [storage limits](https://cloud.google.com/sql/docs/postgres/storage-options-overview).

### Azure Database for PostgreSQL

| Sustained RPS | Instance type (General Purpose) | vCore | RAM |
| --- | --- | --- | --- |
| Up to 1K | `D4ds_v5` | 4 | 16 GiB |
| 1K to 5K | `D8ds_v5` | 8 | 32 GiB |
| 5K to 10K | `D16ds_v5` | 16 | 64 GiB |
| 10K to 20K | `D32ds_v5` | 32 | 128 GiB |

See [Azure compute options](https://learn.microsoft.com/en-us/azure/postgresql/compute-storage/concepts-compute). Use [Premium SSD v2](https://learn.microsoft.com/en-us/azure/postgresql/configure-maintain/concepts-storage) and [zone-redundant high availability](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-high-availability). The built-in [PgBouncer](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-pgbouncer) provides connection pooling on port `6432`.

## Capacity planning

### Connection budgets {#connections-break-before-cpu-does}

A full connection pool can cause `FATAL: sorry, too many clients already` before CPU reaches its limit. For workers that connect directly to Postgres, include both the autoscaler's maximum and extra instances alive during a rollout:

```text
direct connections = database_connection_pool_limit × workers_per_instance × (maximum_instances + rollout_overlap)
```

At a pool limit of 10, one worker per instance, 100 maximum instances, and 25 extra rollout instances, the gateway can open 1,250 connections. Reserve capacity for backend services, migrations, and operators. Set the pool with the [connection limit configuration](./configs.md#configure-db-pool-limits--connection-timeouts).

When you enable [`database.connectionPool` in Helm](./deploy/helm.md#valuesyaml-reference), gateway workers share one PgBouncer pool per pod. The gateway's Postgres connection budget becomes `maxDbConnections × (maximum_pods + rollout_overlap)`. Count backend and migration connections separately because they connect directly.

| Cloud | Connection limit | Reference |
| --- | --- | --- |
| AWS RDS and Aurora | The default formula is `LEAST({DBInstanceClassMemory/9531392}, 5000)`. Check the effective parameter for your instance. | [RDS parameter defaults](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_Limits.html#RDS_Limits.MaxConnections) |
| GCP Cloud SQL | The default derives from instance memory. It adjusts after a resize unless you set the flag yourself. | [Cloud SQL flags](https://cloud.google.com/sql/docs/postgres/flags#postgres-m) |
| Azure flexible server | `D4ds_v5` allows 1,718 total connections and 1,703 application connections. `D8ds_v5` allows 3,437 total and 3,422 application connections. | [Azure limits](https://learn.microsoft.com/en-us/azure/postgresql/configure-maintain/concepts-limits#maximum-connections) |

If application demand exceeds the database connection budget, use RDS Proxy, Azure's built-in PgBouncer, or another pooler. Set [`database_disable_prepared_statements: true`](./configs.md#disable-server-side-prepared-statements) for pooled sessions.

Connections also stay busy while transactions wait for shared spend rows. LiteLLM applies `SPEND_ROLLUP_LOCK_TIMEOUT_MS`, which defaults to 5,000 ms, to spend rollup transactions. Postgres cancels a statement that exceeds this wait. LiteLLM requeues its rows for the next flush and releases the connection. To inspect lock waits, run:

```sql
SELECT query, count(*)
FROM pg_stat_activity
WHERE wait_event_type = 'Lock'
GROUP BY query
```

### Storage and write throughput

Storage follows request log volume and retention. Start with an estimate of 1–2 KB per logged request without prompts, then measure actual row and index sizes. `store_prompts_in_spend_logs` can increase this by roughly 10 times.

```text
log data bytes = logged requests per second × 86400 × retention days × bytes per request
```

| Sustained logged RPS | Log data per day at 1–2 KB per request |
| --- | --- |
| 10K | 0.864–1.728 TB |
| 15K | 1.296–2.592 TB |
| 20K | 1.728–3.456 TB |

These decimal TB estimates exclude indexes, WAL, and free space for maintenance. Multiply by retention days and add those costs.

Use these starting points for write tests, then increase storage to cover retention. Measure write latency and IOPS at 10K, 15K, and 20K because batching changes the write rate.

| Sustained RPS | SSD starting capacity | IOPS starting point |
| --- | --- | --- |
| Up to 1K | 200 GB | 3,000 |
| 1K to 5K | 500 GB | 5,000 |
| 5K to 20K | 1 TB | 10,000 |

### Keep the database small

Batch spend writes with `proxy_batch_write_at: 60`. Keep [error logs out of the database](./prod.md#keep-error-logs-out-of-the-database) and set a [spend log retention period](./spend_logs_deletion.md). If you do not need per-request rows in the UI, set `disable_spend_logs: True` and keep cost data in your logging integrations. Enable `store_prompts_in_spend_logs` only when you need prompt history because it also increases gateway memory use.

## What to monitor

Watch connection count against `max_connections`, write latency, lock waits, and storage growth. Check `litellm_in_memory_spend_update_queue_size` and `litellm_redis_spend_update_queue_size` for queued spend updates. Use `litellm_pod_lock_manager_size` to check the transaction buffer flush lock.
