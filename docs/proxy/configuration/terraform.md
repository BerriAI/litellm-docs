---
title: Manage LiteLLM with the Terraform provider
sidebar_label: Terraform
description: Use the LiteLLM Terraform provider to manage teams, virtual keys, models, and other resources on an existing gateway.
---

# Manage LiteLLM with the Terraform provider

{/* keep-version-note */}

The LiteLLM Terraform provider manages teams, virtual keys, models, and other resources through a running gateway's API. Use it after you deploy the gateway. To create cloud infrastructure, see the [Terraform deployment guide](../deploy/terraform.md).

## Configure the provider

Declare the provider in `main.tf`:

```hcl title="main.tf"
terraform {
  required_providers {
    litellm = {
      source  = "BerriAI/litellm"
      version = "1.104.9" # Example: replace with your gateway's version.
    }
  }
}

provider "litellm" {}
```

Provider releases follow LiteLLM versions. Pin the provider to the version your gateway runs. See the [provider version guidance](https://github.com/BerriAI/litellm/tree/main/litellm/deploy/terraform/provider#versioning) and [published versions](https://registry.terraform.io/providers/BerriAI/litellm/latest).

Set the gateway URL and a LiteLLM API key with permission to manage your resources. The provider reads both values from environment variables. Load the key from your CI secret store to keep it out of your Terraform files.

```bash
export LITELLM_API_BASE="https://llm.example.com"
export LITELLM_API_KEY="<your-management-api-key>"
```

Connect the gateway to its database. Make sure the machine that runs Terraform can reach the gateway.

## Create a team

Add this resource to `main.tf` to create a team named `development-team`.

```hcl
resource "litellm_team" "development" {
  team_alias = "development-team"
}
```

Install the provider, review the proposed change, and apply it:

```bash
terraform init
terraform plan
terraform apply
```

The team appears in the Admin UI under **Teams**. Change the resource in Terraform to update its configuration. See the [team resource reference](https://registry.terraform.io/providers/BerriAI/litellm/latest/docs/resources/team) to set model access, budgets, rate limits, and permissions.

## Manage an existing team

Add a matching resource block, then import the team's ID from LiteLLM:

```bash
terraform import litellm_team.development '<team-id>'
terraform plan
```

Use the team ID, which can differ from its display name. Review the plan and update your configuration before the next apply.

The [provider reference](https://registry.terraform.io/providers/BerriAI/litellm/latest/docs) lists supported resources and data sources, including virtual keys, models, users, and MCP servers. Find the provider source and development instructions in [BerriAI/litellm](https://github.com/BerriAI/litellm/tree/main/litellm/deploy/terraform/provider).
