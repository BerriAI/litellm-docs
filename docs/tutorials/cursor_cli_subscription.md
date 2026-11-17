---
title: Use your Cursor subscription through LiteLLM
sidebar_label: Cursor CLI subscription
description: Route signed-in Cursor CLI agent sessions through LiteLLM. Keep Cursor login on the client and use a separate LiteLLM key for gateway access.
---

# Use your Cursor subscription through LiteLLM

{/* keep-version-note */}

Send Cursor CLI agent requests through LiteLLM using your own Cursor login. Cursor CLI keeps your login and handles token refresh. LiteLLM relays native request and response bytes without model translation.

**Available in 1.112.**

This guide uses your subscription in Cursor CLI. The existing [Cursor desktop integration](./cursor_integration.md) uses models configured on your gateway. The [Cursor Cloud Agents API](../pass_through/cursor.md) has its own setup.

## Prerequisites

Use an installed Cursor CLI (`agent`, also distributed as `cursor-agent`) and a Cursor account with access to the model you choose. You also need a [LiteLLM proxy](../proxy/docker_quick_start.md) running version 1.112 or later. Each developer signs in to their own Cursor account.

The proxy must allow this opaque relay. Configured moderation, guardrails or policy-engine rules disable it, even when not selected by the request. Do not disable required security controls to use this route.

## Step 1. Prepare gateway access

Ask your proxy administrator for an unrestricted LiteLLM virtual key. The key and its inherited user, team, organization, project, member and tag scopes must have no model restrictions, token limits, spend budgets, or other unsupported inference controls. Agent-bound and customer-bound keys, JWT, custom authentication and personal-key inheritance are unsupported. A master key also works for an administrator's local test, but do not distribute it to developers.

No `model_list` entry or `CURSOR_API_KEY` on the proxy is needed. Cursor chooses the model and enforces subscription access. Save your gateway key in the terminal that will launch Cursor CLI.

```bash
export LITELLM_PROXY_API_BASE="https://gateway.example.com"
export LITELLM_PROXY_API_KEY="sk-<your-litellm-virtual-key>"
```

Use HTTPS for a remote proxy because requests carry both gateway and Cursor credentials. Use the proxy root URL without `/v1` or `/cursor-cli`. For a local test, use `http://localhost:4000`.

## Step 2. Sign in to Cursor

Keep Cursor's login endpoint unchanged. Remove any `CURSOR_API_KEY` override from this terminal and sign in with the official CLI. If you are already signed in, keep that login.

```bash
unset CURSOR_API_KEY
agent login
```

Do not set `CURSOR_API_KEY` to your LiteLLM key. Do not use `--endpoint` or `CURSOR_API_ENDPOINT` to point at LiteLLM. Those settings change the Cursor login backend, which this relay does not implement.

## Step 3. Enable HTTP/1.1 agent transport

Run this once. It enables Cursor's HTTP/1.1 agent transport and preserves your other settings. Python 3 is required for this configuration update.

```bash
python3 - <<'PYCONFIG'
import json, os
from pathlib import Path

root = Path(os.environ.get("CURSOR_CONFIG_DIR") or (
    str(Path(os.environ["XDG_CONFIG_HOME"]) / "cursor")
    if os.environ.get("XDG_CONFIG_HOME") else str(Path.home() / ".cursor")
))
path = root / "cli-config.json"
config = json.loads(path.read_text()) if path.exists() else {}
config["network"] = {**config.get("network", {}), "useHttp1ForAgent": True}
root.mkdir(parents=True, exist_ok=True)
path.write_text(json.dumps(config, indent=2) + "\n")
PYCONFIG
```

This updates `~/.cursor/cli-config.json` by default and honors `CURSOR_CONFIG_DIR` and `XDG_CONFIG_HOME`. Use the same configuration directory for login and agent commands. See [Cursor's configuration reference](https://cursor.com/docs/cli/reference/configuration).

## Step 4. Start a session through LiteLLM

Use `--agent-endpoint` for agent traffic and `--header` for the separate LiteLLM credential. Use the proxy root URL set above. If your executable is named `cursor-agent`, use that in place of `agent`.

```bash
agent \
  --agent-endpoint "${LITELLM_PROXY_API_BASE%/}/cursor-cli" \
  --header "x-litellm-api-key: Bearer $LITELLM_PROXY_API_KEY" \
  --model auto
```

Cursor CLI supplies its own bearer token in `Authorization`. LiteLLM validates `x-litellm-api-key`, removes gateway credentials before forwarding, and sends the Cursor token upstream for that request. Login, bootstrap and model discovery still connect directly to Cursor, not through LiteLLM.

## Step 5. Verify a request and a tool follow-up

In a scratch directory, create a file with a known value and launch the CLI interactively.

```bash
mkdir -p cursor-litellm-demo
cd cursor-litellm-demo
printf '%s\n' 'Cursor subscription through LiteLLM works.' > proof.txt
agent \
  --agent-endpoint "${LITELLM_PROXY_API_BASE%/}/cursor-cli" \
  --header "x-litellm-api-key: Bearer $LITELLM_PROXY_API_KEY" \
  --model auto --mode ask
```

Enter this prompt in Cursor.

```text
Read proof.txt with the read-file tool and quote its contents. Do not run shell commands or change files.
```

Confirm that Cursor reads the file and quotes the sentence. Check proxy access logs for successful requests to `/cursor-cli/agent.v1.AgentService/RunSSE` and `/cursor-cli/aiserver.v1.BidiService/BidiAppend`. An HTTP 200 alone does not prove the agent succeeded. Confirm the result in the CLI too.

### Save the launch command

To reuse the setup, add this function to `~/.zshrc` or `~/.bashrc`, then open a new terminal. Keep your gateway environment variables in your existing secret-loading workflow.

```bash
cursor-litellm() {
  command agent \
    --agent-endpoint "${LITELLM_PROXY_API_BASE:?Set your gateway URL}/cursor-cli" \
    --header "x-litellm-api-key: Bearer ${LITELLM_PROXY_API_KEY:?Set your gateway key}" \
    "$@"
}
```

Run `cursor-litellm` for future sessions. Use a gateway URL without a trailing slash. The endpoint and header are launch options, not supported fields in `cli-config.json`. Use `agent login` for account sign-in.

## Limits and access controls

| Capability | Behavior |
|---|---|
| Native agent traffic | Only the two POST RPCs `agent.v1.AgentService/RunSSE` and `aiserver.v1.BidiService/BidiAppend` are relayed. Binary bodies and streamed responses are preserved. |
| Model selection | Cursor owns model selection. LiteLLM model aliases, routing, fallbacks and per-model restrictions do not apply. |
| Content controls | No payload inspection, moderation, guardrails or policy enforcement. Configured controls cause the relay to reject requests. |
| Token and spend limits | Keys or inherited scopes with token limits or spend budgets are rejected because this route cannot measure those values. |
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
| Gateway returns 403 | Ask the administrator to check key and inherited restrictions, agent or customer binding, authentication type and configured moderation, guardrails or policies. Do not remove required controls to bypass the rejection. |
| `RunSSE` returns 404 | Confirm the proxy runs version 1.112 or later and the agent endpoint ends with `/cursor-cli`, not `/cursor` or `/v1`. |
| Session hangs or tool follow-up fails | Confirm `network.useHttp1ForAgent` is true in the active CLI configuration. Check RPC concurrency limits and proxy streaming timeouts. |
| Cursor rejects the login or model | Sign in again with Cursor and choose a model available to your account. LiteLLM cannot grant subscription access. |

See [other subscription setups](../subscriptions.md) for Claude, Codex and Copilot.

See Cursor's [CLI parameters](https://cursor.com/docs/cli/reference/parameters) and [network configuration](https://cursor.com/docs/enterprise/network-configuration#llm-gateways). The native `--agent-endpoint` option is not a documented subscription-gateway contract and can change between CLI versions.
