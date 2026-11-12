---
slug: litellm-private-registry-access
title: "LiteLLM Private Registry is now available"
date: 2026-11-12
authors:
  - yassin
image: ./cover.png
description: "LiteLLM Private Registry is now available. Pull images and Helm charts with OAuth or AWS ECR pull-through access."
tags: [security]
hide_table_of_contents: true
---

import RegistryHero from './RegistryHero';

export const Hero = RegistryHero;

The **LiteLLM Private Registry is now available**.

Public security patches can show attackers how a vulnerability works. For the most severe vulnerabilities, LiteLLM shares fixes privately first. This gives teams time to scan and deploy the patched version before the fix and security advisory become public. **LiteLLM continues to release all security fixes publicly.**

{/* truncate */}

The [October announcement](/blog/litellm-private-registry) introduced plans for the Private Registry. Container images and Helm charts are now available through OAuth and AWS ECR pull-through access.

## Pull images and Helm charts

**OAuth:** Clients exchange OAuth credentials for temporary registry credentials, then pull container images and Helm charts.

**AWS ECR pull-through cache:** Teams cache artifacts in their Amazon ECR registry and pull them with AWS IAM authentication.

Mirroring artifacts into an organization's registry supports independent image scans and deployment from that registry.

## Request access

Contact [support](mailto:support@berri.ai) to request registry access. Share feedback in the [GitHub discussion](https://github.com/BerriAI/litellm/discussions/48643).
