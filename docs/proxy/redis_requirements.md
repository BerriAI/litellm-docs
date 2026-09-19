---
title: What Needs Redis
description: Features that do not work, or do not work correctly, when the LiteLLM proxy runs without Redis.
---

# What Needs Redis

Redis is highly recommended for any LiteLLM proxy deployment that runs more than one worker process, and most deployments do: a single container with `--num_workers` above 1 already counts, as does any Kubernetes deployment with more than one replica.

Almost everything the proxy enforces (rate limits, budgets, cooldowns, cache hits, config changes) is coordinated through state. With Redis, that state is shared, so every worker sees the same counters and the same invalidations. Without it, each worker keeps its own copy in memory, so a limit of 100 requests per minute across 4 workers really lets through 400, a revoked key stays usable on the workers that did not process the revocation, and cache hits only land on the worker that happened to store the response.

The Admin UI shows a banner while no Redis is configured. If you deliberately run a single worker, set `LITELLM_DISABLE_NO_REDIS_WARNING=true` to hide it.

:::warning

Multi-pod deployments without Redis are in beta, and the list below is not exhaustive. It covers the best known functionality that we know does not work fully, or at all, across pods without Redis; other features may also misbehave in that setup. The GA approach for a multi-pod deployment is to run it with Redis.

:::

## Configure Redis

For provisioning Redis and wiring the proxy to it end to end, see [Set Up Redis](/docs/proxy/caching_redis). The short version:

```yaml
general_settings:
  coordination_redis:
    host: os.environ/REDIS_HOST
    port: os.environ/REDIS_PORT
    password: os.environ/REDIS_PASSWORD

litellm_settings:
  enable_redis_auth_cache: true # optional, recommended: share virtual-key auth lookups across pods
```

That one block fixes everything in the table below except response caching, which is a separate opt-in feature. It also covers router state (cooldowns, usage and latency based routing), since the router picks up the coordination Redis when `router_settings` names no Redis of its own. To cache responses as well, add a [`litellm_settings.cache` block](./caching.md); to keep the two jobs on different servers, or for cluster, sentinel and ACL details, see [Coordination Redis](./caching_redis.md#coordination-redis)

Setting `REDIS_HOST` and `REDIS_PORT` in the environment with no config block at all is a best-effort fallback rather than a supported configuration: the proxy pings that server once at startup and falls back silently to per-pod in-memory state if it cannot reach it, and those keys cannot carry a namespace. In production prefer the explicit block above, where an unreachable Redis fails startup instead of quietly dropping cross-pod enforcement

## What breaks without Redis

The most well-known functionality that is degraded or unavailable across pods:

| Feature | Without Redis |
| --- | --- |
| Key, team, user, and end-user rate limits (tpm, rpm, max parallel requests) | Counted per worker, so the effective limit is multiplied by the number of workers. |
| [Dynamic rate limits](./dynamic_rate_limit.md) and [rate limit tiers](./rate_limit_tiers.md) | Same per-worker split; a tier's share of capacity is recomputed independently on each worker. |
| Key, team, and user budgets | Spend is reserved and counted per worker, so concurrent requests on different workers can overshoot a hard budget before the database catches up. |
| [Provider budget routing](./provider_budget_routing.md) and [tag budgets](./tag_budgets.md) | Per-worker spend windows, so a provider or tag can exceed its budget by roughly the worker count. |
| `usage-based-routing-v2` and `latency-based-routing` | Routing decisions use only the traffic that worker has seen, so load balancing skews and TPM/RPM-aware placement degrades. |
| Deployment cooldowns | A deployment cooled down after failures on one worker stays in rotation on the others. |
| [Response caching](./caching.md) | Cache entries stay local to the worker that wrote them, so hit rate drops roughly by the worker count. Semantic caching needs Redis outright. |
| Virtual key and team cache invalidation | Key deletes, budget edits, and team membership changes propagate to other workers only when their local cache entry expires. |
| Config changes stored in the database (models added, deleted, or edited in the UI, and settings changes) | Other workers pick them up on their next periodic reload instead of immediately. |
| [Redis transaction buffer](./prod.md#redis-transaction-buffer) for spend writes | Unavailable. Every worker writes spend updates directly to the database, which is the failure mode that buffer exists to prevent at high traffic. |
| Scheduled jobs (budget resets, spend log cleanup, key rotation, expired session cleanup, database spend flush) | The pod lock that elects a single runner needs Redis, so every worker runs the job and they contend on the same rows. |
| [Shared health checks](./shared_health_check.md) | Every worker runs its own background health checks against every deployment, multiplying provider health traffic. |
| [Request prioritization](../scheduler.md) | The priority queue is per worker, so ordering only holds among requests that land on the same worker. |
| SSO and `litellm login` from the CLI | The login flow can fail when the browser redirect lands on a different worker than the one that started it. |
| [MCP](../mcp_oauth.md) outbound OAuth credentials | Tokens are cached per worker, so each worker refreshes independently; a provider that rotates refresh tokens on use can invalidate the others. |
| Background responses and polling | A polled response is readable only on the worker that produced it. |

## Single worker deployments

None of the above applies if you truly run one worker process and one replica, since local memory is shared state in that case. That setup gives up horizontal scaling and any restart drops all cached state, so treat it as a development or low-volume configuration rather than a production one.
