---
title: Deploy on Google Cloud with Terraform
sidebar_label: GCP
description: Deploy LiteLLM on Google Cloud Run with Terraform. Configure Cloud SQL, Redis, Artifact Registry, secrets, and an HTTPS load balancer.
---

# Deploy on Google Cloud with Terraform

{/* keep-version-note */}

Use the official [`BerriAI/litellm/google`](https://registry.terraform.io/modules/BerriAI/litellm/google/latest) module to deploy LiteLLM on Cloud Run. It creates the cloud infrastructure and runs database migrations before the gateway, backend, and UI services start. You do not need a Kubernetes cluster.

Each module version defaults the four component images (gateway, backend, UI, migrations) to the matching LiteLLM release, so upgrading LiteLLM is a bump of the module `version`. Set `image_tag` only to pin a different release, or `image_registry` to pull the same images from a mirror.

## Deploy from Cloud Shell {#1-click-deploy-from-cloud-shell}

<a href="https://ssh.cloud.google.com/cloudshell/editor?cloudshell_git_repo=https%3A%2F%2Fgithub.com%2FBerriAI%2Fterraform-google-litellm&cloudshell_git_branch=v1.105.0&cloudshell_workspace=examples%2Fdefault&cloudshell_tutorial=TUTORIAL.md&cloudshell_image=gcr.io/ds-artifacts-cloudshell/deploystack_custom_image&shellonly=true" target="_blank" rel="nofollow"><img src="/img/deploy-on-gcp.png" alt="Deploy on GCP" height="40" /></a>

Open Google Cloud Shell to start the guided tutorial in a browser shell authenticated to your cloud account. You do not need to install tools on your own machine.

The tutorial clones the [terraform-google-litellm](https://github.com/BerriAI/terraform-google-litellm) module mirror at the pinned release `v1.105.0` into Cloud Shell, which is a much smaller download than the full LiteLLM repo, and opens a guided [DeployStack tutorial](https://github.com/BerriAI/terraform-google-litellm/blob/v1.105.0/examples/default/TUTORIAL.md). You pick the project and answer a few prompts; the tutorial creates the Artifact Registry remote repository that Cloud Run needs to pull from `ghcr.io`, writes `terraform.tfvars` from your answers, and runs `terraform apply`.

## Use the module directly {#use-the-module-directly}

The module provisions a VPC with Private Services Access, Cloud SQL PostgreSQL (primary plus read replica), Memorystore Redis with TLS, a GCS bucket, Secret Manager entries, Cloud Run services, and a global HTTPS load balancer with serverless NEGs.

```hcl title="main.tf"
module "litellm" {
  source  = "BerriAI/litellm/google"
  version = "~> 1.90"

  project_id = "my-project"
  region     = "us-central1"
  tenant     = "acme"
  env        = "prod"

  ui_password     = var.ui_password
  litellm_license = var.litellm_license  # optional

  # Cloud Run cannot pull from ghcr.io. Point this at an Artifact Registry
  # remote repository backed by ghcr.io, or mirror the images.
  image_registry = "us-central1-docker.pkg.dev/my-project/ghcr-remote/berriai"

  lb_domains = ["llm.example.com"]

  proxy_config = {
    model_list = [{
      model_name = "{{gemini_pro}}"
      litellm_params = { model = "vertex_ai/{{gemini_pro}}" }
    }]
  }
}
```

Three GCP-specific caveats. First, always override `image_registry`: it defaults to `ghcr.io/berriai`, which Cloud Run cannot pull from, so the apply succeeds but the services fail at image pull. Point it at an [Artifact Registry remote repository](https://cloud.google.com/artifact-registry/docs/repositories/remote-overview) that proxies `ghcr.io`. Second, the database uses password authentication through Secret Manager rather than IAM auth; LiteLLM's IAM token support is AWS RDS specific. Third, create the DNS record for `lb_domains` pointing at the load balancer IP after apply; the [Google-managed certificate](https://cloud.google.com/load-balancing/docs/ssl-certificates/google-managed-certs) will not finish provisioning until the domain resolves to it.

## Next steps

[Verify the deployment](../../deploy.md#verify-the-deployment) and use [Sizing & Scaling](../sizing.md) to plan resources. See [autoscaling](../autoscaling.md) for cloud scaling options and [reference architectures](../architecture.md) for the deployment layout.

Return to the [Terraform overview](../terraform.md) to compare cloud options. To manage keys, teams, and models after deployment, use the [Terraform provider](./provider.md).
