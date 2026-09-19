# xAI (Grok)

Pass-through endpoints for xAI - call provider-specific endpoint, in native format (no translation).

| Feature | Supported | Notes |
|-------|-------|-------|
| Cost Tracking | ❌ | Not supported |
| Logging | ✅ | works across all integrations |
| End-user Tracking | ❌ | [Tell us if you need this](https://github.com/BerriAI/litellm/issues/new) |
| Streaming | ✅ | |

Just replace `https://api.x.ai` with `LITELLM_PROXY_BASE_URL/xai` 🚀

#### **Example Usage**

```bash
curl -L -X POST 'http://0.0.0.0:4000/xai/v1/responses' \
-H 'Content-Type: application/json' \
-H "Authorization: Bearer $LITELLM_API_KEY" \
-d '{
    "model": "grok-4.20",
    "input": "I am going to Paris, what should I see?"
}'
```

Supports **ALL** xAI Endpoints (including streaming).

## Quick Start

Let's call the xAI [`/v1/responses` endpoint](https://docs.x.ai/docs/api-reference)

1. Add XAI_API_KEY to your environment

```bash
export XAI_API_KEY="xai-<your-xai-api-key>"
```

2. Start LiteLLM Proxy

```bash
litellm

# RUNNING on http://0.0.0.0:4000
```

3. Test it!

```bash
curl -L -X POST 'http://0.0.0.0:4000/xai/v1/responses' \
-H 'Content-Type: application/json' \
-H "Authorization: Bearer $LITELLM_API_KEY" \
-d '{
    "model": "grok-4.20",
    "input": "I am going to Paris, what should I see?"
}'
```

## Examples

Anything after `http://0.0.0.0:4000/xai` is treated as a provider-specific route, and handled accordingly.

Key Changes:

| **Original Endpoint**                                | **Replace With**                  |
|------------------------------------------------------|-----------------------------------|
| `https://api.x.ai`          | `http://0.0.0.0:4000/xai` (LITELLM_PROXY_BASE_URL="http://0.0.0.0:4000")      |
| `bearer $XAI_API_KEY`                                 | `bearer anything` (use `bearer LITELLM_VIRTUAL_KEY` if Virtual Keys are setup on proxy)                    |

### **Example 1: Responses API**

#### LiteLLM Proxy Call

```bash
curl -L -X POST 'http://0.0.0.0:4000/xai/v1/responses' \
-H 'Content-Type: application/json' \
-H "Authorization: Bearer $LITELLM_API_KEY" \
-d '{
    "model": "grok-4.20",
    "input": "I am going to Paris, what should I see?"
}'
```

#### Direct xAI API Call

```bash
curl -L -X POST 'https://api.x.ai/v1/responses' \
-H 'Content-Type: application/json' \
-H "Authorization: Bearer $XAI_API_KEY" \
-d '{
    "model": "grok-4.20",
    "input": "I am going to Paris, what should I see?"
}'
```

### **Example 2: Chat API**

#### LiteLLM Proxy Call

```bash
curl -L -X POST 'http://0.0.0.0:4000/xai/v1/chat/completions' \
-H 'Content-Type: application/json' \
-H "Authorization: Bearer $LITELLM_API_KEY" \
-d '{
    "model": "grok-4.20",
    "messages": [
        {
            "role": "user",
            "content": "I am going to Paris, what should I see?"
        }
    ],
    "max_tokens": 2048
}'
```

#### Direct xAI API Call

```bash
curl -L -X POST 'https://api.x.ai/v1/chat/completions' \
-H 'Content-Type: application/json' \
-H "Authorization: Bearer $XAI_API_KEY" \
-d '{
    "model": "grok-4.20",
    "messages": [
        {
            "role": "user",
            "content": "I am going to Paris, what should I see?"
        }
    ],
    "max_tokens": 2048
}'
```

### **Example 3: OpenAI SDK pointed at the pass-through**

xAI's API is OpenAI-compatible, so the OpenAI SDK works against the pass-through with only the base URL and the key changed.

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://0.0.0.0:4000/xai/v1",
    api_key="sk-<your-litellm-virtual-key>",
)

response = client.responses.create(
    model="grok-4.20",
    input="I am going to Paris, what should I see?",
)

print(response.output_text)
```

## Advanced - Use with Virtual Keys

Pre-requisites
- [Setup proxy with DB](../proxy/virtual_keys.md#setup)

Use this, to avoid giving developers the raw xAI API key, but still letting them use xAI endpoints.

### Usage

1. Setup environment

```bash
export DATABASE_URL=""
export LITELLM_MASTER_KEY=""
export XAI_API_KEY=""
```

```bash
litellm

# RUNNING on http://0.0.0.0:4000
```

2. Generate virtual key

```bash
curl -X POST 'http://0.0.0.0:4000/key/generate' \
-H "Authorization: Bearer $LITELLM_MASTER_KEY" \
-H 'Content-Type: application/json' \
-d '{}'
```

Expected Response

```bash
{
    "key": "sk-<virtual-key>"
}
```

3. Test it!

```bash
curl -L -X POST 'http://0.0.0.0:4000/xai/v1/responses' \
-H 'Content-Type: application/json' \
-H "Authorization: Bearer sk-<virtual-key>" \
-d '{
    "model": "grok-4.20",
    "input": "I am going to Paris, what should I see?"
}'
```

## Advanced - Point the pass-through somewhere else

The route sends requests to `https://api.x.ai` by default. Set `XAI_API_BASE` to send them to a different host, for example an xAI-compatible gateway of your own. The version prefix stays in the client's path, so `/xai/v1/responses` against `XAI_API_BASE="https://xai.example.com/gateway"` becomes `https://xai.example.com/gateway/v1/responses`

```bash
export XAI_API_BASE="https://xai.example.com/gateway"
```
