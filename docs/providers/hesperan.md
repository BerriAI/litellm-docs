# Hesperan

## Overview

| Property | Details |
|-------|-------|
| Description | Hesperan is a decision model. It answers the fields of a Structured Outputs schema (string enums, booleans, bounded integers) and returns a probability for every value. It does not generate free text. |
| Provider Route on LiteLLM | `hesperan/` |
| Link to Provider Doc | [Hesperan OpenAI-compatible API ↗](https://hesperan.com/docs/openai) |
| Base URL | `https://api.hesperan.com/v1` |
| Supported Operations | [`/chat/completions`](#usage---litellm-python-sdk) with a `json_schema` `response_format` |

<br />

:::info

Every request needs a `response_format` with a JSON schema. Each property is one question: an `enum` of strings is a choice, a `boolean` is a yes/no and an `integer` with `minimum` and `maximum` (at most 11 levels) is a score. Requests without a schema, or with free-text fields, return a 400 that explains this.

:::

## Available Models

| Model | Description |
|-------|-------------|
| `hesperan/hesperan-1` | Answers choice, yes/no and score fields of a JSON schema with a probability per value |

## Pricing

Hesperan bills input tokens only. `usage.completion_tokens` is always 0, and LiteLLM's cost tracking uses the pay-as-you-go input rate from the model cost map. Included monthly tokens on Hesperan plans are not modelled. See [hesperan.com/pricing](https://hesperan.com/pricing) for plans.

The model runs on serverless GPUs. The first request after a quiet period can take 2 to 3 minutes, or return a 503 "model is starting" with a `Retry-After` header. Set `num_retries` to retry it.

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["HESPERAN_API_KEY"] = ""  # your Hesperan API key (hsp_...)
```

`HESPERAN_API_BASE` optionally overrides the base URL.

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="Hesperan Completion"
import os
from typing import Literal

from litellm import completion
from pydantic import BaseModel, Field

os.environ["HESPERAN_API_KEY"] = ""


class Ticket(BaseModel):
    team: Literal["billing", "shipping", "technical"] = Field(description="Which team should handle this ticket?")
    urgent: bool = Field(description="The customer has lost money.")


response = completion(
    model="hesperan/hesperan-1",
    messages=[
        {"role": "system", "content": "You triage support tickets for an online shop."},
        {"role": "user", "content": "I was charged twice for order 4812, please refund."},
    ],
    response_format=Ticket,
)

print(response.choices[0].message.content)  # {"team":"billing","urgent":true}
```

System messages are shared instructions for every field, and the other messages are the text Hesperan decides about. The probability of every value is in the non-standard top-level `hesperan` field, which LiteLLM keeps on the response as `response.hesperan["answers"]`.

### Streaming

```python showLineNumbers title="Hesperan Streaming Completion"
response = completion(
    model="hesperan/hesperan-1",
    messages=[{"role": "user", "content": "My parcel never arrived."}],
    response_format=Ticket,
    stream=True,
)

for chunk in response:
    print(chunk)
```

The whole answer arrives in one content chunk.

## Usage - LiteLLM Proxy Server

1. Add the model to your proxy config:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: hesperan-1
    litellm_params:
      model: hesperan/hesperan-1
      api_key: os.environ/HESPERAN_API_KEY
```

2. Start the proxy:

```bash
litellm --config /path/to/config.yaml
```

3. Call it with any OpenAI client and a `response_format`:

```bash showLineNumbers title="cURL"
curl http://0.0.0.0:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -d '{
    "model": "hesperan-1",
    "messages": [{"role": "user", "content": "I was charged twice for my order."}],
    "response_format": {"type": "json_schema", "json_schema": {"name": "ticket", "schema": {
      "type": "object",
      "properties": {"urgent": {"type": "boolean", "description": "The customer has lost money."}},
      "required": ["urgent"], "additionalProperties": false}}}
  }'
```

## Supported Parameters

Hesperan uses `messages` (text content), `response_format` (`json_schema`), `stream` and `stream_options`. Sampling parameters such as `temperature` or `max_tokens` are accepted and ignored, `n` must be 1 and `tools` are not used.
