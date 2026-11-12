---
slug: litellm-private-registry-access
title: "Access the LiteLLM Private Registry"
date: 2026-11-12
authors:
  - yassin
image: ./cover.png
description: "Enterprise customers and vetted open-source organizations can request Private Registry access, with OAuth or AWS ECR pull-through cache."
tags: [security]
hide_table_of_contents: true
---

import RegistryHero from './RegistryHero';

export const Hero = RegistryHero;

Enterprise customers and vetted organizations using open-source LiteLLM can request access to the **LiteLLM Private Registry**. Access is subject to vetting and a non-disclosure agreement (NDA).

Public security patches can show attackers how a vulnerability works. For the most severe vulnerabilities, we share fixes privately first. This gives approved organizations time to scan and deploy the patched version before we publish the fix and security advisory. **We continue to release all security fixes publicly.**

{/* truncate */}

This builds on our [Private Registry announcement](/blog/litellm-private-registry).

## Pull images and Helm charts

**OAuth:** Exchange your OAuth client credentials for temporary registry credentials, then pull container images and Helm charts.

**AWS ECR pull-through cache:** Cache artifacts in your own Amazon ECR and pull them with AWS IAM authentication.

We recommend mirroring artifacts into your own registry. You can scan images independently and deploy from your own infrastructure.

## Request access

Join the [GitHub discussion on Private Registry access](https://github.com/BerriAI/litellm/discussions/48643) to ask about access for your organization and share feedback on the vetting process.
