import TabItem from '@theme/TabItem';
import Tabs from '@theme/Tabs';
import Image from '@theme/IdealImage';

# [BETA] LiteLLM Managed Files

- Reuse the same file across different providers.
- Track proxy-uploaded files and enforce ownership checks for managed file operations.

<EnterpriseFeature free />

| Property | Value | Comments |
| --- | --- | --- |
| Proxy | ✅ |  |
| SDK | ❌ | Requires postgres DB for storing file ids. |
| Available across all providers | ✅ |  |
| Supported endpoints | `/chat/completions`, `/batch`, `/fine_tuning`, `/responses` |  |

## Usage

### 1. Setup config.yaml

```yaml
model_list:
    - model_name: "{{gemini_flash}}"
      litellm_params:
        model: vertex_ai/{{gemini_flash}}
        vertex_project: my-project-id
        vertex_location: us-central1
    - model_name: "{{openai_small}}-openai"
      litellm_params:
        model: {{openai_small}}
        api_key: os.environ/OPENAI_API_KEY

general_settings: 
  master_key: os.environ/LITELLM_MASTER_KEY  # alternatively use the env var - LITELLM_MASTER_KEY
  database_url: "postgresql://<user>:<password>@<host>:<port>/<dbname>" # alternatively use the env var - DATABASE_URL

litellm_settings:
  require_managed_files: false # default; set true to require managed uploads
```

#### (Optional) Require managed file IDs

`require_managed_files` defaults to `false`. With the default, LiteLLM records ownership for new plain-provider and model-routed uploads without changing their existing response IDs. Plain uploads return the provider ID; model-routed uploads return the model-encoded ID. Set `require_managed_files: true` under `litellm_settings` to require managed uploads.

```yaml
litellm_settings:
  require_managed_files: true
```

When enabled, every upload must include `target_model_names`; do not use the `model` parameter. Uploads without `target_model_names`, or with `model`, return `400`. The setting applies to admins and non-admins. Raw provider file IDs are rejected on file operations, even if LiteLLM recorded them before strict mode was enabled. To migrate a raw file, upload its source again with `target_model_names` and use the unified ID returned by that upload. LiteLLM does not convert existing IDs.

```python
# String (comma-separated for multiple models)
extra_body={"target_model_names": "{{openai_small}}-openai, {{gemini_flash}}"}

# List (OpenAI Python SDK sends this as target_model_names[] in multipart form)
extra_body={"target_model_names": ["{{openai_small}}-openai"]}
```

For example, re-upload a batch file and use the returned managed ID:

```bash
FILE_ID=$(curl -sS "$LITELLM_BASE_URL/v1/files" \
  -H "Authorization: Bearer $USER_KEY" \
  -F "purpose=batch" \
  -F "file=@batch.jsonl" \
  -F "target_model_names=my-openai-alias" | jq -r '.id')

curl -sS -H "Authorization: Bearer $USER_KEY" \
  "$LITELLM_BASE_URL/v1/files?target_model_names=my-openai-alias"
curl -sS -H "Authorization: Bearer $USER_KEY" \
  "$LITELLM_BASE_URL/v1/files/$FILE_ID/content"
```

### 2. Start proxy

```bash
litellm --config /path/to/config.yaml
```

### 3. Test it!

Specify `target_model_names` to use the same file id across different providers. This is the list of model_names set via config.yaml (or 'public_model_names' on UI). 

```python
target_model_names="{{openai_small}}-openai, {{gemini_flash}}" # Specify model_names
```

Check `/v1/models` to see the list of available model names for a key.

#### **Store a PDF file**

```python
from openai import OpenAI

client = OpenAI(base_url="http://0.0.0.0:4000", api_key="sk-<your-litellm-api-key>", max_retries=0)


# Download and save the PDF locally 
url = (
    "https://storage.googleapis.com/cloud-samples-data/generative-ai/pdf/2403.05530.pdf"
)
response = requests.get(url)
response.raise_for_status()

# Save the PDF locally
with open("2403.05530.pdf", "wb") as f:
    f.write(response.content)

file = client.files.create(
    file=open("2403.05530.pdf", "rb"),
    purpose="user_data", # can be any openai 'purpose' value
    extra_body={"target_model_names": "{{openai_small}}-openai, {{gemini_flash}}"}, # Specify model_names
)

print(f"file id={file.id}")
```

#### **Use the same file id across different providers**

<Tabs>
<TabItem value="openai" label="OpenAI">

```python
completion = client.chat.completions.create(
    model="{{openai_small}}-openai",
    messages=[
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "What is in this recording?"},
                {
                    "type": "file",
                    "file": {
                        "file_id": file.id,
                    },
                },
            ],
        },
    ]
)

print(completion.choices[0].message)
```


</TabItem>
<TabItem value="vertex" label="Vertex AI">

```python
completion = client.chat.completions.create(
    model="{{gemini_flash}}",
    messages=[
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "What is in this recording?"},
                {
                    "type": "file",
                    "file": {
                        "file_id": file.id,
                    },
                },
            ],
        },
    ]
)

print(completion.choices[0].message)

```

</TabItem>
</Tabs>

### Complete Example

```python   
import base64
import requests
from openai import OpenAI

client = OpenAI(base_url="http://0.0.0.0:4000", api_key="sk-<your-litellm-api-key>", max_retries=0)


# Download and save the PDF locally
url = (
    "https://storage.googleapis.com/cloud-samples-data/generative-ai/pdf/2403.05530.pdf"
)
response = requests.get(url)
response.raise_for_status()

# Save the PDF locally
with open("2403.05530.pdf", "wb") as f:
    f.write(response.content)

# Read the local PDF file
file = client.files.create(
    file=open("2403.05530.pdf", "rb"),
    purpose="user_data", # can be any openai 'purpose' value
    extra_body={"target_model_names": "{{openai_small}}-openai, vertex_ai/{{gemini_flash}}"},
)

print(f"file.id: {file.id}") # Unified file id

## GEMINI CALL ### 
completion = client.chat.completions.create(
    model="{{gemini_flash}}",
    messages=[
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "What is in this recording?"},
                {
                    "type": "file",
                    "file": {
                        "file_id": file.id,
                    },
                },
            ],
        },
    ]
)

print(completion.choices[0].message)


### OPENAI CALL ### 
completion = client.chat.completions.create(
    model="{{openai_small}}-openai",
    messages=[
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "What is in this recording?"},
                {
                    "type": "file",
                    "file": {
                        "file_id": file.id,
                    },
                },
            ],
        },
    ],
)

print(completion.choices[0].message)

```

## File Permissions

With `require_managed_files: false`, non-admin provider-account lists contain only files with an ownership record matching the caller's user or team. Older files and files uploaded directly to a provider that lack an ownership record are omitted from these lists. A known raw ID for an untracked file is still passed through with the default setting, so list filtering does not enforce access to legacy files. Proxy admins bypass the LiteLLM ownership filter.

Upload, list, and read a plain provider file while `require_managed_files` is false:

```bash
FILE_ID=$(curl -sS "$LITELLM_BASE_URL/v1/files?provider=openai" \
  -H "Authorization: Bearer $USER_KEY" \
  -F "purpose=batch" \
  -F "file=@batch.jsonl" | jq -r '.id')

curl -sS -H "Authorization: Bearer $USER_KEY" \
  "$LITELLM_BASE_URL/v1/files?provider=openai"
curl -sS -H "Authorization: Bearer $USER_KEY" \
  "$LITELLM_BASE_URL/v1/files/$FILE_ID/content?provider=openai"
```

### 1. Setup config.yaml

```yaml
model_list:
    - model_name: "{{openai_small}}-openai"
      litellm_params:
        model: {{openai_small}}
        api_key: os.environ/OPENAI_API_KEY

general_settings: 
  master_key: os.environ/LITELLM_MASTER_KEY  # alternatively use the env var - LITELLM_MASTER_KEY
  database_url: "postgresql://<user>:<password>@<host>:<port>/<dbname>" # alternatively use the env var - DATABASE_URL
```

### 2. Start proxy

```bash
litellm --config /path/to/config.yaml
```

### 3. Issue a key to the user

Let's create a user with the id `user_123`.

```bash
curl -L -X POST 'http://0.0.0.0:4000/user/new' \
-H "Authorization: Bearer $LITELLM_API_KEY" \
-H 'Content-Type: application/json' \
-d '{"models": ["{{openai_small}}-openai"], "user_id": "user_123"}'
```

Get the key from the response.

```json
{
    "key": "sk-..."
}
```

### 4. User creates a file

#### 4a. Create a file

```jsonl
{"messages": [{"role": "system", "content": "Clippy is a factual chatbot that is also sarcastic."}, {"role": "user", "content": "What's the capital of France?"}, {"role": "assistant", "content": "Paris, as if everyone doesn't know that already."}]}
{"messages": [{"role": "system", "content": "Clippy is a factual chatbot that is also sarcastic."}, {"role": "user", "content": "Who wrote 'Romeo and Juliet'?"}, {"role": "assistant", "content": "Oh, just some guy named William Shakespeare. Ever heard of him?"}]}
```

#### 4b. Upload the file

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://0.0.0.0:4000",
    api_key="sk-...", # Use the key you generated in step 3
    max_retries=0
)

# Upload file
finetuning_input_file = client.files.create(
    file=open("./fine_tuning.jsonl", "rb"), # {"model": "azure-gpt-4o"} <-> {"model": "gpt-4o-my-special-deployment"}
    purpose="fine-tune",
    extra_body={"target_model_names": "gpt-4.1-openai"} # Tells litellm which regions/projects to write the file in.
)
print(finetuning_input_file) # file.id = "litellm_proxy/..." = {"model_name": {"deployment_id": "deployment_file_id"}}
```

### 5. User retrieves a file 

<Tabs>
<TabItem value="has_access" label="User created file">

```python
from openai import OpenAI

... # User created file (3b)

file = client.files.retrieve(
    file_id=finetuning_input_file.id
)

print(file) # File retrieved successfully
```

</TabItem>
<TabItem value="no_access" label="User did not create file">

```python
from openai import OpenAI

... # User created file (3b)

try: 
    file = client.files.retrieve(
        file_id="bGl0ZWxsbV9wcm94eTphcHBsaWNhdGlvbi9vY3RldC1zdHJlYW07dW5pZmllZF9pZCwyYTgzOWIyYS03YzI1LTRiNTUtYTUxYS1lZjdhODljNzZkMzU7dGFyZ2V0X21vZGVsX25hbWVzLGdwdC00by1iYXRjaA"
    )
except Exception as e:
    print(e) # User does not have access to this file

```

</TabItem>
</Tabs>




## Supported Endpoints

#### Create a file - `/files`

```python
from openai import OpenAI

client = OpenAI(base_url="http://0.0.0.0:4000", api_key="sk-<your-litellm-api-key>", max_retries=0)

# Download and save the PDF locally
url = (
    "https://storage.googleapis.com/cloud-samples-data/generative-ai/pdf/2403.05530.pdf"
)
response = requests.get(url)
response.raise_for_status()

# Save the PDF locally
with open("2403.05530.pdf", "wb") as f:
    f.write(response.content)

# Read the local PDF file
file = client.files.create(
    file=open("2403.05530.pdf", "rb"),
    purpose="user_data", # can be any openai 'purpose' value
    extra_body={"target_model_names": "{{openai_small}}-openai, vertex_ai/{{gemini_flash}}"},
)
```

#### Retrieve a file - `/files/{file_id}`

```python
client = OpenAI(base_url="http://0.0.0.0:4000", api_key="sk-<your-litellm-api-key>", max_retries=0)

file = client.files.retrieve(file_id=file.id)
```

#### Delete a file - `/files/{file_id}/delete`

```python
client = OpenAI(base_url="http://0.0.0.0:4000", api_key="sk-<your-litellm-api-key>", max_retries=0)

file = client.files.delete(file_id=file.id)
```

#### List files - `/files`

```python
client = OpenAI(base_url="http://0.0.0.0:4000", api_key="sk-<your-litellm-api-key>", max_retries=0)

files = client.files.list(extra_body={"target_model_names": "{{openai_small}}-openai"})

print(files) # All files user has created
```

Pre-GA Limitations on List Files:
 - No multi-model support: Just 1 model name is supported for now. 
 - No multi-deployment support: Just 1 deployment of the model is supported for now (e.g. if you have 2 deployments with the `{{openai_small}}-openai` public model name, it will pick one and return all files on that deployment).

Pre-GA Limitations will be fixed before GA of the Managed Files feature.

## FAQ

**1. Does LiteLLM store the file?**

No, LiteLLM does not store the file. It only stores the file id's in the postgres DB.

**2. How does LiteLLM know which file to use for a given file id?**

LiteLLM stores a mapping of the litellm file id to the model-specific file id in the postgres DB. When a request comes in, LiteLLM looks up the model-specific file id and uses it in the request to the provider.

**3. How do file deletions work?**

When a file is deleted, LiteLLM deletes the mapping from the postgres DB, and the files on each provider.

**4. Can a user call a file ID that was created by another user?**

For tracked proxy uploads, access follows the recorded user and team ownership. With the default `require_managed_files: false`, an untracked raw provider ID is still passed through if the caller knows it. Set `require_managed_files: true` to reject raw IDs for all callers and use managed file IDs.



## Architecture





<Image img={require('../../img/managed_files_arch.png')}  style={{ width: '800px', height: 'auto' }} />

## See Also

- [Managed Files w/ Finetuning APIs](../../docs/proxy/managed_finetuning)
- [Managed Files w/ Batch APIs](../../docs/proxy/managed_batches)