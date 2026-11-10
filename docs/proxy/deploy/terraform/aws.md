---
title: Deploy on AWS with Terraform
sidebar_label: AWS
description: Deploy LiteLLM on AWS ECS Fargate with Terraform. Set up Aurora, Redis, networking, secrets, and a load balancer, or reuse existing infrastructure.
---

# Deploy on AWS with Terraform

{/* keep-version-note */}

Use the official [`BerriAI/litellm/aws`](https://registry.terraform.io/modules/BerriAI/litellm/aws/latest) module to deploy LiteLLM on ECS Fargate. It creates the cloud infrastructure and runs database migrations before the gateway, backend, and UI services start. You do not need a Kubernetes cluster.

Each module version defaults the four component images (gateway, backend, UI, migrations) to the matching LiteLLM release, so upgrading LiteLLM is a bump of the module `version`. Set `image_tag` only to pin a different release, or `image_registry` to pull the same images from a mirror.

## Deploy from Cloud Shell {#1-click-deploy-from-cloud-shell}

<a href="https://console.aws.amazon.com/cloudshell/home" target="_blank" rel="nofollow"><img src="/img/deploy-on-aws.png" alt="Deploy on AWS" height="40" /></a>

Open AWS CloudShell to deploy the default example from the [LiteLLM repo](https://github.com/BerriAI/litellm/tree/main/terraform/litellm/aws/examples/default). CloudShell is already authenticated to your AWS account, so you can run the commands below without installing tools on your own machine.

The default stack runs Aurora (writer plus reader), multi-AZ ElastiCache, a NAT gateway, an ALB, and Fargate tasks, all billed by the hour, so use a sandbox account for a trial. The user you are signed in as needs permission to manage EC2 networking, RDS, ElastiCache, S3, Secrets Manager, ECS, Application Auto Scaling, Elastic Load Balancing, and CloudWatch Logs, and to create IAM roles and policies named `*-litellm-*`.

CloudShell does not ship Terraform, and the module needs Terraform 1.12 or later. Install it into your home directory, which CloudShell keeps between sessions:

```bash
TF_VERSION=1.13.5
mkdir -p ~/bin && cd ~/bin
curl -fsSLO "https://releases.hashicorp.com/terraform/${TF_VERSION}/terraform_${TF_VERSION}_linux_amd64.zip"
curl -fsSLO "https://releases.hashicorp.com/terraform/${TF_VERSION}/terraform_${TF_VERSION}_SHA256SUMS"
sha256sum --check --ignore-missing "terraform_${TF_VERSION}_SHA256SUMS"
unzip -o "terraform_${TF_VERSION}_linux_amd64.zip" terraform && rm "terraform_${TF_VERSION}"_*
export PATH="$HOME/bin:$PATH" && cd ~
terraform version
```

Then clone the repo and copy the default example's variables file:

```bash
git clone https://github.com/BerriAI/litellm.git
cd litellm/terraform/litellm/aws/examples/default
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars`. A clone of the repo has no image tag of its own, so `image_tag` must name a published [LiteLLM release](https://github.com/BerriAI/litellm/releases). The example refuses a plaintext ALB unless you set `acm_certificate_arn` or, for a trial stack, `allow_plaintext_alb = true`. The gateway only loads models added in the Admin UI when it has `STORE_MODEL_IN_DB` set, so set it through `gateway_extra_env`. The stack creates ElastiCache Redis and passes `REDIS_HOST`, `REDIS_PORT`, and `REDIS_SSL` to the containers, but the proxy only connects to it when `proxy_config` enables the cache with `litellm_settings = { cache = true }`. Without it, the Admin UI shows "No Redis configured" and `/cache/ping` returns `litellm.cache is None`. Keep `general_settings`, `router_settings`, and `litellm_settings` as sibling keys of `proxy_config`; a `litellm_settings` block nested inside `general_settings` is ignored. For a stack you plan to delete, `s3_force_destroy` and `skip_final_snapshot` let `terraform destroy` remove the bucket and the Aurora cluster without keeping a final snapshot:

```hcl title="terraform.tfvars"
region = "us-east-1"
azs    = ["us-east-1a", "us-east-1b"]
tenant = "acme"
env    = "trial"

image_tag           = "v1.106.2"
allow_plaintext_alb = true

gateway_extra_env = { STORE_MODEL_IN_DB = "True" }

proxy_config = {
  general_settings = {}
  litellm_settings = {
    cache = true
  }
}

s3_force_destroy    = true
skip_final_snapshot = true
```

The module defaults Aurora PostgreSQL to 16.4, which some regions no longer offer (us-east-1 among them), and the apply then fails at the database after it has created the network and Redis. The example does not expose `db_engine_version` in `terraform.tfvars`, so list the versions your region offers and add one to the `module "litellm"` block in `main.tf`, for example `db_engine_version = "16.15"`:

```bash
aws rds describe-db-engine-versions --engine aurora-postgresql \
  --query 'DBEngineVersions[?starts_with(EngineVersion, `16.`)].EngineVersion' --output text
```

Apply the stack. It takes 10 to 15 minutes, and part of it runs the database bootstrap and migrations as one-off ECS tasks that Terraform starts with `bash` and the AWS CLI from CloudShell:

```bash
terraform init && terraform apply
```

Terraform returns before the ECS services are ready, and until they are, the ALB answers with HTTP 503 and the Admin UI fails to log in. The same applies after each later `terraform apply` that changes `proxy_config` or `image_tag`: the old tasks keep serving the old configuration for a few minutes. Wait for the services to become stable, then get the URL and the generated master key:

```bash
NAME="$(terraform output -raw ecs_cluster)"
aws ecs wait services-stable --cluster "$NAME" \
  --services "$NAME-gateway" "$NAME-backend" "$NAME-ui"
ALB_URL="$(terraform output -raw alb_url)"
MASTER_KEY="$(aws secretsmanager get-secret-value \
  --secret-id "$(terraform output -raw master_key_secret_arn)" --query SecretString --output text)"
echo "$ALB_URL"
```

Check that the proxy uses Redis. A healthy response has `"status": "healthy"` and `"cache_type": "redis"`; `Cache not initialized` means the tasks that answered do not have `litellm_settings.cache` set:

```bash
curl -s "$ALB_URL/cache/ping" -H "Authorization: Bearer $MASTER_KEY"
```

Log in to the Admin UI at `<alb_url>/ui` with the username `admin` and the master key as the password. The stack starts with no models. To add one in the UI, open **Models + Endpoints**, select **Add Model**, choose the provider, enter the model and its credentials, and save; then send a test message from **Playground**. To declare models in Terraform instead, add a `model_list` to `proxy_config` and pass the provider keys with `gateway_extra_secrets` as shown in the next section. Each service logs to CloudWatch under `/ecs/<tenant>-litellm-<env>/` (`gateway`, `backend`, `ui`, `migrations`, and `bootstrap-db`). To upgrade, change `image_tag` and run `terraform apply` again, which reruns the migrations.

Terraform keeps the stack's state in `terraform.tfstate` in the example directory. CloudShell deletes your home directory after 120 days without a session in that region, and without the state file Terraform can no longer update or destroy the stack, so use an [S3 backend](https://developer.hashicorp.com/terraform/language/backend/s3) for any stack you keep. To delete a trial stack, run `terraform destroy` from the same directory. Without `s3_force_destroy`, the destroy fails if the versioned S3 bucket holds any object or old object version, and without `skip_final_snapshot` it leaves a final Aurora snapshot named `<tenant>-litellm-<env>-final-<hash>` that you delete yourself.

## Use the module directly {#use-the-module-directly}

By default, the module provisions a VPC with public and private subnets, an Aurora PostgreSQL cluster (writer plus reader, IAM database auth), ElastiCache Redis (multi-AZ, encrypted), an S3 bucket, Secrets Manager entries, an Application Load Balancer, and ECS Fargate services. The networking and both data stores are optional, so you can reuse what your account already runs; see below.

```hcl title="main.tf"
module "litellm" {
  source  = "BerriAI/litellm/aws"
  version = "~> 1.90"

  region = "us-east-1"
  azs    = ["us-east-1a", "us-east-1b"]
  tenant = "acme"
  env    = "prod"

  ui_password         = var.ui_password
  litellm_license     = var.litellm_license      # optional, omit for open source
  acm_certificate_arn = var.acm_certificate_arn  # TLS is required by default

  proxy_config = {
    model_list = [{
      model_name = "{{openai_large}}"
      litellm_params = {
        model   = "openai/{{openai_large}}"
        api_key = "os.environ/OPENAI_API_KEY"
      }
    }]
  }
  gateway_extra_secrets = {
    OPENAI_API_KEY = var.openai_key_secret_arn
  }
}
```

Before you apply: use Terraform 1.12 or later, and run it where `bash` and the AWS CLI are available, since the module starts its database bootstrap and migration tasks from the machine running Terraform. Provision the TLS certificate in [AWS Certificate Manager](https://docs.aws.amazon.com/acm/latest/userguide/acm-overview.html) (the module refuses a plaintext ALB unless you explicitly set `allow_plaintext_alb = true`), and create any provider-key secrets in [Secrets Manager](https://docs.aws.amazon.com/secretsmanager/latest/userguide/create_secret.html) first, since `gateway_extra_secrets` takes their ARNs. After apply, point your DNS record at the ALB hostname.

The module auto-generates the master key into Secrets Manager if you do not supply one. The application connects to Aurora with short-lived IAM tokens, so its `DATABASE_URL` carries no password (the database master password itself is generated into Secrets Manager and never touches the application). Every resource is named `<tenant>-litellm-<env>`, and the module declares no provider, so you can `for_each` it to run one stack per tenant.

**Bringing your own VPC, database, or Redis.** The networking and both data stores are each optional, so you can deploy into infrastructure your account already has. This is the path to take when your guardrails only allow workloads inside a pre-approved VPC, or when a separate team owns the Postgres and Redis you are expected to use. Set only the pieces you want to reuse; anything you leave at its default is still created for you.

```hcl title="main.tf"
module "litellm" {
  source  = "BerriAI/litellm/aws"
  version = "~> 1.90"

  region = "us-east-1"
  tenant = "acme"
  env    = "prod"

  # Existing networking. Drop `azs` when you set these: no VPC, subnets,
  # route tables, internet gateway, or NAT gateway are created.
  vpc_id             = "vpc-0123456789abcdef0"
  public_subnet_ids  = ["subnet-aaa", "subnet-bbb"]  # ALB, 2+ AZs
  private_subnet_ids = ["subnet-ccc", "subnet-ddd"]  # tasks and data stores, 2+ AZs

  # Existing data stores. Each URL is stored in Secrets Manager and reaches
  # the containers as DATABASE_URL / REDIS_URL.
  create_database = false
  database_url    = var.database_url
  create_redis    = false
  redis_url       = var.redis_url

  # Attach a group your database already allows, alongside the module's own.
  additional_task_security_group_ids = ["sg-0123456789abcdef0"]
}
```

Your existing stores have to accept traffic from the tasks. The module always creates its own tasks security group and reports it as the `task_security_group_id` output, so either allow that group inbound on the database and Redis, or pass a group they already allow through `additional_task_security_group_ids`. Private subnets you supply also need their own egress, through a NAT gateway or VPC endpoints, since the module creates no routing of its own in this mode. It reaches Secrets Manager, pulls container images, and calls LLM providers from those subnets.

Supply private subnets in at least two availability zones whenever the module still creates Aurora or ElastiCache, since both of their subnet groups require it. One private subnet is accepted only when you have turned both stores off.

Leaving a `create_*` at `false` with an empty URL runs the stack without that component entirely. With no database there is no key management, spend tracking, or UI persistence, so authentication falls back to the master key alone. Without Redis, rate limits, budgets, and router cooldowns are counted per gateway process rather than across the cluster, and the module runs two gateway tasks by default and autoscales to ten, so a caller spread across them receives each process's full allowance. The plan warns when you configure that combination. Hold the gateway to a single process with `gateway_autoscaling_enabled = false`, `gateway_desired_count = 1`, and `gateway_num_workers = 1` if you need per-key limits to mean anything without Redis.

Missing or inconsistent inputs fail during `terraform plan` rather than halfway through an apply, so setting `vpc_id` without the subnet ids, or dropping `azs` without setting `vpc_id`, tells you so before anything is created.

The AWS module can run Prometheus collection in a dedicated ECS sidecar using `gateway_metrics_port` and restrict access with `gateway_metrics_scrape_cidrs`; see [Isolate Prometheus scraping from inference traffic](../../prometheus.md#isolate-prometheus-scraping-from-inference-traffic).

## Next steps

[Verify the deployment](../../deploy.md#verify-the-deployment) and use [Sizing & Scaling](../sizing.md) to plan resources. See [autoscaling](../autoscaling.md) for cloud scaling options and [reference architectures](../architecture.md) for the deployment layout.

Return to the [Terraform overview](../terraform.md) to compare cloud options. To manage keys, teams, and models after deployment, use the [Terraform provider](./provider.md).
