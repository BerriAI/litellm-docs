---
title: Hermes CLI with SSO
sidebar_label: SSO
---

# Connect Hermes to LiteLLM with SSO

Hermes can call [`lite auth print-token`](../cli_sso.md#use-the-credential-from-other-tools) through its [`key_cmd` provider setting](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/integrations/providers.md#command-minted-credentials-key_cmd). Each developer signs in to LiteLLM, and Hermes obtains the resulting token when it needs a credential.

## Sign in

Install the [`lite` CLI](../management_cli.md#quick-start). Your administrator must configure the gateway's SSO provider and enable [CLI authentication](../cli_sso.md#prerequisites---start-litellm-proxy-with-beta-flag). The gateway must support [browser sign-in with PKCE](../cli_sso.md#browser-sign-in-with-pkce), and your Hermes version must support `key_cmd` on custom providers.

```bash
lite --base-url https://litellm.example.com login --pkce
which lite
```

Complete sign-in in your browser and choose the team for your requests. Copy the absolute executable path printed by `which lite` for the next step.

## Configure Hermes

Merge this provider into `~/.hermes/config.yaml`. Replace the gateway URL, executable path, and `my-model` with a model available to your LiteLLM user and team:

```yaml title="~/.hermes/config.yaml"
providers:
  litellm:
    api: https://litellm.example.com/v1
    transport: chat_completions
    key_cmd: "/absolute/path/to/lite --base-url https://litellm.example.com auth print-token"

model:
  default: my-model
  provider: custom:litellm
```

Use the same gateway URL for login and `key_cmd`, without `/v1`. The provider's `api` URL includes `/v1`. If converting the [virtual-key setup](./hermes.md), replace `key_env` with `key_cmd` and remove any inline `api_key`. Do not pass `--api-key` when launching Hermes; that explicit flag takes precedence over `key_cmd`.

Hermes caches the command's token and calls it again when needed. `lite auth print-token` writes only the token to stdout and renews it using the refresh token stored by PKCE login. Requests inherit your LiteLLM user and team permissions, budgets, and model access.

## Verify

Start a new session with `hermes`, send a prompt, and check **Logs** or **Usage** in the LiteLLM Admin UI for your user, selected team, and model. Test tool calls with the model you plan to use.

If the helper reports an expired or unavailable login, run the same `lite --base-url https://litellm.example.com login --pkce` command again. See [CLI authentication](../cli_sso.md) for gateway prerequisites, token storage, renewal, and logout behavior.
