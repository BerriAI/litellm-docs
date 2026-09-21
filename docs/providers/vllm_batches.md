import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# vLLM - Batch + Files API

vLLM's OpenAI-compatible server serves `/v1/chat/completions`, `/v1/completions`, `/v1/embeddings`, and `/v1/responses`, but it has no `/v1/files` or `/v1/batches` routes. LiteLLM fills that gap: for a `hosted_vllm` deployment whose server has no Files API, the proxy stores the batch input itself, runs every line through the deployment, and serves the batch status and the output files, so the OpenAI Batch API works against vLLM unchanged

| Feature | Supported |
|---------|-----------|
| `/v1/files` | ✅ stored by LiteLLM |
| `/v1/batches` | ✅ run by LiteLLM |
| Cost Tracking | ✅ every line is billed to the key that created the batch |

This flow runs on the proxy and needs a database (`DATABASE_URL`), because the input file, the batch status, and the result files live there

## When LiteLLM runs the batch itself

LiteLLM decides per request. A deployment qualifies when its `litellm_params.model` starts with `hosted_vllm/` and `GET {api_base}/files` on its server answers 404. Every other deployment, and a `hosted_vllm` deployment whose server does implement the Files API (for example the vLLM production-stack router), keeps the passthrough behavior: the upload and the batch are forwarded to the server and it runs the batch

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

Each line follows the OpenAI batch input shape. LiteLLM replaces `body.model` with the batch's deployment name, so what you put there does not change which server runs the line

```jsonl
{"custom_id": "request-1", "method": "POST", "url": "/v1/chat/completions", "body": {"model": "my-vllm-model", "messages": [{"role": "user", "content": "Hello!"}]}}
{"custom_id": "request-2", "method": "POST", "url": "/v1/chat/completions", "body": {"model": "my-vllm-model", "messages": [{"role": "user", "content": "How are you?"}]}}
```

Every line has to name the same `url`, and it has to match the `endpoint` you give the batch. `stream: true` lines, duplicate `custom_id`s, and unknown top-level fields are rejected at upload with a 400 that names the line

### 4. Upload File & Create Batch

:::tip Model Routing
The upload has to name the deployment, either with the `x-litellm-model` header, the `?model=` query parameter, or the `target_model_names` form field. Use `purpose=batch`: an upload with another purpose to a deployment LiteLLM runs batches for answers 400, because there is no server to keep the file on. The returned file id is a long base64 id, not an OpenAI-style `file-...` id; batch operations on it route to the same deployment automatically
:::

<Tabs>
<TabItem value="curl" label="cURL">

**Upload File**

```bash
curl http://localhost:4000/v1/files \
  -H "Authorization: Bearer sk-1234" \
  -H "x-litellm-model: my-vllm-model" \
  -F purpose="batch" \
  -F file="@batch_requests.jsonl"
```

**Create Batch**

```bash
curl http://localhost:4000/v1/batches \
  -H "Authorization: Bearer sk-1234" \
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
  -H "Authorization: Bearer sk-1234"
```

**Download the results**

```bash
curl http://localhost:4000/v1/files/<output_file_id>/content \
  -H "Authorization: Bearer sk-1234"
```

</TabItem>
<TabItem value="python" label="OpenAI SDK">

```python
import time
from openai import OpenAI

client = OpenAI(api_key="sk-1234", base_url="http://localhost:4000/v1")

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

The batch is created as `validating`, moves to `in_progress` while the proxy replica that received the create runs the lines, then `finalizing` while the result files are written, and ends `completed`. Lines the server rejects land in the error file with the server's status code, and the batch still completes. Cancelling marks the batch `cancelling`, lets the line in flight finish, and ends it `cancelled`, keeping the output of the lines that already finished. The 24 hour `completion_window` is enforced the same way: a line still unfinished when it closes is cut off and lands in the error file as `batch_expired`, and the batch ends `expired`, keeping the output of the lines that finished in time

Results come back in OpenAI's batch output shape: `output_file_id` holds one line per successful request and `error_file_id` one line per failed request. Both are served only to the key that created the batch

Each line is billed through the router as its own request, with the creating key, team, and tags on the spend log, at the price configured on the deployment. A deployment with no price logs its lines with spend 0

If the replica running a batch restarts, the batch is marked `failed` with a `runner_lost` error the next time it is retrieved more than three minutes after its last progress write. Resubmit it

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `LITELLM_EXECUTED_BATCH_CONCURRENCY` | `4` | How many lines of one batch run in parallel |
| `general_settings.allow_client_side_credentials` | `false` | Batch lines follow the same rule as live requests: a line whose body carries `api_base`, `api_key`, or another client-side credential field is rejected at upload unless this is `true` or the deployment lists the field in `configurable_clientside_auth_params` |

Batch lines skip the proxy's pre-call guardrails, the same as batches a provider runs

## Related

- [vLLM Provider Overview](./vllm)
- [Batch API Overview](../batches)
- [Files API](../files_endpoints)
