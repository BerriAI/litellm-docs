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

## FAQ

### Where are my files written?

When `target_model_names` is specified, the file is written to all deployments that match it. No additional infrastructure is required.

### Could the batch be created on one deployment (e.g. eastus-01) but a subsequent retrieve be routed to a different deployment (e.g. eastus2-01)?

No. LiteLLM load balances between deployments for the initial batch create. The returned batch id encodes the deployment that was used, so retrieve, cancel and file content calls are sticky to that deployment.
