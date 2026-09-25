# 补全函数 - completion()
输入参数与 <a href="https://platform.openai.com/docs/api-reference/chat/create" target="_blank" rel="noopener noreferrer">OpenAI Create chat completion</a> **完全相同**，并允许您以相同的格式调用 **Azure OpenAI, Anthropic, Cohere, Replicate, OpenRouter, Novita AI** 模型。

此外，LiteLLM 允许您传入以下 **可选** LiteLLM 参数：
`force_timeout`, `azure`, `logger_fn`, `verbose`

## 输入 - 请求正文 {#input---request-body}
# 请求正文

**必填字段**

- `model`: *string* - 要使用的模型ID。有关哪些模型适用于聊天API的详细信息，请参阅模型端点兼容性表。
  
- `messages`: *array* - 包含到目前为止对话的消息列表。

*注意* - 数组中的每条消息都包含以下属性：

    - `role`: *string* - 消息作者的角色。角色可以是：system, user, assistant, 或 function。
    
    - `content`: *string or null* - 消息内容。所有消息都必需，但对于带有函数调用的 assistant 消息可以为 null。
    
    - `name`: *string (optional)* - 消息作者的名称。如果角色是“function”，则必需。名称应与内容中表示的函数名称匹配。它可以包含字符 (a-z, A-Z, 0-9) 和下划线，最大长度为 64 个字符。
    
    - `function_call`: *object (optional)* - 应调用的函数的名称和参数，由模型生成。


**可选字段**

- `functions`: *array* - 模型可能用于生成 JSON 输入的函数列表。每个函数应具有以下属性：

    - `name`: *string* - 要调用的函数名称。应包含 a-z, A-Z, 0-9, 下划线和破折号，最大长度为 64 个字符。
    
    - `description`: *string (optional)* - 描述函数作用的说明。它有助于模型决定何时以及如何调用函数。
    
    - `parameters`: *object* - 函数接受的参数，描述为 JSON Schema 对象。
    
    - `function_call`: *string or object (optional)* - 控制模型如何响应函数调用。

- `temperature`: *number or null (optional)* - 要使用的采样温度，介于 0 和 2 之间。较高的值（如 0.8）会产生更随机的输出，而较低的值（如 0.2）会使输出更集中和确定性。

- `top_p`: *number or null (optional)* - 替代温度采样的另一种方法。它指示模型考虑具有 top_p 概率的 token 结果。例如，0.1 意味着只考虑构成前 10% 概率质量的 token。

- `n`: *integer or null (optional)* - 为每个输入消息生成的聊天补全 (chat completion) 选项的数量。

- `stream`: *boolean or null (optional)* - 如果设置为 true，则发送部分消息增量。token 将在可用时发送，流以 [DONE] 消息终止。

- `stop`: *string/ array/ null (optional)* - API 将停止生成后续 token 的最多 4 个序列。

- `max_tokens`: *integer (optional)* - 在聊天补全 (chat completion) 中要生成的最大 token 数量。

- `presence_penalty`: *number or null (optional)* - 用于根据 token 在文本中出现的频率来惩罚新 token。

- `frequency_penalty`: *number or null (optional)* - 用于根据 token 在文本中出现的频率来惩罚新 token。

- `logit_bias`: *map (optional)* - 用于修改特定 token 在补全 (completion) 中出现的概率。

- `user`: *string (optional)* - 代表您的最终用户的唯一标识符。这可以帮助 OpenAI 监控和检测滥用行为。