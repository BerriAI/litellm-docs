# Backstage LiteLLM Governance Plugin

[backstage-plugin-litellm-govai](https://github.com/acarmisc/backstage-plugin-litellm-govai) is a Backstage plugin that puts LiteLLM governance inside your developer portal. Developers generate and manage their own virtual keys and track model usage from Backstage, while platform teams keep budgets, rate limits, and model access under central control.

It ships a frontend package built on the Backstage New Frontend System and a backend router built on the New Backend System; the LiteLLM master key stays server-side and is never exposed to the browser.

Key features:
- Self-service virtual key generation and management, scoped to the signed-in Backstage user
- Usage analytics for spend, tokens, and requests, broken down per model and per key
- Autoprovisioning of LiteLLM users on first access, with per-group overrides for budget, allowed models, teams, role, and TPM/RPM limits
- A compact home widget with spend, token, and key-count KPIs plus a daily-spend sparkline

Point the plugin at your proxy in `app-config.yaml`:

```yaml
litellm:
  baseUrl: ${LITELLM_BASE_URL}
  masterKey: ${LITELLM_MASTER_KEY}
```

- [GitHub](https://github.com/acarmisc/backstage-plugin-litellm-govai)
