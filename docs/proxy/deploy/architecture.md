---
title: Reference Architectures
sidebar_label: Overview
toc_max_heading_level: 2
description: Choose a cloud deployment, protect client access, and plan LiteLLM availability, safe releases, and multiple regions.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Reference Architectures

{/* keep-version-note */}

Use these guides to decide where LiteLLM runs, how applications reach it, and how it stays available. Each guide shows the components you need and the responsibility of each one.

## Choose a topic {#cloud-architectures}

<Tabs queryString="architecture">
<TabItem value="cloud" label="Cloud" default>

### Choose your infrastructure

See the VPC or VNet, subnets, load balancer, LiteLLM instances, PostgreSQL, Redis, and outbound model connections. Start with [Cloud Deployments](./cloud/overview.md), then choose [Azure](./cloud/azure.md), [AWS](./cloud/aws.md), or [GCP](./cloud/gcp.md).

</TabItem>
<TabItem value="iap" label="Identity-Aware Proxy">

### Check identity before traffic reaches LiteLLM

Place an identity-aware access layer in front of LiteLLM. The guides distinguish browser sign-in from SDK and service access, and explain how those checks work alongside LiteLLM authentication.

Start with [Identity-Aware Proxy](./iap/overview.md), then choose [Cloudflare](./iap/cloudflare.md), [AWS](./iap/aws.md), [Azure](./iap/azure.md), or [GCP](./iap/gcp.md).

</TabItem>
<TabItem value="mtls" label="mTLS">

### Require a client certificate

An ingress proxy validates the application's certificate before it forwards a request. LiteLLM separately validates the application's key and model permissions.

[Client Authentication with mTLS](./mtls.md) includes diagrams, configuration for cloud and self-managed ingress, client examples, and checks for rejected certificates and keys.

</TabItem>
<TabItem value="ha" label="High Availability">

### Keep serving through failures and releases

Plan replicas, availability zones, and data-store availability in [High Availability](./ha/overview.md). Use [Blue/Green Deployments](./ha/blue_green.md) for a controlled cutover or [Canary Deployments](./ha/canary.md) for a gradual release.

For more than one region, use [Multi-Region Deployment](../multi_region.md), [Routing](./multi_region/routing.md), and [Failover](./multi_region/failover.md). These guides use the same concepts across cloud providers.

</TabItem>
<TabItem value="control-plane" label="Control Plane">

### Manage independent deployments

Use one UI to manage deployments that each have their own database, Redis, keys, and budgets. The [Global Control Plane](../global_control_plane.md) is an Enterprise feature. Each deployment remains independent; the control plane does not synchronize their state or route inference traffic between them.

</TabItem>
</Tabs>

## Choose a deployment mode

A single LiteLLM service handles inference, management APIs, and the Admin UI together. Microservices split gateway, backend, and UI into separate services. [Cloud Deployments](./cloud/overview.md#choose-a-deployment-mode) explains both options; [Helm](./helm.md) and [Terraform](./terraform.md) cover installation.

## Supporting infrastructure

PostgreSQL stores persistent gateway state and Redis shares fast-changing state across replicas. Start with [Sizing & Scaling](./sizing.md) to plan capacity. For model, team, and key changes after deployment, use [Configuration](../configuration/overview.md), including the [Management API](../configuration/api.md).

## More than one region or deployment

A [multi-region deployment](../multi_region.md) shares a database across regional LiteLLM instances. A [Global Control Plane](../global_control_plane.md) manages separate deployments with independent databases. Choose based on state ownership and failure boundaries, as well as where traffic enters.
