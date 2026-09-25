import Image from '@theme/IdealImage';
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# CLI - 快速开始

通过 CLI 快速设置 LiteLLM Proxy。

LiteLLM Server (LLM 网关) 管理：

* **统一接口**：以 OpenAI `ChatCompletions` 和 `Completions` 格式调用 100 多个 LLM [Huggingface/Bedrock/TogetherAI/等](/docs/proxy/quick_start#supported-llms)
* **成本跟踪**：身份验证、花费跟踪和预算 [虚拟密钥](https://docs.litellm.ai/docs/proxy/virtual_keys)
* **负载均衡**：在多个模型和同一模型的部署之间进行负载均衡 - LiteLLM 代理在负载测试期间可以处理 1.5k+ 请求/秒。

```shell
$ uv tool install 'litellm[proxy]'
```

:::warning[最低 Python 版本]
LiteLLM 1.84.0 及更高版本需要 Python {{python_min_version}} 或更高版本 (`requires-python >={{python_min_version}}`)。`uv tool install` 会自动为您配置兼容的 Python 版本。裸 `pip install 'litellm[proxy]'` 则不会；在旧的解释器上，pip 会默默地解析到 `requires-python` 仍然允许的最后一个版本（对于之前的下限是 1.83.9），而不会报错。如果您意外地固定到旧版本，请检查 `python --version` 并升级到 {{python_min_version}}+（或使用 uv），然后重新安装
:::

## 快速开始 - LiteLLM Proxy CLI {#quick-start---litellm-proxy-cli}

运行以下命令启动 litellm 代理
```shell
$ litellm --model huggingface/bigcode/starcoder

#INFO: Proxy running on http://0.0.0.0:4000
```


:::info

如果需要详细的调试日志，请使用 `--detailed_debug` 运行 

```shell
$ litellm --model huggingface/bigcode/starcoder --detailed_debug
```
:::

### 测试 {#test}
在新 shell 中运行，这将发出一个 `openai.chat.completions` 请求。请确保您使用的是 openai v1.0.0+
```shell
litellm --test
```

这现在将自动路由任何对 gpt-3.5-turbo 的请求到 bigcode starcoder，托管在 huggingface inference endpoints 上。

### 支持的 LLM {#supported-llms}
所有 LiteLLM 支持的 LLM 都在代理上受支持。查看所有[支持的 LLM](https://docs.litellm.ai/docs/providers)
<Tabs>
<TabItem value="bedrock" label="AWS Bedrock">

```shell
$ export AWS_ACCESS_KEY_ID=
$ export AWS_REGION_NAME=
$ export AWS_SECRET_ACCESS_KEY=
```

```shell
$ litellm --model bedrock/us.anthropic.{{anthropic}}
```
</TabItem>
<TabItem value="azure" label="Azure OpenAI">

```shell
$ export AZURE_API_KEY=my-api-key
$ export AZURE_API_BASE=my-api-base
```
```
$ litellm --model azure/my-deployment-name
```

</TabItem>
<TabItem value="openai" label="OpenAI">

```shell
$ export OPENAI_API_KEY=my-api-key
```

```shell
$ litellm --model {{openai_small}}
```
</TabItem>
<TabItem value="ollama" label="Ollama">

```
$ litellm --model ollama/<ollama-model-name>
```

</TabItem>
<TabItem value="openai-proxy" label="OpenAI Compatible Endpoint">

```shell
$ export OPENAI_API_KEY=my-api-key
```

```shell
$ litellm --model openai/<your model name> --api_base <your-api-base> # e.g. http://0.0.0.0:3000
```
</TabItem>

<TabItem value="vertex-ai" label="Vertex AI [Gemini]">

```shell
$ export VERTEX_PROJECT="hardy-project"
$ export VERTEX_LOCATION="us-west"
```

```shell
$ litellm --model vertex_ai/{{gemini_flash}}
```
</TabItem>

<TabItem value="huggingface" label="Huggingface (TGI) Deployed">

```shell
$ export HUGGINGFACE_API_KEY=my-api-key #[OPTIONAL]
```
```shell
$ litellm --model huggingface/<your model name> --api_base <your-api-base> # e.g. http://0.0.0.0:3000
```

</TabItem>
<TabItem value="huggingface-local" label="Huggingface (TGI) Local">

```shell
$ litellm --model huggingface/<your model name> --api_base http://0.0.0.0:8001
```

</TabItem>
<TabItem value="aws-sagemaker" label="AWS Sagemaker">

```shell
export AWS_ACCESS_KEY_ID=
export AWS_REGION_NAME=
export AWS_SECRET_ACCESS_KEY=
```

```shell
$ litellm --model sagemaker/jumpstart-dft-meta-textgeneration-llama-2-7b
```

</TabItem>
<TabItem value="anthropic" label="Anthropic">

```shell
$ export ANTHROPIC_API_KEY=my-api-key
```
```shell
$ litellm --model {{anthropic}}
```

</TabItem>
<TabItem value="vllm-local" label="VLLM">
假设您在本地运行 vllm

```shell
$ litellm --model vllm/facebook/opt-125m
```
</TabItem>
<TabItem value="together_ai" label="TogetherAI">

```shell
$ export TOGETHERAI_API_KEY=my-api-key
```
```shell
$ litellm --model together_ai/lmsys/vicuna-13b-v1.5-16k
```

</TabItem>

<TabItem value="replicate" label="Replicate">

```shell
$ export REPLICATE_API_KEY=my-api-key
```
```shell
$ litellm \
  --model replicate/meta/llama-2-70b-chat:02e509c789964a7ea8736978a43525956ef40397be9033abf9fd2badfe68c9e3
```

</TabItem>

<TabItem value="petals" label="Petals">

```shell
$ litellm --model petals/meta-llama/Llama-2-70b-chat-hf
```

</TabItem>

<TabItem value="palm" label="Palm">

```shell
$ export PALM_API_KEY=my-palm-key
```
```shell
$ litellm --model palm/chat-bison
```

</TabItem>

<TabItem value="ai21" label="AI21">

```shell
$ export AI21_API_KEY=my-api-key
```

```shell
$ litellm --model j2-light
```

</TabItem>

<TabItem value="cohere" label="Cohere">

```shell
$ export COHERE_API_KEY=my-api-key
```

```shell
$ litellm --model command-nightly
```

</TabItem>

</Tabs>

## 快速开始 - LiteLLM Proxy + Config.yaml {#quick-start---litellm-proxy--configyaml}
配置允许您创建模型列表并设置 `api_base`、`max_tokens`（所有 litellm 参数）。有关配置的更多详细信息，请参阅[此处](https://docs.litellm.ai/docs/proxy/configs)

### 为 LiteLLM Proxy 创建配置 {#create-a-config-for-litellm-proxy}
示例配置

```yaml
model_list: 
  - model_name: {{openai_small}} # user-facing model alias
    litellm_params: # all params accepted by litellm.completion() - https://docs.litellm.ai/docs/completion/input
      model: azure/<your-deployment-name>
      api_base: <your-azure-api-endpoint>
      api_key: <your-azure-api-key>
  - model_name: {{openai_small}}
    litellm_params:
      model: azure/gpt-turbo-small-ca
      api_base: https://my-endpoint-canada-berri992.openai.azure.com/
      api_key: <your-azure-api-key>
  - model_name: vllm-model
    litellm_params:
      model: openai/<your-model-name>
      api_base: <your-vllm-api-base> # e.g. http://0.0.0.0:3000/v1
      api_key: <your-vllm-api-key|none>
```

### 使用配置运行代理 {#run-proxy-with-config}

```shell
litellm --config your_config.yaml
```


## 使用 LiteLLM Proxy - Curl 请求、OpenAI 包、Langchain {#using-litellm-proxy---curl-request-openai-package-langchain}

:::info
LiteLLM 兼容多种 SDK - 包括 OpenAI SDK、Anthropic SDK、Mistral SDK、LLamaIndex、Langchain (Js, Python)

[更多示例在此](user_keys)
:::

<Tabs>
<TabItem value="Curl" label="Curl Request">

```shell
curl --location 'http://0.0.0.0:4000/chat/completions' \
--header 'Content-Type: application/json' \
--data ' {
      "model": "{{openai_small}}",
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
response = client.chat.completions.create(model="{{openai_small}}", messages = [
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
    model = "{{openai_small}}",
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
<TabItem value="langchain-embedding" label="Langchain Embeddings">

```python
from langchain.embeddings import OpenAIEmbeddings

embeddings = OpenAIEmbeddings(model="sagemaker-embeddings", openai_api_base="http://0.0.0.0:4000", openai_api_key="temp-key")


text = "This is a test document."

query_result = embeddings.embed_query(text)

print(f"SAGEMAKER EMBEDDINGS")
print(query_result[:5])

embeddings = OpenAIEmbeddings(model="bedrock-embeddings", openai_api_base="http://0.0.0.0:4000", openai_api_key="temp-key")

text = "This is a test document."

query_result = embeddings.embed_query(text)

print(f"BEDROCK EMBEDDINGS")
print(query_result[:5])

embeddings = OpenAIEmbeddings(model="bedrock-titan-embeddings", openai_api_base="http://0.0.0.0:4000", openai_api_key="temp-key")

text = "This is a test document."

query_result = embeddings.embed_query(text)

print(f"TITAN EMBEDDINGS")
print(query_result[:5])
```
</TabItem>
<TabItem value="litellm" label="LiteLLM SDK">

这是**不推荐**的。由于代理也使用 SDK，因此存在重复逻辑，这可能导致意外错误。

```python
from litellm import completion 

response = completion(
    model="openai/{{openai_small}}", 
    messages = [
        {
            "role": "user",
            "content": "this is a test request, write a short poem"
        }
    ], 
    api_key="anything", 
    base_url="http://0.0.0.0:4000"
    )

print(response)

```
</TabItem>

<TabItem value="anthropic-py" label="Anthropic Python SDK">

```python
import os

from anthropic import Anthropic

client = Anthropic(
    base_url="http://localhost:4000", # proxy endpoint
    api_key="sk-test-proxy-key-123", # litellm proxy virtual key (example)
)

message = client.messages.create(
    max_tokens=1024,
    messages=[
        {
            "role": "user",
            "content": "Hello, Claude",
        }
    ],
    model="{{anthropic}}",
)
print(message.content)
```

</TabItem>

</Tabs>

[**更多信息**](./configs.md)



## 📖 代理端点 - [Swagger 文档](https://docs.litellm.ai/api-reference/) {#-proxy-endpoints---swagger-docs}
- POST `/chat/completions` - 调用 100 多个 LLM 的聊天补全端点
- POST `/completions` - 补全端点
- POST `/embeddings` - 适用于 Azure、OpenAI、Huggingface 端点的嵌入端点
- GET `/models` - 服务器上可用的模型
- POST `/key/generate` - 生成访问代理的密钥


## 调试代理 {#debugging-proxy}

正常操作期间发生的事件
```shell
litellm --model {{openai_small}} --debug
```

详细信息
```shell
litellm --model {{openai_small}} --detailed_debug
```

### 使用环境变量设置调试级别 {#set-debug-level-using-env-variables}

正常操作期间发生的事件
```shell
export LITELLM_LOG=INFO
```

详细信息
```shell
export LITELLM_LOG=DEBUG
```

仅错误
```shell
export LITELLM_LOG=ERROR
```

`LITELLM_LOG` 必须是一个有效的 Python 日志级别 (`DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL`)。将其设置为 `None` 会导致 `import litellm` 失败。
