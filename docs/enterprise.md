# ✨ Enterprise

:::info

New here? Start with the [Enterprise Quickstart](/docs/learn/enterprise_quickstart). You can also start a [30-day trial](https://www.litellm.ai/enterprise#trial) or [book a demo](https://enterprise.litellm.ai/demo).

:::

## Who is Enterprise for?

For teams running LiteLLM at scale (100+ users or 10+ production AI use-cases) that need SSO, audit logs, fine-grained access control, and professional support on top of OSS. SSO is free for up to 5 users. Beyond that, an enterprise license is required. Not sure if you qualify? [Get in touch](https://enterprise.litellm.ai/demo).

## Why Enterprise?

LiteLLM OSS already covers the fundamentals: an OpenAI-compatible gateway, virtual keys, spend tracking, budgets, fallbacks, and request/response logging. Enterprise adds the controls larger organizations need to safely give hundreds of users and dozens of applications access to LLMs.

<div className="enterprise-compare">

<div className="enterprise-compare-head">
<span></span>
<span>OSS</span>
<span>Enterprise</span>
</div>

<div>
<strong>Auth</strong>
<span>Master key, <a href="./proxy/ui#4-sign-in-for-the-first-time"><code>UI_USERNAME</code> and <code>UI_PASSWORD</code></a></span>
<span>SSO + SCIM, OIDC/JWT</span>
</div>

<div>
<strong>Key Management</strong>
<span>Virtual keys, users, teams across LLM APIs, MCPs, and Agents</span>
<span>Organizations, org/team admins, delegated admin roles</span>
</div>

<div>
<strong>Security</strong>
<span>Master key, virtual keys, and [master key rotation](./proxy/master_key_rotations)</span>
<span>Virtual key rotations, read/write to secret manager, [IP allowlists](./proxy/ip_address), [public and private route controls](./proxy/public_routes)</span>
</div>

<div>
<strong>Guardrails</strong>
<span>Always-on / request-based. Custom guardrails and Presidio (PII masking) are included. Built-in moderation callbacks need a license; see the <a href="#guardrails-oss-vs-enterprise">note below</a>.</span>
<span>Key and team scoped guardrails</span>
</div>

<div>
<strong>Logging</strong>
<span>Request/response logging, Prometheus metrics</span>
<span>Per-key / per-team routing to Langfuse, Langsmith, Arize and more. Management-op logs</span>
</div>

<div>
<strong>Deployment</strong>
<span>Single-region proxy</span>
<span><a href="./proxy/multi_region">Multi-region deployment</a> under one license, admin/worker split</span>
</div>

</div>

## Features

### Security and access

- **[SSO for the Admin UI](./proxy/admin_ui_sso.md)**. Okta, Azure AD, Google Workspace, and any OIDC/SAML provider
- **[JWT-based Authentication](./proxy/token_auth.md)**. Authenticate requests with your identity provider's tokens
- **[Audit Logs with retention policies](./proxy/multiple_admins.md)**. Track every admin action and key-level change
- **[Role-Based Access Control](./proxy/access_control.md)**. Organizations, teams, and user roles
- **[Public and private route controls](./proxy/public_routes.md)**. Restrict admin routes and lock down surface area
- **[IP address-based access control lists](./proxy/ip_address.md)**. Restrict proxy access to specific CIDR ranges
- **[Key Rotations](./proxy/virtual_keys.md#-key-rotations)**. Automate rotation for virtual keys
- **[Secret Managers](./secret_managers/overview.md)**. AWS KMS, AWS Secrets Manager, Azure Key Vault, Google KMS, Google Secret Manager, HashiCorp Vault, CyberArk, or a custom secret manager
- **[AI Hub](./proxy/ai_hub.md)**. Share a public, branded page of available models, MCP servers, agents, and skills

### Governance and cost

- **[Multi-tenant Architecture](./proxy/multi_tenant_architecture.md)**. Organizations, teams, projects, and keys
- **[Project Management](./proxy/project_management.md)**. Group keys by application or use-case, with a budget, owners, rate limits, a model allowlist, and an isolated spend view. See the [UI walkthrough](./proxy/ui_project_management.md)
- **[Tag-based Budgets](./proxy/provider_budget_routing.md)**. Budgets and spend tracking by custom tag
- **[Model-specific Budgets per Virtual Key](./proxy/users.md)**. Different limits per model, per key
- **[Temporary Budget Increases](./proxy/temporary_budget_increase.md)**. Time-boxed spend bumps without permanent changes
- **[Soft Budget Email Alerts](./proxy/ui_team_soft_budget_alerts.md)**. Warn teams before they hit hard limits
- **[Generate Spend Reports](./proxy/cost_tracking.md#-enterprise-generate-spend-reports)**. Programmatic access to spend by key, team, tag, or model

### Observability and compliance

- **[Team-Based Logging](./proxy/team_logging.md)**. Route each team's logs to their own Langfuse project or callback
- **[Disable logging per team](./proxy/team_logging.md#disable-logging-for-a-team)**. GDPR-friendly opt-out at the team level
- **[Log export to GCS / Azure Blob](./observability/gcs_bucket_integration.md)**. Durable storage for compliance
- **[Guardrails per key/team](#guardrails-oss-vs-enterprise)**. Secret redaction, content moderation, banned keywords
- **Enforced required params**. Reject requests missing required metadata

### Operations and branding {#operations--branding}

- **Custom Swagger branding**. Set your own title, description, and filtered routes on the API docs page
- **[Custom email branding](./proxy/email.md#email-customization)**. Your logo and colors on system emails
- **Max request/response size limits**. Protect the proxy from runaway payloads
- **[Team-managed models](./proxy/team_model_add.md)**. Let teams bring their own keys and fine-tunes

### Which guardrails need a license? {#guardrails-oss-vs-enterprise}

The OSS guardrail framework includes custom guardrails and Presidio for PII masking. These built-in callback integrations require a LiteLLM Enterprise license: `llmguard_moderations`, `llamaguard_moderations`, `hide_secrets`, `openai_moderations`, `google_text_moderation`, `lakera_prompt_injection`, and `aporia_prompt_injection`.

## Run it

Deploy the Docker image, or build from the pip package, on your own infrastructure. A license key enables the features above and includes a dedicated support channel.

```env
LITELLM_LICENSE="eyJ..."
```

No data leaves your environment. [Procurement is available through AWS and Azure Marketplace.](./data_security.md#legalcompliance-faqs)

Pricing depends on your deployment size. [Get in touch](https://enterprise.litellm.ai/demo) to scope it.

## Support {#professional-support}

### Standard support

Included with every enterprise license: a dedicated Slack or Teams channel with the engineering team for integration, deployment, and provider troubleshooting. Hours are 9am to 9pm PST, Monday through Friday. No guaranteed response time is included.

### 24/7 support SLAs

For teams that need guaranteed response times around the clock, 24/7 support SLAs are available for an additional fee.

| Severity | Response SLA |
|---|---|
| **Sev 0**. 100% of production traffic is failing | 1 hour |
| **Sev 1**. Partial production impact | 6 hours |
| **Sev 2–3**. Setup issues and non-urgent bugs | 24 hours (7am–7pm PT, Monday–Saturday) |
| **Security patches** | 72 hours |

Custom SLAs are available on request. For what support covers, see the [Shared Responsibility Model](./shared_responsibility.md).

## Version support

LiteLLM supports the four most recent stable minor lines. Each of those lines keeps getting patch releases. Anything older reaches end of life and stops receiving updates. This policy takes effect Monday, June 29, 2026. As of mid-June 2026 the supported lines are 1.86, 1.87, 1.88, and 1.89, and the set rolls forward as new stable releases ship.

LiteLLM ships a new minor line roughly every week. Patching every older line meant carrying each fix onto every line still in support, and that cost grows with the number of lines rather than the number of fixes. Four lines is the window that still gets that care.

The window always holds the four most recent stable minor lines. When a new line ships, the oldest one drops out and stops receiving releases. There is no separate long-term maintenance track. For any supported line, use its latest patch. For a rare, high-severity issue, LiteLLM may still act outside that window.

To see where you stand, take the latest stable line and count back four. If your version is older than that, plan an upgrade. Pin to a minor line, take its patches, and move to a newer line before yours drops out.

## FAQ

<details>
<summary>

### How do I set up and verify an Enterprise License?

</summary>

Add the license key to your environment, then restart the proxy.

```env
LITELLM_LICENSE="eyJ..."
```

Open `http://<your-proxy-host>:<port>/`. The API docs page should show **Enterprise Edition** in the description. If it does not, confirm the key is correct and unexpired, and that the proxy was fully restarted.

</details>

<details>
<summary>

### Where can I read more about data security and compliance?

</summary>

See [Data Security, Legal, and Compliance FAQs](./data_security.md).

</details>

<details>
<summary>

### How is pricing structured?

</summary>

Pricing is based on usage. [Contact us](https://enterprise.litellm.ai/demo) for a quote tailored to your team.

</details>

<details>
<summary>

### How do I get day-0 support for new models without restarting?

</summary>

Use [Auto Sync New Models](./proxy/sync_models_github.md) to pull the latest pricing and context-window data from GitHub on demand or on a schedule, with no restart required. Trigger a manual sync with `POST /reload/model_cost_map`, or schedule periodic syncs with `POST /schedule/model_cost_map_reload?hours=6`.

</details>
