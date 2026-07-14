# Security Best Practices

Security is a top priority at LiteLLM. Use the following practices for production and enterprise deployments.

## 1. Monitor security emails and upgrade promptly

Monitor the email address associated with your LiteLLM Enterprise account for CVE alerts and security updates. For large or major security updates, LiteLLM notifies Enterprise customers by email 7 days before public disclosure. Use this window to test and deploy the updated version, and reply with any upgrade issues.

Make sure these emails reach both your security and platform teams.

## 2. Run a supported stable release

Stay on the latest stable release and include LiteLLM upgrades in your regular patching process. Pin an exact version or image digest instead of using `latest`, and [verify the Docker image signature](./deploy#verify-docker-image-signatures) before deployment.

See the [LiteLLM release cycle](./release_cycle) for the current release schedule.

## 3. Use least-privilege access

Require [SSO](./admin_ui_sso) for Admin UI access and assign the minimum required [RBAC role](./access_control). Keep the number of proxy administrators small.

Applications and users should use scoped [Virtual Keys](./virtual_keys), not the LiteLLM master key. Use a separate service account key for each production workload so access can be revoked without affecting other services.

## 4. Restrict network access

Run the LiteLLM Gateway on a private network when possible and expose only the routes clients need. Review [public route settings](./public_routes) before deployment.

Use TLS for client-to-gateway and gateway-to-provider traffic. Keep certificate verification enabled; if your organization uses a private CA, configure a [custom CA bundle](../guides/security_settings).

## 5. Protect secrets and review audit logs

Store provider credentials, the master key, and the salt key in your platform's secret store or a supported [secret manager](../secret_managers/overview). Do not commit secrets to `config.yaml` or source control. Follow the [master key rotation guide](./master_key_rotations), and do not rotate `LITELLM_SALT_KEY` after credentials have been stored.

Enable [audit logs](./multiple_admins) and review administrative changes such as key creation, key deletion, role changes, and team updates.
