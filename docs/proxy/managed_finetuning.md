# [BETA] LiteLLM Managed Files with Finetuning

<EnterpriseFeature free />

| Property | Value | Comments |
| --- | --- | --- |
| Proxy | ✅ |  |
| SDK | ❌ | Requires postgres DB for storing file ids. |
| Available across all [Batch providers](../batches#supported-providers) | ✅ |  |
| Supported endpoints | `/fine_tuning/jobs` |  |

## Overview

Use this to:

- Create Finetuning jobs across OpenAI/Azure/Vertex AI in the OpenAI format (no additional `custom_llm_provider` param required). 
- Control finetuning model access by key/user/team (same as chat completion models)


## (Proxy Admin) Usage

Here's how to give developers access to your Finetuning models.

### 1. Setup config.yaml

Include `/fine_tuning` in the `supported_endpoints` list. Tells developers this model supports the `/fine_tuning` endpoint.

```yaml showLineNumbers title="litellm_config.yaml"
model_list:
  - model_name: "gpt-4.1-azure"
    litellm_params:
      model: azure/gpt-4.1
      api_base: os.environ/AZURE_API_BASE
      api_key: os.environ/AZURE_API_KEY
      api_version: "2025-04-01-preview"
    model_info:
      supported_endpoints: ["/chat/completions", "/fine_tuning"]
```

This guide fine-tunes on Azure OpenAI. OpenAI only lets organizations that recently used a fine-tuned model create new fine-tuning jobs, and it stops new jobs for every organization on January 6, 2027 ([OpenAI deprecations](https://developers.openai.com/api/docs/deprecations)).

LiteLLM sends the name after `azure/` to Azure as the base model to fine-tune, so use a model name such as `gpt-4.1` there. Set `api_version` to `2025-04-01-preview` or later. Older versions ignore the `trainingType` that step 3 sends, so Azure falls back to Standard training, which it offers for each model only in some regions.

### 2. Create Virtual Key

```bash showLineNumbers title="create_virtual_key.sh"
curl -L -X POST 'https://{PROXY_BASE_URL}/key/generate' \
-H 'Authorization: Bearer ${PROXY_API_KEY}' \
-H 'Content-Type: application/json' \
-d '{"models": ["gpt-4.1-azure"]}'
```


You can now use the virtual key to access the finetuning models (See Developer flow).

## (Developer) Usage

Here's how to create a LiteLLM managed file and execute Finetuning CRUD operations with the file. 

### 1. Create request.jsonl 


```json showLineNumbers title="request.jsonl"
{"messages": [{"role": "system", "content": "Clippy is a factual chatbot that is also sarcastic."}, {"role": "user", "content": "What's the capital of France?"}, {"role": "assistant", "content": "Paris, as if everyone doesn't know that already."}]}
{"messages": [{"role": "system", "content": "Clippy is a factual chatbot that is also sarcastic."}, {"role": "user", "content": "Who wrote 'Romeo and Juliet'?"}, {"role": "assistant", "content": "Oh, just some guy named William Shakespeare. Ever heard of him?"}]}
```

### 2. Upload File 

Specify `target_model_names: "<model-name>"` to enable LiteLLM managed files and request validation.

model-name should be the same as the model-name in the request.jsonl

```python showLineNumbers title="create_finetuning_job.py"
from openai import OpenAI

client = OpenAI(
    base_url="http://0.0.0.0:4000",
    api_key="sk-<your-litellm-api-key>",
)

# Upload file
finetuning_input_file = client.files.create(
    file=open("./request.jsonl", "rb"),
    purpose="fine-tune",
    extra_body={"target_model_names": "gpt-4.1-azure"}
)
print(finetuning_input_file)

```


**Where is the file written?**:

All gpt-4.1-azure deployments will be written to. This enables loadbalancing across all gpt-4.1-azure deployments in Step 3, when a job is created. Once the job is created, any retrieve/list/cancel operations will be routed to that deployment.

### 3. Create the Finetuning Job

```python showLineNumbers title="create_finetuning_job.py"
... # Step 2

file_id = finetuning_input_file.id

# Create Finetuning Job
ft_job = client.fine_tuning.jobs.create(
    model="gpt-4.1-azure",  # litellm public model name you want to finetune
    training_file=file_id,
    extra_body={"trainingType": "GlobalStandard"},
)
```

Azure imports an uploaded file in the background and rejects a job whose training file is still importing with `The specified file reference must point to a completed file import.` Wait about 30 seconds after the upload before you create the job.

`GlobalStandard` trains wherever Azure has capacity and copies the training data and weights to that region. Use `Standard` instead when the data must stay in your resource's region and Azure offers Standard training for the model there.

### 4. Retrieve Finetuning Job

```python showLineNumbers title="create_finetuning_job.py"
... # Step 3

response = client.fine_tuning.jobs.retrieve(ft_job.id)
print(response)
```

### 5. List Finetuning Jobs

```python showLineNumbers title="create_finetuning_job.py"
...

client.fine_tuning.jobs.list(extra_query={"target_model_names": "gpt-4.1-azure"})
```

### 6. Cancel a Finetuning Job

```python showLineNumbers title="create_finetuning_job.py"
...

cancel_ft_job = client.fine_tuning.jobs.cancel(
    fine_tuning_job_id=ft_job.id,                          # fine tuning job id
)
```



## E2E Example

```python showLineNumbers title="create_finetuning_job.py"
import time

from openai import OpenAI

client = OpenAI(
    base_url="http://0.0.0.0:4000",
    api_key="sk-...",
    max_retries=0
)


# Upload file
finetuning_input_file = client.files.create(
    file=open("./fine_tuning.jsonl", "rb"), # {"model": "azure-gpt-4o"} <-> {"model": "gpt-4o-my-special-deployment"}
    purpose="fine-tune",
    extra_body={"target_model_names": "gpt-4.1-azure"} # Tells litellm which regions/projects to write the file in.
)
print(finetuning_input_file) # file.id = "litellm_proxy/..." = {"model_name": {"deployment_id": "deployment_file_id"}}

file_id = finetuning_input_file.id
# # file_id = "bGl0ZWxs..."

time.sleep(30) # Azure rejects the job until it finishes importing the file

# ## create fine-tuning job 
ft_job = client.fine_tuning.jobs.create(
    model="gpt-4.1-azure",  # litellm model name you want to finetune
    training_file=file_id,
    extra_body={"trainingType": "GlobalStandard"},
)

print(f"ft_job: {ft_job}")

ft_job_id = ft_job.id
## cancel fine-tuning job 
cancel_ft_job = client.fine_tuning.jobs.cancel(
    fine_tuning_job_id=ft_job_id,                          # fine tuning job id
)

print("response from cancel ft job={}".format(cancel_ft_job))
# list fine-tuning jobs 
list_ft_jobs = client.fine_tuning.jobs.list(
    extra_query={"target_model_names": "gpt-4.1-azure"}   # tell litellm proxy which provider to use
)

print("list of ft jobs={}".format(list_ft_jobs))

# get fine-tuning job 
response = client.fine_tuning.jobs.retrieve(ft_job.id)
print(response)
```

## FAQ

### Where are my files written?

When a `target_model_names` is specified, the file is written to all deployments that match the `target_model_names`.

No additional infrastructure is required.