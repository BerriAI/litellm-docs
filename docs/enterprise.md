import Image from '@theme/IdealImage';
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# ✨ Enterprise

:::info

- **New to Enterprise?** Start with the [✨ Enterprise Quickstart](/docs/learn/enterprise_quickstart)
- **Free trial**: [30-day enterprise license](https://www.litellm.ai/enterprise#trial)
- **Talk to us**: [Book a demo](https://enterprise.litellm.ai/demo)
- **SSO is free for up to 5 users.** Beyond that, an enterprise license is required.

:::

## Who is Enterprise for?

For teams running LiteLLM at scale (100+ users or 10+ production AI use-cases) that need SSO, audit logs, fine-grained access control, and professional support on top of OSS. Not sure if you qualify? [Get in touch](https://enterprise.litellm.ai/demo).

## Why Enterprise?

LiteLLM OSS already covers the fundamentals: an OpenAI-compatible gateway, virtual keys, spend tracking, budgets, fallbacks, and request/response logging. Enterprise adds the controls larger organizations need to safely give hundreds of users and dozens of applications access to LLMs.

| | **OSS** | **Enterprise** |
|---|---|---|
| **Auth** | API keys | SSO + SCIM, OIDC/JWT |
| **Key Management** | Virtual keys, users, teams across LLM APIs, MCPs, and Agents | Organizations, org/team admins, delegated admin roles |
| **Security** | — | Key rotations, read/write to secret manager |
| **Guardrails** | Always-on / request-based<sup>[1](/docs/enterprise#guardrails-oss-vs-enterprise)</sup> | Key and team scoped guardrails |
| **Logging** | Request/response logging, Prometheus metrics | Per-key / per-team routing to Langfuse, Langsmith, Arize and more. Management-op logs |
| **Deployment** | Single-region proxy | [Multi-region deployment](./proxy/multi_region) under one license, admin/worker split |

###### 1 {#guardrails-oss-vs-enterprise}

The OSS guardrail framework supports custom guardrails plus Presidio (PII masking). Several built-in callback integrations require a LiteLLM Enterprise license: `llmguard_moderations`, `llamaguard_moderations`, `hide_secrets`, `openai_moderations`, `google_text_moderation`, `lakera_prompt_injection`, and `aporia_prompt_injection`.

## Core Enterprise Features

### Security & Access Control

- **[SSO for the Admin UI](./proxy/admin_ui_sso.md)** – Okta, Azure AD, Google Workspace, and any OIDC/SAML provider
- **[JWT-based Authentication](./proxy/token_auth.md)** – Authenticate requests with your identity provider's tokens
- **[Audit Logs with retention policies](./proxy/multiple_admins.md)** – Track every admin action and key-level change
- **[Role-Based Access Control](./proxy/access_control.md)** – Organizations, teams, and user roles
- **[Public & private route controls](./proxy/public_routes.md)** – Restrict admin routes, lock down surface area
- **[IP address-based access control lists](./proxy/ip_address.md)** – Restrict proxy access to specific CIDR ranges
- **[Key Rotations](./proxy/virtual_keys.md#-key-rotations)** – Automate rotation for virtual keys
- **[Secret Managers](./secret_managers/overview.md)** – AWS KMS, AWS Secrets Manager, Azure Key Vault, Google KMS, Google Secret Manager, HashiCorp Vault, CyberArk, or a custom secret manager
- **[AI Hub](./proxy/ai_hub.md)** – Share a public, branded page of available models and agents with your users

### Governance & Cost Control

- **[Multi-tenant Architecture](./proxy/multi_tenant_architecture.md)** – Organizations → Teams → Projects → Keys
- **[Project Management](./proxy/project_management.md)** – Group keys by application or use-case with budgets, owners, and isolated spend tracking
- **[Tag-based Budgets](./proxy/provider_budget_routing.md)** – Budgets and spend tracking by custom tag
- **[Model-specific Budgets per Virtual Key](./proxy/users.md)** – Different limits per model, per key
- **[Temporary Budget Increases](./proxy/temporary_budget_increase.md)** – Time-boxed spend bumps without permanent changes
- **[Soft Budget Email Alerts](./proxy/ui_team_soft_budget_alerts.md)** – Warn teams before they hit hard limits
- **[Generate Spend Reports](./proxy/cost_tracking.md#-enterprise-generate-spend-reports)** – Programmatic access to spend by key/team/tag/model

### Observability & Compliance

- **[Team-Based Logging](./proxy/team_logging.md)** – Route each team's logs to their own Langfuse project or callback
- **[Disable logging per team](./proxy/team_logging.md#disable-logging-for-a-team)** – GDPR-friendly opt-out at the team level
- **[Log export to GCS / Azure Blob](./observability/gcs_bucket_integration.md)** – Durable storage for compliance
- **[Guardrails per key/team](/docs/enterprise#guardrails-oss-vs-enterprise)** – Secret redaction, content moderation, banned keywords
- **Enforced required params** – Reject requests missing required metadata

### Operations & Branding

- **[Custom Swagger branding](/docs/enterprise#operations--branding)** – Your title, description, and filtered routes
- **[Custom email branding](./proxy/email.md#email-customization)** – Your logo and colors on system emails
- **Max request/response size limits** – Protect the proxy from runaway payloads
- **[Team-managed models](./proxy/team_model_add.md)** – Let teams bring their own keys and fine-tunes

### Projects

[Projects](./proxy/project_management.md) let you group virtual keys by application or use-case. Each project has its own budget, owners, rate limits, and isolated spend view, which helps when a single team runs multiple apps and needs separate reporting per app.

- Group keys by application, environment, or customer
- Per-project budgets, rate limits, and model allowlists
- Dedicated owners and spend dashboards
- Works with organizations, teams, and tags

See [Project Management](./proxy/project_management.md) and the [UI walkthrough](./proxy/ui_project_management.md) for setup.

---


## Deployment Options

### Self-Hosted

Deploy our Docker image (or build from the pip package) on your own infrastructure. We provide a license key that enables the enterprise features above, plus a dedicated support channel.

```env
LITELLM_LICENSE="eyJ..."
```

**No data leaves your environment.** [Procurement available via AWS and Azure Marketplace.](./data_security.md#legalcompliance-faqs)

Pricing depends on your deployment size. [Get in touch](https://enterprise.litellm.ai/demo) to scope it.

---

## Professional Support

### Standard Support (included)

Included with every enterprise license: a dedicated Slack/Teams channel with our engineering team for integration, deployment, and provider troubleshooting. Support hours are 9am to 9pm PST, Monday through Friday. No guaranteed response time is included.

### 24/7 Support SLAs (additional fee)

For teams that need guaranteed response times around the clock, we offer 24/7 Support SLAs for an additional fee on top of standard support.

| Severity | Response SLA |
|---|---|
| **Sev 0** — 100% production traffic failing | 1 hour |
| **Sev 1** — partial production impact | 6 hours |
| **Sev 2–3** — setup issues, non-urgent bugs | 24 hours (7am–7pm PT, Mon–Sat) |
| **Security patches** | 72 hours |

Custom SLAs available on request.

For what support covers, see the [Shared Responsibility Model](./shared_responsibility.md).

---

## Version support

LiteLLM supports the four most recent stable minor lines. Each of those lines keeps getting patch releases; anything older reaches end of life and stops receiving updates. This policy takes effect Monday, June 29, 2026. As of mid-June 2026 the supported lines are 1.86, 1.87, 1.88, and 1.89, and the set rolls forward as new stable releases ship.

**Why we are doing this.** LiteLLM ships fast, with a new minor line going out roughly every week. Patching lines well down the list meant carrying every fix forward onto every line we kept alive, a cost that grows with the number of lines we maintain rather than the number of fixes we make. Focusing on four lines lets us give each one more care.

**How it works.** The window always holds the four most recent stable minor lines. When we promote a new line, the oldest one drops out and stops receiving releases. End of life is a clean cutoff; there is no separate long-term maintenance track. For any supported line, the recommended build is its latest patch. For rare, high-severity issues we will use our judgment and may act beyond the window when the situation calls for it.

**What it means for you.** To check where you stand, take the latest stable line and count back four; if your version is older than that, plan an upgrade. The simplest path is to pin to a minor line, take its patches, and move onto a newer line before yours drops out.

---

## Public AI Hub

Share a public page of available models, MCP, Agents and skills for users

[Learn more](./proxy/ai_hub.md)

<Image img={require('../img/everything_ai_hub.png')} style={{ width: '900px', height: 'auto' }}/>

## Secret Managers

LiteLLM Enterprise integrates with the following secret managers:

- [AWS KMS](./secret_managers/aws_kms.md)
- [AWS Secrets Manager](./secret_managers/aws_secret_manager.md)
- [Azure Key Vault](./secret_managers/azure_key_vault.md)
- [Google KMS](./secret_managers/google_kms.md)
- [Google Secret Manager](./secret_managers/google_secret_manager.md)
- [HashiCorp Vault](./secret_managers/hashicorp_vault.md)
- [CyberArk](./secret_managers/cyberark.md)
- [Custom Secret Manager](./secret_managers/custom_secret_manager.md)

See the [Secret Managers overview](./secret_managers/overview.md) for setup.

## FAQ

### How do I set up and verify an Enterprise License?

1. Add the license key to your environment:

   ```env
   LITELLM_LICENSE="eyJ..."
   ```

2. Restart LiteLLM Proxy.

3. Open `http://<your-proxy-host>:<port>/`. The Swagger page should show **"Enterprise Edition"** in the description. If it doesn't, confirm the key is correct, unexpired, and that the proxy was fully restarted.

### Where can I read more about data security and compliance?

See [Data Security / Legal / Compliance FAQs](./data_security.md).

### How is pricing structured?

Pricing is based on usage. [Contact us](https://enterprise.litellm.ai/demo) for a quote tailored to your team.

### How do I get day-0 support for new models without restarting?

Use [Auto Sync New Models](./proxy/sync_models_github.md) to pull the latest pricing and context-window data from GitHub on demand or on a schedule, with no restart required. Trigger a manual sync with `POST /reload/model_cost_map`, or schedule periodic syncs with `POST /schedule/model_cost_map_reload?hours=6`.
