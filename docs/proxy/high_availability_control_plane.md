import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import { ControlPlaneArchitecture } from '@site/src/components/ControlPlaneArchitecture';

# [BETA] High Availability Control Plane

Deploy a single LiteLLM UI that manages multiple independent LiteLLM proxy instances, each with its own database, Redis, and master key.

:::info

This is an Enterprise feature.

[Enterprise Pricing](https://www.litellm.ai/#pricing)

[Get free 7-day trial key](https://www.litellm.ai/enterprise#trial)

:::

## When to use this

Each worker is a fully independent LiteLLM proxy with its own database, Redis, and master key. Keys, teams, and budgets are local to a worker and never span workers; a single control plane UI manages all of them from one place.

Pick this over the shared-database [Multi-Region Deployment](./multi_region.md) topology when blast-radius isolation matters more than global consistency. A database outage on one worker cannot affect another, but a key created on one worker will not authenticate on another. Multi-Region covers the full tradeoff and the licensing table, where this page appears as a row.

## Architecture

<ControlPlaneArchitecture />

The **control plane** is a LiteLLM instance that serves the admin UI and knows about all the workers. It is not a router; it does not proxy or route any LLM requests. It exists purely so admins can switch between workers and manage them from a single UI.

Each **worker** is a fully independent LiteLLM proxy that handles LLM requests for its region or team. Workers have their own database, Redis, users, keys, teams, and budgets. No infrastructure is shared between workers.

## Setup

### 1. Control Plane Configuration

The control plane needs a `worker_registry` that lists all worker instances. Each entry requires `worker_id`, `name`, and `url`.

```yaml title="cp_config.yaml"
model_list: []

general_settings:
  master_key: sk-1234
  database_url: os.environ/DATABASE_URL

worker_registry:
  - worker_id: "worker-a"
    name: "Worker A"
    url: "http://localhost:4001"
  - worker_id: "worker-b"
    name: "Worker B"
    url: "http://localhost:4002"
```

Start the control plane:

```bash
litellm --config cp_config.yaml --port 4000
```

### 2. Worker Configuration

Each worker needs `control_plane_url` in its `general_settings`. This enables the `/v3/login` and `/v3/login/exchange` endpoints on the worker so the control plane UI can authenticate against it cross-origin.

`PROXY_BASE_URL` must also be set for each worker so that SSO callback redirects resolve correctly.

<Tabs>
<TabItem value="worker-a" label="Worker A">

```yaml title="worker_a_config.yaml"
model_list: []

general_settings:
  master_key: sk-worker-a-1234
  database_url: os.environ/WORKER_A_DATABASE_URL
  control_plane_url: "http://localhost:4000"
```

```bash
PROXY_BASE_URL=http://localhost:4001 litellm --config worker_a_config.yaml --port 4001
```

</TabItem>
<TabItem value="worker-b" label="Worker B">

```yaml title="worker_b_config.yaml"
model_list: []

general_settings:
  master_key: sk-worker-b-1234
  database_url: os.environ/WORKER_B_DATABASE_URL
  control_plane_url: "http://localhost:4000"
```

```bash
PROXY_BASE_URL=http://localhost:4002 litellm --config worker_b_config.yaml --port 4002
```

</TabItem>
</Tabs>

:::important
Each worker must have its own `master_key` and `database_url`. The whole point of this architecture is that workers are independent.
:::

:::info
If a worker runs more than one instance behind a load balancer, configure Redis on that worker (the `cache` section of its config); the login code issued by `/v3/login` is stored server-side, so without shared Redis the exchange can land on a different instance and fail with a 401.
:::

### 3. SSO Configuration (Optional)

SSO is configured on the control plane instance the same way as a standard LiteLLM proxy. See the [SSO setup guide](./admin_ui_sso.md) for full instructions.

If using SSO, register each worker URL and the control plane URL as allowed callback URLs in your SSO provider's dashboard.

## How It Works

### Login Flow

On load, the UI reads the control plane's `/.well-known/litellm-ui-config` endpoint, which reports `is_control_plane: true` along with the registered workers (their IDs, names, and URLs). Because it is a control plane, the login page shows a worker selector dropdown.

The user picks a worker and logs in with username/password or SSO. The UI authenticates against the selected worker by calling its `/v3/login` endpoint, which returns a single-use code; the UI redeems that code at the worker's `/v3/login/exchange` for a JWT. From then on it points all subsequent API calls at that worker, so keys, teams, models, and budgets are managed on the selected worker from the control plane UI.

### Switching Workers

Once logged in, users can switch workers from the navbar dropdown without leaving the UI. Switching redirects back to the login page to authenticate against the new worker.

## Local Testing

To try this out locally, start each instance in a separate terminal:

```bash
# Terminal 1: Control Plane
litellm --config cp_config.yaml --port 4000

# Terminal 2: Worker A
PROXY_BASE_URL=http://localhost:4001 litellm --config worker_a_config.yaml --port 4001

# Terminal 3: Worker B
PROXY_BASE_URL=http://localhost:4002 litellm --config worker_b_config.yaml --port 4002
```

Then open `http://localhost:4000/ui`. You should see the worker selector on the login page.

## Configuration Reference

### Control Plane Settings

| Field | Location | Description |
|---|---|---|
| `worker_registry` | Top-level config | List of worker instances |
| `worker_registry[].worker_id` | Required | Unique identifier for the worker |
| `worker_registry[].name` | Required | Display name shown in the UI |
| `worker_registry[].url` | Required | Full URL of the worker instance (must start with `http://` or `https://`) |

### Worker Settings

| Field | Location | Description |
|---|---|---|
| `general_settings.control_plane_url` | Required | URL of the control plane instance. Enables the `/v3/login` and `/v3/login/exchange` endpoints on this worker. |
| `PROXY_BASE_URL` | Environment variable | The worker's own external URL. Required for SSO callback redirects. |

## Related Documentation

For the shared-database alternative and cross-region licensing, see [Multi-Region Deployment](./multi_region.md); for authentication, the [SSO setup guide](./admin_ui_sso.md); and for hardening, the [production deployment guide](./prod.md)
