---
title: Entra sign-in for Claude Desktop
sidebar_label: Entra for Claude Desktop
description: Let users sign in to Claude Desktop with Microsoft Entra ID. LiteLLM checks the Entra ID token with JWT auth, maps Entra groups to LiteLLM teams, and applies the models, budgets and rate limits of those teams.
---

import Image from '@theme/IdealImage';

# Entra sign-in for Claude Desktop

Users sign in to Claude Desktop with their Microsoft work account, and Claude Desktop sends the Entra ID token to LiteLLM with every request. LiteLLM checks the token, creates the user on first use, maps the token's groups to LiteLLM teams, and applies those teams' models, budgets and rate limits.

This page is about Claude Desktop. For Admin UI sign-in with Entra, see [Microsoft Entra ID](./entra_id_sso.md). For Claude Code and Codex CLI, see [Entra sign-in for Claude Code and Codex](./entra_id_cli_sso.md). Wherever this page shows `https://litellm.example.com`, use your gateway's public URL.

<EnterpriseFeature feature="JWT authentication" />

## Before you start

- A LiteLLM deployment with a database, an HTTPS gateway URL, a working Claude model, and a license that includes JWT authentication.
- Admin access to LiteLLM, and permission in Entra to manage app registrations, enterprise applications and groups.
- An Entra group with a test user as a direct member. Assigning groups to applications requires Entra ID P1 or P2.
- A supported Claude Desktop version. See [Claude Desktop (Cowork)](../tutorials/claude_desktop_cowork.md) for version notes.

## 1. Register Claude Desktop in Entra

1. In **Entra ID > App registrations**, select **New registration**. Name the application `Claude Desktop`, select **Accounts in this organizational directory only**, and click **Register**.
2. On **Overview**, copy the **Application (client) ID** and **Directory (tenant) ID**. This guide calls them `YOUR_CLIENT_ID` and `YOUR_TENANT_ID`.
3. Open **Authentication > Add a platform > Mobile and desktop applications**. Add `http://127.0.0.1/callback` as the redirect URI and click **Configure**. Keep the `/callback` path. Claude Desktop is a public client using PKCE, so it does not need a client secret.
4. Open **Enterprise applications > Claude Desktop > Users and groups**. Select **Add user/group**, choose the group that should use Claude Desktop, and click **Assign**.
5. To let only assigned users and groups sign in, open **Properties**, set **Assignment required?** to **Yes**, and click **Save**. With assignment required, a tenant admin must grant consent for the app's requested permissions.

## 2. Add the ID token claims

1. Go back to **App registrations > Claude Desktop > Token configuration**.
2. Select **Add optional claim**, choose the **ID** token type, select `email`, and click **Add**.
3. Select **Add groups claim**, apply these settings, and click **Save**:

   | Setting | Value |
   |---|---|
   | Groups to include | Groups assigned to the application |
   | ID token group value | Group ID |
   | Emit groups as role claims | Off |

Claude Desktop sends the ID token to LiteLLM, so the `groups` claim must be on the ID token. With **Groups assigned to the application**, the user must be a direct member of an assigned group; nested membership does not count.

After a fresh sign-in, the ID token contains claims like these (example values):

```json
{
  "iss": "https://login.microsoftonline.com/YOUR_TENANT_ID/v2.0",
  "aud": "YOUR_CLIENT_ID",
  "oid": "USER_OBJECT_ID",
  "email": "user@example.com",
  "groups": ["ENTRA_GROUP_OBJECT_ID"]
}
```

`oid` identifies the user. `groups` holds the group Object IDs that LiteLLM maps to teams.

## 3. Turn on JWT auth in LiteLLM

Add these settings to your proxy config, keeping your existing model and database settings. Replace `YOUR_TENANT_ID` and `YOUR_CLIENT_ID` with the values from the Claude Desktop app registration.

```yaml title="config.yaml"
general_settings:
  enable_jwt_auth: true
  litellm_jwtauth:
    user_id_upsert: true
    enforce_team_based_model_access: true
    issuers:
      - issuer: https://login.microsoftonline.com/YOUR_TENANT_ID/v2.0
        jwks_url: https://login.microsoftonline.com/YOUR_TENANT_ID/discovery/v2.0/keys
        audience: YOUR_CLIENT_ID
        user_id_jwt_field: oid
        user_email_jwt_field: email
        team_ids_jwt_field: groups
```

Redeploy the proxy with the new config, then check that it starts and can reach Entra's signing keys URL over HTTPS.

LiteLLM checks the token's issuer, audience and signature on every request. With `user_id_upsert`, it creates the user from `oid` on their first request. It reads team IDs from `groups`, and with `enforce_team_based_model_access` a request succeeds only if one of the user's teams has access to the requested model.

Keep `audience` and `jwks_url` inside the `issuers` entry. To accept tokens only from this issuer, leave the global `JWT_PUBLIC_KEY_URL`, `JWT_AUDIENCE` and `JWT_ISSUER` environment variables unset. See [JWT auth](./token_auth.md) for every option.

## 4. Create the LiteLLM team

1. In Entra, open **Groups**, select your group, and copy its **Object ID** from **Overview**.
2. In LiteLLM, open **Teams > Create Team**. Enter a name such as `Claude Users`, and select an organization if your deployment uses them.
3. Expand **Additional Settings**, paste the Entra group's Object ID into **Team ID**, and click **Create Team**.

   <Image img={require('../../img/entra_team_id.png')} dark={require('../../img/entra_team_id_dark.png')} alt="LiteLLM Admin UI, Teams page, with the Create Team dialog open; the Team ID field under Additional Settings is outlined and holds an Entra group Object ID" style={{width: '75%', display: 'block', margin: '0'}} />

4. Open the team's **Settings > Edit Settings**. Under **Models**, select **All Anthropic models** or the specific models this group should use.
5. Set the team's budget and rate limits, then click **Save Changes**.

The LiteLLM **Team ID** must exactly match the Entra group's Object ID. The team name does not matter for the mapping, and if you leave **Team ID** blank, LiteLLM generates an unrelated ID.

| Where | Value |
|---|---|
| Entra group Object ID | `ENTRA_GROUP_OBJECT_ID` |
| ID token `groups` claim | `["ENTRA_GROUP_OBJECT_ID"]` |
| LiteLLM Team ID | `ENTRA_GROUP_OBJECT_ID` |

Repeat for each Entra group that needs its own models or budget. Create the teams before you test, so LiteLLM can match the group IDs in the token.

## 5. Configure Claude Desktop

1. In Claude Desktop, turn on **Help > Troubleshooting > Enable Developer Mode**.
2. Open **Developer > Configure Third-Party Inference** and enter:

   | Field | Value |
   |---|---|
   | Inference provider | Gateway |
   | Gateway base URL | `https://litellm.example.com`, without `/v1` |
   | Credential kind | Identity provider sign-in (OIDC). Older versions show **Interactive sign-in**. |
   | Identity provider sign-in flow | browser |
   | OIDC Client ID | `YOUR_CLIENT_ID` |
   | Issuer URL | `https://login.microsoftonline.com/YOUR_TENANT_ID/v2.0` |
   | Bearer token | ID token |
   | Scopes | `openid profile email offline_access` |
   | Redirect host | `127.0.0.1` |
   | Redirect port | Leave empty |

   <Image img={require('../../img/claude_desktop_credential_kind.png')} alt="Claude Desktop Credential kind menu with Identity provider sign-in (OIDC) highlighted" style={{width: '60%', display: 'block', margin: '0'}} />

3. Click **Apply Changes**, then **Save & Restart** when prompted.

## 6. Test sign-in and attribution

1. In Claude Desktop, choose **Sign in with your organization** and sign in as the test user. Go back to the app when the browser says you are connected.
2. Open the model picker, choose a model the team has access to, and send a short prompt. Check that Claude replies.
3. In LiteLLM, open **Internal Users** and find the user whose ID matches the token's `oid`. Under **Teams**, open your team's **Members** and check that the same user is listed.
4. Open **Logs** and find the request. Check that **Internal User** is the signed-in user and **Team Name** is the team whose ID matches the Entra group.

   <Image img={require('../../img/entra_logs_team_user.png')} dark={require('../../img/entra_logs_team_user_dark.png')} alt="LiteLLM Admin UI, Logs page; the Team Name and Internal User columns are outlined and show the Entra team and signed-in user for each Claude Desktop request" style={{width: '100%', display: 'block', margin: '0'}} />

5. Open the request and look at **Tags**. The `User-Agent` tag shows which client made the call, here `claude-cli`. The user and team come from the token and the team mapping, not from the tags.

   <Image img={require('../../img/entra_logs_tags.png')} dark={require('../../img/entra_logs_tags_dark.png')} alt="LiteLLM Admin UI, Logs page with a request open; the Tags card showing the claude-cli User-Agent and the User field in Request Details are outlined" style={{width: '100%', display: 'block', margin: '0'}} />

6. Sign in as a user whose teams do not have access to the requested model, and check that the request is denied.

A successful Microsoft sign-in shows that Entra authentication works. A model reply, plus the right user and team in the LiteLLM logs, shows that gateway access and attribution work too.

## Optional: roll out to a fleet

In Claude Desktop's third-party inference settings, click **Export** to get the managed configuration for your MDM. Current versions use `inferenceCredentialKind: external-idp`, `inferenceIdpOidc` and `inferenceIdpAuthFlow`. [Rolling out to a fleet](../tutorials/claude_desktop_cowork.md#rolling-out-to-a-fleet) covers the file formats, and [Configure Claude Desktop](../tutorials/claude_desktop_cowork.md#3-configure-claude-desktop) covers the older keys that earlier versions still read.

## Optional: test model discovery and inference with curl

Use an ID token for the same authorized user to call `GET /v1/models` and `POST /v1/messages`, with the exact model name your gateway returns. [Verify](../tutorials/claude_desktop_cowork.md#4-verify) has both requests.

## Troubleshooting

**Microsoft reports a redirect URI mismatch, or asks for admin approval.** For a mismatch, check that the app registration has a **Mobile and desktop applications** platform with the URI `http://127.0.0.1/callback`, including the path. If Microsoft shows **Need admin approval**, a tenant admin must grant consent for the app, then the user signs in again.

**Sign-in works, but LiteLLM returns 401.** Check that JWT auth is on, that the token's `iss` matches the configured `issuer` (Entra v2 issuers end in `/v2.0`), and that `aud` matches the Claude Desktop client ID. Check that the proxy can reach the `jwks_url`, and that Claude Desktop's **Bearer token** is set to **ID token**.

**The user has no team access, or requests are denied.** Get a fresh ID token and check that it has a `groups` claim. The user must be a direct member of a group assigned to the application, and the LiteLLM **Team ID** must match that group's Object ID. Then check that the team has access to the exact model requested and has budget left. After changing claims or group membership, sign out and sign in again.

If the token has a group overage indicator instead of `groups`, the user is in too many groups for Entra to include them all. Set **Groups to include** to **Groups assigned to the application**.

**The Claude Desktop model picker is empty.** Check the team's model access and what `GET /v1/models` returns for the user. See [Models in the picker](../tutorials/claude_desktop_cowork.md#models-in-the-picker).

## Related

- [Claude Desktop (Cowork)](../tutorials/claude_desktop_cowork.md): Claude Desktop with other identity providers, MCP servers and fleet rollout
- [JWT auth](./token_auth.md): every `litellm_jwtauth` option
- [Microsoft Entra ID](./entra_id_sso.md): Admin UI sign-in with Entra
- [Entra sign-in for Claude Code and Codex](./entra_id_cli_sso.md): the same group-to-team mapping for the command-line clients
- [Identity overview](./identity_overview.md): compare SSO, SCIM, group-to-team mapping and JWT auth
