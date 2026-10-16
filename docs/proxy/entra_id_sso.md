---
title: Microsoft Entra ID
sidebar_label: Microsoft Entra ID
description: Set up Microsoft Entra ID sign-in for the LiteLLM Admin UI with SAML, and for Claude Desktop with OIDC and JWT auth. Map Entra app roles to LiteLLM roles and Entra groups to LiteLLM teams, then check that requests are attributed to the right user and team.
---

import Image from '@theme/IdealImage';

# Microsoft Entra ID

This guide connects Microsoft Entra ID to LiteLLM in two places:

- **Admin UI sign-in with SAML.** Members of your administrator group click **Login with SSO** and land in the dashboard as LiteLLM admins. An Entra app role sets each user's LiteLLM role.
- **Claude Desktop sign-in with OIDC.** Users sign in to Claude Desktop with their Microsoft work account. LiteLLM checks the Entra ID token on every request, maps the user's Entra groups to LiteLLM teams, and applies those teams' models, budgets and rate limits.

The two parts are independent, so you can set up either one on its own. Each uses its own Entra application.

For a comparison of SSO, SCIM, group-to-team mapping and JWT auth, see [Identity overview](./identity_overview.md).

| You want to | Use | Section |
|---|---|---|
| Let admins sign in to the LiteLLM dashboard with Entra | SAML enterprise application | [Admin UI SSO with SAML](#admin-ui-sso-with-saml) |
| Let users sign in to Claude Desktop and send requests through LiteLLM | OIDC app registration plus LiteLLM JWT auth | [Claude Desktop SSO with OIDC](#claude-desktop-sso-with-oidc) |
| Let developers sign in to Claude Code and Codex CLI with Entra | Microsoft SSO on the proxy, the Claude Code gateway and `lite login --pkce` | [Entra sign-in for Claude Code and Codex](./entra_id_cli_sso.md) |
| Admin UI sign-in with OIDC and Microsoft Graph group sync instead of SAML | `MICROSOFT_CLIENT_ID` and related settings | [Microsoft Entra ID group sync](../tutorials/msft_sso.md) |
| Provision and deprovision users and teams from Entra | SCIM | [SCIM with LiteLLM](../tutorials/scim_litellm.md) |

Wherever this page shows `https://litellm.example.com`, use your gateway's public URL.

## Admin UI SSO with SAML

<EnterpriseFeature feature="SSO">SSO is free for up to 5 users. Beyond that, an enterprise license is required.</EnterpriseFeature>

### Before you start

- A LiteLLM deployment with a database, an HTTPS URL, and admin access to the Admin UI. Official Docker images include SAML support; a custom install needs `pip install 'litellm[saml]'`.
- Permission in Entra to manage enterprise applications, app registrations, app roles and assignments.
- An Entra security group for your LiteLLM admins, with a test user as a direct member. Assigning groups to applications requires Entra ID P1 or P2; you can also assign individual users.

Keep your current admin session open until you have confirmed that the new sign-in works.

### 1. Create the Entra application

1. In the Entra admin center, open **Entra ID > Enterprise applications > New application** and select **Create your own application**.
2. Name the application `LiteLLM Admin UI`, choose **Integrate any other application you don't find in the gallery (Non-gallery)**, and select **Create**.
3. Open the new application's **Single sign-on** page and choose **SAML**.
4. Under **Basic SAML Configuration**, select **Edit** and enter:

   | Entra field | Value |
   |---|---|
   | Identifier (Entity ID) | `https://litellm.example.com/sso/saml/metadata` |
   | Reply URL (Assertion Consumer Service URL) | `https://litellm.example.com/sso/saml/callback` |

   Leave **Sign on URL**, **Relay State** and **Logout URL** blank, then select **Save**. You will also enter the Identifier as the **SP Entity ID** in LiteLLM.

   <Image img={require('../../img/entra_saml_basic_config.png')} alt="Entra Basic SAML Configuration with the LiteLLM metadata URL as the Identifier and the callback URL as the Reply URL" style={{width: '80%', display: 'block', margin: '0'}} />

5. Under **SAML Certificates**, open the signing settings. Set **Signing Option** to **Sign SAML assertion** or **Sign SAML response and assertion**, with SHA-256, then select **Save**. By default LiteLLM rejects assertions that are not signed.

### 2. Define the admin app role

Entra sends an app role value to LiteLLM, and LiteLLM uses that value as the user's role. For admins, the value must be `proxy_admin`.

1. Open **Entra ID > App registrations > All applications** and select the registration for `LiteLLM Admin UI`.
2. Open **App roles > Create app role** and enter:

   | App role field | Value |
   |---|---|
   | Display name | `litellm-admin` |
   | Allowed member types | Users/Groups |
   | Value | `proxy_admin` |
   | Description | LiteLLM administrator |
   | Do you want to enable this app role? | Checked |

   <Image img={require('../../img/entra_app_role.png')} alt="Entra Create app role form with display name litellm-admin, member type Users/Groups and value proxy_admin" style={{width: '60%', display: 'block', margin: '0'}} />

3. Select **Apply**.

You pick the display name `litellm-admin` when you assign users and groups. LiteLLM reads the value `proxy_admin` from the assertion.

### 3. Configure the SAML claims

Go back to **Enterprise applications > LiteLLM Admin UI > Single sign-on** and select **Edit** under **Attributes & Claims**.

**Check the identity claims.** Keep Entra's default claims and make sure your test user has a value for each source attribute:

| Claim | Source attribute |
|---|---|
| Unique User Identifier (Name ID) | `user.userprincipalname` |
| emailaddress | `user.mail` |
| givenname | `user.givenname` |
| name | `user.userprincipalname` |
| surname | `user.surname` |

LiteLLM recognizes these default claim names. If `user.mail` is empty for your users, change the email claim to an attribute that holds the user's email address.

**Add the role claim.**

1. Select **Add new claim**.
2. Set **Name** to `role`, leave **Namespace** blank, set **Source** to **Attribute**, and set **Source attribute** to `user.assignedroles`.
3. Select **Save**. The claims list should now include `role`, sourced from `user.assignedroles`.

<Image img={require('../../img/entra_role_claim.png')} alt="Entra Manage claim form with name role, a blank namespace, and source attribute user.assignedroles" style={{width: '80%', display: 'block', margin: '0'}} />

The `role` claim carries the user's assigned app role value. For the admin role above, that value is `proxy_admin`.

### 4. Assign the admin group

1. In the enterprise application, open **Users and groups > Add user/group**.
2. Under **Users and groups**, choose your admin security group (for example `litellm-admins`) and click **Select**.
3. Under **Select a role**, choose `litellm-admin`, click **Select**, then **Assign**.
4. Check that the group is listed with the `litellm-admin` role. If an existing assignment shows **Default Access**, use **Edit assignment** to select the app role.
5. To let only assigned users and groups sign in, open **Properties**, set **Assignment required?** to **Yes**, and select **Save**.

A regular security group is enough. The group does not need **Microsoft Entra roles can be assigned to the group** turned on, because this is an app role assignment, not a directory role.

### 5. Connect LiteLLM to Entra

1. On the Entra application's **Single sign-on** page, find **SAML Certificates** and copy the **App Federation Metadata Url**. Copy the whole URL, including its `appid` query parameter.
2. In LiteLLM, open **Settings > Admin Settings > SSO Settings > Configure SSO**.
3. Select **SAML SSO** and enter:

   | LiteLLM field | Value |
   |---|---|
   | IdP Metadata URL | The App Federation Metadata Url you copied from Entra |
   | SP Entity ID | `https://litellm.example.com/sso/saml/metadata` |
   | Proxy Base URL | `https://litellm.example.com` |

   Leave **IdP Metadata XML** blank when you use the metadata URL. Keep **Allow IdP-initiated (unsolicited) responses** unchecked, because users start sign-in from LiteLLM. **Proxy Admin Email** is optional here, since the app role already makes your admins `proxy_admin`.

   <Image img={require('../../img/entra_saml_litellm_sso_settings.png')} dark={require('../../img/entra_saml_litellm_sso_settings_dark.png')} alt="LiteLLM Admin UI, Admin Settings page, with the Add SSO dialog open: SAML SSO selected and example values for the Entra metadata URL, SP Entity ID and Proxy Base URL" style={{width: '100%', display: 'block', margin: '0'}} />

4. Select **Add SSO**, then check that the saved provider is **SAML SSO**.

The proxy must be able to reach Entra's metadata URL. The **Login with SSO** button uses SAML only when SAML is the only SSO provider configured, so if you also have an OIDC provider set up, check which one is active before testing.

You can also set the same values with `SAML_IDP_METADATA_URL`, `SAML_SP_ENTITY_ID` and `PROXY_BASE_URL` instead of the UI. See [SAML 2.0 SSO](./saml_sso.md) for every option.

### 6. Test sign-in

Test with a newly assigned account that has no other admin grant, so the test checks the SAML role mapping and nothing else.

1. Open a private browser window at `https://litellm.example.com/ui`.
2. Select **Login with SSO** and sign in as the test user.
3. In LiteLLM, open the account menu and check that the role is **Admin**.
4. Open **Internal Users** and check that the user's **Global Proxy Role** is **Admin (All Permissions)**, which is the label for `proxy_admin`.

If the account menu shows **Internal Viewer** instead, check the app role, the assignment and the role claim, then sign in again in a new private window. If you turned on **Assignment required?**, also check that an unassigned user cannot sign in.

### Optional: other LiteLLM roles

Create an app role for each LiteLLM role you need, then assign users or groups to it. Give each group only the access it needs.

| App role value | Role shown in the LiteLLM account menu |
|---|---|
| `proxy_admin` | Admin |
| `proxy_admin_viewer` | Admin Viewer |
| `internal_user` | Internal User |
| `internal_user_viewer` | Internal Viewer |

Test that the users in each role get the LiteLLM role you expect.

### Optional: map Entra groups to LiteLLM teams

The `role` claim sets the user's global LiteLLM role. To also send team membership in the SAML assertion:

1. In **Attributes & Claims**, select **Add a group claim**. Choose **Security groups**, or **Groups assigned to the application** to send only assigned groups that the user is a direct member of.
2. Set **Source attribute** to **Group ID**.
3. Under **Advanced options**, turn on **Customize the name of the group claim**. Set **Name** to `groups` and leave **Namespace** blank.
4. Leave **Emit groups as role claims** unchecked, and save.
5. For each group, create a LiteLLM team whose **Team ID** is the Entra group's Object ID (see [create the team](#4-create-the-litellm-team) below).

LiteLLM looks for a team attribute named exactly `teams`, `team_ids` or `groups`. If you keep Entra's default group claim name (`http://schemas.microsoft.com/ws/2008/06/identity/claims/groups`), set `SAML_ATTRIBUTE_TEAM_IDS` to that full name instead. See [SAML attribute mapping](./saml_sso.md#attribute-mapping).

### Troubleshooting the Admin UI sign-in

**The user signs in as Internal Viewer.** Check that the group is assigned the `litellm-admin` role, that the app role's **Value** is `proxy_admin`, and that the claim is named `role` with a blank namespace and source `user.assignedroles`. Sign in again after each change.

**Entra denies the user access.** Check the enterprise application's **Users and groups** and the test user's group membership. The group must be assigned to the app role, not to **Default Access**.

**SAML audience, reply URL or signature validation fails.** Entra's **Identifier (Entity ID)** must match LiteLLM's **SP Entity ID**. The **Reply URL** must be your public proxy URL followed by `/sso/saml/callback`. Entra must sign the assertion with SHA-256, and LiteLLM must use this application's metadata URL.

**LiteLLM cannot load the IdP metadata.** Copy the **App Federation Metadata Url** again, including the `appid` query parameter. Check that the proxy can reach the URL and that **IdP Metadata XML** is blank.

**LiteLLM reports that unsolicited SAML responses are disabled.** Start sign-in from **Login with SSO** in LiteLLM. By default LiteLLM rejects sign-ins started from the Entra My Apps tile.

**LiteLLM reports a missing `python3-saml` dependency.** Install `litellm[saml]` in your custom build, or use an official LiteLLM Docker image.

## Claude Desktop SSO with OIDC

Users sign in to Claude Desktop with their Microsoft work account, and Claude Desktop sends the Entra ID token to LiteLLM with every request. LiteLLM checks the token, creates the user on first use, maps the token's groups to LiteLLM teams, and applies those teams' models, budgets and rate limits.

<EnterpriseFeature feature="JWT authentication" />

### Before you start

- A LiteLLM deployment with a database, an HTTPS gateway URL, a working Claude model, and a license that includes JWT authentication.
- Admin access to LiteLLM, and permission in Entra to manage app registrations, enterprise applications and groups.
- An Entra group with a test user as a direct member. Assigning groups to applications requires Entra ID P1 or P2.
- A supported Claude Desktop version. See [Claude Desktop (Cowork)](../tutorials/claude_desktop_cowork.md) for version notes.

### 1. Register Claude Desktop in Entra

1. In **Entra ID > App registrations**, select **New registration**. Name the application `Claude Desktop`, select **Accounts in this organizational directory only**, and click **Register**.
2. On **Overview**, copy the **Application (client) ID** and **Directory (tenant) ID**. This guide calls them `YOUR_CLIENT_ID` and `YOUR_TENANT_ID`.
3. Open **Authentication > Add a platform > Mobile and desktop applications**. Add `http://127.0.0.1/callback` as the redirect URI and click **Configure**. Keep the `/callback` path. Claude Desktop is a public client using PKCE, so it does not need a client secret.
4. Open **Enterprise applications > Claude Desktop > Users and groups**. Select **Add user/group**, choose the group that should use Claude Desktop, and click **Assign**.
5. To let only assigned users and groups sign in, open **Properties**, set **Assignment required?** to **Yes**, and click **Save**. With assignment required, a tenant admin must grant consent for the app's requested permissions.

### 2. Add the ID token claims

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

### 3. Turn on JWT auth in LiteLLM

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

### 4. Create the LiteLLM team

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

### 5. Configure Claude Desktop

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

### 6. Test sign-in and attribution

1. In Claude Desktop, choose **Sign in with your organization** and sign in as the test user. Go back to the app when the browser says you are connected.
2. Open the model picker, choose a model the team has access to, and send a short prompt. Check that Claude replies.
3. In LiteLLM, open **Internal Users** and find the user whose ID matches the token's `oid`. Under **Teams**, open your team's **Members** and check that the same user is listed.
4. Open **Logs** and find the request. Check that **Internal User** is the signed-in user and **Team Name** is the team whose ID matches the Entra group.

   <Image img={require('../../img/entra_logs_team_user.png')} dark={require('../../img/entra_logs_team_user_dark.png')} alt="LiteLLM Admin UI, Logs page; the Team Name and Internal User columns are outlined and show the Entra team and signed-in user for each Claude Desktop request" style={{width: '100%', display: 'block', margin: '0'}} />

5. Open the request and look at **Tags**. The `User-Agent` tag shows which client made the call, here `claude-cli`. The user and team come from the token and the team mapping, not from the tags.

   <Image img={require('../../img/entra_logs_tags.png')} dark={require('../../img/entra_logs_tags_dark.png')} alt="LiteLLM Admin UI, Logs page with a request open; the Tags card showing the claude-cli User-Agent and the User field in Request Details are outlined" style={{width: '100%', display: 'block', margin: '0'}} />

6. Sign in as a user whose teams do not have access to the requested model, and check that the request is denied.

A successful Microsoft sign-in shows that Entra authentication works. A model reply, plus the right user and team in the LiteLLM logs, shows that gateway access and attribution work too.

### Optional: roll out to a fleet

In Claude Desktop's third-party inference settings, click **Export** to get the managed configuration for your MDM. Current versions use `inferenceCredentialKind: external-idp`, `inferenceIdpOidc` and `inferenceIdpAuthFlow`. [Rolling out to a fleet](../tutorials/claude_desktop_cowork.md#rolling-out-to-a-fleet) covers the file formats, and [Configure Claude Desktop](../tutorials/claude_desktop_cowork.md#3-configure-claude-desktop) covers the older keys that earlier versions still read.

### Optional: test model discovery and inference with curl

Use an ID token for the same authorized user to call `GET /v1/models` and `POST /v1/messages`, with the exact model name your gateway returns. [Verify](../tutorials/claude_desktop_cowork.md#4-verify) has both requests.

### Troubleshooting Claude Desktop sign-in

**Microsoft reports a redirect URI mismatch, or asks for admin approval.** For a mismatch, check that the app registration has a **Mobile and desktop applications** platform with the URI `http://127.0.0.1/callback`, including the path. If Microsoft shows **Need admin approval**, a tenant admin must grant consent for the app, then the user signs in again.

**Sign-in works, but LiteLLM returns 401.** Check that JWT auth is on, that the token's `iss` matches the configured `issuer` (Entra v2 issuers end in `/v2.0`), and that `aud` matches the Claude Desktop client ID. Check that the proxy can reach the `jwks_url`, and that Claude Desktop's **Bearer token** is set to **ID token**.

**The user has no team access, or requests are denied.** Get a fresh ID token and check that it has a `groups` claim. The user must be a direct member of a group assigned to the application, and the LiteLLM **Team ID** must match that group's Object ID. Then check that the team has access to the exact model requested and has budget left. After changing claims or group membership, sign out and sign in again.

If the token has a group overage indicator instead of `groups`, the user is in too many groups for Entra to include them all. Set **Groups to include** to **Groups assigned to the application**.

**The Claude Desktop model picker is empty.** Check the team's model access and what `GET /v1/models` returns for the user. See [Models in the picker](../tutorials/claude_desktop_cowork.md#models-in-the-picker).

## Related

- [SAML 2.0 SSO](./saml_sso.md): all SAML settings, environment variables and attribute mapping
- [Admin UI SSO](./admin_ui_sso.md): OIDC sign-in for the Admin UI, including Microsoft
- [Microsoft Entra ID group sync](../tutorials/msft_sso.md): sync Entra groups and members to LiteLLM teams through Microsoft Graph
- [SCIM with LiteLLM](../tutorials/scim_litellm.md): provision users and teams from Entra
- [JWT auth](./token_auth.md): every `litellm_jwtauth` option
- [Claude Desktop (Cowork)](../tutorials/claude_desktop_cowork.md): Claude Desktop with other identity providers, MCP servers and fleet rollout
- [Entra sign-in for Claude Code and Codex](./entra_id_cli_sso.md): Entra sign-in for Claude Code and Codex CLI, with the same group-to-team mapping
- [Claude Code with Okta SSO](../tutorials/claude_code_okta_sso.md): JWT sign-in for Claude Code
