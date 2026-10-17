---
title: Single Sign-On
sidebar_label: Overview
description: Let users sign in to the LiteLLM Admin UI with your identity provider. Pick a provider guide, then set the options that apply to all providers, such as email domains, the proxy admin, teams and fallback login.
---

import Image from '@theme/IdealImage';

# Single Sign-On

Single sign-on (SSO) lets users sign in to the LiteLLM Admin UI with your identity provider (IdP). After sign-in, users can see their teams, create virtual keys and look at their spend.

<EnterpriseFeature feature="SSO">From v1.76.0, SSO is free for up to 5 users. Beyond that, an enterprise license is required.</EnterpriseFeature>

## Set up your provider

Start with the guide for your IdP:

| Provider | Protocol | Guide |
|---|---|---|
| Microsoft Entra ID | SAML or OIDC | [Microsoft Entra ID](./entra_id_sso.md) |
| Okta | OIDC or SAML | [Okta](./okta_sso.md) |
| Google Workspace | OIDC | [Google Workspace](./google_sso.md) |
| Other providers, for example Keycloak, Auth0 or Ping | OIDC or SAML | [Other OIDC and SAML providers](./saml_sso.md) |

You can set most providers with environment variables, or in the Admin UI at **Admin Settings > SSO Settings**.

The rest of this page shows the options that apply to all providers.

## Set the proxy base URL

LiteLLM uses `PROXY_BASE_URL` to make the redirect URLs that it sends to the IdP. Set it to the public URL of the proxy, with the protocol:

```bash
PROXY_BASE_URL="https://litellm.example.com"
```

If you do not include `https://` or `http://`, the IdP rejects the redirect URI.

## Login and logout URLs

Some IdPs ask for a login URL and a logout URL. Use these values:

- Login: `https://litellm.example.com/sso/key/generate`
- Logout: `https://litellm.example.com`

To send users to a different page after they sign out, set `PROXY_LOGOUT_URL`:

```bash
PROXY_LOGOUT_URL="https://intranet.example.com"
```

This animation shows the sign-in flow:

<Image img={require('../../img/litellm_ui_3.gif')} alt="LiteLLM Admin UI sign-in with SSO" />

## Limit sign-in to email domains

To let only users with specified email domains sign in, set `ALLOWED_EMAIL_DOMAINS`. Use a comma-separated list without spaces:

```bash
ALLOWED_EMAIL_DOMAINS="example.com,example.org"
```

LiteLLM compares the part of the email address after `@` with each domain. The match must be exact, so `example.com` does not let `dev.example.com` sign in.

## Set the proxy admin

With SSO, LiteLLM gets the `user_id` of each user from the IdP. To make a user a proxy admin, set that ID in `PROXY_ADMIN_ID`.

1. Sign in with SSO. Copy your user ID from the Admin UI.

   <Image img={require('../../img/litellm_ui_copy_id.png')} alt="LiteLLM Admin UI with the user ID to copy" />

2. Set the ID on the proxy, then restart it:

   ```bash
   PROXY_ADMIN_ID="116544810872468347480"
   ```

3. Sign in again. You can now see all keys on the proxy.

   <Image img={require('../../img/litellm_ui_admin.png')} alt="LiteLLM Admin UI that shows the keys of all users" />

LiteLLM sets the role of this user to `proxy_admin` in the `LiteLLM_UserTable`. If you change the ID later, change the role of the old user with `/user/update` or on the **Internal Users** page.

If you do not see all keys, your browser can have an old token. Sign out and sign in again.

Some IdPs can also send the LiteLLM role of each user. See the guide for your provider.

## Auto-add SSO users to teams (OIDC)

For OIDC providers, LiteLLM can read team IDs from a claim in the IdP token. At each sign-in, LiteLLM adds the user to each team that matches.

1. Set the claim that holds the team IDs:

   ```yaml showLineNumbers title="config.yaml"
   general_settings:
     master_key: os.environ/LITELLM_MASTER_KEY
     litellm_jwtauth:
       team_ids_jwt_field: "groups" # dot notation works for nested claims, for example "resource_access.myapp.groups"
   ```

   This example expects a token like this one:

   ```json
   {
     "groups": ["team_id_1", "team_id_2"]
   }
   ```

   To see the claims that your IdP sends, use the [SSO debug routes](#debugging-sso-jwt-fields).

2. Create a LiteLLM team for each value. The `team_id` must be the same as the value in the claim. LiteLLM does not create teams from OIDC claims, and it skips values that do not match a team.

   ```bash showLineNumbers title="Create a team with a team_id that matches the group value"
   curl -X POST 'https://litellm.example.com/team/new' \
   -H 'Authorization: Bearer <PROXY_MASTER_KEY>' \
   -H 'Content-Type: application/json' \
   -d '{
       "team_alias": "team_1",
       "team_id": "team_id_1"
   }'
   ```

3. Sign in with SSO. On the **Internal Users** page, make sure that the user is a member of the teams. This [video](https://www.loom.com/share/8959be458edf41fd85937452c29a33f3?sid=7ebd6d37-569a-4023-866e-e0cde67cb23e) shows the flow.

Some IdPs put the groups claim only in the access token, not in the userinfo response. For these IdPs, set the claim in `ui_access_mode`. LiteLLM then also decodes the access token. This setting also lets only members of the given group sign in:

```yaml showLineNumbers title="config.yaml"
general_settings:
  ui_access_mode:
    type: "restricted_sso_group"
    restricted_sso_group: "<group that can use the UI>"
    sso_group_jwt_field: "groups"
```

Other methods:

- For Microsoft Entra ID with OIDC, LiteLLM reads groups from Microsoft Graph. See [Microsoft Entra ID group sync](../tutorials/msft_sso.md).
- For SAML, LiteLLM reads team IDs from an assertion attribute. See [SAML attribute mapping](./saml_sso.md#attribute-mapping).

## Restrict personal key creation

To stop users from creating personal keys (keys with no team), set `key_generation_settings`. LiteLLM applies this setting on `/key/generate`, so it applies to the Admin UI and to API calls.

```yaml
litellm_settings:
  key_generation_settings:
    personal_key_generation:
      allowed_user_roles: ["proxy_admin"]
```

For all options, see [Restricting key generation](./virtual_keys.md#restricting-key-generation).

## Restrict UI access to admins

To let only admins use the UI, set `ui_access_mode` to `admin_only`. Admins are users with the `proxy_admin` role and the `proxy_admin_viewer` role. Admin viewers can see the spend of all users.

```yaml
general_settings:
  ui_access_mode: "admin_only"
```

Then invite users that must see the spend as admin viewers:

<Image img={require('../../img/admin_ui_viewer.png')} alt="LiteLLM invite user form with the Admin Viewer role" />

## Fallback login

With SSO on, you can still sign in with a username and password. Open `https://litellm.example.com/fallback/login`.

<Image img={require('../../img/fallback_login.png')} alt="LiteLLM fallback login page with username and password fields" />

## Custom branding

You can change the logo and the colors of the Admin UI.

<Image img={require('../../img/litellm_custom_ai.png')} alt="LiteLLM Admin UI with a custom logo" />

### Set a custom logo

Set `UI_LOGO_PATH` to an `http` or `https` URL, or to a file in the container. A hosted image is easier to set up and debug.

```bash
# Hosted image
UI_LOGO_PATH="https://litellm-logo-aws-marketplace.s3.us-west-2.amazonaws.com/berriai-logo-github.png"

# File in the container
UI_LOGO_PATH="ui_images/logo.jpg"
```

You can also set the logo in the Admin UI:

<div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
  <Image img={require('../../img/admin_settings_ui_theme.png')} alt="LiteLLM Admin Settings with the UI Theme tab" />
  <Image img={require('../../img/admin_settings_ui_theme_logo.png')} alt="LiteLLM UI Theme form with the logo URL field" />
</div>

### Set a custom color theme

1. Open the [enterprise_ui directory](https://github.com/BerriAI/litellm/blob/main/enterprise/enterprise_ui/_enterprise_colors.json).
2. Change the name of `_enterprise_colors.json` to `enterprise_colors.json`.
3. Set your colors in `enterprise_colors.json`. You can use the [Tremor default colors](https://www.tremor.so/docs/layout/color-palette#default-colors).

   ```json
   {
       "brand": {
         "DEFAULT": "teal",
         "faint": "teal",
         "muted": "teal",
         "subtle": "teal",
         "emphasis": "teal",
         "inverted": "teal"
       }
   }
   ```

4. Deploy the LiteLLM proxy.

## Troubleshooting

### The IdP shows a `redirect_uri` error

The IdP can show this message:

```
Your request resulted in an error. The 'redirect_uri' parameter must be a Login redirect URI in the client app settings
```

To fix it:

1. Make sure that `PROXY_BASE_URL` starts with `https://` or `http://`.

   ```bash
   # Correct
   PROXY_BASE_URL=https://litellm.example.com

   # Incorrect: no protocol
   PROXY_BASE_URL=litellm.example.com
   ```

2. Make sure that the redirect URI in the IdP is `PROXY_BASE_URL` followed by `/sso/callback`. For SAML, use `/sso/saml/callback`.
3. For Okta, set `GENERIC_CLIENT_STATE`, and turn on PKCE if your Okta app needs it. See [Okta](./okta_sso.md#5-set-the-security-options).

### Debugging SSO JWT fields

You can see the fields that LiteLLM gets from your IdP. Use the SSO debug routes.

<Image img={require('../../img/debug_sso.png')} alt="LiteLLM SSO Debug Information page with the fields from the IdP" style={{ width: '500px', height: 'auto' }} />

1. Turn on the debug routes. They return 404 by default. Set this variable and restart the proxy:

   ```bash showLineNumbers title="Environment variable"
   ENABLE_SSO_DEBUG="true"
   ```

2. In your IdP, add this URL as a redirect URL:

   ```bash showLineNumbers title="Redirect URL"
   https://litellm.example.com/sso/debug/callback
   ```

3. In your browser, open this URL:

   ```bash showLineNumbers title="URL to open"
   https://litellm.example.com/sso/debug/login
   ```

   The IdP sign-in page opens. After you sign in, the IdP sends you back to the LiteLLM debug page.

4. The **SSO Debug Information** page shows the fields from your IdP.

When you finish, remove `ENABLE_SSO_DEBUG` and restart the proxy.

## Related

- [Identity overview](./identity_overview.md): compare SSO, SCIM, group-to-team mapping and JWT auth
- [Event hooks for SSO login](./custom_sso.md): run your own code when a user signs in
- [CLI authentication](./cli_sso.md): let developers get a LiteLLM key from the terminal with SSO
