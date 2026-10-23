---
title: Claude Code SSO
toc_max_heading_level: 2
description: Set up Claude Code with Claude apps gateway sign-in, Lite CLI SSO, or a Claude subscription through LiteLLM.
---

# Claude Code SSO

Choose [Claude apps gateway setup](#gateway-setup), [Lite CLI SSO](#lite-cli-sso), or [Claude subscription through gateway](#claude-subscription).

## Claude apps gateway setup {#gateway-setup}

Use the [Claude apps gateway](https://code.claude.com/docs/en/claude-apps-gateway) sign-in flow with LiteLLM implementing its gateway protocol. Requests go directly from Claude Code to LiteLLM, which handles provider credentials and usage tracking by user and team.

<span id="1-turn-the-gateway-on" />

**Prerequisites:** Claude Code **v2.1.195 or later** and a LiteLLM gateway with [Claude apps gateway SSO configured](./claude_code_gateway_reference.md#1-turn-the-gateway-on). Ask your administrator for the gateway URL.

### 1. Configure Claude Code {#3-point-claude-code-at-the-proxy}

Add the following to Claude Code's managed settings file:

```json title="managed-settings.json"
{
  "forceLoginMethod": "gateway",
  "forceLoginGatewayUrl": "https://litellm.internal.example.com/claude_code_gateway"
}
```

Replace the hostname with your gateway's internal hostname. Keep `/claude_code_gateway` in the URL.

| Platform | Managed settings file |
|---|---|
| macOS | `/Library/Application Support/ClaudeCode/managed-settings.json` |
| Linux / WSL | `/etc/claude-code/managed-settings.json` |
| Windows | `C:\Program Files\ClaudeCode\managed-settings.json` |

These settings must be in the managed file. Claude Code ignores them in `~/.claude/settings.json`.

### 2. Sign in {#3-sign-in}

Run `claude`, or enter `/login` in an existing session. Trust your gateway, complete SSO in the browser, and confirm the code shown in the terminal. Claude Code then shows **Cloud gateway**. Send a prompt and check LiteLLM **Logs**.

<span id="how-it-works" />
<span id="2-verify-from-the-command-line" />
<span id="session-lifetime-and-sign-out" />
<span id="4-push-managed-settings-from-the-proxy" />
<span id="5-telemetry" />
<span id="deployment-topologies" />
<span id="known-limits" />
<span id="related-docs" />

For network requirements and deployment options, see [Claude's official gateway guide](https://code.claude.com/docs/en/claude-apps-gateway). The [LiteLLM gateway reference](./claude_code_gateway_reference.md) covers managed policies, session lifetime, and known limits.

## Lite CLI SSO

Sign in to LiteLLM with your organization's SSO. Inference uses the gateway's provider credentials and is billed to your organization. A Claude subscription is not required.

**Prerequisites:** A [Lite CLI build with saved sign-in settings](https://github.com/BerriAI/litellm/pull/47385) and a gateway with [CLI SSO enabled](../proxy/cli_sso.md#prerequisites---start-litellm-proxy-with-beta-flag).

### Configure once

Replace the base URL with your gateway's URL. Set `claude_subscription` to `false` to select gateway-funded inference, including if you previously used subscription mode.

```bash
lite config set base_url https://dev.gateway.litellm-sandbox.ai
lite config set pkce true
lite config set claude_subscription false
```

### Sign in and launch

```bash
lite login      # only when you're not signed in; uses PKCE automatically
lite claude
```

Complete your organization's SSO in the browser. `lite claude` launches Claude Code with your LiteLLM credential. Send a prompt and check LiteLLM **Logs**.

## Claude subscription through gateway {#claude-subscription}

Use your own Claude subscription for inference while routing requests through LiteLLM. Your claude.ai login stays active.

**Prerequisites:** A [Lite CLI build with saved sign-in settings](https://github.com/BerriAI/litellm/pull/47385) and a gateway configured for [CLI SSO](../proxy/cli_sso.md#prerequisites---start-litellm-proxy-with-beta-flag) and [Claude subscription routing](./claude_code_max_subscription.md#step-1-configure-litellm-proxy).

### Configure once

Replace the base URL with your gateway's URL.

```bash
lite config set base_url https://dev.gateway.litellm-sandbox.ai
lite config set pkce true
lite config set claude_subscription true
```

### Sign in and launch

```bash
lite login      # only when you're not signed in; uses PKCE automatically
lite claude     # keeps your claude.ai login; no flags needed
```

Remove any `apiKeyHelper` or static API credential from your Claude Code settings before using subscription mode.

`lite login` signs you in to LiteLLM. Claude Code keeps its own subscription login; if needed, sign in to your Claude account when prompted. Send a prompt and check LiteLLM **Logs**.
