---
title: "Nodecode API with LiteLLM: Python SDK and Gateway"
sidebar_label: "Nodecode"
description: "Call Nodecode's Cyber v1 from the LiteLLM Python SDK or AI Gateway, with streaming, tool calling, reasoning effort, JSON schema output, native Messages and Responses, and cost tracking."
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Nodecode

[Nodecode](https://nodecode.ai) serves Cyber v1, an abliterated build of the open-weights DeepSeek V4.1 Flash 1017 model for security work, through an OpenAI-compatible API. The same API also answers the OpenAI Responses and Anthropic Messages formats itself, and it keeps no prompts or outputs (zero data retention).

<SinceVersion v="1.113.0" />

Provider support is added in [PR #51269](https://github.com/BerriAI/litellm/pull/51269). Use this version or a later build that includes it.

## Overview

| Property | Details |
|-------|-------|
| Description | Cyber v1, DeepSeek V4.1 Flash 1017 with its refusal direction abliterated, for security research and offensive security work |
| Provider Route on LiteLLM | `nodecode/` |
| Link to Provider Doc | [Nodecode API quickstart](https://nodecode.ai/docs/cyber) |
| Default Base URL | `https://api.nodecode.ai/v1` |
| Supported Operations | `/chat/completions`, `/responses` and `/messages`, all served natively by Nodecode |

Nodecode is its own provider on LiteLLM rather than a generic OpenAI-compatible route, so its spend is priced from the `nodecode/` cost map entry and reported under provider `nodecode`.

## API Key

Create a key at [nodecode.ai/account/keys](https://nodecode.ai/account/keys). It starts with `sk-nc-` and is shown once.

```python showLineNumbers title="Environment Variables"
import os

os.environ["NODECODE_API_KEY"] = "your-api-key"
os.environ["NODECODE_API_BASE"] = "https://api.nodecode.ai/v1"  # optional override
```

## Models

| Model | Context | Max output | Input / 1M | Output / 1M | Cache read / 1M |
|-------|---------|------------|------------|-------------|-----------------|
| `nodecode/nodecode-cyber-v1` | 1,048,576 | 131,072 | $0.33 | $1.32 | $0.009 |

Pricing follows [Nodecode's pricing page](https://nodecode.ai/pricing). Cyber v1 supports `tools`, `tool_choice` and a `json_schema` `response_format`, and it reads and writes text only. It reasons by default, and `reasoning_effort` takes `none`, `minimal`, `low`, `medium`, `high`, `xhigh` or `max`.

## Usage - LiteLLM Python SDK

### Chat Completions

```python showLineNumbers title="Nodecode Chat Completion"
import os
from litellm import completion

os.environ["NODECODE_API_KEY"] = "your-api-key"

response = completion(
    model="nodecode/nodecode-cyber-v1",
    messages=[{"role": "user", "content": "22/tcp and 8080/tcp are open. What next?"}],
)

print(response.choices[0].message.content)
```

### Streaming

```python showLineNumbers title="Nodecode Streaming Chat Completion"
import os
from litellm import completion

os.environ["NODECODE_API_KEY"] = "your-api-key"

response = completion(
    model="nodecode/nodecode-cyber-v1",
    messages=[{"role": "user", "content": "Explain SQL injection in two sentences"}],
    stream=True,
)

for chunk in response:
    print(chunk.choices[0].delta.content or "", end="")
```

### Tool Calling

```python showLineNumbers title="Nodecode Tool Calling"
import os
from litellm import completion

os.environ["NODECODE_API_KEY"] = "your-api-key"

tools = [
    {
        "type": "function",
        "function": {
            "name": "get_open_ports",
            "description": "List the open TCP ports of a host in scope",
            "parameters": {
                "type": "object",
                "properties": {"host": {"type": "string", "description": "Host or IP"}},
                "required": ["host"],
            },
        },
    }
]

response = completion(
    model="nodecode/nodecode-cyber-v1",
    messages=[{"role": "user", "content": "Which ports are open on scanme.nmap.org?"}],
    tools=tools,
    tool_choice="auto",
)

print(response.choices[0].message.tool_calls)
```

### Reasoning Effort

Cyber v1 thinks before it answers unless you tell it not to. `reasoning_effort` sets how much it thinks, and `none` or `minimal` turn thinking off, which makes short answers faster and cheaper. LiteLLM returns the thinking in `reasoning_content`, and reasoning tokens count toward `max_tokens`.

```python showLineNumbers title="Nodecode Reasoning Effort"
import os
from litellm import completion

os.environ["NODECODE_API_KEY"] = "your-api-key"

response = completion(
    model="nodecode/nodecode-cyber-v1",
    messages=[{"role": "user", "content": "How many prime numbers are there below 100?"}],
    reasoning_effort="high",
)

print(response.choices[0].message.reasoning_content)
print(response.choices[0].message.content)
```

### Structured Output

```python showLineNumbers title="Nodecode JSON Schema Output"
import os
from litellm import completion

os.environ["NODECODE_API_KEY"] = "your-api-key"

prompt = "Name the product CVE-2021-44228 affects and rate its severity from 1 to 10."

response = completion(
    model="nodecode/nodecode-cyber-v1",
    messages=[{"role": "user", "content": prompt}],
    response_format={
        "type": "json_schema",
        "json_schema": {
            "name": "cve_rating",
            "strict": True,
            "schema": {
                "type": "object",
                "properties": {
                    "product": {"type": "string"},
                    "severity": {"type": "integer"},
                },
                "required": ["product", "severity"],
                "additionalProperties": False,
            },
        },
    },
)

print(response.choices[0].message.content)
```

## Usage - LiteLLM AI Gateway

Add Nodecode to your Gateway configuration:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: cyber-v1
    litellm_params:
      model: nodecode/nodecode-cyber-v1
      api_key: os.environ/NODECODE_API_KEY

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

Start the Gateway:

```bash showLineNumbers title="Start LiteLLM Gateway"
export NODECODE_API_KEY="your-api-key"
export LITELLM_MASTER_KEY="sk-local-nodecode"
litellm --config config.yaml --port 4000

# RUNNING on http://0.0.0.0:4000
```

<Tabs>
<TabItem value="openai-sdk" label="OpenAI SDK">

```python showLineNumbers title="Nodecode via Gateway - OpenAI SDK"
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:4000",
    api_key="sk-local-nodecode",
)

response = client.chat.completions.create(
    model="cyber-v1",
    messages=[{"role": "user", "content": "hello from litellm"}],
)

print(response.choices[0].message.content)
```

</TabItem>

<TabItem value="curl" label="cURL">

```bash showLineNumbers title="Nodecode via Gateway - cURL"
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -d '{
    "model": "cyber-v1",
    "messages": [{"role": "user", "content": "hello from litellm"}]
  }'
```

</TabItem>
</Tabs>

You can also add Nodecode from the Admin UI. Go to Models, then Add Model, pick Nodecode as the provider, enter `nodecode/nodecode-cyber-v1` as the model, and paste your key. The API Base field is optional and defaults to `https://api.nodecode.ai/v1`.

## Anthropic Messages and Responses

Nodecode serves `/v1/messages` and `/v1/responses` itself, so LiteLLM sends those requests to Nodecode's own endpoints instead of translating them into chat completions. That holds for `litellm.anthropic.messages.acreate()` and `litellm.responses()` in the SDK, and for the Gateway's `/v1/messages` and `/v1/responses` routes.

<Tabs>
<TabItem value="messages" label="Anthropic Messages">

```bash showLineNumbers title="Anthropic Messages through LiteLLM Gateway"
curl http://localhost:4000/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "cyber-v1",
    "max_tokens": 1024,
    "messages": [{"role": "user", "content": "hello from litellm"}]
  }'
```

</TabItem>

<TabItem value="responses" label="Responses">

```bash showLineNumbers title="Responses through LiteLLM Gateway"
curl http://localhost:4000/v1/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -d '{
    "model": "cyber-v1",
    "input": "hello from litellm"
  }'
```

</TabItem>
</Tabs>

## Cost Tracking

The `nodecode/` model is registered in LiteLLM's model cost map, so per-request spend is computed automatically, returned in the `x-litellm-response-cost` response header, and recorded in spend logs under provider `nodecode`. When Nodecode reports cached prompt tokens in `prompt_tokens_details.cached_tokens`, LiteLLM bills those at the cache read rate from the table above and the rest of the prompt at the input rate.

```python showLineNumbers title="Read the response cost"
print(f"Request cost: ${response._hidden_params['response_cost']}")
```

LiteLLM prices every call at the weekday rates in the table, so tracked spend differs from your Nodecode bill in two cases. Nodecode halves every price from Friday 00:00 to Monday 00:00 Amsterdam time, and a request with more than 262,144 input tokens pays four times the cache read rate for its cached tokens.

## Custom Endpoints

Set `NODECODE_API_BASE` or pass `api_base` to point the `nodecode/` route at a different Nodecode endpoint. The route keeps the provider identity and pricing either way.

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: cyber-v1
    litellm_params:
      model: nodecode/nodecode-cyber-v1
      api_base: https://your-nodecode-endpoint/v1
      api_key: os.environ/NODECODE_API_KEY
```
