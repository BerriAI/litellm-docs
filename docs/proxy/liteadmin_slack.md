---
title: Set up the LiteAdmin Slack app
sidebar_label: Set up the Slack app
description: Deploy the LiteAdmin Slack app, connect your personal LiteLLM admin account, and manage your gateway from Slack.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Set up the LiteAdmin Slack app

**LiteAdmin** is a Slack agent built on [LiteAdmin MCP](./liteadmin_mcp.md). Deploy the [LiteLLM Admin Agent](https://github.com/BerriAI/litellm-admin-agent), then connect your own admin account to manage keys, models, teams, and budgets from a Slack DM.

The app bundles a pinned Admin MCP connector and launches it with the requesting user's credential. You do not need to register an MCP server in your gateway or deploy a separate connector.

## Before you start

- A LiteLLM gateway with HTTPS, a database, and a model that supports tool calling.
- A [`proxy_admin` account](./access_control.md#global-proxy-roles) for each user, with an email matching their Slack profile. Each personal key must belong to that admin and have access to the selected model.
- Permission to create and install an app in your Slack workspace.
- Python 3.12 for the setup commands, plus Docker Compose or a paid Render service with persistent storage. {/* keep-python-version */}

Run one process and one replica for each Slack app, workspace, and gateway. The service uses SQLite and does not support multiple workers or hosting under a URL subpath.

## 1. Create your configuration

```bash keep-python-version
git clone https://github.com/BerriAI/litellm-admin-agent.git
cd litellm-admin-agent
python3.12 -m venv .venv
source .venv/bin/activate
pip install --require-hashes -r requirements.txt
python setup_env.py
```

These commands use a macOS/Linux shell. Open the generated `.env` file to enter your settings. If you already have one, edit it instead of rerunning the setup script.

Save the generated `CREDENTIAL_ENCRYPTION_KEY` in your secret manager and preserve it across upgrades. The app needs the same key to read saved connections. Keep `.env` private and retain the generated `ADMIN_AGENT_SERVICE_TOKEN` too.

## 2. Create and install the Slack app

1. Open [Slack's app dashboard](https://api.slack.com/apps), choose **Create New App → From a manifest**, and select your workspace.
2. Paste the repository's [`slack-manifest.json`](https://github.com/BerriAI/litellm-admin-agent/blob/main/slack-manifest.json) and create the app.
3. Under **Basic Information → App-Level Tokens**, generate a token with the `connections:write` scope. Save it as `SLACK_APP_TOKEN` in `.env`.
4. Under **OAuth & Permissions**, install the app to your workspace. Save the **Bot User OAuth Token** as `SLACK_BOT_TOKEN`.
5. Copy the workspace's `T…` ID from the Slack web URL into `SLACK_WORKSPACE_ID`.

The manifest enables Socket Mode, DM events, and the **Messages** tab. Confirm those settings remain enabled. The app uses an outbound Slack socket; its public HTTPS address serves the private connection page.

## 3. Choose your gateway and login method

Edit these entries in `.env`, leaving the generated secrets in place:

```dotenv title=".env"
LITELLM_BASE_URL=https://gateway.example.com/v1
LITELLM_MODEL=your-gateway-model-name
CONNECTION_AUTH_MODE=api_key
AGENT_PUBLIC_URL=https://admin.example.com
```

Set `LITELLM_MODEL` to a model name exposed by your gateway that each connected admin can use. Set `AGENT_PUBLIC_URL` to the app's HTTPS origin without a path. For Render, fill in your local copy after you receive the deployment URL.

Use `api_key` for personal-key login. Users enter their key on a private browser page after sending `connect` in Slack. **Keep gateway keys out of Slack messages.** For browser SSO, see [Optional: SSO login](#optional-sso-login) before changing `CONNECTION_AUTH_MODE` to `sso`.

You choose one login method for the deployment. Each Slack user signs in with their own account; the agent uses that user's credential for model requests and admin operations.

## 4. Deploy the app

<Tabs groupId="liteadmin-hosting">
<TabItem value="docker" label="Docker Compose" default>

Set `AGENT_PUBLIC_URL` to the HTTPS address you plan to use, then run:

```bash
python doctor.py --offline
docker compose up -d --build
```

The offline check validates configuration before deployment. Compose binds the app to `127.0.0.1:10000` and stores state in the `admin-state` volume.

Point your domain at the host and configure an HTTPS reverse proxy. For Caddy on the same host:

```caddyfile
admin.example.com {
    reverse_proxy 127.0.0.1:10000
}
```

If the reverse proxy runs in another container or on another host, configure a shared private network and forward to the app's reachable private address.

Keep the `admin-state` volume and encryption key across restarts and upgrades. Run one container for this Slack app.

</TabItem>
<TabItem value="render" label="Render">

Create a Render **Blueprint** from the [agent repository](https://github.com/BerriAI/litellm-admin-agent) or your fork. Use its [`render.yaml`](https://github.com/BerriAI/litellm-admin-agent/blob/main/render.yaml), a paid plan with a persistent disk, and one instance.

Enter these settings when Render prompts you:

| Setting | Value |
| --- | --- |
| `LITELLM_BASE_URL` | Your gateway URL, such as `https://gateway.example.com/v1`. |
| `LITELLM_MODEL` | Your gateway's tool-calling model name. |
| `SLACK_APP_TOKEN`, `SLACK_BOT_TOKEN`, `SLACK_WORKSPACE_ID` | The values from your Slack installation. |
| `CONNECTION_AUTH_MODE` | `api_key`, or `sso` after completing the SSO requirements below. |
| `CREDENTIAL_ENCRYPTION_KEY` | The key generated by `setup_env.py`. Preserve it on later deploys. |
| `ADMIN_TOOL_NAMES` | Leave empty for all available reviewed tools, or set an allowlist. |

The Blueprint creates the state disk and a service token. It uses Render's external URL as the app origin. After deployment, copy that HTTPS URL into your local `.env` as `AGENT_PUBLIC_URL` so the preflight checks the same address. If you use a custom domain, set `AGENT_PUBLIC_URL` in Render's environment too.

Keep the generated service token for optional gateway Agents registration. Slack use does not require that registration. To change the login method later, update `CONNECTION_AUTH_MODE` under **Environment** and redeploy.

</TabItem>
</Tabs>

## 5. Check the deployment

In your local setup environment, set `LITELLM_SETUP_KEY` to your personal proxy-admin key and run:

```bash
export LITELLM_SETUP_KEY='<your-personal-proxy-admin-key>'
python doctor.py
unset LITELLM_SETUP_KEY
```

The preflight checks your gateway identity, model visibility, MCP tool discovery, and Slack configuration. It does not call the model, change gateway state, or send Slack messages. Keep the setup credential off the deployed service and remove any saved copy after the check.

You can also check readiness at your deployed URL:

```bash
curl --fail https://admin.example.com/readyz
```

Use your own app URL. A successful readiness check confirms the database and Slack socket are ready; the Slack read request below verifies the agent conversation.

## 6. Connect your account in Slack

1. Open **LiteLLM Admin** under Slack **Apps** and send `connect` in a DM.
2. Open the private connection link within ten minutes.
3. Enter your personal proxy-admin key on the browser page, or complete SSO if your deployment uses it.
4. Return to Slack and ask: **“List my teams and their current budgets.”**

After the read succeeds, try a change you intend to make, such as “Create a key for Engineering with a $100 monthly budget.” The default configuration permits writes for connected admins. Use [read-only mode](#optional-restrict-tools) to limit the app to lookups.

Personal-key connections expire after 24 hours; SSO connections follow the gateway token's expiry. Gateway expiry or revocation can end access sooner. Send `connect` again to sign in. Send `disconnect` to remove your saved connection; revoke the credential in LiteLLM if you also want to invalidate it.

## Optional: restrict tools

Set these variables in `.env` or Render's environment and redeploy:

| Variable | Effect |
| --- | --- |
| `ADMIN_READ_ONLY=true` | Limit the agent to lookups. Users still need `proxy_admin`. |
| `ADMIN_TOOL_NAMES=list_keys,list_teams` | Expose only these canonical connector tools. |

An empty `ADMIN_TOOL_NAMES` allows all reviewed tools available on your gateway, subject to read-only mode. If an explicit tool is unavailable, the app stops the request. For model creation, also follow the [gateway prerequisites](./liteadmin_mcp.md#add-a-model-deployment).

## Optional: SSO login

Your gateway must have an SSO provider configured and support the hosted **proxy API** authorization-code flow: `/register`, `/authorize` with S256 PKCE, and `/token`. Support depends on the installed gateway release. Check the [agent's compatibility requirements](https://github.com/BerriAI/litellm-admin-agent/blob/main/docs/compatibility.md#optional-browser-sso) before enabling this mode.

On the **gateway**, allow the app's exact callback URL:

```dotenv
LITELLM_PROXY_API_OAUTH_REDIRECT_URIS=https://admin.example.com/oauth/callback
```

Use your app's origin and the `/oauth/callback` path. This is a separate setting from MCP OAuth redirect configuration. The app uses your gateway's SSO provider and does not need a separate Google or Okta client secret.

On the **agent**, set `CONNECTION_AUTH_MODE=sso` and redeploy. Verify the full flow: send `connect`, sign in, return to the browser page, then make a read request in Slack. If your gateway lacks this flow, configure `api_key` mode instead; the app does not switch modes on its own.

## Optional: use a hosted Admin MCP

Leave `ADMIN_MCP_URL` empty to use the bundled connector. To use a [hosted connector](./liteadmin_mcp.md#host-a-shared-mcp-endpoint), set:

```dotenv
ADMIN_MCP_URL=https://admin-mcp.example.com/mcp
```

Use a connector you operate and trust, configured for the same gateway. The agent sends each requesting user's gateway bearer credential to it. The hosted connector's own tool restrictions also apply.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| App cannot receive DMs | Install it in the intended workspace and enable Socket Mode, the Messages tab, and `message.im` events. |
| `/readyz` returns 503 | Check the app token's `connections:write` scope, outbound WebSocket access, and persistent storage. |
| Connection denied | Check the live `proxy_admin` role, personal key ownership, model access, and the email match with Slack. |
| Connection page rejects the session | Use a fresh link in one browser. Check HTTPS and `AGENT_PUBLIC_URL`, which must have no subpath. |
| SSO callback fails | Verify hosted proxy API OAuth support and the exact callback allowlist on the gateway. |
| Missing tools | Run `doctor.py`; check gateway API compatibility and `ADMIN_TOOL_NAMES`. |
| Changes are refused | Check `ADMIN_READ_ONLY` and, for a hosted connector, its read-only policy. |
| A change times out | Inspect the gateway object before retrying. A timeout does not undo completed actions. |

See the [operations guide](https://github.com/BerriAI/litellm-admin-agent/blob/main/docs/operations.md) for backups, upgrades, and migration from older installations. [Gateway Agents / A2A registration](https://github.com/BerriAI/litellm-admin-agent/blob/main/docs/compatibility.md#optional-gateway-agents--a2a) is optional.
