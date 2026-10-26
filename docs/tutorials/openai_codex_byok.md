---
title: Use your ChatGPT login with Codex and Pi
sidebar_label: ChatGPT subscription
description: Keep your ChatGPT login in Codex and send requests through LiteLLM with a separate gateway key. Includes local setup and Pi.
---

# Use your ChatGPT login through LiteLLM

Use Codex with your ChatGPT subscription while LiteLLM controls model access and records usage. You keep the same Codex interface and sign-in. This guide starts with Codex; [Pi setup](#pi) is below.

You need [Codex installed](https://developers.openai.com/codex/cli) and a ChatGPT account with access to the model you choose. The walkthrough was tested with Codex CLI 0.160.0. Each developer keeps their login on their computer; no ChatGPT auth file is uploaded to LiteLLM.

<video controls playsInline preload="metadata" poster="/img/codex-subscriptions/poster.png" style={{width: '100%', aspectRatio: '16 / 10', borderRadius: '16px'}}>
  <source src="/img/codex-subscriptions/walkthrough.mp4" type="video/mp4" />
  <track default kind="captions" src="/img/codex-subscriptions/walkthrough.vtt" srcLang="en" label="English" />
</video>

*Recorded Codex terminal output with live OpenAI responses. Idle time is shortened. The recording reuses an existing ChatGPT login; browser sign-in is not shown. The final usage table comes from a disposable gateway database.*

## 1. Prepare the proxy

**Already have a proxy?** Keep it and add the model below. If your administrator has already exposed the model, move to step 2.

**Need a local proxy?** Use the curl setup in the [proxy quickstart](../proxy/docker_quick_start.md), then return here once the proxy is running and you can open its dashboard. Skip that guide's API-key model and Playground steps: Codex will supply your subscription login.

The administrator adds a model available to the developers' subscriptions. This example exposes `{{chatgpt_small}}`:

```yaml title="config.yaml"
model_list:
  - model_name: {{chatgpt_small}}
    litellm_params:
      model: chatgpt/{{chatgpt_small}}
    model_info:
      mode: responses
```

Merge this entry into your proxy's existing `model_list` and restart it with the updated config. There is no OpenAI API key or saved ChatGPT login to add.

If you used the Docker Compose quickstart, open its installation directory (normally `~/litellm-gateway`) and save `config.yaml` next to `docker-compose.quickstart.yml`. Create this additional file to load it:

```yaml title="compose.codex.yml"
services:
  litellm:
    volumes:
      - ./config.yaml:/app/config.yaml:ro
    command: ["--config", "/app/config.yaml", "--port", "4000"]
```

Run this in that directory to apply the configuration. Use both `-f` arguments when you restart or update this stack so it keeps loading your model config:

```bash
docker compose -f docker-compose.quickstart.yml -f compose.codex.yml up -d
```

In the dashboard, open **Virtual Keys** and click **+ Create New Key**. Give the key a name, select `{{chatgpt_small}}` under **Models**, keep **Owned By** set to **You**, and click **Create Key**. Copy the key when it appears. If someone else manages the proxy, ask them for its URL, model name, and a virtual key assigned to you.

Use the same model name in the proxy, key permissions, and Codex configuration below.

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

Check your existing login:

```bash
codex login status
```

If it says you are logged in with ChatGPT, continue. Otherwise, run this command and complete sign-in in your browser:

```bash
codex login
```

Add the following to `~/.codex/config.toml`, preserving your other settings. Put `model` and `model_provider` at the top level, before any table headings. Update existing entries instead of adding duplicate keys. Set `model` to the name exposed by your gateway. The model must also be available to your ChatGPT subscription.

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

Ask Codex: `Reply with exactly Hello. Do not use tools.` You should see `Hello` in the same Codex interface.

Open your LiteLLM dashboard at `/ui`, then **Logs**. Find the completed request and check its model, virtual key, and input/output token counts. Each developer needs their own LiteLLM key for separate gateway attribution.

## How your login is used

This follows the same two-credential pattern as [Claude Code subscription forwarding](./claude_code_max_subscription.md).

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

## Troubleshooting

| What you see | What to check |
|---|---|
| LiteLLM rejects the gateway key | Export `LITELLM_API_KEY` in the terminal that launches Codex. Restart the client after changing it. |
| Model access denied | Use the same model name in `model_list`, the virtual key's allowed models, and the client configuration. |
| OpenAI rejects your login | Run `codex login status`, then `codex login` if needed. In Pi, run `/login`. |
| OpenAI rejects the model or reports a limit | Choose a model your subscription supports, or wait for its allowance to reset. LiteLLM does not add quota. |
| Codex answers, but no request appears in LiteLLM | Check `model_provider` and `base_url`, then start a new Codex session. |

For a managed Codex rollout, see OpenAI's [Sign in with ChatGPT through a gateway](https://learn.chatgpt.com/docs/enterprise/sign-in-with-chatgpt-through-a-gateway). For gateway-owned ChatGPT credentials, see the separate [`chatgpt/` provider guide](../providers/chatgpt.md).
