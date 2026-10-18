# Ace Data Cloud 模型接入

[English](./acedatacloud.md)

使用 [Ace Data Cloud](https://platform.acedata.cloud?utm_source=opensource&utm_medium=referral&utm_campaign=evergreen&utm_content=litellm_provider_zh_docs) 的业务 API Key，通过 LiteLLM 调用 Chat Completions 和 Responses。音乐、视频、图片使用独立的 [媒体 MCP 指南](../mcp_servers/acedatacloud_zh.md)。

## 安装与版本

```bash
python -m pip install 'litellm[proxy]'
```

按照 [Proxy 快速开始](https://docs.litellm.ai/docs/proxy/quick_start) 启动自己的部署并登录管理界面。原生 `acedatacloud/` 前缀和 **Ace Data Cloud** 服务商选项需要包含 [Provider 集成](https://github.com/BerriAI/litellm/pull/44817) 的 LiteLLM 版本；安装旧版稳定包不会自动获得候选实现。

尚未包含该集成的版本可参照 [OpenAI-compatible provider](https://docs.litellm.ai/docs/providers/openai_compatible)，使用 `openai/gpt-6-luna`、显式 API Key、`api_base="https://api.acedata.cloud/openai"`，并从当前公开模型目录设置自定义价格。没有 Credit-cost 修复的旧版本可能无法序列化结构化 `usage.cost`，使用前需验证响应序列化与费用设置。

## 注册并获取专用 Key

打开 [Ace Applications](https://platform.acedata.cloud/console/applications?utm_source=opensource&utm_medium=referral&utm_campaign=evergreen&utm_content=litellm_provider_zh_docs_api_key)，注册或登录。没有通用应用时点击 **Initialize General Application**，再打开 **General application**。确认账号已开通 OpenAI 服务、所选模型可用，并检查余额和 [当前价格](https://platform.acedata.cloud/models?utm_source=opensource&utm_medium=referral&utm_campaign=evergreen&utm_content=litellm_provider_zh_docs_pricing)。

可直接复制业务 API Key，也可点击 **Manage Keys → Create** 创建名为 `LiteLLM models` 的专用 Key。按需要设置到期时间、消费限额和 API 权限；服务专用应用 Key 仅适用于对应服务。使用业务调用凭据，平台管理接口的 Account Token 和 LiteLLM 的 proxy master key 都不能替代它。填写原始 Token 字符串，不带 `Bearer ` 前缀或引号。

![真实 Ace 控制台：复制业务 Key 或进入 Manage Keys](https://raw.githubusercontent.com/AceDataCloud/SunoDify/8d3d03570e73324220f111f7fe343da0792a8071/_assets/tutorial/get-api-key-en.png)

![真实 Ace 控制台：创建独立业务 Key](https://raw.githubusercontent.com/AceDataCloud/SunoDify/8d3d03570e73324220f111f7fe343da0792a8071/_assets/tutorial/create-api-key-en.png)

图片来自固定版本 `8d3d0357` 的 Suno Dify 指南，真实凭据已遮挡，展示共享的 Ace 控制台操作。图中的示例名称为 `Dify tutorial`，此处改填 `LiteLLM models`；不要复制图中遮挡字符。这些图不代表已完成 LiteLLM 鉴权。

## 在管理界面添加模型

依次打开 **Models + Endpoints → Add Model**，搜索并选择 **Ace Data Cloud**，选择 `acedatacloud/gpt-6-luna`，将自己的业务 Key 填入 **API Key**。

![真实候选界面：选择 Ace Data Cloud](/img/acedatacloud/litellm-ace-provider-selected.jpg)

![真实候选界面：模型映射与 API Key 输入位置](/img/acedatacloud/litellm-ace-provider-model-empty-key.jpg)

两张图于 2026-10-18 在精确 Provider 源码 `e6e760b8` 上，经正常本地产品登录拍摄。图中版本号 `v1.105.1` 来自依赖 wheel metadata，不能证明官方 1.105.1 已含此 Provider。拍摄时 Key 为空，没有 Test Connect 或 Add Model，因此不证明凭据存储、调用结果或账单。

确认模型权限、余额与当次费用后，再测试并保存自己的配置。API 基址为 `https://api.acedata.cloud/openai`；LiteLLM 追加 `/chat/completions` 或 `/responses`。不要把媒体 MCP 的 `/mcp` 地址填到模型 API 基址。

## 首次调用

在部署的秘密管理中设置业务 Key。以下模型请求可能计费，运行前检查所选模型当前价格和预算。

```bash
export ACEDATACLOUD_API_KEY="your-api-token"
```

```python keep-model-ids
from litellm import completion

response = completion(
    model="acedatacloud/gpt-6-luna",
    messages=[{"role": "user", "content": "Reply with exactly OK."}],
    reasoning_effort="none",
    max_completion_tokens=64,
)
print(response.choices[0].message.content)
```

Responses 使用同一凭据：

```python keep-model-ids
from litellm import responses

response = responses(
    model="acedatacloud/gpt-6-luna",
    input="Reply with exactly OK.",
    reasoning={"effort": "none"},
    max_output_tokens=64,
)
print(response.output)
```

`gpt-6-luna` 支持 `none`、`low`、`medium`、`high`、`xhigh`、`max`，不支持 `minimal`。流式 Chat 请求可加 `stream=True` 和 `stream_options={"include_usage": True}`，逐块读取响应。标准文本调用按响应返回结果；异步媒体任务需按 [媒体指南](../mcp_servers/acedatacloud_zh.md#首次使用与同一任务查询) 保存并查询同一任务 ID。

## Proxy 配置

把以下内容保存为 `config.yaml`。业务 Key 与 LiteLLM proxy master key 使用不同变量。

```yaml keep-model-ids
model_list:
  - model_name: ace-gpt-6-luna
    litellm_params:
      model: acedatacloud/gpt-6-luna
      api_key: os.environ/ACEDATACLOUD_API_KEY

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

```bash
export LITELLM_MASTER_KEY="sk-$(openssl rand -hex 32)"
litellm --config config.yaml --port 4000
```

```bash keep-model-ids
curl http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"model":"ace-gpt-6-luna","messages":[{"role":"user","content":"Reply with exactly OK."}],"reasoning_effort":"none","max_completion_tokens":64}'
```

同一部署接受 `/v1/responses`，请求示例见 [英文完整配置](./acedatacloud.md#litellm-proxy)。

## 价格与排错

Ace 按 Credits 结算，USD 换算为 `Credits × 当前套餐价格 / 套餐 Credits 数量`。LiteLLM 初始价格来自公开完整 cost 规则及 2026-10-06 核实的入门套餐 USD 7 / 40 Credits；其他充值套餐或折扣的实际汇率不同。变更时读取 [当前模型目录](https://platform.acedata.cloud/api/v1/models/catalog/)，按 [自定义价格](https://docs.litellm.ai/docs/proxy/custom_pricing) 配置。结构化 `usage.cost` 是 Credits，不能直接作为 LiteLLM 数值 USD 费用；集成保留 token usage 并按模型目录估算 USD。

| 现象 | 检查方法 |
| --- | --- |
| 找不到 Ace Data Cloud | 检查已安装版本是否包含 Provider 集成；候选截图不能证明稳定包已发布。 |
| 401 | 分别检查请求 LiteLLM 的 proxy key 和下游业务 Key；不要误用 Account Token 或重复添加 Bearer。 |
| 403 | 阅读原始错误，分别检查服务/API 权限、Key 限制和内容审核。 |
| 429 | 降低并发并等待，不盲目开启重复计费重试。 |
| 5xx 或序列化失败 | 保留请求 ID 和已遮挡日志；检查 Credit-cost 修复和版本，再决定是否重试。 |
| 模型不支持或费用不符 | 查当前模型能力、完整 cost 规则、套餐汇率及自定义价格。 |

不要在提示词、代码、导出配置或截图中暴露 Key。可在 [Applications](https://platform.acedata.cloud/console/applications?utm_source=opensource&utm_medium=referral&utm_campaign=evergreen&utm_content=litellm_provider_zh_docs_rotate) 单独撤销或轮换专用 Key。
