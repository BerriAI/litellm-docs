---
title: Database Sizing
description: How to size Postgres for LiteLLM Proxy, with instance recommendations for AWS, Azure, and GCP.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Database Sizing

This page sizes the Postgres instance behind LiteLLM Proxy, which is required as soon as you use virtual keys or usage tracking. The numbers below start from the [gateway benchmarks](../benchmarks.md), which were run against 4 vCPU / 8GB gateway instances, and extend them to the managed offerings on AWS, Azure, and GCP. Redis is sized separately in [Redis Sizing](./redis_sizing.md). For the configuration knobs that go with this sizing, see [Production Best Practices](./prod.md); for what actually lives in the database, see [What is stored in the DB](./db_info.md).

## What the proxy asks of the database

Postgres is on the authentication path and on the accounting path, and those two shapes are very different. Authentication is a small number of indexed point reads per request against `LiteLLM_VerificationToken`, `LiteLLM_UserTable`, and `LiteLLM_TeamTable`, and it is cached, so at steady state it costs the database almost nothing. Accounting is the expensive half: spend has to be written back to key, user, team, and org rows, and per-request log rows land in `LiteLLM_SpendLogs`. That write path, not the read path, is what determines the instance you need, and it is why [batching spend writes](./prod.md#batch-spend-writes) and (above roughly 1000 RPS) the [Redis transaction buffer](./prod.md#redis-transaction-buffer) matter more to database sizing than raw request volume does.

## Sizing by request rate

Sized for the write path above. Storage is dominated by `LiteLLM_SpendLogs`, so it tracks retention rather than throughput; budget roughly 1 to 2 KB per logged request without prompts, and 10x that with `store_prompts_in_spend_logs` enabled.

| Sustained RPS | vCPU | RAM | Storage | Connections needed |
|---------------|------|-----|---------|--------------------|
| Up to 1K | 4 | 16GB | 200GB SSD, 3000+ IOPS | 100 to 200 |
| 1K to 5K | 8 | 32GB | 500GB SSD, 5000+ IOPS | 200 to 500 |
| 5K+ | 16+ | 64GB | 1TB+ SSD, 10000+ IOPS | 500+, plus a [read replica](./db_read_replica.md) |

## Connections break before CPU does

The failure you are most likely to hit is `FATAL: sorry, too many clients already`, not a saturated database CPU. LiteLLM's pool limit is per worker process, so your total demand is `database_connection_pool_limit × workers_per_instance × instances`, and the instance count that matters is the autoscaler's `maxReplicas` rather than today's replica count. A deployment with `maxReplicas: 100` at the default pool limit of 10 asks for 1000 connections, which is past what most managed Postgres instances accept at their default settings. Size the pool with the [division in the config reference](./configs.md#configure-db-pool-limits--connection-timeouts) and cap `maxReplicas` at something your database can actually serve.

Each cloud derives its default `max_connections` from instance memory, so the ceiling moves when you resize:

| Cloud | Default `max_connections` | Reference |
|-------|---------------------------|-----------|
| AWS RDS and Aurora | `LEAST({DBInstanceClassMemory/9531392}, 5000)`, so about 860 on 8GB and 3600 on 32GB | [RDS parameter defaults](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_Limits.html#RDS_Limits.MaxConnections) |
| Azure Database for PostgreSQL flexible server | Fixed per product name, 1,718 on 16GB (D4ds_v5) and 3,437 on 32GB (D8ds_v5), 15 reserved by the service | [Azure limits](https://learn.microsoft.com/en-us/azure/postgresql/configure-maintain/concepts-limits#maximum-connections) |
| Google Cloud SQL | Derived from instance memory, adjusts automatically when you resize unless you pin the flag | [Cloud SQL flags](https://cloud.google.com/sql/docs/postgres/flags#postgres-m) |

If you need more application connections than the instance can serve, put a pooler in front of it (RDS Proxy, the PgBouncer built into Azure flexible server, or your own) and set [`database_disable_prepared_statements: true`](./configs.md#disable-server-side-prepared-statements) so Prisma stops reusing server-side prepared statements across pooled sessions.

## Cloud recommendations

<Tabs>
<TabItem value="aws" label="AWS">

Use RDS for PostgreSQL on a Graviton general purpose class, `db.m7g.large` up to 1K RPS, `db.m7g.xlarge` for 1K to 5K, and `db.m7g.2xlarge` or larger beyond that; see the [DB instance classes](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.DBInstanceClass.html) for the full list. Take gp3 storage, which gives a [baseline of 3000 IOPS and 125 MiB/s](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_Storage.html#gp3-storage) at any size and steps up to 12,000 IOPS and 500 MiB/s once a Postgres volume passes 400 GiB, so the 500GB row in the table above buys throughput as well as capacity. Run [Multi-AZ](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.MultiAZ.html) for production, and enable [Performance Insights](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_PerfInsights.html) so a spend-write hot spot is visible as a wait event rather than as unexplained latency.

Choose Aurora PostgreSQL instead when you want the reader endpoint: it pairs directly with LiteLLM's [read replica routing](./db_read_replica.md), which is the cleanest way past the 5K RPS row. Aurora's `max_connections` default uses the same memory formula as RDS.

</TabItem>
<TabItem value="azure" label="Azure">

Use Azure Database for PostgreSQL flexible server on the General Purpose tier, `D4ds_v5` (4 vCore, 16GB) up to 1K RPS and `D8ds_v5` (8 vCore, 32GB) for 1K to 5K, moving to Memory Optimized `E8ds_v5` or larger if your working set stops fitting in cache; the [compute options](https://learn.microsoft.com/en-us/azure/postgresql/configure-maintain/concepts-compute) list every product name. Avoid the Burstable tier in production, since a credit-exhausted instance stalls the spend write path. Use [Premium SSD v2 storage](https://learn.microsoft.com/en-us/azure/postgresql/configure-maintain/concepts-storage) so IOPS are provisioned independently of disk size, and turn on [zone-redundant high availability](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-high-availability). The [built-in PgBouncer](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-pgbouncer) is the easiest answer to the connection ceiling above; enable it, point `DATABASE_URL` at port 6432, and set `database_disable_prepared_statements: true`.

</TabItem>
<TabItem value="gcp" label="GCP">

Use Cloud SQL for PostgreSQL on the Enterprise Plus edition with an N2 machine type, 4 vCPU / 16GB up to 1K RPS and 8 vCPU / 32GB for 1K to 5K; the [instance settings reference](https://cloud.google.com/sql/docs/postgres/instance-settings) covers machine series and the [editions comparison](https://cloud.google.com/sql/docs/postgres/editions-intro) covers what Enterprise Plus adds, including the data cache and sub-second planned failover. Note that SSD IOPS on Cloud SQL scale with both vCPU count and disk size (30 read and 30 write IOPS per GB, capped by the [per-vCPU limits](https://cloud.google.com/sql/docs/postgres/storage-options-overview)), so a small disk on a large machine is a throughput ceiling you cannot raise with a flag. Enable regional high availability and automatic storage increase.

</TabItem>
</Tabs>

## Keep the database small

Sizing is cheaper when the write path does less. Batch spend writes with `proxy_batch_write_at: 60`, keep [error logs out of the database](./prod.md#keep-error-logs-out-of-the-database), and set a [spend log retention period](./spend_logs_deletion.md) so `LiteLLM_SpendLogs` does not grow without bound; that table is the reason storage rather than CPU is usually what you resize first. If you do not need per-request rows in the UI at all, `disable_spend_logs: True` removes the highest-volume insert while your logging integrations keep the cost data. Enable `store_prompts_in_spend_logs` only deliberately, since it multiplies both row size and the memory floor of the gateway pods.

## What to monitor

Watch connection count against `max_connections`, not just utilization, since that is the limit that produces hard failures. On the LiteLLM side the useful Prometheus signals are `litellm_in_memory_spend_update_queue_size` and `litellm_redis_spend_update_queue_size` for spend updates that are queued rather than written, and `litellm_pod_lock_manager_size` for which pod currently holds the transaction buffer flush lock. A queue depth that grows monotonically means the database is not keeping up with the write path, which is the signal to resize or to turn on the buffer.
