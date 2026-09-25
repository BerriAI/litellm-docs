import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Anthropic
LiteLLM 支持所有 Anthropic 模型。

- `claude-sonnet-5`
- `claude-opus-5`
- `claude-opus-4-6` (`claude-opus-4-6-20260205`)
- `claude-sonnet-4-6`
- `claude-sonnet-4-5-20250929`
- `claude-opus-4-5-20251101`
- `claude-opus-4-1-20250805`
- `claude-4` (`claude-opus-4-20250514`, `claude-sonnet-4-20250514`)
- `claude-3.7` (`claude-3-7-sonnet-20250219`)
- `claude-3.5` (`claude-3-5-sonnet-20240620`)
- `claude-3` (`claude-3-haiku-20240307`, `claude-3-opus-20240229`, `claude-3-sonnet-20240229`)
- `claude-2`
- `claude-2.1`
- `claude-instant-1.2`


| 属性 | 详情 |
|-------|-------|
| 描述 | Claude 是 Anthropic 构建的一个高性能、值得信赖且智能的 AI 平台。Claude 擅长处理涉及语言、推理、分析、编码等任务。也可通过 Azure Foundry 使用。 |
| LiteLLM 上的提供商路由 | `anthropic/`（将此前缀添加到模型名称，以将所有请求路由到 Anthropic——例如 `anthropic/claude-3-5-sonnet-20240620`）。对于 Azure Foundry 部署，请使用 `azure_ai/claude-*`（请参阅 [Azure Anthropic 文档](../providers/azure/azure_anthropic)） |
| 提供商文档 | [Anthropic ↗](https://docs.anthropic.com/en/docs/build-with-claude/overview)，[Azure Foundry Claude ↗](https://learn.microsoft.com/en-us/azure/ai-services/foundry-models/claude) |
| 提供商 API 端点 | https://api.anthropic.com（或 Azure Foundry 端点：`https://<resource-name>.services.ai.azure.com/anthropic`） |
| 支持的端点 | `/chat/completions`，`/v1/messages`（直通） |


## 支持的 OpenAI 参数 {#supported-openai-parameters}

在代码中查看，[此处](../completion/input.md#translated-openai-params)

```
"stream",
"stop",
"temperature",
"top_p",
"max_tokens",
"max_completion_tokens",
"tools",
"tool_choice",
"extra_headers",
"parallel_tool_calls",
"response_format",
"user",
"reasoning_effort",
```

:::info

**注意：**
- 当未传递 `max_tokens` 时，Anthropic API 请求会失败。因此，当未传递 `max_tokens` 时，LiteLLM 会传递 `max_tokens=4096`。
- `response_format` 完全支持 Claude Sonnet 4.5 和 Opus 4.1 模型（参见[结构化输出](#structured-outputs)部分）
- `reasoning_effort` 会自动映射到 Claude 4.6 和 Opus 4.5 模型的 `output_config={"effort": ...}`（参见[工作量参数](./anthropic_effort.md)）

:::

## **结构化输出** {#structured-outputs}

LiteLLM 支持 Anthropic 的[结构化输出功能](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)，适用于 Claude Sonnet 4.5 和 Opus 4.1 模型。当您将 `response_format` 与这些模型一起使用时，LiteLLM 会自动执行以下操作：
- 添加所需的 `structured-outputs-2025-11-13` beta 标头
- 将 OpenAI 的 `response_format` 转换为 Anthropic 的 `output_format` 格式

### 支持的模型 {#supported-models}
- `sonnet-4-5` 或 `sonnet-4.5`（所有 Sonnet 4.5 变体）
- `opus-4-1` 或 `opus-4.1`（所有 Opus 4.1 变体）
  - `opus-4-5` 或 `opus-4.5`（所有 Opus 4.5 变体）
  
### 示例用法 {#example-usage}

<Tabs>
<TabItem value="sdk" label="LiteLLM SDK">

```python
from litellm import completion

response = completion(
    model="{{anthropic}}",
    messages=[{"role": "user", "content": "What is the capital of France?"}],
    response_format={
        "type": "json_schema",
        "json_schema": {
            "name": "capital_response",
            "strict": True,
            "schema": {
                "type": "object",
                "properties": {
                    "country": {"type": "string"},
                    "capital": {"type": "string"}
                },
                "required": ["country", "capital"],
                "additionalProperties": False
            }
        }
    }
)

print(response.choices[0].message.content)
# Output: {"country": "France", "capital": "Paris"}
```

</TabItem>
<TabItem value="proxy" label="LiteLLM Proxy">

1. 设置 config.yaml

```yaml
model_list:
  - model_name: {{anthropic}}
    litellm_params:
      model: anthropic/{{anthropic}}
      api_key: os.environ/ANTHROPIC_API_KEY
```

2. 启动代理

```bash
litellm --config /path/to/config.yaml
```

3. 测试！

```bash
curl http://0.0.0.0:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_KEY" \
  -d '{
    "model": "{{anthropic}}",
    "messages": [{"role": "user", "content": "What is the capital of France?"}],
    "response_format": {
        "type": "json_schema",
        "json_schema": {
            "name": "capital_response",
            "strict": true,
            "schema": {
                "type": "object",
                "properties": {
                    "country": {"type": "string"},
                    "capital": {"type": "string"}
                },
                "required": ["country", "capital"],
                "additionalProperties": false
            }
        }
    }
  }'
```

</TabItem>
</Tabs>

:::info
当与支持的模型一起使用结构化输出时，LiteLLM 会自动执行以下操作：
- 将 OpenAI 的 `response_format` 转换为 Anthropic 的 `output_schema`
- 添加 `anthropic-beta: structured-outputs-2025-11-13` 标头
- 创建一个带有 schema 的工具并强制模型使用它
:::

## API 密钥 {#api-keys}

```python
import os

os.environ["ANTHROPIC_API_KEY"] = "your-api-key"
# os.environ["ANTHROPIC_API_BASE"] = "" # [OPTIONAL] or 'ANTHROPIC_BASE_URL'
# os.environ["LITELLM_ANTHROPIC_DISABLE_URL_SUFFIX"] = "true" # [OPTIONAL] Disable automatic URL suffix appending
```

:::tip[Azure Foundry 支持]

Claude 模型也可通过 Microsoft Azure Foundry 获得。请使用 `azure_ai/` 前缀而不是 `anthropic/`，并配置 Azure 身份验证。有关详细信息，请参阅 [Azure Anthropic 文档](../providers/azure/azure_anthropic)。

示例：
```python
response = completion(
    model="azure_ai/{{anthropic}}",
    api_base="https://<resource-name>.services.ai.azure.com/anthropic",
    api_key="your-azure-api-key",
    messages=[{"role": "user", "content": "Hello!"}]
)
```

:::

### 自定义 API 基地址 {#custom-api-base}

当为 Anthropic 使用自定义 API 基地址（例如，代理或自定义端点）时，LiteLLM 会自动将适当的后缀（`/v1/messages` 或 `/v1/complete`）附加到您的基地址。

如果您的自定义端点已包含完整路径或不遵循 Anthropic 的标准 URL 结构，您可以禁用此自动后缀附加功能：

```python
import os

os.environ["ANTHROPIC_API_BASE"] = "https://my-custom-endpoint.com/custom/path"
os.environ["LITELLM_ANTHROPIC_DISABLE_URL_SUFFIX"] = "true"  # Prevents automatic suffix
```

不使用 `LITELLM_ANTHROPIC_DISABLE_URL_SUFFIX` 时：
- 基地址 `https://my-proxy.com` → `https://my-proxy.com/v1/messages`
- 基地址 `https://my-proxy.com/api` → `https://my-proxy.com/api/v1/messages`

使用 `LITELLM_ANTHROPIC_DISABLE_URL_SUFFIX=true` 时：
- 基地址 `https://my-proxy.com/custom/path` → `https://my-proxy.com/custom/path` (未更改)

### Azure AI Foundry（替代方法） {#azure-ai-foundry-alternative-method}

:::tip[推荐方法]
为了获得完整的 Azure 支持，包括 Azure AD 身份验证，请使用带有 `azure_ai/` 前缀的专用 [Azure Anthropic 提供商](./azure/azure_anthropic)。
:::

作为替代方案，您可以直接将 `anthropic/` 提供商与您的 Azure 端点一起使用，因为 Azure 使用 Anthropic 的原生 API 暴露 Claude。

```python
from litellm import completion

response = completion(
    model="anthropic/{{anthropic}}",
    api_base="https://<your-resource>.services.ai.azure.com/anthropic",
    api_key="<your-azure-api-key>",
    messages=[{"role": "user", "content": "Hello!"}],
)
print(response)
```

:::info
**查找您的 Azure 端点：** 转到 Azure AI Foundry → 您的部署 → 概览。您的基地址将是 `https://<resource-name>.services.ai.azure.com/anthropic`
:::

## 用法 {#usage}

```python
import os
from litellm import completion

# set env - [OPTIONAL] replace with your anthropic key
os.environ["ANTHROPIC_API_KEY"] = "your-api-key"

messages = [{"role": "user", "content": "Hey! how's it going?"}]
response = completion(model="{{anthropic_large}}", messages=messages)
print(response)
```


## 用法 - 流式输出 {#usage---streaming}
只需在调用补全 (completion) 时设置 `stream=True`。

```python
import os
from litellm import completion

# set env
os.environ["ANTHROPIC_API_KEY"] = "your-api-key"

messages = [{"role": "user", "content": "Hey! how's it going?"}]
response = completion(model="{{anthropic_large}}", messages=messages, stream=True)
for chunk in response:
    print(chunk["choices"][0]["delta"]["content"])  # same as openai format
```

## LiteLLM Proxy 用法 {#usage-with-litellm-proxy}

以下是如何使用 LiteLLM Proxy 服务器调用 Anthropic

### 1. 在您的环境中保存密钥 {#1-save-key-in-your-environment}

```bash
export ANTHROPIC_API_KEY="your-api-key"
```

### 2. 启动代理 {#2-start-the-proxy}

<Tabs>
<TabItem value="config" label="config.yaml">

```yaml
model_list:
  - model_name: claude-4 ### RECEIVED MODEL NAME ###
    litellm_params: # all params accepted by litellm.completion() - https://docs.litellm.ai/docs/completion/input
      model: {{anthropic_large}} ### MODEL NAME sent to `litellm.completion()` ###
      api_key: "os.environ/ANTHROPIC_API_KEY" # does os.getenv("ANTHROPIC_API_KEY")
```

```bash
litellm --config /path/to/config.yaml
```
</TabItem>
<TabItem value="config-all" label="config - default all Anthropic Model">

如果您想向 `{{anthropic}}`、`{{anthropic_large}}` 发出请求而不在 config.yaml 中定义它们，请使用此方法

#### 必需的环境变量 {#required-env-variables}
```
ANTHROPIC_API_KEY=sk-ant****
```

```yaml
model_list:
  - model_name: "*" 
    litellm_params:
      model: "*"
```

```bash
litellm --config /path/to/config.yaml
```

此 config.yaml 的请求示例

**请确保使用 `anthropic/` 前缀将请求路由到 Anthropic API**

```shell
curl --location 'http://0.0.0.0:4000/chat/completions' \
--header 'Content-Type: application/json' \
--data ' {
      "model": "anthropic/{{anthropic}}",
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
<TabItem value="cli" label="cli">

```bash
$ litellm --model {{anthropic_large}}

# Server running on http://0.0.0.0:4000
```
</TabItem>
</Tabs>

### 3. 测试它 {#3-test-it}


<Tabs>
<TabItem value="Curl" label="Curl Request">

```shell
curl --location 'http://0.0.0.0:4000/chat/completions' \
--header 'Content-Type: application/json' \
--data ' {
      "model": "anthropic/{{anthropic}}",
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
response = client.chat.completions.create(model="anthropic/{{anthropic}}", messages = [
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
    model = "anthropic/{{anthropic}}",
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

## 支持的模型 {#supported-models-1}

`Model Name` 👉 人性化的名称。
`Function Call` 👉 在 LiteLLM 中如何调用模型。

| 模型名称 | 函数调用 |
|---|---|
| claude-opus-4-6 | `completion('claude-opus-4-6-20260205', messages)` | `os.environ['ANTHROPIC_API_KEY']` |
| claude-sonnet-4-5 | `completion('claude-sonnet-4-5-20250929', messages)` | `os.environ['ANTHROPIC_API_KEY']` |
| claude-opus-4-5 | `completion('claude-opus-4-5-20251101', messages)` | `os.environ['ANTHROPIC_API_KEY']` |
| claude-opus-4-1 | `completion('claude-opus-4-1-20250805', messages)` | `os.environ['ANTHROPIC_API_KEY']` |
| claude-opus-4 | `completion('claude-opus-4-20250514', messages)` | `os.environ['ANTHROPIC_API_KEY']` |
| claude-sonnet-4 | `completion('claude-sonnet-4-20250514', messages)` | `os.environ['ANTHROPIC_API_KEY']` |
| claude-3.7 | `completion('claude-3-7-sonnet-20250219', messages)` | `os.environ['ANTHROPIC_API_KEY']` |
| claude-3-5-sonnet | `completion('claude-3-5-sonnet-20240620', messages)` | `os.environ['ANTHROPIC_API_KEY']` |
| claude-3-haiku | `completion('claude-3-haiku-20240307', messages)` | `os.environ['ANTHROPIC_API_KEY']` |
| claude-3-opus | `completion('claude-3-opus-20240229', messages)` | `os.environ['ANTHROPIC_API_KEY']` |
| claude-3-5-sonnet-20240620 | `completion('claude-3-5-sonnet-20240620', messages)` | `os.environ['ANTHROPIC_API_KEY']` |
| claude-3-sonnet | `completion('claude-3-sonnet-20240229', messages)` | `os.environ['ANTHROPIC_API_KEY']` |
| claude-2.1 | `completion('claude-2.1', messages)` | `os.environ['ANTHROPIC_API_KEY']` |
| claude-2 | `completion('claude-2', messages)` | `os.environ['ANTHROPIC_API_KEY']` |
| claude-instant-1.2 | `completion('claude-instant-1.2', messages)` | `os.environ['ANTHROPIC_API_KEY']` |
| claude-instant-1 | `completion('claude-instant-1', messages)` | `os.environ['ANTHROPIC_API_KEY']` |

## **提示词缓存** {#prompt-caching}

使用 Anthropic 提示词缓存


[相关 Anthropic API 文档](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)

:::note

以下是 LiteLLM 对 Anthropic 上下文缓存的原始请求示例：

```bash
POST Request Sent from LiteLLM:
curl -X POST \
https://api.anthropic.com/v1/messages \
-H 'accept: application/json' -H 'anthropic-version: 2023-06-01' -H 'content-type: application/json' -H 'x-api-key: sk-...' \
-d '{'model': '{{anthropic}}', [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "What are the key terms and conditions in this agreement?",
          "cache_control": {
            "type": "ephemeral"
          }
        }
      ]
    },
    {
      "role": "assistant",
      "content": [
        {
          "type": "text",
          "text": "Certainly! The key terms and conditions are the following: the contract is 1 year long for $10/mo"
        }
      ]
    }
  ],
  "temperature": 0.2,
  "max_tokens": 10
}'
```

**注意：** Anthropic 不再需要 `anthropic-beta: prompt-caching-2024-07-31` 标头。当您在消息中使用 `cache_control` 时，提示词缓存现在会自动工作。
::: 

### 缓存 - 大上下文缓存 {#caching---large-context-caching}


此示例演示了基本的提示词缓存用法，将法律协议的全文作为前缀进行缓存，同时保持用户指令不被缓存。


<Tabs>
<TabItem value="sdk" label="LiteLLM SDK">

```python 
response = await litellm.acompletion(
    model="anthropic/{{anthropic}}",
    messages=[
        {
            "role": "system",
            "content": [
                {
                    "type": "text",
                    "text": "You are an AI assistant tasked with analyzing legal documents.",
                },
                {
                    "type": "text",
                    "text": "Here is the full text of a complex legal agreement",
                    "cache_control": {"type": "ephemeral"},
                },
            ],
        },
        {
            "role": "user",
            "content": "what are the key terms and conditions in this agreement?",
        },
    ]
)

```
</TabItem>
<TabItem value="proxy" label="LiteLLM Proxy">

:::info

LiteLLM Proxy 与 OpenAI 兼容

这是一个使用 OpenAI Python SDK 向 LiteLLM Proxy 发送请求的示例。

假设您在 [litellm proxy config.yaml](#usage-with-litellm-proxy) 中有一个模型 `anthropic/{{anthropic}}`。

:::

```python 
import openai
client = openai.AsyncOpenAI(
    api_key="anything",            # litellm proxy api key
    base_url="http://0.0.0.0:4000" # litellm proxy base url
)


response = await client.chat.completions.create(
    model="anthropic/{{anthropic}}",
    messages=[
        {
            "role": "system",
            "content": [
                {
                    "type": "text",
                    "text": "You are an AI assistant tasked with analyzing legal documents.",
                },
                {
                    "type": "text",
                    "text": "Here is the full text of a complex legal agreement",
                    "cache_control": {"type": "ephemeral"},
                },
            ],
        },
        {
            "role": "user",
            "content": "what are the key terms and conditions in this agreement?",
        },
    ]
)

```

</TabItem>
</Tabs>

### 缓存 - 工具定义 {#caching---tools-definitions}

在此示例中，我们演示了缓存工具定义。

cache_control 参数放置在最终工具上

<Tabs>
<TabItem value="sdk" label="LiteLLM SDK">

```python 
import litellm

response = await litellm.acompletion(
    model="anthropic/{{anthropic}}",
    messages = [{"role": "user", "content": "What's the weather like in Boston today?"}],
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
                "cache_control": {"type": "ephemeral"}
            },
        }
    ]
)
```
</TabItem>
<TabItem value="proxy" label="LiteLLM Proxy">

:::info

LiteLLM Proxy 与 OpenAI 兼容

这是一个使用 OpenAI Python SDK 向 LiteLLM Proxy 发送请求的示例。

假设您在 [litellm proxy config.yaml](#usage-with-litellm-proxy) 中有一个模型 `anthropic/{{anthropic}}`。

:::

```python 
import openai
client = openai.AsyncOpenAI(
    api_key="anything",            # litellm proxy api key
    base_url="http://0.0.0.0:4000" # litellm proxy base url
)

response = await client.chat.completions.create(
    model="anthropic/{{anthropic}}",
    messages = [{"role": "user", "content": "What's the weather like in Boston today?"}],
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
                "cache_control": {"type": "ephemeral"}
            },
        }
    ]
)
```

</TabItem>
</Tabs>


### 缓存 - 继续多轮对话 {#caching---continuing-multi-turn-convo}

在此示例中，我们演示了如何在多轮对话中使用提示词 (Prompt) 缓存。

cache_control 参数放置在系统消息上，以将其指定为静态前缀的一部分。

对话历史（之前的消息）包含在 messages 数组中。最终轮次用 cache-control 标记，以便在后续对话中继续。倒数第二条用户消息用 cache_control 参数标记为缓存，以便此检查点可以从之前的缓存中读取。

<Tabs>
<TabItem value="sdk" label="LiteLLM SDK">

```python 
import litellm

response = await litellm.acompletion(
    model="anthropic/{{anthropic}}",
    messages=[
        # System Message
        {
            "role": "system",
            "content": [
                {
                    "type": "text",
                    "text": "Here is the full text of a complex legal agreement"
                    * 400,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
        },
        # marked for caching with the cache_control parameter, so that this checkpoint can read from the previous cache.
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": "What are the key terms and conditions in this agreement?",
                    "cache_control": {"type": "ephemeral"},
                }
            ],
        },
        {
            "role": "assistant",
            "content": "Certainly! the key terms and conditions are the following: the contract is 1 year long for $10/mo",
        },
        # The final turn is marked with cache-control, for continuing in followups.
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": "What are the key terms and conditions in this agreement?",
                    "cache_control": {"type": "ephemeral"},
                }
            ],
        },
    ]
)
```
</TabItem>
<TabItem value="proxy" label="LiteLLM Proxy">

:::info

LiteLLM Proxy 与 OpenAI 兼容

这是一个使用 OpenAI Python SDK 向 LiteLLM Proxy 发送请求的示例。

假设您在 [litellm proxy config.yaml](#usage-with-litellm-proxy) 中有一个模型 `anthropic/{{anthropic}}`。

:::

```python 
import openai
client = openai.AsyncOpenAI(
    api_key="anything",            # litellm proxy api key
    base_url="http://0.0.0.0:4000" # litellm proxy base url
)

response = await client.chat.completions.create(
    model="anthropic/{{anthropic}}",
    messages=[
        # System Message
        {
            "role": "system",
            "content": [
                {
                    "type": "text",
                    "text": "Here is the full text of a complex legal agreement"
                    * 400,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
        },
        # marked for caching with the cache_control parameter, so that this checkpoint can read from the previous cache.
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": "What are the key terms and conditions in this agreement?",
                    "cache_control": {"type": "ephemeral"},
                }
            ],
        },
        {
            "role": "assistant",
            "content": "Certainly! the key terms and conditions are the following: the contract is 1 year long for $10/mo",
        },
        # The final turn is marked with cache-control, for continuing in followups.
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": "What are the key terms and conditions in this agreement?",
                    "cache_control": {"type": "ephemeral"},
                }
            ],
        },
    ]
)
```

</TabItem>
</Tabs>

## **函数/工具调用** {#functiontool-calling}

```python
from litellm import completion

# set env
os.environ["ANTHROPIC_API_KEY"] = "your-api-key"

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
    model="anthropic/{{anthropic}}",
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


### 强制 Anthropic 工具使用 {#forcing-anthropic-tool-use}

如果您希望 Claude 使用特定工具来回答用户的问题

您可以通过在 `tool_choice` 字段中指定工具来做到这一点，如下所示：
```python
response = completion(
    model="anthropic/{{anthropic}}",
    messages=messages,
    tools=tools,
    tool_choice={"type": "tool", "name": "get_weather"},
)
```

### 禁用工具调用 {#disable-tool-calling}

您可以通过将 `tool_choice` 设置为 `"none"` 来禁用工具调用。

<Tabs>
<TabItem value="sdk" label="SDK">

```python
from litellm import completion

response = completion(
    model="anthropic/{{anthropic}}",
    messages=messages,
    tools=tools,
    tool_choice="none",
)

```
</TabItem>
<TabItem value="proxy" label="Proxy">

1. 设置 config.yaml

```yaml
model_list:
  - model_name: anthropic-claude-model
    litellm_params:
        model: anthropic/{{anthropic}}
        api_key: os.environ/ANTHROPIC_API_KEY
```

2. 启动代理

```bash
litellm --config /path/to/config.yaml
```

3. 测试一下！

如果已 [设置](../proxy/virtual_keys)，请将 `anything` 替换为您的 LiteLLM Proxy 虚拟密钥 (virtual key)。

```bash
curl http://0.0.0.0:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer anything" \
  -d '{
    "model": "anthropic-claude-model",
    "messages": [{"role": "user", "content": "Who won the World Cup in 2022?"}],
    "tools": [{"type": "mcp", "server_label": "deepwiki", "server_url": "https://mcp.deepwiki.com/mcp", "require_approval": "never"}],
    "tool_choice": "none"
  }'
```
</TabItem>
</Tabs>



### MCP 工具调用 {#mcp-tool-calling}

以下是如何使用 Anthropic 进行 MCP 工具调用：

<Tabs>
<TabItem value="sdk" label="LiteLLM SDK">

LiteLLM 支持以 OpenAI Responses API 格式与 Anthropic 进行 MCP 工具调用。

<Tabs>
<TabItem value="openai_format" label="OpenAI Format">


```python
import os 
from litellm import completion

os.environ["ANTHROPIC_API_KEY"] = "sk-ant-..."

tools=[
    {
        "type": "mcp",
        "server_label": "deepwiki",
        "server_url": "https://mcp.deepwiki.com/mcp",
        "require_approval": "never",
    },
]

response = completion(
    model="anthropic/{{anthropic}}",
    messages=[{"role": "user", "content": "Who won the World Cup in 2022?"}],
    tools=tools
)
```

</TabItem>
<TabItem value="anthropic_format" label="Anthropic Format">

```python
import os 
from litellm import completion

os.environ["ANTHROPIC_API_KEY"] = "sk-ant-..."

tools = [
    {
        "type": "url",
        "url": "https://mcp.deepwiki.com/mcp",
        "name": "deepwiki-mcp",
    }
]
response = completion(
    model="anthropic/{{anthropic}}",
    messages=[{"role": "user", "content": "Who won the World Cup in 2022?"}],
    tools=tools
)

print(response)
```
</TabItem>

</Tabs>

</TabItem>
<TabItem value="proxy" label="LiteLLM Proxy">

1. 设置 config.yaml

```yaml
model_list:
  - model_name: claude-4-sonnet
    litellm_params:
        model: anthropic/{{anthropic}}
        api_key: os.environ/ANTHROPIC_API_KEY
```

2. 启动代理

```bash
litellm --config /path/to/config.yaml
```

3. 测试一下！

<Tabs>
<TabItem value="openai" label="OpenAI Format">

```bash
curl http://0.0.0.0:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_KEY" \
  -d '{
    "model": "claude-4-sonnet",
    "messages": [{"role": "user", "content": "Who won the World Cup in 2022?"}],
    "tools": [{"type": "mcp", "server_label": "deepwiki", "server_url": "https://mcp.deepwiki.com/mcp", "require_approval": "never"}]
  }'
```

</TabItem>
<TabItem value="anthropic" label="Anthropic Format">

```bash
curl http://0.0.0.0:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_KEY" \
  -d '{
    "model": "claude-4-sonnet",
    "messages": [{"role": "user", "content": "Who won the World Cup in 2022?"}],
    "tools": [
        {
            "type": "url",
            "url": "https://mcp.deepwiki.com/mcp",
            "name": "deepwiki-mcp",
        }
    ]
  }'
```

</TabItem>
</Tabs>
</TabItem>
</Tabs>

### 并行函数调用 {#parallel-function-calling}

以下是如何将函数调用的结果传回 Anthropic 模型：

```python
from litellm import completion
import os 

os.environ["ANTHROPIC_API_KEY"] = "sk-ant.."


litellm.set_verbose = True

### 1ST FUNCTION CALL ###
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
messages = [
    {
        "role": "user",
        "content": "What's the weather like in Boston today in Fahrenheit?",
    }
]
try:
    # test without max tokens
    response = completion(
        model="anthropic/{{anthropic}}",
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

    messages.append(
        response.choices[0].message.model_dump()
    )  # Add assistant tool invokes
    tool_result = (
        '{"location": "Boston", "temperature": "72", "unit": "fahrenheit"}'
    )
    # Add user submitted tool results in the OpenAI format
    messages.append(
        {
            "tool_call_id": response.choices[0].message.tool_calls[0].id,
            "role": "tool",
            "name": response.choices[0].message.tool_calls[0].function.name,
            "content": tool_result,
        }
    )
    ### 2ND FUNCTION CALL ###
    # In the second response, Claude should deduce answer from tool results
    second_response = completion(
        model="anthropic/{{anthropic}}",
        messages=messages,
        tools=tools,
        tool_choice="auto",
    )
    print(second_response)
except Exception as e:
    print(f"An error occurred - {str(e)}")
```

特别感谢 @[Shekhar Patnaik](https://www.linkedin.com/in/patnaikshekhar) 提出此请求！

### 上下文管理 (Beta) {#context-management-beta}

Anthropic 的 [上下文编辑](https://docs.claude.com/en/docs/build-with-claude/context-editing) API 允许您自动清除旧的工具结果或思考块。LiteLLM 现在在您调用 Anthropic 模型时转发原生的 `context_management` 有效负载，并自动附加所需的 `context-management-2025-06-27` beta 头部。

```python
from litellm import completion

response = completion(
    model="anthropic/{{anthropic}}",
    messages=[{"role": "user", "content": "Summarize the latest tool results"}],
    context_management={
        "edits": [
            {
                "type": "clear_tool_uses_20250919",
                "trigger": {"type": "input_tokens", "value": 30000},
                "keep": {"type": "tool_uses", "value": 3},
                "clear_at_least": {"type": "input_tokens", "value": 5000},
                "exclude_tools": ["web_search"],
            }
        ]
    },
)
```

### Anthropic 托管工具 (Computer, Text Editor, Web Search, Memory) {#anthropic-hosted-tools-computer-text-editor-web-search-memory}


<Tabs>
<TabItem value="computer" label="Computer">

```python keep-model-ids
from litellm import completion

tools = [
    {
        "type": "computer_20241022",
        "function": {
            "name": "computer",
            "parameters": {
                "display_height_px": 100,
                "display_width_px": 100,
                "display_number": 1,
            },
        },
    }
]
model = "claude-3-5-sonnet-20241022"
messages = [{"role": "user", "content": "Save a picture of a cat to my desktop."}]

resp = completion(
    model=model,
    messages=messages,
    tools=tools,
    # headers={"anthropic-beta": "computer-use-2024-10-22"},
)

print(resp)
```

</TabItem>
<TabItem value="text_editor" label="Text Editor">

<Tabs>
<TabItem value="sdk" label="SDK">

```python keep-model-ids
from litellm import completion

tools = [{
    "type": "text_editor_20250124",
    "name": "str_replace_editor"
}]
model = "claude-3-5-sonnet-20241022"
messages = [{"role": "user", "content": "There's a syntax error in my primes.py file. Can you help me fix it?"}]

resp = completion(
    model=model,
    messages=messages,
    tools=tools,
)

print(resp)
```

</TabItem>
<TabItem value="proxy" label="PROXY">

1. 设置 config.yaml

```yaml keep-model-ids
- model_name: claude-3-5-sonnet-latest
  litellm_params:
    model: anthropic/claude-3-5-sonnet-latest
    api_key: os.environ/ANTHROPIC_API_KEY
```

2. 启动代理

```bash
litellm --config /path/to/config.yaml
```

3. 测试一下！

```bash keep-model-ids
curl http://0.0.0.0:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_KEY" \
  -d '{
    "model": "claude-3-5-sonnet-latest",
    "messages": [{"role": "user", "content": "There's a syntax error in my primes.py file. Can you help me fix it?"}],
    "tools": [{"type": "text_editor_20250124", "name": "str_replace_editor"}]
  }'
```
</TabItem>
</Tabs>

</TabItem>
<TabItem value="web_search" label="Web Search">

:::info
自 v1.70.1+ 起生效
:::

LiteLLM 将 OpenAI 的 `search_context_size` 参数映射到 Anthropic 的 `max_uses` 参数。

| OpenAI | Anthropic |
| --- | --- |
| Low | 1 |
| Medium | 5 |
| High | 10 |


<Tabs>
<TabItem value="sdk" label="SDK">


<Tabs>
<TabItem value="openai" label="OpenAI Format">

```python
from litellm import completion

model = "{{anthropic}}"
messages = [{"role": "user", "content": "What's the weather like today?"}]

resp = completion(
    model=model,
    messages=messages,
    web_search_options={
        "search_context_size": "medium",
        "user_location": {
            "type": "approximate",
            "approximate": {
                "city": "San Francisco",
            },
        }
    }
)

print(resp)
```
</TabItem>
<TabItem value="anthropic" label="Anthropic Format">

```python
from litellm import completion

tools = [{
    "type": "web_search_20250305",
    "name": "web_search",
    "max_uses": 5
}]
model = "{{anthropic}}"
messages = [{"role": "user", "content": "There's a syntax error in my primes.py file. Can you help me fix it?"}]

resp = completion(
    model=model,
    messages=messages,
    tools=tools,
)

print(resp)
```
</TabItem>

</Tabs>
</TabItem>

<TabItem value="proxy" label="PROXY">

1. 设置 config.yaml

```yaml
- model_name: {{anthropic}}
  litellm_params:
    model: anthropic/{{anthropic}}
    api_key: os.environ/ANTHROPIC_API_KEY
```

2. 启动代理

```bash
litellm --config /path/to/config.yaml
```

3. 测试一下！

<Tabs>
<TabItem value="openai" label="OpenAI Format">


```bash
curl http://0.0.0.0:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_KEY" \
  -d '{
    "model": "{{anthropic}}",
    "messages": [{"role": "user", "content": "What's the weather like today?"}],
    "web_search_options": {
        "search_context_size": "medium",
        "user_location": {
            "type": "approximate",
            "approximate": {
                "city": "San Francisco",
            },
        }
    }
  }'
```
</TabItem>
<TabItem value="anthropic" label="Anthropic Format">

```bash
curl http://0.0.0.0:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_KEY" \
  -d '{
    "model": "{{anthropic}}",
    "messages": [{"role": "user", "content": "What's the weather like today?"}],
    "tools": [{
        "type": "web_search_20250305",
        "name": "web_search",
        "max_uses": 5
    }]
  }'
```

</TabItem>
</Tabs>
</TabItem>
</Tabs>

</TabItem>

<TabItem value="memory" label="Memory">

:::info
Anthropic Memory 工具目前处于测试阶段。
:::

<Tabs>
<TabItem value="sdk" label="SDK">

```python
from litellm import completion

tools = [{
    "type": "memory_20250818",
    "name": "memory"
}]

model = "{{anthropic}}" 
messages = [{"role": "user", "content": "Please remember that my favorite color is blue."}]

response = completion(
    model=model,
    messages=messages,
    tools=tools,
)

print(response)
```

</TabItem>
<TabItem value="proxy" label="Proxy">

1. 设置 config.yaml

```yaml
model_list:
    - model_name: claude-memory-model
      litellm_params:
        model: anthropic/{{anthropic}}
        api_key: os.environ/ANTHROPIC_API_KEY
```

2. 启动代理

```bash
litellm --config /path/to/config.yaml
```

3. 测试一下！

```bash
curl http://0.0.0.0:4000/v1/chat/completions \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $LITELLM_KEY" \
    -d '{
    "model": "claude-memory-model",
    "messages": [{"role": "user", "content": "Please remember that my favorite color is blue."}],
    "tools": [{"type": "memory_20250818", "name": "memory"}]
    }'
```
</TabItem>
</Tabs>

</TabItem>

</Tabs>



## 用法 - 视觉 (Vision) {#usage---vision}

```python
from litellm import completion

# set env
os.environ["ANTHROPIC_API_KEY"] = "your-api-key"

def encode_image(image_path):
    import base64

    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode("utf-8")


image_path = "../proxy/cached_logo.jpg"
# Getting the base64 string
base64_image = encode_image(image_path)
resp = litellm.completion(
    model="anthropic/{{anthropic}}",
    messages=[
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "Whats in this image?"},
                {
                    "type": "image_url",
                    "image_url": {
                        "url": "data:image/jpeg;base64," + base64_image
                    },
                },
            ],
        }
    ],
)
print(f"\nResponse: {resp}")
```

## 用法 - 思维 (`reasoning_content`) {#usage---thinking--reasoning_content}

LiteLLM 将 OpenAI 的 `reasoning_effort` 转换为 Anthropic 的 `thinking` 参数。 [代码](https://github.com/BerriAI/litellm/blob/23051d89dd3611a81617d84277059cd88b2df511/litellm/llms/anthropic/chat/transformation.py#L298)

| reasoning_effort | thinking |
| ---------------- | -------- |
| "low"            | "budget_tokens": 1024 |
| "medium"         | "budget_tokens": 2048 |
| "high"           | "budget_tokens": 4096 |

:::note
`reasoning_effort` 映射到 Anthropic 的 [自适应思维 (adaptive thinking)](https: //docs.claude.com/en/docs/build-with-claude/extended-thinking/adaptive-thinking) 以及 Claude 4.6 和 4.7 模型（包括 `claude-opus-4-6`、`claude-opus-4-7`、`claude-sonnet-4-6` 等）上的 `output_config.effort` 参数，**而不是** `budget_tokens`。具体来说，LiteLLM 会在 OpenAI 兼容的 `/chat/completions` 路由上将以下内容注入到底层 Anthropic 请求中：

```json
{
  "thinking": {"type": "adaptive"},
  "output_config": {"effort": "<low|medium|high|xhigh|max>"}
}
```

这意味着对于这些模型，**`reasoning_effort` 的任何非 `"none"` 值都将自动开启思考功能**，即使 OpenAI 兼容的请求体没有单独的 `thinking` 字段。这旨在与 Anthropic 推荐的使用方式保持一致：budget_tokens 已在 4.6 模型上弃用，并在 Opus 4.7 上完全拒绝，其中只有 adaptive 是一种受支持的思考模式。

您可以通过完全省略 `reasoning_effort` 或将其设置为 `"none"` 来禁用思维功能。在这种情况下，LiteLLM 将不会发送 `thinking` 字段。如果您希望在早期模型上通过固定预算明确控制思维功能，您仍然可以直接传递原生的 `thinking` 参数：

```python keep-model-ids
from litellm import completion

# Disable thinking on Claude 4.6/4.7
resp = completion(
    model="anthropic/claude-opus-4-7",
    messages=[{"role": "user", "content": "What is the capital of France?"}],
    reasoning_effort="none",  # no thinking field sent
)

# Explicit budget (pre-4.6 models; deprecated on 4.6, rejected on Opus 4.7)
resp = completion(
    model="anthropic/claude-sonnet-4-5-20250929",
    messages=[{"role": "user", "content": "What is the capital of France?"}],
    thinking={"type": "enabled", "budget_tokens": 1024},
)
```

Anthropic `/v1/messages` 直通路由不受此思维努力映射的影响。`thinking` 会原样传递。
:::

<Tabs>
<TabItem value="sdk" label="SDK">

```python
from litellm import completion

resp = completion(
    model="anthropic/{{anthropic}}",
    messages=[{"role": "user", "content": "What is the capital of France?"}],
    reasoning_effort="low",
)

```

</TabItem>

<TabItem value="proxy" label="PROXY">

1. 设置 config.yaml

```yaml
- model_name: {{anthropic}}
  litellm_params:
    model: anthropic/{{anthropic}}
    api_key: os.environ/ANTHROPIC_API_KEY
```

2. 启动代理

```bash
litellm --config /path/to/config.yaml
```

3. 测试一下！

```bash
curl http://0.0.0.0:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR-LITELLM-KEY>" \
  -d '{
    "model": "{{anthropic}}",
    "messages": [{"role": "user", "content": "What is the capital of France?"}],
    "reasoning_effort": "low"
  }'
```

</TabItem>
</Tabs>


**预期响应**

```python
ModelResponse(
    id='chatcmpl-c542d76d-f675-4e87-8e5f-05855f5d0f5e',
    created=1740470510,
    model='{{anthropic}}',
    object='chat.completion',
    system_fingerprint=None,
    choices=[
        Choices(
            finish_reason='stop',
            index=0,
            message=Message(
                content="The capital of France is Paris.",
                role='assistant',
                tool_calls=None,
                function_call=None,
                provider_specific_fields={
                    'citations': None,
                    'thinking_blocks': [
                        {
                            'type': 'thinking',
                            'thinking': 'The capital of France is Paris. This is a very straightforward factual question.',
                            'signature': 'EuYBCkQYAiJAy6...'
                        }
                    ]
                }
            ),
            thinking_blocks=[
                {
                    'type': 'thinking',
                    'thinking': 'The capital of France is Paris. This is a very straightforward factual question.',
                    'signature': 'EuYBCkQYAiJAy6AGB...'
                }
            ],
            reasoning_content='The capital of France is Paris. This is a very straightforward factual question.'
        )
    ],
    usage=Usage(
        completion_tokens=68,
        prompt_tokens=42,
        total_tokens=110,
        completion_tokens_details=None,
        prompt_tokens_details=PromptTokensDetailsWrapper(
            audio_tokens=None,
            cached_tokens=0,
            text_tokens=None,
            image_tokens=None
        ),
        cache_creation_input_tokens=0,
        cache_read_input_tokens=0
    )
)
```

### 将 `thinking` 传递给 Anthropic 模型 {#pass-thinking-to-anthropic-models}

您还可以将 `thinking` 参数传递给 Anthropic 模型。


您还可以将 `thinking` 参数传递给 Anthropic 模型。

<Tabs>
<TabItem value="sdk" label="SDK">

```python
response = litellm.completion(
  model="anthropic/{{anthropic}}",
  messages=[{"role": "user", "content": "What is the capital of France?"}],
  thinking={"type": "enabled", "budget_tokens": 1024},
)
```

</TabItem>
<TabItem value="proxy" label="PROXY">

```bash
curl http://0.0.0.0:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_KEY" \
  -d '{
    "model": "anthropic/{{anthropic}}",
    "messages": [{"role": "user", "content": "What is the capital of France?"}],
    "thinking": {"type": "enabled", "budget_tokens": 1024}
  }'
```

</TabItem>
</Tabs>

#### 自适应思维 (Adaptive Thinking) (Claude Opus 4.6) {#adaptive-thinking-claude-opus-46}

<Tabs>
<TabItem value="sdk" label="SDK">

```python
response = litellm.completion(
  model="anthropic/{{anthropic_large}}",
  messages=[{"role": "user", "content": "What is the optimal strategy for solving this problem?"}],
  thinking={"type": "adaptive"},
)
```

</TabItem>
<TabItem value="proxy" label="PROXY">

```bash
curl http://0.0.0.0:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_KEY" \
  -d '{
    "model": "anthropic/{{anthropic_large}}",
    "messages": [{"role": "user", "content": "What is the optimal strategy for solving this problem?"}],
    "thinking": {"type": "adaptive"}
  }'
```

</TabItem>
</Tabs>

#### 启用带预算的思维功能 {#enabled-thinking-with-budget}

<Tabs>
<TabItem value="sdk" label="SDK">

```python
response = litellm.completion(
  model="anthropic/{{anthropic_large}}",
  messages=[{"role": "user", "content": "What is the capital of France?"}],
  thinking={"type": "enabled", "budget_tokens": 5000},
)
```

</TabItem>
<TabItem value="proxy" label="PROXY">

```bash
curl http://0.0.0.0:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_KEY" \
  -d '{
    "model": "anthropic/{{anthropic_large}}",
    "messages": [{"role": "user", "content": "What is the capital of France?"}],
    "thinking": {"type": "enabled", "budget_tokens": 5000}
  }'
```

</TabItem>
</Tabs>

## **将额外请求头 (Extra Headers) 传递给 Anthropic API** {#passing-extra-headers-to-anthropic-api}

将 `extra_headers: dict` 传递给 `litellm.completion`

```python keep-model-ids
from litellm import completion
messages = [{"role": "user", "content": "What is Anthropic?"}]
response = completion(
    model="claude-3-5-sonnet-20240620", 
    messages=messages, 
    extra_headers={"anthropic-beta": "max-tokens-3-5-sonnet-2024-07-15"}
)
```

## 用法 - “助手预填充 (Assistant Pre-fill)” {#usage---assistant-pre-fill}

您可以通过在 `messages` 数组中包含一个 `assistant` 角色消息作为最后一项来“让 Claude 说出您想说的话”。

:::info

返回的补全 (completion) 将**不**包含您的“预填充 (pre-fill)”文本，因为它本身就是提示词 (prompt) 的一部分。请确保在 Claude 的补全 (completion) 前加上您的预填充 (pre-fill) 内容。

:::

```python keep-model-ids
import os
from litellm import completion

# set env - [OPTIONAL] replace with your anthropic key
os.environ["ANTHROPIC_API_KEY"] = "your-api-key"

messages = [
    {"role": "user", "content": "How do you say 'Hello' in German? Return your answer as a JSON object, like this:\n\n{ \"Hello\": \"Hallo\" }"},
    {"role": "assistant", "content": "{"},
]
response = completion(model="claude-2.1", messages=messages)
print(response)
```

#### 发送给 Claude 的示例提示词 (prompt) {#example-prompt-sent-to-claude}

```

Human: How do you say 'Hello' in German? Return your answer as a JSON object, like this:

{ "Hello": "Hallo" }

Assistant: {
```

## 用法 - “系统 (System)”消息 {#usage---system-messages}
如果您正在使用 Anthropic 的 Claude 2.1，`system` 角色消息会为您正确格式化。

```python keep-model-ids
import os
from litellm import completion

# set env - [OPTIONAL] replace with your anthropic key
os.environ["ANTHROPIC_API_KEY"] = "your-api-key"

messages = [
    {"role": "system", "content": "You are a snarky assistant."},
    {"role": "user", "content": "How do I boil water?"},
]
response = completion(model="claude-2.1", messages=messages)
```

#### 发送给 Claude 的示例提示词 (prompt) {#example-prompt-sent-to-claude-1}

```
You are a snarky assistant.

Human: How do I boil water?

Assistant:
```


## 用法 - PDF {#usage---pdf}

使用 `file` 内容类型和 `file_data` 字段将 base64 编码的 PDF 文件传递给 Anthropic 模型。

<Tabs>
<TabItem value="sdk" label="SDK">

### **使用 base64** {#using-base64}
```python
from litellm import completion, supports_pdf_input
import base64
import requests

# URL of the file
url = "https://storage.googleapis.com/cloud-samples-data/generative-ai/pdf/2403.05530.pdf"

# Download the file
response = requests.get(url)
file_data = response.content

encoded_file = base64.b64encode(file_data).decode("utf-8")

## check if model supports pdf input
supports_pdf_input("anthropic/{{anthropic}}") # True

response = completion(
    model="anthropic/{{anthropic}}",
    messages=[
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "You are a very professional document summarization specialist. Please summarize the given document."},
                {
                    "type": "file",
                    "file": {
                       "file_data": f"data:application/pdf;base64,{encoded_file}", # 👈 PDF
                    }
                },
            ],
        }
    ],
    max_tokens=300,
)

print(response.choices[0])
```
</TabItem>
<TabItem value="proxy" label="PROXY">

1. 将模型添加到配置中

```yaml
- model_name: {{anthropic}}
  litellm_params:
    model: anthropic/{{anthropic}}
    api_key: os.environ/ANTHROPIC_API_KEY
```

2. 启动代理

```
litellm --config /path/to/config.yaml
```

3. 测试一下！

```bash
curl http://0.0.0.0:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR-LITELLM-KEY>" \
  -d '{
    "model": "{{anthropic}}",
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "text",
            "text": "You are a very professional document summarization specialist. Please summarize the given document"
          },
          {
                "type": "file",
                "file": {
                    "file_data": f"data:application/pdf;base64,{encoded_file}", # 👈 PDF
                }
            }
          }
        ]
      }
    ],
    "max_tokens": 300
  }'

```
</TabItem>
</Tabs>

## [BETA] Citations API {#beta-citations-api}

向 Anthropic 传递 `citations: {"enabled": true}`，以在您的文档响应中获取引用。

注意：此接口处于 BETA 阶段。如果您对引用应如何返回有任何反馈，请[在此处告诉我们](https://github.com/BerriAI/litellm/issues/7970#issuecomment-2644437943)

<Tabs>
<TabItem value="sdk" label="SDK">

```python
from litellm import completion

resp = completion(
    model="{{anthropic}}",
    messages=[
        {
            "role": "user",
            "content": [
                {
                    "type": "document",
                    "source": {
                        "type": "text",
                        "media_type": "text/plain",
                        "data": "The grass is green. The sky is blue.",
                    },
                    "title": "My Document",
                    "context": "This is a trustworthy document.",
                    "citations": {"enabled": True},
                },
                {
                    "type": "text",
                    "text": "What color is the grass and sky?",
                },
            ],
        }
    ],
)

citations = resp.choices[0].message.provider_specific_fields["citations"]

assert citations is not None
```

</TabItem>
<TabItem value="proxy" label="PROXY">

1. 设置 config.yaml

```yaml
model_list:
    - model_name: anthropic-claude
      litellm_params:
        model: anthropic/{{anthropic}}
        api_key: os.environ/ANTHROPIC_API_KEY
```

2. 启动代理

```bash
litellm --config /path/to/config.yaml

# RUNNING on http://0.0.0.0:4000
```

3. 测试一下！

```bash
curl -L -X POST 'http://0.0.0.0:4000/v1/chat/completions' \
-H 'Content-Type: application/json' \
-H "Authorization: Bearer $LITELLM_API_KEY" \
-d '{
  "model": "anthropic-claude",
  "messages": [
    {
        "role": "user",
        "content": [
            {
                "type": "document",
                "source": {
                    "type": "text",
                    "media_type": "text/plain",
                    "data": "The grass is green. The sky is blue.",
                },
                "title": "My Document",
                "context": "This is a trustworthy document.",
                "citations": {"enabled": True},
            },
            {
                "type": "text",
                "text": "What color is the grass and sky?",
            },
        ],
    }
  ]
}'
```

</TabItem>
</Tabs>

## Files API {#files-api}

一次上传文件，然后在多个请求中通过 `file_id` 引用它们，无需每次都重新上传内容。

:::info
从 Anthropic 获取的 `file_id` 仅适用于 Anthropic Claude 模型。您不能将其与其他提供商（OpenAI、Bedrock 等）一起使用。
:::

- **最大文件大小：** 500 MB | **总存储空间：** 每个组织 100 GB
- **定价：** 文件 API 操作免费。在 Messages 请求中使用的文件内容按输入 token 定价。

**按文件类型支持的模型：**
- **图片：** 所有 Claude 3+ 模型
- **PDF：** 所有 Claude 3.5+ 模型
- **其他文件类型**（用于代码执行）：Claude 3.5 Haiku + 所有 Claude 3.7+ 模型

### 快速开始 {#quick-start}

```python
import litellm
import os

os.environ["ANTHROPIC_API_KEY"] = "sk-ant-..."

# 1. Upload a file once
file = litellm.create_file(
    file=open("document.pdf", "rb"),
    purpose="messages",
    custom_llm_provider="anthropic",
)

# 2. Use file_id in messages (no re-upload needed)
response = litellm.completion(
    model="anthropic/{{anthropic}}",
    messages=[{
        "role": "user",
        "content": [
            {"type": "text", "text": "Summarize this document"},
            {"type": "file", "file": {"file_id": file.id, "format": "application/pdf"}}
        ]
    }]
)
```

### 文件操作 {#file-operations}

| 操作 | 函数 |
|-----------|----------|
| 上传 | `litellm.create_file(file, purpose="messages", custom_llm_provider="anthropic")` |
| 列出 | `litellm.file_list(custom_llm_provider="anthropic")` |
| 检索 | `litellm.file_retrieve(file_id, custom_llm_provider="anthropic")` |
| 删除 | `litellm.file_delete(file_id, custom_llm_provider="anthropic")` |
| 下载 | `litellm.file_content(file_id, custom_llm_provider="anthropic")` |

:::note
下载仅适用于由[代码执行工具](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/code-execution-tool)创建的文件，不适用于已上传的文件。
:::

### 支持的格式 {#supported-formats}

| 文件类型 | 格式值 |
|-----------|-------------|
| PDF | `application/pdf` |
| 纯文本 | `text/plain` |
| JPEG | `image/jpeg` |
| PNG | `image/png` |
| GIF | `image/gif` |
| WebP | `image/webp` |

### 使用图片 {#using-images}

```python
# Upload image
image = litellm.create_file(
    file=open("photo.jpg", "rb"),
    purpose="messages",
    custom_llm_provider="anthropic",
)

# Use in message
response = litellm.completion(
    model="anthropic/{{anthropic}}",
    messages=[{
        "role": "user",
        "content": [
            {"type": "text", "text": "What's in this image?"},
            {"type": "file", "file": {"file_id": image.id, "format": "image/jpeg"}}
        ]
    }]
)
```

## 用法 - 将 'user_id' 传递给 Anthropic {#usage---passing-user_id-to-anthropic}

LiteLLM 将 OpenAI 的 `user` 参数转换为 Anthropic 的 `metadata[user_id]` 参数。

<Tabs>
<TabItem value="sdk" label="SDK">

```python
response = completion(
    model="{{anthropic}}",
    messages=messages,
    user="user_123",
)
```
</TabItem>
<TabItem value="proxy" label="PROXY">

1. 设置 config.yaml

```yaml
model_list:
    - model_name: {{anthropic}}
      litellm_params:
        model: anthropic/{{anthropic}}
        api_key: os.environ/ANTHROPIC_API_KEY
```

2. 启动代理

```
litellm --config /path/to/config.yaml
```

3. 测试一下！

```bash
curl http://0.0.0.0:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR-LITELLM-KEY>" \
  -d '{
    "model": "{{anthropic}}",
    "messages": [{"role": "user", "content": "What is Anthropic?"}],
    "user": "user_123"
  }'
```

</TabItem>
</Tabs>


## 用法 - Agent Skills {#usage---agent-skills}

LiteLLM 支持通过 API 使用 Agent Skills

<Tabs>
<TabItem value="sdk" label="SDK">

```python
response = completion(
    model="{{anthropic}}",
    messages=messages,
    tools= [
        {
            "type": "code_execution_20250825",
            "name": "code_execution"
        }
    ],
    container= {
        "skills": [
            {
                "type": "anthropic",
                "skill_id": "pptx",
                "version": "latest"
            }
        ]
    }
)
```
</TabItem>
<TabItem value="proxy" label="PROXY">

1. 设置 config.yaml

```yaml
model_list:
    - model_name: {{anthropic}}
      litellm_params:
        model: anthropic/{{anthropic}}
        api_key: os.environ/ANTHROPIC_API_KEY
```

2. 启动代理

```
litellm --config /path/to/config.yaml
```

3. 测试一下！

```bash
curl --location 'http://localhost:4000/chat/completions' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer <YOUR-LITELLM-KEY>' \
--data '{
    "model": "{{anthropic}}",
    "messages": [
        {
            "role": "user",
            "content": "Hi"
        }
    ],
    "tools": [
        {
            "type": "code_execution_20250825",
            "name": "code_execution"
        }
    ],
    "container": {
        "skills": [
            {
                "type": "anthropic",
                "skill_id": "pptx",
                "version": "latest"
            }
        ]
    }
}'
```

</TabItem>
</Tabs>

容器及其“id”将出现在流式/非流式响应的“provider_specific_fields”中
