---
title: Azure Reference Architectures
sidebar_label: Azure
description: Deploy LiteLLM on AKS with a private Application Gateway frontend, corporate network access, private endpoints, and NAT egress.
---

import { CloudArchitecture } from '@site/src/components/CloudArchitecture';

# Azure

{/* keep-version-note */}

Connect corporate users and applications through VPN, ExpressRoute, or an approved private access service. Use private DNS and a private Application Gateway frontend. Keep AKS and data connections private. NAT Gateway serves outbound provider calls.

## Helm on AKS {#deploy-this-architecture}

Use the [Helm guide](../helm.md). Create the VNet, private AKS cluster, Application Gateway, databases, private endpoints, and corporate network routes separately. The Helm chart deploys the LiteLLM workloads. The diagram shows the chart's default separate services.

<CloudArchitecture cloud="azure-aks-micro" />

Use Application Gateway v2 with a private-only frontend in its dedicated subnet. Delegate that subnet to `Microsoft.Network/applicationGateways`. Allow corporate client ranges to reach HTTPS on the private frontend. Configure private DNS for the gateway hostname. See [private Application Gateway deployment](https://learn.microsoft.com/en-us/azure/application-gateway/application-gateway-private-deployment).

Use AGIC v1.7 or later. Set `appgw.ingress.kubernetes.io/use-private-ip: "true"` on the LiteLLM Ingress. Configure a private frontend first. AGIC ignores this annotation when the gateway has no private IP. It sends requests directly to pod private IPs. Set routes and health probes for your service layout. See [AGIC private IP configuration](https://learn.microsoft.com/en-us/azure/application-gateway/ingress-controller-private-ip).

Associate NAT Gateway with the AKS subnet for outbound public API calls. Keep PostgreSQL, Redis, and optional Azure OpenAI private endpoints on their private paths. Disable public access to these data services and link their private DNS zones to the VNet.

For identity checks, see [Microsoft Entra Application Proxy](../iap/overview.md#azure). For client certificates, see [Client Authentication with mTLS](../mtls.md). For replicas and rollouts, see [High Availability](../ha/overview.md).
