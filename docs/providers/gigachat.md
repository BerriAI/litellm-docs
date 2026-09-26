import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# GigaChat
https://developers.sber.ru/docs/ru/gigachat/api/overview

GigaChat is Sber AI's large language model, Russia's leading LLM provider.

:::tip

**We support ALL GigaChat models, just set `model=gigachat/<any-model-on-gigachat>` as a prefix when sending litellm requests**

:::

:::warning

GigaChat API certificates are issued under the Russian Trusted Root CA, which most trust stores do not include. Pass `ssl_verify=False` in your requests, or install the Russian Trusted Root CA certificate into your system trust store. The OAuth token exchange runs with certificate verification disabled regardless of this setting.

:::

## Supported Features

| Feature | Supported |
|---------|-----------|
| Chat Completion | Yes |
| Streaming | Yes |
| Async | Yes |
| Function Calling / Tools | Yes |
| Structured Output (JSON Schema) | Yes (via function call emulation) |
| Image Input | Yes (base64 and URL) - GigaChat-2-Max, GigaChat-2-Pro only |
| Embeddings | Yes |

## API Key

GigaChat uses OAuth authentication. LiteLLM exchanges your credentials for a short-lived access token and refreshes it automatically. Set your credentials as environment variables:

```python
import os

# Required: Set credentials (base64-encoded client_id:client_secret)
os.environ['GIGACHAT_CREDENTIALS'] = "your-credentials-here"

# Optional: Set scope (default is GIGACHAT_API_PERS for personal use)
os.environ['GIGACHAT_SCOPE'] = "GIGACHAT_API_PERS"  # or GIGACHAT_API_B2B, GIGACHAT_API_CORP
```

Get your credentials at: https://developers.sber.ru/studio/

### Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GIGACHAT_CREDENTIALS` | Yes | - | Base64-encoded `client_id:client_secret` |
| `GIGACHAT_SCOPE` | No | `GIGACHAT_API_PERS` | OAuth scope: `GIGACHAT_API_PERS`, `GIGACHAT_API_B2B`, or `GIGACHAT_API_CORP` |
| `GIGACHAT_API_BASE` | No | `https://gigachat.devices.sberbank.ru/api/v1` | Chat API base URL. Point it at the endpoint your key can reach, for example `https://api.giga.chat/v1` |
| `GIGACHAT_AUTH_URL` | No | `https://ngw.devices.sberbank.ru:9443/api/v2/oauth` | OAuth token endpoint |
| `GIGACHAT_ACCESS_TOKEN` | No | - | Pre-issued access token. When set, LiteLLM skips the OAuth exchange |

## Sample Usage

```python
from litellm import completion
import os

os.environ['GIGACHAT_CREDENTIALS'] = "your-credentials-here"

response = completion(
    model="gigachat/GigaChat-2-Max",
    messages=[
       {"role": "user", "content": "Hello from LiteLLM!"}
   ],
    ssl_verify=False,  # Required for GigaChat
)
print(response)
```

## Sample Usage - Streaming

```python
from litellm import completion
import os

os.environ['GIGACHAT_CREDENTIALS'] = "your-credentials-here"

response = completion(
    model="gigachat/GigaChat-2-Max",
    messages=[
       {"role": "user", "content": "Hello from LiteLLM!"}
   ],
    stream=True,
    ssl_verify=False,  # Required for GigaChat
)

for chunk in response:
    print(chunk)
```

## Sample Usage - Function Calling

```python
from litellm import completion
import os

os.environ['GIGACHAT_CREDENTIALS'] = "your-credentials-here"

tools = [{
    "type": "function",
    "function": {
        "name": "get_weather",
        "description": "Get weather for a city",
        "parameters": {
            "type": "object",
            "properties": {
                "city": {"type": "string", "description": "City name"}
            },
            "required": ["city"]
        }
    }
}]

response = completion(
    model="gigachat/GigaChat-2-Max",
    messages=[{"role": "user", "content": "What's the weather in Moscow?"}],
    tools=tools,
    ssl_verify=False,  # Required for GigaChat
)
print(response)
```

## Sample Usage - Structured Output

GigaChat supports structured output via JSON schema (emulated through function calling):

```python
from litellm import completion
import os

os.environ['GIGACHAT_CREDENTIALS'] = "your-credentials-here"

response = completion(
    model="gigachat/GigaChat-2-Max",
    messages=[{"role": "user", "content": "Extract info: John is 30 years old"}],
    response_format={
        "type": "json_schema",
        "json_schema": {
            "name": "person",
            "schema": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "age": {"type": "integer"}
                }
            }
        }
    },
    ssl_verify=False,  # Required for GigaChat
)
print(response)  # Returns JSON: {"name": "John", "age": 30}
```

## Sample Usage - Image Input

GigaChat supports image input via base64 or URL (GigaChat-2-Max and GigaChat-2-Pro only):

```python
from litellm import completion
import os

os.environ['GIGACHAT_CREDENTIALS'] = "your-credentials-here"

response = completion(
    model="gigachat/GigaChat-2-Max",  # Vision requires GigaChat-2-Max or GigaChat-2-Pro
    messages=[{
        "role": "user",
        "content": [
            {"type": "text", "text": "What's in this image?"},
            {"type": "image_url", "image_url": {"url": "https://example.com/image.jpg"}}
        ]
    }],
    ssl_verify=False,  # Required for GigaChat
)
print(response)
```

## Sample Usage - Embeddings

```python
from litellm import embedding
import os

os.environ['GIGACHAT_CREDENTIALS'] = "your-credentials-here"

response = embedding(
    model="gigachat/Embeddings",
    input=["Hello world", "How are you?"],
    ssl_verify=False,  # Required for GigaChat
)
print(response)
```

## Usage with LiteLLM Proxy

### 1. Set GigaChat Models on config.yaml

```yaml
model_list:
  - model_name: gigachat-max
    litellm_params:
      model: gigachat/GigaChat-3-Ultra
      api_key: "os.environ/GIGACHAT_CREDENTIALS"
      ssl_verify: false
  - model_name: gigachat-pro
    litellm_params:
      model: gigachat/GigaChat-3-Pro
      api_key: "os.environ/GIGACHAT_CREDENTIALS"
      ssl_verify: false
  - model_name: gigachat-lite
    litellm_params:
      model: gigachat/GigaChat-3-Lightning
      api_key: "os.environ/GIGACHAT_CREDENTIALS"
      ssl_verify: false
  - model_name: gigachat-embeddings
    litellm_params:
      model: gigachat/Embeddings
      api_key: "os.environ/GIGACHAT_CREDENTIALS"
      ssl_verify: false
```

If your key targets a different endpoint than the default, set `api_base` (or the `GIGACHAT_API_BASE` environment variable) on each model:

```yaml
model_list:
  - model_name: gigachat-max
    litellm_params:
      model: gigachat/GigaChat-3-Ultra
      api_key: "os.environ/GIGACHAT_CREDENTIALS"
      api_base: "os.environ/GIGACHAT_API_BASE"  # e.g. https://api.giga.chat/v1
      ssl_verify: false
```

### 2. Start Proxy

```bash
litellm --config config.yaml
```

### 3. Test it

<Tabs>
<TabItem value="Curl" label="Curl Request">

```shell
curl --location 'http://0.0.0.0:4000/chat/completions' \
--header 'Content-Type: application/json' \
--data '{
    "model": "gigachat",
    "messages": [
        {
            "role": "user",
            "content": "Hello!"
        }
    ]
}'
```
</TabItem>
<TabItem value="openai" label="OpenAI v1.0.0+">

```python
import openai
client = openai.OpenAI(
    api_key="anything",
    base_url="http://0.0.0.0:4000"
)

response = client.chat.completions.create(
    model="gigachat",
    messages=[{"role": "user", "content": "Hello!"}]
)
print(response)
```
</TabItem>
</Tabs>

## Supported Models

The models your key can use depend on the scope and access level. Query the live list with a `GET /models` request against your `GIGACHAT_API_BASE` endpoint.

The chat models below were returned by `GET https://api.giga.chat/v1/models` with a `GIGACHAT_API_CORP` key in September 2026:

### Chat Models

| Model Name | Description |
|------------|-------------|
| gigachat/GigaChat-3-Ultra | GigaChat-3 flagship model |
| gigachat/GigaChat-3-Pro | GigaChat-3 professional model |
| gigachat/GigaChat-3-Lightning | Fast GigaChat-3 model |
| gigachat/GigaChat-2-Max | Maximum capability GigaChat-2 model (vision) |
| gigachat/GigaChat-2-Pro | Professional GigaChat-2 model (vision) |
| gigachat/GigaChat-2 | Base GigaChat-2 model |

`GigaChat-2-Lite`, listed in earlier revisions of this page, no longer exists on the API and returns 404 "No such model".

### Embedding Models

| Model Name | Max Input | Dimensions | Description |
|------------|-----------|------------|-------------|
| gigachat/Embeddings | 512 | 1024 | Standard embeddings |
| gigachat/Embeddings-2 | 512 | 1024 | Updated embeddings |
| gigachat/EmbeddingsGigaR | 4096 | 2560 | High-dimensional embeddings |

:::note
Available models may vary depending on your API access level (personal, business, or corporate scope).
:::

## Limitations

- Only one function call per request (GigaChat API limitation)
- Maximum 1 image per message, 10 images total per conversation
- GigaChat API certificates chain to the Russian Trusted Root CA. Pass `ssl_verify=False`, or install the CA into your system trust store and keep verification enabled
