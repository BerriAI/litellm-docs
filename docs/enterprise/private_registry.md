---
title: Private container registry
description: Learn what LiteLLM publishes in its private registry, how to use it with your own registry, and how to request access.
---

# Private container registry

The LiteLLM private registry hosts Enterprise container images and the LiteLLM Helm chart. For the most severe vulnerabilities, LiteLLM makes patched images available here before public disclosure so your team has time to scan and deploy them. You can also [activate your Enterprise license](./activate.md) on the gateway you already run.

## How to use the registry

LiteLLM recommends mirroring artifacts into your own private registry. This lets you scan images before deployment and pull from your own registry during a rollout.

On AWS, use an Amazon ECR pull-through cache to pull LiteLLM artifacts through your own ECR registry. You can also use OAuth credentials to pull directly from LiteLLM or mirror artifacts into another registry.

## Request access

If your organization has a confidentiality agreement with LiteLLM, contact [Enterprise support](./support.md) for access and the customer setup guide. For an ECR pull-through cache, include your 12-digit AWS account ID so LiteLLM can grant cross-account access. For direct pulls or mirroring with OAuth, ask for the registry access bundle.
