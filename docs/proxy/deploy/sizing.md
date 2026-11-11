---
title: Sizing & Scaling
sidebar_label: Overview
description: Plan gateway, PostgreSQL, and Redis capacity for LiteLLM, then configure autoscaling for your traffic.
---

# Sizing & Scaling

{/* keep-version-note */}

Size the gateway, PostgreSQL, and Redis together. The gateway handles requests. PostgreSQL stores keys and usage. Redis shares state across workers. Extra gateway replicas help only if PostgreSQL and Redis can handle the extra load.

Start with your expected request rate, token volume, and number of concurrent streams. Test with the models and response lengths your applications use. A long stream keeps a connection open even when gateway CPU use is low.

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

## Bound the database connections

Each worker has its own connection pool. Plan for the maximum number of replicas your autoscaler can start:

```text
pool limit × workers per replica × maximum replicas
```

Leave room for management services, migrations, and other database clients. Use [database sizing](../db_sizing.md#connections-break-before-cpu-does) to set pool and replica limits before you enable autoscaling.
