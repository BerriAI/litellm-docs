---
title: Entra sign-in for Claude Code and Codex
sidebar_label: Entra for Claude Code and Codex
description: Let developers sign in to Claude Code and Codex CLI with their Microsoft Entra ID work account through LiteLLM. Covers the one-time admin setup, each developer's first sign-in, mapping Entra groups to LiteLLM teams, and checking per-user and per-team attribution in the logs.
---

import Image from '@theme/IdealImage';

# Entra sign-in for Claude Code and Codex

Developers sign in to Claude Code and Codex CLI with their Microsoft work account. They never handle a LiteLLM API key. Each request carries a short-lived LiteLLM token tied to the developer's user and team, so spend, budgets, model access and logs are tracked per person.

<EnterpriseFeature feature="SSO">From v1.76.0, SSO is free for up to 5 users. Beyond that, an enterprise license is required.</EnterpriseFeature>

Both clients use the proxy's Microsoft SSO login in the browser:

| Client | How the developer signs in | What the client sends |
|---|---|---|
| Claude Code | `/login` on the **Cloud gateway** screen, then a device code in the browser | A LiteLLM token, renewed by Claude Code |
| Codex CLI | `lite login --pkce` once, in the terminal | A LiteLLM token that Codex gets from `lite auth print-token` |

In both cases, LiteLLM creates the user from their Entra Object ID on first sign-in. It also reads the user's Entra groups from Microsoft Graph and adds them to the LiteLLM teams whose Team ID matches a group's Object ID. Each team's models, budget and rate limits then apply.

This page is about the two command-line clients. For Admin UI sign-in with Entra, see [Microsoft Entra ID](./entra_id_sso.md). For Claude Desktop, see [Entra for Claude Desktop](./entra_id_claude_desktop.md). Wherever this page shows `https://litellm.example.com`, use your gateway's URL.

## Before you start

- LiteLLM v1.106.0 or later, with a database. Earlier versions issue no refresh token, so developers sign in again every 24 hours.
- Permission to create an app registration in Entra and grant admin consent for Microsoft Graph permissions.
- Claude Code v2.1.195 or later on developer machines, and a way to deploy a file to them, such as your MDM.
- A Codex CLI that supports a command for provider auth. This page was tested with Codex CLI 0.162.1.
- An internal hostname for LiteLLM that resolves to a private address, with TLS. Claude Code only signs in to a gateway on a private or loopback address.

## Admin setup

You do this once for the whole organization.

### 1. Register LiteLLM in Entra

If the LiteLLM Admin UI already signs in with Microsoft over OIDC, through the `MICROSOFT_CLIENT_ID` settings, both clients use that same app registration. Check that it has the redirect URI and permissions below, then go to [step 2](#2-configure-litellm).

1. In the [Microsoft Entra admin center](https://entra.microsoft.com/), open **App registrations > New registration**.
2. Enter a name such as `LiteLLM`, and choose **Accounts in this organizational directory only**.
3. Under **Redirect URI**, choose the **Web** platform and enter `https://litellm.example.com/sso/callback`. Click **Register**.
4. From **Overview**, copy the **Application (client) ID** and **Directory (tenant) ID**.
5. Open **Certificates & secrets > New client secret**, create a secret, and copy its **Value**.
6. Open **API permissions > Add a permission > Microsoft Graph > Delegated permissions**. Add `User.Read` and `GroupMember.Read.All`, then click **Grant admin consent**.

LiteLLM uses `User.Read` to read the signed-in user, and `GroupMember.Read.All` to list their groups through `/me/memberOf`. Without the groups, users sign in but are not added to any team.

To set each user's LiteLLM role from Entra, add app roles such as `internal_user` and assign them in the enterprise application. See [Using Entra ID App Roles for User Permissions](../tutorials/msft_sso.md#4-using-entra-id-app-roles-for-user-permissions).

### 2. Configure LiteLLM

Set the Microsoft SSO variables on the proxy:

```bash showLineNumbers title="Proxy environment"
export MICROSOFT_CLIENT_ID="YOUR_CLIENT_ID"
export MICROSOFT_CLIENT_SECRET="YOUR_CLIENT_SECRET"
export MICROSOFT_TENANT="YOUR_TENANT_ID"
export PROXY_BASE_URL="https://litellm.example.com"
```

`PROXY_BASE_URL` must be the URL developers use, not a pod or container address. LiteLLM builds the sign-in and callback URLs from it.

Then turn on the Claude Code gateway and add the models both clients use:

```yaml showLineNumbers title="config.yaml"
model_list:
  # Claude Code
  - model_name: {{anthropic}}
    litellm_params:
      model: anthropic/{{anthropic}}
      api_key: os.environ/ANTHROPIC_API_KEY
  - model_name: "anthropic/*"
    litellm_params:
      model: "anthropic/*"
      api_key: os.environ/ANTHROPIC_API_KEY
  # Codex
  - model_name: {{openai_large}}
    litellm_params:
      model: openai/{{openai_large}}
      api_key: os.environ/OPENAI_API_KEY

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  database_url: os.environ/DATABASE_URL
  enable_claude_code_gateway: true
```

Keep the `anthropic/*` wildcard. Claude Code chooses model names itself, and it also sends background calls to a small Haiku model, so the proxy must accept any Anthropic model name. `enable_claude_code_gateway` can only be set in `config.yaml`, not from the Admin UI.

If you run more than one worker or replica, configure Redis (`REDIS_HOST`, `REDIS_PORT` and `REDIS_PASSWORD`). The sign-in steps and token renewals can reach different processes, and Redis lets them share state. Otherwise, run a single worker.

### 3. Map Entra groups to LiteLLM teams

Create a LiteLLM team for each Entra group that needs its own models or budget. The team's ID must be the group's Object ID:

1. In Entra, open **Groups**, select the group, and copy its **Object ID**.
2. In LiteLLM, open **Teams > Create Team**, enter a name, expand **Additional Settings**, and paste the Object ID into **Team ID**. [Create the LiteLLM team](./entra_id_claude_desktop.md#4-create-the-litellm-team) shows this dialog.
3. Under **Models**, give the team the models its developers use: your Anthropic alias and `anthropic/*` for Claude Code, and the OpenAI model for Codex.
4. Set the team's budget and rate limits.

| Where | Value |
|---|---|
| Entra group Object ID | `ENTRA_GROUP_OBJECT_ID` |
| LiteLLM Team ID | `ENTRA_GROUP_OBJECT_ID` |

This is the same mapping that Claude Desktop sign-in uses, so a team you already created for Claude Desktop works here without changes.

LiteLLM reads the user's groups every time they sign in through SSO. A user added to a group in Entra joins the matching team at their next sign-in.

To have LiteLLM create the teams for you, set `MICROSOFT_SERVICE_PRINCIPAL_ID` to the Object ID of the LiteLLM enterprise application. At sign-in, LiteLLM then creates a team for each group assigned to that application, named after the group. See [Auto-create Entra ID groups on LiteLLM teams](../tutorials/msft_sso.md#1-auto-create-entra-id-groups-on-litellm-teams), and use `default_team_params` to give new teams their models and budget.

:::tip Keep Claude Code users in one mapped team
Claude Code's sign-in binds the session to one of the user's teams, and it does not ask which one. For a user in several mapped teams, LiteLLM picks one of them with no defined order, and the next sign-in can pick a different one. Put each Claude Code user in exactly one mapped team. Codex sign-in asks the user to pick a team, so this does not affect Codex.
:::

### 4. Deploy the Claude Code managed settings

Claude Code shows the gateway sign-in only when the gateway URL comes from a managed settings file. It ignores these keys in a developer's own `~/.claude/settings.json`. Deploy this file with your MDM:

```json title="managed-settings.json"
{
  "forceLoginMethod": "gateway",
  "forceLoginGatewayUrl": "https://litellm.example.com/claude_code_gateway"
}
```

| OS | Path |
|---|---|
| macOS | `/Library/Application Support/ClaudeCode/managed-settings.json` |
| Linux and WSL | `/etc/claude-code/managed-settings.json` |
| Windows | `C:\Program Files\ClaudeCode\managed-settings.json` |

To check the gateway before rollout, request its discovery document. It needs no sign-in:

```bash
curl https://litellm.example.com/claude_code_gateway/.well-known/oauth-authorization-server
```

The `issuer` in the response must equal `forceLoginGatewayUrl`. To push Claude Code settings such as permissions or telemetry from the proxy, see [Push managed settings from the proxy](../tutorials/claude_code_gateway.md#4-push-managed-settings-from-the-proxy).

Codex needs no admin rollout beyond the `lite` CLI. Each developer adds the provider to their own Codex config in [Codex first sign-in](#codex-first-sign-in).

## Claude Code first sign-in

1. The developer runs `claude`. With the managed settings in place, the sign-in opens on the **Cloud gateway** screen, showing your gateway URL. They press Enter to continue.

   <Image img={require('../../img/claude_code_gateway/gateway_detected.png')} alt="Claude Code sign-in showing the Cloud gateway screen with the LiteLLM gateway URL from managed settings" style={{ width: '800px', height: 'auto' }} />

2. On first connection, Claude Code asks them to trust the gateway, because a trusted gateway can push settings to the machine. They confirm. Claude Code asks this once per gateway host.
3. Claude Code shows a verification code and opens the browser. If the browser does not open, they visit the URL shown.

   <Image img={require('../../img/claude_code_gateway/device_code.png')} alt="Claude Code showing a verification code and the browser URL for the gateway sign-in" style={{ width: '800px', height: 'auto' }} />

4. The browser goes to the Microsoft sign-in page. A browser already signed in to Microsoft skips this page. After sign-in, LiteLLM asks for the code from the terminal. They enter it and click **Continue**.

   <Image img={require('../../img/claude_code_gateway/browser_verification_code.png')} alt="LiteLLM Complete CLI Login page asking for the verification code shown in the terminal" style={{ width: '800px', height: 'auto' }} />

5. The browser shows **Authentication Successful!**, and Claude Code shows that it is connected to the cloud gateway. After the usual first-run prompts for security notes and folder trust, the session header shows **Cloud gateway** next to the model.

   <Image img={require('../../img/claude_code_gateway/signed_in_session.png')} alt="Claude Code session signed in through the LiteLLM gateway, with Cloud gateway shown next to the model" style={{ width: '800px', height: 'auto' }} />

To check the setup, the developer runs `/status`. It shows **Cloud gateway** as the API provider and **Enterprise managed settings (file)** as a settings source.

Claude Code renews the token on its own, so the developer is not sent back to the browser each day. `/logout` ends the sign-in. See [Session lifetime and sign-out](../tutorials/claude_code_gateway.md#session-lifetime-and-sign-out).

## Codex first sign-in

1. Install the `lite` CLI:

   ```bash
   uv tool install 'litellm[cli]'
   ```

   [CLI SSO](./cli_sso.md#steps) has a one-line installer for machines without uv.

2. Sign in:

   ```bash
   lite --base-url https://litellm.example.com login --pkce
   ```

   The browser opens the Microsoft sign-in page, then LiteLLM's **Authorize CLI access** page. The page shows the CLI's local address and the LiteLLM user it will act as. A user in several teams chooses one under **Attribute requests to team**. A user in one team sees which team requests go to. They click **Approve**.

   <Image img={require('../../img/entra_cli_consent_team_picker.png')} alt="LiteLLM Authorize CLI access page naming the local CLI address and the signed-in user ID, with the Attribute requests to team menu set to Platform Engineering and Deny and Approve buttons" style={{ width: '60%', display: 'block', margin: '0' }} />

   The browser shows that sign-in is complete, and the terminal prints `Login successful!`. The credential is stored in the OS keychain, or in `~/.litellm/token.json` with owner-only permissions on machines without one.

3. Point Codex at LiteLLM and have it get the token from `lite`. Add this to `~/.codex/config.toml`:

   ```toml title="~/.codex/config.toml"
   model_provider = "litellm"
   model = "{{openai_large}}"

   [model_providers.litellm]
   name = "LiteLLM"
   base_url = "https://litellm.example.com/v1"
   wire_api = "responses"

   [model_providers.litellm.auth]
   command = "/absolute/path/to/lite"
   args = ["--base-url", "https://litellm.example.com", "auth", "print-token"]
   timeout_ms = 30000
   refresh_interval_ms = 300000
   ```

   Set `command` to the output of `which lite`. Use exactly the same `--base-url` as in `lite login`. A token issued for one URL is not returned for another, even if both reach the same proxy. Remove any `env_key` line from the provider, because Codex rejects `auth` and `env_key` together.

4. Run `codex`. Requests go to `/v1/responses` on the proxy with the developer's token. `lite auth print-token` renews it with the stored refresh token when it is about to expire.

To sign out, the developer runs `lite logout`. Codex then gets `401` responses until they run `lite login --pkce` again. For the token's lifetime and storage, see [Browser sign-in with PKCE](./cli_sso.md#browser-sign-in-with-pkce).

## Check attribution in the logs

In the LiteLLM Admin UI, open **Logs**. Each request from a signed-in developer shows:

| Column | What it shows |
|---|---|
| **Team Name** | The LiteLLM team whose ID matches the Entra group |
| **Key Alias** | `cli-session-<user ID>`, where the user ID is the developer's Entra Object ID |
| **Internal User** | The developer's email from Entra |
| **Tags** | The client: `User-Agent: claude-cli` for Claude Code, and a Codex user agent such as `codex_exec` for `codex exec` |

<Image img={require('../../img/entra_cli_logs.png')} dark={require('../../img/entra_cli_logs_dark.png')} alt="LiteLLM Admin UI, Logs page with two Claude Code sessions and one Codex request from dev@example.com; the Team Name, Key Alias, Internal User and Tags columns are outlined" style={{ width: '100%', display: 'block', margin: '0' }} />

Here, one developer who belongs to two mapped teams sent requests from both clients. The Codex request went to **Claude Users**, the team chosen on the consent page. The two Claude Code sessions went to different teams, **Platform Engineering** and **Claude Users**, because Claude Code sign-in does not ask. This is why each Claude Code user should be in one mapped team.

A Claude Code row groups a session's requests, including the Haiku background call, and **Type** shows how many there are. Click a row to see each request.

To see a developer's total spend, open **Internal Users** and find their email. To see a team's spend and members, open **Teams**.

## Offboarding

Removing a user from Entra, or from an Entra group, does not end a session that is already running. Renewal checks the user and team in LiteLLM, not in Entra. When someone leaves, also deactivate or delete the user in LiteLLM, or remove them from the team:

- The next renewal fails, and the client asks them to sign in again within 24 hours, when the current token expires. Set `LITELLM_CLI_JWT_EXPIRATION_HOURS` to shorten this.
- For Claude Code, a deleted user's requests fail at once.

Without that, a running session can keep renewing for up to 14 days after the last renewal.

## Troubleshooting

**Claude Code does not show the Cloud gateway screen.** Check that the managed settings file is at the system path for the OS, not in `~/.claude/settings.json`, and that Claude Code is v2.1.195 or later. Check that the gateway hostname resolves to a private address.

**Microsoft reports a redirect URI mismatch.** The app registration must have a **Web** platform redirect URI that exactly matches `PROXY_BASE_URL` followed by `/sso/callback`.

**Sign-in works, but the user is in no team, or requests return a model access error.** Check that admin consent was granted for `GroupMember.Read.All`, that the user is a member of the group, and that the LiteLLM Team ID is the group's Object ID. Then check that the team has the model the client asked for, including `anthropic/*` for Claude Code. After changing groups, sign in again.

**Codex returns 401.** Run `lite --base-url https://litellm.example.com auth print-token` with the same URL as `config.toml`. If it fails, run `lite login --pkce` again. Check that `command` is an absolute path.

**Sign-in sometimes fails on a deployment with several replicas.** Configure Redis so all replicas share sign-in state.

## Related

- [Claude Code Gateway](../tutorials/claude_code_gateway.md): every gateway setting, session lifetime, managed settings and telemetry
- [CLI SSO](./cli_sso.md): `lite login`, PKCE sign-in, credential storage and sign-out
- [Codex CLI](./client_setup/codex_cli.md): all Codex settings, including model metadata for custom aliases
- [Microsoft Entra ID](./entra_id_sso.md): Admin UI sign-in with SAML or OIDC
- [Entra for Claude Desktop](./entra_id_claude_desktop.md): Claude Desktop sign-in with Entra
- [Microsoft Entra ID group sync](../tutorials/msft_sso.md): group sync, team auto-creation and app roles
- [SCIM with LiteLLM](../tutorials/scim_litellm.md): provision and deprovision users and teams from Entra
