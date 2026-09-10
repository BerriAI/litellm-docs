---
title: Caching
description: Cache LLM responses on the LiteLLM proxy to cut spend and latency.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Caching

:::note

For OpenAI/Anthropic Prompt Caching, go [here](../completion/prompt_caching.md)

:::

Cache LLM Responses. LiteLLM's caching system stores and reuses LLM responses to save costs and
reduce latency. When you make the same request twice, the cached response is returned instead of
calling the LLM API again.

## Supported caches

| Cache | `cache_params.type` | Setup |
| --- | --- | --- |
| Redis, Valkey, ElastiCache, Memorystore | `redis` | [Redis and Valkey](./caching_redis.md) |
| Redis semantic | `redis-semantic` | [Semantic caching](./caching_semantic.md) |
| Valkey semantic | `valkey-semantic` | [Semantic caching](./caching_semantic.md) |
| Qdrant semantic | `qdrant-semantic` | [Semantic caching](./caching_semantic.md) |
| S3 bucket | `s3` | [S3 and GCS](./caching_object_storage.md) |
| GCS bucket | `gcs` | [S3 and GCS](./caching_object_storage.md) |
| In memory | `local` | [below](#in-memory-and-disk-caches) |
| Disk | `disk` | [below](#in-memory-and-disk-caches) |

Redis is the right default for anything past a single worker. An in-memory cache lives inside one
worker process, so a proxy running four workers keeps four separate caches and the hit rate drops
roughly by the worker count. See [What Needs Redis](./redis_requirements.md) for the rest of what
Redis buys you.

Exact-match caches (`redis`, `s3`, `gcs`, `local`, `disk`) key on a hash of the whole request, so
any change to the conversation is a miss. Semantic caches embed the prompt and serve the closest
match above a similarity threshold, which suits single-shot prompts and goes badly wrong on agentic
traffic; read [Semantic caching](./caching_semantic.md) before turning one on.

## Quick start

### Step 1: Add `cache` to the config.yaml

Caching is enabled by adding the `cache` key to the `config.yaml`

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

### Step 2: Add Redis credentials to .env

```shell
REDIS_URL = ""        # REDIS_URL='redis://username:password@hostname:port/database'
## OR ##
REDIS_HOST = ""       # REDIS_HOST='redis-18841.c274.us-east-1-3.ec2.cloud.redislabs.com'
REDIS_PORT = ""       # REDIS_PORT='18841'
REDIS_PASSWORD = ""   # REDIS_PASSWORD='liteLlmIsAmazing'
```

For namespaces, ACL users, cluster and sentinel topologies, TLS, IAM authentication and the full
list of `REDIS_*` variables, see [Redis and Valkey](./caching_redis.md).

### Step 3: Run proxy with config

```shell
$ litellm --config /path/to/config.yaml
```

### Step 4: Test it

<Tabs>
<TabItem value="chat_completions" label="/chat/completions">

Send the same request twice:

```shell
curl http://0.0.0.0:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
     "model": "{{openai_small}}",
     "messages": [{"role": "user", "content": "write a poem about litellm!"}],
     "temperature": 0.7
   }'

curl http://0.0.0.0:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
     "model": "{{openai_small}}",
     "messages": [{"role": "user", "content": "write a poem about litellm!"}],
     "temperature": 0.7
   }'
```

</TabItem>
<TabItem value="embeddings" label="/embeddings">

Send the same request twice:

```shell
curl --location 'http://0.0.0.0:4000/embeddings' \
  --header 'Content-Type: application/json' \
  --data ' {
  "model": "text-embedding-ada-002",
  "input": ["write a litellm poem"]
  }'

curl --location 'http://0.0.0.0:4000/embeddings' \
  --header 'Content-Type: application/json' \
  --data ' {
  "model": "text-embedding-ada-002",
  "input": ["write a litellm poem"]
  }'
```

</TabItem>
</Tabs>

The second response is served from the cache. It carries an `x-litellm-cache-key` response header,
which you can feed to [`/cache/delete`](./caching_controls.md#deleting-cache-keys---cachedelete).

## In memory and disk caches

Neither needs external infrastructure, and neither is shared between workers or replicas, so use
them for local development rather than production.

<Tabs>
<TabItem value="local" label="In Memory Cache">

```yaml
litellm_settings:
  cache: True
  cache_params:
    type: local
```

</TabItem>
<TabItem value="disk" label="Disk Cache">

```yaml
litellm_settings:
  cache: True
  cache_params:
    type: disk
    disk_cache_dir: /tmp/litellm-cache # OPTIONAL, default to ./.litellm_cache
```

</TabItem>
</Tabs>

## Debugging Caching - `/cache/ping`

LiteLLM Proxy exposes a `/cache/ping` endpoint to test if the cache is working as expected

**Usage**

```shell
curl --location 'http://0.0.0.0:4000/cache/ping'  -H "Authorization: Bearer sk-1234"
```

**Expected Response - when cache healthy**

```shell
{
    "status": "healthy",
    "cache_type": "redis",
    "ping_response": true,
    "set_cache_response": "success",
    "litellm_cache_params": {
        "supported_call_types": "['completion', 'acompletion', 'embedding', 'aembedding', 'atranscription', 'transcription']",
        "type": "redis",
        "namespace": "None"
    },
    "redis_cache_params": {
        "redis_client": "Redis<ConnectionPool<Connection<host=redis-16337.c322.us-east-1-2.ec2.cloud.redislabs.com,port=16337,db=0>>>",
        "redis_kwargs": "{'url': 'redis://:******@redis-16337.c322.us-east-1-2.ec2.cloud.redislabs.com:16337'}",
        "async_redis_conn_pool": "BlockingConnectionPool<Connection<host=redis-16337.c322.us-east-1-2.ec2.cloud.redislabs.com,port=16337,db=0>>",
        "redis_version": "7.2.0"
    }
}
```

## Next steps

Tune what gets cached and for how long with [cache controls](./caching_controls.md), look up any
setting in the [`cache_params` reference](./caching_settings.md), or set up a specific backend from
the table above.
