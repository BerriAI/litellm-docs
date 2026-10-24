---
title: Claude, Codex, and Copilot subscriptions
sidebar_label: Claude, Codex & Copilot subscriptions
description: Send the requests of a Claude, ChatGPT (Codex), or GitHub Copilot subscription through the LiteLLM AI Gateway.
---

# Use your Claude, Codex, or Copilot subscription

You can send the requests of a Claude, ChatGPT, or GitHub Copilot subscription through the LiteLLM AI Gateway. The provider continues to charge the requests to the subscription, not to an API key.

The gateway adds virtual keys, request logs, rate limits, budgets, and guardrails to the subscription requests. Each request log shows the user and the team that sent the request.

## Compare the subscriptions

| Subscription | Clients | Sign-in | Python SDK | Full guide |
|---|---|---|---|---|
| Claude Pro, Max, Team, and Enterprise | Claude Code | Each user signs in to Claude Code with a different Claude account | Gateway only | [Claude subscription](./tutorials/claude_code_max_subscription.md) |
| ChatGPT plans that include Codex | Codex CLI, Codex in the ChatGPT desktop app, and OpenAI API clients | One ChatGPT account for each proxy | Yes | [ChatGPT subscription](./providers/chatgpt.md) |
| GitHub Copilot | Claude Code, OpenAI API clients, and Anthropic API clients | Each user connects a different GitHub account | Yes | [GitHub Copilot](./providers/github_copilot.md) |

## Desktop apps

**Codex in the ChatGPT desktop app.** The ChatGPT desktop app reads the same `~/.codex/config.toml` file as the Codex CLI. Set `model` in that file to a `chatgpt/` model on the gateway. Codex then uses the ChatGPT account of the proxy, not the account that is signed in to the app. For the full steps, refer to [Codex (ChatGPT Desktop)](./proxy/client_setup/codex_chatgpt_desktop.md).

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

router_settings:
  disable_cooldowns: true
```

```bash showLineNumbers title="Claude Code environment"
export ANTHROPIC_BASE_URL=https://litellm.example.com
export ANTHROPIC_CUSTOM_HEADERS="x-litellm-api-key: Bearer sk-<your-virtual-key>"
```

Do not set `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, or `apiKeyHelper`. If you set one of them, Claude Code sends that key and not the subscription token.

Keep `disable_cooldowns: true` on a proxy that has many users. Without it, the expired token of one user can stop the model for all users.

LiteLLM calculates the cost of each request with the Anthropic API rates. Budgets use this cost, but Anthropic charges the requests to the subscription.

## ChatGPT subscriptions (Codex)

The `chatgpt/` provider uses one ChatGPT account for the full proxy. All the virtual keys that can call a `chatgpt/` model use that same account. To use more than one ChatGPT account, deploy one proxy for each account.

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

The token has a time limit. When the time limit ends, the proxy writes a new token to `auth.json`. All the workers and replicas must use the same copy of the file.

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
