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
| Separate deployments by region or business unit | Manage each deployment through its private endpoint while keeping its database, credentials, and budgets separate. |
| Manage resources through one endpoint | Read and update keys, users, teams, models, budgets, and other supported resources on a selected data plane. |
| Compare usage across deployments | Aggregate spend, requests, and tokens. Group results by data plane, model, provider, team, or API key. |
| Give operators limited access | Assign control-plane roles and restrict callers to named data planes. Each data plane also checks the caller's local permissions. |
| Centralize administrative audit logs | Export control-plane activity to logs, an OTLP collector, S3, Splunk, or Microsoft Sentinel. |

## How it works

An operator or internal portal sends an authenticated request to the control plane. The control plane checks the caller's role and data-plane access, obtains a credential for the selected data plane, and calls its management API over HTTPS. The data plane checks its own permissions before it returns a result.

Applications send inference requests directly to their regional data plane. A control-plane outage stops central management and reporting. Data planes continue serving inference using their own configuration and dependencies.

| Component | Responsibility | State |
| --- | --- | --- |
| Control plane | Authentication, access rules, management requests, fleet inventory, usage aggregation, and audit export | Registry and roles from startup configuration. Recent audit records and login throttles in process memory. No PostgreSQL or Redis required. |
| Data plane | Inference, local resource management, model routing, and enforcement of keys, teams, and budgets | Its own PostgreSQL, Redis, provider credentials, and master key. |

The control plane does not copy keys, synchronize configuration, enforce a shared global budget, or fail over inference between data planes. Use [Multi-Region Deployment](./multi_region.md) when regional gateways must share one database and the same keys.

This implementation exposes REST APIs and interactive API documentation. It does not serve the Admin UI.

## Functionality

All API paths below use the default `/api/v1` prefix.

| Function | API | Result |
| --- | --- | --- |
| List data planes | `GET /api/v1/dataplanes` | Registered data planes visible to the caller. |
| Check a data plane | `GET /api/v1/dataplanes/{id}/health` | Reachability and liveness status. |
| Check effective identity | `GET /api/v1/dataplanes/{id}/whoami` | The credential type and user identity resolved by that data plane. |
| Find models | `GET /api/v1/fleet/models` | Model deployments and the data planes that serve each public model name. |
| List teams | `GET /api/v1/fleet/teams` | Teams the caller can view on each data plane. |
| Report usage | `GET /api/v1/usage/summary`, `/daily`, `/top` | Totals, daily breakdowns, and the largest spenders. |
| Manage a resource | `/api/v1/dataplanes/{id}/proxy/{path}` | The selected data plane's response to a supported management request. |
| Read audit events | `GET /api/v1/audit` and `/api/v1/audit/ocsf` | Recent control-plane events in native or OCSF format. |

Management requests support keys, users, teams, organizations, budgets, models, credentials, guardrails, MCP servers, vector stores, spend, and supported settings routes. The control plane blocks inference, login, SSO, OAuth, service-account key generation, guardrail execution, and configuration-file routes. See the [management route reference](https://github.com/BerriAI/litellm/blob/litellm_control_plane_siem_sinks/litellm/proxy/control_plane/proxy/allowlist.py) for the exact paths.

Fleet and usage calls return available results with `partial: true` and an `unreachable` list when some data planes fail. They return `503` when none of the selected data planes answer. Usage responses also report `truncated_dataplanes` when a data plane limits its API-key breakdown.

Usage queries accept inclusive `start_date` and `end_date` values in UTC. They default to the last 30 days. `/daily` and `/top` support `group_by=dataplane`, `model`, `model_group`, `provider`, `endpoint`, `api_key`, or `team`. Add `dataplane=eu` to query one registered data plane.

## Guides

| Topic | Contents |
| --- | --- |
| [Cloud Architectures](./global_control_plane/architecture.md) | AWS, Azure, GCP, and hybrid cloud diagrams with regions, private networks, and management connections. |
| [Configuration](./global_control_plane/configuration.md) | Start the service, connect data planes, configure identity and roles, and call the API. |
| [Audit Logs](./global_control_plane/audit.md) | Configure audit destinations, delivery behavior, and retention. |
| [UI Deployment Selector](./global_control_plane/legacy_ui.md) | The existing Admin UI setup using `worker_registry`. |
