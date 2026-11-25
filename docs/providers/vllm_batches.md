---
title: "vLLM Batch and Files API with LiteLLM"
sidebar_label: "vLLM - Batch + Files API"
description: "Run OpenAI Batch API jobs against a hosted vLLM server through the LiteLLM AI Gateway, which stores the input file, runs each line and serves the results."
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# vLLM - Batch + Files API

vLLM's OpenAI compatible server supports `/v1/chat/completions`, `/v1/completions`, `/v1/embeddings` and `/v1/responses` but has no `/v1/files` or `/v1/batches` routes. LiteLLM provides the missing piece: for a `hosted_vllm` deployment where the server has no Files API the proxy will store the batch input itself, run each line through the deployment and serve the batch status and the output files. Clients simply call the standard OpenAI Batch API against vLLM with no changes.

| Feature | Supported |
|---------|-----------|
| `/v1/files` | ✅ stored by LiteLLM |
| `/v1/batches` | ✅ run by LiteLLM |
| Cost Tracking | ✅ every line is billed to the key that created the batch |

This flow runs on the proxy and requires a database (`DATABASE_URL`) as the input file, the batch status and the result files all reside there.

## When LiteLLM runs the batch itself

LiteLLM makes the decision on a per-request basis. LiteLLM will run the batch for a deployment only if two conditions are met. Firstly, `litellm_params.model` must start with `hosted_vllm/`. Secondly, `GET {api_base}/files` on its server must return a 404. For every other deployment and for a `hosted_vllm` deployment whose server does in fact implement the Files API (e.g. the vLLM production stack router), the passthrough behaviour is maintained: the upload and the batch are both forwarded to the server which then runs the batch.

Point `api_base` at the server's `/v1` root so the probe hits the right route

## Quick Start

### 1. Setup config.yaml

```yaml
model_list:
  - model_name: my-vllm-model
    litellm_params:
      model: hosted_vllm/Qwen/Qwen2.5-0.5B-Instruct
      api_base: http://localhost:8000/v1  # your vLLM server
      api_key: os.environ/HOSTED_VLLM_API_KEY  # only if your server checks one

general_settings:
  database_url: os.environ/DATABASE_URL
```

### 2. Start LiteLLM Proxy

```bash
litellm --config /path/to/config.yaml
```

### 3. Create Batch File

Each line is in the OpenAI batch input shape. LiteLLM will substitute `body.model` with the name of the deployment that the batch is using so what you have in that field won't actually change which server the line gets run on.

```jsonl
{"custom_id": "request-1", "method": "POST", "url": "/v1/chat/completions", "body": {"model": "my-vllm-model", "messages": [{"role": "user", "content": "Hello!"}]}}
{"custom_id": "request-2", "method": "POST", "url": "/v1/chat/completions", "body": {"model": "my-vllm-model", "messages": [{"role": "user", "content": "How are you?"}]}}
```

The `url` on every line has to match the `endpoint` that you supply with the batch. `stream: true` lines, duplicate `custom_id`s and unknown top level fields are rejected at the time you're creating the batch with a 400 that states the problem. The upload itself only validates that each line is a JSON object containing `custom_id`, `method`, `url` and `body`.

### 4. Upload File & Create Batch

:::tip[Model Routing]
The upload must name the deployment either via the `x-litellm-model` header, the `?model=` query parameter or the `target_model_names` form field. Set `purpose=batch` on the upload. For a deployment that LiteLLM is running batches for, any upload with a different purpose will result in a 400. The vLLM server has no Files API to keep the file in. The returned file id is a long base64 id (not an OpenAI-style `file-...` id) and batch operations on that id will automatically route to the same deployment.
:::

<Tabs>
<TabItem value="curl" label="cURL">

**Upload File**

```bash
curl http://localhost:4000/v1/files \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "x-litellm-model: my-vllm-model" \
  -F purpose="batch" \
  -F file="@batch_requests.jsonl"
```

**Create Batch**

```bash
curl http://localhost:4000/v1/batches \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "input_file_id": "<file id from the upload>",
    "endpoint": "/v1/chat/completions",
    "completion_window": "24h"
  }'
```

**Check Batch Status**

```bash
curl http://localhost:4000/v1/batches/<batch id> \
  -H "Authorization: Bearer $LITELLM_API_KEY"
```

**Download the results**

```bash
curl http://localhost:4000/v1/files/<output_file_id>/content \
  -H "Authorization: Bearer $LITELLM_API_KEY"
```

</TabItem>
<TabItem value="python" label="OpenAI SDK">

```python
import os
import time

from openai import OpenAI

client = OpenAI(api_key=os.environ["LITELLM_API_KEY"], base_url="http://localhost:4000/v1")

input_file = client.files.create(
    file=open("batch_requests.jsonl", "rb"),
    purpose="batch",
    extra_headers={"x-litellm-model": "my-vllm-model"},
)

batch = client.batches.create(
    input_file_id=input_file.id,
    endpoint="/v1/chat/completions",
    completion_window="24h",
)

while batch.status not in ("completed", "failed", "cancelled", "expired"):
    time.sleep(5)
    batch = client.batches.retrieve(batch.id)

if batch.output_file_id:
    print(client.files.content(batch.output_file_id).text)
if batch.error_file_id:
    print(client.files.content(batch.error_file_id).text)
```

</TabItem>
</Tabs>

## Supported Operations

| Operation | Endpoint | Method |
|-----------|----------|--------|
| Upload file | `/v1/files` | POST |
| Retrieve file | `/v1/files/{file_id}` | GET |
| Delete file | `/v1/files/{file_id}` | DELETE |
| Get file content | `/v1/files/{file_id}/content` | GET |
| Create batch | `/v1/batches` | POST |
| List batches | `/v1/batches` | GET |
| Retrieve batch | `/v1/batches/{batch_id}` | GET |
| Cancel batch | `/v1/batches/{batch_id}/cancel` | POST |

Batch `endpoint` can be `/v1/chat/completions`, `/v1/completions`, `/v1/embeddings`, or `/v1/responses`

## How a batch runs

The batch is created as `validating`, moves to `in_progress` as the proxy replica which received the create runs the lines, then to `finalizing` as the result files are written and ends as `completed`. Lines which the server rejects go into the error file with the server's status code and the batch still completes. A cancel marks the batch as `cancelling`, allows the lines in flight to finish and ends it as `cancelled` (output of lines that have finished is retained). The 24 hour `completion_window` is dealt with in the same way. When the window closes LiteLLM terminates the lines still running and drops the lines not yet started. Those lines end up in the error file as `batch_expired`. The batch ends as `expired` and the output of the lines that finished in time is retained.

Results come back in OpenAI's batch output format (`output_file_id` has one line per successful request, `error_file_id` has one line per failed request). Both are served to the key that created the batch, to other keys of the same user/team and to proxy admins.

Each line is billed through the router as its own request, with the creating key, team and tags on the spend log at the price set on the deployment. A deployment with no price will have its lines logged with a spend of 0.

If the replica which is running the batch restarts, the batch is marked `failed` with an `runner_lost` error the next time it is retrieved more than 3 minutes after its last progress write. Resubmit it.

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `LITELLM_EXECUTED_BATCH_CONCURRENCY` | `4` | How many lines of one batch run in parallel |
| `general_settings.allow_client_side_credentials` | `false` | Batch lines follow the same rule as live requests in that a line whose body contains `api_base`, `api_key` or some other client side credential field will be rejected upon batch creation unless it's `true` or the deployment has that field in `configurable_clientside_auth_params` |

The proxy's pre-call guardrails run over every line when the file is uploaded and can either rewrite or drop the line, or reject the upload at that point. They don't run again as each line is processed.

## Related

- [vLLM Provider Overview](./vllm)
- [Batch API Overview](../batches)
- [Files API](../files_endpoints)
