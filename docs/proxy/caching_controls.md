---
title: Cache Controls
description: Control what the LiteLLM proxy caches and for how long, per request, per virtual key, and proxy-wide.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Cache Controls

Once caching is on it applies to every supported call type. This page covers narrowing that: per
request with a `cache` object in the body, per virtual key with key metadata, and proxy-wide with
`cache_params`.

## Dynamic Cache Controls

| Parameter   | Type             | Description                                                                       |
| ----------- | ---------------- | --------------------------------------------------------------------------------- |
| `ttl`       | _Optional(int)_  | Will cache the response for the user-defined amount of time (in seconds)          |
| `s-maxage`  | _Optional(int)_  | Will only accept cached responses that are within user-defined range (in seconds) |
| `no-cache`  | _Optional(bool)_ | Will not store the response in cache.                                             |
| `no-store`  | _Optional(bool)_ | Will not cache the response                                                       |
| `namespace` | _Optional(str)_  | Will cache the response under a user-defined namespace                            |

Each cache parameter can be controlled on a per-request basis. Here are examples for each parameter:

### `ttl`

Set how long (in seconds) to cache a response.

<Tabs>
<TabItem value="openai" label="OpenAI Python SDK">

```python
from openai import OpenAI

client = OpenAI(
    api_key="your-api-key",
    base_url="http://0.0.0.0:4000"
)

chat_completion = client.chat.completions.create(
    messages=[{"role": "user", "content": "Hello"}],
    model="{{openai_small}}",
    extra_body={
        "cache": {
            "ttl": 300  # Cache response for 5 minutes
        }
    }
)
```

</TabItem>

<TabItem value="curl" label="curl">

```shell
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-1234" \
  -d '{
    "model": "{{openai_small}}",
    "cache": {"ttl": 300},
    "messages": [
      {"role": "user", "content": "Hello"}
    ]
  }'
```

</TabItem>
</Tabs>

### `s-maxage`

Only accept cached responses that are within the specified age (in seconds).

<Tabs>
<TabItem value="openai" label="OpenAI Python SDK">

```python
from openai import OpenAI

client = OpenAI(
    api_key="your-api-key",
    base_url="http://0.0.0.0:4000"
)

chat_completion = client.chat.completions.create(
    messages=[{"role": "user", "content": "Hello"}],
    model="{{openai_small}}",
    extra_body={
        "cache": {
            "s-maxage": 600  # Only use cache if less than 10 minutes old
        }
    }
)
```

</TabItem>

<TabItem value="curl" label="curl">

```shell
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-1234" \
  -d '{
    "model": "{{openai_small}}",
    "cache": {"s-maxage": 600},
    "messages": [
      {"role": "user", "content": "Hello"}
    ]
  }'
```

</TabItem>
</Tabs>

### `no-cache`

Force a fresh response, bypassing the cache.

<Tabs>
<TabItem value="openai" label="OpenAI Python SDK">

```python
from openai import OpenAI

client = OpenAI(
    api_key="your-api-key",
    base_url="http://0.0.0.0:4000"
)

chat_completion = client.chat.completions.create(
    messages=[{"role": "user", "content": "Hello"}],
    model="{{openai_small}}",
    extra_body={
        "cache": {
            "no-cache": True  # Skip cache check, get fresh response
        }
    }
)
```

</TabItem>

<TabItem value="curl" label="curl">

```shell
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-1234" \
  -d '{
    "model": "{{openai_small}}",
    "cache": {"no-cache": true},
    "messages": [
      {"role": "user", "content": "Hello"}
    ]
  }'
```

</TabItem>
</Tabs>

### `no-store`

Will not store the response in cache.

<Tabs>
<TabItem value="openai" label="OpenAI Python SDK">

```python
from openai import OpenAI

client = OpenAI(
    api_key="your-api-key",
    base_url="http://0.0.0.0:4000"
)

chat_completion = client.chat.completions.create(
    messages=[{"role": "user", "content": "Hello"}],
    model="{{openai_small}}",
    extra_body={
        "cache": {
            "no-store": True  # Don't cache this response
        }
    }
)
```

</TabItem>

<TabItem value="curl" label="curl">

```shell
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-1234" \
  -d '{
    "model": "{{openai_small}}",
    "cache": {"no-store": true},
    "messages": [
      {"role": "user", "content": "Hello"}
    ]
  }'
```

</TabItem>
</Tabs>

### `namespace`

Store the response under a specific cache namespace.

<Tabs>
<TabItem value="openai" label="OpenAI Python SDK">

```python
from openai import OpenAI

client = OpenAI(
    api_key="your-api-key",
    base_url="http://0.0.0.0:4000"
)

chat_completion = client.chat.completions.create(
    messages=[{"role": "user", "content": "Hello"}],
    model="{{openai_small}}",
    extra_body={
        "cache": {
            "namespace": "my-custom-namespace"  # Store in custom namespace
        }
    }
)
```

</TabItem>

<TabItem value="curl" label="curl">

```shell
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-1234" \
  -d '{
    "model": "{{openai_small}}",
    "cache": {"namespace": "my-custom-namespace"},
    "messages": [
      {"role": "user", "content": "Hello"}
    ]
  }'
```

</TabItem>
</Tabs>

## Per-key cache controls

Set the `cache` field in a virtual key's metadata and the proxy applies it to every request made
with that key, so clients need no changes. This is the usual way to keep one class of traffic out of
the cache while leaving it on everywhere else.

```shell
curl http://localhost:4000/key/generate \
  -H "Authorization: Bearer sk-1234" \
  -H "Content-Type: application/json" \
  -d '{
    "metadata": {"cache": {"no-cache": true}}
  }'
```

Supported key-level cache controls: `ttl`, `s-maxage`, `no-cache`, `no-store`.

## Set caching default off (opt in only)

1. **Set `mode: default_off` for caching**

```yaml
model_list:
  - model_name: fake-openai-endpoint
    litellm_params:
      model: openai/fake
      api_key: fake-key
      api_base: https://exampleopenaiendpoint-production.up.railway.app/

# default off mode
litellm_settings:
  set_verbose: True
  cache: True
  cache_params:
    mode: default_off # 👈 Key change cache is default_off
```

2. **Opting in to cache when cache is default off**

<Tabs>
<TabItem value="openai" label="OpenAI Python SDK">

```python
import os
from openai import OpenAI

client = OpenAI(api_key="<litellm-api-key>", base_url="http://0.0.0.0:4000")

chat_completion = client.chat.completions.create(
    messages=[
        {
            "role": "user",
            "content": "Say this is a test",
        }
    ],
    model="{{openai_small}}",
    extra_body = {        # OpenAI python accepts extra args in extra_body
        "cache": {"use-cache": True}
    }
)
```

</TabItem>

<TabItem value="curl" label="curl">

```shell
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-1234" \
  -d '{
    "model": "{{openai_small}}",
    "cache": {"use-cache": True}
    "messages": [
      {"role": "user", "content": "Say this is a test"}
    ]
  }'
```

</TabItem>

</Tabs>

## Control Call Types Caching is on for - (`/chat/completion`, `/embeddings`, etc.)

By default, caching is on for all call types. You can control which call types caching is on for by
setting `supported_call_types` in `cache_params`

**Cache will only be on for the call types specified in `supported_call_types`**

```yaml
litellm_settings:
  cache: True
  cache_params:
    type: redis
    supported_call_types:
      ["acompletion", "atext_completion", "aembedding", "atranscription"]
      # /chat/completions, /completions, /embeddings, /audio/transcriptions
```

## Set cache for proxy, but not on the actual llm api call

Use this if you just want to enable features like rate limiting, and loadbalancing across multiple
instances.

Set `supported_call_types: []` to disable caching on the actual api call.

```yaml
litellm_settings:
  cache: True
  cache_params:
    type: redis
    supported_call_types: []
```

## Deleting Cache Keys - `/cache/delete`

To delete a cache key, send a request to `/cache/delete` with the `keys` you want to delete

Example

```shell
curl -X POST "http://0.0.0.0:4000/cache/delete" \
  -H "Authorization: Bearer sk-1234" \
  -d '{"keys": ["586bf3f3c1bf5aecb55bd9996494d3bbc69eb58397163add6d49537762a7548d", "key2"]}'
```

```shell
# {"status":"success"}
```

### Viewing Cache Keys from responses

You can view the cache_key in the response headers, on cache hits the cache key is sent as the
`x-litellm-cache-key` response headers

```shell
curl -i --location 'http://0.0.0.0:4000/chat/completions' \
    --header 'Authorization: Bearer sk-1234' \
    --header 'Content-Type: application/json' \
    --data '{
    "model": "{{openai_small}}",
    "user": "ishan",
    "messages": [
        {
        "role": "user",
        "content": "what is litellm"
        }
    ],
}'
```

Response from litellm proxy

```text
date: Thu, 04 Apr 2024 17:37:21 GMT
content-type: application/json
x-litellm-cache-key: 586bf3f3c1bf5aecb55bd9996494d3bbc69eb58397163add6d49537762a7548d

{
    "id": "chatcmpl-9ALJTzsBlXR9zTxPvzfFFtFbFtG6T",
    "choices": [
        {
            "finish_reason": "stop",
            "index": 0,
            "message": {
                "content": "I'm sorr.."
                "role": "assistant"
            }
        }
    ],
    "created": 1712252235,
}

```

## Provider-Specific Optional Parameters Caching

By default, LiteLLM only includes standard OpenAI parameters in cache keys. However, some providers (like Vertex AI) use additional parameters that affect the output but aren't included in the standard cache key generation.

### Enable Provider-Specific Parameter Caching

Add this setting to your `config.yaml` to include provider-specific optional parameters in cache keys:

```yaml
litellm_settings:
  cache: True
  cache_params:
    type: "redis"
  enable_caching_on_provider_specific_optional_params: True  # Include provider-specific params in cache keys
```
