---
title: AWS Reference Architectures
sidebar_label: AWS
description: Deploy LiteLLM on ECS Fargate or EKS with an internal ALB, corporate network access, private data stores, and NAT egress.
---

import { CloudArchitecture } from '@site/src/components/CloudArchitecture';

# AWS

{/* keep-version-note */}

Connect corporate users and applications through VPN, Direct Connect, or an approved private access service. Use private DNS and an internal ALB. Place ECS tasks or EKS workers and data stores in private subnets across two availability zones. NAT gateways serve outbound traffic only.

Allow HTTPS only from corporate source ranges or the private access service. Keep routes to those clients in both directions. See [internal load balancer access](https://docs.aws.amazon.com/elasticloadbalancing/latest/userguide/how-elastic-load-balancing-works.html).

## Terraform on ECS Fargate

Deploy with [Terraform on AWS](../terraform.md#aws).

<CloudArchitecture cloud="aws-ecs" />

### Private ingress {#ecs-module-changes}

The source module creates an internet-facing ALB and opens ports 80 and 443 to `0.0.0.0/0`. It has no input to select private ingress. Apply these changes to the module before deployment:

| File | Required change |
| --- | --- |
| [alb.tf](https://github.com/BerriAI/litellm/blob/f52f26d9c636038c6e3609cc7d17cf625d434c3e/terraform/litellm/aws/alb.tf) | Set `aws_lb.this.internal = true`. Set its `subnets` to private subnet IDs in at least two AZs. Update its precondition to check those private subnets. Keep the ACM certificate and HTTPS listener. |
| [network.tf](https://github.com/BerriAI/litellm/blob/f52f26d9c636038c6e3609cc7d17cf625d434c3e/terraform/litellm/aws/network.tf) | Replace the ALB's public ingress rules with port 443 from approved corporate ranges. Remove port 80 ingress if you do not need an internal redirect. Keep workload ingress limited to the ALB security group. Add routes to your private access network. |
| Platform network and DNS | Create VPN, Direct Connect, or private access routes. Add a private DNS record for the ALB. Keep NAT in public egress subnets. |

The module creates one NAT gateway. Add one per AZ if your availability requirements need it. Use separate security groups for the ALB, tasks, and data stores.

## Helm on EKS {#eks-with-helm}

Deploy separate gateway, backend, and UI services with [Helm](../helm.md).

<CloudArchitecture cloud="aws-eks-micro" />

Create the private cluster, data stores, network access, and AWS Load Balancer Controller before you install LiteLLM. Set `alb.ingress.kubernetes.io/scheme: internal` and select private ALB subnets. Use `alb.ingress.kubernetes.io/target-type: ip` for direct pod targets. Configure the ALB security group for corporate HTTPS sources. See the chart's [ingress settings](../helm.md#ingress) and [EKS load balancing](https://docs.aws.amazon.com/eks/latest/userguide/alb-ingress.html).

For identity checks, see [AWS ALB authentication](../iap/overview.md#aws). For client certificates, see [Client Authentication with mTLS](../mtls.md). For replicas and rollouts, see [High Availability](../ha/overview.md).
