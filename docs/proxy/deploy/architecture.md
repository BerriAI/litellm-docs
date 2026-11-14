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

Reference designs for cloud infrastructure, client access, and availability.

## Choose a topic {#cloud-architectures}

<Tabs queryString="architecture">
<TabItem value="cloud" label="Cloud" default>

### Choose your infrastructure

[Cloud Deployments](./cloud/overview.md): [Azure](./cloud/azure.md), [AWS](./cloud/aws.md), and [GCP](./cloud/gcp.md) diagrams with network boundaries, ingress, data stores, and provider egress.

</TabItem>
<TabItem value="iap" label="Identity-Aware Proxy">

### Check identity before traffic reaches LiteLLM

[Identity-Aware Proxy](./iap/overview.md): authenticate callers with [Cloudflare Access](./iap/overview.md#cloudflare), [AWS ALB](./iap/overview.md#aws), [Microsoft Entra Application Proxy](./iap/overview.md#azure), or [Google Cloud IAP](./iap/overview.md#gcp). Forward verified identity to LiteLLM for user and team permissions.

</TabItem>
<TabItem value="mtls" label="mTLS">

### Require a client certificate

[Client Authentication with mTLS](./mtls.md): validate client certificates at ingress and forward the workload identity to LiteLLM. Use virtual keys for model access and budgets. Includes load balancer and API gateway configurations.

</TabItem>
<TabItem value="ha" label="High Availability">

### Keep serving through failures and releases

Plan replicas, availability zones, and data-store availability in [High Availability](./ha/overview.md). Use [Blue/Green Deployments](./ha/blue_green.md) for a controlled cutover or [Canary Deployments](./ha/canary.md) for a gradual release.

For more than one region, see [Multi-Region Deployment](../multi_region.md), [Routing](./multi_region/routing.md), and [Failover](./multi_region/failover.md).

</TabItem>
<TabItem value="control-plane" label="Control Plane">

### Manage independent deployments

The [Global Control Plane](../global_control_plane.md) provides one management API for independent deployments, fleet inventory, usage reports, and audit export. Each data plane has its own database, Redis, keys, and budgets. See the [AWS, Azure, and GCP architectures](../global_control_plane/architecture.md) or the existing [UI Deployment Selector](../global_control_plane/legacy_ui.md).

</TabItem>
</Tabs>
