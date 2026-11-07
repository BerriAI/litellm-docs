---
sidebar_label: "Latest model aliases"
description: "Keep one model name as newer versions arrive. Use -latest aliases in the LiteLLM SDK and AI Gateway."
---

# Latest model aliases

<SinceVersion v="1.109.0" />

An alias such as `openai/gpt-luna-latest` points to a model in that family. LiteLLM maintains the target. As LiteLLM moves the alias to a newer model, your application keeps the same model string.

Use the full `provider/model-latest` name from the table below. You do not need to create an alias mapping. Each provider page also lists the aliases for that provider.

## Python SDK

Install `litellm` with `pip install litellm` and set `OPENAI_API_KEY` to your [OpenAI API key](./providers/openai.md#required-api-keys).

```python
from litellm import completion

response = completion(
    model="openai/gpt-luna-latest",
    messages=[{"role": "user", "content": "Say hello."}],
)
print(response.choices[0].message.content)
```

A successful call prints a greeting from the model behind the alias.

## AI Gateway

For an [existing gateway](./proxy/docker_quick_start.md), set `OPENAI_API_KEY` in the gateway environment. Add this entry to your `config.yaml` under `model_list`, then restart the gateway with that configuration.

```yaml
model_list:
  - model_name: openai/gpt-luna-latest
    litellm_params:
      model: openai/gpt-luna-latest
      api_key: os.environ/OPENAI_API_KEY
```

If your gateway already routes `openai/*` through a [wildcard deployment](./wildcard_routing.md), you can use this alias without adding a model entry.

Set `LITELLM_PROXY_API_BASE` to your gateway's base URL, such as `http://localhost:4000`, and `LITELLM_PROXY_API_KEY` to a LiteLLM key with access to this model. Send a request from your client machine.

```bash
curl "$LITELLM_PROXY_API_BASE/chat/completions" \
  -H "Authorization: Bearer $LITELLM_PROXY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"openai/gpt-luna-latest","messages":[{"role":"user","content":"Say hello."}]}'
```

A successful response contains a greeting in `choices[0].message.content`. The gateway's response `model` field can show the alias. LiteLLM calculates cost using the model that served the request.

## Supported aliases

These aliases call each provider's own API.

| Provider | Model names |
| --- | --- |
| OpenAI | `openai/gpt-luna-latest`, `openai/gpt-sol-latest`, `openai/gpt-terra-latest`, `openai/gpt-astra-latest`, `openai/gpt-mini-latest` |
| Anthropic | `anthropic/claude-opus-latest`, `anthropic/claude-sonnet-latest`, `anthropic/claude-haiku-latest`, `anthropic/claude-fable-latest` |
| xAI | `xai/grok-latest` |
| Moonshot | `moonshot/kimi-latest` |
| Z.AI | `zai/glm-latest`, `zai/glm-flash-latest` |
| DeepSeek | `deepseek/deepseek-pro-latest`, `deepseek/deepseek-flash-latest` |
| DashScope | `dashscope/qwen-max-latest`, `dashscope/qwen-flash-latest` |
| MiniMax | `minimax/minimax-latest` |

Gemini, Mistral, and DashScope's `qwen-plus-latest` already have provider-managed latest names. LiteLLM passes those through.

### Hosted aliases

The same model families are also available through these hosting providers. The alias uses the host's prefix, and LiteLLM sends the host's own model ID. For example, `bedrock/claude-haiku-latest` is sent to Bedrock as `global.anthropic.claude-haiku-5-5`, and `vertex_ai/claude-haiku-latest` is sent to Vertex AI as `claude-haiku-5-5`. Bedrock aliases point to the `global.` cross-region inference profile. Azure OpenAI aliases send the target model name as the deployment name.

| Provider | Model names |
| --- | --- |
| Azure OpenAI | `azure/gpt-luna-latest`, `azure/gpt-sol-latest`, `azure/gpt-terra-latest`, `azure/gpt-astra-latest`, `azure/gpt-mini-latest` |
| Azure AI Foundry | `azure_ai/gpt-luna-latest`, `azure_ai/gpt-sol-latest`, `azure_ai/gpt-terra-latest`, `azure_ai/gpt-astra-latest`, `azure_ai/gpt-mini-latest`, `azure_ai/claude-opus-latest`, `azure_ai/claude-sonnet-latest`, `azure_ai/claude-haiku-latest`, `azure_ai/claude-fable-latest`, `azure_ai/grok-latest`, `azure_ai/kimi-latest`, `azure_ai/glm-latest`, `azure_ai/glm-flash-latest`, `azure_ai/deepseek-pro-latest`, `azure_ai/deepseek-flash-latest`, `azure_ai/minimax-latest` |
| Amazon Bedrock | `bedrock/gpt-luna-latest`, `bedrock/gpt-sol-latest`, `bedrock/gpt-terra-latest`, `bedrock/gpt-astra-latest`, `bedrock/claude-opus-latest`, `bedrock/claude-sonnet-latest`, `bedrock/claude-haiku-latest`, `bedrock/claude-fable-latest`, `bedrock/grok-latest`, `bedrock/kimi-latest`, `bedrock/glm-latest` |
| Bedrock Mantle | `bedrock_mantle/gpt-luna-latest`, `bedrock_mantle/gpt-sol-latest`, `bedrock_mantle/gpt-terra-latest`, `bedrock_mantle/gpt-astra-latest`, `bedrock_mantle/claude-opus-latest`, `bedrock_mantle/claude-sonnet-latest`, `bedrock_mantle/claude-haiku-latest`, `bedrock_mantle/grok-latest` |
| Vertex AI | `vertex_ai/claude-opus-latest`, `vertex_ai/claude-sonnet-latest`, `vertex_ai/claude-haiku-latest`, `vertex_ai/claude-fable-latest`, `vertex_ai/grok-latest` |
| Databricks | `databricks/gpt-luna-latest`, `databricks/gpt-sol-latest`, `databricks/gpt-terra-latest`, `databricks/gpt-astra-latest`, `databricks/gpt-mini-latest`, `databricks/claude-opus-latest`, `databricks/claude-sonnet-latest`, `databricks/claude-haiku-latest`, `databricks/claude-fable-latest`, `databricks/grok-latest`, `databricks/kimi-latest`, `databricks/glm-latest`, `databricks/glm-flash-latest` |
| GitHub Copilot | `github_copilot/gpt-luna-latest`, `github_copilot/gpt-sol-latest`, `github_copilot/gpt-terra-latest`, `github_copilot/gpt-astra-latest`, `github_copilot/claude-opus-latest`, `github_copilot/claude-sonnet-latest`, `github_copilot/claude-haiku-latest`, `github_copilot/claude-fable-latest`, `github_copilot/grok-latest`, `github_copilot/kimi-latest` |
| Baseten | `baseten/kimi-latest`, `baseten/glm-latest`, `baseten/glm-flash-latest`, `baseten/deepseek-pro-latest`, `baseten/deepseek-flash-latest` |
| Fireworks AI | `fireworks_ai/kimi-latest`, `fireworks_ai/minimax-latest` |
| Together AI | `together_ai/kimi-latest`, `together_ai/glm-latest`, `together_ai/glm-flash-latest`, `together_ai/deepseek-pro-latest`, `together_ai/qwen-flash-latest` |

A host gets an alias only when it serves that model and the host's row is not past its deprecation date, so some families appear under fewer hosts.

Each alias is its own entry in the [model cost map](https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json) whose `alias_of` field names the target model, for example `"claude-haiku-latest": {"alias_of": "claude-haiku-5-5"}`, so the alias is billed at the target model's price. To control when you change models, use a specific model ID instead. A newer target can change pricing and model behavior.
