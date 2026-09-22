# OpenAI Codex with Your Own ChatGPT Login

Route Codex through the LiteLLM proxy while each user keeps signing in with their own ChatGPT account. Codex sends the user's ChatGPT OAuth token as `Authorization: Bearer <token>` and a separate LiteLLM virtual key in a custom header. LiteLLM authenticates the user with the virtual key, applies its budgets, logging and guardrails, and forwards the user's own ChatGPT credential to OpenAI instead of a proxy-configured key or a ChatGPT login owned by the gateway

This is the Codex counterpart of [Claude Code with Bring Your Own Key](./claude_code_byok.md). It keeps the gateway credential and the provider identity separate, so OpenAI receives each request under the account that signed in to Codex

## How It Works

Codex custom providers support `requires_openai_auth = true`, which makes Codex attach its own ChatGPT login (`Authorization: Bearer <chatgpt-oauth-token>` plus `ChatGPT-Account-Id`) to requests sent to the custom `base_url`. `env_http_headers` adds a second header carrying the LiteLLM virtual key

LiteLLM authenticates the request with `x-litellm-api-key`. When the `Authorization` header holds a ChatGPT OAuth token (a JWT carrying the `https://api.openai.com/auth` claim) and was not used to authenticate to LiteLLM, the proxy keeps it and scopes it to the `chatgpt/` provider only. The `chatgpt/` provider then uses that token and the client's `ChatGPT-Account-Id` for the upstream request to the ChatGPT Codex backend. Platform API keys (`sk-...`), malformed tokens, and the LiteLLM key itself are never treated as a ChatGPT login and are never forwarded as one, and requests routed to other providers never receive the ChatGPT credential

Token refresh stays with Codex: LiteLLM does not store or refresh the user's token, so each request carries whatever token Codex currently holds

## Tested Versions

This guide was verified with LiteLLM `1.103.0` (the first version carrying the ChatGPT credential forwarding described here) and Codex CLI `0.154.0` using the HTTP/SSE streaming path of `/v1/responses`. The ChatGPT WebSocket transport used by some Codex builds is not covered; keep Codex on the `responses` wire API as shown below

## Step 1: Configure LiteLLM Proxy

Point a model group at the `chatgpt/` provider. Set a placeholder `api_key` on the deployment so the gateway never runs its own ChatGPT device login: with a placeholder present, a request that arrives without a valid ChatGPT OAuth token fails at OpenAI instead of silently using a gateway-owned account

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: {{openai_large}}
    litellm_params:
      model: chatgpt/{{openai_large}}
      api_key: not-a-real-login

general_settings:
  master_key: sk-<your-master-key>
```

No header forwarding flags are needed. Recognized ChatGPT OAuth tokens are forwarded to the `chatgpt/` provider automatically when a separate header authenticates the request to LiteLLM

Start the proxy:

```bash
litellm --config config.yaml
```

## Step 2: Create a LiteLLM Virtual Key

Create one key per user (or team) so LiteLLM spend tracking, budgets and rate limits apply to the right person:

```bash
curl -X POST http://localhost:4000/key/generate \
  -H "Authorization: Bearer sk-<your-master-key>" \
  -H "Content-Type: application/json" \
  -d '{"models": ["{{openai_large}}"], "user_id": "alice"}'
```

## Step 3: Configure Codex

Add a custom provider to `~/.codex/config.toml`. `requires_openai_auth = true` tells Codex to send its own ChatGPT login to this provider, and `env_http_headers` adds the LiteLLM key from an environment variable. Do not set `env_key` for this provider; Codex ignores it when `requires_openai_auth` is enabled, and the LiteLLM key must not travel in `Authorization`

```toml showLineNumbers title="~/.codex/config.toml"
model = "{{openai_large}}"
model_provider = "litellm"

[model_providers.litellm]
name = "LiteLLM"
base_url = "http://localhost:4000/v1"
wire_api = "responses"
requires_openai_auth = true
env_http_headers = { "x-litellm-api-key" = "LITELLM_API_KEY" }
```

Export the virtual key from step 2 in the shell that launches Codex:

```bash
export LITELLM_API_KEY="sk-<your-litellm-virtual-key>"
```

## Step 4: Sign In and Run Codex

Run `codex login` and choose **Sign in with ChatGPT**. Sign in with the ChatGPT account whose identity should appear on the requests. Then start Codex:

```bash
codex
```

Every request now reaches LiteLLM with two credentials, the LiteLLM virtual key in `x-litellm-api-key` and the user's ChatGPT token in `Authorization`. LiteLLM validates the virtual key, then forwards the request to the ChatGPT Codex backend with the user's token and `ChatGPT-Account-Id`. A second user with their own ChatGPT login and their own virtual key gets their own token forwarded; the two are never mixed

## Verifying Attribution

LiteLLM attributes spend to the virtual key, user and team in its own logs and dashboards. Attribution on the OpenAI side comes from the forwarded token, so it is verified in OpenAI's own reporting: [workspace analytics](https://learn.chatgpt.com/docs/enterprise/workspace-analytics) in the ChatGPT Enterprise admin console, or the [Analytics API](https://learn.chatgpt.com/docs/enterprise/analytics-api). Those surfaces show usage per member of the workspace with OpenAI's documented reporting delay; LiteLLM's estimated dollar cost is not a substitute for figures shown there

:::warning Not live tested against ChatGPT Enterprise reporting

The credential forwarding described here was verified end to end for transport: the real Codex CLI, pointed at LiteLLM with the configuration above, produced upstream requests carrying the signed-in user's token and account id, with the LiteLLM key stripped and two different logins kept separate through one gateway. It was not run against a ChatGPT Enterprise workspace, so per-employee entries in OpenAI workspace analytics have not been observed by the LiteLLM team. A successful model response through the proxy shows that the login reached OpenAI, not that Enterprise reporting recorded it. Confirm attribution in your own workspace analytics before relying on it

:::

## Troubleshooting

### Proxy returns 401

LiteLLM did not accept the virtual key. Check that `LITELLM_API_KEY` is exported in the shell that launches Codex and that `env_http_headers` names that variable. The Codex desktop app does not inherit shell exports on macOS; see the [Codex tutorial](./openai_codex.md) for how to set variables at the login session level

### OpenAI returns 401 through the proxy

The request reached OpenAI without a ChatGPT OAuth token, so the placeholder `api_key` was sent. Make sure `requires_openai_auth = true` is set on the provider, that Codex is signed in with ChatGPT rather than an API key (`codex login status`), and that `env_key` is not set on the provider

### Requests use the gateway's ChatGPT account

If the deployment has no `api_key` and the proxy has completed its own device login, requests without a client token fall back to that stored login. Set the placeholder `api_key` as in step 1 to disable the shared fallback

## Related

- [OpenAI Codex tutorial](./openai_codex.md) for ordinary API key routing
- [ChatGPT Subscription provider](../providers/chatgpt.md) for the `chatgpt/` provider and its gateway-owned login
- [Claude Code with Bring Your Own Key](./claude_code_byok.md) for the equivalent Anthropic flow
