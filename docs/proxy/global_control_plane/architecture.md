---
title: Global Control Plane Reference Architectures
sidebar_label: Reference Architectures
toc_max_heading_level: 2
description: Connect a private LiteLLM control plane to regional data planes in AWS, Azure, GCP, or an on-premises data center.
---

import { GlobalControlPlaneArchitecture } from '@site/src/components/GlobalControlPlaneArchitecture';

# Reference Architectures

{/* keep-version-note */}

## Overview

Run the control plane in a management network and connect it to each data plane over private HTTPS. Corporate operators use the control-plane endpoint. Applications use their regional inference endpoint.

The control plane uses dedicated PostgreSQL and Redis for [runtime configuration](./configuration.md#runtime-configuration). Each data plane keeps its own stores.

See [Configuration](./configuration.md) for service settings. Use the [cloud deployment guides](../deploy/cloud/overview.md) for each data plane's replicas, availability zones, and model-provider connections.

For [OIDC token exchange](./configuration.md#data-plane-jwt-authentication), allow outbound HTTPS to the IdP from the control plane and each data plane. The control plane exchanges tokens. Each data plane fetches the IdP's signing keys and validates the exchanged token with its own JWT configuration.

## AWS

<GlobalControlPlaneArchitecture cloud="aws" />

Use [inter-Region VPC peering](https://docs.aws.amazon.com/vpc/latest/peering/what-is-vpc-peering.html) for management traffic. Add both sides' routes and security-group rules. Peering is not transitive, so provide corporate connectivity to each required network separately. See [peering routes and limits](https://docs.aws.amazon.com/vpc/latest/peering/vpc-peering-basics.html).

## Azure

<GlobalControlPlaneArchitecture cloud="azure" />

Use an Application Gateway v2 [private deployment](https://learn.microsoft.com/en-us/azure/application-gateway/application-gateway-private-deployment) with private listeners. [Global VNet peering](https://learn.microsoft.com/en-us/azure/virtual-network/virtual-network-peering-overview) connects the regional networks. Configure private DNS resolution across the peered networks.

## GCP

<GlobalControlPlaneArchitecture cloud="gcp" />

GCP [VPC networks are global and subnets are regional](https://docs.cloud.google.com/vpc/docs/vpc). [VPC Network Peering](https://docs.cloud.google.com/vpc/docs/vpc-peering) connects the separate networks. Configure [global access for regional internal load balancers](https://docs.cloud.google.com/load-balancing/docs/l7-internal/setting-up-l7-internal#enable-global-access) for cross-region management traffic.

## Hybrid cloud

Manage an AWS data plane and an on-premises data plane through one control plane in AWS. Applications use the data plane in their own region or data center.

<GlobalControlPlaneArchitecture cloud="hybrid" />

The management VPC's VPN cannot provide corporate access through VPC peering to the AWS data plane. See [peering limitations](https://docs.aws.amazon.com/vpc/latest/peering/vpc-peering-basics.html#vpc-peering-limitations). You can use [Direct Connect with a private virtual interface](https://docs.aws.amazon.com/directconnect/latest/UserGuide/WorkingWithVirtualInterfaces.html) instead of VPN.
