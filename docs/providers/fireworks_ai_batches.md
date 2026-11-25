---
title: "Fireworks AI Batch and Files API with LiteLLM"
sidebar_label: "Fireworks AI - Batch + Files API"
description: "Run OpenAI Batch API jobs against Fireworks AI models through the LiteLLM AI Gateway, which stores the input file, runs each line and serves the results."
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Fireworks AI - Batch + Files API

As of November 2026, Fireworks has turned off its own Batch API: new datasets and batch inference jobs are refused while Fireworks rebuilds it, and its inference server has no `/v1/files` route. LiteLLM fills that gap. For a `fireworks_ai` deployment, the proxy stores the batch input itself, runs every line through the deployment, and serves the batch status and the output files, so the OpenAI Batch API works against Fireworks unchanged

| Feature | Supported |
|---------|-----------|
| `/v1/files` | ✅ stored by LiteLLM |
| `/v1/batches` | ✅ run by LiteLLM |
| Cost Tracking | ✅ every line is billed to the key that created the batch |

This flow runs on the proxy and needs a database (`DATABASE_URL`), because the input file, the batch status, and the result files live there

## When LiteLLM runs the batch itself

LiteLLM decides per request. A deployment qualifies when its `litellm_params.model` starts with `fireworks_ai/` (or it sets `custom_llm_provider: fireworks_ai`) and `GET {api_base}/files` on its server answers 404, which is what `https://api.fireworks.ai/inference/v1` (the default `api_base`, overridden by `api_base` or `FIREWORKS_API_BASE`) answers today

If that check gets any other answer, or none within 5 seconds, the upload answers 400 with `LiteLLM doesn't support fireworks_ai for 'create_file'`

Each line is a normal Fireworks request, so it is billed at the deployment's regular price. There is no batch discount, because the Fireworks batch service that gave one is turned off

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

Each line follows the OpenAI batch input shape. LiteLLM replaces `body.model` with the batch's model name, so what you put there does not change which model runs the line. When several deployments share that model name, the router spreads the lines across them like any other traffic

```jsonl
{"custom_id": "request-1", "method": "POST", "url": "/v1/chat/completions", "body": {"model": "fw-deepseek-v4p1-flash", "messages": [{"role": "user", "content": "What is the capital of France?"}]}}
{"custom_id": "request-2", "method": "POST", "url": "/v1/chat/completions", "body": {"model": "fw-deepseek-v4p1-flash", "messages": [{"role": "user", "content": "What is 2+2?"}]}}
```

Every line has to name the same `url`, and it has to match the `endpoint` you give the batch. `stream: true` lines, duplicate `custom_id`s, and unknown top-level fields are rejected when you create the batch, with a 400 that names the problem. The upload itself only checks that each line is a JSON object with `custom_id`, `method`, `url`, and `body`

### 4. Upload File & Create Batch

:::tip[Model Routing]
The upload has to name the deployment, either with the `x-litellm-model` header, the `?model=` query parameter, or the `target_model_names` form field. Use `purpose=batch`: an upload with another purpose answers 400, because there is no Fireworks file store to keep it in. The returned file id is a long base64 id, not an OpenAI-style `file-...` id; batch operations on it route to the same deployment automatically
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

Use `/v1/files` and `/v1/batches` with any virtual key that may call the model. The provider-prefixed `/fireworks_ai/v1/files` route runs the same upload but is limited to proxy admins

## Where requests run (placement)

Fireworks serverless models run wherever Fireworks schedules them, and a serverless request takes no region setting. To keep batch traffic in one region, create a Fireworks [on-demand deployment](https://docs.fireworks.ai/guides/ondemand-deployments) placed in that region and point the model at it. Fireworks sets the region when the deployment is created, through its `placement` field, and a region such as a US one needs GPU quota there on your Fireworks account (see [Fireworks regions](https://docs.fireworks.ai/deployments/regions)). The batch lines then run on that deployment like any other request to it:

```yaml
model_list:
  - model_name: fw-deepseek-v4p1-flash-us
    litellm_params:
      model: fireworks_ai/accounts/fireworks/models/deepseek-v4p1-flash#accounts/<your-account>/deployments/<deployment-id>
      api_key: os.environ/FIREWORKS_AI_API_KEY
```

## Data retention

Nothing is uploaded to Fireworks as a file or dataset. Each line reaches Fireworks as a normal inference request, under the same data policy as any other request to that model. The input file, the batch status, and the result files live in the proxy's database. `DELETE /v1/files/{file_id}` removes a file and its content, after which the content answers 404. The batch record itself stays, and each line is logged like any other request, so whatever your logging setup keeps stays after the files are deleted

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

The batch is created as `validating`, moves to `in_progress` while the proxy replica that received the create runs the lines, then `finalizing` while the result files are written, and ends `completed`. Lines Fireworks rejects land in the error file with Fireworks' status code, and the batch still completes. Cancelling marks the batch `cancelling`, lets the lines in flight finish, and ends it `cancelled`, keeping the output of the lines that already finished. The 24 hour `completion_window` is enforced the same way: a line still unfinished when it closes is cut off and lands in the error file as `batch_expired`, and the batch ends `expired`, keeping the output of the lines that finished in time

Results come back in OpenAI's batch output shape: `output_file_id` holds one line per successful request and `error_file_id` one line per failed request. Both are served to the key that created the batch, other keys of the same user or team, and proxy admins

Each line is billed through the router as its own request, with the creating key, team, and tags on the spend log, at the deployment's price

If the replica running a batch restarts, the batch is marked `failed` with a `runner_lost` error the next time it is retrieved more than three minutes after its last progress write. Resubmit it

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `LITELLM_EXECUTED_BATCH_CONCURRENCY` | `4` | How many lines of one batch run in parallel |
| `general_settings.allow_client_side_credentials` | `false` | Batch lines follow the same rule as live requests: a line whose body carries `api_base`, `api_key`, or another client-side credential field is rejected when the batch is created unless this is `true` or the deployment lists the field in `configurable_clientside_auth_params` |

The proxy's pre-call guardrails run over every line when the file is uploaded and can rewrite or drop lines, or refuse the upload, there. They do not run again as each line executes

## Related

- [Fireworks AI Provider Overview](./fireworks_ai)
- [vLLM batches](./vllm_batches), which LiteLLM runs the same way
- [Batch API Overview](../batches)
- [Files API](../files_endpoints)
