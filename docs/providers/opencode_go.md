---
title: OpenCode Go
description: Use OpenCode Go through LiteLLM with one API key, automatic model routing, session affinity, and estimated token usage costs.
---

# OpenCode Go

Use your OpenCode Go or Go Plus subscription through LiteLLM with the `opencode_go/` model prefix. LiteLLM selects the upstream API format for each supported model and records usage under the OpenCode Go provider.

OpenCode Go is the hosted inference service. The OpenCode coding app can also use other providers through LiteLLM. For that setup, see the [OpenCode quickstart](../tutorials/opencode_integration.md).

## Connect your Go account

You need an active Go or Go Plus subscription and an API key from [OpenCode Console](https://opencode.ai/console). Use a personal or service API key as described in the [Console API documentation](https://opencode.ai/v2/docs/console/models/). A subscription login in the OpenCode app does not automatically authenticate LiteLLM.

Set the key in the shell where you run LiteLLM. Replace the placeholder with your key and keep it out of source control.

```bash
export OPENCODE_API_KEY="your-opencode-api-key"
```

### Python SDK

```python
from litellm import completion, completion_cost

response = completion(
    model="opencode_go/glm-5.3-flash",
    messages=[{"role": "user", "content": "Say hello."}],
    litellm_session_id="my-conversation-1",
)

print(response.choices[0].message.content)
print(response.usage)
print(completion_cost(completion_response=response))
```

A successful call returns the assistant's greeting and token usage. Reuse the session ID for later turns in the same conversation.

### LiteLLM gateway

Save this as `config.yaml`:

```yaml keep-model-ids
model_list:
  - model_name: go-chat
    litellm_params:
      model: opencode_go/glm-5.3-flash
      api_key: os.environ/OPENCODE_API_KEY
  - model_name: go-responses
    litellm_params:
      model: opencode_go/gpt-6-luna
      api_key: os.environ/OPENCODE_API_KEY
  - model_name: go-messages
    litellm_params:
      model: opencode_go/claude-haiku-5-5
      api_key: os.environ/OPENCODE_API_KEY

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

Set your gateway key and start the server:

```bash
export LITELLM_MASTER_KEY="your-litellm-gateway-key"
litellm --config config.yaml --host 127.0.0.1 --port 4000
```

Check the connection:

```bash
curl http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H 'Content-Type: application/json' \
  -H 'x-litellm-session-id: my-conversation-1' \
  -d '{"model":"go-chat","messages":[{"role":"user","content":"Say hello."}]}'
```

The response contains the greeting in `choices[0].message.content`. Keep the upstream OpenCode key on the gateway. Clients use the LiteLLM key.

## Use OpenCode with this gateway

Add this provider to your project's `opencode.json`, or merge it into your existing `provider` object:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "litellm-go": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "LiteLLM Go",
      "options": {
        "baseURL": "http://localhost:4000/v1",
        "apiKey": "{env:LITELLM_MASTER_KEY}"
      },
      "models": {
        "go-chat": {"name": "Go Chat"},
        "go-responses": {"name": "Go Responses"},
        "go-messages": {"name": "Go Messages"}
      }
    }
  }
}
```

Start `opencode` from that project in a shell with `LITELLM_MASTER_KEY` set. Run `/models`, choose a model under **LiteLLM Go**, and send a message. This configuration uses Chat Completions between OpenCode and LiteLLM. LiteLLM translates the request to the selected Go model's upstream format.

## API formats and sessions

LiteLLM accepts Chat Completions, Responses, and Anthropic Messages requests. The model catalog determines the upstream format, which can differ from the client's format. Native Responses models use `/responses`, native Messages models use `/messages`, and other requests use LiteLLM's existing translation paths. Gemini models use Go's Google-compatible endpoint. Responses WebSocket transport is not supported.

For direct Responses requests, use `/v1/responses` with `go-responses`. For direct Anthropic Messages requests, use `/v1/messages` with `go-messages` and supply `max_tokens`, as required by that API.

LiteLLM forwards a supplied stable session ID as `x-opencode-session`. For SDK calls, pass `litellm_session_id`. For gateway calls, send `x-litellm-session-id`. An explicit `x-opencode-session` header takes precedence. LiteLLM does not invent a session ID when none is supplied. See [Go's client and session requirements](https://opencode.ai/v2/docs/console/go/).

## Models and pricing

Use model IDs from the [Go model list](https://opencode.ai/v2/docs/console/go/) with the `opencode_go/` prefix. Account permissions, region settings, training preferences, and available allowance can limit which models you can call. Change those preferences in OpenCode Console if you choose to do so.

LiteLLM's catalog contains Go's published input, output, cache-read, cache-write, and context-tier rates where available. These calculate **estimated allowance usage**, not an additional charge for each request. The subscription fee, rolling limits, resets, remaining allowance, and extra usage balance remain managed by OpenCode. LiteLLM budget limits apply to its calculated dollar value and do not mirror your Go plan's limits.

For DeepSeek models with peak and off-peak rates, the catalog uses the published peak rate. Off-peak requests can therefore show a higher estimate than OpenCode deducts. Check Console for authoritative account usage and the [current rate card](https://opencode.ai/v2/docs/console/go/). Model rates and availability can change independently of a LiteLLM release.

Existing `openai/` and `anthropic/` deployments with an OpenCode `api_base` continue to work. Switch their model prefix to `opencode_go/` and remove the explicit base URL to use automatic protocol selection and Go-specific catalog prices.

## Configuration reference

| Setting | Purpose |
| --- | --- |
| `api_key` | Explicit OpenCode API key for a request or deployment. |
| `OPENCODE_GO_API_KEY` | Optional Go-specific key, used before `OPENCODE_API_KEY`. |
| `OPENCODE_API_KEY` | Default OpenCode API key. |
| `api_base` | Explicit upstream base URL override. Usually omit this. |
| `OPENCODE_GO_API_BASE` | Base URL override when `api_base` is absent. A single override must support the formats of the models you use. |

LiteLLM does not fall back to `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` for this provider. If authentication fails, check the Go key and subscription in Console. If a newly added model needs a different upstream protocol, update LiteLLM's model catalog or register its `supported_endpoints` and pricing through [custom model registration](../completion/token_usage.md).
