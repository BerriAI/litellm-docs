import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Coordination Redis

The proxy uses a Redis instance to share state between pods and workers. This is the **coordination Redis**, and it is configured under `general_settings.coordination_redis`, independently of the LLM response cache

Everything that has to agree across replicas rides on it:

- Cross-pod **tpm/rpm rate limits** for keys, users, teams, and end users
- **Parallel request limits** (`max_parallel_requests` and its team/key equivalents)
- **Spend tracking** through the Redis transaction buffer (`general_settings.use_redis_transaction_buffer`)
- The **pod lock manager**, which elects the single pod allowed to flush spend updates to the database
- **Shared health checks** (`general_settings.use_shared_health_check`)
- **Virtual key auth caching**, opt-in via `litellm_settings.enable_redis_auth_cache`, so workers and replicas share cached key lookups instead of each warming their own

Without it, each pod counts tokens, requests, and spend in its own process memory, so a key limited to 100 RPM effectively gets 100 RPM per pod

:::info

The coordination Redis is separate from the [response cache](./caching). The response cache is configured only under `litellm_settings.cache` / `cache_params`, and it can be a semantic cache, an S3 bucket, or nothing at all, while coordination still runs on Redis

:::

## Quick Start

```yaml showLineNumbers title="config.yaml"
general_settings:
  coordination_redis:
    host: os.environ/REDIS_HOST
    port: os.environ/REDIS_PORT
    password: os.environ/REDIS_PASSWORD
```

Every value supports `os.environ/` references. A connection URL works too, in place of host/port/password:

```yaml showLineNumbers title="config.yaml"
general_settings:
  coordination_redis:
    url: os.environ/REDIS_URL
```

:::tip

Prefer `host`, `port`, and `password` over `url` in production. See [Redis 'port', 'host', 'password'. NOT 'redis_url'](./prod#4-use-redis-porthost-password-not-redis_url)

:::

## How the coordination Redis is resolved

The proxy picks the first of these that yields a connection:

1. The explicit `general_settings.coordination_redis` block
2. The response cache, when `litellm_settings.cache_params.type` is `redis` (or Redis Cluster). Its client is borrowed for coordination
3. The `REDIS_*` environment variables, which build a standalone client: `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD`, or `REDIS_URL`. `REDIS_CLUSTER_NODES` builds a cluster client and `REDIS_SENTINEL_NODES` a sentinel-managed one, so the environment covers the same topologies as the config block. TLS comes from `REDIS_SSL` and friends

If none of the three produce a connection, coordination falls back to per-pod in-memory state, which is only correct for a single-replica deployment

Steps 2 and 3 mean existing deployments keep working untouched. Step 3 also closes a gap: a proxy configured with a semantic response cache, or no response cache, previously had no coordination Redis even when `REDIS_HOST` was set in the environment

:::warning

A `host` set in the `coordination_redis` block outranks a `REDIS_URL` exported in the environment. Earlier versions let the environment's url win and silently discard the explicit host and port, so a deployment carrying a global `REDIS_URL` alongside a `coordination_redis.host` will now connect to the host named in the block

:::

## TLS, Cluster, and Sentinel

<Tabs>

<TabItem value="tls" label="TLS">

```yaml showLineNumbers title="config.yaml"
general_settings:
  coordination_redis:
    host: os.environ/REDIS_HOST
    port: os.environ/REDIS_PORT
    password: os.environ/REDIS_PASSWORD
    ssl: true
```

</TabItem>

<TabItem value="cluster" label="Redis Cluster">

```yaml showLineNumbers title="config.yaml"
general_settings:
  coordination_redis:
    startup_nodes:
      - host: os.environ/REDIS_CLUSTER_NODE_1_HOST
        port: os.environ/REDIS_CLUSTER_NODE_1_PORT
      - host: os.environ/REDIS_CLUSTER_NODE_2_HOST
        port: os.environ/REDIS_CLUSTER_NODE_2_PORT
    password: os.environ/REDIS_PASSWORD
```

</TabItem>

<TabItem value="sentinel" label="Redis Sentinel">

```yaml showLineNumbers title="config.yaml"
general_settings:
  coordination_redis:
    sentinel_nodes:
      - ["os.environ/REDIS_SENTINEL_1_HOST", 26379]
      - ["os.environ/REDIS_SENTINEL_2_HOST", 26379]
    service_name: mymaster
    sentinel_password: os.environ/REDIS_SENTINEL_PASSWORD
```

</TabItem>

</Tabs>

## Coexisting with a semantic response cache

Because the two are configured separately, a semantic response cache and a plain coordination Redis run side by side. Point them at whichever instances you like; the semantic cache needs a vector-capable Redis, the coordination Redis does not

```yaml showLineNumbers title="config.yaml"
general_settings:
  coordination_redis:
    host: os.environ/REDIS_HOST
    port: os.environ/REDIS_PORT
    password: os.environ/REDIS_PASSWORD

litellm_settings:
  cache: true
  cache_params:
    type: redis-semantic
    similarity_threshold: 0.8
    redis_semantic_cache_embedding_model: text-embedding-ada-002
```

## Coordination Redis vs router Redis

`router_settings.redis_host` / `redis_port` / `redis_password` configures the **router's** Redis, which holds load-balancing state: deployment cooldowns, usage-based routing counters, and model-level rpm/tpm tracking

Key, user, team, and end-user rate limits, parallel request limits, spend, the pod lock, and shared health checks all live on the coordination Redis instead. When the router has no Redis of its own, the proxy attaches the coordination Redis to it, so a single `coordination_redis` block is enough for most deployments. The attach only happens in that case: an explicit `router_settings.redis_host` always wins for router state, so set it when you want routing state on a different instance

## Configure from the Admin UI

Go to the **Caching** page in the Admin UI and open the **Coordination Redis** tab. Fill in the connection details, use **Test Connection** to confirm the proxy can reach the instance, then **Save Changes**. Settings persist to the database and take effect on the next proxy restart, so a proxy with no config-file block and no `REDIS_*` environment variables can be pointed at a Redis entirely from the UI

The same settings are available over the API through `GET` and `POST /coordination_redis/settings`, with `POST /coordination_redis/settings/test` for the connection check

## Migrating from `cache: true` with `supported_call_types: []`

Older guides recommend enabling a response cache and then disabling it for every call type:

```yaml showLineNumbers title="config.yaml"
litellm_settings:
  cache: true
  cache_params:
    type: redis
    supported_call_types: [] # Optional: Set cache for proxy, but not on the actual llm api call
```

That pattern exists only to get a Redis client onto the proxy; the response cache is switched off immediately afterwards. Replace it with a `coordination_redis` block, which says what it means and leaves `litellm_settings.cache` free for actual response caching:

```yaml showLineNumbers title="config.yaml"
general_settings:
  coordination_redis:
    host: os.environ/REDIS_HOST
    port: os.environ/REDIS_PORT
    password: os.environ/REDIS_PASSWORD
```

The old form keeps working. Nothing breaks if you leave it in place
