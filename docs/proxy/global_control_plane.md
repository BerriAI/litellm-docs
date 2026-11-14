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

## Documentation

| Topic | Contents |
| --- | --- |
| [Reference Architectures](./global_control_plane/architecture.md) | AWS, Azure, GCP, and hybrid cloud diagrams with regions, private networks, and management connections. |
| [Configuration](./global_control_plane/configuration.md) | Settings and defaults for the control plane, data plane authentication, and audit destinations. |
| [API Reference](./global_control_plane/api_reference.md) | Endpoints, scopes, parameters, and responses. |
| [UI Deployment Selector](./global_control_plane/legacy_ui.md) | The existing Admin UI setup using `worker_registry`. |
