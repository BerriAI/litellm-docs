import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Requesty
https://docs.requesty.ai

Requesty is an OpenAI-compatible LLM router. One API key gives access to models from OpenAI, Anthropic, Google, DeepSeek and other vendors, with usage, cost tracking and fallbacks handled on the Requesty side

| Property | Details |
|-------|-------|
| Description | OpenAI-compatible LLM router serving models from many vendors under one API key |
| Provider Route on LiteLLM | `requesty/` |
| Link to Provider Doc | [Requesty Documentation](https://docs.requesty.ai) |
| Base URL | `https://router.requesty.ai/v1` (EU: `https://router.eu.requesty.ai/v1`) |
| Supported Operations | [`/chat/completions`](#usage---litellm-python-sdk) |

:::tip

Set `model=requesty/<model>` to route a request through Requesty. Model ids follow the `<vendor>/<model>` convention, for example `openai/gpt-4o-mini` or `anthropic/claude-sonnet-4-6`. Requesty also exposes short managed ids such as `claude-sonnet-4-6`. The full list is in the [model library](https://app.requesty.ai/model-library) and from `GET /v1/models`

:::

## API Key

Create a key at https://app.requesty.ai/api-keys

```python showLineNumbers title="Environment Variables"
import os

os.environ["REQUESTY_API_KEY"] = ""  # your Requesty API key
os.environ["REQUESTY_API_BASE"] = ""  # optional, defaults to https://router.requesty.ai/v1
```

`REQUESTY_API_BASE` only needs to be set when you want a different endpoint, for example the EU router at `https://router.eu.requesty.ai/v1`. Leaving it unset uses `https://router.requesty.ai/v1`

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="Requesty Non-streaming Completion"
import os
from litellm import completion

os.environ["REQUESTY_API_KEY"] = ""  # your Requesty API key

response = completion(
    model="requesty/openai/gpt-4o-mini",
    messages=[{"role": "user", "content": "What character was Wall-e in love with?"}],
)
print(response)
```

### Streaming

```python showLineNumbers title="Requesty Streaming Completion"
import os
from litellm import completion

os.environ["REQUESTY_API_KEY"] = ""  # your Requesty API key

response = completion(
    model="requesty/openai/gpt-4o-mini",
    messages=[{"role": "user", "content": "Write a short story about a lighthouse"}],
    stream=True,
)

for chunk in response:
    print(chunk)
```

### Function Calling

```python showLineNumbers title="Requesty Function Calling"
import os
from litellm import completion

os.environ["REQUESTY_API_KEY"] = ""  # your Requesty API key

tools = [{
    "type": "function",
    "function": {
        "name": "get_weather",
        "description": "Get the current weather in a location",
        "parameters": {
            "type": "object",
            "properties": {
                "city": {"type": "string", "description": "The city, e.g. Amsterdam"}
            },
            "required": ["city"],
        },
    },
}]

response = completion(
    model="requesty/anthropic/claude-sonnet-4-6",
    messages=[{"role": "user", "content": "What's the weather in Amsterdam?"}],
    tools=tools,
    tool_choice="auto",
)
print(response)
```

### Reasoning

`reasoning_effort` and `thinking` are accepted on models that LiteLLM's model map flags as reasoning capable, for example `anthropic/claude-sonnet-4-6` or `openai/gpt-5`. `reasoning_effort="max"` is sent to Requesty as `xhigh`. When a model streams its reasoning back in `delta.reasoning`, LiteLLM surfaces it as `delta.reasoning_content`

```python showLineNumbers title="Requesty Reasoning"
import os
from litellm import completion

os.environ["REQUESTY_API_KEY"] = ""  # your Requesty API key

response = completion(
    model="requesty/anthropic/claude-sonnet-4-6",
    messages=[{"role": "user", "content": "How many r's are in strawberry?"}],
    reasoning_effort="high",
)
print(response)
```

### Prompt Caching

For Claude, Gemini, MiniMax, GLM and Z.ai models, a message level `cache_control` is moved into the last content block of that message before the request is sent

```python showLineNumbers title="Requesty Prompt Caching"
import os
from litellm import completion

os.environ["REQUESTY_API_KEY"] = ""  # your Requesty API key

response = completion(
    model="requesty/anthropic/claude-sonnet-4-6",
    messages=[
        {
            "role": "system",
            "content": "You are a contract review assistant. " + ("Long contract text here. " * 400),
            "cache_control": {"type": "ephemeral"},
        },
        {"role": "user", "content": "Summarize the termination clause"},
    ],
)
print(response)
```

## Usage - LiteLLM Proxy Server

1. Add the model to your config.yaml

  ```yaml showLineNumbers title="config.yaml"
  model_list:
    - model_name: gpt-4o-mini
      litellm_params:
        model: requesty/openai/gpt-4o-mini
        api_key: os.environ/REQUESTY_API_KEY
    - model_name: claude-sonnet
      litellm_params:
        model: requesty/anthropic/claude-sonnet-4-6
        api_key: os.environ/REQUESTY_API_KEY
  ```

2. Start the proxy

  ```bash
  $ litellm --config /path/to/config.yaml
  ```

3. Send a request

  <Tabs>

  <TabItem value="openai" label="OpenAI Python v1.0.0+">

  ```python
  import openai

  client = openai.OpenAI(
      api_key="litellm-proxy-key",
      base_url="http://0.0.0.0:4000",
  )

  response = client.chat.completions.create(
      model="gpt-4o-mini",
      messages=[{"role": "user", "content": "What character was Wall-e in love with?"}],
  )

  print(response)
  ```
  </TabItem>

  <TabItem value="curl" label="curl">

  ```shell
  curl --location 'http://0.0.0.0:4000/chat/completions' \
      --header 'Authorization: Bearer litellm-proxy-key' \
      --header 'Content-Type: application/json' \
      --data '{
      "model": "gpt-4o-mini",
      "messages": [
          {
              "role": "user",
              "content": "What character was Wall-e in love with?"
          }
      ]
  }'
  ```
  </TabItem>

  </Tabs>

## EU Endpoint

Requesty runs an EU router at `https://router.eu.requesty.ai/v1` for workloads that must stay in Europe. Point LiteLLM at it with `REQUESTY_API_BASE`, or pass `api_base` on the call or in `config.yaml`

**Option 1: Environment variable**

```python showLineNumbers title="EU router via env var"
import os
from litellm import completion

os.environ["REQUESTY_API_KEY"] = ""  # your Requesty API key
os.environ["REQUESTY_API_BASE"] = "https://router.eu.requesty.ai/v1"

response = completion(
    model="requesty/openai/gpt-4o-mini",
    messages=[{"role": "user", "content": "Hello!"}],
)
```

**Option 2: Pass directly**

```python showLineNumbers title="EU router via parameter"
from litellm import completion

response = completion(
    model="requesty/openai/gpt-4o-mini",
    messages=[{"role": "user", "content": "Hello!"}],
    api_base="https://router.eu.requesty.ai/v1",
    api_key="your-api-key",
)
```

**Option 3: Proxy config.yaml**

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: gpt-4o-mini-eu
    litellm_params:
      model: requesty/openai/gpt-4o-mini
      api_base: https://router.eu.requesty.ai/v1
      api_key: os.environ/REQUESTY_API_KEY
```

## Supported OpenAI Parameters

`frequency_penalty`, `logit_bias`, `logprobs`, `top_logprobs`, `max_tokens`, `max_completion_tokens`, `modalities`, `prediction`, `n`, `presence_penalty`, `seed`, `stop`, `stream`, `stream_options`, `temperature`, `top_p`, `tools`, `tool_choice`, `function_call`, `functions`, `max_retries`, `extra_headers`, `parallel_tool_calls`, `audio`, `web_search_options`, `service_tier`, `safety_identifier`, `prompt_cache_key`, `prompt_cache_retention`, `store` and `response_format`

`reasoning_effort` and `thinking` are added for models flagged as reasoning capable, see [Reasoning](#reasoning)

Anything passed in `extra_body` is forwarded to Requesty as is, except `model` and `messages`, which keep the values LiteLLM resolved for the request

## Errors

Requesty errors, including error payloads that arrive inside a stream, are raised as `litellm.llms.requesty.common_utils.RequestyException` carrying the upstream status code and headers
