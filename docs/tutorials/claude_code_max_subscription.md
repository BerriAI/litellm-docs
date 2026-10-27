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

The wildcard routes whichever Claude model your plan allows. No Anthropic API key or `forward_client_headers_to_llm_api` setting is needed. Without an API key configured, requests without a subscription token fail; a configured API key pays for requests that arrive without one.

## Step 2: Create a virtual key

Open your proxy dashboard at `http://localhost:4000/ui` (replace the URL with your proxy's). For a local proxy, sign in as `admin` with your master key. Go to **Virtual Keys**, click **+ Create New Key**, enter a **Key Name**, and select **All anthropic models** under **Models**. Click **Create Key** and copy the key; it is shown only once.

For an existing key, allow `anthropic/*`. Leaving **Models** empty allows every model on the proxy.

## Step 3: Connect Claude Code

In the terminal where you will run Claude Code, set your proxy's root URL and virtual key:

```bash
export ANTHROPIC_BASE_URL="http://localhost:4000"
export ANTHROPIC_CUSTOM_HEADERS="x-litellm-api-key: Bearer sk-<your-litellm-virtual-key>"
```

Replace the URL and key. Do not append `/anthropic` or `/v1/messages`. Retain any existing custom headers on separate lines.

**Remove `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_API_KEY`, and any `apiKeyHelper` from your Claude Code settings and launch environment.** They override subscription authentication. Clear shell overrides, then launch from your project folder:

```bash
unset ANTHROPIC_AUTH_TOKEN ANTHROPIC_API_KEY
claude
```

Choose **Claude account with subscription** and complete browser sign-in if needed. If the browser does not open, press `c` to copy the URL; paste a code back into the terminal if prompted. Complete the workspace trust prompt for your project. An existing subscription login can stay signed in.

Use `/model` to switch from your plan's default. `ANTHROPIC_MODEL` is optional; if set, use a Claude model ID such as `{{anthropic_large}}`, not a custom proxy alias. Repeat the exports in each new terminal, or save them in your shell profile.

## Step 4: Verify a request

Send: **Reply with exactly Hello. Do not use tools.**

You should receive `Hello`. In the dashboard, open **Logs** and find the successful session under your virtual key. Open it to inspect the model, tokens, and cost.

### Confirm subscription usage {#seeing-which-requests-were-billed-to-a-seat}

On **LiteLLM v1.105.0 or later**, filter **Logs** with **Credential: Client OAuth token**; Request Details shows the same value. Spend-log metadata records `used_client_oauth_token=true` for subscription requests and `false` for configured credentials. Older rows have no value. Administrators can also filter `/spend/logs/ui?used_client_oauth_token=true` with their usual gateway authentication.

## Limits and billing {#attribution-and-cost}

Your Claude plan controls model access and quota. LiteLLM attributes usage to the virtual key and its user/team; it cannot identify the Claude account or organization behind the login.

**LiteLLM reports cost at Anthropic API list prices, even for subscription requests.** These amounts count toward [budgets](../proxy/virtual_keys.md) as API-equivalent usage caps; they are not an additional Anthropic API charge. Exclude subscription rows when calculating API-billed spend.

Each developer signs in with their own subscription. Do not share a subscription token through a deployment's `api_key`; see [Anthropic's usage terms](https://code.claude.com/docs/en/legal-and-compliance). Team and Enterprise administration stays in Claude's admin console; [`forceLoginOrgUUID`](https://code.claude.com/docs/en/authentication#restrict-login-to-your-organization) restricts Claude Code to your organization.

<details>
<summary>Credentials and supported routes</summary>

### How it works

`x-litellm-api-key` authenticates to LiteLLM. Claude Code supplies its subscription OAuth token in `Authorization`; LiteLLM forwards it to direct `anthropic/` deployments, ahead of any configured API key, and adds the required OAuth beta header. Other client headers require separate [header forwarding configuration](../proxy/forward_client_headers.md).

### Which requests use the subscription token

Subscription forwarding applies to `/v1/messages` and `/v1/chat/completions` for direct Anthropic deployments. Bedrock and Vertex AI use their own credentials (provider isolation requires v1.99.0 or later). `/v1/messages/count_tokens` uses configured credentials. The `/anthropic` pass-through route uses the proxy's Anthropic key when configured and does not record `used_client_oauth_token`; use the proxy root for this guide.

### Credential storage, refresh, and revocation

Claude Code stores and refreshes its login locally. LiteLLM uses each caller's token for that request without caching it across users or storing it in logs. `/logout` signs out; `/login` repairs an expired or revoked login.

Blocking or deleting a [LiteLLM key](../proxy/virtual_keys.md) stops gateway access. It does not revoke the Claude login, which the user or their Claude administrator manages separately.

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

A `200` lists accessible models; a `401` means the gateway rejected the key. This checks gateway access, not the subscription login.

See the [setup video](https://www.loom.com/share/2d069b9e3bcc4cecaa5eb27a72ba7b3c), [subscription options](../subscriptions.md), or [Claude Code with Lite CLI SSO](./claude_code_gateway.md#claude-subscription).
