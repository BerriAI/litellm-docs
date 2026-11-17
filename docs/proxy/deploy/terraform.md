---
title: Deploy with Terraform
sidebar_label: Terraform
toc_max_heading_level: 3
description: Deploy LiteLLM on AWS ECS Fargate or Google Cloud Run. Look up Terraform module inputs and defaults.
---

import styles from '@site/src/css/moduleReference.module.css';

# Deploy with Terraform

{/* keep-version-note */}

## Prerequisites

Use Terraform 1.9 or newer and Bash. Configure cloud credentials for Terraform and authenticate the AWS or Google Cloud CLI.

Both modules create public load balancers by default. Apply the [AWS private ingress changes](./cloud/aws.md#ecs-module-changes) or [GCP private ingress changes](./cloud/gcp.md#cloud-run-module-changes) before deployment.

The modules create PostgreSQL and Redis. Use the [sizing guide](./sizing.md) to choose their capacity.

## Deploy the module

Save your cloud's example as `main.tf`. Set `source` to the module location and version that includes your private ingress changes.

### AWS {#aws}

Provide an ACM certificate for your corporate hostname. Choose an Aurora PostgreSQL 16 version that your AWS region supports. See the [AWS reference architecture](./cloud/aws.md).

```hcl title="main.tf"
provider "aws" {
  region = "us-east-1"
}

variable "acm_certificate_arn" {
  type = string
}

variable "db_engine_version" {
  type = string
}

module "litellm" {
  source = "git::https://git.example.com/platform/litellm.git//terraform/litellm/aws?ref=DEPLOYMENT_VERSION"

  region = "us-east-1"
  azs    = ["us-east-1a", "us-east-1b"]
  tenant = "acme"
  env    = "prod"

  image               = "ghcr.io/berriai/litellm:lts"
  acm_certificate_arn = var.acm_certificate_arn
  db_engine_version   = var.db_engine_version

  gateway_extra_env = { STORE_MODEL_IN_DB = "True" }
}

output "alb_dns_name" {
  value = module.litellm.alb_dns_name
}
```

After apply, point your private DNS record at `alb_dns_name`.

### GCP {#gcp}

Enable the [required APIs](https://github.com/BerriAI/litellm/blob/f52f26d9c636038c6e3609cc7d17cf625d434c3e/terraform/litellm/gcp/examples/default/TUTORIAL.md#enable-required-apis). Make the LiteLLM `lts` image available in Artifact Registry and grant the Cloud Run service agent permission to pull it. See the [GCP reference architecture](./cloud/gcp.md).

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
  description = "LiteLLM image URI in Artifact Registry."
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
}

output "lb_ip" {
  value = module.litellm.lb_ip
}
```

After apply, point your private DNS record for `lb_domains` at `lb_ip`.

### Apply

```bash
terraform init
terraform plan -out=tfplan
terraform apply tfplan
```

Use [Health Checks](../health.md) to verify the deployment.


## Inputs reference

See all [AWS inputs](https://github.com/BerriAI/litellm/blob/f52f26d9c636038c6e3609cc7d17cf625d434c3e/terraform/litellm/aws/variables.tf) and [GCP inputs](https://github.com/BerriAI/litellm/blob/f52f26d9c636038c6e3609cc7d17cf625d434c3e/terraform/litellm/gcp/variables.tf).

<div className={styles.reference}>

<details>
<summary>AWS network and data</summary>

| Input | Default | Description |
| --- | --- | --- |
| `region`, `tenant`, `env` | Required | AWS region and names for the deployment. |
| `tags` | `{}` | Tags for module resources. |
| `vpc_id` | `""` | Existing VPC ID. Empty creates a VPC, subnets, and NAT gateway. Supply routes for an existing VPC. |
| `vpc_cidr`, `azs` | `"10.40.0.0/16"`, `[]` | New VPC address range and availability zones. Set at least two zones when the module creates the VPC. |
| `public_subnet_ids`, `private_subnet_ids` | `[]`, `[]` | Required with an existing VPC. Use at least two availability zones. The upstream module places the public ALB in public subnets and tasks and data stores in private subnets. |
| `additional_task_security_group_ids` | `[]` | Extra security groups for ECS tasks. |
| `acm_certificate_arn`, `allow_plaintext_alb` | `""`, `false` | Supply an ACM certificate for HTTPS. The default rejects an HTTP-only load balancer. |
| `create_database`, `database_url` | `true`, `""` | Create Aurora. Set the first value to `false` and supply a connection URL to use an existing database. |
| `db_instance_class`, `db_engine_version` | `"db.r6g.large"`, `"16.4"` | Aurora instance class and PostgreSQL version. Select a version available in your region. |
| `db_name`, `db_username` | `"litellm"`, `"litellm_app"` | Database name and IAM application user. |
| `create_redis`, `redis_url` | `true`, `""` | Create ElastiCache. Set the first value to `false` and supply a connection URL to use existing Redis. |
| `redis_node_type`, `redis_num_replicas` | `"cache.t4g.small"`, `1` | Redis node type and replica count, in addition to the primary. |
| `skip_final_snapshot`, `s3_force_destroy` | `false`, `false` | Control final database snapshots and deletion of a nonempty S3 bucket. |

</details>

<details>
<summary>AWS runtime and configuration</summary>

| Input | Default | Description |
| --- | --- | --- |
| `image` | `""` | Full image URI for every component. Overrides the registry and tag inputs. |
| `image_registry`, `image_tag` | `"ghcr.io/berriai"`, `""` | Forms the image URI as `registry/litellm:tag`. Supply a tag or a full `image` URI. |
| `gateway_cpu`, `gateway_memory`, `gateway_desired_count` | `1024`, `4096`, `2` | Gateway CPU units, memory in MiB, and initial task count. |
| `backend_cpu`, `backend_memory`, `backend_desired_count` | `1024`, `4096`, `1` | Backend CPU units, memory in MiB, and initial task count. |
| `ui_cpu`, `ui_memory`, `ui_desired_count` | `256`, `512`, `1` | UI CPU units, memory in MiB, and initial task count. |
| `gateway_num_workers` | `1` | Gateway workers per task. |
| `gateway_connection_pool_enabled`, `gateway_pool_max_db_connections`, `gateway_pool_max_client_conn` | `false`, `20`, `1000` | Enable PgBouncer and set its database and client connection limits. |
| `gateway_autoscaling_enabled`, `gateway_min_capacity`, `gateway_max_capacity` | `true`, `1`, `10` | Enable gateway autoscaling and set its task range. Autoscaling controls counts after deployment. |
| `gateway_cpu_target`, `gateway_memory_target` | `70`, `80` | Target CPU and memory use as percentages. A memory target of `0` disables that policy. |
| `gateway_target_requests_per_second`, `gateway_target_tokens_per_second`, `gateway_tokens_metric` | `0`, `0`, `null` | Optional per-task traffic targets. A token target requires a CloudWatch metric definition. |
| `backend_autoscaling_enabled`, `backend_min_capacity`, `backend_max_capacity`, `backend_cpu_target` | `true`, `1`, `4`, `70` | Backend autoscaling, task range, and target CPU percentage. |
| `ui_autoscaling_enabled`, `ui_min_capacity`, `ui_max_capacity`, `ui_cpu_target` | `false`, `1`, `3`, `80` | UI autoscaling, task range, and target CPU percentage. |
| `litellm_master_key`, `litellm_license`, `ui_password` | `""` each | Empty master key generates a key. License and UI password are optional. The module stores these values in Secrets Manager. |
| `proxy_config` | `{}` | [LiteLLM configuration](../configuration/overview.md) shared by the gateway and backend. The module stores it in S3. A config change creates new task definitions. |
| `gateway_extra_env`, `backend_extra_env` | `{}` each | Extra nonsecret environment variables for each component. |
| `gateway_extra_secrets`, `backend_extra_secrets` | `{}` each | Map environment names to Secrets Manager ARNs. Add shared model credentials to both maps. |
| `gateway_metrics_port`, `gateway_metrics_scrape_cidrs` | `null`, `[]` | Optional metrics sidecar port and allowed scraper CIDRs. The sidecar has no key authentication. |
| `otel_endpoint`, `otel_exporter`, `otel_headers_secret_arn` | `""`, `"otlp_http"`, `""` | Enable OpenTelemetry with an endpoint. Optionally supply the Secrets Manager ARN for exporter headers. |
| `collector_enabled` | `false` | Enable the spend-log collector sidecar. |
| `log_retention_days` | `30` | CloudWatch log retention. |

</details>

<details>
<summary>GCP network and data</summary>

| Input | Default | Description |
| --- | --- | --- |
| `project_id`, `tenant`, `env` | Required | Google Cloud project ID and names for the deployment. |
| `region`, `labels` | `"us-central1"`, `{}` | Region and resource labels. |
| `network_id` | `""` | Existing VPC resource ID. Empty creates a VPC and subnet. Cloud Run's connector requires a network in the deployment project. |
| `create_psa_connection` | `true` | Create Private Services Access for Cloud SQL and Memorystore. Set `false` when the existing network already has this connection. |
| `subnet_cidr`, `vpc_connector_cidr` | `"10.40.0.0/16"`, `"10.41.0.0/28"` | New subnet and Serverless VPC Access connector ranges. The connector requires a `/28`. |
| `lb_domains`, `allow_plaintext_lb` | `[]`, `false` | Domains for the upstream public load balancer's managed certificate. The default rejects an HTTP-only load balancer. |
| `db_tier`, `db_edition`, `db_version` | `"db-custom-2-7680"`, `"ENTERPRISE"`, `"POSTGRES_16"` | Cloud SQL tier, edition, and PostgreSQL version. Select a tier that supports the edition. |
| `db_name`, `db_username` | `"litellm"`, `"litellm_app"` | Database name and application user. |
| `redis_tier`, `redis_memory_size_gb` | `"STANDARD_HA"`, `1` | Memorystore availability tier and memory in GiB. |
| `redis_transit_encryption` | `true` | Enable Redis TLS and inject its settings into Cloud Run. |
| `cloudsql_deletion_protection`, `gcs_force_destroy` | `true`, `false` | Protect Cloud SQL from deletion and control deletion of nonempty GCS buckets. |

</details>

<details>
<summary>GCP runtime and configuration</summary>

| Input | Default | Description |
| --- | --- | --- |
| `create_runtime` | `true` | Create Cloud Run, the load balancer, connector, and migration job. Set `false` to deploy the runtime separately with [Helm](./helm.md). |
| `image` | `""` | Full image URI for every component. Use an image that Cloud Run can pull, such as an Artifact Registry URI. |
| `image_registry`, `image_tag` | `"ghcr.io/berriai"`, `""` | Forms the image URI as `registry/litellm:tag`. Cloud Run cannot pull the default GHCR registry directly. |
| `gateway_cpu`, `gateway_memory` | `"1000m"`, `"4Gi"` | CPU and memory per gateway instance. |
| `backend_cpu`, `backend_memory` | `"1000m"`, `"4Gi"` | CPU and memory per backend instance. |
| `ui_cpu`, `ui_memory` | `"1000m"`, `"512Mi"` | CPU and memory per UI instance. |
| `gateway_min_instances`, `gateway_max_instances`, `gateway_max_instance_request_concurrency` | `1`, `10`, `80` | Gateway instance range and maximum concurrent requests per instance. |
| `backend_min_instances`, `backend_max_instances`, `backend_max_instance_request_concurrency` | `1`, `4`, `80` | Backend instance range and maximum concurrent requests per instance. |
| `ui_min_instances`, `ui_max_instances`, `ui_max_instance_request_concurrency` | `1`, `3`, `200` | UI instance range and maximum concurrent requests per instance. |
| `gateway_num_workers` | `1` | Gateway workers per instance. |
| `gateway_connection_pool_enabled`, `gateway_pool_max_db_connections`, `gateway_pool_max_client_conn` | `false`, `20`, `1000` | Enable PgBouncer and set its database and client connection limits. |
| `litellm_master_key`, `litellm_license`, `ui_password` | `""` each | Empty master key generates a key. License and UI password are optional. The module stores these values in Secret Manager. |
| `proxy_config` | `{}` | [LiteLLM configuration](../configuration/overview.md) shared by the gateway and backend through a GCS volume. A config change creates new Cloud Run revisions. |
| `gateway_extra_env`, `backend_extra_env` | `{}` each | Extra nonsecret environment variables for each component. |
| `gateway_extra_secrets`, `backend_extra_secrets` | `{}` each | Map environment names to Secret Manager secret IDs without a version suffix. The module reads `latest`. Add shared model credentials to both maps. |
| `gateway_metrics_port` | `null` | Optional metrics sidecar port. A collector sidecar exports its metrics to Cloud Monitoring. |
| `otel_endpoint`, `otel_exporter`, `otel_headers_secret` | `""`, `"otlp_http"`, `""` | Enable OpenTelemetry with an endpoint. Optionally supply the Secret Manager secret ID for exporter headers. |
| `collector_enabled` | `false` | Enable the spend-log collector sidecar. |

</details>

</div>
