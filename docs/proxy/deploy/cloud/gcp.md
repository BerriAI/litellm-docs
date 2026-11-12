---
title: GCP Reference Architectures
sidebar_label: GCP
description: Deploy LiteLLM on Cloud Run or GKE with an internal load balancer, corporate network access, private data stores, and NAT egress.
---

import { CloudArchitecture } from '@site/src/components/CloudArchitecture';

# GCP

{/* keep-version-note */}

Connect corporate users and applications through Cloud VPN, Interconnect, or an approved private access service. Use private DNS and a regional internal Application Load Balancer. Keep model API egress separate from inbound requests.

Create a private frontend subnet and a separate proxy-only subnet with purpose `REGIONAL_MANAGED_PROXY` and role `ACTIVE`. Allocate the frontend IP from the frontend subnet. Reserve the proxy-only subnet for Google's load balancer proxies. See [internal load balancer setup](https://docs.cloud.google.com/load-balancing/docs/l7-internal/setting-up-l7-internal-serverless).

Corporate VPN tunnels or Interconnect attachments must connect in the load balancer's region unless you enable global access. Add private DNS and routes for the frontend IP. See [internal load balancer client access](https://docs.cloud.google.com/load-balancing/docs/l7-internal#client-access).

## Terraform on Cloud Run

Use [Terraform on GCP](../terraform.md#gcp) to deploy LiteLLM on Cloud Run.

<CloudArchitecture cloud="gcp-cloud-run" />

### Private ingress {#cloud-run-module-changes}

The source module creates a global external load balancer. It has no input to select an internal frontend. Make these changes in your platform's module fork before deployment:

| Source area | Required change |
| --- | --- |
| [load_balancer.tf](https://github.com/BerriAI/litellm/blob/f52f26d9c636038c6e3609cc7d17cf625d434c3e/terraform/litellm/gcp/load_balancer.tf) | Replace the global address with a regional internal address. Use `google_compute_region_backend_service`, `google_compute_region_url_map`, `google_compute_region_target_https_proxy`, and `google_compute_forwarding_rule`. Set the backend services and forwarding rule to `INTERNAL_MANAGED`. Set the forwarding rule's network, subnet, private IP, and port 443. Keep all three serverless NEGs and existing path routes. |
| TLS certificate | Replace the global managed certificate with a supported regional certificate. Use a regional Compute Engine SSL certificate or a regional Certificate Manager certificate. |
| [network.tf](https://github.com/BerriAI/litellm/blob/f52f26d9c636038c6e3609cc7d17cf625d434c3e/terraform/litellm/gcp/network.tf) | Add the frontend and proxy-only subnets, corporate network routes, and private DNS. Create Cloud Router and Cloud NAT for the VPC connector subnet. |
| [cloudrun.tf](https://github.com/BerriAI/litellm/blob/f52f26d9c636038c6e3609cc7d17cf625d434c3e/terraform/litellm/gcp/cloudrun.tf) | Set all three services to `INGRESS_TRAFFIC_INTERNAL_ONLY`. Set connector egress to `ALL_TRAFFIC` for gateway, backend, and migrations. Remove unused public domain mappings. |

Remove the old public forwarding rules and address. Internal Cloud Run ingress accepts traffic from the internal load balancer. Cloud Run stays outside the customer subnet. The inbound serverless NEG path does not use the outbound VPC connector. See [Cloud Run ingress](https://docs.cloud.google.com/run/docs/securing/ingress) and [regional TLS support](https://docs.cloud.google.com/load-balancing/docs/l7-internal#ssl-certificates).

Keep identity checks on the internal service. If you use IAP, grant Cloud Run Invoker to the IAP service agent and remove the module's `allUsers` invoker grants. Keep the Invoker IAM check enabled. Configure IAP on the load balancer or directly on Cloud Run, but not both. See [Google Cloud IAP](../iap/overview.md#gcp).

## Helm on GKE {#gke-with-helm}

Use the [Helm guide](../helm.md) to deploy LiteLLM on GKE. The diagram shows the chart's default separate services.

<CloudArchitecture cloud="gcp-gke-micro" />

Create a private GKE cluster and the network resources above. Use `gce-internal` Ingress or the `gke-l7-rilb` GatewayClass. Allow traffic from the proxy-only subnet and required health-check ranges to the pod backends. Configure routes for gateway, backend, and UI. Keep the cluster endpoint private. See [GKE internal Ingress](https://docs.cloud.google.com/kubernetes-engine/docs/how-to/internal-load-balance-ingress) and [Gateway setup](https://docs.cloud.google.com/kubernetes-engine/docs/how-to/deploying-gateways).

Use Cloud NAT for node and pod ranges that need public model APIs or registries. Keep Private Services Access for Cloud SQL and Memorystore. The Terraform module's `create_runtime = false` mode can create the data stores without Cloud Run or a public load balancer.

For client certificates, see [Client Authentication with mTLS](../mtls.md). For replicas and rollouts, see [High Availability](../ha/overview.md).
