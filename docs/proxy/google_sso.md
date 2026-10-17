---
title: Google Workspace
sidebar_label: Google Workspace
description: Set up Google sign-in for the LiteLLM Admin UI. Create a Google OAuth client, limit sign-in to your Workspace domain, and set LiteLLM roles and teams.
---

# Google Workspace

This guide connects Google to the LiteLLM Admin UI. Users click **Login with SSO** and sign in with their Google Workspace account.

Wherever this page shows `https://litellm.example.com`, use your gateway's public URL.

<EnterpriseFeature feature="SSO">SSO is free for up to 5 users. Beyond that, an enterprise license is required.</EnterpriseFeature>

## 1. Create the OAuth client

1. In the [Google Cloud console](https://console.cloud.google.com/), select the project for LiteLLM.
2. Open **APIs & Services > OAuth consent screen**. Set **User type** to **Internal**. Then only users in your Google Workspace organization can sign in.
3. Open **APIs & Services > Credentials > Create credentials > OAuth client ID**.
4. Set **Application type** to **Web application**, and enter a name, for example `LiteLLM Admin UI`.
5. Under **Authorized redirect URIs**, add `https://litellm.example.com/sso/callback`.
6. Select **Create**. Copy the **Client ID** and the **Client secret**.

## 2. Set the environment variables

Set these variables on the proxy, then restart it:

```bash
GOOGLE_CLIENT_ID="<your-client-id>"
GOOGLE_CLIENT_SECRET="<your-client-secret>"
PROXY_BASE_URL="https://litellm.example.com"
```

`PROXY_BASE_URL` must start with `https://`. LiteLLM adds `/sso/callback` to it to make the redirect URI.

To let only users with your email domain sign in, also set `ALLOWED_EMAIL_DOMAINS`:

```bash
ALLOWED_EMAIL_DOMAINS="example.com"
```

## 3. Test sign-in

1. Open a private browser window at `https://litellm.example.com/ui`.
2. Select **Login with SSO** and sign in with your Google account.
3. Make sure that Google sends you back to the LiteLLM dashboard.

## Roles and teams

Google does not send a role or a groups claim to LiteLLM. Set roles and teams in LiteLLM:

- To make a user a proxy admin, set `PROXY_ADMIN_ID`. See [Set the proxy admin](./admin_ui_sso.md#set-the-proxy-admin).
- To change the role of other users, open **Internal Users** in the Admin UI.
- To add users to teams, open **Teams** in the Admin UI.

## Troubleshooting

**Google shows `Error 400: redirect_uri_mismatch`.** The redirect URI in the OAuth client must be `PROXY_BASE_URL` followed by `/sso/callback`. Make sure that the protocol and the host name are the same.

**Google shows that the app is for internal users only.** The user signed in with an account outside your Workspace organization. Use a Workspace account.

## Related

- [Single Sign-On](./admin_ui_sso.md): settings for all providers, such as email domains, the proxy admin and fallback login
- [Other OIDC and SAML providers](./saml_sso.md): use a generic OIDC client for other providers
