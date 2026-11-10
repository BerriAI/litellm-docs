# Dulus

LiteLLM supports all chat models served by [Dulus](https://dulus.ai) through its OpenAI-compatible API at `https://control.dulus.ai/v1`.

Dulus is a provider-independent agent platform (`pip install dulus`) that also hosts models behind a unified API, metered in **Fuel** on the tokens each call actually uses — cached tokens are free and failed calls are refunded. Hosted tiers are billed at relative rates (`dulus-a-9b` 1×, `dulus-b-27b` 2×, `dulus-x-397b` 4×) rather than per-model USD list prices.

## Authentication

Get an API key from the Dulus console (keys look like `dulus_sk_live_...`) and set it as an environment variable:

```python
import os

os.environ["DULUS_API_KEY"] = "dulus_sk_live_..."
```

## Usage

```python
import os
from litellm import completion

os.environ["DULUS_API_KEY"] = "dulus_sk_live_..."

messages = [{"content": "Hello, how are you?", "role": "user"}]

response = completion(
    model="dulus/dulus-b-27b",
    messages=messages,
)

print(response.choices[0].message.content)
```

You can also pass the key and base explicitly:

```python
response = completion(
    model="dulus/dulus-b-27b",
    messages=messages,
    api_key="dulus_sk_live_...",
    api_base="https://control.dulus.ai/v1",  # default; DULUS_API_BASE also works
)
```

## Usage - Streaming

Just set `stream=True` when calling completion:

```python
import os
from litellm import completion

os.environ["DULUS_API_KEY"] = "dulus_sk_live_..."

messages = [{"content": "Hello, how are you?", "role": "user"}]

response = completion(
    model="dulus/dulus-b-27b",
    messages=messages,
    stream=True,
)

for chunk in response:
    print(chunk.choices[0].delta.content or "", end="")
```

## Dulus Models

| Model Name | Function Call |
|------------|---------------|
| dulus/dulus-a-9b | `completion('dulus/dulus-a-9b', messages)` |
| dulus/dulus-b-27b | `completion('dulus/dulus-b-27b', messages)` |
| dulus/dulus-coder-30b | `completion('dulus/dulus-coder-30b', messages)` |
| dulus/dulus-vl-72b | `completion('dulus/dulus-vl-72b', messages)` |
| dulus/dulus-x-397b | `completion('dulus/dulus-x-397b', messages)` |
| dulus/dulus-free-9b | `completion('dulus/dulus-free-9b', messages)` |

Plus routed open-weight models served under the same endpoint (e.g. `dulus/dulus-glm-5.3`, `dulus/dulus-deepseek-v4-flash-0731`, `dulus/dulus-kimi-k2.7-code`, `dulus/dulus-qwen3.8-27b`). For the complete, live list: `GET https://control.dulus.ai/v1/models`.

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DULUS_API_KEY` | Your Dulus API key (`dulus_sk_live_...`) | Yes |
| `DULUS_API_BASE` | Override the API base (default `https://control.dulus.ai/v1`) | No |
