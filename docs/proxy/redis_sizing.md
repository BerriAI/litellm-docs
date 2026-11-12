---
title: Redis Sizing
description: Size Redis for LiteLLM Proxy through 20K RPS, with cloud recommendations, shard capacity, and memory guidance.
---

# Redis Sizing

Use Redis to share state across gateway instances. Size Postgres separately with [Database Sizing](./db_sizing.md). For setup, see [Redis in production](./prod.md#redis) and the [caching config](./caching_redis.md).

## Workload {#what-the-proxy-asks-of-redis}

Redis stores rate limit counters, router and cooldown state, and cached responses. When `use_redis_transaction_buffer` is enabled, it also holds spend updates until LiteLLM writes them to Postgres.

Memory depends on the features you enable, cache retention, and response size. Throughput depends on command volume and the capacity of each shard. Adding vCPUs to one node does not guarantee proportional throughput. [Google recommends adding shards when you need more throughput](https://docs.cloud.google.com/memorystore/docs/cluster/cluster-node-specification).

Without shared Redis state, each gateway enforces its own rate limits and keeps its own cache. Limits can multiply across instances.

## Sizing by request rate

These are planning starting points, and the 10K–20K tiers require a load test to measure each shard's capacity with your features enabled.

| Sustained RPS | Compute starting point | Primary RAM starting point |
| --- | --- | --- |
| Up to 1K | 2 vCPU | 8 GB |
| 1K to 5K | 4 vCPU | 16 GB |
| 5K to 10K | 8+ aggregate vCPU and at least `ceil(10000 / R_shard)` primary shards | 32 GB+, based on the working set |
| 10K to 15K | 8+ aggregate vCPU and at least `ceil(15000 / R_shard)` primary shards | 32 GB+, based on the working set |
| 15K to 20K | 8+ aggregate vCPU and at least `ceil(20000 / R_shard)` primary shards | 32 GB+, based on the working set |

`R_shard` is the LiteLLM RPS that one primary shard supports in your load test while it meets your latency target and retains capacity for bursts. For illustration, `R_shard = 2,500` gives 4, 6, and 8 primary shards for 10K, 15K, and 20K RPS. Replace 2,500 with your test result. Test the full cluster because key distribution and shared counters can limit scaling.

RAM totals cover primary nodes. Replicas add capacity for availability, not additional writable keyspace. Check each service's usable memory after its reserved overhead.

## Cloud recommendations

| Cloud | Service and size | Production settings |
| --- | --- | --- |
| AWS | ElastiCache with Valkey or Redis OSS. After the default [25% memory reserve](https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/redis-memory-management.html), `cache.m7g.xlarge`, `cache.m7g.2xlarge`, and `cache.m7g.4xlarge` provide about 9.70, 19.53, and 39.20 GiB for data. These meet the 8, 16, and 32 GB memory starting points. Size shard count from measured throughput. [Node specifications](https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/CacheNodes.SupportedTypes.html). | Enable [Multi-AZ and automatic failover](https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/AutoFailover.html). Use [Redis Cluster config](./caching_redis.md#redis-cluster) when you add shards. |
| GCP | Memorystore for Redis Cluster. Three `redis-standard-small` shards provide 15.6 GB of writable keyspace. Three `redis-highmem-medium` shards provide 31.2 GB. Add shards to meet measured throughput. [Node specifications](https://docs.cloud.google.com/memorystore/docs/cluster/cluster-node-specification). | Use [Redis Cluster config](./caching_redis.md#redis-cluster). Avoid `redis-shared-core-nano` for production because it has variable performance and no SLA. |
| Azure | Azure Managed Redis Balanced for general use. Choose Compute Optimized when command throughput is the constraint. Match usable memory and measured throughput to the tiers above. [Capacity planning](https://learn.microsoft.com/en-us/azure/redis/plan-tiers-and-capacity). | Enable high availability and zone redundancy where available. Check current SKU capacity and shard counts because they can change. |

ElastiCache Serverless supports response caching. [Valkey semantic caching](./caching_semantic.md#valkey) requires a node-based cluster with the search module.

## Capacity planning

### Feature capacity

Run Redis 7.0 or newer. Reserve memory for counters, router state, cached responses, and queued spend updates. Response caching grows with response size and retention, so RPS alone does not set the memory requirement.

Avoid eviction during normal operation. Eviction can remove rate limit counters or queued spend updates as well as cached responses. If you use the transaction buffer, configure supported persistence and test recovery of queued updates during failover.

Above roughly 1K RPS or 10 gateway instances, use the [Redis transaction buffer](./prod.md#redis-transaction-buffer) to reduce Postgres write pressure. Include the queue's peak size in the Redis memory budget.

### Connection budgets

Each gateway worker opens a Redis connection pool. Include the maximum gateway instance count when you compare pool sizes with the managed service's connection limit.

If you see `Got exception from REDIS No connection available`, check the client pool before resizing Redis. Increase `max_connections` in `cache_params` when the pool is too small for the workload.

## What to monitor

Watch memory use against `maxmemory`, evictions, command latency, and connection count. Check `litellm_redis_spend_update_queue_size` and `litellm_in_memory_spend_update_queue_size` for queued spend updates. Use `litellm_pod_lock_manager_size` to check which pod holds the transaction buffer flush lock.
