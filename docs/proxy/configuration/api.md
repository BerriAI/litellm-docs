---
title: Configure LiteLLM with the Management API
sidebar_label: Management API
toc_max_heading_level: 2
description: Use HTTP APIs to register models, create teams and virtual keys, update access, and revoke keys on a running LiteLLM gateway.
---

# Configure LiteLLM with the Management API

{/* keep-version-note */}

Use the Management API to connect an internal portal, provisioning service, or automation script to a running LiteLLM gateway. Your application can register a model, grant a team access, issue a virtual key, and revoke that key through HTTP requests.

The [Admin UI](./ui.md) and [Terraform provider](./terraform.md) also manage supported gateway resources through APIs. Choose direct API calls when your own application needs to make those changes. The [deployment guides](../deploy.md) cover installing LiteLLM and provisioning its infrastructure.

## What the API manages

| Task | API | Storage and ownership | When changes apply |
| --- | --- | --- | --- |
| Add, update, or remove a database model | `POST /model/new`, `PATCH /model/{model_id}/update`, `POST /model/delete` | Database; requires `STORE_MODEL_IN_DB=True` | No proxy restart. Check that each replica has refreshed its model list. |
| Create a team or update its model access and limits | `POST /team/new`, `POST /team/update` | Database | No proxy restart. Verify the resulting access through the gateway. |
| Issue, update, or revoke a virtual key | `POST /key/generate`, `POST /key/update`, `POST /key/delete` | Database | No proxy restart. Verify access changes across serving replicas. |
| Change a supported gateway setting | `POST /config/update` | Database for settings not owned by YAML; requires database configuration storage | Applied through configuration refresh; check the setting's documented behavior. |
| Change a YAML-owned model or setting | Edit the owning `config.yaml` entry | File | Reload or restart the proxy after the file change. See the ownership rules below. |

This is a starting set of operations, not a promise that every YAML field, UI control, and Terraform resource has equivalent API coverage. Use the [API reference](https://docs.litellm.ai/api-reference/) and the API documentation exposed by your running gateway to check its request schema and permissions. See [Model Management](../model_management.md#automation-api), [Virtual Keys](../virtual_keys.md), and the [configuration reference](../config_settings.md) for additional operations and settings.

The Admin UI's `/config/update` and `/config/field/update` endpoints are omitted from generated OpenAPI documentation. Their storage and ownership rules are covered in [YAML and database settings](../configs.md#configyaml-vs-database-settings).

## Before you start

Start with a running gateway connected to PostgreSQL and configured with `LITELLM_MASTER_KEY`. Enable `STORE_MODEL_IN_DB=True` in the gateway's environment, or set `general_settings.store_model_in_db: true` in its YAML. Keep the credential encryption key stable; see [database model storage](../model_management.md#database-vs-configyaml-models).

If you run multiple workers or replicas, [configure shared Redis](../redis_requirements.md#configure-redis) for rate limits and cache invalidation, including key revocation across workers.

The example uses a proxy-admin credential authorized for the management endpoints. Your platform service holds that credential; the client application receives only the inference key created below. See [roles and permissions](../access_control.md) when assigning a credential to your automation.

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

This workflow creates a model alias called `client-chat`, a team, and a key restricted to that model. Run the create steps once, then retain the returned IDs in your provisioning system for later updates.

### 1. Register the self-hosted model

The `model_name` is what callers send to LiteLLM. The `openai/` prefix selects the OpenAI-compatible provider; the name after it identifies the model served by your upstream.

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

The team's model list and rate limit apply to its keys. Add [team budgets](../team_budgets.md) if needed; self-hosted models need appropriate [custom pricing](../custom_pricing.md) for cost-based budgets and spend reporting.

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

Deliver `CLIENT_KEY` to the application's secret store. `key_type: "llm_api"` selects the inference route preset; the model list restricts this key to `client-chat`. The application calls LiteLLM using this key.

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

For a team-wide change, use `POST /team/update` with `team_id` and the fields to change. Read the saved model through `GET /model/info` and the team through `GET /team/info?team_id=<team-id>`, then verify requests through your normal gateway address.

### 6. Revoke the key

```bash
jq -n --arg key "$CLIENT_KEY" '{keys: [$key]}' |
curl --fail-with-body -sS -X POST "$LITELLM_API_BASE/key/delete" \
  -H "Authorization: Bearer $LITELLM_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  --data-binary @-
```

Repeat the completion request from step 4. It must now fail authentication. In a deployment with multiple replicas, verify revocation across them as well. Deleting the key leaves the team and model available for other applications.

## When YAML and API changes meet

From v1.103.0, a setting declared in `general_settings`, `router_settings`, `litellm_settings`, or `environment_variables` in YAML is owned by that file. Attempts to change it through `/config/update` or `/config/field/update` return HTTP 400. Edit and reload the file, or remove the setting from YAML to let the database own it. Removing it can reactivate a previously stored database value.

Models use a different rule. A database model with the same `model_name` as a YAML model adds a deployment alongside it. It does not replace the file's entry. `PATCH /model/{model_id}/update` updates database models; YAML models must be changed in their file.

Before v1.103.0, database settings took precedence over YAML. Read [YAML and database settings](../configs.md#configyaml-vs-database-settings) for storage prerequisites, refresh behavior, and version differences.

## Troubleshoot a management request

| Result | What to check |
| --- | --- |
| Authentication or permission error | Use the platform's management credential, check its role and allowed routes, and confirm it can manage the target resource. |
| Model creation reports missing database storage | Connect PostgreSQL and enable `STORE_MODEL_IN_DB` on the gateway. |
| Update says a setting is controlled by the config file | Check YAML ownership and the gateway version before changing the request. |
| Unknown route or rejected field | Compare the method and payload with the API schema for the version you run. A similar UI control or YAML field does not establish API support. |
| Saved change is not reflected in requests | Read the resource back, check the relevant configuration refresh or cache behavior, and test each serving replica. |

When an operation still fails, retain the gateway version, endpoint, redacted request and response, and whether the resource came from YAML or the database. Those details distinguish a permission or ownership issue from an unsupported operation or a bug.
