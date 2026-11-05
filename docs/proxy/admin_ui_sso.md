import Image from '@theme/IdealImage';
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# OpenID Connect (OIDC) SSO

Configure Admin UI sign-in with OpenID Connect (OIDC), the identity layer built on OAuth 2.0. For SAML providers, use [SAML SSO](./saml_sso.md). To sign in from a terminal, see [CLI SSO](./cli_sso.md).

<EnterpriseFeature feature="SSO">From v1.76.0, SSO is free for up to 5 users. Beyond that, an enterprise license is required.</EnterpriseFeature>

Configure your identity provider below. For sign-in restrictions, role assignment, team membership, and key-creation controls, see [SSO permissions](./access_management/sso_permissions.md).

### Usage (Google, Microsoft, Okta, etc.)

<Tabs>
<TabItem value="okta" label="Okta SSO">

### Video Walkthrough

<iframe width="100%" height="415" src="https://www.loom.com/embed/cac5be90f2714ceaa95d7f89cf4ac548" frameBorder="0" allowFullScreen></iframe>

#### Step 1: Create an OIDC Application in Okta

In your Okta Admin Console, create a new **OIDC Web Application**. See [Okta's guide on creating OIDC app integrations](https://help.okta.com/en-us/content/topics/apps/apps_app_integration_wizard_oidc.htm) for detailed instructions.

When configuring the application:
- **Sign-in redirect URI**: `https://<your-proxy-base-url>/sso/callback`
- **Sign-out redirect URI** (optional): `https://<your-proxy-base-url>`

<Image img={require('../../img/okta_redirect_uri.png')} />

After creating the app, copy your **Client ID** and **Client Secret** from the application's General tab:

<Image img={require('../../img/okta_client_credentials.png')} />

#### Step 2: Assign Users to the Application

Ensure users are assigned to the app in the **Assignments** tab. If Federation Broker Mode is enabled, you may need to disable it to assign users manually.

#### Step 3: Set Environment Variables

Set the following environment variables. The only difference between the two Okta authorization servers is the endpoint URLs:

**Org Authorization Server** (available on all Okta plans, no additional SKU required):
```bash
GENERIC_CLIENT_ID="<your-client-id>"
GENERIC_CLIENT_SECRET="<your-client-secret>"
GENERIC_AUTHORIZATION_ENDPOINT="https://<your-okta-domain>/oauth2/v1/authorize"
GENERIC_TOKEN_ENDPOINT="https://<your-okta-domain>/oauth2/v1/token"
GENERIC_USERINFO_ENDPOINT="https://<your-okta-domain>/oauth2/v1/userinfo"
PROXY_BASE_URL="https://<your-proxy-base-url>"
```

**Custom Authorization Server** (requires the Okta API Access Management SKU):
```bash
GENERIC_CLIENT_ID="<your-client-id>"
GENERIC_CLIENT_SECRET="<your-client-secret>"
GENERIC_AUTHORIZATION_ENDPOINT="https://<your-okta-domain>/oauth2/default/v1/authorize"
GENERIC_TOKEN_ENDPOINT="https://<your-okta-domain>/oauth2/default/v1/token"
GENERIC_USERINFO_ENDPOINT="https://<your-okta-domain>/oauth2/default/v1/userinfo"
PROXY_BASE_URL="https://<your-proxy-base-url>"
```

:::tip
You can find all OAuth endpoints at `https://<your-okta-domain>/.well-known/openid-configuration`
:::

#### Step 3a: Configure Access Policy (Custom Authorization Server only)

If you are using the Custom Authorization Server, you must configure an Access Policy. Without it, users will get a `no_matching_policy` error. Skip this step if you are using the Org Authorization Server.

1. Go to **Security** → **API**

<Image img={require('../../img/okta_security_api.png')} />

2. Select the **default** authorization server (or your custom one)

<Image img={require('../../img/okta_authorization_server.png')} />

3. Click on **Access Policies** tab, create a new policy assigned to your LiteLLM app
4. Add a rule that allows the **Authorization Code** grant type

<Image img={require('../../img/okta_access_policies.png')} />

See [Okta's Access Policy documentation](https://help.okta.com/en-us/content/topics/security/api-access-management/access-policies.htm) for more details.

#### Step 4: Configure Okta Security Settings

**GENERIC_CLIENT_STATE** is recommended for Okta to prevent CSRF attacks:

```bash
GENERIC_CLIENT_STATE="random-string"
```

**PKCE (Proof Key for Code Exchange).** If your Okta application is configured to require PKCE, enable it by setting:

```bash
GENERIC_CLIENT_USE_PKCE="true"
```

LiteLLM will automatically handle PKCE parameter generation and verification during the OAuth flow.

#### Step 5: Test the SSO Flow

1. Start your LiteLLM proxy
2. Navigate to `https://<your-proxy-base-url>/ui`
3. Click the SSO login button
4. Authenticate with Okta and verify you're redirected back to LiteLLM

#### Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| `redirect_uri` error | Redirect URI not configured | Add `<proxy_base_url>/sso/callback` to Sign-in redirect URIs in Okta |
| `access_denied` | User not assigned to app | Assign the user in the Assignments tab |
| `no_matching_policy` | Missing Access Policy (Custom Authorization Server only) | Create an Access Policy in the Authorization Server (see Step 3a) |

</TabItem>
<TabItem value="google" label="Google SSO">

- Create a new Oauth 2.0 Client on https://console.cloud.google.com/ 

**Required .env variables on your Proxy**
```shell
# for Google SSO Login
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

- Set Redirect URL on your Oauth 2.0 Client on https://console.cloud.google.com/ 
    - Set a redirect url = `<your proxy base url>/sso/callback`
    ```shell
    https://litellm-production-7002.up.railway.app/sso/callback
    ```

</TabItem>

<TabItem value="msft" label="Microsoft SSO">

- Create a new App Registration on https://portal.azure.com/
- Create a client Secret for your App Registration

**Required .env variables on your Proxy**
```shell
MICROSOFT_CLIENT_ID="84583a4d-"
MICROSOFT_CLIENT_SECRET="nbk8Q~"
MICROSOFT_TENANT="5a39737"
```

**Optional: Custom Microsoft SSO Endpoints**

If you need to use custom Microsoft SSO endpoints (e.g., for a custom identity provider, sovereign cloud, or proxy), you can override the default endpoints:

```shell
MICROSOFT_AUTHORIZATION_ENDPOINT="https://your-custom-url.com/oauth2/v2.0/authorize"
MICROSOFT_TOKEN_ENDPOINT="https://your-custom-url.com/oauth2/v2.0/token"
MICROSOFT_USERINFO_ENDPOINT="https://your-custom-graph-api.com/v1.0/me"
```

If these are not set, the default Microsoft endpoints are used based on your tenant.

- Set Redirect URI on your App Registration on https://portal.azure.com/
    - Set a redirect url = `<your proxy base url>/sso/callback`
    ```shell
    http://localhost:4000/sso/callback
    ```

To assign LiteLLM roles from Entra ID, follow [Assign roles through Microsoft Entra ID](./access_management/sso_permissions.md#manage-user-roles-via-azure-app-roles).

**Advanced: Custom User Attribute Mapping**

For certain Microsoft Entra ID configurations, you may need to override the default user attribute field names. This is useful when your organization uses custom claims or non-standard attribute names in the SSO response.

**Step 1: Debug SSO Response**

First, inspect the JWT fields returned by your Microsoft SSO provider using the [SSO Debug Route](#debugging-sso-jwt-fields).

1. Set `ENABLE_SSO_DEBUG="true"` on the proxy and restart it (the debug routes return 404 otherwise)
2. Add `/sso/debug/callback` as a redirect URL in your Azure App Registration
3. Navigate to `https://<proxy_base_url>/sso/debug/login`
4. Complete the SSO flow to see the returned user attributes

**Step 2: Identify Field Attribute Names**

From the debug response, identify the field names used for email, display name, user ID, first name, and last name.

**Step 3: Set Environment Variables**

Override the default attribute names by setting these environment variables:

| Environment Variable | Description | Default Value |
|---------------------|-------------|---------------|
| `MICROSOFT_USER_EMAIL_ATTRIBUTE` | Field name for user email | `userPrincipalName` |
| `MICROSOFT_USER_DISPLAY_NAME_ATTRIBUTE` | Field name for display name | `displayName` |
| `MICROSOFT_USER_ID_ATTRIBUTE` | Field name for user ID | `id` |
| `MICROSOFT_USER_FIRST_NAME_ATTRIBUTE` | Field name for first name | `givenName` |
| `MICROSOFT_USER_LAST_NAME_ATTRIBUTE` | Field name for last name | `surname` |

**Step 4: Restart the Proxy**

After setting the environment variables, restart the proxy:

```bash
litellm --config /path/to/config.yaml
```

</TabItem>

<TabItem value="Generic" label="Generic SSO Provider">

A generic OAuth client that can be used to quickly create support for any OAuth provider with close to no code

**Required .env variables on your Proxy**
```shell

GENERIC_CLIENT_ID = "******"
GENERIC_CLIENT_SECRET = "G*******"
GENERIC_AUTHORIZATION_ENDPOINT = "http://localhost:9090/auth"
GENERIC_TOKEN_ENDPOINT = "http://localhost:9090/token"
GENERIC_USERINFO_ENDPOINT = "http://localhost:9090/me"
```

**Optional .env variables**
The following can be used to customize attribute names when interacting with the generic OAuth provider. We will read these attributes from the SSO Provider result

```shell
GENERIC_USER_ID_ATTRIBUTE = "sub"
GENERIC_USER_EMAIL_ATTRIBUTE = "email"
GENERIC_USER_DISPLAY_NAME_ATTRIBUTE = "display_name"
GENERIC_USER_FIRST_NAME_ATTRIBUTE = "first_name"
GENERIC_USER_LAST_NAME_ATTRIBUTE = "last_name"
GENERIC_USER_ROLE_ATTRIBUTE = "given_role"
GENERIC_USER_PROVIDER_ATTRIBUTE = "provider"
GENERIC_USER_EXTRA_ATTRIBUTES = "department,employee_id,manager" # comma-separated list of additional fields to extract from SSO response
GENERIC_CLIENT_STATE = "some-state" # if the provider needs a state parameter
GENERIC_INCLUDE_CLIENT_ID = "false" # some providers enforce that the client_id is not in the body
GENERIC_SCOPE = "openid profile email" # default scope openid is sometimes not enough to retrieve basic user info like first_name and last_name located in profile scope
```

Set `GENERIC_INCLUDE_TOKEN_CLAIMS = "true"` to also read user claims from the ID token and access token when the UserInfo response is incomplete. UserInfo claims take precedence

**Choosing `GENERIC_USER_ID_ATTRIBUTE`**

LiteLLM stores this attribute's value as the user's identity and looks the user up by it on every subsequent login, so point it at a claim your provider guarantees is unique and never changes for the lifetime of the account. `sub` is the standard OIDC claim for this. Claims that a user can edit in their own profile, such as `preferred_username`, `email`, or `name`, will change out from under LiteLLM, and the next login is then treated as a different person with a separate set of keys, teams, and spend. When `GENERIC_USER_ID_ATTRIBUTE` is unset, LiteLLM reads `preferred_username`, so set it explicitly if your provider lets users change that value.

**Assigning User Roles via SSO**

Use `GENERIC_USER_ROLE_ATTRIBUTE` to specify which attribute in the SSO token contains the user's role. Supported values are `proxy_admin`, `proxy_admin_viewer`, `internal_user`, and `internal_user_viewer`. Nested attribute paths are supported (e.g., `claims.role` or `attributes.litellm_role`). See [roles and team member permissions](./access_control.md) for what each role permits.

**Capturing Additional SSO Fields**

Use `GENERIC_USER_EXTRA_ATTRIBUTES` to extract additional fields from the SSO provider response beyond the standard user attributes (id, email, name, etc.). This is useful when you need to access custom organization-specific data (e.g., department, employee ID, groups) in your [custom SSO handler](./custom_sso.md).

For **CLI SSO**, you can map the same (or other) claims into user `metadata` and return scalars to the CLI via `CLI_SSO_CLAIM_MAP`. See [CLI Authentication](./cli_sso.md#attribution-metadata-oidc-claims).

```shell
# Comma-separated list of field names to extract
GENERIC_USER_EXTRA_ATTRIBUTES="department,employee_id,manager,groups"
```

**Accessing Extra Fields in Custom SSO Handler:**

```python
from litellm.proxy.management_endpoints.types import CustomOpenID

async def custom_sso_handler(userIDPInfo: CustomOpenID):
    # Access the extra fields
    extra_fields = getattr(userIDPInfo, 'extra_fields', None) or {}
    
    user_department = extra_fields.get("department")
    employee_id = extra_fields.get("employee_id")
    user_groups = extra_fields.get("groups", [])
    
    # Use these fields for custom logic (e.g., team assignment, access control)
    # ...
```

**Nested Field Paths:**

Dot notation is supported for nested fields:

```shell
GENERIC_USER_EXTRA_ATTRIBUTES="org_info.department,org_info.cost_center,metadata.employee_type"
```

- Set Redirect URI, if your provider requires it
    - Set a redirect url = `<your proxy base url>/sso/callback`
    ```shell
    http://localhost:4000/sso/callback
    ```

</TabItem>

</Tabs>

### Default Login, Logout URLs

Some SSO providers require a specific redirect url for login and logout. You can input the following values.

- Login: `<your-proxy-base-url>/sso/key/generate`
- Logout: `<your-proxy-base-url>`

Here's the env var to set the logout url on the proxy
```bash
PROXY_LOGOUT_URL="https://www.google.com"
```

#### Step 3. Set `PROXY_BASE_URL` in your .env

Set this in your .env (so the proxy can set the correct redirect url)
```shell
PROXY_BASE_URL=https://your-proxy-domain.com
```

#### Step 4. Test flow
<Image img={require('../../img/litellm_ui_3.gif')} />

### Manage SSO permissions

Set [email-domain restrictions](./access_management/sso_permissions.md#restrict-email-subdomains-w-sso), [UI restrictions](./access_management/sso_permissions.md#restrict-ui-access), or a [proxy admin](./access_management/sso_permissions.md#set-proxy-admin) in Access Management. You can also [add users to teams from OIDC claims](./access_management/sso_permissions.md#auto-add-sso-users-to-teams-oidc) and [restrict personal key creation](./access_management/sso_permissions.md#restrict-personal-key-creation).

### Use Username, Password when SSO is on

If you need to access the UI via username/password when SSO is on navigate to `/fallback/login`. This route will allow you to sign in with your username/password credentials.

### Custom Branding Admin UI

Use your companies custom branding on the LiteLLM Admin UI
We allow you to 
- Customize the UI Logo
- Customize the UI color scheme
<Image img={require('../../img/litellm_custom_ai.png')} />

#### Set Custom Logo
We allow you to pass a local image or a an http/https url of your image

Set `UI_LOGO_PATH` on your env. We recommend using a hosted image, it's a lot easier to set up and configure / debug

Example setting Hosted image
```shell
UI_LOGO_PATH="https://litellm-logo-aws-marketplace.s3.us-west-2.amazonaws.com/berriai-logo-github.png"
```

Example setting a local image (on your container)
```shell
UI_LOGO_PATH="ui_images/logo.jpg"
```

#### Or set your logo directly from Admin UI:
<div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
  <Image img={require('../../img/admin_settings_ui_theme.png')} />
  <Image img={require('../../img/admin_settings_ui_theme_logo.png')} />
</div>

#### Set Custom Color Theme
- Navigate to [/enterprise/enterprise_ui](https://github.com/BerriAI/litellm/blob/main/enterprise/enterprise_ui/_enterprise_colors.json)
- Inside the `enterprise_ui` directory, rename `_enterprise_colors.json` to `enterprise_colors.json`
- Set your companies custom color scheme in `enterprise_colors.json`
Example contents of `enterprise_colors.json` 
Set your colors to any of the following colors: https://www.tremor.so/docs/layout/color-palette#default-colors
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
- Deploy LiteLLM Proxy Server

## Troubleshooting

### "The 'redirect_uri' parameter must be a Login redirect URI in the client app settings" Error

This error commonly occurs with Okta and other SSO providers when the redirect URI configuration is incorrect.

#### Issue
```
Your request resulted in an error. The 'redirect_uri' parameter must be a Login redirect URI in the client app settings
```

#### Solution

**1. Ensure you have set PROXY_BASE_URL in your .env and it includes protocol**

Make sure your `PROXY_BASE_URL` includes the complete URL with protocol (`http://` or `https://`):

```bash
# ✅ Correct - includes https://
PROXY_BASE_URL=https://litellm.platform.com

# ✅ Correct - includes http://
PROXY_BASE_URL=http://litellm.platform.com

# ❌ Incorrect - missing protocol
PROXY_BASE_URL=litellm.platform.com
```

**2. For Okta specifically, ensure `GENERIC_CLIENT_STATE` is set and PKCE is configured if required**

See [Okta SSO, Step 4: Configure Okta Security Settings](#step-4-configure-okta-security-settings) for details on `GENERIC_CLIENT_STATE` and PKCE configuration.

### Common Configuration Issues

#### Missing Protocol in Base URL
```bash
# This will cause redirect_uri errors
PROXY_BASE_URL=mydomain.com

# Fix: Add the protocol
PROXY_BASE_URL=https://mydomain.com
```

### Fallback Login

If you need to access the UI via username/password when SSO is on navigate to `/fallback/login`. This route will allow you to sign in with your username/password credentials.

This also works when `disable_env_credential_login` is on, for any database user with a password. To keep a shared admin account for SSO outages, see [Keep a break-glass admin account for SSO outages](./ui.md#keep-a-break-glass-admin-account-for-sso-outages).

<Image img={require('../../img/fallback_login.png')} />


### Debugging SSO JWT fields 

If you need to inspect the JWT fields received from your SSO provider by LiteLLM, follow these instructions. This guide walks you through setting up a debug callback to view the JWT data during the SSO process.


<Image img={require('../../img/debug_sso.png')}  style={{ width: '500px', height: 'auto' }} />
<br />

1. Enable the debug routes on the proxy

  The debug routes are disabled by default and return 404. Set the following environment variable and restart the proxy (unset it again once you are done debugging):

  ```bash showLineNumbers title="Environment variable"
  ENABLE_SSO_DEBUG="true"
  ```

2. Add `/sso/debug/callback` as a redirect URL in your SSO provider 

  In your SSO provider's settings, add the following URL as a new redirect (callback) URL:

  ```bash showLineNumbers title="Redirect URL"
  http://<proxy_base_url>/sso/debug/callback
  ```


3. Navigate to the debug login page on your browser 

    Navigate to the following URL on your browser:

    ```bash showLineNumbers title="URL to navigate to"
    https://<proxy_base_url>/sso/debug/login
    ```

    This will initiate the standard SSO flow. You will be redirected to your SSO provider's login screen, and after successful authentication, you will be redirected back to LiteLLM's debug callback route.


4. View the JWT fields 

Once redirected, you should see a page called "SSO Debug Information". This page displays the JWT fields received from your SSO provider (as shown in the image above)
