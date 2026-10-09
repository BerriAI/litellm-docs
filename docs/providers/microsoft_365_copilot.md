# Microsoft 365 Copilot

LiteLLM routes chat requests to the Microsoft Graph beta Copilot Chat API. Graph creates a conversation at `/beta/copilot/conversations`, then receives the prompt at `/beta/copilot/conversations/{id}/chat`. This is not a Microsoft Foundry model. The API has no model parameter, so Microsoft chooses the model. Copilot answers using the signed-in user's Microsoft 365 data and permissions. Each user needs a Microsoft 365 Copilot license.

Use the LiteLLM model name `microsoft_365_copilot/chat`. Its input and output costs are listed as `$0` because Copilot is billed by license, not by token.

## Limitations

The Graph API does not accept tools, temperature, or `max_tokens`. LiteLLM accepts `max_tokens` but does not send it to Graph. Clients such as Claude Code may send tools; set `drop_params: true` in proxy configuration to drop unsupported parameters.

LiteLLM sends the last `user` message as the Graph prompt. Every other message, before or after it, is passed in order as additional context. Graph has returned some replies duplicated back to back; LiteLLM collapses a reply only when its two halves are exactly identical.

## Authentication

The UI supports OAuth token exchange (on-behalf-of) and a static delegated access token. The token exchange profile defaults to `jwt_bearer_obo`; `rfc8693` is also supported. The exchange settings are proxy-owned credential fields, not request parameters. Create an LLM credential in the dashboard and reference it from the deployment with `litellm_credential_name`.

In LiteLLM, open **Add Model**, select **Microsoft 365 Copilot**, choose model `chat`, select **Auth Type**, then choose **OAuth token exchange (on-behalf-of)** or **Static delegated access token** and click **Create credential**.

For OAuth token exchange, configure these fields on the credential:

| `litellm_params` field | Purpose |
| --- | --- |
| `token_exchange_endpoint` | Entra token endpoint, for example `https://login.microsoftonline.com/<tenant-id>/oauth2/v2.0/token` |
| `token_exchange_profile` | `jwt_bearer_obo` by default, or `rfc8693` |
| `client_id` | Client ID of the Entra app used for on-behalf-of exchange |
| `client_secret` | Client secret for that app |
| `token_exchange_scope` | Defaults to `https://graph.microsoft.com/.default` |
| `token_exchange_audience` | Optional; sent only with `rfc8693` |

For a static delegated token, select **Static delegated access token** and set `api_key` to a pre-acquired Microsoft Graph delegated access token. LiteLLM does not refresh this token.

The deployment can reference the saved credential with this `config.yaml` shape:

```yaml
model_list:
  - model_name: claude-m365-copilot
    litellm_params:
      model: microsoft_365_copilot/chat
      litellm_credential_name: m365-copilot-obo
```

For clients that send unsupported parameters, proxy-wide parameter dropping can be enabled with:

```yaml
litellm_settings:
  drop_params: true
```

## Register an Entra application

Register an app in Microsoft Entra ID for the on-behalf-of flow. Add the delegated Microsoft Graph permissions `Sites.Read.All`, `Mail.Read`, `People.Read.All`, `OnlineMeetingTranscript.Read.All`, `Chat.Read`, `ChannelMessage.Read.All`, and `ExternalItem.Read.All`. Grant admin consent for all of them.

Expose an API scope named `access_as_user`, create a client secret, and configure the app for public client flows if you will use device-code sign-in. For Claude Desktop, add the redirect URI `http://127.0.0.1/callback`. If your JWT claim mapping uses them, add the optional `email` and `groups` claims to access tokens.

## Accept Entra JWTs at the proxy

JWT authentication is an enterprise feature. Set the proxy's JWT configuration to validate the caller's Entra token. `JWT_AUDIENCE` must match the OBO app's client ID.

Set these environment variables, using values from your Entra tenant:

```bash
export JWT_PUBLIC_KEY_URL="https://login.microsoftonline.com/<tenant-id>/discovery/v2.0/keys"
export JWT_AUDIENCE="<app-client-id>"
export JWT_ISSUER="https://login.microsoftonline.com/<tenant-id>/v2.0"
```

Configure JWT authentication and map the Entra claims:

```yaml
general_settings:
  enable_jwt_auth: true
  litellm_jwtauth:
    user_id_jwt_field: oid
    user_email_jwt_field: preferred_username
    user_id_upsert: true
```

On-behalf-of exchange requires an Entra **access token issued to the OBO app**, not an ID token. A LiteLLM virtual key cannot be used for this flow because LiteLLM needs the caller's IdP-issued access token in the `Authorization` header.

## Get a caller access token

Enable public client flows on the Entra app before using the device-code flow. Request the app's `access_as_user` scope:

```bash
TENANT_ID="<tenant-id>"
APP_CLIENT_ID="<app-client-id>"

curl -X POST "https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/devicecode" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "client_id=${APP_CLIENT_ID}" \
  --data-urlencode "scope=api://${APP_CLIENT_ID}/access_as_user"
```

Follow the `verification_uri` and `user_code` in the response. Poll the token endpoint with the returned `device_code`:

```bash
curl -X POST "https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "client_id=${APP_CLIENT_ID}" \
  --data-urlencode "grant_type=urn:ietf:params:oauth:grant-type:device_code" \
  --data-urlencode "device_code=<device-code>"
```

Use the returned access token as the caller JWT:

```bash
curl "https://litellm.example.com/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <jwt>" \
  -d '{
    "model": "claude-m365-copilot",
    "messages": [{"role": "user", "content": "Summarize my latest meeting"}]
  }'
```

## Use Claude Code and Claude Desktop

The public LiteLLM model name must begin with `claude-` or `anth-`, such as `claude-m365-copilot`. For Claude Code, set `ANTHROPIC_BASE_URL` to the LiteLLM proxy URL and `ANTHROPIC_AUTH_TOKEN` to the caller's Entra access token. Select the configured public model name in Claude Code.

For Claude Desktop third-party inference, use the OBO app's client ID as the OIDC client ID, set the Bearer token to **Access token**, and use these scopes:

```text
openid profile email offline_access api://<app-client-id>/access_as_user
```

The OBO flow does not store a refresh token. LiteLLM caches the exchanged access token in memory until `expires_in` minus 60 seconds, separately in each proxy worker process.

## Troubleshooting

If Entra returns `AADSTS240002`, check that the caller sent an access token issued to the OBO app rather than an ID token.

If a connection test returns `microsoft_365_copilot with OAuth token exchange requires the caller's IdP-issued access token in the Authorization header`, the test request did not include an Entra JWT. An admin session or LiteLLM virtual key alone is not sufficient for on-behalf-of exchange.

For an audience mismatch, compare the token's `aud` claim with `JWT_AUDIENCE`; for this setup, the configured audience is the OBO app's client ID.
