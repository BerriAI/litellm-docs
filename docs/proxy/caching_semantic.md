---
title: Semantic Caching
description: Serve cached LLM responses for prompts that are similar but not identical, and the traffic shapes where that goes wrong.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Semantic Caching

A semantic cache embeds the prompt and serves the closest cached response whose cosine similarity
clears `similarity_threshold`, so it can hit on prompts that are similar rather than identical.
LiteLLM supports three backends for it: Qdrant, Valkey and Redis. A response served from a semantic
cache carries an `x-litellm-semantic-similarity` header.

:::warning

Semantic caching is designed for single-shot prompts. On multi-turn or agentic traffic it will
replay stale responses. Read
[Semantic Caching and Multi-Turn Agentic Traffic](#semantic-caching-and-multi-turn-agentic-traffic)
before enabling it for those workloads.

:::

## Qdrant

Caching can be enabled by adding the `cache` key in the `config.yaml`

### Step 1: Add `cache` to the config.yaml

```yaml
model_list:
  - model_name: fake-openai-endpoint
    litellm_params:
      model: openai/fake
      api_key: fake-key
      api_base: https://exampleopenaiendpoint-production.up.railway.app/
  - model_name: openai-embedding
    litellm_params:
      model: openai/text-embedding-3-small
      api_key: os.environ/OPENAI_API_KEY

litellm_settings:
  set_verbose: True
  cache: True # set cache responses to True, litellm defaults to using a redis cache
  cache_params:
    type: qdrant-semantic
    qdrant_semantic_cache_embedding_model: openai-embedding # the model should be defined on the model_list
    qdrant_collection_name: test_collection
    qdrant_quantization_config: binary
    qdrant_semantic_cache_vector_size: 1536 # vector size must match embedding model dimensionality
    similarity_threshold: 0.8 # similarity threshold for semantic cache
```

### Step 2: Add Qdrant Credentials to your .env

```shell
QDRANT_API_KEY = "16rJUMBRx*************"
QDRANT_API_BASE = "https://5392d382-45*********.cloud.qdrant.io"
```

### Step 3: Run proxy with config

```shell
$ litellm --config /path/to/config.yaml
```

### Step 4. Test it

```shell
curl -i http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-1234" \
  -d '{
    "model": "fake-openai-endpoint",
    "messages": [
      {"role": "user", "content": "Hello"}
    ]
  }'
```

**Expect to see `x-litellm-semantic-similarity` in the response headers when semantic caching is
on**

## Valkey

Semantic caching on a Valkey instance running the [valkey-search](https://github.com/valkey-io/valkey-search) module, such as AWS ElastiCache for Valkey. RediSearch and RedisVL are not required.

:::info Requirements

The `valkey-search` module must be loaded (check with `MODULE LIST` / `FT._LIST`). On AWS ElastiCache, vector search needs a **node-based Valkey 8.2+ cluster**; a cluster-mode-disabled node group is supported and recommended, and a primary with read replicas is fine since only horizontal sharding is unsupported. ElastiCache **Serverless does not support vector search**. Multi-shard (cluster-mode-enabled) endpoints are not supported here, so use a cluster-mode-disabled endpoint and scale vertically.

:::

### Step 1: Add `cache` to the config.yaml

```yaml
model_list:
  - model_name: fake-openai-endpoint
    litellm_params:
      model: openai/fake
      api_key: fake-key
      api_base: https://exampleopenaiendpoint-production.up.railway.app/
  - model_name: openai-embedding
    litellm_params:
      model: openai/text-embedding-3-small
      api_key: os.environ/OPENAI_API_KEY

litellm_settings:
  set_verbose: True
  cache: True
  cache_params:
    type: valkey-semantic
    host: os.environ/VALKEY_HOST
    port: os.environ/VALKEY_PORT
    valkey_semantic_cache_embedding_model: openai-embedding # the model should be defined on the model_list
    valkey_semantic_cache_index_name: litellm_semantic_cache_index # optional
    similarity_threshold: 0.8 # similarity threshold for semantic cache
```

### Step 2: Add Valkey Credentials to your .env

```shell
VALKEY_HOST = "your-valkey-host"
VALKEY_PORT = "6379"
VALKEY_PASSWORD = "your-password" # omit for passwordless / IAM-auth clusters
```

For ElastiCache with encryption in transit (TLS), add `ssl: true` under `cache_params`, or set `cache_params.redis_url` to a `rediss://` URL instead of host and port. To run valkey-search locally, `docker run -d -p 6379:6379 valkey/valkey-bundle:8.1`.

### Step 3: Run proxy with config

```shell
$ litellm --config /path/to/config.yaml
```

### Step 4. Test it

```shell
curl -i http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-1234" \
  -d '{
    "model": "fake-openai-endpoint",
    "messages": [
      {"role": "user", "content": "Hello"}
    ]
  }'
```

**Expect to see `x-litellm-semantic-similarity` in the response headers when semantic caching is
on**

## Redis

Caching can be enabled by adding the `cache` key in the `config.yaml`

### Step 1: Add `cache` to the config.yaml

```yaml
model_list:
  - model_name: {{openai_small}}
    litellm_params:
      model: {{openai_small}}
  - model_name: azure-embedding-model
    litellm_params:
      model: azure/azure-embedding-model
      api_base: os.environ/AZURE_API_BASE
      api_key: os.environ/AZURE_API_KEY
      api_version: "2023-07-01-preview"

litellm_settings:
  set_verbose: True
  cache: True # set cache responses to True
  cache_params:
    type: "redis-semantic"
    similarity_threshold: 0.8 # similarity threshold for semantic cache
    redis_semantic_cache_embedding_model: azure-embedding-model # set this to a model_name set in model_list
```

Set the Redis credentials the same way as for an exact-match Redis cache; see
[Redis and Valkey](./caching_redis.md#connect-the-proxy-to-redis). Then run the proxy:

```shell
$ litellm --config /path/to/config.yaml
```

## Semantic Caching and Multi-Turn Agentic Traffic

Semantic caches (`redis-semantic`, `qdrant-semantic`, `valkey-semantic`) embed the text content of the entire `messages` array (system prompt included) and serve the closest cached response whose cosine similarity clears `similarity_threshold`.

This works well for single-shot prompts, but it is a poor fit for multi-turn or agentic workloads (coding agents, tool-calling loops, any client that resends the whole conversation each turn). Each new turn is the previous request plus a small appended delta, so consecutive turns are nearly identical text and their embeddings are ~0.99 similar. At any practical threshold, every turn matches the previous turn's cached entry and the client replays a stale response, which typically shows up as an agent repeating the same tool call over and over. Raising `similarity_threshold` does not reliably fix this. Assistant `tool_calls` are also not part of the embedded text, which makes consecutive agent turns even harder to tell apart.

The recommendation is to keep semantic caching for single-shot traffic and exclude agentic traffic.
The cheapest way is to set `"cache": {"no-cache": true}` in the metadata of the virtual keys your
agents use, which the proxy applies to every request on that key with no client-side change; see
[per-key cache controls](./caching_controls.md#per-key-cache-controls). You can also make caching
opt-in for everyone with
[`mode: default_off`](./caching_controls.md#set-caching-default-off-opt-in-only), or have the client
opt out per request with [dynamic cache controls](./caching_controls.md#dynamic-cache-controls).

If you still want caching for agentic traffic, use an exact-match cache (`type: redis`) instead: it
keys on a hash of the full request, so any change to the conversation is a cache miss and stale
replays cannot happen.

:::note

Caching only runs on the call types listed in `supported_call_types` (OpenAI-compatible surfaces such as `/chat/completions`, `/completions`, `/embeddings`, `/responses`). Requests on `/v1/messages` (Anthropic format) and provider passthrough routes never go through the cache.

:::

## Semantic Caching and End-User Isolation

A semantic cache key deliberately leaves the prompt out, so the only thing keeping two callers apart is the tenant scope: the virtual key, its team and its organization. Every end user behind one virtual key therefore shares one semantic bucket by default, and a response generated for one of them (tool calls included) can be served to another who sends a semantically similar prompt through the same key.

Set `semantic_cache_scope: end_user` under `cache_params` to also isolate buckets per end user. The end-user id is the one the proxy authenticates for the request (`user_api_key_end_user_id`): the `x-litellm-customer-id` header, a configured `user_header_name`, or the request `user` field. It is read from both `metadata` and `litellm_metadata`, so `/v1/chat/completions`, `/v1/responses` and `/v1/messages` are all covered. A request that carries no end-user id falls back to the key/team/org bucket rather than landing in a shared empty one. The default, `key`, keeps today's key/team/org scope.

```yaml
litellm_settings:
  cache: true
  cache_params:
    type: redis-semantic
    similarity_threshold: 0.8
    redis_semantic_cache_embedding_model: my-embedding-model
    semantic_cache_scope: end_user # key (default) | end_user
```

The same setting is available in the Admin UI under Caching -> Cache Settings as "Semantic Cache Scope" when the cache type is `redis-semantic`.

## Semantic Caching and a Slow Embedding Endpoint

A semantic cache embeds the prompt before every request, and that embedding call runs inline, so the request cannot reach the LLM until it finishes. LiteLLM caps it at 5 seconds. Past the deadline the lookup is abandoned, the response carries `x-litellm-semantic-similarity: 0.0`, and the request proceeds to the model as a cache miss. An embedding endpoint that is unreachable or hanging therefore costs a few seconds instead of stalling the request.

Raise the deadline if your embedding endpoint is legitimately slower than that, either per cache with `semantic_cache_embedding_timeout` under `cache_params` or globally with the `SEMANTIC_CACHE_EMBEDDING_TIMEOUT_SECONDS` environment variable.

```yaml
litellm_settings:
  cache: true
  cache_params:
    type: redis-semantic
    similarity_threshold: 0.8
    redis_semantic_cache_embedding_model: my-embedding-model
    semantic_cache_embedding_timeout: 10.0
```

Bear in mind that a higher deadline is how long every request waits when the embedding endpoint stops answering, so keep it close to the endpoint's real latency.
