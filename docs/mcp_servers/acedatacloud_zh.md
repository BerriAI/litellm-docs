# Ace Data Cloud 媒体 MCP 接入

[English](./acedatacloud.md)

通过 LiteLLM MCP Gateway 使用 Suno、Seedance、HappyHorse、GPT Image 和 Nano Banana。每项服务使用独立连接与工具，由 Ace Data Cloud 维护，并需填写自己的 Ace 业务 API Token。它们不代表模型品牌的官方集成。

## 安装并打开网关

```bash
python -m pip install 'litellm[proxy]'
```

按照 [Proxy 快速开始](https://docs.litellm.ai/docs/proxy/quick_start) 部署 LiteLLM，用自己的 LiteLLM 管理员账号正常登录，然后打开 **MCP Servers**。通过 UI 保存连接时，部署需要数据库和 `store_model_in_db: true`，参见 [MCP 前提条件](../mcp.md#prerequisites)。

五个发现入口需要包含 [媒体目录集成](https://github.com/BerriAI/litellm/pull/47149) 的版本。若当前正式安装还未包含该改动，可以使用下表的 **Custom Server** 手工配置；手工连接不表示正式目录已收录这些卡片。

## 按服务品牌查找

打开 **MCP Servers → Add New MCP Server**，搜索服务名，选择对应的 **by Ace Data Cloud** 项目。

| 搜索词 | MCP Server URL | 能力与源码 |
| --- | --- | --- |
| Suno | `https://suno.mcp.acedata.cloud/mcp` | 音乐、歌词、翻唱和任务查询；[SunoMCP](https://github.com/AceDataCloud/SunoMCP) |
| Seedance | `https://seedance.mcp.acedata.cloud/mcp` | 文生/图生视频和任务查询；[SeedanceMCP](https://github.com/AceDataCloud/SeedanceMCP) |
| HappyHorse / Happy Horse | `https://happyhorse.mcp.acedata.cloud/mcp` | 视频生成、编辑和任务查询；[HappyHorseMCP](https://github.com/AceDataCloud/HappyHorseMCP) |
| GPT Image | `https://openai.mcp.acedata.cloud/mcp` | 图片生成、编辑和任务查询，复用的服务还暴露 chat、embedding、audio 工具；[OpenAIMCP](https://github.com/AceDataCloud/OpenAIMCP) |
| Nano Banana / NanoBanana | `https://nanobanana.mcp.acedata.cloud/mcp` | 图片生成、编辑和任务查询；[NanoBananaMCP](https://github.com/AceDataCloud/NanoBananaMCP) |

![真实候选界面：五个独立媒体服务入口](/img/acedatacloud/litellm-five-media-cards-candidate.jpg)

这张图于 2026-10-18 在源码 `c2971654` 上经正常本地登录拍摄，展示候选目录，不能证明旧版稳定包已包含五个入口。

## 注册并创建专用 Token

进入 [Ace Applications](https://platform.acedata.cloud/console/applications?utm_source=opensource&utm_medium=referral&utm_campaign=evergreen&utm_content=litellm_media_zh_docs_api_key)，注册或登录。没有通用应用时点击 **Initialize General Application**，打开 **General application**。确认账户可使用所选服务，并查看余额和 [当前服务价格](https://platform.acedata.cloud/models?utm_source=opensource&utm_medium=referral&utm_campaign=evergreen&utm_content=litellm_media_zh_docs_pricing)。

可复制现有业务 Key，也可点击 **Manage Keys → Create** 新建名为 `LiteLLM media` 的专用 Key。根据需要设置到期时间、消费限额和 API 限制；若限制 Allowed APIs，应包含对应服务的生成和任务查询接口。服务专用应用 Key 仅适用于该服务，需要多服务且有相应权益时才使用通用应用 Key。

![真实 Ace 控制台：复制 Key 或打开 Manage Keys](https://raw.githubusercontent.com/AceDataCloud/SunoDify/8d3d03570e73324220f111f7fe343da0792a8071/_assets/tutorial/get-api-key-en.png)

![真实 Ace 控制台：创建独立业务 Key](https://raw.githubusercontent.com/AceDataCloud/SunoDify/8d3d03570e73324220f111f7fe343da0792a8071/_assets/tutorial/create-api-key-en.png)

这两张已遮挡凭据的真实图片来自固定版本 `8d3d0357` 的 Suno Dify 指南，展示共享控制台流程。图中示例名称 `Dify tutorial` 在此改填 `LiteLLM media`。不要复制图中遮挡字符，也不要把平台管理 API 的 Account Token 或 LiteLLM proxy key 填作业务 Token。这些图不证明已完成 LiteLLM 鉴权。

## 在实际字段中配置连接

发现卡片预填服务名称、**MCP Server URL**、**Streamable HTTP** 和 **Bearer Token**。把原始业务 Token 填入 **Authentication Value**，不带 `Bearer ` 或引号。使用此路径时，OAuth 和额外 Authorization header 保持未设置。找不到卡片时，用 **Custom Server** 手工填写同样字段。

![真实候选界面：Token 输入位置与获取链接](/img/acedatacloud/litellm-suno-required-token-fixed.jpg)

带鉴权的发现卡片在 Token 非空前不会自动测试连接；可点击 **Get your API token** 获取业务 Key。空 Token 时 **Add MCP Server** 按钮仍可点击，但提交会被必填校验拦截。此图拍于 2026-10-18 的 `166f54e3`，未输入 Ace Key 或保存连接；后续 `6ed14e00` 仅等价拆分 lint 条件，未改表单 markup。图不证明远程鉴权成功、生成结果、账单或正式版本可用。

核实凭据范围后测试连接并添加，打开服务的 **MCP Tools**。按 [MCP 权限管理](../mcp_control.md) 只授予目标用户/团队所需访问。管理员保存的 Token 会代表其所有者为获授权调用者执行请求，需据此分配权限。

配置文件部署可使用如下 Suno 示例，其他服务使用各自 URL 和秘密变量：

```yaml title="config.yaml"
mcp_servers:
  suno_acedatacloud:
    url: https://suno.mcp.acedata.cloud/mcp
    transport: http
    auth_type: bearer_token
    auth_value: os.environ/ACEDATACLOUD_SUNO_API_TOKEN
    description: Suno music through Ace Data Cloud
```

把 Token 放在部署秘密管理中，不写入 Git、提示词、截图或导出配置。端点支持 OAuth，但属于另一个配置流程，不能与这里的显式 Bearer 路径混用。

## 首次使用与同一任务查询

加载工具列表只能证明 MCP 连接可用，不能证明 API 权限、余额、生成结果或计费。先查看工具 schema 和可用的参考工具。

| 服务 | 首先查看 | 生成后查询 | 当前 API 指南 |
| --- | --- | --- | --- |
| Suno | `suno_list_models` | `suno_generate_music` 后调用 `suno_get_task` | [Suno](https://platform.acedata.cloud/documents/suno-audios?utm_source=opensource&utm_medium=referral&utm_campaign=evergreen&utm_content=litellm_media_suno_zh_first_use) |
| Seedance | `seedance_list_models` | `seedance_generate_video` 后调用 `seedance_get_task` | [Seedance](https://platform.acedata.cloud/documents/seedance-videos?utm_source=opensource&utm_medium=referral&utm_campaign=evergreen&utm_content=litellm_media_seedance_zh_first_use) |
| HappyHorse | `happyhorse_list_models` | `happyhorse_generate_video` 后调用 `happyhorse_get_task` | [HappyHorse](https://platform.acedata.cloud/documents/happyhorse-videos?utm_source=opensource&utm_medium=referral&utm_campaign=evergreen&utm_content=litellm_media_happyhorse_zh_first_use) |
| GPT Image | `openai_list_image_models` | `openai_generate_image` 返回任务 ID 时调用 `openai_get_task` | [GPT Image](https://platform.acedata.cloud/documents/openai?utm_source=opensource&utm_medium=referral&utm_campaign=evergreen&utm_content=litellm_media_gpt_image_zh_first_use) |
| Nano Banana | 查看工具及输入 schema | `nanobanana_generate_image` 后调用 `nanobanana_get_task` | [Nano Banana](https://platform.acedata.cloud/documents/nanobanana-images?utm_source=opensource&utm_medium=referral&utm_campaign=evergreen&utm_content=litellm_media_nano_banana_zh_first_use) |

模型和参数以当前 schema 为准。生成或编辑可能计费，先确认服务权限、当前价格和当次预算；关闭自动付费重试。只提交一次，保存返回的任务 ID，后续持续查询同一个 ID 直到成功或失败终态。等待超时后继续查询原任务，不要再次生成来查看进度。任务 running 或预览 URL 不能代替完成结果，分享媒体前确认成功终态；查询是否计费以所选服务当前规则为准。

首次 Suno 使用可在费用确认后，请 agent 用简短纯音乐提示调用 `suno_generate_music`，保存 ID 并调用 `suno_get_task` 查询同一任务。LiteLLM 显示工具调用成功不代表媒体任务已经完成。

## 排错与账单核对

| 现象 | 检查方法 |
| --- | --- |
| 搜不到服务 | 检查安装版本是否含目录改动，尝试表中完整名称/别名；必要时手工 Custom Server。 |
| 401 | 检查业务 Token、Bearer Token 类型、过期/撤销状态，避免重复 Bearer 前缀或误用 Account Token。 |
| 403 | 阅读原始错误，分别确认服务权限、Key 限制和内容审核结果。 |
| pending / 没有最终 URL | 查询同一个任务 ID，不重新生成。 |
| 429 | 降低并发并等待，不自动重复付费请求。 |
| failed / 5xx | 查原任务、请求历史和错误详情后再决定是否重试。 |
| 媒体 URL 无法打开 | 确认成功终态及返回 URL 的网络可访问性。 |

Ace 按 Credits 结算，实际 USD 等值依赖当前充值套餐。LiteLLM 的每工具成本配置属于管理员估算，不能当作 Ace 最终账单；音乐、视频、图片不能套用文本 token 价格。核对原始请求、同一任务终态和 Ace usage 记录后，再认定该次生成只计费一次。

源码与支持见 [AceDataCloud/MCPs](https://github.com/AceDataCloud/MCPs)。可在 [Applications](https://platform.acedata.cloud/console/applications?utm_source=opensource&utm_medium=referral&utm_campaign=evergreen&utm_content=litellm_media_zh_docs_rotate) 撤销或轮换专用 Key。模型原生入口参见 [Ace Data Cloud 模型接入](../providers/acedatacloud_zh.md)。
