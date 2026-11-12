import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Nebius Token Factory
https://docs.tokenfactory.nebius.com/

:::tip

**LiteLLM supports all models on Nebius Token Factory, previously called Nebius AI Studio. To use a model, set `model=nebius/<model-id>` as a prefix for litellm requests. Model IDs change as models launch and retire. `GET https://api.tokenfactory.nebius.com/v1/models` returns the IDs your API key can call. The [model catalog](https://tokenfactory.nebius.com/models/catalog) lists every model on the platform, including ones this API does not serve.**

:::

## API Key and Base URL
```python
import os

os.environ["NEBIUS_API_KEY"] = ""  # your Token Factory API key
os.environ["NEBIUS_API_BASE"] = "https://api.tokenfactory.nebius.com/v1"
```

Always set `NEBIUS_API_BASE`, or pass `api_base`, so requests go to Token Factory. LiteLLM v1.109.1 does not use this URL by default yet.

## Sample Usage: Text Generation
```python
from litellm import completion
import os

os.environ["NEBIUS_API_KEY"] = ""
os.environ["NEBIUS_API_BASE"] = "https://api.tokenfactory.nebius.com/v1"

response = completion(
    model="nebius/Qwen/Qwen3-30B-A3B-Instruct-2507",
    messages=[
        {
            "role": "user",
            "content": "What character was Wall-e in love with?",
        }
    ],
    max_tokens=100,
    seed=123,
    temperature=0.6,
)
print(response.choices[0].message.content)
```

## Sample Usage - Streaming
```python
from litellm import completion
import os

os.environ["NEBIUS_API_KEY"] = ""
os.environ["NEBIUS_API_BASE"] = "https://api.tokenfactory.nebius.com/v1"

response = completion(
    model="nebius/Qwen/Qwen3-30B-A3B-Instruct-2507",
    messages=[
        {
            "role": "user",
            "content": "What character was Wall-e in love with?",
        }
    ],
    stream=True,
    max_tokens=100,
)

for chunk in response:
    print(chunk.choices[0].delta.content or "", end="")
```

## Sample Usage - Tool Calling
```python
from litellm import completion
import os

os.environ["NEBIUS_API_KEY"] = ""
os.environ["NEBIUS_API_BASE"] = "https://api.tokenfactory.nebius.com/v1"

tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get the current weather for a city",
            "parameters": {
                "type": "object",
                "properties": {"city": {"type": "string"}},
                "required": ["city"],
            },
        },
    }
]

response = completion(
    model="nebius/Qwen/Qwen3-30B-A3B-Instruct-2507",
    messages=[{"role": "user", "content": "What is the weather in Amsterdam?"}],
    tools=tools,
    tool_choice="auto",
    max_tokens=200,
)
print(response.choices[0].message.tool_calls)
```

## Sample Usage - Embedding
```python
from litellm import embedding
import os

os.environ["NEBIUS_API_KEY"] = ""
os.environ["NEBIUS_API_BASE"] = "https://api.tokenfactory.nebius.com/v1"

response = embedding(
    model="nebius/Qwen/Qwen3-Embedding-8B",
    input=["What character was Wall-e in love with?"],
)
print(len(response.data[0]["embedding"]))
```


## Usage with LiteLLM Proxy Server

Here's how to call a Nebius Token Factory model with the LiteLLM Proxy Server

1. Modify the config.yaml 

  ```yaml
  model_list:
    - model_name: my-model
      litellm_params:
        model: nebius/<your-model-id>                     # add nebius/ prefix to use Nebius Token Factory as provider
        api_key: os.environ/NEBIUS_API_KEY                # read the api key from the environment
        api_base: https://api.tokenfactory.nebius.com/v1  # Token Factory endpoint

  general_settings:
    master_key: os.environ/LITELLM_MASTER_KEY
  ```
2. Start the proxy with `NEBIUS_API_KEY` and `LITELLM_MASTER_KEY` set. The proxy does not start without a master key.
  ```bash
  $ litellm --config /path/to/config.yaml
  ```

3. Send Request to LiteLLM Proxy Server

  <Tabs>

  <TabItem value="openai" label="OpenAI Python v1.0.0+">

  ```python
  import os
  import openai
  client = openai.OpenAI(
      api_key=os.environ["LITELLM_MASTER_KEY"], # litellm proxy key
      base_url="http://0.0.0.0:4000" # litellm-proxy-base url
  )

  response = client.chat.completions.create(
      model="my-model",
      messages = [
          {
              "role": "user",
              "content": "What character was Wall-e in love with?"
          }
      ],
      max_tokens=100,
  )

  print(response)
  ```
  </TabItem>

  <TabItem value="curl" label="curl">

  ```shell
  curl --location 'http://0.0.0.0:4000/chat/completions' \
      --header "Authorization: Bearer $LITELLM_MASTER_KEY" \
      --header 'Content-Type: application/json' \
      --data '{
      "model": "my-model",
      "messages": [
          {
          "role": "user",
          "content": "What character was Wall-e in love with?"
          }
      ],
      "max_tokens": 100
  }'
  ```
  </TabItem>

  </Tabs>

## Supported Parameters

The Nebius provider supports the following parameters:

### Chat Completion Parameters

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| frequency_penalty | number | Penalizes new tokens based on their frequency in the text |
| function_call | string/object | Controls how the model calls functions |
| functions | array | List of functions for which the model may generate JSON inputs |
| logit_bias | map | Modifies the likelihood of specified tokens |
| max_tokens | integer | Maximum number of tokens to generate |
| n | integer | Number of completions to generate |
| presence_penalty | number | Penalizes tokens based on if they appear in the text so far |
| response_format | object | Format of the response, e.g., `{"type": "json"}` |
| seed | integer | Sampling seed for deterministic results |
| stop | string/array | Sequences where the API will stop generating tokens |
| stream | boolean | Whether to stream the response |
| temperature | number | Controls randomness (0-2) |
| top_p | number | Controls nucleus sampling |
| tool_choice | string/object | Controls which (if any) function to call |
| tools | array | List of tools the model can use |
| user | string | User identifier |

### Embedding Parameters

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| input | string/array | Text to embed |
| user | string | User identifier |

## Error Handling

The integration uses the standard LiteLLM error handling. Common errors include:

- **Authentication Error**: Check your API key
- **Model Not Found**: Ensure you're using a valid model name
- **Rate Limit Error**: You've exceeded your rate limits
- **Timeout Error**: Request took too long to complete
