---
title: Use your ChatGPT subscription with Codex
sidebar_label: ChatGPT subscription
description: Connect Codex to LiteLLM with your ChatGPT subscription. Configure a model, create a virtual key, and start using the CLI or desktop app.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

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

## Step 2: Create a virtual key

Open your proxy's dashboard at `/ui`. Go to **Virtual Keys → + Create New Key**, enter a name, select `gpt-*` under **Models**, then click **Create Key** and copy the key. Keep **Owned By** set to **You**. Skip this step if your administrator has already given you a key.

## Step 3: Connect Codex

In Terminal, export your LiteLLM key:

```bash
export LITELLM_API_KEY="sk-<your-litellm-virtual-key>"
```

Open `~/.codex/config.toml`. In the desktop app, use **Settings → Configuration → Open config.toml**. Keep your existing model and reasoning settings. Set `model_provider` at the top of the file, before any `[table]` headings, and add the provider block:

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

Replace `http://localhost:4000` with your proxy URL. Choose a GPT model available to your subscription in Codex. Keep `env_key` unset so Codex uses your ChatGPT login.

<Tabs>
<TabItem value="desktop" label="Desktop (macOS)" default>

Sign into ChatGPT in the app if needed, save the config, then fully quit the app with **⌘Q**. From the **same Terminal** where you exported the key, reopen it:

```bash
open -a ChatGPT --env "LITELLM_API_KEY=$LITELLM_API_KEY"
```

If your app is named **Codex**, use `open -a Codex` with the same `--env` argument. Open **Codex** and start a **new chat**. Launching from Finder does not pass along your Terminal's exported key.

</TabItem>
<TabItem value="cli" label="Codex CLI">

If you are not already signed in with ChatGPT, run `codex login` and complete browser sign-in. Then start Codex from the same Terminal:

```bash
codex
```

</TabItem>
</Tabs>

## Step 4: Verify a request

Send: **Reply with exactly Hello. Do not use tools.**

You should receive `Hello`. In the LiteLLM dashboard, open **Logs** and find the successful request with your model, virtual key, and input/output token counts.

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

In Pi, run `/login` and choose the built-in OpenAI Codex provider. Export `LITELLM_API_KEY` as in step 3, then add this override to `~/.pi/agent/models.json`:

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
| Gateway rejects the key | Export `LITELLM_API_KEY` and relaunch the client from that Terminal. |
| Model access denied | Allow `gpt-*` on the key and choose a GPT model your subscription supports. |
| OpenAI rejects the login or model | Sign in again with ChatGPT and choose a model your plan supports. |
| No request appears in LiteLLM | Check `model_provider` and `base_url`, then start a new Codex chat. |

For gateway-owned accounts, use the [ChatGPT provider guide](../providers/chatgpt.md).
