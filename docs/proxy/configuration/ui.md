---
title: Configure LiteLLM in the Admin UI
sidebar_label: UI
description: Configure models, credentials, virtual keys, budgets, and routing in the LiteLLM Admin UI. Learn which settings config.yaml controls.
---

# Configure LiteLLM in the Admin UI

{/* keep-version-note */}

Use the Admin UI to manage a running LiteLLM gateway from your browser. Add models, update provider credentials, create virtual keys, and change supported settings.

## Before you start

Connect LiteLLM to PostgreSQL and set `LITELLM_MASTER_KEY`. See [database setup](../virtual_keys.md#setup) for both steps. For a new installation, follow the [Quickstart](../docker_quick_start.md).

Open `<your-proxy-url>/ui` and sign in. Use a `proxy_admin` account to configure the gateway. Other [roles](../access_control.md#global-proxy-roles) have fewer permissions. The [Admin UI guide](../ui.md) covers login, admin accounts, and access settings.

## Save models and settings in the database

Set `STORE_MODEL_IN_DB="True"` in the proxy environment or `general_settings.store_model_in_db: true` in `config.yaml`. The gateway then stores UI models and supported settings in the database. It loads saved models after a restart. Other instances that share the database can use them too.

Keep `LITELLM_SALT_KEY` unchanged after you save provider credentials. If you change it, LiteLLM cannot decrypt those credentials. See [database model storage](../model_management.md#database-vs-configyaml-models) for setup and the runtime storage toggle.

## Common tasks

| Task | Guide |
| --- | --- |
| Add a provider and model | [Add your first model](../docker_quick_start.md#3-add-your-first-model) |
| Edit a model, change pricing, or test its connection | [Model Management](../model_management.md#inspect-and-edit-a-model) |
| Reuse provider credentials across models | [Reusable provider credentials](../model_management.md#reusable-provider-credentials) |
| Create a virtual key for an application | [Create a virtual key](../docker_quick_start.md#5-create-a-virtual-key) |
| Set a team's budget | [Team budgets](../team_budgets.md#setting-monthly-team-budgets) |
| Set fallbacks, retries, and timeouts for a key or team | [Key and team router settings](../keys_teams_router_settings.md) |
| Check the meaning and defaults of gateway settings | [Configuration reference](../config_settings.md) |

After a model change, use **Test Connection** on its detail page or [send a message in Playground](../docker_quick_start.md#4-send-a-test-message). Database model changes apply to new requests without a proxy restart. The proxy loads saved gateway settings through its configuration refresh. See [config.yaml vs database settings](../configs.md#configyaml-vs-database-settings).

## When a setting is also in YAML

On **v1.103.0 and later**, `config.yaml` controls the keys it declares in `general_settings`, `router_settings`, `litellm_settings`, and `environment_variables`. The YAML value takes priority. The UI returns HTTP 400 if you try to change it. Edit the file and restart or reload the proxy. To let the database control the key, remove it from YAML. A saved database value takes effect when you remove the key.

This rule applies to those four settings sections. The proxy serves models from `model_list` alongside database models. A database model with the same name adds a deployment. It does not replace the YAML entry. Edit or delete YAML models in their file. Choose one [source of truth for models](../model_management.md#choose-one-source-of-truth-for-models).

Before v1.103.0, saved database settings took priority over YAML. See [config.yaml vs database settings](../configs.md#configyaml-vs-database-settings) for details by version.
