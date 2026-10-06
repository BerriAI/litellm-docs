---
title: Set up the LiteAdmin Slack app
sidebar_label: Set up the Slack app
description: Install LiteAdmin in Slack, deploy the Enterprise worker or a standalone agent, and connect your own LiteLLM admin account.
toc_max_heading_level: 2
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Set up the LiteAdmin Slack app

Use **LiteAdmin** to ask about teams, budgets, models, and spend from a Slack DM. Each admin connects their own LiteLLM account

Install the Slack app once, then choose one deployment below. **Enterprise** uses the worker bundled with your gateway and its existing SSO. **Standalone** runs a separate agent service with its own HTTPS address and login configuration

To connect Claude Code or Codex to an MCP endpoint on your Enterprise deployment, see [Deploy LiteAdmin MCP on Enterprise](./liteadmin_mcp_enterprise.md). That guide covers `/admin/mcp` in unified and componentized images; this page configures the Slack agent worker

## Before you start

You need a working LiteLLM gateway with HTTPS, a database, and a tool-calling model each connecting admin can use. Each user needs an active [`proxy_admin` account](./access_control.md#global-proxy-roles) whose email matches their Slack profile. You also need permission to create and install a Slack app in your workspace

Run one worker for each Slack app, workspace, and gateway, with persistent storage and outbound Slack WebSocket access. Use HTTPS origins without URL subpaths. The Enterprise deployment additionally requires a valid license and [SSO configured on the gateway](./admin_ui_sso.md)

## 1. Create and install the Slack app {#2-create-and-install-the-slack-app}

Use a separate Slack app for each environment, for example **LiteAdmin Dev** for testing

1. Open [Slack's app dashboard](https://api.slack.com/apps), select **Create New App**, then **From a manifest**, and choose your workspace
2. Paste the JSON manifest below. Change the app name if needed, review the permissions, and create the app
3. Under **Basic Information**, open **App-Level Tokens**. Generate a token named `liteadmin-socket` with the `connections:write` scope. Save the `xapp-…` value as `SLACK_APP_TOKEN`
4. Under **OAuth & Permissions**, select **Install to Workspace** and approve the installation. Save the **Bot User OAuth Token**, beginning with `xoxb-`, as `SLACK_BOT_TOKEN`
5. Open your workspace in Slack's web app. Copy the workspace ID beginning with `T` from `https://app.slack.com/client/T…/…` and save it as `SLACK_WORKSPACE_ID`

<details>
<summary>Slack app manifest for direct messages</summary>

```json
{
  "display_information": {
    "name": "LiteAdmin",
    "description": "Ask about your LiteLLM gateway. Send connect in a DM to sign in.",
    "background_color": "#111827"
  },
  "features": {
    "bot_user": {
      "display_name": "LiteAdmin",
      "always_online": false
    },
    "app_home": {
      "home_tab_enabled": false,
      "messages_tab_enabled": true,
      "messages_tab_read_only_enabled": false
    }
  },
  "oauth_config": {
    "scopes": {
      "bot": [
        "chat:write",
        "im:history",
        "reactions:write",
        "users:read",
        "users:read.email"
      ]
    }
  },
  "settings": {
    "event_subscriptions": {
      "bot_events": ["message.im"]
    },
    "socket_mode_enabled": true,
    "org_deploy_enabled": false,
    "token_rotation_enabled": false
  }
}
```

</details>

This manifest enables Socket Mode, direct-message events, and a writable **Messages** tab. The app can read messages sent to it and look up the Slack profile email needed to match a gateway account. Slack does not need an inbound event webhook; it delivers messages through the worker's outbound connection

## 2. Deploy and connect

Choose one setup path. Enterprise starts in read-only mode so you can test lookups before allowing changes

<Tabs groupId="liteadmin-setup" queryString="deployment">
<TabItem value="enterprise" label="Enterprise (recommended)" default>

The Docker image includes the agent code and its dependencies. You must enable the worker and install a Slack app before anyone can use it. The Helm setting `liteadmin.enabled` defaults to `false`; a normal gateway container does not start the worker. Enable it through your deployment configuration, with a valid Enterprise license. There is no dashboard toggle

The gateway and worker run as separate containers from the same image. Slack delivers messages over the worker's outbound Socket Mode connection. The worker calls your gateway with the requesting admin's personal session. You keep the worker private and use the gateway's HTTPS address for sign-in

:::note Availability

Use an image and chart containing [LiteLLM PR #44444](https://github.com/BerriAI/litellm/pull/44444) and the pinned worker from [Admin Agent PR #18](https://github.com/BerriAI/litellm-admin-agent/pull/18). Older images and charts do not contain this integration. The image names below are examples, not published release tags

:::

### Prepare your gateway {#1-prepare-your-gateway}

Start with a working Enterprise gateway that has a database, an HTTPS address, and [SSO configured](./admin_ui_sso.md). Verify that you can sign in to its Admin UI. Use an origin such as `https://gateway.example.com`, without a URL subpath

Choose a tool-calling model that the gateway exposes and that each connecting admin can access. Use its gateway model name in the configuration below

Each user needs an active [`proxy_admin` account](./access_control.md#global-proxy-roles) whose email matches their Slack profile. The gateway checks Enterprise entitlement and current admin permissions before connecting an account; the worker also checks entitlement and identity before allowing agent use

Run one worker for each Slack app, workspace, and gateway. Allow outbound Slack WebSocket connections and HTTPS requests from the worker to the gateway. Allow the gateway to reach the worker on its private port `10000`

### Store the worker's credentials {#3-store-the-workers-credentials}

Store these five values in your secret manager. Keep them separate from the gateway's master key and database credentials

| Setting | Value |
| --- | --- |
| `SLACK_BOT_TOKEN` | The installed app's `xoxb-…` token |
| `SLACK_APP_TOKEN` | The `xapp-…` token with `connections:write` |
| `SLACK_WORKSPACE_ID` | The workspace ID beginning with `T` |
| `ADMIN_AGENT_SERVICE_TOKEN` | A random shared secret of at least 32 characters, used by the gateway and worker |
| `CREDENTIAL_ENCRYPTION_KEY` | A persistent Fernet key used to encrypt saved personal sessions |

Generate the service token with `openssl rand -hex 32`. To generate the encryption key on a machine with the Python `cryptography` package installed, run:

```bash
python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'
```

Save generated values in your secret manager. Preserve the encryption key and worker state volume across upgrades so the worker can read saved connections. Keep credentials out of source control and Slack messages

### Enable the worker {#4-enable-the-worker}

Choose the deployment method you already use for the gateway. Both examples start in **read-only mode**, so the agent can answer lookups without changing gateway resources

<Tabs groupId="liteadmin-native-deployment">
<TabItem value="helm" label="Kubernetes / Helm" default>

Use the `helm/litellm-helm` chart from a LiteLLM checkout containing this integration. Keep your existing gateway values, including the Enterprise license, database, and SSO settings

Create a Secret named `liteadmin-slack` in the gateway's namespace through your usual secret-management workflow. It must contain the five settings from **Store the worker's credentials** above. For a manual installation, save only those settings in a private `liteadmin-secrets.env` file, then run:

```bash
chmod 600 liteadmin-secrets.env
export LITELLM_NAMESPACE=litellm
kubectl --namespace "$LITELLM_NAMESPACE" create secret generic liteadmin-slack \
  --from-env-file=liteadmin-secrets.env
```

Use your actual namespace. If the Secret already exists, update it through the system that manages it and preserve its encryption key

Add a `liteadmin-values.yaml` file:

```yaml title="liteadmin-values.yaml"
image:
  repository: registry.example.com/your-team/litellm
  tag: native-slack

liteadmin:
  enabled: true
  gatewayUrl: https://gateway.example.com
  model: your-tool-capable-model
  existingSecret: liteadmin-slack
  storageSize: 1Gi
  readOnly: true
```

Replace the image with a build containing this integration. Set `gatewayUrl` and `model` to your gateway URL and model name. Use `storageClassName` under `liteadmin` if your cluster requires a particular storage class

Apply the configuration to your existing release. Replace `litellm` with your release name and `gateway-values.yaml` with the values file you already use:

```bash
export LITELLM_RELEASE=litellm
helm dependency build ./helm/litellm-helm
helm upgrade "$LITELLM_RELEASE" ./helm/litellm-helm \
  --namespace "$LITELLM_NAMESPACE" \
  -f gateway-values.yaml \
  -f liteadmin-values.yaml
```

The chart starts one worker with a private ClusterIP Service and a persistent volume claim. It configures the gateway's worker address and shares only `ADMIN_AGENT_SERVICE_TOKEN` with gateway replicas. The worker receives its own Secret, without gateway master-key or database credentials

Gateway autoscaling does not scale the worker. Keep the worker at one replica and keep its Service private. After changing worker Secret values, restart the worker to load them; changing the shared service token also requires restarting the gateway

</TabItem>
<TabItem value="compose" label="Docker Compose">

From a LiteLLM checkout containing this integration, build the image or use a published build that contains it:

```bash
docker build -t litellm-native-admin:local .
```

Keep your existing gateway `.env` and Compose configuration, including its license, database, model, and SSO settings. Save the worker settings in a separate private file:

```dotenv title="liteadmin.env"
LITELLM_IMAGE=litellm-native-admin:local
LITELLM_PUBLIC_URL=https://gateway.example.com
LITELLM_ADMIN_MODEL=your-tool-capable-model
SLACK_BOT_TOKEN=your-installed-bot-token
SLACK_APP_TOKEN=your-socket-mode-app-token
SLACK_WORKSPACE_ID=your-workspace-id
ADMIN_AGENT_SERVICE_TOKEN=your-generated-service-token
CREDENTIAL_ENCRYPTION_KEY=your-generated-fernet-key
ADMIN_READ_ONLY=true
```

Replace the placeholders with your gateway settings and the secrets you saved above. Use the same service token for the gateway and worker; the overlay reads it from this file for both

Start the gateway and worker with the additional Compose file:

```bash
chmod 600 liteadmin.env
docker compose --env-file .env --env-file liteadmin.env \
  -f docker-compose.yml -f docker-compose.liteadmin.yml up -d
```

Use Docker Compose v2. Keep worker credentials in `liteadmin.env`; the base gateway configuration loads its own `.env`. The overlay starts the same image with `--admin-agent`, sets the private worker address on the gateway, and creates the `liteadmin_state` volume. It publishes no worker port

Keep your existing HTTPS reverse proxy in front of the gateway. After changing worker settings, rerun the Compose command so the container receives the new values

</TabItem>
</Tabs>

### Verify the worker {#5-verify-the-worker}

For **Helm**, find the worker Deployment in your namespace. Its name ends in `-liteadmin`:

```bash
kubectl --namespace "$LITELLM_NAMESPACE" get deployments
export LITEADMIN_DEPLOYMENT=litellm-liteadmin
kubectl --namespace "$LITELLM_NAMESPACE" rollout status \
  "deployment/$LITEADMIN_DEPLOYMENT" --timeout=180s
kubectl --namespace "$LITELLM_NAMESPACE" exec \
  "deployment/$LITEADMIN_DEPLOYMENT" -- \
  /opt/liteadmin/bin/python -c \
  "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:10000/readyz').read().decode())"
```

Replace `LITEADMIN_DEPLOYMENT` with the name shown by `get deployments`; chart name overrides can change it. Expect one ready worker and `{"status": "ready"}`

For **Docker Compose**, run the same readiness check inside the worker:

```bash
docker compose --env-file .env --env-file liteadmin.env \
  -f docker-compose.yml -f docker-compose.liteadmin.yml \
  exec liteadmin /opt/liteadmin/bin/python -c \
  "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:10000/readyz').read().decode())"
```

Expect `{"status": "ready"}`. With Slack enabled, readiness checks the state database and the Slack socket. Complete the next step to verify sign-in, model access, and an admin-tool request

### Connect your account and test a request {#6-connect-your-account-and-test-a-request}

1. Open **LiteAdmin** in Slack **Apps**, or the name you chose in the manifest, and send `connect` in a DM
2. Open the private connection link within ten minutes. It should use your gateway's HTTPS address
3. Sign in through your normal LiteLLM login. If you already have a valid browser session, proceed to the connection page
4. Check the email on the page and select **Connect account**. Expect **Account connected**
5. Return to Slack and ask: **What is my current LiteLLM role? Use the gateway to verify it**

Expect a reply confirming `proxy_admin`. You can then ask **List my teams and their current budgets**. The worker uses your personal session for model requests and admin operations, and verifies your Slack identity and current gateway permissions

Connection links expire after ten minutes and can be used once. Personal sessions last up to 24 hours. Send `connect` again when your session expires, or `disconnect` to delete the worker's saved connection and invalidate pending links. Disconnect does not revoke an exported credential at the gateway; that credential keeps its own expiration

### Allow changes after testing

The examples above set read-only mode. To permit connected admins to change keys, teams, models, or budgets, set `liteadmin.readOnly: false` in Helm, or `ADMIN_READ_ONLY=false` in Compose, then apply the deployment again

Choose a change you intend to make and verify the result in the gateway. The configuration defaults permit writes when you omit the read-only setting; keep the explicit `true` value if this deployment should only answer lookups

### Move an existing app to the Enterprise worker {#existing-liteadmin-installations}

This deployment uses the [LiteLLM Admin Agent](https://github.com/BerriAI/litellm-admin-agent) code in `native` authentication mode. A separate Slack app has its own worker and saved connections. Your existing standalone app continues to use its configured backend

To reuse an existing Slack app, stop its old worker before starting the bundled worker with that app's credentials. Run one worker for those credentials. Have users send `connect` again to establish native gateway sessions. Keep the old deployment's state and encryption key until you finish the migration

Native mode uses the gateway's connection page and existing SSO configuration. You do not configure hosted `/register`, `/authorize`, or `/token` callbacks, or add a second identity-provider client

</TabItem>
<TabItem value="standalone" label="Standalone">

Deploy the [LiteLLM Admin Agent](https://github.com/BerriAI/litellm-admin-agent) as a separate service with its own HTTPS address and login configuration. Use Python 3.12 for the local setup commands, plus Docker Compose or a paid Render service with persistent storage. {/* keep-python-version */}

The app bundles a pinned [Admin MCP connector](./liteadmin_mcp.md) and launches it with the requesting user's credential. You do not need to register an MCP server in the gateway or deploy another connector

### Create your configuration {#1-create-your-configuration}

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

Add the three Slack values from the installation above to `.env`: `SLACK_APP_TOKEN`, `SLACK_BOT_TOKEN`, and `SLACK_WORKSPACE_ID`

### Choose your gateway and login method {#3-choose-your-gateway-and-login-method}

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

### Deploy the app {#4-deploy-the-app}

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

### Check the deployment {#5-check-the-deployment}

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

### Connect your account in Slack {#6-connect-your-account-in-slack}

1. Open **LiteAdmin**, or the name you chose, under Slack **Apps** and send `connect` in a DM.
2. Open the private connection link within ten minutes.
3. Enter your personal proxy-admin key on the browser page, or complete SSO if your deployment uses it.
4. Return to Slack and ask: **“List my teams and their current budgets.”**

After the read succeeds, try a change you intend to make, such as “Create a key for Engineering with a $100 monthly budget.” The default configuration permits writes for connected admins. Use [read-only mode](#optional-restrict-tools) to limit the app to lookups.

Personal-key connections expire after 24 hours; SSO connections follow the gateway token's expiry. Gateway expiry or revocation can end access sooner. Send `connect` again to sign in. Send `disconnect` to remove your saved connection; revoke the credential in LiteLLM if you also want to invalidate it.

### Optional: restrict tools

Set these variables in `.env` or Render's environment and redeploy:

| Variable | Effect |
| --- | --- |
| `ADMIN_READ_ONLY=true` | Limit the agent to lookups. Users still need `proxy_admin`. |
| `ADMIN_TOOL_NAMES=list_keys,list_teams` | Expose only these canonical connector tools. |

An empty `ADMIN_TOOL_NAMES` allows all reviewed tools available on your gateway, subject to read-only mode. If an explicit tool is unavailable, the app stops the request. For model creation, also follow the [gateway prerequisites](./liteadmin_mcp.md#add-a-model-deployment).

### Optional: SSO login

Your gateway must have an SSO provider configured and support the hosted **proxy API** authorization-code flow: `/register`, `/authorize` with S256 PKCE, and `/token`. Support depends on the installed gateway release. Check the [agent's compatibility requirements](https://github.com/BerriAI/litellm-admin-agent/blob/main/docs/compatibility.md#optional-browser-sso) before enabling this mode.

On the **gateway**, no setting currently allows the app's hosted callback. LiteLLM currently accepts only loopback `redirect_uri` values for proxy API grants, so `/authorize` rejects `https://admin.example.com/oauth/callback` with `400 invalid_request` and `a proxy-API grant may only redirect to a loopback address`. `MCP_TRUSTED_REDIRECT_ORIGINS` covers MCP OAuth only and does not change this. Until your gateway release accepts hosted proxy API callbacks, use `api_key` mode. The app uses your gateway's SSO provider and does not need a separate Google or Okta client secret.

On the **agent**, set `CONNECTION_AUTH_MODE=sso` and redeploy. Verify the full flow: send `connect`, sign in, return to the browser page, then make a read request in Slack. If your gateway lacks this flow, configure `api_key` mode instead; the app does not switch modes on its own.

### Optional: use a hosted Admin MCP

Leave `ADMIN_MCP_URL` empty to use the bundled connector. To use a [hosted connector](./liteadmin_mcp.md#host-a-shared-mcp-endpoint), set:

```dotenv
ADMIN_MCP_URL=https://admin-mcp.example.com/mcp
```

Use a connector you operate and trust, configured for the same gateway. The agent sends each requesting user's gateway bearer credential to it. The hosted connector's own tool restrictions also apply.

</TabItem>
</Tabs>

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| No response in Slack | Confirm installation in the intended workspace, Socket Mode, the writable Messages tab, and `message.im` events. Check worker readiness and outbound Slack connectivity |
| Worker fails at startup | Check the Slack credentials, service token, encryption key, model, gateway URL, and writable persistent storage |
| Readiness returns 503 | Check the app token's `connections:write` scope, outbound WebSocket access, and the state database |
| Enterprise connection page returns 404 | Verify the gateway image contains this integration and has `LITELLM_ADMIN_AGENT_URL` configured |
| Enterprise connection page returns 403 | Check Enterprise entitlement, the current `proxy_admin` role, matching gateway and Slack emails, and the HTTPS origin |
| Enterprise connection page returns 410 | The link expired, was consumed, or was invalidated. Send `connect` for a new link |
| Enterprise connection page returns 503 | Check the private worker address, gateway-to-worker access, matching service tokens, and the gateway database |
| Standalone connection is denied | Check the current `proxy_admin` role, personal key ownership, model access, and the email match with Slack |
| Standalone connection page rejects the session | Use a fresh link in one browser. Check HTTPS and `AGENT_PUBLIC_URL`, which must have no subpath |
| Standalone SSO callback fails | A `400` saying a proxy-API grant may only redirect to a loopback address means the gateway release does not accept hosted callbacks; use `api_key` mode |
| Connection succeeds but a request fails | Confirm the admin can use the configured model and the worker can reach the gateway over HTTPS. For standalone deployments, run `doctor.py` and check `ADMIN_TOOL_NAMES` |
| Changes are refused | Check `liteadmin.readOnly` or `ADMIN_READ_ONLY` and any hosted connector restrictions. The Enterprise examples start in read-only mode |
| A change times out | Inspect the gateway resource before retrying. A timeout does not undo a completed operation |

See the [agent operations guide](https://github.com/BerriAI/litellm-admin-agent/blob/main/docs/operations.md) for backups and upgrades. [Gateway Agents / A2A registration](https://github.com/BerriAI/litellm-admin-agent/blob/main/docs/compatibility.md#optional-gateway-agents--a2a) is optional for standalone Slack use
