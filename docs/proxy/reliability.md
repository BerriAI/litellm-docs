---
title: "Fallbacks (Provider Failover)"
description: "Set up automatic provider failover in LiteLLM. If a model or provider fails after num_retries, fallback to another model group for high availability and reliability."
keywords:
  [
    fallbacks,
    failover,
    provider failover,
    model failover,
    automatic failover,
    high availability,
    reliability,
    retries,
    backup model,
    cross-provider failover,
  ]
---

import Image from '@theme/IdealImage';
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Fallbacks (Provider Failover)

Fallbacks are how LiteLLM does automatic **failover**. If a call fails after num_retries, LiteLLM falls back to another model group, so a failing model or provider automatically fails over to a healthy backup. If you are looking for "provider failover" or "model failover", this is the page. 

- Quick Start [load balancing](./load_balancing.md)
- Quick Start [client side fallbacks](#client-side-fallbacks)


Fallbacks are typically done from one `model_name` to another `model_name`. 

## Quick Start 

### 1. Setup fallbacks

Key change: 

```python
fallbacks=[{"gpt-3.5-turbo": ["gpt-4"]}]
```

<Tabs>
<TabItem value="sdk" label="SDK">

```python
from litellm import Router 
router = Router(
  model_list=[
    {
      "model_name": "gpt-3.5-turbo",
      "litellm_params": {
        "model": "azure/<your-deployment-name>",
        "api_base": "<your-azure-endpoint>",
        "api_key": "<your-azure-api-key>",
        "rpm": 6
      }
    },
    {
      "model_name": "gpt-4",
      "litellm_params": {
        "model": "azure/gpt-4-ca",
        "api_base": "https://my-endpoint-canada-berri992.openai.azure.com/",
        "api_key": "<your-azure-api-key>",
        "rpm": 6
      }
    }
  ],
  fallbacks=[{"gpt-3.5-turbo": ["gpt-4"]}] # 👈 KEY CHANGE
)

```

</TabItem>
<TabItem value="proxy" label="PROXY">


```yaml
model_list:
  - model_name: gpt-3.5-turbo
    litellm_params:
      model: azure/<your-deployment-name>
      api_base: <your-azure-endpoint>
      api_key: <your-azure-api-key>
      rpm: 6      # Rate limit for this deployment: in requests per minute (rpm)
  - model_name: gpt-4
    litellm_params:
      model: azure/gpt-4-ca
      api_base: https://my-endpoint-canada-berri992.openai.azure.com/
      api_key: <your-azure-api-key>
      rpm: 6

router_settings:
  fallbacks: [{"gpt-3.5-turbo": ["gpt-4"]}]
```


</TabItem>
</Tabs>


### 2. Start Proxy

```bash
litellm --config /path/to/config.yaml
```

### 3. Test Fallbacks

:::warning Requires an explicit opt-in on the Proxy
On the Proxy, the mock testing request params are rejected with a `400` unless an admin opts in. This covers `mock_testing_fallbacks`, `mock_testing_context_fallbacks`, `mock_testing_content_policy_fallbacks`, `mock_testing_rate_limit_error`, `mock_timeout`, and `mock_delay`.

Direct `litellm.Router` calls are unaffected and need no opt-in.
:::

For direct `Router` tests, pass `mock_testing_fallbacks=True` to trigger fallbacks.

<Tabs>
<TabItem value="sdk" label="SDK">


```python

from litellm import Router

model_list = [{..}, {..}] # defined in Step 1.

router = Router(model_list=model_list, fallbacks=[{"bad-model": ["my-good-model"]}])

response = router.completion(
  model="bad-model",
  messages=[{"role": "user", "content": "Hey, how's it going?"}],
  mock_testing_fallbacks=True,
)
```

</TabItem>
<TabItem value="proxy" label="PROXY">

Enable the mock testing params in `general_settings`:

```yaml
general_settings:
  dangerously_allow_mock_testing_request_params: true
```

Then pass `mock_testing_fallbacks` on the request:

```bash
curl -X POST 'http://0.0.0.0:4000/v1/chat/completions' \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer sk-1234' \
-d '{
  "model": "gpt-3.5-turbo",
  "messages": [{"role": "user", "content": "ping"}],
  "mock_testing_fallbacks": true
}'
```

The response is served by the fallback deployment, and the `x-litellm-attempted-fallbacks` response header reports how many fallbacks were attempted.

:::danger Read before enabling in production
While this setting is on, **any** caller with a valid key on the Proxy can inject synthetic failures and latency into their own requests. Such a request consumes a connection and a concurrency slot without reaching a provider, and returns an error the caller chose.

It is intended for staging, and for controlled failover drills in production. Turn it off when the drill is finished.

The setting is read from `config.yaml` only. It cannot be changed from the Admin UI or the `/config/update` API.
:::

If you would rather not enable it at all, trigger an actual provider error in a non-production environment and send a normal request instead.

</TabItem>
</Tabs>




### Explanation

Fallbacks are done in-order - ["gpt-3.5-turbo, "gpt-4", "gpt-4-32k"], will do 'gpt-3.5-turbo' first, then 'gpt-4', etc.

You can also set [`default_fallbacks`](#default-fallbacks), in case a specific model group is misconfigured / bad.

There are 3 types of fallbacks: 
- `content_policy_fallbacks`: For litellm.ContentPolicyViolationError - LiteLLM maps content policy violation errors across providers [**See Code**](https://github.com/BerriAI/litellm/blob/89a43c872a1e3084519fb9de159bf52f5447c6c4/litellm/utils.py#L8495C27-L8495C54)
- `context_window_fallbacks`: For litellm.ContextWindowExceededErrors - LiteLLM maps context window error messages across providers [**See Code**](https://github.com/BerriAI/litellm/blob/89a43c872a1e3084519fb9de159bf52f5447c6c4/litellm/utils.py#L8469)
- `fallbacks`: For all remaining errors - e.g. litellm.RateLimitError


## Client Side Fallbacks

Set fallbacks in the `.completion()` call for SDK and client-side for proxy. 

In this request the following will occur:
1. The request to `model="zephyr-beta"` will fail
2. litellm proxy will loop through all the model_groups specified in `fallbacks=["gpt-3.5-turbo"]`
3. The request to `model="gpt-3.5-turbo"` will succeed and the client making the request will get a response from gpt-3.5-turbo 

👉 Key Change: `"fallbacks": ["gpt-3.5-turbo"]`

<Tabs>
<TabItem value="sdk" label="SDK">

```python
from litellm import Router

router = Router(model_list=[..]) # defined in Step 1.

resp = router.completion(
    model="gpt-3.5-turbo",
    messages=[{"role": "user", "content": "Hey, how's it going?"}],
    mock_testing_fallbacks=True, # 👈 trigger fallbacks
    fallbacks=[
        {
            "model": "claude-3-haiku",
            "messages": [{"role": "user", "content": "What is LiteLLM?"}],
        }
    ],
)

print(resp)
```

</TabItem>
<TabItem value="proxy" label="PROXY">

<Tabs>
<TabItem value="openai" label="OpenAI Python v1.0.0+">

```python
import openai
client = openai.OpenAI(
    api_key="anything",
    base_url="http://0.0.0.0:4000"
)

response = client.chat.completions.create(
    model="zephyr-beta",
    messages = [
        {
            "role": "user",
            "content": "this is a test request, write a short poem"
        }
    ],
    extra_body={
        "fallbacks": ["gpt-3.5-turbo"]
    }
)

print(response)
```
</TabItem>

<TabItem value="Curl" label="Curl Request">

```shell
curl --location 'http://0.0.0.0:4000/chat/completions' \
    --header 'Content-Type: application/json' \
    --data '{
    "model": "zephyr-beta"",
    "messages": [
        {
        "role": "user",
        "content": "what llm are you"
        }
    ],
    "fallbacks": ["gpt-3.5-turbo"]
}'
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
import os 

os.environ["OPENAI_API_KEY"] = "anything"

chat = ChatOpenAI(
    openai_api_base="http://0.0.0.0:4000",
    model="zephyr-beta",
    extra_body={
        "fallbacks": ["gpt-3.5-turbo"]
    }
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
</TabItem>

</Tabs>

### Control Fallback Prompts  

Pass in messages/temperature/etc. per model in fallback (works for embedding/image generation/etc. as well).

Key Change:

```
fallbacks = [
  {
    "model": <model_name>,
    "messages": <model-specific-messages>
    ... # any other model-specific parameters
  }
]
```

<Tabs>
<TabItem value="sdk" label="SDK">

```python
from litellm import Router

router = Router(model_list=[..]) # defined in Step 1.

resp = router.completion(
    model="gpt-3.5-turbo",
    messages=[{"role": "user", "content": "Hey, how's it going?"}],
    mock_testing_fallbacks=True, # 👈 trigger fallbacks
    fallbacks=[
        {
            "model": "claude-3-haiku",
            "messages": [{"role": "user", "content": "What is LiteLLM?"}],
        }
    ],
)

print(resp)
```

</TabItem>
<TabItem value="proxy" label="PROXY">

<Tabs>
<TabItem value="openai" label="OpenAI Python v1.0.0+">

```python
import openai
client = openai.OpenAI(
    api_key="anything",
    base_url="http://0.0.0.0:4000"
)

response = client.chat.completions.create(
    model="zephyr-beta",
    messages = [
        {
            "role": "user",
            "content": "this is a test request, write a short poem"
        }
    ],
    extra_body={
      "fallbacks": [{
          "model": "claude-3-haiku",
          "messages": [{"role": "user", "content": "What is LiteLLM?"}]
      }]
    }
)

print(response)
```
</TabItem>

<TabItem value="Curl" label="Curl Request">

```bash
curl -L -X POST 'http://0.0.0.0:4000/v1/chat/completions' \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer sk-1234' \
-d '{
    "model": "gpt-3.5-turbo",
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "text",
            "text": "Hi, how are you ?"
          }
        ]
      }
    ],
    "fallbacks": [{
        "model": "claude-3-haiku",
        "messages": [{"role": "user", "content": "What is LiteLLM?"}]
    }]
}'
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
import os 

os.environ["OPENAI_API_KEY"] = "anything"

chat = ChatOpenAI(
    openai_api_base="http://0.0.0.0:4000",
    model="zephyr-beta",
    extra_body={
      "fallbacks": [{
          "model": "claude-3-haiku",
          "messages": [{"role": "user", "content": "What is LiteLLM?"}]
      }]
    }
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

</TabItem>
</Tabs>

## Content Policy Violation Fallback

Key change: 

```python
content_policy_fallbacks=[{"claude-2": ["my-fallback-model"]}]
```

<Tabs>
<TabItem value="sdk" label="SDK">

```python
from litellm import Router 

router = Router(
  model_list=[
    {
      "model_name": "claude-2",
      "litellm_params": {
        "model": "claude-2",
        "api_key": "",
        "mock_response": Exception("content filtering policy"),
      },
    },
    {
      "model_name": "my-fallback-model",
      "litellm_params": {
        "model": "claude-2",
        "api_key": "",
        "mock_response": "This works!",
      },
    },
  ],
  content_policy_fallbacks=[{"claude-2": ["my-fallback-model"]}], # 👈 KEY CHANGE
  # fallbacks=[..], # [OPTIONAL]
  # context_window_fallbacks=[..], # [OPTIONAL]
)

response = router.completion(
  model="claude-2",
  messages=[{"role": "user", "content": "Hey, how's it going?"}],
)
```
</TabItem>
<TabItem value="proxy" label="PROXY">

In your proxy config.yaml just add this line 👇

```yaml
router_settings:
  content_policy_fallbacks=[{"claude-2": ["my-fallback-model"]}]
```

Start proxy 

```bash
litellm --config /path/to/config.yaml

# RUNNING on http://0.0.0.0:4000
```

</TabItem>
</Tabs>

## Context Window Exceeded Fallback

Key change: 

```python
context_window_fallbacks=[{"claude-2": ["my-fallback-model"]}]
```

<Tabs>
<TabItem value="sdk" label="SDK">

```python
from litellm import Router 

router = Router(
  model_list=[
    {
      "model_name": "claude-2",
      "litellm_params": {
        "model": "claude-2",
        "api_key": "",
        "mock_response": Exception("prompt is too long"),
      },
    },
    {
      "model_name": "my-fallback-model",
      "litellm_params": {
        "model": "claude-2",
        "api_key": "",
        "mock_response": "This works!",
      },
    },
  ],
  context_window_fallbacks=[{"claude-2": ["my-fallback-model"]}], # 👈 KEY CHANGE
  # fallbacks=[..], # [OPTIONAL]
  # content_policy_fallbacks=[..], # [OPTIONAL]
)

response = router.completion(
  model="claude-2",
  messages=[{"role": "user", "content": "Hey, how's it going?"}],
)
```
</TabItem>
<TabItem value="proxy" label="PROXY">

In your proxy config.yaml just add this line 👇

```yaml
router_settings:
  context_window_fallbacks=[{"claude-2": ["my-fallback-model"]}]
```

Start proxy 

```bash
litellm --config /path/to/config.yaml

# RUNNING on http://0.0.0.0:4000
```

</TabItem>
</Tabs>

## Advanced
### Fallbacks + Retries + Timeouts + Cooldowns

To set fallbacks, just do: 

```
litellm_settings:
  fallbacks: [{"zephyr-beta": ["gpt-3.5-turbo"]}] 
```

**Covers all errors (429, 500, etc.)**

**Set via config**
```yaml
model_list:
  - model_name: zephyr-beta
    litellm_params:
        model: huggingface/HuggingFaceH4/zephyr-7b-beta
        api_base: http://0.0.0.0:8001
  - model_name: zephyr-beta
    litellm_params:
        model: huggingface/HuggingFaceH4/zephyr-7b-beta
        api_base: http://0.0.0.0:8002
  - model_name: zephyr-beta
    litellm_params:
        model: huggingface/HuggingFaceH4/zephyr-7b-beta
        api_base: http://0.0.0.0:8003
  - model_name: gpt-3.5-turbo
    litellm_params:
        model: gpt-3.5-turbo
        api_key: <my-openai-key>
  - model_name: gpt-3.5-turbo-16k
    litellm_params:
        model: gpt-3.5-turbo-16k
        api_key: <my-openai-key>

litellm_settings:
  num_retries: 3 # retry call 3 times on each model_name (e.g. zephyr-beta)
  request_timeout: 10 # raise Timeout error if call takes longer than 10s. Sets litellm.request_timeout 
  fallbacks: [{"zephyr-beta": ["gpt-3.5-turbo"]}] # fallback to gpt-3.5-turbo if call fails num_retries 
  allowed_fails: 3 # cooldown model if it fails > 1 call in a minute. 
  cooldown_time: 30 # how long to cooldown model if fails/min > allowed_fails
```

### Fallback to Specific Model ID

If all models in a group are in cooldown (e.g. rate limited), LiteLLM will fallback to the model with the specific model ID.

This skips any cooldown check for the fallback model.

1. Specify the model ID in `model_info`
```yaml
model_list:
  - model_name: gpt-4
    litellm_params:
      model: openai/gpt-4
    model_info:
      id: my-specific-model-id # 👈 KEY CHANGE
  - model_name: gpt-4
    litellm_params:
      model: azure/chatgpt-v-2
      api_base: os.environ/AZURE_API_BASE
      api_key: os.environ/AZURE_API_KEY
  - model_name: anthropic-claude
    litellm_params:
      model: anthropic/claude-3-opus-20240229
      api_key: os.environ/ANTHROPIC_API_KEY
```

**Note:** This will only fallback to the model with the specific model ID. If you want to fallback to another model group, you can set `fallbacks=[{"gpt-4": ["anthropic-claude"]}]`

2. Set fallbacks in config

```yaml
litellm_settings:
  fallbacks: [{"gpt-4": ["my-specific-model-id"]}]
```

3. Test it while the primary deployment is unavailable.

```bash
curl -X POST 'http://0.0.0.0:4000/chat/completions' \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer sk-1234' \
-d '{
  "model": "gpt-4",
  "messages": [
    {
      "role": "user",
      "content": "ping"
    }
  ]
}'
```

Validate it works, by checking the response header `x-litellm-model-id`

```bash
x-litellm-model-id: my-specific-model-id
```

### Test Fallbacks! 

Check if your fallbacks are working as expected by triggering the relevant provider error in a non-production environment.

#### **Regular Fallbacks**

Make the primary test deployment return a retryable provider error, such as a rate-limit or server error, then send a normal request.


#### **Content Policy Fallbacks**

Use a test request that the primary provider rejects with a content-policy error.

#### **Context Window Fallbacks**

Enable pre-call checks and send a test request that exceeds the primary model's configured context window.


### Track Fallbacks in Spend Logs

Every spend log row records whether the request was served by the model group the client asked for, or by a fallback. The proxy writes two keys into the `metadata` column of `LiteLLM_SpendLogs`:

| Key | Type | Description |
|-----|------|-------------|
| `attempted_fallbacks` | int | Number of fallback attempts made. `0` means the requested model group served the request |
| `original_model_group` | str | The model group the client originally requested |

For example, a request to `gpt-3.5-turbo` that fails over to `claude-fable-5` produces a row with `model_group=claude-fable-5`, `attempted_fallbacks=1`, and `original_model_group=gpt-3.5-turbo`, so fallback-served and directly-served requests stay distinguishable after the fact:

```sql
SELECT model_group,
       metadata->>'attempted_fallbacks' AS attempted_fallbacks,
       metadata->>'original_model_group' AS original_model_group
FROM "LiteLLM_SpendLogs";
```

Both keys are set by the proxy and overwrite any client-supplied values of the same name. Rows written before this feature read `null` for both keys.

### Context Window Fallbacks (Pre-Call Checks + Fallbacks)

**Before call is made** check if a call is within model context window with  **`enable_pre_call_checks: true`**.

[**See Code**](https://github.com/BerriAI/litellm/blob/c9e6b05cfb20dfb17272218e2555d6b496c47f6f/litellm/router.py#L2163)

:::important
**`enable_pre_call_checks` is required** for context-window enforcement. Without it, requests are sent to the provider regardless of input token count. Set `enable_pre_call_checks: true` in `router_settings` in your config.
:::

#### Custom max_input_tokens per deployment

You can override the default context limit for a deployment by setting `max_input_tokens` in `model_info`. This is useful for testing, rate-limiting long prompts, or enforcing stricter limits than the provider's default.

**Both** of the following are required:

1. **`router_settings.enable_pre_call_checks: true`** — enables pre-call checks
2. **`model_info.max_input_tokens`** on the deployment, which overrides the limit for that model

```yaml
router_settings:
  enable_pre_call_checks: true  # Required for enforcement

model_list:
  - model_name: gpt-4o
    litellm_params:
      model: openai/gpt-4o
      api_key: os.environ/OPENAI_API_KEY
    model_info:
      max_input_tokens: 10  # Override: reject prompts > 10 tokens
```

If a request exceeds the limit, LiteLLM raises `ContextWindowExceededError` with details like `Model=gpt-4o, Max Input Tokens=10, Got=306`.

**1. Setup config**

For azure deployments, set the base model. Pick the base model from [this list](https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json), all the azure models start with azure/.


<Tabs>
<TabItem value="same-group" label="Same Group">

Filter older instances of a model (e.g. gpt-3.5-turbo) with smaller context windows

```yaml
router_settings:
  enable_pre_call_checks: true # 1. Enable pre-call checks

model_list:
  - model_name: gpt-3.5-turbo
    litellm_params:
    model: azure/chatgpt-v-2
    api_base: os.environ/AZURE_API_BASE
    api_key: os.environ/AZURE_API_KEY
    api_version: "2023-07-01-preview"
    model_info:
    base_model: azure/gpt-4-1106-preview # 2. 👈 (azure-only) SET BASE MODEL

  - model_name: gpt-3.5-turbo
    litellm_params:
    model: gpt-3.5-turbo-1106
    api_key: os.environ/OPENAI_API_KEY
```

**2. Start proxy**

```bash
litellm --config /path/to/config.yaml

# RUNNING on http://0.0.0.0:4000
```

**3. Test it!**

```python
import openai
client = openai.OpenAI(
    api_key="anything",
    base_url="http://0.0.0.0:4000"
)

text = "What is the meaning of 42?" * 5000

# request sent to model set on litellm proxy, `litellm --model`
response = client.chat.completions.create(
    model="gpt-3.5-turbo",
    messages = [
      {"role": "system", "content": text},
      {"role": "user", "content": "Who was Alexander?"},
    ],
)

print(response)
```

</TabItem>

<TabItem value="different-group" label="Context Window Fallbacks (Different Groups)">

Fallback to larger models if current model is too small.

```yaml
router_settings:
  enable_pre_call_checks: true # 1. Enable pre-call checks

model_list:
  - model_name: gpt-3.5-turbo-small
    litellm_params:
    model: azure/chatgpt-v-2
      api_base: os.environ/AZURE_API_BASE
      api_key: os.environ/AZURE_API_KEY
      api_version: "2023-07-01-preview"
      model_info:
      base_model: azure/gpt-4-1106-preview # 2. 👈 (azure-only) SET BASE MODEL

  - model_name: gpt-3.5-turbo-large
    litellm_params:
      model: gpt-3.5-turbo-1106
      api_key: os.environ/OPENAI_API_KEY

  - model_name: claude-opus
    litellm_params:
      model: claude-3-opus-20240229
      api_key: os.environ/ANTHROPIC_API_KEY

litellm_settings:
  context_window_fallbacks: [{"gpt-3.5-turbo-small": ["gpt-3.5-turbo-large", "claude-opus"]}]
```

**2. Start proxy**

```bash
litellm --config /path/to/config.yaml

# RUNNING on http://0.0.0.0:4000
```

**3. Test it!**

```python
import openai
client = openai.OpenAI(
    api_key="anything",
    base_url="http://0.0.0.0:4000"
)

text = "What is the meaning of 42?" * 5000

# request sent to model set on litellm proxy, `litellm --model`
response = client.chat.completions.create(
    model="gpt-3.5-turbo",
    messages = [
      {"role": "system", "content": text},
      {"role": "user", "content": "Who was Alexander?"},
    ],
)

print(response)
```

</TabItem>
</Tabs>


### Content Policy Fallbacks

Fallback across providers (e.g. from Azure OpenAI to Anthropic) if you hit content policy violation errors. 

```yaml
model_list:
  - model_name: gpt-3.5-turbo-small
    litellm_params:
    model: azure/chatgpt-v-2
        api_base: os.environ/AZURE_API_BASE
        api_key: os.environ/AZURE_API_KEY
        api_version: "2023-07-01-preview"

    - model_name: claude-opus
      litellm_params:
        model: claude-3-opus-20240229
        api_key: os.environ/ANTHROPIC_API_KEY

litellm_settings:
  content_policy_fallbacks: [{"gpt-3.5-turbo-small": ["claude-opus"]}]
```



### Default Fallbacks 

You can also set default_fallbacks, in case a specific model group is misconfigured / bad.


```yaml
model_list:
  - model_name: gpt-3.5-turbo-small
    litellm_params:
    model: azure/chatgpt-v-2
        api_base: os.environ/AZURE_API_BASE
        api_key: os.environ/AZURE_API_KEY
        api_version: "2023-07-01-preview"

    - model_name: claude-opus
      litellm_params:
        model: claude-3-opus-20240229
        api_key: os.environ/ANTHROPIC_API_KEY

litellm_settings:
  default_fallbacks: ["claude-opus"]
```

This will default to claude-opus in case any model fails.

A model-specific fallbacks (e.g. `{"gpt-3.5-turbo-small": ["claude-opus"]}`) overrides default fallback.

### EU-Region Filtering (Pre-Call Checks)

**Before call is made** check if a call is within model context window with  **`enable_pre_call_checks: true`**.

Set 'region_name' of deployment. 

**Note:** LiteLLM can automatically infer region_name for Vertex AI, Bedrock, and IBM WatsonxAI based on your litellm params. For Azure, set `litellm.enable_preview = True`.

**1. Set Config**

```yaml
router_settings:
  enable_pre_call_checks: true # 1. Enable pre-call checks

model_list:
- model_name: gpt-3.5-turbo
  litellm_params:
    model: azure/chatgpt-v-2
    api_base: os.environ/AZURE_API_BASE
    api_key: os.environ/AZURE_API_KEY
    api_version: "2023-07-01-preview"
    region_name: "eu" # 👈 SET EU-REGION

- model_name: gpt-3.5-turbo
  litellm_params:
    model: gpt-3.5-turbo-1106
    api_key: os.environ/OPENAI_API_KEY

- model_name: gemini-pro
  litellm_params:
    model: vertex_ai/gemini-pro-1.5
    vertex_project: adroit-crow-1234
    vertex_location: us-east1 # 👈 AUTOMATICALLY INFERS 'region_name'
```

**2. Start proxy**

```bash
litellm --config /path/to/config.yaml

# RUNNING on http://0.0.0.0:4000
```

**3. Test it!**

```python
import openai
client = openai.OpenAI(
    api_key="anything",
    base_url="http://0.0.0.0:4000"
)

# request sent to model set on litellm proxy, `litellm --model`
response = client.chat.completions.with_raw_response.create(
    model="gpt-3.5-turbo",
    messages = [{"role": "user", "content": "Who was Alexander?"}]
)

print(response)

print(f"response.headers.get('x-litellm-model-api-base')")
```

### Setting Fallbacks for Wildcard Models

You can set fallbacks for wildcard models (e.g. `azure/*`) in your config file.

1. Setup config
```yaml
model_list:
  - model_name: "gpt-4o"
    litellm_params:
      model: "openai/gpt-4o"
      api_key: os.environ/OPENAI_API_KEY
  - model_name: "azure/*"
    litellm_params:
      model: "azure/*"
      api_key: os.environ/AZURE_API_KEY
      api_base: os.environ/AZURE_API_BASE

litellm_settings:
  fallbacks: [{"gpt-4o": ["azure/gpt-4o"]}]
```

2. Start Proxy
```bash
litellm --config /path/to/config.yaml
```

3. Test it while the primary deployment is unavailable.

```bash
curl -L -X POST 'http://0.0.0.0:4000/v1/chat/completions' \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer sk-1234' \
-d '{
    "model": "gpt-4o",
    "messages": [
      {
        "role": "user",
        "content": [    
          {
            "type": "text",
            "text": "what color is red"
          }
        ]
      }
    ],
    "max_tokens": 300
}'
```

### Enforce Key Model Access on Fallbacks

By default a fallback configured in `router_settings` runs for every request, even when the calling key is not allowed to call the fallback model directly. A key limited to the access group of `gpt-5.6` still gets a response from `claude-sonnet-5` whenever `gpt-5.6` fails and `claude-sonnet-5` is its fallback.

Set `general_settings.enforce_fallback_model_access: true` to apply the same key, team and project model access checks to every fallback target before it is tried. Targets the caller may not use are skipped. When no authorized target remains, the caller gets the primary model's own error. Keys that are allowed to call the fallback model keep falling back as before, and the check covers `fallbacks`, `context_window_fallbacks`, `content_policy_fallbacks` and `default_fallbacks`.

```yaml
model_list:
  - model_name: gpt-5.6
    litellm_params:
      model: openai/gpt-5.6
      api_key: os.environ/OPENAI_API_KEY
    model_info:
      access_groups: ["openai-only"]
  - model_name: claude-sonnet-5
    litellm_params:
      model: anthropic/claude-sonnet-5
      api_key: os.environ/ANTHROPIC_API_KEY

router_settings:
  fallbacks:
    - gpt-5.6: ["claude-sonnet-5"]

general_settings:
  master_key: sk-1234
  enforce_fallback_model_access: true
```

A key created with `"models": ["openai-only"]` can call `gpt-5.6` but not `claude-sonnet-5`. With the flag on, a failing `gpt-5.6` request from that key returns the OpenAI error instead of a `claude-sonnet-5` completion, and the response carries no `x-litellm-attempted-fallbacks` header. A key created with `"models": ["openai-only", "claude-sonnet-5"]` still falls back.

Requests that carry no virtual key, such as the proxy's own health checks, are never restricted. If the access lookup itself fails, the fallback is skipped rather than allowed.

### Disable Fallbacks (Per Request/Key)


<Tabs>

<TabItem value="request" label="Per Request">

You can disable fallbacks per key by setting `disable_fallbacks: true` in your request body.

```bash
curl -L -X POST 'http://0.0.0.0:4000/v1/chat/completions' \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer sk-1234' \
-d '{
    "messages": [
        {
            "role": "user",
            "content": "List 5 important events in the XIX century"
        }
    ],
    "model": "gpt-3.5-turbo",
    "disable_fallbacks": true # 👈 DISABLE FALLBACKS
}'
```

</TabItem>

<TabItem value="key" label="Per Key">

You can disable fallbacks per key by setting `disable_fallbacks: true` in your key metadata.

```bash
curl -L -X POST 'http://0.0.0.0:4000/key/generate' \
-H 'Authorization: Bearer sk-1234' \
-H 'Content-Type: application/json' \
-d '{
    "metadata": {
        "disable_fallbacks": true
    }
}'
```

</TabItem>
</Tabs>
