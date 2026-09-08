import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# CLF AI Gateway
https://clfaigateway.dev/docs

CLF AI Gateway is an OpenAI-compatible gateway that serves open-weight models. It is an independent service and is not affiliated with Cloudflare; for Cloudflare's own inference product see [Cloudflare Workers AI](./cloudflare_workers)

:::tip

LiteLLM has no dedicated `clf_ai_gateway/` provider. Because the gateway is OpenAI-compatible, route requests through it with the generic `openai/<model>` prefix and `api_base="https://api.clfaigateway.dev/v1"`. The current model list is at https://clfaigateway.dev/models and from `GET /v1/models`

:::

## API Key

Pass your gateway key as `api_key` and the gateway URL as `api_base` (or set `OPENAI_API_KEY` / `OPENAI_BASE_URL`, which the `openai/` provider reads by default).

```python
import os

os.environ["OPENAI_API_KEY"] = "sk-gw-..."
os.environ["OPENAI_BASE_URL"] = "https://api.clfaigateway.dev/v1"
```

## Sample Usage

```python
from litellm import completion

response = completion(
    model="openai/glm-5.3",
    api_base="https://api.clfaigateway.dev/v1",
    api_key="sk-gw-...",
    messages=[{"role": "user", "content": "What character was Wall-e in love with?"}],
)
print(response)
```

## Sample Usage - Streaming

```python
from litellm import completion

response = completion(
    model="openai/glm-5.3",
    api_base="https://api.clfaigateway.dev/v1",
    api_key="sk-gw-...",
    messages=[{"role": "user", "content": "What character was Wall-e in love with?"}],
    stream=True,
)

for chunk in response:
    print(chunk)
```

## Reasoning

Every model on the gateway is a reasoning model, so `reasoning_effort` is accepted on all of them. The levels each model takes differ; check the gateway's model docs for the values a model supports

```python
from litellm import completion

response = completion(
    model="openai/glm-5.3",
    api_base="https://api.clfaigateway.dev/v1",
    api_key="sk-gw-...",
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
        model: openai/glm-5.3
        api_base: https://api.clfaigateway.dev/v1
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

All of these support tool calling, JSON mode, and reasoning. Use them as `openai/<model>` with the gateway `api_base`

| Model | Context window | Vision |
| ----- | -------------- | ------ |
| glm-5.3 | 1,048,576 | no |
| glm-5.3-flash | 1,048,576 | yes |
| glm-5.2 | 262,144 | no |
| glm-4.7-flash | 131,072 | no |
| kimi-k2.7-code | 262,144 | yes |
| kimi-k2.6 | 262,144 | yes |
| deepseek-v4-pro | 1,048,576 | no |
| deepseek-v4-flash | 1,048,576 | no |
| qwen3.8-27b | 262,144 | yes |

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

The gateway caches recognized prompt prefixes automatically. Cached input tokens come back in `prompt_tokens_details.cached_tokens` and are billed at the model's cached input price. These models are not in LiteLLM's model map, so set `input_cost_per_token` / `output_cost_per_token` in `litellm_params` if you want LiteLLM cost tracking
