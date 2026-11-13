---
title: Global Control Plane Cloud Architectures
sidebar_label: Cloud Architectures
toc_max_heading_level: 2
description: Connect a private LiteLLM control plane to regional data planes in AWS, Azure, GCP, or an on-premises data center.
---

import { GlobalControlPlaneArchitecture } from '@site/src/components/GlobalControlPlaneArchitecture';

# Cloud Architectures

{/* keep-version-note */}

Run the control plane in a management network and connect it to each data plane over private HTTPS. Corporate operators use the control-plane endpoint. Applications use their regional inference endpoint.

These reference designs use Kubernetes, one control-plane replica, and two independent data planes. Each cloud example uses one account, subscription, or project. The hybrid example connects AWS to an on-premises data center.

Configure the service with the [Configuration guide](./configuration.md). Use the [cloud deployment guides](../deploy/cloud/overview.md) for each data plane's replicas, availability zones, and model-provider connections.

## AWS

<GlobalControlPlaneArchitecture cloud="aws" />

| Boundary | Configuration |
| --- | --- |
| Account and regions | One AWS account. Management VPC in `us-east-1`. Separate data-plane VPCs in `us-east-2` and `eu-west-1`. |
| Corporate access | Connect through Direct Connect, Site-to-Site VPN, or your approved private access service. Publish private DNS names for internal ALBs. |
| Management connections | Peer the management VPC directly with each data-plane VPC. Use non-overlapping CIDRs and add return routes. Allow the control-plane source ranges to reach the regional ALB on TCP 443. |
| Private subnets | Place EKS workloads and regional data stores in private subnets. Configure ALBs as `internal`. Limit target access to the ALB security group. |
| Data stores | Each data plane has its own Aurora PostgreSQL and ElastiCache deployment. Allow database and Redis traffic only from that data plane. |
| Egress | Use an S3 VPC endpoint for the S3 audit sink. Route public IdP or SIEM connections through your approved outbound firewall and NAT. |

Use [inter-Region VPC peering](https://docs.aws.amazon.com/vpc/latest/peering/what-is-vpc-peering.html) for management traffic. Add both sides' routes and security-group rules. Peering is not transitive, so provide corporate connectivity to each required network separately. See [peering routes and limits](https://docs.aws.amazon.com/vpc/latest/peering/vpc-peering-basics.html).

## Azure

<GlobalControlPlaneArchitecture cloud="azure" />

| Boundary | Configuration |
| --- | --- |
| Subscription and regions | One Azure subscription. Management VNet in East US. Separate data-plane VNets in Central US and West Europe. |
| Corporate access | Use ExpressRoute, VPN Gateway, or your approved private access service. Resolve application hostnames through private DNS. |
| Management connections | Configure global VNet peering from management to each data plane. Allow control-plane traffic to the private Application Gateway listener on TCP 443. |
| Subnets | Use dedicated Application Gateway subnets and separate AKS workload subnets. Apply NSGs to restrict client, management, and backend traffic. |
| Data stores | Each data plane has its own PostgreSQL and Azure Managed Redis services. Use private connectivity and disable public access. |
| Egress | Allow the control plane to reach its configured IdP and audit endpoints through approved egress. Microsoft Sentinel also needs access to the Entra token endpoint. |

Use an Application Gateway v2 [private deployment](https://learn.microsoft.com/en-us/azure/application-gateway/application-gateway-private-deployment) with private listeners. [Global VNet peering](https://learn.microsoft.com/en-us/azure/virtual-network/virtual-network-peering-overview) connects the regional networks. Configure private DNS resolution across the peered networks.

## GCP

<GlobalControlPlaneArchitecture cloud="gcp" />

| Boundary | Configuration |
| --- | --- |
| Project and regions | One GCP project. Separate management and data-plane VPCs, with workload subnets in `us-central1`, `us-east4`, and `europe-west1`. |
| Corporate access | Use Cloud Interconnect, Cloud VPN, or your approved private access service. Publish the internal load-balancer addresses through Cloud DNS private zones. |
| Management connections | Peer the management VPC with each data-plane VPC. Add firewall rules for the required traffic and configure private DNS resolution. |
| Load balancers | Use regional internal Application Load Balancers. Create a proxy-only subnet in each load-balancer region. Enable global access on data-plane forwarding rules so the control plane can connect from another region. |
| Data stores | Each data plane has its own Cloud SQL PostgreSQL and Memorystore deployment. Use private service connectivity. The control plane connects to LiteLLM, not these data stores. |
| Egress | Use Cloud NAT or approved outbound proxies for public IdP and audit endpoints. An internal OTLP collector can forward audit records to your logging platform. |

GCP [VPC networks are global and subnets are regional](https://docs.cloud.google.com/vpc/docs/vpc). [VPC Network Peering](https://docs.cloud.google.com/vpc/docs/vpc-peering) connects the separate networks. Configure [global access for regional internal load balancers](https://docs.cloud.google.com/load-balancing/docs/l7-internal/setting-up-l7-internal#enable-global-access) for cross-region management traffic.

## Hybrid cloud

Manage an AWS data plane and an on-premises data plane through one control plane in AWS. Applications use the data plane in their own region or data center.

<GlobalControlPlaneArchitecture cloud="hybrid" />

| Boundary | Configuration |
| --- | --- |
| AWS account | Management VPC in `us-east-1` and data-plane VPC in `us-east-2`. Use inter-Region VPC peering for management traffic. |
| Data center | Run LiteLLM on Kubernetes behind a private HTTPS ingress. Keep its PostgreSQL and Redis in the data center. |
| VPN | Connect the management VPC to the data center with [AWS Site-to-Site VPN](https://docs.aws.amazon.com/vpn/latest/s2svpn/SetUpVPNConnections.html). Configure [both tunnels](https://docs.aws.amazon.com/vpn/latest/s2svpn/disaster-recovery-resiliency.html) and use non-overlapping CIDRs. |
| Routing | Add data-center routes to the control-plane subnet route tables and return routes on the on-premises router. Use BGP route propagation or static routes. |
| Access | Allow the control-plane source ranges to reach the on-premises ingress on TCP 443. Give corporate clients separate private connectivity to the AWS data-plane VPC. |
| DNS and TLS | Resolve the on-premises ingress hostname from the management VPC. Register that hostname as the data-plane URL and trust its certificate authority. |

The management VPC's VPN cannot provide corporate access through VPC peering to the AWS data plane. See [peering limitations](https://docs.aws.amazon.com/vpc/latest/peering/vpc-peering-basics.html#vpc-peering-limitations). You can use [Direct Connect with a private virtual interface](https://docs.aws.amazon.com/directconnect/latest/UserGuide/WorkingWithVirtualInterfaces.html) instead of VPN.

## Network access

Use separate hostnames or listener rules for management and inference. A data plane can share its private ingress, but only approved management sources should reach its management routes.

| Source | Destination | Allowed traffic |
| --- | --- | --- |
| Corporate operators and automation | Control-plane private ingress | HTTPS 443 for `/api/v1/*`. |
| Control plane | Registered data-plane private ingress | HTTPS 443 for supported management, usage, and health routes. |
| Applications | Regional data-plane private ingress | HTTPS 443 for their inference endpoints. |
| Each data plane | Its own PostgreSQL and Redis | Database and Redis ports with TLS. |
| Control plane | Configured identity provider | HTTPS 443 for JWKS and token exchange when enabled. |
| Control plane | Configured audit destinations | HTTPS or the configured private OTLP transport. |
| Private health probes | Control-plane service | `/healthz` and `/readyz` on the service port. |

For a corporate CA, mount a CA bundle and set `SSL_CERT_FILE` to its path. Include your corporate CA and the public roots required by your IdP and audit endpoints. Keep the hostname in each registry URL consistent with its certificate.

## Regions and availability

Keep each data plane's database and Redis independent. The control plane sends management requests across regions and returns fleet and usage data to its callers. Management responses and exported audit events can contain identities, configuration, and usage data, so choose the control-plane and audit-storage regions to match your data policy.

Run one worker process per control-plane replica. Login throttles, recent audit records, and audit delivery queues are local to each process. Multiple replicas do not share those values. Export audit events to a durable destination before relying on replica replacement or regional recovery. See [Audit Logs](./audit.md).

The control plane's `/readyz` endpoint checks the service, not the fleet. Monitor data planes through `/api/v1/dataplanes/{id}/health` and their own readiness checks. Keep inference routing and failover in the [regional deployment](../deploy/ha/overview.md) or [multi-region routing layer](../deploy/multi_region/routing.md).
