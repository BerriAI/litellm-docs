import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Nvidia NIM
https://docs.api.nvidia.com/nim/reference/

:::tip

**We support ALL Nvidia NIM models, just set `model=nvidia_nim/<any-model-on-nvidia_nim>` as a prefix when sending litellm requests**

:::

| Property | Details |
|-------|-------|
| Description | Nvidia NIM is a platform that provides a simple API for deploying and using AI models. LiteLLM supports all models from [Nvidia NIM](https://developer.nvidia.com/nim/) |
| Provider Route on LiteLLM | `nvidia_nim/` |
| Provider Doc | [Nvidia NIM Docs ↗](https://developer.nvidia.com/nim/) |
| API Endpoint for Provider | https://integrate.api.nvidia.com/v1/ (chat/embeddings), https://ai.api.nvidia.com/v1/ (rerank) |
| Supported OpenAI Endpoints | `/chat/completions`, `/completions`, `/responses`, `/embeddings`, `/rerank` |

## API Key
```python
# env variable
os.environ['NVIDIA_NIM_API_KEY'] = ""
os.environ['NVIDIA_NIM_API_BASE'] = "" # [OPTIONAL] - default is https://integrate.api.nvidia.com/v1/
```

## Sample Usage
```python
from litellm import completion
import os

os.environ['NVIDIA_NIM_API_KEY'] = ""
response = completion(
    model="nvidia_nim/nvidia/nemotron-3-super-120b-a12b",
    messages=[
        {
            "role": "user",
            "content": "What's the weather like in Boston today in Fahrenheit?",
        }
    ],
    temperature=1.0,        # optional
    top_p=0.95,             # optional
    frequency_penalty=0.1,  # optional
    presence_penalty=0.1,   # optional
    max_tokens=4096,        # optional
)
print(response)
```

## Sample Usage - Streaming
```python
from litellm import completion
import os

os.environ['NVIDIA_NIM_API_KEY'] = ""
response = completion(
    model="nvidia_nim/nvidia/nemotron-3-super-120b-a12b",
    messages=[
        {
            "role": "user",
            "content": "What's the weather like in Boston today in Fahrenheit?",
        }
    ],
    stream=True,
    temperature=1.0,        # optional
    top_p=0.95,             # optional
    frequency_penalty=0.1,  # optional
    presence_penalty=0.1,   # optional
    max_tokens=4096,        # optional
)

for chunk in response:
    print(chunk)
```


## Usage - embedding

```python
import litellm
import os

response = litellm.embedding(
    model="nvidia_nim/nvidia/nv-embedqa-e5-v5",               # add `nvidia_nim/` prefix to model so litellm knows to route to Nvidia NIM
    input=["good morning from litellm"],
    encoding_format = "float", 
    user_id = "user-1234",

    # Nvidia NIM Specific Parameters
    input_type = "passage", # Optional
    truncate = "NONE" # Optional
)
print(response)
```


## **Usage - LiteLLM Proxy Server**

Here's how to call an Nvidia NIM Endpoint with the LiteLLM Proxy Server

1. Modify the config.yaml 

  ```yaml
  model_list:
    - model_name: my-model
      litellm_params:
        model: nvidia_nim/<your-model-name>  # add nvidia_nim/ prefix to route as Nvidia NIM provider
        api_key: api-key                 # api key to send your model
       # api_base: "" # [OPTIONAL] - default is https://integrate.api.nvidia.com/v1/
  ```


2. Start the proxy 

  ```bash
  $ litellm --config /path/to/config.yaml
  ```

3. Send Request to LiteLLM Proxy Server

  <Tabs>

  <TabItem value="openai" label="OpenAI Python v1.0.0+">

  ```python
  import openai
  client = openai.OpenAI(
      api_key="sk-1234",             # pass litellm proxy key, if you're using virtual keys
      base_url="http://0.0.0.0:4000" # litellm-proxy-base url
  )

  response = client.chat.completions.create(
      model="my-model",
      messages = [
          {
              "role": "user",
              "content": "what llm are you"
          }
      ],
  )

  print(response)
  ```
  </TabItem>

  <TabItem value="curl" label="curl">

  ```shell
  curl --location 'http://0.0.0.0:4000/chat/completions' \
      --header 'Authorization: Bearer sk-1234' \
      --header 'Content-Type: application/json' \
      --data '{
      "model": "my-model",
      "messages": [
          {
          "role": "user",
          "content": "what llm are you"
          }
      ],
  }'
  ```
  </TabItem>

  </Tabs>



## Supported Models

Use `nvidia_nim/<model-id>` with a chat model available on your NVIDIA endpoint. These are representative models from the [NVIDIA model catalog](https://build.nvidia.com/models):

| Model | LiteLLM model ID |
|-------|------------------|
| Nemotron 3 Super | `nvidia_nim/nvidia/nemotron-3-super-120b-a12b` |
| Nemotron 3.5 Lightning | `nvidia_nim/nvidia/nemotron-3.5-lightning-30b-a3b` |
