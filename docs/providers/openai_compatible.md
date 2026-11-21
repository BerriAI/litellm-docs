---
title: "OpenAI-Compatible Endpoints with LiteLLM"
sidebar_label: "OpenAI-Compatible Endpoints"
description: "Call any OpenAI-compatible endpoint via LiteLLM with the openai/ prefix and your api_base, from the Python SDK or AI Gateway, for completion and embedding."
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# OpenAI-Compatible Endpoints

:::info

Selecting `openai` as the provider routes your request to an OpenAI-compatible endpoint using the upstream  
[official OpenAI Python API library](https://github.com/openai/openai-python/blob/main/README.md).

This library **requires** an API key for all requests, either through the `api_key` parameter 
or the `OPENAI_API_KEY` environment variable.

If you don't want to provide a fake API key in each request, consider using a provider that directly matches your 
OpenAI-compatible endpoint, such as [`hosted_vllm`](/docs/providers/vllm) or [`llamafile`](/docs/providers/llamafile).

:::

To call models hosted behind an openai proxy, make 2 changes:

1. For `/chat/completions`: Put `openai/` in front of your model name, so litellm knows you're trying to call an openai `/chat/completions` endpoint. 

1. For `/completions`: Put `text-completion-openai/` in front of your model name, so litellm knows you're trying to call an openai `/completions` endpoint. [NOT REQUIRED for `openai/` endpoints called via `/v1/completions` route].

1. **Do NOT** add anything additional to the base url e.g. `/v1/embedding`. LiteLLM uses the openai-client to make these calls, and that automatically adds the relevant endpoints. 


## External provider definitions

:::note Unreleased

The `--providers` option and `PROVIDERS_FILE_PATH` environment variable depend on [LiteLLM PR #50623](https://github.com/BerriAI/litellm/pull/50623). They are not available in a stable release yet.

:::

`litellm --providers /path/to/providers.json` loads external OpenAI-compatible provider definitions at startup. Set `PROVIDERS_FILE_PATH` to the same path when the flag is omitted. An explicit `--providers` path takes precedence over the environment variable. The file uses the bundled `providers.json` shape. Entries extend the bundled registry, and an entry with an existing provider slug replaces that definition. A missing or invalid file stops startup.

An external entry needs a `base_url` and an `api_key_env` name. Requests use their explicit `api_key` or the secret named by `api_key_env`. If neither is set, the request fails before it reaches the provider. An external entry does not inherit an unrelated `OPENAI_API_KEY`.

## Usage - completion
```python
import litellm
import os

response = litellm.completion(
    model="openai/mistral",               # add `openai/` prefix to model so litellm knows to route to OpenAI
    api_key="sk-<your-litellm-api-key>",                  # api key to your openai compatible endpoint
    api_base="http://0.0.0.0:4000",     # set API Base of your Custom OpenAI Endpoint
    messages=[
                {
                    "role": "user",
                    "content": "Hey, how's it going?",
                }
    ],
)
print(response)
```

## Usage - embedding

```python
import litellm
import os

response = litellm.embedding(
    model="openai/GPT-J",               # add `openai/` prefix to model so litellm knows to route to OpenAI
    api_key="sk-<your-litellm-api-key>",                  # api key to your openai compatible endpoint
    api_base="http://0.0.0.0:4000",     # set API Base of your Custom OpenAI Endpoint
    input=["good morning from litellm"]
)
print(response)
```



## Usage with LiteLLM Proxy Server

Here's how to call an OpenAI-Compatible Endpoint with the LiteLLM Proxy Server

1. Modify the config.yaml 

  ```yaml
  model_list:
    - model_name: my-model
      litellm_params:
        model: openai/<your-model-name>  # add openai/ prefix to route as OpenAI provider
        api_base: <model-api-base>       # add api base for OpenAI compatible provider
        api_key: api-key                 # api key to send your model
  ```

  :::info

  If you see `Not Found Error` when testing make sure your `api_base` has the `/v1` postfix

  Example: `http://vllm-endpoint.xyz/v1`

  :::

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
      api_key="sk-<your-litellm-api-key>",             # pass litellm proxy key, if you're using virtual keys
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
      --header "Authorization: Bearer $LITELLM_API_KEY" \
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


### Calling `/v1/messages` (Anthropic format)

LiteLLM routes `/v1/messages` requests for `openai/` models through the OpenAI Responses API, so the proxy calls `/responses` on your `api_base`. If your endpoint only serves `/chat/completions`, the request fails with the endpoint's error for that route, usually a 404 or a 400, while `/chat/completions` requests to the same model keep working.

To send `/v1/messages` requests through `/chat/completions` instead, turn on `use_chat_completions_url_for_anthropic_messages`.

```yaml
model_list:
  - model_name: my-model
    litellm_params:
      model: openai/<your-model-name>
      api_base: <model-api-base>
      api_key: api-key

litellm_settings:
  use_chat_completions_url_for_anthropic_messages: true
```

You can also set the env var `LITELLM_USE_CHAT_COMPLETIONS_URL_FOR_ANTHROPIC_MESSAGES=true`. The setting applies to the whole proxy, so `/v1/messages` requests for models hosted by OpenAI itself also go through `/chat/completions` once it is on. See the [`/v1/messages` to `/responses` parameter mapping](../anthropic_unified/messages_to_responses_mapping.md) for how the default route translates a request.

### Advanced - Disable System Messages

Some VLLM models (e.g. gemma) don't support system messages. To map those requests to 'user' messages, use the `supports_system_message` flag. 

```yaml
model_list:
- model_name: my-custom-model
  litellm_params:
      model: openai/google/gemma
      api_base: http://my-custom-base
      api_key: "" 
      supports_system_message: False # KEY CHANGE
```
