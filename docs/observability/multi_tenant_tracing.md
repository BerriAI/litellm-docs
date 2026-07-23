---
title: Multi-Tenant Trace Destinations
description: Route each team's LLM traces to their own observability backend — Langfuse, Arize, Weave, or any OTLP endpoint — without sharing credentials.
sidebar_label: Multi-Tenant Tracing
sidebar_position: 3
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Multi-Tenant Trace Destinations

Route each team's LLM traces to their own observability backend without giving them access to other teams' credentials or data.

## How it works

There are two roles involved: a **proxy admin** who holds all credentials, and **team admins** who pick where their team's traces go.

**The proxy admin** creates destinations once, like a Langfuse project or an Arize space, and decides which teams are allowed to use each one. The actual API keys never leave the server.

**Team admins** see only the destinations their team is allowed to use. They pick from that list and save. From that point on, LLM calls made by their team automatically export to the selected destinations.

Here is what that looks like end to end:

```
1. Proxy admin creates "langfuse-team-a"
   └─ credential_values: { public_key: pk-..., secret_key: sk-... }  ← only the admin sees this
   └─ access: { teams: ["team-a"] }                                   ← team-a can use it; team-b cannot

2. Team A admin opens their team settings
   └─ picker shows: "langfuse-team-a" (allowed), but NOT "langfuse-team-b" (belongs to another team)
   └─ selects "langfuse-team-a" and saves

3. Team A makes an LLM call
   └─ proxy resolves: team-a has "langfuse-team-a" assigned  →  export
   └─ proxy resolves: team-b has nothing assigned            →  no export
   └─ the two teams never see each other's traces or secrets
```

A destination with `auto_enable: true` skips the assignment step; it fires automatically for every request within its access scope, without the team admin needing to select it.

---

## Step 1 — Proxy admin creates a destination

Open **Settings, Logging Callbacks** and click **+ Add Callback**.

![Admin adds a destination with access controls](/img/multitenant/add_destination_access_control.png)

Fill in the backend credentials and set the **Access** section:

| Field | What it controls |
|---|---|
| **Global** toggle | Any team or org admin can see and assign this destination |
| **Teams** | Only the listed teams can see and assign it |
| **Organizations** | Only teams inside the listed orgs can see and assign it |
| **Auto-enable for all requests** | Fires automatically for every identity within the access scope, without explicit assignment |

Click **Add**. The destination is registered. Credentials are encrypted at rest.

<details>
<summary>API equivalent</summary>

```bash
curl -X POST https://your-proxy/credentials \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "credential_name": "team-a-langfuse",
    "credential_values": {
      "langfuse_public_key": "pk-lf-...",
      "langfuse_secret_key": "sk-lf-...",
      "langfuse_host": "https://cloud.langfuse.com"
    },
    "credential_info": {
      "credential_type": "logging",
      "description": "langfuse_otel",
      "access": { "teams": ["<team-a-id>"] }
    }
  }'
```

</details>

---

## Step 2 — Team admin assigns it to their team

A team admin opens their team settings and picks from the destinations visible to them.

![Team admin's Logging Exporters picker showing only in-scope destinations](/img/multitenant/team_admin_picker.png)

The dropdown only shows destinations the team is allowed to use. Destinations scoped to other teams are not listed and cannot be selected; this is enforced server-side, not client-side.

Click **Save**. The assignment is stored in the `logging_exporters` column on the team row.

:::tip Key or team level
Assignments can be set at the **key** level too. A key-level assignment overrides or supplements the team-level one. The proxy unions all three levels (key + team + org) at request time.
:::

---

## Step 3 — Traces fan out automatically

From this point forward, every LLM call made with a key belonging to that team exports spans to the assigned destination. No changes to the request body are needed.

```bash
curl https://your-proxy/v1/chat/completions \
  -H "Authorization: Bearer $TEAM_A_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "claude-haiku", "messages": [{"role": "user", "content": "hello"}]}'
# → spans land in team-a-langfuse automatically
```

Each backend receives the correct semantic vocabulary for its type: OpenInference attributes for Arize, the GenAI semantic convention plus Langfuse-specific attributes for Langfuse.

---

## Role reference

<Tabs>
<TabItem value="admin" label="Proxy admin">

Sees and manages all destinations.

![Admin view: all destinations, with Mode and Scope columns](/img/multitenant/admin_all_destinations.png)

The **Mode** column shows whether a destination fires automatically (`Auto-enabled`) or only when explicitly assigned (`Manual assignment`). The **Scope** column shows the configured access grants.

Can: create and delete destinations, rotate credentials, set access grants, assign any destination to any identity.

</TabItem>
<TabItem value="team_admin" label="Team admin">

Sees only destinations within their scope.

![Team-A scoped view; destinations scoped to other teams are absent](/img/multitenant/team_admin_scoped_view.png)

The table reflects the server-side filter. Destinations scoped to other teams are absent from the API response.

Can: view allowed destinations, assign them to their team or keys, add their own team to a destination's access list.

Cannot: see other teams' destination names, rotate credentials, set global or org grants, create or delete destinations.

</TabItem>
<TabItem value="org_admin" label="Org admin">

Sees destinations scoped to their organization and any teams within it.

![Org admin's scoped view; destinations from other orgs are absent](/img/multitenant/org_admin_scoped_view.png)

Can assign destinations to any team within their org via the team's settings; the UI automatically sends `organization_id` to identify the org-admin caller.

</TabItem>
<TabItem value="user" label="Internal user">

Cannot access the destination management UI. `GET /credentials` returns 403 for users with no team-admin or org-admin role.

</TabItem>
</Tabs>

---

## `auto_enable` vs manual assignment

These two controls are independent. `access` controls who can see and assign a destination. `auto_enable` controls whether assignment is needed at all within that scope.

| | `auto_enable=false` | `auto_enable=true` |
|---|---|---|
| **empty access** | Never fires | Fires for **all** proxy requests (proxy-wide) |
| **`access.global=true`** | Fires only when explicitly assigned | Fires for **all** proxy requests |
| **`access.teams=[A]`** | Fires only when explicitly assigned by team A | Fires automatically for **team A requests only** |
| **`access.orgs=[O]`** | Fires only when explicitly assigned by org O | Fires automatically for **org O requests only** |

:::note
`access.global=true` and `auto_enable=true` are not the same thing. A destination with `access.global=true` and `auto_enable=false` is **visible** and **assignable** by everyone, but does not export unless explicitly named in `logging_exporters`.
:::

The **Mode** column in the UI makes this clear. Hovering **Auto-enabled** shows a tooltip:

![Auto-enabled tooltip in the destinations table](/img/multitenant/auto_enable_tooltip.png)

---

## Supported backends

| Backend | `description` value | Protocol | Required credential fields |
|---|---|---|---|
| Langfuse | `langfuse_otel` | HTTP | `langfuse_public_key`, `langfuse_secret_key`, `langfuse_host` |
| Arize | `arize` | gRPC | `arize_space_id`, `arize_api_key`, `arize_project_name` |
| Weave (W&B) | `weave_otel` | HTTP | `wandb_api_key`, `weave_project_id` |
| Generic OTLP | `generic` | HTTP | `otel_endpoint`, `otel_headers` |

Any OTLP-compatible backend (Jaeger, Grafana Tempo, Honeycomb, a self-hosted collector) works via the generic adapter.

---

## Config requirement

For destinations to survive a proxy restart, add this to your `config.yaml`:

```yaml
general_settings:
  master_key: sk-1234
  store_model_in_db: true   # required: credentials reload from DB on startup
```

:::caution
Placing `store_model_in_db` under `litellm_settings` is silently ignored. It must be under `general_settings`.
:::
