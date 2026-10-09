import Image from '@theme/IdealImage';

# Microsoft 365 Copilot

LiteLLM sends chat requests to the Microsoft Graph beta Copilot Chat API. Graph creates a conversation at `/beta/copilot/conversations` and receives the prompt at `/beta/copilot/conversations/{id}/chat`. This integration is not a Microsoft Foundry model. The API has no model parameter, so Microsoft selects the model. Copilot answers with the signed-in user's Microsoft 365 data and permissions. Each user needs a Microsoft 365 Copilot license

Use the LiteLLM model name `microsoft_365_copilot/chat`. Its input and output costs are listed as `$0` because Copilot is billed by license, not by token

## Limitations

The Graph API does not accept tools, temperature, or `max_tokens`. LiteLLM accepts `max_tokens` but drops it before sending the request to Graph. Clients such as Claude Code may send tools, so set `drop_params: true` in proxy configuration to drop unsupported parameters

LiteLLM sends the last `user` message as the Graph prompt. Every other message, before or after it, is passed in order as additional context. If Graph returns the same reply twice in a row, LiteLLM collapses it only when both copies are exactly identical

## Authentication

The default authentication type is OAuth token exchange (on-behalf-of), described in [Microsoft's OBO flow documentation](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-on-behalf-of-flow). LiteLLM also supports a static delegated access token. The OAuth exchange profile defaults to `jwt_bearer_obo`; `rfc8693` is also supported

OAuth exchange settings are server-owned credential fields and cannot come from a request. Create an LLM credential in the dashboard and reference it from a deployment with `litellm_credential_name`

Configure these fields on the OAuth token exchange credential:

| `litellm_params` field | Purpose |
| --- | --- |
| `token_exchange_endpoint` | Entra token endpoint, for example `https://login.microsoftonline.com/<tenant-id>/oauth2/v2.0/token` |
| `token_exchange_profile` | `jwt_bearer_obo` by default, or `rfc8693` |
| `client_id` | Client ID of the Entra app used for on-behalf-of exchange |
| `client_secret` | Client secret for that app |
| `token_exchange_scope` | Defaults to `https://graph.microsoft.com/.default` |
| `token_exchange_audience` | Optional; sent only with `rfc8693` |

For static delegated-token authentication, set `api_key` to a pre-acquired Microsoft Graph delegated access token. LiteLLM sends the same token for each caller and does not refresh it

The deployment can reference the saved credential with this `config.yaml` shape:

```yaml
model_list:
  - model_name: claude-m365-copilot
    litellm_params:
      model: microsoft_365_copilot/chat
      litellm_credential_name: m365-copilot-obo
```

For clients that send unsupported parameters, enable proxy-wide parameter dropping:

```yaml
litellm_settings:
  drop_params: true
```

## Register an Entra application

Use the Microsoft Entra admin center to register a single-tenant app for the on-behalf-of flow

1. Open **App registrations** and select **New registration**. Choose **Accounts in this organizational directory only** for a single-tenant app, then register it. See Microsoft's [app registration guide](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app)
2. In the app registration, open **Certificates & secrets**, select **New client secret**, and create a secret. Copy its value immediately and store it securely because Entra will not show the value again. See Microsoft's [client credentials guide](https://learn.microsoft.com/en-us/entra/identity-platform/how-to-add-credentials)
3. Open **API permissions** > **Add a permission** > **Microsoft Graph** > **Delegated permissions**. Add `Sites.Read.All`, `Mail.Read`, `People.Read.All`, `OnlineMeetingTranscript.Read.All`, `Chat.Read`, `ChannelMessage.Read.All`, and `ExternalItem.Read.All`. Also add the `openid`, `profile`, and `offline_access` scopes. Grant admin consent for all seven Graph permissions. See Microsoft's [API permission guide](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-configure-app-access-web-apis) and the [Copilot Chat API permission requirements](https://learn.microsoft.com/en-us/microsoft-365-copilot/extensibility/api/ai-services/chat/copilotconversation-chat)

   <Image img={require('../../img/m365_copilot_entra_api_permissions.png')} style={{ width: '800px', height: 'auto' }} />

4. Open **Expose an API** and set the Application ID URI to `api://<app-client-id>`. Select **Add a scope**, create `access_as_user`, and allow admins and users to consent. See Microsoft's [Expose an API guide](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-configure-app-expose-web-apis)

   <Image img={require('../../img/m365_copilot_entra_expose_api.png')} style={{ width: '800px', height: 'auto' }} />

5. In **Authentication**, select **Add a platform** > **Mobile and desktop applications** and add the redirect URI `http://127.0.0.1/callback` for Claude Desktop sign-in. See Microsoft's [desktop app registration guide](https://learn.microsoft.com/en-us/entra/identity-platform/scenario-desktop-app-registration)

   <Image img={require('../../img/m365_copilot_entra_redirect_uris.png')} style={{ width: '800px', height: 'auto' }} />

6. In **Token configuration**, add the optional `email` claim to the Access token type. Add a `groups` claim if your proxy JWT mapping reads it. See Microsoft's [optional claims guide](https://learn.microsoft.com/en-us/entra/identity-platform/optional-claims)

   <Image img={require('../../img/m365_copilot_entra_token_configuration.png')} style={{ width: '800px', height: 'auto' }} />

## Create the model and credential in LiteLLM

In the dashboard, open **Models + Endpoints** > **Add Model**. Select provider **Microsoft 365 Copilot**, model `chat`, and Auth Type **OAuth token exchange (on-behalf-of)**, then click **Create credential**

<Image img={require('../../img/m365_copilot_litellm_add_model.png')} style={{ width: '800px', height: 'auto' }} />

Set **Token Endpoint URL** to `https://login.microsoftonline.com/<tenant-id>/oauth2/v2.0/token`, choose `jwt_bearer_obo` for **Exchange Grant**, and enter the app's Client ID and Client Secret. Leave **Scope** at its default, `https://graph.microsoft.com/.default`, then click **Add Credential**

<Image img={require('../../img/m365_copilot_litellm_credential.png')} style={{ width: '800px', height: 'auto' }} />

## Accept Entra JWTs at the proxy

JWT authentication is an enterprise feature. Configure the proxy to validate the caller's Entra token. `JWT_AUDIENCE` must match the OBO app's client ID

Set these environment variables with values from your Entra tenant:

```bash
export JWT_PUBLIC_KEY_URL="https://login.microsoftonline.com/<tenant-id>/discovery/v2.0/keys"
export JWT_AUDIENCE="<app-client-id>"
export JWT_ISSUER="https://login.microsoftonline.com/<tenant-id>/v2.0"
```

Enable JWT authentication and map the Entra claims:

```yaml
general_settings:
  enable_jwt_auth: true
  litellm_jwtauth:
    user_id_jwt_field: oid
    user_email_jwt_field: preferred_username
    user_id_upsert: true
```

On-behalf-of exchange requires the caller's Entra access token for `api://<app-client-id>/access_as_user` in the `Authorization` header. A LiteLLM virtual key cannot be used because LiteLLM needs the caller's IdP-issued token

## Acquire a caller token and call LiteLLM

Callers obtain an access token by signing in through their client with this Entra app. Request the delegated `api://<app-client-id>/access_as_user` scope so the token is issued to the OBO app. For scripts and other clients, acquire the token with MSAL and use the access token as the proxy bearer token

Use the OpenAI Python SDK to call the LiteLLM proxy. Pass the Entra access token as the SDK API key so it is sent as a bearer token:

```python
from openai import OpenAI

client = OpenAI(
    api_key="<entra-access-token>",
    base_url="https://litellm.example.com/v1",
)

response = client.chat.completions.create(
    model="claude-m365-copilot",
    messages=[{"role": "user", "content": "Summarize my latest meeting"}],
)
```

## Use Claude Code and Claude Desktop

Claude Code and Claude Desktop require the public model name to start with `claude-` or `anth-`; this is a client constraint, not a LiteLLM requirement. Use a deployment alias such as `claude-m365-copilot`

For Claude Code, set `ANTHROPIC_BASE_URL` to the LiteLLM proxy URL and `ANTHROPIC_AUTH_TOKEN` to an Entra access token for `api://<app-client-id>/access_as_user`. Acquire the token with MSAL and select the configured public model alias in the client. See Microsoft's [MSAL overview](https://learn.microsoft.com/en-us/entra/identity-platform/msal-overview)

For Claude Desktop third-party inference, set the OIDC client ID to the OBO app's client ID, set the Bearer token to **Access token**, and use these scopes:

```text
openid profile email offline_access api://<app-client-id>/access_as_user
```

## Token caching

LiteLLM does not store a refresh token. Each proxy worker process caches the exchanged access token in memory until `expires_in` minus 60 seconds

## Troubleshooting

If Entra returns `AADSTS240002`, the caller sent an ID token instead of an access token issued to the OBO app

If a connection test returns `microsoft_365_copilot with OAuth token exchange requires the caller's IdP-issued access token in the Authorization header`, the test request did not include an Entra JWT. An admin session or LiteLLM virtual key alone is not sufficient for on-behalf-of exchange

For an audience mismatch, compare the token's `aud` claim with `JWT_AUDIENCE`; for this setup, the configured audience is the OBO app's client ID
