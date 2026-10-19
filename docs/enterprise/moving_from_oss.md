---
title: Moving from OSS
description: Move an open-source LiteLLM gateway to LiteLLM Enterprise. The image, config.yaml, and version line stay the same. Use this checklist before you open the gateway to all your teams.
---

# Moving from OSS

All that you run now stays the same when you move to Enterprise: the image, the `config.yaml` file, and the version line. You add a license key to the gateway that you have. Your keys, teams, models, and spend data stay in your database.

Do the checklist on this page before you open the gateway to all the teams in your company. Most items are also good practice for an open-source deployment.

## Pre-flight checklist

### 1. Run Postgres and Redis

The Admin UI, virtual keys, the MCP and agent registries, and budget tracking keep their data in Postgres. Set `DATABASE_URL` on each gateway instance.

Run Redis 7.0 or newer when you run more than one gateway instance or more than one worker. Redis shares rate limit counters, budgets, and cache hits between the instances. Without Redis, each instance enforces limits independently. Refer to [What needs Redis](../proxy/redis_requirements.md) and [Production best practices](../proxy/prod.md#redis).

### 2. Add the license key

Set `LITELLM_LICENSE` on each gateway instance and restart the instances. Then make sure that the API docs page shows **Enterprise Edition**. Refer to [Activate your license](./activate.md).

### 3. Set up SSO before you expose the Admin UI

By default, the Admin UI accepts a login with `UI_USERNAME` and `UI_PASSWORD`, or with the master key. All the persons who know these values can sign in as a proxy admin, and audit logs cannot identify the person.

1. Connect your identity provider. Refer to [SSO for the Admin UI](../proxy/admin_ui_sso.md).
2. Make sure that each administrator can sign in with SSO.
3. Set `disable_env_credential_login: true` in `general_settings`.
4. Restart the gateway.

Refer to [Disable environment credential login](../proxy/security_best_practices.md#disable-environment-credential-login-to-the-admin-ui).

### 4. Rotate the master key

If persons other than the proxy admins know the master key, set a new master key before you go to production.

If you set `LITELLM_SALT_KEY`, the master key is only an admin credential. Then you can replace the key and restart the instances. If you did not set a salt key, the master key also encrypts the stored credentials. In that case, use the full rotation procedure. Refer to [Rotating the master key](../proxy/master_key_rotations.md).

Do not change `LITELLM_SALT_KEY` after you add a model. Refer to [Set the salt key](../proxy/prod.md#set-the-salt-key).

### 5. Harden the deployment

Pin an exact version or image digest, and [verify the image signature](../proxy/docker_image_security.md) before you deploy. Set `trusted_proxy_ranges` for your ingress. Give applications scoped virtual keys, not the master key. Refer to [Security best practices](../proxy/security_best_practices.md).

### 6. Set budgets before you invite the teams

Set a budget on each team, and set soft budget alerts so that teams get an email before they reach the limit. Refer to [Budgets and rate limits](../proxy/users.md), [Team budgets](../proxy/team_budgets.md), and [Soft budget alerts](../proxy/ui_team_soft_budget_alerts.md).

## Next steps

- [Production rollout](../learn/enterprise_quickstart.md): the five steps from deployment to chargeback.
- [Version support](./version_support.md): the release lines that LiteLLM supports.
- [Support and SLA](./support.md): how to get help from the LiteLLM engineers.
