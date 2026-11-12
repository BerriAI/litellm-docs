---
slug: litellm-enterprise-registry
title: "Introducing the LiteLLM Enterprise Registry"
date: 2026-11-11
authors:
  - yassin
image: ./cover.png
description: "Access LiteLLM Enterprise images and Helm charts through OAuth or AWS ECR pull-through cache, with private mirroring and independent image scanning."
tags: [security, enterprise]
hide_table_of_contents: true
---

import RegistryHero from './RegistryHero';

export const Hero = RegistryHero;

The LiteLLM Enterprise Registry gives enterprise customers access to private container images and Helm charts through OAuth or AWS ECR pull-through cache.

Public security patches can reveal vulnerabilities before teams have time to upgrade. As outlined in our [private registry announcement](/blog/litellm-private-registry), distributing fixes for the most severe vulnerabilities privately gives customers time to apply them before public disclosure. All security fixes will continue to be released publicly.

{/* truncate */}

We recommend mirroring these artifacts into your own registry. This lets you scan images independently before deployment and reduces deployment-time dependence on LiteLLM's registry.

## Access the registry

**OAuth:** Use your OAuth client credentials to request temporary registry credentials. Pull images and Helm charts directly, or mirror them into your private registry.

**AWS ECR pull-through cache:** Cache artifacts in your own ECR and pull using AWS IAM authentication, without the LiteLLM OAuth exchange. Share your AWS account ID with us to enable access, then configure a pull-through cache rule.

## Get started

Contact your LiteLLM team to enable registry access. To get started with LiteLLM Enterprise, [talk to us](https://www.litellm.ai/enterprise).
