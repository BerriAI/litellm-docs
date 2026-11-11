---
title: Azure Reference Architectures
sidebar_label: Azure
description: Deploy LiteLLM on AKS with Application Gateway, private endpoints, PostgreSQL, Redis, and NAT egress.
---

import { CloudArchitectureSelector } from '@site/src/components/CloudArchitecture';

# Azure

{/* keep-version-note */}

Run LiteLLM on AKS with one service or separate gateway, backend, and UI services. The diagrams show Application Gateway ingress, the AKS subnet, private endpoint connections, and NAT egress.

<CloudArchitectureSelector provider="azure" />

## Deploy this architecture

Use the [Helm guide](../helm.md). Provision the VNet, AKS cluster, Application Gateway integration, databases, and private endpoints separately. These are reference architectures for infrastructure around the chart; they are not an Azure Terraform module.

For identity-provider access checks, see [Identity-Aware Proxy on Azure](../iap/azure.md). For client certificates, see [Client Authentication with mTLS](../mtls.md). For replicas, safe rollouts, and additional regions, see [High Availability](../ha/overview.md).
