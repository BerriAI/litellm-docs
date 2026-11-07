---
title: Codex Desktop with SSO
sidebar_label: SSO
---

import CodexSSOAuth from './_codex_sso_auth.mdx';

# Connect Codex in ChatGPT Desktop to LiteLLM with SSO

Codex in ChatGPT Desktop reads the same `~/.codex/config.toml` as the [Codex CLI](./codex_cli_sso.md) and runs the same authentication helper. For app onboarding, model selection, and MCP configuration, see the [desktop setup guide](./codex_chatgpt_desktop.md).

These settings configure the Codex side of the app. Regular ChatGPT chats are not configured by `~/.codex/config.toml` and do not go through LiteLLM.

## Configure SSO authentication

<CodexSSOAuth />

Desktop apps may not inherit variables exported in your terminal. Use the absolute path to `lite` shown above. With the `auth` command in place of `env_key`, you can skip the `LITELLM_API_KEY` entry in `~/.codex/.env` for the model provider. The [desktop MCP setup](./codex_chatgpt_desktop.md#mcp-setup) still uses its own bearer token environment variable.

Restart the app after changing the configuration.

## Next steps

See the [desktop setup guide](./codex_chatgpt_desktop.md) for app configuration and the [Codex CLI setup guide](./codex_cli.md#model-catalog-and-service-tiers) for model discovery and service tiers.
