---
title: "1.103.0rc1 - 配置文件所有权、Fuse 路由与网关强化"
slug: "v1-103-0-rc-1"
date: 2026-09-20T03:08:52
authors:
  - name: Krrish Dholakia
    title: CEO, LiteLLM
    url: https://www.linkedin.com/in/krish-d/
    image_url: https://pbs.twimg.com/profile_images/1298587542745358340/DZv3Oj-h_400x400.jpg
  - name: Ishaan Jaff
    title: CTO, LiteLLM
    url: https://www.linkedin.com/in/reffajnaahsi/
    image_url: https://pbs.twimg.com/profile_images/1613813310264340481/lz54oEiB_400x400.jpg
  - name: Yuneng Jiang
    title: Senior Full Stack Engineer, LiteLLM
    url: https://www.linkedin.com/in/yuneng-david-jiang-455676139/
    image_url: https://avatars.githubusercontent.com/u/171294688?v=4
hide_table_of_contents: false
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

## 部署此版本 {#deploy-this-version}

<Tabs>
<TabItem value="docker" label="Docker">

```bash
docker run \
-e LITELLM_MASTER_KEY=sk-<paste-a-long-random-key> \
-e DATABASE_URL=postgresql://<user>:<password>@<host>:5432/<dbname> \
-e STORE_MODEL_IN_DB=True \
-p 4000:4000 \
docker.litellm.ai/berriai/litellm:1.103.0-rc.1
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.103.0rc1
```

</TabItem>
</Tabs>

已发布的 GitHub 标签是 `v1.103.0-rc.1`。这些说明将其与 `v1.102.0-rc.1`（从 `main` 分支切出的上一个候选版本）进行比较。已回溯到 `rc/1.102.0` 并已在 `v1.102.0` 中发布的更改将被省略

:::danger[破坏性变更]

这些标注涵盖了 `v1.102.0`（最新稳定版本）中可用的行为变更

**配置文件现在拥有其声明的每个设置，数据库不再覆盖它。** 一条规则取代了数据库优先、配置优先和合并优先的混合键处理方式：如果 `config.yaml` 声明了一个键，则该文件拥有它，并且对该键的运行时写入将被拒绝，并返回 400 错误，指出要编辑的文件，而不是被存储并静默忽略。这涵盖了 `POST /config/field/update`、`POST /config/field/delete`、`POST /config/update` 以及 `allowed_ips` 路由。文件未包含的键仍然来自数据库并保持可编辑状态。`GET /config/field/info` 和 `GET /config/list` 现在通过相同的存储解析并报告 `source` 和 `editable`，并且配置拥有的字段会报告文件声明的值，因此 `os.environ/...` 引用会按原样返回，而不是被解析。在管理界面 (Admin UI) 中，配置拥有的字段会显示为只读。启动时会针对每个被忽略的存储数据库值键发出一次警告，拒绝信息会包含相同的语句以及 `stored_database_value_ignored: true`。将您在运行时编辑的任何设置移出配置文件，或者编辑文件并重新启动。参见 [PR #41779](https://github.com/BerriAI/litellm/pull/41779)、[PR #41862](https://github.com/BerriAI/litellm/pull/41862)、[PR #41868](https://github.com/BerriAI/litellm/pull/41868)、[PR #41931](https://github.com/BerriAI/litellm/pull/41931)、[PR #41985](https://github.com/BerriAI/litellm/pull/41985)、[PR #42009](https://github.com/BerriAI/litellm/pull/42009)

**预算会在每个路由回退 (fallback) 目标上重新检查。** 从免费模型开始并回退到付费模型的请求现在会在回退时被限制，调用者无法支付的目标将被跳过而不是被服务。主要尝试保持不变。依赖免费主模型将超出预算的密钥带到付费回退的工作流现在将收到下一个可负担的目标或预算错误。参见 [PR #41379](https://github.com/BerriAI/litellm/pull/41379)

**组织或项目的 `max_budget` 为 0 现在表示零额度，而不是无限制。** 这与现有的密钥、团队和用户语义相匹配。将 `max_budget` 设置为 `null` 表示无限制。参见 [PR #41271](https://github.com/BerriAI/litellm/pull/41271)、[PR #41997](https://github.com/BerriAI/litellm/pull/41997)

**密钥自己的每模型 RPM/TPM 覆盖现在优先于团队的每模型限制。** 文档中记载的优先级（密钥元数据优先于团队元数据）现在在聊天、批处理和 `/cost/predict-cache` 上得到了代码实现。仅覆盖 RPM 的密钥仍将强制执行团队 TPM 池，反之亦然。审查那些依赖每模型团队上限来限制声明自己上限的密钥的团队。参见 [PR #41302](https://github.com/BerriAI/litellm/pull/41302)

**委托的 MCP OAuth 需要准入。** 未被 LiteLLM 准入的旧版委托 MCP 集成现在会收到 401 错误，直到它们被准入或迁移到 `oauth_delegate`。参见 [PR #40923](https://github.com/BerriAI/litellm/pull/40923)

**`CustomLogger` 审核回调现在会拒绝请求。** `llm_api_check` 审核通过 `during_call_hook` 分派，因此被标记的请求现在返回 400，而之前返回 200。参见 [PR #41685](https://github.com/BerriAI/litellm/pull/41685)

**Bedrock Realtime 需要 `aws-sdk-bedrock-runtime` 0.10 或 0.11。** 版本锁定已移至 `aws-sdk-bedrock-runtime[awscrt]>=0.10.0,<0.12.0`；0.7.x 不再受支持，并且初始化错误现在可以区分缺失的 SDK 和不受支持的版本。Nova Sonic 会话将失败，直到操作员安装带有 `awscrt` 额外依赖项的受支持 SDK。参见 [PR #41542](https://github.com/BerriAI/litellm/pull/41542)

**`/v1/rag/ingest` 解析已注册的存储并拒绝没有摄取 (ingestion) 功能的提供商。** 通过 ID 命名已注册存储的请求现在使用该存储的提供商和 `litellm_params`，而不是默认使用 OpenAI Files，只有每个上传选项会从调用者处保留，并且没有摄取实现的提供商会返回 400 错误，指出支持的提供商，而不是返回 `status: failed` 的 200 错误或 500 错误。参见 [PR #41940](https://github.com/BerriAI/litellm/pull/41940)

**Capability 和 Fuse v2 路由器在没有许可证的情况下，每种类型都限制为一个。** 注册第二台任一分类器的路由器将返回 403 错误，并指出 `auto_router` 权益。现有路由器不受影响。参见 [PR #41326](https://github.com/BerriAI/litellm/pull/41326)

**通过 v1.102 之前的管理界面 (Admin UI) 编辑复制到 `model_info` 中的定价将被忽略。** 存储的 `model_info` blob，如果其价格旁边带有 `key` 字段，则被视为复制的 `/model/info` 响应，因此该行将再次遵循成本映射并在下次保存时修复。在 `litellm_params` 中声明的自定义定价，或没有 `key` 字段的定价，将不受影响。`/model/info` 现在报告 `model_info.pricing_overrides`。参见 [PR #41843](https://github.com/BerriAI/litellm/pull/41843)

**`litellm-proxy` 入口点已被弃用，推荐使用 `lite`。** 它仍然可以运行，但在标准错误输出 (stderr) 上会打印一行弃用信息。`lite autoroute up` 和 `down` 已重命名为 `start` 和 `stop`，旧名称保留为已弃用的别名。参见 [PR #41673](https://github.com/BerriAI/litellm/pull/41673)、[PR #41672](https://github.com/BerriAI/litellm/pull/41672)

**重复失败的管理界面 (Admin UI) 登录尝试会被限流**，并且 `lite login` 会话 token 会根据实时用户和团队行重新检查，因此，被移除的成员会收到 403 错误，已删除的用户会收到 401 错误，而降级的管理员在缓存窗口过后的下一次请求中会失去管理路由权限。参见 [PR #40982](https://github.com/BerriAI/litellm/pull/40982)、[PR #40657](https://github.com/BerriAI/litellm/pull/40657)

:::

## 主要亮点 {#key-highlights}

- **配置文件所有权**：所有设置界面统一的优先级规则，在两个读取端点上都有 `source` 和 `editable` 标志，管理界面 (Admin UI) 中的只读字段，以及启动时警告，列出文件忽略的每个存储值
- **Fuse 和能力路由**：一个能力分类器，能力预测后的 Fuse V2，每个模型的快速模式，维护的 Fuse 模型和测试预设，将 TypeSafe Jev 作为复杂性分类器，以及路由详情中的启发式 v2 分数估计
- **网关强化**：MCP 客户端白名单，具有管理员强制关闭功能的实时会话可见性，委托 OAuth 准入，用于 IdP JWT 的 RFC 8693 token 交换，以及每个颁发者的 JWT 密钥范围
- **花费和预算正确性**：按成员划分的组织花费，累加执行的项目预算，具有密钥覆盖的团队级 `model_max_budget`，临时预算增加，密钥的终生 `total_spend`，以及在回退 (fallback) 目标上重新检查预算
- **408 个新的模型目录条目**：在 OpenRouter、AIHubMix、Azure、Together AI、Vertex AI、Deepgram 等平台上的新增，以及 147 项价格修正

## 新增提供商和端点 {#new-providers-and-endpoints}

### 扩展的提供商端点支持 {#expanded-provider-endpoint-support}

| 提供商 | 端点 | 您可以做什么 |
| --- | --- | --- |
| [NVIDIA NIM](../../docs/providers/nvidia_nim) | `/nvidia_nim/*` | 通过直通路由访问 NIM 对象检测和 OCR `/v1/infer` |
| [Amazon Transcribe](../../docs/pass_through/transcribe) | `/transcribe/*` | 通过直通路由提交转录作业，并按完成时间计费 |
| [Deepgram](../../docs/pass_through/deepgram_listen_websocket) | `/v1/listen` | 通过 WebSocket 直通流式传输音频，并按时长跟踪成本 |
| [Azure AI Speech](../../docs/pass_through/azure_speech) | `/azure/speech/*` | 通过直通路由访问 Azure AI Speech |
| [xAI](../../docs/providers/xai) | `/v1/audio/transcriptions` | 使用 Grok Voice Transcribe 转录音频 |
| [Vertex AI](../../docs/providers/vertex) | `/v1/realtime` | 通过实时 API 流式传输 Chirp 语音转文本 |
| [Hosted vLLM](../../docs/providers/vllm) | `/v1/batches` | 在 LiteLLM 内部针对托管的 vLLM 部署运行批处理 |
| [Mistral](../../docs/pass_through/mistral) | `/v1/files`, `/v1/batches` | 提交 Mistral 文件和批处理，并按页跟踪 OCR 批处理成本 |
| [AWS Textract](../../docs/providers/bedrock) | `/v1/ocr` | 通过 Rust OCR 路径上的 Textract 运行 OCR |
| [Microsoft Foundry](../../docs/providers/azure_ai) | `/a2a/*` | 通过 Entra 认证和版本化卡片发现访问 Foundry 代理 |
| [TypeSafe AI](../../docs/pass_through/typesafe) | `/typesafe/*` | 通过注册表定价的花费跟踪访问 Jev 评估端点 |

## 新模型 / 更新模型 {#new-models--updated-models}

#### 新模型支持 (408 个新模型) {#new-model-support-408-new-models}

计数表示新的目录标识符，包括别名和区域变体。以下价格是此版本中包含的值，以美元计；运行时定价图重新加载可以更新它们。输入和输出列显示基本 token 费率；长上下文、缓存、图像 token 和其他特殊费率取决于模型。

| 提供商 | 模型 | 上下文窗口 | 输入 ($/1M token) | 输出 ($/1M token) | 功能 / 特殊定价 |
| --- | --- | --- | --- | --- | --- |
| AIHubMix | `aihubmix/agnes-2.5-flash` | 512,000 | $0.03 | $0.15 | 聊天; 推理; 视觉 |
| AIHubMix | `aihubmix/agnes-2.5-pro` | 1,000,000 | $0.45 | $0.9 | 聊天; 推理; 视觉; 提示词缓存 |
| AIHubMix | `aihubmix/cc-glm-5.1` | 200,000 | $0.06 | $0.22 | 聊天; 推理; 工具调用; 结构化输出 |
| AIHubMix | `aihubmix/claude-fable-5` | 1,000,000 | $11 | $55 | 聊天; 推理; 视觉; 工具调用; 提示词缓存; 结构化输出 |
| AIHubMix | `aihubmix/claude-haiku-4-5` | 200,000 | $1.1 | $5.5 | 聊天; 推理; 视觉; 工具调用; 提示词缓存; 结构化输出 |
| AIHubMix | `aihubmix/claude-opus-4-8-think` | 1,000,000 | $5 | $25 | 聊天; 推理; 视觉; 工具调用; 提示词缓存; 结构化输出 |
| AIHubMix | `aihubmix/claude-opus-5` | 1,000,000 | $5 | $25 | 聊天; 推理; 视觉; 工具调用; 提示词缓存; 结构化输出; 网络搜索 |
| AIHubMix | `aihubmix/claude-sonnet-5` | 1,000,000 | $2 | $10 | 聊天; 推理; 视觉; 工具调用; 提示词缓存; 结构化输出 |
| AIHubMix | `aihubmix/coding-glm-5.3` | 1,048,576 | $0.06 | $0.22 | 聊天; 推理; 工具调用; 提示词缓存; 结构化输出 |
| AIHubMix | `aihubmix/coding-kimi-k3` | 1,048,576 | $0.44 | $1.61333 | 聊天; 推理; 视觉; 工具调用; 提示词缓存; 结构化输出 |
| AIHubMix | `aihubmix/coding-xiaomi-mimo-v2-omni` | - | $0.08 | $0.4 | 聊天; 推理; 视觉; 工具调用; 提示词缓存; 结构化输出 |
| AIHubMix | `aihubmix/coding-xiaomi-mimo-v2.5` | 1,048,576 | $0.08 | $0.16 | 聊天; 推理; 视觉; 工具调用; 提示词缓存; 结构化输出 |
| AIHubMix | `aihubmix/coding-xiaomi-mimo-v2.5-pro` | 1,048,576 | $0.2 | $0.4 | 聊天; 推理; 工具调用; 提示词缓存; 结构化输出 |
| AIHubMix | `aihubmix/command-a-plus-05-2026` | 128,000 | $2.5 | $10 | 聊天; 推理; 视觉; 工具调用; 结构化输出 |
| AIHubMix | `aihubmix/deepseek-v4-flash` | 1,000,000 | $0.142 | $0.284 | 聊天; 推理; 工具调用; 提示词缓存; 结构化输出 |
| AIHubMix | `aihubmix/deepseek-v4-pro` | 1,000,000 | $1.69 | $3.38 | 聊天; 推理; 工具调用; 提示词缓存; 结构化输出 |
| AIHubMix | `aihubmix/doubao-seed-2-0-code-preview` | 256,000 | $0.4822 | $2.411 | 聊天; 推理; 视觉; 工具调用; 提示词缓存; 网络搜索 |
| AIHubMix | `aihubmix/doubao-seed-2-0-lite-260428` | 256,000 | $0.09041 | $0.54246 | 聊天; 推理; 视觉; 工具调用; 提示词缓存; 结构化输出; 网络搜索 |
| AIHubMix | `aihubmix/doubao-seed-2-0-mini` | 256,000 | $0.030136 | $0.30136 | 聊天; 推理; 视觉; 工具调用; 提示词缓存; 结构化输出; 网络搜索 |
| AIHubMix | `aihubmix/doubao-seed-2-0-pro` | 256,000 | $0.4822 | $2.411 | 聊天; 推理; 视觉; 工具调用; 提示词缓存; 结构化输出; 网络搜索 |
| AIHubMix | `aihubmix/doubao-seed-2-1-turbo` | 256,000 | $0.46475 | $2.32375 | 聊天; 推理; 视觉; 工具调用; 提示词缓存; 结构化输出; 网络搜索 |
| AIHubMix | `aihubmix/ernie-5.1` | 119,000 | $0.5634 | $2.5353 | 聊天; 推理; 提示词缓存 |
| AIHubMix | `aihubmix/gemini-3-flash-preview` | 1,048,576 | $0.5 | $3 | 聊天; 推理; 视觉; 工具调用; 提示词缓存; 结构化输出; 网络搜索 |
| AIHubMix | `aihubmix/gemini-3-flash-preview-search` | 1,048,576 | $0.5 | $3 | 聊天; 推理; 视觉; 工具调用; 提示词缓存; 结构化输出; 网络搜索 |
| AIHubMix | `aihubmix/gemini-3.1-pro-preview` | 1,048,576 | $2 | $12 | 聊天; 推理; 视觉; 工具调用; 提示词缓存; 结构化输出; 网络搜索 |
| AIHubMix | `aihubmix/gemini-3.1-pro-preview-customtools` | 1,048,576 | $2 | $12 | 聊天; 推理; 视觉; 工具调用; 提示词缓存; 结构化输出; 网络搜索 |
| AIHubMix | `aihubmix/gemini-3.5-flash-lite` | 1,048,576 | $0.3 | $2.499999 | 聊天; 推理; 视觉; 工具调用; 提示词缓存; 结构化输出; 网络搜索 |
| AIHubMix | `aihubmix/gemini-3.7-flash` | 1,048,576 | $0.75 | $3.75 | 聊天; 推理; 视觉; 工具调用; 提示词缓存; 结构化输出; 网络搜索 |
| AIHubMix | `aihubmix/gemma-4-26b-a4b-it` | 262,144 | $0.14 | $0.39998 | 聊天; 推理; 视觉 |
| AIHubMix | `aihubmix/gemma-4-31b-it` | 262,144 | $0.14 | $0.39998 | 聊天; 推理; 视觉 |
| AIHubMix | `aihubmix/glm-5.2-fast-preview` | 1,000,000 | $2.254 | $7.889 | 聊天; 推理; 工具调用; 提示词缓存; 结构化输出 |
| AIHubMix | `aihubmix/glm-5.3` | 1,048,576 | $1.1268 | $3.9438 | 聊天; 推理; 工具调用; 提示词缓存; 结构化输出 |
| AIHubMix | `aihubmix/glm-5.3-flash` | 1,048,576 | $0.11268 | $0.39438 | 聊天; 推理; 视觉; 工具调用; 提示词缓存; 结构化输出 |
| AIHubMix | `aihubmix/glm-5v-turbo` | 200,000 | $0.7042 | $3.09848 | 聊天; 推理; 视觉; 提示词缓存 |
| AIHubMix | `aihubmix/gpt-5.3-codex` | 400,000 | $1.75 | $14 | 聊天; 推理; 视觉; 工具调用; 提示词缓存; 结构化输出 |
| AIHubMix | `aihubmix/gpt-5.4-high` | 1,050,000 | $2.5 | $15 | 聊天; 推理; 视觉; 工具调用; 提示词缓存; 结构化输出; 网络搜索 |
| AIHubMix | `aihubmix/gpt-5.4-low` | 1,050,000 | $2.5 | $15 | 聊天; 推理; 视觉; 工具调用; 提示词缓存; 结构化输出; 网络搜索 |
| AIHubMix | `aihubmix/gpt-5.4-mini` | 400,000 | $0.75 | $4.5 | 聊天; 推理; 视觉; 工具调用; 提示词缓存; 结构化输出; 网络搜索 |
| AIHubMix | `aihubmix/gpt-5.4-nano` | 400,000 | $0.2 | $1.25 | 聊天; 推理; 视觉; 工具调用; 提示词缓存; 结构化输出; 网络搜索 |
| AIHubMix | `aihubmix/gpt-5.5` | 1,050,000 | $5 | $30 | 聊天; 推理; 视觉; 工具调用; 提示词缓存; 结构化输出; 网络搜索 |
| AIHubMix | `aihubmix/gpt-5.5-pro` | 1,050,000 | $30 | $180 | 聊天; 推理; 视觉; 工具调用; 结构化输出; 网络搜索 |
| AIHubMix | `aihubmix/gpt-5.6-luna` | 1,050,000 | $0.2 | $1.2 | 聊天; 推理; 视觉; 工具调用; 提示词缓存; 结构化输出 |
| AIHubMix | `aihubmix/gpt-5.6-sol-disc` | 1,050,000 | $4 | $20 | 聊天; 推理; 视觉; 工具调用; 提示词缓存; 结构化输出 |
| AIHubMix | `aihubmix/gpt-5.6-terra` | 1,050,000 | $2 | $12 | 聊天; 推理; 视觉; 工具调用; 提示词缓存; 结构化输出 |
| AIHubMix | `aihubmix/gpt-chat-latest` | 400,000 | $5 | $30 | 聊天; 推理; 视觉; 工具调用; 提示词缓存; 结构化输出; 网络搜索 |
| AIHubMix | `aihubmix/grok-4-20-non-reasoning` | 1,000,000 | $2 | $6 | 聊天; 推理; 视觉; 工具调用; 提示词缓存; 结构化输出 |
| AIHubMix | `aihubmix/grok-4-20-reasoning` | 1,000,000 | $2 | $6 | 聊天; 推理; 视觉; 工具调用; 提示词缓存; 结构化输出 |
| AIHubMix | `aihubmix/grok-4.6` | 500,000 | $2 | $6 | 聊天; 推理; 视觉; 工具调用; 提示词缓存; 结构化输出 |
| AIHubMix | `aihubmix/grok-build-0.1` | 256,000 | $1 | $2 | 聊天; 推理; 视觉; 工具调用; 提示词缓存; 结构化输出 |
| AIHubMix | `aihubmix/hy3` | 256,000 | $0.1562 | $0.6248 | 聊天; 推理; 工具调用; 提示词缓存; 结构化输出; 网络搜索 |
| AIHubMix | `aihubmix/hy4-preview` | 1,048,576 | $0.845 | $2.535 | 聊天; 推理; 工具调用; 提示词缓存; 结构化输出; 网络搜索 |
| AIHubMix | `aihubmix/kimi-k2.6` | 262,144 | $0.95 | $3.9995 | 聊天; 推理; 视觉; 工具调用; 提示词缓存; 结构化输出 |
| AIHubMix | `aihubmix/kimi-k2.7-code-highspeed` | 262,144 | $1.9 | $7.999 | 聊天; 推理; 视觉; 工具调用; 提示词缓存; 结构化输出 |
| AIHubMix | `aihubmix/kimi-k3` | 1,048,576 | $3 | $15 | 聊天; 推理; 视觉; 工具调用; 提示词缓存; 结构化输出 |
| AIHubMix | `aihubmix/longcat-2.0` | 1,000,000 | $0.7746 | $3.0984 | 聊天; 推理; 工具调用; 提示词缓存 |
| AIHubMix | `aihubmix/mai-thinking-1` | 256,000 | $2 | $8 | 聊天; 推理; 结构化输出 |
| AIHubMix | `aihubmix/mimo-v2-omni` | 256,000 | $0.44 | $2.2 | 聊天; 视觉; 提示词缓存; 网络搜索 |
| AIHubMix | `aihubmix/mimo-v2-pro` | 1,000,000 | $1.1 | $3.3 | 聊天; 提示词缓存; 网络搜索 |
| AIHubMix | `aihubmix/minimax-m2.7` | 204,800 | $0.2958 | $1.1832 | 聊天; 推理; 工具调用; 提示词缓存; 结构化输出 |
| AIHubMix | `aihubmix/minimax-m3` | 1,000,000 | $0.288 | $1.152 | 聊天; 推理; 视觉; 工具调用; 结构化输出 |
| AIHubMix | `aihubmix/muse-spark-1.2` | 1,048,576 | $1.375 | $4.675 | 聊天; 推理; 视觉; 工具调用 |
| AIHubMix | `aihubmix/qwen3-coder-next` | 262,144 | $0.137 | $0.548 | 聊天; 工具调用; 结构化输出 |
| AIHubMix | `aihubmix/qwen3.5-122b-a10b` | 262,144 | $0.1126 | $0.9008 | 聊天; 推理; 视觉; 工具调用; 结构化输出; 网络搜索 |
| AIHubMix | `aihubmix/qwen3.5-397b-a17b` | 262,144 | $0.1644 | $0.9864 | 聊天; 推理; 视觉; 工具调用; 结构化输出; 网络搜索 |
| AIHubMix | `aihubmix/qwen3.6-27b` | 262,144 | $0.422 | $2.532 | 聊天; 推理; 视觉; 工具调用; 结构化输出; 网络搜索 |
| AIHubMix | `aihubmix/qwen3.6-35b-a3b` | 262,144 | $0.254 | $1.524 | 聊天; 推理; 视觉; 工具调用; 结构化输出; 网络搜索 |
| AIHubMix | `aihubmix/qwen3.6-max-preview` | 262,144 | $1.268 | $7.608 | 聊天; 推理; 工具调用; 提示词缓存; 结构化输出; 网络搜索 |
| AIHubMix | `aihubmix/qwen3.7-plus` | 1,000,000 | $0.282 | $1.128 | 聊天; 推理; 视觉; 工具调用; 提示词缓存; 结构化输出; 网络搜索 |
| AIHubMix | `aihubmix/qwen3.8-2.4t-a95b` | 1,000,000 | $2 | $6 | 聊天; 推理; 工具调用; 提示词缓存; 结构化输出; 网络搜索 |
| AIHubMix | `aihubmix/qwen3.8-flash` | 1,000,000 | $0.1126 | $0.380025 | 聊天; 推理; 视觉; 工具调用; 提示词缓存; 结构化输出; 网络搜索 |
| AIHubMix | `aihubmix/qwen3.8-max` | 1,000,000 | $1.69 | $5.07 | 聊天; 推理; 视觉; 工具调用; 提示词缓存; 结构化输出; 网络搜索 |
| AIHubMix | `aihubmix/step-3.7-flash` | 256,000 | $0.22 | $1.32 | 聊天; 推理; 视觉; 提示词缓存 |
| Amazon Bedrock | `writer.palmyra-vision-7b` | 4,096 | $0.15 | $0.6 | 聊天; 视觉 |
| Amazon Transcribe | `transcribe/StartTranscriptionJob` | - | - | - | 转录; `input_cost_per_second`: $0.0001; `output_cost_per_second`: $0 |
| Azure AI | `azure_ai/FLUX.2-flex` | 32,000 | - | - | 图像生成 |
| Azure AI | `azure_ai/gpt-5.5-2026-04-24` | 1,050,000 | $5 | $30 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索; 系统消息; 并行工具 |
| Azure OpenAI | `azure/chat-latest` | 272,000 | $5 | $30 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索; 系统消息; 并行工具 |
| Azure OpenAI | `azure/eu/codex-mini` | - | $1.65 | $6.6 | 聊天 |
| Azure OpenAI | `azure/eu/computer-use-preview` | - | $3.3 | $13.2 | 聊天 |
| Azure OpenAI | `azure/eu/gpt-4.1` | - | $2.2 | $8.8 | 聊天; `input_cost_per_token_batches`: $1.1e-06; `output_cost_per_token_batches`: $4.4e-06 |
| Azure OpenAI | `azure/eu/gpt-4.1-mini` | - | $0.44 | $1.76 | 聊天; `input_cost_per_token_batches`: $2.2e-07; `output_cost_per_token_batches`: $8.8e-07 |
| Azure OpenAI | `azure/eu/gpt-4.1-nano` | - | $0.11 | $0.44 | 聊天; `input_cost_per_token_batches`: $5.5e-08; `output_cost_per_token_batches`: $2.2e-07 |
| Azure OpenAI | `azure/eu/gpt-4o-2024-05-13` | - | $5.5 | $16.5 | 聊天; `input_cost_per_token_batches`: $2.75e-06; `output_cost_per_token_batches`: $8.25e-06 |
| Azure OpenAI | `azure/eu/gpt-5` | - | $1.375 | $11 | 聊天; `input_cost_per_token_batches`: $6.875e-07; `output_cost_per_token_batches`: $5.5e-06 |
| Azure OpenAI | `azure/eu/gpt-5-codex` | - | $1.375 | $11 | 聊天 |
| Azure OpenAI | `azure/eu/gpt-5-mini` | - | $0.275 | $2.2 | 聊天; `input_cost_per_token_batches`: $1.375e-07; `output_cost_per_token_batches`: $1.1e-06 |
| Azure OpenAI | `azure/eu/gpt-5-nano` | - | $0.055 | $0.44 | 聊天; `input_cost_per_token_batches`: $2.75e-08; `output_cost_per_token_batches`: $2.2e-07 |
| Azure OpenAI | `azure/eu/gpt-5-pro` | - | $16.5 | $132 | 聊天; `input_cost_per_token_batches`: $8.25e-06; `output_cost_per_token_batches`: $6.6e-05 |
| Azure OpenAI | `azure/eu/gpt-5.1-codex-max` | - | $1.375 | $11 | 聊天 |
| Azure OpenAI | `azure/eu/gpt-5.2` | - | $1.925 | $15.4 | 聊天; `input_cost_per_token_batches`: $9.625e-07; `output_cost_per_token_batches`: $7.7e-06 |
| Azure OpenAI | `azure/eu/gpt-5.2-chat` | - | $1.925 | $15.4 | 聊天 |
| Azure OpenAI | `azure/eu/gpt-5.2-codex` | - | $1.925 | $15.4 | 聊天 |
| Azure OpenAI | `azure/eu/gpt-5.2-pro` | - | $23.1 | $184.8 | 聊天; `input_cost_per_token_batches`: $1.155e-05; `output_cost_per_token_batches`: $9.24e-05 |
| Azure OpenAI | `azure/eu/gpt-5.3-chat` | - | $1.925 | $15.4 | 聊天 |
| Azure OpenAI | `azure/eu/gpt-5.3-codex` | - | $1.925 | $15.4 | 聊天 |
| Azure OpenAI | `azure/eu/gpt-5.4-mini` | - | $0.825 | $4.95 | 聊天; `input_cost_per_token_batches`: $4.125e-07; `output_cost_per_token_batches`: $2.475e-06 |
| Azure OpenAI | `azure/eu/gpt-5.4-nano` | - | $0.22 | $1.375 | 聊天; `input_cost_per_token_batches`: $1.1e-07; `output_cost_per_token_batches`: $6.875e-07 |
| Azure OpenAI | `azure/eu/gpt-5.4-pro` | - | $33 | $198 | 聊天; `input_cost_per_token_batches`: $1.65e-05; `output_cost_per_token_batches`: $9.9e-05 |
| Azure OpenAI | `azure/eu/gpt-5.5-2026-04-24` | 1,050,000 | $5.5 | $33 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索; 系统消息; 并行工具; `input_cost_per_token_batches`: $2.75e-06; `output_cost_per_token_batches`: $1.65e-05 |
| Azure OpenAI | `azure/eu/gpt-6-astra` | - | $11 | $55 | 聊天 |
| Azure OpenAI | `azure/eu/o1-mini` | - | $1.21 | $4.84 | 聊天; `input_cost_per_token_batches`: $6.05e-07; `output_cost_per_token_batches`: $2.42e-06 |
| Azure OpenAI | `azure/eu/o1-preview` | - | $16.5 | $66 | 聊天 |
| Azure OpenAI | `azure/eu/o3-2025-04-16` | - | $2.2 | $8.8 | 聊天; `input_cost_per_token_batches`: $1.1e-06; `output_cost_per_token_batches`: $4.4e-06 |
| Azure OpenAI | `azure/eu/o3-deep-research` | - | $11 | $44 | 聊天 |
| Azure OpenAI | `azure/eu/o4-mini-2025-04-16` | - | $1.21 | $4.84 | 聊天; `input_cost_per_token_batches`: $6.05e-07; `output_cost_per_token_batches`: $2.42e-06 |
| Azure OpenAI | `azure/eu/text-embedding-3-large` | - | $0.143 | - | 嵌入 |
| Azure OpenAI | `azure/eu/text-embedding-3-small` | - | $0.022 | - | 嵌入 |
| Azure OpenAI | `azure/eu/text-embedding-ada-002` | - | $0.11 | - | 嵌入 |
| Azure OpenAI | `azure/gpt-5.5-2026-04-24` | 1,050,000 | $5 | $30 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索; 系统消息; 并行工具; `input_cost_per_token_batches`: $2.5e-06; `output_cost_per_token_batches`: $1.5e-05 |
| Azure OpenAI | `azure/gpt-5.6-luna-2026-07-09` | 922,000 | $0.2 | $1.2 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索; 系统消息; 并行工具 |
| Azure OpenAI | `azure/gpt-5.6-sol-2026-07-09` | 922,000 | $4 | $20 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索; 系统消息; 并行工具 |
| Azure OpenAI | `azure/gpt-5.6-terra-2026-07-09` | 922,000 | $2 | $12 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索; 系统消息; 并行工具 |
| Azure OpenAI | `azure/gpt-6-astra-2026-09-03` | 922,000 | $10 | $50 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 计算机使用; 网络搜索; 系统消息; 并行工具 |
| Azure OpenAI | `azure/gpt-chat-latest` | 272,000 | $5 | $30 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索; 系统消息; 并行工具 |
| Azure OpenAI | `azure/gpt-image-2.5-flare` | - | $5 | - | 图像生成; 视觉; PDF 输入 |
| Azure OpenAI | `azure/gpt-image-2.5-sunburst` | - | $5 | - | 图像生成; 视觉; PDF 输入 |
| Azure OpenAI | `azure/us/codex-mini` | - | $1.65 | $6.6 | 聊天 |
| Azure OpenAI | `azure/us/computer-use-preview` | - | $3.3 | $13.2 | 聊天 |
| Azure OpenAI | `azure/us/gpt-4.1` | - | $2.2 | $8.8 | 聊天; `input_cost_per_token_batches`: $1.1e-06; `output_cost_per_token_batches`: $4.4e-06 |
| Azure OpenAI | `azure/us/gpt-4.1-mini` | - | $0.44 | $1.76 | 聊天; `input_cost_per_token_batches`: $2.2e-07; `output_cost_per_token_batches`: $8.8e-07 |
| Azure OpenAI | `azure/us/gpt-4.1-nano` | - | $0.11 | $0.44 | 聊天; `input_cost_per_token_batches`: $5.5e-08; `output_cost_per_token_batches`: $2.2e-07 |
| Azure OpenAI | `azure/us/gpt-4o-2024-05-13` | - | $5.5 | $16.5 | 聊天; `input_cost_per_token_batches`: $2.75e-06; `output_cost_per_token_batches`: $8.25e-06 |
| Azure OpenAI | `azure/us/gpt-5` | - | $1.375 | $11 | 聊天; `input_cost_per_token_batches`: $6.875e-07; `output_cost_per_token_batches`: $5.5e-06 |
| Azure OpenAI | `azure/us/gpt-5-codex` | - | $1.375 | $11 | 聊天 |
| Azure OpenAI | `azure/us/gpt-5-mini` | - | $0.275 | $2.2 | 聊天; `input_cost_per_token_batches`: $1.375e-07; `output_cost_per_token_batches`: $1.1e-06 |
| Azure OpenAI | `azure/us/gpt-5-nano` | - | $0.055 | $0.44 | 聊天; `input_cost_per_token_batches`: $2.75e-08; `output_cost_per_token_batches`: $2.2e-07 |
| Azure OpenAI | `azure/us/gpt-5-pro` | - | $16.5 | $132 | 聊天; `input_cost_per_token_batches`: $8.25e-06; `output_cost_per_token_batches`: $6.6e-05 |
| Azure OpenAI | `azure/us/gpt-5.1-codex-max` | - | $1.375 | $11 | 聊天 |
| Azure OpenAI | `azure/us/gpt-5.2` | - | $1.925 | $15.4 | 聊天; `input_cost_per_token_batches`: $9.625e-07; `output_cost_per_token_batches`: $7.7e-06 |
| Azure OpenAI | `azure/us/gpt-5.2-chat` | - | $1.925 | $15.4 | 聊天 |
| Azure OpenAI | `azure/us/gpt-5.2-codex` | - | $1.925 | $15.4 | 聊天 |
| Azure OpenAI | `azure/us/gpt-5.2-pro` | - | $23.1 | $184.8 | 聊天; `input_cost_per_token_batches`: $1.155e-05; `output_cost_per_token_batches`: $9.24e-05 |
| Azure OpenAI | `azure/us/gpt-5.3-chat` | - | $1.925 | $15.4 | 聊天 |
| Azure OpenAI | `azure/us/gpt-5.3-codex` | - | $1.925 | $15.4 | 聊天 |
| Azure OpenAI | `azure/us/gpt-5.4-mini` | - | $0.825 | $4.95 | 聊天; `input_cost_per_token_batches`: $4.125e-07; `output_cost_per_token_batches`: $2.475e-06 |
| Azure OpenAI | `azure/us/gpt-5.4-nano` | - | $0.22 | $1.375 | 聊天; `input_cost_per_token_batches`: $1.1e-07; `output_cost_per_token_batches`: $6.875e-07 |
| Azure OpenAI | `azure/us/gpt-5.4-pro` | - | $33 | $198 | 聊天; `input_cost_per_token_batches`: $1.65e-05; `output_cost_per_token_batches`: $9.9e-05 |
| Azure OpenAI | `azure/us/gpt-5.5-2026-04-24` | 1,050,000 | $5.5 | $33 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索; 系统消息; 并行工具; `input_cost_per_token_batches`: $2.75e-06; `output_cost_per_token_batches`: $1.65e-05 |
| Azure OpenAI | `azure/us/gpt-chat-latest` | 272,000 | $5.5 | $33 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索; 系统消息; 并行工具 |
| Azure OpenAI | `azure/us/o1-mini` | - | $1.21 | $4.84 | 聊天; `input_cost_per_token_batches`: $6.05e-07; `output_cost_per_token_batches`: $2.42e-06 |
| Azure OpenAI | `azure/us/o1-preview` | - | $16.5 | $66 | 聊天 |
| Azure OpenAI | `azure/us/o3-deep-research` | - | $11 | $44 | 聊天 |
| Azure OpenAI | `azure/us/text-embedding-3-large` | - | $0.143 | - | 嵌入 |
| Azure OpenAI | `azure/us/text-embedding-3-small` | - | $0.022 | - | 嵌入 |
| Azure OpenAI | `azure/us/text-embedding-ada-002` | - | $0.11 | - | 嵌入 |
| Cohere | `command-a-plus-05-2026` | 128,000 | $0 | $0 | 聊天; 推理; 视觉; 工具调用; 工具选择; 结构化输出 |
| DashScope | `dashscope/qwen3.8-flash` | 991,808 | $0.15 | $0.47 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; 网络搜索; 视频输入 |
| DashScope | `dashscope/qwen3.8-omni-flash` | 991,808 | $0.15 | $0.47 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; 网络搜索; 音频输入; 视频输入 |
| Deepgram | `deepgram/streaming/detect_entities` | - | - | - | 转录; `input_cost_per_second`: $2.833e-05; `output_cost_per_second`: $0 |
| Deepgram | `deepgram/streaming/diarize` | - | - | - | 转录; `input_cost_per_second`: $3.333e-05; `output_cost_per_second`: $0 |
| Deepgram | `deepgram/streaming/keyterm` | - | - | - | 转录; `input_cost_per_second`: $2.167e-05; `output_cost_per_second`: $0 |
| Deepgram | `deepgram/streaming/nova-3` | - | - | - | 转录; `input_cost_per_second`: $8e-05; `output_cost_per_second`: $0 |
| Deepgram | `deepgram/streaming/nova-3-multilingual` | - | - | - | 转录; `input_cost_per_second`: $9.667e-05; `output_cost_per_second`: $0 |
| Deepgram | `deepgram/streaming/redact` | - | - | - | 转录; `input_cost_per_second`: $3.333e-05; `output_cost_per_second`: $0 |
| Fireworks AI | `fireworks_ai/accounts/fireworks/routers/glm-5p3-fast` | 1,048,576 | $2.1 | $6.6 | 聊天; 推理; 工具调用; 工具选择; 结构化输出 |
| Fireworks AI | `fireworks_ai/glm-5p3-fast` | 1,048,576 | $2.1 | $6.6 | 聊天; 推理; 工具调用; 工具选择; 结构化输出 |
| FriendliAI | `friendliai/LGAI-EXAONE/K-EXAONE-2.0-750B-A37B` | 262,144 | $0.6 | $2.4 | 聊天; 推理; 工具调用; 工具选择; 提示词缓存; 结构化输出; 系统消息; 并行工具 |
| FriendliAI | `friendliai/MiniMaxAI/MiniMax-M2.5` | 196,608 | $0.3 | $1.2 | 聊天; 推理; 工具调用; 工具选择; 提示词缓存; 结构化输出; 系统消息; 并行工具 |
| FriendliAI | `friendliai/deepseek-ai/DeepSeek-V3.2` | 163,840 | $0.5 | $1.5 | 聊天; 推理; 工具调用; 工具选择; 提示词缓存; 结构化输出; 系统消息; 并行工具 |
| FriendliAI | `friendliai/google/gemma-4-31B-it` | 262,144 | $0.14 | $0.4 | 聊天; 推理; 视觉; 工具调用; 工具选择; 结构化输出; 系统消息; 并行工具 |
| FriendliAI | `friendliai/zai-org/GLM-5.1` | 202,752 | $1.4 | $4.4 | 聊天; 推理; 工具调用; 工具选择; 提示词缓存; 结构化输出; 系统消息; 并行工具 |
| FriendliAI | `friendliai/zai-org/GLM-5.2` | 1,048,576 | $1.4 | $4.4 | 聊天; 推理; 工具调用; 工具选择; 提示词缓存; 结构化输出; 系统消息; 并行工具 |
| Gemini | `gemini-3.8-live` | 131,072 | $0.75 | $4.5 | 实时; 视觉; 工具调用; 网络搜索; 音频输入; 音频输出; `input_cost_per_video_per_second`: $3.333333333e-05; `input_cost_per_audio_token`: $3e-06; `output_cost_per_audio_token`: $1.2e-05 |
| Gemini | `gemini-3.8-live-extended-thinking` | 131,072 | $0.75 | $4.5 | 实时; 推理; 视觉; 工具调用; 网络搜索; 音频输入; 音频输出; `input_cost_per_video_per_second`: $3.333333333e-05; `input_cost_per_audio_token`: $3e-06; `output_cost_per_audio_token`: $1.2e-05 |
| Gemini | `gemini/gemini-3.8-live` | 131,072 | $0.75 | $4.5 | 实时; 视觉; 工具调用; 网络搜索; 音频输入; `input_cost_per_audio_token`: $3e-06; `output_cost_per_audio_token`: $1.2e-05 |
| Gemini | `gemini/gemini-3.8-live-extended-thinking` | 131,072 | $0.75 | $4.5 | 实时; 视觉; 工具调用; 网络搜索; 音频输入; `input_cost_per_audio_token`: $3e-06; `output_cost_per_audio_token`: $1.2e-05 |
| Mistral | `mistral/zai-glm-5` | 1,048,576 | $1.4 | $4.4 | 聊天; 推理; 工具调用; 工具选择; 提示词缓存; 结构化输出 |
| Mistral | `mistral/zai-glm-5-3` | 1,048,576 | $1.4 | $4.4 | 聊天; 推理; 工具调用; 工具选择; 提示词缓存; 结构化输出 |
| Mistral | `mistral/zai-glm-latest` | 1,048,576 | $1.4 | $4.4 | 聊天; 推理; 工具调用; 工具选择; 提示词缓存; 结构化输出 |
| Nebius | `nebius/deepseek-ai/DeepSeek-V4-Pro-0813` | - | $1.32 | $3.96 | 聊天; 推理; 工具调用 |
| Nebius | `nebius/zai-org/GLM-5.3` | 1,048,576 | $1.4 | $4.4 | 聊天; 推理; 工具调用 |
| OpenAI | `gpt-5.5-cyber` | - | $12.5 | $75 | 聊天; 推理 |
| OpenAI | `gpt-rosalind-research` | - | $5 | $25 | 聊天 |
| OpenRouter | `openrouter/aion-labs/aion-2.0` | 131,072 | $0.8 | $1.6 | 聊天; 推理; 工具调用; 工具选择; 提示词缓存; 结构化输出 |
| OpenRouter | `openrouter/aion-labs/aion-3.0` | 131,072 | $3 | $6 | 聊天; 推理; 工具调用; 工具选择; 提示词缓存; 结构化输出 |
| OpenRouter | `openrouter/aion-labs/aion-3.0-mini` | 131,072 | $0.7 | $1.4 | 聊天; 推理; 工具调用; 工具选择; 提示词缓存; 结构化输出 |
| OpenRouter | `openrouter/aion-labs/aion-rp-llama-3.1-8b` | 32,768 | $0.8 | $1.6 | 聊天 |
| OpenRouter | `openrouter/amazon/nova-2-lite-v1` | 1,000,000 | $0.3 | $2.5 | 聊天; 推理; 视觉; 工具调用; 工具选择; PDF 输入 |
| OpenRouter | `openrouter/amazon/nova-lite-v1` | 300,000 | $0.06 | $0.24 | 聊天; 视觉; 工具调用 |
| OpenRouter | `openrouter/amazon/nova-micro-v1` | 128,000 | $0.035 | $0.14 | 聊天; 工具调用 |
| OpenRouter | `openrouter/amazon/nova-premier-v1` | 1,000,000 | $2.5 | $12.5 | 聊天; 视觉; 工具调用; 提示词缓存 |
| OpenRouter | `openrouter/amazon/nova-pro-v1` | 300,000 | $0.8 | $3.2 | 聊天; 视觉; 工具调用 |
| OpenRouter | `openrouter/anthracite-org/magnum-v4-72b` | 32,768 | $2.5 | $5 | 聊天; 结构化输出 |
| OpenRouter | `openrouter/anthropic/claude-fable-5.1:batch` | 1,000,000 | $5 | $25 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索 |
| OpenRouter | `openrouter/anthropic/claude-fable-5:batch` | 1,000,000 | $5 | $25 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索 |
| OpenRouter | `openrouter/anthropic/claude-haiku-4.5:batch` | 200,000 | $0.5 | $2.5 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索 |
| OpenRouter | `openrouter/anthropic/claude-opus-4.1:batch` | 200,000 | $7.5 | $37.5 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索 |
| OpenRouter | `openrouter/anthropic/claude-opus-4.5:batch` | 200,000 | $2.5 | $12.5 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索 |
| OpenRouter | `openrouter/anthropic/claude-opus-4.6:batch` | 1,000,000 | $2.5 | $12.5 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索 |
| OpenRouter | `openrouter/anthropic/claude-opus-4.7:batch` | 1,000,000 | $2.5 | $12.5 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索 |
| OpenRouter | `openrouter/anthropic/claude-opus-4.8:batch` | 1,000,000 | $2.5 | $12.5 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索 |
| OpenRouter | `openrouter/anthropic/claude-opus-5:batch` | 1,000,000 | $2.5 | $12.5 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索 |
| OpenRouter | `openrouter/anthropic/claude-sonnet-4.5:batch` | 1,000,000 | $1.5 | $7.5 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索 |
| OpenRouter | `openrouter/anthropic/claude-sonnet-4.6:batch` | 1,000,000 | $1.5 | $7.5 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索 |
| OpenRouter | `openrouter/anthropic/claude-sonnet-5:batch` | 1,000,000 | $1 | $5 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索 |
| OpenRouter | `openrouter/arcee-ai/trinity-large-thinking` | 262,144 | $0.25 | $0.8 | 聊天; 推理; 工具调用; 工具选择; 提示词缓存 |
| OpenRouter | `openrouter/baidu/ernie-4.5-vl-424b-a47b` | 123,000 | $0.42 | $1.25 | 聊天; 推理; 视觉 |
| OpenRouter | `openrouter/bytedance-seed/seed-1.6` | 262,144 | $0.25 | $2 | 聊天; 推理; 视觉; 工具调用; 工具选择; 结构化输出 |
| OpenRouter | `openrouter/bytedance-seed/seed-1.6-flash` | 262,144 | $0.075 | $0.3 | 聊天; 推理; 视觉; 工具调用; 工具选择; 结构化输出 |
| OpenRouter | `openrouter/bytedance-seed/seed-2-1-turbo` | 262,144 | $0.5 | $2.5 | 聊天; 推理; 视觉; 工具调用; 工具选择; 结构化输出 |
| OpenRouter | `openrouter/bytedance-seed/seed-2.0-code` | 262,144 | $0.5 | $3 | 聊天; 推理; 视觉; 工具调用; 工具选择; 结构化输出 |
| OpenRouter | `openrouter/bytedance-seed/seed-2.0-lite` | 262,144 | $0.25 | $2 | 聊天; 推理; 视觉; 工具调用; 工具选择; 结构化输出 |
| OpenRouter | `openrouter/bytedance-seed/seed-2.0-mini` | 262,144 | $0.1 | $0.4 | 聊天; 推理; 视觉; 工具调用; 工具选择; 结构化输出 |
| OpenRouter | `openrouter/cognitivecomputations/dolphin-mistral-24b-venice-edition` | 128,000 | $0.2 | $0.9 | 聊天; 结构化输出 |
| OpenRouter | `openrouter/cohere/command-a` | 256,000 | $2.5 | $10 | 聊天; 结构化输出 |
| OpenRouter | `openrouter/cohere/command-r-08-2024` | 128,000 | $0.15 | $0.6 | 聊天; 工具调用; 工具选择; 结构化输出 |
| OpenRouter | `openrouter/cohere/command-r-plus-08-2024` | 128,000 | $2.5 | $10 | 聊天; 工具调用; 工具选择; 结构化输出 |
| OpenRouter | `openrouter/cohere/command-r7b-12-2024` | 128,000 | $0.0375 | $0.15 | 聊天; 结构化输出 |
| OpenRouter | `openrouter/cohere/north-mini-code:free` | 256,000 | $0 | $0 | 聊天; 推理; 工具调用; 工具选择 |
| OpenRouter | `openrouter/deepseek/deepseek-v4-flash-0731:batch` | 1,048,576 | $0.11 | $0.33 | 聊天; 推理; 工具调用; 工具选择; 提示词缓存; 结构化输出 |
| OpenRouter | `openrouter/deepseek/deepseek-v4-flash-0731:free` | 1,048,576 | $0 | $0 | 聊天; 推理; 工具调用; 工具选择; 结构化输出 |
| OpenRouter | `openrouter/deepseek/deepseek-v4-flash-vision-exp:batch` | 1,048,576 | $0.11 | $0.33 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出 |
| OpenRouter | `openrouter/deepseek/deepseek-v4-pro-0813:batch` | 1,048,576 | $0.66 | $1.98 | 聊天; 推理; 工具调用; 工具选择; 提示词缓存; 结构化输出 |
| OpenRouter | `openrouter/dots-studio/dots-3-note-preview:free` | 512,000 | $0 | $0 | 聊天; 推理; 视觉; 工具调用; 工具选择; 结构化输出 |
| OpenRouter | `openrouter/google/gemini-2.5-flash-lite:batch` | 1,048,576 | $0.05 | $0.2 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索; 音频输入; 视频输入; `input_cost_per_audio_token`: $1.5e-07 |
| OpenRouter | `openrouter/google/gemini-2.5-flash:batch` | 1,048,576 | $0.15 | $1.25 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索; 音频输入; 视频输入; `input_cost_per_audio_token`: $5e-07 |
| OpenRouter | `openrouter/google/gemini-2.5-pro:batch` | 1,048,576 | $0.625 | $5 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索; 音频输入; 视频输入; `input_cost_per_audio_token`: $6.25e-07 |
| OpenRouter | `openrouter/google/gemini-3-flash-preview:batch` | 1,048,576 | $0.25 | $1.5 | 聊天; 推理; 视觉; 工具调用; 工具选择; 结构化输出; PDF 输入; 网络搜索; 音频输入; 视频输入; `input_cost_per_audio_token`: $5e-07 |
| OpenRouter | `openrouter/google/gemini-3.1-flash-lite:batch` | 1,048,576 | $0.125 | $0.75 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索; 音频输入; 视频输入; `input_cost_per_audio_token`: $2.5e-07 |
| OpenRouter | `openrouter/google/gemini-3.1-pro-preview:batch` | 1,048,576 | $1 | $6 | 聊天; 推理; 视觉; 工具调用; 工具选择; 结构化输出; PDF 输入; 网络搜索; 音频输入; 视频输入; `input_cost_per_audio_token`: $1e-06 |
| OpenRouter | `openrouter/google/gemini-3.5-flash-lite:batch` | 1,048,576 | $0.15 | $1.25 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索; 音频输入; 视频输入; `input_cost_per_audio_token`: $1.5e-07 |
| OpenRouter | `openrouter/google/gemini-3.5-flash:batch` | 1,048,576 | $0.75 | $4.5 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索; 音频输入; 视频输入; `input_cost_per_audio_token`: $1.5e-06 |
| OpenRouter | `openrouter/google/gemini-3.6-flash:batch` | 1,048,576 | $0.375 | $1.875 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索; 音频输入; 视频输入; `input_cost_per_audio_token`: $3.75e-07 |
| OpenRouter | `openrouter/google/gemini-3.7-flash:batch` | 1,048,576 | $0.375 | $1.875 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索; 音频输入; 视频输入; `input_cost_per_audio_token`: $3.75e-07 |
| OpenRouter | `openrouter/google/gemini-3.8-flash:batch` | 1,048,576 | $0.375 | $1.875 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索; 音频输入; 视频输入; `input_cost_per_audio_token`: $3.75e-07 |
| OpenRouter | `openrouter/ibm-granite/granite-4.0-h-micro` | 131,000 | $0.017 | $0.112 | 聊天; 结构化输出 |
| OpenRouter | `openrouter/ibm-granite/granite-4.2-8b` | 131,072 | $0.06 | $0.25 | 聊天; 推理; 工具调用; 工具选择; 提示词缓存; 结构化输出 |
| OpenRouter | `openrouter/inception/mercury-2` | 128,000 | $0.25 | $0.75 | 聊天; 推理; 工具调用; 工具选择; 提示词缓存; 结构化输出 |
| OpenRouter | `openrouter/inception/mercury-2.5` | 260,000 | $0.04 | $0.15 | 聊天; 推理; 工具调用; 工具选择; 提示词缓存; 结构化输出 |
| OpenRouter | `openrouter/inclusionai/ling-3.0-flash` | 262,144 | $0.021 | $0.063 | 聊天; 推理; 工具调用; 工具选择; 提示词缓存; 结构化输出 |
| OpenRouter | `openrouter/inclusionai/ling-3.0-flash-fin` | 262,144 | $0.06 | $0.18 | 聊天; 推理; 工具调用; 工具选择; 提示词缓存; 结构化输出 |
| OpenRouter | `openrouter/inclusionai/ling-3.0-flash-fin:free` | 262,144 | $0 | $0 | 聊天; 推理; 工具调用; 工具选择 |
| OpenRouter | `openrouter/inclusionai/ling-3.0-flash-sante:free` | 262,144 | $0 | $0 | 聊天; 推理; 工具调用; 工具选择 |
| OpenRouter | `openrouter/inclusionai/ling-3.0-flash-vl` | 131,072 | $0.06 | $0.18 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出 |
| OpenRouter | `openrouter/inclusionai/ling-3.0-flash-vl:free` | 262,144 | $0 | $0 | 聊天; 推理; 视觉; 工具调用; 工具选择 |
| OpenRouter | `openrouter/inference-net/schematron-v2-small` | 128,000 | $0.05 | $0.23 | 聊天; 提示词缓存; 结构化输出 |
| OpenRouter | `openrouter/inference-net/schematron-v2-turbo` | 128,000 | $0.03 | $0.15 | 聊天; 提示词缓存; 结构化输出 |
| OpenRouter | `openrouter/kwaipilot/kat-coder-pro-v2` | 262,144 | $0.3 | $1.2 | 聊天; 工具调用; 工具选择; 提示词缓存; 结构化输出 |
| OpenRouter | `openrouter/kwaipilot/kat-coder-pro-v2.5` | 262,144 | $0.74 | $2.96 | 聊天; 工具调用; 工具选择; 提示词缓存; 结构化输出 |
| OpenRouter | `openrouter/liquid/lfm-2.5-2.6b:free` | 65,536 | $0 | $0 | 聊天; 推理; 工具调用; 工具选择; 结构化输出 |
| OpenRouter | `openrouter/meituan/longcat-2.0` | 1,048,756 | $0.3 | $1.2 | 聊天; 推理; 工具调用; 工具选择; 提示词缓存 |
| OpenRouter | `openrouter/meta/muse-glimmer-30b` | 131,072 | $0.35 | $1.5 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出 |
| OpenRouter | `openrouter/meta/muse-glimmer-30b:batch` | 131,072 | $0.175 | $0.75 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出 |
| OpenRouter | `openrouter/meta/muse-spark-1.1` | 1,048,576 | $1.25 | $4.25 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索; 音频输入 |
| OpenRouter | `openrouter/meta/muse-spark-1.2` | 1,048,576 | $1.25 | $4.25 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索; 音频输入 |
| OpenRouter | `openrouter/meta/muse-spark-1.2-contributor` | 1,048,576 | $0.1 | $0.2 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索; 音频输入 |
| OpenRouter | `openrouter/meta/muse-spark-1.3` | 1,048,576 | $1.25 | $4.25 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索; 音频输入 |
| OpenRouter | `openrouter/meta/muse-spark-1.3-contributor` | 1,048,576 | $0.1 | $0.2 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索; 音频输入 |
| OpenRouter | `openrouter/microsoft/phi-4` | 16,384 | $0.07 | $0.14 | 聊天; 结构化输出 |
| OpenRouter | `openrouter/microsoft/wizardlm-2-8x22b` | 65,535 | $0.62 | $0.62 | 聊天; 结构化输出 |
| OpenRouter | `openrouter/minimax/minimax-m3:batch` | 524,288 | $0.3 | $1.2 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出 |
| OpenRouter | `openrouter/mistralai/codestral-2508:batch` | 256,000 | $0.15 | $0.45 | 聊天; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入 |
| OpenRouter | `openrouter/mistralai/ministral-8b-2512:batch` | 262,144 | $0.075 | $0.075 | 聊天; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出 |
| OpenRouter | `openrouter/mistralai/mistral-large-2512:batch` | 262,144 | $0.25 | $0.75 | 聊天; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入 |
| OpenRouter | `openrouter/mistralai/mistral-medium-3-5:batch` | 262,144 | $0.75 | $3.75 | 聊天; 推理; 视觉; 工具调用; 工具选择; 结构化输出; PDF 输入 |
| OpenRouter | `openrouter/mistralai/mistral-medium-3.1:batch` | 131,072 | $0.2 | $1 | 聊天; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入 |
| OpenRouter | `openrouter/mistralai/mistral-small-2603:batch` | 262,144 | $0.075 | $0.3 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出 |
| OpenRouter | `openrouter/moonshotai/kimi-k3:batch` | 1,048,576 | $3 | $15 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出 |
| OpenRouter | `openrouter/morph/morph-v3-fast` | 81,920 | $0.8 | $1.2 | 聊天 |
| OpenRouter | `openrouter/morph/morph-v3-large` | 262,144 | $0.9 | $1.9 | 聊天; 结构化输出 |
| OpenRouter | `openrouter/nex-agi/nex-n2.5-mini:free` | 262,144 | $0 | $0 | 聊天; 推理; 视觉; 工具调用; 工具选择; 结构化输出 |
| OpenRouter | `openrouter/nex-agi/nex-n2.5-pro:free` | 262,144 | $0 | $0 | 聊天; 推理; 视觉; 工具调用; 工具选择; 结构化输出 |
| OpenRouter | `openrouter/nousresearch/hermes-3-llama-3.1-405b` | 131,072 | $1 | $1 | 聊天; 结构化输出 |
| OpenRouter | `openrouter/nousresearch/hermes-3-llama-3.1-70b` | 131,072 | $0.7 | $0.7 | 聊天; 结构化输出 |
| OpenRouter | `openrouter/nousresearch/hermes-4-405b` | 131,072 | $1 | $3 | 聊天; 推理; 结构化输出 |
| OpenRouter | `openrouter/openai/gpt-3.5-turbo-0613` | 4,095 | $1 | $2 | 聊天; 工具调用; 工具选择; 结构化输出 |
| OpenRouter | `openrouter/openai/gpt-3.5-turbo:batch` | 16,385 | $0.25 | $0.75 | 聊天; 工具调用; 工具选择; 结构化输出; 网络搜索 |
| OpenRouter | `openrouter/openai/gpt-4-turbo:batch` | 128,000 | $5 | $15 | 聊天; 视觉; 工具调用; 工具选择; 结构化输出; 网络搜索 |
| OpenRouter | `openrouter/openai/gpt-4.1-mini:batch` | 1,047,576 | $0.2 | $0.8 | 聊天; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索 |
| OpenRouter | `openrouter/openai/gpt-4.1-nano:batch` | 1,047,576 | $0.05 | $0.2 | 聊天; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索 |
| OpenRouter | `openrouter/openai/gpt-4.1:batch` | 1,047,576 | $1 | $4 | 聊天; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索 |
| OpenRouter | `openrouter/openai/gpt-4o-mini:batch` | 128,000 | $0.075 | $0.3 | 聊天; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索 |
| OpenRouter | `openrouter/openai/gpt-4o:batch` | 128,000 | $1.25 | $5 | 聊天; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索 |
| OpenRouter | `openrouter/openai/gpt-5-image` | 400,000 | $10 | $10 | 聊天; 推理; 视觉; 提示词缓存; 结构化输出; PDF 输入; 网络搜索 |
| OpenRouter | `openrouter/openai/gpt-5-image-mini` | 400,000 | $2.5 | $2 | 聊天; 推理; 视觉; 提示词缓存; 结构化输出; PDF 输入; 网络搜索 |
| OpenRouter | `openrouter/openai/gpt-5-mini:batch` | 400,000 | $0.125 | $1 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索 |
| OpenRouter | `openrouter/openai/gpt-5-nano:batch` | 400,000 | $0.025 | $0.2 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索 |
| OpenRouter | `openrouter/openai/gpt-5-pro:batch` | 400,000 | $7.5 | $60 | 聊天; 推理; 视觉; 工具调用; 工具选择; 结构化输出; PDF 输入; 网络搜索 |
| OpenRouter | `openrouter/openai/gpt-5.1:batch` | 400,000 | $0.625 | $5 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索 |
| OpenRouter | `openrouter/openai/gpt-5.2-pro:batch` | 400,000 | $10.5 | $84 | 聊天; 推理; 视觉; 工具调用; 工具选择; 结构化输出; PDF 输入; 网络搜索 |
| OpenRouter | `openrouter/openai/gpt-5.2:batch` | 400,000 | $0.875 | $7 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索 |
| OpenRouter | `openrouter/openai/gpt-5.4-image-2` | 272,000 | $8 | $15 | 聊天; 推理; 视觉; 提示词缓存; 结构化输出; PDF 输入; 网络搜索 |
| OpenRouter | `openrouter/openai/gpt-5.4-mini:batch` | 400,000 | $0.375 | $2.25 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索 |
| OpenRouter | `openrouter/openai/gpt-5.4-nano:batch` | 400,000 | $0.1 | $0.625 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索 |
| OpenRouter | `openrouter/openai/gpt-5.4-pro:batch` | 1,050,000 | $15 | $90 | 聊天; 推理; 视觉; 工具调用; 工具选择; 结构化输出; PDF 输入; 网络搜索 |
| OpenRouter | `openrouter/openai/gpt-5.4:batch` | 1,050,000 | $1.25 | $7.5 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索 |
| OpenRouter | `openrouter/openai/gpt-5.5-pro:batch` | 1,050,000 | $15 | $90 | 聊天; 推理; 视觉; 工具调用; 工具选择; 结构化输出; PDF 输入; 网络搜索 |
| OpenRouter | `openrouter/openai/gpt-5.5:batch` | 1,050,000 | $2.5 | $15 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索 |
| OpenRouter | `openrouter/openai/gpt-5.6-luna-pro:batch` | 1,050,000 | $0.1 | $0.6 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索 |
| OpenRouter | `openrouter/openai/gpt-5.6-luna:batch` | 1,050,000 | $0.1 | $0.6 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索 |
| OpenRouter | `openrouter/openai/gpt-5.6-sol-pro:batch` | 1,050,000 | $1 | $5 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索 |
| OpenRouter | `openrouter/openai/gpt-5.6-sol:batch` | 1,050,000 | $1 | $5 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索 |
| OpenRouter | `openrouter/openai/gpt-5.6-terra-pro:batch` | 1,050,000 | $1 | $6 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索 |
| OpenRouter | `openrouter/openai/gpt-5.6-terra:batch` | 1,050,000 | $1 | $6 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索 |
| OpenRouter | `openrouter/openai/gpt-5:batch` | 400,000 | $0.625 | $5 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索 |
| OpenRouter | `openrouter/openai/gpt-6-astra-pro:batch` | 1,050,000 | $5 | $25 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索 |
| OpenRouter | `openrouter/openai/gpt-6-astra:batch` | 1,050,000 | $5 | $25 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索 |
| OpenRouter | `openrouter/openai/gpt-oss-120b:batch` | 131,072 | $0.15 | $0.6 | 聊天; 推理; 工具调用; 工具选择; 结构化输出 |
| OpenRouter | `openrouter/openai/o3-mini:batch` | 200,000 | $0.55 | $2.2 | 聊天; 推理; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索 |
| OpenRouter | `openrouter/openai/o3:batch` | 200,000 | $1 | $4 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索 |
| OpenRouter | `openrouter/openai/o4-mini:batch` | 200,000 | $0.55 | $2.2 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索 |
| OpenRouter | `openrouter/perceptron/perceptron-mk1` | 32,768 | $0.15 | $1.5 | 聊天; 推理; 视觉; 结构化输出 |
| OpenRouter | `openrouter/perplexity/sonar` | 127,072 | $1 | $1 | 视觉; 网络搜索 |
| OpenRouter | `openrouter/perplexity/sonar-deep-research` | 128,000 | $2 | $8 | 聊天; 推理; 网络搜索 |
| OpenRouter | `openrouter/perplexity/sonar-pro` | 200,000 | $3 | $15 | 视觉; 网络搜索 |
| OpenRouter | `openrouter/perplexity/sonar-pro-search` | 200,000 | $3 | $15 | 聊天; 推理; 视觉; 结构化输出; 网络搜索 |
| OpenRouter | `openrouter/perplexity/sonar-reasoning-pro` | 128,000 | $2 | $8 | 聊天; 推理; 视觉; 网络搜索 |
| OpenRouter | `openrouter/prism-ml/ternary-bonsai-2-27b` | 262,144 | $0.075 | $0.5 | 聊天; 推理; 视觉; 工具调用; 工具选择; 结构化输出 |
| OpenRouter | `openrouter/qwen/qwen3.5-9b:batch` | 262,144 | $0.17 | $0.25 | 聊天; 推理; 视觉; 工具调用; 工具选择; 结构化输出 |
| OpenRouter | `openrouter/qwen/qwen3.8-2.4t-a95b:batch` | 1,010,000 | $2 | $6 | 聊天; 推理; 工具调用; 工具选择; 提示词缓存; 结构化输出 |
| OpenRouter | `openrouter/qwen/qwen3.8-27b:free` | 262,144 | $0 | $0 | 聊天; 推理; 视觉; 工具调用; 工具选择; 结构化输出 |
| OpenRouter | `openrouter/rekaai/reka-edge` | 16,384 | $0.1 | $0.1 | 聊天; 视觉; 工具调用; 工具选择; 结构化输出 |
| OpenRouter | `openrouter/rekaai/reka-flash-3` | 65,536 | $0.1 | $0.2 | 聊天; 推理; 结构化输出 |
| OpenRouter | `openrouter/relace/relace-apply-3` | 256,000 | $0.85 | $1.25 | 聊天 |
| OpenRouter | `openrouter/relace/relace-search` | 256,000 | $1 | $3 | 聊天; 工具调用; 工具选择; 结构化输出 |
| OpenRouter | `openrouter/sakana/fugu-max` | 1,000,000 | $2 | $6 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索 |
| OpenRouter | `openrouter/sakana/fugu-ultra` | 1,000,000 | $5 | $30 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; 网络搜索 |
| OpenRouter | `openrouter/sakana/fugu-ultra-v2` | 1,000,000 | $5 | $30 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索 |
| OpenRouter | `openrouter/sakana/sakana-namazu` | 262,144 | $0.95 | $4 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索 |
| OpenRouter | `openrouter/sao10k/l3-lunaris-8b` | 8,192 | $0.04 | $0.05 | 聊天; 结构化输出 |
| OpenRouter | `openrouter/sao10k/l3.1-euryale-70b` | 131,072 | $0.85 | $0.85 | 聊天; 工具调用; 工具选择; 结构化输出 |
| OpenRouter | `openrouter/sao10k/l3.3-euryale-70b` | 131,072 | $0.65 | $0.75 | 聊天; 结构化输出 |
| OpenRouter | `openrouter/stealth/union-alpha` | 262,144 | $0 | $0 | 聊天; 视觉; 工具调用; 工具选择; 结构化输出 |
| OpenRouter | `openrouter/stepfun/step-3.5-flash` | 262,144 | $0.1 | $0.3 | 聊天; 推理; 工具调用; 工具选择 |
| OpenRouter | `openrouter/stepfun/step-3.7-flash` | 262,144 | $0.2 | $1.15 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出 |
| OpenRouter | `openrouter/tencent/hunyuan-a13b-instruct` | 131,072 | $0.14 | $0.57 | 聊天; 推理; 结构化输出 |
| OpenRouter | `openrouter/tencent/hy-mt2-1.8b` | 8,192 | $0.044 | $0.177 | 聊天 |
| OpenRouter | `openrouter/tencent/hy-mt2-30b-a3b` | 8,192 | $0.074 | $0.295 | 聊天; 结构化输出 |
| OpenRouter | `openrouter/tencent/hy-mt2-7b` | 8,192 | $0.074 | $0.295 | 聊天; 结构化输出 |
| OpenRouter | `openrouter/tencent/hy3` | 262,144 | $0.132 | $0.528 | 聊天; 推理; 工具调用; 工具选择; 提示词缓存; 结构化输出 |
| OpenRouter | `openrouter/tencent/hy3-preview` | 262,144 | $0.18 | $0.6 | 聊天; 推理; 工具调用; 工具选择; 提示词缓存 |
| OpenRouter | `openrouter/tencent/hy4-preview` | 1,048,576 | $0.834 | $2.501 | 聊天; 推理; 工具调用; 工具选择; 提示词缓存; 结构化输出 |
| OpenRouter | `openrouter/thedrummer/cydonia-24b-v4.1` | 131,072 | $0.3 | $0.5 | 聊天; 提示词缓存; 结构化输出 |
| OpenRouter | `openrouter/thedrummer/skyfall-36b-v2` | 32,768 | $0.55 | $0.8 | 聊天; 提示词缓存; 结构化输出 |
| OpenRouter | `openrouter/thedrummer/unslopnemo-12b` | 1,024,000 | $0.4 | $0.4 | 聊天; 结构化输出 |
| OpenRouter | `openrouter/thinkingmachines/inkling` | 1,048,576 | $1 | $4.05 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 音频输入 |
| OpenRouter | `openrouter/thinkingmachines/inkling-small` | 1,048,576 | $0.45 | $1.2 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 音频输入 |
| OpenRouter | `openrouter/thinkingmachines/inkling-small:free` | 1,048,576 | $0 | $0 | 聊天; 推理; 视觉; 工具调用; 音频输入 |
| OpenRouter | `openrouter/thinkingmachines/inkling:batch` | 524,288 | $1 | $4.05 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 音频输入 |
| OpenRouter | `openrouter/thinkingmachines/inkling:free` | 1,048,576 | $0 | $0 | 聊天; 推理; 视觉; 工具调用; 音频输入 |
| OpenRouter | `openrouter/unbiased/pareto` | 262,144 | $2.5 | $7.5 | 视觉; 工具调用; 工具选择; 提示词缓存 |
| OpenRouter | `openrouter/upstage/solar-pro-3` | 131,072 | $0.15 | $0.6 | 聊天; 推理; 工具调用; 工具选择; 提示词缓存; 结构化输出 |
| OpenRouter | `openrouter/upstage/solar-pro4` | 524,288 | $0.09 | $0.36 | 聊天; 推理; 工具调用; 工具选择; 提示词缓存; 结构化输出 |
| OpenRouter | `openrouter/writer/palmyra-x5` | 1,040,000 | $0.6 | $6 | 聊天 |
| OpenRouter | `openrouter/x-ai/grok-4.3:batch` | 1,000,000 | $1 | $2 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索 |
| OpenRouter | `openrouter/z-ai/glm-5.2:batch` | 1,048,576 | $0.7 | $2.2 | 聊天; 推理; 工具调用; 工具选择; 提示词缓存; 结构化输出 |
| OpenRouter | `openrouter/z-ai/glm-5.3-flash:batch` | 1,048,576 | $0.075 | $0.25 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出 |
| OpenRouter | `openrouter/z-ai/glm-5.3-flashx` | 1,048,576 | $0.37 | $1.25 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出 |
| OpenRouter | `openrouter/z-ai/glm-5.3:batch` | 1,048,576 | $0.7 | $2.2 | 聊天; 推理; 工具调用; 工具选择; 提示词缓存; 结构化输出 |
| OpenRouter | `openrouter/~anthropic/claude-fable-latest` | 1,000,000 | $10 | $50 | 聊天; 推理; 视觉; 工具调用; 提示词缓存; 结构化输出; PDF 输入; 网络搜索 |
| OpenRouter | `openrouter/~anthropic/claude-haiku-latest` | 200,000 | $1 | $5 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索 |
| OpenRouter | `openrouter/~anthropic/claude-opus-latest` | 1,000,000 | $5 | $25 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索 |
| OpenRouter | `openrouter/~anthropic/claude-sonnet-latest` | 1,000,000 | $2 | $10 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索 |
| OpenRouter | `openrouter/~deepseek/deepseek-flash-latest` | 1,048,576 | $0.13 | $0.52 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出 |
| OpenRouter | `openrouter/~deepseek/deepseek-pro-latest` | 1,048,576 | $0.57816 | $1.73448 | 聊天; 推理; 工具调用; 工具选择; 提示词缓存; 结构化输出 |
| OpenRouter | `openrouter/~deepseek/deepseek-v4-flash-latest` | 1,310,720 | $0.04 | $0.08 | 聊天; 推理; 工具调用; 工具选择; 提示词缓存; 结构化输出 |
| OpenRouter | `openrouter/~google/gemini-flash-latest` | 1,048,576 | $0.75 | $3.75 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索; 音频输入; `input_cost_per_audio_token`: $7.5e-07 |
| OpenRouter | `openrouter/~google/gemini-pro-latest` | 1,048,576 | $2 | $12 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索; 音频输入; `input_cost_per_audio_token`: $2e-06 |
| OpenRouter | `openrouter/~moonshotai/kimi-latest` | 1,048,576 | $1.7 | $8.5 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出 |
| OpenRouter | `openrouter/~openai/gpt-astra-latest` | 1,050,000 | $10 | $50 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索 |
| OpenRouter | `openrouter/~openai/gpt-luna-latest` | 1,050,000 | $0.2 | $1.2 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索 |
| OpenRouter | `openrouter/~openai/gpt-mini-latest` | 400,000 | $0.75 | $4.5 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索 |
| OpenRouter | `openrouter/~openai/gpt-sol-latest` | 1,050,000 | $2 | $10 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索 |
| OpenRouter | `openrouter/~openai/gpt-terra-latest` | 1,050,000 | $2 | $12 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索 |
| OpenRouter | `openrouter/~x-ai/grok-latest` | 500,000 | $2 | $6 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; PDF 输入; 网络搜索 |
| OpenRouter | `openrouter/~z-ai/glm-flash-latest` | 1,310,720 | $0.075 | $0.25 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出 |
| OpenRouter | `openrouter/~z-ai/glm-latest` | 1,310,720 | $0.8442 | $2.6532 | 聊天; 推理; 工具调用; 工具选择; 提示词缓存; 结构化输出 |
| Qwen | `qwen_ai_platform/qwen3.8-flash` | 991,808 | $0.15 | $0.47 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; 网络搜索; 视频输入 |
| Qwen | `qwen_ai_platform/qwen3.8-omni-flash` | 991,808 | $0.15 | $0.47 | 聊天; 推理; 视觉; 工具调用; 工具选择; 提示词缓存; 结构化输出; 网络搜索; 音频输入; 视频输入 |
| Together AI | `together_ai/NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO` | - | $0.6 | $0.6 | 聊天 |
| Together AI | `together_ai/Qwen/Qwen2-1.5B-Instruct` | - | $0.02 | $0.02 | 聊天 |
| Together AI | `together_ai/Qwen/Qwen2-72B-Instruct` | - | $0.9 | $0.9 | 聊天 |
| Together AI | `together_ai/Qwen/Qwen2-VL-72B-Instruct` | - | $1.2 | $1.2 | 聊天 |
| Together AI | `together_ai/Qwen/Qwen2.5-14B-Instruct` | - | $0.8 | $0.8 | 聊天 |
| Together AI | `together_ai/Qwen/Qwen2.5-72B-Instruct` | - | $1.2 | $1.2 | 聊天 |
| Together AI | `together_ai/Qwen/Qwen2.5-Coder-32B-Instruct` | - | $0.8 | $0.8 | 聊天 |
| Together AI | `together_ai/Qwen/Qwen2.5-VL-72B-Instruct` | - | $1.95 | $8 | 聊天 |
| Together AI | `together_ai/arcee-ai/trinity-mini` | - | $0.045 | $0.15 | 聊天 |
| Together AI | `together_ai/deepseek-ai/DeepSeek-R1-Distill-Llama-70B` | - | $2 | $2 | 聊天 |
| Together AI | `together_ai/deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B` | - | $0.18 | $0.18 | 聊天 |
| Together AI | `together_ai/deepseek-ai/DeepSeek-R1-Distill-Qwen-14B` | - | $1.6 | $1.6 | 聊天 |
| Together AI | `together_ai/deepseek-ai/DeepSeek-V4.1-Flash` | 1,048,576 | $0.3 | $1.2 | 聊天; 工具调用; 工具选择; 提示词缓存; 结构化输出 |
| Together AI | `together_ai/deepseek-ai/deepseek-coder-33b-instruct` | - | $0.8 | $0.8 | 聊天 |
| Together AI | `together_ai/google/gemma-2-27b-it` | - | $0.8 | $0.8 | 聊天 |
| Together AI | `together_ai/meta-llama/Llama-3-8b-chat-hf` | - | $0.2 | $0.2 | 聊天 |
| Together AI | `together_ai/meta-llama/Llama-3.1-405B-Instruct` | - | $3.5 | $3.5 | 聊天 |
| Together AI | `together_ai/meta-llama/Llama-3.2-1B-Instruct` | - | $0.06 | $0.06 | 聊天 |
| Together AI | `together_ai/meta-llama/Llama-3.2-3B-Instruct` | - | $0.06 | $0.06 | 聊天 |
| Together AI | `together_ai/meta-llama/Meta-Llama-3-70B-Instruct-Turbo` | - | $0.88 | $0.88 | 聊天 |
| Together AI | `together_ai/meta-llama/Meta-Llama-3-8B-Instruct` | - | $0.2 | $0.2 | 聊天 |
| Together AI | `together_ai/nvidia/Llama-3.1-Nemotron-70B-Instruct-HF` | - | $0.88 | $0.88 | 聊天 |
| TypeSafe | `typesafe/jev-1.13.0` | - | $0.042 | $0 | - |
| TypeSafe | `typesafe/jev-latest` | - | $0.042 | $0 | - |
| TypeSafe | `typesafe/jev-preview` | - | $0.042 | $0 | - |
| Vertex AI | `vertex_ai/gemini-2.5-flash-native-audio` | - | $0.5 | $2 | 实时; `input_cost_per_audio_token`: $3e-06; `output_cost_per_audio_token`: $1.2e-05 |
| Vertex AI | `vertex_ai/gemini-2.5-flash-preview-tts` | - | $0.5 | $10 | 语音; `output_cost_per_audio_token`: $1e-05; `input_cost_per_token_batches`: $2.5e-07 |
| Vertex AI | `vertex_ai/gemini-3.1-flash-live-preview` | - | $0.75 | $4.5 | 实时; `input_cost_per_second`: $8.333333333e-05; `input_cost_per_audio_token`: $3e-06; `output_cost_per_audio_token`: $1.2e-05 |
| Vertex AI | `vertex_ai/gemini-3.1-flash-tts-preview` | - | $1 | $20 | 语音; `output_cost_per_audio_token`: $2e-05; `input_cost_per_token_batches`: $5e-07 |
| Vertex AI | `vertex_ai/gemini-3.5-transcribe` | - | - | $12 | 转录; `input_cost_per_second`: $5e-05; `input_cost_per_audio_token`: $2e-06 |
| Vertex AI | `vertex_ai/gemini-3.5-transcribe-live` | - | - | $21 | 转录; `input_cost_per_second`: $8.333333333e-05; `input_cost_per_audio_token`: $3.5e-06 |
| Vertex AI | `vertex_ai/gemini-omni-1.1-flash` | - | $1.5 | $9 | 聊天 |
| Vertex AI | `vertex_ai/gemini-robotics-er-2` | - | $1 | $5 | 聊天; `input_cost_per_token_batches`: $5e-07; `output_cost_per_token_batches`: $2.5e-06 |
| Vertex AI | `vertex_ai/gemma-4-26b-a4b-it` | - | $0.15 | $0.6 | 聊天 |
| Volcengine | `volcengine/doubao-seed-2-1-pro-260628` | 256,000 | $0.8625 | $4.3125 | 聊天; 推理; 视觉; 工具调用; 提示词缓存 |
| Volcengine | `volcengine/doubao-seed-2-1-turbo-260628` | 256,000 | $0.43125 | $2.15625 | 聊天; 推理; 视觉; 工具调用; 提示词缓存 |
| Weights & Biases | `wandb/zai-org/GLM-5.3-Flash` | 1,049,000 | $0.15 | $0.5 | 聊天; 推理; 工具调用; 工具选择; 提示词缓存; 结构化输出 |
| xAI | `xai/grok-voice-transcribe-1.0` | - | - | - | 转录; `input_cost_per_second`: $2.778e-05; `output_cost_per_second`: $0 |
| xAI | `xai/grok-voice-transcribe-2.0` | - | - | - | 转录; `input_cost_per_second`: $2.778e-05; `output_cost_per_second`: $0 |

#### 更新定价 (147 models) {#updated-pricing-147-models}

| 提供商 / 模型 | 更改后的 token 价格（美元/百万 token） |
| --- | --- |
| `amazon.nova-lite-v1:0` | Cache read: not set to $0.015 |
| `amazon.nova-micro-v1:0` | Cache read: not set to $0.00875 |
| `amazon.nova-pro-v1:0` | Cache read: not set to $0.2 |
| `apac.amazon.nova-lite-v1:0` | Cache read: not set to $0.01575 |
| `apac.amazon.nova-micro-v1:0` | Cache read: not set to $0.00925 |
| `apac.amazon.nova-pro-v1:0` | Cache read: not set to $0.21 |
| `azure/eu/gpt-4o-2024-11-20` | Cache read: not set to $1.375 |
| `azure/eu/gpt-5.1` | Input: $1.38 to $1.375; Cache read: $0.14 to $0.1375 |
| `azure/eu/gpt-5.1-chat` | Input: $1.38 to $1.375; Cache read: $0.14 to $0.1375 |
| `azure/eu/gpt-5.1-codex` | Input: $1.38 to $1.375; Cache read: $0.14 to $0.1375 |
| `azure/eu/gpt-5.1-codex-mini` | Cache read: $0.028 to $0.0275 |
| `azure/eu/gpt-5.4` | Cache read: $0.28 to $0.275 |
| `azure/eu/gpt-5.4-2026-03-05` | Cache read: $0.28 to $0.275 |
| `azure/eu/gpt-5.6-sol` | Input: $5.5 to $4.4; Output: $33 to $22; Cache read: $0.55 to $0.44; Cache write: $6.875 to $5.5 |
| `azure/gpt-4o-2024-11-20` | Input: $2.75 to $2.5; Output: $11 to $10 |
| `azure/gpt-4o-mini-2024-07-18` | Input: $0.165 to $0.15; Output: $0.66 to $0.6 |
| `azure/gpt-5.6-sol` | Input: $5 to $4; Output: $30 to $20; Cache read: $0.5 to $0.4; Cache write: $6.25 to $5 |
| `azure/gpt-realtime-1.5-2026-02-23` | Cache read: $4 to $0.4 |
| `azure/gpt-realtime-2025-08-28` | Cache read: $4 to $0.4 |
| `azure/o1-mini` | Input: $1.21 to $1.1; Output: $4.84 to $4.4; Cache read: $0.605 to $0.55 |
| `azure/us/gpt-4.1-nano-2025-04-14` | Cache read: $0.025 to $0.028 |
| `azure/us/gpt-4o-2024-11-20` | Cache read: not set to $1.375 |
| `azure/us/gpt-5.1` | Input: $1.38 to $1.375; Cache read: $0.14 to $0.1375 |
| `azure/us/gpt-5.1-chat` | Input: $1.38 to $1.375; Cache read: $0.14 to $0.1375 |
| `azure/us/gpt-5.1-codex` | Input: $1.38 to $1.375; Cache read: $0.14 to $0.1375 |
| `azure/us/gpt-5.1-codex-mini` | Cache read: $0.028 to $0.0275 |
| `azure/us/gpt-5.4` | Cache read: $0.28 to $0.275 |
| `azure/us/gpt-5.4-2026-03-05` | Cache read: $0.28 to $0.275 |
| `azure/us/gpt-5.6-sol` | Input: $5.5 to $4.4; Output: $33 to $22; Cache read: $0.55 to $0.44; Cache write: $6.875 to $5.5 |
| `azure/us/o4-mini-2025-04-16` | Cache read: $0.31 to $0.303 |
| `azure_ai/FW-GLM-5.2-Fast` | Input: $2.1 to $2.31; Output: $6.6 to $7.26; Cache read: $0.21 to $0.231 |
| `azure_ai/FW-Inkling` | Input: $1 to $1.1; Output: $4.05 to $4.46; Cache read: $0.17 to $0.19 |
| `azure_ai/FW-Kimi-K3` | Input: $3.3 to $3; Output: $16.5 to $15; Cache read: $0.33 to $0.3 |
| `azure_ai/FW-Nemotron-3-Ultra-NVFP4` | Input: $0.6 to $0.66; Output: $2.4 to $2.64; Cache read: $0.119 to $0.13 |
| `azure_ai/Llama-4-Maverick-17B-128E-Instruct-FP8` | Input: $1.41 to $0.25; Output: $0.35 to $1 |
| `azure_ai/Phi-4-mini-reasoning` | Input: $0.08 to $0.075; Output: $0.32 to $0.3 |
| `bedrock/us-gov-east-1/amazon.nova-pro-v1:0` | Cache read: not set to $0.24 |
| `bedrock/us-gov-west-1/amazon.nova-lite-v1:0` | Cache read: not set to $0.018 |
| `bedrock/us-gov-west-1/amazon.nova-micro-v1:0` | Cache read: not set to $0.0105 |
| `bedrock/us-gov-west-1/amazon.nova-pro-v1:0` | Cache read: not set to $0.24 |
| `bedrock_mantle/openai.gpt-5.6-sol` | Input: $5.5 to $4.4; Output: $33 to $22; Cache read: $0.55 to $0.44; Cache write: $6.875 to $5.5 |
| `chatgpt-image-latest` | Output: not set to $10 |
| `deep-research-pro-preview-12-2025` | Cache read: not set to $0.2 |
| `eu.amazon.nova-lite-v1:0` | Cache read: not set to $0.0195 |
| `eu.amazon.nova-micro-v1:0` | Cache read: not set to $0.0115 |
| `eu.amazon.nova-pro-v1:0` | Cache read: not set to $0.2625 |
| `fireworks_ai/accounts/fireworks/models/deepseek-v4-pro` | Input: $1.74 to $1.2; Output: $3.48 to $1.2; Cache read: $0.145 to $0.6 |
| `fireworks_ai/accounts/fireworks/models/qwen3-reranker-8b` | Input: $0 to $0.2 |
| `fireworks_ai/deepseek-v4-pro` | Input: $1.74 to $1.2; Output: $3.48 to $1.2; Cache read: $0.145 to $0.6 |
| `gemini-2.0-flash` | Input: $0.1 to $0.15; Output: $0.4 to $0.6 |
| `gemini-3-pro-image` | Cache read: not set to $0.2 |
| `gemini-3.1-flash-image` | Cache read: not set to $0.05 |
| `gemini-flash-latest` | Input: $0.3 to $0.75; Output: $2.5 to $3.75; Cache read: $0.03 to $0.075 |
| `gemini-flash-lite-latest` | Input: $0.1 to $0.3; Output: $0.4 to $2.5; Cache read: $0.01 to $0.03 |
| `gemini-pro-latest` | Input: $1.25 to $2; Output: $10 to $12; Cache read: $0.125 to $0.2 |
| `gemini/gemini-flash-latest` | Input: $0.3 to $0.75; Output: $2.5 to $3.75; Cache read: $0.03 to $0.075 |
| `gemini/gemini-flash-lite-latest` | Input: $0.1 to $0.3; Output: $0.4 to $2.5; Cache read: $0.01 to $0.03 |
| `gemini/gemini-pro-latest` | Input: $1.25 to $2; Output: $10 to $12; Cache read: $0.125 to $0.2 |
| `gemini/gemini-robotics-er-2-preview` | Input: $2 to $1; Output: $10 to $5; Cache read: $0.2 to $0.1 |
| `gpt-4o-mini-tts` | Input: $2.5 to $0.6 |
| `gpt-4o-mini-tts-2025-03-20` | Input: $2.5 to $0.6 |
| `gpt-4o-mini-tts-2025-12-15` | Input: $2.5 to $0.6 |
| `gpt-realtime-mini` | Cache read: not set to $0.06 |
| `inception/mercury-2.5` | Cache read: not set to $0.02 |
| `mistral/codestral-mamba-latest` | Cache read: not set to $0.025 |
| `mistral/devstral-latest` | Cache read: not set to $0.04 |
| `mistral/devstral-medium-latest` | Cache read: not set to $0.04 |
| `mistral/devstral-small-latest` | Cache read: not set to $0.01 |
| `mistral/mistral-code-agent-latest` | Cache read: not set to $0.04 |
| `mistral/mistral-medium-3` | Cache read: not set to $0.15 |
| `mistral/mistral-small` | Cache read: not set to $0.01 |
| `mistral/mistral-tiny` | Cache read: not set to $0.025 |
| `mistral/open-mistral-nemo` | Cache read: not set to $0.03 |
| `mistral/pixtral-large-latest` | Cache read: not set to $0.2 |
| `mistral/voxtral-small-2507` | Cache read: not set to $0.01 |
| `mistral/voxtral-small-latest` | Cache read: not set to $0.01 |
| `openrouter/anthropic/claude-3-haiku` | Cache read: not set to $0.03; Cache write: not set to $0.3 |
| `openrouter/bytedance/ui-tars-1.5-7b` | Cache read: not set to $0.1 |
| `openrouter/deepseek/deepseek-r1-0528` | Cache read: not set to $0.35 |
| `openrouter/deepseek/deepseek-v3.2` | Cache read: not set to $0.1345 |
| `openrouter/deepseek/deepseek-v4-flash` | Input: $0.0854 to $0.03724; Output: $0.1708 to $0.07448; Cache read: $0.01708 to $0.007448 |
| `openrouter/deepseek/deepseek-v4-flash-0731` | Input: $0.065 to $0.04; Output: $0.18 to $0.08 |
| `openrouter/deepseek/deepseek-v4-flash-vision-exp` | Input: $0.22 to $0.2156; Output: $0.66 to $0.6468; Cache read: $0.007 to $0.00686 |
| `openrouter/deepseek/deepseek-v4-pro` | Input: $0.859908 to $0.422298; Output: $1.719816 to $0.844596; Cache read: $0.071659 to $0.0351915 |
| `openrouter/deepseek/deepseek-v4-pro-0813` | Input: $0.57948 to $0.57816; Output: $1.73844 to $1.73448; Cache read: $0.019316 to $0.018396 |
| `openrouter/deepseek/deepseek-v4.1-flash` | Input: $0.15 to $0.3; Output: $0.6 to $1.2; Cache read: $0.003 to $0.006 |
| `openrouter/google/gemini-2.5-flash` | Cache write: not set to $0.0833333333 |
| `openrouter/google/gemini-2.5-flash-lite` | Cache write: not set to $0.0833333333 |
| `openrouter/google/gemini-2.5-pro` | Cache write: not set to $0.375 |
| `openrouter/google/gemini-3-flash-preview` | Cache write: not set to $0.0833333333 |
| `openrouter/google/gemini-3.1-flash-lite` | Cache write: not set to $0.0833333333 |
| `openrouter/google/gemini-3.1-flash-lite-preview` | Cache write: not set to $0.0833333333 |
| `openrouter/google/gemini-3.1-pro-preview` | Cache write: not set to $0.375 |
| `openrouter/google/gemini-3.5-flash` | Cache write: not set to $0.0833333333 |
| `openrouter/google/gemini-3.5-flash-lite` | Cache write: not set to $0.0833333333 |
| `openrouter/google/gemini-3.6-flash` | Cache write: not set to $0.0416666667 |
| `openrouter/google/gemini-3.7-flash` | Cache write: not set to $0.0416666667 |
| `openrouter/google/gemini-3.8-flash` | Cache write: not set to $0.0416666667 |
| `openrouter/google/gemma-4-26b-a4b-it` | Input: $0.042 to $0.09; Output: $0.22 to $0.3; Cache read: not set to $0.05 |
| `openrouter/gryphe/mythomax-l2-13b` | Input: $0.06 to $0.08; Output: $0.06 to $0.11 |
| `openrouter/meta-llama/llama-4-maverick` | Input: $0.2 to $0.1875; Output: $0.696 to $0.6525 |
| `openrouter/minimax/minimax-m1` | Input: $0.55 to $0.4 |
| `openrouter/mistralai/devstral-2512` | Cache read: not set to $0.04 |
| `openrouter/mistralai/ministral-14b-2512` | Cache read: not set to $0.02 |
| `openrouter/mistralai/ministral-3b-2512` | Cache read: not set to $0.01 |
| `openrouter/mistralai/ministral-8b-2512` | Cache read: not set to $0.015 |
| `openrouter/mistralai/mistral-large` | Cache read: not set to $0.2 |
| `openrouter/mistralai/mistral-large-2512` | Input: $0.5 to $0.55; Output: $1.5 to $1.65; Cache read: not set to $0.055 |
| `openrouter/mistralai/mistral-small-3.2-24b-instruct` | Input: $0.075 to $0.09375; Output: $0.2 to $0.25 |
| `openrouter/mistralai/mixtral-8x22b-instruct` | Cache read: not set to $0.2 |
| `openrouter/moonshotai/kimi-k2.7-code` | Input: $0.71 to $0.7062; Output: $3.5 to $3.21; Cache read: $0.15 to $0.18 |
| `openrouter/moonshotai/kimi-k3` | Input: $2.1 to $1.7; Output: $10.53 to $8.5; Cache read: $0.235 to $0.17 |
| `openrouter/nvidia/nemotron-3-nano-30b-a3b` | Input: $0.05 to $0.06; Output: $0.2 to $0.24 |
| `openrouter/nvidia/nemotron-3-super-120b-a12b` | Input: $0.085 to $0.08; Output: $0.4 to $0.45 |
| `openrouter/nvidia/nemotron-3-ultra-550b-a55b` | Input: $0.625 to $0.6; Output: $3.125 to $2.4; Cache read: $0.1875 to $0.12 |
| `openrouter/nvidia/nemotron-3.5-lightning` | Input: $0.08 to $0.07; Cache read: not set to $0.04 |
| `openrouter/openai/gpt-5.6-luna` | Cache write: not set to $0.25 |
| `openrouter/openai/gpt-5.6-terra` | Cache write: not set to $2.5 |
| `openrouter/openai/gpt-oss-120b` | Input: $0.037 to $0.15; Output: $0.17 to $0.6; Cache read: not set to $0.075 |
| `openrouter/openai/gpt-oss-20b` | Cache read: not set to $0.03 |
| `openrouter/qwen/qwen-plus-2025-07-28` | Cache read: not set to $0.052; Cache write: not set to $0.325 |
| `openrouter/qwen/qwen3-14b` | Input: $0.2275 to $0.12; Output: $0.91 to $0.24 |
| `openrouter/qwen/qwen3-235b-a22b-2507` | Input: $0.22 to $0.0875; Output: $0.88 to $0.35; Cache read: not set to $0.0175 |
| `openrouter/qwen/qwen3-30b-a3b-instruct-2507` | Input: $0.09 to $0.04815; Output: $0.3 to $0.19305 |
| `openrouter/qwen/qwen3-coder` | Cache read: not set to $0.1 |
| `openrouter/qwen/qwen3-coder-plus` | Cache read: not set to $0.13; Cache write: not set to $0.8125 |
| `openrouter/qwen/qwen3-vl-30b-a3b-instruct` | Input: $0.15 to $0.13; Output: $0.6 to $0.52 |
| `openrouter/qwen/qwen3.5-397b-a17b` | Cache read: not set to $0.225 |
| `openrouter/qwen/qwen3.6-plus` | Cache write: not set to $0.40625 |
| `openrouter/undi95/remm-slerp-l2-13b` | Input: $0.45 to $0.35 |
| `openrouter/z-ai/glm-4.7-flash` | Input: $0.06 to $0.0605 |
| `openrouter/z-ai/glm-5` | Cache read: not set to $0.12 |
| `openrouter/z-ai/glm-5.2` | Input: $0.6 to $0.5544; Output: $2 to $1.7424; Cache read: $0.15 to $0.10296 |
| `openrouter/z-ai/glm-5.3` | Input: $1.4 to $0.896; Output: $4.4 to $2.816; Cache read: $0.14 to $0.1664 |
| `openrouter/z-ai/glm-5.3-flash` | Input: $0.15 to $0.09; Output: $0.5 to $0.3; Cache read: $0.03 to $0.018 |
| `replicate/google/gemini-2.5-flash` | Input: $2.5 to $0.3 |
| `us.amazon.nova-lite-v1:0` | Cache read: not set to $0.015 |
| `us.amazon.nova-micro-v1:0` | Cache read: not set to $0.00875 |
| `us.amazon.nova-premier-v1:0` | Cache read: not set to $0.625 |
| `us.amazon.nova-pro-v1:0` | Cache read: not set to $0.2 |
| `vercel_ai_gateway/google/gemini-2.5-flash` | Cache read: not set to $0.03 |
| `vercel_ai_gateway/google/gemini-2.5-pro` | Input: $2.5 to $1.25; Cache read: not set to $0.125 |
| `vertex_ai/deep-research-pro-preview-12-2025` | Cache read: not set to $0.2 |
| `vertex_ai/gemini-3-pro-image` | Cache read: not set to $0.2 |
| `vertex_ai/gemini-3.1-flash-image` | Cache read: not set to $0.05 |
| `wandb/nvidia/NVIDIA-Nemotron-3-Ultra-550B-A55B` | Input: $0.75 to $0.5; Output: $2.75 to $2.15; Cache read: $0.15 to $0.1 |
| `wandb/nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B` | Input: $0.1 to $0.07; Output: $0.25 to $0.2; Cache read: $0.05 to $0.04 |

注册表还会更新能力标志、上下文/输出限制、非token费率和弃用日期。移除了五个条目：`friendliai/meta-llama-3.1-70b-instruct`、`friendliai/meta-llama-3.1-8b-instruct`、`github_copilot/gemini-2.5-pro`、`github_copilot/gemini-3-pro-preview` 和 `gmi/google/gemini-3-pro-preview`

### Amazon Bedrock {#amazon-bedrock}

- 通过一个类型化的认证结构在每次 STS 调用中发送 aws_session_tags - [PR #40500](https://github.com/BerriAI/litellm/pull/40500)
- 根据 Bedrock toolUseId 约束清理客户端 tool_call ID - [PR #40872](https://github.com/BerriAI/litellm/pull/40872)
- 在文件内容下载中携带 s3_endpoint_url 和 s3_region_name - [PR #41138](https://github.com/BerriAI/litellm/pull/41138)
- 在 Web 身份会话策略中授予 rerank、retrieve、agent 和 agentcore 操作 - [PR #41168](https://github.com/BerriAI/litellm/pull/41168)
- 使提示词 (prompt) 缓存功能在 Nova InvokeModel 路由上生效 - [PR #41343](https://github.com/BerriAI/litellm/pull/41343)
- 从不为 OpenAI 系列模型发出 Converse cachePoint - [PR #41419](https://github.com/BerriAI/litellm/pull/41419)
- 在知识库检索请求中转发 userContext - [PR #41475](https://github.com/BerriAI/litellm/pull/41475)
- 中和孤立的工具块，而不是抛出或注入一个虚拟工具 - [PR #41513](https://github.com/BerriAI/litellm/pull/41513)
- 在 Bedrock Realtime 中支持 aws-sdk-bedrock-runtime 0.10/0.11 - [PR #41542](https://github.com/BerriAI/litellm/pull/41542)
- 为 Opus 4.8 和第五代 Claude 在模型映射上限制 Invoke 工具搜索 - [PR #41702](https://github.com/BerriAI/litellm/pull/41702)
- 根据 inputTextTokenCount 对 Bedrock Titan 嵌入 (embedding) 批处理行进行计费 - [PR #41767](https://github.com/BerriAI/litellm/pull/41767)
- 在 Converse 上将 OpenAI GPT 和 xAI Grok 模型的 maxTokens 限制为最小 16 个 token - [PR #41870](https://github.com/BerriAI/litellm/pull/41870)
- 在 Bedrock 和 Anthropic Claude 工具上遵守 eager_input_streaming - [PR #41871](https://github.com/BerriAI/litellm/pull/41871)
- 当设置了 AWS_BEARER_TOKEN_BEDROCK 时，使用部署凭据签署批量检索和取消请求 - [PR #41904](https://github.com/BerriAI/litellm/pull/41904)

### Anthropic {#anthropic}

- 当消息携带 output_config 时，添加 per-turn-control beta - [PR #41189](https://github.com/BerriAI/litellm/pull/41189)
- 在 beta headers 配置中注册 thinking-binding-controls-2026-08-01 - [PR #41203](https://github.com/BerriAI/litellm/pull/41203)
- 在流式输出 (streaming) 时容忍没有使用量的 message_delta 事件 - [PR #41336](https://github.com/BerriAI/litellm/pull/41336)
- 将 message_start 中的服务模型携带到流式块中 - [PR #41446](https://github.com/BerriAI/litellm/pull/41446)
- 根据 reasoning_content 估算中断的 Anthropic 流式输出使用量 - [PR #41503](https://github.com/BerriAI/litellm/pull/41503)
- 在 /v1/messages 上保留 Gemini 目标的 cache_control 并规范化 Anthropic ttl 单位 - [PR #41938](https://github.com/BerriAI/litellm/pull/41938)

### Azure {#azure}

- 支持 FLUX.2 flex 镜像 - [PR #39424](https://github.com/BerriAI/litellm/pull/39424)
- 在图像生成请求中发送已解析的 Entra ID token - [PR #40147](https://github.com/BerriAI/litellm/pull/40147)
- 从文件和图像内容部分剥离 LiteLLM 格式字段 - [PR #41275](https://github.com/BerriAI/litellm/pull/41275)
- 在向量存储搜索路径后保留 api-version 查询 - [PR #41384](https://github.com/BerriAI/litellm/pull/41384)
- 在带有前缀的 API 基础后分类 Azure Speech 短音频 - [PR #41882](https://github.com/BerriAI/litellm/pull/41882)
- 当请求没有工具时，删除 tool_choice - [PR #42031](https://github.com/BerriAI/litellm/pull/42031)

### Bedrock Mantle {#bedrock-mantle}

- 根据区域成本行对 GovCloud 区域定价，并接受带有区域前缀的模型名称 - [PR #39846](https://github.com/BerriAI/litellm/pull/39846)
- 接受并转发 gpt-5.x 聊天补全 (chat completion) 的详细程度 - [PR #41509](https://github.com/BerriAI/litellm/pull/41509)

### DashScope {#dashscope}

- 将 reasoning_effort 转发给提供商 (provider) - [PR #37506](https://github.com/BerriAI/litellm/pull/37506)

### Fireworks AI {#fireworks-ai}

- 将短模型名称解析为长成本映射键 - [PR #40929](https://github.com/BerriAI/litellm/pull/40929)
- 将字典形式的 reasoning_effort 扁平化为其 effort 字符串 - [PR #41335](https://github.com/BerriAI/litellm/pull/41335)
- 通过共享成本计算器对缓存写入、推理和音频 token 进行计费 - [PR #41339](https://github.com/BerriAI/litellm/pull/41339)
- 在成本图中恢复 minimax-m3 上的 supports_vision - [PR #41699](https://github.com/BerriAI/litellm/pull/41699)
- 当映射没有缓存读取速率时，将 fireworks 缓存输入默认设置为文档中规定的 50% 折扣 - [PR #41917](https://github.com/BerriAI/litellm/pull/41917)

### Gemini 和 Vertex AI {#gemini-and-vertex-ai}

- 端到端地计费 Gemini Live 会话 - [PR #40915](https://github.com/BerriAI/litellm/pull/40915)
- 将 Gemini 3.7 和 3.8 Flash 的最小思考（minimal thinking）映射为低 - [PR #41201](https://github.com/BerriAI/litellm/pull/41201)
- 计费 Gemini Omni Interactions 使用量和透传（passthrough）时的 Veo sampleCount - [PR #41322](https://github.com/BerriAI/litellm/pull/41322)
- 将提供商的 modelVersion 传播到响应模型 - [PR #41338](https://github.com/BerriAI/litellm/pull/41338)
- 从 `/v1/files/{id}/content` 流式传输 GCS 批处理输出文件 - [PR #41506](https://github.com/BerriAI/litellm/pull/41506)
- 将 Vertex AI gemma-4-26b-a4b-it-maas 的上下文窗口设置为 262144 - [PR #41887](https://github.com/BerriAI/litellm/pull/41887)
- 保留具有 finishReason 且无内容的候选者 - [PR #41892](https://github.com/BerriAI/litellm/pull/41892)

### Mistral {#mistral}

- 接受所有模型上的 reasoning_effort，并为 Codex 兼容性删除 client_metadata - [PR #41062](https://github.com/BerriAI/litellm/pull/41062)
- 为缺失缓存读取定价的 Mistral 聊天模型添加定价 - [PR #41736](https://github.com/BerriAI/litellm/pull/41736)

### OpenAI {#openai}

- 添加 openai_system_messages_first 以将系统消息置于提示词缓存的首位 - [PR #41304](https://github.com/BerriAI/litellm/pull/41304)
- 将带日期的 OpenAI/Azure 快照解析为其不带日期的成本映射条目 - [PR #41423](https://github.com/BerriAI/litellm/pull/41423)
- 当设置了 drop_params 时，为 gpt-5 推理模型删除 top_p - [PR #41469](https://github.com/BerriAI/litellm/pull/41469)

### xAI {#xai}

- 在 xAI Responses API 上保留“instructions”，以便系统消息在网络搜索中得以保留 - [PR #38254](https://github.com/BerriAI/litellm/pull/38254)
- 遵守 xAI Responses API 上嵌套的 web_search 过滤器 - [PR #38268](https://github.com/BerriAI/litellm/pull/38268)
- 停止向 xAI 已停用的 Live Search 路径发送 web_search_options - [PR #38278](https://github.com/BerriAI/litellm/pull/38278)

### 模型目录和定价 {#model-catalog-and-pricing}

- 自动将 Friendli 模型元数据同步到价格注册表 - [PR #35918](https://github.com/BerriAI/litellm/pull/35918)
- 同步 Vertex AI 价格：14 个模型 - [PR #40955](https://github.com/BerriAI/litellm/pull/40955)
- 添加 Azure gpt-chat-latest 费率并删除已停用的 friendliai llama-3.1 条目 - [PR #40976](https://github.com/BerriAI/litellm/pull/40976)
- 从回退泛化规则中回填提供商范围的 fill_missing_for_providers - [PR #41093](https://github.com/BerriAI/litellm/pull/41093)
- 滚动注册表审计：Gemini 最新别名、Nova 缓存定价、OpenRouter/Together 同步、Mistral GLM 5.3、Azure 快照、Grok 缓存 - [PR #41112](https://github.com/BerriAI/litellm/pull/41112)
- 同步 Azure、Azure AI、Gemini、OpenAI、Bedrock、Together AI、Fireworks 和 Vertex 价格：278 个模型，59 个新增，30 个已弃用 - [PR #41154](https://github.com/BerriAI/litellm/pull/41154)
- 添加 aihubmix 提供商定价条目 - [PR #41179](https://github.com/BerriAI/litellm/pull/41179)
- 添加与提供商无关的 Gemini 2.5+ 聊天基线回退（fallback）泛化 - [PR #41320](https://github.com/BerriAI/litellm/pull/41320)
- 同步 Google Gemini 价格：22 个模型 - [PR #41457](https://github.com/BerriAI/litellm/pull/41457)
- 去除文本合并留下的 Nova cache_read_input_token_cost 键的重复项 - [PR #41496](https://github.com/BerriAI/litellm/pull/41496)
- 同步 Together AI 价格：6 个模型，6 个已弃用 [同步失败：Google Gemini] - [PR #41570](https://github.com/BerriAI/litellm/pull/41570)
- 将 stealth/union-alpha 添加到模型成本映射 - [PR #41576](https://github.com/BerriAI/litellm/pull/41576)
- 滚动注册表审计：Azure 退役日期、Bedrock Mantle Grok 4.3 上下文窗口 - [PR #41597](https://github.com/BerriAI/litellm/pull/41597)
- 同步 OpenRouter 价格：443 个模型，191 个新增，4 个已弃用 - [PR #41727](https://github.com/BerriAI/litellm/pull/41727)
- 添加 qwen3.8 flash 行，修复 Cohere embed v3 上下文、Bedrock Mantle 和 OpenRouter 定价 - [PR #41754](https://github.com/BerriAI/litellm/pull/41754)
- 同步 OpenRouter 价格：2 个模型，1 个已弃用 - [PR #41770](https://github.com/BerriAI/litellm/pull/41770)
- 同步 OpenRouter 价格：15 个模型，6 个已弃用 - [PR #41772](https://github.com/BerriAI/litellm/pull/41772)
- 同步 OpenRouter 价格：172 个模型，2 个新增 - [PR #41833](https://github.com/BerriAI/litellm/pull/41833)
- 在模型价格模式生成器中将 off_peak_pricing 分类为结构化对象 - [PR #41847](https://github.com/BerriAI/litellm/pull/41847)
- 从提供商目录中回填经销商 Gemini 条目并清除已停用的 ID - [PR #41902](https://github.com/BerriAI/litellm/pull/41902)
- 删除 Anthropic 弃用底线并更正 Azure gpt-4.1-nano 停用日期 - [PR #41964](https://github.com/BerriAI/litellm/pull/41964)
- 同步 Azure 价格：5 个模型，5 个已弃用 - [PR #41966](https://github.com/BerriAI/litellm/pull/41966)
- 同步 OpenRouter 价格：2 个模型 - [PR #41996](https://github.com/BerriAI/litellm/pull/41996)
- 同步 OpenRouter 价格：2 个模型 - [PR #42006](https://github.com/BerriAI/litellm/pull/42006)
- 同步 OpenRouter 价格：5 个模型 - [PR #42058](https://github.com/BerriAI/litellm/pull/42058)
- 同步 OpenRouter 价格：2 个模型 - [PR #42063](https://github.com/BerriAI/litellm/pull/42063)

### 通用 {#general}

- 在响应仍在读取时保持处理程序活跃 - [PR #34829](https://github.com/BerriAI/litellm/pull/34829)
- 在秘密正则表达式之前，对每个日志记录扫描一次并折叠 base64 有效负载 - [PR #40934](https://github.com/BerriAI/litellm/pull/40934)
- 保留从 litellm_proxy 400 映射的 BadRequestError 的正文和代理头 - [PR #40994](https://github.com/BerriAI/litellm/pull/40994)
- 将 litellm 参数排除在提供商请求正文之外 - [PR #41018](https://github.com/BerriAI/litellm/pull/41018)
- 在 httpx 处理程序路径上，将 extra_headers 排除在聊天请求正文之外 - [PR #41141](https://github.com/BerriAI/litellm/pull/41141)
- 对于不可翻译的 tool_choice，返回 400 而不是 500 - [PR #41234](https://github.com/BerriAI/litellm/pull/41234)
- 为 httpx 客户端选择启用出站 HTTP/2 - [PR #41268](https://github.com/BerriAI/litellm/pull/41268)
- 在第一次补全调用之前接受 custom_provider_map 提供商 - [PR #41300](https://github.com/BerriAI/litellm/pull/41300)
- 保留已解析的提供商，以便路由器自定义定价可用于 Azure AI 部署 - [PR #41623](https://github.com/BerriAI/litellm/pull/41623)
- 将 internal_server_error 保留为上游 500 的公共类型 - [PR #41930](https://github.com/BerriAI/litellm/pull/41930)
- 记忆共享节点并在超出深度上限时关闭失败 - [PR #41952](https://github.com/BerriAI/litellm/pull/41952)

## LLM API 端点 {#llm-api-endpoints}

### Responses API {#responses-api}

- 阻止托管的 Responses WebSocket 将 litellm_params 泄露到提供商请求正文中 - [PR #33101](https://github.com/BerriAI/litellm/pull/33101)
- 将 Responses API 路由到 Foundry 模型的原生 /openai/v1/responses - [PR #33856](https://github.com/BerriAI/litellm/pull/33856)
- 在 Responses API 流式传输桥中保护空选择块 - [PR #34455](https://github.com/BerriAI/litellm/pull/34455)
- 将推理对象转换为聊天补全推理工作 - [PR #36363](https://github.com/BerriAI/litellm/pull/36363)
- 发出类型化的流式传输失败事件 - [PR #40243](https://github.com/BerriAI/litellm/pull/40243)
- 遵守嵌套的 additional_drop_params 路径 - [PR #40730](https://github.com/BerriAI/litellm/pull/40730)
- 将 Codex additional_tools 输入项提升到聊天桥工具中 - [PR #40989](https://github.com/BerriAI/litellm/pull/40989)
- 像原生 Responses 路径一样过滤桥接的 kwargs - [PR #41144](https://github.com/BerriAI/litellm/pull/41144)
- 当流式响应在没有使用量的情况下完成时重新计算 token - [PR #41337](https://github.com/BerriAI/litellm/pull/41337)
- 在聊天补全桥中的文本事件之前宣布消息项 - [PR #41564](https://github.com/BerriAI/litellm/pull/41564)
- 将寻址的响应 ID 从桥接的提供商请求中移除 - [PR #41689](https://github.com/BerriAI/litellm/pull/41689)
- 将部署 litellm_params 合并到原生 websocket response.create 帧中 - [PR #41881](https://github.com/BerriAI/litellm/pull/41881)
- 恢复 encrypted_content 并在原生 WebSocket 中继上应用亲和性 - [PR #41893](https://github.com/BerriAI/litellm/pull/41893)
- 对于没有输入的 /v1/responses，返回 400 而不是 500 - [PR #41939](https://github.com/BerriAI/litellm/pull/41939)
- 在聊天补全桥中删除 tool_search 和 local_shell - [PR #41953](https://github.com/BerriAI/litellm/pull/41953)

### Anthropic 消息 {#anthropic-messages}

- 在延迟的 /v1/messages 调用和没有创建速率的价格缓存写入上记录提供商使用情况 - [PR #41172](https://github.com/BerriAI/litellm/pull/41172)
- 将 /v1/messages 中对话中的系统轮次转换为用户轮次以进行聊天补全 - [PR #41493](https://github.com/BerriAI/litellm/pull/41493)
- 将部署 api_base 转发到 /v1/messages 上的代理后续调用 - [PR #41918](https://github.com/BerriAI/litellm/pull/41918)

### 批处理和文件 {#batches-and-files}

- 支持 S3 支持的托管文件的文件删除和列表功能 - [PR #39836](https://github.com/BerriAI/litellm/pull/39836)
- 为 /v1/files 上传添加 general_settings.allowed_file_extensions - [PR #41106](https://github.com/BerriAI/litellm/pull/41106)
- 支持 Mistral 文件/批处理和按页 OCR 批处理成本跟踪 - [PR #41934](https://github.com/BerriAI/litellm/pull/41934)
- 在 LiteLLM 内部运行 hosted_vllm 批处理 - [PR #41942](https://github.com/BerriAI/litellm/pull/41942)

### OCR {#ocr}

- 当回调拦截请求时，保持下载的文档内联 - [PR #41719](https://github.com/BerriAI/litellm/pull/41719)
- 添加仅限 Rust 的 Textract 并在主机钩子后签署提供商请求 - [PR #41977](https://github.com/BerriAI/litellm/pull/41977)
- 设置 DeepSeek OCR 采样默认值 - [PR #41992](https://github.com/BerriAI/litellm/pull/41992)

### 实时和音频 {#realtime-and-audio}

- 将延迟的 Nova Sonic 流失败传播到路由器 - [PR #41064](https://github.com/BerriAI/litellm/pull/41064)
- 当实时会话在没有 LLM callbacks 的情况下结束时，释放 max_parallel_requests 槽位 - [PR #41113](https://github.com/BerriAI/litellm/pull/41113)
- 在实时健康检查中解析 litellm_credential_name - [PR #41173](https://github.com/BerriAI/litellm/pull/41173)
- 添加 Azure AI Speech 直通路由 - [PR #41557](https://github.com/BerriAI/litellm/pull/41557)
- 通过 /v1/realtime 流式传输 Chirp 语音转文本 - [PR #41721](https://github.com/BerriAI/litellm/pull/41721)
- 通过 /v1/audio/transcriptions 添加语音转文本 (Grok Voice Transcribe) - [PR #41914](https://github.com/BerriAI/litellm/pull/41914)

### 向量存储、RAG 和搜索 {#vector-stores-rag-and-search}

- 将 retrieval_filter 从 retrieval_config 转发到向量存储搜索 - [PR #34427](https://github.com/BerriAI/litellm/pull/34427)
- 将 model_group_alias 解析为其目标，用于 /v1/models 元数据 - [PR #41483](https://github.com/BerriAI/litellm/pull/41483)
- 在 /v1/rag/ingest 上解析注册表存储并拒绝没有摄取的提供商 - [PR #41940](https://github.com/BerriAI/litellm/pull/41940)

### 图像生成和编辑 {#image-generation-and-edits}

- 停止转发原始的 `image[]` 和 `mask[]` 表单键 - [PR #39512](https://github.com/BerriAI/litellm/pull/39512)

### 代理到代理 {#agent-to-agent}

- 通过 Entra 身份验证和版本化卡片发现访问 Microsoft Foundry 代理 - [PR #41511](https://github.com/BerriAI/litellm/pull/41511)

### 重排 {#rerank}

- 根据输入记录对 Vertex search_units 进行计费，并为每个重排序响应提供唯一 ID - [PR #35180](https://github.com/BerriAI/litellm/pull/35180)

### 直通端点 {#pass-through-endpoints}

- 在 /claude_code_gateway 下提供 Claude Code 网关协议 - [PR #34267](https://github.com/BerriAI/litellm/pull/34267)
- 将 Vertex 直通成功归因于已解析的路由器部署 - [PR #41307](https://github.com/BerriAI/litellm/pull/41307)
- 为 NIM 对象检测和 OCR /v1/infer 添加 /nvidia_nim 直通路由 - [PR #41316](https://github.com/BerriAI/litellm/pull/41316)
- 当客户端不发送查询参数时，保留目标 URL 查询 - [PR #41448](https://github.com/BerriAI/litellm/pull/41448)
- 停止在 Bedrock 代理运行时直通上转发 LiteLLM 凭证头 - [PR #41504](https://github.com/BerriAI/litellm/pull/41504)
- 添加 Amazon Transcribe 直通，并提供完成时间作业定价 - [PR #41515](https://github.com/BerriAI/litellm/pull/41515)
- Deepgram 流式 /v1/listen WebSocket 直通，支持基于时长的成本跟踪 - [PR #41554](https://github.com/BerriAI/litellm/pull/41554)
- 添加 TypeSafe AI Jev 评估直通，并提供注册表定价的消费跟踪 - [PR #41607](https://github.com/BerriAI/litellm/pull/41607)
- 在 TypeSafe 直通路由上转发所有方法 - [PR #41723](https://github.com/BerriAI/litellm/pull/41723)

### 通用 {#general-1}

- 在映射的错误响应上转发提供商请求 ID 头 - [PR #40925](https://github.com/BerriAI/litellm/pull/40925)
- 当路由省略 call_id 时，从响应元数据中解析 x-litellm-call-id - [PR #41056](https://github.com/BerriAI/litellm/pull/41056)
- 在 LLM API 异常日志中包含 litellm_call_id - [PR #41205](https://github.com/BerriAI/litellm/pull/41205)
- 对请求体中单独的代理转义符返回 400 而不是 500 - [PR #41297](https://github.com/BerriAI/litellm/pull/41297)
- 在特定端点的错误日志和失败响应中传递 litellm_call_id - [PR #41356](https://github.com/BerriAI/litellm/pull/41356)

## 管理端点 / UI {#management-endpoints--ui}

### 管理界面 (Admin UI) {#admin-ui}

- 在日志管理界面 (UI) 中汇总多轮会话时长 - [PR #35388](https://github.com/BerriAI/litellm/pull/35388)
- 注册技能时接受 SSH 克隆 URL - [PR #35418](https://github.com/BerriAI/litellm/pull/35418)
- 对只读管理员隐藏模型页面上的管理员写入表单选项卡 - [PR #38867](https://github.com/BerriAI/litellm/pull/38867)
- 显示视频模型的每秒定价，而不是 $0.00 token 成本 - [PR #39308](https://github.com/BerriAI/litellm/pull/39308)
- 允许团队管理员授予团队所有代理（proxy）模型 - [PR #40196](https://github.com/BerriAI/litellm/pull/40196)
- 在模型更新时保留禁用缓存控制注入点 - [PR #40632](https://github.com/BerriAI/litellm/pull/40632)
- 允许管理员从模型编辑页面更改模型的团队 - [PR #40700](https://github.com/BerriAI/litellm/pull/40700)
- 在热门虚拟密钥 (virtual key) 使用情况表中显示用户归属 - [PR #40729](https://github.com/BerriAI/litellm/pull/40729)
- 在日志表和日志详情抽屉中显示内部用户电子邮件 - [PR #40737](https://github.com/BerriAI/litellm/pull/40737)
- 在按模型划分的缓存泄漏表中列出每个提供商 (provider) - [PR #40875](https://github.com/BerriAI/litellm/pull/40875)
- 在模型信息页面及其原始 JSON 中显示团队别名 - [PR #40992](https://github.com/BerriAI/litellm/pull/40992)
- 将键元数据 JSON 中输入的标签移动到“标签”字段 - [PR #41023](https://github.com/BerriAI/litellm/pull/41023)
- 当花费 (spend) 页面失败时，阻止使用情况导出并标记范围 - [PR #41294](https://github.com/BerriAI/litellm/pull/41294)
- 在 URL 中保留模型表搜索、过滤器、排序和页面 - [PR #41296](https://github.com/BerriAI/litellm/pull/41296)
- 向 API Playground 添加自定义请求头 - [PR #41309](https://github.com/BerriAI/litellm/pull/41309)
- 在模型使用活动中显示每个模型的平均响应时间 - [PR #41313](https://github.com/BerriAI/litellm/pull/41313)
- 配置能力和 Fuse v2 分类器 - [PR #41315](https://github.com/BerriAI/litellm/pull/41315)
- 用于表格和选项卡的共享 URL 状态层 - [PR #41331](https://github.com/BerriAI/litellm/pull/41331)
- 简化能力和 Fuse 高级路由 (routing) 选项 - [PR #41371](https://github.com/BerriAI/litellm/pull/41371)
- 在请求生命周期中保留未计时的护栏 (guardrail) 条目 - [PR #41374](https://github.com/BerriAI/litellm/pull/41374)
- 在 URL 中保留组织 (organization) 和项目列表、详细信息选项卡和键表状态 - [PR #41445](https://github.com/BerriAI/litellm/pull/41445)
- 将 MCP 服务器页面链接到用户连接的 MCP 服务器 - [PR #41888](https://github.com/BerriAI/litellm/pull/41888)
- 在路由 (routing) 详情中显示启发式 v2 分数估算 - [PR #42001](https://github.com/BerriAI/litellm/pull/42001)
- 从管理界面 (Admin UI) 配置网络搜索拦截 - [PR #42007](https://github.com/BerriAI/litellm/pull/42007)
- 报告服务代理（proxy）是否已应用网络搜索拦截 - [PR #42042](https://github.com/BerriAI/litellm/pull/42042)

### 密钥、团队 (team) 和组织 (organization) {#keys-teams-and-organizations}

- 允许代理（proxy）管理员选择团队 (team) 管理员可以编辑的团队 (team) 字段 - [PR #39996](https://github.com/BerriAI/litellm/pull/39996)
- 允许团队 (team) 服务账户密钥使用其自身团队 (team) 的密钥管理端点 - [PR #40807](https://github.com/BerriAI/litellm/pull/40807)
- 通过 agent_id_jwt_field 将 JWT 声明绑定到注册代理 - [PR #40904](https://github.com/BerriAI/litellm/pull/40904)
- 凭证名称冲突时返回 409，使 Terraform 采用成为可选 - [PR #40917](https://github.com/BerriAI/litellm/pull/40917)
- 用于密钥生成、更新和重新生成的统一 custom_key_policy 钩子 - [PR #40921](https://github.com/BerriAI/litellm/pull/40921)
- 允许每个颁发者设置 virtual_key_claim_field - [PR #40927](https://github.com/BerriAI/litellm/pull/40927)
- 添加 POST /management/v1/users/bulk 用于批量用户和团队 (team) 成员创建 - [PR #41028](https://github.com/BerriAI/litellm/pull/41028)
- 添加 POST /management/v1/users/bulk_delete 和 POST `/management/v1/teams/{team_id}/members/bulk_delete` - [PR #41039](https://github.com/BerriAI/litellm/pull/41039)
- 在团队 (team) 列表中显示组织 (organization) 管理员在其他组织 (organization) 中的团队 (team) 成员身份 - [PR #41086](https://github.com/BerriAI/litellm/pull/41086)
- 在 /model_group/info 中向代理（proxy）管理员显示所有模型组 (model group) - [PR #41094](https://github.com/BerriAI/litellm/pull/41094)
- 允许选择加入的团队成员管理他们的路由器 - [PR #41175](https://github.com/BerriAI/litellm/pull/41175)
- 跟踪每个成员的组织花费 - [PR #41255](https://github.com/BerriAI/litellm/pull/41255)
- 在模型访问错误中列出直接分配的团队模型 - [PR #41256](https://github.com/BerriAI/litellm/pull/41256)
- 当 max_budget 为 0 时，强制执行组织 (organization) 预算 (budget) - [PR #41271](https://github.com/BerriAI/litellm/pull/41271)
- 根据 active、expired、revoked 或 deleted 状态过滤 /key/list，并从 /key/info 提供已删除的密钥 - [PR #41311](https://github.com/BerriAI/litellm/pull/41311)
- 团队 (team) 级别的 model_max_budget，支持密钥级别的覆盖 - [PR #41330](https://github.com/BerriAI/litellm/pull/41330)
- 将 team_member_budget 更新应用于仍使用团队默认设置的成员 - [PR #41347](https://github.com/BerriAI/litellm/pull/41347)
- 当成员没有预算时，跟踪团队成员的花费 - [PR #41349](https://github.com/BerriAI/litellm/pull/41349)
- 跟踪项目花费并累加强制执行项目预算 - [PR #41354](https://github.com/BerriAI/litellm/pull/41354)
- 在虚拟密钥 (virtual key) 上公开生命周期总花费 (spend) - [PR #41403](https://github.com/BerriAI/litellm/pull/41403)
- 当启用时，允许团队 (team) 管理员编辑 rpm_limit 和 max_budget - [PR #41525](https://github.com/BerriAI/litellm/pull/41525)
- 团队成员的临时预算增加 - [PR #41620](https://github.com/BerriAI/litellm/pull/41620)
- 批量更新团队成员预算 - [PR #41632](https://github.com/BerriAI/litellm/pull/41632)
- 为动态创建的客户设置每个密钥的默认预算 - [PR #41636](https://github.com/BerriAI/litellm/pull/41636)
- 保留分叉成员预算的重置窗口并审计批量成员预算写入 - [PR #41686](https://github.com/BerriAI/litellm/pull/41686)
- 将数据库模型重命名传播到密钥、团队、组织、项目和用户模型允许列表 - [PR #41694](https://github.com/BerriAI/litellm/pull/41694)
- 为 member_delete 和角色变更发出审计事件，并在团队创建时携带最终名单 - [PR #41840](https://github.com/BerriAI/litellm/pull/41840)
- 允许团队 (team) 管理员通过 team_admin_editable_team_fields 管理项目 - [PR #41916](https://github.com/BerriAI/litellm/pull/41916)
- 在读取 role_permissions 的地方解析它 - [PR #41924](https://github.com/BerriAI/litellm/pull/41924)
- 将 transcribe 注册为模型授权的已知提供商 (provider) - [PR #41926](https://github.com/BerriAI/litellm/pull/41926)
- /key/bulk_update 只写入每个项目携带的字段 - [PR #41949](https://github.com/BerriAI/litellm/pull/41949)
- 当 max_budget 为 0 时，阻止项目请求 - [PR #41997](https://github.com/BerriAI/litellm/pull/41997)

### 认证 {#authentication}

- 从实时用户和团队行刷新 lite 登录会话 token 授权 - [PR #40657](https://github.com/BerriAI/litellm/pull/40657)
- 在代理管理员上限制 webhook 测试警报 - [PR #40814](https://github.com/BerriAI/litellm/pull/40814)
- 限制 Admin UI (管理界面) 重复失败的登录尝试 - [PR #40982](https://github.com/BerriAI/litellm/pull/40982)
- 当设置了 UI_PASSWORD 时，隐藏默认凭据登录提示 - [PR #41107](https://github.com/BerriAI/litellm/pull/41107)
- 按颁发者范围划分 JWT 密钥映射，以防止跨颁发者冲突 - [PR #41281](https://github.com/BerriAI/litellm/pull/41281)
- 在数据库覆盖后，保持 YAML 直通端点对认证可见 - [PR #41303](https://github.com/BerriAI/litellm/pull/41303)
- 在 /anthropic 直通模式下，绝不将 LiteLLM 虚拟密钥 (virtual key) 转发给 Anthropic - [PR #41340](https://github.com/BerriAI/litellm/pull/41340)
- 使分页 `count` 验证与 RFC 7644 对齐 - [PR #41444](https://github.com/BerriAI/litellm/pull/41444)
- 在网关 token 端点上为 IdP JWT 添加 RFC 8693 token 交换 - [PR #41485](https://github.com/BerriAI/litellm/pull/41485)
- 为 JWT 和团队关联的密钥继承组织别名、预算和速率限制 - [PR #41681](https://github.com/BerriAI/litellm/pull/41681)
- 在用户、团队、组织和批量密钥删除时清除 JWT 密钥映射缓存 - [PR #41707](https://github.com/BerriAI/litellm/pull/41707)
- 在 SCIM 用户 PUT 请求中接受没有值的权利和角色条目 - [PR #41830](https://github.com/BerriAI/litellm/pull/41830)

### 代理配置 {#proxy-configuration}

- 遵守 LITELLM_DISABLE_ACCESS_LOG_PATHS 以丢弃嘈杂的 uvicorn 访问日志行 - [PR #41096](https://github.com/BerriAI/litellm/pull/41096)
- 当最新行读取失败时，跳过后台健康检查数据库写入 - [PR #41145](https://github.com/BerriAI/litellm/pull/41145)
- uvicorn 和 proxy 额外日志记录器尊重 LITELLM_LOG - [PR #41306](https://github.com/BerriAI/litellm/pull/41306)
- 在面向客户端的模型访问拒绝错误中隐藏模型允许列表 - [PR #41310](https://github.com/BerriAI/litellm/pull/41310)
- 策略附件执行顺序的明确优先级 - [PR #41571](https://github.com/BerriAI/litellm/pull/41571)
- 在 save_config 中仅持久化调用者更改的键 - [PR #41748](https://github.com/BerriAI/litellm/pull/41748)
- 让配置文件优先于数据库，并在两个读取端点上都使用 `source` 和 `editable` - [PR #41779](https://github.com/BerriAI/litellm/pull/41779)
- 当配置文件拥有某个键时，使 SettingsStore.clear() 终止 - [PR #41862](https://github.com/BerriAI/litellm/pull/41862)
- 拒绝 POST /config/update 中由配置拥有的键 - [PR #41868](https://github.com/BerriAI/litellm/pull/41868)
- 拒绝运行时写入配置文件拥有的设置 - [PR #41931](https://github.com/BerriAI/litellm/pull/41931)
- 说明存储的设置因配置文件拥有而被忽略的情况 - [PR #41985](https://github.com/BerriAI/litellm/pull/41985)
- 弥补 QA 在设置存储中发现的配置文件所有权漏洞 - [PR #42009](https://github.com/BerriAI/litellm/pull/42009)

### CLI 和编码代理 {#cli-and-coding-agents}

- 在 lite codex 中，将 Codex /model 选择器与 proxy /v1/models 同步 - [PR #40476](https://github.com/BerriAI/litellm/pull/40476)
- 移除 enum.StrEnum 以便 CLI 在 Python 3.10 上导入 - [PR #41046](https://github.com/BerriAI/litellm/pull/41046)
- 显示 LLM API 密钥的路由模型和会话统计信息 - [PR #41116](https://github.com/BerriAI/litellm/pull/41116)
- 标记路由成本并简化路由模型标头 - [PR #41186](https://github.com/BerriAI/litellm/pull/41186)
- 将 lite autoroute 的 up/down 重命名为 start/stop，并保留旧名称作为已弃用的别名 - [PR #41672](https://github.com/BerriAI/litellm/pull/41672)
- 弃用 litellm-proxy 入口点，转而使用 lite - [PR #41673](https://github.com/BerriAI/litellm/pull/41673)
- 添加一个 VS Code 扩展，将 LiteLLM 注册为语言模型提供商 - [PR #41865](https://github.com/BerriAI/litellm/pull/41865)

### Terraform {#terraform}

- 将 tpm_limit、rpm_limit、budget_duration、allowed_models 添加到 litellm_team_member_add - [PR #38682](https://github.com/BerriAI/litellm/pull/38682)
- 取消链接点击后 404 的 Terraform 注册表文档条目 - [PR #42003](https://github.com/BerriAI/litellm/pull/42003)

## AI 集成 {#ai-integrations}

### 护栏 (Guardrails) {#guardrails}

- 添加新的上游 Presidio PII 实体，包括德语集 - [PR #36775](https://github.com/BerriAI/litellm/pull/36775)
- 添加 Microsoft Agent 365 MCP 工具调用护栏 (guardrail) - [PR #38241](https://github.com/BerriAI/litellm/pull/38241)
- 当范围界定后无可扫描内容时，记录 not_run 评估 - [PR #39050](https://github.com/BerriAI/litellm/pull/39050)
- 将受阻的流式输出护栏 (guardrail) 响应记录为失败，而非成功 - [PR #40191](https://github.com/BerriAI/litellm/pull/40191)
- 保护历史记录中任何带有 cache_control 标记的行 - [PR #40315](https://github.com/BerriAI/litellm/pull/40315)
- 对于仅限 MCP 的 Presidio 模式，不添加 post_call 输出扫描 - [PR #40571](https://github.com/BerriAI/litellm/pull/40571)
- `logging_only` 模式在交付后扫描已完成的流 - [PR #40702](https://github.com/BerriAI/litellm/pull/40702)
- 对护栏 (guardrails) 添加的标签强制执行标签预算 - [PR #40842](https://github.com/BerriAI/litellm/pull/40842)
- 将每条消息的护栏 (guardrail) 重写写回 Responses 输入项 - [PR #40939](https://github.com/BerriAI/litellm/pull/40939)
- 扫描 Anthropic 顶级系统提示词 (prompt) 和 tool_use 参数 - [PR #40984](https://github.com/BerriAI/litellm/pull/40984)
- 从自定义代码护栏 (guardrail) 中的元数据桶解析调用者身份 - [PR #41126](https://github.com/BerriAI/litellm/pull/41126)
- 支持 llm_as_a_judge 的 pre_call 和 during_call 模式 - [PR #41128](https://github.com/BerriAI/litellm/pull/41128)
- 在非终止状态下继续轮询文件清理 - [PR #41131](https://github.com/BerriAI/litellm/pull/41131)
- 从纯文本消息中推导上下文基础来源和查询 - [PR #41132](https://github.com/BerriAI/litellm/pull/41132)
- 通过最后一个 cache_control 断点保护缓存的前缀 - [PR #41161](https://github.com/BerriAI/litellm/pull/41161)
- 为后调用扫描提供范围限定的请求对话和工具 - [PR #41220](https://github.com/BerriAI/litellm/pull/41220)
- Singulr v2 API 契约，包含 logging_only、pre_mcp_call 和 post_mcp_call - [PR #41329](https://github.com/BerriAI/litellm/pull/41329)
- 按流式输出块扫描有界窗口 - [PR #41407](https://github.com/BerriAI/litellm/pull/41407)
- 每次通过扫描后释放缓冲的流式输出块 - [PR #41425](https://github.com/BerriAI/litellm/pull/41425)
- 在事件循环之外运行提示词注入启发式算法 - [PR #41541](https://github.com/BerriAI/litellm/pull/41541)
- 在 incremental_diff 模式下流式传输提示词 (prompt) 安全 post_call 密文 - [PR #41558](https://github.com/BerriAI/litellm/pull/41558)
- 在 x-litellm-applied-guardrails 中命名阻塞护栏 (guardrail) - [PR #41583](https://github.com/BerriAI/litellm/pull/41583)
- 在工具执行期间保留请求选择的护栏 (guardrail) - [PR #41619](https://github.com/BerriAI/litellm/pull/41619)
- 通过 during_call_hook 分派 llm_api_check 审核 - [PR #41685](https://github.com/BerriAI/litellm/pull/41685)
- 添加 TypeSafe Jev 基于相关性的压缩护栏 (guardrail) - [PR #41757](https://github.com/BerriAI/litellm/pull/41757)
- 在速率限制 (rate limit) 回退 (fallback) 时保留请求的模型护栏 (guardrail) 和 key disable_fallbacks - [PR #41783](https://github.com/BerriAI/litellm/pull/41783)
- 在调用时解析 openai_moderations 模型并默认为 omni-moderation-latest - [PR #41895](https://github.com/BerriAI/litellm/pull/41895)
- 在多选、未完成和无信封流上提供护栏 (guardrail) 文本重写 - [PR #41933](https://github.com/BerriAI/litellm/pull/41933)
- 阻止 Javelin api_version 默认值泄露到 Azure Content Safety 中 - [PR #41941](https://github.com/BerriAI/litellm/pull/41941)
- 从调用后扫描中删除范围限定的请求对话和工具 - [PR #41986](https://github.com/BerriAI/litellm/pull/41986)
- 通过钩子边界转发流式输出 (streaming) 响应属性并合并已记录的 applied_guardrails - [PR #42027](https://github.com/BerriAI/litellm/pull/42027)

### 日志记录 (Logging) 和可观测性 (observability) {#logging-and-observability}

- 在 OTLP 导出前删除 None 指标和事件属性 - [PR #36815](https://github.com/BerriAI/litellm/pull/36815)
- 澄清预算 (budget) 阈值消息 - [PR #39102](https://github.com/BerriAI/litellm/pull/39102)
- 在事件循环之外运行剩余的内联 token 计数 - [PR #40262](https://github.com/BerriAI/litellm/pull/40262)
- 让模型发出目标 + 多查询搜索形状 - [PR #40399](https://github.com/BerriAI/litellm/pull/40399)
- 将每个索引的 OpenInference 消息属性限制在跨度范围内 - [PR #40562](https://github.com/BerriAI/litellm/pull/40562)
- 在 HTTP 和 WebSocket 直通中传播 W3C 跟踪上下文 - [PR #40669](https://github.com/BerriAI/litellm/pull/40669)
- 使用已解析的 api_provider 标记预调用速率限制 (rate limit) 失败 - [PR #41059](https://github.com/BerriAI/litellm/pull/41059)
- 为 5xx HTTPException 和 ProxyException 发送 llm_exceptions Slack 警报 - [PR #41125](https://github.com/BerriAI/litellm/pull/41125)
- 将调用者的 Langfuse 用户、会话和标签映射到根和生成跨度上 - [PR #41140](https://github.com/BerriAI/litellm/pull/41140)
- 在 litellm_proxy_failed_requests_metric 中统计 401 认证失败 - [PR #41170](https://github.com/BerriAI/litellm/pull/41170)
- 在进行中的刷新期间保留附加的事件，而不是清除它们 - [PR #41288](https://github.com/BerriAI/litellm/pull/41288)
- 添加 s3_log_prompts_only 选项以仅记录提示词 (prompt) 而不记录响应 - [PR #41327](https://github.com/BerriAI/litellm/pull/41327)
- 将 litellm_trace_id 默认为 OTel 服务器 span 跟踪 ID - [PR #41386](https://github.com/BerriAI/litellm/pull/41386)
- 将嵌套请求元数据键提升为 litellm.metadata.* span 属性 - [PR #41462](https://github.com/BerriAI/litellm/pull/41462)
- 添加客户 (end_user) 预算 (budget) 计量器 - [PR #41472](https://github.com/BerriAI/litellm/pull/41472)
- 将每个索引的 OpenInference 消息适配到跨度剩余的属性预算 (budget) - [PR #41498](https://github.com/BerriAI/litellm/pull/41498)
- 添加所有指标仪表板并修复过时的 dashboard_v2 计量器 - [PR #41578](https://github.com/BerriAI/litellm/pull/41578)
- 为 Langfuse 目标和操作符 Langfuse 导出器选择加入 llm_only span 范围 - [PR #41740](https://github.com/BerriAI/litellm/pull/41740)
- 在直通中继上保留调用者 traceparent 和 tracestate - [PR #41786](https://github.com/BerriAI/litellm/pull/41786)
- 将响应持续时间和开销锚定在代理 (proxy) 接收时间 - [PR #41891](https://github.com/BerriAI/litellm/pull/41891)
- 将失败的搜索显示为 web_search_tool_result_error 块并结束回合 - [PR #41905](https://github.com/BerriAI/litellm/pull/41905)
- 将自动断点范围限定为支持的 Claude 传输 - [PR #41920](https://github.com/BerriAI/litellm/pull/41920)
- 将请求元数据排除在成本跟踪失败警报之外 - [PR #41950](https://github.com/BerriAI/litellm/pull/41950)
- 将嵌入 (embedding) 向量总结为 Langfuse 观察输出 - [PR #41982](https://github.com/BerriAI/litellm/pull/41982)
- 将 Responses API 输出映射到 Langfuse 生成输出 - [PR #41991](https://github.com/BerriAI/litellm/pull/41991)

### 密钥管理器 (Secret Managers) {#secret-managers}

- 在无正文密钥重新生成和密钥别名更改时同步 AWS Secrets Manager - [PR #41458](https://github.com/BerriAI/litellm/pull/41458)
- 当密钥别名更改时重命名 AWS Secrets Manager 密钥 - [PR #41468](https://github.com/BerriAI/litellm/pull/41468)
- 为 HashiCorp Vault 添加独立的登录和密钥命名空间 - [PR #41539](https://github.com/BerriAI/litellm/pull/41539)

## 花费跟踪、预算和速率限制 {#spend-tracking-budgets-and-rate-limiting}

### 成本跟踪 {#cost-tracking}

- 从用户文档字符串中移除不支持的 soft_budget 参数 - [PR #36585](https://github.com/BerriAI/litellm/pull/36585)
- 通过 (api_key, startTime) 索引 LiteLLM_SpendLogs - [PR #37983](https://github.com/BerriAI/litellm/pull/37983)
- 存储 litellm_call_id 并在 request_id 查找中匹配它 - [PR #39068](https://github.com/BerriAI/litellm/pull/39068)
- 按音频缓存读取速率计费缓存的实时音频 token - [PR #40627](https://github.com/BerriAI/litellm/pull/40627)
- 预测跨部署的提示词缓存成本 - [PR #40877](https://github.com/BerriAI/litellm/pull/40877)
- 对于未定价的部署，报告 null 成本而非 0 - [PR #40878](https://github.com/BerriAI/litellm/pull/40878)
- 使用 orjson 一次性序列化 /model/info 列表 - [PR #41114](https://github.com/BerriAI/litellm/pull/41114)
- 按 token 计费 gemini-embedding-2 并停止对音频重复收费 - [PR #41157](https://github.com/BerriAI/litellm/pull/41157)
- 跟踪部署钩子转换为非流式输出的流的花费 - [PR #41171](https://github.com/BerriAI/litellm/pull/41171)
- 根据持久缓存历史估算自动路由器的基线成本 - [PR #41177](https://github.com/BerriAI/litellm/pull/41177)
- 通过 Responses 使用桥接传递图像和视频输入 token - [PR #41237](https://github.com/BerriAI/litellm/pull/41237)
- 在认证失败的花费日志中保留客户端 User-Agent - [PR #41291](https://github.com/BerriAI/litellm/pull/41291)
- 将聚合使用查询拆分为无密钥汇总和有界 top-N 密钥 - [PR #41293](https://github.com/BerriAI/litellm/pull/41293)
- 根据返回的 service_tier 对原生 Responses WebSocket 回合进行定价 - [PR #41318](https://github.com/BerriAI/litellm/pull/41318)
- 为使用情况仪表板添加 LiteLLM_DailyGlobalSpend 无密钥汇总 - [PR #41324](https://github.com/BerriAI/litellm/pull/41324)
- 在路由器节省中保留 Anthropic 定价修改器 - [PR #41341](https://github.com/BerriAI/litellm/pull/41341)
- 移除导致零成本模型 429 的重复用户预算钩子 - [PR #41345](https://github.com/BerriAI/litellm/pull/41345)
- 将路由器拒绝的请求归因于模型组提供商 - [PR #41507](https://github.com/BerriAI/litellm/pull/41507)
- 按标准 token 费率对 Azure PTU 溢出请求进行定价 - [PR #41569](https://github.com/BerriAI/litellm/pull/41569)
- 以 400 拒绝非字符串模型，并将其花费记录为 unknown-model - [PR #41633](https://github.com/BerriAI/litellm/pull/41633)
- 当映射中没有缓存读取速率时，按输入速率计费缓存读取 token - [PR #41832](https://github.com/BerriAI/litellm/pull/41832)
- 取消固定复制到 model_info 中的成本图定价并报告定价覆盖 - [PR #41843](https://github.com/BerriAI/litellm/pull/41843)
- 当提交失败且没有 Redis 缓冲区时，重新排队每日花费行 - [PR #41878](https://github.com/BerriAI/litellm/pull/41878)
- 对于路由器外部的拒绝，将原始客户端模型排除在花费日志之外 - [PR #41943](https://github.com/BerriAI/litellm/pull/41943)
- 在非高峰时段按非高峰费率计费 DeepSeek V4.1 Flash 和 V4 Pro - [PR #41960](https://github.com/BerriAI/litellm/pull/41960)

### 预算 {#budgets}

- 在将花费排队到 DB 之前协调预算预留 - [PR #40310](https://github.com/BerriAI/litellm/pull/40310)
- 通过递减预重置花费而不是清零行来重置预算 - [PR #41279](https://github.com/BerriAI/litellm/pull/41279)
- 密钥模型 rpm/tpm 覆盖优先于团队模型限制 - [PR #41302](https://github.com/BerriAI/litellm/pull/41302)
- 在路由器回退目标上重新检查预算 - [PR #41379](https://github.com/BerriAI/litellm/pull/41379)
- 在构建速率限制标头之前计算 TPM/RPM 使用量 - [PR #41474](https://github.com/BerriAI/litellm/pull/41474)
- 预算重置后分页最终用户缓存失效 - [PR #41488](https://github.com/BerriAI/litellm/pull/41488)
- 当部署的所有 max_parallel_requests 插槽都被占用时，以 429 拒绝 - [PR #41555](https://github.com/BerriAI/litellm/pull/41555)
- 当共享速率限制窗口滚动时，重置同级 tpm/rpm 计数器 - [PR #41838](https://github.com/BerriAI/litellm/pull/41838)
- 按标签在 UTC 中渲染 429 重置时间 - [PR #41911](https://github.com/BerriAI/litellm/pull/41911)
- 针对跨副本的共享 redis 使用强制执行模型 tpm 限制 - [PR #41915](https://github.com/BerriAI/litellm/pull/41915)

### 速率限制 {#rate-limiting}

- 为批量提交添加 tpd_limit (tokens per day) - [PR #40997](https://github.com/BerriAI/litellm/pull/40997)

## MCP Gateway {#mcp-gateway}

### MCP Gateway {#mcp-gateway-1}

- 要求委托 OAuth 的准入 - [PR #40923](https://github.com/BerriAI/litellm/pull/40923)
- 授权 JWT OAuth 凭据持久化 - [PR #41314](https://github.com/BerriAI/litellm/pull/41314)
- 上游凭据缺失时故障关闭 - [PR #41364](https://github.com/BerriAI/litellm/pull/41364)
- 将管理员静态头计为 api_key 凭据槽 - [PR #41514](https://github.com/BerriAI/litellm/pull/41514)
- 将健康发现限制为虚拟密钥 (virtual key) 授权 - [PR #41609](https://github.com/BerriAI/litellm/pull/41609)
- 在网关处将 MCP 客户端应用程序列入白名单 - [PR #41667](https://github.com/BerriAI/litellm/pull/41667)
- 按 AI 客户端和用户显示实时网关会话 - [PR #41692](https://github.com/BerriAI/litellm/pull/41692)
- 升级 SDK2 同时保留旧版网关行为 - [PR #41718](https://github.com/BerriAI/litellm/pull/41718)
- 允许代理管理员强制关闭实时 MCP 会话并撤销存储的用户凭据 - [PR #41725](https://github.com/BerriAI/litellm/pull/41725)

## 性能 / 负载均衡 / 可靠性改进 {#performance--loadbalancing--reliability-improvements}

### 自动路由和模型路由 {#auto-router-and-model-routing}

- 保留提供商亲和性 - [PR #40228](https://github.com/BerriAI/litellm/pull/40228)
- 记录平面重试尝试并从 attempted_retries 限制重试次数 - [PR #40930](https://github.com/BerriAI/litellm/pull/40930)
- 通过 exception_type 路由流中错误事件，以便触发 content_policy_fallbacks - [PR #40988](https://github.com/BerriAI/litellm/pull/40988)
- 当同级服务相同的公共模型时，在 429 响应上冷却团队部署 - [PR #40991](https://github.com/BerriAI/litellm/pull/40991)
- 命名 429 响应上的所有部署冷却错误 - [PR #40995](https://github.com/BerriAI/litellm/pull/40995)
- 遵守团队和密钥提供商权重 - [PR #41072](https://github.com/BerriAI/litellm/pull/41072)
- 当部署 ID 等于 model_name 时保持加权路由 - [PR #41156](https://github.com/BerriAI/litellm/pull/41156)
- 在每个复杂性层级内保留会话模型选择 - [PR #41174](https://github.com/BerriAI/litellm/pull/41174)
- 将每个请求的 routing_strategy 覆盖选择器绑定到请求的回调 - [PR #41178](https://github.com/BerriAI/litellm/pull/41178)
- 计算跨回退 (fallback) 跳数的 num_retries_per_request - [PR #41191](https://github.com/BerriAI/litellm/pull/41191)
- 停止将调用者设置的超时 408 计入部署冷却时间 - [PR #41230](https://github.com/BerriAI/litellm/pull/41230)
- 添加能力分类器作为 Fuse 基础 - [PR #41270](https://github.com/BerriAI/litellm/pull/41270)
- 在能力预测后添加 Fuse V2 分类器 - [PR #41272](https://github.com/BerriAI/litellm/pull/41272)
- 添加每个模型的快速模式切换 - [PR #41282](https://github.com/BerriAI/litellm/pull/41282)
- 停止将调用者提供的凭据注册为路由器部署 - [PR #41289](https://github.com/BerriAI/litellm/pull/41289)
- 在密钥/团队模型认证之前解析 router_settings.model_group_alias - [PR #41308](https://github.com/BerriAI/litellm/pull/41308)
- 将未授权的能力和 Fuse v2 路由器限制为各一个 - [PR #41326](https://github.com/BerriAI/litellm/pull/41326)
- 在保存时验证 routing_groups，并防止无效的数据库组阻塞 SSO 加载 - [PR #41351](https://github.com/BerriAI/litellm/pull/41351)
- 流式传输影子流量并将 silent_model 扇出到多个目标 - [PR #41368](https://github.com/BerriAI/litellm/pull/41368)
- 发现托管的 OpenAI 兼容模型的 token 限制 - [PR #41508](https://github.com/BerriAI/litellm/pull/41508)
- 添加 TypeSafe Jev 作为复杂性路由器分类器 - [PR #41615](https://github.com/BerriAI/litellm/pull/41615)
- 添加维护的 Fuse 模型和预设 - [PR #41617](https://github.com/BerriAI/litellm/pull/41617)
- 允许通配符 allowed_features 许可证授予 auto_router 功能 - [PR #41684](https://github.com/BerriAI/litellm/pull/41684)
- 在 SDK 原生直通路由 (/v1/messages, /converse) 上遵守 stream_timeout - [PR #41875](https://github.com/BerriAI/litellm/pull/41875)

### 缓存、数据库和运行时 {#caching-database-and-runtime}

- 从原始请求快照重试速率限制回退 (fallback) - [PR #40596](https://github.com/BerriAI/litellm/pull/40596)
- 每个间隔记录一次超时连续事件，而不是每次缓存调用记录一行 - [PR #40817](https://github.com/BerriAI/litellm/pull/40817)
- 及时释放已完成的最大并行槽位 - [PR #40843](https://github.com/BerriAI/litellm/pull/40843)
- 为一系列超时的 LoggingWorker 回调 (callback) 记录一个有界摘要 - [PR #40912](https://github.com/BerriAI/litellm/pull/40912)
- 当 request_correlation_in_logs 关闭时，跳过关联 contextvar 标记 - [PR #41054](https://github.com/BerriAI/litellm/pull/41054)
- 每个请求加载一次团队 (team) 成员资格，并在 L1 命中时跳过 Prisma - [PR #41102](https://github.com/BerriAI/litellm/pull/41102)
- 在 /utils/token_counter 请求中缓存自定义 HuggingFace tokenizers - [PR #41216](https://github.com/BerriAI/litellm/pull/41216)
- 当 writer_unavailable 过期时，将访问组的原始 SQL 写入保留在写入器上 - [PR #41283](https://github.com/BerriAI/litellm/pull/41283)
- 将 fastapi 和 tiktoken BPE 导入从 import litellm 中推迟 - [PR #41585](https://github.com/BerriAI/litellm/pull/41585)
- 添加 litellm-http 客户端池并将其注入 OCR 路由 - [PR #41897](https://github.com/BerriAI/litellm/pull/41897)
- 拒绝在运行时启动后派生的进程中的原生路由 - [PR #41987](https://github.com/BerriAI/litellm/pull/41987)

### 按所有权区域划分的 PR 汇总 {#pr-roll-up-by-ownership-area}

客户可见的 PR: **366**

- 管理端点 (endpoint) / UI: 90
- 模型与提供商 (provider): 86
- AI 集成: 59
- LLM API 端点 (endpoint): 51
- 花费 (spend) / 预算 (budget) / 速率限制 (rate limit): 36
- 性能 / 可靠性: 35
- MCP: 9

## 新贡献者 {#new-contributors}

- [@AaronHowell](https://github.com/AaronHowell)
- [@abhirup7](https://github.com/abhirup7)
- [@adssoccer1](https://github.com/adssoccer1)
- [@clonylu](https://github.com/clonylu)
- [@elifozdamar](https://github.com/elifozdamar)
- [@etiennechabert](https://github.com/etiennechabert)
- [@gaurav-pandey-zocdoc](https://github.com/gaurav-pandey-zocdoc)
- [@HUAHAODIA](https://github.com/HUAHAODIA)
- [@IToSSc](https://github.com/IToSSc)
- [@joshgarnett](https://github.com/joshgarnett)
- [@Lee-Si-Yoon](https://github.com/Lee-Si-Yoon)
- [@max-sixty](https://github.com/max-sixty)
- [@MvdB](https://github.com/MvdB)
- [@rad-p44](https://github.com/rad-p44)
- [@runjivu](https://github.com/runjivu)
- [@zachbernstein-sdx](https://github.com/zachbernstein-sdx)
- [@zoroyihan7](https://github.com/zoroyihan7)

## 完整更新日志 {#full-changelog}

[在 GitHub 上比较发布内容](https://github.com/BerriAI/litellm/compare/v1.102.0-rc.1..v1.103.0-rc.1)
