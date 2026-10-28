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

Grant developers access to Batch models.

### 1. Setup config.yaml

- Specify `mode: batch` for each model so developers can tell this is a batch model.
- Optionally skip the pre-read of batch input files for specific batch providers or models (useful for large files on custom vLLM batch deployments).

```yaml showLineNumbers title="litellm-config.yaml"
model_list:
  - model_name: "gpt-4o-batch"
    litellm_params:
      model: azure/gpt-4o-mini-general-deployment
      api_base: os.environ/AZURE_API_BASE
      api_key: os.environ/AZURE_API_KEY
    model_info:
      mode: batch # metadata, tells developers this is a batch model

  - model_name: "gpt-4o-batch"
    litellm_params:
      model: openai/gpt-4o-mini
      api_key: os.environ/OPENAI_API_KEY
    model_info:
      mode: batch # metadata, tells developers this is a batch model

  - model_name: vertex-batch
    litellm_params:
      model: vertex_ai/gemini-3.5-flash
      vertex_project: <vertex-project>
      vertex_location: global
      vertex_credentials: /path/to/credentials
      gcs_bucket_name: litellm-batch-api-bucket # required param for vertexai to store files
    model_info:
      mode: batch


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

```bash
curl -L -X POST 'https://${PROXY_BASE_URL}/key/generate' \
-H 'Authorization: Bearer ${PROXY_API_KEY}' \
-H 'Content-Type: application/json' \
-d '{"models": ["gpt-4o-batch"]}'
```

The returned virtual key grants access to the batch models (see [Developer Usage](#developer-usage)).

## (Developer) Usage

Create a LiteLLM managed file and run batch operations against it. The steps below show the raw HTTP calls with curl; for the same workflow with the OpenAI Python SDK, see [Batch Lifecycle](#batch-lifecycle).

### 1. Create request.jsonl

The `model` in each line must be a model name from `/model_group/info` with `mode: batch`.

```json showLineNumbers title="request.jsonl"
{"custom_id": "request-1", "method": "POST", "url": "/v1/chat/completions", "body": {"model": "gpt-4o-batch", "messages": [{"role": "system", "content": "You are a helpful assistant."},{"role": "user", "content": "Hello world!"}],"max_tokens": 1000}}
{"custom_id": "request-2", "method": "POST", "url": "/v1/chat/completions", "body": {"model": "gpt-4o-batch", "messages": [{"role": "system", "content": "You are an unhelpful assistant."},{"role": "user", "content": "Hello world!"}],"max_tokens": 1000}}
```

LiteLLM translates the model name to the Azure deployment specific value (e.g. `gpt-4o-mini-general-deployment`).

### 2. Upload File

`target_model_names` enables LiteLLM managed files and request validation. It must match the `model` in request.jsonl. The upload returns a file object; its `id` is the `input_file_id` for Step 3.

```bash showLineNumbers
export LITELLM_BASE_URL="http://0.0.0.0:4000"
export LITELLM_API_KEY="sk-<your-litellm-api-key>"

curl -s "${LITELLM_BASE_URL}/v1/files" \
  -H "Authorization: Bearer ${LITELLM_API_KEY}" \
  -F purpose="batch" \
  -F file="@./request.jsonl" \
  -F target_model_names="gpt-4o-batch"
```

**Where is the file written?**

The file is written to every deployment that matches `target_model_names` (here: `gpt-4o-mini-general-deployment` and `gpt-4o-mini-special-deployment`). This enables load balancing across those deployments in Step 3.

### 3. Create + Retrieve the batch

`input_file_id` is the file `id` from Step 2. The create call returns a batch object; its `status` moves through the states described in [Batch Lifecycle](#batch-lifecycle).

```bash showLineNumbers
# Create the batch
curl -s "${LITELLM_BASE_URL}/v1/batches" \
  -H "Authorization: Bearer ${LITELLM_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "input_file_id": "file-abc123",
    "endpoint": "/v1/chat/completions",
    "completion_window": "24h",
    "metadata": {"description": "Test batch job"}
  }'

# Retrieve the batch, using the id the create call returned
export BATCH_ID="batch_abc123"

curl -s "${LITELLM_BASE_URL}/v1/batches/${BATCH_ID}" \
  -H "Authorization: Bearer ${LITELLM_API_KEY}"
```

### 4. Retrieve Batch Content

`output_file_id` is set on the batch once its `status` is `completed`. The content is one JSON result per line, keyed by the `custom_id` from request.jsonl.

```bash showLineNumbers
OUTPUT_FILE_ID=$(curl -s "${LITELLM_BASE_URL}/v1/batches/${BATCH_ID}" \
  -H "Authorization: Bearer ${LITELLM_API_KEY}" | jq -r '.output_file_id')

curl -s "${LITELLM_BASE_URL}/v1/files/${OUTPUT_FILE_ID}/content" \
  -H "Authorization: Bearer ${LITELLM_API_KEY}"
```

### 5. List batches

Returns the managed batches owned by the calling key, user, or team, newest first. `limit` must be between 0 and 100 and defaults to 20; page with `after`. The `provider` and `target_model_names` filters are not supported for managed batches and return `400`.

```bash showLineNumbers
curl -s "${LITELLM_BASE_URL}/v1/batches?limit=10" \
  -H "Authorization: Bearer ${LITELLM_API_KEY}"
```

### 6. Cancel a batch

The cancel call returns the batch with `status: "cancelling"`.

```bash showLineNumbers
curl -s -X POST "${LITELLM_BASE_URL}/v1/batches/${BATCH_ID}/cancel" \
  -H "Authorization: Bearer ${LITELLM_API_KEY}"
```

## Access control

Every managed batch and file belongs to the user, team, and key that created it, and LiteLLM checks that ownership on every batch and file endpoint. Tenants that share a proxy cannot see or touch each other's batch jobs or results.

| Caller | Can retrieve, cancel, list, and download |
|--------|------------------------------------------|
| Proxy admin | Every batch and file |
| The user that created the batch | Yes |
| Another key or user on the same team | Yes |
| A key or user on a different team | No |

A caller without access gets a `403` from `GET /v1/batches/{batch_id}`, `POST /v1/batches/{batch_id}/cancel`, `GET /v1/files/{file_id}`, and `GET /v1/files/{file_id}/content`, and from `POST /v1/batches` when the `input_file_id` belongs to someone else. `GET /v1/batches` only returns the batches the caller can access, so a key on another team gets an empty list. A batch's output and error files get the same owner and team as the batch, so the same rules cover its results (see [Output and error files](#output-and-error-files)).

A key with a team but no user reaches every batch of its team. A key with neither a user nor a team only reaches the batches it created.

To also keep each team's batch data in its own storage, give each team its own batch model with its own bucket. See [Bedrock Batches](../providers/bedrock_batches#how-do-i-keep-each-teams-batch-data-in-its-own-bucket) for an example.

## Batch Lifecycle

A batch's `status` moves through `validating` → `in_progress` → `finalizing` → `completed`. The other terminal states are `failed` (validation failed), `expired` (the completion window elapsed), and `cancelled` (after a cancel call, which first reports `cancelling`).

The script below runs the whole lifecycle with the OpenAI Python SDK: upload the input file, create the batch, poll until a terminal status, then download the output file (or the error file when there is no output).

```python showLineNumbers title="create_batch.py"
import json
import time
from openai import OpenAI

client = OpenAI(
    base_url="http://0.0.0.0:4000",       # your LiteLLM proxy URL
    api_key="sk-<your-litellm-api-key>",  # your LiteLLM virtual key
)

# 1. Upload the input file (request.jsonl from Developer Usage Step 1)
batch_input_file = client.files.create(
    file=open("./request.jsonl", "rb"),
    purpose="batch",
    extra_body={"target_model_names": "gpt-4o-batch"},
)
print(f"file id: {batch_input_file.id}")

# 2. Create the batch
batch = client.batches.create(
    input_file_id=batch_input_file.id,
    endpoint="/v1/chat/completions",
    completion_window="24h",
    metadata={"description": "Test batch job"},
)
print(f"batch id: {batch.id}, status: {batch.status}")

# 3. Poll until the batch reaches a terminal status
terminal_statuses = {"completed", "failed", "expired", "cancelled"}
while batch.status not in terminal_statuses:
    time.sleep(30)
    batch = client.batches.retrieve(batch.id)
    print(f"status: {batch.status}")

# 4. Download the results: output file, or error file when there is no output
result_file_id = batch.output_file_id or batch.error_file_id

if result_file_id:
    file_response = client.files.content(result_file_id)
    with open("batch_output.jsonl", "w") as output_file:
        for line in file_response.text.strip().split("\n"):
            json.dump(json.loads(line), output_file)
            output_file.write("\n")
    print(f"results written to batch_output.jsonl")
```

To cancel a batch before it completes, call `client.batches.cancel(batch.id)`: its status becomes `cancelling`, then `cancelled`.

## Output and error files

When a managed batch finishes, the provider creates an output file and, if any requests failed, an error file. LiteLLM saves a managed file row for each one with the same owner and team as the batch, so they show up in the files endpoints like an uploaded file and follow the same access rules.

- `GET /v1/files` lists input, output and error files.
- `GET /v1/files?purpose=batch` lists input files only.
- `GET /v1/files?purpose=batch_output` lists output and error files.

### File details

When LiteLLM first saves an output or error file row, it asks the provider for the file's details, such as its size and creation time. Each lookup retries timeouts, connection errors, 429 and 5xx responses up to 3 times, and gives up after 10 seconds in total.

If the provider still does not answer, LiteLLM saves a basic entry instead, with `purpose: "batch_output"`, `status: "processed"` and `bytes: 0` (or the real size, when the background poller has already downloaded the file to calculate cost). The file is listed and downloadable right away.

LiteLLM replaces a basic entry with the provider's details later, on the next `GET /v1/files/{file_id}` call, or on the next batch retrieve, cancel or poller run once the entry is at least 60 seconds old. Only the file details change: the owner, team and provider mapping stay the same, and a file deleted while its details are being fetched stays deleted. Rows that already have the provider's details are never fetched again.

### Which endpoints call the provider

| Endpoint | Asks the provider for file details | Saves or changes the file row | If the provider lookup fails |
| --- | --- | --- | --- |
| `GET /v1/files` | No | No | Not applicable |
| `GET /v1/files/{file_id}` | Only for a basic entry, or an older row with no saved details | Updates a basic entry with the provider's details | Returns the basic entry. An older row with no saved details returns an error |
| `GET /v1/files/{file_id}/content` | No, it downloads the content | No | Returns an error |
| `DELETE /v1/files/{file_id}` | No, it asks the provider to delete the file | Deletes the row | Returns an error and keeps the row |
| `GET /v1/batches` | No | Saves a basic entry for an output or error file that has no row yet | Not applicable |
| `GET /v1/batches/{batch_id}` | For output or error files with no row, or with a basic entry at least 60 seconds old | Saves the row, or updates the basic entry | Saves or keeps the basic entry, and still returns the batch |
| `POST /v1/batches/{batch_id}/cancel` | Same as batch retrieve | Same as batch retrieve | Same as batch retrieve |

The background poller that tracks batch cost behaves like batch retrieve. When `GET /v1/files` or `GET /v1/batches` is called with a provider or model, the list comes straight from that provider instead of the database.

## Observability

Once a managed batch reaches `completed`, the proxy's batch cost poller downloads its output file, prices every line, and writes a single spend log row for the whole batch. That row is what `/spend/logs` and the Logs page read, and it is where the per-request outcome counts, the reasoning token totals, and the batch's cost live

The poller runs on a timer, so the row appears some time after the batch finishes rather than the moment it completes. `proxy_batch_polling_interval` in `general_settings` (or the `PROXY_BATCH_POLLING_INTERVAL` env var) sets the base interval in seconds and defaults to `3600`, and the poller adds up to 30s of jitter on top. Set it to something small like `30` while you are testing

### Spend log fields

The batch's cost row has `call_type: "aretrieve_batch"` and a `request_id` of `<batch id>_batch_cost`, where `<batch id>` is the id `POST /v1/batches` returned:

```bash showLineNumbers
curl -s "http://0.0.0.0:4000/spend/logs?request_id=${BATCH_ID}_batch_cost" \
  -H "Authorization: Bearer $LITELLM_API_KEY"
```

```json showLineNumbers title="batch cost row (trimmed)"
{
  "request_id": "bGl0ZWxsbV9wcm94eTttb2RlbF9pZDo3YjJl..._batch_cost",
  "session_id": "bGl0ZWxsbV9wcm94eTttb2RlbF9pZDo3YjJl...",
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

```bash showLineNumbers
# what the provider reports
curl -s "http://0.0.0.0:4000/v1/batches/${BATCH_ID}" \
  -H "Authorization: Bearer $LITELLM_API_KEY" | jq '.status, .request_counts'
# "completed"
# {"completed": 2, "failed": 1, "total": 3}

# what the spend log recorded
curl -s "http://0.0.0.0:4000/spend/logs?request_id=${BATCH_ID}_batch_cost" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  | jq '.[0].metadata | {batch_successful_requests, batch_failed_requests}'
# {"batch_successful_requests": 2, "batch_failed_requests": 1}
```

To see why the failed requests failed, download the batch's error file. It holds one line per rejected request, keyed by the `custom_id` you set in the input file:

```bash showLineNumbers
ERROR_FILE_ID=$(curl -s "http://0.0.0.0:4000/v1/batches/${BATCH_ID}" \
  -H "Authorization: Bearer $LITELLM_API_KEY" | jq -r '.error_file_id')

curl -s "http://0.0.0.0:4000/v1/files/${ERROR_FILE_ID}/content" \
  -H "Authorization: Bearer $LITELLM_API_KEY"
```

Failed requests cost nothing, so `spend` covers the successful lines only and a batch that half failed costs about half of what you budgeted for. A request the provider accepted but LiteLLM could not price still counts as successful and is billed at `$0`, which keeps the counts reconcilable with the provider's own numbers. A batch whose requests all failed has no output file at all, and its cost row records `$0`, zero successful requests, and the failure count read from the error file. Anthropic and Bedrock extended thinking batches do not report reasoning tokens per line, so `reasoning_tokens` stays absent for them even though the model was thinking. The one case where the two counts do not add up to the provider's total is an output line that is not valid JSON, which gets skipped with a warning and lands in neither count

### Storing every line's request and response

The cost row sums the whole batch, and providers delete batch files after a while. To keep each request and its answer, list a bucket under `batch_line_item_callbacks`. Once the poller has billed a batch, it writes the batch's records to every bucket listed there as JSONL part objects, one record per line

```yaml showLineNumbers title="config.yaml"
litellm_settings:
  batch_line_item_callbacks: ["s3_v2", "gcs_bucket"]
  s3_callback_params:          # read by s3_v2, same keys as the s3 logging callback
    s3_bucket_name: my-batch-logs
    s3_region_name: us-east-2
    s3_path: litellm           # optional prefix
```

`gcs_bucket` reads `GCS_BUCKET_NAME` and `GCS_PATH_SERVICE_ACCOUNT` from the environment, the same as the [GCS logging callback](./logging#google-cloud-storage-buckets), and like that callback it needs an enterprise license. Listing a bucket here does not turn on request logging to it, and `success_callback` does not turn on batch line items. The two settings are independent

A batch's parts sit under the day the batch finished, in UTC, and the batch id you got back from `POST /v1/batches`, with any `/` in the id replaced by `_`. Vertex AI reports no finish time, so a Vertex AI batch's parts and its records' `finished_at` use the time the batch was created:

| Bucket | Part objects |
| --- | --- |
| S3 | `<s3_path>/batch_line_items/<YYYY-MM-DD>/<batch id>/part-00000.jsonl`, `part-00001.jsonl`, ... |
| GCS | `batch_line_items/<YYYY-MM-DD>/<batch id>/part-00000.jsonl`, `part-00001.jsonl`, ... |

A part closes once the raw request and result lines in it reach 16 MB, which `BATCH_LINE_ITEMS_MAX_PART_BYTES` changes, and the next record starts a new part. Most batches fit in `part-00000.jsonl`. Records follow the order of the provider's output file, then its error file, so reading the parts in order reads the batch in that order

Each line of a part is one record:

```json showLineNumbers title="one record (pretty-printed, trimmed)"
{
  "batch_id": "bGl0ZWxsbV9wcm94eTttb2RlbF9pZDpjZDky...",
  "custom_id": "request-1",
  "status": "success",
  "request": {
    "custom_id": "request-1",
    "method": "POST",
    "url": "/v1/chat/completions",
    "body": {
      "model": "gpt-5.4-nano",
      "messages": [
        {"role": "system", "content": "Answer in one word"},
        {"role": "user", "content": "Is the sky blue?"}
      ]
    }
  },
  "response": {
    "id": "batch_req_6acdfc86d8548190b47c54904f2f5727",
    "custom_id": "request-1",
    "response": {
      "status_code": 200,
      "body": {
        "id": "chatcmpl-EYTHQP5vBYthXQpZJLgGTmNbLjwdq",
        "object": "chat.completion",
        "choices": [
          {"index": 0, "message": {"role": "assistant", "content": "Yes"}, "finish_reason": "stop"}
        ],
        "usage": {"prompt_tokens": 19, "completion_tokens": 5, "total_tokens": 24}
      }
    },
    "error": null
  },
  "usage": {"prompt_tokens": 19, "completion_tokens": 5, "total_tokens": 24},
  "response_cost": 5.025e-06,
  "model": "gpt-5.4-nano",
  "custom_llm_provider": "openai",
  "metadata": {
    "user_api_key_hash": "d6f6bc353e745199f3f1aa285952f2dc...",
    "user_api_key_alias": "batch-jobs",
    "user_api_key_team_id": null,
    "user_api_key_team_alias": null,
    "user_api_key_user_id": "key:d6f6bc353e745199f3f1aa285952f2dc...",
    "user_api_key_org_id": null
  }
}
```

| Field | What it holds |
| --- | --- |
| `batch_id` | The batch id you got back from `POST /v1/batches` |
| `custom_id` | The `custom_id` from your input file, or the `recordId` for Bedrock |
| `status` | `success` when the provider answered the request, `failure` when it rejected it |
| `request` | Your input line as the provider holds it: the line you uploaded for OpenAI, Azure and Mistral, the converted line with `recordId` and `modelInput` for Bedrock, and the converted line with `request` for Vertex AI, which carries your `custom_id` in its labels |
| `response` | The provider's output or error line, exactly as the provider wrote it |
| `usage` | That line's tokens, `null` for a failed line |
| `response_cost` | That line's cost at the deployment's batch rates, `0` for a failed line. The records of a batch add up to the cost row's `spend` |
| `model`, `custom_llm_provider` | The deployment the batch ran on |
| `metadata` | The key, team, user and organization that created the batch. `user_api_key_hash` is a SHA-256 hash: the virtual key's hash, or for a batch created without a virtual key, such as with an OAuth2 token, the hash of what was saved in its place, so the bucket never holds a usable credential |

A few things to know:

- Only managed batches get records, meaning batches created from a file uploaded with `target_model_names`, because the poller only bills those
- A batch where every line failed still gets its parts, holding its error lines
- `request` is `null` for Anthropic, which has no input file, for a Vertex AI embeddings line whose `input` list was split into one row per item, and when the input file can no longer be read
- A Vertex AI line whose row carries no `custom_id` shows `unknown`, as in the batch's output file (or no `custom_id` at all for a batch uploaded in Vertex AI's own row format), and gets `request` `null`, so a Vertex AI line you gave the `custom_id` `unknown` also gets `request` `null`
- When the error file can no longer be read, the parts leave the failed lines out and a warning is logged, so a batch where every line failed then gets no parts
- `request` and `response` are both `null`, with every other field kept, when the key or team that created the batch has message logging turned off in its logging settings, when `litellm.turn_off_message_logging` is on, or when that key or team no longer exists
- A batch created without a virtual key, such as with a JWT, a built-in OAuth2 token or the master key, follows its team's logging settings and `litellm.turn_off_message_logging`
- A batch created from an Admin UI session, or with an `sk-` credential through custom auth (the master key included when custom auth is on) or on a proxy with no master key, gets `request` and `response` `null`, because litellm cannot find the key or team it records. So does a batch created with an OAuth2 token that is exactly 64 hex characters, which reads like a virtual key's hash
- A batch's parts are written in the background once the poller run that billed the batch and marked it done has finished with every other batch it found, one batch at a time on each proxy worker and one part at a time within a batch, so neither pricing the lines nor a slow or unreachable bucket holds up billing. A billed batch's output file is downloaded again when its turn comes, so a batch waiting for its turn holds none of its files in memory. If the output file can no longer be read by then, or the batch's model has been removed from the proxy, no part is written and an error naming the batch is logged. `s3_v2` tries a write up to 3 times when the bucket answers 403, 429, 500 or 503 or the connection fails or times out, with each try cut off after `S3_UPLOAD_ATTEMPT_TIMEOUT_SECONDS` (30 by default), the same as for request logs, and `gcs_bucket` tries once. When the bucket closes the connection without answering, the shared HTTP client sends the part again at once, as it does for request logs. A part write that still fails is logged as an error naming the batch and the part and is never retried later, the batch's other parts are still written, and the batch stays billed. `s3_v2` writes the parts through the same S3 logger as your request logs, so a failed part write counts in its `S3Logger` callback failure metric, a part's retries count in its per-flush retry warning, and with `s3_adaptive_concurrency` on, a throttled part write lowers the shared upload limit, never below `s3_max_concurrent_uploads`. A part write does not wait for that limit, so a worker can have one PUT above it
- Parts are UTF-8 with non-ASCII text kept as is. A line holding an unpaired surrogate escape from the provider, such as a lone `\ud83d`, has no UTF-8 form, so that line alone is written with its non-ASCII characters escaped
- With several proxy instances, the parts of an expired, cancelled or all-failed batch can be written by more than one instance. The names are the same, so the bucket keeps one copy of each part
- Batches still waiting to be written when the proxy shuts down are not written, and a batch being written at shutdown can be left with only its first parts. While 50 batches (`MAX_OBJECTS_PER_POLL_CYCLE`) on one worker are waiting or being written, the next batch's records are skipped and an error is logged
- Writing a batch's parts reads its output and error files from the provider a second time, after the cost row's reads, and its input file unless the bodies are dropped. Those reads are file content calls, so your request logging callbacks log them like any other
- Writing the parts prices every line again, the way the cost row already priced them, so anything that pricing does per line happens once more per line, such as a secret manager lookup when `key_management_system` reads secrets, or an INFO log line per line for a Vertex AI batch. Checking the creating key's or team's logging settings also looks up their secret references once per batch
- `s3_use_team_prefix`, `s3_use_key_prefix`, `s3_log_prompts_only` and `s3_strip_base64_files` do not apply to these parts
- While a batch is written, the worker holds its input, output and error files plus the records of the part being built and sent, so plan memory for your largest batch's files plus a few times the part size. Encrypting a part for an HTTPS bucket runs on the worker's event loop, so a large part briefly slows the requests that worker is serving. A part still being priced when the proxy shuts down makes the shutdown take a few seconds longer

## FAQ

### Where are my files written?

When `target_model_names` is specified, the file is written to all deployments that match it. No additional infrastructure is required.

### Could the batch be created on one deployment (e.g. eastus-01) but a subsequent retrieve be routed to a different deployment (e.g. eastus2-01)?

No. LiteLLM load balances between deployments for the initial batch create. The returned batch id encodes the deployment that was used, so retrieve, cancel and file content calls are sticky to that deployment.
