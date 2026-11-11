---
title: Terraform
sidebar_label: Terraform
toc_max_heading_level: 2
description: Deploy LiteLLM on AWS ECS Fargate or Google Cloud Run with Terraform, using one image for the gateway, backend, UI, and migrations.
---

# Terraform

{/* keep-version-note */}

Deploy LiteLLM on [AWS ECS Fargate](#aws) or [Google Cloud Run](#gcp). Both modules run the gateway, backend, UI, and migrations from one Docker image.

:::note Image compatibility

[Build and publish a shared image](../docker_quick_start.md#build-from-source) that matches the modules. Earlier releases with separate component images are incompatible with these examples.

:::

Use your existing Terraform pipeline and remote state backend. The runner needs Terraform 1.9 or later, Bash, and the authenticated cloud CLI for database bootstrap and migrations.

## AWS

The [AWS module](https://github.com/BerriAI/litellm/tree/f52f26d9c636038c6e3609cc7d17cf625d434c3e/terraform/litellm/aws) creates ECS Fargate services, an ALB, Aurora PostgreSQL, ElastiCache Redis, Secrets Manager entries, S3, and a VPC. See the [AWS reference architecture](./cloud/aws.md) for subnets, routing, and availability defaults.

Supply an ACM certificate for your gateway hostname and an image URI accessible to ECS. The runner needs the AWS CLI and permissions to create the stack's resources and IAM roles.

```hcl title="main.tf"
provider "aws" {
  region = "us-east-1"
}

variable "litellm_image" {
  type        = string
  description = "Unified LiteLLM image built from the pinned source commit."
}

variable "acm_certificate_arn" {
  type = string
}

variable "db_engine_version" {
  type        = string
  description = "Aurora PostgreSQL 16 version available in this region."
}

module "litellm" {
  source = "git::https://github.com/BerriAI/litellm.git//terraform/litellm/aws?ref=f52f26d9c636038c6e3609cc7d17cf625d434c3e"

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

Set the input variables through your pipeline. Choose an Aurora version offered in the target region; the module's default version is not available in every region. Set `litellm_license` if you use Enterprise features. The module generates a master key in Secrets Manager.

### Existing infrastructure

Add these inputs to the module to reuse infrastructure owned by your platform team:

| Resource | Module inputs |
| --- | --- |
| VPC and subnets | `vpc_id`, `public_subnet_ids`, `private_subnet_ids`; omit `azs` |
| PostgreSQL | `create_database = false`, `database_url` |
| Redis | `create_redis = false`, `redis_url` |
| Existing task security groups | `additional_task_security_group_ids` |

Allow the task security group to reach PostgreSQL and Redis. Supply subnets in at least two AZs when the module creates either data store. Existing private subnets need routes to the image registry, AWS services, and model providers; the module does not add routes to an existing VPC. See all [AWS inputs](https://github.com/BerriAI/litellm/blob/f52f26d9c636038c6e3609cc7d17cf625d434c3e/terraform/litellm/aws/variables.tf).

### After apply

Point your gateway's DNS record at `alb_dns_name`. Wait for the services before sending traffic:

```bash
LITELLM_CLUSTER="$(terraform output -raw ecs_cluster)"
aws ecs wait services-stable --cluster "$LITELLM_CLUSTER" \
  --services "$LITELLM_CLUSTER-gateway" "$LITELLM_CLUSTER-backend" "$LITELLM_CLUSTER-ui"
```

## GCP

The [GCP module](https://github.com/BerriAI/litellm/tree/f52f26d9c636038c6e3609cc7d17cf625d434c3e/terraform/litellm/gcp) creates Cloud Run services, an HTTPS load balancer, Cloud SQL PostgreSQL, Memorystore Redis, Secret Manager entries, GCS, and a VPC. See the [GCP reference architecture](./cloud/gcp.md) for private data connections and provider egress.

Publish the unified image to Artifact Registry and grant the Cloud Run service agent access to pull it. Cloud Run cannot pull directly from GHCR. The runner needs `gcloud` and permissions to create the stack and execute its migration job.

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
  description = "Unified image URI in Artifact Registry, pinned by tag or digest."
}

module "litellm" {
  source = "git::https://github.com/BerriAI/litellm.git//terraform/litellm/gcp?ref=f52f26d9c636038c6e3609cc7d17cf625d434c3e"

  project_id = "my-project"
  region     = "us-central1"
  tenant     = "acme"
  env        = "prod"

  image      = var.litellm_image
  lb_domains = ["llm.example.com"]

  gateway_extra_env = { STORE_MODEL_IN_DB = "True" }
  proxy_config = {
    litellm_settings = { cache = true }
  }
}

output "lb_ip" {
  value = module.litellm.lb_ip
}
```

Set `litellm_image` through your pipeline. Set `litellm_license` if you use Enterprise features. The module generates the master key and database password in Secret Manager.

### Existing infrastructure

Set `network_id` to reuse a VPC. If it already has Private Services Access, also set `create_psa_connection = false`. With Cloud Run enabled, the VPC connector must use a network in the deployment project.

For GKE, `create_runtime = false` creates the data dependencies without Cloud Run, its load balancer, connector, or migrations job. Deploy LiteLLM with [Helm](./helm.md). See all [GCP inputs](https://github.com/BerriAI/litellm/blob/f52f26d9c636038c6e3609cc7d17cf625d434c3e/terraform/litellm/gcp/variables.tf).

### After apply

Point the DNS record for `lb_domains` at `lb_ip`. The managed TLS certificate becomes ready after DNS resolves to the load balancer. Public model calls use direct Cloud Run egress by default; a fixed outbound IP requires the [Cloud NAT customization](./cloud/gcp.md) shown in the architecture notes.

## Configuration and upgrades

Manage models, teams, and keys with the [UI](../configuration/ui.md), [Management API](../configuration/api.md), or [Terraform provider](../configuration/terraform.md). The examples enable database-backed models and Redis caching. To declare models with the deployment, set `proxy_config.model_list`. Supply referenced provider credentials to both `gateway_extra_secrets` and `backend_extra_secrets`, since both services load this configuration.

Pin the module commit and image together in your deployment repository. Review `terraform plan` before applying an upgrade; each module runs migrations when the image changes. Use [Health Checks](../health.md) to verify readiness and [High Availability](./ha/overview.md) to plan replicas and rollouts.
