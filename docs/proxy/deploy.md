---
title: Deploy LiteLLM
sidebar_label: Overview
toc_max_heading_level: 2
description: Choose how to deploy LiteLLM with Helm or Terraform, plan capacity, and compare reference architectures.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Deploy LiteLLM

Run LiteLLM in your own infrastructure so applications can call your models through one gateway. Use Helm if you already run Kubernetes, or Terraform to create a deployment on AWS or Google Cloud.

For a first deployment on a single machine, start with the [Docker quickstart](./docker_quick_start.md). For production, plan for the gateway, a PostgreSQL database for keys and usage, and Redis to share state across replicas.

## Choose a topic

<Tabs queryString="topic">
<TabItem value="helm" label="Helm" default>

### Deploy on Kubernetes

Use the same Helm charts on EKS, GKE, AKS, or another Kubernetes cluster. You provide the database, Redis, and a way for clients to reach the gateway.

The [Helm guide](./deploy/helm.md) covers both a single LiteLLM service and separate gateway, backend, and UI services. It includes configuration, secrets, and cloud-specific data stores.

</TabItem>
<TabItem value="terraform" label="Terraform">

### Create the cloud infrastructure

Use the official Terraform modules to create the network, database, Redis, load balancer, and LiteLLM services together. AWS runs the services on ECS Fargate; Google Cloud runs them on Cloud Run.

Start with the [Terraform overview](./deploy/terraform.md), then follow the [AWS](./deploy/terraform/aws.md) or [GCP](./deploy/terraform/gcp.md) guide. Each covers Cloud Shell setup and a module you can use in your own configuration. For Azure, use [Helm on AKS](./deploy/helm.md).

To manage keys, teams, and models after deployment, use the [Terraform provider](./configuration/terraform.md) under Configuration.

</TabItem>
<TabItem value="sizing" label="Sizing & Scaling">

### Plan for your traffic

Size the gateway, PostgreSQL, and Redis together. More gateway replicas also mean more database connections and more shared state.

Start with the [Sizing & Scaling overview](./deploy/sizing.md), then use [database sizing](./db_sizing.md) and [Redis sizing](./redis_sizing.md) to plan capacity. The [autoscaling guide](./deploy/autoscaling.md) explains how to add replicas as request and token traffic grow.

</TabItem>
<TabItem value="architecture" label="Reference Architectures">

### Choose how the services fit together

Start with the Azure, AWS, or GCP network diagrams. Choose a single LiteLLM service or separate gateway, backend, and UI services, then add identity-aware access or client certificate authentication.

The [Reference Architectures overview](./deploy/architecture.md) connects these patterns with high availability, blue/green and canary releases, and multi-region routing and failover. Use a [Global Control Plane](./global_control_plane.md) when you need to manage independent deployments.

</TabItem>
</Tabs>

## Verify the deployment

Confirm the gateway is ready and can reach its database:

```bash
curl -s https://llm.example.com/health/readiness
```

Replace `llm.example.com` with your gateway's hostname. Open `/ui`, sign in, add a model, create a virtual key, and send a Playground message. A response checks the path through the load balancer, gateway, and model provider. The [quickstart](./docker_quick_start.md#2-log-in-to-the-admin-ui) shows these steps with screenshots; [Health Checks](./health.md) explains each probe.

## Production readiness and upgrades {#next-steps}

| Task | Guide |
| --- | --- |
| Prepare for production traffic | [Production Best Practices](./prod.md) |
| Update LiteLLM and run database migrations | [Upgrade Guide](./upgrade_guide.md) |
| Configure readiness and liveness probes | [Health Checks](./health.md) |
| Protect credentials and control network access | [Security](./security/overview.md) |
