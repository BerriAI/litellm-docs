
import Image from '@theme/IdealImage';


# SCIM with LiteLLM

✨ **Enterprise**: SCIM support requires a premium license.

Enables identity providers (Okta, Azure AD, OneLogin, etc.) to automate user and team (group) provisioning, updates, and deprovisioning on LiteLLM.


This tutorial will walk you through the steps to connect your IDP to LiteLLM SCIM Endpoints.

### Supported SSO Providers for SCIM

LiteLLM exposes standard SCIM 2.0 endpoints under `/scim/v2`, authenticated with a bearer token. Any identity provider that can provision to a generic or custom SCIM 2.0 application can connect to them:

- Microsoft Entra ID (Azure AD)
- Okta
- OneLogin

#### Providers that cannot push SCIM to LiteLLM

Google Workspace only supports automated user provisioning for applications in [Google's pre-integrated connector catalog](https://knowledge.workspace.google.com/admin/users/advanced/about-automated-user-provisioning), and LiteLLM is not in that catalog. Custom SAML apps do not get auto-provisioning, and there is no way to point Google Workspace at a custom SCIM endpoint. See [Google Workspace](#google-workspace) below for the alternatives.

Auth0 supports [inbound SCIM](https://auth0.com/docs/authenticate/protocols/scim/configure-inbound-scim) only; it can be provisioned into by an upstream identity provider, but it cannot provision outward to LiteLLM. Keycloak does not ship a stable outbound SCIM client, so provisioning to LiteLLM requires a third-party extension.


## 1. Get your SCIM Tenant URL and Bearer Token

On LiteLLM, navigate to the Settings > Admin Settings > SCIM. On this page you will create a SCIM Token, this allows your IDP to authenticate to litellm `/scim` endpoints.

<Image img={require('../../img/scim_2.png')}  style={{ width: '800px', height: 'auto' }} />

## 2. Connect your IDP to LiteLLM SCIM Endpoints

On your IDP provider, navigate to your SSO application and select `Provisioning` > `New provisioning configuration`.

On this page, paste in your litellm scim tenant url and bearer token.

Once this is pasted in, click on `Test Connection` to ensure your IDP can authenticate to the LiteLLM SCIM endpoints.

<Image img={require('../../img/scim_4.png')}  style={{ width: '800px', height: 'auto' }} />


## 3. Test SCIM Connection

### 3.1 Assign the group to your LiteLLM Enterprise App

On your IDP Portal, navigate to `Enterprise Applications` > Select your litellm app 

<Image img={require('../../img/msft_enterprise_app.png')}  style={{ width: '800px', height: 'auto' }} />

<br />
<br />

Once you've selected your litellm app, click on `Users and Groups` > `Add user/group` 

<Image img={require('../../img/msft_enterprise_assign_group.png')}  style={{ width: '800px', height: 'auto' }} />

<br />

Now select the group you created in step 1.1. And add it to the LiteLLM Enterprise App. At this point we have added `Production LLM Evals Group` to the LiteLLM Enterprise App. The next step is having LiteLLM automatically create the `Production LLM Evals Group` on the LiteLLM DB when a new user signs in.

<Image img={require('../../img/msft_enterprise_select_group.png')}  style={{ width: '800px', height: 'auto' }} />


### 3.2 Sign in to LiteLLM UI via SSO

Sign into the LiteLLM UI via SSO. You should be redirected to the Entra ID SSO page. This SSO sign in flow will trigger LiteLLM to fetch the latest Groups and Members from Azure Entra ID.

<Image img={require('../../img/msft_sso_sign_in.png')}  style={{ width: '800px', height: 'auto' }} />

### 3.3 Check the new team on LiteLLM UI

On the LiteLLM UI, Navigate to `Teams`, You should see the new team `Production LLM Evals Group` auto-created on LiteLLM. 

<Image img={require('../../img/msft_auto_team.png')}  style={{ width: '900px', height: 'auto' }} />

> **Note:** When a user is removed from your organization via SCIM, all API keys and access tokens associated with that user will be automatically deleted from LiteLLM. This ensures that removed users lose all access immediately and securely.


## Google Workspace

Google Workspace cannot provision into LiteLLM over SCIM. Google's automated user provisioning only works for applications in Google's own connector catalog, and LiteLLM is not in that catalog. Custom SAML apps do not get auto-provisioning, and the Workspace admin console has no field for a custom SCIM endpoint.

Google Workspace SSO into LiteLLM is supported; see [SSO for Admin UI](../proxy/admin_ui_sso.md). Note that this creates users on first login only. It does not populate teams from Google groups, and it does not deprovision users when they are removed from Workspace.

If you need group sync or deprovisioning with Google Workspace as your source of truth, there are two options. You can drive the SCIM endpoints yourself: `/scim/v2` is standard SCIM 2.0 with bearer-token auth, so any SCIM client can call it, including a sync job you run against the [Google Admin SDK Directory API](https://developers.google.com/workspace/admin/directory/reference/rest). Alternatively, you can federate Google Workspace behind an identity provider that supports outbound SCIM to custom endpoints, such as Microsoft Entra ID, Okta, or OneLogin, and provision to LiteLLM from there.



