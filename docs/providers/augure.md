import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Augure

## Overview

| Property | Details |
|-------|-------|
| Description | Augure is a Canadian AI platform with an OpenAI-compatible chat completions API. Customer data is stored in Canada and inference runs on Canadian infrastructure or with vetted EU partners under zero-data-retention agreements, never with providers in the United States. |
| Provider Route on LiteLLM | `augure/` |
| Link to Provider Doc | [Augure API reference ↗](https://augureai.ca/docs/api) |
| Base URL | `https://api.augureai.ca/v1` |
| Supported Operations | [`/chat/completions`](#usage---litellm-python-sdk) |

<br />
<br />

**We support ALL Augure chat models, just set `augure/` as a prefix when sending requests**

## Available Models

Augure publishes its prices in Canadian dollars. The USD figures below are the CAD list prices divided by the Bank of Canada rate of 1.4038 CAD per USD on October 27, 2026, and they are what LiteLLM's cost map carries for these models. Check [Augure models](https://augureai.ca/docs/models) for the current CAD prices and retirement notices.

| Model | Context | Max output | Input $/1M | Cached input $/1M | Output $/1M | Notes |
|-------|---------|------------|------------|-------------------|-------------|-------|
| `augure/ossington-5` | 256K | 32,768 | 1.0685 | 0.4274 | 2.1371 | Default reasoning model. Images and PDFs. `reasoning_effort="none"` turns thinking off. |
| `augure/rosedale-1` | 1M | 32,768 | 1.7809 | | 4.2741 | Largest context. Whole-document analysis and agent loops. Images and PDFs. |
| `augure/tofino-3` | 256K | 16,384 | 0.4274 | | 1.4247 | Fast everyday model. Thinking is always off. Images and PDFs. |
| `augure/ossington-4-1` | 256K | 32,768 | 1.7809 | | 4.2741 | Reasoning with strong bilingual English and French output. Images and PDFs. |
| `augure/open-glm-5-3` | 256K | 49,152 | 2.1371 | | 4.9865 | Augure Open preview, GLM-5.3 open weights. Text only. |
| `augure/open-qwen-3.8-flash-next` | 256K | 32,768 | 1.4247 | | 2.8494 | Augure Open preview, Qwen3.8-Flash-Next open weights. Text only. |

Models other than `ossington-5` bill cached input at the standard input rate. Augure also accepts `model="auto"` to let the gateway pick a model per request; LiteLLM has no price for that id, so pass a named model when you need cost tracking.

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["AUGURE_API_KEY"] = ""  # your Augure key, starts with aug_sk_live_
os.environ["AUGURE_API_BASE"] = ""  # optional, defaults to https://api.augureai.ca/v1
```

Keys come from the [Augure developer dashboard](https://chat.augureai.ca/developers/dashboard).

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="Augure Non-streaming Completion"
import os
from litellm import completion

os.environ["AUGURE_API_KEY"] = ""  # your Augure key

response = completion(
    model="augure/ossington-5",
    messages=[{"role": "user", "content": "Summarise this clause in one sentence."}],
)

print(response.choices[0].message.content)
```

### Streaming

```python showLineNumbers title="Augure Streaming Completion"
import os
from litellm import completion

os.environ["AUGURE_API_KEY"] = ""  # your Augure key

response = completion(
    model="augure/tofino-3",
    messages=[{"role": "user", "content": "Write a short note about Canadian winters."}],
    stream=True,
    stream_options={"include_usage": True},
)

for chunk in response:
    if chunk.choices:
        print(chunk.choices[0].delta.content or "", end="")
    if getattr(chunk, "usage", None):
        print(chunk.usage)
```

### Reasoning effort

The reasoning models accept `reasoning_effort`. On `ossington-5` and `ossington-4-1`, `"none"` turns thinking off, which is much faster on short mechanical tasks. On `rosedale-1`, `"none"` is served as `"low"`. `tofino-3` accepts the parameter and ignores it. Thinking comes back in `message.reasoning_content`.

```python showLineNumbers title="Augure Reasoning Effort"
from litellm import completion

response = completion(
    model="augure/ossington-5",
    messages=[{"role": "user", "content": "Reply with the single word: ok"}],
    reasoning_effort="none",
)

print(response.choices[0].message.content)
```

Omit `max_tokens` on the reasoning models, or set it to at least 1,024, so a short budget does not cut off the thinking. LiteLLM maps `max_completion_tokens` to `max_tokens` for this provider.

### Tools and structured output

Chat completions support `tools`, `tool_choice`, and `response_format` with `json_object` and `json_schema`. On the reasoning models, `response_format` is enforced by a prompt-level directive, so validate the result and retry once on failure, and do not combine it with `tools` on those models. See [LiteLLM function calling](../completion/function_call.md) and [structured outputs](../completion/json_mode.md).

### Images and PDFs

`ossington-5`, `rosedale-1`, `tofino-3`, and `ossington-4-1` take `image_url` parts and base64 `file` parts for PDFs. The gateway extracts the PDF text layer and OCRs scanned pages. The Augure Open models are text only and return HTTP 400 with code `unsupported_content` for image or file parts.

```python showLineNumbers title="Augure PDF Input"
import base64
from litellm import completion

with open("contract.pdf", "rb") as f:
    pdf = base64.b64encode(f.read()).decode()

response = completion(
    model="augure/ossington-5",
    messages=[
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "List the termination clauses."},
                {"type": "file", "file": {"filename": "contract.pdf", "file_data": f"data:application/pdf;base64,{pdf}"}},
            ],
        }
    ],
)

print(response.choices[0].message.content)
```

## Usage - LiteLLM Proxy Server

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: ossington-5
    litellm_params:
      model: augure/ossington-5
      api_key: os.environ/AUGURE_API_KEY
  - model_name: tofino-3
    litellm_params:
      model: augure/tofino-3
      api_key: os.environ/AUGURE_API_KEY

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

Start the proxy:

```bash showLineNumbers title="Start LiteLLM Proxy"
export AUGURE_API_KEY="your-api-key"
export LITELLM_MASTER_KEY="sk-local-augure"
litellm --config config.yaml --port 4000

# RUNNING on http://0.0.0.0:4000
```

<Tabs>
<TabItem value="chat" label="Chat Completions">

```bash showLineNumbers title="curl"
curl http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "tofino-3",
    "messages": [{"role": "user", "content": "Reply with the single word: ok"}],
    "max_tokens": 8
  }'
```

</TabItem>
<TabItem value="openai-sdk" label="OpenAI SDK">

```python showLineNumbers title="Augure via Proxy - OpenAI SDK"
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:4000",
    api_key="sk-local-augure",
)

response = client.chat.completions.create(
    model="ossington-5",
    messages=[{"role": "user", "content": "hello from litellm"}],
)

print(response.choices[0].message.content)
```

</TabItem>
</Tabs>

Every Augure response carries an `_augure` object with `gateway_region`, `inference_region`, and `request_id`. The `inference_region` value starts with `ca-` when the request was served in Canada.

## Cost Tracking

LiteLLM's model cost map has USD prices for the six models above, so spend is tracked without extra config. Cached prompt tokens on `ossington-5` are billed at its cached-input rate using `usage.prompt_tokens_details.cached_tokens`. The cost is returned in the `x-litellm-response-cost` response header and recorded in spend logs. Augure bills in CAD, so the USD figure in LiteLLM differs from your invoice by the exchange rate.

## Custom API Base

**Option 1: Environment variable**

```python showLineNumbers title="Custom API Base via env var"
import os
from litellm import completion

os.environ["AUGURE_API_BASE"] = "https://custom.augure.example/v1"
os.environ["AUGURE_API_KEY"] = ""  # your API key

response = completion(
    model="augure/ossington-5",
    messages=[{"role": "user", "content": "Hello!"}],
)
```

**Option 2: Pass directly**

```python showLineNumbers title="Custom API Base via parameter"
from litellm import completion

response = completion(
    model="augure/ossington-5",
    messages=[{"role": "user", "content": "Hello!"}],
    api_base="https://custom.augure.example/v1",
    api_key="your-api-key",
)
```

## Troubleshooting

For `401`, check the key in the process environment. For `400` with code `model_retired`, the model id was retired and the error names its replacement; [Augure models](https://augureai.ca/docs/models) lists retirement dates. For `400` with code `context_length_exceeded`, the prompt is over the model's window. For `503` with code `residency_unavailable`, the account is Canada-only and no Canadian capacity was available, so retry with backoff.
