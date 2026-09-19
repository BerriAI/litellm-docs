---
title: Redis and Valkey Cache
description: Credentials, namespaces, ACL users, cluster and sentinel topologies, and TLS for the LiteLLM proxy's Redis cache.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Redis and Valkey Cache

Redis is LiteLLM's default cache and the only one shared across workers and replicas. Valkey, AWS
ElastiCache and GCP Memorystore all speak the Redis protocol, so everything on this page applies to
them too.

## Connect the proxy to Redis

```yaml
model_list:
  - model_name: {{openai_small}}
    litellm_params:
      model: {{openai_small}}
  - model_name: text-embedding-ada-002
    litellm_params:
      model: text-embedding-ada-002

litellm_settings:
  set_verbose: True
  cache: True # set cache responses to True, litellm defaults to using a redis cache
```

Set either `REDIS_URL` or the `REDIS_HOST` in your os environment, to enable caching.

  ```shell
  REDIS_URL = ""        # REDIS_URL='redis://username:password@hostname:port/database'
  ## OR ## 
  REDIS_HOST = ""       # REDIS_HOST='redis-18841.c274.us-east-1-3.ec2.cloud.redislabs.com'
  REDIS_PORT = ""       # REDIS_PORT='18841'
  REDIS_PASSWORD = ""   # REDIS_PASSWORD='liteLlmIsAmazing'
  REDIS_USERNAME = ""   # REDIS_USERNAME='my-redis-username' [OPTIONAL] if your redis server requires a username
  REDIS_SSL = "True"    # REDIS_SSL='True' to enable SSL by default is False
  ```

### Additional Redis kwargs

:::info
Use `REDIS_*` environment variables to configure all Redis client library parameters. This is the suggested mechanism for toggling Redis settings as it automatically maps environment variables to Redis client kwargs.
:::

You can pass in any additional redis.Redis arg, by storing the variable + value in your os
environment, like this:

```shell
REDIS_<redis-kwarg-name> = ""
```

For example:
```shell
REDIS_SSL = "True"
REDIS_SSL_CERT_REQS = "None" 
REDIS_CONNECTION_POOL_KWARGS = '{"max_connections": 20}'
```

:::warning
**Note**: For non-string Redis parameters (like integers, booleans, or complex objects), avoid using `REDIS_*` environment variables as they may fail during Redis client initialization. Instead, use `cache_kwargs` in your router configuration for such parameters.
:::

[**See how it's read from the environment**](https://github.com/BerriAI/litellm/blob/4d7ff1b33b9991dcf38d821266290631d9bcd2dd/litellm/_redis.py#L40)

Then run the proxy:

```shell
$ litellm --config /path/to/config.yaml
```

## Coordination Redis

LiteLLM uses Redis for two independent jobs, and most deployments only need the first:

| Job | What it covers | Configured by |
| --- | --- | --- |
| **Coordination** | Rate limits and budgets, spend counters, config sync across pods, the pod lock that elects a single runner for scheduled jobs, shared health checks, CLI SSO sessions, router state | `general_settings.coordination_redis` |
| **Response caching** | Storing LLM responses so an identical request skips the provider | `litellm_settings.cache` and `cache_params` |

Any deployment running more than one worker or replica needs coordination, or each worker enforces its own private copy of every limit. See [What Needs Redis](./redis_requirements.md) for the full list of what degrades without it. Response caching is a separate, optional feature: turning on coordination does not cache any responses

### Coordination only (no response caching)

Set `general_settings.coordination_redis` and leave out the `litellm_settings.cache` block entirely:

```yaml
general_settings:
  coordination_redis:
    host: os.environ/REDIS_HOST
    port: os.environ/REDIS_PORT
    password: os.environ/REDIS_PASSWORD

litellm_settings:
  enable_redis_auth_cache: true # optional, recommended: share virtual-key auth lookups across pods
```

That covers rate limits, budgets, spend counters, cross-pod config sync, the pod lock, shared health checks, and CLI SSO sessions. It also covers router state (deployment cooldowns, `usage-based-routing-v2`, `latency-based-routing`): when `router_settings` names no Redis of its own, the proxy attaches the coordination Redis to the router. You do not need to repeat the connection under `router_settings` unless you deliberately want router state on a **different** Redis, in which case `router_settings.redis_*` wins for router state only

`enable_redis_auth_cache: true` is worth adding on any multi-pod deployment: without it each pod warms its own virtual-key auth cache against the database

### A separate Redis for coordination and response caching

The point of a dedicated `coordination_redis` block is pointing the two jobs at different servers, so cache traffic cannot evict coordination state or vice versa:

```yaml
general_settings:
  coordination_redis:
    host: os.environ/COORDINATION_REDIS_HOST
    port: 6379
    password: os.environ/COORDINATION_REDIS_PASSWORD

litellm_settings:
  cache: true
  cache_params:
    type: redis
    host: os.environ/CACHE_REDIS_HOST
    port: 6379
    password: os.environ/CACHE_REDIS_PASSWORD
```

Without a `coordination_redis` block, coordination borrows the response cache's Redis, so both jobs share one server

### Supported fields

Every field is optional on its own, but the block must name at least one connection target (`host`, `url`, `startup_nodes`, or `sentinel_nodes`) or the proxy fails to start

| Field | Type | Description |
| --- | --- | --- |
| `host` | string | Redis hostname |
| `port` | integer | Redis port |
| `username` | string | Redis username, if the server requires one |
| `password` | string | Redis password |
| `url` | string | Full connection URL, for example `redis://:pass@host:6379/1`. Use instead of the discrete host/port/username/password fields |
| `ssl` | boolean | Connect over TLS |
| `namespace` | string | Prefix for every key this client writes, so a [restricted ACL user](#restricted-acl-users-redis-7--valkey) can be scoped to `~<namespace>:*` |
| `startup_nodes` | list | Cluster-mode startup nodes, for example `[{"host": "127.0.0.1", "port": 7001}]`. When set, a Redis Cluster client is used |
| `sentinel_nodes` | list | Sentinel `[host, port]` pairs, for example `[["localhost", 26379]]`. When set, a Sentinel-managed client is used |
| `sentinel_password` | string | Password for the Sentinel nodes |
| `service_name` | string | Master service name for Sentinel |
| `aws_iam_auth` | boolean | Authenticate with [AWS ElastiCache IAM](./elasticache_iam.md) instead of a password |
| `aws_iam_user_name` | string | ElastiCache IAM user name |
| `aws_iam_cache_name` | string | ElastiCache cache name |
| `aws_iam_region` | string | AWS region for ElastiCache IAM authentication |
| `aws_iam_serverless` | boolean | The ElastiCache cache is serverless rather than a self-designed cluster |

Any other key is passed through to the Redis client, so `redis.Redis` kwargs not listed here still work

`os.environ/VAR` references are resolved at startup, but only for the block's own top-level values. A reference nested inside `startup_nodes` or `sentinel_nodes` is passed through literally, so put those values in the config directly

### How the coordination Redis is resolved

The proxy takes the first of these that produces a working client:

1. A block saved from the Admin UI, which lives in the database
2. `general_settings.coordination_redis` in config.yaml
3. The response cache's Redis, when `litellm_settings.cache_params.type` is `redis`
4. Bare `REDIS_HOST` / `REDIS_PORT` / `REDIS_URL` environment variables with no config block at all

Options 1 through 3 are deliberate, so a bad connection target fails loudly at startup. Option 4 is inferred from environment variables that may be set for an unrelated reason, so it is best-effort: the proxy pings the server once and silently falls back to per-pod in-memory state if the ping fails or the value is malformed. It also cannot carry a namespace. Prefer an explicit block in production, where a Redis that quietly went missing should be a startup failure rather than a silent loss of cross-pod enforcement

:::warning

Set the block in **either** config.yaml or the Admin UI, not both. When both exist, the database block takes over rate limiting and config sync while spend counters and CLI SSO sessions stay on the config.yaml server, which splits coordination state across two Redis servers

:::

### Manage it from the Admin UI

Proxy admins can save the block from the Admin UI under **Caching > Coordination Redis**, or over the API:

```shell
curl -X POST 'http://localhost:4000/coordination_redis/settings' \
  -H 'Authorization: Bearer sk-1234' \
  -H 'Content-Type: application/json' \
  -d '{"settings": {"host": "my-redis.internal", "port": 6379, "password": "os.environ/REDIS_PASSWORD"}}'
```

Test a connection before saving it with `POST /coordination_redis/settings/test`, and read the current settings (credentials redacted) with `GET /coordination_redis/settings`

This path writes to the database, so it needs `STORE_MODEL_IN_DB=True` and a connected database. `os.environ/VAR` references are stored as written and resolved at startup. **Saved settings apply on the next proxy restart**, not immediately. Changes are recorded in the audit log, since repointing coordination Redis moves where cross-pod rate limit and spend state lives

## Namespace

If you want to create some folder for your keys, you can set a namespace, like this:

```yaml
litellm_settings:
  cache: true
  cache_params: # set cache params for redis
    type: redis
    namespace: "litellm.caching.caching"
```

and keys will be stored like:

```
litellm.caching.caching:<hash>
```

## Restricted ACL users (Redis 7+ / Valkey)

If your security policy requires the proxy to connect as a least-privilege user instead of `default`, set a namespace (as above) and grant that user the namespace's key pattern and channel pattern plus the commands it needs:

```bash
ACL SETUSER litellm-proxy on '>your-password' '~litellm:*' '&litellm:*' +@all
```

replacing `litellm` with your namespace. With a namespace set, every key the proxy writes lives under `<namespace>:`, so `~<namespace>:*` covers all of them. Without a namespace the proxy's keys have assorted names, so there is no practical key pattern to scope an ACL to

The channel grant matters too: Redis 7+ and Valkey create ACL users with `resetchannels`, which denies all pub/sub channels. The proxy subscribes to channels for config sync and auth cache invalidation, and without `&<namespace>:*` (or `&litellm_proxy.*` when no namespace is set) your logs will repeat `No permissions to access a channel; reconnecting in 5s` every few seconds and config changes will only propagate on the periodic reload

Two more things to know when scoping ACLs:

- The `general_settings.coordination_redis` block (for pointing coordination at a different Redis than your response cache) also accepts `namespace`, so its user can be scoped the same way
- When coordination Redis is configured through `REDIS_HOST` / `REDIS_PORT` environment variables alone (no `cache_params` redis block), it cannot carry a namespace, so its keys are unprefixed and the connecting user needs an unscoped key grant

If you see `No permissions to access a key` in the proxy logs and spend tracking repeatedly logs `Restoring N transaction sets to in-memory queues`, the connecting user's ACL is missing one of the grants above. On proxy versions without [the namespace delimiter fix](https://github.com/BerriAI/litellm/pull/38403), internal keys whose literal names begin with the namespace string (for example `litellm_spend_update_buffer` under namespace `litellm`) were written outside the namespace and denied even with the grants in place; upgrade if the denied keys in your Redis `ACL LOG` show up unprefixed

## Redis Cluster

<Tabs>

<TabItem value="redis-cluster-config" label="Set on config.yaml">

```yaml
model_list:
  - model_name: "*"
    litellm_params:
      model: "*"

litellm_settings:
  cache: True
  cache_params:
    type: redis
    redis_startup_nodes: [{ "host": "127.0.0.1", "port": "7001" }]
```

</TabItem>

<TabItem value="redis-env" label="Set on .env">

You can configure redis cluster in your .env by setting `REDIS_CLUSTER_NODES` in your .env

**Example `REDIS_CLUSTER_NODES`** value

```
REDIS_CLUSTER_NODES = "[{"host": "127.0.0.1", "port": "7001"}, {"host": "127.0.0.1", "port": "7003"}, {"host": "127.0.0.1", "port": "7004"}, {"host": "127.0.0.1", "port": "7005"}, {"host": "127.0.0.1", "port": "7006"}, {"host": "127.0.0.1", "port": "7007"}]"
```

:::note

Example python script for setting redis cluster nodes in .env:

```python
# List of startup nodes
startup_nodes = [
    {"host": "127.0.0.1", "port": "7001"},
    {"host": "127.0.0.1", "port": "7003"},
    {"host": "127.0.0.1", "port": "7004"},
    {"host": "127.0.0.1", "port": "7005"},
    {"host": "127.0.0.1", "port": "7006"},
    {"host": "127.0.0.1", "port": "7007"},
]

# set startup nodes in environment variables
os.environ["REDIS_CLUSTER_NODES"] = json.dumps(startup_nodes)
print("REDIS_CLUSTER_NODES", os.environ["REDIS_CLUSTER_NODES"])
```

:::

</TabItem>

</Tabs>

## Redis Sentinel

<Tabs>

<TabItem value="redis-sentinel-config" label="Set on config.yaml">

```yaml
model_list:
  - model_name: "*"
    litellm_params:
      model: "*"

litellm_settings:
  cache: true
  cache_params:
    type: "redis"
    service_name: "mymaster"
    sentinel_nodes: [["localhost", 26379]]
    sentinel_password: "password" # [OPTIONAL]
```

</TabItem>

<TabItem value="redis-env" label="Set on .env">

You can configure redis sentinel in your .env by setting `REDIS_SENTINEL_NODES` in your .env

**Example `REDIS_SENTINEL_NODES`** value

```env
REDIS_SENTINEL_NODES='[["localhost", 26379]]'
REDIS_SERVICE_NAME = "mymaster"
REDIS_SENTINEL_PASSWORD = "password"
```

:::note

Example python script for setting redis cluster nodes in .env:

```python
# List of startup nodes
sentinel_nodes = [["localhost", 26379]]

# set startup nodes in environment variables
os.environ["REDIS_SENTINEL_NODES"] = json.dumps(sentinel_nodes)
print("REDIS_SENTINEL_NODES", os.environ["REDIS_SENTINEL_NODES"])
```

:::

</TabItem>

</Tabs>

## TTL

```yaml
litellm_settings:
  cache: true
  cache_params: # set cache params for redis
    type: redis
    ttl: 600 # will be cached on redis for 600s
    # default_in_memory_ttl: Optional[float], default is None. time in seconds.
    # default_in_redis_ttl: Optional[float], default is None. time in seconds.
```

## SSL

just set `REDIS_SSL="True"` in your .env, and LiteLLM will pick this up.

```env
REDIS_SSL="True"
```

For quick testing, you can also use REDIS_URL, eg.:

```
REDIS_URL="rediss://.."
```

but we **don't** recommend using REDIS_URL in prod. We've noticed a performance difference between
using it vs. redis_host, port, etc.

## IAM authentication

Both major managed Redis offerings can authenticate the proxy with a short-lived signed token
instead of a password, so no Redis password ever exists in your config or secret store. See
[AWS ElastiCache IAM Authentication](./elasticache_iam.md) for ElastiCache and Valkey, and
[GCP Memorystore IAM Authentication](./gcp_memorystore_iam.md) for Memorystore.

## Redis max_connections

You can set the `max_connections` parameter in your `cache_params` for Redis. This is passed directly to the Redis client and controls the maximum number of simultaneous connections in the pool. If you see errors like `No connection available`, try increasing this value:

```yaml
litellm_settings:
  cache: true
  cache_params:
    type: redis
    max_connections: 100
```

## Redis socket_timeout

The proxy cache client waits at most `socket_timeout` seconds for each Redis command before it raises a timeout. The default is **5.0 s**, set by `RedisCache.__init__` in `litellm/caching/redis_cache.py`. Set it with `cache_params.socket_timeout`; the value is passed to the Redis client as is and applies to every topology (standalone, `REDIS_URL`, cluster and Sentinel):

```yaml
litellm_settings:
  cache: true
  cache_params:
    type: redis
    socket_timeout: 1.0 # seconds per Redis command, default 5.0
```

The `REDIS_SOCKET_TIMEOUT` environment variable (default `0.1`) does not change the cache client's timeout. LiteLLM only applies it to Redis clients built without an explicit `socket_timeout`, which today is the Sentinel connection path in `litellm/_redis.py`. The proxy cache client always passes its own `socket_timeout` (the 5.0 s default or your `cache_params` value), and a caller kwarg outranks the `REDIS_*` environment mapping, so with `REDIS_SOCKET_TIMEOUT` set the cache client still runs at 5.0 s. That holds when the cache client connects through Sentinel too, since its kwarg is already present when the Sentinel default would apply. The one exception is `socket_timeout: null` in `cache_params`, which drops the kwarg and lets `REDIS_SOCKET_TIMEOUT` through

## Virtual Key Authentication Cache (Redis)

When the proxy verifies a **virtual key** (customer API key), results are cached so the database is not queried on every request. By default that cache lives **only in each worker process**, so after a deploy, new pods or extra Uvicorn workers each warm their own cache and can trigger more DB reads until warmed.

Set `litellm_settings.enable_redis_auth_cache: true` to mirror virtual-key auth data into **the proxy's coordination Redis**. Workers and replicas then share cached auth entries across the cluster

**Requirements**

- The proxy needs a [coordination Redis](#coordination-redis). Either set `general_settings.coordination_redis`, or set `litellm_settings.cache: true` with `cache_params.type: redis` (or Redis Cluster) and let coordination borrow that client. See [supported `cache_params`](./caching_settings.md#supported-cache_params-on-proxy-configyaml) and [All settings](./config_settings)
- Optionally set **`general_settings.user_api_key_cache_ttl`** (seconds): TTL applies to both the in-memory and Redis tiers when Redis auth caching is enabled, so stale keys expire consistently.

Example:

```yaml
litellm_settings:
  cache: true
  enable_redis_auth_cache: true
  cache_params:
    type: redis
    host: os.environ/REDIS_HOST
    port: 6379

general_settings:
  user_api_key_cache_ttl: 300 # optional; seconds
```

:::tip

Startup logs distinguish the two modes: with `enable_redis_auth_cache: true`, you should see a message that virtual-key lookups are shared across workers.

:::

### Cache TTL for the key object

Configure how long the in-memory cache stores the key object (prevents db requests)

```yaml
general_settings:
  user_api_key_cache_ttl: <your-number> #time in seconds
```

By default this value is set to 60s.

### Cache capacity for the key object

The in-memory tier holds 200 entries per worker by default, shared by virtual keys, teams, users, end users and memberships. With more active keys than that, entries get evicted between requests and every auth lookup falls through to the DB. Raise the cap to fit your key count:

```yaml
general_settings:
  user_api_key_cache_max_size: 5000 # entries per worker, must be a positive integer
```

The same knob is editable at runtime from the Admin UI under Settings > Router Settings > General, or via `POST /config/field/update`; the running cache is resized on the next config reload without a restart. A value set in `config.yaml` takes precedence over the DB value
