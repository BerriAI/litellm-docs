---
title: Terraform
sidebar_label: Overview
description: Deploy LiteLLM on AWS or Google Cloud with Terraform modules that create the cloud infrastructure and LiteLLM services together.
---

# Terraform {#deploy-with-terraform-aws-and-gcp}

{/* keep-version-note */}

Use the LiteLLM Terraform modules to create a deployment on AWS or Google Cloud. Each module creates the cloud infrastructure and LiteLLM services together.

## Choose a guide

| Guide | What it does |
| --- | --- |
| [AWS](./terraform/aws.md) | Deploys the gateway, backend, and UI on ECS Fargate, with networking, PostgreSQL, Redis, secrets, and a load balancer. |
| [GCP](./terraform/gcp.md) | Deploys the gateway, backend, and UI on Cloud Run, with networking, PostgreSQL, Redis, secrets, and a load balancer. |

Neither cloud module needs Kubernetes. For Kubernetes, including Azure AKS, use [Helm](./helm.md).

## Start from Cloud Shell {#1-click-deploy-from-cloud-shell}

The [AWS guide](./terraform/aws.md#1-click-deploy-from-cloud-shell) walks through setup in AWS CloudShell. The [GCP guide](./terraform/gcp.md#1-click-deploy-from-cloud-shell) opens a guided Cloud Shell tutorial. Both let you deploy from a browser without installing Terraform on your own machine.

## Use your own configuration {#use-the-modules-directly}

Call the [AWS module](./terraform/aws.md#use-the-module-directly) or [GCP module](./terraform/gcp.md#use-the-module-directly) from your existing Terraform configuration. Each guide includes the required inputs and cloud-specific prerequisites.

The modules deploy separate gateway, backend, and UI services and run database migrations before the services start. Each module version defaults the component images to the matching LiteLLM release. Set `image_tag` to use a different release, or `image_registry` to pull from a mirror.

After the gateway is ready, use the [Terraform provider](../configuration/terraform.md) under Configuration to manage its resources as code. See [Reference Architectures](./architecture.md) to compare deployment layouts and [Sizing & Scaling](./sizing.md) to plan capacity.
