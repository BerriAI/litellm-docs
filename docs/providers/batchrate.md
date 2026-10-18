import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Batchrate - Batch + Files API

[Batchrate](https://batchrate.ai) is a batch-only inference API for open-weight models. It implements the OpenAI Files and Batches APIs at `https://api.batchrate.ai/v1`, so LiteLLM reaches it through the `openai` provider with `api_base` set. No Batchrate-specific provider or package is needed.

| Property | Details |
|----------|---------|
| Description | Batch inference on open-weight models through the OpenAI Files and Batches APIs. |
| Provider Route on LiteLLM | `openai` with `api_base="https://api.batchrate.ai/v1"` |
| Supported Operations | `/v1/files`, `/v1/batches` (batch `endpoint`: `/v1/chat/completions`) |
| Completion window | `24h` |
| Link to Provider Doc | [Batchrate LiteLLM docs](https://batchrate.ai/docs#litellm) |

Batchrate does not serve live `/v1/chat/completions` calls. Requests go inside the batch input file, so do not route live chat traffic to it.

## Models

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|-------|-----------------------|------------------------|
| `qwen3.6-35b-a3b` | $0.05 | $0.40 |

New accounts get 10M free tokens. Create an API key in the [Batchrate console](https://batchrate.ai) and export it as `BATCHRATE_API_KEY`.

## Batch input file

Each line follows the OpenAI batch input shape. LiteLLM uploads the file unchanged, so `body.model` is the Batchrate model name:

```jsonl
{"custom_id": "req-1", "method": "POST", "url": "/v1/chat/completions", "body": {"model": "qwen3.6-35b-a3b", "messages": [{"role": "user", "content": "Classify the sentiment: 'Arrived late but works fine.'"}], "max_tokens": 64, "chat_template_kwargs": {"enable_thinking": false}}}
{"custom_id": "req-2", "method": "POST", "url": "/v1/chat/completions", "body": {"model": "qwen3.6-35b-a3b", "messages": [{"role": "user", "content": "Classify the sentiment: 'Exactly what I ordered.'"}], "max_tokens": 64, "chat_template_kwargs": {"enable_thinking": false}}}
```

`chat_template_kwargs` turns off thinking for that line; leave it out to keep thinking on. `custom_id` can be at most 128 characters, and batch `metadata` values must be strings.

## Usage - LiteLLM Python SDK

```python showLineNumbers title="Batchrate batch with the LiteLLM SDK"
import os
import time

import litellm

kw = dict(
    custom_llm_provider="openai",
    api_base="https://api.batchrate.ai/v1",
    api_key=os.environ["BATCHRATE_API_KEY"],
)

input_file = litellm.create_file(file=open("batch_input.jsonl", "rb"), purpose="batch", **kw)

batch = litellm.create_batch(
    input_file_id=input_file.id,
    endpoint="/v1/chat/completions",
    completion_window="24h",
    metadata={"job": "sentiment"},
    **kw,
)

while batch.status not in ("completed", "failed", "cancelled", "expired"):
    time.sleep(60)
    batch = litellm.retrieve_batch(batch_id=batch.id, **kw)

if batch.output_file_id:
    print(litellm.file_content(file_id=batch.output_file_id, **kw).content)
```

## Usage - LiteLLM Proxy

### 1. Add Batchrate to config.yaml

`files_settings` holds the credentials the proxy uses for `/v1/files` and `/v1/batches`. The `model_list` entry names the model the batch lines run on; it is not for live chat calls.

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: qwen3.6-35b-a3b
    litellm_params:
      model: openai/qwen3.6-35b-a3b
      api_base: https://api.batchrate.ai/v1
      api_key: os.environ/BATCHRATE_API_KEY

files_settings:
  - custom_llm_provider: openai
    api_base: https://api.batchrate.ai/v1
    api_key: os.environ/BATCHRATE_API_KEY
```

### 2. Start the proxy

```bash
litellm --config config.yaml
```

### 3. Upload, create, poll and download

Files and batches calls carry the `custom-llm-provider: openai` header so the proxy routes them through `files_settings`.

<Tabs>
<TabItem value="openai-sdk" label="OpenAI SDK">

```python showLineNumbers title="Batchrate batch through the LiteLLM Proxy"
import os
import time

from openai import OpenAI

client = OpenAI(api_key=os.environ["LITELLM_API_KEY"], base_url="http://localhost:4000/v1")
route = {"custom-llm-provider": "openai"}

input_file = client.files.create(
    file=open("batch_input.jsonl", "rb"),
    purpose="batch",
    extra_headers=route,
)

batch = client.batches.create(
    input_file_id=input_file.id,
    endpoint="/v1/chat/completions",
    completion_window="24h",
    extra_headers=route,
)

while batch.status not in ("completed", "failed", "cancelled", "expired"):
    time.sleep(60)
    batch = client.batches.retrieve(batch.id, extra_headers=route)

if batch.output_file_id:
    print(client.files.content(batch.output_file_id, extra_headers=route).text)
```

</TabItem>
<TabItem value="curl" label="cURL">

```bash
curl http://localhost:4000/v1/files \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "custom-llm-provider: openai" \
  -F purpose="batch" \
  -F file="@batch_input.jsonl"

curl http://localhost:4000/v1/batches \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "custom-llm-provider: openai" \
  -H "Content-Type: application/json" \
  -d '{"input_file_id": "<file id>", "endpoint": "/v1/chat/completions", "completion_window": "24h"}'

curl http://localhost:4000/v1/batches/<batch id> \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "custom-llm-provider: openai"

curl http://localhost:4000/v1/files/<output_file_id>/content \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "custom-llm-provider: openai"
```

</TabItem>
</Tabs>

## How a batch runs

Batches move through `validating`, `in_progress`, `finalizing` and `completed`, the same states OpenAI uses. Batchrate groups small batches before running them, so a small batch can sit in `in_progress` for a while before any lines complete; poll every minute or so rather than every few seconds. Results come back in OpenAI's batch output shape: one line per successful request in `output_file_id`, and one line per failed request in `error_file_id`.

## Related

- [Batch API Overview](../batches)
- [Files API](../files_endpoints)
- [OpenAI-Compatible Endpoints](./openai_compatible)
