---
title: Global Control Plane
sidebar_label: Overview
description: Manage independent LiteLLM deployments through one API, compare usage across regions, and export administrative audit logs.
---

# Global Control Plane

{/* keep-version-note */}

The Global Control Plane provides one API to manage independent LiteLLM deployments across regions and clouds. Each deployment is a **data plane** that serves inference requests and keeps its own keys, teams, budgets, PostgreSQL database, and Redis.

<EnterpriseFeature />

## Use cases

| Need | How the control plane helps |
| --- | --- |
| Isolate data for compliance | Keep each data plane's database, Redis, keys, and credentials in a separate regional environment. The control plane receives management and usage data. |
| Manage resources through one endpoint | Read and update keys, users, teams, models, budgets, and other supported resources on a selected data plane. |
| Compare usage across deployments | Aggregate spend, requests, and tokens. Group results by data plane, model, provider, team, or API key. |
| Give operators limited access | Assign control-plane roles and restrict callers to named data planes. Each data plane also checks the caller's local permissions. |

## How it works

An operator or internal portal sends an authenticated request to the control plane. The control plane checks the caller's role and data-plane access, obtains a credential for the selected data plane, and calls its management API over HTTPS. The data plane checks its own permissions before it returns a result.

Applications send inference requests directly to their regional data plane. A control-plane outage stops central management and reporting. Data planes continue serving inference using their own configuration and dependencies.

| Component | Responsibility | State |
| --- | --- | --- |
| Control plane | Authentication, access rules, management requests, runtime registry and role writes, fleet inventory, usage aggregation, and audit export | Startup registry and roles, optionally extended by runtime entries in its own dedicated PostgreSQL database and Redis stream. Recent audit records and login throttles remain in process memory. |
| Data plane | Inference, local resource management, model routing, and enforcement of keys, teams, and budgets | Its own PostgreSQL, Redis, provider credentials, and master key. |

PostgreSQL and Redis are not required for configuration-only operation. Enable [runtime configuration](./global_control_plane/configuration.md#runtime-configuration) to manage registry entries and roles through the API and propagate them across control-plane replicas.

With runtime configuration enabled, operators can [adopt existing teams and manage their budgets across data planes](./global_control_plane/api_reference.md#adopted-team-budgets). Each data plane still enforces and accounts for its own budget. The control plane does not synchronize other data plane configuration, copy keys, enforce a shared global budget, or fail over inference. Use [Multi-Region Deployment](./multi_region.md) when regional gateways must share one database and the same keys.

## Admin UI

Open `/ui/` on the control-plane host. Sign in once with the username and password set by `UI_USERNAME` and `UI_PASSWORD`. The dashboard uses the same origin and API prefix advertised by the control plane. The browser does not connect to a data plane or use its credentials.

Select a data plane to open its management pages. The picker shows its last reported health. The control plane checks your scopes and data plane bindings, and the selected data plane checks your local permissions. Controls that your session cannot use stay visible with an explanation.

Fleet Models, Fleet Teams, and Fleet Usage show results across the data planes available to your session. When a data plane does not respond, the page identifies it and marks the results as partial. Do not use partial totals as fleet totals.

The Dataplanes and Roles pages manage runtime entries when the control plane has [runtime configuration](./global_control_plane/configuration.md#runtime-configuration) enabled and the session has the required write scope and fleet-wide access. Configuration entries stay read-only. The Audit Log shows recent events visible to the session.

## Documentation

| Topic | Contents |
| --- | --- |
| [Reference Architectures](./global_control_plane/architecture.md) | AWS, Azure, GCP, and hybrid cloud diagrams with regions, private networks, and management connections. |
| [Configuration](./global_control_plane/configuration.md) | Settings and defaults for the control plane, data plane authentication, and audit destinations. |
| [API Reference](./global_control_plane/api_reference.md) | Endpoints, scopes, parameters, and responses. |
| [Legacy UI Deployment Selector](./global_control_plane/legacy_ui.md) | The deprecated Admin UI setup using `worker_registry`. Existing deployments can continue using it. |
