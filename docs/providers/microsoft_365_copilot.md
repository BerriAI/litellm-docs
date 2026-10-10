import Image from '@theme/IdealImage';

# Microsoft 365 Copilot

Use Microsoft 365 Copilot through LiteLLM to ask questions about your Microsoft 365 data. Copilot uses the signed-in user's permissions to access that data.

This guide shows administrators how to set up Microsoft Entra ID and LiteLLM, then shows users how to sign in and send a request. LiteLLM exchanges each user's Entra access token for a Microsoft Graph access token. Microsoft calls this the [on-behalf-of (OBO) flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-on-behalf-of-flow).

## Before you start

You need:

- A Microsoft 365 Copilot license for each user.
- Access to register an app in Microsoft Entra ID and grant admin consent.
- A running LiteLLM proxy with dashboard access and [JWT authentication](../proxy/token_auth.md), an enterprise feature.

## 1. Register an app in Microsoft Entra ID

### Create the app and client secret

In the [Microsoft Entra admin center](https://entra.microsoft.com), open **App registrations** > **New registration**. Select **Accounts in this organizational directory only**, then register the app. Copy the **Application (client) ID** and **Directory (tenant) ID** from its overview page. See Microsoft's [app registration guide](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app).

Open **Certificates & secrets** > **New client secret**. Create a secret and copy its **Value** immediately; Entra only shows it once. Keep it for the LiteLLM credential. See Microsoft's [client credentials guide](https://learn.microsoft.com/en-us/entra/identity-platform/how-to-add-credentials).

### Add Microsoft Graph permissions

Open **API permissions** > **Add a permission** > **Microsoft Graph** > **Delegated permissions**. Add all seven permissions required by the [Copilot Chat API](https://learn.microsoft.com/en-us/microsoft-365-copilot/extensibility/api/ai-services/chat/copilotconversation-chat):

```text
Sites.Read.All
Mail.Read
People.Read.All
OnlineMeetingTranscript.Read.All
Chat.Read
ChannelMessage.Read.All
ExternalItem.Read.All
```

Also add `openid`, `profile`, and `offline_access`. Select **Grant admin consent** for your tenant. See Microsoft's [API permission guide](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-configure-app-access-web-apis).

<div className="docs-screenshot">
  <Image img={require('../../img/m365_copilot_entra_api_permissions.png')} alt="Microsoft Graph delegated permissions in Microsoft Entra" width={1720} height={960} />
</div>

### Create a scope for users to sign in

Open **Expose an API**. Set **Application ID URI** to `api://<app-client-id>`. Select **Add a scope**, name it `access_as_user`, and allow admins and users to consent. See Microsoft's [Expose an API guide](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-configure-app-expose-web-apis).

<div className="docs-screenshot">
  <Image img={require('../../img/m365_copilot_entra_expose_api.png')} alt="The access_as_user scope in Microsoft Entra's Expose an API settings" width={1740} height={640} />
</div>

Open **Manifest**, set `api.requestedAccessTokenVersion` to `2`, and save. The proxy configuration below expects [v2 access tokens](https://learn.microsoft.com/en-us/entra/identity-platform/access-tokens).

### Configure client sign-in

Open **Authentication** > **Add a platform**. Choose the platform your app uses and add the exact redirect URI from its sign-in settings. See Microsoft's [redirect URI guide](https://learn.microsoft.com/en-us/entra/identity-platform/reply-url).

The screenshot shows a desktop app example. Use your app's redirect URI.

<div className="docs-screenshot">
  <Image img={require('../../img/m365_copilot_entra_redirect_uris.png')} alt="Desktop app redirect URIs in Microsoft Entra authentication settings" width={1720} height={980} />
</div>

## 2. Add the model in LiteLLM

In the LiteLLM dashboard, open **Models + Endpoints** > **Add Model**. Select **Microsoft 365 Copilot** as the provider and `chat` as the model. Set **Public Model Name** to `m365-copilot`; use this name in client requests.

Select **OAuth token exchange (on-behalf-of)** as the **Auth Type**, then select **Create credential**.

<div className="docs-screenshot">
  <Image img={require('../../img/m365_copilot_litellm_add_model.png')} alt="Add a Microsoft 365 Copilot model in LiteLLM" width={1001} height={940} />
</div>

Enter these values:

| Field | Value |
| --- | --- |
| **Credential Name** | `m365-copilot-obo` |
| **Token Endpoint URL** | `https://login.microsoftonline.com/<tenant-id>/oauth2/v2.0/token` |
| **Exchange Grant** | `jwt_bearer_obo` |
| **Client ID** | The app's Application (client) ID |
| **Client Secret** | The client secret value you saved |
| **Scope** | `https://graph.microsoft.com/.default` |
| **Audience** | Leave blank |

<div className="docs-screenshot">
  <Image img={require('../../img/m365_copilot_litellm_credential.png')} alt="Microsoft 365 Copilot token exchange credential in LiteLLM" width={600} height={1070} />
</div>

Select **Add Credential**, select the saved credential on the model form, then select **Add Model**.

## 3. Configure the proxy to accept Entra access tokens

Set these environment variables on the proxy. Replace `<tenant-id>` and `<app-client-id>` with the IDs from step 1:

```bash
export JWT_PUBLIC_KEY_URL="https://login.microsoftonline.com/<tenant-id>/discovery/v2.0/keys"
export JWT_AUDIENCE="<app-client-id>"
export JWT_ISSUER="https://login.microsoftonline.com/<tenant-id>/v2.0"
```

Add this to your proxy's `config.yaml`, then restart the proxy:

```yaml
general_settings:
  enable_jwt_auth: true
  litellm_jwtauth:
    user_id_jwt_field: oid
    user_email_jwt_field: preferred_username
    user_id_upsert: true

litellm_settings:
  drop_params: true
```

`drop_params: true` removes unsupported parameters, such as tools or temperature, from requests across the proxy. Copilot does not support tool calling, and LiteLLM ignores `max_tokens` for this provider.

## 4. Connect your app

Sign in through your client and request the scope `api://<app-client-id>/access_as_user`. Send the resulting **access token** to LiteLLM. An ID token cannot complete the on-behalf-of exchange

### Configure your app

Use an app that supports the OpenAI-compatible API and lets you set a custom API base URL and bearer token. Enter these settings:

| Setting | Value |
| --- | --- |
| API base URL | `https://litellm.example.com/v1`, using your proxy's address |
| Model | `m365-copilot`, or the public model name you set in step 2 |
| API key or bearer token | The user's Entra access token |

If your app supports OpenID Connect (OIDC) sign-in and can send the resulting access token, set the issuer URL to `https://login.microsoftonline.com/<tenant-id>/v2.0` and the client ID to the Entra app's client ID. Request these scopes:

```text
openid profile email offline_access api://<app-client-id>/access_as_user
```

Sign in with your Microsoft account, then send a prompt such as “Summarize my latest meeting.” If your app does not support sign-in, get an access token with MSAL as shown below.

### Python example

Use [Microsoft Authentication Library (MSAL)](https://learn.microsoft.com/en-us/entra/msal/python/getting-started/acquiring-tokens#acquire-token-interactive) to sign in and get an access token for the same scope. For MSAL interactive sign-in, add the redirect URI that MSAL uses as a **Mobile and desktop applications** redirect URI in Entra

Pass the access token as the API key when you call LiteLLM with the OpenAI Python SDK:

```python
from openai import OpenAI

client = OpenAI(
    api_key="<entra-access-token>",
    base_url="https://litellm.example.com/v1",
)

response = client.chat.completions.create(
    model="m365-copilot",
    messages=[{"role": "user", "content": "Summarize my latest meeting"}],
)
print(response.choices[0].message.content)
```

## Optional configuration

### Add email or group claims

If your proxy uses email or group claims, add them under **Token configuration**. Select the **Access token** type for the optional `email` claim, and add `groups` only if your proxy uses it. See Microsoft's [optional claims guide](https://learn.microsoft.com/en-us/entra/identity-platform/optional-claims).

<div className="docs-screenshot">
  <Image img={require('../../img/m365_copilot_entra_token_configuration.png')} alt="Optional token claims in Microsoft Entra" width={1740} height={900} />
</div>

### Add the model with a configuration file

If you manage models in `config.yaml`, reference the credential you saved in step 2:

```yaml
model_list:
  - model_name: m365-copilot
    litellm_params:
      model: microsoft_365_copilot/chat
      litellm_credential_name: m365-copilot-obo
```

### Credential fields

LiteLLM reads token exchange settings from the saved credential. Clients cannot set them in requests.

| Field | Purpose |
| --- | --- |
| `token_exchange_endpoint` | Entra token endpoint |
| `token_exchange_profile` | Exchange type; defaults to `jwt_bearer_obo`. Also supports `rfc8693`. |
| `client_id` | Entra app's client ID |
| `client_secret` | Entra app's client secret |
| `token_exchange_scope` | Defaults to `https://graph.microsoft.com/.default` |
| `token_exchange_audience` | Optional; applies only to `rfc8693` |

### Use a static access token

You can set `api_key` to a Microsoft Graph delegated access token instead of using token exchange. LiteLLM uses that token for every caller and does not refresh it. Replace it when it expires.

## How requests work

LiteLLM calls the Microsoft Graph beta Copilot Chat API. Microsoft chooses the model. LiteLLM lists token costs as `$0` because Microsoft bills Copilot by license.

LiteLLM sends the last user message as the prompt and all other messages, in order, as context. If Graph returns the same reply twice in a row, LiteLLM removes the duplicate only when both copies match exactly.

Each proxy worker caches exchanged access tokens in memory until 60 seconds before they expire. LiteLLM does not store refresh tokens.

## Troubleshooting

| Problem | What to do |
| --- | --- |
| Entra returns `AADSTS240002` | Send an access token for `api://<app-client-id>/access_as_user`. Check that your client is not sending an ID token. |
| A connection test says it requires the caller's access token | Test with the user's Entra access token in the `Authorization` header. A dashboard session alone cannot complete the exchange |
| Token audience or issuer does not match | Check that the app issues v2 access tokens. The token's `aud` must match `JWT_AUDIENCE`, and its `iss` must match `JWT_ISSUER`. |
