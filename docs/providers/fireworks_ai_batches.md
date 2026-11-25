---
title: "Fireworks AI Batch and Files API with LiteLLM"
sidebar_label: "Fireworks AI - Batch + Files API"
description: "Run OpenAI Batch API jobs against Fireworks AI models through the LiteLLM AI Gateway, which stores the input file, runs each line and serves the results."
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Fireworks AI - Batch + Files API

As of Nov 2026 Fireworks have turned off their own Batch API (new datasets and batch inference jobs are now rejected as they rebuild the API) and their inference server has no `/v1/files` route. LiteLLM is in that space. For a `fireworks_ai` deployment the proxy will store the batch input itself, run every line through the deployment and then serve the batch status and the output files. Clients simply call the standard OpenAI Batch API against Fireworks with no changes.

| Feature | Supported |
|---------|-----------|
| `/v1/files` | ✅ stored by LiteLLM |
| `/v1/batches` | ✅ run by LiteLLM |
| Cost Tracking | ✅ every line is billed to the key that created the batch |

This one runs on the proxy and requires a database (`DATABASE_URL`) as the input file, the batch status and the result files all reside in that database.

## When LiteLLM runs the batch itself

LiteLLM makes its decision on a per-request basis. LiteLLM will only run the batch for a given deployment when two conditions are met. Firstly, its `litellm_params.model` must start with `fireworks_ai/` or it must set `custom_llm_provider: fireworks_ai`. Secondly, `GET {api_base}/files` on its server must return a 404. The default `api_base` is `https://api.fireworks.ai/inference/v1` and that returns a 404 at the moment. You can override that with `api_base` or `FIREWORKS_API_BASE`.

If that check gets any other answer, or none within 5 seconds, the upload answers 400 with `LiteLLM doesn't support fireworks_ai for 'create_file'`

Each line is a standard Fireworks request and is therefore charged at the deployment's normal rate. There is no batch discount as the Fireworks batch service which would have provided one has now been turned off.

## Quick Start

### 1. Setup config.yaml

```yaml
model_list:
  - model_name: fw-deepseek-v4p1-flash
    litellm_params:
      model: fireworks_ai/accounts/fireworks/models/deepseek-v4p1-flash
      api_key: os.environ/FIREWORKS_AI_API_KEY

general_settings:
  database_url: os.environ/DATABASE_URL
```

### 2. Start LiteLLM Proxy

```bash
litellm --config /path/to/config.yaml
```

### 3. Create Batch File

Each line adheres to the OpenAI batch input shape. LiteLLM will substitute `body.model` with the name of the model for that batch so what you have in that field has no effect on which model actually runs the line. If multiple deployments share that model name then the router will simply distribute the lines across them in the same way as any other traffic.

```jsonl
{"custom_id": "request-1", "method": "POST", "url": "/v1/chat/completions", "body": {"model": "fw-deepseek-v4p1-flash", "messages": [{"role": "user", "content": "What is the capital of France?"}]}}
{"custom_id": "request-2", "method": "POST", "url": "/v1/chat/completions", "body": {"model": "fw-deepseek-v4p1-flash", "messages": [{"role": "user", "content": "What is 2+2?"}]}}
```

Every line must conform to the same `url`. The `url` on each line must match the `endpoint` you've provided in the batch. Lines with `stream: true`, duplicate `custom_id`s and unknown top level fields are rejected at the time of batch creation with a 400 that indicates the problem. The upload itself only validates that each line is a JSON object containing `custom_id`, `method`, `url` and `body`.

### 4. Upload File & Create Batch

:::tip[Model Routing]
The upload must name the deployment either via the `x-litellm-model` header, the `?model=` query parameter or the `target_model_names` form field. Set `purpose=batch` on the upload. LiteLLM will reject an upload with any other purpose with a 400. Fireworks has no file store in which to keep such a file. The file id that is returned is a long base64 id rather than an OpenAI-style `file-...` id. Batch operations on that file id will automatically route to the same deployment.
:::

<Tabs>
<TabItem value="curl" label="cURL">

**Upload File**

```bash
curl http://localhost:4000/v1/files \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "x-litellm-model: fw-deepseek-v4p1-flash" \
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

**Delete the files**

```bash
curl -X DELETE http://localhost:4000/v1/files/<input file id> \
  -H "Authorization: Bearer $LITELLM_API_KEY"
curl -X DELETE http://localhost:4000/v1/files/<output_file_id> \
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
    extra_headers={"x-litellm-model": "fw-deepseek-v4p1-flash"},
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
    client.files.delete(batch.output_file_id)
if batch.error_file_id:
    print(client.files.content(batch.error_file_id).text)
client.files.delete(input_file.id)
```

</TabItem>
</Tabs>

Use `/v1/files` and `/v1/batches` with any virtual key that may call the model. The provider prefixed `/fireworks_ai/v1/files` route does the same upload but is restricted to proxy admins.

## Where requests run (placement)

Fireworks will run serverless models wherever it chooses to schedule them. You can't specify a region on a serverless request. If you want to keep your batch traffic in a particular region then you create a Fireworks [on-demand deployment](https://docs.fireworks.ai/guides/ondemand-deployments) in that region and point your model at it. Fireworks sets the region when the deployment is created (via the `placement` field) and so in order to have a US region for example you need GPU quota in that region on your Fireworks account (see [Fireworks regions](https://docs.fireworks.ai/deployments/regions)). LiteLLM will then send each batch line to that deployment as a normal request:

```yaml
model_list:
  - model_name: fw-deepseek-v4p1-flash-us
    litellm_params:
      model: fireworks_ai/accounts/fireworks/models/deepseek-v4p1-flash#accounts/<your-account>/deployments/<deployment-id>
      api_key: os.environ/FIREWORKS_AI_API_KEY
```

## Data retention

Nothing gets uploaded to Fireworks as a file or a dataset. Each line is sent to Fireworks as a normal inference request, under the same data policy as any other request to that model. The input file, the batch status and the result files all reside in the proxy's database. `DELETE /v1/files/{file_id}` will remove the file and its content, at which point the content will return a 404. The batch record itself is not deleted. LiteLLM logs each line in exactly the same way as it would any other request. Deleting the files does not delete the logs.

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

The batch is created as `validating`, moves to `in_progress` whilst the proxy replica which received the create runs the lines, then to `finalizing` whilst the result files are written and ends at `completed`. If Fireworks rejects a line that line goes into the error file with Fireworks' status code and the batch still completes. A cancel marks the batch as `cancelling`, allows the lines in flight to complete and ends it at `cancelled`, retaining the output of the lines that have finished. LiteLLM enforces the 24 hour `completion_window` in the same way. When the window closes LiteLLM kills off the lines that are still running and drops the lines that haven't even started. Each of those lines goes into the error file as `batch_expired`. The batch ends at `expired` and retains the output of the lines that finished in time.

Results come back in the OpenAI batch output format as expected: `output_file_id` has one line per successful request and `error_file_id` has one line per failed request. Both are served to the key that created the batch, to any other keys of the same user or team and to proxy admins.

Each line is billed through the router as its own request, with the create key, team and tags all present on the spend log at the deployment's price.

If the replica which is running the batch restarts, the batch will be marked `failed` with a `runner_lost` error the next time it is retrieved more than 3 minutes after its last progress write. Resubmit it.

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `LITELLM_EXECUTED_BATCH_CONCURRENCY` | `4` | How many lines of one batch run in parallel |
| `general_settings.allow_client_side_credentials` | `false` | Batch lines follow the same rule as live requests in that a line whose body contains `api_base`, `api_key` or some other client side credential field will be rejected upon batch creation unless it's `true` or the deployment has that field listed in `configurable_clientside_auth_params` |

The proxy's pre-call guardrails run over every line when the file is uploaded and can rewrite or drop lines or indeed refuse the upload at that point. They don't run again as each line is executed.

## Related

- [Fireworks AI Provider Overview](./fireworks_ai)
- [vLLM batches](./vllm_batches), which LiteLLM runs the same way
- [Batch API Overview](../batches)
- [Files API](../files_endpoints)
