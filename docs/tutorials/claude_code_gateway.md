---
title: Claude Code SSO
hide_table_of_contents: true
description: Set up Claude Code with gateway sign-in, Lite CLI SSO, or a Claude subscription through LiteLLM.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Claude Code SSO

Choose how to sign in and which credentials to use for inference.

<Tabs queryString="flow">
<TabItem value="gateway" label="Gateway setup" default>

Sign in directly from Claude Code. LiteLLM uses your organization's provider credentials and tracks usage by user and team.

### 1. Configure the gateway {#1-turn-the-gateway-on}

Configure [SSO for your LiteLLM gateway](../proxy/admin_ui_sso.md), then add this to its configuration:

```yaml title="config.yaml"
model_list:
  - model_name: "anthropic/*"
    litellm_params:
      model: "anthropic/*"
      api_key: os.environ/ANTHROPIC_API_KEY

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  database_url: os.environ/DATABASE_URL
  enable_claude_code_gateway: true
```

Set `PROXY_BASE_URL` to the gateway's internal HTTPS URL and restart the proxy. Grant users or teams access to the Claude models they need. Use Redis if the gateway runs multiple workers or replicas.

### 2. Configure Claude Code {#3-point-claude-code-at-the-proxy}

Use Claude Code **v2.1.195 or later**. Add the following to its managed settings file:

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

### 3. Sign in

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

</TabItem>
<TabItem value="lite-cli" label="Lite CLI SSO">

Sign in to LiteLLM with your organization's SSO. Inference uses the gateway's provider credentials and is billed to your organization. A Claude subscription is not required.

Use a [Lite CLI build with saved sign-in settings](https://github.com/BerriAI/litellm/pull/47385), and ask your administrator to enable [CLI SSO](../proxy/cli_sso.md) on the gateway.

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

</TabItem>
<TabItem value="subscription" label="Claude subscription">

Use your own Claude subscription for inference while routing requests through LiteLLM. Your claude.ai login stays active.

Use a [Lite CLI build with saved sign-in settings](https://github.com/BerriAI/litellm/pull/47385). Your gateway must support [CLI SSO](../proxy/cli_sso.md) and [Claude subscription routing](./claude_code_max_subscription.md#step-1-configure-litellm-proxy).

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

</TabItem>
</Tabs>
