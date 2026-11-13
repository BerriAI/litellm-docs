---
title: Deploy Moyai on AWS with Lambda MicroVMs
sidebar_label: AWS deployment
description: Deploy Moyai on AWS with Terraform, EC2, Lambda MicroVM sandboxes, RDS, S3, and a LiteLLM gateway that routes inference to Amazon Bedrock.
---

import {GuideNav} from '@site/src/components/Moyai';
import AwsInfrastructure from './aws-infrastructure.svg';

<GuideNav active="aws" />

{/* keep-version-note */}

Deploy Moyai on a private EC2 host and run agent tools in **AWS Lambda MicroVMs**. Use the bundled Temporal service for durable execution and LiteLLM gateway for Bedrock inference. Authenticate Bedrock requests with the EC2 IAM role.

Source: Moyai's native Pydantic AI and Temporal implementation at [`b73f74d`](https://github.com/BerriAI/moyai/tree/b73f74dc357004c2079018d77a4c97954c0b4f05). See the upstream [AWS quickstart](https://github.com/BerriAI/moyai/blob/main/deploy/aws/README.md) for operations and the [MicroVM guide](https://github.com/BerriAI/moyai/blob/main/docs/aws-lambda-microvms.md) for manual configuration.

:::note Deployment scope
Use this quickstart for a **new, single-instance installation**. You get one application/Temporal host and one NAT gateway, with no automatic application failover. Allow outbound access for AWS APIs, images, and Slack if enabled. For EKS, follow the [Helm integration instructions](https://github.com/BerriAI/moyai/blob/main/docs/aws-lambda-microvms.md#deploy-the-application-on-aws).
:::

## Infrastructure

<div role="region" aria-label="AWS infrastructure diagram; scroll left or right on smaller screens" tabIndex={0} style={{overflowX: 'auto'}}>
  <AwsInfrastructure style={{display: 'block', width: '100%', minWidth: 760, height: 'auto'}} />
</div>

[Open the full-size diagram](./aws-infrastructure.svg), or scroll it left and right on smaller screens.

Use Route 53 DNS and an ACM certificate for HTTPS access through the ALB. Access the private EC2 host through Systems Manager; it has no public IP or SSH ingress. Route outbound traffic through the NAT gateway and connect to MicroVMs through AWS-authenticated endpoints outside the application VPC.

With the Terraform module, provision a private ECR repository, scoped IAM roles, Secrets Manager, CloudWatch logs, and daily AWS Backup recovery points for the EBS state volume.

| Boundary | What runs there |
|---|---|
| Trusted EC2 services | Pydantic AI agent execution, model requests, connection credentials, API, coordinator, broker, and worker |
| Lambda MicroVM guest | Workspace tools and command/checkpoint transport; no model, database, or Slack credentials and no guest execution role in this quickstart |
| Persistent state | RDS for application records; EBS for installation keys and Temporal's database; separate S3 prefixes for product objects and guest checkpoints |

## Before you start

Install Git, [uv](https://docs.astral.sh/uv/getting-started/installation/), the AWS CLI, Terraform 1.9 or newer but below 2.0, and Docker with an AMD64 Buildx builder. For local `uv sync`, install Python 3.13, Node.js 22 or newer, and Rust 1.88 or newer to build the UI and AgentChat SDK. {/* keep-python-version */}

Build the application for AMD64. The guest packager uses ARM64 with at least 8 GiB of memory.

Confirm **Lambda MicroVM access in your AWS region** and capacity to build images and launch VMs. Lambda function access alone is insufficient. You need an existing public Route 53 hosted zone, an unused hostname, and permission to provision the resources, pass scoped roles, and use SSM Run Command.

Enable a Bedrock model or inference profile and verify that your account can invoke it. For a cross-region inference profile, allow both the profile ARN and every destination model ARN. Inspect the profile with:

```bash
aws bedrock get-inference-profile \
  --region YOUR_REGION \
  --inference-profile-identifier YOUR_PROFILE_ID
```

Budget for compute, storage, image builds, and inference. You continue paying for application services while guests are suspended.

## 1. Prepare the checkout and AWS configuration

```bash
git clone https://github.com/BerriAI/moyai.git
cd moyai
uv sync --frozen
export AWS_PROFILE=your-aws-profile
aws sts get-caller-identity
cp deploy/aws/terraform.tfvars.example deploy/aws/terraform.tfvars
```

Continue from the Moyai checkout. Use the same revision for the application image and deployment bundle. Edit `deploy/aws/terraform.tfvars`:

| Setting | Value to supply |
|---|---|
| `name` | A unique resource prefix for this installation |
| `region` | An AWS region where your account has MicroVM access |
| `hostname`, `route53_zone_id` | An unused hostname and its existing public hosted zone |
| `bedrock_model_id` | Your enabled model or inference profile ID, without the `bedrock/` prefix |
| `bedrock_invoke_resources` | Exact allowed profile/model ARNs, including cross-region destinations |
| `computer_lifetime`, `computer_idle_timeout` | VM lifetime and idle suspension window in seconds; the template uses `28800` and `600` |

Leave `moyai_image` unset for the first apply. Keep AWS keys and secrets out of `.tfvars`. For an installation you plan to keep, configure encrypted remote Terraform state with locking before `terraform init`.

## 2. Provision AWS infrastructure

Review the plan, then apply it to create the infrastructure, empty ECR repository, and Secrets Manager secret:

```bash
terraform -chdir=deploy/aws init
terraform -chdir=deploy/aws plan -out=installation.tfplan
terraform -chdir=deploy/aws apply installation.tfplan
```

## 3. Build and pin the application image

Build the current checkout and push it to the ECR repository:

```bash
MOYAI_REPOSITORY=$(terraform -chdir=deploy/aws output -raw application_repository)
MOYAI_REVISION=$(git rev-parse HEAD)
MOYAI_REGION=$(terraform -chdir=deploy/aws output -json quickstart | python3 -c 'import json,sys; print(json.load(sys.stdin)["region"])')

aws ecr get-login-password --region "$MOYAI_REGION" |
  docker login --username AWS --password-stdin "${MOYAI_REPOSITORY%%/*}"
docker buildx build --platform linux/amd64 \
  --build-arg MOYAI_BUILD_SHA="$MOYAI_REVISION" \
  --tag "$MOYAI_REPOSITORY:$MOYAI_REVISION" --push .
docker logout "${MOYAI_REPOSITORY%%/*}"

aws ecr describe-images --region "$MOYAI_REGION" \
  --repository-name "${MOYAI_REPOSITORY#*/}" \
  --image-ids "imageTag=$MOYAI_REVISION" \
  --query 'imageDetails[0].imageDigest' --output text
```

Pin `moyai_image` in `terraform.tfvars` to the repository URL followed by `@` and the returned `sha256:` digest.

```bash
terraform -chdir=deploy/aws plan -out=application.tfplan
terraform -chdir=deploy/aws apply application.tfplan
```

Keep the quickstart's pinned LiteLLM image unless you have tested a replacement. Use its `bedrock/<model ID>` alias for Moyai; the gateway authenticates with the host IAM role.

## 4. Initialize credentials

Create a JSON file outside the checkout with file mode `0600`. Use `{}` to start without Slack. To enable Slack, supply all six fields:

```json
{
  "SLACK_CLIENT_ID": "your-client-id",
  "SLACK_CLIENT_SECRET": "your-client-secret",
  "SLACK_SIGNING_SECRET": "your-signing-secret",
  "SLACK_TEAM_ID": "T_YOUR_WORKSPACE",
  "SLACK_SESSION_USERS": "U_YOUR_TEST_USER",
  "GOOGLE_ALLOWED_DOMAINS": "example.com"
}
```

Set `GOOGLE_ALLOWED_DOMAINS` to your Slack users' email domains. An empty policy rejects them. You do not need to enable Google OAuth.

```bash
uv run python deploy/aws/quickstart.py secrets \
  --secret-file /secure/path/moyai.json
```

Run `secrets` to generate database, gateway, and administrator passwords in Secrets Manager. Reuse the same input on retries to retain existing credentials. To choose the administrator password, set `WORKSPACE_PASSWORD` in the JSON to at least 24 characters.

## 5. Build the MicroVM image and install Moyai

```bash
uv run python deploy/aws/quickstart.py image
uv run python deploy/aws/quickstart.py install
uv run python deploy/aws/quickstart.py status
terraform -chdir=deploy/aws output -raw app_url
```

Use `image` to build and pin the guest with its tools and suspend/resume hooks. Use `install` to start the Docker split bundle on EC2 through SSM. The host reads credentials from Secrets Manager and keeps installation keys on encrypted EBS.

The installer sets `SANDBOX_PROVIDER=lambda`, `LAMBDA_REGION`, `LAMBDA_IMAGE`, `LAMBDA_IMAGE_VERSION`, and `LAMBDA_CHECKPOINT_BUCKET` from the provisioned resources. For an existing deployment, use the [manual Lambda configuration](https://github.com/BerriAI/moyai/blob/main/docs/aws-lambda-microvms.md).

Find the runtime secret ARN with `terraform -chdir=deploy/aws output -raw runtime_secret_arn`, then read `WORKSPACE_PASSWORD` in Secrets Manager. Open `app_url` and sign in as `admin`.

Check `status` for installer completion, then test model execution and recovery in the app.

## 6. Verify a task and workspace recovery

Ask Moyai to create a file with a unique name under `/workspace`, read it, and save it for download. Check the tool output, download the file, and confirm the checkpoint. Send a follow-up in the same conversation asking Moyai to read the saved file.

| Test | Expected result |
|---|---|
| Let a completed session become `SUSPENDED`, then send a follow-up | The same VM resumes with its files, memory, and background processes |
| Keep a task active beyond the idle window | Moyai's health probes keep the VM active during the turn and checkpoint save |
| Let a test VM reach its lifetime limit, then send a follow-up | A new VM restores the last accepted S3 filesystem checkpoint; RAM and running processes are gone |
| Restart the application while retaining RDS, S3, and EBS | You can sign in, read session history, and complete a follow-up |

In a disposable test installation, set `computer_lifetime=600` and `computer_idle_timeout=60` **before installation** to test expiry with a ten-minute VM lifetime. Check file checksums, installed packages, permissions, symlinks, and deletions that your workload depends on. Record VM IDs and checkpoint results with the [upstream acceptance checks](https://github.com/BerriAI/moyai/blob/main/docs/aws-lambda-microvms.md#slack-and-checkpointrestore-acceptance).

### Connect Slack

Register these URLs under your `app_url` in a dedicated Slack app:

| Slack setting | Path |
|---|---|
| OAuth redirect | `/oauth/slack/callback` |
| Events | `/hooks/slack/events` |
| Interactions | `/hooks/slack/interactions` |

Complete OAuth through **Connections → Slack** with the requested scopes and event subscriptions. Keep the signed webhook reachable over HTTPS. Repeat the task and recovery checks in one Slack thread, including artifact delivery. Check that Moyai denies unsigned Slack events and anonymous application API requests.

## Limits and operations

Use Lambda MicroVMs for shell, file, and browser tools, plus authenticated desktop screenshots and actions. For interactive desktop streaming, choose Modal. Build a separate Lambda image for prepared environments; you cannot reuse a Modal environment image.

Set a VM lifetime of at most eight hours, **including suspended time**. During idle suspension, you retain memory and processes until that deadline. After expiry, Moyai restores files and installed packages into a new VM from the pinned image and S3 checkpoint. Moyai does not replay unfinished turns that lack an accepted checkpoint.

Use SSE-S3 (`AES256`) for checkpoints; SSE-KMS-only buckets are unsupported. Keep the guest image versions referenced by retained checkpoints.

Back up installation keys with the application database and S3 references. Test restoring them before production use; daily EBS backups are crash-consistent. Follow the [maintenance procedure](https://github.com/BerriAI/moyai/blob/main/deploy/docker/README.md#maintenance-upgrades) for app upgrades and configuration changes. `terraform apply` alone does not perform them.

For teardown, follow the [AWS cleanup steps](https://github.com/BerriAI/moyai/blob/main/deploy/aws/README.md#operations-upgrades-and-teardown) for guest images, retained S3 objects, ECR images, backups, and deletion protection. Delete guest images through the MicroVM API; Terraform does not manage them.

## Troubleshooting

| Symptom | Check |
|---|---|
| MicroVM image build or launch denied | Region-specific MicroVM access, image/VM capacity, scoped IAM permissions, and the pinned image's `SUCCESSFUL` state |
| Installation refuses the image | `moyai_image` must contain the ECR digest and match the checkout used for the deployment bundle |
| Bedrock invocation denied | Model access and every ARN required by the inference profile, including destination regions |
| Installer completes but tasks fail | Model/tool output in the app, SSM invocation details, and the service's CloudWatch logs |
| Slack user cannot sign in or send a task | OAuth installation, team/user allowlist, and `GOOGLE_ALLOWED_DOMAINS` |
| Workspace cannot restore | Accepted checkpoint, original pinned image/version, S3 prefix permissions, and SSE-S3 encryption |
