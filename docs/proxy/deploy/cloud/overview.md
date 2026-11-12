---
title: Cloud Deployments
sidebar_label: Overview
description: Deploy LiteLLM for corporate users through private cloud frontends on Azure, AWS, and Google Cloud.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Cloud Deployments

{/* keep-version-note */}

These architectures keep LiteLLM off the public internet. Corporate users and applications reach private frontends through VPN, a private cloud connection, or an approved private access service. Public model calls use a separate outbound path.

The diagrams show the recommended target. The AWS and GCP Terraform modules need the private-ingress changes listed in each cloud guide. Helm deploys LiteLLM into infrastructure you provide.

## Choose a cloud

<Tabs queryString="cloud">
<TabItem value="azure" label="Azure" default>

Run LiteLLM on AKS with a private Application Gateway frontend, managed PostgreSQL and Redis, and private endpoints. The [Azure architecture](./azure.md) shows separate gateway, backend, and UI services.

</TabItem>
<TabItem value="aws" label="AWS">

Use Terraform on ECS Fargate or Helm on EKS. The [AWS architectures](./aws.md) show private ALB ingress, private workloads, NAT egress, and optional Bedrock interface endpoints across two availability zones.

</TabItem>
<TabItem value="gcp" label="GCP">

Use Terraform on Cloud Run or Helm on GKE. The [GCP architectures](./gcp.md) show internal load balancers, private network access, private database connections, and NAT egress.

</TabItem>
</Tabs>

## Deployment layout {#choose-a-deployment-mode}

One Docker image serves every component. One Helm chart supports both layouts. Terraform deploys separate services.

| Layout | What runs | Helm value |
| --- | --- | --- |
| Single service | Inference, management APIs, and Admin UI together on port 4000. | `monolith.enabled: true` |
| Separate services (default) | Gateway on 4000, backend on 4001, and UI on 3000 scale independently. | `monolith.enabled: false` |
