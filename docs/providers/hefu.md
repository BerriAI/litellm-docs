# HeFu

[HeFu](https://www.hefu.hk) is an OpenAI-compatible AI API gateway. One API key gives you access to 120+ models from major providers — DeepSeek, Kimi (Moonshot), Qwen, GLM (Zhipu), MiniMax, OpenAI GPT series, Anthropic Claude, Google Gemini and more — with pay-as-you-go billing in USD.

- API base: `https://api.hefu.hk/v1`
- Get an API key: https://www.hefu.hk

## Usage (named provider)

```python
import os
from litellm import completion

os.environ["HEFU_API_KEY"] = "sk-your-hefu-key"

response = completion(
    model="hefu/gemini-3.6-flash",  # any model id from GET /v1/models
    messages=[{"role": "user", "content": "Hello, how are you?"}],
)
print(response.choices[0].message.content)
```

To override the default endpoint, set `HEFU_API_BASE`.

## Usage (OpenAI-compatible)

HeFu works with the generic `openai/` prefix + `api_base` as well:

```python
import os
from litellm import completion

response = completion(
    model="openai/gemini-3.6-flash",  # `openai/` prefix routes to an OpenAI-compatible endpoint
    api_key="sk-your-hefu-key",
    api_base="https://api.hefu.hk/v1",
    messages=[{"role": "user", "content": "Hello, how are you?"}],
)
```

## Usage with LiteLLM Proxy Server

1. Add to `config.yaml`:

```yaml
model_list:
  - model_name: gemini-3.6-flash
    litellm_params:
      model: hefu/gemini-3.6-flash   # or: openai/gemini-3.6-flash with api_base below
      api_key: os.environ/HEFU_API_KEY
      # api_base: https://api.hefu.hk/v1  # required only when using the openai/ prefix
```

2. Start the proxy:

```bash
litellm --config config.yaml
```

## Listing available models

HeFu exposes the standard OpenAI `GET /v1/models` endpoint:

```bash
curl https://api.hefu.hk/v1/models \
  -H "Authorization: Bearer sk-your-hefu-key"
```

or via the OpenAI SDK:

```python
from openai import OpenAI

client = OpenAI(api_key="sk-your-hefu-key", base_url="https://api.hefu.hk/v1")
for m in client.models.list():
    print(m.id)
```
