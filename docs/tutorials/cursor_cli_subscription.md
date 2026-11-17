---
title: Use your Cursor subscription with Cursor CLI
sidebar_label: Cursor CLI subscription
description: Route signed-in Cursor CLI agent sessions through LiteLLM. Keep Cursor login on the client and use a separate LiteLLM key for gateway access.
---

# Use your Cursor subscription with Cursor CLI

{/* keep-version-note */}

Send Cursor CLI agent requests through LiteLLM using your own Cursor login. Cursor CLI keeps your login and handles token refresh. LiteLLM relays native request and response bytes without model translation.

:::warning Unreleased
This setup requires the `/cursor-cli` relay from [LiteLLM PR #51402](https://github.com/BerriAI/litellm/pull/51402). It is not available in releases that lack that change. The CLI's private protocol can change between versions. The setup was verified with Cursor CLI `2026.11.11-b912975`.
:::

This guide is for the terminal CLI, not the [Cursor IDE](./cursor_integration.md) or [Cursor Cloud Agents API](../pass_through/cursor.md).

## Prerequisites

Use an installed Cursor CLI (`agent`, also distributed as `cursor-agent`) and a Cursor account with access to the model you choose. You also need a running [LiteLLM proxy](../proxy/docker_quick_start.md) with the relay above. Each developer signs in to their own Cursor account.

The proxy must allow this opaque relay. Configured moderation, guardrails or policy-engine rules disable it, even when not selected by the request. Do not disable required security controls to use this route.

## Step 1. Prepare gateway access

Ask your proxy administrator for an unrestricted LiteLLM virtual key. The key and its inherited user, team, organization and project scopes must have no model restrictions or other unsupported inference controls. Agent-bound keys, JWT, custom authentication and personal-key inheritance are unsupported. A master key also works for an administrator's local test, but do not distribute it to developers.

No `model_list` entry or `CURSOR_API_KEY` on the proxy is needed. Cursor chooses the model and enforces subscription access. Save your gateway key in the terminal that will launch Cursor CLI.

```bash
export LITELLM_API_KEY="sk-<your-litellm-virtual-key>"
```

Use HTTPS for a remote proxy because requests carry both gateway and Cursor credentials. The localhost examples below assume a proxy on your own machine.

## Step 2. Sign in to Cursor

Keep Cursor's login endpoint unchanged. Remove any `CURSOR_API_KEY` override from this terminal and sign in with the official CLI.

```bash
unset CURSOR_API_KEY
agent login
```

Do not set `CURSOR_API_KEY` to your LiteLLM key. Do not use `--endpoint` or `CURSOR_API_ENDPOINT` to point at LiteLLM. Those settings change the Cursor login backend, which this relay does not implement.

## Step 3. Enable HTTP/1.1 agent transport

In Cursor CLI's `cli-config.json`, merge the following into the existing settings. By default, the file is `~/.cursor/cli-config.json`, or `$XDG_CONFIG_HOME/cursor/cli-config.json` when `XDG_CONFIG_HOME` is set. Preserve all other fields, including other `network` settings.

```json
{
  "network": {
    "useHttp1ForAgent": true
  }
}
```

If you set `CURSOR_CONFIG_DIR`, the file is `$CURSOR_CONFIG_DIR/cli-config.json`. Use the same configuration directory for login and agent commands. This relay does not support HTTP/2 agent transport.

## Step 4. Start a session through LiteLLM

Use `--agent-endpoint` for agent traffic and `--header` for the separate LiteLLM credential. Replace `http://localhost:4000` with your proxy URL. If your executable is named `cursor-agent`, use that in place of `agent`.

```bash
agent \
  --agent-endpoint http://localhost:4000/cursor-cli \
  --header "x-litellm-api-key: Bearer $LITELLM_API_KEY" \
  --model auto
```

Cursor CLI supplies its own bearer token in `Authorization`. LiteLLM validates `x-litellm-api-key`, removes gateway credentials before forwarding, and sends the Cursor token upstream for that request. Login, bootstrap and model discovery still connect directly to Cursor, not through LiteLLM.

## Step 5. Verify a request and a tool follow-up

From a directory with a file you can safely share with Cursor, run the following. Replace `README.md` if needed.

```bash
agent \
  --agent-endpoint http://localhost:4000/cursor-cli \
  --header "x-litellm-api-key: Bearer $LITELLM_API_KEY" \
  --model auto --mode ask --print \
  'Read README.md with the read-file tool and summarize it in one sentence. Do not run shell commands or change files.'
```

The CLI should complete the read-file tool and return a summary. Check proxy access logs for successful requests to `/cursor-cli/agent.v1.AgentService/RunSSE` and `/cursor-cli/aiserver.v1.BidiService/BidiAppend`. An HTTP 200 alone does not prove the agent succeeded. Confirm the result in the CLI too.

## Limits and access controls

| Capability | Behavior |
|---|---|
| Native agent traffic | Only the two POST RPCs `agent.v1.AgentService/RunSSE` and `aiserver.v1.BidiService/BidiAppend` are relayed. Binary bodies and streamed responses are preserved. |
| Model selection | Cursor owns model selection. LiteLLM model aliases, routing, fallbacks and per-model restrictions do not apply. |
| Content controls | No payload inspection, moderation, guardrails or policy enforcement. Configured controls cause the relay to reject requests. |
| Usage and cost | No token accounting or subscription cost measurement. A recorded zero cost does not measure remaining subscription allowance. |
| Request limits | RPM and concurrency limits count individual RPCs, not agent sessions. Allow overlapping stream and append calls. A concurrency limit of one can block tool follow-ups. |
| Logs | Logs describe HTTP transport status, not the agent's outcome or parsed tool activity. |
| Credentials | Cursor CLI owns login and refresh. Gateway access and Cursor subscription access are authenticated independently. |

Revoke the LiteLLM key to end gateway access. Sign out with the Cursor CLI or revoke the Cursor session separately to end subscription access.

## Troubleshooting

| Problem | Fix |
|---|---|
| `The provided API key is invalid` during login | Remove the LiteLLM value from `CURSOR_API_KEY` and restore Cursor's login endpoint. Use `agent login`, then set only `--agent-endpoint` for the session. |
| Gateway returns 401 | Check the separate `x-litellm-api-key` header and that the LiteLLM key is active. Keep Cursor's own bearer token in `Authorization`. |
| Gateway returns 403 | Ask the administrator to check key and inherited restrictions, agent binding, authentication type and configured moderation, guardrails or policies. Do not remove required controls to bypass the rejection. |
| `RunSSE` returns 404 | Confirm the proxy includes PR #51402 and the agent endpoint ends with `/cursor-cli`, not `/cursor` or `/v1`. |
| Session hangs or tool follow-up fails | Confirm `network.useHttp1ForAgent` is true in the active CLI configuration. Check RPC concurrency limits and proxy streaming timeouts. |
| Cursor rejects the login or model | Sign in again with Cursor and choose a model available to your account. LiteLLM cannot grant subscription access. |

See [other subscription setups](../subscriptions.md) for Claude, Codex and Copilot.
