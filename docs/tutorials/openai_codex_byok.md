---
title: Use your ChatGPT subscription with Codex
sidebar_label: ChatGPT subscription
description: Connect Codex to LiteLLM with your ChatGPT subscription. Configure a model, create a virtual key, and start using the CLI or desktop app.
---

# Use your ChatGPT subscription with Codex

Send Codex requests through LiteLLM using your own ChatGPT login. LiteLLM controls model access and records token usage; Codex keeps your login and refreshes it.

## Prerequisites

- Codex CLI or desktop app installed, with a ChatGPT account that can use your chosen model.
- A running [LiteLLM proxy](../proxy/docker_quick_start.md) with PostgreSQL for virtual keys and logs.

## Step 1: Configure the proxy

Add this entry to your proxy's `model_list` and restart the proxy. Skip this step if your administrator has already added the model.

```yaml title="config.yaml" keep-model-ids
model_list:
  - model_name: "gpt-*"
    litellm_params:
      model: "chatgpt/gpt-*"
    model_info:
      mode: responses
```

The wildcard routes Codex model names such as GPT-6 Luna and GPT-6 Astra through ChatGPT. You do not need an entry per model, an OpenAI API key, or a ChatGPT auth file on the proxy. Your subscription determines which models you can use.

## Step 2: Create and save a virtual key

In your proxy dashboard, open **Virtual Keys → + Create New Key**. Enter a name, select `gpt-*` under **Models**, and create the key. If you already have a key, use it below.

Save your key in `~/.codex/.env`. Both the app and CLI read this file. Create it if needed; replace the key if it already exists.

```dotenv title="~/.codex/.env"
LITELLM_API_KEY=sk-<your-litellm-virtual-key>
```

Replace the placeholder with your key. Run `chmod 600 ~/.codex/.env` to keep the file private.

## Step 3: Connect Codex

Open `~/.codex/config.toml` or use **Settings → Configuration → Open config.toml** in the app. Keep your model and reasoning settings. Update `model_provider` above any `[table]` headings, then add this provider:

```toml title="~/.codex/config.toml"
model_provider = "litellm_subscription"

[model_providers.litellm_subscription]
name = "LiteLLM subscription"
base_url = "http://localhost:4000/v1"
wire_api = "responses"
supports_websockets = false
requires_openai_auth = true
env_http_headers = { "x-litellm-api-key" = "LITELLM_API_KEY" }
```

Replace `http://localhost:4000` with your proxy URL. Keep `env_key` unset so Codex uses your ChatGPT login.

Save the file and **restart Codex**. Sign in with ChatGPT if needed, then start a new chat and choose your model.

## Step 4: Verify a request

Send: **Reply with exactly Hello. Do not use tools.**

You should receive `Hello`. In the LiteLLM dashboard, open **Logs** and find the successful request with your model, virtual key, and input/output token counts.

## Step 5: Add a paid fallback (optional)

To keep working when your subscription reaches its limit, add an API-backed deployment as a fallback. **API usage is billed separately.** Fallbacks can also trigger on other request failures, not only quota errors.

Use the same `gpt-*` wildcard for both deployments. `order: 1` tries ChatGPT first; `order: 2` uses the same model through the OpenAI API. Merge this into your proxy's `config.yaml`, preserving your other models and settings:

```yaml title="config.yaml" keep-model-ids
model_list:
  - model_name: "gpt-*"
    litellm_params:
      model: "chatgpt/gpt-*"
      order: 1
    model_info:
      mode: responses

  - model_name: "gpt-*"
    litellm_params:
      model: "openai/gpt-*"
      api_key: os.environ/OPENAI_API_KEY
      order: 2
    model_info:
      mode: responses
```

Set `OPENAI_API_KEY` in the **proxy's environment** and restart the proxy. Keep your Codex config and virtual key's `gpt-*` access unchanged.

Luna falls back to API Luna; Astra falls back to API Astra. The model must be available to both your subscription and API account. Check **Logs** to see which deployment served the request and its API cost. See [deployment ordering](../proxy/load_balancing.md#deployment-ordering-priority) for more options.

## Limits

Your ChatGPT plan's model access and quota still apply. LiteLLM does not pool subscriptions or switch accounts when you reach a limit. Leave paid-provider fallbacks unset for subscription-only traffic. ChatGPT requests have a recorded cost of $0 in LiteLLM; use request or token rate limits rather than dollar budgets.

<details>
<summary>How credentials are handled</summary>

Your LiteLLM key authorizes gateway access. Your ChatGPT login authorizes OpenAI usage and takes precedence over a saved gateway login. Codex owns sign-in and refresh; LiteLLM forwards the login for that request and redacts credential headers from logging callbacks. Gateway keys and cookies are removed before forwarding.

An explicit ChatGPT workspace selection is preserved for OpenAI to validate. Gateway and ChatGPT identities are authenticated independently. See [OpenAI's gateway guide](https://learn.chatgpt.com/docs/enterprise/sign-in-with-chatgpt-through-a-gateway) for managed rollouts.

</details>

<details>
<summary>Pi and native Codex compatibility</summary>

### Pi {#pi}

In Pi, run `/login` and choose the built-in OpenAI Codex provider. Export your key in the Terminal that launches Pi:

```bash
export LITELLM_API_KEY="sk-<your-litellm-virtual-key>"
```

Add this override to `~/.pi/agent/models.json`:

```json title="~/.pi/agent/models.json"
{
  "providers": {
    "openai-codex": {
      "baseUrl": "http://localhost:4000/backend-api/codex",
      "headers": {
        "x-litellm-api-key": "LITELLM_API_KEY"
      }
    }
  }
}
```

Replace the proxy URL, restart Pi from that Terminal, and select a model your subscription and LiteLLM key allow. The header value names the environment variable; keep Pi's built-in subscription login.

Codex can use this native route too: change its provider's `base_url` to `http://localhost:4000/backend-api/codex`. Native requests need no `model_list` entry and use upstream model names, without router aliases or fallbacks. The key must allow the requested model. HTTP/SSE is supported; native WebSockets are not.

</details>

## Troubleshooting

| Problem | Fix |
|---|---|
| Gateway rejects the key | Check `LITELLM_API_KEY` in `~/.codex/.env` and restart Codex. |
| Model access denied | Allow `gpt-*` on the key and choose a GPT model your subscription supports. |
| OpenAI rejects the login or model | Sign in again with ChatGPT and choose a model your plan supports. |
| No request appears in LiteLLM | Check `model_provider` and `base_url`, then start a new Codex chat. |

For gateway-owned accounts, use the [ChatGPT provider guide](../providers/chatgpt.md).
