import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Codex (Sign in with ChatGPT)

Route Codex clients that are signed in with a ChatGPT account (SIWC) through LiteLLM. LiteLLM authenticates the request with a LiteLLM virtual key, strips that credential, and forwards the ChatGPT bearer token and `ChatGPT-Account-ID` header unchanged to `https://chatgpt.com/backend-api/codex`

| Feature | Supported | Notes |
|-------|-------|-------|
| Logging | ✅ | works across all integrations |
| Streaming | ✅ | |
| Cost Tracking | ✅ | requests are billed to the user's ChatGPT subscription, so recorded spend is $0 |
| Virtual Keys, Teams, Budgets | ✅ | the LiteLLM key identifies the user; per-key rate limits and guardrails apply |

## Why

OpenAI is moving Codex users from API key authentication to Sign in with ChatGPT. With SIWC, the `Authorization` header carries the user's ChatGPT OAuth token instead of a LiteLLM key, so the standard `/v1/responses` route cannot authenticate the request. This endpoint accepts the LiteLLM virtual key out-of-band (header or cookie), which keeps the enterprise gateway in the request path while the ChatGPT backend still authenticates the end user and workspace

Because LiteLLM virtual keys are long-lived, users do not need to re-mint a gateway credential every time a short-lived SSO token expires; they set `LITELLM_API_KEY` once and restart Codex only if the key is rotated

## Quick Start (Codex CLI / IDE / Desktop app)

1. Sign in to Codex with ChatGPT (`codex login`)
2. Add a model provider to `~/.codex/config.toml`:

```toml
model_provider = "litellm"

[model_providers.litellm]
name = "LiteLLM"
base_url = "https://litellm-proxy.example.com/chatgpt"
wire_api = "responses"
requires_openai_auth = true
env_http_headers = { "x-litellm-api-key" = "LITELLM_API_KEY" }
```

3. Start Codex with your LiteLLM virtual key in the environment:

```bash
export LITELLM_API_KEY="sk-your-litellm-virtual-key"
codex
```

`requires_openai_auth = true` makes Codex send the ChatGPT bearer token and `ChatGPT-Account-ID` header, which LiteLLM forwards untouched. `env_http_headers` attaches your LiteLLM virtual key in `x-litellm-api-key`, which LiteLLM consumes for auth and strips before forwarding

## Example Usage

<Tabs>
<TabItem value="header" label="curl (x-litellm-api-key header)">

```bash
curl 'http://0.0.0.0:4000/chatgpt/responses' \
-H 'x-litellm-api-key: sk-your-litellm-virtual-key' \
-H "Authorization: Bearer $CHATGPT_ACCESS_TOKEN" \
-H "chatgpt-account-id: $CHATGPT_ACCOUNT_ID" \
-H 'originator: codex_cli_rs' \
-H 'Content-Type: application/json' \
-H 'Accept: text/event-stream' \
-d '{
    "model": "gpt-5.4",
    "instructions": "You are a helpful assistant.",
    "input": [{"type": "message", "role": "user", "content": [{"type": "input_text", "text": "reply with just: ok"}]}],
    "stream": true,
    "store": false
}'
```

</TabItem>
<TabItem value="cookie" label="curl (cookie)">

For parity with OpenAI's gateway workaround doc, the key can also be sent as a `litellm_api_key` cookie (`env_http_headers = { "Cookie" = "LLM_GATEWAY_AUTH_COOKIE" }` with `LLM_GATEWAY_AUTH_COOKIE="litellm_api_key=sk-..."`)

```bash
curl 'http://0.0.0.0:4000/chatgpt/responses' \
-H 'Cookie: litellm_api_key=sk-your-litellm-virtual-key' \
-H "Authorization: Bearer $CHATGPT_ACCESS_TOKEN" \
-H "chatgpt-account-id: $CHATGPT_ACCOUNT_ID" \
-H 'originator: codex_cli_rs' \
-H 'Content-Type: application/json' \
-H 'Accept: text/event-stream' \
-d '{
    "model": "gpt-5.4",
    "instructions": "You are a helpful assistant.",
    "input": [{"type": "message", "role": "user", "content": [{"type": "input_text", "text": "reply with just: ok"}]}],
    "stream": true,
    "store": false
}'
```

</TabItem>
</Tabs>

The ChatGPT access token and account id live in `~/.codex/auth.json` after `codex login`; Codex sends them automatically, the curl examples only spell them out

## How it works

1. Codex sends its request to `LITELLM_PROXY_BASE_URL/chatgpt/responses` with the ChatGPT bearer in `Authorization`, the workspace id in `ChatGPT-Account-ID`, and the LiteLLM virtual key in `x-litellm-api-key` (or a `litellm_api_key` cookie)
2. LiteLLM validates the virtual key (budgets, rate limits, guardrails, logging all apply) and strips `x-litellm-api-key` and `Cookie` from the request
3. LiteLLM forwards the request to `https://chatgpt.com/backend-api/codex/responses` with the ChatGPT bearer and account id intact and streams the SSE response back

The upstream base can be overridden with the `CHATGPT_API_BASE` environment variable

:::warning
Requests are authenticated upstream by the user's ChatGPT account. LiteLLM must not replace the bearer with an API key, and it never treats the `Authorization` header as a LiteLLM key on this route; a request without a LiteLLM credential is rejected with a 401
:::
