# Backstage LiteLLM Governance Plugin

[backstage-plugin-litellm-govai](https://github.com/acarmisc/backstage-plugin-litellm-govai) is a Backstage plugin that puts LiteLLM governance inside your developer portal. Developers generate and manage their own virtual keys and track model usage from Backstage, while platform teams keep budgets, rate limits, and model access under central control.

The plugin comes in two parts you install into your Backstage monorepo: a React frontend that renders the key management and usage pages, and a backend router that talks to the LiteLLM proxy on the frontend's behalf. Only the backend holds your LiteLLM master key, so it never reaches the browser.

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
