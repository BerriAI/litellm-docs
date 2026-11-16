---
slug: global-control-plane
title: "LiteLLM Global Control Plane API is now available"
date: 2026-11-16
authors:
  - yassin
image: ./cover.png
description: "Manage independent LiteLLM deployments through one API. Isolate regional data and limit the impact of PostgreSQL and Redis failures."
tags: [enterprise, ai-gateway]
hide_table_of_contents: true
---

import GlobalControlPlaneHero from './GlobalControlPlaneHero';

export const Hero = GlobalControlPlaneHero;

The **LiteLLM Global Control Plane API is now available**. Manage deployments across regions and clouds while keeping their databases, Redis instances, and credentials separate.

The Global Control Plane previously provided a [UI for managing multiple deployments](https://docs.litellm.ai/docs/proxy/global_control_plane/legacy_ui). The new API brings that management to scripts, automation, and internal platforms.

{/* truncate */}

## Isolate database and Redis failures

Each regional gateway uses its own PostgreSQL database and Redis instance. This limits the impact of a database or Redis outage to the affected deployment. Other deployments continue serving inference with their own dependencies.

Applications send inference requests directly to their regional gateway. Regional inference also continues if the control plane is unavailable.

## Keep data isolated

Separate deployments by region or team, with local keys, teams, budgets, provider credentials, and storage. Each deployment's database and Redis stay in its own environment. The control plane receives management and usage data.

Use the API to manage keys, teams, models, and budgets on a selected deployment. You can restrict operators to specific deployments and roles, and each gateway also checks the caller's local permissions.

## Get started

The Global Control Plane API requires a LiteLLM Enterprise license. [Read the setup guide](https://docs.litellm.ai/docs/proxy/global_control_plane) for configuration, API examples, and reference architectures for AWS, Azure, GCP, and hybrid cloud.
