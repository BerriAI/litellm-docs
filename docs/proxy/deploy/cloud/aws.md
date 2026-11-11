---
title: AWS Reference Architectures
sidebar_label: AWS
description: Deploy LiteLLM on ECS Fargate or EKS with an internal ALB, corporate network access, private data stores, and NAT egress.
---

import { CloudArchitectureSelector } from '@site/src/components/CloudArchitecture';

# AWS

{/* keep-version-note */}

Connect corporate users and applications through VPN, Direct Connect, or an approved private access service. Use private DNS and an internal ALB. Keep ECS tasks or EKS workers and data stores in private subnets. NAT gateways serve outbound traffic only.

<CloudArchitectureSelector provider="aws" />

## Deploy this architecture

Use [Terraform on AWS](../terraform.md#aws) for ECS or [Helm](../helm.md) for EKS. Both targets use an internal ALB in private subnets across two availability zones. Allow HTTPS only from the corporate source ranges or private access service. Keep routes to those clients in both directions. [Internal load balancer access](https://docs.aws.amazon.com/elasticloadbalancing/latest/userguide/how-elastic-load-balancing-works.html).

### ECS module changes

The source module creates an internet-facing ALB and opens ports 80 and 443 to `0.0.0.0/0`. It has no input to select private ingress. Apply these changes in your platform's module fork before deployment:

| File | Required change |
| --- | --- |
| [alb.tf](https://github.com/BerriAI/litellm/blob/f52f26d9c636038c6e3609cc7d17cf625d434c3e/terraform/litellm/aws/alb.tf) | Set `aws_lb.this.internal = true`. Set its `subnets` to private subnet IDs in at least two AZs. Update its precondition to check those private subnets. Keep the ACM certificate and HTTPS listener. |
| [network.tf](https://github.com/BerriAI/litellm/blob/f52f26d9c636038c6e3609cc7d17cf625d434c3e/terraform/litellm/aws/network.tf) | Replace the ALB's public ingress rules with port 443 from approved corporate ranges. Remove port 80 ingress if you do not need an internal redirect. Keep workload ingress limited to the ALB security group. Add routes to your private access network. |
| Platform network and DNS | Create VPN, Direct Connect, or private access routes. Add a private DNS record for the ALB. Keep NAT in public egress subnets. |

The diagram keeps the module's single NAT gateway. Add one per AZ if your availability requirements need it. The ALB, tasks, and data stores can share the private subnet set shown. Keep security groups separate.

### EKS with Helm

Create the private cluster, data stores, network access, and AWS Load Balancer Controller before you install LiteLLM. Set `alb.ingress.kubernetes.io/scheme: internal` and select private ALB subnets. Use `alb.ingress.kubernetes.io/target-type: ip` for direct pod targets. Configure the ALB security group for corporate HTTPS sources. The chart's [ingress example](../helm.md#ingress) uses an internal ALB. See [EKS load balancing](https://docs.aws.amazon.com/eks/latest/userguide/alb-ingress.html).

For identity checks, see [Identity-Aware Proxy on AWS](../iap/overview.md#aws). For client certificates, see [Client Authentication with mTLS](../mtls.md). For replicas and rollouts, see [High Availability](../ha/overview.md).
