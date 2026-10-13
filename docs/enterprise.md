---
title: Enterprise
hide_title: true
description: LiteLLM Enterprise is the open-source AI Gateway plus SSO, audit logs, delegated admin roles, multi-region deployment, and support SLAs, self-hosted in your cloud.
---

import {EnterpriseHero, TierStack} from '@site/src/components/Conversion/Enterprise';
import {Tiles, SalesBand} from '@site/src/components/Conversion';

<EnterpriseHero />

## What you get on top of open source

Enterprise is a license key on the same Gateway image you may already run. Nothing to migrate: each layer includes everything below it.

<TierStack />

## What changes for your organization

<Tiles size="lg" columns={3} items={[
  {icon: 'compliance', title: 'Audited security you can hand to your review team', text: 'SOC 2 Type II audited, self-hosted so no data leaves your environment, and signed Docker images you can verify.', to: 'https://trust.litellm.ai/', more: 'Verify the signed images', moreTo: '/docs/proxy/docker_image_security'},
  {icon: 'sso', title: 'Everyone signs in with your identity provider', text: 'SSO and SCIM for Okta, Entra ID, Google Workspace, or any OIDC or SAML provider. Access follows your org chart.', to: '/docs/proxy/admin_ui_sso'},
  {icon: 'audit', title: 'Every admin action is on record', text: 'Audit logs of key, team, and model changes, with retention policies your compliance team sets.', to: '/docs/proxy/multiple_admins'},
  {icon: 'budget', title: 'Teams run their own keys and budgets', text: 'Team admins manage keys, models, and budgets per project, tag, and model without the master key, with alerts before anyone hits a cap.', to: '/docs/proxy/access_control'},
  {icon: 'secrets', title: 'Provider keys stay in your vault', text: 'AWS, Azure, Google, HashiCorp Vault, and CyberArk secret managers, with automatic virtual key rotation.', to: '/docs/secret_managers/overview'},
  {icon: 'support', title: 'Engineers on call', text: 'A dedicated Slack or Teams channel with the people who build LiteLLM, and 24/7 SLAs down to one hour.', to: '/docs/enterprise/support'},
]} />

<SalesBand source="enterprise-page-mid" title="See it running on your own infrastructure" text="Talk to the team about your rollout and security review, and start a 30-day trial with a full license." />

## Who is Enterprise for?

For teams running LiteLLM at scale (100+ users or 10+ production AI use cases) that need SSO, audit logs, fine-grained access control, and professional support on top of open source. SSO is free for up to 5 users; beyond that, an Enterprise license is required. Engineers evaluating a trial can follow the [Production rollout](/docs/learn/enterprise_quickstart) guide, and teams already on open source can start with [Moving from OSS](/docs/enterprise/moving_from_oss).

## Full feature list

Everything below is enabled by the license key. Each item links to its setup guide.

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

- **[SOC 2 Type II](https://trust.litellm.ai/)**. Audited controls; request the report through the Trust Center
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

No data leaves your environment, and LiteLLM is [SOC 2 Type II](https://trust.litellm.ai/) audited. [Procurement is available through AWS and Azure Marketplace.](./data_security.md#legalcompliance-faqs)

Pricing depends on your deployment size. [Get in touch](https://enterprise.litellm.ai/demo) to scope it.

## Support {#professional-support}

Every license includes a dedicated Slack or Teams channel with the engineering team. With the optional 24/7 SLAs, the response time is 1 hour for Sev 0 and 72 hours for security patches. See [Support and SLA](/docs/enterprise/support) for hours, the full severity table, and custom SLAs.

## Version support

LiteLLM supports the four most recent stable minor lines, and Enterprise and open source share one image and one version number. See [Version support](/docs/enterprise/version_support).

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

### Is LiteLLM SOC 2 compliant?

</summary>

Yes. LiteLLM is SOC 2 Type II audited. Request the current report through the [LiteLLM Trust Center](https://trust.litellm.ai/). For data handling, vulnerability reporting, and the rest of the security review, see [Data Security, Legal, and Compliance FAQs](./data_security.md).

</details>

<details>
<summary>

### Can we buy through AWS or Azure Marketplace?

</summary>

Yes. You can buy an Enterprise license through AWS Marketplace or Azure Marketplace, or directly by invoice. See [Procurement Options](./data_security.md#legalcompliance-faqs).

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

<SalesBand source="enterprise-page-bottom" />
