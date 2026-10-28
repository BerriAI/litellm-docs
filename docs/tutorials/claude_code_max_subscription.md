---
title: Use your Claude subscription with Claude Code
sidebar_label: Claude subscription
description: Connect Claude Code to LiteLLM with your Claude subscription. Configure the proxy, create a virtual key, sign in, and verify usage.
---

# Use your Claude subscription with Claude Code

Send Claude Code requests through LiteLLM using your own Claude Pro, Max, Team, or Enterprise subscription. LiteLLM applies access controls, budgets, and guardrails and records usage. Claude Code keeps your login and refreshes it.

## Prerequisites

- [Claude Code](https://code.claude.com/docs/en/overview) installed and a Claude subscription. Team and Enterprise members use the account their administrator invited.
- A running [LiteLLM proxy](../proxy/docker_quick_start.md), **v1.81.14 or later**, with PostgreSQL for virtual keys and logs.

## Step 1: Configure the proxy {#step-1-configure-litellm-proxy}

Add this entry to your proxy's `model_list` and restart the proxy. Skip this step if your administrator has already configured it. Preserve your existing master key, database, and other settings.

```yaml title="config.yaml"
model_list:
  - model_name: "anthropic/*"
    litellm_params:
      model: "anthropic/*"
```

The wildcard routes whichever Claude model your plan allows. Keep this deployment configured as shown to use each developer's subscription login. LiteLLM forwards that login automatically.

## Step 2: Create a virtual key

Open your proxy dashboard at `http://localhost:4000/ui` (replace the URL with your proxy's). For a local proxy, sign in as `admin` with your master key. Go to **Virtual Keys**, click **+ Create New Key**, enter a **Key Name**, and select **All anthropic models** under **Models**. Click **Create Key** and copy the key; it is shown only once.

For an existing key, allow `anthropic/*`. Leaving **Models** empty allows every model on the proxy.

## Step 3: Connect Claude Code

If you previously used API-key authentication, remove `apiKeyHelper` and the `ANTHROPIC_AUTH_TOKEN` / `ANTHROPIC_API_KEY` entries in `env` from your active [Claude Code settings](https://code.claude.com/docs/en/settings): `~/.claude/settings.json` and your project's `.claude/settings.json` or `.claude/settings.local.json`.

From your project folder, clear shell overrides, set your proxy's root URL and virtual key, and launch Claude Code:

```bash
unset ANTHROPIC_AUTH_TOKEN ANTHROPIC_API_KEY ANTHROPIC_MODEL
export ANTHROPIC_BASE_URL="http://localhost:4000"
export ANTHROPIC_CUSTOM_HEADERS="x-litellm-api-key: Bearer sk-<your-litellm-virtual-key>"

claude
```

Replace the URL with your proxy's root address, such as `https://litellm.example.com`, and replace the key. Retain any existing custom headers on separate lines.

Choose **Claude account with subscription** and complete browser sign-in if needed. If the browser does not open, press `c` to copy the URL; paste a code back into the terminal if prompted. Complete the workspace trust prompt for your project. An existing subscription login can stay signed in.

Use `/model` to select a Claude model your subscription supports. To set a default explicitly, set `ANTHROPIC_MODEL` to a Claude model ID such as `{{anthropic_large}}`. For future terminals, add the `unset` and `export` lines to the end of your shell profile (`~/.zshrc` or `~/.bashrc`).

## Step 4: Verify a request

Send: **Reply with exactly Hello.**

You should receive a greeting. In the dashboard, open **Logs** and find the successful session under your virtual key. Open it to inspect the model, tokens, and cost.

### Confirm subscription usage {#seeing-which-requests-were-billed-to-a-seat}

On **LiteLLM v1.105.0 or later**, filter **Logs** with **Credential: Client OAuth token**; Request Details shows the same value. Spend-log metadata records `used_client_oauth_token=true` for subscription requests and `false` for configured credentials. For API access, query `/spend/logs/ui` with that filter and UTC `start_date` / `end_date` values in `YYYY-MM-DD HH:MM:SS` format.

## Limits and billing {#attribution-and-cost}

Your Claude plan controls model access and quota. Use the LiteLLM virtual key's user and team for gateway attribution, and Claude's admin console for subscription membership.

**LiteLLM reports cost at Anthropic API list prices, even for subscription requests.** Use these amounts for [budgets](../proxy/virtual_keys.md) in API-equivalent dollars. Anthropic bills subscription requests through your plan; calculate API-billed spend from rows that used configured API credentials.

Have each developer sign in with their own subscription, following [Anthropic's usage terms](https://code.claude.com/docs/en/legal-and-compliance). Team and Enterprise administration stays in Claude's admin console; use [`forceLoginOrgUUID`](https://code.claude.com/docs/en/authentication#restrict-login-to-your-organization) to restrict Claude Code to your organization.

<details>
<summary>Credentials and supported routes</summary>

### How it works

`x-litellm-api-key` authenticates to LiteLLM. Claude Code supplies its subscription OAuth token in `Authorization`; LiteLLM forwards it to direct `anthropic/` deployments, ahead of any configured API key, and adds the required OAuth beta header. Other client headers require separate [header forwarding configuration](../proxy/forward_client_headers.md).

### Which requests use the subscription token

Use direct Anthropic deployments on `/v1/messages` or `/v1/chat/completions` for subscription forwarding and credential attribution. Bedrock and Vertex AI use their own credentials (provider isolation requires v1.99.0 or later). `/v1/messages/count_tokens` uses configured credentials. The `/anthropic` pass-through route uses the proxy's Anthropic key when configured; use the proxy root for the subscription setup in this guide.

### Credential storage, refresh, and revocation

Claude Code stores and refreshes its login locally. LiteLLM forwards each caller's token for that request and records the credential type in spend logs. Use `/logout` to sign out or `/login` to renew an expired or revoked login.

To end gateway access, block or delete the [LiteLLM key](../proxy/virtual_keys.md). To end subscription access too, sign out of Claude Code or ask the Claude administrator to revoke it.

</details>

## Troubleshooting

| Problem | Fix |
|---|---|
| LiteLLM rejects the key | Check the URL and `x-litellm-api-key` in `ANTHROPIC_CUSTOM_HEADERS`. A deleted or incorrect key returns 401. |
| Anthropic rejects the login, or requests use an API key | Check `/status`, remove API credential overrides and `apiKeyHelper`, then run `/login`. Confirm a direct `anthropic/` deployment and the proxy root URL. |
| Model not found or access denied | Configure `anthropic/*`, allow **All anthropic models** on the key, and choose a model your plan supports. |
| No request appears in LiteLLM | Check `ANTHROPIC_BASE_URL`, then restart Claude Code from the terminal where you exported it. |
| Healthy accounts receive `429 No deployments available for selected model` | Ask the operator to check for an existing deployment cooldown; follow the [recovery steps](./claude_code_byok.md#model-is-unavailable-for-everyone-after-one-user-hits-their-limit). |

Check gateway authentication and model access with your URL and key:

```bash
curl "http://localhost:4000/v1/models" \
  -H "x-litellm-api-key: Bearer sk-<your-litellm-virtual-key>"
```

A `200` confirms gateway authentication and lists accessible models. For a `401`, replace the key with an active virtual key. Use the prompt and Credential filter in Step 4 to confirm subscription access.

See the [setup video](https://www.loom.com/share/2d069b9e3bcc4cecaa5eb27a72ba7b3c), [subscription options](../subscriptions.md), or [Claude Code with Lite CLI SSO](./claude_code_gateway.md#claude-subscription).
