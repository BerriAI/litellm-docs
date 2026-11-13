---
title: Deploy Moyai on AWS with Lambda MicroVMs
sidebar_label: AWS deployment
description: Deploy Moyai on AWS with Terraform, EC2, Lambda MicroVM sandboxes, RDS, S3, and a LiteLLM gateway that routes inference to Amazon Bedrock.
---

import {GuideNav} from '@site/src/components/Moyai';
import AwsInfrastructure from './aws-infrastructure.svg';

<GuideNav active="aws" />

{/* keep-version-note */}

Run Moyai in your AWS account with **Lambda MicroVMs as the agent computers**. The application runs on a private EC2 host with Temporal and a LiteLLM gateway. The gateway uses the host's IAM role to call Amazon Bedrock. You do not need Modal credentials, an external model API key, or a Temporal Cloud account for this deployment.

This guide follows Moyai's native Pydantic AI and Temporal implementation at commit [`b73f74d`](https://github.com/BerriAI/moyai/tree/b73f74dc357004c2079018d77a4c97954c0b4f05). The upstream [AWS quickstart](https://github.com/BerriAI/moyai/blob/main/deploy/aws/README.md) and [MicroVM guide](https://github.com/BerriAI/moyai/blob/main/docs/aws-lambda-microvms.md) contain the full operational procedures.

:::note Deployment scope
The Terraform quickstart creates a **new, single-instance installation** with one application/Temporal host and one NAT gateway. It has no automatic application failover and needs outbound access for AWS APIs, images, and optional Slack integration. For an existing EKS installation, use the [Helm integration instructions](https://github.com/BerriAI/moyai/blob/main/docs/aws-lambda-microvms.md#deploy-the-application-on-aws).
:::

## Infrastructure

<div role="region" aria-label="AWS infrastructure diagram; scroll horizontally on smaller screens" tabIndex={0} style={{overflowX: 'auto'}}>
  <AwsInfrastructure style={{display: 'block', width: '100%', minWidth: 760, height: 'auto'}} />
</div>

[Open the full-size infrastructure diagram](./aws-infrastructure.svg). On smaller screens, scroll the diagram horizontally.

The diagram shows runtime dependencies. Route 53 directs your hostname to the ALB, which uses an ACM certificate for HTTPS. The EC2 host has no public IP or SSH ingress; use Systems Manager for maintenance. Host traffic to AWS APIs and the internet leaves through the NAT gateway. Lambda MicroVMs use AWS-managed authenticated endpoints; the diagram does not place them inside the application's private subnets.

Terraform also creates a private ECR image repository, scoped IAM roles, a Secrets Manager secret, CloudWatch logs, and daily AWS Backup recovery points for the EBS state volume.

| Boundary | What runs there |
|---|---|
| Trusted EC2 services | Pydantic AI agent execution, model requests, connection credentials, API, coordinator, broker, and worker |
| Lambda MicroVM guest | Workspace tools and command/checkpoint transport; no model, database, or Slack credentials and no guest execution role in this quickstart |
| Persistent state | RDS for application records; EBS for installation keys and Temporal's database; separate S3 prefixes for product objects and guest checkpoints |

## Before you start

Install Git, Python 3.13, [uv](https://docs.astral.sh/uv/getting-started/installation/), the AWS CLI, Terraform 1.9 or newer but below 2.0, and Docker with an AMD64 Buildx builder. Local source installation also needs Node.js 22 or newer and Rust 1.88 or newer for the UI and AgentChat SDK builds. {/* keep-python-version */}

The application image uses AMD64; the guest image packager selects ARM64 with at least 8 GiB of memory.

Your AWS account needs **Lambda MicroVM access in the selected region**, with capacity to build images and launch VMs. Ordinary Lambda function access is insufficient. You also need an existing public Route 53 hosted zone, an unused hostname, and permission to provision the resources in the diagram, pass scoped roles, and use SSM Run Command.

Enable a Bedrock model or inference profile and verify that your account can invoke it. For a cross-region inference profile, allow both the profile ARN and every destination model ARN. Inspect the profile with:

```bash
aws bedrock get-inference-profile \
  --region YOUR_REGION \
  --inference-profile-identifier YOUR_PROFILE_ID
```

Cloud resources, guest computers, image builds, and inference incur charges. Suspending a guest leaves the application services running.

## 1. Prepare the checkout and AWS configuration

```bash
git clone https://github.com/BerriAI/moyai.git
cd moyai
uv sync --frozen
export AWS_PROFILE=your-aws-profile
aws sts get-caller-identity
cp deploy/aws/terraform.tfvars.example deploy/aws/terraform.tfvars
```

Run the remaining commands from this checkout. Use the same revision for the application image and deployment bundle. Edit `deploy/aws/terraform.tfvars`:

| Setting | Value to supply |
|---|---|
| `name` | A unique resource prefix for this installation |
| `region` | An AWS region where your account has MicroVM access |
| `hostname`, `route53_zone_id` | An unused hostname and its existing public hosted zone |
| `bedrock_model_id` | Your enabled model or inference profile ID, without the `bedrock/` prefix |
| `bedrock_invoke_resources` | Exact allowed profile/model ARNs, including cross-region destinations |
| `computer_lifetime`, `computer_idle_timeout` | VM lifetime and idle suspension window in seconds; the template uses `28800` and `600` |

Leave `moyai_image` unset for the first apply. Keep AWS keys and secret values out of `.tfvars`. For a retained installation, configure your organization's encrypted remote Terraform backend with state locking before initialization.

## 2. Provision AWS infrastructure

```bash
terraform -chdir=deploy/aws init
terraform -chdir=deploy/aws plan -out=installation.tfplan
terraform -chdir=deploy/aws apply installation.tfplan
```

Review the plan before applying it. This creates infrastructure, including an empty ECR repository and Secrets Manager secret; the application installation comes next.

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

Set `moyai_image` in `terraform.tfvars` to the repository URL followed by `@` and the returned `sha256:` digest. The installer requires an immutable image reference.

```bash
terraform -chdir=deploy/aws plan -out=application.tfplan
terraform -chdir=deploy/aws apply application.tfplan
```

Keep the quickstart's pinned LiteLLM image unless you have qualified a replacement. Its gateway exposes a `bedrock/<model ID>` alias for Moyai and uses IAM credentials from the trusted host.

## 4. Initialize credentials

Create a JSON file outside the checkout with file mode `0600`. Use `{}` to start without Slack. To enable Slack, supply all six settings together:

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

`GOOGLE_ALLOWED_DOMAINS` also controls Slack identity eligibility. An empty policy rejects Slack users; Google OAuth is not required.

```bash
uv run python deploy/aws/quickstart.py secrets \
  --secret-file /secure/path/moyai.json
```

The helper generates separate application database, gateway, and administrator passwords and stores them in Secrets Manager. It preserves existing credentials on identical retries. You can supply `WORKSPACE_PASSWORD` in the input JSON if it has at least 24 characters.

## 5. Build the MicroVM image and install Moyai

```bash
uv run python deploy/aws/quickstart.py image
uv run python deploy/aws/quickstart.py install
uv run python deploy/aws/quickstart.py status
terraform -chdir=deploy/aws output -raw app_url
```

The image command packages the guest tools and suspend/resume hooks, submits the AWS image build, and records its pinned version. Installation uses SSM to start the Docker split bundle on EC2. The host reads its credentials from Secrets Manager and retains installation keys on encrypted EBS.

The installer sets `SANDBOX_PROVIDER=lambda`, `LAMBDA_REGION`, `LAMBDA_IMAGE`, `LAMBDA_IMAGE_VERSION`, and `LAMBDA_CHECKPOINT_BUCKET` from the provisioned resources. For an existing deployment, use the [manual Lambda configuration](https://github.com/BerriAI/moyai/blob/main/docs/aws-lambda-microvms.md).

Open `app_url` and sign in as `admin`. Retrieve `WORKSPACE_PASSWORD` from the secret named by `terraform -chdir=deploy/aws output -raw runtime_secret_arn` through your private secret-management workflow.

**Check:** `status` reports installer completion. Verify model execution and recovery through the running application before treating the deployment as ready.

## 6. Verify a task and workspace recovery

In the browser, ask Moyai to create a uniquely named file under `/workspace`, run a command that reads it, and save it for download. Confirm the tool output, downloadable artifact, and completed checkpoint. Send a follow-up in the same conversation that reads the existing file.

| Test | Expected result |
|---|---|
| Let a completed session become `SUSPENDED`, then send a follow-up | The same VM ID resumes with files, memory, and background processes retained |
| Keep a task active beyond the idle window | Moyai's health probes keep the VM active during the turn and checkpoint save |
| Let a test VM reach its lifetime limit, then send a follow-up | A new VM restores the last accepted S3 filesystem checkpoint; RAM and running processes are gone |
| Restart the application while retaining RDS, S3, and EBS | Sign-in, session history, and a real follow-up still work |

For a disposable acceptance deployment, set `computer_lifetime=600` and `computer_idle_timeout=60` **before installation** to exercise expiry without an eight-hour wait. Verify file checksums, installed packages, permissions, symlinks, and deletions if your workload depends on them. Use the [full acceptance procedure](https://github.com/BerriAI/moyai/blob/main/docs/aws-lambda-microvms.md#slack-and-checkpointrestore-acceptance) to record VM IDs and checkpoint evidence.

### Connect Slack

Register these URLs under your `app_url` in a dedicated Slack app:

| Slack setting | Path |
|---|---|
| OAuth redirect | `/oauth/slack/callback` |
| Events | `/hooks/slack/events` |
| Interactions | `/hooks/slack/interactions` |

Complete OAuth through **Connections → Slack** with the requested scopes and event subscriptions. Keep the signed webhook reachable over HTTPS. Repeat the task and recovery checks in one Slack thread, including artifact delivery, and verify that unsigned Slack events and anonymous application API requests are rejected.

## Limits and operations

Lambda MicroVMs support native shell, file, and browser tools plus authenticated desktop screenshots and actions. Interactive desktop streaming remains Modal-only. A Modal environment image cannot serve as a Lambda guest image.

Idle suspension preserves a live VM's memory and processes. The maximum lifetime is eight hours, **including suspended time**. After expiry, Moyai restores files and installed packages into a new VM from the pinned image and S3 checkpoint. An unfinished turn with no accepted checkpoint is not recovered by replaying its commands.

Checkpoint storage currently requires SSE-S3 (`AES256`); SSE-KMS-only buckets are unsupported. Keep the original guest image versions while retained checkpoints reference them.

Back up installation keys with the application database and S3 references. Daily EBS backups are crash-consistent; perform a coordinated restore drill before relying on the deployment for production. Use the [maintenance procedure](https://github.com/BerriAI/moyai/blob/main/deploy/docker/README.md#maintenance-upgrades) for application changes. Applying Terraform alone does not upgrade the running app or rewrite its private configuration.

For teardown, follow the [AWS operations guide](https://github.com/BerriAI/moyai/blob/main/deploy/aws/README.md#operations-upgrades-and-teardown). Terraform does not manage guest image deletion, and retained S3 objects, ECR images, backups, and deletion protection require deliberate cleanup.

## Troubleshooting

| Symptom | Check |
|---|---|
| MicroVM image build or launch denied | Region-specific MicroVM access, image/VM capacity, scoped IAM permissions, and the pinned image's `SUCCESSFUL` state |
| Installation refuses the image | `moyai_image` must contain the ECR digest and match the checkout used for the deployment bundle |
| Bedrock invocation denied | Model access and every ARN required by the inference profile, including destination regions |
| Installer completes but tasks fail | Real model/tool output in the app, SSM invocation details, and the service's CloudWatch logs |
| Slack user cannot sign in or send a task | OAuth installation, team/user allowlist, and `GOOGLE_ALLOWED_DOMAINS` |
| Workspace cannot restore | Accepted checkpoint, original pinned image/version, S3 prefix permissions, and SSE-S3 encryption |
