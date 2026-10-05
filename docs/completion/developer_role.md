# Developer Role

OpenAI's `developer` role carries instructions with higher priority than the user's messages. Most providers have no such role, so LiteLLM translates it per backend before the request leaves the gateway. This page describes what each backend receives when a request carries `developer` messages, on `/v1/chat/completions` and on `/v1/responses` requests served through the chat completions bridge (`use_chat_completions_api: true`)

## What each backend receives

| Backend | What happens to `developer` messages |
|---|---|
| OpenAI (`api.openai.com`), o-series models (o1, o3, o4-mini) | Passed through unchanged |
| OpenAI (`api.openai.com`), every other model, GPT-5 included | Each one becomes a `system` message in the same position |
| Azure OpenAI | Each one becomes a `system` message in the same position |
| OpenAI-compatible backends (`openai/` with a custom `api_base`, `custom_openai/`, `hosted_vllm/`, `fireworks_ai/`, `deepseek/`, `together_ai/`, `groq/`, `xai/`, `openrouter/`, `mistral/`, `databricks/`, `azure_ai/`, `litellm_proxy/`, and every other provider built on the OpenAI chat format) | Hoisted to the top and folded into one leading `system` message |
| Providers with their own message format (Anthropic, Bedrock Converse, Gemini, Vertex AI, Ollama) | Untouched. Their own transformations handle `developer` the way they always have |

## Hoisting on OpenAI-compatible backends

Many open-weight chat templates (Qwen3, DeepSeek, and others served by vLLM, Fireworks, or Together) only accept a `system` message at the very beginning of the conversation. A `developer` message that arrives later, for example a per-turn permissions item from Codex CLI or an instruction re-injected after context compaction, used to be translated to a `system` message in place, and those templates answered `400 System message must be at the beginning`

On OpenAI-compatible backends LiteLLM now moves every `developer` message that appears after the first non-instruction message up to the top of the conversation and merges it, together with any leading `system` or `developer` messages, into a single leading `system` message. The request below

```json
{
  "messages": [
    {"role": "system", "content": "You are a terse assistant."},
    {"role": "user", "content": "Remember the word Paris."},
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
    {"role": "user", "content": "Remember the word Paris."},
    {"role": "user", "content": "What is the capital of France?"}
  ]
}
```

The rules behind that:

- Plain string contents are joined with a blank line between them
- A member carrying `cache_control` or Anthropic billing metadata is kept as its own text block instead of being joined, so each cache breakpoint stays on its own block. Whenever any member has list content, the merged message uses list content
- A `developer` message that closes the conversation right after an `assistant` turn (a follow-up instruction with no user message after it) stays where it is, since moving it would change what the model is asked to answer
- Client-authored `system` messages are never moved. A `system` message placed mid-conversation is forwarded as sent, and a backend with a system-first template rejects it exactly as it would when called directly
- Consecutive `system` messages anywhere in the conversation are merged into one, in place
- The hoisted instruction applies from the start of the conversation rather than from the position the client placed it. Send `system` instead of `developer` when a mid-conversation position matters and the backend accepts it

There is no setting to turn the hoist off. It applies to every provider whose chat format is OpenAI's, which is the same set that already had `developer` rewritten to `system` before; only the position changes

## Native Responses API routes

Backends that implement the Responses API themselves receive the client's `input` items with their own translation. Fireworks folds `instructions`, the leading `system` and `developer` items, and every later `developer` item into the top-level `instructions` field, see [Fireworks AI](../providers/fireworks_ai.md). Other native Responses routes forward `developer` items as they arrive; route a system-first model through the chat completions bridge when its Responses API rejects a later `developer` item
