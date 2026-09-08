import { ControlPlaneArchitecture } from '@site/src/components/ControlPlaneArchitecture';

# Global Control Plane

Deploy a single LiteLLM UI that manages multiple independent LiteLLM proxy instances, each with its own database, Redis, and master key.

<EnterpriseFeature />

## When to use this

Pick this over the shared-database [Multi-Region Deployment](./multi_region.md) topology when blast-radius isolation matters more than global consistency. A database outage on one worker cannot affect another, but a key created on one worker will not authenticate on another, because keys, teams, and budgets are local to the worker that owns them. Multi-Region covers the full tradeoff and the licensing table, where this page appears as a row

Do not confuse this with the dedicated admin instance described on that page. That instance is also admin-only and serves no LLM traffic, but it shares one database with the regional proxies it manages, so it administers a single deployment. A global control plane shares nothing with its workers and administers many separate deployments

## Architecture

<ControlPlaneArchitecture />

The **control plane** is a LiteLLM instance that serves the admin UI and knows about all the workers. It exists purely so admins can switch between workers and manage them from a single UI

Each **worker** is a fully independent LiteLLM proxy that handles LLM requests for its region or team. Workers have their own database, Redis, users, keys, teams, and budgets

## Setup

### 1. Control Plane Configuration

The control plane needs a `worker_registry` that lists all worker instances. Each entry requires `worker_id`, `name`, and `url`

```yaml title="cp_config.yaml"
model_list: []

general_settings:
  master_key: sk-1234
  database_url: os.environ/DATABASE_URL

worker_registry:
  - worker_id: "worker-a"
    name: "Worker A"
    url: "http://localhost:4001" # must start with http:// or https://
  - worker_id: "worker-b"
    name: "Worker B"
    url: "http://localhost:4002"
```

Start the control plane:

```bash
litellm --config cp_config.yaml --port 4000
```

### 2. Worker Configuration

Each worker needs `control_plane_url` in its `general_settings`. This enables the `/v3/login` and `/v3/login/exchange` endpoints on the worker so the control plane UI can authenticate against it cross-origin. `PROXY_BASE_URL` must also be set for each worker so that SSO callback redirects resolve correctly

```yaml title="worker_a_config.yaml"
model_list: []

general_settings:
  master_key: sk-worker-a-1234 # unique per worker
  database_url: os.environ/WORKER_A_DATABASE_URL # unique per worker
  control_plane_url: "http://localhost:4000"
```

```bash
PROXY_BASE_URL=http://localhost:4001 litellm --config worker_a_config.yaml --port 4001
```

Repeat this for every worker in the registry, changing the master key, the database URL, and the port each time. A worker is an ordinary LiteLLM proxy in every other respect, so the [production deployment guide](./prod.md) applies to it unchanged

:::important
Each worker must have its own `master_key` and `database_url`. The whole point of this architecture is that workers are independent
:::

:::info
If a worker runs more than one instance behind a load balancer, configure Redis on that worker (the `cache` section of its config). The login code issued by `/v3/login` is stored server-side, so without shared Redis the exchange can land on a different instance and fail with a 401
:::

### 3. SSO Configuration (Optional)

SSO is configured on the control plane instance the same way as a standard LiteLLM proxy. See the [SSO setup guide](./admin_ui_sso.md) for full instructions. If you use SSO, register each worker URL and the control plane URL as allowed callback URLs in your SSO provider's dashboard

With the control plane and at least one worker running, open `http://localhost:4000/ui`. You should see the worker selector on the login page

## How It Works

### Login Flow

On load, the UI reads the control plane's `/.well-known/litellm-ui-config` endpoint, which reports `is_control_plane: true` whenever `worker_registry` is set, along with the registered workers (their IDs, names, and URLs). Because it is a control plane, the login page shows a worker selector dropdown

The user picks a worker and logs in with username/password or SSO. The UI authenticates against the selected worker by calling its `/v3/login` endpoint, which returns a single-use code, then redeems that code at the worker's `/v3/login/exchange` for a JWT. From then on it points all subsequent API calls at that worker, so keys, teams, models, and budgets are managed on the selected worker from the control plane UI

Once logged in, users can switch workers from the navbar dropdown without leaving the UI. Switching redirects back to the login page to authenticate against the new worker
