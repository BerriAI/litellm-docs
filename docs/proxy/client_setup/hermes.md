---
title: Hermes CLI with virtual keys
sidebar_label: Virtual keys
---

# Connect Hermes to LiteLLM with a virtual key

[Hermes Agent](https://github.com/NousResearch/hermes-agent) can use LiteLLM as a [named custom provider](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/integrations/providers.md#named-custom-providers). This setup sends model requests to the gateway's `/v1/chat/completions` endpoint with your LiteLLM virtual key.

## Configure the connection

Create a [virtual key](../virtual_keys.md) with access to a model that supports tool calls. Add the following to `~/.hermes/config.yaml`, merging it with your existing settings:

```yaml title="~/.hermes/config.yaml"
providers:
  litellm:
    api: https://litellm.example.com/v1
    transport: chat_completions
    key_env: LITELLM_API_KEY

model:
  default: my-model
  provider: custom:litellm
```

Replace the gateway URL and `my-model` with a `model_name` available to your key. The URL includes `/v1`; Hermes appends `/chat/completions`.

Export the key in the terminal where you launch Hermes:

```bash
export LITELLM_API_KEY="sk-<your-virtual-key>"
hermes
```

For a persistent configuration, put `LITELLM_API_KEY` in `~/.hermes/.env`, which Hermes loads for its credentials. Keep the key out of `config.yaml` and source control.

## Verify

Start a new Hermes session and send a prompt. Confirm the request in LiteLLM's Admin UI under **Logs** or **Usage**, attributed to your virtual key and the selected model. Test a tool call with your chosen model before using it for agent tasks.

For sign-in through your organization's identity provider, use [Hermes SSO](./hermes_sso.md). To add conversation tracing, see the separate [Hermes Lens integration](../lens/integrations/hermes.md).
