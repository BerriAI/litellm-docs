# CLI Authentication

Use the litellm cli to authenticate to the LiteLLM Gateway. This is great if you're trying to give a large number of developers self-serve access to the LiteLLM Gateway.


## Demo

<iframe width="840" height="500" src="https://www.loom.com/embed/87c5d243cde642ff942783024ff037e3" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen></iframe>

## Usage 

### Prerequisites - Start LiteLLM Proxy with Beta Flag

:::warning[Beta Feature - Required]

CLI SSO Authentication is currently in beta. You must set this environment variable **when starting up your LiteLLM Proxy**:

```bash
export EXPERIMENTAL_UI_LOGIN="True"
litellm --config config.yaml
```

Or add it to your proxy startup command:

```bash
EXPERIMENTAL_UI_LOGIN="True" litellm --config config.yaml
```

:::

### Configuration

#### JWT Token Expiration

By default, CLI authentication tokens expire after **24 hours**. You can customize this expiration time by setting the `LITELLM_CLI_JWT_EXPIRATION_HOURS` environment variable when starting your LiteLLM Proxy:

```bash
# Set CLI JWT tokens to expire after 48 hours
export LITELLM_CLI_JWT_EXPIRATION_HOURS=48
export EXPERIMENTAL_UI_LOGIN="True"
litellm --config config.yaml
```

Or in a single command:

```bash
LITELLM_CLI_JWT_EXPIRATION_HOURS=48 EXPERIMENTAL_UI_LOGIN="True" litellm --config config.yaml
```

**Examples:**
- `LITELLM_CLI_JWT_EXPIRATION_HOURS=12` - Tokens expire after 12 hours
- `LITELLM_CLI_JWT_EXPIRATION_HOURS=168` - Tokens expire after 7 days (168 hours)
- `LITELLM_CLI_JWT_EXPIRATION_HOURS=720` - Tokens expire after 30 days (720 hours)

:::note[Experimental UI Session]
When `EXPERIMENTAL_UI_LOGIN` is enabled, the **browser UI login** session uses a fixed 10-minute expiry (not configurable). `LITELLM_UI_SESSION_DURATION` applies only to non-experimental flows.
:::

:::tip
You can check your current token's age and expiration status using:
```bash
lite whoami
```
:::

#### Pre-fill the verification code

By default the browser page that finishes `lite login` asks you to type the verification code the terminal printed. To have `lite login` open that page with the code already filled in, so you only confirm it and click Continue, set on the proxy:

```yaml
general_settings:
  allow_cli_sso_verification_uri_complete: true
```

The flag is off by default because typing the code by hand is what ties the browser page to the terminal that started the login. With the flag on, still check that the pre-filled code matches the one the terminal printed before you confirm it. Older `lite` versions open the page without the code either way, so upgrade the CLI as well

If that browser is already signed in to your SSO provider and you would rather skip the code entirely, run `lite login --pkce` instead: one Approve click and the terminal prints `Login successful!`. See [Browser sign-in with PKCE](#browser-sign-in-with-pkce)

#### Attribution metadata (OIDC claims)

Map allowlisted OIDC claims into the LiteLLM user's `metadata` and return them to the CLI in `/sso/cli/poll` as `attribution_metadata`. Use this for stable attribution fields (for example employment type or cost center) without parsing large group lists in the client.

Set on the **proxy** before startup:

```bash
export CLI_SSO_CLAIM_MAP="employment_type->acme_employment_type,org_info.department->department"
export GENERIC_USER_EXTRA_ATTRIBUTES="employment_type,org_info.department"
```

`CLI_SSO_CLAIM_MAP` and `LITELLM_CLI_SSO_CLAIM_MAP` are equivalent. Format: comma-separated `source_claim->metadata_key` pairs. The optional `metadata.` prefix on the destination is stripped; values are stored on the user's `metadata` JSON column.

| Part | Meaning |
|------|---------|
| `source_claim` | OIDC claim path (dot notation), including fields from `GENERIC_USER_EXTRA_ATTRIBUTES` |
| `metadata_key` | Key under LiteLLM user `metadata` (supports nested keys via dots) |

Only non-secret scalar values (`string`, `int`, `float`, `bool`) are persisted and returned. Lists, objects, and destination keys containing fragments like `token` or `secret` are dropped.

Example poll response (after SSO completes):

```json
{
  "status": "ready",
  "key": "eyJ...",
  "user_id": "user@company.com",
  "attribution_metadata": {
    "acme_employment_type": "full_time",
    "department": "Engineering"
  }
}
```

**Local testing without a real IdP:** run `python scripts/mock_oidc_server_for_cli_sso.py` from the LiteLLM repo, point Generic SSO env vars at `http://127.0.0.1:8765`, then run `python scripts/test_cli_sso_claims_e2e.py`.

### Steps

1. **Install the CLI**

   The `lite` client is a thin laptop install: it points at a LiteLLM proxy and runs your coding agents through it, with none of the proxy server runtime pulled in. The one-line installer needs only `curl`; it bootstraps [uv](https://github.com/astral-sh/uv) when it's missing and lets uv provision a compatible Python for you:

   ```shell
   curl -fsSL https://raw.githubusercontent.com/BerriAI/litellm/main/scripts/install-cli.sh | sh
   ```

   Already have uv and prefer to drive it yourself? Install the package directly:

   ```shell
   uv tool install 'litellm[cli]'
   ```

   Any of these gives you the `lite` command. A proxy server installed from `litellm[proxy]` ships it too, but that extra leaves out `keyring`, so its credential stays in a file instead of your OS keychain. Start by typing it in your terminal:

   ```shell
   lite
   ```

2. **Set up environment variables**

   On your local machine, set the proxy URL:

   ```bash
   export LITELLM_PROXY_URL=http://localhost:4000
   ```

   *(Replace with your actual proxy URL)*

3. **Login**

   ```shell
   lite login
   ```

   This will open a browser window to authenticate. If you have connected LiteLLM Proxy to your SSO provider, you should be able to login with your SSO credentials. Once logged in, you can use the CLI to make requests to the LiteLLM Gateway.

   The browser page asks for the verification code the terminal printed. To skip typing it, either have the proxy [pre-fill the verification code](#pre-fill-the-verification-code) or, when the browser already holds your SSO session, use [`lite login --pkce`](#browser-sign-in-with-pkce), which needs no code at all

   The credential goes into your OS keychain, and `lite login` prints where it landed. On a machine with no keychain it falls back to `~/.litellm/token.json` with owner-only permissions. See [the `lite login` credential](./management_cli.md#the-lite-login-credential) for the details and for how to turn keychain storage off

4. **Make a test request to view models**

   ```shell
   lite models list
   ```

   This will list all the models available to you.

## Browser sign-in with PKCE

`lite login --pkce` signs you in through your system browser with OAuth 2.0 authorization code and PKCE (S256). The CLI acts as a public client: it registers itself with the proxy, listens on a loopback port that the OS assigns, and never holds a client secret. The proxy sign-in page and your SSO provider do the authentication, and the CLI only ever sees the resulting credential

```shell
export LITELLM_PROXY_URL=https://litellm.example.com
lite login --pkce
```

```text
Opening browser to: https://litellm.example.com/authorize?response_type=code&client_id=llm_dcrc_...&redirect_uri=http%3A%2F%2F127.0.0.1%3A57485%2Fcallback&state=...&code_challenge=...&code_challenge_method=S256&resource=https%3A%2F%2Flitellm.example.com
Approve the sign-in in your browser. Waiting...

Login successful!
JWT Token: R46gzIdke6PgQZUiGctb...
Credential stored in your OS keychain.
You can now use the CLI without specifying --api-key
```

In the browser, the proxy sign-in page opens first if you have no session (SSO if the proxy is connected to your identity provider, otherwise username and password). After sign-in, the browser comes back to a consent page. The page names the CLI's loopback address, for example `http://127.0.0.1:57485`, shows the user you are signed in as, and lets you pick the team that requests are attributed to. Users who belong to teams must pick one, the same rule as `lite login`. Click Approve. The browser shows "Signed in to LiteLLM. You can close this window and return to the terminal." and the terminal prints `Login successful!`

The classic `lite login` flow and virtual API keys keep working unchanged. `--pkce` needs a proxy that serves `/.well-known/litellm-cli-auth`; on an older proxy the command stops with a message that says so

### The stored credential

The key and the refresh token both go to your OS keychain, the same place `lite login` puts the key, and the rest of the record goes to `~/.litellm/token.json` (mode `0600`). Next to the `base_url`, `user_id`, and `user_role` fields that `lite login` writes, a `--pkce` record also holds `expires_at`, `client_id`, `token_endpoint`, `revocation_endpoint`, `resource`, and `team_id`, none of which gets anyone a key on its own. On a machine with no usable keychain the key and the refresh token fall back into that same file and `lite login` says so; treat `~/.litellm/token.json` as sensitive whenever it does, because anyone who can read it can exchange the refresh token for a working key. A `--pkce` login made with an earlier `lite` leaves its refresh token in the file until the next `lite` command reads it and moves it into the keychain

The key expires after `LITELLM_CLI_JWT_EXPIRATION_HOURS` (24 hours by default, see [JWT Token Expiration](#jwt-token-expiration)). You do not need to log in again when it does: the next `lite` command that needs the key renews it with the refresh token and saves the new pair. Each renewal rotates the refresh token, and a refresh token that was already used is refused

### Use the credential from other tools

`lite auth print-token` prints the current key to stdout and nothing else (diagnostics go to stderr). It renews the key first when it is about to expire, so a tool that calls it always gets a key that works

Claude Code can run it as its [`apiKeyHelper`](https://code.claude.com/docs/en/settings). `lite login --pkce --config-claude` writes that for you: it sets `env.ANTHROPIC_BASE_URL` to the proxy and `apiKeyHelper` to `lite auth print-token` (with the absolute path to `lite` and the proxy URL) in `~/.claude/settings.json`, and leaves your other settings alone. To do it by hand:

```json title="~/.claude/settings.json"
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://litellm.example.com"
  },
  "apiKeyHelper": "/absolute/path/to/lite --base-url https://litellm.example.com auth print-token"
}
```

For OpenCode, or any other OpenAI-compatible client, point the client at `<proxy>/v1` and pass the key through an environment variable:

```shell
LITELLM_PROXY_KEY=$(lite auth print-token) opencode
```

```json title="opencode.json"
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "litellm": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "LiteLLM proxy",
      "options": {
        "baseURL": "https://litellm.example.com/v1",
        "apiKey": "{env:LITELLM_PROXY_KEY}"
      },
      "models": {
        "gpt-5.4-mini": { "name": "gpt-5.4-mini" }
      }
    }
  },
  "model": "litellm/gpt-5.4-mini"
}
```

Requests made with the key are attributed to your user and the team you picked, so they show up under your name on the logs page and draw down your user and team budgets

### Log out

```shell
lite logout
```

`lite logout` sends the refresh token to the proxy's `POST /revoke` endpoint and then clears both stores, the keychain entry and `~/.litellm/token.json`. The refresh token is dead from that point on. The key itself is not revocable; it expires on its own within `LITELLM_CLI_JWT_EXPIRATION_HOURS`

Signing in again, with `lite login --pkce` or the classic `lite login`, does the same to the record it replaces: the new credential is saved first, then the previous login's refresh token is revoked, so an older copy of `token.json` cannot be renewed once you have signed in again. If the proxy cannot be reached for that revocation, the login still succeeds and says so

An admin cannot revoke a `--pkce` login from the dashboard; only the holder's `lite logout` cuts the refresh token short. Every renewal re-reads the user on the proxy, so deactivating the user or removing them from the team makes the next renewal fail, and the key runs out within `LITELLM_CLI_JWT_EXPIRATION_HOURS`. When a renewal is refused, `lite auth print-token` and every other `lite` command print the reason the proxy gave on stderr, and once the key has run out they tell you to run `lite login --pkce` again

### Several workers or replicas

Refresh-token single use, replay detection, and `POST /revoke` are enforced through the proxy's Redis cache when one is configured, either `litellm_settings.cache` with Redis `cache_params` or `general_settings.coordination_redis`, and they fail closed while Redis is unreachable: a refresh or a `POST /revoke` that arrives then answers `503 temporarily_unavailable`, the CLI keeps the key it already has and tries again on its next command, and `lite logout` keeps your login record, exits 1, and asks you to run it again shortly, so the refresh token still gets revoked. Without Redis each worker keeps its own record, so on a proxy with more than one worker or replica a revoked or already-used refresh token can still be accepted by a worker that never saw it. Run a single worker or configure Redis

## Native client contract

A CLI written in any language can run the same sign-in from one discovery document, without reading LiteLLM source. A typical case is a Go launcher that signs the user in and then starts OpenCode with the key. The contract is versioned: check `contract_version` before you trust the rest of the document. Adding fields never bumps the version; only a field that changes meaning or goes away does

### Discovery document

```shell
curl https://litellm.example.com/.well-known/litellm-cli-auth
```

```json
{
  "contract_version": 1,
  "issuer": "https://litellm.example.com",
  "authorization_endpoint": "https://litellm.example.com/authorize",
  "token_endpoint": "https://litellm.example.com/token",
  "registration_endpoint": "https://litellm.example.com/register",
  "revocation_endpoint": "https://litellm.example.com/revoke",
  "resource": "https://litellm.example.com",
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "code_challenge_methods_supported": ["S256"],
  "token_endpoint_auth_methods_supported": ["none"],
  "revocation_endpoint_auth_methods_supported": ["none"]
}
```

`resource` is the proxy origin. Send it as the RFC 8707 `resource` parameter on the authorize and token requests. That parameter is what asks for a proxy API credential instead of an MCP session; without it the same authorize request takes the MCP connect path, and the token it mints is rejected on `/v1/*`

The URLs are built from the request's base URL. Behind a load balancer or reverse proxy, set `PROXY_BASE_URL` on the proxy to its public origin so `issuer`, the endpoints, and `resource` name the address your users reach. `lite login --pkce` checks this the way [RFC 8414 section 3.3](https://www.rfc-editor.org/rfc/rfc8414#section-3.3) asks: it stops with a message that names the issuer to pass as `--base-url` when `issuer` differs from the `--base-url` the user typed, so the two must agree

### Steps

1. Fetch the discovery document above and check that `contract_version` is `1` and that `code_challenge_methods_supported` includes `S256`. Before you post anything to the endpoints, also check that `issuer` matches the address you fetched the document from (same scheme, host, port, and path, ignoring case and a trailing slash) and that every endpoint and `resource` sit on that same origin. Post to the registration, token, and revocation endpoints without following redirects: a `307` or `308` would otherwise replay the code and verifier, or the refresh token, wherever `Location` points

2. Register a public client. Start a listener on `127.0.0.1` on a port the OS assigns and register that address as the redirect URI. Keep the returned `client_id`; there is no secret

   ```shell
   curl -X POST https://litellm.example.com/register \
     -H 'content-type: application/json' \
     -d '{
       "client_name": "my-cli",
       "redirect_uris": ["http://127.0.0.1:53187/callback"],
       "token_endpoint_auth_method": "none",
       "grant_types": ["authorization_code", "refresh_token"],
       "response_types": ["code"]
     }'
   ```

   ```json
   {
     "client_id": "llm_dcrc_lq411b6QkPmfxjW...",
     "token_endpoint_auth_method": "none",
     "redirect_uris": ["http://127.0.0.1:53187/callback"]
   }
   ```

3. Generate a PKCE code verifier (43 to 128 characters) and its S256 code challenge, plus a random `state`, and open the system browser on the authorization endpoint

   ```text
   https://litellm.example.com/authorize
     ?response_type=code
     &client_id=llm_dcrc_lq411b6QkPmfxjW...
     &redirect_uri=http://127.0.0.1:53187/callback
     &state=<random>
     &code_challenge=<S256 challenge>
     &code_challenge_method=S256
     &resource=https://litellm.example.com
   ```

   With no proxy session, the browser is sent to the sign-in page and returns to this URL afterwards. With a session, the consent page renders right away. The user picks a team and clicks Approve

4. Receive the code on the loopback listener. The browser lands on `http://127.0.0.1:53187/callback?code=<code>&state=<state>`. Check that `state` matches the one you sent before you use the code. If the user clicked Deny, the callback carries `error` and `error_description` instead of `code`

5. Exchange the code for the credential. The request is form-encoded and there is no client secret; `code_verifier` proves the client is the one that started the flow

   ```shell
   curl -X POST https://litellm.example.com/token \
     -d grant_type=authorization_code \
     -d code=<code> \
     -d redirect_uri=http://127.0.0.1:53187/callback \
     -d client_id=llm_dcrc_lq411b6QkPmfxjW... \
     -d code_verifier=<verifier> \
     -d resource=https://litellm.example.com
   ```

   ```json
   {
     "access_token": "LneZuxEFqvemEwK6lRzgg6BN...",
     "token_type": "Bearer",
     "expires_in": 86400,
     "refresh_token": "llm_srefresh_eyJhbGciOiJ...",
     "user_id": "user@example.com",
     "team_id": "a0a759e9-6234-4c75-bbad-b535f6c9e80e"
   }
   ```

   The authorization code is single-use. Sending it again returns `400` with `{"error": "invalid_grant", "error_description": "the authorization code was already used"}`

6. Use `access_token` as the Bearer token on the proxy's LLM routes: `/v1/chat/completions`, `/v1/responses`, `/v1/messages`, `/v1/models`, and the rest. Spend is attributed to the user and the team from the token response

   ```shell
   curl https://litellm.example.com/v1/chat/completions \
     -H "Authorization: Bearer LneZuxEFqvemEwK6lRzgg6BN..." \
     -H 'content-type: application/json' \
     -d '{"model": "gpt-5.4-mini", "messages": [{"role": "user", "content": "Say hi in three words."}]}'
   ```

7. Renew the credential before `expires_in` runs out. The response has the same shape as in step 5 and carries a new refresh token. The old refresh token is refused with `400 invalid_grant` if it is used again, so store the new pair before you use the new access token

   ```shell
   curl -X POST https://litellm.example.com/token \
     -d grant_type=refresh_token \
     -d refresh_token=llm_srefresh_eyJhbGciOiJ... \
     -d client_id=llm_dcrc_lq411b6QkPmfxjW... \
     -d resource=https://litellm.example.com
   ```

8. Revoke the refresh token on logout ([RFC 7009](https://www.rfc-editor.org/rfc/rfc7009)), and revoke the refresh token of any credential you replace when the user signs in again. Only refresh tokens are revocable; access tokens expire on their own. The endpoint answers `200` with `{}` even for a token it no longer recognizes, so it is safe to call more than once

   ```shell
   curl -X POST https://litellm.example.com/revoke \
     -d token=llm_srefresh_eyJhbGciOiJ... \
     -d client_id=llm_dcrc_lq411b6QkPmfxjW...
   ```

### Security rules

A grant that carries `resource` only ever redirects to a loopback address (`127.0.0.1`, `::1`, or `localhost`). A hosted `https://` redirect URI, even one the client registered, is refused with `400 invalid_request` and the description `a proxy-API grant may only redirect to a loopback address`, so the personal credential this flow mints can only land on the user's own machine. The authorization code is single-use and bound to the client and the PKCE verifier. `lite` never follows a redirect from the registration, token, or revocation endpoint; a `3xx` answer stops the command with a message naming where it pointed, so the code and verifier or the refresh token only ever reach the origin the discovery document was checked against. The consent page is served with `Cache-Control: no-store` and `Content-Security-Policy: frame-ancestors 'none'`, so it cannot be embedded in another page. The server never picks a team on the user's behalf: the team comes from the consent page, membership is checked again at every token exchange and refresh, and a grant posted without a team while the user still has a live team to pick from is refused with `400 invalid_grant` and the description `this user belongs to a team; sign in again and pick the team for this credential`

The device authorization grant, embedded browsers, and the resource owner password credentials grant are not supported
