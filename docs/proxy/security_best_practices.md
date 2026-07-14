# Security Best Practices

Security is a top priority at LiteLLM. Use the following practices for production and enterprise deployments.

## 1. Monitor security emails and upgrade promptly

Monitor the email address associated with your LiteLLM Enterprise account for CVE alerts and security updates. For large or major security updates, LiteLLM notifies Enterprise customers by email 7 days before public disclosure. Use this window to test and deploy the updated version, and reply with any upgrade issues.

Make sure these emails reach both your security and platform teams.

## 2. Run a supported stable release

Stay on the latest stable release and include LiteLLM upgrades in your regular patching process. Pin an exact version or image digest instead of using `latest`, and [verify the Docker image signature](./deploy#verify-docker-image-signatures) before deployment.

See the [LiteLLM release cycle](./release_cycle) for the current release schedule.

## 3. Use least-privilege access

Assign the minimum required [RBAC role](./access_control) and keep the number of proxy administrators small.

Applications and users should use scoped [Virtual Keys](./virtual_keys), not the LiteLLM master key. Use a separate service account key for each production workload so access can be revoked without affecting other services.

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

## 7. Add guardrails for sensitive workloads (optional)

If your workloads handle sensitive or regulated data, add [guardrails](./guardrails/quick_start) to screen prompts and responses. We recommend [Bedrock Guardrails](./guardrails/bedrock) for content filtering, PII detection, and denied-topic policies, and the [LiteLLM content filter](./guardrails/litellm_content_filter) for lightweight, regex-based blocking of specific words or patterns. Guardrails can be applied per key, team, or model so you can enforce stricter controls where they are needed.
