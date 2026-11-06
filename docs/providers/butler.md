import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Butler

## Overview

| Property | Details |
|-------|-------|
| Description | Butler serves Cicero, a decision model that answers yes/no, choice and score questions with probabilities, behind OpenAI- and Anthropic-compatible APIs. |
| Provider Route on LiteLLM | `butler/` |
| Link to Provider Doc | [Butler models ↗](https://butlercompute.com/models/) |
| Base URL | `https://api.butlercompute.com/v1` |
| Supported Operations | [`/decisions`](/docs/providers/butler#decisions), [`/systemone`](/docs/providers/butler#decisions), [`/chat/completions`](/docs/providers/butler#chat-completions), [`/responses`](/docs/providers/butler#responses), [`/messages`](/docs/providers/butler#messages) |

<br />
<br />

## Available Models

| Model | Description | Context Window |
|-------|-------------|----------------|
| `butler/cicero` | Decision model: text and up to 4 images in, probabilities out | 131K tokens |

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["BUTLER_API_KEY"] = ""  # your Butler API key
os.environ["BUTLER_API_BASE"] = ""  # optional, defaults to https://api.butlercompute.com
```

Get an API key from the [Butler console](https://butlercompute.com/console/).

## Decisions

Decision calls go to Butler's `POST /v1/decisions`. LiteLLM sends the OpenAI Decisions body (`input`, a list of `questions`) and gets the answers back in question order. `litellm.systemone` calls are converted to that body and their answers back to System One. See [Decisions](../decisions.md) for both formats.

### Usage - LiteLLM Python SDK

<Tabs>
<TabItem value="decisions" label="litellm.decisions">

```python showLineNumbers title="Butler Decisions"
import os
import litellm

os.environ["BUTLER_API_KEY"] = ""  # your Butler API key

response = litellm.decisions(
    model="butler/cicero",
    input="Customer wrote: I was charged twice for my order 4411 and I want my money back.",
    questions=[
        {"type": "predicate", "name": "is_refund_request", "instructions": "Is the customer asking for a refund?"},
        {
            "type": "choice",
            "name": "topic",
            "instructions": "What is the message about?",
            "choices": [{"value": "billing"}, {"value": "shipping"}, {"value": "product"}],
        },
    ],
)

print(response.answers)
```

</TabItem>
<TabItem value="systemone" label="litellm.systemone">

```python showLineNumbers title="Butler System One"
import os
import litellm

os.environ["BUTLER_API_KEY"] = ""  # your Butler API key

response = litellm.systemone(
    model="butler/cicero",
    state="Customer wrote: I was charged twice for my order 4411 and I want my money back.",
    questions={
        "is_refund_request": {"type": "noul", "instructions": "Is the customer asking for a refund?"},
        "urgency": {"type": "score", "instructions": "How urgent is this message?", "criteria": ["low", "medium", "high"]},
    },
)

print(response.answers)
```

</TabItem>
</Tabs>

### Usage - LiteLLM Proxy

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: cicero
    litellm_params:
      model: butler/cicero
      api_key: os.environ/BUTLER_API_KEY
```

```bash showLineNumbers title="Start LiteLLM Proxy"
litellm --config config.yaml

# RUNNING on http://0.0.0.0:4000
```

```bash showLineNumbers title="Butler Decisions via Proxy - cURL"
curl http://localhost:4000/v1/decisions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-proxy-api-key" \
  -d '{
    "model": "cicero",
    "input": "Customer wrote: I was charged twice for my order 4411 and I want my money back.",
    "questions": [
      {"type": "predicate", "name": "is_refund_request", "instructions": "Is the customer asking for a refund?"}
    ]
  }'
```

The same deployment answers System One bodies on `/v1/systemone`.

## Chat Completions

**We support ALL Butler chat models, just set `butler/` as a prefix when sending completion requests.** The models your key can call are listed on `GET https://api.butlercompute.com/v1/models`.

### Usage - LiteLLM Python SDK

```python showLineNumbers title="Butler Chat Completion"
import os
from litellm import completion

os.environ["BUTLER_API_KEY"] = ""  # your Butler API key

response = completion(
    model="butler/<model-id>",
    messages=[{"content": "Hello, how are you?", "role": "user"}],
)

print(response)
```

### Usage - LiteLLM Proxy

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: butler-chat
    litellm_params:
      model: butler/<model-id>
      api_key: os.environ/BUTLER_API_KEY
```

<Tabs>
<TabItem value="openai-sdk" label="OpenAI SDK">

```python showLineNumbers title="Butler via Proxy"
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:4000",  # Your proxy URL
    api_key="your-proxy-api-key",      # Your proxy API key
)

response = client.chat.completions.create(
    model="butler-chat",
    messages=[{"role": "user", "content": "hello from litellm"}],
)

print(response.choices[0].message.content)
```

</TabItem>
<TabItem value="curl" label="cURL">

```bash showLineNumbers title="Butler via Proxy - cURL"
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-proxy-api-key" \
  -d '{
    "model": "butler-chat",
    "messages": [{"role": "user", "content": "hello from litellm"}]
  }'
```

</TabItem>
</Tabs>

## Responses

Responses requests go to Butler's `POST /v1/responses` unchanged.

```python showLineNumbers title="Butler Responses"
import os
import litellm

os.environ["BUTLER_API_KEY"] = ""  # your Butler API key

response = litellm.responses(model="butler/<model-id>", input="Hello, how are you?")

print(response.output)
```

On the proxy, send the same body to `/v1/responses` with the `model_name` from your `config.yaml`.

## Messages

Anthropic Messages requests go to Butler's `POST /v1/messages` unchanged.

```python showLineNumbers title="Butler Messages"
import asyncio
import os
import litellm

os.environ["BUTLER_API_KEY"] = ""  # your Butler API key

response = asyncio.run(
    litellm.anthropic.messages.acreate(
        model="butler/<model-id>",
        messages=[{"role": "user", "content": "Hello, how are you?"}],
        max_tokens=256,
    )
)

print(response["content"])
```

On the proxy, send the same body to `/v1/messages`.

## Additional Notes

- Every decisions response carries `usage.cost`, the amount Butler charged. LiteLLM bills the call at that cost and falls back to the cost map's per-token prices when it is missing.
- A decisions call takes up to 4 images; LiteLLM inlines remote image URLs before sending them.
- Box questions, audio and video are not supported on Butler decisions.
