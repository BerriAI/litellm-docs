---
title: Terraform
sidebar_label: Terraform
toc_max_heading_level: 2
description: Deploy LiteLLM on AWS ECS Fargate or Google Cloud Run with Terraform and private access from your corporate network.
---

# Terraform

{/* keep-version-note */}

Deploy LiteLLM on [AWS ECS Fargate](#aws) or [Google Cloud Run](#gcp). Both modules run the gateway, backend, UI, and migrations from one Docker image.

Keep LiteLLM private and allow access from your corporate network.

Run Terraform 1.9 or later in your deployment pipeline. Install Bash and sign in to the AWS or Google Cloud CLI on the runner. Store Terraform state in a remote backend.

## AWS

The [AWS module](https://github.com/BerriAI/litellm/tree/f52f26d9c636038c6e3609cc7d17cf625d434c3e/terraform/litellm/aws) creates ECS Fargate services, an ALB, Aurora PostgreSQL, ElastiCache Redis, Secrets Manager entries, S3, and a VPC. See the [AWS reference architecture](./cloud/aws.md) for subnets, routing, and availability defaults.

The upstream module creates a public ALB. Apply the [private ingress changes](./cloud/aws.md#ecs-module-changes) in your platform fork before deploying. Replace the example module source URL and `DEPLOYMENT_VERSION` with your fork and tested version.

Provide an ACM certificate for your corporate gateway hostname. Use an image URI that ECS can pull. Give your deployment runner permission to create the AWS resources and IAM roles.

```hcl title="main.tf"
provider "aws" {
  region = "us-east-1"
}

variable "litellm_image" {
  type        = string
  description = "LiteLLM Docker image URI."
}

variable "acm_certificate_arn" {
  type = string
}

variable "db_engine_version" {
  type        = string
  description = "Aurora PostgreSQL 16 version available in this region."
}

module "litellm" {
  source = "git::https://git.example.com/platform/litellm.git//terraform/litellm/aws?ref=DEPLOYMENT_VERSION"

  region = "us-east-1"
  azs    = ["us-east-1a", "us-east-1b"]
  tenant = "acme"
  env    = "prod"

  image               = var.litellm_image
  acm_certificate_arn = var.acm_certificate_arn
  db_engine_version   = var.db_engine_version

  gateway_extra_env = { STORE_MODEL_IN_DB = "True" }
  proxy_config = {
    litellm_settings = { cache = true }
  }
}

output "alb_dns_name" {
  value = module.litellm.alb_dns_name
}

output "ecs_cluster" {
  value = module.litellm.ecs_cluster
}
```

Set the input variables through your pipeline. Set `litellm_image` to the [image you built for these modules](../docker_quick_start.md#build-from-source). Choose an Aurora version that your AWS region supports. Some regions do not support the module's default version. Set `litellm_license` if you use Enterprise features. The module generates a master key in Secrets Manager.

### Existing infrastructure

Add these inputs to use your existing infrastructure:

| Resource | Module inputs |
| --- | --- |
| VPC and subnets | `vpc_id`, `public_subnet_ids`, `private_subnet_ids`. Omit `azs`. |
| PostgreSQL | `create_database = false`, `database_url` |
| Redis | `create_redis = false`, `redis_url` |
| Existing task security groups | `additional_task_security_group_ids` |

Allow the task security group to reach PostgreSQL and Redis. Supply subnets in at least two AZs when the module creates either data store. Add routes from your private subnets to the image registry, AWS services, and model providers. The module does not add routes to an existing VPC. See all [AWS inputs](https://github.com/BerriAI/litellm/blob/f52f26d9c636038c6e3609cc7d17cf625d434c3e/terraform/litellm/aws/variables.tf).

### After apply

Point your gateway's private DNS record at `alb_dns_name`. Wait for the services to become stable before sending traffic:

```bash
LITELLM_CLUSTER="$(terraform output -raw ecs_cluster)"
aws ecs wait services-stable --cluster "$LITELLM_CLUSTER" \
  --services "$LITELLM_CLUSTER-gateway" "$LITELLM_CLUSTER-backend" "$LITELLM_CLUSTER-ui"
```

## GCP

The [GCP module](https://github.com/BerriAI/litellm/tree/f52f26d9c636038c6e3609cc7d17cf625d434c3e/terraform/litellm/gcp) creates Cloud Run services, an HTTPS load balancer, Cloud SQL PostgreSQL, Memorystore Redis, Secret Manager entries, GCS, and a VPC. See the [GCP reference architecture](./cloud/gcp.md) for private data connections and provider egress.

The upstream module creates a public load balancer. Apply the [private ingress changes](./cloud/gcp.md#cloud-run-module-changes) in your platform fork before deploying. Replace the example module source URL and `DEPLOYMENT_VERSION` with your fork and tested version.

Publish the LiteLLM image to Artifact Registry. Grant the Cloud Run service agent permission to pull it. Cloud Run cannot pull directly from GHCR. Give your deployment runner permission to create the GCP resources and run the migration job.

```hcl title="main.tf"
provider "google" {
  project = "my-project"
  region  = "us-central1"
}

provider "google-beta" {
  project = "my-project"
  region  = "us-central1"
}

variable "litellm_image" {
  type        = string
  description = "LiteLLM image URI in Artifact Registry with a tag or digest."
}

module "litellm" {
  source = "git::https://git.example.com/platform/litellm.git//terraform/litellm/gcp?ref=DEPLOYMENT_VERSION"

  project_id = "my-project"
  region     = "us-central1"
  tenant     = "acme"
  env        = "prod"

  image      = var.litellm_image
  lb_domains = ["llm.corp.example.com"]

  gateway_extra_env = { STORE_MODEL_IN_DB = "True" }
  proxy_config = {
    litellm_settings = { cache = true }
  }
}

output "lb_ip" {
  value = module.litellm.lb_ip
}
```

Set `litellm_image` to the [image you built for these modules](../docker_quick_start.md#build-from-source). Set `litellm_license` if you use Enterprise features. The module generates the master key and database password in Secret Manager.

### Existing infrastructure

Set `network_id` to reuse a VPC. If it already has Private Services Access, also set `create_psa_connection = false`. With Cloud Run enabled, the VPC connector must use a network in the deployment project.

For GKE, set `create_runtime = false` to create the data stores. This skips Cloud Run, its load balancer, VPC connector, and migration job. Deploy LiteLLM with [Helm](./helm.md). See all [GCP inputs](https://github.com/BerriAI/litellm/blob/f52f26d9c636038c6e3609cc7d17cf625d434c3e/terraform/litellm/gcp/variables.tf).

### After apply

Point the private DNS record for `lb_domains` at the internal load balancer IP. Configure its TLS certificate as described in the [GCP architecture](./cloud/gcp.md). Cloud Run calls public model APIs directly by default. To use a fixed outbound IP, [configure Cloud NAT](./cloud/gcp.md).

## Configuration and upgrades

Manage models, teams, and keys with the [UI](../configuration/ui.md), [Management API](../configuration/api.md), or [Terraform provider](../configuration/terraform.md). The examples enable database-backed models and Redis caching. To declare models with the deployment, set `proxy_config.model_list`. Add provider credentials to both `gateway_extra_secrets` and `backend_extra_secrets`. Both services load this configuration.

Pin the module commit and image together in your deployment repository. Review `terraform plan` before you apply an upgrade. Each module runs migrations when the image changes. Use [Health Checks](../health.md) to verify readiness and [High Availability](./ha/overview.md) to plan replicas and rollouts.
