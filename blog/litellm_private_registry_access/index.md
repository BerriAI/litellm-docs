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

Public security patches can show attackers how a vulnerability works. For the most severe vulnerabilities, we share fixes privately first. This gives teams time to scan and deploy the patched version before we publish the fix and security advisory. **We continue to release all security fixes publicly.**

{/* truncate */}

In our [October announcement](/blog/litellm-private-registry), we shared our plans for the Private Registry. You can now pull container images and Helm charts through the access options below.

## Pull images and Helm charts

**OAuth:** Exchange your OAuth client credentials for temporary registry credentials, then pull container images and Helm charts.

**AWS ECR pull-through cache:** Cache artifacts in your own Amazon ECR and pull them with AWS IAM authentication.

We recommend mirroring artifacts into your own registry. You can scan images independently and deploy from your own infrastructure.

## Request access

Contact [support](mailto:support@berri.ai) to request access for your organization. Share feedback in the [GitHub discussion](https://github.com/BerriAI/litellm/discussions/48643).
