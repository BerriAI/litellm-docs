---
title: Sizing & Scaling
sidebar_label: Overview
description: Plan gateway, PostgreSQL, and Redis capacity for LiteLLM, then configure autoscaling for your traffic.
---

# Sizing & Scaling

{/* keep-version-note */}

Size three parts of your deployment together: the LiteLLM gateway handles requests, PostgreSQL stores keys and usage, and Redis shares state across workers. Adding gateway replicas helps only if the database and Redis can handle the extra load.

Start with your expected request rate, token volume, and number of concurrent streams. Test with the models and response lengths your applications use; a long stream keeps a connection open even when gateway CPU use is low.

## Choose a guide

| What you need to decide | Guide |
| --- | --- |
| Gateway CPU, memory, and worker count | [Sizing and workers](../prod.md#sizing-and-workers) |
| Database compute, storage, and connection limits | [Database Sizing](../db_sizing.md) |
| Which features need shared state | [What Needs Redis](../redis_requirements.md) |
| Redis memory and connection capacity | [Redis Sizing](../redis_sizing.md) |
| When to add or remove gateway replicas | [Autoscaling](./autoscaling.md) |
| How to reduce database pressure at high traffic | [High-Throughput Deployment](../high_throughput.md) |
| How to send database reads to a replica | [Database Read Replica](../db_read_replica.md) |
| How to tune workers, shutdown, and the server | [Server Tuning](../server_tuning.md) |

## Set a baseline

On Kubernetes, start with one worker per pod and scale by adding pods. Use the [production resource guidance](../prod.md#sizing-and-workers) as a starting point, then measure latency, errors, memory, and open connections under your own traffic. The [benchmarks](../../benchmarks.md) include test configurations for comparison.

Configure [Redis](../redis_requirements.md#configure-redis) before you add workers or replicas so they share limits, cache invalidations, and routing state.

## Bound the database connections

Each worker has its own connection pool. Plan for the maximum number of replicas your autoscaler can start:

```text
pool limit × workers per replica × maximum replicas
```

Leave room for management services, migrations, and other database clients. Use [database sizing](../db_sizing.md#connections-break-before-cpu-does) to set pool and replica limits before you enable autoscaling.

## Scale and measure again

Use the [autoscaling guide](./autoscaling.md) for Helm HPA and KEDA settings, request and token metrics, and the AWS and Google Cloud scaling options. Watch database connections and spend-update queues as traffic grows; more gateway replicas cannot fix a database write bottleneck.

To distribute traffic across regions or isolate deployments, see [Reference Architectures](./architecture.md).
