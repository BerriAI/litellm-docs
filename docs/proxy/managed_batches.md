# [BETA] LiteLLM Managed Files with Batches

<EnterpriseFeature free />

| Feature | Supported | Comments |
| --- | --- | --- |
| Proxy | ✅ |  |
| SDK | ❌ | Requires a Postgres DB for storing file ids |
| Available across all [Batch providers](../batches#supported-providers) | ✅ |  |

## Overview

Use this to:

- Load balance across multiple Azure Batch deployments
- Control batch model access by key/user/team (same as chat completion models)

## (Proxy Admin) Usage

Here's how to give developers access to your Batch models.

### 1. Setup config.yaml

- Specify `mode: batch` for each model so developers can tell this is a batch model.
- Optionally skip the pre-read of batch input files for specific batch providers or models (useful for large files on custom vLLM batch deployments).

```yaml showLineNumbers title="litellm_config.yaml"
model_list:
  - model_name: "gpt-4o-batch"
    litellm_params:
      model: azure/gpt-4o-mini-general-deployment
      api_base: os.environ/AZURE_API_BASE
      api_key: os.environ/AZURE_API_KEY
    model_info:
      mode: batch # tells developers this is a batch model
  - model_name: "gpt-4o-batch"
    litellm_params:
      model: azure/gpt-4o-mini-special-deployment
      api_base: os.environ/AZURE_API_BASE_2
      api_key: os.environ/AZURE_API_KEY_2
    model_info:
      mode: batch # tells developers this is a batch model

general_settings:
  # Optional: do not charge batch input files against TPM/RPM
  # disable_batch_input_file_rate_limiting: true

  # Optional: apply this behavior only to selected providers
  skip_batch_input_file_rate_limiting_for_providers:
    - hosted_vllm

litellm_settings:
  # Optional: require target_model_names on POST /v1/files (blocks classic file uploads)
  # require_managed_files: true
```

By default, LiteLLM reads each batch input file before submission and charges its tokens and record count against the caller's TPM and RPM limits. This can add latency for large files. Use the settings above only when batch submissions do not need to be included in TPM or RPM accounting. To govern batch submissions by outstanding batch work instead of per-minute windows, see [Enqueued-token limits](../batches#enqueued-token-limits). For details and limitations, see [How rate limiting works for the Batches API](../batches#how-rate-limiting-for-batches-api-works).

### 2. Create Virtual Key

```bash showLineNumbers title="create_virtual_key.sh"
curl -L -X POST 'https://${PROXY_BASE_URL}/key/generate' \
-H 'Authorization: Bearer ${PROXY_API_KEY}' \
-H 'Content-Type: application/json' \
-d '{"models": ["gpt-4o-batch"]}'
```

You can now use the virtual key to access the batch models (see [Developer Usage](#developer-usage)).

## (Developer) Usage

Here's how to create a LiteLLM managed file and execute Batch CRUD operations with the file.

### 1. Create request.jsonl

- Check models available via `/model_group/info`
- See all models with `mode: batch`
- Set `model` in the .jsonl to the model from `/model_group/info`

```json showLineNumbers title="request.jsonl"
{"custom_id": "request-1", "method": "POST", "url": "/v1/chat/completions", "body": {"model": "gpt-4o-batch", "messages": [{"role": "system", "content": "You are a helpful assistant."},{"role": "user", "content": "Hello world!"}],"max_tokens": 1000}}
{"custom_id": "request-2", "method": "POST", "url": "/v1/chat/completions", "body": {"model": "gpt-4o-batch", "messages": [{"role": "system", "content": "You are an unhelpful assistant."},{"role": "user", "content": "Hello world!"}],"max_tokens": 1000}}
```

LiteLLM translates the model name to the Azure deployment specific value (e.g. `gpt-4o-mini-general-deployment`).

### 2. Upload File

Specify `target_model_names: "<model-name>"` to enable LiteLLM managed files and request validation. The model name must match the `model` in request.jsonl.

```python showLineNumbers title="create_batch.py"
from openai import OpenAI

client = OpenAI(
    base_url="http://0.0.0.0:4000",
    api_key="sk-1234",
)

# Upload file
batch_input_file = client.files.create(
    file=open("./request.jsonl", "rb"), # {"model": "gpt-4o-batch"} <-> {"model": "gpt-4o-mini-special-deployment"}
    purpose="batch",
    extra_body={"target_model_names": "gpt-4o-batch"}
)
print(batch_input_file)
```

**Where is the file written?**

All gpt-4o-batch deployments (gpt-4o-mini-general-deployment, gpt-4o-mini-special-deployment) will be written to. This enables load balancing across all gpt-4o-batch deployments in Step 3.

### 3. Create + Retrieve the batch

```python showLineNumbers title="create_batch.py"
...
# Create batch
batch = client.batches.create(
    input_file_id=batch_input_file.id,
    endpoint="/v1/chat/completions",
    completion_window="24h",
    metadata={"description": "Test batch job"},
)
print(batch)
batch_id = batch.id

# Retrieve batch
batch_response = client.batches.retrieve(batch_id)
status = batch_response.status
```

### 4. Retrieve Batch Content

```python showLineNumbers title="create_batch.py"
...

file_id = batch_response.output_file_id

file_response = client.files.content(file_id)
print(file_response.text)
```

### 5. List batches

```python showLineNumbers title="create_batch.py"
...

client.batches.list(limit=10, extra_query={"target_model_names": "gpt-4o-batch"})
```

### 6. Cancel a batch

```python showLineNumbers title="create_batch.py"
...

client.batches.cancel(batch_id)
```

## E2E Example

```python showLineNumbers title="create_batch.py"
import json
from openai import OpenAI

"""
litellm yaml:

model_list:
    - model_name: gpt-4o-batch
      litellm_params:
        model: azure/gpt-4o-my-special-deployment
        api_key: ..
        api_base: ..

---
request.jsonl:
{"custom_id": "request-1", "method": "POST", "url": "/v1/chat/completions", "body": {"model": "gpt-4o-batch", ...}}
"""

client = OpenAI(
    base_url="http://0.0.0.0:4000",
    api_key="sk-1234",
)

# Upload file
batch_input_file = client.files.create(
    file=open("./request.jsonl", "rb"),
    purpose="batch",
    extra_body={"target_model_names": "gpt-4o-batch"}
)
print(batch_input_file)

# Create batch
batch = client.batches.create(
    input_file_id=batch_input_file.id,
    endpoint="/v1/chat/completions",
    completion_window="24h",
    metadata={"description": "Test batch job"},
)
print(batch)
batch_id = batch.id

# Retrieve batch
batch_response = client.batches.retrieve(batch_id)
status = batch_response.status

print(f"status: {status}, output_file_id: {batch_response.output_file_id}")

# Download file
output_file_id = batch_response.output_file_id
print(f"output_file_id: {output_file_id}")
if not output_file_id:
    output_file_id = batch_response.error_file_id

if output_file_id:
    file_response = client.files.content(output_file_id)
    raw_responses = file_response.text.strip().split("\n")

    with open("unified_batch_output.jsonl", "w") as output_file:
        for raw_response in raw_responses:
            json.dump(json.loads(raw_response), output_file)
            output_file.write("\n")

# List batches
list_batch_response = client.batches.list(
    extra_query={"target_model_names": "gpt-4o-batch"}
)

# Cancel batch
batch_response = client.batches.cancel(batch_id)
status = batch_response.status

print(f"status: {status}")
```

## Observability

Once a managed batch reaches `completed`, the proxy's batch cost poller downloads its output file, prices every line, and writes a single spend log row for the whole batch. That row is what `/spend/logs` and the Logs page read, and it is where the per-request outcome counts, the reasoning token totals, and the batch's cost live

The poller runs on a timer, so the row appears some time after the batch finishes rather than the moment it completes. `proxy_batch_polling_interval` in `general_settings` (or the `PROXY_BATCH_POLLING_INTERVAL` env var) sets the base interval in seconds and defaults to `3600`, and the poller adds up to 30s of jitter on top. Set it to something small like `30` while you are testing

### Spend log fields

The batch's cost row has `call_type: "aretrieve_batch"` and a `request_id` of `<batch id>_batch_cost`, where `<batch id>` is the id `POST /v1/batches` returned:

```bash showLineNumbers title="get_batch_spend_row.sh"
curl -s "http://0.0.0.0:4000/spend/logs?request_id=${BATCH_ID}_batch_cost" \
  -H "Authorization: Bearer sk-1234"
```

```json showLineNumbers title="batch cost row (trimmed)"
{
  "request_id": "batch_bGl0ZWxsbV9wcm94eTtt...._batch_cost",
  "session_id": "batch_bGl0ZWxsbV9wcm94eTtt....",
  "call_type": "aretrieve_batch",
  "model": "gemini-2.5-flash",
  "model_group": "gemini-batch",
  "spend": 0.0003221,
  "prompt_tokens": 14,
  "completion_tokens": 256,
  "total_tokens": 270,
  "status": "success",
  "metadata": {
    "batch_models": ["gemini-2.5-flash"],
    "batch_successful_requests": 2,
    "batch_failed_requests": 1,
    "cost_breakdown": {
      "input_cost": 0.0000021,
      "output_cost": 0.00032,
      "total_cost": 0.0003221,
      "tool_usage_cost": 0.0
    },
    "usage_object": {
      "prompt_tokens": 14,
      "completion_tokens": 256,
      "total_tokens": 270,
      "completion_tokens_details": {"text_tokens": 32, "reasoning_tokens": 224}
    }
  }
}
```

| Field | What it holds |
| --- | --- |
| `request_id` | The batch id with `_batch_cost` appended |
| `session_id` | The batch id, shared with the create row so both group into one trace |
| `spend` | The whole batch's cost, counting the successful lines only |
| `prompt_tokens`, `completion_tokens`, `total_tokens` | Summed across every successful line |
| `metadata.batch_successful_requests` | Requests the provider answered successfully |
| `metadata.batch_failed_requests` | Requests it rejected, from the output file and the error file |
| `metadata.batch_models` | The model the batch ran on |
| `metadata.usage_object.completion_tokens_details.reasoning_tokens` | Reasoning tokens summed across the successful lines |
| `metadata.cost_breakdown` | The input and output cost split behind `spend` |

`/spend/logs/v2` returns the same fields with pagination and is the endpoint to use for anything beyond a single lookup. It wants `start_date` and `end_date` even when you pass `request_id`, so the plain `/spend/logs?request_id=` call above stays the shorter way to pull one batch's row

### On the Logs page

Open [http://localhost:4000/ui/?page=logs](http://localhost:4000/ui/?page=logs) once the poller has run. The batch's create row and its cost row share a session, so the page shows them as a single grouped row carrying the batch's total cost and tokens, with a **Batch** badge in the Type column in place of the usual LLM badge. The Status column is where the outcome shows up: a green **Success** badge when every request succeeded, and an amber **N/M succeeded** badge when some of them failed, where `N` is the successful count and `M` is the total, so `2/3 succeeded` means one request out of three failed. The Request ID column shows the batch id itself under a small `batch cost` label rather than the raw `<batch id>_batch_cost` string, so it matches the id you got back from `POST /v1/batches`

Click the row to open the drawer. A **Batch Results** card lists the batch id, the successful and failed request counts with the failed count highlighted in red when it is not zero, and the models the batch ran on. **Metrics** picks up a **Reasoning Tokens** row whenever the batch aggregated any, and **Cost Breakdown** shows the input and output split behind the row's cost

### Reading a partially failed batch

A batch reaches `completed` at the provider as soon as it finishes running, whether or not every one of its requests worked, so the status on its own tells you nothing about failures. The counts on the cost row are what tell you, and they line up with `request_counts` on the batch itself:

```bash showLineNumbers title="compare_counts.sh"
# what the provider reports
curl -s "http://0.0.0.0:4000/v1/batches/${BATCH_ID}" \
  -H "Authorization: Bearer sk-1234" | jq '.status, .request_counts'
# "completed"
# {"completed": 2, "failed": 1, "total": 3}

# what the spend log recorded
curl -s "http://0.0.0.0:4000/spend/logs?request_id=${BATCH_ID}_batch_cost" \
  -H "Authorization: Bearer sk-1234" \
  | jq '.[0].metadata | {batch_successful_requests, batch_failed_requests}'
# {"batch_successful_requests": 2, "batch_failed_requests": 1}
```

To see why the failed requests failed, download the batch's error file. It holds one line per rejected request, keyed by the `custom_id` you set in the input file:

```bash showLineNumbers title="read_error_file.sh"
ERROR_FILE_ID=$(curl -s "http://0.0.0.0:4000/v1/batches/${BATCH_ID}" \
  -H "Authorization: Bearer sk-1234" | jq -r '.error_file_id')

curl -s "http://0.0.0.0:4000/v1/files/${ERROR_FILE_ID}/content" \
  -H "Authorization: Bearer sk-1234"
```

Failed requests cost nothing, so `spend` covers the successful lines only and a batch that half failed costs about half of what you budgeted for. A request the provider accepted but LiteLLM could not price still counts as successful and is billed at `$0`, which keeps the counts reconcilable with the provider's own numbers. A batch whose requests all failed has no output file at all, and its cost row records `$0`, zero successful requests, and the failure count read from the error file. Anthropic and Bedrock extended thinking batches do not report reasoning tokens per line, so `reasoning_tokens` stays absent for them even though the model was thinking. The one case where the two counts do not add up to the provider's total is an output line that is not valid JSON, which gets skipped with a warning and lands in neither count

## FAQ

### Where are my files written?

When `target_model_names` is specified, the file is written to all deployments that match it. No additional infrastructure is required.

### Could the batch be created on one deployment (e.g. eastus-01) but a subsequent retrieve be routed to a different deployment (e.g. eastus2-01)?

No. LiteLLM load balances between deployments for the initial batch create. The returned batch id encodes the deployment that was used, so retrieve, cancel and file content calls are sticky to that deployment.
