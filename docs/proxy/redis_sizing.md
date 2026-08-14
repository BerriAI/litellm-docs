---
title: Redis Sizing
description: How to size Redis for LiteLLM Proxy, with instance recommendations for AWS, Azure, and GCP.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Redis Sizing

This page sizes the Redis instance behind LiteLLM Proxy, which you should run as soon as you have more than one gateway instance. Postgres is sized separately in [Database Sizing](./db_sizing.md). For how to wire Redis into the proxy, see the Redis section of [Production Best Practices](./prod.md#redis) and the [caching config](./caching.md).

## What the proxy asks of Redis

Redis carries rate limit counters, router and cooldown state, the response cache, and, when `use_redis_transaction_buffer` is on, the spend update queue. Every one of those is live state with a short lifetime rather than durable history, so Redis is small and latency sensitive rather than large: a working set of a few GB is normal even at high traffic. Treat RAM as headroom for whatever you choose to cache, not as a function of request rate, and treat vCPU count as the thing that governs throughput, since a single Redis process is single threaded and TLS termination competes with command execution on the same core.

Without Redis each instance enforces rate limits independently and cache hits stay local to the instance that served the request, so a fleet of ten pods enforces roughly ten times the limit you configured.

## Sizing by request rate

| Sustained RPS | vCPU | RAM |
|---------------|------|-----|
| Up to 1K | 2 | 8GB |
| 1K to 5K | 4 | 16GB |
| 5K+ | 8+ | 32GB+ |

Run Redis 7.0 or newer. Size so that eviction does not happen during normal operation, and prefer adding capacity over relying on an eviction policy: rate limit counters and queued spend updates are live accounting state, so an instance that is evicting under pressure is dropping spend updates and resetting limit windows rather than just losing cache hits. If you use the transaction buffer, enable persistence as well, so a failover does not discard spend updates that were queued but not yet flushed to Postgres.

Above roughly 1000 RPS or 10 instances the buffer is what keeps Postgres from becoming the bottleneck, which makes Redis part of the accounting path rather than an optional cache; see [Redis transaction buffer](./prod.md#redis-transaction-buffer). If you see `Got exception from REDIS No connection available` under load, raise `max_connections` in `cache_params` before reaching for a larger instance, since that error is client-side pool exhaustion rather than a saturated server.

## Cloud recommendations

<Tabs>
<TabItem value="aws" label="AWS">

Use ElastiCache with the Valkey or Redis OSS engine at 7.x or newer on a Graviton node, `cache.m7g.large` (6.38 GiB) up to 1K RPS and `cache.m7g.xlarge` (12.93 GiB) above it; the [supported node types](https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/CacheNodes.SupportedTypes.html) list usable memory per node, which is below the nominal instance memory, so size against that column rather than the instance name. Run [Multi-AZ with automatic failover](https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/AutoFailover.html) in production. If you outgrow a single node, prefer cluster mode with LiteLLM's [Redis Cluster config](./caching.md#redis-cluster) over a larger node, since sharding spreads the counter keyspace across processes instead of piling it onto one. ElastiCache Serverless works for plain caching but not for [semantic caching on valkey-search](./caching.md), which needs a node-based cluster.

</TabItem>
<TabItem value="azure" label="Azure">

Use [Azure Managed Redis](https://learn.microsoft.com/en-us/azure/redis/overview) on the Balanced tier, which sits at a 4:1 memory-to-vCPU ratio and, unlike Azure Cache for Redis, gives an instance more than one vCPU: `B5` (6GB, 2 vCPU) is enough for counters and router state alone, `B10` (12GB, 4 vCPU) is the safer default once you cache responses, and `B20` (24GB, 8 vCPU) covers the 5K RPS row. See the [tier and SKU tables](https://learn.microsoft.com/en-us/azure/redis/how-to-scale#performance-tiers) for the full list, and consider Compute Optimized when throughput rather than capacity is the constraint. On the older Azure Cache for Redis, use the Premium tier (`P1` and up) rather than Standard, since Basic and Standard run on a single vCPU. Enable zone redundancy, and enable data persistence if you use the transaction buffer.

</TabItem>
<TabItem value="gcp" label="GCP">

Use [Memorystore for Redis Cluster](https://cloud.google.com/memorystore/docs/cluster/cluster-node-specification), where capacity is node type times shard count rather than a single instance size. `redis-standard-small` (5.2GB writable per node) at 3 shards is a reasonable floor, `redis-highmem-medium` (10.4GB writable) at 3 shards covers the 1K to 5K row, and past that add shards rather than scaling the node type up, which is Google's own price-performance guidance since Redis performance does not scale linearly with vCPUs on a single node. Skip `redis-shared-core-nano`, which has variable performance and no SLA. Point LiteLLM at the cluster with the [Redis Cluster config](./caching.md#redis-cluster).

</TabItem>
</Tabs>

## What to monitor

Watch memory used against `maxmemory` and the eviction counter, since evictions are silent correctness loss here rather than a cache-hit-rate problem. On the LiteLLM side the useful Prometheus signals are `litellm_redis_spend_update_queue_size` and `litellm_in_memory_spend_update_queue_size` for spend updates that are queued rather than written, and `litellm_pod_lock_manager_size` for which pod currently holds the transaction buffer flush lock. Client connection count matters too: each managed offering caps connections per instance size, and the gateway opens pools per worker.
