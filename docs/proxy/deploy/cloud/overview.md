---
title: Cloud Deployments
sidebar_label: Overview
description: Compare the network, compute, database, and Redis resources around LiteLLM on Azure, AWS, and Google Cloud.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Cloud Deployments

{/* keep-version-note */}

Each cloud architecture shows where LiteLLM runs, how requests enter, and how it reaches databases and model providers. The diagrams include network boundaries, subnets, load balancers, private service connections, and internet egress.

Terraform diagrams describe the linked module defaults. Helm diagrams describe infrastructure you provision around the chart. Optional additions are labeled separately.

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

## Choose a deployment mode

| Mode | What runs | Guide |
| --- | --- | --- |
| Single service | One LiteLLM service handles inference, management APIs, and the Admin UI. | [Helm](../helm.md) |
| Microservices | Gateway, backend, and UI services scale separately. The gateway uses port 4000, backend 4001, and UI 3000. | [Helm](../helm.md) or [Terraform](../terraform.md) |

## Supporting infrastructure

| Component | Purpose |
| --- | --- |
| PostgreSQL | Stores keys, teams, users, spend, and configuration. |
| Redis | Shares rate limits, router state, and caches across replicas. See [What Needs Redis](../../redis_requirements.md). |
| Migrations job | Applies schema updates before an upgrade. Serving instances use `DISABLE_SCHEMA_UPDATE=true`. |
| Ingress | Accepts client traffic and forwards requests to healthy LiteLLM instances. |

Use [Sizing & Scaling](../sizing.md) to plan capacity and [High Availability](../ha/overview.md) to plan replicas and safe releases. For client certificate checks, use [Client Authentication with mTLS](../mtls.md). For identity-provider access checks, use [Identity-Aware Proxy](../iap/overview.md).
