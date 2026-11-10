---
title: Security
sidebar_label: Overview
description: Protect your LiteLLM gateway, manage secrets, and review network and compliance requirements.
---

# Security

{/* keep-version-note */}

Use these guides to protect your LiteLLM gateway, control its outbound requests, and store credentials safely.

Start with [Security Best Practices](../security_best_practices.md) for the production checklist. For installation and infrastructure setup, see [Deploy](../deploy.md).

## Choose a topic

| Topic | What it covers |
| --- | --- |
| [Security Best Practices](../security_best_practices.md) | Secure releases, access controls, network settings, secrets, and audit logs. |
| [SSL & HTTP Proxies](../../guides/security_settings.md) | Configure certificate verification, custom CA bundles, and outbound HTTP proxies. |
| [Outbound Requests and Offline Mode](../outbound_requests.md) | The external services LiteLLM contacts and which requests you can disable. |
| [OWASP LLM Top 10 mapping](../security_owasp_llm_top10.md) | How LiteLLM controls address LLM application risks, and what each control leaves to your application. |
| [FIPS Mode](../fips_mode.md) | Current support and limitations. FIPS mode is still a work in progress. |
| [Secret Managers](../../secret_managers/overview.md) | Read and store secrets with supported secret managers. These integrations require an Enterprise license. |
| [Docker Image Security](../docker_image_security.md) | Verify image signatures and review image security options. |

## Identity and access

[Authentication](../authentication.md) identifies callers and people who sign in to the Admin UI. [Access Management](../access_management/overview.md) controls which models, MCP servers, and agents they can use and manage.
