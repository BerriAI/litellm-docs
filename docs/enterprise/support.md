---
title: Support and SLA
description: LiteLLM Enterprise support. Each license includes a shared Slack Connect channel with the LiteLLM engineers, or support by email. 24/7 response SLAs and custom SLAs are available.
---

# Support and SLA

## Standard support

Each Enterprise license includes a shared Slack Connect channel with the LiteLLM engineers. Use the channel for help with integration, deployment, and provider problems. Support does not run Microsoft Teams channels. If your company does not use Slack, use email support.

The support hours are 9am to 9pm PST, Monday through Friday. Standard support does not include a guaranteed response time.

You can also send an email to [support@berri.ai](mailto:support@berri.ai).

### How to request your channel

Send an email to [support@berri.ai](mailto:support@berri.ai) with your company name and the email address of your Slack workspace admin. Support sends the Slack Connect invite to that address. After your admin accepts the invite, the channel appears in your workspace.

## 24/7 support SLAs

If your team must get a guaranteed response time at all hours, you can buy 24/7 support SLAs for an additional fee.

| Severity | Response SLA |
|---|---|
| **Sev 0**. 100% of production traffic fails | 1 hour |
| **Sev 1**. Partial production impact | 6 hours |
| **Sev 2 to 3**. Setup problems and bugs that are not urgent | 24 hours (7am to 7pm PT, Monday through Saturday) |
| **Security patches** | 72 hours |

Custom SLAs are available on request. [Book a demo](https://enterprise.litellm.ai/demo) to discuss your requirements.

## What support covers

Support covers the problems that LiteLLM owns, for example the behavior of documented features, stability defects, and security patches. Your team owns the environment and the custom code that you add to the gateway. Refer to the [Shared responsibility model](../shared_responsibility.md).

LiteLLM supports the four most recent stable minor lines. If your version is older, upgrade first. Refer to [Version support](./version_support.md). This policy is paused during the [LTS pilot](./lts_pilot.md).

## Report a security vulnerability

Do not use the support channel to report a vulnerability. File a private report through [GitHub Security Advisories](https://github.com/BerriAI/litellm/security/advisories/new). Refer to [Data privacy and security](../data_security.md#security-vulnerability-reporting-guidelines).
