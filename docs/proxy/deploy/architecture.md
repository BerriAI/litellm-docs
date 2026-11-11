---
title: Reference Architectures
sidebar_label: Overview
description: Compare LiteLLM deployment architectures on AWS, Google Cloud, and Azure, including multi-region and independent deployments.
---

import { CloudArchitectureSelector } from '@site/src/components/CloudArchitecture';

# Reference Architectures

{/* keep-version-note */}

Choose where LiteLLM runs and whether its services scale together or separately. The diagrams show network boundaries, public and private subnets, load balancers, private service access, and outbound routes on each cloud.

## Cloud architectures

Choose a cloud and deployment method. Terraform diagrams show the module defaults. Helm diagrams show example infrastructure that you provision separately. Dashed purple paths mark optional additions. Expand a diagram to inspect its subnets and traffic paths.

<CloudArchitectureSelector />

## Choose a deployment mode

| Mode | What runs | When to use it |
| --- | --- | --- |
| Monolithic | One LiteLLM service handles model traffic, management APIs, and the Admin UI. | You want a single service to deploy and operate. Use the `litellm-helm` chart. |
| Microservices | Separate gateway, backend, and UI services. | You want to scale model traffic separately from management. Use the componentized `litellm` chart or the Terraform modules. |

In microservices mode, the gateway serves model traffic on port 4000, the backend serves management APIs on port 4001, and the UI serves on port 3000. The [Helm guide](./helm.md) covers both modes; the [Terraform guide](./terraform.md) deploys the microservices stack on ECS Fargate or Cloud Run.

## Supporting infrastructure

| Component | Purpose |
| --- | --- |
| Load balancer | Gives clients one gateway address and routes traffic to healthy instances. |
| LiteLLM services | Handle model requests and management. Run multiple replicas for availability. |
| PostgreSQL | Stores keys, teams, users, spend logs, and configuration. |
| Redis | Shares rate limits, routing state, and caches across workers and replicas. See [What Needs Redis](../redis_requirements.md). |
| Migrations job | Updates the database schema before an upgrade. The Helm charts and Terraform modules run this job; serving instances set `DISABLE_SCHEMA_UPDATE=true`. |

Use [Sizing & Scaling](./sizing.md) to plan the resources for each component.

## More than one region or deployment

| Architecture | How it works | Guide |
| --- | --- | --- |
| Multi-region with a shared database | Regional gateways use one PostgreSQL database and a Redis instance per region, within one cloud provider. | [Multi-Region Deployment](../multi_region.md) |
| Independent deployments | Each deployment has its own database, Redis, keys, and budgets. One UI manages them. Requires Enterprise. | [Global Control Plane](../global_control_plane.md) |

A shared database keeps keys and configuration in one place, but all regions depend on it. Independent deployments isolate database failures; keys and budgets stay local to each deployment.
