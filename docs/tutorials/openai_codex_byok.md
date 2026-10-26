---
title: Use your ChatGPT login with Codex and Pi
sidebar_label: ChatGPT subscription
---

# Use your ChatGPT login through LiteLLM

Sign in to ChatGPT in Codex or Pi and send model requests through LiteLLM. Your client keeps the login and refreshes it. LiteLLM authenticates a separate virtual key, enforces model access, and records usage for that gateway user.

This is the same two-credential pattern as [Claude Code subscription forwarding](./claude_code_max_subscription.md). You do not upload your ChatGPT auth file or create a `chatgpt/` model on the gateway.

## 1. Get your gateway URL and virtual key

If you already use a LiteLLM proxy, keep it. Ask its administrator for the URL and a [virtual key](../proxy/virtual_keys.md) assigned to your user. If you need a proxy, follow the [proxy quickstart](../proxy/docker_quick_start.md) first.

A restricted key must allow the upstream model name you use in Codex, without a `chatgpt/` prefix. The gateway needs no OpenAI API key or saved ChatGPT login for this flow.

Export your LiteLLM key in the terminal that launches the client. Replace the placeholder with your key and keep it out of committed files.

```bash
export LITELLM_API_KEY="sk-<your-litellm-virtual-key>"
```

| Credential | Where it belongs | What it authorizes |
|---|---|---|
| ChatGPT login | Codex or Pi on your computer | Your subscription at OpenAI |
| LiteLLM virtual key | `LITELLM_API_KEY` in your client environment | Your access to the gateway |

## 2. Connect your client

### Codex

Use a Codex version that supports ChatGPT login with a custom model provider. Sign in with ChatGPT if you have not already:

```bash
codex login
codex login status
```

Add the following to `~/.codex/config.toml`, preserving your other settings. Put `model_provider` at the top level, before any table headings. Keep your existing `model`, using a model available to your subscription.

```toml title="~/.codex/config.toml"
model_provider = "litellm_subscription"

[model_providers.litellm_subscription]
name = "LiteLLM subscription"
base_url = "https://litellm.example.com/backend-api/codex"
wire_api = "responses"
requires_openai_auth = true
env_http_headers = { "x-litellm-api-key" = "LITELLM_API_KEY" }
```

Replace `https://litellm.example.com` with your gateway URL. For a local proxy on the default port, use `http://localhost:4000/backend-api/codex`. Keep `env_key` unset on this provider so Codex uses its ChatGPT login for OpenAI authentication.

Start a new Codex session:

```bash
codex
```

For the desktop app, make `LITELLM_API_KEY` available to the app's environment and restart it. A macOS app launched from Finder does not inherit a terminal's exports. See the [desktop setup guide](../proxy/client_setup/codex_chatgpt_desktop.md) for environment setup.

### Pi

In Pi, run `/login` and select the built-in OpenAI Codex provider. Merge this provider override into `~/.pi/agent/models.json`:

```json title="~/.pi/agent/models.json"
{
  "providers": {
    "openai-codex": {
      "baseUrl": "https://litellm.example.com/backend-api/codex",
      "headers": {
        "x-litellm-api-key": "LITELLM_API_KEY"
      }
    }
  }
}
```

Replace the gateway URL as above. The header value names the environment variable, not a key to paste into the file. Keep Pi's built-in OAuth login and select a model that both Pi and your subscription support. Use HTTP/SSE transport.

## 3. Verify your request

Ask the client to reply with `Hello`. In LiteLLM, open **Logs** and find the completed `/backend-api/codex/responses` request. Check its model, gateway user, virtual key, and input/output token counts. Each developer needs their own LiteLLM key for separate gateway attribution.

The ChatGPT bearer and account header go to OpenAI. The LiteLLM key and cookies do not. The gateway redacts credential headers from logging callbacks and does not save the subscription login for later requests. The client handles token refresh and reauthentication.

The two credentials are independently authenticated. LiteLLM does not establish that the gateway identity and the ChatGPT identity belong to the same person. OpenAI-side subscription attribution comes from the forwarded login. Enterprise workspace analytics must be checked separately in [OpenAI's reporting](https://learn.chatgpt.com/docs/enterprise/workspace-analytics).

## Limits and errors

Subscription requests retain OpenAI's model eligibility and quota limits. An upstream authentication or quota error returns to that caller. LiteLLM does not fall back to another subscription or an API key.

ChatGPT models have a recorded cost of $0 in LiteLLM. Use request or token rate limits rather than dollar budgets to constrain this traffic. Gateway token counts do not measure the subscription's remaining allowance.

The native routes are `GET /backend-api/codex/models` and `POST /backend-api/codex/responses`. The model catalog is returned in OpenAI's native format. Listing a model does not grant access to it; the gateway enforces the key's model permissions on inference. This integration supports HTTP and SSE, not native WebSockets or other Codex backend routes.

If LiteLLM rejects the request, check the virtual key and allowed model names. If OpenAI rejects the login, check `codex login status` or sign in again through Pi. If requests still go directly to OpenAI, confirm the selected client provider and gateway URL.

For a managed Codex rollout, see OpenAI's [Sign in with ChatGPT through a gateway](https://learn.chatgpt.com/docs/enterprise/sign-in-with-chatgpt-through-a-gateway). For gateway-owned ChatGPT credentials, see the separate [`chatgpt/` provider guide](../providers/chatgpt.md).
