---
title: Set Up Redis
description: How to run Redis with the LiteLLM proxy and point the proxy at it, for multi-pod deployments.
---

# Set Up Redis

Redis is what makes a multi-pod LiteLLM deployment behave like one gateway. Rate limits, budgets, router state, cached responses and cache invalidation all live in it, so every pod enforces the same numbers instead of its own copy. Run it as soon as you run more than one worker process, which includes a single container started with `--num_workers` above 1. For the list of what degrades without it, see [What Needs Redis](./redis_requirements.md).

## Get a Redis

Use Redis 7.0 or newer, in the same region and VPC as the proxy, since every request path that touches Redis pays the round trip. A managed instance is the usual choice in production; for how big it needs to be and which SKU to pick on AWS, Azure or GCP, see [Redis Sizing](./redis_sizing.md). Enable TLS and in-transit encryption, keep it private to the VPC, and set a password.

Self-hosting is fine too. On Kubernetes, the Bitnami Redis chart with one primary and replicas is enough:

```bash
helm install litellm-redis oci://registry-1.docker.io/bitnamicharts/redis \
  --set architecture=replication \
  --set auth.password="$REDIS_PASSWORD"
```

Locally, or for testing that the proxy picks Redis up at all:

```bash
docker run -d --name litellm-redis -p 6379:6379 redis:7
```

## Point the proxy at it

Put the credentials in the environment:

```env
REDIS_HOST="litellm-redis.abc123.ng.0001.use1.cache.amazonaws.com"
REDIS_PORT="6379"
REDIS_PASSWORD="..."
REDIS_SSL="True"
```

Then reference them from `config.yaml`. Setting the environment variables alone is not enough: the proxy reads them only where the config points at Redis.

```yaml
router_settings:
  redis_host: os.environ/REDIS_HOST
  redis_port: os.environ/REDIS_PORT
  redis_password: os.environ/REDIS_PASSWORD

litellm_settings:
  cache: True
  cache_params:
    type: redis
    host: os.environ/REDIS_HOST
    port: os.environ/REDIS_PORT
    password: os.environ/REDIS_PASSWORD
```

The two blocks cover different things and you want both. `router_settings` gives the router its own Redis for cooldowns and for usage-based and latency-based routing. The cache block gives the proxy its response cache and, from it, the coordination Redis behind rate limits, budgets, cache invalidation, the pod lock and scheduled jobs.

If you do not want a response cache, or you want coordination on a different Redis than the one serving cached responses, configure coordination explicitly and leave the cache block out:

```yaml
general_settings:
  coordination_redis:
    host: os.environ/REDIS_HOST
    port: os.environ/REDIS_PORT
    password: os.environ/REDIS_PASSWORD
```

It takes a connection target as `host`, `url`, `startup_nodes` or `sentinel_nodes`, and it wins over the response-cache Redis. You can also set the same block from the Admin UI, at http://localhost:4000/ui/?page=settings, which persists it to the database and applies it on the next restart.

For cluster and sentinel topologies, TLS details, TTLs, namespaces and GCP IAM authentication, see [Caching](./caching.md). Prefer discrete `host` and `port` over a single `REDIS_URL` in production; we have measured a performance difference between them.

## Check that it worked

Ask the proxy what it resolved:

```bash
curl -s http://localhost:4000/health/readiness/details \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" | jq '{cache, show_no_redis_warning}'
```

`show_no_redis_warning` comes back `false` and `cache` names your Redis once coordination is wired up. The Admin UI stops showing its "No Redis configured" banner at the same point. You can also watch keys appear while you send traffic:

```bash
redis-cli -h "$REDIS_HOST" -a "$REDIS_PASSWORD" --scan --pattern '*' | head
```

## Once it is running

Above roughly 1000 requests per second or 10 instances, also route spend writes through Redis with the [Redis transaction buffer](./prod.md#redis-transaction-buffer), and keep the default `simple-shuffle` routing strategy, since usage-based routing adds a Redis lookup to the request path. [Redis Sizing](./redis_sizing.md) covers what to watch once it is carrying traffic, including the eviction counter and the `litellm_redis_*` queue-depth metrics.
