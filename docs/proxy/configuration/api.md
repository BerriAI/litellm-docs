---
title: Configure LiteLLM with the Management API
sidebar_label: Management API
toc_max_heading_level: 2
description: Use HTTP APIs to register models, create teams and virtual keys, update access, and revoke keys on a running LiteLLM gateway.
---

# Configure LiteLLM with the Management API

{/* keep-version-note */}

Use the Management API to connect an internal portal or automation service to a running LiteLLM gateway. Your application can register models, grant team access, issue virtual keys, and revoke keys through HTTP requests.

The [Admin UI](./ui.md) and [Terraform provider](./terraform.md) also use APIs to manage gateway resources. Use direct API calls when your application needs to make those changes. See the [deployment guides](../deploy.md) to install LiteLLM and set up its infrastructure.

## What the API manages

| Task | API | Storage and ownership | When changes apply |
| --- | --- | --- | --- |
| Add, update, or remove a database model | `POST /model/new`, `PATCH /model/{model_id}/update`, `POST /model/delete` | Database. Requires `STORE_MODEL_IN_DB=True`. | No proxy restart. Check that each replica has refreshed its model list. |
| Create a team or update its model access and limits | `POST /team/new`, `POST /team/update` | Database | No proxy restart. Test access through the gateway. |
| Issue, update, or revoke a virtual key | `POST /key/generate`, `POST /key/update`, `POST /key/delete` | Database | No proxy restart. Test access changes across replicas. |
| Change a supported gateway setting | `POST /config/update` | Database for settings outside YAML. Requires database configuration storage. | The gateway refreshes its configuration. Check the setting's documented behavior. |
| Change a YAML-owned model or setting | Edit the owning `config.yaml` entry | File | Reload or restart the proxy after the file change. See the ownership rules below. |

This table lists common tasks. API support varies by resource and setting. Check the request schema and permissions in the [API reference](https://docs.litellm.ai/api-reference/) and your running gateway's API docs. See [Model Management](../model_management.md#automation-api), [Virtual Keys](../virtual_keys.md), and the [configuration reference](../config_settings.md) for more operations and settings.

The generated OpenAPI docs omit the Admin UI's `/config/update` and `/config/field/update` endpoints. See [YAML and database settings](../configs.md#configyaml-vs-database-settings) for their storage and ownership rules.

## Before you start

Connect the gateway to PostgreSQL and set `LITELLM_MASTER_KEY`. Set `STORE_MODEL_IN_DB=True` in the gateway's environment or `general_settings.store_model_in_db: true` in its YAML. Keep the credential encryption key unchanged. See [database model storage](../model_management.md#database-vs-configyaml-models).

If you run multiple workers or replicas, [configure shared Redis](../redis_requirements.md#configure-redis) for rate limits and cache invalidation, including key revocation across workers.

The example uses a proxy-admin credential with access to the management endpoints. Keep that credential in your platform service. Give the client application only the inference key you create below. See [roles and permissions](../access_control.md) to choose a credential for your automation.

The self-hosted model must expose an OpenAI-compatible API that LiteLLM can reach. Set `SELF_HOSTED_API_KEY` on the **LiteLLM server** to the credential for that upstream service. The model definition below references that environment variable.

Run the examples in the same Bash session with `curl` and `jq` installed. Replace the example gateway URL, upstream URL, served model name, and admin credential before you begin.

```bash
set -euo pipefail

export LITELLM_API_BASE="https://llm.example.com"
export LITELLM_ADMIN_KEY="<proxy-admin-credential>"
export SELF_HOSTED_URL="https://models.internal.example.com/v1"
export SELF_HOSTED_MODEL="<model-name-served-by-your-upstream>"
```

## Provision access from your platform

This workflow creates the `client-chat` model alias, a team, and a key that can use only that model. Run the create steps once. Save the returned IDs in your platform for later updates.

### 1. Register the self-hosted model

Clients use the `model_name` value to select this model in LiteLLM. The `openai/` prefix selects the OpenAI-compatible provider. The name after the prefix identifies the model on your upstream service.

```bash
MODEL_ID=$(
  jq -n \
    --arg upstream_model "$SELF_HOSTED_MODEL" \
    --arg upstream_url "$SELF_HOSTED_URL" \
    '{
      model_name: "client-chat",
      litellm_params: {
        model: ("openai/" + $upstream_model),
        api_base: $upstream_url,
        api_key: "os.environ/SELF_HOSTED_API_KEY"
      }
    }' |
  curl --fail-with-body -sS -X POST "$LITELLM_API_BASE/model/new" \
    -H "Authorization: Bearer $LITELLM_ADMIN_KEY" \
    -H "Content-Type: application/json" \
    --data-binary @- |
  jq -er '.model_id'
)
```

`MODEL_ID` identifies this deployment for later updates. Keep `client-chat` out of YAML if you want to manage this model entirely through the API.

### 2. Create a team with model access

```bash
TEAM_ID=$(
  curl --fail-with-body -sS -X POST "$LITELLM_API_BASE/team/new" \
    -H "Authorization: Bearer $LITELLM_ADMIN_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "team_alias": "client-applications",
      "models": ["client-chat"],
      "rpm_limit": 120
    }' |
  jq -er '.team_id'
)
```

The team's model list and rate limit apply to its keys. Add [team budgets](../team_budgets.md) if needed. Set [custom pricing](../custom_pricing.md) for self-hosted models to use cost-based budgets and spend reports.

### 3. Issue an inference key

```bash
CLIENT_KEY=$(
  jq -n --arg team_id "$TEAM_ID" \
    '{
      team_id: $team_id,
      key_alias: "client-application",
      key_type: "llm_api",
      models: ["client-chat"],
      duration: "30d",
      rpm_limit: 60
    }' |
  curl --fail-with-body -sS -X POST "$LITELLM_API_BASE/key/generate" \
    -H "Authorization: Bearer $LITELLM_ADMIN_KEY" \
    -H "Content-Type: application/json" \
    --data-binary @- |
  jq -er '.key'
)
```

Save `CLIENT_KEY` in the application's secret store. `key_type: "llm_api"` selects the inference route preset. The model list limits this key to `client-chat`. The application uses this key to call LiteLLM.

### 4. Verify a model request

```bash
curl --fail-with-body -sS "$LITELLM_API_BASE/v1/chat/completions" \
  -H "Authorization: Bearer $CLIENT_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "client-chat",
    "messages": [{"role": "user", "content": "Reply with hello."}]
  }'
```

Expect a completion from your self-hosted model. If the gateway serves another model, confirm that this key cannot call it. See [key authentication and model access](../key_auth_arch.md) for how key and team permissions combine.

### 5. Update the model and key

Use the deployment ID to change its request timeout without recreating the model:

```bash
curl --fail-with-body -sS -X PATCH \
  "$LITELLM_API_BASE/model/$MODEL_ID/update" \
  -H "Authorization: Bearer $LITELLM_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"litellm_params": {"timeout": 90}}'
```

Use the key update endpoint to reduce the application's rate limit:

```bash
jq -n --arg key "$CLIENT_KEY" '{key: $key, rpm_limit: 30}' |
curl --fail-with-body -sS -X POST "$LITELLM_API_BASE/key/update" \
  -H "Authorization: Bearer $LITELLM_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  --data-binary @-
```

To update the team, call `POST /team/update` with `team_id` and the fields to change. Read the saved model through `GET /model/info` and the team through `GET /team/info?team_id=<team-id>`. Then test requests through your normal gateway address.

### 6. Revoke the key

```bash
jq -n --arg key "$CLIENT_KEY" '{keys: [$key]}' |
curl --fail-with-body -sS -X POST "$LITELLM_API_BASE/key/delete" \
  -H "Authorization: Bearer $LITELLM_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  --data-binary @-
```

Repeat the completion request from step 4. It must now fail authentication. If you run multiple replicas, test that each rejects the key. The team and model remain available to other applications.

## When YAML and API changes meet

From v1.103.0, YAML controls each setting you declare in `general_settings`, `router_settings`, `litellm_settings`, and `environment_variables`. Calls to `/config/update` or `/config/field/update` return HTTP 400 if you try to change those settings. Edit and reload the file, or remove the setting from YAML to let the database control it. If you remove the setting, a saved database value can take effect again.

Models use a different rule. A database model with the same `model_name` as a YAML model adds a deployment alongside it. It does not replace the file's entry. Use `PATCH /model/{model_id}/update` to change database models. Edit YAML models in their file.

Before v1.103.0, database settings took priority over YAML. See [YAML and database settings](../configs.md#configyaml-vs-database-settings) for storage requirements, refresh behavior, and version differences.

## Troubleshoot a management request

| Result | What to check |
| --- | --- |
| Authentication or permission error | Use the platform's management credential, check its role and allowed routes, and confirm it can manage the target resource. |
| Model creation reports missing database storage | Connect PostgreSQL and enable `STORE_MODEL_IN_DB` on the gateway. |
| Update says a setting is controlled by the config file | Check YAML ownership and the gateway version before changing the request. |
| Unknown route or rejected field | Compare the method and payload with the API schema for the version you run. Check API support even if the UI or YAML has a similar option. |
| Requests do not use the saved change | Read the resource back, check its configuration refresh or cache behavior, and test each replica. |

If a request still fails, record the gateway version, endpoint, request, and response. Remove secrets from these records. Note whether YAML or the database stores the resource. These details help you find permission issues, settings that YAML controls, unsupported operations, or bugs.
