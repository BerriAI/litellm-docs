---
title: Models and routing
sidebar_label: Models and routing
---

# Models and routing

`model=` follows the same convention as `litellm.completion`. A model prefixed with `litellm_proxy/` goes to the gateway, and anything else is called directly through the LiteLLM SDK.

## Gateway mode

With `model="litellm_proxy/coder"`, `coder` is a model group on the gateway. The gateway address and virtual key come from `api_base=` and `api_key=` on the call, or from `LITELLM_PROXY_API_BASE` and `LITELLM_PROXY_API_KEY`. Setting `litellm.use_litellm_proxy = True` sends every call to the gateway, even without the prefix. A gateway model with no base URL or key raises `ValueError` at call time. Load balancing, fallbacks and rate limits on the key all happen on the gateway. See [Using with LiteLLM AI Gateway](./gateway.md).

## SDK mode

`model` is any LiteLLM model string, and the provider key is read on your host the same way `litellm.completion` reads it.

```python
litellm.agent(Harness.CODEX, task, sandbox=box, model="bedrock/us.anthropic.claude-sonnet-4-5-20250929-v1:0")

litellm.agent(
    Harness.CLAUDE_CODE, task, sandbox=box,
    model="hosted_vllm/qwen3-coder",
    api_base="http://gpu-01:8000/v1",
)
```

In SDK mode `api_key=` and `api_base=` apply to the provider. With `model=None`, the runtime's own default model name is used.

## The local model endpoint

The CLI harnesses need an HTTP endpoint to call. For each session, `litellm.agent()` starts a small Starlette app on `127.0.0.1` with a random port, makes it reachable from the sandbox, and points the runtime at it.

| Harness | Configured with | Route | Gateway mode | SDK mode |
|---|---|---|---|---|
| `CLAUDE_CODE` | `ANTHROPIC_BASE_URL` | `/v1/messages` | forwarded to gateway | `litellm.anthropic.messages.acreate` |
| `CODEX` | `model_providers.litellm` | `/v1/responses` | forwarded to gateway | `litellm.aresponses` |
| `OPENCODE` | `litellm` provider in `opencode.json` | `/v1/chat/completions` | forwarded to gateway | `litellm.acompletion` |

The runtime's API key is a random per-session token. The endpoint rejects any other token with 401, and the token stops working when the session closes. In gateway mode the endpoint swaps the token for your virtual key, adds `x-litellm-tags: harness,<name>`, sends `metadata=` as `x-litellm-spend-logs-metadata`, and streams responses through unchanged.

Deep Agents runs in your process with a `ChatLiteLLM` model and doesn't use the endpoint.

## Cost and usage

`Result.usage` has `input_tokens`, `output_tokens`, `calls` and `total_tokens`, and `Result.cost` is in USD. `Session.cost` is the running total. In gateway mode cost comes from the gateway's `x-litellm-response-cost` header, so it matches the gateway's spend logs. In SDK mode it's computed from LiteLLM's model cost map, and counts as 0.0 for models without a price.
