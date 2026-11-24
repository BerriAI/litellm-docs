---
title: "meraGPT API with LiteLLM: Extractor, Restyler and Fanout"
sidebar_label: "meraGPT"
description: "Call meraGPT's Extractor, Restyler and Fanout models through LiteLLM's OpenAI-compatible route, with streaming, cost tracking and the LiteLLM proxy."
---

# meraGPT

## Overview

| Property | Details |
|-------|-------|
| Description | meraGPT serves small task-specific models over one HTTP API. Extractor returns the fields you define in a JSON Schema from text or from photos and scans of a document, as one JSON object that fits the schema. Restyler rewrites machine-written prose so it reads as though a person wrote it and keeps its facts, names, numbers and links. Fanout takes a question someone would ask an AI assistant and returns the web searches that assistant is likely to run before answering |
| Provider Route on LiteLLM | `meragpt/` |
| Link to Provider Doc | [meraGPT Documentation](https://meragpt.com/docs) |
| Default Base URL | `https://meragpt.com/v1` |
| Supported Operations | `/chat/completions`, plus `/messages` and `/responses` through LiteLLM's adapters |

LiteLLM calls meraGPT's OpenAI-compatible `/v1/chat/completions` endpoint. Spend is priced from the `meragpt/` cost map entries and reported under provider `meragpt`.

## API Key

Create a key in the [meraGPT dashboard](https://meragpt.com/dashboard). Keys begin with `mg-live-` and are sent as a Bearer token.

```python showLineNumbers title="Environment Variables"
import os

os.environ["MERAGPT_API_KEY"] = "mg-live-..."
os.environ["MERAGPT_API_BASE"] = "https://meragpt.com/v1"  # optional override
```

You can also pass `api_key` to `completion`. If neither `api_key` nor `MERAGPT_API_KEY` is set, LiteLLM raises an `AuthenticationError` before it sends anything. It does not fall back to `OPENAI_API_KEY` or `litellm.openai_key`, so an OpenAI key is never sent to meraGPT.

## Models

| Model | Context window | Max output tokens | Input / 1M tokens | Output / 1M tokens |
|-------|----------------|-------------------|-------------------|--------------------|
| `meragpt/restyler-1` | 4,096 | 2,048 | $0.04 | $0.16 |
| `meragpt/fanout-1` | 4,096 | 160 | $0.04 | $0.16 |
| `meragpt/extractor-1` | 32,768 | 4,096 | $0.04 | free |

Prices and limits follow meraGPT's public catalogue at [`GET https://meragpt.com/v1/models`](https://meragpt.com/v1/models), which needs no key. Restyler reads a document 900 words at a time, so one request can carry a document of up to 60,000 characters. Fanout takes a question of up to 2,000 characters and returns up to six searches. Extractor reads up to 600,000 characters of text, split into windows whose answers are merged, or up to six page images per request. Its output tokens are not charged.

Decider (`decider-1`) is not available on this route. It answers typed questions with probability distributions and generates no text, so meraGPT serves it only at `/v1/systemone` and answers a chat completion request for it with `400 wrong_endpoint_for_model`.

## How the chat route behaves

Each model does one job, so the chat endpoint differs from a general chat model in a few places. Only the last user message is used. Earlier turns and system messages are ignored. `temperature`, `top_p` and other sampling parameters are accepted and ignored, because each model's decoding is fixed. `tools`, `logprobs` and `n` are not supported. `response_format` is supported only for Extractor, as `{"type": "json_schema", ...}`; Restyler and Fanout do not take it.

Streaming works, though it is not token by token. Restyler streams one paragraph per chunk, and Fanout sends its whole list of searches in a single chunk.

## Usage - LiteLLM Python SDK

### Restyler

```python showLineNumbers title="meraGPT Restyler"
from litellm import completion

draft = "In today's fast-paced world, it is important to note that Q3 revenue grew 12% to $4.1M."

response = completion(
    model="meragpt/restyler-1",
    messages=[{"role": "user", "content": draft}],
)

print(response.choices[0].message.content)
```

### Fanout

Fanout returns its searches newline-joined in the message content.

```python showLineNumbers title="meraGPT Fanout"
from litellm import completion

response = completion(
    model="meragpt/fanout-1",
    messages=[{"role": "user", "content": "What are the best project management tools available right now?"}],
)

searches = response.choices[0].message.content.splitlines()
print(searches)
```

### Extractor

Pass the JSON Schema as `response_format`. The answer is the JSON object as a string in the message content, and a field the document does not state comes back `null`.

```python showLineNumbers title="meraGPT Extractor"
import json

from litellm import completion

response = completion(
    model="meragpt/extractor-1",
    messages=[{"role": "user", "content": "Invoice INV-20931 from Northwind Supplies. Total due $328.20 by 13 April 2026."}],
    response_format={
        "type": "json_schema",
        "json_schema": {
            "name": "invoice",
            "schema": {
                "type": "object",
                "properties": {
                    "invoice_number": {"type": "string"},
                    "total_due": {"type": "number"},
                    "due_date": {"type": "string", "format": "date"},
                    "purchase_order": {"type": "string"},
                },
            },
        },
    },
)

print(json.loads(response.choices[0].message.content))
```

To read a photo or scan, send the pages as `image_url` parts in the user message (up to six). Any text in that message is read as your instruction.

```python showLineNumbers title="meraGPT Extractor with images"
messages = [
    {
        "role": "user",
        "content": [
            {"type": "text", "text": "Extract the receipt."},
            {"type": "image_url", "image_url": {"url": "https://example.com/receipt.jpg"}},
        ],
    }
]
```

### Streaming

```python showLineNumbers title="meraGPT Streaming"
from litellm import completion

stream = completion(
    model="meragpt/restyler-1",
    messages=[{"role": "user", "content": "A long draft with several paragraphs."}],
    stream=True,
)

for chunk in stream:
    print(chunk.choices[0].delta.content or "", end="")
```

## Usage - LiteLLM Proxy

Save this as `config.yaml`:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: restyler-1
    litellm_params:
      model: meragpt/restyler-1
      api_key: os.environ/MERAGPT_API_KEY
  - model_name: fanout-1
    litellm_params:
      model: meragpt/fanout-1
      api_key: os.environ/MERAGPT_API_KEY
  - model_name: extractor-1
    litellm_params:
      model: meragpt/extractor-1
      api_key: os.environ/MERAGPT_API_KEY
```

Start the proxy in a shell where `MERAGPT_API_KEY` is set:

```bash
litellm --config config.yaml
```

Then send a request with your LiteLLM key:

```bash
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -d '{
    "model": "restyler-1",
    "messages": [{"role": "user", "content": "In today'\''s fast-paced world, it is important to note that Q3 revenue grew 12% to $4.1M."}]
  }'
```

## Errors and retries

meraGPT returns errors in the OpenAI envelope, so LiteLLM maps them to its usual exception types. A `429 capacity_saturated` carries a `Retry-After` header of 10 to 30 seconds and is not charged. Failed requests are not charged. See [Errors and limits](https://meragpt.com/docs/errors) for the full list.
