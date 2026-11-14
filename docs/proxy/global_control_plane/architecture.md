---
title: Global Control Plane Reference Architectures
sidebar_label: Reference Architectures
toc_max_heading_level: 2
description: Connect a private LiteLLM control plane to regional data planes in AWS, Azure, GCP, or an on-premises data center.
---

import { GlobalControlPlaneArchitecture } from '@site/src/components/GlobalControlPlaneArchitecture';

# Reference Architectures

{/* keep-version-note */}

Run the control plane in a management network and connect it to each data plane over private HTTPS. Corporate operators use the control-plane endpoint. Applications use their regional inference endpoint.

These reference designs use Kubernetes, one control-plane replica, and two independent data planes. Each cloud example uses one account, subscription, or project. The hybrid example connects AWS to an on-premises data center.

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

## Restrict data plane management access

LiteLLM supports direct management access. This example restricts it to the global control plane. Corporate applications reach the gateway through one internal ALB. The gateway omits the management routes. The control plane reaches the management backend through a separate internal ALB.

Merge these values into your data plane's existing Helm configuration. This example uses release `us-prod` in namespace `litellm`:

```yaml title="values.yaml"
fullnameOverride: litellm-us
monolith:
  enabled: false
gateway:
  enabled: true
  service:
    type: ClusterIP
    port: 4000
backend:
  enabled: true
  service:
    type: ClusterIP
    port: 4001
ui:
  enabled: false
ingress:
  enabled: false
```

Create separate ingress resources with the AWS Load Balancer Controller. Route the corporate ingress only to `litellm-us-gateway:4000` and limit its source CIDRs to corporate networks. Leave `alb.ingress.kubernetes.io/group.name` unset on both ingresses so they use separate ALBs.

The management ingress below accepts only the control plane's dedicated source CIDR, `10.40.8.0/24`. Use the source addresses the ALB sees after any NAT. Reserve that range for control plane traffic rather than sharing it with other workloads. Replace the subnet IDs with two private ALB subnets whose CIDRs are `10.60.0.0/24` and `10.60.1.0/24`. Replace the certificate ARN with an ACM certificate for the management hostname.

```yaml title="management-ingress.yaml"
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: litellm-us-management
  namespace: litellm
  annotations:
    alb.ingress.kubernetes.io/scheme: internal
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTPS":443}]'
    alb.ingress.kubernetes.io/certificate-arn: arn:aws:acm:us-east-2:123456789012:certificate/REPLACE_ME
    alb.ingress.kubernetes.io/inbound-cidrs: 10.40.8.0/24
    alb.ingress.kubernetes.io/subnets: subnet-MGMT_A,subnet-MGMT_B
    alb.ingress.kubernetes.io/healthcheck-path: /health/readiness
spec:
  ingressClassName: alb
  rules:
    - host: litellm-us-management.internal.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: litellm-us-backend
                port:
                  number: 4001
```

The controller creates the ALB security group from `inbound-cidrs` and manages access to its targets. Adding a custom `security-groups` annotation disables `inbound-cidrs`. See [ALB access control](https://kubernetes-sigs.github.io/aws-load-balancer-controller/latest/guide/ingress/annotations/#access-control).

Enable [VPC CNI network policy enforcement](https://docs.aws.amazon.com/eks/latest/userguide/cni-network-policy-configure.html). To enforce policies from pod startup, set `NETWORK_POLICY_ENFORCING_MODE=strict` on `aws-node`. Configure the cluster's required network policies, including DNS, before enabling strict mode. Apply this policy to block direct access to backend pods and their ClusterIP service. It allows port `4001` only from the management ALB subnets:

```yaml title="backend-network-policy.yaml"
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: litellm-us-backend
  namespace: litellm
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/name: litellm
      app.kubernetes.io/instance: us-prod
      app.kubernetes.io/component: backend
  policyTypes:
    - Ingress
  ingress:
    - from:
        - ipBlock:
            cidr: 10.60.0.0/24
        - ipBlock:
            cidr: 10.60.1.0/24
      ports:
        - protocol: TCP
          port: 4001
```

Reserve these subnets for trusted ALBs. The policy matches ALB source addresses, not the control plane's addresses. Remove other policies that grant broader backend access because [NetworkPolicy permissions are additive](https://kubernetes.io/docs/concepts/services-networking/network-policies/#the-two-sorts-of-pod-isolation).

Point private DNS for `litellm-us-management.internal.example.com` to the management ALB. Set the data plane registry entry's `url` to `https://litellm-us-management.internal.example.com`. LiteLLM still checks the caller's identity and permissions on each management request.
