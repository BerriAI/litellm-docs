import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Fireworks AI


:::info
**We support ALL Fireworks AI models, just set `fireworks_ai/` as a prefix when sending completion requests**
:::

:::tip
New to running Fireworks AI behind LiteLLM? [Getting Started with Fireworks AI on LiteLLM](/blog/fireworks-getting-started) goes from an empty directory to a working request, then adds a second model and a fallback.
:::

| Property | Details |
|-------|-------|
| Description | The fastest and most efficient inference engine to build production-ready, compound AI systems. |
| Provider Route on LiteLLM | `fireworks_ai/` |
| Provider Doc | [Fireworks AI ↗](https://docs.fireworks.ai/getting-started/introduction) |
| Supported OpenAI Endpoints | `/chat/completions`, `/responses`, `/embeddings`, `/completions`, `/audio/transcriptions`, `/rerank`, `/files` and `/batches` ([run by LiteLLM](./fireworks_ai_batches)) |


## Overview

This guide walks you through how to integrate LiteLLM with Fireworks AI. There are three primary ways in which you can connect to Fireworks AI:

1. <b> Using Fireworks AI serverless models </b> – Easy integration with Fireworks managed models.
2. <b> Connecting to a model in your own Fireworks account </b> – access models that are hosted in your own Fireworks account.
3. <b> Connecting via a direct-route deployment </b> – a more flexible, customisable connection to a particular Fireworks instance.


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
    model="fireworks_ai/glm-5p3-flash", 
    messages=[
       {"role": "user", "content": "hello from litellm"}
   ],
)
print(response)
```

A bare serverless slug (`glm-5p3-flash`) is expanded out to `accounts/fireworks/models/glm-5p3-flash` for you so you can pass either the short slug or the full resource id.

## Sample Usage - Serverless Models - Streaming
```python
from litellm import completion
import os

os.environ['FIREWORKS_AI_API_KEY'] = ""
response = completion(
    model="fireworks_ai/glm-5p3-flash", 
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
    model="fireworks_ai/accounts/fireworks/models/deepseek-v4p1-flash#accounts/gitlab/deployments/2fb7764c", 
    messages=[
       {"role": "user", "content": "hello from litellm"}
   ],
   api_base="https://gitlab-2fb7764c.direct.fireworks.ai/v1"
)
print(response)
```

> **Note:** That's for the chat interface. If you want to use the text completion interface it's model="text-completion-openai/accounts/fireworks/models/deepseek-v4p1-flash#accounts/gitlab/deployments/2fb7764c"


## Sample Usage - Routers

Fireworks routers are served at `accounts/fireworks/routers/<router-id>` rather than `accounts/fireworks/models/<model-id>`. A bare slug won't tell LiteLLM whether you're after a router or a model. Prefix the slug with `routers/` to indicate you want a router (LiteLLM will then expand `routers/<id>` to `accounts/fireworks/routers/<id>`). See the [Fireworks routers docs](https://docs.fireworks.ai/deployments/routers) for the routers available on your account.

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

The full resource id (`fireworks_ai/accounts/fireworks/routers/glm-latest`) is still valid if you want to be explicit. Slugs ending in `-fast` (e.g. `fireworks_ai/glm-5p3-fast`) are treated as routers even in the absence of the `routers/` prefix.

## FireRouter and open-model routers

[FireRouter](https://docs.fireworks.ai/nexus/firerouter) is Fireworks' managed router. Rather than having a single model pointed at, a router ID will pick a model for each user turn. Fireworks serves routers under `accounts/fireworks/routers/<id>` and LiteLLM will accept either the short ID or the full resource path:

| Router ID | What it routes across | LiteLLM model |
| - | - | - |
| `auto` | Fireworks open models, chosen by Fireworks | `fireworks_ai/auto` |
| `auto-instant` | Fireworks open models, tuned for the lowest latency | `fireworks_ai/auto-instant` |
| `firerouter` | Claude Opus or GPT, plus the Fireworks open-model mix | `fireworks_ai/firerouter` |
| `firerouter/<models>` | Only the models you list, such as `firerouter/opus` or `firerouter/kimi-k3/glm-5p3` | `fireworks_ai/firerouter/kimi-k3/glm-5p3` |
| any of the above | Same router, spelled out | `fireworks_ai/accounts/fireworks/routers/<id>` |

`auto` and `auto-instant` only make use of the Fireworks open models so your Fireworks API key is the only credential they require. `firerouter/auto` and `firerouter/auto-instant` are the same. See [Example router IDs](https://docs.fireworks.ai/nexus/firerouter#example-router-ids) for more routes.

The full resource path works on all LiteLLM versions. The short `firerouter` IDs work <SinceVersion v="1.104.0" /> (first in `v1.104.0-rc.1`) and the short `auto` and `auto-instant` IDs work <SinceVersion v="1.105.0" />. On the older versions a short ID is sent as a model path and Fireworks returns a 404, so you have to use the full path in those cases.

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

The proxy will return the `model_name` you configured (e.g. `auto`) in the `model` field of the response. On the SDK a non-streaming `completion()` will report the served model in the `response.model` field (e.g. `fireworks_ai/glm-5p3-flash`). A streamed response will retain the requested router ID in `model` and put the served model in `response._hidden_params["provider_response_model"]`.

### Closed-model credentials

Fireworks don't resell closed models. If a `firerouter` route has Claude or GPT in it then Fireworks will call that provider under your own account, either using an [Provider Keys](https://docs.fireworks.ai/nexus/provider-keys) stored on your Fireworks account or an `x-anthropic-api-key` or `x-openai-api-key` header on the request. A header takes precedence over a stored Provider Key.

If there's no credential available for a closed model then FireRouter just omits that model and serves the turn with the other models in the route. So if for example Fireworks open models are being used they serve `firerouter/opus` in the absence of an Anthropic credential. `x-routing-preference: 1` will force the route's closed primary model. If there's no credential available then that request will get `400 no_credential`. A direct call to a closed model ID with no credential will get the same error.

To send the header via LiteLLM you can either set it on the deployment (`litellm_params.extra_headers`) or have each client send their own by enabling `forward_client_headers_to_llm_api` globally or per model group.

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

`x-routing-preference` sets how strongly a `firerouter` request favors its primary model or the cheaper models (from `1`- max intelligence to `5`- max savings). The default is `3`. See [Routing Preferences](https://docs.fireworks.ai/nexus/routing-preferences). It travels the same route as the credential headers (`litellm_params.extra_headers` on the deployment, client supplied when `forward_client_headers_to_llm_api` is on, or `extra_headers` on `completion()`).

### Cost tracking

LiteLLM prices each request off the model that Fireworks reports it was routed to. So the router itself has no price. Fireworks hosted models are charged at Fireworks rates and closed models (e.g. a Claude turn) are charged at that provider's own list price. The charges go on two vendor bills (Fireworks for the open models and Anthropic or OpenAI for the closed ones) but the LiteLLM spend logs and budgets simply total them all up under the one model group.

## Usage with LiteLLM Proxy 

### 1. Set Fireworks AI Models on config.yaml

```yaml
model_list:
  - model_name: fireworks-glm-5p3
    litellm_params:
      model: fireworks_ai/glm-5p3-flash
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
      "model": "fireworks-glm-5p3",
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
response = client.chat.completions.create(model="fireworks-glm-5p3", messages = [
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
    model = "fireworks-glm-5p3",
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

## Decisions (System One)

Fireworks has its decision model `accounts/fireworks/routers/rune` running on `https://api.fireworks.ai/inference/v1/systemone`. It's in private preview so you'll need to ask your Fireworks account team to enable it (the model name they give you may be different). LiteLLM exposes it on both [`/v1/systemone` and `/v1/decisions`](../decisions.md): the System One route just passes through the `state` and `questions` body as is, and the OpenAI format route is translated into the equivalent request. The model takes text only and is charged on input tokens (with a lower rate for `cached_input_tokens` which LiteLLM will record as cached tokens for cost purposes).

<Tabs>
<TabItem value="sdk" label="SDK">

```python
import os
from litellm import systemone

os.environ["FIREWORKS_AI_API_KEY"] = "YOUR_API_KEY"

response = systemone(
    model="fireworks_ai/accounts/fireworks/routers/rune",
    state={"tool_name": "Bash", "tool_input": "rm -rf ./build", "user_request": "clean the build dir"},
    questions={
        "allowed": {"type": "noul", "instructions": "Is this tool call safe to run without asking the user?"},
        "risk": {"type": "score", "instructions": "How risky is this tool call?", "criteria": ["none", "low", "medium", "high"]},
    },
)
print(response.answers)
```

</TabItem>
<TabItem value="proxy" label="PROXY">

```yaml
model_list:
  - model_name: rune
    litellm_params:
      model: fireworks_ai/accounts/fireworks/routers/rune
      api_key: os.environ/FIREWORKS_AI_API_KEY
```

```bash
curl http://0.0.0.0:4000/v1/systemone \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "rune",
    "state": {"tool_name": "Bash", "tool_input": "rm -rf ./build", "user_request": "clean the build dir"},
    "questions": {
      "allowed": {"type": "noul", "instructions": "Is this tool call safe to run without asking the user?"}
    }
  }'
```

The same deployment answers OpenAI-format requests on `/v1/decisions`:

```bash
curl http://0.0.0.0:4000/v1/decisions \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "rune",
    "input": "Customer wrote: the package arrived late and damaged, I want my money back.",
    "questions": [
      {"type": "predicate", "name": "refund", "instructions": "Does the customer ask for a refund?"},
      {"type": "choice", "name": "tone", "instructions": "What is the tone?", "choices": [{"value": "angry"}, {"value": "neutral"}, {"value": "positive"}]}
    ]
  }'
```

</TabItem>
</Tabs>

## Responses API

The `fireworks_ai/` models on `/v1/responses` go straight to Fireworks' native `https://api.fireworks.ai/inference/v1/responses` endpoint so server side features such as the MCP tools (`"type": "mcp"`), `previous_response_id` and reasoning output items work exactly the same as they do when you're talking to Fireworks directly.

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

Multi-turn tool calling works exactly the same way as it does when calling into Fireworks directly. You send back the `function_call_output` items with `previous_response_id` set to the id of the last Fireworks response and Fireworks then continues the conversation on the server side.

`developer` input items are not passed on to Fireworks as messages as Fireworks' Responses API has no developer role on models such as kimi-k3 and qwen3.8. LiteLLM simply takes the `instructions` and folds it into the top level `instructions` field. It also takes the leading `system` and `developer` items and all subsequent text `developer` items and folds them into that `instructions` field. So a model that has the system message first in its chat template (qwen3.8) won't reject a developer item that comes after the first input item. A deployment that has `supports_mid_conversation_system: true` in its own `model_info` will have each `developer` item become an `system` item in its place. The same request via the chat completions bridge (`use_chat_completions_api: true`) will follow the [developer role](../completion/developer_role.md) rules which only move a later `developer` message for a model that has `supports_mid_conversation_system: false`.

## Document Inlining 

LiteLLM supports document inlining for Fireworks AI models. That's useful for models which aren't vision models per se but still want to be able to parse documents/images/etc.

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

## User and Session Attribution

Fireworks can tell who the developers are behind a shared Fireworks API key when LiteLLM sends two IDs on each request.

| Identifier | LiteLLM source | Sent to Fireworks as |
|---|---|---|
| User id | `user_id` of the virtual key that made the request | `user` field in the request body |
| Session id | `x-litellm-session-id` header, `litellm_session_id`, or `metadata.session_id` | `x-session-affinity` header |

### Session id

`fireworks_ai/` deployments send the session id as `x-session-affinity` on `/v1/chat/completions` (streaming included), `/v1/responses` and `/v1/messages` so every request in a session gets to the same Fireworks replica and reuses its prompt cache. No config is required.

```bash
curl http://0.0.0.0:4000/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_KEY" \
  -H "x-litellm-session-id: my-session-1" \
  -H "Content-Type: application/json" \
  -d '{"model": "fireworks-glm-5p2", "messages": [{"role": "user", "content": "hi"}]}'
```

LiteLLM doesn't send an `x-session-affinity` header if the request has no session id. It also won't send the `x-session-affinity` header if the proxy is the one that created the session id as a result of an `general_settings.missing_session_id`. If a client is sending its own `x-session-affinity` header then it will retain that value. For a Fireworks model behind the `openai/` prefix you'll want to set `provider_affinity_header: x-session-affinity` in that deployment's `litellm_params`.

### User id

Set `fireworks_forward_user_id: true` on a deployment to send the LiteLLM user id into Fireworks as the `user` field. It's off by default as user ids are typically email addresses.

```yaml
model_list:
  - model_name: fireworks-glm-5p2
    litellm_params:
      model: fireworks_ai/glm-5p2
      api_key: "os.environ/FIREWORKS_AI_API_KEY"
      fireworks_forward_user_id: true
```

To turn it on from the Admin UI: go to the Models page, open the model (**Edit Settings**), then add `"fireworks_forward_user_id": true` to **LiteLLM Params**.

Applies to `/v1/chat/completions` (streaming included), `/v1/responses` and `/v1/messages` on `fireworks_ai/` deployments. The value is the `user_id` of the virtual key so two developers sharing one Fireworks API key will appear as two users and requests made with the master key will send the proxy admin id (`default_user_id`). Fireworks will echo back the `user` in the `/v1/responses` response so the developer will see their own user id there.

The LiteLLM user id replaces whatever `user` the client sent (and `metadata.user_id` on `/v1/messages`) as well as the key hash that `litellm_settings.overwrite_user_with_key_hash` would have sent. A request that attempts to set `fireworks_forward_user_id` itself is rejected and so developers can't change their own attribution. If the key has no `user_id` then LiteLLM just leaves the request alone and the client supplied `user` is still passed through. To prevent such keys from choosing their own `user` you also need to set `litellm_settings.overwrite_user_with_key_hash: true`. That setting will send the key hash for those keys. Keys with an `user_id` will still send the user id.

## Supported Models - ALL Fireworks AI Models supported!

:::info
We support ALL Fireworks AI models, just set `fireworks_ai/` as a prefix when sending completion requests
:::

| Model Name               | Function Call                                                                                                                                                      |
|--------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| glm-5p3-flash | `completion(model="fireworks_ai/glm-5p3-flash", messages)` |
| deepseek-v4-pro | `completion(model="fireworks_ai/deepseek-v4-pro", messages)` |
| kimi-k3 | `completion(model="fireworks_ai/kimi-k3", messages)` |
| qwen3p8-max | `completion(model="fireworks_ai/qwen3p8-max", messages)` |
| minimax-m3 | `completion(model="fireworks_ai/minimax-m3", messages)` |
| gpt-oss-120b | `completion(model="fireworks_ai/gpt-oss-120b", messages)` |

The table above is a small selection of the popular models. For the full current list of models and routers see the [Fireworks model library](https://fireworks.ai/models).

## Latest model aliases

<SinceVersion v="1.109.0" />

`fireworks_ai/<family>-latest` names are part of a model family as LiteLLM moves them to the newer models. Your app will therefore continue to have one model name. You use them exactly as you would any other Fireworks AI model name. LiteLLM will pass Fireworks AI the current target model and will bill at that model's rate. See [Latest model aliases](../model_latest_aliases.md) for details on how aliases work and the full list across providers.

| Alias | Model family |
| --- | --- |
| `fireworks_ai/kimi-latest` | Kimi |
| `fireworks_ai/minimax-latest` | MiniMax |

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