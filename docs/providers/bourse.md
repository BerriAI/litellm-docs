import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Bourse

## Overview

| Property | Details |
|-------|-------|
| Description | Bourse resells unused AI capacity from upstream providers at a discount (roughly 11-58% under list price) through a single OpenAI-compatible API. |
| Provider Route on LiteLLM | `bourse/` |
| Link to Provider Doc | [Bourse API Guide ↗](https://bourse.run/api-guide) |
| Base URL | `https://api.bourse.run/v1` |
| Supported Operations | [`/chat/completions`](/docs/providers/bourse#usage---litellm-python-sdk) |

<br />
<br />

**We support ALL Bourse models, just set `bourse/` as a prefix when sending completion requests**

The full live catalogue and pricing is at [bourse.run](https://bourse.run).

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["BOURSE_API_KEY"] = ""  # your Bourse API key
```

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="Bourse Non-streaming Completion"
import os
import litellm
from litellm import completion

os.environ["BOURSE_API_KEY"] = ""  # your Bourse API key

messages = [{"content": "Hello, how are you?", "role": "user"}]

# Bourse call
response = completion(model="bourse/{{anthropic_large}}", messages=messages)

print(response)
```

### Streaming

```python showLineNumbers title="Bourse Streaming Completion"
import os
import litellm
from litellm import completion

os.environ["BOURSE_API_KEY"] = ""  # your Bourse API key

messages = [{"content": "Hello, how are you?", "role": "user"}]

# Bourse call with streaming
response = completion(
    model="bourse/{{anthropic_large}}",
    messages=messages,
    stream=True,
)

for chunk in response:
    print(chunk)
```

## Usage - LiteLLM Proxy

Add the following to your LiteLLM Proxy configuration file:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: {{anthropic_large}}
    litellm_params:
      model: bourse/{{anthropic_large}}
      api_key: os.environ/BOURSE_API_KEY
```

Start your LiteLLM Proxy server:

```bash showLineNumbers title="Start LiteLLM Proxy"
litellm --config config.yaml

# RUNNING on http://0.0.0.0:4000
```

<Tabs>
<TabItem value="openai-sdk" label="OpenAI SDK">

```python showLineNumbers title="Bourse via Proxy"
from openai import OpenAI

# Initialize client with your proxy URL
client = OpenAI(
    base_url="http://localhost:4000",  # Your proxy URL
    api_key="your-proxy-api-key",      # Your proxy API key
)

# Non-streaming response
response = client.chat.completions.create(
    model="{{anthropic_large}}",
    messages=[{"role": "user", "content": "hello from litellm"}],
)

print(response.choices[0].message.content)
```

</TabItem>
<TabItem value="curl" label="cURL">

```bash showLineNumbers title="Bourse via Proxy - cURL"
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-proxy-api-key" \
  -d '{
    "model": "{{anthropic_large}}",
    "messages": [{"role": "user", "content": "hello from litellm"}]
  }'
```

</TabItem>
</Tabs>

## Additional Notes

- Bourse speaks the standard OpenAI Chat Completions format, so it works through LiteLLM's OpenAI-compatible provider path with no extra transformation code.
- Per-model catalogue and live pricing are listed at [bourse.run](https://bourse.run) and the [API guide](https://bourse.run/api-guide).
