# GigaChat

Pass-through endpoints for GigaChat - call the provider-specific endpoint in native format (no translation).

| Feature | Supported | Notes |
|-------|-------|-------|
| Cost Tracking | ✅ | supported for `/chat/completions` and `/embeddings` |
| Logging | ✅ | works across all integrations |
| Streaming | ✅ | |

Just replace `https://gigachat.devices.sberbank.ru/api/v1` with `LITELLM_PROXY_BASE_URL/gigachat`

## Quick Start

1. Add your GigaChat credentials to your environment

```bash
export GIGACHAT_CREDENTIALS="your-authorization-key"

# Optional: defaults to GIGACHAT_API_PERS
export GIGACHAT_SCOPE="GIGACHAT_API_PERS"
```

Instead of credentials, you can supply a pre-issued token directly with `GIGACHAT_ACCESS_TOKEN`.

:::info

The GigaChat API is served with certificates from the Russian Trusted Root CA, which most systems do not trust by default. Either [install the certificate chain](https://developers.sber.ru/docs/ru/gigachat/certificates) or run the proxy with `ssl_verify: false`.

:::

2. Start LiteLLM Proxy

```bash
litellm

# RUNNING on http://0.0.0.0:4000
```

3. Test it!

```bash
curl -L -X POST 'http://0.0.0.0:4000/gigachat/chat/completions' \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer sk-1234' \
-d '{
    "model": "GigaChat-2",
    "messages": [{"role": "user", "content": "Hello!"}]
}'
```

## Examples

Anything after `http://0.0.0.0:4000/gigachat` is treated as a provider-specific route, and handled accordingly.

Key Changes:

| **Original Endpoint**                                | **Replace With**                  |
|------------------------------------------------------|-----------------------------------|
| `https://gigachat.devices.sberbank.ru/api/v1`          | `http://0.0.0.0:4000/gigachat` (LITELLM_PROXY_BASE_URL="http://0.0.0.0:4000")      |
| `bearer $GIGACHAT_ACCESS_TOKEN`                                 | `bearer anything` (use `bearer LITELLM_VIRTUAL_KEY` if Virtual Keys are setup on proxy)                    |

### **Example 1: Chat completions (streaming)**

```bash
curl -L -X POST 'http://0.0.0.0:4000/gigachat/chat/completions' \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer $LITELLM_API_KEY' \
-d '{
    "model": "GigaChat-2",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": true
}'
```

### **Example 2: Embeddings**

```bash
curl -L -X POST 'http://0.0.0.0:4000/gigachat/embeddings' \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer $LITELLM_API_KEY' \
-d '{
    "model": "EmbeddingsGigaR",
    "input": ["Hello!"]
}'
```

### **Example 3: List models**

```bash
curl -L -X GET 'http://0.0.0.0:4000/gigachat/models' \
-H 'Authorization: Bearer $LITELLM_API_KEY'
```
