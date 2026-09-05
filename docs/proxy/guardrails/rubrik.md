import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Rubrik Guardrail

Use Rubrik's moderation and logging integration to screen prompts and responses against an external policy service and batch-log all LLM requests/responses.

**Key features:**

- **Prompt moderation** (`pre_call`): Screens the prompt before the LLM is called. Works for both OpenAI and Anthropic wire formats.
- **Response moderation** (`post_call`): Screens the assistant's response text and tool calls after the LLM returns. Either can be blocked.
- **Streaming**: The stream is buffered until the assembled response has been moderated, so no flagged chunk reaches the client before a block.
- **Batch logging**: Logs all LLM requests and responses to Rubrik with configurable sampling and batching. Blocks are always logged, regardless of sampling.
- **Fail-open**: If the Rubrik service is unavailable, requests are allowed through unchanged.

---

## Quick Start

### 1. Configure `config.yaml`

Credentials can be set directly in the YAML config or via environment variables. The config approach is recommended.

<Tabs>
<TabItem value="config" label="config.yaml (Recommended)" default>

```yaml
model_list:
  - model_name: {{openai_large}}
    litellm_params:
      model: openai/{{openai_large}}
      api_key: os.environ/OPENAI_API_KEY

guardrails:
  - guardrail_name: "rubrik"
    litellm_params:
      guardrail: rubrik
      mode: ["pre_call", "post_call"]
      api_key: "your-rubrik-api-key"
      api_base: "https://your-rubrik-service.example.com"
      default_on: true
```

You can also reference environment variables in the config:

```yaml
guardrails:
  - guardrail_name: "rubrik"
    litellm_params:
      guardrail: rubrik
      mode: ["pre_call", "post_call"]
      api_key: os.environ/RUBRIK_API_KEY
      api_base: os.environ/RUBRIK_WEBHOOK_URL
      default_on: true
```

</TabItem>
<TabItem value="env" label="Environment Variables">

As an alternative, you can configure the Rubrik service URL and API key purely through environment variables. When set, these are used as fallbacks if `api_base` / `api_key` are not provided in the config.

```bash
export RUBRIK_WEBHOOK_URL="https://your-rubrik-service.example.com"
export RUBRIK_API_KEY="your-rubrik-api-key"
```

With a minimal config:

```yaml
model_list:
  - model_name: {{openai_large}}
    litellm_params:
      model: openai/{{openai_large}}
      api_key: os.environ/OPENAI_API_KEY

guardrails:
  - guardrail_name: "rubrik"
    litellm_params:
      guardrail: rubrik
      mode: ["pre_call", "post_call"]
      default_on: true
```

</TabItem>
</Tabs>

### 2. Launch the Proxy

```bash
litellm --config config.yaml --port 4000
```

### 3. Test It

```bash
curl -X POST http://localhost:4000/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-1234" \
  -d '{
    "model": "{{openai_large}}",
    "messages": [{"role": "user", "content": "What is the weather in SF?"}],
    "tools": [
      {
        "type": "function",
        "function": {
          "name": "get_weather",
          "description": "Get the weather for a location",
          "parameters": {
            "type": "object",
            "properties": {
              "location": {"type": "string"}
            },
            "required": ["location"]
          }
        }
      }
    ]
  }'
```

---

## Configuration Reference

### YAML Config Parameters

These are set under `guardrails.[].litellm_params` in your `config.yaml`:

| Parameter | Required | Description |
|-----------|----------|-------------|
| `guardrail: rubrik` | Yes | Selects the Rubrik guardrail integration |
| `mode` | Yes | `"pre_call"` for prompt moderation, `"post_call"` for response moderation, or a list containing both |
| `api_base` | Yes | Rubrik webhook base URL. Can use `os.environ/RUBRIK_WEBHOOK_URL`. Falls back to `RUBRIK_WEBHOOK_URL` env var if omitted. |
| `api_key` | No | Rubrik API key. Can use `os.environ/RUBRIK_API_KEY`. Falls back to `RUBRIK_API_KEY` env var if omitted. |
| `default_on` | No | When `true`, the guardrail runs on all requests. When omitted it resolves to `false` and callers opt in per request with `"guardrails": ["rubrik"]` |

### Environment Variables

These are optional fallbacks used when `api_base` / `api_key` are not set in the YAML config. `RUBRIK_SAMPLING_RATE` and `RUBRIK_BATCH_SIZE` can only be set via environment variables.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RUBRIK_WEBHOOK_URL` | Only if `api_base` not in config | — | Base URL of the Rubrik webhook service |
| `RUBRIK_API_KEY` | No | — | Bearer token for authenticating with the Rubrik service |
| `RUBRIK_SAMPLING_RATE` | No | `1.0` | Fraction of requests to **log** (0.0 to 1.0). Does not affect moderation, which always runs, and does not affect block logging. Set to `0.5` to log ~50% of requests. |
| `RUBRIK_BATCH_SIZE` | No | `512` | Number of log entries to buffer before flushing. Logs are also flushed on a periodic interval. |

---

## How Moderation Works

On `pre_call`, the guardrail sends the normalized prompt to `{api_base}/v1/before_prompt/openai/v1` as a plain OpenAI chat completions request. The service returns `{}` to allow it, or a chat completion whose `choices[0].message.content` carries the refusal. On a refusal the LLM is never called.

On `post_call`, the guardrail sends the assistant's text and tool calls to `{api_base}/v1/after_completion/openai/v1`. The service returns the moderated response; a removed tool call or replaced response text is treated as a block.

A blocked request returns the policy explanation with `finish_reason: content_filter` instead of the original response. If either service is unreachable or returns an error, the guardrail **fails open** and the request proceeds unchanged.

### Request/Response format

On `post_call` the guardrail sends a JSON envelope:

```json
{
  "request": {
    "messages": [...],
    "model": "{{openai_large}}",
    "tools": [...]
  },
  "response": {
    "id": "chatcmpl-...",
    "object": "chat.completion",
    "choices": [{
      "message": {
        "role": "assistant",
        "content": "...",
        "tool_calls": [...]
      }
    }]
  }
}
```

`request.tools` carries the caller's declared tool list so the service can compare returned tool calls against it. The service should return an OpenAI chat completion containing only the **allowed** tool calls, with `content` carrying the replacement text or the blocking explanation.

---

## How Batch Logging Works

All LLM requests (successes and failures) are queued and sent in batches to `{api_base}/v1/litellm/batch`.

- Logs are flushed when the queue reaches `RUBRIK_BATCH_SIZE` (default 512) or on a periodic interval (default 5 seconds). These defaults are inherited from LiteLLM's global settings.
- Use `RUBRIK_SAMPLING_RATE` to reduce logging volume in high-traffic deployments. Sampling only affects routine logging; moderation always runs, and blocks are always logged.
- Log IDs are normalized to `litellm_call_id` across all providers, so the moderation log, the block log, and the batch log for one request share a correlation key.
