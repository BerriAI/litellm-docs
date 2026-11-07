---
sidebar_label: "Latest model aliases"
description: "Keep one model name as newer versions arrive. Use -latest aliases in the LiteLLM SDK and AI Gateway."
---

# Latest model aliases

<SinceVersion v="1.109.0" />

An alias such as `openai/gpt-luna-latest` points to a model in that family. LiteLLM maintains the target. As LiteLLM moves the alias to a newer model, your application keeps the same model string.

Use the full `provider/model-latest` name from the table below. You do not need to create an alias mapping.

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

Gemini, Mistral, and DashScope's `qwen-plus-latest` already have provider-managed latest names. LiteLLM passes those through. The aliases above do not extend to Azure, Bedrock, or other hosting providers.

Each alias is its own entry in the [model cost map](https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json) whose `alias_of` field names the target model, for example `"claude-haiku-latest": {"alias_of": "claude-haiku-5-5"}`, so the alias is billed at the target model's price. To control when you change models, use a specific model ID instead. A newer target can change pricing and model behavior.
