---
title: Claude Desktop & Cowork SSO
hide_table_of_contents: true
description: Configure Claude Desktop and Cowork to use LiteLLM through third-party inference with SSO.
---

# Claude Desktop & Cowork SSO

Connect Claude Desktop and Cowork to your LiteLLM gateway using the same third-party inference settings.

## Configure third-party inference {#option-a-single-sign-on-with-your-identity-provider}

Your gateway must have [JWT authentication](../proxy/token_auth.md) configured for your identity provider. Get the gateway URL, OIDC client ID, and issuer URL from your administrator.

1. In Claude Desktop, open **Help > Troubleshooting > Enable Developer Mode**, then **Developer > Configure Third-Party Inference**.
2. In **Connection**, enter these settings:

   | Setting | Value |
   |---|---|
   | Inference provider | **Gateway** |
   | Gateway base URL | Your LiteLLM gateway URL |
   | Credential kind | **Interactive sign-in** |
   | Gateway SSO IdP (OIDC) | Your **Client ID** and **Issuer URL** |

3. Click **Apply Changes**, then **Sign in to your organization** and complete SSO.
4. Start a conversation or Cowork task. Confirm the request appears in LiteLLM **Logs** under your user.

See Claude's official [in-app configuration guide](https://claude.com/docs/third-party/claude-desktop/in-app-configuration) and [gateway SSO guide](https://claude.com/docs/third-party/claude-desktop/gateway#single-sign-on-with-your-identity-provider) for identity-provider registration, additional fields, and deployment details. Use **Export** if you need to distribute the configuration to multiple devices.

<span id="option-b-static-virtual-key" />

For API-key authentication, use [Virtual keys](../proxy/client_setup/claude_desktop.md).
