# UnoRouter

## Overview

| Property | Details |
|-------|-------|
| Description | UnoRouter is an open-source OpenAI-compatible gateway serving 200+ models, most with a genuine free tier (`:free` suffix). |
| Provider Route on LiteLLM | `unorouter/` |
| Link to Provider Doc | [UnoRouter](https://unorouter.com/models) |
| Base URL | `https://api.unorouter.com/v1` |
| Supported Operations | [`/chat/completions`](#sample-usage) |

<br />

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["UNOROUTER_API_KEY"] = ""  # your UnoRouter API key from https://unorouter.com/token
```

## Sample Usage

```python showLineNumbers title="UnoRouter Completion"
import os
from litellm import completion

os.environ["UNOROUTER_API_KEY"] = ""

response = completion(
    model="unorouter/deepseek-v4-flash:free",
    messages=[{"role": "user", "content": "Hello from LiteLLM"}],
)

print(response)
```

## Sample Usage - Streaming

```python showLineNumbers title="UnoRouter Streaming Completion"
import os
from litellm import completion

os.environ["UNOROUTER_API_KEY"] = ""

response = completion(
    model="unorouter/deepseek-v4-flash:free",
    messages=[{"role": "user", "content": "Stream a short reply"}],
    stream=True,
)

for chunk in response:
    print(chunk)
```

## Usage with LiteLLM Proxy Server

1. Add the model to your proxy config:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: unorouter-chat
    litellm_params:
      model: unorouter/deepseek-v4-flash:free
      api_key: os.environ/UNOROUTER_API_KEY
```

2. Start the proxy:

```bash
litellm --config /path/to/config.yaml
```

## Direct API Usage (Bearer Token)

Use the environment variable as a Bearer token against the OpenAI-compatible endpoint:
`https://api.unorouter.com/v1/chat/completions`.

```bash showLineNumbers title="cURL"
export UNOROUTER_API_KEY=""
curl https://api.unorouter.com/v1/chat/completions \
  -H "Authorization: Bearer ${UNOROUTER_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-v4-flash:free",
    "messages": [{"role": "user", "content": "Hello from UnoRouter"}]
  }'
```

## Notes

- The full live model catalog (200+ models) is at [unorouter.com/models](https://unorouter.com/models) or via `GET https://api.unorouter.com/v1/models`.
- Models with a `:free` suffix cost nothing and run on shared free pools with a light per-model rate limit; a busy free model returns an explicit "all providers busy" error and recovers automatically.
- API keys: free signup at [unorouter.com](https://unorouter.com) (Discord or GitHub, no card).
