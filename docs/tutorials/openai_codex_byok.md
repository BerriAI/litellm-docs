---
title: Use your ChatGPT login with Codex and Pi
sidebar_label: ChatGPT subscription
---

# Use your ChatGPT login through LiteLLM

Sign in to ChatGPT in Codex or Pi and send model requests through LiteLLM. Your client keeps the login and refreshes it. LiteLLM authenticates a separate virtual key, enforces model access, and records usage for that gateway user.

This is the same two-credential pattern as [Claude Code subscription forwarding](./claude_code_max_subscription.md). An administrator adds a `chatgpt/` model using the usual LiteLLM model configuration. Each developer keeps their own login; no auth file is uploaded to the gateway.

<video controls playsInline preload="metadata" poster="/img/codex-subscriptions/poster.png" style={{width: '100%', aspectRatio: '16 / 10', borderRadius: '16px'}}>
  <source src="/img/codex-subscriptions/walkthrough.mp4" type="video/mp4" />
  <track default kind="captions" src="/img/codex-subscriptions/walkthrough.vtt" srcLang="en" label="English" />
</video>

*Recorded Codex terminal output with live OpenAI responses. Idle time is shortened. The recording reuses an existing ChatGPT login; browser sign-in is not shown. The final usage table comes from a disposable gateway database.*

## 1. Prepare the proxy

**Already have a proxy?** Keep it and add the model below. If your administrator has already exposed the model, move to step 2.

If you need a proxy, follow the [proxy quickstart](../proxy/docker_quick_start.md) first. Ask its administrator for the gateway URL and a [virtual key](../proxy/virtual_keys.md) assigned to your user.

The administrator adds a model available to the developers' subscriptions. This example exposes `{{chatgpt_small}}`:

```yaml title="config.yaml"
model_list:
  - model_name: {{chatgpt_small}}
    litellm_params:
      model: chatgpt/{{chatgpt_small}}
    model_info:
      mode: responses
```

Merge this entry into the existing `model_list` and restart the proxy with the updated config. There is no OpenAI API key or saved ChatGPT login to add. Give each developer a virtual key that allows `{{chatgpt_small}}`. If you use another model name, use it consistently in the key permissions and client configuration.

For a proxy dedicated to client-owned subscriptions, leave gateway auth files and API credentials unset and do not configure paid-provider fallbacks. Requests without a forwarded login can otherwise use an existing gateway-owned login.

## 2. Connect Codex

Export your LiteLLM key in the terminal that launches the client. Replace the placeholder with your key and keep it out of committed files.

```bash
export LITELLM_API_KEY="sk-<your-litellm-virtual-key>"
```

| Credential | Where it belongs | What it authorizes |
|---|---|---|
| ChatGPT login | Codex or Pi on your computer | Your subscription at OpenAI |
| LiteLLM virtual key | `LITELLM_API_KEY` in your client environment | Your access to the gateway |

Use a Codex version that supports ChatGPT login with a custom model provider. Sign in with ChatGPT if you have not already:

```bash
codex login
codex login status
```

Add the following to `~/.codex/config.toml`, preserving your other settings. Put `model_provider` at the top level, before any table headings. Set `model` to the name exposed by your gateway. The model must also be available to your ChatGPT subscription.

```toml title="~/.codex/config.toml"
model = "{{chatgpt_small}}"
model_provider = "litellm_subscription"

[model_providers.litellm_subscription]
name = "LiteLLM subscription"
base_url = "https://litellm.example.com/v1"
wire_api = "responses"
supports_websockets = false
requires_openai_auth = true
env_http_headers = { "x-litellm-api-key" = "LITELLM_API_KEY" }
```

Replace `https://litellm.example.com` with your gateway URL. For a local proxy on the default port, use `http://localhost:4000/v1`. Keep `env_key` unset on this provider so Codex uses its ChatGPT login for OpenAI authentication.

Start a new Codex session:

```bash
codex
```

For the desktop app, make `LITELLM_API_KEY` available to the app's environment and restart it. A macOS app launched from Finder does not inherit a terminal's exports. See the [desktop setup guide](../proxy/client_setup/codex_chatgpt_desktop.md) for environment setup.

## 3. Verify your request

Ask the client to reply with `Hello`. In LiteLLM, open **Logs** and find the completed `/v1/responses` request. Check its model, gateway user, virtual key, and input/output token counts. Each developer needs their own LiteLLM key for separate gateway attribution.

The ChatGPT bearer and account header go to OpenAI. The LiteLLM key and cookies do not. The gateway redacts credential headers from logging callbacks and does not save the subscription login for later requests. The client handles token refresh and reauthentication.

If the client sends a ChatGPT account or workspace header, LiteLLM preserves it for OpenAI to validate. It does not replace that selection with the token's default workspace.

The two credentials are independently authenticated. LiteLLM does not establish that the gateway identity and the ChatGPT identity belong to the same person. OpenAI-side subscription attribution comes from the forwarded login. Enterprise workspace analytics must be checked separately in [OpenAI's reporting](https://learn.chatgpt.com/docs/enterprise/workspace-analytics).

## Limits and errors

Subscription requests retain OpenAI's model eligibility and quota limits. A forwarded login takes precedence over gateway credentials and stays attached to retries across ChatGPT deployments. It does not automatically switch to another subscription when the caller hits a limit. Explicitly configured cross-provider fallbacks can use their own API credentials and incur separate charges; leave them unset for a subscription-only deployment.

ChatGPT models have a recorded cost of $0 in LiteLLM. Use request or token rate limits rather than dollar budgets to constrain this traffic. Gateway token counts do not measure the subscription's remaining allowance.

## Native Codex compatibility and Pi

Clients that need OpenAI's native Codex model catalog and request format can use `https://litellm.example.com/backend-api/codex` instead. For Codex, change only the provider's `base_url` above. The same login and LiteLLM key are used; native passthrough does not require a `model_list` entry. The key must allow the upstream model name because this route does not resolve LiteLLM aliases.

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

Native requests do not run through model-group routing or its fallbacks. Authentication and quota errors return to that caller without switching accounts.

The native routes are `GET /backend-api/codex/models` and `POST /backend-api/codex/responses`. The model catalog is returned in OpenAI's native format. Listing a model does not grant access to it; the gateway enforces the key's model permissions on inference. This integration supports HTTP and SSE, not native WebSockets or other Codex backend routes.

If LiteLLM rejects the request, check the virtual key and allowed model names. If OpenAI rejects the login, check `codex login status` or sign in again through Pi. If requests still go directly to OpenAI, confirm the selected client provider and gateway URL.

For a managed Codex rollout, see OpenAI's [Sign in with ChatGPT through a gateway](https://learn.chatgpt.com/docs/enterprise/sign-in-with-chatgpt-through-a-gateway). For gateway-owned ChatGPT credentials, see the separate [`chatgpt/` provider guide](../providers/chatgpt.md).
