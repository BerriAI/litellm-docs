# Developer Role

OpenAI's `developer` role carries instructions with higher priority than the user's messages. Most providers have no such role, so LiteLLM translates it per backend before the request leaves the gateway. This page describes what each backend receives when a request carries `developer` messages, on `/v1/chat/completions` and on `/v1/responses`.

## What each backend receives

| Backend | What happens to `developer` messages |
|---|---|
| OpenAI o-series models (o1, o3, o4-mini) | Passed through unchanged |
| OpenAI, every other model | Each one becomes a `system` message in the same position |
| Azure OpenAI | Each one becomes a `system` message in the same position |
| OpenAI-compatible backends | Each one becomes a `system` message in the same position, unless the model declares `supports_mid_conversation_system: false` |
| Providers with their own message format (Anthropic, Bedrock Converse, Gemini, Vertex AI, Ollama) | Untouched. Their own transformations handle `developer` |

OpenAI-compatible backends are `openai/` with a custom `api_base`, `custom_openai/`, `hosted_vllm/`, `fireworks_ai/`, `deepseek/`, `together_ai/`, `groq/`, `xai/`, `openrouter/`, `mistral/`, `databricks/`, `azure_ai/`, `litellm_proxy/` and every other provider built on the OpenAI chat format.

## Models whose chat template needs the system message first

Many open-weight chat templates (Qwen3.5 and Qwen3.8 among them) accept a `system` message only at the very beginning of the conversation. Codex CLI and other agents send `developer` messages later in the conversation, for example a permissions update or an instruction added after context compaction. Translated in place, those messages reach the model as a mid-conversation `system` message, and the backend answers `400 System message must be at the beginning`.

Available from v1.109.0.

Declare such a model with `supports_mid_conversation_system: false` in the deployment's `model_info`:

```yaml
model_list:
  - model_name: qwen3.5
    litellm_params:
      model: custom_openai/Qwen/Qwen3.5-27B
      api_base: http://my-vllm-server:8000/v1
    model_info:
      supports_mid_conversation_system: false
```

LiteLLM then moves every `developer` message that comes after the first conversation message to the top, and merges it with the leading `system` and `developer` messages into one leading `system` message. The request below

```json
{
  "messages": [
    {"role": "system", "content": "You are a terse assistant."},
    {"role": "user", "content": "Hi there"},
    {"role": "developer", "content": "Answer with exactly one word."},
    {"role": "user", "content": "What is the capital of France?"}
  ]
}
```

reaches the backend as

```json
{
  "messages": [
    {"role": "system", "content": "You are a terse assistant.\n\nAnswer with exactly one word."},
    {"role": "user", "content": "Hi there"},
    {"role": "user", "content": "What is the capital of France?"}
  ]
}
```

Plain string contents are joined with a blank line. When a merged message carries list content, for example a block with `cache_control` or Anthropic billing metadata, each block stays its own text block so every cache breakpoint keeps its position, and the first text block of each later message starts with a blank line, except an Anthropic billing header. When several merged messages carry a `name`, the merged message keeps the last one.

A `developer` message that closes the conversation right after an `assistant` turn is sent as a `user` message instead. Moving it to the top would end the request on the assistant's turn, and a `system` message there fails on the same templates.

Client-authored `system` messages are never moved. A `system` message placed mid-conversation is forwarded as sent, and a backend with a system-first template rejects it exactly as it does when called directly.

The model cost map declares the flag for some hosted models, such as `fireworks_ai/qwen3p8-max`, so those need no configuration. A value in the deployment's `model_info` overrides the cost map in both directions. Models without a declaration keep the in-place translation, so a prompt prefix that a provider caches does not change for them.

## Native Responses API routes

Some backends implement the Responses API themselves and receive the client's `input` items. Fireworks (`fireworks_ai/`) folds the request's `instructions`, the leading `system` and `developer` items and every later text `developer` item into the top-level `instructions` field, unless the deployment's own `model_info` declares `supports_mid_conversation_system: true`, in which case each `developer` item is sent as a `system` item in place. A `true` set on another deployment of the same model does not turn the fold off. A `developer` item that is not folded, such as one that closes the input after an assistant turn, is sent as a `user` item on a model that declares the flag `false`, and as a `system` item otherwise.

`hosted_vllm/` deployments that serve `/v1/responses` natively forward `developer` items as they arrive, unless the model declares `supports_mid_conversation_system: false`. With that declaration they fold the items into `instructions` the same way Fireworks does.

Requests that go through the chat completions bridge (`use_chat_completions_api: true`) follow the chat rules above.
