---
title: Enable the LiteAdmin Slack app
sidebar_label: Enable with Enterprise SSO
description: Enable the Enterprise LiteAdmin worker, install the Slack app, and connect admins through your existing LiteLLM SSO.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Enable the LiteAdmin Slack app

Use **LiteAdmin** to ask about teams, budgets, models, and spend from Slack. In this deployment, you run the agent alongside your Enterprise gateway, and each admin connects through your existing LiteLLM login

The Docker image includes the agent code and its dependencies. You must enable the worker and install a Slack app before anyone can use it. The Helm setting `liteadmin.enabled` defaults to `false`; a normal gateway container does not start the worker. Enable it through your deployment configuration, with a valid Enterprise license. There is no dashboard toggle

The gateway and worker run as separate containers from the same image. Slack delivers messages over the worker's outbound Socket Mode connection. The worker calls your gateway with the requesting admin's personal session. You keep the worker private and use the gateway's HTTPS address for sign-in

:::note Availability

Use an image and chart containing [LiteLLM PR #44444](https://github.com/BerriAI/litellm/pull/44444) and the pinned worker from [Admin Agent PR #18](https://github.com/BerriAI/litellm-admin-agent/pull/18). Older images and charts do not contain this integration. The image names below are examples, not published release tags

:::

## 1. Prepare your gateway

Start with a working Enterprise gateway that has a database, an HTTPS address, and [SSO configured](./admin_ui_sso.md). Verify that you can sign in to its Admin UI. Use an origin such as `https://gateway.example.com`, without a URL subpath

Choose a tool-calling model that the gateway exposes and that each connecting admin can access. Use its gateway model name in the configuration below

Each user needs an active [`proxy_admin` account](./access_control.md#global-proxy-roles) whose email matches their Slack profile. The gateway checks Enterprise entitlement and current admin permissions before connecting an account; the worker also checks entitlement and identity before allowing agent use

Run one worker for each Slack app, workspace, and gateway. Allow outbound Slack WebSocket connections and HTTPS requests from the worker to the gateway. Allow the gateway to reach the worker on its private port `10000`

## 2. Create and install the Slack app

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

This manifest enables Socket Mode, direct-message events, and a writable **Messages** tab. The app can read messages sent to it and look up the Slack profile email needed to match a gateway account. You do not need an inbound Slack event webhook, a public worker domain, or a second SSO application

## 3. Store the worker's credentials

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

## 4. Enable the worker

Choose the deployment method you already use for the gateway. Both examples start in **read-only mode**, so the agent can answer lookups without changing gateway resources

<Tabs groupId="liteadmin-native-deployment">
<TabItem value="helm" label="Kubernetes / Helm" default>

Use the `helm/litellm-helm` chart from a LiteLLM checkout containing this integration. Keep your existing gateway values, including the Enterprise license, database, and SSO settings

Create a Secret named `liteadmin-slack` in the gateway's namespace through your usual secret-management workflow. It must contain the five settings from step 3. For a manual installation, save only those settings in a private `liteadmin-secrets.env` file, then run:

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

Replace the image with a build containing this integration. Set `gatewayUrl` and `model` to the values from step 1. Use `storageClassName` under `liteadmin` if your cluster requires a particular storage class

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

Replace the placeholders with your gateway settings and the values from step 3. Use the same service token for the gateway and worker; the overlay reads it from this file for both

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

## 5. Verify the worker

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

## 6. Connect your account and test a request

1. Open **LiteAdmin** in Slack **Apps**, or the name you chose in the manifest, and send `connect` in a DM
2. Open the private connection link within ten minutes. It should use your gateway's HTTPS address
3. Sign in through your normal LiteLLM login. If you already have a valid browser session, proceed to the connection page
4. Check the email on the page and select **Connect account**. Expect **Account connected**
5. Return to Slack and ask: **What is my current LiteLLM role? Use the gateway to verify it**

Expect a reply confirming `proxy_admin`. You can then ask **List my teams and their current budgets**. The worker uses your personal session for model requests and admin operations, and verifies your Slack identity and current gateway permissions

Connection links expire after ten minutes and can be used once. Personal sessions last up to 24 hours. Send `connect` again when your session expires, or `disconnect` to delete the worker's saved connection and invalidate pending links. Disconnect does not revoke an exported credential at the gateway; that credential keeps its own expiration

## Allow changes after testing

The examples above set read-only mode. To permit connected admins to change keys, teams, models, or budgets, set `liteadmin.readOnly: false` in Helm, or `ADMIN_READ_ONLY=false` in Compose, then apply the deployment again

Choose a change you intend to make and verify the result in the gateway. The configuration defaults permit writes when you omit the read-only setting; keep the explicit `true` value if this deployment should only answer lookups

## Existing LiteAdmin installations

This deployment uses the [LiteLLM Admin Agent](https://github.com/BerriAI/litellm-admin-agent) code in `native` authentication mode. A separate Slack app has its own worker and saved connections. Your existing standalone app continues to use its configured backend

To reuse an existing Slack app, stop its old worker before starting the bundled worker with that app's credentials. Run one worker for those credentials. Have users send `connect` again to establish native gateway sessions. Keep the old deployment's state and encryption key until you finish the migration

Native mode uses the gateway's connection page and existing SSO configuration. You do not configure hosted `/register`, `/authorize`, or `/token` callbacks, or add a second identity-provider client

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| No response in Slack | Confirm installation in the intended workspace, Socket Mode, the writable Messages tab, and the `message.im` event. Check worker readiness and outbound Slack connectivity |
| Worker fails at startup | Check all five Secret values, the model and gateway URL, and writable persistent storage. Use a Fernet key for `CREDENTIAL_ENCRYPTION_KEY` |
| Readiness returns 503 | Check the Slack app token's `connections:write` scope, outbound WebSocket access, and the state database |
| Connection page returns 404 | Verify the image contains this integration and the gateway has `LITELLM_ADMIN_AGENT_URL` configured |
| Connection page returns 403 | Verify Enterprise entitlement, the current `proxy_admin` role, and matching gateway and Slack emails. For a rejected form, reopen the private link on the correct HTTPS origin |
| Connection page returns 410 | The link expired, was consumed, or was invalidated. Send `connect` for a new link |
| Connection page returns 503 | Check the private worker address, gateway-to-worker access, and matching service tokens. The gateway also needs its database to check current permissions |
| Connection succeeds but a request fails | Confirm that the connected admin can use the configured model and that the worker can reach the gateway over HTTPS |
| Changes are refused | Check `liteadmin.readOnly` or `ADMIN_READ_ONLY`. This guide enables read-only mode for the first test |
| A change times out | Inspect the gateway resource before retrying. A timeout does not undo a completed operation |

The examples configure `LITELLM_ADMIN_AGENT_URL` and `ADMIN_AGENT_SERVICE_TOKEN` on the gateway. They start the worker with `CONNECTION_AUTH_MODE=native`. Keep the worker private; use its internal readiness endpoint instead of adding public ingress
