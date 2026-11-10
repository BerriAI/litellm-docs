---
title: Configuration
sidebar_label: Overview
toc_max_heading_level: 2
description: Choose YAML, the Admin UI, or Terraform to configure LiteLLM settings and manage models, teams, and virtual keys.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Configuration

{/* keep-version-note */}

Configure which models LiteLLM serves, how it routes requests, and what teams and applications can use. Use a YAML file for deployment settings, the Admin UI for changes in the browser, or Terraform to manage gateway resources as code.

Start with a running gateway. The [deployment guides](../deploy.md) cover installation and infrastructure.

## Choose a method

<Tabs queryString="method">
<TabItem value="yaml" label="YAML" default>

### Keep settings in a file

Define models and gateway settings in `config.yaml`, review changes in version control, and load the file when LiteLLM starts. Use environment variables for credentials.

The [YAML guide](../configs.md) covers model definitions, routing, logging, and server settings. It links to the full settings reference, file management, and CLI options.

</TabItem>
<TabItem value="ui" label="UI">

### Make changes in the browser

Open the Admin UI to add models, create teams and virtual keys, and edit supported settings. The gateway stores these changes in its database.

The [UI guide](./ui.md) explains the setup, common tasks, and which settings can be changed when you also use YAML.

</TabItem>
<TabItem value="terraform" label="Terraform">

### Manage resources as code

Declare teams, virtual keys, models, and other supported resources in Terraform. Review the plan, then apply it through the gateway's API.

The [Terraform guide](./terraform.md) shows how to configure the LiteLLM provider, create a team, and import an existing team.

</TabItem>
</Tabs>

## Use more than one method

You can keep deployment settings in YAML and manage resources through the UI or Terraform. Choose one place to maintain each setting or resource so changes stay predictable.

From v1.103.0, settings declared in YAML take precedence over database values, and the UI cannot change those settings. Models follow a different rule: models added through the UI or API run alongside YAML models. See [YAML and database settings](../configs.md#configyaml-vs-database-settings) for the affected sections, refresh behavior, and older-version differences.

For permissions, see [Access Management](../access_management/overview.md). For credentials and network controls, see [Security](../security/overview.md).
