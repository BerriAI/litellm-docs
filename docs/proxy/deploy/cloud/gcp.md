---
title: GCP Reference Architectures
sidebar_label: GCP
description: Deploy LiteLLM on Cloud Run or GKE with HTTPS ingress, private database access, and separate public provider egress.
---

import { CloudArchitectureSelector } from '@site/src/components/CloudArchitecture';

# GCP

{/* keep-version-note */}

Choose Terraform on Cloud Run or Helm on an existing GKE cluster. The diagrams distinguish Google-managed services from your VPC and show the routes to private databases and public model providers.

<CloudArchitectureSelector provider="gcp" />

## Deploy this architecture

Follow [Terraform on GCP](../terraform/gcp.md) for the Cloud Run deployment or [Helm](../helm.md) for GKE. The Cloud Run module and the GKE example have different egress paths; use the notes below the selected diagram when you configure networking.

For identity-provider access checks, see [Google Cloud IAP](../iap/gcp.md). For client certificates, see [Client Authentication with mTLS](../mtls.md). For replicas, safe rollouts, and additional regions, see [High Availability](../ha/overview.md).
