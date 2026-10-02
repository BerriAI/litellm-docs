import Image from '@theme/IdealImage';

# Claude Code Gateway (SSO sign-in)

Let developers sign in to Claude Code with your SSO provider instead of an API key. LiteLLM serves the same gateway protocol Anthropic's self-hosted [Claude apps gateway](https://code.claude.com/docs/en/claude-apps-gateway) speaks: Claude Code's `/login` opens on a **Cloud gateway** screen, the developer signs in through your identity provider in the browser, and every request after that carries a LiteLLM token tied to that developer's user and team, so spend, budgets, and logs are attributed per person with nothing to issue or rotate

<EnterpriseFeature feature="SSO">From v1.76.0, SSO is free for up to 5 users. Beyond that, an enterprise license is required.</EnterpriseFeature>

The flow works with any SSO provider LiteLLM supports (Google, Microsoft Entra ID, Okta, or any OIDC provider through the generic client). It differs from [Claude Code with Okta SSO (JWT Auth)](./claude_code_okta_sso), where a helper script fetches an IdP token and Claude Code sends that token as its API key: here there is no script to distribute, the sign-in is Claude Code's own, and the proxy can push [managed settings](#4-push-managed-settings-from-the-proxy) to every signed-in client. Claude Code v2.1.195 or later is required on developer machines

## How it works

Claude Code reads the gateway URL from a managed settings file, fetches the gateway's OAuth discovery document, and asks the developer once to trust the gateway. It then starts an [OAuth device authorization](https://www.rfc-editor.org/rfc/rfc8628) flow: the terminal shows a short code and opens the browser on LiteLLM's SSO login, the developer signs in with your identity provider and confirms the code, and Claude Code, which has been polling the token endpoint, receives a LiteLLM CLI token. That token is a JWT scoped to the developer's user and team, valid for 24 hours by default. Claude Code stores it, fetches managed settings with it, and sends every inference request to `/claude_code_gateway/v1/messages` with it as the bearer token. Under the hood the gateway reuses the proxy's existing [CLI SSO device flow](../proxy/cli_sso), so anything that works for `lite login` (SSO providers, team membership, model access, budgets) works here

## 1. Turn the gateway on

Enable the gateway in `general_settings`. The `anthropic/*` wildcard matters: Claude Code asks for model names by itself (`claude-opus-4-7` for the current release), so the proxy needs to resolve whatever it sends, and a named alias next to it gives you a stable name to grant on teams

```yaml
model_list:
  - model_name: {{anthropic}}
    litellm_params:
      model: anthropic/{{anthropic}}
      api_key: os.environ/ANTHROPIC_API_KEY
  - model_name: "anthropic/*"
    litellm_params:
      model: "anthropic/*"
      api_key: os.environ/ANTHROPIC_API_KEY

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  database_url: os.environ/DATABASE_URL
  enable_claude_code_gateway: true
```

The browser leg is the proxy's SSO login, so configure your SSO provider the way [SSO for Admin UI](../proxy/admin_ui_sso) describes and register `<proxy base url>/sso/callback` as the redirect URI. For Google that is two variables; Microsoft, Okta, and generic OIDC have their own set on that page

```bash
export GOOGLE_CLIENT_ID="<client id>"
export GOOGLE_CLIENT_SECRET="<client secret>"
export PROXY_BASE_URL="https://litellm.internal.example.com"
litellm --config config.yaml
```

`PROXY_BASE_URL` is the origin developers reach. The gateway builds the discovery document, the token endpoint, and the browser verification URL from it, so behind a load balancer or TLS terminator it must name the public-facing origin, not the pod. Claude Code only signs in to a gateway whose hostname resolves to private addresses (RFC 1918, link-local, CGNAT `100.64.0.0/10`, IPv6 ULA `fc00::/7`, or loopback), because a trusted gateway can push settings that run commands on developer machines. Put the proxy on an internal hostname behind TLS; the CLI pins the TLS certificate per hostname on first connect. Plain `http://` on loopback, as in the screenshots below, is accepted for local testing

Two optional settings tune the flow. `LITELLM_CLI_JWT_EXPIRATION_HOURS` sets the token lifetime (default `24`); the gateway issues no refresh tokens, so this is how long a developer stays signed in before `/login` asks again. `allow_cli_sso_verification_uri_complete: true` under `general_settings` adds `verification_uri_complete` to the device authorization response, which carries the code in the URL so a client that honors it opens the browser page with the code already filled in. It is off by default because typing the code is what ties the browser page to the terminal that started the login; see [Pre-fill the verification code](../proxy/cli_sso#pre-fill-the-verification-code)

With more than one worker or replica, the browser leg and the terminal's polling can land on different processes, and the sign-in state lives in the proxy's CLI SSO cache. Configure Redis (`REDIS_HOST`, `REDIS_PORT`, and `REDIS_PASSWORD` in the environment, or `general_settings.coordination_redis`) so that cache is shared, or run a single worker

## 2. Verify from the command line

The discovery document is served without authentication. The `issuer` is the URL to put in every developer's managed settings file in the next step

```bash
curl http://localhost:4000/claude_code_gateway/.well-known/oauth-authorization-server
```

```json
{
  "issuer": "http://localhost:4000/claude_code_gateway",
  "device_authorization_endpoint": "http://localhost:4000/claude_code_gateway/oauth/device_authorization",
  "token_endpoint": "http://localhost:4000/claude_code_gateway/oauth/token",
  "grant_types_supported": ["urn:ietf:params:oauth:grant-type:device_code", "refresh_token"]
}
```

Starting a device authorization by hand shows what Claude Code sees at `/login`: a code for the developer, the browser URL, a ten-minute window, and a five-second polling interval

```bash
curl -X POST http://localhost:4000/claude_code_gateway/oauth/device_authorization
```

```json
{
  "device_code": "cli-tyQu2vOB-r2ynASXPqyOKDd0g_cr6NOm.mAVkxaITywoFfMB-_x87HqgyZ886Hz6luXiZw2qssVo",
  "user_code": "XPCA-X2K2",
  "verification_uri": "http://localhost:4000/sso/key/generate?source=litellm-cli&key=cli-tyQu2vOB-r2ynASXPqyOKDd0g_cr6NOm",
  "expires_in": 600,
  "interval": 5
}
```

Polling the token endpoint before the browser sign-in has finished answers `authorization_pending`, which is what Claude Code waits on

```bash
curl -X POST http://localhost:4000/claude_code_gateway/oauth/token \
  -d grant_type=urn:ietf:params:oauth:grant-type:device_code \
  -d device_code="cli-tyQu2vOB-r2ynASXPqyOKDd0g_cr6NOm.mAVkxaITywoFfMB-_x87HqgyZ886Hz6luXiZw2qssVo"
```

```json
{"error": "authorization_pending"}
```

## 3. Point Claude Code at the proxy

Claude Code opens `/login` on the gateway screen only when the gateway URL comes from a managed settings file. Those keys are ignored in a developer's own `~/.claude/settings.json`, so deploy this file through your device management tooling or write it directly: `/Library/Application Support/ClaudeCode/managed-settings.json` on macOS, `/etc/claude-code/managed-settings.json` on Linux and WSL, `C:\Program Files\ClaudeCode\managed-settings.json` on Windows

```json
{
  "forceLoginMethod": "gateway",
  "forceLoginGatewayUrl": "https://litellm.internal.example.com/claude_code_gateway"
}
```

The URL is the `issuer` from the discovery document, with the `/claude_code_gateway` path. If developer machines route HTTPS through a corporate proxy, add the LiteLLM host to `NO_PROXY` so the CLI connects to it directly, and if your internal network is numbered from public IPv4 space you own, list those blocks in the `gatewayInternalNetworks` managed setting (Claude Code v2.1.268 or later); both are covered in Anthropic's [gateway prerequisites](https://code.claude.com/docs/en/claude-apps-gateway#prerequisites)

With the file in place, run `claude` (or `/login` in a running session). The gateway screen shows the URL from managed settings

<Image img={require('../../img/claude_code_gateway/gateway_detected.png')} style={{ width: '800px', height: 'auto' }} />

On the first connection Claude Code asks the developer to trust the gateway, since a trusted gateway can push settings to the machine. This is asked once per gateway host

<Image img={require('../../img/claude_code_gateway/trust_gateway.png')} style={{ width: '800px', height: 'auto' }} />

Claude Code then shows the verification code and opens the browser on the proxy's SSO login. If the browser does not open, the developer visits the URL shown

<Image img={require('../../img/claude_code_gateway/device_code.png')} style={{ width: '800px', height: 'auto' }} />

The browser goes through your identity provider (a browser already signed in to the provider lands on the next page without a prompt) and then asks for the code from the terminal

<Image img={require('../../img/claude_code_gateway/browser_verification_code.png')} style={{ width: '800px', height: 'auto' }} />

After Continue, the browser confirms the login and the terminal picks it up on its next poll

<Image img={require('../../img/claude_code_gateway/browser_login_complete.png')} style={{ width: '800px', height: 'auto' }} />

<Image img={require('../../img/claude_code_gateway/connected.png')} style={{ width: '800px', height: 'auto' }} />

From here Claude Code continues with its usual first-run prompts (security notes and workspace trust) and lands on the prompt, showing **Cloud gateway** next to the model. Requests hit `POST /claude_code_gateway/v1/messages` on the proxy with the developer's token, and each one shows up in the proxy's logs and spend under that developer's user and team

<Image img={require('../../img/claude_code_gateway/signed_in_session.png')} style={{ width: '800px', height: 'auto' }} />

When the token expires (24 hours by default), Claude Code asks the developer to run `/login` again and the same flow repeats. The token is self-contained and stays valid until then, and every new sign-in goes back through your identity provider, so a developer you deprovision there cannot sign in again once their current token lapses; `LITELLM_CLI_JWT_EXPIRATION_HOURS` is that bound

## 4. Push managed settings from the proxy

Anything you put under `claude_code_gateway_managed_settings` is served verbatim as the organization's managed settings to every client signed in through the gateway. The value is a Claude Code [managed settings](https://code.claude.com/docs/en/managed-settings) document, so the same keys work: `permissions`, `env`, hooks, allowed tools, and so on. Claude Code fetches it at startup and again every hour, and locked keys cannot be overridden locally

```yaml
general_settings:
  enable_claude_code_gateway: true
  claude_code_gateway_managed_settings:
    permissions:
      defaultMode: acceptEdits
    env:
      CLAUDE_CODE_ENABLE_TELEMETRY: "1"
      OTEL_METRICS_EXPORTER: otlp
      OTEL_LOGS_EXPORTER: otlp
      OTEL_EXPORTER_OTLP_PROTOCOL: http/protobuf
      OTEL_EXPORTER_OTLP_ENDPOINT: https://litellm.internal.example.com/claude_code_gateway
```

The endpoint is `GET /claude_code_gateway/managed/settings`, authenticated with the CLI token (any LiteLLM key works for checking it). The response wraps your block in the `{uuid, checksum, settings}` envelope Claude Code expects, where both ids are the SHA-256 of the canonical JSON, and the same value is returned as an `ETag`. Claude Code sends it back as `If-None-Match` on the hourly refresh and gets `304 Not Modified` until the block changes. When `claude_code_gateway_managed_settings` is unset, the endpoint answers `404`, which the CLI reads as "no managed policy"

```bash
curl -s http://localhost:4000/claude_code_gateway/managed/settings \
  -H "Authorization: Bearer $LITELLM_KEY"
```

```json
{
  "uuid": "sha256:c74c6a3f7f6bfda0c71ded0a60e3f1669b61f86f5ef603291fd39be2fea600a5",
  "checksum": "sha256:c74c6a3f7f6bfda0c71ded0a60e3f1669b61f86f5ef603291fd39be2fea600a5",
  "settings": {
    "permissions": {"defaultMode": "acceptEdits"},
    "env": {
      "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
      "OTEL_METRICS_EXPORTER": "otlp",
      "OTEL_LOGS_EXPORTER": "otlp",
      "OTEL_EXPORTER_OTLP_PROTOCOL": "http/protobuf",
      "OTEL_EXPORTER_OTLP_ENDPOINT": "https://litellm.internal.example.com/claude_code_gateway"
    }
  }
}
```

Some settings need the developer's approval the first time they apply. A telemetry destination is one of them: Claude Code shows where telemetry will go and applies the block only once the developer accepts, so tell your developers to expect this screen

<Image img={require('../../img/claude_code_gateway/managed_settings_approval.png')} style={{ width: '800px', height: 'auto' }} />

## 5. Telemetry

In sessions signed in through `/login`, Claude Code sends its OpenTelemetry exports (OTLP over HTTP; gRPC is not supported on gateway sessions) to the gateway rather than to a locally set `OTEL_EXPORTER_OTLP_ENDPOINT`, unless a managed setting names another collector. The `env` block above turns the exporters on and points them at the proxy, which serves `POST /claude_code_gateway/v1/metrics`, `/v1/logs`, and `/v1/traces`, authenticated with the same token, and answers `200`. Today the proxy accepts these exports and discards them; per-request usage, spend, and logs come from the proxy's own logging on `/claude_code_gateway/v1/messages`, not from the OTLP stream. If you already collect Claude Code telemetry, set `OTEL_EXPORTER_OTLP_ENDPOINT` in the managed settings to your collector instead

## Deployment topologies

**Claude Code to LiteLLM.** The setup on this page: developers sign in through LiteLLM, LiteLLM holds the provider credentials, and the proxy's [model access](../proxy/virtual_keys), [budgets](../proxy/users), [rate limits](../proxy/users), and [logging](../proxy/logging) apply per user and team. This is the topology to pick when LiteLLM is already your gateway for other clients

**Claude Code to LiteLLM behind a load balancer.** The same thing with several replicas: `PROXY_BASE_URL` names the balancer's origin so the discovery document and the browser URL point developers at an address they reach, TLS terminates at the balancer on a private hostname, and Redis is configured so the device flow completes on any replica. Sticky sessions are not needed

**Claude Code to the Claude apps gateway to LiteLLM.** Anthropic offers no hosted gateway; the [Claude apps gateway](https://code.claude.com/docs/en/claude-apps-gateway) is software you run yourself. If you already run it (for its IdP-group policies, or because Claude Desktop connects through it), it can front LiteLLM as an `anthropic` upstream whose `base_url` is the proxy and whose `api_key` is a LiteLLM virtual key. Set `forward_user_identity: true` on that upstream and the Claude apps gateway adds `x-litellm-end-user-id` (the developer's email) to every request it forwards; LiteLLM reads that header as the [customer id](../proxy/customers) without any extra configuration, so spend is tracked per developer even though the proxy sees one key. A `429` from LiteLLM on such a request is returned to the developer as-is instead of failing over to another upstream (Claude apps gateway v2.1.267 or later), so per-customer budgets and rate limits hold. In this topology the sign-in and managed settings are the Claude apps gateway's, and `enable_claude_code_gateway` stays off on LiteLLM

```yaml
upstreams:
  - provider: anthropic
    base_url: https://litellm.internal.example.com
    auth:
      api_key: ${LITELLM_VIRTUAL_KEY}
    forward_user_identity: true
```

## Known limits

The gateway issues no refresh tokens. The discovery document lists the `refresh_token` grant because Claude Code expects it, and a refresh request is answered with `401 invalid_grant` and `This gateway does not issue refresh tokens; sign in again`. Claude Code then asks for `/login`, so the session length is `LITELLM_CLI_JWT_EXPIRATION_HOURS`

The token is scoped to the first team on the developer's user record. A developer who belongs to several teams has no team picker in this flow and gets the first team's models and budget; `lite login` offers the picker if a developer needs a token for another team

Two endpoints of the protocol are not served: `GET /claude_code_gateway/v1/models` and `HEAD /claude_code_gateway/api/hello` answer `404`. Sign-in, managed settings, and inference do not depend on them. Model discovery through `/v1/models` is off in Claude Code unless `CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1` is set, and with the endpoint unserved the `/model` picker shows Claude Code's built-in list, which is why the proxy config keeps the `anthropic/*` wildcard. The team's model list still decides which of those models a developer may use

`enable_claude_code_gateway`, `claude_code_gateway_managed_settings`, and `allow_cli_sso_verification_uri_complete` are read from `general_settings` in `config.yaml` only; they cannot be set from the Admin UI or the database

Claude Code disables server-side WebSearch on gateway sessions and uses the 5-minute prompt cache TTL rather than the 1-hour one, because it cannot see which upstream a gateway routes to. Both are Claude Code behaviors for any gateway, LiteLLM included

## Related docs

- [CLI SSO Authentication](../proxy/cli_sso): the device flow the gateway reuses, token lifetime, PKCE sign-in, and the native client contract
- [SSO for Admin UI](../proxy/admin_ui_sso): configuring Google, Microsoft, Okta, or generic OIDC on the proxy
- [Claude Code with Okta SSO (JWT Auth)](./claude_code_okta_sso): the `apiKeyHelper` alternative, where Claude Code sends the IdP token itself
- [Claude Code Quickstart](./claude_responses_api): basic Claude Code with LiteLLM setup using an API key
