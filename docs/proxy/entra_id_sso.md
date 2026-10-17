---
title: Microsoft Entra ID
sidebar_label: Microsoft Entra ID
description: Set up Microsoft Entra ID sign-in for the LiteLLM Admin UI with SAML or OIDC. Map Entra app roles to LiteLLM roles and Entra groups to LiteLLM teams.
---

import Image from '@theme/IdealImage';

# Microsoft Entra ID

This guide connects Microsoft Entra ID to the LiteLLM Admin UI. Users click **Login with SSO** and sign in with their Microsoft work account. An Entra app role sets the LiteLLM role of each user.

You can connect Entra in two ways. Pick one:

| Method | Use it when | Section |
|---|---|---|
| SAML enterprise application | You want app roles and group claims in a SAML assertion | [Admin UI SSO with SAML](#admin-ui-sso-with-saml) |
| OIDC app registration | You want Microsoft Graph group sync, or you already use OIDC | [Admin UI SSO with OIDC](#admin-ui-sso-with-oidc) |

Entra can also sign in users to clients that call the gateway. These guides are separate:

- [Entra sign-in for Claude Desktop](./entra_id_claude_desktop.md)
- [Entra sign-in for Claude Code and Codex](./entra_id_cli_sso.md)

For a comparison of SSO, SCIM, group-to-team mapping and JWT auth, see [Identity overview](./identity_overview.md).

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

You can also set the same values with `SAML_IDP_METADATA_URL`, `SAML_SP_ENTITY_ID` and `PROXY_BASE_URL` instead of the UI. See [Other OIDC and SAML providers](./saml_sso.md) for every option.

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
5. For each group, create a LiteLLM team. In LiteLLM, open **Teams > Create Team**, expand **Additional Settings**, and paste the Entra group's Object ID into **Team ID**.

LiteLLM looks for a team attribute named exactly `teams`, `team_ids` or `groups`. If you keep Entra's default group claim name (`http://schemas.microsoft.com/ws/2008/06/identity/claims/groups`), set `SAML_ATTRIBUTE_TEAM_IDS` to that full name instead. See [SAML attribute mapping](./saml_sso.md#attribute-mapping).

### Troubleshooting the Admin UI sign-in

**The user signs in as Internal Viewer.** Check that the group is assigned the `litellm-admin` role, that the app role's **Value** is `proxy_admin`, and that the claim is named `role` with a blank namespace and source `user.assignedroles`. Sign in again after each change.

**Entra denies the user access.** Check the enterprise application's **Users and groups** and the test user's group membership. The group must be assigned to the app role, not to **Default Access**.

**SAML audience, reply URL or signature validation fails.** Entra's **Identifier (Entity ID)** must match LiteLLM's **SP Entity ID**. The **Reply URL** must be your public proxy URL followed by `/sso/saml/callback`. Entra must sign the assertion with SHA-256, and LiteLLM must use this application's metadata URL.

**LiteLLM cannot load the IdP metadata.** Copy the **App Federation Metadata Url** again, including the `appid` query parameter. Check that the proxy can reach the URL and that **IdP Metadata XML** is blank.

**LiteLLM reports that unsolicited SAML responses are disabled.** Start sign-in from **Login with SSO** in LiteLLM. By default LiteLLM rejects sign-ins started from the Entra My Apps tile.

**LiteLLM reports a missing `python3-saml` dependency.** Install `litellm[saml]` in your custom build, or use an official LiteLLM Docker image.

## Admin UI SSO with OIDC

<EnterpriseFeature feature="SSO">SSO is free for up to 5 users. Beyond that, an enterprise license is required.</EnterpriseFeature>

Use this method if you want LiteLLM to sync Entra groups to LiteLLM teams through Microsoft Graph. With OIDC, LiteLLM reads app roles from the ID token.

### 1. Register the application

1. In the Entra admin center, open **Entra ID > App registrations > New registration**.
2. Name the application `LiteLLM Admin UI`.
3. Under **Redirect URI**, select **Web** and enter `https://litellm.example.com/sso/callback`. Then select **Register**.
4. Open **Certificates & secrets > New client secret**. Copy the secret **Value**.
5. On **Overview**, copy the **Application (client) ID** and the **Directory (tenant) ID**.

### 2. Set the environment variables

Set these variables on the proxy, then restart it:

```bash
MICROSOFT_CLIENT_ID="<application-client-id>"
MICROSOFT_CLIENT_SECRET="<client-secret-value>"
MICROSOFT_TENANT="<directory-tenant-id>"
PROXY_BASE_URL="https://litellm.example.com"
```

LiteLLM uses the global Microsoft endpoints for your tenant. For a sovereign cloud or a custom identity proxy, set the endpoints yourself:

```bash
MICROSOFT_AUTHORIZATION_ENDPOINT="https://login.example.com/<tenant>/oauth2/v2.0/authorize"
MICROSOFT_TOKEN_ENDPOINT="https://login.example.com/<tenant>/oauth2/v2.0/token"
MICROSOFT_USERINFO_ENDPOINT="https://graph.example.com/v1.0/me"
```

### 3. Map app roles to LiteLLM roles

LiteLLM reads the app roles from the Entra ID token. It gives the user the LiteLLM role that matches the app role value. The Entra role replaces the role that LiteLLM has in its database for that user.

1. In the app registration, open **App roles > Create app role**.
2. Set **Allowed member types** to **Users/Groups**. Set **Value** to one of the [LiteLLM roles](./access_control.md#global-proxy-roles):

   | App role value | LiteLLM role |
   |---|---|
   | `proxy_admin` | Admin |
   | `proxy_admin_viewer` | Admin Viewer |
   | `internal_user` | Internal User |
   | `internal_user_viewer` | Internal Viewer |

   <Image img={require('../../img/app_roles.png')} alt="Entra App roles page with a LiteLLM role value" style={{width: '900px', height: 'auto'}} />

3. Select **Apply**. Do these steps again for each role that you need.
4. Open **Enterprise applications**, select `LiteLLM Admin UI`, and open **Users and groups > Add user/group**.
5. Select a user or group. Under **Select a role**, select the app role, then select **Assign**.

   <Image img={require('../../img/app_role2.png')} alt="Entra Add Assignment page with a user and an app role selected" style={{width: '900px', height: 'auto'}} />

### 4. Test sign-in

1. Open a private browser window at `https://litellm.example.com/ui`.
2. Select **Login with SSO** and sign in as a test user.
3. Open the account menu. Make sure that it shows the role from the app role.

<Image img={require('../../img/app_role3.png')} alt="LiteLLM account menu that shows the role from Entra" style={{width: '900px', height: 'auto'}} />

### Optional: sync Entra groups to teams

With OIDC, LiteLLM can read the Entra groups of each user from Microsoft Graph. It creates a LiteLLM team for each group and adds the user. See [Microsoft Entra ID group sync](../tutorials/msft_sso.md).

### Optional: change the user attribute mapping

LiteLLM reads these fields from the Microsoft Graph user profile. If your tenant uses different fields, set the variables:

| Environment variable | Field | Default |
|---|---|---|
| `MICROSOFT_USER_EMAIL_ATTRIBUTE` | User email | `userPrincipalName` |
| `MICROSOFT_USER_DISPLAY_NAME_ATTRIBUTE` | Display name | `displayName` |
| `MICROSOFT_USER_ID_ATTRIBUTE` | User ID | `id` |
| `MICROSOFT_USER_FIRST_NAME_ATTRIBUTE` | First name | `givenName` |
| `MICROSOFT_USER_LAST_NAME_ATTRIBUTE` | Last name | `surname` |

To see the fields that Entra sends, use the [SSO debug routes](./admin_ui_sso.md#debugging-sso-jwt-fields). Add `https://litellm.example.com/sso/debug/callback` as a second redirect URI in the app registration.

### Troubleshooting the OIDC sign-in

**Entra shows a redirect URI error.** The redirect URI in the app registration must be `PROXY_BASE_URL` followed by `/sso/callback`. `PROXY_BASE_URL` must start with `https://`.

**The user does not get the Entra role.** Make sure that the user or group has the app role in **Enterprise applications > Users and groups**, not **Default Access**. Then sign out and sign in again.

## Related

- [Single Sign-On](./admin_ui_sso.md): settings for all providers, such as email domains, the proxy admin and fallback login
- [Other OIDC and SAML providers](./saml_sso.md): all SAML settings, environment variables and attribute mapping
- [Microsoft Entra ID group sync](../tutorials/msft_sso.md): sync Entra groups and members to LiteLLM teams through Microsoft Graph
- [SCIM with LiteLLM](../tutorials/scim_litellm.md): provision users and teams from Entra
- [Entra sign-in for Claude Desktop](./entra_id_claude_desktop.md): Claude Desktop sign-in with OIDC and JWT auth
- [Entra sign-in for Claude Code and Codex](./entra_id_cli_sso.md): Entra sign-in for Claude Code and Codex CLI
