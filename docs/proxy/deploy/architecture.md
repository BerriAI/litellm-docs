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

[Identity-Aware Proxy](./iap/overview.md): company sign-in and workload access with [Cloudflare](./iap/overview.md#cloudflare), [AWS](./iap/overview.md#aws), [Azure](./iap/overview.md#azure), or [GCP](./iap/overview.md#gcp). Forward verified identity so LiteLLM can create UI sessions or apply API permissions.

</TabItem>
<TabItem value="mtls" label="mTLS">

### Require a client certificate

[Client Authentication with mTLS](./mtls.md): validate client certificates at ingress and forward the workload identity to LiteLLM. Use virtual keys for model access and budgets. Includes load balancer and API gateway configurations.

</TabItem>
<TabItem value="ha" label="High Availability">

### Keep serving through failures and releases

Plan replicas, availability zones, and data-store availability in [High Availability](./ha/overview.md). Use [Blue/Green Deployments](./ha/blue_green.md) for a controlled cutover or [Canary Deployments](./ha/canary.md) for a gradual release.

For more than one region, use [Multi-Region Deployment](../multi_region.md), [Routing](./multi_region/routing.md), and [Failover](./multi_region/failover.md). These guides use the same concepts across cloud providers.

</TabItem>
<TabItem value="control-plane" label="Control Plane">

### Manage independent deployments

Use one UI to manage deployments that each have their own database, Redis, keys, and budgets. The [Global Control Plane](../global_control_plane.md) is an Enterprise feature. Each deployment remains independent. The control plane does not synchronize their state or route inference traffic between them.

</TabItem>
</Tabs>
