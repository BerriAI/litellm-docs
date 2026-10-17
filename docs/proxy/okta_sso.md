---
title: Okta
sidebar_label: Okta
description: Set up Okta sign-in for the LiteLLM Admin UI with OIDC or SAML. Configure the Okta app, the authorization server, the access policy and LiteLLM roles.
---

import Image from '@theme/IdealImage';

# Okta

This guide connects Okta to the LiteLLM Admin UI. Users click **Login with SSO** and sign in with their Okta account.

You can connect Okta in two ways. Pick one:

| Method | Use it when | Section |
|---|---|---|
| OIDC web application | You want the most common setup, or you use Okta groups for LiteLLM teams | [Admin UI SSO with OIDC](#admin-ui-sso-with-oidc) |
| SAML 2.0 application | Your security team wants SAML for all apps | [Admin UI SSO with SAML](#admin-ui-sso-with-saml) |

To let developers sign in to Claude Code with Okta through the gateway, see [Claude Code with Okta SSO](../tutorials/claude_code_okta_sso.md).

Wherever this page shows `https://litellm.example.com`, use your gateway's public URL. Replace `<your-okta-domain>` with your Okta domain, for example `example.okta.com`.

## Admin UI SSO with OIDC

<EnterpriseFeature feature="SSO">SSO is free for up to 5 users. Beyond that, an enterprise license is required.</EnterpriseFeature>

This video shows the full setup:

<iframe width="100%" height="415" src="https://www.loom.com/embed/cac5be90f2714ceaa95d7f89cf4ac548" frameBorder="0" allowFullScreen></iframe>

### 1. Create the OIDC application

In the Okta Admin Console, create an **OIDC Web Application**. For help, see the [Okta guide to OIDC app integrations](https://help.okta.com/en-us/content/topics/apps/apps_app_integration_wizard_oidc.htm).

Set these values:

| Okta field | Value |
|---|---|
| Sign-in redirect URI | `https://litellm.example.com/sso/callback` |
| Sign-out redirect URI (optional) | `https://litellm.example.com` |

<Image img={require('../../img/okta_redirect_uri.png')} alt="Okta app settings with the LiteLLM sign-in redirect URI" />

After you create the app, open the **General** tab. Copy the **Client ID** and the **Client Secret**.

<Image img={require('../../img/okta_client_credentials.png')} alt="Okta General tab with the client ID and client secret" />

### 2. Assign users

Open the **Assignments** tab of the app. Assign the users or groups that can sign in to LiteLLM.

If **Federation Broker Mode** is on, Okta does not let you assign users. Turn it off, then assign the users.

### 3. Set the environment variables

Okta has two types of authorization server. Only the endpoint URLs are different.

The **Org Authorization Server** is available on all Okta plans:

```bash
GENERIC_CLIENT_ID="<your-client-id>"
GENERIC_CLIENT_SECRET="<your-client-secret>"
GENERIC_AUTHORIZATION_ENDPOINT="https://<your-okta-domain>/oauth2/v1/authorize"
GENERIC_TOKEN_ENDPOINT="https://<your-okta-domain>/oauth2/v1/token"
GENERIC_USERINFO_ENDPOINT="https://<your-okta-domain>/oauth2/v1/userinfo"
PROXY_BASE_URL="https://litellm.example.com"
```

A **Custom Authorization Server** needs the Okta API Access Management SKU:

```bash
GENERIC_CLIENT_ID="<your-client-id>"
GENERIC_CLIENT_SECRET="<your-client-secret>"
GENERIC_AUTHORIZATION_ENDPOINT="https://<your-okta-domain>/oauth2/default/v1/authorize"
GENERIC_TOKEN_ENDPOINT="https://<your-okta-domain>/oauth2/default/v1/token"
GENERIC_USERINFO_ENDPOINT="https://<your-okta-domain>/oauth2/default/v1/userinfo"
PROXY_BASE_URL="https://litellm.example.com"
```

:::tip
Okta lists all OAuth endpoints at `https://<your-okta-domain>/.well-known/openid-configuration`.
:::

### 4. Add an access policy (Custom Authorization Server only)

A Custom Authorization Server needs an access policy. Without it, Okta returns a `no_matching_policy` error. If you use the Org Authorization Server, skip this step.

1. Open **Security > API**.

   <Image img={require('../../img/okta_security_api.png')} alt="Okta Admin Console with the Security menu open and API selected" />

2. Select the **default** authorization server, or your custom server.

   <Image img={require('../../img/okta_authorization_server.png')} alt="Okta Authorization Servers list with the default server" />

3. Open the **Access Policies** tab. Create a policy and assign it to your LiteLLM app.
4. Add a rule that allows the **Authorization Code** grant type.

   <Image img={require('../../img/okta_access_policies.png')} alt="Okta access policy rule that allows the Authorization Code grant type" />

For more information, see the [Okta access policy documentation](https://help.okta.com/en-us/content/topics/security/api-access-management/access-policies.htm).

### 5. Set the security options

Set `GENERIC_CLIENT_STATE` to a random string. Okta then checks the state value, which helps to stop CSRF attacks.

```bash
GENERIC_CLIENT_STATE="<random-string>"
```

If your Okta app needs PKCE (Proof Key for Code Exchange), turn it on in LiteLLM. LiteLLM then makes and checks the PKCE values during sign-in.

```bash
GENERIC_CLIENT_USE_PKCE="true"
```

### 6. Test sign-in

1. Restart the proxy.
2. Open a private browser window at `https://litellm.example.com/ui`.
3. Select **Login with SSO** and sign in with Okta.
4. Make sure that Okta sends you back to the LiteLLM dashboard.

### Optional: set roles and teams from Okta

To set the LiteLLM role from Okta, add a claim that holds a LiteLLM role value. Then set `GENERIC_USER_ROLE_ATTRIBUTE` to the claim name. See [Generic OIDC](./saml_sso.md#generic-oidc) for the role values.

To add users to LiteLLM teams from their Okta groups, add a `groups` claim. Then set `team_ids_jwt_field`. See [Auto-add SSO users to teams](./admin_ui_sso.md#auto-add-sso-users-to-teams-oidc).

### Troubleshooting the OIDC sign-in

| Error | Cause | Fix |
|---|---|---|
| `redirect_uri` error | Okta does not have the LiteLLM redirect URI | Add `https://litellm.example.com/sso/callback` to the **Sign-in redirect URIs**. Make sure that `PROXY_BASE_URL` starts with `https://`. |
| `access_denied` | Okta did not assign the user to the app | Assign the user in the **Assignments** tab |
| `no_matching_policy` | The Custom Authorization Server has no access policy | Add an access policy. See [step 4](#4-add-an-access-policy-custom-authorization-server-only). |

## Admin UI SSO with SAML

<EnterpriseFeature feature="SSO">SSO is free for up to 5 users. Beyond that, an enterprise license is required.</EnterpriseFeature>

### 1. Create the SAML application

1. In the Okta Admin Console, open **Applications > Create App Integration** and select **SAML 2.0**.
2. On the **General Settings** page, enter a name for the app, for example `LiteLLM Admin UI`.
3. On the **Configure SAML** page, enter these values:

   | Okta field | Value |
   |---|---|
   | Single sign-on URL | `https://litellm.example.com/sso/saml/callback` |
   | Audience URI (SP Entity ID) | `https://litellm.example.com/sso/saml/metadata` |
   | Name ID format | EmailAddress |

4. Under **Attribute Statements**, add these attributes:

   | Name | Value |
   |---|---|
   | `email` | `user.email` |
   | `firstName` | `user.firstName` |
   | `lastName` | `user.lastName` |

To set the LiteLLM role from Okta, add an attribute named `role`. Its value must be `proxy_admin`, `proxy_admin_viewer`, `internal_user` or `internal_user_viewer`.

### 2. Connect LiteLLM to Okta

1. In the Okta app, open the **Sign On** tab. Copy the **Metadata URL**. It looks like `https://<your-okta-domain>/app/abc123/sso/saml/metadata`.
2. Set these variables on the proxy, then restart it:

   ```bash
   SAML_IDP_METADATA_URL="https://<your-okta-domain>/app/abc123/sso/saml/metadata"
   PROXY_BASE_URL="https://litellm.example.com"
   ```

You can also enter these values in **Admin Settings > SSO Settings**. For all SAML settings, see [Other OIDC and SAML providers](./saml_sso.md#saml-20).

### 3. Assign users and test

1. In the **Assignments** tab of the Okta app, assign the users or groups that can sign in to LiteLLM.
2. Open a private browser window at `https://litellm.example.com/ui`.
3. Select **Login with SSO** and sign in with Okta.

## Related

- [Single Sign-On](./admin_ui_sso.md): settings for all providers, such as email domains, the proxy admin and fallback login
- [Other OIDC and SAML providers](./saml_sso.md): all OIDC and SAML settings
- [SCIM with LiteLLM](../tutorials/scim_litellm.md): provision users and teams from Okta
- [Claude Code with Okta SSO](../tutorials/claude_code_okta_sso.md): Okta sign-in for Claude Code through the gateway
