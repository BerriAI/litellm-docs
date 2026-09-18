# Security Best Practices

Security is a top priority at LiteLLM. Use the following practices for production and enterprise deployments.

## 1. Monitor security emails and upgrade promptly

Monitor the email address associated with your LiteLLM Enterprise account for CVE alerts and security updates. For large or major security updates, LiteLLM notifies Enterprise customers by email 7 days before public disclosure. Use this window to test and deploy the updated version, and reply with any upgrade issues.

Make sure these emails reach both your security and platform teams.

## 2. Run a supported stable release

Stay on the latest stable release and include LiteLLM upgrades in your regular patching process. Pin an exact version or image digest instead of using `latest`, and [verify the Docker image signature](./docker_image_security) before deployment.

See the [LiteLLM release cycle](./release_cycle) for the current release schedule.

## 3. Use least-privilege access

Assign the minimum required [RBAC role](./access_control) and keep the number of proxy administrators small.

Applications and users should use scoped [Virtual Keys](./virtual_keys), not the LiteLLM master key. Use a separate service account key for each production workload so access can be revoked without affecting other services.

### Disable environment credential login to the Admin UI

By default the Admin UI accepts a login built from environment variables: `UI_USERNAME` (default `admin`) with `UI_PASSWORD`, and when `UI_PASSWORD` is unset, the master key itself. This is a permanent, shared, cleartext admin credential. It cannot be rotated per person, everyone who has ever read the environment can keep signing in as a proxy admin, and audit logs cannot attribute changes to an individual. Treat it as a bootstrap mechanism only. While it is enabled, the dashboard shows a warning banner to admins.

Before disabling it, create a `proxy_admin` user with their own password for each administrator (or connect [SSO](./admin_ui_sso)) and confirm they can sign in. Then set the following in `config.yaml` and restart the proxy:

```yaml
general_settings:
  disable_env_credential_login: true
```

`UI_USERNAME`, `UI_PASSWORD`, and the master key are then rejected on the login page and the banner disappears. Database users and SSO are unaffected. If you enable it before an admin account exists, remove the setting and restart to bring the environment login back; the API keeps working with the master key throughout. See the [Admin UI quick start](./ui#5-create-your-own-admin-account-and-disable-environment-credential-login) for the step-by-step flow.

### Limit failed Admin UI sign-in attempts

Password sign-ins to the Admin UI are rate limited per source address out of the box. More than 10 wrong passwords from one address within 60 seconds, across every username, blocks that address for 5 minutes. Accounts are never locked, so an attacker cannot lock an administrator out by guessing at their username from somewhere else. Each address also has a per-username allowance of half its address limit (5 by default): more than that for one username blocks only that address and username pair, and its further failures stop counting against the address. This exists for shared addresses such as an office NAT, where one misconfigured script hammering one account would otherwise block every colleague behind the same address. Both are hard blocks: every attempt for a blocked key is refused with `429` before the password is checked, including the correct password, `UI_USERNAME`/`UI_PASSWORD`, and the master key typed into the login form. If there were an exception for the right credentials, an attacker could keep guessing through it and the block would only slow down honest users. A blocked administrator who cannot wait out the block still has the master key as an API bearer token, which is not subject to the sign-in limit.

The per-address limit is only enforced when LiteLLM knows which address belongs to the client, so production deployments should set `general_settings.trusted_proxy_ranges` explicitly. Behind a reverse proxy or ingress, list its CIDR ranges; the client address is then taken from `X-Forwarded-For` as the first hop outside those ranges, and forged `X-Forwarded-For` values from outside cannot pick a different address. When clients reach LiteLLM directly, set it to an empty list; the peer address is the client and `X-Forwarded-For` is ignored. An unset value is different from an empty list: it means the topology is unknown, so the proxy warns at startup, ignores `X-Forwarded-For`, and enforces only the per-username half of the limit, since blocking the peer address behind a shared ingress would lock out everyone behind it. Leaving it unset in production therefore leaves username spraying unlimited per address. For known shared egress addresses, raise `max_failed_login_attempts_per_source_overrides` instead of the global limit; the per-username allowance for that address follows as half the override, and an override of `0` exempts the address from both limits. `LITELLM_DISABLE_LOGIN_RATE_LIMIT=true` turns the limit off everywhere.

```yaml
general_settings:
  trusted_proxy_ranges: ["10.0.0.0/8"]  # your ingress; use [] when clients connect directly
  max_failed_login_attempts_per_source_overrides:
    "203.0.113.7": 50                   # shared office egress, 25 per username there
    "198.51.100.4": 0                   # a scanner you run yourself, exempt from both limits
```

Counters live in Redis when the proxy has one, so a block applies on every worker and pod. Without Redis each worker counts on its own, the effective limit is multiplied by the worker count, and the proxy warns at startup. A Redis outage falls back to per-worker counters with a warning rather than refusing sign-ins. Usernames are hashed in the stored keys, so Redis never holds them in clear text. Settings, defaults, and the `LITELLM_DISABLE_LOGIN_RATE_LIMIT` kill switch are described in the [Admin UI guide](./ui#limit-failed-sign-in-attempts).

## 4. Connect your enterprise identity provider

### SSO

Enable [SSO](./admin_ui_sso) for the Admin UI so authentication, MFA, and sign-in policies remain centralized in your identity provider.

### JWT

Enable [JWT authentication](./token_auth) for API traffic so workloads can use signed identities from your OIDC provider instead of shared, long-lived API keys. JWT claims can also map requests to LiteLLM users, teams, models, and spend controls.

### SCIM

Enable [SCIM](../tutorials/scim_litellm) to automatically provision and deprovision users and teams. When a user is removed from your identity provider, LiteLLM removes their associated keys and access tokens, reducing stale access.

## 5. Restrict network access

Run the LiteLLM Gateway on a private network when possible and expose only the routes clients need. Review [public route settings](./public_routes) before deployment.

Use TLS for client-to-gateway and gateway-to-provider traffic. Keep certificate verification enabled; if your organization uses a private CA, configure a [custom CA bundle](../guides/security_settings).

## 6. Protect secrets and review audit logs

Store provider credentials, the master key, and the salt key in your platform's secret store or a supported [secret manager](../secret_managers/overview). Do not commit secrets to `config.yaml` or source control. Follow the [master key rotation guide](./master_key_rotations), and do not rotate `LITELLM_SALT_KEY` after credentials have been stored.

Enable [audit logs](./multiple_admins) and review administrative changes such as key creation, key deletion, role changes, and team updates.

## 7. Avoid disclosing internals through error responses and headers

An unexpected 5xx error returns a generic `Internal server error` message to the client; the original exception, including any stack trace, is always written to the server logs. Use the `x-litellm-call-id` [response header](./response_headers) to correlate a failed request with its server-side log entry without needing the client-facing message to carry any detail.

LiteLLM's own uvicorn-based startup (`litellm --config ...`, or the default Docker image) does not send a `Server` response header. If you run the proxy behind gunicorn, hypercorn, or granian workers, or behind a reverse proxy or load balancer (nginx, an ingress controller, a CDN), that layer may add its own `Server` header disclosing its name and version. Configure it to omit or generalize that header, for example `server_tokens off;` in nginx, or the equivalent setting for your ingress controller or CDN.

## 8. Add guardrails for sensitive workloads (optional)

If your workloads handle sensitive or regulated data, add [guardrails](./guardrails/quick_start) to screen prompts and responses. We recommend [Bedrock Guardrails](./guardrails/bedrock) for content filtering, PII detection, and denied-topic policies, and the [LiteLLM content filter](./guardrails/litellm_content_filter) for lightweight, regex-based blocking of specific words or patterns. Guardrails can be applied per key, team, or model so you can enforce stricter controls where they are needed.

## 8. Configure Secure cookies behind a TLS-terminating reverse proxy

The proxy's session, SSO, and SAML cookies are marked `Secure` whenever the public-facing origin is HTTPS. When TLS terminates at a reverse proxy or load balancer in front of LiteLLM, LiteLLM only sees the plain-HTTP hop from that proxy, so it needs one trusted signal to know the public origin is actually HTTPS:

- Set [`PROXY_BASE_URL`](./config_settings#environment-variables---reference) to the exact `https://` origin your users see in their browser. This is the simplest option and takes precedence over everything else.
- Otherwise, set `general_settings.use_x_forwarded_for: true` and `general_settings.mcp_trusted_proxy_ranges` to your reverse proxy's CIDR range(s). LiteLLM then honors `X-Forwarded-Proto: https` from that proxy, but only when the request's direct peer address falls inside one of those CIDRs: an untrusted caller cannot spoof this header to strip `Secure` from its own cookies.

```yaml
general_settings:
  use_x_forwarded_for: true
  mcp_trusted_proxy_ranges:
    - "10.0.0.0/8" # your reverse proxy / ingress controller's network
```

Without one of these configured, a deployment behind TLS termination gets cookies without `Secure`, since LiteLLM has no trusted way to tell it is being reached over HTTPS. Neither setting is MCP-specific despite the `mcp_` prefix; both are the general request trust boundary LiteLLM uses for `X-Forwarded-*` headers.

## 9. Disable API documentation in production

By default the proxy serves Swagger UI at `/`, ReDoc at `/redoc`, and the raw OpenAPI schema at `/openapi.json` without authentication. Security scanners flag this as a reconnaissance surface because it lists every route and request schema. Disable all three in production:

```env
NO_DOCS="True"
NO_REDOC="True"
NO_OPENAPI="True"
```

Each variable controls a separate surface, so setting only `NO_DOCS` still leaves `/redoc` and `/openapi.json` readable; set all three and restart the proxy. `/redoc` and `/openapi.json` then return 404 and `/` returns only the plain `"LiteLLM: RUNNING"` status string, while inference and management routes are unaffected. See [Restrict all API documentation](./configs#restrict-all-api-documentation-for-productionair-gapped-deployments) for the per-surface variables and for moving the docs to a different path instead of disabling them.

## 10. Restrict file uploads

`POST /v1/files` requires a virtual key like every other proxy route, and the proxy only forwards the uploaded bytes to the configured provider. It never executes, unpacks, or serves the file itself. Even so, treat uploads as untrusted input and limit what the gateway accepts before it reaches the provider.

Set `allowed_file_extensions` under `general_settings` to the extensions your workloads actually need. Matching is case-insensitive against the uploaded filename, so `.jsonl` also accepts `batch.JSONL`. Any other extension, and any filename with no extension, is rejected with a `400` before the file is forwarded. An empty list (`[]`) rejects every upload, and leaving the setting out keeps uploads unrestricted. Pair it with `max_file_size_mb` to cap any upload, `max_batch_file_size_mb` to cap batch input files, and `max_request_size_mb` to cap the whole request body on every route.

```yaml
general_settings:
  master_key: sk-1234
  allowed_file_extensions: [".jsonl", ".pdf", ".txt"]
  max_file_size_mb: 50
  max_batch_file_size_mb: 200
  max_request_size_mb: 250
```

A rejected upload returns an OpenAI-shaped error:

```json
{
  "error": {
    "message": "File extension '.exe' is not in this proxy's allowed_file_extensions setting. The file was not forwarded to the provider.",
    "type": "invalid_request_error",
    "param": "file",
    "code": "400"
  }
}
```

`blocked_file_extensions` is the older blocklist and is deprecated in favour of the allowlist. It still works, and when both are set the allowlist is checked first and the blocklist is still enforced on whatever passes it. Prefer the allowlist: a blocklist has to name every extension you want to keep out, while an allowlist only has to name the ones you use.
