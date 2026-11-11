---
title: AWS Reference Architectures
sidebar_label: AWS
description: Deploy LiteLLM on ECS Fargate or EKS with ALB ingress, private subnets, managed data stores, and optional Bedrock PrivateLink.
---

import { CloudArchitectureSelector } from '@site/src/components/CloudArchitecture';

# AWS

{/* keep-version-note */}

Choose Terraform on ECS Fargate or Helm on an existing EKS cluster. Each diagram shows the request path, private data connections, and outbound access across two availability zones.

<CloudArchitectureSelector provider="aws" />

## Deploy this architecture

Follow [Terraform on AWS](../terraform.md#aws) for the module-backed ECS deployment or [Helm](../helm.md) for EKS. Helm does not create the surrounding VPC, managed data stores, or load balancer controller.

For browser access through ALB authentication, see [Identity-Aware Proxy on AWS](../iap/aws.md). For certificate-based client access, see [Client Authentication with mTLS](../mtls.md). For replicas, safe rollouts, and additional regions, see [High Availability](../ha/overview.md).
