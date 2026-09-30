import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Fireworks AI


:::info
**We support ALL Fireworks AI models, just set `fireworks_ai/` as a prefix when sending completion requests**
:::

| Property | Details |
|-------|-------|
| Description | The fastest and most efficient inference engine to build production-ready, compound AI systems. |
| Provider Route on LiteLLM | `fireworks_ai/` |
| Provider Doc | [Fireworks AI ↗](https://docs.fireworks.ai/getting-started/introduction) |
| Supported OpenAI Endpoints | `/chat/completions`, `/responses`, `/embeddings`, `/completions`, `/audio/transcriptions`, `/rerank` |


## Overview

This guide explains how to integrate LiteLLM with Fireworks AI. You can connect to Fireworks AI in three main ways:

1. <b> Using Fireworks AI serverless models </b> – Easy connection to Fireworks-managed models.
2. <b> Connecting to a model in your own Fireworks account </b> – Access models that are hosted within your Fireworks account.
3. <b> Connecting via a direct-route deployment </b> – A more flexible, customizable connection to a specific Fireworks instance.


## API Key
```python
# env variable
os.environ['FIREWORKS_AI_API_KEY']
```

## Sample Usage - Serverless Models
```python
from litellm import completion
import os

os.environ['FIREWORKS_AI_API_KEY'] = ""
response = completion(
    model="fireworks_ai/glm-5p2", 
    messages=[
       {"role": "user", "content": "hello from litellm"}
   ],
)
print(response)
```

A bare serverless slug like `glm-5p2` is expanded to `accounts/fireworks/models/glm-5p2` for you, so you can pass either the short slug or the full resource id.

## Sample Usage - Serverless Models - Streaming
```python
from litellm import completion
import os

os.environ['FIREWORKS_AI_API_KEY'] = ""
response = completion(
    model="fireworks_ai/glm-5p2", 
    messages=[
       {"role": "user", "content": "hello from litellm"}
   ],
    stream=True
)

for chunk in response:
    print(chunk)
```

## Sample Usage -  Models in Your Own Fireworks Account 
```python
from litellm import completion
import os

os.environ['FIREWORKS_AI_API_KEY'] = ""
response = completion(
    model="fireworks_ai/accounts/fireworks/models/YOUR_MODEL_ID", 
    messages=[
       {"role": "user", "content": "hello from litellm"}
   ],
)
print(response)
```

## Sample Usage - Direct-Route Deployment
```python
from litellm import completion
import os

os.environ['FIREWORKS_AI_API_KEY'] = "YOUR_DIRECT_API_KEY"
response = completion(
    model="fireworks_ai/accounts/fireworks/models/qwen2p5-coder-7b#accounts/gitlab/deployments/2fb7764c", 
    messages=[
       {"role": "user", "content": "hello from litellm"}
   ],
   api_base="https://gitlab-2fb7764c.direct.fireworks.ai/v1"
)
print(response)
```

> **Note:** The above is for the chat interface, if you want to use the text completion interface it's model="text-completion-openai/accounts/fireworks/models/qwen2p5-coder-7b#accounts/gitlab/deployments/2fb7764c"


## Sample Usage - Routers

Fireworks routers are served at `accounts/fireworks/routers/<router-id>` rather than `accounts/fireworks/models/<model-id>`, so a bare slug alone cannot tell LiteLLM which one you mean. Prefix the slug with `routers/` to target a router; LiteLLM expands `routers/<id>` to `accounts/fireworks/routers/<id>`. See the [Fireworks routers docs](https://docs.fireworks.ai/deployments/routers) for the routers available on your account.

```python
from litellm import completion
import os

os.environ['FIREWORKS_AI_API_KEY'] = ""
response = completion(
    model="fireworks_ai/routers/glm-latest",
    messages=[
       {"role": "user", "content": "hello from litellm"}
   ],
)
print(response)
```

The full resource id (`fireworks_ai/accounts/fireworks/routers/glm-latest`) is still accepted if you prefer to be explicit. Slugs ending in `-fast` (for example `fireworks_ai/glm-5p2-fast`) are treated as routers even without the `routers/` prefix.

## FireRouter and open-model routers

[FireRouter](https://docs.fireworks.ai/nexus/firerouter) is Fireworks' managed router. Instead of pointing at one model, a router ID picks a model for each user turn. Fireworks serves routers under `accounts/fireworks/routers/<id>`, and LiteLLM accepts the short ID or the full resource path:

| Router ID | What it routes across | LiteLLM model |
| - | - | - |
| `auto` | Fireworks open models, chosen by Fireworks | `fireworks_ai/auto` |
| `auto-instant` | Fireworks open models, tuned for the lowest latency | `fireworks_ai/auto-instant` |
| `firerouter` | Claude Opus or GPT, plus the Fireworks open-model mix | `fireworks_ai/firerouter` |
| `firerouter/<models>` | Only the models you list, such as `firerouter/opus` or `firerouter/kimi-k3/glm-5p3` | `fireworks_ai/firerouter/kimi-k3/glm-5p3` |
| any of the above | Same router, spelled out | `fireworks_ai/accounts/fireworks/routers/<id>` |

`auto` and `auto-instant` only use Fireworks open models, so your Fireworks API key is the only credential they need. `firerouter/auto` and `firerouter/auto-instant` behave the same way. See [Example router IDs](https://docs.fireworks.ai/nexus/firerouter#example-router-ids) for more routes

The full resource path works on every LiteLLM version. The short `firerouter` IDs need v1.104.0-rc.1 or later, and the short `auto` and `auto-instant` IDs need v1.105.0 or later. On older versions a short ID is sent as a model path and Fireworks returns a 404, so use the full path there

```yaml
model_list:
  - model_name: auto
    litellm_params:
      model: fireworks_ai/accounts/fireworks/routers/auto
      api_key: os.environ/FIREWORKS_AI_API_KEY
  - model_name: firerouter
    litellm_params:
      model: fireworks_ai/accounts/fireworks/routers/firerouter
      api_key: os.environ/FIREWORKS_AI_API_KEY
```

```bash
curl -X POST http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "auto", "messages": [{"role": "user", "content": "hello"}]}'
```

### Which model served the request

The proxy returns the `model_name` you configured, such as `auto`, in the response `model` field. On the SDK, a non-streaming `completion()` reports the served model in `response.model`, for example `fireworks_ai/glm-5p3-flash`. A streamed response keeps the requested router ID in `model` and puts the served model in `response._hidden_params["provider_response_model"]`

### Closed-model credentials

Fireworks does not resell closed models. When a `firerouter` route includes Claude or GPT, Fireworks calls that provider under your own account, using either [Provider Keys](https://docs.fireworks.ai/nexus/provider-keys) stored on your Fireworks account or an `x-anthropic-api-key` or `x-openai-api-key` header on the request. A header takes precedence over a stored Provider Key

If no credential is available for a closed model, FireRouter leaves it out and serves the turn with the other models in the route. For example, `firerouter/opus` without an Anthropic credential is served by Fireworks open models. You get `400 no_credential` instead when you send `x-routing-preference: 1`, which forces the route's closed primary, or when you call a closed model ID directly

To send the header from LiteLLM, set it on the deployment with `litellm_params.extra_headers`, or let each client send its own by enabling `forward_client_headers_to_llm_api` globally or per model group

```yaml
model_list:
  - model_name: firerouter
    litellm_params:
      model: fireworks_ai/accounts/fireworks/routers/firerouter
      api_key: os.environ/FIREWORKS_AI_API_KEY
      extra_headers:
        x-anthropic-api-key: os.environ/ANTHROPIC_API_KEY
```

```yaml
general_settings:
  forward_client_headers_to_llm_api: true
# or per model group:
# model_group_settings:
#   forward_client_headers_to_llm_api: [firerouter]
```

The same headers go through the SDK on `completion()`:

```python
from litellm import completion

response = completion(
    model="fireworks_ai/firerouter",
    messages=[{"role": "user", "content": "hello"}],
    extra_headers={"x-anthropic-api-key": "sk-ant-..."},
)
```

### Routing preference

`x-routing-preference` sets how strongly a `firerouter` request favors its primary model or cheaper models, from `1` (max intelligence) to `5` (max savings). The default is `3`. See [Routing Preferences](https://docs.fireworks.ai/nexus/routing-preferences). It travels the same way as the credential headers: `litellm_params.extra_headers` on the deployment, client-supplied when `forward_client_headers_to_llm_api` is on, or `extra_headers` on `completion()`

### Cost tracking

LiteLLM prices each request off the model Fireworks reports it routed to, so a router has no price of its own. Fireworks-hosted models are billed at Fireworks rates, and closed models (for example a Claude turn) are billed at that provider's own list price. The charges land on two vendor bills, Fireworks for open models and Anthropic or OpenAI for closed ones, but LiteLLM spend logs and budgets add both up under the one model group

## Usage with LiteLLM Proxy 

### 1. Set Fireworks AI Models on config.yaml

```yaml
model_list:
  - model_name: fireworks-glm-5p2
    litellm_params:
      model: fireworks_ai/glm-5p2
      api_key: "os.environ/FIREWORKS_AI_API_KEY"
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
      "model": "fireworks-glm-5p2",
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

# request sent to model set on litellm proxy, `litellm --model`
response = client.chat.completions.create(model="fireworks-glm-5p2", messages = [
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
    model = "fireworks-glm-5p2",
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

## Responses API

`fireworks_ai/` models on `/v1/responses` go straight to Fireworks' native `https://api.fireworks.ai/inference/v1/responses` endpoint, so server-side features such as MCP tools (`"type": "mcp"`), `previous_response_id`, and reasoning output items work the same as they do against Fireworks directly

<Tabs>
<TabItem value="sdk" label="SDK">

```python
import os
from litellm import responses

os.environ["FIREWORKS_AI_API_KEY"] = "YOUR_API_KEY"

response = responses(
    model="fireworks_ai/accounts/fireworks/models/kimi-k3",
    input="Use the deepwiki MCP server to tell me in one sentence what the BerriAI/litellm repository is.",
    tools=[
        {
            "type": "mcp",
            "server_label": "deepwiki",
            "server_url": "https://mcp.deepwiki.com/mcp",
            "require_approval": "never",
        }
    ],
)
print(response.output)
```

</TabItem>
<TabItem value="proxy" label="Proxy">

1. Setup config.yaml

```yaml
model_list:
  - model_name: fireworks-kimi-k3
    litellm_params:
      model: fireworks_ai/accounts/fireworks/models/kimi-k3
      api_key: "os.environ/FIREWORKS_AI_API_KEY"
```

2. Start proxy

```bash
litellm --config /path/to/config.yaml
```

3. Test it!

```bash
curl http://0.0.0.0:4000/v1/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_KEY" \
  -d '{
    "model": "fireworks-kimi-k3",
    "input": "Use the deepwiki MCP server to tell me in one sentence what the BerriAI/litellm repository is.",
    "tools": [
      {
        "type": "mcp",
        "server_label": "deepwiki",
        "server_url": "https://mcp.deepwiki.com/mcp",
        "require_approval": "never"
      }
    ]
  }'
```

</TabItem>
</Tabs>

Multi-turn tool calling works the same way it does against Fireworks directly: send back the `function_call_output` items together with the `previous_response_id` Fireworks returned, and Fireworks continues the conversation server-side

`developer` input items are sent to Fireworks as `system` messages, since Fireworks' Responses API has no developer role on models such as kimi-k3 and qwen3.8. A model whose chat template needs the system message first (qwen3.8) still rejects a developer item placed after the first input item, the same way it does when called directly

## Document Inlining 

LiteLLM supports document inlining for Fireworks AI models. This is useful for models that are not vision models, but still need to parse documents/images/etc.

LiteLLM will add `#transform=inline` to the url of the image_url, if the model is not a vision model.[**See Code**](https://github.com/BerriAI/litellm/blob/1ae9d45798bdaf8450f2dfdec703369f3d2212b7/litellm/llms/fireworks_ai/chat/transformation.py#L114)

<Tabs>
<TabItem value="sdk" label="SDK">

```python
from litellm import completion
import os

os.environ["FIREWORKS_AI_API_KEY"] = "YOUR_API_KEY"
os.environ["FIREWORKS_AI_API_BASE"] = "https://audio-prod.api.fireworks.ai/v1"

completion = litellm.completion(
    model="fireworks_ai/accounts/fireworks/models/llama-v3p3-70b-instruct",
    messages=[
        {
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": {
                        "url": "https://storage.googleapis.com/fireworks-public/test/sample_resume.pdf"
                    },
                },
                {
                    "type": "text",
                    "text": "What are the candidate's BA and MBA GPAs?",
                },
            ],
        }
    ],
)
print(completion)
```

</TabItem>
<TabItem value="proxy" label="PROXY">

1. Setup config.yaml

```yaml
model_list:
  - model_name: llama-v3p3-70b-instruct
    litellm_params:
      model: fireworks_ai/accounts/fireworks/models/llama-v3p3-70b-instruct
      api_key: os.environ/FIREWORKS_AI_API_KEY
    #   api_base: os.environ/FIREWORKS_AI_API_BASE [OPTIONAL], defaults to "https://api.fireworks.ai/inference/v1"
```

2. Start Proxy

```
litellm --config config.yaml
```

3. Test it

```bash
curl -L -X POST 'http://0.0.0.0:4000/chat/completions' \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer YOUR_API_KEY' \
-d '{"model": "llama-v3p3-70b-instruct", 
    "messages": [        
        {
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": {
                        "url": "https://storage.googleapis.com/fireworks-public/test/sample_resume.pdf"
                    },
                },
                {
                    "type": "text",
                    "text": "What are the candidate's BA and MBA GPAs?",
                },
            ],
        }
    ]}'
```

</TabItem>
</Tabs>

### Disable Auto-add

If you want to disable the auto-add of `#transform=inline` to the url of the image_url, set `disable_add_transform_inline_image_block` to `True`

<Tabs>
<TabItem value="sdk" label="SDK">

```python
litellm.disable_add_transform_inline_image_block = True
```

</TabItem>
<TabItem value="proxy" label="PROXY">

```yaml
litellm_settings:
    disable_add_transform_inline_image_block: true
```

</TabItem>
</Tabs>

## Reasoning Effort

The `reasoning_effort` parameter is supported on select Fireworks AI models. Supported models include:

<Tabs>
<TabItem value="sdk" label="SDK">

```python
from litellm import completion
import os

os.environ["FIREWORKS_AI_API_KEY"] = "YOUR_API_KEY"

response = completion(
    model="fireworks_ai/accounts/fireworks/models/qwen3-8b",
    messages=[
        {"role": "user", "content": "What is the capital of France?"}
    ],
    reasoning_effort="low",
)
print(response)
```

</TabItem>
<TabItem value="proxy" label="PROXY">

```bash
curl http://0.0.0.0:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_KEY" \
  -d '{
    "model": "fireworks_ai/accounts/fireworks/models/qwen3-8b",
    "messages": [
      {
        "role": "user",
        "content": "What is the capital of France?"
      }
    ],
    "reasoning_effort": "low"
  }'
```

</TabItem>
</Tabs>

## Supported Models - ALL Fireworks AI Models Supported!

:::info
We support ALL Fireworks AI models, just set `fireworks_ai/` as a prefix when sending completion requests
:::

| Model Name               | Function Call                                                                                                                                                      |
|--------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| glm-5p2 | `completion(model="fireworks_ai/glm-5p2", messages)` |
| deepseek-v4-pro | `completion(model="fireworks_ai/deepseek-v4-pro", messages)` |
| kimi-k3 | `completion(model="fireworks_ai/kimi-k3", messages)` |
| qwen3p8-max | `completion(model="fireworks_ai/qwen3p8-max", messages)` |
| minimax-m3 | `completion(model="fireworks_ai/minimax-m3", messages)` |
| gpt-oss-120b | `completion(model="fireworks_ai/gpt-oss-120b", messages)` |

The table above is a small selection of popular models. For the full, current list of models and routers, see the [Fireworks model library](https://fireworks.ai/models).

## Supported Embedding Models

:::info
We support ALL Fireworks AI models, just set `fireworks_ai/` as a prefix when sending embedding requests
:::

| Model Name            | Function Call                                                   |
|-----------------------|-----------------------------------------------------------------|
| fireworks_ai/nomic-ai/nomic-embed-text-v1.5 | `response = litellm.embedding(model="fireworks_ai/nomic-ai/nomic-embed-text-v1.5", input=input_text)` |
| fireworks_ai/nomic-ai/nomic-embed-text-v1 | `response = litellm.embedding(model="fireworks_ai/nomic-ai/nomic-embed-text-v1", input=input_text)` |
| fireworks_ai/WhereIsAI/UAE-Large-V1 | `response = litellm.embedding(model="fireworks_ai/WhereIsAI/UAE-Large-V1", input=input_text)` |
| fireworks_ai/thenlper/gte-large | `response = litellm.embedding(model="fireworks_ai/thenlper/gte-large", input=input_text)` |
| fireworks_ai/thenlper/gte-base | `response = litellm.embedding(model="fireworks_ai/thenlper/gte-base", input=input_text)` |


## Audio Transcription

### Quick Start

<Tabs>
<TabItem value="sdk" label="SDK">

```python
from litellm import transcription
import os

os.environ["FIREWORKS_AI_API_KEY"] = "YOUR_API_KEY"
os.environ["FIREWORKS_API_BASE"] = "https://audio-prod.api.fireworks.ai/v1"

audio_file = open("/path/to/audio.wav", "rb")

response = transcription(
    model="fireworks_ai/whisper-v3",
    file=audio_file,
)
```

[Pass API Key/API Base in `.transcription`](../set_keys.md#passing-args-to-completion-or-any-litellm-endpoint---transcription-embedding-text_completion-etc)

</TabItem>
<TabItem value="proxy" label="PROXY">

1. Setup config.yaml

```yaml
model_list:
  - model_name: whisper-v3
    litellm_params:
      model: fireworks_ai/whisper-v3
      api_base: https://audio-prod.api.fireworks.ai/v1
      api_key: os.environ/FIREWORKS_API_KEY
    model_info:
      mode: audio_transcription
```

2. Start Proxy

```
litellm --config config.yaml
```

3. Test it

```bash
curl -L -X POST 'http://0.0.0.0:4000/v1/audio/transcriptions' \
-H "Authorization: Bearer $LITELLM_API_KEY" \
-F 'file=@"/Users/krrishdholakia/Downloads/gettysburg.wav"' \
-F 'model="whisper-v3"' \
-F 'response_format="verbose_json"' \
```

</TabItem>
</Tabs>

## Rerank

### Quick Start

<Tabs>
<TabItem value="sdk" label="SDK">

```python
from litellm import rerank
import os

os.environ["FIREWORKS_AI_API_KEY"] = "YOUR_API_KEY"

query = "What is the capital of France?"
documents = [
    "Paris is the capital and largest city of France, home to the Eiffel Tower and the Louvre Museum.",
    "France is a country in Western Europe known for its wine, cuisine, and rich history.",
    "The weather in Europe varies significantly between northern and southern regions.",
    "Python is a popular programming language used for web development and data science.",
]

response = rerank(
    model="fireworks_ai/fireworks/qwen3-reranker-8b",
    query=query,
    documents=documents,
    top_n=3,
    return_documents=True,
)
print(response)
```

[Pass API Key/API Base in `.rerank`](../set_keys.md#passing-args-to-completion-or-any-litellm-endpoint---transcription-embedding-text_completion-etc)

</TabItem>
<TabItem value="proxy" label="PROXY">

1. Setup config.yaml

```yaml
model_list:
  - model_name: qwen3-reranker-8b
    litellm_params:
      model: fireworks_ai/fireworks/qwen3-reranker-8b
      api_key: os.environ/FIREWORKS_API_KEY
    model_info:
      mode: rerank
```

2. Start Proxy

```
litellm --config config.yaml
```

3. Test it

```bash
curl http://0.0.0.0:4000/rerank \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3-reranker-8b",
    "query": "What is the capital of France?",
    "documents": [
        "Paris is the capital and largest city of France, home to the Eiffel Tower and the Louvre Museum.",
        "France is a country in Western Europe known for its wine, cuisine, and rich history.",
        "The weather in Europe varies significantly between northern and southern regions.",
        "Python is a popular programming language used for web development and data science."
    ],
    "top_n": 3,
    "return_documents": true
  }'
```

</TabItem>
</Tabs>

### Supported Models

| Model Name | Function Call |
|------------|---------------|
| fireworks/qwen3-reranker-8b | `rerank(model="fireworks_ai/fireworks/qwen3-reranker-8b", query=query, documents=documents)` |