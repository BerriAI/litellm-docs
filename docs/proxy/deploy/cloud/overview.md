---
title: Cloud Deployments
sidebar_label: Overview
description: Compare the network, compute, database, and Redis resources around LiteLLM on Azure, AWS, and Google Cloud.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Cloud Deployments

{/* keep-version-note */}

Terraform diagrams show module defaults. Helm diagrams show infrastructure you provision around the chart.

## Choose a cloud

<Tabs queryString="cloud">
<TabItem value="azure" label="Azure" default>

Run LiteLLM on AKS with an Application Gateway, managed PostgreSQL and Redis, and private endpoints. The [Azure architectures](./azure.md) show a single service and separate gateway, backend, and UI services.

</TabItem>
<TabItem value="aws" label="AWS">

Use Terraform on ECS Fargate or Helm on EKS. The [AWS architectures](./aws.md) show availability zones, public and private subnets, ALB ingress, NAT egress, and optional Bedrock interface endpoints.

</TabItem>
<TabItem value="gcp" label="GCP">

Use Terraform on Cloud Run or Helm on GKE. The [GCP architectures](./gcp.md) show the load balancer, customer VPC, private database connections, and provider egress.

</TabItem>
</Tabs>

## Deployment layout {#choose-a-deployment-mode}

One Docker image serves every component. One Helm chart supports both layouts; Terraform deploys separate services.

| Layout | What runs | Helm value |
| --- | --- | --- |
| Single service | Inference, management APIs, and Admin UI together on port 4000. | `monolith.enabled: true` |
| Separate services (default) | Gateway on 4000, backend on 4001, and UI on 3000 scale independently. | `monolith.enabled: false` |
