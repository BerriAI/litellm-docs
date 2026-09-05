import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# /batches

Covers Batches, Files

| Feature | Supported | Notes | 
|-------|-------|-------|
| Supported Providers | OpenAI, Azure, Vertex, Bedrock | - |
| ✨ Cost Tracking | ✅ | LiteLLM Enterprise only |
| Logging | ✅ | Works across all logging integrations |

Guardrails configured on your proxy are applied to the records inside a batch input file when it is
uploaded. See [Batch API Guardrails](./proxy/guardrails/batch_guardrails)

## Quick Start 

- Create File for Batch Completion

- Create Batch Request

- List Batches

- Retrieve the Specific Batch and File Content


<Tabs>
<TabItem value="proxy" label="LiteLLM PROXY Server">

```bash
$ export OPENAI_API_KEY="sk-..."

$ litellm

# RUNNING on http://0.0.0.0:4000
```

**Create File for Batch Completion**

```shell
curl http://localhost:4000/v1/files \
    -H "Authorization: Bearer sk-1234" \
    -F purpose="batch" \
    -F file="@mydata.jsonl"
```

**Create Batch Request**

```bash
curl http://localhost:4000/v1/batches \
        -H "Authorization: Bearer sk-1234" \
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
    -H "Authorization: Bearer sk-1234" \
    -H "Content-Type: application/json" \
```


**List Batches**

```bash
curl http://localhost:4000/v1/batches \
    -H "Authorization: Bearer sk-1234" \
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

file_name = "openai_batch_completions.jsonl"
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
    print(f"⏳ Batch status: {status}")
    
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

Route batch operations to different provider accounts using model-specific credentials from your `config.yaml`. This eliminates the need for environment variables and enables multi-tenant batch processing.

### How It Works

**Priority Order:**
1. **Encoded Batch/File ID** (highest) - Model info embedded in the ID
2. **Model Parameter** - Via header (`x-litellm-model`), query param, or request body
3. **Custom Provider** (fallback) - Uses environment variables

### Configuration

```yaml
model_list:
  - model_name: gpt-4o-account-1
    litellm_params:
      model: openai/{{openai_large}}
      api_key: sk-account-1-key
      api_base: https://api.openai.com/v1
  
  - model_name: gpt-4o-account-2
    litellm_params:
      model: openai/{{openai_large}}
      api_key: sk-account-2-key
      api_base: https://api.openai.com/v1
  
  - model_name: azure-batches
    litellm_params:
      model: azure/{{openai_large}}
      api_key: azure-key-123
      api_base: https://my-resource.openai.azure.com
      api_version: "2024-02-01"
```

### Usage Examples

#### Scenario 1: Encoded File ID with Model

When you upload a file with a model parameter, LiteLLM encodes the model information in the file ID. All subsequent operations automatically use those credentials.

```bash
# Step 1: Upload file with model
curl http://localhost:4000/v1/files \
  -H "Authorization: Bearer sk-1234" \
  -H "x-litellm-model: gpt-4o-account-1" \
  -F purpose="batch" \
  -F file="@batch.jsonl"

# Response includes encoded file ID:
# {
#   "id": "file-bGl0ZWxsbTpmaWxlLUxkaUwzaVYxNGZRVlpYcU5KVEdkSjk7bW9kZWwsZ3B0LTRvLWFjY291bnQtMQ",
#   ...
# }

# Step 2: Create batch - automatically routes to gpt-4o-account-1
curl http://localhost:4000/v1/batches \
  -H "Authorization: Bearer sk-1234" \
  -H "Content-Type: application/json" \
  -d '{
    "input_file_id": "file-bGl0ZWxsbTpmaWxlLUxkaUwzaVYxNGZRVlpYcU5KVEdkSjk7bW9kZWwsZ3B0LTRvLWFjY291bnQtMQ",
    "endpoint": "/v1/chat/completions",
    "completion_window": "24h"
  }'

# Batch ID is also encoded with model:
# {
#   "id": "batch_bGl0ZWxsbTpiYXRjaF82OTIwM2IzNjg0MDQ4MTkwYTA3ODQ5NDY3YTFjMDJkYTttb2RlbCxncHQtNG8tYWNjb3VudC0x",
#   "input_file_id": "file-bGl0ZWxsbTpmaWxlLUxkaUwzaVYxNGZRVlpYcU5KVEdkSjk7bW9kZWwsZ3B0LTRvLWFjY291bnQtMQ",
#   ...
# }

# Step 3: Retrieve batch - automatically routes to gpt-4o-account-1
curl http://localhost:4000/v1/batches/batch_bGl0ZWxsbTpiYXRjaF82OTIwM2IzNjg0MDQ4MTkwYTA3ODQ5NDY3YTFjMDJkYTttb2RlbCxncHQtNG8tYWNjb3VudC0x \
  -H "Authorization: Bearer sk-1234"
```

**✅ Benefits:**
- No need to specify model on every request
- File and batch IDs "remember" which account created them
- Automatic routing for retrieve, cancel, and file content operations

#### Scenario 2: Model via Header/Query Parameter

Specify the model for each request without encoding it in the ID.

```bash
# Create batch with model header
curl http://localhost:4000/v1/batches \
  -H "Authorization: Bearer sk-1234" \
  -H "x-litellm-model: gpt-4o-account-2" \
  -H "Content-Type: application/json" \
  -d '{
    "input_file_id": "file-abc123",
    "endpoint": "/v1/chat/completions",
    "completion_window": "24h"
  }'

# Or use query parameter
curl "http://localhost:4000/v1/batches?model=gpt-4o-account-2" \
  -H "Authorization: Bearer sk-1234" \
  -H "Content-Type: application/json" \
  -d '{
    "input_file_id": "file-abc123",
    "endpoint": "/v1/chat/completions",
    "completion_window": "24h"
  }'

# List batches for specific model
curl "http://localhost:4000/v1/batches?model=gpt-4o-account-2" \
  -H "Authorization: Bearer sk-1234"
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
  -H "Authorization: Bearer sk-1234" \
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
  -H "x-litellm-model: gpt-4o-account-1" \
  -F purpose="batch" \
  -F file="@batch1.jsonl" | jq -r '.id')

# Upload file to Account 2
FILE_2=$(curl -s http://localhost:4000/v1/files \
  -H "x-litellm-model: gpt-4o-account-2" \
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
curl "http://localhost:4000/v1/batches?model=gpt-4o-account-1"
curl "http://localhost:4000/v1/batches?model=gpt-4o-account-2"
```

### SDK Usage with Model Routing

```python
import litellm
import asyncio

# Upload file with model routing
file_obj = await litellm.acreate_file(
    file=open("batch.jsonl", "rb"),
    purpose="batch",
    model="gpt-4o-account-1",  # Route to specific account
)

print(f"File ID: {file_obj.id}")
# File ID is encoded with model info

# Create batch - automatically uses gpt-4o-account-1 credentials
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
    model="gpt-4o-account-2",  # Explicit routing
)
```

### How ID Encoding Works

LiteLLM encodes model information into file and batch IDs using base64:

```
Original:  file-abc123
Encoded:   file-bGl0ZWxsbTpmaWxlLWFiYzEyMzttb2RlbCxncHQtNG8tdGVzdA
           └─┬─┘ └──────────────────┬──────────────────────┘
          prefix      base64(litellm:file-abc123;model,gpt-4o-test)

Original:  batch_xyz789
Encoded:   batch_bGl0ZWxsbTpiYXRjaF94eXo3ODk7bW9kZWwsZ3B0LTRvLXRlc3Q
           └──┬──┘ └──────────────────┬──────────────────────┘
           prefix       base64(litellm:batch_xyz789;model,gpt-4o-test)
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

Amazon Bedrock is the supported AWS integration for batch inference.

## Batch Input File Validation

LiteLLM validates batch input files at upload time. When a client uploads a file to `POST /v1/files` with `purpose="batch"`, LiteLLM checks the file locally and rejects invalid files before anything is forwarded to the provider. Validation runs on every `/v1/files` routing path, including provider-routed uploads configured through `files_settings` and [LiteLLM managed files](./proxy/managed_batches) uploads that use `target_model_names`

Rejections use the OpenAI error format, an `error` object with `message`, `type`, `param`, and `code` fields, so existing OpenAI SDK error handling works unchanged

### Limit the batch input file size

Set `max_batch_file_size_mb` under `general_settings` to cap the size of batch input files. The value is an integer in MB. When it is unset, no size cap applies

```yaml
general_settings:
  master_key: sk-1234
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

### Content validation

LiteLLM always validates the content of `purpose="batch"` uploads. There is no setting to configure. The filename must end in `.jsonl`, matched case-insensitively. The file must contain at least one non-blank line. Every non-blank line must be valid JSON. Every line must be a JSON object. Every object must contain the `custom_id`, `method`, `url`, and `body` keys

A file that fails any of these checks is rejected with HTTP `400` and `"type": "invalid_request_error"`. The `param` field names the offending field: `file` for a wrong extension, an empty file, a line that is not valid JSON, or a line that is not a JSON object. For a line that is missing a required key, `param` is the missing key, such as `method`. The `message` includes the 1-based line number where relevant. Line numbers count every line in the file, including blank lines

### Provider batch limits

Each provider enforces its own limits on batch input files. Use them to pick a value for `max_batch_file_size_mb`

| Provider | Max input file size | Max requests |
|----------|---------------------|--------------|
| [OpenAI](https://developers.openai.com/api/docs/guides/batch) | 200 MB | 50,000 per batch |
| [Azure OpenAI](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/batch) | 200 MB | 100,000 per file |
| [Vertex AI](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/batch-prediction-gemini) | 1 GB | 200,000 per job |
| [Amazon Bedrock](https://docs.aws.amazon.com/general/latest/gr/bedrock.html) | 1 GB per file | See AWS Service Quotas |

Azure OpenAI raises its file cap to 1 GB with bring-your-own Blob Storage. The Vertex AI cap applies to Cloud Storage input. Amazon Bedrock also caps total job size, at 5 GB for most models. Set `max_batch_file_size_mb` at or below the smallest limit of the providers you route batch traffic to

## How Rate Limiting for Batches API Works

Batch rate limits are enforced when the client calls `POST /v1/batches`, not when the input file is uploaded.

1. The client uploads the JSONL input file with `POST /v1/files`. This upload does not consume the batch TPM or RPM allowance.
2. When the client creates the batch, LiteLLM downloads and evaluates the referenced input file.
3. LiteLLM atomically checks the complete file against every applicable limit.
4. If any limit would be exceeded, LiteLLM returns `429` and does not submit the batch to the provider. Otherwise, it records the usage and creates the provider batch.

This allows LiteLLM to accept or reject the batch before the provider processes it.

### What LiteLLM counts

| Limit | Batch charge |
| --- | --- |
| RPM | One request for each JSONL record. |
| TPM | Input tokens found in each record's `body.messages`, `body.prompt`, or `body.input`. |
| Project ITPM | The same input-token count, grouped by each record's `body.model`. |
| Project OTPM | An output-token reservation for each record, grouped by `body.model`. LiteLLM uses `max_tokens`, `max_completion_tokens`, or `max_output_tokens` when present and accounts for `n` or `best_of`. Embedding records reserve no output tokens. If no output cap is present, LiteLLM uses the v3 limiter's built-in estimate, bounded by the smallest applicable OTPM limit. |

If LiteLLM cannot tokenize an individual record, it uses a conservative estimate based on the serialized record size. A malformed JSONL line still counts as one request.

:::important

`LITELLM_TPM_TOKEN_RESERVATION_ENABLED` does not control batch rate limiting. That variable controls pre-request reservation for real-time requests such as chat completions. `POST /v1/batches` always uses the batch input-file limiter described here unless one of the batch-specific skip settings below is enabled.

:::

### Enqueued-token limits

Per-minute windows fit batches poorly: a batch runs for hours, but its whole input file is charged to a single minute at submission. To govern batch submissions by outstanding batch work instead, set an enqueued-token allowance in the key or team metadata:

```bash
curl -X POST 'http://localhost:4000/key/generate' \
  -H 'Authorization: Bearer sk-1234' \
  -H 'Content-Type: application/json' \
  -d '{"metadata": {"batch_enqueued_token_limit": 100000}}'
```

`batch_enqueued_token_limit` also works in team metadata. When both the key and its team set one, the batch must fit both allowances.

Only a proxy admin can set or change `batch_enqueued_token_limit`. Key and team requests from other roles that try to write it are rejected with a `403`.

When a key or team has an enqueued-token limit, batch submission is governed only by that allowance:

1. When the client creates a batch, LiteLLM reserves the file's estimated tokens (the input tokens plus each record's output cap) against the allowance.
2. If the batch does not fit, LiteLLM returns `429` naming the enqueued token limit and does not submit the batch to the provider.
3. When LiteLLM serves a response showing the batch in a terminal state (completed, failed, expired, or cancelled), it refunds the reservation. Polling `GET /v1/batches/{batch_id}` and cancelling with `POST /v1/batches/{batch_id}/cancel` both qualify.
4. Batch submissions are not charged to the per-minute TPM and RPM windows, so a batch whose record count exceeds the key's RPM is accepted when it fits the allowance.

Real-time traffic such as chat completions is unaffected: it consumes the key's TPM and RPM limits exactly as before.

Two details to plan around:

- `disable_batch_input_file_rate_limiting` and `skip_batch_input_file_rate_limiting_for_providers` take precedence. When they apply, LiteLLM performs no enqueued-token accounting.
- Reservations for batches whose terminal state LiteLLM never observes (for example, a batch only ever polled directly against the provider) expire after 8 days.

### Operational behavior

| Behavior | Operational impact |
| --- | --- |
| Accounting is based on the submitted file | Batch TPM and RPM counters are not reconciled against the provider's final usage. Final cost tracking is separate. |
| The complete file cannot be downloaded or evaluated | LiteLLM logs the error and submits the batch without charging it to TPM or RPM. Monitor these errors if your deployment requires strict rate-limit enforcement. |
| No applicable rate limit is configured | LiteLLM submits the batch without downloading it for rate-limit accounting. |
| The API key has a model allowlist | LiteLLM reads the file and validates every `body.model` before submission. |

### Skipping the input-file pre-read

Reading a large JSONL file can add latency to batch submission. If you do not need the batch to be charged against TPM or RPM at submission, configure one of these options:

```yaml
general_settings:
  # Apply to all batch submissions
  disable_batch_input_file_rate_limiting: true

  # Or apply only to batches routed to selected providers
  skip_batch_input_file_rate_limiting_for_providers:
    - bedrock
```

The provider-specific option uses the provider configured on the selected route. It does not use a `custom_llm_provider` value supplied by the client.

For API keys with a model allowlist, LiteLLM must still read the file to validate each `body.model` value. In this case, the settings above skip the TPM and RPM counter update, but not the file download or model validation.

The following options are not supported:

- `skip_batch_input_file_rate_limiting_for_models` is retained for compatibility but has no effect. LiteLLM logs a warning at startup when it is configured.
- A `skip_batch_input_file_rate_limiting` flag in request metadata is ignored.

Use the global or provider-specific settings above to manage this behavior at the server level.

## How Cost Tracking for Batches API Works

✨ **Enterprise:** Automated batch cost tracking requires a LiteLLM Enterprise license.

For managed batches, LiteLLM monitors the provider job in the background. When the job reaches a terminal state, LiteLLM:

1. Downloads the provider's output file.
2. Reads each successful output record.
3. Aggregates prompt, completion, and total token usage across those records.
4. Calculates each record's cost using the deployment's configured batch pricing.
5. Records the combined usage and cost against the user, key, team, and request tags that created the batch.

Failed output records are excluded from the aggregate. If the batch has no output file because every record failed, LiteLLM records zero usage and zero cost.

The initial submission and the completed aggregate are recorded separately. The completed aggregate is emitted through standard spend tracking as an `aretrieve_batch` record, so it is available to the Admin UI and configured logging callbacks.

Batch cost tracking does not change the TPM or RPM counters reserved at submission. Those counters remain based on the input-file calculation described above.

## [Swagger API Reference](https://litellm-api.up.railway.app/#/batch)
