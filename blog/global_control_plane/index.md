---
slug: global-control-plane
title: "LiteLLM Global Control Plane is now available"
date: 2026-11-16
authors:
  - yassin
image: ./cover.png
description: "Manage independent LiteLLM deployments across regions and clouds through one API, with central usage reporting and local inference."
tags: [enterprise, ai-gateway]
hide_table_of_contents: true
---

import GlobalControlPlaneHero from './GlobalControlPlaneHero';

export const Hero = GlobalControlPlaneHero;

The **LiteLLM Global Control Plane is now available**. Manage keys, teams, models, and budgets across independent LiteLLM deployments through one API.

Teams run separate gateways across regions and clouds to keep their infrastructure and credentials isolated. Each deployment has its own resources to manage and usage to track. The Global Control Plane gives operators one endpoint to work across those deployments.

{/* truncate */}

## Manage centrally, run inference locally

Select a deployment to manage its resources, or compare spend, requests, and tokens across deployments. You can restrict operators to specific deployments and roles. Each gateway also checks the caller's local permissions.

Applications send inference requests directly to their regional gateway. Each gateway keeps its own PostgreSQL, Redis, keys, and budgets. The control plane receives management and usage data; inference continues on the regional gateways if the control plane is unavailable.

## Get started

The Global Control Plane requires a LiteLLM Enterprise license. [Read the setup guide](https://docs.litellm.ai/docs/proxy/global_control_plane) for configuration, API examples, and reference architectures for AWS, Azure, GCP, and hybrid cloud.
