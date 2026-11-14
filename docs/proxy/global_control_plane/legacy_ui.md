---
title: UI Deployment Selector
sidebar_label: UI Deployment Selector
description: Use the existing worker registry to manage independent LiteLLM deployments from one Admin UI.
---

import { ControlPlaneArchitecture } from '@site/src/components/ControlPlaneArchitecture';

# UI Deployment Selector

{/* keep-version-note */}

This guide covers the existing `worker_registry` UI. For the new management API, see [Global Control Plane](../global_control_plane.md).

Deploy a single LiteLLM UI that manages multiple independent LiteLLM proxy instances, each with its own database, Redis, and master key.

<EnterpriseFeature />

## When to use this

Use this UI to manage independent deployments. Each worker keeps its own keys, teams, and budgets. A key created on one worker does not authenticate on another.

For regional proxies that share one database, use a [dedicated admin instance](../multi_region.md#optional-dedicated-admin-instance).

## Architecture

<ControlPlaneArchitecture />

The **UI instance** serves the Admin UI and lists the registered workers. The browser connects directly to the selected worker for management requests.

Each **worker** is a fully independent LiteLLM proxy that handles LLM requests for its region or team. Workers have their own database, Redis, users, keys, teams, and budgets.

## Setup

### 1. UI configuration

Add each worker to `worker_registry` with its `worker_id`, `name`, and `url`:

```yaml title="cp_config.yaml"
model_list: []

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  database_url: os.environ/DATABASE_URL

worker_registry:
  - worker_id: "worker-a"
    name: "Worker A"
    url: "http://localhost:4001"
  - worker_id: "worker-b"
    name: "Worker B"
    url: "http://localhost:4002"
```

Start the UI instance:

```bash
litellm --config cp_config.yaml --port 4000
```

### 2. Worker configuration

Each worker needs `control_plane_url` in its `general_settings`. This enables the `/v3/login` and `/v3/login/exchange` endpoints on the worker so the control plane UI can authenticate against it cross-origin. `PROXY_BASE_URL` must also be set for each worker so that SSO callback redirects resolve correctly.

```yaml title="worker_a_config.yaml"
model_list: []

general_settings:
  master_key: os.environ/WORKER_A_MASTER_KEY
  database_url: os.environ/WORKER_A_DATABASE_URL # unique per worker
  control_plane_url: "http://localhost:4000"
```

```bash
PROXY_BASE_URL=http://localhost:4001 litellm --config worker_a_config.yaml --port 4001
```

Repeat for each worker with its own master key, database URL, and port. See [Production Best Practices](../prod.md) for worker settings.

:::important
Each worker must have its own `master_key` and `database_url`.
:::

:::info
If a worker runs more than one instance behind a load balancer, configure Redis on that worker (the `cache` section of its config). The login code issued by `/v3/login` is stored server-side, so without shared Redis the exchange can land on a different instance and fail with a 401.
:::

### 3. SSO

SSO is configured on the control plane instance the same way as a standard LiteLLM proxy. See the [SSO setup guide](../admin_ui_sso.md) for full instructions. If you use SSO, register each worker URL and the control plane URL as allowed callback URLs in your SSO provider's dashboard.

With the control plane and at least one worker running, open `http://localhost:4000/ui`. You should see the worker selector on the login page.

## Login flow

On load, the UI reads the control plane's `/.well-known/litellm-ui-config` endpoint, which reports `is_control_plane: true` whenever `worker_registry` is set, along with the registered workers (their IDs, names, and URLs). The login page shows a worker selector.

The user picks a worker and logs in with username/password or SSO. The UI authenticates against the selected worker by calling its `/v3/login` endpoint, which returns a single-use code, then redeems that code at the worker's `/v3/login/exchange` for a JWT. From then on it points all subsequent API calls at that worker, so keys, teams, models, and budgets are managed on the selected worker from the control plane UI.

Once logged in, users can switch workers from the navbar dropdown without leaving the UI. Switching redirects back to the login page to authenticate against the new worker.
