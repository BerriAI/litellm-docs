---
title: Tripo 3D generation
description: Use Tripo V3 through LiteLLM Proxy with separate China and global credentials, native task requests, and credit-based cost tracking.
---

# Tripo 3D generation

Forward native Tripo V3 requests through LiteLLM Proxy with separate China and global credentials. LiteLLM returns the native response and records task cost after the task reaches a terminal status.

| Feature | Support |
| --- | --- |
| Request format | Native Tripo V3 JSON and multipart requests |
| Authentication | LiteLLM key for the client; configured regional Tripo key upstream |
| Cost tracking | Terminal task credits multiplied by the configured price per credit |
| Task status | Native `GET /v3/tasks/{task_id}` through the region that created the task |

## Regions and routes

| Region | Proxy prefix | Upstream `api_base` |
| --- | --- | --- |
| China | `/cn.tripo/v3` | `https://openapi.tripo3d.com/v3` |
| Global | `/tripo/v3` | `https://openapi.tripo3d.ai/v3` |

The URL prefix selects the region. LiteLLM selects credentials by provider and the hostname in `api_base`. Use the key issued for that regional endpoint. The base path must be `/v3`, with no query string or fragment, and the deployment must set `use_in_pass_through: true`.

Both routes accept `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, and `OPTIONS`; the upstream endpoint determines which methods are valid. Request paths must start with `v3/` and cannot contain empty or relative path segments.

## Configure the proxy

Set credentials in the proxy environment:

```bash
export LITELLM_MASTER_KEY='sk-your-private-proxy-key'
export TRIPO_API_KEY='your-China-Tripo-key'
export TRIPO_GLOBAL_API_KEY='your-global-Tripo-key'
```

Save this as `config.yaml`. For one region, keep only its deployment.

```yaml
model_list:
  - model_name: tripo-cn
    litellm_params:
      model: tripo/task
      custom_llm_provider: tripo
      api_key: os.environ/TRIPO_API_KEY
      api_base: https://openapi.tripo3d.com/v3
      use_in_pass_through: true
  - model_name: tripo-global
    litellm_params:
      model: tripo/task
      custom_llm_provider: tripo
      api_key: os.environ/TRIPO_GLOBAL_API_KEY
      api_base: https://openapi.tripo3d.ai/v3
      use_in_pass_through: true

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

The environment variable names are configuration choices. Set the matching `api_key` reference if you use a different name; the variable name does not select the region. Start the proxy with these variables available:

```bash
litellm --config config.yaml --port 4000
```

For persistent spend logs and UI usage reports, also [connect a database](../proxy/virtual_keys.md#setup). Restart the proxy after credential changes so it reloads its environment. If Docker Compose loads credentials through `env_file`, recreate the service to load the changed values.

## Create a task

Use a LiteLLM key in the client authorization header. The proxy supplies the configured Tripo credential upstream. This example selects China; set `TRIPO_PROXY_BASE` to `http://localhost:4000/tripo/v3` for the global service.

```bash
export LITELLM_API_KEY='sk-your-litellm-key'
export TRIPO_PROXY_BASE='http://localhost:4000/cn.tripo/v3'

curl "$TRIPO_PROXY_BASE/generation/text-to-model" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "v3.1-20260211",
    "prompt": "A stylized orange cat with smooth surfaces"
  }'
```

The client key can be the master key from the configuration above or a [virtual key](../proxy/virtual_keys.md). The request body's `model` selects a Tripo model version. Keep the deployment names `tripo-cn`, `tripo-global`, and the configuration value `tripo/task` out of this field. Send native Tripo request fields and `Content-Type: application/json`; for multipart uploads, let the HTTP client set the boundary.

## Check the task result

A successful submission returns `data.task_id`. Save that ID and query it through the same regional prefix. Each creation POST starts a new task, so use GET to check status.

```bash
export TRIPO_TASK_ID='task-id-from-the-submission'

curl "$TRIPO_PROXY_BASE/tasks/$TRIPO_TASK_ID" \
  -H "Authorization: Bearer $LITELLM_API_KEY"
```

## Cost tracking

A successful creation POST outside `/v3/tasks` with response `code: 0` and a task ID starts a background billing poller. LiteLLM queries `/v3/tasks/{task_id}` immediately, then every 10 seconds for up to 180 attempts, with a 30-second timeout per request. The creation response returns before background cost tracking finishes.

The poller stops on `success`, `failed`, `cancelled`, `canceled`, `banned`, or `expired`. LiteLLM calculates cost as terminal `credits_consumed × cost_per_credit`. Failed or cancelled tasks can have a cost when the terminal response reports consumed credits. Intermediate `queued` or `running` responses do not trigger billing.

LiteLLM uses the requested model's price entry when available and falls back to `tripo/task`. The recorded USD amount uses that configured price per credit; check it against your account's billing terms. Client GET requests do not reapply generation credits, and internal polls bypass the proxy request logging route.

Polling errors, invalid responses, mismatched task IDs, exhausted attempts, missing credits, or missing prices leave cost unknown. Spend reports can show zero in these cases. A zero in the report alone does not confirm that Tripo charged nothing.

The poller runs in process memory and does not resume after a proxy restart. There is no durable task-ID deduplication across repeated creation responses, retries, workers, or restarts. Previously recorded zero-cost rows are not automatically backfilled after a price correction.

With database logging enabled, view requests at `/ui/logs` and totals at `/ui/usage`. Allow for task completion and spend-log flushing before checking the recorded cost.

## Troubleshooting

A `503` with a missing-deployment message means the requested region has no usable `use_in_pass_through: true` deployment. A `503` about `api_base` means the base path, query, or fragment is invalid. A `400` about the path means the request does not use a valid `v3/` path.

If Tripo returns `Invalid API key`, check the regional hostname and its configured credential, then restart the proxy. For a successful task with zero spend, inspect terminal `credits_consumed`, the model's `cost_per_credit`, and the proxy's `Tripo task` billing warnings.
