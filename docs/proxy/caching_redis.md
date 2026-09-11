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

## Virtual Key Authentication Cache (Redis)

When the proxy verifies a **virtual key** (customer API key), results are cached so the database is not queried on every request. By default that cache lives **only in each worker process**, so after a deploy, new pods or extra Uvicorn workers each warm their own cache and can trigger more DB reads until warmed.

Set `litellm_settings.enable_redis_auth_cache: true` to mirror virtual-key auth data into **the same Redis instance** configured under `litellm_settings.cache` / `cache_params`. Workers and replicas then share cached auth entries across the cluster.

**Requirements**

- `litellm_settings.cache` must be **`true`** (Redis for the proxy is initialized during cache setup). See [All settings](./config_settings).
- `cache_params.type` must be **`redis`** (or Redis Cluster, per your cache config); the auth cache attaches to that Redis client. See [supported `cache_params`](./caching_settings.md#supported-cache_params-on-proxy-configyaml).
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

### Cache capacity for the key object

The in-memory tier holds 200 entries per worker by default, shared by virtual keys, teams, users, end users and memberships. With more active keys than that, entries get evicted between requests and every auth lookup falls through to the DB. Raise the cap to fit your key count:

```yaml
general_settings:
  user_api_key_cache_max_size: 5000 # entries per worker, must be a positive integer
```

The same knob is editable at runtime from the Admin UI under Settings > Router Settings > General, or via `POST /config/field/update`; the running cache is resized on the next config reload without a restart. A value set in `config.yaml` takes precedence over the DB value

By default this value is set to 60s.
