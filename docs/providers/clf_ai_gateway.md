import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# CLF AI Gateway
https://clfaigateway.dev/docs

CLF AI Gateway is an OpenAI-compatible gateway that serves open-weight models. It is an independent service and is not affiliated with Cloudflare; for Cloudflare's own inference product see [Cloudflare Workers AI](./cloudflare_workers)

:::tip

Set `model=clf_ai_gateway/<model>` to route a request through CLF AI Gateway. The current model list is at https://clfaigateway.dev/models and from `GET /v1/models`

:::

## API Key

```python
import os

os.environ["CLF_AI_GATEWAY_API_KEY"] = "sk-gw-..."
os.environ["CLF_AI_GATEWAY_API_BASE"] = "https://api.clfaigateway.dev/v1"  # optional, this is the default
```

`CLF_AI_GATEWAY_API_BASE` only needs to be set when you are pointing LiteLLM at a different endpoint. Leaving it unset uses `https://api.clfaigateway.dev/v1`

## Sample Usage

```python
from litellm import completion
import os

os.environ["CLF_AI_GATEWAY_API_KEY"] = "sk-gw-..."

response = completion(
    model="clf_ai_gateway/glm-5.3",
    messages=[{"role": "user", "content": "What character was Wall-e in love with?"}],
)
print(response)
```

## Sample Usage - Streaming

```python
from litellm import completion
import os

os.environ["CLF_AI_GATEWAY_API_KEY"] = "sk-gw-..."

response = completion(
    model="clf_ai_gateway/glm-5.3",
    messages=[{"role": "user", "content": "What character was Wall-e in love with?"}],
    stream=True,
)

for chunk in response:
    print(chunk)
```

## Reasoning

Every model on the gateway is a reasoning model, so `reasoning_effort` is accepted on all of them. The levels each model takes differ, and LiteLLM reads them from the model map rather than assuming a single set

```python
from litellm import completion
import os

os.environ["CLF_AI_GATEWAY_API_KEY"] = "sk-gw-..."

response = completion(
    model="clf_ai_gateway/glm-5.3",
    messages=[{"role": "user", "content": "How many r's are in strawberry?"}],
    reasoning_effort="high",
)
print(response)
```

Reasoning tokens are counted inside `completion_tokens`, so they are billed at the output price rather than separately

## Usage with LiteLLM Proxy Server

1. Add the model to your config.yaml

  ```yaml
  model_list:
    - model_name: my-model
      litellm_params:
        model: clf_ai_gateway/glm-5.3
        api_key: os.environ/CLF_AI_GATEWAY_API_KEY
  ```

2. Start the proxy

  ```bash
  $ litellm --config /path/to/config.yaml
  ```

3. Send a request

  <Tabs>

  <TabItem value="openai" label="OpenAI Python v1.0.0+">

  ```python
  import openai

  client = openai.OpenAI(
      api_key="litellm-proxy-key",
      base_url="http://0.0.0.0:4000",
  )

  response = client.chat.completions.create(
      model="my-model",
      messages=[{"role": "user", "content": "What character was Wall-e in love with?"}],
  )

  print(response)
  ```
  </TabItem>

  <TabItem value="curl" label="curl">

  ```shell
  curl --location 'http://0.0.0.0:4000/chat/completions' \
      --header 'Authorization: Bearer litellm-proxy-key' \
      --header 'Content-Type: application/json' \
      --data '{
      "model": "my-model",
      "messages": [
          {
              "role": "user",
              "content": "What character was Wall-e in love with?"
          }
      ]
  }'
  ```
  </TabItem>

  </Tabs>

## Supported Models

All of these support tool calling, JSON mode, and reasoning

| Model | Context window | Vision |
| ----- | -------------- | ------ |
| clf_ai_gateway/glm-5.3 | 1,048,576 | no |
| clf_ai_gateway/glm-5.3-flash | 1,048,576 | yes |
| clf_ai_gateway/glm-5.2 | 262,144 | no |
| clf_ai_gateway/glm-4.7-flash | 131,072 | no |
| clf_ai_gateway/kimi-k2.7-code | 262,144 | yes |
| clf_ai_gateway/kimi-k2.6 | 262,144 | yes |
| clf_ai_gateway/deepseek-v4-pro | 1,048,576 | no |
| clf_ai_gateway/deepseek-v4-flash | 1,048,576 | no |
| clf_ai_gateway/qwen3.8-27b | 262,144 | yes |

## Supported Parameters

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| frequency_penalty | number | Penalizes new tokens based on their frequency in the text |
| max_completion_tokens | integer | Maximum number of tokens to generate |
| max_tokens | integer | Maximum number of tokens to generate |
| n | integer | Number of completions to generate |
| parallel_tool_calls | boolean | Whether the model may call several tools at once |
| presence_penalty | number | Penalizes tokens based on whether they appear in the text so far |
| reasoning_effort | string | How much the model reasons before answering |
| response_format | object | Format of the response, e.g. `{"type": "json_object"}` |
| seed | integer | Sampling seed for deterministic results |
| stop | string/array | Sequences where the API stops generating tokens |
| stream | boolean | Whether to stream the response |
| stream_options | object | Options for streaming, e.g. `{"include_usage": true}` |
| temperature | number | Controls randomness |
| tool_choice | string/object | Controls which tool, if any, the model calls |
| tools | array | List of tools the model can use |
| top_p | number | Controls nucleus sampling |
| user | string | User identifier |

## Prompt Caching

The gateway caches recognized prompt prefixes automatically. Cached input tokens come back in `prompt_tokens_details.cached_tokens` and are billed at the model's cached input price, which LiteLLM reads from the model map for cost tracking
