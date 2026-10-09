# Hosted Cache - api.litellm.ai (removed)

The hosted cache backed by api.litellm.ai has been removed from LiteLLM. `"hosted"` is not a valid `Cache(type=...)` value, and passing it leaves the cache without a backend, so the next `completion()` call raises `AttributeError: 'Cache' object has no attribute 'cache'`

Use one of the supported backends instead: `local` (the default, in memory), `redis`, `redis-semantic`, `valkey-semantic`, `qdrant-semantic`, `s3`, `gcs`, `azure-blob` or `disk`. See [Caching - In-Memory, Redis, s3, gcs, Redis Semantic Cache, Disk](./all_caches.md) for setup of each one. The examples below use the default in-memory cache

## Quick Start Usage - Completion
```python
import litellm
from litellm import completion
from litellm.caching.caching import Cache
litellm.cache = Cache() # in-memory cache

# Make completion calls
response1 = completion(
    model="{{openai_small}}", 
    messages=[{"role": "user", "content": "Tell me a joke."}],
    caching=True
)

response2 = completion(
    model="{{openai_small}}", 
    messages=[{"role": "user", "content": "Tell me a joke."}],
    caching=True
)
# response1 == response2, response 1 is cached
```


## Usage - Embedding()

```python
import time
import litellm
from litellm import completion, embedding
from litellm.caching.caching import Cache
litellm.cache = Cache()

start_time = time.time()
embedding1 = embedding(model="text-embedding-ada-002", input=["hello from litellm"*5], caching=True)
end_time = time.time()
print(f"Embedding 1 response time: {end_time - start_time} seconds")

start_time = time.time()
embedding2 = embedding(model="text-embedding-ada-002", input=["hello from litellm"*5], caching=True)
end_time = time.time()
print(f"Embedding 2 response time: {end_time - start_time} seconds")
```

## Caching with Streaming 
LiteLLM can cache your streamed responses for you

### Usage
```python
import litellm
import time
from litellm import completion
from litellm.caching.caching import Cache

litellm.cache = Cache()

# Make completion calls
response1 = completion(
    model="{{openai_small}}", 
    messages=[{"role": "user", "content": "Tell me a joke."}], 
    stream=True,
    caching=True)
for chunk in response1:
    print(chunk)

time.sleep(1) # cache is updated asynchronously

response2 = completion(
    model="{{openai_small}}", 
    messages=[{"role": "user", "content": "Tell me a joke."}], 
    stream=True,
    caching=True)
for chunk in response2:
    print(chunk)
```
