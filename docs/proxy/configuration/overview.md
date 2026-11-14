---
title: Configuration
sidebar_label: Overview
toc_max_heading_level: 2
description: Choose YAML, the Admin UI, Management API, or Terraform to configure LiteLLM and manage models, teams, and virtual keys.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Configuration

{/* keep-version-note */}

Configure the models LiteLLM serves, how it routes requests, and what teams and applications can access. Choose YAML, the Admin UI, the Management API, or Terraform below.

Start with a running gateway. The [deployment guides](../deploy.md) cover installation and infrastructure.

## Choose a method

<Tabs queryString="method">
<TabItem value="yaml" label="YAML" default>

### Keep settings in a file

Define models and gateway settings in `config.yaml`. Review changes in version control and load the file when LiteLLM starts. Use environment variables for credentials.

The [YAML guide](../configs.md) covers model definitions, routing, logging, and server settings. It links to the full settings reference, file management, and CLI options.

</TabItem>
<TabItem value="ui" label="UI">

### Make changes in the browser

Open the Admin UI to add models, create teams and virtual keys, and edit supported settings. The gateway stores these changes in its database.

The [UI guide](./ui.md) covers setup, common tasks, and which settings you can change when you also use YAML.

</TabItem>
<TabItem value="api" label="Management API">

### Connect your internal platform

Call HTTP endpoints to register models, create teams and virtual keys, update access, and revoke keys. The gateway stores these resources in its database. Your platform can manage them without changes to a deployment file.

The [Management API guide](./api.md) shows how to register a self-hosted model and give an application access. It covers supported operations, where settings live, and when changes take effect.

</TabItem>
<TabItem value="terraform" label="Terraform">

### Manage resources as code

Declare teams, virtual keys, models, and other supported resources in Terraform. Review the plan, then apply it through the gateway's API.

The [Terraform guide](./terraform.md) shows how to configure the LiteLLM provider, create a team, and import an existing team.

</TabItem>
</Tabs>

## Use more than one method

You can keep deployment settings in YAML and manage resources through the UI, Management API, or Terraform. Choose one place to maintain each setting or resource. Each method supports a set of operations. Check its guide and reference for the task you need.

From v1.103.0, YAML settings take priority over database values. The UI cannot change those settings. Models follow a different rule. The gateway serves models from the UI or API alongside YAML models. See [YAML and database settings](../configs.md#configyaml-vs-database-settings) for the affected sections, refresh behavior, and earlier versions.

For permissions, see [Access Management](../access_management/overview.md). For credentials and network controls, see [Security](../security/overview.md).
