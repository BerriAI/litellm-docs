# BytesBrains Cruise

## Overview

| Property | Details |
|-------|-------|
| Description | BytesBrains Cruise is a hosted, OpenAI-compatible gateway in front of several model providers. Each API key belongs to a project, and a project can have a spend cap that refuses calls once it is reached. |
| Provider Route on LiteLLM | `cruise/` |
| Link to Provider Doc | [BytesBrains Cruise ↗](https://bytesbrains.com/cruise) |
| Base URL | `https://cruise.bytesbrains.net/v1` |
| Supported Operations | [`/chat/completions`](#usage---litellm-python-sdk) |

<br />
<br />

**Cruise model ids carry their own provider prefix, so keep it after `cruise/`:** `cruise/anthropic/claude-sonnet-5`, `cruise/deepseek/deepseek-flash`. Always use the `cruise/` prefix. Without it, a model such as `deepseek/deepseek-flash` resolves to LiteLLM's own `deepseek` provider even when `api_base` points at Cruise.

The models a key can reach are listed at `GET https://cruise.bytesbrains.net/v1/models`.

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["CRUISE_API_KEY"] = ""  # your Cruise API key
```

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="Cruise Non-streaming Completion"
import os
from litellm import completion

os.environ["CRUISE_API_KEY"] = ""  # your Cruise API key

response = completion(
    model="cruise/anthropic/claude-sonnet-5",
    messages=[{"content": "Hello, how are you?", "role": "user"}],
)

print(response)
```

### Streaming

```python showLineNumbers title="Cruise Streaming Completion"
import os
from litellm import completion

os.environ["CRUISE_API_KEY"] = ""  # your Cruise API key

response = completion(
    model="cruise/anthropic/claude-sonnet-5",
    messages=[{"content": "Write a short story about AI", "role": "user"}],
    stream=True,
)

for chunk in response:
    print(chunk)
```

## Spend caps

When a project's spend cap is reached, Cruise answers `429`, and LiteLLM raises `litellm.RateLimitError` with a message naming the project:

```
litellm.RateLimitError: RateLimitError: CruiseException - Project 'my-project' has reached its budget.
```

The refusal carries a `retry-after` header. With default settings, the OpenAI client waits that long and retries, so a call that hits a cap near the end of its period stalls, then succeeds once the period resets. To see the refusal immediately, pass `max_retries=0`:

```python showLineNumbers title="Fail fast on a spend cap"
import litellm
from litellm import completion

try:
    response = completion(
        model="cruise/anthropic/claude-sonnet-5",
        messages=[{"content": "Hello", "role": "user"}],
        max_retries=0,
    )
except litellm.RateLimitError as e:
    print("Cruise refused the call:", e)
```

Successful responses carry the project's budget state in `x-cruise-*` headers, which LiteLLM passes through with an `llm_provider-` prefix:

```python showLineNumbers title="Read Cruise budget headers"
headers = response._hidden_params["additional_headers"]
print(headers.get("llm_provider-x-cruise-budget-state"))  # e.g. "ok"
print(headers.get("llm_provider-x-cruise-budget-spend"))  # spend so far in the period
print(headers.get("llm_provider-x-cruise-budget-limit"))  # the cap
```

## Usage - LiteLLM Proxy Server

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: claude-sonnet-5
    litellm_params:
      model: cruise/anthropic/claude-sonnet-5
      api_key: os.environ/CRUISE_API_KEY
  - model_name: deepseek-flash
    litellm_params:
      model: cruise/deepseek/deepseek-flash
      api_key: os.environ/CRUISE_API_KEY
```

## Custom API Base

**Option 1: Environment variable**

```python showLineNumbers title="Custom API Base via env var"
import os
from litellm import completion

os.environ["CRUISE_API_BASE"] = "https://cruise-demo.bytesbrains.net/v1"
os.environ["CRUISE_API_KEY"] = ""  # your API key

response = completion(
    model="cruise/deepseek/deepseek-flash",
    messages=[{"content": "Hello!", "role": "user"}],
)
```

**Option 2: Pass directly**

```python showLineNumbers title="Custom API Base via parameter"
from litellm import completion

response = completion(
    model="cruise/deepseek/deepseek-flash",
    messages=[{"content": "Hello!", "role": "user"}],
    api_base="https://cruise-demo.bytesbrains.net/v1",
    api_key="your-api-key",
)
```

`cruise-demo.bytesbrains.net` is Cruise's free demo. It takes a demo key and returns the real response shape and headers, but a fixed completion rather than a model's answer.

`max_completion_tokens` is sent to Cruise as is.
