import { TenancyDiagram } from '@site/src/components/CloudArchitecture';

# Multi-Tenant Architecture with LiteLLM

## Overview

Multi-tenancy in LiteLLM means running a single proxy that serves many distinct tenants inside your own company (organizations, teams, departments) while keeping their access, spend, and usage isolated from one another. One gateway acts as the shared entry point to every LLM provider, and every request carries the tenant context that determines which models it can reach, which budget it draws from, and where its cost lands.

The design solves a few problems that show up whenever more than one group shares an LLM gateway. Cost has to be attributed to the right business unit rather than pooled. Access has to differ per tenant, since teams need different models, budgets, and rate limits. Administration has to be delegated, so a team lead can manage their own team without platform-wide admin rights. And the same architecture has to hold from a handful of users to tens of thousands without a redesign.

:::info Open Source vs. Enterprise
Teams and Virtual Keys are available in open source, and Teams alone can serve as your top-level tenant boundary. Organizations and Org Admins add a further layer of hierarchy on top and are an enterprise feature ([get a 30 day trial](https://www.litellm.ai/#trial)).
:::

## The Tenancy Hierarchy

<TenancyDiagram />

LiteLLM models tenancy as four nested levels: Organizations contain Teams, Teams contain Users, and Users and Teams own Keys. Each level is a boundary for isolation and for spend attribution.

- Organizations are the top-level tenant and can hold multiple teams. [API Reference](https://litellm-api.up.railway.app/#/organization%20management)
- Teams are collections of users and can hold multiple users. [API Reference](https://litellm-api.up.railway.app/#/team%20management)
- Users belong to teams (possibly several at once) and can own multiple keys. [API Reference](https://litellm-api.up.railway.app/#/user%20management)
- Keys authenticate requests and belong to a user, a team, or both. [API Reference](https://litellm-api.up.railway.app/#/key%20management)

### Organizations

An Organization is the highest level of isolation, typically mapped to a business unit or a region. Organizations cannot see each other's data or keys, each carries its own budget and allowed-model list, and each is administered by its own org admins who manage only the teams inside it. Organizations are an enterprise feature.

### Teams

A Team is a logical grouping of users who work together, and it is the primary tenant boundary in open source. A team has its own budget and rate limits, its own admins, its own model access controls, and its own service account keys for shared workloads. When a team sits inside an organization it inherits that organization's constraints and cannot exceed the org budget or reach models the org does not allow.

### Users

A User is an individual who belongs to one or more teams and creates or uses keys. Spend is tracked per user, and what a user can do is governed by their role, which ranges from a plain internal user through team and org admins up to the platform-wide proxy admin. Removing a user deletes the keys they personally own.

### Keys (Virtual Keys)

A Virtual Key is what authenticates a request and ties it to a tenant for spend tracking. A key can be scoped to a user, to a team (a service account key that survives member turnover), or to both. For the full breakdown of key types and when to use each, see [Service Accounts](./service_accounts.md).

## Roles and Delegation

Isolation only works if administration can be delegated along the same hierarchy. LiteLLM ships roles at two altitudes: platform-wide roles (`proxy_admin`, `proxy_admin_viewer`, `internal_user`) that apply everywhere, and scoped roles (`org_admin`, `team_admin`) that grant control over a single organization or team. A proxy admin creates organizations and assigns org admins, an org admin creates teams within their organization and assigns team admins, and a team admin manages their own team's members, rate limits, and keys without touching anything else (they may keep or lower the team budget, but raising it requires a proxy admin). That chain is what lets the platform onboard thousands of users without every change routing through a central admin. For the complete role matrix, per-role capabilities, and configurable team-member permissions, see [Access Control](./access_control.md), and for how internal users onboard and manage their own keys see [Internal User Self-Serve](./self_serve.md).

## Spend and Budgets

Spend flows up the hierarchy, so every request's cost is attributed to its key, its user, its team, and its organization at once. Budgets can be set at each level and are enforced inward: a team budget cannot exceed its organization's, a user budget cannot exceed the team's, and a request is blocked once any level along its path is over budget. This is what makes per-tenant chargeback and showback possible from a shared instance. See [Team Budgets](./team_budgets.md) for configuring budgets across the hierarchy and [Cost Tracking](./cost_tracking.md) for how spend is attributed and reported.

## Common Tenancy Patterns

The same four levels express several real-world shapes. These are illustrations of how the hierarchy maps onto an organization, not setup guides.

### Enterprise Departments

A large enterprise gives each department its own tenant. With Organizations, Engineering, Marketing, and Sales are separate organizations, each holding several teams (Backend, Frontend, ML, and so on) that manage their own budgets under a department-wide cap. In open source the same separation is expressed with teams alone (an Engineering Backend team, a Marketing Content team, and so on), trading the department-level rollup for a flatter structure. Either way each group owns its budget, department or team leads act as admins, and finance keeps cross-department cost visibility.

### Environment Separation

A single company separates Production, Staging, and Development into distinct teams so that experimentation cannot spend against or destabilize production. Production and staging lean on service account keys with strict rate limits and an approved model list, while development uses more permissive user keys for testing. Because each environment is its own budget and model boundary, development traffic can never draw down the production budget.

## Related Documentation

- [User Management Hierarchy](./user_management_heirarchy.md) - visual overview of users, teams, organizations, and budgets
- [Access Control (RBAC)](./access_control.md) - roles, permissions, and onboarding organizations
- [Service Accounts](./service_accounts.md) - virtual key types and shared production keys
- [Team Budgets](./team_budgets.md) - budgets across the hierarchy
- [Cost Tracking](./cost_tracking.md) - spend attribution and reporting
- [Internal User Self-Serve](./self_serve.md) - how users onboard and manage their own keys
- [Logging](./logging.md) - monitoring spend and usage with tenant context
- [Admin UI](./ui.md) - visual dashboard for managing tenants
