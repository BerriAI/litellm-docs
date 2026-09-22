import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Mistral AI API
https://docs.mistral.ai/api/

## API Key
```python
# env variable
os.environ['MISTRAL_API_KEY']
```

## Sample Usage
```python
from litellm import completion
import os

os.environ['MISTRAL_API_KEY'] = ""
response = completion(
    model="mistral/mistral-tiny", 
    messages=[
       {"role": "user", "content": "hello from litellm"}
   ],
)
print(response)
```

## Sample Usage - Streaming
```python
from litellm import completion
import os

os.environ['MISTRAL_API_KEY'] = ""
response = completion(
    model="mistral/mistral-tiny", 
    messages=[
       {"role": "user", "content": "hello from litellm"}
   ],
    stream=True
)

for chunk in response:
    print(chunk)
```



## Usage with LiteLLM Proxy 

### 1. Set Mistral Models on config.yaml

```yaml
model_list:
  - model_name: mistral-small-latest
    litellm_params:
      model: mistral/mistral-small-latest
      api_key: "os.environ/MISTRAL_API_KEY" # ensure you have `MISTRAL_API_KEY` in your .env
```

### 2. Start Proxy 

```
litellm --config config.yaml
```

### 3. Test it


<Tabs>
<TabItem value="Curl" label="Curl Request">

```shell
curl --location 'http://0.0.0.0:4000/chat/completions' \
--header 'Content-Type: application/json' \
--data ' {
      "model": "mistral-small-latest",
      "messages": [
        {
          "role": "user",
          "content": "what llm are you"
        }
      ]
    }
'
```
</TabItem>
<TabItem value="openai" label="OpenAI v1.0.0+">

```python
import openai
client = openai.OpenAI(
    api_key="anything",
    base_url="http://0.0.0.0:4000"
)

response = client.chat.completions.create(model="mistral-small-latest", messages = [
    {
        "role": "user",
        "content": "this is a test request, write a short poem"
    }
])

print(response)

```
</TabItem>
<TabItem value="langchain" label="Langchain">

```python
from langchain.chat_models import ChatOpenAI
from langchain.prompts.chat import (
    ChatPromptTemplate,
    HumanMessagePromptTemplate,
    SystemMessagePromptTemplate,
)
from langchain.schema import HumanMessage, SystemMessage

chat = ChatOpenAI(
    openai_api_base="http://0.0.0.0:4000", # set openai_api_base to the LiteLLM Proxy
    model = "mistral-small-latest",
    temperature=0.1
)

messages = [
    SystemMessage(
        content="You are a helpful assistant that im using to make a test request to."
    ),
    HumanMessage(
        content="test from litellm. tell me why it's amazing in 1 sentence"
    ),
]
response = chat(messages)

print(response)
```
</TabItem>
</Tabs>

## Supported Models

:::info
All models listed here https://docs.mistral.ai/platform/endpoints are supported. We actively maintain the list of models, pricing, token window, etc. [here](https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json).

:::


| Model Name     | Function Call                                                | Reasoning Support |
|----------------|--------------------------------------------------------------|-------------------|
| Mistral Small  | `completion(model="mistral/mistral-small-latest", messages)` | No |
| Mistral Medium | `completion(model="mistral/mistral-medium-latest", messages)`| No |
| Mistral Large 2  | `completion(model="mistral/mistral-large-2407", messages)` | No |
| Mistral Large Latest  | `completion(model="mistral/mistral-large-latest", messages)` | No |
| **Magistral Small**  | `completion(model="mistral/magistral-small-2506", messages)` | Yes |
| **Magistral Medium** | `completion(model="mistral/magistral-medium-2506", messages)`| Yes |
| Mistral 7B     | `completion(model="mistral/open-mistral-7b", messages)`      | No |
| Mixtral 8x7B   | `completion(model="mistral/open-mixtral-8x7b", messages)`    | No |
| Mixtral 8x22B  | `completion(model="mistral/open-mixtral-8x22b", messages)`   | No |
| Codestral      | `completion(model="mistral/codestral-latest", messages)`     | No |
| Mistral NeMo      | `completion(model="mistral/open-mistral-nemo", messages)`     | No |
| Mistral NeMo 2407      | `completion(model="mistral/open-mistral-nemo-2407", messages)`     | No |
| Codestral Mamba      | `completion(model="mistral/open-codestral-mamba", messages)`     | No |
| Codestral Mamba    | `completion(model="mistral/codestral-mamba-latest"", messages)`     | No |

## Function Calling 

```python
from litellm import completion

# set env
os.environ["MISTRAL_API_KEY"] = "your-api-key"

tools = [
    {
        "type": "function",
        "function": {
            "name": "get_current_weather",
            "description": "Get the current weather in a given location",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "The city and state, e.g. San Francisco, CA",
                    },
                    "unit": {"type": "string", "enum": ["celsius", "fahrenheit"]},
                },
                "required": ["location"],
            },
        },
    }
]
messages = [{"role": "user", "content": "What's the weather like in Boston today?"}]

response = completion(
    model="mistral/mistral-large-latest",
    messages=messages,
    tools=tools,
    tool_choice="auto",
)
# Add any assertions, here to check response args
print(response)
assert isinstance(response.choices[0].message.tool_calls[0].function.name, str)
assert isinstance(
    response.choices[0].message.tool_calls[0].function.arguments, str
)
```

## Reasoning

Mistral does not directly support reasoning, instead it recommends a specific [system prompt](https://docs.mistral.ai/capabilities/reasoning/) to use with their magistral models. By setting the `reasoning_effort` parameter, LiteLLM will prepend the system prompt to the request. 

If an existing system message is provided, LiteLLM will send both as a list of system messages (you can verify this by enabling `litellm._turn_on_debug()`).

### Supported Models

| Model Name     | Function Call                                                |
|----------------|--------------------------------------------------------------|
| Magistral Small  | `completion(model="mistral/magistral-small-2506", messages)` |
| Magistral Medium | `completion(model="mistral/magistral-medium-2506", messages)`|

### Using Reasoning Effort

The `reasoning_effort` parameter controls how much effort the model puts into reasoning. When used with magistral models.

```python
from litellm import completion
import os

os.environ['MISTRAL_API_KEY'] = "your-api-key"

response = completion(
    model="mistral/magistral-medium-2506",
    messages=[
        {"role": "user", "content": "What is 15 multiplied by 7?"}
    ],
    reasoning_effort="medium"  # Options: "low", "medium", "high"
)

print(response)
```

### Example with System Message

If you already have a system message, LiteLLM will prepend the reasoning instructions:

```python
response = completion(
    model="mistral/magistral-medium-2506",
    messages=[
        {"role": "system", "content": "You are a helpful math tutor."},
        {"role": "user", "content": "Explain how to solve quadratic equations."}
    ],
    reasoning_effort="high"
)

# The system message becomes:
# "When solving problems, think step-by-step in <think> tags before providing your final answer...
#  
#  You are a helpful math tutor."
```

### Usage with LiteLLM Proxy

You can also use reasoning capabilities through the LiteLLM proxy:

<Tabs>
<TabItem value="Curl" label="Curl Request">

```shell
curl --location 'http://0.0.0.0:4000/chat/completions' \
--header 'Content-Type: application/json' \
--data '{
      "model": "magistral-medium-2506",
      "messages": [
        {
          "role": "user",
          "content": "What is the square root of 144? Show your reasoning."
        }
      ],
      "reasoning_effort": "medium"
    }'
```
</TabItem>
<TabItem value="openai" label="OpenAI v1.0.0+">

```python
import openai
client = openai.OpenAI(
    api_key="anything",
    base_url="http://0.0.0.0:4000"
)

response = client.chat.completions.create(
    model="magistral-medium-2506", 
    messages=[
        {
            "role": "user",
            "content": "Calculate the area of a circle with radius 5. Show your work."
        }
    ],
    reasoning_effort="high"
)

print(response)
```
</TabItem>
</Tabs>

### Important Notes

- **Model Compatibility**: Reasoning parameters only work with magistral models
- **Backward Compatibility**: Non-magistral models will ignore reasoning parameters and work normally

## Audio Transcription

Use Mistral's Voxtral models for audio transcription via `litellm.transcription()`.

### SDK Usage

```python
from litellm import transcription
import os

os.environ["MISTRAL_API_KEY"] = ""

audio_file = open("path/to/audio.wav", "rb")

response = transcription(
    model="mistral/voxtral-mini-latest",
    file=audio_file,
)

print(response.text)
```

### With Optional Parameters

```python
response = transcription(
    model="mistral/voxtral-mini-latest",
    file=audio_file,
    language="en",
    temperature=0.0,
    response_format="json",
)
```

### Mistral-Specific Parameters

Mistral supports additional parameters beyond the OpenAI-compatible ones:

| Parameter | Type | Description |
|-----------|------|-------------|
| `diarize` | `bool` | Enable speaker diarization |

```python
response = transcription(
    model="mistral/voxtral-mini-latest",
    file=audio_file,
    diarize=True,
)
```

### Usage with LiteLLM Proxy

```yaml
model_list:
  - model_name: voxtral
    litellm_params:
      model: mistral/voxtral-mini-latest
      api_key: os.environ/MISTRAL_API_KEY
    model_info:
      mode: audio_transcription
```

```bash
litellm --config /path/to/config.yaml
```

```bash
curl --location 'http://0.0.0.0:4000/v1/audio/transcriptions' \
--header "Authorization: Bearer $LITELLM_API_KEY" \
--form 'file=@"audio.wav"' \
--form 'model="voxtral"'
```

## Files and Batches API

LiteLLM routes the OpenAI-compatible `/v1/files` and `/v1/batches` endpoints to Mistral's [Files](https://docs.mistral.ai/api/#tag/files) and [Batch](https://docs.mistral.ai/api/#tag/batch) APIs. A Mistral batch job runs one model for every line of the input file, so the model is picked once, on the file upload or the batch request, instead of per line. The job can target `/v1/chat/completions` or `/v1/ocr`, and OCR pages inside a batch are billed at Mistral's batch rate.

| Feature | Supported |
|---------|-----------|
| Upload, retrieve, list, delete files | ✅ |
| Download file content | ✅ |
| Create and retrieve batches | ✅ |
| List and cancel batches | Not yet |
| Cost tracking for batch OCR | ✅ per page, see [Batch OCR cost tracking](#batch-ocr-cost-tracking) |

### 1. Add a Mistral model to config.yaml

```yaml
model_list:
  - model_name: mistral-ocr
    litellm_params:
      model: mistral/mistral-ocr-latest
      api_key: os.environ/MISTRAL_API_KEY
```

### 2. Upload the batch input file

Each line is an OpenAI batch request. For OCR the `url` is `/v1/ocr` and the `body` is a Mistral OCR request:

```json
{"custom_id": "doc-0", "method": "POST", "url": "/v1/ocr", "body": {"document": {"type": "document_url", "document_url": "https://arxiv.org/pdf/2201.04234"}}}
{"custom_id": "doc-1", "method": "POST", "url": "/v1/ocr", "body": {"document": {"type": "document_url", "document_url": "https://arxiv.org/pdf/2201.04234"}}}
```

Pass `model` with the upload so LiteLLM sends the file with that deployment's credentials and encodes the model into the returned file id. Every later call that carries the id reuses it.

```bash
curl http://0.0.0.0:4000/v1/files \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -F purpose="batch" \
  -F model="mistral-ocr" \
  -F file="@ocr_batch_input.jsonl"
```

Mistral accepts the `batch`, `fine-tune`, and `ocr` purposes. LiteLLM maps `user_data` onto `ocr`, and any other purpose (`assistants`, `vision`, `evals`) is rejected with a 400 because Mistral has no equivalent.

### 3. Create the batch

`endpoint` is `/v1/ocr` for OCR jobs or `/v1/chat/completions` for chat jobs. The `model` is read from the encoded file id, so sending it again is optional.

```bash
curl http://0.0.0.0:4000/v1/batches \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "input_file_id": "file-bGl0ZWxsbTo1YTJm...",
    "endpoint": "/v1/ocr",
    "completion_window": "24h",
    "model": "mistral-ocr"
  }'
```

Mistral has no `completion_window`; the value is accepted and echoed back as `24h`.

### 4. Poll the batch and download the output

```bash
curl http://0.0.0.0:4000/v1/batches/batch_bGl0ZWxsbTo1YzU4... \
  -H "Authorization: Bearer $LITELLM_API_KEY"
```

Mistral's job statuses map onto the OpenAI ones: `QUEUED` -> `validating`, `RUNNING` -> `in_progress`, `SUCCESS` -> `completed`, `FAILED` -> `failed`, `TIMEOUT_EXCEEDED` -> `expired`, `CANCELLATION_REQUESTED` -> `cancelling`, `CANCELLED` -> `cancelled`. Once the status is `completed`, download `output_file_id`:

```bash
curl http://0.0.0.0:4000/v1/files/file-bGl0ZWxsbToyNjE0.../content \
  -H "Authorization: Bearer $LITELLM_API_KEY"
```

Each output line carries the OCR response under `response.body`, including `usage_info.pages_processed`.

### Listing files

A file id that LiteLLM encoded carries its own routing, but a plain list has no id to route on, so name the provider on the request:

```bash
curl "http://0.0.0.0:4000/v1/files?provider=mistral&purpose=batch" \
  -H "Authorization: Bearer $LITELLM_API_KEY"
```

OCR files read back with `purpose=user_data`, and files created by other Mistral products with a purpose the upload endpoint does not accept (`playground`, `audio`, and similar) also read back as `user_data`, so an unfiltered list never fails on them.

### Batch OCR cost tracking

When a batch that targets `/v1/ocr` completes, LiteLLM reads `usage_info.pages_processed` and `usage_info.pages_processed_annotation` from every line of the output file and bills each page at the model's batch rate. The rates come from the [model cost map](https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json):

| Key | Used for |
|-----|----------|
| `ocr_cost_per_page_batches` | OCR pages inside a batch |
| `annotation_cost_per_page_batches` | Annotation pages inside a batch |
| `ocr_cost_per_page` | Synchronous `/v1/ocr` calls, and the fallback when no batch rate is set |
| `annotation_cost_per_page` | Synchronous annotation pages, and the fallback when no batch rate is set |

The batch rates for `mistral/mistral-ocr-latest` are half the synchronous per-page rates, matching Mistral's 50% batch discount. To bill at a different rate, set the keys on the deployment's `model_info`, which wins over the cost map for that deployment:

```yaml
model_list:
  - model_name: mistral-ocr
    litellm_params:
      model: mistral/mistral-ocr-latest
      api_key: os.environ/MISTRAL_API_KEY
    model_info:
      ocr_cost_per_page_batches: 0.002
      annotation_cost_per_page_batches: 0.0025
```

The spend is recorded the first time a completed batch is retrieved, on the key that created it, under the batch id with a `_batch_cost` suffix, and shows up on the `/spend/logs` routes and the Admin UI Logs page.

## Sample Usage - Embedding
```python
from litellm import embedding
import os

os.environ['MISTRAL_API_KEY'] = ""
response = embedding(
    model="mistral/mistral-embed",
    input=["good morning from litellm"],
)
print(response)
```


## Supported Models
All models listed here https://docs.mistral.ai/platform/endpoints are supported

| Model Name               | Function Call                                                                                                                                                      |
|--------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Mistral Embeddings | `embedding(model="mistral/mistral-embed", input)` | 


