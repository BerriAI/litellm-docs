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

<span id="cloud-recommendations" />

Use these configurations as starting points for load tests. The AWS and GCP tables assume one primary shard supports 2,500 LiteLLM RPS with capacity left for bursts. This is an example assumption, not a benchmark. Measure each node type with your features enabled and calculate `primary shards = ceil(target RPS / measured RPS per primary)`.

Add shards or memory if your working set exceeds usable capacity. Test the full cluster because key distribution and shared counters can limit scaling. Memory totals exclude reserved overhead and replica copies.

### AWS ElastiCache

| Target RPS | Node type | Primary shards | Usable primary memory |
| --- | --- | --- | --- |
| Up to 1K | `cache.m7g.xlarge` | 1 | About 9.70 GiB |
| 1K to 5K | `cache.m7g.xlarge` | 2 | About 19.40 GiB |
| 5K to 10K | `cache.m7g.xlarge` | 4 | About 38.79 GiB |
| 10K to 15K | `cache.m7g.xlarge` | 6 | About 58.19 GiB |
| 15K to 20K | `cache.m7g.xlarge` | 8 | About 77.58 GiB |

Each [node](https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/CacheNodes.SupportedTypes.html) has 12.93 GiB before the default [25% memory reserve](https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/redis-memory-management.html). Add one replica per primary and enable [Multi-AZ and automatic failover](https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/AutoFailover.html). Use [Redis Cluster config](./caching_redis.md#redis-cluster) for multiple shards.

ElastiCache Serverless supports response caching. [Valkey semantic caching](./caching_semantic.md#valkey) requires a node-based cluster with the search module.

### Google Cloud Memorystore for Redis Cluster

| Target RPS | Node type | Primary shards | Usable primary memory |
| --- | --- | --- | --- |
| Up to 1K | `redis-highmem-medium` | 1 | 10.4 GB |
| 1K to 5K | `redis-highmem-medium` | 2 | 20.8 GB |
| 5K to 10K | `redis-highmem-medium` | 4 | 41.6 GB |
| 10K to 15K | `redis-highmem-medium` | 6 | 62.4 GB |
| 15K to 20K | `redis-highmem-medium` | 8 | 83.2 GB |

Each [node](https://docs.cloud.google.com/memorystore/docs/cluster/cluster-node-specification) has 2 vCPU and 10.4 GB of writable memory after reserved overhead. Use [Redis Cluster config](./caching_redis.md#redis-cluster), [multi-zone placement, and one replica per primary](https://docs.cloud.google.com/memorystore/docs/cluster/create-instances).

### Azure Managed Redis

These SKUs are starting points for memory capacity. Azure manages each SKU's shard count. Validate throughput with a load test before you select a SKU.

| Target RPS | Balanced SKU | Memory | Usable memory |
| --- | --- | --- | --- |
| Up to 1K | `B10` | 12 GB | About 9.6 GB |
| 1K to 5K | `B20` | 24 GB | About 19.2 GB |
| 5K to 10K | `B50` | 60 GB | About 48 GB |
| 10K to 20K | `B100` | 120 GB | About 96 GB |

These [SKU sizes](https://azure.microsoft.com/en-us/pricing/details/managed-redis/) show usable memory after Azure's [20% reserve](https://learn.microsoft.com/en-us/azure/redis/plan-tiers-and-capacity#reserved-memory). If throughput limits capacity while memory remains available, test the Compute Optimized SKU with the same suffix, such as `X50` instead of `B50`.

Enable [high availability](https://learn.microsoft.com/en-us/azure/redis/overview#high-availability). Azure distributes nodes across zones in regions that support availability zones.

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
