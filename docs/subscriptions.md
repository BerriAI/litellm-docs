---
title: Claude, Codex, and Copilot subscriptions
sidebar_label: Claude, Codex & Copilot subscriptions
description: Send the requests of a Claude, ChatGPT (Codex), or GitHub Copilot subscription through the LiteLLM AI Gateway.
---

# Use your Claude, Codex, or Copilot subscription

You can send the requests of a Claude, ChatGPT, or GitHub Copilot subscription through the LiteLLM AI Gateway. The provider continues to charge the requests to the subscription, not to an API key.

The gateway adds access controls, request logs, and usage attribution. Give each developer a separate LiteLLM virtual key to track their requests.

**Using Codex?** Follow [Use your ChatGPT subscription with Codex](./tutorials/openai_codex_byok.md) to keep your existing login and route requests through your proxy. Compare the other subscription options below.

## Compare the subscriptions

| Subscription | Clients | Sign-in | Python SDK | Full guide |
|---|---|---|---|---|
| Claude Pro, Max, Team, and Enterprise | Claude Code | Each user signs in to Claude Code with a different Claude account | Gateway only | [Claude subscription](./tutorials/claude_code_max_subscription.md) |
| ChatGPT plans that include Codex, client login | Codex and Pi | Each user signs in through their client | Gateway only | [ChatGPT client login](./tutorials/openai_codex_byok.md) |
| ChatGPT plans that include Codex, gateway login | OpenAI API clients | A saved login selected by the model deployment | Yes | [ChatGPT provider](./providers/chatgpt.md) |
| GitHub Copilot | Claude Code, OpenAI API clients, and Anthropic API clients | Each user connects a different GitHub account | Yes | [GitHub Copilot](./providers/github_copilot.md) |

## Desktop apps

**Codex.** To use the account signed in on your computer, configure a provider with `requires_openai_auth = true` and a separate LiteLLM key. Follow [ChatGPT client login](./tutorials/openai_codex_byok.md). Save the LiteLLM key once in `~/.codex/.env`; both the desktop app and CLI read it. The separate [virtual-key setup](./proxy/client_setup/codex_chatgpt_desktop.md) uses credentials configured on the gateway.

**Claude Desktop.** Claude Desktop connects to the gateway in third-party inference mode. In this mode, the app does not use a Claude account. Thus, a Claude subscription does not apply. To use a subscription from Claude Desktop, add a GitHub Copilot model with a name that starts with `claude-`. For the full steps, refer to [Claude Desktop & Cowork](./proxy/client_setup/claude_desktop.md).

## Claude subscriptions

Claude Code signs in with the Claude subscription and gets an OAuth token (`sk-ant-oat...`). LiteLLM sends this token to Anthropic with each request from that user. LiteLLM does not keep the token after the request.

Each user must sign in with a different Claude account. Do not put a subscription token in the `api_key` of a deployment. The Anthropic [Legal and compliance](https://code.claude.com/docs/en/legal-and-compliance) page does not let you use subscription credentials for other users.

To set up a Claude subscription, do these steps:

1. Add an `anthropic/*` wildcard model to `config.yaml`.
2. On each computer, set `ANTHROPIC_BASE_URL` to the URL of the gateway.
3. Set `ANTHROPIC_CUSTOM_HEADERS` to the virtual key of the user.
4. Start Claude Code and select the Claude subscription as the login method.

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: "anthropic/*"
    litellm_params:
      model: "anthropic/*"
```

```bash showLineNumbers title="Claude Code environment"
export ANTHROPIC_BASE_URL=https://litellm.example.com
export ANTHROPIC_CUSTOM_HEADERS="x-litellm-api-key: Bearer sk-<your-virtual-key>"
```

Do not set `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, or `apiKeyHelper`. If you set one of them, Claude Code sends that key and not the subscription token.

Each developer keeps their own subscription allowance. With the [caller-isolation fix](https://github.com/BerriAI/litellm/pull/48485), one caller's subscription error does not cool down the shared deployment for other callers. No extra cooldown setting is needed. See [cooldown recovery](./tutorials/claude_code_byok.md#model-is-unavailable-for-everyone-after-one-user-hits-their-limit) if an older deployment is already blocked.

LiteLLM calculates the cost of each request with the Anthropic API rates. Budgets use this cost, but Anthropic charges the requests to the subscription.

## ChatGPT subscriptions (Codex)

### Use your Codex or Pi login

Each developer signs in with ChatGPT through their client. The client sends its subscription token in `Authorization` and a separate LiteLLM virtual key in `x-litellm-api-key`. The gateway forwards the subscription request to OpenAI, enforces the virtual key's model permissions, and records usage under the gateway identity.

The administrator adds a `chatgpt/` model using the usual LiteLLM model setup. Developers point Codex at the gateway's `/v1` URL and keep their login in the client. No auth file is uploaded. Leave gateway credentials and paid-provider fallbacks unset for a subscription-only deployment.

```yaml title="config.yaml" keep-model-ids
model_list:
  - model_name: "gpt-*"
    litellm_params:
      model: "chatgpt/gpt-*"
    model_info:
      mode: responses
```

Allow `gpt-*` on the virtual key, then choose a GPT model available to the caller's subscription. The wildcard routes the requested model without an entry per model. Forwarded logins take precedence over gateway credentials. Retries across ChatGPT deployments keep the caller's login; explicitly configured cross-provider fallbacks can incur API charges. This HTTP/SSE flow does not pool subscriptions or provide dashboard sign-in.

Follow [ChatGPT client login](./tutorials/openai_codex_byok.md) for the complete setup, including the native route used by Pi. Like Claude Code, the client keeps and refreshes its subscription login while a separate key authenticates to LiteLLM.

### Configure a gateway-owned login

The separate `chatgpt/` provider can use a saved login on the gateway. Without a client login, requests use the selected deployment's account. The default is the proxy's shared auth file; `chatgpt_auth_file` selects a different file for a particular deployment. Keep each account's file separate and grant model access deliberately.

To set up a ChatGPT subscription, do these steps:

1. Sign in one time from a terminal, before you start the proxy.
2. Put the `auth.json` file on the proxy host.
3. Make sure that the proxy can write to `auth.json`.
4. Add the `chatgpt/` models to `config.yaml` and start the proxy.

```bash showLineNumbers title="Sign in one time, outside the proxy"
python -c "from litellm.llms.chatgpt.authenticator import Authenticator; Authenticator().get_access_token()"
```

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: chatgpt/{{chatgpt}}
    model_info:
      mode: responses
    litellm_params:
      model: chatgpt/{{chatgpt}}
```

The token has a time limit. When the time limit ends, the proxy writes a new token to `auth.json`. Workers and replicas serving the same configured account need access to its current file. See the [ChatGPT provider guide](./providers/chatgpt.md) for auth-file configuration.

LiteLLM records a cost of $0 for `chatgpt/` models. Thus, `max_budget` has no effect. Use `rpm_limit` or `tpm_limit` to limit the requests.

The Python SDK can also use the `chatgpt/` provider. When you call it the first time, it shows a sign-in URL and a code in your terminal.

## GitHub Copilot subscriptions

Each user connects a different GitHub account in the LiteLLM dashboard. The requests from that user then use the Copilot subscription of that user.

To set up GitHub Copilot, do these steps:

1. Admin: create an LLM credential with the **GitHub Copilot** provider.
2. Admin: add a `github_copilot/` model that uses this credential.
3. User: open **Models + Endpoints** > **LLM Credentials** and click **Connect**.
4. User: enter the GitHub code at https://github.com/login/device.

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: claude-copilot
    litellm_params:
      model: github_copilot/claude-sonnet-5.5
      litellm_credential_name: github-copilot
```

Claude Code accepts only model names that start with `claude-` or `anth-`. For Claude Code, give the model a name such as `claude-copilot`.

The Python SDK can also use the `github_copilot/` provider with one GitHub account. When you call it the first time, it starts the GitHub device flow in your terminal.
