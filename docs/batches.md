import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# /batches

Covers Batches, Files

| Feature | Supported | Notes | 
|-------|-------|-------|
| Supported Providers | OpenAI, Azure, Vertex, Bedrock, Mistral, vLLM, Fireworks AI, xAI | - |
| Cost Tracking | ✅ | LiteLLM Enterprise only |
| Logging | ✅ | Works across all logging integrations |

Guardrails configured on your proxy are applied to the records inside a batch input file when it is
uploaded. See [Batch API Guardrails](./proxy/guardrails/batch_guardrails)

## Quick Start 

- Create File for Batch Completion

- Create Batch Request

- List Batches

- Retrieve the Specific Batch and File Content

**Create the batch input file**

Each line is one request in the [OpenAI batch file format](https://platform.openai.com/docs/guides/batch). `custom_id`, `method`, `url`, and `body` are required on every line:

```json showLineNumbers title="mydata.jsonl"
{"custom_id": "request-1", "method": "POST", "url": "/v1/chat/completions", "body": {"model": "{{openai_large}}", "messages": [{"role": "system", "content": "You are a helpful assistant."}, {"role": "user", "content": "Hello world!"}], "max_completion_tokens": 1000}}
{"custom_id": "request-2", "method": "POST", "url": "/v1/chat/completions", "body": {"model": "{{openai_large}}", "messages": [{"role": "system", "content": "You are an unhelpful assistant."}, {"role": "user", "content": "Hello world!"}], "max_completion_tokens": 1000}}
```

<Tabs>
<TabItem value="proxy" label="LiteLLM PROXY Server">

**Setup config.yaml and start the proxy**

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: {{openai_large}}
    litellm_params:
      model: openai/{{openai_large}}
      api_key: os.environ/OPENAI_API_KEY

files_settings:
  - custom_llm_provider: openai
    api_key: os.environ/OPENAI_API_KEY

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

```bash
$ export OPENAI_API_KEY="sk-..."
$ export LITELLM_MASTER_KEY="sk-$(openssl rand -hex 32)"
$ printf 'Local proxy key: %s\n' "$LITELLM_MASTER_KEY"

$ litellm --config config.yaml

# RUNNING on http://0.0.0.0:4000
```

In another terminal set `LITELLM_API_KEY` to the key printed above and then send the requests listed below.

**Create File for Batch Completion**

```shell
curl http://localhost:4000/v1/files \
    -H "Authorization: Bearer $LITELLM_API_KEY" \
    -F purpose="batch" \
    -F file="@mydata.jsonl"
```

**Create Batch Request**

```bash
curl http://localhost:4000/v1/batches \
        -H "Authorization: Bearer $LITELLM_API_KEY" \
        -H "Content-Type: application/json" \
        -d '{
            "input_file_id": "file-abc123",
            "endpoint": "/v1/chat/completions",
            "completion_window": "24h"
    }'
```

**Retrieve the Specific Batch**

```bash
curl http://localhost:4000/v1/batches/batch_abc123 \
    -H "Authorization: Bearer $LITELLM_API_KEY" \
    -H "Content-Type: application/json" \
```


**List Batches**

```bash
curl http://localhost:4000/v1/batches \
    -H "Authorization: Bearer $LITELLM_API_KEY" \
    -H "Content-Type: application/json" \
```

</TabItem>
<TabItem value="sdk" label="SDK">

**Create File for Batch Completion**

```python
import litellm
import os 
import asyncio

os.environ["OPENAI_API_KEY"] = "sk-.."

file_name = "mydata.jsonl"
_current_dir = os.path.dirname(os.path.abspath(__file__))
file_path = os.path.join(_current_dir, file_name)
file_obj = await litellm.acreate_file(
    file=open(file_path, "rb"),
    purpose="batch",
    custom_llm_provider="openai",
)
print("Response from creating file=", file_obj)
```

**Create Batch Request**

```python
import litellm
import os 
import asyncio

create_batch_response = await litellm.acreate_batch(
    completion_window="24h",
    endpoint="/v1/chat/completions",
    input_file_id=batch_input_file_id,
    custom_llm_provider="openai",
    metadata={"key1": "value1", "key2": "value2"},
)

print("response from litellm.create_batch=", create_batch_response)
```

**Retrieve the Specific Batch and File Content**

```python
# Maximum wait time before we give up
MAX_WAIT_TIME = 300  

# Time to wait between each status check
POLL_INTERVAL = 5

#Time waited till now 
waited = 0

# Wait for the batch to finish processing before trying to retrieve output
# This loop checks the batch status every few seconds (polling)

while True:
    retrieved_batch = await litellm.aretrieve_batch(
        batch_id=create_batch_response.id,
        custom_llm_provider="openai"
    )
    
    status = retrieved_batch.status
    print(f"Batch status: {status}")
    
    if status == "completed" and retrieved_batch.output_file_id:
        print("✅ Batch complete. Output file ID:", retrieved_batch.output_file_id)
        break
    elif status in ["failed", "cancelled", "expired"]:
        raise RuntimeError(f"❌ Batch failed with status: {status}")
    
    await asyncio.sleep(POLL_INTERVAL)
    waited += POLL_INTERVAL
    if waited > MAX_WAIT_TIME:
        raise TimeoutError("❌ Timed out waiting for batch to complete.")

print("retrieved batch=", retrieved_batch)
# just assert that we retrieved a non None batch

assert retrieved_batch.id == create_batch_response.id

# try to get file content for our original file

file_content = await litellm.afile_content(
    file_id=batch_input_file_id, custom_llm_provider="openai"
)

print("file content = ", file_content)
```

**List Batches**

```python
list_batches_response = litellm.list_batches(custom_llm_provider="openai", limit=2)
print("list_batches_response=", list_batches_response)
```

</TabItem>

</Tabs>


## Multi-Account / Model-Based Routing

Route your batch operations to different provider accounts via the model specific credentials in your `config.yaml`. No environment variables required and this enables multi-tenant batch processing.

### How It Works

**Priority Order:**
1. **Encoded Batch/File ID** (highest) - Model info embedded in the ID
2. **Model Parameter** - Via header (`x-litellm-model`), query param, or request body
3. **Custom Provider** (fallback) - Uses environment variables

### Configuration

```yaml keep-model-ids
model_list:
  - model_name: openai-account-1
    litellm_params:
      model: openai/{{openai_large}}
      api_key: sk-account-1-key
      api_base: https://api.openai.com/v1
  
  - model_name: openai-account-2
    litellm_params:
      model: openai/{{openai_large}}
      api_key: sk-account-2-key
      api_base: https://api.openai.com/v1
  
  - model_name: azure-batches
    litellm_params:
      model: azure/gpt-5.6-terra
      api_key: azure-key-123
      api_base: https://my-resource.openai.azure.com
      api_version: "2024-02-01"
```

### Usage Examples

#### Scenario 1: Encoded File ID with Model

When you upload a file with a model parameter, LiteLLM will encode the model details into the file ID. All subsequent operations will then use those credentials.

```bash
# Step 1: Upload file with model
curl http://localhost:4000/v1/files \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "x-litellm-model: openai-account-1" \
  -F purpose="batch" \
  -F file="@batch.jsonl"

# Response includes encoded file ID:
# {
#   "id": "file-bGl0ZWxsbTpmaWxlLUxkaUwzaVYxNGZRVlpYcU5KVEdkSjk7bW9kZWwsb3BlbmFpLWFjY291bnQtMQ",
#   ...
# }

# Step 2: Create batch - automatically routes to openai-account-1
curl http://localhost:4000/v1/batches \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "input_file_id": "file-bGl0ZWxsbTpmaWxlLUxkaUwzaVYxNGZRVlpYcU5KVEdkSjk7bW9kZWwsb3BlbmFpLWFjY291bnQtMQ",
    "endpoint": "/v1/chat/completions",
    "completion_window": "24h"
  }'

# Batch ID is also encoded with model:
# {
#   "id": "batch_bGl0ZWxsbTpiYXRjaF82OTIwM2IzNjg0MDQ4MTkwYTA3ODQ5NDY3YTFjMDJkYTttb2RlbCxvcGVuYWktYWNjb3VudC0x",
#   "input_file_id": "file-bGl0ZWxsbTpmaWxlLUxkaUwzaVYxNGZRVlpYcU5KVEdkSjk7bW9kZWwsb3BlbmFpLWFjY291bnQtMQ",
#   ...
# }

# Step 3: Retrieve batch - automatically routes to openai-account-1
curl http://localhost:4000/v1/batches/batch_bGl0ZWxsbTpiYXRjaF82OTIwM2IzNjg0MDQ4MTkwYTA3ODQ5NDY3YTFjMDJkYTttb2RlbCxvcGVuYWktYWNjb3VudC0x \
  -H "Authorization: Bearer $LITELLM_API_KEY"
```

**✅ Benefits:**
- No need to specify model on every request
- File and batch IDs "remember" which account created them
- Automatic routing for retrieve, cancel, and file content operations

#### Scenario 2: Model via Header/Query Parameter

Specify the model for each request (don't encode it in the ID).

```bash
# Create batch with model header
curl http://localhost:4000/v1/batches \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "x-litellm-model: openai-account-2" \
  -H "Content-Type: application/json" \
  -d '{
    "input_file_id": "file-abc123",
    "endpoint": "/v1/chat/completions",
    "completion_window": "24h"
  }'

# Or use query parameter
curl "http://localhost:4000/v1/batches?model=openai-account-2" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "input_file_id": "file-abc123",
    "endpoint": "/v1/chat/completions",
    "completion_window": "24h"
  }'

# List batches for specific model
curl "http://localhost:4000/v1/batches?model=openai-account-2" \
  -H "Authorization: Bearer $LITELLM_API_KEY"
```

**✅ Use Case:**
- One-off batch operations
- Different models for different operations
- Explicit control over routing

#### Scenario 3: Environment Variables (Fallback)

Traditional approach using environment variables when no model is specified.

```bash
export OPENAI_API_KEY="sk-env-key"

curl http://localhost:4000/v1/batches \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "input_file_id": "file-abc123",
    "endpoint": "/v1/chat/completions",
    "completion_window": "24h"
  }'
```

**✅ Use Case:**
- Backward compatibility
- Simple single-account setups
- Quick prototyping

### Complete Multi-Account Example

```bash
# Upload file to Account 1
FILE_1=$(curl -s http://localhost:4000/v1/files \
  -H "x-litellm-model: openai-account-1" \
  -F purpose="batch" \
  -F file="@batch1.jsonl" | jq -r '.id')

# Upload file to Account 2
FILE_2=$(curl -s http://localhost:4000/v1/files \
  -H "x-litellm-model: openai-account-2" \
  -F purpose="batch" \
  -F file="@batch2.jsonl" | jq -r '.id')

# Create batch on Account 1 (auto-routed via encoded file ID)
BATCH_1=$(curl -s http://localhost:4000/v1/batches \
  -d "{\"input_file_id\": \"$FILE_1\", \"endpoint\": \"/v1/chat/completions\", \"completion_window\": \"24h\"}" | jq -r '.id')

# Create batch on Account 2 (auto-routed via encoded file ID)
BATCH_2=$(curl -s http://localhost:4000/v1/batches \
  -d "{\"input_file_id\": \"$FILE_2\", \"endpoint\": \"/v1/chat/completions\", \"completion_window\": \"24h\"}" | jq -r '.id')

# Retrieve both batches (auto-routed to correct accounts)
curl http://localhost:4000/v1/batches/$BATCH_1
curl http://localhost:4000/v1/batches/$BATCH_2

# List batches per account
curl "http://localhost:4000/v1/batches?model=openai-account-1"
curl "http://localhost:4000/v1/batches?model=openai-account-2"
```

### SDK Usage with Model Routing

```python
import litellm
import asyncio

# Upload file with model routing
file_obj = await litellm.acreate_file(
    file=open("batch.jsonl", "rb"),
    purpose="batch",
    model="openai-account-1",  # Route to specific account
)

print(f"File ID: {file_obj.id}")
# File ID is encoded with model info

# Create batch - automatically uses openai-account-1 credentials
batch = await litellm.acreate_batch(
    completion_window="24h",
    endpoint="/v1/chat/completions",
    input_file_id=file_obj.id,  # Model info embedded in ID
)

print(f"Batch ID: {batch.id}")
# Batch ID is also encoded

# Retrieve batch - automatically routes to correct account
retrieved = await litellm.aretrieve_batch(
    batch_id=batch.id,  # Model info embedded in ID
)

print(f"Batch status: {retrieved.status}")

# Or explicitly specify model
batch2 = await litellm.acreate_batch(
    completion_window="24h",
    endpoint="/v1/chat/completions",
    input_file_id="file-regular-id",
    model="openai-account-2",  # Explicit routing
)
```

### How ID Encoding Works

LiteLLM encodes model information into file and batch IDs using base64:

```
Original:  file-abc123
Encoded:   file-bGl0ZWxsbTpmaWxlLWFiYzEyMzttb2RlbCxvcGVuYWktdGVzdA
           └─┬─┘ └───────────────────────┬────────────────────────┘
          prefix      base64(litellm:file-abc123;model,openai-test)

Original:  batch_xyz789
Encoded:   batch_bGl0ZWxsbTpiYXRjaF94eXo3ODk7bW9kZWwsb3BlbmFpLXRlc3Q
           └──┬──┘ └────────────────────────┬────────────────────────┘
           prefix       base64(litellm:batch_xyz789;model,openai-test)
```

The encoding:
- ✅ Preserves OpenAI-compatible prefixes (`file-`, `batch_`)
- ✅ Is transparent to clients
- ✅ Enables automatic routing without additional parameters
- ✅ Works across all batch and file endpoints

### Supported Endpoints

All batch and file endpoints support model-based routing:

| Endpoint | Method | Model Routing |
|----------|--------|---------------|
| `/v1/files` | POST | ✅ Via header/query/body |
| `/v1/files/{file_id}` | GET | ✅ Auto from encoded ID + header/query |
| `/v1/files/{file_id}/content` | GET | ✅ Auto from encoded ID + header/query |
| `/v1/files/{file_id}` | DELETE | ✅ Auto from encoded ID |
| `/v1/batches` | POST | ✅ Auto from file ID + header/query/body |
| `/v1/batches` | GET | ✅ Via header/query |
| `/v1/batches/{batch_id}` | GET | ✅ Auto from encoded ID |
| `/v1/batches/{batch_id}/cancel` | POST | ✅ Auto from encoded ID |

## Supported providers

LiteLLM supports the following provider-native batch APIs:

| Provider | Documentation |
| --- | --- |
| Azure OpenAI | [Azure OpenAI batches](./providers/azure#azure-batches-api) |
| OpenAI | [Quick start](#quick-start) |
| Google Vertex AI | [Vertex AI batch APIs](/docs/providers/vertex_batch) |
| Amazon Bedrock | [Amazon Bedrock batch inference](./providers/bedrock_batches) |
| Mistral AI | [Mistral AI Batch API](./providers/mistral_batches) |
| vLLM | [vLLM batches](./providers/vllm_batches), run by LiteLLM when the server has no Files API |
| Fireworks AI | [Fireworks AI batches](./providers/fireworks_ai_batches), running via LiteLLM as Fireworks' own Batch API has been switched off as of November 2026 |
| xAI | [xAI Batch API](./providers/xai_batches) |

Amazon Bedrock is the AWS integration that's supported for batch inference.

## Batch Input File Validation

LiteLLM validates the batch input files at upload time. When a client uploads a file to `POST /v1/files` via `purpose="batch"`, LiteLLM will validate the file locally and reject any invalid files prior to forwarding it on to the provider. Validation occurs on every `/v1/files` routing path, whether that be provider routed uploads via `files_settings` or [LiteLLM managed files](./proxy/managed_batches) uploads that use `target_model_names`.

Rejections use the OpenAI error format (an `error` object with `message`, `type`, `param` and `code` fields) so existing OpenAI SDK error handling will work exactly as before.

### Limit the batch input file size

Set `max_batch_file_size_mb` under `general_settings` to cap the size of batch input files. It's an integer in MB. No cap is applied if it's unset.

```yaml
general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  max_batch_file_size_mb: 10
```

A `purpose="batch"` upload larger than the cap is rejected with HTTP `413`:

```json
{
  "error": {
    "message": "Batch input file is 12.0 MB, which exceeds the configured max_batch_file_size_mb of 10 MB. The file was not forwarded to the provider.",
    "type": "invalid_request_error",
    "param": "file",
    "code": "413"
  }
}
```

`max_batch_file_size_mb` applies only to batch input file uploads. It is separate from `max_request_size_mb`, which applies to every proxy route

### Limit the number of records in a batch file

Set `max_batch_file_records` under `general_settings` to cap the number of request lines that one batch input file can hold. Blank lines are not counted. When it is unset then no record cap applies.

```yaml
general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  max_batch_file_records: 1000
```

A `purpose="batch"` upload with more records than the cap is rejected with HTTP `413` and the file is not passed on to the provider.

```json
{
  "error": {
    "message": "Batch input file has more than 1000 records, which exceeds the max_batch_file_records of 1000 set in general_settings. The file was not forwarded to the provider.",
    "type": "invalid_request_error",
    "param": "file",
    "code": "413"
  }
}
```

The `general_settings` value applies to every key. A proxy admin can set a different cap on a key via `max_batch_file_records` in that key's metadata and can set a cap for an entire team in the team's metadata. If both the key and the team have a cap then the lower one applies and the message will tell you where it was set.

### Content validation

LiteLLM always validates the content of `purpose="batch"` uploads. There is no option to turn this off. The filename must end in `.jsonl` (case insensitive). The file must have at least one non-blank line. Every non-blank line must be valid JSON. Every line must be a JSON object. The object must contain the `custom_id`, `method`, `url` and `body` keys.

A file that fails any of these checks is rejected with HTTP `400` and `"type": "invalid_request_error"`. `param` is the field name of the failing field: `file` if the extension is wrong, the file is empty, the line is not valid JSON or the line is not a JSON object. `param` is the missing key in the case of a missing required key (e.g. `method`). `message` contains the 1-based line number where applicable. Line numbers count every line in the file including blank lines.

### Provider batch limits

Each provider enforces its own limits on batch input files. Use them to pick a value for `max_batch_file_size_mb`

| Provider | Max input file size | Max requests |
|----------|---------------------|--------------|
| [OpenAI](https://developers.openai.com/api/docs/guides/batch) | 200 MB | 50,000 per batch |
| [Azure OpenAI](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/batch) | 200 MB | 100,000 per file |
| [Vertex AI](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/batch-prediction-gemini) | 1 GB | 200,000 per job |
| [Amazon Bedrock](https://docs.aws.amazon.com/general/latest/gr/bedrock.html) | 1 GB per file | See AWS Service Quotas |

With bring your own Blob Storage the Azure OpenAI file cap is 1GB. The Vertex AI cap is on Cloud Storage input. Amazon Bedrock also has a total job size cap (5GB for most models). Set `max_batch_file_size_mb` at or below the smallest of the provider limits that you route your batch traffic to.

## Batch Upload and Download Limits

Two settings govern how often a caller can upload their batch input files and download the file content. Both are off unless set.

| Setting | What it counts | Window |
| --- | --- | --- |
| `max_batch_file_uploads_per_day` | `POST /v1/files` uploads with `purpose="batch"` | UTC day |
| `max_file_downloads_per_minute` | `GET /v1/files/{file_id}/content` calls for one file | One minute |

```yaml
general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  max_batch_file_uploads_per_day: 50
  max_file_downloads_per_minute: 10
```

A request which has passed either limit is rejected with an HTTP `429` and a `Retry-After` header which gives the seconds until the window resets. For uploads that is 00:00 UTC. The message will name the limit, its value and where it was set.

```json
{
  "error": {
    "message": "Download limit reached for file file-abc123: max_file_downloads_per_minute is 10 for this key (set in general_settings). Retry in 18 seconds.",
    "type": "rate_limit_error",
    "param": null,
    "code": "429"
  }
}
```

The download limit is file based so you can hit it on one file and still go on to download other files. It's every file id, whether it's a batch input, batch output or an error file.

### Setting limits per key or team

The `general_settings` value is a default whereby each key has its own count. A JWT caller without a virtual key is counted against their user id. A proxy admin can change the limit for one key by setting the same name in that key's metadata which will then replace the default for that key:

```bash
curl -X POST 'http://localhost:4000/key/update' \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"key": "sk-...", "metadata": {"max_file_downloads_per_minute": 2}}'
```

Setting the name in a team's metadata adds a second constraint which is shared by every key in that team. If both constraints are in place then the request has to satisfy both and a request which is rejected by one constraint doesn't consume a slot in the other.

Only a proxy admin can set, change or clear `max_batch_file_records`, `max_batch_file_uploads_per_day` and `max_file_downloads_per_minute` in key or team metadata (including the metadata sent to `POST /user/new`). Any request from any other role to change them will be rejected with a `403`. `/config/update` will reject a value that is not a positive integer.

### What counts against the limits

An upload which fails batch input file validation (i.e. wrong format, too many records, too large) is not counted. An upload which passes validation is counted regardless of whether a guardrail or the provider subsequently rejects it. A download is counted even if the provider returns an error for it.

With Redis in place the counts are shared across all proxy instances and workers. Without Redis each worker has its own count so a caller could potentially hit the limit up to the number of workers times. The counts get reset on proxy restart. Each worker holds up to 20,000 live counters (one per caller and window and per file id for downloads) and once more than that are live the one closest to expiry is dropped so the caller starts a fresh window early.

The limits apply to the `/v1/files` routes above, including `/files` and `/{provider}/v1/files`. Provider pass-through routes are not counted

## How Rate Limiting for Batches API Works

Batch rate limits are enforced when the client makes the `POST /v1/batches` call, not when the input file is uploaded.

1. The client uploads the JSONL input file with `POST /v1/files`. The upload of the file does not use up the batch TPM or RPM allowance.
2. When the client creates the batch, LiteLLM will download and evaluate the referenced input file.
3. LiteLLM atomically checks the entire file against all relevant limits.
4. If a limit would be exceeded then LiteLLM returns `429` and doesn't submit the batch to the provider. Otherwise it records the usage and creates the provider batch.

This enables LiteLLM to accept or reject the batch prior to the provider even processing it.

### What LiteLLM counts

| Limit | Batch charge |
| --- | --- |
| RPM | One request for each JSONL record. |
| TPM | Input tokens found in each record's `body.messages`, `body.prompt`, or `body.input`. |
| Project ITPM | The same input-token count, grouped by each record's `body.model`. |
| Project OTPM | An output token reservation per record, grouped by `body.model`. LiteLLM uses `max_tokens`, `max_completion_tokens` or `max_output_tokens` where available and takes into account `n` and `best_of`. Embedding records have no output token reservation. If no output cap is present then LiteLLM will use the v3 limiter's built in estimate (bounded by the smallest applicable OTPM limit). |

If LiteLLM can't tokenize an individual record it will use a conservative estimate based on the size of the serialized record. A bad JSONL line still counts as one request.

:::important

`LITELLM_TPM_TOKEN_RESERVATION_ENABLED` has no control over batch rate limiting. That variable is used to control pre-request reservation for real time requests such as chat completions. `POST /v1/batches` will always use the batch input file limiter as described here unless one of the batch specific skip settings below is in effect.

:::

### Enqueued-token limits

Per-minute windows are a terrible fit for batches as a batch will run for hours but the entire input file is charged to a single minute at submission. To govern batch submissions by the amount of outstanding batch work, set an enqueued token allowance in the key or team metadata:

```bash
curl -X POST 'http://localhost:4000/key/generate' \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"metadata": {"batch_enqueued_token_limit": 100000}}'
```

`batch_enqueued_token_limit` also works in team metadata. If both the key and the team set the value then the batch has to fit both allowances.

Only a proxy admin can set or change `batch_enqueued_token_limit`. Any key/team requests from any other role attempting to write it will be rejected with a `403`.

When a key or team has an enqueued-token limit, batch submission is governed only by that allowance:

1. When the client creates a batch, LiteLLM takes the file's estimated tokens (the input tokens plus the output cap per record) and reserves those against the allowance.
2. If the batch doesn't fit then LiteLLM returns `429` (naming the enqueued token limit) and doesn't submit the batch to the provider.
3. When LiteLLM serves a response which shows the batch in a terminal state (i.e. completed, failed, expired or cancelled) it will refund the reservation. Polling `GET /v1/batches/{batch_id}` and cancelling with `POST /v1/batches/{batch_id}/cancel` both count.
4. Batch submissions are not charged against the per minute TPM and RPM windows so a batch which would exceed the key's RPM is accepted as long as it falls within the allowance.

Real time traffic (e.g. chat completions) is unaffected in this respect as it will still consume the key's TPM and RPM limits exactly as before.

Two details to plan around:

- `disable_batch_input_file_rate_limiting` and `skip_batch_input_file_rate_limiting_for_providers` take priority. In those cases LiteLLM will do no enqueued token accounting at all.
- Some batches do get to a terminal state that LiteLLM never sees. A case in point is a batch where the client is simply polling directly against the provider. The reservations for those batches expire after 8 days.

#### Per-model limits on a project

<SinceVersion v="1.111.0" />

When you have several apps sharing one team then run each app as its own project and cap the tokens each app can have enqueued for each model with `model_batch_enqueued_token_limit` in the project metadata.

```bash
curl -X POST 'http://localhost:4000/project/update' \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"project_id": "batch-app-project", "metadata": {"model_batch_enqueued_token_limit": {"gpt-5.5": 2000}}}'
```

The project maintains one counter per model. Each key in the project shares that counter. A caller whose custom auth is producing rotating tokens will therefore still be subject to that same limit. A batch that doesn't fit gets a `429`:

```json
{"error": {"message": "Batch enqueued token limit exceeded for project_model: batch-app-project:gpt-5.5. Batch requires 1221 tokens but only 779 enqueued tokens remaining out of 2000 enqueued token limit. Tokens free up as running batches complete or are cancelled.", "type": "throttling_error", "param": null, "code": "429"}}
```

How a batch is charged:

- The batch is charged against the model it routes to and against every capped model named in its records' `body.model`. Records which have no `body.model` are charged against the model the batch routes to.
- LiteLLM will rewrite the record of a managed file (uploaded with `target_model_names`) to the deployment model on upload. A managed file therefore only counts against the limit of the model that the batch is routed to.
- Any names that resolve to the same model group (e.g. an alias and its model group, or a deployment id) will share a single counter under the most restrictive limit set amongst them. A `-latest` model name will be charged against the limit set for the model that it points to and a dated snapshot such as `gpt-5.5-2026-04-23` will be charged against the limit set for its undated name.
- Tokens are refunded in the same way as key and team allowances: either when LiteLLM serves a response which shows the batch in a terminal state, or after 8 days.
- Only set project limits once every proxy instance has run a version that supports them. Bear that in mind when you're considering a rollback of a proxy instance. An instance running on an older version which is serving a batch's terminal state will only refund key and team allowances. The project tokens it skips remain held until no batch has reserved against that project and model for 8 days. A project which continues to send batches will therefore continue to have those tokens held. If that causes the project to hit its limit then you need to raise the limit to make space.

How it combines with other limits:

- If the key/team also has a `batch_enqueued_token_limit` then the batch must meet every allowance and no other batch limit comes into play (as per the above).
- Two conditions in combination will bypass the per-minute batch limits for a batch. Firstly, neither the key nor its team have a `batch_enqueued_token_limit` so only the project limit is in play. Secondly the project limit will cap the model the batch routes to and every model named in the batch's records. The limits that are skipped are key, team, user and end-user TPM and RPM as well as the project's per-model TPM, ITPM and OTPM. Daily `tpd_limit` caps still apply.
- If any of those models have no project cap then the batch will simply retain the normal batch limits on top of the project reservation.

Only a proxy admin can set or change `model_batch_enqueued_token_limit` on a project. A team admin attempting to do so will get a `403`. Each value must be a positive integer, otherwise `/project/new` and `/project/update` will return `400`.

The limit applies to callers whose request resolves to a project:

- With custom auth, place `custom_auth_run_common_checks: true` under `general_settings` so that LiteLLM can load the project's metadata.
- Native JWT auth doesn't assign a project so JWT callers aren't covered.

### Operational behavior

| Behavior | Operational impact |
| --- | --- |
| Accounting is based on the submitted file | The batch TPM and RPM counters are not reconciled against the provider's final usage. Final cost tracking is separate. |
| The complete file cannot be downloaded or evaluated | LiteLLM will log the error and submit the batch without charging it to TPM or RPM. If every batch is required to count against TPM and RPM then you should be monitoring these errors. |
| No applicable rate limit is configured | LiteLLM submits the batch without downloading it for rate-limit accounting. |
| The API key has a model allowlist | LiteLLM reads the file and validates every `body.model` prior to submission. |

### Skipping the input-file pre-read

Reading a large JSONL file can add latency to the batch submission. If you don't need the batch to be charged against TPM or RPM at submission then one of the following options can be used:

```yaml
general_settings:
  # Apply to all batch submissions
  disable_batch_input_file_rate_limiting: true

  # Or apply only to batches routed to selected providers
  skip_batch_input_file_rate_limiting_for_providers:
    - bedrock
```

The provider specific option uses the provider that's configured on the route that's been selected. It doesn't use a `custom_llm_provider` value that the client supplies.

For API keys that have a model allowlist, LiteLLM still has to read the file in order to validate each `body.model` value. In that scenario the settings above will only skip the TPM and RPM counter update. LiteLLM will still download the file and validate each model.

The following options are not supported:

- `skip_batch_input_file_rate_limiting_for_models` is retained for compatibility but has no effect. LiteLLM generates a warning at startup if it's configured.
- An `skip_batch_input_file_rate_limiting` flag in the request metadata is simply ignored.

Use the global or provider specific settings above to manage this behavior at the server level.

## How Cost Tracking for Batches API Works

**Enterprise:** automated batch cost tracking requires a LiteLLM Enterprise licence.

For managed batches, LiteLLM monitors the provider job in the background. When the job reaches a terminal state, LiteLLM:

1. Download the provider's output file.
2. Reads each successful output record.
3. Aggregates the prompt, completion and total token usage across those records.
4. Calculates the cost of each record using the batch pricing that has been configured for the deployment.
5. Records the combined usage and cost against the user, key, team and request tags from the request which created the batch.

Failed output records are excluded from the aggregate. If the batch has no output file because every record failed, LiteLLM records zero usage and zero cost.

The initial submission and the completed aggregate are recorded separately. The completed aggregate is emitted through standard spend tracking as an `aretrieve_batch` record, so it is available to the Admin UI and configured logging callbacks.

Batch cost tracking does not change the TPM or RPM counters reserved at submission. Those counters remain based on the input-file calculation described above.

## [API reference](https://docs.litellm.ai/api-reference/#tag/batch)
