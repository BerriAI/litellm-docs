---
title: Deploy LiteLLM
sidebar_label: Overview
hide_table_of_contents: true
description: Deployment guides for Helm, Terraform, sizing, reference architectures, production readiness, upgrades, and health checks.
---

# Deploy LiteLLM

| Topic | Pages |
| --- | --- |
| [Helm](./deploy/helm.md) | Kubernetes deployment with `values.yaml` and Argo CD |
| [Terraform](./deploy/terraform.md) | [AWS](./deploy/terraform.md#aws), [GCP](./deploy/terraform.md#gcp) |
| [Sizing & Scaling](./deploy/sizing.md) | [Autoscaling](./deploy/autoscaling.md), [PostgreSQL](./db_sizing.md), [Redis](./redis_sizing.md), [Server Tuning](./server_tuning.md) |
| [Reference Architectures](./deploy/architecture.md) | [Cloud Deployments](./deploy/cloud/overview.md), [Identity-Aware Proxy](./deploy/iap/overview.md), [mTLS](./deploy/mtls.md), [High Availability](./deploy/ha/overview.md), [Multi-Region](./multi_region.md), [Global Control Plane](./global_control_plane.md) |
| [Production Best Practices](./prod.md) | Production configuration and readiness |
| [Upgrade Guide](./upgrade_guide.md) | Version upgrades and database migrations |
| [Health Checks](./health.md) | Readiness and liveness probes |
